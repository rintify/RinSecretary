'use client';

import { useEffect, useState, use } from 'react';
import { Box, Typography, CircularProgress, Fab, IconButton } from '@mui/material';
import { 
    ArrowBack as ArrowBackIcon, 
    FormatListNumbered as LineNumberIcon 
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { MEMO_COLOR } from '@/app/utils/colors';
import MemoHeader from '@/app/components/MemoHeader';
import Editor from '@monaco-editor/react';

export default function FileViewerPage(props: { params: Promise<{ fileId: string }> }) {
    const params = use(props.params); 
    const [content, setContent] = useState<string>('');
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [fileType, setFileType] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('ファイルプレビュー');
    const [loading, setLoading] = useState(true);
    const [showLineNumbers, setShowLineNumbers] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const fetchFile = async () => {
            try {
                const res = await fetch(`/api/attachments/${params.fileId}`);
                if (!res.ok) throw new Error('File not found');
                const data = await res.json();
                
                setFileUrl(data.filePath);
                setFileType(data.mimeType);
                setFileName(data.fileName || 'ファイルプレビュー');

                const isPdf = data.mimeType === 'application/pdf';
                const isMedia = data.mimeType.startsWith('image/') || 
                                data.mimeType.startsWith('audio/') || 
                                data.mimeType.startsWith('video/');

                if (!isPdf && !isMedia) {
                    const textRes = await fetch(data.filePath);
                    const text = await textRes.text();
                    setContent(text);
                    setFileType('text/plain'); 
                    // デフォルトで行番号を表示するかどうか（画面幅等で調整可能だが、まずは明示的なトグル優先）
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchFile();
    }, [params.fileId]);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100dvh">
                <CircularProgress sx={{ color: MEMO_COLOR }} />
            </Box>
        );
    }

    if (!fileUrl) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100dvh">
                <Typography>ファイルが見つかりません</Typography>
            </Box>
        );
    }

    return (
        <Box height="100dvh" display="flex" flexDirection="column" bgcolor="background.default" className="memo-page-transition">
            <MemoHeader 
                title={fileName} 
                actions={
                    fileType === 'text/plain' && (
                        <IconButton 
                            onClick={() => setShowLineNumbers(!showLineNumbers)}
                            sx={{ color: showLineNumbers ? MEMO_COLOR : 'text.secondary' }}
                        >
                            <LineNumberIcon />
                        </IconButton>
                    )
                }
            />
            
            <Box flex={1} overflow="hidden" position="relative">
                {fileType === 'application/pdf' ? (
                    <iframe src={fileUrl} width="100%" height="100%" style={{ border: 'none' }} />
                ) : fileType === 'text/plain' ? (
                    <Editor
                        height="100%"
                        defaultLanguage="plaintext"
                        value={content}
                        options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: showLineNumbers ? 'on' : 'off',
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                            automaticLayout: true,
                            contextmenu: true,
                            selectionHighlight: false,
                            occurrencesHighlight: 'off',
                            renderLineHighlight: 'none',
                            lineDecorationsWidth: showLineNumbers ? 10 : 0, // 行番号エリアの幅
                            unicodeHighlight: {
                                ambiguousCharacters: false,
                                invisibleCharacters: false,
                            },
                            renderWhitespace: 'none',
                            renderControlCharacters: false,
                            padding: { bottom: 80 },
                            scrollbar: {
                                verticalScrollbarSize: 6,
                                horizontalScrollbarSize: 6,
                            }
                        }}
                        theme="vs"
                    />
                ) : (
                    <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                         <Typography>プレビューできないファイル形式です</Typography>
                    </Box>
                )}
            </Box>

            <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 2000 }}>
                <Fab 
                    aria-label="back"
                    onClick={() => router.back()}
                    sx={{ bgcolor: 'background.paper', color: MEMO_COLOR, '&:hover': { bgcolor: 'action.hover' } }}
                >
                    <ArrowBackIcon />
                </Fab>
            </Box>
        </Box>
    );
}
