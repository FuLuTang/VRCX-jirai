import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getLastBioChangeForUser: vi.fn(),
    addBioToDatabase: vi.fn()
}));

vi.mock('../../services/database', () => ({
    database: {
        getLastBioChangeForUser: mocks.getLastBioChangeForUser,
        addBioToDatabase: mocks.addBioToDatabase
    }
}));

import {
    createBioChangeFeed,
    getBioObservation,
    recordBioObservation
} from '../bioHistoryCoordinator';

describe('Bio observations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getLastBioChangeForUser.mockResolvedValue({ bio: 'known bio' });
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
