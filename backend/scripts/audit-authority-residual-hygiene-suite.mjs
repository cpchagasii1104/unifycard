#!/usr/bin/env node
// Agregador — resíduos de autoridade DECISION-0113 (hint do cliente nunca é autoridade; subject server-side).
// Roda os guards das fatias B1/B3 num único ponto para manter a linha do `validate:regression-guards` dentro
// do limite de comprimento de comando do Windows ("Linha de comando muito longa"). Cada guard segue
// executável standalone (usado nos gates individuais). Falha do agregador = falha de qualquer guard.

import { execFileSync } from 'child_process';
import { join } from 'path';

const guards = [
  'audit-cultural-checkin-target-authority.mjs',        // B1 — check-in cultural: target self/representável
  'audit-social-actors-available-self-anchored.mjs',    // B3 — /actors/available ancorado no principal
  'audit-cultural-checkin-target-actor-type-derived.mjs', // actor_type do check-in sempre derivado server-side (não do body)
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
  console.error('GATE FAIL [authority-residual-hygiene-suite] — ao menos um guard de resíduo de autoridade falhou (ver acima).');
  process.exit(1);
}
console.log('GATE OK [authority-residual-hygiene-suite] — check-in cultural (B1) + actors/available self-anchored (B3) + actor_type derivado server-side blindados.');
