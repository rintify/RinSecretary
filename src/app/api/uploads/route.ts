import { devAuth as auth } from '@/lib/dev-auth';
import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

const MAX_TOTAL_SIZE = 3 * 1024 * 1024 * 1024; // 3GB

const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
};

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
    const totalSizeResult = await prisma.attachment.aggregate({
        _sum: {
            fileSize: true
        }
    });
    const currentTotalSize = totalSizeResult._sum.fileSize || 0;
    if (currentTotalSize + file.size > MAX_TOTAL_SIZE) {
        return NextResponse.json({ error: 'サーバーの総アップロード容量制限(3GB)を超えています' }, { status: 400 });
    }

    const nameParts = file.name.split('.');
    const ext = nameParts.length > 1 ? `.${nameParts.pop()}` : '';
    const filename = `${randomUUID()}${ext}`;
    
    // UPLOADS_DIR from env or default to root/data/uploads which maps to volume in docker
    const uploadDir = process.env.UPLOADS_DIR || join(process.cwd(), 'data/uploads');
    ensureDir(uploadDir);

    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);
    
    return NextResponse.json({ url: `/api/uploads/${filename}` });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
