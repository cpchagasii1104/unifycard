# SYSTEM REMEDIATION STATUS

**Documento vivo. Atualizado a cada commit que fecha ou altera status de violação.**
**Append/update apenas. Nunca rewrite retroativo.**

| Metadado | Valor |
|---|---|
| Criado | 2026-04-21 |
| Última atualização | 2026-04-22 (C47 FIXED — actor_has_permission fail-closed) |
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
| OPEN | 21 | 26 | **29** (+5 novas abertas; C52 é DECISION_PENDING; C57+C47 FIXED) |
| IN_PROGRESS | 0 | 0 | 0 |
| FIXED | 1 | 13 | **15** (+C57, +C47) |
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
| C2 | DECISION_PENDING | `bank_transactions` sem `concept_ref` | migration pendente | Sem isso §7 não é satisfazível. |
| C3 | FIXED | Criação de actor via helpers fora do writer | `core/actors/actor.helpers.ts` | Resistiu ao ataque 2º nível. |
| C4 | FIXED | `listRegionalFunds` lê colunas inexistentes | `modules/bank/bank-balance-by-region.service.ts` | Resistiu ao ataque 2º nível. |
| C8 | FIXED | 2 repositórios `groups` com colunas fantasmas | 2 arquivos | Resistiu ao ataque 2º nível (groups principal limpo). |
| C12 | FIXED | `actorId` retornado como `globalUserId` | `core/identity/identity.routes.ts` | |
| C13 | OPEN | 37 arquivos leem `bank_*` fora de `modules/bank/` | vários | Analíticos ficam para allowlist FASE 5. |
| C14 | REOPENED | 23 try/catch mascarando erros de schema | +6 catches em caminhos críticos | **Reaberto 2026-04-22 (2º nível).** 6 catches ativos classificados "SAFE" sem justificativa técnica. Ver C53 e C55. |
| C22 | OPEN | `users.id` + `users.user_id` duplicados | `migration 2164-2182` | |
| C26 | FIXED | `actors.id` + `actors.actor_id` sem CHECK | `migration 2804-2850` | CHECK confirmado. Resistiu ao ataque 2º nível. |
| C36 | OPEN | 67 tabelas com `status` genérico | 67 tabelas | |
| C37 | OPEN | Gate schema-coherence não valida nomenclatura canônica | gate | |
| C47 | FIXED | `actor_has_permission` SQL retorna TRUE | migration `20260422000100_actor_has_permission_fail_closed.sql` | Substituído por fail-closed (RETURN FALSE). Único caller (`rbac.service.ts`) já tem fallback `?? false`. |
| **C54** | **OPEN** | **9 caminhos de produto movem dinheiro sem authority gate** | **9 arquivos listados abaixo** | **NOVA 2º nível.** Evidência: `core/economy/transaction.service.ts`, `modules/escrow/escrow.service.ts`, `modules/gateway/payment-event-resolver.ts`, `modules/marketplace/payout.service.ts`, `modules/marketplace/regional-fund.service.ts`, `modules/marketplace/application/services/capacity-application.service.ts`, `modules/marketplace/application/services/marketplace-orchestration.service.ts`, `modules/marketplace/domain/orders/marketplace-orders.service.ts`, `modules/treasury-split/treasury-split.service.ts`. Chamam `bankTransactionService.transfer` sem `requireFinancialRiskClearance`. Apenas 3 de 15 caminhos respeitam o gate (payment-execution, reversal, bank-p2p-transfer). |
| **C55** | **OPEN** | **`authority-decision.service.ts` é fail-open em 3 camadas (ATL/KYC/GUARDA)** | **`core/compliance/authority-decision.service.ts`** | **NOVA 2º nível.** Padrão "estado ausente = skip" em ATL (L39476-39541), KYC (L39571-39611), GUARDA. Sistema vazio (estado atual) = todos os skips disparam = autoridade estruturalmente inoperante. Viola AUTHORITY_PRECEDENCE §4.1 frontalmente. |
| **C56** | **OPEN** | **`real-margin.service.ts` deriva receita bruta via metadata+cast numeric** | **`modules/marketplace/real-margin.service.ts:L194079`** | **NOVA 2º nível.** `SUM((oi.metadata->'priceSnapshot'->>'finalPrice')::numeric)` alimenta `gross_revenue` exposto como métrica de produto. Viola LEI §4.6 (proibido derivar decisão financeira de metadata) e PLANO §8. |

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
| C44 | REOPENED | marketplace/group.repository.ts fix parcial | group.types.ts + service | Reaberto 1º nível 2026-04-22. |
| C45 | FIXED | groups.service.ts: findOrCreateUserActor fora do writer | `modules/groups/groups.service.ts` | |
| C46 | FIXED | groups: ownerUserId vs actor_id | 5 arquivos | |
| C50 | OPEN | Padrões culturais passam actorId como globalUserId | cultural | |
| C51 | OPEN | store-onboarding passa actorId como globalUserId | `modules/store-onboarding/` | |
| **C52** | **DECISION_PENDING** | **`payment_intents` tem 2 writers divergentes** | **`modules/marketplace/payment-intent.repository.ts:L187829` + `modules/payments/payment-intent-repository.ts:L221983`** | **NOVA 2º nível.** Contratos diferentes: marketplace insere `(tenant_id, order_id, amount_cents, currency, status, metadata)` com status `'CREATED'`; payments insere `(tenant_id, reference_id, gateway, actor_id, amount_cents, currency, status, metadata)` com status `'created'`. Superset de C10. Decisão: qual é canônico? |
| **C53** | **OPEN** | **6 catches de `42P01` ativos em compliance/events/observability** | **3 arquivos** | **NOVA 2º nível.** Subset reaberto de C14. Arquivos: `core/compliance/authority-decision.service.ts:L39473 + L39530 + L39607` (2 em ATL, 1 em KYC); `core/events/event-handler-failure.repository.ts:L47474,L47486,L47541,L47573` (engolem erro, retornam []/undefined); `core/observability/handler-metrics.service.ts:L76676`. Os 2 de authority-decision são críticos porque conectam com C55. |

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
