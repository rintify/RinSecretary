'use server';

import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function updatePushoverSettings(userKey: string, token: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      pushoverUserKey: userKey,
      pushoverToken: token,
    },
  });
}

export async function getPushoverSettings() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      pushoverUserKey: true,
      pushoverToken: true,
    },
  });

  return user;
}
