---
trigger: glob
description: データベース（Prisma）の変更を安全に本番へデプロイするためのルール
globs: *.prisma
---

## 概要
`prisma/schema.prisma` を変更した際、本番環境で「テーブルが存在しない」というエラーを防ぐための手順です。

## 手順

1. **スキーマ変更の検知**
   - `prisma/schema.prisma` を編集した場合は、必ず以下の手順を実行する。

2. **マイグレーションファイルの生成**
   - 以下のコマンドを実行して、変更内容を反映する手順書（マイグレーションファイル）を作成する。
   - `npx prisma migrate dev --name <変更内容の短い説明>`

3. **データの保護（重要）**
   - もし上記コマンドで「データベースをリセットしてデータを消去してもよいか？」と聞かれ、ローカルに保持したいデータがある場合は、以下のように一時的なデータベースを使用してファイルだけを生成する。
   ```bash
   export DATABASE_URL="file:./temp.db" && npx prisma migrate dev --name <name> && rm temp.db*
   ```

4. **デプロイの準備**
   - 生成された `prisma/migrations` フォルダ内のファイルを Git に含めてコミットする。
   - 推奨コミットメッセージ: `fix: add migration for <model_name>`