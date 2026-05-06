# Análise dos getters da facade que retornam Map

**Objetivo:** mapear quais getters são apenas leitura segura, quais estão sendo mutados fora do domain e quais são candidatos reais a remoção nos próximos commits.

---

## 1. Inventário: getters/métodos da facade que expõem Map

| Getter / método | Retorno | Origem (delegação) |
|-----------------|---------|--------------------|
| `serviceOfferings` | Map | `offeringsApplicationService.getServiceOfferingsMap()` |
| `serviceAvailabilities` | Map | `offeringsApplicationService.getServiceAvailabilitiesMap()` |
| `serviceBookings` | Map | `offeringsApplicationService.getServiceBookingsMap()` |
| `serviceOrders` (private) | Map | `offeringsApplicationService.getServiceOrdersMap()` |
| `serviceRequests` | Map | `dispatchModule.getServiceRequestsMap()` |
| `serviceDispatches` | Map | `dispatchModule.getServiceDispatchesMap()` |
| `servicePreReservations` | Map | `dispatchModule.getServicePreReservationsMap()` |
| `capacityEvents` | Map | `capacity.getCapacityEventsMap()` |
| `getServiceDispatchesMap()` | Map | idem |
| `getServiceRequestsMap()` | Map | idem |
| `getServicePreReservationsMap()` | Map | idem |
| `getServiceVisitsMap()` | Map | `services.getServiceVisitsMap()` |
| `getServiceQuotesMap()` | Map | `services.getServiceQuotesMap()` |
| `getServiceOrdersMap()` | Map | `offeringsApplicationService.getServiceOrdersMap()` |
| `getServiceBookingsMap()` | Map | via getter `serviceBookings` |
| `getRegionalCapacitySnapshotsMap()` | Map | `expansion.getRegionalCapacitySnapshotsMap()` |
| `getDisputeCasesMap()` | Map | `dispatch.getDisputeCasesMap()` |

Todos são **delegação**: a facade não possui Map próprio; apenas repassa o Map de application/domain.

---

## 2. Quem acessa via facade (domain / services)

### 2.1 Acesso **domain → facade.xxx**

| Facade getter/método | Arquivo(s) no domain | Uso (leitura vs mutação) |
|----------------------|----------------------|---------------------------|
| `facade.serviceOfferings` | pricing, orders, vouchers, dispatch, capacity | **Leitura** (`.get()`, `.values()`, `.entries()`) |
| `facade.serviceAvailabilities` | dispatch, capacity, offerings (interno) | **Leitura** (`.get()`) |
| `facade.serviceBookings` | capacity | **Leitura** (`.values()`) |
| `facade.serviceOrders` | pricing, compensation, orders (via state ou services) | **Leitura** (`.values()`) |
| `facade.serviceRequests` | capacity | **Leitura** (`.get()`) |
| `facade.serviceDispatches` | capacity | **Leitura** (`.get()`) |
| `facade.servicePreReservations` | capacity | **Leitura** (`.values()`) |
| `facade.dispatchModule.getServiceRequestsMap()` | pricing | Leitura |
| `facade.dispatchModule.getServiceDispatchesMap()` | pricing | Leitura |
| `facade.getDisputeCasesMap()` | dispatch, services (via facade) | Leitura |

Ou seja: **todo uso atual de facade.xxx no domain é leitura**. Nenhum domain está chamando `.set()` ou `.delete()` no Map retornado pela facade (os `.set()` em domain/offerings são nos Maps **internos** do próprio domain, não no retorno da facade).

---

## 3. Mutação fora do domain: a exceção

| Caller | O que faz | Risco |
|--------|-----------|--------|
| **marketplace-templates.service.ts** | `const serviceOfferings = this.facade.serviceOfferings` e depois `serviceOfferings.set(offeringId, offering)` | **Alto** — service está **mutando** o Map que veio da facade (que por sua vez é o Map do domain/application). Isso quebra o princípio “estado só no domain” e cria acoplamento invisível. |

O correto seria algo como:

```ts
offeringsDomain.addOrUpdateOffering(offeringId, offering)
// ou
facade.createServiceOffering(storeId, templateId, ...)
```

e **não** `facade.serviceOfferings.set(...)`.

**Conclusão:** Esse é o único ponto onde um **Map exposto pela facade está sendo mutado fora do domain**. É candidato prioritário a refactor no “refactor do domínio offerings” (não no Commit 2/3).

---

## 4. Resumo por tipo

### 4.1 Apenas leitura segura (domain e services só leem)

- `serviceAvailabilities`
- `serviceBookings`
- `serviceOrders` (private)
- `serviceRequests`
- `serviceDispatches`
- `servicePreReservations`
- `capacityEvents`
- `getServiceVisitsMap` / `getServiceQuotesMap`
- `getServiceOrdersMap` / `getServiceBookingsMap`
- `getServiceRequestsMap` / `getServiceDispatchesMap` / `getServicePreReservationsMap`
- `getRegionalCapacitySnapshotsMap`
- `getDisputeCasesMap`

Nenhum deles é mutado via facade no código atual (exceto o caso de templates abaixo).

### 4.2 Mutado fora do domain (corrigido)

- **serviceOfferings** — **Corrigido:** `marketplace-templates.service.ts` passou a usar `facade.createServiceOffering(offering)`; escrita só no domain (`addOffering()`). 
### 4.3 Porta de legado (já tratado no Commit 2)

- **serviceOfferings** — getter mantido só para compatibilidade; a facade **internamente** não usa mais `.get()` (delega para `this.services.getServiceOffering()`). Quem ainda usa o getter: domain (só leitura) + templates (só leitura; mutação removida).

---

## 5. Candidatos a remoção (ordem sugerida)

### Não remover agora (dependem do fluxo domain → facade → Map)

Todos os getters/métodos acima são usados por **domain** ou por **services** (via `facade.xxx` ou `facade.getXxxMap()`). Remover sem migrar os callers quebraria o runtime. A ordem correta é:

1. **Migrar callers** para obter dados via **domain** ou via **métodos da facade** que não retornem Map (ex.: `getServiceOffering(id)`, queries por período, etc.).
2. **Depois** remover o getter/método que retorna Map.

### Candidato prioritário para refactor (não para “remover getter”, e sim para “eliminar mutação”)

- **marketplace-templates.service.ts**  
  Parar de usar `this.facade.serviceOfferings.set(...)` e passar a usar uma API do domain ou da facade, por exemplo:
  - `offeringsDomain.addOffering(...)` ou
  - `facade.createServiceOffering(...)` (se a facade expuser esse caso de uso).

Assim o “SSOT” de offerings continua no domain e ninguém muta o Map exposto pela facade.

---

## 6. Onde está a complexidade escondida

- **~80%** da complexidade não está nos getters em si, e sim em:
  1. **Domain dependendo de facade** para ler estado (`domain → facade.serviceOfferings`, etc.). O alvo é inverter para `domain` como dono e `facade → services → domain`.
  2. ~~**Um único ponto de mutação indevida:** templates.service fazendo `facade.serviceOfferings.set()`~~ **Corrigido:** templates usa `facade.createServiceOffering()`; escrita só no domain.
  3. **Orchestrator/state/deps** recebendo muitas funções `getXxxMap()` na facade. Quando o state adapter e os aggregators estiverem estáveis, esses getters podem ser substituídos por acessos via domain/application, e a facade deixa de expor Map.

---

## 7. Próximos passos recomendados

| Prioridade | Ação |
|------------|------|
| 1 | **Commit 3** — Extrair `calculatePaymentDueDate` para domain (redução de linhas na facade). |
| 2 | ~~**Refactor offerings** — Trocar `templates.service` para não usar `facade.serviceOfferings.set()`~~ **Feito:** templates usa `facade.createServiceOffering()`. |
| 3 | **Commit 4** — Remover imports `facade → domain`; facade passar a depender só de services. |
| 4 | Migrar gradualmente os callers que usam `facade.serviceOfferings` (e depois outros getters) para acessar via domain/application; então remover os getters de Map da facade. |

Este documento pode ser atualizado após cada commit ou refactor relevante.
