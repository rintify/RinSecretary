import { test, expect } from '@playwright/test';

test.describe('Data Sync Architecture', () => {
  const testEmail = `sync_${Date.now()}@example.com`;
  const testPassword = 'password123';

  test.beforeEach(async ({ page }) => {
    // アカウント作成・ログイン
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

  test('should sync local changes to server and pull server changes on another device', async ({ browser, page }) => {
    // 1. デバイス1: ローカルでタスク作成
    const taskTitle = 'Sync Test Task 1';
    await page.fill('[data-testid="new-task-input"]', taskTitle);
    await page.click('[data-testid="add-task-btn"]');

    // 作成直後はステータスが「created」 または 「synced」（マウント時の処理タイミングによる）になる
    const taskItem = page.locator('li', { hasText: taskTitle });
    await expect(taskItem).toBeVisible({ timeout: 5000 });

    // 2. デバイス1: 「今すぐ同期」ボタンを押下してサーバーにPushする
    await page.click('[data-testid="force-sync-btn"]');

    // 通信が完了し、ローカルデータのステータスが「synced」に変化することを確認
    await expect(taskItem.locator('text=synced')).toBeVisible({ timeout: 10000 });

    // 3. デバイス2 (別ブラウザコンテキスト) への引き継ぎ確認
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    // 同じアカウントでログイン
    await page2.goto('/login');
    await page2.fill('[data-testid="login-email"]', testEmail);
    await page2.fill('[data-testid="login-password"]', testPassword);
    await page2.click('[data-testid="login-submit"]');
    await page2.waitForURL('**/', { timeout: 5000 });

    // この時点で新しいデバイスはローカルDBが空だが、マウント時の初期同期(Pull)により
    // サーバーから「Sync Test Task 1」が降ってくるはずである
    const page2TaskItem = page2.locator('li', { hasText: taskTitle });
    await expect(page2TaskItem.locator('text=synced')).toBeVisible({ timeout: 15000 });

    await context2.close();
  });
});
