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
  'audit-company-metadata-ghost-cleanup.mjs',                     // updateCompany não escreve companies.metadata (coluna inexistente, 42703 latente)
  'audit-cbo-matcher-dormant-landmine-removal.mjs',                // cbo-matcher removido (occupations_reference nunca existiu, wiring morto)
  'audit-category-input-audit-schema-ghost-fix.mjs',               // category_input_audit aplicada sem reviver occupations_reference
  'audit-hobby-matcher-dirname-esm-fix.mjs',                       // hobby-matcher sem __dirname (crash sob tsx/ESM), dataset self-contained
  'audit-catalog-rls-scoped-isolation.mjs',                        // canonical_services/canonical_catalog_events RLS scoped isolation + admin-bypass
  'audit-service-discovery-future-availability-slice-b.mjs',       // discoverServices liga D2+D3 (SSOT canônico); frontend manda starts_at/ends_at
  'audit-service-booking-requested-effect-emission.mjs',           // SERVICE_BOOKING_REQUESTED emitido no create booking, alvo=resolveAvailabilityOwner
  'audit-availability-conflict-detection-materialized.mjs',        // detect_availability_conflicts() materializada (overlap real, owner_type=user)
  'audit-crm-myorders-route-prefix-contract.mjs',                   // achado B5 auditoria.md: api/crm.ts -> /marketplace/crm/*, api/my-orders.ts -> /api/my-orders*
  'audit-payment-intents-governance-funding-rls.mjs',               // achado B3 auditoria.md: RLS+FORCE em payment_intents + governance_funding_commitments
  'audit-group-a-financial-tables-rls.mjs',                         // achado B3 (varredura colateral): RLS+FORCE em 15 tabelas financeiras Grupo A
  'audit-guc-tenant-context-transaction-scope-fix.mjs',              // GUC tenant/admin sobrevive à query real (is_local=false), achado colateral do B3
  'audit-group-b-financial-workers-tenant-loop-rls.mjs',             // DECISION-0149: 4 workers financeiros ativos em tenant-loop + RLS nas 6 tabelas Grupo B
  'audit-guc-cross-context-reset-on-reuse.mjs',                       // achados A1+A2 da re-auditoria: GUC não vaza entre usos da mesma conexão pooled
  'audit-event-settlement-ghost-containment.mjs',                     // achado B2: 3 superfícies de event_settlements (ghost) fail-closed; materializar = PORTA-1
  'audit-rides-financial-firewall.mjs',                               // achado B1: rides money com firewall runtime default-off, gate duplo (sink+caller)
  'audit-actor-type-vocabulary-freeze.mjs',                           // achado B6 / DECISION-0157 (D-C2): congela vocabulário actor_type (nenhum writer legado novo)
  'audit-event-reservations-mislabeled-fk-containment.mjs',           // achado B7 (parte c): FK que mentia (event_reservations.global_user_id→actors) dropada; código usa actor_id
  'audit-search-omni-federation-contract.mjs',                        // F-GLOBAL-SEARCH-OMNI: omnibox federado — anti-PII, vocabulário canônico, coerência (readers canônicos), piso de discovery
  'audit-rental-resource-surface-contract.mjs',                       // F-RENTAL-RESOURCE-SURFACE-SLICE-A (DECISION-0151/0159): owner server-side, money-free, availability genérico intacto
  'audit-public-profile-discovery-contract.mjs',                      // F-DISCOVERY-PUBLIC-PROFILE-SLICE-A: vitrine cross-tenant só plaquinha public, anti-PII, canRepresentActor, dedupe local-vence
  'audit-event-lifecycle-authority.mjs',                              // V1 (auditoria forense): BOLA/IDOR no lifecycle de eventos fechado — resolveRepresentedActor prova canRepresentActor, resolvedor fraco morto
  'audit-company-activation-kyc-gate.mjs',                            // F-CNPJ-ACTIVATE-KYC-GATE (AUTHORITY_LAW Art.4.2): ativar empresa (controlar CNPJ) exige KYC mínimo do responsável
  'audit-actor-impersonation-writes.mjs',                             // triagem handler-level: identity /update (BOLA civil) + social reactions/comments + feed /action provam representação (0113)
  'audit-delegation-scope-containment.mjs',                           // DT-AUTHORITY-LATENTS-PASSO-3 ①: canRepresentActor por delegação exige escopo FULL (*); escopada não concede representação em branco
  'measure-handler-authority-gap.mjs',                                // GATE baseline-ratchet (fix G1 YALA #2): handler de mutação novo com canal client-declared sem binding, fora do baseline triado, MORDE
  // ⚠️ EXCEÇÃO de custo (achado B4 / DECISION-0158): este NÃO é guard pequeno — roda tsc (tsconfig.build)
  // + os 2 validadores financeiros (~60-90s). Entrou aqui porque a cadeia validate:regression-guards
  // estourou o limite de linha de comando do Windows ao ser estendida diretamente. O custo é o preço
  // de fechar o ponto cego institucional do B4 (pipeline verde sem enxergar os gates vermelhos).
  'audit-red-gates-baseline.mjs',                                     // achado B4 / DECISION-0158: baseline-ratchet (typecheck 0 + vocabulary/ssot só-desce)
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
console.log('GATE OK [legacy-service-availability-containment-suite] — reader (A2) + endpoint (A2b) + feed badge (A2c) + discovery filter (A2d) + provider readers (A2e) + writer RFQ anti-reativação + getPost/getPostsBatch/unread-counts column fixes + actor-mode surface clarity + group coverage + company agenda real wiring + getCompany unwrap fix + company metadata ghost cleanup + cbo-matcher removal + category_input_audit schema ghost fix + hobby-matcher dirname/ESM fix + catalog RLS scoped isolation + discovery future availability (D2+D3) + booking requested effect emission (D4) + availability conflict detection materialized + crm/my-orders route prefix contract (B5) + payment_intents/governance_funding_commitments RLS (B3) + group A financial tables RLS (15 tabelas, B3) + GUC tenant context transaction scope fix + group B financial workers tenant-loop RLS (DECISION-0149) + GUC cross-context reset on reuse (achados A1+A2 re-auditoria) + event_settlements ghost containment (B2, 3 superfícies fail-closed) + rides financial firewall (B1, gate duplo sink+caller) + actor_type vocabulary freeze (B6/D-C2, DECISION-0157) + red-gates baseline-ratchet (B4, DECISION-0158) + event_reservations mislabeled FK dropped (B7 parte c) blindados.');
