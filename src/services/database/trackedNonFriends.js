import { dbVars } from '../database';

import sqliteService from '../sqlite.js';

const trackedNonFriends = {
    async addTrackedNonFriend(userId, displayName) {
        if (!dbVars.userPrefix || !userId) return;
        await sqliteService.executeNonQuery(
            `INSERT OR IGNORE INTO ${dbVars.userPrefix}_tracked_nonfriends (user_id, display_name, added_at) VALUES (@userId, @displayName, @addedAt)`,
            {
                '@userId': userId,
                '@displayName': displayName || '',
                '@addedAt': new Date().toISOString()
            }
        );
    },

    async removeTrackedNonFriend(userId) {
        if (!dbVars.userPrefix || !userId) return;
        await sqliteService.executeNonQuery(
            `DELETE FROM ${dbVars.userPrefix}_tracked_nonfriends WHERE user_id = @userId`,
            { '@userId': userId }
        );
    },

    async getTrackedNonFriends() {
        const results = [];
        if (!dbVars.userPrefix) return results;
        await sqliteService.execute(
            (row) => {
                results.push({
                    userId: row[0],
                    displayName: row[1],
                    addedAt: row[2]
                });
            },
            `SELECT user_id, display_name, added_at FROM ${dbVars.userPrefix}_tracked_nonfriends ORDER BY added_at DESC`
        );
        return results;
    },

    async isTrackedNonFriend(userId) {
        if (!dbVars.userPrefix || !userId) return false;
        let found = false;
        await sqliteService.execute(
            () => {
                found = true;
            },
            `SELECT 1 FROM ${dbVars.userPrefix}_tracked_nonfriends WHERE user_id = @userId LIMIT 1`,
            { '@userId': userId }
        );
        return found;
    },

    async updateTrackedNonFriendDisplayName(userId, displayName) {
        if (!dbVars.userPrefix || !userId) return;
        await sqliteService.executeNonQuery(
            `UPDATE ${dbVars.userPrefix}_tracked_nonfriends SET display_name = @displayName WHERE user_id = @userId`,
            {
                '@userId': userId,
                '@displayName': displayName || ''
            }
        );
    }
};

export { trackedNonFriends };
