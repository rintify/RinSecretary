import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { addDays, subDays, differenceInMinutes } from 'date-fns';
import { fetchGoogleEvents, checkPrimaryGoogleAccountStatus } from '@/lib/calendar-actions';
import { getAlarms } from '@/lib/alarm-actions';
import { getExpiredTaskCount } from '@/lib/task-actions';
import { TaskLocal } from '../components/TimeTable';

const FETCH_WINDOW_DAYS = 7;
const BUFFER_DAYS = 2;

interface UseTimeTableDataOptions {
    currentDate: Date;
    refreshTrigger: number;
}

interface UseTimeTableDataReturn {
    items: TaskLocal[];
    expiredCount: number;
    isSyncing: boolean;
    lastSyncedAt: Date | null;
    isSyncedRecently: boolean;
    syncError: boolean;
    primaryAccountValid: boolean | null;
    refresh: () => void;
}

export function useTimeTableData({ currentDate, refreshTrigger }: UseTimeTableDataOptions): UseTimeTableDataReturn {
    // State for individual data sources
    const [googleEvents, setGoogleEvents] = useState<TaskLocal[]>([]);
    const [alarms, setAlarms] = useState<TaskLocal[]>([]);
    const [tasks, setTasks] = useState<TaskLocal[]>([]);
    
    const [expiredCount, setExpiredCount] = useState(0);
    
    // Sync Status States
    const [isSyncing, setIsSyncing] = useState(false);
    const [fetchSuccess, setFetchSuccess] = useState<boolean | null>(null);
    const [primaryAccountValid, setPrimaryAccountValid] = useState<boolean | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
    
    // Internal Cache & Refresh Logic
    const [cacheRange, setCacheRange] = useState<{ start: Date; end: Date } | null>(null);
    const prevTriggerRef = useRef(refreshTrigger);
    // Request ID to prevent race conditions
    const requestIdRef = useRef(0);
    const [now, setNow] = useState(new Date());

    // 1. Check Account Status (On Mount & Refresh)
    useEffect(() => {
        checkPrimaryGoogleAccountStatus()
            .then(result => setPrimaryAccountValid(result.valid))
            .catch(() => setPrimaryAccountValid(false));
    }, [refreshTrigger]);

    // 2. Fetch Logic (Unified)
    // 2. Fetch Logic (Unified but Progressive)
    const loadData = useCallback(async () => {
        const isForce = refreshTrigger !== prevTriggerRef.current;
        prevTriggerRef.current = refreshTrigger;

        // Check Buffer Cache
        if (!isForce && cacheRange) {
            const bufferStart = addDays(cacheRange.start, BUFFER_DAYS);
            const bufferEnd = subDays(cacheRange.end, BUFFER_DAYS);
            if (currentDate >= bufferStart && currentDate <= bufferEnd) {
                // Inside buffer, skip fetch
                return;
            }
        }

        setIsSyncing(true);
        requestIdRef.current += 1;
        const currentRequestId = requestIdRef.current;
        console.log(`[useTimeTableData] Load started #${currentRequestId}. Date: ${currentDate.toISOString()}`);
        
        // Define new window
        const start = subDays(currentDate, FETCH_WINDOW_DAYS);
        const end = addDays(currentDate, FETCH_WINDOW_DAYS); // Only fetch 7 days ahead for now as window

        // API Call Params
        const params = new URLSearchParams({
            start: start.toISOString(),
            end: end.toISOString(),
        });

        // Independent Fetch Functions
        const fetchTasks = async () => {
            try {
                // Fetch tasks and expired count in parallel but handle independent failures if possible
                // For now, keep them together but don't let expired count block tasks if we can help it?
                // Actually, let's just run them.
                const paramsStr = params.toString();
                
                // We use a separate try-catch for the fetch itself to ensure specific logging
                let fetchedTasks: TaskLocal[] = [];
                let expired = 0;
                
                try {
                     const res = await fetch(`/api/tasks?${paramsStr}`);
                     if (res.ok) {
                         fetchedTasks = await res.json();
                     } else {
                         console.error("Task fetch returned non-OK status");
                     }
                } catch (e) {
                    console.error("Task fetch network error", e);
                }
                
                try {
                    expired = await getExpiredTaskCount();
                } catch (e) {
                    console.error("Expired count fetch error", e);
                }

                // Update state regardless of requestId (allow race condition instead of no data)
                // We trust React state updates to be fast enough or user not to switch dates instantly 100 times.
                // If strict consistency is needed, we can re-introduce checks later.
                console.log(`[useTimeTableData] Setting tasks: ${fetchedTasks.length}, Expired: ${expired}`);
                setTasks(fetchedTasks);
                setExpiredCount(expired);
                
            } catch (e) {
                console.error("Failed to fetch tasks wrapper", e);
            }
        };

        const fetchAlarmsData = async () => {
            try {
                const fetchedAlarms = await getAlarms(start, end);
                console.log(`[useTimeTableData] Setting alarms: ${fetchedAlarms.length}`);
                setAlarms(fetchedAlarms as TaskLocal[]);
            } catch (e) {
                console.error("Failed to fetch alarms", e);
            }
        };

        const fetchEvents = async () => {
             // Google events logic
             try {
                const fetchedEvents = await fetchGoogleEvents(start, end);
                console.log(`[useTimeTableData] Setting events: ${fetchedEvents.length}`);
                setGoogleEvents(fetchedEvents as TaskLocal[]);
            } catch (e) {
                 console.error("Failed to fetch events", e);
                 // Don't rethrow to avoid Promise.allSettled rejection noise, just log.
            }
        };

        // Execute all independent fetches
        // We use Promise.allSettled to wait for everything to finish before setting isSyncing false,
        // but individual states update as they finish.
        Promise.allSettled([
            fetchTasks(),
            fetchAlarmsData(),
            fetchEvents()
        ]).then((results) => {
            if (currentRequestId !== requestIdRef.current) return;

            console.log(`[useTimeTableData] All settled #${currentRequestId}. items: ${googleEvents.length + alarms.length + tasks.length} (approx)`);
            setIsSyncing(false);
            setCacheRange({ start, end });
            setLastSyncedAt(new Date());
            
            // Determine success based on Events (as it's arguably the most fragile/external one) 
            // or if everything failed. 
            // For now, if events fail, we consider it a "Sync Error" usually (auth etc).
            const eventsResult = results[2];
            if (eventsResult.status === 'rejected') {
                 setFetchSuccess(false);
            } else {
                 setFetchSuccess(true);
            }
        });

    }, [currentDate, refreshTrigger, cacheRange]);

    // Merge items
    const items = useMemo(() => {
        return [
            ...googleEvents,
            ...alarms,
            ...tasks
        ];
    }, [googleEvents, alarms, tasks]);

    // 3. Trigger Load
    useEffect(() => {
        loadData();
    }, [loadData]);

    // 4. Update 'now' for sync status calculation
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const timeSinceSync = lastSyncedAt ? differenceInMinutes(now, lastSyncedAt) : 999;
    const isSyncedRecently = fetchSuccess === true && primaryAccountValid === true && timeSinceSync < 5;
    const syncError = fetchSuccess === false || primaryAccountValid === false;

    return {
        items,
        expiredCount,
        isSyncing,
        lastSyncedAt,
        isSyncedRecently,
        syncError,
        primaryAccountValid,
        refresh: loadData
    };
}
