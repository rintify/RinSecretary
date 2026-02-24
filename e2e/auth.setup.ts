import { test as setup } from '@playwright/test';

setup('reset database and create test user', async ({ request }) => {
  const response = await request.post('/api/e2e/reset', { timeout: 5000 });
  if (!response.ok()) {
    throw new Error(`E2E reset failed: ${response.status()}`);
  }
});
