import { test, expect } from '@playwright/test';
import { getCreds } from './helpers/auth';
import { attachPageErrorCollector, gotoAndAssert } from './helpers/smoke';
import { hasStorageState, storageStatePath } from './helpers/storageState';

const COOLDOWN_MS = parseInt(process.env.E2E_COOLDOWN_MS || '500', 10);

async function cooldown(page: any) {
  if (COOLDOWN_MS > 0) await page.waitForTimeout(COOLDOWN_MS);
}

test.use({ storageState: storageStatePath('admin') });

test('admin phase-by-phase smoke: 22 phases (UI + API, no mutations)', async ({ page }) => {
  const { its, pass } = getCreds('admin');
  test.skip(!its || !pass, 'Missing E2E_ADMIN_ITS / E2E_ADMIN_PASS');
  test.skip(!hasStorageState('admin'), 'Missing admin storageState; run via Playwright (global setup) with E2E_ADMIN_ITS/PASS set');

  const pageErrors = attachPageErrorCollector(page);

  // Establish authenticated session + grab token for API checks
  await page.goto('/dashboard');
  await expect(page.locator('#root')).toBeVisible();

  const token = await page.evaluate(() => {
    return (
      window.localStorage.getItem('accessToken') ||
      window.localStorage.getItem('auth-token') ||
      ''
    );
  });

  expect(token, 'Missing access token in localStorage').toBeTruthy();

  async function apiGetOk(phase: number, name: string, url: string) {
    await test.step(`Phase ${String(phase).padStart(2, '0')}: API ${name}`, async () => {
      const resp = await page.request.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      expect(resp.status(), await resp.text()).toBeGreaterThanOrEqual(200);
      expect(resp.status(), await resp.text()).toBeLessThan(300);
    });
  }

  let phase = 0;

  await test.step(`Phase ${String(++phase).padStart(2, '0')}: UI Dashboard`, async () => {
    await gotoAndAssert(page, '/dashboard');
    await expect(page.locator('h1').first()).toBeVisible();
    await cooldown(page);
  });

  await test.step(`Phase ${String(++phase).padStart(2, '0')}: UI Meetings`, async () => {
    await gotoAndAssert(page, '/meetings');
    await expect(page.locator('h1').first()).toBeVisible();
    await cooldown(page);
  });

  await test.step(`Phase ${String(++phase).padStart(2, '0')}: UI Book Meeting Room`, async () => {
    await gotoAndAssert(page, '/meetings/internal/book');
    await expect(page.locator('h1').first()).toBeVisible();
    await cooldown(page);
  });

  await test.step(`Phase ${String(++phase).padStart(2, '0')}: UI Availability`, async () => {
    await gotoAndAssert(page, '/availability');
    await expect(page.getByRole('heading', { name: /availability/i })).toBeVisible();
    await cooldown(page);
  });

  await test.step(`Phase ${String(++phase).padStart(2, '0')}: UI Check-In`, async () => {
    await gotoAndAssert(page, '/receptionist');
    await expect(page.getByText(/visitor check-in/i)).toBeVisible();
    await cooldown(page);
  });

  await test.step(`Phase ${String(++phase).padStart(2, '0')}: UI Visitors`, async () => {
    await gotoAndAssert(page, '/visitors');
    await expect(page.getByRole('heading', { name: /visitors/i })).toBeVisible();
    await cooldown(page);
  });

  await test.step(`Phase ${String(++phase).padStart(2, '0')}: UI Analytics`, async () => {
    await gotoAndAssert(page, '/analytics');
    await expect(page.getByRole('heading', { name: /analytics dashboard/i })).toBeVisible();
    await cooldown(page);
  });

  await test.step(`Phase ${String(++phase).padStart(2, '0')}: UI Admin Users`, async () => {
    await gotoAndAssert(page, '/admin/users');
    await expect(page.getByRole('button', { name: /add user/i })).toBeVisible();
    await cooldown(page);
  });

  await test.step(`Phase ${String(++phase).padStart(2, '0')}: UI Settings`, async () => {
    await gotoAndAssert(page, '/settings');
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
    await cooldown(page);
  });

  await test.step(`Phase ${String(++phase).padStart(2, '0')}: UI Public Pre-register`, async () => {
    await page.goto('/preregister');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.getByRole('heading', { name: /visitor pre-registration/i })).toBeVisible();
    await cooldown(page);
  });

  await apiGetOk(++phase, 'Dashboard stats', '/api/v1/dashboard/stats');
  await apiGetOk(++phase, 'Meetings list', '/api/v1/meetings');
  await apiGetOk(++phase, 'Meeting rooms list', '/api/v1/meeting-rooms');
  await apiGetOk(++phase, 'Availability blocks', '/api/v1/availability');
  await apiGetOk(++phase, 'Notifications', '/api/v1/notifications');
  await apiGetOk(++phase, 'Users list', '/api/v1/users');
  await apiGetOk(++phase, 'Departments', '/api/v1/departments');
  await apiGetOk(++phase, 'Department configs', '/api/v1/department-config');
  await apiGetOk(++phase, 'Upcoming holidays', '/api/v1/holidays/upcoming');
  await apiGetOk(++phase, 'Shifts', '/api/v1/shifts');
  await apiGetOk(++phase, 'Leave statistics', '/api/v1/leaves/statistics');
  await apiGetOk(++phase, 'Security stats', '/api/v1/security/stats');

  expect(phase).toBe(22);
  expect(pageErrors, `Page errors detected: ${pageErrors.join('\n')}`).toEqual([]);
});
