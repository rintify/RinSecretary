'use client';

import { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider, useTheme, useMediaQuery, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ArrowBack as ArrowBackIcon, Folder as FolderIcon, Delete as DeleteIcon, Check as CheckIcon, FormatListNumbered as LineNumberIcon, MoreVert as MoreVertIcon, Code as CodeIcon, Edit as EditIcon, FiberManualRecord as UnsavedIcon, Done as SavedIcon } from '@mui/icons-material';
import { CircularProgress, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import { MEMO_COLOR } from '@/app/utils/colors';
import MemoHeader from '@/app/components/MemoHeader';
import MemoComposer, { MemoComposerRef, SaveStatus } from '@/app/components/MemoComposer';
import MemoFileManagement, { Attachment } from '@/app/components/MemoFileManagement';
import { Fab } from '@mui/material';

interface MemoEditClientProps {
    memo: {
        id: string;
        content: string;
        updatedAt: Date;
    };
    isNew?: boolean;
}

export default function MemoEditClient({ memo, isNew }: MemoEditClientProps) {
    const router = useRouter();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const composerRef = useRef<MemoComposerRef>(null);
    const [isFileManagementOpen, setIsFileManagementOpen] = useState(false);
    const [showLineNumbers, setShowLineNumbers] = useState(false);
    const [editorMode, setEditorMode] = useState<'monaco' | 'plain'>(isMobile ? 'plain' : 'monaco');
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [lastSavedAt, setLastSavedAt] = useState<Date | undefined>(memo.updatedAt);
    const [timeDisplay, setTimeDisplay] = useState('');
    
    // Status Dialog State
    const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
    const handleStatusClick = () => {
        if (lastSavedAt) {
            updateTimeDisplay();
            setIsStatusDialogOpen(true);
        }
    };
    const handleStatusClose = () => setIsStatusDialogOpen(false);

    const updateTimeDisplay = () => {
        if (lastSavedAt) {
            setTimeDisplay(formatDistanceToNow(lastSavedAt, { addSuffix: true, locale: ja }));
        }
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isStatusDialogOpen && lastSavedAt) {
            updateTimeDisplay();
            interval = setInterval(updateTimeDisplay, 60000);
        }
        return () => clearInterval(interval);
    }, [isStatusDialogOpen, lastSavedAt]);

    // Menu State
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

    return (
        <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: '#f9f2fb', pt: '60px' }} className="memo-page-transition">
            <MemoHeader 
                title={isNew ? "新規メモ" : "メモ編集"}
                sx={{ 
                    bgcolor: '#f4eafa', 
                    color: 'text.primary',
                    borderBottom: 1,
                    borderColor: 'divider',
                    boxShadow: 'none'
                }}
                actions={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title={saveStatus === 'saved' ? "保存済み" : (saveStatus === 'saving' ? "保存中..." : "未保存")}>
                            <Box 
                                sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    color: 'text.secondary', 
                                    mr: 1,
                                    cursor: lastSavedAt ? 'pointer' : 'default'
                                }}
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
                        <Dialog
                            open={isStatusDialogOpen}
                            onClose={handleStatusClose}
                        >
                            <DialogTitle>保存状況</DialogTitle>
                            <DialogContent>
                                <DialogContentText>
                                    最終保存: {timeDisplay}
                                </DialogContentText>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={handleStatusClose} autoFocus>
                                    OK
                                </Button>
                            </DialogActions>
                        </Dialog>
                        <IconButton 
                            onClick={() => composerRef.current?.handleDelete()} 
                            sx={{ color: 'error.main' }}
                        >
                            <DeleteIcon />
                        </IconButton>
                        <IconButton
                            onClick={handleMenuOpen}
                            sx={{ color: 'text.secondary' }}
                        >
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
                    memoId={memo.id}
                    initialContent={memo.content}
                    onSuccess={() => router.push(`/memos/${memo.id}`)}
                    onBack={() => router.push(`/memos/${memo.id}`)}
                    isNew={isNew}
                    showLineNumbers={showLineNumbers}
                    onFileManagementOpen={() => setIsFileManagementOpen(true)}
                    editorMode={editorMode}
                    onSaveStatusChange={(status, date) => {
                        setSaveStatus(status);
                        if (date) setLastSavedAt(date);
                    }}
                    lastUpdatedAt={memo.updatedAt}
                />
            </Box>
            
            <MemoFileManagement 
                memoId={memo.id}
                open={isFileManagementOpen}
                onClose={() => setIsFileManagementOpen(false)}
                onSelect={handleFileSelect}
            />
        </Box>
    );
}
