import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

const E2E_TEST_USER = {
  name: 'testuser',
  nickname: 'テストユーザー',
  password: 'testpassword123',
};

export async function POST() {
  if (process.env.E2E_TESTING !== 'true') {
    return NextResponse.json({ error: 'Not available outside E2E testing' }, { status: 403 });
  }

  try {
    // 全テーブルのデータを削除（外部キー制約順）
    await prisma.session.deleteMany();
    await prisma.event.deleteMany();
    await prisma.task.deleteMany();
    await prisma.alarm.deleteMany();
    await prisma.systemSetting.deleteMany();
    await prisma.user.deleteMany();

    // テストユーザーを作成
    const hashedPassword = await hashPassword(E2E_TEST_USER.password);
    const user = await prisma.user.create({
      data: {
        name: E2E_TEST_USER.name,
        nickname: E2E_TEST_USER.nickname,
        password: hashedPassword,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
      },
    });
  } catch (error) {
    console.error('E2E reset failed:', error);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
