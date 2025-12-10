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

    if (palette) {
        // Parse JSON string
        try {
            return JSON.parse(palette.palette);
        } catch(e) {
            return [];
        }
    }

    // Create default if not exists
    await prisma.eventPalette.create({
      data: {
        userId: session.user.id,
        palette: "[]"
      },
    });
    return [];

  } catch (error) {
    console.error('Error fetching palette:', error);
    return null;
  }
}

export async function updatePalette(paletteData: any[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  try {
    const palette = await prisma.eventPalette.upsert({
      where: { userId: session.user.id },
      update: {
          palette: JSON.stringify(paletteData)
      },
      create: {
        userId: session.user.id,
        palette: JSON.stringify(paletteData)
      },
    });
    
    revalidatePath('/');
    return JSON.parse(palette.palette);
  } catch (error) {
    console.error('Error updating palette:', error);
    throw new Error('Failed to update palette');
  }
}
