'use client';

import { useState, useRef, useEffect } from 'react';
import { 
    Dialog, DialogContent, Box, Typography, IconButton, 
    TextField, Button, Paper, Avatar, Tooltip 
} from '@mui/material';
import { 
    Close as CloseIcon, 
    Send as SendIcon, 
    SmartToy as BotIcon, 
    Person as UserIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import { createMemo } from '@/app/memos/actions';
import { useRouter } from 'next/navigation';
import { chatWithAI } from '@/lib/ai-actions';


interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface AIChatModalProps {
    open: boolean;
    onClose: () => void;
}

export default function AIChatModal({ open, onClose }: AIChatModalProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'init',
            role: 'assistant',
            content: 'こんにちは！AIアシスタントです。何かお手伝いできることはありますか？',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (open) {
            scrollToBottom();
        }
    }, [messages, open]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            // Call Server Action
            const aiResponse = await chatWithAI([...messages, userMsg].map(m => ({ 
                role: m.role as 'user'|'assistant', 
                content: m.content 
            })));

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: aiResponse.content,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error(error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'エラーが発生しました。時間を置いて再試行してください。',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }

    };

    const handleSaveToMemo = async () => {
        if (messages.length === 0) return;

        const confirmSave = confirm('チャットの内容をメモに保存して終了しますか？');
        if (!confirmSave) return;

        try {
            // Format chat history
            const content = messages.map(m => 
                `**${m.role === 'user' ? 'User' : 'AI'}**: ${m.content}`
            ).join('\n\n');

            const title = `AI Chat Log ${new Date().toLocaleString()}`;
            const memoContent = `# ${title}\n\n${content}`;

            await createMemo(memoContent);
            onClose();
            // Optional: Redirect to memos or show success
            // router.push('/memos'); 
        } catch (e) {
            console.error('Failed to save memo', e);
            alert('メモの保存に失敗しました');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            PaperProps={{
                sx: {
                    height: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 3,
                    overflow: 'hidden'
                }
            }}
        >
            {/* Header */}
            <Box sx={{ 
                p: 2, 
                borderBottom: 1, 
                borderColor: 'divider', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                bgcolor: 'background.paper',
                zIndex: 1
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ bgcolor: 'error.main', width: 32, height: 32 }}>
                        <BotIcon fontSize="small" />
                    </Avatar>
                    <Typography variant="h6" fontWeight="bold">
                        AI Assistant
                    </Typography>
                </Box>
                <Box>
                    <Tooltip title="Save to Memo">
                        <IconButton onClick={handleSaveToMemo} color="primary" disabled={messages.length <= 1}>
                            <SaveIcon />
                        </IconButton>
                    </Tooltip>
                    <IconButton onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>
            </Box>

            {/* Chat Area */}
            <DialogContent sx={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 2, 
                p: 2,
                bgcolor: '#f5f5f5'
            }}>
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
                            {!isUser && (
                                <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'error.main' }}>
                                    <BotIcon fontSize="small" />
                                </Avatar>
                            )}
                            <Paper sx={{ 
                                p: 1.5, 
                                maxWidth: '75%', 
                                borderRadius: 2,
                                bgcolor: isUser ? 'primary.main' : 'background.paper',
                                color: isUser ? 'primary.contrastText' : 'text.primary',
                                borderTopRightRadius: isUser ? 0 : 2,
                                borderTopLeftRadius: !isUser ? 0 : 2
                            }}>
                                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {msg.content}
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5, opacity: 0.7, fontSize: '0.7rem' }}>
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                            </Paper>
                            {isUser && (
                                <Avatar sx={{ width: 32, height: 32, ml: 1, bgcolor: 'secondary.main' }}>
                                    <UserIcon fontSize="small" />
                                </Avatar>
                            )}
                        </Box>
                    );
                })}
                {isLoading && (
                     <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }}>
                        <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'error.main' }}>
                            <BotIcon fontSize="small" />
                        </Avatar>
                        <Paper sx={{ p: 1.5, borderRadius: 2, borderTopLeftRadius: 0 }}>
                            <Typography variant="body2" color="text.secondary">入力中...</Typography>
                        </Paper>
                    </Box>
                )}
                <div ref={messagesEndRef} />
            </DialogContent>

            {/* Input Area */}
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        fullWidth
                        placeholder="メッセージを入力..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        multiline
                        maxRows={4}
                        size="small"
                        disabled={isLoading}
                    />
                    <IconButton 
                        color="primary" 
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        sx={{ alignSelf: 'flex-end' }}
                    >
                        <SendIcon />
                    </IconButton>
                </Box>
            </Box>
        </Dialog>
    );
}
