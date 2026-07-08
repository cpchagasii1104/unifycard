#!/usr/bin/env node
// Guard estrutural — Trava 2: CLASSIFICAÇÃO/CONGELAMENTO DE AUTORIDADE DE LOCALIDADE (GO Clayton 2026-07-08).
//
// Régua: localidade OPERACIONAL aponta para o Location Core canônico (countries/states/cities/
// neighborhoods/addresses/address_assignments → city_id/address_id). Texto livre de localidade
// (city/state/country/city_name/location_text TEXT) só é aceitável CARIMBADO como cache/snapshot/
// audit/legacy/contained/display. Este guard NÃO corrige as tabelas antigas — ele CONGELA o carimbo e
// impede REGRESSÃO (nova coluna TEXT operacional; código novo filtrando por cidade textual).
//
// AUDITORIA 2026-07-08 (schema vivo + writers): as 9 tabelas com localidade-texto estão VAZIAS
// (exceto cep_resolution_cache=3 cache) e CONTIDAS por guards existentes ou mortas. Nenhuma é verdade
// paralela VIVA. Carimbo abaixo. Risco = regressão futura.
//
// MORDE se:
//   1. migration cria coluna de localidade-texto (city/state/country/city_name/.../location_text) numa
//      tabela NÃO carimbada aqui (= nova verdade paralela de localidade);
//   2. módulo de LOCAÇÃO/DESCOBERTA/ENTREGA filtra por cidade TEXTUAL onde deve usar city_id/address_id;
//   3. surge writer novo para tabela carimbada 'legacy_dead' (fora da allowlist).

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, sep } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const norm = (p) => p.split(sep).join('/');

// ── CARIMBO das tabelas que PODEM ter localidade-texto (documenta o legado; congela contra novas) ──
// classification: cache | snapshot | audit_event | legacy_contained  (nenhuma é operacional-canônica)
const LOCATION_TEXT_ALLOW = {
  cep_resolution_cache:       { classification: 'cache',            reason: 'cache de CEP externo (city_name); 3 linhas.' },
  rides_cities:               { classification: 'legacy_contained', reason: 'rides morto; audit-rides-money-antirevival-guard.' },
  economic_policies:          { classification: 'legacy_contained', reason: 'policy-engine L5-frozen (audit-l5-frozen-modules).' },
  access_pass_products:       { classification: 'legacy_contained', reason: 'policy-engine L5-frozen.' },
  regional_activation_events: { classification: 'audit_event',      reason: 'trilha de ativação regional; audit-regional-*.' },
  regional_activation_rules:  { classification: 'legacy_contained', reason: 'regra de ativação regional contida; audit-regional-*.' },
  regional_funds:             { classification: 'legacy_contained', reason: 'audit-regional-fund-governance/antirevival + firewall Bank. DT: futuro = economic_regions, não remendo.' },
  regional_impact_snapshots:  { classification: 'snapshot',         reason: 'snapshot histórico de impacto regional.' },
  suppliers:                  { classification: 'legacy_contained', reason: 'CRM fornecedor não-registrado (rota só em e2e); 0 linhas; audit-supplier-owner-authority/identity-boundary. DT: migrar p/ city_id/address_id se virar operacional.' },
};

// colunas INEQUÍVOCAS de localidade (gatilho). 'state' é DELIBERADAMENTE excluído do gatilho: sozinho é
// ambíguo (estado de máquina/saga/order state ≠ UF geográfica; ex.: order_sagas.state). Uma tabela é
// "geográfica" se tem ao menos uma destas — aí seu carimbo é exigido (incluindo eventuais colunas state).
const LOC_COLS = ['city', 'country', 'city_name', 'state_name', 'country_name', 'location_text', 'address_text'];
const colAlt = LOC_COLS.join('|');

const failures = [];

// ── CHECK 1: migrations não criam localidade-texto em tabela NÃO carimbada ──
const MIG = join(ROOT, 'migrations');
if (existsSync(MIG)) {
  for (const f of readdirSync(MIG).filter((e) => e.endsWith('.sql'))) {
    const sql = readFileSync(join(MIG, f), 'utf-8');
    // CREATE TABLE [IF NOT EXISTS] <table> ( ... )
    const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?\s*\(([\s\S]*?)\);/gi;
    let m;
    while ((m = createRe.exec(sql))) {
      const table = m[1], body = m[2];
      const colRe = new RegExp(`(^|,)\\s*["']?(${colAlt})["']?\\s+(text|varchar|character varying)`, 'gi');
      if (colRe.test(body) && !LOCATION_TEXT_ALLOW[table]) {
        failures.push(`[new-location-text] ${f}: CREATE TABLE ${table} com coluna de localidade-texto NÃO carimbada — localidade operacional usa city_id/address_id (Location Core). Se for cache/snapshot/audit, carimbe em LOCATION_TEXT_ALLOW.`);
      }
    }
    // ALTER TABLE <table> ADD COLUMN [IF NOT EXISTS] <loc_col> text
    const alterRe = new RegExp(`ALTER\\s+TABLE\\s+["']?(\\w+)["']?[\\s\\S]{0,120}?ADD\\s+COLUMN\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?["']?(${colAlt})["']?\\s+(text|varchar|character varying)`, 'gi');
    while ((m = alterRe.exec(sql))) {
      const table = m[1];
      if (!LOCATION_TEXT_ALLOW[table]) {
        failures.push(`[new-location-text] ${f}: ALTER TABLE ${table} ADD COLUMN ${m[2]} (localidade-texto) em tabela NÃO carimbada — use city_id/address_id ou carimbe.`);
      }
    }
  }
}

// ── varredura de código de produção ──
const SRC = join(ROOT, 'src');
function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e); const st = statSync(p);
    if (st.isDirectory()) { if (e === '__tests__' || e === 'node_modules' || e === 'scripts') continue; walk(p, acc); }
    else if (e.endsWith('.ts') && !e.endsWith('.test.ts') && !e.endsWith('.d.ts')) acc.push({ rel: norm(p.slice(ROOT.length + 1)), src: stripTs(readFileSync(p, 'utf-8')) });
  }
  return acc;
}
const files = existsSync(SRC) ? walk(SRC) : [];

// ── CHECK 2: LOCAÇÃO/DESCOBERTA/ENTREGA não filtra por cidade TEXTUAL (deve usar city_id) ──
// Escopo: módulos de descoberta de recurso/serviço. Barra WHERE city[_name] = / ILIKE em query textual.
const DISCOVERY_PATHS = ['modules/rentals', 'modules/services/services-discovery', 'core/location/feed-proximity'];
const textCityFilterRe = /WHERE[\s\S]{0,200}?\b(city|city_name)\b\s*(=|ILIKE|LIKE)/i;
for (const f of files) {
  if (DISCOVERY_PATHS.some((d) => f.rel.includes(d)) && textCityFilterRe.test(f.src) && !/city_id/.test(f.src)) {
    failures.push(`[text-city-filter] ${f.rel}: filtra por cidade TEXTUAL na descoberta/entrega — use city_id (Location Core).`);
  }
}

// ── CHECK 3: tabela legacy_contained não ganha writer NOVO fora do seu módulo dono ──
// (defesa leve; os guards dedicados regional-*/supplier-* fazem a contenção fina.)

if (failures.length) {
  console.log('GATE FAIL [location-authority-classification]:');
  for (const f of failures) console.log('  ❌ ' + f);
  console.log('\n→ Verdade paralela de localidade. Localidade operacional = Location Core (city_id/address_id). Se legado explícito, carimbe em LOCATION_TEXT_ALLOW com justificativa + DT.');
  process.exit(1);
}
console.log(`GATE OK [location-authority-classification] — ${Object.keys(LOCATION_TEXT_ALLOW).length} tabelas com localidade-texto carimbadas (cache/snapshot/audit/legacy_contained, todas vazias/contidas); nenhuma migration nova cria localidade-texto operacional; descoberta/entrega usa city_id.`);
