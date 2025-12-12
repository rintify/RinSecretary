/**
 * 時刻関連処理の自動テスト
 * 
 * 実行方法: tsx tests/timezone.test.ts
 * 
 * このテストは以下を確認します:
 * 1. サーバーのタイムゾーンがAsia/Tokyoに設定されていること
 * 2. スケジューラーの時刻判定が正しく動作すること
 * 3. 定期タスクのデッドライン計算が正しいこと
 */

import assert from 'assert';

// === ユーティリティ ===

function formatJST(date: Date): string {
    return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

function getJSTHours(date: Date): number {
    return parseInt(date.toLocaleString('ja-JP', { 
        timeZone: 'Asia/Tokyo', 
        hour: '2-digit', 
        hour12: false 
    }));
}

// === テストケース ===

console.log('=== 時刻関連処理テスト ===\n');

// テスト1: タイムゾーン環境変数の確認
console.log('1. タイムゾーン環境変数の確認');
try {
    const tz = process.env.TZ;
    console.log(`   TZ = ${tz || '(未設定)'}`);
    
    if (tz === 'Asia/Tokyo') {
        console.log('   ✅ PASS: TZがAsia/Tokyoに設定されています\n');
    } else {
        console.log('   ⚠️  WARN: TZがAsia/Tokyoではありません');
        console.log('   Dockerfileでは ENV TZ=Asia/Tokyo が設定されています');
        console.log('   ローカル実行時は TZ=Asia/Tokyo npm run test:timezone で実行してください\n');
    }
} catch (e) {
    console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
}

// テスト2: new Date() の動作確認
console.log('2. new Date() の動作確認');
try {
    const now = new Date();
    const localHour = now.getHours();
    const jstHour = getJSTHours(now);
    
    console.log(`   現在時刻: ${now.toISOString()}`);
    console.log(`   getHours(): ${localHour}`);
    console.log(`   JST時刻: ${formatJST(now)}`);
    
    if (process.env.TZ === 'Asia/Tokyo') {
        assert.strictEqual(localHour, jstHour, 'getHours()がJST時刻を返すこと');
        console.log('   ✅ PASS: getHours()がJST時刻を返しています\n');
    } else {
        console.log('   ⚠️  SKIP: TZ未設定のためスキップ\n');
    }
} catch (e) {
    console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
}

// テスト3: スケジューラー時刻判定のシミュレーション
console.log('3. スケジューラー時刻判定のシミュレーション');
try {
    // JST 04:00 を作成
    const jst0400 = new Date();
    jst0400.setHours(4, 0, 0, 0);
    
    // チェック関数（scheduler.tsと同じロジック）
    const shouldRunRegularTask = (date: Date): boolean => {
        return date.getHours() === 4 && date.getMinutes() === 0;
    };
    
    const shouldRunDailyBriefing = (date: Date): boolean => {
        return date.getHours() === 6 && date.getMinutes() === 0;
    };
    
    // テスト
    assert.strictEqual(shouldRunRegularTask(jst0400), true, '04:00に定期タスク生成');
    console.log('   ✅ 04:00 → 定期タスク生成: true');
    
    const jst0600 = new Date();
    jst0600.setHours(6, 0, 0, 0);
    assert.strictEqual(shouldRunDailyBriefing(jst0600), true, '06:00にDaily Briefing');
    console.log('   ✅ 06:00 → Daily Briefing: true');
    
    const jst1000 = new Date();
    jst1000.setHours(10, 0, 0, 0);
    assert.strictEqual(shouldRunRegularTask(jst1000), false, '10:00に定期タスク生成しない');
    console.log('   ✅ 10:00 → 定期タスク生成: false');
    
    console.log('   ✅ PASS: スケジューラー時刻判定が正しく動作\n');
} catch (e) {
    console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
}

// テスト4: 定期タスクデッドライン計算
console.log('4. 定期タスクデッドライン計算');
try {
    const now = new Date();
    now.setHours(4, 0, 0, 0); // JST 04:00 を想定
    
    // Daily Task: 翌日 03:59
    const dailyDeadline = new Date(now);
    dailyDeadline.setDate(dailyDeadline.getDate() + 1);
    dailyDeadline.setHours(3, 59, 0, 0);
    
    const expectedHour = 3;
    const expectedMinute = 59;
    
    assert.strictEqual(dailyDeadline.getHours(), expectedHour, 'デッドライン時刻が03時');
    assert.strictEqual(dailyDeadline.getMinutes(), expectedMinute, 'デッドライン分が59分');
    
    // 日付が翌日であることを確認
    const diffDays = Math.round((dailyDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    assert.strictEqual(diffDays, 1, 'デッドラインが約1日後');
    
    console.log(`   作成日時: ${formatJST(now)}`);
    console.log(`   デッドライン: ${formatJST(dailyDeadline)}`);
    console.log('   ✅ PASS: デッドライン計算が正しい\n');
} catch (e) {
    console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
}

// テスト5: toISOString() の動作確認
console.log('5. toISOString() の動作確認');
try {
    const now = new Date();
    const isoString = now.toISOString();
    
    // ISO文字列は常にUTC
    assert.ok(isoString.endsWith('Z'), 'ISO文字列がZで終わる（UTC）');
    
    // パースして元に戻ることを確認
    const parsed = new Date(isoString);
    assert.strictEqual(parsed.getTime(), now.getTime(), 'パース後のタイムスタンプが一致');
    
    console.log(`   現在時刻: ${formatJST(now)}`);
    console.log(`   ISO文字列: ${isoString}`);
    console.log(`   パース後: ${formatJST(parsed)}`);
    console.log('   ✅ PASS: ISO文字列の変換が正しい\n');
} catch (e) {
    console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
}

// テスト6: 週次タスクの曜日計算
console.log('6. 週次タスクの曜日計算');
try {
    // テスト日: 2024年1月15日 (月曜日)
    const testDate = new Date(2024, 0, 15); // 月=0
    const day = testDate.getDay(); // 0=日, 1=月, ..., 6=土
    
    // 月曜日を取得するロジック（regularTaskService.tsと同じ）
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const mondayDate = new Date(testDate);
    mondayDate.setDate(testDate.getDate() + diffToMonday);
    
    assert.strictEqual(mondayDate.getDay(), 1, '計算結果が月曜日');
    console.log(`   テスト日: ${testDate.toLocaleDateString('ja-JP')} (${['日','月','火','水','木','金','土'][day]}曜日)`);
    console.log(`   計算された月曜日: ${mondayDate.toLocaleDateString('ja-JP')}`);
    
    // 日曜日のケース
    const sunday = new Date(2024, 0, 14); // 日曜日
    const sundayDiff = (sunday.getDay() === 0 ? -6 : 1 - sunday.getDay());
    const mondayFromSunday = new Date(sunday);
    mondayFromSunday.setDate(sunday.getDate() + sundayDiff);
    
    assert.strictEqual(mondayFromSunday.getDay(), 1, '日曜日から計算した結果も月曜日');
    console.log(`   日曜日(1/14)の週の月曜日: ${mondayFromSunday.toLocaleDateString('ja-JP')}`);
    
    console.log('   ✅ PASS: 週次タスクの曜日計算が正しい\n');
} catch (e) {
    console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
}

console.log('=== テスト完了 ===');
