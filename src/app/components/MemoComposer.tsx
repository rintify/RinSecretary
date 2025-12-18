'use client';

import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Box, Fab, CircularProgress, LinearProgress } from '@mui/material';
import { Check as CheckIcon, Close as CloseIcon, Delete as DeleteIcon, ArrowBack as ArrowBackIcon, Folder as FolderIcon } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import { createMemo, updateMemo, deleteMemo, uploadAttachment } from '@/app/memos/actions';
import { MEMO_COLOR } from '../utils/colors';
import { OnMount } from '@monaco-editor/react';
import SharedEditor from './SharedEditor';

interface MemoComposerProps {
    initialContent?: string;
    memoId?: string;
    onSuccess?: () => void;
    onDelete?: () => void;
    isNew?: boolean;
    showLineNumbers?: boolean;
    onFileManagementOpen?: () => void;
}

export interface MemoComposerRef {
    handleDelete: () => Promise<void>;
    handleSave: () => Promise<void>;
}

function generateTitle(content: string): string {
    const firstLine = content.split('\n')[0] || '';
    const title = firstLine.slice(0, 30).trim();
    return title || '無題のメモ';
}

const MemoComposer = forwardRef<MemoComposerRef, MemoComposerProps>(
    ({ initialContent = '', memoId, onSuccess, onDelete, isNew, showLineNumbers = false, onFileManagementOpen }, ref) => {
    const [content, setContent] = useState(initialContent);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [internalMemoId, setInternalMemoId] = useState<string | undefined>(memoId);
    
    const contentRef = useRef(content);
    const isSavedRef = useRef(false);
    const isSavingRef = useRef(false);

    const router = useRouter();

    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    // 自動保存用（APIルート + keepalive）
    const saveMemo = async (currentContent: string): Promise<string | undefined> => {
        if (isSavedRef.current || isSavingRef.current) return internalMemoId;
        // 内容が空かつ新規作成の場合は保存しない（無題メモ量産防止）
        if (!internalMemoId && !currentContent.trim()) return undefined;

        isSavingRef.current = true;
        
        const title = generateTitle(currentContent);

        try {
            const idToUse = internalMemoId; 
            const url = idToUse ? `/api/memos/${idToUse}` : '/api/memos';
            const method = idToUse ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content: currentContent }),
                keepalive: true
            });

            if (res.ok && !idToUse) {
                const data = await res.json();
                if (data.id) {
                    setInternalMemoId(data.id);
                    return data.id;
                }
            }
            return idToUse;
        } catch (e) {
            console.error('Auto Save failed', e);
            return internalMemoId;
        } finally {
            isSavingRef.current = false;
        }
    };

    // 手動保存（Server Actions）
    const handleManualSave = async () => {
        if (isSavedRef.current) return;
        isSavedRef.current = true;
        setLoading(true); 
        
        try {
            if (internalMemoId) {
                await updateMemo(internalMemoId, content);
            } else {
                await createMemo(content);
            }
            
            if (onSuccess) {
                onSuccess();
            } else {
                router.back();
            }
        } catch (e) {
            console.error('Manual save failed', e);
            isSavedRef.current = false;
            setLoading(false);
        }
    };

    // アンマウント時の自動保存
    useEffect(() => {
        return () => {
            if (!isSavedRef.current) {
                saveMemo(contentRef.current);
            }
        };
    }, []);

    // 削除処理（Server Actions）
    const handleDelete = async () => {
        if (!isNew && !confirm('このメモを削除しますか？')) return;
        
        isSavedRef.current = true;
        setLoading(true);

        try {
            if (internalMemoId) {
                await deleteMemo(internalMemoId);
            }
            if (onDelete) {
                onDelete();
            } else {
                router.replace('/memos');
            }
        } catch (e) {
            console.error('Delete failed', e);
            isSavedRef.current = false;
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({
        handleDelete,
        handleSave: handleManualSave
    }));

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (file) await uploadFile(file);
                return;
            }
        }
    };

    const uploadFile = async (file: File) => {
        setUploading(true);
        try {
            let id = internalMemoId;
            if (!id) {
                id = await saveMemo(content);
                if (!id) {
                     const newMemo = await createMemo(content || '無題のメモ');
                     setInternalMemoId(newMemo.id);
                     id = newMemo.id;
                }
            }

            if (!id) throw new Error('Could not determine memo ID');

            const formData = new FormData();
            formData.append('file', file);

            const attachment = await uploadAttachment(formData, id);
            
            const isImage = file.type.startsWith('image/');
            const markdown = isImage 
                ? `\n![${file.name}](${attachment.filePath})` 
                : `\n[${file.name}](${attachment.filePath})`;
            
            setContent(prev => prev + markdown + '\n');

        } catch (e) {
            console.error(e);
            alert('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const isEmpty = !content.trim();
    const showDelete = isNew && isEmpty;
    const isChanged = content !== initialContent;
    const showBack = !isNew && !isChanged;

    const handleFabClick = () => {
        if (showDelete) return handleDelete();
        if (showBack) return router.back();
        return handleManualSave();
    };

    const handleEditorMount: OnMount = (editor) => {
        // Additional setup if needed
    };

    return (
        <Box 
            sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'transparent' }}
            onPaste={handlePaste} 
        >
            {uploading && <LinearProgress color="primary" />}
            
            <Box flex={1} sx={{ overflow: 'hidden' }}>
                <SharedEditor
                    value={content}
                    onChange={(v: string) => {
                        setContent(v);
                        isSavedRef.current = false;
                    }}
                    onMount={handleEditorMount}
                    paddingBottom={160} // Increased padding for 2 FABs
                    paddingTop={8}
                    showLineNumbers={showLineNumbers}
                    backgroundColor="#f9f2fb"
                />
            </Box>

            <Box sx={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 3, zIndex: 1050, alignItems: 'center' }}>
                <Fab 
                    onClick={handleFabClick} 
                    disabled={loading || uploading}
                    aria-label={showDelete ? "delete" : (showBack ? "back" : "save")}
                    sx={{ 
                        bgcolor: (showDelete || showBack) ? 'background.paper' : MEMO_COLOR,
                        color: showDelete ? 'error.main' : (showBack ? MEMO_COLOR : '#fff'),
                        border: (showDelete || showBack) ? `1px solid ${alpha(showDelete ? '#d32f2f' : MEMO_COLOR, 0.2)}` : 'none',
                        '&:hover': { 
                            bgcolor: (showDelete || showBack) ? alpha(showDelete ? '#d32f2f' : MEMO_COLOR, 0.05) : MEMO_COLOR,
                            opacity: (showDelete || showBack) ? 1 : 0.9
                        } 
                    }}
                >
                    {loading ? <CircularProgress size={24} color="inherit" /> : (
                        showDelete ? <DeleteIcon /> : (showBack ? <ArrowBackIcon /> : <CheckIcon />)
                    )}
                </Fab>
                 {onFileManagementOpen && (
                    <Fab 
                        aria-label="files"
                        onClick={onFileManagementOpen}
                        sx={{ 
                            bgcolor: 'background.paper', 
                            color: MEMO_COLOR,
                            border: `1px solid ${alpha(MEMO_COLOR, 0.2)}`,
                            '&:hover': { bgcolor: alpha(MEMO_COLOR, 0.05) }
                        }}
                    >
                        <FolderIcon />
                    </Fab>
                 )}
            </Box>
        </Box>
    );
});

MemoComposer.displayName = 'MemoComposer';

export default MemoComposer;
