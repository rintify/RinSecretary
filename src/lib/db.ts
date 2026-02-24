import Dexie, { type EntityTable } from 'dexie';

/** ローカルDB用のイベント型 */
export interface LocalEvent {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  memo?: string;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** ローカルDB用のタスク型 */
export interface LocalTask {
  id: string;
  title: string;
  startAt: Date;
  deadline: Date;
  estimatedSeconds: number;
  data: string; // JSON
  memo?: string;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** ローカルDB用のアラーム型 */
export interface LocalAlarm {
  id: string;
  title: string;
  notifyAt: Date;
  isSent: boolean;
  memo?: string;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

class RiminiDB extends Dexie {
  events!: EntityTable<LocalEvent, 'id'>;
  tasks!: EntityTable<LocalTask, 'id'>;
  alarms!: EntityTable<LocalAlarm, 'id'>;

  constructor() {
    super('rimini');
    this.version(1).stores({
      events: 'id, startAt, endAt, updatedAt',
      tasks: 'id, deadline, startAt, updatedAt',
      alarms: 'id, notifyAt, updatedAt',
    });
  }
}

export const db = new RiminiDB();
