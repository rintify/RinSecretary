import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { addDays, subDays } from 'date-fns';
import { fetchGoogleEvents } from '@/lib/calendar-actions';

import { TaskLocal } from '../components/TimeTable';

interface UseDayDataOptions {
    date: Date;
    refreshTrigger: number | { timestamp: number; force: boolean };
}

interface UseDayDataReturn {
    tasks: TaskLocal[];
    isLoading: boolean;
    error: boolean;
    refresh: () => void;
    sourceTimestamp: {
        events: { server: number | null; client: number | null } | null;
        tasks: number | null;
        alarms: number | null;
    };
}

export function useDayData({ date, refreshTrigger }: UseDayDataOptions): UseDayDataReturn {
    const [googleEvents, setGoogleEvents] = useState<TaskLocal[]>([]);
    const [alarms, setAlarms] = useState<TaskLocal[]>([]);
    const [dbTasks, setDbTasks] = useState<TaskLocal[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    
    const [sourceTimestamp, setSourceTimestamp] = useState<{
        events: { server: number | null; client: number | null } | null;
        tasks: number | null;
        alarms: number | null;
    }>({ events: null, tasks: null, alarms: null });
    
    // Request ID to prevent race conditions
    const requestIdRef = useRef(0);

    // Use primitive keys for dependencies to avoid infinite loops on new Date objects
    const dateKey = date.getTime();
    
    // Parse trigger
    const triggerValue = typeof refreshTrigger === 'number' ? refreshTrigger : refreshTrigger.timestamp;
    const isForceRefresh = typeof refreshTrigger === 'object' && refreshTrigger.force;

    const loadData = useCallback(async () => {
        setIsLoading(true);
        requestIdRef.current += 1;
        const currentRequestId = requestIdRef.current;
        
        // Reconstruct date from key
        const d = new Date(dateKey);
        const start = new Date(d);
        start.setHours(4, 0, 0, 0);
        const end = addDays(start, 1);

        // API Call Params
        const params = new URLSearchParams({
            start: start.toISOString(),
            end: end.toISOString(),
        });

        const fetchTasks = async (): Promise<boolean> => {
            try {
                const paramsStr = params.toString();
                const res = await fetch(`/api/tasks?${paramsStr}`);
                if (res.ok) {
                    const fetchedTasks = await res.json();
                    if (currentRequestId === requestIdRef.current) {
                        setDbTasks(fetchedTasks);
                        setSourceTimestamp(prev => ({ ...prev, tasks: Date.now() }));
                    }
                    return true;
                }
                return false;
            } catch (e) {
                console.error("Task fetch error", e);
                return false;
            }
        };

        const fetchAlarmsData = async (): Promise<boolean> => {
            try {
                const paramsStr = params.toString();
                const res = await fetch(`/api/alarms?${paramsStr}`);
                
                if (res.ok) {
                    const fetchedAlarms = await res.json();
                    if (currentRequestId === requestIdRef.current) {
                        setAlarms(fetchedAlarms);
                        setSourceTimestamp(prev => ({ ...prev, alarms: Date.now() }));
                    }
                    return true;
                }
                return false;
            } catch (e) {
                console.error("Alarm fetch error", e);
                return false;
            }
        };

        const fetchEvents = async (): Promise<boolean> => {
             try {
                const result = await fetchGoogleEvents(start, end, isForceRefresh);
                if (currentRequestId === requestIdRef.current) {
                    setGoogleEvents(result.events as TaskLocal[]);
                    // Only update timestamp if we get a valid one
                    if (result.fetchedAt > 0) {
                        setSourceTimestamp(prev => ({ 
                            ...prev, 
                            events: { 
                                server: result.fetchedAt, 
                                client: Date.now() 
                            } 
                        }));
                    }
                }
                return true;
            } catch (e) {
                 console.error("Event fetch error", e);
                 return false;
            }
        };

        Promise.allSettled([
            fetchTasks(),
            fetchAlarmsData(),
            fetchEvents()
        ]).then((results) => {
            if (currentRequestId !== requestIdRef.current) return;
            
            setIsLoading(false);
            
            // If any failed, mark as error
            const hasError = results.some(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value));
            setError(hasError);
        });

    }, [dateKey, triggerValue, isForceRefresh]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const items = useMemo(() => {
        return [
            ...googleEvents,
            ...alarms,
            ...dbTasks
        ];
    }, [googleEvents, alarms, dbTasks]);

    return {
        tasks: items,
        isLoading,
        error,
        refresh: loadData,
        sourceTimestamp // Expose source timestamp
    };
}
