'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  MenuItem,
  Paper,
  Snackbar,
  Alert,
  Divider,
} from '@mui/material';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { db } from '@/lib/db';

export default function SettingsPage() {
  const { data: session } = useSession();

  const [aiProvider, setAiProvider] = useState('openai');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModelPreference, setAiModelPreference] = useState('');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // サーバーのAPIエンドポイントから最新の設定を取得する
  useEffect(() => {
    if (!session?.user) return;

    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const { data } = await res.json();
          if (data) {
            setAiProvider(data.aiProvider || 'openai');
            setAiApiKey(data.aiApiKeyEncoded === '********' ? '********' : '');
            setAiModelPreference(data.aiModelPreference || '');
            setDiscordWebhookUrl(data.discordWebhookUrl || '');

            // ローカルDBにキャッシュとして保存する
            await db.userSettings.put({
              id: 'default', // ローカル向けの固定ID
              aiProvider: data.aiProvider || 'openai',
              updatedAt: Date.now(),
              _syncStatus: 'synced',
            });
          }
        }
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [session]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        aiProvider,
        aiApiKeyEncoded: aiApiKey,
        aiModelPreference,
        discordWebhookUrl,
      };

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setToastMessage('設定を保存しました');
        // ローカルDBも更新
        await db.userSettings.put({
          id: 'default',
          aiProvider: aiProvider,
          updatedAt: Date.now(),
          _syncStatus: 'synced', // API経由で直接更新したため同期済みとして扱う
        });
      } else {
        setToastMessage('保存に失敗しました');
      }
    } catch (err) {
      console.error(err);
      setToastMessage('保存エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (!session)
    return (
      <Container>
        <Typography sx={{ mt: 5 }}>ログインが必要です</Typography>
      </Container>
    );

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          システム設定
        </Typography>
        <Button component={Link} href="/" variant="outlined" data-testid="back-to-home-btn">
          ダッシュボードへ戻る
        </Button>
      </Box>

      <Paper sx={{ p: 4 }}>
        <Box component="form" onSubmit={handleSave} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography variant="h6">AI 連携設定</Typography>
          <TextField
            select
            label="AI プロバイダ"
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value)}
            disabled={isLoading}
            data-testid="setting-ai-provider"
          >
            <MenuItem value="openai">OpenAI (ChatGPT)</MenuItem>
            <MenuItem value="gemini">Google Gemini</MenuItem>
            <MenuItem value="anthropic">Anthropic Claude</MenuItem>
          </TextField>

          <TextField
            label="APIキー"
            type="password"
            value={aiApiKey}
            onChange={(e) => setAiApiKey(e.target.value)}
            disabled={isLoading}
            placeholder="sk-..."
            helperText="変更しない場合は ******** のままにしておいてください"
            data-testid="setting-ai-apikey"
          />

          <TextField
            label="優先モデル (任意)"
            value={aiModelPreference}
            onChange={(e) => setAiModelPreference(e.target.value)}
            disabled={isLoading}
            placeholder="例: gpt-4o, claude-3-5-sonnet-20240620"
            data-testid="setting-ai-model"
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6">通知・システム設定</Typography>

          <TextField
            label="Discord Webhook URL"
            value={discordWebhookUrl}
            onChange={(e) => setDiscordWebhookUrl(e.target.value)}
            disabled={isLoading}
            placeholder="https://discord.com/api/webhooks/..."
            data-testid="setting-discord-webhook"
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button type="submit" variant="contained" size="large" disabled={isLoading} data-testid="save-settings-btn">
              設定を保存する
            </Button>
          </Box>
        </Box>
      </Paper>

      <Snackbar
        open={!!toastMessage}
        autoHideDuration={4000}
        onClose={() => setToastMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toastMessage.includes('保存しました') ? 'success' : 'error'} sx={{ width: '100%' }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
}
