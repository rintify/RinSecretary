import React from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { Card, CardContent, Typography, Box, CardActionArea, LinearProgress, Chip, keyframes } from '@mui/material';
import { AccessTime as ClockIcon, Event as CalendarIcon } from '@mui/icons-material';

const blinkAnimation = keyframes`
  0% { box-shadow: 0 0 5px 0px rgba(244, 67, 54, 0.3); }
  50% { box-shadow: 0 0 15px 5px rgba(244, 67, 54, 0.6); }
  100% { box-shadow: 0 0 5px 0px rgba(244, 67, 54, 0.3); }
`;

interface Task {
  id: string;
  title: string;
  memo?: string;
  color: string;
  type?: string; 
  // Event (Google)
  startTime?: string | Date;
  endTime?: string | Date;
  // Task (DB)
  startDate?: string | Date;
  deadline?: string | Date;
  progress?: number;
  maxProgress?: number;
}

interface TaskItemProps {
  task: Task;
  style?: React.CSSProperties;
  onClick: (task: Task) => void;
  onTaskDrop?: (task: Task, minutesMoved: number) => void;
  viewDate?: Date;
}

export default function TaskItem({ task, style, onClick, viewDate }: TaskItemProps) {
  const isEvent = !!task.startTime;
  const isTask = !!task.deadline;

  const isDone = isTask && (task.progress || 0) >= (task.maxProgress || 100);

  // Deadline logic
  let daysUntilDeadline: number | null = null;
  if (task.deadline) {
      daysUntilDeadline = differenceInCalendarDays(new Date(task.deadline), new Date());
  }

  // Warning: <= 3 days
  const isWarning = daysUntilDeadline !== null && daysUntilDeadline <= 3 && daysUntilDeadline >= 0 && !isDone;
  
  // Urgent: <= 1 day
  const isUrgent = daysUntilDeadline !== null && daysUntilDeadline <= 1 && daysUntilDeadline >= 0 && !isDone;

  const isSameDay = (d1: Date, d2: Date) => {
      return d1.getFullYear() === d2.getFullYear() && 
             d1.getMonth() === d2.getMonth() && 
             d1.getDate() === d2.getDate();
  };

  const getDayTimeDisplay = () => {
      if (!task.startTime || !task.endTime) return null;
      if (!viewDate) {
           return `${format(new Date(task.startTime), 'HH:mm')} - ${format(new Date(task.endTime), 'HH:mm')}`;
      }

      const start = new Date(task.startTime);
      const end = new Date(task.endTime);

      const isStart = isSameDay(viewDate, start);
      const isEnd = isSameDay(viewDate, end);

      if (isStart && isEnd) {
          return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
      } else if (isStart) {
          return `${format(start, 'HH:mm')} -`;
      } else if (isEnd) {
          return `- ${format(end, 'HH:mm')}`;
      } else {
          return '-';
      }
  };

  const getDeadlineDisplay = () => {
    if (!task.deadline) return null;
    return format(new Date(task.deadline), 'MM/dd HH:mm');
  }

  // Colors
  const borderColor = isDone ? '#9e9e9e' : '#9acd32'; // Yellow-green
  const warningColor = '#ffb74d'; // Orange-yellow chip
  
  return (
    <Box sx={{ position: 'relative', mb: 1 }}>
        {isWarning && (
            <Chip 
                label={`${daysUntilDeadline}日前`} 
                size="small"
                sx={{ 
                    position: 'absolute', 
                    top: -8, 
                    left: -4, 
                    zIndex: 10, 
                    bgcolor: warningColor, 
                    fontWeight: 'bold', 
                    height: 20, 
                    fontSize: '0.7rem' 
                }} 
            />
        )}
        <Card 
          variant="outlined"
          sx={{ 
            borderRadius: 3, 
            bgcolor: 'transparent', 
            border: '2px solid',
            borderColor: borderColor,
            color: 'text.primary',
            boxShadow: 'none',
            opacity: isDone ? 0.6 : 1,
            transition: 'all 0.3s ease',
            animation: isUrgent ? `${blinkAnimation} 1s infinite ease-in-out` : 'none',
            ...style 
          }}
        >
          <CardActionArea onClick={() => onClick(task)} sx={{ p: 1 }}> {/* Compressed padding */}
            <Box display="flex" flexDirection="column" gap={0.5}> {/* Compressed gap */}
              <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold', lineHeight: 1.2, textDecoration: isDone ? 'line-through' : 'none', mt: 1 }}>
                {task.title}
              </Typography>
              
              {task.memo && (
                <Typography variant="caption" sx={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {task.memo}
                </Typography>
              )}

              {isEvent && task.startTime && task.endTime && (
                 <Box display="flex" alignItems="center" gap={0.5} sx={{ opacity: 0.9 }}>
                    <ClockIcon sx={{ fontSize: 12 }} />
                    <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                        {getDayTimeDisplay()}
                    </Typography>
                 </Box>
              )}

              {isTask && task.deadline && (
                  <Box mt={0.5}>
                    <Box display="flex" alignItems="center" gap={0.5} sx={{ opacity: 0.9, mb: 0.2 }}>
                        <CalendarIcon sx={{ fontSize: 12 }} />
                        <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                            Limit: {getDeadlineDisplay()}
                        </Typography>
                    </Box>
                    <LinearProgress 
                        variant="determinate" 
                        value={Math.min(100, ((task.progress || 0) / (task.maxProgress || 100)) * 100)} 
                        sx={{ 
                            height: 4, 
                            borderRadius: 2, 
                            bgcolor: 'rgba(0,0,0,0.1)',
                            '& .MuiLinearProgress-bar': {
                                bgcolor: isDone ? '#9e9e9e' : '#9acd32'
                            }
                        }}
                    />
                  </Box>
              )}
            </Box>
          </CardActionArea>
        </Card>
    </Box>
  );
}

