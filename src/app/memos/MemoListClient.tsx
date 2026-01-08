import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Fab, ListItemButton, ListItemButtonProps, IconButton, CircularProgress } from '@mui/material';
import { Add as AddIcon, ArrowBack as ArrowBackIcon, Edit as EditIcon, ContentPaste as PasteIcon, CheckCircle as SuccessIcon } from '@mui/icons-material';
import Link from 'next/link';
import { MEMO_COLOR } from '../utils/colors';
import { createEmptyMemo, createMemo, createMemoWithFile } from './actions';
import { useGlobalJobs } from '../context/GlobalJobContext';
import { useToast } from '../context/ToastContext';
import { useDevice } from '../context/DeviceContext';

export function MemoListFabs() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    
    // Check if on computer to decide whether to show Paste FAB
    // If we are on a computer, we assume drag & drop or global paste (Ctrl+V) is preferred/available
    const { isComputer } = useDevice();

    const { addClientJob, updateClientJob } = useGlobalJobs();
    const { showToast } = useToast();

    const handleCreate = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const memo = await createEmptyMemo();
            router.push(`/memos/${memo.id}/edit?new=true`);
        } catch (e) {
            console.error(e);
            setLoading(false);
            setLoading(false);
            showToast('メモ作成に失敗しました', 'error');
        }
    };

    const handlePasteCreate = async () => {
        if (loading) return;
        setLoading(true);
        try {
            // Try reading clipboard items first (support for images)
            try {
                // navigator.clipboard.read() is often restricted to images/text by browsers
                const items = await navigator.clipboard.read();
                let imageFound = false;

                for (const item of items) {
                    // Prioritize images
                    const imageType = item.types.find(t => t.startsWith('image/'));
                    if (imageType) {
                        const blob = await item.getType(imageType);
                        const file = new File([blob], "pasted_image.png", { type: imageType });
                        
                        const jobId = `paste-fab-${Date.now()}`;
                        try {
                            addClientJob({
                                id: jobId,
                                type: 'UPLOAD',
                                title: `アップロード: ${file.name}`,
                                payload: null
                            });

                            const formData = new FormData();
                            formData.append('file', file);
                            await createMemoWithFile(formData);

                            updateClientJob(jobId, { status: 'COMPLETED', progress: 100 });
                        } catch(err: any) {
                             updateClientJob(jobId, { status: 'FAILED', error: err.message || 'アップロード失敗' });
                             throw err;
                        }

                        router.refresh();
                        setLoading(false);
                        return;
                    }
                }
                
                // If we got items but found no images, it might be a file copy that browser doesn't expose as image
                // We should fall through to text check, but also potentiallly warn if we think the user INTENDED a file.
                // However, 'text/plain' often exists alongside files as the file path or name.
                // Let's just fall through to text. 
            } catch (err) {
                 // read() failed or denied. Fallback to readText()
                 console.warn('Clipboard.read failed, trying readText', err);
            }

            // Fallback to text
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                     await createMemo(text);
                     router.refresh();
                     return;
                }
            } catch (textErr) {
                console.error('readText failed', textErr);
            }

            // If we reached here, we couldn't handle the paste
            showToast('貼り付け可能なデータが見つかりませんでした。\n画像以外のファイルは、ボタンからの貼り付けに対応していない場合があります。\nその場合はドラッグ&ドロップをお試しください。', 'warning');
            
        } catch (e) {
            console.error(e);
            if (e instanceof Error && e.name === 'NotAllowedError') {
                 showToast('クリップボードへのアクセスが許可されていません', 'error');
            } else {
                 showToast('貼り付けに失敗しました', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
            {/* Only show Paste FAB if NOT on computer (i.e. mobile/tablet touch devices where global paste is harder) */}
            {!isComputer && (
                <Fab 
                    aria-label="paste" 
                    onClick={handlePasteCreate}
                    disabled={loading}
                    sx={{ bgcolor: 'background.paper', color: MEMO_COLOR, '&:hover': { bgcolor: 'action.hover' } }}
                >
                    {loading ? <CircularProgress size={24} color="inherit" /> : <PasteIcon />}
                </Fab>
            )}
            <Fab 
                aria-label="add" 
                onClick={handleCreate}
                disabled={loading}
                sx={{ bgcolor: MEMO_COLOR, color: '#fff', '&:hover': { opacity: 0.9, bgcolor: MEMO_COLOR } }}
            >
                {loading ? <CircularProgress size={24} color="inherit" /> : <AddIcon />}
            </Fab>
            <Fab 
                aria-label="back"
                component={Link}
                href="/"
                sx={{ bgcolor: 'background.paper', color: MEMO_COLOR, '&:hover': { bgcolor: 'action.hover' } }}
            >
                <ArrowBackIcon />
            </Fab>
        </Box>
    );
}

export function MemoListEditButton({ id }: { id: string }) {
    return (
        <IconButton 
            component={Link} 
            href={`/memos/${id}/edit`}
            edge="end" 
            aria-label="edit"
            sx={{ color: MEMO_COLOR }}
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
