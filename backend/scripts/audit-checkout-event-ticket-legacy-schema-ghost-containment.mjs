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
// MORDE se o throw sumir OU se o INSERT em event_tickets (com as colunas fantasma) voltar a
// ficar alcançável ANTES do throw. Heurística textual comment-stripped. Em
// validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FILE = join(ROOT, 'src', 'modules', 'events', 'checkout-ticket.service.ts');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
if (!existsSync(FILE)) {
  failures.push(`arquivo ausente: ${FILE}`);
} else {
  const src = stripTs(readFileSync(FILE, 'utf8'));
  const fnStart = src.indexOf('async purchaseTicket(');
  if (fnStart < 0) {
    failures.push(`${FILE}: purchaseTicket não encontrado.`);
  } else {
    const throwIdx = src.indexOf('CHECKOUT_EVENT_TICKET_LEGACY_SCHEMA_GHOST_CONTAINED', fnStart);
    const insertIdx = src.indexOf('INSERT INTO event_tickets', fnStart);
    if (throwIdx < 0) {
      failures.push(`${FILE}: throw CHECKOUT_EVENT_TICKET_LEGACY_SCHEMA_GHOST_CONTAINED ausente em purchaseTicket — contenção removida.`);
    }
    if (insertIdx >= 0 && (throwIdx < 0 || insertIdx < throwIdx)) {
      failures.push(`${FILE}: INSERT INTO event_tickets fica ANTES (ou sem) o throw de contenção — reabre o schema ghost.`);
    }
  }
}

if (failures.length) {
  console.error('GATE FAIL [checkout-event-ticket-legacy-schema-ghost-containment]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [checkout-event-ticket-legacy-schema-ghost-containment] — purchaseTicket falha honesto ANTES de tocar event_tickets (colunas fantasma); caminho canônico é POST /api/events/:id/checkout.');
