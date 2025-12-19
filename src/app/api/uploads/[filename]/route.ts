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
  // Next.js Image Optimizationがアクセスできるように認証を除外
  // const session = await auth();
  // if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  // Range request handling
  const stat = fs.statSync(filepath);
  const fileSize = stat.size;
  const range = request.headers.get('range');

  const ext = filename.split('.').pop()?.toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === 'png') contentType = 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
  if (ext === 'gif') contentType = 'image/gif';
  if (ext === 'webp') contentType = 'image/webp';
  if (ext === 'svg') contentType = 'image/svg+xml';
  if (ext === 'mp3') contentType = 'audio/mpeg';
  if (ext === 'wav') contentType = 'audio/wav';
  if (ext === 'mp4') contentType = 'video/mp4';
  if (ext === 'webm') contentType = 'video/webm';
  if (ext === 'pdf') contentType = 'application/pdf';
  if (ext === 'txt') contentType = 'text/plain';

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filepath, { start, end });
    
    // @ts-ignore: Next.js StreamableFile support (or generic ReadableStream)
    return new NextResponse(file, {
        status: 206,
        headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize.toString(),
            'Content-Type': contentType,
        }
    });
  } else {
    const file = fs.createReadStream(filepath);
    // @ts-ignore
    return new NextResponse(file, {
        headers: {
            'Content-Length': fileSize.toString(),
            'Content-Type': contentType,
            'Cache-Control': 'private, max-age=3600',
        }
    });
  }
}
