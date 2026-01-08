'use client';


import { useEffect, useRef, useState } from 'react';
import { uploadSharedFile, getLatestSharedFile } from '@/app/actions/shared-file';
import { ModalType } from '../components/layout/AppHeader';

interface UseSharedFileListenerProps {
    onOpenModal: (modal: ModalType, data?: any) => void;
    currentDate: Date;
}

export function useSharedFileListener({ onOpenModal }: UseSharedFileListenerProps) {
    const [isUploading, setIsUploading] = useState(false);
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

    // Drag & Drop / Paste Handlers
    const handlePaste = async (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault(); // Prevent default paste (e.g. image into editable div)
                    await handleFileUpload(file);
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

    const handleFileUpload = async (file: File) => {
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            // Show some loading state? 
            // The modal will open when the poll catches it, OR we open it immediately with the result.
            // Opening immediately is better for the uploader.
            const sharedFile = await uploadSharedFile(formData);
            
            
            sessionStorage.setItem('rin_last_uploaded_id', sharedFile.id);
            onOpenModal('SHARED_ITEM', sharedFile);
            
        } catch (e) {
            console.error('Upload failed', e);
            alert('アップロードに失敗しました');
        } finally {
            setIsUploading(false);
        }
    };

    return {
        handlePaste,
        handleDrop,
        handleDragOver,
        isUploading
    };
}
