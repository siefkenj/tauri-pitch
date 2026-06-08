use base64::Engine as _;
use std::io::Read;
use tauri::{AppHandle, Runtime};

use crate::fetch_youtube;

#[derive(serde::Deserialize)]
struct UploadRequest {
    filename: String,
    data: String,
}

fn header(name: &str, value: &str) -> tiny_http::Header {
    tiny_http::Header::from_bytes(name.as_bytes(), value.as_bytes()).unwrap()
}

/// Run a blocking tiny_http upload server; accepts base64-encoded JSON POSTs and saves them to the song library.
pub fn start<R: Runtime>(app: AppHandle<R>, port: u16) {
    let addr = format!("0.0.0.0:{}", port);
    let server = tiny_http::Server::http(&addr)
        .unwrap_or_else(|e| panic!("Failed to bind upload server on {}: {}", addr, e));
    println!("Upload server listening on http://{}", addr);

    for mut request in server.incoming_requests() {
        if matches!(request.method(), tiny_http::Method::Options) {
            let _ = request.respond(
                tiny_http::Response::empty(204u16)
                    .with_header(header("Access-Control-Allow-Origin", "*"))
                    .with_header(header("Access-Control-Allow-Methods", "POST, OPTIONS"))
                    .with_header(header("Access-Control-Allow-Headers", "Content-Type"))
                    .with_header(header("Access-Control-Max-Age", "86400")),
            );
            continue;
        }

        if !matches!(request.method(), tiny_http::Method::Post) {
            let _ = request.respond(
                tiny_http::Response::from_string("Method not allowed")
                    .with_status_code(405u16)
                    .with_header(header("Access-Control-Allow-Origin", "*")),
            );
            continue;
        }

        let content_length: Option<u64> = request
            .headers()
            .iter()
            .find(|h| h.field.equiv("content-length"))
            .and_then(|h| h.value.as_str().parse().ok());

        let mut raw = Vec::new();
        let read_result = match content_length {
            Some(len) => request.as_reader().take(len).read_to_end(&mut raw),
            None => request.as_reader().read_to_end(&mut raw),
        };

        if let Err(e) = read_result {
            let _ = request.respond(
                tiny_http::Response::from_string(format!("Failed to read body: {}", e))
                    .with_status_code(500u16)
                    .with_header(header("Access-Control-Allow-Origin", "*")),
            );
            continue;
        }

        let upload_req: UploadRequest = match serde_json::from_slice(&raw) {
            Ok(v) => v,
            Err(e) => {
                let _ = request.respond(
                    tiny_http::Response::from_string(format!("Invalid JSON: {}", e))
                        .with_status_code(400u16)
                        .with_header(header("Access-Control-Allow-Origin", "*")),
                );
                continue;
            }
        };

        let bytes = match base64::engine::general_purpose::STANDARD.decode(&upload_req.data) {
            Ok(v) => v,
            Err(e) => {
                let _ = request.respond(
                    tiny_http::Response::from_string(format!("Invalid base64: {}", e))
                        .with_status_code(400u16)
                        .with_header(header("Access-Control-Allow-Origin", "*")),
                );
                continue;
            }
        };

        let res = tauri::async_runtime::block_on(fetch_youtube::save_uploaded_song(
            app.clone(),
            bytes,
            upload_req.filename,
        ));

        match res {
            Ok(song_info) => {
                let _ = request.respond(
                    tiny_http::Response::from_string(song_info.key)
                        .with_header(header("Content-Type", "text/plain"))
                        .with_header(header("Access-Control-Allow-Origin", "*")),
                );
            }
            Err(err) => {
                let _ = request.respond(
                    tiny_http::Response::from_string(format!("Upload failed: {}", err))
                        .with_status_code(500u16)
                        .with_header(header("Access-Control-Allow-Origin", "*")),
                );
            }
        }
    }
}
