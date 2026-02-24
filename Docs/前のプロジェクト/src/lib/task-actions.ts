'use server';

import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { addDays, startOfDay, endOfDay, addWeeks } from 'date-fns';

export async function getExpiredTasks(limit: number = 30) {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error('Unauthorized');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) throw new Error('User not found');

  const now = new Date();

  // Find tasks where:
  // 1. userId matches
  // 2. deadline is strictly in the past (< now)
  // 3. progress < maxProgress (not done)
  // Ordered by deadline asc (oldest expired first)
  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      deadline: {
        lt: now,
      },
      // Assuming 'progress' and 'maxProgress' logic from codebase (TimeTable.tsx)
      // We can't easily do field comparison in simple prisma where without raw query or computed column.
      // But typically progress < 100 or progress < maxProgress. 
      // Let's filter in memory if necessary or assume standard 100 max.
      // Ideally we should check if progress < maxProgress.
      // Prisma doesn't support comparing two columns in `where` easily in many relations without raw query.
      // However, usually maxProgress is 100.
      // Let's fetch basic incomplete check: progress < 100.
      // Or we can check `AND: [{ NOT: { progress: { gte: prisma.task.fields.maxProgress } } }]` is not valid directly.
      // Let's fetch all expired and filter in JS for correctness regarding "done".
    },
    orderBy: {
      deadline: 'asc',
    },
    // We should probably fetch a bit more then filter
    take: limit * 2, 
  });

  // Filter for unconfirmed incomplete tasks in memory
  const incompleteTasks = tasks.filter(t => {
      const p = t.progress || 0;
      const mp = t.maxProgress || 100;
      if (p >= mp) return false;

      // Check if unconfirmed: updatedAt < deadline
      // User requested to SHOW ALL expired tasks in the list, regardless of confirmation status.
      // So we do NOT filter by updatedAt here.
      // const deadline = t.deadline ? new Date(t.deadline) : new Date();
      // const updatedAt = t.updatedAt ? new Date(t.updatedAt) : new Date(0);
      // return updatedAt < deadline;
      return true;
  });

  return incompleteTasks.slice(0, limit);
}

export async function getExpiredTaskCount() {
    // Similar logic but just count
    const session = await auth();
    if (!session?.user?.email) return 0;

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });
    if (!user) return 0;

    const now = new Date();
    
    const tasks = await prisma.task.findMany({
        where: {
            userId: user.id,
            deadline: { lt: now },
        }
    });

    // In-memory filter for completion and confirmation
    const count = tasks.filter(t => {
        const p = t.progress || 0;
        const mp = t.maxProgress || 100;
        if (p >= mp) return false;

        const deadline = t.deadline ? new Date(t.deadline) : new Date();
        const updatedAt = t.updatedAt ? new Date(t.updatedAt) : new Date(0);
        return updatedAt < deadline;
    }).length;

    return count;

    return count;
}

export type ExtensionType = 'today' | 'tomorrow' | 'afterTomorrow' | 'week';

export async function extendTaskDeadline(taskId: string, type: ExtensionType) {
    const session = await auth();
    if (!session?.user?.email) throw new Error('Unauthorized');

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });
    if (!user) throw new Error('User not found');

    const now = new Date();
    let newDeadline: Date;

    switch (type) {
        case 'today':
            newDeadline = endOfDay(now);
            break;
        case 'tomorrow':
            newDeadline = endOfDay(addDays(now, 1));
            break;
        case 'afterTomorrow':
            newDeadline = endOfDay(addDays(now, 2));
            break;
        case 'week':
            newDeadline = endOfDay(addWeeks(now, 1));
            break;
        default:
            throw new Error('Invalid extension type');
    }

    await prisma.task.update({
        where: { 
            id: taskId,
            userId: user.id // Ensure ownership
        },
        data: {
            deadline: newDeadline
        }
    });

    revalidatePath('/');
    return { success: true };
}

export async function ignoreExpiredTask(taskId: string) {
    const session = await auth();
    if (!session?.user?.email) throw new Error('Unauthorized');

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });
    if (!user) throw new Error('User not found');

    // "Ignore" means satisfying the "Confirmed" condition: updatedAt >= deadline.
    // By updating the task (even a touch), updatedAt will become 'now', which is > expired deadline.
    await prisma.task.update({
        where: { 
            id: taskId,
            userId: user.id
        },
        data: {
            updatedAt: new Date() // Force update
        }
    });

    revalidatePath('/');
    return { success: true };
}

export interface CreateTaskData {
    title: string;
    memo?: string;
    deadline?: Date;
}

export async function createTask(data: CreateTaskData) {
    const session = await auth();
    if (!session?.user?.email) throw new Error('Unauthorized');

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });
    if (!user) throw new Error('User not found');

    const now = new Date();
    // Default deadline: Tomorrow 23:59:59
    const defaultDeadline = endOfDay(addDays(now, 1));

    await prisma.task.create({
        data: {
            title: data.title,
            memo: data.memo || '',
            startDate: startOfDay(now),
            deadline: data.deadline || defaultDeadline,
            progress: 0,
            maxProgress: 100,
            userId: user.id,
            checklist: '[]',
        }
    });

    revalidatePath('/');
    return { success: true };
}
