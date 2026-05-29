// src/core/db/load-backend-env.ts
//
// Carrega `backend/.env` de forma deterministica (monorepo / dist) e corrige
// `DATABASE_URL` quando a senha contem `#` (dotenv trunca valores nao citados).

import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';

const __thisDir = dirname(process.argv[1] ?? process.cwd());

function findBackendPackageRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i += 1) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const parsed = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string };
        if (parsed?.name === 'unificard-backend') {
          return dir;
        }
      } catch {
        // ignore
      }
    }

    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return join(startDir, '..', '..', '..');
}

export const BACKEND_ROOT = findBackendPackageRoot(__thisDir);

/**
 * Rele `DATABASE_URL` da linha bruta do ficheiro (dotenv corta em `#` sem aspas).
 */
function hydrateDatabaseUrlFromEnvFile(): void {
  const envPath = join(BACKEND_ROOT, '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('DATABASE_URL=')) {
      continue;
    }

    let value = line.slice('DATABASE_URL='.length).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (value && !process.env.DATABASE_URL) {
      // Env explícito (ex.: ensaio em espelho via DATABASE_URL=…) vence o .env.
      // Hidratação só age quando a variável NÃO existe no ambiente — preserva a
      // intenção original (resolver truncamento do dotenv em senha com `#`) sem
      // sobrescrever overrides intencionais.
      process.env.DATABASE_URL = value;
    }
    return;
  }
}

/**
 * Flags so para desenvolvimento / E2E local.
 * Em `production` ou `staging` devem estar ausentes ou false (staging = ambiente protegido).
 * Chamado apos carregar `.env` - cobre qualquer entrada que importe `pool` ou `loadBackendEnv`.
 */
function assertE2eDevOnlyFlagsNotInProtectedEnvironments(): void {
  const nodeEnv = process.env.NODE_ENV;
  const protectedEnv = nodeEnv === 'production' || nodeEnv === 'staging';
  if (!protectedEnv) {
    return;
  }

  if (process.env.E2E_RELAX_BANK_COVERAGE === 'true') {
    throw new Error(
      `E2E_RELAX_BANK_COVERAGE=true e proibido com NODE_ENV=${nodeEnv}. Remova a variavel (nunca desactivar trg_check_coverage em producao ou staging).`
    );
  }
}

/**
 * Idempotente: seguro chamar varias vezes (pool, migrate, BOOT, seeds).
 */
export function loadBackendEnv(): void {
  dotenv.config({ path: join(BACKEND_ROOT, '.env') });
  hydrateDatabaseUrlFromEnvFile();
  assertE2eDevOnlyFlagsNotInProtectedEnvironments();
}
