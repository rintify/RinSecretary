import { db, ClientMemo } from './db';

const SYNC_INTERVAL_MS = 60 * 1000; // 1分ごとに同期（現在未使用）
// const GC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1日ごとにGC (Removed)
// const LRU_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7日間アクセスがないキャッシュは削除 (Removed/Unused for now)
import { CLIENT_MAX_STORAGE_BYTES, OFFLINE_FILE_SIZE_LIMIT } from '@/lib/constants';

// コンフリクト解決用のコールバック型
export type ConflictResolver = (
    localMemo: ClientMemo,
    serverMemo: { id: string; title: string; content: string; updatedAt: string; createdAt: string; thumbnailPath?: string | null }
) => Promise<'local' | 'server' | 'cancel'>;

// 同期状態の型
export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface SyncState {
    status: SyncStatus;
    online: boolean;
    lastSyncedAt: Date | null;
    isBackgroundCheck: boolean; // ローカル変更がなく、サーバー更新もまだ見つかっていない場合true
}

export type SyncStatusListener = (state: SyncState) => void;


export class SyncManager {
    private static instance: SyncManager;
    private isSyncing = false;
    private isBackgroundCheck = false; // 内部状態
    private online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    private conflictResolver: ConflictResolver | null = null;
    private lastError: Error | null = null;
    private statusListeners: Set<SyncStatusListener> = new Set();
    private lastSyncedAtCache: Date | null = null;
    // 次回の同期予約
    private nextSyncPromise: Promise<void> | null = null;
    private nextSyncResolve: (() => void) | null = null;
    private nextSyncReject: ((e: any) => void) | null = null;

    private constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                this.online = true;
                this.notifyStatusChange();
                this.sync();
            });
            window.addEventListener('offline', () => {
                this.online = false;
                this.notifyStatusChange();
            });
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

    // 同期状態リスナー登録
    public addStatusListener(listener: SyncStatusListener): void {
        this.statusListeners.add(listener);
        // 登録時に現在の状態を通知
        listener(this.getState());
    }

    public removeStatusListener(listener: SyncStatusListener): void {
        this.statusListeners.delete(listener);
    }

    private notifyStatusChange(): void {
        const state = this.getState();
        this.statusListeners.forEach(listener => listener(state));
    }

    public getState(): SyncState {
        let status: SyncStatus = 'idle';
        if (this.isSyncing) {
            status = 'syncing';
        } else if (this.lastError) {
            status = 'error';
        }
        return {
            status,
            online: this.online,
            lastSyncedAt: this.lastSyncedAtCache,
            isBackgroundCheck: this.isSyncing && this.isBackgroundCheck
        };
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
        this.lastError = null;
        
        // Check for local changes first
        const dirtyMemosCount = await db.memos.where('isDirty').equals(1).count() + 
                                (await db.memos.filter(m => m.isDirty === true).count()); // Dexie boolean quirks
        const deletedMemosCount = await db.memos.where('isDeleted').equals(1).count();
        const dirtyAttCount = await db.attachments.filter(a => !!a.isDirty).count();
        const deletedAttCount = await db.attachments.filter(a => !!a.isDeleted).count();
        
        const hasLocalChanges = (dirtyMemosCount > 0 || deletedMemosCount > 0 || dirtyAttCount > 0 || deletedAttCount > 0);
        
        this.isBackgroundCheck = !hasLocalChanges;
        
        this.notifyStatusChange();
        console.log(`[SyncManager] Start syncing... (BackgroundCheck: ${this.isBackgroundCheck})`);

        try {
            let serverUpdatesFound = false;

            // Sequential Sync: メモ同期完了後に添付ファイル同期（レースコンディション回避）
            try {
                const memosUpdated = await this.syncMemos();
                if (memosUpdated) serverUpdatesFound = true;
            } catch (memoError: any) {
                console.error('[SyncManager] Memo sync failed', memoError);
                this.lastError = memoError instanceof Error ? memoError : new Error(String(memoError));
                if (this.errorHandler) {
                    this.errorHandler(this.lastError);
                }
            }
            
            // If we found server updates, we are no longer just checking
            if (serverUpdatesFound && this.isBackgroundCheck) {
                this.isBackgroundCheck = false;
                this.notifyStatusChange();
            }

            try {
                const attUpdated = await this.syncAttachments();
                if (attUpdated) serverUpdatesFound = true;
            } catch (attachmentError: any) {
                console.error('[SyncManager] Attachment sync failed', attachmentError);
                this.lastError = attachmentError instanceof Error ? attachmentError : new Error(String(attachmentError));
                // 添付ファイル同期失敗時もユーザーに通知
                if (this.errorHandler) {
                    this.errorHandler(this.lastError);
                }
            }

            // Re-check for notification if attachment found updates
            if (serverUpdatesFound && this.isBackgroundCheck) {
                this.isBackgroundCheck = false;
                this.notifyStatusChange();
            }

            // 同期成功時にキャッシュを更新
            if (!this.lastError) {
                this.lastSyncedAtCache = new Date();
            }

        } catch (e: any) {
            console.error('[SyncManager] Critical Sync Error', e);
            this.lastError = e instanceof Error ? e : new Error(String(e));
        } finally {
            this.isSyncing = false;
            this.isBackgroundCheck = false;
            this.notifyStatusChange();

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

    private async syncMemos(): Promise<boolean> {
        console.log('[SyncManager] Syncing Memos...');
        // 1. Dirty/Deletedメモを取得
        let dirtyMemos = await db.memos.where('isDirty').equals(1).toArray();
        if (dirtyMemos.length === 0) {
                dirtyMemos = await db.memos.filter(m => m.isDirty === true).toArray();
        }
        
        const deletedMemos = await db.memos.where('isDeleted').equals(1).toArray();

        // 2. 最終同期時刻を取得
        const lastSyncedAt = await this.getLastSyncedAt();

        // localMemoIds は廃止（通信量削減のため）
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
        };

        const res = await fetch('/api/memos/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`Sync API Failed: ${res.status} ${res.statusText}`);

        const data = await res.json();
        const { updatedMemos, serverDeletedIds, conflicts, serverTime } = data;
        
        // Check if any work was done
        const hasWork = updatedMemos.length > 0 || serverDeletedIds.length > 0 || conflicts.length > 0;
        
        if (hasWork && this.isBackgroundCheck) {
            this.isBackgroundCheck = false;
            this.notifyStatusChange();
        }

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
                    await db.memos.update(localMemo.id, { 
                        updatedAt: new Date(),
                        isDirty: true 
                    });
                }
            } else {
                console.warn('[SyncManager] Conflict detected but no resolver set:', conflict.memoId);
            }
        }

        // 5. サーバーからの更新通知を処理
        const pushedMemoIds = new Set(dirtyMemos.map(m => m.id));
        
        await db.transaction('rw', db.memos, db.attachments, async () => {
            for (const remote of updatedMemos) {
                const local = await db.memos.get(remote.id);
                // ローカルに存在しない → 無視（キャッシュしない）
                if (!local) continue;
                // ローカルがDirtyの場合はスキップ
                if (local.isDirty) continue;
                // 自分がプッシュしたメモはスキップ
                if (pushedMemoIds.has(remote.id)) continue;
                
                const serverUpdatedAt = new Date(remote.updatedAt);
                if (serverUpdatedAt > local.updatedAt) {
                    await db.memos.update(remote.id, {
                        title: remote.title,
                        updatedAt: serverUpdatedAt,
                        thumbnailPath: remote.thumbnailPath,
                        isFullContent: false,
                        lastAccessedAt: new Date(),
                    });
                }
            }

            // サーバーで消えたメモをローカルから削除
            if (serverDeletedIds.length > 0) {
                for (const memoId of serverDeletedIds) {
                    await db.attachments.where('memoId').equals(memoId).delete();
                }
                await db.memos.bulkDelete(serverDeletedIds);
            }

            // PushしたメモのDirtyフラグを下ろす（同期中に変更されていない場合のみ）
            const conflictIds = new Set(conflicts.map((c: any) => c.memoId));
            for (const m of dirtyMemos) {
                if (conflictIds.has(m.id)) continue;

                // 現在の最新状態を取得して比較（CAS: Compare and Swap）
                const current = await db.memos.get(m.id);
                // メモが存在し、かつ更新時刻が変わっていない場合のみDirtyを下ろす
                // つまり、同期処理中にユーザーが編集した場合はDirtyのまま維持する
                if (current && current.updatedAt.getTime() === m.updatedAt.getTime()) {
                     await db.memos.update(m.id, { isDirty: false });
                } else {
                    console.log(`[SyncManager] Memo ${m.id} was modified during sync. Keeping dirty.`);
                }
            }
            
            // Deletedメモと関連添付ファイルを完全に消す
            for (const m of deletedMemos) {
                // ここも同様に、同期中に変更(復元など)されていたら消さない方が安全だが、
                // 論理削除は通常一方通行なので、一旦そのままにする（改善の余地あり）
                await db.attachments.where('memoId').equals(m.id).delete();
                await db.memos.delete(m.id);
            }
        });

        // 6. 最終同期時刻を更新
        await this.setLastSyncedAt(new Date(serverTime));
        
        return hasWork;
    }

    private async syncAttachments(): Promise<boolean> {
        if (!this.online) return false;
        console.log('[SyncManager] Syncing Attachments...');

        let errorCount = 0;
        let firstError: Error | null = null;
        let workDone = false;

        // 1. Upload Dirty Attachments
        const dirtyAttachments = await db.attachments
            .filter(a => !!a.isDirty && !!a.blob)
            .toArray();

        for (const att of dirtyAttachments) {
            workDone = true;
            try {
                console.log(`[SyncManager] Uploading attachment: ${att.fileName} (${att.id})`);
                
                const formData = new FormData();
                const file = new File([att.blob!], att.fileName, { type: att.mimeType });
                formData.append('file', file);
                formData.append('id', att.id);

                const { uploadAttachment } = await import('@/app/memos/actions');
                const uploaded = await uploadAttachment(formData, att.memoId);
                
                await db.attachments.update(att.id, {
                    filePath: uploaded.filePath,
                    isDirty: false,
                });
                
            } catch (e: any) {
                console.error(`[SyncManager] Failed to upload attachment ${att.id}`, e);
                errorCount++;
                if (!firstError) firstError = e instanceof Error ? e : new Error(String(e));
            }
        }

        // 2. Delete Deleted Attachments
        const deletedAttachments = await db.attachments
            .filter(a => !!a.isDeleted)
            .toArray();

        for (const att of deletedAttachments) {
            workDone = true;
            try {
                console.log(`[SyncManager] Deleting attachment: ${att.fileName} (${att.id})`);
                
                const { deleteAttachment } = await import('@/app/memos/actions');
                await deleteAttachment(att.id);

                await db.attachments.delete(att.id);
                
            } catch (e: any) {
                console.error(`[SyncManager] Failed to delete attachment ${att.id}`, e);
                errorCount++;
                if (!firstError) firstError = e instanceof Error ? e : new Error(String(e));
            }
        }

        // 3. Pull new attachments from server
        try {
            const pulled = await this.pullAttachmentsFromServer();
            if (pulled) workDone = true;
        } catch (e: any) {
             console.error('[SyncManager] Failed to pull attachments', e);
             errorCount++;
             if (!firstError) firstError = e instanceof Error ? e : new Error(String(e));
        }

        if (errorCount > 0 && firstError) {
            throw new Error(`Attachment sync failed with ${errorCount} errors. First error: ${firstError.message}`);
        }
        
        return workDone;
    }

    private async pullAttachmentsFromServer(): Promise<boolean> {
        try {
            const lastSyncState = await db.syncState.get('lastAttachmentSyncedAt');
            const lastSyncedAt = lastSyncState?.value || null;

            const res = await fetch('/api/attachments/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lastSyncedAt })
            });

            if (!res.ok) {
                throw new Error(`Attachment sync API failed: ${res.status} ${res.statusText}`);
            }

            const data = await res.json();
            const { attachments, deletedAttachmentIds, serverTime } = data;

            const hasWork = attachments.length > 0 || (deletedAttachmentIds && deletedAttachmentIds.length > 0);

            console.log(`[SyncManager] Received ${attachments.length} attachments from server`);

            for (const serverAtt of attachments) {
                const existing = await db.attachments.get(serverAtt.id);
                
                if (!existing) {
                    await db.attachments.put({
                        id: serverAtt.id,
                        memoId: serverAtt.memoId,
                        fileName: serverAtt.fileName,
                        mimeType: serverAtt.mimeType,
                        fileSize: serverAtt.fileSize,
                        filePath: serverAtt.filePath,
                        createdAt: new Date(serverAtt.createdAt),
                        lastAccessedAt: new Date(),
                        isDirty: false,
                        isDeleted: false,
                    });
                    console.log(`[SyncManager] Added attachment from server: ${serverAtt.fileName}`);
                }
            }

            if (deletedAttachmentIds && deletedAttachmentIds.length > 0) {
                await db.attachments.bulkDelete(deletedAttachmentIds);
                console.log(`[SyncManager] Deleted ${deletedAttachmentIds.length} attachments from local DB`);
            }

            await db.syncState.put({ key: 'lastAttachmentSyncedAt', value: serverTime });
            
            return hasWork;

        } catch (e) {
            console.error('[SyncManager] Failed to pull attachments from server', e);
            throw e; 
        }
    }


    public async checkAndGC(requiredSize: number) {
        // Calculate current usage
        let totalSize = 0;
        const attachments = await db.attachments.filter(a => !!a.blob).toArray();
        for (const a of attachments) {
            totalSize += a.blob?.size || 0;
        }

        const limit = CLIENT_MAX_STORAGE_BYTES;
        if (totalSize + requiredSize > limit) {
             const needed = (totalSize + requiredSize) - limit;
             console.log(`[SyncManager] Storage limit exceeded. Need to free ${needed} bytes.`);
             await this.garbageCollect(needed);
        }
    }



    private async garbageCollect(neededBytes: number = 0) {
        console.log(`[SyncManager] Running Size-Based GC (Needed: ${neededBytes} bytes)...`);
        
        let freed = 0;
        
        await db.transaction('rw', db.attachments, async () => {
             // Find candidates: Synced files (isDirty: false) with blobs, sorted by LRU (oldest first)
             const candidates = await db.attachments
                .where('isDirty').equals(0) // false
                .filter(a => !!a.blob)
                .sortBy('lastAccessedAt'); // Ascending: oldest first
            
             for (const att of candidates) {
                 if (freed >= neededBytes && neededBytes > 0) break;
                 
                 const size = att.blob?.size || 0;
                 await db.attachments.update(att.id, { blob: undefined });
                 freed += size;
                 console.log(`[SyncManager] GC Evicted blob: ${att.fileName} (${size} bytes)`);
             }
        });
        
        console.log(`[SyncManager] GC Finished. Freed ${freed} bytes.`);
    }
}

// Global accessor
export const syncManager = SyncManager.getInstance();
