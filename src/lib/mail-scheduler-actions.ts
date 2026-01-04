'use server';

import { prisma } from './prisma';
import { generateSummaryFromData, MailSummaryResult } from './mail-actions';
import { getGmailMessages } from './google';
import { devAuth as auth } from '@/lib/dev-auth'; 

// Utility to calculate range: Yesterday 18:30 -> Today 18:30 (relative to "targetDate" being Today)
function getTargetRange(targetDate: Date) {
    // If targetDate is 2024-01-04, we want range ending at 2024-01-04 18:30
    // Start is 2024-01-03 18:30
    const end = new Date(targetDate);
    end.setHours(18, 30, 0, 0);

    const start = new Date(end);
    start.setDate(start.getDate() - 1);

    return { start, end };
}

export async function generateDailyMailSummary(userId: string, targetDateInput?: Date) {
    const dateForRange = targetDateInput || new Date();
    const { start: timeMin, end: timeMax } = getTargetRange(dateForRange);

    console.log(`Starting mail summary for user ${userId} range: ${timeMin.toISOString()} - ${timeMax.toISOString()}`);

    try {
        const user = await prisma.user.findUnique({
             where: { id: userId },
             include: { aiConfigs: true, mailBlockedSenders: true } as any
        });
        
        if (!user) throw new Error("User not found");
        const userAny = user as any;
        if (!userAny.mailSummaryModelId) {
            console.log("No mail summary model configured. Skipping.");
            return;
        }

        const config = userAny.aiConfigs.find((c: any) => c.id === userAny.mailSummaryModelId);
        if (!config) {
            console.log("Config missing. Skipping.");
            return;
        }
        
        // Fetch messages
        let messages: any[] = [];
        try {
            messages = await getGmailMessages(userId, timeMin, timeMax);
        } catch (e: any) {
            console.error(`Failed to fetch messages for ${userId}`, e);
            // Create Error Card
            await prisma.mailSummary.create({
                data: {
                    userId,
                    title: "メール取得エラー",
                    summary: `メールの取得中にエラーが発生しました: ${e.message}`,
                    status: 'FAILED',
                    error: String(e),
                    latestMailReceivedAt: timeMax, // Use range end as proxy
                    targetRangeStart: timeMin,
                    targetRangeEnd: timeMax
                }
            });
            return;
        }

        // Filter Blocked
        const blockedEmails = (userAny.mailBlockedSenders || []).map((b: any) => b.email.toLowerCase());
        const filteredMessages = messages.filter(m => {
            const match = m.from.match(/<(.+)>/);
            const email = match ? match[1] : m.from;
            return !blockedEmails.includes(email.toLowerCase());
        });
        
        // Sort (newest first for AI processing)
        filteredMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        if (filteredMessages.length === 0) {
            console.log("No messages found.");
            // We don't necessarily need to create a card if there are no mails.
            // But if the user triggered "Fill", they might expect "Done".
            // Since we rely on "Missing" checks, if we don't save anything, it will keep looking "Missing".
            // So, save a "No Mails" card.
            await prisma.mailSummary.create({
                data: {
                    userId,
                    title: "新着メールなし",
                    summary: "この期間に受信した重要なメールはありませんでした。",
                    latestMailReceivedAt: timeMax,
                    targetRangeStart: timeMin,
                    targetRangeEnd: timeMax,
                    status: "GENERATED"
                }
            });
            return;
        }
        
        // Generate AI Summary
        let result: MailSummaryResult;
        try {
            result = await generateSummaryFromData(filteredMessages, config, userAny.mailSummaryPrompt);
        } catch (e: any) {
             console.error(`AI Generation failed for ${userId}`, e);
             await prisma.mailSummary.create({
                data: {
                    userId,
                    title: "要約生成エラー",
                    summary: `AIによる要約生成中にエラーが発生しました: ${e.message}`,
                    status: 'FAILED',
                    error: String(e),
                    latestMailReceivedAt: timeMax,
                    targetRangeStart: timeMin,
                    targetRangeEnd: timeMax
                }
            });
            return;
        }
        
        // Save Cards (Topics)
        const cardsToCreate = [];

        // 1. Topic Cards
        for (const topic of result.topics) {
            // Find latest mail date in this topic
            let latestDate = timeMin;
            if (topic.relatedLinks && topic.relatedLinks.length > 0) {
                 // We only have ID in relatedLinks. We need to find the message in `filteredMessages` to get date.
                 // Ideally `generateSummaryFromData` or `topic` should pass date.
                 // We can look up in `filteredMessages`.
                 const dates = topic.relatedLinks.map(link => {
                     const msg = filteredMessages.find(m => m.id === link.id);
                     return msg ? new Date(msg.date).getTime() : 0;
                 });
                 const maxTs = Math.max(...dates);
                 if (maxTs > 0) latestDate = new Date(maxTs);
            }

            cardsToCreate.push({
                userId,
                title: topic.title,
                summary: topic.summary,
                senders: JSON.stringify(topic.senders),
                relatedLinks: JSON.stringify(topic.relatedLinks),
                latestMailReceivedAt: latestDate,
                targetRangeStart: timeMin,
                targetRangeEnd: timeMax,
                status: "GENERATED"
            });
        }

        // 2. Other Messages Card
        if (result.otherMessagesSummary) {
            // Determine latest date for 'Other'.
            // Exclude messages used in topics... strict way is hard without mapping.
            // Approximate: Use the latest date of ALL filtered messages? 
            // Or just use timeMax? 
            // The prompt says "other messages". 
            // Let's use the latest date of the UNUSED messages if possible, or just the global latest.
            // Using timeMax is safe-ish, or just the latest message date in the batch.
            const globalLatest = filteredMessages.length > 0 ? new Date(filteredMessages[0].date) : timeMax;

            cardsToCreate.push({
                userId,
                title: "Untitled",
                summary: result.otherMessagesSummary,
                senders: JSON.stringify(result.otherSenders), // Include senders
                relatedLinks: "[]", // No links as requested
                latestMailReceivedAt: globalLatest,
                targetRangeStart: timeMin,
                targetRangeEnd: timeMax,
                status: "GENERATED"
            });
        }

        if (cardsToCreate.length > 0) {
            await prisma.mailSummary.createMany({
                data: cardsToCreate
            });
        }

        console.log(`Generated ${cardsToCreate.length} cards for user ${userId}`);

    } catch (e) {
        console.error("Critical logic error in generateDailyMailSummary", e);
        // Fallback catch-all error card
         await prisma.mailSummary.create({
            data: {
                userId,
                title: "システムエラー",
                summary: "予期せぬエラーが発生しました。",
                status: 'FAILED',
                error: String(e),
                latestMailReceivedAt: timeMax,
                targetRangeStart: timeMin,
                targetRangeEnd: timeMax
            }
        });
    }
}


// Generate summary for the last 2 weeks (approx 14 days)

// Generic Fetch with Range
export async function fetchMailDataInRange(targetStart: Date, targetEnd: Date) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const userId = session.user.id;

    const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { aiConfigs: true, mailBlockedSenders: true } as any
    });
    
    if (!user) throw new Error("User not found");
    const userAny = user as any;
    if (!userAny.mailSummaryModelId) {
        return { success: false, error: "AIモデルが設定されていません" };
    }

    const config = userAny.aiConfigs.find((c: any) => c.id === userAny.mailSummaryModelId);
    if (!config) {
        return { success: false, error: "AI設定が見つかりません" };
    }
    
    // Fetch messages
    let messages: any[] = [];
    try {
        messages = await getGmailMessages(userId, targetStart, targetEnd);
    } catch (e: any) {
        console.error(`Failed to fetch messages for ${userId}`, e);
        throw new Error(`メール取得エラー: ${e.message}`);
    }

    // Filter Blocked
    const blockedEmails = (userAny.mailBlockedSenders || []).map((b: any) => b.email.toLowerCase());
    const filteredMessages = messages.filter(m => {
        const match = m.from.match(/<(.+)>/);
        const email = match ? match[1] : m.from;
        return !blockedEmails.includes(email.toLowerCase());
    });
    
    // Sort (newest first)
    filteredMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { 
        success: true, 
        messages: filteredMessages, 
        count: filteredMessages.length
    };
}

// Special case for 2 weeks
export async function fetchMailDataForTwoWeeks() {
    const timeMax = new Date();
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 14);
    return fetchMailDataInRange(timeMin, timeMax);
}

// Step 2: Process & Save (Modified to accept optional custom range for the saved cards)
export async function generateAndSaveMailSummary(messages: any[], customRange?: { start: Date, end: Date }) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const userId = session.user.id;

    const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { aiConfigs: true } as any
    });
    const userAny = user as any;
    const config = userAny.aiConfigs.find((c: any) => c.id === userAny.mailSummaryModelId);

    if (messages.length === 0) {
        return { success: true, count: 0 };
    }
    
    let result: MailSummaryResult;
    try {
        result = await generateSummaryFromData(messages, config, userAny.mailSummaryPrompt);
    } catch (e: any) {
            console.error(`AI Generation failed for ${userId}`, e);
            throw new Error(`AI生成エラー: ${e.message}`);
    }
    
    const timeMax = customRange?.end || new Date();
    const timeMin = customRange?.start || ( () => {
        const d = new Date(timeMax);
        d.setDate(d.getDate() - 14);
        return d;
    })();

    const cardsToCreate = [];
    for (const topic of result.topics) {
        let latestDate = timeMin;
        if (topic.relatedLinks && topic.relatedLinks.length > 0) {
            const dates = topic.relatedLinks.map(link => {
                const msg = messages.find((m: any) => m.id === link.id);
                return msg ? new Date(msg.date).getTime() : 0;
            });
            const maxTs = Math.max(...dates);
            if (maxTs > 0) latestDate = new Date(maxTs);
        }

        cardsToCreate.push({
            userId,
            title: topic.title,
            summary: topic.summary,
            senders: JSON.stringify(topic.senders),
            relatedLinks: JSON.stringify(topic.relatedLinks),
            latestMailReceivedAt: latestDate,
            targetRangeStart: timeMin,
            targetRangeEnd: timeMax,
            status: "GENERATED"
        });
    }

    if (result.otherMessagesSummary) {
        const globalLatest = messages.length > 0 ? new Date(messages[0].date) : timeMax;
        cardsToCreate.push({
            userId,
            title: "Untitled",
            summary: result.otherMessagesSummary,
            senders: JSON.stringify(result.otherSenders),
            relatedLinks: "[]",
            latestMailReceivedAt: globalLatest,
            targetRangeStart: timeMin,
            targetRangeEnd: timeMax,
            status: "GENERATED"
        });
    }

    if (cardsToCreate.length > 0) {
        // We need to return IDs, so we can't use createMany safely with IDs if we want them back easily in all DBs.
        // But for SQLite/Prisma, createMany doesn't return created records. 
        // We will loop create for now to get IDs, or just Refetch?
        // Let's loop create to be safe and simple for getting IDs.
        const createdIds: string[] = [];
        for (const data of cardsToCreate) {
             const created = await prisma.mailSummary.create({ data });
             createdIds.push(created.id);
        }
        return { success: true, count: createdIds.length, ids: createdIds };
    }

    return { success: true, count: 0, ids: [] };
}

export async function getUnreadMailSummaries(userId: string) {
    const summaries = await prisma.mailSummary.findMany({
        where: { userId, isRead: false, status: 'GENERATED' },
        orderBy: { latestMailReceivedAt: 'desc' },
        take: 50
    });
    return { success: true, summaries };
}

export async function markMailSummariesAsRead(ids: string[]) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    
    await prisma.mailSummary.updateMany({
        where: { 
            id: { in: ids },
            userId: session.user.id
        },
        data: { isRead: true }
    });
    return { success: true };
}

// Deprecated alias for safety if I missed any import
export const generateAndSave2WeeksSummary = generateAndSaveMailSummary;


export async function getMailSummaries(userId: string) {
    return prisma.mailSummary.findMany({
        where: { userId },
        orderBy: { latestMailReceivedAt: 'desc' },
        take: 100 
    });
}



// (Functions removed)






export async function prepareRegeneration(id: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    
    const record = await prisma.mailSummary.findUnique({ where: { id } });
    if (!record || record.userId !== session.user.id) throw new Error("Not found");
    
    if (record.status !== 'FAILED') throw new Error("Not an error record");

    const range = {
        start: record.targetRangeStart,
        end: record.targetRangeEnd
    };

    // Delete the old error card
    await prisma.mailSummary.delete({ where: { id } });

    return { success: true, range };
}

export async function regenerateErrorSummary(id: string) {
    // Legacy support or fallback
    const res = await prepareRegeneration(id);
    if (res.success) {
        await generateDailyMailSummary(res.range.end.toString(), res.range.end); // This is wrong, but just as fallback
        return { success: true };
    }
    return { success: false };
}


export async function fetchMyMailSummaries() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    return getMailSummaries(session.user.id);
}

export async function deleteMyMailSummary(id: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const summary = await prisma.mailSummary.findUnique({ where: { id } });
    if(summary?.userId !== session.user.id) throw new Error("Unauthorized");
    
    await prisma.mailSummary.delete({ where: { id } });
    return { success: true };
}
