
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAlarms() {
    console.log('Checking alarms...', new Date().toISOString());
    const now = new Date();

    try {
        const dueAlarms = await prisma.alarm.findMany({
            where: {
                time: { lte: now },
                isSent: false,
            },
            include: {
                user: true,
            },
        });

        if (dueAlarms.length > 0) {
            console.log(`Found ${dueAlarms.length} due alarms.`);
        }

        for (const alarm of dueAlarms) {
            if (!alarm.user.pushoverUserKey || !alarm.user.pushoverToken) {
                console.log(`Skipping alarm ${alarm.id}: User has no Pushover credentials.`);
                continue;
            }

            try {
                const response = await fetch('https://api.pushover.net/1/messages.json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: alarm.user.pushoverToken,
                        user: alarm.user.pushoverUserKey,
                        title: `Alarm: ${alarm.title}`,
                        message: alarm.comment || 'Time is up!',
                        sound: 'pushover',
                    }),
                });

                if (response.ok) {
                    console.log(`Sent notification for alarm ${alarm.id}`);
                    await prisma.alarm.update({
                        where: { id: alarm.id },
                        data: { isSent: true },
                    });
                } else {
                    console.error(`Failed to send Pushover for alarm ${alarm.id}: ${response.statusText}`);
                }
            } catch (err) {
                console.error(`Error sending notification for alarm ${alarm.id}:`, err);
            }
        }
    } catch (e) {
        console.error("Error in checkAlarms:", e);
    }
}

// Run immediately then every minute
checkAlarms();
setInterval(checkAlarms, 60 * 1000);
