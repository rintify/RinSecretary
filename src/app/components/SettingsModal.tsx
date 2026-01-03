'use client';

import { useState, useEffect } from 'react';
import {
    Box, Button, TextField, Typography, Alert, CircularProgress,
    IconButton, Divider, MenuItem, Select, FormControl, InputLabel,
    AppBar, Toolbar, Container, List, ListItem, ListItemText,
    ListItemSecondaryAction, Paper, Stack, Checkbox, FormControlLabel,
    Dialog, DialogContent, Avatar, Tooltip
} from '@mui/material';
import {
    Close as CloseIcon,
    NotificationsActive as TestIcon,
    Save as SaveIcon,
    SmartToy as AiIcon,
    Notifications as NotifIcon,
    Delete as DeleteIcon, 
    Edit as EditIcon, 
    Add as AddIcon,
    Email as MailIcon,
    Send as SendIcon
} from '@mui/icons-material';
import { getPushoverSettings, updatePushoverSettings, sendTestPushoverNotification, sendTestDiscordNotification } from '@/lib/user-actions';
import { getAIConfigs, saveAIConfig, deleteAIConfig } from '@/lib/ai-actions';
import { getMailSettings, saveMailSettings } from '@/lib/mail-actions';

interface AIConfig {
    id: string;
    name: string;
    provider: string;
    apiKey: string;
    model: string | null;
    baseUrl: string | null;
    includeThoughts?: boolean;
}

interface SettingsModalProps {
    onClose: () => void;
}

// Module-level cache
let settingsCache: { pushoverUserKey: string | null; pushoverToken: string | null; discordWebhookUrl: string | null; } | null = null;

export default function SettingsModal({ onClose }: SettingsModalProps) {
    const [userKey, setUserKey] = useState('');
    const [token, setToken] = useState('');
    const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');

    // AI Config State
    const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([]);
    const [isEditingConfig, setIsEditingConfig] = useState(false);
    const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
    const [configName, setConfigName] = useState('');
    const [configProvider, setConfigProvider] = useState('gemini');
    const [configApiKey, setConfigApiKey] = useState('');
    const [configModel, setConfigModel] = useState('');
    const [configBaseUrl, setConfigBaseUrl] = useState('');
    const [configIncludeThoughts, setConfigIncludeThoughts] = useState(false);

    // Mail Settings
    const [mailModelId, setMailModelId] = useState<string>('');
    const [mailPrompt, setMailPrompt] = useState<string>('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

    const loadConfigs = async () => {
        try {
            const configs = await getAIConfigs();
            setAiConfigs(configs as any); 
        } catch(e) {
            console.error("Failed to load AI configs", e);
        }
    };

    useEffect(() => {
        if (settingsCache) {
            setUserKey(settingsCache.pushoverUserKey || '');
            setToken(settingsCache.pushoverToken || '');
            setDiscordWebhookUrl(settingsCache.discordWebhookUrl || '');
            setLoading(false);
        }
        
        loadConfigs();

        getPushoverSettings().then(settings => {
            if (settings) {
                settingsCache = settings;
                setUserKey(settings.pushoverUserKey || '');
                setToken(settings.pushoverToken || '');
                setDiscordWebhookUrl(settings.discordWebhookUrl || '');
            }
            // Load mail settings
            getMailSettings().then(ms => {
                if (ms) {
                    setMailModelId((ms as any).mailSummaryModelId || '');
                    setMailPrompt((ms as any).mailSummaryPrompt || '');
                }
                setLoading(false);
            });
        });
    }, []);

    const handleSaveConfig = async () => {
        if (!configName || !configApiKey) {
            setMessage({ text: '名前とAPIキーは必須です', type: 'error' });
            return;
        }

        setSaving(true);
        try {
            await saveAIConfig({
                id: editingConfigId || undefined,
                name: configName,
                provider: configProvider,
                apiKey: configApiKey,
                model: configModel,
                baseUrl: configBaseUrl,
                includeThoughts: configIncludeThoughts
            });
            await loadConfigs();
            setIsEditingConfig(false);
            resetConfigForm();
            setMessage({ text: 'AI設定を保存しました', type: 'success' });
        } catch (e) {
            console.error(e);
            setMessage({ text: '保存に失敗しました', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteConfig = async (id: string) => {
        if(!confirm('この設定を削除してもよろしいですか？')) return;
        try {
            await deleteAIConfig(id);
            await loadConfigs();
            setMessage({ text: '設定を削除しました', type: 'success' });
        } catch(e) {
            console.error(e);
            setMessage({ text: '削除に失敗しました', type: 'error' });
        }
    };

    const startEdit = (config: AIConfig) => {
        setEditingConfigId(config.id);
        setConfigName(config.name);
        setConfigProvider(config.provider);
        setConfigApiKey(config.apiKey);
        setConfigModel(config.model || '');
        setConfigBaseUrl(config.baseUrl || '');
        setConfigIncludeThoughts(config.includeThoughts || false);
        setIsEditingConfig(true);
    };

    const startAdd = () => {
        resetConfigForm();
        setIsEditingConfig(true);
    };

    const resetConfigForm = () => {
        setEditingConfigId(null);
        setConfigName('Gemini Pro');
        setConfigProvider('gemini');
        setConfigApiKey('');
        setConfigModel('gemini-2.0-flash-exp');
        setConfigBaseUrl('');
        setConfigIncludeThoughts(false);
    };

    const handleSaveAll = async () => {
        setSaving(true);
        setMessage(null);
        try {
            // Save Pushover/Discord
            await updatePushoverSettings(userKey, token, discordWebhookUrl);
            settingsCache = { pushoverUserKey: userKey, pushoverToken: token, discordWebhookUrl: discordWebhookUrl };
            
            // Save Mail Settings
            await saveMailSettings(mailModelId, mailPrompt);
            
            setMessage({ text: '設定を保存しました', type: 'success' });
            setTimeout(onClose, 800);
        } catch(e) {
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
                        onClick={handleSaveAll} 
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
                        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <AiIcon /> AI モデル設定
                            </Typography>
                            {!isEditingConfig && (
                                <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={startAdd}>
                                    追加
                                </Button>
                            )}
                        </Box>

                        <Paper variant="outlined" sx={{ p: isEditingConfig ? 3 : 0, borderRadius: 2, overflow: 'hidden' }}>
                            {isEditingConfig ? (
                                <Stack spacing={3}>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        {editingConfigId ? 'モデル編集' : 'モデル追加'}
                                    </Typography>
                                    <TextField 
                                        label="表示名 (例: Main Gemini)" 
                                        value={configName} 
                                        onChange={(e) => setConfigName(e.target.value)} 
                                        fullWidth 
                                        size="small"
                                    />
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Provider</InputLabel>
                                        <Select
                                            value={configProvider}
                                            label="Provider"
                                            onChange={(e) => setConfigProvider(e.target.value)}
                                        >
                                            <MenuItem value="gemini">Google Gemini</MenuItem>
                                            <MenuItem value="openai">OpenAI / Compatible</MenuItem>
                                            <MenuItem value="anthropic">Anthropic (Claude)</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <TextField 
                                        label="API Key" 
                                        value={configApiKey} 
                                        onChange={(e) => setConfigApiKey(e.target.value)} 
                                        type="password" 
                                        fullWidth 
                                        size="small" 
                                        placeholder="sk-..." 
                                    />
                                    <TextField 
                                        label="Model Name" 
                                        value={configModel} 
                                        onChange={(e) => setConfigModel(e.target.value)} 
                                        fullWidth 
                                        size="small" 
                                        placeholder="gemini-2.0-flash-exp" 
                                        helperText="モデルID (例: gpt-4o, gemini-1.5-pro)" 
                                    />
                                    {(configProvider === 'gemini') && (
                                         <FormControlLabel
                                            control={
                                                <Checkbox 
                                                    checked={configIncludeThoughts} 
                                                    onChange={(e) => setConfigIncludeThoughts(e.target.checked)} 
                                                />
                                            }
                                            label="推論（Thinking）を表示出力する"
                                            sx={{ ml: 1, color: 'text.secondary' }}
                                         />
                                    )}
                                    {(configProvider === 'openai' || configProvider === 'gemini') && (
                                        <TextField 
                                            label="Base URL (Optional)" 
                                            value={configBaseUrl} 
                                            onChange={(e) => setConfigBaseUrl(e.target.value)} 
                                            fullWidth 
                                            size="small" 
                                            placeholder="https://api.openai.com/v1" 
                                            helperText="互換サーバを使用する場合に入力"
                                        />
                                    )}
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                        <Button onClick={() => setIsEditingConfig(false)} disabled={saving}>キャンセル</Button>
                                        <Button variant="contained" onClick={handleSaveConfig} disabled={saving}>保存</Button>
                                    </Box>
                                </Stack>
                            ) : (
                                <List disablePadding>
                                    {aiConfigs.length === 0 && (
                                        <ListItem>
                                            <ListItemText primary="設定されたモデルはありません" secondary="「追加」ボタンからモデルを登録してください" />
                                        </ListItem>
                                    )}
                                    {aiConfigs.map((config, index) => (
                                        <Box key={config.id}>
                                            <ListItem>
                                                <ListItemText 
                                                    primary={config.name} 
                                                    secondary={`${config.provider} / ${config.model || 'default'}`} 
                                                />
                                                <ListItemSecondaryAction>
                                                    <IconButton edge="end" onClick={() => startEdit(config)} sx={{ mr: 1 }}>
                                                        <EditIcon />
                                                    </IconButton>
                                                    <IconButton edge="end" onClick={() => handleDeleteConfig(config.id)}>
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </ListItemSecondaryAction>
                                            </ListItem>
                                            {index < aiConfigs.length - 1 && <Divider />}
                                        </Box>
                                    ))}
                                </List>
                            )}
                        </Paper>
                    </Box>

                    {/* Mail Summary Settings */}
                    <Box>
                        <Typography variant="h6" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <MailIcon /> メール要約設定
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                            <Stack spacing={3}>
                                <Alert severity="info" sx={{ py: 0 }}>
                                    Gmailから直近1週間のメールを取得・要約します。
                                </Alert>
                                <FormControl fullWidth size="small">
                                    <InputLabel>使用するAIモデル</InputLabel>
                                    <Select
                                        value={mailModelId}
                                        label="使用するAIモデル"
                                        onChange={(e) => setMailModelId(e.target.value)}
                                    >
                                        <MenuItem value="">未選択</MenuItem>
                                        {aiConfigs.map(c => (
                                            <MenuItem key={c.id} value={c.id}>
                                                {c.name} ({c.model})
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField
                                    label="カスタム指示プロンプト"
                                    multiline
                                    rows={4}
                                    value={mailPrompt}
                                    onChange={(e) => setMailPrompt(e.target.value)}
                                    placeholder="例: 請求書、支払い関連、友人の名前が含まれるメールのみをピックアップしてください。宣伝は無視してください。"
                                    helperText="AIに渡すフィルタリングと要約の指示を記述します。"
                                    fullWidth
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
