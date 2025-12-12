'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft as ChevronLeftIcon, Delete as DeleteIcon, AccessTime as AccessTimeIcon, Add as AddIcon, Close as RemoveIcon } from '@mui/icons-material';
import { Box, Button, TextField, Typography, Paper, Stack, IconButton, Container, Checkbox } from '@mui/material';
import { format, subDays, addHours, startOfDay, endOfDay, isBefore } from 'date-fns';
import { TASK_COLOR } from '../utils/colors';
import { ja } from 'date-fns/locale';
import { formatLocalIsoString } from '@/lib/utils';
import CustomDatePicker from './ui/CustomDatePicker';
import CustomTimePicker from './ui/CustomTimePicker';

import { useTimeRange } from '../hooks/useTimeRange';

interface TaskFormProps {
    taskId?: string;
    onSuccess?: (date?: Date) => void;
    isModal?: boolean;
    initialValues?: any;
    initialDate?: Date;
}


interface ChecklistItem {
    text: string;
    checked: boolean;
}

export default function TaskForm(props: TaskFormProps) {
    const { taskId, onSuccess, isModal = false, initialDate } = props;
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(!!taskId);

    // Form State
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [deadline, setDeadline] = useState('');
    const [progress, setProgress] = useState(0);
    const [maxProgress, setMaxProgress] = useState(100);
    const [memo, setMemo] = useState('');
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

    const { updateStartTime: updateStartDate, updateEndTime: updateDeadline } = useTimeRange({
        startTime: startDate,
        endTime: deadline,
        setStartTime: setStartDate,
        setEndTime: setDeadline,
        initialDuration: 24 * 60 * 60 * 1000 // Default to 1 day if undefined
    });

    // Picker State
    const [pickerConfig, setPickerConfig] = useState<{ type: 'date' | 'time', target: 'start' | 'deadline' } | null>(null);

    useEffect(() => {
        if (taskId && props.initialValues) {
             const task = props.initialValues;
             setTitle(task.title);
             setMemo(task.memo || '');
             if (task.startDate) {
                 setStartDate(format(new Date(task.startDate), "yyyy-MM-dd'T'HH:mm"));
             }
             if (task.deadline) {
                 setDeadline(format(new Date(task.deadline), "yyyy-MM-dd'T'HH:mm"));
             }
             if (task.progress !== undefined) setProgress(task.progress);
             if (task.maxProgress !== undefined) setMaxProgress(task.maxProgress);
             if (task.checklist) {
                 try {
                     setChecklist(JSON.parse(task.checklist));
                 } catch (e) {
                     setChecklist([]);
                 }
             }
             setFetching(false);
        } else if (taskId) {
            // Edit Mode: Fetch existing
            fetch(`/api/tasks/${taskId}`)
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error('Task not found');
                })
                .then(task => {
                    setTitle(task.title);
                    setMemo(task.memo || '');
                    if (task.startDate) setStartDate(format(new Date(task.startDate), "yyyy-MM-dd'T'HH:mm"));
                    if (task.deadline) setDeadline(format(new Date(task.deadline), "yyyy-MM-dd'T'HH:mm"));
                    if (task.progress !== undefined) setProgress(task.progress);
                    if (task.maxProgress !== undefined) setMaxProgress(task.maxProgress);
                    if (task.checklist) {
                        try {
                            setChecklist(JSON.parse(task.checklist));
                        } catch (e) {
                            setChecklist([]);
                        }
                    }
                })
                .catch(e => {
                    console.error(e);
                })
                .finally(() => setFetching(false));
        } else {
            // Create Mode: Initialize defaults
            setFetching(false);
            const baseDate = initialDate || new Date();
            // Start of the day (00:00)
            const startOfDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);
            setStartDate(formatLocalIsoString(startOfDay));
            
            // End of the day (23:59)
            const endOfDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 23, 59, 0, 0);
            setDeadline(formatLocalIsoString(endOfDay));
        }
    }, [taskId, onSuccess, router, props.initialValues, initialDate]);

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
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    const handleDateSelect = (newDate: Date) => {
        if (!pickerConfig) return;
        const target = pickerConfig.target;
        const currentIso = target === 'start' ? startDate : deadline;
        
        const d = currentIso ? new Date(currentIso) : new Date();
        let h = d.getHours();
        const m = d.getMinutes();
        const totalMinutes = h * 60 + m;

        const base = new Date(newDate);
        base.setHours(0, 0, 0, 0);
        const finalText = new Date(base.getTime() + totalMinutes * 60 * 1000);
        
        const newStr = formatLocalIsoString(finalText);

        if (target === 'start') updateStartDate(newStr);
        else updateDeadline(newStr);

        setPickerConfig(null);
    };

    const handleTimeSelect = (newDate: Date) => {
        if (!pickerConfig) return;
        const target = pickerConfig.target;
        
        const newStr = formatLocalIsoString(newDate);
        
        if (target === 'start') updateStartDate(newStr);
        else updateDeadline(newStr);

        setPickerConfig(null); 
    };

    const handleAddChecklistItem = () => {
        setChecklist([...checklist, { text: '', checked: false }]);
    };

    const handleRemoveChecklistItem = (index: number) => {
        const newChecklist = [...checklist];
        newChecklist.splice(index, 1);
        setChecklist(newChecklist);
        
        // Recalculate progress if items > 0 (actually items will be newChecklist.length)
        // Ref logic: If items become 0, progress remains as is (user can edit).
        // If items > 0, we can auto-update progress.
        if (newChecklist.length > 0) {
            const checkedCount = newChecklist.filter(i => i.checked).length;
            const newProgress = (checkedCount / newChecklist.length) * 100;
            setProgress(newProgress);
            setMaxProgress(100);
        }
    };

    const handleChecklistItemChange = (index: number, text: string) => {
        const newChecklist = [...checklist];
        newChecklist[index].text = text;
        setChecklist(newChecklist);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        try {
            const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks';
            const method = taskId ? 'PUT' : 'POST';
            
            // Prepare payload
            // If checklist exists, enforce progress calculation logic before saving
            // (Just to be sure, although states should be in sync)
            let finalProgress = progress;
            let finalMaxProgress = maxProgress;

            if (checklist.length > 0) {
                 const checkedCount = checklist.filter(c => c.checked).length;
                 finalProgress = (checkedCount / checklist.length) * 100;
                 finalMaxProgress = 100;
            }

            const taskPayload = {
                title,
                memo,
                startDate,
                deadline,
                progress: finalProgress,
                maxProgress: finalMaxProgress,
                checklist
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskPayload),
            });

            if (res.ok) {
                if (onSuccess) onSuccess(getDisplayDate(deadline || startDate));
                else {
                    router.push('/');
                    router.refresh();
                }
            } else {
                alert('Failed to save task');
            }
        } catch (error) {
            console.error(error);
            alert('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!taskId) return;
        if (!confirm('Are you sure you want to delete this task?')) return;
        setLoading(true);
        try {
             const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
             if (!res.ok) throw new Error('Failed');
             
             if (onSuccess) onSuccess();
             else {
                 router.push('/');
                 router.refresh();
             }
        } catch(e) {
            console.error(e);
            alert('Error deleting task');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) return <Box p={4} textAlign="center">Loading...</Box>;

    const content = (
        <Box component="form" onSubmit={handleSubmit} sx={{ p: isModal ? 2 : 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {!isModal && (
                <Box sx={{ pb: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                    <IconButton onClick={() => onSuccess ? onSuccess() : router.push('/')}>
                        <ChevronLeftIcon />
                    </IconButton>
                    <Typography variant="h6" fontWeight="bold" sx={{ ml: 1 }}>{taskId ? 'Edit Task' : 'New Task'}</Typography>
                </Box>
            )}

            <Typography variant="h6" fontWeight="bold" align="left" sx={{ mb: -1 }}>
                {taskId ? 'Edit Task' : 'New Task'}
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

            <Stack spacing={2}>
                {/* Start Date */}
                <Box>
                     <Typography variant="caption" color="text.secondary">Start Date</Typography>
                     <Box sx={{ display: 'flex', alignItems: 'center', mt: 0 }}>
                        <Typography variant="body1" sx={{ mr: 1 }}>
                            {`${format(getDisplayDate(startDate), 'yyyy/MM/dd (E)', { locale: ja })} ${getDisplayTimeStr(startDate)}`}
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

                {/* Deadline */}
                <Box>
                     <Typography variant="caption" color="text.secondary">Deadline</Typography>
                     <Box sx={{ display: 'flex', alignItems: 'center', mt: 0 }}>
                        <Typography variant="body1" sx={{ mr: 1 }}>
                            {`${format(getDisplayDate(deadline), 'yyyy/MM/dd (E)', { locale: ja })} ${getDisplayTimeStr(deadline)}`}
                        </Typography>
                         <IconButton 
                            onClick={() => setPickerConfig({ type: 'time', target: 'deadline' })}
                            size="small"
                            sx={{ color: 'primary.main' }}
                         >
                                 <AccessTimeIcon />
                         </IconButton>
                     </Box>
                </Box>

                <Stack direction="row" spacing={1}>
                    <TextField
                        label="Current Progress"
                        name="progress"
                        type="number"
                        inputProps={{ min: 0 }}
                        value={progress}
                        onChange={e => setProgress(Number(e.target.value))}
                        fullWidth
                        size="small"
                        disabled={checklist.length > 0}
                        helperText={checklist.length > 0 ? "Calculated from checklist" : ""}
                    />
                    <TextField
                        label="Max Progress"
                        name="maxProgress"
                        type="number"
                        inputProps={{ min: 1 }}
                        value={maxProgress}
                        onChange={e => setMaxProgress(Number(e.target.value))}
                        fullWidth
                        size="small"
                        disabled={checklist.length > 0}
                        helperText={checklist.length > 0 ? "Fixed to 100%" : ""}
                    />
                </Stack>
            </Stack>

            {/* Checklist Section */}
            <Box>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="caption" color="text.secondary">Checklist</Typography>
                    <IconButton size="small" onClick={handleAddChecklistItem} color="primary">
                        <AddIcon fontSize="small" />
                    </IconButton>
                </Box>
                <Stack spacing={1}>
                    {checklist.map((item, index) => (
                        <Box key={index} display="flex" alignItems="center" gap={1}>
                            <Checkbox 
                                checked={item.checked} 
                                disabled 
                                size="small" 
                                sx={{ p: 0.5 }}
                            />
                            <TextField
                                value={item.text}
                                onChange={(e) => handleChecklistItemChange(index, e.target.value)}
                                placeholder="Item name"
                                fullWidth
                                size="small"
                                variant="standard"
                            />
                            <IconButton 
                                size="small" 
                                onClick={() => handleRemoveChecklistItem(index)}
                            >
                                <RemoveIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    ))}
                    {checklist.length === 0 && (
                         <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.8rem' }}>
                             No items
                         </Typography>
                    )}
                </Stack>
            </Box>
            
            <CustomDatePicker
                open={pickerConfig?.type === 'date'}
                onClose={() => setPickerConfig(null)}
                value={getDisplayDate(pickerConfig?.target === 'start' ? startDate : deadline)}
                onChange={handleDateSelect}
                accentColor={TASK_COLOR}
            />
            
            <CustomTimePicker
                open={pickerConfig?.type === 'time'}
                onClose={() => setPickerConfig(null)}
                value={pickerConfig?.target === 'start' ? (startDate ? new Date(startDate) : new Date()) : (deadline ? new Date(deadline) : new Date())}
                onChange={handleTimeSelect}
                accentColor={TASK_COLOR}
            />
            
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
                {taskId && (
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
