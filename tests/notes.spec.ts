import { test, expect } from '@playwright/test';

test.describe('Notes (Phase 9)', () => {
  const testEmail = `notes_${Date.now()}@example.com`;
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

  test('should navigate to notes page', async ({ page }) => {
    await page.click('[data-testid="notes-link"]', { timeout: 5000 });
    await page.waitForURL('**/notes', { timeout: 5000 });
    await expect(page.locator('h1', { hasText: 'ノート' })).toBeVisible({ timeout: 5000 });
  });

  test('should create a new note', async ({ page }) => {
    await page.goto('/notes');
    await page.waitForSelector('[data-testid="create-note-btn"]', { timeout: 5000 });

    // 1. 新規作成ダイアログを開く
    await page.click('[data-testid="create-note-btn"]');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 2. タイトルと本文を入力 (MUI TextFieldはdata-testidがdivにつくので内部input/textareaを指定)
    await page.fill('[data-testid="note-form-title"] input', '最初のノート');
    await page.fill(
      '[data-testid="note-form-content"] textarea:first-of-type',
      'これはテスト用のノートです。\nMarkdownで記述可能。',
    );

    // 3. 作成ボタンをクリック
    await page.click('[data-testid="note-form-submit"]');
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // 4. 一覧にノートが表示される
    const noteCard = page.locator('[data-testid^="note-card-"]', { hasText: '最初のノート' });
    await expect(noteCard).toBeVisible({ timeout: 5000 });
    await expect(noteCard.locator('text=これはテスト用のノートです')).toBeVisible({ timeout: 5000 });
  });

  test('should edit an existing note', async ({ page }) => {
    await page.goto('/notes');
    await page.waitForSelector('[data-testid="create-note-btn"]', { timeout: 5000 });

    // ノートを作成
    await page.click('[data-testid="create-note-btn"]');
    await page.fill('[data-testid="note-form-title"] input', '編集テスト用');
    await page.fill('[data-testid="note-form-content"] textarea:first-of-type', '初期内容');
    await page.click('[data-testid="note-form-submit"]');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // 作成されたノートを開く
    const noteCard = page.locator('[data-testid^="note-card-"]', { hasText: '編集テスト用' });
    await expect(noteCard).toBeVisible({ timeout: 5000 });
    await noteCard.locator('[data-testid^="note-open-"]').click({ timeout: 5000 });

    // 編集ダイアログが表示される
    const editDialog = page.locator('[role="dialog"]');
    await expect(editDialog).toBeVisible({ timeout: 5000 });

    // タイトルと本文を変更
    await page.fill('[data-testid="note-edit-title"] input', '編集後のタイトル');
    await page.fill('[data-testid="note-edit-content"] textarea:first-of-type', '変更された内容');

    // 保存
    await page.click('[data-testid="note-edit-save"]');
    await expect(editDialog).not.toBeVisible({ timeout: 5000 });

    // 変更後のタイトルが一覧に表示される
    await expect(page.locator('[data-testid^="note-card-"]', { hasText: '編集後のタイトル' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('should persist notes after reload', async ({ page }) => {
    await page.goto('/notes');
    await page.waitForSelector('[data-testid="create-note-btn"]', { timeout: 5000 });

    // ノート作成
    const uniqueTitle = `永続化テスト ${Date.now()}`;
    await page.click('[data-testid="create-note-btn"]');
    await page.fill('[data-testid="note-form-title"] input', uniqueTitle);
    await page.fill('[data-testid="note-form-content"] textarea:first-of-type', 'リロード後も残るべき');
    await page.click('[data-testid="note-form-submit"]');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid^="note-card-"]', { hasText: uniqueTitle })).toBeVisible({ timeout: 5000 });

    // リロード後も表示される
    await page.reload();
    await expect(page.locator('[data-testid^="note-card-"]', { hasText: uniqueTitle })).toBeVisible({ timeout: 5000 });
  });

  test('should delete a note (soft delete)', async ({ page }) => {
    await page.goto('/notes');
    await page.waitForSelector('[data-testid="create-note-btn"]', { timeout: 5000 });

    // ノート作成
    const deleteTitle = `削除テスト ${Date.now()}`;
    await page.click('[data-testid="create-note-btn"]');
    await page.fill('[data-testid="note-form-title"] input', deleteTitle);
    await page.fill('[data-testid="note-form-content"] textarea:first-of-type', '削除予定のノート');
    await page.click('[data-testid="note-form-submit"]');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // ノートを開いて削除ボタンをクリック
    const noteCard = page.locator('[data-testid^="note-card-"]', { hasText: deleteTitle });
    await expect(noteCard).toBeVisible({ timeout: 5000 });
    await noteCard.locator('[data-testid^="note-open-"]').click({ timeout: 5000 });

    const editDialog = page.locator('[role="dialog"]');
    await expect(editDialog).toBeVisible({ timeout: 5000 });
    await page.click('[data-testid="note-delete-btn"]');

    // ダイアログが閉じ、ノートが一覧から消える
    await expect(editDialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid^="note-card-"]', { hasText: deleteTitle })).not.toBeVisible({
      timeout: 5000,
    });
  });
});
