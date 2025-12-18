'use client';

import { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    List, ListItem, ListItemText, ListItemSecondaryAction, 
    IconButton, Button, Typography, Box, CircularProgress,
    Snackbar, ListItemButton, Menu, MenuItem, ListItemIcon
} from '@mui/material';
import { 
    Delete as DeleteIcon, 
    InsertDriveFile as FileIcon, 
    Close as CloseIcon, 
    CloudUpload as UploadIcon,
    Note as NoteIcon,
    MoreVert as MoreVertIcon,
    Download as DownloadIcon
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
    onSelect?: (file: Attachment) => void;
}

export default function MemoFileManagement({ memoId, open, onClose, onSelect }: MemoFileManagementProps) {
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [loading, setLoading] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: string) => {
        setAnchorEl(event.currentTarget);
        setSelectedFileId(id);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedFileId(null);
    };

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

    const handleDeleteClick = () => {
        if (selectedFileId) {
            handleDelete(selectedFileId);
            handleMenuClose();
        }
    };

    const handleDownloadClick = () => {
        if (selectedFileId) {
            const file = attachments.find(f => f.id === selectedFileId);
            if (file) {
                const link = document.createElement('a');
                link.href = file.filePath;
                link.download = file.fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            handleMenuClose();
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

    const handleItemClick = (file: Attachment) => {
        if (onSelect) {
            onSelect(file);
            onClose(); // Optional: close modal after selection if desired, or keep open. 
            // Usually insert -> close is better UX for "insert", but user didn't specify.
            // Let's assume we keep it open or let parent decide? 
            // Actually, for "insert at caret", closing is usually expected?
            // User request: "click item -> insert at caret".
            // Let's NOT close it automatically unless standard behavior suggests so.
            // But wait, if they want to insert multiple, keeping open is good.
            // If I look at `MemoEditClient`, passing `onSelect` usually implies action.
            // Let's keep it open for now, consistent with "copy" behavior.
        } else {
            handleCopy(file.filePath);
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
            <DialogContent dividers sx={{ p: 0 }}>
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
                                <ListItemButton onClick={() => handleItemClick(file)} sx={{ py: 1, px: 2 }}>
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
                                    <IconButton edge="end" onClick={(e) => handleMenuOpen(e, file.id)} size="small">
                                        <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                </ListItemSecondaryAction>
                            </ListItem>
                        ))}
                    </List>
                )}
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                >
                     <MenuItem onClick={handleDownloadClick}>
                        <ListItemIcon>
                            <DownloadIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>ダウンロード</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
                        <ListItemIcon>
                            <DeleteIcon fontSize="small" color="error" />
                        </ListItemIcon>
                        <ListItemText>削除</ListItemText>
                    </MenuItem>
                </Menu>
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
