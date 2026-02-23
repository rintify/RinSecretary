import { db } from './db';

export async function syncData() {
  try {
    // 1. ローカルから未同期のデータ(created, updated, deleted)を抽出
    const unsyncedTasks = await db.tasks.where('_syncStatus').notEqual('synced').toArray();
    const unsyncedUserSettings = await db.userSettings.where('_syncStatus').notEqual('synced').toArray();
    const unsyncedRecurringTasks = await db.recurringTasks.where('_syncStatus').notEqual('synced').toArray();
    const unsyncedRecurringTemplates = await db.recurringTemplates.where('_syncStatus').notEqual('synced').toArray();
    const unsyncedNotes = await db.notes.where('_syncStatus').notEqual('synced').toArray();

    // 2. 前回同期日時の取得
    const lastSyncedAtStr = localStorage.getItem('rimini_last_synced_at');
    const lastSyncedAt = lastSyncedAtStr ? parseInt(lastSyncedAtStr, 10) : 0;

    // 3. APIへ送信 (Push & Pull)
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastSyncedAt,
        changes: {
          tasks: unsyncedTasks,
          userSettings: unsyncedUserSettings,
          recurringTasks: unsyncedRecurringTasks,
          recurringTemplates: unsyncedRecurringTemplates,
          notes: unsyncedNotes,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Sync failed with status: ${response.status}`);
    }

    const { data } = await response.json();
    if (!data) return;

    const { pulledChanges, timestamp } = data;

    // 4. 送信処理が成功したローカルデータの _syncStatus を 'synced' へ更新
    const markSynced = async <T extends { id: string }>(
      table:
        | typeof db.tasks
        | typeof db.userSettings
        | typeof db.recurringTasks
        | typeof db.recurringTemplates
        | typeof db.notes,
      items: T[],
    ) => {
      if (items.length === 0) return;
      await db.transaction('rw', table, async () => {
        for (const item of items) {
          await table.update(item.id, { _syncStatus: 'synced' });
        }
      });
    };

    await markSynced(db.tasks, unsyncedTasks);
    await markSynced(db.userSettings, unsyncedUserSettings);
    await markSynced(db.recurringTasks, unsyncedRecurringTasks);
    await markSynced(db.recurringTemplates, unsyncedRecurringTemplates);
    await markSynced(db.notes, unsyncedNotes);

    // 5. サーバーから受信した新しい/更新されたデータをローカルDBにマージ (UPSERT)
    if (pulledChanges?.tasks?.length) {
      await db.transaction('rw', db.tasks, async () => {
        for (const item of pulledChanges.tasks) {
          await db.tasks.put(item);
        }
      });
    }
    if (pulledChanges?.userSettings?.length) {
      await db.transaction('rw', db.userSettings, async () => {
        for (const item of pulledChanges.userSettings) {
          await db.userSettings.put(item);
        }
      });
    }
    if (pulledChanges?.recurringTasks?.length) {
      await db.transaction('rw', db.recurringTasks, async () => {
        for (const item of pulledChanges.recurringTasks) {
          await db.recurringTasks.put(item);
        }
      });
    }
    if (pulledChanges?.recurringTemplates?.length) {
      await db.transaction('rw', db.recurringTemplates, async () => {
        for (const item of pulledChanges.recurringTemplates) {
          await db.recurringTemplates.put(item);
        }
      });
    }
    if (pulledChanges?.notes?.length) {
      await db.transaction('rw', db.notes, async () => {
        for (const item of pulledChanges.notes) {
          await db.notes.put(item);
        }
      });
    }

    // 6. 同期日時の更新
    if (timestamp) {
      localStorage.setItem('rimini_last_synced_at', timestamp.toString());
    }
  } catch (error) {
    console.error('[Sync Error]:', error);
  }
}
