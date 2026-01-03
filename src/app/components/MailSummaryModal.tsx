'use client';

import { useState, useEffect } from 'react';
import {
    Box, Button, Typography, CircularProgress,
    Dialog, DialogContent, DialogTitle, IconButton,
    Card, CardContent, Chip, Link as MuiLink, Stack, Alert, Snackbar
} from '@mui/material';
import { 
    Close as CloseIcon, 
    Refresh as RefreshIcon,
    Block as BlockIcon,
    OpenInNew as OpenIcon,
    Mail as MailIcon
} from '@mui/icons-material';
import { generateMailSummary, blockSender, TopicCard, MailSummaryResult } from '@/lib/mail-actions';

interface MailSummaryModalProps {
    onClose: () => void;
}

export default function MailSummaryModal({ onClose }: MailSummaryModalProps) {
    const [summary, setSummary] = useState<MailSummaryResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [blocking, setBlocking] = useState<string | null>(null);
    const [snackbar, setSnackbar] = useState<{ open: boolean, message: string }>({ open: false, message: '' });

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

    const handleBlock = async (email: string) => {
        if(!confirm(`${email} からのメールを今後除外しますか？\n（実際にはブロックされず、AI要約から除外されるだけです）`)) return;
        
        setBlocking(email);
        try {
            await blockSender(email);
            
            setSummary(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    topics: prev.topics.map(card => ({
                        ...card,
                        senders: card.senders.filter(s => s.email !== email)
                    })),
                    otherSenders: prev.otherSenders.filter(s => s.email !== email)
                };
            });
            setSnackbar({ open: true, message: `${email} を除外リストに追加しました` });
        } catch (e) {
            console.error(e);
            setSnackbar({ open: true, message: 'ブロック設定に失敗しました' });
        } finally {
            setBlocking(null);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, []);

    // render content helper
    const renderContent = () => {
        if (loading) {
            return (
                 <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
                    <CircularProgress />
                    <Typography color="text.secondary">メールを取得・分析中...</Typography>
                </Box>
            );
        }

        if (!summary || summary.topics.length === 0) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                     <Typography color="text.secondary">重要なメールは見つかりませんでした。</Typography>
                </Box>
            );
        }

        if (error) {
            return (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
                    <Typography color="error" align="center">{error}</Typography>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchSummary}>
                        再試行
                    </Button>
                </Box>
            );
        }

        return (
            <Stack spacing={2}>
                {summary.topics.map((card, idx) => (
                    <Card key={idx} variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom color="primary">
                                {card.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {card.summary}
                            </Typography>
                            
                            <Divider sx={{ my: 1.5 }} />
                            
                            {/* Senders */}
                            <Box sx={{ mb: 1.5 }}>
                                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                    送信者:
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {card.senders.map((sender, sIdx) => {
                                        const isBlocked = blocking === sender.email;
                                        return (
                                            <Chip 
                                                key={sIdx}
                                                icon={<MailIcon sx={{ fontSize: '1rem !important' }} />}
                                                label={`${sender.name || sender.email}`}
                                                variant="outlined"
                                                size="small"
                                                onDelete={() => handleBlock(sender.email)}
                                                deleteIcon={
                                                    <Box component="span" sx={{ display: 'flex' }} title="この送信者を要約から除外">
                                                        {isBlocked ? <CircularProgress size={16} /> : <BlockIcon sx={{ fontSize: '1rem !important' }} />}
                                                    </Box>
                                                }
                                                sx={{ 
                                                    maxWidth: '100%',
                                                    borderColor: isBlocked ? 'error.main' : undefined,
                                                    color: isBlocked ? 'error.main' : undefined
                                                }}
                                            />
                                        );
                                    })}
                                </Box>
                            </Box>

                            {/* Links */}
                            {card.relatedLinks.length > 0 && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                        関連メール:
                                    </Typography>
                                    <Stack spacing={0.5}>
                                        {card.relatedLinks.map((link, lIdx) => (
                                            <MuiLink 
                                                key={lIdx} 
                                                href={link.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.875rem' }}
                                            >
                                                <OpenIcon sx={{ fontSize: '0.875rem' }} />
                                                {link.text}
                                            </MuiLink>
                                        ))}
                                    </Stack>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                ))}

                {/* Other Messages Summary */}
                {summary.otherMessagesSummary && (
                    <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: 'background.default', borderStyle: 'dashed' }}>
                        <CardContent>
                            <Typography variant="subtitle2" gutterBottom color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MailIcon fontSize="small" /> その他のメッセージ
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {summary.otherMessagesSummary}
                            </Typography>
                        </CardContent>
                    </Card>
                )}
                {/* Other Senders */}
                {summary.otherSenders.length > 0 && (
                    <Card variant="outlined" sx={{ borderRadius: 2 }}>
                         <CardContent>
                             <Typography variant="subtitle2" gutterBottom color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MailIcon fontSize="small" /> その他の送信者
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {summary.otherSenders.map((sender, sIdx) => {
                                    const isBlocked = blocking === sender.email;
                                    return (
                                        <Chip 
                                            key={sIdx}
                                            icon={<MailIcon sx={{ fontSize: '1rem !important' }} />}
                                            label={`${sender.name || sender.email}`}
                                            variant="outlined"
                                            size="small"
                                            onDelete={() => handleBlock(sender.email)}
                                            deleteIcon={
                                                <Box component="span" sx={{ display: 'flex' }} title="この送信者を要約から除外">
                                                    {isBlocked ? <CircularProgress size={16} /> : <BlockIcon sx={{ fontSize: '1rem !important' }} />}
                                                </Box>
                                            }
                                            sx={{ 
                                                maxWidth: '100%',
                                                borderColor: isBlocked ? 'error.main' : undefined,
                                                color: isBlocked ? 'error.main' : undefined
                                            }}
                                        />
                                    );
                                })}
                            </Box>
                        </CardContent>
                    </Card>
                )}
            </Stack>
        );
    };

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
            
            <DialogContent sx={{ flex: 1, overflow: 'auto', p: 3, bgcolor: '#f5f5f5' }}>
                {renderContent()}
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={3000}
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    message={snackbar.message}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                />
            </DialogContent>
        </Dialog>
    );
}

import { Divider } from '@mui/material';
