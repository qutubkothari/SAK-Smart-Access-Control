import fs from 'node:fs';
import path from 'node:path';

export type Role = 'admin' | 'host' | 'receptionist' | 'security' | 'secretary' | 'employee';

export function storageStatePath(role: Role) {
  // Run from `frontend` (playwright config uses process.cwd())
  return path.resolve(process.cwd(), 'tests', '.auth', `${role}.json`);
}

export function hasStorageState(role: Role) {
  return fs.existsSync(storageStatePath(role));
}
