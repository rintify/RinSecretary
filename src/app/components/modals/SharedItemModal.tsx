'use client';

import React, { useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, Typography, Box, Paper, IconButton
} from '@mui/material';
import { 
    InsertDriveFile as FileIcon, 
    Download as DownloadIcon,
    NoteAdd as MemoIcon, 
    Close as CloseIcon 
} from '@mui/icons-material';
import { saveSharedFileToMemo } from '@/app/actions/shared-file';

import { deleteSharedFile } from '@/app/actions/shared-file';
import { useToast } from '@/app/context/ToastContext';

export interface SharedFile {
    id: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    createdAt: Date;
    mimeType: string;
}

interface SharedItemModalProps {
    open: boolean;
    onClose: () => void;
    sharedFile: SharedFile | null;
}

export default function SharedItemModal({ open, onClose, sharedFile }: SharedItemModalProps) {
    const [saving, setSaving] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const { showToast } = useToast();

    // Keep active if owner and open? 
    // Actually the requirement is "onClose" -> delete.
    // So as long as it is open, it exists. 
    
    React.useEffect(() => {
        if (sharedFile) {
            const uploadedId = sessionStorage.getItem('rin_last_uploaded_id');
            setIsOwner(uploadedId === sharedFile.id);
        }
    }, [sharedFile]);

    if (!sharedFile) return null;

    const handleClose = async () => {
        if (isOwner) {
            try {
                // Should we delete immediately or let the user know?
                // User requirement: "If uploader closes, delete it"
                await deleteSharedFile(sharedFile.id);
            } catch (e) {
                console.error('Failed to delete shared file', e);
            }
        }
        onClose();
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = sharedFile.filePath;
        link.download = sharedFile.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSaveToMemo = async () => {
        setSaving(true);
        try {
            await saveSharedFileToMemo(sharedFile.id);
            showToast('メモに保存しました', 'success');
            // If saved, do we still delete on close?
            // "Save to memo" makes a copy. The shared temporary file can still be deleted.
            // But if they save, maybe they want to keep the shared link active?
            // Requirement says "If uploader closes modal".
            // It doesn't specify exceptions. I will stick to "delete on close".
            // If they want to keep sharing, they need to keep the modal open?
            // That seems strict but matches "delete on close".
            handleClose(); 
        } catch (e) {
            console.error(e);
            showToast('保存に失敗しました', 'error');
            setSaving(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // Check if localhost (simple check)
    // In strict env, we might want to check window.location.hostname
    // But for now, we'll allow it if the feature is just for the user.
    // The requirement says: "from other PC... download... (don't need save to memo)".
    // So we should hide "Save to Memo" if not on the main machine?
    // User said: "別環境からはメモ保存は選択できなくて良い" (From other env, memo save doesn't need to be selectable).
    // It doesn't say "MUST NOT", just "doesn't need".
    // I'll leave it enabled for simplicity unless I can easily detect "owner".
    // Actually, `devAuth` protects the action. If other PC is logged in as same user, they CAN save.
    // If they are not logged in... well, the app requires login usually?
    // "RinSecretary" seems to be single user or dev-auth.
    // I'll assume if they can see the modal, they are authorized.
    
    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                bgcolor: isOwner ? 'warning.light' : 'background.paper',
                color: isOwner ? 'warning.contrastText' : 'text.primary'
            }}>
                {isOwner ? 'ファイルを共有中 (あなたがオーナー)' : '共有されたアイテム'}
                <IconButton onClick={handleClose} size="small" sx={{ color: 'inherit' }}><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
                <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ 
                        width: 50, height: 50, 
                        bgcolor: 'primary.light', 
                        color: 'primary.contrastText',
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        borderRadius: 1, mr: 2
                    }}>
                        <FileIcon />
                    </Box>
                    <Box sx={{ overflow: 'hidden' }}>
                        <Typography variant="subtitle1" noWrap title={sharedFile.fileName}>
                            {sharedFile.fileName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {formatSize(sharedFile.fileSize)}
                        </Typography>
                    </Box>
                </Paper>

                {isOwner && (
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: 'error.50', color: 'error.main', borderRadius: 1, border: '1px solid', borderColor: 'error.main' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            ⚠️ この画面を閉じると共有は終了し、ファイルは削除されます。
                        </Typography>
                    </Box>
                )}
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button 
                        variant="outlined" 
                        startIcon={<DownloadIcon />} 
                        fullWidth 
                        onClick={handleDownload}
                    >
                        ダウンロード
                    </Button>
                    <Button 
                        variant="contained" 
                        startIcon={<MemoIcon />} 
                        fullWidth 
                        onClick={handleSaveToMemo}
                        disabled={saving}
                    >
                        {saving ? '保存中...' : 'メモに保存'}
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
