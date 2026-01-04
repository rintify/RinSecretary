'use client';

import React, { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, Button, 
    FormControlLabel, Switch, TextField, Typography, Box, 
    Alert, CircularProgress 
} from '@mui/material';
import { CloudUpload as BackupIcon, History as HistoryIcon } from '@mui/icons-material';
import { getBackupSettings, updateBackupSettings, manualBackup } from '@/lib/backup-actions';

interface BackupSettingsModalProps {
    open: boolean;
    onClose: () => void;
}

export default function BackupSettingsModal({ open, onClose }: BackupSettingsModalProps) {
    const [loading, setLoading] = useState(false);
    const [backuping, setBackuping] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);
    const [folderName, setFolderName] = useState('RinSecretary_Backup');
    const [lastBackup, setLastBackup] = useState<Date | null>(null);
    const [lastStatus, setLastStatus] = useState<string | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setLoading(true);
            getBackupSettings().then(config => {
                setIsEnabled(config.isEnabled);
                setFolderName(config.folderName || 'RinSecretary_Backup');
                setLastBackup('lastBackupAt' in config && config.lastBackupAt ? new Date(config.lastBackupAt) : null);
                setLastStatus('lastStatus' in config ? config.lastStatus : null);
                setLastError('lastError' in config ? config.lastError : null);
            }).catch(console.error).finally(() => setLoading(false));
        }
    }, [open]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateBackupSettings({ isEnabled, folderName });
            onClose();
        } catch (e) {
            console.error(e);
            alert('保存に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleManualBackup = async () => {
        setBackuping(true);
        try {
            const res = await manualBackup();
            if (res.success) {
                alert('バックアップが完了しました');
                setLastBackup(new Date());
                setLastStatus('SUCCESS');
                setLastError(null);
            } else {
                alert('バックアップに失敗しました: ' + res.error);
                setLastStatus('FAILED');
                setLastError(res.error);
            }
        } catch (e) {
            console.error(e);
            alert('エラーが発生しました');
        } finally {
            setBackuping(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BackupIcon /> バックアップ設定
            </DialogTitle>
            <DialogContent dividers>
                {loading ? (
                    <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
                ) : (
                    <Box display="flex" flexDirection="column" gap={3}>
                        <Alert severity="info">
                            Google Driveに毎日3:00に自動バックアップを作成します。<br/>
                            データはMarkdownファイルとして保存され、いつでも閲覧可能です。
                        </Alert>
                        
                        <FormControlLabel
                            control={<Switch checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />}
                            label="自動バックアップを有効にする"
                        />
                        
                        <TextField
                            label="保存先フォルダ名"
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
                            helperText="Google Driveのルート直下に作成されます"
                            fullWidth
                            // disabled={!isEnabled} // Allow editing name even if disabled
                        />

                        <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
                            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <HistoryIcon fontSize="small" /> バックアップ履歴
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                最終実行: {lastBackup ? lastBackup.toLocaleString() : 'なし'}
                            </Typography>
                            <Typography variant="body2" color={lastStatus === 'FAILED' ? 'error' : 'text.secondary'}>
                                ステータス: {lastStatus || '-'}
                                {lastStatus === 'FAILED' && lastError && ` (${lastError})`}
                            </Typography>
                        </Box>
                        
                        {lastStatus === 'FAILED' && (lastError?.includes('AUTH_ERROR') || lastError?.includes('invalid_grant')) && (
                             <Alert severity="error">
                                 認証エラーが発生しています。一度ログアウトして再度Googleでログインし直し、Driveへのアクセス権限を許可してください。
                             </Alert>
                        )}
                        
                        <Button 
                            variant="outlined" 
                            color="primary" 
                            onClick={handleManualBackup} 
                            disabled={backuping}
                            startIcon={backuping ? <CircularProgress size={20} /> : <BackupIcon />}
                        >
                            {backuping ? 'バックアップ作成中...' : '今すぐバックアップを作成'}
                        </Button>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={backuping}>キャンセル</Button>
                <Button onClick={handleSave} variant="contained" disabled={loading || backuping}>保存</Button>
            </DialogActions>
        </Dialog>
    );
}
