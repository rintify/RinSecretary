import { test, expect } from '@playwright/test';

test.describe('アカウント作成', () => {
  test('ログインページから新規登録ページへ遷移できる', async ({ page }) => {
    await page.goto('/login', { timeout: 5000 });
    await page.locator('[data-testid="to-register-link"]').click({ timeout: 5000 });
    await expect(page).toHaveURL(/\/register/, { timeout: 5000 });
    await expect(page.locator('[data-testid="register-form"]')).toBeVisible({ timeout: 5000 });
  });

  test('新規登録ページからログインページへ遷移できる', async ({ page }) => {
    await page.goto('/register', { timeout: 5000 });
    await page.locator('[data-testid="to-login-link"]').click({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible({ timeout: 5000 });
  });

  test('アカウントの作成と自動ログインができる', async ({ page }) => {
    await page.goto('/register', { timeout: 5000 });

    const newUsername = 'new_' + Date.now().toString(36);

    await page.locator('[data-testid="register-name-input"]').fill(newUsername, { timeout: 5000 });
    await page.locator('[data-testid="register-nickname-input"]').fill('ニックネーム', { timeout: 5000 });
    await page.locator('[data-testid="register-password-input"]').fill('password123', { timeout: 5000 });
    await page.locator('[data-testid="register-submit-button"]').click({ timeout: 5000 });

    // メインページへ遷移していること
    await expect(page.locator('[data-testid="app-header"]')).toBeVisible({ timeout: 5000 });
  });

  test('ユーザーIDの境界値：3文字で登録できる', async ({ page }) => {
    await page.goto('/register', { timeout: 5000 });

    const newUsername = Math.random().toString(36).substring(2, 5); // 3文字のランダムな英数字

    await page.locator('[data-testid="register-name-input"]').fill(newUsername, { timeout: 5000 });
    await page.locator('[data-testid="register-nickname-input"]').fill('ニックネーム', { timeout: 5000 });
    await page.locator('[data-testid="register-password-input"]').fill('password123', { timeout: 5000 });
    await page.locator('[data-testid="register-submit-button"]').click({ timeout: 5000 });

    await expect(page.locator('[data-testid="app-header"]')).toBeVisible({ timeout: 5000 });
  });

  test('ユーザーIDの境界値：15文字で登録できる', async ({ page }) => {
    await page.goto('/register', { timeout: 5000 });

    const randomStr = Math.random().toString(36).substring(2);
    // 確実に15文字にする
    const newUsername = `user_${Date.now().toString(36)}_${randomStr}`.substring(0, 15);

    await page.locator('[data-testid="register-name-input"]').fill(newUsername, { timeout: 5000 });
    await page.locator('[data-testid="register-nickname-input"]').fill('ニックネーム', { timeout: 5000 });
    await page.locator('[data-testid="register-password-input"]').fill('password123', { timeout: 5000 });
    await page.locator('[data-testid="register-submit-button"]').click({ timeout: 5000 });

    await expect(page.locator('[data-testid="app-header"]')).toBeVisible({ timeout: 5000 });
  });

  test('ユーザーIDの境界値：2文字以下はHTMLバリデーションで弾かれる', async ({ page }) => {
    await page.goto('/register', { timeout: 5000 });

    await page.locator('[data-testid="register-name-input"]').fill('ab', { timeout: 5000 });
    await page.locator('[data-testid="register-nickname-input"]').fill('ニックネーム', { timeout: 5000 });
    await page.locator('[data-testid="register-password-input"]').fill('password123', { timeout: 5000 });
    await page.locator('[data-testid="register-submit-button"]').click({ timeout: 5000 });

    // フォーム送信されずページ遷移しない
    await expect(page).toHaveURL(/\/register/, { timeout: 5000 });

    // HTML5 Validity APIでの検証
    const isValid = await page
      .locator('[data-testid="register-name-input"]')
      .evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  });

  test('ユーザーIDの境界値：16文字以上はmaxLengthにより入力できない', async ({ page }) => {
    await page.goto('/register', { timeout: 5000 });

    // ユーザーのタイピングをシミュレート
    await page.locator('[data-testid="register-name-input"]').pressSequentially('1234567890123456', { timeout: 5000 });

    // maxLengthにより15文字で切り捨てられていることを確認
    await expect(page.locator('[data-testid="register-name-input"]')).toHaveValue('123456789012345', { timeout: 5000 });
  });

  test('ユーザーIDの文字種：不正な文字（記号や全角文字）はHTMLバリデーションで弾かれる', async ({ page }) => {
    await page.goto('/register', { timeout: 5000 });

    // 記号を含む場合
    await page.locator('[data-testid="register-name-input"]').fill('test@user', { timeout: 5000 });
    const isValidSymbol = await page
      .locator('[data-testid="register-name-input"]')
      .evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValidSymbol).toBe(false);

    // 全角を含む場合
    await page.locator('[data-testid="register-name-input"]').fill('テスト', { timeout: 5000 });
    const isValidZenkaku = await page
      .locator('[data-testid="register-name-input"]')
      .evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValidZenkaku).toBe(false);
  });

  test('すでに使われているユーザー名ではエラーが出る', async ({ page }) => {
    await page.goto('/register', { timeout: 5000 });

    // testuser は auth.setup で作成済み
    await page.locator('[data-testid="register-name-input"]').fill('testuser', { timeout: 5000 });
    await page.locator('[data-testid="register-nickname-input"]').fill('ニックネーム', { timeout: 5000 });
    await page.locator('[data-testid="register-password-input"]').fill('password123', { timeout: 5000 });
    await page.locator('[data-testid="register-submit-button"]').click({ timeout: 5000 });

    await expect(page.locator('[data-testid="register-error"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="register-error"]')).toContainText('既に使用されています', {
      timeout: 5000,
    });
  });
});
