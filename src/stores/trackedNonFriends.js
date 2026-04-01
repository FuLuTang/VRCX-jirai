import { defineStore } from 'pinia';
import { ref } from 'vue';

import { database } from '../services/database';

export const useTrackedNonFriendsStore = defineStore('TrackedNonFriends', () => {
    /** @type {import('vue').Ref<Array<{userId: string, displayName: string, addedAt: string}>>} */
    const trackedList = ref([]);
    /** @type {import('vue').Ref<Set<string>>} */
    const trackedSet = ref(new Set());
    const isLoaded = ref(false);

    /**
     * Load tracked non-friends from database.
     */
    async function loadTrackedNonFriends() {
        const rows = await database.getTrackedNonFriends();
        trackedList.value = rows;
        trackedSet.value = new Set(rows.map((r) => r.userId));
        isLoaded.value = true;
    }

    /**
     * Add a user to the tracked non-friends list.
     * @param {string} userId
     * @param {string} displayName
     */
    async function addTrackedNonFriend(userId, displayName) {
        if (trackedSet.value.has(userId)) return;
        await database.addTrackedNonFriend(userId, displayName);
        await loadTrackedNonFriends();
    }

    /**
     * Remove a user from the tracked non-friends list.
     * @param {string} userId
     */
    async function removeTrackedNonFriend(userId) {
        await database.removeTrackedNonFriend(userId);
        await loadTrackedNonFriends();
    }

    /**
     * Toggle tracking for a user.
     * @param {string} userId
     * @param {string} displayName
     */
    async function toggleTrackedNonFriend(userId, displayName) {
        if (trackedSet.value.has(userId)) {
            await removeTrackedNonFriend(userId);
        } else {
            await addTrackedNonFriend(userId, displayName);
        }
    }

    /**
     * Check if a user is tracked.
     * @param {string} userId
     */
    function isTracked(userId) {
        return trackedSet.value.has(userId);
    }

    return {
        trackedList,
        trackedSet,
        isLoaded,
        loadTrackedNonFriends,
        addTrackedNonFriend,
        removeTrackedNonFriend,
        toggleTrackedNonFriend,
        isTracked
    };
});
