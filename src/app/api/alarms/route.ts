import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
      return NextResponse.json({ error: 'Missing start or end date' }, { status: 400 });
  }

  try {
    const alarms = await prisma.alarm.findMany({
      where: {
        userId: session.user.id,
        time: {
          gte: new Date(start),
          lte: new Date(end),
        },
      },
      orderBy: {
        time: 'asc',
      },
    });

    // Client expects TaskLocal format
    const formattedAlarms = alarms.map(alarm => ({
      id: alarm.id,
      title: alarm.title,
      startTime: alarm.time,
      type: 'ALARM',
      memo: alarm.comment,
      color: '#FF4500', 
      isSent: alarm.isSent,
    }));

    return NextResponse.json(formattedAlarms);
  } catch (error) {
    console.error('Failed to fetch alarms:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
