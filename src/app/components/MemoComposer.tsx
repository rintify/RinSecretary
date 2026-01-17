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
import { useConflict } from '../context/ConflictContext';
import { useGlobalJobs } from '../context/GlobalJobContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { db } from '@/lib/db';
import { syncManager } from '@/lib/sync-manager';
import { OFFLINE_FILE_SIZE_LIMIT } from '@/lib/constants';

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

    // Use a ref to track if we have loaded initial content to avoid overwriting user input
    // with "stale" initialContent if props update (e.g. from server fetch in parent)
    const [content, setContent] = useState(initialContent);
    const hasLoadedInitial = useRef(false);

    useEffect(() => {
        // Only update content from props if we haven't modified it yet or strictly on first load
        if (initialContent !== content && !hasLoadedInitial.current) {
             setContent(initialContent);
             hasLoadedInitial.current = true;
        }
    }, [initialContent]);

    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    // Generate ID client-side if new
    const [internalMemoId, setInternalMemoId] = useState<string | undefined>(memoId);

    const { addClientJob, updateClientJob } = useGlobalJobs();
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);
    
    const [status, setStatus] = useState<SaveStatus>('saved');
    const [lastSavedAt, setLastSavedAt] = useState<Date | undefined>(initialLastUpdatedAt);
    
    // Notify parent of status changes
    useEffect(() => {
        onSaveStatusChange?.(status, lastSavedAt);
    }, [status, lastSavedAt, onSaveStatusChange]);

    const contentRef = useRef(content);
    const lastSavedContentRef = useRef(initialContent); 
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
                handleManualSave(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // 3分ごとの定期保存 (Auto-save)
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (status === 'unsaved' && !isSavingRef.current) {
                saveMemo(contentRef.current);
            }
        }, 3 * 60 * 1000); 

        return () => clearInterval(intervalId);
    }, [status]);

    // Internal Save Logic (Dexie)
    // Using context inside component body
    const { showConflict } = useConflict();

    const saveMemo = async (currentContent: string): Promise<string | undefined> => {
        if (isSavingRef.current) return internalMemoId;
        const trimmed = currentContent.trim();
        if (!internalMemoId && !trimmed) return undefined;
        
        // Optimistic Locking Check
        // If we have an ID and have saved before (or loaded initial), check DB
        if (internalMemoId) {
            const existing = await db.memos.get(internalMemoId);
            // If existing memo has newer updatedAt than our last known save/load time
            if (existing && lastSavedAt && existing.updatedAt > lastSavedAt) {
                 // Check if content is actually different
                 if (existing.content !== currentContent) {
                     // Conflict Detected!
                     const choice = await showConflict(
                         {
                             id: internalMemoId,
                             title: generateTitle(currentContent),
                             content: currentContent,
                             updatedAt: new Date().toISOString()
                         },
                         {
                             id: existing.id,
                             title: existing.title,
                             content: existing.content,
                             updatedAt: existing.updatedAt.toISOString() // Assuming Date object
                         },
                         {
                             title: '編集の競合（他のタブで更新されました）',
                             message: 'このメモは別のウィンドウまたはタブで更新されています。どちらの内容を保存しますか？',
                             local: '現在の編集内容',
                             server: '保存済みの最新版'
                         }
                     );

                     if (choice === 'server') {
                         // Reload from DB
                         setContent(existing.content);
                         setLastSavedAt(existing.updatedAt);
                         setStatus('saved');
                         // Update refs to avoid triggering unsaved status immediately
                         contentRef.current = existing.content;
                         lastSavedContentRef.current = existing.content;
                         return internalMemoId;
                     } else if (choice === 'cancel') {
                         // Cancel Save
                         setStatus('unsaved');
                         return internalMemoId;
                     }
                     // If choice is 'local', proceed to overwrite (force save)
                 }
            }
        }

        if (currentContent === lastSavedContentRef.current && internalMemoId) {
             setStatus('saved');
             return internalMemoId;
        }

        isSavingRef.current = true;
        setStatus('saving');
        
        try {
            // Generate ID if missing
            let id = internalMemoId;
            if (!id) {
                id = crypto.randomUUID();
                setInternalMemoId(id);
            }

            const now = new Date();
            const title = generateTitle(currentContent);
            
            // Upsert Logic
            const existing = await db.memos.get(id);
            if (existing) {
                 await db.memos.put({
                     ...existing,
                     title,
                     content: currentContent,
                     updatedAt: now,
                     isDirty: true,
                     lastAccessedAt: now,
                     isFullContent: true,
                     isDeleted: false // Restore if deleted
                 });
            } else {
                 await db.memos.add({
                     id,
                     title,
                     content: currentContent,
                     updatedAt: now,
                     createdAt: now,
                     userId: 'current-user',
                     isDirty: true,
                     lastAccessedAt: now,
                     isFullContent: true,
                     isDeleted: false
                 });
            }
            
            lastSavedContentRef.current = currentContent;
            setStatus('saved');
            setLastSavedAt(now);

            // Trigger Background Sync - Always try, let it fail if offline
            syncManager.sync().catch(e => {
                console.error('Background sync failed', e);
                // Global dialog will handle the error
            });

            return id;
        } catch (e) {
            console.error('Save failed', e);
            setStatus('unsaved');
            return internalMemoId;
        } finally {
            isSavingRef.current = false;
        }
    };

    // Manual Save Wrapper
    const handleManualSave = async (force: boolean = false) => {
        setLoading(true);
        try {
            await saveMemo(contentRef.current);
            if (onSuccess) onSuccess();
            else if (!isNew) router.refresh(); 
        } catch(e) {
             showToast('保存に失敗しました', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Unmount Save
    useEffect(() => {
        return () => {
            if (status === 'unsaved') {
                saveMemo(contentRef.current);
            }
        };
    }, []);

    // Delete Logic
    const handleDelete = async () => {
        if (!isNew && !await confirm('このメモを削除しますか？', { severity: 'error', confirmText: '削除', title: 'メモの削除' })) return;
        
        setLoading(true);
        try {
            if (internalMemoId) {
                await db.memos.update(internalMemoId, { isDeleted: true, isDirty: true });
                syncManager.sync().catch(e => {
                     console.error('Delete sync failed', e);
                     // Global dialog will handle the error
                });
            }
            if (onDelete) {
                onDelete();
            } else {
                router.replace('/memos');
            }
        } catch (e) {
            console.error('Delete failed', e);
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
                textarea.focus();
                setTimeout(() => {
                    const newCursorPos = start + text.length;
                    textarea.setSelectionRange(newCursorPos, newCursorPos);
                }, 0);
            }
        }
    }));

    const handlePaste = async (e: React.ClipboardEvent | ClipboardEvent) => {
        const clipboardData = (e as any).clipboardData || (window as any).clipboardData;
        if (!clipboardData) return;

        const items = clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                e.preventDefault();
                (e as any).stopImmediatePropagation?.();
                const file = items[i].getAsFile();
                if (file) await uploadFile(file);
                return;
            }
        }
    };

    const handlePasteRef = useRef(handlePaste);
    useEffect(() => { handlePasteRef.current = handlePaste; });
    
    // Monaco Paste Handling
    const [editorInstance, setEditorInstance] = useState<any>(null);
    useEffect(() => {
        if (!editorInstance) return;
        const listener = (e: ClipboardEvent) => {
             if (editorInstance.hasWidgetFocus()) {
                 handlePasteRef.current(e);
             }
        };
        window.addEventListener('paste', listener, true);
        return () => window.removeEventListener('paste', listener, true);
    }, [editorInstance]);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current === 0) setIsDragging(false);
    };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        setIsDragging(false); dragCounter.current = 0;
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            for (const file of files) await uploadFile(file);
            e.dataTransfer.clearData();
        }
    };

    const uploadFile = async (file: File) => {
        setUploading(true);
        try {
            let id = internalMemoId;
            if (!id) {
                // If new memo, save content first to generate ID
                id = await saveMemo(contentRef.current); 
                if (!id) throw new Error('Could not create memo for upload');
            }
            
            // Check Size & Offline status
            const isOffline = !navigator.onLine;
            const isSmall = file.size <= OFFLINE_FILE_SIZE_LIMIT;

            if (isOffline && !isSmall) {
                 showToast('オフライン時は5MB以下のファイルのみ追加可能です。', 'error');
                 setUploading(false);
                 return;
            }

            const jobId = `upload-composer-${Date.now()}`;
            const fileId = crypto.randomUUID(); // Client-side ID for predictable path
            const ext = file.name.split('.').pop();
            const predictedPath = `/api/uploads/${fileId}.${ext}`;

            addClientJob({
                id: jobId,
                type: 'UPLOAD',
                title: `アップロード: ${file.name}`,
                payload: null
            });

            try {
                if (isSmall) {
                    // Start GC Check before insertion
                    await syncManager.checkAndGC(file.size);

                    // Small File: Save to Dexie first (Offline First approach)
                    // Even if online, saving to Dexie -> Background Sync is robust.
                    // BUT for online, we want immediate Markdown insertion and "success".
                    
                    // Offline or Small: Add to local DB
                    await db.attachments.add({
                        id: fileId,
                        memoId: id,
                        fileName: file.name,
                        fileSize: file.size,
                        mimeType: file.type,
                        createdAt: new Date(),
                        blob: file, // Store blob
                        isDirty: true, // Needs sync
                        lastAccessedAt: new Date(),
                        filePath: predictedPath
                    });

                    // Insert Markdown immediately
                    const isImage = file.type.startsWith('image/');
                    const markdown = isImage 
                        ? `\n![${file.name}](${predictedPath})` 
                        : `\n[${file.name}](${predictedPath})`;
                    
                    insertMarkdown(markdown);
                    saveMemo(contentRef.current + markdown);

                    updateClientJob(jobId, { status: 'COMPLETED', progress: 100 });

                    // Trigger Sync (Fire and Forget)
                    syncManager.sync().catch(console.error);

                } else {
                    // Large File: Online Direct Upload
                    if (isOffline) throw new Error('Offline upload for large files not supported');

                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('id', fileId);

                    const attachment = await uploadAttachment(formData, id);
                    
                    // Update Local DB for consistency (so it shows in File Manager)
                    await db.attachments.put({
                        id: attachment.id,
                        memoId: attachment.memoId,
                        fileName: attachment.fileName,
                        fileSize: attachment.fileSize,
                        mimeType: attachment.mimeType,
                        createdAt: attachment.createdAt,
                        filePath: attachment.filePath,
                        lastAccessedAt: new Date(),
                        isDirty: false
                        // No blob
                    });

                    const isImage = file.type.startsWith('image/');
                    const markdown = isImage 
                        ? `\n![${file.name}](${attachment.filePath})` 
                        : `\n[${file.name}](${attachment.filePath})`;
                    
                    insertMarkdown(markdown);
                    saveMemo(contentRef.current + markdown);
                    
                    updateClientJob(jobId, { status: 'COMPLETED', progress: 100 });
                }
                
            } catch (err: any) {
                updateClientJob(jobId, { status: 'FAILED', error: err.message });
                throw err;
            }

        } catch (e: any) {
            console.error(e);
            showToast(e.message || 'アップロードに失敗しました', 'error');
        } finally {
            setUploading(false);
        }
    };

    const insertMarkdown = (markdown: string) => {
        if (editorMode === 'monaco' && editorInstanceRef.current) {
            const editor = editorInstanceRef.current;
            const contribution = editor.getContribution('snippetController2');
            if (contribution) {
                contribution.insert(markdown);
            } else {
                const position = editor.getPosition();
                editor.executeEdits('insert-upload', [{
                    range: {
                        startLineNumber: position?.lineNumber || 1,
                        startColumn: position?.column || 1,
                        endLineNumber: position?.lineNumber || 1,
                        endColumn: position?.column || 1,
                    },
                    text: markdown,
                    forceMoveMarkers: true
                }]);
            }
            editor.focus();
        } else {
             setContent(prev => prev + markdown + '\n');
        }
    };

    const isEmpty = !content.trim();
    const showDelete = isNew && isEmpty;
    const showBack = status === 'saved';

    const handleFabClick = () => {
        if (showDelete) return handleDelete();
        if (showBack) return onBack ? onBack() : router.back();
        return handleManualSave(false);
    };

    const handleEditorMountCallback: OnMount = (editor) => {
        editorInstanceRef.current = editor;
        setEditorInstance(editor);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'transparent', position: 'relative' }}
            onPaste={handlePaste} 
            onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
        >
             {isDragging && (
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.1)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)', pointerEvents: 'none' }}>
                    <Box sx={{ bgcolor: 'background.paper', p: 3, borderRadius: 2, boxShadow: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <FolderIcon sx={{ fontSize: 48, color: MEMO_COLOR }} />
                        <Box sx={{ fontWeight: 'bold', color: 'text.primary' }}>ファイルをドロップしてアップロード</Box>
                    </Box>
                </Box>
            )}

            {uploading && <LinearProgress color="primary" />}
            
            <Box flex={1} sx={{ overflow: 'hidden' }}>
            {editorMode === 'monaco' ? (
                <SharedEditor
                    value={content}
                    onChange={setContent}
                    onMount={handleEditorMountCallback}
                    paddingBottom={160} paddingTop={8}
                    showLineNumbers={showLineNumbers}
                    backgroundColor="#f9f2fb"
                />
            ) : (
                <Box sx={{ width: '100%', height: '100%', p: 1, pb: 20, overflow: 'auto' }}>
                    <textarea 
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        style={{ width: '100%', height: '100%', minHeight: '100%', backgroundColor: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: '16px', fontFamily: 'sans-serif', lineHeight: 1.5, color: '#333', padding: '8px' }}
                        placeholder="メモを入力..."
                    />
                </Box>
            )}
            </Box>

            <Box sx={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 3, zIndex: 1050, alignItems: 'center' }}>
                 {onFileManagementOpen && (
                    <Fab aria-label="files" onClick={onFileManagementOpen} sx={{ bgcolor: 'background.paper', color: MEMO_COLOR, border: `1px solid ${alpha(MEMO_COLOR, 0.2)}`, '&:hover': { bgcolor: alpha(MEMO_COLOR, 0.05) } }}>
                        <FolderIcon />
                    </Fab>
                 )}
                <Fab onClick={handleFabClick} disabled={loading || uploading || status === 'saving'} aria-label={showDelete ? "delete" : (showBack ? "back" : "save")}
                    sx={{ bgcolor: (showDelete || showBack) ? 'background.paper' : MEMO_COLOR, color: showDelete ? 'error.main' : (showBack ? MEMO_COLOR : '#fff'), border: (showDelete || showBack) ? `1px solid ${alpha(showDelete ? '#d32f2f' : MEMO_COLOR, 0.2)}` : 'none', '&:hover': { bgcolor: (showDelete || showBack) ? alpha(showDelete ? '#d32f2f' : MEMO_COLOR, 0.05) : MEMO_COLOR, opacity: (showDelete || showBack) ? 1 : 0.9 } }}
                >
                    {(loading || status === 'saving') ? <CircularProgress size={24} color="inherit" /> : (
                        showDelete ? <DeleteIcon /> : (showBack ? <ArrowBackIcon /> : <CheckIcon />)
                    )}
                </Fab>
            </Box>
            
            {/* Conflict Dialog removed as we handle SyncManager logic globally or ignore for now (Last Writer Wins on Client Side Save) */}
        </Box>
    );
});

MemoComposer.displayName = 'MemoComposer';
export default MemoComposer;
