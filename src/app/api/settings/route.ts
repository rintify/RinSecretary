import { createApiHandler, errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { NextRequest } from 'next/server';

export const GET = async () => {
  return createApiHandler(async () => {
    const session = await auth();
    if (!session || !session.user?.id) {
      return errorResponse('Unauthorized', 401);
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    if (!settings) {
      const newSettings = await prisma.userSettings.create({
        data: {
          userId: session.user.id,
          aiProvider: 'openai', // デフォルト値
        },
      });
      return successResponse(newSettings);
    }

    // クライアントへ返す際にAPIキーをマスクする
    const safeSettings = { ...settings };
    if (safeSettings.aiApiKeyEncoded) {
      safeSettings.aiApiKeyEncoded = '********';
    }

    return successResponse(safeSettings);
  });
};

export const POST = async (req: NextRequest) => {
  return createApiHandler(async () => {
    const session = await auth();
    if (!session || !session.user?.id) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await req.json();
    const { aiProvider, aiApiKeyEncoded, aiModelPreference, discordWebhookUrl, pushoverUserKey } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      aiProvider,
      aiModelPreference,
      discordWebhookUrl,
      pushoverUserKey,
    };

    // マスク文字列のまま送信された場合は更新しない
    if (aiApiKeyEncoded && aiApiKeyEncoded !== '********') {
      // 実際はここで暗号化ロジックを入れる等
      updateData.aiApiKeyEncoded = aiApiKeyEncoded;
    } else if (aiApiKeyEncoded === '') {
      updateData.aiApiKeyEncoded = null; // 空文字送信で削除
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: {
        userId: session.user.id,
        aiProvider: aiProvider || 'openai',
        aiApiKeyEncoded: updateData.aiApiKeyEncoded,
        aiModelPreference,
        discordWebhookUrl,
        pushoverUserKey,
      },
    });

    const safeSettings = { ...settings };
    if (safeSettings.aiApiKeyEncoded) {
      safeSettings.aiApiKeyEncoded = '********';
    }

    return successResponse(safeSettings);
  });
};
