import { devAuth as auth } from '@/lib/dev-auth';
import { fetchGoogleEvents } from '@/lib/calendar-actions';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const force = searchParams.get('force') === 'true';

  if (!start || !end) {
      return NextResponse.json({ error: 'Missing start or end date' }, { status: 400 });
  }

  try {
    const result = await fetchGoogleEvents(new Date(start), new Date(end), force);
    
    // Check if result is empty or error indicating object? 
    // fetchGoogleEvents returns { events: [], fetchedAt: number }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch events via API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
