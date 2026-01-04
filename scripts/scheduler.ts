import { generateRegularTasks } from '../src/lib/regularTaskService';
import { getGoogleCalendarEvents } from '../src/lib/google';
import { PrismaClient } from '@prisma/client';
import { sendPushoverNotification } from '../src/lib/pushover';

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
                // Format time: HH:mm
                const timeStr = new Date(alarm.time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                const baseMessage = `${timeStr} ${alarm.comment || ''}`;
                // Truncate to 50 chars
                const message = baseMessage.length > 50 ? baseMessage.substring(0, 47) + '...' : baseMessage;

                const response = await sendPushoverNotification({
                    userKey: alarm.user.pushoverUserKey,
                    token: alarm.user.pushoverToken,
                    title: alarm.title || 'Alarm',
                    message: message
                });

                if (response.success) {
                    console.log(`Sent notification for alarm ${alarm.id}`);
                    await prisma.alarm.update({
                        where: { id: alarm.id },
                        data: { isSent: true },
                    });
                } else {
                    console.error(`Failed to send Pushover for alarm ${alarm.id}: ${response.error}`);
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
checkDailyBriefing();
setInterval(() => {
    checkAlarms();
    checkRegularTasks();
    checkDailyBriefing();
    checkMailSummary();
}, 60 * 1000);

async function checkDailyBriefing() {
    const now = new Date();
    // 06:00 execution
    if (now.getHours() !== 6 || now.getMinutes() !== 0) {
        return;
    }
    console.log('Running Daily Briefing...', now.toISOString());

    try {
        const users = await prisma.user.findMany({
            where: {
                discordWebhookUrl: {
                    not: null,
                },
            },
        });

        for (const user of users) {
            if (!user.discordWebhookUrl) continue;
            await sendBriefingForUser(user);
        }

    } catch (e) {
        console.error("Error in checkDailyBriefing:", e);
    }
}

async function checkMailSummary() {
    const now = new Date();
    // 18:30 execution
    if (now.getHours() !== 18 || now.getMinutes() !== 30) {
        return;
    }
    console.log('Running Daily Mail Summary...', now.toISOString());

    try {
        // Delete old summaries (older than 2 months based on latestMailReceivedAt)
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        
        const deleteResult = await prisma.mailSummary.deleteMany({
            where: {
                latestMailReceivedAt: {
                    lt: twoMonthsAgo
                }
            }
        });
        console.log(`Deleted ${deleteResult.count} old mail summaries.`);

        // Find users who have mail summary configured
        const users = await prisma.user.findMany({
            where: {
                mailSummaryModelId: {
                    not: null
                }
            }
        });

        const { generateDailyMailSummary } = await import('../src/lib/mail-scheduler-actions');

        for (const user of users) {
            await generateDailyMailSummary(user.id);
        }

    } catch (e) {
        console.error("Error in checkMailSummary:", e);
    }
}

 
// Note: scripts/scheduler.ts is likely run with ts-node which might have issues with path aliases '@/' if not configured.
// The file imports from '../src/lib/regularTaskService' so relative paths work.
// I need to use relative path for import.

async function sendBriefingForUser(user: any) {
    // Window: Now -> Tomorrow 04:00 AM
    const now = new Date();
    const tomorrow4am = new Date(now);
    tomorrow4am.setDate(tomorrow4am.getDate() + 1);
    tomorrow4am.setHours(4, 0, 0, 0);

    let message = `**${now.toLocaleDateString('ja-JP')} の予定とタスク**\n(対象: 今から ${tomorrow4am.toLocaleString('ja-JP')} まで)\n\n`;

    // 1. Events
    let eventsLine = "";
    try {
         const events = await getGoogleCalendarEvents(user.id, now, tomorrow4am);
         if (events.length === 0) {
            eventsLine = "📅 **イベント**: なし\n";
         } else {
            eventsLine = "📅 **イベント**:\n";
            events.forEach((e: any) => {
                const timeStr = e.start.dateTime 
                    ? new Date(e.start.dateTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) 
                    : '終日';
                eventsLine += `- ${timeStr} ${e.summary}\n`;
            });
         }
    } catch (e) {
        console.error(`Failed to fetch events for user ${user.id}`, e);
        eventsLine = "📅 **イベント**: 取得失敗\n";
    }

    message += eventsLine + "\n";

    // 2. Tasks (Deadlines in range)
    let tasksLine = "";
    try {
        const tasks = await prisma.task.findMany({
            where: {
                userId: user.id,
                deadline: {
                    gte: now,
                    lte: tomorrow4am,
                },
                 progress: {
                    lt: 100
                }
            },
            orderBy: {
                deadline: 'asc',
            }
        });

        if (tasks.length === 0) {
            tasksLine = "✅ **締切タスク**: なし\n";
        } else {
            tasksLine = "✅ **締切タスク**:\n";
            tasks.forEach(t => {
                const timeStr = new Date(t.deadline).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                tasksLine += `- [~${timeStr}] ${t.title}\n`;
            });
        }
    } catch (e) {
        console.error(`Failed to fetch tasks for user ${user.id}`, e);
        tasksLine = "✅ **締切タスク**: 取得失敗\n";
    }

    message += tasksLine;

    // Check length (max 2000)
    if (message.length > 2000) {
        message = message.substring(0, 1990) + "...\n(省略されました)";
    }

    // Send
    try {
        const res = await fetch(user.discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message }),
        });
        if (!res.ok) {
            console.error(`Failed to send Discord webhook for user ${user.id}: ${res.statusText}`);
        } else {
            console.log(`Sent daily briefing to user ${user.id}`);
        }
    } catch (e) {
        console.error(`Error sending Discord webhook for user ${user.id}`, e);
    }
}
