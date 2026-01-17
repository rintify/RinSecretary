'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Box, List, ListItem, ListItemButton, ListItemText, 
    Checkbox, IconButton, Menu, MenuItem, Typography, CircularProgress
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    MoreVert as MoreVertIcon, 
    Delete as DeleteIcon, 
    Close as CloseIcon, 
    Note as NoteIcon,
    Refresh as RefreshIcon,
    Folder as FolderIcon,
    CloudQueue as CloudIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import MemoHeader from '../components/MemoHeader';
import { MemoListFabs, MemoListEditButton, MemoListItemButton } from './MemoListClient';
import { db, ClientMemo } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { syncManager } from '@/lib/sync-manager';
import { createEmptyMemo, createMemo, createMemoWithFile } from './actions';
import { MEMO_COLOR } from '../utils/colors'; 
import { useGlobalJobs } from '../context/GlobalJobContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { CloudOff as UnsyncedIcon } from '@mui/icons-material';

type Memo = {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    thumbnailPath?: string | null;
};

interface DisplayMemo {
    id: string;
    title: string;
    updatedAt: Date;
    thumbnailPath?: string | null;
    isFullContent: boolean;
    isLocalOnly: boolean;  // ローカルのみ（サーバー未同期）
    isServerOnly: boolean; // サーバーのみ（ローカル未キャッシュ）
    isDirty?: boolean;
}

export default function MemoListContainer({ memos: initialMemos, initialQuery = '' }: { memos: Memo[], initialQuery?: string }) {
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    
    // Dexie: Live Query for Local Memos
    const localMemos = useLiveQuery(
        () => db.memos.orderBy('updatedAt').reverse().toArray(),
        []
    ) || [];

    // Server Memos State (for infinite scroll)
    const [serverMemos, setServerMemos] = useState<DisplayMemo[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Search State (Server)
    const [serverSearchResults, setServerSearchResults] = useState<DisplayMemo[]>([]);
    const [searchNextCursor, setSearchNextCursor] = useState<string | null>(null);
    const [searchHasMore, setSearchHasMore] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Merge Local + Server Memos
    const mergedMemos = useCallback((): DisplayMemo[] => {
        const localIds = new Set(localMemos.map(m => m.id));
        const result: DisplayMemo[] = [];

        // 1. Add local memos (excluding deleted)
        for (const m of localMemos) {
            if (m.isDeleted) continue;
            result.push({
                id: m.id,
                title: m.title,
                updatedAt: m.updatedAt,
                thumbnailPath: m.thumbnailPath,
                isFullContent: m.isFullContent,
                isLocalOnly: m.isDirty || false,
                isServerOnly: false,
                isDirty: m.isDirty
            });
        }

        // 2. Add server memos not in local
        for (const s of serverMemos) {
            if (!localIds.has(s.id)) {
                result.push({
                    ...s,
                    isServerOnly: true,
                    isLocalOnly: false
                });
            }
        }

        // Sort by updatedAt desc
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return result;
    }, [localMemos, serverMemos]);

    // Search results: merge local search + server search
    const mergedSearchResults = useCallback((): DisplayMemo[] => {
        if (!searchQuery.trim()) return [];

        const localIds = new Set<string>();
        const result: DisplayMemo[] = [];

        // Local search
        const lowerQuery = searchQuery.toLowerCase();
        for (const m of localMemos) {
            if (m.isDeleted) continue;
            if (m.title.toLowerCase().includes(lowerQuery) || m.content.toLowerCase().includes(lowerQuery)) {
                localIds.add(m.id);
                result.push({
                    id: m.id,
                    title: m.title,
                    updatedAt: m.updatedAt,
                    thumbnailPath: m.thumbnailPath,
                    isFullContent: m.isFullContent,
                    isLocalOnly: m.isDirty || false,
                    isServerOnly: false,
                    isDirty: m.isDirty
                });
            }
        }

        // Add server search results not in local
        for (const s of serverSearchResults) {
            if (!localIds.has(s.id)) {
                result.push({
                    ...s,
                    isServerOnly: true,
                    isLocalOnly: false
                });
            }
        }

        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return result;
    }, [localMemos, serverSearchResults, searchQuery]);

    // Decide which memos to display
    const displayMemos = searchQuery.trim() ? mergedSearchResults() : mergedMemos();

    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Fetch server memos (initial + pagination)
    const fetchServerMemos = async (cursor?: string) => {
        try {
            const url = cursor 
                ? `/api/memos/list?cursor=${encodeURIComponent(cursor)}&limit=20`
                : '/api/memos/list?limit=20';
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            
            const newMemos: DisplayMemo[] = data.memos.map((m: any) => ({
                id: m.id,
                title: m.title,
                updatedAt: new Date(m.updatedAt),
                thumbnailPath: m.thumbnailPath,
                isFullContent: true,
                isLocalOnly: false,
                isServerOnly: true
            }));
            
            if (cursor) {
                setServerMemos(prev => [...prev, ...newMemos]);
            } else {
                setServerMemos(newMemos);
            }
            setNextCursor(data.nextCursor);
            setHasMore(data.hasMore);
        } catch (e) {
            console.error('Failed to fetch server memos', e);
        }
    };

    // Fetch search results from server
    const fetchServerSearch = async (query: string, cursor?: string) => {
        if (!query.trim()) {
            setServerSearchResults([]);
            setSearchHasMore(false);
            return;
        }
        
        setIsSearching(true);
        try {
            const url = cursor
                ? `/api/memos/search?q=${encodeURIComponent(query)}&cursor=${encodeURIComponent(cursor)}&limit=20`
                : `/api/memos/search?q=${encodeURIComponent(query)}&limit=20`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            
            const newMemos: DisplayMemo[] = data.memos.map((m: any) => ({
                id: m.id,
                title: m.title,
                updatedAt: new Date(m.updatedAt),
                thumbnailPath: m.thumbnailPath,
                isFullContent: true,
                isLocalOnly: false,
                isServerOnly: true
            }));
            
            if (cursor) {
                setServerSearchResults(prev => [...prev, ...newMemos]);
            } else {
                setServerSearchResults(newMemos);
            }
            setSearchNextCursor(data.nextCursor);
            setSearchHasMore(data.hasMore);
        } catch (e) {
            console.error('Failed to search server memos', e);
        } finally {
            setIsSearching(false);
        }
    };

    // Initial Load & Sync on Mount
    useEffect(() => {
        const init = async () => {
             try {
                // Sync on mount (when opening the list)
                await syncManager.sync();
             } catch (e) {
                 console.error('List sync failed', e);
                 // Global dialog handles this
             }
             fetchServerMemos();
        };
        init();
    }, []);

    // Infinite Scroll Handler
    const handleScroll = () => {
        if (scrollContainerRef.current) {
            sessionStorage.setItem('memoListScrollPosition', scrollContainerRef.current.scrollTop.toString());
            
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            if (scrollHeight - scrollTop - clientHeight < 200 && !isLoadingMore) {
                if (searchQuery.trim()) {
                    if (searchHasMore && searchNextCursor) {
                        setIsLoadingMore(true);
                        fetchServerSearch(searchQuery, searchNextCursor).finally(() => setIsLoadingMore(false));
                    }
                } else {
                    if (hasMore && nextCursor) {
                        setIsLoadingMore(true);
                        fetchServerMemos(nextCursor).finally(() => setIsLoadingMore(false));
                    }
                }
            }
        }
    };

    const dragCounter = useRef(0);
    const router = useRouter();
    const { addClientJob, updateClientJob } = useGlobalJobs();
    const { showToast } = useToast();
    const { confirm } = useConfirm();

    // Pull to Refresh State
    const [pullStartY, setPullStartY] = useState(0);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const PULL_THRESHOLD = 80;
    const MAX_PULL_DISTANCE = 120;

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Update URL helper
    const updateUrl = (query: string) => {
        const url = new URL(window.location.href);
        if (query) {
            url.searchParams.set('q', query);
        } else {
            url.searchParams.delete('q');
        }
        const newUrl = url.toString();
        window.history.replaceState({}, '', newUrl);
        sessionStorage.setItem('memoListUrl', url.pathname + url.search);
    };

    // Debounced Search Effect
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            if (initialQuery) {
                fetchServerSearch(initialQuery);
            }
            return;
        }
        if (!isSearchFocused) return;

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            fetchServerSearch(searchQuery);
        }, 500);

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery, isSearchFocused]);

    const handleImmediateSearch = () => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        fetchServerSearch(searchQuery);
    };

    const handleClearSearch = () => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        setSearchQuery('');
        setServerSearchResults([]);
        setSearchHasMore(false);
    };

    useEffect(() => {
        updateUrl(searchQuery);
    }, [searchQuery]);

    useEffect(() => {
        const savedScrollPosition = sessionStorage.getItem('memoListScrollPosition');
        if (savedScrollPosition && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = parseInt(savedScrollPosition, 10);
        }
    }, []);

    // Global Paste Handler
    useEffect(() => {
        const handleGlobalPaste = async (e: ClipboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const items = e.clipboardData?.items;
            if (!items) return;

            setUploading(true);
            try {
                let handled = false;
                
                const files = e.clipboardData.files;
                if (files && files.length > 0) {
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        const jobId = `paste-${Date.now()}-${i}`;
                        
                        try {
                            addClientJob({
                                id: jobId,
                                type: 'UPLOAD',
                                title: `アップロード: ${file.name}`,
                                payload: null
                            });

                            const formData = new FormData();
                            formData.append('file', file);
                            await createMemoWithFile(formData);
                            
                            updateClientJob(jobId, { status: 'COMPLETED', progress: 100 });
                        } catch (err: any) {
                             updateClientJob(jobId, { status: 'FAILED', error: err.message || 'アップロード失敗' });
                             throw err;
                        }
                    }
                    handled = true;
                }

                if (!handled) {
                    const text = e.clipboardData.getData('text/plain');
                    if (text) {
                        await createMemo(text);
                        handled = true;
                    }
                }

                if (handled) {
                    syncManager.sync();
                }
            } catch (err) {
                console.error('Global paste failed', err);
                showToast('貼り付けに失敗しました', 'error');
            } finally {
                setUploading(false);
            }
        };

        window.addEventListener('paste', handleGlobalPaste);
        return () => window.removeEventListener('paste', handleGlobalPaste);
    }, [router]);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    const startSelectionMode = () => {
        handleMenuClose();
        setIsSelectionMode(true);
        setSelectedIds(new Set());
    };

    const cancelSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
    };

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const executeDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!await confirm(`${selectedIds.size}件のメモを削除しますか？`, { severity: 'error', confirmText: '削除', title: 'メモの削除' })) return;

        await db.transaction('rw', db.memos, async () => {
            const ids = Array.from(selectedIds);
             const memosToDelete = await db.memos.bulkGet(ids);
             const validMemos = memosToDelete.filter((m): m is ClientMemo => !!m);
             
             for (const memo of validMemos) {
                 await db.memos.update(memo.id, { isDeleted: true, isDirty: true });
             }
        });
        
        syncManager.sync();
        cancelSelectionMode();
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current === 0) setIsDragging(false);
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
            setUploading(true);
            const files = Array.from(e.dataTransfer.files);
            try {
                let index = 0;
                for (const file of files) {
                    const jobId = `drop-${Date.now()}-${index++}`;
                    try {
                        addClientJob({
                            id: jobId,
                            type: 'UPLOAD',
                            title: `アップロード: ${file.name}`,
                            payload: null
                        });

                        const formData = new FormData();
                        formData.append('file', file);
                        await createMemoWithFile(formData);
                        
                        updateClientJob(jobId, { status: 'COMPLETED', progress: 100 });
                    } catch (err: any) {
                         updateClientJob(jobId, { status: 'FAILED', error: err.message || 'アップロード失敗' });
                         throw err;
                    }
                }
                syncManager.sync();
            } catch (error) {
                console.error('File upload failed', error);
                showToast('ファイルのアップロードに失敗しました', 'error');
            } finally {
                setUploading(false);
            }
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (scrollContainerRef.current && scrollContainerRef.current.scrollTop === 0 && !isRefreshing && !isSelectionMode) {
            setPullStartY(e.touches[0].clientY);
        } else {
            setPullStartY(0);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (pullStartY === 0 || isRefreshing || isSelectionMode) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - pullStartY;
        if (diff > 0 && scrollContainerRef.current?.scrollTop === 0) {
            const newDistance = Math.min(diff * 0.5, MAX_PULL_DISTANCE);
            setPullDistance(newDistance);
        }
    };

    const handleTouchEnd = () => {
        if (pullStartY === 0 || isRefreshing) return;
        if (pullDistance > PULL_THRESHOLD) {
            setIsRefreshing(true);
            setPullDistance(PULL_THRESHOLD);
            Promise.all([
                syncManager.sync(),
                fetchServerMemos()
            ]).finally(() => {
                setIsRefreshing(false);
                setPullDistance(0);
            }); 
        } else {
            setPullDistance(0);
        }
        setPullStartY(0);
    };

    const isSearchExecuted = searchQuery.trim().length > 0;

    return (
        <Box 
            sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', position: 'relative', pt: '60px' }} 
            className="memo-page-transition"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {isDragging && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0, 
                        left: 0, right: 0, bottom: 0,
                        bgcolor: 'rgba(0, 0, 0, 0.1)',
                        zIndex: 2000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(2px)',
                        pointerEvents: 'none'
                    }}
                >
                    <Box
                        sx={{
                            bgcolor: 'background.paper', p: 3, borderRadius: 2, boxShadow: 3,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1
                        }}
                    >
                        <FolderIcon sx={{ fontSize: 48, color: MEMO_COLOR }} />
                        <Box sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                            ファイルをドロップして新規メモを作成
                        </Box>
                    </Box>
                </Box>
            )}
            <MemoHeader 
                onSearchChange={!isSelectionMode ? setSearchQuery : undefined}
                onSearchClick={handleImmediateSearch}
                onClearClick={isSearchExecuted ? handleClearSearch : undefined}
                onSearchFocus={() => setIsSearchFocused(true)}
                onSearchBlur={() => setIsSearchFocused(false)}
                value={searchQuery}
                title={isSelectionMode ? `${selectedIds.size}件選択中` : "メモ一覧"} 
                loading={isSearching}
                actions={
                    isSelectionMode ? (
                        <Box>
                            <IconButton onClick={executeDelete} sx={{ color: 'error.main' }}>
                                <DeleteIcon />
                            </IconButton>
                            <IconButton onClick={cancelSelectionMode}>
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    ) : (
                        <Box>
                            <IconButton onClick={handleMenuOpen}>
                                <MoreVertIcon />
                            </IconButton>
                            <Menu
                                anchorEl={anchorEl}
                                open={Boolean(anchorEl)}
                                onClose={handleMenuClose}
                            >
                                <MenuItem onClick={startSelectionMode}>選択して削除</MenuItem>
                            </Menu>
                        </Box>
                    )
                }
            />
            
            <Box 
                ref={scrollContainerRef} 
                onScroll={handleScroll} 
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                sx={{ flex: 1, overflowY: 'auto', p: 2, position: 'relative' }}
            >
                <Box
                    sx={{
                        position: 'absolute', top: 20, left: 0, right: 0,
                        display: 'flex', justifyContent: 'center',
                        pointerEvents: 'none', zIndex: 10,
                    }}
                >
                     <motion.div
                        style={{
                            background: 'white', borderRadius: '50%', boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                            width: 40, height: 40,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        initial={{ y: -60, opacity: 0 }}
                        animate={{ 
                            y: isRefreshing ? 0 : (pullDistance > 0 ? Math.min(pullDistance - 40, 0) : -60),
                            opacity: isRefreshing || pullDistance > 0 ? 1 : 0
                        }}
                        transition={isRefreshing ? { type: "spring", stiffness: 300, damping: 30 } : { duration: 0 }}
                    >
                        <motion.div
                             animate={isRefreshing ? { rotate: 360 } : { rotate: (pullDistance / PULL_THRESHOLD) * 360 }}
                             transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : { duration: 0 }}
                             style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            {isRefreshing ? (
                                <CircularProgress size={24} thickness={5} sx={{ color: 'primary.main' }} />
                            ) : (
                                <RefreshIcon sx={{ 
                                    transform: `rotate(${Math.min(pullDistance * 2, 180)}deg)`,
                                    color: pullDistance > PULL_THRESHOLD ? 'primary.main' : 'text.secondary' 
                                }} />
                            )}
                        </motion.div>
                    </motion.div>
                </Box>
                
                <Box sx={{ transition: 'none' }}>
                {!isSearching && displayMemos.length === 0 ? (
                    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="50vh" color="text.secondary">
                        <NoteIcon sx={{ fontSize: 60, mb: 2, opacity: 0.5 }} />
                        <Typography>メモはありません</Typography>
                    </Box>
                ) : (
                    <List component={motion.ul} layout>
                        <AnimatePresence mode='popLayout'>
                        {displayMemos.map(memo => {
                            const isSelected = selectedIds.has(memo.id);
                            
                            return (
                                <ListItem 
                                    component={motion.li}
                                    layout
                                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                                    animate={{ 
                                        opacity: memo.isServerOnly ? 0.7 : 1,
                                        y: 0, 
                                        scale: 1,
                                    }}
                                    exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
                                    transition={{ type: 'spring', duration: 0.4, bounce: 0, layout: { duration: 0.3 } }}
                                    key={memo.id} 
                                    disablePadding 
                                    sx={{ 
                                        mb: 1, 
                                        bgcolor: memo.isServerOnly ? alpha(MEMO_COLOR, 0.05) : alpha(MEMO_COLOR, 0.1), 
                                        borderRadius: 3, 
                                        overflow: 'hidden',
                                        // Border logic restored (fixed color)
                                        border: '1px solid',
                                        borderColor: isSelected ? 'primary.main' : MEMO_COLOR,
                                        boxShadow: 'none',
                                    }}
                                    secondaryAction={
                                        isSelectionMode ? (
                                            <Checkbox 
                                                edge="end" checked={isSelected}
                                                onChange={() => toggleSelection(memo.id)}
                                                sx={{ 
                                                    color: MEMO_COLOR,
                                                    '&.Mui-checked': { color: MEMO_COLOR },
                                                }}
                                            />
                                        ) : (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                {memo.isDirty && (
                                                    <Box sx={{ color: 'warning.main', display: 'flex', alignItems: 'center', mr: 0.5 }} title="未同期">
                                                        <UnsyncedIcon sx={{ fontSize: 16 }} />
                                                    </Box>
                                                )}
                                                {memo.isServerOnly && (
                                                    <CloudIcon sx={{ fontSize: 16, color: 'text.secondary', opacity: 0.6 }} />
                                                )}
                                                <MemoListEditButton id={memo.id} />
                                            </Box>
                                        )
                                    }
                                >
                                    {isSelectionMode ? (
                                        <ListItemButton onClick={() => toggleSelection(memo.id)} sx={{ p: 1, pr: 8 }}>
                                           <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
                                                <Box sx={{ 
                                                    mr: 2, flexShrink: 0, width: 48, height: 48, 
                                                    position: 'relative', borderRadius: 1, overflow: 'hidden', 
                                                    bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    {memo.thumbnailPath ? (
                                                        <Image src={memo.thumbnailPath} alt="thumbnail" fill sizes="48px" style={{ objectFit: 'cover' }} />
                                                    ) : (
                                                        <NoteIcon sx={{ fontSize: 24, color: 'text.secondary', opacity: 0.7 }} />
                                                    )}
                                                </Box>
                                                <ListItemText 
                                                    primary={memo.title} 
                                                    secondary={new Date(memo.updatedAt).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} 
                                                    primaryTypographyProps={{ fontWeight: 'bold' }}
                                                />
                                            </Box>
                                        </ListItemButton>
                                    ) : (
                                        <MemoListItemButton href={`/memos/${memo.id}`} sx={{ p: 1, pr: 8 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
                                                <Box sx={{ 
                                                    mr: 2, flexShrink: 0, width: 56, height: 56, 
                                                    position: 'relative', borderRadius: 1, overflow: 'hidden', 
                                                    bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    {memo.thumbnailPath ? (
                                                        <Image src={memo.thumbnailPath} alt="thumbnail" fill sizes="56px" style={{ objectFit: 'cover' }} />
                                                    ) : (
                                                        <NoteIcon sx={{ fontSize: 28, color: 'text.secondary', opacity: 0.7 }} />
                                                    )}
                                                </Box>

                                                <ListItemText 
                                                    primary={memo.title} 
                                                    secondary={new Date(memo.updatedAt).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} 
                                                    primaryTypographyProps={{ fontWeight: 'bold', noWrap: true }}
                                                    secondaryTypographyProps={{ noWrap: true }}
                                                    sx={{ minWidth: 0, flex: 1 }}
                                                />
                                            </Box>
                                        </MemoListItemButton>
                                    )}
                                </ListItem>
                            );
                        })}
                        </AnimatePresence>
                        
                        {/* Loading More Indicator */}
                        {isLoadingMore && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                <CircularProgress size={24} />
                            </Box>
                        )}
                    </List>
                )}
                </Box>
            </Box>

            {!isSelectionMode && <MemoListFabs />}
        </Box>
    );
}
