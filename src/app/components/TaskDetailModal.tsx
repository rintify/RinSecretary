import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Slider, Chip, Stack, Button, Checkbox } from '@mui/material';
import { TASK_COLOR } from '../utils/colors';

// ... (existing imports, interfaces)


import { Edit as EditIcon, Close as CloseIcon, CalendarMonth as CalendarIcon, Notifications as BellIcon } from '@mui/icons-material';
import { format, subHours } from 'date-fns';
import { createAlarm } from '@/lib/alarm-actions';
import MarkdownDisplay from './MarkdownDisplay';

interface Task {
    id: string;
    title: string;
    memo?: string;
    startDate?: string | Date;
    deadline?: string | Date;
    progress?: number;
    maxProgress?: number;
    checklist?: string;
}

interface ChecklistItem {
    id?: string;
    text: string;
    checked: boolean;
}

interface TaskDetailModalProps {
    task: Task;
    onClose: () => void;
    onEdit: () => void;
    onUpdate?: () => void; // Trigger refresh
}

export default function TaskDetailModal({ task, onClose, onEdit, onUpdate }: TaskDetailModalProps) {
    const [progress, setProgress] = useState(task.progress || 0);
    const maxProgress = task.maxProgress || 100;
    
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);

    useEffect(() => {
        if (task.checklist) {
            try {
                setChecklistItems(JSON.parse(task.checklist));
            } catch (e) {
                setChecklistItems([]);
            }
        } else {
            setChecklistItems([]);
        }
        setProgress(task.progress || 0);
    }, [task]);

    const handleProgressChange = (event: Event, newValue: number | number[]) => {
        setProgress(newValue as number);
    };

    const handleProgressCommitted = async (event: React.SyntheticEvent | Event, newValue: number | number[]) => {
        try {
            await fetch(`/api/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ progress: newValue })
            });
            if (onUpdate) onUpdate();
            // Do NOT close on progress interaction? User might want to adjust more.
            // keeping existing behavior: onClose() called in original code.
            // User requested: "チェック状態が更新されると進捗が自動更新される"
            // If I slide progress (legacy), original code closed modal. 
            // If I check item, I probably want to stay in modal.
            if (checklistItems.length === 0) onClose(); 
        } catch (error) {
            console.error('Failed to update progress:', error);
        }
    };

    const handleChecklistToggle = async (index: number) => {
        const newItems = [...checklistItems];
        newItems[index] = { ...newItems[index], checked: !newItems[index].checked };
        setChecklistItems(newItems);

        const checkedCount = newItems.filter(i => i.checked).length;
        const newProgress = (checkedCount / newItems.length) * 100;
        setProgress(newProgress);

        try {
            await fetch(`/api/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    checklist: newItems,
                    progress: newProgress
                })
            });
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to update checklist:', error);
            // Revert? For now just log error.
        }
    };

    return (
        <Box sx={{ p: 3 }}>
             <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                 <Typography variant="h5" fontWeight="bold" sx={{ flex: 1, mr: 2 }}>
                     {task.title}
                 </Typography>
                 <Box>
                     <IconButton onClick={onEdit} color="primary">
                         <EditIcon />
                     </IconButton>
                     <IconButton onClick={onClose}>
                         <CloseIcon />
                     </IconButton>
                 </Box>
             </Box>

             {task.deadline && (
                 <Box display="flex" alignItems="center" gap={1} mb={2} color="text.secondary">
                     <CalendarIcon fontSize="small" />
                     <Typography variant="body2">
                         Limit: {format(new Date(task.deadline), 'yyyy/MM/dd HH:mm')}
                     </Typography>
                     <IconButton 
                        size="small" 
                        onClick={() => {
                            if (task.deadline) {
                                const alarmTime = subHours(new Date(task.deadline), 1);
                                createAlarm({
                                    title: `[Re] ${task.title}`,
                                    time: alarmTime,
                                });
                                if (onClose) onClose();
                            }
                        }}
                    >
                        <BellIcon fontSize="small" color="action" />
                    </IconButton>
                 </Box>
             )}

             {task.memo && (
                 <Box className="selectable-text" sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2, mb: 3, '& p': { m: 0 } }}>
                     <MarkdownDisplay>
                         {task.memo} 
                     </MarkdownDisplay>
                 </Box>
             )}

             {/* Checklist Section */}
             {checklistItems.length > 0 && (
                 <Box mb={3}>
                     <Typography variant="subtitle2" fontWeight="bold" mb={1}>Checklist</Typography>
                     <Stack spacing={0.5}>
                         {checklistItems.map((item, index) => (
                             <Box key={index} display="flex" alignItems="center" gap={1}>
                                 <Checkbox 
                                     checked={item.checked} 
                                     onChange={() => handleChecklistToggle(index)}
                                     size="small"
                                     sx={{ 
                                         p: 0.5,
                                         color: TASK_COLOR,
                                         '&.Mui-checked': {
                                             color: TASK_COLOR,
                                         },
                                     }}
                                 />
                                 <Typography 
                                    variant="body2" 
                                    sx={{ 
                                        textDecoration: item.checked ? 'line-through' : 'none',
                                        color: item.checked ? 'text.secondary' : 'text.primary'
                                    }}
                                 >
                                     {item.text}
                                 </Typography>
                             </Box>
                         ))}
                     </Stack>
                 </Box>
             )}

             {checklistItems.length === 0 && (
                 <Box mb={2}>
                     <Box display="flex" justifyContent="space-between" mb={1}>
                         <Typography variant="subtitle2" fontWeight="bold">Progress</Typography>
                         <Typography variant="subtitle2">{Math.round(progress)} / {maxProgress}</Typography>
                     </Box>
                     <Slider
                         value={progress}
                         min={0}
                         max={maxProgress}
                         step={1.0}
                         onChange={handleProgressChange}
                         onChangeCommitted={handleProgressCommitted}
                         valueLabelDisplay="auto"
                         sx={{ 
                             color: 'primary.main',
                             '& .MuiSlider-thumb': {
                                 transition: 'width 0.2s, height 0.2s',
                                 '&:hover, &.Mui-focusVisible': {
                                     boxShadow: `0px 0px 0px 8px rgba(25, 118, 210, 0.16)`,
                                 },
                             }
                         }}
                     />
                 </Box>
             )}
        </Box>
    );
}
