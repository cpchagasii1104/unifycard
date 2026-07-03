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

// (B) nenhuma migration VIVA cria event_settlements (materializar = decisão de PORTA-1).
const MIG_DIR = join(ROOT, 'migrations');
if (existsSync(MIG_DIR)) {
  for (const f of readdirSync(MIG_DIR)) {
    if (!f.endsWith('.sql')) continue;
    const sql = readFileSync(join(MIG_DIR, f), 'utf-8');
    if (/CREATE TABLE\s+(IF NOT EXISTS\s+)?event_settlements\b/i.test(sql)) {
      failures.push(`migrations/${f}: CREATE TABLE event_settlements numa migration VIVA — materializar a tabela-fantasma é decisão soberana de PORTA-1/IA-DINHEIRO, não pode entrar sozinha. Se foi decidido materializar, atualize este guard junto com a DECISION.`);
    }
  }
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
