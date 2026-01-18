import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import MemoEditWrapper from './MemoEditWrapper';
import { devAuth } from '@/lib/dev-auth';

export default async function MemoEditPage(props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await props.params;
    const searchParams = await props.searchParams;
    const memoId = params.id;
    const isNew = searchParams?.new === 'true';
    
    let memo = null;
    let userId = 'current-user';

    try {
        const session = await devAuth();
        if (!session?.user?.email) {
            redirect('/');
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (user) {
            userId = user.id;
            const dbMemo = await prisma.memo.findUnique({
                where: { id: memoId },
            });

            if (dbMemo && dbMemo.userId === user.id) {
                memo = { id: dbMemo.id, content: dbMemo.content, updatedAt: dbMemo.updatedAt };
            }
        }
    } catch (e) {
        // サーバーエラー（オフラインなど）の場合は null のままにして
        // クライアント側で IndexedDB からフォールバックさせる
        console.error('Failed to fetch memo from server', e);
    }

    return <MemoEditWrapper serverMemo={memo} memoId={memoId} isNew={isNew} userId={userId} />;
}
