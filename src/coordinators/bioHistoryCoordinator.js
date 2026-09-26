import { database } from '../services/database';

const BIO_CLEAR_CLUSTER_WINDOW_MS = 5 * 60 * 1000;
const BIO_CLEAR_BACKFILL_PAGE_SIZE = 1000;

/**
 * Read a Bio only when the payload explicitly contains a string value.
 * Empty strings are valid observations; absent, null, and other values are not.
 * @param {object} payload
 * @returns {string | undefined}
 */
export function getBioObservation(payload) {
    if (
        !payload ||
        !Object.hasOwn(payload, 'bio') ||
        typeof payload.bio !== 'string'
    ) {
        return undefined;
    }
    return payload.bio;
}

/**
 * Record a Bio observation if the explicitly supplied value differs from the
 * latest saved value. Returns true only when a history row was queued.
 * @param {object} payload Raw/sanitized API payload containing bio.
 * @param {{userId: string, displayName: string, createdAt: string}} metadata
 * @returns {Promise<boolean>}
 */
export async function recordBioObservation(
    payload,
    { userId, displayName, createdAt }
) {
    const bio = getBioObservation(payload);
    if (bio === undefined) return false;

    const lastBio = await database.getLastBioChangeForUser(userId);
    if (lastBio && lastBio.bio === bio) return false;

    database.addBioToDatabase({
        created_at: createdAt,
        userId,
        displayName,
        bio,
        previousBio: typeof lastBio?.bio === 'string' ? lastBio.bio : ''
    });
    return true;
}

/**
 * Build a friend Bio-change feed only from a real string-to-string transition.
 * @param {object} ref
 * @param {unknown} change [newBio, previousBio]
 * @param {string} createdAt
 * @returns {object | null}
 */
export function createBioChangeFeed(ref, change, createdAt) {
    if (
        !Array.isArray(change) ||
        typeof change[0] !== 'string' ||
        typeof change[1] !== 'string' ||
        change[0] === change[1]
    ) {
        return null;
    }

    return {
        created_at: createdAt,
        type: 'Bio',
        userId: ref.id,
        displayName: ref.displayName,
        bio: change[0],
        previousBio: change[1]
    };
}

/**
 * Find the newest run of Bio-clear records containing at least three rows in
 * any five-minute window. User identity is intentionally ignored.
 * @param {Array<{id: number, createdAt: string}>} records
 * @param {number} [windowMs]
 * @returns {{rows: Array<object>, start: object, end: object} | null}
 */
export function findSuspiciousBioClearBurst(
    records,
    windowMs = BIO_CLEAR_CLUSTER_WINDOW_MS
) {
    const sorted = records
        .map((record) => ({ ...record, time: Date.parse(record.createdAt) }))
        .filter((record) => Number.isFinite(record.time))
        .sort((a, b) => a.time - b.time || a.id - b.id);

    for (let end = sorted.length - 1; end >= 2; end--) {
        let start = end;
        while (
            start > 0 &&
            sorted[end].time - sorted[start - 1].time <= windowMs
        ) {
            start--;
        }
        if (end - start + 1 < 3) continue;

        // Treat events separated by no more than the detection window as one
        // burst, including any matching rows newer than the triggering triple.
        let burstStart = start;
        let burstEnd = end;
        while (
            burstStart > 0 &&
            sorted[burstStart].time - sorted[burstStart - 1].time <= windowMs
        ) {
            burstStart--;
        }
        while (
            burstEnd < sorted.length - 1 &&
            sorted[burstEnd + 1].time - sorted[burstEnd].time <= windowMs
        ) {
            burstEnd++;
        }

        const rows = sorted.slice(burstStart, burstEnd + 1);
        return { rows, start: rows[0], end: rows.at(-1) };
    }

    return null;
}

/**
 * Remove a recent burst of suspicious Bio-clear history from the active
 * account's table. The caller supplies a scan limit based on tracked users.
 * @param {number} scanLimit
 * @returns {Promise<{deleted: number, start: string, end: string} | null>}
 */
export async function cleanupSuspiciousBioClearBurst(scanLimit) {
    if (!Number.isInteger(scanLimit) || scanLimit < 3) return null;

    const recent = await database.getRecentBioClearChanges(scanLimit);
    const burst = findSuspiciousBioClearBurst(recent);
    if (!burst) return null;

    let oldest = burst.start;
    let included = burst.rows.length;
    while (true) {
        const olderRecords = await database.getBioClearChangesBefore({
            createdAt: oldest.createdAt,
            id: oldest.id,
            limit: BIO_CLEAR_BACKFILL_PAGE_SIZE
        });
        if (olderRecords.length === 0) break;

        let reachedGap = false;
        for (const record of olderRecords) {
            const olderTime = Date.parse(record.createdAt);
            const newestIncludedTime = Date.parse(oldest.createdAt);
            if (
                !Number.isFinite(olderTime) ||
                newestIncludedTime - olderTime > BIO_CLEAR_CLUSTER_WINDOW_MS
            ) {
                reachedGap = true;
                break;
            }
            oldest = record;
            included++;
        }
        if (reachedGap || olderRecords.length < BIO_CLEAR_BACKFILL_PAGE_SIZE) {
            break;
        }
    }

    const deleted = await database.deleteBioClearChangesBetween(
        oldest.createdAt,
        burst.end.createdAt
    );
    return {
        deleted: Number.isFinite(Number(deleted)) ? Number(deleted) : included,
        start: oldest.createdAt,
        end: burst.end.createdAt
    };
}
