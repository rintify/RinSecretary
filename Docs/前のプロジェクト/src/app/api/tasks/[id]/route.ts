import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
    const task = await prisma.task.findUnique({
      where: { id: id },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Optional: Verify ownership
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user || task.userId !== user.id) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
      const json = await request.json();
      
      // Ownership check could be done here or relied on Prisma check if userId is part of update logic 
      // (but generally we want to check before update)
      const existingTask = await prisma.task.findUnique({ where: { id } });
      const user = await prisma.user.findUnique({ where: { email: session.user.email } });
      
      if (!existingTask || !user || existingTask.userId !== user.id) {
          return NextResponse.json({ error: 'Forbidden or Not Found' }, { status: 403 });
      }

      // Remove sensitive fields or handle validation
      const { id: _, userId: __, ...updateData } = json;

      const task = await prisma.task.update({
          where: { id },
          data: {
              ...updateData,
              ...updateData,
              startDate: updateData.startDate ? new Date(updateData.startDate) : undefined,
              deadline: updateData.deadline ? new Date(updateData.deadline) : undefined,
              progress: updateData.progress !== undefined ? Number(updateData.progress) : undefined,
              maxProgress: updateData.maxProgress !== undefined ? Number(updateData.maxProgress) : undefined,
              checklist: updateData.checklist ? JSON.stringify(updateData.checklist) : undefined,
          }
      });

      return NextResponse.json(task);
  } catch (error) {
      console.error(error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  try {
      const existingTask = await prisma.task.findUnique({ where: { id } });
      const user = await prisma.user.findUnique({ where: { email: session.user.email } });
      
      if (!existingTask || !user || existingTask.userId !== user.id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      await prisma.task.delete({
          where: { id }
      });

      return NextResponse.json({ success: true });
  } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
