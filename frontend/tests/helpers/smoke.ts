import { expect, type Page } from '@playwright/test';

export function attachPageErrorCollector(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(`[console.${msg.type()}] ${msg.text()}`);
  });
  page.on('response', (resp) => {
    const status = resp.status();
    const url = resp.url();
    const isApi = url.includes('/api/');
    if (isApi && (status === 401 || status === 403)) {
      pageErrors.push(`[http.${status}] ${resp.request().method()} ${url}`);
    }
    if (status >= 500) {
      pageErrors.push(`[http.${status}] ${resp.request().method()} ${resp.url()}`);
    }
  });
  return pageErrors;
}

export async function assertAppShellLoaded(page: Page) {
  // Layout renders two <nav> elements (top bar + sidebar nav). Be explicit.
  await expect(page.locator('nav.fixed.w-full')).toBeVisible();
  await expect(page.getByText('SAK Access Control')).toBeVisible();
  await expect(page.locator('aside')).toBeVisible();
  await expect(page.locator('#root')).toBeVisible();
}

export async function gotoAndAssert(page: Page, path: string) {
  await page.goto(path);
  await assertAppShellLoaded(page);
  // Avoid false positives where ProtectedRoute kicks you to unauthorized.
  await expect(page).not.toHaveURL(/.*\/unauthorized$/);
}

export function allowMutations() {
  return String(process.env.E2E_ALLOW_MUTATIONS || '').toLowerCase() === 'true';
}
