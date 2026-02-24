# Rimini (RinSecretary)

ローカルファーストなビジネス・タイムマネジメント・アシスタントアプリケーション。

## 開発・検証コマンド

### 1. テスト (Playwright)

このプロジェクトではPlaywrightを使用したE2Eテストを実施しています。

- **全件実行**:
  ```bash
  npm run test:e2e
  ```
- **特定のテストファイルを実行**:
  ```bash
  npm run test:e2e [ファイルのパス]
  # 例: npm run test:e2e e2e/timezone-mismatch.spec.ts
  ```
- **UIモードでの実行**:
  ブラウザ上でテストの挙動を確認・デバッグできます。
  ```bash
  npx playwright test --ui
  ```
- **レポートの表示**:
  ```bash
  npx playwright show-report
  ```

### 2. コード品質チェック

- **TypeScript 型チェック**:
  ```bash
  npx tsc --noEmit
  ```
- **ESLint 静的解析**:
  ```bash
  npx eslint "src/**/*.{ts,tsx}" --quiet
  ```

### 3. ローカル開発サーバー

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いて確認できます。
