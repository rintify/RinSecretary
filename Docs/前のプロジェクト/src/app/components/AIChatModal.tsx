'use client';

import { useState, useRef, useEffect } from 'react';
import { 
    Dialog, DialogContent, Box, Typography, IconButton, 
    TextField, Button, Tooltip, Select, MenuItem, FormControl,
    Accordion, AccordionSummary, AccordionDetails,
    CircularProgress, Snackbar, Alert, Paper
} from '@mui/material';
import { 
    Close as CloseIcon, 
    Send as SendIcon, 
    SmartToy as BotIcon, 
    Person as UserIcon,
    Save as SaveIcon,
    AttachFile as AttachFileIcon,
    Image as ImageIcon,
    Delete as DeleteIcon,
    Public as GlobeIcon,
    PublicOff as GlobeOffIcon,
    InsertDriveFile as FileIcon,
    Palette as PaletteIcon,
    ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import MarkdownDisplay from './MarkdownDisplay';
import { createMemo } from '@/app/memos/actions';
import { useRouter } from 'next/navigation';
import { chatWithAI, getAIConfigs } from '@/lib/ai-actions';
import { submitJob, getJob } from '@/app/actions/job';
import { useGlobalJobs } from '@/app/context/GlobalJobContext';


export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    images?: string[]; // Data URIs
    thought?: string; // Reasoning Process
    usage?: {
        promptTokens: number;
        responseTokens: number;
        totalTokens: number;
    };
}

interface AIChatModalProps {
    open: boolean;
    onClose: () => void;
    initialMessages?: Message[];
}

export default function AIChatModal({ open, onClose, initialMessages }: AIChatModalProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages || []);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSearchEnabled, setIsSearchEnabled] = useState(false);
    const [isImageGenEnabled, setIsImageGenEnabled] = useState(false);
    const [attachments, setAttachments] = useState<{ file: File; preview: string }[]>([]);
    
    // AI Configs
    const [configs, setConfigs] = useState<{id: string, name: string}[]>([]);
    const [selectedConfigId, setSelectedConfigId] = useState<string>('');

    // Sync initialMessages when modal opens or prop changes
    useEffect(() => {
        if (open && initialMessages) {
            setMessages(initialMessages);
        } else if (open && !initialMessages) {
            // New chat
            setMessages([]);
        }
    }, [open, initialMessages]);

    // Compose Modal State
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    
    // Toast State
    const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

    const { jobs, refreshServerJobs } = useGlobalJobs();
    
    // Auto-scroll logic
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);



    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (open) {
            getAIConfigs().then(data => {
                setConfigs(data.map(c => ({ id: c.id, name: c.name })));
                if (data.length > 0 && !selectedConfigId) {
                    setSelectedConfigId(data[0].id);
                }
            });
            scrollToBottom();
        }
    }, [messages, open, selectedConfigId]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result;
                if (typeof result === 'string') {
                    setAttachments(prev => [...prev, { file, preview: result }]);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSend = async () => {
        if (!input.trim() && attachments.length === 0) return;

        const images = attachments.map(a => a.preview);

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            images: images.length > 0 ? images : undefined,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setAttachments([]); 
        setIsLoading(true);
        setIsComposeOpen(false); // Close compose modal on send

        // Add placeholder for AI response
        const aiMsgId = (Date.now() + 1).toString();
        const pendingAiMsg: Message = {
            id: aiMsgId,
            role: 'assistant',
            content: '',
            timestamp: new Date()
        };
        setMessages(prev => [...prev, pendingAiMsg]);

        try {
            // Submit Job
            const job = await submitJob('AI_CHAT', {
                messages: [...messages, userMsg].map(m => ({ 
                    role: m.role, 
                    content: m.content,
                    images: m.images
                })),
                useSearch: isSearchEnabled,
                useImageGen: isImageGenEnabled,
                configId: selectedConfigId
            });

            // Manually trigger refresh since SSE might not work in dev mode
            refreshServerJobs();

            // Poll for result
            const pollResult = async () => {
                // Use getJob imported at top (need to add import if missing, or use submitJob return if it had logic but it doesn't)
                // Actually need to import getJob.
                const maxAttempts = 120; // 2 minutes max
                console.log('[AIChatModal] Starting poll for job', job.id);
                for (let i = 0; i < maxAttempts; i++) {
                    await new Promise(r => setTimeout(r, 1000));
                    const updatedJob = await getJob(job.id);
                    console.log('[AIChatModal] Poll attempt', i + 1, 'status:', updatedJob?.status);
                    if (!updatedJob) break;
                    
                    if (updatedJob.status === 'COMPLETED' && updatedJob.result) {
                        try {
                            const result = JSON.parse(updatedJob.result);
                            setMessages(prev => prev.map(m => 
                                m.id === aiMsgId 
                                    ? { ...m, content: result.content || '', images: result.images } 
                                    : m
                            ));
                            console.log('[AIChatModal] Job completed, updating message');
                        } catch (e) {
                            console.error('Failed to parse AI result', e);
                        }
                        refreshServerJobs(); // Update job list to stop spinner
                        break;
                    } else if (updatedJob.status === 'FAILED') {
                        setMessages(prev => prev.map(m => 
                            m.id === aiMsgId 
                                ? { ...m, content: 'エラーが発生しました。' } 
                                : m
                        ));
                        refreshServerJobs(); // Update job list to stop spinner
                        break;
                    }
                }
                setIsLoading(false);
            };
            pollResult();

        } catch (error) {
            console.error(error);
            setMessages(prev => prev.map(m => 
                m.id === aiMsgId 
                    ? { ...m, content: 'ジョブの送信に失敗しました。' } 
                    : m
            ));
            setIsLoading(false);
        }
    };

    const handleEndChat = async () => {
        if (isLoading) {
            abortControllerRef.current?.abort();
            setIsLoading(false);
        }
        onClose();
    };

    const handleSaveMemo = async () => {
        if (messages.length === 0) return;
        
        const historyText = messages.map((m: Message) => 
            `**${m.role === 'user' ? 'User' : 'AI'}**: ${m.content}`
        ).join('\n\n');
        
        try {
            await createMemo(`# AI Chat Log (${new Date().toLocaleString()})\n\n${historyText}`);
            setToast({ open: true, message: 'メモに保存しました', severity: 'success' });
        } catch (e) {
            console.error(e);
            setToast({ open: true, message: '保存に失敗しました', severity: 'error' });
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose} // Optional: define behavior if clicking outside (currently closes without saving?) -> maybe strict?
            fullScreen // Use full screen or large for simplified view? User said 'dialog background iranais'. Standard Dialog has backdrop. 
            // Let's use a large dialog but remove the paper background color to make it look cleaner/minimalist if that's the goal.
            // Or just 'fullWidth' and remove header.
            fullWidth
            maxWidth="sm"
            PaperProps={{
                sx: {
                    height: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 3,
                    overflow: 'hidden',
                    bgcolor: 'transparent', // Transparent background
                    boxShadow: 'none',      // No frame/shadow
                    backgroundImage: 'none'
                }
            }}
        >
            {/* Chat Area - No Header */}
            <Box sx={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 2, 
                p: 2,
                overflowY: 'auto'
            }} onClick={handleEndChat}>
                {messages.length === 0 && (
                    <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                        <Typography variant="body2">メッセージを作成して会話を開始してください</Typography>
                    </Box>
                )}

                {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                        <Box 
                            key={msg.id} 
                            sx={{ 
                                display: 'flex', 
                                justifyContent: isUser ? 'flex-end' : 'flex-start',
                                mb: 1
                            }}
                        >
                            {/* Removed Avatars */}
                            <Paper sx={{ 
                                p: 1.5, 
                                maxWidth: '85%', 
                                borderRadius: 3,
                                bgcolor: isUser ? 'primary.main' : 'grey.100', // Cleaner neutral for AI
                                color: isUser ? 'primary.contrastText' : 'text.primary',
                                boxShadow: 0,
                                border: '1px solid',
                                borderColor: isUser ? 'primary.main' : 'grey.200'
                            }} onClick={(e) => e.stopPropagation()}>
                                <Box sx={{ 
                                    '& p': { m: 0, mb: 1, '&:last-child': { mb: 0 } },
                                    '& a': { color: 'inherit', textDecoration: 'underline' },
                                    '& pre': { bg: 'rgba(0,0,0,0.1)', p: 1, borderRadius: 1, overflowX: 'auto' },
                                    '& code': { bg: 'rgba(0,0,0,0.1)', p: 0.5, borderRadius: 0.5, fontFamily: 'monospace' }
                                }}>
                                    {msg.thought && (
                                        <Box sx={{ 
                                            mb: 1.5, 
                                            p: 1.5,
                                            borderRadius: 2,
                                            bgcolor: 'rgba(0,0,0,0.03)',
                                            borderLeft: '3px solid',
                                            borderColor: 'grey.300'
                                        }}>
                                            <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600, color: 'text.secondary' }}>
                                                思考プロセス
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                {msg.thought}
                                            </Typography>
                                        </Box>
                                    )}
                                    <MarkdownDisplay>{msg.content}</MarkdownDisplay>
                                </Box>
                                {msg.images && msg.images.length > 0 && (
                                    <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        {msg.images.map((img, idx) => (
                                            <Box 
                                                key={idx} 
                                                component="img" 
                                                src={img} 
                                                sx={{ height: 100, borderRadius: 1 }} 
                                            />
                                        ))}
                                    </Box>
                                )}
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 0.5, opacity: 0.7 }}>
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                        {msg.usage && (
                                            <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
                                                {`In: ${msg.usage.promptTokens} / Out: ${msg.usage.responseTokens}`}
                                            </Typography>
                                        )}
                                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        </Box>
                    );
                })}
                {isLoading && (
                     <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }}>
                        <Paper sx={{ p: 1.5, borderRadius: 3, bgcolor: 'grey.100', boxShadow: 0 }}>
                            <Typography variant="body2" color="text.secondary">...</Typography>
                        </Paper>
                    </Box>
                )}
                <div ref={messagesEndRef} />
            </Box>

            {/* Bottom Bar - Floating Actions */}
            <Box sx={{ p: 2, display: 'flex', gap: 2 }} onClick={handleEndChat}>
                <Button 
                    variant="outlined" 
                    color="inherit" 
                    fullWidth 
                    onClick={(e) => { e.stopPropagation(); handleSaveMemo(); }}
                    disabled={messages.length === 0}
                >
                    メモに保存
                </Button>
                <Button 
                    variant="outlined" 
                    color="error" 
                    fullWidth 
                    onClick={(e) => { e.stopPropagation(); handleEndChat(); }}
                >
                    終了
                </Button>
                <Button 
                    variant="contained" 
                    color="primary" 
                    fullWidth 
                    startIcon={<SendIcon />} 
                    onClick={(e) => { e.stopPropagation(); setIsComposeOpen(true); }}
                    disabled={isLoading}
                >
                    作成
                </Button>
            </Box>

            {/* Compose Modal */}
            <Dialog 
                open={isComposeOpen} 
                onClose={() => setIsComposeOpen(false)} 
                fullWidth 
                maxWidth="sm"
                PaperProps={{
                    sx: { position: 'absolute', bottom: 0, m: 0, width: '100%', borderRadius: '16px 16px 0 0' }
                }}
            >
                <DialogContent sx={{ p: 3, pt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                        <Box sx={{ width: 40, height: 4, bgcolor: 'grey.300', borderRadius: 2 }} />
                    </Box>
                    
                    {/* Model & Settings Row */}
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
                        {configs.length > 0 && (
                            <FormControl size="small" sx={{ minWidth: 140 }}>
                                <Select
                                    value={selectedConfigId}
                                    onChange={(e) => setSelectedConfigId(e.target.value)}
                                    displayEmpty
                                    variant="outlined"
                                >
                                    {configs.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                                </Select>
                            </FormControl>
                        )}
                        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                            <Tooltip title={isSearchEnabled ? "検索: ON" : "検索: OFF"}>
                                <IconButton 
                                    onClick={() => setIsSearchEnabled(!isSearchEnabled)} 
                                    color={isSearchEnabled ? "info" : "default"}
                                    size="small"
                                >
                                    {isSearchEnabled ? <GlobeIcon /> : <GlobeOffIcon />}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={isImageGenEnabled ? "画像生成: ON" : "画像生成: OFF"}>
                                <IconButton 
                                    onClick={() => setIsImageGenEnabled(!isImageGenEnabled)} 
                                    color={isImageGenEnabled ? "secondary" : "default"}
                                    size="small"
                                >
                                    <PaletteIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Box>
                    
                    {/* Attachments */}
                    {attachments.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 1, mb: 1, overflowX: 'auto', pb: 1 }}>
                            {attachments.map((att, idx) => (
                                <Box key={idx} sx={{ position: 'relative', flexShrink: 0 }}>
                                     <Box 
                                        component="img" 
                                        src={att.preview} 
                                        sx={{ width: 60, height: 60, borderRadius: 1, objectFit: 'cover', border: '1px solid #ddd' }} 
                                    />
                                    <IconButton 
                                        size="small" 
                                        onClick={() => removeAttachment(idx)}
                                        sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper', boxShadow: 1 }}
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            ))}
                        </Box>
                    )}

                    {/* Input */}
                    <TextField
                        fullWidth
                        placeholder="メッセージを入力..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        multiline
                        minRows={3}
                        maxRows={8}
                        autoFocus
                    />
                    
                    {/* Actions */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, alignItems: 'center' }}>
                         <Box>
                            <input
                                type="file"
                                hidden
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                            />
                            <IconButton onClick={() => fileInputRef.current?.click()} color="primary">
                                <ImageIcon />
                            </IconButton>
                        </Box>
                        <Button 
                            variant="contained" 
                            onClick={handleSend}
                            disabled={!input.trim() && attachments.length === 0}
                            endIcon={<SendIcon />}
                        >
                            送信
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>
            {/* Toast Notification */}
            <Snackbar
                open={toast.open}
                autoHideDuration={6000}
                onClose={() => setToast({ ...toast, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setToast({ ...toast, open: false })} severity={toast.severity} sx={{ width: '100%' }}>
                    {toast.message}
                </Alert>
            </Snackbar>
        </Dialog>
    );
}
