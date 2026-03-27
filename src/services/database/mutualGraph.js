import { dbVars } from '../database';

import sqliteService from '../sqlite.js';

const mutualGraph = {
    async getMutualGraphSnapshot() {
        const snapshot = new Map();
        if (!dbVars.userPrefix) {
            return snapshot;
        }
        const friendTable = `${dbVars.userPrefix}_mutual_graph_friends`;
        const linkTable = `${dbVars.userPrefix}_mutual_graph_links`;
        await sqliteService.execute((dbRow) => {
            const friendId = dbRow[0];
            if (friendId && !snapshot.has(friendId)) {
                snapshot.set(friendId, []);
            }
        }, `SELECT friend_id FROM ${friendTable}`);
        await sqliteService.execute((dbRow) => {
            const friendId = dbRow[0];
            const mutualId = dbRow[1];
            if (!friendId || !mutualId) {
                return;
            }
            let list = snapshot.get(friendId);
            if (!list) {
                list = [];
                snapshot.set(friendId, list);
            }
            list.push(mutualId);
        }, `SELECT friend_id, mutual_id FROM ${linkTable}`);
        return snapshot;
    },

    async saveMutualGraphSnapshot(entries) {
        if (!dbVars.userPrefix) {
            return;
        }
        const friendTable = `${dbVars.userPrefix}_mutual_graph_friends`;
        const linkTable = `${dbVars.userPrefix}_mutual_graph_links`;
        const pairs = entries instanceof Map ? entries : new Map();
        await sqliteService.executeNonQuery('BEGIN');
        try {
            await sqliteService.executeNonQuery(`DELETE FROM ${friendTable}`);
            await sqliteService.executeNonQuery(`DELETE FROM ${linkTable}`);
            if (pairs.size === 0) {
                await sqliteService.executeNonQuery('COMMIT');
                return;
            }
            let friendValues = '';
            let edgeValues = '';
            pairs.forEach((mutualIds, friendId) => {
                if (!friendId) {
                    return;
                }
                const safeFriendId = friendId.replace(/'/g, "''");
                friendValues += `('${safeFriendId}'),`;
                let collection = [];
                if (Array.isArray(mutualIds)) {
                    collection = mutualIds;
                } else if (mutualIds instanceof Set) {
                    collection = Array.from(mutualIds);
                }
                for (const mutual of collection) {
                    if (!mutual) {
                        continue;
                    }
                    const safeMutualId = String(mutual).replace(/'/g, "''");
                    edgeValues += `('${safeFriendId}', '${safeMutualId}'),`;
                }
            });
            if (friendValues) {
                friendValues = friendValues.slice(0, -1);
                await sqliteService.executeNonQuery(
                    `INSERT OR REPLACE INTO ${friendTable} (friend_id) VALUES ${friendValues}`
                );
            }
            if (edgeValues) {
                edgeValues = edgeValues.slice(0, -1);
                await sqliteService.executeNonQuery(
                    `INSERT OR REPLACE INTO ${linkTable} (friend_id, mutual_id) VALUES ${edgeValues}`
                );
            }
            await sqliteService.executeNonQuery('COMMIT');
        } catch (err) {
            await sqliteService.executeNonQuery('ROLLBACK');
            throw err;
        }
    },

    async updateMutualsForFriend(friendId, mutualIds) {
        if (!dbVars.userPrefix || !friendId) {
            return;
        }
        const friendTable = `${dbVars.userPrefix}_mutual_graph_friends`;
        const linkTable = `${dbVars.userPrefix}_mutual_graph_links`;
        const safeFriendId = friendId.replace(/'/g, "''");
        await sqliteService.executeNonQuery(
            `INSERT OR REPLACE INTO ${friendTable} (friend_id) VALUES ('${safeFriendId}')`
        );
        await sqliteService.executeNonQuery(
            `DELETE FROM ${linkTable} WHERE friend_id='${safeFriendId}'`
        );
        let edgeValues = '';
        for (const mutual of mutualIds) {
            if (!mutual) {
                continue;
            }
            const safeMutualId = String(mutual).replace(/'/g, "''");
            edgeValues += `('${safeFriendId}', '${safeMutualId}'),`;
        }
        if (edgeValues) {
            edgeValues = edgeValues.slice(0, -1);
            await sqliteService.executeNonQuery(
                `INSERT OR REPLACE INTO ${linkTable} (friend_id, mutual_id) VALUES ${edgeValues}`
            );
        }
    },

    async getMutualCountForAllUsers() {
        const mutualCountMap = new Map();
        if (!dbVars.userPrefix) {
            return mutualCountMap;
        }
        const linkTable = `${dbVars.userPrefix}_mutual_graph_links`;
        await sqliteService.execute((dbRow) => {
            const mutualId = dbRow[0];
            const count = dbRow[1];
            if (mutualId) {
                mutualCountMap.set(mutualId, count);
            }
        }, `SELECT mutual_id, COUNT(*) FROM ${linkTable} GROUP BY mutual_id`);
        return mutualCountMap;
    },

    async getMutualGraphSnapshotFromOld() {
        const snapshot = new Map();
        if (!dbVars.userPrefix) {
            return snapshot;
        }
        const oldTable = `${dbVars.userPrefix}_mutual_graph_links_old`;
        await sqliteService.execute((dbRow) => {
            const friendId = dbRow[0];
            const mutualId = dbRow[1];
            if (!friendId || !mutualId) {
                return;
            }
            let list = snapshot.get(friendId);
            if (!list) {
                list = [];
                snapshot.set(friendId, list);
            }
            list.push(mutualId);
        }, `SELECT friend_id, mutual_id FROM ${oldTable}`);
        return snapshot;
    },

    async getMutualsForFriendWithDateFromOld(friendId) {
        const results = [];
        if (!dbVars.userPrefix || !friendId) {
            return results;
        }
        const oldTable = `${dbVars.userPrefix}_mutual_graph_links_old`;
        const safeFriendId = friendId.replace(/'/g, "''");
        await sqliteService.execute((dbRow) => {
            const mutualId = dbRow[0];
            const date = dbRow[1];
            if (mutualId) {
                results.push({ id: mutualId, date: date || null });
            }
        }, `SELECT mutual_id, date FROM ${oldTable} WHERE friend_id='${safeFriendId}'`);
        return results;
    },

    async mergeMutualLinksToOld(entries) {
        if (!dbVars.userPrefix) {
            return;
        }
        const oldTable = `${dbVars.userPrefix}_mutual_graph_links_old`;
        const pairs = entries instanceof Map ? entries : new Map();
        if (pairs.size === 0) {
            return;
        }
        const now = new Date().toISOString();
        await sqliteService.executeNonQuery('BEGIN');
        try {
            let edgeValues = '';
            pairs.forEach((mutualIds, friendId) => {
                if (!friendId) {
                    return;
                }
                const safeFriendId = String(friendId).replace(/'/g, "''");
                let collection = [];
                if (Array.isArray(mutualIds)) {
                    collection = mutualIds;
                } else if (mutualIds instanceof Set) {
                    collection = Array.from(mutualIds);
                }
                for (const mutual of collection) {
                    if (!mutual) {
                        continue;
                    }
                    const safeMutualId = String(mutual).replace(/'/g, "''");
                    edgeValues += `('${safeFriendId}', '${safeMutualId}', '${now}'),`;
                }
            });
            if (edgeValues) {
                edgeValues = edgeValues.slice(0, -1);
                await sqliteService.executeNonQuery(
                    `INSERT OR REPLACE INTO ${oldTable} (friend_id, mutual_id, date) VALUES ${edgeValues}`
                );
            }
            await sqliteService.executeNonQuery('COMMIT');
        } catch (err) {
            await sqliteService.executeNonQuery('ROLLBACK');
            throw err;
        }
    },

    async updateMutualsForFriendInOld(friendId, mutualIds) {
        if (!dbVars.userPrefix || !friendId) {
            return;
        }
        const oldTable = `${dbVars.userPrefix}_mutual_graph_links_old`;
        const safeFriendId = friendId.replace(/'/g, "''");
        const now = new Date().toISOString();
        let edgeValues = '';
        for (const mutual of mutualIds) {
            if (!mutual) {
                continue;
            }
            const safeMutualId = String(mutual).replace(/'/g, "''");
            edgeValues += `('${safeFriendId}', '${safeMutualId}', '${now}'),`;
        }
        if (edgeValues) {
            edgeValues = edgeValues.slice(0, -1);
            await sqliteService.executeNonQuery(
                `INSERT OR REPLACE INTO ${oldTable} (friend_id, mutual_id, date) VALUES ${edgeValues}`
            );
        }
    },

    async updateFriendFetchTimeInOld(friendId) {
        if (!dbVars.userPrefix || !friendId) {
            return;
        }
        const friendsOldTable = `${dbVars.userPrefix}_mutual_graph_friends_old`;
        const safeFriendId = friendId.replace(/'/g, "''");
        const now = new Date().toISOString();
        await sqliteService.executeNonQuery(
            `INSERT OR REPLACE INTO ${friendsOldTable} (friend_id, last_updated) VALUES ('${safeFriendId}', '${now}')`
        );
    },

    async bulkUpdateFriendFetchTimesInOld(friendIds) {
        if (!dbVars.userPrefix || !friendIds || friendIds.length === 0) {
            return;
        }
        const friendsOldTable = `${dbVars.userPrefix}_mutual_graph_friends_old`;
        const now = new Date().toISOString();
        const parts = [];
        for (const friendId of friendIds) {
            if (!friendId) {
                continue;
            }
            const safeFriendId = String(friendId).replace(/'/g, "''");
            parts.push(`('${safeFriendId}', '${now}')`);
        }
        if (parts.length === 0) {
            return;
        }
        await sqliteService.executeNonQuery('BEGIN');
        try {
            await sqliteService.executeNonQuery(
                `INSERT OR REPLACE INTO ${friendsOldTable} (friend_id, last_updated) VALUES ${parts.join(',')}`
            );
            await sqliteService.executeNonQuery('COMMIT');
        } catch (err) {
            await sqliteService.executeNonQuery('ROLLBACK');
            throw err;
        }
    },

    async getFriendLastFetchedFromOld(friendId) {
        if (!dbVars.userPrefix || !friendId) {
            return null;
        }
        const friendsOldTable = `${dbVars.userPrefix}_mutual_graph_friends_old`;
        const safeFriendId = friendId.replace(/'/g, "''");
        let result = null;
        await sqliteService.execute((dbRow) => {
            result = dbRow[0] || null;
        }, `SELECT last_updated FROM ${friendsOldTable} WHERE friend_id='${safeFriendId}'`);
        return result;
    }
};

export { mutualGraph };
