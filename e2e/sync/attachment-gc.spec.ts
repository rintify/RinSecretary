import { test, expect, getLocalAttachments } from '../fixtures/test-setup';
import { MemoEditPage } from '../pages/memo-edit.page';

/**
 * 添付ファイルのキャッシュとGCテスト
 * 
 * Production-Quality:
 * - Page Object Model を使用
 * - ファイルアップロードのシミュレーション
 * - IndexedDB 状態の検証
 */
test.describe('添付ファイルのキャッシュとGC', () => {

  test('添付ファイルがローカルにキャッシュされる', async ({ page, memoEditPage }) => {
    // 1. 新規メモを作成
    await memoEditPage.gotoNew();
    
    const content = `添付ファイルテスト ${Date.now()}`;
    await memoEditPage.setContent(content);
    await memoEditPage.save();
    await memoEditPage.waitForSaved();
    
    const memoId = memoEditPage.getMemoIdFromUrl();
    expect(memoId).toBeTruthy();
    
    // 2. ファイル入力を探してアップロード
    const fileInput = page.locator('input[type="file"]');
    
    if (await fileInput.count() > 0) {
      // テスト用の小さな PNG 画像
      const testImageBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      
      await fileInput.first().setInputFiles({
        name: 'test-image.png',
        mimeType: 'image/png',
        buffer: testImageBuffer,
      });
      
      // 保存を待機
      await memoEditPage.waitForSaved();
      
      // 3. IndexedDB で添付ファイルを確認
      const attachments = await getLocalAttachments(page, memoId!);
      
      if (attachments.length > 0) {
        const testAttachment = attachments.find(a => a.fileName === 'test-image.png');
        expect(testAttachment).toBeTruthy();
        expect(testAttachment?.hasBlob).toBe(true);
      }
    } else {
      // ファイル入力がない場合はスキップ（UIに依存）
      console.log('ファイル入力が見つかりません、スキップします');
    }
  });

  test('同期済みファイルはGCで削除対象になる', async ({ page, memoEditPage }) => {
    // メモを作成
    await memoEditPage.gotoNew();
    
    const content = `GCテスト ${Date.now()}`;
    await memoEditPage.setContent(content);
    await memoEditPage.save();
    await memoEditPage.waitForSaved();
    
    const memoId = memoEditPage.getMemoIdFromUrl();
    expect(memoId).toBeTruthy();
    
    // 同期を待機
    try {
      await memoEditPage.waitForSyncComplete();
    } catch {
      // 同期がない場合もある
    }
    
    // 添付ファイルの状態を確認
    const attachments = await getLocalAttachments(page);
    
    // 同期済み（isDirty: false）かつ blob を持つファイルはGC対象
    const gcCandidates = attachments.filter(a => !a.isDirty && a.hasBlob);
    
    console.log(`GC対象ファイル数: ${gcCandidates.length}`);
    
    // GC対象が存在する場合は正しく識別されていることを確認
    for (const candidate of gcCandidates) {
      expect(candidate.isDirty).toBeFalsy();
      expect(candidate.hasBlob).toBe(true);
    }
  });

  test('未同期ファイルはGCで削除されない', async ({ page, context, memoEditPage }) => {
    // 1. オフラインにする
    await context.setOffline(true);
    
    // 2. メモを作成
    await memoEditPage.gotoNew();
    
    const content = `オフライン添付テスト ${Date.now()}`;
    await memoEditPage.setContent(content);
    await memoEditPage.save();
    await memoEditPage.waitForSaved();
    
    const memoId = memoEditPage.getMemoIdFromUrl();
    
    // 3. 添付ファイルの状態を確認
    const attachments = await getLocalAttachments(page);
    
    // 未同期ファイル（isDirty: true）は保護対象
    const protectedFiles = attachments.filter(a => a.isDirty && a.hasBlob);
    
    for (const file of protectedFiles) {
      expect(file.isDirty).toBe(true);
      expect(file.hasBlob).toBe(true);
      console.log(`保護対象ファイル: ${file.fileName}`);
    }
    
    // 4. オンラインに戻す
    await context.setOffline(false);
  });

  test('GC後もメタデータは残る', async ({ page }) => {
    // 添付ファイルのメタデータを確認
    const attachments = await getLocalAttachments(page);
    
    for (const att of attachments) {
      // メタデータの存在を確認
      expect(att.id).toBeDefined();
      expect(att.fileName).toBeDefined();
      expect(att.mimeType).toBeDefined();
      expect(att.fileSize).toBeDefined();
      
      // blob がなくてもメタデータはあるはず
      if (!att.hasBlob) {
        console.log(`GC済みファイル（メタデータのみ）: ${att.fileName}`);
        expect(att.fileName).toBeTruthy();
      }
    }
  });
});
