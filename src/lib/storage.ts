import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { join } from 'path';

// Use a singleton prisma instance if possible, or create new if running in script context without global prisma
// In this project, lib/prisma.ts exports 'prisma' which is expected to be used in Next.js
// For scheduler.ts (standalone), it might instantiate its own PrismaClient.
// To make this safe for both, we can accept prisma as argument OR import from @/lib/prisma and hope module resolution works.
// Given scheduler.ts uses relative imports and instantiates its own PrismaClient, let's allow passing prisma instance or fallback.
// Actually, to keep it simple for now, let's assume we can use the project's prisma instance for Next.js app, 
// but scheduler might need care. 
// However, scheduler.ts imports `../src/lib/regularTaskService` which likely imports prisma. 
// Let's check regularTaskService imports.

import { prisma } from './prisma'; // assuming this works in Next.js. For scripts, we might need alias handling.

const STORAGE_KEY = 'storage_usage_bytes';
const UPLOAD_DIR = process.env.UPLOADS_DIR || join(process.cwd(), 'data/uploads');
const SERVER_MAX_STORAGE_BYTES = 3 * 1024 * 1024 * 1024; // 3GB - duplicated from constants to avoid import issues if needed, or import from constants

// Helper to calculate directory size
async function getDirectorySize(dir: string): Promise<number> {
    try {
        if (!fs.existsSync(dir)) return 0;
        const files = await fs.promises.readdir(dir, { withFileTypes: true });
        let total = 0;
        
        for (const file of files) {
            const filePath = join(dir, file.name);
            if (file.isDirectory()) {
                total += await getDirectorySize(filePath);
            } else {
                const { size } = await fs.promises.stat(filePath);
                total += size;
            }
        }
        return total;
    } catch (e) {
        console.error('Failed to calculate directory size', e);
        return 0;
    }
}

export async function getCurrentStorageUsage(): Promise<number> {
    const setting = await prisma.systemSetting.findUnique({ where: { key: STORAGE_KEY } });
    
    if (setting) {
        return parseInt(setting.value, 10);
    }

    // Initialize if not exists
    return await syncStorageUsage();
}

export async function updateStorageUsage(deltaBytes: number) {
    try {
        const current = await getCurrentStorageUsage();
        const newValue = Math.max(0, current + deltaBytes);
        
        await prisma.systemSetting.upsert({
            where: { key: STORAGE_KEY },
            update: { value: newValue.toString() },
            create: { key: STORAGE_KEY, value: newValue.toString() }
        });
    } catch (e) {
        console.error('Failed to update storage usage', e);
    }
}

export async function syncStorageUsage(): Promise<number> {
    console.log('[Storage] Syncing storage usage...');
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    const total = await getDirectorySize(UPLOAD_DIR);
    
    await prisma.systemSetting.upsert({
        where: { key: STORAGE_KEY },
        update: { value: total.toString() },
        create: { key: STORAGE_KEY, value: total.toString() }
    });
    console.log(`[Storage] Synced: ${total} bytes`);
    
    return total;
}

export const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
};

export async function unlinkFile(filename: string) {
    const filepath = join(UPLOAD_DIR, filename);
    if (!filename || filename.includes('..') || filename.includes('/')) return; // Simple sanity check
    try {
        if (fs.existsSync(filepath)) {
            await fs.promises.unlink(filepath);
        }
    } catch (e) {
        console.error('File unlink failed', e);
    }
}

export { SERVER_MAX_STORAGE_BYTES, UPLOAD_DIR };
