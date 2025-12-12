
import { prisma } from './prisma';

export async function generateRegularTasks(forceDate?: Date) {
    const now = forceDate || new Date();
    // Note: This function assumes it's being called either by scheduler at 4:00 AM
    // OR manually triggered via API.
    // If manually triggered, 'now' is the time of trigger.
    
    console.log('Generating Regular Tasks...', now.toISOString());

    try {
        const configs = await prisma.regularTaskConfig.findMany({
            // where: { isPaused: false }, // Config-level pause removed, creating for all users, but individual items checked
            include: { user: true }
        });

        for (const config of configs) {
            try {
                // Determine Creation Logic
                let shouldCreate = false;
                let title = '';
                let deadline = new Date(now);

                if (config.type === 'DAILY') {
                    shouldCreate = true;
                    // Force time to be based on 4:00 AM logic for consistency?
                    // If running at 12:00, dateStr is today.
                    // If running at 23:00, dateStr is today.
                    // The "Daily Task" is technically for "Today" (starts 4:00 AM).
                    // If we run at 3:00 AM, dateStr is today, but maybe it should be considered "Yesterday's task"?
                    // Scheduler runs at 4:00 AM.
                    // Let's assume dateStr is local date.
                    const dateStr = now.toISOString().split('T')[0];
                    title = `Daily Task (${dateStr})`;
                    
                    // Deadline: Tomorrow 03:59
                    // If now is 12:00, deadline should be tomorrow 3:59.
                    // If now is 23:00, deadline should be tomorrow 3:59.
                    // Logic: deadline = now + 1 day, then set 3:59.
                    // Wait, if I run at 4:00 AM today, deadline is tomorrow 3:59 AM.
                    // If I run at 12:00 PM today, deadline is tomorrow 3:59 AM.
                    const d = new Date(now);
                    d.setDate(d.getDate() + 1);
                    d.setHours(3, 59, 0, 0);
                    deadline = d;

                } else if (config.type === 'WEEKLY') {
                    // Monday = 1
                    // If manual generation, we might want to respect "This Week" logic.
                    // If today is Monday, generate.
                    // If today is NOT Monday, standard scheduler skips.
                    // BUT "Generate Button" might imply "Force Generate".
                    // User said "generate button ... to generate".
                    // If I force generate, maybe I WANT the weekly task even if it's Tuesday?
                    // Let's stick to strict day check for now to match scheduler behavior unless forced?
                    // "Generate" button implies "Do what the scheduler would do, but NOW".
                    // If scheduler wouldn't do it because it's Tuesday, then maybe we shouldn't?
                    // But then nothing happens.
                    // Let's relax the day check if forceDate (manual trigger) is implicitly answering "I want it".
                    // But I don't have a specific "isManual" flag passed easily yet other than context.
                    // Let's just stick to "Check Day" for consistency. If user wants to test Monday task, change date?
                    // Actually, if I'm testing, I might want to see if it works.
                    // PROPOSAL: If config.type == WEEKLY, only check day if NOT manual? 
                    // Let's stick to strict logic: Only Monday.
                    
                    if (now.getDay() === 1) {
                         shouldCreate = true;
                         const dateStr = now.toISOString().split('T')[0];
                         title = `Weekly Task (${dateStr})`;
                         // Deadline: Next Monday 03:59 (7 days later)
                         const d = new Date(now);
                         d.setDate(d.getDate() + 7);
                         d.setHours(3, 59, 0, 0);
                         deadline = d;
                    }
                }

                if (shouldCreate) {
                    // Check existence (Idempotency)
                    // "Today's run" defined as created after Today 04:00 or similar?
                    // Or just strict Title check? Title has Date.
                    // Let's check Title + UserId.
                    
                    const existing = await prisma.task.findFirst({
                        where: {
                            userId: config.userId,
                            title: title,
                        }
                    });

                    if (!existing) {
                        // Filter out paused items
                        const checklistItems = JSON.parse(config.checklist);
                        const activeItems = checklistItems.filter((item: any) => !item.isPaused);
                        
                        // Only create if there are active items
                        if (activeItems.length > 0) {
                            await prisma.task.create({
                                 data: {
                                     title: title,
                                     checklist: JSON.stringify(activeItems),
                                     userId: config.userId,
                                     startDate: now, // Creation time is 'now'
                                     deadline: deadline,
                                     progress: 0,
                                     maxProgress: 100
                                 }
                            });
                            console.log(`Created ${config.type} task for user ${config.userId}`);
                        } else {
                            console.log(`Skipping ${config.type} task for user ${config.userId}: No active items`);
                        }
                    } else {
                        console.log(`Skipping ${config.type} task for user ${config.userId}: Already exists`);
                    }
                }

            } catch (err) {
                console.error(`Error processing config ${config.id}:`, err);
            }
        }

    } catch (e) {
        console.error("Error in generateRegularTasks:", e);
    }
}
