'use client';

import { useEffect, useState } from 'react';
import { syncManager } from '@/lib/sync-manager';
import { useConflict } from '../context/ConflictContext';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';

export default function SyncInitializer() {
    const { showConflict } = useConflict();
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

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
        
    }, [showConflict]);

    const handleCloseError = () => {
        setErrorDialogOpen(false);
    };

    return (
        <Dialog
            open={errorDialogOpen}
            onClose={handleCloseError}
            aria-labelledby="sync-error-dialog-title"
            sx={{ zIndex: 99999 }} // Ensure it's on top of everything
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
    );
}
