import { test, expect } from '@playwright/test';

test.describe('Local-First Database (Dexie.js)', () => {
  const testEmail = `localdb_${Date.now()}@example.com`;
  const testPassword = 'password123';

  test.beforeEach(async ({ page }) => {
    // ログインを済ませてダッシュボードにアクセスする事前準備
    await page.goto('/register');
    await page.fill('[data-testid="register-email"]', testEmail);
    await page.fill('[data-testid="register-password"]', testPassword);
    await page.click('[data-testid="register-submit"]');

    await page.waitForURL('**/login', { timeout: 5000 });

    await page.fill('[data-testid="login-email"]', testEmail);
    await page.fill('[data-testid="login-password"]', testPassword);
    await page.click('[data-testid="login-submit"]');

    await page.waitForURL('**/', { timeout: 5000 });
  });

  test('should add and persist a task locally via IndexedDB', async ({ page }) => {
    const taskTitle = 'Local First Task 1';

    // 1. タスクを追加する (IndexedDBへの書き込み)
    await page.fill('[data-testid="new-task-input"]', taskTitle);
    await page.click('[data-testid="add-task-btn"]');

    // リストに追加されたことを確認
    const taskItem = page.locator(`text=${taskTitle}`);
    await expect(taskItem).toBeVisible();

    // 2. ページをリロードする (サーバーからのフェッチではなくローカルから復元されるか)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // リロード後もタスクが存在することを確認（IndexedDBの永続性）
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible();

    // 3. タスクを全削除してクリーンアップ
    await page.click('[data-testid="clear-tasks-btn"]');
    await expect(page.locator(`text=${taskTitle}`)).not.toBeVisible();
  });
});
