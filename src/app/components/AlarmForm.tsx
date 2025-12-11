'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Delete as DeleteIcon, ChevronLeft as ChevronLeftIcon } from '@mui/icons-material';
import { Box, Button, TextField, Typography, Paper, Stack, IconButton, Container } from '@mui/material';
import { format } from 'date-fns';

interface AlarmFormProps {
    alarmId?: string;
    initialValues?: any;
    initialTime?: string;
    onSuccess?: () => void;
    isModal?: boolean;
    initialDate?: Date;
}

export default function AlarmForm({ alarmId, initialValues, initialTime, onSuccess, isModal = false, initialDate }: AlarmFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [time, setTime] = useState('');
    const [comment, setComment] = useState('');

    useEffect(() => {
        if (initialValues) {
             const alarm = initialValues;
             setTitle(alarm.title);
             setComment(alarm.memo || alarm.comment || '');
             if (alarm.startTime || alarm.time) {
                 const t = alarm.startTime || alarm.time;
                 setTime(format(new Date(t), "yyyy-MM-dd'T'HH:mm"));
             }
        } else if (initialTime) {
            const d = new Date(initialTime);
             if (!isNaN(d.getTime())) {
                   const formatLocal = (date: Date) => {
                       const pad = (n: number) => n < 10 ? '0'+n : n;
                       return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
                   };
                   setTime(formatLocal(d));
            }
        } else {
             // Default logic
             const now = new Date();
             const targetDate = initialDate || now;
             
             const isToday = targetDate.getDate() === now.getDate() && 
                             targetDate.getMonth() === now.getMonth() && 
                             targetDate.getFullYear() === now.getFullYear();
 
             let defaultTime: Date;
 
             if (isToday) {
                  // Next hour from NOW
                  defaultTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
             } else {
                  // 00:00 of targetDate
                  defaultTime = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
             }
 
             const formatLocal = (d: Date) => {
                 const pad = (n: number) => n < 10 ? '0'+n : n;
                 return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
             };
             setTime(formatLocal(defaultTime));
        }
    }, [initialValues, initialTime, initialDate]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { createAlarm, updateAlarm } = await import('@/lib/alarm-actions');
            
            if (alarmId) {
                await updateAlarm(alarmId, {
                        title: title,
                        comment: comment,
                        time: time
                });
            } else {
                await createAlarm({
                    title: title,
                    comment: comment,
                    time: time
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
        if (!alarmId) return;
        if (!confirm('Are you sure you want to delete this alarm?')) return;
        setLoading(true);
        try {
             const { deleteAlarm } = await import('@/lib/alarm-actions');
             await deleteAlarm(alarmId);
             
             if (onSuccess) onSuccess();
             else {
                 router.push('/');
                 router.refresh();
             }
        } catch(e) {
            console.error(e);
            alert('Error deleting alarm');
        } finally {
            setLoading(false);
        }
    };

    const content = (
        <Box component="form" onSubmit={handleSubmit} sx={{ p: isModal ? 2 : 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {!isModal && (
                <Box sx={{ pb: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                    <IconButton onClick={() => onSuccess ? onSuccess() : router.push('/')}>
                        <ChevronLeftIcon />
                    </IconButton>
                    <Typography variant="h6" fontWeight="bold" sx={{ ml: 1 }}>{alarmId ? 'Edit Alarm' : 'New Alarm'}</Typography>
                </Box>
            )}

            <Typography variant="h6" fontWeight="bold" align="center">
                {alarmId ? 'Edit Alarm' : 'New Alarm'}
            </Typography>
            
            <TextField 
                label="Title" 
                name="title" 
                required 
                fullWidth 
                variant="outlined" 
                value={title}
                onChange={e => setTitle(e.target.value)}
            />

            <TextField
                label="Time"
                name="time"
                type="datetime-local"
                required
                value={time}
                onChange={e => setTime(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
            />
            
            <TextField
                label="Comment"
                name="comment"
                multiline
                rows={4}
                fullWidth
                value={comment}
                onChange={e => setComment(e.target.value)}
            />

            <Stack direction="column" spacing={2} mt={2}>
                <Button 
                    type="submit" 
                    variant="contained" 
                    disabled={loading}
                    size="large"
                    sx={{ py: 1.5, fontWeight: 'bold', bgcolor: '#FF4500', '&:hover': { bgcolor: '#CC3700' } }}
                >
                    {alarmId ? (loading ? 'Updating...' : 'Update Alarm') : (loading ? 'Creating...' : 'Create Alarm')}
                </Button>
                
                {alarmId && (
                    <Button 
                        type="button" 
                        variant="outlined" 
                        color="error"
                        onClick={handleDelete}
                        disabled={loading}
                        startIcon={<DeleteIcon />}
                        sx={{ py: 1.5, fontWeight: 'bold' }}
                    >
                        Delete Alarm
                    </Button>
                )}
            </Stack>
        </Box>
    );

    if (isModal) return content;

    return (
        <Container maxWidth="sm" sx={{ py: 2 }}>
           <Paper sx={{ p: 0, overflow: 'hidden', borderRadius: 4 }}>
               {content}
           </Paper>
        </Container>
    );
}
