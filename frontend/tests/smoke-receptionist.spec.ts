import { test, expect } from '@playwright/test';
import { login, getCreds } from './helpers/auth';
import { attachPageErrorCollector, gotoAndAssert } from './helpers/smoke';

test('receptionist smoke: key pages load', async ({ page }) => {
  const { its, pass } = getCreds('receptionist');
  test.skip(!its || !pass, 'Missing E2E_RECEPTIONIST_ITS / E2E_RECEPTIONIST_PASS');

  const pageErrors = attachPageErrorCollector(page);
  await login(page, 'receptionist');

  // Receptionist role should at least access these.
  await gotoAndAssert(page, '/receptionist');
  await expect(page.getByText(/visitor check-in/i)).toBeVisible();

  await gotoAndAssert(page, '/visitors');
  await expect(page.locator('h1').first()).toBeVisible();

  expect(pageErrors, `Page errors detected: ${pageErrors.join('\n')}`).toEqual([]);
});
