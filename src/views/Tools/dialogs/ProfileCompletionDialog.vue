<template>
    <Dialog v-model:open="isVisible">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{{ t('view.tools.system_tools.info_completion') }}</DialogTitle>
                <DialogDescription>
                    {{ t('view.tools.system_tools.info_completion_description') }}
                </DialogDescription>
            </DialogHeader>

            <div class="space-y-6 py-4">
                <div class="flex items-center justify-between text-sm">
                    <div class="text-muted-foreground">
                        {{ t('view.tools.system_tools.info_completion_hint', { count: targetCount }) }}
                    </div>
                    <div v-if="isRunning || isDone" class="flex gap-4">
                        <div class="flex flex-col items-end">
                            <span class="text-[10px] text-muted-foreground uppercase opacity-70">Bio 更新</span>
                            <span class="text-sm font-bold text-green-500">{{ state.bioUpdated }}</span>
                        </div>
                        <div class="flex flex-col items-end">
                            <span class="text-[10px] text-muted-foreground uppercase opacity-70">状态更新</span>
                            <span class="text-sm font-bold text-blue-500">{{ state.statusUpdated }}</span>
                        </div>
                    </div>
                </div>

                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div v-if="isRunning" class="flex gap-1">
                                <span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
                                <span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse delay-75"></span>
                                <span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse delay-150"></span>
                            </div>
                            <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                <template v-if="isRunning">正在处理 {{ state.done }} / {{ state.total }}</template>
                                <template v-else-if="isDone">同步任务已完成</template>
                                <template v-else>准备就绪</template>
                            </span>
                        </div>
                        <span class="text-xs font-bold font-mono text-primary">{{ progressPercent }}%</span>
                    </div>
                    <Progress :model-value="progressPercent" class="h-1.5 w-full bg-secondary/50" />
                </div>

                <div v-if="isRunning" class="text-[11px] text-center italic text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
                    正在同步中，请勿关闭弹窗以保证任务连续性...
                </div>
            </div>

            <DialogFooter class="flex flex-row justify-between items-center sm:justify-between w-full border-t pt-4">
                <div class="flex gap-2">
                    <Button 
                        v-if="!isRunning"
                        variant="default" 
                        class="min-w-[120px] transition-all"
                        @click="handleStart" 
                    >
                        {{ isDone ? t('view.tools.system_tools.info_completion_again') : t('view.tools.system_tools.info_completion_start') }}
                    </Button>
                    <Button
                        v-else
                        variant="destructive"
                        class="min-w-[80px]"
                        @click="handleCancel"
                    >
                        {{ t('view.tools.system_tools.info_completion_cancel') }}
                    </Button>
                </div>
                
                <Button variant="ghost" @click="isVisible = false" :disabled="isRunning">
                    {{ t('view.tools.system_tools.info_completion_close') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Progress } from '@/components/ui/progress';
    import { computed, watch } from 'vue';
    import { useI18n } from 'vue-i18n';

    import {
        infoFetchState,
        runSilentInfoFetch,
        cancelInfoFetch,
        getTargetCount
    } from '../../../coordinators/infoFetchCoordinator';

    const props = defineProps({
        visible: {
            type: Boolean,
            required: true
        }
    });
    const emit = defineEmits(['close']);

    const { t } = useI18n();

    const state = infoFetchState;

    const isVisible = computed({
        get: () => props.visible,
        set: (v) => { if (!v) emit('close'); }
    });

    const isRunning = computed(() => state.status === 'running');
    const isDone = computed(() => state.status === 'done');

    const targetCount = computed(() => getTargetCount());

    const progressPercent = computed(() => {
        if (state.total === 0) return 0;
        return Math.floor((state.done / state.total) * 100);
    });

    watch(isVisible, (v) => {
        if (!v && isRunning.value) {
            cancelInfoFetch();
        }
    });

    function handleStart() {
        runSilentInfoFetch();
    }

    function handleCancel() {
        cancelInfoFetch();
    }
</script>
