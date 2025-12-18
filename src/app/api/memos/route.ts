import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

function extractTitle(content: string): string {
  const lines = content.split('\n');
  const firstLine = lines.find(line => line.trim().length > 0) || '';
  const title = firstLine.trim().slice(0, 30);
  return title || '無題のメモ';
}

function extractThumbnail(content: string): string | null {
  const match = content.match(/!\[.*?\]\((.*?)\)/);
  return match ? match[1] : null;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const memos = await prisma.memo.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(memos);
  } catch (error) {
    console.error('Failed to fetch memos:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await request.json();
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const content = json.content || '';
    const title = extractTitle(content);
    const thumbnailPath = extractThumbnail(content);

    const memo = await prisma.memo.create({
      data: {
        title,
        content,
        userId: user.id,
        thumbnailPath,
      },
    });

    revalidatePath('/memos');

    return NextResponse.json(memo);
  } catch (error) {
    console.error('Failed to create memo:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
