#!/usr/bin/env node
// Guard estrutural — F-SEGMENT-TEMPLATE-FISCAL-FOUNDATION Fase A (DECISION-0168; compõe 0117 E + 0167).
//
// Trava a faceta FISCAL dos business_templates como SUGESTÃO/molde governado — nunca verdade fiscal:
//   (T1) casa íntegra: business_template_fiscal_profiles/items existem, ancoradas em
//        business_template_versions (nunca soltas, nunca em company_types/business_segments);
//        freeze de business_template_versions vivo (R1 — versão aplicada não se reescreve);
//        status draft/published/deprecated + published imutável + deprecated terminal + itens
//        congelados sob published; território por FK composta Location Core com CHECK de forma;
//   (T2) template NÃO é verdade: ZERO coluna de alíquota (rate_bps/percent/tax_rate), ZERO FK a
//        tax_types/tax_rules (catálogo é tenant-scoped; template é referência global), ZERO
//        category_id/categories (concept é a identidade — N2 §3.2), ZERO tenant_id;
//   (T3) nasce VAZIA: nenhuma migration insere template fiscal real (INSERT em
//        business_template_fiscal_* = FAIL — publicação de conteúdo real é fatia futura com GO e
//        curadoria, por runtime governado, não por seed);
//   (T4) anti-4ª-noção: migration futura criando tabela paralela de segmento fiscal = FAIL;
//   (T5) fronteiras de escrita/leitura: módulo de templates NÃO escreve em tax_types/tax_rules
//        (ativação = Fase C, serviço próprio via rito canônico); módulo fiscal/motor NÃO lê
//        tabelas de template (allowlist DECISION-0167 §3).
// stripComments OBRIGATÓRIO (TS e SQL). NÃO altera runtime. Em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s
  .replace(/--[^\n]*/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const failures = [];
const readSql = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripSql(readFileSync(p, 'utf-8')) : null; };
const need = (src, file, re, why) => { if (src === null) { failures.push(`arquivo ausente: ${file}`); return; } if (!re.test(src)) failures.push(`${file}: ${why}`); };
const forbid = (src, file, re, why) => { if (src !== null && re.test(src)) failures.push(`${file}: ${why}`); };

function walkTs(dir, out = []) {
  let entries; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walkTs(full, out); }
    else if (e.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

const MIG = 'migrations/20260710160000_business_template_fiscal_foundation.sql';
const mig = readSql(MIG);

// ── (T1) casa íntegra ──
need(mig, MIG, /CREATE TABLE IF NOT EXISTS business_template_fiscal_profiles/, 'business_template_fiscal_profiles sumiu.');
need(mig, MIG, /CREATE TABLE IF NOT EXISTS business_template_fiscal_items/, 'business_template_fiscal_items sumiu.');
need(mig, MIG, /template_version_id UUID NOT NULL REFERENCES business_template_versions\(id\)/, 'faceta fiscal perdeu a âncora em business_template_versions — nunca solta (anti-4ª-noção de segmento).');
need(mig, MIG, /CREATE TRIGGER business_template_versions_freeze\b(?!_)/, 'freeze de business_template_versions sumiu (R1 — versão aplicada não pode ser reescrita).');
need(mig, MIG, /CREATE TRIGGER btfp_immutability\b(?!_)/, 'trigger de imutabilidade dos fiscal_profiles sumiu.');
need(mig, MIG, /CREATE TRIGGER btfi_freeze_when_published\b(?!_)/, 'freeze dos fiscal_items sob published sumiu.');
need(mig, MIG, /chk_btfp_status CHECK \(status IN \('draft', 'published', 'deprecated'\)\)/, 'status governado dos fiscal_profiles divergiu.');
need(mig, MIG, /only published→deprecated is allowed/, 'trigger perdeu a trava published-imutável (publicação alterável silenciosamente).');
need(mig, MIG, /deprecated profile % is terminal/, 'trigger perdeu a trava deprecated-terminal.');
need(mig, MIG, /CONSTRAINT fk_btfp_state\s*\n?\s*FOREIGN KEY \(country_id, state_id\) REFERENCES states\(country_id, state_id\)/, 'FK composta territorial de estado sumiu.');
need(mig, MIG, /CONSTRAINT fk_btfp_city\s*\n?\s*FOREIGN KEY \(state_id, city_id\) REFERENCES cities\(state_id, city_id\)/, 'FK composta territorial de cidade sumiu.');
need(mig, MIG, /CONSTRAINT chk_btfp_territory_shape/, 'CHECK de forma territorial sumiu.');
need(mig, MIG, /uq_btfp_published_per_territory/, 'UNIQUE de uma-publicação-viva-por-versão+território sumiu.');
need(mig, MIG, /concept_id UUID NULL REFERENCES concepts\(concept_id\)/, 'itens fiscais perderam a referência a concepts (SSOT semântico).');
need(mig, MIG, /chk_btfi_regime CHECK \(\s*tax_regime IS NULL OR tax_regime IN \('MEI', 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'OTHER'\)\s*\)/, 'CHECK do TaxRegime D9.5 divergiu nos itens.');
need(mig, MIG, /base_type IS NULL OR base_type IN \('gross_transaction', 'commission_gross', 'commission_distributable'\)/, 'CHECK do base_type (vocabulário DECISION-0167 §5) divergiu.');
need(mig, MIG, /rationale TEXT NOT NULL/, 'rationale deixou de ser obrigatório nos itens.');
need(mig, MIG, /source TEXT NOT NULL/, 'source deixou de ser obrigatório.');

// ── (T2) template NÃO é verdade fiscal ──
// (declaração de COLUNA real — nome+tipo em início de linha; menção em string/verificação não é estrutura)
forbid(mig, MIG, /^\s*(rate_bps|tax_rate|percent|aliquota)\s+(NUMERIC|INTEGER|DECIMAL|BIGINT|REAL)/im, 'coluna de ALÍQUOTA na casa de templates fiscais — template sugere QUE tributo existe, nunca QUANTO (DECISION-0168 §3).');
forbid(mig, MIG, /REFERENCES tax_types\b|REFERENCES tax_rules\b/, 'FK para tax_types/tax_rules no template — impossível por design (catálogo tenant-scoped × template global); ativação = Fase C via rito canônico.');
forbid(mig, MIG, /^\s*category_id\s+UUID|REFERENCES categories\b/im, 'category como coluna/FK na casa de templates fiscais — concept é a identidade (N2 §3.2 / protocolo §12).');
forbid(mig, MIG, /^\s*tenant_id\s+UUID/im, 'tenant_id na casa de templates fiscais — é referência GLOBAL (padrão concepts/eligibilities); por-tenant é a configuração ativa.');

// ── (T3) nasce vazia + (T4) anti-4ª-noção — TODAS as migrations ──
const migDir = join(ROOT, 'migrations');
for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql'))) {
  const src = stripSql(readFileSync(join(migDir, f), 'utf-8'));
  if (/INSERT INTO business_template_fiscal_(profiles|items)/.test(src)) {
    failures.push(`migrations/${f}: SEED de template fiscal em migration — conteúdo real entra por curadoria governada em runtime (fatia futura com GO), nunca por seed (DECISION-0168 §9/§13).`);
  }
  if (f > '20260710160000_z') {
    if (/CREATE TABLE (IF NOT EXISTS )?(segment_fiscal_templates|fiscal_segment_templates|segment_tax_templates|company_type_fiscal_profiles|business_segment_fiscal)\w*\b/i.test(src)) {
      failures.push(`migrations/${f}: tabela PARALELA de segmento fiscal — a casa canônica é business_template_fiscal_profiles ancorada em business_template_versions (D-0 da DECISION-0168; 4ª noção de segmento = REPROVA).`);
    }
    if (/DROP TRIGGER (IF EXISTS )?(business_template_versions_freeze|btfp_immutability|btfi_freeze_when_published)/.test(src) && !/CREATE TRIGGER (business_template_versions_freeze|btfp_immutability|btfi_freeze_when_published)/.test(src)) {
      failures.push(`migrations/${f}: dropa trigger da casa de templates fiscais SEM recriar.`);
    }
    if (/ALTER TABLE business_template_fiscal_\w+[\s\S]*?ADD COLUMN[\s\S]{0,80}(rate_bps|tax_rate|percent|aliquota|category_id|tenant_id)/i.test(src)) {
      failures.push(`migrations/${f}: adiciona coluna proibida (alíquota/category/tenant) à casa de templates fiscais.`);
    }
  }
}

// ── (T5) fronteiras de escrita/leitura ──
// módulo(s) de template NÃO escrevem no catálogo fiscal do tenant:
const TEMPLATE_SURFACES = ['src/core/companies/business-templates.service.ts', 'src/core/companies/company-templates.routes.ts'];
for (const rel of TEMPLATE_SURFACES) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) continue;
  const src = stripTs(readFileSync(p, 'utf-8'));
  if (/(INSERT INTO|UPDATE|DELETE FROM)\s+tax_(types|rules)/i.test(src) || /createDraftRule|activateRule|taxCatalogRepository/.test(src)) {
    failures.push(`${rel}: superfície de TEMPLATE escrevendo/chamando o catálogo fiscal do tenant — ativação é a Fase C (serviço próprio, validador humano, rito canônico); template nunca ativa imposto sozinho.`);
  }
}
// módulo fiscal (e futuro motor 4d) NÃO lê tabelas de template (allowlist 0167 §3):
for (const f of walkTs(join(ROOT, 'src', 'modules', 'fiscal'))) {
  const rel = f.replace(ROOT, '.').replace(/\\/g, '/');
  const src = stripTs(readFileSync(f, 'utf-8'));
  if (/business_template_fiscal|business_templates\b|business_template_versions/.test(src)) {
    failures.push(`${rel}: módulo fiscal lendo tabelas de TEMPLATE — o motor lê SOMENTE configuração ativa do tenant (allowlist DECISION-0167 §3); template não é fonte.`);
  }
}

// ── (T6 — Fase B-1) sugestão READ-ONLY (DECISION-0169) ──
const SUG = 'src/core/companies/business-template-suggestion.service.ts';
const BTS = 'src/core/companies/business-templates.service.ts';
const readTsFile = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const sug = readTsFile(SUG);
const bts = readTsFile(BTS);

// sugestão não escreve NADA (nem aplicação — autoaplicar é o risco central 0169 §1.R)
forbid(sug, SUG, /INSERT INTO|UPDATE\s+\w|DELETE FROM/i, 'serviço de SUGESTÃO escrevendo no banco — sugestão é READ-ONLY (0169 §1.R).');
forbid(sug, SUG, /applyTemplate/, 'serviço de SUGESTÃO chamando applyTemplate — AUTOAPLICAÇÃO proibida (0169 §1.R); aplicar é ato humano autorizado.');
forbid(sug, SUG, /createDraftRule|activateRule|taxCatalogRepository/, 'serviço de SUGESTÃO tocando o catálogo fiscal do tenant — ativação é a Fase C (rito canônico com contador).');
forbid(sug, SUG, /actor_fiscal_profiles|fiscal-profile\.repository/, 'serviço de SUGESTÃO tocando actor_fiscal_profiles — perfil do contribuinte não é assunto de sugestão de template.');
forbid(sug, SUG, /rate_bps|provision|calculateTax|Math\.(round|floor|ceil)/, 'serviço de SUGESTÃO calculando/estimando imposto — provisão é o motor 4d (0167), nunca template.');
// slug de navegação NÃO é inferência fiscal (N2 §3.2) — serviço deve ser data-driven, sem slug de segmento hardcoded
forbid(sug, SUG, /'(acougue|açougue|hortifruti|mecanica|mecânica|salao|salão|supermercado|farmacia|farmácia|padaria)'/, 'slug de segmento HARDCODED no serviço de sugestão — inferência por slug é o exemplo PROIBIDO da norma N2 §3.2; a ponte é CNAE→concept→categoria (dado curado).');
// company_type não é verdade fiscal — o disclaimer é contrato do read-model
need(sug, SUG, /não é verdade fiscal/, 'serviço de sugestão perdeu o disclaimer de company_type ("não é verdade fiscal") — 0169 §7.');
need(sug, SUG, /is_primary/, 'sugestão por CNAE perdeu a distinção primário/secundário (0169 §7: primário pesa mais, nunca decide sozinho).');
// vocabulário de proveniência: const = CHECK da migration
need(bts, BTS, /RECOMMENDATION_ORIGINS = \['manual', 'company_type', 'cnae', 'accountant', 'admin'\] as const/, 'RECOMMENDATION_ORIGINS divergiu do vocabulário governado (0169 §3).');
const MIG_B1 = 'migrations/20260710170000_cta_recommendation_tracking.sql';
const migB1 = readSql(MIG_B1);
need(migB1, MIG_B1, /recommendation_origin IN \('manual', 'company_type', 'cnae', 'accountant', 'admin'\)/, 'CHECK chk_cta_recommendation_origin divergiu do vocabulário governado.');
need(migB1, MIG_B1, /chk_cta_cnae_requires_context/, 'CHECK cnae-exige-rationale+source sumiu (curadoria 0169 §3/§6).');
// PDV/preview não usa template para estimativa (0169 §12)
for (const f of walkTs(join(ROOT, 'src', 'modules', 'pdv'))) {
  const rel = f.replace(ROOT, '.').replace(/\\/g, '/');
  const src = stripTs(readFileSync(f, 'utf-8'));
  if (/business_template_fiscal|business-template-suggestion/.test(src)) {
    failures.push(`${rel}: PDV lendo template fiscal/sugestão — preview depende de configuração ATIVA e/ou motor (0169 §12); template nunca é estimativa.`);
  }
}

// ── veredito ──
console.log(`[segment-fiscal-template] failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [segment-fiscal-template]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [segment-fiscal-template] — DECISION-0168 travada: faceta fiscal ancorada em business_template_versions (freeze R1 vivo; published imutável; deprecated terminal; itens congelados sob published; território por FK composta; concepts como identidade); template SEM alíquota/FK-a-tax_rules/category/tenant (sugestão, nunca verdade); casa nasce VAZIA (seed = FAIL); sem 4ª noção de segmento; superfícies de template sem escrever no catálogo fiscal; módulo fiscal sem ler template. Ativação = Fase C com contador; motor 4d segue lendo só configuração ativa.');
