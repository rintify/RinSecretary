'use server';

import { devAuth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { writeFile, copyFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs';
import { extractTitle, extractThumbnail } from '@/lib/memo-utils';

import { UPLOAD_DIR, ensureDir, SERVER_MAX_STORAGE_BYTES, getCurrentStorageUsage, updateStorageUsage } from '@/lib/storage';

export async function uploadSharedFile(formData: FormData) {
    const session = await devAuth();
    if (!session?.user?.email) throw new Error('Unauthorized');
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error('User not found');

    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    
    // Check using cached system setting
    const currentTotal = await getCurrentStorageUsage();

    if (currentTotal + file.size > SERVER_MAX_STORAGE_BYTES) {
        throw new Error('Server storage limit exceeded (3GB)');
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const nameParts = file.name.split('.');
    const ext = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
    const filename = `${randomUUID()}${ext}`;
    
    ensureDir(UPLOAD_DIR);
    const filepath = join(UPLOAD_DIR, filename);
    await writeFile(filepath, buffer);
    const url = `/api/uploads/${filename}`;

    const sharedFile = await prisma.sharedFile.create({
        data: {
            fileName: file.name,
            filePath: url,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
            userId: user.id,
        }
    });

    await updateStorageUsage(file.size);
 
    return {
        ...sharedFile,
        fileSize: Number(sharedFile.fileSize)
    };
}

export async function getLatestSharedFile() {
    const session = await devAuth();
    if (!session?.user?.email) return null;

    // Verify it's recent and from the SAME USER (or authorized group)
    // The requirement is "restrict sharing to same account".
    // Since devAuth identifies the user, we just check where userId matches.
    
    // First find the user to get their ID if session only has email
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return null;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const latest = await prisma.sharedFile.findFirst({
        where: { 
            createdAt: { gt: oneDayAgo },
            userId: user.id
        },
        orderBy: { createdAt: 'desc' }
    });

    return latest ? {
        ...latest,
        fileSize: Number(latest.fileSize)
    } : null;
}

export async function saveSharedFileToMemo(sharedFileId: string) {
    const session = await devAuth();
    if (!session?.user?.email) throw new Error('Unauthorized');

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error('User not found');

    const sharedFile = await prisma.sharedFile.findUnique({ where: { id: sharedFileId } });
    if (!sharedFile) throw new Error('Shared file not found');

    // Copy file to create a new independent attachment
    const originalFilename = sharedFile.filePath.split('/').pop();
    if (!originalFilename) throw new Error('Invalid file path');
    
    const sourcePath = join(UPLOAD_DIR, originalFilename);
    const newFilename = `${randomUUID()}_${originalFilename}`; // Ensure unique
    const destPath = join(UPLOAD_DIR, newFilename);

    if (!fs.existsSync(sourcePath)) throw new Error('Source file missing');
    
    await copyFile(sourcePath, destPath);
    const newUrl = `/api/uploads/${newFilename}`;

    // Create Memo
    const isImage = sharedFile.mimeType.startsWith('image/');
    const markdown = isImage 
        ? `![${sharedFile.fileName}](${newUrl})` 
        : `[${sharedFile.fileName}](${newUrl})`;
    
    const title = extractTitle(markdown);
    const thumbnailPath = extractThumbnail(markdown);

    const memo = await prisma.memo.create({
        data: {
            title,
            content: markdown,
            userId: user.id,
            thumbnailPath,
        }
    });

    // Create Attachment record
    await prisma.attachment.create({
        data: {
            fileName: sharedFile.fileName,
            filePath: newUrl,
            fileSize: sharedFile.fileSize,
            mimeType: sharedFile.mimeType,
            memoId: memo.id,
        }
    });

    await updateStorageUsage(sharedFile.fileSize); // New file created

    revalidatePath('/memos');
    return memo;
}

export async function deleteSharedFile(sharedFileId: string) {
    const session = await devAuth();
    if (!session?.user?.email) throw new Error('Unauthorized');

    const sharedFile = await prisma.sharedFile.findUnique({ where: { id: sharedFileId } });
    if (!sharedFile) return; // Already deleted

    // Delete physical file
    const filename = sharedFile.filePath.split('/').pop();
    if (filename) {
        const filepath = join(UPLOAD_DIR, filename);
        if (fs.existsSync(filepath)) {
            await fs.promises.unlink(filepath).catch(console.error);
        }
    }

    await updateStorageUsage(-sharedFile.fileSize);

    // Delete DB record
    await prisma.sharedFile.delete({ where: { id: sharedFileId } });
}
