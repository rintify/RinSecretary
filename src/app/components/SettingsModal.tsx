'use client';

import { useState, useEffect } from 'react';
import { 
    Box, Button, TextField, Typography, Alert, CircularProgress, 
    IconButton, Divider, MenuItem, Select, FormControl, InputLabel,
    AppBar, Toolbar, Container, List, ListItem, ListItemText, ListSubheader,
    Switch, ListItemSecondaryAction, Paper, Stack, Slide
} from '@mui/material';
import { 
    Close as CloseIcon, 
    NotificationsActive as TestIcon,
    Save as SaveIcon,
    SmartToy as AiIcon,
    Notifications as NotifIcon,
    Settings as SystemIcon,
    Send as SendIcon
} from '@mui/icons-material';
import { getPushoverSettings, updatePushoverSettings, sendTestPushoverNotification, getAISettings, updateAISettings, sendTestDiscordNotification } from '@/lib/user-actions';


interface SettingsModalProps {
    onClose: () => void;
}

// Module-level cache
let settingsCache: { pushoverUserKey: string | null; pushoverToken: string | null; discordWebhookUrl: string | null; } | null = null;

export default function SettingsModal({ onClose }: SettingsModalProps) {
    const [userKey, setUserKey] = useState('');
    const [token, setToken] = useState('');
    const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
    const [aiKey, setAiKey] = useState('');
    const [aiProvider, setAiProvider] = useState('openai');
    const [aiModel, setAiModel] = useState('');
    const [aiBaseUrl, setAiBaseUrl] = useState('');


    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

    useEffect(() => {
        if (settingsCache) {
            setUserKey(settingsCache.pushoverUserKey || '');
            setToken(settingsCache.pushoverToken || '');
            setDiscordWebhookUrl(settingsCache.discordWebhookUrl || '');
            setLoading(false);
        }
        
        getAISettings().then(aiSettings => {
            if (aiSettings) {
                setAiKey(aiSettings.aiApiKey || '');
                setAiProvider(aiSettings.aiProvider || 'openai');
                setAiModel(aiSettings.aiModel || '');
                setAiBaseUrl(aiSettings.aiBaseUrl || '');
            }
        });


        getPushoverSettings().then(settings => {
            if (settings) {
                settingsCache = settings;
                setUserKey(settings.pushoverUserKey || '');
                setToken(settings.pushoverToken || '');
                setDiscordWebhookUrl(settings.discordWebhookUrl || '');
            }
            setLoading(false);
        });
    }, []);

    const handleSubmit = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await updatePushoverSettings(userKey, token, discordWebhookUrl);
            await updateAISettings(aiProvider, aiKey, aiModel, aiBaseUrl);

            
            // Clear old LocalStorage if exists (migration)
            localStorage.removeItem('openai_api_key');
            localStorage.removeItem('ai_api_key');
            localStorage.removeItem('ai_provider');

            settingsCache = { pushoverUserKey: userKey, pushoverToken: token, discordWebhookUrl: discordWebhookUrl };
            
            setMessage({ text: '設定を保存しました', type: 'success' });
            setTimeout(onClose, 800);
        } catch (e) {
            console.error(e);
            setMessage({ text: '保存に失敗しました', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleTestNotification = async () => {
        setTesting(true);
        setMessage(null);
        const res = await sendTestPushoverNotification(userKey, token);
        if (res.success) {
                setMessage({ text: 'テスト通知を送信しました', type: 'success' });
        } else {
                setMessage({ text: '送信失敗: ' + res.error, type: 'error' });
        }
        setTesting(false);
    };

    const handleTestDiscord = async () => {
        if (!discordWebhookUrl) return;
        setTesting(true);
        setMessage(null);
        const res = await sendTestDiscordNotification(discordWebhookUrl);
        if (res.success) {
            setMessage({ text: 'Discordテスト通知を送信しました', type: 'success' });
        } else {
            setMessage({ text: 'Discord送信失敗: ' + res.error, type: 'error' });
        }
        setTesting(false);
    };


    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress />
        </Box>
    );

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 4 }}>
            {/* Header */}
            <AppBar position="sticky" color="default" elevation={1}>
                <Toolbar>
                    <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
                        <CloseIcon />
                    </IconButton>
                    <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
                        設定
                    </Typography>
                    <Button 
                        autoFocus 
                        color="primary" 
                        variant="contained"
                        onClick={handleSubmit} 
                        disabled={saving}
                        startIcon={<SaveIcon />}
                    >
                        {saving ? '保存中...' : '保存'}
                    </Button>
                </Toolbar>
            </AppBar>

            <Container maxWidth="md" sx={{ mt: 3 }}>
                {message && (
                    <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
                        {message.text}
                    </Alert>
                )}

                <Stack spacing={4}>
                    {/* AI Settings Section */}
                    <Box>
                        <Typography variant="h6" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AiIcon /> AI 設定
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                            <Stack spacing={3}>
                                <FormControl fullWidth>
                                    <InputLabel id="ai-provider-label">API Type</InputLabel>
                                    <Select
                                        labelId="ai-provider-label"
                                        value={aiProvider}
                                        label="API Type"
                                        onChange={(e) => setAiProvider(e.target.value)}
                                    >
                                        <MenuItem value="openai">OpenAI / Compatible (Default)</MenuItem>
                                        <MenuItem value="gemini">Google Gemini</MenuItem>
                                        <MenuItem value="anthropic">Anthropic Claude</MenuItem>
                                    </Select>
                                </FormControl>
                                <TextField 
                                    label="API Key"
                                    value={aiKey}
                                    onChange={(e) => setAiKey(e.target.value)}
                                    fullWidth
                                    type="password"
                                    placeholder="sk-..."
                                    helperText="APIキーを入力してください (ローカルLLM等で不要な場合は空欄可)"
                                />

                                <TextField 
                                    label="Model Name"
                                    value={aiModel}
                                    onChange={(e) => setAiModel(e.target.value)}
                                    fullWidth
                                    placeholder={
                                        aiProvider === 'openai' ? 'gpt-4o-mini' : 
                                        aiProvider === 'anthropic' ? 'claude-3-5-sonnet-20240620' : 
                                        aiProvider === 'gemini' ? 'gemini-2.0-flash-exp' : 
                                        'gpt-4o'
                                    }
                                    helperText={`使用するモデル名を入力してください (Default: ${
                                        aiProvider === 'openai' ? 'gpt-4o-mini' : 
                                        aiProvider === 'anthropic' ? 'claude-3-5-sonnet-20240620' : 
                                        aiProvider === 'gemini' ? 'gemini-2.0-flash-exp' : 
                                        'gpt-4o'
                                    })`}
                                />

                                <TextField 
                                    label="Base URL (Optional)"
                                    value={aiBaseUrl}
                                    onChange={(e) => setAiBaseUrl(e.target.value)}
                                    fullWidth
                                    placeholder="https://api.openai.com/v1"
                                    helperText="OpenAI互換のエンドポイント (空欄時は公式APIを使用)"
                                    disabled={aiProvider !== 'openai'}
                                />

                            </Stack>
                        </Paper>
                    </Box>

                    {/* Notification Settings Section */}
                    <Box>
                        <Typography variant="h6" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <NotifIcon /> 通知設定
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                            <Stack spacing={3}>
                                <Alert severity="info" sx={{ py: 0 }}>
                                    Pushoverを使ってアラーム通知を受け取れます。
                                </Alert>
                                <TextField 
                                    label="Pushover User Key"
                                    value={userKey}
                                    onChange={(e) => setUserKey(e.target.value)}
                                    fullWidth
                                />
                                <TextField 
                                    label="Pushover API Token"
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                    fullWidth
                                />
                                <Button
                                    onClick={handleTestNotification}
                                    disabled={testing || !userKey || !token}
                                    startIcon={testing ? <CircularProgress size={20} /> : <TestIcon />}
                                    variant="outlined"
                                    sx={{ alignSelf: 'flex-start' }}
                                >
                                    テスト通知を送信
                                </Button>
                                
                                <Divider />

                                <Typography variant="subtitle2" sx={{ mt: 2 }}>Discord連携</Typography>
                                <TextField 
                                    label="Discord Webhook URL"
                                    value={discordWebhookUrl}
                                    onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                                    fullWidth
                                    placeholder="https://discord.com/api/webhooks/..."
                                    helperText="毎日のサマリーをDiscordに送信します"
                                />
                                <Button
                                    onClick={handleTestDiscord}
                                    disabled={testing || !discordWebhookUrl}
                                    startIcon={testing ? <CircularProgress size={20} /> : <SendIcon />}
                                    variant="outlined"
                                    sx={{ alignSelf: 'flex-start' }}
                                >
                                    Discordテスト送信
                                </Button>

                            </Stack>
                        </Paper>
                    </Box>

                    {/* System Info (Optional/Placeholder) */}
                    <Box sx={{ pb: 4 }}>
                        <Typography variant="caption" color="text.secondary" align="center" display="block">
                            RinSecretary System v0.1.0
                        </Typography>
                    </Box>
                </Stack>
            </Container>
        </Box>
    );
}
