'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Button, AppBar, Toolbar } from '@mui/material';

interface UserInfo {
  id: string;
  name: string;
  nickname: string;
  plan: string;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json() as Promise<UserInfo>;
      })
      .then(setUser)
      .catch(() => {
        router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

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
    <Box sx={{ minHeight: '100dvh' }}>
      <AppBar position="sticky">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }} data-testid="header-title">
            Rimini
          </Typography>
          <Button color="inherit" onClick={handleLogout} data-testid="logout-button">
            ログアウト
          </Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 2 }}>
        <Typography variant="h5" data-testid="welcome-message">
          ようこそ、{user.nickname}さん
        </Typography>
      </Box>
    </Box>
  );
}
