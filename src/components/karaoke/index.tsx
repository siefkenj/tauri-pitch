import { Tab, TabId, TabPanel, Tabs } from "@blueprintjs/core";
import React from "react";
import { SongList } from "./SongList";
import { ViewSong } from "./ViewSong";
import { Playlist } from "./Playlist";
import { useAppSelector } from "../../state/hooks";
import classNames from "classnames";

export function Karaoke() {
    const TABS_PARENT_ID = React.useId();
    const [selectedTabId, setSelectedTabId] = React.useState<TabId>("view");
    const currentlyPlaying = useAppSelector(
        (state) => state.karaoke.currentlyPlaying,
    );

    const showSideBySide =
        currentlyPlaying && ["playlist", "songs"].includes("" + selectedTabId);

    return (
        <div className="karaoke-container">
            <Tabs
                defaultSelectedTabId={"view"}
                onChange={setSelectedTabId}
                selectedTabId={selectedTabId}
                className="karaoke-tabs"
            >
                <Tab
                    id="view"
                    // panel={<ViewSong />}
                    title="View"
                />
                <Tab
                    id="playlist"
                    // panel={<Playlist />}
                    title="Playlist"
                />
                <Tab
                    id="songs"
                    // panel={
                    //     <div className="side-by-side">
                    //         <ViewSong />
                    //         <SongList />
                    //     </div>
                    // }
                    title="Songs"
                />
            </Tabs>
            <TabPanel
                id={selectedTabId}
                selectedTabId={selectedTabId}
                parentId={TABS_PARENT_ID}
                className={classNames(
                    {
                        "side-by-side": showSideBySide,
                    },
                    "side-by-side-container",
                )}
                panel={
                    // We use a TabPanel because we want to allow a side-by-side view of the the playing song and the song list, if a song is playing.
                    <>
                        {showSideBySide || selectedTabId === "view" ? (
                            <ViewSong />
                        ) : null}
                        {selectedTabId === "songs" ? <SongList /> : null}
                        {selectedTabId === "playlist" ? <Playlist /> : null}
                    </>
                }
            />
        </div>
    );
}
