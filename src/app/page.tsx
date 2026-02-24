'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography } from '@mui/material';
import AppHeader from '@/components/layout/AppHeader';
import DaySwiper from '@/components/DaySwiper';
import ActionFabs from '@/components/layout/ActionFabs';
import type { FabAction } from '@/components/layout/ActionFabs';
import { getBusinessDate } from '@/lib/date-utils';

interface UserInfo {
  id: string;
  name: string;
  nickname: string;
  plan: string;
  dayStartHour: number;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => getBusinessDate());

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json() as Promise<UserInfo>;
      })
      .then((u) => {
        setUser(u);
        // ユーザーのdayStartHourで営業日を再計算
        setCurrentDate(getBusinessDate(u.dayStartHour));
      })
      .catch(() => {
        router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleFabAction = useCallback((action: FabAction) => {
    // TODO: モーダル実装後に各アクションを接続する
    switch (action) {
      case 'NEW_TASK':
      case 'NEW_EVENT':
      case 'NEW_ALARM':
        // 将来的にモーダルを開く
        break;
      case 'MEMOS':
        // 将来的にメモ一覧ページに遷移
        break;
    }
  }, []);

  if (loading) {
    return (
      <Box
        data-testid="loading-indicator"
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh' }}
      >
        <Typography>読み込み中...</Typography>
      </Box>
    );
  }

  if (!user) return null;

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AppHeader currentDate={currentDate} />

      {/* メインコンテンツ: ヘッダー分のマージンを確保 */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', mt: '60px' }}>
        <DaySwiper currentDate={currentDate} onDateChange={setCurrentDate} dayStartHour={user.dayStartHour} />
        <ActionFabs onAction={handleFabAction} />
      </Box>
    </Box>
  );
}
