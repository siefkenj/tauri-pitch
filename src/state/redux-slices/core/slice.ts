import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../store";

export interface CoreState {
    pitchDetectionAlgorithm: "autocorrelation" | "mcleod";
    windowSize: number;
    /**
     * The threshold of confidence for a detected pitch to be displayed.
     */
    clarityThreshold: number;
    /**
     * The minimum power for the pitch detection algorithm to guess a pitch for.
     */
    powerThreshold: number;
    currentPitch: { pitch: number; clarity: number };

    activeAudioDevice: string | null;

    workerCacheKey?: number;
    inErrorState: boolean;
}

// Define the initial state using that type
const initialState: CoreState = {
    pitchDetectionAlgorithm: "mcleod",
    windowSize: 2048,
    clarityThreshold: 0.5,
    powerThreshold: 0.015,
    currentPitch: { pitch: 0, clarity: 0 },
    activeAudioDevice: null,

    workerCacheKey: undefined,
    inErrorState: false,
};

const coreSlice = createSlice({
    name: "core",
    initialState,
    reducers: {
        _setPitchDetectionAlgorithm: (
            state,
            action: PayloadAction<"autocorrelation" | "mcleod">
        ) => {
            state.pitchDetectionAlgorithm = action.payload;
        },
        _setWindowSize: (state, action: PayloadAction<number>) => {
            state.windowSize = action.payload;
        },
        _setClarityThreshold: (state, action: PayloadAction<number>) => {
            state.clarityThreshold = action.payload;
        },
        _setPowerThreshold: (state, action: PayloadAction<number>) => {
            state.powerThreshold = action.payload;
        },
        setCurrentPitch: (
            state,
            action: PayloadAction<{ pitch: number; clarity: number }>
        ) => {
            state.currentPitch = action.payload;
        },
        setActiveAudioDevice: (state, action: PayloadAction<string | null>) => {
            state.activeAudioDevice = action.payload;
        },

        _setWorkerCacheKey: (state, action: PayloadAction<number>) => {
            state.workerCacheKey = action.payload;
        },
        _setInErrorState: (state, action: PayloadAction<boolean>) => {
            state.inErrorState = action.payload;
        },
    },
});

export const coreReducer = coreSlice.reducer;

/**
 * Synchronous actions that directly manipulate data in the store.
 */
export const _coreReducerActions = { ...coreSlice.actions };

export const selfSelector = (state: RootState) => state.core;

export const activeAudioDeviceSelector = (state: RootState) =>
    selfSelector(state).activeAudioDevice;

export const currentPitchSelector = (state: RootState) =>
    selfSelector(state).currentPitch;

export const clarityThresholdSelector = (state: RootState) =>
    selfSelector(state).clarityThreshold;
