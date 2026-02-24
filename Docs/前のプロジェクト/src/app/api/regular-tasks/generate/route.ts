
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateRegularTasks } from '@/lib/regularTaskService';

export async function POST(request: Request) {
  const session = await auth();
  if (!session || !session.user?.email) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // Generate tasks for the current time
    await generateRegularTasks();
    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Error generating regular tasks:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
