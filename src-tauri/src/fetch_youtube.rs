use serde::{Deserialize, Serialize};

use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, Runtime};

/// Fetch a YouTube video by its video id. If successful, the title of the video is returned.
#[tauri::command]
pub async fn fetch_youtube<R: Runtime>(
    app: AppHandle<R>,
    youtube_hash: String,
    //state: State<'_, Mutex<AppData>>,
) -> Result<String, String> {
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
        ) -> Result<SongInfo, String> {
            let fetcher =
                yt_dlp::Youtube::with_new_binaries(executables_dir.clone(), save_dir.clone())
                    .await
                    .map_err(|err| format!("Failed to create fetcher: {}", err))?;
            println!("   YouTube fetcher binaries successfully initialized");

            let url = format!("https://www.youtube.com/watch?v={}", youtube_hash);
            let video_info = fetcher
                .fetch_video_infos(url.clone())
                .await
                .map_err(|err| format!("Failed to fetch video info: {}", err))?;

            // The actual downloading of the video through yt_dlp is unreliable...so we simulate an error and always manually call the app.
            // // Try to find a video format with a width of 1280 or height of 720
            // // If none is found, settle on the "best" format
            // let best_format = video_info
            //     .formats
            //     .iter()
            //     .filter(|f| {
            //         matches!(f.video_resolution.width, Some(1280))
            //             || matches!(f.video_resolution.height, Some(720))
            //     })
            //     .max_by(|a, b| video_info.compare_video_formats(a, b))
            //     .or_else(|| {
            //         video_info
            //             .formats
            //             .iter()
            //             .max_by(|a, b| video_info.compare_video_formats(a, b))
            //     });
            // if best_format.is_none() {
            //     return Err("No suitable video format found".to_string());
            // }
            // let best_format = best_format.unwrap();
            // let video_path = fetcher
            //     .download_format(best_format, format!("{id}.{title}.mp4"))
            //     .await;

            let title = video_info.title.clone();
            let id = video_info.id.clone();
            println!("Downloading video '{}' '{}' from URL: {}", title, id, &url);
            let video_path: Result<PathBuf, String> = Err("Simulated download failure".to_string());

            // If we failed to download the video, we will try to call the binary manually and pass a cookies.txt file to it.
            match video_path {
                Ok(path) => {
                    println!("    Video downloaded successfully to: {:?}", path);
                    return Ok(SongInfo { key: id, title });
                }
                Err(err) => {
                    println!(
                        "    Failed to download video using yt-dlp library: {}. Trying to call binary manually.",
                        err
                    );
                    let output = std::process::Command::new(executables_dir.join("yt-dlp"))
                        .arg("--no-progress")
                        .arg("-o")
                        .arg(format!("{id}.{title}"))
                        // This is different from yt_dlp (I think...)
                        .arg("--cookies")
                        .arg(executables_dir.join("cookies.txt"))
                        // Remux the videos so they are always in the mp4 format
                        .arg("-t")
                        .arg("mp4")
                        .arg("-f")
                        .arg("bestvideo[height<=?1080][fps<=?60]+bestaudio/best[height<=?1080]")
                        .arg(url)
                        .current_dir(save_dir.clone())
                        .output()
                        .map_err(|err| format!("    Failed to execute yt-dlp binary: {}", err))?;
                    if !output.status.success() {
                        return Err(format!(
                            "    yt-dlp binary failed with status: {}. Output: {}",
                            output.status,
                            String::from_utf8_lossy(&output.stderr)
                        ));
                    }
                    println!(
                        "    Video downloaded successfully. Log:\n      {}",
                        String::from_utf8_lossy(&output.stdout).replace("\n", "\n      ")
                    );
                }
            }

            Ok(SongInfo { key: id, title })
        }
        tauri::async_runtime::block_on(g(executables_dir, save_dir, youtube_hash))
    });

    let thread_result = thread
        .join()
        .map_err(|_| "Failed to join thread".to_string())?;
    let ret = thread_result.map_err(|err| err.to_string())?;

    // Let the frontend know that a new song is available.
    app.emit("song:added", &ret)
        .map_err(|err| err.to_string())?;

    Ok(ret.title)
}

/// Get a list of all songs available in the videos directory and return a JSON object in the format of
/// `SongInfo { key: String, title: String, }`
#[tauri::command]
pub async fn get_available_songs<R: Runtime>(app: AppHandle<R>) -> Result<Vec<SongInfo>, String> {
    let app_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    let videos_dir = app_dir.join("youtube_downloads");

    if !videos_dir.exists() {
        return Ok(vec![]);
    }

    let mut songs = vec![];
    for entry in std::fs::read_dir(videos_dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        if entry.file_type().map_err(|err| err.to_string())?.is_file() {
            let file_name = entry.file_name();
            if let Some(file_stem) = file_name.to_str() {
                // Files are stored as "key.title.mp4", so we split by '.' to get the key and title
                // and ignore the extension.
                if let Some((key, title)) = file_stem.split_once('.') {
                    // Remove the ".mp4" extension from the title
                    let title = title.trim_end_matches(".mp4");
                    songs.push(SongInfo {
                        key: key.to_string(),
                        title: title.to_string(),
                    });
                }
            }
        }
    }

    Ok(songs)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SongInfo {
    pub key: String,
    pub title: String,
}
