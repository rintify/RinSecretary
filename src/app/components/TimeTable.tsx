'use client';

import { useState, useEffect } from 'react';
import { addHours, startOfDay, format, addDays, subDays, isSameDay, isBefore } from 'date-fns';
import TaskItem from './TaskItem';
import { fetchGoogleEvents } from '@/lib/calendar-actions';
import { getAlarms } from '@/lib/alarm-actions';
import { Box, Typography, IconButton, Paper, Container, Badge } from '@mui/material';
import { ArrowBackIosNew, ArrowForwardIos, History as HistoryIcon, ReportProblem as WarningIcon } from '@mui/icons-material';
import { AnimatePresence, motion } from 'framer-motion';

export interface TaskLocal {
  id: string;
  title: string;
  // Event (Google)
  startTime?: string | Date;
  endTime?: string | Date;
  // Task (DB)
  startDate?: string | Date;
  deadline?: string | Date;
  progress?: number;
  maxProgress?: number;
  
  color?: string;
  memo?: string;
  type?: string; 
}

// --- DayColumn Component ---
const DayColumn = ({ 
    date, 
    tasks, 
    onEditTask,
    isHeaderVisible
}: { 
    date: Date, 
    tasks: TaskLocal[], 
    onEditTask?: (task: TaskLocal) => void;
    isHeaderVisible?: boolean;
}) => {
    
    // Filter Tasks for this day
    const dayStart = startOfDay(date);
    const dayEnd = addHours(dayStart, 24);

    const dayTasks = tasks.filter(task => {
        // Event logic: must have startTime
        const tStart = task.startTime ? new Date(task.startTime) : null;
        const tEnd = task.endTime ? new Date(task.endTime) : null;
        
        if (!tStart) return false;

        // Simple overlap logic: check if it overlaps with the day
        if (tEnd && (tEnd <= dayStart || tStart >= dayEnd)) return false;
        if (!tEnd && (tStart < dayStart || tStart >= dayEnd)) return false; // Point events

        return true;
    });

    // Sort by start time
    dayTasks.sort((a, b) => {
        const tA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const tB = b.startTime ? new Date(b.startTime).getTime() : 0;
        return tA - tB;
    });

    const deadlineTasks = tasks.filter(task => {
        // Task logic: must have deadline
        if (!task.deadline) return false;
        
        // Filter out if deadline is strictly before the current date's start (00:00)
        // User said "before the timetable date". 
        // If date is Today (10th), and deadline was 9th, hide it.
        // If deadline is 10th 10:00, show it.
        
        const d = new Date(task.deadline);
        // We compare against dayStart which is set to 00:00 of the view date.
        // Actually, let's use dayStart for strict comparison.
        if (d < dayStart) return false;

        // "Start Date after the TimeTable Day should not be displayed"
        // If task.startDate exists and is strictly after the end of this day, hide it.
        if (task.startDate) {
            const s = new Date(task.startDate);
            // dayEnd is 24 hours after dayStart (so start of next day)
            // If start date is >= dayEnd, it is in the future relative to this view.
            if (s >= dayEnd) return false;
        }

        return true;
    });

    // Sort Deadline Tasks:
    // 1. Incomplete first
    // 2. Deadline soonest
    deadlineTasks.sort((a, b) => {
        const isDoneA = (a.progress || 0) >= (a.maxProgress || 100);
        const isDoneB = (b.progress || 0) >= (b.maxProgress || 100);
        
        if (isDoneA !== isDoneB) return isDoneA ? 1 : -1; // Done goes to bottom
        
        const dA = a.deadline ? new Date(a.deadline).getTime() : 0;
        const dB = b.deadline ? new Date(b.deadline).getTime() : 0;
        return dA - dB;
    });

    if (dayTasks.length === 0 && deadlineTasks.length === 0) {
        return (
            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body1">No tasks for today.</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ px: 2, pb: 2, pt: isHeaderVisible ? 0.2 : 2, height: '100%', overflowY: 'auto' }}>
            <AnimatePresence mode='popLayout'>
                {dayTasks.map(task => (
                    <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                    >
                        <TaskItem 
                            task={task} 
                            viewDate={date}
                            onClick={(t) => (onEditTask) ? onEditTask(task) : null}
                        />
                    </motion.div>
                ))}
            </AnimatePresence>
            
            {deadlineTasks.length > 0 && (
                <Box sx={{ mt: 3, pt: 2, borderTop: 2, borderColor: 'divider' }}>
                    <AnimatePresence mode='popLayout'>
                        {deadlineTasks.map(task => (
                            <motion.div
                                key={task.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                            >
                                <TaskItem 
                                    task={task} 
                                    viewDate={date}
                                    onClick={(t) => (onEditTask) ? onEditTask(task) : null}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </Box>
            )}
        </Box>
    );
};

// Update props to include onEditAlarm
// Though onEditTask handles generic tasks/events, we should ensure it passes the type correctly.
// Actually, TaskLocal has 'type', so generic handler is fine?
// Let's see how page.tsx handles it. page.tsx handles `handleTaskClick`.
// If task has deadline -> DETAIL_TASK, else DETAIL_EVENT.
// We need to differentiate ALARM.

export default function TimeTable({ 
    date,
    onNewTask,
    onEditTask,
    refreshTrigger
}: { 
    date: Date;
    onNewTask?: (startTime?: string) => void;
    onEditTask?: (task: TaskLocal) => void;
    refreshTrigger?: number;
}) {
  const [tasks, setTasks] = useState<TaskLocal[]>([]);
  const [googleEvents, setGoogleEvents] = useState<TaskLocal[]>([]);
  
  const allTasks = [...tasks, ...googleEvents];
  
  const [isClient, setIsClient] = useState(false);
  const [now, setNow] = useState(new Date());
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setNow(new Date());
    
    // Update 'now' every minute to keep UI fresh
    const timer = setInterval(() => setNow(new Date()), 60000);
    
    fetchTasks();
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
      if (isClient) {
          fetchTasks();
          loadGoogleEvents(); // Also reload events on refreshTrigger
      }
  }, [refreshTrigger, isClient]);

  const fetchTasks = async () => {
    try {
        const res = await fetch('/api/tasks');
        if (res.ok) {
            const data = await res.json();
            setTasks(data);
        }
    } catch(e) { console.error(e) }
  };

  const loadGoogleEvents = async () => {
      // Load events and alarms around the current date
      const start = subDays(date, 7);
      const end = addDays(date, 7);
      try {
          const eventsPromise = fetchGoogleEvents(start, end);
          const alarmsPromise = getAlarms(start, end); // Fetch alarms

          const [events, alarms] = await Promise.all([eventsPromise, alarmsPromise]);
          
          setGoogleEvents([...(events as TaskLocal[]), ...(alarms as TaskLocal[])]); // Merge arrays
      } catch (e) {
          console.error("Failed to load events/alarms", e);
      }
  };

  useEffect(() => {
      if (isClient) {
          loadGoogleEvents();
      }
  }, [date, isClient]);

  // --- Logic for History & Sub-Header ---
  const isToday = isSameDay(date, now);
  
  // Identify "History" items: Alarms/Events where end time < now.
  const dayStart = startOfDay(date);
  const dayEnd = addHours(dayStart, 24);
  
  const eventsForToday = allTasks.filter(task => {
      const tStart = task.startTime ? new Date(task.startTime) : null;
      if (!tStart) return false;
      
      const tEnd = task.endTime ? new Date(task.endTime) : null;
      if (tEnd && (tEnd <= dayStart || tStart >= dayEnd)) return false;
      if (!tEnd && (tStart < dayStart || tStart >= dayEnd)) return false;
      return true;
  });

  const historyItems = eventsForToday.filter(task => {
      // Is it past?
      const tEnd = task.endTime ? new Date(task.endTime) : (task.startTime ? new Date(task.startTime) : null);
      if (!tEnd) return false;
      return tEnd < now;
  });

  // Count hidden items (if we are strictly hiding them, these are the ones that WOULd be hidden if toggle is off)
  // The badge should show how many are hidden.
  // If showHistory is true, none are hidden -> 0?
  // User: "何件の非表示カードがあるか" -> "How many hidden cards there are".
  // So if showHistory is true, items are visible, so 0 hidden?
  // But maybe user wants "How many past items there are" regardless?
  // Usually "Hidden count" implies current state.
  // I will show `historyItems.length` if `!showHistory`. If `showHistory`, I'll show 0 or hide badge.
  const hiddenCount = (!showHistory) ? historyItems.length : 0;
  
  // Warning logic: "24時間以内締切のタスクがある場合"
  // Exclude completed tasks (progress >= maxProgress)
  // Only show on "Today"
  // Warning logic: "24時間以内締切のタスクがある場合"
  // Exclude completed tasks (progress >= maxProgress)
  // Only show on "Today"
  let triggerTaskName = "";
  let triggerDebug = "";

  const hasDeadlineWarning = isToday && tasks.some(task => {
      if (!task.deadline) return false;
      
      const p = typeof task.progress === 'number' ? task.progress : Number(task.progress || 0);
      const max = typeof task.maxProgress === 'number' ? task.maxProgress : Number(task.maxProgress || 100);
      
      // Float safe comparison (epsilon 0.01)
      const isDone = p >= (max - 0.01);

      if (isDone) return false;

      const d = new Date(task.deadline);
      const limit = addHours(now, 24);
      
      const inRange = d >= now && d <= limit;
      if (inRange) {
          triggerTaskName = task.title;
          triggerDebug = `P:${p}/${max}`;
          console.log(`[Warning Trigger] Task: ${task.title}, Deadline: ${d.toLocaleString()}, Progress: ${p}/${max}`);
      }
      return inRange; 
  });

  // Filter tasks passed to DayColumn
  const visibleTasks = isToday && !showHistory 
    ? allTasks.filter(task => {
        // Exclude history items
        if (historyItems.includes(task)) return false; 
        return true;
    })
    : allTasks;

  if (!isClient) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header Bar - only render if needed to avoid whitespace */}
        {/* Header Bar - only render if needed to avoid whitespace */}
        {(hasDeadlineWarning || (isToday && historyItems.length > 0)) && (
        <Box sx={{ 
            px: 2, 
            py: 0.5, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            minHeight: 44
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                {hasDeadlineWarning && (
                     <>
                        <WarningIcon color="error" sx={{ mr: 1, flexShrink: 0 }} />
                        <Typography variant="body2" color="error" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
                            今日までのタスクがあります
                        </Typography>
                     </>
                )}
            </Box>

            {/* History Toggle - Only show on Today and if there are history items */}
            {isToday && historyItems.length > 0 && (
                <IconButton 
                    onClick={() => setShowHistory(!showHistory)} 
                    color={showHistory ? 'primary' : 'default'}
                    sx={{ p: 0.5 }}
                >
                    <Badge badgeContent={hiddenCount} sx={{ '& .MuiBadge-badge': { bgcolor: '#9acd32', color: 'white', transform: 'scale(0.8) translate(50%, -50%)', transformOrigin: '100% 0%' } }}>
                        <HistoryIcon />
                    </Badge>
                </IconButton>
            )}
        </Box>
        )}

        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
             <DayColumn 
                date={date} 
                tasks={visibleTasks} 
                onEditTask={onEditTask} 
                isHeaderVisible={!!(hasDeadlineWarning || (isToday && historyItems.length > 0))}
             />
        </Box>
    </Box>
  );
}
