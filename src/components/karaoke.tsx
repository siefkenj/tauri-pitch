import {
    Button,
    ButtonGroup,
    Callout,
    Card,
    CardList,
    Dialog,
    DialogBody,
    DialogFooter,
    HotkeyConfig,
    InputGroup,
    Menu,
    MenuDivider,
    MenuItem,
    Navbar,
    NavbarDivider,
    NavbarGroup,
    NavbarHeading,
    NonIdealState,
    OverlayToaster,
    Section,
    SectionCard,
    Spinner,
    Tab,
    Tabs,
    Toast,
    ToastOptions,
    useHotkeys,
} from "@blueprintjs/core";
import { ItemPredicate, ItemRenderer, Select } from "@blueprintjs/select";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import {
    SongInfo,
    allSongsSelector,
    currentlyPlayingSelector,
    karaokeActions,
    songQueueSelector,
} from "../state/redux-slices/karaoke";
import { hostingAddressSelector } from "../state/redux-slices/core";
import { formatSongName, getYoutubeIdFromUrl } from "../utils";
import React from "react";
import classNames from "classnames";

export function Karaoke() {
    return (
        <>
            <Tabs defaultSelectedTabId={"view"} className="karaoke-tabs">
                <Tab id="view" panel={<ViewSong />} title="View" />
                <Tab id="playlist" panel={<Playlist />} title="Playlist" />
                <Tab id="songs" panel={<SongList />} title="Songs" />
            </Tabs>
        </>
    );
}
const filterSong: ItemPredicate<SongInfo> = (
    query,
    song,
    _index,
    exactMatch
) => {
    const normalizedTitle = formatSongName(song).toLowerCase();
    const normalizedQuery = query.toLowerCase();

    if (exactMatch) {
        return normalizedTitle === normalizedQuery;
    } else {
        // This was left over from the example. Maybe it can be used for a more advanced search...
        //return `${song.rank}. ${normalizedTitle} ${song.year}`.indexOf(normalizedQuery) >= 0;
        return `${normalizedTitle}`.indexOf(normalizedQuery) >= 0;
    }
};
const renderSong: ItemRenderer<SongInfo> = (
    song,
    { handleClick, handleFocus, modifiers, query }
) => {
    if (!modifiers.matchesPredicate) {
        return null;
    }
    return (
        <MenuItem
            active={modifiers.active}
            disabled={modifiers.disabled}
            key={song.key}
            label={song.duration?.toString()}
            onClick={handleClick}
            onFocus={handleFocus}
            roleStructure="listoption"
            text={formatSongName(song)}
        />
    );
};

function DownloadFromYoutubeDialog({
    onClose,
}: {
    onClose?: (messages: ToastOptions[]) => void;
}) {
    const [youtubeUrl, setYoutubeUrl] = React.useState("");
    // Whether we should show a throbber on the download button, download and queue, or nothing.
    const [downloadingState, setDownloadingState] = React.useState<
        "downloadOnly" | "downloadAndQueue" | null
    >(null);
    const availableSongs = useAppSelector(allSongsSelector);
    const dispatch = useAppDispatch();
    const [toasts, setToasts] = React.useState<ToastOptions[]>([]);

    const youtubeId = getYoutubeIdFromUrl(youtubeUrl);
    const alreadyExists = availableSongs.some((song) => song.key === youtubeId);
    const canDownload = youtubeId && !alreadyExists;

    let callout = null;
    if (youtubeId && !alreadyExists) {
        callout = (
            <Callout intent="primary">
                <p>
                    YouTube ID:{" "}
                    <b>
                        <code>{youtubeId}</code>
                    </b>
                </p>
                <p>This song can be downloaded.</p>
            </Callout>
        );
    } else if (youtubeId && alreadyExists) {
        callout = (
            <Callout intent="warning">
                <p>
                    YouTube ID:{" "}
                    <b>
                        <code>{youtubeId}</code>
                    </b>
                </p>
                <p>
                    This song is already in the list of available songs. You can
                    search for it in the list.
                </p>
            </Callout>
        );
    } else if (!youtubeId && youtubeUrl) {
        callout = (
            <Callout intent="warning">
                No YouTube video ID found. Copy-and-paste the whole URL from the
                video you want to add.
            </Callout>
        );
    }
    return (
        <>
            <DialogBody>
                <OverlayToaster>
                    {toasts.map((toast) => {
                        const {
                            key,
                            timeout: timeout = 10000,
                            ...rest
                        } = toast;
                        return (
                            <Toast
                                key={key}
                                timeout={timeout}
                                {...rest}
                                onDismiss={() => {
                                    setToasts((prev) =>
                                        prev.filter((t) => t.key !== key)
                                    );
                                }}
                            />
                        );
                    })}
                </OverlayToaster>
                <p>
                    Copy and paste the URL from a YouTube video to add it to the
                    list of available songs.
                </p>
                <InputGroup
                    placeholder="YouTube URL"
                    leftIcon="page-layout"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                />
                {callout}
            </DialogBody>
            <DialogFooter
                actions={
                    <>
                        <Button
                            disabled={!canDownload || downloadingState !== null}
                            intent="none"
                            onClick={async () => {
                                if (!youtubeId) {
                                    return;
                                }
                                setDownloadingState("downloadOnly");
                                try {
                                    console.log("Downloading song", youtubeId);
                                    const resp = await dispatch(
                                        karaokeActions.downloadSong({
                                            key: youtubeId,
                                            title: "???",
                                        })
                                    );
                                    if ("error" in resp) {
                                        throw new Error(resp.error.message);
                                    }
                                    const toasts: ToastOptions[] = [
                                        {
                                            key: `download-${youtubeId}`,
                                            message: `${resp.payload}\n successfully downloaded! (song id ${youtubeId})`,
                                            intent: "success",
                                            icon: "tick",
                                        },
                                    ];

                                    if (onClose) {
                                        onClose(toasts);
                                    } else {
                                        setToasts((prev) => [
                                            ...prev,
                                            ...toasts,
                                        ]);
                                    }
                                } catch (error) {
                                    console.error(
                                        "Error downloading song:",
                                        error
                                    );
                                    setToasts((prev) => [
                                        ...prev,
                                        {
                                            key: `download-${youtubeId}`,
                                            message: `${error}`,
                                            intent: "danger",
                                            icon: "error",
                                        },
                                    ]);
                                }
                                setDownloadingState(null);
                            }}
                            icon="download"
                            title="Download to Song Database"
                            endIcon={
                                downloadingState === "downloadOnly" && (
                                    <Spinner size={20} />
                                )
                            }
                        >
                            Download
                        </Button>
                        <Button
                            disabled={!canDownload || downloadingState !== null}
                            intent="primary"
                            onClick={async () => {
                                if (!youtubeId) {
                                    return;
                                }
                                setDownloadingState("downloadAndQueue");
                                try {
                                    console.log("Downloading song", youtubeId);
                                    const resp = await dispatch(
                                        karaokeActions.downloadSong({
                                            key: youtubeId,
                                            title: "???",
                                        })
                                    );
                                    if ("error" in resp) {
                                        throw new Error(resp.error.message);
                                    }
                                    const toasts: ToastOptions[] = [
                                        {
                                            key: `download-${youtubeId}`,
                                            message: `${resp.payload}\n successfully downloaded and queued! (song id ${youtubeId})`,
                                            intent: "success",
                                            icon: "tick",
                                        },
                                    ];
                                    // Add the song to the queue
                                    await dispatch(
                                        karaokeActions.addToQueue({
                                            key: youtubeId,
                                            title: "" + resp.payload,
                                        })
                                    );

                                    if (onClose) {
                                        onClose(toasts);
                                    } else {
                                        setToasts((prev) => [
                                            ...prev,
                                            ...toasts,
                                        ]);
                                    }
                                } catch (error) {
                                    console.error(
                                        "Error downloading song:",
                                        error
                                    );
                                    setToasts((prev) => [
                                        ...prev,
                                        {
                                            key: `download-${youtubeId}`,
                                            message: `${error}`,
                                            intent: "danger",
                                            icon: "error",
                                        },
                                    ]);
                                }
                                setDownloadingState(null);
                            }}
                            icon="add"
                            title="Download song to Database and add to Queue"
                            endIcon={
                                downloadingState === "downloadAndQueue" && (
                                    <Spinner size={20} intent="warning" />
                                )
                            }
                        >
                            Download and Queue
                        </Button>
                    </>
                }
            ></DialogFooter>
        </>
    );
}

function SongList() {
    const allSongs = [...useAppSelector(allSongsSelector)];
    allSongs.sort((a, b) => formatSongName(a).localeCompare(formatSongName(b)));
    const songQueue = useAppSelector(songQueueSelector);
    const dispatch = useAppDispatch();
    const [youtubeDialogOpen, setYoutubeDialogOpen] = React.useState(false);
    const [toasts, setToasts] = React.useState<ToastOptions[]>([]);

    const queueSong = React.useCallback(async (song: SongInfo) => {
        const resp = await dispatch(karaokeActions.addToQueue(song));
        if ("error" in resp && resp.error.message === "DUPLICATE_SONG") {
            setToasts((prev) => [
                ...prev,
                {
                    key: `add-to-queue-${song.key}-${Date.now()}`,
                    message: `"${formatSongName(
                        song
                    )}" is already in the queue.`,
                    intent: "warning",
                    icon: "warning-sign",
                },
            ]);
            return;
        }
        setToasts((prev) => [
            ...prev,
            {
                key: `add-to-queue-${song.key}-${Date.now()}`,
                message: `"${formatSongName(song)}" added to the queue.`,
                intent: "success",
                icon: "tick",
            },
        ]);
    }, []);

    return (
        <div className="karaoke-song-list">
            <OverlayToaster>
                {toasts.map((toast) => {
                    const { key, ...rest } = toast;
                    return (
                        <Toast
                            key={key}
                            {...rest}
                            onDismiss={() => {
                                setToasts((prev) =>
                                    prev.filter((t) => t.key !== key)
                                );
                            }}
                        />
                    );
                })}
            </OverlayToaster>
            <Dialog
                isOpen={youtubeDialogOpen}
                onClose={() => setYoutubeDialogOpen(false)}
                title="Add Song from YouTube"
                icon="video"
            >
                <DownloadFromYoutubeDialog
                    onClose={(messages) => {
                        if (messages && messages.length > 0) {
                            setToasts((prev) => [...prev, ...messages]);
                        }
                        setYoutubeDialogOpen(false);
                    }}
                />
            </Dialog>
            <Navbar className="karaoke-navbar">
                <NavbarGroup className="karaoke-navbar-group">
                    <Select
                        items={allSongs}
                        itemPredicate={filterSong}
                        itemRenderer={renderSong}
                        noResults={<MenuItem disabled text="No songs found." />}
                        onItemSelect={(song) => {
                            queueSong(song);
                        }}
                    >
                        <Button icon="search" variant="minimal">
                            Search
                        </Button>
                    </Select>
                    <Button
                        icon="video"
                        text="Add From Youtube"
                        variant="minimal"
                        onClick={() => {
                            setYoutubeDialogOpen(true);
                        }}
                    />
                </NavbarGroup>
            </Navbar>
            <Section title="All Songs" className="all-songs">
                <SectionCard padded={false}>
                    <CardList bordered={false} compact>
                        {allSongs.length > 0 ? (
                            allSongs.map((song, index) => {
                                // Figure out if the song is in the queue
                                const queuePosition = songQueue.findIndex(
                                    (s) => s.key === song.key
                                );
                                const inQueue = queuePosition >= 0;
                                return (
                                    <Card
                                        key={`${song.key}`}
                                        className={classNames({
                                            "in-queue": inQueue,
                                        })}
                                    >
                                        <ButtonGroup
                                            variant="minimal"
                                            className="left"
                                        >
                                            <Button
                                                className={classNames(
                                                    "queue-button",
                                                    {
                                                        "in-queue": inQueue,
                                                    }
                                                )}
                                                disabled={inQueue}
                                                icon={inQueue ? null : "plus"}
                                                title={
                                                    inQueue
                                                        ? "Song is queued"
                                                        : "Add to Queue"
                                                }
                                                text={
                                                    inQueue
                                                        ? `#${
                                                              queuePosition + 1
                                                          } in Queue`
                                                        : "Add to Queue"
                                                }
                                                onClick={() => queueSong(song)}
                                            />
                                        </ButtonGroup>
                                        {formatSongName(song)}
                                    </Card>
                                );
                            })
                        ) : (
                            <Callout intent="primary">
                                No songs available.
                            </Callout>
                        )}
                    </CardList>
                </SectionCard>
            </Section>
        </div>
    );
}

function ViewSong() {
    const dispatch = useAppDispatch();
    const hostingAddress = useAppSelector(hostingAddressSelector);
    const currentlyPlaying = useAppSelector(currentlyPlayingSelector);
    const songQueue = useAppSelector(songQueueSelector);
    const nextSong: SongInfo | undefined = songQueue[0];
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [playbackRate, _setPlaybackRate] = React.useState(1.0);
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
                            onClick={() =>
                                incrementPlaybackRate({ value: 1.0 })
                            }
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

function Playlist() {
    const currentlyPlaying = useAppSelector(currentlyPlayingSelector);
    const songQueue = useAppSelector(songQueueSelector);
    const dispatch = useAppDispatch();

    return (
        <div className="karaoke-playlist">
            <Section title="Playing">
                <SectionCard padded={false}>
                    <CardList bordered={false} compact>
                        {currentlyPlaying ? (
                            <Card>{formatSongName(currentlyPlaying)}</Card>
                        ) : (
                            <Callout intent="primary">
                                No song currently playing.
                            </Callout>
                        )}
                    </CardList>
                </SectionCard>
            </Section>
            <Section title="Up Next">
                <SectionCard padded={false}>
                    <CardList bordered={false} compact>
                        {songQueue.length > 0 ? (
                            songQueue.map((song, index) => (
                                <Card key={`${song.key}-${index}`}>
                                    {formatSongName(song)}
                                    <ButtonGroup
                                        variant="minimal"
                                        className="right"
                                    >
                                        <Button
                                            icon="chevron-up"
                                            onClick={() => {
                                                dispatch(
                                                    karaokeActions.promoteSong(
                                                        index
                                                    )
                                                );
                                            }}
                                        />
                                        <Button
                                            icon="chevron-down"
                                            onClick={() => {
                                                dispatch(
                                                    karaokeActions.demoteSong(
                                                        index
                                                    )
                                                );
                                            }}
                                        />
                                        <Button
                                            icon="cross"
                                            onClick={() => {
                                                dispatch(
                                                    karaokeActions.removeFromQueue(
                                                        index
                                                    )
                                                );
                                            }}
                                        />
                                    </ButtonGroup>
                                </Card>
                            ))
                        ) : (
                            <Callout intent="primary">
                                No songs in the queue.
                            </Callout>
                        )}
                    </CardList>
                </SectionCard>
            </Section>
        </div>
    );
}
