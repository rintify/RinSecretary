---
description: ダイアログと通知に関するコーディング規約
---

# ダイアログと通知のルール

## 1. 標準ダイアログの禁止
ブラウザ標準の `alert()` および `confirm()` を使用してはいけません。これらはユーザー体験を損ない、UIのデザインと一貫性がありません。

## 2. 代替手段の使用
通知や確認が必要な場合は、必ず以下のカスタムフックを使用してください。

### 通知 (Toast)
- **使用フック**: `useToast()` (from `@/app/context/ToastContext`)
- **使用例**:
  ```tsx
  const { showToast } = useToast();
  showToast('メッセージ', 'success'); // 'success' | 'error' | 'warning' | 'info'
  ```

### 確認 (Confirmation)
- **使用フック**: `useConfirm()` (from `@/app/context/ConfirmContext`)
- **使用例**:
  - `confirm` 関数は `Promise<boolean>` を返すため、必ず `await` と共に使用してください。
  ```tsx
  const { confirm } = useConfirm();
  if (await confirm('削除しますか？', { severity: 'error', confirmText: '削除' })) {
      // 処理
  }
  ```

## 3. ファイルのインポート
これらのコンテキストは `src/app/layout.tsx` で提供されています。クライアントコンポーネント内であればどこでも利用可能です。
