import { test, expect } from '@playwright/test';
import { getCreds } from './helpers/auth';
import { attachPageErrorCollector, gotoAndAssert } from './helpers/smoke';
import { hasStorageState, storageStatePath } from './helpers/storageState';

type Role = 'admin' | 'host' | 'receptionist' | 'security' | 'secretary' | 'employee';

const roles: Role[] = ['admin', 'host', 'receptionist', 'security', 'secretary', 'employee'];

const homeRouteByRole: Record<Role, string> = {
  admin: '/dashboard',
  host: '/dashboard',
  receptionist: '/receptionist',
  security: '/receptionist',
  secretary: '/secretary-dashboard',
  employee: '/employee-dashboard',
};

for (const role of roles) {
  test(`${role} nav smoke: sidebar links load without errors`, async ({ browser }) => {
    const { its, pass } = getCreds(role);
    test.skip(!its || !pass, `Missing E2E_${role.toUpperCase()}_ITS / E2E_${role.toUpperCase()}_PASS`);
    test.skip(!hasStorageState(role), `Missing ${role} storageState; run via Playwright (global setup) with creds set`);

    const context = await browser.newContext({ storageState: storageStatePath(role) });
    const page = await context.newPage();

    const pageErrors = attachPageErrorCollector(page);

    // Ensure authenticated app shell is loaded
    await page.goto(homeRouteByRole[role]);
    await expect(page.locator('#root')).toBeVisible();

    const sidebarNav = page.locator('aside nav');
    const hasSidebar = await sidebarNav.count();

    // Gather sidebar routes for this role
    const linkLocator = hasSidebar ? page.locator('aside nav a') : page.locator('nav a');
    const links = await linkLocator.evaluateAll((els) =>
      els
        .map((e) => ({
          href: (e as HTMLAnchorElement).getAttribute('href') || '',
          text: (e.textContent || '').trim(),
        }))
        .filter((x) => x.href.startsWith('/'))
    );

    const uniqueHrefs = Array.from(new Set(links.map((l) => l.href)));
    expect(uniqueHrefs.length).toBeGreaterThan(0);

    for (const href of uniqueHrefs) {
      await gotoAndAssert(page, href);
      // Many pages have an h1; if present it should be visible.
      const h1 = page.locator('h1').first();
      if (await h1.count()) {
        await expect(h1).toBeVisible();
      }
    }

    expect(pageErrors, `Page errors detected: ${pageErrors.join('\n')}`).toEqual([]);

    await context.close();
  });
}
