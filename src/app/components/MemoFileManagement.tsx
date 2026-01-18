'use client';

import { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    List, ListItem, ListItemText, ListItemSecondaryAction, 
    IconButton, Button, Typography, Box, CircularProgress,
    Snackbar, ListItemButton, Menu, MenuItem, ListItemIcon,
    Badge, Tooltip
} from '@mui/material';
import { 
    Delete as DeleteIcon, 
    InsertDriveFile as FileIcon, 
    Close as CloseIcon, 
    CloudUpload as UploadIcon,
    Note as NoteIcon,
    MoreVert as MoreVertIcon,
    Download as DownloadIcon,
    CloudOff as CloudOffIcon,
    CloudDone as CloudDoneIcon,
    Sync as SyncIcon,
    CloudDownload as CloudDownloadIcon
} from '@mui/icons-material';
import Image from 'next/image';
import { getAttachments, deleteAttachment, uploadAttachment } from '@/app/memos/actions';
import { MEMO_COLOR } from '../utils/colors';
import { useGlobalJobs } from '../context/GlobalJobContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { OFFLINE_FILE_SIZE_LIMIT } from '@/lib/constants';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { syncManager } from '@/lib/sync-manager';
import { addAttachmentLocally, deleteAttachmentLocally } from '@/lib/memo-actions';

export interface Attachment {
    id: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    createdAt: Date;
    isDirty?: boolean; // UI only
}

interface MemoFileManagementProps {
    memoId: string;
    open: boolean;
    onClose: () => void;
    onSelect?: (file: Attachment) => void;
    onFilesChange?: () => void;
}

export default function MemoFileManagement({ memoId, open, onClose, onSelect, onFilesChange }: MemoFileManagementProps) {
    // Dexie Live Query: Local First
    const localAttachments = useLiveQuery(
        () => db.attachments.where('memoId').equals(memoId).reverse().sortBy('createdAt'),
        [memoId]
    );

    const [loading, setLoading] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

    const { addClientJob, updateClientJob } = useGlobalJobs();
    const { showToast } = useToast();
    const { confirm } = useConfirm();

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: string) => {
        setAnchorEl(event.currentTarget);
        setSelectedFileId(id);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedFileId(null);
    };

    // Sync Server Files to Local DB
    useEffect(() => {
        if (open && memoId && navigator.onLine) {
            syncFiles();
        }
    }, [open, memoId]);

    const syncFiles = async () => {
        setLoading(true);
        try {
            const serverFiles = await getAttachments(memoId);
            
            // Upsert server files to Dexie


            await db.transaction('rw', db.attachments, async () => {
                for (const sf of serverFiles) {
                    const existing = await db.attachments.get(sf.id);


                    await db.attachments.put({
                        id: sf.id,
                        memoId: sf.memoId,
                        fileName: sf.fileName,
                        fileSize: sf.fileSize,
                        mimeType: sf.mimeType,
                        createdAt: sf.createdAt,
                        filePath: sf.filePath,
                        lastAccessedAt: new Date(),
                        isDirty: false, 
                        blob: existing?.blob, 
                    });
                }
            });



        } catch (e) {
            console.error('Failed to sync files', e);
        } finally {
            setLoading(false);
        }
    };



    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const jobId = `upload-${Date.now()}`;
        
        try {
            // Check Size & Offline status
            const isOffline = !navigator.onLine;
            const isSmall = file.size <= OFFLINE_FILE_SIZE_LIMIT;

            if (isOffline && !isSmall) {
                showToast(`オフライン時は${OFFLINE_FILE_SIZE_LIMIT / 1024 / 1024}MB以下のファイルのみ追加可能です。`, 'error');
                setLoading(false);
                return;
            }

            // Create ID
            const id = crypto.randomUUID();

            addClientJob({
                id: jobId,
                type: 'UPLOAD',
                title: `アップロード: ${file.name}`,
                payload: null
            });

            // If small enough, save to Dexie first (Offline Support)
            if (isSmall) {
                // Ensure space
                await syncManager.checkAndGC(file.size);

                await addAttachmentLocally({
                    id,
                    memoId,
                    file,
                    fileName: file.name
                });

                // Trigger Background Sync
                syncManager.sync().catch(console.error);
                
                updateClientJob(jobId, { status: 'COMPLETED', progress: 100 });
                onFilesChange?.();
            } else {
                // Large file: Direct Upload (Online Only)
                 const formData = new FormData();
                formData.append('file', file);
                formData.append('id', id); // Use client ID

                const newFile = await uploadAttachment(formData, memoId);
                
                 // Also save metadata to Dexie so it appears immediately
                await db.attachments.put({
                    id: newFile.id,
                    memoId: newFile.memoId,
                    fileName: newFile.fileName,
                    fileSize: newFile.fileSize,
                    mimeType: newFile.mimeType,
                    createdAt: newFile.createdAt,
                    filePath: newFile.filePath,
                    lastAccessedAt: new Date(),
                    isDirty: false,
                    // No blob for large files
                });

                updateClientJob(jobId, { status: 'COMPLETED', progress: 100 });
                onFilesChange?.();
            }

        } catch (e: any) {
            console.error(e);
            updateClientJob(jobId, { status: 'FAILED', error: e.message || 'アップロード失敗' });
            showToast(e.message || 'アップロードに失敗しました', 'error');
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

    const handleDownloadClick = async () => {
        if (selectedFileId) {
            const file = localAttachments?.find(f => f.id === selectedFileId);
            if (file) {
                 // Check if we need to fetch and cache blob first (for < 5MB files that are missing blob)
                 // Or just download from URL if large
                 
                 let downloadUrl = '';
                 let revokeUrl = false;

                if (file.blob) {
                    downloadUrl = URL.createObjectURL(file.blob);
                    revokeUrl = true;
                } else {
                     // SW will handle caching on fetch if we just use the URL
                     downloadUrl = file.filePath || '';
                }

                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = file.fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                if (revokeUrl) {
                    setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
                }
            }
            handleMenuClose();
        }
    };

    const handleDelete = async (id: string) => {
        if (!await confirm('ファイルを削除しますか？', { severity: 'error', confirmText: '削除', title: 'ファイルの削除' })) return;
        try {
            await deleteAttachmentLocally(id, deleteAttachment);
            syncManager.sync().catch(console.error);
            
            onFilesChange?.();
            showToast('ファイルを削除しました', 'success');
        } catch (e) {
            showToast('削除に失敗しました', 'error');
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

    const handleItemClick = async (file: any) => { 
        if (onSelect) {
             const attachment: Attachment = {
                id: file.id,
                fileName: file.fileName,
                filePath: file.filePath || '',
                fileSize: file.fileSize,
                mimeType: file.mimeType,
                createdAt: file.createdAt
            };
            onSelect(attachment);
        } else {
             // View / Open logic
             // If we have blob, open it? Or copy link?
             // Main use case: Open/Preview
             
             // If image, we want to preview... but currently no preview modal here except thumbnail.
             // If we click, maybe we want to open it in new tab?
             
             // Let's implement "Open in new tab" with caching if possible
             
            let url = file.filePath;
            let needsRevoke = false;
            if (file.blob) {
                 url = URL.createObjectURL(file.blob);
                 needsRevoke = true;
            }
            
            // If file is not cached but is small, fetch it to view it also caches it via SW
            if (!file.blob && file.filePath && file.fileSize <= OFFLINE_FILE_SIZE_LIMIT) {
                   url = file.filePath; 
            }
            	// Else, large file or offline handling remains same (use path or blob)
            
            
            if (url) {
                window.open(url, '_blank');
                // Blob URL の解放（少し遅延させて新しいタブで読み込ませる）
                if (needsRevoke) {
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
            }
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // ローカルキャッシュボタンのハンドラ
    const handleCacheAllFiles = async () => {
        const filesToCache = (localAttachments || []).filter(
            f => !f.isDeleted && !f.blob && f.fileSize <= OFFLINE_FILE_SIZE_LIMIT && f.filePath
        );

        if (filesToCache.length === 0) {
            showToast('キャッシュ対象のファイルはありません', 'info');
            return;
        }

        setLoading(true);
        let cached = 0;
        let failed = 0;

        for (const file of filesToCache) {
            try {
                const response = await fetch(file.filePath!);
                if (!response.ok) throw new Error('Fetch failed');
                const blob = await response.blob();

                await db.attachments.update(file.id, {
                    blob,
                    mimeType: file.mimeType || blob.type,
                    lastAccessedAt: new Date(),
                });
                cached++;
            } catch (e) {
                console.error('Cache failed for', file.id, e);
                failed++;
            }
        }

        setLoading(false);
        if (failed > 0) {
            showToast(`${cached}件キャッシュ、${failed}件失敗`, 'warning');
        } else {
            showToast(`${cached}件のファイルをキャッシュしました`, 'success');
        }
    };

    // Render logic
    const displayedAttachments = localAttachments || [];

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" disableScrollLock>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                添付ファイル管理
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0 }}>
                {loading && displayedAttachments.length === 0 ? (
                    <Box display="flex" justifyContent="center" p={3}>
                        <CircularProgress sx={{ color: MEMO_COLOR }} />
                    </Box>
                ) : displayedAttachments.length === 0 ? (
                    <Typography color="text.secondary" align="center" py={3}>
                        ファイルはありません
                    </Typography>
                ) : (
                    <List disablePadding>
                        {displayedAttachments.filter(f => !f.isDeleted).map(file => (
                            <AttachmentListItem 
                                key={file.id} 
                                file={file} 
                                onClick={() => handleItemClick(file)}
                                onMenuOpen={(e) => handleMenuOpen(e, file.id)}
                            />
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
                <Button component="label" startIcon={<UploadIcon />} sx={{ color: MEMO_COLOR }}>
                    ファイルを追加
                    <input type="file" hidden onChange={handleUpload} />
                </Button>
                <Button 
                    startIcon={<CloudDownloadIcon />} 
                    onClick={handleCacheAllFiles}
                    disabled={loading}
                    sx={{ color: MEMO_COLOR, mr: 'auto' }}
                >
                    キャッシュ
                </Button>
                <Button onClick={onClose} sx={{ color: 'text.secondary' }}>閉じる</Button>
            </DialogActions>
        </Dialog>
    );
}

function AttachmentListItem({ file, onClick, onMenuOpen }: { file: any, onClick: () => void, onMenuOpen: (e: React.MouseEvent<HTMLElement>) => void }) {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    useEffect(() => {
        if (file.blob && file.mimeType.startsWith('image/')) {
            const url = URL.createObjectURL(file.blob);
            setObjectUrl(url);
            return () => {
                URL.revokeObjectURL(url);
            };
        }
        return undefined;
    }, [file.blob, file.mimeType]);

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <ListItem divider disablePadding>
            <ListItemButton onClick={onClick} sx={{ py: 1, px: 2 }}>
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
                            src={objectUrl || file.filePath || ''} 
                            alt="thumbnail" 
                            fill 
                            sizes="48px"
                            style={{ objectFit: 'cover' }} 
                            onError={(e) => { /* Fallback? */ }}
                        />
                    ) : (
                        <NoteIcon sx={{ fontSize: 24, color: 'text.secondary', opacity: 0.7 }} />
                    )}
                </Box>
                <ListItemText 
                    primary={
                        <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {file.fileName}
                            </Typography>
                            {/* Badge Logic */}
                            {file.isDirty ? (
                                <Tooltip title="未同期 (オフライン)">
                                    <Badge color="warning" variant="dot">
                                        <CloudOffIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                                    </Badge>
                                </Tooltip>
                            ) : !file.blob ? (
                                <Tooltip title="クラウドのみ (ローカル未保存)">
                                    <CloudDoneIcon sx={{ fontSize: 18, color: 'success.light', opacity: 0.5 }} />
                                </Tooltip>
                            ) : (
                                <Tooltip title="同期済み (端末に保存済み)">
                                    <CloudDoneIcon sx={{ fontSize: 18, color: 'success.main' }} />
                                </Tooltip>
                            )}
                            {file.fileSize > OFFLINE_FILE_SIZE_LIMIT && file.isDirty && (
                                    <Tooltip title="サイズ超過のためオフライン同期不可">
                                    <Badge color="error" variant="dot">
                                        <CloudOffIcon sx={{ fontSize: 16, color: 'error.main' }} />
                                    </Badge>
                                </Tooltip>
                            )}
                        </Box>
                    }
                    secondary={`${formatSize(file.fileSize)} • ${new Date(file.createdAt).toLocaleString()}`} 
                    secondaryTypographyProps={{ variant: 'caption' }}
                    sx={{ minWidth: 0 }}
                />
            </ListItemButton>
            <ListItemSecondaryAction sx={{ right: 8 }}>
                <IconButton edge="end" onClick={onMenuOpen} size="small">
                    <MoreVertIcon fontSize="small" />
                </IconButton>
            </ListItemSecondaryAction>
        </ListItem>
    );
}
