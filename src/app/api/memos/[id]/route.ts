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

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const id = params.id;
  
  const memo = await prisma.memo.findUnique({ where: { id } });
  if (!memo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (memo.userId !== user?.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json(memo);
}

export async function PUT(
  request: Request, 
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = params.id;
  const json = await request.json();

  const existing = await prisma.memo.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (existing.userId !== user?.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const content = json.content;
  const title = extractTitle(content);
  const thumbnailPath = extractThumbnail(content);

  const memo = await prisma.memo.update({
    where: { id },
    data: {
      title,
      content,
      thumbnailPath
    },
  });

  revalidatePath('/memos');
  revalidatePath(`/memos/${id}`);

  return NextResponse.json(memo);
}

export async function DELETE(
  request: Request, 
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = params.id;
  
  const existing = await prisma.memo.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (existing.userId !== user?.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.memo.delete({ where: { id } });

  revalidatePath('/memos');

  return NextResponse.json({ success: true });
}
