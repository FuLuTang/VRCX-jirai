import { defineStore } from 'pinia';
import { ref } from 'vue';

import { database } from '../services/database';

export const useManualRelationsStore = defineStore('ManualRelations', () => {
    /** @type {import('vue').Ref<Array<{userIdA: string, userIdB: string, relationType: string, addedAt: string}>>} */
    const relationsList = ref([]);
    /** @type {import('vue').Ref<Set<string>>} */
    const relationsSet = ref(new Set());
    const isLoaded = ref(false);

    /**
     * Build a canonical key for a pair of userIds.
     * @param {string} a
     * @param {string} b
     */
    function pairKey(a, b) {
        return [...[a, b].sort()].join('|');
    }

    /**
     * Load all manual relations from database.
     */
    async function loadManualRelations() {
        const rows = await database.getManualRelations();
        relationsList.value = rows;
        relationsSet.value = new Set(rows.map((r) => pairKey(r.userIdA, r.userIdB)));
        isLoaded.value = true;
    }

    /**
     * Add a manual relation between two users.
     * @param {string} userIdA
     * @param {string} userIdB
     * @param {string} [relationType]
     */
    async function addManualRelation(userIdA, userIdB, relationType = 'friend') {
        await database.addManualRelation(userIdA, userIdB, relationType);
        await loadManualRelations();
    }

    /**
     * Remove a manual relation between two users.
     * @param {string} userIdA
     * @param {string} userIdB
     */
    async function removeManualRelation(userIdA, userIdB) {
        await database.removeManualRelation(userIdA, userIdB);
        await loadManualRelations();
    }

    /**
     * Check if a manual relation exists between two users.
     * @param {string} userIdA
     * @param {string} userIdB
     */
    function isManualRelation(userIdA, userIdB) {
        return relationsSet.value.has(pairKey(userIdA, userIdB));
    }

    return {
        relationsList,
        relationsSet,
        isLoaded,
        loadManualRelations,
        addManualRelation,
        removeManualRelation,
        isManualRelation
    };
});
