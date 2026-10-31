import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './e2e', timeout: 120000, workers: 1, use: { baseURL: process.env.FIT_E2E_WEB_URL ?? 'http://127.0.0.1:8087', viewport: { width: 390, height: 844 }, timezoneId: 'America/Bahia', screenshot: 'only-on-failure', trace: 'retain-on-failure' }, reporter: [['list']] });
