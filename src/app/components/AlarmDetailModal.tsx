import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Edit as EditIcon, Close as CloseIcon, NotificationsActive as AlarmIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import MarkdownDisplay from './MarkdownDisplay';

interface AlarmLocal {
    id: string;
    title: string;
    memo?: string;
    startTime?: string | Date; // Used for generic compatibility
    time?: string | Date;
}

interface AlarmDetailModalProps {
    alarm: AlarmLocal;
    onClose: () => void;
    onEdit: () => void;
}

export default function AlarmDetailModal({ alarm, onClose, onEdit }: AlarmDetailModalProps) {
    const time = alarm.startTime || alarm.time;

    return (
        <Box sx={{ p: 3 }}>
             <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                 <Box display="flex" alignItems="center" gap={1}>
                     <AlarmIcon color="error" />
                     <Typography variant="h5" fontWeight="bold">
                         {alarm.title}
                     </Typography>
                 </Box>
                 
                 <Box>
                     <IconButton onClick={onEdit} color="primary">
                         <EditIcon />
                     </IconButton>
                     <IconButton onClick={onClose}>
                         <CloseIcon />
                     </IconButton>
                 </Box>
             </Box>

             {time && (
                 <Box display="flex" alignItems="center" gap={1} mb={2} color="text.secondary">
                     <Typography variant="h4" fontWeight="bold" color="text.primary">
                         {format(new Date(time), 'HH:mm')}
                     </Typography>
                     <Typography variant="body1">
                        {format(new Date(time), 'yyyy/MM/dd')}
                     </Typography>
                 </Box>
             )}

             {alarm.memo && (
                 <Box className="selectable-text" sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2, mb: 1, '& p': { m: 0 } }}>
                     <MarkdownDisplay>
                         {alarm.memo}
                     </MarkdownDisplay>
                 </Box>
             )}
        </Box>
    );
}
