'use client';

import { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    List, ListItem, ListItemText, ListItemSecondaryAction, 
    IconButton, Button, Typography, Box, CircularProgress 
} from '@mui/material';
import { 
    Delete as DeleteIcon, 
    InsertDriveFile as FileIcon, 
    Close as CloseIcon, 
    CloudUpload as UploadIcon 
} from '@mui/icons-material';
import { getAttachments, deleteAttachment, uploadAttachment } from '@/app/memos/actions';
import { MEMO_COLOR } from '../utils/colors';

interface Attachment {
    id: string;
    fileName: string;
    filePath: string;
    fileSize: number;
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

    const handleDelete = async (id: string) => {
        if (!confirm('ファイルを削除しますか？')) return;
        try {
            await deleteAttachment(id);
            setAttachments(prev => prev.filter(f => f.id !== id));
        } catch (e) {
            alert('削除に失敗しました');
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true); // リスト全体をローディングにするよりかは、追加中は操作不能にする程度がいいが、簡単のため
        try {
            const formData = new FormData();
            formData.append('file', file);
            const newFile = await uploadAttachment(formData, memoId);
            setAttachments(prev => [newFile, ...prev]);
        } catch (e) {
            console.error(e);
            alert('アップロードに失敗しました');
        } finally {
            setLoading(false);
            e.target.value = ''; // Reset input
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
                    <List>
                        {attachments.map(file => (
                            <ListItem key={file.id}>
                                <FileIcon sx={{ mr: 2, color: 'text.secondary' }} />
                                <ListItemText 
                                    primary={
                                        <a href={file.filePath} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 500 }}>
                                            {file.fileName}
                                        </a>
                                    }
                                    secondary={`${formatSize(file.fileSize)} • ${new Date(file.createdAt).toLocaleString()}`} 
                                    secondaryTypographyProps={{ variant: 'caption' }}
                                />
                                <ListItemSecondaryAction>
                                    <IconButton edge="end" onClick={() => handleDelete(file.id)} size="small" sx={{ color: 'error.main' }}>
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </ListItemSecondaryAction>
                            </ListItem>
                        ))}
                    </List>
                )}
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
