import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // ユーザーを取得（最初のユーザーを使用）
    const user = await prisma.user.findFirst();
    if (!user) {
        console.error('ユーザーが見つかりません。先にユーザーを作成してください。');
        return;
    }

    console.log(`ユーザー: ${user.email || user.id}`);

    const now = new Date();
    
    // カード1: プロジェクトの進捗報告
    const card1RangeEnd = new Date(now);
    card1RangeEnd.setHours(18, 30, 0, 0);
    const card1RangeStart = new Date(card1RangeEnd);
    card1RangeStart.setDate(card1RangeStart.getDate() - 1);
    
    await prisma.mailSummary.create({
        data: {
            userId: user.id,
            title: 'プロジェクトAの進捗報告',
            summary: '田中さんから今週のプロジェクトAの進捗報告がありました。開発は順調で、来週にはβ版のリリースが可能とのことです。UIの改善案についてもフィードバックを求められています。',
            senders: JSON.stringify([
                { name: '田中太郎', email: 'tanaka@example.com' },
                { name: '佐藤花子', email: 'sato@example.com' }
            ]),
            relatedLinks: JSON.stringify([
                { text: '[進捗] プロジェクトA 第3週', id: '18d4f2a3b1c5e6d7' },
                { text: 'Re: UI改善案について', id: '18d4f2a3b1c5e6d8' }
            ]),
            latestMailReceivedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2時間前
            targetRangeStart: card1RangeStart,
            targetRangeEnd: card1RangeEnd,
            status: 'GENERATED'
        }
    });

    // カード2: 請求書の通知
    const card2RangeEnd = new Date(card1RangeEnd);
    card2RangeEnd.setDate(card2RangeEnd.getDate() - 1);
    const card2RangeStart = new Date(card2RangeEnd);
    card2RangeStart.setDate(card2RangeStart.getDate() - 1);
    
    await prisma.mailSummary.create({
        data: {
            userId: user.id,
            title: '12月分の各種請求書',
            summary: 'AWS、Google Cloud、GitHubなど複数のサービスから12月分の請求書が届いています。合計金額は約15万円です。支払い期限は今月末までとなっています。',
            senders: JSON.stringify([
                { name: 'AWS Billing', email: 'billing@aws.amazon.com' },
                { name: 'Google Cloud', email: 'billing@google.com' },
                { name: 'GitHub', email: 'billing@github.com' }
            ]),
            relatedLinks: JSON.stringify([
                { text: 'Your AWS Invoice for December', id: '18d4f2a3b1c5e6d9' },
                { text: 'Google Cloud Platform Invoice', id: '18d4f2a3b1c5e6da' },
                { text: 'GitHub billing statement', id: '18d4f2a3b1c5e6db' }
            ]),
            latestMailReceivedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1日前
            targetRangeStart: card2RangeStart,
            targetRangeEnd: card2RangeEnd,
            status: 'GENERATED'
        }
    });

    // カード3: セミナーの案内
    const card3RangeEnd = new Date(card2RangeEnd);
    card3RangeEnd.setDate(card3RangeEnd.getDate() - 1);
    const card3RangeStart = new Date(card3RangeEnd);
    card3RangeStart.setDate(card3RangeStart.getDate() - 1);
    
    await prisma.mailSummary.create({
        data: {
            userId: user.id,
            title: 'Next.js 15 オンラインセミナーのご案内',
            summary: 'Vercelから来週開催されるNext.js 15の新機能に関するオンラインセミナーの案内が届きました。Server Actionsの最新機能やパフォーマンス改善について解説されるとのことです。無料で参加可能です。',
            senders: JSON.stringify([
                { name: 'Vercel Team', email: 'hello@vercel.com' }
            ]),
            relatedLinks: JSON.stringify([
                { text: 'Next.js 15 Online Workshop - Jan 15', id: '18d4f2a3b1c5e6dc' }
            ]),
            latestMailReceivedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2日前
            targetRangeStart: card3RangeStart,
            targetRangeEnd: card3RangeEnd,
            status: 'GENERATED'
        }
    });

    // カード4: その他のメッセージ
    const card4RangeEnd = new Date(card3RangeEnd);
    card4RangeEnd.setDate(card4RangeEnd.getDate() - 1);
    const card4RangeStart = new Date(card4RangeEnd);
    card4RangeStart.setDate(card4RangeStart.getDate() - 1);
    
    await prisma.mailSummary.create({
        data: {
            userId: user.id,
            title: 'その他のメッセージ',
            summary: 'この期間には、SNSの通知、ニュースレター購読、サービスアップデートのお知らせなど、複数の定型メッセージが届いています。',
            senders: JSON.stringify([
                { name: 'LinkedIn', email: 'notifications@linkedin.com' },
                { name: 'Dev.to Digest', email: 'digest@dev.to' },
                { name: 'npm Weekly', email: 'newsletter@npmjs.com' }
            ]),
            relatedLinks: JSON.stringify([]), // その他カードはリンクなし
            latestMailReceivedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3日前
            targetRangeStart: card4RangeStart,
            targetRangeEnd: card4RangeEnd,
            status: 'GENERATED'
        }
    });

    // カード5: エラーカード
    const card5RangeEnd = new Date(card4RangeEnd);
    card5RangeEnd.setDate(card5RangeEnd.getDate() - 1);
    const card5RangeStart = new Date(card5RangeEnd);
    card5RangeStart.setDate(card5RangeStart.getDate() - 1);
    
    await prisma.mailSummary.create({
        data: {
            userId: user.id,
            title: 'メール取得エラー',
            summary: 'メールの取得中にエラーが発生しました: Network timeout - Gmail APIへの接続がタイムアウトしました。',
            status: 'FAILED',
            error: 'Network timeout - Gmail API connection timeout after 30s',
            latestMailReceivedAt: card5RangeEnd,
            targetRangeStart: card5RangeStart,
            targetRangeEnd: card5RangeEnd
        }
    });

    // カード6: クライアントからの重要な連絡
    const card6RangeEnd = new Date(now);
    card6RangeEnd.setHours(18, 30, 0, 0);
    card6RangeEnd.setDate(card6RangeEnd.getDate() - 5);
    const card6RangeStart = new Date(card6RangeEnd);
    card6RangeStart.setDate(card6RangeStart.getDate() - 1);
    
    await prisma.mailSummary.create({
        data: {
            userId: user.id,
            title: 'クライアントB社からの緊急要件変更',
            summary: 'B社の山田様から、現在進行中のプロジェクトについて仕様変更の依頼がありました。ログイン機能にSNS認証を追加してほしいとのことです。納期への影響について確認が必要です。',
            senders: JSON.stringify([
                { name: '山田一郎', email: 'yamada@clientb.co.jp' }
            ]),
            relatedLinks: JSON.stringify([
                { text: '[至急] プロジェクト仕様変更のお願い', id: '18d4f2a3b1c5e6dd' },
                { text: 'Re: SNS認証機能について', id: '18d4f2a3b1c5e6de' }
            ]),
            latestMailReceivedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5日前
            targetRangeStart: card6RangeStart,
            targetRangeEnd: card6RangeEnd,
            status: 'GENERATED'
        }
    });

    console.log('✅ ダミーカードを6件作成しました！');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
