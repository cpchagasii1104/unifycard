#!/usr/bin/env node
// audit-b-city-regional-treasury-grant-substrate.mjs — Guard dedicado B-CITY-2 (posição 187 do runner).
// DECISION-0185 (Financial Authority Grant Model). Congela o SUBSTRATO DORMENTE de autoridade financeira
// regional em actor_capability_grants: 3o scope_type fechado regional_treasury, shape tenant+city, matriz
// particionada, existência financeira dedicada, unicidade ativa regional, registry canônico das 2 grant
// keys (types), registries disjuntos (permission-keys.ts / TreasuryOperationSource INTOCADOS), dormência
// (zero grant/writer/policy/PORTA/Bank). Prova de CONTRATO (não mera presença). Fail-closed (exit!=0).
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const strip = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fails = [];
const note = (m) => fails.push(m);
const has = (s, re) => re.test(s);

const F = {
  MIG: 'migrations/20260716140000_regional_treasury_authority_grant_substrate.sql',
  TYPES: 'src/modules/authority/actor-capability-grant.types.ts',
  PERMKEYS: 'src/core/authorization/permission-keys.ts',
  TREASURYSRC: 'src/modules/bank/bank-transaction.types.ts',
  RUNNER: 'scripts/run-regression-guards.mjs',
};
const S = Object.fromEntries(Object.entries(F).map(([k, p]) => {
  if (!existsSync(resolve(ROOT, p))) { note(`arquivo material ausente: ${p}`); return [k, { raw: '', s: '' }]; }
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

// ── A · scope_type + shape (migration, contrato físico) ──
{
  const m = S.MIG.s;
  const scopeCheck = (m.match(/ADD CONSTRAINT chk_acg_scope_type CHECK[\s\S]*?\)\)/) || [''])[0];
  if (!has(scopeCheck, /'actor'/) || !has(scopeCheck, /'territory'/) || !has(scopeCheck, /'regional_treasury'/)) {
    note('A1: chk_acg_scope_type não fecha em actor|territory|regional_treasury');
  }
  if (has(scopeCheck, /'(financial|treasury|city_treasury|regional_finance|global|city|state|country|region|system)'/)) {
    note('A2: chk_acg_scope_type admite valor/alias proibido');
  }
  const shape = (m.match(/ADD CONSTRAINT chk_acg_scope_shape CHECK[\s\S]*?scope_city_id IS NOT NULL\s*\n\s*\)\s*\n\s*\)/) || m.match(/ADD CONSTRAINT chk_acg_scope_shape CHECK[\s\S]*?\)\s*;/) || [''])[0];
  if (!has(shape, /scope_type = 'regional_treasury'[\s\S]*?tenant_id IS NOT NULL[\s\S]*?scope_actor_id IS NULL[\s\S]*?scope_city_id IS NOT NULL/)) {
    note('A3: shape regional_treasury não é tenant NOT NULL + scope_actor_id NULL + scope_city_id NOT NULL');
  }
  if (!has(shape, /scope_type = 'actor'[\s\S]*?scope_city_id IS NULL/) || !has(shape, /scope_type = 'territory'[\s\S]*?scope_city_id IS NOT NULL/)) {
    note('A4: shapes actor/territory não preservados no CHECK de shape');
  }
}

// ── B · matriz particionada + existência financeira dedicada + unicidade regional ──
{
  const m = S.MIG.s;
  const nonfin = (m.match(/ADD CONSTRAINT chk_acg_capability_nonfinancial CHECK[\s\S]*?\)\s*;/) || [''])[0];
  if (!has(nonfin, /scope_type NOT IN \('actor', 'territory'\)/) && !has(nonfin, /scope_type IN \('actor', 'territory'\)/)) {
    note('B1: chk_acg_capability_nonfinancial não virou implicação guardada por scope');
  }
  if (!NONFIN_12.every((k) => nonfin.includes(`'${k}'`))) note('B2: chk_acg_capability_nonfinancial perdeu alguma das 12 keys');
  if (has(nonfin, /treasury:/)) note('B3: chk_acg_capability_nonfinancial contém treasury:* (proibido)');

  const rt = (m.match(/ADD CONSTRAINT chk_acg_capability_regional_treasury CHECK[\s\S]*?\)\s*;/) || [''])[0];
  if (!rt) note('B4: chk_acg_capability_regional_treasury ausente');
  if (!has(rt, new RegExp(`'${KEY_POLICY}'`)) || !has(rt, new RegExp(`'${KEY_PORTA}'`))) note('B5: chk_acg_capability_regional_treasury sem as 2 keys exatas');
  const rtKeys = [...rt.matchAll(/'treasury:[a-z_]+'/g)].map((x) => x[0]);
  if (rtKeys.length !== 2) note(`B6: chk_acg_capability_regional_treasury tem ${rtKeys.length} keys treasury (esperado 2)`);
  if (has(rt, /LIKE|~~|startsWith|treasury:%/)) note('B7: chk_acg_capability_regional_treasury usa prefixo/LIKE (proibido)');

  const matrix = (m.match(/ADD CONSTRAINT chk_acg_scope_capability_matrix CHECK[\s\S]*?\)\s*;/) || [''])[0];
  if (!has(matrix, /scope_type = 'actor'/) || !has(matrix, /scope_type = 'territory'/) || !has(matrix, /scope_type = 'regional_treasury'/)) {
    note('B8: matriz não cobre os 3 ramos de scope');
  }
  if (!has(matrix, new RegExp(`scope_type = 'regional_treasury'[\\s\\S]*?'${KEY_POLICY}'[\\s\\S]*?'${KEY_PORTA}'`))) {
    note('B9: ramo regional_treasury da matriz sem as 2 keys financeiras');
  }
  const uidx = (m.match(/CREATE UNIQUE INDEX uidx_actor_capability_grants_regional_treasury_active[\s\S]*?;/) || [''])[0];
  if (!has(uidx, /\(tenant_id, grantee_actor_id, capability_key, scope_city_id\)/)) note('B10: unicidade regional sem as colunas exatas (com tenant_id)');
  if (!has(uidx, /scope_type = 'regional_treasury'[\s\S]*?status = 'active'/)) note('B11: unicidade regional sem predicado parcial regional_treasury+active');
  if (has(uidx, /now\(\)|valid_from|valid_until/)) note('B12: unicidade regional contém now()/vigência (proibido)');
}

// ── C · registry canônico das 2 grant keys (types) ──
{
  const t = S.TYPES.s;
  const rtConst = (t.match(/REGIONAL_TREASURY_CAPABILITY_KEYS = \[[\s\S]*?\] as const/) || [''])[0];
  const rv = [...rtConst.matchAll(/'([a-z:_]+)'/g)].map((x) => x[1]);
  if (rv.length !== 2 || rv[0] !== KEY_POLICY || rv[1] !== KEY_PORTA) note('C1: REGIONAL_TREASURY_CAPABILITY_KEYS não são exatamente as 2 keys na ordem policy,porta');
  if (!has(t, /GRANT_CAPABILITY_KEYS = \[[\s\S]*?\.\.\.REGIONAL_TREASURY_CAPABILITY_KEYS[\s\S]*?\]/)) note('C2: REGIONAL_TREASURY_CAPABILITY_KEYS não entra em GRANT_CAPABILITY_KEYS');
  if (!has(t, /CapabilityGrantScopeType = 'actor' \| 'territory' \| 'regional_treasury'/)) note('C3: CapabilityGrantScopeType não inclui regional_treasury');
  if (!has(t, /isRegionalTreasuryCapabilityKey/)) note('C4: type guard isRegionalTreasuryCapabilityKey ausente');
  if (!has(t, /scopeType === 'regional_treasury' && !isRegionalTreasuryCapabilityKey/)) note('C5: assertCapabilityCompatibleWithScope sem ramo regional_treasury por conjunto exato');
  if (!NONFIN_12.every((k) => t.includes(`'${k}'`))) note('C6: alguma das 12 keys não-financeiras removida dos types');
  if (has(t, /startsWith\(['"]treasury:/) || has(t, /startsWith\(['"]territory:/)) note('C7: types usa startsWith(prefix) como autoridade (proibido — conjunto exato)');
}

// ── D · registries disjuntos (permission-keys.ts + TreasuryOperationSource INTOCADOS) ──
{
  const pk = S.PERMKEYS.s;
  if (has(pk, /treasury:regional/) || has(pk, new RegExp(`${KEY_POLICY}|${KEY_PORTA}`))) note('D1: permission-keys.ts contém grant keys financeiras regionais (proibido — registry disjunto)');
  const ts = S.TREASURYSRC.s;
  if (has(ts, new RegExp(`${KEY_POLICY}|${KEY_PORTA}`))) note('D2: TreasuryOperationSource contém as grant keys (proibido — registry disjunto)');
}

// ── E · dormência / zero material (migration não cria grant/writer/policy/PORTA/Bank) ──
{
  const m = S.MIG.s;
  if (has(m, /INSERT INTO (public\.)?actor_capability_grants/i)) note('E1: migration insere grant real (proibido — substrato dormente)');
  if (has(m, /CREATE (OR REPLACE )?FUNCTION/i)) note('E2: migration cria função/writer (proibido — substrato nasce sem porta de escrita)');
  if (has(m, /GRANT (INSERT|UPDATE|DELETE)[\s\S]*?unificard_app/i)) note('E3: migration reconcede DML a unificard_app (fronteira de escrita)');
  if (has(m, /\b(bank_transactions|bank_splits|bank_accounts|bank_ledger|economic_policies|economic_policy_lines|regional_fund_accounts|fiscal_provision_events|fiscal_reserve_accounts)\b/)) {
    note('E4: migration referencia Bank/policy/fiscal (fora do escopo — só actor_capability_grants)');
  }
  // Nota: PORTA/firewall pertencem ao envelope FUTURO de composição/PORTA (não a esta tabela de authority).
  // A dormência deste substrato é provada por E1 (sem grant), E2 (sem writer) e E4 (sem Bank/policy).
}

// ── F · runner 187 + preservações ──
{
  const runner = S.RUNNER.s;
  if (!has(runner, /audit-b-city-regional-treasury-grant-substrate\.mjs/)) note('F1: guard 187 não registrado no runner');
  for (const g of ['audit-fiscal-tax-reserve-bank-substrate.mjs', 'audit-bank-city-curitiba-foundation.mjs', 'audit-regional-fund-fk-canonical.mjs']) {
    if (!has(runner, new RegExp(g.replace(/\./g, '\\.')))) note(`F2: guard preservado ausente do runner: ${g}`);
  }
}

if (fails.length) {
  console.error('\nGATE FAIL [b-city-regional-treasury-grant-substrate]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [b-city-regional-treasury-grant-substrate] — B-CITY-2 dormente (DECISION-0185): '
  + 'scope_type fechado actor|territory|regional_treasury; shape regional_treasury=tenant+city (scope_actor NULL); '
  + 'nonfinancial virou implicação por scope (12 keys intactas); chk_acg_capability_regional_treasury=2 keys exatas (sem wildcard); '
  + 'matriz particionada 3 ramos; unicidade ativa regional (tenant,grantee,capability,city); '
  + 'REGIONAL_TREASURY_CAPABILITY_KEYS registry canônico nos types (permission-keys.ts + TreasuryOperationSource disjuntos/intocados); '
  + 'dormência (zero grant/writer/policy/PORTA/Bank na migration); runner 187. (Comment-aware, fail-closed.)');
