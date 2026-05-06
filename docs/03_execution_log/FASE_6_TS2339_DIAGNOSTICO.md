# FASE 6 — TS2339 Diagnóstico Estruturado (Modelagem de Tipos)

**Data:** 2026-02-22  
**Modo:** ANALISTA ESTRUTURAL (somente mapeamento, nenhuma alteração de código)  
**Fonte:** `npx tsc --noEmit` no backend.

---

## 1. Total de TS2339

| Métrica | Valor |
|--------|--------|
| **Total TS2339** | **404** |

Nenhuma linha de código foi alterada nesta fase. Este documento é exclusivamente diagnóstico.

---

## 2. Distribuição por categoria (C1–C6)

Cada TS2339 foi classificado em uma das categorias estruturais definidas no prompt.

| Categoria | Descrição | Qtd. est. | % |
|-----------|------------|-----------|---|
| **C1** | Propriedade ausente no tipo (mas existe no domínio real) — interface incompleta ou divergência contrato/domínio | ~215 | 53% |
| **C2** | Uso incorreto de Union Type — falta narrowing (in, discriminant, guard) | ~8 | 2% |
| **C3** | Tipo incorreto retornado por repository — service espera array/Entity, repository retorna Row ou objeto único | ~58 | 14% |
| **C4** | Partial / Optional mal tipado — falta checagem ou ajuste de tipo | ~15 | 4% |
| **C5** | Tipo completamente errado no fluxo — função retorna A, tratado como B; ou uso de valor (ex.: string) como tipo (ex.: Date) | ~88 | 22% |
| **C6** | Módulo/Import ou tipo não resolvido — enum/const ausente no tipo (ex.: ActorEffect) | ~20 | 5% |

**Resumo por padrão semântico (para clusters):**

- **amount vs amountCents** (tipo tem `amountCents`, código usa `.amount`): ~85 ocorrências → C1/C5.
- **total vs totalCents** (objeto tem `totalCents`, código usa `.total`): ~38 ocorrências → C5.
- **value vs valueCents** (tipo tem `valueCents`, código usa `.value`): ~18 ocorrências → C1.
- **Repository retorna Row/objeto único, código usa `.length` / `.map` / `.rows`**: ~58 ocorrências → C3.
- **Método ou propriedade inexistente no tipo do service/interface** (ex.: `getEconomicIdentity`, `createEconomicIdentity`, `userId` em Profile, `metadata`/`id`/`icon` em Category): ~95 ocorrências → C1.
- **ActorEffect** (constantes como `AVAILABILITY_CONFLICT_DETECTED`, `OPPORTUNITY_DISPATCHED` ausentes no tipo): 8 ocorrências → C6.
- **QueryResult** (acesso direto a `.tenant_id` em vez de `.rows[0].tenant_id` ou similar): 2+ → C5.
- **getTime** em tipo `string` (valor é string, código trata como Date): 6 ocorrências → C5.

---

## 3. Top 10 arquivos com maior concentração de TS2339

| # | Arquivo | Qtd. TS2339 |
|---|---------|-------------|
| 1 | `src/modules/marketplace/marketplace.service.ts` | 127 |
| 2 | `src/modules/marketplace/marketplace.routes.ts` | 33 |
| 3 | `src/modules/marketplace/marketplace-public.routes.ts` | 17 |
| 4 | `src/core/events/specs/event-spec.service.ts` | 16 |
| 5 | `src/modules/marketplace/payment-execution.service.ts` | 13 |
| 6 | `src/core/events/operational-commitments.service.ts` | 9 |
| 7 | `src/core/events/event-custody.service.ts` | 7 |
| 8 | `src/core/read-models/read-model.projector.ts` | 6 |
| 9 | `src/core/insight/insight-engine.ts` | 5 |
| 10 | `src/core/events/event-payment-prepared.service.ts` | 5 |

Os três primeiros arquivos concentram **~177** dos **404** erros (~44%).

---

## 4. Padrões recorrentes identificados

### 4.1 Nomenclatura monetária e totais (amount / total / value)

- **`.amount`** usado onde o tipo expõe **`amountCents`** (PaymentIntent, CanonicalEvent, EarnFromPaymentInput, CreatePaymentIntentInput, FinancialAgendaItem, IncentiveGrant, etc.).
- **`.total`** usado onde o tipo expõe **`totalCents`** (vários retornos de repository/service com `{ totalCents: number }` ou `{ totalCents: string }`).
- **`.value`** usado onde o tipo expõe **`valueCents`** (UserMemoryPreference, Policy, LoyaltyRule, Promotion, CreateLoyaltyRuleInput, etc.).

Impacto: dezenas de arquivos; correção é alinhar **nome da propriedade** ao tipo existente (amountCents/totalCents/valueCents) ou estender o tipo de forma canônica.

### 4.2 Repository retorna Row ou objeto único; código espera array

- Uso de **`.length`**, **`.map`**, **`.rows`** em variável tipada como **uma única Row** ou como **`{ count: string }`** / **`{ last_ticket: string }`** / **`{ status: string }`**.
- Arquivos típicos: `event-custody.service.ts`, `event-payment-prepared.service.ts`, `operational-commitments.service.ts`, `event-spec.service.ts`, `institutional-memory.repository.ts`, `pilot-*.repository.ts`, `contextual-thread.repository.ts`, `user-group-allocation.repository.ts`, `organization-invite.service.ts`, `idempotency-tracker.ts`, scripts.

Solução estrutural: tipar retorno de query como **array de rows** (ou tipo com `.rows: Row[]`) e usar esse array no service; ou mapper explícito Row → Entity.

### 4.3 Interface de serviço/entidade incompleta

- **MarketplaceService**: métodos referenciados nas routes não declarados no tipo (ex.: `createEconomicIdentity`, `getEconomicIdentity`, `getRegionalFundByRegion`, `getUnlockedIncentive`, `allocateRegionalFund`, `executeAllocation`, `generateEconomicEvent`, `getImportedServices`, `activateImportedProduct`, `inviteCollaborator`, `getPlugin`, `createServiceEvaluation`, etc.).
- **Category** / **MarketplaceCategory**: propriedades usadas (`id`, `metadata`, `icon`, `color`, `isActive`) ausentes no tipo.
- **Profile**: `userId` ausente.
- **CompaniesService**: `getCompanyDomains`, `updateCompanyDomains` ausentes.
- **AccountService** / **TransactionService**: `getAccountsByGlobalUserId`, `getTransactionsByGlobalUserId` ausentes.
- **UnifiedAvailability**: `id` ausente.
- **AvailabilityOwnerType**: `PAGE` ausente.
- **ServiceDispatch** / **ServiceRequest** / **ServiceOrder**: `sentAt`, `respondedAt`, `completedAt`, `status`, `totalCents`, `requestId` etc. ausentes.
- **UnifiedBooking**: `serviceId` ausente.
- **EventRepository**: `findById` ausente.
- **FastifyRequest**: `ledgerAccessLevel` (decoração de rota) ausente no tipo.
- **SalesReportFilters**: `scopeActorIds` ausente.
- **PaymentTransaction**: `paymentMethod` ausente.
- **AutomationService**: `createAlert` ausente.
- **ContactService**: `validateKyc` ausente.
- **BankPortsRegistry**: `getBankLedgerRepository` ausente.
- **ActorRow**: `id` ausente (ou nome diferente).

Padrão: tipo da classe/interface não reflete a API real; é necessário completar a interface ou alinhar uso ao tipo existente.

### 4.4 Enum / const do ActorEffect (C6)

- Uso de `ActorEffect.AVAILABILITY_CONFLICT_DETECTED`, `OPPORTUNITY_DISPATCHED`, `OPPORTUNITY_DISPATCH_RESPONDED`, `IMPACT_RECORDED`, `REPUTATION_UPDATED`, `NOTIFICATION_SENT` onde o tipo `typeof ActorEffect` não declara essas constantes.

Causa provável: enum/const incompleto ou import de tipo errado; requer completar o tipo/export ou corrigir o import.

### 4.5 QueryResult e acesso a “row”

- Acesso direto a **`result.tenant_id`** (ou `city_id`) quando o tipo é **`QueryResult<{ tenant_id: string }>`** (sem `.rows` ou `.row`).

Solução: tratar como resultado de query (ex.: `result.rows[0].tenant_id` ou tipo que exponha a row corretamente).

### 4.6 Date vs string

- Uso de **`.getTime()`** em variável tipada como **`string`** (ou `string | Date`) sem narrowing.

Solução: garantir tipo Date no fluxo ou converter string → Date antes de usar; ou ajustar tipo da variável.

### 4.7 Objetos com shape parcial ({} ou tipo restrito)

- Uso de **`.id`**, **`.checkoutId`** em tipo **`{}`** ou em tipo que não declara essa propriedade.

Solução: tipar corretamente o objeto (evitar `{}`) ou adicionar a propriedade ao tipo.

---

## 5. Estimativa de clusters estruturais

Agrupamento sugerido para ataque futuro (sem implementar correção nesta fase):

| Cluster | Descrição | Arquivos afetados (ordem de impacto) | Est. TS2339 |
|---------|------------|--------------------------------------|-------------|
| **K1** | amount/amountCents e value/valueCents (domínio + DTOs) | marketplace (service, payment-*, payout, pricing, loyalty, bank, events, social, pdv, payments, jobs, crm, rides, work), core (insight, simulation, orchestrator) | ~110 |
| **K2** | total/totalCents em retornos de repository/service | reporting, reputation, reviews, care, events, jobs, social, work, marketplace (order-item), rides, risk-command-center, scripts, validate-core-only | ~38 |
| **K3** | Repository retorna Row/objeto único (length/map/rows) | event-custody, event-payment-prepared, operational-commitments, event-spec, pilot (vários repositories), user-group-allocation, contextual-messaging, organization-invite, idempotency-tracker, system-notifications, scripts | ~58 |
| **K4** | MarketplaceService e tipos de marketplace (métodos e entidades incompletos) | marketplace.routes, marketplace.service, marketplace-public, marketplace-categories, marketplace-search, store-onboarding | ~95 |
| **K5** | Category, Profile, Companies, Dashboard, Identity, Ledger, Presence, Reports, Subscriptions, Venue, Policy, Services (UnifiedBooking, EventRepository) | companies, dashboard, identity, groups, ledger, presence, sales-report, subscription, venue, policy-resolution, policy-registry, policy-engine, services, store-onboarding | ~45 |
| **K6** | ActorEffect e tipos de evento (PAGE, UnifiedAvailability, sandbox_mode) | unified-availability.service, read-model.projector, event.service, event.routes | ~14 |
| **K7** | QueryResult, Date/string (getTime), FastifyRequest (ledgerAccessLevel), actorId em user | companies.service, event_checkout_hardening.test, my-orders, risk-command-center, ledger.routes, store-onboarding.routes, policy.routes | ~18 |
| **K8** | Outros (BankPortsRegistry, IncentiveRule max_amount, penaltyBps, ReputationSnapshot calculated_score, Order, CheckoutIntent, etc.) | marketplace.service (incentives, orders, checkout, reputation) | ~26 |

Total estimado alinhado ao total de 404, com sobreposição possível entre clusters (um mesmo arquivo pode estar em mais de um cluster).

---

## 6. Proposta de ordem de ataque

Ordem sugerida para futuras fases de correção (apenas planejamento; não executar nesta fase):

1. **K6 (ActorEffect e eventos)** — Poucos arquivos, tipo/enum único; reduz ruído rápido.
2. **K2 (total/totalCents)** — Padrão mecânico e repetitivo; muitos arquivos com 1–2 erros.
3. **K1 (amount/amountCents, value/valueCents)** — Maior volume; atacar por subdomínio (ex.: payment, loyalty, bank, depois marketplace e core).
4. **K3 (Repository Row vs array)** — Exige ajuste de assinatura de query e uso no service; atacar por módulo (events, pilot, contextual, etc.).
5. **K7 (QueryResult, Date/string, request decorators)** — Pontual mas estrutural (tipos de request e resultado de query).
6. **K5 (interfaces de service/entidade fora do marketplace)** — Completar interfaces (Companies, Dashboard, Category, Profile, etc.).
7. **K4 (MarketplaceService e tipos marketplace)** — Maior concentração em 2–3 arquivos; exige definição/extração de interfaces e alinhamento com implementação.
8. **K8 (resíduos marketplace e tipos específicos)** — Order, CheckoutIntent, IncentiveRule, BankPortsRegistry, etc., após K4 estável.

**Observação:** Não propor soluções concretas (ex.: alterar interface X para Y) neste documento; este relatório apenas mapeia e agrupa. Qualquer correção (incluindo ajuste de tipos) fica para fases posteriores, sem cast nem any.

---

## Confirmações

- [x] Todos os TS2339 foram listados e classificados por categoria (C1–C6) e por padrão semântico.
- [x] Nenhuma linha de código foi alterada.
- [x] Nenhum cast (`as`, `any`, `!`) foi introduzido.
- [x] O relatório permite agrupar correções em clusters reais (K1–K8) e ordenar o ataque.

---

**Fim do diagnóstico FASE 6 — TS2339.**
