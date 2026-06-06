# DECISION-0109 — Trilho B (Serviços / Agenda / Booking): taxonomia própria, fundação Bank-free, availability canônica

**Data:** 2026-06-05
**Tipo:** Arquitetura / Ontologia / Serviços (Trilho B) — docs-only
**Status:** PROMULGADA (docs-only — não autoriza código/schema/migration/Bank/Op3A)
**Frente:** `F-SERVICE-TRACK-B-FOUNDATION`
**HEAD de origem:** `92b82afb`
**Decisor:** Clayton (Op3D — DECISION antes de código; "serviço não entra pelo mesmo cano do produto")

---

## 1. Título
Antes de qualquer código no Trilho B, cravar a fundação: **serviço usa taxonomia `domain='servicos'`** (não marketplace);
**`company_type` pode pré-moldar ramo de serviço mas exige bridge explícita** para categorias de serviço; **criação de
serviço + agenda são Bank-free**; **booking/order/payment ficam bloqueados** até decisão financeira própria;
**`availability` (core) é o substrato canônico** (`unified_availability` não existe como tabela); **endpoints fantasma
do frontend não criam SSOT paralelo**; **piloto = salão**; **restaurante adiado**. Decide a norma; não toca código.

## 2. Data
2026-06-05.

## 3. Tipo
Arquitetura / Ontologia / Serviços (Trilho B). Docs-only.

## 4. Status
PROMULGADA. Não autoriza código, schema, migration, seed, endpoint, Bank, nem abrir Op3A/booking. Crava a norma e
a sequência; abre 4 DTs.

## 5. Contexto (raio-x read-only `Op3 READ-ONLY Trilho B`, HEAD `92b82afb`, banco vivo dev)
- **Substrato existe mas não foi exercido:** `services`, `bookings`, `service_orders`, `service_discovery_requests`,
  `service_booking_decisions` existem com **0 linhas**. O único dado vivo é `availability` com **32 linhas, todas
  `owner_type='user'`** (agenda pessoal recorrente) — **nenhuma de serviço**. O fluxo comercial de serviço **nunca rodou**.
- **`unified_availability` NÃO existe** (nem tabela nem view) — é só o nome do repo/service; a tabela real é `availability`.
- **Fork de taxonomia:** `company_types.default_*_slugs` aponta categorias **`domain='marketplace'`** mesmo para serviço
  (`salao` → `marketplace-cabelo`/`marketplace-estetica-spa`/`marketplace-barbearia`); existe taxonomia **paralela**
  `domain='servicos'` (16 categorias: `servicos-cabeleireiro`, `servicos-barbearia`, `servicos-manicure`…). **Sem bridge.**
- **Bank atravessa o comercial:** `services-discovery.service.ts:256` (`createSimpleTransaction`),
  `service-order.service.ts:1072` (`bankTransactionService.transfer`) + escrow F1 (`settlement_flow`,
  `buyer_confirmation_deadline_at`, `release_eligible_at`), `service-payment-execution` (bank splits). Criar serviço
  (`POST /services`) é Bank-free; booking/order/payment **não**.
- **Frontend em endpoint-fantasma:** `ServiceAvailabilityPage`/`ServiceBookingsPage` chamam
  `/services/:id/availability` e `/services/:id/bookings` — **inexistentes**. Availability/booking real mora no core
  `/availability` + `/:serviceId/hire`. Não há `CreateServicePage`; `/services/new` não roteado.
- **Sem ponte de empresa/ramo:** `services.actor_id` aceita qualquer actor; `company_id` só aparece *downstream* para
  resolver conta de Bank, **não** para governar elegibilidade (diferente da ponte do Trilho A).

## 6. Problema
Codar Trilho B agora construiria sobre três minas: (a) taxonomia dupla (marketplace × servicos) sem bridge; (b) Bank
acoplado em booking/order/payment, contra a regra "Bank fica fora até decisão explícita"; (c) frontend ligado em
endpoint-fantasma, arriscando SSOT paralelo de availability. E sem governança de empresa/ramo na criação de serviço.

## 7. Decisão (D1–D8)

**D1 — Serviço usa taxonomia `domain='servicos'`.** Quando `services.category_id` classifica o serviço, deve apontar
para a taxonomia de serviço (`domain='servicos'`), **não** marketplace. Categorias `domain='marketplace'` continuam
governando produto/loja/ramo comercial, mas **não** podem ser fingidas como categoria de serviço.

**D2 — Não reusar cegamente a régua da `DECISION-0108` em serviços.** A 0108 governa produto (canonical/products/offers)
por categoria de marketplace. Enquanto não houver **bridge explícita** entre `company_type` e categorias `domain='servicos'`,
a régua de ramo da 0108 **não** se aplica a serviços. (Abre `DT-SERVICE-RAMO-TAXONOMY-FORK`.)

**D3 — `company_type` pode pré-moldar ramo de serviço, mas exige bridge explícita.** A pré-moldagem de serviço deve
apontar para categorias `domain='servicos'`. **Não** usar `default_department_slugs`/`default_branch_slugs` marketplace
como se fossem categorias de serviço (drift atual do `salao`). A bridge é frente própria (read-only primeiro).

**D4 — Criação de serviço + agenda são Bank-free.** As primeiras fatias do Trilho B — criar serviço, vincular ao
actor/empresa, declarar agenda/disponibilidade básica — **não** tocam Bank. **Booking/order/payment/escrow/settlement
ficam bloqueados** até decisão financeira explícita. **Não** tocar `service_orders`, `service_discovery` pay,
`service_payment_execution` nem Bank. (Abre `DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED`.)

**D5 — `availability` (core) é o substrato canônico.** `unified_availability` é nome de service/repo, **não** tabela;
a tabela real é `availability`. O caminho canônico usa o core de availability existente. Endpoints fantasma
`/services/:id/availability` e `/services/:id/bookings` **não** podem criar SSOT paralelo; se mantidos, só como
**adapter fino** para o core real. (Abre `DT-SERVICE-AVAILABILITY-ENDPOINT-DISCONNECT`.)

**D6 — Serviço PJ é governado pelo page-actor/empresa, não por user solto.** Quando o contexto é PJ, o serviço deve
ser do page-actor da empresa. Hoje `services.actor_id` aceita qualquer actor e falta a ponte de empresa/ramo. Antes de
criar serviço PJ em produção, resolver como `companyId`/page-actor entra no fluxo. (Abre `DT-SERVICE-NO-COMPANY-RAMO-BRIDGE`.)

**D7 — Piloto = salão de beleza; restaurante adiado.** Salão é serviço puro (menos mistura com produto físico).
Restaurante mistura produto + serviço + mesa + agenda + potencial pagamento → risco de "hybrid" prematuro; **adiado**.
Peixaria continua fora.

**D8 — Não confiar no frontend só porque a tela existe.** As telas de serviço incluem GHOST (availability/bookings em
endpoints inexistentes); a maturidade é medida pelo substrato e writers, não pela UI roteada.

## 8. O que esta DECISION ratifica
- Lei 7 (CONCEPT = identidade semântica): a taxonomia de serviço é eixo próprio; serviço ≠ produto físico.
- A disciplina da `norma_assintotica`: o drift `marketplace-*` em `company_type.default_*_slugs` para serviço é dívida
  classificada (DT), não destino — converge para a bridge `domain='servicos'`.
- `DECISION-0108` permanece restrita a **produto**; não é estendida a serviço sem bridge (D2).
- A regra "Bank fica fora até decisão explícita" (cerca corta-fogo do cofre).

## 9. O que NÃO está autorizado (fica proibido por enquanto)
- Implementar booking/order/payment; tocar Bank.
- Usar restaurante como piloto.
- Criar endpoint paralelo de availability como nova verdade (SSOT paralelo).
- Usar taxonomia marketplace como categoria de serviço.
- Criar serviço sem governança de empresa/ramo.
- Criar pagamento fake ou booking fake.
- Abrir Op3A antes da próxima frente (ver §11).

## 10. DTs abertas por esta DECISION (todas OPEN)
- **`DT-SERVICE-RAMO-TAXONOMY-FORK`** — `marketplace-*` (company_type pré-moldagem) × `servicos-*` (substrato) paralelos,
  sem bridge; resolução = bridge explícita `company_type → domain='servicos'`.
- **`DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED`** — booking/order/payment já chamam Bank; cercar antes de Op3 comercial.
- **`DT-SERVICE-AVAILABILITY-ENDPOINT-DISCONNECT`** — frontend chama `/services/:id/availability|bookings` inexistentes;
  real mora no core `availability`; reconciliar (adapter fino), não criar SSOT paralelo.
- **`DT-SERVICE-NO-COMPANY-RAMO-BRIDGE`** — criação de serviço sem governança de empresa/ramo (diferente do Trilho A).

## 11. Sequência autorizável (sem execução nesta DECISION)
1. **Esta DECISION** (docs-only).
2. **`F-SERVICE-TAXONOMY-BRIDGE-READONLY`** (read-only) — desenhar a bridge `company_type` salão → categorias
   `domain='servicos'`; decidir como `companyId`/page-actor entra na criação do serviço. **OU**, se a DECISION já bastar,
   **`F-SERVICE-SALON-BANK-FREE-MVP-DESIGN`** (desenho).
3. Caminho **Bank-free**: serviço + availability (salão). **Booking/payment ficam para depois** (decisão financeira própria).
**Critério:** nenhuma fatia comercial/booking/Bank antes das DTs serem endereçadas e da palavra de Clayton.

## 12. Referências normativas
`18_DOMAIN_ONTOLOGY` (taxonomia/domínio) · `DECISION-0108` (governança de produto — restrita a produto) ·
`DECISION-0105` (camadas de `concepts.domain`) · Lei 7 (CONCEPT=SSOT) · regra "Bank fica fora até decisão explícita" ·
`project_norma_assintotica` (drift = DT com convergência).

## 13. Referências de estado/evidência (raio-x read-only, HEAD `92b82afb`, dev)
`availability` 32 linhas (todas `owner_type='user'`); `services`/`bookings`/`service_orders`/`service_discovery_requests`/
`service_booking_decisions` = 0 linhas; `unified_availability` inexistente; categorias `domain`: 16 `servicos` / 15
`marketplace` / 116 null; `salao` default slugs = `marketplace-*` (drift); Bank em `services-discovery.service.ts:256`,
`service-order.service.ts:1072`, `service-payment-execution`; writers `services.repository:137`,
`unified-availability.repository:117/310`; endpoints `services.routes` sem `/availability`|`/bookings` (frontend chama fantasma).
