'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft as ChevronLeftIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { Box, Button, TextField, Typography, Paper, Stack, IconButton, Container } from '@mui/material';
import { format } from 'date-fns';
import BulkEventCreator from './BulkEventCreator';

interface EventFormProps {
    eventId?: string;
    initialValues?: any;
    initialStartTime?: string;
    onSuccess?: () => void;
    isModal?: boolean;
    initialDate?: Date;
}

export default function EventForm({ eventId, initialValues, initialStartTime, onSuccess, isModal = false, initialDate }: EventFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [memo, setMemo] = useState('');
    const [initialDuration, setInitialDuration] = useState<number | null>(null);

    useEffect(() => {
        if (initialValues) {
             const event = initialValues;
             setTitle(event.title);
             setMemo(event.memo || '');
             if (event.startTime) {
                 setStartTime(format(new Date(event.startTime), "yyyy-MM-dd'T'HH:mm"));
             }
             if (event.endTime) {
                 setEndTime(format(new Date(event.endTime), "yyyy-MM-dd'T'HH:mm"));
             }
        } else if (initialStartTime) {
            const d = new Date(initialStartTime);
            if (!isNaN(d.getTime())) {
                   const formatLocal = (date: Date) => {
                       const pad = (n: number) => n < 10 ? '0'+n : n;
                       return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
                   };
                   setStartTime(formatLocal(d));
                   const endD = new Date(d.getTime() + 60 * 60 * 1000); // 1 hour default
                   setEndTime(formatLocal(endD));
                   setInitialDuration(60 * 60 * 1000);
            }
        } else {
            // Default logic
            // Check if initialDate is "today"
            const now = new Date();
            const targetDate = initialDate || now;
            
            const isToday = targetDate.getDate() === now.getDate() && 
                            targetDate.getMonth() === now.getMonth() && 
                            targetDate.getFullYear() === now.getFullYear();

            let startD: Date;
            let endD: Date;

            if (isToday) {
                 // Next hour from NOW
                 const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
                 startD = nextHour;
                 endD = new Date(nextHour.getTime() + 60 * 60 * 1000);
            } else {
                 // 00:00 - 01:00 of targetDate
                 startD = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
                 endD = new Date(startD.getTime() + 60 * 60 * 1000);
            }

            const formatLocal = (d: Date) => {
                const pad = (n: number) => n < 10 ? '0'+n : n;
                return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            };
            setStartTime(formatLocal(startD));
            setEndTime(formatLocal(endD));
            setInitialDuration(60 * 60 * 1000); 
        }
    }, [initialValues, initialStartTime, initialDate]);

    const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newStart = e.target.value;

        if (startTime && endTime) {
            const currentStart = new Date(startTime);
            const currentEnd = new Date(endTime);
            const newStartDate = new Date(newStart);

            if (!isNaN(currentStart.getTime()) && !isNaN(currentEnd.getTime()) && !isNaN(newStartDate.getTime())) {
                if (newStartDate.getTime() > currentEnd.getTime()) {
                    const duration = initialDuration ?? (currentEnd.getTime() - currentStart.getTime());
                    const newEndDate = new Date(newStartDate.getTime() + duration);
                    setEndTime(format(newEndDate, "yyyy-MM-dd'T'HH:mm"));
                }
            }
        }
        
        setStartTime(newStart);
    };

    const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newEnd = e.target.value;
        if (startTime && newEnd < startTime) {
            alert("End time cannot be earlier than Start time");
            return;
        }
        setEndTime(newEnd);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { createGoogleEvent, updateGoogleEvent } = await import('@/lib/calendar-actions');
            
            if (eventId) {
                await updateGoogleEvent(eventId, {
                        title: title,
                        memo: memo,
                        startTime: startTime,
                        endTime: endTime
                });
            } else {
                await createGoogleEvent({
                    title: title,
                    memo: memo,
                    startTime: startTime,
                    endTime: endTime
                });
            }
            
            if (onSuccess) onSuccess();
            else {
                router.push('/');
                router.refresh();
            }

        } catch (error) {
            console.error(error);
            alert('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!eventId) return;
        if (!confirm('Are you sure you want to delete this event?')) return;
        setLoading(true);
        try {
             const { deleteGoogleEvent } = await import('@/lib/calendar-actions');
             await deleteGoogleEvent(eventId);
             
             if (onSuccess) onSuccess();
             else {
                 router.push('/');
                 router.refresh();
             }
        } catch(e) {
            console.error(e);
            alert('Error deleting event');
        } finally {
            setLoading(false);
        }
    };

    const [isBulkMode, setIsBulkMode] = useState(false);
    
    // ... existing useEffect ...

    // Dynamic import to avoid SSR issues if complex, but here standard import is fine usually.
    // However, for cleaner code structure inside component:
    
    if (isBulkMode) {
        return (
            <BulkEventCreator 
                onBack={() => setIsBulkMode(false)}
                onSuccess={() => onSuccess ? onSuccess() : router.back()}
            />
        );
    }

    const content = (
        <Box component="form" onSubmit={handleSubmit} sx={{ p: isModal ? 2 : 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {!isModal && (
                <Box sx={{ pb: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                    <IconButton onClick={() => onSuccess ? onSuccess() : router.push('/')}>
                        <ChevronLeftIcon />
                    </IconButton>
                    <Typography variant="h6" fontWeight="bold" sx={{ ml: 1 }}>{eventId ? 'Edit Event' : 'New Event'}</Typography>
                </Box>
            )}

            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: -1 }}>
                <Typography variant="h6" fontWeight="bold">
                    {eventId ? 'Edit Event' : 'New Event'}
                </Typography>
                {!eventId && (
                    <Button 
                        size="small" 
                        variant="outlined" 
                        onClick={() => setIsBulkMode(true)}
                        sx={{ position: 'absolute', right: 0 }}
                    >
                        Bulk Create
                    </Button>
                )}
            </Box>
            
            <TextField 
                label="Title" 
                name="title" 
                required 
                fullWidth 
                variant="outlined" 
                value={title}
                onChange={e => setTitle(e.target.value)}
            />

            <Box>
                <Stack spacing={2} direction="column">
                    <TextField
                        label="Start Time"
                        name="startTime"
                        type="datetime-local"
                        required
                        value={startTime}
                        onChange={handleStartTimeChange}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                        label="End Time"
                        name="endTime"
                        type="datetime-local"
                        required
                        value={endTime}
                        onChange={handleEndTimeChange}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                    />
                </Stack>
                
                {(() => {
                    if (!startTime || !endTime) return null;
                    const start = new Date(startTime);
                    const end = new Date(endTime);
                    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;

                    const diffMs = end.getTime() - start.getTime();
                    const diffMins = Math.floor(diffMs / (1000 * 60));
                    
                    let durationStr = '';
                    if (diffMins < 60) {
                        durationStr = `${diffMins}分`;
                    } else if (diffMins < 24 * 60) {
                        const h = Math.floor(diffMins / 60);
                        const m = diffMins % 60;
                        durationStr = m > 0 ? `${h}時間${m}分` : `${h}時間`;
                    } else {
                        const d = Math.floor(diffMins / (24 * 60));
                        const rem = diffMins % (24 * 60);
                        const h = Math.floor(rem / 60);
                        const m = rem % 60;
                        durationStr = `${d}日${h}時間${m}分`;
                    }
                    
                    // Format start time as M月d日(ddd) H:mm
                const days = ['日', '月', '火', '水', '木', '金', '土'];
                const dayStr = `${start.getMonth() + 1}月${start.getDate()}日(${days[start.getDay()]})`;
                const timeStr = `${start.getHours()}:${start.getMinutes().toString().padStart(2, '0')}`;
                
                return (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {`${dayStr} ${timeStr} から ${durationStr}`}
                    </Typography>
                );
                })()}
            </Box>
            
            <TextField
                label="Memo"
                name="memo"
                multiline
                rows={4}
                fullWidth
                value={memo}
                onChange={e => setMemo(e.target.value)}
            />

            <Stack direction="column" spacing={2} mt={2}>
                <Button 
                    type="submit" 
                    variant="contained" 
                    disabled={loading}
                    size="large"
                    sx={{ py: 1.5, fontWeight: 'bold' }}
                >
                    {eventId ? (loading ? 'Updating...' : 'Update Event') : (loading ? 'Creating...' : 'Create Event')}
                </Button>
                
                {eventId && (
                    <Button 
                        type="button" 
                        variant="outlined" 
                        color="error"
                        onClick={handleDelete}
                        disabled={loading}
                        startIcon={<DeleteIcon />}
                        sx={{ py: 1.5, fontWeight: 'bold' }}
                    >
                        Delete Event
                    </Button>
                )}
            </Stack>
        </Box>
    );

    // If Modal, just return content (which might be BulkCreator returned early above)
    // Note: The early return for isBulkMode handles the view switching.
    if (isModal) return content;

    return (
        <Container maxWidth="sm" sx={{ py: 2 }}>
           <Paper sx={{ p: 0, overflow: 'hidden', borderRadius: 4 }}>
               {content}
           </Paper>
        </Container>
    );
}
