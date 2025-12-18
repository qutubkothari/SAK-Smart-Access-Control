# E2E QA (Playwright)

This folder contains Playwright smoke tests that act like a "senior QA bot".

## Install

```powershell
cd "C:\Users\musta\OneDrive\Documents\GitHub\SAK-Smart-Access-Control\frontend"
npm install
npx playwright install chromium
```

## Configure credentials (PowerShell)

Set env vars for each role:

```powershell
$env:E2E_BASE_URL="https://sac.saksolution.com"

$env:E2E_ADMIN_ITS="..."
$env:E2E_ADMIN_PASS="..."

$env:E2E_HOST_ITS="..."
$env:E2E_HOST_PASS="..."

$env:E2E_RECEPTIONIST_ITS="..."
$env:E2E_RECEPTIONIST_PASS="..."

$env:E2E_SECURITY_ITS="..."
$env:E2E_SECURITY_PASS="..."

$env:E2E_SECRETARY_ITS="..."
$env:E2E_SECRETARY_PASS="..."

$env:E2E_EMPLOYEE_ITS="..."
$env:E2E_EMPLOYEE_PASS="..."

npm run test:e2e
```

Tests automatically **skip** any role that has missing credentials.

## Safety: mutation tests

By default, tests avoid changing production data.

To enable guarded mutation tests (create/deactivate test user), set:

```powershell
$env:E2E_ALLOW_MUTATIONS="true"
```
