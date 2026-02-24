import { test, expect } from '@playwright/test';

test.describe('ユーザー固有のタイムゾーン・開始時刻設定', () => {
  // テスト全体をニューヨーク時間に設定する
  test.use({ timezoneId: 'America/New_York' });

  test.beforeEach(async ({ page }) => {
    // '/api/auth/me' のレスポンスをインターセプトし、dayStartHour などをモックする
    await page.route('/api/auth/me', async (route) => {
      const response = await route.fetch();
      if (response.ok()) {
        const json = await response.json();
        // ニューヨーク設定かつ、1日の開始時刻を朝の6時に設定
        json.dayStartHour = 6;
        json.timezone = 'America/New_York';
        await route.fulfill({ response, json });
      } else {
        await route.fallback();
      }
    });

    // ログイン
    await page.goto('/login', { timeout: 5000 });
    await page.locator('[data-testid="login-name-input"]').fill('testuser', { timeout: 5000 });
    await page.locator('[data-testid="login-password-input"]').fill('testpassword123', { timeout: 5000 });
    await page.locator('[data-testid="login-submit-button"]').click({ timeout: 5000 });
    await expect(page.locator('[data-testid="app-header"]')).toBeVisible({ timeout: 5000 });
  });

  test('dayStartHour=6 の場合、朝の05:00は前日とみなされ、06:00以降は当日とみなされること', async ({ page }) => {
    // ニューヨーク時間の 2024-03-02 05:00:00
    // TZ=America/New_York環境下なので、時刻文字列だけで指定可能だが確実を期してISO文字列にする
    await page.clock.install({ time: new Date('2024-03-02T05:00:00-05:00') });
    await page.reload();

    await expect(page.locator('[data-testid="header-date"]')).toBeVisible({ timeout: 5000 });
    // 6時前なので 3/1 になる
    await expect(page.locator('[data-testid="header-date"]')).toHaveText('03/01 (金)');

    // 時計を 06:00 に進める
    await page.clock.setFixedTime(new Date('2024-03-02T06:00:00-05:00'));
    await page.reload();

    // 6時以降なので 3/2 になる
    await expect(page.locator('[data-testid="header-date"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="header-date"]')).toHaveText('03/02 (土)');
  });
});
