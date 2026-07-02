#!/usr/bin/env node
// Agregador — contenção do reader legado owner_type='service' (DECISION-0156 /
// DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT). Roda os guards das fatias A2/A2b/A2c num único ponto para
// manter a linha do `validate:regression-guards` dentro do limite de comprimento de comando do Windows.
// Cada guard segue executável standalone (usado nos gates individuais). Falha do agregador = falha de qualquer guard.
//
// NOTA DE ESCOPO (honesta): o nome do agregador é histórico (DECISION-0156). Na prática, virou o ponto
// de wiring de guards PEQUENOS que não coubessem em nenhum agregador temático existente — fixes de
// schema (getPost, getPostsBatch, unread-counts) e agora também clareza de UX (actor-mode-surface-
// clarity-slice, Slice 2 do blueprint actor×modo×busca) — mesmo limite de linha do Windows, mesmo
// padrão pragmático. Cada guard permanece standalone e testável isoladamente; o agregador é só o
// ponto único de chamada.

import { execFileSync } from 'child_process';
import { join } from 'path';

const guards = [
  'audit-legacy-service-availability-reader-containment.mjs',   // A2 — discover availability_summary
  'audit-legacy-service-availability-endpoint-containment.mjs', // A2b — GET público /services/:id/availability
  'audit-legacy-service-availability-feed-badge-containment.mjs', // A2c — service-feed badge/BOOK
  'audit-discovery-has-availability-canonical-filter.mjs',        // A2d — filtro has_availability canônico
  'audit-provider-availability-readers-canonical.mjs',            // A2e — readers do prestador (R4/R5)
  'audit-event-rfq-legacy-availability-antirevival-guard.mjs',    // RFQ — writer legado rfq_accept congelado
  'audit-service-feed-getpost-column-fix.mjs',                    // getPost — WHERE id=$1; A2c continua intacto
  'audit-core-feed-batch-post-id-column-fix.mjs',                 // getPostsBatch + renderBatch — id AS post_id; intent via LEGACY_INTENT_MAP
  'audit-unread-counts-feed-visibility-fix.mjs',                  // unread-counts feed/social — predicado vivo, sem visibility fantasma
  'audit-actor-mode-surface-clarity-slice.mjs',                   // Slice 2 — pílula quem×modo + dono do extrato + PROFILE_CHANNEL contido
  'audit-actor-available-group-coverage.mjs',                     // findAvailableActors lista grupos (membership real, tenant-scoped, active)
  'audit-company-agenda-real-wiring.mjs',                         // agenda de empresa materializa de verdade (ownerType=page), não só metadado decorativo
  'audit-getcompany-response-unwrap-fix.mjs',                     // getCompany desembrulha .data (bug pré-existente: companyId sempre undefined)
];

let failed = false;
for (const g of guards) {
  try {
    execFileSync(process.execPath, [join('scripts', g)], { stdio: 'inherit', cwd: process.cwd() });
  } catch {
    failed = true; // o próprio guard já imprimiu GATE FAIL + detalhe
  }
}

if (failed) {
  console.error('GATE FAIL [legacy-service-availability-containment-suite] — ao menos um guard de contenção legada falhou (ver acima).');
  process.exit(1);
}
console.log('GATE OK [legacy-service-availability-containment-suite] — reader (A2) + endpoint (A2b) + feed badge (A2c) + discovery filter (A2d) + provider readers (A2e) + writer RFQ anti-reativação + getPost/getPostsBatch/unread-counts column fixes + actor-mode surface clarity + group coverage + company agenda real wiring + getCompany unwrap fix blindados.');
