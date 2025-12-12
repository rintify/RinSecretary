import React from 'react';
import { EVENT_COLOR, TASK_COLOR, ALARM_COLOR } from '../utils/colors';
import { format, differenceInCalendarDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Card, CardContent, Typography, Box, CardActionArea, LinearProgress, Chip, keyframes } from '@mui/material';
import { AccessTime as ClockIcon, Event as CalendarIcon } from '@mui/icons-material';
import { isSameDay } from 'date-fns'; // Using library isSameDay to be cleaner or just use the local one? Local one is defined below. I'll stick to local or import. Actually I should check if isSameDay is imported. It is not. I'll insert it or use local.
// Let's rely on the local definition or Date comparison. Wait, "isSameDay" is defined inside locally at line 54. I should lift it or use date-fns.
// I will just use the local logic for now or modify the code to check "Today".

const blinkAnimation = keyframes`
  0% { box-shadow: 0 0 5px 0px rgba(244, 67, 54, 0.3); }
  50% { box-shadow: 0 0 15px 5px rgba(244, 67, 54, 0.6); }
  100% { box-shadow: 0 0 5px 0px rgba(244, 67, 54, 0.3); }
`;

interface Task {
  id: string;
  title: string;
  memo?: string;
  color?: string;
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
  const isAlarm = task.type === 'ALARM';
  // If generic "Task" or DB Task - check deadline
  const isTask = !!task.deadline;

  const isDone = isTask && (task.progress || 0) >= (task.maxProgress || 100);

  // Deadline logic
  let daysUntilDeadline: number | null = null;
  let minutesUntilDeadline: number | null = null;
  
  if (task.deadline) {
      const now = new Date();
      const d = new Date(task.deadline);
      daysUntilDeadline = differenceInCalendarDays(d, now);
      minutesUntilDeadline = differenceInMinutes(d, now);
  }

  // Warning: <= 3 days
  const isWarning = daysUntilDeadline !== null && daysUntilDeadline <= 3 && daysUntilDeadline >= 0 && !isDone;
  
  // Urgent (Red Border & Blink) Logic
  // User Request Step 109: 
  // - If Duration <= 24h: Urgent if remaining <= 1/8 of duration.
  // - If Duration > 24h: Urgent if remaining <= 24h.
  
  let isUrgent = false;   
  // Note: Previous "shouldBlink" is now merged back into isUrgent because user treats "Red Border & Blink" as the "Urgent State".
  
  if (isTask && task.deadline && minutesUntilDeadline !== null && minutesUntilDeadline >= 0 && !isDone) {
      if (task.startDate) {
          const start = new Date(task.startDate);
          const end = new Date(task.deadline);
          const durationMinutes = differenceInMinutes(end, start);
          
          if (durationMinutes <= 1440) {
              // Short Task (<= 24h)
              // User Request Step 123: "In case of 1 day, make it within 1 hour instead of 1/8"
              // Condition: Remaining <= 60 minutes
              if (minutesUntilDeadline <= 180) {
                  isUrgent = true;
              }
          } else {
              // Long Task (> 24h)
              // Condition: Remaining <= 24h (1440 mins)
              if (minutesUntilDeadline <= 1440) {
                  isUrgent = true;
              }
          }
      } else {
          // Fallback if no start date
          // Default to "Urgent if < 24h" logic?
          if (minutesUntilDeadline < 1440) {
             isUrgent = true;
          }
      }
  }

  // Chip Label Logic
  let chipLabel = '';
  if (minutesUntilDeadline !== null && task.deadline) {
      if (minutesUntilDeadline < 0) {
          chipLabel = '期限切れ';
      } else if (minutesUntilDeadline < 60) {
          chipLabel = `あと${minutesUntilDeadline}分！`;
      } else if (minutesUntilDeadline < 1440) {
          const hours = Math.floor(minutesUntilDeadline / 60);
          chipLabel = `あと${hours}時間！`;
      } else {
          chipLabel = `あと${daysUntilDeadline}日`;
      }
  }

  const isSameDayFn = (d1: Date, d2: Date) => {
      return d1.getFullYear() === d2.getFullYear() && 
             d1.getMonth() === d2.getMonth() && 
             d1.getDate() === d2.getDate();
  };
  
  const isViewToday = viewDate ? isSameDayFn(viewDate, new Date()) : true; 
  
  // Warning only if view is Today
  const showWarning = isWarning && isViewToday;
  // Urgent/Blink only if view is Today
  const showUrgent = isUrgent && isViewToday;
  // const showBlink = shouldBlink && isViewToday; // Merged into showUrgent

  const getDayTimeDisplay = () => {
      // Logic for Event (range) or Alarm (point)
      if (isAlarm && task.startTime) {
          return format(new Date(task.startTime), 'HH:mm');
      }

      if (!task.startTime || !task.endTime) return null;
      if (!viewDate) {
           return `${format(new Date(task.startTime), 'HH:mm')} - ${format(new Date(task.endTime), 'HH:mm')}`;
      }

      const start = new Date(task.startTime);
      const end = new Date(task.endTime);

      const isStart = isSameDayFn(viewDate, start);
      const isEnd = isSameDayFn(viewDate, end);

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
    return format(new Date(task.deadline), 'MM/dd(eee) HH:mm', { locale: ja });
  }

  // Colors
  // Alarm -> Light Blue (#29b6f6 or info.light)
  // Task -> Yellow (#ffeb3b or yellow[500] but border should be visible)
  

  let borderColor = '#e0e0e0'; // default
  if (isTask) {
      if (isDone) borderColor = '#9e9e9e';
      else if (showUrgent) borderColor = '#f44336'; // Use showUrgent to respect "Today" view? Or just 'isUrgent'? Original was 'isUrgent'. But 'showUrgent = isUrgent && isViewToday'. 
      // If I view "Tomorrow" list, tasks due tomorrow (Duration<24h) might be red?
      // "showUrgent" is safer for "Today" emphasis.
      else borderColor = TASK_COLOR; 
  } else if (isAlarm) {
      borderColor = ALARM_COLOR; 
  } else if (isEvent) {
      borderColor = EVENT_COLOR; 
  }

  const warningColor = '#ffb74d'; // Orange-yellow chip
  
  return (
    <Box sx={{ position: 'relative', mb: 1.5 }}>
        {showWarning && (
            <Chip 
                label={chipLabel} 
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
            animation: showUrgent ? `${blinkAnimation} 1s infinite ease-in-out` : 'none',
            ...style 
          }}
        >
          <CardActionArea onClick={() => onClick(task)} sx={{ p: 1 }}> {/* Compressed padding */}
            <Box display="flex" flexDirection="column" gap={0.5}> {/* Compressed gap */}
              <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold', lineHeight: 1.2, textDecoration: isDone ? 'line-through' : 'none', mt: 1 }}>
                {task.title}
              </Typography>
              
              {/* Time Row (Event or Alarm) */}
              {(isEvent || isAlarm) && task.startTime && (
                  <Box display="flex" alignItems="center" gap={0.5} sx={{ opacity: 0.9 }}>
                    <ClockIcon sx={{ fontSize: 12 }} />
                    <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                        {getDayTimeDisplay()}
                    </Typography>
                  </Box>
              )}

              {/* Deadline Row */}
              {isTask && task.deadline && (
                  <Box display="flex" alignItems="center" gap={0.5} sx={{ opacity: 0.9 }}>
                    <CalendarIcon sx={{ fontSize: 12 }} />
                    <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                        {getDeadlineDisplay()}
                    </Typography>
                  </Box>
              )}

              {isTask && task.deadline && (
                  <Box mt={0.5}>
                    <LinearProgress  
                        variant="determinate" 
                        value={Math.min(100, ((task.progress || 0) / (task.maxProgress || 100)) * 100)} 
                        sx={{ 
                            height: 4, 
                            borderRadius: 2, 
                            bgcolor: 'rgba(0,0,0,0.1)',
                            '& .MuiLinearProgress-bar': {
                                bgcolor: isDone ? '#9e9e9e' : '#fdd835'
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

