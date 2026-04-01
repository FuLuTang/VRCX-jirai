import { reactive, computed } from 'vue';
import { database } from '../services/database';
import { useFriendStore, useTrackedNonFriendsStore } from '../stores';
import { userRequest } from '../api';

/**
 * 信息抓取补全的全局响应式状态。
 * StatusBar / ProfileCompletionDialog 等 UI 组件直接读取此对象即可。
 */
export const infoFetchState = reactive({
    /** 'idle' | 'running' | 'done' */
    status: 'idle',
    done: 0,
    total: 0,
    bioUpdated: 0,
    statusUpdated: 0
});

let cancelled = false;

/**
 * 取消正在进行的抓取。
 */
export function cancelInfoFetch() {
    cancelled = true;
}

/**
 * 获取当前待扫描的目标总数（好友 + 追踪非好友，去重）。
 * 用于 ProfileCompletionDialog 在未启动时显示目标数。
 */
export function getTargetCount() {
    const friendStore = useFriendStore();
    const trackedStore = useTrackedNonFriendsStore();
    const seenIds = new Set();

    for (const ctx of friendStore.friends.values()) {
        seenIds.add(ctx.id);
    }
    for (const item of trackedStore.trackedList) {
        seenIds.add(item.userId);
    }
    return seenIds.size;
}

/**
 * 构建扫描目标列表（好友 + 追踪非好友，去重）。
 * @returns {Array<{userId: string, displayName: string}>}
 */
function buildTargetList() {
    const friendStore = useFriendStore();
    const trackedStore = useTrackedNonFriendsStore();
    const list = [];
    const seenIds = new Set();

    for (const ctx of friendStore.friends.values()) {
        list.push({ userId: ctx.id, displayName: ctx.name });
        seenIds.add(ctx.id);
    }

    for (const item of trackedStore.trackedList) {
        if (!seenIds.has(item.userId)) {
            list.push({ userId: item.userId, displayName: item.displayName });
            seenIds.add(item.userId);
        }
    }

    return list;
}

/**
 * 执行全量信息抓取补全（个人简介 + 隐私状态）。
 * 通过 API 强制刷新每个用户的资料，与数据库对比后写入变更记录。
 *
 * 可由启动、L4 末尾、用户手动点击、ProfileCompletionDialog 等多处调用，内建防重入。
 */
export async function runSilentInfoFetch() {
    if (infoFetchState.status === 'running') return;

    cancelled = false;
    infoFetchState.status = 'running';
    infoFetchState.done = 0;
    infoFetchState.bioUpdated = 0;
    infoFetchState.statusUpdated = 0;

    const targets = buildTargetList();
    infoFetchState.total = targets.length;

    if (targets.length === 0) {
        infoFetchState.status = 'done';
        return;
    }

    console.log(`[InfoFetch] 开始抓取，共 ${targets.length} 个目标（好友 + 追踪非好友）`);

    for (const target of targets) {
        if (cancelled) break;

        let userJson = null;

        // 通过 API 获取最新资料
        try {
            const result = await userRequest.getUser({ userId: target.userId });
            userJson = result.json;
        } catch {
            // 如果失败（如 429），等 0.5s 后重试一次
            if (cancelled) break;
            await new Promise((r) => setTimeout(r, 500));
            try {
                const result = await userRequest.getUser({ userId: target.userId });
                userJson = result.json;
            } catch (retryError) {
                console.error(`[InfoFetch] Failed to fetch ${target.userId} after retry`, retryError);
            }
        }

        if (userJson) {
            const userId = userJson.id;
            const displayName = userJson.displayName || target.displayName;

            // 1. Bio 对比
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
                    infoFetchState.bioUpdated++;
                }
            } catch {
                // ignore
            }

            // 2. Status/灯色 对比
            try {
                const currentStatus = userJson.status || 'offline';
                const currentStatusDesc = userJson.statusDescription || '';

                const validStatuses = ['join me', 'active', 'ask me', 'busy'];
                if (validStatuses.includes(currentStatus)) {
                    const lastStatus = await database.getLastStatusChangeForUser(userId);
                    if (
                        !lastStatus ||
                        lastStatus.status !== currentStatus ||
                        lastStatus.statusDescription !== currentStatusDesc
                    ) {
                        database.addStatusToDatabase({
                            created_at: new Date().toJSON(),
                            userId,
                            displayName,
                            status: currentStatus,
                            statusDescription: currentStatusDesc,
                            previousStatus: lastStatus ? lastStatus.status : '',
                            previousStatusDescription: lastStatus ? lastStatus.statusDescription : ''
                        });
                        infoFetchState.statusUpdated++;
                    }
                }
            } catch {
                // ignore
            }
        }

        infoFetchState.done++;
    }

    if (!cancelled) {
        infoFetchState.status = 'done';
        console.log(
            `[InfoFetch] 完成：Bio 更新 ${infoFetchState.bioUpdated} 条，Status 更新 ${infoFetchState.statusUpdated} 条`
        );
    } else {
        infoFetchState.status = 'idle';
        console.log('[InfoFetch] 已取消');
    }
}
