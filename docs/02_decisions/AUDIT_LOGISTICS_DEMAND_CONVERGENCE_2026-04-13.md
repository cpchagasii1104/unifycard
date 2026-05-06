# Auditoria — Convergência de demanda logística (DeliveryOrder × ride_request × TransportDemand)

**ID:** AUDIT-LOGISTICS-DEMAND-CONVERGENCE-2026-04-13  
**Tipo:** auditoria técnica + plano de convergência (não é norma; não substitui `docs/01_normative/`)  
**Base:** `RFC_UNIFIED_LOGISTICS_MODEL.md`, `RFC_LEI_LOGISTICA_UNIFICARD.md`, inventário de `backend/src` (Abril 2026)

---

## 1. Resumo executivo

O maior risco sistémico identificado é a **tripla representação** de “há movimento ou entrega a satisfazer”:

| Conceito no código / BD | Módulo | Papel actual | Risco |
|-------------------------|--------|----------------|-------|
| **DeliveryOrder** | Marketplace (contrato + Maps legados) | Pedido comercial de entrega; campo `vehicle` e preferências de loja | Tratado historicamente como “logística”; **não** é `UnifiedDemand` |
| **ride_request** / `rides_rides` | Rides | Execução de mobilidade persistida | Pode ser criado **sem** plano vindo de logistics |
| **TransportDemand** | `modules/logistics` | Entrada do planner (`planTransport`) | Nome de código; **papel** = candidato a **UnifiedDemand** até RFC de renomeação |

**Convergência desejada (produto + lei proposta):**

1. **DeliveryOrder** → apenas **gatilho / referência comercial** que dispara criação de **UnifiedDemand** (persistência e contrato em RFC filho).  
2. **Decisão de meio** (Fiat Uno → helicóptero) → **só** `TransportPlan` / `TransportLeg` produzidos pelo núcleo **logistics** (`matchVehicleForDemand`, políticas futuras).  
3. **Navegação** (cidade, categoria, capacidade) → **um** vocabulário de filtro que alimenta **tanto** descoberta de oferta **como** construção de **UnifiedDemand** (sem duplicar regras de “onde / o quê”).

---

## 2. Onde a decisão de veículo / meio ainda foge do logistics

| Local | O quê | Classificação |
|--------|--------|----------------|
| `modules/logistics/vehicle-matcher.service.ts` | `matchVehicleForDemand` | **Canónico (alvo)** |
| `contracts/marketplace/DeliveryOrder.contract.ts` | `vehicle: 'bike' \| 'moto' \| …` | **Comercial / legado** — não é SSOT de plano; deve alinhar-se ao plano ou tornar-se só “preferência” até migração |
| `domain/orders/marketplace-orders.service.ts` | `defaultVehicle`, `storeDeliveryPreferences` em `createDeliveryFromCheckout` | **Duplica decisão de meio** fora de logistics |
| `domain/industry/marketplace-industry.service.ts` | `createDeliveryFromHub` — `supportedVehicles[0]`, mapeamento `truck`→`van` | **Idem** |
| `rides/matching/*.ts`, SQL `rides_find_nearby_drivers` | `service_type_id`, primeiro motorista | **Execução + matching operacional** — OK se **consumir** perna planead; **risco** se continuar a ser única origem de “o quê enviar” |
| `core/orchestrator/orchestrator.executors.ts` | `request_ride` — `vehicleType` obrigatório sem fallback | **Corrigido** — já não decide `car` por defeito; falta **enchimento** via planner ou cliente explícito |

---

## 3. Navegação e “uma lógica para Fiat Uno”

Hoje a descoberta **comercial** e a **mobilidade** não partilham um único motor:

| Fluxo | Ficheiros / entradas | Observação |
|--------|----------------------|------------|
| Busca marketplace por categoria + cidade | `marketplace-search.routes.ts` → `MarketplaceSearchFilters` (`categoryPath`, `location.cityId`, capacidade, preço) | **Catálogo / serviços** — não gera `TransportDemand` |
| Produtos visíveis por categoria | `store-onboarding.routes.ts` (`/products/visible`), `product-visibility.service.ts` | Idem |
| Templates por categoria | `marketplace-templates.routes.ts` | Idem |
| Corrida / motoristas | `rides_find_nearby_drivers`, `rides` lifecycle | **Mobilidade** — outro grafo |

**Alinhamento recomendado (fase 3):**

- Extrair **dimensões de consulta** comuns (`GeoRef`, `CategoryRef`, `CapacityRange`) como **DTO partilhado** ou serviço de “contexto de procura” consumido por:  
  - marketplace search,  
  - construtor de `UnifiedDemand` (origem marketplace),  
  - eventual UI unificada “comprar / transportar”.  
- **Não** misturar isso com SSOT de preço ou ledger; é só **coordenação de filtros** + mapeamento para atributos de `TransportDemand` / `UnifiedDemand`.

*(Implementação: RFC + GATE; não feita nesta auditoria.)*

---

## 4. Passo a passo de convergência (ordem sugerida)

### Fase A — Gatilho DeliveryOrder → UnifiedDemand

- **Entrada:** `createDeliveryFromCheckout`, `createDeliveryFromHub`, rotas em `marketplace-delivery.routes.ts`.  
- **Acção:** após persistência/comercial de `DeliveryOrder`, emitir ou gravar **UnifiedDemand** (tabela ou fila — RFC schema) com `sourceType: 'marketplace_delivery'`, `sourceId: deliveryId`.  
- **GATE:** contrato `DeliveryOrder` congelado — alterações só com nova versão ou campos opcionais `unifiedDemandId`.

### Fase B — Veículo só via logistics

- **Substituir** escolha `defaultVehicle` / `supportedVehicles[0]` por:  
  `planTransport(demand)` → usar `legs[0].vehicleType` (ou política multi-leg) para **exibir** ou **persistir referência** no pedido comercial, **sem** segunda fonte de verdade.  
- **Rides:** aceitar `planId` / `legId` ao criar `ride_request` (RFC rides + schema).

### Fase C — Filtros de navegação

- **Unificar** origem de `categoryPath` / `cityId` entre `marketplace-search` e o builder de `UnifiedDemand` (biblioteca partilhada ou serviço `search-context` em `logistics` ou `shared` — decisão arquitectural em RFC).

---

## 5. Coerência com a lei proposta (RFC, não promulgada)

- `RFC_LEI_LOGISTICA_UNIFICARD.md`: proíbe `DeliveryOrder` como SSOT de logística; proíbe `vehicleType` fora de logistics em plano canónico.  
- Esta auditoria **não** altera normativa; orienta execução futura.

---

## 6. Checklist rápido para PRs (GATE)

- [ ] Este PR introduz nova “demanda de transporte” sem `UnifiedDemand` (ou nome RFC equivalente)? → **Bloquear** ou documentar excepção temporária com prazo.  
- [ ] Este PR adiciona `vehicle` / `vehicleType` decidido fora de `modules/logistics` para **plano**? → **Bloquear**.  
- [ ] Este PR duplica filtros cidade/categoria entre marketplace e rides sem referência comum? → **Sinalizar débito técnico** no RFC de fase C.

---

## 7. Histórico

| Data | Nota |
|------|------|
| 2026-04-13 | Auditoria redigida (pós-comentários SSOT em `DeliveryOrder` e correção do orchestrator). |
