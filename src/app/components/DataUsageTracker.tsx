'use client';

import { useEffect, useRef } from 'react';
import { format } from 'date-fns';

const LEGACY_STORAGE_KEY = 'rin_data_usage_history';
// New key pattern: rin_data_usage_log_{YYYY-MM-DD}
const getDailyKey = (date: Date) => `rin_data_usage_log_${format(date, 'yyyy-MM-dd')}`;

export default function DataUsageTracker() {
  const observerRef = useRef<PerformanceObserver | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleEntries = (entries: PerformanceObserverEntryList) => {
      let addedBytes = 0;
      entries.getEntries().forEach((entry) => {
        if (entry.entryType === 'resource') {
          const resourceEntry = entry as PerformanceResourceTiming;
          if (resourceEntry.transferSize > 0) {
            addedBytes += resourceEntry.transferSize;
          }
        }
      });

      if (addedBytes > 0) {
        updateUsage(addedBytes);
      }
    };

    try {
      if (PerformanceObserver.supportedEntryTypes.includes('resource')) {
        observerRef.current = new PerformanceObserver(handleEntries);
        // Observe resource (images, css, scripts, etc.) and navigation (doc itself)
        // Note: 'navigation' might be needed to capture the initial page load size efficiently
        observerRef.current.observe({ type: 'resource', buffered: true });
        // Optional: observe 'navigation' entry type if supported for main doc size
      }
    } catch (e) {
      console.warn('Data Usage Tracker failed to initialize', e);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return null;
}

function updateUsage(bytes: number) {
  try {
    const now = new Date();
    const todayKey = getDailyKey(now);
    
    // 5-minute interval index (0 - 287)
    const minutes = now.getHours() * 60 + now.getMinutes();
    const intervalIndex = Math.floor(minutes / 5);
    
    // Load existing data for today
    const storageData = localStorage.getItem(todayKey);
    // Data is an array of 288 integers (bytes per 5-min slot)
    let dailyLog: number[] = [];
    
    if (storageData) {
        dailyLog = JSON.parse(storageData);
    }
    
    // Initialize if empty or incorrect length
    if (!Array.isArray(dailyLog) || dailyLog.length !== 288) {
        dailyLog = new Array(288).fill(0);
        // Attempt to migrate execution (not doing strictly, just start fresh for simplicity/robustness)
    }
    
    dailyLog[intervalIndex] = (dailyLog[intervalIndex] || 0) + bytes;
    
    localStorage.setItem(todayKey, JSON.stringify(dailyLog));

    // Also update legacy total for backward compat or easy daily total access?
    // Let's keep it simple and just use the new log for everything. 
    // But we might want to store a "Daily Total" separately if calculating from 288 items is heavy?
    // 288 items is tiny. No problem.

    // Update legacy key as well for now, to not break the view immediately until we update the modal
    // ACTUALLY: The modal edit is next, so we can ignore legacy key logic now.
    
  } catch (error) {
    console.error('Failed to update data usage:', error);
  }
}
