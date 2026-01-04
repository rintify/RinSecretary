---
description: UI/UXに関する一般的な設計ルール
---

## ガイドライン

- **alert() ではなく Toast/Snackbar を使用する**
  - 通知やフィードバック（成功メッセージ、致命的でないエラーなど）には、ユーザーの操作を妨げる `alert()` ダイアログを避ける。
  - 代わりに、`non-intrusive` な Toast または Snackbar コンポーネントを使用すること。
