import { database } from '../services/database';

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
