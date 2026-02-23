import { createApiHandler, errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { NextRequest } from 'next/server';
import { LocalTask } from '@/lib/db';

export const POST = async (req: NextRequest) => {
  return createApiHandler(async () => {
    const session = await auth();
    if (!session || !session.user?.id) {
      return errorResponse('Unauthorized', 401);
    }
    const userId = session.user.id;

    // クライアントからのデータ受け取り
    // changes: クライアント側で作成・更新・削除されたレコードの配列 (ex: { tasks: [...] })
    // lastSyncedAt: クライアントが最後に同期した時刻 (Unix Timestamp msec)
    const { changes, lastSyncedAt } = await req.json();

    if (!changes || typeof lastSyncedAt !== 'number') {
      return errorResponse('Invalid payload format', 400);
    }

    // 1. クライアントからの変更 (Upstream) をサーバーDBへ一括反映
    // トランザクション処理で一貫性を担保
    const clientTasks = changes.tasks || [];
    if (clientTasks.length > 0) {
      await prisma.$transaction(
        clientTasks.map((task: LocalTask) => {
          // syncStatus に応じたUPSERT
          // deletedAtの扱いは現時点ではisCompletedのみだが将来の拡張にも対応可能
          return prisma.task.upsert({
            where: { id: task.id },
            update: {
              title: task.title,
              isCompleted: task.isCompleted,
              updatedAt: new Date(task.updatedAt),
              // createdAt は初回のみ
            },
            create: {
              id: task.id,
              userId: userId,
              title: task.title,
              isCompleted: task.isCompleted,
              createdAt: new Date(task.createdAt),
              updatedAt: new Date(task.updatedAt),
              progress: 0,
            },
          });
        }),
      );
    }

    // 2. サーバー側の最新データを取得 (Downstream)
    // 前回同期日時以降にサーバー側で更新されたタスクを取得
    // ※ 初回同期時 (lastSyncedAt = 0) は全件取得される
    const serverSyncDate = new Date(lastSyncedAt);

    const updatedTasks = await prisma.task.findMany({
      where: {
        userId: userId,
        updatedAt: {
          gt: serverSyncDate,
        },
      },
    });

    // クライアントが扱いやすいフォーマット (LocalTask 準拠) に変換
    const responseTasks = updatedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      isCompleted: t.isCompleted,
      createdAt: t.createdAt.getTime(),
      updatedAt: t.updatedAt.getTime(),
      _syncStatus: 'synced', // サーバーから来た時点で同期済み扱い
    }));

    return successResponse({
      pulledChanges: {
        tasks: responseTasks,
      },
      // 次の lastSyncedAt となる現在時刻
      timestamp: Date.now(),
    });
  });
};
