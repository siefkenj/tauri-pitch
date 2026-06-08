import { SongInfo } from "./state/redux-slices/karaoke";

/**
 * Guess the WebSocket URL based on heuristics of the current URL.
 * Defaults to using `window.location.host` if no host is provided.
 */
export function getWebSocketURL(host = window.location.host): string {
    // If `host` starts with a protocol, we need to strip it.
    if (/\w+:\/\//.test(host)) {
        const url = new URL(host);
        host = url.host;
    }
    // Our websocket address is our current address with the port number increased by 1.
    const wsAddress = new URL("http://" + host);
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

/**
 * Extract a display title from an uploaded filename.
 * Strips the extension, strips a trailing `|<id>` suffix when the title
 * portion contains a dash (Artist - Title format), and removes any
 * remaining `|` characters.
 */
export function parseUploadFilename(filename: string): string {
    const stem = filename.replace(/\.[^/.]+$/, "").trim();
    const pipeIdx = stem.lastIndexOf("|");
    if (pipeIdx >= 0 && stem.slice(0, pipeIdx).includes("-")) {
        return stem.slice(0, pipeIdx).replace(/\|/g, "").trim();
    }
    return stem.replace(/\|/g, "").trim();
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
