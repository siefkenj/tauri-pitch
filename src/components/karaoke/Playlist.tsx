import {
    Button,
    ButtonGroup,
    Callout,
    Card,
    CardList,
    Icon,
    Section,
    SectionCard,
} from "@blueprintjs/core";
import { useAppDispatch, useAppSelector } from "../../state/hooks";
import {
    currentlyPlayingSelector,
    karaokeActions,
    songQueueSelector,
} from "../../state/redux-slices/karaoke";
import { formatSongName } from "../../utils";
import React from "react";

export function Playlist() {
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
            <Section
                title="Up Next"
                rightElement={
                    <Button
                        variant="minimal"
                        icon={<Icon icon="random" />}
                        onClick={() => {
                            dispatch(karaokeActions.shuffleQueue());
                        }}
                    >
                        Shuffle
                    </Button>
                }
            >
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
                                                        index,
                                                    ),
                                                );
                                            }}
                                        />
                                        <Button
                                            icon="chevron-down"
                                            onClick={() => {
                                                dispatch(
                                                    karaokeActions.demoteSong(
                                                        index,
                                                    ),
                                                );
                                            }}
                                        />
                                        <Button
                                            icon="cross"
                                            onClick={() => {
                                                dispatch(
                                                    karaokeActions.removeFromQueue(
                                                        index,
                                                    ),
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
