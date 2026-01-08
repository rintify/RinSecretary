import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { extractTitle, extractThumbnail } from '@/lib/memo-utils';



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
  const lastUpdatedAt = json.lastUpdatedAt ? new Date(json.lastUpdatedAt) : undefined;
  const force = json.force === true;

  if (!force && lastUpdatedAt) {
      const dbUpdatedAt = new Date(existing.updatedAt).getTime();
      const clientUpdatedAt = lastUpdatedAt.getTime();
      
      if (dbUpdatedAt > clientUpdatedAt) {
          return NextResponse.json({ error: 'Conflict', serverContent: existing.content, updatedAt: existing.updatedAt }, { status: 409 });
      }
  }

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
  
  const existing = await prisma.memo.findUnique({ 
    where: { id },
    include: { attachments: true }
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (existing.userId !== user?.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Delete physical files and update storage usage
  const { unlinkFile, updateStorageUsage } = await import('@/lib/storage');
  for (const att of existing.attachments) {
    const filename = att.filePath.split('/').pop();
    if (filename) {
      await unlinkFile(filename);
      await updateStorageUsage(-att.fileSize);
    }
  }

  await prisma.memo.delete({ where: { id } });

  revalidatePath('/memos');

  return NextResponse.json({ success: true });
}
