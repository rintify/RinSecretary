import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, createSession } from '@/lib/auth';

interface RegisterRequest {
  name: string;
  nickname: string;
  password: string;
}

const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 15;
const MAX_NICKNAME_LENGTH = 50;
const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterRequest;
    const { name, nickname, password } = body;

    if (!name || !nickname || !password) {
      return NextResponse.json({ error: 'すべての項目を入力してください' }, { status: 400 });
    }

    if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `ユーザーIDは${MIN_NAME_LENGTH}文字以上${MAX_NAME_LENGTH}文字以内で入力してください` },
        { status: 400 },
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        { error: 'ユーザーIDには半角英数字、ハイフン、アンダースコアのみ使用できます' },
        { status: 400 },
      );
    }

    if (nickname.length > MAX_NICKNAME_LENGTH) {
      return NextResponse.json(
        { error: `ニックネームは${MAX_NICKNAME_LENGTH}文字以内で入力してください` },
        { status: 400 },
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください` },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { name },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'このユーザー名は既に使用されています' }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        nickname,
        password: hashedPassword,
      },
    });

    await createSession(user.id);

    return NextResponse.json(
      {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        plan: user.plan,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
