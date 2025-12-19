import { Box, Typography, IconButton } from '@mui/material';
import { Edit as EditIcon, Close as CloseIcon, AccessTime as TimeIcon, Notifications as BellIcon } from '@mui/icons-material';
import { format, subMinutes } from 'date-fns';
import { createAlarm } from '@/lib/alarm-actions';
import MarkdownDisplay from './MarkdownDisplay';

interface EventLocal {
    id: string;
    title: string;
    memo?: string;
    startTime?: string | Date;
    endTime?: string | Date;

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
                     <IconButton 
                        size="small" 
                        onClick={() => {
                            if (event.startTime) {
                                const alarmTime = subMinutes(new Date(event.startTime), 5);
                                createAlarm({
                                    title: `[Re] ${event.title}`,
                                    time: alarmTime,
                                });
                                // Maybe show a toast or feedback? For now just action.
                                // Revalidate path is in server action, so UI should update if showing alarms.
                            }
                        }}
                    >
                        <BellIcon fontSize="small" color="action" />
                    </IconButton>
                 </Box>
             )}

             {event.memo && (
                 <Box className="selectable-text" sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2, mb: 1, '& p': { m: 0 } }}>
                     <MarkdownDisplay>
                         {event.memo}
                     </MarkdownDisplay>
                 </Box>
             )}
        </Box>
    );
}
