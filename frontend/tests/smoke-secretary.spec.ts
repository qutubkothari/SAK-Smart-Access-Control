import { test, expect } from '@playwright/test';
import { login, getCreds } from './helpers/auth';
import { attachPageErrorCollector, gotoAndAssert } from './helpers/smoke';

test('secretary smoke: dashboards and meetings load', async ({ page }) => {
  const { its, pass } = getCreds('secretary');
  test.skip(!its || !pass, 'Missing E2E_SECRETARY_ITS / E2E_SECRETARY_PASS');

  const pageErrors = attachPageErrorCollector(page);
  await login(page, 'secretary');

  await gotoAndAssert(page, '/secretary-dashboard');
  await expect(page.locator('h1').first()).toBeVisible();

  await gotoAndAssert(page, '/meetings');
  await expect(page.locator('h1').first()).toBeVisible();

  await gotoAndAssert(page, '/availability');
  await expect(page.locator('h1').first()).toBeVisible();

  expect(pageErrors, `Page errors detected: ${pageErrors.join('\n')}`).toEqual([]);
});
