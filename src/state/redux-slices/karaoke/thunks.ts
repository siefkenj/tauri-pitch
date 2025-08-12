import * as Y from "yjs";
import { createLoggingAsyncThunk } from "../../hooks";
import {
    SongInfo,
    _karaokeReducerActions,
    allSongsSelector,
    selfSelector,
    songQueueSelector,
} from "./slice";

import { invoke } from "@tauri-apps/api/core";
import {
    appRuntimeSelector,
    coreActions,
    hostingAddressSelector,
} from "../core";
import { WebsocketProvider } from "y-websocket";
import { getWebSocketURL } from "../../../utils";
import { karaokeActions } from ".";
import { listen } from "@tauri-apps/api/event";

let provider: WebsocketProvider | null = null;
let doc: Y.Doc | null = null;

export const karaokeThunks = {
    /**
     * Set up the yjs listeners for the karaoke system.
     */
    initKaraoke: createLoggingAsyncThunk(
        "core/initKaraoke",
        async (_: void, { dispatch, getState }) => {
            const appRuntime = appRuntimeSelector(getState());
            if (!doc) {
                doc = new Y.Doc();
            }
            if (!provider) {
                provider = new WebsocketProvider(
                    getWebSocketURL(),
                    "tauri-pitch",
                    doc,
                    { disableBc: true }
                );
            }

            const songQueue = doc.getArray<SongInfo>("song-queue");
            songQueue.observe((event: Y.YArrayEvent<SongInfo>) => {
                dispatch(
                    _karaokeReducerActions._setQueue(event.target.toArray())
                );
            });
            const allSongs = doc.getArray<SongInfo>("all-songs");
            allSongs.observe((event: Y.YArrayEvent<SongInfo>) => {
                dispatch(
                    _karaokeReducerActions._setAllSongs(event.target.toArray())
                );
            });

            if (appRuntime === "tauri") {
                // We are running in the actual Tauri window, so we have access to `invoke`.
                const address: string = await invoke("get_server_address");
                console.log("Hosting address:", address);
                dispatch(coreActions._setHostingAddress(address));

                // We need to initialize our data structures.
                const initialSongsPromise: Promise<SongInfo[]> = invoke(
                    "get_available_songs"
                );
                window.setTimeout(
                    async () => {
                        // We are the "server". Populate the song queue with initial data.
                        const initialSongs = await initialSongsPromise;

                        // Set the list of all songs and sync across clients
                        allSongs.delete(0, allSongs.length);
                        allSongs.push(initialSongs);
                    },
                    // For some reason this delay is needed :-(
                    1000
                );

                // Listen for when new songs are added
                listen<SongInfo>("song:added", (event) => {
                    const newSong = event.payload;
                    console.log("New song added:", newSong);
                    // Add the new song to the all songs array
                    allSongs.push([newSong]);
                });
            }
            dispatch(_karaokeReducerActions._setQueue(songQueue.toArray()));
        }
    ),
    /**
     * Clean up the karaoke system.
     */
    cleanupKaraoke: createLoggingAsyncThunk(
        "core/cleanupKaraoke",
        async (_: void, { dispatch }) => {
            if (provider) {
                provider.destroy();
                provider = null;
            }
            if (doc) {
                doc.destroy();
                doc = null;
            }
            dispatch(_karaokeReducerActions._setQueue([]));
        }
    ),
    /**
     * Demote a song in the queue to the next lower position.
     */
    demoteSong: createLoggingAsyncThunk(
        "karaoke/demoteSong",
        async (index: number, { dispatch }) => {
            // We change the song queue in the yjs document and everything else should update automatically.
            if (!doc) {
                throw new Error("Yjs document not initialized");
            }
            const songQueue = doc.getArray<SongInfo>("song-queue");
            if (index < 0 || index >= songQueue.length - 1) {
                return;
            }
            const song = songQueue.get(index);
            songQueue.delete(index, 1);
            songQueue.insert(index + 1, [song]);
        }
    ),
    /**
     * Promote a song in the queue to the next higher position.
     */
    promoteSong: createLoggingAsyncThunk(
        "karaoke/promoteSong",
        async (index: number, { dispatch }) => {
            // We change the song queue in the yjs document and everything else should update automatically.
            if (!doc) {
                throw new Error("Yjs document not initialized");
            }
            const songQueue = doc.getArray<SongInfo>("song-queue");
            if (index <= 0 || index >= songQueue.length) {
                return;
            }
            const song = songQueue.get(index);
            songQueue.delete(index, 1);
            songQueue.insert(index - 1, [song]);
        }
    ),
    /**
     * Add a song to the queue.
     */
    addToQueue: createLoggingAsyncThunk(
        "karaoke/addToQueue",
        async (song: SongInfo, { dispatch, getState }) => {
            // We change the song queue in the yjs document and everything else should update automatically.
            if (!doc) {
                throw new Error("Yjs document not initialized");
            }
            const songQueue = doc.getArray<SongInfo>("song-queue");
            // If the song is already in the queue, we don't add it.
            const existingSong = songQueue
                .toArray()
                .find((s) => s.key === song.key);
            if (existingSong) {
                throw new Error("DUPLICATE_SONG");
            }

            songQueue.push([song]);
        }
    ),
    /**
     * Remove a song from the queue.
     */
    removeFromQueue: createLoggingAsyncThunk(
        "karaoke/removeFromQueue",
        async (index: number, { dispatch }) => {
            // We change the song queue in the yjs document and everything else should update automatically.
            if (!doc) {
                throw new Error("Yjs document not initialized");
            }
            const songQueue = doc.getArray<SongInfo>("song-queue");
            if (index < 0 || index >= songQueue.length) {
                return;
            }
            songQueue.delete(index, 1);
        }
    ),
    /**
     * Set the next song in the queue as currently playing.
     */
    setTopOfQueueAsNextSong: createLoggingAsyncThunk(
        "karaoke/setNextSong",
        async (_: void, { dispatch }) => {
            if (!doc) {
                throw new Error("Yjs document not initialized");
            }
            const songQueue = doc.getArray<SongInfo>("song-queue");
            const nextSong = songQueue.get(0);
            if (nextSong) {
                dispatch(karaokeActions._setCurrentlyPlaying(nextSong));
                // Remove the song from the queue
                songQueue.delete(0, 1);
            }
        }
    ),
    /**
     * Push a song to the download queue.
     */
    downloadSong: createLoggingAsyncThunk(
        "karaoke/downloadSong",
        async (song: SongInfo, { dispatch, getState }) => {
            // We change the song queue in the yjs document and everything else should update automatically.
            if (!doc) {
                throw new Error("Yjs document not initialized");
            }
            // Check that a song with the same key does not already exist the all-songs array.
            const allSongs = allSongsSelector(getState());
            let duplicateSong: SongInfo | undefined;
            if ((duplicateSong = allSongs.find((s) => s.key === song.key))) {
                console.log(
                    "Song",
                    song,
                    "already exists in all songs, not adding to download queue. Found duplicate:",
                    duplicateSong
                );
                throw new Error(
                    `Song with id ${song.key} already exists in song library.`
                );
            }

            // We made it through all of our checks. Now we send a post request to the server in hopes that it downloads the song.
            const hostingAddress = hostingAddressSelector(getState());
            if (!hostingAddress) {
                return new Error("Hosting address not set");
            }
            const resp = await fetch(hostingAddress + "/videos/" + song.key, {
                method: "POST",
            });
            if (!resp.ok) {
                throw new Error(await resp.text());
            }
            return resp.text();
        }
    ),
    /**
     * Play a random song from the library.
     */
    playRandomSong: createLoggingAsyncThunk(
        "karaoke/playRandomSong",
        async (_: void, { dispatch, getState }) => {
            const allSongs = allSongsSelector(getState());
            const randomSong =
                allSongs[Math.floor(Math.random() * allSongs.length)];
            console.log("Playing random song:", randomSong);
            if (randomSong) {
                dispatch(karaokeActions._setCurrentlyPlaying(randomSong));
            }
        }
    ),
};
