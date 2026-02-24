import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSession } from '@/lib/auth';

interface LoginRequest {
  name: string;
  password: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginRequest;
    const { name, password } = body;

    if (!name || !password) {
      return NextResponse.json({ error: 'ユーザー名とパスワードを入力してください' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { name },
    });

    if (!user) {
      return NextResponse.json({ error: 'ユーザー名またはパスワードが正しくありません' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'ユーザー名またはパスワードが正しくありません' }, { status: 401 });
    }

    await createSession(user.id);

    return NextResponse.json({
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      plan: user.plan,
    });
  } catch {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
