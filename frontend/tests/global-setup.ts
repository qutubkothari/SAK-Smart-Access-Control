import fs from 'node:fs';
import path from 'node:path';
import { chromium, type FullConfig, expect } from '@playwright/test';
import type { Role } from './helpers/storageState';
import { storageStatePath } from './helpers/storageState';

function envKey(role: Role, key: 'ITS' | 'PASS') {
  return `E2E_${role.toUpperCase()}_${key}`;
}

function getCreds(role: Role) {
  const its = process.env[envKey(role, 'ITS')];
  const pass = process.env[envKey(role, 'PASS')];
  return { its, pass };
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = (config.projects[0]?.use as any)?.baseURL || process.env.E2E_BASE_URL || 'https://sac.saksolution.com';
  const authDir = path.resolve(process.cwd(), 'tests', '.auth');
  fs.mkdirSync(authDir, { recursive: true });

  const roles: Role[] = ['admin', 'host', 'receptionist', 'security', 'secretary', 'employee'];

  // Login sequentially to avoid triggering auth rate limits.
  const browser = await chromium.launch({ headless: true });
  try {
    for (const role of roles) {
      const { its, pass } = getCreds(role);
      if (!its || !pass) continue;

      const statePath = storageStatePath(role);
      // If already generated in this workspace, keep it (avoids extra logins).
      if (fs.existsSync(statePath)) continue;

      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();

      await page.goto('/login');
      await page.getByPlaceholder('Enter your ITS ID').fill(its);
      await page.locator('input[type="password"]').fill(pass);
      await page.getByRole('button', { name: /^login$/i }).click();

      await expect(page).not.toHaveURL(/.*\/login$/, { timeout: 30_000 });
      await page.waitForLoadState('networkidle');

      await context.storageState({ path: statePath });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
