import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import MemoEditClient from './MemoEditClient';
import { devAuth } from '@/lib/dev-auth';

export default async function MemoEditPage(props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await props.params;
    const searchParams = await props.searchParams;
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
        notFound();
    }

    if (memo.userId !== user.id) {
        return <div>Forbidden</div>;
    }

    const isNew = searchParams?.new === 'true';

    return <MemoEditClient memo={{ id: memo.id, content: memo.content }} isNew={isNew} />;
}
