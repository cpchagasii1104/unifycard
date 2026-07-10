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
  'audit-bank-split-pipeline-consolidation.mjs',                      // DECISION-0165 (1F): anti-revival dos caminhos financeiros paralelos/legados retirados (p2p/donation/work-split/event/ride sinks/service_booking legado/treasury workers/mortos)
  'audit-policy-immutability-and-split-snapshot.mjs',                 // DECISION-0166 D5 (F1-d): economic_policies/lines imutáveis em active/deprecated (triggers F1-a/F1-b, anti-drop) + bank_splits.policy_version_id/jurisdiction_snapshot com cadeia canônica sem perda de rastro e snapshot sem fabricação
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
  'audit-actor-relationship-boundary.mjs',                            // F-ACTOR-RELATIONSHIP-TYPED-EDGE-SLICE-1: aresta de relação tipada — relação≠autoridade (zero company_users/bank_*), vocabulário governado, canRepresentActor no envio+aceite, ponte suppliers.actor_id sem tocar purchase_orders
  'audit-vehicle-fields-governed.mjs',                             // F-GOVERNED-COMBOBOX-CASCADE (Clayton 2026-07-07): veículo em locação usa cascata governada <VehicleFields> (combobox reabrível + ano via endpoint), zero input livre de marca/modelo/ano; GovernedCombobox genérico
  'audit-audience-single-source.mjs',
  'audit-suppliers-identity-boundary.mjs',                          // F-SUPPLIERS-IDENTITY-BOUNDARY (Clayton 2026-07-07): suppliers nao vira CRM de identidade paralela — ponte actor_id nullable (off-platform ok), name/tax_id nunca fonte de identidade/autoridade/plateia/dinheiro; writer unico                               // F-VISIBILITY-CAPABILITY (Clayton 2026-07-07): FONTE UNICA de plateia — /audience-options deriva de PAIR_ALLOWED_LABELS; post/demanda/evento/locacao consomem (zero hardcode local)
  'audit-demand-orchestration-boundary.mjs',                          // DECISION-0164: motor de demanda — Δbank=0, catraca 0113 1:1 nas rotas, RLS FORCE+GUC canônico, vocabulários da fonte, vaga atômica, anti-double-commit, plateia 0162 na leitura
  'audit-actor-page-contract.mjs',                                    // F-ACTOR-PAGE-SHELL-SLICE-3: contrato server-driven da página do actor — read-model puro, anti-PII, operating=canRepresentActor, buy/contract gated PORTA-1, blocos por probe (nunca hardcoded), frontend renderizador
  'audit-social-post-visibility-read-enforcement.mjs',                // F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5, fecha DT-SOCIAL-POST-VISIBILITY-NOT-ENFORCED-ON-READ): plateia governada (public/connections/only_me) obedecida em getFeed+getActorPosts+getActorCounts via predicado único reusado (actor_relationships aceita); GET /feed actor_id agora exige canRepresentActor (fecha vetor de impersonação de leitura aberto pela própria fatia); viewerActorId sempre server-side
  'audit-support-ticket-business-fact-gate.mjs',                     // F-SUPPORT-TICKET-BUSINESS-FACT-GATE (Fatia 6, fecha DESENHO_PAGINA_DO_ACTOR §5/§5B): Chamado gated por FATO DE NEGOCIO real (orders/service_orders/bookings), nunca por conexao; catraca causal 422 se {from,to} nao batem com as partes reais; zero dinheiro; nao confunde com o dominio disputes (financeiro/reversao)
  'audit-crm-projection-suppliers-reconciliation.mjs',              // F-CRM-PROJECTION-SUPPLIERS-RECONCILIATION (Fatia 7, Opcao B): crm.* (SPRINT 88, ghost sem guard, 42P01 em runtime) REMOVIDO de vez; CRM agora = projecao de actor_relationships + suppliers.actor_id wired (existencia provada fail-closed); contact.* (irmao, genese propria) intocado
  'audit-erp-composed-view.mjs',                                      // F-ERP-COMPOSED-VIEW (Fatia 8): vista integrada estoque+pedidos+agenda+financeiro na pagina do actor (mode=operating, empresa); pedidos via listByOwner escopado em SQL; estoque/agenda reusam blocos ja computados; financeiro SO deeplink (/wallet), nunca saldo no contrato
  'audit-bank-transaction-sink-firewall.mjs',                        // F-BANK-TRANSACTION-SINK-FIREWALL (Fatia 9, passo 2 PORTA-1): firewall default-off NO SINK compartilhado (transfer + createTransactionWithSplit), nao por-caller; protege >=18 callers de producao (P2P/payout/escrow/checkout/PDV/rides/gateway/workers) de uma vez; achado A1/A2 do READINESS_PORTA1.md fechado
  'audit-treasury-split-superseded-antirevival-guard.mjs',           // F-TREASURY-SPLIT-SUPERSEDED-ANTIREVIVAL (Fatia 9 passo 3): treasury-split (2o motor de split, percentuais hardcoded) CONGELADO — sua responsabilidade ja e servida por regional_fund unico (PE-5-RESOLVER-V2 PJ+PF) consumido por regional-fund-governance (democracia direta, comunidade vota o destino)
  'audit-b2b-payment-intent-antirevival-guard.mjs',                    // F-B2B-PAYMENT-INTENT-DEAD-CODE-ANTIREVIVAL (ressalva R1 auditoria Yala): createTransactionFromIntent (bank-ledger.service.ts) escreve fora do sink compartilhado, 100% morto, risco nomeado de reativacao na propria Fatia 9 (orquestracao B2B); congela sem caller novo
  'audit-service-order-confirm-terms-financial-flag-failclosed.mjs',   // F-SERVICE-ORDER-CONFIRM-TERMS-DEFAULT-ON-FLAG-FIX (colateral auditoria Yala): isFinancialEnabled() delegava a helper generico fail-open, contido so por acidente de tipo (transactionId nao-UUID); agora fail-closed real (=== 'true' exato)
  'audit-regional-fund-pf-resolver.mjs',                              // F-REGIONAL-FUND-PF-RESOLVER (Fatia 9 passo 3, fecha DT-PE5-PF-RESOLVER-PENDING): payer/receiver_identity_residence resolvem de verdade via address_assignments(owner_type='profile', role='RESIDENCE'), mesmo SSOT de DECISION-0074; sem residencia continua fail-closed (POLICY_REGIONAL_ORIGIN_UNRESOLVABLE)
  'audit-regional-fund-governance-schema-ghost-containment.mjs',        // F-REGIONAL-FUND-GOVERNANCE-SCHEMA-GHOST-CONTAINMENT (achado colateral Fatia 9 passo 3): regional-fund-governance.routes.ts estava viva+sem guard lendo regional_fund_proposals/votes inexistentes; contida na borda (501, mesmo padrao contact.routes.ts); logica de votacao intocada, religa quando o schema nascer
  'audit-regional-fund-legacy-credit-antirevival-guard.mjs',           // F-REGIONAL-FUND-LEGACY-CREDIT-ANTIREVIVAL (Onda 1 zeragem de DT, reclassificacao de DT-REGIONAL-FUNDS-TOTAL-BALANCE-CENTS-DEPRECATION): recordRegionalFundCredit (2o mecanismo de contabilidade paralelo ao bank_ledger) confirmado morto nos 2 caminhos conhecidos (MarketplaceTerminalModule nunca importado; agregador nunca chamado pela facade/rota); congelado, nao apagado
  'audit-user-group-allocations-silent-call-fix.mjs',                   // F-USER-GROUP-ALLOCATIONS-SILENT-CALL-CLEANUP (Onda 1 zeragem de DT): findByUserId (bank-split-engine.service.ts) engolia QUALQUER erro (tabela ausente/DB caido/permissao negada) num catch mudo; agora probe explicito to_regclass distingue tabela-ausente (log 1x) de erro real (propaga)
  'audit-helpers-dual-implementation-unified.mjs',                      // F-HELPERS-DUAL-IMPLEMENTATION-DRIFT (Onda 1 zeragem de DT): core/db.ts::runQueryWithTenant era implementacao propria duplicada de core/database/pool.ts (sem sanitizacao undefined->null nem log estruturado de erro); agora delega pra pool.ts, 44 callers de @core/db ganham as 2 protecoes sem mudar import
  'audit-available-actor-user-id-misuse.mjs',                           // F-AVAILABLE-ACTOR-USER-ID-CONFUSION-RISK (Onda 1 zeragem de DT): AvailableActor.user_id e NULL pra actor_type='page'/'group' (so 'user' tem); 2 wizards (onboarding empresa + evento) gravavam activeActor?.user_id num campo completedBy persistido de verdade, ficando vazio no cenario mais comum (empresa). Corrigido pra .actor_id (sempre populado)
  'audit-checkout-event-ticket-legacy-schema-ghost-containment.mjs',    // F-CHECKOUT-EVENT-TICKET-LEGACY-INSERT-SCHEMA-GHOST-CONTAINMENT (Onda 1 zeragem de DT, correcao apos feedback "verdade esta no backend"): purchaseTicket fazia INSERT em event_tickets com colunas que nunca existiram (schema fantasma); rota POST /checkout/event-ticket seguia montada sem firewall, garantia dependia so do frontend nao chamar mais. Contido NO BACKEND: throw honesto antes de qualquer SQL
  'audit-circuit-breaker-tenant-context-fix.mjs',                       // DT-CIRCUIT-BREAKER-RAW-POOL-QUERY-FAIL-OPEN-UNDER-RLS (D_FIX Onda 2, achado A3 2026-07-02): isBreakerActive lia financial_circuit_breakers via pool.query cru sem tenant-context; sob RLS+FORCE a leitura sempre retornaria 0 linhas, fail-open perigoso (pagamentos/payouts nao pausariam quando deveriam). Corrigido pra runQueryWithTenant
  'audit-raw-pool-rls-access-stale-guc-fix.mjs',                        // DT-RAW-POOL-RLS-ACCESS-INHERITS-STALE-GUC (achado N4, D_FIX Onda 2): actor-bank-destination.service.ts (6 call sites) e product-offering.service.ts::updateOwnOffer (product_offers, RLS+FORCE) usavam pool cru; UPDATE sem RETURNING podia ser no-op silencioso sob GUC stale. Corrigido pra runQueryWithTenant/runQueriesWithTenant + RETURNING id
  'audit-subscriptions-run-due-http-containment.mjs',                   // F-FINANCIAL-INTERNAL-SURFACES-P1-CONTAINMENT, subscriptions (achado V3 da verificacao do parecer sobre a re-auditoria Yala, 2026-07-05): POST /subscriptions/run-due tinha comentario "admin/internal" mas ZERO checagem de auth, alcancava executePayment no branch REAL (nunca seta payment_method_snapshot). Mesmo padrao ja aplicado em automation/schedule/run-due, replicado: 403 fail-closed
  'audit-venue-pay-money-hold-containment.mjs',                         // F-VENUE-PAY-MONEY-HOLD-CONTAINMENT (achado V3 da verificacao do parecer sobre a re-auditoria Yala, 2026-07-05): POST /t/:qrToken/orders/:orderId/pay e rota PUBLICA sem auth alcancando executePayment sem nenhum firewall default-off (diferente do PDV, mesmo sink). Corrigido: mesmo padrao assertVenueFinancialRuntimeEnabled
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
