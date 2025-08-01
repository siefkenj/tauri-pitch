import * as Comlink from "comlink";
import { createLoggingAsyncThunk } from "../../hooks";
import { _coreReducerActions, selfSelector } from "./slice";

import PitchWorker from "../../../worker?worker";
import { PitchWorker as PitchWorkerClass } from "../../../worker";

type PitchSetup = {
    analyser?: AnalyserNode;
    gainNode?: GainNode;
    audioContext: AudioContext;
    buffer: Float32Array;
};

/**
 * The worker instance. The app only uses one worker instance; it is reused for all processing.
 */
let worker: Comlink.Remote<PitchWorkerClass> | null = null;
let stream: MediaStream | null = null;
let activeTimeouts: ReturnType<typeof setInterval>[] = [];

export const coreThunks = {
    /**
     * Get an audio device and initiate audio processing.
     */
    initAudioDevice: createLoggingAsyncThunk(
        "core/initAudioDevice",
        async (_: void, { dispatch, getState }) => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, autoGainControl: true },
                });
                // If we made it this far, our user has granted us permission to use the microphone.
                // Grab the device name for this device.
                const audioTracks = stream.getAudioTracks();
                const deviceId = audioTracks[0]?.getSettings()?.deviceId;
                const devices = await navigator.mediaDevices.enumerateDevices();
                const deviceInfo = devices.find(
                    (d) => d.kind === "audioinput" && d.deviceId === deviceId
                );
                dispatch(
                    _coreReducerActions.setActiveAudioDevice(
                        deviceInfo?.label?.replace("Monitor of", "") || null
                    )
                );
            } catch (error) {
                console.error("Error accessing audio devices:", error);
                stream = null;
                dispatch(_coreReducerActions.setActiveAudioDevice(null));
                dispatch(_coreReducerActions._setInErrorState(true));
                throw error;
            }
        }
    ),

    /**
     * Create an instance of the DoenetCore webworker. No initialization is done.
     */
    initWorker: createLoggingAsyncThunk(
        "core/initWorker",
        async (_: void, { dispatch, getState }) => {
            if (!worker) {
                worker = Comlink.wrap(
                    new PitchWorker()
                ) as Comlink.Remote<PitchWorkerClass>;
            }
            await worker.init();
            // const {
            //     core: { pitchDetectionAlgorithm },
            // } = getState();

            // console.log("initWorker called", worker, pitchDetectionAlgorithm);
            //dispatch(_coreReducerActions._setWorkerCacheKey(key));
        }
    ),
    /**
     * Set the pitch detection algorithm in the worker.
     */
    setPitchDetectionAlgorithm: createLoggingAsyncThunk(
        "core/setPitchDetectionAlgorithm",
        async (
            algorithm: "autocorrelation" | "mcleod",
            { dispatch, getState }
        ) => {
            dispatch(
                _coreReducerActions._setPitchDetectionAlgorithm(algorithm)
            );
            if (worker) {
                const { windowSize } = selfSelector(getState());
                await worker.setDetector(
                    algorithm,
                    windowSize,
                    Math.round(windowSize / 2)
                );
            }
        }
    ),
    /**
     * Set the window size in the worker.
     */
    setWindowSize: createLoggingAsyncThunk(
        "core/setWindowSize",
        async (windowSize: number, { dispatch, getState }) => {
            dispatch(_coreReducerActions._setWindowSize(windowSize));
            if (worker) {
                const { pitchDetectionAlgorithm } = selfSelector(getState());
                await worker.setDetector(
                    pitchDetectionAlgorithm,
                    windowSize,
                    // Padding of half the window size. This was copied from the original code.
                    Math.round(windowSize / 2)
                );
            }
        }
    ),

    /*
     * Start collecting pitch data.
     */
    collectPitches: createLoggingAsyncThunk(
        "core/collectPitches",
        async (_: void, { dispatch, getState }) => {
            const { windowSize, clarityThreshold, powerThreshold } =
                selfSelector(getState());
            if (!worker) {
                throw new Error(
                    "Worker must be initialized before collecting pitches"
                );
            }
            if (!stream) {
                throw new Error(
                    "Audio stream must be initialized before collecting pitches"
                );
            }

            let pitchSetup: PitchSetup = {
                buffer: new Float32Array(windowSize),
                audioContext: new AudioContext(),
            };

            // Create an AudioNode from the stream.
            const mediaStreamSource =
                pitchSetup.audioContext.createMediaStreamSource(stream);

            // Connect it to the destination.
            pitchSetup.analyser = pitchSetup.audioContext.createAnalyser();
            pitchSetup.analyser.fftSize = windowSize;
            mediaStreamSource.connect(pitchSetup.analyser);

            async function updatePitch() {
                if (!worker) {
                    console.warn("Worker is not initialized");
                    return;
                }
                if (!pitchSetup.analyser) {
                    console.warn(
                        "Trying to update the pitch, but missing an analyser"
                    );
                    return;
                }
                const { analyser, buffer, audioContext } = pitchSetup;
                analyser.getFloatTimeDomainData(buffer);

                const res = await worker.getPitch(
                    buffer,
                    audioContext.sampleRate,
                    powerThreshold,
                    clarityThreshold
                );
                dispatch(
                    _coreReducerActions.setCurrentPitch({
                        pitch: res[0],
                        clarity: res[1],
                    })
                );
            }

            await updatePitch();

            const timeoutId = window.setInterval(updatePitch, 100);
            activeTimeouts.push(timeoutId);
        }
    ),
    /**
     * Stop collecting pitch data and clean up resources.
     */
    stopCollectingPitches: createLoggingAsyncThunk(
        "core/stopCollectingPitches",
        async (_: void, { dispatch }) => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
                stream = null;
            }
            activeTimeouts.forEach((timeoutId) => clearInterval(timeoutId));
            activeTimeouts.length = 0;
            // dispatch(
            //     _coreReducerActions.setCurrentPitch({ pitch: 0, clarity: 0 })
            // );
            dispatch(_coreReducerActions.setActiveAudioDevice(null));
        }
    ),
};
