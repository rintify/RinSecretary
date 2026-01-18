import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 設定ファイル
 * 
 * E2E テスト用の設定を定義する。
 * 同期テストはローカル開発サーバーを使用して実行される。
 */
export default defineConfig({
  // テストファイルの場所
  testDir: './e2e',
  
  // テストの並列実行（同期テストは順序が重要なため無効化）
  fullyParallel: false,
  
  // CI 環境では再試行しない
  retries: process.env.CI ? 2 : 0,
  
  // 並列ワーカー数（同期テストではシングルワーカー推奨）
  workers: 1,
  
  // レポーター設定
  reporter: 'html',
  
  // 共通設定
  use: {
    // ベース URL (IPv4指定で安定化) - テスト専用ポート 3001
    baseURL: 'http://127.0.0.1:3001',
    
    // テスト失敗時にトレースを記録
    trace: 'on-first-retry',
    
    // スクリーンショット設定
    screenshot: 'only-on-failure',
    
    // ビデオ記録
    video: 'on-first-retry',
  },

  // プロジェクト設定（ブラウザ別）
  // isMobile: true で DeviceContext の isComputer を false にし、Plain Editor を使用させる
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Monaco Editor がテスト環境で安定しないため、モバイルモードを有効にして
        // Plain Editor を強制使用する
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  // 開発サーバーの自動起動 (Production Build)
  webServer: {
    // CI環境またはローカルでの安定実行のため、プロダクションビルドを使用
    // テスト専用DB (test.db) のスキーマ同期を行ってから起動
    command: 'npx prisma db push --accept-data-loss && npm run build && npm run start -- -H 127.0.0.1 -p 3001',
    url: 'http://127.0.0.1:3001',
    // 既存のサーバー(port 3000)を誤って使わないよう、再利用を無効化
    reuseExistingServer: false,
    timeout: 300 * 1000, // ビルド時間を考慮して5分に延長
    // Auth.js の UntrustedHost エラー回避 (Production on Localhost)
    env: {
      AUTH_TRUST_HOST: 'true',
      NEXTAUTH_URL: 'http://127.0.0.1:3001',
      NEXTAUTH_SECRET: 'test-secret-for-e2e',
      E2E_TESTING: 'true',
      // テストデータの分離
      DATABASE_URL: 'file:./test.db',
      UPLOADS_DIR: 'data/uploads-test',
      PORT: '3001'
    },
  },
  
  // テストタイムアウト（同期テストは時間がかかる可能性があるため長めに）
  timeout: 120 * 1000,
  
  // expect のタイムアウト
  expect: {
    timeout: 30 * 1000,
  },
});
