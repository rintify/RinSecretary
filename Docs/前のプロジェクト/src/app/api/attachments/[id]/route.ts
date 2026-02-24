import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const attachment = await prisma.attachment.findUnique({
        where: { id: params.id },
        include: { memo: true }
    });

    if (!attachment) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email }});
    if (attachment.memo.userId !== user?.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(attachment);
}
