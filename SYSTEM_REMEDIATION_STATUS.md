# SYSTEM REMEDIATION STATUS

**Documento vivo. Atualizado a cada commit que fecha ou altera status de violação.**
**Append/update apenas. Nunca rewrite retroativo.**

| Metadado | Valor |
|---|---|
| Criado | 2026-04-21 |
| Última atualização | 2026-04-26 (FASE 5 C2 — Passo 3-B COMPLETO 23/23; BLOQUEADOR 3-C identificado) |
| Base normativa | `SYSTEM_REMEDIATION_PLAN.md` v1.0 (congelado) |

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
| Total de violações | 30 | 50 | **56** (+6 da auditoria destrutiva) |
| CRITICAL | 10 | 13 | **16** (+C54, C55, C56) |
| HIGH | 11 | 22 | **24** (+C52, C53) |
| MEDIUM | 9 | 12 | **13** (+C57) |
| OPEN | 21 | 26 | **27** (+5 novas abertas; C52 é DECISION_PENDING; C57+C47+C55+C54 FIXED) |
| IN_PROGRESS | 0 | 0 | 0 |
| FIXED | 1 | 13 | **17** (+C57, +C47, +C55, +C54) |
| REOPENED | 0 | 1 (C44) | **2** (C44, C14 parcial) |
| ALLOWLISTED | 0 | 0 | 0 |
| DEFERRED | 0 | 0 | 0 |
| DECISION_PENDING | 8 | 9 | **10** (+C52) |

---

## Tabela de Violações

### CRITICAL (16)

| ID | Status | Descrição curta | Arquivo/Tabela principal | Notas |
|----|--------|-----------------|--------------------------|-------|
| C1 | FIXED | Tabela `ledger` fantasma | `core/reputation/trust.service.ts` + 5 outros | Resistiu ao ataque 2º nível. |
| C2 | IN_PROGRESS | `bank_transactions.concept_id` rollout | Passo 3-B: 23/23 ✅ (8fa1f827) | Passo 3-B CONCLUÍDO 23/23 paths. Passo 3-C BLOQUEADO — RFC pendente (DECISION-C2-009). 9 call sites sem concept: payment-execution.service.ts (6), transaction.service.ts (1), financial-simulator.controller.ts (2). |
| C3 | FIXED | Criação de actor via helpers fora do writer | `core/actors/actor.helpers.ts` | Resistiu ao ataque 2º nível. |
| C4 | FIXED | `listRegionalFunds` lê colunas inexistentes | `modules/bank/bank-balance-by-region.service.ts` | Resistiu ao ataque 2º nível. |
| C8 | FIXED | 2 repositórios `groups` com colunas fantasmas | 2 arquivos | Resistiu ao ataque 2º nível (groups principal limpo). |
| C12 | FIXED | `actorId` retornado como `globalUserId` | `core/identity/identity.routes.ts` | |
| C13 | OPEN | 84 arquivos leem `bank_*` fora de `modules/bank/` | vários | 84 arquivos (expandido de 37 em 2026-04-26). bank-settlement-repository.ts faz INSERT/UPDATE fora do Bank. saga-compensation.handler.ts faz SELECT em bank_transactions. Analíticos ficam para allowlist FASE 5. |
| C14 | FIXED | 23 try/catch mascarando erros de schema | +6 catches em caminhos críticos | C53 fechado em 85976e65 — authority-mode.ts extraído, strict/permissive em catches 42P01. C14 parcial absorvido. |
| C22 | OPEN | `users.id` + `users.user_id` duplicados | `migration 2164-2182` | |
| C26 | FIXED | `actors.id` + `actors.actor_id` sem CHECK | `migration 2804-2850` | CHECK confirmado. Resistiu ao ataque 2º nível. |
| C36 | OPEN | 67 tabelas com `status` genérico | 67 tabelas | |
| C37 | OPEN | Gate schema-coherence não valida nomenclatura canônica | gate | |
| C47 | FIXED | `actor_has_permission` SQL retorna TRUE | migration `20260422000100_actor_has_permission_fail_closed.sql` | Substituído por fail-closed (RETURN FALSE). Único caller (`rbac.service.ts`) já tem fallback `?? false`. |
| C54 | FIXED | 9 caminhos de produto movem dinheiro sem authority gate | 6 arquivos corrigidos | Caminhos de usuário corrigidos: escrow (release+refund), pix_payment, payout, capacity-compensation, incentive-grant. Caminhos de tesouraria (regional-fund, treasury-split, transaction.service legacy) não têm actor de usuário — precisam de gate de sistema separado. |
| C55 | FIXED | `authority-decision.service.ts` é fail-open em 3 camadas (ATL/KYC/GUARDA) | `core/compliance/authority-decision.service.ts` | Convertido para strict/permissive mode. Default `strict` (fail-closed). `permissive` só funciona com `NODE_ENV=development`. 6 skips para bloqueio em strict mode. |
| **C56** | **FIXED** | **`real-margin.service.ts` deriva receita bruta via metadata+cast numeric** | **`modules/marketplace/real-margin.service.ts:L194079`** | real-margin.service.ts reescrito para usar bank_ledger como SSOT. Commits: 5c93766b, 17ac88ac, 02266c4b. |

### HIGH (24)

| ID | Status | Descrição curta | Arquivo/Tabela principal | Notas |
|----|--------|-----------------|--------------------------|-------|
| C5 | DECISION_PENDING | Duas estruturas N2 paralelas | migrations 2590, 3571 | |
| C6 | OPEN | 95 decisões via `metadata->>` em queries | vários | Agora com subcaso C56. |
| C9 | DECISION_PENDING | RFQ como JSON sem lock | `modules/events/event-rfq.service.ts` | |
| C11 | OPEN | `bookings` com `requestedat` | `migration 13251` | |
| C16 | DECISION_PENDING | Saga compensation quebra atomicidade | `core/sagas/handlers/saga-compensation.handler.ts` | |
| C17 | FIXED | `set_config` com `is_local=false` | `core/database/pool.ts` | |
| C20 | FIXED | Trigger coverage bloqueia tenant | migration 20260530480000 | |
| C21 | DECISION_PENDING | `bank_accounts.owner_id` TEXT dual | `migration 88-100` | |
| C24 | DECISION_PENDING | 4 tabelas paralelas de produto | products/canonical/catalog/tenant | |
| C27 | DECISION_PENDING | 3 sistemas de autorização coexistindo | vários | Agora com subcaso C54+C55. |
| C29 | OPEN | 132 comparações status UPPERCASE | vários | Conecta com C52 (mesmo padrão em payment_intents). |
| C31 | OPEN | Tabela `audit_events` fantasma | `core/audit/audit.service.ts` | |
| C32 | OPEN | Tabela `webauthn_challenges` fantasma | `core/auth/webauthn.repository.ts` | |
| C33 | OPEN | Tabela `webauthn_credentials` fantasma | `core/auth/webauthn.repository.ts` | |
| C34 | OPEN | Tabela `category_ai_logs` fantasma | `core/categories/categories.repository.ts` | |
| C35 | OPEN | Tabela `partner_employees` fantasma | `core/audit/audit.service.ts` | |
| C38 | OPEN | 5 tabelas com `type` genérico | vários | |
| C39 | OPEN | 7 tabelas com `state` genérico | vários | |
| C40 | OPEN | Monetário em NUMERIC/DECIMAL | vários | |
| C44 | FIXED | marketplace/group.repository.ts fix parcial | group.types.ts + service | group.service.ts — parentGroupId e createdByUserId bloqueados explicitamente (2fd1a5ac). |
| C45 | FIXED | groups.service.ts: findOrCreateUserActor fora do writer | `modules/groups/groups.service.ts` | |
| C46 | FIXED | groups: ownerUserId vs actor_id | 5 arquivos | |
| C50 | OPEN | Padrões culturais passam actorId como globalUserId | cultural | |
| C51 | OPEN | store-onboarding passa actorId como globalUserId | `modules/store-onboarding/` | |
| **C52** | **FIXED** | **`payment_intents` tem 2 writers divergentes** | **`modules/marketplace/payment-intent.repository.ts:L187829` + `modules/payments/payment-intent-repository.ts:L221983`** | Writers unificados, CRM migrado, BUG-TICKET-001 corrigido. E2E PASS 6/6 fluxos. Commits: 69fff82d→9fb52199 (9 commits). |
| **C53** | **FIXED** | **6 catches de `42P01` ativos em compliance/events/observability** | **3 arquivos** | authority-mode.ts extraído, strict/permissive em event-handler-failure + handler-metrics (85976e65). |

### MEDIUM (13)

| ID | Status | Descrição curta | Arquivo/Tabela principal | Notas |
|----|--------|-----------------|--------------------------|-------|
| C7 | OPEN | Permissões hardcoded em `core/companies/` | `companies.service.ts` | |
| C10 | DECISION_PENDING | 3 writers para tabela `events` | 3 arquivos | Conecta com C52 (mesma classe). |
| C15 | OPEN | 3 tabelas com `price NUMERIC` | vários | |
| C18 | OPEN | RLS ENABLE sem FORCE em 30 tabelas | várias | |
| C19 | OPEN | `reference_id` tipo inconsistente | `bank_transactions` | |
| C23 | OPEN | `"createdAt"` coexistindo | vários | |
| C25 | FIXED | `products.canonical_product_id` sem FK | `products` | |
| C28 | OPEN | 16 tabelas com `"createdAt"` aspado | várias | |
| C30 | OPEN | snake_case incompleto | vários | |
| C41 | OPEN | 5 timestamps sem sufixo `_at` | vários | |
| C42 | OPEN | 16 booleanos sem prefixo canônico | vários | |
| C43 | OPEN | Medição formal de C23/C28 | várias | |
| C57 | FIXED | `authority_roots` sem FK para `actors` | migration `20260517100000_authority_roots_integrity.sql` | FK `fk_authority_roots_actor` já aplicada. Confirmado no banco em 2026-04-22. Correção pré-existente não documentada. |

---

## Log de Mudanças de Status

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

### (entradas históricas anteriores preservadas)

---

**FIM DO DOCUMENTO**
