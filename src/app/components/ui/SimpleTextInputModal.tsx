
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, TextField, Button, Typography, Box, useTheme } from '@mui/material';
import { GuideBubble } from './GuideBubble';

interface SimpleTextInputModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (text: string) => void;
    title?: string;
    placeholder?: string;
    initialValue?: string;
    guideMessage?: string;
    accentColor?: string;
}

export default function SimpleTextInputModal({ 
    open, 
    onClose, 
    onConfirm, 
    title = 'タイトルを入力', 
    placeholder = 'タイトル',
    initialValue = '',
    guideMessage,
    accentColor
}: SimpleTextInputModalProps) {
    const [text, setText] = useState(initialValue);
    const inputRef = useRef<HTMLInputElement>(null);
    const theme = useTheme();
    const mainColor = accentColor || theme.palette.primary.main;

    useEffect(() => {
        if (open) {
            setText(initialValue);
            // Focus on open
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [open, initialValue]);

    const handleConfirm = () => {
        onConfirm(text);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirm();
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            fullWidth
            maxWidth="xs"
            PaperProps={{ sx: { borderRadius: 3, p: 2, overflow: 'visible' } }}
        >
             {guideMessage && <GuideBubble message={guideMessage} />}
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h6" align="center">{title}</Typography>
                
                <TextField
                    inputRef={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={placeholder}
                    fullWidth
                    autoFocus
                    onKeyDown={handleKeyDown}
                    variant="outlined"
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            '&.Mui-focused fieldset': {
                                borderColor: mainColor,
                            },
                        },
                    }}
                />

                <Button 
                    variant="contained" 
                    fullWidth 
                    onClick={handleConfirm} 
                    size="large"
                    sx={{
                        bgcolor: mainColor,
                        '&:hover': {
                            bgcolor: mainColor, // Maybe darken slightly? But for now keep simple.
                            opacity: 0.9,
                        }
                    }}
                >
                    作成
                </Button>
            </DialogContent>
        </Dialog>
    );
}
