# Execução: Facade Leve — Marketplace Services de Agrupamento

**Data:** 2026-03-10  
**Modo:** EXECUTOR  
**Protocolo:** docs/01_normative/00_AGENT_PROTOCOL.md  
**Objetivo:** Transformar `marketplace.service.ts` em facade leve via serviços de agrupamento.

## PASSO 1 — Mapa estrutural (marketplace.service.ts)

- **Linhas totais:** ~4181
- **Stores mantidos na facade (não movidos):**  
  `serviceVisits`, `serviceQuotes`, `serviceGovernanceMetrics`, `paymentTerminals`, `regionalCapacitySnapshots`, `servicePaymentHolds`, `serviceCompletionSignals`, `revenueSnapshots`, `providerOnlineStatus`, etc.

### Grupos de métodos mapeados

| Grupo        | Serviço de agrupamento           | Métodos (exemplos) |
|-------------|-----------------------------------|--------------------|
| orders      | marketplace-orders.service.ts     | createOrder, createPhysicalOrder, addOrderItem, getOrder, getOrders, updateOrder, createStoreCustomer, getStoreCustomer, createDeliveryFromCheckout, getDelivery, getDeliveriesByCheckout, createAttributionContext, createShare, getAttribution |
| checkout    | marketplace-checkout.service.ts   | listCheckouts, getCheckoutOrderId, createCheckoutFromOrder, getCheckout, confirmCheckout, createPaymentPlan, getPaymentPlan, associateAttributionToCheckout, executePaymentPlan |
| payments    | marketplace-payments.service.ts   | releaseServicePaymentHold, createServicePaymentHold, getServicePaymentHold*, createServiceCompletionSignal, confirmServiceCompleted*, disputeService, expireServicePaymentHolds, completeServiceRequest, createPaymentInfrastructureConfig, getPaymentInfrastructureConfig, generateRevenueSnapshot, getRevenueSnapshot, getRegionalFinancialFlow |
| dispatch    | marketplace-dispatch.service.ts   | createServiceRequest, listEligibleServiceProviders, dispatchServiceRequest, acceptServiceDispatch, expireServiceRequest, getServiceRequest, getServiceDispatch, updateServiceDispatch, setProviderOnlineStatus, getProviderOnlineStatus, getServiceDispatchesMap, getServiceRequestsMap, getServicePreReservationsMap, expirePreReservations, getPreReservation, getPreReservationsByDispatch, getServiceRequestTimeline, getServiceRequestStatus, recordDispatchSent, updateProviderPresence, getProviderPresence, recordDispatchResponse, getProviderResponseSLAMetrics, getProviderDispatchInbox, getDispatchStatusForProvider, getBookingsByOfferingDateTime, getDisputeCasesMap |
| services    | marketplace-services.service.ts   | getServiceTemplates, getStoreServiceOfferings, getServiceAvailability, createServiceBooking, confirmServiceBooking, getServiceBooking, getServiceOrderByBooking, getServiceOrder, getServiceBookingsMap, getServiceOfferingInternal, addServiceOrderToOrder, getServiceOrdersMap, getServiceOffering |

## PASSO 2–7 — Criação dos serviços e delegação no facade

- Pasta criada: `backend/src/modules/marketplace/services/`
- Arquivos: marketplace-orders.service.ts, marketplace-checkout.service.ts, marketplace-payments.service.ts, marketplace-dispatch.service.ts, marketplace-services.service.ts
- Facade passa a instanciar esses serviços no constructor e delegar chamadas públicas a eles.

## Status

- **SUCESSO** — Serviços de agrupamento criados; facade refatorado para delegar.
- **Arquivos criados:**  
  `backend/src/modules/marketplace/services/marketplace-orders.service.ts`  
  `backend/src/modules/marketplace/services/marketplace-checkout.service.ts`  
  `backend/src/modules/marketplace/services/marketplace-payments.service.ts`  
  `backend/src/modules/marketplace/services/marketplace-dispatch.service.ts`  
  `backend/src/modules/marketplace/services/marketplace-services.service.ts`
- **Arquivo modificado:** `backend/src/modules/marketplace/marketplace.service.ts`  
  - Imports dos 5 agregadores; propriedades `ordersAggregatorService`, `checkoutAggregatorService`, `paymentsAggregatorService`, `dispatchAggregatorService`, `servicesAggregatorService`.  
  - Constructor: inicialização dos 5 agregadores + `getDispatchAggregatorDeps()`.  
  - Métodos públicos de orders, checkout, payments, dispatch e services passaram a delegar aos agregadores (facade leve).
- **Stores mantidos na facade (não movidos):**  
  `serviceVisits`, `serviceQuotes`, `serviceGovernanceMetrics`, `paymentTerminals`, `regionalCapacitySnapshots`, `servicePaymentHolds`, `serviceCompletionSignals`, `revenueSnapshots`, `providerOnlineStatus`, entre outros.
- **Regra respeitada:** routes → facade → application services; facade não contém lógica pesada, apenas delegação.

---

## Segunda rodada (2026-03-11): mais 5 agregadores

- **Novos serviços:**  
  `marketplace-catalog.service.ts` (templates, catálogo, produtos, business templates)  
  `marketplace-company.service.ts` (onboarding, company plans, terminals, validateCompanyPlanLimits)  
  `marketplace-capacity.service.ts` (recursos, capacidade, compensações, capacidade regional, expansão, operational cost profile)  
  `marketplace-discovery.service.ts` (getStoresNear)  
  `marketplace-governance.service.ts` (SLA, reputação, disputas, compliance, service governance metrics)
- **Facade:** importações e propriedades dos 5 agregadores; inicialização no constructor; delegação de getTemplates, getCategories, getStores, getRegions, getStoreCatalog, getCanonicalProducts, getStoresNear, company/capacity/discovery/governance para os novos agregadores.
- **Stores e getters mantidos na facade:** paymentTerminals, getPaymentTerminal, getPaymentTerminalsMap, getCompanyPaymentTerminals; getStoreProducts continua delegando a catalogApplicationService (tipos do contrato).
- **generateReputationSnapshot** permanece delegando ao slaModule (assinatura com actorType mais ampla no facade).
- **tsc:** exit code 0.
