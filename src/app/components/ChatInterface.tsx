'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, AutoAwesome, Close } from '@mui/icons-material'; // Sparkles -> AutoAwesome
import { Box, Typography, IconButton, TextField, Paper, CircularProgress } from '@mui/material';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatInterface({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: 'How can I help you manage your tasks today?' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ message: userMsg })
        });
        const data = await res.json();
        
        if (data.response) {
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        }
        
        if (data.suggestedTask) {
             await createSuggestedTask(data.suggestedTask);
             setMessages(prev => [...prev, { role: 'assistant', content: `Created task: ${data.suggestedTask.title}` }]);
        }
    } catch (e) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
    } finally {
        setLoading(false);
    }
  };
  
  const createSuggestedTask = async (task: any) => {
      await fetch('/api/tasks', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(task)
      });
      window.location.reload(); 
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesome color="primary" />
                <Typography variant="subtitle1" fontWeight="bold">AI Assistant</Typography>
            </Box>
            <IconButton onClick={onClose}><Close /></IconButton>
        </Box>
        
        {/* Messages */}
        <Box sx={{ flex: 1, p: 2, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {messages.map((m, i) => (
                <Paper 
                    key={i} 
                    sx={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        bgcolor: m.role === 'user' ? 'primary.main' : 'grey.100',
                        color: m.role === 'user' ? 'white' : 'text.primary',
                        p: 2,
                        borderRadius: 2,
                        maxWidth: '80%',
                    }}
                >
                    <Typography variant="body2">{m.content}</Typography>
                </Paper>
            ))}
            {loading && (
                <Box sx={{ alignSelf: 'flex-start', p: 1 }}>
                    <CircularProgress size={20} />
                </Box>
            )}
            <div ref={bottomRef} />
        </Box>
        
        {/* Input */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
            <TextField 
                fullWidth
                variant="outlined"
                placeholder="Type to create task..."
                size="small"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                sx={{ borderRadius: 4, '& .MuiOutlinedInput-root': { borderRadius: 4 } }}
            />
            <IconButton 
                onClick={sendMessage} 
                disabled={loading}
                color="primary"
                sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}
            >
                <Send />
            </IconButton>
        </Box>
    </Box>
  );
}
