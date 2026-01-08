'use client';

import { useState, useEffect } from 'react';
import { TaskLocal } from '../components/TimeTable';
import { getExpiredTaskCount } from '@/lib/task-actions';

interface UseTaskDataOptions {
    currentDate: Date;
    refreshTrigger: number;
}

interface UseTaskDataReturn {
    tasks: TaskLocal[];
    expiredCount: number;
    refresh: () => void;
}

export function useTaskData({ currentDate, refreshTrigger }: UseTaskDataOptions): UseTaskDataReturn {
    const [tasks, setTasks] = useState<TaskLocal[]>([]);
    const [expiredCount, setExpiredCount] = useState(0);

    const fetchTasks = async () => {
        try {
            const res = await fetch('/api/tasks');
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (e) { 
            console.error("Failed to fetch tasks", e); 
        }
    };

    const fetchExpiredCount = async () => {
        try {
            const count = await getExpiredTaskCount();
            setExpiredCount(count);
        } catch (e) {
            console.error("Failed to fetch expired count", e);
        }
    };

    useEffect(() => {
        fetchTasks();
        fetchExpiredCount();
    }, [currentDate, refreshTrigger]);

    return {
        tasks,
        expiredCount,
        refresh: () => {
            fetchTasks();
            fetchExpiredCount();
        },
    };
}
