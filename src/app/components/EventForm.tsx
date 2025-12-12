'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft as ChevronLeftIcon, Delete as DeleteIcon, AccessTime as AccessTimeIcon } from '@mui/icons-material';
import { Box, Button, TextField, Typography, Paper, Stack, IconButton, Container } from '@mui/material';
import { format, addMinutes, isBefore, isAfter, setHours, setMinutes, startOfDay, endOfDay } from 'date-fns';
import { EVENT_COLOR } from '../utils/colors';
import { ja } from 'date-fns/locale';
import BulkEventCreator from './BulkEventCreator';
import CustomDatePicker from './ui/CustomDatePicker';
import CustomTimePicker from './ui/CustomTimePicker';
import { useTimeRange } from '../hooks/useTimeRange';

interface EventFormProps {
    eventId?: string;
    initialValues?: any;
    initialStartTime?: string;
    onSuccess?: (date?: Date) => void;
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

    const { updateStartTime, updateEndTime } = useTimeRange({
        startTime,
        endTime,
        setStartTime,
        setEndTime,
        initialDuration: 60 * 60 * 1000
    });

    // Picker State
    const [pickerConfig, setPickerConfig] = useState<{ type: 'date' | 'time', target: 'start' | 'end' } | null>(null);

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
            }
        } else {
            // Default logic
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
        }
    }, [initialValues, initialStartTime, initialDate]);

    // Helpers
    const getDisplayDate = (isoString: string) => {
        if (!isoString) return new Date();
        return new Date(isoString);
    };

    const getDisplayTimeStr = (isoString: string) => {
        if (!isoString) return '00:00';
        const d = new Date(isoString);
        let h = d.getHours();
        const m = d.getMinutes();
        // Removed 24h logic as requested
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    // Handlers
    const handleDateSelect = (newDate: Date) => {
        if (!pickerConfig) return;
        const target = pickerConfig.target;
        const currentIso = target === 'start' ? startTime : endTime;
        
        const d = currentIso ? new Date(currentIso) : new Date();
        let h = d.getHours();
        const m = d.getMinutes();
        const totalMinutes = h * 60 + m;

        const base = new Date(newDate);
        base.setHours(0, 0, 0, 0);
        const finalText = new Date(base.getTime() + totalMinutes * 60 * 1000);
        
        const formatLocal = (date: Date) => {
             const pad = (n: number) => n < 10 ? '0'+n : n;
             return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };
        const newStr = formatLocal(finalText);

        if (target === 'start') {
            updateStartTime(newStr);
        } else {
            updateEndTime(newStr);
        }
        setPickerConfig(null);
    };

    const handleTimeSelect = (newDate: Date) => {
        if (!pickerConfig) return;
        const target = pickerConfig.target;
        
        const formatLocal = (date: Date) => {
             const pad = (n: number) => n < 10 ? '0'+n : n;
             return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };
        const newStr = formatLocal(newDate);
        
        if (target === 'start') {
            updateStartTime(newStr);
        } else {
            updateEndTime(newStr);
        }
        setPickerConfig(null); 
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
            
            if (onSuccess) onSuccess(getDisplayDate(startTime));
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
    
    if (isBulkMode) {
        return (
            <BulkEventCreator 
                onBack={() => setIsBulkMode(false)}
                onSuccess={() => onSuccess ? onSuccess() : router.back()}
            />
        );
    }

    const content = (
        <Box component="form" onSubmit={handleSubmit} sx={{ p: isModal ? 2 : 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {!isModal && (
                <Box sx={{ pb: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                    <IconButton onClick={() => onSuccess ? onSuccess() : router.push('/')}>
                        <ChevronLeftIcon />
                    </IconButton>
                    <Typography variant="h6" fontWeight="bold" sx={{ ml: 1 }}>{eventId ? 'Edit Event' : 'New Event'}</Typography>
                </Box>
            )}

            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', mb: -1 }}>
                <Typography variant="h6" fontWeight="bold">
                    {eventId ? 'Edit Event' : 'New Event'}
                </Typography>
                {!eventId && (
                    <Button 
                        size="small" 
                        variant="outlined" 
                        onClick={() => setIsBulkMode(true)}
                        sx={{ ml: 'auto' }}
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
                size="small"
            />

            <Box>
                <Stack spacing={2} direction="column">
                   {/* Start Time */}
                   <Box>
                        <Typography variant="caption" color="text.secondary">Start Time</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 0 }}>
                            <Typography variant="body1" sx={{ mr: 1 }}>
                                {`${format(getDisplayDate(startTime), 'yyyy/MM/dd (E)', { locale: ja })} ${getDisplayTimeStr(startTime)}`}
                            </Typography>
                             <IconButton 
                                onClick={() => setPickerConfig({ type: 'time', target: 'start' })}
                                size="small"
                                sx={{ color: 'primary.main' }}
                             >
                                <AccessTimeIcon />
                             </IconButton>
                        </Box>
                   </Box>

                   {/* End Time */}
                   <Box>
                        <Typography variant="caption" color="text.secondary">End Time</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 0 }}>
                            <Typography variant="body1" sx={{ mr: 1 }}>
                                {`${format(getDisplayDate(endTime), 'yyyy/MM/dd (E)', { locale: ja })} ${getDisplayTimeStr(endTime)}`}
                            </Typography>
                             <IconButton 
                                onClick={() => setPickerConfig({ type: 'time', target: 'end' })}
                                size="small"
                                sx={{ color: 'primary.main' }}
                             >
                                 <AccessTimeIcon />
                             </IconButton>
                        </Box>
                   </Box>
                </Stack>
                
                <CustomDatePicker
                    open={pickerConfig?.type === 'date'}
                    onClose={() => setPickerConfig(null)}
                    value={getDisplayDate(pickerConfig?.target === 'start' ? startTime : endTime)}
                    onChange={handleDateSelect}
                    accentColor={EVENT_COLOR}
                />
                
                <CustomTimePicker
                    open={pickerConfig?.type === 'time'}
                    onClose={() => setPickerConfig(null)}
                    value={pickerConfig?.target === 'start' ? (startTime ? new Date(startTime) : new Date()) : (endTime ? new Date(endTime) : new Date())}
                    onChange={handleTimeSelect}
                    accentColor={EVENT_COLOR}
                />
                
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
                    
                    const days = ['日', '月', '火', '水', '木', '金', '土'];
                    const dayStr = `${start.getMonth() + 1}月${start.getDate()}日(${days[start.getDay()]})`;
                    const timeStr = `${start.getHours()}:${start.getMinutes().toString().padStart(2, '0')}`;
                    
                    return (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
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
                size="small"
            />

            <Stack direction="row" spacing={1} mt={1} justifyContent="flex-end" alignItems="center">
                {eventId && (
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
