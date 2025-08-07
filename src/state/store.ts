import { configureStore } from "@reduxjs/toolkit";
import { coreReducer } from "./redux-slices/core";
import { karaokeReducer } from "./redux-slices/karaoke";

/**
 * This Redux store keeps the state/update state for the whole app.
 */
export const store = configureStore({
    reducer: {
        core: coreReducer,
        karaoke: karaokeReducer,
    },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
