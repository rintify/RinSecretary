---
trigger: glob
globs: e2e/**/*.ts
---

# E2Eテスト実装ルール

## 基本方針
E2Eテストの実装においては、テストの安定性と実行速度を確保するため、以下のルールを厳守すること。

## 1. 待機処理とタイムアウト (Timeouts)
- 待機処理（`waitFor`, `click` などの待機を含む操作）を行う際は、**必ずタイムアウトを明示的に設定すること**。
- そのタイムアウト時間は、いかなる場合でも **5000ms (5秒) 以下** とすること。
  - テストが5秒以上待つ必要がある場合、それはアプリケーションのパフォーマンスに問題があるか、テストの設計が不適切である可能性が高い。
- **例外**: どうしてもタイムアウトが長時間かかる場合は、その上のコメント「/* */」に300字以上でなぜそのタイムアウトの時間なのか説得力のある根拠のある説明するなら許可する。

```typescript
// ❌ Bad: デフォルトタイムアウト（通常30秒）に依存
await page.locator('...').click();

// ✅ Good: 5秒以下の明示的なタイムアウト
await page.locator('...').click({ timeout: 5000 });
await page.waitForSelector('...', { timeout: 5000 });

// ✅ Exception: 根拠のある長時間のタイムアウト
/*
  【タイムアウト延長の根拠】
  ここに300文字以上の詳細な理由を記述する...
*/
await page.waitForTimeout(10000);
```

## 2. UI要素の取得 (Selectors)
- UI要素を取得する際は、UIの表示テキスト（`text=...`）ではなく、**`data-testid` 属性を使用すること**。
- テスト対象のUIコンポーネントに `data-testid` が設定されていない場合は、**テストコードで無理やり取得しようとせず、実装コード（Reactコンポーネント等）を修正して `data-testid` を追加すること**。

```typescript
// ❌ Bad: 表示テキストに依存
await page.locator('text=保存する').click();

// ✅ Good: 安定した data-testid を使用
await page.locator('[data-testid="save-button"]').click();
```
