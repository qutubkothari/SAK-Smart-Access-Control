# SAK Smart Access Control — New PC Handoff (Run / Deploy / Debug)

This document is a **single, practical handoff** so a developer can switch laptops and immediately understand how to **run locally**, **deploy to production (EC2)**, and **operate/debug** the system.

Repo: https://github.com/qutubkothari/SAK-Smart-Access-Control

Production:
- Frontend: https://sac.saksolution.com
- API base: https://sac.saksolution.com/api/v1
- EC2 public IP: 3.108.52.219 (prefer the domain for HTTPS)

---

## 1) What this system is

A full-stack access control + visitor management platform.

**Frontend**
- React + Vite + TypeScript
- Role-based navigation and pages
- Talks to backend at `/api/v1` (relative path so it works behind Nginx)

**Backend**
- Node.js + Express + TypeScript
- PostgreSQL (Knex)
- Redis
- PM2 for production process management

**Major functional areas**
- Authentication + role-based authorization
- Meetings (internal + visitor), QR codes
- Visitors check-in/check-out + pre-registration portal
- Notifications + audit logs
- Access control (floors) + attendance
- Admin management: users, departments, department configs

---

## 2) Repo structure (high-level)

- `backend/` — Express API, DB migrations/seeds, services
- `frontend/` — React/Vite app
- `deploy-backend.ps1` — Windows deploy script: uploads `backend/dist` to EC2 and restarts PM2
- `frontend/deploy-frontend.ps1` — Windows deploy script: builds `frontend/dist` and uploads to EC2
- `docs/` — deep-dive docs (architecture, deployment, DB, API)
- `frontend/tests/` — Playwright E2E smoke suites (including admin 22-phase)

Good starting docs already in repo:
- `START_HERE.md` (big overview)
- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/API.md`
- `frontend/tests/README.md`

---

## 3) Prerequisites on a new PC (Windows)

Install:
- **Git**
- **Node.js LTS** (recommended: Node 18)
- **npm** (comes with Node)
- Optional: **VS Code**

Ensure OpenSSH is available (for deploy scripts):
- `ssh` and `scp` must work from PowerShell

---

## 4) Clone + install (new PC)

```powershell
# Pick a folder
cd C:\Users\<YOU>\Documents

# Clone
git clone https://github.com/qutubkothari/SAK-Smart-Access-Control.git
cd .\SAK-Smart-Access-Control

# Install backend deps
cd .\backend
npm install

# Install frontend deps
cd ..\frontend
npm install
```

---

## 5) Run locally (recommended path)

### Option A — One command (Windows script)
From repo root:

```powershell
cd C:\path\to\SAK-Smart-Access-Control
.\start-dev.ps1
```

Then:
- Frontend: http://localhost:5173
- Backend: typically http://localhost:3000 (depends on env)

### Option B — Run backend + frontend separately

Backend:
```powershell
cd .\backend
# configure env first (see section below)
npm run dev
```

Frontend:
```powershell
cd .\frontend
npm run dev
```

---

## 6) Environment configuration

### Backend env
Backend uses environment variables (see `backend/.env.example`).

Typical production-style variables include:
- `NODE_ENV`
- `PORT`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`
- Redis connection vars
- Email/WhatsApp provider configs (if enabled)

Create your local file:
```powershell
cd .\backend
Copy-Item .\.env.example .\.env
notepad .\.env
```

### Frontend env
Frontend uses Vite env vars.
- The code is set up to default to relative API: `VITE_API_URL` falls back to `/api/v1`.
- For local-only testing against a local backend, you may set `VITE_API_URL=http://localhost:3000/api/v1`.

---

## 7) Database & migrations

### Local DB
You need Postgres running locally and a database created.

Then run migrations:
```powershell
cd .\backend
npm run migrate
```

Optional seeds (if configured in package scripts):
```powershell
npm run seed
```

### Notable schema features
- **Floor access** uses `employee_floor_access`
- **Multi-department per user** uses `user_departments` (junction table)

---

## 8) Key UX features added recently (important)

### Users page: multiple departments + floor access
Admin can now manage **both** inside the Users page.

- **Multi-departments**: user can be assigned multiple departments (frontend sends `department_ids` array)
- **Floor access**: in Edit User modal, admin can grant/revoke multiple floors

Relevant frontend file:
- `frontend/src/pages/AdminUsersPage.tsx`

Relevant backend file:
- `backend/src/controllers/user.controller.ts`

---

## 9) Production deployment overview (EC2)

Production is currently hosted on:
- EC2 IP: `3.108.52.219`
- Domain: `sac.saksolution.com` (use this for HTTPS)

### Production process manager
- PM2 process name: `sak-backend`

Common ops:
```bash
pm2 status
pm2 logs sak-backend --lines 200
pm2 restart sak-backend
```

### Deployment scripts (Windows)

**Backend deploy** (repo root):
- Script: `deploy-backend.ps1`
- Builds locally (`backend/dist`)
- Uploads `backend/dist/*` to server
- Restarts `sak-backend` via PM2

Run:
```powershell
cd C:\path\to\SAK-Smart-Access-Control
.\deploy-backend.ps1
```

**Frontend deploy** (inside `frontend/`):
- Script: `frontend/deploy-frontend.ps1`
- Builds locally (`frontend/dist`)
- Uploads to: `/var/www/sak-frontend` on EC2

Run:
```powershell
cd C:\path\to\SAK-Smart-Access-Control\frontend
.\deploy-frontend.ps1
```

### GitHub auto-sync on deploy
Both deploy scripts include a **Step 0** that attempts:
- `git add -A`
- `git commit -m "Auto-commit before deployment - <timestamp>"`
- `git push origin master`

Notes:
- If there are no changes, it prints “No changes to commit”.
- If git push fails (no auth), it warns but continues.

---

## 10) Secrets & keys (IMPORTANT)

- **Do not commit** private keys (`*.pem`) or `.env` files.
- The repo’s `.gitignore` already ignores `*.pem`.

For deploying from a new PC, you must securely copy the EC2 key file:
- `sak-smart-access.pem`

Recommended secure transfer:
- Use an encrypted USB, or
- Copy from a password manager / secure vault

---

## 11) How to “verify it’s working” (fast checks)

### Public URLs
- App: https://sac.saksolution.com
- Health: https://sac.saksolution.com/api/v1/health

### PM2 logs
```bash
pm2 logs sak-backend --lines 200
```

---

## 12) Automated QA (Playwright)

Location: `frontend/tests/`

### Admin 22-phase certification suite
File:
- `frontend/tests/smoke-admin-22-phases.spec.ts`

Phases 1–10: UI navigation
Phases 11–22: API GET health checks

Run (example):
```powershell
cd .\frontend
npm run test:e2e
```

See:
- `frontend/tests/README.md` for exact env var names and auth storageState setup.

---

## 13) Common troubleshooting

### A) Frontend loads but APIs fail
- Check Nginx proxy config and backend status
- Check token in browser localStorage (login again)

### B) Backend errors after deploy
- Check PM2 logs: `pm2 logs sak-backend --lines 200`
- Common causes: missing env vars, DB connectivity, schema drift

### C) Migrations not applied in prod
- Ensure the backend is running in the correct environment (`NODE_ENV=production`)
- If you must run migrations manually on EC2, do it from `backend/`:
  - `cd /home/ubuntu/SAK-Smart-Access-Control/backend`
  - `NODE_ENV=production npx knex migrate:latest`

---

## 14) Next PC checklist

1. Clone repo
2. Install Node + npm
3. Get `sak-smart-access.pem` securely
4. (If deploying) ensure PowerShell can run `ssh`/`scp`
5. Run frontend + backend locally OR deploy scripts
6. Verify:
   - https://sac.saksolution.com
   - https://sac.saksolution.com/api/v1/health

---

## 15) Where to look first (developer map)

- Routing/menu: `frontend/src/App.tsx` + `frontend/src/components/Layout.tsx`
- API client: `frontend/src/services/api.ts`
- Backend server: `backend/src/server.ts`
- Auth middleware: `backend/src/middleware/auth.ts`
- Users + departments:
  - `backend/src/controllers/user.controller.ts`
  - `backend/src/controllers/department.controller.ts`
- Access control:
  - `backend/src/controllers/access.controller.ts`
  - `backend/src/routes/access.routes.ts`

If you want, we can also set up **GitHub Actions (CI/CD)** to auto-deploy to EC2 on every push so you don’t need to run the PowerShell scripts manually.
