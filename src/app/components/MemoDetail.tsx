'use client';

import { useState } from 'react';
import { Box, Fab, IconButton, Popover } from '@mui/material';
import { Edit as EditIcon, Info as InfoIcon, Folder as FolderIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import MemoHeader from './MemoHeader';
import MarkdownDisplay from './MarkdownDisplay';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MEMO_COLOR } from '../utils/colors';
import MemoFileManagement from './MemoFileManagement';

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

            <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
                 <MarkdownDisplay>
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
