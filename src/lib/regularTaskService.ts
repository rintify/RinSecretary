
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
                    // Format: Daily Task M月d日
                    // Example: Daily Task 12月12日
                    const month = now.getMonth() + 1;
                    const day = now.getDate();
                    title = `Daily Task ${month}月${day}日`;
                    
                    // Deadline: Tomorrow 03:59
                    const d = new Date(now);
                    d.setDate(d.getDate() + 1);
                    d.setHours(3, 59, 0, 0);
                    deadline = d;

                } else if (config.type === 'WEEKLY') {
                    // Logic: Always generate for "This Week" (anchored to Monday)
                    // This allows manual generation button to work any day.
                    
                    // Get Monday of this week
                    const day = now.getDay();
                    const diffToMonday = (day === 0 ? -6 : 1) - day; // 1 (Mon) - day. If Sun (0), 1-0=1 (wrong, want -6).
                    // Sun(0) -> -6. Mon(1) -> 0. Tue(2) -> -1. ... Sat(6) -> -5.
                    
                    const mondayDate = new Date(now);
                    mondayDate.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
                    
                    // Determine Week Number of the Month
                    // Simple "Week of Month": ceil(date / 7)? No, "第N週" usually implies Week n in calendar rows.
                    // Let's use simple logic: Week 1 starts on Day 1.
                    // Or standard logic: First Monday is start of Week 2?
                    // User request: "◯月 第◯週"
                    // Let's rely on date-fns getWeekOfMonth if available, or simple math.
                    // Math: (Date + DayOfFirstDay - 1) / 7 ??
                    // Simple approximation: Math.ceil(mondayDate.getDate() / 7)
                    // E.g. 1st (Mon) -> Week 1. 2nd (Tue) -> Week 1. 
                    // 7th (Sun) -> Week 1. 8th (Mon) -> Week 2.
                    // This works if we assume Week starts on specific day or just chunks of 7.
                    // Let's Use: Math.ceil((mondayDate.getDate() - 1 + new Date(mondayDate.getFullYear(), mondayDate.getMonth(), 1).getDay()) / 7) ? Too complex?
                    // Let's use simple Math.ceil(mondayDate.getDate() / 7) based on the Monday date.
                    const weekNum = Math.ceil(mondayDate.getDate() / 7);
                    
                    const month = mondayDate.getMonth() + 1;
                    title = `Weekly Task ${month}月 第${weekNum}週`;

                    shouldCreate = true;
                    
                    // Deadline: Next Monday 03:59 (7 days after THIS Monday)
                    const d = new Date(mondayDate);
                    d.setDate(d.getDate() + 7);
                    d.setHours(3, 59, 0, 0);
                    deadline = d;
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
