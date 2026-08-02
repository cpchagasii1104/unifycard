#!/usr/bin/env node
// Guard vivo — F-CASE-DRIFT-SELF-DETECTION (decisão de Clayton, 2026-08-01):
// "o sistema cria a sua cura" — na metade que É segura: DETECÇÃO automática, conserto humano.
//
// O QUE ELE FAZ: lê o BANCO VIVO como fonte de verdade (pg_enum + CHECK constraints = os
// vocabulários canônicos reais), varre backend/src, e MORDE quando um literal do código bate com
// um valor do vocabulário IGNORANDO case mas difere no case exato. É a classe de defeito que
// produziu 15+ consertos no arco (marketplace sempre-vazio, caixa do PDV em R$0, home-feed cego,
// alertas que nunca renderizavam…) — e que CALA: comparação de string em JS não é predicado SQL.
//
// 🔴 ABSOLVIÇÃO POR TABELA (v2, 2026-08-02 — correção exigida pelo PARECER YALA MANDATO F):
//   a v1 absolvia por UNIÃO dos vocabulários das tabelas do arquivo — drift real seria absolvido
//   quando OUTRA tabela tivesse o valor por coincidência (16 valores em colisão no banco;
//   exposição medida em 0, mas "bomba de gatilho futuro"). Agora: para CADA tabela cujo
//   vocabulário contém o lower do literal, só o match EXATO naquela MESMA tabela absolve.
//   Custo assumido: homônimo legítimo entre tabelas colididas vira entrada CLASSIFIED.
//
// REGRAS DA CASA:
//   · banco indisponível = ERRO RUIDOSO, nunca "0 achados" (zero é afirmação).
//   · PENDING só encolhe (ratchet); CLASSIFIED é registro com RAZÃO — mudar exige justificar.
//   · vocabulário lido do BANCO a cada corrida — nunca snapshot que envelhece.

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

// ── BASELINE ROTULADA (v2, 2026-08-02) ───────────────────────────────────────────────────────
// PENDING: rastreio DEVIDO — cada saída exige conserto provado + descida registrada.
const BASELINE_PENDING = new Set([]);
const PENDING_COUNT = 0; // 37→0 em 2026-08-02: os 9 nunca-rastreados foram traçados (3 bugs vivos
// consertados: service-order 'AUTHORIZED' em milestone · chat-room ACTIVE/ARCHIVED · seeds de
// teste); os demais 28 + 6 reclassificados abaixo, TODOS com razão escrita.

// CLASSIFIED: verificados como LEGÍTIMOS, com a razão. NÃO são dívida — são a memória que impede
// o próximo leitor de re-rastrear. Remover entrada daqui exige dizer por que a razão caiu.
const BASELINE_CLASSIFIED = new Set([
  // ── colisões desenterradas pela v2 (a união escondia; todas rastreadas ao contexto) ──
  "src/modules/social/actor.repository.ts::ACTIVE::groups",        // é companies.company_status (0097, MAIÚSCULO governado); groups acusa por colisão
  "src/modules/social/actor.repository.ts::SUSPENDED::company_users", // idem — cast do conjunto real de companies
  "src/scripts/seed-dev-companies-services.ts::ACTIVE::services",  // INSERT dual 'active','ACTIVE' = status+company_status (0093), ambos corretos
  "src/scripts/seed-minimal-social.ts::ACTIVE::company_users",     // idem
  "src/scripts/validate-pipeline-e2e-company-users-fine-grants.ts::ACTIVE::company_users", // idem
  "src/scripts/validate-pipeline-e2e-event-organizer-continuity-authority.ts::draft::companies", // é events.status (exato lá); companies acusa por colisão com DRAFT
  "src/scripts/validate-pipeline-e2e-mvp-service-journey-pj-provider.ts::draft::companies",   // 'draft' é de services/policies (exato lá); companies acusa por colisão DRAFT
  "src/scripts/validate-pipeline-e2e-operator-service-order-view-grant.ts::draft::companies", // idem
  "src/scripts/validate-pipeline-e2e-pe5-resolver.ts::draft::companies",                      // idem (economic_policies status='draft')
  "src/scripts/validate-pipeline-e2e-pe5-resolver.ts::ACTIVE::bank_accounts",                 // INSERT dual de companies ('active','ACTIVE'), 0093/0097
  "src/scripts/validate-pipeline-e2e-pj-capability-kyb.ts::ACTIVE::company_users",            // company_status deliberado no cenário ('mentira' testada)
  "src/scripts/validate-pipeline-e2e-pj-verification-display.ts::ACTIVE::company_users",      // company_status lifecycle deliberado
  "src/scripts/validate-pipeline-e2e-r2-authorship-and-isolation.ts::ACTIVE::actor_delegations", // INSERT dual de companies
  "src/scripts/validate-pipeline-e2e-service-category-ramo-guard.ts::draft::companies",       // colisão DRAFT de companies
  "src/scripts/validate-pipeline-e2e-supplier-owner-authority.ts::ACTIVE::suppliers",         // T13: sonda DELIBERADA de normalização uppercase→lower
  // ── mapeadores/normalizadores deliberados (comparam certo, traduzem contrato) ──
  "src/modules/events/event.repository.ts::DRAFT::events",        // mapper sprint76 DB→API
  "src/modules/events/event.repository.ts::PUBLISHED::events",    // idem
  "src/modules/events/event.repository.ts::CANCELLED::events",    // idem
  "src/modules/marketplace/promotion.repository.ts::VARIANT::promotions",  // normalizador upper→lower
  "src/modules/marketplace/promotion.repository.ts::CATEGORY::promotions", // idem
  "src/modules/marketplace/promotion.repository.ts::PRODUCT::promotions",  // idem
  // ── rótulos de UI / metadata / sentinelas (não são a coluna) ──
  "src/core/events/event-taxonomy.service.ts::Online::events",    // label pt-BR; chave lowercase correta
  "src/core/events/event-taxonomy.service.ts::Gratuito::events",  // idem
  "src/core/events/event-taxonomy.service.ts::Pago::events",      // idem
  "src/core/unifybank/donation.service.ts::DONATION::bank_transactions", // label em metadata de insight
  "src/modules/reports/inventory-report.service.ts::UN::product_variants", // fallback unidade de medida
  "src/core/core.service.ts::COMPLETE::identities",               // identity_status DERIVADO (API), ≠ kyc 'complete'
  // ── defensivo/contido/órfão ──
  "src/modules/actor-page/actor-page.repository.ts::CANCELLED::events", // NOT IN dos dois cases — inócuo
  "src/modules/events/checkout-consumption.service.ts::ACTIVE::events", // paradigma legado event_tickets, CONTIDO
  "src/modules/events/checkout-ticket.service.ts::ACTIVE::events",      // idem
  "src/modules/reports/financial-report.service.ts::SUCCESS::payment_transactions", // service atrás de rota 501
  "src/modules/reports/financial-report.service.ts::FAILED::orders",    // idem
  "src/modules/reports/financial-report.service.ts::PENDING::orders",   // idem
  "src/services/feed/FeedService.ts::PUBLISHED::events",  // árvore src/services ÓRFÃ (o vivo é core/feed)
  "src/services/feed/FeedService.ts::PUBLIC::events",     // idem
  // ── harness/e2e legítimos ──
  "src/scripts/validate-pipeline-e2e-company-users-fine-grants.ts::None::identities",   // nome de usuário de teste
  "src/scripts/validate-pipeline-e2e-event-audience-0161.ts::Amigo::events",            // idem
  "src/scripts/validate-pipeline-e2e-pj-economic-activity-suggestion.ts::Owner::company_users", // idem
  "src/scripts/validate-pipeline-e2e-event-sectors.ts::REJECTED::identities",           // estado de Promise.allSettled
  "src/scripts/validate-pipeline-e2e-pj-kyb-writer.ts::NONE::identities",               // sentinela de fallback
  "src/scripts/validate-pipeline-e2e-pj-publication-schema.ts::NONE::identities",       // sentinela
  "src/scripts/validate-pipeline-e2e-pj-capability-kyb.ts::APPROVED::fiscal_identities", // param IGNORADO (DECISION-0092)
  "src/scripts/validate-pipeline-e2e-severity-priority-convergence.ts::critical::alerts", // prova-vermelha DELIBERADA
  "src/scripts/validate-pipeline-e2e-severity-priority-convergence.ts::warning::alerts",  // idem
  "src/scripts/validate-pipeline-e2e-events-followers-scoped-f6-5-6b-4.ts::DRAFT::events", // input do mapper sprint76
  "src/scripts/validate-pipeline-e2e-events-group-scoped-f6-5-6b-3.ts::DRAFT::events",     // idem
  "src/scripts/validate-pipeline-e2e-events-organizer-dashboard-f6-5-6b-2.ts::DRAFT::events", // idem
  "src/scripts/validate-pipeline-e2e-events-visibility-floor-f6-5-6b-1.ts::DRAFT::events",    // idem
]);

// ── conexão ──────────────────────────────────────────────────────────────────────────────────
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = join(ROOT, '.env');
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.+)$/m);
    if (m) return m[1].trim();
  }
  return null;
}

const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function walk(dir, out) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.ts$/.test(e)) out.push(p);
  }
  return out;
}

async function main() {
  const url = databaseUrl();
  if (!url) {
    console.error('GATE FAIL [case-drift-ratchet]: DATABASE_URL indisponível — sem o banco este guard NÃO PODE afirmar "zero drift". Falha ruidosa > zero mentiroso.');
    process.exit(1);
  }
  const { Client } = require('pg');
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
  } catch (e) {
    console.error(`GATE FAIL [case-drift-ratchet]: conexão ao banco falhou (${e.message}) — não reporto 0 sem ler a fonte.`);
    process.exit(1);
  }

  const vocab = new Map(); // table -> Set(values exatos)
  const enumRows = (await client.query(`
    SELECT c.relname AS table, e.enumlabel AS value
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid AND c.relkind = 'r'
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_type t ON t.oid = a.atttypid AND t.typtype = 'e'
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE a.attnum > 0
  `)).rows;
  const checkRows = (await client.query(`
    SELECT c.relname AS table, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid AND c.relkind = 'r'
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%ARRAY[%'
  `)).rows;
  await client.end();

  for (const r of enumRows) {
    if (!vocab.has(r.table)) vocab.set(r.table, new Set());
    vocab.get(r.table).add(r.value);
  }
  for (const r of checkRows) {
    const vals = [...r.def.matchAll(/'([^']+)'::(?:text|character varying)/g)].map((m) => m[1]);
    if (!vals.length) continue;
    if (!vocab.has(r.table)) vocab.set(r.table, new Set());
    for (const v of vals) vocab.get(r.table).add(v);
  }
  if (vocab.size === 0) {
    console.error('GATE FAIL [case-drift-ratchet]: zero vocabulários lidos do banco — leitura falhou, não reporto "sem drift".');
    process.exit(1);
  }

  const files = walk(join(ROOT, 'src'), []);
  const findings = [];
  for (const f of files) {
    const src = stripTs(readFileSync(f, 'utf8'));
    const tablesInFile = [];
    for (const t of vocab.keys()) {
      if (new RegExp(`\\b(FROM|INTO|UPDATE|JOIN)\\s+${t}\\b`).test(src)) tablesInFile.push(t);
    }
    if (!tablesInFile.length) continue;

    const rel = f.slice(ROOT.length + 1).replace(/\\/g, '/');
    const seen = new Set();
    for (const m of src.matchAll(/'([A-Za-z][A-Za-z_]{1,40})'/g)) {
      const lit = m[1];
      if (seen.has(lit)) continue;
      seen.add(lit);
      const low = lit.toLowerCase();
      // Tabela que ACUSA, acusa — exato em OUTRA tabela NÃO absolve (era esse o buraco da v1,
      // e a 1ª tentativa da v2 o reimplementou: o break-no-exato reconstruía a união. Provado
      // vermelho antes de confiar). Homônimo legítimo entre tabelas colididas = CLASSIFIED.
      let accusedBy = null;
      for (const t of tablesInFile) {
        const vocabT = vocab.get(t);
        if (vocabT.has(lit)) continue; // exato NESTA tabela: ela não acusa
        let hasLower = false;
        for (const v of vocabT) { if (v.toLowerCase() === low) { hasLower = true; break; } }
        if (hasLower) { accusedBy = t; break; }
      }
      if (!accusedBy) continue;
      findings.push(`${rel}::${lit}::${accusedBy}`);
    }
  }

  const news = findings.filter((k) => !BASELINE_PENDING.has(k) && !BASELINE_CLASSIFIED.has(k));
  const pendingNow = findings.filter((k) => BASELINE_PENDING.has(k));
  if (news.length > 0) {
    console.error('GATE FAIL [case-drift-ratchet] — literal do código diverge do vocabulário do BANCO só no case (a classe que CALA):');
    for (const k of news) {
      const [file, lit, table] = k.split('::');
      console.error(`   - ${file}: '${lit}' quase-bate no vocabulário de ${table} (${[...vocab.get(table)].join(', ')}) mas o case difere.`);
    }
    console.error('   Conserte o CÓDIGO ou, se for legítimo PROVADO, entre em BASELINE_CLASSIFIED com a RAZÃO. NÃO use PENDING para calar.');
    process.exit(1);
  }
  if (pendingNow.length < PENDING_COUNT) {
    console.error(`GATE FAIL [case-drift-ratchet]: PENDING caiu (${pendingNow.length} < ${PENDING_COUNT}) — ABAIXE PENDING_COUNT e remova as entradas consertadas no MESMO commit.`);
    process.exit(1);
  }
  // CLASSIFIED que sumiu do código não falha — arquivo apagado/refatorado leva a razão junto.
  console.log(`GATE OK [case-drift-ratchet] — ${vocab.size} vocabulários do banco vivo; ${files.length} arquivos; absolvição POR TABELA (v2, parecer F); PENDING ${pendingNow.length}/${PENDING_COUNT} (só desce) · CLASSIFIED ${BASELINE_CLASSIFIED.size} com razão escrita. Drift novo = FAIL na hora.`);
}

main().catch((e) => {
  console.error(`GATE FAIL [case-drift-ratchet]: erro inesperado (${e.message}) — falha ruidosa, nunca zero mentiroso.`);
  process.exit(1);
});
