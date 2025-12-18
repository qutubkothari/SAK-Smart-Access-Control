import { expect, type Page } from '@playwright/test';

type Role = 'admin' | 'host' | 'receptionist' | 'security' | 'secretary' | 'employee';

function envKey(role: Role, key: 'ITS' | 'PASS') {
  return `E2E_${role.toUpperCase()}_${key}`;
}

export function getCreds(role: Role) {
  const its = process.env[envKey(role, 'ITS')];
  const pass = process.env[envKey(role, 'PASS')];
  return { its, pass };
}

export async function login(page: Page, role: Role) {
  const { its, pass } = getCreds(role);
  if (!its || !pass) {
    throw new Error(`Missing credentials: ${envKey(role, 'ITS')} and/or ${envKey(role, 'PASS')}`);
  }

  const maxAttempts = parseInt(process.env.E2E_LOGIN_MAX_ATTEMPTS || '6', 10);
  const baseDelayMs = parseInt(process.env.E2E_LOGIN_RETRY_DELAY_MS || '5000', 10);

  await page.goto('/login');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await page.getByPlaceholder('Enter your ITS ID').fill(its);
    await page.locator('input[type="password"]').fill(pass);

    const loginResponsePromise = page.waitForResponse(
      (resp) => resp.request().method() === 'POST' && resp.url().includes('/auth/login'),
      { timeout: 30_000 }
    );

    await page.getByRole('button', { name: /^login$/i }).click();
    const loginResp = await loginResponsePromise.catch(() => null);

    if (!loginResp) {
      // If we couldn't observe the response, fall back to URL change check.
      try {
        await expect(page).not.toHaveURL(/.*\/login$/, { timeout: 10_000 });
        await page.waitForLoadState('networkidle');
        return;
      } catch {
        // Continue to retry.
      }
    } else if (loginResp.status() === 429 && attempt < maxAttempts) {
      const retryAfterHeader = loginResp.headers()['retry-after'];
      const rateLimitResetHeader = loginResp.headers()['ratelimit-reset'];

      let delayMs = baseDelayMs * attempt;
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
      if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
        delayMs = retryAfterSeconds * 1000;
      } else {
        const resetSeconds = rateLimitResetHeader ? parseInt(rateLimitResetHeader, 10) : NaN;
        if (!Number.isNaN(resetSeconds) && resetSeconds > 0) {
          delayMs = resetSeconds * 1000;
        }
      }

      await page.waitForTimeout(Math.min(Math.max(delayMs, 2000), 65_000));
      await page.goto('/login');
      continue;
    } else if (loginResp.status() >= 400) {
      const bodyText = await loginResp.text().catch(() => '');
      throw new Error(`Login failed: HTTP ${loginResp.status()} ${loginResp.url()} ${bodyText.slice(0, 300)}`);
    }

    // Success path.
    await expect(page).not.toHaveURL(/.*\/login$/, { timeout: 30_000 });
    await page.waitForLoadState('networkidle');
    return;
  }

  throw new Error('Login failed: exceeded retry budget');
}

export async function logout(page: Page) {
  // Layout has a logout icon button with title="Logout"
  const btn = page.locator('button[title="Logout"]');
  if (await btn.count()) {
    await btn.click();
    await page.waitForURL('**/login', { timeout: 30_000 });
  }
}
