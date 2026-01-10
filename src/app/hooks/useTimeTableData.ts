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
    lastSyncedAt: {
        global: Date | null;
        events: Date | null;
        tasks: Date | null;
        alarms: Date | null;
    };
    isSyncedRecently: boolean;
    syncError: boolean;
    primaryAccountValid: boolean | null;
    refresh: () => void;
    updateSyncTimestamp: (key: 'events' | 'tasks' | 'alarms', ts: number) => void;
}

export function useTimeTableData({ currentDate, refreshTrigger }: UseTimeTableDataOptions): UseTimeTableDataReturn {
    
    const [expiredCount, setExpiredCount] = useState(0);
    
    // Sync Status States
    // We can still track "syncing" for the global checks if we want, 
    // or we can aggregate the "loading" states from children (which is harder).
    // For now, let's keep isSyncing false or derived from global checks.
    const [primaryAccountValid, setPrimaryAccountValid] = useState<boolean | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<{
        global: Date | null;
        events: Date | null;
        tasks: Date | null;
        alarms: Date | null;
    }>({ global: null, events: null, tasks: null, alarms: null });

    const updateSyncTimestamp = useCallback((key: 'events' | 'tasks' | 'alarms', ts: number) => {
        setLastSyncedAt(prev => {
            const date = new Date(ts);
            // Global is max of all
            const newTs = { ...prev, [key]: date };
            
            // Re-calculate global latest
            const dates = [newTs.events, newTs.tasks, newTs.alarms].filter(d => d !== null) as Date[];
            const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
            
            return { ...newTs, global: maxDate };
        });
    }, []);
    
    // 1. Check Account Status & Expired Count (On Mount & Refresh)
    useEffect(() => {
        checkPrimaryGoogleAccountStatus()
            .then(result => setPrimaryAccountValid(result.valid))
            .catch(() => setPrimaryAccountValid(false));

        getExpiredTaskCount()
            .then(count => setExpiredCount(count))
            .catch(e => console.error(e));
            
        setLastSyncedAt(prev => ({ ...prev, global: new Date() }));
            
    }, [refreshTrigger]);

    // Update 'now' for sync status calculation
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const timeSinceSync = lastSyncedAt.global ? differenceInMinutes(now, lastSyncedAt.global) : 999;
    
    // Note: We can't easily know if *child* fetches failed here without prop drilling callbacks.
    // For now, "Sync Error" in header will just reflect Auth status.
    // If the user wants red dot on child failure, we'd need a context or callback.
    // Let's stick to Auth status for now as per plan, "Red Dot in header might only reflect Global state".
    const isSyncedRecently = primaryAccountValid === true && timeSinceSync < 5;
    const syncError = primaryAccountValid === false;

    return {
        items: [], // Empty array as this hook no longer fetches items
        expiredCount,
        isSyncing: false, // We don't track child loading here anymore
        lastSyncedAt,
        isSyncedRecently,
        syncError,
        primaryAccountValid,
        refresh: () => {}, // Refresh is triggered by prop change down the tree
        updateSyncTimestamp
    };
}
