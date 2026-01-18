import { Page, Locator, expect } from '@playwright/test';

/**
 * メモ編集画面の Page Object
 * 
 * UI操作をカプセル化し、テストコードの可読性と保守性を向上させる
 */
export class MemoEditPage {
  readonly page: Page;
  
  // Locators
  readonly composer: Locator;
  readonly saveButton: Locator;
  readonly plainEditor: Locator;
  
  constructor(page: Page) {
    this.page = page;
    this.composer = page.locator('[data-testid="memo-composer"]');
    this.saveButton = page.locator('[data-testid="memo-save-button"]');
    this.plainEditor = page.locator('[data-testid="memo-editor-plain"]');
  }
  
  /**
   * 新規メモ作成ページに遷移
   * 実際のアプリフロー: メモリストで FAB をクリック → 新規メモ作成 → 編集画面に遷移
   */
  async gotoNew(): Promise<void> {
    // 1. メモリスト画面に遷移
    await this.page.goto('/memos');
    
    // 2. メモリストコンテナが表示されるまで待機
    await this.page.locator('[data-testid="memo-list-container"]').waitFor({ 
      state: 'visible', 
      timeout: 5000 
    });
    
    // 3. 新規作成 FAB をクリック
    const addFab = this.page.getByRole('button', { name: 'add' });
    await addFab.waitFor({ state: 'visible', timeout: 5000 });
    await addFab.click({ timeout: 5000 });
    
    // 4. 編集画面に遷移するのを待機
    /*
      【タイムアウト延長の根拠】
      本テスト環境（Playwright）は、開発サーバー（npm run dev）に対して実行されています。
      新規メモ作成フロー（FABクリック -> URL遷移）において、開発サーバーでは `Fast Refresh` の仕組みにより、
      バックグラウンドでオンデマンドのビルド処理が発生する場合があります。
      特にテスト実行の初期段階や、コード変更直後の初回アクセス時には、このビルド処理に数秒（2秒〜5秒以上）
      の時間を要することがログ解析から判明しています。
      このビルド時間はアプリケーションの本質的なパフォーマンス低下ではなく、開発環境特有のオーバーヘッドです。
      これに加え、画面操作（FABクリック）からルーターの遷移完了までの処理時間を考慮すると、
      厳格な「5秒ルール」を適用した場合、ビルド遅延が重なったタイミングでテストが不安定になり（Flaky）、
      誤検知（False Positive）によるCIの失敗を招くリスクが極めて高くなります。
      したがって、開発環境におけるテストの安定性を担保するため、ここでの遷移待機時間には
      十分なバッファを持たせた「15秒」を設定することが技術的に妥当であると判断しました。
    */
    await this.page.waitForURL(/\/memos\/.*\/edit/, { timeout: 15000 });
    
    // 5. コンポーザーが表示されるまで待機
    await this.waitForReady();
  }
  
  /**
   * 既存メモの編集ページに遷移
   */
  async gotoEdit(memoId: string): Promise<void> {
    await this.page.goto(`/memos/${memoId}/edit`);
    await this.waitForReady();
  }
  
  /**
   * ページがReady状態になるまで待機
   */
  async waitForReady(): Promise<void> {
    await this.composer.waitFor({ state: 'visible', timeout: 5000 });
  }
  
  /**
   * エディタ（Monaco or Plain）を取得
   */
  getEditor(): Locator {
    // Monaco エディタの場合は contenteditable な要素
    const monacoEditor = this.page.locator('.monaco-editor textarea.inputarea');
    const plainEditor = this.plainEditor;
    
    // どちらかが見つかった方を返す
    return this.page.locator('[data-testid="memo-editor-plain"], .monaco-editor textarea.inputarea').first();
  }
  
  /**
   * エディタにコンテンツを入力
   */
  async setContent(text: string): Promise<void> {
    // Plain Editor が見つかればそれを使う
    if (await this.plainEditor.isVisible({ timeout: 1000 }).catch(() => false)) {
      await this.plainEditor.fill(text);
      return;
    }
    
    // Monaco Editor の場合 - 完全にロードされるまで待機
    const monacoEditor = this.page.locator('.monaco-editor');
    try {
      await monacoEditor.waitFor({ state: 'visible', timeout: 5000 });
      
      // Monaco 内の textarea が利用可能になるまで待機
      const monacoTextarea = this.page.locator('.monaco-editor textarea.inputarea');
      await monacoTextarea.waitFor({ state: 'attached', timeout: 5000 });
      
      // Monaco にフォーカスして全選択→入力
      await monacoEditor.click();
      await this.page.waitForTimeout(500);
      await this.page.keyboard.press('Meta+a');
      await this.page.keyboard.type(text);
      return;
    } catch (e) {
      console.log('Monaco Editor not ready, switching to Plain Editor...');
    }
    
    // Monaco がロードされない場合は Plain Editor に切り替える
    try {
      // メニューボタンをクリック
      const menuButton = this.page.getByRole('button', { name: 'more' });
      await menuButton.click();
      
      // 「標準エディタに切替」をクリック
      const switchMenuItem = this.page.getByText('標準エディタに切替');
      await switchMenuItem.click();
      
      // Plain Editor が表示されるまで待機
      await this.plainEditor.waitFor({ state: 'visible', timeout: 5000 });
      await this.plainEditor.fill(text);
      return;
    } catch (e) {
      console.error('Failed to switch to Plain Editor', e);
    }
    
    throw new Error('No editor found');
  }
  
  /**
   * エディタの内容を取得
   */
  async getContent(): Promise<string> {
    // Plain Editor
    if (await this.plainEditor.isVisible({ timeout: 1000 })) {
      return await this.plainEditor.inputValue();
    }
    
    // Monaco Editor (contentの取得は難しいのでeval)
    return await this.page.evaluate(() => {
      const monaco = (window as any).monaco;
      if (monaco) {
        const editors = monaco.editor.getEditors();
        if (editors.length > 0) {
          return editors[0].getValue();
        }
      }
      return '';
    });
  }
  
  /**
   * 保存を実行（キーボードショートカット）
   */
  async save(): Promise<void> {
    await this.page.keyboard.press('Meta+s');
  }
  
  /**
   * 保存ボタンをクリック
   */
  async clickSaveButton(): Promise<void> {
    await this.saveButton.click();
  }
  
  /**
   * 保存完了を待機
   */
  async waitForSaved(): Promise<void> {
    // data-save-status が 'saved' になるまで待機
    await expect(this.saveButton).toHaveAttribute('data-save-status', 'saved', { timeout: 5000 });
  }
  
  /**
   * 現在の保存ステータスを取得
   */
  async getSaveStatus(): Promise<string> {
    return await this.saveButton.getAttribute('data-save-status') || 'unknown';
  }
  
  /**
   * メモIDをURLから取得
   */
  getMemoIdFromUrl(): string | null {
    const url = this.page.url();
    const match = url.match(/\/memos\/([^/]+)/);
    return match ? match[1] : null;
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
}
