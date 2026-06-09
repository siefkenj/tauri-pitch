use std::sync::Mutex;

use port_selector::Selector;
use tauri::Manager;

mod audio_capture;
mod fetch_youtube;
mod get_server_address;
mod localhost_server;
mod yrs_server;
// use tauri::{webview::WebviewWindowBuilder, WebviewUrl};

#[derive(Debug, Clone)]
#[allow(unused)]
struct AppData {
    http_port: u16,
    https_port: u16,
}

//#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let http_port = if port_selector::is_free(9527) {
        9527
    } else {
        port_selector::select_free_port(Selector {
            port_range: (9527, 9627),
            ..Default::default()
        })
        .expect("Could not find a free port")
    };
    // Claim the next port for the HTTPS server.
    let https_port = http_port + 1;
    assert!(
        port_selector::is_free(https_port),
        "HTTPS port {} is already in use",
        https_port
    );

    let app_data = AppData {
        http_port,
        https_port,
    };

    // Build the Tauri App
    tauri::Builder::default()
        .setup({
            let app_data = app_data.clone();
            move |app| {
                app.manage(Mutex::new(app_data.clone()));
                Ok(())
            }
        })
        .plugin(
            localhost_server::Builder::new(app_data.http_port, app_data.https_port)
                .host("0.0.0.0")
                .build(),
        )
        //.plugin(tauri_plugin_opener::init())
        //       .invoke_handler(tauri::generate_handler![audio_capture::record_sample])
        .invoke_handler(tauri::generate_handler![
            get_server_address::get_server_address,
            audio_capture::record_sample,
            fetch_youtube::fetch_youtube,
            fetch_youtube::get_available_songs,
            fetch_youtube::get_ytdlp_version,
            fetch_youtube::update_ytdlp,
        ])
        //.invoke_handler(tauri::generate_handler![fetch_youtube::fetch_youtube])
        // .setup(move |app| {
        //     let resolver = app.asset_resolver();
        //     dbg!(&resolver);
        //     dbg!(String::from_utf8(
        //         (&resolver
        //             .get(
        //                 //   "/assets/index-qosai88s.js".into()
        //                 "index.html".into()
        //             )
        //             .unwrap()
        //             .bytes())
        //             .iter()
        //             .cloned()
        //             .collect::<Vec<u8>>()
        //     ));
        //     let url = format!("http://localhost:{}", port).parse().unwrap();
        //     WebviewWindowBuilder::new(app, "main2".to_string(), WebviewUrl::External(url))
        //         .title("Localhost Example")
        //         .build()?;
        //     Ok(())
        // })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
