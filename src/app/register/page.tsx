'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Box, Typography, TextField, Button, Alert, Paper, Link as MuiLink } from '@mui/material';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, nickname, password }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        setError(data.error || 'アカウント作成に失敗しました');
        return;
      }

      // アカウント作成・自動ログイン成功後はメインページへ遷移
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
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 400 }} data-testid="register-form">
        <Typography variant="h5" component="h1" sx={{ mb: 3, textAlign: 'center' }}>
          アカウント作成
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="register-error">
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="ユーザー名 (3〜15文字の半角英数字等)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            margin="normal"
            required
            autoComplete="username"
            inputProps={{
              'data-testid': 'register-name-input',
              minLength: 3,
              maxLength: 15,
              pattern: '^[a-zA-Z0-9_\\-]+$',
            }}
          />
          <TextField
            fullWidth
            label="ニックネーム (表示名)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            margin="normal"
            required
            autoComplete="nickname"
            inputProps={{ 'data-testid': 'register-nickname-input', maxLength: 50 }}
          />
          <TextField
            fullWidth
            label="パスワード (8文字以上)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
            autoComplete="new-password"
            inputProps={{ 'data-testid': 'register-password-input', minLength: 8 }}
          />
          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ mt: 3, mb: 2 }}
            data-testid="register-submit-button"
          >
            {loading ? '登録中...' : 'アカウントを作成'}
          </Button>

          <Box sx={{ textAlign: 'center' }}>
            <MuiLink component={Link} href="/login" variant="body2" data-testid="to-login-link">
              すでにアカウントをお持ちの方はこちら
            </MuiLink>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
