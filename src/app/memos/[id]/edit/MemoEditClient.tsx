'use client';

import { useState, useRef } from 'react';
import { Box, IconButton } from '@mui/material';
import { ArrowBack as ArrowBackIcon, Folder as FolderIcon, Delete as DeleteIcon, Check as CheckIcon, FormatListNumbered as LineNumberIcon } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import { MEMO_COLOR } from '@/app/utils/colors';
import MemoHeader from '@/app/components/MemoHeader';
import MemoComposer, { MemoComposerRef } from '@/app/components/MemoComposer';
import MemoFileManagement, { Attachment } from '@/app/components/MemoFileManagement';
import { Fab } from '@mui/material';

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
    const [showLineNumbers, setShowLineNumbers] = useState(false);

    const handleFileSelect = (file: Attachment) => {
        const isImage = file.mimeType.startsWith('image/');
        const markdown = isImage 
            ? `![${file.fileName}](${file.filePath})` 
            : `[${file.fileName}](${file.filePath})`;
        
        composerRef.current?.insertContent(markdown);
    };

    return (
        <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: '#f9f2fb' }} className="memo-page-transition">
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
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                         <IconButton 
                            onClick={() => setShowLineNumbers(!showLineNumbers)}
                            sx={{ color: showLineNumbers ? MEMO_COLOR : 'text.secondary' }}
                        >
                            <LineNumberIcon />
                        </IconButton>
                        <IconButton 
                            onClick={() => composerRef.current?.handleDelete()} 
                            sx={{ color: 'error.main' }}
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
                    onSuccess={() => router.push('/memos')}
                    isNew={isNew}
                    showLineNumbers={showLineNumbers}
                    onFileManagementOpen={() => setIsFileManagementOpen(true)}
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
