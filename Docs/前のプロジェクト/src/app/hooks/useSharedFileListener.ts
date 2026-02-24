'use client';


import { useEffect, useRef, useState } from 'react';
import { uploadSharedFile, getLatestSharedFile } from '@/app/actions/shared-file';
import { ModalType } from '../components/layout/AppHeader';
import { ModalData } from '../components/modals/ModalController';

import { useGlobalJobs } from '../context/GlobalJobContext';
import { useToast } from '../context/ToastContext';

interface UseSharedFileListenerProps {
    onOpenModal: (modal: ModalType, data?: ModalData) => void;
    currentDate: Date;
}

export function useSharedFileListener({ onOpenModal }: UseSharedFileListenerProps) {
    const { addClientJob, updateClientJob } = useGlobalJobs();
    const { showToast } = useToast();
    const lastShownIdRef = useRef<string | null>(null);

    // Check for new items on mount (once)
    useEffect(() => {
        const checkLatest = async () => {
            try {
                const latest = await getLatestSharedFile();
                if (!latest) return;

                // Prevent reopening the same file if already shown in this session (memory)
                if (latest.id === lastShownIdRef.current) return;

                // Check persistent storage (localStorage) to avoid showing again on reload
                const storedId = localStorage.getItem('rin_last_shared_id');
                if (latest.id === storedId) return;

                // Check if it's within last 5 minutes to be relevant
                const timeDiff = new Date().getTime() - new Date(latest.createdAt).getTime();
                if (timeDiff < 5 * 60 * 1000) {
                     lastShownIdRef.current = latest.id;
                     localStorage.setItem('rin_last_shared_id', latest.id);
                     onOpenModal('SHARED_ITEM', latest);
                }
            } catch (e) {
                console.error('Failed to check shared files', e);
            }
        };

        checkLatest();
    }, [onOpenModal]);

    // Unified Upload Logic
    const handleFileUpload = async (file: File) => {
        const jobId = Math.random().toString(36).substring(7);
        addClientJob({
            id: jobId,
            type: 'UPLOAD',
            title: `アップロード: ${file.name}`,
            error: undefined
        });

        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const sharedFile = await uploadSharedFile(formData);
            
            updateClientJob(jobId, { status: 'COMPLETED', progress: 100 });
            
            sessionStorage.setItem('rin_last_uploaded_id', sharedFile.id);
            onOpenModal('SHARED_ITEM', sharedFile);
            
        } catch (e: unknown) {
            const err = e as Error;
            console.error('Upload failed', e);
            updateClientJob(jobId, { status: 'FAILED', error: 'アップロード失敗' });
            showToast('アップロードに失敗しました', 'error');
        }
    };

    const handleTextUpload = async (text: string) => {
        // Create a text file from the string
        const blob = new Blob([text], { type: 'text/plain' });
        const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
        const filename = `shared_text_${timestamp}.txt`;
        const file = new File([blob], filename, { type: 'text/plain' });
        
        await handleFileUpload(file);
    };

    // Drag & Drop / Paste Handlers
    const handlePaste = async (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        let handled = false;
        
        // 1. Files
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault(); 
                    await handleFileUpload(file);
                    handled = true;
                }
            }
        }
        
        // 2. Text (if no files handled)
        // If files were handled, typically we don't paste text too, but it depends on OS.
        // Let's allow text if no file was found OR if we want to support mixed. 
        // Usually paste is either/or.
        if (!handled) {
            // Check for text
            const text = e.clipboardData?.getData('text/plain');
            if (text) {
                // If active element is input/textarea, let default happen?
                // The caller usually attaches this to window. 
                // We should check active element.
                const active = document.activeElement;
                const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable);
                
                if (!isInput) {
                    e.preventDefault();
                    await handleTextUpload(text);
                }
            }
        }
    };

    const handleDrop = async (e: DragEvent) => {
        e.preventDefault();
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            await handleFileUpload(files[0]); // Handle first file only for now
        }
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
    };

    return {
        handlePaste,
        handleDrop,
        handleDragOver,
        handleTextUpload
    };
}
