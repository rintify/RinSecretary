import { test as base, Page, BrowserContext } from '@playwright/test';
import { MemoListPage } from '../pages/memo-list.page';
import { MemoEditPage } from '../pages/memo-edit.page';

/**
 * テスト用の拡張フィクスチャ
 * 
 * - cleanContext: 各テストで独立したブラウザコンテキストを提供
 * - memoListPage: メモ一覧の Page Object
 * - memoEditPage: メモ編集の Page Object
 */
export const test = base.extend<{
  memoListPage: MemoListPage;
  memoEditPage: MemoEditPage;
}>({
  // 各テストで新しいコンテキストを作成し、開発認証をセットアップ
  page: async ({ browser }, use) => {
    const context = await browser.newContext();
    
    // 開発モード認証スキップ用 Cookie を設定
    await context.addCookies([
      {
        name: 'dev-auth-skip',
        value: 'true',
        domain: '127.0.0.1',
        path: '/',
        secure: false,
      },
    ]);
    
    const page = await context.newPage();

    // コンソールログをターミナルに出力（デバッグ用）
    page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
    page.on('pageerror', err => console.error(`BROWSER ERROR: ${err.message}`));

    // クリーンアップ: 既存の Service Worker とキャッシュを削除
    // これはコンテキスト分離だけでは消えない永続ストレージ（Cache API等）対策
    
    /*
      【タイムアウト延長の根拠】
      開発環境（next dev）において、最初のページロード（page.goto('/')）は
      コンパイルやバンドル処理が発生するため、Fast Refresh のオーバーヘッドにより
      5秒以内に完了しない場合が頻繁にある。
      テストの前提条件を確実に整えるため、例外的に15秒のタイムアウトを設定する。
    */
    await page.goto('/', { timeout: 15000 }); // オリジンを確保
    await page.evaluate(async () => {
      // SW 解除
      if (navigator.serviceWorker) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      // Cache Storage 全消去
      if (caches) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }
    });

    // アプリをリロードしてクリーンな状態で開始
    // goto で /memos に遷移
    await page.goto('/memos');
    
    // UI 要素が表示されるまで待機
    // コンテナが表示されればアプリは正常に起動している
    // コンテナだけでなく、リストまたは空状態が表示されるまで待機して、
    // 初期ロードとFast Refreshが落ち着くのを待つ
    const list = page.locator('[data-testid="memo-list"]');
    const empty = page.locator('[data-testid="memo-list-empty"]');
    
    await Promise.race([
      list.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
      empty.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
      page.locator('[data-testid="memo-list-container"]').waitFor({ state: 'visible', timeout: 5000 })
    ]);
    
    // IndexedDB はブラウザコンテキストごとに分離されるため、
    // context = await browser.newContext() で十分にクリーンな環境が得られる。
    // 手動での deleteDatabase は不要であり、ロック競合の原因になるため削除。

    await use(page);
    
    await context.close();
  },
  
  // ページオブジェクトの提供
  memoListPage: async ({ page }, use) => {
    await use(new MemoListPage(page));
  },
  
  memoEditPage: async ({ page }, use) => {
    await use(new MemoEditPage(page));
  },
});

export { expect } from '@playwright/test';

/**
 * IndexedDB からメモデータを取得するヘルパー
 */
export async function getLocalMemos(page: Page): Promise<any[]> {
  return await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('RinSecretaryDB');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('memos')) {
          resolve([]);
          return;
        }
        const tx = db.transaction('memos', 'readonly');
        const store = tx.objectStore('memos');
        const getAll = store.getAll();
        getAll.onsuccess = () => resolve(getAll.result || []);
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });
}

/**
 * IndexedDB から特定のメモを取得
 */
export async function getLocalMemo(page: Page, memoId: string): Promise<any | null> {
  return await page.evaluate(async (id) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('RinSecretaryDB');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('memos')) {
          resolve(null);
          return;
        }
        const tx = db.transaction('memos', 'readonly');
        const store = tx.objectStore('memos');
        const get = store.get(id);
        get.onsuccess = () => resolve(get.result || null);
        get.onerror = () => reject(get.error);
      };
    });
  }, memoId);
}

/**
 * IndexedDB から添付ファイルデータを取得
 */
export async function getLocalAttachments(page: Page, memoId?: string): Promise<any[]> {
  return await page.evaluate(async (filterMemoId) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('RinSecretaryDB');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('attachments')) {
          resolve([]);
          return;
        }
        const tx = db.transaction('attachments', 'readonly');
        const store = tx.objectStore('attachments');
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          let results = getAll.result || [];
          if (filterMemoId) {
            results = results.filter((a: any) => a.memoId === filterMemoId);
          }
          // Blob は serialize できないので hasBlob フラグに変換
          resolve(results.map((a: any) => ({
            ...a,
            hasBlob: !!a.blob,
            blob: undefined,
          })));
        };
        getAll.onerror = () => reject(getAll.error);
      };
    });
  }, memoId);
}

/**
 * ログイン済みの新しいブラウザコンテキストを作成
 */
export async function createLoggedInContext(browser: any): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  
  await context.addCookies([
    {
      name: 'dev-auth-skip',
      value: 'true',
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
  
  const page = await context.newPage();
  return { context, page };
}

/**
 * サーバーAPIを直接呼び出してメモを取得
 */
export async function getServerMemo(page: Page, memoId: string): Promise<any | null> {
  const response = await page.request.get(`/api/memos/${memoId}`);
  if (response.ok()) {
    return await response.json();
  }
  return null;
}
