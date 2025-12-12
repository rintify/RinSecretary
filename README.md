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

