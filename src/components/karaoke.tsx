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
    Menu,
    MenuDivider,
    MenuItem,
    Navbar,
    NavbarDivider,
    NavbarGroup,
    NavbarHeading,
    NonIdealState,
    Section,
    SectionCard,
    Spinner,
    Tab,
    Tabs,
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

function DownloadFromYoutubeDialog() {
    const [youtubeUrl, setYoutubeUrl] = React.useState("");
    // Whether we should show a throbber on the download button, download and queue, or nothing.
    const [downloadingState, setDownloadingState] = React.useState<
        "downloadOnly" | "downloadAndQueue" | null
    >(null);
    const availableSongs = useAppSelector(allSongsSelector);
    const dispatch = useAppDispatch();

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
                            disabled={!canDownload}
                            intent="none"
                            onClick={async () => {
                                if (!youtubeId) {
                                    return;
                                }
                                setDownloadingState("downloadOnly");
                                try {
                                    console.log("Downloading song", youtubeId);
                                    await dispatch(
                                        karaokeActions.pushToDownloadQueue({
                                            key: youtubeId,
                                            title: "???",
                                        })
                                    );
                                    console.log("Waiting for song download", youtubeId);
                                    await dispatch(
                                        karaokeActions.waitForSongDownload({
                                            key: youtubeId,
                                            title: "???",
                                        })
                                    );
                                    console.log("Song download complete", youtubeId);
                                } catch (error) {
                                    console.error(
                                        "Error downloading song:",
                                        error
                                    );
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
                            disabled={!canDownload}
                            intent="primary"
                            onClick={() => {}}
                            icon="add"
                            title="Download song to Database and add to Queue"
                            endIcon={
                                downloadingState === "downloadAndQueue" && (
                                    <Spinner size={20} />
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
    const dispatch = useAppDispatch();
    const [youtubeDialogOpen, setYoutubeDialogOpen] = React.useState(false);

    return (
        <div className="karaoke-song-list">
            <Dialog
                isOpen={youtubeDialogOpen}
                onClose={() => setYoutubeDialogOpen(false)}
                title="Add Song from YouTube"
                icon="video"
            >
                <DownloadFromYoutubeDialog />
            </Dialog>
            <Navbar>
                <NavbarGroup className="karaoke-navbar-group">
                    <Select
                        items={allSongs}
                        itemPredicate={filterSong}
                        itemRenderer={renderSong}
                        noResults={<MenuItem disabled text="No songs found." />}
                        onItemSelect={(song) => {
                            //  dispatch(karaokeActions.addToQueue(song));
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
            <Section title="All Songs">
                <SectionCard padded={false}>
                    <CardList bordered={false} compact>
                        {allSongs.length > 0 ? (
                            allSongs.map((song, index) => (
                                <Card key={`${song.key}-${index}`}>
                                    {formatSongName(song)}
                                    <ButtonGroup
                                        variant="minimal"
                                        className="right"
                                    >
                                        <Button
                                            icon="plus"
                                            text="Add to Queue"
                                            onClick={() => {
                                                dispatch(
                                                    karaokeActions.addToQueue(
                                                        song
                                                    )
                                                );
                                            }}
                                        />
                                    </ButtonGroup>
                                </Card>
                            ))
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
    return (
        <div className="karaoke-view">
            <div className="karaoke-video">
                {currentlyPlaying ? (
                    <video
                        src={`${hostingAddress}/videos/${currentlyPlaying?.key}`}
                        controls
                        autoPlay
                    />
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
                    {nextSong ? (
                        <>
                            {currentlyPlaying && (
                                <>
                                    <NavbarHeading>
                                        Playing:{" "}
                                        <b>
                                            {formatSongName(currentlyPlaying)}
                                        </b>
                                    </NavbarHeading>
                                    <NavbarDivider />
                                </>
                            )}
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
                        "No Next Song"
                    )}
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
