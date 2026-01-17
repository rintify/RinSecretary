import { db, ClientMemo } from './db';

const SYNC_INTERVAL_MS = 60 * 1000; // 1分ごとに同期（現在未使用）
const GC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1日ごとにGC
const LRU_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7日間アクセスがないキャッシュは削除

// コンフリクト解決用のコールバック型
export type ConflictResolver = (
    localMemo: ClientMemo,
    serverMemo: { id: string; title: string; content: string; updatedAt: string; createdAt: string; thumbnailPath?: string | null }
) => Promise<'local' | 'server' | 'cancel'>;

export class SyncManager {
    private static instance: SyncManager;
    private isSyncing = false;
    private online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    private conflictResolver: ConflictResolver | null = null;

    private constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                this.online = true;
                this.sync();
            });
            window.addEventListener('offline', () => {
                this.online = false;
            });

            // Periodic GC
            setInterval(() => this.garbageCollect(), GC_INTERVAL_MS);
        }
    }

    public static getInstance(): SyncManager {
        if (!SyncManager.instance) {
            SyncManager.instance = new SyncManager();
        }
        return SyncManager.instance;
    }

    // コンフリクト解決関数を設定
    public setConflictResolver(resolver: ConflictResolver) {
        this.conflictResolver = resolver;
    }

    // エラーハンドラ
    private errorHandler: ((error: Error) => void) | null = null;
    public setErrorHandler(handler: (error: Error) => void) {
        this.errorHandler = handler;
    }

    // lastSyncedAtを取得
    private async getLastSyncedAt(): Promise<Date | null> {
        const state = await db.syncState.get('lastSyncedAt');
        return state?.value ? new Date(state.value) : null;
    }

    // lastSyncedAtを保存
    private async setLastSyncedAt(date: Date) {
        await db.syncState.put({ key: 'lastSyncedAt', value: date.toISOString() });
    }

    // 次回の同期予約
    private nextSyncPromise: Promise<void> | null = null;
    private nextSyncResolve: (() => void) | null = null;
    private nextSyncReject: ((e: any) => void) | null = null;

    public async sync(): Promise<void> {
        // 既に同期中の場合
        if (this.isSyncing) {
            console.log('[SyncManager] Already syncing, queueing next sync...');
            
            // まだ次の予約がない場合、Promiseを作成して待機させる
            if (!this.nextSyncPromise) {
                this.nextSyncPromise = new Promise((resolve, reject) => {
                    this.nextSyncResolve = resolve;
                    this.nextSyncReject = reject;
                });
            }
            return this.nextSyncPromise;
        }

        this.isSyncing = true;
        console.log('[SyncManager] Start syncing...');

        try {
            await this._performSync();
        } catch (e: any) {
            console.error('[SyncManager] Sync failed inside main block', e);
            if (this.errorHandler) {
                console.log('[SyncManager] Calling Global Error Handler');
                this.errorHandler(e instanceof Error ? e : new Error(String(e)));
            } else {
                console.warn('[SyncManager] No error handler registered!');
            }
            throw e;
        } finally {
            this.isSyncing = false;

            // 次の同期予約があるか確認
            if (this.nextSyncPromise) {
                console.log('[SyncManager] Consuming queued sync...');
                
                const resolve = this.nextSyncResolve;
                const reject = this.nextSyncReject;
                
                // 参照をクリア
                this.nextSyncPromise = null;
                this.nextSyncResolve = null;
                this.nextSyncReject = null;

                // 再帰的に実行
                this.sync()
                    .then(resolve)
                    .catch(reject);
            }
        }
    }

    private async _performSync() {
        // 1. Dirty/Deletedメモを取得
        // Dexie might store boolean as boolean, check query compatibility
        let dirtyMemos = await db.memos.where('isDirty').equals(1).toArray();
        if (dirtyMemos.length === 0) {
                // Try querying by boolean true if number 1 failed (just in case)
                dirtyMemos = await db.memos.filter(m => m.isDirty === true).toArray();
        }
        
        const deletedMemos = await db.memos.where('isDeleted').equals(1).toArray();

        console.log(`[SyncManager] Found ${dirtyMemos.length} dirty memos, ${deletedMemos.length} deleted memos`);

        // 2. 最終同期時刻を取得
        const lastSyncedAt = await this.getLastSyncedAt();

        // 3. ローカルに存在するメモIDリスト（削除検知用）
        const allLocalMemos = await db.memos.toArray();
        const localMemoIds = allLocalMemos.filter(m => !m.isDeleted).map(m => m.id);

        const payload = {
            lastSyncedAt: lastSyncedAt?.toISOString() || null,
            pushedMemos: dirtyMemos.filter(m => !m.isDeleted).map(m => ({
                id: m.id,
                title: m.title,
                content: m.content,
                thumbnailPath: m.thumbnailPath,
                updatedAt: m.updatedAt.toISOString(),
                createdAt: m.createdAt.toISOString(),
            })),
            pushedDeletedIds: deletedMemos.map(m => m.id),
            localMemoIds
        };

        const res = await fetch('/api/memos/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`Sync API Failed: ${res.status} ${res.statusText}`);

        const data = await res.json();
        const { updatedMemos, serverDeletedIds, conflicts, serverTime } = data;
        
        console.log(`[SyncManager] Server response: ${updatedMemos.length} updates, ${conflicts.length} conflicts, ${serverDeletedIds.length} deletes`);

        // 4. コンフリクト処理
        for (const conflict of conflicts) {
            if (this.conflictResolver) {
                const localMemo = await db.memos.get(conflict.memoId);
                if (!localMemo) continue;

                const choice = await this.conflictResolver(localMemo, conflict.serverVersion);
                
                if (choice === 'server') {
                    // サーバー版を採用
                    await db.memos.put({
                        id: conflict.serverVersion.id,
                        title: conflict.serverVersion.title,
                        content: conflict.serverVersion.content,
                        thumbnailPath: conflict.serverVersion.thumbnailPath,
                        createdAt: new Date(conflict.serverVersion.createdAt),
                        updatedAt: new Date(conflict.serverVersion.updatedAt),
                        userId: localMemo.userId,
                        isFullContent: true,
                        lastAccessedAt: new Date(),
                        isDirty: false,
                        isDeleted: false
                    });
                } else if (choice === 'cancel') {
                    // キャンセル：何もしない（次回同期時に再度競合となる）
                    continue; 
                } else {
                    // ローカル版を採用 → 再送信（次の同期で）
                    // isDirtyはtrueのまま
                }
            } else {
                console.warn('[SyncManager] Conflict detected but no resolver set:', conflict.memoId);
            }
        }

        // 5. サーバーからの更新を反映
        await db.transaction('rw', db.memos, async () => {
            for (const remote of updatedMemos) {
                const local = await db.memos.get(remote.id);
                
                // ローカルがDirtyでコンフリクト未処理の場合はスキップ
                if (local?.isDirty) continue;
                
                await db.memos.put({
                    id: remote.id,
                    title: remote.title,
                    content: remote.content,
                    createdAt: new Date(remote.createdAt),
                    updatedAt: new Date(remote.updatedAt),
                    thumbnailPath: remote.thumbnailPath,
                    userId: remote.userId,
                    isFullContent: true,
                    lastAccessedAt: new Date(),
                    isDirty: false,
                    isDeleted: false
                });
            }

            // サーバーで消えたメモをローカルから削除
            if (serverDeletedIds.length > 0) {
                await db.memos.bulkDelete(serverDeletedIds);
            }

            // PushしたメモのDirtyフラグを下ろす（コンフリクトでなかったもの）
            const conflictIds = new Set(conflicts.map((c: any) => c.memoId));
            for (const m of dirtyMemos) {
                if (!conflictIds.has(m.id)) {
                    await db.memos.update(m.id, { isDirty: false });
                }
            }
            
            // Deletedメモを完全に消す
            for (const m of deletedMemos) {
                await db.memos.delete(m.id);
            }
        });

        // 6. 最終同期時刻を更新
        await this.setLastSyncedAt(new Date(serverTime));

        // 7. 添付ファイルの同期（未実装）
        await this.syncAttachments();

        console.log('[SyncManager] Sync completed');
    }

    private async syncAttachments() {
        // Placeholder
        const dirtyAttachments = await db.attachments.where('isDirty').equals(1).toArray();
        for (const att of dirtyAttachments) {
            if (!att.blob) continue;
            try {
                console.log('[SyncManager] Uploading attachment...', att.fileName);
                // TODO: 実装
                await db.attachments.update(att.id, { isDirty: false });
            } catch (e) {
                console.error('Attachment upload failed', e);
            }
        }
    }

    public async garbageCollect() {
        console.log('[SyncManager] Running Garbage Collection...');
        const thresholdDate = new Date(Date.now() - LRU_RETENTION_MS);
        
        await db.transaction('rw', db.memos, db.attachments, async () => {
            const oldMemos = await db.memos
                .where('lastAccessedAt').below(thresholdDate)
                .filter(m => !m.isDirty)
                .toArray();
            
            const idsToDelete = oldMemos.map(m => m.id);
            if (idsToDelete.length > 0) {
                console.log(`[SyncManager] GC deleting ${idsToDelete.length} memos`);
                await db.memos.bulkDelete(idsToDelete);
                
                const attachmentsToDelete = await db.attachments
                    .where('memoId').anyOf(idsToDelete)
                    .toArray();
                
                await db.attachments.bulkDelete(attachmentsToDelete.map(a => a.id));
            }
        });
    }
}

// Global accessor
export const syncManager = SyncManager.getInstance();
