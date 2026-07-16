#!/usr/bin/env node
// audit-b-city-regional-treasury-grant-substrate-mutations.mjs — HARNESS de mutações do guard 187 (DECISION-0185).
// Para cada vetor HOSTIL: aplica uma mutação cirúrgica no material, roda o guard e exige que ele MORDA (exit!=0);
// depois RESTAURA o arquivo byte-a-byte. Controles BENIGNOS: o guard deve continuar passando. Ao final: resíduo
// zero (todos os arquivos idênticos ao original). NUNCA deixa arquivo mutado (restore em finally). Não toca DB.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = {
  MIG: resolve(ROOT, 'migrations/20260716140000_regional_treasury_authority_grant_substrate.sql'),
  TYPES: resolve(ROOT, 'src/modules/authority/actor-capability-grant.types.ts'),
  RUNNER: resolve(ROOT, 'scripts/run-regression-guards.mjs'),
};
const ORIG = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, readFileSync(p, 'utf8')]));
const fails = [];
const note = (m) => fails.push(m);

const guardPasses = () => {
  try { execSync('node scripts/audit-b-city-regional-treasury-grant-substrate.mjs', { cwd: ROOT, stdio: 'pipe' }); return true; }
  catch { return false; }
};
const restoreAll = () => { for (const [k, p] of Object.entries(P)) writeFileSync(p, ORIG[k]); };

// mutação hostil: substitui `from`→`to` em fileKey; guard DEVE morder; restaura.
function expectBite(label, fileKey, from, to) {
  const c = ORIG[fileKey];
  if (!c.includes(from)) { note(`${label}: ÂNCORA não encontrada (harness inválido)`); return; }
  try { writeFileSync(P[fileKey], c.replace(from, to)); if (guardPasses()) note(`${label}: guard NÃO mordeu a mutação hostil`); }
  finally { writeFileSync(P[fileKey], ORIG[fileKey]); }
}
// controle benigno: mutação inócua; guard DEVE continuar passando; restaura.
function expectNoBite(label, fileKey, from, to) {
  const c = ORIG[fileKey];
  if (!c.includes(from)) { note(`${label}: ÂNCORA não encontrada (harness inválido)`); return; }
  try { writeFileSync(P[fileKey], c.replace(from, to)); if (!guardPasses()) note(`${label}: guard mordeu um controle BENIGNO (falso positivo)`); }
  finally { writeFileSync(P[fileKey], ORIG[fileKey]); }
}

// 0 · sanidade: material real passa
if (!guardPasses()) note('V0: guard não passa no material REAL (antes de qualquer mutação)');

// ── HOSTIS (guard deve morder) ──
expectBite('V1 scope_type sem regional_treasury', 'MIG',
  "IN ('actor', 'territory', 'regional_treasury'));", "IN ('actor', 'territory'));");
expectBite('V2 scope_type alias city_treasury', 'MIG',
  "IN ('actor', 'territory', 'regional_treasury'));", "IN ('actor', 'territory', 'regional_treasury', 'city_treasury'));");
expectBite('V3 shape regional_treasury tenant NULL', 'MIG',
  "= 'regional_treasury'\n      AND tenant_id IS NOT NULL", "= 'regional_treasury'\n      AND tenant_id IS NULL");
expectBite('V4 nonfinancial volta a ser incondicional', 'MIG',
  "scope_type NOT IN ('actor', 'territory')\n    OR capability_key IN (", "capability_key IN (");
expectBite('V5 nonfinancial ganha treasury:', 'MIG',
  "'service_order:view',\n      'territory:create_neighborhood',", "'service_order:view',\n      'treasury:regional_policy_manage',\n      'territory:create_neighborhood',");
expectBite('V6 chk regional com 3a key', 'MIG',
  "scope_type <> 'regional_treasury'\n    OR capability_key IN (\n      'treasury:regional_policy_manage',\n      'treasury:regional_fund_activation_manage'\n    )",
  "scope_type <> 'regional_treasury'\n    OR capability_key IN (\n      'treasury:regional_policy_manage',\n      'treasury:regional_fund_activation_manage',\n      'treasury:regional_other_manage'\n    )");
expectBite('V7 chk regional via LIKE prefixo', 'MIG',
  "scope_type <> 'regional_treasury'\n    OR capability_key IN (\n      'treasury:regional_policy_manage',\n      'treasury:regional_fund_activation_manage'\n    )",
  "scope_type <> 'regional_treasury'\n    OR capability_key LIKE 'treasury:%'\n    OR capability_key IN (\n      'x'\n    )");
expectBite('V8 matriz sem ramo regional_treasury', 'MIG',
  "    OR\n    (\n      scope_type = 'regional_treasury'\n      AND capability_key IN (\n        'treasury:regional_policy_manage',\n        'treasury:regional_fund_activation_manage'\n      )\n    )\n  );",
  "\n  );");
expectBite('V9 unicidade regional sem tenant_id', 'MIG',
  "(tenant_id, grantee_actor_id, capability_key, scope_city_id)\n  WHERE scope_type = 'regional_treasury'",
  "(grantee_actor_id, capability_key, scope_city_id)\n  WHERE scope_type = 'regional_treasury'");
expectBite('V10 types REGIONAL_TREASURY_CAPABILITY_KEYS com 3a key', 'TYPES',
  "'treasury:regional_policy_manage',\n  'treasury:regional_fund_activation_manage',\n] as const;",
  "'treasury:regional_policy_manage',\n  'treasury:regional_fund_activation_manage',\n  'treasury:regional_other_manage',\n] as const;");
expectBite('V11 types CapabilityGrantScopeType sem regional_treasury', 'TYPES',
  "CapabilityGrantScopeType = 'actor' | 'territory' | 'regional_treasury';",
  "CapabilityGrantScopeType = 'actor' | 'territory';");
expectBite('V12 types startsWith(treasury:) como autoridade', 'TYPES',
  "export function isRegionalTreasuryCapabilityKey(key: string): key is RegionalTreasuryCapabilityKey {\n  return REGIONAL_TREASURY_SET.has(key);",
  "export function isRegionalTreasuryCapabilityKey(key: string): key is RegionalTreasuryCapabilityKey {\n  return key.startsWith('treasury:') || REGIONAL_TREASURY_SET.has(key);");
expectBite('V13 runner sem o guard 187', 'RUNNER',
  ',\n  "node scripts/audit-b-city-regional-treasury-grant-substrate.mjs"', "");

// ── BENIGNOS (guard deve continuar passando) ──
expectNoBite('B1 comentário --  alterado (comment-aware)', 'MIG',
  "-- A. SCOPE TYPE: vocabulario fechado", "-- A. SCOPE TYPE (comentario alterado): vocabulario fechado");
expectNoBite('B2 linha em branco extra inócua', 'MIG',
  "BEGIN;\n\n-- ", "BEGIN;\n\n\n-- ");

// ── RESÍDUO ZERO ──
restoreAll();
for (const [k, p] of Object.entries(P)) {
  if (readFileSync(p, 'utf8') !== ORIG[k]) note(`RESÍDUO: ${k} não restaurado byte-a-byte`);
}
if (!guardPasses()) note('PÓS: guard não passa após restauração (resíduo/corrupção)');

if (fails.length) {
  console.error('\nGATE FAIL [b-city-regional-treasury-grant-substrate-mutations]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [b-city-regional-treasury-grant-substrate-mutations] — 13 vetores hostis mordidos + 2 controles benignos passam; material restaurado byte-a-byte (resíduo zero).');
