/**
 * Guess the WebSocket URL based on heuristics of the current URL.
 */
export function getWebSocketURL(): string {
    // Our websocket address is our current address with the port number increased by 1.
    const wsAddress = new URL("http://" + window.location.host);
    wsAddress.port = (parseInt(wsAddress.port) + 1).toString();
    // If the port is 1421, that means we're running on the dev server and we should use 9528 instead.
    if (wsAddress.port === "1421") {
        wsAddress.port = "9528";
    }
    wsAddress.protocol = wsAddress.protocol === "https:" ? "wss:" : "ws:";
    return wsAddress.toString();
}
