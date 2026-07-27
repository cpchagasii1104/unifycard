#!/usr/bin/env node
// audit-event-sector-meia-floor.mjs — Guard da SLICE S3 (SETORES) do arco "evento em si".
// O SETOR é SELF-CONTAINED (tabela event_sectors própria) com pool COMPARTILHADO (capacity), preço INTEIRA
// e preço MEIA legalmente pisado. O piso legal da MEIA — meia_quota_bps BETWEEN 4000 AND 10000 (40%–100%) —
// é HARD-LOCKED por lei (Lei 12.933/2013 + Decreto 8.537/2015) e NUNCA pode descer abaixo de 40%. A MEIA
// tem que valer a METADE EXATA da inteira (não só "mais barata" — CHECK chk_event_sectors_meia_is_half_
// inteira). A reconciliação SUM(capacity) <= max_attendees é ATÔMICA (transação + advisory lock), tanto na
// criação/edição de setor quanto na baixa de events.max_attendees por baixo dos setores já persistidos.
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
//  (d) o writer (service+repository) perder a RECONCILIAÇÃO com max_attendees (SECTOR_CAPACITY_EXCEEDS_EVENT
//      + leitura de max_attendees), a TRANSAÇÃO+ADVISORY LOCK que a serializa (BUG D1), OU o ESPELHO do piso
//      legal (SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR + 4000);
//  (e) a CHECK física "meia = METADE EXATA da inteira" (chk_event_sectors_meia_is_half_inteira) for perdida/
//      enfraquecida de volta a um "meia <= inteira" (BUG E1), OU o writer perder o espelho
//      SECTOR_MEIA_PRICE_NOT_HALF;
//  (f) o helper canônico deriveMeiaTicketFloor (BUG E2 — piso legal da meia em CONTAGEM de ingressos) usar
//      Math.floor (arredonda o PISO MÍNIMO legal para BAIXO — ilegal) em vez de Math.ceil, sumir, OU a
//      derivação floor/ceil reaparecer INLINE fora do helper (region-anchored no arquivo math);
//  (g) a migration de event_sectors perder RLS (ENABLE+FORCE+policy tenant_id, HARDEN E4).
// Region-anchored; comment-aware (strip TS + strip SQL + strip de literais). Fail-closed.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const stripJsLiterals = (s) => s.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, "''");
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripSqlLiterals = (s) => s.replace(/'(?:''|[^'])*'/g, "''");
// Extrai a REGIÃO de UM método entre dois marcadores — mesmo mecanismo marker-based já usado abaixo p/
// a região da rota do setor (code.search + code.slice), só reempacotado como helper reutilizável p/
// ancorar checks a UMA função específica (RESSALVA 2: um check whole-file/regex solto no arquivo inteiro
// passa mesmo se a trava sumir de UMA função só, contanto que sobre o literal em QUALQUER outro lugar do
// arquivo — region-anchoring fecha esse ponto cego). Vai do INÍCIO do marcador inicial até o INÍCIO do
// marcador final (exclusive); se o marcador final não aparecer, vai até o fim do arquivo. Marcador
// inicial ausente → região vazia (caller decide como reportar "função sumiu").
const regionBetween = (code, startMarker, endMarker) => {
  const s = code.indexOf(startMarker);
  if (s < 0) return '';
  const rest = code.slice(s + startMarker.length);
  const eRel = endMarker ? rest.indexOf(endMarker) : -1;
  return eRel >= 0 ? code.slice(s, s + startMarker.length + eRel) : code.slice(s);
};
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

// ══════════════════════ MIGRATION: DDL de event_sectors (piso legal + meia=metade + RLS + sinônimos + Bank-free) ═══
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

      // (e) Presença física da CHECK "meia = METADE EXATA da inteira" (BUG E1 — Lei 12.933/2013). O
      // nome canônico é chk_event_sectors_meia_is_half_inteira; a expressão física é uma divisão
      // inteira (meia_price_cents = inteira_price_cents / 2), NUNCA um "<=" solto (isso reintroduziria
      // a falsa "meia" barrada só contra ser MAIOR, não contra ser DIFERENTE da metade).
      if (!/chk_event_sectors_meia_is_half_inteira/i.test(sqlNoLit) ||
          !/meia_price_cents\s*=\s*inteira_price_cents\s*\/\s*2/i.test(sqlNoLit)) {
        note('CHECK-MEIA-HALF', `migration ${f}: CHECK "meia = METADE EXATA da inteira" ausente/alterada (chk_event_sectors_meia_is_half_inteira: meia_price_cents = inteira_price_cents / 2 — Lei 12.933/2013).`);
      }
      // (e) anti-regressão: o antigo constraint fraco (chk_event_sectors_meia_le_inteira, "<=" solto
      // sem o "=" de metade exata) reaparecendo é uma REGRESSÃO ao BUG E1 (falsa meia com 1% de desconto).
      if (/chk_event_sectors_meia_le_inteira/i.test(sqlNoLit)) {
        note('CHECK-MEIA-HALF', `migration ${f}: constraint fraco chk_event_sectors_meia_le_inteira ("meia <= inteira") reapareceu — REGRESSÃO ao BUG E1 (a lei exige METADE EXATA, não só "mais barata"); use chk_event_sectors_meia_is_half_inteira.`);
      }

      // (g) HARDEN E4 — RLS (ENABLE+FORCE+policy tenant_id) na tabela event_sectors, mesmo padrão
      // canônico das ~93 tabelas tenant-owned (20260516100000_rls_critical_tables.sql). Checa contra
      // `sql` (só comentários removidos) — sqlNoLit mascara os literais 'app.current_tenant' p/ ''.
      if (!/ALTER\s+TABLE\s+event_sectors\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql) ||
          !/ALTER\s+TABLE\s+event_sectors\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql)) {
        note('RLS-MISSING', `migration ${f}: event_sectors sem ENABLE+FORCE ROW LEVEL SECURITY (HARDEN E4 — paridade com as demais tabelas tenant-owned).`);
      }
      if (!/CREATE\s+POLICY\s+event_sectors_rls\s+ON\s+event_sectors[\s\S]*?current_setting\(\s*'app\.current_tenant'/i.test(sql)) {
        note('RLS-MISSING', `migration ${f}: policy event_sectors_rls (tenant_id::text = current_setting('app.current_tenant', true)) ausente/alterada na DDL de event_sectors.`);
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
      if (f === 'occupancy.types.ts' || f === 'event-sector.repository.ts' || f === 'event-sector.service.ts' || f === 'event-sector.math.ts') continue;
      const code = stripTs(readFileSync(join(SRC_DIR, f), 'utf8'));
      if (/event_occupancy_models/i.test(code) && SECTOR_ECON_COLS.test(code)) {
        note('JSONB-PLACEHOLDER', `${f}: eixo econômico do setor (inteira/meia/meia_quota_bps) acoplado a event_occupancy_models — o setor é SELF-CONTAINED em event_sectors; a JSONB config.sectors é placeholder write-orphan, NÃO reabastecer.`);
      }
    }
  }
}

// ══════════════════════ WRITER (service): validate-before-mutate — piso legal + meia=metade + runtime body ═══
{
  const SVC_PATH = 'src/modules/events/event-sector.service.ts';
  const SVC_RAW = readOrFail(SVC_PATH, 'FILE');
  if (SVC_RAW) {
    const code = stripTs(SVC_RAW);
    // (d) espelho do piso legal: código do valor 400 + o literal 4000 (o piso da lei).
    if (!/SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR/.test(code) || !/\b4000\b/.test(code)) {
      note('WRITER-FLOOR', `${SVC_PATH}: writer perdeu o espelho do piso legal da meia (SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR sobre o floor 4000).`);
    }
    // (e) espelho "meia = METADE EXATA" (BUG E1): código 400 específico + a divisão inteira /2 que
    // computa a metade (Math.floor(inteiraPriceCents / 2) — arredonda para baixo, favorável ao
    // consumidor). Um "<=" solto sem essa divisão seria REGRESSÃO ao check fraco antigo.
    if (!/SECTOR_MEIA_PRICE_NOT_HALF/.test(code)) {
      note('WRITER-MEIA-HALF', `${SVC_PATH}: writer perdeu o espelho 400 "meia = METADE EXATA" (SECTOR_MEIA_PRICE_NOT_HALF) — regressão ao BUG E1 (a lei exige metade, não só "mais barata").`);
    }
    if (!/inteiraPriceCents\s*\/\s*2/.test(code)) {
      note('WRITER-MEIA-HALF', `${SVC_PATH}: writer perdeu a divisão inteira (inteiraPriceCents / 2) que computa a metade exata legal — sem ela o espelho do CHECK físico chk_event_sectors_meia_is_half_inteira fica incompleto.`);
    }
    // HARDEN E6 — validação de runtime do corpo (o generic do Fastify é só compile-time). O anchor é o
    // nome do método deste próprio service (não impõe zod/schema — só exige QUE validação exista).
    if (!/assertValidSectorBody/.test(code)) {
      note('RUNTIME-VALIDATION', `${SVC_PATH}: writer perdeu a validação de runtime do corpo (HARDEN E6) — sectorNumber/capacity/meiaQuotaBps/inteiraPriceCents/meiaPriceCents precisam ser validados ANTES de qualquer query (não só pelo generic TS do Fastify, que é compile-time).`);
    }
    // (c) fronteira Bank-free no writer (código real, literais mascarados — as mensagens citam prosa).
    const codeNoStr = stripJsLiterals(code);
    const bk = codeNoStr.match(BANK_TOKEN);
    if (bk) {
      note('BANK-FRONTIER', `${SVC_PATH}: token '${bk[1] ?? bk[0]}' no writer do setor — preço = DECLARADO; venda/bank/ledger/porta-01 = PORTA-01, FORA (Δbank=0).`);
    }
  }
}

// ══════════════════════ WRITER (repository): reconciliação max_attendees ATÔMICA (BUG D1) ═══════════════
{
  const REPO_PATH = 'src/modules/events/event-sector.repository.ts';
  const REPO_RAW = readOrFail(REPO_PATH, 'FILE');
  if (REPO_RAW) {
    const code = stripTs(REPO_RAW);
    // (d) reconciliação com max_attendees: leitura do SSOT + o código do 400 — agora residem no
    // repository (createSectorReconciled/updateSectorReconciled), não mais no service.
    if (!/SECTOR_CAPACITY_EXCEEDS_EVENT/.test(code) || !/max_attendees|maxAttendees/.test(code)) {
      note('WRITER-RECONCILE', `${REPO_PATH}: writer perdeu a reconciliação com events.max_attendees (SECTOR_CAPACITY_EXCEEDS_EVENT sobre a soma de capacity vs max_attendees, SSOT).`);
    }
    // (d) BUG D1 — a reconciliação PRECISA rodar sob transação + advisory xact lock por (tenant,event),
    // mesma casa da trava de core/events/event.service.ts (createEventBoundToGroup). Sem isto, o SELECT
    // SUM e o INSERT/UPDATE voltam a ser chamadas SEPARADAS (runQueryWithTenant/runQueriesWithTenant
    // abrem um client NOVO cada) — TOCTOU real entre duas criações concorrentes.
    //
    // RESSALVA 2 (auditoria independente, fechada): um check whole-file (/pg_advisory_xact_lock/.test(code))
    // morde só se a trava sumir do ARQUIVO INTEIRO — remover a trava de UMA função só (ex.: só
    // createSectorReconciled) ainda passa se a outra função (updateSectorReconciled) mantém o literal em
    // algum lugar do arquivo (confirmado: mutar só createSectorReconciled NÃO derrubava o guard antes
    // deste fix). Region-anchored por função — cada uma tem que carregar a trava+BEGIN NO PRÓPRIO CORPO.
    const createRegion = regionBetween(code, 'async createSectorReconciled(', 'async updateSectorReconciled(');
    const updateRegion = regionBetween(code, 'async updateSectorReconciled(', 'async getSectorById(');
    for (const [fnName, region] of [['createSectorReconciled', createRegion], ['updateSectorReconciled', updateRegion]]) {
      if (!region) {
        note('CONCURRENCY-LOCK', `${REPO_PATH}: função ${fnName} não encontrada (marcador ausente) — não foi possível ancorar o check de trava ao corpo dela.`);
        continue;
      }
      if (!/pg_advisory_xact_lock/.test(region) || !/hashtextextended\(\s*'event_sector_capacity:/.test(region)) {
        note('CONCURRENCY-LOCK', `${REPO_PATH}#${fnName}: perdeu a serialização por pg_advisory_xact_lock(hashtextextended('event_sector_capacity:'||tenant||':'||event, 0)) NO CORPO DESTA FUNÇÃO — sem ela, duas criações/edições concorrentes de setor podem ambas passar o check SUM(capacity) <= max_attendees e ambas escrever (BUG D1, TOCTOU).`);
      }
      if (!/'BEGIN'/.test(region)) {
        note('CONCURRENCY-LOCK', `${REPO_PATH}#${fnName}: perdeu o BEGIN explícito de transação NO CORPO DESTA FUNÇÃO — sem ele, o advisory xact lock (que expira no COMMIT/ROLLBACK) não serializa nada.`);
      }
    }
    // (c) fronteira Bank-free no repository (código real, literais mascarados).
    const codeNoStr = stripJsLiterals(code);
    const bk = codeNoStr.match(BANK_TOKEN);
    if (bk) {
      note('BANK-FRONTIER', `${REPO_PATH}: token '${bk[1] ?? bk[0]}' no repository do setor — preço = DECLARADO; venda/bank/ledger/porta-01 = PORTA-01, FORA (Δbank=0).`);
    }
  }
}

// ══════════════════════ BUG E2 — helper canônico deriveMeiaTicketFloor (ceil, nunca floor) ═══════════════
{
  const MATH_PATH = 'src/modules/events/event-sector.math.ts';
  const MATH_RAW = readOrFail(MATH_PATH, 'FILE');
  if (MATH_RAW) {
    const code = stripTs(MATH_RAW);
    if (!/export\s+function\s+deriveMeiaTicketFloor/.test(code)) {
      note('MEIA-TICKET-FLOOR', `${MATH_PATH}: helper canônico deriveMeiaTicketFloor ausente/renomeado — a derivação meia_quota_bps → contagem de ingressos precisa de um único ponto de verdade EXPORTADO.`);
    }
    if (!/Math\.ceil/.test(code)) {
      note('MEIA-TICKET-FLOOR', `${MATH_PATH}: deriveMeiaTicketFloor perdeu o Math.ceil — o piso/mínimo GARANTIDO da meia (Lei 12.933/2013) tem que arredondar PARA CIMA; arredondar para baixo (floor) pode devolver MENOS que os 40% mínimos exigidos por lei (confirmado: capacity=7,bps=4000 → floor=2=28.6%<40% ILEGAL; ceil=3=42.9%✓).`);
    }
    if (/Math\.floor/.test(code)) {
      note('MEIA-TICKET-FLOOR', `${MATH_PATH}: Math.floor apareceu no helper da derivação de CONTAGEM de ingressos — essa derivação é um PISO/MÍNIMO legal e tem que arredondar para CIMA (Math.ceil), nunca para baixo (BUG E2).`);
    }
  }
  // A derivação NÃO pode ser reinlinada fora do helper (region-anchored: qualquer arquivo .ts do módulo
  // events, exceto o próprio helper, que combine capacity*meiaQuotaBps/10000 com Math.floor é a
  // fossilização do BUG E2 fora do local canônico).
  const SRC_DIR = join(ROOT, 'src', 'modules', 'events');
  if (existsSync(SRC_DIR)) {
    for (const f of readdirSync(SRC_DIR)) {
      if (!f.endsWith('.ts') || f === 'event-sector.math.ts') continue;
      const code = stripTs(readFileSync(join(SRC_DIR, f), 'utf8'));
      if (/Math\.floor\s*\(\s*[\w.]*capacity[\s\S]{0,40}meiaQuotaBps[\s\S]{0,10}\/\s*10000/.test(code) ||
          /Math\.floor\s*\(\s*[\w.]*meiaQuotaBps[\s\S]{0,60}capacity[\s\S]{0,10}\/\s*10000/.test(code)) {
        note('MEIA-TICKET-FLOOR', `${f}: derivação capacity×meiaQuotaBps/10000 reinlineada com Math.floor FORA do helper canônico (event-sector.math.ts) — BUG E2 (piso legal arredondado para baixo).`);
      }
    }
  }
  // O E2E do setor precisa IMPORTAR o helper (não reinlinar a conta) — region-anchored no script E2E.
  const E2E_PATH = 'src/scripts/validate-pipeline-e2e-event-sectors.ts';
  const E2E_RAW = readOrFail(E2E_PATH, 'FILE');
  if (E2E_RAW) {
    const code = stripTs(E2E_RAW);
    if (!/deriveMeiaTicketFloor/.test(code)) {
      note('MEIA-TICKET-FLOOR', `${E2E_PATH}: E2E não importa/usa deriveMeiaTicketFloor — a prova da derivação da contagem de ingressos da meia precisa passar pelo helper canônico, não por conta inline (BUG E2).`);
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

// ══════════════════════ BUG D2 — baixar events.max_attendees reconcilia contra event_sectors ═══════════════
{
  const CORE_PATH = 'src/core/events/event.service.ts';
  const CORE_RAW = readOrFail(CORE_PATH, 'FILE');
  if (CORE_RAW) {
    const code = stripTs(CORE_RAW);
    if (!/EVENT_MAX_ATTENDEES_BELOW_SECTOR_CAPACITY/.test(code)) {
      note('MAX-ATTENDEES-RECONCILE', `${CORE_PATH}: updateEvent perdeu a reconciliação de max_attendees contra a soma de capacity já persistida em event_sectors (EVENT_MAX_ATTENDEES_BELOW_SECTOR_CAPACITY) — BUG D2 (baixar o teto por baixo dos setores existentes furava a invariante).`);
    }
    if (!/sumSectorCapacityByEvent/.test(code)) {
      note('MAX-ATTENDEES-RECONCILE', `${CORE_PATH}: updateEvent perdeu a leitura da soma de capacity dos setores (eventSectorRepository.sumSectorCapacityByEvent) antes de aplicar um max_attendees não-nulo menor.`);
    }
    // RESSALVA 1 (auditoria independente, fechada) — o fix do BUG D2 tinha a MESMA classe de corrida
    // TOCTOU que o BUG D1 fechava do outro lado: a leitura do SUM (pré-checagem acima) e o UPDATE de
    // max_attendees rodavam SEM a MESMA advisory xact lock que createSectorReconciled/
    // updateSectorReconciled tomam. reconcileMaxAttendeesLocked fecha isso — region-anchored (RESSALVA 2)
    // no CORPO desta função especificamente, não whole-file.
    // Marcador da DEFINIÇÃO ("private async reconcileMaxAttendeesLocked("), não do CALL SITE
    // ("this.reconcileMaxAttendeesLocked(...)" na pré-checagem acima) — senão a região começaria no
    // call site e engoliria updateEvent inteiro até a definição real, alargando o escopo de volta a
    // quase-whole-file (o mesmo ponto cego da RESSALVA 2).
    const lockedRegion = regionBetween(code, 'private async reconcileMaxAttendeesLocked(', 'async createDraftEvent(');
    if (!lockedRegion) {
      note('CONCURRENCY-LOCK', `${CORE_PATH}: função reconcileMaxAttendeesLocked não encontrada (marcador ausente) — a reconciliação de max_attendees precisa da MESMA trava que event-sector.repository.ts toma, num método próprio ancorável.`);
    } else {
      if (!/pg_advisory_xact_lock/.test(lockedRegion) || !/hashtextextended\(\s*'event_sector_capacity:/.test(lockedRegion)) {
        note('CONCURRENCY-LOCK', `${CORE_PATH}#reconcileMaxAttendeesLocked: perdeu a serialização por pg_advisory_xact_lock(hashtextextended('event_sector_capacity:'||tenant||':'||event, 0)) NO CORPO DESTA FUNÇÃO — sem ela, uma criação/edição de setor concorrente pode commitar ENTRE a leitura do SUM e o UPDATE de max_attendees, deixando max_attendees < SUM(capacity) (RESSALVA 1, TOCTOU).`);
      }
      if (!/'BEGIN'/.test(lockedRegion)) {
        note('CONCURRENCY-LOCK', `${CORE_PATH}#reconcileMaxAttendeesLocked: perdeu o BEGIN explícito de transação NO CORPO DESTA FUNÇÃO — sem ele, o advisory xact lock não serializa nada.`);
      }
      if (!/UPDATE\s+events\s+SET\s+max_attendees/i.test(lockedRegion)) {
        note('CONCURRENCY-LOCK', `${CORE_PATH}#reconcileMaxAttendeesLocked: perdeu o UPDATE de max_attendees DENTRO da própria seção travada — reler o SUM sob lock sem escrever max_attendees no MESMO client reabre a janela TOCTOU (RESSALVA 1).`);
      }
    }
  }
}

if (fails.length) {
  console.error('❌ audit-event-sector-meia-floor FALHOU:');
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('✅ audit-event-sector-meia-floor OK — setor SELF-CONTAINED (event_sectors) · piso legal da MEIA HARD-LOCKED (meia_quota_bps BETWEEN 4000 AND 10000 = 40%–100%, Lei 12.933/2013 + Decreto 8.537/2015, NUNCA < 4000) · MEIA = METADE EXATA da inteira (chk_event_sectors_meia_is_half_inteira, SECTOR_MEIA_PRICE_NOT_HALF) · deriveMeiaTicketFloor usa ceil (nunca floor) para o piso/mínimo legal em contagem de ingressos · reconciliação SUM(capacity)<=max_attendees ATÔMICA (transação+advisory lock) tanto na escrita de setor quanto na baixa de max_attendees · RLS (ENABLE+FORCE+policy) · nomes canônicos (sem sinônimo setor/sector_capacity/meia_capacity/quota_pct; sem write-path à JSONB event_occupancy_models.config.sectors) · fronteira Bank-free (_cents DECLARADO; sem bank/ledger/porta-01/venda) · validação de runtime do corpo (HARDEN E6) · autoridade do dono do evento.');
