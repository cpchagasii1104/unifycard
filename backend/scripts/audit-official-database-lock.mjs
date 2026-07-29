#!/usr/bin/env node
// Gate estrutural — TRAVA DO BANCO OFICIAL (DECISION Clayton 2026-07-29).
// unificard_dev é o banco oficial; unificard_local foi aposentado. Achado que originou
// este guard: a ausência de EXPECTED_DATABASE_NAME era tratada como PERMISSÃO (o guard
// antigo em migrate.ts só comparava quando a env var estava definida — sem ela, nenhuma
// checagem rodava e o migrator passava contra QUALQUER banco, inclusive unificard_local).
//
// Invariantes vigiadas:
//   1. src/core/database/official-database.ts declara OFFICIAL_DATABASE_NAME='unificard_dev'
//      versionado, e resolveExpectedDatabaseName() SEMPRE resolve para algo (env || oficial —
//      nunca undefined/vazio).
//   2. assertOfficialDatabaseOrDie compara current_database() contra o resolvido de forma
//      INCONDICIONAL (não atrás de `if (expected)` — ausência de env NÃO pula a checagem) e
//      aborta com process.exit(2) em divergência.
//   3. migrate.ts usa esse assert único (não reintroduziu comparação local condicionada à
//      presença da env var — a doença original).
//   4. BOOT.ts (boot da aplicação) também chama o mesmo assert — a regra é aplicada nos
//      dois pontos, não só no migrator.
//   5. scripts/setup-local-demo-db.mjs (a porta deliberada que recriava unificard_local,
//      banco aposentado por decisão de Clayton 2026-07-29) está CONTIDO: comment-stripped,
//      o código REAL não pode conter CREATE DATABASE, DROP DATABASE, spawnSync nem
//      referência a src/core/db/migrate.ts — só a recusa incondicional (refuseAndExit()
//      chamada no top-level, process.exit(1) dentro dela).
//
// Análise comment-stripped (tokens em comentário não satisfazem nem violam).
// Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
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

const officialDb = read(join(ROOT, 'src/core/database/official-database.ts'));
const migrate = read(join(ROOT, 'src/core/db/migrate.ts'));
const boot = read(join(ROOT, 'BOOT.ts'));
const localDemoSetup = read(join(ROOT, 'scripts/setup-local-demo-db.mjs'));

// 1 — declaração versionada do banco oficial.
check('official-database:constant-declared',
  /export const OFFICIAL_DATABASE_NAME\s*=\s*'unificard_dev'/.test(officialDb),
  'OFFICIAL_DATABASE_NAME=\'unificard_dev\' sumiu ou mudou de valor sem decisão nova.');

// 2 — resolver sempre retorna algo: env vence, ausência cai no oficial (nunca undefined).
check('official-database:resolver-fails-closed',
  /process\.env\.EXPECTED_DATABASE_NAME\s*\|\|\s*OFFICIAL_DATABASE_NAME/.test(officialDb),
  'resolveExpectedDatabaseName() deixou de garantir fallback fail-closed (env || OFFICIAL_DATABASE_NAME).');

// 3 — a comparação é INCONDICIONAL: current !== expected roda sempre, não atrás de `if (expected)`.
check('official-database:assert-unconditional',
  /const expected = resolveExpectedDatabaseName\(\)/.test(officialDb) &&
  /if\s*\(current !== expected\)/.test(officialDb) &&
  !/if\s*\(expected\s*&&/.test(officialDb),
  'a comparação voltou a ficar condicionada à presença de EXPECTED_DATABASE_NAME (a doença original: ausência de env = sem checagem).');

// 4 — abort real em divergência.
check('official-database:aborts-on-mismatch',
  /if\s*\(current !== expected\)[\s\S]{0,200}?process\.exit\(2\)/.test(officialDb),
  'divergência de banco deixou de abortar com process.exit(2).');

// 5 — migrate.ts usa o assert único, não reintroduziu checagem local condicionada a `if (expected &&`.
check('migrate:uses-shared-assert',
  /assertOfficialDatabaseOrDie/.test(migrate) &&
  /import\(['"]\.\.\/database\/official-database['"]\)/.test(migrate),
  'migrate.ts deixou de importar/usar assertOfficialDatabaseOrDie de official-database.ts.');
check('migrate:no-local-permissive-guard',
  !/if\s*\(expected\s*&&\s*expected !== targetDbName\)/.test(migrate),
  'migrate.ts reintroduziu a checagem local antiga, condicionada à presença de EXPECTED_DATABASE_NAME (ausência voltaria a ser permissão).');

// 6 — BOOT.ts (boot da aplicação) também aplica a mesma trava.
check('boot:uses-shared-assert',
  /assertOfficialDatabaseOrDie/.test(boot) &&
  /import\(['"]\.\/src\/core\/database\/official-database['"]\)/.test(boot),
  'BOOT.ts deixou de chamar assertOfficialDatabaseOrDie no boot da aplicação — a trava voltaria a proteger só o migrator.');

// 7 — setup-local-demo-db.mjs recusa incondicionalmente, ANTES de qualquer código real.
check('local-demo-setup:refuses-unconditionally',
  /function refuseAndExit\(\)/.test(localDemoSetup) &&
  /process\.exit\(1\)/.test(localDemoSetup) &&
  /^refuseAndExit\(\);/m.test(localDemoSetup),
  'setup-local-demo-db.mjs deixou de chamar refuseAndExit() incondicionalmente no top-level — a recusa pode ter virado condicional.');

// 8/9/10 — nenhuma capacidade REAL (fora de comentário) de criar/dropar banco ou spawnar o migrator.
check('local-demo-setup:no-create-database-capability',
  !/CREATE DATABASE/i.test(localDemoSetup),
  'setup-local-demo-db.mjs voltou a ter CREATE DATABASE em código real (fora de comentário) — a porta reabriu.');
check('local-demo-setup:no-drop-database-capability',
  !/DROP DATABASE/i.test(localDemoSetup),
  'setup-local-demo-db.mjs voltou a ter DROP DATABASE em código real (fora de comentário) — a porta reabriu.');
check('local-demo-setup:no-migrate-spawn-capability',
  !/spawnSync/.test(localDemoSetup) && !/core\/db\/migrate\.ts/.test(localDemoSetup),
  'setup-local-demo-db.mjs voltou a spawnar o runner de migrations em código real (fora de comentário) — a porta reabriu.');

console.log(`[official-database-lock] CLOSED=${closed} FAILURES=${failures.length}`);
if (failures.length > 0) {
  failures.forEach((f) => console.error(`  ❌ ${f}`));
  console.error('GATE FAIL [official-database-lock] — ausência de EXPECTED_DATABASE_NAME deve SEMPRE recair sobre OFFICIAL_DATABASE_NAME, nos dois pontos (migrate + boot), nunca pular a checagem.');
  process.exit(1);
}
console.log('GATE OK [official-database-lock] — banco oficial (unificard_dev) travado em migrate.ts e BOOT.ts; ausência de EXPECTED_DATABASE_NAME é RECUSA, não permissão; comparação sempre incondicional contra current_database().');
