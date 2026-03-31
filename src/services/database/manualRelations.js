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
    }
};

export { manualRelations };
