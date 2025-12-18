import { test, expect } from '@playwright/test';
import { getCreds } from './helpers/auth';
import { attachPageErrorCollector, gotoAndAssert } from './helpers/smoke';
import { hasStorageState, storageStatePath } from './helpers/storageState';

test.use({ storageState: storageStatePath('host') });

test('host smoke: key pages load + meeting create opens', async ({ page }) => {
  const { its, pass } = getCreds('host');
  test.skip(!its || !pass, 'Missing E2E_HOST_ITS / E2E_HOST_PASS');
  test.skip(!hasStorageState('host'), 'Missing host storageState; run via Playwright (global setup) with E2E_HOST_ITS/PASS set');

  const pageErrors = attachPageErrorCollector(page);

  await page.goto('/dashboard');
  await expect(page.locator('#root')).toBeVisible();

  await gotoAndAssert(page, '/dashboard');

  await gotoAndAssert(page, '/meetings');
  await page.getByRole('button', { name: /create meeting/i }).click();
  await expect(page).toHaveURL(/.*\/meetings\/create/);

  expect(pageErrors, `Page errors detected: ${pageErrors.join('\n')}`).toEqual([]);
});
