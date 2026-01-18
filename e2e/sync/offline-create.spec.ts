import { test, expect, getLocalMemo, getLocalMemos, getServerMemo } from '../fixtures/test-setup';
import { MemoListPage } from '../pages/memo-list.page';
import { MemoEditPage } from '../pages/memo-edit.page';

/**
 * オフラインでメモ作成 → オンライン復帰後の同期テスト
 * 
 * Production-Quality:
 * - Page Object Model を使用
 * - 条件ベースの待機（マジックタイムアウトなし）
 * - data-testid による安定したセレクタ
 */
test.describe('オフラインでメモ作成と同期', () => {

  test('オフラインで作成したメモがオンライン復帰後に同期される', async ({ page, memoListPage, memoEditPage, context }) => {
    // 1. メモ一覧を開く
    await memoListPage.goto();
    
    // 2. オフラインに設定
    await context.setOffline(true);
    
    // 3. 新規メモ作成ページへ
    await memoEditPage.gotoNew();
    
    // 4. テスト用コンテンツを入力
    const testContent = `オフラインテスト ${Date.now()}`;
    await memoEditPage.setContent(testContent);
    
    // 5. 保存
    await memoEditPage.save();
    await memoEditPage.waitForSaved();
    
    // 6. メモIDを取得
    const memoId = memoEditPage.getMemoIdFromUrl();
    expect(memoId).toBeTruthy();
    
    // 7. IndexedDB で isDirty: true を確認
    const localMemo = await getLocalMemo(page, memoId!);
    expect(localMemo).not.toBeNull();
    expect(localMemo.isDirty).toBe(true);
    
    // 8. オンラインに戻す
    await context.setOffline(false);
    
    // 9. 同期完了を待機
    await memoEditPage.waitForSyncComplete();
    
    // 10. IndexedDB で isDirty: false を確認
    const syncedMemo = await getLocalMemo(page, memoId!);
    expect(syncedMemo).not.toBeNull();
    expect(syncedMemo.isDirty).toBeFalsy();
  });

  test('オフライン中の複数編集が一度に同期される', async ({ page, memoListPage, memoEditPage, context }) => {
    // 1. オンラインでメモを作成
    await memoEditPage.gotoNew();
    
    const initialContent = `初期コンテンツ ${Date.now()}`;
    await memoEditPage.setContent(initialContent);
    await memoEditPage.save();
    await memoEditPage.waitForSaved();
    
    const memoId = memoEditPage.getMemoIdFromUrl();
    expect(memoId).toBeTruthy();
    
    // 同期を待機
    await memoEditPage.waitForSyncComplete();
    
    // 2. オフラインにする
    await context.setOffline(true);
    
    // 3. 複数回編集
    await memoEditPage.setContent(initialContent + '\n\n編集1');
    await memoEditPage.save();
    await memoEditPage.waitForSaved();
    
    await memoEditPage.setContent(initialContent + '\n\n編集1\n\n編集2');
    await memoEditPage.save();
    await memoEditPage.waitForSaved();
    
    const finalContent = initialContent + '\n\n編集1\n\n編集2\n\n最終編集';
    await memoEditPage.setContent(finalContent);
    await memoEditPage.save();
    await memoEditPage.waitForSaved();
    
    // 4. isDirty: true を確認
    const dirtyMemo = await getLocalMemo(page, memoId!);
    expect(dirtyMemo.isDirty).toBe(true);
    
    // 5. オンラインに戻す
    await context.setOffline(false);
    
    // 6. 同期完了を待機
    await memoEditPage.waitForSyncComplete();
    
    // 7. 最終状態を確認
    const syncedMemo = await getLocalMemo(page, memoId!);
    expect(syncedMemo.isDirty).toBeFalsy();
    expect(syncedMemo.content).toContain('最終編集');
  });
});
