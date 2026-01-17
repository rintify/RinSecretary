import { NextResponse } from 'next/server';
import { devAuth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface SyncRequest {
    lastSyncedAt?: string | null;
    memoId?: string; // Optional: sync only for a specific memo
}

export async function POST(req: Request) {
    const session = await devAuth();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id!;
    const body: SyncRequest = await req.json();
    const { lastSyncedAt, memoId } = body;

    const now = new Date();
    const sinceDate = lastSyncedAt ? new Date(lastSyncedAt) : new Date(0);

    // Build where clause for active attachments
    const whereClause: any = {
        memo: {
            userId: userId
        },
        isDeleted: false,
        createdAt: { gt: sinceDate }
    };

    if (memoId) {
        whereClause.memoId = memoId;
    }

    // Get active attachments created after lastSyncedAt for user's memos
    const attachments = await prisma.attachment.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            memoId: true,
            fileName: true,
            filePath: true,
            fileSize: true,
            mimeType: true,
            createdAt: true,
        }
    });

    // Get deleted attachment IDs since lastSyncedAt
    const deletedWhereClause: any = {
        memo: {
            userId: userId
        },
        isDeleted: true,
        deletedAt: { gt: sinceDate }
    };
    
    if (memoId) {
        deletedWhereClause.memoId = memoId;
    }
    
    const deletedAttachments = await prisma.attachment.findMany({
        where: deletedWhereClause,
        select: { id: true }
    });

    return NextResponse.json({
        attachments: attachments.map(a => ({
            ...a,
            fileSize: Number(a.fileSize),
        })),
        deletedAttachmentIds: deletedAttachments.map(a => a.id),
        serverTime: now.toISOString(),
    });
}
