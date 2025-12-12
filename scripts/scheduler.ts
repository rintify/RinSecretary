import { generateRegularTasks } from '../src/lib/regularTaskService';
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


async function checkRegularTasks() {
    const now = new Date();
    // Check if it is 04:00 (allow a small window like 04:00 - 04:01)
    if (now.getHours() !== 4 || now.getMinutes() !== 0) {
        return;
    }

    console.log('Running Regular Task Scheduler...', now.toISOString());
    
    // Call shared logic
    await generateRegularTasks(now);
}

// Run immediately then every minute
checkAlarms();
checkRegularTasks();
setInterval(() => {
    checkAlarms();
    checkRegularTasks();
}, 60 * 1000);
