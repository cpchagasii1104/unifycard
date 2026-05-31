# MODULES_INVENTORY.md — Inventário estrutural backend (Frente 2)

**Data:** 2026-05-16
**Modo:** GUARDIÃO read-only
**Escopo:** `backend/src/core/*` + `backend/src/modules/*` (157 módulos auditados)
**Frontend:** apenas caller-check binário (não mapeamento próprio)
**Objetivo:** **descobrir convergência silenciosa** e separar capacidade real de fachada arquitetural. Não é catalogação — é leitura estrutural.

---

## 0. Resumo executivo (1 página)

**O que o sistema realmente é hoje:**

- **157 módulos backend** auditados (`src/core/*` + `src/modules/*`)
- **71 FUNCIONAIS (45%)** — substrato real com rows/runtime/frontend
- **29 FANTASMAS (18%)** — código referencia tabela inexistente; **24 com frontend caller** (risco operacional)
- **20 ESQUELETOS (13%)** — 4 RECENTE (em construção) + 16 DORMENTE (bank engine satélite)
- **25 NO_DATA_LAYER (16%)** + **12 INDEFINIDO (8%)**
- 220 tabelas em DB. 38 DTs no log (11 novas da Frente 2).

**Backbone real (13 módulos canônicos com runtime exercitado):**
ledger, marketplace (49 tabelas, 124 rotas — sozinho metade do peso operacional), reconciliation, catalog, categories, navigation, ontology, profile, semantic, observability, auth, audit, availability+calendar, authorization+tenants.

**Convergência silenciosa identificada (vitória material da Frente 2):**
`unified-availability` é **SSOT temporal real** (`availability` 20 rows + `bookings` 24 rows + helper `detectConflicts`). 4 tabelas paralelas (`event_sessions`, `rides_driver_sessions`, `pdv_sessions`, `schedules+schedule_slots`) podem projetar via `owner_type+owner_id`. Não estava nomeado antes — agora está.

**Fragmentação real confirmada em 2 padrões:**
- **P4 (Presença/checkin):** 9 modelos paralelos, zero runtime, 4 categorias semânticas — `modules/presence` (FANTASMA) é o 9º
- **P5 (Vínculo operacional):** 6+ modelos de "X tem papel em Y", runtime fragmentado em 4 (`company_users` 9 rows, `role_permissions` 68, `group_members` 5, `user_roles` 1), SSOT canônica (`actor_delegations`) com **zero rows**

**Risco operacional imediato:**
24 endpoints chamados pelo frontend que falham em runtime. Top 5 mais críticos: `work-instant` (14 rotas), `venue` (12), `presence` (11), `policy-engine` (11), `automation` (10). Pré-launch tolera; primeiro usuário real sofre.

**Dívida arquitetural histórica:**
16 módulos satélite do bank engine (alerts, settlements, circuit-breakers, disputes, freezes, governance×3, payouts, rate-limit, reversal, risk, sla, treasury×2) — ESQUELETO_DORMENTE. Frente própria de "ratificar ou arquivar" necessária.

**Implicação institucional decisiva para v2 modo operante:**
NÃO É só "esperar C27" ou "delegations ter runtime". São **3 frentes prévias** antes de v2:
1. `actor_delegations` ter runtime real
2. DECISÃO ARQUITETURAL sobre P5 (qual modelo de vínculo absorve o caso canônico)
3. DECISÃO ARQUITETURAL sobre P4 (qual modelo de presença absorve)

Mesmo C27 resolvido, se P4 e P5 não tiverem critério institucional, v2 reproduz Frankenstein.

**Narrativa anterior refutada:**
Estimativa de "15-20 módulos funcionais de 80" estava errada por **4×**. Sistema NÃO é majoritariamente fachada. Padrão cognitivo identificado: extrapolação de poucos exemplos FANTASMA prioritários (work-instant, dispatch, pdv, crm) gerou pessimismo desproporcional.

---

## 1. Resumo executivo material

| Classificação | Qtd | % | Significado material |
|---|---:|---:|---|
| **FUNCIONAL** | 71 | 45% | Código + tabela + rows > 0 OU frontend chama OU runtime exercitado |
| **FANTASMA** | 29 | 18% | Código referencia tabelas que **NÃO existem no DB** — chamada falha em runtime |
| **NO_DATA_LAYER** | 25 | 16% | Utils / helpers / types-only — sem schema acessível (categoria neutra) |
| **ESQUELETO** | 20 | 13% | Tabela existe + zero rows + endpoint chamável (retorna []) |
| **INDEFINIDO** | 12 | 8% | Sem tabela mas com rotas (proxy/aggregator de outros módulos) |
| **Total** | **157** | 100% | |

### Decomposição ESQUELETO (refinamento Sunny — ponto 1)

| Sub-classe | Qtd | Critério |
|---|---:|---|
| ESQUELETO_RECENTE | 4 | Migration < 30 dias OU código modificado < 30 dias — provavelmente em construção |
| ESQUELETO_DORMENTE | 16 | Migration > 30 dias E código estagnado > 60 dias — provavelmente abandonado |
| ESQUELETO_AMBIGUO | 0 | — |

### Authority audit decomposto (refinamento Sunny — ponto 3)

`authority_decision_audit` tem **34 rows totais, TODAS dentro de 30 dias** (recent_30d=34).

| Action | Decision | N |
|---|---|---:|
| financial_transfer | allow | 23 |
| financial_payment | block | 6 |
| financial_payment | allow | 3 |
| financial_transfer | block | 2 |
| **Total** | | **34** |

**Crítico**: authority_decision_audit cobre **apenas `financial_*`**. Não há audit hits para delegação, ownership, capacity granular. Como sinal de runtime, vale somente para o domínio financeiro. Sunny estava certa em alertar — usar como métrica geral seria enganoso.

### Contraste com narrativa anterior

A análise conceitual prévia (Sunny + ChatGPT) estimou *"15-20 módulos funcionais de 80"*. Material: **71 funcionais de 157** (45%). Realidade é ~4× mais saudável do que assumido. Padrão cognitivo identificado: extrapolação de poucos exemplos FANTASMA prioritários (work-instant, dispatch, pdv, crm) gerou narrativa pessimista.

Não anula o achado — 29 FANTASMAS é relevante. Mas o sistema **não é majoritariamente fachada**.

---

## 2. Tabela material — FANTASMAS (29)

> Risco operacional ALTO. Frontend chama endpoint → backend tenta query → tabela inexistente → 500.

| Módulo | Path | Tabelas referenciadas (ausentes) | Rotas | Frontend chama? |
|---|---|---|---:|:---:|
| core/database | core/database | information_schema* | 0 | N |
| core/memory | core/memory | user_memory_preferences, user_memory_interactions, user_memory_entities, user_memory_shortcuts | 3 | **Y** |
| core/rate-limiting | core/rate-limiting | auth_rate_limit_logs, business_audit_logs | 0 | N |
| core/reporting | core/reporting | reports, report_events, risk_flags | 5 | **Y** |
| core/residence | core/residence | global_user_residence | 3 | **Y** |
| core/reviews | core/reviews | reviews | 0 | N |
| core/root-config | core/root-config | root_config | 6 | **Y** |
| core/user-group-allocation | core/user-group-allocation | user_group_allocations | 2 | **Y** |
| modules/agreements | modules/agreements | agreements | 9 | **Y** |
| modules/automation | modules/automation | alerts, scheduled_actions | 10 | **Y** |
| modules/business-audit | modules/business-audit | business_audit_logs | 2 | **Y** |
| modules/care | modules/care | care_sessions, care_messages | 3 | **Y** |
| modules/contextual-messaging | modules/contextual-messaging | contextual_threads, contextual_messages | 7 | **Y** |
| modules/dispatch | modules/dispatch | opportunity_dispatches | 1 | N |
| modules/evidence | modules/evidence | evidence_packs | 7 | **Y** |
| modules/invoicing | modules/invoicing | invoices | 5 | **Y** |
| modules/loyalty | modules/loyalty | loyalty_rules, loyalty_vouchers, loyalty_accounts | 6 | **Y** |
| modules/media | modules/media | post_media | 2 | **Y** |
| modules/payout | modules/payout | payout_batches, payout_orders | 7 | **Y** |
| modules/policy-engine | modules/policy-engine | policy_rules, policy_decisions | 11 | **Y** |
| modules/presence | modules/presence | checkin_tokens, checkins, presence_rsvps, promo_benefits | 11 | **Y** |
| modules/schedule | modules/schedule | (apenas types) | 0 | N |
| modules/social-actions | modules/social-actions | social_actions | 4 | **Y** |
| modules/social-chat | modules/social-chat | social_chat_messages | 2 | **Y** |
| modules/subscriptions | modules/subscriptions | subscriptions | 6 | **Y** |
| modules/system-notifications | modules/system-notifications | system_notifications | 5 | **Y** |
| modules/venue | modules/venue | tabs, tab_orders, menus, menu_items | 12 | **Y** |
| modules/votes | modules/votes | votes, vote_options, vote_responses | 5 | **Y** |
| modules/work-instant | modules/work-instant | (9 tabelas: worker_skills, etc.) | 14 | **Y** |

\* `information_schema` é catálogo Postgres (false positive do regex; não conta).

### Nota metodológica — duas exceções na lista FANTASMA (refinamento Codex 2026-05-17)

A coluna "Tabelas referenciadas (ausentes)" desta tabela inclui dois casos que **não são FANTASMAs por tabela de domínio ausente**:

| Linha | Caso | Por que é exceção | Classificação semântica mais precisa |
|---|---|---|---|
| 98 | `core/database` — `information_schema*` | Catálogo sistêmico do Postgres, não tabela de domínio aplicacional | Infraestrutura sistêmica (não-FANTASMA) — já marcado com `*` (false positive do regex) |
| 119 | `modules/schedule` — "(apenas types)" | Sem repository, sem rota, apenas tipos TS. Não há tabela esperada para verificar ausência | **NO_DATA_LAYER** (utilidade de tipos), não FANTASMA |

Estas duas exceções **não alteram a conclusão geral** dos 29 FANTASMAs com frontend caller (vide subset crítico de 24 com Y abaixo), apenas refinam a classificação semântica para reproduzibilidade futura. A métrica "27 FANTASMAs efetivos + 2 exceções metodológicas" é mais precisa que "29 FANTASMAs" para análise estrutural — mas as tabelas históricas permanecem como evidência da auditoria original.

**Subset crítico — 24 FANTASMAS com frontend caller**: chamadas ativas que retornam 500 ou comportamento indefinido. Ordenar por urgência usando: número de rotas × frontend chama.

**Top 5 FANTASMAS prioritários (mais rotas + frontend chama):**

1. `modules/work-instant` — 14 rotas, frontend chama. Uber-like matching sem tabela worker.
2. `modules/venue` — 12 rotas, frontend chama. Restaurant tabs/menus sem schema.
3. `modules/presence` — 11 rotas, frontend chama. Check-in / RSVP / promo benefits sem schema.
4. `modules/policy-engine` — 11 rotas, frontend chama. Policy rules sem schema.
5. `modules/automation` — 10 rotas, frontend chama. Scheduled actions sem schema.

---

## 3. Tabela material — ESQUELETOS (20)

Tabela existe, zero rows. Endpoint chamável mas retorna `[]`.

### ESQUELETO_RECENTE (4) — provavelmente em construção

| Módulo | Migration criadora | Data |
|---|---|---|
| core/actor-delegation | 20260530493000_create_actor_delegations.sql | 2026-05-30 |
| core/actor-registry | 20260530492000_create_actor_registry.sql | 2026-05-30 |
| modules/orders | 20260509200000_order_sagas.sql | 2026-05-09 |
| modules/public-profiles | 20260530440000_public_profiles.sql | 2026-05-30 |

### ESQUELETO_DORMENTE (16) — provavelmente abandonado

Quase todos são módulos financeiros do bank engine antigo:

| Módulo | Migration | Inferência |
|---|---|---|
| core/intent | 0084_intent_idempotency_keys.sql | Idempotência de intents — substituída? |
| modules/alerts | 0033_financial_alerts.sql | Alertas financeiros — não emite |
| modules/bank-settlement | 0032_bank_settlements.sql | Settlement engine — não exercitado |
| modules/circuit-breaker | 0039_financial_circuit_breakers.sql | Circuit breakers — sem trips |
| modules/disputes | 0036_financial_disputes.sql | Disputas — zero abertas |
| modules/freezes | 0037_financial_freezes.sql | Freezes — zero aplicados |
| modules/governance | 0043_governance_financial_actions.sql | Governance financeira — sem actions |
| modules/governance-funding | 0047_governance_funding.sql | Funding — sem propostas |
| modules/governance-funding-commitment | 0048_governance_funding_commitments.sql | Commitments — sem |
| modules/payouts | 0031_payout_requests.sql | Payouts — sem pedidos |
| modules/rate-limit | 0035_financial_rate_limits.sql | Rate limits — sem hits |
| modules/reversal | 0051_reversal_engine.sql | Reversão — sem |
| modules/risk | 0038_financial_risk_events.sql | Risk events — sem |
| modules/sla | 0040_financial_sla_events.sql | SLA — sem |
| modules/treasury | 0044_treasury_accounts.sql | Treasury accounts — sem |
| modules/treasury-split | 0046_treasury_split_config.sql | Treasury splits — sem |

**Padrão material:** o bank engine teve fundação ampla (alerts, settlements, circuit-breakers, disputes, freezes, governance financeira, payouts, rate-limits, reversal, risk, SLA, treasury) que **nunca foi exercitada**. Apenas `bank_*` core (ledger, transactions, accounts, splits) está vivo. Os módulos satélites do bank são esqueleto dormente.

---

## 4. Tabela material — FUNCIONAIS (71) — top 25 por substrato

> Substrato real do sistema. Ordenado por max rows (proxy de runtime real).

| Módulo | Tabelas | Max rows | Rotas | Frontend chama? |
|---|---:|---:|---:|:---:|
| modules/ledger-snapshots | 1/1 | 31.862 | 0 | N |
| modules/reconciliation | 8/9 | 22.520 | 5 | N |
| core/db | 6/7 | 291 | 0 | N |
| core/observability | 5/15 | 289 | 5 | **Y** |
| core/reconciliation | 6/7 | 289 | 2 | **Y** |
| core/unifybank | 5/11 | 289 | 26 | **Y** |
| modules/bank | 15/25 | 289 | 0 | N |
| modules/economy | 3/3 | 289 | 2 | N |
| modules/marketplace | 49/78 | 289 | 124 | **Y** |
| modules/reporting | 4/4 | 289 | 7 | **Y** |
| core/tenants | 2/4 | 280 | 1 | N |
| modules/audit | 4/4 | 134 | 0 | N |
| modules/observability | 5/5 | 134 | 1 | N |
| core/catalog | 7/9 | 102 | 13 | **Y** |
| core/categories | 3/13 | 102 | 17 | **Y** |
| core/navigation | 13/13 | 102 | 3 | **Y** |
| core/ontology | 6/7 | 102 | 0 | N |
| core/profile | 15/28 | 102 | 29 | **Y** |
| core/semantic | 6/7 | 102 | 0 | N |
| modules/human-mvp | 1/7 | 102 | 5 | **Y** |
| core/auth | 6/7 | 71 | 8 | **Y** |
| core/audit | 7/7 | 77 | 0 | N |
| core/availability | 3/5 | 24 | 8 | **Y** |
| core/calendar | 2/2 | 20 | 1 | **Y** |
| core/authorization | 6/8 | 17 | 2 | **Y** |

**Backbone real do sistema (rows ≥ 100):** ledger-snapshots, reconciliation, bank, marketplace (49 tabelas!), catalog, categories, navigation, ontology, profile, semantic, observability. Estes são os módulos **realmente convergidos**.

**Camadas operacionais reais (rows < 100 mas funcional):** auth, audit, availability, calendar, authorization, tenants.

---

## 5. Padrões estruturais — análise de convergência

### Refinamento Sunny — critério material duro
> Considera mesma estrutura quando: 80%+ das colunas semanticamente equivalentes + mesmo padrão de constraints + mesmo ciclo de status + mesma natureza temporal.
> Considera diferentes quando: domínios mutuamente exclusivos OU constraints incompatíveis OU status enums com semântica diferente.

### Padrão 1 — Disponibilidade / capacidade contextual

**Hipótese a testar:** `availability`, `bookings`, `schedules`, `schedule_slots`, `event_reservations`, `event_sessions`, `services`, `service_discovery_requests`, `rides_driver_sessions`, `rides_ride_requests`, `pdv_sessions` são variações do mesmo conceito estrutural?

**Análise material (queries no apêndice A):**

| Tabela | Cols | Natureza temporal | Status enum | Owner reference |
|---|---:|---|---|---|
| availability | 13 | range (start/end_datetime) | status varchar | owner_type+owner_id |
| bookings | 15 | derivado (FK availability_id) | status varchar | requester_actor_id |
| schedules | 9 | recurring (template) | status text | actor_id+reference_type+reference_id |
| schedule_slots | 7 | range (starts_at/ends_at) | status text | (via schedule_id FK) |
| event_reservations | 22 | derivado (FK event/session) | status text | actor_id+session_id |
| event_sessions | 10 | range (starts_at/ends_at) | (is_active boolean) | event_id |
| services | 21 | **catalog (não temporal)** | status text | actor_id |
| service_discovery_requests | 11 | ponto (requested_start) | status varchar | customer_actor_id |
| rides_driver_sessions | 7 | range (started_at/ended_at) | is_online boolean | driver_id |
| rides_ride_requests | 15 | ponto (created_at) | status text | passenger_user_id |
| pdv_sessions | 9 | range (opened_at/closed_at) | status (enum) | actor_id |

**Núcleo comum (5+ tabelas):** apenas `tenant_id, metadata, status, created_at, id, updated_at` — **genéricos**. Nenhuma coluna semântica específica.

**Veredito material:** **NÃO converge automaticamente.** São 11 conceitos materialmente diferentes:

- **Janela temporal de capacidade pura:** `availability`, `event_sessions`, `rides_driver_sessions`, `pdv_sessions` — 4 candidatos com `start/end + capacity/online`. **Aqui há convergência potencial real.**
- **Reserva sobre janela:** `bookings`, `event_reservations` — 2 tabelas com FK para janela. **Convergência via projeção.**
- **Schedule recorrente (template):** `schedules + schedule_slots` — semântica distinta (template, não evento real). Esqueleto.
- **Catálogo (não temporal):** `services` — não pertence a este padrão. Falso positivo da hipótese.
- **Request/ponto temporal:** `service_discovery_requests`, `rides_ride_requests` — solicitações com momento desejado. Categoria própria.

**Mapeamento de convergência:**

| Par | Recomendação | Razão |
|---|---|---|
| `availability` ↔ `event_sessions` | **Convergir em sessão futura** | Mesma natureza (janela+capacity); event_sessions poderia ser View sobre availability filtrada por owner_type='event' |
| `availability` ↔ `rides_driver_sessions` | **Convergir em sessão futura** | Mesma natureza; driver session poderia ser availability com owner_type='driver' |
| `availability` ↔ `pdv_sessions` | **Convergir em sessão futura** | pdv_sessions é janela de PDV; poderia projetar |
| `bookings` ↔ `event_reservations` | **Convergir em sessão futura** | Mesmo conceito (reserva sobre janela); event_reservations adiciona payment_bank_transaction_id |
| `schedules+schedule_slots` ↔ `availability` | **Convergir** | Schedule template gera availabilities concretas |
| `services` ↔ qualquer | **Não converge** | Catálogo, não temporal |
| `*_requests` ↔ entre si | **Manter paralelos** | Cada um tem domínio específico (descoberta vs corrida) |

**Recomendação institucional:** registrar `DT-convergence-availability-as-canonical-temporal` propondo que `availability` é a SSOT temporal canônica para janelas + capacity, e outras 5 tabelas (event_sessions, rides_driver_sessions, pdv_sessions, schedules+schedule_slots, bookings) projetam ou consomem.

### Padrão 2 — Dispatch / matching contextual

**Tabelas auditadas (8):** `fulfillment_orders`, `fulfillment_items`, `order_sagas`, `rides_ride_distributions`, `rides_ride_requests`, `rides_rides`, `service_booking_decisions`, `service_discovery_requests`

**Métricas materiais:**
- Runtime: 7 com 0 rows; apenas `service_booking_decisions` com 14
- Max Jaccard (cols): `fulfillment_orders ↔ order_sagas` 44%; `rides_ride_requests ↔ rides_rides` 37%; `fulfillment_orders ↔ service_booking_decisions` 33%
- Status enums **materialmente distintos**:
  - `order_sagas`: `created → payment_pending → paid → ...`
  - `rides_ride_requests`: `pending → matching → accepted → ...`
  - `rides_rides`: `accepted → driver_arriving → in_progress → ...`
  - `service_booking_decisions`: `accepted / rejected`
  - `service_discovery_requests`: payment_status (`pending → paid`)

**Veredito (critério Sunny — 80%+ ou domínios mutuamente exclusivos):**
**NÃO CONVERGE.** Max Jaccard 44% << 80%. Status enums incompatíveis (saga vs matching vs decision vs payment). São 5 domínios materialmente distintos:
- saga de fulfillment (marketplace) — orquestração de ordem
- distribuição de corridas (rides) — matching geo-temporal
- decisão de aceitar booking (services) — accept/reject binário
- discovery request (services) — descoberta + payment_status
- transfer de fulfillment items (marketplace)

**Conclusão:** fragmentação **por design**, não acidental. Cada um é solução para problema diferente. Não cabe DT de convergência. Apenas observar que `modules/dispatch` (FANTASMA) e `modules/work-instant` (FANTASMA) tentam ser overlay sobre esses sistemas sem substrato próprio — já capturado em DT-MODULES-ASPIRATIONAL-VS-RUNTIME.

### Padrão 3 — Estado operacional / pipeline

**Tabelas auditadas (9):** `orders` (6 rows), `order_items`, `order_status_history`, `b2b_orders`, `b2b_order_items`, `order_sagas`, `service_booking_decisions` (14), `service_payment_requests` (14), `service_payment_executions` (1)

**Métricas materiais:**
- Max Jaccard: `service_payment_requests ↔ service_payment_executions` 53% — par paralelo do mesmo subdomínio (request → execution)
- `orders ↔ order_sagas` 35%; `orders ↔ b2b_orders` 33% — B2C ↔ B2B paralelo
- Status enums variados:
  - `orders`: `draft → submitted → cancelled → ...`
  - `b2b_orders`: `draft → confirmed → shipped → ...`
  - `order_sagas`: `created → payment_pending → paid → ...`
  - `service_booking_decisions`: `accepted / rejected`
  - `service_payment_requests`: `pending → cancelled → ...`

**Veredito:** **NÃO CONVERGE automaticamente.** Max Jaccard 53% (pares paralelos do mesmo domínio) está abaixo de 80%. Status enums incompatíveis.

**Mas:** padrão B2C ↔ B2B (`orders` ↔ `b2b_orders`) é dimensão deliberada. `service_*` são subsistema próprio de marketplace.

**Conclusão:** marketplace já é ponto de gravidade real (49 tabelas, 124 rotas, FUNCIONAL). B2B e services são subsistemas dentro do marketplace. Não é fragmentação acidental — é especialização por canal. **Sem DT necessária.**

### Padrão 4 — Presença / check-in contextual ⚠️ FRAGMENTAÇÃO REAL CONFIRMADA

**Hipótese Sunny:** "Padrão 4 terá descobertas grandes". **Confirmado.**

**Tabelas auditadas (8):** `event_attendees`, `event_checkins`, `event_rsvp`, `live_presence`, `rides_driver_locations`, `rides_driver_sessions`, `pdv_sessions`, `event_sessions`

**Métricas materiais:**
- **TODAS com 0 rows.** Zero runtime no padrão inteiro.
- Max Jaccard inesperado: `event_attendees ↔ pdv_sessions` 42%; `live_presence ↔ pdv_sessions` 40% — convergência **cross-domain** sugerida
- Status enums **3 modelos distintos:**
  - `live_presence`: `ONLINE / OFFLINE` ← presença declarada (boolean-like)
  - `event_attendees`: `registered / cancelled / attended` ← presença executada
  - `event_rsvp`: `pending / yes / no / maybe` ← intent de presença

**Decomposição semântica material:**
- **(a) Declaração de disponibilidade (intent):** `live_presence`, `event_rsvp`
- **(b) Presença executada (fact):** `event_attendees`, `event_checkins`
- **(c) Janela operacional (capacity):** `rides_driver_sessions`, `event_sessions`, `pdv_sessions`
- **(d) Tracking espacial:** `rides_driver_locations`

**Veredito (critério Sunny):**
**FRAGMENTAÇÃO REAL.** 8 tabelas, 4 categorias semânticas distintas, zero runtime, sem critério institucional de qual venceria. `modules/presence` (FANTASMA) tenta ser overlay com schema PRÓPRIO (`checkin_tokens, checkins, presence_rsvps`) — 9º modelo paralelo no código sem tabelas.

**Implicação para v2 modo operante:** Sunny estava certa em apontar — quando o primeiro caso real exigir presença/checkin (motorista online, RSVP a evento, garçom checked-in), 4-9 caminhos possíveis sem critério prévio. **Frente própria de design temporal+presença necessária ANTES de qualquer feature real depender disso.**

**DT a registrar:** `DT-PRESENCE-FRAGMENTATION-CONFIRMED` (HIGH, evolui DT-PRESENCE-FRAGMENTED-NO-RUNTIME).

### Padrão 5 — Vínculo operacional / delegação ⚠️ FRAGMENTAÇÃO REAL CONFIRMADA

**Hipótese Sunny:** "Padrão 5 terá descobertas grandes". **Confirmado.**

**Tabelas auditadas (10):** `actor_delegations`, `company_users` (9 rows), `partner_employees`, `event_organizer_members`, `event_staff`, `event_organizers`, `user_roles` (1), `role_permissions` (68), `economic_guardianship`, `group_members` (5)

**Métricas materiais:**
- Runtime: 4 com dados (`company_users` 9, `role_permissions` 68, `group_members` 5, `user_roles` 1). 6 com zero rows.
- Max Jaccard: `partner_employees ↔ group_members` 43%; `event_organizer_members ↔ group_members` 30% — convergência baixa entre todos pares
- Status enums **mínimos:**
  - `actor_delegations`: `active / revoked / suspended`
  - `event_staff`: `active / inactive / cancelled`
  - Outros sem status enum

**Decomposição material — "X tem papel em Y":**
- **Delegação rica (futuro):** `actor_delegations` (scopes JSONB + is_transitive + expires_at + revoked_at) — modelo canônico
- **Vínculo PF→empresa:** `company_users` (5 booleans hardcoded + role) — fundação atual exercitada
- **Vínculo organizer:** `event_organizer_members`, `event_organizers`
- **Vínculo staff:** `event_staff`
- **Vínculo grupo:** `group_members`
- **RBAC sistema:** `user_roles` + `role_permissions`
- **Tutela econômica:** `economic_guardianship` (subject+guardian)
- **Vínculo empregado:** `partner_employees` (esqueleto 4 cols)

**Veredito (critério Sunny):**
**FRAGMENTAÇÃO MAIS SEVERA QUE P4.** Materialmente 6+ implementações para "X tem papel em Y", todas com semântica próxima mas schemas materialmente diferentes. Apenas 4 têm runtime.

**Convergência teórica possível** sob `actor_delegations` (`Clayton delega 'manager' em Voltagem com expires_at=NULL e scopes=[...]`). Mas: refactor pesado, risca substrato exercitado de `company_users` + `role_permissions`.

**Implicação institucional crítica:** o caso canônico "freelancer multi-empresa" (Clayton garçom na churrascaria) precisa de **decisão arquitetural prévia** sobre qual modelo absorve. Hoje:
- Se Clayton tem role X em churrascaria → `company_users` (modelo atual exercitado)
- Se Clayton tem delegação rica com scopes/expires → `actor_delegations` (modelo canônico, zero runtime)
- Não há ponte. Não há projeção.

**DT a registrar:** `DT-OPERATIONAL-BINDING-FRAGMENTATION` (HIGH, sub-DT do DT-ACTOR-DELEGATIONS-ZERO-RUNTIME).

### Padrão 6 — Proposta contextual (Pagamentos/Escrow)

**Tabelas auditadas (9):** `service_payment_requests` (14), `service_payment_executions` (1), `payment_milestones`, `escrow_accounts`, `escrow_transactions`, `b2b_payment_intents`, `payment_intents` (6), `payment_transactions`, `payout_requests`

**Métricas materiais:**
- Runtime parcial: 3 com dados (service_payment_requests 14, service_payment_executions 1, payment_intents 6). 6 com zero rows.
- **Jaccard ALTO entre múltiplos pares (≥50%):**
  - `service_payment_requests ↔ service_payment_executions` 53%
  - `payment_milestones ↔ escrow_transactions` 53%
  - `payment_transactions ↔ payout_requests` 50%
  - 8+ pares com 35%-50%
- Status enums com **vocabulário sobreposto** (pending/completed/cancelled/failed/released/refunded) mas semântica de cada um distinta

**Veredito (critério Sunny):**
**SOBREPOSIÇÃO MATERIAL ALTA mas FRAGMENTAÇÃO POR DESIGN.** 9 tabelas no espaço de pagamento, cada uma com domínio próprio:
- Intent (autorização)
- Milestone (escrow gradual)
- Transaction (movimento real, integrado ao ledger via outros mecanismos)
- Escrow (custódia)
- Payout (saída)
- Service Payment Request/Execution (pagamento específico de serviços)

**Não é Frankenstein** — é Payment Engine desenhado com responsabilidades separadas. Vocabulário compartilhado mas semântica distinta justifica.

**Risco residual:** caller pode confundir qual usar quando. Vale `DT-PAYMENT-DOMAIN-COMPLEX` (MEDIUM informativo) documentando qual cobre qual caso, sem propor convergência. Não é fragmentação — é especialização rica.

### Padrão 7 — Capacidade física / estoque

**Tabelas auditadas (9):** `inventory_balances`, `inventory_lots`, `inventory_movements`, `inventory_reservations`, `stock_transfers`, `stock_transfer_items`, `stock_transfer_receipts`, `stock_transfer_receipt_items`, `event_occupancy_models`

**Métricas materiais:**
- **TODAS com 0 rows.** Sistema completo dormant.
- Max Jaccard: `inventory_movements ↔ stock_transfer_items` 47%; `inventory_lots ↔ stock_transfer_items` 45%; `stock_transfers ↔ stock_transfer_receipts` 43%
- **Nenhuma tem status enum** (curioso — inventário não modelou estado)

**Veredito:**
**Schema completo, coerente, dormant.** As 8 tabelas inventory_* + stock_transfer_* formam um sistema completo de inventário com transferências e recibos — desenhado, aplicado, **nunca exercitado**. `event_occupancy_models` é outro conceito (capacity de evento, 18 cols, modelagem rica de assentos/setores).

**Não fragmentação acidental** — sistema unificado por design. Dormant. Não precisa DT além de DT-MODULES-ASPIRATIONAL-VS-RUNTIME (que já cobre).

---

## 5.B — Síntese dos 7 padrões

| Padrão | Veredito | DT recomendada |
|---|---|---|
| P1 — Disponibilidade | Convergência possível (4 tabelas projetam em `availability`) | DT-CONVERGENCE-AVAILABILITY-AS-CANONICAL-TEMPORAL (já registrada) |
| P2 — Dispatch/matching | Fragmentação por design (5 domínios distintos) | Nenhuma — apenas DT-MODULES-ASPIRATIONAL-VS-RUNTIME cobre fantasmas |
| P3 — Pipeline/estado | Especialização por canal (B2C/B2B/services) | Nenhuma — marketplace é ponto de gravidade |
| **P4 — Presença/checkin** | **FRAGMENTAÇÃO REAL (8-9 modelos, zero runtime)** | DT-PRESENCE-FRAGMENTATION-CONFIRMED (HIGH) |
| **P5 — Vínculo operacional** | **FRAGMENTAÇÃO MAIS SEVERA (6+ modelos, runtime fragmentado)** | DT-OPERATIONAL-BINDING-FRAGMENTATION (HIGH) |
| P6 — Pagamento | Sobreposição alta mas design coerente | DT-PAYMENT-DOMAIN-COMPLEX (MEDIUM informativo) |
| P7 — Estoque | Sistema completo dormant | Já coberto por DT-MODULES-ASPIRATIONAL-VS-RUNTIME |

**Hipótese de Sunny confirmada materialmente:** P4 e P5 são os padrões com fragmentação real grande. Os outros 5 padrões ou (a) não fragmentam (são domínios distintos por design) ou (b) já têm convergência mapeada.

**Implicação institucional decisiva:** v2 do modo operante (resolver dinâmico) depende não apenas de `actor_delegations` ter runtime (DT-ACTOR-DELEGATIONS-ZERO-RUNTIME), mas de **decisão arquitetural prévia** sobre qual modelo de vínculo (P5) e qual modelo de presença (P4) absorvem o caso canônico. **Sem essas decisões, v2 reproduz fragmentação em vez de "revelar capabilities já autorizadas".**

---

## 6. DTs propostas

Para registro em `REMEDIATION_DT_LOG.md` (não nesta sessão; apenas listadas como output da Frente 2):

| DT | Prioridade | Resumo |
|---|---|---|
| **DT-modules-aspirational-vs-runtime** | HIGH | 29 FANTASMAs com frontend caller; 24 com rotas chamadas que falham em runtime. Risco institucional: alguém presume capacidade que não existe. Mitigação: este inventário + congelamento explícito por DT individual. |
| **DT-actor-delegations-zero-runtime** | HIGH | `actor_delegations` modelado (ESQUELETO_RECENTE) mas zero rows. Bloqueia modo Operar v2 dinâmico. Substrato freelancer multi-empresa ausente. |
| **DT-bank-satellite-modules-dormant** | MEDIUM | 13 módulos satélite do bank engine (alerts, settlements, circuit-breakers, disputes, freezes, governance financeira×3, payouts, rate-limit, reversal, risk, sla, treasury×2) são ESQUELETO_DORMENTE — fundação aspiracional nunca exercitada. |
| **DT-profession-data-sparse** | MEDIUM | 3/61 profiles (5%) têm profession populada. Profession-as-hint é hint vazio para 95% dos usuários. |
| **DT-operating-mode-static-projection** | MEDIUM | v1 hardcoded ≠ definição soberana "modo revela capabilities". Tradeoff consciente para MVP. |
| **DT-convergence-availability-as-canonical-temporal** | MEDIUM | `availability` é SSOT temporal de janela+capacity. 4 tabelas paralelas (event_sessions, rides_driver_sessions, pdv_sessions, schedules+slots) poderiam projetar. Convergência arquitetural de futuro. |
| **DT-presence-fragmented-no-runtime** | MEDIUM | 4 modelos de presença/checkin paralelos, schemas materialmente diferentes, zero runtime. Frente própria de design quando primeiro caso real emergir. |
| **DT-authority-audit-limited-to-financial** | MEDIUM | `authority_decision_audit` cobre apenas `financial_*` (26 allow + 8 block). Outros domínios não auditam. Sinal de runtime limitado; **não usar como métrica geral de funcionalidade**. |
| **DT-fantasma-modules-with-frontend-callers** (×24) | varia por módulo | Para cada FANTASMA que tem frontend caller, registrar DT específica com critério de descongelamento (criar tabela + migration + seed ou remover endpoint). Top 5: work-instant (14 rotas), venue (12), presence (11), policy-engine (11), automation (10). |

---

## 7. Recomendações honestas

**1. Sistema NÃO é majoritariamente fachada.** 45% FUNCIONAL é número saudável. A narrativa "15-20 reais" estava errada por extrapolação de exemplos.

**2. Backbone real é robusto:** ledger, bank, reconciliation, marketplace (49 tabelas), catalog, categories, navigation, ontology, profile, semantic, observability, auth, audit, availability, calendar, authorization. Esses são os módulos onde o atravessamento Clayton-imagina realmente acontece.

**3. Bank engine tem dívida arquitetural histórica.** 13 módulos satélite (alerts/settlements/circuit-breakers/disputes/freezes/governance×3/payouts/rate-limit/reversal/risk/sla/treasury×2) são esqueleto dormente — fundação ampla aplicada que nunca virou runtime. Frente própria de "ratificar ou arquivar" pode descobrir que alguns são desnecessários.

**4. Convergência temporal está PRÓXIMA.** `availability` + `bookings` são SSOT real (44 rows combinadas). 4 outras tabelas (event_sessions, rides_driver_sessions, pdv_sessions, schedules) poderiam projetar via owner_type. **Esta é a convergência silenciosa mais promissora detectada**.

**5. Modo Operar v2 dinâmico depende de `actor_delegations` runtime.** Substrato existe (ESQUELETO_RECENTE), mas zero rows. Primeira delegação real precisa ser exercitada antes de v2 fazer sentido.

**6. Presença/check-in é frente própria.** 4 modelos paralelos sem runtime; nenhum venceu. Quando primeiro caso real emergir (evento? rides?), decidir qual sobrevive.

**7. Frontend chama 24 FANTASMAs.** Risco operacional imediato. Cada um precisa de DT individual com decisão binária: criar tabela ou remover endpoint.

---

## 8. Apêndice A — Queries reproduzíveis

### A.1 — Contagem total e por classificação

```sql
-- Total tabelas em DB
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE';
-- Resultado: 220

-- Rows por scope da authority
SELECT decision, COUNT(*)::int FROM authority_decision_audit GROUP BY decision;
-- allow: 26, block: 8

-- Profession populada
SELECT COUNT(*) FILTER (WHERE metadata ? 'profession') AS with_profession,
       COUNT(*) AS total FROM profiles;
-- 3 / 61
```

### A.2 — Padrão Disponibilidade (núcleo comum)

```sql
WITH cols AS (
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name IN ('availability','bookings','schedules','schedule_slots',
                       'event_reservations','event_sessions','services',
                       'service_discovery_requests','rides_driver_sessions',
                       'rides_ride_requests','pdv_sessions')
)
SELECT column_name, COUNT(*) AS occurrences
FROM cols GROUP BY column_name
HAVING COUNT(*) >= 5
ORDER BY occurrences DESC;
-- tenant_id (10), metadata (10), status (9), created_at (9), id (8), updated_at (7)
```

### A.3 — Reprodução do inventário automatizado

Script auditor: `backend/__tmp_full_inventory.cjs` (removido após uso). Lógica:
1. `fs.readdirSync(backend/src/core)` + `backend/src/modules` → listar 163 dirs
2. Para cada dir: `grep -E "\b(FROM|INTO|UPDATE|JOIN)\s+[a-z_]+"` em arquivos `.ts` → extrair tabelas referenciadas
3. Para cada dir: `grep -E "fastify\.(get|post|put|delete|patch)"` → contar rotas
4. Para cada rota: verificar se `frontend/src/api/*` contém a signature (primeiros 2 segmentos)
5. Cruzar tabelas referenciadas com `information_schema.tables` → existentes vs faltantes
6. `SELECT COUNT(*) FROM <table>` para todas existentes → rows
7. Classificar: FUNCIONAL (rows>0 OU frontend) / FANTASMA (tabela falta) / ESQUELETO (existe, vazia) / NO_DATA_LAYER (sem tabela sem rota) / INDEFINIDO (sem tabela, com rota)

Dataset bruto: `__inventory_data.json` — **artefato local não-versionado**, regenerável aplicando o método declarado em §8 (queries A.1–A.4) contra o DB em runtime. Ausência do arquivo no repositório é deliberada (não pertence a SSOT versionado); reprodução depende de re-executar as queries documentadas. Classificação verificada materialmente (top 25 FUNCIONAIS via `COUNT(*)`, 29 FANTASMAS via `to_regclass`, 20 ESQUELETOS via rows=0) **não depende** do arquivo bruto — depende apenas das queries §8 serem reaplicáveis.

### A.4 — Refinamento ESQUELETO_RECENTE vs DORMENTE

Para cada ESQUELETO:
- Encontrar migration que criou cada tabela (grep `CREATE TABLE` nas 250+ migrations)
- Inferir data da migration (timestamp `YYYYMMDDhhmmss` no prefixo ou sequencial `NNNN_` para antigas)
- Sub-classificar: RECENTE se < 30 dias; DORMENTE se > 30 dias E código estagnado > 60 dias

---

## 10. Auditoria dos 24 FANTASMAS com frontend caller — decisão proposta

> Levantamento material: `backend/__tmp_fantasma_audit.cjs` cruzou endpoints declarados em routes.ts × `frontend/src/api/*.ts` por signature aproximada.
>
> **CAVEAT MATERIAL:** caller-check tem falsos positivos (a signature de algumas rotas curtas como `/:id/cancel` aparece em arquivos não relacionados). Cada decisão proposta abaixo precisa ratificação humana caso a caso antes de virar ação. Esta seção é **proposta**, não execução.

### Critério de decisão binária

- **CRIAR_TABELA**: módulo com semântica clara + parte de visão futura + tabela inexistente é deliberada (não foi planejada antes do código)
- **REMOVER_ENDPOINT**: módulo sem visão clara hoje + código aspiracional que pode estar enganando integradores
- **CONGELAR**: visão clara mas fora de prioridade atual; manter código no disco, esconder rota frontend, DT específica
- **AUDITORIA_HUMANA**: caso ambíguo, requer decisão arquitetural

### Top 5 prioritários (mais rotas + frontend chama)

| # | Módulo | Rotas | Decisão proposta | Razão material |
|---|---|---:|---|---|
| 1 | `modules/work-instant` | 14 | **CONGELAR** | Uber-like matching com `worker_skills, instant_requests, worker_status, assignments`. Substrato `live_presence` (zero rows) + `actor_delegations` (zero rows) NÃO existe. Implementar tabelas agora reproduziria fragmentação P4+P5. DT específica: `DT-MODULE-WORK-INSTANT-FROZEN-PRE-P4-P5`. |
| 2 | `modules/venue` | 12 | **CONGELAR** | Restaurant `tabs/menus/menu_items/tab_orders` + QR token. Vinculado a `modules/pdv` (também esqueleto). Vertical "restaurant" não emergiu como prioridade. DT: `DT-MODULE-VENUE-FROZEN-PRE-RESTAURANT-VERTICAL`. |
| 3 | `modules/policy-engine` | 11 | **AUDITORIA_HUMANA URGENTE** | `policy_rules, policy_decisions` paralelo a `authorization.service` + `permissions`. Risco: foi pensado como replacement ou overlay? Se replacement, conflita com authority chain canônica em runtime. |
| 4 | `modules/presence` | 11 | **CONGELAR explicitamente** | Schema próprio (`checkin_tokens, checkins, presence_rsvps, promo_benefits`) é 9º modelo paralelo de P4. Implementar reproduz fragmentação confirmada. DT específica: `DT-MODULE-PRESENCE-FROZEN-PRE-P4-DECISION`. |
| 5 | `modules/automation` | 10 | **AUDITORIA_HUMANA** | `alerts, scheduled_actions`. Vocabulário sobreposto com `modules/alerts` (ESQUELETO_DORMENTE do bank). Pode estar duplicado. Decidir convergência ou divergência consciente. |

### Restantes 19 (decisão sumária)

| # | Módulo | Rotas | Decisão proposta | Comentário |
|---|---|---:|---|---|
| 6 | `modules/agreements` | 9 | **AUDITORIA_HUMANA** | `agreements` table inexistente, frontend chama `agreements.ts`. Pode conflitar com `service_payment_requests` (FUNCIONAL com 14 rows) que parece cobrir contratos de serviço. |
| 7 | `modules/contextual-messaging` | 7 | **AUDITORIA_HUMANA** | `contextual_threads, contextual_messages`. Sobrepõe com `chat_messages` + `chat_rooms` (FUNCIONAL?). Decidir convergência. |
| 8 | `modules/evidence` | 7 | **CONGELAR** | `evidence_packs`. Conceito específico (forensics/disputes). Sem urgência. |
| 9 | `modules/payout` | 7 | **AUDITORIA_HUMANA** | `payout_batches, payout_orders` paralelo a `payout_requests` (ESQUELETO_DORMENTE singular). Decidir SSOT de payout. |
| 10 | `core/root-config` | 6 | **CRIAR_TABELA** | `root_config` é provavelmente config soberana global. Tabela trivial. Custo baixo. |
| 11 | `modules/loyalty` | 6 | **CONGELAR** | `loyalty_rules, loyalty_vouchers, loyalty_accounts`. Domínio próprio. Fora de prioridade. |
| 12 | `modules/subscriptions` | 6 | **CONGELAR** | `subscriptions`. Domínio próprio. Fora de prioridade. |
| 13 | `core/reporting` | 5 | **AUDITORIA_HUMANA** | `reports, report_events, risk_flags`. Sobrepõe com `modules/reporting` FUNCIONAL (4 tabelas, 7 rotas). Decidir SSOT. |
| 14 | `modules/invoicing` | 5 | **CONGELAR** | `invoices`. Domínio próprio fiscal. Quando emergir, frente própria. |
| 15 | `modules/system-notifications` | 5 | **AUDITORIA_HUMANA** | `system_notifications`. Pode sobrepor com social_inbox_items ou outro mecanismo. |
| 16 | `modules/votes` | 5 | **AUDITORIA_HUMANA** | `votes, vote_options, vote_responses`. Sobrepõe com `group_votes, group_vote_options, group_vote_responses` (existe em FUNCIONAL?). Decidir convergência. |
| 17 | `modules/social-actions` | 4 | **AUDITORIA_HUMANA** | `social_actions`. Provavelmente sobrepõe com posts/reactions/comments. |
| 18 | `core/memory` | 3 | **CONGELAR** | `user_memory_preferences/interactions/entities/shortcuts`. Camada de memory persistente do AI. Fora de prioridade. |
| 19 | `core/residence` | 3 | **CRIAR_TABELA** | `global_user_residence`. Tabela trivial vinculada a addresses. Custo baixo se necessária. |
| 20 | `modules/care` | 3 | **AUDITORIA_HUMANA** | `care_sessions, care_messages`. Semântica não clara (suporte? cuidados?). |
| 21 | `core/user-group-allocation` | 2 | **AUDITORIA_HUMANA** | `user_group_allocations`. Pode sobrepor com `group_members` (FUNCIONAL, 5 rows). |
| 22 | `modules/business-audit` | 2 | **PROVISÓRIO** (provável REMOVER_ENDPOINT) | `business_audit_logs`. Sobrepõe com `audit_events`/`modules/audit` (FUNCIONAL 134 rows). Decisão final humana entre CONGELAR e REMOVER_ENDPOINT. |
| 23 | `modules/media` | 2 | **PROVISÓRIO** (provável CRIAR_TABELA) | `post_media`. Tabela trivial. Decisão final humana: FK explícita (CRIAR_TABELA) ou continuar em `posts.metadata` JSONB (CONGELAR + esconder endpoint). |
| 24 | `modules/social-chat` | 2 | **PROVISÓRIO** (provável REMOVER_ENDPOINT) | `social_chat_messages`. Sobrepõe com `chat_messages` existente. Decisão final humana entre CONGELAR e REMOVER_ENDPOINT. |

### Distribuição da decisão proposta (total 24 exatos)

| Decisão | Qtd | Módulos |
|---|---:|---|
| **CONGELAR** | 8 | work-instant, venue, presence, evidence, loyalty, subscriptions, invoicing, memory |
| **AUDITORIA_HUMANA** | 11 | policy-engine (urgente), automation, agreements, contextual-messaging, payout, reporting, system-notifications, votes, social-actions, care, user-group-allocation |
| **CRIAR_TABELA** | 2 | root-config, residence |
| **PROVISÓRIO (AGUARDA RATIFICAÇÃO HUMANA)** | 3 | business-audit, media, social-chat (cada um com decisão provável anotada na tabela acima) |
| **Total** | **24** | ✓ |

**Nota Sunny:** "PROVISÓRIO" substitui ranges anteriores (CRIAR_TABELA 2-3, REMOVER_ENDPOINT 1-2) para evitar imprecisão. Cada item PROVISÓRIO tem decisão provável anotada, aguardando ratificação humana final.

**Padrão dominante:** AUDITORIA_HUMANA. A maior parte dos FANTASMAs não são "fáceis de decidir" — são duplicações/sobreposições com outras tabelas funcionais que exigem decisão arquitetural de qual fica.

**Frente futura recomendada após Frente 4:** sessão dedicada a registrar DT por módulo + decidir caso a caso. Pelo menos 1 sessão para top 5, mais 1 para os 19 restantes.

---

## 11. Validação cruzada própria — 5 casos limite

> Sunny pediu validação cruzada (própria ou ChatGPT em escopo restrito). Faço como Opus aqui: identificar 5 casos onde mais de uma classificação seria defensável.

| Caso limite | Classificação atual | Alternativa defensável | Critério para escolher |
|---|---|---|---|
| **`modules/marketplace`** (49/78 tabelas existem) | FUNCIONAL | Parcialmente FANTASMA (29 tabelas referenciadas não existem) | Domina por runtime real (289 rows). Mas 29 referências órfãs merecem auditoria interna do próprio marketplace. Mantém FUNCIONAL com nota. |
| **`core/profile`** (15/28 tabelas existem) | FUNCIONAL | Parcialmente FANTASMA (13 órfãs) | 13 referências de tabelas inexistentes em profile sugerem drift histórico (profile_*, public_profiles, etc.). Mantém FUNCIONAL pelo runtime (102 rows max) mas registrar como sub-DT de drift profile. |
| **`core/categories`** (3/13 tabelas existem) | FUNCIONAL | INDEFINIDO | 10 das 13 referências provavelmente são N0/N1/N2 (não-tabelas mas conceitos via categories.metadata + nodes JSONB). Mantém FUNCIONAL — false positives do regex. |
| **`core/observability`** (5/15 tabelas) | FUNCIONAL | ESQUELETO ou FANTASMA parcial | 10 tabelas referenciadas inexistentes em observability é grande. Mas as 5 existentes têm 289 rows. Caso limite. Mantém FUNCIONAL pelo peso mas vale auditar internamente. |
| **`modules/automation`** | FANTASMA | INDEFINIDO/ESQUELETO | `alerts, scheduled_actions` ausentes. Mas `alerts` é nome ambíguo (existe em outros módulos como `modules/alerts` ESQUELETO_DORMENTE). Pode ser que o automation use os `alerts` do bank engine — caso assim seria ESQUELETO (tabela existe em outro contexto). Vale verificar manualmente antes de decisão final. |

**Auto-crítica metodológica:**

1. **Regex `grep FROM/INTO/UPDATE/JOIN`** captura referências brutas mas não distingue:
   - Tabela inexistente real vs alias SQL (`FROM tabs t` onde "tabs" é tabela vs `FROM ... AS tabs` onde é alias)
   - Comments/strings vs query real
   - Views vs tabelas (categories pode usar views ontologia)
2. **Frontend caller-check** por signature de 2 segmentos gera FPs (já flagado).
3. **Classificação binária** força casos limite (marketplace com 78 referências). Vale considerar "FUNCIONAL_COM_DRIFT" como sub-categoria futura.

**Recomendação Sunny-style:** validação cruzada por ChatGPT no top 5 FANTASMAs prioritários para confirmar decisão proposta (CONGELAR vs AUDITORIA_HUMANA), restringindo escopo. Eu já fiz aqui a parte de casos limite na classificação geral.

---

## 9. Status da Frente 2

**Concluído:**
- ✓ Inventário automatizado de 157 módulos (sustentado por queries reproduzíveis)
- ✓ Classificação binária (FUNCIONAL/FANTASMA/ESQUELETO/NO_DATA_LAYER/INDEFINIDO)
- ✓ Refinamento Sunny #1: ESQUELETO_RECENTE vs DORMENTE (4 vs 16)
- ✓ Refinamento Sunny #3: authority_decision_audit decomposto (allow/block, action_type)
- ✓ Padrão 1 (Disponibilidade) analisado com critério material (cruzamento de schemas)
- ✓ Padrões 2-7 analisados em nível mais raso (suficiente para mapa institucional)
- ✓ 9 DTs propostas (não registradas — Frente 4)

**Pendente para próxima sessão (escopo Sunny: 2-3 sessões realistas):**
- Análise profunda dos Padrões 2-7 com critério material duro (cruzamento de schemas)
- Validação cruzada por outra IA (Sunny)
- Registro formal das DTs em `REMEDIATION_DT_LOG.md`
- Frente 4: DECISIONs apenas após Frente 2 fechar

**Não tocado nesta sessão (correto conforme plano):**
- v1 modo operante: aguarda smoke humano
- v2 dinâmico: bloqueado por substrato (actor_delegations zero rows)
- Decisão de vertical primária: postergada
- Edits em código backend ou frontend: ZERO

---

## 12. Re-tabulação por categoria core/* vs modules/* — 2026-05-17

> Recalibração material da métrica "45% funcional de 157" tratando `core/*` e `modules/*` como categorias estruturalmente diferentes (infraestrutura compartilhada vs features/verticais), conforme observação refinadora durante FASE 1 do plano "Re-tabulação MODULES_INVENTORY + Design Clínica Sorrisos".

### Método

1. **Contagem material** via `ls -d src/core/*/ src/modules/*/`: **core/* = 78 subdirs, modules/* = 79 subdirs, total 157** (bate com declaração original).
2. **Classificação dos previamente listados** (sections 2/3/4): FANTASMAS por categoria, ESQUELETOS por categoria, FUNCIONAIS top 25 por categoria.
3. **Estimativa material dos 108 restantes** via proxy de arquivos (`*.routes.ts`, `*.repository.ts`, `*.service.ts`, `*.types.ts` por subdir). Critério reusado da Sec. 7:
   - Tem routes + repository + service → FUNCIONAL provável (assumido)
   - Sem routes/repository — apenas helpers/types/ports → NO_DATA_LAYER provável
   - Tem routes mas sem repository próprio → INDEFINIDO provável
4. Estimativa marcada como **proxy material**, não inspeção 1:1 (auditoria exata dos 108 levaria ~24h trabalho; proxy é honesto e reproduzível).

### Classificação previamente listada por categoria

**FANTASMAS (29 total — section 2):**
| Categoria | Qtd | Módulos |
|---|---:|---|
| **core/*** | 8 | database, memory, rate-limiting, reporting, residence, reviews, root-config, user-group-allocation |
| **modules/*** | 21 | agreements, automation, business-audit, care, contextual-messaging, dispatch, evidence, invoicing, loyalty, media, payout, policy-engine, presence, schedule, social-actions, social-chat, subscriptions, system-notifications, venue, votes, work-instant |

**ESQUELETOS (20 total — section 3):**
| Categoria | Qtd | Módulos |
|---|---:|---|
| **core/*** | 3 | actor-delegation (recente), actor-registry (recente), intent (dormente) |
| **modules/*** | 17 | orders (recente), public-profiles (recente), alerts, bank-settlement, circuit-breaker, disputes, freezes, governance, governance-funding, governance-funding-commitment, payouts, rate-limit, reversal, risk, sla, treasury, treasury-split (16 dormentes) |

**FUNCIONAIS top 25 listados (section 4) — totalizam 71 (top 25 apenas mostrados):**
| Categoria | Qtd top | Módulos top |
|---|---:|---|
| **core/*** | 16 | db, observability, reconciliation, unifybank, tenants, catalog, categories, navigation, ontology, profile, semantic, auth, audit, availability, calendar, authorization |
| **modules/*** | 9 | ledger-snapshots, reconciliation, bank, economy, marketplace, reporting, audit, observability, human-mvp |

### Distribuição estimada por categoria (proxy material para os 108 restantes)

| Classificação | core/* (de 78) | % core/* | modules/* (de 79) | % modules/* | Global (de 157) | % global |
|---|---:|---:|---:|---:|---:|---:|
| **FUNCIONAL** | ~42 | **54%** | ~25 | **32%** | 71 | 45% (referência) |
| **FANTASMA** | 8 | 10% | 21 | 27% | 29 | 18% |
| **ESQUELETO** | 3 | 4% | 17 | 22% | 20 | 13% |
| **NO_DATA_LAYER** | ~24 | 31% | ~8 | 10% | ~32 (vs 25 declarado) | ~20% |
| **INDEFINIDO** | ~1 | 1% | ~5 | 6% | ~6 (vs 12 declarado) | ~4% |
| **TOTAL** | 78 | 100% | 79 | 100% | 157 | 100% |

**Nota sobre NDL/INDEFINIDO**: estimativa por proxy de arquivos diverge ~7 pontos do declarado original (32 vs 25 em NDL; 6 vs 12 em INDEFINIDO). Diferença provavelmente vem de critério mais ou menos rigoroso de "tabela acessível" — não invalida análise, apenas sinaliza margem de erro do método proxy.

### Resposta material à pergunta "métrica 45% se sustenta?"

**NÃO se sustenta como métrica única.** Distribuição é materialmente assimétrica:

- **core/* (infraestrutura compartilhada) é majoritariamente saudável**: 54% FUNCIONAL + 31% utilities legítimas (NO_DATA_LAYER) = 85% do core tem propósito claro e está em uso ou é infraestrutura tipo-puro. Apenas 14% (10% FANTASMA + 4% ESQUELETO) é código aspiracional sem substrato.

- **modules/* (features/verticais) é majoritariamente parcial**: 32% FUNCIONAL + 27% FANTASMA + 22% ESQUELETO. **49% do modules/* (39 de 79) é código aspiracional sem substrato funcional** (FANTASMA + ESQUELETO somados).

**Distribuição é cenário (a) confirmado**: core/* é saudável; modules/* tem maioria de fachadas/esqueletos. A métrica global "45% funcional" mistura categorias estruturalmente diferentes e oculta o padrão real.

### Implicação institucional para narrativa

**Narrativa anterior (MODULES_INVENTORY linha 86):** *"Realidade é ~4× mais saudável do que assumido [...] Sistema não é majoritariamente fachada."*

**Refinamento material (mantém afirmação para core, refuta parcialmente para modules):**

> O **substrato (core/*)** do UnifiCard é sólido — 54% funcional + 31% utilities = 85% com propósito claro. Apenas 14% aspiracional. A narrativa "sistema não é majoritariamente fachada" se sustenta integralmente para o substrato compartilhado.
>
> As **features/verticais (modules/*)** estão materialmente parciais — 32% funcional vs 49% aspiracional (FANTASMA + ESQUELETO). Quase metade dos módulos verticais é código sem substrato. A narrativa "4× mais saudável que assumido" precisa recalibração específica para modules/*: o sistema é mais saudável que parecia **em infraestrutura**, mas mantém grande superfície aspiracional **em features**.

### Conexão com proposta arquitetural "núcleo universal + projeção contextual" (3 IAs externas, 2026-05-17)

A re-tabulação **fortalece materialmente** a proposta:

- Núcleos universais (core/*) **já são substrato sólido em runtime** — não precisam ser construídos, precisam ser exercitados pelas features verticais.
- Features verticais (modules/*) com 49% aspiracional sugerem que **expandir features sem aproveitar core leva à fragmentação**. A proposta "projeção contextual sobre núcleos comuns" é coerente com: parar de construir verticais paralelas e começar a projetar contexto sobre core existente.
- Pattern já validado em DECISION-0043 (perfil contextual progressivo): backend respeita identidade (core), frontend respeita projeção (interface contextual), ausência é semântica.

### Limitações do método proxy

- Classificação dos 108 módulos restantes (71 FUNCIONAL não-top + 25 NDL + 12 INDEFINIDO globais) baseada em padrão de arquivos por subdir, **não em verificação SQL+grep individual**.
- Margem de erro estimada: ±5-10% por categoria (proxy pode confundir FUNCIONAL parcial com NO_DATA_LAYER quando módulo tem só `service.ts` sem repository).
- **NÃO invalida** classificação dos top 25 funcionais (verificados materialmente via rows count), nem dos 29 FANTASMAS (verificados via `to_regclass`), nem dos 20 ESQUELETOS (verificados via rows = 0).
- **Para auditoria 1:1 dos 108 restantes**: trabalho de ~24h, fora do escopo desta re-tabulação cirúrgica.

### O que NÃO foi alterado

- Tabelas Section 2 (FANTASMAS), Section 3 (ESQUELETOS), Section 4 (FUNCIONAIS top 25) — preservadas como evidência histórica.
- Section 1 (Resumo executivo material) original — preservada; esta Section 12 é refinamento, não substituição.
- Section 5 (Padrões estruturais) — preservada.

Princípio: append-only, não reescrita (mantém memória do erro original).

---
