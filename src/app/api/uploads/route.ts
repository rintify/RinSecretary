import { devAuth as auth } from '@/lib/dev-auth';
import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

import { getCurrentStorageUsage, updateStorageUsage, SERVER_MAX_STORAGE_BYTES, UPLOAD_DIR } from '@/lib/storage';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // サーバー全体の合計サイズチェック
    const currentTotalSize = await getCurrentStorageUsage();

    if (currentTotalSize + file.size > SERVER_MAX_STORAGE_BYTES) {
        return NextResponse.json({ error: 'サーバーの総アップロード容量制限(3GB)を超えています (Cached Check)' }, { status: 400 });
    }

    const nameParts = file.name.split('.');
    const ext = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
    const filename = `${randomUUID()}${ext}`;
    
    // UPLOADS_DIR from storage.ts
    const uploadDir = UPLOAD_DIR;
    
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);
    
    await updateStorageUsage(file.size);

    return NextResponse.json({ url: `/api/uploads/${filename}` });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
