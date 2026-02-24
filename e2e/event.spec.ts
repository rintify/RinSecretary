import { test, expect } from '@playwright/test';

test.describe('イベントの作成と編集', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン
    await page.goto('/login', { timeout: 5000 });
    await page.locator('[data-testid="login-name-input"]').fill('testuser', { timeout: 5000 });
    await page.locator('[data-testid="login-password-input"]').fill('testpassword123', { timeout: 5000 });
    await page.locator('[data-testid="login-submit-button"]').click({ timeout: 5000 });
    await expect(page.locator('[data-testid="app-header"]')).toBeVisible({ timeout: 5000 });
  });

  test('新規イベントを作成し、表示されること', async ({ page }) => {
    const title = `テストイベント_${Date.now()}`;
    const memo = `これはテストイベントのメモです。\n${Date.now()}`;

    // FABからイベント作成ダイアログを開く
    await page.locator('[data-testid="action-fabs"]').click({ timeout: 5000 });
    await page.locator('[data-testid="fab-new-event"]').click({ timeout: 5000 });

    // ダイアログが表示されるのを待つ
    await expect(page.locator('[data-testid="event-title-input"]')).toBeVisible({ timeout: 5000 });

    // 入力
    await page.locator('[data-testid="event-title-input"]').fill(title, { timeout: 5000 });
    await page.locator('[data-testid="event-memo-input"]').fill(memo, { timeout: 5000 });

    // 保存
    await page.locator('[data-testid="event-save-button"]').click({ timeout: 5000 });

    // ダイアログが閉じるのを待つ
    await expect(page.locator('[data-testid="event-title-input"]')).not.toBeVisible({ timeout: 5000 });

    // メイン画面（DayView）にイベントカードが表示されていること
    // DaySwiperが仮想スライドをレンダリングするため、first() を付与して要素を一意にする
    await expect(page.locator(`[data-testid^="event-card-"]`, { hasText: title }).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('既存のイベントを編集できること', async ({ page }) => {
    // イベントをまず作成する
    const originalTitle = `編集前タイトル_${Date.now()}`;
    await page.locator('[data-testid="action-fabs"]').click({ timeout: 5000 });
    await page.locator('[data-testid="fab-new-event"]').click({ timeout: 5000 });
    await expect(page.locator('[data-testid="event-title-input"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="event-title-input"]').fill(originalTitle, { timeout: 5000 });
    await page.locator('[data-testid="event-save-button"]').click({ timeout: 5000 });

    // 作成されたイベントカードをクリックして開く
    const card = page.locator(`[data-testid^="event-card-"]`, { hasText: originalTitle }).first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click({ timeout: 5000 });

    // ダイアログが編集モードで開く
    await expect(page.locator('[data-testid="event-title-input"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="event-title-input"]')).toHaveValue(originalTitle, { timeout: 5000 });

    const newTitle = `編集後タイトル_${Date.now()}`;
    const newMemo = '編集されたメモ';

    await page.locator('[data-testid="event-title-input"]').fill(newTitle, { timeout: 5000 });
    await page.locator('[data-testid="event-memo-input"]').fill(newMemo, { timeout: 5000 });
    await page.locator('[data-testid="event-save-button"]').click({ timeout: 5000 });

    // ダイアログが閉じる
    await expect(page.locator('[data-testid="event-title-input"]')).not.toBeVisible({ timeout: 5000 });

    // 変更されたタイトルが表示されていること
    await expect(page.locator(`[data-testid^="event-card-"]`, { hasText: newTitle }).first()).toBeVisible({
      timeout: 5000,
    });

    // 元のタイトルは見えなくなっていること
    await expect(page.locator(`[data-testid^="event-card-"]`, { hasText: originalTitle })).toHaveCount(0, {
      timeout: 5000,
    });
  });

  test('終了日時が開始日時より前の場合、保存できずエラーが表示されること', async ({ page }) => {
    await page.locator('[data-testid="action-fabs"]').click({ timeout: 5000 });
    await page.locator('[data-testid="fab-new-event"]').click({ timeout: 5000 });
    await expect(page.locator('[data-testid="event-title-input"]')).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="event-title-input"]').fill(`エラーテスト_${Date.now()}`, { timeout: 5000 });

    // カスタムピッカー導入により datetime-local input は hidden になっているため
    // fill ではなくフォーカスを当てて値を注入するのではなく、
    // UIを操作する（時計アイコンを押して時刻を選択する等）か、あるいは
    // EventDialog 側の test helper input に onChange が設定されたので、
    // evaluate経由で直接値を書き換え、Reactに検知させる
    const startInput = page.locator('[data-testid="event-start-input"]');
    const endInput = page.locator('[data-testid="event-end-input"]');

    await startInput.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, '2030-10-10T10:00');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await endInput.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, '2030-10-10T09:00');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // 判定を発火させるため適当な場所にフォーカス移動
    await page.locator('[data-testid="event-title-input"]').click({ timeout: 5000, force: true });

    // ヘルパーテキスト（エラーメッセージ）が表示されることを確認
    await expect(page.locator('text=終了日時は開始日時より後に設定してください')).toBeVisible({ timeout: 5000 });

    // 保存ボタンが非活性になっていることを確認
    await expect(page.locator('[data-testid="event-save-button"]')).toBeDisabled({ timeout: 5000 });
  });

  test('開始日時と終了日時が同じ場合、保存できずエラーが表示されること', async ({ page }) => {
    await page.locator('[data-testid="action-fabs"]').click({ timeout: 5000 });
    await page.locator('[data-testid="fab-new-event"]').click({ timeout: 5000 });
    await expect(page.locator('[data-testid="event-title-input"]')).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="event-title-input"]').fill(`同値テスト_${Date.now()}`, { timeout: 5000 });

    const startInput = page.locator('[data-testid="event-start-input"]');
    const endInput = page.locator('[data-testid="event-end-input"]');

    await startInput.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, '2030-10-10T10:00');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await endInput.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, '2030-10-10T10:00');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.locator('[data-testid="event-title-input"]').click({ timeout: 5000, force: true });

    await expect(page.locator('text=終了日時は開始日時より後に設定してください')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="event-save-button"]')).toBeDisabled({ timeout: 5000 });
  });

  test('深夜帯で日をまたぐイベントの作成（23:30〜翌0:30）が正常に行えること', async ({ page }) => {
    // Playwrightのpage.clockによるモックはReactの内部setTimeoutやDexieの非同期処理と
    // 競合してボタンが非活性のままになるなどの弊害があるため、実時間から動的に算出する
    const now = new Date();
    const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T23:30:00`;

    // 翌日の日付
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}T00:30:00`;

    await page.locator('[data-testid="action-fabs"]').click({ timeout: 5000 });
    await page.locator('[data-testid="fab-new-event"]').click({ timeout: 5000 });
    await expect(page.locator('[data-testid="event-title-input"]')).toBeVisible({ timeout: 5000 });

    const title = `日またぎイベント_${Date.now()}`;
    await page.locator('[data-testid="event-title-input"]').fill(title, { timeout: 5000 });

    const startInput = page.locator('[data-testid="event-start-input"]');
    const endInput = page.locator('[data-testid="event-end-input"]');

    await startInput.evaluate((el: HTMLInputElement, val) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, startStr);

    await endInput.evaluate((el: HTMLInputElement, val) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, endStr);

    await page.locator('[data-testid="event-title-input"]').click({ timeout: 5000, force: true });

    // エラーが出ず、保存ボタンが有効であること
    await expect(page.locator('text=終了日時は開始日時より後に設定してください')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="event-save-button"]')).toBeEnabled({ timeout: 5000 });

    // 保存実行
    await page.locator('[data-testid="event-save-button"]').click({ timeout: 5000, force: true });
    await expect(page.locator('[data-testid="event-title-input"]')).not.toBeVisible({ timeout: 5000 });

    // イベントが表示されること
    await expect(page.locator(`[data-testid^="event-card-"]`, { hasText: title }).first()).toBeVisible({
      timeout: 5000,
    });
  });
});
