use futures_util::StreamExt;
use std::sync::Arc;
use tokio::sync::Mutex;
use warp::ws::{WebSocket, Ws};
use warp::{Filter, Rejection, Reply};
use yrs::sync::Awareness;
use yrs::Doc;
use yrs_warp::broadcast::BroadcastGroup;
use yrs_warp::ws::{WarpSink, WarpStream};
use yrs_warp::AwarenessRef;

const WS_PATH: &str = "tauri-pitch";

pub async fn start(port: u16) {
    // We're using a single static document shared among all the peers.
    let awareness: AwarenessRef = Arc::new(Awareness::new(Doc::new()));

    // open a broadcast group that listens to awareness and document updates
    // and has a pending message buffer of up to 32 updates
    let bcast = Arc::new(BroadcastGroup::new(awareness, 32).await);

    let ws = warp::path(WS_PATH)
        .and(warp::ws())
        .and(warp::any().map(move || bcast.clone()))
        .and_then(ws_handler);

    println!("Starting WebSocket server on ws://localhost:{port}/{WS_PATH}");
    warp::serve(ws).run(([0, 0, 0, 0], port)).await;
}

async fn ws_handler(ws: Ws, bcast: Arc<BroadcastGroup>) -> Result<impl Reply, Rejection> {
    Ok(ws.on_upgrade(move |socket| peer(socket, bcast)))
}

async fn peer(ws: WebSocket, bcast: Arc<BroadcastGroup>) {
    let (sink, stream) = ws.split();
    let sink = Arc::new(Mutex::new(WarpSink::from(sink)));
    let stream = WarpStream::from(stream);
    let sub = bcast.subscribe(sink, stream);
    match sub.completed().await {
        Ok(_) => println!("broadcasting for channel finished successfully"),
        Err(e) => eprintln!("broadcasting for channel finished abruptly: {}", e),
    }
}
