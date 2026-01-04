import { google } from 'googleapis';

import { prisma } from './prisma';
import { decode } from 'js-base64';

// Helper to get the primary Google account (matching user email)
async function getPrimaryGoogleAccount(userId: string) {
    const accounts = await prisma.account.findMany({
        where: { userId, provider: 'google' }
    });
    
    if (!accounts || accounts.length === 0) return null;
    
    // If only one, just return it (saving API calls)
    if (accounts.length === 1) return accounts[0];

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
    });

    if (!user?.email) return accounts[0]; // Fallback

    // Check which account matches using tokens
    for (const account of accounts) {
        if (!account.access_token) continue;
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${account.access_token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.email && data.email.toLowerCase() === user.email.toLowerCase()) {
                    return account;
                }
            }
        } catch (e) {
            console.error('getPrimaryGoogleAccount: check failed for account', account.id);
        }
    }

    // Default to first if no match found (or all failed)
    return accounts[0];
}

export class AuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthError';
    }
}

export async function getGoogleCalendarEvents(userId: string, timeMin?: Date, timeMax?: Date) {
  try {
    const account = await getPrimaryGoogleAccount(userId);

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

    const calendar = google.calendar({ version: 'v3', auth });
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin?.toISOString(),
      timeMax: timeMax?.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items || [];

  } catch (error: any) {
    if (error?.message?.includes('invalid_grant')) {
      console.warn('getGoogleCalendarEvents: Invalid grant (token expired/revoked). Clearing account to force re-login.');
      // Logic for deleting account on auth error
      // Ideally we only delete if we are SURE which one caused it. 
      // With getPrimaryGoogleAccount, we retrieved specific `account`.
      // We should probably pass account ID to delete query if possible, or just re-fetch to delete.
      // But `account` variable scope is inside try... wait block.
      // Actually, error handling here assumes single account logic.
      // If we have multiple accounts, deleting ALL might be annoying.
      // Let's rely on the user to fix auth via settings if possible, or just throw AUTH_ERROR.
      // But old logic deleted it. Let's keep strict "clean up bad tokens" logic but maybe safer?
      // Since we don't have reference to `account` within catch block easily (unless we move definition out),
      // let's just throw AUTH_ERROR for now and let user handle in Google Settings.
      // Deleting automatically is aggressive if transient.
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
        const account = await getPrimaryGoogleAccount(userId);
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
        const account = await getPrimaryGoogleAccount(userId);
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
        const account = await getPrimaryGoogleAccount(userId);
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

export async function getGmailMessages(userId: string, timeMin: Date, timeMax?: Date) {
    try {
        const accounts = await prisma.account.findMany({
            where: { userId, provider: 'google' }
        });

        if (!accounts || accounts.length === 0) {
             throw new Error("AUTH_ERROR");
        }

        const allMessages: any[] = [];

        for (const account of accounts) {
            try {
                if (!account.access_token) continue;

                const auth = new google.auth.OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET
                );
                
                if (account.refresh_token) {
                    auth.setCredentials({ refresh_token: account.refresh_token });
                    try {
                        // Force token refresh to check validity
                        await auth.getAccessToken();
                    } catch (e: any) {
                        console.error("Token refresh failed", e);
                        throw new AuthError("Googleアカウントの認証が無効です。再ログインしてください。");
                    }
                } else {
                    console.error("No refresh token for user", userId);
                    // If no refresh token, we can't fetch.
                    // This might happen if user only logged in but didn't grant offline access or scope issue.
                    throw new AuthError("Googleアカウントのリフレッシュトークンがありません。再連携してください。");
                }

                // Auto-refresh token hook
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

                let query = `after:${Math.floor(timeMin.getTime() / 1000)}`;
                if (timeMax) {
                    query += ` before:${Math.floor(timeMax.getTime() / 1000)}`;
                }

                const res = await gmail.users.messages.list({
                    userId: 'me',
                    q: query,
                    maxResults: 50
                });

                const messages = res.data.messages || [];
                if (messages.length === 0) continue;

                // Batch get details
                const emailDetails = await Promise.all(messages.map(async (msg) => {
                     try {
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
                        
                        const content = fullBody || detail.data.snippet || '';

                        return {
                            id: msg.id,
                            from,
                            subject,
                            date,
                            content: content.substring(0, 2000)
                        };
                     } catch(e) {
                         console.error(`Failed to fetch message ${msg.id} for account ${account.id}`, e);
                         return null;
                     }
                }));
                
                allMessages.push(...emailDetails.filter(e => e !== null));

            } catch (e: any) {
                console.error(`Failed to fetch gmail for account ${account.id}`, e);
                if (e?.message?.includes('invalid_grant')) {
                    // Maybe we shouldn't delete immediately if transient, but consistency with old logic:
                     await prisma.account.delete({
                         where: { id: account.id }
                    });
                }
                // Continue to next account
            }
        }

        return allMessages;

    } catch (e: any) {
        // If critical outer error
        throw e;
    }
}

// Google Drive Functions

export async function findDriveFolder(userId: string, folderName: string, parentId?: string) {
    try {
        const account = await getPrimaryGoogleAccount(userId);
        if (!account?.access_token) return null;

        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
        const drive = google.drive({ version: 'v3', auth });

        let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
        if (parentId) {
            query += ` and '${parentId}' in parents`;
        }

        const res = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive',
        });

        if (res.data.files && res.data.files.length > 0) {
            return res.data.files[0];
        }
        return null;
    } catch (e: any) {
        console.error('Failed to find Drive folder', e);
        if (e?.message?.includes('invalid_grant')) {
             throw new Error("AUTH_ERROR"); // Re-throw auth error
        }
        return null; // Return null for other errors (e.g. not found)
    }
}

export async function createDriveFolder(userId: string, folderName: string, parentId?: string) {
    try {
        const account = await getPrimaryGoogleAccount(userId);
        if (!account?.access_token) return null;

        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
        const drive = google.drive({ version: 'v3', auth });

        const fileMetadata: any = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
        };
        if (parentId) {
            fileMetadata.parents = [parentId];
        }

        const res = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id',
        });

        return res.data;
    } catch (e) {
        console.error('Failed to create Drive folder', e);
        throw e;
    }
}

import { Stream } from 'stream';

export async function uploadToGoogleDrive(
    userId: string, 
    filename: string, 
    content: string | Buffer | Stream, 
    mimeType: string, 
    parentId?: string
) {
    try {
        const account = await getPrimaryGoogleAccount(userId);
        if (!account?.access_token) return null;

        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
        const drive = google.drive({ version: 'v3', auth });

        const fileMetadata: any = {
            name: filename,
        };
        if (parentId) {
            fileMetadata.parents = [parentId];
        }

        const media = {
            mimeType: mimeType,
            body: content,
        };

        const res = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id',
        });

        return res.data;
    } catch (e) {
        console.error('Failed to upload to Drive', e);
        throw e;
    }
}

export async function findDriveFile(userId: string, filename: string, parentId?: string) {
    try {
        const account = await getPrimaryGoogleAccount(userId);
        if (!account?.access_token) return null;

        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
        const drive = google.drive({ version: 'v3', auth });

        let query = `name='${filename}' and trashed=false`;
        if (parentId) {
            query += ` and '${parentId}' in parents`;
        } else {
            // If checking root or shared, might need broader query but usually parentId is key
        }

        const res = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive',
        });

        if (res.data.files && res.data.files.length > 0) {
            return res.data.files[0];
        }
        return null;
    } catch (e: any) {
        console.error('Failed to find Drive file', e);
         if (e?.message?.includes('invalid_grant')) {
             throw new Error("AUTH_ERROR");
        }
        return null; 
    }
}

export async function updateDriveFile(
    userId: string, 
    fileId: string,
    content: string | Buffer | Stream, 
    mimeType: string
) {
    try {
        const account = await getPrimaryGoogleAccount(userId);
        if (!account?.access_token) return null;

        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ access_token: account.access_token, refresh_token: account.refresh_token });
        const drive = google.drive({ version: 'v3', auth });

        const media = {
            mimeType: mimeType,
            body: content,
        };

        const res = await drive.files.update({
            fileId: fileId,
            media: media,
            fields: 'id',
        });

        return res.data;
    } catch (e) {
        console.error('Failed to update Drive file', e);
        throw e;
    }
}
