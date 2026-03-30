import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';

import { useFriendStore } from './friend';
import { useGameStore } from './game';
import { useLaunchStore } from './launch';
import { useLocationStore } from './location';
import { isRealInstance } from '../shared/utils';

export const useAutoFollowStore = defineStore('AutoFollow', () => {
    const isActive = ref(false);
    const targetFriendId = ref(null);
    const targetFriendName = ref('');
    const dialogVisible = ref(false);
    const { t } = useI18n();

    let unwatchFriend = null;

    function startFollow(friend) {
        isActive.value = true;
        targetFriendId.value = friend.id;
        targetFriendName.value = friend.displayName;
        toast.success(`自动跟随已启动: ${friend.displayName}`);

        const friendStore = useFriendStore();
        const gameStore = useGameStore();
        const launchStore = useLaunchStore();
        const locationStore = useLocationStore();

        if (unwatchFriend) {
            unwatchFriend();
        }

        unwatchFriend = watch(
            () => {
                const f = friendStore.friends.get(targetFriendId.value);
                return f ? f.ref?.location : null;
            },
            async (newLocation) => {
                if (!isActive.value || !newLocation) return;
                
                if (isRealInstance(newLocation) && newLocation !== locationStore.lastLocation.location) {
                    toast.info(`自动跟随: ${targetFriendName.value} 切换了房间，准备加入...`);
                    
                    if (!gameStore.isGameNoVR || gameStore.isSteamVRRunning) {
                        launchStore.tryOpenInstanceInVrc(newLocation, null);
                    } else {
                        await AppApi.QuitGame();
                        launchStore.launchGame(newLocation, null, true);
                    }
                }
            }
        );
    }

    function stopFollow() {
        if (isActive.value) {
            isActive.value = false;
            targetFriendId.value = null;
            targetFriendName.value = '';
            toast.success('自动跟随已停止');
            if (unwatchFriend) {
                unwatchFriend();
                unwatchFriend = null;
            }
        }
    }

    function openDialog() {
        dialogVisible.value = true;
    }

    return {
        isActive,
        targetFriendId,
        targetFriendName,
        dialogVisible,
        startFollow,
        stopFollow,
        openDialog
    };
});
