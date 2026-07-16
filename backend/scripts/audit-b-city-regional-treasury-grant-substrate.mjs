#!/usr/bin/env node
// audit-b-city-regional-treasury-grant-substrate.mjs — Guard dedicado B-CITY-2 (posição 187 do runner).
// DECISION-0185 (Financial Authority Grant Model). Congela o SUBSTRATO DORMENTE de autoridade financeira
// regional em actor_capability_grants: 3o scope_type fechado regional_treasury, shape tenant+city, matriz
// particionada, existência financeira dedicada, unicidade ativa regional, registry canônico das 2 grant
// keys (types), registries disjuntos (permission-keys.ts / TreasuryOperationSource INTOCADOS), e ausência
// — em runtime — de fusão/casa-paralela/grant-por-residência/city/role/self/bootstrap/cast/registry-duplo.
// Prova de CONTRATO (não presença). Cada trava emite um MARCADOR [X] próprio. Fail-closed (exit!=0).
// Comment-aware (SQL -- e TS //). NÃO depende de nome de arquivo de mutação (heurística estrutural).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const strip = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const norm = (p) => p.split(sep).join('/');
const fails = [];
const note = (marker, m) => fails.push(`[${marker}] ${m}`);
const has = (s, re) => re.test(s);

const F = {
  MIG: 'migrations/20260716140000_regional_treasury_authority_grant_substrate.sql',
  TYPES: 'src/modules/authority/actor-capability-grant.types.ts',
  PERMKEYS: 'src/core/authorization/permission-keys.ts',
  TREASURYSRC: 'src/modules/bank/bank-transaction.types.ts',
  RUNNER: 'scripts/run-regression-guards.mjs',
};
const S = Object.fromEntries(Object.entries(F).map(([k, p]) => {
  if (!existsSync(resolve(ROOT, p))) { note('FILE', `arquivo material ausente: ${p}`); return [k, { raw: '', s: '' }]; }
  const raw = read(p);
  return [k, { raw, s: p.endsWith('.sql') ? stripSql(raw) : strip(raw) }];
}));

const KEY_POLICY = 'treasury:regional_policy_manage';
const KEY_PORTA = 'treasury:regional_fund_activation_manage';
const NONFIN_12 = [
  'calendar:block', 'calendar:unblock', 'services:create', 'services:edit', 'services:disable', 'service_order:view',
  'territory:create_neighborhood', 'territory:approve_neighborhood', 'territory:correct_neighborhood',
  'territory:deactivate_neighborhood', 'territory:manage_neighborhood_aliases', 'territory:register_neighborhood_succession',
];

const M = S.MIG.s;

// ══ MIGRATION · SCOPE TYPE ══
{
  const scopeAdd = (M.match(/ADD CONSTRAINT chk_acg_scope_type CHECK\s*\(scope_type IN\s*\(([^)]*)\)\)/i) || [])[1];
  if (scopeAdd === undefined) {
    note('SCOPE-TYPE-MISSING', 'ADD CONSTRAINT chk_acg_scope_type (scope_type IN ...) ausente');
  } else {
    const vals = [...scopeAdd.matchAll(/'([a-z_]+)'/gi)].map((x) => x[1]);
    if (!vals.includes('regional_treasury') || !vals.includes('actor') || !vals.includes('territory')) {
      note('SCOPE-TYPE-MISSING', 'chk_acg_scope_type não fecha em actor|territory|regional_treasury');
    }
    const extra = vals.filter((v) => !['actor', 'territory', 'regional_treasury'].includes(v));
    if (extra.length) note('SCOPE-TYPE-ALIAS', `chk_acg_scope_type admite valor/alias proibido: ${extra.join(', ')}`);
  }
  // alias com hífen (regional-treasury) não casa [a-z_]; detecção textual dedicada
  if (has(M, /ADD CONSTRAINT chk_acg_scope_type[\s\S]*?'regional-treasury'/i)) note('SCOPE-TYPE-ALIAS', "alias 'regional-treasury' (hífen) presente no scope_type");
}

// ══ MIGRATION · SHAPE (ramo regional_treasury: tenant NOT NULL + scope_actor NULL + city NOT NULL, AND) ══
{
  const shapeAdd = (M.match(/ADD CONSTRAINT chk_acg_scope_shape CHECK\s*\(([\s\S]*?)\n  \);/i) || [])[1];
  if (shapeAdd === undefined) {
    note('SHAPE-MISSING', 'ADD CONSTRAINT chk_acg_scope_shape ausente');
  } else {
    if (!/scope_type = 'actor'[\s\S]*?scope_city_id IS NULL/i.test(shapeAdd)) note('SHAPE-ACTOR', 'ramo actor do shape não preservado');
    if (!/scope_type = 'territory'[\s\S]*?scope_city_id IS NOT NULL/i.test(shapeAdd)) note('SHAPE-TERRITORY', 'ramo territory do shape não preservado');
    const rt = (shapeAdd.match(/scope_type = 'regional_treasury'([\s\S]*?)\n    \)/i) || [])[1];
    if (rt === undefined) {
      note('SHAPE-RT-MISSING', 'ramo regional_treasury do shape ausente');
    } else {
      if (!/tenant_id IS NOT NULL/i.test(rt)) note('SHAPE-RT-TENANT', 'ramo regional_treasury sem tenant_id IS NOT NULL');
      if (!/scope_actor_id IS NULL/i.test(rt)) note('SHAPE-RT-SCOPEACTOR', 'ramo regional_treasury sem scope_actor_id IS NULL');
      if (!/scope_city_id IS NOT NULL/i.test(rt)) note('SHAPE-RT-CITY', 'ramo regional_treasury sem scope_city_id IS NOT NULL');
      if (/\bOR\b/i.test(rt)) note('SHAPE-RT-AND', 'ramo regional_treasury usa OR (disjunção) — shape híbrido, deve ser conjunção estrita');
    }
  }
}

// ══ MIGRATION · EXISTÊNCIA NÃO-FINANCEIRA (implicação por scope; 12 keys; sem treasury:) ══
{
  const nonfin = (M.match(/ADD CONSTRAINT chk_acg_capability_nonfinancial CHECK\s*\(([\s\S]*?)\n  \);/i) || [])[1] || '';
  if (!/scope_type NOT IN \('actor', 'territory'\)/.test(nonfin) && !/scope_type IN \('actor', 'territory'\)/.test(nonfin)) {
    note('NONFIN-IMPLICATION', 'chk_acg_capability_nonfinancial não virou implicação guardada por scope');
  }
  if (!NONFIN_12.every((k) => nonfin.includes(`'${k}'`))) note('NONFIN-12KEYS', 'chk_acg_capability_nonfinancial perdeu alguma das 12 keys');
  if (/treasury:/.test(nonfin)) note('NONFIN-NO-TREASURY', 'chk_acg_capability_nonfinancial contém treasury:* (proibido)');
}

// ══ MIGRATION · EXISTÊNCIA FINANCEIRA DEDICADA (2 keys exatas; sem terceira; sem wildcard) ══
{
  const rtc = (M.match(/ADD CONSTRAINT chk_acg_capability_regional_treasury CHECK\s*\(([\s\S]*?)\n  \);/i) || [])[1];
  if (rtc === undefined) {
    note('REGIONAL-CHECK-MISSING', 'chk_acg_capability_regional_treasury ausente');
  } else {
    if (!rtc.includes(KEY_POLICY) || !rtc.includes(KEY_PORTA)) note('REGIONAL-KEYS', 'chk_acg_capability_regional_treasury sem as 2 keys exatas');
    const inList = (rtc.match(/IN\s*\(([\s\S]*?)\)/i) || [])[1] || '';
    const keys = [...inList.matchAll(/'([a-z:_]+)'/g)].map((x) => x[1]);
    if (keys.length !== 2) note('REGIONAL-KEY-COUNT', `chk_acg_capability_regional_treasury tem ${keys.length} keys (esperado 2)`);
    if (keys.some((k) => !k.startsWith('treasury:regional_'))) note('REGIONAL-NONFIN', 'chk_acg_capability_regional_treasury contém key não-financeira/não-regional');
    if (/LIKE|~~|%|startsWith/i.test(rtc)) note('REGIONAL-WILDCARD', 'chk_acg_capability_regional_treasury usa prefixo/LIKE/regex (proibido)');
  }
}

// ══ MIGRATION · MATRIZ (3 ramos; sem cruzamento financeiro em actor/territory) ══
{
  const matrix = (M.match(/ADD CONSTRAINT chk_acg_scope_capability_matrix CHECK\s*\(([\s\S]*?)\n  \);/i) || [])[1];
  if (matrix === undefined) {
    note('MATRIX-MISSING', 'chk_acg_scope_capability_matrix ausente');
  } else {
    const actorBranch = (matrix.match(/scope_type = 'actor'[\s\S]*?IN \(([^)]*)\)/i) || [])[1] || '';
    const terrBranch = (matrix.match(/scope_type = 'territory'[\s\S]*?IN \(([^)]*)\)/i) || [])[1] || '';
    const regBranch = (matrix.match(/scope_type = 'regional_treasury'[\s\S]*?IN \(([^)]*)\)/i) || [])[1];
    if (regBranch === undefined) note('MATRIX-BRANCH-MISSING', 'matriz sem ramo regional_treasury');
    else if (!regBranch.includes(KEY_POLICY) || !regBranch.includes(KEY_PORTA)) note('MATRIX-BRANCH-MISSING', 'ramo regional_treasury da matriz sem as 2 keys');
    if (/treasury:/.test(actorBranch)) note('MATRIX-FIN-ACTOR', 'ramo actor da matriz contém capability financeira (treasury:)');
    if (/treasury:/.test(terrBranch)) note('MATRIX-FIN-TERRITORY', 'ramo territory da matriz contém capability financeira (treasury:)');
  }
}

// ══ MIGRATION · UNICIDADE ATIVA REGIONAL (tenant+grantee+capability+city; predicado regional+active) ══
{
  const uidx = (M.match(/CREATE UNIQUE INDEX uidx_actor_capability_grants_regional_treasury_active([\s\S]*?);/i) || [])[1] || '';
  if (!uidx) note('UNIQ-MISSING', 'uidx_actor_capability_grants_regional_treasury_active ausente');
  const cols = (uidx.match(/\(([^)]*)\)/) || [])[1] || '';
  if (!/\btenant_id\b/.test(cols)) note('UNIQ-TENANT', 'unicidade regional sem tenant_id (financeiro é tenant-scoped)');
  if (!/\bscope_city_id\b/.test(cols)) note('UNIQ-CITY', 'unicidade regional sem scope_city_id');
  if (!/\bcapability_key\b/.test(cols)) note('UNIQ-CAPABILITY', 'unicidade regional sem capability_key');
  if (!/\bgrantee_actor_id\b/.test(cols)) note('UNIQ-GRANTEE', 'unicidade regional sem grantee_actor_id');
  if (!/scope_type = 'regional_treasury'[\s\S]*?status = 'active'/i.test(uidx)) note('UNIQ-PREDICATE', 'unicidade regional sem predicado parcial regional_treasury+active');
  if (/now\(\)|valid_from|valid_until/i.test(uidx)) note('UNIQ-VIGENCIA', 'unicidade regional contém now()/vigência (proibido)');
}

// ══ MIGRATION · DORMÊNCIA (sem grant/writer/Bank/policy) ══
{
  if (has(M, /INSERT INTO (public\.)?actor_capability_grants/i)) note('DORMANT-NO-GRANT', 'migration insere grant real (proibido)');
  if (has(M, /CREATE (OR REPLACE )?FUNCTION/i)) note('DORMANT-NO-WRITER', 'migration cria função/writer (proibido)');
  if (has(M, /GRANT (INSERT|UPDATE|DELETE)[\s\S]*?unificard_app/i)) note('DORMANT-NO-DML', 'migration reconcede DML a unificard_app');
  if (has(M, /\b(bank_transactions|bank_splits|bank_accounts|bank_ledger|economic_policies|economic_policy_lines|regional_fund_accounts|fiscal_provision_events|fiscal_reserve_accounts)\b/)) {
    note('DORMANT-NO-BANK', 'migration referencia Bank/policy/fiscal (fora do escopo)');
  }
}

// ══ REGISTRY canônico (types) ══
{
  const t = S.TYPES.s;
  const rtConst = (t.match(/REGIONAL_TREASURY_CAPABILITY_KEYS = \[[\s\S]*?\] as const/) || [''])[0];
  const rv = [...rtConst.matchAll(/'([a-z:_]+)'/g)].map((x) => x[1]);
  if (rv.length !== 2 || rv[0] !== KEY_POLICY || rv[1] !== KEY_PORTA) note('TYPES-REGISTRY', 'REGIONAL_TREASURY_CAPABILITY_KEYS não são exatamente as 2 keys na ordem policy,porta');
  if (!has(t, /GRANT_CAPABILITY_KEYS = \[[\s\S]*?\.\.\.REGIONAL_TREASURY_CAPABILITY_KEYS[\s\S]*?\]/)) note('TYPES-UNION', 'REGIONAL_TREASURY_CAPABILITY_KEYS não entra em GRANT_CAPABILITY_KEYS');
  if (!has(t, /CapabilityGrantScopeType = 'actor' \| 'territory' \| 'regional_treasury'/)) note('TYPES-SCOPETYPE', 'CapabilityGrantScopeType não inclui regional_treasury');
  if (!has(t, /isRegionalTreasuryCapabilityKey/)) note('TYPES-GUARD', 'type guard isRegionalTreasuryCapabilityKey ausente');
  if (!has(t, /scopeType === 'regional_treasury' && !isRegionalTreasuryCapabilityKey/)) note('TYPES-ASSERT', 'assertCapabilityCompatibleWithScope sem ramo regional por conjunto exato');
  if (!NONFIN_12.every((k) => t.includes(`'${k}'`))) note('TYPES-12KEYS', 'alguma das 12 keys não-financeiras removida dos types');
}

// ══ REGISTRIES DISJUNTOS (permission-keys.ts + TreasuryOperationSource intocados) ══
{
  if (has(S.PERMKEYS.s, new RegExp(`${KEY_POLICY}|${KEY_PORTA}|treasury:regional`))) note('DISJOINT-PERMKEYS', 'permission-keys.ts contém grant keys financeiras regionais (registry disjunto)');
  if (has(S.TREASURYSRC.s, new RegExp(`${KEY_POLICY}|${KEY_PORTA}`))) note('DISJOINT-OPSOURCE', 'TreasuryOperationSource contém as grant keys (registry disjunto)');
}

// ══ RUNTIME · varredura src/ (comment-stripped) — padrões HOSTIS ancorados em regional key ══
// Nominais (registry canônico + prova DB) são excluídos; qualquer OUTRO arquivo com os padrões morde.
{
  const NOMINAL = new Set([
    'src/modules/authority/actor-capability-grant.types.ts',
    'src/scripts/validate-pipeline-e2e-regional-treasury-grant-substrate.ts',
  ]);
  const RT_KEY = /treasury:regional_[a-z_]+/;
  const OPSRC = 'settlement|distribution|governance|reversal|simulation|fiscal_reserve';
  const hasReg = (s) => RT_KEY.test(s);
  const hasBoth = (s) => s.includes(KEY_POLICY) && s.includes(KEY_PORTA);
  const isReg = (s) => /(\]\s*as const|new Set\s*\(|z\.enum\s*\(|enum\s+\w)/.test(s);
  const R = [
    ['R-WILDCARD', (s) => /['"]treasury:\*['"]/.test(s)],
    ['R-STARTSWITH', (s) => /startsWith\(\s*['"]treasury:/.test(s)],
    ['R-OPSOURCE-AS-CAP', (s) => new RegExp(`(capabilityKey|capability_key)\\s*[:=]\\s*['"]treasury:(${OPSRC})`).test(s)],
    ['R-CAP-AS-OPSOURCE', (s) => /treasurySource\s*[:=]\s*['"]treasury:regional/.test(s)],
    ['R-PERMCAP-AS-GRANTKEY', (s) => /(capabilityKey|capability_key)\s*[:=]\s*['"]can_[a-z_]+['"]/.test(s)],
    ['R-PERMKEYS-AS-SOURCE', (s) => hasReg(s) && /from\s+['"][^'"]*permission-keys['"]/.test(s)],
    ['R-FUSION', (s) => hasBoth(s) && /(implies|impliesCapability|grantsAlso|=>\s*['"]treasury:regional)/.test(s)],
    ['R-SINGLE-COVERS-BOTH', (s) => hasBoth(s) && /(\|\||\.some\(|\.every\(|hasEither|coversBoth)/.test(s)],
    ['R-RESIDENCE-GRANT', (s) => hasReg(s) && /(ACTOR_RESIDENCE|resolveActorTerritory|\bresidence\b|address_assignments|addressAssignment)/.test(s)],
    ['R-CITY-MEMBERSHIP-GRANT', (s) => hasReg(s) && /(cityMembership|memberOfCity|belongsToCity|isResidentOf|residentOfCity)/.test(s)],
    ['R-ROLE-GRANT', (s) => hasReg(s) && /(isAdmin|hasRole|\brole\s*===|admin\s*===?\s*true|['"]admin['"])/.test(s)],
    ['R-SELF-GRANT', (s) => hasReg(s) && /(selfGrant|grantee\w*\s*===\s*grant\w*[Bb]y\w*Actor)/.test(s)],
    ['R-IMPLICIT-BOOTSTRAP', (s) => hasReg(s) && /(bootstrap|autoGrant|seedGrant|ensureGrant|autoProvision)/.test(s)],
    ['R-PARALLEL-HOUSE', (s) => /(regional_treasury_grants|regional_authority_grants|treasury_authority_grants|RegionalTreasuryGrant(Store|Repository|Registry))/.test(s)],
    ['R-TENANT-NULL-GLOBAL', (s) => hasReg(s) && /(tenant_id\s+IS\s+NULL|tenant_id\s*==\s*null|tenantId\s*\?\?|OR\s+tenant_id\s+IS\s+NULL)/i.test(s)],
    ['R-CAST-PERMISSION', (s) => hasReg(s) && /(as\s+PermissionKey|as\s+unknown\s+as\s+PermissionKey|PERMISSION_CAPABILITIES\s*\[)/.test(s)],
    ['R-CAST-TREASURY', (s) => hasReg(s) && /as\s+TreasuryOperationSource/.test(s)],
    ['R-DUP-REGISTRY', (s) => hasBoth(s) && isReg(s)],
    ['R-LOCAL-DECL', (s) => hasBoth(s) && !isReg(s)],
  ];
  const SRC = resolve(ROOT, 'src');
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name);
      if (e.isDirectory()) { if (!/__tests__|__mocks__|node_modules/.test(e.name)) walk(p); continue; }
      if (!e.name.endsWith('.ts') || e.name.endsWith('.d.ts')) continue;
      const rel = norm(p.slice(ROOT.length + 1));
      if (NOMINAL.has(rel)) continue;
      const src = strip(readFileSync(p, 'utf8'));
      for (const [marker, test] of R) if (test(src)) note(marker, `${rel}: padrão hostil de autoridade regional detectado em runtime`);
    }
  };
  if (existsSync(SRC)) walk(SRC); else note('SRC-WALK', 'src/ ausente — FAIL');
}

// ══ RUNNER 187 ══
{
  if (!has(S.RUNNER.s, /audit-b-city-regional-treasury-grant-substrate\.mjs/)) note('RUNNER-187', 'guard 187 não registrado no runner');
  for (const g of ['audit-fiscal-tax-reserve-bank-substrate.mjs', 'audit-bank-city-curitiba-foundation.mjs', 'audit-regional-fund-fk-canonical.mjs']) {
    if (!has(S.RUNNER.s, new RegExp(g.replace(/\./g, '\\.')))) note('RUNNER-PRESERVE', `guard preservado ausente do runner: ${g}`);
  }
}

if (fails.length) {
  console.error('\nGATE FAIL [b-city-regional-treasury-grant-substrate]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [b-city-regional-treasury-grant-substrate] — B-CITY-2 dormente (DECISION-0185): '
  + 'scope_type actor|territory|regional_treasury (sem alias); shape 3-way (regional=tenant+city, scope_actor NULL, conjunção estrita); '
  + 'nonfinancial=implicação por scope (12 keys, sem treasury:); chk regional=2 keys exatas (sem 3a/wildcard/não-financeira); '
  + 'matriz 3 ramos sem cruzamento financeiro em actor/territory; unicidade ativa regional (tenant+grantee+capability+city, predicado regional+active); '
  + 'registry canônico nos types; permission-keys.ts + TreasuryOperationSource disjuntos; '
  + 'runtime sem fusão/casa-paralela/grant-por-residência/city/role/self/bootstrap/cast/registry-duplo/tenant-null-global; runner 187. (Comment-aware, marcadores por trava, fail-closed.)');
