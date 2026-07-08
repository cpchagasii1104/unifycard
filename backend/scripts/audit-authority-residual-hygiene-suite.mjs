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
  'audit-l5-frozen-modules-ghost-containment.mjs',        // Lote L5 — venue/work-instant/policy-engine/residence contidos 501 fail-closed (schema ghost)
  'audit-r2-delegation-writer-governed.mjs',              // R2.2 — writer de delegação atômico (delegação+evento na mesma TX); repositório é persistência, não gate
  'audit-composer-contract.mjs',                          // C1 — contrato server-driven do compositor (enumeração server-side, read-only, canRepresentActor, sem dinheiro)
  'audit-governed-vocabulary-manifest.mjs',               // Manifesto de vocabulários governados: anti-drift + anti-paralelo (institucionaliza a lição C1/R2)
  'audit-marketplace-domain-n0-mapping.mjs',                 // L3 — materializacao do mapa DECISION-0106 (MarketplaceDomain->N0)
  'audit-jwt-payload-decode-frontend.mjs',                   // TENANT_ID_REQUIRED — decode de JWT base64url-safe (zero atob solto)
  'audit-rls-policy-guc-canonical.mjs',                      // BLOCKER Yala: policy RLS com GUC nao-canonico = quebra-fechada (classe travada)
  'audit-schema-authority-classification.mjs',              // Trava 1 (Clayton 2026-07-08): carimbo SSOT/read_model/legacy/dead — anti-reativacao de cadaver/verdade-paralela
  'audit-location-authority-classification.mjs',            // Trava 2 (Clayton 2026-07-08): localidade operacional = Location Core; barra nova coluna city/country TEXT + filtro textual
  'audit-rental-hardening-constraints.mjs',                 // Trava 3 (Clayton 2026-07-08): banco blinda overlap de janela macro (EXCLUDE) + quantity>1 so equipment (CHECK); anti-DROP
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
