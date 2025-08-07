use cpal::{
    traits::{DeviceTrait, HostTrait, StreamTrait},
    Stream,
};
use std::{
    marker::{Send, Sync},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, LazyLock, Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Runtime};

struct SafeStream(Stream);

unsafe impl Send for SafeStream {}
unsafe impl Sync for SafeStream {}

struct State {
    is_recording: Arc<AtomicBool>,
    stream: Arc<Mutex<Option<SafeStream>>>,
}

impl State {
    fn new() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            stream: Arc::new(Mutex::new(None)),
        }
    }
}
static STATE: LazyLock<Arc<Mutex<State>>> = LazyLock::new(|| Arc::new(Mutex::new(State::new())));

/// Record an audio sample from the default input device for `interval` milliseconds.
///
/// Returns a tuple `(sample_rate, audio_data)`.
#[tauri::command]
pub async fn record_sample<R: Runtime>(
    _app_handle: AppHandle<R>,
    interval: i32,
) -> Result<(i32, Vec<f32>), String> {
    {
        let state = STATE.lock().map_err(|err| err.to_string())?;
        if state.is_recording.load(Ordering::SeqCst) {
            return Err("Recording is already in progress.".to_string());
        }
        state.is_recording.store(true, Ordering::SeqCst);
    }

    let host = cpal::default_host();

    // Set up the input device and stream with the default input config.
    let device = host
        .default_input_device()
        .ok_or("No default input device available")?;

    let config = device
        .default_input_config()
        .map_err(|err| err.to_string())?;
    // println!("Using device: {}", device.name().unwrap_or_default());
    // println!("Using config: {:?}", &config);

    let sample_rate = config.sample_rate().0 as usize;
    let num_channels = config.channels() as usize;
    // Buffer to store the captured audio data
    let buffer = Arc::new(Mutex::new(Vec::with_capacity(
        sample_rate * num_channels * interval as usize / 1000 * 2,
    )));

    let err_fn = move |err: cpal::StreamError| {
        eprintln!("an error occurred on stream: {}", err);
    };

    let stream = match config.sample_format() {
        cpal::SampleFormat::I8 | cpal::SampleFormat::I16 | cpal::SampleFormat::I32 => {
            return Err("Unsupported sample format".to_string())
        }
        cpal::SampleFormat::F32 => {
            // Clone the Arc before we move it into the closure
            let buffer = buffer.clone();
            device
                .build_input_stream(
                    &config.into(),
                    move |data: &[f32], _: &_| {
                        let mut buf = buffer.lock().map_err(|err| err.to_string()).unwrap();
                        buf.extend_from_slice(data);
                    },
                    err_fn,
                    None,
                )
                .map_err(|err| err.to_string())?
        }
        _ => return Err("Unsupported sample format".to_string()),
    };

    stream.play().map_err(|err| err.to_string())?;

    // Sleep for the specified interval
    async_std::task::sleep(Duration::from_millis(10 + interval as u64)).await;

    // Stop the stream
    let state = STATE.lock().map_err(|err| err.to_string())?;
    if !state.is_recording.load(Ordering::SeqCst) {
        return Err("No recording in progress.".to_string());
    }
    state.is_recording.store(false, Ordering::SeqCst);
    if let Some(stream) = state.stream.lock().map_err(|err| err.to_string())?.take() {
        drop(stream.0);
    }

    // We now have the resulting data, but it is interleaved based on the number of channels.
    let resulting_data = buffer.lock().map_err(|err| err.to_string())?;
    let resulting_data = resulting_data
        .chunks(num_channels)
        .map(|chunk| {
            // Average the channels to get a single channel output
            chunk.iter().sum::<f32>() / num_channels as f32
        })
        // Our first few samples might not be any good, so skip the firs 10 samples
        .skip(10)
        .collect();

    Ok((sample_rate as i32, resulting_data))
}
