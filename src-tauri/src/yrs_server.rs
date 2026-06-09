use futures_util::StreamExt;
use std::sync::Arc;
use tokio::sync::{Mutex, OnceCell};
use warp::ws::{WebSocket, Ws};
use warp::{Filter, Rejection, Reply};
use yrs::Doc;
use yrs::sync::Awareness;
use yrs_warp::AwarenessRef;
use yrs_warp::broadcast::BroadcastGroup;
use yrs_warp::ws::{WarpSink, WarpStream};

pub const WS_PATH: &str = "tauri-pitch";

static BCAST: OnceCell<Arc<BroadcastGroup>> = OnceCell::const_new();

/// Returns the process-wide [`BroadcastGroup`], creating it on first call.
/// All WebSocket servers (HTTP and HTTPS) share this single instance so that
/// every connected peer — regardless of which port they used — sees the same
/// Yrs document.
async fn shared_bcast() -> Arc<BroadcastGroup> {
    BCAST
        .get_or_init(|| async {
            // Single static document shared among all peers.
            let awareness: AwarenessRef = Arc::new(Awareness::new(Doc::new()));
            // Broadcast group listens to awareness and document updates;
            // 32 is the pending message buffer size.
            Arc::new(BroadcastGroup::new(awareness, 32).await)
        })
        .await
        .clone()
}

/// Returns a cloneable warp filter for the Yrs WebSocket route (`/tauri-pitch`).
/// Merged into both the HTTP and HTTPS servers so all clients share the same document.
pub async fn make_filter()
-> impl Filter<Extract = impl Reply, Error = Rejection> + Clone + Send + Sync + 'static {
    let bcast = shared_bcast().await;
    warp::path(WS_PATH)
        .and(warp::ws())
        .and(warp::any().map(move || bcast.clone()))
        .and_then(ws_handler)
}

/// Warp handler that upgrades an HTTP connection to a WebSocket and hands it to [`peer`].
async fn ws_handler(ws: Ws, bcast: Arc<BroadcastGroup>) -> Result<impl Reply, Rejection> {
    Ok(ws.on_upgrade(move |socket| peer(socket, bcast)))
}

/// Subscribes a single WebSocket connection to the shared [`BroadcastGroup`] and
/// drives it until the connection closes or errors.
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
