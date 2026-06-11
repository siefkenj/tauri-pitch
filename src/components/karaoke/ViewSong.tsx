import {
    Button,
    Callout,
    HotkeyConfig,
    Navbar,
    NavbarDivider,
    NavbarGroup,
    NavbarHeading,
    NonIdealState,
    PopoverNext,
    ProgressBar,
    Slider,
    useHotkeys,
} from "@blueprintjs/core";
import { useAppDispatch, useAppSelector } from "../../state/hooks";
import {
    SongInfo,
    currentlyPlayingSelector,
    karaokeActions,
    songQueueSelector,
} from "../../state/redux-slices/karaoke";
import {
    hostingAddressSelector,
    httpsOnlyFeaturesDisabledSelector,
} from "../../state/redux-slices/core";
import { formatSongName } from "../../utils";
import React from "react";
import type { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import soundTouchProcessorUrl from "@soundtouchjs/audio-worklet/processor?url";

export function ViewSong() {
    const dispatch = useAppDispatch();
    const hostingAddress = useAppSelector(hostingAddressSelector);
    const httpsOnlyFeaturesDisabled = useAppSelector(
        httpsOnlyFeaturesDisabledSelector,
    );
    const currentlyPlaying = useAppSelector(currentlyPlayingSelector);
    const songQueue = useAppSelector(songQueueSelector);
    const nextSong: SongInfo | undefined = songQueue[0];
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const [playbackRate, _setPlaybackRate] = React.useState(1);
    const [pitchSemitones, _setPitchSemitones] = React.useState(0);
    const [playbackProgress, setPlaybackProgress] = React.useState({
        percent: 0,
        remainingTime: 0,
    });
    const [audioSetupStatus, setAudioSetupStatus] = React.useState<
        "idle" | "setting-up" | "ready" | "failed" | "unsupported"
    >("idle");
    const audioContextRef = React.useRef<AudioContext | null>(null);
    const sourceNodeRef = React.useRef<MediaElementAudioSourceNode | null>(
        null,
    );
    const soundTouchNodeRef = React.useRef<SoundTouchNode | null>(null);
    const audioSetupDoneRef = React.useRef(false);

    const incrementPlaybackRate = React.useCallback(
        ({ inc, value }: { inc?: number; value?: number }) => {
            if (videoRef.current) {
                let speed = videoRef.current.playbackRate;
                if (inc != null) {
                    speed += inc;
                }
                if (value != null) {
                    speed = value;
                }
                if (speed < 0.1) {
                    speed = 0.1; // Prevent negative or zero playback speed
                }
                videoRef.current.playbackRate = speed;
                _setPlaybackRate(speed);
            }
        },
        [],
    );

    const adjustPitch = React.useCallback(
        ({ inc, value }: { inc?: number; value?: number }) => {
            _setPitchSemitones((prev) => {
                let semitones = prev;
                if (inc != null) {
                    semitones += inc;
                }
                if (value != null) {
                    semitones = value;
                }
                semitones = Math.round(semitones);
                if (soundTouchNodeRef.current) {
                    soundTouchNodeRef.current.pitchSemitones.value = semitones;
                }
                return semitones;
            });
        },
        [],
    );

    const setupAudio = React.useCallback(async (el: HTMLVideoElement) => {
        if (audioSetupDoneRef.current) {
            return;
        }
        audioSetupDoneRef.current = true;
        setAudioSetupStatus("setting-up");

        if (typeof AudioWorkletNode === "undefined") {
            setAudioSetupStatus("unsupported");
            return;
        }

        try {
            const { SoundTouchNode: SoundTouchNodeClass } =
                await import("@soundtouchjs/audio-worklet");
            const ctx = new AudioContext();
            audioContextRef.current = ctx;

            await SoundTouchNodeClass.register(ctx, soundTouchProcessorUrl);

            const source = ctx.createMediaElementSource(el);
            sourceNodeRef.current = source;

            const stNode = new SoundTouchNodeClass({ context: ctx });
            // Exhaustive seek for better pitch-shift accuracy (more CPU, worth it).
            stNode.setStretchParameters({ quickSeek: false });
            // Max kernel width for highest-quality interpolation (default is 4).
            stNode.setInterpolationStrategyParams({ zeroCrossings: 8 });
            soundTouchNodeRef.current = stNode;

            source.connect(stNode);
            stNode.connect(ctx.destination);
            setAudioSetupStatus("ready");
        } catch (err) {
            console.error("[SoundTouch] Setup failed:", err);
            audioSetupDoneRef.current = false;
            setAudioSetupStatus("failed");
        }
    }, []);

    const videoCallbackRef = React.useCallback(
        (el: HTMLVideoElement | null) => {
            videoRef.current = el;
            if (el) {
                setupAudio(el);
            }
        },
        [setupAudio],
    );

    // Fallback: if the callback ref misfired, run setup when currentlyPlaying
    // becomes non-null and the video element is already in the DOM.
    React.useEffect(() => {
        if (videoRef.current) {
            setupAudio(videoRef.current);
        }
    }, [currentlyPlaying, setupAudio]);

    // Reset speed and pitch each time a new song starts.
    React.useEffect(() => {
        if (!currentlyPlaying) {
            return;
        }
        incrementPlaybackRate({ value: 1 });
        adjustPitch({ value: 0 });
    }, [currentlyPlaying, incrementPlaybackRate, adjustPitch]);

    // // Setup audio context and source node when video element is available
    // React.useEffect(() => {
    //     if (videoRef.current) {
    //         if (!audioContextRef.current) {
    //             audioContextRef.current = new (window.AudioContext )();
    //         }
    //         // Disconnect previous source node if any
    //         if (sourceNodeRef.current) {
    //             sourceNodeRef.current.disconnect();
    //         }
    //         sourceNodeRef.current =
    //             audioContextRef.current.createMediaElementSource(
    //                 videoRef.current
    //             );
    //         sourceNodeRef.current.connect(audioContextRef.current.destination);
    //     }
    //     // Cleanup on unmount
    //     return () => {
    //     };
    // }, [currentlyPlaying]);

    const hotkeys: HotkeyConfig[] = React.useMemo(() => {
        return [
            {
                combo: "space",
                global: true,
                label: "Play/Pause",
                onKeyDown: (e) => {
                    if (!videoRef.current) {
                        return;
                    }
                    e.preventDefault();
                    if (videoRef.current.paused) {
                        videoRef.current.play();
                    } else {
                        videoRef.current.pause();
                    }
                },
            },
            {
                combo: "p",
                global: true,
                label: "Play/Pause",
                onKeyDown: (e) => {
                    if (!videoRef.current) {
                        return;
                    }
                    e.preventDefault();
                    if (videoRef.current.paused) {
                        videoRef.current.play();
                    } else {
                        videoRef.current.pause();
                    }
                },
            },
            {
                combo: "m",
                global: true,
                label: "Toggle Mute",
                onKeyDown: (e) => {
                    if (!videoRef.current) {
                        return;
                    }
                    e.preventDefault();
                    videoRef.current.muted = !videoRef.current.muted;
                },
            },
            {
                combo: "right",
                global: true,
                label: "Seek Forward 2 Seconds",
                onKeyDown: (e) => {
                    if (!videoRef.current) {
                        return;
                    }
                    e.preventDefault();
                    videoRef.current.currentTime += 2;
                },
            },
            {
                combo: "left",
                global: true,
                label: "Seek Backward 2 Seconds",
                onKeyDown: (e) => {
                    if (!videoRef.current) {
                        return;
                    }
                    e.preventDefault();
                    videoRef.current.currentTime -= 2;
                },
            },
            {
                combo: "j",
                global: true,
                label: "Seek Backward 10 Seconds",
                onKeyDown: (e) => {
                    if (!videoRef.current) {
                        return;
                    }
                    e.preventDefault();
                    videoRef.current.currentTime -= 10;
                },
            },
            {
                combo: "l",
                global: true,
                label: "Seek Forward 10 Seconds",
                onKeyDown: (e) => {
                    if (!videoRef.current) {
                        return;
                    }
                    e.preventDefault();
                    videoRef.current.currentTime += 10;
                },
            },
            {
                combo: "n",
                global: true,
                label: "Skip to Next Song",
                onKeyDown: (e) => {
                    e.preventDefault();
                    dispatch(karaokeActions.setTopOfQueueAsNextSong());
                },
            },
            {
                combo: "f",
                global: true,
                label: "Toggle Fullscreen",
                onKeyDown: (e) => {
                    if (videoRef.current) {
                        e.preventDefault();
                        if (document.fullscreenElement) {
                            document.exitFullscreen();
                        } else {
                            videoRef.current.requestFullscreen();
                        }
                    }
                },
            },
            {
                combo: ">",
                global: true,
                label: "Increase Playback Speed",
                onKeyDown: (e) => {
                    if (!videoRef.current) {
                        return;
                    }
                    e.preventDefault();
                    incrementPlaybackRate({ inc: 0.1 });
                },
            },
            {
                combo: "<",
                global: true,
                label: "Decrease Playback Speed",
                onKeyDown: (e) => {
                    if (!videoRef.current) {
                        return;
                    }
                    e.preventDefault();
                    incrementPlaybackRate({ inc: -0.1 });
                },
            },
        ];
    }, [incrementPlaybackRate]);
    const { handleKeyDown, handleKeyUp } = useHotkeys(hotkeys);

    // Update playback progress periodically
    React.useEffect(() => {
        const interval = setInterval(() => {
            if (videoRef.current) {
                const percent =
                    videoRef.current.currentTime / videoRef.current.duration;
                const remainingTime =
                    videoRef.current.duration - videoRef.current.currentTime;
                setPlaybackProgress({ percent, remainingTime });
            }
        }, 200); // Update every 500ms
        return () => clearInterval(interval);
    }, []);

    return (
        <div
            className="karaoke-view"
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
        >
            <div className="karaoke-video">
                {currentlyPlaying ? (
                    <>
                        <video
                            ref={videoCallbackRef}
                            src={`${hostingAddress}/videos/${currentlyPlaying?.key}`}
                            onKeyDown={handleKeyDown}
                            onKeyUp={handleKeyUp}
                            onPlay={() => {
                                // Resume AudioContext if suspended due to browser autoplay policy
                                audioContextRef.current?.resume();
                            }}
                            controls
                            autoPlay
                            disablePictureInPicture
                        />
                    </>
                ) : (
                    <NonIdealState
                        icon="pause"
                        title="No song currently playing"
                        description="Please select a song from the playlist."
                        action={
                            nextSong && (
                                <Button
                                    icon="play"
                                    text="Play Next Song in Queue"
                                    onClick={() => {
                                        dispatch(
                                            karaokeActions.setTopOfQueueAsNextSong(),
                                        );
                                    }}
                                />
                            )
                        }
                    />
                )}
            </div>
            <div>
                <ProgressBar
                    animate={false}
                    stripes={false}
                    intent="primary"
                    value={playbackProgress.percent}
                    onMouseUp={(e) => {
                        // Find the percentage clicked in the progress bar
                        const rect = e.currentTarget.getBoundingClientRect();
                        const offsetX = e.clientX - rect.left;
                        const percent = offsetX / rect.width;
                        console.log("Clicked at percent:", percent);
                        if (videoRef.current) {
                            videoRef.current.currentTime =
                                videoRef.current.duration * percent;
                        }
                    }}
                    onClick={(e) => {
                        // Find the percentage clicked in the progress bar
                        const rect = e.currentTarget.getBoundingClientRect();
                        const offsetX = e.clientX - rect.left;
                        const percent = offsetX / rect.width;
                        console.log("Clicked at percent:", percent);
                        if (videoRef.current) {
                            videoRef.current.currentTime =
                                videoRef.current.duration * percent;
                        }
                    }}
                />
            </div>
            <Navbar className="view-song-bottom-nav">
                <NavbarGroup>
                    {currentlyPlaying && (
                        <>
                            <NavbarHeading>
                                Playing:{" "}
                                <b>{formatSongName(currentlyPlaying)}</b>
                            </NavbarHeading>
                            <NavbarDivider />
                        </>
                    )}
                    {nextSong ? (
                        <>
                            <NavbarHeading>
                                <span className="subdued">Next:</span>{" "}
                                {nextSong.artist && nextSong.artist + " - "}
                                {nextSong.title}
                            </NavbarHeading>
                            <NavbarDivider />
                            {songQueue.length > 1 && (
                                <span className="subdued queue-count">
                                    {" "}
                                    ({songQueue.length} Queued)
                                </span>
                            )}
                            <NavbarDivider />
                            <Button
                                icon="arrow-right"
                                onClick={() => {
                                    dispatch(
                                        karaokeActions.setTopOfQueueAsNextSong(),
                                    );
                                }}
                                onKeyDown={(e) => {
                                    // If the space was pressed, do nothing
                                    if (e.key === " ") {
                                        console.log(
                                            "Space key pressed, ignoring to prevent conflicts with global hotkeys",
                                        );
                                        e.stopPropagation();
                                        e.preventDefault();
                                        // XXX: Fix types
                                        // @ts-ignore
                                        e.target?.blur();
                                    }
                                }}
                            >
                                Skip to Next Song
                            </Button>
                        </>
                    ) : (
                        <>
                            No Next Song <NavbarDivider />
                            <Button
                                icon="random"
                                text="Play Random Song"
                                onClick={() => {
                                    dispatch(karaokeActions.playRandomSong());
                                }}
                                onKeyDown={(e) => {
                                    // If the space was pressed, do nothing
                                    if (e.key === " ") {
                                        console.log(
                                            "Space key pressed, ignoring to prevent conflicts with global hotkeys",
                                        );
                                        e.stopPropagation();
                                        e.preventDefault();
                                        // XXX: Fix types
                                        // @ts-ignore
                                        e.target?.blur();
                                    }
                                }}
                            />
                        </>
                    )}
                    <NavbarGroup
                        align="right"
                        className="speed-and-pitch-buttons"
                    >
                        <PopoverNext
                            placement="top"
                            onOpened={(node) => {
                                node.querySelector<HTMLElement>(
                                    "[role=slider]",
                                )?.focus();
                            }}
                            content={
                                <div className="slider-popover-content">
                                    <Slider
                                        vertical
                                        min={0.1}
                                        max={2.0}
                                        stepSize={0.1}
                                        value={playbackRate}
                                        initialValue={1}
                                        onChange={(v) =>
                                            incrementPlaybackRate({ value: v })
                                        }
                                        labelStepSize={0.5}
                                        labelRenderer={(v, opts) =>
                                            opts?.isHandleTooltip
                                                ? (null as any)
                                                : `${v.toFixed(1)}×`
                                        }
                                        disabled={!currentlyPlaying}
                                    />
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        disabled={!currentlyPlaying}
                                        onClick={() =>
                                            incrementPlaybackRate({ value: 1 })
                                        }
                                    >
                                        Reset
                                    </Button>
                                </div>
                            }
                        >
                            <Button
                                variant="minimal"
                                icon="fast-forward"
                                className="speed-button"
                                title="Adjust Playback Speed"
                            >
                                {playbackRate.toFixed(1)}×
                            </Button>
                        </PopoverNext>
                        <PopoverNext
                            placement="top"
                            onOpened={(node) => {
                                node.querySelector<HTMLElement>(
                                    "[role=slider]",
                                )?.focus();
                            }}
                            content={
                                <div className="slider-popover-content">
                                    {httpsOnlyFeaturesDisabled ? (
                                        <Callout
                                            intent="warning"
                                            style={{ maxWidth: 260 }}
                                        >
                                            {httpsOnlyFeaturesDisabled}
                                        </Callout>
                                    ) : (
                                        <>
                                            <Slider
                                                vertical
                                                min={-6}
                                                max={6}
                                                stepSize={1}
                                                value={pitchSemitones}
                                                onChange={(v) =>
                                                    adjustPitch({ value: v })
                                                }
                                                labelStepSize={3}
                                                labelRenderer={(v, opts) =>
                                                    opts?.isHandleTooltip
                                                        ? (null as any)
                                                        : `${v > 0 ? "+" : ""}${v} st`
                                                }
                                                disabled={
                                                    audioSetupStatus !== "ready"
                                                }
                                            />
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                disabled={
                                                    audioSetupStatus !== "ready"
                                                }
                                                onClick={() =>
                                                    adjustPitch({ value: 0 })
                                                }
                                            >
                                                Reset
                                            </Button>
                                        </>
                                    )}
                                </div>
                            }
                        >
                            <Button
                                variant="minimal"
                                endIcon={
                                    pitchSemitones > 0
                                        ? "caret-up"
                                        : pitchSemitones < 0
                                          ? "caret-down"
                                          : "double-caret-vertical"
                                }
                                title="Adjust Pitch"
                                // disabled={audioSetupStatus === "unsupported"}
                            >
                                <span className="pitch-symbol">
                                    {pitchSemitones >= 0 ? "♯" : "♭"}
                                    {pitchSemitones > 0 || pitchSemitones < 0
                                        ? Math.abs(pitchSemitones)
                                        : ""}
                                </span>
                                {/* Key:{" "}
                            {audioSetupStatus === "ready" ? (
                                <>
                                    {pitchSemitones > 0 ? "+" : ""}
                                    {pitchSemitones} st
                                </>
                            ) : audioSetupStatus === "setting-up" ? (
                                "…"
                            ) : audioSetupStatus === "unsupported" ? (
                                "N/A"
                            ) : audioSetupStatus === "failed" ? (
                                "err"
                            ) : (
                                "0 st"
                            )} */}
                            </Button>
                        </PopoverNext>
                    </NavbarGroup>
                </NavbarGroup>
            </Navbar>
        </div>
    );
}
