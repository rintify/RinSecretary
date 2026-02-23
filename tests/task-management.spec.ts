import { test, expect } from '@playwright/test';

// データベースの初期化を各テスト前に行う
test.beforeEach(async ({ page }) => {
  await page.goto('/login');

  // 登録済みのアカウントでログイン（テスト用の初期データとしてフェーズ3の仕様に準拠）
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  // ダッシュボードに遷移するまで待機
  await page.waitForURL('**/', { timeout: 10000 });
});

test.describe('Task Management Details', () => {
  test('should add a task, open details, edit priority and due date, and save', async ({ page }) => {
    // 1. ゴミ掃除 (既存タスククリア)
    await page.click('[data-testid="clear-tasks-btn"]');

    // 2. 新しいタスクを追加
    const taskTitle = `Daily Report ${Date.now()}`;
    await page.fill('[data-testid="new-task-input"]', taskTitle);
    await page.click('[data-testid="add-task-btn"]');

    // 3. リストに追加されたタスクが存在することを確認し、詳細ダイアログを開く
    const taskItem = page.locator('li', { hasText: taskTitle }).first();
    await expect(taskItem).toBeVisible({ timeout: 5000 });

    // ListItemButton に設定された id ベースのテストIDを取得してクリック
    const editButton = taskItem.locator('[data-testid^="task-edit-button"]');
    await editButton.click();

    // 4. ダイアログが表示されていることを確認
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator('h2', { hasText: 'タスクの編集' })).toBeVisible();

    // 5. 説明（Description）を入力
    await page.fill('[data-testid="edit-task-desc"]', 'This is a detailed description.');

    // 6. 優先度を変更 (例: 高 = 3)
    const prioritySelect = dialog.locator('[data-testid="edit-task-priority"]');
    await prioritySelect.click();
    await page.click('[data-value="3"]'); // "高" を選択

    // 7. 期限を指定 (今日の日付など)
    const today = new Date().toISOString().split('T')[0];
    await page.fill('[data-testid="edit-task-due"] input', today);

    // 8. 保存ボタンをクリック
    await page.click('[data-testid="save-task-btn"]');

    // 9. ダイアログが閉じたことを確認
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // 10. リスト上にバッジが表示されていることを確認
    const priorityBadge = taskItem.locator('[data-testid^="task-priority"]');
    await expect(priorityBadge).toHaveText('高', { timeout: 5000 });

    const dueBadge = taskItem.locator('[data-testid^="task-due"]');
    await expect(dueBadge).toBeVisible({ timeout: 5000 });

    // 11. リロード後に永続化されていることを確認 (IndexedDB)
    await page.reload();
    await page.waitForTimeout(1000); // ロード待機

    const reloadedTaskItem = page.locator('li', { hasText: taskTitle }).first();
    await expect(reloadedTaskItem.locator('[data-testid^="task-priority"]')).toHaveText('高', { timeout: 5000 });
  });
});
