'use server';

import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma'; // Assuming prisma instance is exported from here, need to verify
import { revalidatePath } from 'next/cache';

export async function getAlarms(start: Date, end: Date) {
  const session = await auth();
  if (!session?.user?.id) return [];

  // Fetch alarms within the range OR unpaid alarms (if we wanted to show missed ones, but for now just range)
  // Actually, for TimeTable, we probably just want alarms in that day/range.
  // But wait, the prompt said "mixed with events".
  const alarms = await prisma.alarm.findMany({
    where: {
      userId: session.user.id,
      time: {
        gte: start,
        lte: end,
      },
    },
    orderBy: {
      time: 'asc',
    },
  });

  return alarms.map(alarm => ({
    id: alarm.id,
    title: alarm.title,
    startTime: alarm.time, // Map to startTime for TimeTable compatibility
    // No endTime for alarms
    type: 'ALARM',
    memo: alarm.comment,
    color: '#FF4500', // distinct color, e.g., OrangeRed
    isSent: alarm.isSent,
  }));
}

export async function createAlarm(data: { title: string; time: string | Date; comment?: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.alarm.create({
    data: {
      title: data.title,
      time: new Date(data.time),
      comment: data.comment,
      userId: session.user.id,
      isSent: false,
    },
  });
  revalidatePath('/');
}

export async function updateAlarm(id: string, data: { title: string; time: string | Date; comment?: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // If time changes, we might want to reset isSent? Yes, usually.
  const oldAlarm = await prisma.alarm.findUnique({ where: { id } });
  
  if (!oldAlarm) throw new Error("Alarm not found");

  const newTime = new Date(data.time);
  const timeChanged = oldAlarm.time.getTime() !== newTime.getTime();

  await prisma.alarm.update({
    where: { id, userId: session.user.id },
    data: {
      title: data.title,
      time: newTime,
      comment: data.comment,
      isSent: timeChanged ? false : oldAlarm.isSent, // Reset isSent if time changed
    },
  });
  revalidatePath('/');
}

export async function deleteAlarm(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.alarm.delete({
    where: { id, userId: session.user.id },
  });
  revalidatePath('/');
}
