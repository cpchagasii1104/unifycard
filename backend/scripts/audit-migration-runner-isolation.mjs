#!/usr/bin/env node
// Gate estrutural — F-MIGRATION-RUNNER-TEST-HOOK-ISOLATION-CLOSURE.
// Vigia a pureza do runner PRODUTIVO de migrations e o isolamento do tooling
// test-only (achado Yala: MIGRATION_STOP_BEFORE no runner produtivo permitia
// schema PARCIAL com exit 0 sob NODE_ENV=production).
//
// Invariantes:
//   1. core/db/migrate.ts NÃO possui stop/limit/skip por variável de ambiente;
//   2. sucesso total só é declarado com pending final = 0 (verificação
//      fail-closed DEPOIS da execução; mensagem única e posterior à checagem);
//   3. preparação histórica vive SÓ em src/scripts/test-support/ com guardas
//      simultâneas (NODE_ENV=test · EXPECTED_DATABASE_NAME · current_database
//      · recusa de unificard_dev · target por FILENAME EXATO, sem localeCompare);
//   4. o e2e de backfill usa o tooling test-only na preparação E o runner
//      produtivo REAL na etapa final;
//   5. as provas operacionais P1–P10 existem como e2e permanente.
//
// Análise comment-stripped (tokens em comentário não satisfazem nem violam).
// Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SRC = join(process.cwd(), 'src');

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
let closed = 0;
function check(surface, ok, failMsg) {
  if (ok) { closed++; } else { failures.push(`${surface}: ${failMsg}`); }
}

const read = (p) => (existsSync(p) ? stripComments(readFileSync(p, 'utf-8')) : '');

const migrate = read(join(SRC, 'core/db/migrate.ts'));
const core = read(join(SRC, 'core/db/migration-runner-core.ts'));
const helper = read(join(SRC, 'scripts/test-support/apply-migrations-before-for-test.ts'));
const backfillE2e = read(join(SRC, 'scripts/validate-pipeline-e2e-media-migration-backfill-legacy.ts'));
const isoE2e = read(join(SRC, 'scripts/validate-pipeline-e2e-migration-runner-isolation.ts'));

const PROD_SUCCESS = 'Todas as migrações pendentes foram EXECUTADAS com sucesso!';

// 1 — runner produtivo SEM mecanismo de truncamento (nenhuma env de corte).
check('runner:no-truncation-hook',
  migrate.length > 0 &&
  !/MIGRATION_STOP_BEFORE|MIGRATION_STOP_AFTER|MIGRATION_LIMIT|stopBefore|stopAfter|--before=/.test(migrate),
  'mecanismo de truncamento (stop/limit/skip por env) reapareceu no runner PRODUTIVO core/db/migrate.ts — schema parcial com exit 0 (achado Yala).');

// 1b — primitivas compartilhadas também não leem env de corte.
check('runner:core-no-truncation-env',
  core.length > 0 && !/MIGRATION_STOP_BEFORE|MIGRATION_LIMIT|STOP_AFTER/.test(core),
  'migration-runner-core passou a interpretar variável de truncamento (proibido).');

// 2 — sucesso total SÓ com pending final = 0 (verificação fail-closed pós-execução).
const pendingCheckIdx = migrate.indexOf('AINDA PENDENTES após a execução');
const successIdx = migrate.indexOf(PROD_SUCCESS);
const successCount = migrate.split(PROD_SUCCESS).length - 1;
check('runner:success-requires-zero-pending',
  pendingCheckIdx > -1 &&
  /stillPending\.length > 0/.test(migrate) &&
  /stillPending[\s\S]{0,300}?process\.exit\(1\)/.test(migrate) &&
  successCount === 1 && successIdx > pendingCheckIdx,
  'mensagem de sucesso total deixou de depender de pending final = 0 (duplicada, antecipada ou checagem removida) — deploy parcial declarável como sucesso.');

// 3 — tooling test-only existe FORA do caminho produtivo, com guardas simultâneas.
check('test-support:exists-outside-prod-path',
  helper.length > 0,
  'src/scripts/test-support/apply-migrations-before-for-test.ts desapareceu (preparação histórica voltaria a tentar viver no runner produtivo).');
check('test-support:requires-node-env-test',
  /process\.env\.NODE_ENV !== 'test'/.test(helper) && /TEST_ENV_REQUIRED/.test(helper),
  'helper test-only deixou de exigir NODE_ENV=test (executável em produção).');
check('test-support:requires-expected-db',
  /EXPECTED_DATABASE_NAME/.test(helper) && /EXPECTED_DB_REQUIRED/.test(helper) &&
  /current_database\(\)/.test(helper) && /DB_NAME_MISMATCH/.test(helper),
  'helper test-only deixou de validar EXPECTED_DATABASE_NAME contra current_database().');
check('test-support:refuses-dev-db',
  /expected === 'unificard_dev'/.test(helper) && /currentDb === 'unificard_dev'/.test(helper) &&
  /DEV_DB_REFUSED/.test(helper) && /EPHEMERAL_NAME_REQUIRED/.test(helper),
  'helper test-only deixou de recusar unificard_dev/banco não-efêmero (dupla guarda nome+current_database exigida).');
check('test-support:exact-target-only',
  /m\.filename === target/.test(helper) && !/localeCompare/.test(helper) &&
  /TARGET_NOT_FOUND/.test(helper) && /TARGET_MALFORMED/.test(helper) && /TARGET_REQUIRED/.test(helper) &&
  /TARGET_AMBIGUOUS/.test(helper) && /TARGET_ALREADY_APPLIED/.test(helper) && /POSTERIOR_ALREADY_APPLIED/.test(helper),
  'helper test-only afrouxou a validação do target (igualdade exata trocada por localeCompare/prefixo, ou recusas fail-closed removidas).');
check('test-support:unambiguous-message',
  /TEST DATABASE PREPARED BEFORE/.test(helper) && !helper.includes(PROD_SUCCESS),
  'helper test-only perdeu a mensagem inequívoca de preparação parcial ou passou a imitar o sucesso total do runner produtivo.');

// 4 — e2e de backfill: prepara com tooling test-only e FINALIZA com o runner produtivo real.
check('backfill-e2e:test-tool-prepare-prod-finish',
  /apply-migrations-before-for-test/.test(backfillE2e) &&
  /src\/core\/db\/migrate\.ts/.test(backfillE2e),
  'e2e de backfill deixou de preparar via tooling test-only e/ou de finalizar pelo runner PRODUTIVO real.');

// 5 — provas operacionais P1–P10 existem como e2e permanente.
check('runner-iso-e2e:p1-p10-present',
  isoE2e.length > 0 &&
  /MIGRATION_STOP_BEFORE/.test(isoE2e) &&
  ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'].every((p) => isoE2e.includes(`${p} `)) &&
  /TEST_ENV_REQUIRED/.test(isoE2e) && /DEV_DB_REFUSED/.test(isoE2e) && /TARGET_NOT_FOUND/.test(isoE2e),
  'e2e permanente de isolamento do runner (P1–P10) sumiu ou perdeu provas obrigatórias.');

console.log(`[migration-runner-isolation] CLOSED=${closed} FAILURES=${failures.length}`);
if (failures.length > 0) {
  failures.forEach((f) => console.error(`  ❌ ${f}`));
  console.error('GATE FAIL [migration-runner-isolation] — runner produtivo deve aplicar SEMPRE todas as pendentes; preparação histórica é test-only.');
  process.exit(1);
}
console.log('GATE OK [migration-runner-isolation] — runner produtivo sem truncamento; tooling test-only isolado e fail-closed.');
