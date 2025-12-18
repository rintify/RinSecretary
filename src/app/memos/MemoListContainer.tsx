'use client';

import { useState, useRef } from 'react';
import { 
    Box, List, ListItem, ListItemButton, ListItemText, 
    Checkbox, IconButton, Menu, MenuItem, Typography 
} from '@mui/material';
import { 
    MoreVert as MoreVertIcon, 
    Delete as DeleteIcon, 
    Close as CloseIcon, 
    Note as NoteIcon 
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import Image from 'next/image';
import MemoHeader from '../components/MemoHeader';
import { MemoListFabs, MemoListEditButton, MemoListItemButton } from './MemoListClient';
import { deleteMemos, createMemoWithFile } from './actions';
import { MEMO_COLOR } from '../utils/colors';
import { Folder as FolderIcon } from '@mui/icons-material';

type Attachment = {
    id: string;
    filePath: string;
    mimeType: string;
};

type Memo = {
    id: string;
    title: string;
    // content: string; // Removed for payload optimization
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    thumbnailPath?: string | null;
};

export default function MemoListContainer({ memos }: { memos: Memo[] }) {
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const dragCounter = useRef(0);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const startSelectionMode = () => {
        handleMenuClose();
        setIsSelectionMode(true);
        setSelectedIds(new Set());
    };

    const cancelSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
    };

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const executeDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`${selectedIds.size}件のメモを削除しますか？`)) return;

        await deleteMemos(Array.from(selectedIds));
        cancelSelectionMode();
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setUploading(true);
            const files = Array.from(e.dataTransfer.files);
            try {
                for (const file of files) {
                    const formData = new FormData();
                    formData.append('file', file);
                    await createMemoWithFile(formData);
                }
            } catch (error) {
                console.error('File upload failed', error);
                alert('ファイルのアップロードに失敗しました');
            } finally {
                setUploading(false);
            }
        }
    };

    return (
        <Box 
            sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', position: 'relative' }} 
            className="memo-page-transition"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Drag Overlay */}
            {isDragging && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        bgcolor: 'rgba(0, 0, 0, 0.1)',
                        zIndex: 2000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(2px)',
                        pointerEvents: 'none'
                    }}
                >
                    <Box
                        sx={{
                            bgcolor: 'background.paper',
                            p: 3,
                            borderRadius: 2,
                            boxShadow: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 1
                        }}
                    >
                        <FolderIcon sx={{ fontSize: 48, color: MEMO_COLOR }} />
                        <Box sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                            ファイルをドロップして新規メモを作成
                        </Box>
                    </Box>
                </Box>
            )}
            <MemoHeader 
                title={isSelectionMode ? `${selectedIds.size}件選択中` : "メモ一覧"} 
                actions={
                    isSelectionMode ? (
                        <Box>
                            <IconButton onClick={executeDelete} sx={{ color: 'error.main' }}>
                                <DeleteIcon />
                            </IconButton>
                            <IconButton onClick={cancelSelectionMode}>
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    ) : (
                        <Box>
                             <IconButton onClick={handleMenuOpen}>
                                <MoreVertIcon />
                            </IconButton>
                            <Menu
                                anchorEl={anchorEl}
                                open={Boolean(anchorEl)}
                                onClose={handleMenuClose}
                            >
                                <MenuItem onClick={startSelectionMode}>選択して削除</MenuItem>
                            </Menu>
                        </Box>
                    )
                }
            />
            
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                {memos.length === 0 ? (
                    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="50vh" color="text.secondary">
                        <NoteIcon sx={{ fontSize: 60, mb: 2, opacity: 0.5 }} />
                        <Typography>メモはありません</Typography>
                    </Box>
                ) : (
                    <List>
                        {memos.map(memo => {
                            const isSelected = selectedIds.has(memo.id);
                            // TaskItem風のデザインを適用
                            // Border color priority: Selection -> Default (MEMO_COLOR)
                            const borderColor = (isSelectionMode && isSelected) ? 'primary.main' : MEMO_COLOR;
                            
                            return (
                                <ListItem 
                                    key={memo.id} 
                                    disablePadding 
                                    sx={{ 
                                        mb: 1, 
                                        bgcolor: alpha(MEMO_COLOR, 0.1), 
                                        borderRadius: 3, 
                                        overflow: 'hidden',
                                        transition: 'all 0.2s',
                                        border: '1px solid',
                                        borderColor: borderColor,
                                        boxShadow: 'none',
                                    }}
                                    secondaryAction={
                                        isSelectionMode ? (
                                            <Checkbox 
                                                edge="end"
                                                checked={isSelected}
                                                onChange={() => toggleSelection(memo.id)}
                                                sx={{ 
                                                    color: MEMO_COLOR,
                                                    '&.Mui-checked': {
                                                        color: MEMO_COLOR,
                                                    },
                                                }}
                                            />
                                        ) : (
                                            <MemoListEditButton id={memo.id} />
                                        )
                                    }
                                >
                                    {isSelectionMode ? (
                                        <ListItemButton onClick={() => toggleSelection(memo.id)} sx={{ p: 1, pr: 8 }}>
                                           <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
                                                {/* サムネイルエリア */}
                                                <Box sx={{ 
                                                    mr: 2, 
                                                    flexShrink: 0, 
                                                    width: 48, 
                                                    height: 48, 
                                                    position: 'relative', 
                                                    borderRadius: 1, 
                                                    overflow: 'hidden', 
                                                    bgcolor: 'action.hover', // サムネイル背景は少し濃くするか、白にするか。
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {memo.thumbnailPath ? (
                                                        <Image 
                                                            src={memo.thumbnailPath} 
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
                                                    primary={memo.title} 
                                                    secondary={new Date(memo.updatedAt).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} 
                                                    primaryTypographyProps={{ fontWeight: 'bold' }}
                                                />
                                            </Box>
                                        </ListItemButton>
                                    ) : (
                                        <MemoListItemButton href={`/memos/${memo.id}`} sx={{ p: 1, pr: 8 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
                                                {/* サムネイルエリア */}
                                                <Box sx={{ 
                                                    mr: 2, 
                                                    flexShrink: 0, 
                                                    width: 56, 
                                                    height: 56, 
                                                    position: 'relative', 
                                                    borderRadius: 1, 
                                                    overflow: 'hidden', 
                                                    bgcolor: 'action.hover',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {memo.thumbnailPath ? (
                                                        <Image 
                                                            src={memo.thumbnailPath} 
                                                            alt="thumbnail" 
                                                            fill 
                                                            sizes="56px"
                                                            style={{ objectFit: 'cover' }} 
                                                        />
                                                    ) : (
                                                        <NoteIcon sx={{ fontSize: 28, color: 'text.secondary', opacity: 0.7 }} />
                                                    )}
                                                </Box>

                                                <ListItemText 
                                                    primary={memo.title} 
                                                    secondary={new Date(memo.updatedAt).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} 
                                                    primaryTypographyProps={{ fontWeight: 'bold', noWrap: true }}
                                                    secondaryTypographyProps={{ noWrap: true }}
                                                    sx={{ minWidth: 0, flex: 1 }}
                                                />
                                            </Box>
                                        </MemoListItemButton>
                                    )}
                                </ListItem>
                            );
                        })}
                    </List>
                )}
            </Box>

            {!isSelectionMode && <MemoListFabs />}
        </Box>
    );
}
