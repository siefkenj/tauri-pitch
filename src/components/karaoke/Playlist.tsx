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
    SongInfo,
    currentlyPlayingSelector,
    karaokeActions,
    songQueueSelector,
} from "../../state/redux-slices/karaoke";
import { formatSongName } from "../../utils";
import React from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable, isSortableOperation } from "@dnd-kit/react/sortable";

function SortableQueueItem({
    song,
    index,
    onPromote,
    onDemote,
    onRemove,
}: {
    song: SongInfo;
    index: number;
    onPromote: () => void;
    onDemote: () => void;
    onRemove: () => void;
}) {
    const { ref, isDragging } = useSortable({
        id: song.key,
        index,
        transition: { duration: 200, easing: "ease", idle: true },
    });

    return (
        <Card
            ref={ref as React.Ref<HTMLDivElement>}
            style={{ opacity: isDragging ? 0.3 : 1, cursor: "grab" }}
        >
            <span
                style={{
                    marginRight: 4,
                    display: "inline-flex",
                    alignItems: "center",
                    color: "var(--bp-text-muted-color, #5c7080)",
                }}
            >
                <Icon icon="drag-handle-vertical" />
            </span>
            {formatSongName(song)}
            <ButtonGroup variant="minimal" className="right">
                <Button icon="chevron-up" onClick={onPromote} />
                <Button icon="chevron-down" onClick={onDemote} />
                <Button icon="cross" onClick={onRemove} />
            </ButtonGroup>
        </Card>
    );
}

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
                title={
                    <React.Fragment>
                        Up Next
                        {songQueue.length > 1 && (
                            <span className="subdued">
                                {" "}
                                ({songQueue.length} Queued)
                            </span>
                        )}
                    </React.Fragment>
                }
                rightElement={
                    <Button
                        variant="minimal"
                        icon={<Icon icon="random" />}
                        onClick={() => {
                            dispatch(karaokeActions.shuffleQueue());
                        }}
                        title="Shuffle the upcoming songs, but leave the next song unchanged"
                    >
                        Shuffle
                    </Button>
                }
            >
                <SectionCard padded={false}>
                    <DragDropProvider
                        onDragEnd={({ operation, canceled }) => {
                            if (canceled) {
                                return;
                            }
                            if (!isSortableOperation(operation)) {
                                return;
                            }
                            const { source, target } = operation;
                            if (!source || !target) {
                                return;
                            }
                            const fromIndex = source.initialIndex;
                            const toIndex = target.index;
                            if (fromIndex === toIndex) {
                                return;
                            }
                            dispatch(
                                karaokeActions.moveQueueItem({
                                    fromIndex,
                                    toIndex,
                                }),
                            );
                        }}
                    >
                        <CardList bordered={false} compact>
                            {songQueue.length > 0 ? (
                                songQueue.map((song, index) => (
                                    <SortableQueueItem
                                        key={song.key}
                                        song={song}
                                        index={index}
                                        onPromote={() =>
                                            dispatch(
                                                karaokeActions.promoteSong(
                                                    index,
                                                ),
                                            )
                                        }
                                        onDemote={() =>
                                            dispatch(
                                                karaokeActions.demoteSong(
                                                    index,
                                                ),
                                            )
                                        }
                                        onRemove={() =>
                                            dispatch(
                                                karaokeActions.removeFromQueue(
                                                    index,
                                                ),
                                            )
                                        }
                                    />
                                ))
                            ) : (
                                <Callout intent="primary">
                                    No songs in the queue.
                                </Callout>
                            )}
                        </CardList>
                    </DragDropProvider>
                </SectionCard>
            </Section>
        </div>
    );
}
