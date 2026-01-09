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
        const end = addDays(currentDate, FETCH_WINDOW_DAYS); 

        // API Call Params
        const params = new URLSearchParams({
            start: start.toISOString(),
            end: end.toISOString(),
        });

        // Independent Fetch Functions - return true if success, false if failed
        const fetchTasks = async (): Promise<boolean> => {
            try {
                const paramsStr = params.toString();
                let fetchedTasks: TaskLocal[] | null = null;
                let expired = 0;
                let taskSuccess = false;
                
                try {
                     const res = await fetch(`/api/tasks?${paramsStr}`);
                     if (res.ok) {
                         fetchedTasks = await res.json();
                         taskSuccess = true;
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

                // Check race condition
                if (currentRequestId !== requestIdRef.current) return false;

                // Update state ONLY if fetch successful to prevent clearing data on error
                if (fetchedTasks) {
                    setTasks(fetchedTasks);
                }
                setExpiredCount(expired);
                
                console.log(`[useTimeTableData] Tasks updated (Req #${currentRequestId}): ${fetchedTasks?.length}, Expired: ${expired}`);
                return taskSuccess;

            } catch (e) {
                console.error("Failed to fetch tasks wrapper", e);
                return false;
            }
        };

        const fetchAlarmsData = async (): Promise<boolean> => {
            try {
                const fetchedAlarms = await getAlarms(start, end);

                if (currentRequestId !== requestIdRef.current) return false;

                console.log(`[useTimeTableData] Alarms updated (Req #${currentRequestId}): ${fetchedAlarms.length}`);
                setAlarms(fetchedAlarms as TaskLocal[]);
                return true;
            } catch (e) {
                console.error("Failed to fetch alarms", e);
                return false;
            }
        };

        const fetchEvents = async (): Promise<boolean> => {
             // Google events logic
             try {
                const fetchedEvents = await fetchGoogleEvents(start, end);

                if (currentRequestId !== requestIdRef.current) return false;

                console.log(`[useTimeTableData] Events updated (Req #${currentRequestId}): ${fetchedEvents.length}`);
                setGoogleEvents(fetchedEvents as TaskLocal[]);
                return true;
            } catch (e) {
                 console.error("Failed to fetch events", e);
                 return false;
            }
        };

        // Execute all independent fetches
        Promise.allSettled([
            fetchTasks(),
            fetchAlarmsData(),
            fetchEvents()
        ]).then((results) => {
            if (currentRequestId !== requestIdRef.current) return;

            console.log(`[useTimeTableData] All settled #${currentRequestId}.`);
            setIsSyncing(false);
            setCacheRange({ start, end });
            setLastSyncedAt(new Date());
            
            // Check results
            let allSuccess = true;
            results.forEach((result, idx) => {
                const name = idx === 0 ? 'Tasks' : idx === 1 ? 'Alarms' : 'Events';
                if (result.status === 'rejected') {
                    console.error(`${name} promise rejected`, result.reason);
                    allSuccess = false;
                } else {
                    // result.value is boolean (true if success)
                    if (result.value === false) {
                        console.error(`${name} fetch returned failure`);
                        allSuccess = false;
                    }
                }
            });

            setFetchSuccess(allSuccess);
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
