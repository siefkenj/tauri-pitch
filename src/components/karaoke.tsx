import {
    Button,
    ButtonGroup,
    Callout,
    Menu,
    MenuDivider,
    MenuItem,
    Navbar,
    NavbarDivider,
    NavbarGroup,
    NavbarHeading,
    Tab,
    Tabs,
} from "@blueprintjs/core";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import {
    SongInfo,
    currentlyPlayingSelector,
    karaokeActions,
    songQueueSelector,
} from "../state/redux-slices/karaoke";

export function Karaoke() {
    return (
        <>
            <Tabs defaultSelectedTabId={"view"} className="karaoke-tabs">
                <Tab id="view" panel={<ViewSong />} title="View" />
                <Tab id="playlist" panel={<Playlist />} title="Playlist" />
                <Tab id="settings" panel={<div>Submit</div>} title="Submit" />
            </Tabs>
        </>
    );
}

function ViewSong() {
    const currentlyPlaying = useAppSelector(currentlyPlayingSelector);
    const songQueue = useAppSelector(songQueueSelector);
    const nextSong: SongInfo | undefined = songQueue[0];
    return (
        <div className="karaoke-view">
            <div className="karaoke-video">
                {currentlyPlaying || true ? (
                    <video
                        src={`http://localhost:8000/video/`}
                        controls
                        autoPlay
                    />
                ) : (
                    <div>No Video</div>
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
                                            {currentlyPlaying.artist} -{" "}
                                            {currentlyPlaying.title}
                                        </b>
                                    </NavbarHeading>
                                    <NavbarDivider />
                                </>
                            )}
                            <NavbarHeading>
                                Next: {nextSong.artist} - {nextSong.title}
                            </NavbarHeading>
                            <NavbarDivider />
                            <Button icon="arrow-right">
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
            <Menu size="large">
                <MenuDivider title="Currently Playing" />
                <MenuItem
                    text={
                        currentlyPlaying
                            ? `${currentlyPlaying.artist} - ${currentlyPlaying.title}`
                            : ""
                    }
                    labelElement={
                        currentlyPlaying ? "" : <span>No Song Playing</span>
                    }
                />
                <MenuDivider title="Up Next" />
                {songQueue.map((song, index) => (
                    <MenuItem
                        key={`${song.title}-${song.artist}-${index}`}
                        text={`${song.artist} - ${song.title}`}
                        labelElement={
                            <>
                                <Button
                                    variant="minimal"
                                    icon="chevron-up"
                                    onClick={async () => {
                                        dispatch(
                                            karaokeActions.promoteSong(index)
                                        );
                                    }}
                                />
                                <Button
                                    variant="minimal"
                                    icon="chevron-down"
                                    onClick={async () => {
                                        dispatch(
                                            karaokeActions.demoteSong(index)
                                        );
                                    }}
                                />
                                <Button
                                    variant="minimal"
                                    icon="cross"
                                    onClick={() => {
                                        dispatch(
                                            karaokeActions.removeFromQueue(
                                                index
                                            )
                                        );
                                    }}
                                />
                            </>
                        }
                    />
                ))}
            </Menu>
        </div>
    );
}
