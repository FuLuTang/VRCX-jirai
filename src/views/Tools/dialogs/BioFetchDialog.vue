<template>
    <Dialog v-model:open="isVisible">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{{ t('view.tools.system_tools.bio_fetch') }}</DialogTitle>
                <DialogDescription>
                    一键抓取所有好友与追踪非好友的最新个人简介 (Bio) 与隐私状态 (灯色)。
                    此操作将通过 API 强制刷新资料并与本地数据库对比，由于不带缓存，扫描耗时取决于总人数。
                </DialogDescription>
            </DialogHeader>

            <div class="space-y-6 py-4">
                <div class="flex items-center justify-between text-sm">
                    <div class="text-muted-foreground">
                        待扫描目标: <span class="font-medium text-foreground">{{ totalTargetCount }}</span>
                    </div>
                    <div v-if="isFetching || hasFinished" class="flex gap-4">
                        <div class="flex flex-col items-end">
                            <span class="text-[10px] text-muted-foreground uppercase opacity-70">Bio 更新</span>
                            <span class="text-sm font-bold text-green-500">{{ bioUpdatedCount }}</span>
                        </div>
                        <div class="flex flex-col items-end">
                            <span class="text-[10px] text-muted-foreground uppercase opacity-70">状态更新</span>
                            <span class="text-sm font-bold text-blue-500">{{ statusUpdatedCount }}</span>
                        </div>
                    </div>
                </div>

                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div v-if="isFetching" class="flex gap-1">
                                <span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
                                <span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse delay-75"></span>
                                <span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse delay-150"></span>
                            </div>
                            <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                <template v-if="isFetching">正在处理 {{ doneCount }} / {{ totalCount }}</template>
                                <template v-else-if="hasFinished">同步任务已完成</template>
                                <template v-else>准备就绪</template>
                            </span>
                        </div>
                        <span class="text-xs font-bold font-mono text-primary">{{ progressPercent }}%</span>
                    </div>
                    <Progress :model-value="progressPercent" class="h-1.5 w-full bg-secondary/50" />
                </div>

                <div v-if="isFetching" class="text-[11px] text-center italic text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
                    正在同步中，请勿关闭弹窗以保证任务连续性...
                </div>
            </div>

            <DialogFooter class="flex flex-row justify-between items-center sm:justify-between w-full border-t pt-4">
                <div class="flex gap-2">
                    <Button 
                        v-if="!isFetching"
                        variant="default" 
                        class="min-w-[120px] transition-all"
                        @click="startFetch" 
                    >
                        {{ hasFinished ? '再次同步' : '开始全量刷新' }}
                    </Button>
                    <Button
                        v-else
                        variant="destructive"
                        class="min-w-[80px]"
                        @click="stopFetch"
                    >
                        停止扫描
                    </Button>
                </div>
                
                <Button variant="ghost" @click="isVisible = false" :disabled="isFetching">
                    {{ t('view.tools.system_tools.bio_fetch_close') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Progress } from '@/components/ui/progress';
    import { computed, ref, watch } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { database } from '../../../services/database';
    import { useFriendStore, useTrackedNonFriendsStore } from '../../../stores';
    import { userRequest } from '../../../api';

    const props = defineProps({
        visible: {
            type: Boolean,
            required: true
        }
    });
    const emit = defineEmits(['close']);

    const { t } = useI18n();
    const { friends } = storeToRefs(useFriendStore());
    const { trackedList } = storeToRefs(useTrackedNonFriendsStore());

    const isVisible = computed({
        get: () => props.visible,
        set: (v) => { if (!v) emit('close'); }
    });

    const isFetching = ref(false);
    const hasFinished = ref(false);
    const totalCount = ref(0);
    const doneCount = ref(0);
    const bioUpdatedCount = ref(0);
    const statusUpdatedCount = ref(0);
    let isCancelled = false;

    const combinedTargets = computed(() => {
        const list = [];
        const seenIds = new Set();
        
        // Add Friends
        for (const ctx of friends.value.values()) {
            list.push({
                userId: ctx.id,
                displayName: ctx.name
            });
            seenIds.add(ctx.id);
        }
        
        // Add Tracked Non-Friends
        for (const item of trackedList.value) {
            if (!seenIds.has(item.userId)) {
                list.push({
                    userId: item.userId,
                    displayName: item.displayName
                });
                seenIds.add(item.userId);
            }
        }
        return list;
    });

    const totalTargetCount = computed(() => combinedTargets.value.length);
    const progressPercent = computed(() => {
        if (totalCount.value === 0) return 0;
        return Math.floor((doneCount.value / totalCount.value) * 100);
    });

    watch(isVisible, (v) => {
        if (!v) {
            isCancelled = true;
            isFetching.value = false;
        }
    });

    function stopFetch() {
        isCancelled = true;
        isFetching.value = false;
    }

    async function startFetch() {
        isCancelled = false;
        isFetching.value = true;
        hasFinished.value = false;
        doneCount.value = 0;
        bioUpdatedCount.value = 0;
        statusUpdatedCount.value = 0;
        
        const targets = combinedTargets.value;
        totalCount.value = targets.length;

        for (const target of targets) {
            if (isCancelled) break;

            let userJson = null;

            // Attempt 1: Fetch Profile
            try {
                const result = await userRequest.getUser({ userId: target.userId });
                userJson = result.json;
            } catch (e) {
                // If 429 or other error, retry once after 0.5s
                if (isCancelled) break;
                await new Promise(r => setTimeout(r, 500));
                try {
                    const result = await userRequest.getUser({ userId: target.userId });
                    userJson = result.json;
                } catch (retryError) {
                    console.error(`[BioFetch] Failed to fetch ${target.userId} after retry`, retryError);
                }
            }

            if (userJson) {
                const userId = userJson.id;
                const displayName = userJson.displayName || target.displayName;
                
                // 1. Process Bio (Comparison with Database)
                try {
                    const currentBio = userJson.bio || '';
                    const lastBio = await database.getLastBioChangeForUser(userId);
                    if (!lastBio || lastBio.bio !== currentBio) {
                        database.addBioToDatabase({
                            created_at: new Date().toJSON(),
                            userId,
                            displayName,
                            bio: currentBio,
                            previousBio: lastBio ? lastBio.bio : ''
                        });
                        bioUpdatedCount.value++;
                    }
                } catch (e) {
                    console.error(`[BioFetch] Bio Update Error for ${displayName}:`, e);
                }

                // 2. Process Status/Lamp (Comparison with Database)
                try {
                    const currentStatus = userJson.status || 'offline';
                    const currentStatusDesc = userJson.statusDescription || '';
                    
                    const validStatuses = ['join me', 'active', 'ask me', 'busy'];
                    // We record even if status is 'ask me' but state was 'offline' for non-friends
                    if (validStatuses.includes(currentStatus)) {
                        const lastStatus = await database.getLastStatusChangeForUser(userId);
                        // Log if either lamp color or status description changed
                        if (!lastStatus || 
                            lastStatus.status !== currentStatus || 
                            lastStatus.statusDescription !== currentStatusDesc) {
                            
                            database.addStatusToDatabase({
                                created_at: new Date().toJSON(),
                                userId,
                                displayName,
                                status: currentStatus,
                                statusDescription: currentStatusDesc,
                                previousStatus: lastStatus ? lastStatus.status : '',
                                previousStatusDescription: lastStatus ? lastStatus.statusDescription : ''
                            });
                            statusUpdatedCount.value++;
                        }
                    }
                } catch (e) {
                    console.error(`[BioFetch] Status Update Error for ${displayName}:`, e);
                }
            }

            doneCount.value++;
        }

        isFetching.value = false;
        if (!isCancelled) {
            hasFinished.value = true;
        }
    }
</script>


