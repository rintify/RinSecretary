'use client';

import { useState } from 'react';
import { Box, Fab, IconButton, Popover } from '@mui/material';
import { Edit as EditIcon, Info as InfoIcon, Folder as FolderIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import MemoHeader from './MemoHeader';
import MarkdownDisplay from './MarkdownDisplay';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MEMO_COLOR } from '../utils/colors';
import MemoFileManagement, { Attachment } from './MemoFileManagement';
import { getAttachments } from '../memos/actions';
import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { 
    InsertDriveFile as FileIcon, 
    PictureAsPdf as PdfIcon,
    AudioFile as AudioIcon,
    VideoFile as VideoIcon,
    TextSnippet as TextIcon
} from '@mui/icons-material';

interface MemoDetailProps {
    memo: {
        id: string;
        title: string;
        content: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
    };
}

export default function MemoDetail({ memo }: MemoDetailProps) {
    const router = useRouter();
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const [isFileManagementOpen, setIsFileManagementOpen] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    
    // Long press logic
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPress = useRef(false);

    useEffect(() => {
        loadAttachments();
    }, [memo.id, isFileManagementOpen]); // Reload when management modal closes to reflect changes

    const loadAttachments = async () => {
        try {
            const files = await getAttachments(memo.id);
            setAttachments(files);
        } catch (e) {
            console.error(e);
        }
    };

    const handleTouchStart = (file: Attachment) => {
        isLongPress.current = false;
        timerRef.current = setTimeout(() => {
            isLongPress.current = true;
            handleDownload(file);
        }, 800);
    };

    const handleTouchEnd = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const handleDownload = (file: Attachment) => {
        // Haptic feedback if available (optional)
        if (navigator.vibrate) navigator.vibrate(50);
        
        const link = document.createElement('a');
        link.href = file.filePath;
        link.download = file.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileClick = (file: Attachment) => {
        if (isLongPress.current) return;
        
        // Audio/Video: handled by inline controls if visible, but if clicking the card area:
        // Requirement: "その場で再生" (Play locally) implies controls are exposed.
        // If clicking non-control area, maybe open viewer or do nothing.
        // For simplicity, we just navigate to viewer for non-media types.
        
        if (file.mimeType.startsWith('video/') || file.mimeType.startsWith('audio/')) {
            // Do nothing on container click, let user interact with controls
            return; 
        }

        // Navigate to viewer for Text/PDF/Image/Others
        router.push(`/memos/files/${file.id}`);
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleInfoClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleInfoClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);

    const handleEditClick = () => {
        router.push(`/memos/${memo.id}/edit`);
    };

    return (
        <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }} className="memo-page-transition">
            <MemoHeader 
                title="メモ詳細" 
                actions={
                    <Box>
                        <IconButton onClick={() => setIsFileManagementOpen(true)} edge="end" sx={{ color: MEMO_COLOR, mr: 1 }}>
                            <FolderIcon />
                        </IconButton>
                        <IconButton onClick={handleInfoClick} edge="end" sx={{ color: MEMO_COLOR }}>
                            <InfoIcon />
                        </IconButton>
                    </Box>
                }
            />
            
            <MemoFileManagement 
                memoId={memo.id}
                open={isFileManagementOpen}
                onClose={() => setIsFileManagementOpen(false)}
            />
            
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleInfoClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                <Box sx={{ p: 2 }}>
                    <Box sx={{ mb: 1 }}>
                        <strong>作成日時:</strong> {new Date(memo.createdAt).toLocaleString()}
                    </Box>
                    <Box>
                        <strong>更新日時:</strong> {new Date(memo.updatedAt).toLocaleString()}
                    </Box>
                </Box>
            </Popover>

            <Box sx={{ flex: 1, p: 2, overflow: 'auto', paddingBottom: '100px' }}>
                 <MarkdownDisplay attachments={attachments}>
                    {memo.content}
                 </MarkdownDisplay>
            </Box>

            <Box sx={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                <Fab 
                    aria-label="back"
                    component={Link}
                    href="/memos"
                    sx={{ bgcolor: 'background.paper', color: MEMO_COLOR, '&:hover': { bgcolor: 'action.hover' } }}
                >
                    <ArrowBackIcon />
                </Fab>
                <Fab 
                    color="primary" 
                    aria-label="edit" 
                    onClick={handleEditClick}
                    sx={{ bgcolor: MEMO_COLOR, '&:hover': { bgcolor: MEMO_COLOR, opacity: 0.9 } }}
                >
                    <EditIcon />
                </Fab>
            </Box>
        </Box>
    );
}
