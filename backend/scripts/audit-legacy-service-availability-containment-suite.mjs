#!/usr/bin/env node
// Agregador — contenção do reader legado owner_type='service' (DECISION-0156 /
// DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT). Roda os guards das fatias A2/A2b/A2c num único ponto para
// manter a linha do `validate:regression-guards` dentro do limite de comprimento de comando do Windows.
// Cada guard segue executável standalone (usado nos gates individuais). Falha do agregador = falha de qualquer guard.

import { execFileSync } from 'child_process';
import { join } from 'path';

const guards = [
  'audit-legacy-service-availability-reader-containment.mjs',   // A2 — discover availability_summary
  'audit-legacy-service-availability-endpoint-containment.mjs', // A2b — GET público /services/:id/availability
  'audit-legacy-service-availability-feed-badge-containment.mjs', // A2c — service-feed badge/BOOK
  'audit-discovery-has-availability-canonical-filter.mjs',        // A2d — filtro has_availability canônico
  'audit-provider-availability-readers-canonical.mjs',            // A2e — readers do prestador (R4/R5)
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
console.log('GATE OK [legacy-service-availability-containment-suite] — reader (A2) + endpoint (A2b) + feed badge (A2c) + discovery filter (A2d) + provider readers (A2e) blindados.');
