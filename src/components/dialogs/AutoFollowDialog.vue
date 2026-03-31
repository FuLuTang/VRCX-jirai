<template>
    <Dialog v-model:open="dialogVisible">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>自动跟随</DialogTitle>
                <DialogDescription>
                    请选择一个目前在线的好友进行跟随。
                </DialogDescription>
            </DialogHeader>

            <div class="flex flex-col space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                <template v-if="availableFriends.length > 0">
                    <div
                        v-for="friend in availableFriends"
                        :key="friend.id"
                        class="flex items-center p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                        @click="selectFriend(friend)"
                    >
                        <div class="relative block h-10 w-10 flex-none mr-3" :class="userStatusClass(friend.ref || friend)">
                            <Avatar class="h-full w-full rounded-full">
                                <AvatarImage :src="userImage(friend.ref || friend)" class="object-cover" />
                                <AvatarFallback>
                                    <User class="h-5 w-5 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div class="flex-1 overflow-hidden">
                            <span class="block truncate font-medium text-sm" :style="{ color: (friend.ref || friend)?.$userColour }">
                                {{ (friend.ref || friend)?.displayName }}
                            </span>
                            <span class="block truncate text-xs text-muted-foreground">
                                {{ (friend.ref || friend)?.statusDescription || (friend.ref || friend)?.status }}
                            </span>
                        </div>
                    </div>
                </template>
                <div v-else class="text-center py-8 text-muted-foreground text-sm">
                    没有符合条件的好友在线
                </div>
            </div>

            <DialogFooter class="sm:justify-between">
                <Button type="button" variant="outline" :disabled="isRefreshing" @click="refreshFriendList">
                    <RefreshCw class="h-4 w-4 mr-1.5" :class="{ 'animate-spin': isRefreshing }" />
                    {{ t('dialog.refresh') }}
                </Button>
                <Button type="button" variant="secondary" @click="dialogVisible = false">
                    {{ t('dialog.close') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { RefreshCw, User } from 'lucide-vue-next';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

import { useFriendStore } from '../../stores/friend';
import { useAutoFollowStore } from '../../stores/autoFollow';
import { useUserDisplay } from '../../composables/useUserDisplay';

const { t } = useI18n();
const friendStore = useFriendStore();
const autoFollowStore = useAutoFollowStore();
const { sortedFriends } = storeToRefs(friendStore);
const { dialogVisible } = storeToRefs(autoFollowStore);
const { userImage, userStatusClass } = useUserDisplay();

const isRefreshing = ref(false);

const availableFriends = computed(() => {
    return sortedFriends.value.filter(f => {
        return f.state === 'online' &&
            (f.ref?.status === 'join me' || f.ref?.status === 'active' || f.ref?.status === 'ask me');
    });
});

async function refreshFriendList() {
    if (isRefreshing.value) return;
    isRefreshing.value = true;
    try {
        await friendStore.refreshFriends();
    } finally {
        isRefreshing.value = false;
    }
}

function selectFriend(friend) {
    autoFollowStore.startFollow(friend.ref || friend);
    dialogVisible.value = false;
}
</script>
