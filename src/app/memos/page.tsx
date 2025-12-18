import { devAuth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import MemoListContainer from './MemoListContainer';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MemoListPage() {
  const session = await devAuth();
  if (!session?.user?.email) {
    redirect('/'); 
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return <div>User not found</div>;
  }

  const memos = await prisma.memo.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: { attachments: true },
  });

  return <MemoListContainer memos={memos} />;
}
