import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'admin-catalog.spec.ts', workers: 1, timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4320',
    launchOptions: process.env.CHROMIUM_EXECUTABLE_PATH ? {
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    } : {},
  },
  webServer: [
    {command:'node tests/mock-supabase.cjs',url:'http://127.0.0.1:4319/__events'},
    {command:'npm run start -- --hostname 127.0.0.1 --port 4320',url:'http://127.0.0.1:4320/login',timeout:60000,
      env:{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:4319',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-publishable-key'}},
  ],
});
