'use server';

import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function updateAISettings(provider: string, apiKey: string, model?: string, baseUrl?: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await prisma.user.update({
        where: { id: session.user.id },
        data: {
            aiProvider: provider,
            aiApiKey: apiKey,
            aiModel: model,
            aiBaseUrl: baseUrl
        }
    });
}


export async function getAISettings() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            aiProvider: true,
            aiApiKey: true,
            aiModel: true,
            aiBaseUrl: true
        }
    });


    return user;
}


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

import { sendPushoverNotification } from './pushover';

export async function sendTestPushoverNotification(userKey: string, token: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  try {
      const response = await sendPushoverNotification({
          userKey: userKey,
          token: token,
          title: `Test Notification`,
          message: 'This is a test notification from RinSecretary.'
      });
      
      if (!response.success) {
          throw new Error(response.error);
      }
      return { success: true };
  } catch (e: any) {
      console.error('Failed to send test notification:', e);
      return { success: false, error: e.message };
  }
}

export async function sendTestDiscordNotification(webhookUrl: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: "🔔 *Test Notification*\n\nRinSecretaryからのテスト通知です。このメッセージが見えていれば設定は正常です。",
            }),
        });

        if (!response.ok) {
            throw new Error(`Discord API Error: ${response.statusText}`);
        }
        return { success: true };
    } catch (e: any) {
         console.error('Failed to send discord test:', e);
         return { success: false, error: e.message };
    }
}

