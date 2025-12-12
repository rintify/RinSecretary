'use server';

import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function updatePushoverSettings(userKey: string, token: string, discordWebhookUrl?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Check if webhook URL has changed
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { discordWebhookUrl: true },
  });

  const webhookChanged = discordWebhookUrl && discordWebhookUrl !== currentUser?.discordWebhookUrl;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      pushoverUserKey: userKey,
      pushoverToken: token,
      discordWebhookUrl: discordWebhookUrl,
    },
  });

  // Send greeting message if webhook URL is newly set or changed
  if (webhookChanged) {
    try {
      await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `💋 *ふふっ、ご登録ありがとうございます♪*\n\n私、RinSecretaryがあなたの秘書を務めさせていただきますわ。\n毎朝6時に、その日のご予定とタスクをお届けしますね。\n\nどうぞよろしくお願いいたします✨`,
        }),
      });
    } catch (e) {
      console.error('Failed to send greeting message:', e);
    }
  }
}

export async function getPushoverSettings() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      pushoverUserKey: true,
      pushoverToken: true,
      discordWebhookUrl: true,
    },
  });

  return user;
}
