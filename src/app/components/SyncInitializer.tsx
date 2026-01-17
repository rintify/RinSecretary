'use client';

import { useEffect, useState } from 'react';
import { syncManager, SyncState } from '@/lib/sync-manager';
import { useConflict } from '../context/ConflictContext';
import { 
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
    Box, Tooltip, keyframes
} from '@mui/material';
import { 
    CloudDone as CloudDoneIcon, 
    CloudOff as CloudOffIcon, 
    Sync as SyncIcon, 
    Error as ErrorIcon 
} from '@mui/icons-material';

// スピンアニメーション
const spin = keyframes`
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
`;

export default function SyncInitializer() {
    const { showConflict } = useConflict();
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [syncState, setSyncState] = useState<SyncState>({ status: 'idle', online: true, lastSyncedAt: null });

    useEffect(() => {
        // Register Conflict Resolver
        syncManager.setConflictResolver(async (local, server) => {
            return await showConflict(
                {
                    id: local.id,
                    title: local.title,
                    content: local.content,
                    updatedAt: local.updatedAt.toISOString()
                },
                {
                    id: server.id,
                    title: server.title,
                    content: server.content,
                    updatedAt: server.updatedAt
                },
                {
                    title: '編集の競合（サーバーで更新されました）',
                    message: '他の端末またはユーザーによってこのメモが更新されています。どちらの内容を保存しますか？',
                    local: 'ローカルの変更で上書き',
                    server: 'サーバーの内容を採用'
                }
            );
        });


        // Register Global Error Handler
        console.log('[SyncInitializer] Registering error handler...');
        syncManager.setErrorHandler((error) => {
            console.log('[SyncInitializer] Global Sync Error Caught in Component:', error);
            setErrorMessage(error.message || '不明なエラーが発生しました');
            setErrorDialogOpen(true);
        });

        // Register Status Listener
        const statusListener = (state: SyncState) => {
            setSyncState(state);
        };
        syncManager.addStatusListener(statusListener);

        return () => {
            syncManager.removeStatusListener(statusListener);
        };
        
    }, [showConflict]);

    const handleCloseError = () => {
        setErrorDialogOpen(false);
    };

    // 同期インジケーターのツールチップ
    const getTooltipText = () => {
        if (!syncState.online) return 'オフライン';
        if (syncState.status === 'syncing') return '同期中...';
        if (syncState.status === 'error') return '同期エラー';
        if (syncState.lastSyncedAt) {
            return `最終同期: ${syncState.lastSyncedAt.toLocaleTimeString()}`;
        }
        return '同期済み';
    };

    // 同期インジケーターのアイコン
    const renderSyncIcon = () => {
        if (!syncState.online) {
            return <CloudOffIcon sx={{ fontSize: 20, color: 'text.disabled' }} />;
        }
        if (syncState.status === 'syncing') {
            return <SyncIcon sx={{ fontSize: 20, color: 'primary.main', animation: `${spin} 1s linear infinite` }} />;
        }
        if (syncState.status === 'error') {
            return <ErrorIcon sx={{ fontSize: 20, color: 'error.main' }} />;
        }
        return <CloudDoneIcon sx={{ fontSize: 20, color: 'success.main' }} />;
    };

    return (
        <>
            {/* 同期インジケーター（右下固定） */}
            <Box
                sx={{
                    position: 'fixed',
                    bottom: 16,
                    left: 16,
                    zIndex: 999,
                    bgcolor: 'background.paper',
                    borderRadius: '50%',
                    boxShadow: 1,
                    p: 0.75,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    '&:hover': {
                        boxShadow: 3
                    }
                }}
                onClick={() => syncManager.sync()}
            >
                <Tooltip title={getTooltipText()} arrow placement="right">
                    {renderSyncIcon()}
                </Tooltip>
            </Box>

            {/* エラーダイアログ */}
            <Dialog
                open={errorDialogOpen}
                onClose={handleCloseError}
                aria-labelledby="sync-error-dialog-title"
                sx={{ zIndex: 99999 }}
            >
                <DialogTitle id="sync-error-dialog-title">
                    同期エラー
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        サーバーとの同期に失敗しました（データはローカルに保存されています）。
                        <br />
                        <span style={{ fontSize: '0.8em', color: '#666' }}>詳細: {errorMessage}</span>
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseError} autoFocus>
                        OK
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

