import { dbVars } from '../database';
import sqliteService from '../sqlite.js';

const manualRelations = {
    /**
     * Add a manual relation between two users.
     * @param {string} userIdA
     * @param {string} userIdB
     * @param {string} [relationType] e.g. 'friend'
     */
    async addManualRelation(userIdA, userIdB, relationType = 'friend') {
        if (!dbVars.userPrefix || !userIdA || !userIdB) return;
        // Normalize order so (A,B) and (B,A) are stored the same way
        const [id1, id2] = [userIdA, userIdB].sort();
        await sqliteService.executeNonQuery(
            `INSERT OR IGNORE INTO ${dbVars.userPrefix}_manual_relations_MANUEL (user_id_a, user_id_b, relation_type, added_at) VALUES (@idA, @idB, @type, @addedAt)`,
            {
                '@idA': id1,
                '@idB': id2,
                '@type': relationType,
                '@addedAt': new Date().toISOString()
            }
        );
    },

    /**
     * Remove a manual relation between two users.
     * @param {string} userIdA
     * @param {string} userIdB
     */
    async removeManualRelation(userIdA, userIdB) {
        if (!dbVars.userPrefix || !userIdA || !userIdB) return;
        const [id1, id2] = [userIdA, userIdB].sort();
        await sqliteService.executeNonQuery(
            `DELETE FROM ${dbVars.userPrefix}_manual_relations_MANUEL WHERE user_id_a = @idA AND user_id_b = @idB`,
            { '@idA': id1, '@idB': id2 }
        );
    },

    /**
     * Get all manual relations.
     */
    async getManualRelations() {
        const results = [];
        if (!dbVars.userPrefix) return results;
        await sqliteService.execute(
            (row) => {
                results.push({
                    userIdA: row[0],
                    userIdB: row[1],
                    relationType: row[2],
                    addedAt: row[3]
                });
            },
            `SELECT user_id_a, user_id_b, relation_type, added_at FROM ${dbVars.userPrefix}_manual_relations_MANUEL ORDER BY added_at DESC`
        );
        return results;
    },

    /**
     * Check if a manual relation exists between two users.
     * @param {string} userIdA
     * @param {string} userIdB
     */
    async isManualRelation(userIdA, userIdB) {
        if (!dbVars.userPrefix || !userIdA || !userIdB) return false;
        const [id1, id2] = [userIdA, userIdB].sort();
        let found = false;
        await sqliteService.execute(
            () => {
                found = true;
            },
            `SELECT 1 FROM ${dbVars.userPrefix}_manual_relations_MANUEL WHERE user_id_a = @idA AND user_id_b = @idB LIMIT 1`,
            { '@idA': id1, '@idB': id2 }
        );
        return found;
    },

    /**
     * Get all manual relations involving a specific user.
     * @param {string} userId
     */
    async getManualRelationsForUser(userId) {
        const results = [];
        if (!dbVars.userPrefix || !userId) return results;
        await sqliteService.execute(
            (row) => {
                results.push({
                    userIdA: row[0],
                    userIdB: row[1],
                    relationType: row[2],
                    addedAt: row[3]
                });
            },
            `SELECT user_id_a, user_id_b, relation_type, added_at FROM ${dbVars.userPrefix}_manual_relations_MANUEL WHERE user_id_a = @userId OR user_id_b = @userId ORDER BY added_at DESC`,
            { '@userId': userId }
        );
        return results;
    },

    /**
     * Get bulk data for recommendation algorithm
     */
    async getCandidateCoInstances(myUserId) {
        const eventsByLocation = new Map();
        const mySessions = new Map();

        // 1. Get my sessions
        await sqliteService.execute((row) => {
             const loc = row[0];
             if (!mySessions.has(loc)) mySessions.set(loc, []);
             mySessions.get(loc).push({ leaveAt: new Date(row[1]).getTime(), time: row[2] });
        }, `SELECT location, created_at, time FROM gamelog_join_leave WHERE type = 'OnPlayerLeft' AND user_id = @myId AND time > 0 AND location NOT IN ('', 'traveling')`, { '@myId': myUserId });

        // 2. Get everybody else's (local gamelog AND API feed tracking)
        const sessionsQuery = `
            SELECT location, user_id, created_at, time 
            FROM gamelog_join_leave 
            WHERE type = 'OnPlayerLeft' AND user_id != @myId AND user_id != '' AND time > 0 AND location NOT IN ('', 'offline', 'traveling', 'private', 'private:private')
            UNION ALL
            SELECT previous_location AS location, user_id, created_at, time 
            FROM ${dbVars.userPrefix}_feed_gps 
            WHERE previous_location NOT IN ('', 'offline', 'traveling', 'private', 'private:private') AND time > 0
            UNION ALL
            SELECT location, user_id, created_at, time 
            FROM ${dbVars.userPrefix}_feed_online_offline 
            WHERE type = 'Offline' AND location NOT IN ('', 'offline', 'traveling', 'private', 'private:private') AND time > 0
        `;

        await sqliteService.execute((row) => {
             const loc = row[0];
             if (!eventsByLocation.has(loc)) eventsByLocation.set(loc, []);
             eventsByLocation.get(loc).push({
                 userId: row[1],
                 leaveAt: new Date(row[2]).getTime(),
                 time: row[3]
             });
        }, sessionsQuery, { '@myId': myUserId });

        // 3. Get first seen and last seen dates
        const firstSeen = new Map();
        const lastSeen = new Map();
        
        await sqliteService.execute((row) => {
             firstSeen.set(row[0], new Date(row[1]).getTime());
             lastSeen.set(row[0], new Date(row[2] || row[3]).getTime());
        }, `
            SELECT user_id, MIN(created_at), 
                   MAX(CASE WHEN src = 3 THEN created_at END),
                   MAX(created_at)
            FROM (
                SELECT user_id, created_at, 1 AS src FROM gamelog_join_leave
                UNION ALL
                SELECT user_id, created_at, 2 AS src FROM ${dbVars.userPrefix}_feed_gps
                UNION ALL
                SELECT user_id, created_at, 3 AS src FROM ${dbVars.userPrefix}_feed_online_offline
            )
            WHERE user_id != ''
            GROUP BY user_id
        `);

        // 4. Get mutual friend snapshots
        const oldMutualSnapshot = new Map();

        await sqliteService.execute((row) => {
            const friendId = row[0];
            const mutualId = row[1];
            if (!oldMutualSnapshot.has(friendId)) oldMutualSnapshot.set(friendId, new Set());
            oldMutualSnapshot.get(friendId).add(mutualId);
        }, `SELECT friend_id, mutual_id FROM ${dbVars.userPrefix}_mutual_graph_links_old`);

        return { eventsByLocation, mySessions, firstSeen, lastSeen, oldMutualSnapshot };
    }
};

export { manualRelations };
