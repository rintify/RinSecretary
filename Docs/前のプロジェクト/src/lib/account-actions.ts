'use server';

import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from './prisma';

export async function getLinkedGoogleAccounts() {
    const session = await auth();
    if (!session?.user?.id) return [];

    const accounts = await prisma.account.findMany({
        where: {
            userId: session.user.id,
            provider: 'google'
        },
        select: {
            id: true,
            providerAccountId: true, // Usually the Google user ID
            // We might want to store email in Account table if we want to show it easily, 
            // but standard NextAuth Account model doesn't store email by default usually.
            // Check if we can get email from ID token or if we rely on querying Google profile.
            // For now, let's just return what we have. 
            // Actually, we can fetch email if we have access token, or if we stored it.
            // Let's assume for now we just show Account ID or try to fetch details if needed.
            // Wait, usually the primary User model has the email.
            // Linked accounts don't necessarily have their email stored in Account table.
            // We might need to fetch profile info using the token if we want to show "which" google account it is.
        }
    });
    
    // To make it user friendly, we should probably fetch the email address for each account
    // or store it when linking.
    // For this implementation, let's try to fetch user info from Google for each account 
    // to display the email. this might be slow but accurate.
    
    // Actually, let's keep it simple first. 
    // If multiple accounts, maybe we can just identify them by ID or fetch profile client-side?
    // Let's try to fetch profile info here.
    
    // Fetch main user email to identify primary account
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true }
    });

    const accountsWithProfile = await Promise.all(accounts.map(async (acc) => {
        // We need the full account record to get the token
        const fullAccount = await prisma.account.findUnique({ where: { id: acc.id } });
        if(!fullAccount?.access_token) return { ...acc, email: 'Unknown (No Token)', isPrimary: false };
        
        // まずアクセストークンで試す
        let accessToken = fullAccount.access_token;
        
        try {
           let res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
               headers: { Authorization: `Bearer ${accessToken}` }
           });
           
           // トークン期限切れの場合、リフレッシュを試みる
           if (!res.ok && res.status === 401 && fullAccount.refresh_token) {
               console.log('Access token expired, attempting refresh for account', acc.id);
               try {
                   const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                       body: new URLSearchParams({
                           client_id: process.env.GOOGLE_CLIENT_ID!,
                           client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                           refresh_token: fullAccount.refresh_token,
                           grant_type: 'refresh_token'
                       })
                   });
                   
                   if (refreshRes.ok) {
                       const tokens = await refreshRes.json();
                       accessToken = tokens.access_token;
                       
                       // DBに新しいトークンを保存
                       await prisma.account.update({
                           where: { id: acc.id },
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
                   console.error('Token refresh failed for account', acc.id, refreshError);
               }
           }
           
           if(res.ok) {
               const data = await res.json();
               const isPrimary = user?.email && data.email ? (user.email.toLowerCase() === data.email.toLowerCase()) : false;
               return { ...acc, email: data.email, name: data.name, picture: data.picture, isPrimary };
           }
        } catch(e) {
            console.error('Failed to fetch user info', e);
        }
        return { ...acc, email: 'Unknown Info', isPrimary: false };
    }));

    return accountsWithProfile;
}

export async function unlinkGoogleAccount(accountId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Security check: ensure the account belongs to the user
    // We shouldn't delete the last linked account if the user has no other way to sign in?
    // But since we are using NextAuth, if they delete the account they are currently logged in with
    // they might get logged out or stay logged in until session expires.
    // Let's allow deletion.
    
    await prisma.account.delete({
        where: {
            id: accountId,
            userId: session.user.id
        }
    });

    return { success: true };
}
