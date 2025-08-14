// Copyright 2019-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! Expose your apps assets through a localhost server instead of the default custom protocol.
//!
//! **Note: This plugins brings considerable security risks and you should only use it if you know what your are doing. If in doubt, use the default custom protocol implementation.**

use std::{
    collections::HashMap,
    fs::{self},
    sync::Mutex,
};

use astra::ResponseBuilder;
use http::Method;
use tauri::{
    Manager, Runtime,
    plugin::{Builder as PluginBuilder, TauriPlugin},
};
//use tiny_http::{Header, Response as HttpResponse, Server};

pub struct Builder {
    port: u16,
    host: Option<String>,
}

impl Builder {
    pub fn new(port: u16) -> Self {
        Self { port, host: None }
    }

    #[allow(unused)]
    // Change the host the plugin binds to. Defaults to `localhost`.
    pub fn host<H: Into<String>>(mut self, host: H) -> Self {
        self.host = Some(host.into());
        self
    }

    pub fn build<R: Runtime>(self) -> TauriPlugin<R> {
        let port = self.port;
        let host = self.host.unwrap_or("0.0.0.0".to_string());

        PluginBuilder::new("localhost")
            .setup(move |app, _api| {
                let app_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
                let youtube_downloads_dir = app_dir.join("youtube_downloads");

                let asset_resolver = app.asset_resolver();
                let app_for_closure = app.clone();
                std::thread::spawn(move || {
                    // Set up a hashmap to quickly find files in the youtube_downloads directory.
                    let video_file_map = Mutex::new(populate_hash_map(&youtube_downloads_dir));

                    println!("Listening on localhost server http://{host}:{port}");
                    astra::Server::bind(format!("{host}:{port}"))
                        .serve(move |req: http::Request<astra::Body>, _info| {
                            let path = Some(req.uri())
                                .map(|uri| uri.path().into())
                                .unwrap_or_else(|| req.uri().to_string());
                            let path = if path == "/" {
                                "index.html".to_string()
                            } else {
                                path
                            };

                            // If the path starts with `/videos/XXX`, we serve from a special directory.
                            // We look for a file in the `youtube_downloads` directory whose file name starts with XXX and serve that.
                            if path.starts_with("/videos/") {
                                let video_id = path.trim_start_matches("/videos/");
                                // If this is a post request, we will fetch it from youtube instead of serving a file.
                                if req.method() == &Method::POST {
                                    // Read the body to get the youtube hash.
                                    println!(
                                        "Received request to download video with ID: {}",
                                        video_id
                                    );
                                    let app = app_for_closure.clone();
                                    let res = tauri::async_runtime::block_on(
                                        crate::fetch_youtube::fetch_youtube(
                                            app,
                                            video_id.to_string(),
                                        ),
                                    );
                                    return match res {
                                        Ok(title) => {
                                            ResponseBuilder::new()
                                                .status(200)
                                                .header("Content-Type", "text/plain")
                                                // Add CORS headers
                                                .header("Access-Control-Allow-Origin", "*")
                                                .header("Access-Control-Allow-Methods", "POST")
                                                .header(
                                                    "Access-Control-Allow-Headers",
                                                    "Content-Type",
                                                )
                                                .body(astra::Body::new(title))
                                                .unwrap()
                                        }
                                        Err(err) => {
                                            eprintln!(
                                                "    Error starting video download for {}: {}",
                                                video_id, err
                                            );
                                            ResponseBuilder::new()
                                                .status(500)
                                                .header("Content-Type", "text/plain")
                                                // Add CORS headers
                                                .header("Access-Control-Allow-Origin", "*")
                                                .header("Access-Control-Allow-Methods", "POST")
                                                .header(
                                                    "Access-Control-Allow-Headers",
                                                    "Content-Type",
                                                )
                                                .body(astra::Body::new(format!(
                                                    "Error starting video download: {}",
                                                    err
                                                )))
                                                .unwrap()
                                        }
                                    };
                                }

                                // If the video ID is in the map, we're ready to go. Otherwise,
                                // we search for the file name and update the map.
                                let file_name = {
                                    let mut video_file_map = video_file_map.lock().unwrap();
                                    video_file_map.get(video_id).cloned().or_else(|| {
                                        // We didn't find the file in the map, so we search for it.
                                        find_file_with_prefix(&youtube_downloads_dir, video_id).map(
                                            |name| {
                                                video_file_map
                                                    .insert(video_id.to_string(), name.to_string());
                                                name
                                            },
                                        )
                                    })
                                };
                                // If we found a file name, we serve it.
                                if let Some(file_name) = file_name {
                                    let file_path = youtube_downloads_dir.join(&file_name);
                                    if let Ok(asset) = fs::read(&file_path) {
                                        println!("    Video file found: {}", &file_name);
                                        // Check if we have requested a specific range of bytes.
                                        if let Some(range) = req.headers().get("Range") {
                                            // Parse the range header to get the start and end bytes.
                                            if let Ok(range_str) = range.to_str() {
                                                if let Some(range) =
                                                    range_str.strip_prefix("bytes=")
                                                {
                                                    let parts: Vec<&str> =
                                                        range.split('-').collect();
                                                    if parts.len() == 2 {
                                                        if let (Ok(start), Ok(end)) = (
                                                            parts[0].parse::<usize>(),
                                                            parts[1]
                                                                .parse::<usize>()
                                                                .or::<usize>(Ok(0)),
                                                        ) {
                                                            let end =
                                                                if end == 0 || end >= asset.len() {
                                                                    asset.len() - 1
                                                                } else {
                                                                    end
                                                                };
                                                            let chunk = asset[start..=end].to_vec();
                                                            return ResponseBuilder::new()
                                                                .status(206)
                                                                .header("Content-Type", "video/mp4")
                                                                // Allow video seeking
                                                                .header("Accept-Ranges", "bytes")
                                                                .header(
                                                                    "Content-Range",
                                                                    format!(
                                                                        "bytes {}-{}/{}",
                                                                        start,
                                                                        end,
                                                                        asset.len()
                                                                    ),
                                                                )
                                                                .body(astra::Body::new(chunk))
                                                                .unwrap();
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        return ResponseBuilder::new()
                                            .status(200)
                                            .header("Content-Type", "video/mp4")
                                            // Allow video seeking
                                            .header("Accept-Ranges", "bytes")
                                            .body(astra::Body::new(asset))
                                            .unwrap();
                                    } else {
                                        println!("    Video file not found: {}", &file_name);
                                    }
                                } else {
                                    println!("    No video file found for ID: {}", video_id);
                                }
                                return ResponseBuilder::new()
                                    .status(404)
                                    .header("Content-Type", "text/plain")
                                    .body(astra::Body::new("Video not found"))
                                    .unwrap();
                            }
                            println!("Received request for path: '{}'", &path);

                            #[allow(unused_mut)]
                            if let Some(mut asset) = asset_resolver.get(path.clone()) {
                                println!("Received request; delivering asset: '{}' ", &path);
                                return ResponseBuilder::new()
                                    .status(200)
                                    .header("Content-Type", asset.mime_type)
                                    .body(astra::Body::new(asset.bytes))
                                    .unwrap();
                            } else {
                                println!("Asset not found: '{}'", &path);
                            }

                            ResponseBuilder::new()
                                .status(500)
                                .header("Content-Type", "text/plain")
                                .body(astra::Body::new("Server didn't understand what to process"))
                                .unwrap()
                        })
                        .expect("Unable to spawn server");
                });
                Ok(())
            })
            .build()
    }
}

/// Read through all files in `root_dir`. The file names should be of the form `XXX.*.mp4` where `XXX` is the video ID.
/// Populate the `map` with the file ids as keys and the full file names as values.
fn populate_hash_map(root_dir: &std::path::Path) -> HashMap<String, String> {
    let mut map = HashMap::new();
    if let Ok(entries) = std::fs::read_dir(root_dir) {
        for entry in entries {
            let entry = entry.expect("Failed to read directory entry");
            let path = entry.path();
            if path.is_file()
                && let Some(file_name) = path.file_name().and_then(|s| s.to_str())
            {
                if let Some(video_id) = file_name.split('.').next().map(|s| s.to_string()) {
                    map.insert(video_id, path.to_str().unwrap().to_string());
                }
            }
        }
    } else {
        eprintln!("Failed to read directory: {}", root_dir.display());
    }
    map
}

/// Scan through a directory and search for a file name that starts with the given prefix.
fn find_file_with_prefix(dir: &std::path::Path, prefix: &str) -> Option<String> {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_file() {
                if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                    if file_name.starts_with(prefix) {
                        return Some(file_name.to_string());
                    }
                }
            }
        }
    }
    None
}
