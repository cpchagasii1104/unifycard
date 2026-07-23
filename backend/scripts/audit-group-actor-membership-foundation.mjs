#!/usr/bin/env node
// audit-group-actor-membership-foundation.mjs — Guard dedicado D9.2-A/D9.2-B (runner).
// DECISION-0188 (Membership Actor-first Contract) + DECISION-0186. Congela a FUNDAÇÃO:
// casa única group_actor_memberships (member_actor_id como identidade; SEM user/global/member_type/
// role/category/N0/N1/N2/financeiro), lifecycle active→left|removed terminal sem DELETE, unicidade
// ativa tenant-scoped, coerência composta, RLS FORCE, app sem DML, writers governados com authority
// no service (mesmo client — padrão selado D9.1), intents explícitas (invite|request; NULL≠invite;
// aceite ATÔMICO). PÓS-CUTOVER D9.2-B (GO 2026-07-23): a seção D deixou de ser ANTI-CUTOVER e
// virou CUTOVER-REGRESSION — o legado group_members está CONGELADO (nenhuma escrita/leitura no
// módulo groups; role-authority retirada; superfícies convergidas); callers de produto agora são
// GOVERNADOS por allowlist (seção C). Fronteiras (Bank/D9.3/D9.4/N0-N1-N2/organization fora).
// Prova de CONTRATO. Marcador [X] por trava. Fail-closed. Comment-aware. Localiza a migration por CONTEÚDO.
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

// ── localizar a MIGRATION por CONTEÚDO ──
const MIG_DIR = resolve(ROOT, 'migrations');
const sqlFiles = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql'));
const migMatches = [];
for (const f of sqlFiles) {
  if (/CREATE TABLE\s+group_actor_memberships/i.test(stripSql(read(join(MIG_DIR, f))))) migMatches.push(f);
}
if (migMatches.length === 0) note('SECOND-HOUSE', 'migration com CREATE TABLE group_actor_memberships AUSENTE');
if (migMatches.length > 1) note('SECOND-HOUSE', `múltiplas migrations criam a casa: ${migMatches.join(', ')}`);
const MIG_FILE = migMatches[0] ?? '';
const MIG_RAW = MIG_FILE ? read(join(MIG_DIR, MIG_FILE)) : '';
const M = stripSql(MIG_RAW);

const mustRead = (p, marker) => {
  const abs = resolve(ROOT, p);
  if (!existsSync(abs)) { note(marker, `arquivo material ausente: ${p}`); return { raw: '', s: '' }; }
  const raw = read(abs);
  return { raw, s: p.endsWith('.sql') ? stripSql(raw) : stripTs(raw) };
};
const SVC = mustRead('src/modules/groups/group-actor-membership.service.ts', 'DORMANCY');
const REPO = mustRead('src/modules/groups/group-actor-membership.repository.ts', 'SECOND-WRITER');
const SHADOW = mustRead('src/modules/groups/group-membership-shadow.readmodel.ts', 'SHADOW-PURITY');
const GROUPS_ROUTES = mustRead('src/modules/groups/groups.routes.ts', 'ANTI-CUTOVER');
const GROUPS_SVC = mustRead('src/modules/groups/groups.service.ts', 'ANTI-CUTOVER');
const GROUPS_REPO = mustRead('src/modules/groups/groups.repository.ts', 'ANTI-CUTOVER');
const EVENTS_B3 = mustRead('src/modules/events/events-sprint76.routes.ts', 'ANTI-CUTOVER');
const POLICY = mustRead('src/modules/groups/policies/group-creation-policy.ts', 'ANTI-CUTOVER');
const APP_BUILDER = mustRead('src/app.builder.ts', 'DORMANCY');
const RUNNER = mustRead('scripts/run-regression-guards.mjs', 'RUNNER-WIRING');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { if (!/node_modules|\.git|dist/.test(e)) walk(p, out); }
    else if (/\.(ts|mts|cts)$/.test(e)) out.push(p);
  }
  return out;
}
const fnBody = (name) => {
  const re = new RegExp(`CREATE FUNCTION ${name}[\\s\\S]*?\\$func\\$([\\s\\S]*?)\\$func\\$`, 'i');
  const m = MIG_RAW.match(re);
  return m ? m[1] : '';
};
const FN_ENTER = fnBody('fn_enter_group_actor_membership');
const FN_LEAVE = fnBody('fn_leave_group_actor_membership');
const FN_REMOVE = fnBody('fn_remove_group_actor_membership');
const FN_INTENT = fnBody('fn_create_group_membership_intent');
const FN_ACCEPT = fnBody('fn_accept_group_membership_intent');
const FN_IMMUT = fnBody('fn_gam_enforce_immutability');
const FN_GI_IMMUT = fnBody('fn_gi_intent_enforce_immutability');

// ══ A · CASA E IDENTIDADE ══
{
  const create = M.match(/CREATE TABLE group_actor_memberships\s*\(([\s\S]*?)\n\);/i);
  if (!create) note('SECOND-HOUSE', 'CREATE TABLE da casa não parseável');
  const body = create ? create[1] : '';
  for (const [col, mk] of [['user_id', 'USERID-IN-HOUSE'], ['global_user_id', 'GLOBALID-IN-HOUSE'],
    ['member_type', 'POLYMORPHIC-MEMBER'], ['role', 'ROLE-IN-HOUSE'], ['is_admin', 'ROLE-IN-HOUSE'],
    ['is_owner', 'ROLE-IN-HOUSE'], ['category_id', 'NAV-IN-HOUSE'], ['n0_id', 'NAV-IN-HOUSE'],
    ['n1_id', 'NAV-IN-HOUSE'], ['n2_id', 'NAV-IN-HOUSE'], ['authority_level', 'AUTHORITY-IN-HOUSE'],
    ['capability_id', 'AUTHORITY-IN-HOUSE'], ['grant_id', 'AUTHORITY-IN-HOUSE'],
    ['balance', 'FINANCE-IN-HOUSE'], ['amount', 'FINANCE-IN-HOUSE'], ['_cents', 'FINANCE-IN-HOUSE']]) {
    if (new RegExp(`\\b${col}\\b`, 'i').test(body)) note(mk, `coluna proibida na casa nova: ${col}`);
  }
  if (!/member_actor_id\s+UUID\s+NOT NULL/i.test(body)) note('IDENTITY-MISSING', 'member_actor_id NOT NULL ausente');
  // segunda casa Actor-first / actor_id paralelo no legado
  for (const f of sqlFiles) {
    if (f === MIG_FILE) continue;
    const s = stripSql(read(join(MIG_DIR, f)));
    if (/CREATE TABLE\s+\w*(actor_membership|membership_actor|group_actor_member)\w*/i.test(s)) {
      note('SECOND-HOUSE', `migration ${f} cria segunda casa Actor-first`);
    }
    if (/ALTER TABLE\s+group_members[\s\S]{0,200}?ADD COLUMN\s+\w*actor\w*/i.test(s)) {
      note('LEGACY-ACTOR-COLUMN', `migration ${f} adiciona actor_id paralelo em group_members`);
    }
  }
  if (/ALTER TABLE\s+group_members\b/i.test(M)) note('LEGACY-ACTOR-COLUMN', 'a migration D9.2-A altera group_members (legado deve permanecer intocado)');
  // whitelist de classes v1 EXATA (user,page,group)
  const wl = FN_ENTER.match(/actor_type NOT IN\s*\(([^)]*)\)/i);
  if (!wl) note('MEMBER-TYPE-OPEN', 'whitelist de classes do membro ausente do fn_enter');
  else {
    const vals = [...wl[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    if (vals.includes('channel')) note('MEMBER-CHANNEL', 'whitelist admite channel');
    if (vals.includes('system') || vals.includes('actor_system')) note('MEMBER-SYSTEM', 'whitelist admite system');
    const legacy = vals.filter((v) => ['person', 'company', 'actor_human', 'actor_organizational'].includes(v));
    if (legacy.length) note('MEMBER-LEGACY', `whitelist admite legado: ${legacy.join(',')}`);
    const extra = vals.filter((v) => !['user', 'page', 'group'].includes(v));
    if (extra.length) note('MEMBER-TYPE-OPEN', `whitelist excede user|page|group: ${extra.join(',')}`);
    if (!vals.includes('user') || !vals.includes('page') || !vals.includes('group')) {
      note('MEMBER-TYPE-OPEN', 'whitelist não fecha em user|page|group');
    }
  }
  if (/actor_type[\s\S]{0,80}?CHECK[\s\S]{0,400}?'(condominium|church|association|community|ngo)'/i.test(M)) {
    note('NEW-ACTOR-TYPE', 'migration introduz actor_type segmental');
  }
}

// ══ B · SSOT E ONTOLOGIA (membership NUNCA em metadata/category/CONCEPT/N0/N1/N2/binding/rel/grants/role) ══
{
  for (const f of [SVC, REPO, { s: M, raw: MIG_RAW }]) {
    if (/\bconcepts?\b|canonical_products|concept_id/i.test(f.s)) note('MEMBERSHIP-IN-CONCEPT', 'superfície D9.2-A referencia CONCEPT');
    if (/\bcategories\b|category_id/i.test(f.s)) note('MEMBERSHIP-IN-CATEGORY', 'superfície D9.2-A referencia categories');
    if (/\bn0_nodes\b|\bn1_nodes\b|\bn2_nodes\b/i.test(f.s)) note('MEMBERSHIP-IN-NAV', 'superfície D9.2-A referencia N0/N1/N2');
    if (/actor_relationships/i.test(f.s)) note('RELATIONSHIPS-AS-MEMBERSHIP', 'superfície D9.2-A referencia actor_relationships');
    if (/actor_capability_grants|actor_delegations/i.test(f.s)) note('GRANTS-AS-MEMBERSHIP', 'superfície D9.2-A referencia grants/delegações');
    if (/metadata\s*->>?\s*'(member|organization|institution)/i.test(f.s)) note('MEMBERSHIP-IN-METADATA', 'membership inferida por metadata');
  }
  // binding ≠ membership: fn_enter usa bindings SÓ para raiz/anti-parent (nunca para CONCEDER)
  if (!/GAM_MEMBER_GROUP_NOT_ROOT/.test(FN_ENTER)) note('BINDING-AS-MEMBERSHIP', 'check de raiz (interno não entra) ausente');
  if (!/GAM_PARENT_CANNOT_JOIN_CHILD/.test(FN_ENTER)) note('BINDING-AS-MEMBERSHIP', 'check parent-não-entra-no-filho ausente');
  if (/INSERT\s+INTO\s+(public\.)?group_institutional_bindings/i.test(M)) note('BINDING-AS-MEMBERSHIP', 'migration escreve na casa do binding');
  if (/\brole\b/i.test(stripTs(SVC.raw))) note('ROLE-AS-MEMBERSHIP', 'service D9.2-A referencia role');
}

// ══ C · CALLERS GOVERNADOS (pós-cutover D9.2-B: superfícies enumeradas; fn_* SÓ no repository) ══
{
  const ALLOW = [
    'src/modules/groups/group-actor-membership.service.ts',
    'src/modules/groups/group-actor-membership.repository.ts',
    'src/modules/groups/group-actor-membership.types.ts',
    'src/modules/groups/group-membership-shadow.readmodel.ts',
    // superfícies do CUTOVER D9.2-B (flip atômico writers+readers — DECISION-0188 D16):
    'src/modules/groups/groups.service.ts',
    'src/modules/groups/groups.repository.ts',
    'src/modules/groups/groups.routes.ts',
    'src/core/feed/feed.routes.ts',
    'src/modules/social/social.routes.ts',
    // FATIA 3 arco fundação eventos (cardápio de configs c/ line-up): consumidor READ-ONLY governado —
    // valida membership ATIVA via leitor selado findActiveByGroupAndMember e DERIVA isActiveMember na
    // leitura (DERIVED-INCOMPLETE; DECISION-0188 intacta: zero fn_*, zero DML na casa, zero auto-drop —
    // vigiado pelo par audit-offering-config-lineup.mjs).
    'src/modules/services/service-offering-config.service.ts',
    // FATIA 4 arco fundação eventos (aviso SUAVE de conflito por pessoa — OP-2 2026-07-23): consumidor
    // READ-ONLY governado — deriva as PESSOAS do provider recém-confirmado e as OUTRAS bandas da pessoa
    // via memberships ATIVAS (SELECT puro em group_actor_memberships; DECISION-0188 intacta: zero fn_*,
    // zero DML na casa, zero bloqueio de leave — vigiado pelo par audit-booking-soft-conflict.mjs).
    'src/core/availability/booking-soft-conflict.ts',
  ];
  const allSrc = walk(resolve(ROOT, 'src')).map((p) => norm(p).replace(norm(ROOT) + '/', ''));
  for (const p of allSrc) {
    if (ALLOW.includes(p)) continue;
    if (/\.test\.|\.spec\.|__tests__/.test(p)) continue;
    if (/^src\/scripts\/validate-pipeline-e2e-group-actor-membership/.test(p)) continue; // harness E2E D9.2-A
    if (/^src\/scripts\/validate-pipeline-e2e-group-membership-cutover/.test(p)) continue; // harness E2E D9.2-B
    if (/^src\/scripts\/validate-pipeline-e2e-offering-config-lineup/.test(p)) continue; // harness E2E FATIA 3 (config line-up)
    if (/^src\/scripts\/validate-pipeline-e2e-band-cross-membership-soft-conflict/.test(p)) continue; // harness E2E FATIA 4 (aviso suave cross-membership)
    const s = stripTs(read(resolve(ROOT, p)));
    if (/group-actor-membership|group_actor_memberships|fn_enter_group_actor_membership|fn_accept_group_membership_intent|group-membership-shadow/.test(s)) {
      note('DORMANCY', `caller fora do allowlist governado do cutover: ${p}`);
    }
  }
  // as fns canônicas SÓ são invocadas pelo repository privado (writer único TS)
  for (const p of allSrc) {
    if (p === 'src/modules/groups/group-actor-membership.repository.ts') continue;
    if (/\.test\.|\.spec\.|__tests__/.test(p)) continue;
    if (/^src\/scripts\/validate-pipeline-e2e-group/.test(p)) continue;
    const s = stripTs(read(resolve(ROOT, p)));
    if (/fn_(enter|leave|remove)_group_actor_membership|fn_(create|accept)_group_membership_intent/.test(s)) {
      note('DIRECT-DML', `invocação direta de fn canônica fora do repository privado: ${p}`);
    }
  }
  if (/group-actor-membership|group_actor_memberships/.test(APP_BUILDER.s)) note('DORMANCY', 'app.builder referencia a fundação diretamente');
  const feDir = resolve(ROOT, '../frontend/src');
  if (existsSync(feDir)) {
    const feApi = resolve(feDir, 'api');
    if (existsSync(feApi)) {
      for (const e of readdirSync(feApi)) {
        if (/actor-membership|membership-intent/i.test(e)) note('DORMANCY', `frontend/src/api/${e} expõe a fundação`);
      }
    }
  }
  if (/INSERT INTO\s+(public\.)?group_actor_memberships[\s\S]{0,400}?VALUES/i.test(M) === false) {
    // INSERT existe apenas dentro do fn_enter — garantir que NÃO há INSERT com literais de seed
  }
  if (/INSERT INTO\s+(public\.)?group_actor_memberships[^;]*'[0-9a-f]{8}-/i.test(M)) note('SEED-BACKFILL', 'migration semeia membership com UUID literal');
  if (/INSERT INTO\s+(public\.)?group_actor_memberships\s*\(\s*SELECT|INSERT INTO\s+(public\.)?group_actor_memberships[\s\S]{0,400}?SELECT[\s\S]{0,400}?FROM\s+group_members\b/i.test(M)) {
    note('SEED-BACKFILL', 'migration executa BACKFILL do legado (proibido no D9.2-A)');
  }
}

// ══ D · CUTOVER D9.2-B CONSUMADO (legado congelado; regressão MORDE) ══
{
  // /join e /leave: sujeito = PRINCIPAL AUTENTICADO server-side; actionContext NUNCA é identidade
  const sliceBetween = (code, a, b) => {
    const i = code.indexOf(a);
    if (i < 0) return '';
    const j = b ? code.indexOf(b, i + a.length) : -1;
    return j > i ? code.slice(i, j) : code.slice(i);
  };
  const joinLeave = sliceBetween(GROUPS_ROUTES.s, "'/:id/join'", "'/:id/members'");
  if (!joinLeave) note('CUTOVER-REGRESSION', 'rotas /join|/leave não localizadas em groups.routes.ts');
  else {
    if (!/req\.user\.userId|req\.user\?\.userId/.test(joinLeave)) {
      note('CUTOVER-REGRESSION', '/join|/leave perderam o sujeito autenticado server-side (req.user.userId)');
    }
    if (/const \w+ = req\.actionContext(!)?\.actorId/.test(joinLeave)) {
      note('CUTOVER-REGRESSION', '/join|/leave voltaram a usar actionContext.actorId como identidade');
    }
  }
  // role-authority RETIRADA (D11/D16): nenhum resquício em código vivo do módulo/eventos
  if (/isUserAdminOrOwner/.test(GROUPS_SVC.s + GROUPS_REPO.s + GROUPS_ROUTES.s + EVENTS_B3.s)) {
    note('CUTOVER-REGRESSION', 'role-como-autoridade (isUserAdminOrOwner) voltou — retirada no cutover D9.2-B');
  }
  // legado CONGELADO: nenhuma escrita e nenhuma leitura de group_members no módulo groups
  if (/INSERT INTO group_members|UPDATE group_members\b|DELETE FROM group_members/.test(GROUPS_REPO.s + GROUPS_SVC.s + GROUPS_ROUTES.s)) {
    note('CUTOVER-REGRESSION', 'escrita legada em group_members voltou ao módulo groups (casa congelada — D4)');
  }
  if (/\bgroup_members\b/.test(GROUPS_REPO.s) || /\bgroup_members\b/.test(GROUPS_SVC.s) || /\bgroup_members\b/.test(GROUPS_ROUTES.s)) {
    note('CUTOVER-REGRESSION', 'reader legado de group_members voltou ao módulo groups (verdade única = casa nova)');
  }
  // events-B3: reader convergido — código do módulo events NÃO referencia group_members
  if (/\bgroup_members\b/.test(EVENTS_B3.s)) {
    note('CUTOVER-REGRESSION', 'events-sprint76 voltou a ler group_members (reader migrado no cutover)');
  }
  for (const f of walk(resolve(ROOT, 'src/modules/events'))) {
    if (/\.test\.|\.spec\./.test(f)) continue;
    if (/\bgroup_members\b/.test(stripTs(read(f)))) note('CUTOVER-REGRESSION', `${norm(f)} referencia group_members (legado congelado)`);
  }
  // writers do flip presentes: módulo groups usa o service governado da casa nova
  if (!/groupActorMembershipService\./.test(GROUPS_SVC.s)) {
    note('CUTOVER-REGRESSION', 'groups.service não usa mais o service governado da membership (flip revertido?)');
  }
  // caps preservados (criação 1; participação 3 — agora contada na casa nova, D12)
  if (!/INITIAL_LIMIT = 1\b/.test(POLICY.s)) note('CUTOVER-REGRESSION', 'cap de criação alterado');
  if (!/currentCount >= 3\)/.test(GROUPS_SVC.s) || /currentCount >= 3\d/.test(GROUPS_SVC.s)) note('CUTOVER-REGRESSION', 'cap de participação alterado');
  // fundação não toca o legado; sem predicados mistos de namespace em toda a família
  if (/\bgroup_members\b/.test(SVC.s) || /\bgroup_members\b/.test(REPO.s)) note('DUAL-WRITE', 'fundação Actor-first toca group_members');
  if (/user_id OR actor_id|actor_id OR user_id/i.test(SVC.s + REPO.s + SHADOW.s + GROUPS_SVC.s + GROUPS_REPO.s + GROUPS_ROUTES.s)) {
    note('NAMESPACE-FALLBACK', 'fallback/predicado misto user OR actor detectado');
  }
  // fallback triplo do acceptInvite (superfície 5) não pode renascer
  if (/invitedUserId === userContext/.test(GROUPS_SVC.s)) {
    note('NAMESPACE-FALLBACK', 'fallback triplo userId‖globalUserId‖id voltou ao aceite de convite');
  }
}

// ══ E · LIFECYCLE ══
{
  if (!/BEFORE UPDATE OR DELETE ON group_actor_memberships/i.test(M)) note('DELETE-PATH', 'trigger não cobre DELETE');
  if (!/GAM_DELETE_FORBIDDEN/.test(FN_IMMUT)) note('DELETE-PATH', 'GAM_DELETE_FORBIDDEN ausente');
  if (!/OLD\.status IN \('left', 'removed'\)[\s\S]{0,200}?GAM_IMMUTABLE_TERMINAL/.test(FN_IMMUT)) {
    note('REACTIVATION', 'terminalidade left/removed (GAM_IMMUTABLE_TERMINAL) ausente');
  }
  if (!/NEW\.member_actor_id IS DISTINCT FROM OLD\.member_actor_id/.test(FN_IMMUT)) note('IMMUTABLE-FIELD', 'imutabilidade de member_actor_id ausente');
  if (!/NEW\.group_id IS DISTINCT FROM OLD\.group_id/.test(FN_IMMUT)) note('IMMUTABLE-FIELD', 'imutabilidade de group_id ausente');
  const chk = M.match(/CONSTRAINT chk_gam_status CHECK \(status IN \(([^)]*)\)\)/i);
  if (!chk) note('LIFECYCLE-VOCAB', 'chk_gam_status ausente');
  else {
    const vals = [...chk[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    const extra = vals.filter((v) => !['active', 'left', 'removed'].includes(v));
    if (extra.length) note('LIFECYCLE-VOCAB', `vocabulário excede active|left|removed: ${extra.join(',')}`);
    for (const banned of ['banned', 'suspended', 'archived']) {
      if (vals.includes(banned)) note('LIFECYCLE-EXTRA', `estado proibido no v1: ${banned}`);
    }
  }
  if (!/chk_gam_lifecycle_shape/.test(M)) note('LIFECYCLE-SHAPE', 'CHECK de shape do lifecycle ausente');
  const uq = M.match(/CREATE UNIQUE INDEX\s+uq_gam_active_membership\s+ON group_actor_memberships\s*\(([^)]*)\)\s*WHERE\s+([^;]+);/i);
  if (!uq) note('ACTIVE-UNIQUE-MISSING', 'unicidade ativa ausente');
  else {
    if (!/tenant_id/.test(uq[1])) note('ACTIVE-UNIQUE-TENANT', 'unicidade ativa sem tenant_id');
    if (!/group_id/.test(uq[1]) || !/member_actor_id/.test(uq[1])) note('ACTIVE-UNIQUE-MISSING', 'unicidade ativa sem group+member');
    if (!/status\s*=\s*'active'/.test(uq[2])) note('ACTIVE-UNIQUE-MISSING', "WHERE status='active' ausente");
  }
  if (!/GAM_OWNER_CANNOT_LEAVE/.test(FN_LEAVE)) note('OWNER-EXIT', 'bloqueio de saída do owner ausente');
  if (!/GAM_OWNER_CANNOT_BE_REMOVED/.test(FN_REMOVE)) note('OWNER-EXIT', 'bloqueio de remoção do owner ausente');
  if (!/GAM_SELF_MEMBERSHIP/.test(FN_ENTER)) note('SELF-MEMBERSHIP', 'check anti-self ausente do fn_enter');
  if (!/CREATE UNIQUE INDEX\s+uq_gam_entry_idempotency\s+ON group_actor_memberships \(tenant_id, entry_idempotency_key\)/i.test(M)) {
    note('ENTRY-IDEMPOTENCY', 'idempotência de entrada tenant-scoped ausente');
  }
  if (!/GAM_IDEMPOTENCY_MISMATCH/.test(FN_ENTER)) note('IDEMPOTENCY-WEAK', 'mismatch fail-closed ausente do fn_enter');
  if (/globalUserId|global_user_id/.test(SVC.s + REPO.s)) note('GLOBAL-AS-ACTOR', 'fundação usa global_user_id fora do read-model de medição');
}

// ══ F · TENANT / RLS / ACL ══
{
  for (const fk of ['fk_gam_group_tenant', 'fk_gam_member_tenant', 'fk_gam_created_by_tenant', 'fk_gam_left_by_tenant', 'fk_gam_removed_by_tenant', 'fk_gam_source_intent_tenant']) {
    if (!new RegExp(`CONSTRAINT ${fk}\\s+FOREIGN KEY \\(tenant_id,`, 'i').test(M)) {
      note('CROSS-TENANT', `FK composta ${fk} ausente/simples`);
    }
  }
  if (!/fn_assert_actors_in_tenant/.test(FN_ENTER) || !/fn_assert_actors_in_tenant/.test(FN_INTENT)) {
    note('CROSS-TENANT', 'fn_assert_actors_in_tenant ausente de enter/intent');
  }
  if (!/ALTER TABLE group_actor_memberships ENABLE ROW LEVEL SECURITY/i.test(M)) note('RLS-NOT-FORCED', 'ENABLE RLS ausente');
  if (!/ALTER TABLE group_actor_memberships FORCE ROW LEVEL SECURITY/i.test(M)) note('RLS-NOT-FORCED', 'FORCE RLS ausente');
  if (!/CREATE POLICY\s+group_actor_memberships_rls[\s\S]{0,300}?app\.current_tenant/i.test(M)) note('RLS-NOT-FORCED', 'policy tenant-scoped ausente');
  if (!/REVOKE INSERT, UPDATE, DELETE ON group_actor_memberships FROM unificard_app/i.test(M)) note('DIRECT-DML', 'fronteira de escrita (REVOKE DML app) ausente');
  if (!/REVOKE ALL ON group_actor_memberships FROM PUBLIC/i.test(M)) note('DIRECT-DML', 'REVOKE PUBLIC ausente');
  const defs = [...MIG_RAW.matchAll(/CREATE FUNCTION (fn_[a-z_]+)\([\s\S]*?\$func\$/gi)].map((m) => m[0]);
  for (const d of defs) {
    const name = (d.match(/CREATE FUNCTION (fn_[a-z_]+)/i) || [])[1];
    if (/SECURITY DEFINER/i.test(d) && !/SET search_path = pg_catalog, pg_temp/i.test(d)) {
      note('DEFINER-UNGOVERNED', `${name} SECURITY DEFINER sem search_path pinado`);
    }
  }
  for (const fn of ['fn_enter_group_actor_membership', 'fn_leave_group_actor_membership', 'fn_remove_group_actor_membership', 'fn_create_group_membership_intent', 'fn_accept_group_membership_intent']) {
    if (!new RegExp(`REVOKE EXECUTE ON FUNCTION ${fn}[^;]*FROM PUBLIC`, 'i').test(M)) note('DEFINER-UNGOVERNED', `${fn} sem REVOKE PUBLIC`);
    if (!new RegExp(`GRANT EXECUTE ON FUNCTION ${fn}[^;]*TO unificard_app`, 'i').test(M)) note('DEFINER-UNGOVERNED', `${fn} sem GRANT governado`);
  }
  for (const f of walk(resolve(ROOT, 'src/modules/groups'))) {
    if (/\.test\.|\.spec\./.test(f)) continue;
    const s = stripTs(read(f));
    if (/INSERT\s+INTO\s+group_actor_memberships/i.test(s)) note('DIRECT-DML', `${norm(f)} INSERT direto na casa nova`);
    if (/UPDATE\s+group_actor_memberships/i.test(s)) note('DIRECT-DML', `${norm(f)} UPDATE direto na casa nova`);
    if (/DELETE\s+FROM\s+group_actor_memberships/i.test(s)) note('DELETE-PATH', `${norm(f)} DELETE na casa nova`);
  }
}

// ══ G · AUTHORITY ══
{
  const total = (SVC.s.match(/canRepresentActor\(/g) || []).length;
  const withClient = (SVC.s.match(/canRepresentActor\(\s*\n?\s*tenantId,\s*\n?\s*actingUserId,\s*\n?\s*[A-Za-z_.]+,\s*\n?\s*client\s*\n?\s*\)/g) || []).length;
  if (total === 0) note('AUTHORITY-OUT-OF-TX', 'service sem chamadas canRepresentActor');
  if (withClient !== total) note('AUTHORITY-OUT-OF-TX', `${total - withClient} chamada(s) canRepresentActor SEM o client transacional`);
  const helper = SVC.s.match(/withAuthorityTransaction[\s\S]*?\n  \}/);
  if (!helper) note('TX-OWNER', 'withAuthorityTransaction ausente');
  else {
    const h = helper[0];
    for (const tok of ["pool.connect", "'BEGIN'", "'COMMIT'", "'ROLLBACK'", 'finally', 'client.release()']) {
      if (!h.includes(tok)) note('TX-OWNER', `transaction owner sem ${tok}`);
    }
    const iBegin = h.indexOf("'BEGIN'"); const iAdv = h.indexOf('pg_advisory_xact_lock');
    const iFn = h.indexOf('fn(client)'); const iCommit = h.indexOf("'COMMIT'");
    if (!(iBegin >= 0 && iAdv > iBegin && iFn > iAdv && iCommit > iFn)) note('TX-ORDER', 'ordem BEGIN→advisory→fn→COMMIT violada');
  }
  if ((SVC.s.match(/pool\.connect/g) || []).length !== 1) note('HELPER-OWN-CLIENT', 'pool.connect fora do transaction owner único');
  if (/pool\.connect/.test(REPO.s)) note('HELPER-OWN-CLIENT', 'repository abre client próprio');
  if (/\.catch\(\s*\(\)?\s*=>\s*false\)/.test(SVC.s)) note('INFRA-ERROR-MASKED', 'authority convertida em false');
  if (/actionContext/.test(SVC.s + REPO.s)) note('PAYLOAD-AUTHORITY', 'actionContext usado na fundação');
  if (/req\.(body|query|params)/.test(SVC.s + REPO.s)) note('PAYLOAD-AUTHORITY', 'payload HTTP na fundação');
  // membership NÃO cria grant/capability; SQL não duplica authority (company_users/actor_delegations)
  if (/\bcompany_users\b|\bactor_delegations\b/i.test(M)) note('AUTH-SQL-DUP', 'migration referencia casas de evidência de authority');
  for (const [name, body] of [['fn_enter', FN_ENTER], ['fn_leave', FN_LEAVE], ['fn_remove', FN_REMOVE], ['fn_intent', FN_INTENT], ['fn_accept', FN_ACCEPT]]) {
    const inserts = [...body.matchAll(/INSERT\s+INTO\s+([a-z_.]+)/gi)].map((x) => x[1].replace('public.', ''));
    const bad = inserts.filter((t) => !['group_actor_memberships', 'group_invites'].includes(t));
    if (bad.length) note('GRANT-FROM-MEMBERSHIP', `${name} insere em casa alheia: ${bad.join(',')}`);
  }
  for (const [name, body] of [['fn_enter', FN_ENTER], ['fn_leave', FN_LEAVE], ['fn_remove', FN_REMOVE], ['fn_intent', FN_INTENT], ['fn_accept', FN_ACCEPT]]) {
    if (body && !/pg_advisory_xact_lock/.test(body)) note('WRITER-NO-LOCK', `${name} sem advisory lock`);
  }
}

// ══ H · INTENTS ══
{
  const kind = M.match(/chk_gi_intent_kind\s*\n?\s*CHECK \(intent_kind IS NULL OR intent_kind IN \(([^)]*)\)\)/i);
  if (!kind) note('INTENT-KIND', 'chk_gi_intent_kind ausente (NULL nunca é invite; vocabulário fechado)');
  else {
    const vals = [...kind[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    if (vals.join(',') !== 'invite,request') note('INTENT-KIND', `vocabulário divergente: ${vals.join(',')}`);
  }
  if (!/chk_gi_intent_coherence/.test(M)) note('INTENT-KIND', 'coerência do trio de intent ausente (sem estado híbrido)');
  const pend = M.match(/CREATE UNIQUE INDEX\s+uq_gi_new_intent_pending[\s\S]{0,250}?WHERE\s+([^;]+);/i);
  if (!pend) note('INTENT-PENDING-UNIQUE', 'unicidade pendente do caminho novo ausente');
  else if (!/intent_kind IS NOT NULL/.test(pend[1]) || !/status\s*=\s*'pending'/.test(pend[1])) {
    note('INTENT-UNIQUE-HISTORIC', 'unique do caminho novo cobre históricos/legado (deve ser pending-only + intent_kind NOT NULL)');
  }
  if (!/uq_gi_intent_idempotency[\s\S]{0,200}?WHERE intent_idempotency_key IS NOT NULL/i.test(M)) {
    note('INTENT-IDEMPOTENCY', 'idempotência tenant-scoped da intenção ausente');
  }
  if (/DROP\s+CONSTRAINT\s+uq_group_invite\b|DROP INDEX\s+.*uq_group_invite/i.test(M)) {
    note('ANTI-CUTOVER', 'UNIQUE legado de invites retirado (ato do cutover D9.2-B)');
  }
  if (!/GAM_INTENT_LEGACY_UNIQUE_RESIDUAL/.test(FN_INTENT)) note('INTENT-RESIDUAL', 'residual do UNIQUE legado não sinalizado fail-closed');
  // aceite ATÔMICO: fn_accept usa fn_enter + UPDATE accepted no MESMO corpo
  if (!/fn_enter_group_actor_membership\(/.test(FN_ACCEPT)) note('INTENT-NOT-ATOMIC', 'fn_accept não reusa fn_enter na mesma transação');
  if (!/SET status = 'accepted'/.test(FN_ACCEPT)) note('INTENT-NOT-ATOMIC', 'fn_accept não termina a intent (accepted) na mesma transação');
  if (!/GAM_INTENT_INCONSISTENT/.test(FN_ACCEPT)) note('INTENT-NOT-ATOMIC', 'invariante accepted-sem-membership não é fail-closed');
  if (!/GAM_INTENT_KIND_INVALID/.test(FN_INTENT)) note('INTENT-KIND', 'direção implícita tolerada no writer de intent');
  if (!/WHEN \(OLD\.intent_kind IS NOT NULL\)/i.test(M)) note('INTENT-TRIGGER', 'trigger do caminho novo não é restrito a intent_kind NOT NULL (legado deve passar livre)');
  if (!/GAM_INTENT_DELETE_FORBIDDEN/.test(FN_GI_IMMUT)) note('INTENT-TRIGGER', 'DELETE do caminho novo não bloqueado');
}

// ══ I · FRONTEIRAS ══
{
  if (/bank_ledger|bank_transactions|bank_splits|bank_accounts|group_accounts|balance_cents/i.test(M + SVC.s + REPO.s + SHADOW.s)) {
    note('BANK-TOUCH', 'superfície D9.2-A referencia Bank/contas');
  }
  if (/@modules\/bank|modules\/bank\//.test(SVC.s + REPO.s + SHADOW.s)) note('BANK-TOUCH', 'import de módulo bank');
  if (/organization_(members|units|roles|invites)/i.test(M + SVC.s + REPO.s)) note('ORganization-REVIVAL'.toUpperCase(), 'referência a organization_* tombstone');
  if (/audience/i.test(stripTs(SVC.raw)) || /audience/i.test(M)) note('AUDIENCE-OPEN', 'fundação referencia audience (D9.4 fechada)');
  // shadow: pureza (read-only; sem escrita; sem email/nome; sem fallback de casa)
  if (/INSERT|UPDATE|DELETE/i.test(SHADOW.s.replace(/SELECT[\s\S]*?FROM/gi, ''))) note('SHADOW-PURITY', 'shadow read-model contém escrita');
  if (/email|display_name/i.test(SHADOW.s)) note('SHADOW-PURITY', 'shadow usa email/nome como resolução');
  if (/group_actor_memberships/.test(SHADOW.s)) note('SHADOW-PURITY', 'shadow lê a casa nova como fallback do legado');
}

// ══ RUNNER ══
{
  const n = (RUNNER.s.match(/audit-group-actor-membership-foundation\.mjs/g) || []).length;
  if (n !== 1) note('RUNNER-WIRING', `guard D9.2-A aparece ${n}× no runner (esperado 1)`);
  const guardFiles = readdirSync(resolve(ROOT, 'scripts')).filter((f) => /group-actor-membership.*\.mjs$/.test(f));
  const expected = ['audit-group-actor-membership-foundation-mutations.mjs', 'audit-group-actor-membership-foundation.mjs'];
  const extra = guardFiles.filter((f) => !expected.includes(f));
  if (extra.length) note('SECOND-GUARD', `guard paralelo: ${extra.join(', ')}`);
}

if (fails.length) {
  console.error('❌ audit-group-actor-membership-foundation — violações:');
  for (const f of fails) console.error('   ' + f);
  process.exit(1);
}
console.log('✅ audit-group-actor-membership-foundation — fundação Actor-first íntegra; cutover D9.2-B (DECISION-0188) consumado e travado.');
