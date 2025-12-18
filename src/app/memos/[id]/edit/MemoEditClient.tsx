'use client';

import { useState, useRef } from 'react';
import { Box, IconButton } from '@mui/material';
import { Folder as FolderIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import { MEMO_COLOR } from '@/app/utils/colors';
import MemoHeader from '@/app/components/MemoHeader';
import MemoComposer, { MemoComposerRef } from '@/app/components/MemoComposer';
import MemoFileManagement from '@/app/components/MemoFileManagement';

interface MemoEditClientProps {
    memo: {
        id: string;
        content: string;
    };
    isNew?: boolean;
}

export default function MemoEditClient({ memo, isNew }: MemoEditClientProps) {
    const router = useRouter();
    const composerRef = useRef<MemoComposerRef>(null);
    const [isFileManagementOpen, setIsFileManagementOpen] = useState(false);

    return (
        <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: alpha(MEMO_COLOR, 0.1) }} className="memo-page-transition">
            <MemoHeader 
                title={isNew ? "新規メモ" : "メモ編集"}
                sx={{ bgcolor: MEMO_COLOR, color: 'common.white' }}
                actions={
                    <Box>
                         <IconButton 
                            onClick={() => setIsFileManagementOpen(true)} 
                            edge="end" 
                            sx={{ color: 'common.white', mr: 1 }}
                        >
                            <FolderIcon />
                        </IconButton>
                        <IconButton 
                            onClick={() => composerRef.current?.handleDelete()} 
                            edge="end" 
                            sx={{ color: 'common.white' }}
                        >
                            <DeleteIcon />
                        </IconButton>
                    </Box>
                }
            />
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <MemoComposer 
                    ref={composerRef}
                    memoId={memo.id}
                    initialContent={memo.content}
                    onSuccess={() => router.back()}
                    isNew={isNew}
                />
            </Box>
            
            <MemoFileManagement 
                memoId={memo.id}
                open={isFileManagementOpen}
                onClose={() => setIsFileManagementOpen(false)}
            />
        </Box>
    );
}
