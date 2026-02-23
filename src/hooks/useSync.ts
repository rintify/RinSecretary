'use client';

import { useEffect, useState, useCallback } from 'react';
import { syncData } from '@/lib/sync';
import { useSession } from 'next-auth/react';

export function useSync(intervalMs = 15000) {
  const { data: session } = useSession();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const triggerSync = useCallback(async () => {
    // ログインしていない場合は同期しない
    if (!session?.user) return;

    setIsSyncing(true);
    try {
      await syncData();
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Manual sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [session]);

  // マウント時と定期的なポーリングによる自動同期
  useEffect(() => {
    if (!session?.user) return;

    // 初回マウント時同期
    triggerSync();

    // ポーリング間隔での同期
    const intervalId = setInterval(() => {
      triggerSync();
    }, intervalMs);

    // オンライン復帰時の即時同期イベントリスナー
    const handleOnline = () => {
      triggerSync();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
    };
  }, [session, intervalMs, triggerSync]);

  return { isSyncing, lastSyncTime, triggerSync };
}
