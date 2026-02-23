import { createApiHandler, errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { NextRequest } from 'next/server';
import { LocalTask, LocalUserSettings, LocalRecurringTask, LocalRecurringTemplate, LocalNote } from '@/lib/db';

export const POST = async (req: NextRequest) => {
  return createApiHandler(async () => {
    const session = await auth();
    if (!session || !session.user?.id) {
      return errorResponse('Unauthorized', 401);
    }
    const userId = session.user.id;

    const { changes, lastSyncedAt } = await req.json();

    if (!changes || typeof lastSyncedAt !== 'number') {
      return errorResponse('Invalid payload format', 400);
    }

    // 1. クライアントからの変更 (Upstream) をサーバーDBへ一括反映
    // --- Tasks ---
    const clientTasks = changes.tasks || [];
    if (clientTasks.length > 0) {
      await prisma.$transaction(
        clientTasks.map((task: LocalTask) => {
          return prisma.task.upsert({
            where: { id: task.id },
            update: {
              title: task.title,
              description: task.description || null,
              dueDate: task.dueDate ? new Date(task.dueDate) : null,
              priority: task.priority || 0,
              isCompleted: task.isCompleted,
              updatedAt: new Date(task.updatedAt),
            },
            create: {
              id: task.id,
              userId: userId,
              title: task.title,
              description: task.description || null,
              dueDate: task.dueDate ? new Date(task.dueDate) : null,
              priority: task.priority || 0,
              isCompleted: task.isCompleted,
              createdAt: new Date(task.createdAt),
              updatedAt: new Date(task.updatedAt),
              progress: 0,
            },
          });
        }),
      );
    }

    // --- UserSettings ---
    const clientUserSettings = changes.userSettings || [];
    if (clientUserSettings.length > 0) {
      await prisma.$transaction(
        clientUserSettings.map((us: LocalUserSettings) => {
          return prisma.userSettings.upsert({
            where: { userId: userId },
            update: {
              aiProvider: us.aiProvider,
            },
            create: {
              userId: userId,
              aiProvider: us.aiProvider,
            },
          });
        }),
      );
    }

    // --- RecurringTasks ---
    const clientRecurringTasks: LocalRecurringTask[] = changes.recurringTasks || [];
    if (clientRecurringTasks.length > 0) {
      await prisma.$transaction(
        clientRecurringTasks.map((rt) => {
          return prisma.recurringTask.upsert({
            where: { id: rt.id },
            update: {
              title: rt.title,
              description: rt.description || null,
              cronExpression: rt.cronExpression,
              isActive: rt.isActive,
              updatedAt: new Date(rt.updatedAt),
            },
            create: {
              id: rt.id,
              userId: userId,
              title: rt.title,
              description: rt.description || null,
              cronExpression: rt.cronExpression,
              isActive: rt.isActive,
              createdAt: new Date(rt.createdAt),
              updatedAt: new Date(rt.updatedAt),
            },
          });
        }),
      );
    }

    // --- RecurringTemplates ---
    const clientRecurringTemplates: LocalRecurringTemplate[] = changes.recurringTemplates || [];
    if (clientRecurringTemplates.length > 0) {
      await prisma.$transaction(
        clientRecurringTemplates.map((tpl) => {
          return prisma.recurringTemplate.upsert({
            where: { id: tpl.id },
            update: {
              recurringTaskId: tpl.recurringTaskId,
              title: tpl.title,
              orderIdx: tpl.orderIdx,
            },
            create: {
              id: tpl.id,
              recurringTaskId: tpl.recurringTaskId,
              title: tpl.title,
              orderIdx: tpl.orderIdx,
            },
          });
        }),
      );
    }

    // --- Notes ---
    const clientNotes: LocalNote[] = changes.notes || [];
    if (clientNotes.length > 0) {
      await prisma.$transaction(
        clientNotes.map((note) => {
          return prisma.note.upsert({
            where: { id: note.id },
            update: {
              title: note.title,
              content: note.content,
              updatedAt: new Date(note.updatedAt),
              deletedAt: note.deletedAt ? new Date(note.deletedAt) : null,
            },
            create: {
              id: note.id,
              userId: userId,
              title: note.title,
              content: note.content,
              createdAt: new Date(note.createdAt),
              updatedAt: new Date(note.updatedAt),
              deletedAt: note.deletedAt ? new Date(note.deletedAt) : null,
            },
          });
        }),
      );
    }

    // 2. サーバー側の最新データを取得 (Downstream)
    const serverSyncDate = new Date(lastSyncedAt);

    // --- Tasks Pull ---
    const updatedTasks = await prisma.task.findMany({
      where: { userId, updatedAt: { gt: serverSyncDate } },
    });
    const responseTasks = updatedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate ? t.dueDate.getTime() : null,
      priority: t.priority,
      isCompleted: t.isCompleted,
      createdAt: t.createdAt.getTime(),
      updatedAt: t.updatedAt.getTime(),
      _syncStatus: 'synced' as const,
    }));

    // --- UserSettings Pull ---
    const serverUserSettings = await prisma.userSettings.findUnique({
      where: { userId },
    });
    const responseUserSettings = serverUserSettings
      ? [
          {
            id: serverUserSettings.id,
            aiProvider: serverUserSettings.aiProvider,
            updatedAt: Date.now(),
            _syncStatus: 'synced' as const,
          },
        ]
      : [];

    // --- RecurringTasks Pull ---
    const updatedRecurringTasks = await prisma.recurringTask.findMany({
      where: { userId, updatedAt: { gt: serverSyncDate } },
    });
    const responseRecurringTasks = updatedRecurringTasks.map((rt) => ({
      id: rt.id,
      title: rt.title,
      description: rt.description,
      cronExpression: rt.cronExpression,
      isActive: rt.isActive,
      createdAt: rt.createdAt.getTime(),
      updatedAt: rt.updatedAt.getTime(),
      _syncStatus: 'synced' as const,
    }));

    // --- RecurringTemplates Pull ---
    const recurringTaskIds = updatedRecurringTasks.map((rt) => rt.id);
    const allRecurringTemplates =
      recurringTaskIds.length > 0
        ? await prisma.recurringTemplate.findMany({
            where: { recurringTaskId: { in: recurringTaskIds } },
          })
        : [];
    const responseRecurringTemplates = allRecurringTemplates.map((tpl) => ({
      id: tpl.id,
      recurringTaskId: tpl.recurringTaskId,
      title: tpl.title,
      orderIdx: tpl.orderIdx,
      _syncStatus: 'synced' as const,
    }));

    // --- Notes Pull ---
    const updatedNotes = await prisma.note.findMany({
      where: { userId, updatedAt: { gt: serverSyncDate } },
    });
    const responseNotes = updatedNotes.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      createdAt: n.createdAt.getTime(),
      updatedAt: n.updatedAt.getTime(),
      deletedAt: n.deletedAt ? n.deletedAt.getTime() : null,
      _syncStatus: 'synced' as const,
    }));

    return successResponse({
      pulledChanges: {
        tasks: responseTasks,
        userSettings: responseUserSettings,
        recurringTasks: responseRecurringTasks,
        recurringTemplates: responseRecurringTemplates,
        notes: responseNotes,
      },
      timestamp: Date.now(),
    });
  });
};
