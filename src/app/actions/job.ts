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

    const { notifyUser } = await import('@/lib/job-notifier');
    notifyUser(session.user.id);

    processJob(job.id).catch(err => {
        console.error(`Background processing failed for job ${job.id}`, err);
    });

    return job;
}

export async function getJobs() {
    const session = await devAuth();
    if (!session?.user?.id) return [];

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

    await prisma.job.update({
        where: { id: jobId, userId: session.user.id },
        data: { status: 'CANCELLED' }
    });
    
    const { notifyUser } = await import('@/lib/job-notifier');
    notifyUser(session.user.id);
    
    revalidatePath('/');
    return { success: true };
}

export async function getJob(jobId: string) {
    const session = await devAuth();
    if (!session?.user?.id) return null;

    return await prisma.job.findUnique({
        where: { id: jobId, userId: session.user.id }
    });
}

export async function deleteJob(jobId: string) {
    const session = await devAuth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    await prisma.job.delete({
        where: { id: jobId, userId: session.user.id }
    });
    
    const { notifyUser } = await import('@/lib/job-notifier');
    notifyUser(session.user.id);
    
    revalidatePath('/');
    return { success: true };
}
