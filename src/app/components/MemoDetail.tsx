'use client';

import { useState } from 'react';
import { Box, Fab, IconButton, Popover, Badge, Tooltip } from '@mui/material';
import { Edit as EditIcon, Info as InfoIcon, Folder as FolderIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import MemoHeader from './MemoHeader';
import MarkdownDisplay from './MarkdownDisplay';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MEMO_COLOR } from '../utils/colors';
import MemoFileManagement, { Attachment } from './MemoFileManagement';
import FullImageModal from './FullImageModal';
import { getAttachments } from '../memos/actions';
import { useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/db';
import { cacheMemoFromServer } from '@/lib/memo-actions';
import { useLiveQuery } from 'dexie-react-hooks';
import { OFFLINE_FILE_SIZE_LIMIT } from '@/lib/constants';
import Image from 'next/image';
import { 
    InsertDriveFile as FileIcon, 
    PictureAsPdf as PdfIcon,
    AudioFile as AudioIcon,
    VideoFile as VideoIcon,
    TextSnippet as TextIcon,
    Cloud as CloudIcon,
    CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

interface MemoDetailProps {
    memo: {
        id: string;
        title: string;
        content: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
    };
}

export default function MemoDetail({ memo }: MemoDetailProps) {
    const router = useRouter();

    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const [isFileManagementOpen, setIsFileManagementOpen] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [attachmentsChanged, setAttachmentsChanged] = useState(false);

    // 詳細画面を開いた時にメモをキャッシュ（オフラインで閲覧可能にする）
    useEffect(() => {
        cacheMemoFromServer(memo);
    }, [memo]);

    const localAttachments = useLiveQuery(
        () => db.attachments.where('memoId').equals(memo.id).toArray(),
        [memo.id]
    );

    // キャッシュ状態を計算 (サーバー側の attachments をマスターとして比較)
    const cacheStats = (() => { // useMemo推奨だが、現状の構成に合わせて即時関数またはuseMemoに書き換えたいところだが、他への影響最小限にするためロジックのみ変更
        if (!attachments || attachments.length === 0) return { status: 'none', message: '' };
        
        let cachedCount = 0;
        let uncacheableCount = 0;

        // 全ファイルをチェック
        const allCached = attachments.every(sf => {
            const local = (localAttachments || []).find((lf: any) => lf.id === sf.id);
            const hasBlob = !!(local && local.blob);
            
            if (hasBlob) cachedCount++;
            if (sf.fileSize > OFFLINE_FILE_SIZE_LIMIT) uncacheableCount++;

            return hasBlob;
        });

        // 全てblobがあれば緑。一つでも欠けていれば（サイズオーバー含む）partial
        if (allCached) {
            return { status: 'all', message: '全ファイルキャッシュ済み' };
        } else {
            const message = uncacheableCount > 0 
                ? `未キャッシュ、またはサイズ制限(${OFFLINE_FILE_SIZE_LIMIT/1024/1024}MB超)のファイルがあります`
                : '未キャッシュのファイルがあります';
            return { status: 'partial', message };
        }
    })();
    
    // ...

                            <Tooltip title={cacheStats.message}>
                                <IconButton onClick={() => setIsFileManagementOpen(true)} edge="end" sx={{ color: MEMO_COLOR, mr: 1 }}>
                                    <Badge
                                        overlap="circular"
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                        badgeContent={
                                            cacheStats.status === 'all' ? (
                                                <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main', bgcolor: 'white', borderRadius: '50%' }} />
                                            ) : cacheStats.status === 'partial' ? (
                                                <CloudIcon sx={{ fontSize: 14, color: 'text.secondary', bgcolor: 'white', borderRadius: '50%' }} />
                                            ) : null
                                        }
                                    >
                                        <FolderIcon />
                                    </Badge>
                                </IconButton>
                            </Tooltip>

    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

    const handleImageClick = useCallback((src: string) => {
        setSelectedImageUrl(src);
        setImageModalOpen(true);
    }, []);
    
    const handleFilesChange = useCallback(() => {
        setAttachmentsChanged(true);
    }, []);

    useEffect(() => {
        if (!isFileManagementOpen) {
            if (attachmentsChanged || attachments.length === 0) {
                loadAttachments();
                setAttachmentsChanged(false);
            }
        }
    }, [memo.id, isFileManagementOpen, attachmentsChanged, attachments.length]);

    // Long press logic
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPress = useRef(false);

    const loadAttachments = async () => {
        try {
            const files = await getAttachments(memo.id);
            setAttachments(files);
        } catch (e) {
            console.error(e);
        }
    };

    const handleTouchStart = (file: Attachment) => {
        isLongPress.current = false;
        timerRef.current = setTimeout(() => {
            isLongPress.current = true;
            handleDownload(file);
        }, 800);
    };

    const handleTouchEnd = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const handleDownload = (file: Attachment) => {
        // Haptic feedback if available (optional)
        if (navigator.vibrate) navigator.vibrate(50);
        
        const link = document.createElement('a');
        link.href = file.filePath;
        link.download = file.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileClick = (file: Attachment) => {
        if (isLongPress.current) return;
        
        // Audio/Video: handled by inline controls if visible, but if clicking the card area:
        // Requirement: "その場で再生" (Play locally) implies controls are exposed.
        // If clicking non-control area, maybe open viewer or do nothing.
        // For simplicity, we just navigate to viewer for non-media types.
        
        if (file.mimeType.startsWith('video/') || file.mimeType.startsWith('audio/')) {
            // Do nothing on container click, let user interact with controls
            return; 
        }

        // Navigate to viewer for Text/PDF/Image/Others
        router.push(`/memos/files/${file.id}`);
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleInfoClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleInfoClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);

    const handleEditClick = () => {
        router.push(`/memos/${memo.id}/edit`);
    };

    return (
        <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', pt: '60px' }} className="memo-page-transition">
            <MemoHeader 
                title="メモ詳細" 
                actions={
                    <Box>
                        <Tooltip title={cacheStats.message}>
                            <IconButton onClick={() => setIsFileManagementOpen(true)} edge="end" sx={{ color: MEMO_COLOR, mr: 1 }}>
                                <Badge
                                    overlap="circular"
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                    badgeContent={
                                        cacheStats.status === 'all' ? (
                                            <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main', bgcolor: 'white', borderRadius: '50%' }} />
                                        ) : cacheStats.status === 'partial' ? (
                                            <CloudIcon sx={{ fontSize: 14, color: 'text.secondary', bgcolor: 'white', borderRadius: '50%' }} />
                                        ) : null
                                    }
                                >
                                    <FolderIcon />
                                </Badge>
                            </IconButton>
                        </Tooltip>
                        <IconButton onClick={handleInfoClick} edge="end" sx={{ color: MEMO_COLOR }}>
                            <InfoIcon />
                        </IconButton>
                    </Box>
                }
            />
            
            <MemoFileManagement 
                memoId={memo.id}
                open={isFileManagementOpen}
                onClose={() => setIsFileManagementOpen(false)}
                onFilesChange={handleFilesChange}
            />
            
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleInfoClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                <Box sx={{ p: 2 }}>
                    <Box sx={{ mb: 1 }}>
                        <strong>作成日時:</strong> {new Date(memo.createdAt).toLocaleString()}
                    </Box>
                    <Box>
                        <strong>更新日時:</strong> {new Date(memo.updatedAt).toLocaleString()}
                    </Box>
                </Box>
            </Popover>

            <Box sx={{ flex: 1, p: 2, overflow: 'auto', paddingBottom: '160px' }} className="selectable-text">
                 <MarkdownDisplay 
                    attachments={attachments}
                    onImageClick={handleImageClick}
                  >
                    {memo.content}
                 </MarkdownDisplay>
            </Box>

            <Box sx={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                <Fab 
                    color="primary" 
                    aria-label="edit" 
                    onClick={handleEditClick}
                    sx={{ bgcolor: MEMO_COLOR, '&:hover': { bgcolor: MEMO_COLOR, opacity: 0.9 } }}
                >
                    <EditIcon />
                </Fab>
                <Fab 
                    aria-label="back"
                    onClick={() => {
                        const savedUrl = sessionStorage.getItem('memoListUrl');
                        router.push(savedUrl || '/memos');
                    }}
                    sx={{ bgcolor: 'background.paper', color: MEMO_COLOR, '&:hover': { bgcolor: 'action.hover' } }}
                >
                    <ArrowBackIcon />
                </Fab>
            </Box>

            <FullImageModal 
                open={imageModalOpen} 
                onClose={() => setImageModalOpen(false)} 
                imageUrl={selectedImageUrl} 
            />
        </Box>
    );
}
