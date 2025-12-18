'use client';

import { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    List, ListItem, ListItemText, ListItemSecondaryAction, 
    IconButton, Button, Typography, Box, CircularProgress,
    Snackbar, ListItemButton
} from '@mui/material';
import { 
    Delete as DeleteIcon, 
    InsertDriveFile as FileIcon, 
    Close as CloseIcon, 
    CloudUpload as UploadIcon,
    Note as NoteIcon
} from '@mui/icons-material';
import Image from 'next/image';
import { getAttachments, deleteAttachment, uploadAttachment } from '@/app/memos/actions';
import { MEMO_COLOR } from '../utils/colors';

export interface Attachment {
    id: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    createdAt: Date;
}

interface MemoFileManagementProps {
    memoId: string;
    open: boolean;
    onClose: () => void;
}

export default function MemoFileManagement({ memoId, open, onClose }: MemoFileManagementProps) {
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [loading, setLoading] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);

    useEffect(() => {
        if (open && memoId) {
            loadFiles();
        }
    }, [open, memoId]);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const files = await getAttachments(memoId);
            setAttachments(files);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const newFile = await uploadAttachment(formData, memoId);
            setAttachments(prev => [newFile, ...prev]);
        } catch (e: any) {
            console.error(e);
            alert(e.message || 'アップロードに失敗しました');
        } finally {
            setLoading(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('ファイルを削除しますか？')) return;
        try {
            await deleteAttachment(id);
            setAttachments(prev => prev.filter(f => f.id !== id));
        } catch (e) {
            alert('削除に失敗しました');
        }
    };


    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setSnackbarOpen(true);
        } catch (e) {
            console.error('Copy failed', e);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                添付ファイル管理
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                {loading && attachments.length === 0 ? (
                    <Box display="flex" justifyContent="center" p={3}>
                        <CircularProgress sx={{ color: MEMO_COLOR }} />
                    </Box>
                ) : attachments.length === 0 ? (
                    <Typography color="text.secondary" align="center" py={3}>
                        ファイルはありません
                    </Typography>
                ) : (
                    <List disablePadding>
                        {attachments.map(file => (
                            <ListItem key={file.id} divider disablePadding>
                                <ListItemButton onClick={() => handleCopy(file.filePath)} sx={{ py: 1, px: 2 }}>
                                    <Box sx={{ 
                                        mr: 2, 
                                        flexShrink: 0, 
                                        width: 48, 
                                        height: 48, 
                                        position: 'relative', 
                                        borderRadius: 1, 
                                        overflow: 'hidden', 
                                        bgcolor: 'action.hover',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {file.mimeType.startsWith('image/') ? (
                                            <Image 
                                                src={file.filePath} 
                                                alt="thumbnail" 
                                                fill 
                                                sizes="48px"
                                                style={{ objectFit: 'cover' }} 
                                            />
                                        ) : (
                                            <NoteIcon sx={{ fontSize: 24, color: 'text.secondary', opacity: 0.7 }} />
                                        )}
                                    </Box>
                                    <ListItemText 
                                        primary={
                                            <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {file.fileName}
                                            </Typography>
                                        }
                                        secondary={`${formatSize(file.fileSize)} • ${new Date(file.createdAt).toLocaleString()}`} 
                                        secondaryTypographyProps={{ variant: 'caption' }}
                                        sx={{ minWidth: 0 }}
                                    />
                                </ListItemButton>
                                <ListItemSecondaryAction sx={{ right: 8 }}>
                                    <IconButton edge="end" onClick={() => handleDelete(file.id)} size="small" sx={{ color: 'error.main' }}>
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </ListItemSecondaryAction>
                            </ListItem>
                        ))}
                    </List>
                )}
                <Snackbar
                    open={snackbarOpen}
                    autoHideDuration={700}
                    onClose={() => setSnackbarOpen(false)}
                    message="リンクをコピーしました"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                />
            </DialogContent>
            <DialogActions>
                <Button component="label" startIcon={<UploadIcon />} sx={{ color: MEMO_COLOR, mr: 'auto' }}>
                    ファイルを追加
                    <input type="file" hidden onChange={handleUpload} />
                </Button>
                <Button onClick={onClose} sx={{ color: 'text.secondary' }}>閉じる</Button>
            </DialogActions>
        </Dialog>
    );
}
