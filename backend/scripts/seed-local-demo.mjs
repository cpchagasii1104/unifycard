// backend/scripts/seed-local-demo.mjs
//
// LAUNCHER do seed de demo local: aponta DATABASE_URL para `unificard_local` e roda o seed
// REAL (src/scripts/seed-local-demo.ts via tsx — usa os writers SELADOS + authService.register).
// Guard fail-closed: NUNCA aponta para unificard_dev. Bank-free.
//
// Uso (a partir de backend/):  node scripts/seed-local-demo.mjs
// Pré-requisito: node scripts/setup-local-demo-db.mjs já criou/migrou unificard_local.

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = join(__dirname, '..');
const LOCAL_DB = 'unificard_local';

function readBaseDatabaseUrl() {
  const envPath = join(BACKEND_ROOT, '.env');
  if (!existsSync(envPath)) throw new Error(`.env não encontrado em ${envPath}`);
  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL ausente no .env');
  let value = line.slice('DATABASE_URL='.length).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value;
}

const baseUrl = readBaseDatabaseUrl();
const prefix = baseUrl.replace(/\/[^/]+$/, '');
const localUrl = `${prefix}/${LOCAL_DB}`;

if (localUrl.endsWith('/unificard_dev')) {
  console.error('❌ ABORT: alvo resolveu para unificard_dev');
  process.exit(1);
}

console.log(`🌱 Semeando demo em ${LOCAL_DB} ...`);
const res = spawnSync('npx', ['tsx', 'src/scripts/seed-local-demo.ts'], {
  cwd: BACKEND_ROOT,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: localUrl,
    EXPECTED_DATABASE_NAME: LOCAL_DB,
  },
});
process.exit(res.status ?? 1);
