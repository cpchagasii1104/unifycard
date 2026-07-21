#!/usr/bin/env node
// Guard estrutural — F-EVENT-SETTLEMENT-GHOST-CONTAINMENT (achado B2 do auditoria.md, Clayton
// escolheu CONTER em vez de materializar, 2026-07-02).
//
// event_settlements é tabela-fantasma (CREATE só em migrations_archive/0215, com 4 drifts; SEM
// migration viva). Tinha 3 superfícies vivas: settleEvent (UPDATE, já contido), createFromEvent
// (INSERT, era mascarado só por try/catch no caller), getSettlementByEvent (SELECT, dava 500 vivo).
// As 3 agora são fail-closed pelo firewall assertEventSettlementRuntimeEnabled (default-off).
//
// MORDE:
//   (A) qualquer um dos 3 métodos do service perder o assertEventSettlementRuntimeEnabled;
//   (B) uma migration VIVA criar event_settlements sem passar pela decisão de PORTA-1 (materializar
//       a tabela é decisão soberana, não pode aparecer sozinha — o acoplamento tabela↔flag é a
//       proteção; se a tabela for materializada, esta linha do guard deve ser reavaliada junto);
//   (C) o repository perder o padrão tenant-scoped (runQueryWithTenant) e passar a usar pool cru.
// Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { stripSqlComments, maskStringLiterals, createsTarget, extractExecuteLiterals, tokenPresent } from './lib/sql-shape.mjs';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

// (A) as 3 superfícies do service gated.
const SERVICE = join(ROOT, 'src', 'modules', 'marketplace', 'event-settlement.service.ts');
if (!existsSync(SERVICE)) {
  failures.push(`arquivo ausente: ${SERVICE}`);
} else {
  const src = stripTs(readFileSync(SERVICE, 'utf-8'));
  // extrai o corpo de cada método e confere o assert.
  const methods = ['createFromEvent', 'settleEvent', 'getSettlementByEvent'];
  for (const m of methods) {
    const start = src.indexOf(`async ${m}(`);
    if (start < 0) { failures.push(`${SERVICE}: método ${m} não encontrado.`); continue; }
    // próximo "async " ou fim do arquivo delimita o corpo (heurística suficiente p/ este arquivo pequeno).
    const nextAsync = src.indexOf('\n  async ', start + 1);
    const body = src.slice(start, nextAsync > start ? nextAsync : src.length);
    if (!/assertEventSettlementRuntimeEnabled\(/.test(body)) {
      failures.push(`${SERVICE}: ${m} não chama assertEventSettlementRuntimeEnabled — superfície do trilho de settlement de evento voltou a ficar ungated (achado B2 reaberto).`);
    }
  }
}

// (B) nenhuma migration VIVA materializa event_settlements (materializar = decisão de PORTA-1).
// ENDURECIDO (F-GUARD-HARDENING-MIGRATION-DDL-RECOGNITION): reconhecimento estrutural via sql-shape.
// Além de CREATE TABLE (schema-qualified/quoted/IF NOT EXISTS — já cobertos), agora pega CREATE TABLE AS,
// SELECT ... INTO, ALTER TABLE ... RENAME TO, DDL estático dentro de DO $$, e EXECUTE literal /
// EXECUTE format(...) com o target literal presente. SQL dinâmico irresolvível (só variável) é ACEITO
// com diagnóstico determinístico (não falha isoladamente).
const TARGET = 'event_settlements';
const MIG_DIR = join(ROOT, 'migrations');
const dynNotes = [];
if (existsSync(MIG_DIR)) {
  for (const f of readdirSync(MIG_DIR)) {
    if (!f.endsWith('.sql')) continue;
    const raw = readFileSync(join(MIG_DIR, f), 'utf-8');
    if (!tokenPresent(stripSqlComments(raw), TARGET)) continue; // fora do escopo (nem em código)
    // texto estático: comentários fora, strings de dado mascaradas, dollar-quote preservado (é código).
    const clean = maskStringLiterals(stripSqlComments(raw), { maskDollarQuotes: false });
    const st = createsTarget(clean, TARGET);
    if (st.hit) {
      failures.push(`migrations/${f}: materializa event_settlements (forma ${st.form}) numa migration VIVA — a tabela-fantasma é decisão soberana de PORTA-1/IA-DINHEIRO, não pode entrar sozinha. Se foi decidido materializar, atualize este guard junto com a DECISION.`);
      continue;
    }
    // DDL dinâmico via EXECUTE
    let flaggedDyn = false;
    for (const u of extractExecuteLiterals(raw)) {
      const body = u.resolvableText;
      if (!body) { if (u.hasDynamicArg && /\bCREATE\s+TABLE|\bRENAME\s+TO|\bSELECT\b[\s\S]*\bINTO\b/i.test(clean)) dynNotes.push(`migrations/${f}`); continue; }
      if (createsTarget(body, TARGET).hit) { failures.push(`migrations/${f}: EXECUTE materializa event_settlements em DDL dinâmico resolvível (PORTA-1).`); flaggedDyn = true; break; }
      const verb = /\bCREATE\s+TABLE|\bRENAME\s+TO|\bSELECT\b[\s\S]*\bINTO\b/i.test(body);
      if (verb && tokenPresent(body, TARGET)) { failures.push(`migrations/${f}: EXECUTE format materializa event_settlements (target literal presente) — DDL dinâmico com token do alvo (PORTA-1).`); flaggedDyn = true; break; }
      if (verb && u.hasDynamicArg) dynNotes.push(`migrations/${f}`);
    }
    if (flaggedDyn) continue;
  }
}
if (dynNotes.length) {
  // diagnóstico informativo determinístico — NÃO altera exit code isoladamente.
  console.log(`[event-settlement-ghost-containment] DYNAMIC_UNRESOLVED (revisão manual, não-falha): DDL dinâmico com nome de tabela por variável em ${[...new Set(dynNotes)].sort().join(', ')}.`);
}

// (C) repository tenant-scoped (sem pool cru).
const REPO = join(ROOT, 'src', 'modules', 'marketplace', 'event-settlement.repository.ts');
if (existsSync(REPO)) {
  const src = stripTs(readFileSync(REPO, 'utf-8'));
  if (/\bpool\.query\(|\bpool\.connect\(/.test(src)) {
    failures.push(`${REPO}: pool cru — event_settlements deve ser acessada só via runQueryWithTenant/runQueriesWithTenant (tenant-scoped).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [event-settlement-ghost-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [event-settlement-ghost-containment] — as 3 superfícies (create/read/settle) de event_settlements estão firewall-gated fail-closed; nenhuma migration viva materializa a tabela-fantasma (materializar = PORTA-1); repository tenant-scoped. Achado B2 do auditoria.md contido.');
