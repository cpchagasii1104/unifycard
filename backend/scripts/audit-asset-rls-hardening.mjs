#!/usr/bin/env node
// Guard — F-ASSET-MULTI-OFFER-FOUNDATION Fatia 2b-1b (RLS tenant hardening). As tabelas ASSET tenant-owned
// devem ter RLS ENABLE+FORCE + policy de isolamento por tenant (mesmo padrão de rentable_resources). E
// concept_asset_eligibilities (governança GLOBAL por CONCEPT) NÃO pode virar tenant-scoped (nem tenant_id,
// nem category_id, nem RLS) — isso quebraria o SSOT. MORDE (mutation): remover ENABLE/FORCE/policy de uma
// tabela asset · dar tenant_id/category_id/RLS a concept_asset_eligibilities. Em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const migDir = join(ROOT, 'migrations');
const migFiles = readdirSync(migDir).filter((f) => f.endsWith('.sql'));
// Strip comentários SQL (-- até fim de linha e /* */) — invariantes valem sobre DDL, não sobre comentário.
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const allMig = migFiles.map((f) => stripSql(readFileSync(join(migDir, f), 'utf-8'))).join('\n');

// (1) As 4 tabelas asset tenant-owned têm ENABLE + FORCE + policy de isolamento.
const OWNED = ['actor_assets', 'actor_asset_modes', 'actor_asset_rental_terms', 'actor_asset_rental_pricing_tiers'];
for (const t of OWNED) {
  const enable = new RegExp(`ALTER TABLE ${t}\\s+ENABLE ROW LEVEL SECURITY`, 'i').test(allMig);
  const force = new RegExp(`ALTER TABLE ${t}\\s+FORCE ROW LEVEL SECURITY`, 'i').test(allMig);
  const policy = new RegExp(`CREATE POLICY[^;]*ON ${t}[^;]*current_setting\\('app.current_tenant'`, 'i').test(allMig);
  if (!enable) failures.push(`${t}: sem ENABLE ROW LEVEL SECURITY — tabela asset tenant-owned deve ter RLS.`);
  if (!force) failures.push(`${t}: sem FORCE ROW LEVEL SECURITY.`);
  if (!policy) failures.push(`${t}: sem policy de isolamento por tenant (current_setting('app.current_tenant')).`);
}

// (2) concept_asset_eligibilities NÃO pode ganhar tenant_id / category_id / RLS (é governança GLOBAL).
const CAE = 'concept_asset_eligibilities';
if (new RegExp(`ALTER TABLE ${CAE}[^;]*(ENABLE|FORCE) ROW LEVEL SECURITY`, 'i').test(allMig)) {
  failures.push(`${CAE}: recebeu RLS tenant-scoped — é governança GLOBAL por CONCEPT (viola SSOT).`);
}
if (new RegExp(`ALTER TABLE ${CAE}[^;]*ADD COLUMN[^;]*tenant_id`, 'i').test(allMig) ||
    new RegExp(`CREATE TABLE[^;]*${CAE}[^;]*tenant_id`, 'is').test(allMig)) {
  failures.push(`${CAE}: ganhou tenant_id — elegibilidade por CONCEPT não pode virar verdade por tenant.`);
}
if (new RegExp(`ALTER TABLE ${CAE}[^;]*ADD COLUMN[^;]*category_id`, 'i').test(allMig) ||
    new RegExp(`CREATE TABLE[^;]*${CAE}[^;]*category_id`, 'is').test(allMig)) {
  failures.push(`${CAE}: ganhou category_id — elegibilidade é por CONCEPT, nunca category.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [asset-rls-hardening]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [asset-rls-hardening] — 4 tabelas asset com RLS ENABLE+FORCE+policy por tenant; concept_asset_eligibilities segue GLOBAL (sem tenant_id/category_id/RLS).');
process.exit(0);
