'use client';

import { useState, useRef, useEffect } from 'react';
import { 
    Dialog, DialogContent, Box, Typography, IconButton, 
    TextField, Button, Paper, Avatar, Tooltip, Select, MenuItem, FormControl,
    Accordion, AccordionSummary, AccordionDetails
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


interface Message {
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
}

export default function AIChatModal({ open, onClose }: AIChatModalProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSearchEnabled, setIsSearchEnabled] = useState(false);
    const [isImageGenEnabled, setIsImageGenEnabled] = useState(false);
    const [attachments, setAttachments] = useState<{ file: File; preview: string }[]>([]);
    
    // AI Configs
    const [configs, setConfigs] = useState<{id: string, name: string}[]>([]);
    const [selectedConfigId, setSelectedConfigId] = useState<string>('');

    // Compose Modal State
    const [isComposeOpen, setIsComposeOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (open) {
            getAIConfigs().then(data => {
                setConfigs(data as any);
                if (data.length > 0 && !selectedConfigId) {
                    setSelectedConfigId(data[0].id);
                }
            });
            scrollToBottom();
        }
    }, [messages, open]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setAttachments(prev => [...prev, { file, preview: reader.result as string }]);
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

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            // Initial placeholder for AI message
            const aiMsgId = (Date.now() + 1).toString();
            const initialAiMsg: Message = {
                id: aiMsgId,
                role: 'assistant',
                content: '',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, initialAiMsg]);

            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMsg].map(m => ({ 
                        role: m.role as 'user'|'assistant', 
                        content: m.content,
                        images: m.images
                    })),
                    useSearch: isSearchEnabled,
                    useImageGen: isImageGenEnabled,
                    configId: selectedConfigId
                }),
                signal: controller.signal
            });

            if (!response.ok) throw new Error(response.statusText);
            
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No reader');

            const decoder = new TextDecoder();
            let buffer = '';
            
            let currentContent = '';
            let currentThought = '';
            let currentImages: string[] = [];
            let currentUsage: Message['usage'] | undefined = undefined;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        
                        if (data.type === 'text') {
                            currentContent += data.content;
                        } else if (data.type === 'thought') {
                            // Accumulate thought, add newline if needed? 
                            // API usually sends fragments.
                            currentContent = currentContent; // no-op
                            currentThought += data.content;
                        } else if (data.type === 'image') {
                            currentImages.push(data.content);
                        } else if (data.type === 'usage') {
                            currentUsage = data.usage;
                        }

                        // Update state
                        setMessages(prev => prev.map(m => 
                            m.id === aiMsgId 
                                ? { 
                                    ...m, 
                                    content: currentContent, 
                                    thought: currentThought || undefined,
                                    images: currentImages.length > 0 ? [...currentImages] : undefined,
                                    usage: currentUsage
                                  } 
                                : m
                        ));
                    } catch (e) {
                        console.error('JSON Parse Error', e);
                    }
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted');
                // Optional: Indicate interruption in UI? 
                // Currently just stops updating, which is fine.
            } else {
                console.error(error);
                const errorMsg: Message = {
                    id: (Date.now() + 2).toString(),
                    role: 'assistant',
                    content: '通信エラーが発生しました。',
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, errorMsg]);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }

    };

    const handleEndChat = async () => {
        if (isLoading) {
            if (!confirm('回答の生成中です。チャットを終了しますか？')) {
                return;
            }
            // Abort the running request
            abortControllerRef.current?.abort();
        }

        if (messages.length === 0) {
            onClose();
            return;
        }

        try {
            // Format chat history
            const content = messages.map(m => 
                `**${m.role === 'user' ? 'User' : 'AI'}**: ${m.content}`
            ).join('\n\n');

            const title = `AI Chat Log ${new Date().toLocaleString()}`;
            const memoContent = `# ${title}\n\n${content}`;

            await createMemo(memoContent);
            onClose();
        } catch (e) {
            console.error('Failed to save memo', e);
            alert('メモの保存に失敗しました');
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
                    color="error" 
                    fullWidth 
                    onClick={(e) => { e.stopPropagation(); handleEndChat(); }}
                >
                    チャット終了
                </Button>
                <Button 
                    variant="contained" 
                    color="primary" 
                    fullWidth 
                    startIcon={<SendIcon />} 
                    onClick={(e) => { e.stopPropagation(); setIsComposeOpen(true); }}
                    disabled={isLoading}
                >
                    メッセージ作成
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
        </Dialog>
    );
}
