#!/usr/bin/env node
// audit-event-sector-meia-floor.mjs — Guard da SLICE S3 (SETORES) do arco "evento em si".
// O SETOR é SELF-CONTAINED (tabela event_sectors própria) com pool COMPARTILHADO (capacity), preço INTEIRA
// e preço MEIA legalmente pisado. O piso legal da MEIA — meia_quota_bps BETWEEN 4000 AND 10000 (40%–100%) —
// é HARD-LOCKED por lei (Lei 12.933/2013 + Decreto 8.537/2015) e NUNCA pode descer abaixo de 40%.
// Bank-free: inteira_price_cents/meia_price_cents são valores DECLARADOS de catálogo (Δbank=0); a VENDA, o
// check de elegibilidade da meia e o decremento do pool = PORTA-01 (Fatia 2), FORA.
//
// MORDE se:
//  (a) a CHECK do piso legal (meia_quota_bps BETWEEN 4000 AND 10000) for perdida OU ENFRAQUECIDA (piso
//      inferior a 4000) na DDL de event_sectors;
//  (b) nascer uma COLUNA SINÔNIMO (setor / sector_capacity / meia_capacity / quota_pct) — os nomes canônicos
//      são sector_number/capacity/meia_quota_bps — OU o eixo econômico do setor (inteira/meia) reaparecer
//      como WRITE-PATH na JSONB não-tipada event_occupancy_models.config.sectors (placeholder write-orphan);
//  (c) um token bank/porta-01/ledger/sale aparecer no CAMINHO do setor (fronteira Bank-free) — _cents é
//      PERMITIDO (preço DECLARADO), bank/ledger/venda/pedido/pagamento NÃO;
//  (d) o writer (service) perder a RECONCILIAÇÃO com max_attendees (SECTOR_CAPACITY_EXCEEDS_EVENT +
//      leitura de max_attendees) OU o ESPELHO do piso legal (SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR + 4000).
// Region-anchored; comment-aware (strip TS + strip SQL + strip de literais). Fail-closed.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const stripJsLiterals = (s) => s.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, "''");
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripSqlLiterals = (s) => s.replace(/'(?:''|[^'])*'/g, "''");
const fails = [];
const note = (marker, m) => fails.push(`[${marker}] ${m}`);

const readOrFail = (rel, marker) => {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) { note(marker, `arquivo material ausente: ${rel}`); return ''; }
  return readFileSync(abs, 'utf8');
};

// Colunas econômicas canônicas do setor (o eixo inteira/meia).
const SECTOR_ECON_COLS = /meia_quota_bps|inteira_price_cents|meia_price_cents/i;
// Colunas SINÔNIMO proibidas — os nomes canônicos são sector_number/capacity/meia_quota_bps.
const SYNONYM_COL = /\b(sector_capacity|meia_capacity|quota_pct|setor)\b/i;
// Token bank/venda proibido no caminho do setor. _cents NÃO entra aqui (preço = DECLARADO, Δbank=0).
const BANK_TOKEN = /\b(bank_ledger|bank_transactions|bank|ledger|payout|payable|receivable|refund\w*|settle\w*|ticket_sales|sale|order|payment_intent|porta[-_]?01)\b/i;

// ══════════════════════ MIGRATION: DDL de event_sectors (piso legal + sinônimos + Bank-free) ═══════════
{
  const MIG_DIR = join(ROOT, 'migrations');
  if (!existsSync(MIG_DIR)) {
    note('MIGRATIONS', 'diretorio migrations ausente');
  } else {
    let foundTable = false;
    for (const f of readdirSync(MIG_DIR)) {
      if (!f.endsWith('.sql')) continue;
      const raw = readFileSync(join(MIG_DIR, f), 'utf8');
      const sql = stripSql(raw);
      const sqlNoLit = stripSqlLiterals(sql);
      // Statements DDL que criam/alteram event_sectors.
      const ddlStmts = sqlNoLit.split(';').filter((s) =>
        /\bevent_sectors\b/i.test(s) && /\b(CREATE\s+TABLE|ALTER\s+TABLE)\b/i.test(s));
      if (ddlStmts.length === 0) continue;
      foundTable = true;

      for (const st of ddlStmts) {
        // (a) piso legal: meia_quota_bps deve carregar a CHECK BETWEEN 4000 AND 10000 (40%–100%).
        if (/meia_quota_bps/i.test(st)) {
          if (!/meia_quota_bps\s+INTEGER[\s\S]*?BETWEEN\s+4000\s+AND\s+10000/i.test(st)) {
            note('LEGAL-FLOOR', `migration ${f}: CHECK do piso legal da meia ausente/alterada — meia_quota_bps deve ser CHECK (meia_quota_bps BETWEEN 4000 AND 10000) = 40%–100% (Lei 12.933/2013 + Decreto 8.537/2015).`);
          }
          // (a) anti-enfraquecimento: qualquer piso inferior a 4000 num BETWEEN de meia_quota_bps.
          const weak = st.match(/meia_quota_bps[\s\S]*?BETWEEN\s+(\d+)\s+AND/i);
          if (weak && Number(weak[1]) < 4000) {
            note('LEGAL-FLOOR', `migration ${f}: piso legal ENFRAQUECIDO — BETWEEN ${weak[1]} (< 4000). A meia cobre NO MÍNIMO 40% da capacidade; o floor NUNCA desce abaixo de 4000 bps.`);
          }
        }
        // (b) colunas sinônimo na DDL do setor.
        const syn = st.match(SYNONYM_COL);
        if (syn) {
          note('SYNONYM', `migration ${f}: coluna sinônimo '${syn[1] ?? syn[0]}' na DDL de event_sectors — os nomes canônicos são sector_number/capacity/meia_quota_bps (§2 NAMING).`);
        }
        // (c) fronteira Bank-free: nenhum token bank/venda na DDL do setor (_cents é permitido).
        const bk = st.match(BANK_TOKEN);
        if (bk) {
          note('BANK-FRONTIER', `migration ${f}: token '${bk[1] ?? bk[0]}' na DDL de event_sectors — preço = catálogo DECLARADO (_cents, Δbank=0); venda/bank/ledger/porta-01 = PORTA-01, FORA.`);
        }
      }

      // Presença física da CHECK meia<=inteira (a meia nunca custa mais que a inteira).
      if (!/chk_event_sectors_meia_le_inteira/i.test(sqlNoLit) ||
          !/meia_price_cents\s*<=\s*inteira_price_cents/i.test(sqlNoLit)) {
        note('CHECK-MEIA-LE', `migration ${f}: CHECK "meia <= inteira" ausente/alterada (chk_event_sectors_meia_le_inteira: meia_price_cents <= inteira_price_cents).`);
      }
    }
    if (!foundTable) note('MIGRATIONS', 'migration que cria a tabela event_sectors ausente.');
  }
}

// ══════════════════════ WRITE-PATH JSONB placeholder (event_occupancy_models.config.sectors) ═══════════
// O eixo econômico do setor (inteira/meia) NUNCA pode ser roteado pela JSONB não-tipada
// event_occupancy_models.config.sectors (placeholder write-orphan) — deve viver na tabela event_sectors.
{
  const SRC_DIR = join(ROOT, 'src', 'modules', 'events');
  if (existsSync(SRC_DIR)) {
    for (const f of readdirSync(SRC_DIR)) {
      if (!f.endsWith('.ts')) continue;
      // O próprio type-def do placeholder (occupancy.types.ts) é intocado — não é write-path.
      if (f === 'occupancy.types.ts' || f === 'event-sector.repository.ts' || f === 'event-sector.service.ts') continue;
      const code = stripTs(readFileSync(join(SRC_DIR, f), 'utf8'));
      if (/event_occupancy_models/i.test(code) && SECTOR_ECON_COLS.test(code)) {
        note('JSONB-PLACEHOLDER', `${f}: eixo econômico do setor (inteira/meia/meia_quota_bps) acoplado a event_occupancy_models — o setor é SELF-CONTAINED em event_sectors; a JSONB config.sectors é placeholder write-orphan, NÃO reabastecer.`);
      }
    }
  }
}

// ══════════════════════ WRITER (service): reconciliação max_attendees + espelho do piso legal ══════════
{
  const SVC_PATH = 'src/modules/events/event-sector.service.ts';
  const SVC_RAW = readOrFail(SVC_PATH, 'FILE');
  if (SVC_RAW) {
    const code = stripTs(SVC_RAW);
    // (d) espelho do piso legal: código do valor 400 + o literal 4000 (o piso da lei).
    if (!/SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR/.test(code) || !/\b4000\b/.test(code)) {
      note('WRITER-FLOOR', `${SVC_PATH}: writer perdeu o espelho do piso legal da meia (SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR sobre o floor 4000).`);
    }
    // (d) espelho meia <= inteira.
    if (!/SECTOR_MEIA_PRICE_EXCEEDS_INTEIRA/.test(code)) {
      note('WRITER-MEIA-LE', `${SVC_PATH}: writer perdeu o espelho 400 "meia <= inteira" (SECTOR_MEIA_PRICE_EXCEEDS_INTEIRA).`);
    }
    // (d) reconciliação com max_attendees: leitura do SSOT + o código do 400.
    if (!/SECTOR_CAPACITY_EXCEEDS_EVENT/.test(code) || !/getEventMaxAttendees|max_attendees|maxAttendees/.test(code)) {
      note('WRITER-RECONCILE', `${SVC_PATH}: writer perdeu a reconciliação com events.max_attendees (SECTOR_CAPACITY_EXCEEDS_EVENT sobre a soma de capacity vs max_attendees, SSOT).`);
    }
    // (c) fronteira Bank-free no writer (código real, literais mascarados — as mensagens citam prosa).
    const codeNoStr = stripJsLiterals(code);
    const bk = codeNoStr.match(BANK_TOKEN);
    if (bk) {
      note('BANK-FRONTIER', `${SVC_PATH}: token '${bk[1] ?? bk[0]}' no writer do setor — preço = DECLARADO; venda/bank/ledger/porta-01 = PORTA-01, FORA (Δbank=0).`);
    }
  }
}

// ══════════════════════ ROTA (região do setor): Bank-free + autoridade do dono ═══════════════════════
{
  const ROUTE_PATH = 'src/modules/events/events-sprint76.routes.ts';
  const RAW = readOrFail(ROUTE_PATH, 'FILE');
  if (RAW) {
    const code = stripTs(RAW);
    // Região do setor: do marcador SETORES até a rota /tickets/:id/reserve (fim da seção do setor).
    const s = code.search(/SETORES\s*\(SLICE\s*S3\)|\/events\/:id\/sectors/);
    const eRel = s >= 0 ? code.slice(s).search(/\/tickets\/:id\/reserve/) : -1;
    const region = s >= 0 && eRel >= 0 ? code.slice(s, s + eRel) : '';
    if (!region) {
      note('ROUTE-REGION', `${ROUTE_PATH}: região da rota de setor (/events/:id/sectors) não encontrada.`);
    } else {
      // (d)/autoridade WRITE: a rota prova a chave EXATA sobre o DONO DO EVENTO (organizerActorId).
      if (!/userCanActOnEventOwner\([^)]*organizerActorId[^)]*create_events/.test(region.replace(/\s+/g, ' '))) {
        note('ROUTE-AUTHORITY', `${ROUTE_PATH}: rota de setor perdeu o espelho de autoridade WRITE — userCanActOnEventOwner(..., event.organizerActorId, 'create_events') (dono do evento, server-resolved).`);
      }
      // (d)/autoridade READ (R1): o GET de setores herda a visibilidade do irmão GET /events/:id via
      // canViewEvent deny-first — sem ela, preço/capacidade/cota de eventos DRAFT/privados vazariam.
      if (!/canViewEvent/.test(region)) {
        note('ROUTE-READ-VISIBILITY', `${ROUTE_PATH}: rota de setor perdeu o espelho de VISIBILIDADE de leitura — GET /events/:id/sectors deve aplicar canViewEvent deny-first (igual ao irmão GET /events/:id), senão vaza preço/capacidade/cota de eventos DRAFT/privados.`);
      }
      // (c) fronteira Bank-free na região do setor (literais mascarados).
      const regionNoStr = stripJsLiterals(region);
      const bk = regionNoStr.match(BANK_TOKEN);
      if (bk) {
        note('BANK-FRONTIER', `${ROUTE_PATH}: token '${bk[1] ?? bk[0]}' na região da rota de setor — venda/bank/ledger/porta-01 = PORTA-01, FORA (Δbank=0).`);
      }
    }
  }
}

if (fails.length) {
  console.error('❌ audit-event-sector-meia-floor FALHOU:');
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('✅ audit-event-sector-meia-floor OK — setor SELF-CONTAINED (event_sectors) · piso legal da MEIA HARD-LOCKED (meia_quota_bps BETWEEN 4000 AND 10000 = 40%–100%, Lei 12.933/2013 + Decreto 8.537/2015, NUNCA < 4000) · nomes canônicos (sem sinônimo setor/sector_capacity/meia_capacity/quota_pct; sem write-path à JSONB event_occupancy_models.config.sectors) · fronteira Bank-free (_cents DECLARADO; sem bank/ledger/porta-01/venda) · writer com espelho do piso + reconciliação max_attendees (SSOT) + autoridade do dono do evento.');
