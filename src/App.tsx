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
    clarityThresholdSelector,
    currentPitchSelector,
} from "./state/redux-slices/core";
import { Button, Divider, HTMLSelect } from "@blueprintjs/core";
import { CircleChart } from "./components/circle-chart/circle-chat";
import { startRecording, stopRecording } from "tauri-plugin-mic-recorder-api";

function App() {
    const [greetMsg, setGreetMsg] = useState("");
    const [name, setName] = useState("");
    const dispatch = useAppDispatch();
    const activeAudioDevice = useAppSelector(activeAudioDeviceSelector);
    const currentPitch = useAppSelector(currentPitchSelector);
    const clarityThreshold = useAppSelector(clarityThresholdSelector);

    useEffect(() => {
        // Initialize the worker when the app starts
        dispatch(coreThunks.initWorker());
    }, []);

    async function greet() {
        // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
        setGreetMsg(await invoke("greet", { name }));
    }

    return (
        <main className="container">
            <div className="header">
                <Button variant="minimal" icon="menu">
                    Settings
                </Button>
                <Divider />
                <label>
                    Device:{" "}
                    <HTMLSelect>
                        <option value="current-device">
                            {activeAudioDevice || "Not Recording"}
                        </option>
                        {/* <option value="mcleod">McLeod</option> */}
                    </HTMLSelect>
                </label>
                <Button
                    className="record-button"
                    icon={!activeAudioDevice ? "play" : "stop"}
                    onClick={async () => {
                        if (!activeAudioDevice) {
                            console.log("Starting audio processing");
                            await dispatch(coreThunks.initAudioDevice());
                            await dispatch(
                                coreThunks.setPitchDetectionAlgorithm(
                                    "autocorrelation"
                                )
                            );
                            await dispatch(coreThunks.collectPitches());
                        } else {
                            console.log("Stopping audio processing");
                            await dispatch(coreThunks.stopCollectingPitches());
                        }
                    }}
                >
                    {activeAudioDevice ? "Stop" : "Start"}
                </Button>
            </div>
            <div className="body">
                {/* <div>{JSON.stringify(currentPitch, null, 2)}</div> */}
                <div className="display-container">
                    <CircleChart
                        freq={
                            currentPitch.clarity >= clarityThreshold
                                ? currentPitch.pitch || 440
                                : null
                        }
                        clarity={
                            currentPitch.clarity >= clarityThreshold
                                ? currentPitch.clarity
                                : null
                        }
                    />
                </div>
                {/* <p>Click on the Tauri, Vite, and React logos to learn more!!</p>

                <form
                    className="row"
                    onSubmit={(e) => {
                        e.preventDefault();
                        greet();
                    }}
                >
                    <input
                        id="greet-input"
                        onChange={(e) => setName(e.currentTarget.value)}
                        placeholder="Enter a name..."
                    />
                    <button type="submit">Greet</button>
                </form>
                <button
                    onClick={async () => {
                        console.log("Starting to collect pitches");
                        await dispatch(coreThunks.initAudioDevice());
                        await dispatch(
                            coreThunks.setPitchDetectionAlgorithm(
                                "autocorrelation"
                            )
                        );
                        const pitch = await dispatch(
                            coreThunks.collectPitches()
                        );
                    }}
                >
                    Get Pitch
                </button>
                <p>{greetMsg}</p> */}
            </div>
            <div className="footer"></div>
        </main>
    );
}

export default App;
