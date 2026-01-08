'use client';

import { useState, useRef, useEffect } from 'react';
import { addDays, subDays, differenceInMinutes } from 'date-fns';
import { fetchGoogleEvents, checkPrimaryGoogleAccountStatus } from '@/lib/calendar-actions';
import { getAlarms } from '@/lib/alarm-actions';
import { TaskLocal } from '../components/TimeTable';

const FETCH_WINDOW_DAYS = 7;
const BUFFER_DAYS = 2;

interface UseCalendarDataOptions {
    currentDate: Date;
    refreshTrigger: number;
}

interface UseCalendarDataReturn {
    googleEvents: TaskLocal[];
    isSyncing: boolean;
    lastSyncedAt: Date | null;
    isSyncedRecently: boolean;
    syncError: boolean;
    primaryAccountValid: boolean | null;
    refresh: () => void;
}

export function useCalendarData({ currentDate, refreshTrigger }: UseCalendarDataOptions): UseCalendarDataReturn {
    const [googleEvents, setGoogleEvents] = useState<TaskLocal[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [calendarFetchSuccess, setCalendarFetchSuccess] = useState<boolean | null>(null);
    const [primaryAccountValid, setPrimaryAccountValid] = useState<boolean | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
    const [now, setNow] = useState(new Date());
    
    const [calendarCacheRange, setCalendarCacheRange] = useState<{ start: Date; end: Date } | null>(null);
    const prevTriggerRef = useRef(refreshTrigger);

    // Check primary Google account status
    useEffect(() => {
        checkPrimaryGoogleAccountStatus().then(result => {
            setPrimaryAccountValid(result.valid);
        }).catch(() => {
            setPrimaryAccountValid(false);
        });
    }, [refreshTrigger]);

    const loadEvents = async () => {
        const isForce = refreshTrigger !== prevTriggerRef.current;
        prevTriggerRef.current = refreshTrigger;

        const inRange = calendarCacheRange && 
            currentDate > addDays(calendarCacheRange.start, BUFFER_DAYS) && 
            currentDate < subDays(calendarCacheRange.end, BUFFER_DAYS);

        if (!isForce && inRange && googleEvents.length > 0 && calendarFetchSuccess === true) {
            return;
        }

        setIsSyncing(true);
        const start = subDays(currentDate, FETCH_WINDOW_DAYS);
        const end = addDays(currentDate, FETCH_WINDOW_DAYS);
        
        try {
            const eventsPromise = fetchGoogleEvents(start, end);
            const alarmsPromise = getAlarms(start, end);

            const [events, alarms] = await Promise.all([eventsPromise, alarmsPromise]);
            setGoogleEvents([...(events as TaskLocal[]), ...(alarms as TaskLocal[])]);
            setLastSyncedAt(new Date());
            setCalendarFetchSuccess(true);
            setCalendarCacheRange({ start, end });
        } catch (e: any) {
            if (e?.message !== 'AUTH_ERROR' && !e?.message?.includes('AUTH_ERROR')) {
                console.error("Failed to load events/alarms", e);
            }
            setCalendarFetchSuccess(false);
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        loadEvents();
    }, [currentDate, refreshTrigger]);

    // Update 'now' for sync status calculation
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const timeSinceSync = lastSyncedAt ? differenceInMinutes(now, lastSyncedAt) : 999;
    const isSyncedRecently = calendarFetchSuccess === true && primaryAccountValid === true && timeSinceSync < 5;
    const syncError = calendarFetchSuccess === false || primaryAccountValid === false;

    return {
        googleEvents,
        isSyncing,
        lastSyncedAt,
        isSyncedRecently,
        syncError,
        primaryAccountValid,
        refresh: loadEvents,
    };
}
