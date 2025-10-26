import {
    Button,
    HotkeyConfig,
    Navbar,
    NavbarDivider,
    NavbarGroup,
    NavbarHeading,
    NonIdealState,
    ProgressBar,
    useHotkeys,
} from "@blueprintjs/core";
import { useAppDispatch, useAppSelector } from "../../state/hooks";
import {
    SongInfo,
    currentlyPlayingSelector,
    karaokeActions,
    songQueueSelector,
} from "../../state/redux-slices/karaoke";
import { hostingAddressSelector } from "../../state/redux-slices/core";
import { formatSongName } from "../../utils";
import React from "react";

export function ViewSong() {
    const dispatch = useAppDispatch();
    const hostingAddress = useAppSelector(hostingAddressSelector);
    const currentlyPlaying = useAppSelector(currentlyPlayingSelector);
    const songQueue = useAppSelector(songQueueSelector);
    const nextSong: SongInfo | undefined = songQueue[0];
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [playbackRate, _setPlaybackRate] = React.useState(1);
    const [playbackProgress, setPlaybackProgress] = React.useState({
        percent: 0,
        remainingTime: 0,
    });
    const audioContextRef = React.useRef<AudioContext | null>(null);
    const sourceNodeRef = React.useRef<MediaElementAudioSourceNode | null>(
        null
    );
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
        []
    );

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
                            ref={videoRef}
                            src={`${hostingAddress}/videos/${currentlyPlaying?.key}`}
                            onKeyDown={handleKeyDown}
                            onKeyUp={handleKeyUp}
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
                                            karaokeActions.setTopOfQueueAsNextSong()
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
            <Navbar>
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
                            <Button
                                icon="arrow-right"
                                onClick={() => {
                                    dispatch(
                                        karaokeActions.setTopOfQueueAsNextSong()
                                    );
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
                            />
                        </>
                    )}
                    <div className="karaoke-playback-rate">
                        Speed
                        <Button
                            variant="minimal"
                            onClick={() => incrementPlaybackRate({ inc: -0.1 })}
                            icon="minus"
                        />
                        <Button
                            onClick={() => incrementPlaybackRate({ value: 1 })}
                        >
                            {playbackRate.toFixed(1)} ×
                        </Button>
                        <Button
                            variant="minimal"
                            onClick={() => incrementPlaybackRate({ inc: 0.1 })}
                            icon="plus"
                        />
                    </div>
                </NavbarGroup>
            </Navbar>
        </div>
    );
}
