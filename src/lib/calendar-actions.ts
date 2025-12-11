'use server';

import { auth } from '@/auth';
import { getGoogleCalendarEvents } from './google';
import { subDays, addDays } from 'date-fns';

// Simple in-memory cache
interface CacheEntry {
    events: any[];
    fetchedAt: number;
    rangeStart: number;
    rangeEnd: number;
}
const eventCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 1000; // 1 minute

export async function fetchGoogleEvents(start: Date, end: Date) {
  const session = await auth();
  if (!session?.user?.id) {
    console.error('fetchGoogleEvents: No session or user ID');
    return [];
  }
  const userId = session.user.id;

  // Check cache
  const now = Date.now();
  const cached = eventCache.get(userId);
  const reqStart = start.getTime();
  const reqEnd = end.getTime();

  if (cached) {
      const age = now - cached.fetchedAt;
      const coversRange = cached.rangeStart <= reqStart && cached.rangeEnd >= reqEnd;
      
      if (age < CACHE_TTL && coversRange) {
          console.log(`fetchGoogleEvents: Serving from cache for user ${userId}`);
          // Filter cached events for the requested specific range
          return mapEvents(cached.events.filter((e: any) => {
             const eStart = new Date(e.start.dateTime || e.start.date).getTime();
             const eEnd = new Date(e.end.dateTime || e.end.date).getTime();
             // Overlap logic
             return eEnd > reqStart && eStart < reqEnd;
          }));
      }
  }

  // Cache miss or expired or out of range -> Bulk Fetch
  // Fetch a larger window: requested range +/- 45 days 
  const fetchStart = subDays(start, 45);
  const fetchEnd = addDays(end, 45);

  console.log(`fetchGoogleEvents: Fetching for user ${userId} from ${fetchStart} to ${fetchEnd} (Bulk)`);
  const events = await getGoogleCalendarEvents(userId, fetchStart, fetchEnd);
  console.log(`fetchGoogleEvents: Found ${events.length} events`);
  
  // Update Cache
  eventCache.set(userId, {
      events: events,
      fetchedAt: now,
      rangeStart: fetchStart.getTime(),
      rangeEnd: fetchEnd.getTime()
  });

  // Return filtered for current request
  return mapEvents(events.filter((e: any) => {
     const eStart = new Date(e.start.dateTime || e.start.date).getTime();
     const eEnd = new Date(e.end.dateTime || e.end.date).getTime();
     return eEnd > reqStart && eStart < reqEnd;
  }));
}

function mapEvents(events: any[]) {
  return events.map((event: any) => ({
    id: event.id,
    title: event.summary || '(No Title)',
    startTime: event.start.dateTime || event.start.date, // dateTime for timed, date for all-day
    endTime: event.end.dateTime || event.end.date,
    type: 'EVENT', // "SHIFT" is deprecated, now "EVENT"
    color: '#4285F4', // Google Blue
    memo: event.description,
  }));
}

export async function createGoogleEvent(data: any) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    
    // Invalidate Cache
    eventCache.delete(session.user.id);
    
    // Convert generic app data to GCal format
    const eventBody = {
        summary: data.title,
        description: data.memo,
        start: { dateTime: new Date(data.startTime).toISOString() },
        end: { dateTime: new Date(data.endTime).toISOString() },
    };
    return await getGoogleLibs().createGoogleCalendarEvent(session.user.id, eventBody);
}

export async function updateGoogleEvent(eventId: string, data: any) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Invalidate Cache
    eventCache.delete(session.user.id);

     const eventBody = {
        summary: data.title,
        description: data.memo,
        start: { dateTime: new Date(data.startTime).toISOString() },
        end: { dateTime: new Date(data.endTime).toISOString() },
    };
    return await getGoogleLibs().updateGoogleCalendarEvent(session.user.id, eventId, eventBody);
}

export async function deleteGoogleEvent(eventId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Invalidate Cache
    eventCache.delete(session.user.id);

    return await getGoogleLibs().deleteGoogleCalendarEvent(session.user.id, eventId);
}

// Lazy load to avoid circular deps if any (though google.ts matches)
function getGoogleLibs() {
    return require('./google');
}
