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
| Total de violações | 30 | 35 |
| CRITICAL | 10 | 10 |
| HIGH | 11 | 16 |
| MEDIUM | 9 | 9 |
| OPEN | 21 | 26 |
| IN_PROGRESS | 0 | 0 |
| FIXED | 1 | 1 |
| ALLOWLISTED | 0 | 0 |
| DEFERRED | 0 | 0 |
| DECISION_PENDING | 8 | 8 |

---

## Tabela de Violações

### CRITICAL (10)

| ID | Status | Descrição curta | Arquivo/Tabela principal | Owner | Deadline | Commit | Notas |
|----|--------|-----------------|--------------------------|-------|----------|--------|-------|
| C1 | OPEN | Tabela `ledger` fantasma (6 arquivos usam `FROM ledger`) | `core/reputation/trust.service.ts` + 5 outros | Clayton | 2026-05-15 | — | Tabela não existe no schema. Reputação e penalidades operam sobre vazio. |
| C2 | DECISION_PENDING | `bank_transactions` sem `concept_ref` | migration pendente | Clayton | — | — | Exige decisão: nullable inicial ou NOT NULL com backfill? Sem isso, §7 não é satisfazível. |
| C3 | OPEN | INSERT INTO actors fora do actor-writer | `core/identity/identity.service.ts:67515` + `modules/social/actor.repository.ts:258561, 258733` | Clayton | 2026-05-01 | — | 3 caminhos paralelos de criação de identidade. |
| C4 | OPEN | `listRegionalFunds` lê colunas inexistentes em `bank_accounts` | `modules/bank/bank-balance-by-region.service.ts:119395` | Clayton | 2026-04-30 | — | Query usa `currency` e `metadata`, colunas que não existem. Quebra em runtime. |
| C8 | OPEN | 2 repositórios `groups` com colunas fantasmas | `modules/groups/groups.repository.ts:152580` + `modules/marketplace/group.repository.ts:173125` | Clayton | 2026-04-30 | — | Ambos escrevem colunas que não existem. Explica `groups=0` no banco. |
| C12 | OPEN | `actorId` retornado como `globalUserId` em 3 rotas | `core/identity/identity.routes.ts:66934, 67016` + `modules/events/organizers/organizers.routes.ts:148951` | Clayton | 2026-05-05 | — | Mentira estrutural em rotas de identidade. TODO explícito. |
| C13 | OPEN | 37 arquivos leem `bank_*` fora de `modules/bank/` | vários (top: `modules/reporting/`, `core/unifybank/`, `modules/reconciliation/`) | Clayton | 2026-06-01 | — | Exige classificação em CRÍTICAS/ANALÍTICAS/OPERACIONAIS antes de mover. |
| C14 | OPEN | 23 try/catch mascarando erros de schema | `core/availability/unified-availability.routes.ts:17546, 17819, 18196, 18405` + 19 outros | Clayton | 2026-05-10 | — | Executar incrementalmente: 1 catch por commit. |
| C22 | OPEN | `users.id` + `users.user_id` duplicados (CHECK existe) | `migration 2164-2182` | Clayton | 2026-06-15 | — | CHECK garante igualdade hoje. Renomeação completa é refactor grande. |
| C26 | OPEN | `actors.id` + `actors.actor_id` sem CHECK | `migration 2804-2850` | Clayton | 2026-04-25 | — | Mesmo padrão C22 mas sem CHECK. Adicionar CONSTRAINT é cirurgia de 5 min. |

### HIGH (11)

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

### MEDIUM (9)

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

**FIM DO DOCUMENTO** (continua crescendo por append a cada commit de correção)
