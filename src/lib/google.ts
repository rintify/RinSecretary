import { google } from 'googleapis';

import { prisma } from './prisma';
import { decode } from 'js-base64';

export async function getGoogleCalendarEvents(userId: string, timeMin: Date, timeMax: Date) {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId: userId,
        provider: 'google',
      },
    });

    if (!account) {
      console.warn('getGoogleCalendarEvents: Account not found for user', userId);
      // Treat missing account as auth error so UI shows red dot prompting to login
      throw new Error("AUTH_ERROR");
    }
    
    if (!account.access_token) {
        console.error('getGoogleCalendarEvents: No access token for account', account.id);
        return [];
    }

    console.log('getGoogleCalendarEvents: Using account', account.id, 'with expiration', account.expires_at);

    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    auth.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expiry_date: (account.expires_at || 0) * 1000,
    });

    // Auto-refresh token if needed
    // googleapis handles refresh automatically if refresh_token is present and valid
    // We should listen to credentials event to save new tokens if we want to be persistent
    // specificially for offline usage, but here for a quick request it might just work in memory
    // for the request duration.
    // However, to keep DB in sync:
    
    auth.on('tokens', async (tokens) => {
        if (tokens.access_token) {
            await prisma.account.update({
                where: { id: account.id },
                data: {
                    access_token: tokens.access_token,
                    expires_at: Math.floor((tokens.expiry_date || 0) / 1000),
                    refresh_token: tokens.refresh_token ?? account.refresh_token // Use new if provided, else keep old
                }
            });
        }
    });

    const calendar = google.calendar({ version: 'v3', auth });
    

    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items || [];

  } catch (error: any) {
    if (error?.message?.includes('invalid_grant')) {
      console.warn('getGoogleCalendarEvents: Invalid grant (token expired/revoked). Clearing account to force re-login.');
      await prisma.account.deleteMany({
        where: {
          userId: userId,
          provider: 'google',
        },
      });
      // Re-throw so UI knows it failed
      throw new Error("AUTH_ERROR");
    }
    console.error('Failed to fetch calendar events:', error);
    // For other errors, maybe we still want to throw? Or return empty?
    // Let's throw to be safe and show red dot for any fetch failure.
    throw error;
  }
}

export async function createGoogleCalendarEvent(userId: string, eventData: any) {
    try {
        const account = await prisma.account.findFirst({
            where: { userId, provider: 'google' }
        });
        if (!account?.access_token) return null;

        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
        const calendar = google.calendar({ version: 'v3', auth });

        const res = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: eventData
        });
        return res.data;
    } catch (e) {
        console.error('Failed to create GCal event', e);
        throw e;
    }
}

export async function updateGoogleCalendarEvent(userId: string, eventId: string, eventData: any) {
     try {
        const account = await prisma.account.findFirst({
            where: { userId, provider: 'google' }
        });
        if (!account?.access_token) return null;

        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
        const calendar = google.calendar({ version: 'v3', auth });

        const res = await calendar.events.update({
            calendarId: 'primary',
            eventId: eventId,
            requestBody: eventData
        });
        return res.data;
    } catch (e) {
        console.error('Failed to update GCal event', e);
        throw e;
    }
}

export async function deleteGoogleCalendarEvent(userId: string, eventId: string) {
     try {
        const account = await prisma.account.findFirst({
            where: { userId, provider: 'google' }
        });
        if (!account?.access_token) return null;

        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
        const calendar = google.calendar({ version: 'v3', auth });

        await calendar.events.delete({
            calendarId: 'primary',
            eventId: eventId,
        });
        return true;
    } catch (e) {
        console.error('Failed to delete GCal event', e);
        throw e;
    }
}

export async function getGmailMessages(userId: string, timeMin: Date) {
    try {
        const account = await prisma.account.findFirst({
            where: { userId, provider: 'google' }
        });

        if (!account?.access_token) {
             throw new Error("AUTH_ERROR");
        }

        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
        
        // Auto-refresh token hook (same as calendar)
        auth.on('tokens', async (tokens) => {
            if (tokens.access_token) {
                await prisma.account.update({
                    where: { id: account.id },
                    data: {
                        access_token: tokens.access_token,
                        expires_at: Math.floor((tokens.expiry_date || 0) / 1000),
                        refresh_token: tokens.refresh_token ?? account.refresh_token
                    }
                });
            }
        });

        const gmail = google.gmail({ version: 'v1', auth });

        // List messages
        // q parameter for filtering? 'category:primary' might be good to filter spam immediately but user asked for logic.
        // Let's just filter by time first.
        const res = await gmail.users.messages.list({
            userId: 'me',
            q: `after:${Math.floor(timeMin.getTime() / 1000)}`,
            maxResults: 50 // Limit to avoid hitting limits too hard
        });

        const messages = res.data.messages || [];
        if (messages.length === 0) return [];

        // Batch get details
        const emailDetails = await Promise.all(messages.map(async (msg) => {
             const detail = await gmail.users.messages.get({
                 userId: 'me',
                 id: msg.id!,
                 format: 'full'
             });
             
             const payload = detail.data.payload;
             const headers = payload?.headers;
             
             const from = headers?.find(h => h.name === 'From')?.value || 'Unknown';
             const subject = headers?.find(h => h.name === 'Subject')?.value || '(No Subject)';
             const date = headers?.find(h => h.name === 'Date')?.value;
             
             // Extract body
             let body = detail.data.snippet || '';
             // Try to find cleaner body if needed, but snippet is usually good enough for "broad" summary.
             // If we want more detail, we can decode parts.
             // Let's stick to snippet + a bit of body if possible.
             // Actually, snippet is safer for token limits. User asked for "contents", so maybe full body is better but heavy.
             // Let's try to get text/plain part.
             
             // Helper to find part
            const findBody = (parts: any[]): string => {
                for (const part of parts) {
                    if (part.mimeType === 'text/plain' && part.body?.data) {
                        return decode(part.body.data);
                    }
                    if (part.parts) {
                        const found = findBody(part.parts);
                        if (found) return found;
                    }
                }
                return '';
            };

            let fullBody = '';
            if (payload?.body?.data) {
                fullBody = decode(payload.body.data);
            } else if (payload?.parts) {
                fullBody = findBody(payload.parts);
            }
            
            // Fallback to snippet if fullBody is empty or too complex
            const content = fullBody || detail.data.snippet || '';

             return {
                 id: msg.id,
                 from,
                 subject,
                 date,
                 content: content.substring(0, 2000) // Truncate to safe limit per email
             };
        }));
        
        return emailDetails;

    } catch (e: any) {
        if (e?.message?.includes('invalid_grant')) {
             await prisma.account.deleteMany({
                where: { userId: userId, provider: 'google' }
            });
            throw new Error("AUTH_ERROR");
        }
        console.error("Failed to fetch gmail", e);
        throw e;
    }
}
