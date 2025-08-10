import { SongInfo } from "./state/redux-slices/karaoke";

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

/**
 * Appropriate format the name of a song for display.
 */
export function formatSongName(song: SongInfo): string {
    if (song.artist) {
        // Use an em dash to separate artist and title
        return `${song.artist} — ${song.title}`;
    }
    return song.title;
}

const YOUTUBE_REGEX =
    /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Gets the YouTube video ID from a URL. It will also return the id if just alphanumeric characters are passed.
 */
export function getYoutubeIdFromUrl(url: string): string | null {
    const match = url.match(YOUTUBE_REGEX);
    if (match && match[1]) {
        // If the URL matches the regex, return the YouTube ID
        return match[1];
    }
    // If the URL is just an ID, return it directly
    const idMatch = url.match(YOUTUBE_ID_REGEX);
    return idMatch ? idMatch[0] : null;
}
