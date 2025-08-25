import { Tab, Tabs } from "@blueprintjs/core";
import React from "react";
import { SongList } from "./SongList";
import { ViewSong } from "./ViewSong";
import { Playlist } from "./Playlist";

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
