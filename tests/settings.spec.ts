import { test, expect } from '@playwright/test';

test.describe('System Settings & Config', () => {
  const testEmail = `settings_${Date.now()}@example.com`;
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

  test('should navigate to settings, update config, and retrieve it properly', async ({ page }) => {
    // 1. ダッシュボードから設定画面へ遷移
    await page.click('[data-testid="settings-link"]');
    await page.waitForURL('**/settings', { timeout: 5000 });

    // タイトルの確認
    await expect(page.locator('h1', { hasText: 'システム設定' })).toBeVisible({ timeout: 5000 });

    // 2. フォーム内容の変更
    // MUI Selectの操作: comboboxの役割を持つ要素をクリックしてメニューを展開する
    await page.locator('[data-testid="setting-ai-provider"] div[role="combobox"]').click();
    await page.getByRole('option', { name: 'Google Gemini' }).click();

    await page.fill('[data-testid="setting-ai-apikey"] input', 'sk-test-gemini-key');
    await page.fill('[data-testid="setting-ai-model"] input', 'gemini-1.5-pro');
    await page.fill('[data-testid="setting-discord-webhook"] input', 'https://discord.com/api/webhooks/test');

    // 3. APIへ保存
    await page.click('[data-testid="save-settings-btn"]');

    // トーストが表示されるまで待機
    await expect(page.locator('text=設定を保存しました')).toBeVisible({ timeout: 5000 });

    // 4. 一度ダッシュボードへ戻る
    await page.click('[data-testid="back-to-home-btn"]');
    await page.waitForURL('**/', { timeout: 5000 });

    // 5. キャッシュやAPI再取得を検証するため、ページをリロードして再アクセス
    await page.reload();
    await page.click('[data-testid="settings-link"]');
    await page.waitForURL('**/settings', { timeout: 10000 });

    // MUI の input text field 要素 (data-testid にネストされた input) の value をアサーション
    await expect(page.locator('[data-testid="setting-discord-webhook"] input')).toHaveValue(
      'https://discord.com/api/webhooks/test',
      { timeout: 10000 },
    );
    await expect(page.locator('[data-testid="setting-ai-model"] input')).toHaveValue('gemini-1.5-pro', {
      timeout: 5000,
    });

    // パスワードは API から取得された上で安全に********としてマスクされているか確認
    await expect(page.locator('[data-testid="setting-ai-apikey"] input')).toHaveValue('********', { timeout: 5000 });

    // Select フィールドは div[role="combobox"] のテキスト内容で検証できる
    await expect(page.locator('[data-testid="setting-ai-provider"] div[role="combobox"]')).toHaveText('Google Gemini', {
      timeout: 5000,
    });
  });
});
