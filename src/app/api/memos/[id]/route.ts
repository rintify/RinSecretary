import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

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

  const memo = await prisma.memo.update({
    where: { id },
    data: {
      title: json.title,
      content: json.content,
    },
  });

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

  return NextResponse.json({ success: true });
}
