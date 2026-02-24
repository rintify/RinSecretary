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

  test('昼間（12:00）の場合、当日の日付がヘッダーに表示されること', async ({ page }) => {
    await page.clock.install({ time: new Date('2024-03-01T12:00:00+09:00') });
    await page.reload();
    await expect(page.locator('[data-testid="header-date"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="header-date"]')).toHaveText('03/01 (金)');
  });

  test('深夜帯（03:00）の場合、前日の日付がヘッダーに表示されること', async ({ page }) => {
    // 営業日の開始が4:00の場合、3/2の3:00は3/1扱いになるはず
    await page.clock.install({ time: new Date('2024-03-02T03:00:00+09:00') });
    await page.reload();
    await expect(page.locator('[data-testid="header-date"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="header-date"]')).toHaveText('03/01 (金)');
  });

  test('早朝（05:00）の場合、当日の日付がヘッダーに表示されること', async ({ page }) => {
    // 営業日の開始が4:00の場合、3/2の5:00は3/2扱いになるはず
    await page.clock.install({ time: new Date('2024-03-02T05:00:00+09:00') });
    await page.reload();
    await expect(page.locator('[data-testid="header-date"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="header-date"]')).toHaveText('03/02 (土)');
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
