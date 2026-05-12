### 2026-05-01 — DECISION-0017 Ciclo 3 fechado: --repo-strict adicionado ao gate amplo

Modo `--repo-strict` implementado em `scripts/validate-schema-code-coherence.mjs` (commit 5c793a61). Aplica heurísticas mais rígidas (apenas `queryContextRegex`, sem `templateStartRegex`) e restringe escopo a arquivos `.repository.ts` quando ativado. Allowlist e detector de severidade reaproveitados sem mudança. 12 linhas adicionadas, 0 removidas.

Pendências para próxima sessão: Loop §6 do PLAN (validar 10 amostras manualmente) antes de integrar ao package.json e ao CI workflow.

### 2026-05-01 — DECISION-0017 Ciclo 2 fechado por deleção de untracked

Arquivo `backend/scripts/validate-repository-schema-coherence.mjs` removido do working tree. Verificado via `git ls-files` e `git log --all`: arquivo nunca foi rastreado pelo Git em nenhuma branch ou reflog. Portanto não houve commit `gate: descartar script paralelo conforme DECISION-0017` — não havia nada versionado a remover formalmente. Ciclo 2 cumprido pelo efeito físico (disco limpo) sem commit dedicado.

DECISION-0017 (4f9b9b7e) permanece como única referência no histórico Git sobre a existência transitória do script.

### 2026-04-28 — C2 Passo 3-C CONCLUÍDO: concept_id obrigatório em tipos TypeScript

9 commits: 43a7c5d1, 3dabbfa1, 135a7f94, 175f35d1, 3046efbf, b4c7532f, 813a82e3, acc233c5, a6cf46bd
13 arquivos: 6 tipos diretos + 1 indireto (bank-ledger) + 7 callers propagados
  Tipos: bank-transaction.types.ts, bank-ledger.service.ts, bank-transaction.service.ts (5 inline)
  Callers: payout.service, validate-financial-flow-real, seed-initial-balance, verify-simple-tx-double-entry, bank-integration.service (2×), backfill-payment-splits-to-bank
Pendente: validação banco (zero NULLs) + migration NOT NULL

### 2026-04-27 — FASE 5 C2 — 9 call sites commitados

**C2:** DECISION-C2-010 registrada (ba684181). 6 concepts commerce aprovados e seedados (b2b94526). 9 call sites preenchidos com concept_id:
  payment-execution.service.ts (6 sites): 8c1521d9
  transaction.service.ts (wrapper, concept_id opcional): 48c2d6e1
  financial-simulator.controller.ts (2 sites): 764739bf

Bloqueador 3-C operacional resolvido — 4 callers concluídos (dc7aebdd mais recente)
  core/economy/distribution/distribution.service.ts
  core/economy/split.service.ts
  modules/social/social-work-payment.service.ts
  core/unifybank/test-currency.service.ts
# SYSTEM REMEDIATION STATUS

**Documento vivo. Atualizado a cada commit que fecha ou altera status de violação.**
**Append/update apenas. Nunca rewrite retroativo.**

| Metadado | Valor |
|---|---|
| Criado | 2026-04-21 |
| Última atualização | 2026-04-27 (FASE 5 C2 — 4 callers wrapper concluídos; bloqueador 3-C operacional resolvido) |
| Atualização 2026-04-28 [1] | C2 Passo 3-C CONCLUÍDO — concept_id obrigatório em tipos TypeScript |
| Atualização 2026-04-28 [2] | C63 identificado — SSOT temporal duplicado |
| Base normativa | `SYSTEM_REMEDIATION_PLAN.md` v1.0 (congelado) |

| Atualização 2026-04-30 | G2 Pipeline E2E PASS — 5 migrations, patch semântico, DECISION-0015 |
| Atualização 2026-05-11 [1] | C22 ALLOWLISTED via DECISION-0026 — duplicação users.id/user_id controlada por constraint+trigger |
| Atualização 2026-05-11 [2] | C50/C51 FIXED — actorId como globalUserId corrigido em cultural.routes.ts e store-onboarding.routes.ts |
| Atualização 2026-05-11 [3] | C64 FIXED — ticket_sales SCHEMA DRIFT alinhado com schema (pending/completed/refunded/failed) |
| Atualização 2026-05-11 [4] | C15 FIXED — tenant_products.price NUMERIC removida via migration 20260530530000 |
| Atualização 2026-05-11 [5] | C19 FIXED — bank_transactions.reference_id UUID→TEXT via DECISION-0029 (commit fd3f1018) |
| Atualização 2026-05-11 [6] | C40 FIXED — system_coverage.*_cents VIEW NUMERIC→BIGINT via DECISION-0030 (commit 2337f577) |
| Atualização 2026-05-12 | Q3-E2E v2 APROVADO 11/11 — fundação econômica provada. Bug corrigido: bank-transaction.service debit query omitia actor_id |
| Atualização 2026-05-12 [2] | C36 FIXED — 30 CHECK constraints adicionadas (migration 20260530535000); 7 ENUM já protegidas; 3 tabelas diferidas com DT |

### 2026-04-30 — G2 PIPELINE E2E PASS

- G2 FECHADO com EXIT CODE 0. Modo A (A1–A10) e Modo B (todas falsificações rejeitadas).
- 5 tabelas materializadas: bank_limit_change_requests, bank_policies, bank_transactions.metadata, authority_trust_levels, service_payment_executions.
- Patch: processServicePaymentExecutionCanonical — conceito resolvido via SSOT semântico (slug→UUID).
- DECISION-0015 registrada com trade-offs documentados (fail-fast vs fail-open, amount vs amount_cents).
- Próximo passo recomendado: gate CI preventivo validate:repository-schema-coherence.

### 2026-05-05 — Hipótese #019 em execução

- Hipótese #019 (core/modules): Status EM EXECUÇÃO; critério de classificação por soberania/SSOT (não por pasta); referência: `HIPOTESES_DAS_36_HORAS_2026-05_v3.md`.

---

## Convenções

**Status possíveis:**
- `OPEN` — identificado, sem ação iniciada
- `IN_PROGRESS` — correção em andamento
- `FIXED` — corrigido e verificado via gate + E2E
- `ALLOWLISTED` — aceito com justificativa temporária (deadline obrigatório)
- `DEFERRED` — adiado para sprint específico com issue separada
- `DECISION_PENDING` — aguarda decisão arquitetural (registrar em `REMEDIATION_DECISIONS_LOG.md`)
- `REOPENED` — marcado FIXED previamente mas auditoria posterior invalidou o fechamento

**Severidades:** `CRITICAL` · `HIGH` · `MEDIUM`

---

## Resumo Executivo

| Métrica | Valor inicial | Pós primeiro nível (2026-04-22) | Pós segundo nível (2026-04-22) |
|---|---|---|---|
| Total de violações | 30 | 50 | **57** (+6 da auditoria destrutiva; +C64 2026-05-11) |
| CRITICAL | 10 | 13 | **16** (+C54, C55, C56) |
| HIGH | 11 | 22 | **25** (+C52, C53, C64) |
| MEDIUM | 9 | 12 | **13** (+C57) |
| OPEN | 21 | 26 | **23** (+5 novas abertas; C52 é DECISION_PENDING; C57+C47+C55+C54+C64+C50+C51+C15+C19+C40 FIXED; C22+C29 ALLOWLISTED; +3 frentes smoke 2026-05-12; Q3-E2E-ECONOMICO-MINIMO RESOLVED-VIA-DECISION-0031 2026-05-12) |
| IN_PROGRESS | 0 | 0 | 0 |
| FIXED | 1 | 13 | **23** (+C57, +C47, +C55, +C54, +C64, +C50, +C51, +C15, +C19, +C40) |
| REOPENED | 0 | 1 (C44) | **2** (C44, C14 parcial) |
| ALLOWLISTED | 0 | 0 | **2** (C22 DECISION-0026, C29 DECISION-0027, 2026-05-11) |
| DEFERRED | 0 | 0 | 0 |
| DECISION_PENDING | 8 | 9 | **10** (+C52) |

---

## Tabela de Violações

### CRITICAL (16)

| ID | Status | Descrição curta | Arquivo/Tabela principal | Notas |
|----|--------|-----------------|--------------------------|-------|
| C1 | FIXED | Tabela `ledger` fantasma | `core/reputation/trust.service.ts` + 5 outros | Resistiu ao ataque 2º nível. |
| C2 | FIXED | `bank_transactions.concept_id` rollout | Passo 3-B: 23/23 ✅ (8fa1f827) | DECISION-C2-010 registrada. 9 call sites commitados. 4 callers concluídos: distribution.service.ts (2f9ead22), split.service.ts (d22255d6), social-work-payment.service.ts (79949eee), test-currency.service.ts (dc7aebdd — system-reserve-credit temporário, RFC pendente). Pendências: concept_id obrigatório + 0 NULLs + ALTER COLUMN SET NOT NULL.\nPasso 6 SET NOT NULL aplicado (20260428210000). is_nullable=NO confirmado. Gates 4/4 PASS (2026-04-28). |
| C2 | FIXED | `bank_transactions.concept_id` rollout | Passo 3-C: tipos ✅ (a6cf46bd) | Passo 3-C CONCLUÍDO (2026-04-28): concept_id obrigatório em tipos TypeScript. 13 arquivos, 9 commits (43a7c5d1→a6cf46bd). Decisões: C2-011 (ride-payment), C2-012 (service-booking-payment backfill), C2-013 (bank-ledger INDIRETO). Pendente: validação banco (zero NULLs) + migration NOT NULL.\nPasso 6 SET NOT NULL aplicado (20260428210000). is_nullable=NO confirmado. Gates 4/4 PASS (2026-04-28). |
| C3 | FIXED | Criação de actor via helpers fora do writer | `core/actors/actor.helpers.ts` | Resistiu ao ataque 2º nível. |
| C4 | FIXED | `listRegionalFunds` lê colunas inexistentes | `modules/bank/bank-balance-by-region.service.ts` | Resistiu ao ataque 2º nível. |
| C8 | FIXED | 2 repositórios `groups` com colunas fantasmas | 2 arquivos | Resistiu ao ataque 2º nível (groups principal limpo). |
| C12 | FIXED | `actorId` retornado como `globalUserId` | `core/identity/identity.routes.ts` | |
| C13 | ALLOWLISTED | 84 arquivos leem `bank_*` fora de `modules/bank/` | vários | 84 arquivos (expandido de 37 em 2026-04-26). bank-settlement-repository.ts faz INSERT/UPDATE fora do Bank. saga-compensation.handler.ts faz SELECT em bank_transactions. Analíticos ficam para allowlist FASE 5. ALLOWLISTED (2026-04-28): triagem completa de 66 arquivos. Resultado: 36 apenas comentários (ignorar), 15 leituras analíticas SAFE (reconciliação/observabilidade/reporting), 15 RISKY auditados individualmente — zero escrita ilegítima encontrada. bank-settlement-repository.ts corrigido em sessão anterior. saga-compensation e payment-event-resolver têm leituras de idempotência legítimas (ALLOWLIST com justificativa). C13 não requer correção adicional. |
| C14 | FIXED | 23 try/catch mascarando erros de schema | +6 catches em caminhos críticos | C53 fechado em 85976e65 — authority-mode.ts extraído, strict/permissive em catches 42P01. C14 parcial absorvido. |
| C22 | ALLOWLISTED | `users.id` + `users.user_id` duplicados | `migration 2164-2182` | ALLOWLISTED (2026-05-11): CHECK constraint `users_id_user_id_equal` + trigger `trg_users_sync_id_user_id` garantem identidade. FK canônica `actors.user_id → users.id` estabelecida. Duplicação controlada, sem bug em runtime. Reclassificado CRITICAL→DEBT via DECISION-0026. Deadline: 2027-05-11. |
| C26 | FIXED | `actors.id` + `actors.actor_id` sem CHECK | `migration 2804-2850` | CHECK confirmado. Resistiu ao ataque 2º nível. |
| C36 | PARCIAL | 67 tabelas auditadas → 19 CHECK pré-existentes, 7 ENUM, 39 sem proteção. 29 corrigidos (20260530535000), 1 revertido (payment_transactions → DT-PAYMENT-CASING-DRIFT), 3 diferidos (DTs registradas). | 7afd75ef + 20260530536000 | |
| C37 | OPEN | Gate schema-coherence não valida nomenclatura canônica | gate | |
| C47 | FIXED | `actor_has_permission` SQL retorna TRUE | migration `20260422000100_actor_has_permission_fail_closed.sql` | Substituído por fail-closed (RETURN FALSE). Único caller (`rbac.service.ts`) já tem fallback `?? false`. |
| C54 | FIXED | 9 caminhos de produto movem dinheiro sem authority gate | 6 arquivos corrigidos | Caminhos de usuário corrigidos: escrow (release+refund), pix_payment, payout, capacity-compensation, incentive-grant. Caminhos de tesouraria (regional-fund, treasury-split, transaction.service legacy) não têm actor de usuário — precisam de gate de sistema separado. |
| C55 | FIXED | `authority-decision.service.ts` é fail-open em 3 camadas (ATL/KYC/GUARDA) | `core/compliance/authority-decision.service.ts` | Convertido para strict/permissive mode. Default `strict` (fail-closed). `permissive` só funciona com `NODE_ENV=development`. 6 skips para bloqueio em strict mode. |
| **C56** | **FIXED** | **`real-margin.service.ts` deriva receita bruta via metadata+cast numeric** | **`modules/marketplace/real-margin.service.ts:L194079`** | real-margin.service.ts reescrito para usar bank_ledger como SSOT. Commits: 5c93766b, 17ac88ac, 02266c4b. |
| **C63** | **FIXED** | **SSOT temporal duplicado (schedules ∥ unified_availability)** | **6 WRITE paths** | FIXED (2026-04-29). DECISION-0014 (Opção B) executada integralmente. DECISION-0015 registrada. RFC_C63_FASE2B.md criado. Etapas 1-5 concluídas: (1) ADD COLUMN unified_availability_id em events + unified_booking_id em event_tickets (migration 20260530509000); (2) createBooking aceita trx opcional (unified-availability.repository.ts + service); (3) checkout-ticket.service.ts substituído — zero WRITE em schedule_slots; (4) THROW implícito via fluxo canônico; (5) REVOKE INSERT/UPDATE em schedules e schedule_slots aplicado (20260428200000). Gates CI adicionados (G1 fechado). 4/4 gates verdes em todos os commits. schedule_slots e schedules agora READ-ONLY para roles não-superuser. |

### HIGH (25)

| ID | Status | Descrição curta | Arquivo/Tabela principal | Notas |
|----|--------|-----------------|--------------------------|-------|
| C5 | DECISION_PENDING | Duas estruturas N2 paralelas | migrations 2590, 3571 | |
| C6 | OPEN | 95 decisões via `metadata->>` em queries | vários | Agora com subcaso C56. |
| C9 | DECISION_PENDING | RFQ como JSON sem lock | `modules/events/event-rfq.service.ts` | |
| C11 | FIXED | `bookings` com `requestedat` | `migration 13251` | FIXED (2026-04-28): migration 20260428260000_bookings_fix_timestamp_names.sql. 4 colunas renomeadas: requestedat→requested_at, confirmedat→confirmed_at, cancelledat→cancelled_at, expiredat→expired_at. Colunas antigas ausentes confirmadas. Gates 4/4 PASS. |
| C16 | DECISION_PENDING | Saga compensation quebra atomicidade | `core/sagas/handlers/saga-compensation.handler.ts` | |
| C17 | FIXED | `set_config` com `is_local=false` | `core/database/pool.ts` | |
| C20 | FIXED | Trigger coverage bloqueia tenant | migration 20260530480000 | |
| C21 | DECISION_PENDING | `bank_accounts.owner_id` TEXT dual | `migration 88-100` | |
| C24 | DECISION_PENDING | 4 tabelas paralelas de produto | products/canonical/catalog/tenant | |
| C27 | DECISION_PENDING | 3 sistemas de autorização coexistindo | vários | Agora com subcaso C54+C55. |
| C29 | ALLOWLISTED | 132 comparações status UPPERCASE | vários | ALLOWLISTED (2026-05-11): Auditoria material (executei.md) confirmou 0 bugs ativos. 46 tabelas com CHECK (41 lowercase, 2 UPPERCASE, 1 mista). Código UPPERCASE funciona porque tabelas ou têm CHECK UPPERCASE ou não têm CHECK. Reclassificado HIGH→DEBT via DECISION-0027. Deadline: 2027-05-11. |
| C31 | FIXED | Tabela `audit_events` fantasma | `core/audit/audit.service.ts` | FIXED (2026-04-28): migration 20260428230000_create_audit_events.sql. col_count=13, RLS+FORCE+policy OK. Gates 4/4 PASS. audit_events ativa — auditService.record() passa a gravar de verdade. |
| C32 | FIXED | Tabela `webauthn_challenges` fantasma | `core/auth/webauthn.repository.ts` | FIXED (2026-04-28): migration 20260428220000_create_webauthn_tables.sql. col_count OK, RLS+FORCE+policy OK. Gates 4/4 PASS. |
| C33 | FIXED | Tabela `webauthn_credentials` fantasma | `core/auth/webauthn.repository.ts` | FIXED (2026-04-28): migration 20260428220000_create_webauthn_tables.sql. col_count OK, RLS+FORCE+policy OK. Gates 4/4 PASS. |
| C34 | FIXED | Tabela `category_ai_logs` fantasma | `core/categories/categories.repository.ts` | FIXED (2026-04-28): migration 20260428240000_create_category_ai_logs.sql. col_count=15, RLS+FORCE+policy OK. Gates 4/4 PASS. ON CONFLICT (category_id) preservado. Guard IF EXISTS no código agora tem tabela real para acessar. |
| C35 | FIXED | Tabela `partner_employees` fantasma | `core/audit/audit.service.ts` | FIXED (2026-04-28): migration 20260428230000_create_audit_events.sql. col_count=4, RLS+FORCE+policy OK. partner_employees criada junto com audit_events (dependência de audit.service.ts). |
| C38 | OPEN | 5 tabelas com `type` genérico | vários | |
| C39 | OPEN | 7 tabelas com `state` genérico | vários | |
| C40 | FIXED | Monetário em NUMERIC/DECIMAL | `system_coverage` (VIEW) | FIXED (2026-05-11, 2337f577): VIEW system_coverage retornava NUMERIC em *_cents por COALESCE sem cast explícito. DROP + CREATE com ::bigint. Auditoria: coverage_audit_log já BIGINT; callers apenas leitura. Migration 20260530532000. DECISION-0030. TSC 0. Gates 4/4 PASS. |
| C44 | FIXED | marketplace/group.repository.ts fix parcial | group.types.ts + service | group.service.ts — parentGroupId e createdByUserId bloqueados explicitamente (2fd1a5ac). |
| C45 | FIXED | groups.service.ts: findOrCreateUserActor fora do writer | `modules/groups/groups.service.ts` | |
| C46 | FIXED | groups: ownerUserId vs actor_id | 5 arquivos | |
| C50 | FIXED | Padrões culturais passam actorId como globalUserId | cultural | CORRIGIDO (2026-05-11, 39577e45): `ensureUserActor(req.tenant.id, req.user.id)` resolve actor_id real. TODO outdated removido. 4 gates PASS. |
| C51 | FIXED | store-onboarding passa actorId como globalUserId | `modules/store-onboarding/` | CORRIGIDO (2026-05-11, 39577e45): fallback alterado de `fallbackUserPk` (userId) para `importerActorId` (actor_id). 4 gates PASS. |
| **C52** | **FIXED** | **`payment_intents` tem 2 writers divergentes** | **`modules/marketplace/payment-intent.repository.ts:L187829` + `modules/payments/payment-intent-repository.ts:L221983`** | Writers unificados, CRM migrado, BUG-TICKET-001 corrigido. E2E PASS 6/6 fluxos. Commits: 69fff82d→9fb52199 (9 commits). |
| **C53** | **FIXED** | **6 catches de `42P01` ativos em compliance/events/observability** | **3 arquivos** | authority-mode.ts extraído, strict/permissive em event-handler-failure + handler-metrics (85976e65). |
| **C64** | **FIXED** | **ticket_sales SCHEMA DRIFT: código usa RESERVED/PAID/CANCELLED, schema tem pending/completed/refunded/failed** | **modules/events/ticket-sale.repository.ts** | FIXED (2026-05-11, 33fcd928): Código alinhado com schema. Type TS e repository agora usam pending/completed/refunded/failed. 4 arquivos corrigidos (event.types.ts, ticket-sale.repository.ts, checkin.service.ts, ticket.service.ts). Gates 3/3 PASS. |

### MEDIUM (13)

| ID | Status | Descrição curta | Arquivo/Tabela principal | Notas |
|----|--------|-----------------|--------------------------|-------|
| C7 | OPEN | Permissões hardcoded em `core/companies/` | `companies.service.ts` | |
| C10 | DECISION_PENDING | 3 writers para tabela `events` | 3 arquivos | Conecta com C52 (mesma classe). |
| C15 | FIXED | 3 tabelas com `price NUMERIC` | vários | FIXED (2026-05-11): 2 de 3 tabelas ja corrigidas por migrations anteriores (product_offers: 20260331150000, product_prices: 20260416100000). Apenas tenant_products tinha price NUMERIC residual. Migration 20260530530000 remove coluna. Commit 3db7245a. |
| C18 | FIXED | RLS ENABLE sem FORCE em 30 tabelas | várias | FIXED (2026-04-28): migration 20260428250000_force_rls_missing_tables.sql. 29 tabelas com FORCE aplicado. categories excluída corretamente (tabela global sem tenant_id — DISABLE RLS intencional em migration L4377, comentário: Ontologia global N0-N3, slug único no sistema, sem tenant_id). Guard funcionou corretamente. Gates 4/4 PASS. |
| C19 | FIXED | `reference_id` tipo inconsistente | `bank_transactions` | FIXED (2026-05-11, fd3f1018): ALTER COLUMN reference_id UUID→TEXT via migration 20260530531000. 3 `::uuid` casts residuais removidos (bank-split.repository.ts, bank-transaction.service.ts, bank-transaction-read.repository.ts). DECISION-0029 (Opção A). TSC 0 erros. Gates 4/4 PASS. |
| C23 | OPEN | `"createdAt"` coexistindo | vários | |
| C25 | FIXED | `products.canonical_product_id` sem FK | `products` | |
| C28 | OPEN | 16 tabelas com `"createdAt"` aspado | várias | |
| C30 | OPEN | snake_case incompleto | vários | |
| C41 | FIXED | 5 timestamps sem sufixo `_at` | vários | PARTIAL FIX (2026-04-28): migration 20260428270000_fix_timestamp_names_aspados.sql. 3 colunas corrigidas: inventory_reservations.expiresAt→expires_at, fulfillment_orders.shippedAt→shipped_at, pdv_sessions.closedAt→closed_at. Pendente: event_attendees.check_in_time→checked_in_at (14 referências ativas no código — requer patch de código junto na próxima sessão com SRC_FULL atualizado). Gates 4/4 PASS. FIXED COMPLETO (2026-04-28): migration 20260428280000_event_attendees_fix_check_in_time.sql. event_attendees.check_in_time→checked_in_at. Código atualizado em events.service.ts + events.types.ts antes da migration. checked_in_at confirmado no banco. Gates 4/4 PASS. |
| C42 | FIXED | 16 booleanos sem prefixo canônico | vários | FIXED: migration 20260530410000_fix_boolean_prefixes.sql aplicada e confirmada no banco. 6 booleanos canônicos confirmados: is_kill_switch_active, is_created_by_ai, is_operation_blocked, is_false_positive, is_profile_personal_confirmed, is_resolved. Zero colunas antigas presentes. |
| C43 | OPEN | Medição formal de C23/C28 | várias | |
| C57 | FIXED | `authority_roots` sem FK para `actors` | migration `20260517100000_authority_roots_integrity.sql` | FK `fk_authority_roots_actor` já aplicada. Confirmado no banco em 2026-04-22. Correção pré-existente não documentada. |

---

## Log de Mudanças de Status

### 2026-05-11 — C19 FIXED (bank_transactions.reference_id UUID→TEXT)

**C19 FIXED:** DECISION-0029 (Opção A — schema fix).
- `bank_transactions.reference_id` era UUID; 8+ callers passam strings compostas (`governance_funding:${id}`, `${settlementId}_regional_fund`, `manual-${ts}`, `${intentId}:${splitId}`).
- Migration `20260530531000_bank_transactions_reference_id_uuid_to_text.sql`: `ALTER COLUMN reference_id TYPE TEXT USING reference_id::text`. 4 registros existentes preservados.
- 3 residuais `::uuid` removidos: `bank-split.repository.ts:390`, `bank-transaction.service.ts:1466`, `bank-transaction-read.repository.ts:41`.
- UNIQUE index `uq_bank_transactions_reference(tenant_id, reference_type, reference_id)` preservado automaticamente pelo Postgres.
- Commit: `fd3f1018`. TSC: 0 erros. Gates: actor-writer OK · bank-ledger OK · regression-guards OK · architectural OK.

### 2026-05-11 — C29 ALLOWLISTED + C64 ABERTO (ticket_sales DRIFT)

**C29 ALLOWLISTED:** Auditoria material (executei.md) confirmou 0 bugs ativos.
- 77 tabelas com coluna `status`
- 46 com CHECK constraint (41 lowercase, 2 UPPERCASE, 1 mista)
- Código UPPERCASE funciona porque tabelas ou têm CHECK UPPERCASE ou não têm CHECK
- Reclassificado HIGH→DEBT via DECISION-0027. Deadline: 2027-05-11.

**C64 FIXED:** Descoberto durante auditoria C29 — SCHEMA DRIFT em ticket_sales.
- Migration original: ENUM (RESERVED, PAID, CANCELLED)
- Schema vivo: CHECK (pending, completed, refunded, failed)
- Solução: Código alinhado com schema (Opção A)
- Commit: 33fcd928
- Gates: 3/3 PASS

**DECISION-0028:** 3 tabelas com CHECK UPPERCASE são intencionais:
- chat_reports (OPEN/ACK/RESOLVED) — estado de suporte
- live_presence (ONLINE/OFFLINE) — estado de sistema
- event_reservations (mista) — DT registrada para resolver case inconsistente

**C50/C51 FECHADOS:** Commit 39577e45 (sessão anterior).

### 2026-04-29 — C63 FIXED + correção documental (C64 fantasma removido)

**C63 FECHADO:** Etapas 1-5 do RFC_C63_FASE2B.md executadas integralmente.
- Migration 20260530509000 aplicada (colunas unified_availability_id e unified_booking_id)
- Patch trx opcional em createBooking (repository + service)
- checkout-ticket.service.ts migrado para fluxo canônico
- Migration 20260428200000_schedules_revoke_write.sql aplicada
- 4/4 gates verdes em cada etapa

**Correção documental:** linha "C64 IN_PROGRESS" removida — era duplicação errônea
da entrada de C63 anterior à correção, criada por erro de execução. C64 nunca existiu
como violação real. Sequência de violações: C57 → C63 (sem C58-C62, sem C64).

### 2026-04-26 — FASE 5 C2 ROLLOUT — Passo 3-B CONCLUÍDO

**C2:** Passo 3-B (23 paths aprovados): CONCLUÍDO — 23/23 ✅

  path#7  090cbc95 pix-payment-received
  path#8  fbb56aed seller-funds-release
  path#9  d13d6610 transaction-reversal-leg
  path#10 1df22efb transaction-reversal
  path#11 ebe6c18b seller-payout
  path#12 4a4865bd bank-external-settlement
  path#13 097f60ac ledger-compensation
  path#14 3eb467b7 regional-fund-topup
  path#15 affbea0f escrow-hold
  path#16 9cdd330d escrow-release-to-recipient
  path#17 7e311d37 event-ticket-payment
  path#18 e0de9e90 resource-compensation-payout
  path#19 59fc823d regional-fund-incentive-grant
  path#20 50fdd78f event-ticket-payment (bank-integration)
  path#21 be0f8519 event-ticket-payment (bank-integration)
  path#22 ac661dc2 service-booking-payment
  path#23 8fa1f827 group-contribution-payment

BLOQUEADOR 3-C: 7 call sites sem concept_id (RFC necessário)
  payment-execution.service.ts: linhas 434, 951, 967, 1046, 1144, 1212
  transaction.service.ts: linha 36

NOTA commit 50fdd78f: incluiu refatorações pré-existentes em
bank-integration.service.ts (ensureUserActor, amountCents,
requestAndExecuteReversalSync). Aceito: gates OK, mudanças canônicas.
Ver DECISION-C2-007.

### 2026-04-25 — FASE 5 C2 ROLLOUT (início)

**C2:** Status alterado de DECISION_PENDING para IN_PROGRESS.

Passo 3-B (23 paths aprovados): paths#1-6 concluídos
  Módulo escrow:         2/2 paths ✅
    path#1 releasePayment → escrow-release-to-recipient: dcd23f84
    path#2 refundFunds → escrow-refund-to-payer:         b6f2f6fe
  Módulo treasury-split: 4/4 paths ✅
    path#3 regional_fund → treasury-regional-fund-distribution:   79d44b93
    path#4 community_fund → treasury-community-fund-distribution: 54ae0903
    path#5 system_reserve → treasury-system-reserve-distribution: 56568c30
    path#6 governance_pool → treasury-governance-pool-distribution: 868e2ebc

**Deep Dive GUARDIÃO:** Investigação sistêmica executada. Gaps identificados:
- G1: Gates actor-writer-boundaries e bank-ledger-boundaries fora do CI (ALTO)
- G2: E2E transversal ausente — fluxo evento→settlement não testado (MÉDIO)
- G3: isActorEffectivelyBlocked parcial — mitigado por trigger DB (BAIXO)

Positivos confirmados: RLS+FORCE em bank_*, trigger trg_check_atl, outbox 74 ocorrências, reconciliação 36 arquivos.

### 2026-04-24 — FASE 4 CONCLUÍDA

Todas as violações do quadrinho de autoridade + adjacentes fechadas.

**FIXED nesta fase:** C44, C52, C53, C56 (além de C47, C54, C55, C57 já FIXED anteriormente).
**C14:** absorvido por C53 e fechado junto.
**BUG-TICKET-001:** corrigido em ticket.service.ts (amountCents não mais dividido por 100).
**Gates forenses C58-C61:** todos FIXED (C58=C54, C59=C57, C60=C52, C61=C56). C61-B documentado.
**E2E:** PASS em 6/6 fluxos (payment_link, governance, subscription, pdv, venue, ticket).

Commit de arquivamento: 872aba6b — archive: FASE 4 encerrada.

### 2026-04-22 — AUDITORIA FORENSE SEGUNDO NÍVEL (destrutiva)

Auditoria destrutiva executada. Tentou quebrar o sistema via 5 vetores (SSOT, Schema drift, Integridade financeira, Authority bypass, Causalidade).

**Resistiram ao ataque (confirmados FIXED):** C1, C3, C4, C8, C26.

**Novas violações descobertas:**
- **C52** (HIGH, DECISION_PENDING): payment_intents dual-writer com contratos divergentes
- **C53** (HIGH, OPEN): 6 catches 42P01 em compliance/events/observability
- **C54** (CRITICAL, OPEN): 9 caminhos financeiros sem authority gate
- **C55** (CRITICAL, OPEN): authority-decision.service fail-open em 3 camadas
- **C56** (CRITICAL, OPEN): real-margin deriva receita de metadata
- **C57** (MEDIUM, **FIXED**): authority_roots sem FK para actors — FK já existia via migration 20260517100000

**Reaberturas:**
- **C14: FIXED → REOPENED** (fix parcial, 6 catches ativos em caminhos críticos — virou C53)

**Ações obrigatórias:**
1. DECISION-0013 registrada formalizando as descobertas
2. C54+C55+C57 devem fechar **antes de qualquer cadastro real no sistema** — sistema de autoridade estruturalmente inoperante em estado vazio
3. C52 exige decisão de produto imediata — qual writer de payment_intents é canônico
4. C56 exige decisão: real-margin é métrica estimada (não decisória) ou puxa do bank_ledger
5. C53 reabre C14 parcialmente — cada catch precisa de tratamento caso a caso

**Auditoria primeira rodada declarada INSUFICIENTE:** não executou falsificação real, não validou SSOT financeiro, não testou causalidade, não tentou reabrir FIXEDs além de C44, não identificou blind spots de gates. Zero novas violações num sistema com 50 violações abertas era estatisticamente improvável.

### 2026-04-22 — AUDITORIA FORENSE PRIMEIRO NÍVEL

- C44: FIXED → REOPENED (fix parcial, interface mente ao consumidor)
- C47: HIGH → CRITICAL, FASE 6 → FASE 4 (stub fail-open)
- DECISION-0012 registrada
- Contagens reconciliadas STATUS × snapshot

### 2026-04-28 — C63 IDENTIFICADO — SSOT TEMPORAL DUPLICADO

**C63:** Auditoria detectou duplicação de SSOT temporal.
- unified_availability (SSOT canônico)
- schedules + schedule_slots (legado com WRITEs ativos)

6 WRITE paths identificados:
- checkout-ticket.service.ts:127 (UPDATE schedule_slots) — PRODUÇÃO
- EmployeeService.ts:62 (INSERT schedules) — PRODUÇÃO
- EmployeeService.ts:128 (UPDATE schedule_slots) — PRODUÇÃO
- EventScheduleService.ts:66 (INSERT schedules) — MORTO
- EventScheduleService.ts:135 (INSERT schedule_slots) — MORTO
- SlotGenerator.ts:95 (INSERT schedule_slots) — MORTO

DECISION-0014 registrada: Opção B (migrar código primeiro, REVOKE depois).
Migration criada: 20260428200000_schedules_revoke_write.sql (NÃO APLICADA).

### 2026-04-27 — FASE 5 C2 — 4 callers wrapper concluídos

**C2:** 4 callers do wrapper transaction.service.ts preenchidos com concept_id:
- distribution.service.ts: 2f9ead22 (4 treasury concepts)
- split.service.ts: d22255d6 (group-contribution-payment — L221; L345 fora do escopo)
- social-work-payment.service.ts: 79949eee (service-booking-payment)
- test-currency.service.ts: dc7aebdd (system-reserve-credit temporário — RFC pendente)

Revert aplicado: 4490ee75 (reformatação não autorizada em split.service — cdc681f4)
Bloqueador 3-C operacional resolvido.

Pendências para fechamento de C2:
- Tornar concept_id obrigatório em bank-transaction.types.ts
- Garantir 0 NULLs no banco
- Migration ALTER COLUMN SET NOT NULL

### (entradas históricas anteriores preservadas)

---

**FIM DO DOCUMENTO**


### 2026-04-30 — G2 PIPELINE E2E PASS

- G2 FECHADO com EXIT CODE 0. Modo A (A1-A10) e Modo B (todas falsificacoes rejeitadas).
- 5 tabelas materializadas: bank_limit_change_requests, bank_policies, bank_transactions.metadata, authority_trust_levels, service_payment_executions.
- Patch: processServicePaymentExecutionCanonical - conceito resolvido via SSOT semantico (slug->UUID).
- DECISION-0015 registrada com trade-offs documentados (fail-fast vs fail-open, amount vs amount_cents).
- Proximo passo recomendado: gate CI preventivo validate:repository-schema-coherence.


### 2026-05-06 — C66 RESOLVIDO via DECISION-0018 + DECISION-0019

- Sessão 2 do PLANO_MESTRE fechada. `concept_id` agora aceita UUID ou slug em `bankTransactionService`, com fail-closed via `resolveFinancialConceptId` em `modules/concept-resolution/`.
- Migration `20260530515000_seed_concept_split_payment.sql` seedou o único slug faltante (`'split-payment'` em `financeiro-payment`).
- Drift CORE_PURITY detectado e remediado por realocação de `core/economy/concept-resolver.ts` → `modules/concept-resolution/concept-financial-resolver.service.ts` (DECISION-0019). Baseline `1278/68/319/891` mantido.
- Gate CI novo: `validate:concept-id-uuid-shape` (allowlist 29 slugs / 47 ocorrências). Impede expansão geográfica e quantitativa de slugs literais. Frente 3 (Sessões 3-7) migrará callers para UUID direto, reduzindo allowlist progressivamente.
- 8 commits cirúrgicos: `88f04b56`, `cff078e9`, `59bde5a1`, `96576c42`, `eb7c7157`, `ad58268a`, `c9a54d93`, `f2c95026`.
- Achado lateral: `modules/concept-resolution/` e `PLANO_MESTRE_REMEDIACAO_CORE_MODULES.md` estavam untracked apesar de referenciados por código/normativos. Trazidos para o índice nesta sessão. DT-canonical-docs-untracked sugerida.
- Próximo passo recomendado: Sessão 3 — migração de `distribution.service.ts` (Frente 3).
---

## Frentes registradas pelo Smoke E2E 2026-05-12

_Origem: executei_5.md · Smoke PASS §-3 90% · HEAD 464fc45e_

---

### DT-CONTRACT-DRIFT-IMPLICIT-PROTOCOL

| Campo | Valor |
|---|---|
| **Status** | OPEN |
| **Severidade** | HIGH (DX/SDK) |
| **§-1.5** | P1=não · P2=sim (observability/contrato) · P3=não |
| **Origem** | Smoke E2E 2026-05-12 (executei_5.md) |

**Sintomas descobertos iterativamente durante smoke:**
- `POST /auth/register`: campo `cpf` obrigatório — ausente no contrato público
- `POST /companies`: header `x-action-context` obrigatório — invisível no contrato
- `POST /companies`: field `companyName` (não `name`) — naming não documentado
- `POST /companies`: `scope` deve incluir `tenantId` prefixado — regra implícita
- `POST /companies`: campo `role` obrigatório — não documentado

**Impacto:** discovery iterativo via 5+ tentativas com Zod 400 por endpoint. Mata DX, automação, SDK future-proof, agentes autônomos.

**Frente futura:** alinhar OpenAPI/contracts com comportamento real; gerar SDK tipado; transformar `x-action-context` obrigatório em contrato explícito documentado.

**Bloqueio:** não bloqueia §-3 nem runtime. Bloqueia automação sem fonte de verdade de contrato.

**Dependências:** nenhuma.

---

### MIGRATION-DRIFT-RECONCILIATION

| Campo | Valor |
|---|---|
| **Status** | OPEN |
| **Severidade** | MEDIUM (observabilidade institucional) |
| **§-1.5** | P1=não · P2=sim (memória institucional) · P3=não |
| **Origem** | Smoke E2E 2026-05-12 — passo sanity migrations |

**Sintoma:** `schema_migrations` (DB) = 286, `migrations/*.sql` (disco) = 296, delta = 10.

**Causa conhecida:** migrations aplicadas via `psql` direto sem registro retroativo em `schema_migrations` (padrão histórico). Causa é conhecida HOJE pelos atores ativos.

**Risco:** vira opaco em 3 sessões / próximo onboarding. Ferramental de auditoria (smoke sanity, CI checks) passa a reportar falso-positivo permanente sem documentação formal da isenção.

**Frente futura:** auditar quais 10 migrations divergem; registrar SHA-256 retroativo OU documentar isenção formal por arquivo; convergir contagem entre disco, DB e CI.

**Bloqueio:** não bloqueia §-3 nem runtime.

**Dependências:** nenhuma.

---

### Q3-E2E-ECONOMICO-MINIMO

| Campo | Valor |
|---|---|
| **Status** | RESOLVED-VIA-DECISION-0031 |
| **Severidade** | HIGH (§-3 incompleto) |
| **§-1.5** | P1=não · P2=sim · **P3=SIM** (financeira) |
| **Origem** | Smoke E2E 2026-05-12 — passo transação bank (SKIP) |
| **Resolução** | DECISION-0031, 2026-05-12 |

**Sintoma original:** smoke financeiro SKIP — mint sistêmico (`liquidity_issuance`) sem rota user-facing. `POST /bank/p2p-transfer` e `POST /bank/transactions/simple` requerem conta pré-fundada.

**Resolução:** Smoke v1 DEPRECADO. O sistema está correto — o trigger `check_coverage_before_credit` e a VIEW `system_coverage` (pós-C40) funcionam conforme design. Coverage emerge de atividade econômica real, não de provisionamento artificial. Ver DECISION-0031.

**Smoke v2 — caminho fundacional via service_booking/event_ticket:**
1. Tenant criado → `ensurePlatformAccounts` provisiona contas system (liquidity_issuance, fee_collection, atl_reserve)
2. Primeiro evento real com arrecadação coletiva: `event_ticket` → split engine → parcela de `reserve` (17%) deposita na conta system reserve
3. `execution_capacity_cents > 0` emerge naturalmente
4. P2P habilitado → Q3-E2E possível

**Validações confirmadas (Q3-E2E v1, executei_6.md):**
- `pg_typeof(execution_capacity_cents) = bigint` ✓ (C40 colateralmente validado em runtime)
- `pg_typeof(total_credits_cents) = bigint` ✓
- Build=0 erros, backend UP, register A+B (mesmo tenant via x-tenant-id), contas A+B criadas

**Bloqueio:** §-3 financeiro permanece aberto via Q3-E2E v2 (sessão dedicada futura).

**Ver:** `Q3_E2E_V2_PLAN.md` (gitignored) para plano do smoke v2.

