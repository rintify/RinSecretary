import { devAuth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import MemoDetailWrapper from '@/app/components/MemoDetailWrapper';
import { redirect } from 'next/navigation';

export default async function MemoViewPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const memoId = params.id;
  
  let memo = null;
  
  try {
    const session = await devAuth();
    if (!session?.user?.email) {
      redirect('/');
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (user) {
      const dbMemo = await prisma.memo.findUnique({
        where: { id: memoId },
      });

      if (dbMemo && dbMemo.userId === user.id) {
        memo = dbMemo;
      }
    }
  } catch (e) {
    // サーバーエラー（オフラインなど）の場合は null のままにして
    // クライアント側で IndexedDB からフォールバックさせる
    console.error('Failed to fetch memo from server', e);
  }

  return <MemoDetailWrapper serverMemo={memo} memoId={memoId} />;
}
