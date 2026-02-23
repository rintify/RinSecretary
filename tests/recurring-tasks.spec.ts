import { test, expect } from '@playwright/test';

test.describe('Recurring Tasks (Phase 8)', () => {
  const testEmail = `recurring_${Date.now()}@example.com`;
  const testPassword = 'password123';

  test.beforeEach(async ({ page }) => {
    // アカウント登録
    await page.goto('/register');
    await page.fill('[data-testid="register-email"]', testEmail);
    await page.fill('[data-testid="register-password"]', testPassword);
    await page.click('[data-testid="register-submit"]');

    // 登録成功後のリダイレクト（既に登録済みの場合はログインページにいる）
    await page.waitForURL('**/login', { timeout: 5000 }).catch(() => {});

    // ログイン
    await page.goto('/login');
    await page.fill('[data-testid="login-email"]', testEmail);
    await page.fill('[data-testid="login-password"]', testPassword);
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('**/', { timeout: 5000 });
  });

  test('should navigate to recurring tasks page', async ({ page }) => {
    await page.click('[data-testid="recurring-link"]', { timeout: 5000 });
    await page.waitForURL('**/recurring', { timeout: 5000 });
    await expect(page.locator('h1', { hasText: '定期タスク' })).toBeVisible({ timeout: 5000 });
  });

  test('should create a recurring task with templates', async ({ page }) => {
    await page.goto('/recurring');
    await page.waitForSelector('[data-testid="create-recurring-btn"]', { timeout: 5000 });

    // 1. 新規作成ダイアログを開く
    await page.click('[data-testid="create-recurring-btn"]');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 2. タイトルと説明を入力 (MUI TextFieldはdata-testidがdivにつくので内部inputを指定)
    await page.fill('[data-testid="recurring-form-title"] input', '朝のルーティン');
    await page.fill('[data-testid="recurring-form-desc"] textarea:first-of-type', '毎朝やるべきこと');

    // 3. 頻度を「毎日」のまま（デフォルト）

    // 4. チェックリストテンプレートを追加
    await page.fill('[data-testid="recurring-form-template-input"] input', 'ストレッチ');
    await page.click('[data-testid="recurring-form-add-template"]');
    await expect(dialog.locator('text=ストレッチ')).toBeVisible({ timeout: 5000 });

    await page.fill('[data-testid="recurring-form-template-input"] input', '日記を書く');
    await page.click('[data-testid="recurring-form-add-template"]');
    await expect(dialog.locator('text=日記を書く')).toBeVisible({ timeout: 5000 });

    // 5. 作成ボタンをクリック
    await page.click('[data-testid="recurring-form-submit"]');
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // 6. 一覧にタスクが表示される
    const taskItem = page.locator('li', { hasText: '朝のルーティン' });
    await expect(taskItem).toBeVisible({ timeout: 5000 });
    await expect(taskItem.locator('text=毎日')).toBeVisible({ timeout: 5000 });
  });

  test('should toggle recurring task active state', async ({ page }) => {
    await page.goto('/recurring');
    await page.waitForSelector('[data-testid="create-recurring-btn"]', { timeout: 5000 });

    // まず定期タスクを作成
    await page.click('[data-testid="create-recurring-btn"]');
    await page.fill('[data-testid="recurring-form-title"] input', 'トグルテスト');
    await page.click('[data-testid="recurring-form-submit"]');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // タスクを見つける
    const taskItem = page.locator('li', { hasText: 'トグルテスト' });
    await expect(taskItem).toBeVisible({ timeout: 5000 });

    // 有効→無効に切り替え
    const toggleSwitch = taskItem.locator('input[type="checkbox"]');
    await toggleSwitch.click({ timeout: 5000 });

    // 無効ラベルが表示されることを確認
    await expect(taskItem.locator('text=無効')).toBeVisible({ timeout: 5000 });
  });

  test('should persist recurring tasks after reload', async ({ page }) => {
    await page.goto('/recurring');
    await page.waitForSelector('[data-testid="create-recurring-btn"]', { timeout: 5000 });

    // タスク作成
    const uniqueTitle = `永続化テスト ${Date.now()}`;
    await page.click('[data-testid="create-recurring-btn"]');
    await page.fill('[data-testid="recurring-form-title"] input', uniqueTitle);
    await page.click('[data-testid="recurring-form-submit"]');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('li', { hasText: uniqueTitle })).toBeVisible({ timeout: 5000 });

    // リロード後も表示される（IndexedDB永続化の確認）
    await page.reload();
    await expect(page.locator('li', { hasText: uniqueTitle })).toBeVisible({ timeout: 5000 });
  });
});
