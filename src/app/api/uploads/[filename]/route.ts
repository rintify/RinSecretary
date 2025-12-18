import { devAuth as auth } from '@/lib/dev-auth';
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import fs from 'fs';

export async function GET(
  request: Request,
  props: { params: Promise<{ filename: string }> }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const filename = params.filename;
  // Security check: prevent directory traversal
  if (filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const uploadDir = process.env.UPLOADS_DIR || join(process.cwd(), 'data/uploads');
  const filepath = join(uploadDir, filename);

  if (!fs.existsSync(filepath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const file = await readFile(filepath);
  
  const ext = filename.split('.').pop()?.toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === 'png') contentType = 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
  if (ext === 'gif') contentType = 'image/gif';
  if (ext === 'webp') contentType = 'image/webp';
  if (ext === 'svg') contentType = 'image/svg+xml';

  return new NextResponse(file, {
      headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=3600',
      }
  });
}
