#!/usr/bin/env node
// Gate estrutural — REGRA DE AMBIENTE (docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md,
// corrigida 2026-07-30, commit 4060df0a2). A Lei manda declarar o alvo antes de qualquer
// CREATE/DROP DATABASE; até esta fatia, ZERO guard verificava isso — a Lei valia só de
// leitura. Achado que originou este guard: `reset-database-complete.ts` fazia dropDatabase()
// no valor cru de DATABASE_URL (default do .env = unificard_dev, o OFICIAL), sem confirmação,
// sem EXPECTED_DATABASE_NAME, sem nome proibido — o estopim exato que a Lei corrigida proíbe.
//
// Invariante: TODO artefato (.ps1 / .ts / .mjs) que cria ou dropa banco DECLARA o alvo via
// EXPECTED_DATABASE_NAME — direto, ou por CADEIA (o orquestrador spawna um script que declara
// um nível abaixo, ex.: run-migration-runner-isolation-ephemeral.ps1 → EXPECTED_DATABASE_NAME
// no env do spawn de migrate.ts dentro de validate-pipeline-e2e-migration-runner-isolation.ts).
// A exceção é reconhecida pela CADEIA REAL (segue o spawn), NUNCA por allowlist de nome de
// arquivo — este repo já perdeu allowlists por apodrecimento (ver DECISION-0194 no cartório).
//
// Análise comment-stripped (tokens em comentário não satisfazem nem violam).
// Integrado em validate:regression-guards.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const BACKEND_ROOT = process.cwd(); // guard roda com cwd=backend, mesmo padrão dos irmãos
const REPO_ROOT = join(BACKEND_ROOT, '..');

const stripJsComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// PowerShell: comentário é `#` até fim de linha. Heurística textual (mesmo tolerância dos
// guards irmãos) — não distingue `#` dentro de string, mas nenhum .ps1 deste repo usa `#`
// dentro de string na vizinhança de CREATE/DROP DATABASE (verificado nos 216 hits).
const stripPs1Comments = (s) => s.replace(/(^|[^`])#[^\n]*/g, '$1');

const failures = [];
let closed = 0;
function check(surface, ok, failMsg) {
  if (ok) { closed++; } else { failures.push(`${surface}: ${failMsg}`); }
}

const readSafe = (p) => (existsSync(p) ? readFileSync(p, 'utf-8') : null);

// ─── 1. .ps1 (backend/scripts + scripts/ na raiz) ──────────────────────────────────────────
function listPs1Files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.ps1')).map((f) => join(dir, f));
}

const ps1Files = [
  ...listPs1Files(join(BACKEND_ROOT, 'scripts')),
  ...listPs1Files(join(REPO_ROOT, 'scripts')),
];

// Extrai todo `npx tsx <arquivo.ts>` de um .ps1 (bruto, não comment-stripped — o caminho
// spawnado é sintaxe real, não comentário) para seguir a CADEIA.
function extractSpawnedTsFiles(ps1Raw) {
  const paths = [];
  const re = /npx\s+tsx\s+([^\s'"]+\.ts)/gi;
  let m;
  while ((m = re.exec(ps1Raw)) !== null) paths.push(m[1]);
  return paths;
}

// Um .ts spawnado "declara na cadeia" se, no PRÓPRIO corpo, ele passa EXPECTED_DATABASE_NAME
// como chave de env para um spawn ANINHADO (o padrão real de
// validate-pipeline-e2e-migration-runner-isolation.ts:64/79).
function chainDeclares(ps1Raw) {
  for (const tsRel of extractSpawnedTsFiles(ps1Raw)) {
    const tsPath = join(BACKEND_ROOT, tsRel);
    const tsRaw = readSafe(tsPath);
    if (!tsRaw) continue;
    const tsStripped = stripJsComments(tsRaw);
    if (/EXPECTED_DATABASE_NAME\s*:/.test(tsStripped)) return true;
  }
  return false;
}

let ps1WithCreate = 0;
let ps1Declared = 0;
let ps1ChainDeclared = 0;
const ps1Undeclared = [];

for (const p of ps1Files) {
  const raw = readSafe(p);
  if (raw == null) continue;
  const stripped = stripPs1Comments(raw);
  if (!/CREATE\s+DATABASE\b/i.test(stripped)) continue; // não cria banco — fora do invariante

  ps1WithCreate++;
  if (/\$env:EXPECTED_DATABASE_NAME\b/.test(stripped)) {
    ps1Declared++;
    continue;
  }
  if (chainDeclares(raw)) {
    ps1ChainDeclared++;
    continue;
  }
  ps1Undeclared.push(p);
}

check('ps1:all-database-creators-declare-target',
  ps1Undeclared.length === 0,
  `${ps1Undeclared.length} harness(es) .ps1 criam banco sem declarar EXPECTED_DATABASE_NAME (direto ou por cadeia real de spawn): ${ps1Undeclared.join(', ')}`);

console.log(`[environment-rule] .ps1 com CREATE DATABASE: ${ps1WithCreate} (declaram direto: ${ps1Declared} · por cadeia: ${ps1ChainDeclared})`);

// ─── 2. .ts / .mjs (backend/scripts + backend/src/scripts) ────────────────────────────────
// Guards (audit-*.mjs) são EXCLUÍDOS: eles referenciam "CREATE DATABASE" como STRING de
// detecção (ex.: regex /CREATE DATABASE/i checando OUTRO arquivo), não como capacidade
// própria de conectar e criar banco — mesma convenção de papel que audit-guard-coverage-
// manifest.mjs já usa pra distinguir guard de script operacional (prefixo audit-).
function listScriptFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => (f.endsWith('.ts') || f.endsWith('.mjs')) && !f.startsWith('audit-'))
    .map((f) => join(dir, f));
}

const scriptFiles = [
  ...listScriptFiles(join(BACKEND_ROOT, 'scripts')),
  ...listScriptFiles(join(BACKEND_ROOT, 'src/scripts')),
];

let scriptsWithCreate = 0;
const scriptsUndeclared = [];

for (const p of scriptFiles) {
  const raw = readSafe(p);
  if (raw == null) continue;
  const stripped = stripJsComments(raw);
  if (!/CREATE\s+DATABASE\b/i.test(stripped)) continue;

  scriptsWithCreate++;
  if (!/EXPECTED_DATABASE_NAME/.test(stripped)) {
    scriptsUndeclared.push(p);
  }
}

check('scripts:all-database-creators-declare-target',
  scriptsUndeclared.length === 0,
  `${scriptsUndeclared.length} script(s) .ts/.mjs criam banco sem referenciar EXPECTED_DATABASE_NAME: ${scriptsUndeclared.join(', ')}`);

console.log(`[environment-rule] .ts/.mjs (fora de audit-*) com CREATE DATABASE: ${scriptsWithCreate}`);

// ─── 3. reset-database-complete.ts mantém a recusa fail-closed (Tarefa A) ──────────────────
const resetPath = join(BACKEND_ROOT, 'src/scripts/reset-database-complete.ts');
const resetRaw = readSafe(resetPath);
if (resetRaw == null) {
  failures.push('reset-database-complete.ts: arquivo desapareceu — recusa não pode ser verificada.');
} else {
  const resetStripped = stripJsComments(resetRaw);
  check('reset-database-complete:imports-official-database-name',
    /import\s*\{[^}]*OFFICIAL_DATABASE_NAME[^}]*\}\s*from\s*['"].*official-database['"]/.test(resetStripped),
    'reset-database-complete.ts deixou de importar OFFICIAL_DATABASE_NAME de core/database/official-database (autoridade reaproveitada, não deve ser reinventada).');
  check('reset-database-complete:refuses-official-before-connect',
    /if\s*\(\s*databaseName\s*===\s*OFFICIAL_DATABASE_NAME\s*\)\s*\{[\s\S]{0,800}?process\.exit\(1\)/.test(resetStripped),
    'reset-database-complete.ts perdeu (ou desativou) a recusa fail-closed contra o banco oficial — comparação real ausente ou não alcançável.');
  check('reset-database-complete:refusal-before-superuser-connect',
    (() => {
      const refusalIdx = resetStripped.indexOf('databaseName === OFFICIAL_DATABASE_NAME');
      const callSiteIdx = resetStripped.indexOf('adminClient = await connectAsSuperuser(config)');
      return refusalIdx > -1 && callSiteIdx > -1 && refusalIdx < callSiteIdx;
    })(),
    'a recusa não roda mais ANTES da chamada real a connectAsSuperuser(config) — poderia conectar antes de recusar.');
}

console.log(`[environment-rule-enforcement] CLOSED=${closed} FAILURES=${failures.length}`);
if (failures.length > 0) {
  failures.forEach((f) => console.error(`  ❌ ${f}`));
  console.error('GATE FAIL [environment-rule-enforcement] — a REGRA DE AMBIENTE exige alvo declarado antes de criar/dropar banco; ausência de declaração é RECUSA, não permissão.');
  process.exit(1);
}
console.log('GATE OK [environment-rule-enforcement] — todo criador/dropador de banco (.ps1 direto ou por cadeia real; .ts/.mjs fora de audit-*) declara EXPECTED_DATABASE_NAME; reset-database-complete.ts recusa o banco oficial antes de conectar.');
