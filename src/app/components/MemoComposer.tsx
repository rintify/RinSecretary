'use client';

import { useState, useRef } from 'react';
import { Box, TextField, Fab, CircularProgress, LinearProgress } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface MemoComposerProps {
    initialTitle?: string;
    initialContent?: string;
    memoId?: string; // If present, update. If absent, create.
    onSuccess?: (id: string) => void;
}

export default function MemoComposer({ initialTitle = '', initialContent = '', memoId, onSuccess }: MemoComposerProps) {
    const [title, setTitle] = useState(initialTitle);
    const [content, setContent] = useState(initialContent);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null); // For cursor position if needed, but TextField handles it
    const router = useRouter();

    const handleSave = async () => {
        if (!title.trim()) return;
        setLoading(true);

        try {
            const url = memoId ? `/api/memos/${memoId}` : '/api/memos';
            const method = memoId ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });

            if (!res.ok) throw new Error('Failed to save');
            
            const data = await res.json();
            if (onSuccess) {
                onSuccess(data.id);
            } else {
                router.push(`/memos/${data.id}`);
                router.refresh();
            }
        } catch (e) {
            console.error(e);
            alert('Save failed');
            setLoading(false);
        }
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (file) await uploadFile(file);
                return;
            }
        }
    };

    const uploadFile = async (file: File) => {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/uploads', {
                method: 'POST',
                body: formData
            });
            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            
            // Insert markdown at cursor? 
            // Simple append for now or try to insert
            // Since TextField doesn't expose cursor simply in controlled state without Ref magic, 
            // I'll just append to end or try to use document.activeElement if it is the textarea
            
            const markdown = `\n![image](${data.url})\n`;
            
            // Better: get selection start
            const activeEl = document.activeElement as HTMLTextAreaElement;
            if (activeEl && activeEl.name === 'content-input') {
                const start = activeEl.selectionStart;
                const end = activeEl.selectionEnd;
                const newContent = content.substring(0, start) + markdown + content.substring(end);
                setContent(newContent);
                // Need to restore cursor? React re-render might mess it up.
                // For MVP, appending or simple insertion is fine.
            } else {
                setContent(prev => prev + markdown);
            }

        } catch (e) {
            console.error(e);
            alert('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {uploading && <LinearProgress />}
            <Box p={2} flexShrink={0}>
                <TextField
                    placeholder="Title"
                    variant="standard"
                    fullWidth
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    slotProps={{ input: { style: { fontSize: '1.5rem', fontWeight: 'bold' } } }}
                />
            </Box>
            <Box p={2} flex={1} sx={{ overflowY: 'auto' }}>
                <TextField
                    name="content-input"
                    placeholder="Memo content (Markdown supported, Paste images allowed)"
                    multiline
                    fullWidth
                    minRows={10}
                    variant="standard"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    onPaste={handlePaste}
                    slotProps={{ input: { disableUnderline: true } }}
                    sx={{ height: '100%', '& .MuiInputBase-root': { alignItems: 'flex-start', height: '100%' } }}
                />
            </Box>
            <Fab 
                color="primary" 
                onClick={handleSave} 
                disabled={loading || uploading}
                sx={{ position: 'fixed', bottom: 16, right: 16 }}
            >
                {loading ? <CircularProgress size={24} color="inherit" /> : <SaveIcon />}
            </Fab>
        </Box>
    );
}
