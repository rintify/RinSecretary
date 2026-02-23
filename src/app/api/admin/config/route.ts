import { createApiHandler, errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { NextRequest } from 'next/server';

export const GET = async (req: NextRequest) => {
  return createApiHandler(async () => {
    // 実際の実装では管理機能かどうかのロールチェック等が必要
    const session = await auth();
    if (!session || !session.user?.id) {
      return errorResponse('Unauthorized', 401);
    }

    const key = req.nextUrl.searchParams.get('key') || 'STORAGE_QUOTA_BYTES';

    let config = await prisma.systemGlobalConfig.findUnique({
      where: { key },
    });

    if (!config) {
      config = await prisma.systemGlobalConfig.create({
        data: {
          id: `global_${key}`,
          key: key,
          value: key === 'STORAGE_QUOTA_BYTES' ? '3145728000' : '', // デフォルト 3GB
        },
      });
    }

    return successResponse(config);
  });
};

export const POST = async (req: NextRequest) => {
  return createApiHandler(async () => {
    const session = await auth();
    if (!session || !session.user?.id) {
      return errorResponse('Unauthorized', 401);
    }

    const { key, value } = await req.json();
    if (!key || value === undefined || value === null) {
      return errorResponse('Key and value are required', 400);
    }

    const config = await prisma.systemGlobalConfig.upsert({
      where: { key },
      update: { value: String(value) },
      create: {
        id: `global_${key}`,
        key: key,
        value: String(value),
      },
    });

    return successResponse(config);
  });
};
