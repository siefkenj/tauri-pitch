use std::sync::{Arc, Mutex};

use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime, State};

use crate::AppData;

/// Get the address that external clients should connect to to use the app
#[tauri::command]
pub async fn fetch_youtube<R: Runtime>(
    app: AppHandle<R>,
    youtube_hash: String,
    //state: State<'_, Mutex<AppData>>,
) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    //.join("tauri-plugin-mic-recorder");
    let executables_dir = app_dir.join("libs");
    let save_dir = app_dir.join("youtube_downloads");

    println!(
        "Fetching YouTube video with hash: {} to directory: {:?}",
        &youtube_hash, &save_dir
    );

    // For some reason, yt_dlp doesn't like being run in Tauri's async runtime,
    // so we create a separate thread and run it as async there.
    let thread = std::thread::spawn(move || {
        async fn g(
            executables_dir: PathBuf,
            save_dir: PathBuf,
            youtube_hash: String,
        ) -> Result<(), String> {
            println!("Running YouTube fetcher in a separate thread");
            let fetcher =
                yt_dlp::Youtube::with_new_binaries(executables_dir.clone(), save_dir.clone())
                    .await
                    .map_err(|err| format!("Failed to create fetcher: {}", err))?;
            println!("YouTube fetcher binaries successfully initialized");

            let url = format!("https://www.youtube.com/watch?v={}", youtube_hash);
            let video_info = fetcher
                .fetch_video_infos(url.clone())
                .await
                .map_err(|err| format!("Failed to fetch video info: {}", err))?;
            let title = video_info.title;
            let id = video_info.id;
            println!("Downloading video from URL: {}", url);
            let video_path = fetcher
                .download_video_from_url(url, format!("{id}.{title}.mp4"))
                .await
                .map_err(|err| format!("Failed to download video: {}", err))?;

            println!("Video downloaded successfully to: {:?}", video_path);

            Ok(())
        }
        tauri::async_runtime::block_on(g(executables_dir, save_dir, youtube_hash))
    });

    let thread_result = thread
        .join()
        .map_err(|_| "Failed to join thread".to_string())?;
    let ret = thread_result.map_err(|err| err.to_string())?;
    Ok(ret)
}
