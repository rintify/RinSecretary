import { devAuth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import MemoDetail from '@/app/components/MemoDetail';
import { redirect } from 'next/navigation';

export default async function MemoViewPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

  const memo = await prisma.memo.findUnique({
    where: { id: params.id },
  });

  if (!memo) {
      return <div>Memo not found</div>;
  }

  if (memo.userId !== user.id) {
      return <div>Forbidden</div>;
  }

  return <MemoDetail memo={memo} />;
}
