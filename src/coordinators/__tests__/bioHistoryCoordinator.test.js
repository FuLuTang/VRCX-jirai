import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getLastBioChangeForUser: vi.fn(),
    addBioToDatabase: vi.fn(),
    getRecentBioClearChanges: vi.fn(),
    getBioClearChangesBefore: vi.fn(),
    deleteBioClearChangesBetween: vi.fn()
}));

vi.mock('../../services/database', () => ({
    database: {
        getLastBioChangeForUser: mocks.getLastBioChangeForUser,
        addBioToDatabase: mocks.addBioToDatabase,
        getRecentBioClearChanges: mocks.getRecentBioClearChanges,
        getBioClearChangesBefore: mocks.getBioClearChangesBefore,
        deleteBioClearChangesBetween: mocks.deleteBioClearChangesBetween
    }
}));

import {
    createBioChangeFeed,
    cleanupSuspiciousBioClearBurst,
    findSuspiciousBioClearBurst,
    getBioObservation,
    recordBioObservation
} from '../bioHistoryCoordinator';

describe('Bio observations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getLastBioChangeForUser.mockResolvedValue({ bio: 'known bio' });
        mocks.getRecentBioClearChanges.mockResolvedValue([]);
        mocks.getBioClearChangesBefore.mockResolvedValue([]);
        mocks.deleteBioClearChangesBetween.mockResolvedValue(0);
    });

    it.each([{}, { bio: null }, { bio: 12 }, { bio: false }])(
        'skips payloads without a string bio: %o',
        async (payload) => {
            expect(getBioObservation(payload)).toBeUndefined();
            await expect(
                recordBioObservation(payload, {
                    userId: 'usr_test',
                    displayName: 'Test',
                    createdAt: '2026-01-01T00:00:00.000Z'
                })
            ).resolves.toBe(false);
            expect(mocks.getLastBioChangeForUser).not.toHaveBeenCalled();
            expect(mocks.addBioToDatabase).not.toHaveBeenCalled();
        }
    );

    it('records an explicit empty string as a transition to cleared Bio', async () => {
        expect(getBioObservation({ bio: '' })).toBe('');
        await expect(
            recordBioObservation(
                { id: 'usr_test', bio: '' },
                {
                    userId: 'usr_test',
                    displayName: 'Test',
                    createdAt: '2026-01-01T00:00:00.000Z'
                }
            )
        ).resolves.toBe(true);
        expect(mocks.addBioToDatabase).toHaveBeenCalledWith({
            created_at: '2026-01-01T00:00:00.000Z',
            userId: 'usr_test',
            displayName: 'Test',
            bio: '',
            previousBio: 'known bio'
        });
    });

    it('does not duplicate the latest identical Bio observation', async () => {
        mocks.getLastBioChangeForUser.mockResolvedValue({ bio: 'known bio' });
        await expect(
            recordBioObservation(
                { bio: 'known bio' },
                {
                    userId: 'usr_test',
                    displayName: 'Test',
                    createdAt: '2026-01-01T00:00:00.000Z'
                }
            )
        ).resolves.toBe(false);
        expect(mocks.addBioToDatabase).not.toHaveBeenCalled();
    });
});

describe('friend Bio-change feeds', () => {
    const user = { id: 'usr_test', displayName: 'Test' };

    it('accepts an explicit transition to an empty string', () => {
        expect(createBioChangeFeed(user, ['', 'known bio'], 'now')).toEqual({
            created_at: 'now',
            type: 'Bio',
            userId: 'usr_test',
            displayName: 'Test',
            bio: '',
            previousBio: 'known bio'
        });
    });

    it.each([undefined, null, [null, 'known bio'], [42, 'known bio']])(
        'rejects a non-string/missing current Bio change: %o',
        (change) => {
            expect(createBioChangeFeed(user, change, 'now')).toBeNull();
        }
    );
});

describe('suspicious Bio-clear burst detection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getRecentBioClearChanges.mockResolvedValue([]);
        mocks.getBioClearChangesBefore.mockResolvedValue([]);
        mocks.deleteBioClearChangesBetween.mockResolvedValue(0);
    });

    const at = (minutes) =>
        new Date(Date.UTC(2026, 8, 18, 15, minutes, 0)).toISOString();

    it('requires three clear events within five minutes, regardless of user', () => {
        const burst = findSuspiciousBioClearBurst([
            { id: 3, userId: 'third', createdAt: at(4) },
            { id: 1, userId: 'first', createdAt: at(0) },
            { id: 2, userId: 'second', createdAt: at(2) }
        ]);

        expect(burst.rows).toHaveLength(3);
        expect(burst.start.createdAt).toBe(at(0));
        expect(burst.end.createdAt).toBe(at(4));
    });

    it('does not flag fewer than three events or a spread wider than five minutes', () => {
        expect(
            findSuspiciousBioClearBurst([
                { id: 1, createdAt: at(0) },
                { id: 2, createdAt: at(1) }
            ])
        ).toBeNull();
        expect(
            findSuspiciousBioClearBurst([
                { id: 1, createdAt: at(0) },
                { id: 2, createdAt: at(3) },
                { id: 3, createdAt: at(6) }
            ])
        ).toBeNull();
    });

    it('does not include an earlier isolated clear outside the burst gap', () => {
        const burst = findSuspiciousBioClearBurst([
            { id: 1, createdAt: at(0) },
            { id: 2, createdAt: at(7) },
            { id: 3, createdAt: at(8) },
            { id: 4, createdAt: at(9) }
        ]);

        expect(burst.rows.map((row) => row.id)).toEqual([2, 3, 4]);
    });

    it('extends a detected burst backward and deletes only its clear rows', async () => {
        mocks.getRecentBioClearChanges.mockResolvedValue([
            { id: 12, createdAt: at(12) },
            { id: 11, createdAt: at(11) },
            { id: 10, createdAt: at(10) }
        ]);
        mocks.getBioClearChangesBefore
            .mockResolvedValueOnce([
                { id: 9, createdAt: at(7) },
                { id: 8, createdAt: at(1) }
            ])
            .mockResolvedValueOnce([]);
        mocks.deleteBioClearChangesBetween.mockResolvedValue(4);

        await expect(cleanupSuspiciousBioClearBurst(30)).resolves.toEqual({
            deleted: 4,
            start: at(7),
            end: at(12)
        });
        expect(mocks.getRecentBioClearChanges).toHaveBeenCalledWith(30);
        expect(mocks.deleteBioClearChangesBetween).toHaveBeenCalledWith(
            at(7),
            at(12)
        );
    });

    it('does not query or delete when the user-derived scan limit is below three', async () => {
        await expect(cleanupSuspiciousBioClearBurst(0)).resolves.toBeNull();
        expect(mocks.getRecentBioClearChanges).not.toHaveBeenCalled();
        expect(mocks.deleteBioClearChangesBetween).not.toHaveBeenCalled();
    });

    it('does not delete when recent history has no suspicious burst', async () => {
        mocks.getRecentBioClearChanges.mockResolvedValue([
            { id: 2, createdAt: at(0) },
            { id: 1, createdAt: at(1) }
        ]);

        await expect(cleanupSuspiciousBioClearBurst(9)).resolves.toBeNull();
        expect(mocks.deleteBioClearChangesBetween).not.toHaveBeenCalled();
    });
});
