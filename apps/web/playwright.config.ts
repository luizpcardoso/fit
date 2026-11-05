import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 30000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:3341', viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Bahia', screenshot: 'only-on-failure' },
  webServer: { command: 'node --import tsx e2e/server.ts', url: 'http://127.0.0.1:3341/portal', reuseExistingServer: false },
});
