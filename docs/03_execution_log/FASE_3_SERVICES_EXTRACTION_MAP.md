# FASE 3 — Mapeamento para extração marketplace.service.services.ts

Mapeamento da estrutura atual de `marketplace.service.ts` para métodos que manipulam:
- **serviceRequests**
- **serviceDispatches**
- **serviceBookings**
- **servicePreReservations**
- **serviceOrders**

Sem alterar código; apenas estrutura atual por bloco funcional.

---

## 1. Declarações e getters de Map (expostos)

| Nome | Linhas | Maps usados | Outras dependências |
|------|--------|-------------|---------------------|
| `getServiceOrdersMap` | 607 | serviceOrders | — |
| `getServiceBookingsMap` | 608 | serviceBookings | — |
| `getServiceDispatchesMap` | 3342 | serviceDispatches | — |

---

## 2. Bloco: Service Booking + Service Order (reserva e ordem de serviço)

Métodos que leem/escrevem **serviceBookings** e **serviceOrders**.

| Método | Linhas (aprox.) | Maps usados | Dependências |
|--------|------------------|-------------|--------------|
| `createServiceBooking` | 638–705 | serviceBookings | offeringsService (getServiceOfferingInternal, getServiceAvailability) |
| `confirmServiceBooking` | 708–765 | serviceBookings, serviceOrders | offeringsService (getServiceOfferingInternal) |
| `getServiceBooking` | 767–777 | serviceBookings | — |
| `getServiceOrderByBooking` | 783–785 | serviceOrders | — |
| `getServiceOrder` | 790–792 | serviceOrders | — |
| `addServiceOrderToOrder` | 798–865 | serviceOrders, serviceBookings (indireto) | orders (getOrder), offeringsService (getServiceOfferingInternal) |

---

## 3. Bloco: Inicialização de dados de serviço

| Método | Linhas (aprox.) | Maps usados | Dependências |
|--------|------------------|-------------|--------------|
| `initializeServiceData` | 867–973 | — (não usa os 5 maps) | offeringsService (setServiceOffering, setServiceAvailability), providerOnlineStatus |

*Nota: não manipula serviceRequests/dispatches/bookings/preReservations/serviceOrders; apenas seed de offerings e provider status.*

---

## 4. Bloco: Adapters e orquestradores (Dispatch)

Objetos que expõem os Maps ao sub-serviço de dispatch.

| Elemento | Linhas (aprox.) | Maps usados | Dependências |
|----------|------------------|-------------|--------------|
| `dispatchStateAdapter` (getter) | 3350–3366 | serviceDispatches, serviceRequests, orderEvents, providerOnlineStatus | offeringsService (getServiceAvailability), getPreReservationsByDispatch |
| `dispatchOrchestrator` (getter) | 3371–3418 | serviceDispatches, servicePreReservations, serviceBookings | dispatchService (recordDispatchResponse), generateEconomicEvent (opcional) |

Instâncias que consomem esses adapters:
- `dispatchService` = `new MarketplaceDispatchService(this.dispatchStateAdapter)` (3368)
- `dispatchDomainService` = `new MarketplaceDispatchDomainService(this.dispatchOrchestrator)` (3420)

---

## 5. Bloco: Service Request (criação, expiração, leitura)

| Método | Linhas (aprox.) | Maps usados | Dependências |
|--------|------------------|-------------|--------------|
| `createServiceRequest` | 3424–3535 | serviceRequests, userRequestHistory | offeringsService (getServiceOfferingInternal), checkAntiSpam (userRequestHistory), generateEconomicEvent (opcional) |
| `expireServiceRequest` | 4095–4159 | serviceRequests, serviceDispatches | generateEconomicEvent (opcional) |
| `getServiceRequest` | 4165–4167 | serviceRequests | — |

---

## 6. Bloco: Service Dispatch (envio, aceite, leitura, atualização)

| Método | Linhas (aprox.) | Maps usados | Dependências |
|--------|------------------|-------------|--------------|
| `dispatchServiceRequest` | 3741–3822 | serviceRequests, serviceDispatches | listEligibleServiceProviders, sortCandidatesDeterministically, createPreReservationsForDispatch, dispatchService (recordDispatchSent) |
| `acceptServiceDispatch` | 3827–4090 | serviceDispatches, serviceRequests, serviceBookings, serviceOrders | getPreReservationsByDispatch, confirmPreReservation, orders (createOrder, addOrderItem, createCheckoutFromOrder, etc.), dispatchService, generateEconomicEvent (opcional) |
| `getServiceDispatch` | 4172–4174 | — (delega) | dispatchDomainService.getServiceDispatch (que lê serviceDispatches via orquestrador) |
| `updateServiceDispatch` | 4178–4180 | — (delega) | dispatchDomainService.updateServiceDispatch (escreve serviceDispatches via orquestrador) |

---

## 7. Bloco: Service Pre-Reservation (criação, confirmação, expiração, leitura)

| Método | Linhas (aprox.) | Maps usados | Dependências |
|--------|------------------|-------------|--------------|
| `createPreReservation` (private) | 4328–4385 | servicePreReservations | generateEconomicEvent (opcional) |
| `confirmPreReservation` (private) | 4652–4716 | servicePreReservations, serviceRequests | createServiceBooking, generateEconomicEvent (opcional) |
| `createPreReservationsForDispatch` (private) | 4559–4647 | serviceDispatches, servicePreReservations | offeringsService, isSlotAvailable, checkProviderAbuse, createPreReservation |
| `expirePreReservations` | 4720–4723 | — (delega) | dispatchDomainService.expirePreReservations (usa servicePreReservations via orquestrador) |
| `getPreReservation` | 4727–4729 | — (delega) | dispatchDomainService.getPreReservation |
| `getPreReservationsByDispatch` | 4733–4735 | — (delega) | dispatchDomainService.getPreReservationsByDispatch (lê servicePreReservations) |

---

## 8. Bloco: Helpers / matching (eligibilidade, ordenação, slot, anti-spam)

| Método | Linhas (aprox.) | Maps usados | Dependências |
|--------|------------------|-------------|--------------|
| `listEligibleServiceProviders` | 3544–3735 | serviceRequests | offeringsService, providerOnlineStatus, getProviderPresence, getStores, disputeCases, checkResourceAvailability, getEligibleResourcesForMatching, economicIdentityService, getReputationSnapshots, recordCapacityEvent |
| `sortCandidatesDeterministically` (private) | 4440–4505 | — | getProviderPresence, calculateMatchingPriority, getProviderResponseSLAMetrics |
| `isSlotAvailable` (private) | 4388–4436 | serviceBookings, servicePreReservations | offeringsService (getServiceAvailability) |
| `checkAntiSpam` (private) | 4510–4536 | userRequestHistory | — |
| `checkProviderAbuse` (private) | 4541–4554 | — | getProviderResponseSLAMetrics |

---

## 9. Bloco: Inbox e exposição ao app do prestador

| Método | Linhas (aprox.) | Maps usados | Dependências |
|--------|------------------|-------------|--------------|
| `getProviderDispatchInbox` | 4245–4277 | — (delega) | dispatchService.getProviderDispatchInbox (lê serviceDispatches, serviceRequests, pré-reservas via state adapter) |
| `normalizeDispatchInboxStatus` (private) | 4280–4286 | — | — |

---

## 10. Bloco: Timeline e status do ServiceRequest (app demandante)

| Método | Linhas (aprox.) | Maps usados | Dependências |
|--------|------------------|-------------|--------------|
| `getServiceRequestTimeline` | 4744–4965 | serviceRequests, serviceDispatches | getPreReservationsByDispatch, serviceBookings (via iteração em pré-reservas confirmadas / bookings), serviceOrders (indireto) |
| `getServiceRequestStatus` | 4970–5100 | serviceRequests, serviceDispatches, serviceBookings, serviceOrders | getPreReservationsByDispatch, orders (getOrder, listCheckouts, getCheckoutOrderId) |

---

## 11. Bloco: Quote, conclusão e disputa (payment hold / completion)

Estes métodos usam **serviceRequests** (e em alguns casos dispatches/bookings/orders) além de outros maps (serviceQuotes, servicePaymentHolds, etc.).

| Método | Linhas (aprox.) | Maps usados | Dependências |
|--------|------------------|-------------|--------------|
| `createServiceQuote` | 5633–5716 | serviceRequests (get) | serviceVisits, serviceQuotes, offeringsService, generateEconomicEvent (opcional) |
| `acceptServiceQuote` | 5719–5826 | serviceRequests (get) | serviceQuotes, servicePaymentHolds, orders, generateEconomicEvent (opcional) |
| `declineServiceQuote` | 5829–5879 | serviceRequests (get) | serviceQuotes, generateEconomicEvent (opcional) |
| `confirmServiceCompletedByCustomer` | 5224–5256 | serviceRequests | getServicePaymentHoldByRequest, createServiceCompletionSignal, releaseServicePaymentHold |
| `confirmServiceCompletedByProvider` | 5260–5299 | serviceRequests, serviceDispatches | getServicePaymentHoldByRequest, createServiceCompletionSignal, releaseServicePaymentHold |
| `disputeService` | 5304–5375 | serviceRequests, serviceDispatches | getServicePaymentHoldByRequest, createDisputeCase, etc. |
| `completeServiceRequest` | 5475–5532 | serviceRequests, serviceDispatches | getProviderResponseSLAMetrics, generateEconomicEvent (opcional) |

---

## 12. Bloco: Capacidade (recurso e empresa) — uso de pré-reservas, bookings, requests, dispatches

| Método | Linhas (aprox.) | Maps usados | Dependências |
|--------|------------------|-------------|--------------|
| `recalculateResourceCapacity` | 6782–6882 | servicePreReservations, serviceDispatches, serviceRequests, serviceBookings | capacityService, offeringsService, getResourceDependenciesByService |
| `recalculateCompanyCapacity` | 6990–7057 | — (indireto) | capacityService, recalculateResourceCapacity (que usa os 4 maps acima) |
| `getCompanyCapacityMetrics` | 7059–7063 | — (indireto) | recalculateCompanyCapacity, capacityService |
| `getResourceCapacityMetrics` | 7065–7068 | — (indireto) | recalculateResourceCapacity, capacityService |

---

## 13. Bloco: Processamento pós-serviço e compensação

| Método | Linhas (aprox.) | Maps usados | Dependências |
|--------|------------------|-------------|--------------|
| `processResourceCompensation` | 7444–… | serviceOrders | orders (getOrder, listCheckouts, listPaymentPlans, …), capacityService, etc. |

---

## 14. Bloco: Métricas regionais e operação real (reporting)

| Método | Linhas (aprox.) | Maps usados | Dependências |
|--------|------------------|-------------|--------------|
| `calculateRegionalCapacityMetric` | 8183–8345+ | serviceRequests, serviceDispatches | getStores, getServiceResourcesByStore, capacityEvents, serviceGovernanceMetrics, classifyRegionalCapacity, calculateSLARiskLevel, etc. |
| `calculateRealOperationMetrics` | 9046–9151 | serviceOrders, serviceRequests, serviceDispatches | offeringsService (getServiceOfferingInternal, getServiceOfferingsAll) |
| `calculateServiceMarginAnalysis` | 9195–9261 | serviceOrders | offeringsService, getServiceTemplates |

---

## Resumo: blocos coesos para extração

- **Bloco A — Booking + Order (CRUD)**  
  createServiceBooking, confirmServiceBooking, getServiceBooking, getServiceOrderByBooking, getServiceOrder, addServiceOrderToOrder.  
  Maps: serviceBookings, serviceOrders.  
  Coeso: reserva + ordem de serviço e vínculo com checkout.

- **Bloco B — Request + Dispatch + PreReservation (fluxo demanda)**  
  createServiceRequest, dispatchServiceRequest, acceptServiceDispatch, expireServiceRequest, getServiceRequest, createPreReservation, createPreReservationsForDispatch, confirmPreReservation, expirePreReservations, getPreReservation, getPreReservationsByDispatch, getServiceDispatch, updateServiceDispatch.  
  Maps: serviceRequests, serviceDispatches, servicePreReservations.  
  Helpers do mesmo fluxo: listEligibleServiceProviders, sortCandidatesDeterministically, isSlotAvailable, checkAntiSpam, checkProviderAbuse.

- **Bloco C — Adapters/Orchestrator**  
  dispatchStateAdapter, dispatchOrchestrator (e instâncias dispatchService, dispatchDomainService).  
  Mantidos no service principal ou movidos junto com B, conforme estratégia de dependência circular.

- **Bloco D — Timeline e status**  
  getServiceRequestTimeline, getServiceRequestStatus.  
  Leitura de serviceRequests, serviceDispatches, serviceBookings, serviceOrders (e orders).

- **Bloco E — Inbox**  
  getProviderDispatchInbox, normalizeDispatchInboxStatus.  
  Delega ao dispatchService (que usa os maps via adapter).

- **Bloco F — Quote e conclusão**  
  createServiceQuote, acceptServiceQuote, declineServiceQuote, completeServiceRequest, confirmServiceCompletedByCustomer, confirmServiceCompletedByProvider, disputeService.  
  Usam serviceRequests (e em parte serviceDispatches); também serviceQuotes, servicePaymentHolds, orders.

- **Bloco G — Capacidade**  
  recalculateResourceCapacity, recalculateCompanyCapacity, getCompanyCapacityMetrics, getResourceCapacityMetrics.  
  Usam servicePreReservations, serviceDispatches, serviceRequests, serviceBookings; capacityService.

- **Bloco H — Reporting (métricas)**  
  calculateRegionalCapacityMetric, calculateRealOperationMetrics, calculateServiceMarginAnalysis.  
  Leitura de serviceRequests, serviceDispatches, serviceOrders (+ outros domínios).

- **Bloco I — Compensação**  
  processResourceCompensation.  
  Usa serviceOrders + orders + capacity.

- **Getters de Map**  
  getServiceOrdersMap, getServiceBookingsMap, getServiceDispatchesMap: podem permanecer no orchestrator como API estável ou ser substituídos por API do novo módulo.

---

*Documento gerado para planejamento da FASE 3 — services extraction. Nenhum código foi alterado.*
