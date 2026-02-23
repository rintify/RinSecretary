import Dexie, { type Table } from 'dexie';

// サーバーと同期するためのステータスを管理
export type SyncStatus = 'created' | 'updated' | 'deleted' | 'synced';

// --- 基本的なデータモデルの型定義 (ローカル用) ---

export interface LocalTask {
  id: string; // uuid
  title: string;
  isCompleted: boolean;
  createdAt: number; // Unix timestamp for simpler local handling
  updatedAt: number;
  _syncStatus: SyncStatus;
}

export interface LocalNote {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  _syncStatus: SyncStatus;
}

export interface LocalUserSettings {
  id: string; // 通常は 'default' 等、ユーザーにつき1レコード
  aiProvider: string;
  updatedAt: number;
  _syncStatus: SyncStatus;
}

export class AppDatabase extends Dexie {
  tasks!: Table<LocalTask, string>;
  notes!: Table<LocalNote, string>;
  userSettings!: Table<LocalUserSettings, string>;

  constructor() {
    super('RiminiLocalDB');

    // スキーマの定義（インデックスを貼るキーのみ指定する）
    this.version(1).stores({
      tasks: 'id, isCompleted, createdAt, updatedAt, _syncStatus',
      notes: 'id, createdAt, updatedAt, deletedAt, _syncStatus',
      userSettings: 'id, updatedAt, _syncStatus',
    });
  }
}

// シングルトンインスタンスとしてエクスポート
export const db = new AppDatabase();
