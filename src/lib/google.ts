import { google } from 'googleapis';
import { prisma } from './prisma';

export async function getGoogleCalendarEvents(userId: string, timeMin: Date, timeMax: Date) {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId: userId,
        provider: 'google',
      },
    });

    if (!account) {
      console.error('getGoogleCalendarEvents: Account not found for user', userId);
      return [];
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

  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    return [];
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
