import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'storefront-responsive.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4320', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'chromium-desktop', use: { browserName: 'chromium', viewport: { width: 1366, height: 768 } } },
    { name: 'webkit-desktop', use: { browserName: 'webkit', viewport: { width: 1366, height: 768 } } },
  ],
  webServer: [
    { command: 'node tests/mock-supabase.cjs', url: 'http://127.0.0.1:4319/__events', reuseExistingServer: !process.env.CI },
    {
      command: 'npm run start -- --hostname 127.0.0.1 --port 4320',
      url: 'http://127.0.0.1:4320/login',
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:4319',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-publishable-key',
      },
    },
  ],
});
