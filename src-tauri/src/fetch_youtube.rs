use serde::{Deserialize, Serialize};

use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, Runtime};

fn sanitize_title(s: &str) -> String {
    sanitize_filename::sanitize(s)
        .replace('|', "")
        .trim()
        .to_string()
}

/// Strip ANSI escape sequences (e.g. color codes) from a string.
fn strip_ansi(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = String::with_capacity(s.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'\x1b' && i + 1 < bytes.len() && bytes[i + 1] == b'[' {
            i += 2;
            while i < bytes.len() && !bytes[i].is_ascii_alphabetic() {
                i += 1;
            }
            i += 1; // skip terminating letter
        } else {
            out.push(bytes[i] as char);
            i += 1;
        }
    }
    out
}

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
                .map_err(|err| strip_ansi(&format!("Failed to fetch video info: {}", err)))?;

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

            // Download manually using the commandline because the yt_dlp crate is unreliable.
            let output = std::process::Command::new(executables_dir.join("yt-dlp"))
                .env("NO_COLOR", "1")
                // XXX: This doesn't work. deno doesn't read the DENO_OPTS env variable.
                .env("DENO_OPTS", "--allow-env")
                .env("WS_NO_BUFFER_UTIL", "1")
                .arg("--remote-components")
                .arg("ejs:npm")
                .arg("--no-progress")
                .arg("--no-colors")
                .arg("-o")
                .arg(format!("{id}"))
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
                    strip_ansi(&String::from_utf8_lossy(&output.stderr))
                ));
            }
            // Rename the video to be in the format of "{title}|{id}.mp4"
            let original_path = save_dir.join(format!("{}.mp4", &id));
            let sanitized_title = sanitize_title(&title);
            let new_path = save_dir.join(format!("{} |{}.mp4", sanitized_title, &id));
            println!(
                "    Renaming downloaded video from {:?} to {:?}",
                &original_path, &new_path
            );
            std::fs::rename(&original_path, &new_path).map_err(|err| {
                format!(
                    "    Failed to rename downloaded video from {:?} to {:?}: {}",
                    &original_path, &new_path, err
                )
            })?;
            println!(
                "    Video downloaded successfully. Log:\n      {}",
                String::from_utf8_lossy(&output.stdout).replace("\n", "\n      ")
            );

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

/// Save raw video bytes to the song library under a fresh `UPLOAD#####` key.
pub async fn save_uploaded_song<R: Runtime>(
    app: AppHandle<R>,
    bytes: Vec<u8>,
    filename: String,
) -> Result<SongInfo, String> {
    let app_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    let save_dir = app_dir.join("youtube_downloads");
    std::fs::create_dir_all(&save_dir).map_err(|e| e.to_string())?;

    // Split off extension and trim whitespace.
    let (stem, ext) = match filename.rfind('.') {
        Some(dot) => (&filename[..dot], &filename[dot + 1..]),
        None => (filename.as_str(), "mp4"),
    };
    let stem = stem.trim();

    // Strip trailing |<id> if present: find the last |, verify everything after it is
    // id-valid chars, and assume it's an id if the part before the | contains a "-".
    let stem = if let Some(pipe) = stem.rfind('|') {
        let (before, after) = (&stem[..pipe], &stem[pipe + 1..]);
        if after
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
            && before.contains('-')
        {
            before
        } else {
            stem
        }
    } else {
        stem
    };

    let title = sanitize_title(stem);

    // All saved files end in ` |UPLOAD#####.ext`. Search through those to find the next available UPLOAD##### key.
    // Find the highest UPLOAD##### id already on disk and increment.
    let mut max_n: u32 = 0;
    if let Ok(entries) = std::fs::read_dir(&save_dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str().map(|s| s.to_string()) {
                if let Some(pos) = name.rfind("|UPLOAD") {
                    let digits = &name[pos + 7..].chars().take(5).collect::<String>();
                    if digits.len() <= 5 {
                        if let Ok(n) = digits.parse::<u32>() {
                            max_n = max_n.max(n);
                        }
                    }
                }
            }
        }
    }
    let key = format!("UPLOAD{:05}", max_n + 1);

    let filename = format!("{} |{}.{}", title, key, ext);
    let file_path = save_dir.join(&filename);

    std::fs::write(&file_path, &bytes)
        .map_err(|e| format!("Failed to write uploaded file: {}", e))?;

    println!("Uploaded song saved as {:?}", file_path);

    let song_info = SongInfo {
        key: key.clone(),
        title,
    };
    app.emit("song:added", &song_info)
        .map_err(|e| e.to_string())?;

    Ok(song_info)
}

/// Get the version of the yt-dlp binary.
#[tauri::command]
pub async fn get_ytdlp_version<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    let executables_dir = app_dir.join("libs");

    let output = std::process::Command::new(executables_dir.join("yt-dlp"))
        .arg("--version")
        .output()
        .map_err(|err| format!("Failed to execute yt-dlp binary: {}", err))?;

    if !output.status.success() {
        return Err(format!(
            "yt-dlp --version failed with status: {}",
            output.status
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Update the yt-dlp binary.
#[tauri::command]
pub async fn update_ytdlp<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    let executables_dir = app_dir.join("libs");
    let yt_dlp_path = executables_dir.join("yt-dlp");

    let output = std::process::Command::new(&yt_dlp_path)
        .arg("--update")
        .output()
        .map_err(|err| format!("Failed to execute yt-dlp binary: {}", err))?;

    if !output.status.success() {
        return Err(format!(
            "yt-dlp --update failed with status: {}. Output: {}",
            output.status,
            strip_ansi(&String::from_utf8_lossy(&output.stderr))
        ));
    }

    Ok(())
}

/// Get a list of all songs available in the videos directory and return a JSON object in the format of
/// `SongInfo { key: String, title: String, }`
/// Both `.mp4` and `.webm` files are indexed. If both exist for the same key, `.mp4` takes priority.
#[tauri::command]
pub async fn get_available_songs<R: Runtime>(app: AppHandle<R>) -> Result<Vec<SongInfo>, String> {
    let app_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    let videos_dir = app_dir.join("youtube_downloads");

    if !videos_dir.exists() {
        return Ok(vec![]);
    }

    let mut songs: Vec<SongInfo> = vec![];
    let mut seen_keys: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Pre-collect so we can do two passes: mp4 first so it takes priority over webm.
    let entries: Vec<_> = std::fs::read_dir(&videos_dir)
        .map_err(|err| err.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
        .collect();

    for ext in [".mp4", ".webm"] {
        for entry in &entries {
            let file_name = entry.file_name();
            if let Some(file_name_str) = file_name.to_str()
                && file_name_str.ends_with(ext)
            {
                let stem = file_name_str.trim_end_matches(ext);
                // Format: "TITLE|YOUTUBE ID.ext"
                let parsed = if let Some((title, key)) = stem.rsplit_once('|') {
                    Some((key.to_string(), title.to_string()))
                // Format: "YOUTUBE ID.TITLE.ext"
                } else if let Some((key, title)) = stem.split_once('.') {
                    Some((key.to_string(), title.to_string()))
                } else {
                    None
                };
                if let Some((key, title)) = parsed {
                    if !seen_keys.contains(&key) {
                        seen_keys.insert(key.clone());
                        songs.push(SongInfo { key, title });
                    }
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
