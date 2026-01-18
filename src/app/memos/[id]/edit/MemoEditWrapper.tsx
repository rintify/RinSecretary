'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import { CloudOff as OfflineIcon } from '@mui/icons-material';
import { db } from '@/lib/db';
import MemoEditClient from './MemoEditClient';

interface ServerMemo {
    id: string;
    content: string;
    updatedAt: Date;
}

interface MemoEditWrapperProps {
    serverMemo: ServerMemo | null;
    memoId: string;
    isNew: boolean;
    userId: string;
}

export default function MemoEditWrapper({ serverMemo, memoId, isNew, userId }: MemoEditWrapperProps) {
    const router = useRouter();
    const [memo, setMemo] = useState<ServerMemo | null>(serverMemo);
    const [loading, setLoading] = useState(!serverMemo);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // サーバーからメモが取得できている場合は何もしない
        if (serverMemo) {
            setMemo(serverMemo);
            setLoading(false);
            return;
        }

        // サーバーから取得できなかった場合（オフラインなど）、IndexedDB からフォールバック
        const fetchFromCache = async () => {
            try {
                const cachedMemo = await db.memos.get(memoId);
                
                if (cachedMemo && cachedMemo.isFullContent && !cachedMemo.isDeleted) {
                    setMemo({
                        id: cachedMemo.id,
                        content: cachedMemo.content,
                        updatedAt: cachedMemo.updatedAt,
                    });
                    setLoading(false);
                } else if (cachedMemo && !cachedMemo.isFullContent) {
                    setError('このメモはまだキャッシュされていません。オンライン時に一度開いてください。');
                    setLoading(false);
                } else {
                    setError('メモが見つかりませんでした。');
                    setLoading(false);
                }
            } catch (e) {
                console.error('Failed to fetch from cache', e);
                setError('キャッシュからの読み込みに失敗しました。');
                setLoading(false);
            }
        };

        fetchFromCache();
    }, [serverMemo, memoId]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                gap: 2,
                p: 3,
                textAlign: 'center'
            }}>
                <OfflineIcon sx={{ fontSize: 60, color: 'text.disabled' }} />
                <Typography variant="h6" color="text.secondary">
                    {error}
                </Typography>
                <Button variant="outlined" onClick={() => router.back()}>
                    戻る
                </Button>
            </Box>
        );
    }

    if (!memo) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Typography color="text.secondary">メモが見つかりませんでした</Typography>
            </Box>
        );
    }

    return <MemoEditClient memo={memo} isNew={isNew} userId={userId} />;
}
