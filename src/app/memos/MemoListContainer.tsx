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
    Note as NoteIcon 
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
    const [hasMore, setHasMore] = useState(true);
    const observerTarget = useRef(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const dragCounter = useRef(0);
    const router = useRouter();

    // Reset memos when initialMemos changes (e.g. after server action redirect)
    useEffect(() => {
        setMemos(initialMemos);
        // We generally want to respect the initialMemos regarding hasMore check logic roughly,
        // but explicit hasMore logic is better handled by checking count.
        // If initialMemos is big (restored), hasMore can be derived.
        // Simplified:
        // setHasMore(initialMemos.length >= 20); // Not accurate if restored with 60 items.
    }, [initialMemos]);

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

    // Debounced Search Effect
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
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
    }, [searchQuery]);

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
                        const formData = new FormData();
                        formData.append('file', file);
                        await createMemoWithFile(formData);
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
                alert('貼り付けに失敗しました');
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
        if (!confirm(`${selectedIds.size}件のメモを削除しますか？`)) return;

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
                for (const file of files) {
                    const formData = new FormData();
                    formData.append('file', file);
                    await createMemoWithFile(formData);
                }
            } catch (error) {
                console.error('File upload failed', error);
                alert('ファイルのアップロードに失敗しました');
            } finally {
                setUploading(false);
            }
        }
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
            
            <Box ref={scrollContainerRef} onScroll={handleScroll} sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
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

            {!isSelectionMode && <MemoListFabs />}
        </Box>
    );
}
