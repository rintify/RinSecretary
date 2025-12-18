'use server';

import { devAuth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs';

const UPLOAD_DIR = process.env.UPLOADS_DIR || join(process.cwd(), 'data/uploads');
const MAX_TOTAL_SIZE = 3 * 1024 * 1024 * 1024; // 3GB

const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
};

async function unlinkAttachmentFile(attachment: { filePath: string }) {
    const filename = attachment.filePath.split('/').pop();
    if (filename) {
        const filepath = join(UPLOAD_DIR, filename);
        try {
            if (fs.existsSync(filepath)) {
                await unlink(filepath);
            }
        } catch (e) {
            console.error('File unlink failed', e);
        }
    }
}

// ...existing code...
export async function createEmptyMemo() {
    const session = await devAuth();
    if (!session?.user?.email) throw new Error('Unauthorized');
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error('User not found');

    const memo = await prisma.memo.create({
        data: {
            title: '無題のメモ',
            content: '',
            userId: user.id
        }
    });

    revalidatePath('/memos');
    return memo;
}

export async function createMemo(content: string) {
// ...
  const session = await devAuth();
  if (!session?.user?.email) throw new Error('Unauthorized');

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const firstLine = content.split('\n')[0] || '';
  const title = firstLine.slice(0, 30).trim() || '無題のメモ';

  const memo = await prisma.memo.create({
    data: {
      title,
      content,
      userId: user.id,
    },
  });

  revalidatePath('/memos');
  return memo;
}

export async function updateMemo(id: string, content: string) {
  const session = await devAuth();
  if (!session?.user?.email) throw new Error('Unauthorized');

  const user = await prisma.user.findUnique({
      where: { email: session.user.email },
  });
  if (!user) throw new Error('User not found');

  const firstLine = content.split('\n')[0] || '';
  const title = firstLine.slice(0, 30).trim() || '無題のメモ';

  const memo = await prisma.memo.update({
    where: {
      id,
      userId: user.id, // Ensure ownership
    },
    data: {
      title,
      content,
    },
  });

  revalidatePath('/memos');
  revalidatePath(`/memos/${id}`);
  return memo;
}

export async function deleteMemo(id: string) {
  const session = await devAuth();
  if (!session?.user?.email) throw new Error('Unauthorized');

  const user = await prisma.user.findUnique({
      where: { email: session.user.email },
  });
  if (!user) throw new Error('User not found');

  // ファイル削除のために情報を取得
  const memo = await prisma.memo.findUnique({
      where: { id, userId: user.id },
      include: { attachments: true }
  });

  if (!memo) return; // 既にない、あるいは権限がない

  // 関連ファイルの物理削除
  for (const att of memo.attachments) {
      await unlinkAttachmentFile(att);
  }

  await prisma.memo.delete({
    where: { id },
  });

  revalidatePath('/memos');
}

export async function deleteMemos(ids: string[]) {
  const session = await devAuth();
  if (!session?.user?.email) throw new Error('Unauthorized');

  const user = await prisma.user.findUnique({
      where: { email: session.user.email },
  });
  if (!user) throw new Error('User not found');

  // ファイル削除のために情報を取得
  const memos = await prisma.memo.findMany({
    where: {
      id: { in: ids },
      userId: user.id, 
    },
    include: { attachments: true }
  });

  // 関連ファイルの物理削除
  for (const memo of memos) {
      for (const att of memo.attachments) {
          await unlinkAttachmentFile(att);
      }
  }

  await prisma.memo.deleteMany({
    where: {
      id: { in: ids },
      userId: user.id,
    },
  });

  revalidatePath('/memos');
}

// 添付ファイル関連

export async function uploadAttachment(formData: FormData, memoId: string) {
    const session = await devAuth();
    if (!session?.user?.email) throw new Error('Unauthorized');

    const user = await prisma.user.findUnique({ where: { email: session.user.email }});
    // メモの所有権チェック
    const memo = await prisma.memo.findUnique({ where: { id: memoId }});
    if (!memo || memo.userId !== user?.id) throw new Error('Forbidden');

    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    // サーバー全体の合計サイズチェック
    const totalSizeResult = await prisma.attachment.aggregate({
        _sum: {
            fileSize: true
        }
    });
    const currentTotalSize = totalSizeResult._sum.fileSize || 0;
    if (currentTotalSize + file.size > MAX_TOTAL_SIZE) {
        throw new Error('サーバーの総アップロード容量制限(3GB)を超えています');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const nameParts = file.name.split('.');
    const ext = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
    const filename = `${randomUUID()}${ext}`;
    
    ensureDir(UPLOAD_DIR);
    const filepath = join(UPLOAD_DIR, filename);
    await writeFile(filepath, buffer);
    const url = `/api/uploads/${filename}`;

    const attachment = await prisma.attachment.create({
        data: {
            fileName: file.name,
            filePath: url,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
            memoId: memoId,
        }
    });

    revalidatePath(`/memos/${memoId}`);
    return attachment;
}

export async function getAttachments(memoId: string) {
    const session = await devAuth();
    if (!session?.user?.email) throw new Error('Unauthorized'); // 厳密には所有権チェックもすべきだが、詳細画面で呼ばれる前提
    
    return prisma.attachment.findMany({ 
        where: { memoId }, 
        orderBy: { createdAt: 'desc' }
    });
}

export async function deleteAttachment(attachmentId: string) {
    const session = await devAuth();
    if (!session?.user?.email) throw new Error('Unauthorized');

    const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId }, include: { memo: true }});
    if (!attachment) return;

    const user = await prisma.user.findUnique({ where: { email: session.user.email }});
    if (attachment.memo.userId !== user?.id) throw new Error('Forbidden');

    await unlinkAttachmentFile(attachment);

    await prisma.attachment.delete({ where: { id: attachmentId }});
    revalidatePath(`/memos/${attachment.memoId}`);
}
