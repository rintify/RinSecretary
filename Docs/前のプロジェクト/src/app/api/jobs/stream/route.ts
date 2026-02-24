import { NextRequest, NextResponse } from 'next/server';
import { devAuth } from '@/lib/dev-auth';
import { jobNotifier } from '@/lib/job-notifier';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const session = await devAuth();
    if (!session?.user?.id) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const userId = session.user.id;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection message
            controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));

            // Event Listener
            const onUpdate = (updatedUserId: string) => {
                if (updatedUserId === userId) {
                    controller.enqueue(encoder.encode(`data: {"type":"update"}\n\n`));
                }
            };

            jobNotifier.on('update', onUpdate);

            // Keep-Alive Interval (every 15s)
            const interval = setInterval(() => {
                try {
                    // Send comment to keep connection open
                    controller.enqueue(encoder.encode(': keep-alive\n\n'));
                } catch (e) {
                    // If controller is closed, clear interval
                    clearInterval(interval);
                }
            }, 15000);

            // Cleanup on close
            req.signal.onabort = () => {
                clearInterval(interval);
                jobNotifier.off('update', onUpdate);
                try {
                    controller.close();
                } catch(e) {}
            };
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
