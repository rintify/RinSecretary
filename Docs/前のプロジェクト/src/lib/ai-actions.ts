'use server';

import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { createMemo } from '@/app/memos/actions';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    images?: string[]; // Base64 data uris
}

interface ChatResponse {
    role: 'assistant';
    content: string;
    images?: string[];
    usage?: {
        promptTokens: number;
        responseTokens: number;
        totalTokens: number;
    };
    thought?: string;
}

// ... existing imports
// Removed createContextCache

export async function getAIConfigs() {
    const session = await auth();
    if (!session?.user?.id) return [];
    
    return await prisma.aiConfig.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' }
    });
}

export async function saveAIConfig(data: { id?: string, name: string, provider: string, apiKey: string, model?: string, baseUrl?: string, includeThoughts?: boolean }) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    if (data.id) {
        return await prisma.aiConfig.update({
            where: { id: data.id, userId: session.user.id },
            data: {
                name: data.name,
                provider: data.provider,
                apiKey: data.apiKey,
                model: data.model,
                baseUrl: data.baseUrl,
                includeThoughts: data.includeThoughts
            }
        });
    } else {
        return await prisma.aiConfig.create({
            data: {
                userId: session.user.id,
                name: data.name,
                provider: data.provider,
                apiKey: data.apiKey,
                model: data.model,
                baseUrl: data.baseUrl,
                includeThoughts: data.includeThoughts
            }
        });
    }
}

export async function deleteAIConfig(id: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    
    await prisma.aiConfig.delete({
        where: { id: id, userId: session.user.id }
    });
}


export async function chatWithAI(messages: ChatMessage[], useSearch: boolean = false, useImageGen: boolean = false, configId?: string): Promise<ChatResponse> {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }

    let apiKey = '';
    let model = 'gemini-2.0-flash-exp';

    if (configId) {
        const config = await prisma.aiConfig.findUnique({
            where: { id: configId, userId: session.user.id }
        });
        if (config) {
            apiKey = config.apiKey;
            model = config.model || model;
        }
    } else {
        // Fallback to legacy User fields
        const user = await prisma.user.findUnique({
             where: { id: session.user.id },
             select: { aiProvider: true, aiApiKey: true, aiModel: true, aiBaseUrl: true }
        });
        if (user?.aiApiKey) {
            apiKey = user.aiApiKey;
            model = user.aiModel || model;
        }
    }

    if (!apiKey) {
        return { 
            role: 'assistant', 
            content: 'APIキーが設定されていません。設定画面からAIモデルを選択または設定してください。' 
        };
    }

    try {
        const result = await callGemini(apiKey, messages, model, useSearch, useImageGen);
        return { 
            role: 'assistant', 
            content: result.content,
            images: result.images,
            usage: result.usage
        };

    } catch (e: any) {
        console.error('AI Chat Error:', e);
        return { 
            role: 'assistant', 
            content: `エラーが発生しました: ${e.message || 'Unknown error'}` 
        };
    }
}

// Gemini API (Raw Fetch for control)
async function callGemini(apiKey: string, messages: ChatMessage[], model: string, useSearch: boolean, useImageGen: boolean) {
    const targetModel = model || 'gemini-2.0-flash-exp';
    
    // Construct contents
    const contents = messages.map(msg => {
        const parts: any[] = [{ text: msg.content }];
        
        // Handle attachments (stored in images field)
        if (msg.images && msg.images.length > 0) {
            msg.images.forEach(imgDataUri => {
                // imgDataUri format: "data:mime/type;base64,....."
                const [meta, data] = imgDataUri.split(',');
                const mimeType = meta.split(':')[1].split(';')[0];
                
                const isText = mimeType.startsWith('text/') || 
                               mimeType === 'application/json' || 
                               mimeType === 'application/javascript' ||
                               mimeType === 'application/x-javascript' ||
                               mimeType === 'application/typescript' ||
                               mimeType === 'application/xml' ||
                               mimeType === 'application/x-sh';

                if (isText) {
                     try {
                         const text = Buffer.from(data, 'base64').toString('utf-8');
                         parts.push({
                             text: `\n\n[Attached File Content (${mimeType})]:\n${text}\n\n`
                         });
                     } catch (e) {
                         console.error('Failed to decode text attachment', e);
                         // Fallback to inline_data if decode fails? Or just skip?
                         // Trying inline_data for text might fail if Gemini expects text.
                     }
                } else {
                    parts.push({
                        inline_data: {
                            mime_type: mimeType,
                            data: data
                        }
                    });
                }
            });
        }

        return {
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: parts
        };
    });

    let systemInstructionObj = undefined;

    // Add Image Generation instruction if enabled
    if (useImageGen) {
         systemInstructionObj = {
            parts: [{
                text: `You have native image generation capabilities (Gemini Image Generation).
When the user asks you to generate an image:
1. DO NOT strictly output JSON with "action": "dalle.text2im".
2. DO NOT pretend to use external tools like DALL-E.
3. YOU MUST generate the image directly using your native multimodal capabilities. The response should contain the image data (inline_data).
4. If you cannot generate an image for some reason, apologize in plain text.

Simply output the image and a brief description.`
            }]
         };
    }

    // Add Google Search Tool (Grounding) if requested
    const tools = useSearch ? [{ googleSearch: {} }] : undefined;

    // API Payload
    const payload: any = {
        contents: contents,
        tools: tools,
        system_instruction: systemInstructionObj
    };

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Gemini API Error');
    }

    const data = await res.json();
    
    // Extract content (text and images)
    let textParts: string[] = [];
    let imageParts: string[] = [];
    let thoughtParts: string[] = [];
    
    const candidate = data.candidates?.[0];
    
    if (candidate?.content?.parts) {
        candidate.content.parts.forEach((p: any) => {
            // Check for explicit "thought" logic (experimental)
            // Some versions of Gemini API return thought as a separate part with a specific flag or just implicitly.
            // If p.thought is true, it's a thought.
            if (p.thought) {
                 thoughtParts.push(p.text || '');
            } else if (p.text) {
                textParts.push(p.text);
            }
            
            if (p.inline_data) {
                // p.inline_data = { mime_type, data }
                imageParts.push(`data:${p.inline_data.mime_type};base64,${p.inline_data.data}`);
            }
        });
    }

    // fallback: If textParts contains a thought block (sometimes returned as text starting with "Thought:")? 
    // We won't implement unstable parsing. Trust the API field 'thought' if present.

    // If response was blocked or empty
    if (textParts.length === 0 && imageParts.length === 0 && thoughtParts.length === 0 && candidate?.finishReason) {
         textParts.push(`[Response stopped: ${candidate.finishReason}]`);
    }

    const text = textParts.join('');
    const thought = thoughtParts.length > 0 ? thoughtParts.join('\n') : undefined;

    // Extract usage metadata
    const usageMetadata = data.usageMetadata;
    const usage = usageMetadata ? {
        promptTokens: usageMetadata.promptTokenCount || 0,
        responseTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0
    } : undefined;

    return { content: text || (imageParts.length > 0 ? '' : 'No response'), images: imageParts, usage, thought };
}
