#!/usr/bin/env node
// Guard vivo — F-CASE-DRIFT-SELF-DETECTION (decisão de Clayton, 2026-08-01):
// "o sistema cria a sua cura" — na metade que É segura: DETECÇÃO automática, conserto humano.
//
// O QUE ELE FAZ: lê o BANCO VIVO como fonte de verdade (pg_enum + CHECK constraints = os
// vocabulários canônicos reais), varre backend/src, e MORDE quando um literal do código bate com
// um valor do vocabulário IGNORANDO case mas difere no case exato. É exatamente a classe de
// defeito que produziu 8+ consertos num único dia (marketplace orders sempre-vazio, caixa do PDV
// fechando em R$0, home-feed cego, SLA morto, todo evento "encerrado"…) — e que CALA: comparação
// de string em JS não é predicado SQL, o ramo só nunca é escolhido.
//
// POR QUE DETECTA E NÃO CONVERTE (a metade proibida do pedido):
//   · o case NÃO é uniforme — status/lifecycle = minúsculo (§4.11), severity/priority/alert_type
//     = MAIÚSCULO (§4.34). Conversor cego "para minúsculo" quebraria o que está certo.
//   · homônimos são legítimos: 'OPEN' de accounts_payable convive no mesmo arquivo com 'open' de
//     pdv_sessions. A regra aqui absolve o literal que bate EXATO com QUALQUER vocabulário das
//     tabelas presentes no arquivo — só acusa o que não bate exato com nenhum.
//   · conjunto DIFERENTE não é case: 'FINISHED'→'ended' e 'BLOCKED'→'critical' são mudança de
//     DESENHO — decisão nomeada, nunca autoconserto. Este guard nem os vê (não batem nem
//     ignorando case), de propósito.
//
// REGRAS DA CASA que ele honra:
//   · banco indisponível = ERRO RUIDOSO, nunca "0 achados" (zero é afirmação; desconhecido é a
//     verdade).
//   · baseline congelada que SÓ DESCE — achado novo = FAIL; achado consertado = o guard manda
//     abaixar a baseline no mesmo commit (ratchet).
//   · lê o vocabulário do BANCO a cada corrida — nunca de snapshot que envelhece.

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

// ── BASELINE (congelada 2026-08-01, pós-campanha de convergência do dia) ─────────────────────
// Formato "arquivo::literal::tabela-cujo-vocabulario-ele-quase-bate". SÓ ENCOLHE.
const BASELINE = new Set([
  "src/core/core.service.ts::COMPLETE::identities",
  "src/core/events/event-taxonomy.service.ts::Online::events",
  "src/core/events/event-taxonomy.service.ts::Gratuito::events",
  "src/core/events/event-taxonomy.service.ts::Pago::events",
  "src/core/reconciliation/reconciliation.service.ts::ACTIVE::bank_accounts",
  "src/core/reputation/trust.service.ts::NO_SHOW::event_attendees",
  "src/core/reputation/trust.service.ts::ACTIVE::events",
  "src/core/unifybank/donation.service.ts::DONATION::bank_transactions",
  "src/modules/actor-page/actor-page.repository.ts::CANCELLED::events",
  "src/modules/escrow/escrow.repository.ts::PENDING::payment_milestones",
  "src/modules/events/checkout-consumption.service.ts::ACTIVE::events",
  "src/modules/events/checkout-ticket.service.ts::ACTIVE::events",
  "src/modules/events/event.repository.ts::DRAFT::events",
  "src/modules/events/event.repository.ts::PUBLISHED::events",
  "src/modules/events/event.repository.ts::CANCELLED::events",
  "src/modules/events/events.service.ts::PUBLIC::events",
  "src/modules/live-chat/chat-room.repository.ts::ACTIVE::chat_rooms",
  "src/modules/live-chat/chat-room.repository.ts::ARCHIVED::chat_rooms",
  "src/modules/marketplace/promotion.repository.ts::VARIANT::promotions",
  "src/modules/marketplace/promotion.repository.ts::CATEGORY::promotions",
  "src/modules/marketplace/promotion.repository.ts::PRODUCT::promotions",
  "src/modules/reports/financial-report.service.ts::SUCCESS::payment_transactions",
  "src/modules/reports/financial-report.service.ts::FAILED::orders",
  "src/modules/reports/financial-report.service.ts::PENDING::orders",
  "src/modules/reports/inventory-report.service.ts::ACTIVE::inventory_reservations",
  "src/modules/reports/inventory-report.service.ts::UN::product_variants",
  "src/modules/services/service-order.service.ts::AUTHORIZED::payment_intents",
  "src/modules/social/actor.repository.ts::APPROVED::identities",
  "src/modules/social/event-feed.handlers.ts::PUBLIC::events",
  "src/modules/social/social.repository.ts::PUBLIC::posts",
  "src/modules/trust/trust.repository.ts::MEDIUM::trust_profiles",
  "src/scripts/validate-pipeline-e2e-company-users-fine-grants.ts::None::identities",
  "src/scripts/validate-pipeline-e2e-event-audience-0161.ts::Amigo::events",
  "src/scripts/validate-pipeline-e2e-event-sectors.ts::REJECTED::identities",
  "src/scripts/validate-pipeline-e2e-events-followers-scoped-f6-5-6b-4.ts::DRAFT::events",
  "src/scripts/validate-pipeline-e2e-events-group-scoped-f6-5-6b-3.ts::DRAFT::events",
  "src/scripts/validate-pipeline-e2e-events-organizer-dashboard-f6-5-6b-2.ts::DRAFT::events",
  "src/scripts/validate-pipeline-e2e-events-visibility-floor-f6-5-6b-1.ts::DRAFT::events",
  "src/scripts/validate-pipeline-e2e-pdv-payment-authority.ts::OPEN::pdv_sessions",
  "src/scripts/validate-pipeline-e2e-pj-capability-kyb.ts::APPROVED::fiscal_identities",
  "src/scripts/validate-pipeline-e2e-pj-economic-activity-suggestion.ts::Owner::company_users",
  "src/scripts/validate-pipeline-e2e-pj-kyb-writer.ts::NONE::identities",
  "src/scripts/validate-pipeline-e2e-pj-publication-schema.ts::NONE::identities",
  "src/scripts/validate-pipeline-e2e-reports-transfers-sla-representation.ts::SHIPPED::stock_transfers",
  "src/scripts/validate-pipeline-e2e-severity-priority-convergence.ts::critical::alerts",
  "src/scripts/validate-pipeline-e2e-severity-priority-convergence.ts::warning::alerts",
  "src/services/events/tests/event-checkout-hardening.test.ts::PUBLISHED::events",
  "src/services/feed/FeedService.ts::PUBLISHED::events",
  "src/services/feed/FeedService.ts::PUBLIC::events",
]);
const BASELINE_COUNT = 49; // 51→49 em 2026-08-02: countOpenAlerts consertado — filtrava status IN ('OPEN','ACK') contra alert_status minúsculo e contava ZERO para sempre (fatia F-ALERT-TYPE-LOWERCASE).

// ── conexão: mesma fonte dos demais guards que leem o banco ──────────────────────────────────
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
    console.error('GATE FAIL [case-drift-ratchet]: DATABASE_URL indisponível — o vocabulário canônico vem do BANCO, e sem ele este guard NÃO PODE afirmar "zero drift". Falha ruidosa > zero mentiroso.');
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

  // 1) Vocabulários canônicos: enums nativos, mapeados a (tabela, coluna)…
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
  // 2) …e CHECKs de coluna única com ARRAY de literais (a população TEXT+CHECK que pg_enum não vê).
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

  // 3) Varre backend/src: para cada arquivo, as tabelas que ele toca em contexto SQL, e os
  //    literais que quase-batem num vocabulário dessas tabelas.
  const files = walk(join(ROOT, 'src'), []);
  const findings = [];
  for (const f of files) {
    const src = stripTs(readFileSync(f, 'utf8'));
    const tablesInFile = [];
    for (const t of vocab.keys()) {
      if (new RegExp(`\\b(FROM|INTO|UPDATE|JOIN)\\s+${t}\\b`).test(src)) tablesInFile.push(t);
    }
    if (!tablesInFile.length) continue;

    const exact = new Set();
    const lowerToTable = new Map();
    for (const t of tablesInFile) {
      for (const v of vocab.get(t)) {
        exact.add(v);
        if (!lowerToTable.has(v.toLowerCase())) lowerToTable.set(v.toLowerCase(), t);
      }
    }
    const rel = f.slice(ROOT.length + 1).replace(/\\/g, '/');
    const seen = new Set();
    for (const m of src.matchAll(/'([A-Za-z][A-Za-z_]{1,40})'/g)) {
      const lit = m[1];
      if (seen.has(lit)) continue;
      seen.add(lit);
      const low = lit.toLowerCase();
      if (!lowerToTable.has(low)) continue;   // não pertence a vocabulário nenhum daqui
      if (exact.has(lit)) continue;           // bate exato em ALGUM vocabulário do arquivo — absolvido
      findings.push(`${rel}::${lit}::${lowerToTable.get(low)}`);
    }
  }

  // 4) Ratchet.
  const news = findings.filter((k) => !BASELINE.has(k));
  const fixed = [...BASELINE].filter((k) => !findings.includes(k));
  if (news.length > 0) {
    console.error('GATE FAIL [case-drift-ratchet] — literal do código diverge do vocabulário do BANCO só no case (a classe que CALA):');
    for (const k of news) {
      const [file, lit, table] = k.split('::');
      console.error(`   - ${file}: '${lit}' quase-bate no vocabulário de ${table} (${[...vocab.get(table)].join(', ')}) mas o case difere. Comparação nunca casa; nenhum erro aparece.`);
    }
    console.error('   Conserte o CÓDIGO (ou, se o conjunto difere de verdade, é decisão nomeada — não entra aqui). NÃO adicione à baseline para calar.');
    process.exit(1);
  }
  if (findings.length < BASELINE_COUNT) {
    console.error(`GATE FAIL [case-drift-ratchet]: contagem caiu (${findings.length} < baseline ${BASELINE_COUNT}) — ABAIXE a baseline no mesmo commit (ratchet só desce, mas desce REGISTRANDO). Consertados: ${fixed.join(' · ') || '(ver diff)'}`);
    process.exit(1);
  }
  console.log(`GATE OK [case-drift-ratchet] — ${vocab.size} vocabulários lidos do banco vivo; ${files.length} arquivos varridos; ${findings.length}/${BASELINE_COUNT} drifts conhecidos (baseline só desce). Literal novo divergindo só no case = FAIL na hora.`);
}

main().catch((e) => {
  console.error(`GATE FAIL [case-drift-ratchet]: erro inesperado (${e.message}) — falha ruidosa, nunca zero mentiroso.`);
  process.exit(1);
});
