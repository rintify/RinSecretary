'use client';

import { useState, useRef, useEffect } from 'react';
import { 
    Box, List, ListItem, ListItemButton, ListItemText, 
    Checkbox, IconButton, Menu, MenuItem, Typography 
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    MoreVert as MoreVertIcon, 
    Delete as DeleteIcon, 
    Close as CloseIcon, 
    Note as NoteIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import MemoHeader from '../components/MemoHeader';
import { MemoListFabs, MemoListEditButton, MemoListItemButton } from './MemoListClient';
import { deleteMemos, createMemoWithFile, createMemo, getMemos } from './actions';
import { MEMO_COLOR } from '../utils/colors';
import { Folder as FolderIcon } from '@mui/icons-material';
import CircularProgress from '@mui/material/CircularProgress';
import { useGlobalJobs } from '../context/GlobalJobContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

type Attachment = {
    id: string;
    filePath: string;
    mimeType: string;
};

type Memo = {
    id: string;
    title: string;
    // content: string; // Removed for payload optimization
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    thumbnailPath?: string | null;
};

export default function MemoListContainer({ memos: initialMemos, initialQuery = '' }: { memos: Memo[], initialQuery?: string }) {
    const [memos, setMemos] = useState<Memo[]>(initialMemos);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    // Search & Pagination
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const observerTarget = useRef(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const dragCounter = useRef(0);
    const router = useRouter();
    const { addClientJob, updateClientJob } = useGlobalJobs();
    const { showToast } = useToast();
    const { confirm } = useConfirm();

    // Pull to Refresh State
    const [pullStartY, setPullStartY] = useState(0);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const PULL_THRESHOLD = 80; // 更新トリガーとなる距離
    const MAX_PULL_DISTANCE = 120; // 最大引き下げ距離

    // Reset memos when initialMemos changes (e.g. after server action redirect)
    // Reset memos when initialMemos changes (e.g. after server action redirect)
    useEffect(() => {
        setMemos(initialMemos);
        if (isRefreshing) {
            setIsRefreshing(false);
            setPullDistance(0);
        }
        // Simplified hasMore logic
        // setHasMore(initialMemos.length >= 20); 
    }, [initialMemos, isRefreshing]);

    const [lastSearchedQuery, setLastSearchedQuery] = useState(initialQuery);

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Update URL helper
    const updateUrl = (query: string, count: number) => {
        const url = new URL(window.location.href);
        if (query) {
            url.searchParams.set('q', query);
        } else {
            url.searchParams.delete('q');
        }
        if (count > 20) {
            url.searchParams.set('take', count.toString());
        } else {
            url.searchParams.delete('take');
        }
        const newUrl = url.toString();
        window.history.replaceState({}, '', newUrl);
        // Save to sessionStorage for back navigation
        sessionStorage.setItem('memoListUrl', url.pathname + url.search);
    };

    // Search Execution Logic
    const executeSearch = async (query: string) => {
        setIsSearching(true);
        try {
            const newMemos = await getMemos({ query, skip: 0, take: 20 });
            setMemos(newMemos);
            setHasMore(newMemos.length >= 20);
            setLastSearchedQuery(query);
            // updateUrl handled by useEffect
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    const isFirstRender = useRef(true);

    // Debounced Search Effect (only when search bar is focused)
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        // Only execute debounced search when search bar is focused
        if (!isSearchFocused) {
            return;
        }

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            executeSearch(searchQuery);
        }, 1000);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, isSearchFocused]);

    // Immediate Search Handler
    const handleImmediateSearch = () => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        executeSearch(searchQuery);
    };

    const handleClearSearch = () => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        setSearchQuery('');
        setLastSearchedQuery('');
        executeSearch('');
    };
    
    // Derived state for Header
    const isSearchExecuted = searchQuery && searchQuery === lastSearchedQuery;

    // Infinite Scroll
    const loadMore = async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const currentCount = memos.length;
            const newMemos = await getMemos({ 
                query: searchQuery, 
                skip: currentCount, 
                take: 20 
            });
            
            if (newMemos.length < 20) {
                setHasMore(false);
            }
            
            setMemos(prev => [...prev, ...newMemos]);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingMore(false);
        }
    };
    
    // Sync URL with state
    useEffect(() => {
        updateUrl(searchQuery, memos.length);
    }, [searchQuery, memos.length]);

    // Scroll position restore on mount
    useEffect(() => {
        const savedScrollPosition = sessionStorage.getItem('memoListScrollPosition');
        if (savedScrollPosition && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = parseInt(savedScrollPosition, 10);
        }
    }, []);

    // Save scroll position on scroll
    const handleScroll = () => {
        if (scrollContainerRef.current) {
            sessionStorage.setItem('memoListScrollPosition', scrollContainerRef.current.scrollTop.toString());
        }
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !loadingMore && !isSearching) {
                    loadMore();
                }
            },
            { threshold: 0.1 } // Start loading when 10% visible
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [hasMore, loadingMore, isSearching, memos.length, searchQuery]);


    useEffect(() => {
        const handleGlobalPaste = async (e: ClipboardEvent) => {
            // 入力フィールドなどにフォーカスがある場合は通常の挙動を優先
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const items = e.clipboardData?.items;
            if (!items) return;

            setUploading(true);
            try {
                let handled = false;
                
                // 1. ファイル（Finderからのコピーなど）
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

                // 2. テキスト（ファイルがない場合）
                if (!handled) {
                    const text = e.clipboardData.getData('text/plain');
                    if (text) {
                        await createMemo(text);
                        handled = true;
                    }
                }

                if (handled) {
                    router.refresh();
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

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

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
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const executeDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!await confirm(`${selectedIds.size}件のメモを削除しますか？`, { severity: 'error', confirmText: '削除', title: 'メモの削除' })) return;

        await deleteMemos(Array.from(selectedIds));
        cancelSelectionMode();
    };

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
            } catch (error) {
                console.error('File upload failed', error);
                showToast('ファイルのアップロードに失敗しました', 'error');
            } finally {
                setUploading(false);
            }
        }
    };

    // Pull to Refresh Handlers
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
            // スクロールをキャンセルしてPull動作を有効にする
            // 注意: これを過度に行うと通常のスクロールが阻害される可能性があるため、scrollTop === 0 の時のみ
            const newDistance = Math.min(diff * 0.5, MAX_PULL_DISTANCE); // 抵抗係数 0.5
            setPullDistance(newDistance);
        }
    };

    const handleTouchEnd = () => {
        if (pullStartY === 0 || isRefreshing) return;

        if (pullDistance > PULL_THRESHOLD) {
            setIsRefreshing(true);
            setPullDistance(PULL_THRESHOLD); // 更新中は閾値の位置で固定
            router.refresh();
        } else {
            setPullDistance(0);
        }
        setPullStartY(0);
    };

    return (
        <Box 
            sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', position: 'relative', pt: '60px' }} 
            className="memo-page-transition"
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
                        pointerEvents: 'none'
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
                {/* Pull to refresh indicator */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: 20, // 固定位置（上部）
                        left: 0,
                        right: 0,
                        display: 'flex',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        zIndex: 10, // リストの上に表示
                    }}
                >
                     <motion.div
                        style={{
                            background: 'white',
                            borderRadius: '50%',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                            width: 40,
                            height: 40,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
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
                
                <Box sx={{ 
                    // コンテンツ自体の押し下げは削除
                    transition: 'none'
                }}>
                {!isSearching && memos.length === 0 ? (
                    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="50vh" color="text.secondary">
                        <NoteIcon sx={{ fontSize: 60, mb: 2, opacity: 0.5 }} />
                        <Typography>メモはありません</Typography>
                    </Box>
                ) : (
                    <List component={motion.ul} layout>
                        <AnimatePresence mode='popLayout'>
                        {memos.map(memo => {
                            const isSelected = selectedIds.has(memo.id);
                            // TaskItem風のデザインを適用
                            // Border color priority: Selection -> Default (MEMO_COLOR)
                            const borderColor = (isSelectionMode && isSelected) ? 'primary.main' : MEMO_COLOR;
                            
                            return (
                                <ListItem 
                                    component={motion.li}
                                    layout
                                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
                                    transition={{ type: 'spring', duration: 0.4, bounce: 0, layout: { duration: 0.3 } }}
                                    key={memo.id} 
                                    disablePadding 
                                    sx={{ 
                                        mb: 1, 
                                        bgcolor: alpha(MEMO_COLOR, 0.1), 
                                        borderRadius: 3, 
                                        overflow: 'hidden',
                                        // transition: 'all 0.2s', // Conflict with framer-motion
                                        border: '1px solid',
                                        borderColor: borderColor,
                                        boxShadow: 'none',
                                    }}
                                    secondaryAction={
                                        isSelectionMode ? (
                                            <Checkbox 
                                                edge="end"
                                                checked={isSelected}
                                                onChange={() => toggleSelection(memo.id)}
                                                sx={{ 
                                                    color: MEMO_COLOR,
                                                    '&.Mui-checked': {
                                                        color: MEMO_COLOR,
                                                    },
                                                }}
                                            />
                                        ) : (
                                            <MemoListEditButton id={memo.id} />
                                        )
                                    }
                                >
                                    {isSelectionMode ? (
                                        <ListItemButton onClick={() => toggleSelection(memo.id)} sx={{ p: 1, pr: 8 }}>
                                           <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
                                                {/* サムネイルエリア */}
                                                <Box sx={{ 
                                                    mr: 2, 
                                                    flexShrink: 0, 
                                                    width: 48, 
                                                    height: 48, 
                                                    position: 'relative', 
                                                    borderRadius: 1, 
                                                    overflow: 'hidden', 
                                                    bgcolor: 'action.hover', // サムネイル背景は少し濃くするか、白にするか。
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {memo.thumbnailPath ? (
                                                        <Image 
                                                            src={memo.thumbnailPath} 
                                                            alt="thumbnail" 
                                                            fill 
                                                            sizes="48px"
                                                            style={{ objectFit: 'cover' }} 
                                                        />
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
                                                {/* サムネイルエリア */}
                                                <Box sx={{ 
                                                    mr: 2, 
                                                    flexShrink: 0, 
                                                    width: 56, 
                                                    height: 56, 
                                                    position: 'relative', 
                                                    borderRadius: 1, 
                                                    overflow: 'hidden', 
                                                    bgcolor: 'action.hover',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {memo.thumbnailPath ? (
                                                        <Image 
                                                            src={memo.thumbnailPath} 
                                                            alt="thumbnail" 
                                                            fill 
                                                            sizes="56px"
                                                            style={{ objectFit: 'cover' }} 
                                                        />
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
                    </List>
                )}
                
                {/* Sentinel for infinite scroll */}
                <Box ref={observerTarget} sx={{ height: '20px', display: 'flex', justifyContent: 'center', mt: 2 }}>
                    {loadingMore && <CircularProgress size={24} />}
                </Box>
                </Box>
            </Box>

            {!isSelectionMode && <MemoListFabs />}
        </Box>
    );
}
