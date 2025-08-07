import * as Y from "yjs";
import { createLoggingAsyncThunk } from "../../hooks";
import { SongInfo, _karaokeReducerActions, selfSelector } from "./slice";

import { invoke } from "@tauri-apps/api/core";
import { appRuntimeSelector, coreActions } from "../core";
import { WebsocketProvider } from "y-websocket";
import { getWebSocketURL } from "../../../utils";

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
            if (appRuntime === "tauri") {
                // We are running in the actual Tauri window, so we have access to `invoke`.
                const address: string = await invoke("get_server_address")
                console.log("Hosting address:", address)
                dispatch(
                    coreActions._setHostingAddress(address)
                );

                window.setTimeout(() => {
                    // We are the "server". Populate the song queue with initial data.
                    songQueue.delete(0, songQueue.length);
                    songQueue.push([
                        {
                            title: "Sunshine",
                            artist: "Kimberly",
                            duration: 340,
                        },
                        {
                            title: "Moonlight",
                            artist: "Unknown",
                            duration: 240,
                        },
                        {
                            title: "Starlight",
                            artist: "The Stars",
                            duration: 300,
                        },
                        {
                            title: "Twilight",
                            artist: "The Night",
                            duration: 360,
                        },
                    ]);
                    // For some reason this delay is needed :-(
                }, 1000);
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
        async (song: SongInfo, { dispatch }) => {
            // We change the song queue in the yjs document and everything else should update automatically.
            if (!doc) {
                throw new Error("Yjs document not initialized");
            }
            const songQueue = doc.getArray<SongInfo>("song-queue");
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
};
