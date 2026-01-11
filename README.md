# RinSecretary

個人用スケジュール管理アプリ（PWA対応）

## 機能

- 📅 イベント・タスク・アラームの管理
- 🔄 定期タスクの自動生成
- 📱 PWA対応（ホーム画面に追加可能）
- 🔔 Discord通知

---

## デプロイ手順

### 1. GitHub Secretsの設定

リポジトリの **Settings** → **Secrets and variables** → **Actions** で以下のSecretsを設定：

| Secret名 | 説明 |
|----------|------|
| `VPS_HOST` | VPSのIPアドレスまたはホスト名 |
| `VPS_USER` | SSH接続ユーザー名 |
| `VPS_SSH_KEY` | SSH秘密鍵（PEM形式） |
| `VPS_PORT` | SSHポート番号（通常は22） |
| `NEXTAUTH_URL` | アプリのURL（例: `https://example.com`） |
| `NEXTAUTH_SECRET` | NextAuth用のシークレットキー（`openssl rand -base64 32`で生成） |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアントID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット |
| `ADMIN_DISCORD_WEBHOOK` | 管理者用Discord Webhook URL（DBバックアップ送信先） |

### 2. VPSの準備

VPSに以下がインストールされていること：
- Docker
- Docker Compose

### 3. デプロイ実行

`main`ブランチにpushすると自動デプロイが実行されます。

デプロイ時の流れ：
1. Dockerイメージをビルド・pushする(GitHub Container Registry)
2. VPSにSSH接続
3. リポジトリをクローン/更新
4. **既存コンテナがあればDBバックアップをDiscordに送信**
5. 新しいイメージをpull
6. docker compose up でコンテナを起動

---

## 運用・ログ確認方法 (VPS)

デプロイ後のVPS上でのログ確認や、定期実行タスクの監視方法です。

### 1. 利用可能なサービス (Service Name)

`docker compose` コマンドの末尾にサービス名（`web` や `caddy`）を指定することで、特定の対象に絞って操作できます。

| サービス名 | 役割 | 内容 |
|:---|:---|:---|
| `web` | アプリケーション本体 | Next.js サーバー、Prisma (DB)、スケジューラ |
| `caddy` | リバースプロキシ | SSL証明書 (HTTPS) の自動取得、ドメイン管理 |

### 2. ログの確認方法

```bash
# アプリディレクトリに移動
cd ~/rin-secretary

# 全てのサービス（web + caddy）のログをリアルタイム表示
docker compose -f deploy/docker-compose.yml --env-file .env logs -f

# サービスを絞ってログを表示
docker compose -f deploy/docker-compose.yml --env-file .env logs -f web
docker compose -f deploy/docker-compose.yml --env-file .env logs -f caddy
```

- **Next.js & スケジューラ (`web`)**: `Starting Next.js Server...` や `Starting Scheduler...` 以降のログ。APIリクエストや定期タスクの実行状況が表示されます。
- **リバースプロキシ (`caddy`)**: SSL証明書の取得状況や、外部からのアクセスログが表示されます。

### 3. コンテナのステータス確認

コンテナが正常に起動しているか、再起動を繰り返していないかを確認します。

```bash
docker compose -f deploy/docker-compose.yml --env-file .env ps
```

### 4. データベースとファイルの直接確認

SQLite ファイルやアップロードされたファイルは VPS 上の `~/rin-secretary/data` にマウントされています。

```bash
# コンテナ内に入って確認する場合
docker compose -f deploy/docker-compose.yml --env-file .env exec -it web sh
ls -l /data/sqlite.db
```

### 5. デプロイ履歴とバックアップ

- **デプロイ完了通知**: `ADMIN_DISCORD_WEBHOOK` に設定した Discord チャンネルに、デプロイ完了時に GitHub の SHA とともに通知されます。
- **DBバックアップ**: デプロイ直前に、最新 host の `sqlite.db` が Discord に送信されます（GitHub Actions 経由）。

---

## ローカル開発

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev
```

### 環境変数（.env.local）

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
ADMIN_DISCORD_WEBHOOK="your-webhook-url"
```

