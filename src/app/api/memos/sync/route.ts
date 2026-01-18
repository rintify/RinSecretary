import { NextResponse } from 'next/server';
import { devAuth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { unlinkFile, updateStorageUsage } from '@/lib/storage';

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
    
    // localMemoIds は廃止（通信量削減のため）
}

export async function POST(req: Request) {
    const session = await devAuth();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id!;
    const body: SyncRequest = await req.json();
    const { lastSyncedAt, pushedMemos, pushedDeletedIds } = body;

    const conflicts: any[] = [];
    const now = new Date();

    // --- 1. Process Logic: Push Deletions (論理削除) ---
    if (pushedDeletedIds.length > 0) {
        // 物理ファイル削除と容量更新を先に行う
        const memosToDelete = await prisma.memo.findMany({
            where: { id: { in: pushedDeletedIds }, userId, isDeleted: false },
            include: { attachments: { where: { isDeleted: false } } }
        });
        
        for (const memo of memosToDelete) {
            for (const att of memo.attachments) {
                const filename = att.filePath.split('/').pop();
                if (filename) {
                    await unlinkFile(filename);
                }
                await updateStorageUsage(-att.fileSize);
                // 添付ファイルも論理削除
                await prisma.attachment.update({
                    where: { id: att.id },
                    data: { isDeleted: true, deletedAt: now }
                });
            }
        }
        
        // メモを論理削除（物理削除ではなく）
        await prisma.memo.updateMany({
            where: {
                id: { in: pushedDeletedIds },
                userId,
            },
            data: {
                isDeleted: true,
                deletedAt: now,
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
            if (existingMemo.updatedAt > clientUpdatedAt && !existingMemo.isDeleted) {
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
                    isDeleted: false, // 削除状態を解除（復元）
                    deletedAt: null,
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
    // メタデータのみ返す（contentは含めない）
    // クライアント側でキャッシュ済みのものと照合して、必要なら個別に取得
    const sinceDate = lastSyncedAt ? new Date(lastSyncedAt) : new Date(0);
    
    const updatedMemos = await prisma.memo.findMany({
        where: {
            userId,
            isDeleted: false,
            updatedAt: { gt: sinceDate }
        },
        select: {
            id: true,
            title: true,
            updatedAt: true,
            createdAt: true,
            thumbnailPath: true,
            // content は含めない（通信量削減）
        },
        orderBy: { updatedAt: 'desc' },
        take: 1000  // 安全のため上限を設定
    });

    // --- 4. 削除検知: deletedAt 以降に削除されたメモのIDを返す ---
    const deletedMemos = await prisma.memo.findMany({
        where: {
            userId,
            isDeleted: true,
            deletedAt: { gt: sinceDate }
        },
        select: { id: true },
        take: 1000  // 安全のため上限を設定
    });
    const serverDeletedIds = deletedMemos.map(m => m.id);

    return NextResponse.json({
        updatedMemos,
        serverDeletedIds,
        conflicts,
        serverTime: now.toISOString(),
    });
}
