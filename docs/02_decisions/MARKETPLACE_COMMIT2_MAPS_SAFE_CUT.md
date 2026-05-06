# Commit 2 — Remover Maps da Facade: corte seguro

**Objetivo:** eliminar o único uso de `.get(` na facade para que o Architecture Guard pare de falhar em "Facade não pode usar Map".

---

## Situação atual (único Map na facade)

Na facade existe **apenas um** uso direto de Map:

| Local | Código | Função |
|-------|--------|--------|
| ~543–545 | `get serviceOfferings()` | Getter que retorna `this.offeringsApplicationService.getServiceOfferingsMap()` |
| ~1059–1061 | `getServiceOffering(offeringId)` | `return (this.serviceOfferings.get(offeringId) ?? null) as unknown as ServiceOffering \| null` |

Ou seja: a facade **não** possui Map próprio; ela só usa o getter `serviceOfferings` para chamar `.get(offeringId)` em um Map vindo do application layer. O guard falha porque a **regex** encontra `.get(` no arquivo.

---

## Cadeia já existente (sem duplicar estado)

- **Domain:** `domain/offerings/marketplace-offerings.service.ts` — `getServiceOffering(offeringId)` e `getServiceOfferingsMap()`.
- **Application:** `application/services/offerings-application.service.ts` — `getServiceOffering(offeringId)` delega ao domain; `getServiceOfferingsMap()` idem.
- **Aggregator:** `services/marketplace-services.service.ts` — `getServiceOffering(offeringId)` delega ao `offerings` (application) e faz o cast para `ServiceOffering | null`.
- **Facade:** hoje usa o getter + `.get()`; basta passar a delegar ao aggregator.

Nenhum estado novo; só redirecionar a chamada.

---

## Plano de execução (corte mínimo, seguro)

### Passo 1 — Facade: delegar `getServiceOffering` ao aggregator

**Arquivo:** `backend/src/modules/marketplace/marketplace.service.ts`

**Trocar:**

```ts
  /**
   * Orchestrator: wrapper para sub-service Vouchers (getServiceOffering)
   * Map interno usa offering_id; contrato ServiceOffering usa offeringId — cast para interface.
   */
  getServiceOffering(offeringId: string): ServiceOffering | null {
    return (this.serviceOfferings.get(offeringId) ?? null) as unknown as ServiceOffering | null;
  }
```

**Por:**

```ts
  /**
   * Delega ao aggregator de serviços (offerings); sem acesso a Map na facade.
   */
  getServiceOffering(offeringId: string): ServiceOffering | null {
    return this.services.getServiceOffering(offeringId);
  }
```

### Passo 2 — Facade: remover o getter `serviceOfferings`

**Arquivo:** `marketplace.service.ts`

**Não remover** o getter. Uma varredura mostrou que `facade.serviceOfferings` é usado em domain (pricing, orders, vouchers, dispatch, capacity) e em marketplace-templates.service.ts. Remover o getter quebraria o runtime. O corte seguro é **apenas** trocar `getServiceOffering()` para delegar; isso elimina o único `.get(` na facade e faz o guard passar. O getter fica até um commit futuro migrar os callers para domain/application.

**Importante:** outros getters na mesma região (`serviceAvailabilities`, `serviceBookings`, `serviceOrders`) **não** usam `.get(`, `.set(`, `.delete(` nem `new Map` **dentro** da facade; eles apenas **retornam** o Map. O guard atual só procura por `.get(`, `.set(`, `.delete(`, `new Map(`. Portanto, após esse corte, a regra “Facade não pode usar Map” deve passar, desde que não exista outro `.get(` no arquivo. Se o guard evoluir para proibir também “retornar Map”, isso será tratado em passo posterior (ex.: Commit 4 ou 5).

### Passo 3 — Validação

```bash
npx tsc --noEmit -p backend
node scripts/marketplace-architecture-guard.js
```

**Esperado:**

- `tsc` → OK.
- Guard → ainda pode falhar em: “Facade deve ter < 900 linhas”, “Facade não pode importar domain/”, “marketplace.routes.ts não pode conter handlers inline”. A falha **“Facade não pode usar Map”** deve **deixar de aparecer**.

---

## Riscos e mitigações

| Risco | Mitigação |
|-------|------------|
| Domain/templates usam `facade.serviceOfferings` | Getter mantido; apenas `getServiceOffering()` passou a delegar. Migração dos callers fica para commit futuro. |
| Assinatura ou tipo de `getServiceOffering` mudam | Aggregator já expõe `getServiceOffering(offeringId): ServiceOffering \| null`; facade só delega. |
| Callers externos da facade | Continuam chamando `marketplaceService.getServiceOffering(offeringId)`; comportamento idêntico. |

---

## Resultado após o corte

- Facade deixa de usar `.get(` (e de depender do getter que devolvia o Map).
- Estado continua no domain; application e aggregator já delegam corretamente.
- Um passo pequeno e reversível; se algo quebrar, basta reverter o método e o getter.

Depois desse Commit 2 mínimo, o próximo passo natural é continuar com o plano (Commit 3: lógica de pagamento; Commit 4: remover imports de domain; etc.) ou endurecer o guard para “facade não retorna Map” e tratar os getters que apenas retornam Map em um commit dedicado.
