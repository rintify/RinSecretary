'use server';

import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from './prisma';
import { getGmailMessages } from './google';
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { revalidatePath } from 'next/cache';

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

export async function blockSender(email: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Check if simple email check is enough or need better parsing.
    // Assume input is cleaned email.
    try {
        await (prisma as any).mailBlockedSender.create({
            data: {
                userId: session.user.id,
                email: email
            }
        });
        return { success: true };
    } catch(e) {
        // Ignore duplicate error
        return { success: true };
    }
}

export async function getBlockedSenders() {
    const session = await auth();
    if (!session?.user?.id) return [];

    const list = await (prisma as any).mailBlockedSender.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' }
    });
    return list;
}

export async function unblockSender(id: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await (prisma as any).mailBlockedSender.delete({
        where: { 
            id: id,
            userId: session.user.id // Security check
        }
    });
    return { success: true };
}

export type TopicCard = {
    title: string;
    summary: string;
    relatedLinks: { text: string, url: string }[];
    senders: { name: string, email: string }[];
};

export interface MailSummaryResult {
    topics: TopicCard[];
    otherMessagesSummary: string;
    otherSenders: { name: string, email: string }[];
}

export async function generateMailSummary(): Promise<MailSummaryResult> {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { 
            aiConfigs: true,
            mailBlockedSenders: true
        } as any
    });

    if (!user) throw new Error("User not found");

    const userAny = user as any;
    if (!userAny.mailSummaryModelId) {
        throw new Error("NO_CONFIG"); // UI handle: prompt to settings
    }

    const config = userAny.aiConfigs.find((c: any) => c.id === userAny.mailSummaryModelId);
    if (!config) {
        throw new Error("CONFIG_MISSING");
    }

    // Blocked list (normalized to lower case)
    const blockedEmails = (userAny.mailBlockedSenders || []).map((b: any) => b.email.toLowerCase());

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

    // Filter Logic: Exclude blocked senders
    const filteredMessages = messages.filter(m => {
        // Extract email from "Name <email>" or just "email"
        const match = m.from.match(/<(.+)>/);
        const email = match ? match[1] : m.from;
        return !blockedEmails.includes(email.toLowerCase());
    });

    if (filteredMessages.length === 0) {
        return { topics: [], otherMessagesSummary: "", otherSenders: [] };
    }

    const systemPrompt = `
あなたは優秀な秘書です。ユーザーのメールボックスから直近一週間のメールを取得しました。
ユーザーの設定した指示に従って、重要なメールをグループ化し、「トピックカード」のリストを作成してください。
また、トピックとして取り上げられなかったその他のメールについても、簡単な要約（どのようなメールがあったか）を作成してください。

メールリスト:
${JSON.stringify(filteredMessages.map(m => ({ 
    id: m.id,
    from: m.from, 
    subject: m.subject, 
    date: m.date, 
    content: m.content.substring(0, 500) 
})))}

ユーザーのカスタム指示:
${userAny.mailSummaryPrompt || "重要な連絡、請求書、個人的なメッセージを優先して要約してください。"}

出力形式 (JSON Object):
{
  "topics": [
    {
      "title": "トピックのタイトル（要約）",
      "summary": "トピックの詳細な説明",
      "relatedLinks": [
        { "text": "メール件名", "url": "https://mail.google.com/mail/u/0/#inbox/{emailId}" }
      ],
      "senders": [
        { "name": "送信者名", "email": "メールアドレス" }
      ]
    }
  ],
  "otherMessagesSummary": "その他、広告メールが〇件、通知メールが〇件ありました。特に重要なものはありませんでした。（など、残りのメールの概要）"
}
output json only. no markdown code block.
`;

    let resultText = "";

    try {
        if (config.provider === 'gemini') {
            const genAI = new GoogleGenerativeAI(config.apiKey);
            const model = genAI.getGenerativeModel({ model: config.model || "gemini-2.0-flash-exp", generationConfig: { responseMimeType: "application/json" } });
            const result = await model.generateContent(systemPrompt);
            resultText = result.response.text();

        } else if (config.provider === 'openai') {
            const openai = new OpenAI({
                apiKey: config.apiKey,
                baseURL: config.baseUrl || undefined
            });
            const completion = await openai.chat.completions.create({
                messages: [{ role: "user", content: systemPrompt }],
                model: config.model || "gpt-4o",
                response_format: { type: "json_object" }
            });
            resultText = completion.choices[0].message.content || "";

        } else if (config.provider === 'anthropic') {
            const anthropic = new Anthropic({ apiKey: config.apiKey });
            const msg = await anthropic.messages.create({
                model: config.model || "claude-3-5-sonnet-20240620",
                max_tokens: 4000,
                messages: [{ role: "user", content: systemPrompt }],
            });
            const textBlock = msg.content.find(c => c.type === 'text');
            resultText = textBlock ? textBlock.text : "";
        }
    } catch (e) {
        console.error("AI Generation Failed", e);
        throw new Error("AI_ERROR");
    }

    try {
        // Clean markdown block if present (Anthropic usually doesn't strictly support json mode like others might not forced)
        const jsonStr = resultText.replace(/```json\n|\n```/g, '').trim();
        // Sometimes strictly JSON object if openai response_format used improperly with array prompt? 
        // With json_object it expects object, but I asked for array. 
        // I should ask for object wrapping array to be safe: { "topics": [...] }
        // But let's try direct parse first or fix prompt if needed.
        // Actually, OpenAI json_object requires keyword "json" in prompt. I have it.
        // But for array root, better to wrap.
        // Let's assume modern models are smart enough or parse loosely.
        
        // Handling OpenAI "json_object" requiring valid JSON object ref:
        // "When using response_format: { type: 'json_object' }, the model will generate valid JSON. Note that the model may generate a JSON object, not an array."
        // So I should probably prompt for object keys.
        
        let parsed: any = JSON.parse(jsonStr);
        
        // Normalize response
        let result: MailSummaryResult = { topics: [], otherMessagesSummary: "", otherSenders: [] };

        if (parsed.topics) {
            result.topics = parsed.topics;
            result.otherMessagesSummary = parsed.otherMessagesSummary || "";
        } else if (Array.isArray(parsed)) {
            // Old format fallback
            result.topics = parsed;
        } else {
             // Fallback single object or weird structure
             // Attempt to see if it's a single topic
             if(parsed.title && parsed.summary) {
                 result.topics = [parsed];
             }
        }
        
        // Calculate otherSenders (Senders in filteredMessages but NOT in topics)
        const allSenders = new Map<string, { name: string, email: string }>();
        
        filteredMessages.forEach(m => {
            const match = m.from.match(/(.*)<(.+)>/);
            let name = m.from;
            let email = m.from;
            
            if (match) {
                name = match[1].trim().replace(/^"|"$/g, '');
                email = match[2].trim();
            } else {
                // Try simple email match if no brackets
                 const emailMatch = m.from.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
                 if (emailMatch) {
                     email = emailMatch[0];
                     if (name === email) name = ""; // No separate name
                 }
            }
            
            if (email) {
                allSenders.set(email.toLowerCase(), { name, email });
            }
        });

        const topicSenderEmails = new Set<string>();
        if (result.topics) {
            result.topics.forEach(topic => {
                topic.senders.forEach(s => {
                    if(s.email) topicSenderEmails.add(s.email.toLowerCase());
                });
            });
        }

        result.otherSenders = Array.from(allSenders.values()).filter(s => !topicSenderEmails.has(s.email.toLowerCase()));

        return result;
    } catch (e) {
        console.error("JSON Parse Error", e, resultText);
        throw new Error("AI_ERROR"); // Parse failed
    }
}
