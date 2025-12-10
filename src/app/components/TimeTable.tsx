'use client';

import { useState, useEffect } from 'react';
import { addHours, startOfDay, format, addDays, subDays } from 'date-fns'; // removed unused imports
import TaskItem from './TaskItem';
import { fetchGoogleEvents } from '@/lib/calendar-actions';
import { Box, Typography, IconButton, Paper, Container } from '@mui/material';
import { ArrowBackIosNew, ArrowForwardIos } from '@mui/icons-material';

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
  
  color: string;
  memo?: string;
  type?: string; 
}

// --- DayColumn Component ---
const DayColumn = ({ 
    date, 
    tasks, 
    onEditTask
}: { 
    date: Date, 
    tasks: TaskLocal[], 
    onEditTask?: (task: TaskLocal) => void
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
        <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
            {dayTasks.map(task => (
                <TaskItem 
                    key={task.id} 
                    task={task} 
                    viewDate={date}
                    onClick={(t) => (onEditTask) ? onEditTask(task) : null}
                />
            ))}
            
            {deadlineTasks.length > 0 && (
                <Box sx={{ mt: 3, pt: 2, borderTop: 2, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" color="error" sx={{ mb: 1, fontWeight: 'bold' }}>
                        Tasks
                    </Typography>
                    {deadlineTasks.map(task => (
                        <TaskItem 
                            key={task.id} 
                            task={task} 
                            onClick={(t) => (onEditTask) ? onEditTask(task) : null}
                        />
                    ))}
                </Box>
            )}
        </Box>
    );
};

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

  useEffect(() => {
    setIsClient(true);
    fetchTasks();
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
      // Load events around the current date
      const start = subDays(date, 7);
      const end = addDays(date, 7);
      try {
          const events = await fetchGoogleEvents(start, end);
          setGoogleEvents(events as TaskLocal[]);
      } catch (e) {
          console.error("Failed to load google events", e);
      }
  };

  useEffect(() => {
      if (isClient) {
          loadGoogleEvents();
      }
  }, [date, isClient]);

  if (!isClient) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
             <DayColumn 
                date={date} 
                tasks={allTasks} 
                onEditTask={onEditTask} 
             />
        </Box>
    </Box>
  );
}

