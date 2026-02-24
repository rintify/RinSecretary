import { existsSync, mkdirSync } from 'fs';
import { prisma } from './prisma';

export const UPLOAD_DIR = process.env.UPLOADS_DIR || 'data/uploads';

/** デフォルトのサーバーストレージ上限（3GB） */
export const DEFAULT_SERVER_MAX_STORAGE_BYTES = 3 * 1024 * 1024 * 1024;

/** 無料プランのユーザーごとのストレージ上限（10MB） */
export const DEFAULT_FREE_PLAN_USER_STORAGE_BYTES = 10 * 1024 * 1024;

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/** SystemSettingから現在のストレージ使用量を取得する */
export async function getCurrentStorageUsage(): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'currentStorageUsage' },
  });
  return setting ? parseInt(setting.value, 10) : 0;
}

/** SystemSettingでストレージ使用量を更新する（差分を加算） */
export async function updateStorageUsage(delta: number | bigint): Promise<void> {
  const deltaNum = typeof delta === 'bigint' ? Number(delta) : delta;
  const current = await getCurrentStorageUsage();
  const newValue = Math.max(0, current + deltaNum);

  await prisma.systemSetting.upsert({
    where: { key: 'currentStorageUsage' },
    update: { value: String(newValue) },
    create: { key: 'currentStorageUsage', value: String(newValue) },
  });
}

/** サーバーストレージ上限を取得する */
export async function getServerMaxStorageBytes(): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'serverMaxStorageBytes' },
  });
  return setting ? parseInt(setting.value, 10) : DEFAULT_SERVER_MAX_STORAGE_BYTES;
}
