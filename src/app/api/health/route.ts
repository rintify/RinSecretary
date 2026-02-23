import { createApiHandler, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

export const GET = async () => {
  return createApiHandler(async () => {
    // データベースアクセスが正常に動くか検証
    const userCount = await prisma.user.count();

    return successResponse({
      status: 'ok',
      dbConnection: 'success',
      userCount,
      timestamp: new Date().toISOString(),
    });
  });
};
