import { NextResponse } from 'next/server';
import { devAuth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Request Body Type
interface SyncRequest {
    // 最後に同期した時刻（ISO文字列）。これ以降の変更を取得
    lastSyncedAt?: string;
    
    // クライアント側で変更・作成されたメモ（Push）
    pushedMemos: {
        id: string;
        title: string;
        content: string;
        thumbnailPath?: string | null;
        updatedAt: string;
        createdAt: string;
    }[];
    
    // クライアント側で削除されたメモID
    pushedDeletedIds: string[];
    
    // クライアントが保持しているメモIDリスト（削除検知用、任意）
    localMemoIds?: string[];
}

export async function POST(req: Request) {
    const session = await devAuth();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id!;
    const body: SyncRequest = await req.json();
    const { lastSyncedAt, pushedMemos, pushedDeletedIds, localMemoIds } = body;

    const conflicts: any[] = [];
    const now = new Date();

    // --- 1. Process Logic: Push Deletions ---
    if (pushedDeletedIds.length > 0) {
        await prisma.memo.deleteMany({
            where: {
                id: { in: pushedDeletedIds },
                userId,
            }
        });
    }

    // --- 2. Process Logic: Push Upserts ---
    for (const clientMemo of pushedMemos) {
        const memoId = clientMemo.id;
        
        const existingMemo = await prisma.memo.findUnique({
            where: { id: memoId }
        });

        if (existingMemo) {
            // コンフリクト検知: サーバーの更新時刻がクライアントの更新時刻より新しい場合
            const clientUpdatedAt = new Date(clientMemo.updatedAt);
            if (existingMemo.updatedAt > clientUpdatedAt) {
                // コンフリクト発生
                conflicts.push({
                    memoId,
                    localVersion: clientMemo,
                    serverVersion: {
                        id: existingMemo.id,
                        title: existingMemo.title,
                        content: existingMemo.content,
                        thumbnailPath: existingMemo.thumbnailPath,
                        updatedAt: existingMemo.updatedAt.toISOString(),
                        createdAt: existingMemo.createdAt.toISOString(),
                    }
                });
                continue; // コンフリクトは上書きせず、クライアント側で解決
            }
            
            await prisma.memo.update({
                where: { id: memoId },
                data: {
                    title: clientMemo.title,
                    content: clientMemo.content,
                    thumbnailPath: clientMemo.thumbnailPath,
                    updatedAt: now,
                }
            });
        } else {
            await prisma.memo.create({
                data: {
                    id: memoId,
                    userId,
                    title: clientMemo.title,
                    content: clientMemo.content,
                    thumbnailPath: clientMemo.thumbnailPath,
                    createdAt: new Date(clientMemo.createdAt),
                    updatedAt: now,
                }
            });
        }
    }

    // --- 3. Process Logic: Pull Updates (lastSyncedAt以降の変更) ---
    const sinceDate = lastSyncedAt ? new Date(lastSyncedAt) : new Date(0);
    
    const updatedMemos = await prisma.memo.findMany({
        where: {
            userId,
            updatedAt: { gt: sinceDate }
        },
        orderBy: { updatedAt: 'desc' }
    });

    // --- 4. 削除検知: クライアントが持っているがサーバーにないもの ---
    let serverDeletedIds: string[] = [];
    if (localMemoIds && localMemoIds.length > 0) {
        const existingMemos = await prisma.memo.findMany({
            where: {
                id: { in: localMemoIds },
                userId
            },
            select: { id: true }
        });
        const existingIds = new Set(existingMemos.map(m => m.id));
        serverDeletedIds = localMemoIds.filter(id => !existingIds.has(id));
    }

    return NextResponse.json({
        updatedMemos,
        serverDeletedIds,
        conflicts,
        serverTime: now.toISOString(),
    });
}
