import { useState, useRef, useEffect, useCallback } from 'react';
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
    const [items, setItems] = useState<TaskLocal[]>([]);
    const [expiredCount, setExpiredCount] = useState(0);
    
    // Sync Status States
    const [isSyncing, setIsSyncing] = useState(false);
    const [fetchSuccess, setFetchSuccess] = useState<boolean | null>(null);
    const [primaryAccountValid, setPrimaryAccountValid] = useState<boolean | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
    
    // Internal Cache & Refresh Logic
    const [cacheRange, setCacheRange] = useState<{ start: Date; end: Date } | null>(null);
    const prevTriggerRef = useRef(refreshTrigger);
    const [now, setNow] = useState(new Date());

    // 1. Check Account Status (On Mount & Refresh)
    useEffect(() => {
        checkPrimaryGoogleAccountStatus()
            .then(result => setPrimaryAccountValid(result.valid))
            .catch(() => setPrimaryAccountValid(false));
    }, [refreshTrigger]);

    // 2. Fetch Logic (Unified)
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
        
        // Define new window
        const start = subDays(currentDate, FETCH_WINDOW_DAYS);
        const end = addDays(currentDate, FETCH_WINDOW_DAYS);

        // API Call Params
        const params = new URLSearchParams({
            start: start.toISOString(),
            end: end.toISOString(),
        });

        try {
            // Parallel Fetching
            const [events, alarms, tasksRes, expired] = await Promise.all([
                fetchGoogleEvents(start, end),
                getAlarms(start, end),
                fetch(`/api/tasks?${params.toString()}`),
                getExpiredTaskCount()
            ]);

            let fetchedTasks: TaskLocal[] = [];
            if (tasksRes.ok) {
                fetchedTasks = await tasksRes.json();
            } else {
                console.error("Task fetch failed");
            }

            // Merge All
            const combined: TaskLocal[] = [
                ...(events as TaskLocal[]),
                ...(alarms as TaskLocal[]),
                ...fetchedTasks
            ];

            setItems(combined);
            setExpiredCount(expired);
            setCacheRange({ start, end });
            setLastSyncedAt(new Date());
            setFetchSuccess(true);

        } catch (e: any) {
            console.error("Failed to load timetable data", e);
            if (e?.message !== 'AUTH_ERROR' && !e?.message?.includes('AUTH_ERROR')) {
                 setFetchSuccess(false);
            }
            // Even if failed, we might want to keep old data or partial data? 
            // For now, let's assume fail means sync error state.
            setFetchSuccess(false);
        } finally {
            setIsSyncing(false);
        }
    }, [currentDate, refreshTrigger, cacheRange]);

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
