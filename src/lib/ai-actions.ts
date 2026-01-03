'use server';

import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { createMemo } from '@/app/memos/actions';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export async function chatWithAI(messages: ChatMessage[]) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { aiProvider: true, aiApiKey: true, aiModel: true, aiBaseUrl: true }
    });

    if (!user?.aiApiKey) {
        return { 
            role: 'assistant', 
            content: 'APIキーが設定されていません。設定画面からAPIキーを設定してください。' 
        };
    }

    const provider = user.aiProvider || 'openai';
    const apiKey = user.aiApiKey;
    const model = user.aiModel;
    const baseUrl = user.aiBaseUrl;
    const lastMessage = messages[messages.length - 1];

    try {
        let content = '';

        if (provider === 'openai') {
            content = await callOpenAI(apiKey, messages, model, baseUrl);
        } else if (provider === 'gemini') {
            content = await callGemini(apiKey, lastMessage.content, model);
        } else if (provider === 'anthropic') {
            content = await callAnthropic(apiKey, messages, model);
        } else {
            // Default to OpenAI / Compatible
            content = await callOpenAI(apiKey, messages, model, baseUrl);
        }

        return { role: 'assistant', content };

    } catch (e: any) {
        console.error('AI Chat Error:', e);
        return { 
            role: 'assistant', 
            content: `エラーが発生しました: ${e.message || 'Unknown error'}` 
        };
    }
}

// OpenAI API
async function callOpenAI(apiKey: string, messages: ChatMessage[], model?: string | null, baseUrl?: string | null) {
    const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}/chat/completions` : 'https://api.openai.com/v1/chat/completions';
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model || 'gpt-4o-mini', // Cost-effective default
            messages: messages.map(m => ({ role: m.role, content: m.content })),
        })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'OpenAI API Error');
    }

    const data = await res.json();
    return data.choices[0]?.message?.content || '';
}

// Gemini API
async function callGemini(apiKey: string, prompt: string, model?: string | null) {
    const targetModel = model || 'gemini-2.0-flash-exp';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`, { // Using flash for speed/cost
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Gemini API Error');
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Anthropic API
async function callAnthropic(apiKey: string, messages: ChatMessage[], model?: string | null) {
     const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model: model || 'claude-3-5-sonnet-20240620',
            max_tokens: 1024,
            messages: messages.map(m => ({ role: m.role, content: m.content }))
        })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Anthropic API Error');
    }

    const data = await res.json();
    return data.content?.[0]?.text || '';
}


