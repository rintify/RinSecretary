'use client';

import { useState, useEffect } from 'react';
import {
    Box, Typography, Button, TextField, Select, MenuItem,
    FormControl, InputLabel, IconButton, Divider,
    List, ListItem, ListItemText, ListItemSecondaryAction,
    Tab, Tabs, Paper, Alert, CircularProgress, Stack
} from '@mui/material';
import { Close as CloseIcon, Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material';
import { getMailSettings, saveMailSettings, getBlockedSenders, unblockSender } from '@/lib/mail-actions';
import { getAIConfigs } from '@/lib/ai-actions';

interface MailSettingsModalProps {
    onClose: () => void;
}

interface AIConfig {
    id: string;
    name: string;
    provider: string;
    model: string | null;
}

export default function MailSettingsModal({ onClose }: MailSettingsModalProps) {
    const [tab, setTab] = useState(0);

    // Settings State
    const [mailModelId, setMailModelId] = useState('');
    const [mailPrompt, setMailPrompt] = useState('重要な連絡、請求書、個人的なメッセージを優先して要約してください。');
    const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([]);
    
    // Block List State
    const [blockedList, setBlockedList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadData = async () => {
             setLoading(true);
             try {
                // Load AI Configs
                const configs = await getAIConfigs();
                setAiConfigs(configs);

                // Load Settings
                const settings = await getMailSettings();
                if (settings) {
                    if (settings.mailSummaryModelId) setMailModelId(settings.mailSummaryModelId);
                    if (settings.mailSummaryPrompt) setMailPrompt(settings.mailSummaryPrompt);
                }

                // Load Block List
                const blocked = await getBlockedSenders();
                setBlockedList(blocked);
             } catch (e) {
                 console.error(e);
             } finally {
                 setLoading(false);
             }
        };
        loadData();
    }, []);

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await saveMailSettings(mailModelId, mailPrompt);
            alert('設定を保存しました');
        } catch (e) {
            console.error(e);
            alert('保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const handleUnblock = async (id: string, email: string) => {
        if (!confirm(`${email} のブロックを解除しますか？`)) return;
        try {
            await unblockSender(id);
            setBlockedList(prev => prev.filter(item => item.id !== id));
        } catch (e) {
            console.error(e);
            alert('解除に失敗しました');
        }
    };

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTab(newValue);
    };

    if (loading) {
        return (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6">メール設定</Typography>
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Box>

            <Tabs value={tab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
                <Tab label="基本設定" />
                <Tab label="ブロックリスト" />
            </Tabs>

            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                {tab === 0 && (
                    <Stack spacing={3}>
                        <Box>
                            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>AIモデル選択</Typography>
                            <Typography variant="caption" color="text.secondary" paragraph>
                                メールの要約に使用するAIモデルを選択してください。
                            </Typography>
                            <FormControl fullWidth size="small">
                                <InputLabel>AI Model</InputLabel>
                                <Select
                                    value={mailModelId}
                                    label="AI Model"
                                    onChange={(e) => setMailModelId(e.target.value)}
                                >
                                    {aiConfigs.map((config) => (
                                        <MenuItem key={config.id} value={config.id}>
                                            {config.name} ({config.provider}{config.model ? ` - ${config.model}` : ''})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {aiConfigs.length === 0 && (
                                <Alert severity="warning" sx={{ mt: 1 }}>
                                    AI設定がありません。「設定 &gt; AI設定」からAIを追加してください。
                                </Alert>
                            )}
                        </Box>

                        <Divider />

                        <Box>
                            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>カスタム指示 (プロンプト)</Typography>
                            <Typography variant="caption" color="text.secondary" paragraph>
                                AIにどのような視点で要約してほしいか指示を入力できます。
                            </Typography>
                            <TextField
                                label="Prompt"
                                multiline
                                rows={4}
                                fullWidth
                                value={mailPrompt}
                                onChange={(e) => setMailPrompt(e.target.value)}
                                helperText="例: 請求書と日程調整のメールを優先し、親しい友人からのメールも逃さないようにしてください。"
                            />
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                            <Button 
                                variant="contained" 
                                startIcon={<SaveIcon />} 
                                onClick={handleSaveSettings}
                                disabled={saving}
                            >
                                保存
                            </Button>
                        </Box>
                    </Stack>
                )}

                {tab === 1 && (
                    <Box>
                        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>ブロックした送信者</Typography>
                        <Typography variant="caption" color="text.secondary" paragraph>
                            以下の送信者からのメールは要約機能から除外されます。
                        </Typography>

                        {blockedList.length === 0 ? (
                            <Alert severity="info" variant="outlined">
                                ブロックしている送信者はいません。
                            </Alert>
                        ) : (
                            <List>
                                {blockedList.map((item) => (
                                    <ListItem key={item.id} divider>
                                        <ListItemText 
                                            primary={item.email} 
                                            secondary={`登録日: ${new Date(item.createdAt).toLocaleDateString()}`}
                                        />
                                        <ListItemSecondaryAction>
                                            <IconButton edge="end" aria-label="delete" onClick={() => handleUnblock(item.id, item.email)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Box>
                )}
            </Box>
        </Paper>
    );
}
