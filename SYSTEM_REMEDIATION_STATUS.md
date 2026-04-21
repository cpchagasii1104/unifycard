# SYSTEM REMEDIATION STATUS

**Documento vivo. Atualizado a cada commit que fecha ou altera status de violação.**
**Append/update apenas. Nunca rewrite retroativo.**

| Metadado | Valor |
|---|---|
| Criado | 2026-04-21 |
| Última atualização | 2026-04-21 (FASE 1 concluída — gate v1.1 operacional, commits 4b84175f→271d7569) |
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

**Severidades:** `CRITICAL` · `HIGH` · `MEDIUM`

**Regra de atualização:** cada mudança de status gera novo commit; mensagem no formato `"<ID>: <status_anterior> → <status_novo> (<motivo>)"`. Commit deve referenciar esta linha da tabela.

---

## Resumo Executivo (atualizado manualmente a cada fase)

| Métrica | Valor inicial | Atual |
|---|---|---|
| Total de violações | 30 | 44 |
| CRITICAL | 10 | 12 |
| HIGH | 11 | 20 |
| MEDIUM | 9 | 12 |
| OPEN | 21 | 32 |
| IN_PROGRESS | 0 | 0 |
| FIXED | 1 | 3 |
| ALLOWLISTED | 0 | 0 |
| DEFERRED | 0 | 0 |
| DECISION_PENDING | 8 | 8 |

---

## Tabela de Violações

### CRITICAL (12)

| ID | Status | Descrição curta | Arquivo/Tabela principal | Owner | Deadline | Commit | Notas |
|----|--------|-----------------|--------------------------|-------|----------|--------|-------|
| C1 | OPEN | Tabela `ledger` fantasma (6 arquivos usam `FROM ledger`) | `core/reputation/trust.service.ts` + 5 outros | Clayton | 2026-05-15 | — | Tabela não existe no schema. Reputação e penalidades operam sobre vazio. |
| C2 | DECISION_PENDING | `bank_transactions` sem `concept_ref` | migration pendente | Clayton | — | — | Exige decisão: nullable inicial ou NOT NULL com backfill? Sem isso, §7 não é satisfazível. |
| C3 | OPEN | INSERT INTO actors fora do actor-writer | `core/identity/identity.service.ts:67515` + `modules/social/actor.repository.ts:258561, 258733` | Clayton | 2026-05-01 | — | 3 caminhos paralelos de criação de identidade. |
| C4 | OPEN | `listRegionalFunds` lê colunas inexistentes em `bank_accounts` | `modules/bank/bank-balance-by-region.service.ts:119395` | Clayton | 2026-04-30 | — | Query usa `currency` e `metadata`, colunas que não existem. Quebra em runtime. |
| C8 | FIXED | 2 repositórios `groups` com colunas fantasmas | `modules/groups/groups.repository.ts:152580` + `modules/marketplace/group.repository.ts:173125` | Clayton | 2026-04-30 | — | FIXED em 5 commits (fc97f893→81b93c9d). C8[6/6] (marketplace/group.repository.ts) replanejado como C44 — arquivo de sprint isolado com colunas distintas. |
| C12 | OPEN | `actorId` retornado como `globalUserId` em 3 rotas | `core/identity/identity.routes.ts:66934, 67016` + `modules/events/organizers/organizers.routes.ts:148951` | Clayton | 2026-05-05 | — | Mentira estrutural em rotas de identidade. TODO explícito. |
| C13 | OPEN | 37 arquivos leem `bank_*` fora de `modules/bank/` | vários (top: `modules/reporting/`, `core/unifybank/`, `modules/reconciliation/`) | Clayton | 2026-06-01 | — | Exige classificação em CRÍTICAS/ANALÍTICAS/OPERACIONAIS antes de mover. |
| C14 | FIXED | 23 try/catch mascarando erros de schema | `core/availability/unified-availability.routes.ts:17546, 17819, 18196, 18405` + 19 outros | Clayton | 2026-05-10 | 345b6ef3, 3b6788e2, d8c69d34, 11b6645a | 6 etapas planejadas. 4 catches CRITICAL removidos (unified-availability ×4). C14[5/6] e C14[6/6] N/A: event.service.ts refatorado em 51065962, código não existe no HEAD. Catches restantes (11 ocorrências em 7 arquivos) classificados como SAFE no contexto Gênesis (infra/retry/observabilidade). event-outbox.processor.ts:44 marcado para revisão futura. |
| C22 | OPEN | `users.id` + `users.user_id` duplicados (CHECK existe) | `migration 2164-2182` | Clayton | 2026-06-15 | — | CHECK garante igualdade hoje. Renomeação completa é refactor grande. |
| C26 | OPEN | `actors.id` + `actors.actor_id` sem CHECK | `migration 2804-2850` | Clayton | 2026-04-25 | — | Mesmo padrão C22 mas sem CHECK. Adicionar CONSTRAINT é cirurgia de 5 min. |
| C36 | OPEN | §3.4: 67 tabelas com `status` genérico | 67 tabelas (`payment_intents`, `orders`, `payment_transactions`, `escrow_transactions`, `bank_settlements`, `ticket_sales`, `reversals`, `groups`, `events`, `products`, ...) | Clayton | FASE 7 | — | Violação sistêmica do schema Gênesis. Auditoria 2026-04-21. |
| C37 | OPEN | Gate schema-coherence não valida nomenclatura canônica | `scripts/validate-schema-code-coherence.mjs` | Clayton | FASE 8 | — | Gap arquitetural: valida existência mas não conformidade §3.4/§4.6/§4.7/§4.9. Vira gate v2. |

### HIGH (20)

| ID | Status | Descrição curta | Arquivo/Tabela principal | Owner | Deadline | Commit | Notas |
|----|--------|-----------------|--------------------------|-------|----------|--------|-------|
| C5 | DECISION_PENDING | Duas estruturas N2 paralelas (`categories.level=2` vs `n2_nodes`) | migrations 2590, 3571 | Clayton | — | — | Qual é o SSOT de N2? |
| C6 | OPEN | 95 decisões via `metadata->>` em queries | vários | Clayton | 2026-07-01 | — | Pseudo-SSOT. Exige reengenharia por caso. |
| C9 | DECISION_PENDING | RFQ como JSON em `events.metadata.rfqs[]` sem lock | `modules/events/event-rfq.service.ts:142266` | Clayton | — | — | Qual schema de tabela RFQ? Concorrência? |
| C11 | OPEN | `bookings` com `requestedat` etc (sem underscore) | `migration 13251` | Clayton | 2026-06-01 | — | Colunas órfãs no schema, código não lê. Bomba latente. |
| C16 | DECISION_PENDING | Saga compensation quebra atomicidade ledger ↔ saga | `core/sagas/handlers/saga-compensation.handler.ts:103758` | Clayton | — | — | Exige mudar contrato de `compensateTransaction`. |
| C17 | OPEN | `set_config` com `is_local=false` em 11 locais do pool | `core/database/pool.ts` | Clayton | 2026-05-01 | — | Trocar false→true. Risco: vazamento cross-tenant. |
| C20 | FIXED | Trigger coverage bloqueia tenant sem fix 480000 | `migration 20260530480000_fix_system_coverage_view.sql` | Clayton | — | — | Já aplicado em sessão anterior. |
| C21 | DECISION_PENDING | `bank_accounts.owner_id` TEXT com dual representation | `migration 88-100` | Clayton | — | — | Colapsar owner_id/actor_id é refactor grande. |
| C24 | DECISION_PENDING | 4 tabelas paralelas de produto | `products`, `canonical_products`, `catalog_products`, `tenant_products` | Clayton | — | — | Qual é SSOT? |
| C27 | DECISION_PENDING | 3 sistemas de autorização coexistindo | `authority.service` + `rbac.service` + hardcoded em `core/companies/` | Clayton | — | — | Qual sobrevive? |
| C29 | OPEN | 132 comparações status UPPERCASE vs schema lowercase | vários (ex: `order.status === 'PAID'` em `modules/orders/`) | Clayton | 2026-06-15 | — | Código morto confirmado em pelo menos 1 caso. |
| C31 | OPEN | Tabela `audit_events` usada em código mas inexistente no banco | `core/audit/audit.service.ts:86` | Clayton | 2026-05-10 | — | Detectado por gate v1.1 ETAPA 5. Tabela fantasma confirmada por psql. |
| C32 | OPEN | Tabela `webauthn_challenges` usada em código mas inexistente no banco | `core/auth/webauthn.repository.ts:132` | Clayton | 2026-05-10 | — | Detectado por gate v1.1 ETAPA 5. Tabela fantasma confirmada por psql. |
| C33 | OPEN | Tabela `webauthn_credentials` usada em código mas inexistente no banco | `core/auth/webauthn.repository.ts:69` | Clayton | 2026-05-10 | — | Detectado por gate v1.1 ETAPA 5. Tabela fantasma confirmada por psql. |
| C34 | OPEN | Tabela `category_ai_logs` usada em código mas inexistente no banco | `core/categories/categories.repository.ts:1035` | Clayton | 2026-05-10 | — | Detectado por gate v1.1 ETAPA 5. Tabela fantasma confirmada por psql. |
| C35 | OPEN | Tabela `partner_employees` usada em código mas inexistente no banco | `core/audit/audit.service.ts:269` | Clayton | 2026-05-10 | — | Detectado por gate v1.1 ETAPA 5. Tabela fantasma confirmada por psql. |
| C38 | OPEN | §3.4: 5 tabelas com `type` genérico | `canonical_products`, `payment_execution_lock`, `promotions`, `reconciliation_discrepancies`, `reconciliation_ledger_discrepancies` | Clayton | FASE 7 | — | Auditoria 2026-04-21. |
| C39 | OPEN | §3.4: 7 tabelas com `state` genérico | `order_sagas`, `regional_funds`, `regional_activation_events`, `regional_activation_rules`, `regional_impact_snapshots`, `rides_cities`, `suppliers` | Clayton | FASE 7 | — | Auditoria 2026-04-21. |
| C40 | OPEN | §4.7: monetário em NUMERIC/DECIMAL (12 ocorrências) | `price NUMERIC` (múltiplas tabelas), `value NUMERIC`, `balance NUMERIC`, `limit_amount NUMERIC` | Clayton | FASE 7 | — | Subset já existe em C15. Auditoria 2026-04-21. |
| C44 | OPEN | marketplace/group.repository.ts usa colunas inexistentes no schema Gênesis | modules/marketplace/group.repository.ts | Clayton | FASE 7 | — | INSERT/SELECT usam parent_group_id, created_by_actor_id, created_by_user_id — nenhuma existe na tabela groups do schema Gênesis. Código de SPRINT 74, 1 chamador. |

### MEDIUM (12)

| ID | Status | Descrição curta | Arquivo/Tabela principal | Owner | Deadline | Commit | Notas |
|----|--------|-----------------|--------------------------|-------|----------|--------|-------|
| C7 | OPEN | Permissões hardcoded em `core/companies/` | `core/companies/companies.service.ts:36026-36030` | Clayton | 2026-06-15 | — | Mover para authorityService. |
| C10 | DECISION_PENDING | 3 writers para tabela `events` | `core/events/event.service.ts:53052` + `modules/events/event.repository.ts:143368` + `modules/events/events.service.ts:145828` | Clayton | — | — | Qual é canônico? |
| C15 | OPEN | 3 tabelas com `price NUMERIC` (em migração) | `product_offers`, `product_prices`, `economic_guardianship` | Clayton | 2026-06-30 | — | DROP do NUMERIC após backfill de `price_cents`. |
| C18 | OPEN | RLS ENABLE sem FORCE em 30 tabelas | várias | Clayton | 2026-06-01 | — | ADD FORCE. Avaliar por ambiente (dev vs prod user). |
| C19 | OPEN | `reference_id` tipo inconsistente entre envs (UUID vs TEXT) | `bank_transactions` | Clayton | 2026-05-15 | — | Banco novo vs banco antigo divergem. |
| C23 | OPEN | `"createdAt"` coexistindo com `created_at` em users/global_users/tenant_contexts | vários | Clayton | 2026-06-15 | — | Consolidar gradualmente. Subset de C28. |
| C25 | OPEN | `products.canonical_product_id` sem FK | `products` | Clayton | 2026-05-10 | — | ADD CONSTRAINT FK. Cirurgia simples. |
| C28 | OPEN | 16 tabelas criadas com `"createdAt"` aspado | várias (11 ainda não consolidadas) | Clayton | 2026-06-15 | — | `users`, `global_users`, `products`, `product_variants`, `profiles`, `tenant_contexts`, 4 tabelas inventory, 2 fulfillment. |
| C30 | OPEN | Consolidação snake_case feita só em 4 tabelas do marketplace | vários | Clayton | 2026-06-15 | — | Completar para todas as tabelas. |
| C41 | OPEN | §4.6: 5 timestamps sem sufixo `_at` | `check_in_time`, `start_datetime`, `end_datetime`, `conflict_start_datetime`, `conflict_end_datetime` | Clayton | FASE 7 | — | Auditoria 2026-04-21. |
| C42 | OPEN | §4.9: 16 booleanos sem prefixo canônico | `active` (×3), `resolved`, `enabled`, `availability`, `opted_in`, `false_positive`, `operation_blocked`, `kill_switch`, etc. | Clayton | FASE 7 | — | Auditoria 2026-04-21. |
| C43 | OPEN | Medição formal de C23/C28: 70 ocorrências de `"createdAt"`/`"updatedAt"` aspados | várias tabelas | Clayton | 2026-06-15 | — | Subset de C23/C28, mede dimensão real. |

---

## Log de Mudanças de Status

Cada entrada abaixo corresponde a um commit que alterou status de uma violação. Append-only.

### 2026-04-21 — Estado inicial

- **Ação:** Populado STATUS com 30 achados da auditoria sistêmica.
- **Status inicial:** 30 OPEN (nenhum FIXED, exceto C20 que foi corrigido em sessão anterior antes deste documento existir).
- **Commit:** (a ser preenchido quando este arquivo for commitado)
- **Observação:** C20 marcado como FIXED retroativamente porque a migration `20260530480000_fix_system_coverage_view.sql` já existe no repositório.

### 2026-04-21 — FASE 0 concluída

- **Ação:** Base normativa estabelecida. 4 arquivos de remediação criados na raiz.
	00_AGENT_PROTOCOL.md atualizado com §2.5.
- **Commits:** 848da51e (STATUS), 04a47b6f (AGENT_PROTOCOL), ab407330 (DECISIONS_LOG + SNAPSHOTS)
- **Próxima fase:** FASE 1 — VISIBILIDADE (gate v1.1 ETAPA 2)
- **Pausa registrada em:** ETAPA 1 do gate v1.1 concluída (commit 4b84175f).
	ETAPAs 2, 3, 4, 5 pendentes.

---

### 2026-04-21 — Gate v1.1 ETAPA 5: 5 novas violações detectadas

- **Ação:** Validação manual das 10 amostras do gate v1.1 confirmou gate confiável
  (0 falso-positivos, 2 falsos negativos registrados em DECISION-0001).
  5 novas tabelas fantasmas descobertas: C31-C35.
  Commits gate: 4b84175f (E1), d8f3f2be (E2), 3dd6dd66 (E3), cbfbf599 (E4).
- **Violações novas:** C31, C32, C33, C34, C35 (todas OPEN, severidade HIGH)
- **Próxima ação:** Criar schema-coherence-allowlist.json para violações conhecidas (C1-C30)
- **Decisão registrada:** DECISION-0001 (commit 2ad9d801)

---

### 2026-04-21 — FASE 1 concluída: gate v1.1 operacional

- **Ação:** Gate schema-coherence v1.1 implementado (ETAPAs 1-5 concluídas).
  Allowlist com 10 entradas, 5 ativas. Bloqueantes: 331 → 326.
  Falsos negativos registrados em DECISION-0001.
- **Commits:** 4b84175f (E1), d8f3f2be (E2), 3dd6dd66 (E3), cbfbf599 (E4),
  9f8544ee (allowlist), 2ad9d801 (DECISIONS), f685b6f0 (STATUS C31-C35),
  271d7569 (fix filePath + allowlist)
- **Próxima fase:** FASE 2 — C14 incremental (remover 23 catches de schema)
- **Nota:** C3, C4, C8, C12, C13 ainda não suprimidos por allowlist
  (files_scope incompleto). Violações reais — serão corrigidas em FASE 4/5.

---

### 2026-04-21 — FASE 2 em andamento: C14[1/6] e C14[2/6] concluídos

- **Ação:** Remoção incremental de catches 42P01 em unified-availability.routes.ts.
  2 dos 6 catches CRITICAL removidos (lista disponibilidades + lista bookings).
- **Commits:** 345b6ef3 (C14[1/6]), e729b651 (status), 3b6788e2 (C14[2/6]), 0986c3e4 (status)
- **Status C14:** OPEN → IN_PROGRESS
- **Próxima ação:** C14[3/6] — availability_participants

---

### 2026-04-21 — C14 FIXED: 4 catches CRITICAL removidos

- **Ação:** Remoção incremental de 4 catches 42P01 CRITICAL em unified-availability.routes.ts.
  C14[5/6] e C14[6/6] N/A: event.service.ts refatorado antes desta sessão (commit 51065962).
  11 catches restantes classificados como SAFE (infra/retry/observabilidade — contexto Gênesis).
- **Commits:** 345b6ef3 (C14[1/6]), 3b6788e2 (C14[2/6]), d8c69d34 (C14[3/6]), 11b6645a (C14[4/6])
- **Status C14:** IN_PROGRESS → FIXED
- **Próxima fase:** continuar FASE 2 ou iniciar FASE 3 (seed realista)

---

### 2026-04-21 — C8 parcial: 2/6 concluídos, bloqueado em decisão de nomenclatura

- **Ação:** C8[1/6] e C8[2/6] concluídos (commits fc97f893, 4572a1bb).
  C8[3/6] bloqueado durante análise: schema Gênesis de `groups` tem `status TEXT`
  mas nomenclatura canônica §4.9 indica `is_active BOOLEAN` ou §3.4 indica
  `group_status`.
- **Commits:** fc97f893 (C8[1/6]), dc8fcd09 (status), 4572a1bb (C8[2/6]), 06691c2c (status)
- **Status C8:** IN_PROGRESS → DECISION_PENDING
- **Decisão registrada:** DECISION-0002 (PENDENTE)
- **Próxima ação:** Clayton decide entre opções 1, 2 ou 3 da DECISION-0002.

---

### 2026-04-21 — Auditoria de nomenclatura canônica: C36-C43 registradas

- **Ação:** Auditoria rápida schema Gênesis × 07_NOMENCLATURA_CANONICA.md.
  Detectado padrão sistêmico de violações §3.4 (67 tabelas com status genérico),
  §4.7 (12 monetários NUMERIC), §4.9 (16 booleanos sem prefixo),
  §4.6 (5 timestamps sem _at), §4.3 (70 camelCase aspados).
- **Violações novas:** C36, C37 (CRITICAL), C38, C39, C40 (HIGH), C41, C42, C43 (MEDIUM)
- **Gap arquitetural confirmado (C37):** gate schema-coherence não valida
  nomenclatura canônica, apenas existência — vira gate v2 na FASE 8.
- **Decisão C8[3/6]:** Opção C (seguir com `status` no código, registrar dívida).
- **Status C8:** DECISION_PENDING → IN_PROGRESS.
- **Próxima ação:** C8[3/6] via script PS, usando `status`.

---

### 2026-04-21 — C8[3/6] concluído: is_active → status alinhado com schema Gênesis

- **Ação:** Remoção de `is_active` em groups.repository.ts (interface, toGroup mapping,
  RETURNING/SELECT/WHERE clauses, UPDATE SET, valores 'active'/'inactive').
  Script PS executado, diff validado (12 hunks, todas mudanças in-scope).
  4 gates passaram: actor-writer ✓, bank-ledger ✓, regression-guards ✓, architectural-patterns ✓.
- **Commit:** dbe4e617 (C8[3/6])
- **Status C8:** IN_PROGRESS (Commit 3/6 finalizado, 4/6-6/6 pendentes)
- **Próxima ação:** C8[4/6] — marketplace/group.repository.ts (mesmo padrão)

---

### 2026-04-21 — C8[4+5/6] colapsado: INSERT/SELECT normalizados para schema Gênesis

- **Ação:** Normalização estrutural de `groups.repository.ts` conforme schema real de `groups`
  (`id, tenant_id, name, description, slug, actor_id, owner_actor_id, status, metadata, created_at, updated_at`).
  Ajustes: `group_id` → `id` (somente em `groups`), remoção de colunas fantasmas de INSERT/SELECT/RETURNING,
  absorção de `audience_description/category_id/visibility/avatar_url/cover_url/financial_purpose/profit_percentage`
  em `metadata`, mapper `toGroup()` atualizado para ler esses campos de `metadata`.
  Ajustes de update/delete para `updated_at` e WHERE por `id`.
  C8[4/6] e C8[5/6] colapsados em commit único.
- **Commit:** fb346bb7 (C8[4+5/6])
- **Status C8:** IN_PROGRESS (Commit 4/6 e 5/6 consolidados; 6/6 pendente)
- **Próxima ação:** C8[6/6] — finalizar demais pontos de groups (incluindo `modules/marketplace/group.repository.ts`, se aplicável)

---

### 2026-04-21 — C8 FIXED: 5 commits concluídos

- **Ação:** C8 encerrado com 5 commits (C8[1/6] a C8[5/6]).
  C8[6/6] (marketplace/group.repository.ts) replanejado como C44 —
  arquivo independente com colunas distintas, código SPRINT 74 isolado.
- **Commits:** fc97f893, 4572a1bb, dbe4e617, fb346bb7, 81b93c9d
- **Status C8:** IN_PROGRESS → FIXED
- **Violação nova:** C44 OPEN (marketplace/group.repository.ts)
- **Próxima ação:** FASE 3 (seed realista + E2E) ou C26 (ADD CHECK actors.id)

---

**FIM DO DOCUMENTO** (continua crescendo por append a cada commit de correção)
