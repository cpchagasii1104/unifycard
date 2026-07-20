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

// 4. Digest código == digest migration da VERSÃO CORRENTE (R16).
// DECISION-0189B D4: o catálogo evoluiu para v2 (+ interact_feed), materializado em
// 20260719200000. O digest do código (version-agnóstico nas linhas) é comparado com o da
// migration que materializa a VERSÃO CORRENTE do catálogo — nunca com uma versão antiga.
const catalogVersion = Number(registrySrc.match(/COMPANY_PERMISSION_CATALOG_VERSION\s*=\s*(\d+)/)?.[1] ?? '1');
const CATALOG_MIGRATIONS = [
  MIG,
  'migrations/20260719200000_company_interact_feed_authority.sql',
];
let migDigest;
for (const m of CATALOG_MIGRATIONS) {
  if (!existsSync(join(ROOT, m))) continue;
  const d = read(m).match(new RegExp(`VALUES \\(${catalogVersion}, '([0-9a-f]{64})'\\)`))?.[1];
  if (d) { migDigest = d; break; }
}
if (!migDigest) fail(`digest do catálogo v${catalogVersion} não materializado em nenhuma migration de catálogo`);
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
  'src/core/companies/company-access-invitations.service.ts', // writer canônico do aceite (F5 — grants pelas linhas do catálogo)
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

// 5c. F5 — CONVITE/ACEITE: migration + invariantes de token/idempotência/imutabilidade.
const MIG_F5 = 'migrations/20260719160000_company_access_invitations.sql';
if (!existsSync(join(ROOT, MIG_F5))) fail(`migration F5 ausente: ${MIG_F5}`);
const migF5 = read(MIG_F5);
for (const needle of [
  'company_access_invitations', 'company_access_invitation_permissions',
  'chk_cai_token_hash', 'uq_cai_idempotency', 'uq_cai_pending_per_target',
  'chk_cai_no_self_invite', 'fn_company_invitation_permissions_immutable',
]) {
  if (!migF5.includes(needle)) fail(`migration F5 sem artefato obrigatório: ${needle}`);
}
{
  const inviteSvc = read('src/core/companies/company-access-invitations.service.ts');
  if (!/randomBytes\(32\)/.test(inviteSvc)) fail('token de convite deixou de ser 256-bit (randomBytes(32)) — R15');
  if (/console\.(log|info|warn|error)\([^)]*token/i.test(inviteSvc)) {
    fail('token de convite LOGADO no service (R15 — token nunca em log)');
  }
  if (!/timingSafeEqual/.test(inviteSvc)) fail('comparação de request_hash sem timingSafeEqual (R14)');
  // aceite: reentrada só de revoked
  if (!/member_status = 'revoked'\s*\n?\s*RETURNING/.test(inviteSvc) && !/AND member_status = 'revoked'/.test(inviteSvc)) {
    fail('aceite sem cláusula de reentrada EXCLUSIVA de revoked (R17)');
  }
}

// 5d. ETAPA C (DECISION-0189A §4 — Finding C): exclusividade concorrente. As DUAS trigger
//     functions adquirem a MESMA advisory lock (função auxiliar única, xact-level) ANTES do
//     check cross-table. Reintroduzir check sem lock (write-skew) MORDE.
const MIG_C = 'migrations/20260719180000_company_exclusivity_advisory_lock.sql';
if (!existsSync(join(ROOT, MIG_C))) fail(`migration Etapa C ausente: ${MIG_C}`);
const migC = read(MIG_C);
if (!/pg_advisory_xact_lock/.test(migC)) fail('lock de exclusividade não é xact-level');
if (/pg_advisory_lock\(/.test(migC)) fail('session-level advisory lock PROIBIDO na exclusividade (D6)');
for (const fn of ['fn_company_membership_delegation_exclusivity', 'fn_company_users_delegation_exclusivity']) {
  const start = migC.indexOf(fn);
  if (start < 0) fail(`migration Etapa C sem ${fn}`);
  const body = migC.slice(start, migC.indexOf('$$;', start));
  const lockIdx = body.indexOf('fn_company_relation_advisory_lock(');
  const checkIdx = body.indexOf('COUNT(*)');
  if (lockIdx < 0 || checkIdx < 0 || lockIdx > checkIdx) {
    fail(`${fn}: lock COMUM ausente ou DEPOIS do check cross-table (write-skew — Finding C)`);
  }
}
if ((migC.match(/fn_company_relation_advisory_lock\(/g) || []).length < 3) {
  fail('função de chave comum não usada pelos DOIS lados (algoritmos divergentes proibidos — D6)');
}

// 5e. DECISION-0189D — partição EXATA: manage_members (membro comum) × manage_governance
// (alvo/grant protegido). Sem fallback de can_manage_company/role/is_primary nos gates marcados.
// Estrutural (âncora + condição isolada), não dependente de nº de linha nem texto de mensagem.
{
  const inviteSvc2 = read('src/core/companies/company-access-invitations.service.ts');
  const cmdSvc = read('src/core/companies/company-membership-commands.service.ts');

  // condição de cada gate 0189D (isolada dentro dos parênteses do if imediatamente após a âncora)
  const gateConds = (src) => [...src.matchAll(/DECISION-0189D[\s\S]{0,320}?\n\s*if\s*\(([^)]*)\)/g)].map((m) => m[1]);
  const inviteGates = gateConds(inviteSvc2);
  if (inviteGates.length < 3) fail(`DECISION-0189D: <3 gates ancorados no ciclo de convite (${inviteGates.length}/3 — emissão/aceite/revogação)`);
  for (const cond of inviteGates) {
    if (/can_manage_company/.test(cond)) fail('DECISION-0189D: gate de convite reintroduziu fallback can_manage_company (OR)');
    if (/\brole\b|is_primary|is_active/.test(cond)) fail('DECISION-0189D: gate de convite infere autoridade por role/is_primary/is_active');
    if (!/can_manage_members/.test(cond)) fail('DECISION-0189D: gate de convite não decide por can_manage_members exato');
  }

  // ceiling: alvo COMUM não pode retornar por governança; âncora presente; protegido preservado.
  if (/caller\.can_manage_company\s*\)\s*return/.test(cmdSvc)) {
    fail('DECISION-0189D: assertAdministrationCeiling reintroduziu return de governança p/ alvo COMUM');
  }
  const cmdGates = gateConds(cmdSvc);
  if (cmdGates.length < 1) fail('DECISION-0189D: gate 0189D ausente em company-membership-commands (ceiling do alvo comum)');
  for (const cond of cmdGates) {
    if (/can_manage_company|\brole\b|is_primary|is_active/.test(cond)) fail('DECISION-0189D: ceiling do alvo comum infere autoridade indevida');
    if (!/can_manage_members/.test(cond)) fail('DECISION-0189D: ceiling do alvo comum não exige can_manage_members exato');
  }
  // partição do alvo PROTEGIDO preservada (governança, sem conjunção artificial com manage_members)
  if (!/hasProtected\(target\)[\s\S]{0,200}?!caller\.can_manage_company/.test(cmdSvc)) {
    fail('DECISION-0189D: partição do alvo protegido (governança exata) foi perdida');
  }
  // §1.3 AUTORIA ≠ AUTORIDADE: a rota de convite aceita MEMBERSHIP ATIVA como autoria (senão o
  // pre-gate canRepresentActor — que exige governança — sombrearia o membro fino). NÃO alargar
  // canRepresentActor globalmente; a separação vive SÓ no helper local do ciclo de convite.
  const inviteRoutes = read('src/core/companies/company-access-invitations.routes.ts');
  if (!/DECISION-0189D[\s\S]{0,1600}?member_status\s*=\s*'active'/.test(inviteRoutes)) {
    fail("DECISION-0189D §1.3: rota de convite não aceita membership ativa como autoria — membro fino (manage_members) fica sombreado por canRepresentActor");
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
