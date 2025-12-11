import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Basic date filtering logic
    const whereClause: any = {
      userId: user.id,
    };
    
    // If filtering by deadline range (e.g. showing tasks due in a certain month)
    // For now, we return all incomplete tasks OR tasks completed recently?
    // User asked "Tasks... deadline task remain".
    // Let's just return all tasks for the user for now, or maybe filter by completion?
    // The prompt implied "Tasks" are separate from the timetable events.
    // However, if the user sends start/end, we might want to filter deadlines within that range.
    
    if (start && end) {
         // If generic time range provided, show tasks with DEADLINE in that range
         whereClause.deadline = {
             gte: new Date(start),
             lte: new Date(end)
         };
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      orderBy: {
        deadline: 'asc', // Sort by deadline
      },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await request.json();
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const task = await prisma.task.create({
      data: {
        title: json.title,
        memo: json.memo,
        // Default startDate to now if not provided, or specific date
        startDate: json.startDate ? new Date(json.startDate) : new Date(new Date().setHours(0,0,0,0)),
        deadline: json.deadline ? new Date(json.deadline) : new Date(new Date().setHours(23,59,59,999)),
        progress: json.progress || 0,
        maxProgress: json.maxProgress || 100,
        userId: user.id,
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
