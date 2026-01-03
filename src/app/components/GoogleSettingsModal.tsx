'use client';

import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Avatar,
    IconButton,
    Typography,
    Box,
    CircularProgress,
    Alert
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import GoogleIcon from '@mui/icons-material/Google';
import { signIn } from 'next-auth/react';
import { getLinkedGoogleAccounts, unlinkGoogleAccount } from '@/lib/account-actions';

interface GoogleSettingsModalProps {
    open: boolean;
    onClose: () => void;
}

export default function GoogleSettingsModal({ open, onClose }: GoogleSettingsModalProps) {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const data = await getLinkedGoogleAccounts();
            setAccounts(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadAccounts();
        }
    }, [open]);

    const handleAddAccount = () => {
        // Trigger Google Sign In to link new account
        // 'google' provider, force clean login prompt to allow selecting different account
        signIn('google', { callbackUrl: window.location.href }); 
    };

    const handleUnlink = async (accountId: string) => {
        if (!confirm('このアカウントの連携を解除してもよろしいですか？')) return;
        
        setActionLoading(accountId);
        try {
            await unlinkGoogleAccount(accountId);
            await loadAccounts();
        } catch (e) {
            console.error(e);
            alert('連携解除に失敗しました');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Google設定</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" paragraph>
                    連携中のGoogleアカウント一覧です。ここに追加されたアカウントのメールが要約の対象になります。
                </Typography>
                
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <List>
                        {accounts.map((acc) => (
                            <ListItem
                                key={acc.id}
                                secondaryAction={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {acc.isPrimary ? (
                                            <Typography variant="caption" sx={{ bgcolor: 'primary.main', color: 'white', px: 1, py: 0.5, borderRadius: 4 }}>
                                                メイン
                                            </Typography>
                                        ) : (
                                            <IconButton 
                                                edge="end" 
                                                aria-label="delete" 
                                                onClick={() => handleUnlink(acc.id)}
                                                disabled={!!actionLoading}
                                            >
                                                {actionLoading === acc.id ? <CircularProgress size={24} /> : <DeleteIcon />}
                                            </IconButton>
                                        )}
                                    </Box>
                                }
                            >
                                <ListItemAvatar>
                                    <Avatar src={acc.picture}>
                                        <GoogleIcon />
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={acc.name || 'Google Account'}
                                    secondary={acc.email}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}

                <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    fullWidth
                    onClick={handleAddAccount}
                    sx={{ mt: 2 }}
                >
                    アカウントを追加
                </Button>

            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>閉じる</Button>
            </DialogActions>
        </Dialog>
    );
}
