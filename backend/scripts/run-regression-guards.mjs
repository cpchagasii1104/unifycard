#!/usr/bin/env node
// Runner de validate:regression-guards — a corrente '&&' inline estourou o limite de linha do cmd.exe
// (Windows ~8191 chars). Roda os mesmos guards em sequência, falhando no PRIMEIRO erro (mesma semântica).
// Adicionar guard novo = uma linha aqui, sem risco de estourar a linha de comando. F-OFFER-KIND-SERVICE-GATE.
import { spawnSync } from 'child_process';
const CMDS = [
  "tsx scripts/guard-financial-regression.ts",
  "tsx scripts/sql-regression-lint.ts",
  "node scripts/check-migration-numbering.js",
  "node scripts/audit-inventory-reader-scope.mjs",
  "node scripts/audit-register-birth-atomicity.mjs",
  "node scripts/audit-c1-auto-reachable-read-purity.mjs",
  "node scripts/audit-c1-human-journey-closure.mjs",
  "node scripts/audit-pj-human-to-company-closure.mjs",
  "node scripts/audit-canonical-catalog-closure.mjs",
  "node scripts/audit-availability-owner-authority.mjs",
  "node scripts/audit-migration-runner-isolation.mjs",
  "node scripts/audit-official-database-lock.mjs",
  "node scripts/audit-auth-rate-limit-substrate.mjs",
  "node scripts/audit-environment-rule-enforcement.mjs",
  "node scripts/audit-actor-authority-boundary.mjs",
  "node scripts/audit-booking-order-authority-binding.mjs",
  "node scripts/audit-internal-surfaces-containment.mjs",
  "node scripts/audit-financial-approval-core-boundary.mjs",
  "node scripts/audit-bank-http-authority-binding.mjs",
  "node scripts/audit-payout-authority-binding.mjs",
  "node scripts/audit-financial-workers-dormancy.mjs",
  "node scripts/audit-payout-execution-seal.mjs",
  "node scripts/audit-payout-worker-system-only.mjs",
  "node scripts/audit-payout-request-only-entrypoint.mjs",
  "node scripts/audit-payout-approve-endpoint.mjs",
  "node scripts/audit-dashboard-metrics-tenant-scope.mjs",
  "node scripts/audit-rbac-stub-and-tombstones.mjs",
  "node scripts/audit-event-economic-authority-binding.mjs",
  "node scripts/audit-role-as-authority-containment.mjs",
  "node scripts/audit-social-work-payment-ownership.mjs",
  "node scripts/audit-pdv-authority-lock.mjs",
  "node scripts/audit-groups-mine-auth-derived.mjs",
  "node scripts/audit-reversal-containment.mjs",
  "node scripts/audit-temporal-legacy-tombstone.mjs",
  "node scripts/audit-spr-read-authority.mjs",
  "node scripts/audit-po-receive-containment.mjs",
  "node scripts/audit-po-owner-authority.mjs",
  "node scripts/audit-temporal-purpose.mjs",
  "node scripts/audit-contacts-schema-ghost-containment.mjs",
  "node scripts/audit-supplier-owner-authority.mjs",
  "node scripts/audit-service-order-write-authorship-binding.mjs",
  "node scripts/audit-service-bundle-write-authorship-binding.mjs",
  "node scripts/audit-votes-writes-containment.mjs",
  "node scripts/audit-contextual-thread-schema-ghost-containment.mjs",
  "node scripts/audit-organization-schema-ghost-containment.mjs",
  "node scripts/audit-actor-capability-grants-nonfinancial.mjs",
  "node scripts/audit-service-payment-amount-cents.mjs",
  "node scripts/audit-service-money-07-nomenclature.mjs",
  "node scripts/audit-actor-referral-actor-scoped.mjs",
  "node scripts/audit-groups-no-actioncontext-owner-bypass.mjs",
  "node scripts/audit-dashboard-actor-filter-requires-representation.mjs",
  "node scripts/audit-reports-actor-filter-requires-representation.mjs",
  "node scripts/audit-intent-execute-buyer-actor-binding.mjs",
  "node scripts/audit-marketplace-money-latent-containment.mjs",
  "node scripts/audit-services-actor-binding.mjs",
  "node scripts/audit-social-posts-actor-binding.mjs",
  "node scripts/audit-referral-register-actor-code-gate.mjs",
  "node scripts/audit-event-rfq-actor-binding.mjs",
  "node scripts/audit-event-rfq-acceptquote-containment.mjs",
  "node scripts/audit-social-legacy-post-create-containment.mjs",
  "node scripts/audit-profile-c1-actor-binding.mjs",
  "node scripts/audit-system-notification-schema-ghost-containment.mjs",
  "node scripts/audit-social-marketplace-ref-schema-ghost-containment.mjs",
  "node scripts/audit-canal1-ghost-wave-r8e-containment.mjs",
  "node scripts/audit-plan-self-bound.mjs",
  "node scripts/audit-feed-plugin-not-authority.mjs",
  "node scripts/audit-ap-ar-reactivation-trap.mjs",
  "node scripts/audit-services-discovery-direct-pay-containment.mjs",
  "node scripts/audit-organizer-billing-ghost-containment.mjs",
  "node scripts/audit-store-onboarding-actor-bind.mjs",
  "node scripts/audit-business-authorization-read-authority.mjs",
  "node scripts/audit-automation-human-mvp-ghost-containment.mjs",
  "node scripts/audit-organizers-actor-authority-bind.mjs",
  "node scripts/audit-services-discovery-actor-bind.mjs",
  "node scripts/audit-unifycard-method-money-containment.mjs",
  "node scripts/audit-safe-subject-form-c-dedicated-guards.mjs",
  "node scripts/audit-unifycard-fee-bps-consumer.mjs",
  "node scripts/audit-bank-ledger-boundaries.mjs",
  "node scripts/audit-payout-e2e-ephemeral-guard.mjs",
  "node scripts/audit-db-role-rls-hardening.mjs",
  "node scripts/audit-payout-toctou-safety.mjs",
  "node scripts/audit-assign-skill-ghost-containment.mjs",
  "node scripts/audit-service-concept-mandatory-fk-restrict.mjs",
  "node scripts/audit-createservice-eligibility.mjs",
  "node scripts/audit-musical-performance-concept-governed.mjs",
  "node scripts/audit-offering-genre-facet-governed.mjs",
  "node scripts/audit-offering-equipment-facet-governed.mjs",
  "node scripts/audit-service-offering-contracting-policy.mjs",
  // F-ORCHESTRATED-CONTRACTING (C3) — fecha o loop propose→accept→BIND: booking de service_offering confirmado
  // com metadata.eventId vincula o PERFORMER (provider derivado server-side, nunca o requester) ao elenco via o
  // writer SELADO createCommitment. Bind IDEMPOTENTE, NÃO-CRÍTICO (try/catch no chokepoint ÚNICO), síncrono
  // (anti-hollow/trap F4 — sem outbox oco), sem spine/writer paralelo; EDGE C-1 carrega contexto com autoridade
  // de evento (canActAs manage_attendees) reusada; Bank-free (porta-01 FORA).
  "node scripts/audit-performer-event-binding.mjs",
  "node scripts/audit-offering-audience-range.mjs",
  "node scripts/audit-event-staff-commitment-contract.mjs",
  "node scripts/audit-event-staff-single-writer.mjs",
  "node scripts/audit-event-single-writer.mjs",
  "node scripts/audit-event-group-binding-authority.mjs",
  "node scripts/audit-service-offering-binding.mjs",
  "node scripts/audit-discovery-concept-rekey.mjs",
  "node scripts/audit-booking-provider-conflict.mjs",
  "node scripts/audit-internal-financial-authority-containment.mjs",
  "node scripts/audit-offering-activation-safe.mjs",
  "node scripts/audit-checkout-financial-containment.mjs",
  "node scripts/audit-booking-caller-authority.mjs",
  "node scripts/audit-fee-bps-ssot.mjs",
  "node scripts/audit-bank-splits-append-only.mjs",
  "node scripts/audit-rls-tenant-context.mjs",
  "node scripts/audit-internal-route-registration-classified.mjs",
  "node scripts/audit-civil-lock-identity-authority.mjs",
  "node scripts/audit-marketplace-concept-no-category-fallback.mjs",
  "node scripts/audit-onboarding-not-backend-gate.mjs",
  "node scripts/audit-subscription-billing-quarantined.mjs",
  "node scripts/audit-company-readiness-shared-predicate.mjs",
  "node scripts/audit-rental-resource-substrate.mjs",
  "node scripts/audit-referral-cascade-model.mjs",
  "node scripts/audit-ssot-admin-tenant-bound.mjs",
  "node scripts/audit-rls-enable-implies-force.mjs",
  "node scripts/audit-events-sprint76-actor-authority.mjs",
  "node scripts/audit-concept-coverage-financial.mjs",
  "node scripts/audit-webhook-resolver-idempotency.mjs",
  "node scripts/audit-groups-votes-schema-drift.mjs",
  "node scripts/audit-economic-activity-suggestion-readonly.mjs",
  "node scripts/audit-pdv-pay-financial-containment.mjs",
  "node scripts/audit-bank-lock-boundary.mjs",
  "node scripts/audit-register-cpf-claim.mjs",
  "node scripts/audit-event-settlement-financial-containment.mjs",
  "node scripts/audit-reports-transfers-sla-representation.mjs",
  "node scripts/audit-capability-grant-quarantine.mjs",
  "node scripts/audit-company-activation-quarantine.mjs",
  "node scripts/audit-availability-quarantine-gate.mjs",
  "node scripts/audit-service-booking-decision-quarantine-gate.mjs",
  "node scripts/audit-service-mutations-quarantine-gate.mjs",
  "node scripts/audit-payment-method-quarantine-gate.mjs",
  "node scripts/audit-purchase-order-supplier-quarantine-gate.mjs",
  "node scripts/audit-social-post-intent-quarantine-gate.mjs",
  "node scripts/audit-groups-votes-post-intent-quarantine-gate.mjs",
  "node scripts/audit-groups-votes-closevote-quarantine-gate.mjs",
  "node scripts/audit-groups-votes-post-insert-schema-aligned.mjs",
  "node scripts/audit-events-lifecycle-quarantine-gate.mjs",
  "node scripts/audit-event-rfq-declarative-quarantine-gate.mjs",
  "node scripts/audit-event-rfq-dispatch-quarantine-gate.mjs",
  "node scripts/audit-events-session-checkin-schema-drift.mjs",
  "node scripts/audit-events-assignstaff-sessionread-schema-drift.mjs",
  "node scripts/audit-events-reputation-locations-ghost-containment.mjs",
  "node scripts/audit-service-order-inbox-auto-emit.mjs",
  "node scripts/audit-operator-service-order-view-grant.mjs",
  "node scripts/audit-service-order-direct-create-dead-end-sweep.mjs",
  "node scripts/audit-disputes-frontend-honest-containment.mjs",
  "node scripts/audit-operator-service-order-view-grant-frontend.mjs",
  "node scripts/audit-mvp-offering-availability-canonical-frontend.mjs",
  "node scripts/audit-product-offer-actor-company-bind.mjs",
  "node scripts/audit-product-publish-pj-only.mjs",
  "node scripts/audit-rides-money-antirevival-guard.mjs",
  "node scripts/audit-rides-operational-schema-ghost-containment.mjs",
  "node scripts/audit-product-scope-containment.mjs",
  "node scripts/audit-service-search-alias-discovery.mjs",
  "node scripts/audit-service-discovery-firm-price-no-artificial-fallback.mjs",
  "node scripts/audit-service-order-confirm-canonical-lock.mjs",
  "node scripts/audit-legacy-service-availability-containment-suite.mjs",
  "node scripts/audit-global-search-deadend-rewire-frontend.mjs",
  "node scripts/audit-authority-residual-hygiene-suite.mjs",
  "node scripts/audit-offer-kind-service-gate.mjs",
  "node scripts/audit-anti-hardcode-event-orchestration.mjs",
  "node scripts/audit-shared-subject-pool.mjs",
  "node scripts/audit-event-orchestration-templates.mjs",
  "node scripts/audit-asset-foundation.mjs",
  "node scripts/audit-asset-rls-hardening.mjs",
  "node scripts/audit-asset-rental-convergence.mjs",
  "node scripts/audit-asset-sale-convergence.mjs",
  "node scripts/audit-asset-service-use-convergence.mjs",
  "node scripts/audit-fiscal-tax-catalog.mjs",
  "node scripts/audit-segment-fiscal-template.mjs",
  "node scripts/audit-severity-priority-canonical-vocabulary.mjs",
  "node scripts/audit-neighborhood-freetext-writer-containment.mjs",
  "node scripts/audit-neighborhood-dml-hold.mjs",
  "node scripts/audit-neighborhood-core-foundation.mjs",
  "node scripts/audit-neighborhood-alias-foundation.mjs",
  "node scripts/audit-neighborhood-succession-foundation.mjs",
  "node scripts/audit-territorial-capability-grant-foundation.mjs",
  "node scripts/audit-territorial-capability-grant-lifecycle.mjs",
  "node scripts/audit-actor-user-anchor-uniqueness.mjs",
  "node scripts/audit-actor-capability-grant-tenant-coherence.mjs",
  "node scripts/audit-territorial-capability-resolver.mjs",
  "node scripts/audit-neighborhood-canonical-writer.mjs",
  "node scripts/audit-addresses-neighborhood-composite-coherence.mjs",
  "node scripts/audit-repository-dependency-hygiene.mjs",
  "node scripts/audit-neighborhood-integrated-composition.mjs",
  "node scripts/audit-territorial-grant-bootstrap.mjs",
  "node scripts/audit-neighborhood-reader-vigency.mjs",
  "node scripts/audit-n3-curitiba-catalog.mjs",
  "node scripts/audit-actor-territorial-assignment-foundation.mjs",
  "node scripts/audit-actor-territorial-address-writer.mjs",
  "node scripts/audit-postal-resolution-canonical-boundary.mjs",
  "node scripts/audit-fixture-cleanup-territorial-manifest.mjs",
  "node scripts/audit-actor-onboarding-address-flow.mjs",
  "node scripts/audit-porta-territory-aliases.mjs",
  "node scripts/audit-curitiba-neighborhood-alias-first.mjs",
  "node scripts/audit-social-territory-city-audience.mjs",
  "node scripts/audit-regional-fund-fk-canonical.mjs",
  "node scripts/audit-policy-immutability-and-split-snapshot.mjs",
  "node scripts/audit-bank-split-pipeline-consolidation.mjs",
  // Tripwire GATE read-only (sessão 2026-07-27): o motor LEGADO bank-split-engine.service.ts
  // segue de pé (deleção de módulo pré-existente = decisão própria, fora de escopo) mas contido —
  // event_ticket/ride_payment/service_booking creditariam fundo NACIONAL único (getSystemAccount)
  // sem território, ao contrário do canônico PE-3 (regional_fund_accounts). Só group_contribution
  // é caller ratificado vivo; qualquer novo caminho de produção pro motor = FAIL fechado.
  "node scripts/audit-bank-split-engine-context-containment.mjs",
  "node scripts/audit-bank-city-curitiba-foundation.mjs",
  "node scripts/audit-fiscal-provision-engine.mjs",
  "node scripts/audit-fiscal-economic-policy-composition.mjs",
  // F-REGIONAL-FUND-PUBLISH-TIME-CONTAINMENT (2026-07-27): o resolver de pagamento
  // (resolveRegionalFundDestination, byte-pinned pelo guard acima) rejeita 3/7 valores de
  // regionalOriginBasis e segura (HOLD) o nível neighborhood — sem este guard, a declaração
  // guard-policiada REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP/REGIONAL_FUND_LEVEL_RESOLVABLE_MVP
  // (economic-policy.types.ts) poderia divergir do resolver em silêncio e reabrir o buraco
  // "policy publicável garantida a falhar quando o dinheiro se move".
  "node scripts/audit-regional-fund-resolvable-basis-declaration.mjs",
  "node scripts/audit-fiscal-tax-reserve-bank-substrate.mjs",
  "node scripts/audit-b-city-regional-treasury-grant-substrate.mjs",
  "node scripts/audit-group-institutional-binding.mjs",
  "node scripts/audit-group-actor-membership-foundation.mjs",
  "node scripts/audit-group-membership-cutover.mjs",
  "node scripts/audit-invoicing-no-hardcoded-tax.mjs",
  "node scripts/audit-regional-fund-contract.mjs",
  "node scripts/audit-unifybank-no-direct-ledger-sql.mjs",
  "node scripts/audit-company-access-authority-foundation.mjs",
  "node scripts/audit-actor-capabilities-not-decisor.mjs",
  "node scripts/audit-event-feed-exact-permission.mjs",
  "node scripts/audit-porta01-financial-hold.mjs",
  "node scripts/audit-exclusivity-isolation-guard.mjs",
  "node scripts/audit-generic-reactions-containment.mjs",
  "node scripts/audit-reporting-risk-financial-hold.mjs",
  // FATIA 1 arco fundação eventos — banda como grupo-actor provider (COLETIVO): ramo de elegibilidade
  // + âncora civil no gate de ativação + comentários de base decisória (DECISION-0144/0147 estendidas).
  "node scripts/audit-band-group-actor-eligibility.mjs",
  // FATIA 3 arco fundação eventos — cardápio de CONFIGS com line-up opcional: line-up governado
  // (grupo-provider + membership ATIVA + identidade=PESSOA/member_actor_id), piso team_size nos 2 lados,
  // fronteira Bank-free das tabelas de config, zero acoplamento nos writers selados de membership.
  "node scripts/audit-offering-config-lineup.mjs",
  // FATIA 4 arco fundação eventos (A ÚLTIMA) — aviso SUAVE de conflito de agenda POR PESSOA
  // (cross-membership) no confirm: hook NÃO-CRÍTICO após o hard-lock, predicado meio-aberto/
  // bloqueantes/self-excluído, derivação por memberships ativas (zero agenda materializada — §2),
  // sink OP-2 = event_outbox (dedup determinístico), zero referência aos ghosts notify/system_notifications.
  "node scripts/audit-booking-soft-conflict.mjs",
  // FATIA PREÇO arco fundação eventos — GRADE DE PREÇO por CONFIG (dia-da-semana × período) com resolução
  // em cascata "a partir de" de 3 níveis (célula → configs.default_price_cents → offerings.price_cents SELADA).
  // Preço = catálogo DECLARADO (price_cents/priceCents, Δbank=0, porta-01 FORA); dia 1-7 + período por CHECK;
  // config precificada em soft-retire (FK RESTRICT); sem 4ª verdade de preço; fronteira Bank-free.
  "node scripts/audit-offering-config-price-grid.mjs",
  // SLICE S1 (VAQUINHA RULES) do arco "evento em si" — regras DECLARADAS da vaquinha (all-or-nothing) na
  // linha events: META = min_attendees (PESSOAS, Δbank=0, NUNCA cents/funding_goal_cents) + PRAZO
  // funding_deadline_at (≠ datetime_end) + is_all_or_nothing (prefixo canônico is_). CHECKs físicos
  // "exige META" / "prazo <= início" / acoplamento a contribuicao_opcional + espelhos 400 no writer.
  // Movimentação de dinheiro (promessa/estorno) = PORTA-01, FORA.
  "node scripts/audit-vaquinha-funding-rules.mjs",
  // SLICE S2 (VENUE ENRICHMENT) do arco "evento em si" — trava de NOMEAÇÃO (§2): o local do evento REUTILIZA
  // o vocabulário canônico (events.metadata.location_name + addresses.street/number/complement + role
  // 'OPERATIONAL' + events.max_attendees), NUNCA cunha sinônimo. Morde se nascer coluna venue_name/place_name
  // OU coluna events.location_name OU capacidade nova em events/addresses OU role 'VENUE'. Bank-free (Δbank=0).
  "node scripts/audit-venue-location-name-ssot.mjs",
  // SLICE S3 (SETORES) do arco "evento em si" — setor SELF-CONTAINED (event_sectors) com pool COMPARTILHADO
  // (capacity) + preço INTEIRA + preço MEIA legalmente pisado. Morde se (a) a CHECK do piso legal
  // (meia_quota_bps BETWEEN 4000 AND 10000 = 40%–100%, Lei 12.933/2013 + Decreto 8.537/2015) for perdida/
  // enfraquecida; (b) nascer coluna sinônimo (setor/sector_capacity/meia_capacity/quota_pct) OU write-path
  // à JSONB event_occupancy_models.config.sectors; (c) token bank/porta-01/ledger/venda no caminho do setor
  // (_cents é DECLARADO, permitido); (d) o writer perder a reconciliação com max_attendees ou o espelho do piso.
  "node scripts/audit-event-sector-meia-floor.mjs",
  // DECISION-0189C C1: o runner passa a INCLUIR o gate financeiro (financial-ssot/vocabulary +
  // typecheck do gate) — o "verde" do runner deixa de mentir (o script infrator elevava 591→592
  // sem o runner acusar). Baseline só-desce (DECISION-0158); nunca sobe para 592.
  "node scripts/audit-red-gates-baseline.mjs",
  // F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT (DECISION-0190 §4/§9, SELADA · VEREDITO A): as 8 rotas
  // mandatadas (custody/split/payment-authorize/payment-execute/payment-revoke/refund/chargeback/
  // chargeback-resolve) sob economic/v2 devolvem 501 EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED
  // como PRIMEIRA instrução do handler, ANTES de qualquer service/side-effect (writer real do Bank fica
  // inalcançável). Morde regressão do 501, contenção movida pra depois de um await, citação DECISION-0190
  // removida, drift no universo de sub-rotas, ou over-broadening nas 3 rotas fora do mapa (advance/GETs).
  "node scripts/audit-economic-v2-containment.mjs",
  // FATIA 0 (frente economic-policy, MATERIAL) — economic_policies convergiu os seletores
  // territoriais de TEXTO livre (country/region/city) para o Location Core governado
  // (country_id/state_id/city_id, FKs simples + compostas hierárquicas MATERIAL mirror de
  // regional_fund_accounts, ON DELETE SET NULL). country/region/city TEXT ficam DEPRECATED
  // (COMMENT ON COLUMN, não dropados — Lei 4). Morde regressão de specificity por TEXT, FK
  // composta perdida/enfraquecida, ON DELETE virando CASCADE/RESTRICT, fail-closed perdido, ou
  // category_id virando concept_id (boundary DECISION-0048). Bank-free (Δbank=0).
  "node scripts/audit-economic-policy-territorial-coherence.mjs",
  // F-ECONOMIC-POLICY-ADMIN-FRONT FATIA 1 (authority key + read-only consumer) — a chave
  // economic_policy:manage autoriza DEFINIR/LER a regra de split (economic_policies/
  // economic_policy_lines), NUNCA mover dinheiro (DECISION-0166 D6). Morde: (a) a chave entrar em
  // PORTA_HOLD_KEYS; (b) a chave e um token de writer do Bank no mesmo arquivo (fronteira RULE≠MONEY);
  // (c) a rota admin perder requireRole(['admin'])/gate da chave, ou ler tenant de query/body; (d)
  // qualquer rota de escrita (POST/PUT/PATCH/DELETE) na superfície admin de economic-policy, aqui ou
  // gateada por esta chave em qualquer outro arquivo (esta fatia é READ-ONLY; escrita = Fatia 3).
  "node scripts/audit-economic-policy-authority-boundary.mjs",
  // MANDATO CLAYTON (2ª metade — "calcule os centavos, não dê margem pra cento e um por cento"):
  // a 1ª metade (policy lines somam 10000 bps na escrita) já era enforced por
  // assertPolicyLinesValid; esta prova a 2ª metade nunca provada antes — o CÁLCULO conserva
  // centavos EXATOS para qualquer amount/config. Não lexical: importa e EXECUTA
  // economicPolicyEngineService.calculatePolicySplits() real (não reimplementa) contra 96 casos
  // hostis (8 configs × 12 amounts, incluindo as 3 policies legacy_baseline_* semeadas de fato).
  // Roda via tsx (import de módulo .ts). Morde: sum(lines)!==total, linha negativa, linha>total.
  "node --import tsx scripts/audit-economic-policy-split-cent-conservation.mjs",
  // F-QUERY-PARAM-BOUNDARY (2026-07-31, GO Clayton): 4 membros da mesma família achados em 2 dias
  // (service_order_status, ServiceOrderDetailPage, alert_severity/alert_status, services.status) —
  // a causa comum não é vocabulário, é a fronteira `req.query.X as any` em *.routes.ts. Allowlist
  // congelada com os 181 símbolos de hoje (por arquivo:símbolo); item novo ou entrada removida da
  // allowlist sem consertar o código = FAIL. Contagem só desce.
  "node scripts/audit-query-param-boundary-validation.mjs",
  // F-SCHEMA-COHERENCE-RATCHET (2026-07-31, GO Clayton): o gate validate-schema-code-coherence
  // existia, media certo e esteve VERMELHO (~1800) fora do runner/CI — ninguém o lia; em 30/07 a
  // direção redescobriu à mão o que ele já listava. Religado por RATCHET: baseline de hoje
  // congelada (1188 chaves em schema-coherence-ratchet-baseline.json) + 6 TETOS COMPARADOS no
  // próprio guard (BLOCKER-vivo 260 · BLOCKER-scripts 105 · CORRUPTOR-vivo 364 ·
  // CORRUPTOR-scripts 1047 · DEBT-vivo 32 · DEBT-scripts 18). Violação nova = FAIL · baseline
  // inflada = FAIL · contagem só desce (--write-baseline recusa crescer).
  "node scripts/audit-schema-coherence-ratchet.mjs",
  // F-DOC-ENTRY-AUTHORITY (2026-07-31, GO Clayton): QUATRO documentos disputavam ser "a entrada"
  // do repositório e dois estavam parados desde jan/fev — um deles mandando ler 418 arquivos como
  // "ORDEM OBRIGATÓRIA", apontando para uma pasta inexistente. Reorganizar resolveu o passado;
  // este teto impede o próximo nascer: documento NOVO em docs/ declara 5 campos (Categoria,
  // Status, Fonte canônica, Obrigatório, Governado por) ou o gate morde. Baseline congelada com
  // os 1806 sem tarja de hoje (de 1811 rastreados) — exigir tarja nos 1806 nasceria vermelho e
  // seria desligado, como aconteceu com schema-coherence. Teto COMPARADO contra o disco: alistar
  // o documento novo na baseline para calar o gate estoura o teto do mesmo jeito. Contagem só desce.
  "node scripts/audit-doc-tag-ratchet.mjs",
  // F-DORMANT-GHOST-ANTIREVIVAL (2026-08-01, GO Clayton — achado 【4】 da auditoria Yala do arco):
  // o religamento do Bank deixou `bank-reconciliation-history.repository.ts` DORMENTE com o SQL
  // fantasma dentro, e a isenção `DT-BANK-RECONCILIATION-HISTORY-DORMANT` no schema-coherence é
  // POR CAMINHO DE ARQUIVO — ela não percebe religamento. A auditoria nomeou: quem reimportar o
  // repositório acende o SQL fantasma COM O GATE VERDE. Este guard morde no import/uso (comentário
  // NÃO conta — a migalha §7.1 cita o símbolo de propósito) e também quando o SQL fantasma SAI do
  // arquivo, para forçar a retirada da isenção e a descida REAL do teto do ratchet.
  "node scripts/audit-dormant-ghost-repository-antirevival.mjs",
  // F-RUNNER-COVERAGE-VISIBILITY-ANTI-DRIFT (ROOT-003 R2): meta-guard que torna a cobertura efetiva
  // VISIVEL e FALHA em drift (guard novo sem wiring). Nao executa guards; deriva o alcance das fontes
  // reais (este CMDS[], os 2 agregadores, actor-writer). Deve ser a ULTIMA entrada (le o array acima).
  "node scripts/audit-guard-coverage-manifest.mjs"
];
// R3 self-wiring (F-RUNNER-COVERAGE-VISIBILITY-ANTI-DRIFT): garante que o meta-guard esteja EXATAMENTE
// uma vez em CMDS[], com o path esperado, ANTES do loop. Nao executa o meta-guard; nao altera ordem;
// nao cria segunda lista. A constante e o path esperado: se a entrada acima divergir dela (path
// diferente, ausente, ou duplicada), a contagem != 1 e o runner falha fechado. Limite honesto: fecha
// remocao acidental/isolada do wiring; remocao coordenada da entrada E desta precondicao e alteracao
// deliberada do mecanismo e permanece visivel em code review.
const COVERAGE_GUARD_CMD = 'scripts/audit-guard-coverage-manifest.mjs';
const coverageWiring = CMDS.filter((c) => c.includes(COVERAGE_GUARD_CMD)).length;
if (coverageWiring !== 1) {
  console.error('\nGATE FAIL — self-wiring: ' + COVERAGE_GUARD_CMD + ' deve estar EXATAMENTE 1x em CMDS[] (encontrado: ' + coverageWiring + ').');
  process.exit(1);
}
for (const c of CMDS) {
  const [bin, ...args] = c.split(/\s+/);
  const r = spawnSync(bin, args, { stdio: 'inherit', shell: true });
  if (r.status !== 0) { console.error('\nGATE FAIL — parou em: ' + c); process.exit(r.status || 1); }
}
// CMDS.length e a contagem de COMANDOS (inclui nao-audit e agregadores), NAO de guards efetivos.
// A cobertura de guards efetiva e reportada pelo meta-guard audit-guard-coverage-manifest acima.
console.log('\n✅ validate:regression-guards — ' + CMDS.length + ' COMMANDS OK · GUARD COVERAGE: ver inventario do guard-coverage-manifest acima.');
