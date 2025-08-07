import {
    Button,
    ButtonGroup,
    Menu,
    MenuDivider,
    MenuItem,
    Tab,
    Tabs,
} from "@blueprintjs/core";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import {
    currentlyPlayingSelector,
    karaokeActions,
    songQueueSelector,
} from "../state/redux-slices/karaoke";

export function Karaoke() {
    return (
        <>
            <Tabs defaultSelectedTabId={"playlist"} className="karaoke-tabs">
                <Tab
                    id="view"
                    panel={<div>Playing Karaoke</div>}
                    title="View"
                />
                <Tab id="playlist" panel={<Playlist />} title="Playlist" />
                <Tab id="settings" panel={<div>Submit</div>} title="Submit" />
            </Tabs>
        </>
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
