#!/usr/bin/env node
// Gate estrutural — DT-AUTH-RATE-LIMIT-FAIL-OPEN-SUBSTRATE-AUSENTE (2026-07-29).
// auth_rate_limit_logs nunca existiu; o serviço engolia o 42P01 resultante em silêncio e
// devolvia allowed:true sempre — login/register/check-cpf/check-referral/webauthn.verify/
// refresh (todos pré-autenticação, sem requirePermission na frente) ficaram sem proteção
// de força bruta desde a gênese, sem nenhum sinal de alarme.
//
// Invariantes vigiadas:
//   1. countByKey NÃO tem catch que retorna 0 sem logar antes (o silêncio original).
//   2. As queries usam attempted_at (snake_case, o nome real da coluna) — nunca attemptedAt
//      (identificador não-quotado que o Postgres dobraria para "attemptedat", violando
//      07_NOMENCLATURA_CANONICA.md).
//   3. A migration que cria auth_rate_limit_logs existe no disco.
//   4. Essa migration NÃO ativa RLS na tabela — decisão deliberada (serviço lê via pool
//      cru, sem GUC de tenant; RLS faria toda contagem voltar 0 outra vez, só que
//      invisível). Reabrir essa porta "consertando" com RLS reintroduz o fail-open.
//
// Análise comment-stripped (tokens em comentário não satisfazem nem violam).
// Integrado em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
let closed = 0;
function check(surface, ok, failMsg) {
  if (ok) { closed++; } else { failures.push(`${surface}: ${failMsg}`); }
}

const read = (p) => (existsSync(p) ? stripComments(readFileSync(p, 'utf-8')) : '');

const SERVICE_PATH = join(ROOT, 'src/core/rate-limiting/auth-rate-limit.service.ts');
const service = read(SERVICE_PATH);

// 1 — o catch de countByKey loga (canonicalLogger) ANTES de "return 0" — nunca mais silêncio.
const countByKeyIdx = service.indexOf('private async countByKey');
const recordAttemptIdx = service.indexOf('private async recordAttempt', countByKeyIdx > -1 ? countByKeyIdx + 1 : 0);
const countByKeyBody = countByKeyIdx > -1 && recordAttemptIdx > countByKeyIdx
  ? service.slice(countByKeyIdx, recordAttemptIdx)
  : '';
const loggerIdx = countByKeyBody.indexOf('canonicalLogger');
const lastReturnZeroIdx = countByKeyBody.lastIndexOf('return 0;');
check('service:catch-logs-before-fail-open',
  countByKeyBody.length > 0 && loggerIdx > -1 && lastReturnZeroIdx > -1 && loggerIdx < lastReturnZeroIdx,
  'countByKey voltou a ter um catch que retorna 0 sem chamar canonicalLogger antes — o silêncio original reapareceu.');

// 2 — nunca mais attemptedAt (identificador não-quotado dobra para minúsculas no Postgres).
check('service:no-attemptedAt-camelCase',
  !/attemptedAt/.test(service),
  'auth-rate-limit.service.ts voltou a referenciar "attemptedAt" (camelCase) — Postgres dobraria para "attemptedat", violando 07_NOMENCLATURA_CANONICA.md.');
check('service:uses-attempted-at-snake-case',
  /attempted_at/.test(service),
  'auth-rate-limit.service.ts deixou de referenciar a coluna real "attempted_at".');

// 3 — a migration que cria a tabela existe no disco.
const MIGRATIONS_DIR = join(ROOT, 'migrations');
const migrationFiles = existsSync(MIGRATIONS_DIR)
  ? readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
  : [];
const authRateLimitMigrationFile = migrationFiles.find((f) => /auth_rate_limit_logs/.test(f));
check('migration:auth-rate-limit-logs-exists',
  !!authRateLimitMigrationFile,
  'nenhuma migration criando auth_rate_limit_logs encontrada em migrations/ — o substrato sumiu.');

// 4 — a migration NÃO ativa RLS nessa tabela (decisão deliberada; RLS aqui reabriria o fail-open invisível).
const migrationBody = authRateLimitMigrationFile
  ? read(join(MIGRATIONS_DIR, authRateLimitMigrationFile))
  : '';
check('migration:no-rls-on-auth-rate-limit-logs',
  !authRateLimitMigrationFile || !/ROW LEVEL SECURITY/i.test(migrationBody),
  'a migration de auth_rate_limit_logs ativou RLS — isso faz countByKey (pool cru, sem GUC de tenant) voltar 0 sempre, reabrindo o fail-open de forma invisível (sem 42P01 para denunciar). Decisão de Clayton: sem RLS nesta tabela.');

console.log(`[auth-rate-limit-substrate] CLOSED=${closed} FAILURES=${failures.length}`);
if (failures.length > 0) {
  failures.forEach((f) => console.error(`  ❌ ${f}`));
  console.error('GATE FAIL [auth-rate-limit-substrate] — rate limit de auth precisa do substrato vivo, sem silêncio no fail-open, e sem RLS decorativo na tabela de log.');
  process.exit(1);
}
console.log('GATE OK [auth-rate-limit-substrate] — auth_rate_limit_logs existe, sem RLS (deliberado); countByKey loga antes de fail-open; colunas em attempted_at (snake_case), nunca attemptedAt.');
