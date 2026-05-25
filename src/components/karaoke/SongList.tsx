import {
    Button,
    ButtonGroup,
    Callout,
    Card,
    CardList,
    Dialog,
    DialogBody,
    DialogFooter,
    InputGroup,
    MenuItem,
    Navbar,
    NavbarGroup,
    OverlayToaster,
    Section,
    SectionCard,
    Spinner,
    Toast,
    ToastOptions,
} from "@blueprintjs/core";
import { ItemPredicate, ItemRenderer, Select } from "@blueprintjs/select";
import { useAppDispatch, useAppSelector } from "../../state/hooks";
import {
    SongInfo,
    allSongsSelector,
    karaokeActions,
    songQueueSelector,
} from "../../state/redux-slices/karaoke";
import { formatSongName, getYoutubeIdFromUrl } from "../../utils";
import classNames from "classnames";
import React from "react";

const filterSong: ItemPredicate<SongInfo> = (
    query,
    song,
    _index,
    exactMatch,
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
    { handleClick, handleFocus, modifiers, query },
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

export function SongList() {
    const allSongs = [...useAppSelector(allSongsSelector)];
    allSongs.sort((a, b) => formatSongName(a).localeCompare(formatSongName(b)));
    const songQueue = useAppSelector(songQueueSelector);
    const dispatch = useAppDispatch();
    const [youtubeDialogOpen, setYoutubeDialogOpen] = React.useState(false);
    const [toasts, setToasts] = React.useState<ToastOptions[]>([]);
    const currentlyPlaying = useAppSelector(
        (state) => state.karaoke.currentlyPlaying,
    );

    const queueSong = React.useCallback(async (song: SongInfo) => {
        const resp = await dispatch(karaokeActions.addToQueue(song));
        if ("error" in resp && resp.error.message === "DUPLICATE_SONG") {
            setToasts((prev) => [
                ...prev,
                {
                    key: `add-to-queue-${song.key}-${Date.now()}`,
                    message: `"${formatSongName(
                        song,
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
                                    prev.filter((t) => t.key !== key),
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
                autoFocus={true}
                enforceFocus={true}
                canEscapeKeyClose={true}
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
                        popoverProps={{
                            minimal: true,
                            position: "bottom-left",
                        }}
                        menuProps={{
                            className: classNames("karaoke-song-select-popup", {
                                compact: !!currentlyPlaying,
                            }),
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
                                    (s) => s.key === song.key,
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
                                                    },
                                                )}
                                                disabled={inQueue}
                                                icon={inQueue ? null : "plus"}
                                                title={
                                                    inQueue
                                                        ? "Song is queued"
                                                        : "Add to Queue"
                                                }
                                                text={
                                                    inQueue ? (
                                                        <>
                                                            {`#${queuePosition + 1}`}
                                                            <span className="descriptive-text">
                                                                {" "}
                                                                in Queue
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="descriptive-text">
                                                            Add to Queue
                                                        </span>
                                                    )
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

/**
 * Content of the dialog that allows you to download a song from YouTube.
 */
export function DownloadFromYoutubeDialog({
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
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (inputRef.current) {
            // Focus the input field when the dialog opens
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, []);

    const downloadSong = React.useCallback(async () => {
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
                }),
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
                setToasts((prev) => [...prev, ...toasts]);
            }
        } catch (error) {
            console.error("Error downloading song:", error);
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
    }, [youtubeId]);

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
                                        prev.filter((t) => t.key !== key),
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
                    tabIndex={0}
                    value={youtubeUrl}
                    inputRef={inputRef}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && canDownload) {
                            downloadSong();
                        }
                    }}
                />
                {callout}
            </DialogBody>
            <DialogFooter
                actions={
                    <>
                        <Button
                            disabled={!canDownload || downloadingState !== null}
                            intent="none"
                            onClick={downloadSong}
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
                                        }),
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
                                        }),
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
                                        error,
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
