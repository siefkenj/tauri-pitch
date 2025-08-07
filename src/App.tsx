import "normalize.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import "./App.css";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppDispatch, useAppSelector } from "./state/hooks";
import { coreThunks } from "./state/redux-slices/core/thunks";
import {
    activeAudioDeviceSelector,
    appRuntimeSelector,
    clarityThresholdSelector,
    currentPitchSelector,
    hostingAddressSelector,
} from "./state/redux-slices/core";
import { Button, Divider, HTMLSelect } from "@blueprintjs/core";
import { CircleChart } from "./components/circle-chart/circle-chat";
import { SocketTest } from "./socket";
import { Route, Routes } from "react-router";
import { NavTabStrip } from "./components/nav-tabs";
import { Karaoke } from "./components/karaoke";
import { karaokeActions } from "./state/redux-slices/karaoke";

function App() {
    const dispatch = useAppDispatch();
    const activeAudioDevice = useAppSelector(activeAudioDeviceSelector);
    const currentPitch = useAppSelector(currentPitchSelector);
    const clarityThreshold = useAppSelector(clarityThresholdSelector);
    const appRuntime = useAppSelector(appRuntimeSelector);
    const hostingAddress = useAppSelector(hostingAddressSelector);

    useEffect(() => {
        // Initialize the worker when the app starts
        dispatch(coreThunks.initWorker());
        dispatch(karaokeActions.initKaraoke())

        return () => {
            // Cleanup if necessary
            dispatch(coreThunks.stopCollectingPitches());
            dispatch(karaokeActions.cleanupKaraoke());
        }
    }, []);


    return (
        <main className="container">
            <div className="body-surround">
                <Routes>
                    <Route path="" element={<NavTabStrip />}>
                        <Route
                            index
                            path="circle-chart"
                            element={
                                <>
                                    <div className="header">
                                        <label>
                                            Device:{" "}
                                            <HTMLSelect>
                                                <option value="current-device">
                                                    {activeAudioDevice ||
                                                        "Not Recording"}
                                                </option>
                                                {/* <option value="mcleod">McLeod</option> */}
                                            </HTMLSelect>
                                        </label>
                                        <Button
                                            className="record-button"
                                            icon={
                                                !activeAudioDevice
                                                    ? "play"
                                                    : "stop"
                                            }
                                            onClick={async () => {
                                                if (!activeAudioDevice) {
                                                    console.log(
                                                        "Starting audio processing"
                                                    );
                                                    await dispatch(
                                                        coreThunks.initAudioDevice()
                                                    );
                                                    await dispatch(
                                                        coreThunks.setPitchDetectionAlgorithm(
                                                            "autocorrelation"
                                                        )
                                                    );
                                                    await dispatch(
                                                        coreThunks.collectPitches()
                                                    );
                                                } else {
                                                    console.log(
                                                        "Stopping audio processing"
                                                    );
                                                    await dispatch(
                                                        coreThunks.stopCollectingPitches()
                                                    );
                                                }
                                            }}
                                        >
                                            {activeAudioDevice
                                                ? "Stop"
                                                : "Start"}
                                        </Button>
                                    </div>
                                    <div className="body">
                                        {/* <div>{JSON.stringify(currentPitch, null, 2)}</div> */}
                                        <div className="display-container">
                                            <CircleChart
                                                freq={
                                                    currentPitch.clarity >=
                                                    clarityThreshold
                                                        ? currentPitch.pitch ||
                                                          440
                                                        : null
                                                }
                                                clarity={
                                                    currentPitch.clarity >=
                                                    clarityThreshold
                                                        ? currentPitch.clarity
                                                        : null
                                                }
                                            />
                                        </div>
                                    </div>
                                </>
                            }
                        />
                        <Route path="karaoke" element={<Karaoke />} />
                    </Route>
                </Routes>
            </div>
            <div className="footer">
                <SocketTest />
                <div>Address: {hostingAddress} (Runtime: {appRuntime})</div>
            </div>
        </main>
    );
}

export default App;
