#!/usr/bin/env node
// audit-group-institutional-binding.mjs — Guard dedicado D9.1 (posição 188 do runner).
// DECISION-0186 (composição organizacional) + DECISION-0187 (Group Institutional Binding Contract).
// Congela o substrato group_institutional_bindings: casa ÚNICA (sem segunda tabela/coluna/writer),
// ancoragem groups.id×actors.id com coerência tenant COMPOSTA, unicidade ATIVA com tenant, parent
// só page|group-raiz (user/channel/system/legados NUNCA), self-link/cadeia/ciclo proibidos,
// lifecycle active→retired TERMINAL (DELETE proibido; campos decisórios imutáveis), autoridade
// DUAL no service (nunca um lado só; nunca payload; infra-error nunca vira false), escrita SÓ
// pelas 3 fns SECURITY DEFINER governadas (search_path pinado; EXECUTE governado), RLS FORCE de
// nascença, idempotência fingerprint fail-closed, não-herança, caps 1/3 intactos, organization_*
// morto, Bank fora, zero superfície pública.
// Prova de CONTRATO (não presença). Cada trava emite MARCADOR [X] próprio. Fail-closed (exit!=0).
// Comment-aware (SQL -- e TS //). Localiza migration/writers por CONTEÚDO (não só nome de arquivo).
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(p, 'utf8');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const norm = (p) => p.split(sep).join('/');
const fails = [];
const note = (marker, m) => fails.push(`[${marker}] ${m}`);

// ── localizar a MIGRATION da casa por CONTEÚDO (CREATE TABLE group_institutional_bindings) ──
const MIG_DIR = resolve(ROOT, 'migrations');
const sqlFiles = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql'));
const migMatches = [];
for (const f of sqlFiles) {
  const raw = read(join(MIG_DIR, f));
  if (/CREATE TABLE\s+group_institutional_bindings/i.test(stripSql(raw))) migMatches.push(f);
}
if (migMatches.length === 0) { note('SECOND-TABLE', 'migration com CREATE TABLE group_institutional_bindings AUSENTE'); }
if (migMatches.length > 1) { note('SECOND-TABLE', `múltiplas migrations criam a casa: ${migMatches.join(', ')}`); }
const MIG_FILE = migMatches[0] ?? '';
const MIG_RAW = MIG_FILE ? read(join(MIG_DIR, MIG_FILE)) : '';
const M = stripSql(MIG_RAW);

// ── superfícies TS do binding (service/repository/types) ──
const SVC_P = 'src/modules/groups/group-institutional-binding.service.ts';
const REPO_P = 'src/modules/groups/group-institutional-binding.repository.ts';
const TYPES_P = 'src/modules/groups/group-institutional-binding.types.ts';
const mustRead = (p, marker) => {
  const abs = resolve(ROOT, p);
  if (!existsSync(abs)) { note(marker, `arquivo material ausente: ${p}`); return { raw: '', s: '' }; }
  const raw = read(abs);
  return { raw, s: stripTs(raw) };
};
const SVC = mustRead(SVC_P, 'SINGLE-SIDED-AUTHORITY');
const REPO = mustRead(REPO_P, 'SECOND-WRITER');
const TYPES = mustRead(TYPES_P, 'SECOND-WRITER');
const GROUPS_SVC = mustRead('src/modules/groups/groups.service.ts', 'CAPS-TAMPERED');
const POLICY = mustRead('src/modules/groups/policies/group-creation-policy.ts', 'CAPS-TAMPERED');
const ORG_ROUTES = mustRead('src/modules/organization/organization.routes.ts', 'BLANKET-501');
const RUNNER = mustRead('scripts/run-regression-guards.mjs', 'RUNNER-WIRING');

// ── walk do módulo groups (superfície onde mutations plantam fixtures) ──
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|mts|cts)$/.test(e) && !/\.test\.|\.spec\./.test(e)) out.push(p);
  }
  return out;
}
const GROUPS_FILES = walk(resolve(ROOT, 'src/modules/groups')).map((p) => ({ p: norm(p), s: stripTs(read(p)) }));
const BINDING_FILES = GROUPS_FILES.filter((f) => /group-institutional-binding/.test(f.p));

// helper: extrai corpo aproximado de uma função SQL da migration
const fnBody = (name) => {
  const re = new RegExp(`CREATE FUNCTION ${name}[\\s\\S]*?\\$func\\$([\\s\\S]*?)\\$func\\$`, 'i');
  const m = MIG_RAW.match(re);
  return m ? m[1] : '';
};
const FN_BIND = fnBody('fn_bind_group_to_institution');
const FN_RETIRE = fnBody('fn_retire_group_institutional_binding');
const FN_REPARENT = fnBody('fn_reparent_group_institution');
const FN_IMMUT = fnBody('fn_gib_enforce_immutability');

// ══ 1-2 · CASA ÚNICA: sem segunda tabela, sem coluna paralela em groups ══
for (const f of sqlFiles) {
  if (f === MIG_FILE) continue;
  const s = stripSql(read(join(MIG_DIR, f)));
  if (/CREATE TABLE\s+\w*(institutional_binding|binding\w*institution|group_institution)\w*/i.test(s)) {
    note('SECOND-TABLE', `migration ${f} cria segunda casa de composição`);
  }
  if (/ALTER TABLE\s+groups[\s\S]{0,200}?ADD COLUMN\s+\w*(institution|parent_actor|organization)\w*/i.test(s)) {
    note('SECOND-PARENT-COLUMN', `migration ${f} adiciona coluna de parent institucional em groups`);
  }
}
if (/ALTER TABLE\s+groups[\s\S]{0,200}?ADD COLUMN\s+\w*(institution|parent_actor|organization)\w*/i.test(M)) {
  note('SECOND-PARENT-COLUMN', 'a própria migration da casa adiciona coluna de parent em groups');
}
for (const f of GROUPS_FILES) {
  if (/CREATE TABLE\s+\w*(institutional|binding)\w*/i.test(f.s)) note('SECOND-TABLE', `${f.p} cria tabela de binding em runtime`);
}

// ══ 3 · WRITER ÚNICO: só o repository (e a migration) tocam as fns canônicas ══
const FN_CALL_RE = /fn_(bind_group_to_institution|retire_group_institutional_binding|reparent_group_institution)/;
for (const f of GROUPS_FILES) {
  if (f.p.endsWith('group-institutional-binding.repository.ts')) continue;
  if (FN_CALL_RE.test(f.s)) note('SECOND-WRITER', `${f.p} invoca fn canônica fora do repository privado`);
}
if (!FN_CALL_RE.test(REPO.s)) note('SECOND-WRITER', 'repository não invoca as fns canônicas (caminho de escrita divergente)');

// ══ 4-6 · DML DIRETO PROIBIDO em runtime ══
for (const f of GROUPS_FILES) {
  if (/INSERT\s+INTO\s+group_institutional_bindings/i.test(f.s)) note('DIRECT-INSERT', `${f.p} faz INSERT direto na casa`);
  if (/UPDATE\s+group_institutional_bindings/i.test(f.s)) note('DIRECT-UPDATE', `${f.p} faz UPDATE direto na casa`);
  if (/DELETE\s+FROM\s+group_institutional_bindings/i.test(f.s)) note('DELETE-PATH', `${f.p} faz DELETE na casa`);
}
if (!/BEFORE UPDATE OR DELETE ON group_institutional_bindings/i.test(M)) {
  note('DELETE-PATH', 'trigger de imutabilidade não cobre DELETE (BEFORE UPDATE OR DELETE ausente)');
}
if (!/GIB_DELETE_FORBIDDEN/.test(FN_IMMUT)) note('DELETE-PATH', 'GIB_DELETE_FORBIDDEN ausente do trigger');

// ══ 7-9 · IMUTABILIDADE E TERMINALIDADE ══
if (!/NEW\.group_id IS DISTINCT FROM OLD\.group_id/.test(FN_IMMUT)) note('UPDATE-GROUP-ID', 'imutabilidade de group_id ausente do trigger');
if (!/NEW\.institution_actor_id IS DISTINCT FROM OLD\.institution_actor_id/.test(FN_IMMUT)) note('UPDATE-INSTITUTION', 'imutabilidade de institution_actor_id ausente do trigger');
if (!/OLD\.status = 'retired'[\s\S]{0,200}?GIB_IMMUTABLE_RETIRED/.test(FN_IMMUT)) note('REACTIVATION', 'terminalidade de retired (GIB_IMMUTABLE_RETIRED) ausente do trigger');
if (!/NEW\.tenant_id IS DISTINCT FROM OLD\.tenant_id/.test(FN_IMMUT)) note('UPDATE-GROUP-ID', 'imutabilidade de tenant_id ausente do trigger');
if (!/NEW\.created_by_actor_id IS DISTINCT FROM OLD\.created_by_actor_id/.test(FN_IMMUT)) note('AUTHORSHIP-MISSING', 'imutabilidade da autoria de criação ausente do trigger');

// ══ 10-12 · CARDINALIDADE / UNICIDADE ATIVA ══
if (!/GIB_ACTIVE_BINDING_EXISTS/.test(FN_BIND)) note('SECOND-ACTIVE-PARENT', 'check de parent ativo existente ausente do fn_bind');
const uqActive = M.match(/CREATE UNIQUE INDEX\s+uq_gib_active_parent\s+ON group_institutional_bindings\s*\(([^)]*)\)\s*WHERE\s+([^;]+);/i);
if (!uqActive) {
  note('ACTIVE-UNIQUE-MISSING', 'uq_gib_active_parent (parcial WHERE active) ausente');
} else {
  const cols = uqActive[1];
  if (!/tenant_id/.test(cols)) note('ACTIVE-UNIQUE-TENANT', 'unicidade ativa sem tenant_id');
  if (!/group_id/.test(cols)) note('ACTIVE-UNIQUE-MISSING', 'unicidade ativa sem group_id');
  if (/institution_actor_id/.test(cols)) note('ACTIVE-UNIQUE-MISSING', 'unicidade ativa NÃO pode limitar instituição a um Group (institution_actor_id na chave)');
  if (!/status\s*=\s*'active'/.test(uqActive[2])) note('ACTIVE-UNIQUE-MISSING', "predicado WHERE status='active' ausente");
}

// ══ 13-16 · PARENT PERMITIDO: EXATAMENTE ('page','group') ══
const whitelist = FN_BIND.match(/actor_type NOT IN\s*\(([^)]*)\)/i);
if (!whitelist) {
  note('PARENT-USER', 'whitelist de actor_type do parent ausente do fn_bind');
} else {
  const vals = [...whitelist[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  if (vals.includes('user')) note('PARENT-USER', "whitelist do parent admite 'user'");
  if (vals.includes('channel')) note('PARENT-CHANNEL', "whitelist do parent admite 'channel'");
  if (vals.includes('system') || vals.includes('actor_system')) note('PARENT-SYSTEM', 'whitelist do parent admite system');
  const legacy = vals.filter((v) => ['person', 'company', 'actor_human', 'actor_organizational'].includes(v));
  if (legacy.length) note('PARENT-LEGACY', `whitelist do parent admite legado: ${legacy.join(',')}`);
  const extra = vals.filter((v) => !['page', 'group'].includes(v));
  if (extra.length) note('PARENT-LEGACY', `whitelist do parent excede page|group: ${extra.join(',')}`);
  if (!vals.includes('page') || !vals.includes('group')) note('PARENT-USER', 'whitelist do parent não fecha em page|group');
}

// ══ 17-18 · SEM NOVO ACTOR TYPE / SEM REVIVAL ══
if (/actor_type[\s\S]{0,80}?CHECK[\s\S]{0,400}?'(condominium|church|association|community|ngo)'/i.test(M)) {
  note('NEW-ACTOR-TYPE', 'migration introduz actor_type segmental');
}
for (const f of [...BINDING_FILES, { p: MIG_FILE, s: M }]) {
  if (/'actor_organizational'/.test(f.s)) note('REVIVAL-ACTOR-ORGANIZATIONAL', `${f.p} usa o valor físico congelado actor_organizational`);
}

// ══ 19 · COERÊNCIA TENANT COMPOSTA ══
if (!/FOREIGN KEY \(tenant_id, group_id\)\s+REFERENCES groups \(tenant_id, id\)/i.test(M)) {
  note('CROSS-TENANT', 'FK composta (tenant_id, group_id)→groups ausente');
}
if (!/FOREIGN KEY \(tenant_id, institution_actor_id\)\s+REFERENCES actors \(tenant_id, id\)/i.test(M)) {
  note('CROSS-TENANT', 'FK composta (tenant_id, institution_actor_id)→actors ausente');
}
if (!/fn_assert_actors_in_tenant/.test(FN_BIND) || !/fn_assert_actors_in_tenant/.test(FN_RETIRE)) {
  note('CROSS-TENANT', 'fn_assert_actors_in_tenant ausente de fn_bind/fn_retire');
}

// ══ 20-24 · SELF-LINK / RAIZ-INTERNO / CADEIA / CICLO ══
if (!/GIB_SELF_LINK/.test(FN_BIND)) note('SELF-LINK', 'check de self-link ausente do fn_bind');
if (!/GIB_PARENT_IS_INTERNAL/.test(FN_BIND)) note('PARENT-INTERNAL', 'check parent-raiz (GIB_PARENT_IS_INTERNAL) ausente do fn_bind');
if (!/GIB_GROUP_HAS_CHILDREN/.test(FN_BIND)) note('GROUP-HAS-CHILDREN', 'check filho-com-filhos (GIB_GROUP_HAS_CHILDREN) ausente do fn_bind');
if (!/GIB_PARENT_IS_INTERNAL/.test(FN_BIND) || !/GIB_GROUP_HAS_CHILDREN/.test(FN_BIND)) {
  note('MULTILEVEL-CHAIN', 'proibição de cadeia Group→Group→Group incompleta (par de checks ausente)');
}
if (!/GIB_SELF_LINK/.test(FN_BIND) || !/GIB_PARENT_IS_INTERNAL/.test(FN_BIND) || !/GIB_GROUP_HAS_CHILDREN/.test(FN_BIND)) {
  note('CYCLE', 'trio anti-ciclo v1 (self-link + parent-raiz + filho-sem-filhos) incompleto');
}

// ══ 25-28 · PARENT NUNCA POR metadata/category/purpose/role ══
for (const f of GROUPS_FILES) {
  if (/metadata\s*[.[]\s*['"]?(organizationId|institutionActorId|parentActorId|organization_id|institution_actor_id)/i.test(f.s)
      || /metadata\s*->>?\s*'(organizationId|organization|institution|parent)/i.test(f.s)
      || (/\bmetadata\b/i.test(f.s) && /\b(organizationId|institutionActorId|parentActorId)\b/.test(f.s))) {
    note('METADATA-PARENT', `${f.p} usa metadata como vínculo institucional`);
  }
}
for (const f of BINDING_FILES) {
  if (/category/i.test(f.s)) note('CATEGORY-PARENT', `${f.p} referencia category na composição`);
  if (/\bpurpose\b/i.test(f.s)) note('PURPOSE-PARENT', `${f.p} referencia purpose na composição`);
  if (/\brole\b/i.test(f.s)) note('ROLE-PARENT', `${f.p} referencia role na composição`);
}

// ══ 29-32 · CASAS ERRADAS NUNCA SÃO COMPOSIÇÃO ══
for (const f of BINDING_FILES) {
  if (/group_members/i.test(f.s)) note('MEMBERSHIP-COMPOSITION', `${f.p} referencia group_members`);
  if (/actor_relationships/i.test(f.s)) note('RELATIONSHIPS-COMPOSITION', `${f.p} referencia actor_relationships`);
  if (/actor_capability_grants/i.test(f.s)) note('GRANTS-COMPOSITION', `${f.p} referencia actor_capability_grants`);
  if (/actor_delegations/i.test(f.s)) note('DELEGATIONS-COMPOSITION', `${f.p} referencia actor_delegations`);
}

// ══ 33-35 · NÃO-HERANÇA: fns só escrevem na própria casa ══
for (const [name, body] of [['fn_bind', FN_BIND], ['fn_retire', FN_RETIRE], ['fn_reparent', FN_REPARENT]]) {
  const inserts = [...body.matchAll(/INSERT\s+INTO\s+([a-z_.]+)/gi)].map((x) => x[1].replace('public.', ''));
  const bad = inserts.filter((t) => t !== 'group_institutional_bindings');
  if (bad.length) note('AUTHORITY-INHERITANCE', `${name} insere em tabela alheia: ${bad.join(',')}`);
  const updates = [...body.matchAll(/UPDATE\s+([a-z_.]+)/gi)].map((x) => x[1].replace('public.', ''));
  const badU = updates.filter((t) => t !== 'group_institutional_bindings');
  if (badU.length) note('AUTHORITY-INHERITANCE', `${name} atualiza tabela alheia: ${badU.join(',')}`);
}
for (const f of BINDING_FILES) {
  if (/bank_accounts|group_accounts|bank_ledger|bank_transactions|balance_cents/i.test(f.s)) {
    note('ACCOUNT-INHERITANCE', `${f.p} referencia contas/saldo`);
  }
  if (/address_assignments|addresses\b/i.test(f.s)) note('ADDRESS-INHERITANCE', `${f.p} referencia endereço`);
}

// ══ 36-38 · SEM CRIAÇÃO DE GROUP / CAPS INTACTOS / SEM ATÔMICO GROUP+BINDING ══
if (/INSERT\s+INTO\s+(public\.)?groups\b/i.test(FN_BIND + FN_RETIRE + FN_REPARENT)) {
  note('CREATE-GROUP-IN-WRITER', 'fn canônica insere em groups');
}
for (const f of BINDING_FILES) {
  if (/createGroup|ensureGroupActor/.test(f.s)) note('CREATE-GROUP-IN-WRITER', `${f.p} cria Group/group-actor no fluxo de binding`);
  if (/groups\.service/.test(f.s)) note('ATOMIC-GROUP-PLUS-BINDING', `${f.p} importa groups.service (criação atômica Group+binding proibida até D9.3)`);
}
if (!/INITIAL_LIMIT = 1\b/.test(POLICY.s)) note('CAPS-TAMPERED', 'cap de criação (INITIAL_LIMIT=1) alterado ou ausente');
if (!/currentCount >= 3\)/.test(GROUPS_SVC.s) || /currentCount >= 3\d/.test(GROUPS_SVC.s)) note('CAPS-TAMPERED', 'cap de participação (>= 3) alterado ou ausente');

// ══ 39-40 · ORGANIZATION MORTO / BLANKET 501 VIVO ══
for (const f of BINDING_FILES) {
  if (/organization_(members|units|roles|invites)/i.test(f.s)) note('ORGANIZATION-REVIVAL', `${f.p} referencia organization_* tombstone`);
}
// na migration, tombstone só pode aparecer como ASSERT de ausência (to_regclass ... IS NOT NULL → ABORT);
// CREATE/INSERT/ALTER sobre organization_* = revival.
if (/(CREATE TABLE|INSERT INTO|ALTER TABLE)\s+(public\.)?organization_(members|units|roles|invites)/i.test(M)) {
  note('ORGANIZATION-REVIVAL', 'migration materializa/escreve organization_* tombstone');
}
if (!/status\(501\)/.test(ORG_ROUTES.s) || !/ORGANIZATION_SCHEMA_GHOST_CONTAINED/.test(ORG_ROUTES.raw)) {
  note('BLANKET-501', 'contenção 501 do módulo organization foi alterada/removida');
}

// ══ 41 · SEM REMEDIAÇÃO AMPLA DE RLS EM groups ══
if (/ALTER TABLE\s+groups\s+(ENABLE|FORCE) ROW LEVEL SECURITY/i.test(M)) {
  note('GROUPS-RLS-SCOPE-CREEP', 'migration D9.1 remedia RLS de groups (fora do envelope; DT-GROUPS-TABLE-NO-RLS é frente própria)');
}

// ══ 42 · BANK FORA ══
for (const f of BINDING_FILES) {
  if (/@modules\/bank|modules\/bank\//.test(f.s)) note('BANK-IMPORT', `${f.p} importa módulo bank`);
}
if (/bank_ledger|bank_transactions|bank_splits|bank_accounts/i.test(M)) note('BANK-IMPORT', 'migration referencia tabelas do Bank');

// ══ 43 · ZERO SUPERFÍCIE PÚBLICA ══
for (const f of BINDING_FILES) {
  if (/fastify|\.get\(|\.post\(|\.put\(|\.patch\(|\.delete\(|registerRoutes|FastifyInstance/i.test(f.s)) {
    note('PUBLIC-SURFACE', `${f.p} define superfície HTTP`);
  }
}
{
  const appBuilder = resolve(ROOT, 'src/app.builder.ts');
  if (existsSync(appBuilder) && /institutional-binding/i.test(stripTs(read(appBuilder)))) {
    note('PUBLIC-SURFACE', 'app.builder registra superfície de institutional-binding');
  }
  const feApi = resolve(ROOT, '../frontend/src/api');
  if (existsSync(feApi)) {
    for (const e of readdirSync(feApi)) {
      if (/institutional-binding|group-institutional/i.test(e)) note('PUBLIC-SURFACE', `frontend/src/api/${e} expõe binding institucional`);
    }
  }
}

// ══ 44-45 · AUTORIDADE DUAL / NUNCA PAYLOAD ══
const svcS = SVC.s;
const repCalls = (svcS.match(/canRepresentActor\(/g) || []).length;
if (!/GIB_INSTITUTION_NOT_REPRESENTED/.test(svcS)) note('SINGLE-SIDED-AUTHORITY', 'predicado do lado INSTITUIÇÃO ausente do service');
if (!/GIB_GROUP_NOT_REPRESENTED/.test(svcS)) note('SINGLE-SIDED-AUTHORITY', 'predicado do lado GROUP ausente do service');
if (repCalls < 2) note('SINGLE-SIDED-AUTHORITY', `service tem ${repCalls} chamada(s) canRepresentActor (mínimo 2 — dual)`);
for (const f of BINDING_FILES) {
  if (/actionContext/.test(f.s)) note('PAYLOAD-AUTHORITY', `${f.p} usa actionContext como fonte de autoridade`);
  if (/req\.(body|query|params)/.test(f.s)) note('PAYLOAD-AUTHORITY', `${f.p} lê autoridade de payload HTTP`);
}

// ══ 46-47 · WRITER TRANSACIONAL COM LOCK ══
if (!FN_BIND || !FN_RETIRE || !FN_REPARENT) note('WRITER-NO-TX', 'trio de fns canônicas incompleto na migration');
for (const [name, body] of [['fn_bind', FN_BIND], ['fn_retire', FN_RETIRE], ['fn_reparent', FN_REPARENT]]) {
  if (body && !/pg_advisory_xact_lock/.test(body)) note('WRITER-NO-LOCK', `${name} sem advisory lock transacional`);
}
if (FN_BIND && !/FOR UPDATE/.test(FN_BIND)) note('WRITER-NO-LOCK', 'fn_bind sem row lock FOR UPDATE');
if (FN_RETIRE && !/FOR UPDATE/.test(FN_RETIRE)) note('WRITER-NO-LOCK', 'fn_retire sem row lock FOR UPDATE');
if (!/fn_retire_group_institutional_binding\(/.test(FN_REPARENT) || !/fn_bind_group_to_institution\(/.test(FN_REPARENT)) {
  note('WRITER-NO-TX', 'fn_reparent não reutiliza as duas primitivas na mesma transação');
}

// ══ 48 · INFRA-ERROR NUNCA VIRA FALSE ══
{
  const dualRegion = svcS.match(/assertDualAuthority[\s\S]*?\n  }/);
  const region = dualRegion ? dualRegion[0] : svcS;
  if (/catch/.test(region)) note('INFRA-ERROR-MASKED', 'authority dual envolta em catch (infra-error mascarado)');
  if (/\.catch\(\s*\(\)?\s*=>\s*false\)/.test(svcS)) note('INFRA-ERROR-MASKED', 'service converte erro de authority em false');
}

// ══ 49 · RLS FORCE DE NASCENÇA ══
if (!/ALTER TABLE group_institutional_bindings ENABLE ROW LEVEL SECURITY/i.test(M)) note('RLS-NOT-FORCED', 'ENABLE ROW LEVEL SECURITY ausente');
if (!/ALTER TABLE group_institutional_bindings FORCE ROW LEVEL SECURITY/i.test(M)) note('RLS-NOT-FORCED', 'FORCE ROW LEVEL SECURITY ausente');
if (!/CREATE POLICY\s+group_institutional_bindings_rls[\s\S]{0,300}?app\.current_tenant/i.test(M)) note('RLS-NOT-FORCED', 'policy tenant-scoped ausente');
if (!/REVOKE INSERT, UPDATE, DELETE ON group_institutional_bindings FROM unificard_app/i.test(M)) note('RLS-NOT-FORCED', 'fronteira de escrita (REVOKE DML do app) ausente');

// ══ 50 · SECURITY DEFINER GOVERNADO ══
{
  const defs = [...MIG_RAW.matchAll(/CREATE FUNCTION (fn_[a-z_]+)\([\s\S]*?\$func\$/gi)].map((m) => m[0]);
  for (const d of defs) {
    const name = (d.match(/CREATE FUNCTION (fn_[a-z_]+)/i) || [])[1];
    if (/SECURITY DEFINER/i.test(d) && !/SET search_path = pg_catalog, pg_temp/i.test(d)) {
      note('DEFINER-UNGOVERNED', `${name} SECURITY DEFINER sem search_path pinado`);
    }
  }
  for (const fn of ['fn_bind_group_to_institution', 'fn_retire_group_institutional_binding', 'fn_reparent_group_institution']) {
    if (!new RegExp(`REVOKE EXECUTE ON FUNCTION ${fn}[^;]*FROM PUBLIC`, 'i').test(M)) {
      note('DEFINER-UNGOVERNED', `${fn} sem REVOKE EXECUTE FROM PUBLIC`);
    }
    if (!new RegExp(`GRANT EXECUTE ON FUNCTION ${fn}[^;]*TO unificard_app`, 'i').test(M)) {
      note('DEFINER-UNGOVERNED', `${fn} sem GRANT EXECUTE governado a unificard_app`);
    }
  }
}

// ══ 51 · TRILHA DE AUTORIA ══
if (!/created_by_actor_id\s+UUID\s+NOT NULL/i.test(M)) note('AUTHORSHIP-MISSING', 'created_by_actor_id NOT NULL ausente');
if (!/retired_by_actor_id IS NOT NULL AND retire_idempotency_key IS NOT NULL/i.test(M)) {
  note('AUTHORSHIP-MISSING', 'shape de retirada com autoria obrigatória ausente do CHECK de lifecycle');
}
if (FN_RETIRE && !/retired_by_actor_id = p_acting_actor_id/.test(FN_RETIRE)) note('AUTHORSHIP-MISSING', 'fn_retire não grava autoria da retirada');

// ══ 52 · IDEMPOTÊNCIA FINGERPRINT FAIL-CLOSED ══
if (!/create_fingerprint/i.test(M)) note('IDEMPOTENCY-WEAK', 'create_fingerprint ausente da casa');
for (const [name, body] of [['fn_bind', FN_BIND], ['fn_retire', FN_RETIRE], ['fn_reparent', FN_REPARENT]]) {
  if (body && !/GIB_IDEMPOTENCY_MISMATCH/.test(body)) note('IDEMPOTENCY-WEAK', `${name} sem mismatch fail-closed de idempotência`);
}
if (!/CREATE UNIQUE INDEX\s+uq_gib_create_idempotency\s+ON group_institutional_bindings \(tenant_id, create_idempotency_key\)/i.test(M)) {
  note('IDEMPOTENCY-WEAK', 'unicidade tenant-scoped da chave de criação ausente');
}
if (!/uq_gib_retire_idempotency[\s\S]{0,200}?WHERE retire_idempotency_key IS NOT NULL/i.test(M)) {
  note('IDEMPOTENCY-WEAK', 'unicidade parcial da chave de retirada ausente');
}

// ══ 53+ · REMEDIAÇÃO AUTHORITY DUAL TRANSACTION BOUNDARY (Veredito B da Yala) ══
const AUTHZ = mustRead('src/core/authorization/authorization.service.ts', 'EVIDENCE-LOCK-MISSING');
const COMPANIES = mustRead('src/core/companies/companies.service.ts', 'EVIDENCE-LOCK-MISSING');

// TX-OWNER: service é o ÚNICO transaction owner (helper com connect/BEGIN/COMMIT/ROLLBACK/release em finally)
{
  const helper = svcS.match(/withAuthorityTransaction[\s\S]*?\n  }/);
  if (!helper) {
    note('TX-OWNER', 'withAuthorityTransaction ausente do service');
  } else {
    const h = helper[0];
    for (const [tok, msg] of [["pool.connect", 'connect'], ["'BEGIN'", 'BEGIN'], ["'COMMIT'", 'COMMIT'], ["'ROLLBACK'", 'ROLLBACK'], ['finally', 'finally'], ['client.release()', 'release']]) {
      if (!h.includes(tok)) note('TX-OWNER', `transaction owner sem ${msg}`);
    }
    // TX-ORDER: BEGIN → tenant → advisory → fn(client) → COMMIT
    const iBegin = h.indexOf("'BEGIN'");
    const iTenant = h.indexOf('set_config');
    const iAdv = h.indexOf('pg_advisory_xact_lock');
    const iFn = h.indexOf('fn(client)');
    const iCommit = h.indexOf("'COMMIT'");
    if (!(iBegin >= 0 && iTenant > iBegin && iAdv > iTenant && iFn > iAdv && iCommit > iFn)) {
      note('TX-ORDER', 'ordem BEGIN→tenant→advisory→fn(client)→COMMIT violada no transaction owner');
    }
    // PREMATURE-RELEASE: release exatamente 1×, dentro do finally
    const releases = (svcS.match(/client\.release\(\)/g) || []).length;
    if (releases !== 1) note('PREMATURE-RELEASE', `client.release() aparece ${releases}× no service (esperado 1, no finally)`);
    if (!/finally\s*\{\s*client\.release\(\)/.test(h)) note('PREMATURE-RELEASE', 'release fora do finally do transaction owner');
  }
}

// AUTHORITY-OUT-OF-TX: TODA chamada canRepresentActor do service leva o client transacional como 4º arg
{
  const total = (svcS.match(/canRepresentActor\(/g) || []).length;
  const withClient = (svcS.match(/canRepresentActor\(\s*\n?\s*tenantId,\s*\n?\s*actingUserId,\s*\n?\s*[A-Za-z_.]+,\s*\n?\s*client\s*\n?\s*\)/g) || []).length;
  if (total === 0) note('AUTHORITY-OUT-OF-TX', 'service sem chamadas canRepresentActor');
  if (withClient !== total) note('AUTHORITY-OUT-OF-TX', `${total - withClient} chamada(s) canRepresentActor SEM o client transacional`);
  if (total < 3) note('SINGLE-SIDED-AUTHORITY', `service tem ${total} chamada(s) canRepresentActor (mínimo 3 — dual + terceiro do reparent)`);
}

// AUTOCOMMIT-AUTHORITY: regiões bind/retire/reparent não podem usar runQueryWithTenant (autocommit)
{
  const region = (name) => {
    const m = svcS.match(new RegExp(`async ${name}[\\s\\S]*?\\n  \\}`));
    return m ? m[0] : '';
  };
  for (const op of ['bindGroupToInstitution', 'retireBinding', 'reparentGroupInstitution']) {
    const r = region(op);
    if (!r) { note('AUTOCOMMIT-AUTHORITY', `região ${op} não localizada`); continue; }
    if (/runQueryWithTenant|runQueriesWithTenant/.test(r)) {
      note('AUTOCOMMIT-AUTHORITY', `${op} usa query autocommit dentro da operação transacional`);
    }
    if (!/withAuthorityTransaction/.test(r)) note('AUTHORITY-OUT-OF-TX', `${op} não roda sob withAuthorityTransaction`);
  }
}

// HELPER-OWN-CLIENT: nenhum helper/repository abre client próprio (pool.connect só no transaction owner)
{
  const connects = (svcS.match(/pool\.connect/g) || []).length;
  if (connects !== 1) note('HELPER-OWN-CLIENT', `pool.connect aparece ${connects}× no service (esperado 1, no transaction owner)`);
  if (/pool\.connect/.test(REPO.s)) note('HELPER-OWN-CLIENT', 'repository abre client próprio');
}

// WRITER-CLIENT-MISMATCH: writers do repository rodam as fns canônicas NO client do caller
{
  for (const fn of ['fn_bind_group_to_institution', 'fn_retire_group_institutional_binding', 'fn_reparent_group_institution']) {
    const call = REPO.s.match(new RegExp(`([A-Za-z_.]+)\\.query\\(\\s*\\n?\\s*\`SELECT ${fn}`));
    if (!call) note('WRITER-CLIENT-MISMATCH', `${fn} não é invocada via client.query no repository`);
    else if (call[1] !== 'client') note('WRITER-CLIENT-MISMATCH', `${fn} invocada via '${call[1]}.query' — deve ser o client transacional do caller`);
  }
  if (!/bind\(\s*\n?\s*client: PoolClient/.test(REPO.s)) note('WRITER-CLIENT-MISMATCH', 'assinatura de bind não OBRIGA o client transacional');
}

// EVIDENCE-LOCK-MISSING: caminho transacional do SSOT de authority lê evidência FOR SHARE
{
  const onClient = AUTHZ.s.match(/private async canRepresentActorOnClient[\s\S]*?\n  \}/);
  if (!onClient) {
    note('EVIDENCE-LOCK-MISSING', 'canRepresentActorOnClient ausente do SSOT de authority');
  } else {
    const shares = (onClient[0].match(/FOR SHARE/g) || []).length;
    if (shares < 4) note('EVIDENCE-LOCK-MISSING', `caminho transacional com ${shares} FOR SHARE (mínimo 4 — actor/groups/owner/delegação)`);
  }
  if (!/existingClient\?/.test(AUTHZ.s)) note('EVIDENCE-LOCK-MISSING', 'canRepresentActor sem parâmetro opcional existingClient');
  const cmc = COMPANIES.s.match(/async canManageCompany[\s\S]*?\n  \}/);
  if (!cmc || !/existingClient/.test(cmc[0]) || !/FOR SHARE/.test(cmc[0])) {
    note('EVIDENCE-LOCK-MISSING', 'canManageCompany sem caminho transacional FOR SHARE (evidência revogável company_users)');
  }
}

// AUTH-SQL-DUP: a migration NÃO replica evidência de authority (company_users/actor_delegations/actor_registry)
if (/company_users|actor_delegations|actor_registry/i.test(M)) {
  note('AUTH-SQL-DUP', 'migration referencia casas de evidência de authority — lógica de canRepresentActor não pode ser duplicada em SQL');
}

// TOCTOU-COMMENT: proibido declarar a janela como "aceitável/permitida" em vez de eliminá-la (scan RAW, comment-aware às avessas)
for (const f of [{ p: SVC_P, raw: SVC.raw }, { p: REPO_P, raw: REPO.raw }, { p: 'authorization.service.ts', raw: AUTHZ.raw }]) {
  if (/contratualmente permitid|TOCTOU aceit|janela aceit/i.test(f.raw)) {
    note('TOCTOU-COMMENT', `${f.p} declara a janela TOCTOU como permitida em vez de eliminá-la`);
  }
}

// SECOND-GUARD: exatamente UM guard D9.1 no runner e nos scripts
{
  const inRunner = (RUNNER.s.match(/audit-group-institutional-binding\.mjs/g) || []).length;
  if (inRunner !== 1) note('SECOND-GUARD', `guard D9.1 aparece ${inRunner}× no runner (esperado 1)`);
  const guardFiles = readdirSync(resolve(ROOT, 'scripts')).filter((f) => /group-institutional-binding.*\.mjs$/.test(f));
  const expected = ['audit-group-institutional-binding-mutations.mjs', 'audit-group-institutional-binding.mjs'];
  const extra = guardFiles.filter((f) => !expected.includes(f));
  if (extra.length) note('SECOND-GUARD', `arquivo(s) de guard paralelo: ${extra.join(', ')}`);
}

// ══ RUNNER-WIRING ══
if (!/audit-group-institutional-binding\.mjs/.test(RUNNER.s)) {
  note('RUNNER-WIRING', 'guard não conectado ao runner oficial');
}

// ── veredito ──
if (fails.length) {
  console.error('❌ audit-group-institutional-binding — violações:');
  for (const f of fails) console.error('   ' + f);
  process.exit(1);
}
console.log('✅ audit-group-institutional-binding — contrato D9.1 (DECISION-0186/0187) íntegro.');
