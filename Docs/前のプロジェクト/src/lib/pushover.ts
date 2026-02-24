
export interface PushoverMessage {
    token: string;
    user: string;
    title?: string;
    message: string;
    url?: string;
    url_title?: string;
    priority?: number;
    retry?: number;
    expire?: number;
    sound?: string;
}

export async function sendPushoverNotification(params: {
    userKey: string;
    token: string;
    title: string;
    message: string;
}) {
    try {
        const response = await fetch('https://api.pushover.net/1/messages.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: params.token,
                user: params.userKey,
                title: params.title,
                message: params.message,
                sound: 'pushover',
                priority: 2, // Emergency
                retry: 30,   // 30 seconds (API minimum)
                expire: 300, // 5 minutes
                url: process.env.NEXTAUTH_URL || 'http://localhost:3000',
                url_title: 'Open RinSecretary'
            }),
        });

        if (!response.ok) {
            throw new Error(`Pushover API error: ${response.statusText}`);
        }
        return { success: true };
    } catch (e: any) {
        console.error('Failed to send Pushover notification:', e);
        return { success: false, error: e.message };
    }
}
