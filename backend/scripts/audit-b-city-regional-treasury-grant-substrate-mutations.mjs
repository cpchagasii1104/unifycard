#!/usr/bin/env node
// audit-b-city-regional-treasury-grant-substrate-mutations.mjs — HARNESS de mutações do guard 187 (DECISION-0185).
// 38 vetores HOSTIS isolados (M01–M38) + 5 controles BENIGNOS (B01–B05). Cada vetor: uma execução própria,
// alteração física própria (mutação da migration OU fixture hostil temporária em src/), exige exit!=0 do guard
// COM o marcador específico da trava, e restauração byte-exata (hash) / remoção da fixture (inexistência).
// Vetores runtime sem arquivo vivo criam uma FIXTURE hostil temporária determinística dentro da superfície que o
// guard audita (produção-like, NÃO comentário), removida no restore. Falha se: guard passar num hostil, guard
// falhar num benigno, marcador ausente, restauração incompleta, resíduo, vetor pulado, ou total < declarado.
// Não toca DB. Migration/types/runtime reais ficam byte-intactos ao final.
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIG = resolve(ROOT, 'migrations/20260716140000_regional_treasury_authority_grant_substrate.sql');
const FIXTURE = resolve(ROOT, 'src/modules/authority/__regional_treasury_mutation_fixture.ts');
const GUARD = 'scripts/audit-b-city-regional-treasury-grant-substrate.mjs';
const sha = (p) => (existsSync(p) ? createHash('sha1').update(readFileSync(p)).digest('hex') : 'ABSENT');
const MIG_ORIG = readFileSync(MIG, 'utf8');
const MIG_HASH0 = sha(MIG);
const fails = [];
const note = (m) => fails.push(m);

// Roda o guard 187 standalone; retorna {failed, out}.
function runGuard() {
  try { const out = execSync(`node ${GUARD}`, { cwd: ROOT, stdio: 'pipe' }).toString(); return { failed: false, out }; }
  catch (e) { return { failed: true, out: `${e.stdout || ''}${e.stderr || ''}` }; }
}

// ── vetores por MUTAÇÃO da migration (from→to únicos) ──
const FULL_RT_SHAPE =
  "scope_type = 'regional_treasury'\n      AND tenant_id IS NOT NULL\n      AND scope_actor_id IS NULL\n      AND scope_city_id IS NOT NULL";
const CHK_REG_TAIL =
  "      'treasury:regional_policy_manage',\n      'treasury:regional_fund_activation_manage'\n    )\n  );\n\nCOMMENT ON CONSTRAINT chk_acg_capability_regional_treasury";
const MATRIX_REG_BRANCH =
  "    OR\n    (\n      scope_type = 'regional_treasury'\n      AND capability_key IN (\n        'treasury:regional_policy_manage',\n        'treasury:regional_fund_activation_manage'\n      )\n    )\n  );";
const UNIQ_COLS = "ON actor_capability_grants (tenant_id, grantee_actor_id, capability_key, scope_city_id)";

const MIG_MUTATIONS = [
  ['M01', 'SHAPE-RT-TENANT', FULL_RT_SHAPE, FULL_RT_SHAPE.replace('tenant_id IS NOT NULL', 'tenant_id IS NULL')],
  ['M02', 'SHAPE-RT-CITY', FULL_RT_SHAPE, FULL_RT_SHAPE.replace('scope_city_id IS NOT NULL', 'scope_city_id IS NULL')],
  ['M03', 'SHAPE-RT-SCOPEACTOR', FULL_RT_SHAPE, FULL_RT_SHAPE.replace('scope_actor_id IS NULL', 'scope_actor_id IS NOT NULL')],
  ['M04', 'MATRIX-FIN-ACTOR',
    "'service_order:view'\n      )\n    )\n    OR\n    (\n      scope_type = 'territory'",
    "'service_order:view',\n        'treasury:regional_policy_manage'\n      )\n    )\n    OR\n    (\n      scope_type = 'territory'"],
  ['M05', 'MATRIX-FIN-TERRITORY',
    "'territory:register_neighborhood_succession'\n      )\n    )\n    OR\n    (\n      scope_type = 'regional_treasury'",
    "'territory:register_neighborhood_succession',\n        'treasury:regional_fund_activation_manage'\n      )\n    )\n    OR\n    (\n      scope_type = 'regional_treasury'"],
  ['M06', 'REGIONAL-NONFIN', CHK_REG_TAIL,
    "      'treasury:regional_policy_manage',\n      'treasury:regional_fund_activation_manage',\n      'calendar:block'\n    )\n  );\n\nCOMMENT ON CONSTRAINT chk_acg_capability_regional_treasury"],
  ['M22', 'SCOPE-TYPE-ALIAS', "IN ('actor', 'territory', 'regional_treasury'));", "IN ('actor', 'territory', 'regional_treasury', 'city_treasury'));"],
  ['M23', 'SCOPE-TYPE-ALIAS', "IN ('actor', 'territory', 'regional_treasury'));", "IN ('actor', 'territory', 'regional_treasury', 'regional-treasury'));"],
  ['M24', 'REGIONAL-KEY-COUNT', CHK_REG_TAIL,
    "      'treasury:regional_policy_manage',\n      'treasury:regional_fund_activation_manage',\n      'treasury:regional_other_manage'\n    )\n  );\n\nCOMMENT ON CONSTRAINT chk_acg_capability_regional_treasury"],
  ['M25', 'SCOPE-TYPE-MISSING',
    "ADD CONSTRAINT chk_acg_scope_type CHECK (scope_type IN ('actor', 'territory', 'regional_treasury'));",
    "ADD CONSTRAINT chk_acg_scopetype_x CHECK (true);"],
  ['M26', 'SHAPE-MISSING', "ADD CONSTRAINT chk_acg_scope_shape CHECK (", "ADD CONSTRAINT chk_acg_scope_shape_x CHECK ("],
  ['M27', 'REGIONAL-CHECK-MISSING', "ADD CONSTRAINT chk_acg_capability_regional_treasury CHECK (", "ADD CONSTRAINT chk_acg_capability_regional_treasury_x CHECK ("],
  ['M28', 'REGIONAL-WILDCARD',
    "OR capability_key IN (\n      'treasury:regional_policy_manage',\n      'treasury:regional_fund_activation_manage'\n    )",
    "OR capability_key LIKE 'treasury:regional_%'"],
  ['M29', 'MATRIX-BRANCH-MISSING', MATRIX_REG_BRANCH, "\n  );"],
  ['M30', 'SHAPE-RT-AND', FULL_RT_SHAPE,
    "scope_type = 'regional_treasury'\n      OR tenant_id IS NOT NULL\n      AND scope_actor_id IS NULL\n      AND scope_city_id IS NOT NULL"],
  ['M31', 'UNIQ-TENANT', UNIQ_COLS, "ON actor_capability_grants (grantee_actor_id, capability_key, scope_city_id)"],
  ['M32', 'UNIQ-CITY', UNIQ_COLS, "ON actor_capability_grants (tenant_id, grantee_actor_id, capability_key)"],
  ['M33', 'UNIQ-CAPABILITY', UNIQ_COLS, "ON actor_capability_grants (tenant_id, grantee_actor_id, scope_city_id)"],
  ['M34', 'UNIQ-PREDICATE', "WHERE scope_type = 'regional_treasury' AND status = 'active';", "WHERE status = 'active';"],
];

// ── vetores por FIXTURE hostil temporária (produção-like; NÃO comentário) ──
const K1 = 'treasury:regional_policy_manage';
const K2 = 'treasury:regional_fund_activation_manage';
const RT_MUTATIONS = [
  ['M07', 'R-WILDCARD', `export const k = 'treasury:*';\nexport function auth(x: string) { return x === k; }\n`],
  ['M08', 'R-STARTSWITH', `export function authorize(capabilityKey: string) { if (capabilityKey.startsWith('treasury:')) return true; return false; }\n`],
  ['M09', 'R-OPSOURCE-AS-CAP', `export const grant = { capabilityKey: 'treasury:settlement' };\n`],
  ['M10', 'R-CAP-AS-OPSOURCE', `export const t = { treasurySource: '${K1}' };\n`],
  ['M11', 'R-PERMCAP-AS-GRANTKEY', `export const g = { capabilityKey: 'can_manage_treasury' };\n`],
  ['M12', 'R-PERMKEYS-AS-SOURCE', `import { PERMISSION_CAPABILITIES } from '../../core/authorization/permission-keys';\nexport const k = '${K1}';\nexport const src = PERMISSION_CAPABILITIES;\n`],
  ['M13', 'R-FUSION', `export const policy = '${K1}';\nexport const porta = '${K2}';\nexport const implies: Record<string, string> = { [policy]: porta };\n`],
  ['M14', 'R-SINGLE-COVERS-BOTH', `export function authRegional(has: (k: string) => boolean) { return has('${K1}') || has('${K2}'); }\n`],
  ['M15', 'R-RESIDENCE-GRANT', `export const k = '${K1}';\nexport function g(actor: unknown) { return resolveActorTerritory(actor, 'ACTOR_RESIDENCE') ? k : null; }\ndeclare function resolveActorTerritory(a: unknown, m: string): boolean;\n`],
  ['M16', 'R-CITY-MEMBERSHIP-GRANT', `export const k = '${K1}';\nexport function g(a: unknown) { return belongsToCity(a) ? k : null; }\ndeclare function belongsToCity(a: unknown): boolean;\n`],
  ['M17', 'R-ROLE-GRANT', `export const k = '${K2}';\nexport function g(u: { isAdmin: boolean }) { return u.isAdmin ? k : null; }\n`],
  ['M18', 'R-SELF-GRANT', `export const k = '${K1}';\nexport function g(granteeActorId: string, grantedByActorId: string) { if (granteeActorId === grantedByActorId) return k; return null; }\n`],
  ['M19', 'R-IMPLICIT-BOOTSTRAP', `export const k = '${K1}';\nexport function bootstrap() { autoGrant(k); }\ndeclare function autoGrant(k: string): void;\n`],
  ['M20', 'R-PARALLEL-HOUSE', `export function store(db: { query: (s: string) => unknown }) { return db.query("INSERT INTO regional_treasury_grants (x) VALUES (1)"); }\n`],
  ['M21', 'R-TENANT-NULL-GLOBAL', `export const k = '${K1}';\nexport const q = "SELECT 1 FROM acg WHERE capability_key='" + k + "' AND (tenant_id = $1 OR tenant_id IS NULL)";\n`],
  ['M35', 'R-DUP-REGISTRY', `export const KEYS = ['${K1}', '${K2}'] as const;\n`],
  ['M36', 'R-CAST-PERMISSION', `type PermissionKey = string;\nexport const k = '${K1}' as unknown as PermissionKey;\n`],
  ['M37', 'R-CAST-TREASURY', `type TreasuryOperationSource = string;\nexport const k = '${K1}' as unknown as TreasuryOperationSource;\n`],
  ['M38', 'R-LOCAL-DECL', `export const a = '${K1}';\nexport const b = '${K2}';\n`],
];

// ── controles BENIGNOS (fixture; o guard DEVE continuar passando) ──
const BENIGN = [
  ['B01', `export const s = { treasurySource: 'treasury:settlement' };\n`],           // op-source legítimo
  ['B02', `export const p = { publish_feed: 'can_publish_feed' };\n`],                 // PermissionCapability legítima
  ['B03', `// ${K1} e ${K2} são documentados aqui, sem virar autoridade\nexport const x = 1;\n`], // comentário (comment-aware)
  ['B04', `export const g = { capabilityKey: 'calendar:block', scopeType: 'actor' };\n`], // 12 keys antigas nos scopes antigos
  ['B05', `export function label() { return '${K1}'; }\n`],                            // uso escalar legítimo de 1 key
];

// ── PRE: HEAD + index + fixture ausente ──
try {
  const idx = execSync('git diff --cached --name-only', { cwd: resolve(ROOT, '..'), stdio: 'pipe' }).toString().trim();
  if (idx) note(`PRE: index não-vazio antes das mutações: ${idx.split('\n').join(', ')}`);
} catch { /* git ausente: segue */ }
if (existsSync(FIXTURE)) note('PRE: fixture temporária já existe (estado sujo)');
{ const r = runGuard(); if (r.failed) note('PRE: guard 187 não passa no material REAL antes de mutar'); }

const cleanupFixture = () => { if (existsSync(FIXTURE)) rmSync(FIXTURE, { force: true }); };

// ── HOSTIS via migration ──
let executed = 0;
for (const [id, marker, from, to] of MIG_MUTATIONS) {
  executed += 1;
  if (!MIG_ORIG.includes(from)) { note(`${id}: ÂNCORA não encontrada na migration (harness inválido)`); continue; }
  if (from === to) { note(`${id}: mutação nula (from===to)`); continue; }
  try {
    writeFileSync(MIG, MIG_ORIG.replace(from, to));
    const r = runGuard();
    if (!r.failed) note(`${id} (${marker}): guard NÃO mordeu a mutação hostil`);
    else if (!r.out.includes(`[${marker}]`)) note(`${id}: guard mordeu, mas SEM o marcador [${marker}] (achado: ${(r.out.match(/\[[A-Z0-9-]+\]/g) || []).join(' ')})`);
  } finally {
    writeFileSync(MIG, MIG_ORIG);
    if (sha(MIG) !== MIG_HASH0) note(`${id}: migration NÃO restaurada byte-a-byte`);
  }
}

// ── HOSTIS via fixture ──
for (const [id, marker, content] of RT_MUTATIONS) {
  executed += 1;
  try {
    writeFileSync(FIXTURE, content);
    const r = runGuard();
    if (!r.failed) note(`${id} (${marker}): guard NÃO mordeu a fixture hostil`);
    else if (!r.out.includes(`[${marker}]`)) note(`${id}: guard mordeu, mas SEM o marcador [${marker}] (achado: ${(r.out.match(/\[[A-Z0-9-]+\]/g) || []).join(' ')})`);
  } finally {
    cleanupFixture();
    if (existsSync(FIXTURE)) note(`${id}: fixture NÃO removida (resíduo)`);
  }
}

// ── BENIGNOS ──
let benignRun = 0;
for (const [id, content] of BENIGN) {
  benignRun += 1;
  try {
    writeFileSync(FIXTURE, content);
    const r = runGuard();
    if (r.failed) note(`${id}: guard MORDEU um controle benigno (falso positivo) — ${(r.out.match(/\[[A-Z0-9-]+\]/g) || []).join(' ')}`);
  } finally {
    cleanupFixture();
    if (existsSync(FIXTURE)) note(`${id}: fixture benigna NÃO removida (resíduo)`);
  }
}

// ── PÓS: contagem, restauração, resíduo ──
if (executed !== 38) note(`PÓS: executadas ${executed} mutações hostis (esperado 38)`);
if (benignRun < 5) note(`PÓS: executados ${benignRun} controles benignos (esperado >=5)`);
writeFileSync(MIG, MIG_ORIG);
if (sha(MIG) !== MIG_HASH0) note('PÓS: migration final não é byte-idêntica ao original');
cleanupFixture();
if (existsSync(FIXTURE)) note('PÓS: fixture temporária remanescente');
{ const r = runGuard(); if (r.failed) note('PÓS: guard não passa após restauração (resíduo/corrupção)'); }

if (fails.length) {
  console.error('\nGATE FAIL [b-city-regional-treasury-grant-substrate-mutations]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [b-city-regional-treasury-grant-substrate-mutations] — 38 vetores hostis (M01–M38) mordidos com marcador específico + 5 controles benignos aceitos; migration byte-restaurada; fixtures removidas; resíduo zero.');
