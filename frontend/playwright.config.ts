import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envE2ePath = path.resolve(process.cwd(), '.env.e2e');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envE2ePath)) {
  dotenv.config({ path: envE2ePath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const baseURL = process.env.E2E_BASE_URL || 'https://sac.saksolution.com';

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  reporter: [['list']],
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
