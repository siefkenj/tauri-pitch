import {
    Button,
    ButtonGroup,
    Callout,
    Card,
    CardList,
    Dialog,
    DialogBody,
    DialogFooter,
    FileInput,
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
import {
    formatSongName,
    getYoutubeIdFromUrl,
    parseUploadFilename,
} from "../../utils";
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
                    key={String(youtubeDialogOpen)}
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

function checkCanPlay(file: File): Promise<boolean> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement("video");
        const cleanup = () => URL.revokeObjectURL(url);
        video.addEventListener(
            "canplay",
            () => {
                cleanup();
                resolve(true);
            },
            { once: true },
        );
        video.addEventListener(
            "error",
            () => {
                cleanup();
                resolve(false);
            },
            { once: true },
        );
        video.src = url;
    });
}

/**
 * Content of the dialog that allows you to download a song from YouTube or
 * upload a local video file.
 */
export function DownloadFromYoutubeDialog({
    onClose,
}: {
    onClose?: (messages: ToastOptions[]) => void;
}) {
    const [uploadType, setUploadType] = React.useState<"youtube" | "file">(
        "youtube",
    );
    const [youtubeUrl, setYoutubeUrl] = React.useState("");
    const [uploadFile, setUploadFile] = React.useState<File | null>(null);
    const [canPlay, setCanPlay] = React.useState<boolean | null>(null);
    // Whether we should show a throbber on the add button, add and queue, or nothing.
    const [busy, setBusy] = React.useState<"only" | "andQueue" | null>(null);
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [toasts, setToasts] = React.useState<ToastOptions[]>([]);

    const availableSongs = useAppSelector(allSongsSelector);
    const dispatch = useAppDispatch();
    const inputRef = React.useRef<HTMLInputElement>(null);

    const youtubeId = getYoutubeIdFromUrl(youtubeUrl);
    const alreadyExists = availableSongs.some((s) => s.key === youtubeId);
    const canDownload = !!(youtubeId && !alreadyExists);
    const parsedUpload = uploadFile
        ? parseUploadFilename(uploadFile.name)
        : null;
    const canUpload = uploadFile !== null && canPlay === true;
    const canAct = uploadType === "youtube" ? canDownload : canUpload;

    React.useEffect(() => {
        if (inputRef.current) {
            // Focus the input field when the dialog opens
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, []);

    React.useEffect(() => {
        if (!uploadFile) {
            setCanPlay(null);
            return;
        }
        setCanPlay(null);
        let cancelled = false;
        checkCanPlay(uploadFile).then((result) => {
            if (!cancelled) {
                setCanPlay(result);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [uploadFile]);

    const finish = (newToasts: ToastOptions[]) => {
        if (onClose) {
            onClose(newToasts);
        } else {
            setToasts((p) => [...p, ...newToasts]);
        }
    };
    const pushError = (key: string, error: unknown) =>
        setToasts((p) => [
            ...p,
            { key, message: `${error}`, intent: "danger", icon: "error" },
        ]);

    const downloadVid = async ({
        queueAfterwards,
    }: {
        queueAfterwards: boolean;
    }) => {
        setBusy(queueAfterwards ? "andQueue" : "only");
        try {
            if (uploadType === "youtube") {
                if (!youtubeId) {
                    return;
                }
                const resp = await dispatch(
                    karaokeActions.downloadSong({
                        key: youtubeId,
                        title: "???",
                    }),
                );
                if ("error" in resp) {
                    throw new Error(resp.error.message);
                }
                if (queueAfterwards) {
                    // Add the song to the queue
                    await dispatch(
                        karaokeActions.addToQueue({
                            key: youtubeId,
                            title: `${resp.payload}`,
                        }),
                    );
                }
                const verb = queueAfterwards
                    ? "downloaded and queued"
                    : "downloaded";
                finish([
                    {
                        key: `download-${youtubeId}`,
                        message: `${resp.payload} successfully ${verb}!`,
                        intent: "success",
                        icon: "tick",
                    },
                ]);
            } else {
                if (!uploadFile || !parsedUpload) {
                    return;
                }
                const resp = await dispatch(
                    karaokeActions.uploadSong({ file: uploadFile }),
                );
                if ("error" in resp) {
                    throw new Error(resp.error.message);
                }
                const assignedKey = resp.payload as string;
                if (queueAfterwards) {
                    // Add the song to the queue
                    await dispatch(
                        karaokeActions.addToQueue({
                            key: assignedKey,
                            title: parsedUpload,
                        }),
                    );
                }
                finish([
                    {
                        key: `upload-${assignedKey}`,
                        message: `${parsedUpload} successfully uploaded!`,
                        intent: "success",
                        icon: "tick",
                    },
                ]);
            }
        } catch (error) {
            pushError(`action-error-${Date.now()}`, error);
        }
        setBusy(null);
    };

    let callout = null;
    if (uploadType === "youtube") {
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
                    <p>This song is already in the list of available songs.</p>
                </Callout>
            );
        } else if (!youtubeId && youtubeUrl) {
            callout = (
                <Callout intent="warning">
                    No YouTube video ID found. Copy-and-paste the whole URL from
                    the video you want to add.
                </Callout>
            );
        }
    } else {
        if (uploadFile && canPlay === false) {
            callout = (
                <Callout intent="danger">
                    This file cannot be played by your browser. Try a different
                    format (MP4 recommended).
                </Callout>
            );
        } else if (parsedUpload) {
            callout = (
                <Callout intent="primary">
                    <p>
                        Title: <b>{parsedUpload}</b>
                    </p>
                </Callout>
            );
        }
    }

    return (
        <>
            <DialogBody>
                <OverlayToaster>
                    {toasts.map(({ key, timeout = 10000, ...rest }) => (
                        <Toast
                            key={key}
                            timeout={timeout}
                            {...rest}
                            onDismiss={() =>
                                setToasts((p) => p.filter((t) => t.key !== key))
                            }
                        />
                    ))}
                </OverlayToaster>
                {uploadType === "youtube" ? (
                    <>
                        <p>
                            Copy and paste the URL from a YouTube video to add
                            it to the list of available songs.
                        </p>
                        <p>
                            <InputGroup
                                placeholder="YouTube URL"
                                leftIcon="page-layout"
                                tabIndex={0}
                                value={youtubeUrl}
                                inputRef={inputRef}
                                onChange={(e) => setYoutubeUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && canDownload) {
                                        downloadVid({ queueAfterwards: false });
                                    }
                                }}
                            />
                        </p>
                        {callout}
                        <p>
                            <Button
                                variant="minimal"
                                onClick={() => setUploadType("file")}
                            >
                                Click here to upload a file instead.
                            </Button>
                        </p>
                    </>
                ) : (
                    <>
                        <p>
                            Select a video file to upload. The file should be
                            titled:
                        </p>
                        <p style={{ textAlign: "center" }}>
                            <code>Artist - Song Title.mp4</code>{" "}
                        </p>
                        <p
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragOver(true);
                            }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragOver(false);
                                const file = e.dataTransfer.files[0];
                                if (file) {
                                    setUploadFile(file);
                                }
                            }}
                            style={
                                isDragOver
                                    ? {
                                          outline: "2px solid #4c90f0",
                                          borderRadius: 4,
                                      }
                                    : undefined
                            }
                        >
                            <FileInput
                                text={
                                    uploadFile
                                        ? uploadFile.name
                                        : "Choose file…"
                                }
                                fill
                                hasSelection={uploadFile !== null}
                                onInputChange={(e) =>
                                    setUploadFile(
                                        (e.target as HTMLInputElement)
                                            .files?.[0] ?? null,
                                    )
                                }
                                inputProps={{ accept: "video/*,audio/mp4" }}
                            />
                        </p>
                        {callout}
                        <p>
                            <Button
                                variant="minimal"
                                onClick={() => setUploadType("youtube")}
                            >
                                Click here to add a song from YouTube instead.
                            </Button>
                        </p>
                    </>
                )}
            </DialogBody>
            <DialogFooter
                actions={
                    <>
                        <Button
                            disabled={!canAct || busy !== null}
                            intent="none"
                            icon="add"
                            onClick={() =>
                                downloadVid({ queueAfterwards: false })
                            }
                            endIcon={busy === "only" && <Spinner size={20} />}
                        >
                            Add
                        </Button>
                        <Button
                            disabled={!canAct || busy !== null}
                            intent="primary"
                            icon="add"
                            onClick={() =>
                                downloadVid({ queueAfterwards: true })
                            }
                            endIcon={
                                busy === "andQueue" && (
                                    <Spinner size={20} intent="warning" />
                                )
                            }
                        >
                            Add and Queue
                        </Button>
                    </>
                }
            />
        </>
    );
}
