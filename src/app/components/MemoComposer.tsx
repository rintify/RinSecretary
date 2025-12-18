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
    insertContent: (text: string) => void;
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
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);
    
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

    const editorInstanceRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
        handleDelete,
        handleSave: handleManualSave,
        insertContent: (text: string) => {
            if (editorInstanceRef.current) {
                const editor = editorInstanceRef.current;
                const contribution = editor.getContribution('snippetController2');
                if (contribution) {
                    contribution.insert(text);
                } else {
                    const position = editor.getPosition();
                    editor.executeEdits('insert-content', [{
                        range: {
                            startLineNumber: position?.lineNumber || 1,
                            startColumn: position?.column || 1,
                            endLineNumber: position?.lineNumber || 1,
                            endColumn: position?.column || 1,
                        },
                        text: text
                    }]);
                }
                editor.focus();
            }
        }
    }));

    const handlePaste = async (e: React.ClipboardEvent | ClipboardEvent) => {
        // e.clipboardData is distinct in React vs Native event, but both have it (React wraps it). 
        // We need to handle potential nulls if using native events blindly, though usually it's there.
        const clipboardData = (e as any).clipboardData || (window as any).clipboardData;
        if (!clipboardData) return;

        const items = clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                e.preventDefault();
                (e as any).stopImmediatePropagation?.(); // Stop Monaco from handling it if we found a file
                const file = items[i].getAsFile();
                if (file) await uploadFile(file);
                return;
            }
        }
    };

    // Ref to hold the latest handlePaste so the listener always uses fresh state (closures)
    const handlePasteRef = useRef(handlePaste);
    useEffect(() => {
        handlePasteRef.current = handlePaste;
    });

    // Clean up listener when component unmounts
    useEffect(() => {
        return () => {
            if (editorInstanceRef.current) {
                // We can't verify easily if we added the EXACT same function reference unless we saved it.
                // Given the complexity of mixing React lifecycle with Monaco lifecycle,
                // let's try to just trust the DOM node removal cleans listeners, 
                // OR promote editor instance to state to use in useEffect.
            }
        };
    }, []);

    // Promoting editor to state to handle listener lifecycle properly
    const [editorInstance, setEditorInstance] = useState<any>(null);

    useEffect(() => {
        if (!editorInstance) return;
        
        const listener = (e: ClipboardEvent) => {
             // Only handle if editor has focus to avoid intercepting pastes in other inputs (if any)
             // Although this is a full page component, better to be safe.
             if (editorInstance.hasWidgetFocus()) {
                 handlePasteRef.current(e);
             }
        };

        // Attach to window to ensure we catch it no matter what Monaco does
        window.addEventListener('paste', listener, true);
        return () => {
            window.removeEventListener('paste', listener, true);
        };
    }, [editorInstance]);


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
            const files = Array.from(e.dataTransfer.files);
            // Process sequentially to maintain rudimentary order or just handle one by one
            for (const file of files) {
                await uploadFile(file);
            }
            e.dataTransfer.clearData();
        }
    };

    const uploadFile = async (file: File) => {
        setUploading(true);
        try {
            let id = internalMemoId;
            if (!id) {
                id = await saveMemo(contentRef.current); // Use ref for current content
                if (!id) {
                     const newMemo = await createMemo(contentRef.current || '無題のメモ');
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
            
            // Insert at cursor position if editor is available
            if (editorInstanceRef.current) {
                const editor = editorInstanceRef.current;
                const contribution = editor.getContribution('snippetController2');
                if (contribution) {
                    contribution.insert(markdown);
                } else {
                    const position = editor.getPosition();
                    const range = {
                        startLineNumber: position?.lineNumber || 1,
                        startColumn: position?.column || 1,
                        endLineNumber: position?.lineNumber || 1,
                        endColumn: position?.column || 1,
                    };
                    editor.executeEdits('insert-upload', [{
                        range: range,
                        text: markdown,
                        forceMoveMarkers: true
                    }]);
                }
                // Push change to state immediately so standard onChange handles it
                // Actually SharedEditor onChange might be enough if executeEdits triggers it. 
                // Monaco executeEdits usually DOES trigger ModelContentChanged.
                // However, let's ensure we focus back.
                editor.focus();
            } else {
                // Fallback to append if no editor ref (should shouldn't happen usually)
                setContent(prev => prev + markdown + '\n');
            }

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

    const handleEditorMountCallback: OnMount = (editor) => {
        editorInstanceRef.current = editor;
        setEditorInstance(editor);
    };

    return (
        <Box 
            sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%', 
                bgcolor: 'transparent',
                position: 'relative' // For overlay positioning
            }}
            onPaste={handlePaste} 
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
                        pointerEvents: 'none' // Let events pass through to parent for drop
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
                            ファイルをドロップしてアップロード
                        </Box>
                    </Box>
                </Box>
            )}

            {uploading && <LinearProgress color="primary" />}
            
            <Box flex={1} sx={{ overflow: 'hidden' }}>
                <SharedEditor
                    value={content}
                    onChange={(v: string) => {
                        setContent(v);
                        isSavedRef.current = false;
                    }}
                    onMount={handleEditorMountCallback}
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
