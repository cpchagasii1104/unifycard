#!/usr/bin/env node
// audit-offering-config-price-grid.mjs — Guard da FATIA PREÇO do arco fundação eventos:
// GRADE DE PREÇO por CONFIG (formação) × dia-da-semana × período, com resolução em CASCATA "a partir de"
// de 3 níveis (célula (config,dow,period) → service_offering_configs.default_price_cents →
// service_offerings.price_cents SELADA). PREÇO = valor DECLARADO de catálogo, NUNCA movimento de dinheiro
// (Δbank=0; porta-01 FORA; BRL implícito, sem coluna de moeda).
// MORDE se:
//  (a) dinheiro nomeado como QUALQUER coisa que não price_cents/priceCents no caminho de preço
//      (fronteira de vocabulário: amount/value_cents/total_cents/split/paid/payout/... proibidos). Cobertura
//      UNIVERSAL na migration: nome com-cara-de-dinheiro (price-float/amount/valor_/preco) NÃO-canônico é
//      mordido em QUALQUER DDL de service_offering_config* — CREATE da grade OU ALTER de configs/prices,
//      inclusive migration futura standalone que só faça ADD COLUMN (o validate-financial-vocabulary.js
//      ignora migrations, logo esta é a única vigilância desse nome em DDL);
//  (b) day_of_week perde o CHECK 0-6 (canonico §4.25) OU period_of_day perde o CHECK governado ('manha','tarde','noite');
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
// anti-falso-positivo: neutraliza LITERAIS DE STRING SQL ('...', com '' escapado) — para o scan de NOMES de
// coluna nunca morder prosa/COMMENT ON ... IS 'preço...' nem CHECK IN ('manha',...). Preserva as aspas vazias.
const stripSqlLiterals = (s) => s.replace(/'(?:''|[^'])*'/g, "''");
const fails = [];
const note = (marker, m) => fails.push(`[${marker}] ${m}`);

// Nome com-cara-de-dinheiro NÃO-canônico (canônicos price_cents/default_price_cents são PERMITIDOS). \bprice\b
// não casa dentro de price_cents (o '_' é word-char, sem boundary) — por isso testamos o NOME inteiro da coluna.
const MONEY_LOOKING = /amount|valor|preco|price/i;
const CANON_MONEY = new Set(['price_cents', 'default_price_cents']);
const SQL_TYPE = /^(uuid|bigint|bigserial|smallint|smallserial|serial|integer|int|int2|int4|int8|text|varchar|char|character|numeric|decimal|float|float4|float8|real|double|money|boolean|bool|timestamptz|timestamp|date|time|interval|jsonb|json|bytea|inet|cidr|uuid)\b/i;
const NON_COLUMN_KW = /^(constraint|primary|unique|foreign|check|references|on|add|drop|alter|create|table|column|comment|begin|commit|if|not|exists|index)$/i;

// Escaneia SÓ linhas de DEFINIÇÃO DE COLUMNA (CREATE TABLE) e ADD COLUMN de UM statement DDL já
// comment-stripped E literal-stripped; morde nome com-cara-de-dinheiro fora do par canônico _cents.
function scanMoneyLookingColumns(ddlStmt, fileLabel) {
  for (const line of ddlStmt.split('\n')) {
    let col = null;
    const addm = line.match(/\bADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z_][a-z0-9_]*)"?\s+[a-z]/i);
    if (addm) {
      col = addm[1];
    } else {
      const dm = line.match(/^\s*"?([a-z_][a-z0-9_]*)"?\s+([a-z][a-z0-9_]*)/i);
      if (dm && SQL_TYPE.test(dm[2]) && !NON_COLUMN_KW.test(dm[1])) col = dm[1];
    }
    if (!col) continue;
    const lc = col.toLowerCase();
    if (CANON_MONEY.has(lc)) continue;
    if (MONEY_LOOKING.test(lc)) {
      note('MONEY-NAME', `migration ${fileLabel}: coluna com-cara-de-dinheiro NAO-canonica '${col}' em DDL de service_offering_config* — dinheiro SO como price_cents/default_price_cents (nomenclatura canonica _cents; sem float/valor_/preco/amount).`);
    }
  }
}

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
    if (!/ON CONFLICT\s*\(\s*config_id\s*,\s*day_of_week\s*,\s*period_of_day\s*\)/i.test(regSet.raw)) {
      note('ONE-TRUTH', 'setConfigPrice sem UPSERT em uq_socp_cell (ON CONFLICT config_id,day_of_week,period_of_day) — risco de dois valores para a mesma celula (§2).');
    }
    if (!/assertDayOfWeek/.test(regSet.code) || !/assertPeriodOfDay/.test(regSet.code) || !/assertPriceCents/.test(regSet.code)) {
      note('VALIDATE', 'setConfigPrice sem validate-before-mutate (dia 0-6 §4.25 / periodo governado / price_cents>=0).');
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

// ══ migration: cobertura UNIVERSAL de nome-com-cara-de-dinheiro + bank-frontier em QUALQUER DDL de
//    service_offering_config* (CREATE da grade OU ALTER de configs/prices, mesmo arquivo standalone);
//    (b) DAY/PERIOD-CHECK + (c) RESTRICT + (d) 4a-verdade + foundGrid ficam GATEADOS no arquivo que CRIA a grade ══
{
  const MIG_DIR = join(ROOT, 'migrations');
  if (!existsSync(MIG_DIR)) {
    note('MIGRATIONS', 'diretorio migrations ausente');
  } else {
    let foundGrid = false;
    for (const f of readdirSync(MIG_DIR)) {
      if (!f.endsWith('.sql')) continue;
      const raw = readFileSync(join(MIG_DIR, f), 'utf8');
      const sql = stripSql(raw);
      const sqlNoLit = stripSqlLiterals(sql);
      // Statements de DDL (CREATE TABLE / ALTER TABLE) que tocam service_offering_config* — configs OU prices.
      const ddlStmts = sqlNoLit.split(';').filter((s) =>
        /service_offering_config/i.test(s) && /\b(CREATE\s+TABLE|ALTER\s+TABLE)\b/i.test(s));
      if (ddlStmts.length === 0) continue; // arquivo sem DDL de config: nada a vigiar aqui.

      // (a-migration) NOME com-cara-de-dinheiro NAO-canonico em QUALQUER DDL de config — CREATE ou ALTER, ainda
      // que em arquivo STANDALONE que NAO cria a grade (herda a vigilancia que saiu do guard F3: valor_/preco/
      // price-float/amount que o validate-financial-vocabulary.js NAO ve em migrations). Escopo: SO linhas de
      // definicao de coluna / ADD COLUMN, sobre SQL comment-stripped E literal-stripped (sem morder prosa).
      for (const st of ddlStmts) scanMoneyLookingColumns(st, f);
      // (e) sem contaminacao bancaria na DDL de config (statement literal-stripped, sem morder prosa/COMMENT).
      for (const s of ddlStmts) {
        if (/\b(bank_|currency|moeda|fee_bps|\bfee\b|\btax\b|ledger|payout|split)\b/i.test(s)) {
          note('BANK-FRONTIER', `migration ${f}: DDL de service_offering_config* com token bancario/moeda — preco = catalogo DECLARADO (Δbank=0).`);
        }
      }

      // ── daqui pra baixo: SO no arquivo que CRIA a grade (nao dispara em ALTER-only). ──
      if (!/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?service_offering_config_prices/i.test(sql)) continue;
      foundGrid = true;

      // (b) CHECK do dia (canonico §4.25: 0=Dom..6=Sab) e do periodo (vocabulario governado).
      if (!/day_of_week[\s\S]*?CHECK\s*\(\s*day_of_week\s+BETWEEN\s+0\s+AND\s+6\s*\)/i.test(sql)) {
        note('DAY-CHECK', `migration ${f}: day_of_week sem CHECK (day_of_week BETWEEN 0 AND 6) — canonico §4.25 (0=Dom..6=Sab, alinha PG EXTRACT(DOW)).`);
      }
      if (!/period_of_day[\s\S]*?CHECK\s*\(\s*period_of_day\s+IN\s*\(\s*'manha'\s*,\s*'tarde'\s*,\s*'noite'\s*\)\s*\)/i.test(sql)) {
        note('PERIOD-CHECK', `migration ${f}: period_of_day sem CHECK IN ('manha','tarde','noite') (CHECK-not-enum §4.9.7).`);
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
    }
    if (!foundGrid) note('MIGRATIONS', 'migration de criacao de service_offering_config_prices ausente.');
  }
}

if (fails.length) {
  console.error('❌ audit-offering-config-price-grid FALHOU:');
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('✅ audit-offering-config-price-grid OK — preco = catalogo DECLARADO (price_cents/priceCents, Δbank=0, porta-01 FORA) · cascata "a partir de" de 3 niveis (celula → default_price_cents → offering.price_cents, sem 4a verdade) · dia 0-6 (canonico §4.25) + period_of_day governados por CHECK · config precificada em soft-retire (FK RESTRICT) · fronteira Bank-free.');
