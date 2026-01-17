import { NextResponse } from 'next/server';
import { devAuth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const session = await devAuth();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id!;
    const { searchParams } = new URL(req.url);
    
    const cursor = searchParams.get('cursor'); // ISO date string
    const limit = parseInt(searchParams.get('limit') || '20');

    const memos = await prisma.memo.findMany({
        where: {
            userId,
            ...(cursor ? { updatedAt: { lt: new Date(cursor) } } : {})
        },
        orderBy: { updatedAt: 'desc' },
        take: limit + 1, // 次ページ存在確認用に1件多く取得
    });

    const hasMore = memos.length > limit;
    const items = hasMore ? memos.slice(0, limit) : memos;
    const nextCursor = hasMore ? items[items.length - 1].updatedAt.toISOString() : null;

    return NextResponse.json({
        memos: items,
        nextCursor,
        hasMore
    });
}
