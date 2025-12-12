/**
 * フロントエンド-バックエンド時刻整合性テスト
 * 
 * 実行方法: tsx tests/time-e2e.test.ts
 * 
 * このテストは以下を確認します:
 * 1. フロントエンドで入力した時刻がバックエンドに正しく保存されるか
 * 2. バックエンドから取得した時刻がフロントエンドで正しく表示されるか
 * 3. タイムゾーン変換でズレが発生しないか
 */

import assert from 'assert';

// === 型定義 ===

interface DisplayResult {
    date: string;
    time: string;
    full: string;
}

// === ユーティリティ関数 ===

/**
 * フロントエンドのフォーマット関数をシミュレート
 * (EventForm.tsx, TaskForm.tsx 等で使用されている formatLocal)
 */
function formatLocal(date: Date): string {
    const pad = (n: number): string => n < 10 ? '0' + n : `${n}`;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * バックエンドでの変換をシミュレート
 * (API route での new Date(input) の動作)
 */
function backendConvert(isoLocalString: string): Date {
    return new Date(isoLocalString);
}

/**
 * データベースに保存される形式をシミュレート
 * (PrismaはDateオブジェクトをUTCで保存)
 */
function databaseStore(date: Date): string {
    return date.toISOString();
}

/**
 * データベースから取得した値をシミュレート
 * (JSON.stringify/parseでシリアライズされる)
 */
function databaseRetrieve(isoString: string): Date {
    return new Date(isoString);
}

/**
 * フロントエンドでの表示をシミュレート
 * (date-fns format や toLocaleString)
 */
function frontendDisplay(date: Date): DisplayResult {
    return {
        date: `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`,
        time: `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`,
        full: date.toLocaleString('ja-JP')
    };
}

// === テストケース ===

console.log('=== フロントエンド-バックエンド時刻整合性テスト ===\n');

// テスト1: 基本的な時刻の往復テスト
console.log('1. 基本的な時刻の往復テスト');
try {
    // ユーザーがフロントエンドで「2025年12月15日 14:30」を入力
    const userInputDate = new Date(2025, 11, 15, 14, 30, 0, 0); // month is 0-indexed
    console.log(`   ユーザー入力: ${frontendDisplay(userInputDate).full}`);
    
    // Step 1: フロントエンドでフォーマット
    const frontendFormatted = formatLocal(userInputDate);
    console.log(`   フロントエンドフォーマット: ${frontendFormatted}`);
    
    // Step 2: APIに送信 → バックエンドで Date に変換
    const backendDate = backendConvert(frontendFormatted);
    console.log(`   バックエンド変換: ${backendDate.toISOString()}`);
    
    // Step 3: データベースに保存
    const storedValue = databaseStore(backendDate);
    console.log(`   DB保存値 (ISO/UTC): ${storedValue}`);
    
    // Step 4: データベースから取得
    const retrievedDate = databaseRetrieve(storedValue);
    console.log(`   DB取得値: ${retrievedDate.toISOString()}`);
    
    // Step 5: フロントエンドで表示
    const displayResult = frontendDisplay(retrievedDate);
    console.log(`   フロントエンド表示: ${displayResult.full}`);
    
    // 検証: 最終的な表示が元の入力と一致するか
    assert.strictEqual(retrievedDate.getFullYear(), userInputDate.getFullYear(), '年が一致');
    assert.strictEqual(retrievedDate.getMonth(), userInputDate.getMonth(), '月が一致');
    assert.strictEqual(retrievedDate.getDate(), userInputDate.getDate(), '日が一致');
    assert.strictEqual(retrievedDate.getHours(), userInputDate.getHours(), '時が一致');
    assert.strictEqual(retrievedDate.getMinutes(), userInputDate.getMinutes(), '分が一致');
    
    console.log('   ✅ PASS: 時刻の往復で変化なし\n');
} catch (e) {
    console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
}

// テスト2: 日付境界付近のテスト (深夜0時〜4時)
console.log('2. 日付境界付近のテスト (深夜)');
try {
    const testCases = [
        { desc: '0:00', hour: 0, minute: 0 },
        { desc: '3:59', hour: 3, minute: 59 },
        { desc: '4:00', hour: 4, minute: 0 },
        { desc: '23:59', hour: 23, minute: 59 },
    ];
    
    for (const tc of testCases) {
        const input = new Date(2025, 11, 15, tc.hour, tc.minute, 0, 0);
        const formatted = formatLocal(input);
        const backendDate = backendConvert(formatted);
        const stored = databaseStore(backendDate);
        const retrieved = databaseRetrieve(stored);
        
        assert.strictEqual(retrieved.getHours(), tc.hour, `${tc.desc}: 時が一致`);
        assert.strictEqual(retrieved.getMinutes(), tc.minute, `${tc.desc}: 分が一致`);
        console.log(`   ✅ ${tc.desc} → 保存 → 取得: ${retrieved.getHours()}:${retrieved.getMinutes().toString().padStart(2, '0')}`);
    }
    
    console.log('   ✅ PASS: 日付境界付近のテスト成功\n');
} catch (e) {
    console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
}

// テスト3: タスクの開始日・締切日テスト
console.log('3. タスクの開始日・締切日テスト');
try {
    // ユーザーが設定: 開始=12/15 09:00, 締切=12/16 18:00
    const startInput = new Date(2025, 11, 15, 9, 0, 0, 0);
    const deadlineInput = new Date(2025, 11, 16, 18, 0, 0, 0);
    
    // API送信
    const taskPayload = {
        startDate: formatLocal(startInput),
        deadline: formatLocal(deadlineInput)
    };
    console.log(`   送信ペイロード: ${JSON.stringify(taskPayload)}`);
    
    // バックエンド処理
    const backendStart = new Date(taskPayload.startDate);
    const backendDeadline = new Date(taskPayload.deadline);
    
    // DB保存・取得
    const storedStart = databaseStore(backendStart);
    const storedDeadline = databaseStore(backendDeadline);
    const retrievedStart = databaseRetrieve(storedStart);
    const retrievedDeadline = databaseRetrieve(storedDeadline);
    
    // 検証
    assert.strictEqual(retrievedStart.getDate(), 15, '開始日が正しい');
    assert.strictEqual(retrievedStart.getHours(), 9, '開始時刻が正しい');
    assert.strictEqual(retrievedDeadline.getDate(), 16, '締切日が正しい');
    assert.strictEqual(retrievedDeadline.getHours(), 18, '締切時刻が正しい');
    
    // 期間計算も正しいか
    const durationMs = retrievedDeadline.getTime() - retrievedStart.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    assert.strictEqual(durationHours, 33, '期間が33時間 (9-18 + 24)');
    
    console.log(`   開始: ${frontendDisplay(retrievedStart).full}`);
    console.log(`   締切: ${frontendDisplay(retrievedDeadline).full}`);
    console.log(`   期間: ${durationHours}時間`);
    console.log('   ✅ PASS: タスクの日時が正しく保存・取得される\n');
} catch (e) {
    console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
}

// テスト4: ISO文字列からのパース (Google Calendar API連携)
console.log('4. ISO文字列からのパース (Google Calendar連携)');
try {
    // Google Calendar APIから返される形式
    const googleEventStart = '2025-12-15T14:30:00+09:00'; // JST
    const googleEventEnd = '2025-12-15T16:00:00+09:00';
    
    const startDate = new Date(googleEventStart);
    const endDate = new Date(googleEventEnd);
    
    console.log(`   Google API Start: ${googleEventStart}`);
    console.log(`   パース後: ${frontendDisplay(startDate).full}`);
    
    // TZ=Asia/Tokyo の場合、getHours() は現地時間を返す
    if (process.env.TZ === 'Asia/Tokyo') {
        assert.strictEqual(startDate.getHours(), 14, '開始時刻が14時');
        assert.strictEqual(endDate.getHours(), 16, '終了時刻が16時');
        console.log('   ✅ PASS: Google Calendar APIの時刻が正しくパースされる\n');
    } else {
        console.log('   ⚠️  SKIP: TZ未設定のためスキップ\n');
    }
} catch (e) {
    console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
}

// テスト5: toISOString での送信 (Google Calendar API へのイベント作成)
console.log('5. toISOString での送信 (Google Calendar への作成)');
try {
    // ユーザーが「15:00-16:00」でイベントを作成
    const userStart = new Date(2025, 11, 15, 15, 0, 0, 0);
    const userEnd = new Date(2025, 11, 15, 16, 0, 0, 0);
    
    // calendar-actions.ts での処理
    const eventBody = {
        start: { dateTime: userStart.toISOString() },
        end: { dateTime: userEnd.toISOString() }
    };
    
    console.log(`   ユーザー入力: ${frontendDisplay(userStart).time}-${frontendDisplay(userEnd).time}`);
    console.log(`   送信 start: ${eventBody.start.dateTime}`);
    console.log(`   送信 end: ${eventBody.end.dateTime}`);
    
    // Google Calendar API がこれをパースすると...
    // ISO文字列は常にUTCなので、Google側でも同じ瞬間を指す
    const parsedStart = new Date(eventBody.start.dateTime);
    const parsedEnd = new Date(eventBody.end.dateTime);
    
    assert.strictEqual(parsedStart.getTime(), userStart.getTime(), 'タイムスタンプが一致');
    assert.strictEqual(parsedEnd.getTime(), userEnd.getTime(), 'タイムスタンプが一致');
    
    console.log(`   パース後: ${frontendDisplay(parsedStart).time}-${frontendDisplay(parsedEnd).time}`);
    console.log('   ✅ PASS: toISOStringでの送信が正しく動作\n');
} catch (e) {
    console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
}

// テスト6: 複数タイムゾーンシナリオ (参考)
console.log('6. 複数タイムゾーン環境での動作 (参考)');
try {
    // 同じ瞬間を異なるタイムゾーンで表現
    const unixTimestamp = 1734240000000; // 2024-12-15T06:00:00Z (UTC)
    const date = new Date(unixTimestamp);
    
    console.log(`   UNIX時刻: ${unixTimestamp}`);
    console.log(`   UTC: ${date.toISOString()}`);
    console.log(`   JST表示: ${date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
    console.log(`   PST表示: ${date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`);
    
    // getTime() は常に同じ値を返す（タイムゾーン非依存）
    const dateJST = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const dateFromISO = new Date(date.toISOString());
    
    assert.strictEqual(date.getTime(), dateFromISO.getTime(), 'ISO変換でタイムスタンプ維持');
    
    console.log('   ✅ INFO: タイムスタンプは常に一貫性がある\n');
} catch (e) {
    console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
}

// テスト7: アラーム時刻の保存・表示
console.log('7. アラーム時刻の保存・表示テスト');
try {
    // ユーザーが「07:30」にアラームを設定
    const alarmInput = new Date(2025, 11, 15, 7, 30, 0, 0);
    
    // Server Action での処理 (alarm-actions.ts)
    const alarmData = { time: alarmInput };
    
    // Prisma での保存
    const storedTime = databaseStore(alarmData.time);
    console.log(`   設定時刻: ${frontendDisplay(alarmInput).time}`);
    console.log(`   DB保存: ${storedTime}`);
    
    // 取得・表示
    const retrievedTime = databaseRetrieve(storedTime);
    
    assert.strictEqual(retrievedTime.getHours(), 7, '時が一致');
    assert.strictEqual(retrievedTime.getMinutes(), 30, '分が一致');
    
    console.log(`   取得後表示: ${frontendDisplay(retrievedTime).time}`);
    console.log('   ✅ PASS: アラーム時刻が正しく保存・取得される\n');
} catch (e) {
    console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
}

// テスト8: 残り時間計算の整合性
console.log('8. 残り時間計算の整合性テスト');
try {
    // TaskItem.tsx での残り時間計算をシミュレート
    const now = new Date(2025, 11, 15, 10, 0, 0, 0);
    const deadline = new Date(2025, 11, 15, 18, 0, 0, 0);
    
    // DB保存・取得
    const storedDeadline = databaseStore(deadline);
    const retrievedDeadline = databaseRetrieve(storedDeadline);
    
    // 残り時間計算
    const remainingMs = retrievedDeadline.getTime() - now.getTime();
    const remainingMinutes = Math.floor(remainingMs / (1000 * 60));
    const remainingHours = Math.floor(remainingMinutes / 60);
    
    assert.strictEqual(remainingHours, 8, '残り8時間');
    
    console.log(`   現在時刻: ${frontendDisplay(now).time}`);
    console.log(`   締切: ${frontendDisplay(retrievedDeadline).time}`);
    console.log(`   残り時間: ${remainingHours}時間${remainingMinutes % 60}分`);
    console.log('   ✅ PASS: 残り時間計算が正しい\n');
} catch (e) {
    console.log(`   ❌ FAIL: ${(e as Error).message}\n`);
}

console.log('=== テスト完了 ===\n');

// サマリー表示
console.log('【重要なポイント】');
console.log('1. フロントエンドの formatLocal() は "YYYY-MM-DDTHH:mm" を生成');
console.log('2. バックエンドで new Date() でパースするとローカル時刻として解釈');
console.log('3. DB保存時は toISOString() でUTC変換');
console.log('4. 取得時は new Date() で自動的にローカル時刻に変換');
console.log('5. タイムスタンプ (getTime()) はタイムゾーン非依存で一貫');
console.log('');
console.log('【TZ=Asia/Tokyo がDockerfileで設定済み】');
console.log('→ サーバー側でも一貫してJSTで処理されます');
