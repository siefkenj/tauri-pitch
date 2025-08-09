use std::{
    net::{IpAddr, Ipv4Addr},
    sync::Mutex,
};

use tauri::{AppHandle, Runtime, State};

use crate::AppData;

/// Get the address that external clients should connect to to use the app
#[tauri::command]
pub async fn get_server_address<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, Mutex<AppData>>,
) -> Result<String, String> {
    let app_data = state.lock().unwrap().clone();

    // Find the IPv4 address with the lowest entropy.
    // Skip any loopback addresses (e.g. 127.0.0.1)

    let simplest_address = local_ip_address::list_afinet_netifas().map(|network_interfaces| {
        network_interfaces
            .into_iter()
            .map(|(_name, ip)| ip)
            .filter(|ip| !ip.is_loopback())
            .filter_map(|ip| {
                if let IpAddr::V4(v4_addr) = ip {
                    Some(v4_addr)
                } else {
                    None
                }
            })
            .min_by_key(|v4_addr| calculate_bit_entropy(v4_addr.to_bits()))
            .unwrap_or(Ipv4Addr::new(127, 0, 0, 1))
    });

    println!("Found local IP address: {:?}", simplest_address);

    simplest_address
        .map(|ip| {
            let port = app_data.http_port;
            format!("http://{}:{}", ip, port)
        })
        .map_err(|e| e.to_string())
}

fn calculate_bit_entropy(byte: u32) -> i32 {
    let mut zero_count = 0;
    let mut one_count = 0;

    // Count the occurrences of 0s and 1s
    for i in 0..32 {
        if (byte >> i) & 1 == 1 {
            one_count += 1;
        } else {
            zero_count += 1;
        }
    }

    let p0 = zero_count as f64 / 32.0;
    let p1 = one_count as f64 / 32.0;

    let mut entropy = 0.0;

    if p0 > 0.0 {
        entropy -= p0 * p0.log2();
    }
    if p1 > 0.0 {
        entropy -= p1 * p1.log2();
    }

    (entropy * 1000.) as i32
}
