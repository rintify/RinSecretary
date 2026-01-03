import { devAuth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import MemoListContainer from './MemoListContainer';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MemoListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
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

  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q : undefined;
  const takeParam = typeof params.take === 'string' ? parseInt(params.take) : 20;
  const take = isNaN(takeParam) ? 20 : takeParam;

  const where: any = { userId: user.id };
  if (query) {
    where.OR = [
      { title: { contains: query } },
      { content: { contains: query } },
    ];
  }

  const memos: any[] = []; // Remove server-side fetch

  return <MemoListContainer memos={memos} initialQuery={query || ''} initialTake={take} />;
}
