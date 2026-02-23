import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'password123';

  test('should register a new account, login, and access protected route', async ({ page }) => {
    // 1. サインアップ画面へ遷移
    await page.goto('/register');

    // 2. 登録情報を入力
    await page.fill('[data-testid="register-name"]', 'Test User', { timeout: 5000 });
    await page.fill('[data-testid="register-email"]', testEmail, { timeout: 5000 });
    await page.fill('[data-testid="register-password"]', testPassword, { timeout: 5000 });
    await page.click('[data-testid="register-submit"]', { timeout: 5000 });

    // 3. ログイン画面への遷移を待機 (URLチェック)
    await page.waitForURL('**/login', { timeout: 5000 });

    // 4. ログイン実行
    await page.fill('[data-testid="login-email"]', testEmail, { timeout: 5000 });
    await page.fill('[data-testid="login-password"]', testPassword, { timeout: 5000 });
    // URL遷移を監視しながらクリック待機
    const [response] = await Promise.all([
      page.waitForURL('**/', { timeout: 5000 }),
      page.click('[data-testid="login-submit"]', { timeout: 5000 }),
    ]);

    // ホームページ（保護ルート）にアクセスできたことの確認
    await expect(page).toHaveURL(/.*\/$/);
  });

  test('should redirect unauthenticated users from protected route to /login', async ({ page }) => {
    // ログインしていない状態でトップ(/)へアクセス
    await page.goto('/');

    // ミドルウェアによって /login へは弾かれることを確認
    await page.waitForURL('**/login', { timeout: 5000 });
    const emailInput = page.locator('[data-testid="login-email"]');
    await expect(emailInput).toBeVisible({ timeout: 5000 });
  });
});
