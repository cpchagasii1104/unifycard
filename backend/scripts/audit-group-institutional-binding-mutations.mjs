#!/usr/bin/env node
// audit-group-institutional-binding-mutations.mjs — HARNESS de mutações do guard 188 (D9.1,
// DECISION-0186/0187 + remediação AUTHORITY DUAL TRANSACTION BOUNDARY). 53 vetores HOSTIS isolados
// (M01–M40 originais + N01–N13 transacionais) + 6 controles BENIGNOS (B01–B06).
// Cada vetor: execução própria, alteração física própria (mutação de arquivo real OU fixture
// hostil temporária dentro da superfície auditada), exige exit!=0 do guard COM o marcador
// específico, e restauração byte-exata (hash) / remoção da fixture. Falha se: guard passar num
// hostil, falhar num benigno, marcador ausente, restauração incompleta, resíduo ou vetor pulado.
// Não toca DB. Migration/serviço/policy/runner reais ficam byte-intactos ao final.
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = 'scripts/audit-group-institutional-binding.mjs';

const FILES = {
  MIG: resolve(ROOT, 'migrations/20260717120000_group_institutional_bindings.sql'),
  SVC: resolve(ROOT, 'src/modules/groups/group-institutional-binding.service.ts'),
  REPO: resolve(ROOT, 'src/modules/groups/group-institutional-binding.repository.ts'),
  AUTHZ: resolve(ROOT, 'src/core/authorization/authorization.service.ts'),
  POLICY: resolve(ROOT, 'src/modules/groups/policies/group-creation-policy.ts'),
  GSVC: resolve(ROOT, 'src/modules/groups/groups.service.ts'),
  RUNNER: resolve(ROOT, 'scripts/run-regression-guards.mjs'),
};
const FIX_SECOND_GUARD = resolve(ROOT, 'scripts/audit-group-institutional-binding-shadow.mjs');
const FIX_GENERIC = resolve(ROOT, 'src/modules/groups/__gib_mutation_fixture.ts');
const FIX_BINDING = resolve(ROOT, 'src/modules/groups/group-institutional-binding.fixture-hostil.ts');

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
  for (const f of [FIX_GENERIC, FIX_BINDING, FIX_SECOND_GUARD]) if (existsSync(f)) rmSync(f);
}
function mutateFile(fileKey, from, to, { all = false } = {}) {
  const cur = readFileSync(FILES[fileKey], 'utf8');
  if (!cur.includes(from)) throw new Error(`from-string ausente em ${fileKey}: ${from.slice(0, 60)}...`);
  const next = all ? cur.split(from).join(to) : cur.replace(from, to);
  if (next === cur) throw new Error(`mutação sem efeito em ${fileKey}`);
  writeFileSync(FILES[fileKey], next);
}

// [id, marcadorEsperado, aplicar()]
const HOSTILE = [
  // ── parent proibido (whitelist de actor_type do fn_bind) ──
  ['M01', 'PARENT-USER', () => mutateFile('MIG', "actor_type NOT IN ('page', 'group')", "actor_type NOT IN ('page', 'group', 'user')")],
  ['M02', 'PARENT-CHANNEL', () => mutateFile('MIG', "actor_type NOT IN ('page', 'group')", "actor_type NOT IN ('page', 'group', 'channel')")],
  ['M03', 'PARENT-SYSTEM', () => mutateFile('MIG', "actor_type NOT IN ('page', 'group')", "actor_type NOT IN ('page', 'group', 'system')")],
  ['M04', 'PARENT-LEGACY', () => mutateFile('MIG', "actor_type NOT IN ('page', 'group')", "actor_type NOT IN ('page', 'group', 'actor_organizational')")],
  ['M05', 'PARENT-LEGACY', () => mutateFile('MIG', "actor_type NOT IN ('page', 'group')", "actor_type NOT IN ('page', 'group', 'person')")],
  // ── unicidade ativa ──
  ['M06', 'ACTIVE-UNIQUE-TENANT', () => mutateFile('MIG',
    'ON group_institutional_bindings (tenant_id, group_id)\n  WHERE status = \'active\';',
    'ON group_institutional_bindings (group_id)\n  WHERE status = \'active\';')],
  ['M07', 'ACTIVE-UNIQUE-MISSING', () => mutateFile('MIG',
    'CREATE UNIQUE INDEX uq_gib_active_parent\n  ON group_institutional_bindings (tenant_id, group_id)\n  WHERE status = \'active\';',
    'CREATE INDEX uq_gib_active_parent_x\n  ON group_institutional_bindings (tenant_id, group_id);')],
  // ── RLS / fronteira de escrita ──
  ['M08', 'RLS-NOT-FORCED', () => mutateFile('MIG', 'ALTER TABLE group_institutional_bindings FORCE ROW LEVEL SECURITY;\n', '')],
  ['M09', 'RLS-NOT-FORCED', () => mutateFile('MIG', 'REVOKE INSERT, UPDATE, DELETE ON group_institutional_bindings FROM unificard_app;\n', '')],
  // ── lifecycle terminal / imutabilidade ──
  ['M10', 'DELETE-PATH', () => mutateFile('MIG', 'BEFORE UPDATE OR DELETE ON group_institutional_bindings', 'BEFORE UPDATE ON group_institutional_bindings')],
  ['M11', 'REACTIVATION', () => mutateFile('MIG', "RAISE EXCEPTION 'GIB_IMMUTABLE_RETIRED:", "RAISE EXCEPTION 'GIB_X_RETIRED:")],
  ['M12', 'UPDATE-INSTITUTION', () => mutateFile('MIG', '     OR NEW.institution_actor_id IS DISTINCT FROM OLD.institution_actor_id\n', '')],
  ['M13', 'UPDATE-GROUP-ID', () => mutateFile('MIG', '     OR NEW.group_id IS DISTINCT FROM OLD.group_id\n', '')],
  // ── anti-ciclo v1 ──
  ['M14', 'SELF-LINK', () => mutateFile('MIG', "'GIB_SELF_LINK:", "'GIB_SELFLINK_X:")],
  ['M15', 'PARENT-INTERNAL', () => mutateFile('MIG', "'GIB_PARENT_IS_INTERNAL:", "'GIB_PARENT_X:")],
  ['M16', 'GROUP-HAS-CHILDREN', () => mutateFile('MIG', "'GIB_GROUP_HAS_CHILDREN:", "'GIB_CHILDREN_X:")],
  // ── locks / transação ──
  ['M17', 'WRITER-NO-LOCK', () => mutateFile('MIG',
    "  -- serializacao deterministica por tenant (uma unica chave de lock -> sem deadlock; sem TOCTOU)\n  PERFORM pg_advisory_xact_lock(hashtextextended('group_institutional_bindings:' || p_tenant_id::text, 0));\n\n  -- idempotencia (create)",
    '  -- idempotencia (create)')],
  ['M18', 'CROSS-TENANT', () => mutateFile('MIG',
    'CONSTRAINT fk_gib_group_tenant       FOREIGN KEY (tenant_id, group_id)             REFERENCES groups (tenant_id, id) ON DELETE RESTRICT',
    'CONSTRAINT fk_gib_group_tenant       FOREIGN KEY (group_id)             REFERENCES groups (id) ON DELETE RESTRICT')],
  ['M19', 'CROSS-TENANT', () => mutateFile('MIG',
    '  -- coerencia tenant dos actors participantes (REUSO da helper selada; FOR SHARE; nao-vazante)\n  PERFORM public.fn_assert_actors_in_tenant(p_tenant_id, ARRAY[p_institution_actor_id, p_acting_actor_id]);\n', '')],
  // ── idempotência ──
  ['M20', 'IDEMPOTENCY-WEAK', () => mutateFile('MIG', "RAISE EXCEPTION 'GIB_IDEMPOTENCY_MISMATCH: chave de criacao reutilizada com payload divergente.';", "RAISE EXCEPTION 'GIB_KEY_DIFF: chave divergente.';")],
  ['M21', 'IDEMPOTENCY-WEAK', () => mutateFile('MIG',
    'CREATE UNIQUE INDEX uq_gib_create_idempotency\n  ON group_institutional_bindings (tenant_id, create_idempotency_key);',
    'CREATE UNIQUE INDEX uq_gib_create_idempotency\n  ON group_institutional_bindings (create_idempotency_key);')],
  ['M22', 'SECOND-ACTIVE-PARENT', () => mutateFile('MIG', "'GIB_ACTIVE_BINDING_EXISTS:", "'GIB_HAS_PARENT_X:")],
  // ── autoria ──
  ['M23', 'AUTHORSHIP-MISSING', () => mutateFile('MIG', 'retired_by_actor_id = p_acting_actor_id', 'retired_by_actor_id = retired_by_actor_id')],
  // ── reparent deve reusar as primitivas ──
  ['M24', 'WRITER-NO-TX', () => mutateFile('MIG', 'PERFORM public.fn_retire_group_institutional_binding(', 'PERFORM public.fn_retire_gib_bypass(')],
  // ── escopo da migration ──
  ['M25', 'GROUPS-RLS-SCOPE-CREEP', () => mutateFile('MIG', '\nCOMMIT;\n', '\nALTER TABLE groups ENABLE ROW LEVEL SECURITY;\nCOMMIT;\n')],
  ['M26', 'CREATE-GROUP-IN-WRITER', () => mutateFile('MIG', 'RETURNING id INTO v_new_id;', "RETURNING id INTO v_new_id;\n  INSERT INTO public.groups (id) VALUES (p_group_id);")],
  ['M27', 'DEFINER-UNGOVERNED', () => mutateFile('MIG', 'REVOKE EXECUTE ON FUNCTION fn_bind_group_to_institution(UUID,UUID,UUID,UUID,TEXT) FROM PUBLIC;\n', '')],
  ['M28', 'DEFINER-UNGOVERNED', () => mutateFile('MIG', 'GRANT EXECUTE ON FUNCTION fn_retire_group_institutional_binding(UUID,UUID,UUID,TEXT) TO unificard_app;\n', '')],
  ['M29', 'SECOND-PARENT-COLUMN', () => mutateFile('MIG', '\nCOMMIT;\n', '\nALTER TABLE groups ADD COLUMN institution_actor_id UUID;\nCOMMIT;\n')],
  ['M30', 'ORGANIZATION-REVIVAL', () => mutateFile('MIG', '\nCOMMIT;\n', '\nCREATE TABLE organization_units (id UUID PRIMARY KEY);\nCOMMIT;\n')],
  ['M31', 'BANK-IMPORT', () => mutateFile('MIG', '\nCOMMIT;\n', "\nSELECT count(*) FROM bank_transactions;\nCOMMIT;\n")],
  ['M32', 'NEW-ACTOR-TYPE', () => mutateFile('MIG', '\nCOMMIT;\n',
    "\nALTER TABLE actors ALTER COLUMN actor_type SET DEFAULT 'user'; ALTER TABLE actors ADD CONSTRAINT chk_actor_type_seg CHECK (actor_type IN ('condominium'));\nCOMMIT;\n")],
  // ── service: autoridade dual / infra-error / payload ──
  ['M33', 'SINGLE-SIDED-AUTHORITY', () => mutateFile('SVC',
    "'GIB_GROUP_NOT_REPRESENTED: principal nao representa o group-actor (canRepresentActor lado group).'",
    "'GIB_X: lado group dispensado.'")],
  ['M34', 'INFRA-ERROR-MASKED', () => mutateFile('SVC',
    'const representsInstitution = await authorizationService.canRepresentActor(\n      tenantId,\n      actingUserId,\n      institutionActorId,\n      client\n    );',
    'const representsInstitution = await authorizationService.canRepresentActor(\n      tenantId,\n      actingUserId,\n      institutionActorId,\n      client\n    ).catch(() => false);')],
  ['M35', 'PAYLOAD-AUTHORITY', () => mutateFile('SVC',
    '      // principal autenticado -> actor atuante, resolvido server-side pelo writer único NA transação\n      const actingActor = await ensureUserActorTx(client, tenantId, actingUserId);',
    '      // principal autenticado -> actor atuante, resolvido server-side pelo writer único NA transação\n      const actingActor = await ensureUserActorTx(client, tenantId, actingUserId);\n      const actorFromClient = (input as { actionContext?: { actorId?: string } }).actionContext?.actorId;\n      void actorFromClient;')],
  // ── fixtures hostis (superfície auditada) ──
  ['M36', 'SECOND-WRITER', () => writeFileSync(FIX_GENERIC, 'export const q = "SELECT fn_bind_group_to_institution($1,$2,$3,$4,$5)";\n')],
  ['M37', 'DIRECT-INSERT', () => writeFileSync(FIX_GENERIC, 'export const q = `INSERT INTO group_institutional_bindings (id) VALUES (uuid_generate_v4())`;\n')],
  ['M38', 'METADATA-PARENT', () => writeFileSync(FIX_GENERIC, 'export function parentOf(g: { metadata: Record<string, unknown> }) { return (g.metadata as { organizationId?: string }).organizationId; }\n')],
  ['M39', 'RELATIONSHIPS-COMPOSITION', () => writeFileSync(FIX_BINDING, 'export const q = "SELECT 1 FROM actor_relationships WHERE requester_label = $1";\n')],
  ['M40', 'CAPS-TAMPERED', () => mutateFile('GSVC', 'if (currentCount >= 3) {', 'if (currentCount >= 30) {', { all: true })],
  // ── REMEDIAÇÃO AUTHORITY DUAL TRANSACTION BOUNDARY (Veredito B) ──
  ['N01', 'AUTHORITY-OUT-OF-TX', () => mutateFile('SVC',
    'canRepresentActor(\n      tenantId,\n      actingUserId,\n      institutionActorId,\n      client\n    );',
    'canRepresentActor(\n      tenantId,\n      actingUserId,\n      institutionActorId\n    );')],
  ['N02', 'AUTHORITY-OUT-OF-TX', () => mutateFile('SVC',
    'canRepresentActor(\n      tenantId,\n      actingUserId,\n      groupActorId,\n      client\n    );',
    'canRepresentActor(\n      tenantId,\n      actingUserId,\n      groupActorId\n    );')],
  ['N03', 'AUTHORITY-OUT-OF-TX', () => mutateFile('SVC',
    'canRepresentActor(\n        tenantId,\n        actingUserId,\n        newInstitutionActorId,\n        client\n      );',
    'canRepresentActor(\n        tenantId,\n        actingUserId,\n        newInstitutionActorId\n      );')],
  ['N04', 'TX-OWNER', () => mutateFile('SVC',
    "      await client.query('BEGIN');\n", '')],
  ['N05', 'WRITER-CLIENT-MISMATCH', () => mutateFile('REPO',
    'const res = await client.query(\n      `SELECT fn_bind_group_to_institution',
    'const res = await poolX.query(\n      `SELECT fn_bind_group_to_institution')],
  ['N06', 'HELPER-OWN-CLIENT', () => mutateFile('SVC',
    '    const representsInstitution = await authorizationService.canRepresentActor(',
    '    const own = await pool.connect();\n    void own;\n    const representsInstitution = await authorizationService.canRepresentActor(')],
  ['N07', 'EVIDENCE-LOCK-MISSING', () => mutateFile('AUTHZ', ' FOR SHARE', '', { all: true })],
  ['N08', 'TX-ORDER', () => mutateFile('SVC',
    "      const out = await fn(client);\n      await client.query('COMMIT');",
    "      await client.query('COMMIT');\n      const out = await fn(client);")],
  ['N09', 'AUTOCOMMIT-AUTHORITY', () => mutateFile('SVC',
    '      const groupActorId = await this.resolveGroupActorIdOnClient(client, tenantId, groupId);\n\n      await this.assertDualAuthority(client, tenantId, actingUserId, institutionActorId, groupActorId);',
    '      const groupActorId = await this.resolveGroupActorIdOnClient(client, tenantId, groupId);\n      await runQueryWithTenant(tenantId, \'SELECT 1\', []);\n\n      await this.assertDualAuthority(client, tenantId, actingUserId, institutionActorId, groupActorId);')],
  ['N10', 'AUTH-SQL-DUP', () => mutateFile('MIG', '\nCOMMIT;\n', "\nSELECT count(*) FROM company_users;\nCOMMIT;\n")],
  ['N11', 'TOCTOU-COMMENT', () => mutateFile('SVC',
    'class GroupInstitutionalBindingService {',
    '// janela contratualmente permitida entre authority e writer\nclass GroupInstitutionalBindingService {')],
  ['N12', 'PREMATURE-RELEASE', () => mutateFile('SVC',
    "      const out = await fn(client);\n      await client.query('COMMIT');",
    "      const out = await fn(client);\n      client.release();\n      await client.query('COMMIT');")],
  ['N13', 'SECOND-GUARD', () => writeFileSync(FIX_SECOND_GUARD, '#!/usr/bin/env node\n// guard paralelo hostil\nprocess.exit(0);\n')],
];

const BENIGN = [
  ['B01', () => mutateFile('MIG', '-- ============================================================\n\nBEGIN;', '-- ============================================================\n-- nota benigna de manutencao (comentario)\n\nBEGIN;')],
  ['B02', () => mutateFile('SVC', 'export const groupInstitutionalBindingService = new GroupInstitutionalBindingService();\n', 'export const groupInstitutionalBindingService = new GroupInstitutionalBindingService();\n// nota benigna\n')],
  ['B03', () => mutateFile('POLICY', 'private readonly INITIAL_LIMIT = 1;', 'private readonly INITIAL_LIMIT = 1; // cap v1 (D9.2 decidirá exceção institucional)')],
  ['B04', () => writeFileSync(FIX_GENERIC, 'export const q = "SELECT id FROM group_institutional_bindings WHERE tenant_id = $1";\n')],
  ['B05', () => mutateFile('MIG', "COMMENT ON TABLE group_institutional_bindings IS", "-- comentario benigno sobre a casa\nCOMMENT ON TABLE group_institutional_bindings IS")],
  ['B06', () => mutateFile('RUNNER', '  "node scripts/audit-group-institutional-binding.mjs"', '  "node scripts/audit-group-institutional-binding.mjs" /* guard 188 */')],
];

// baseline: guard deve passar limpo antes de tudo
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
    else if (!r.out.includes(`[${marker}]`)) fails.push(`${id}: guard falhou SEM o marcador [${marker}] — saída: ${r.out.slice(0, 300)}`);
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
    if (r.failed) fails.push(`${id}: guard FALHOU com controle benigno — saída: ${r.out.slice(0, 300)}`);
    executed++;
  } catch (e) {
    fails.push(`${id}: erro ao aplicar benigno — ${e.message}`);
  } finally {
    restoreAll();
  }
}

// restauração byte-exata + resíduo zero
for (const [k, p] of Object.entries(FILES)) {
  if (sha(p) !== HASH0[k]) fails.push(`RESTAURAÇÃO: ${k} não voltou byte-exato`);
}
for (const f of [FIX_GENERIC, FIX_BINDING]) {
  if (existsSync(f)) fails.push(`RESÍDUO: fixture ${f} não removida`);
}
if (executed !== HOSTILE.length + BENIGN.length) fails.push(`CONTAGEM: executados ${executed} ≠ declarados ${HOSTILE.length + BENIGN.length}`);

if (fails.length) {
  console.error(`❌ mutations D9.1 — ${fails.length} problema(s):`);
  for (const f of fails) console.error('   ' + f);
  process.exit(1);
}
console.log(`✅ mutations D9.1 — ${HOSTILE.length} hostis individualizados morderam com marcador próprio + ${BENIGN.length} benignos passaram; restauração byte-exata; resíduo zero.`);
