import * as Y from "yjs";
import { createLoggingAsyncThunk } from "../../hooks";
import {
    SongInfo,
    _karaokeReducerActions,
    allSongsSelector,
    selfSelector,
} from "./slice";

import { invoke } from "@tauri-apps/api/core";
import { appRuntimeSelector, coreActions } from "../core";
import { WebsocketProvider } from "y-websocket";
import { getWebSocketURL } from "../../../utils";
import { karaokeActions } from ".";

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
            const downloadQueue = doc.getArray<SongInfo>("download-queue");
            downloadQueue.observe((event: Y.YArrayEvent<SongInfo>) => {
                dispatch(
                    _karaokeReducerActions._setDownloadQueue(
                        event.target.toArray()
                    )
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
                window.setTimeout(async () => {
                    // We are the "server". Populate the song queue with initial data.
                    const initialSongs = await initialSongsPromise;

                    // Set the list of all songs and sync across clients
                    allSongs.delete(0, allSongs.length);
                    allSongs.push(initialSongs);

                    // Put everything in the queue for now...
                    songQueue.delete(0, songQueue.length);
                    songQueue.push(initialSongs);
                    // For some reason this delay is needed :-(
                }, 1000);

                // The song download queue is special. We are the Tauri process, so we are the only
                // ones that can download songs. We watch the song download queue and act accordingly.
                downloadQueue.observe(
                    async (event: Y.YArrayEvent<SongInfo>) => {
                        // Find the first song in the queue that is pending
                        const pendingSongIndex = event.target
                            .toArray()
                            .findIndex(
                                (song) => song.downloadStatus === "pending"
                            );
                        if (pendingSongIndex === -1) {
                            // No pending songs, nothing to do
                            return;
                        }
                        let songToDownload: SongInfo = {
                            ...event.target.get(pendingSongIndex),
                            downloadStatus: "downloading",
                        };
                        if (!songToDownload) {
                            console.warn(
                                "Error: No song found at index",
                                pendingSongIndex,
                                "in download queue. This may mean that the download queue was updated while this code was executing."
                            );
                            return;
                        }
                        // Update the song in the download queue
                        downloadQueue.delete(pendingSongIndex, 1);
                        downloadQueue.insert(pendingSongIndex, [
                            songToDownload,
                        ]);
                        // Now we can download the song
                        try {
                            await invoke("fetch_youtube", {
                                youtubeHash: songToDownload.key,
                            });
                            downloadQueue.delete(pendingSongIndex, 1);
                        } catch (error) {
                            console.error(
                                "Error downloading song",
                                songToDownload,
                                error
                            );
                            // Update the song in the download queue to reflect the error
                            songToDownload = {
                                ...songToDownload,
                                downloadStatus: "error",
                                title: "Error: " + error,
                            };
                            downloadQueue.delete(pendingSongIndex, 1);
                            downloadQueue.insert(pendingSongIndex, [
                                songToDownload,
                            ]);
                        }
                    }
                );
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
    pushToDownloadQueue: createLoggingAsyncThunk(
        "karaoke/pushToDownloadQueue",
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
            const downloadQueue = doc.getArray<SongInfo>("download-queue");
            // Check if the song is already in the download queue
            if (
                (duplicateSong = downloadQueue
                    .toArray()
                    .find((s) => s.key === song.key))
            ) {
                console.log(
                    "Song",
                    song,
                    "already exists in download queue, not adding again. Found duplicate:",
                    duplicateSong
                );
                throw new Error(
                    `Song with id ${song.key} already exists in download queue with status ${duplicateSong.downloadStatus}.`
                );
            }
            // We believe the song is actually new and not in the download queue, so add it.
            downloadQueue.push([{ ...song, downloadStatus: "pending" }]);
        }
    ),
    /**
     * Monitor the download queue for information about when a song has been downloaded.
     */
    waitForSongDownload: createLoggingAsyncThunk(
        "karaoke/waitForSongDownload",
        async (song: SongInfo, { dispatch, getState }) => {
            if (!doc) {
                throw new Error("Yjs document not initialized");
            }
            // Wait for the song to be downloaded
            const downloadQueue = doc.getArray<SongInfo>("download-queue");
            let resolve: Function, reject: Function;
            const startedDownloadingPromise = new Promise((res, rej) => {
                resolve = res;
                reject = rej;
            });
            // Poll the download queue. Our song appears with the status "downloading" | "error"
            // within the first one second of calling this thunk. Return an error if it does not.
            const startTime = Date.now();
            const interval = setInterval(() => {
                const songInQueue = downloadQueue
                    .toArray()
                    .find((s) => s.key === song.key);
                if (songInQueue) {
                    if (songInQueue.downloadStatus === "downloading") {
                        // The song is being downloaded, we can resolve the promise
                        clearInterval(interval);
                        resolve();
                    } else if (songInQueue.downloadStatus === "error") {
                        // The song failed to download, we can reject the promise
                        clearInterval(interval);
                        reject(
                            new Error(
                                "Song failed to download: " + songInQueue.title
                            )
                        );
                    }
                }
                // If 1 second has passed and we haven't entered the "downloading" state, something is wrong.
                if (Date.now() - startTime > 1000) {
                    clearInterval(interval);
                    reject(
                        new Error(
                            "Song did not start downloading for some reason :-("
                        )
                    );
                }
            }, 100);
            await startedDownloadingPromise;

            // We know the song is in the downloading state. Poll until the song is no longer in the queue or
            // is in the queue with the status "error".
            return await new Promise<SongInfo>((resolve, reject) => {
                const interval = setInterval(() => {
                    const songInQueue = downloadQueue
                        .toArray()
                        .find((s) => s.key === song.key);
                    if (!songInQueue) {
                        // The song is no longer in the queue, we can resolve the promise
                        clearInterval(interval);
                        resolve(song);
                    } else if (songInQueue.downloadStatus === "error") {
                        // The song failed to download, we can reject the promise
                        clearInterval(interval);
                        reject(
                            new Error(
                                "Song failed to download: " + songInQueue.title
                            )
                        );
                    }
                }, 100);
            });
        }
    ),
};
