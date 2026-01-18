import { Page, Locator, expect } from '@playwright/test';

/**
 * メモ一覧画面の Page Object
 * 
 * UI操作をカプセル化し、テストコードの可読性と保守性を向上させる
 */
export class MemoListPage {
  readonly page: Page;
  
  // Locators
  readonly container: Locator;
  readonly list: Locator;
  readonly deleteButton: Locator;
  readonly emptyState: Locator;
  
  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('[data-testid="memo-list-container"]');
    this.list = page.locator('[data-testid="memo-list"]');
    this.deleteButton = page.locator('[data-testid="memo-delete-button"]');
    this.emptyState = page.locator('[data-testid="memo-list-empty"]');
  }
  
  /**
   * メモ一覧ページに遷移してReady状態になるまで待機
   */
  async goto(): Promise<void> {
    await this.page.goto('/memos');
    await this.waitForReady();
  }
  
  /**
   * ページがReady状態になるまで待機
   */
  async waitForReady(): Promise<void> {
    await this.container.waitFor({ state: 'visible', timeout: 5000 });
    // リストまたは空状態のどちらかが表示されるまで待機
    await Promise.race([
      this.list.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
      this.emptyState.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
    ]);
  }
  
  /**
   * 特定のメモアイテムを取得
   */
  getMemoItem(memoId: string): Locator {
    return this.page.locator(`[data-testid="memo-item-${memoId}"]`);
  }
  
  /**
   * 全メモアイテムを取得
   */
  getAllMemoItems(): Locator {
    return this.page.locator('[data-testid^="memo-item-"]');
  }
  
  /**
   * メモアイテムの isDirty 属性を取得
   */
  async getMemoIsDirty(memoId: string): Promise<boolean> {
    const item = this.getMemoItem(memoId);
    const isDirty = await item.getAttribute('data-is-dirty');
    return isDirty === 'true';
  }
  
  /**
   * 表示されているメモの数を取得
   */
  async getMemoCount(): Promise<number> {
    return await this.getAllMemoItems().count();
  }
  
  /**
   * メモをクリックして詳細画面に遷移
   */
  async openMemo(memoId: string): Promise<void> {
    const item = this.getMemoItem(memoId);
    await item.click();
    // 遷移を待機
    await this.page.waitForURL(`**/memos/${memoId}**`, { timeout: 5000 });
  }
  
  /**
   * 新規メモ作成ページに遷移
   */
  async createNewMemo(): Promise<void> {
    await this.page.goto('/memos/new');
    await this.page.locator('[data-testid="memo-composer"]').waitFor({ state: 'visible', timeout: 5000 });
  }
  
  /**
   * 選択モードでメモを選択して削除
   */
  async selectAndDeleteMemo(memoId: string): Promise<void> {
    // ヘッダーのメニューボタンをクリックしてメニューを開く
    const menuButton = this.page.locator('[data-testid="memo-menu-button"]');
    await menuButton.waitFor({ state: 'visible', timeout: 5000 });
    await menuButton.click({ timeout: 5000 });
    
    // コンテキストメニューから「選択して削除」を選ぶ
    const menuItem = this.page.locator('[data-testid="context-menu-delete"]');
    await menuItem.waitFor({ state: 'visible', timeout: 5000 });
    // メニューアニメーションの安定化を待つ
    await this.page.waitForTimeout(500);
    await menuItem.click({ timeout: 5000 });
    
    // メモのチェックボックスの状態を確認して、未選択ならクリック
    // APIやコンテキストメニューの挙動で既に選択されている場合はスキップする
    const checkboxRow = this.page.locator(`[data-testid="memo-checkbox-${memoId}"]`);
    const checkboxInput = checkboxRow.locator('input[type="checkbox"]');
    
    // チェックボックスが表示されるまで待機（選択モードへの遷移待ち）
    await checkboxRow.waitFor({ state: 'visible', timeout: 5000 });
    
    if (!(await checkboxInput.isChecked())) {
        await checkboxRow.click({ timeout: 5000 });
    }
    
    // 削除ボタンをクリック
    await this.deleteButton.click({ timeout: 5000 });
    
    // 確認ダイアログがあれば確認
    const confirmButton = this.page.locator('[data-testid="confirm-dialog-submit"]').last();
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click({ timeout: 5000 });
    }
  }
  
  /**
   * 同期完了を待機（IndexedDB の isDirty フラグを監視）
   * @param memoId 特定のメモIDを指定した場合はそのメモの同期完了を待機
   */
  async waitForSyncComplete(memoId?: string): Promise<void> {
    const startTime = Date.now();
    const timeout = 5000;
    
    while (Date.now() - startTime < timeout) {
      const isSynced = await this.page.evaluate(async (id) => {
        return new Promise<boolean>((resolve, reject) => {
          const request = indexedDB.open('RinSecretaryDB');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('memos')) {
              resolve(true); // DBがなければ同期済みとみなす
              return;
            }
            const tx = db.transaction('memos', 'readonly');
            const store = tx.objectStore('memos');
            
            if (id) {
              // 特定のメモの同期状態を確認
              const getReq = store.get(id);
              getReq.onsuccess = () => {
                const memo = getReq.result;
                // メモが存在しないか、isDirty が false なら同期済み
                resolve(!memo || memo.isDirty === false);
              };
              getReq.onerror = () => reject(getReq.error);
            } else {
              // 全メモの同期状態を確認
              const getAll = store.getAll();
              getAll.onsuccess = () => {
                const memos = getAll.result || [];
                // すべてのメモが isDirty: false なら同期済み
                const allSynced = memos.every((m: any) => m.isDirty === false || m.isDeleted === true);
                resolve(allSynced);
              };
              getAll.onerror = () => reject(getAll.error);
            }
          };
        });
      }, memoId);
      
      if (isSynced) {
        return;
      }
      
      // 500ms 待機してから再チェック
      await this.page.waitForTimeout(500);
    }
    
    // タイムアウト時はエラーをスローせず、警告のみ
    console.warn(`waitForSyncComplete timed out after ${timeout}ms`);
  }
  
  /**
   * 同期リクエストを監視しながら処理を実行
   */
  async withSyncWatch<T>(action: () => Promise<T>): Promise<T> {
    const syncPromise = this.waitForSyncComplete().catch(() => {});
    const result = await action();
    await syncPromise;
    return result;
  }
}
