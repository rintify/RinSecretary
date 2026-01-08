import { prisma } from '@/lib/prisma';
import { performBackup } from './backup-actions';
import { generateDailyMailSummary } from './mail-scheduler-actions';
import { chatWithAI } from './ai-actions';
import { createMemoInternal } from '@/app/memos/actions';

// This function runs on the server, potentially in the background after the response is sent.
export async function processJob(jobId: string) {
    console.log(`JobProcessor: Starting job ${jobId}`);
    
    // Fetch Job
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
        console.error(`JobProcessor: Job ${jobId} not found`);
        return;
    }
    
    if (job.status === 'CANCELLED') {
         console.log(`JobProcessor: Job ${jobId} was cancelled before start`);
         return;
    }

    // Update Status to RUNNING
    await prisma.job.update({
        where: { id: jobId },
        data: { status: 'RUNNING', progress: 0 }
    });

    try {
        const payload = job.payload ? JSON.parse(job.payload) : {};
        let result: any = null;

        // Switch Logic
        switch (job.type) {
            case 'BACKUP':
                result = await performBackup(job.userId);
                break;
                
            case 'MAIL_SUMMARY':
                // payload might contain date range?
                result = await generateDailyMailSummary(job.userId);
                break;
            
            case 'AI_CHAT':
                // payload: { messages, useSearch, useImageGen, configId }
                // chatWithAI returns { role, content, images, usage... }
                result = await chatWithAI(
                    payload.messages,
                    payload.useSearch,
                    payload.useImageGen,
                    payload.configId
                );
                
                // Auto-save removed as per user request
                break;
                
            default:
                throw new Error(`Unknown job type: ${job.type}`);
        }
        
        // Success
        await prisma.job.update({
            where: { id: jobId },
            data: { 
                status: 'COMPLETED', 
                progress: 100, 
                result: JSON.stringify(result) 
            }
        });
        
        const { notifyUser } = await import('./job-notifier');
        notifyUser(job.userId);
        
        console.log(`JobProcessor: Job ${jobId} completed`);

    } catch (e: any) {
        console.error(`JobProcessor: Job ${jobId} failed`, e);
        await prisma.job.update({
            where: { id: jobId },
            data: { 
                status: 'FAILED', 
                result: JSON.stringify({ error: e.message || 'Unknown Error' }) 
            }
        });
        
        const { notifyUser } = await import('./job-notifier');
        notifyUser(job.userId);
    }
}
