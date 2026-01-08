'use server';

import { prisma } from './prisma';
import { devAuth } from './dev-auth';
import { findDriveFolder, createDriveFolder, uploadToGoogleDrive, findDriveFile, updateDriveFile } from './google';
import { format } from 'date-fns';
import fs from 'fs';
import path from 'path';

import { UPLOAD_DIR } from './storage';

export async function getBackupSettings() {
    const session = await devAuth();
    if (!session?.user?.email) throw new Error('Unauthorized');
    
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error('User not found');

    const config = await prisma.backupConfig.findUnique({
        where: { userId: user.id }
    });
    
    return config || { isEnabled: false, folderName: 'RinSecretary_Backup' };
}

export async function updateBackupSettings(data: { isEnabled: boolean, folderName?: string }) {
    const session = await devAuth();
    if (!session?.user?.email) throw new Error('Unauthorized');
    
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error('User not found');

    const config = await prisma.backupConfig.upsert({
        where: { userId: user.id },
        update: {
            isEnabled: data.isEnabled,
            folderName: data.folderName || 'RinSecretary_Backup'
        },
        create: {
            userId: user.id,
            isEnabled: data.isEnabled,
            folderName: data.folderName || 'RinSecretary_Backup'
        }
    });
    return config;
}

export async function manualBackup() {
    const session = await devAuth();
    if (!session?.user?.email) throw new Error('Unauthorized');

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error('User not found');
    
    try {
        await performBackup(user.id);
        return { success: true };
    } catch (e: any) {
        console.error(e);
        return { success: false, error: e.message };
    }
}

export async function performBackup(userId: string) {
    console.log(`Starting backup for user ${userId}...`);
    
    try {
        const config = await prisma.backupConfig.findUnique({ where: { userId } });
        const folderName = config?.folderName || 'RinSecretary_Backup';

        // 1. Prepare Root Folder (No Date Subfolder)
        let rootFolder = await findDriveFolder(userId, folderName);
        if (!rootFolder) {
            console.log('Creating backup root folder...');
            rootFolder = await createDriveFolder(userId, folderName);
        }
        if (!rootFolder || !rootFolder.id) throw new Error('Failed to access backup root folder');

        // Helper to upsert file
        const upsertFile = async (filename: string, content: any, mimeType: string, parentId: string) => {
            const existing = await findDriveFile(userId, filename, parentId);
            if (existing && existing.id) {
                await updateDriveFile(userId, existing.id, content, mimeType);
                return existing;
            } else {
                return await uploadToGoogleDrive(userId, filename, content, mimeType, parentId);
            }
        };

        // 2. Backup Settings and User Info
        const user = await prisma.user.findUnique({
             where: { id: userId },
             include: { 
                 regularTasks: true,
                 aiConfigs: true,
                 palette: true,
                 mailBlockedSenders: true,
             }
        });
        
        if (user) {
            const { password, sessions, ...safeUser } = user as any; 
            const settingsJson = JSON.stringify(safeUser, null, 2);
            await upsertFile('UserInfo.json', settingsJson, 'application/json', rootFolder.id);
        }

        // 3. Backup Tasks
        const tasks = await prisma.task.findMany({ where: { userId } });
        let tasksMd = '# Task List\n\n| Status | Title | Deadline | Progress | Memo |\n|---|---|---|---|---|\n';
        for (const t of tasks) {
            const deadline = t.deadline ? t.deadline.toLocaleString() : '-';
            const memo = t.memo ? t.memo.replace(/\n/g, '<br>') : '';
            const status = t.progress >= 100 ? 'Completed' : 'Active';
            tasksMd += `| ${status} | ${t.title} | ${deadline} | ${t.progress}% | ${memo} |\n`;
        }
        await upsertFile('Tasks.md', tasksMd, 'text/markdown', rootFolder.id);

        // 4. Backup Memos
        // Ensure "Memos" folder exists inside root
        let memosFolder = await findDriveFolder(userId, 'Memos', rootFolder.id);
        if (!memosFolder) {
            memosFolder = await createDriveFolder(userId, 'Memos', rootFolder.id);
        }
        const memosFolderId = memosFolder!.id!;

        // Ensure "attachments" folder exists inside root/Memos
        let attachmentsFolder = await findDriveFolder(userId, 'attachments', memosFolderId);
        if (!attachmentsFolder) {
            attachmentsFolder = await createDriveFolder(userId, 'attachments', memosFolderId);
        }
        const attachmentsFolderId = attachmentsFolder!.id!;
        
        const memos = await prisma.memo.findMany({ 
            where: { userId },
            include: { attachments: true }
        });

        for (const memo of memos) {
            let content = memo.content;
            
            // Upload Attachments
            for (const att of memo.attachments) {
                const diskFilename = att.filePath.split('/').pop();
                if (!diskFilename) continue;

                const localPath = path.join(UPLOAD_DIR, diskFilename);
                if (fs.existsSync(localPath)) {
                    const stream = fs.createReadStream(localPath);
                    await upsertFile(diskFilename, stream, att.mimeType, attachmentsFolderId);
                    
                    // Replace link in content
                    content = content.replaceAll(att.filePath, `attachments/${diskFilename}`);
                }
            }
            
            // Upload Memo Markdown
            const safeTitle = memo.title.replace(/[\\/:*?"<>|]/g, '_') || 'Untitled';
            const fileName = `${safeTitle}.md`;
            
            await upsertFile(fileName, content, 'text/markdown', memosFolderId);
        }

        // Success Update
        await prisma.backupConfig.upsert({
            where: { userId },
            update: { lastBackupAt: new Date(), lastStatus: 'SUCCESS', lastError: null },
            create: { userId, lastBackupAt: new Date(), lastStatus: 'SUCCESS' }
        });
        
        console.log(`Backup completed successfully for user ${userId}`);
        return { success: true, folderName };

    } catch (e: any) {
        console.error(`Backup failed for user ${userId}`, e);
        await prisma.backupConfig.upsert({
            where: { userId },
            update: { lastBackupAt: new Date(), lastStatus: 'FAILED', lastError: e.message },
            create: { userId, lastBackupAt: new Date(), lastStatus: 'FAILED', lastError: e.message }
        });
        throw e;
    }
}
