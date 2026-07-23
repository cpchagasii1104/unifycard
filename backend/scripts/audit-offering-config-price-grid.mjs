#!/usr/bin/env node
// audit-offering-config-price-grid.mjs — Guard da FATIA PREÇO do arco fundação eventos:
// GRADE DE PREÇO por CONFIG (formação) × dia-da-semana × período, com resolução em CASCATA "a partir de"
// de 3 níveis (célula (config,dow,period) → service_offering_configs.default_price_cents →
// service_offerings.price_cents SELADA). PREÇO = valor DECLARADO de catálogo, NUNCA movimento de dinheiro
// (Δbank=0; porta-01 FORA; BRL implícito, sem coluna de moeda).
// MORDE se:
//  (a) dinheiro nomeado como QUALQUER coisa que não price_cents/priceCents no caminho de preço
//      (fronteira de vocabulário: amount/value_cents/total_cents/split/paid/payout/... proibidos);
//  (b) day_of_week perde o CHECK 1-7 OU period perde o CHECK governado ('manha','tarde','noite');
//  (c) uma config PRECIFICADA pode ser DELETADA fisicamente (FK config_id perde ON DELETE RESTRICT
//      OU deleteConfig deixa de fazer soft-retire/retired_at para config referenciada);
//  (d) a cascata de resolução COLAPSA (resolver perde um dos 3 níveis) OU surge uma 4ª verdade de preço
//      (coluna *_cents fora de {price_cents, default_price_cents} nas tabelas de config);
//  (e) qualquer token porta-01/bank/ledger/currency/invenção-de-moeda no caminho de preço.
// Region-anchored; comment-aware (stripTs no código TS, strip de comentário SQL nas migrations). Fail-closed.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fails = [];
const note = (marker, m) => fails.push(`[${marker}] ${m}`);

const readOrFail = (rel, marker) => {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) { note(marker, `arquivo material ausente: ${rel}`); return ''; }
  return readFileSync(abs, 'utf8');
};

function region(raw, startRe, endRe, label) {
  const s = raw.search(startRe);
  if (s < 0) { note('REGION', `${label}: ancora de inicio nao encontrada (${startRe})`); return null; }
  const rest = raw.slice(s);
  const e = rest.search(endRe);
  const slice = e < 0 ? rest : rest.slice(0, e);
  return { raw: slice, code: stripTs(slice) };
}

// Fronteira de vocabulário Bank-free (dinheiro SÓ como price_cents/priceCents). \b<word>\b, comment-stripped.
const BANNED = /\b(amount|value_cents|total_cents|splits?|paid|payout|payable|receivable|refunds?|refunded|settled|ledger|balance|available|saldo|transactions?)\b/i;
const PORTA_BANK = /\b(porta[-_]?01|bank_ledger|bank_transactions|currency|moeda|fee_bps|fee|tax)\b/i;

function scanBankFree(code, where) {
  const mb = code.match(BANNED);
  if (mb) note('VOCAB', `${where}: token financeiro proibido no caminho de preco: '${mb[1] ?? mb[0]}' (dinheiro SO como price_cents/priceCents).`);
  const mp = code.match(PORTA_BANK);
  if (mp) note('BANK-FRONTIER', `${where}: token porta-01/bank/currency no caminho de preco: '${mp[1] ?? mp[0]}' (preco = catalogo DECLARADO, Δbank=0, porta-01 FORA).`);
}

const SVC_PATH = 'src/modules/services/service-offering-config.service.ts';
const ROUTES_PATH = 'src/modules/services/service-offerings.routes.ts';
const SVC_RAW = readOrFail(SVC_PATH, 'FILE');
const ROUTES_RAW = readOrFail(ROUTES_PATH, 'FILE');

// ══ (a)+(e) fronteira de vocabulário no caminho de preço (service + rotas), comment-stripped ══
if (SVC_RAW) scanBankFree(stripTs(SVC_RAW), SVC_PATH);
if (ROUTES_RAW) scanBankFree(stripTs(ROUTES_RAW), ROUTES_PATH);
// prova POSITIVA: dinheiro É nomeado price_cents/priceCents no service.
if (SVC_RAW && !/price_cents|priceCents/.test(stripTs(SVC_RAW))) {
  note('VOCAB', `${SVC_PATH}: caminho de preco sem price_cents/priceCents (nomenclatura canonica ausente).`);
}

// ══ (d) cascata de 3 níveis no resolver — nenhum nível colapsado ══
if (SVC_RAW) {
  const reg = region(SVC_RAW, /async resolveConfigPrice\(/, /\n};\s*$/, 'resolveConfigPrice');
  if (reg) {
    const { code } = reg;
    if (!/service_offering_config_prices/.test(code)) {
      note('WATERFALL', 'resolveConfigPrice perdeu o NIVEL 1 (celula da grade service_offering_config_prices).');
    }
    if (!/default_price_cents/.test(code)) {
      note('WATERFALL', 'resolveConfigPrice perdeu o NIVEL 2 (base POR CONFIG default_price_cents).');
    }
    if (!/findById/.test(code) || !/priceCents/.test(code)) {
      note('WATERFALL', 'resolveConfigPrice perdeu o NIVEL 3 (base DA OFERTA service_offerings.price_cents via findById).');
    }
  }
  // UPSERT owner-gated na celula (uma verdade por celula — §2).
  const regSet = region(SVC_RAW, /async setConfigPrice\(/, /\n\s*async removeConfigPrice\(/, 'setConfigPrice');
  if (regSet) {
    if (!/canRepresentActor|requireOwnedOffering/.test(regSet.code)) {
      note('AUTH', 'setConfigPrice sem prova de autoridade do provider (canRepresentActor/requireOwnedOffering fail-closed).');
    }
    if (!/ON CONFLICT\s*\(\s*config_id\s*,\s*day_of_week\s*,\s*period\s*\)/i.test(regSet.raw)) {
      note('ONE-TRUTH', 'setConfigPrice sem UPSERT em uq_socp_cell (ON CONFLICT config_id,day_of_week,period) — risco de dois valores para a mesma celula (§2).');
    }
    if (!/assertDayOfWeek/.test(regSet.code) || !/assertPeriod/.test(regSet.code) || !/assertPriceCents/.test(regSet.code)) {
      note('VALIDATE', 'setConfigPrice sem validate-before-mutate (dia 1-7 / periodo governado / price_cents>=0).');
    }
  }
  // (c) deleteConfig = soft-retire para config referenciada (nunca DELETE fisico de config precificada).
  const regDel = region(SVC_RAW, /async deleteConfig\(/, /\n\s*async addConfigMember\(/, 'deleteConfig');
  if (regDel) {
    if (!/retired_at/.test(regDel.code)) {
      note('SOFT-RETIRE', 'deleteConfig perdeu o soft-retire (retired_at) — config PRECIFICADA nao pode ser deletada fisicamente (fecha promessa F3).');
    }
    if (!/service_offering_config_prices/.test(regDel.code)) {
      note('SOFT-RETIRE', 'deleteConfig nao consulta service_offering_config_prices para decidir soft-retire vs delete fisico.');
    }
  }
}

// ══ (b)+(c)+(d) migration da grade: CHECK dia/periodo, FK RESTRICT, sem 4a verdade *_cents, Bank-free ══
{
  const MIG_DIR = join(ROOT, 'migrations');
  if (!existsSync(MIG_DIR)) {
    note('MIGRATIONS', 'diretorio migrations ausente');
  } else {
    let foundGrid = false;
    for (const f of readdirSync(MIG_DIR)) {
      if (!f.endsWith('.sql')) continue;
      const raw = readFileSync(join(MIG_DIR, f), 'utf8');
      if (!/service_offering_config_prices/i.test(raw)) continue;
      const sql = stripSql(raw);
      if (!/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?service_offering_config_prices/i.test(sql)) continue;
      foundGrid = true;

      // (b) CHECK do dia (1-7) e do periodo (vocabulario governado).
      if (!/day_of_week[\s\S]*?CHECK\s*\(\s*day_of_week\s+BETWEEN\s+1\s+AND\s+7\s*\)/i.test(sql)) {
        note('DAY-CHECK', `migration ${f}: day_of_week sem CHECK (day_of_week BETWEEN 1 AND 7).`);
      }
      if (!/period[\s\S]*?CHECK\s*\(\s*period\s+IN\s*\(\s*'manha'\s*,\s*'tarde'\s*,\s*'noite'\s*\)\s*\)/i.test(sql)) {
        note('PERIOD-CHECK', `migration ${f}: period sem CHECK IN ('manha','tarde','noite') (CHECK-not-enum §4.9.7).`);
      }
      // (c) FK config_id com ON DELETE RESTRICT (backstop do soft-retire).
      if (!/config_id[\s\S]*?REFERENCES\s+service_offering_configs\s*\(\s*id\s*\)\s+ON\s+DELETE\s+RESTRICT/i.test(sql)) {
        note('RESTRICT', `migration ${f}: FK config_id sem ON DELETE RESTRICT — config precificada poderia ser deletada fisicamente.`);
      }
      // (d) sem 4a verdade de preco: unica coluna *_cents na grade e price_cents.
      for (const m of sql.matchAll(/\b(\w*_cents)\b/gi)) {
        const col = m[1].toLowerCase();
        if (col !== 'price_cents' && col !== 'default_price_cents') {
          note('4TH-TRUTH', `migration ${f}: coluna de dinheiro '${col}' fora de {price_cents, default_price_cents} — sem 4a verdade de preco (§2).`);
        }
      }
      // (e) sem contaminacao bancaria na DDL da grade.
      const stmts = sql.split(';').filter((s) => /service_offering_config/i.test(s));
      for (const s of stmts) {
        if (/\b(bank_|currency|moeda|fee_bps|\bfee\b|\btax\b|ledger|payout|split)\b/i.test(s)) {
          note('BANK-FRONTIER', `migration ${f}: DDL de service_offering_config* com token bancario/moeda — preco = catalogo DECLARADO (Δbank=0).`);
        }
      }
    }
    if (!foundGrid) note('MIGRATIONS', 'migration de criacao de service_offering_config_prices ausente.');
  }
}

if (fails.length) {
  console.error('❌ audit-offering-config-price-grid FALHOU:');
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('✅ audit-offering-config-price-grid OK — preco = catalogo DECLARADO (price_cents/priceCents, Δbank=0, porta-01 FORA) · cascata "a partir de" de 3 niveis (celula → default_price_cents → offering.price_cents, sem 4a verdade) · dia 1-7 + periodo governados por CHECK · config precificada em soft-retire (FK RESTRICT) · fronteira Bank-free.');
