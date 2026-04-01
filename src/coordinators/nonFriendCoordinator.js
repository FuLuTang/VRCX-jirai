import { database } from '../services/database';
import { userRequest } from '../api';
import { useTrackedNonFriendsStore } from '../stores/trackedNonFriends';
import { watchState } from '../services/watchState';

let isRunning = false;

/**
 * Refresh bio and status for all tracked non-friends (L4 level, ~hourly).
 * Fetches fresh user data from the VRChat API and records changes.
 */
export async function refreshTrackedNonFriendsFlow() {
    if (!watchState.isLoggedIn) return;
    if (isRunning) return;

    isRunning = true;
    try {
        const trackedStore = useTrackedNonFriendsStore();
        if (!trackedStore.isLoaded) {
            await trackedStore.loadTrackedNonFriends();
        }

        const tracked = [...trackedStore.trackedList];
        if (tracked.length === 0) return;

        console.log(`[NonFriendRefresh] 开始刷新 ${tracked.length} 位追踪非好友的数据`);

        for (const entry of tracked) {
            const userId = entry.userId;
            try {
                const result = await userRequest.getUser({ userId });
                const ref = result?.ref;
                if (!ref) continue;

                const displayName = ref.displayName || entry.displayName;

                // Update display name in DB if changed
                if (displayName && displayName !== entry.displayName) {
                    await database.updateTrackedNonFriendDisplayName(userId, displayName);
                }

                // Record bio change
                const currentBio = ref.bio || '';
                const lastBio = await database.getLastBioChangeForUser(userId);
                if (!lastBio || lastBio.bio !== currentBio) {
                    database.addBioToDatabase({
                        created_at: new Date().toISOString(),
                        userId,
                        displayName,
                        bio: currentBio,
                        previousBio: lastBio ? lastBio.bio : ''
                    });
                }

                // Record status change
                const currentStatus = ref.status || '';
                const currentStatusDesc = ref.statusDescription || '';
                const validStatuses = ['join me', 'active', 'ask me', 'busy'];
                if (validStatuses.includes(currentStatus)) {
                    const lastStatus = await database.getLastStatusChangeForUser(userId);
                    if (!lastStatus || lastStatus.status !== currentStatus) {
                        database.addStatusToDatabase({
                            created_at: new Date().toISOString(),
                            userId,
                            displayName,
                            status: currentStatus,
                            statusDescription: currentStatusDesc,
                            previousStatus: lastStatus ? lastStatus.status : '',
                            previousStatusDescription: lastStatus ? lastStatus.statusDescription : ''
                        });
                    }
                }
            } catch (err) {
                // API errors (e.g. user not found) are non-fatal
                console.warn(`[NonFriendRefresh] 刷新用户 ${userId} 失败:`, err?.message || err);
            }
        }

        // Reload store to pick up any display-name updates
        await trackedStore.loadTrackedNonFriends();
        console.log(`[NonFriendRefresh] 完成`);
    } catch (err) {
        console.error('[NonFriendRefresh] 刷新出错:', err);
    } finally {
        isRunning = false;
    }
}
