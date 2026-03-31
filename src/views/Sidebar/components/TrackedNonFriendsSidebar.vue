<template>
    <div class="relative h-full">
        <div class="h-full w-full overflow-auto overflow-x-hidden">
            <div class="px-1.5 py-2.5">
                <div v-if="trackedList.length === 0" class="flex flex-col items-center justify-center py-8 text-muted-foreground text-xs">
                    <span>{{ t('side_panel.tracked_nonfriends.empty') }}</span>
                </div>
                <div v-else class="flex flex-col gap-0.5">
                    <div
                        v-for="entry in enrichedList"
                        :key="entry.userId"
                        class="box-border flex items-center p-1.5 text-[13px] cursor-pointer hover:bg-muted/50 hover:rounded-lg group"
                        @click="entry.userId && showUserDialog(entry.userId)">
                        <div
                            v-if="entry.ref"
                            class="relative inline-block flex-none size-9 mr-2.5"
                            :class="userStatusClass(entry.ref)">
                            <Avatar class="size-full rounded-full">
                                <AvatarImage :src="userImage(entry.ref)" class="object-cover" />
                                <AvatarFallback>
                                    <User class="size-5 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div v-else class="relative inline-block flex-none size-9 mr-2.5">
                            <Avatar class="size-full rounded-full">
                                <AvatarFallback>
                                    <User class="size-5 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div class="flex-1 overflow-hidden h-9 flex flex-col justify-between">
                            <span
                                class="block truncate font-medium leading-[18px]"
                                :style="entry.ref ? { color: entry.ref.$userColour } : undefined">
                                {{ entry.ref ? entry.ref.displayName : entry.displayName || entry.userId }}
                            </span>
                            <span class="block truncate text-xs text-muted-foreground">
                                {{ entry.ref ? entry.ref.statusDescription : '' }}
                            </span>
                        </div>
                        <TooltipWrapper side="left" :content="t('side_panel.tracked_nonfriends.remove_tooltip')">
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                class="opacity-0 group-hover:opacity-100 ml-1 flex-none"
                                @click.stop="removeEntry(entry.userId)">
                                <X class="size-3.5" />
                            </Button>
                        </TooltipWrapper>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Button } from '@/components/ui/button';
    import { TooltipWrapper } from '@/components/ui/tooltip';
    import { User, X } from 'lucide-vue-next';
    import { computed } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { useTrackedNonFriendsStore } from '../../../stores/trackedNonFriends';
    import { useUserStore } from '../../../stores/user';
    import { useUserDisplay } from '../../../composables/useUserDisplay';
    import { showUserDialog } from '../../../coordinators/userCoordinator';

    const { t } = useI18n();
    const { userImage, userStatusClass } = useUserDisplay();

    const trackedStore = useTrackedNonFriendsStore();
    const { trackedList } = storeToRefs(trackedStore);

    const userStore = useUserStore();

    const enrichedList = computed(() =>
        trackedList.value.map((entry) => ({
            ...entry,
            ref: userStore.cachedUsers.get(entry.userId) || null
        }))
    );

    async function removeEntry(userId) {
        await trackedStore.removeTrackedNonFriend(userId);
    }
</script>
