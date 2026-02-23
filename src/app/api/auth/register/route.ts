import { createApiHandler, errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

export const POST = async (req: NextRequest) => {
  return createApiHandler(async () => {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return errorResponse('メールアドレスとパスワードは必須です', 400);
    }

    // すでに同じメールアドレスが存在するかチェック
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return errorResponse('このメールアドレスは既に登録されています', 400);
    }

    // パスワードのハッシュ化
    const passwordHash = await bcrypt.hash(password, 10);

    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
      },
    });

    return successResponse(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      201,
    );
  });
};
