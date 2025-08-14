// Copyright 2019-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! Expose your apps assets through a localhost server instead of the default custom protocol.
//!
//! **Note: This plugins brings considerable security risks and you should only use it if you know what your are doing. If in doubt, use the default custom protocol implementation.**

use std::{
    collections::HashMap,
    fs::{self},
};

use http::Uri;
use tauri::{
    Manager, Runtime,
    plugin::{Builder as PluginBuilder, TauriPlugin},
};
use tiny_http::{Header, Response as HttpResponse, Server};

#[allow(unused)]
pub struct Request {
    url: String,
}

#[allow(unused)]
impl Request {
    pub fn url(&self) -> &str {
        &self.url
    }
}

pub struct Response {
    headers: HashMap<String, String>,
}

impl Response {
    pub fn add_header<H: Into<String>, V: Into<String>>(&mut self, header: H, value: V) {
        self.headers.insert(header.into(), value.into());
    }
}

type OnRequest = Option<Box<dyn Fn(&Request, &mut Response) + Send + Sync>>;

pub struct Builder {
    port: u16,
    host: Option<String>,
    on_request: OnRequest,
}

impl Builder {
    pub fn new(port: u16) -> Self {
        Self {
            port,
            host: None,
            on_request: None,
        }
    }

    #[allow(unused)]
    // Change the host the plugin binds to. Defaults to `localhost`.
    pub fn host<H: Into<String>>(mut self, host: H) -> Self {
        self.host = Some(host.into());
        self
    }

    #[allow(unused)]
    pub fn on_request<F: Fn(&Request, &mut Response) + Send + Sync + 'static>(
        mut self,
        f: F,
    ) -> Self {
        self.on_request.replace(Box::new(f));
        self
    }

    pub fn build<R: Runtime>(mut self) -> TauriPlugin<R> {
        let port = self.port;
        let host = self.host.unwrap_or("0.0.0.0".to_string());
        let on_request = self.on_request.take();

        PluginBuilder::new("localhost")
            .setup(move |app, _api| {
                let app_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
                let youtube_downloads_dir = app_dir.join("youtube_downloads");

                let asset_resolver = app.asset_resolver();
                let app_for_closure = app.clone();
                std::thread::spawn(move || {
                    // Set up a hashmap to quickly find files in the youtube_downloads directory.
                    let mut video_file_map = populate_hash_map(&youtube_downloads_dir);

                    let server =
                        Server::http(format!("{host}:{port}")).expect("Unable to spawn server");
                    println!("Listening on localhost server http://{host}:{port}");
                    for req in server.incoming_requests() {
                        let path = req
                            .url()
                            .parse::<Uri>()
                            .map(|uri| uri.path().into())
                            .unwrap_or_else(|_| req.url().into());
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
                            if req.method() == &tiny_http::Method::Post {
                                // Read the body to get the youtube hash.
                                println!(
                                    "Received request to download video with ID: {}",
                                    video_id
                                );
                                let app = app_for_closure.clone();
                                let res = tauri::async_runtime::block_on(
                                    crate::fetch_youtube::fetch_youtube(app, video_id.to_string()),
                                );
                                match res {
                                    Ok(title) => {
                                        req.respond(
                                            HttpResponse::from_string(title)
                                                .with_status_code(200)
                                                .with_header(
                                                    Header::from_bytes(
                                                        "Content-Type",
                                                        "text/plain",
                                                    )
                                                    .unwrap(),
                                                )
                                                // Add CORS headers
                                                .with_header(
                                                    Header::from_bytes(
                                                        "Access-Control-Allow-Origin",
                                                        "*",
                                                    )
                                                    .unwrap(),
                                                )
                                                .with_header(
                                                    Header::from_bytes(
                                                        "Access-Control-Allow-Methods",
                                                        "POST",
                                                    )
                                                    .unwrap(),
                                                )
                                                .with_header(
                                                    Header::from_bytes(
                                                        "Access-Control-Allow-Headers",
                                                        "Content-Type",
                                                    )
                                                    .unwrap(),
                                                ),
                                        )
                                        .unwrap();
                                    }
                                    Err(err) => {
                                        eprintln!(
                                            "    Error starting video download for {}: {}",
                                            video_id, err
                                        );
                                        req.respond(
                                            HttpResponse::from_string(format!(
                                                "Error starting video download: {}",
                                                err
                                            ))
                                            .with_status_code(500)
                                            .with_header(
                                                Header::from_bytes("Content-Type", "text/plain")
                                                    .unwrap(),
                                            )
                                            // Add CORS headers
                                            .with_header(
                                                Header::from_bytes(
                                                    "Access-Control-Allow-Origin",
                                                    "*",
                                                )
                                                .unwrap(),
                                            )
                                            .with_header(
                                                Header::from_bytes(
                                                    "Access-Control-Allow-Methods",
                                                    "POST",
                                                )
                                                .unwrap(),
                                            )
                                            .with_header(
                                                Header::from_bytes(
                                                    "Access-Control-Allow-Headers",
                                                    "Content-Type",
                                                )
                                                .unwrap(),
                                            ),
                                        )
                                        .unwrap();
                                    }
                                }
                                continue;
                            }

                            // If the video ID is in the map, we're ready to go. Otherwise,
                            // we search for the file name and update the map.
                            let file_name = video_file_map.get(video_id).cloned().or_else(|| {
                                // We didn't find the file in the map, so we search for it.
                                find_file_with_prefix(&youtube_downloads_dir, video_id).map(
                                    |name| {
                                        video_file_map
                                            .insert(video_id.to_string(), name.to_string());
                                        name
                                    },
                                )
                            });
                            // If we found a file name, we serve it.
                            if let Some(file_name) = file_name {
                                let file_path = youtube_downloads_dir.join(&file_name);
                                if let Ok(asset) = fs::read(&file_path) {
                                    println!("    Video file found: {}", &file_name);
                                    let request = Request {
                                        url: req.url().into(),
                                    };
                                    let mut response = Response {
                                        headers: Default::default(),
                                    };
                                    response.add_header("Content-Type", "video/mp4");
                                    // Allow video seeking; this header doesn't work in tiny_http, though.
                                    response.add_header("Accept-Ranges", "bytes");
                                    if let Some(on_request) = &on_request {
                                        on_request(&request, &mut response);
                                    }
                                    let mut resp = HttpResponse::from_data(asset);
                                    for (header, value) in response.headers {
                                        if let Ok(h) = Header::from_bytes(header.as_bytes(), value)
                                        {
                                            resp.add_header(h);
                                        }
                                    }
                                    req.respond(resp).expect("unable to setup response");
                                    continue;
                                } else {
                                    println!("    Video file not found: {}", &file_name);
                                }
                            } else {
                                println!("    No video file found for ID: {}", video_id);
                            }
                            req.respond(
                                HttpResponse::from_string("Video not found")
                                    .with_status_code(404)
                                    .with_header(
                                        Header::from_bytes("Content-Type", "text/plain").unwrap(),
                                    ),
                            )
                            .expect("unable to setup response");
                            continue;
                        }
                        println!("Received request for path: '{}'", &path);

                        #[allow(unused_mut)]
                        if let Some(mut asset) = asset_resolver.get(path.clone()) {
                            println!("Received request; delivering asset: '{}' ", &path);
                            let request = Request {
                                url: req.url().into(),
                            };
                            let mut response = Response {
                                headers: Default::default(),
                            };

                            response.add_header("Content-Type", asset.mime_type);
                            if let Some(csp) = asset.csp_header {
                                response
                                    .headers
                                    .insert("Content-Security-Policy".into(), csp);
                            }

                            if let Some(on_request) = &on_request {
                                on_request(&request, &mut response);
                            }

                            let mut resp = HttpResponse::from_data(asset.bytes);
                            for (header, value) in response.headers {
                                if let Ok(h) = Header::from_bytes(header.as_bytes(), value) {
                                    resp.add_header(h);
                                }
                            }
                            req.respond(resp).expect("unable to setup response");
                        } else {
                            println!("Asset not found: '{}'", &path);
                        }
                    }
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
