import Dexie, { type Table } from 'dexie';

// サーバーと同期するためのステータスを管理
export type SyncStatus = 'created' | 'updated' | 'deleted' | 'synced';

// --- 基本的なデータモデルの型定義 (ローカル用) ---

export interface LocalTask {
  id: string; // uuid
  title: string;
  description?: string | null;
  dueDate?: number | null;
  priority: number;
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

export interface LocalRecurringTask {
  id: string;
  title: string;
  description?: string | null;
  cronExpression: string; // 例: "0 9 * * *" (daily), "0 9 * * 1" (weekly Mon)
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  _syncStatus: SyncStatus;
}

export interface LocalRecurringTemplate {
  id: string;
  recurringTaskId: string;
  title: string;
  orderIdx: number;
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
  recurringTasks!: Table<LocalRecurringTask, string>;
  recurringTemplates!: Table<LocalRecurringTemplate, string>;
  userSettings!: Table<LocalUserSettings, string>;

  constructor() {
    super('RiminiLocalDB');

    // バージョン1: 初期スキーマ
    this.version(1).stores({
      tasks: 'id, isCompleted, createdAt, updatedAt, _syncStatus',
      notes: 'id, createdAt, updatedAt, deletedAt, _syncStatus',
      userSettings: 'id, updatedAt, _syncStatus',
    });

    // バージョン2: タスク詳細・優先度・期限等の追加
    this.version(2).stores({
      tasks: 'id, isCompleted, dueDate, priority, createdAt, updatedAt, _syncStatus',
    });

    // バージョン3: 定期タスク管理テーブルの追加
    this.version(3).stores({
      recurringTasks: 'id, isActive, createdAt, updatedAt, _syncStatus',
      recurringTemplates: 'id, recurringTaskId, _syncStatus',
    });
  }
}

// シングルトンインスタンスとしてエクスポート
export const db = new AppDatabase();
