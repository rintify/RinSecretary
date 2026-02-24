import { devAuth as auth } from '@/lib/dev-auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs'; // or 'edge' if preferred, but prisma needs nodejs usually
export const maxDuration = 60; // Allow 60 seconds


export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { messages, useSearch, useImageGen, configId } = await req.json();

        // 1. Fetch Configuration
        let apiKey = '';
        let model = 'gemini-2.0-flash-exp';
        let includeThoughts = false;

        if (configId) {
            const config = await prisma.aiConfig.findUnique({
                where: { id: configId, userId: session.user.id }
            });
            if (config) {
                apiKey = config.apiKey;
                model = config.model || model;
                includeThoughts = config.includeThoughts;
            }
        } else {
            const user = await prisma.user.findUnique({
                 where: { id: session.user.id },
                 select: { aiProvider: true, aiApiKey: true, aiModel: true, aiBaseUrl: true } // User doesn't have includeThoughts yet
            });
            if (user?.aiApiKey) {
                apiKey = user.aiApiKey;
                model = user.aiModel || model;
            }
        }

        if (!apiKey) {
             return NextResponse.json({ error: 'API Key Missing' }, { status: 400 });
        }

        const targetModel = model || 'gemini-2.0-flash-exp';
        console.log('Target Model:', targetModel, 'Thinking:', includeThoughts);

        // 2. Construct Payload (Logic from ai-actions.ts)
        const contents = messages.map((msg: any) => {
            const parts: any[] = [{ text: msg.content }];
            
            if (msg.images && msg.images.length > 0) {
                msg.images.forEach((imgDataUri: string) => {
                    const [meta, data] = imgDataUri.split(',');
                    const mimeType = meta.split(':')[1].split(';')[0];
                    
                    const isText = mimeType.startsWith('text/') || 
                                   mimeType === 'application/json' || 
                                   mimeType === 'application/javascript' || 
                                   mimeType === 'application/typescript'; // Simplified check

                    if (isText) {
                         try {
                             const text = Buffer.from(data, 'base64').toString('utf-8');
                             parts.push({
                                 text: `\n\n[Attached File Content (${mimeType})]:\n${text}\n\n`
                             });
                         } catch (e) {
                             console.error('Failed to decode text attachment', e);
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
            return { role: msg.role === 'admin' ? 'user' : msg.role, parts }; 
        });

        const systemInstructionObj = useImageGen ? {
            parts: [{
                text: `You are a helpful AI assistant.
1. When asked to generate an image, YOU MUST generate it directly.
2. DO NOT pretend to use external tools like DALL-E.
3. YOU MUST generate the image directly using your native multimodal capabilities. The response should contain the image data (inline_data).
4. If you cannot generate an image for some reason, apologize in plain text.

Simply output the image and a brief description.`
            }]
         } : undefined;

        const tools = useSearch ? [{ googleSearch: {} }] : undefined;
        
        const generationConfig = includeThoughts ? {
            thinkingConfig: { includeThoughts: true }
        } : undefined;

        const payload: any = {
            contents: contents,
            tools: tools,
            generationConfig: generationConfig,
            system_instruction: systemInstructionObj
        };

        // 3. Call Gemini Stream API
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:streamGenerateContent?key=${apiKey}&alt=sse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!geminiRes.ok) {
            const errBody = await geminiRes.text();
            console.error('Gemini API Error:', errBody);
            return NextResponse.json({ error: `Gemini API Error: ${geminiRes.statusText}` }, { status: geminiRes.status });
        }

        if (!geminiRes.body) {
            return NextResponse.json({ error: 'No response body from Gemini' }, { status: 500 });
        }

        // 4. Transform Stream
        const stream = new ReadableStream({
            async start(controller) {
                const reader = geminiRes.body?.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                if (!reader) {
                    controller.close();
                    return;
                }

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        
                        const chunk = decoder.decode(value, { stream: true });
                        buffer += chunk;
                        
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || ''; 
                        
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const jsonStr = line.slice(6).trim();
                                if (jsonStr === '[DONE]') continue;
                                
                                try {
                                    const data = JSON.parse(jsonStr);
                                    
                                    // DEBUG: Log first candidate to inspect structure
                                    if (data.candidates?.[0]) {
                                        console.log('Stream Chunk Candidate:', JSON.stringify(data.candidates[0], null, 2));
                                    }

                                    const candidate = data.candidates?.[0];
                                    
                                    if (candidate?.content?.parts) {
                                        // DEBUG LOG
                                        console.log('Gemini Part:', JSON.stringify(candidate.content.parts[0]));

                                        for (const p of candidate.content.parts) {
                                            // Safety check: ignore if controller is already closed (desiredSize === null)
                                            if (controller.desiredSize === null) break;

                                            // Handle "thought"
                                            if (p.thought) {
                                                 controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'thought', content: p.text || '' }) + '\n'));
                                            } else if (p.text) {
                                                 controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'text', content: p.text }) + '\n'));
                                            } else if (p.inline_data) {
                                                 const imgUri = `data:${p.inline_data.mime_type};base64,${p.inline_data.data}`;
                                                 controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'image', content: imgUri }) + '\n'));
                                            }
                                        }
                                    }
                                    // Usage metadata might come in the last chunk?
                                    if (data.usageMetadata && controller.desiredSize !== null) {
                                        const usage = {
                                            promptTokens: data.usageMetadata.promptTokenCount || 0,
                                            responseTokens: data.usageMetadata.candidatesTokenCount || 0,
                                            totalTokens: data.usageMetadata.totalTokenCount || 0
                                        };
                                        controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'usage', usage }) + '\n'));
                                    }
                                } catch (e) {
                                    console.error('JSON Parse Error in stream', e);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('Stream Error', err);
                    controller.error(err);
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: { 
                'Content-Type': 'application/x-ndjson',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });

    } catch (error: any) {
        console.error('Route Handler Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
