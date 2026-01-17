import React, { useMemo, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Attachment } from './MemoFileManagement';
import { Box, Typography, IconButton } from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';
import { 
    PictureAsPdf as PdfIcon, 
    AudioFile as AudioIcon,
    VideoFile as VideoIcon,
    TextSnippet as TextIcon,
    Download as DownloadIcon
} from '@mui/icons-material';
import FullImageModal from './FullImageModal';
import SmartImage from './SmartImage';

interface MarkdownDisplayProps {
    children: string;
    attachments?: Attachment[];
    onImageClick?: (src: string) => void;
}

const MarkdownDisplay = memo(function MarkdownDisplay({ children, attachments = [], onImageClick }: MarkdownDisplayProps) {

    const renderAttachment = useCallback((url: string, originalNode: React.ReactNode, isImageTag: boolean) => {
        const file = attachments.find(a => a.filePath === url || encodeURI(a.filePath) === url);
        
        if (!file) return originalNode;

        const isImage = file.mimeType.startsWith('image/');
        const isAudio = file.mimeType.startsWith('audio/');
        const isVideo = file.mimeType.startsWith('video/');
        const isPdf = file.mimeType === 'application/pdf';

        if (isImage) {
             return (
                 <SmartImage
                    src={file.filePath}
                    alt={file.fileName}
                    onClick={() => onImageClick?.(file.filePath)}
                 />
             );
        }

        if (isAudio) {
            return (
                <Box sx={{ my: 2, p: 2, border: '1px solid #eee', borderRadius: 2, width: '100%' }} className="not-selectable">
                     <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <AudioIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2" noWrap>{file.fileName}</Typography>
                     </Box>
                    <audio controls src={file.filePath} style={{ width: '100%' }} />
                </Box>
            );
        }

        if (isVideo) {
            return (
                 <Box sx={{ my: 2, width: '100%' }} className="not-selectable">
                    <video 
                        controls 
                        src={file.filePath} 
                        style={{ width: '100%', maxHeight: '500px', borderRadius: '8px', backgroundColor: '#000' }} 
                    />
                 </Box>
            );
        }

        // PDF / Text / Others -> File Card with internal Link
        return (
            <Link href={`/memos/files/${file.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Box sx={{ 
                    my: 1, 
                    p: 2, 
                    border: '1px solid #e0e0e0', 
                    borderRadius: 2, 
                    display: 'flex', 
                    alignItems: 'center', 
                    bgcolor: 'background.paper',
                    '&:hover': { bgcolor: 'action.hover' }
                }} className="not-selectable">
                    <Box sx={{ mr: 2, color: isPdf ? 'error.main' : 'text.secondary', display: 'flex', alignItems: 'center' }}>
                        {isPdf ? <PdfIcon /> : <TextIcon />}
                    </Box>
                    <Box sx={{ overflow: 'hidden', flex: 1 }}>
                        <Typography variant="body2" fontWeight="bold" noWrap>{file.fileName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {file.mimeType} • {(file.fileSize / 1024).toFixed(1)} KB
                        </Typography>
                    </Box>
                    <IconButton 
                        size="small" 
                        onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                                // fetch経由でダウンロードすることでService Workerがキャッシュできる
                                const response = await fetch(file.filePath);
                                const blob = await response.blob();
                                const blobUrl = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = blobUrl;
                                link.download = file.fileName;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                            } catch (error) {
                                console.error('Download failed:', error);
                                // フォールバック: 直接リンクでダウンロード試行
                                const link = document.createElement('a');
                                link.href = file.filePath;
                                link.download = file.fileName;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }
                        }}
                        sx={{ ml: 1, color: 'text.secondary' }}
                    >
                        <DownloadIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Link>
        );
    }, [attachments, onImageClick]);

    const markdownComponents = useMemo(() => ({
        a: ({node, ...props}: any) => {
            const href = (props.href || '') as string;
            const original = <a {...props} href={href} style={{ color: '#1976d2', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer" />;
            return renderAttachment(href, original, false);
        },
        img: (props: any) => {
            const src = (props.src || '') as string;
            // For external or any image, use SmartImage for consistent behavior
            return (
                <SmartImage
                    src={src}
                    alt={props.alt || 'image'}
                    onClick={() => src && onImageClick?.(src)}
                />
            );
        },
        p: ({node, ...props}: any) => <div {...props} style={{ margin: 0, marginBottom: '0.5em' }} />,
        pre: ({node, ...props}: any) => (
            <pre 
                {...props} 
                style={{ 
                    backgroundColor: '#0d0d0d', 
                    color: '#fff', 
                    padding: '1rem', 
                    borderRadius: '0.5rem', 
                    overflowX: 'auto',
                    marginBlock: '0.5rem',
                    fontFamily: 'monospace'
                }} 
            />
        ),
        code: ({node, className, children, ...props}: any) => {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match && !String(children).includes('\n')
            return isInline ? (
                <code 
                    {...props} 
                    className={className} 
                    style={{ 
                        backgroundColor: '#f3f3f3', 
                        color: '#333',
                        borderRadius: '0.2rem',
                        padding: '0.2em 0.4em',
                        fontFamily: 'monospace',
                        fontSize: '0.9em'
                    }}
                >
                    {children}
                </code>
            ) : (
                <code {...props} className={className} style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                    {children}
                </code>
            )
        },
        ol: ({node, ...props}: any) => <ol {...props} style={{ paddingLeft: '1.2rem', marginBlock: '0.5rem' }} />,
        ul: ({node, ...props}: any) => <ul {...props} style={{ paddingLeft: '1.2rem', marginBlock: '0.5rem' }} />,
        li: ({node, ...props}: any) => <li {...props} style={{ marginBottom: '0.2rem' }} />
    }), [onImageClick, renderAttachment]);

    const markdownContent = useMemo(() => (
        <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm, remarkBreaks]}
            rehypePlugins={[rehypeKatex]}
            components={markdownComponents}
        >
            {children}
        </ReactMarkdown>
    ), [children, markdownComponents]);

    return (
        <div className="selectable-text" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.6 }}>
            {markdownContent}
        </div>
    );
});

export default MarkdownDisplay;
