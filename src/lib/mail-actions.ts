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
    relatedLinks: { text: string, id: string }[];
    senders: { name: string, email: string }[];
};

export interface MailSummaryResult {
    topics: TopicCard[];
    otherMessagesSummary: string;
    otherSenders: { name: string, email: string }[];
}

export async function collectMailData() {
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
        throw new Error("NO_CONFIG");
    }

    const config = userAny.aiConfigs.find((c: any) => c.id === userAny.mailSummaryModelId);
    if (!config) {
        throw new Error("CONFIG_MISSING");
    }

    // Blocked list (normalized to lower case)
    const blockedEmails = (userAny.mailBlockedSenders || []).map((b: any) => b.email.toLowerCase());

    // Fetch emails (last 14 days)
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 14);
    
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
        const match = m.from.match(/<(.+)>/);
        const email = match ? match[1] : m.from;
        return !blockedEmails.includes(email.toLowerCase());
    });

    // Sort messages by date (Newest first)
    filteredMessages.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
    });

    return {
        messages: filteredMessages,
        messageCount: filteredMessages.length,
        config,
        mailSummaryPrompt: userAny.mailSummaryPrompt
    };
}

export async function generateSummaryFromData(
    messages: any[], 
    config: any, 
    mailSummaryPrompt?: string
): Promise<MailSummaryResult> {
    if (messages.length === 0) {
        return { topics: [], otherMessagesSummary: "", otherSenders: [] };
    }

    const systemPrompt = `
あなたは優秀な秘書です。ユーザーのメールボックスから直近一週間のメールを取得しました。
ユーザーの設定した指示に従って、重要なメールをグループ化し、「トピックカード」のリストを作成してください。
また、トピックとして取り上げられなかったその他のメールについても、簡単な要約（どのようなメールがあったか）を作成してください。

メールリスト:
${JSON.stringify(messages.map(m => ({ 
    id: m.id,
    from: m.from, 
    subject: m.subject, 
    date: m.date, 
    content: m.content.substring(0, 500) 
})))}

ユーザーのカスタム指示:
${mailSummaryPrompt || "重要な連絡、請求書、個人的なメッセージを優先して要約してください。"}

出力形式 (JSON Object):
※注意: relatedLinks の "id" は、提供されたメールリストの "id" を大文字小文字含め、一字一句変えずにそのまま使用してください。
{
  "topics": [
    {
      "title": "トピックのタイトル（要約）",
      "summary": "トピックの詳細な説明",
      "relatedLinks": [
        { "text": "メール件名", "id": "{emailId}" }
      ]
    }
  ],
  "otherMessagesSummary": "その他、〇〇や〇〇から〇〇に関するメッセージがありました。（など、残りのメールの概要）"
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
        const jsonStr = resultText.replace(/```json\n|\n```/g, '').trim();
        let parsed: any = JSON.parse(jsonStr);
        let result: MailSummaryResult = { topics: [], otherMessagesSummary: "", otherSenders: [] };

        if (parsed.topics) {
            result.topics = parsed.topics;
            result.otherMessagesSummary = parsed.otherMessagesSummary || "";
        } else if (Array.isArray(parsed)) {
            result.topics = parsed;
        } else if (parsed.title && parsed.summary) {
            result.topics = [parsed];
        }
        
        const allSenders = new Map<string, { name: string, email: string }>();
        const messageIdToSender = new Map<string, { name: string, email: string }>();
        
        messages.forEach(m => {
            const match = m.from.match(/(.*)<(.+)>/);
            let name = m.from;
            let email = m.from;
            
            if (match) {
                name = match[1].trim().replace(/^"|"$/g, '');
                email = match[2].trim();
            } else {
                 const emailMatch = m.from.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
                 if (emailMatch) {
                     email = emailMatch[0];
                     if (name === email) name = "";
                 }
            }
            
            if (email) {
                const sender = { name, email };
                allSenders.set(email.toLowerCase(), sender);
                messageIdToSender.set(m.id, sender);
            }
        });

        if (result.topics) {
            result.topics.forEach(topic => {
                const topicSendersMap = new Map<string, { name: string, email: string }>();
                if (topic.relatedLinks) {
                    topic.relatedLinks.forEach(link => {
                        const sender = messageIdToSender.get(link.id);
                        if (sender) {
                            topicSendersMap.set(sender.email.toLowerCase(), sender);
                        }
                    });
                }
                topic.senders = Array.from(topicSendersMap.values());
            });
        }

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
        throw new Error("AI_ERROR");
    }
}

export async function generateMailSummary(): Promise<MailSummaryResult> {
    const data = await collectMailData();
    return generateSummaryFromData(data.messages, data.config, data.mailSummaryPrompt);
}

