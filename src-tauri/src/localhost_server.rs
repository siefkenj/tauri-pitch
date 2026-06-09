// Copyright 2019-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! Expose your apps assets through a localhost server instead of the default custom protocol.
//!
//! **Note: This plugin brings considerable security risks and you should only use it if you know what you are doing. If in doubt, use the default custom protocol implementation.**

use std::{
    collections::HashMap,
    convert::Infallible,
    path::PathBuf,
    sync::{Arc, Mutex},
};

// Brings .encode()/.decode() into scope on the STANDARD engine value.
use base64::Engine as _;
use serde::Deserialize;
use tauri::{
    Manager, Runtime,
    plugin::{Builder as PluginBuilder, TauriPlugin},
};
use warp::Filter;

#[derive(Deserialize)]
struct UploadRequest {
    filename: String,
    data: String,
}

pub struct Builder {
    /// Plain HTTP port.
    port: u16,
    /// TLS (HTTPS/WSS) port.
    https_port: u16,
    /// Bind address; defaults to `0.0.0.0`.
    host: Option<String>,
}

impl Builder {
    /// Creates a new [`Builder`]. `port` is the plain HTTP port; `https_port` is the TLS port.
    /// Both ports bind to the same host and serve identical routes.
    pub fn new(port: u16, https_port: u16) -> Self {
        Self {
            port,
            https_port,
            host: None,
        }
    }

    /// Change the host the plugin binds to. Defaults to `0.0.0.0`.
    pub fn host<H: Into<String>>(mut self, host: H) -> Self {
        self.host = Some(host.into());
        self
    }

    pub fn build<R: Runtime>(self) -> TauriPlugin<R> {
        let port = self.port;
        let https_port = self.https_port;
        let host_str = self.host.unwrap_or_else(|| "0.0.0.0".to_string());

        PluginBuilder::new("localhost")
            .setup(move |app, _api| {
                let app_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;

                // Load cert/key from disk, or generate and persist them on first run.
                let tls_dir = app_dir.join("tls");
                let cert_path = tls_dir.join("cert.pem");
                let key_path = tls_dir.join("key.pem");
                let (cert_pem, key_pem) = if cert_path.exists() && key_path.exists() {
                    let cert = std::fs::read(&cert_path).map_err(|e| e.to_string())?;
                    let key = std::fs::read(&key_path).map_err(|e| e.to_string())?;
                    (cert, key)
                } else {
                    let mut sans = vec!["localhost".to_string(), "127.0.0.1".to_string()];
                    if let Ok(lan_ip) = local_ip_address::local_ip() {
                        let s = lan_ip.to_string();
                        if s != "127.0.0.1" {
                            sans.push(s);
                        }
                    }
                    let rcgen::CertifiedKey { cert, key_pair } =
                        rcgen::generate_simple_self_signed(sans).map_err(|e| e.to_string())?;
                    let cert_bytes = cert.pem().into_bytes();
                    let key_bytes = key_pair.serialize_pem().into_bytes();
                    std::fs::create_dir_all(&tls_dir).map_err(|e| e.to_string())?;
                    std::fs::write(&cert_path, &cert_bytes).map_err(|e| e.to_string())?;
                    std::fs::write(&key_path, &key_bytes).map_err(|e| e.to_string())?;
                    (cert_bytes, key_bytes)
                };
                let youtube_downloads_dir = Arc::new(app_dir.join("youtube_downloads"));
                let video_file_map =
                    Arc::new(Mutex::new(populate_hash_map(&youtube_downloads_dir)));
                let app_handle = app.app_handle().clone();

                // Capture the asset resolver as a closure so we don't need to name its type.
                let asset_resolver = app.asset_resolver();
                let resolve_asset = Arc::new(move |path: String| asset_resolver.get(path));

                let addr: std::net::SocketAddr = format!("{}:{}", host_str, port)
                    .parse()
                    .expect("Invalid server address");

                println!("Listening on http://{}:{}", host_str, port);
                println!("Listening on https://{}:{}", host_str, https_port);

                // The server address exposed to the frontend is the LAN IP, but the WebView loads
                // from localhost — cross-origin. warp's cors() filter handles OPTIONS preflight
                // automatically and adds Access-Control-Allow-* headers to every response.
                let cors = warp::cors()
                    .allow_any_origin()
                    .allow_methods(vec!["GET", "POST", "OPTIONS"])
                    .allow_headers(vec!["Content-Type"]);

                let routes = warp::any()
                    .and(warp::method())
                    .and(warp::path::full())
                    .and(warp::header::headers_cloned())
                    .and(warp::body::bytes())
                    .and_then(move |method, path, headers, body: bytes::Bytes| {
                        let app = app_handle.clone();
                        let resolve = resolve_asset.clone();
                        let map = video_file_map.clone();
                        let dir = youtube_downloads_dir.clone();
                        async move {
                            Ok::<_, Infallible>(
                                serve(method, path, headers, body.to_vec(), app, resolve, map, dir)
                                    .await,
                            )
                        }
                    })
                    .with(cors);

                tauri::async_runtime::spawn(async move {
                    let ws_filter = crate::yrs_server::make_filter().await;
                    let all_routes = ws_filter.or(routes);
                    let http = warp::serve(all_routes.clone()).run(addr);

                    let https_addr: std::net::SocketAddr = format!("{}:{}", host_str, https_port)
                        .parse()
                        .expect("Invalid HTTPS address");
                    let https = warp::serve(all_routes)
                        .tls()
                        .cert(cert_pem)
                        .key(key_pem)
                        .run(https_addr);
                    tokio::join!(http, https);
                });

                Ok(())
            })
            .build()
    }
}

/// Build a plain-text HTTP response with the given status code.
fn text_response(status: u16, body: impl Into<String>) -> warp::reply::Response {
    warp::http::Response::builder()
        .status(status)
        .header("Content-Type", "text/plain")
        .body(warp::hyper::Body::from(body.into()))
        .unwrap()
}

/// Route a request to the upload handler, YouTube download trigger, video file server, or static asset resolver.
async fn serve<R: Runtime>(
    method: warp::http::Method,
    path: warp::path::FullPath,
    headers: warp::http::HeaderMap,
    body: Vec<u8>,
    app: tauri::AppHandle<R>,
    resolve_asset: Arc<dyn Fn(String) -> Option<tauri::Asset> + Send + Sync>,
    video_file_map: Arc<Mutex<HashMap<String, String>>>,
    youtube_downloads_dir: Arc<PathBuf>,
) -> warp::reply::Response {
    let raw = path.as_str();
    let path = if raw == "/" {
        "index.html"
    } else {
        raw.trim_start_matches('/')
    };

    // POST /upload-file - file upload (body is already fully read by warp, no deadlock)
    if path == "upload-file" && method == warp::http::Method::POST {
        let req: UploadRequest = match serde_json::from_slice(&body) {
            Ok(v) => v,
            Err(e) => return text_response(400, format!("Invalid JSON: {}", e)),
        };
        let bytes = match base64::engine::general_purpose::STANDARD.decode(&req.data) {
            Ok(v) => v,
            Err(e) => return text_response(400, format!("Invalid base64: {}", e)),
        };
        return match crate::fetch_youtube::save_uploaded_song(app, bytes, req.filename).await {
            Ok(info) => text_response(200, info.key),
            Err(e) => text_response(500, format!("Upload failed: {}", e)),
        };
    }

    // If the path starts with `/videos/XXX`, serve from the youtube_downloads directory.
    // We look for a file whose name contains the video ID and serve that.
    if let Some(video_id) = path.strip_prefix("videos/") {
        let video_id = video_id.trim_end_matches('/');

        // POST /videos/:id — trigger a YouTube download; the video ID is the YouTube hash.
        if method == warp::http::Method::POST {
            println!("Received request to download video with ID: {}", video_id);
            return match crate::fetch_youtube::fetch_youtube(app, video_id.to_string()).await {
                Ok(title) => text_response(200, title),
                Err(e) => {
                    eprintln!("Error starting video download for {}: {}", video_id, e);
                    text_response(500, format!("Error starting video download: {}", e))
                }
            };
        }

        // GET /videos/:id — serve the video file with optional Range support for seeking.
        // If the video ID is in the map, we're ready to go. Otherwise search the directory
        // for a matching filename and add it to the map for next time.
        let file_name = {
            let mut map = video_file_map.lock().unwrap();
            map.get(video_id).cloned().or_else(|| {
                find_file_with_prefix(&youtube_downloads_dir, video_id).map(|name| {
                    map.insert(video_id.to_string(), name.clone());
                    name
                })
            })
        };

        if let Some(file_name) = file_name {
            let file_path = youtube_downloads_dir.join(&file_name);
            match tokio::fs::read(&file_path).await {
                Ok(asset) => {
                    println!("    Video file found: {}", &file_name);
                    // Check if the client requested a specific byte range (needed for video seeking).
                    if let Some(range_val) = headers.get("Range") {
                        if let Ok(range_str) = range_val.to_str() {
                            if let Some(range) = range_str.strip_prefix("bytes=") {
                                let parts: Vec<&str> = range.split('-').collect();
                                if parts.len() == 2 {
                                    if let Ok(start) = parts[0].parse::<usize>() {
                                        let end = parts[1]
                                            .parse::<usize>()
                                            .unwrap_or(0)
                                            .min(asset.len().saturating_sub(1));
                                        let end = if end == 0 { asset.len() - 1 } else { end };
                                        let chunk = asset[start..=end].to_vec();
                                        return warp::http::Response::builder()
                                            .status(206)
                                            .header("Content-Type", "video/mp4")
                                            .header("Accept-Ranges", "bytes")
                                            .header(
                                                "Content-Range",
                                                format!("bytes {}-{}/{}", start, end, asset.len()),
                                            )
                                            .body(warp::hyper::Body::from(chunk))
                                            .unwrap();
                                    }
                                }
                            }
                        }
                    }
                    return warp::http::Response::builder()
                        .status(200)
                        .header("Content-Type", "video/mp4")
                        .header("Accept-Ranges", "bytes")
                        .body(warp::hyper::Body::from(asset))
                        .unwrap();
                }
                Err(_) => println!("    Video file not found: {}", &file_name),
            }
        } else {
            println!("    No video file found for ID: {}", video_id);
        }

        return text_response(404, "Video not found");
    }

    // Static asset fallback
    println!("Received request for path: '{}'", path);
    if let Some(asset) = resolve_asset(path.to_string()) {
        return warp::http::Response::builder()
            .status(200)
            .header("Content-Type", asset.mime_type)
            .body(warp::hyper::Body::from(asset.bytes.to_vec()))
            .unwrap();
    }
    println!("Asset not found: '{}'", path);

    text_response(500, "Server didn't understand what to process")
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

/// Scan through a directory and search for a file matching the given YouTube ID.
/// Supports both new format (`TITLE|YOUTUBE ID.ext`) and old format (`YOUTUBE ID.TITLE.ext`).
fn find_file_with_prefix(dir: &std::path::Path, prefix: &str) -> Option<String> {
    let suffix_mp4 = format!("|{}.mp4", prefix);
    let suffix_webm = format!("|{}.webm", prefix);
    let prefix_dot = format!("{}.", prefix);
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                    if file_name.ends_with(&suffix_mp4)
                        || file_name.ends_with(&suffix_webm)
                        || (file_name.starts_with(&prefix_dot)
                            && (file_name.ends_with(".mp4") || file_name.ends_with(".webm")))
                    {
                        return Some(file_name.to_string());
                    }
                }
            }
        }
    }
    None
}
