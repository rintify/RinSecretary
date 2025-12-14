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
| `LETSENCRYPT_EMAIL` | Let's Encrypt証明書通知用メールアドレス |

### 2. DNSの設定

`NEXTAUTH_URL` で指定したドメイン（またはサブドメイン）がVPSのIPを指すようにDNS Aレコードを設定してください。

**例**: `https://secretary.example.com` を使う場合

| Type | Name | Value |
|------|------|-------|
| A | secretary | `<VPSのIPアドレス>` |

> **Note**: DNS反映には数分〜数時間かかる場合があります。`dig +short secretary.example.com` で確認できます。

### 3. VPSの準備

VPSに以下がインストールされていること：
- Docker
- Docker Compose

### 4. デプロイ実行

`main`ブランチにpushすると自動デプロイが実行されます。

デプロイ時の流れ：
1. Dockerイメージをビルド・pushする(GitHub Container Registry)
2. VPSにSSH接続
3. リポジトリをクローン/更新
4. **既存コンテナがあればDBバックアップをDiscordに送信**
5. 新しいイメージをpull
6. docker compose up でコンテナを起動

---

### 他のプロジェクトを追加する方法

このVPS上のリバースプロキシ（Traefik）は、他のプロジェクトも自動で認識してHTTPS化できます。

### 他のプロジェクトを追加する方法

新しいプロジェクトをこのVPSの自動デプロイ環境に追加する手順：

1.  **`deploy` ディレクトリをコピー**
    このリポジトリの `deploy` ディレクトリを丸ごとコピーする。

2.  **`deploy.yml` の設定**
    GitHub Actionsのステップで `bash deploy/ensure-proxy.sh` を呼び出すようにする。

3.  **Secretsの設定**
    新しいリポジトリに以下を設定してPushする。
    *   `NEXTAUTH_URL` (ドメイン決定用)
    *   `LETSENCRYPT_EMAIL`
    *   `VPS_*` (接続情報)



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

