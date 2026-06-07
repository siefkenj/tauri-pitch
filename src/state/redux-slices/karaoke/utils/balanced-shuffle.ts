/**
 * Balanced shuffle based on the algorithm Spotify uses to make playlists feel random.
 *
 * Without a label function all items form one group and the result is a stratified
 * shuffle: each item is placed in its own equally-sized slot of [0, 1] with a random
 * offset inside that slot, then the slots are sorted.  This avoids the clustering that
 * plain Fisher-Yates can produce (same artist twice in a row, etc.).
 *
 * With a label function, items that share a label are treated as a group.  Each group
 * is independently shuffled and then given evenly-spaced virtual positions, so every
 * person's songs appear at a roughly equal cadence in the final list.
 *
 * The function always returns an order that differs from the input — it retries up to
 * 10 times and falls back to a rotation if every attempt happened to be identity (this
 * can only realistically occur with 2-element arrays where identity probability is 50%).
 *
 * Reference: https://engineering.atspotify.com/2014/02/how-to-shuffle-songs/
 */

function shuffleOnce<T>(items: T[], getLabel: (item: T) => string): T[] {
    const groups = new Map<string, T[]>();
    for (const item of items) {
        const label = getLabel(item);
        const group = groups.get(label);
        if (group) {
            group.push(item);
        } else {
            groups.set(label, [item]);
        }
    }

    const scored: { item: T; score: number }[] = [];
    for (const group of groups.values()) {
        // Fisher-Yates within each group so the intra-group order is random
        for (let i = group.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [group[i], group[j]] = [group[j], group[i]];
        }
        // Spread evenly across [0, 1] with random jitter inside each slot
        for (let i = 0; i < group.length; i++) {
            scored.push({
                item: group[i],
                score: (i + Math.random()) / group.length,
            });
        }
    }

    scored.sort((a, b) => a.score - b.score);
    return scored.map((s) => s.item);
}

export function balancedShuffle<T>(
    items: T[],
    getLabel: (item: T) => string = () => "_",
): T[] {
    if (items.length <= 1) {
        return [...items];
    }

    for (let attempt = 0; attempt < 10; attempt++) {
        const result = shuffleOnce(items, getLabel);
        if (!result.every((item, i) => item === items[i])) {
            return result;
        }
    }

    // Fallback: rotate by one position so there is always a visible change.
    // This path is only reachable for very short arrays (n=2 has 50% identity
    // per attempt, so hitting it 10 times in a row has probability < 0.1%).
    return [...items.slice(1), items[0]];
}
