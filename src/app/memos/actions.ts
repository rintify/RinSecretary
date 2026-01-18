'use server';

import { devAuth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs';
import { extractTitle, extractThumbnail } from '@/lib/memo-utils';
import { generateServerFilename } from '@/lib/file-utils';

import { getCurrentStorageUsage, updateStorageUsage, SERVER_MAX_STORAGE_BYTES, ensureDir, UPLOAD_DIR, unlinkFile } from '@/lib/storage';

const MAX_TOTAL_SIZE = SERVER_MAX_STORAGE_BYTES; // 3GB

async function unlinkAttachmentFile(attachment: { filePath: string }) {
    const filename = attachment.filePath.split('/').pop();
    if (filename) {
        await unlinkFile(filename);
    }
}

export async function getMemos({ 
    skip = 0, 
    take = 20, 
    query = '' 
}: { 
    skip?: number; 
    take?: number; 
    query?: string; 
}) {
    const session = await devAuth();
    if (!session?.user?.email) throw new Error('Unauthorized');
    
    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
    });
    if (!user) throw new Error('User not found');

    const where: any = {
        userId: user.id,
        isDeleted: false,
    };

    if (query) {
        where.OR = [
            { title: { contains: query } },
            { content: { contains: query } }
        ];
    }

    const memos = await prisma.memo.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        select: {
            id: true,
            title: true,
            updatedAt: true,
            thumbnailPath: true,
            createdAt: true,
            userId: true,
        },
    });

    return memos;
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
            userId: user.id,
            thumbnailPath: null,
        }
    });

    revalidatePath('/memos');
    return memo;
}

export async function createMemo(content: string) {
  const session = await devAuth();
  if (!session?.user?.email) throw new Error('Unauthorized');

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return createMemoInternal(user.id, content);
}

export async function createMemoInternal(userId: string, content: string) {
  const title = extractTitle(content);
  const thumbnailPath = extractThumbnail(content);

  const memo = await prisma.memo.create({
    data: {
      title,
      content,
      userId,
      thumbnailPath,
    },
  });

  revalidatePath('/memos');
  return memo;
}

export async function updateMemo(id: string, content: string, lastUpdatedAt?: Date, force: boolean = false) {
  const session = await devAuth();
  if (!session?.user?.email) throw new Error('Unauthorized');

  const user = await prisma.user.findUnique({
      where: { email: session.user.email },
  });
  if (!user) throw new Error('User not found');

  // Fetch current memo for conflict check
  const currentMemo = await prisma.memo.findUnique({
      where: { id, userId: user.id }
  });

  if (!currentMemo) throw new Error('Memo not found');

  if (!force && lastUpdatedAt) {
      const dbUpdatedAt = new Date(currentMemo.updatedAt).getTime();
      const clientUpdatedAt = new Date(lastUpdatedAt).getTime();
      
      if (dbUpdatedAt > clientUpdatedAt) {
          return { error: 'Conflict' };
      }
  }

  const title = extractTitle(content);
  const thumbnailPath = extractThumbnail(content);

  const memo = await prisma.memo.update({
    where: {
      id,
      userId: user.id,
    },
    data: {
      title,
      content,
      thumbnailPath,
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

  const now = new Date();
  
  // 関連添付ファイルの処理
  for (const att of memo.attachments) {
      // 論理削除をマーク（同期イベントを他端末に伝えるため）
      if (!att.isDeleted) {
          await prisma.attachment.update({
              where: { id: att.id },
              data: { isDeleted: true, deletedAt: now, filePath: '' }
          });
      }
      // 物理ファイル削除
      await unlinkAttachmentFile(att);
      await updateStorageUsage(-att.fileSize);
  }

  // 論理削除に変更（同期APIと動作を統一）
  await prisma.memo.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: now,
    },
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

  const now = new Date();

  // 関連添付ファイルの処理
  for (const memo of memos) {
      for (const att of memo.attachments) {
          // 論理削除をマーク（同期イベントを他端末に伝えるため）
          if (!att.isDeleted) {
              await prisma.attachment.update({
                  where: { id: att.id },
                  data: { isDeleted: true, deletedAt: now, filePath: '' }
              });
          }
          // 物理ファイル削除
          await unlinkAttachmentFile(att);
          await updateStorageUsage(-att.fileSize);
      }
  }

  // 論理削除に変更（同期APIと動作を統一）
  const now2 = new Date();
  await prisma.memo.updateMany({
    where: {
      id: { in: ids },
      userId: user.id,
    },
    data: {
      isDeleted: true,
      deletedAt: now2,
    },
  });

  revalidatePath('/memos');
}

export async function createMemoWithFile(formData: FormData) {
    const session = await devAuth();
    if (!session?.user?.email) throw new Error('Unauthorized');

    const user = await prisma.user.findUnique({ where: { email: session.user.email }});
    if (!user) throw new Error('User not found');

    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    const memo = await prisma.memo.create({
        data: {
            title: 'アップロード中...',
            content: '',
            userId: user.id,
            thumbnailPath: null,
        }
    });

    let filename = '';
    
    try {
        const currentTotalSize = await getCurrentStorageUsage();

        if (currentTotalSize + file.size > SERVER_MAX_STORAGE_BYTES) {
            throw new Error('Over storage limit (Cached Check)');
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Use common util
        filename = generateServerFilename(randomUUID(), file.name);
        
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
                memoId: memo.id,
            }
        });

        const isImage = file.type.startsWith('image/');
        const markdown = isImage 
            ? `![${file.name}](${attachment.filePath})` 
            : `[${file.name}](${attachment.filePath})`;
        
        const title = extractTitle(markdown);
        const thumbnailPath = extractThumbnail(markdown);

        await prisma.memo.update({
            where: { id: memo.id },
            data: {
                title,
                content: markdown,
                thumbnailPath
            }
        });

        revalidatePath('/memos');
        
        // Update storage usage
        await updateStorageUsage(file.size);
        
        return { success: true, memoId: memo.id };

    } catch (e) {
        // DB Failed: Cleanup memo and file
        await prisma.memo.delete({ where: { id: memo.id }});
        
        // Cleanup file if it was created
        // We need filename to cleanup. 
        // Re-generate filename logic (deterministic if we have the inputs)
        // OR better: define filename earlier outside try block? 
        // But here we defined it inside. 
        
        // Actually, 'unlinkFile' handles non-existent files gracefully.
        // We just need to capture the filename generated inside the try block.
        // Let's refactor to define filename outside.
        
        if (filename) {
            await unlinkFile(filename);
        }
        
        console.error(e);
        throw e;
    }
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
    const fileId = formData.get('id') as string | null;

    if (!file) throw new Error('No file provided');

    // サーバー全体の合計サイズチェック
    const currentTotalSize = await getCurrentStorageUsage();

    if (currentTotalSize + file.size > SERVER_MAX_STORAGE_BYTES) {
        throw new Error('サーバーの総アップロード容量制限(3GB)を超えています (Cached Check)');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Use provided ID or generate new. Note: ID collision logic below handles idempotency.
    const attachmentId = fileId || randomUUID(); 
    const filename = generateServerFilename(attachmentId, file.name);
    
    // Idempotency: Check if attachment already exists
    if (fileId) {
        const existing = await prisma.attachment.findUnique({
            where: { id: fileId }
        });
        if (existing) {
            // Check ownership/match
            if (existing.memoId === memoId) {
                // Already uploaded. Treat as success.
                return {
                    ...existing,
                    fileSize: Number(existing.fileSize)
                };
            } else {
                 // ID conflict with different memo? Should not happen with UUIDs, but if so, error.
                 throw new Error('Attachment ID conflict');
            }
        }
    }
    
    // 競合防止: 先にDBレコードを作成し、その後ファイルを書き込む
    // これによりユニーク制約でIDの衝突を先に検知でき、不正なファイル削除を防ぐ
    ensureDir(UPLOAD_DIR);
    const filepath = join(UPLOAD_DIR, filename);
    const url = `/api/uploads/${filename}`;

    let attachment;
    try {
        attachment = await prisma.attachment.create({
            data: {
                id: attachmentId,
                fileName: file.name,
                filePath: url,
                fileSize: file.size,
                mimeType: file.type || 'application/octet-stream',
                memoId: memoId,
            }
        });
    } catch (dbError: any) {
        // ユニーク制約違反の場合、他のリクエストが勝った可能性があるので再取得
        if (dbError.code === 'P2002') {
            const existing = await prisma.attachment.findUnique({ where: { id: attachmentId } });
            if (existing && existing.memoId === memoId) {
                return { ...existing, fileSize: Number(existing.fileSize) };
            }
        }
        throw dbError;
    }

    // DBレコード作成成功、ファイルを書き込む
    try {
        await writeFile(filepath, buffer);
    } catch (fileError) {
        // ファイル書き込み失敗、DBレコードをロールバック（物理削除）
        console.error('File write failed, rolling back DB record:', fileError);
        await prisma.attachment.delete({ where: { id: attachmentId } });
        throw fileError;
    }

    // ストレージ使用量更新（失敗時はレコードとファイルをロールバック）
    try {
        await updateStorageUsage(file.size);
    } catch (storageError) {
        console.error('Storage usage update failed, rolling back:', storageError);
        await unlinkFile(filename);
        await prisma.attachment.delete({ where: { id: attachmentId } });
        throw storageError;
    }

    revalidatePath(`/memos/${memoId}`);

    return {
        ...attachment,
        fileSize: Number(attachment.fileSize)
    };
}

export async function getAttachments(memoId: string) {
    const session = await devAuth();
    if (!session?.user?.email) throw new Error('Unauthorized'); // 厳密には所有権チェックもすべきだが、詳細画面で呼ばれる前提
    
    const attachments = await prisma.attachment.findMany({ 
        where: { memoId }, 
        orderBy: { createdAt: 'desc' }
    });

    return attachments.map(att => ({
        ...att,
        fileSize: Number(att.fileSize)
    }));
}

export async function deleteAttachment(attachmentId: string) {
    const session = await devAuth();
    if (!session?.user?.email) throw new Error('Unauthorized');

    const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId }, include: { memo: true }});
    if (!attachment) return;
    
    // 既に論理削除済みの場合は何もしない（二重減算防止）
    if (attachment.isDeleted) return;

    const user = await prisma.user.findUnique({ where: { email: session.user.email }});
    if (attachment.memo.userId !== user?.id) throw new Error('Forbidden');

    // 物理ファイルを削除し、容量を更新（filePathが空でない場合のみ）
    if (attachment.filePath) {
        await unlinkAttachmentFile(attachment);
        await updateStorageUsage(-attachment.fileSize);
    }

    // 論理削除に変更（レコードは残して他端末への同期に使用）
    await prisma.attachment.update({ 
        where: { id: attachmentId },
        data: { 
            isDeleted: true, 
            deletedAt: new Date(),
            filePath: '' // ファイルパスをクリア
        }
    });
    
    // サムネイルリンク切れ対策: 削除した添付がサムネイルだった場合、再計算
    if (attachment.memo.thumbnailPath === attachment.filePath) {
        const newThumbnail = extractThumbnail(attachment.memo.content);
        // 削除したファイルと同じパスの場合はnullにする
        const finalThumbnail = newThumbnail === attachment.filePath ? null : newThumbnail;
        await prisma.memo.update({
            where: { id: attachment.memoId },
            data: { thumbnailPath: finalThumbnail }
        });
    }
    
    revalidatePath(`/memos/${attachment.memoId}`);
}
