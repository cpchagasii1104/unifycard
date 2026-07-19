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

// 5. can_view_financial é decidida SÓ pelas fachadas canônicas (pós-cutover F3/F4).
//    Qualquer módulo NOVO consultando a coluna por conta própria = decisor paralelo → MORDE.
const ALLOW = new Set([
  'src/core/authorization/company-policy-registry.ts',
  'src/core/authorization/financial-read-authority.ts', // fachada TERMINAL (F3)
  'src/core/authorization/authorization.service.ts', // dispatch do policy registry (F3)
  'src/core/companies/companies.service.ts', // bootstrap SET_V1
  'src/core/companies/company-members.service.ts', // snapshot/zeragem na revogação
  'src/core/companies/company-membership-commands.service.ts', // comandos governados (F4)
  'src/core/companies/company-members.routes.ts', // allowlist tipada do PATCH grants (F4)
  'src/core/actor-capabilities/actor-capabilities.service.ts', // PROJEÇÃO (nunca decide — guard próprio)
]);
const walk = (dir, acc = []) => {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, acc);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) acc.push(rel);
  }
  return acc;
};
const walkEarly = walk;
const stripLineComments = (s) => s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
for (const f of walk('src')) {
  if (ALLOW.has(f) || f.startsWith('src/scripts/')) continue;
  if (stripLineComments(read(f)).includes('can_view_financial')) {
    fail(`decisor paralelo: ${f} consulta can_view_financial fora das fachadas canônicas (DECISION-0189)`);
  }
}

// 5b. F4 — LIFECYCLE CUTOVER: migration presente com DROP is_active + CHECK sem 'invited' +
//     triggers de exclusividade ATIVADOS; runtime SEM is_active de company_users; role/is_primary
//     mortos como autoridade; wildcard de scopes morto.
const MIG_F4 = 'migrations/20260719140000_company_membership_lifecycle_cutover.sql';
if (!existsSync(join(ROOT, MIG_F4))) fail(`migration F4 ausente: ${MIG_F4}`);
const migF4 = read(MIG_F4);
for (const needle of [
  'DROP COLUMN is_active',
  "CHECK (member_status IN ('active', 'suspended', 'revoked'))",
  'trg_actor_delegations_company_exclusivity',
  'trg_company_users_delegation_exclusivity',
  'membership_cutover_0189',
]) {
  if (!migF4.includes(needle)) fail(`migration F4 sem artefato obrigatório: ${needle}`);
}
{
  // is_active de company_users MORTO no runtime (src/ exceto scripts; heurística: arquivo que
  // menciona company_users não pode conter cu.is_active / "is_active = true" acoplado a company_users)
  for (const f of walkEarly('src')) {
    if (f.startsWith('src/scripts/')) continue;
    const src = read(f);
    if (!src.includes('company_users')) continue;
    if (/cu\.is_active|company_users[\s\S]{0,200}?\bis_active\b\s*=/.test(src)) {
      fail(`no-is_active violado: ${f} ainda decide/escreve company_users.is_active (F4 DROP)`);
    }
  }
  // role/is_primary como autoridade de empresa: padrões condenados não podem voltar (código, não comentário)
  const stripC = (s) => s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const authz = stripC(read('src/core/authorization/authorization.service.ts'));
  if (/is_primary\s*=\s*true|role\s*=\s*'admin'/.test(authz)) {
    fail("authorization.service reintroduziu is_primary/role='admin' como autoridade (§5)");
  }
  const compSvc = stripC(read('src/core/companies/companies.service.ts'));
  if (/can_manage_company\s+OR\s+cu\.role\s*=\s*'owner'|cu\.role\s*=\s*'owner'\)?\s*AS\s+can_manage/i.test(compSvc)) {
    fail("companies.service reintroduziu OR role='owner' na gestão (§5)");
  }
  // wildcard de scopes por role morto
  const membersSvc = stripC(read('src/core/companies/company-members.service.ts'));
  if (/getScopesForRole|\['\*'\]/.test(membersSvc)) {
    fail('company-members.service reintroduziu scopes por role / wildcard (§12)');
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

console.log('✅ audit-company-access-authority-foundation: DECISION-0189 íntegra (vocabulário v1.7, registry exaustivo, migrations F2+F4 com digest em sincronia, can_view_financial só nas fachadas, no-is_active, role/is_primary/wildcard mortos, DELETE físico morto, exclusividade ativada na F4, repositórios transaction-aware).');
