#!/usr/bin/env node
// audit-company-access-authority-foundation.mjs — DECISION-0189 (F2) GUARD
//
// Verifica a FUNDAÇÃO da campanha F-COMPANY-ACCESS-AUTHORITY-FOUNDATION:
//   1. Vocabulário v1.7 presente (4 chaves novas) + errata create_events→can_create_events.
//   2. COMPANY_POLICY_REGISTRY EXAUSTIVO: toda PermissionKey do union classificada
//      (paridade estática permission-keys.ts × company-policy-registry.ts).
//   3. Migration 20260719120000 presente com colunas/tabelas/digest.
//   4. Digest do catálogo no CÓDIGO == digest materializado na MIGRATION (R16 — sem duplo SSOT).
//   5. DORMÊNCIA (até F3): nenhum runtime fora da allowlist decide por company_users.can_view_financial.
//   6. DELETE físico de membership morto (repository sem DELETE FROM company_users).
//   7. Repositórios de delegação aceitam client externo (dual-write atômica possível).
//
// Falha = exit 1 (integra run-regression-guards.mjs).

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const fail = (msg) => { console.error(`❌ [audit-company-access-authority-foundation] ${msg}`); process.exit(1); };
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// 1. Vocabulário v1.7
const pk = read('src/core/authorization/permission-keys.ts');
for (const key of ['company:manage_governance', 'company:manage_employees', 'company:manage_services', 'company:view_reports']) {
  if (!pk.includes(`'${key}'`)) fail(`PermissionKey nova ausente do mapa: ${key}`);
}
if (!/create_events:\s*'can_create_events'/.test(pk)) {
  fail(`errata R10 ausente: create_events deve mapear can_create_events (não can_publish_feed)`);
}

// 2. Exaustividade estática do registry
const registrySrc = read('src/core/authorization/company-policy-registry.ts');
const unionKeys = [...pk.matchAll(/^\s*\|\s*'([^']+)'/gm)].map((m) => m[1]);
if (unionKeys.length < 60) fail(`parse do union PermissionKey suspeito (${unionKeys.length} chaves)`);
const registryBody = registrySrc.split('COMPANY_POLICY_REGISTRY')[1] ?? '';
for (const key of unionKeys) {
  const safe = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[\\s{])('${safe}'|${safe.includes(':') ? `'${safe}'` : safe})\\s*:`, 'm');
  if (!re.test(registryBody)) fail(`PermissionKey "${key}" SEM classificação no COMPANY_POLICY_REGISTRY (R3)`);
}

// 3. Migration presente
const MIG = 'migrations/20260719120000_company_access_authority_foundation.sql';
if (!existsSync(join(ROOT, MIG))) fail(`migration ausente: ${MIG}`);
const mig = read(MIG);
for (const needle of [
  'can_view_financial', 'can_manage_members', 'can_publish_feed', 'can_create_events',
  'company_permission_catalog', 'company_permission_catalog_meta',
  'company_member_relationships', 'company_member_events',
  'fn_company_member_events_append_only', 'fn_company_membership_delegation_exclusivity',
]) {
  if (!mig.includes(needle)) fail(`migration sem artefato obrigatório: ${needle}`);
}
// exclusividade: função criada mas trigger NÃO ativado nesta migration (ativação = F4)
if (/CREATE TRIGGER\s+\S*exclusivity/i.test(mig)) {
  fail('trigger de exclusividade NÃO pode ser ativado na F2 (dual-write transitória) — ativação é F4');
}

// 4. Digest código == digest migration (R16)
const migDigest = mig.match(/VALUES \(1, '([0-9a-f]{64})'\)/)?.[1];
if (!migDigest) fail('digest do catálogo ausente na migration');
const tsx = spawnSync(
  'tsx',
  ['scripts/print-company-catalog-digest.ts'],
  { cwd: ROOT, shell: true, encoding: 'utf8', env: { ...process.env, PATH: `${join(ROOT, 'node_modules', '.bin')};${process.env.PATH}` } }
);
if (tsx.status !== 0) fail(`não foi possível computar o digest do código via tsx: ${tsx.stderr}`);
const codeDigest = tsx.stdout.trim().split(/\r?\n/).pop();
if (codeDigest !== migDigest) {
  fail(`digest divergente (código=${codeDigest} migration=${migDigest}) — catálogo mudou sem nova versão materializada (R16)`);
}

// 5. Dormência de can_view_financial como coluna decisória (até F3)
const ALLOW = new Set([
  'src/core/authorization/company-policy-registry.ts',
  'src/core/companies/companies.service.ts',
  'src/core/companies/company-members.service.ts',
]);
const walk = (dir, acc = []) => {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, acc);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) acc.push(rel);
  }
  return acc;
};
for (const f of walk('src')) {
  if (ALLOW.has(f) || f.startsWith('src/scripts/')) continue;
  const src = read(f);
  if (src.includes('can_view_financial')) {
    fail(`DORMÊNCIA violada: ${f} referencia can_view_financial antes do cutover F3`);
  }
}

// 6. DELETE físico de membership morto
const repo = read('src/core/companies/company-members.repository.ts');
if (/DELETE\s+FROM\s+company_users/i.test(repo)) {
  fail('DELETE físico de company_users reapareceu no repository (condenado — DECISION-0189 §12)');
}
const svc = read('src/core/companies/company-members.service.ts');
if (/DELETE\s+FROM\s+company_users/i.test(svc)) {
  fail('DELETE físico de company_users no service (condenado)');
}

// 7. Delegation repo transaction-aware
const del = read('src/core/actor-delegation/actor-delegation.repository.ts');
if (!/existingClient\?\:\s*TxQueryClient/.test(del)) {
  fail('actor-delegation.repository sem suporte a client externo (dual-write atômica impossível — B5)');
}

console.log('✅ audit-company-access-authority-foundation: fundação DECISION-0189 íntegra (vocabulário v1.7, registry exaustivo, migration+digest em sincronia, dormência preservada, DELETE físico morto, dual-write transaction-aware).');
