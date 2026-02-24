import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Desktop Chrome'],
        isMobile: true,
        viewport: { width: 390, height: 844 },
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run build && npx next start -p 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'test-secret-for-e2e',
      E2E_TESTING: 'true',
      PORT: '3001',
    },
  },
});
