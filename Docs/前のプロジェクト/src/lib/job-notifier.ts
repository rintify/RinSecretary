import { EventEmitter } from 'events';

// Singleton Event Emitter for Job Updates
// Note: In serverless environments (like Vercel), this singleton might not be shared across requests.
// However, for "npm run dev" or a single instance VPS, this works perfectly.
// For robust serverless, use Redis Pub/Sub or database polling on the API route side.
class JobNotifier extends EventEmitter {}

export const jobNotifier = new JobNotifier();

export function notifyUser(userId: string) {
    jobNotifier.emit('update', userId);
}
