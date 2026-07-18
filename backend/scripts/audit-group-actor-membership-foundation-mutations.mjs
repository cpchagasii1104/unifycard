#!/usr/bin/env node
// audit-group-actor-membership-foundation-mutations.mjs — HARNESS de mutações do guard 189
// (D9.2-A, DECISION-0188). 38 vetores HOSTIS isolados (M01–M38) + 6 controles BENIGNOS (B01–B06).
// Cada vetor: execução própria, alteração física própria (mutação de arquivo real OU fixture
// hostil temporária na superfície auditada), exige exit!=0 do guard COM o marcador específico e
// restauração byte-exata (sha1) / remoção da fixture. Falha se: guard passar num hostil, falhar
// num benigno, marcador ausente, restauração incompleta, resíduo ou contagem divergente.
// Não toca DB. Todos os arquivos reais ficam byte-intactos ao final.
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = 'scripts/audit-group-actor-membership-foundation.mjs';

const FILES = {
  MIG: resolve(ROOT, 'migrations/20260718120000_group_actor_memberships.sql'),
  SVC: resolve(ROOT, 'src/modules/groups/group-actor-membership.service.ts'),
  REPO: resolve(ROOT, 'src/modules/groups/group-actor-membership.repository.ts'),
  SHADOW: resolve(ROOT, 'src/modules/groups/group-membership-shadow.readmodel.ts'),
  GROUTES: resolve(ROOT, 'src/modules/groups/groups.routes.ts'),
  GREPO: resolve(ROOT, 'src/modules/groups/groups.repository.ts'),
  EVENTS: resolve(ROOT, 'src/modules/events/events-sprint76.routes.ts'),
  RUNNER: resolve(ROOT, 'scripts/run-regression-guards.mjs'),
};
const FIX_CALLER = resolve(ROOT, 'src/modules/groups/__gam_caller_fixture.ts');
const FIX_SECOND_GUARD = resolve(ROOT, 'scripts/audit-group-actor-membership-foundation-shadow.mjs');

const sha = (p) => (existsSync(p) ? createHash('sha1').update(readFileSync(p)).digest('hex') : 'ABSENT');
const ORIG = Object.fromEntries(Object.entries(FILES).map(([k, p]) => [k, readFileSync(p, 'utf8')]));
const HASH0 = Object.fromEntries(Object.entries(FILES).map(([k, p]) => [k, sha(p)]));
const fails = [];

function runGuard() {
  try { const out = execSync(`node ${GUARD}`, { cwd: ROOT, stdio: 'pipe' }).toString(); return { failed: false, out }; }
  catch (e) { return { failed: true, out: `${e.stdout || ''}${e.stderr || ''}` }; }
}
function restoreAll() {
  for (const [k, p] of Object.entries(FILES)) writeFileSync(p, ORIG[k]);
  for (const f of [FIX_CALLER, FIX_SECOND_GUARD]) if (existsSync(f)) rmSync(f);
}
function mutateFile(fileKey, from, to, { all = false } = {}) {
  const cur = readFileSync(FILES[fileKey], 'utf8');
  if (!cur.includes(from)) throw new Error(`from-string ausente em ${fileKey}: ${from.slice(0, 70)}...`);
  const next = all ? cur.split(from).join(to) : cur.replace(from, to);
  if (next === cur) throw new Error(`mutação sem efeito em ${fileKey}`);
  writeFileSync(FILES[fileKey], next);
}

const HOSTILE = [
  // ── casa/identidade ──
  ['M01', 'ACTIVE-UNIQUE-TENANT', () => mutateFile('MIG',
    'ON group_actor_memberships (tenant_id, group_id, member_actor_id)\n  WHERE',
    'ON group_actor_memberships (group_id, member_actor_id)\n  WHERE')],
  ['M02', 'IDENTITY-MISSING', () => mutateFile('MIG',
    '  member_actor_id       UUID        NOT NULL,',
    '  member_user_ref       UUID        NOT NULL,')],
  ['M03', 'GLOBALID-IN-HOUSE', () => mutateFile('MIG',
    '  member_actor_id       UUID        NOT NULL,',
    '  member_actor_id       UUID        NOT NULL,\n  global_user_id        UUID,')],
  ['M04', 'LEGACY-ACTOR-COLUMN', () => mutateFile('MIG', '\nCOMMIT;\n',
    '\nALTER TABLE group_members ADD COLUMN member_actor_id UUID;\nCOMMIT;\n')],
  ['M05', 'DELETE-PATH', () => mutateFile('MIG',
    'BEFORE UPDATE OR DELETE ON group_actor_memberships',
    'BEFORE UPDATE ON group_actor_memberships')],
  ['M06', 'REACTIVATION', () => mutateFile('MIG', "GAM_IMMUTABLE_TERMINAL", "GAM_X_TERMINAL", { all: true })],
  ['M07', 'LIFECYCLE-SHAPE', () => mutateFile('MIG', 'CONSTRAINT chk_gam_lifecycle_shape CHECK', 'CONSTRAINT chk_gam_shape_x CHECK')],
  ['M08', 'RLS-NOT-FORCED', () => mutateFile('MIG', 'ALTER TABLE group_actor_memberships ENABLE ROW LEVEL SECURITY;\n', '')],
  ['M09', 'RLS-NOT-FORCED', () => mutateFile('MIG', 'ALTER TABLE group_actor_memberships FORCE ROW LEVEL SECURITY;\n', '')],
  ['M10', 'DIRECT-DML', () => mutateFile('MIG', 'REVOKE INSERT, UPDATE, DELETE ON group_actor_memberships FROM unificard_app;\n', '')],
  ['M11', 'CROSS-TENANT', () => mutateFile('MIG',
    'CONSTRAINT fk_gam_member_tenant     FOREIGN KEY (tenant_id, member_actor_id)     REFERENCES actors (tenant_id, id) ON DELETE RESTRICT,',
    'CONSTRAINT fk_gam_member_tenant     FOREIGN KEY (member_actor_id)     REFERENCES actors (id) ON DELETE RESTRICT,')],
  // ── elegibilidade ──
  ['M12', 'MEMBER-CHANNEL', () => mutateFile('MIG', "actor_type NOT IN ('user', 'page', 'group')", "actor_type NOT IN ('user', 'page', 'group', 'channel')")],
  ['M13', 'MEMBER-SYSTEM', () => mutateFile('MIG', "actor_type NOT IN ('user', 'page', 'group')", "actor_type NOT IN ('user', 'page', 'group', 'system')")],
  ['M14', 'BINDING-AS-MEMBERSHIP', () => mutateFile('MIG', "'GAM_MEMBER_GROUP_NOT_ROOT:", "'GAM_X_NOT_ROOT:")],
  ['M15', 'SELF-MEMBERSHIP', () => mutateFile('MIG', "'GAM_SELF_MEMBERSHIP:", "'GAM_X_SELF:", { all: true })],
  ['M16', 'BINDING-AS-MEMBERSHIP', () => mutateFile('MIG', "'GAM_PARENT_CANNOT_JOIN_CHILD:", "'GAM_X_PARENT:")],
  // ── SSOT/ontologia/authority ──
  ['M17', 'MEMBERSHIP-IN-CATEGORY', () => mutateFile('SVC',
    'class GroupActorMembershipService {',
    "const CATEGORY_ELIGIBILITY_SQL = 'SELECT 1 FROM categories WHERE category_id = $1';\nvoid CATEGORY_ELIGIBILITY_SQL;\nclass GroupActorMembershipService {")],
  ['M18', 'ROLE-AS-MEMBERSHIP', () => mutateFile('SVC',
    'class GroupActorMembershipService {',
    "function isAdminByRole(role: string) { return role === 'admin'; }\nvoid isAdminByRole;\nclass GroupActorMembershipService {")],
  ['M19', 'GRANT-FROM-MEMBERSHIP', () => mutateFile('MIG',
    'INSERT INTO public.group_actor_memberships\n    (tenant_id, group_id, member_actor_id, status, entry_idempotency_key, entry_fingerprint,\n     created_by_actor_id, source_intent_id)',
    "INSERT INTO public.actor_capability_grants (tenant_id) VALUES (p_tenant_id);\n  INSERT INTO public.group_actor_memberships\n    (tenant_id, group_id, member_actor_id, status, entry_idempotency_key, entry_fingerprint,\n     created_by_actor_id, source_intent_id)")],
  // ── dormência/anti-cutover ──
  ['M20', 'DORMANCY', () => writeFileSync(FIX_CALLER,
    "import { groupActorMembershipService } from './group-actor-membership.service';\nexport function registerGamRoutes(app: { post: (p: string, h: () => void) => void }) { app.post('/groups/:id/actor-join', () => { void groupActorMembershipService; }); }\n")],
  ['M21', 'ANTI-CUTOVER', () => mutateFile('GROUTES', 'const userId = req.actionContext.actorId;', 'const userId = req.user!.userId;', { all: true })],
  ['M22', 'ANTI-CUTOVER', () => mutateFile('GREPO', 'INSERT INTO group_members', 'INSERT INTO group_members_legacy_off')],
  ['M23', 'ANTI-CUTOVER', () => mutateFile('EVENTS', 'group_members', 'legacy_members', { all: true })],
  ['M24', 'DUAL-WRITE', () => mutateFile('REPO',
    'export const groupActorMembershipRepository = new GroupActorMembershipRepository();',
    "export const LEGACY_SYNC_SQL = 'INSERT INTO group_members (tenant_id) VALUES ($1)';\nexport const groupActorMembershipRepository = new GroupActorMembershipRepository();")],
  ['M25', 'DUAL-WRITE', () => mutateFile('GREPO',
    'async addMember(tenantId: string, groupId: string, userId: string,',
    "NEW_HOUSE_SQL = 'SELECT id FROM group_actor_memberships LIMIT 1';\n  async addMember(tenantId: string, groupId: string, userId: string,")],
  ['M26', 'SEED-BACKFILL', () => mutateFile('MIG', '\nCOMMIT;\n',
    "\nINSERT INTO public.group_actor_memberships (tenant_id, group_id, member_actor_id, status, entry_idempotency_key, entry_fingerprint, created_by_actor_id)\nSELECT gm.tenant_id, gm.group_id, a.id, 'active', 'bf:'||gm.id::text, 'bf', a.id FROM group_members gm JOIN actors a ON a.user_id = gm.user_id;\nCOMMIT;\n")],
  ['M27', 'SEED-BACKFILL', () => mutateFile('MIG', '\nCOMMIT;\n',
    "\nINSERT INTO public.group_actor_memberships (tenant_id, group_id, member_actor_id, status, entry_idempotency_key, entry_fingerprint, created_by_actor_id) VALUES ('11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'active', 'seed', 'seed', '33333333-3333-3333-3333-333333333333'::uuid);\nCOMMIT;\n")],
  // ── intents ──
  ['M28', 'INTENT-NOT-ATOMIC', () => mutateFile('MIG', "  UPDATE public.group_invites\n     SET status = 'accepted', responded_at = now()\n   WHERE id = v_i.id;\n\n  RETURN v_mid;", '  RETURN v_mid;')],
  ['M29', 'ENTRY-IDEMPOTENCY', () => mutateFile('MIG',
    'CREATE UNIQUE INDEX uq_gam_entry_idempotency\n  ON group_actor_memberships (tenant_id, entry_idempotency_key);',
    'CREATE UNIQUE INDEX uq_gam_entry_idempotency\n  ON group_actor_memberships (entry_idempotency_key);')],
  ['M30', 'IDEMPOTENCY-WEAK', () => mutateFile('MIG', "RAISE EXCEPTION 'GAM_IDEMPOTENCY_MISMATCH: chave de entrada reutilizada com payload divergente.';", "RAISE EXCEPTION 'GAM_KEY_DIFF: divergente.';")],
  ['M31', 'PAYLOAD-AUTHORITY', () => mutateFile('SVC',
    '      const actingActor = await ensureUserActorTx(client, tenantId, actingUserId);\n      // self: member = o PRÓPRIO user-actor resolvido server-side (sem canRepresentActor extra)',
    '      const actingActor = await ensureUserActorTx(client, tenantId, actingUserId);\n      const hinted = (input as { actionContext?: { actorId?: string } }).actionContext?.actorId;\n      void hinted;\n      // self: member = o PRÓPRIO user-actor resolvido server-side (sem canRepresentActor extra)')],
  ['M32', 'GLOBAL-AS-ACTOR', () => mutateFile('SVC',
    'class GroupActorMembershipService {',
    'function actorFromGlobal(globalUserId: string) { return globalUserId; }\nvoid actorFromGlobal;\nclass GroupActorMembershipService {')],
  ['M33', 'BANK-TOUCH', () => mutateFile('SVC',
    'class GroupActorMembershipService {',
    "const GAM_BANK_PROBE_SQL = 'SELECT 1 FROM bank_ledger LIMIT 1';\nvoid GAM_BANK_PROBE_SQL;\nclass GroupActorMembershipService {")],
  ['M34', 'GRANTS-AS-MEMBERSHIP', () => mutateFile('MIG', '\nCOMMIT;\n', '\nSELECT count(*) FROM actor_delegations;\nCOMMIT;\n')],
  ['M35', 'SECOND-GUARD', () => writeFileSync(FIX_SECOND_GUARD, '#!/usr/bin/env node\nprocess.exit(0);\n')],
  ['M36', 'RUNNER-WIRING', () => mutateFile('RUNNER',
    '  "node scripts/audit-group-actor-membership-foundation.mjs"',
    '  "node scripts/audit-group-actor-membership-foundation.mjs",\n  "node scripts/audit-group-actor-membership-foundation.mjs"')],
  ['M37', 'INTENT-KIND', () => mutateFile('MIG', "CHECK (intent_kind IS NULL OR intent_kind IN ('invite', 'request'))", "CHECK (intent_kind IS NULL OR intent_kind IN ('invite', 'request', 'proposal'))")],
  ['M38', 'INTENT-UNIQUE-HISTORIC', () => mutateFile('MIG',
    "WHERE intent_kind IS NOT NULL AND status = 'pending';",
    'WHERE intent_kind IS NOT NULL;')],
];

const BENIGN = [
  ['B01', () => mutateFile('MIG', '-- ============================================================\n\nBEGIN;', '-- ============================================================\n-- nota benigna de manutencao\n\nBEGIN;')],
  ['B02', () => mutateFile('SVC', 'export const groupActorMembershipService = new GroupActorMembershipService();\n', 'export const groupActorMembershipService = new GroupActorMembershipService();\n// nota benigna\n')],
  ['B03', () => mutateFile('REPO', 'export const groupActorMembershipRepository = new GroupActorMembershipRepository();\n', 'export const groupActorMembershipRepository = new GroupActorMembershipRepository();\n// nota benigna\n')],
  ['B04', () => mutateFile('SHADOW', 'import { runQueriesWithTenant }', '// leitura pura de medição\nimport { runQueriesWithTenant }')],
  ['B05', () => mutateFile('MIG', 'COMMENT ON TABLE group_actor_memberships IS', '-- comentario benigno da casa\nCOMMENT ON TABLE group_actor_memberships IS')],
  ['B06', () => mutateFile('RUNNER', '  "node scripts/audit-group-actor-membership-foundation.mjs"', '  "node scripts/audit-group-actor-membership-foundation.mjs" /* guard 189 */')],
];

{
  const r = runGuard();
  if (r.failed) { console.error('❌ baseline: guard falhou ANTES das mutações:\n' + r.out); process.exit(1); }
}

let executed = 0;
for (const [id, marker, apply] of HOSTILE) {
  try {
    apply();
    const r = runGuard();
    if (!r.failed) fails.push(`${id}: guard PASSOU com mutação hostil (${marker})`);
    else if (!r.out.includes(`[${marker}]`)) fails.push(`${id}: falhou SEM o marcador [${marker}] — ${r.out.slice(0, 260)}`);
    executed++;
  } catch (e) {
    fails.push(`${id}: erro ao aplicar mutação — ${e.message}`);
  } finally {
    restoreAll();
  }
}
for (const [id, apply] of BENIGN) {
  try {
    apply();
    const r = runGuard();
    if (r.failed) fails.push(`${id}: guard FALHOU com controle benigno — ${r.out.slice(0, 260)}`);
    executed++;
  } catch (e) {
    fails.push(`${id}: erro no benigno — ${e.message}`);
  } finally {
    restoreAll();
  }
}

for (const [k, p] of Object.entries(FILES)) {
  if (sha(p) !== HASH0[k]) fails.push(`RESTAURAÇÃO: ${k} não voltou byte-exato`);
}
for (const f of [FIX_CALLER, FIX_SECOND_GUARD]) {
  if (existsSync(f)) fails.push(`RESÍDUO: fixture ${f} não removida`);
}
if (executed !== HOSTILE.length + BENIGN.length) fails.push(`CONTAGEM: ${executed} ≠ ${HOSTILE.length + BENIGN.length}`);

if (fails.length) {
  console.error(`❌ mutations D9.2-A — ${fails.length} problema(s):`);
  for (const f of fails) console.error('   ' + f);
  process.exit(1);
}
console.log(`✅ mutations D9.2-A — ${HOSTILE.length} hostis individualizados morderam com marcador próprio + ${BENIGN.length} benignos passaram; restauração byte-exata; resíduo zero.`);
