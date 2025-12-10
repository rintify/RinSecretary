'use server';

import { auth } from '@/auth';
import { getGoogleCalendarEvents } from './google';

export async function fetchGoogleEvents(start: Date, end: Date) {
  const session = await auth();
  if (!session?.user?.id) {
    console.error('fetchGoogleEvents: No session or user ID');
    return [];
  }

  console.log(`fetchGoogleEvents: Fetching for user ${session.user.id} from ${start} to ${end}`);
  const events = await getGoogleCalendarEvents(session.user.id, start, end);
  console.log(`fetchGoogleEvents: Found ${events.length} events`);
  
  // Map Google Events to Task format
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
    return await getGoogleLibs().deleteGoogleCalendarEvent(session.user.id, eventId);
}

// Lazy load to avoid circular deps if any (though google.ts matches)
function getGoogleLibs() {
    return require('./google');
}
