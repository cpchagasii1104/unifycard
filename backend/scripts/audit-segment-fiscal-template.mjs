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
  if (/business_template_fiscal|business-template-suggestion|business-template-checklist/.test(src)) {
    failures.push(`${rel}: PDV lendo template fiscal/sugestão/checklist — preview depende de configuração ATIVA e/ou motor (0169 §12); template/checklist nunca é estimativa.`);
  }
}

// ── (T7 — Fase B-2) checklist fiscal READ-MODEL (DECISION-0169 §4/§9) ──
const CHK = 'src/core/companies/business-template-checklist.service.ts';
const chk = readTsFile(CHK);

// checklist não escreve NADA e não ativa NADA (0169 §4: a Fase B nunca escreve no catálogo fiscal)
forbid(chk, CHK, /INSERT INTO|UPDATE\s+\w|DELETE FROM/i, 'serviço de CHECKLIST escrevendo no banco — checklist é READ-MODEL derivado/recomputável (0169 §4/§9).');
forbid(chk, CHK, /createDraftRule|activateRule/, 'serviço de CHECKLIST criando/ativando regra fiscal — ativação é a Fase C (rito canônico com contador, 0169 §11).');
forbid(chk, CHK, /applyTemplate/, 'serviço de CHECKLIST aplicando template — aplicar é ato humano autorizado (0169 §1.R).');
forbid(chk, CHK, /actor_fiscal_profiles|fiscal-profile\.repository/, 'serviço de CHECKLIST tocando actor_fiscal_profiles — fora da fronteira da Fase B (0169 §4).');
// sem cálculo: checklist compara dimensões, nunca multiplica alíquota nem produz número fiscal
forbid(chk, CHK, /rateBps\s*\*|\*\s*rateBps|rate_bps\s*\*|\*\s*rate_bps|Math\.(round|floor|ceil)|base_cents|baseCents|gross_transaction_cents|grossTransactionCents|provision|tax_reserve|taxReserve/, 'serviço de CHECKLIST calculando imposto/provisão — número fiscal é o motor 4d (0167, GO próprio); checklist só compara dimensões.');
// Bank fora (Lei de Coerência §4.6)
forbid(chk, CHK, /bank_ledger|bank_splits|bank_transactions|bank_accounts|payment_intents|checkout|@modules\/bank|bankSplitEngine|createTransactionWith/i, 'serviço de CHECKLIST tocando Bank/ledger/split/orders/checkout — PROIBIDO (fiscal configura, Bank executa).');
// teto da B-2: activated_by_accountant é da FASE C — o vocabulário derivado NÃO o contém
need(chk, CHK, /ONBOARDING_STATES = \[\s*'no_template', 'suggested', 'applied_draft', 'fiscal_pending', 'partially_validated', 'ready_for_activation',?\s*\] as const/, 'ONBOARDING_STATES divergiu do vocabulário §9 (até ready_for_activation).');
forbid(chk, CHK, /activated_by_accountant/, "serviço de CHECKLIST conhece/retorna 'activated_by_accountant' — esse estado PERTENCE À FASE C (0169 §9); a B-2 para em ready_for_activation.");
// pendência honesta é contrato do read-model (0169 §5)
need(chk, CHK, /configuração fiscal pendente — validar com contador/, 'checklist perdeu a mensagem de pendência honesta (0169 §5) — ausência de regra nunca vira invenção.');
need(chk, CHK, /configuração sugerida — requer validação/, 'checklist perdeu o rótulo obrigatório da superfície (0167 §9 / 0169 §10).');
// matching é heurística de exibição — nunca vínculo persistido (0169 §4)
need(chk, CHK, /matchedRuleId/, 'checklist perdeu matchedRuleId em memória — a cobertura deve ser rastreável NA RESPOSTA (nunca em tabela).');

// Superfície do checklist: INVERSÃO CONSCIENTE na B-3 (DECISION-0170, GO de Clayton) — o precedente
// F1-d ("proíbe" vira "exige legítimo + proíbe fora do lugar"). A ÚNICA superfície permitida é
// company-templates.routes.ts (com autoridade + fidelidade, travadas no T8). Qualquer OUTRA rota/
// builder consumindo o checklist segue FAIL (PDV/admin/segunda superfície = fatia própria com GO).
const CHECKLIST_SURFACE_ALLOWED = 'core/companies/company-templates.routes.ts';
for (const f of walkTs(join(ROOT, 'src'))) {
  const rel = f.replace(ROOT, '.').replace(/\\/g, '/');
  if (!/\.routes\.ts$|app\.builder\.ts$|\/routes\//.test(rel)) continue;
  if (rel.includes(CHECKLIST_SURFACE_ALLOWED)) continue; // B-3: superfície única autorizada (T8 trava o conteúdo)
  const src = stripTs(readFileSync(f, 'utf-8'));
  if (/business-template-checklist|checklistForCompany/.test(src)) {
    failures.push(`${rel}: rota/superfície consumindo o checklist fiscal FORA da superfície única da B-3 (company-templates.routes) — segunda superfície exige GO próprio.`);
  }
}

// estado do onboarding NUNCA vira coluna/tabela persistida (0169 §9) — em QUALQUER migration
for (const f of readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql'))) {
  const src = stripSql(readFileSync(join(ROOT, 'migrations', f), 'utf-8'));
  if (/onboarding_state|ready_for_activation|fiscal_pending|partially_validated/i.test(src)) {
    failures.push(`migrations/${f}: estado de onboarding fiscal PERSISTIDO em schema — 0169 §9 exige read-model derivado/recomputável, nunca coluna de verdade.`);
  }
  if (/CREATE TABLE (IF NOT EXISTS )?\w*(fiscal_checklist|checklist_fiscal|onboarding)\w*/i.test(src)) {
    failures.push(`migrations/${f}: tabela de checklist/onboarding persistido — o checklist é derivado em runtime (0169 §4/§9), nunca gravado.`);
  }
  // vínculo persistido template↔catálogo do tenant (global × tenant) é impossível por design (0169 §4)
  if (/(ALTER TABLE|CREATE TABLE)[^;]*business_template[\s\S]{0,400}?REFERENCES tax_(types|rules)/i.test(src)) {
    failures.push(`migrations/${f}: FK de casa de template para tax_types/tax_rules — vínculo global×tenant é impossível por design (0169 §4); matching é heurística de exibição.`);
  }
}

// motor fiscal (4d, quando existir) NÃO lê checklist/sugestão (allowlist 0167 §3) — reforço do T5
for (const f of walkTs(join(ROOT, 'src', 'modules', 'fiscal'))) {
  const rel = f.replace(ROOT, '.').replace(/\\/g, '/');
  const src = stripTs(readFileSync(f, 'utf-8'));
  if (/business-template-checklist|checklistForCompany/.test(src)) {
    failures.push(`${rel}: módulo fiscal lendo o CHECKLIST — o motor lê SOMENTE configuração ativa do tenant (0167 §3); checklist é superfície de onboarding, não fonte fiscal.`);
  }
}

// ── (T8 — Fase B-3) rota READ-ONLY do checklist (DECISION-0170) ──
{
  const RTS = 'src/core/companies/company-templates.routes.ts';
  const CHK = 'src/core/companies/business-template-checklist.service.ts';
  const API_DOC = 'docs/API_CONTRACT_GOVERNANCE.md';
  const rtsRaw = (() => { const p = join(ROOT, RTS); return existsSync(p) ? readFileSync(p, 'utf-8') : null; })();
  const rts = rtsRaw === null ? null : stripTs(rtsRaw);
  const chk = (() => { const p = join(ROOT, CHK); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; })();
  const apiDoc = (() => { const p = join(ROOT, API_DOC); return existsSync(p) ? readFileSync(p, 'utf-8') : null; })();

  need(rts, RTS, /fiscal-template-checklist/, 'rota do checklist fiscal sumiu (DECISION-0170 §1).');
  // arquivo de rotas NUNCA emite SQL de escrita (toda escrita é de serviço com autoridade)
  forbid(rts, RTS, /INSERT INTO|DELETE FROM|UPDATE\s+\w+\s+SET/i, 'company-templates.routes emitindo SQL de escrita — rotas projetam, serviços escrevem.');
  forbid(rts, RTS, /createDraftRule|activateRule|taxCatalogRepository/, 'company-templates.routes tocando o catálogo fiscal do tenant — ativação = Fase C (serviço próprio, rito canônico).');
  forbid(rts, RTS, /provision_cents|provisionCents|activated_by_accountant/, 'rota expondo provisão/estado da Fase C — proibido (0170 §5/§6).');
  forbid(rts, RTS, /(FROM|INTO|JOIN)\s+(bank_ledger|bank_splits|bank_transactions|bank_accounts)\b|modules\/bank|modules\/pdv/i, 'company-templates.routes tocando Bank/PDV.');
  if (rts !== null) {
    // slice da rota do checklist: da declaração até o próximo registro de rota
    const at = rts.indexOf('fiscal-template-checklist');
    const rest = rts.slice(at);
    const next = rest.indexOf('fastify.', 20);
    const slice = next > 0 ? rest.slice(0, next) : rest;
    if (!/assertCompanyTemplateAuthority/.test(slice)) {
      failures.push(`${RTS}: rota do checklist SEM assertCompanyTemplateAuthority — checklist fiscal nunca é público nem só-tenant (0170 §2).`);
    }
    if (!/checklistForCompany/.test(slice)) {
      failures.push(`${RTS}: rota do checklist não usa a fonte ÚNICA checklistForCompany (B-2) — proibido recompor/enriquecer (0170 §1).`);
    }
    if (!/send\(\{ ok: true, data \}\)/.test(slice)) {
      failures.push(`${RTS}: rota do checklist RESHAPEANDO a resposta — projeção deve ser FIEL (send({ ok: true, data })); reshape pode omitir o disclaimer obrigatório (0170 §3).`);
    }
    if (/applyTemplate/.test(slice)) {
      failures.push(`${RTS}: rota do checklist chamando applyTemplate — leitura NUNCA aplica (0169 §1.R).`);
    }
    // /recommended endurecida (achado 0170 §2) — não regredir para só-tenant
    const rAt = rts.indexOf('/templates/recommended');
    const rRest = rts.slice(rAt);
    const rNext = rRest.indexOf('fastify.', 20);
    const rSlice = rNext > 0 ? rRest.slice(0, rNext) : rRest;
    if (!/assertCompanyTemplateAuthority/.test(rSlice)) {
      failures.push(`${RTS}: /templates/recommended voltou a ser só tenant-gated — endurecimento da 0170 §2 removido.`);
    }
  }
  // vocabulário de estados da B-2 permanece SEM o estado da Fase C
  forbid(chk, CHK, /activated_by_accountant/, 'checklist service ganhou activated_by_accountant — estado pertence à Fase C (0169 §9).');
  forbid(chk, CHK, /provision_cents|provisionCents|rate_bps\s*\*|\*\s*rateBps/, 'checklist service calculando/expondo provisão — motor = 4d (0167).');
  // contrato governado registrado
  need(apiDoc, API_DOC, /fiscal-template-checklist/, 'rota do checklist NÃO registrada no API_CONTRACT_GOVERNANCE §5 (cadeia contrato→código, protocolo §2.2.8).');
}

// ── veredito ──
console.log(`[segment-fiscal-template] failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [segment-fiscal-template]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [segment-fiscal-template] — DECISION-0168 travada: faceta fiscal ancorada em business_template_versions (freeze R1 vivo; published imutável; deprecated terminal; itens congelados sob published; território por FK composta; concepts como identidade); template SEM alíquota/FK-a-tax_rules/category/tenant (sugestão, nunca verdade); casa nasce VAZIA (seed = FAIL); sem 4ª noção de segmento; superfícies de template sem escrever no catálogo fiscal; módulo fiscal sem ler template; checklist B-2 = read-model puro (sem rota/coluna/tabela/cálculo, teto ready_for_activation). Ativação = Fase C com contador; motor 4d segue lendo só configuração ativa.');
