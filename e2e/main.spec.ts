import { test, expect } from '@playwright/test';

test.describe('メイン画面', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン
    await page.goto('/login', { timeout: 5000 });
    await page.locator('[data-testid="login-name-input"]').fill('testuser', { timeout: 5000 });
    await page.locator('[data-testid="login-password-input"]').fill('testpassword123', { timeout: 5000 });
    await page.locator('[data-testid="login-submit-button"]').click({ timeout: 5000 });
    await expect(page.locator('[data-testid="app-header"]')).toBeVisible({ timeout: 5000 });
  });

  test('昼間（12:00）の場合、当日の日付がヘッダーに表示されること', async ({ page }) => {
    await page.clock.install({ time: new Date('2024-03-01T12:00:00+09:00') });
    await page.reload();
    await expect(page.locator('[data-testid="header-date"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="header-date"]')).toHaveText('03/01 (金)');
  });

  test('深夜帯（03:00）の場合、前日の日付がヘッダーに表示されること', async ({ page }) => {
    // 営業日の開始が4:00の場合、3/2の3:00は3/1扱いになるはず
    await page.clock.install({ time: new Date('2024-03-02T03:00:00+09:00') });
    await page.reload();
    await expect(page.locator('[data-testid="header-date"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="header-date"]')).toHaveText('03/01 (金)');
  });

  test('早朝（05:00）の場合、当日の日付がヘッダーに表示されること', async ({ page }) => {
    // 営業日の開始が4:00の場合、3/2の5:00は3/2扱いになるはず
    await page.clock.install({ time: new Date('2024-03-02T05:00:00+09:00') });
    await page.reload();
    await expect(page.locator('[data-testid="header-date"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="header-date"]')).toHaveText('03/02 (土)');
  });

  test('FABボタンが表示される', async ({ page }) => {
    await expect(page.locator('[data-testid="action-fabs"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="fab-new-task"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="fab-new-event"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="fab-new-alarm"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="fab-memos"]')).toBeVisible({ timeout: 5000 });
  });

  test('同期ステータスインジケーターが表示される', async ({ page }) => {
    await expect(page.locator('[data-testid="sync-status-indicator"]')).toBeVisible({ timeout: 5000 });
  });

  test('ハンバーガーメニューを開閉できる', async ({ page }) => {
    await page.locator('[data-testid="menu-button"]').click({ timeout: 5000 });
    await expect(page.locator('[data-testid="navigation-drawer"]')).toBeVisible({ timeout: 5000 });
  });

  test('予定なしのメッセージが表示される', async ({ page }) => {
    // ローカルDBは空なので「予定はありません」が表示される
    await expect(page.locator('[data-testid="day-view"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="day-view"]').first()).toContainText('予定はありません', { timeout: 5000 });
  });
  test('スワイプで日付が切り替わること（右へ2回、左へ2回）', async ({ page }) => {
    // 基準日時を設定（3月1日）
    await page.clock.install({ time: new Date('2024-03-01T12:00:00+09:00') });
    await page.reload();

    await expect(page.locator('[data-testid="header-date"]')).toHaveText('03/01 (金)', { timeout: 5000 });
    // スワイプをシミュレートする関数
    const swipe = async (direction: 'right' | 'left') => {
      const container = page.locator('.swiper').first();
      const box = await container.boundingBox();
      if (!box) throw new Error('Swiper container not found');

      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;
      const distance = box.width * 0.5;
      const endX = direction === 'left' ? startX - distance : startX + distance;

      await page.mouse.move(startX, startY);
      await page.mouse.down();

      // 画面内にカクつき検知用プロセス（rAFループ）を仕込み、スワイプ中の translate を毎フレーム記録する
      await page.evaluate(() => {
        (window as any).swipeTransforms = [];
        (window as any).stopStutterTracker = false;
        const wrapper = document.querySelector('.swiper-wrapper') as HTMLElement;
        const loop = () => {
          if ((window as any).stopStutterTracker) return;
          if (wrapper) {
            (window as any).swipeTransforms.push(wrapper.style.transform);
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      });

      // スワイプ動作（stepsを指定してブラウザプロセス側で滑らかに連続移動させる）
      await page.mouse.move(endX, startY, { steps: 5 });
      await page.mouse.up();

      // アニメーション完了待ち
      // この500msの間に、スライドの慣性移動とReactの再レンダリング処理が並行して走る
      await page.waitForTimeout(500);

      // トラッカーを停止し、記録された transform の配列を取得する
      const transforms = await page.evaluate(() => {
        (window as any).stopStutterTracker = true;
        return (window as any).swipeTransforms as string[];
      });

      // 取得した transforms をパースして X 座標の配列にする
      const getX = (t: string) => {
        if (!t) return 0;
        const match = t.match(/translate3d\(([-.\d]+)px/);
        return match ? parseFloat(match[1]) : 0;
      };

      const xValues = transforms.map(getX);

      // 実際に移動している期間で、値が変化しているフレームがいくつあるか数える
      let uniqueMoves = 0;
      let lastVal = xValues[0];
      for (const val of xValues) {
        if (Math.abs(val - lastVal) > 0.1) {
          // わずかな誤差は無視
          uniqueMoves++;
          lastVal = val;
        }
      }

      console.log(`[${direction}] Total tracked frames: ${xValues.length}, Unique move frames: ${uniqueMoves}`);
      // console.log(xValues.join(', '));

      // 滑らかにスワイプしたなら少なくとも数フレーム以上の描画の更新があるべき
      // もし uniqueMoves が極端に少ない（0〜2回など）場合、メインスレッドがブロックされてカクついている証拠
      if (uniqueMoves < 3) {
        throw new Error(
          `[カクつき検知] スワイプ中に画面がフリーズしました。描画フレーム更新回数: ${uniqueMoves}回 / 合計検知フレーム: ${xValues.length}回`,
        );
      }
    };

    // 右に2回（過去へ）、左に2回（未来へ）スワイプする

    // --- 右方向（左から右へドラッグ、過去に戻る） ---
    await swipe('right');
    await expect(page.locator('[data-testid="header-date"]')).toHaveText('02/29 (木)', { timeout: 5000 }); // うるう年

    await swipe('right');
    await expect(page.locator('[data-testid="header-date"]')).toHaveText('02/28 (水)', { timeout: 5000 });

    // --- 左方向（右から左へドラッグ、未来に進む） ---
    await swipe('left');
    await expect(page.locator('[data-testid="header-date"]')).toHaveText('02/29 (木)', { timeout: 5000 });

    await swipe('left');
    await expect(page.locator('[data-testid="header-date"]')).toHaveText('03/01 (金)', { timeout: 5000 });
  });
});
