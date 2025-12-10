import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Edit as EditIcon, Close as CloseIcon, AccessTime as TimeIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface EventLocal {
    id: string;
    title: string;
    memo?: string;
    startTime?: string | Date;
    endTime?: string | Date;
    color?: string;
}

interface EventDetailModalProps {
    event: EventLocal;
    onClose: () => void;
    onEdit: () => void;
}

export default function EventDetailModal({ event, onClose, onEdit }: EventDetailModalProps) {
    return (
        <Box sx={{ p: 3 }}>
             <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                 <Typography variant="h5" fontWeight="bold" sx={{ flex: 1, mr: 2 }}>
                     {event.title}
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

             {event.startTime && event.endTime && (
                 <Box display="flex" alignItems="center" gap={1} mb={2} color="text.secondary">
                     <TimeIcon fontSize="small" />
                     <Typography variant="body1">
                         {format(new Date(event.startTime), 'HH:mm')} - {format(new Date(event.endTime), 'HH:mm')}
                     </Typography>
                 </Box>
             )}

             {event.memo && (
                 <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2, mb: 1, '& p': { m: 0 } }}>
                     <ReactMarkdown
                        remarkPlugins={[remarkMath, remarkGfm]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                            a: ({node, ...props}) => <a {...props} style={{ color: '#1976d2', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer" />
                        }}
                     >
                         {event.memo}
                     </ReactMarkdown>
                 </Box>
             )}
        </Box>
    );
}
