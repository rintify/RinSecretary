'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, TextField, Button, Alert, Paper } from '@mui/material';

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        setError(data.error || 'ログインに失敗しました');
        return;
      }

      router.replace('/');
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100dvh',
        px: 2,
        bgcolor: 'background.default',
      }}
    >
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 400 }} data-testid="login-form">
        <Typography variant="h5" component="h1" sx={{ mb: 3, textAlign: 'center' }}>
          Rimini
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="login-error">
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="ユーザー名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            margin="normal"
            required
            autoComplete="username"
            inputProps={{ 'data-testid': 'login-name-input' }}
          />
          <TextField
            fullWidth
            label="パスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
            autoComplete="current-password"
            inputProps={{ 'data-testid': 'login-password-input' }}
          />
          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ mt: 2 }}
            data-testid="login-submit-button"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
