'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Delete as DeleteIcon, ChevronLeft as ChevronLeftIcon, AccessTime as AccessTimeIcon } from '@mui/icons-material';
import { Box, Button, TextField, Typography, Paper, Stack, IconButton, Container } from '@mui/material';
import { format, subDays } from 'date-fns';
import { ALARM_COLOR } from '../utils/colors';
import { ja } from 'date-fns/locale';
import CustomDatePicker from './ui/CustomDatePicker';
import CustomTimePicker from './ui/CustomTimePicker';

interface AlarmFormProps {
    alarmId?: string;
    initialValues?: any;
    initialTime?: string;
    onSuccess?: (date?: Date) => void;
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

    // Picker State
    const [pickerConfig, setPickerConfig] = useState<{ type: 'date' | 'time' } | null>(null);

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

    // Helpers
    const getDisplayDate = (isoString: string) => {
        if (!isoString) return new Date();
        const d = new Date(isoString);
        if (d.getHours() < 4) {
            return subDays(d, 1);
        }
        return d;
    };

    const getDisplayTimeStr = (isoString: string) => {
        if (!isoString) return '00:00';
        const d = new Date(isoString);
        let h = d.getHours();
        const m = d.getMinutes();
        if (h < 4) h += 24;
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    const handleDateSelect = (newDate: Date) => {
        // Calculate current "Display Time" minutes
        const d = time ? new Date(time) : new Date();
        let h = d.getHours();
        const m = d.getMinutes();
        if (h < 4) h += 24;
        const totalMinutes = h * 60 + m;

        const base = new Date(newDate);
        base.setHours(0, 0, 0, 0);
        const finalText = new Date(base.getTime() + totalMinutes * 60 * 1000);
        
        const formatLocal = (date: Date) => {
             const pad = (n: number) => n < 10 ? '0'+n : n;
             return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };
        setTime(formatLocal(finalText));
        setPickerConfig(null);
    };

    const handleTimeSelect = (newDate: Date) => {
        const formatLocal = (date: Date) => {
             const pad = (n: number) => n < 10 ? '0'+n : n;
             return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };
        setTime(formatLocal(newDate));
        setPickerConfig(null);
    };

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
            
            if (onSuccess) onSuccess(getDisplayDate(time));
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
        <Box component="form" onSubmit={handleSubmit} sx={{ p: isModal ? 2 : 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {!isModal && (
                <Box sx={{ pb: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                    <IconButton onClick={() => onSuccess ? onSuccess() : router.push('/')}>
                        <ChevronLeftIcon />
                    </IconButton>
                    <Typography variant="h6" fontWeight="bold" sx={{ ml: 1 }}>{alarmId ? 'Edit Alarm' : 'New Alarm'}</Typography>
                </Box>
            )}

            <Typography variant="h6" fontWeight="bold" align="left">
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
                size="small"
            />

            <Box>
                 <Typography variant="caption" color="text.secondary">Time</Typography>
                 <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body1" sx={{ mr: 1 }}>
                        {`${format(getDisplayDate(time), 'yyyy/MM/dd (E)', { locale: ja })} ${getDisplayTimeStr(time)}`}
                    </Typography>
                     <IconButton 
                        onClick={() => setPickerConfig({ type: 'time' })}
                        size="small"
                        sx={{ color: 'primary.main' }}
                     >
                         <AccessTimeIcon />
                     </IconButton>
                 </Box>
            </Box>

            <CustomDatePicker
                open={pickerConfig?.type === 'date'}
                onClose={() => setPickerConfig(null)}
                value={getDisplayDate(time)}
                onChange={handleDateSelect}
                accentColor={ALARM_COLOR}
            />
            
            <CustomTimePicker
                open={pickerConfig?.type === 'time'}
                onClose={() => setPickerConfig(null)}
                value={time ? new Date(time) : new Date()}
                onChange={handleTimeSelect}
                accentColor={ALARM_COLOR}
            />
            
            <TextField
                label="Comment"
                name="comment"
                multiline
                rows={4}
                fullWidth
                value={comment}
                onChange={e => setComment(e.target.value)}
                size="small"
            />

            <Stack direction="row" spacing={1} mt={1} justifyContent="flex-end" alignItems="center">
                {alarmId && (
                    <IconButton 
                        color="error"
                        onClick={handleDelete}
                        disabled={loading}
                        sx={{ mr: 'auto' }}
                    >
                        <DeleteIcon />
                    </IconButton>
                )}
                
                <Button 
                    type="submit" 
                    variant="contained" 
                    disabled={loading}
                    sx={{ bgcolor: '#FF4500', '&:hover': { bgcolor: '#CC3700' } }}
                >
                    OK
                </Button>
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
