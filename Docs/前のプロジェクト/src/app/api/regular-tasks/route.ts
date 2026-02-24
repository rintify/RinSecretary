
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/auth';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const session = await auth();
  if (!session || !session.user?.email) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return new NextResponse('User not found', { status: 404 });
  }

  try {
    const configs = await prisma.regularTaskConfig.findMany({
      where: { userId: user.id },
    });
    return NextResponse.json(configs);
  } catch (error) {
    console.error('Error fetching regular task configs:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session || !session.user?.email) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return new NextResponse('User not found', { status: 404 });
  }

  try {
    const { type, checklist, isPaused } = await request.json();

    if (!['DAILY', 'WEEKLY'].includes(type)) {
       return new NextResponse('Invalid type', { status: 400 });
    }

    const config = await prisma.regularTaskConfig.upsert({
      where: {
        userId_type: {
          userId: user.id,
          type: type,
        },
      },
      update: {
        checklist: JSON.stringify(checklist),
        isPaused: isPaused,
      },
      create: {
        userId: user.id,
        type: type,
        checklist: JSON.stringify(checklist),
        isPaused: isPaused,
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error updating regular task config:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
