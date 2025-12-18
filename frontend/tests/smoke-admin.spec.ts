import { test, expect } from '@playwright/test';
import { getCreds } from './helpers/auth';
import { attachPageErrorCollector, gotoAndAssert } from './helpers/smoke';
import { hasStorageState, storageStatePath } from './helpers/storageState';

test.use({ storageState: storageStatePath('admin') });

test('admin smoke: key pages load and primary actions open', async ({ page }) => {
  const { its, pass } = getCreds('admin');
  test.skip(!its || !pass, 'Missing E2E_ADMIN_ITS / E2E_ADMIN_PASS');
  test.skip(!hasStorageState('admin'), 'Missing admin storageState; run via Playwright (global setup) with E2E_ADMIN_ITS/PASS set');

  const pageErrors = attachPageErrorCollector(page);

  await page.goto('/dashboard');
  await expect(page.locator('#root')).toBeVisible();

  const routes = [
    '/dashboard',
    '/meetings',
    '/meetings/internal/book',
    '/availability',
    '/receptionist',
    '/visitors',
    '/analytics',
    '/admin/users',
    '/settings',
  ];

  for (const route of routes) {
    await gotoAndAssert(page, route);
  }

  // Users: Add User modal opens
  await gotoAndAssert(page, '/admin/users');
  await page.getByRole('button', { name: /add user/i }).click();
  await expect(page.getByText(/add user/i).first()).toBeVisible();
  await page.getByLabel('Close').click();

  // Users: Edit modal opens (if any rows)
  const editBtn = page.getByLabel('Edit user').first();
  if (await editBtn.count()) {
    await editBtn.click();
    await expect(page.getByText(/edit user/i).first()).toBeVisible();
    await page.getByLabel('Close').click();
  }

  // Users: Delete triggers confirm dialog (dismiss to avoid mutating prod data)
  page.once('dialog', async (dialog) => {
    await dialog.dismiss();
  });
  const delBtn = page.getByLabel('Deactivate user').first();
  if (await delBtn.count()) {
    await delBtn.click();
  }

  // Meetings: Create Meeting button navigates
  await gotoAndAssert(page, '/meetings');
  await page.getByRole('button', { name: /create meeting/i }).click();
  await expect(page).toHaveURL(/.*\/meetings\/create/);

  expect(pageErrors, `Page errors detected: ${pageErrors.join('\n')}`).toEqual([]);
});
