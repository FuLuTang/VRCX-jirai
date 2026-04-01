<template>
    <Dialog v-model:open="isOpen">
        <DialogContent class="w-[600px] max-w-[95vw] flex flex-col max-h-[80vh]" @open-auto-focus.prevent>
            <DialogHeader>
                <DialogTitle>{{ t('view.charts.mutual_friend.manual_relations.dialog_title') }}</DialogTitle>
            </DialogHeader>

            <Tabs default-value="list" class="flex-1 flex flex-col min-h-0">
                <TabsList class="mx-0">
                    <TabsTrigger value="list">{{ t('view.charts.mutual_friend.manual_relations.tab_list') }}</TabsTrigger>
                    <TabsTrigger value="add">{{ t('view.charts.mutual_friend.manual_relations.tab_add') }}</TabsTrigger>
                    <TabsTrigger value="suggest">{{ t('view.charts.mutual_friend.manual_relations.tab_suggest') }}</TabsTrigger>
                </TabsList>

                <!-- ============ LIST TAB ============ -->
                <TabsContent value="list" class="flex-1 overflow-auto mt-3">
                    <div v-if="relationsList.length === 0" class="flex items-center justify-center py-8 text-muted-foreground text-sm">
                        {{ t('view.charts.mutual_friend.manual_relations.list_empty') }}
                    </div>
                    <div v-else class="flex flex-col gap-1">
                        <div
                            v-for="rel in enrichedRelations"
                            :key="`${rel.userIdA}|${rel.userIdB}`"
                            class="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50">
                            <div class="flex-1 flex items-center gap-2 text-sm overflow-hidden">
                                <button
                                    class="underline underline-offset-2 truncate hover:text-primary"
                                    @click="showUserDialog(rel.userIdA)">
                                    {{ rel.nameA }}
                                </button>
                                <span class="text-muted-foreground shrink-0">↔</span>
                                <button
                                    class="underline underline-offset-2 truncate hover:text-primary"
                                    @click="showUserDialog(rel.userIdB)">
                                    {{ rel.nameB }}
                                </button>
                                <Badge v-if="rel.relationType !== 'friend'" variant="secondary" class="shrink-0 text-[10px]">
                                    {{ rel.relationType }}
                                </Badge>
                            </div>
                            <span class="text-xs text-muted-foreground shrink-0">{{ formatDate(rel.addedAt) }}</span>
                            <Button size="icon-sm" variant="ghost" @click="deleteRelation(rel.userIdA, rel.userIdB)">
                                <Trash2 class="size-3.5" />
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                <!-- ============ ADD TAB ============ -->
                <TabsContent value="add" class="mt-3">
                    <div class="flex flex-col gap-4">
                        <Field>
                            <FieldLabel>{{ t('view.charts.mutual_friend.manual_relations.user_a') }}</FieldLabel>
                            <FieldContent>
                                <VirtualCombobox
                                    :model-value="selectedUserA"
                                    @update:modelValue="selectedUserA = $event"
                                    :groups="friendPickerGroups"
                                    :placeholder="t('view.charts.mutual_friend.manual_relations.user_placeholder')"
                                    :search-placeholder="t('view.charts.mutual_friend.manual_relations.user_search')"
                                    :close-on-select="true">
                                    <template #item="{ item, selected }">
                                        <UserPickerItem :item="item" :selected="selected" />
                                    </template>
                                </VirtualCombobox>
                            </FieldContent>
                        </Field>
                        <Field>
                            <FieldLabel>{{ t('view.charts.mutual_friend.manual_relations.user_b') }}</FieldLabel>
                            <FieldContent>
                                <VirtualCombobox
                                    :model-value="selectedUserB"
                                    @update:modelValue="selectedUserB = $event"
                                    :groups="friendPickerGroups"
                                    :placeholder="t('view.charts.mutual_friend.manual_relations.user_placeholder')"
                                    :search-placeholder="t('view.charts.mutual_friend.manual_relations.user_search')"
                                    :close-on-select="true">
                                    <template #item="{ item, selected }">
                                        <UserPickerItem :item="item" :selected="selected" />
                                    </template>
                                </VirtualCombobox>
                            </FieldContent>
                        </Field>
                        <div v-if="addError" class="text-sm text-destructive">{{ addError }}</div>
                        <Button :disabled="!canAdd" @click="addRelation">
                            {{ t('view.charts.mutual_friend.manual_relations.add_button') }}
                        </Button>
                    </div>
                </TabsContent>

                <!-- ============ SUGGEST TAB ============ -->
                <TabsContent value="suggest" class="flex-1 overflow-auto mt-3">
                    <div class="flex flex-col gap-3">
                        <p class="text-sm text-muted-foreground">
                            {{ t('view.charts.mutual_friend.manual_relations.suggest_description') }}
                        </p>
                        <Button :disabled="isSuggesting" @click="runSuggestion">
                            <Spinner v-if="isSuggesting" class="mr-2" />
                            {{ t('view.charts.mutual_friend.manual_relations.suggest_button') }}
                        </Button>
                        <div v-if="suggestions.length > 0" class="flex flex-col gap-2 mt-2">
                            <div
                                v-for="s in suggestions"
                                :key="`${s.userIdA}|${s.userIdB}`"
                                class="flex items-center gap-2 p-2 rounded-md border bg-card text-sm">
                                <div class="flex-1 flex items-center gap-2 overflow-hidden">
                                    <button class="underline underline-offset-2 truncate hover:text-primary" @click="showUserDialog(s.userIdA)">{{ s.nameA }}</button>
                                    <span class="text-muted-foreground shrink-0">↔</span>
                                    <button class="underline underline-offset-2 truncate hover:text-primary" @click="showUserDialog(s.userIdB)">{{ s.nameB }}</button>
                                </div>
                                <div class="text-xs text-muted-foreground shrink-0 text-right">
                                    {{ t('view.charts.mutual_friend.manual_relations.suggest_score', { score: s.score }) }}
                                </div>
                                <Button size="sm" variant="outline" @click="confirmSuggestion(s)">
                                    {{ t('view.charts.mutual_friend.manual_relations.suggest_confirm') }}
                                </Button>
                                <Button size="sm" variant="ghost" @click="dismissSuggestion(s)">
                                    {{ t('view.charts.mutual_friend.manual_relations.suggest_dismiss') }}
                                </Button>
                            </div>
                        </div>
                        <div v-else-if="hasSuggested && !isSuggesting" class="text-sm text-muted-foreground">
                            {{ t('view.charts.mutual_friend.manual_relations.suggest_none') }}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { Badge } from '@/components/ui/badge';
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
    import { Spinner } from '@/components/ui/spinner';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { VirtualCombobox } from '@/components/ui/virtual-combobox';
    import { Check as CheckIcon, Trash2 } from 'lucide-vue-next';
    import { computed, defineComponent, h, ref } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import dayjs from 'dayjs';

    import { useManualRelationsStore } from '../../../stores/manualRelations';
    import { useFriendStore, useTrackedNonFriendsStore, useUserStore } from '../../../stores';
    import { database } from '../../../services/database';
    import { showUserDialog } from '../../../coordinators/userCoordinator';

    const isOpen = defineModel('open', { type: Boolean, default: false });
    const { t } = useI18n();

    const manualRelationsStore = useManualRelationsStore();
    const { relationsList } = storeToRefs(manualRelationsStore);

    const friendStore = useFriendStore();
    const userStore = useUserStore();
    const trackedStore = useTrackedNonFriendsStore();
    const { friends } = storeToRefs(friendStore);
    const { trackedList } = storeToRefs(trackedStore);
    const cachedUsers = userStore.cachedUsers;

    // ---- User picker helper component ----
    const UserPickerItem = defineComponent({
        props: { item: Object, selected: Boolean },
        render() {
            const { item, selected } = this;
            return h('div', { class: 'flex w-full items-center p-1.5 text-[13px]' }, [
                h('div', { class: 'flex-1 overflow-hidden' }, [
                    h('span', { class: 'block truncate font-medium' }, item?.label || ''),
                ]),
                h(CheckIcon, { class: ['ml-auto size-4', selected ? 'opacity-100' : 'opacity-0'] }),
            ]);
        }
    });

    // ---- Picker groups (friends + tracked users) ----
    const friendPickerGroups = computed(() => {
        const items = [];
        const seenIds = new Set();

        // 1. Friends
        for (const [id, ctx] of friends.value.entries()) {
            const displayName = ctx.ref?.displayName || ctx.name || id;
            items.push({ value: id, label: displayName, search: displayName });
            seenIds.add(id);
        }

        // 2. Tracked Non-Friends
        for (const item of trackedList.value) {
            if (!seenIds.has(item.userId)) {
                const displayName = item.displayName || item.userId;
                items.push({ value: item.userId, label: displayName, search: displayName });
                seenIds.add(item.userId);
            }
        }

        items.sort((a, b) => a.label.localeCompare(b.label));
        return [{ key: 'users', label: '全部追踪目标', items }];
    });

    // ---- Enrich relation list with display names ----
    const enrichedRelations = computed(() =>
        relationsList.value.map((r) => ({
            ...r,
            nameA: cachedUsers.get(r.userIdA)?.displayName || r.userIdA,
            nameB: cachedUsers.get(r.userIdB)?.displayName || r.userIdB
        }))
    );

    function formatDate(iso) {
        return iso ? dayjs(iso).format('YYYY-MM-DD') : '';
    }

    // ---- Add relation ----
    const selectedUserA = ref(null);
    const selectedUserB = ref(null);
    const addError = ref('');

    const canAdd = computed(
        () =>
            selectedUserA.value &&
            selectedUserB.value &&
            selectedUserA.value !== selectedUserB.value
    );

    async function addRelation() {
        addError.value = '';
        if (!canAdd.value) return;
        if (manualRelationsStore.isManualRelation(selectedUserA.value, selectedUserB.value)) {
            addError.value = t('view.charts.mutual_friend.manual_relations.already_exists');
            return;
        }
        await manualRelationsStore.addManualRelation(selectedUserA.value, selectedUserB.value, 'friend');
        selectedUserA.value = null;
        selectedUserB.value = null;
    }

    async function deleteRelation(idA, idB) {
        await manualRelationsStore.removeManualRelation(idA, idB);
    }

    // ---- Suggest likely friends ----
    const suggestions = ref([]);
    const isSuggesting = ref(false);
    const hasSuggested = ref(false);
    const dismissedSuggestions = ref(new Set());

    /**
     * Score-based "most likely friend" algorithm:
     * - For each tracked non-friend user X, look at mutual-graph snapshots to find
     *   which friends appear most alongside them.
     * - Score = number of common mutual friends (from getMutualGraphSnapshot / getMutualGraphSnapshotFromOld).
     * - Exclude pairs already in manual_relations_MANUEL or already friends.
     */
    async function runSuggestion() {
        isSuggesting.value = true;
        hasSuggested.value = false;
        suggestions.value = [];

        try {
            const mutualMap = await database.getMutualGraphSnapshot();
            const oldMutualMap = await database.getMutualGraphSnapshotFromOld();
            const manualRelsList = await database.getManualRelations();
            const manualSet = new Set(manualRelsList.map((r) => `${r.userIdA}|${r.userIdB}`));

            // Build co-occurrence scores: for each pair (tracked_user, friend),
            // count how many of the friend's mutuals include the tracked_user
            const coScores = new Map(); // key: "idA|idB" (sorted) → score

            function addScore(idA, idB, delta) {
                const [a, b] = [idA, idB].sort();
                const key = `${a}|${b}`;
                coScores.set(key, (coScores.get(key) || 0) + delta);
            }

            // Iterate current snapshot: for each (friend, mutuals), increment score
            // for all (friend, mutual) pairs
            for (const [friendId, mutualIds] of mutualMap.entries()) {
                for (const mutualId of mutualIds) {
                    if (!mutualId || mutualId === friendId) continue;
                    addScore(friendId, mutualId, 1);
                }
            }

            // Also boost using historical snapshot
            for (const [friendId, mutualIds] of oldMutualMap.entries()) {
                for (const mutualId of mutualIds) {
                    if (!mutualId || mutualId === friendId) continue;
                    addScore(friendId, mutualId, 0.5);
                }
            }

            // Filter: exclude already-friends pairs, already-manual, self, dismissed
            const result = [];
            for (const [key, score] of coScores.entries()) {
                if (score < 2) continue;
                const [idA, idB] = key.split('|');
                if (friends.value.has(idA) && friends.value.has(idB)) continue;
                if (manualSet.has(key)) continue;
                if (dismissedSuggestions.value.has(key)) continue;
                const nameA = cachedUsers.get(idA)?.displayName || idA;
                const nameB = cachedUsers.get(idB)?.displayName || idB;
                result.push({ userIdA: idA, userIdB: idB, nameA, nameB, score: Math.round(score * 10) / 10, key });
            }

            result.sort((a, b) => b.score - a.score);
            suggestions.value = result.slice(0, 20);
        } catch (err) {
            console.error('[ManualRelations] Suggestion error', err);
        } finally {
            isSuggesting.value = false;
            hasSuggested.value = true;
        }
    }

    async function confirmSuggestion(s) {
        await manualRelationsStore.addManualRelation(s.userIdA, s.userIdB, 'friend');
        suggestions.value = suggestions.value.filter((x) => x.key !== s.key);
    }

    function dismissSuggestion(s) {
        dismissedSuggestions.value.add(s.key);
        suggestions.value = suggestions.value.filter((x) => x.key !== s.key);
    }
</script>
