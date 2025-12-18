import { test, expect } from '@playwright/test';
import { login, getCreds } from './helpers/auth';
import { attachPageErrorCollector, gotoAndAssert } from './helpers/smoke';

test('security smoke: key pages load', async ({ page }) => {
  const { its, pass } = getCreds('security');
  test.skip(!its || !pass, 'Missing E2E_SECURITY_ITS / E2E_SECURITY_PASS');

  const pageErrors = attachPageErrorCollector(page);
  await login(page, 'security');

  await gotoAndAssert(page, '/receptionist');
  await expect(page.getByText(/visitor check-in/i)).toBeVisible();

  await gotoAndAssert(page, '/visitors');
  await expect(page.locator('h1').first()).toBeVisible();

  expect(pageErrors, `Page errors detected: ${pageErrors.join('\n')}`).toEqual([]);
});
