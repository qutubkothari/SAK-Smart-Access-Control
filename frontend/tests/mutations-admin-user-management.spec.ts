import { test, expect } from '@playwright/test';
import { getCreds } from './helpers/auth';
import { allowMutations, attachPageErrorCollector, gotoAndAssert } from './helpers/smoke';
import { hasStorageState, storageStatePath } from './helpers/storageState';

test.use({ storageState: storageStatePath('admin') });

function uniq(s: string) {
  const t = Date.now().toString().slice(-6);
  return `${s}${t}`;
}

test('admin mutation: create user then deactivate (guarded)', async ({ page }) => {
  const { its, pass } = getCreds('admin');
  test.skip(!its || !pass, 'Missing E2E_ADMIN_ITS / E2E_ADMIN_PASS');
  test.skip(!hasStorageState('admin'), 'Missing admin storageState; run via Playwright (global setup) with E2E_ADMIN_ITS/PASS set');
  test.skip(!allowMutations(), 'Set E2E_ALLOW_MUTATIONS=true to enable');

  const pageErrors = attachPageErrorCollector(page);

  await page.goto('/admin/users');
  await expect(page.locator('#root')).toBeVisible();

  const testIts = uniq('E2E');
  const testEmail = `${testIts.toLowerCase()}@example.com`;

  await gotoAndAssert(page, '/admin/users');

  // Open create modal
  await page.getByRole('button', { name: /add user/i }).click();
  await expect(page.getByText(/add user/i).first()).toBeVisible();

  await page.getByLabel('Name').fill('E2E Test User');
  await page.getByLabel('ITS ID').fill(testIts);
  await page.getByLabel('Email').fill(testEmail);
  await page.getByLabel('Password').fill('Test123!');
  await page.getByLabel('Role').selectOption('host');

  await page.getByRole('button', { name: /create user/i }).click();

  // Modal closes after create
  await expect(page.getByText(/add user/i).first()).toHaveCount(0);

  // Find user and deactivate
  await page.getByPlaceholder(/search users/i).fill(testIts);
  await expect(page.getByText(testIts)).toBeVisible();

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.getByLabel('Deactivate user').first().click();

  // After reload, the row may still exist but status should go Inactive.
  await page.getByPlaceholder(/search users/i).fill(testIts);
  await expect(page.getByText(testIts)).toBeVisible();
  await expect(page.getByText(/inactive/i).first()).toBeVisible();

  expect(pageErrors, `Page errors detected: ${pageErrors.join('\n')}`).toEqual([]);
});
