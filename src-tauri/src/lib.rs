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
    websocket_port: u16,
}

//#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let first_open_port = if port_selector::is_free(9527) {
        9527
    } else {
        // Pick a random port if 9527 is not free
        port_selector::select_free_port(Selector {
            port_range: (9527, 9627),
            ..Default::default()
        })
        .expect("Could not find a free port")
    };
    // Check the next port, since it will be used for the WebSocket server
    let second_open_port = {
        let guess = first_open_port + 1;
        if port_selector::is_free(guess) {
            guess
        } else {
            panic!("Could not fined two sequential free ports");
        }
    };

    let app_data = AppData {
        http_port: first_open_port,
        websocket_port: second_open_port,
    };

    // Build the Tauri App
    tauri::Builder::default()
        .setup({
            let app_data = app_data.clone();
            move |app| {
                app.manage(Mutex::new(app_data.clone()));
                // Spawn a thread to run the Yrs server
                std::thread::spawn(move || {
                    let rt = tokio::runtime::Builder::new_current_thread()
                        .enable_all()
                        .build()
                        .expect("Failed to create Tokio runtime");
                    rt.block_on(yrs_server::start(app_data.websocket_port));
                });

                Ok(())
            }
        })
        .plugin(
            localhost_server::Builder::new(app_data.http_port)
                .host("0.0.0.0")
                .build(),
        )
        //.plugin(tauri_plugin_opener::init())
        //       .invoke_handler(tauri::generate_handler![audio_capture::record_sample])
        .invoke_handler(tauri::generate_handler![
            get_server_address::get_server_address,
            audio_capture::record_sample,
            fetch_youtube::fetch_youtube,
            fetch_youtube::get_available_songs
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
