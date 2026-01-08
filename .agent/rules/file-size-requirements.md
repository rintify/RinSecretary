---
trigger: always_on
description: ファイルサイズおよびサーバー容量制限に関する実装要件
---

# ファイルサイズ要件

## 1. サーバー容量制限 (Global Storage Limit)

### 定義
サーバーが保持する全ファイルの合計容量上限。
- **制限値**: 3GB
- **管理場所**: src/lib/storage.ts 内の SERVER_MAX_STORAGE_BYTES
- **対象**:
  - Attachment テーブル (メモ機能の添付ファイル)
  - SharedFile テーブル (一時共有ファイル)
  - 今後追加される全ての永続化ファイル
  - SystemSetting テーブルの storage_usage_bytes にキャッシュされる

### 実装ルール
- **共通定数の利用**: 数値を直接コードに書かず、必ず src/lib/storage.ts をインポートして使用すること。
- **合計チェック**: アップロード処理の実装時は、必ず src/lib/storage.ts の getCurrentStorageUsage() を使用して現在の使用量を確認し、制限値を超えないことを確認すること。

## 2. 単一ファイルサイズ (Single File Size)

### 定義
- **制限なし**: アプリケーションロジックとして、単一ファイルのサイズ制限は設けない。
- 上記の「サーバー容量制限」の範囲内であれば、どのようなサイズのファイルも許容する。

### 禁止事項
- file.size > 500MB のような、単一ファイルに対する独自のサイズ制限コードを記述すること。

## 3. ストレージ容量管理 (New Requirement)
ファイルのアップロードや削除を行う処理を実装する場合は、データの整合性を保つため以下のルールを厳守すること。

- **更新処理**: src/lib/storage.ts の updateStorageUsage(deltaBytes) を使用して、システム設定の容量使用量を即座に更新すること。
  - **アップロード時**: updateStorageUsage(file.size) (プラス)
  - **削除時**: updateStorageUsage(-file.size) (マイナス)

## 4. 現在の実装状況 (Reference)
以下のファイルは本要件に準拠済みである。
- src/app/actions/shared-file.ts
- src/app/memos/actions.ts
- src/app/api/uploads/route.ts