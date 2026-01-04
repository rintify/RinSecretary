'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, Box, Typography, LinearProgress, Button } from '@mui/material';
import { AutoAwesome as AiIcon, Error as ErrorIcon } from '@mui/icons-material';

interface GenerationProgressModalProps {
    open: boolean;
    step: string; // "Fetching..." etc.
    error?: string | null;
    onClose?: () => void;
}

export default function GenerationProgressModal({ open, step, error, onClose }: GenerationProgressModalProps) {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        if (!open || error) {
            if (!open) setSeconds(0);
            return;
        }

        const timer = setInterval(() => {
            setSeconds(s => s + 1);
        }, 1000);

        return () => {
            clearInterval(timer);
        };
    }, [open, error]);

    const isError = !!error;

    return (
        <Dialog 
            open={open} 
            maxWidth="xs" 
            fullWidth 
            PaperProps={{
                sx: { 
                    borderRadius: 3,
                    textAlign: 'center',
                    p: 2,
                    borderTop: isError ? '4px solid #d32f2f' : 'none'
                }
            }}
        >
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                   {isError ? (
                       <ErrorIcon sx={{ fontSize: 48, color: 'error.main' }} />
                   ) : (
                       <AiIcon sx={{ fontSize: 48, color: 'primary.main', animation: 'pulse 2s infinite' }} />
                   )}
                </Box>
                
                <Box sx={{ width: '100%' }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom color={isError ? 'error.main' : 'text.primary'}>
                        {isError ? "エラーが発生しました" : step}
                    </Typography>
                    
                    {isError && (
                         <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                            {error}
                         </Typography>
                    )}
                </Box>

                {!isError && (
                    <Box sx={{ width: '100%', mt: 2 }}>
                        <LinearProgress sx={{ height: 8, borderRadius: 4 }} />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            {seconds}秒経過
                        </Typography>
                    </Box>
                )}

                {isError && onClose && (
                    <Button variant="outlined" color="error" onClick={onClose} sx={{ mt: 2 }}>
                        閉じる
                    </Button>
                )}
            </DialogContent>
            
            <style jsx global>{`
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.2); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </Dialog>
    );
}
