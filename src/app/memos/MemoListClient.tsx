import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Fab, ListItemButton, ListItemButtonProps, IconButton, CircularProgress } from '@mui/material';
import { Add as AddIcon, ArrowBack as ArrowBackIcon, Edit as EditIcon } from '@mui/icons-material';
import Link from 'next/link';
import { MEMO_COLOR } from '../utils/colors';
import { createEmptyMemo } from './actions';

export function MemoListFabs() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const memo = await createEmptyMemo();
            router.push(`/memos/${memo.id}/edit?new=true`);
        } catch (e) {
            console.error(e);
            setLoading(false);
            alert('メモ作成に失敗しました');
        }
    };

    return (
        <Box sx={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
            <Fab 
                aria-label="back"
                component={Link}
                href="/"
                sx={{ bgcolor: 'background.paper', color: MEMO_COLOR, '&:hover': { bgcolor: 'action.hover' } }}
            >
                <ArrowBackIcon />
            </Fab>
            <Fab 
                aria-label="add" 
                onClick={handleCreate}
                disabled={loading}
                sx={{ bgcolor: MEMO_COLOR, color: '#fff', '&:hover': { opacity: 0.9, bgcolor: MEMO_COLOR } }}
            >
                {loading ? <CircularProgress size={24} color="inherit" /> : <AddIcon />}
            </Fab>
        </Box>
    );
}

// 後方互換のため残す
export function MemoListFab() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const memo = await createEmptyMemo();
            router.push(`/memos/${memo.id}/edit?new=true`);
        } catch (e) {
            console.error(e);
            setLoading(false);
            alert('メモ作成に失敗しました');
        }
    };

    return (
        <Fab 
            aria-label="add" 
            onClick={handleCreate}
            disabled={loading}
            sx={{ position: 'fixed', bottom: 16, right: 16, bgcolor: MEMO_COLOR, color: '#fff' }}
        >
            {loading ? <CircularProgress size={24} color="inherit" /> : <AddIcon />}
        </Fab>
    );
}

export function MemoListEditButton({ id }: { id: string }) {
    return (
        <IconButton 
            component={Link} 
            href={`/memos/${id}?edit=true`}
            edge="end" 
            aria-label="edit"
            sx={{ color: 'action.active' }}
        >
            <EditIcon />
        </IconButton>
    );
}

// Wrapper for ListItemButton with Link to avoid passing Link prop from Server Component
export function MemoListItemButton(props: ListItemButtonProps & { href: string }) {
    const { href, ...other } = props;
    return (
        <ListItemButton component={Link} href={href} {...other} />
    );
}
