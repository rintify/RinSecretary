'use client';

import React, { useEffect } from 'react';
import { 
    Dialog, DialogContent, DialogTitle, IconButton, 
    Typography, Box, Button, useMediaQuery, useTheme, Stack
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MailSummaryCardView from './MailSummaryCardView';
import { markMailSummariesAsRead } from '@/lib/mail-scheduler-actions';

interface MailSummaryResultModalProps {
    open: boolean;
    onClose: () => void;
    summaries: any[]; // The unread or newly generated summaries
    title?: string;
    // When manually generating, we might pass a limited set. 
    // When auto-opening on dashboard, we pass fetched unread summaries.
}

export default function MailSummaryResultModal({ 
    open, onClose, summaries, title = "新着メール要約" 
}: MailSummaryResultModalProps) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

    // When modal closes, we mark them as read in the background (fire and forget or wait?)
    // User expects to see them as read next time.
    // The "onClose" handler in parent should probably trigger the mark-as-read or we do it here.
    // Doing it here is cleaner for reuse.
    
    const handleClose = async () => {
        // Collect IDs to mark as read
        const ids = summaries.map(s => s.id);
        if (ids.length > 0) {
            try {
                await markMailSummariesAsRead(ids);
            } catch (e) {
                console.error("Failed to mark summaries as read", e);
            }
        }
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            fullScreen={fullScreen}
            maxWidth="md"
            fullWidth
            scroll="paper"
        >
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" component="span">{title}</Typography>
                <IconButton
                    aria-label="close"
                    onClick={handleClose}
                    sx={{ color: (theme) => theme.palette.grey[500] }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ bgcolor: '#f5f5f5', p: { xs: 1, sm: 2 } }}>
                {summaries.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">表示する要約はありません</Typography>
                    </Box>
                ) : (
                    <Stack spacing={2}>
                        {summaries.map(card => (
                            <MailSummaryCardView 
                                key={card.id} 
                                card={card} 
                                // In this view (result modal), we might not allow regeneration or blocking immediately
                                // OR we can pass dummy handlers if we don't want those actions here.
                                // But having them is nice. Let's leave them optional/undefined for now.
                            />
                        ))}
                    </Stack>
                )}
            </DialogContent>
        </Dialog>
    );
}
