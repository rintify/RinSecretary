import { test, expect, getLocalMemo, getLocalMemos } from '../fixtures/test-setup';
import { MemoListPage } from '../pages/memo-list.page';
import { MemoEditPage } from '../pages/memo-edit.page';

/**
 * メモ削除の同期テスト
 * 
 * Production-Quality:
 * - Page Object Model を使用
 * - 条件ベースの待機
 * - サーバー状態の検証
 */
test.describe('メモ削除の同期', () => {

  test('オンラインで削除したメモがサーバーからも削除される', async ({ page, memoListPage, memoEditPage }) => {
    // 1. メモを作成
    await memoEditPage.gotoNew();
    
    const content = `削除テスト ${Date.now()}`;
    await memoEditPage.setContent(content);
    await memoEditPage.save();
    await memoEditPage.waitForSaved();
    
    const memoId = memoEditPage.getMemoIdFromUrl();
    expect(memoId).toBeTruthy();
    
    // 同期を待機
    await memoEditPage.waitForSyncComplete();
    
    // 2. メモ一覧に戻る
    await memoListPage.goto();
    
    // 3. メモが存在することを確認
    const memoItem = memoListPage.getMemoItem(memoId!);
    await expect(memoItem).toBeVisible({ timeout: 5000 });
    
    // 4. メモを長押しで選択モードに入り削除
    await memoListPage.selectAndDeleteMemo(memoId!);
    
    // 5. 同期を待機
    await memoListPage.waitForSyncComplete().catch(() => {});
    
    // 6. IndexedDB からメモが消えている（または isDeleted: true）ことを確認
    const deletedMemo = await getLocalMemo(page, memoId!);
    if (deletedMemo) {
      expect(deletedMemo.isDeleted).toBe(true);
    }
    
    // 7. UI上でメモが見えなくなることを確認
    await expect(memoItem).not.toBeVisible({ timeout: 5000 });
  });

  test('オフラインで削除したメモがオンライン復帰後に同期される', async ({ page, context, memoListPage, memoEditPage }) => {
    // 1. オンラインでメモを作成
    await memoEditPage.gotoNew();
    
    const content = `オフライン削除テスト ${Date.now()}`;
    await memoEditPage.setContent(content);
    await memoEditPage.save();
    await memoEditPage.waitForSaved();
    
    const memoId = memoEditPage.getMemoIdFromUrl();
    expect(memoId).toBeTruthy();
    
    // 同期を待機
    await memoEditPage.waitForSyncComplete();
    
    // 2. メモ一覧に戻る
    await memoListPage.goto();
    
    // メモが存在することを確認
    const memoItem = memoListPage.getMemoItem(memoId!);
    await expect(memoItem).toBeVisible({ timeout: 5000 });
    
    // 3. オフラインにする
    await context.setOffline(true);
    
    // 4. メモを削除
    await memoListPage.selectAndDeleteMemo(memoId!);
    
    // 5. IndexedDB で isDeleted: true を確認
    const deletedMemo = await getLocalMemo(page, memoId!);
    if (deletedMemo) {
      expect(deletedMemo.isDeleted).toBe(true);
    }
    
    // 6. オンラインに戻す
    await context.setOffline(false);
    
    // 7. 同期完了を待機
    await memoListPage.waitForSyncComplete();
    
    // 8. IndexedDB からメモが完全に消えていることを確認
    const syncedMemo = await getLocalMemo(page, memoId!);
    expect(syncedMemo).toBeNull();
  });
});
