#!/usr/bin/env node
// Guard — F-RLS-FORCE-REFERRAL-CIVIL (fecha o blocker do preflight RLS-live).
//
// O preflight final (live DB) achou 3 tabelas com RLS ENABLED + policy, mas SEM FORCE — gap do invariante
// RLS+FORCE (§1.4 do runbook RLS-live). A migration desta frente adiciona FORCE nas 3. Este guard TRAVA essas 3:
// MORDE se a migration não FORÇar qualquer uma delas (ou se o FORCE for removido).
//
// NB: a verificação GERAL "0 tabelas RLS-without-FORCE" vive no PREFLIGHT live-DB (pg_class) — não aqui: o FORCE
// das demais ~57 tabelas foi aplicado por mecanismo bulk que um scan estático de migrations não detecta de forma
// confiável (falsos-positivos). Este guard é targeted+confiável para as 3 do blocker.

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, 'migrations');
const REQUIRED = ['actor_referral_codes', 'identity_civil_confirmation_events', 'user_referral_links'];

const allSql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(MIGRATIONS, f), 'utf-8'))
  .join('\n');

const failures = [];
for (const t of REQUIRED) {
  if (!new RegExp(`ALTER TABLE\\s+${t}\\s+FORCE ROW LEVEL SECURITY`, 'i').test(allSql)) {
    failures.push(`${t}: sem ALTER TABLE … FORCE ROW LEVEL SECURITY em nenhuma migration — blocker do preflight RLS-live (§1.4 runbook).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [rls-enable-implies-force]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(`GATE OK [rls-enable-implies-force] — as 3 tabelas referral/civil (${REQUIRED.join(', ')}) têm FORCE ROW LEVEL SECURITY em migration. Blocker do preflight RLS-live fechado (a verificação geral RLS+FORCE=0-gaps fica no preflight live-DB).`);
