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

export async function generateSummaryFromData(
    messages: any[], 
    config: any, 
    mailSummaryPrompt?: string
): Promise<MailSummaryResult> {
    if (messages.length === 0) {
        return { topics: [], otherMessagesSummary: "", otherSenders: [] };
    }

    console.log(`Generating AI summary for ${messages.length} messages...`);

    const systemPrompt = `
あなたは優秀な秘書です。提供された「対象期間」のメールリストを分析してください。
ユーザーにとって「重要である（返信・対応が必要、または内容を正確に把握しておくべき）」と判断されるメッセージをあぶり出し、それぞれ「要約カード」として作成してください。
複数のメールをトピックとしてまとめることよりも、個々の重要な連絡や依頼を見落とさないように抽出することを優先してください。
重要として抽出されなかった残りのメッセージについては、まとめて「その他のメッセージ」として簡単な概要を作成してください。

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



