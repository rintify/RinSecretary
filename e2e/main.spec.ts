import { test, expect } from '@playwright/test';

test.describe('メイン画面', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン
    await page.goto('/login', { timeout: 5000 });
    await page.locator('[data-testid="login-name-input"]').fill('testuser', { timeout: 5000 });
    await page.locator('[data-testid="login-password-input"]').fill('testpassword123', { timeout: 5000 });
    await page.locator('[data-testid="login-submit-button"]').click({ timeout: 5000 });
    await expect(page.locator('[data-testid="app-header"]')).toBeVisible({ timeout: 5000 });
  });

  test('ヘッダーに日付が表示される', async ({ page }) => {
    await expect(page.locator('[data-testid="header-date"]')).toBeVisible({ timeout: 5000 });
    // 日付は MM/dd (曜日) 形式
    const dateText = await page.locator('[data-testid="header-date"]').textContent({ timeout: 5000 });
    expect(dateText).toMatch(/\d{2}\/\d{2}/);
  });

  test('FABボタンが表示される', async ({ page }) => {
    await expect(page.locator('[data-testid="action-fabs"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="fab-new-task"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="fab-new-event"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="fab-new-alarm"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="fab-memos"]')).toBeVisible({ timeout: 5000 });
  });

  test('同期ステータスインジケーターが表示される', async ({ page }) => {
    await expect(page.locator('[data-testid="sync-status-indicator"]')).toBeVisible({ timeout: 5000 });
  });

  test('ハンバーガーメニューを開閉できる', async ({ page }) => {
    await page.locator('[data-testid="menu-button"]').click({ timeout: 5000 });
    await expect(page.locator('[data-testid="navigation-drawer"]')).toBeVisible({ timeout: 5000 });
  });

  test('予定なしのメッセージが表示される', async ({ page }) => {
    // ローカルDBは空なので「予定はありません」が表示される
    await expect(page.locator('[data-testid="day-view"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="day-view"]').first()).toContainText('予定はありません', { timeout: 5000 });
  });
});
