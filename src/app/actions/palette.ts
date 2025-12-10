'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getPalette() {
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    const palette = await prisma.eventPalette.findUnique({
      where: { userId: session.user.id },
    });

    if (palette) return palette;

    // Create default if not exists
    return await prisma.eventPalette.create({
      data: {
        userId: session.user.id,
      },
    });
  } catch (error) {
    console.error('Error fetching palette:', error);
    return null;
  }
}

export async function updatePalette(data: {
  black?: string;
  red?: string;
  blue?: string;
  yellow?: string;
  green?: string;
  purple?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  try {
    const palette = await prisma.eventPalette.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        ...data,
      },
    });
    
    revalidatePath('/');
    return palette;
  } catch (error) {
    console.error('Error updating palette:', error);
    throw new Error('Failed to update palette');
  }
}
