#!/usr/bin/env node
// audit-group-membership-cutover.mjs — Guard dedicado do CUTOVER D9.2-B
// (DECISION-0188 D16 ato D9.2-B · GATE READ-ONLY D9.2-B 2026-07-18 · GO material 2026-07-23).
// A VERDADE de membership é ÚNICA: group_actor_memberships (escrita SÓ pelas 5 fns governadas).
// group_members está CONGELADA (D4): projeção read-only, DML revogado de unificard_app.
// MORDE se:
//   (a) código de produto voltar a ESCREVER em group_members;
//   (b) um reader de produto cair de volta em group_members fora do RESIDUAL CONGELADO
//       (projeções read-only enumeradas — encolher a lista é permitido; crescer NUNCA);
//   (c) a migration de cutover perder os blocos de substituição do UNIQUE de invites /
//       backfill governado / prova de igualdade / congelamento / pós-verificação;
//   (d) predicados mistos de namespace (user_id OR actor_id) ou o fallback triplo voltarem;
//   (e) as 6 superfícies D13 regredirem (join/leave/invites-mine/request/accept/createInvite);
//   (f) role-como-autoridade (isUserAdminOrOwner) renascer em qualquer código de produto.
// Comment-aware · fail-closed · região-ancorado · localiza a migration por CONTEÚDO.
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

// ── A · MIGRATION DE CUTOVER (localizada por CONTEÚDO; única) ──
const MIG_DIR = resolve(ROOT, 'migrations');
const sqlFiles = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql'));
const cutMatches = [];
for (const f of sqlFiles) {
  if (/REVOKE INSERT, UPDATE, DELETE ON group_members FROM unificard_app/i.test(stripSql(read(join(MIG_DIR, f))))) {
    cutMatches.push(f);
  }
}
if (cutMatches.length === 0) note('FREEZE-MISSING', 'nenhuma migration congela group_members (REVOKE DML de unificard_app ausente)');
if (cutMatches.length > 1) note('FREEZE-DUP', `mais de uma migration congela group_members: ${cutMatches.join(', ')}`);
const CUT_FILE = cutMatches[0] ?? '';
const CUT = CUT_FILE ? stripSql(read(join(MIG_DIR, CUT_FILE))) : '';
if (CUT_FILE) {
  // (c) blocos obrigatórios do cutover
  if (!/DROP CONSTRAINT uq_group_invite/i.test(CUT)) {
    note('INVITE-UNIQUE-SWAP', 'substituição do UNIQUE legado (DROP CONSTRAINT uq_group_invite) ausente');
  }
  const uq = CUT.match(/CREATE UNIQUE INDEX IF NOT EXISTS uq_gi_pending_per_pair\s+ON group_invites \(([^)]*)\)\s+WHERE\s+([^;]+);/i);
  if (!uq) note('INVITE-UNIQUE-SWAP', 'unicidade pending tenant-scoped (uq_gi_pending_per_pair) ausente');
  else {
    if (!/tenant_id/.test(uq[1])) note('INVITE-UNIQUE-SWAP', 'uq_gi_pending_per_pair sem tenant_id');
    if (!/status\s*=\s*'pending'/.test(uq[2])) note('INVITE-UNIQUE-SWAP', "uq_gi_pending_per_pair sem WHERE status='pending' (voltaria a cobrir históricos)");
  }
  if (!/fn_enter_group_actor_membership\(/i.test(CUT)) {
    note('BACKFILL-UNGOVERNED', 'backfill não usa o writer governado fn_enter_group_actor_membership');
  }
  if (/INSERT\s+INTO\s+(public\.)?group_actor_memberships/i.test(CUT)) {
    note('BACKFILL-UNGOVERNED', 'migration de cutover faz INSERT direto na casa nova (bypass das fns)');
  }
  if (!/'cutover-gm:'/.test(CUT) || !/'cutover-owner:'/.test(CUT)) {
    note('BACKFILL-UNGOVERNED', 'chaves determinísticas do backfill (cutover-gm:/cutover-owner:) ausentes');
  }
  if (!/igualdade legado x nova/i.test(CUT) || !/MIGRATION_ABORT/.test(CUT)) {
    note('EQUALITY-PROOF', 'prova de igualdade legado x nova fail-closed ausente da migration');
  }
  if (!/invariante D8/i.test(CUT)) {
    note('EQUALITY-PROOF', 'verificação do invariante D8 (owner com membership ativa) ausente');
  }
  if (!/role_table_grants/i.test(CUT)) {
    note('FREEZE-MISSING', 'pós-verificação do congelamento (role_table_grants) ausente');
  }
  if (/DROP TABLE\s+(IF EXISTS\s+)?group_members/i.test(CUT)) {
    note('LEGACY-DROP', 'migration de cutover REMOVE fisicamente group_members — proibido (D16)');
  }
}

// ── B/C/D/F · VARREDURA DE PRODUTO (src, comment-stripped; testes e harness E2E fora) ──
// Residual CONGELADO (D4: "projeção estritamente read-only" tolerada; convergência = frente
// posterior própria). Encolher esta lista é permitido; QUALQUER arquivo novo morde.
const LEGACY_READ_RESIDUAL = [
  // read-model de MEDIÇÃO selado no D9.2-A (shadow validation legado×nova; zero caller de produto)
  'src/modules/groups/group-membership-shadow.readmodel.ts',
  // projeções read-only ainda user-first (documentadas no parecer do cutover; convergência futura)
  'src/core/profile-inference/profile-inference.service.ts',
  'src/core/profile/impact-overview.routes.ts',
  'src/modules/social/actor.repository.ts',
];
const WRITE_RE = /INSERT\s+INTO\s+group_members\b|UPDATE\s+group_members\b|DELETE\s+FROM\s+group_members\b/i;
const allSrc = walk(resolve(ROOT, 'src')).map((p) => norm(p).replace(norm(ROOT) + '/', ''));
for (const p of allSrc) {
  if (/\.test\.|\.spec\.|__tests__/.test(p)) continue;
  if (/^src\/scripts\//.test(p)) continue; // harness/E2E/seed dev-tooling (não é produto)
  const s = stripTs(read(resolve(ROOT, p)));
  if (WRITE_RE.test(s)) note('LEGACY-WRITE', `escrita de produto em group_members (casa congelada): ${p}`);
  if (/\bgroup_members\b/.test(s) && !LEGACY_READ_RESIDUAL.includes(p)) {
    note('LEGACY-READER', `reader de produto caiu em group_members fora do residual congelado: ${p}`);
  }
  if (/user_id OR actor_id|actor_id OR user_id/i.test(s)) {
    note('MIXED-PREDICATE', `predicado misto user/actor: ${p}`);
  }
  if (/isUserAdminOrOwner/.test(s)) {
    note('ROLE-AUTHORITY', `role-como-autoridade (isUserAdminOrOwner) renasceu: ${p}`);
  }
}
for (const p of LEGACY_READ_RESIDUAL) {
  const abs = resolve(ROOT, p);
  if (!existsSync(abs)) continue; // arquivo residual removido = convergência (lista pode encolher)
  if (WRITE_RE.test(stripTs(read(abs)))) note('LEGACY-WRITE', `residual read-only passou a ESCREVER em group_members: ${p}`);
}

// ── E · 6 SUPERFÍCIES D13 CONVERGIDAS (âncoras pós-cutover) ──
const ROUTES = stripTs(read(resolve(ROOT, 'src/modules/groups/groups.routes.ts')));
const SVC = stripTs(read(resolve(ROOT, 'src/modules/groups/groups.service.ts')));
if (!/groupsService\.joinGroup\(tenantId, id, actingUserId\)/.test(ROUTES)) {
  note('SURFACE-JOIN', '/join não entrega o PRINCIPAL autenticado (actingUserId) ao service');
}
if (!/groupsService\.leaveGroup\(tenantId, id, actingUserId\)/.test(ROUTES)) {
  note('SURFACE-LEAVE', '/leave não entrega o PRINCIPAL autenticado (actingUserId) ao service');
}
if (!/getUserInvites\(tenantId, actingUserId/.test(ROUTES)) {
  note('SURFACE-INVITES-MINE', '/invites/mine não deriva do PRINCIPAL autenticado');
}
if (!/requestJoinGroup\(\s*tenantId,\s*id,\s*actingUserId/.test(ROUTES)) {
  note('SURFACE-REQUEST', '/request não deriva do PRINCIPAL autenticado');
}
if (!/acceptInvite\(\s*tenantId,\s*inviteId,\s*actingUserId/.test(ROUTES)) {
  note('SURFACE-ACCEPT', 'aceite de convite não deriva do PRINCIPAL autenticado');
}
if (!/invited_actor_id/.test(ROUTES)) {
  note('SURFACE-CREATE-INVITE', 'convite perdeu o namespace ACTOR do candidato (invited_actor_id)');
}
if (!/intentKind: 'invite'/.test(SVC) || !/intentKind: 'request'/.test(SVC)) {
  note('SURFACE-INTENT', 'intenções explícitas invite|request sumiram do service (D9: direção declarada)');
}
if (!/acceptMembershipIntent/.test(SVC)) {
  note('SURFACE-INTENT', 'aceite atômico governado (acceptMembershipIntent) sumiu do service');
}
if (/invitedUserId === userContext/.test(SVC)) {
  note('SURFACE-ACCEPT', 'fallback triplo userId‖globalUserId‖id voltou ao service');
}
if (!/getUserGroupCount/.test(SVC)) {
  note('CAP-CIVIL', 'cap civil de participação (D12) sumiu do service');
}

// ── RUNNER ──
const RUNNER = stripTs(read(resolve(ROOT, 'scripts/run-regression-guards.mjs')));
const n = (RUNNER.match(/audit-group-membership-cutover\.mjs/g) || []).length;
if (n !== 1) note('RUNNER-WIRING', `guard do cutover aparece ${n}× no runner (esperado 1)`);

if (fails.length) {
  console.error('❌ audit-group-membership-cutover — violações:');
  for (const f of fails) console.error('   ' + f);
  process.exit(1);
}
console.log('✅ audit-group-membership-cutover — cutover D9.2-B (DECISION-0188) íntegro: verdade única na casa nova, legado congelado, superfícies convergidas, residual read-only enumerado.');
