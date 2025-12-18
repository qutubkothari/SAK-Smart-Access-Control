import { test, expect } from '@playwright/test';
import { getCreds } from './helpers/auth';
import { attachPageErrorCollector, gotoAndAssert } from './helpers/smoke';
import { hasStorageState, storageStatePath } from './helpers/storageState';

test.use({ storageState: storageStatePath('admin') });

const COOLDOWN_MS = parseInt(process.env.E2E_COOLDOWN_MS || '750', 10);

async function cooldown(page: any) {
  if (COOLDOWN_MS > 0) await page.waitForTimeout(COOLDOWN_MS);
}

async function gotoPublic(page: any, path: string) {
  await page.goto(path);
  await expect(page.locator('#root')).toBeVisible();
  await cooldown(page);
}

test('admin complete smoke: all routes + key actions (no mutations)', async ({ page }) => {
  const { its, pass } = getCreds('admin');
  test.skip(!its || !pass, 'Missing E2E_ADMIN_ITS / E2E_ADMIN_PASS');
  test.skip(!hasStorageState('admin'), 'Missing admin storageState; run via Playwright (global setup) with E2E_ADMIN_ITS/PASS set');

  const pageErrors = attachPageErrorCollector(page);

  await page.goto('/dashboard');
  await expect(page.locator('#root')).toBeVisible();

  // 1) Dashboard
  await gotoAndAssert(page, '/dashboard');
  await expect(page.locator('h1').first()).toBeVisible();
  await cooldown(page);

  // 2) Meetings list + open create + open a detail (if any)
  await gotoAndAssert(page, '/meetings');
  await cooldown(page);
  await page.getByRole('button', { name: /create meeting/i }).click();
  await expect(page).toHaveURL(/.*\/meetings\/create/);
  await expect(page.locator('h1').first()).toBeVisible();
  await cooldown(page);

  await gotoAndAssert(page, '/meetings');
  await cooldown(page);
  const viewBtn = page.getByRole('button', { name: /^view$/i }).first();
  if (await viewBtn.count()) {
    await viewBtn.click();
    await expect(page).toHaveURL(/.*\/meetings\/.+/);
    await expect(page.locator('h1').first()).toBeVisible();
    await cooldown(page);
  }

  // 3) Internal meeting booking (loads floors / rooms)
  await gotoAndAssert(page, '/meetings/internal/book');
  await expect(page.locator('h1').first()).toBeVisible();
  await cooldown(page);
  // Click a floor selector if present (triggers meeting-rooms API)
  const floorButton = page.getByRole('button', { name: /floor/i }).first();
  if (await floorButton.count()) {
    await floorButton.click();
    await cooldown(page);
  }

  // 4) Availability (admin selector + block time form opens)
  await gotoAndAssert(page, '/availability');
  await expect(page.getByRole('heading', { name: /availability/i })).toBeVisible();
  await cooldown(page);
  const userSelect = page.locator('select').first();
  if (await userSelect.count()) {
    const options = await userSelect.locator('option').count();
    if (options > 1) {
      await userSelect.selectOption({ index: 1 });
      await cooldown(page);
    }
  }
  const blockTimeBtn = page.getByRole('button', { name: /block time/i });
  if (await blockTimeBtn.isEnabled().catch(() => false)) {
    await blockTimeBtn.click();
    await expect(page.getByText(/block unavailable time|edit unavailable time/i).first()).toBeVisible();
    await cooldown(page);
  }

  // 5) Receptionist check-in (UI present; do not submit)
  await gotoAndAssert(page, '/receptionist');
  await expect(page.getByRole('heading', { name: /visitor check-in/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /check in/i })).toBeVisible();
  await cooldown(page);

  // 6) Visitors list (loads + search input present)
  await gotoAndAssert(page, '/visitors');
  await expect(page.getByRole('heading', { name: /visitors/i })).toBeVisible();
  await expect(page.getByPlaceholder(/search visitors/i)).toBeVisible();
  await cooldown(page);

  // 7) Analytics page loads
  await gotoAndAssert(page, '/analytics');
  await expect(page.getByRole('heading', { name: /analytics dashboard/i })).toBeVisible();
  await cooldown(page);

  // 8) Admin users: modals open
  await gotoAndAssert(page, '/admin/users');
  await cooldown(page);
  await page.getByRole('button', { name: /add user/i }).click();
  await expect(page.getByText(/add user/i).first()).toBeVisible();
  await page.getByLabel('Close').click();
  await cooldown(page);
  const editBtn = page.getByLabel('Edit user').first();
  if (await editBtn.count()) {
    await editBtn.click();
    await expect(page.getByText(/edit user/i).first()).toBeVisible();
    await page.getByLabel('Close').click();
    await cooldown(page);
  }

  // 9) Settings (form present; do not submit)
  await gotoAndAssert(page, '/settings');
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^save$/i })).toBeVisible();
  await cooldown(page);

  // 10) Public preregister page loads (no app shell)
  await gotoPublic(page, '/preregister');
  await expect(page.getByRole('heading', { name: /visitor pre-registration/i })).toBeVisible();

  expect(pageErrors, `Page errors detected: ${pageErrors.join('\n')}`).toEqual([]);
});
