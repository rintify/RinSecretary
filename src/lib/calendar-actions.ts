'use server';

import { devAuth as auth } from '@/lib/dev-auth';
import { getGoogleCalendarEvents } from './google';
import { subDays, addDays } from 'date-fns';
import { prisma } from './prisma';

// メインアカウントの認証状態をチェック
export async function checkPrimaryGoogleAccountStatus(): Promise<{ valid: boolean; email?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { valid: false };
    }

    const userId = session.user.id;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
    });

    const accounts = await prisma.account.findMany({
        where: { userId, provider: 'google' }
    });

    if (!accounts || accounts.length === 0) {
        return { valid: false };
    }

    // メインアカウント（ユーザーのメールと一致するもの）を探す
    for (const account of accounts) {
        if (!account.access_token) continue;
        
        let accessToken = account.access_token;
        
        try {
            let res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            // トークン期限切れの場合、リフレッシュを試みる
            if (!res.ok && res.status === 401 && account.refresh_token) {
                console.log('checkPrimaryGoogleAccountStatus: Access token expired, attempting refresh for account', account.id);
                try {
                    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            client_id: process.env.GOOGLE_CLIENT_ID!,
                            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                            refresh_token: account.refresh_token,
                            grant_type: 'refresh_token'
                        })
                    });
                    
                    if (refreshRes.ok) {
                        const tokens = await refreshRes.json();
                        accessToken = tokens.access_token;
                        
                        // DBに新しいトークンを保存
                        await prisma.account.update({
                            where: { id: account.id },
                            data: {
                                access_token: tokens.access_token,
                                expires_at: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : undefined,
                            }
                        });
                        
                        // リフレッシュしたトークンで再試行
                        res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                            headers: { Authorization: `Bearer ${accessToken}` }
                        });
                    }
                } catch (refreshError) {
                    console.error('checkPrimaryGoogleAccountStatus: Token refresh failed for account', account.id, refreshError);
                }
            }
            
            if (res.ok) {
                const data = await res.json();
                if (data.email && user?.email && data.email.toLowerCase() === user.email.toLowerCase()) {
                    // メインアカウントが有効
                    return { valid: true, email: data.email };
                }
            }
        } catch (e) {
            console.error('checkPrimaryGoogleAccountStatus: check failed for account', account.id);
        }
    }

    // メインアカウントが見つからないか認証が無効
    return { valid: false };
}

// Simple in-memory cache
interface CacheEntry {
    events: any[];
    fetchedAt: number;
    rangeStart: number;
    rangeEnd: number;
}
const eventCache = new Map<string, CacheEntry>();
// 5 minutes
const CACHE_TTL = 5 * 60 * 1000; 
console.log('calendar-actions: Cache initialized/cleared');

export async function fetchGoogleEvents(start: Date, end: Date, forceRefresh: boolean = false) {
  const session = await auth();
  if (!session?.user?.id) {
    console.error('fetchGoogleEvents: No session or user ID');
    return { events: [], fetchedAt: 0 };
  }
  const userId = session.user.id;

  // Check cache
  const now = Date.now();
  const cached = eventCache.get(userId);
  // Ensure Date objects (Next.js serialization/deserialization safety)
  const reqStart = new Date(start).getTime();
  const reqEnd = new Date(end).getTime();

  if (!forceRefresh && cached) {
      const age = now - cached.fetchedAt;
      const coversRange = cached.rangeStart <= reqStart && cached.rangeEnd >= reqEnd;
      
      if (age < CACHE_TTL && coversRange) {
          // console.log(`fetchGoogleEvents: Serving from cache for user ${userId}`);
          // Filter cached events for the requested specific range
          const filtered = mapEvents(cached.events.filter((e: any) => {
             const eStart = new Date(e.start.dateTime || e.start.date).getTime();
             const eEnd = new Date(e.end.dateTime || e.end.date).getTime();
             // Overlap logic
             return eEnd > reqStart && eStart < reqEnd;
          }));

          return { events: filtered, fetchedAt: cached.fetchedAt };
      }
  }

  // Cache miss or expired or out of range or forced -> Bulk Fetch
  // Fetch a larger window: requested range +/- 14 days 
  const fetchStart = subDays(start, 14);
  const fetchEnd = addDays(end, 14);

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
  const filtered = mapEvents(events.filter((e: any) => {
     const eStart = new Date(e.start.dateTime || e.start.date).getTime();
     const eEnd = new Date(e.end.dateTime || e.end.date).getTime();
     return eEnd > reqStart && eStart < reqEnd;
  }));

  return { events: filtered, fetchedAt: now };
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
