'use server';

import { devAuth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { processJob } from '@/lib/job-processor';

// Job Types
export type JobType = 'AI_CHAT' | 'BACKUP' | 'MAIL_SUMMARY';

export async function submitJob(type: JobType, payload: any) {
    const session = await devAuth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    // Create Job Record
    const job = await prisma.job.create({
        data: {
            userId: session.user.id,
            type,
            status: 'PENDING',
            payload: JSON.stringify(payload),
            progress: 0
        }
    });

    // Trigger Async processing (Fire and Forget)
    // In Vercel, this might be terminated if not careful, but for "Node/VPS" logic it's fine.
    // For Vercel, usually requires Queue/Cron. 
    // We assume the user runs this locally or on a VPS where logic continues.
    // However, to ensure "response" returns to client before "process" finishes, we don't await processJob.
    // But we should catch errors to avoid unhandled rejections crashing process.
    processJob(job.id).catch(err => {
        console.error(`Background processing failed for job ${job.id}`, err);
    });

    return job;
}

export async function getJobs() {
    const session = await devAuth();
    if (!session?.user?.id) return [];

    // Return active jobs or recently completed ones (e.g. last 1 hour)
    // Or just all for now and let client filter?
    // Let's filter: Status is NOT 'COMPLETED'/'FAILED'/'CANCELLED' OR updated within last 1 hour.
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    return await prisma.job.findMany({
        where: {
            userId: session.user.id,
            OR: [
                { status: { in: ['PENDING', 'RUNNING'] } },
                { updatedAt: { gt: oneHourAgo } }
            ]
        },
        orderBy: { createdAt: 'desc' }
    });
}

export async function cancelJob(jobId: string) {
    const session = await devAuth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    // We can only mark as Cancelled. 
    // The processor needs to check this status periodically if it's a long running loop.
    await prisma.job.update({
        where: { id: jobId, userId: session.user.id },
        data: { status: 'CANCELLED' }
    });
    
    revalidatePath('/');
    return { success: true };
}

// Polling Helper
export async function getJob(jobId: string) {
    const session = await devAuth();
    if (!session?.user?.id) return null;

    return await prisma.job.findUnique({
        where: { id: jobId, userId: session.user.id }
    });
}
