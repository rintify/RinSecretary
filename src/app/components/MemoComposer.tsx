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
import ConflictDialog from './ConflictDialog';
import { useGlobalJobs } from '../context/GlobalJobContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

export type SaveStatus = 'unsaved' | 'saving' | 'saved';

interface MemoComposerProps {
    initialContent?: string;
    memoId?: string;
    onSuccess?: () => void;
    onDelete?: () => void;
    isNew?: boolean;
    showLineNumbers?: boolean;
    onFileManagementOpen?: () => void;
    editorMode?: 'monaco' | 'plain';
    onBack?: () => void;
    onSaveStatusChange?: (status: SaveStatus, lastSavedAt?: Date) => void;
    lastUpdatedAt?: Date;
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
    (props, ref) => {
    const {
        initialContent = '',
        memoId,
        onSuccess,
        onDelete,
        isNew,
        showLineNumbers = false,
        onFileManagementOpen,
        editorMode = 'monaco',
        onBack,
        onSaveStatusChange,
        lastUpdatedAt: initialLastUpdatedAt
    } = props;
    const [content, setContent] = useState(initialContent);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [internalMemoId, setInternalMemoId] = useState<string | undefined>(memoId);

    const { addClientJob, updateClientJob } = useGlobalJobs();
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);
    
    const [status, setStatus] = useState<SaveStatus>('saved');
    const [lastSavedAt, setLastSavedAt] = useState<Date | undefined>(initialLastUpdatedAt);
    const lastServerUpdatedAtRef = useRef<Date | undefined>(initialLastUpdatedAt); // Use ref to avoid stale closure issues

    const [conflictState, setConflictState] = useState<{ open: boolean, serverContent: string, memoId: string } | null>(null);
    
    // Notify parent of status changes
    useEffect(() => {
        onSaveStatusChange?.(status, lastSavedAt);
    }, [status, lastSavedAt, onSaveStatusChange]);

    const contentRef = useRef(content);
    const lastSavedContentRef = useRef(initialContent); // Track content matching the server state
    const isSavingRef = useRef(false);

    const router = useRouter();

    useEffect(() => {
        contentRef.current = content;
        if (content !== lastSavedContentRef.current) {
            setStatus('unsaved');
        } else {
            setStatus('saved');
        }
    }, [content]);

    // Keyboard Shortcut (Ctrl+S / Cmd+S)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveMemo(contentRef.current);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // 3分ごとの定期保存 (Auto-save interval)
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (status === 'unsaved' && !isSavingRef.current) {
                saveMemo(contentRef.current);
            }
        }, 3 * 60 * 1000); // 3 minutes

        return () => clearInterval(intervalId);
    }, [status]);

    // 自動保存用（APIルート + keepalive）
    const saveMemo = async (currentContent: string): Promise<string | undefined> => {
        if (isSavingRef.current) return internalMemoId;
        // 内容が空かつ新規作成の場合は保存しない（無題メモ量産防止）
        if (!internalMemoId && !currentContent.trim()) return undefined;
        // 変更がない場合は保存しない (Double check mostly for manual triggers, auto-save relies on status)
        if (currentContent === lastSavedContentRef.current && internalMemoId) {
             setStatus('saved');
             return internalMemoId;
        }

        isSavingRef.current = true;
        setStatus('saving');
        
        const title = generateTitle(currentContent);

        try {
            const idToUse = internalMemoId; 
            const url = idToUse ? `/api/memos/${idToUse}` : '/api/memos';
            const method = idToUse ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title, 
                    content: currentContent,
                    lastUpdatedAt: lastServerUpdatedAtRef.current 
                }),
                keepalive: true
            });

            if (res.status === 409) {
                const data = await res.json();
                isSavingRef.current = false;
                setConflictState({ open: true, serverContent: data.serverContent || '', memoId: internalMemoId! });
                setStatus('unsaved');
                return internalMemoId;
            }

            if (res.ok && !idToUse) {
                const data = await res.json();
                if (data.id) {
                    setInternalMemoId(data.id);
                    lastSavedContentRef.current = currentContent;
                    setStatus('saved');
                    const now = new Date();
                    setLastSavedAt(now);
                    lastServerUpdatedAtRef.current = data.updatedAt ? new Date(data.updatedAt) : now;
                    return data.id;
                }
            } else if (res.ok) {
                 const data = await res.json();
                 lastSavedContentRef.current = currentContent;
                 setStatus('saved');
                 const now = new Date();
                 setLastSavedAt(now);
                 // Use the actual updatedAt from server response to prevent false conflict detection
                 lastServerUpdatedAtRef.current = data.updatedAt ? new Date(data.updatedAt) : now;
            }
            return idToUse;
        } catch (e) {
            console.error('Auto Save failed', e);
            return internalMemoId;
        } finally {
            isSavingRef.current = false;
            // If status is still saving (no error/success handled above explicitly for generic cases or fallthrough), 
            // ensure we reset or reflect reality.
            // Our logic above sets 'saved' on success. If failed, we might want to go back to 'unsaved'?
            // Assuming failure leaves it 'unsaved' effectively or we re-try. 
            // Let's rely on success path setting 'saved'. 
            // If we are here and not saved, we probably failed.
            if (lastSavedContentRef.current !== currentContent) {
                 setStatus('unsaved'); 
            }
        }
    };

    // 手動保存（Server Actions）
    const handleManualSave = async (force: boolean = false) => {
        if (!force && status === 'saved' && content === lastSavedContentRef.current) return;
        
        setLoading(true); 
        setStatus('saving');
        
        try {
            if (internalMemoId) {
                // If forcing, we don't pass lastUpdatedAt (or logic in actions handles it if we pass force=true)
                const result = await updateMemo(internalMemoId, content, lastServerUpdatedAtRef.current, force);
                if (result && 'error' in result && result.error === 'Conflict') {
                    // Conflict detected - Handle gracefully without throwing
                    try {
                        const res = await fetch(`/api/memos/${internalMemoId}`);
                        if (res.ok) {
                            const data = await res.json();
                            setConflictState({ open: true, serverContent: data.content, memoId: internalMemoId! });
                        }
                    } catch (fetchErr) {
                         console.error('Failed to fetch conflict content', fetchErr);
                    }
                    setStatus('unsaved');
                    setLoading(false);
                    return; 
                }
                
                const now = new Date();
                lastServerUpdatedAtRef.current = now; // Optimistic update
            } else {
                const newMemo = await createMemo(content);
                setInternalMemoId(newMemo.id); // For create case specifically
                lastServerUpdatedAtRef.current = newMemo.updatedAt;
            }
            
            lastSavedContentRef.current = content;
            setStatus('saved');
            setLastSavedAt(new Date());

            if (conflictState) {
                setConflictState(null);
            }

            if (onSuccess && !force) { 
                onSuccess();
            } else if (!force) {
                router.back();
            } else {
                if (onSuccess) onSuccess();
                else router.back();
            }
        } catch (e: any) {
            console.error('Manual save failed', e);
            setStatus('unsaved');
            setLoading(false);
        }
    };

    // アンマウント時の自動保存
    useEffect(() => {
        return () => {
            if (status === 'unsaved') {
                // Determine if we should save? 
                // Original logic forced a save attempt on unmount.
                // We'll keep that but be careful with async in unmount.
                // Using keepalive fetch in saveMemo helps here.
                saveMemo(contentRef.current);
            }
        };
    }, []);

    // 削除処理（Server Actions）
    const handleDelete = async () => {
        if (!isNew && !await confirm('このメモを削除しますか？', { severity: 'error', confirmText: '削除', title: 'メモの削除' })) return;
        
        // isSavedRef.current = true; // Use status instead? Or just ignore save on delete.
        // If we delete, we don't want auto-save to kick in.
        // Setting saving ref to true might prevent auto-save loop if checks pass.
        isSavingRef.current = true;
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
            // isSavedRef.current = false;
            isSavingRef.current = false;
            setLoading(false);
        }
    };

    const editorInstanceRef = useRef<any>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
        handleDelete,
        handleSave: () => handleManualSave(false),
        insertContent: (text: string) => {
            if (editorMode === 'monaco' && editorInstanceRef.current) {
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
            } else if (editorMode === 'plain' && textareaRef.current) {
                const textarea = textareaRef.current;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const newContent = content.substring(0, start) + text + content.substring(end);
                setContent(newContent);
                // Restore cursor/selection after update (needs timeout for React render cycle usually, or use setSelectionRange directly if we controlled standard input more tightly)
                // Since setContent is async, we do best effort or use effect. 
                // Simple flush sync effect is hard here. Let's just update content.
                // Focusing textarea
                textarea.focus();
                // We'd ideally want to set cursor after 'text', but React state update generic delay makes it tricky without layout effect.
                // Post-update cursor fix:
                setTimeout(() => {
                    const newCursorPos = start + text.length;
                    textarea.setSelectionRange(newCursorPos, newCursorPos);
                }, 0);
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

            const jobId = `upload-composer-${Date.now()}`;
            addClientJob({
                id: jobId,
                type: 'UPLOAD',
                title: `アップロード: ${file.name}`,
                payload: null
            });

            try {
                const formData = new FormData();
                formData.append('file', file);

                const attachment = await uploadAttachment(formData, id);
                updateClientJob(jobId, { status: 'COMPLETED', progress: 100 });
                
                const isImage = file.type.startsWith('image/');
                const markdown = isImage 
                    ? `\n![${file.name}](${attachment.filePath})` 
                    : `\n[${file.name}](${attachment.filePath})`;
                
                // Insert at cursor position if editor is available
                if (editorMode === 'monaco' && editorInstanceRef.current) {
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
                    editor.focus();
                } else if (editorMode === 'plain') {
                     if (textareaRef.current) {
                        const textarea = textareaRef.current;
                        setContent(prev => prev + markdown + '\n');
                     } else {
                        setContent(prev => prev + markdown + '\n');
                     }
                } else {
                    setContent(prev => prev + markdown + '\n');
                }
            } catch (err: any) {
                updateClientJob(jobId, { status: 'FAILED', error: err.message || 'アップロード失敗' });
                throw err;
            }

        } catch (e) {
            console.error(e);
            showToast('アップロードに失敗しました', 'error');
        } finally {
            setUploading(false);
        }
    };

    const isEmpty = !content.trim();
    const showDelete = isNew && isEmpty;
    
    // FAB Logic (Unified with SaveStatus)
    // If status is 'saved', we show Back button (meaning it's safe to leave).
    // If 'unsaved', we show Save (Check) button.
    // 'saving' state is handled in rendering (Spinner).
    const showBack = status === 'saved';

    const handleFabClick = () => {
        if (showDelete) return handleDelete();
        // If saved, Back button behavior
        if (showBack) return onBack ? onBack() : router.back();
        // If unsaved, Save behavior
        return handleManualSave(false);
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
            {editorMode === 'monaco' ? (
                <SharedEditor
                    value={content}
                    onChange={(v: string) => {
                        setContent(v);
                    }}
                    onMount={handleEditorMountCallback}
                    paddingBottom={160} // Increased padding for 2 FABs
                    paddingTop={8}
                    showLineNumbers={showLineNumbers}
                    backgroundColor="#f9f2fb"
                />
            ) : (
                <Box sx={{ width: '100%', height: '100%', p: 1, pb: 20, overflow: 'auto' }}>
                    <textarea 
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => {
                            setContent(e.target.value);
                        }}
                        style={{
                            width: '100%',
                            height: '100%', // Allow it to expand
                            minHeight: '100%',
                            backgroundColor: 'transparent',
                            border: 'none',
                            outline: 'none',
                            resize: 'none',
                            fontSize: '16px',
                            fontFamily: 'sans-serif',
                            lineHeight: 1.5,
                            color: '#333',
                            padding: '8px'
                        }}
                        placeholder="メモを入力..."
                    />
                </Box>
            )}
            </Box>

            <Box sx={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 3, zIndex: 1050, alignItems: 'center' }}>
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
                <Fab 
                    onClick={handleFabClick} 
                    disabled={loading || uploading || status === 'saving'}
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
                    {(loading || status === 'saving') ? <CircularProgress size={24} color="inherit" /> : (
                        showDelete ? <DeleteIcon /> : (showBack ? <ArrowBackIcon /> : <CheckIcon />)
                    )}
                </Fab>
            </Box>


            {conflictState && (
                <ConflictDialog 
                    open={conflictState.open}
                    localContent={content}
                    serverContent={conflictState.serverContent}
                    onOverwrite={() => {
                        handleManualSave(true);
                    }}
                    onDiscard={() => {
                        // Reload page to get fresh content
                        window.location.reload();
                    }}
                    onCancel={() => {
                        setConflictState(null);
                    }}
                />
            )}
        </Box>
    );
});

MemoComposer.displayName = 'MemoComposer';

export default MemoComposer;
