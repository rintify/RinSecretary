'use client';

import { useEffect, useState, useRef } from 'react';
import { syncManager, SyncState } from '@/lib/sync-manager';
import { useConflict } from '../context/ConflictContext';
import { useGlobalJobs } from '../context/GlobalJobContext';
import { 
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
} from '@mui/material';

export default function SyncInitializer() {
    const { showConflict } = useConflict();
    const { addClientJob, updateClientJob, removeJob } = useGlobalJobs();
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    
    // 現在のJobIDを追跡
    const currentSyncJobId = useRef<string | null>(null);

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
            
            // Job状態をエラーに更新
            if (currentSyncJobId.current) {
                updateClientJob(currentSyncJobId.current, { 
                    status: 'FAILED', 
                    error: error.message,
                    progress: 100 
                });
                currentSyncJobId.current = null;
            }
        });

        // Register Status Listener (Job連携用)
        const statusListener = (state: SyncState) => {
            if (state.status === 'syncing') {
                if (!state.isBackgroundCheck && !currentSyncJobId.current) {
                    // バックグラウンドチェックではなく（＝ローカル変更あり or サーバー更新あり）、まだJobがない場合
                    // 同期開始 → Job追加
                    const jobId = `sync-${Date.now()}`;
                    currentSyncJobId.current = jobId;
                    addClientJob({
                        id: jobId,
                        type: 'SYNC',
                        title: 'データ同期中...',
                    });
                }
            } else if (state.status === 'idle' && currentSyncJobId.current) {
                // 同期完了 → Job更新
                updateClientJob(currentSyncJobId.current, { 
                    status: 'COMPLETED', 
                    progress: 100,
                    title: 'データ同期完了'
                });
                currentSyncJobId.current = null;
            } else if (state.status === 'error' && currentSyncJobId.current) {
                // エラー状態（errorHandler側で処理済みなので、ここではスキップ）
                // errorHandlerが呼ばれた後にstatus変更が通知される場合がある
            }
        };
        syncManager.addStatusListener(statusListener);

        return () => {
            syncManager.removeStatusListener(statusListener);
        };
        
    }, [showConflict, addClientJob, updateClientJob]);

    const handleCloseError = () => {
        setErrorDialogOpen(false);
    };

    return (
        <>
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

