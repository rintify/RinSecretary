import { db } from './db';

export async function syncData() {
  try {
    // 1. ローカルから未同期のデータ(created, updated, deleted)を抽出
    const unsyncedTasks = await db.tasks.where('_syncStatus').notEqual('synced').toArray();

    // 未同期データがゼロで、なおかつ初回同期等でなければスキップしてもよいが
    // サーバー側で変更があったデータ（他デバイスからの更新）を受信するために常にフェッチする

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
    if (unsyncedTasks.length > 0) {
      await db.transaction('rw', db.tasks, async () => {
        for (const t of unsyncedTasks) {
          // ID指定で直接アップデート
          await db.tasks.update(t.id, { _syncStatus: 'synced' });
        }
      });
    }

    // 5. サーバーから受信した新しい/更新されたデータをローカルDBにマージ (UPSERT)
    if (pulledChanges?.tasks && pulledChanges.tasks.length > 0) {
      await db.transaction('rw', db.tasks, async () => {
        for (const serverTask of pulledChanges.tasks) {
          // サーバーからのデータで上書きし、ステータスはsyncedとなる
          await db.tasks.put(serverTask);
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
