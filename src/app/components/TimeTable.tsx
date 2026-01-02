'use client';

import { useState, useEffect } from 'react';
import { addHours, startOfDay, format, addDays, subDays, isSameDay, isBefore } from 'date-fns';
import TaskItem from './TaskItem';

import { Box, Typography, IconButton, Paper, Container, Badge, CircularProgress } from '@mui/material';
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
    isLoading,
    // New props for sub-header
    hasDeadlineWarning,
    showHistory,
    onToggleHistory,
    hiddenCount,
    isToday,
    // Expired Tasks Banner Props
    expiredCount,
    onOpenExpired
}: { 
    date: Date, 
    tasks: TaskLocal[], 
    onEditTask?: (task: TaskLocal) => void;
    isLoading?: boolean;
    hasDeadlineWarning?: boolean;
    showHistory?: boolean;
    onToggleHistory?: () => void;
    hiddenCount?: number;
    isToday?: boolean;
    expiredCount?: number;
    onOpenExpired?: () => void;
}) => {
    
    // ... (existing filter code)
    const dayStart = addHours(startOfDay(date), 4);
    const dayEnd = addHours(dayStart, 24);

    const dayTasks = tasks.filter(task => { // ... existing filter logic
        // Event logic: must have startTime
        const tStart = task.startTime ? new Date(task.startTime) : null;
        const tEnd = task.endTime ? new Date(task.endTime) : null;
        
        if (!tStart) return false;

        // Simple overlap logic: check if it overlaps with the day
        if (tEnd && (tEnd <= dayStart || tStart >= dayEnd)) return false;
        if (!tEnd && (tStart < dayStart || tStart >= dayEnd)) return false; // Point events

        return true;
    });

    // ... (existing sort code)
     dayTasks.sort((a, b) => {
        const tA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const tB = b.startTime ? new Date(b.startTime).getTime() : 0;
        return tA - tB;
    });

    const deadlineTasks = tasks.filter(task => { // ... existing filter logic
        if (!task.deadline) return false;
        const d = new Date(task.deadline);
        if (d < dayStart) return false;
        if (task.startDate) {
            const s = new Date(task.startDate);
            if (s >= dayEnd) return false;
        }
        return true;
    });

    // ... (existing sort code)
    deadlineTasks.sort((a, b) => {
        const isDoneA = (a.progress || 0) >= (a.maxProgress || 100);
        const isDoneB = (b.progress || 0) >= (b.maxProgress || 100);
        if (isDoneA !== isDoneB) return isDoneA ? 1 : -1; 
        const dA = a.deadline ? new Date(a.deadline).getTime() : 0;
        const dB = b.deadline ? new Date(b.deadline).getTime() : 0;
        return dA - dB;
    });

    if (dayTasks.length === 0 && deadlineTasks.length === 0 && !hasDeadlineWarning && !(isToday && (hiddenCount || 0) > 0) && !(expiredCount && expiredCount > 0)) {
        if (isLoading) {
            return (
                <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                    <CircularProgress />
                </Box>
            );
        }
        return (
            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body1">No tasks for today.</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ px: 2, pb: 2, pt: 2, height: '100%', overflowY: 'auto' }}>
            {/* Header / Warning Section inside scrollable area */}
            
            {/* Expired Tasks Banner - Only if expired tasks exist */}
            {expiredCount !== undefined && expiredCount > 0 && (
                 <Box 
                    sx={{ 
                        mb: 1, 
                        display: 'flex', 
                        alignItems: 'center', 
                        cursor: 'pointer',
                        bgcolor: '#fff5f5', // Light red background like notification
                        p: 1,
                        borderRadius: 1,
                        border: 1,
                        borderColor: 'error.light',
                        '&:hover': { bgcolor: '#ffebee' }
                    }}
                    onClick={onOpenExpired}
                 >
                    <WarningIcon color="error" sx={{ mr: 1, fontSize: 20 }} />
                    <Typography variant="body2" color="error" sx={{ fontWeight: 'bold' }}>
                        期限切れタスクが{expiredCount}件あります
                    </Typography>
                    <ArrowForwardIos sx={{ ml: 'auto', fontSize: 14, color: 'error.main' }} />
                 </Box>
            )}

            {(hasDeadlineWarning || (isToday && (hiddenCount !== undefined || showHistory))) && (
                <Box sx={{ 
                    mb: 1,
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    minHeight: 20
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

                    {/* History Toggle - Only show on Today and if there are history items or we are showing them */}
                    {isToday && (
                        <IconButton 
                            onClick={onToggleHistory} 
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
            <Box sx={{ height: 100 }} />
        </Box>
    );
};

export default function TimeTable({ 
    date,
    onNewTask,
    onEditTask,
    refreshTrigger,
    expiredCount,
    onOpenExpired,
    googleEvents,
    tasks
}: { 
    date: Date;
    onNewTask?: (startTime?: string) => void;
    onEditTask?: (task: TaskLocal) => void;
    refreshTrigger?: number;
    expiredCount?: number;
    onOpenExpired?: () => void;
    googleEvents: TaskLocal[];
    tasks: TaskLocal[];
}) {
  const [isLoading, setIsLoading] = useState(false);
  
  const allTasks = [...tasks, ...googleEvents];
  
  const [isClient, setIsClient] = useState(false);
  const [now, setNow] = useState(new Date());
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setNow(new Date());
    
    // Update 'now' every minute to keep UI fresh
    const timer = setInterval(() => setNow(new Date()), 60000);
    
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
      // Internal fetching removed, relying on props
  }, [refreshTrigger, isClient]);

  // Internal fetchTasks removed


  // Internal Google Events fetching removed in favor of passed prop


  // Removed useEffect for loadGoogleEvents


  // --- Logic for History & Sub-Header ---
  
  // Identify "History" items: Alarms/Events where end time < now.
  const dayStart = addHours(startOfDay(date), 4);
  const dayEnd = addHours(dayStart, 24);

  // isToday means "now" is within this day's 4am-4am window
  const isToday = now >= dayStart && now < dayEnd;
  
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
  // If showHistory is true, items are visible, so 0 hidden?
  // User: "何件の非表示カードがあるか" -> "How many hidden cards there are".
  // So if showHistory is true, items are visible, so 0 hidden?
  // But maybe user wants "How many past items there are" regardless?
  // Actually, usually badge on the toggle means "items inside". 
  // If we hide them, "3" means "3 hidden items". If we show them, "3" means "3 past items shown"?
  // Let's stick to logic: hiddenCount is purely for badge.
  const hiddenCount = (!showHistory) ? historyItems.length : 0;
  
  // Warning logic: "24時間以内締切のタスクがある場合"
  // Exclude completed tasks (progress >= maxProgress)
  // Only show on "Today"
  // Only show on "Today"


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
          // Warning logic can be expanded here if needed
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
        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
             <DayColumn 
                date={date} 
                tasks={visibleTasks} 
                onEditTask={onEditTask} 
                isLoading={isLoading}
                // Props for Sub-header injection
                hasDeadlineWarning={hasDeadlineWarning}
                showHistory={showHistory}
                onToggleHistory={() => setShowHistory(!showHistory)}
                hiddenCount={hiddenCount}
                isToday={isToday && historyItems.length > 0} // Only show toggle if there are history items
                expiredCount={expiredCount}
                onOpenExpired={onOpenExpired}
             />
        </Box>
    </Box>
  );
}
