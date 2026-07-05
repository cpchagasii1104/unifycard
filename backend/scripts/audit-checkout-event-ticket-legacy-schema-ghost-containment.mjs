#!/usr/bin/env node
// Guard estrutural — F-CHECKOUT-EVENT-TICKET-LEGACY-INSERT-SCHEMA-GHOST-CONTAINMENT (Onda 1
// zeragem de DT, 2026-07-05, DT-TEMPORAL-LEGACY-DECOMMISSION-RESIDUES R2).
//
// CheckoutTicketService::purchaseTicket fazia INSERT em event_tickets com colunas
// (global_user_id/schedule_slot_id/price_paid/qr_code/status/idempotency_key) que NUNCA
// existiram na tabela (única migration que a cria tem shape de "tipo de ingresso", não de
// ingresso emitido) — se chamada, falha com erro de SQL. Rota POST /checkout/event-ticket segue
// MONTADA sem firewall. Frontend já rerroteado pro caminho canônico (/api/events/:id/checkout).
// Contido fail-closed: throw honesto como PRIMEIRA instrução, antes de qualquer SQL.
//
// EXTENSÃO (achado R-baixa 1 da re-auditoria Yala, 2026-07-05): checkIn é MÉTODO IRMÃO — mesma
// classe de bug (lê qr_code/status, colunas fantasma), rota POST /api/events/checkin também
// MONTADA. Mesma contenção aplicada; guard estendido pra cobrir os dois métodos.
//
// MORDE se qualquer um dos 2 throws sumir OU se o SQL contra event_tickets (INSERT/SELECT com as
// colunas fantasma) voltar a ficar alcançável ANTES do throw correspondente. Heurística textual
// comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FILE = join(ROOT, 'src', 'modules', 'events', 'checkout-ticket.service.ts');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

function checkMethod(src, methodSignature, sqlMarker, label, failures) {
  const fnStart = src.indexOf(methodSignature);
  if (fnStart < 0) {
    failures.push(`${label}: método não encontrado (assinatura "${methodSignature}").`);
    return;
  }
  // Escopo até o próximo método de classe (linha "  async " seguinte) ou fim do arquivo.
  const nextMethod = src.indexOf('\n  async ', fnStart + methodSignature.length);
  const scope = src.slice(fnStart, nextMethod >= 0 ? nextMethod : undefined);
  const throwIdx = scope.indexOf('CHECKOUT_EVENT_TICKET_LEGACY_SCHEMA_GHOST_CONTAINED');
  const sqlIdx = scope.indexOf(sqlMarker);
  if (throwIdx < 0) {
    failures.push(`${label}: throw CHECKOUT_EVENT_TICKET_LEGACY_SCHEMA_GHOST_CONTAINED ausente — contenção removida.`);
  }
  if (sqlIdx >= 0 && (throwIdx < 0 || sqlIdx < throwIdx)) {
    failures.push(`${label}: "${sqlMarker}" fica ANTES (ou sem) o throw de contenção — reabre o schema ghost.`);
  }
}

const failures = [];
if (!existsSync(FILE)) {
  failures.push(`arquivo ausente: ${FILE}`);
} else {
  const src = stripTs(readFileSync(FILE, 'utf8'));
  checkMethod(src, 'async purchaseTicket(', 'INSERT INTO event_tickets', `${FILE} :: purchaseTicket`, failures);
  checkMethod(src, 'async checkIn(', 'FROM event_tickets', `${FILE} :: checkIn`, failures);
}

if (failures.length) {
  console.error('GATE FAIL [checkout-event-ticket-legacy-schema-ghost-containment]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [checkout-event-ticket-legacy-schema-ghost-containment] — purchaseTicket falha honesto ANTES de tocar event_tickets (colunas fantasma); caminho canônico é POST /api/events/:id/checkout.');
