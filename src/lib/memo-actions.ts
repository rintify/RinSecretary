import { db, ClientMemo, ClientAttachment } from './db';

import { extractTitle, extractThumbnail, generateAttachmentMarkdown } from './memo-utils';
import { getExtension } from './file-utils';
import { syncManager } from './sync-manager';

// ---- Types ----

export interface CreateMemoParams {
    id?: string;
    content: string;
    userId: string;
    title?: string;
    thumbnailPath?: string | null;
}

export interface SaveMemoParams {
    id: string;
    content: string;
    userId: string;
    title?: string;
    thumbnailPath?: string | null;
}

export interface AddAttachmentParams {
    id?: string;
    memoId: string;
    file: File | Blob;
    fileName: string;
    filePath?: string;
}

// ---- Memo Actions ----

/**
 * 新しいメモをローカルに作成する
 * 
 * @returns 作成したメモのID
 */
export async function createMemoLocally(params: CreateMemoParams): Promise<string> {
    const id = params.id || crypto.randomUUID();
    const now = new Date();
    const title = params.title || extractTitle(params.content);
    const thumbnailPath = params.thumbnailPath ?? extractThumbnail(params.content);

    
    await db.memos.add({
        id,
        title,
        content: params.content,
        userId: params.userId,
        thumbnailPath,
        createdAt: now,
        updatedAt: now,
        isFullContent: true,
        lastAccessedAt: now,
        isDirty: true,
        isDeleted: false,
    });
    
    return id;
}

/**
 * メモをローカルに保存する（Upsert）
 * 既存のメモがあれば更新、なければ作成
 * 
 * @returns 保存したメモ
 */
export async function saveMemoLocally(params: SaveMemoParams): Promise<ClientMemo> {
    const now = new Date();
    const title = params.title || extractTitle(params.content);
    const thumbnailPath = params.thumbnailPath ?? extractThumbnail(params.content);
    

    const existing = await db.memos.get(params.id);
    
    if (existing) {
        const updated: ClientMemo = {
            ...existing,
            title,
            content: params.content,
            thumbnailPath,
            updatedAt: now,
            isDirty: true,
            lastAccessedAt: now,
            isFullContent: true,
            isDeleted: false,
        };
        await db.memos.put(updated);
        return updated;
    } else {
        const newMemo: ClientMemo = {
            id: params.id,
            title,
            content: params.content,
            userId: params.userId,
            thumbnailPath,
            createdAt: now,
            updatedAt: now,
            isDirty: true,
            lastAccessedAt: now,
            isFullContent: true,
            isDeleted: false,
        };
        await db.memos.add(newMemo);
        return newMemo;
    }
}

/**
 * メモを論理削除する（添付ファイルも含む）
 * サーバー同期時に物理削除される
 * 
 * @param memoId 削除対象のメモID
 */
export async function deleteMemoLocally(memoId: string): Promise<void> {
    await db.transaction('rw', [db.memos, db.attachments], async () => {
        // メモを論理削除
        await db.memos.update(memoId, { isDeleted: true, isDirty: true });
        
        // 関連する添付ファイルも論理削除（サーバー同期時に削除される）
        await db.attachments.where('memoId').equals(memoId).modify({
            isDeleted: true,
            isDirty: true
        });
    });
}

/**
 * 複数のメモを論理削除する（添付ファイルも含む）
 * 
 * @param memoIds 削除対象のメモIDリスト
 */
export async function deleteMemosLocally(memoIds: string[]): Promise<void> {
    await db.transaction('rw', [db.memos, db.attachments], async () => {
        for (const memoId of memoIds) {
            await db.memos.update(memoId, { isDeleted: true, isDirty: true });
            await db.attachments.where('memoId').equals(memoId).modify({
                isDeleted: true,
                isDirty: true
            });
        }
    });
}

// ---- Attachment Actions ----

/**
 * 添付ファイルをローカルに追加する
 * 
 * @returns 追加した添付ファイルのID
 */
export async function addAttachmentLocally(params: AddAttachmentParams): Promise<string> {
    const id = params.id || crypto.randomUUID();
    const now = new Date();
    const file = params.file;
    const ext = getExtension(params.fileName);
    const filePath = params.filePath || `/api/uploads/${id}.${ext}`;
    
    await db.attachments.add({
        id,
        memoId: params.memoId,
        fileName: params.fileName,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        createdAt: now,
        blob: file,
        isDirty: true,
        lastAccessedAt: now,
        filePath,
    });
    
    return id;
}

/**
 * 添付ファイルをローカルに保存する（Upsert）
 * 
 * @param attachment 保存する添付ファイルオブジェクト
 */
export async function upsertAttachmentLocally(attachment: ClientAttachment): Promise<void> {
    await db.attachments.put(attachment);
}

/**
 * メモと添付ファイルをまとめてローカルに作成する（ファイルドロップ用）
 * 
 * @returns 作成したメモのIDと添付ファイルのID
 */
export async function createMemoWithAttachmentLocally(params: {
    memoId?: string;
    attachmentId?: string;
    file: File;
    userId: string;
}): Promise<{ memoId: string; attachmentId: string; filePath: string }> {
    const memoId = params.memoId || crypto.randomUUID();
    const attachmentId = params.attachmentId || crypto.randomUUID();
    const now = new Date();
    
    const ext = getExtension(params.file.name);
    const filePath = `/api/uploads/${attachmentId}.${ext}`;
const markdown = generateAttachmentMarkdown(params.file.name, filePath, params.file.type || 'application/octet-stream');
    
    const title = extractTitle(markdown);
    const thumbnailPath = extractThumbnail(markdown);
    
    await db.transaction('rw', [db.memos, db.attachments], async () => {
        await db.memos.add({
            id: memoId,
            title,
            content: markdown,
            userId: params.userId,
            thumbnailPath,
            createdAt: now,
            updatedAt: now,
            isFullContent: true,
            lastAccessedAt: now,
            isDirty: true,
            isDeleted: false,
        });

        await db.attachments.add({
            id: attachmentId,
            memoId,
            fileName: params.file.name,
            fileSize: params.file.size,
            mimeType: params.file.type || 'application/octet-stream',
            createdAt: now,
            blob: params.file,
            isDirty: true,
            lastAccessedAt: now,
            filePath,
        });
    });
    
    return { memoId, attachmentId, filePath };
}

// ---- Helper Functions (Removed: using memo-utils.ts instead)

// ---- Cache Actions ----

export interface CacheMemoFromServerParams {
    id: string;
    title?: string;
    content: string;
    createdAt: Date | string;
    updatedAt: Date | string;
    userId: string;
}

/**
 * サーバーから取得したメモをローカルにキャッシュする
 * ローカルに未同期な変更がある場合は上書きしない
 * 
 * @returns キャッシュが更新されたかどうか
 */
export async function cacheMemoFromServer(memo: CacheMemoFromServerParams): Promise<boolean> {
    if (!memo.id) return false;
    
    const existing = await db.memos.get(memo.id);
    
    // ローカルに未同期の変更がある場合は上書きしない
    if (existing?.isDirty) {
        return false;
    }
    
    const serverUpdatedAt = new Date(memo.updatedAt);
    
    // ローカルにない、または古い、またはフルコンテンツ未取得の場合はキャッシュ
    if (!existing || existing.updatedAt < serverUpdatedAt || !existing.isFullContent) {
        try {
            await db.memos.put({
                id: memo.id,
                title: memo.title || '無題のメモ',
                content: memo.content,
                createdAt: new Date(memo.createdAt),
                updatedAt: serverUpdatedAt,
                userId: memo.userId,
                isFullContent: true,
                lastAccessedAt: new Date(),
                isDirty: false,
            });
            return true;
        } catch (e) {
            console.error('Failed to cache memo from server', e);
            return false;
        }
    } else {
        // アクセス日時のみ更新
        await db.memos.update(memo.id, { lastAccessedAt: new Date() });
        return false;
    }
}

// ---- Attachment Delete Actions ----

/**
 * 添付ファイルを削除する
 * - ローカルのみ (isDirty) の場合は即座に物理削除
 * - サーバーに同期済みの場合はオンラインなら即削除、オフラインなら論理削除
 * 
 * @param attachmentId 削除対象の添付ファイルID
 * @param deleteFromServer サーバーから削除する関数（オプション、オンライン時に使用）
 */
export async function deleteAttachmentLocally(
    attachmentId: string,
    deleteFromServer?: (id: string) => Promise<void>
): Promise<void> {
    const local = await db.attachments.get(attachmentId);
    
    if (!local) return;
    
    if (local.isDirty) {
        // ローカルのみ（未同期）の場合は即座に物理削除
        await db.attachments.delete(attachmentId);
    } else {
        // サーバーに同期済みの場合
        if (syncManager.isOnline() && deleteFromServer) {
            try {
                await deleteFromServer(attachmentId);
                await db.attachments.delete(attachmentId);
            } catch (e) {
                // サーバー削除失敗時は論理削除にフォールバック
                await db.attachments.update(attachmentId, { isDeleted: true, isDirty: true });
            }
        } else {
            // オフライン時は論理削除
            await db.attachments.update(attachmentId, { isDeleted: true, isDirty: true });
        }
    }
}
