'use client';

import { useState } from 'react';
import { Box, Fab, Typography } from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import MemoHeader from './MemoHeader';
import MemoComposer from './MemoComposer';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css'; // Ensure CSS is imported if needed, usually in globals or layout

interface MemoDetailProps {
    memo: {
        id: string;
        title: string;
        content: string;
        updatedAt: Date;
    };
}

export default function MemoDetail({ memo }: MemoDetailProps) {
    const [isEditing, setIsEditing] = useState(false);
    // Local state to update immediately after edit without full refresh (optional, MemoComposer triggers router.refresh)
    
    // MemoComposer onSuccess checks:
    // If I pass onSuccess, I should handle refresh or state update.
    // If I don't pass onSuccess, it redirects to /memos/[id].
    // Since I am ON /memos/[id], the router.push might be redundant but router.refresh() is good.
    // But if I want to exit edit mode, I need to know.
    
    const handleSuccess = () => {
        setIsEditing(false);
        // Data refresh happens via router.refresh in Composer if I don't override it completely?
        // Wait, MemoComposer: if(onSuccess) onSuccess else { push; refresh; }
        // So I should pass onSuccess to setEditing(false) AND I need to refresh data?
        // Actually, if I use router.refresh() in parent, it might be better.
        // Let's rely on Next.js Server Component refresh.
        window.location.reload(); // Simple brute force or use router.refresh()
    };

    if (isEditing) {
        return (
            <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
                <MemoHeader title="メモ編集" onBack={() => setIsEditing(false)} />
                <Box sx={{ flex: 1, overflow: 'hidden' }}>
                    <MemoComposer 
                        memoId={memo.id} 
                        initialTitle={memo.title} 
                        initialContent={memo.content} 
                        onSuccess={handleSuccess} 
                    />
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <MemoHeader title="メモ詳細" backUrl="/memos" />
            
            <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom>{memo.title}</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                    {new Date(memo.updatedAt).toLocaleString()}
                </Typography>
                
                <Box 
                    className="markdown-body" 
                    sx={{ 
                        '& img': { maxWidth: '100%', borderRadius: 2 },
                        '& a': { color: 'primary.main', textDecoration: 'underline' },
                        '& p': { lineHeight: 1.7 },
                        whiteSpace: 'pre-wrap' // Handle newlines if markdown doesn't
                    }}
                >
                    <ReactMarkdown
                        remarkPlugins={[remarkMath, remarkGfm, remarkBreaks]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                            a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" />
                        }}
                    >
                        {memo.content}
                    </ReactMarkdown>
                </Box>
            </Box>

            <Fab 
                color="primary" 
                onClick={() => setIsEditing(true)}
                sx={{ position: 'fixed', bottom: 16, right: 16 }}
            >
                <EditIcon />
            </Fab>
        </Box>
    );
}
