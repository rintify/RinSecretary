import Dexie, { Table } from 'dexie';

export interface ClientMemo {
    id: string;
    title: string;
    content: string; // isFullContent=falseの場合は、一覧表示用の短い文字列または空文字が入る可能性あり
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    thumbnailPath?: string | null;
    
    // Sync Metadata
    isDirty?: boolean; // 未同期の変更があるか（ローカルで編集された）
    isDeleted?: boolean; // 削除済み（同期待ち）か
    
    // LRU & Display Metadata
    lastAccessedAt: Date; // 最終閲覧日時（LRU用）
    isFullContent: boolean; // サーバーから詳細（全文）を取得済みか。Falseなら一覧用データのみ。
}

export interface ClientAttachment {
    id: string;
    memoId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    createdAt: Date;
    
    // File Content
    blob?: Blob; // ローカルでのファイル実体。LRU対象になりうる
    isDirty?: boolean; // 未アップロードのファイルか
    
    lastAccessedAt: Date; // 添付ファイルのLRU用
}

export interface SyncState {
    key: string; // 'lastSyncTime' etc
    value: any;
}

export class RinSecretaryDatabase extends Dexie {
    memos!: Table<ClientMemo>;
    attachments!: Table<ClientAttachment>;
    syncState!: Table<SyncState>;

    constructor() {
        super('RinSecretaryDB');
        
        // バージョンアップ: スキーマ変更時はバージョンを上げてください
        // Version 1 initialized just now, so we can overwrite or update 
        this.version(3).stores({
            memos: 'id, userId, updatedAt, isDirty, isDeleted, lastAccessedAt', // Added isDeleted
            attachments: 'id, memoId, isDirty, lastAccessedAt',
            syncState: 'key'
        });
    }
}

export const db = new RinSecretaryDatabase();
