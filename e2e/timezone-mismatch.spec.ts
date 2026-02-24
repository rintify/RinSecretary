import { test, expect } from '@playwright/test';

test.describe('サーバ、ブラウザ、ユーザー設定の3点タイムゾーン不一致シミュレーション', () => {
  // ブラウザ（操作している端末）のタイムゾーンを日本に設定
  test.use({ timezoneId: 'Asia/Tokyo' });

  test.beforeEach(async ({ page }) => {
    // API呼び出しで取得するユーザー設定をインド時間に設定する
    await page.route('/api/auth/me', async (route) => {
      const response = await route.fetch();
      if (response.ok()) {
        const json = await response.json();
        // ユーザーの希望する設定は「インド (UTC+5:30)」
        json.timezone = 'Asia/Kolkata';
        // 業務日開始をインドの午前4時にする
        json.dayStartHour = 4;
        await route.fulfill({ response, json });
      } else {
        await route.fallback();
      }
    });

    // ログイン
    page.on('console', (msg) => console.log('BROWSER:', msg.text()));
    await page.goto('/login', { timeout: 5000 });
    await page.locator('[data-testid="login-name-input"]').fill('testuser', { timeout: 5000 });
    await page.locator('[data-testid="login-password-input"]').fill('testpassword123', { timeout: 5000 });
    await page.locator('[data-testid="login-submit-button"]').click({ timeout: 5000 });
    await expect(page.locator('[data-testid="app-header"]')).toBeVisible({ timeout: 5000 });
  });

  test('ユーザー設定のインド時間に従い、ブラウザやサーバーのタイムゾーンに影響されず操作できること', async ({
    page,
  }) => {
    // 実行コマンドでサーバー時間(Node.js)は America/New_York (UTC-5)
    // ブラウザは Asia/Tokyo (UTC+9)

    // 現在時刻を「インド時間の 2024-03-01 12:00:00」に相当する瞬間に固定したい場合：
    // インドはUTC+5:30 なので、UTCで 2024-03-01T06:30:00Z
    // 東京はUTC+9 なので、東京ローカルタイムでは 2024-03-01T15:30:00+09:00 の瞬間。
    await page.addInitScript(() => {
      const fixedTime = new Date('2024-03-01T15:30:00+09:00').getTime();
      const OriginalDate = window.Date;
      class MockDate extends OriginalDate {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        constructor(...args: any[]) {
          if (args.length === 0) super(fixedTime);
          else super(...(args as []));
        }
        static now() {
          return fixedTime;
        }
      }
      Object.assign(MockDate, OriginalDate);
      MockDate.now = () => fixedTime;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Date = MockDate;
    });
    await page.reload();

    // 1. ヘッダーの日付表示の確認
    // アプリとしての設定はインド時間。この瞬間はインドの 3/1 12:00 なので 3/1 と表示されること。
    await expect(page.locator('[data-testid="header-date"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="header-date"]')).toHaveText('03/01 (金)');

    // 2. イベント作成で「14:00 (インド時間)」と入力したら、インドの14時として保存・表示されること
    await page.locator('[data-testid="action-fabs"]').click({ timeout: 5000 });
    await page.locator('[data-testid="fab-new-event"]').click({ timeout: 5000 });

    const title = `TZ3点ズレテスト_${Date.now()}`;
    await page.locator('[data-testid="event-title-input"]').fill(title, { timeout: 5000 });

    const startInput = page.locator('[data-testid="event-start-input"]');
    const endInput = page.locator('[data-testid="event-end-input"]');

    // ユーザーは「インド時間の 14:00 〜 15:00 のイベント」として入力する
    await startInput.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, '2024-03-01T14:00:00');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await endInput.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, '2024-03-01T15:00:00');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.locator('[data-testid="event-title-input"]').click({ timeout: 5000, force: true });

    // バリデーションエラーが出ていないこと
    await expect(page.locator('text=終了日時は開始日時より後に設定してください')).not.toBeVisible();
    await expect(page.locator('[data-testid="event-save-button"]')).toBeEnabled({ timeout: 5000 });
    await page.locator('[data-testid="event-save-button"]').click({ timeout: 5000, force: true });

    await page.clock.runFor(2000);

    // 3. UIに表示される時間もブラウザのローカル時間ではなく、インドの14:00として正しく表示されること
    const card = page.locator(`[data-testid^="event-card-"]`, { hasText: title }).first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card).toContainText('14:00', { timeout: 5000 });
  });
});
