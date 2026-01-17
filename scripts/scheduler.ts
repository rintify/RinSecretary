import { generateRegularTasks } from '../src/lib/regularTaskService';
import { getGoogleCalendarEvents } from '../src/lib/google';
import { PrismaClient } from '@prisma/client';
import { sendPushoverNotification } from '../src/lib/pushover';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// --- Persistent State Management ---
// State is loaded from file on startup, updated in memory, and saved after each task execution.
// This ensures: 1) No DB overhead, 2) Survives process restarts and deploys, 3) No I/O on every minute check.
// Stored in data/ directory which is persisted across deploys (same as sqlite.db)

const STATE_FILE = path.join(__dirname, '..', 'data', '.scheduler-state.json');

interface SchedulerState {
    lastRegularTaskRunDate: string | null;
    lastDailyBriefingRunDate: string | null;
    lastMailSummaryRunDate: string | null;
    lastBackupRunDate: string | null;
    lastStorageSyncRunDate: string | null;
}

let state: SchedulerState = {
    lastRegularTaskRunDate: null,
    lastDailyBriefingRunDate: null,
    lastMailSummaryRunDate: null,
    lastBackupRunDate: null,
    lastStorageSyncRunDate: null,
};

function loadState(): void {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, 'utf-8');
            state = { ...state, ...JSON.parse(data) };
            console.log('Loaded scheduler state:', state);
        }
    } catch (e) {
        console.error('Failed to load scheduler state, starting fresh:', e);
    }
}

function saveState(): void {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error('Failed to save scheduler state:', e);
    }
}

// Helper to get today's date string for comparison
function getTodayDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Load state on startup
loadState();

// --- NEW: Sync Storage Usage on startup ---
(async () => {
    try {
        console.log('Performing startup storage sync...');
        const { syncStorageUsage } = await import('../src/lib/storage');
        await syncStorageUsage();
    } catch (e) {
        console.error('Failed to sync storage usage on startup:', e);
    }
})();


// --- Notification Helper ---
async function sendDiscordNotification(userId: string, title: string, message: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user || !user.discordWebhookUrl) {
            return;
        }

        const payload = {
            embeds: [{
                title: title,
                description: message,
                color: title.includes("失敗") || title.includes("エラー") ? 0xFF0000 : 0x00FF00, // Red or Green
                timestamp: new Date().toISOString()
            }]
        };

        const res = await fetch(user.discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            console.error(`Failed to send Discord notification for user ${userId}: ${res.status} ${res.statusText}`);
        } else {
            console.log(`Sent Discord notification to user ${userId}: ${title}`);
        }
    } catch (e) {
        console.error(`Error sending Discord notification for user ${userId}:`, e);
    }
}


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
    const today = getTodayDateString();
    
    // Run at 04:00 or later, but only once per day
    if (now.getHours() < 4) return;
    if (state.lastRegularTaskRunDate === today) return;
    
    state.lastRegularTaskRunDate = today;
    saveState();
    console.log('Running Regular Task Scheduler...', now.toISOString());
    
    // Call shared logic
    const results = await generateRegularTasks(now);
    
    // Notify Users
    for (const res of results) {
        if (res.status === 'CREATED') {
            await sendDiscordNotification(res.userId, "定期タスク作成完了", `定期タスクを作成しました: **${res.title}**`);
        } else if (res.status === 'ERROR') {
            await sendDiscordNotification(res.userId, "定期タスク作成エラー", `定期タスクの作成に失敗しました: ${res.reason}`);
        }
    }
}

// Run immediately then every minute
checkAlarms();
checkRegularTasks();
checkDailyBriefing();
// Note: Backup check is handled within the interval loop mostly, but can add here if needed.
// checkBackup();
checkStorageSync(); // Avoid running immediately on restart if it happens to be 3:00, let interval handle it strictly? 
// Or just let it run.
checkBackup();

setInterval(() => {
    checkAlarms();
    checkRegularTasks();
    checkDailyBriefing();
    checkMailSummary();
    checkMailSummary();
    checkBackup();
    checkStorageSync();
}, 60 * 1000);

// --- Shared File Cleanup ---
async function checkExpiredSharedFiles() {
    // Run every minute
    const now = new Date();
    // 7 minutes ago
    const expiredThreshold = new Date(now.getTime() - 7 * 60 * 1000);

    try {
        const expiredFiles = await prisma.sharedFile.findMany({
            where: {
                createdAt: { lt: expiredThreshold }
            }
        });

        if (expiredFiles.length > 0) {
            console.log(`Found ${expiredFiles.length} expired shared files.`);
            
            const UPLOAD_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'data/uploads');
            const { updateStorageUsage } = await import('../src/lib/storage');

            for (const file of expiredFiles) {
                 // Delete physical file
                const filename = file.filePath.split('/').pop();
                if (filename) {
                    const filepath = path.join(UPLOAD_DIR, filename);
                    if (fs.existsSync(filepath)) {
                        try {
                            fs.unlinkSync(filepath);
                            console.log(`Deleted expired file: ${filename}`);
                        } catch (e) {
                            console.error(`Failed to delete file ${filename}`, e);
                        }
                    }
                }
                
                // Update storage usage
                await updateStorageUsage(-file.fileSize);
                
                // Delete DB record
                await prisma.sharedFile.delete({ where: { id: file.id } });
            }
        }
    } catch (e) {
        console.error("Error in checkExpiredSharedFiles:", e);
    }
}

// Initial check
checkExpiredSharedFiles();
// Add to interval
setInterval(() => {
    checkExpiredSharedFiles();
}, 10 * 60 * 1000);

async function checkDailyBriefing() {
    const now = new Date();
    const today = getTodayDateString();
    
    // Run at 06:00 or later, but only once per day
    if (now.getHours() < 6) return;
    if (state.lastDailyBriefingRunDate === today) return;
    
    state.lastDailyBriefingRunDate = today;
    saveState();
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
    const today = getTodayDateString();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Run at 18:30 or later, but only once per day
    // Check if current time is at or after 18:30
    if (hours < 18 || (hours === 18 && minutes < 30)) return;
    if (state.lastMailSummaryRunDate === today) return;
    
    state.lastMailSummaryRunDate = today;
    saveState();
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
            const res = await generateDailyMailSummary(user.id);
            // Notify
            if (res) {
                 if (res.success) {
                     await sendDiscordNotification(
                         user.id, 
                         "メール要約完了", 
                         `本日のメール要約を作成しました (件数: ${res.cardsCreated})`
                     );
                 } else {
                     await sendDiscordNotification(
                         user.id, 
                         "メール要約エラー", 
                         `メール要約の作成に失敗しました: ${res.error}`
                     );
                 }
            }
        }

    } catch (e) {
        console.error("Error in checkMailSummary:", e);
    }
}

async function checkBackup() {
    const now = new Date();
    const today = getTodayDateString();
    
    // Run at 03:00 or later, but only once per day
    if (now.getHours() < 3) return;
    if (state.lastBackupRunDate === today) return;
    
    state.lastBackupRunDate = today;
    saveState();
    console.log('Running Daily Backup...', now.toISOString());

    try {
        const configs = await prisma.backupConfig.findMany({
            where: { isEnabled: true }
        });

        for (const config of configs) {
            try {
                const { performBackup } = await import('../src/lib/backup-actions');
                const res = await performBackup(config.userId);
                if (res && res.success) {
                    await sendDiscordNotification(
                        config.userId,
                        "バックアップ完了",
                        `Google Drive (${res.folderName}) へのバックアップが完了しました。`
                    );
                }
            } catch(e: any) {
                console.error(`Error backing up for user ${config.userId}`, e);
                await sendDiscordNotification(
                    config.userId,
                    "バックアップ失敗",
                    `バックアップに失敗しました: ${e.message}`
                );
            }
        }
    } catch (e) {
        console.error("Error in checkBackup:", e);
    }
}

async function checkStorageSync() {
    const now = new Date();
    const today = getTodayDateString();
    
    // Run at 03:00 or later, but only once per day
    if (now.getHours() < 3) return;
    if (state.lastStorageSyncRunDate === today) return;
    
    state.lastStorageSyncRunDate = today;
    saveState();
    console.log('Running Daily Storage Sync...', now.toISOString());

    try {
        const { syncStorageUsage } = await import('../src/lib/storage');
        await syncStorageUsage();
        console.log('Daily Storage Sync completed successfully.');
    } catch (e) {
        console.error("Error in checkStorageSync:", e);
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
