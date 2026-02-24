import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { UPLOAD_DIR } from '@/lib/storage';

export async function POST(request: NextRequest) {
  // 環境変数のチェック (本番環境での誤動作防止)
  if (process.env.E2E_TESTING !== 'true') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    console.log('[API] Resetting database and storage for E2E test...');

    // 1. 物理ファイルの削除
    if (fs.existsSync(UPLOAD_DIR)) {
      const files = await fs.promises.readdir(UPLOAD_DIR);
      for (const file of files) {
        if (file === '.keep') continue; // .keep ファイルなどは残す場合
        await fs.promises.unlink(path.join(UPLOAD_DIR, file));
      }
    }

    // 2. データベースの全削除
    // Userを削除するとCascadeで関連データ(Memo, Task等)も消える
    // 先にUser以外で紐づかないものがあれば削除する必要があるが、
    // schemaを見る限りUserへのRelationが必須のものが多い。
    // SharedFileはUserへのRelationがOptional/Legacyだが、とりあえず消す。
    
    await prisma.sharedFile.deleteMany();
    await prisma.job.deleteMany();
    await prisma.systemSetting.deleteMany();
    
    // User削除 (これにより Memo, Task, Alarm, MailSummary, etc. が消える)
    await prisma.user.deleteMany();

    // 3. テストユーザーの再作成
    // dev-auth.ts や seed で使われる固定のユーザーを作成
    const userId = 'dev-user'; // 固定ID
    await prisma.user.create({
      data: {
        id: userId,
        name: 'Dev User',
        email: 'dev@example.com',
        // その他必要な初期値があれば設定
      }
    });

    // 4. SystemSetting (Storage Usage) の初期化
    await prisma.systemSetting.create({
      data: {
        key: 'storage_usage_bytes',
        value: '0'
      }
    });

    console.log('[API] Reset complete.');
    return NextResponse.json({ message: 'Reset complete' });

  } catch (error) {
    console.error('[API] Reset failed:', error);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
