#!/usr/bin/env node
// audit-vaquinha-funding-rules.mjs — Guard da SLICE S1 (VAQUINHA RULES) do arco "evento em si".
// A vaquinha = financiamento coletivo tudo-ou-nada: META (events.min_attendees = PESSOAS) + PRAZO
// (events.funding_deadline_at) + estorno-se-não-atingir (v1 = implícito por events.is_all_or_nothing).
// A REGRA é DECLARADA na linha events; a MOVIMENTAÇÃO de dinheiro (promessa/estorno) é PORTA-01, FORA.
// Bank-free: a META continua PESSOAS (min_attendees), NUNCA cents/funding_goal_cents (Δbank=0).
//
// MORDE se:
//  (a) qualquer token de dinheiro (funding_goal_cents / *_cents / bank / ledger / porta-01 / currency)
//      aparecer na DDL das colunas da vaquinha — a fronteira Bank-free (a META é gente, não dinheiro);
//  (b) o CHECK "all-or-nothing exige META" (chk_events_all_or_nothing_requires_goal) OU o CHECK
//      "prazo <= início" (chk_events_funding_deadline_before_start) OU o CHECK de acoplamento ao acesso
//      (chk_events_all_or_nothing_access_type) for perdido;
//  (c) o prefixo booleano canônico is_ for descartado (coluna all_or_nothing sem is_);
//  (d) funding_deadline_at for CONFUNDIDO com datetime_end (fim do evento) — no CHECK físico (deve comparar
//      a datetime_start, nunca datetime_end) OU no writer (deve derivar/validar o prazo contra datetimeStart,
//      nunca datetimeEnd; o prazo fecha ANTES do evento, não é o encerramento dele);
//  (e) o writer perder os espelhos 400 (validate-before-mutate) das regras (a)/(b)/(c-acoplamento).
// Region-anchored; comment-aware (stripTs no TS, strip de comentário + literais SQL). Fail-closed.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
// Neutraliza LITERAIS de string JS ('...', "...", `...`) — as mensagens de erro (pt-BR) citam
// 'datetime_end'/'datetime_start' em PROSA; o scan de CONFLAÇÃO/dinheiro deve ver só CÓDIGO REAL, não prosa.
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

// Colunas canônicas da vaquinha. NENHUMA _cents nasce aqui (META = pessoas).
const VAQUINHA_COLS = /funding_deadline_at|is_all_or_nothing/i;
// Nome de dinheiro proibido na fronteira da vaquinha (a META é gente, nunca cents).
const MONEY_TOKEN = /\b(\w*_cents|funding_goal|bank_|bank_ledger|bank_transactions|ledger|payout|payable|receivable|refund\w*|settled|currency|moeda|fee_bps|porta[-_]?01)\b/i;

// ══════════════════════ MIGRATION: cobertura UNIVERSAL das colunas da vaquinha ══════════════════════
{
  const MIG_DIR = join(ROOT, 'migrations');
  if (!existsSync(MIG_DIR)) {
    note('MIGRATIONS', 'diretorio migrations ausente');
  } else {
    let foundCols = false;
    let sawDeadlineCol = false, sawBoolCol = false;
    for (const f of readdirSync(MIG_DIR)) {
      if (!f.endsWith('.sql')) continue;
      const raw = readFileSync(join(MIG_DIR, f), 'utf8');
      const sql = stripSql(raw);
      const sqlNoLit = stripSqlLiterals(sql);
      // Statements DDL de events que tocam as colunas da vaquinha.
      const ddlStmts = sqlNoLit.split(';').filter((s) =>
        VAQUINHA_COLS.test(s) && /\b(CREATE\s+TABLE|ALTER\s+TABLE)\b/i.test(s) && /\bevents\b/i.test(s));
      if (ddlStmts.length === 0) continue;
      foundCols = true;

      for (const st of ddlStmts) {
        // (a) fronteira Bank-free: nenhum token de dinheiro na DDL das colunas da vaquinha.
        const mm = st.match(MONEY_TOKEN);
        if (mm) {
          note('BANK-FRONTIER', `migration ${f}: token de dinheiro '${mm[1] ?? mm[0]}' na DDL das colunas da vaquinha — a META é PESSOAS (min_attendees), NUNCA cents/funding_goal_cents; dinheiro real = PORTA-01, FORA (Δbank=0).`);
        }
        // (c) prefixo booleano canônico is_: uma coluna 'all_or_nothing' sem is_ é proibida.
        if (/\ball_or_nothing\b/i.test(st) && !/\bis_all_or_nothing\b/i.test(st)) {
          note('IS-PREFIX', `migration ${f}: coluna booleana 'all_or_nothing' sem prefixo canônico is_ — deve ser is_all_or_nothing (cf. 20260530410000_fix_boolean_prefixes).`);
        }
        // (d) conflação no CHECK físico: a regra do prazo deve comparar a datetime_start, NUNCA datetime_end.
        if (/funding_deadline_at/i.test(st) && /datetime_end/i.test(st)) {
          note('CONFLATION', `migration ${f}: funding_deadline_at referenciado junto a datetime_end (fim do evento) — o prazo da vaquinha fecha ANTES do evento (compara a datetime_start), nunca é o encerramento (datetime_end).`);
        }
      }
      // Presença física das colunas neste arquivo (o que CRIA a vaquinha).
      if (/funding_deadline_at\s+TIMESTAMPTZ/i.test(sql)) sawDeadlineCol = true;
      if (/is_all_or_nothing\s+BOOLEAN/i.test(sql)) sawBoolCol = true;

      // (b) os CHECKs físicos exigidos — só GATEADOS no arquivo que ADD as colunas.
      if (sawDeadlineCol || sawBoolCol) {
        if (!/chk_events_all_or_nothing_requires_goal/i.test(sql) ||
            !/NOT\s+is_all_or_nothing\s+OR\s+min_attendees\s+IS\s+NOT\s+NULL/i.test(sqlNoLit)) {
          note('CHECK-GOAL', `migration ${f}: CHECK "all-or-nothing exige META" ausente/alterado (chk_events_all_or_nothing_requires_goal: NOT is_all_or_nothing OR min_attendees IS NOT NULL).`);
        }
        if (!/chk_events_funding_deadline_before_start/i.test(sql) ||
            !/funding_deadline_at\s*<=\s*datetime_start/i.test(sqlNoLit)) {
          note('CHECK-DEADLINE', `migration ${f}: CHECK "prazo <= início" ausente/alterado (chk_events_funding_deadline_before_start: funding_deadline_at <= datetime_start, tolerante a NULL).`);
        }
        if (!/chk_events_all_or_nothing_access_type/i.test(sql) ||
            !/NOT\s+is_all_or_nothing\s+OR\s+event_access_type/i.test(sqlNoLit)) {
          note('CHECK-ACCESS', `migration ${f}: CHECK de acoplamento ao acesso ausente/alterado (chk_events_all_or_nothing_access_type: NOT is_all_or_nothing OR event_access_type = 'contribuicao_opcional').`);
        }
      }
    }
    if (!foundCols) note('MIGRATIONS', 'migration que adiciona as colunas da vaquinha (funding_deadline_at/is_all_or_nothing) em events ausente.');
    else {
      if (!sawDeadlineCol) note('COLUMN', 'coluna funding_deadline_at TIMESTAMPTZ ausente na DDL de events.');
      if (!sawBoolCol) note('COLUMN', 'coluna is_all_or_nothing BOOLEAN ausente na DDL de events.');
    }
  }
}

// ══════════════════════ WRITER: espelhos 400 (validate-before-mutate) + anti-conflação ══════════════
{
  const SVC_PATH = 'src/core/events/event.service.ts';
  const SVC_RAW = readOrFail(SVC_PATH, 'FILE');
  if (SVC_RAW) {
    const code = stripTs(SVC_RAW);
    // Região do bloco de validação da vaquinha (do gate willTouchVaquinha até o push da coluna booleana).
    // O push da coluna renderiza como `is_all_or_nothing = $${paramIndex++}` → âncora `is_all_or_nothing = $`.
    const s = code.search(/willTouchVaquinha/);
    const eRel = s >= 0 ? code.slice(s).search(/is_all_or_nothing\s*=\s*\$/) : -1;
    const region = s >= 0 && eRel >= 0 ? code.slice(s, s + eRel + 60) : '';
    if (!region) {
      note('WRITER-REGION', `${SVC_PATH}: bloco de validação da vaquinha (willTouchVaquinha) não encontrado — validate-before-mutate ausente.`);
    } else {
      // (e) espelho: all-or-nothing exige META (min_attendees).
      if (!/VAQUINHA_ALL_OR_NOTHING_REQUIRES_GOAL/.test(region) || !/minAttendees/.test(region)) {
        note('WRITER-GOAL', `${SVC_PATH}: writer perdeu o espelho 400 "all-or-nothing exige META" (VAQUINHA_ALL_OR_NOTHING_REQUIRES_GOAL sobre min_attendees).`);
      }
      // (e) espelho: acoplamento a contribuicao_opcional.
      if (!/VAQUINHA_ACCESS_TYPE_MISMATCH/.test(region) || !/contribuicao_opcional/.test(region)) {
        note('WRITER-ACCESS', `${SVC_PATH}: writer perdeu o espelho 400 do acoplamento ao acesso (VAQUINHA_ACCESS_TYPE_MISMATCH → contribuicao_opcional).`);
      }
      // (b)/(d) espelho: prazo <= início, comparado a datetimeStart e NUNCA datetimeEnd (anti-conflação).
      if (!/VAQUINHA_DEADLINE_AFTER_START/.test(region) || !/datetimeStart/.test(region)) {
        note('WRITER-DEADLINE', `${SVC_PATH}: writer perdeu o espelho 400 "prazo <= início" (VAQUINHA_DEADLINE_AFTER_START comparado a datetimeStart).`);
      }
      // (b)/(d) anti-conflação + (a) Bank-free: sobre CÓDIGO REAL (literais mascarados — a prosa das mensagens
      // cita datetime_end/cents legitimamente). O prazo NUNCA é derivado/comparado contra datetimeEnd no código.
      const regionNoStr = stripJsLiterals(region);
      if (/datetimeEnd|datetime_end/.test(regionNoStr)) {
        note('CONFLATION', `${SVC_PATH}: código do bloco da vaquinha referencia datetimeEnd (fim do evento) — o PRAZO fecha contra datetimeStart (início), nunca o encerramento; funding_deadline_at ≠ datetime_end.`);
      }
      const mm = regionNoStr.match(MONEY_TOKEN);
      if (mm) {
        note('BANK-FRONTIER', `${SVC_PATH}: token de dinheiro '${mm[1] ?? mm[0]}' no bloco da vaquinha — a META é PESSOAS; dinheiro = PORTA-01, FORA (Δbank=0).`);
      }
    }
    // As colunas da vaquinha são efetivamente escritas pelo writer (prova positiva de material vivo).
    // O push renderiza como `<col> = $${paramIndex++}` → âncora `<col> = $`.
    if (!/funding_deadline_at\s*=\s*\$/.test(code)) {
      note('WRITER-COLUMN', `${SVC_PATH}: writer não escreve funding_deadline_at no UPDATE (coluna morta).`);
    }
    if (!/is_all_or_nothing\s*=\s*\$/.test(code)) {
      note('WRITER-COLUMN', `${SVC_PATH}: writer não escreve is_all_or_nothing no UPDATE (coluna morta).`);
    }
  }
}

if (fails.length) {
  console.error('❌ audit-vaquinha-funding-rules FALHOU:');
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('✅ audit-vaquinha-funding-rules OK — vaquinha (all-or-nothing) = REGRA DECLARADA na linha events · META = min_attendees (PESSOAS, NUNCA cents/funding_goal_cents; Δbank=0, porta-01 FORA) · is_all_or_nothing (prefixo canônico is_) · CHECK "exige META" + CHECK "prazo <= início" (datetime_start, NUNCA datetime_end) + CHECK acoplamento contribuicao_opcional · espelhos 400 no writer (validate-before-mutate) · fronteira Bank-free.');
