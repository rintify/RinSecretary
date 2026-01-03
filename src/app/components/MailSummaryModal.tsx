'use client';

import { useState, useEffect } from 'react';
import {
    Box, Button, Typography, CircularProgress,
    Dialog, DialogContent, DialogTitle, IconButton
} from '@mui/material';
import { Close as CloseIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { generateMailSummary } from '@/lib/mail-actions';
import MarkdownDisplay from './MarkdownDisplay';

interface MailSummaryModalProps {
    onClose: () => void;
}

export default function MailSummaryModal({ onClose }: MailSummaryModalProps) {
    const [summary, setSummary] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSummary = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await generateMailSummary();
            setSummary(result);
        } catch (e: any) {
            // Only log unknown errors to console
            const knownErrors = ['AUTH_ERROR', 'NO_CONFIG', 'CONFIG_MISSING', 'GMAIL_API_DISABLED'];
            if (!knownErrors.includes(e.message)) {
                console.error("Mail Summary Error", e);
            }

            if (e.message === 'AUTH_ERROR') {
                setError("Gmailへのアクセス権限がありません。一度ログアウトし、再ログイン時にGmailの権限を許可してください。");
            } else if (e.message === 'NO_CONFIG') {
                setError("メール要約の設定がされていません。設定画面からAIモデルを選択してください。");
            } else if (e.message === 'CONFIG_MISSING') {
                setError("設定されたAIモデルが見つかりません。設定を確認してください。");
            } else if (e.message === 'GMAIL_API_DISABLED') {
                setError("Gmail APIがプロジェクトで有効になっていません。Google Cloud ConsoleでGmail APIを有効にしてください。");
            } else {
                setError("要約の生成に失敗しました。時間をおいて再試行してください。");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, []);

    return (
        <Dialog 
            open={true} 
            onClose={onClose} 
            maxWidth="md" 
            fullWidth
            PaperProps={{
                sx: { height: '80vh', display: 'flex', flexDirection: 'column' }
            }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6" component="div">メール要約 (直近1週間)</Typography>
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
                        <CircularProgress />
                        <Typography color="text.secondary">メールを取得・分析中...</Typography>
                    </Box>
                ) : error ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
                        <Typography color="error" align="center">{error}</Typography>
                        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchSummary}>
                            再試行
                        </Button>
                    </Box>
                ) : (
                    <Box>
                        <MarkdownDisplay>{summary}</MarkdownDisplay>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
