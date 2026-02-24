import { test, expect } from '@playwright/test';

test.describe('ログインページ', () => {
  test('ログインフォームが表示される', async ({ page }) => {
    await page.goto('/login', { timeout: 5000 });
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="login-name-input"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="login-password-input"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="login-submit-button"]')).toBeVisible({ timeout: 5000 });
  });

  test('正しい認証情報でログインするとメインページに遷移する', async ({ page }) => {
    await page.goto('/login', { timeout: 5000 });

    await page.locator('[data-testid="login-name-input"]').fill('testuser', { timeout: 5000 });
    await page.locator('[data-testid="login-password-input"]').fill('testpassword123', { timeout: 5000 });
    await page.locator('[data-testid="login-submit-button"]').click({ timeout: 5000 });

    await expect(page.locator('[data-testid="app-header"]')).toBeVisible({ timeout: 5000 });
  });

  test('不正な認証情報でエラーが表示される', async ({ page }) => {
    await page.goto('/login', { timeout: 5000 });

    await page.locator('[data-testid="login-name-input"]').fill('testuser', { timeout: 5000 });
    await page.locator('[data-testid="login-password-input"]').fill('wrongpassword', { timeout: 5000 });
    await page.locator('[data-testid="login-submit-button"]').click({ timeout: 5000 });

    await expect(page.locator('[data-testid="login-error"]')).toBeVisible({ timeout: 5000 });
  });

  test('未認証でメインページにアクセスするとログインページにリダイレクトされる', async ({ page }) => {
    await page.goto('/', { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('ログイン後ログアウトするとログインページに戻る', async ({ page }) => {
    await page.goto('/login', { timeout: 5000 });

    await page.locator('[data-testid="login-name-input"]').fill('testuser', { timeout: 5000 });
    await page.locator('[data-testid="login-password-input"]').fill('testpassword123', { timeout: 5000 });
    await page.locator('[data-testid="login-submit-button"]').click({ timeout: 5000 });

    await expect(page.locator('[data-testid="app-header"]')).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="menu-button"]').click({ timeout: 5000 });
    await page.locator('[data-testid="menu-logout"]').click({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
