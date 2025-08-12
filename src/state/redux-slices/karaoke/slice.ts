import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../store";

export type SongInfo = {
    key: string;
    title: string;
    artist?: string;
    duration?: number;
    playPosition?: number;
    downloadStatus?: "pending" | "downloading" | "error";
};

export interface KaraokeState {
    currentlyPlaying: SongInfo | null;
    songQueue: SongInfo[];
    allSongs: SongInfo[];
}

// Define the initial state using that type
const initialState: KaraokeState = {
    currentlyPlaying: null,
    songQueue: [],
    allSongs: [],
};

const karaokeSlice = createSlice({
    name: "karaoke",
    initialState,
    reducers: {
        _setCurrentlyPlaying: (
            state,
            action: PayloadAction<SongInfo | null>
        ) => {
            state.currentlyPlaying = action.payload;
        },
        _addToQueue: (state, action: PayloadAction<SongInfo>) => {
            state.songQueue.push(action.payload);
        },
        _removeFromQueue: (state, action: PayloadAction<number>) => {
            state.songQueue.splice(action.payload, 1);
        },
        _setQueue: (state, action: PayloadAction<SongInfo[]>) => {
            state.songQueue = action.payload;
        },
        _promoteSong: (state, action: PayloadAction<number>) => {
            const index = action.payload;
            if (index > 0 && index < state.songQueue.length) {
                const song = state.songQueue.splice(index, 1)[0];
                state.songQueue.splice(index - 1, 0, song);
            }
        },
        _demoteSong: (state, action: PayloadAction<number>) => {
            const index = action.payload;
            if (index >= 0 && index < state.songQueue.length - 1) {
                const song = state.songQueue.splice(index, 1)[0];
                state.songQueue.splice(index + 1, 0, song);
            }
        },
        _setAllSongs: (state, action: PayloadAction<SongInfo[]>) => {
            state.allSongs = action.payload;
        },
    },
});

export const karaokeReducer = karaokeSlice.reducer;

/**
 * Synchronous actions that directly manipulate data in the store.
 */
export const _karaokeReducerActions = { ...karaokeSlice.actions };

export const selfSelector = (state: RootState) => state.karaoke;

export const currentlyPlayingSelector = (state: RootState) =>
    state.karaoke.currentlyPlaying;
export const songQueueSelector = (state: RootState) => state.karaoke.songQueue;
export const allSongsSelector = (state: RootState) => state.karaoke.allSongs;
