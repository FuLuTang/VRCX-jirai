<template>
    <Dialog v-model:open="isVisible">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{{ t('view.tools.system_tools.bio_fetch') }}</DialogTitle>
                <DialogDescription>{{ t('view.tools.system_tools.bio_fetch_description') }}</DialogDescription>
            </DialogHeader>

            <div class="space-y-4 py-2">
                <div v-if="status === 'idle'" class="text-sm text-muted-foreground">
                    {{ t('view.tools.system_tools.bio_fetch_hint', { count: friendCount }) }}
                </div>

                <div v-if="status === 'running'" class="space-y-2">
                    <div class="flex justify-between text-sm">
                        <span>{{ t('view.tools.system_tools.bio_fetch_progress', { current: done, total: total }) }}</span>
                        <span class="text-muted-foreground">{{ Math.round((done / Math.max(total, 1)) * 100) }}%</span>
                    </div>
                    <Progress :model-value="(done / Math.max(total, 1)) * 100" class="h-2" />
                </div>

                <div v-if="status === 'done'" class="text-sm">
                    <span class="text-green-600 dark:text-green-400">✓ </span>
                    {{ t('view.tools.system_tools.bio_fetch_done', { updated: updatedCount, total }) }}
                </div>
            </div>

            <DialogFooter>
                <Button
                    v-if="status !== 'running'"
                    variant="default"
                    @click="startFetch">
                    {{ status === 'done' ? t('view.tools.system_tools.bio_fetch_again') : t('view.tools.system_tools.bio_fetch_start') }}
                </Button>
                <Button
                    v-if="status === 'running'"
                    variant="secondary"
                    @click="stopFetch">
                    {{ t('view.tools.system_tools.bio_fetch_cancel') }}
                </Button>
                <Button variant="ghost" @click="isVisible = false">
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
    import { useFriendStore } from '../../../stores';

    const props = defineProps({
        visible: {
            type: Boolean,
            required: true
        }
    });
    const emit = defineEmits(['close']);

    const { t } = useI18n();
    const { friends } = storeToRefs(useFriendStore());

    const isVisible = computed({
        get: () => props.visible,
        set: (v) => { if (!v) emit('close'); }
    });

    const status = ref('idle'); // 'idle' | 'running' | 'done'
    const done = ref(0);
    const total = ref(0);
    const updatedCount = ref(0);

    let cancelled = false;

    const friendCount = computed(() => friends.value.size);

    watch(isVisible, (v) => {
        if (!v) {
            cancelled = true;
            status.value = 'idle';
            done.value = 0;
            total.value = 0;
            updatedCount.value = 0;
        }
    });

    function stopFetch() {
        cancelled = true;
    }

    async function startFetch() {
        cancelled = false;
        status.value = 'running';
        done.value = 0;
        updatedCount.value = 0;

        const friendList = [...friends.value.values()].filter((ctx) => ctx.ref);
        total.value = friendList.length;

        for (const ctx of friendList) {
            if (cancelled) break;

            const ref = ctx.ref;
            const userId = ref.id;
            const currentBio = ref.bio || '';
            const displayName = ref.displayName || ctx.name || '';

            try {
                const last = await database.getLastBioChangeForUser(userId);
                if (!last || last.bio !== currentBio) {
                    database.addBioToDatabase({
                        created_at: new Date().toJSON(),
                        userId,
                        displayName,
                        bio: currentBio,
                        previousBio: last ? last.bio : ''
                    });
                    updatedCount.value++;
                }
            } catch {
                // ignore individual errors
            }

            done.value++;
        }

        if (!cancelled) {
            status.value = 'done';
        } else {
            status.value = 'idle';
        }
    }
</script>
