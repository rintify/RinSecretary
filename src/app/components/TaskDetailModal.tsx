import React, { useState } from 'react';
import { Box, Typography, IconButton, Slider, Chip, Stack, Button } from '@mui/material';
import { Edit as EditIcon, Close as CloseIcon, CalendarMonth as CalendarIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Task {
    id: string;
    title: string;
    memo?: string;
    startDate?: string | Date;
    deadline?: string | Date;
    progress?: number;
    maxProgress?: number;

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
            onClose(); // Auto close
        } catch (error) {
            console.error('Failed to update progress:', error);
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
                 </Box>
             )}

             {task.memo && (
                 <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2, mb: 3, '& p': { m: 0 } }}>
                     <ReactMarkdown
                        remarkPlugins={[remarkMath, remarkGfm]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                            a: ({node, ...props}) => <a {...props} style={{ color: '#1976d2', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer" />
                        }}
                     >
                         {task.memo} 
                     </ReactMarkdown>
                 </Box>
             )}

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
        </Box>
    );
}
