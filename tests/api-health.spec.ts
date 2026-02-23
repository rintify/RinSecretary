import { test, expect } from '@playwright/test';

test.describe('API Health Check', () => {
  test('should return 200 OK and valid JSON wrapper from /api/health', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);

    const body = await response.json();

    // 規定したApiResponseフォーマットに沿っているか
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.status).toBe('ok');

    // DB接続も成功しているか
    expect(body.data.dbConnection).toBe('success');
    expect(typeof body.data.userCount).toBe('number');
  });
});
