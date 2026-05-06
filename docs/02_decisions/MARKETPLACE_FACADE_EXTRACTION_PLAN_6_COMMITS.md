# Plano de Extração — `marketplace.service.ts`

**Referência de execução para Cursor (ASK/Agent).**  
Sem quebrar runtime, sem alterar APIs públicas, sem duplicar estado. SSOT no domain.

---

## Objetivo

Transformar a facade em:

```
gateway + bootstrap + delegações
```

Sem:

- Maps
- lógica de domínio
- imports de domain
- orquestração >2 domínios

---

## Commit 1 — Congelar API pública da Facade

### Objetivo

Garantir que nenhum endpoint quebre durante o refactor.

### Ação

Criar um **arquivo de contrato**:

```
services/marketplace.facade.contract.ts
```

```ts
export interface MarketplaceFacade {
  getServiceOffering(offeringId: string): ServiceOffering | null

  createOrder(input: CreateOrderInput): Promise<Order>

  createServiceRequest(input: CreateServiceRequestInput): Promise<ServiceRequest>

  acceptServiceQuote(quoteId: string, actorId: string): Promise<ServiceQuote>

  completeServiceVisit(visitId: string): Promise<ServiceVisit>

  completeServiceRequest(requestId: string, actorId: string): Promise<ServiceRequest>

  /** Bootstrap: evita que rotas dependam de implementação concreta */
  initialize?(): void
  registerEventHandlers?(): void
}
```

A facade implementa:

```ts
export class MarketplaceService implements MarketplaceFacade
```

### Validação

```bash
npx tsc --noEmit
```

Nenhuma mudança funcional.

---

## Commit 2 — Remover Maps da Facade

### Problema atual

Facade acessa Map diretamente.

Exemplo:

```ts
this.serviceOfferings.get(offeringId)
```

### Ação

Mover acesso ao Map para **domain**.

**Domain** — `domain/offerings/marketplace-offerings.service.ts`:

```ts
getServiceOffering(offeringId: string) {
  return this.offerings.get(offeringId) ?? null
}
```

**Aggregator** — `services/marketplace-offerings.service.ts`:

O aggregator **não** expõe Map nem itera Map. Sempre delega ao domain:

```ts
getServiceOffering(offeringId: string) {
  return this.offeringsDomain.getServiceOffering(offeringId)
}
```

**Evitar:** `return this.offeringsDomain.offerings.get(id)` — mesmo dentro do aggregator, usar apenas métodos do domain.

**Facade**:

```ts
getServiceOffering(offeringId: string) {
  return this.offeringsService.getServiceOffering(offeringId)
}
```

### Validação

Facade **não pode conter**:

- `.get(`
- `.set(`
- `.delete(`
- `new Map`

---

## Commit 3 — Extrair lógica de pagamento

### Problema

Facade contém `calculatePaymentDueDate()` com `switch`, date math e payment rules.

### Ação

Mover para domain.

**Domain** — `domain/payments/payment-terms.service.ts`:

```ts
export class PaymentTermsDomain {
  calculatePaymentDueDate(paymentTerms: PaymentTerms, baseDate: Date) {
    switch (paymentTerms) {
      case "NET_30":
        return addDays(baseDate, 30)
      case "NET_15":
        return addDays(baseDate, 15)
      default:
        return baseDate
    }
  }
}
```

**Aggregator** — `services/marketplace-payments.service.ts`:

```ts
calculatePaymentDueDate(...args) {
  return this.paymentTermsDomain.calculatePaymentDueDate(...args)
}
```

**Facade**:

```ts
calculatePaymentDueDate(...args) {
  return this.paymentsService.calculatePaymentDueDate(...args)
}
```

### Resultado

Facade sem regra de domínio.

---

## Commit 4 — Remover imports de domain da Facade

### Problema

Facade importa `domain/orders`, `domain/payments`, `domain/capacity`, `domain/company`, etc.

### Ação

Mover wiring para **aggregators**. Facade passa a importar apenas:

- `services/*`
- `core/event-bus`
- `types`

**Estrutura final da Facade**:

```ts
constructor(
  private ordersService: MarketplaceOrdersService,
  private paymentsService: MarketplacePaymentsService,
  private offeringsService: MarketplaceOfferingsService,
  private capacityService: MarketplaceCapacityService,
  private commercialService: MarketplaceCommercialService
)
```

### Validação

Facade **não pode conter**:

- `from './domain'`

---

## Commit 5 — Substituir cross-domain orchestration por eventos

### Problema

Facade executa fluxo: orders → payments → capacity.

### Regra

> **>2 domínios = evento**

### Ação

Facade publica evento com **payload completo** e tipo versionado padronizado:

**Convenção de tipo:** `marketplace.<domain>.<action>.v1`  
Ex.: `marketplace.orders.created.v1`, `marketplace.orders.cancelled.v1`, `marketplace.payments.hold-created.v1`

```ts
this.eventBus.publish({
  type: "marketplace.orders.created.v1",
  payload: {
    orderId,
    tenantId,
    buyerActorId,
    sellerActorId,
    totalCents,
    currency
  }
})
```

**Handlers** — com **idempotência + TTL** (sem timers acumulados; custo constante):

- `events/orders/handlers/order-created-payments.handler.ts`:

  ```ts
  const processedOrders = new Map<string, number>()
  const TTL = 300_000

  function cleanup() {
    const now = Date.now()
    for (const [id, ts] of processedOrders) {
      if (now - ts > TTL) processedOrders.delete(id)
    }
  }

  handle(event: OrderCreatedEvent) {
    const id = event.payload.orderId
    if (processedOrders.has(id)) return
    processedOrders.set(id, Date.now())
    this.paymentsService.createPaymentHold(event.payload)
    if (processedOrders.size > 1000) cleanup()
  }
  ```

- `events/orders/handlers/order-created-capacity.handler.ts`: mesmo padrão (Map + timestamp + cleanup após cada handle).

### Resultado

Facade sem workflow multi-domain.

---

## Commit 6 — Reduzir Facade para Gateway

Após commits 1–5, a facade vira:

```ts
export class MarketplaceService {

  constructor(
    private ordersService: MarketplaceOrdersService,
    private paymentsService: MarketplacePaymentsService,
    private offeringsService: MarketplaceOfferingsService,
    private capacityService: MarketplaceCapacityService
  ) {}

  getServiceOffering(id: string) {
    return this.offeringsService.getServiceOffering(id)
  }

  createOrder(input: CreateOrderInput) {
    return this.ordersService.createOrder(input)
  }

  createServiceRequest(input: CreateServiceRequestInput) {
    return this.ordersService.createServiceRequest(input)
  }

}
```

---

## Resultado esperado

| Arquivo                  | Antes | Depois   |
| ------------------------ | ----- | -------- |
| `marketplace.service.ts` | 3016  | 650–750  |
| `marketplace.routes.ts`  | 1310  | 80–120   |
| aggregators              | ~150  | 150–300  |
| domain modules           | ~300  | 300–600  |

---

## Checklist final automático

### Facade não pode conter

- `new Map`
- `.get(`
- `.set(`
- `.delete(`
- `switch(`
- `reduce(`
- `filter(`
- `.map(` (lógica de negócio)

### Facade imports proibidos

- `domain/`

### Routes

- **marketplace.routes.ts:** proibido `async (req, reply)` (agregador puro).
- **routes/*.ts:** cada arquivo apenas registra endpoints e delega ao service (sem lógica de domínio, sem import de domain). Handlers podem ser `async (req, reply) => service.método(...)`.

---

## Estrutura final do módulo (após refactor)

```
modules/marketplace

routes/
  marketplace-orders.routes.ts
  marketplace-payments.routes.ts
  marketplace-services.routes.ts
  marketplace-company.routes.ts
  marketplace-intents.routes.ts

services/
  marketplace-orders.service.ts
  marketplace-payments.service.ts
  marketplace-offerings.service.ts
  marketplace-capacity.service.ts
  marketplace-commercial.service.ts

domain/
  orders/
  payments/
  offerings/
  capacity/
  economic/
  company/

events/
  orders/
    order-created.event.ts
    handlers/
      order-created-payments.handler.ts
      order-created-capacity.handler.ts

marketplace.routes.ts
marketplace.service.ts
```

---

## Marketplace Architecture Guard (CI)

Regras recomendadas (evitam regressão para God Service):

1. facade não importa domain
2. facade não usa Map
3. facade < 900 linhas
4. routes sem handlers inline
5. **routes não importam domain**
6. >2 domínios → evento
7. aggregators sem estado
8. **domain terminal** — domain não importa application nem services (SSOT; só recebe chamadas)
9. events versionados (`.v1`)

Ver script: `scripts/marketplace-architecture-guard.js` — regras 1–5 executáveis em CI. Evolução futura: aggregators sem Map, regra domain terminal no guard, lint para eventos `.v1`.

**Grafo de dependências:** `npm run marketplace:dependency-graph` gera Mermaid, **falha se direção de camada for inválida** ou se houver **ciclo**. Regra: routes → facade → services/application → domain → events; domain terminal. Bloqueios: facade → domain, facade → events; events → domain (handlers chamam services, não domain).

**CI (dois níveis de proteção):**
```bash
npm run marketplace:architecture-guard   # regras locais (facade, routes)
npm run marketplace:dependency-graph    # integridade estrutural (direção + ciclos)
# ou um único comando:
npm run marketplace:validate
```
