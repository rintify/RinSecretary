'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, Box, IconButton, Typography,
    Switch, FormControlLabel, Divider, Chip
} from '@mui/material';
import { Close as CloseIcon, WifiOff, Wifi } from '@mui/icons-material';
import { syncManager } from '@/lib/sync-manager';

interface LocalSettingsModalProps {
    open: boolean;
    onClose: () => void;
}

export default function LocalSettingsModal({ open, onClose }: LocalSettingsModalProps) {
    const [forceOffline, setForceOffline] = useState(false);
    const [browserOnline, setBrowserOnline] = useState(true);
    const [loading, setLoading] = useState(false);

    // 初期化時に現在の設定を読み込む
    useEffect(() => {
        if (open) {
            setForceOffline(syncManager.getForceOfflineMode());
            setBrowserOnline(syncManager.getBrowserOnline());
        }
    }, [open]);

    // ブラウザのオンライン状態変更をリッスン
    useEffect(() => {
        const handleOnline = () => setBrowserOnline(true);
        const handleOffline = () => setBrowserOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.checked;
        setLoading(true);
        try {
            await syncManager.setForceOfflineMode(newValue);
            setForceOffline(newValue);
        } catch (e) {
            console.error('Failed to toggle offline mode:', e);
        } finally {
            setLoading(false);
        }
    };

    const isEffectivelyOffline = forceOffline || !browserOnline;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2 }
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
                <Typography variant="h6" fontWeight="bold" component="div">ローカル設定</Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent>
                {/* Current Status */}
                <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        現在の状態
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isEffectivelyOffline ? (
                            <>
                                <WifiOff color="warning" />
                                <Chip label="オフライン" color="warning" size="small" />
                            </>
                        ) : (
                            <>
                                <Wifi color="success" />
                                <Chip label="オンライン" color="success" size="small" />
                            </>
                        )}
                    </Box>
                    {!browserOnline && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            ※ ブラウザがオフライン状態です
                        </Typography>
                    )}
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Force Offline Toggle */}
                <Box sx={{ py: 1 }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={forceOffline}
                                onChange={handleToggle}
                                disabled={loading}
                                color="warning"
                            />
                        }
                        label={
                            <Box>
                                <Typography variant="body1">
                                    オフラインモードを強制
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    有効にすると、サーバーとの同期を停止します
                                </Typography>
                            </Box>
                        }
                        sx={{ alignItems: 'flex-start', ml: 0 }}
                    />
                </Box>

                {forceOffline && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1, opacity: 0.9 }}>
                        <Typography variant="body2" color="warning.contrastText">
                            ⚠️ オフラインモード中はデータがローカルにのみ保存されます。
                            オンラインに戻すと自動的に同期が開始されます。
                        </Typography>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
