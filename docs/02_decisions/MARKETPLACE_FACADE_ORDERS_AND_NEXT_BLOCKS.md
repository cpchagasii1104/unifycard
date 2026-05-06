# Facade: Orders e próximos blocos de extração

**Objetivo:** identificar o que é “Orders” na facade hoje e quais blocos têm maior impacto para reduzir ~3008 → ~900 linhas.

---

## 1. Grep "order" na facade — resultado

Foram encontradas **todas** as ocorrências de `order`/`Order` em `marketplace.service.ts`. Resumo:

| Tipo | Onde | Já delega? |
|------|------|-------------|
| **Aggregator** | `readonly orders: MarketplaceOrdersService` | Sim — facade só expõe o agregador |
| **createOrder, addOrderItem, getOrder** | Dentro de `getSubscriptionOrchestratorAdapter()` | Sim — `self.orders.createOrder(storeId)`, etc. |
| **createCheckoutFromOrder, addServiceOrderToOrder** | Idem | Sim — `self.checkout.*`, `self.services.*` |
| **recordOrderEvent** | Método da facade (linhas ~810–817) | Sim — `this.governance.recordOrderEvent(input)` |
| **getDisputesByOrder** | Linhas ~873–874 | Sim — `this.governance.getDisputesByOrder(orderId)` |
| **createDeliveryFromHub** | Linhas ~765–766 | Sim — `commerceOperationsApplicationService` |
| **generateSubscriptionCycle** | Retorna `order: Order` | Sim — `subscriptionsService` |
| **convertBatchToOrders** | Linhas ~1316–1317 | Sim — `productionModule` |
| **getServiceOrdersMap** | Linhas ~1683–1684 | Sim — `offeringsApplicationService` |
| **ordersModule, ordersApplicationService** | Getters / wiring | Sim — exposição do domain/application |
| **acceptServiceDispatch** | Retorna `Order` | Delegado ao dispatch/commerce |

Conclusão: **não há bloco “Orders” para extrair** — o fluxo de orders já está no agregador `marketplace-orders.service.ts` e a facade só delega ou expõe o agregador.

---

## 2. Onde está o tamanho da facade (~3008 linhas)

A facade é sobretudo **delegação em linha única** por método. O volume vem de:

1. **Muitos métodos** — cada operação é um método que chama `this.<aggregator>.<method>()`.
2. **Tipos grandes** — assinaturas com objetos aninhados (ex.: B2B, Company onboarding, Industry).
3. **Blocos de wiring** — `getSubscriptionOrchestratorAdapter()`, `getDispatchAggregatorDeps()`, deps do orchestrator.

Não há um “bloco Orders” grande de lógica; há muitas **seções** (Orders, Company, Payments, Governance, Industry, Economic, Production, etc.) já delegando.

---

## 3. Próximos alvos de maior impacto (não “Orders”)

Para reduzir a facade de forma mecânica e segura, os alvos são **seções inteiras** que podem virar **acesso direto ao agregador** (rotas/callers chamam `facade.orders`, `facade.company`, `facade.payments` em vez de `facade.createOrder`, `facade.getCompanyPlan`, etc.). Isso não “extrai” lógica nova; **expõe os agregadores** e remove métodos-repasse na facade.

### 3.1 Seções que já delegam (candidatas a “remover repasse”)

| Seção (por comentário ===) | Agregador / módulo | Linhas aprox. | Ação sugerida |
|----------------------------|--------------------|---------------|---------------|
| Subscriptions | subscriptionsService | ~70 | Rotas usarem `facade.subscriptions` ou equivalente se existir |
| Industry / Distribution | industryModule | ~75 | Idem |
| Governance / SLA / Disputes | governance, slaModule | ~80 | Idem |
| Incentivos | marketplaceOrchestrationService | ~60 | Idem |
| B2B | b2bService | ~70 | Idem |
| Economic sustainability | economicModule, orchestration | ~55 | Idem |
| Production | productionModule | ~45 | Idem |
| Company (planos, onboarding, terminais, activation) | company | ~180 | Maior bloco; rotas → `facade.company.*` |
| Payments (terminals, config, revenue, flow) | payments | ~90 | Idem |
| Dispatch / Services (getters Map, listEligible, dispatch, accept) | dispatchModule, services | ~100+ | Idem |

Ordem sugerida para “remover repasse” (por impacto e risco):

1. **Company** — mais métodos e tipos grandes.
2. **Payments** — muitos getters e métodos de infra.
3. **Governance/SLA** — já bem encapsulado no governance.
4. **Industry, Production, Economic, B2B, Incentives** — em seguida.

### 3.2 Método rápido para identificar blocos (script)

No repositório foi adicionado um script que:

- Percorre `marketplace.service.ts`.
- Detecta seções por comentários `// =====`.
- Conta linhas por seção e lista métodos que contêm `order`/`Order` (e opcionalmente outros termos).
- Gera um relatório em texto para cortes futuros.

Uso:

```bash
node scripts/marketplace-facade-blocks-report.js
```

Assim você identifica rapidamente **quais seções** têm mais linhas e **quais métodos** são “order-related” (já todos delegados).

---

## 4. Commit 4 recomendado (reformulado)

Como **Orders já está extraído**, o Commit 4 mais útil é:

**Objetivo:** reduzir a facade removendo uma **seção inteira de repasses** e fazendo os callers usarem o agregador diretamente.

**Alvo sugerido:** seção **Company** (initializeCompanyPlans, getCompanyPlan, getAllCompanyPlans, createCompanyOnboarding, completeCompanyOnboarding, mapCategoryToActorType, createPaymentTerminal, approvePaymentTerminal, activatePaymentTerminal, getCompanyActivationState, updateCompanyActivationState, getCompanyOnboarding, getCompanyOnboardingByCompanyId, validateCompanyPlanLimits).

**Passos:**

1. Garantir que as **rotas** que hoje chamam `marketplaceService.getCompanyPlan(...)` etc. passem a usar `marketplaceService.company.getCompanyPlan(...)` (ou o nome exposto do agregador).
2. Remover da facade os métodos que são só repasse para `this.company.*`.
3. Repetir para outras seções (Payments, Governance, etc.) nos próximos commits.

**Impacto típico:** ~150–250 linhas a menos na facade por seção (dependendo de tipos e comentários).

---

## 5. Resumo

| Pergunta | Resposta |
|----------|----------|
| Existe bloco “Orders” para extrair? | Não — já está no agregador; facade só delega. |
| Por que a facade ainda é grande? | Muitos métodos de repasse (1 linha cada) + tipos grandes + wiring. |
| Próximo passo de maior impacto? | Fazer rotas/callers usarem `facade.company` (e depois `facade.payments`, etc.) e remover os métodos-repasse da facade. |
| Como identificar blocos rapidamente? | Rodar `node scripts/marketplace-facade-blocks-report.js` (ver script abaixo). |

Este documento pode ser atualizado após cada commit de redução da facade.
