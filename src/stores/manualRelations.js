import { defineStore } from 'pinia';
import { ref } from 'vue';
import dayjs from 'dayjs';
import { parseLocation } from '../shared/utils';
import { database } from '../services/database';
import { useFriendStore } from './friend';
import { useUserStore } from './user';
import { useTrackedNonFriendsStore } from './trackedNonFriends';

export const useManualRelationsStore = defineStore('ManualRelations', () => {
    /** @type {import('vue').Ref<Array<{userIdA: string, userIdB: string, relationType: string, addedAt: string}>>} */
    const relationsList = ref([]);
    /** @type {import('vue').Ref<Set<string>>} */
    const relationsSet = ref(new Set());
    const isLoaded = ref(false);
    
    /** @type {import('vue').Ref<Array<{userIdA: string, userIdB: string, score: number, key: string, nameA: string, nameB: string}>>} */
    const cachedSuggestions = ref([]);
    const ignoredSuggestionKeys = ref(new Set());
    const isComputingSuggestions = ref(false);
    const computingProgress = ref({ done: 0, total: 100, step: '' });

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

    function setCachedSuggestions(suggestions) {
        cachedSuggestions.value = suggestions;
    }

    function ignoreSuggestion(key) {
        ignoredSuggestionKeys.value.add(key);
    }

    async function computeSuggestions() {
        if (isComputingSuggestions.value) return;
        const friendStore = useFriendStore();
        const userStore = useUserStore();
        const trackedNonFriendsStore = useTrackedNonFriendsStore();
        
        isComputingSuggestions.value = true;
        try {
            const { 
                eventsByLocation, 
                mySessions, 
                firstSeen,
                lastSeen,
                oldMutualSnapshot 
            } = await database.getCandidateCoInstances(userStore.currentUser?.id || '');
            
            const myFriendsSet = new Set(friendStore.friends.keys());
            const trackedSet = new Set(trackedNonFriendsStore.trackedList.map(x => x.userId));
            const candidatesSet = new Set([...myFriendsSet, ...trackedSet]);
            
            const pairStats = new Map();
            
            for (const [location, sessions] of eventsByLocation.entries()) {
                const parsed = parseLocation(location);
                const creatorId = parsed.userId;
                const isStrictPrivate = (parsed.accessType === 'hidden' || parsed.accessType === 'private');

                const mySess = mySessions.get(location) || [];
                const P = sessions.length;
                const locPairs = new Map();
                
                for (let i = 0; i < P; i++) {
                    const sessA = sessions[i];
                    if (!candidatesSet.has(sessA.userId)) continue;
                    
                    for (let j = i + 1; j < P; j++) {
                        const sessB = sessions[j];
                        if (!candidatesSet.has(sessB.userId)) continue;
                        if (sessA.userId === sessB.userId) continue;
                        
                        const overlapStart = Math.max(sessA.leaveAt - sessA.time, sessB.leaveAt - sessB.time);
                        const overlapEnd = Math.min(sessA.leaveAt, sessB.leaveAt);
                        
                        if (overlapEnd - overlapStart >= 60000) {
                            const [id1, id2] = [sessA.userId, sessB.userId].sort();
                            const key = `${id1}|${id2}`;
                            
                            let hardMatch = false;
                            if (isStrictPrivate && (creatorId === id1 || creatorId === id2)) {
                                hardMatch = true;
                            }
                            
                            let mePresent = false;
                            for (const m of mySess) {
                                const myStart = m.leaveAt - m.time;
                                const myEnd = m.leaveAt;
                                if (Math.min(myEnd, overlapEnd) - Math.max(myStart, overlapStart) > 0) {
                                    mePresent = true;
                                    break;
                                }
                            }
                            
                            if (!locPairs.has(key)) {
                                locPairs.set(key, { hardMatch, mePresent });
                            } else {
                                const state = locPairs.get(key);
                                state.hardMatch = state.hardMatch || hardMatch;
                                state.mePresent = state.mePresent || mePresent;
                            }
                        }
                    }
                }
                
                for (const [key, state] of locPairs.entries()) {
                    let stats = pairStats.get(key);
                    if (!stats) {
                        stats = { count: 0, countMeAbsent: 0, hardMatch: false };
                        pairStats.set(key, stats);
                    }
                    stats.count++;
                    if (!state.mePresent) stats.countMeAbsent++;
                    if (state.hardMatch) stats.hardMatch = true;
                }
            }

            const knownFriendsSet = new Set();
            const allCandidateIds = Array.from(candidatesSet);
            
            computingProgress.value = { done: 0, total: allCandidateIds.length * allCandidateIds.length, step: '扫描现有关系网' };
            let loopCounter = 0;

            for (const idA of allCandidateIds) {
                const listA = oldMutualSnapshot.get(idA) || new Set();
                for (const idB of allCandidateIds) {
                    if (idA >= idB) continue;
                    const listB = oldMutualSnapshot.get(idB) || new Set();
                    const key = `${idA}|${idB}`;
                    if (listA.has(idB) || listB.has(idA)) {
                        knownFriendsSet.add(key);
                    }
                    if (++loopCounter % 50000 === 0) {
                        computingProgress.value.done = loopCounter;
                        await new Promise(r => setTimeout(r, 0));
                    }
                }
            }

            const manualRelsList = await database.getManualRelations();
            
            const manualSet = new Set(manualRelsList.map((r) => {
                const [a, b] = [r.userIdA, r.userIdB].sort();
                return `${a}|${b}`;
            }));

            const result = [];
            const now = Date.now();
            
            computingProgress.value = { done: 0, total: pairStats.size, step: '轨迹匹配分值测算' };
            loopCounter = 0;

            for (const [key, stats] of pairStats.entries()) {
                if (++loopCounter % 2000 === 0) {
                    computingProgress.value.done = loopCounter;
                    await new Promise(r => setTimeout(r, 0));
                }
                
                if (knownFriendsSet.has(key)) continue;
                
                const [idA, idB] = key.split('|');
                if (manualSet.has(key)) continue;

                // User heuristic: If we found > 0 mutual friends for a player, it proves they have "Show Mutual Friends" ON.
                // If BOTH players have the feature ON, and they aren't friends in `knownFriendsSet`, they are definitively NOT friends. Skip.
                const listA = oldMutualSnapshot.get(idA);
                const listB = oldMutualSnapshot.get(idB);
                const hasMutualsA = listA && listA.size > 0;
                const hasMutualsB = listB && listB.size > 0;

                if (hasMutualsA && hasMutualsB) {
                    continue;
                }

                const nameA = userStore.cachedUsers.get(idA)?.displayName || idA;
                const nameB = userStore.cachedUsers.get(idB)?.displayName || idB;

                let finalScore = 0;
                let displayScore = '';
                let tooltip = '';

                const firstA = firstSeen.get(idA) || now;
                const firstB = firstSeen.get(idB) || now;
                const lastA = lastSeen.get(idA) || now;
                const lastB = lastSeen.get(idB) || now;
                
                const effectiveStartDate = Math.max(firstA, firstB);
                const effectiveEndDate = Math.min(lastA, lastB, now);
                const daysObservedSpan = (effectiveEndDate - effectiveStartDate) / (1000 * 60 * 60 * 24);
                const daysObserved = Math.max(14, daysObservedSpan);
                const startDateStr = dayjs(effectiveStartDate).format('YYYY-MM-DD');
                const endDateStr = dayjs(effectiveEndDate).format('YYYY-MM-DD');

                if (stats.hardMatch) {
                    finalScore = 9999;
                    displayScore = '私房';
                    tooltip = `一票肯定 (私密房间): 是\n由于双方之一是在特定私密房间的创建者，所以直接判定为肯定存在好友关系。`;
                } else {
                    const densityBonus = Math.round((stats.count / daysObserved) * 50);
                    const baseScore = stats.count + densityBonus;
                    
                    let multiplierStr = '';
                    let multiplier = 1.0;
                    const absentRatio = stats.count > 0 ? stats.countMeAbsent / stats.count : 0;
                    const absentPct = Math.round(absentRatio * 100);

                    if (absentRatio <= 0.08) {
                        multiplier = 0.55 + (absentRatio / 0.08) * (1.08 - 0.55);
                    } else {
                        multiplier = 1.0 + absentRatio;
                    }
                    multiplierStr = `${Math.round(multiplier * 100)}%`;
                    
                    finalScore = Math.round(baseScore * multiplier);
                    if (finalScore < 5) continue; 
                    displayScore = `${finalScore}`;
                    
                    const multiplierFormula = absentRatio <= 0.08 
                        ? `惩罚: 0.55 + (${absentRatio.toFixed(3)} / 0.08) * 0.53`
                        : `增幅: 1.0 + ${absentRatio.toFixed(3)}`;

                    tooltip = `最终得分: ${finalScore}\n`
                            + `计算式: ${baseScore} (基数) × ${multiplierStr} (权重)\n`
                            + `─────\n`
                            + `基数构成: ${stats.count} (绝对次数) + ${densityBonus} (密度加成)\n`
                            + `有效相遇: ${stats.count} 次\n`
                            + `观测窗口: ${Math.round(daysObserved)} 天 (${startDateStr} 至 ${endDateStr})\n\n`
                            + `缺席权重: ${multiplierStr} (${multiplierFormula})\n`
                            + `共处中我不在场: ${stats.countMeAbsent} 次 (约 ${absentPct}%)`;
                }

                result.push({ userIdA: idA, userIdB: idB, nameA, nameB, score: finalScore, displayScore, tooltip, key });
            }

            result.sort((a, b) => b.score - a.score);
            cachedSuggestions.value = result;
        } catch (err) {
            console.error('[ManualRelations] Suggestion calculation error', err);
        } finally {
            isComputingSuggestions.value = false;
        }
    }

    return {
        relationsList,
        relationsSet,
        isLoaded,
        cachedSuggestions,
        ignoredSuggestionKeys,
        isComputingSuggestions,
        computingProgress,
        loadManualRelations,
        addManualRelation,
        removeManualRelation,
        isManualRelation,
        setCachedSuggestions,
        ignoreSuggestion,
        computeSuggestions
    };
});
