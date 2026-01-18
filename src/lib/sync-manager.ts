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
}

export type SyncStatusListener = (state: SyncState) => void;


export class SyncManager {
    private static instance: SyncManager;
    private isSyncing = false;
    private online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    private conflictResolver: ConflictResolver | null = null;
    private lastError: Error | null = null;
    private statusListeners: Set<SyncStatusListener> = new Set();
    private lastSyncedAtCache: Date | null = null;


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

            // Periodic GC Removed
            // setInterval(() => this.garbageCollect(), GC_INTERVAL_MS);
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
            lastSyncedAt: this.lastSyncedAtCache
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
        this.lastError = null;
        this.notifyStatusChange();
        console.log('[SyncManager] Start syncing...');

        try {
            // Sequential Sync: メモ同期完了後に添付ファイル同期（レースコンディション回避）
            try {
                await this.syncMemos();
            } catch (memoError: any) {
                console.error('[SyncManager] Memo sync failed', memoError);
                this.lastError = memoError instanceof Error ? memoError : new Error(String(memoError));
                if (this.errorHandler) {
                    this.errorHandler(this.lastError);
                }
            }
            
            try {
                await this.syncAttachments();
            } catch (attachmentError: any) {
                console.error('[SyncManager] Attachment sync failed', attachmentError);
                this.lastError = attachmentError instanceof Error ? attachmentError : new Error(String(attachmentError));
                // 添付ファイル同期失敗時もユーザーに通知
                if (this.errorHandler) {
                    this.errorHandler(this.lastError);
                }
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

    private async syncMemos() {
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
                    // IMPORTANT: Update local timestamp to now so it wins next time (or at least looks newer)
                    // Server logic: if (existing.updatedAt > client.updatedAt) conflict;
                    // So we must ensure client.updatedAt > existing.updatedAt(Server)
                    await db.memos.update(localMemo.id, { 
                        updatedAt: new Date(), // Update to NOW
                        isDirty: true 
                    });
                }
            } else {
                console.warn('[SyncManager] Conflict detected but no resolver set:', conflict.memoId);
            }
        }

        // 5. サーバーからの更新通知を処理（キャッシュ済みメモのみ対象）
        // サーバーはメタデータのみ返す（contentなし）ので、キャッシュ済みで更新があるものは
        // isFullContent を false にして、次回詳細画面で再取得させる
        
        // 自分がプッシュしたメモのIDセット（これらはサーバーからの更新でupdatedAtを上書きしない）
        const pushedMemoIds = new Set(dirtyMemos.map(m => m.id));
        
        await db.transaction('rw', db.memos, async () => {
            for (const remote of updatedMemos) {
                const local = await db.memos.get(remote.id);
                
                // ローカルに存在しない → 無視（キャッシュしない）
                if (!local) continue;
                
                // ローカルがDirtyの場合はスキップ（ローカル変更を優先）
                if (local.isDirty) continue;
                
                // 自分がプッシュしたメモはスキップ（サーバーのupdatedAtで上書きしない）
                // これにより、保存直後のsyncで自分の保存時刻が上書きされるのを防ぐ
                if (pushedMemoIds.has(remote.id)) continue;
                
                // サーバーの方が新しい場合、キャッシュを無効化
                const serverUpdatedAt = new Date(remote.updatedAt);
                if (serverUpdatedAt > local.updatedAt) {
                    await db.memos.update(remote.id, {
                        title: remote.title,
                        updatedAt: serverUpdatedAt,
                        thumbnailPath: remote.thumbnailPath,
                        isFullContent: false,  // 再取得が必要
                        lastAccessedAt: new Date(),
                    });
                }
            }

            // サーバーで消えたメモをローカルから削除（関連添付ファイルも）
            if (serverDeletedIds.length > 0) {
                for (const memoId of serverDeletedIds) {
                    await db.attachments.where('memoId').equals(memoId).delete();
                }
                await db.memos.bulkDelete(serverDeletedIds);
            }

            // PushしたメモのDirtyフラグを下ろす（コンフリクトでなかったもの）
            const conflictIds = new Set(conflicts.map((c: any) => c.memoId));
            for (const m of dirtyMemos) {
                if (!conflictIds.has(m.id)) {
                    // Check if we updated this memo during conflict resolution (Local wins)
                    // If so, it might have a NEW dirty state, so verify before clearing?
                    // But here we are clearing the 'dirtyMemos' list snapshot.
                    // If we updated it in step 4, it is dirty AGAIN, but 'm' is the old snapshot.
                    // We should only clear dirty if the DB state hasn't changed since snapshot?
                    // Simplify: Just clear dirty=false. If step 4 set it to true, it was a separate update.
                    // BUT: 'db.memos.update' in Step 4 runs AFTER this loop? No, Step 4 runs BEFORE Step 5.
                    // So if Step 4 set isDirty=true, we might overwrite it here with isDirty=false?
                    // Wait, 'dirtyMemos' contains the memos AS OF START.
                    // If we resolved conflict as 'local', we updated db.memos with NEW timestamp and isDirty=true.
                    // If we run `await db.memos.update(m.id, { isDirty: false })` here, we overwrite that.
                    // FIX: Check if it was a conflict.
                    
                    // Actually, if it was a conflict, 'conflictIds' HAS it. So we skip this block.
                    // If it was NOT a conflict, then our push was successful.
                    await db.memos.update(m.id, { isDirty: false });
                }
            }
            
            // Deletedメモと関連添付ファイルを完全に消す
            for (const m of deletedMemos) {
                await db.attachments.where('memoId').equals(m.id).delete();
                await db.memos.delete(m.id);
            }
        });

        // 6. 最終同期時刻を更新
        // If there were conflicts resolved as 'local', we technically haven't fully synced their state to server yet (next sync will).
        // But we can update lastSyncedAt to serverTime because we pulled all updates.
        await this.setLastSyncedAt(new Date(serverTime));
    }

    private async syncAttachments() {
        if (!this.online) return; // Can't upload/download if offline
        console.log('[SyncManager] Syncing Attachments...');

        // 1. Upload Dirty Attachments
        const dirtyAttachments = await db.attachments
            .filter(a => !!a.isDirty && !!a.blob)
            .toArray();

        for (const att of dirtyAttachments) {
            try {
                console.log(`[SyncManager] Uploading attachment: ${att.fileName} (${att.id})`);
                
                const formData = new FormData();
                // Create File object from Blob
                const file = new File([att.blob!], att.fileName, { type: att.mimeType });
                formData.append('file', file);
                formData.append('id', att.id);

                
                // We need to call the server action. 
                // Since this runs on client, we can import server action.
                // Dynamic import to avoid issues during SSR if this file is loaded there? 
                // No, this is client side code.
                const { uploadAttachment, deleteAttachment } = await import('@/app/memos/actions');
                
                // Restore att.memoId argument
                const uploaded = await uploadAttachment(formData, att.memoId);
                
                // Update Local DB
                await db.attachments.update(att.id, {
                    filePath: uploaded.filePath,
                    isDirty: false,
                    // We KEEP the blob for offline viewing (until GC)
                    // localUrl? We might want to clear it if we rely on filePath, 
                    // but for consistent offline exp, keep using blob if available.
                });
                
            } catch (e) {
                console.error(`[SyncManager] Failed to upload attachment ${att.id}`, e);
                // Keep isDirty=true, try next time
            }
        }

        // 2. Delete Deleted Attachments
        const deletedAttachments = await db.attachments
            .filter(a => !!a.isDeleted)
            .toArray();

        for (const att of deletedAttachments) {
            try {
                console.log(`[SyncManager] Deleting attachment: ${att.fileName} (${att.id})`);
                
                const { deleteAttachment } = await import('@/app/memos/actions');
                await deleteAttachment(att.id);

                // Remove from Local DB completely
                await db.attachments.delete(att.id);
                
            } catch (e) {
                console.error(`[SyncManager] Failed to delete attachment ${att.id}`, e);
                // Keep exists (isDeleted=true) to retry
            }
        }

        // 3. Pull new attachments from server
        await this.pullAttachmentsFromServer();
    }

    private async pullAttachmentsFromServer() {
        try {
            // Get last attachment sync time
            const lastSyncState = await db.syncState.get('lastAttachmentSyncedAt');
            const lastSyncedAt = lastSyncState?.value || null;

            const res = await fetch('/api/attachments/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lastSyncedAt })
            });

            if (!res.ok) {
                console.error('[SyncManager] Attachment sync API failed:', res.status);
                return;
            }

            const data = await res.json();
            const { attachments, deletedAttachmentIds, serverTime } = data;

            console.log(`[SyncManager] Received ${attachments.length} attachments from server`);

            // Add new attachments to local DB (without blob - will be fetched on demand)
            for (const serverAtt of attachments) {
                const existing = await db.attachments.get(serverAtt.id);
                
                if (!existing) {
                    // New attachment from server
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
                        // blob is undefined - will be fetched by SW on first access
                    });
                    console.log(`[SyncManager] Added attachment from server: ${serverAtt.fileName}`);
                }
            }

            // サーバーで削除された添付ファイルをローカルから削除
            if (deletedAttachmentIds && deletedAttachmentIds.length > 0) {
                await db.attachments.bulkDelete(deletedAttachmentIds);
                console.log(`[SyncManager] Deleted ${deletedAttachmentIds.length} attachments from local DB`);
            }

            // Update last sync time
            await db.syncState.put({ key: 'lastAttachmentSyncedAt', value: serverTime });

        } catch (e) {
            console.error('[SyncManager] Failed to pull attachments from server', e);
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
