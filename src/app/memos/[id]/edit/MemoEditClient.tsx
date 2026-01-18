'use client';

import { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ArrowBack as ArrowBackIcon, Folder as FolderIcon, Delete as DeleteIcon, Check as CheckIcon, FormatListNumbered as LineNumberIcon, MoreVert as MoreVertIcon, Code as CodeIcon, Edit as EditIcon, FiberManualRecord as UnsavedIcon, Done as SavedIcon } from '@mui/icons-material';
import { CircularProgress, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import { MEMO_COLOR } from '@/app/utils/colors';
import { useDevice } from '@/app/context/DeviceContext';
import MemoHeader from '@/app/components/MemoHeader';
import MemoComposer, { MemoComposerRef, SaveStatus } from '@/app/components/MemoComposer';
import MemoFileManagement, { Attachment } from '@/app/components/MemoFileManagement';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { syncManager } from '@/lib/sync-manager';
import { useConfirm } from '@/app/context/ConfirmContext';
import { useToast } from '@/app/context/ToastContext';
import { deleteMemoLocally, cacheMemoFromServer } from '@/lib/memo-actions';

interface MemoEditClientProps {
    memo: {
        id: string;
        content: string;
        updatedAt: Date | string; // Allow string date from server component
        title?: string;
    };
    isNew?: boolean;
    userId: string;
}

export default function MemoEditClient({ memo: initialMemo, isNew, userId }: MemoEditClientProps) {
    const router = useRouter();
    const { isComputer } = useDevice();
    const composerRef = useRef<MemoComposerRef>(null);
    const [isFileManagementOpen, setIsFileManagementOpen] = useState(false);
    const [showLineNumbers, setShowLineNumbers] = useState(false);
    const [editorMode, setEditorMode] = useState<'monaco' | 'plain'>(isComputer ? 'monaco' : 'plain');
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    
    const { confirm } = useConfirm();
    const { showToast } = useToast();

    // Dexie: Live Query
    // initialMemo.id keeps stable, so this query is efficient.
    const localMemo = useLiveQuery(
        () => db.memos.get(initialMemo.id),
        [initialMemo.id]
    );

    // Initial Fetch / Cache Strategy
    useEffect(() => {
        // Cache memo from server
        cacheMemoFromServer({
            id: initialMemo.id,
            title: initialMemo.title,
            content: initialMemo.content,
            createdAt: initialMemo.updatedAt, // Approximate
            updatedAt: initialMemo.updatedAt,
            userId: userId
        });
        
        // Also sync/cache attachments for this memo
        const syncAttachments = async () => {
             if (!initialMemo.id || !navigator.onLine) return;
             
             try {
                 const { getAttachments } = await import('@/app/memos/actions');
                 const { OFFLINE_FILE_SIZE_LIMIT } = await import('@/lib/constants');
                 const { syncManager } = await import('@/lib/sync-manager');
                 
                 const serverFiles = await getAttachments(initialMemo.id);

                 
                // Upsert Attachments Metadata
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
                
                // No manual caching here. SW intercepts fetches if referenced!
                // But wait, if we don't fetch them, SW won't cache them.
                // We DO want to "prefetch" them so they are available offline even if user doesn't click them.
                // So we actually SHOULD fetch them here, but we don't need to manually verify cache.
                // Just firing `fetch(url)` is enough for SW to cache it.
                
                const filesToPrefetch = serverFiles.filter(f => f.fileSize <= OFFLINE_FILE_SIZE_LIMIT);
                if (filesToPrefetch.length > 0 && navigator.onLine) {
                     filesToPrefetch.forEach(f => {
                         if(f.filePath) fetch(f.filePath).catch(() => {});
                     });
                }
             } catch (e) {
                 console.error('Attachment sync failed', e);
             }
        };

        syncAttachments();
    }, [initialMemo]);

    const displayContent = localMemo?.content ?? initialMemo.content;
    const lastUpdatedAt = (localMemo?.updatedAt) ? new Date(localMemo.updatedAt) : new Date(initialMemo.updatedAt);
    const [lastSavedAt, setLastSavedAt] = useState<Date>(lastUpdatedAt);

    // Update lastSavedAt when localMemo updates (e.g. background save)
    useEffect(() => {
        if (localMemo) {
            setLastSavedAt(localMemo.updatedAt);
        }
    }, [localMemo?.updatedAt]);
    
    const [timeDisplay, setTimeDisplay] = useState('');
    const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);

    const handleStatusClick = () => {
        updateTimeDisplay();
        setIsStatusDialogOpen(true);
    };
    const handleStatusClose = () => setIsStatusDialogOpen(false);

    const updateTimeDisplay = () => {
        if (lastSavedAt) {
            setTimeDisplay(formatDistanceToNow(lastSavedAt, { addSuffix: true, locale: ja }));
        }
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isStatusDialogOpen) {
            updateTimeDisplay();
            interval = setInterval(updateTimeDisplay, 60000);
        }
        return () => clearInterval(interval);
    }, [isStatusDialogOpen, lastSavedAt]);

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    const handleToggleLineNumbers = () => {
        setShowLineNumbers(!showLineNumbers);
        handleMenuClose();
    };

    const handleToggleEditorMode = () => {
        setEditorMode(prev => prev === 'monaco' ? 'plain' : 'monaco');
        handleMenuClose();
    };

    const handleFileSelect = (file: Attachment) => {
        const isImage = file.mimeType.startsWith('image/');
        const markdown = isImage 
            ? `![${file.fileName}](${file.filePath})` 
            : `[${file.fileName}](${file.filePath})`;
        
        composerRef.current?.insertContent(markdown);
    };

    const handleDelete = async () => {
        if (!await confirm("本当に削除しますか？", { severity: 'error', confirmText: '削除', title: 'メモの削除' })) return;
        
        try {
            // Local Delete
            await deleteMemoLocally(initialMemo.id);
            
            syncManager.sync().catch(e => {
                console.error('Delete sync failed', e);
                // Global dialog will handle the error
            });
            
            showToast('削除しました', 'success');
            router.push('/memos');
        } catch (error) {
            showToast('削除に失敗しました', 'error');
            console.error(error);
        }
    };

    return (
        <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: '#f9f2fb', pt: '60px' }} className="memo-page-transition">
            <MemoHeader 
                title={isNew ? "新規メモ" : "メモ編集"}
                sx={{ 
                    bgcolor: '#f4eafa', 
                    color: 'text.primary',
                    borderBottom: 1, borderColor: 'divider', boxShadow: 'none'
                }}
                actions={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title={saveStatus === 'saved' ? "保存済み" : (saveStatus === 'saving' ? "保存中..." : "未保存")}>
                            <Box 
                                sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', mr: 1, cursor: 'pointer' }}
                                onClick={handleStatusClick}
                            >
                                {saveStatus === 'saving' ? (
                                    <CircularProgress size={20} color="inherit" />
                                ) : saveStatus === 'saved' ? (
                                    <SavedIcon sx={{ fontSize: 20, color: 'success.main' }} />
                                ) : (
                                    <UnsavedIcon sx={{ fontSize: 12, color: '#ff9800' }} />
                                )}
                            </Box>
                        </Tooltip>
                        <Dialog open={isStatusDialogOpen} onClose={handleStatusClose}>
                            <DialogTitle>保存状況</DialogTitle>
                            <DialogContent>
                                <DialogContentText>最終保存: {timeDisplay}</DialogContentText>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={handleStatusClose} autoFocus>OK</Button>
                            </DialogActions>
                        </Dialog>
                        <IconButton onClick={handleDelete} sx={{ color: 'error.main' }}>
                            <DeleteIcon />
                        </IconButton>
                        <IconButton onClick={handleMenuOpen} sx={{ color: 'text.secondary' }}>
                            <MoreVertIcon />
                        </IconButton>
                        <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl)}
                            onClose={handleMenuClose}
                        >
                            <MenuItem onClick={handleToggleLineNumbers}>
                                <ListItemIcon>
                                    <LineNumberIcon fontSize="small" color={showLineNumbers ? 'primary' : 'inherit'} />
                                </ListItemIcon>
                                <ListItemText>{showLineNumbers ? '行番号を隠す' : '行番号を表示'}</ListItemText>
                            </MenuItem>
                            <MenuItem onClick={handleToggleEditorMode}>
                                <ListItemIcon>
                                    {editorMode === 'monaco' ? <EditIcon fontSize="small" /> : <CodeIcon fontSize="small" />}
                                </ListItemIcon>
                                <ListItemText>{editorMode === 'monaco' ? '標準エディタに切替' : '高機能エディタに切替'}</ListItemText>
                            </MenuItem>
                        </Menu>
                    </Box>
                }
            />
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <MemoComposer 
                    ref={composerRef}
                    memoId={initialMemo.id}
                    initialContent={displayContent} // Dexie or Server prop
                    onSuccess={() => {/* handled by sync logic mostly */}}
                    onBack={() => router.push('/memos')}
                    isNew={isNew}
                    showLineNumbers={showLineNumbers}
                    onFileManagementOpen={() => setIsFileManagementOpen(true)}
                    editorMode={editorMode}
                    onSaveStatusChange={setSaveStatus}
                    lastUpdatedAt={lastUpdatedAt}
                    userId={userId}
                />
            </Box>
            
            <MemoFileManagement 
                memoId={initialMemo.id}
                open={isFileManagementOpen}
                onClose={() => setIsFileManagementOpen(false)}
                onSelect={handleFileSelect}
            />
        </Box>
    );
}
