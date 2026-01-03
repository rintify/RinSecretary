'use server';

import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from './prisma';
import { getGmailMessages } from './google';
import { getAIConfigs } from './ai-actions';
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export async function saveMailSettings(modelId: string, prompt: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await prisma.user.update({
        where: { id: session.user.id },
        data: {
            mailSummaryModelId: modelId,
            mailSummaryPrompt: prompt
        } as any
    });
    return { success: true };
}

export async function getMailSettings() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { mailSummaryModelId: true, mailSummaryPrompt: true } as any
    });
    return user;
}

export async function generateMailSummary() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { aiConfigs: true }
    });

    if (!user) throw new Error("User not found");

    const userAny = user as any;
    if (!userAny.mailSummaryModelId) {
        throw new Error("NO_CONFIG"); // UI handle: prompt to settings
    }

    const config = user.aiConfigs.find(c => c.id === userAny.mailSummaryModelId);
    if (!config) {
        throw new Error("CONFIG_MISSING");
    }

    // Fetch emails (last 7 days)
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 7);
    
    let messages: any[] = [];
    try {
        messages = await getGmailMessages(user.id, timeMin);
    } catch (e: any) {
        if (e.message === 'AUTH_ERROR') {
             throw new Error("AUTH_ERROR");
        }
        if (e.message?.includes('Gmail API has not been used') || e.message?.includes('is disabled')) {
            throw new Error("GMAIL_API_DISABLED");
        }
        throw e;
    }

    if (messages.length === 0) {
        return "直近1週間には新しいメッセージはありませんでした。";
    }

    const systemPrompt = `
あなたは優秀な秘書です。ユーザーのメールボックスから直近一週間のメールを取得しました。
ユーザーの設定した指示に従って、重要なメールをピックアップし、要約してください。
宣伝や重要でない通知は除外してください。

メールリスト:
${JSON.stringify(messages.map(m => ({ from: m.from, subject: m.subject, date: m.date, content: m.content.substring(0, 500) })))}

ユーザーのカスタム指示:
${userAny.mailSummaryPrompt || "重要な連絡、請求書、個人的なメッセージを優先して要約してください。"}

出力形式: Markdown
`;

    // Retrieve AI response using logic similar to ai-actions.ts but simplified for direct call
    // Since we can't easily import callGemini/callOpenAI (they might be private or structured for chat),
    // let's reimplement similar switch logic here or refactor.
    // To be safe and quick, I will copy the provider switch logic.

    let summary = "";

    try {
        if (config.provider === 'gemini') {
            const genAI = new GoogleGenerativeAI(config.apiKey);
            const model = genAI.getGenerativeModel({ model: config.model || "gemini-2.0-flash-exp" });
            const result = await model.generateContent(systemPrompt);
            summary = result.response.text();

        } else if (config.provider === 'openai') {
            const openai = new OpenAI({
                apiKey: config.apiKey,
                baseURL: config.baseUrl || undefined
            });
            const completion = await openai.chat.completions.create({
                messages: [{ role: "user", content: systemPrompt }],
                model: config.model || "gpt-4o",
            });
            summary = completion.choices[0].message.content || "";

        } else if (config.provider === 'anthropic') {
            const anthropic = new Anthropic({ apiKey: config.apiKey });
            const msg = await anthropic.messages.create({
                model: config.model || "claude-3-5-sonnet-20240620",
                max_tokens: 4000,
                messages: [{ role: "user", content: systemPrompt }],
            });
            // Handle block content properly
            const textBlock = msg.content.find(c => c.type === 'text');
            summary = textBlock ? textBlock.text : "";
        }
    } catch (e) {
        console.error("AI Generation Failed", e);
        throw new Error("AI_ERROR");
    }

    return summary;
}
