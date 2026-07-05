# IA-10 — Marketplace/Jornada

> RAIO X READ-FIRST do eixo Marketplace/Jornada do Unificard. Auditoria macro+micro
> orquestrada por 11 leitores read-only paralelos + 2 verificadores adversariais.
> Nenhum código, migration, norma, cartório ou runtime foi alterado.

---

## 1. Carimbo

* **HEAD:** `aaeb50b5182120888a72418775a9d211e33bff4d`
* **Branch:** `rescue-structural`
* **Data/hora:** 2026-06-21
* **Git status:** working tree com modificações pré-existentes em `docs/memorias/MINHA_MEMORIA_*` e arquivos `??` na raiz (BASE.png, planos, outputs) — **nenhuma** tocada por esta auditoria.
* **READ-ONLY confirmado:** SIM. Leitores só leram/grep/probes SELECT (colunas explícitas, sem `SELECT *`). Verificadores adversariais não mutaram nada. DB não foi alterado.
* **Arquivo criado/atualizado:** `docs/memorias/IA-10-MARKETPLACE-JORNADA.md` (este, único permitido).
* **Frontend/backend/schema consultado:** `frontend/src/{pages,components,api,services}`, `backend/src/modules/{services,marketplace,subscriptions,concept-resolution,catalog}`, `backend/src/core/{categories,home-feed,availability,navigation}`, `backend/migrations*`, `docs/02_decisions`, `docs/orquestracao`.
* **Comandos/probes usados:** `git rev-parse/status`; `rg` sobre marketplace/discover/by-canonical/concept/offering/draft/active/kyb/checkout; leitura direta de rotas/serviços/DTOs; probes read-only contra `unificard_dev` (PostgreSQL 17.5 @ localhost:5432).
* **Orquestração:** 13 agentes (11 leitores + 2 verificadores), ~1.11M tokens, 589 tool-uses.

---

## 2. Escopo

**Auditado (dentro do eixo):** home/entrada do marketplace; busca/discovery (frontend e backend); contrato category↔concept; cards/resultados; service vs service_offering; ponte by-canonical/canonicalServiceId; jornada de serviço discover→offering→availability→booking; produtos (superficial); locações (superficial); assinaturas (superficial); empresa/provider no marketplace; visibilidade pública/ativação; contrato de API/DTO; ranking/ordenação; presença de dinheiro no eixo.

**Fora (registrado como handoff):** cadastro/auth, perfil/SSOT, actor model completo, autoridade global, empresa/PJ completa, semântica global completa, oferta além do marketplace, tempo/booking completo, estoque detalhado, locação detalhada, assinatura detalhada, dinheiro/ledger/split/payout, logística/presença, schema geral.

---

## 3. Mapa macro do marketplace

```
ENTRADA (anon ou logado)
  → /marketplace [PÚBLICO]                                          FECHA
    → MarketplaceHomePage (seletor de domínio)                      FECHA
      → /marketplace/{domain} (categorias navegáveis)               FECHA
        → category → concept (hop efêmero, 403 se non-leaf)         FECHA
          → resultado/card                                          FECHA_COM_RISCO

DESCOBERTA DE SERVIÇO (logado — /discover/services é ProtectedRoute)
  → busca/filtros (categoryId, city, datas, hasAvailability)        FECHA_COM_RISCO
    → GET /services/search|discover (concept_id, active-only)       FECHA  (backend)
      → service card (serviceId apenas)                             FECHA_COM_RISCO
        → SELEÇÃO DE OFFERING                                       NÃO_FECHA  ◄── B2
          → by-canonical (active-only, draft oculto)                FECHA  (backend, não chamado pelo front)
            → offering active                                       FECHA  (backend)
              → availability (owner=service_offering)               FECHA  (backend)
                → booking requested → confirm (409 conflito provider) FECHA (backend, e2e)
                  → handoff checkout/dinheiro (pós-booking)         DINHEIRO_FORA / HOLD

OUTRAS VERTICAIS NO MARKETPLACE
  produto    → canonical-search + store endpoints                  FECHA_COM_RISCO
  locação    → STUB (sem card, sem availability período)           NÃO_FECHA
  assinatura → tabela ausente no runtime, rota comentada (fantasma) NÃO_FECHA
  provider   → card com gate KYB + publicação ativa                 FECHA
```

**Leitura macro:** a **cadeia causal de serviço está fechada e provada no backend** (Caminho B1, e2e 9/9 PASS). O **único elo quebrado da jornada tangível de serviço é o wiring de frontend (B2)**: a UI não expõe `canonicalServiceId`, não chama `by-canonical` e não tem seletor de offering. Produto é coerente mas sem indicador de status na resposta pública; locação e assinatura são stub/fantasma.

---

## 4. Matriz do eixo

| item | fecha/não-fecha | evidência viva | blocker | risco | próxima frente | modo |
|---|---|---|---|---|---|---|
| home/marketplace | FECHA | `MarketplaceHomePage.tsx`; rota pública `App.tsx:201` | — | baixo | — | FAST-PATH |
| search frontend | FECHA_COM_RISCO | `ServiceDiscoveryPage.tsx`; `/discover/services` é ProtectedRoute; busca fragmentada em 2 páginas | login exigido p/ discover de serviço | médio | consolidar busca pública | MODO B |
| search backend | FECHA | `services.repository.ts:201` (`status='active'`); 3 endpoints mapeados | — | baixo | — | FAST-PATH |
| marketplace service | FECHA | `marketplace-search.service.ts`; ranking 5-fatores determinístico | — | baixo | re-key tree p/ concept (V2) | MODO B |
| category tree | FECHA | `0061_categories.sql`; level/parent_id/path | — | baixo | — | FAST-PATH |
| category.concept_id | FECHA_COM_RISCO | 77/147 categorias com concept_id; **70 órfãs** (fixtures legacy) | — | médio | reconciliar 70 órfãs | MODO B |
| category.metadata | FECHA | `product-visibility.service.ts:77-150` **não** seleciona metadata p/ matching (correto: admin-only) | — | baixo | documentar contrato admin-only | FAST-PATH |
| concept matching | FECHA | `services.service.ts:312-322` hop category→concept, 403 se non-leaf (DECISION-0142) | — | baixo | — | FAST-PATH |
| service card | FECHA_COM_RISCO | `ServiceDiscoveryPage.tsx:220-260` renderiza serviceId; sem filtro draft no front | backend cobre | médio | — | DECISION |
| **offering selection** | **NÃO_FECHA** | zero `ServiceOfferingSelector` no marketplace; front não chama by-canonical | **B2 frontend** | **alto** | **B2 wiring** | **MODO B** |
| canonicalServiceId | NÃO_FECHA (front) / FECHA (back) | `service-discovery.ts:25-63` exclui o campo; backend o possui | **B2 frontend** | alto | B2 wiring | MODO B |
| by-canonical | FECHA | `service-offering.service.ts:222-230` `WHERE status='active'`; e2e exclui OFF_DRAFT | — | baixo | — | FAST-PATH |
| active-only | FECHA | repo + by-canonical + `CS_VISIBLE`; e2e linha 83 | — | baixo | — | FAST-PATH |
| draft oculto | FECHA | `service-offering.service.ts:144` nasce draft; filtrado em todas leituras públicas | — | baixo | — | FAST-PATH |
| provider/company card | FECHA | `product-visibility.service.ts:140-149` gate KYB+publicação ativa | — | baixo | — | FAST-PATH |
| product card | FECHA_COM_RISCO | `marketplace-public.routes.ts:220` resposta pública sem campo status do offer | — | médio | indicador status no DTO | DECISION |
| rental card | NÃO_FECHA | `module-registry.ts:51` status=`STUB`; sem card, sem availability período | — | baixo (contido) | desenho locação | HANDOFF |
| subscription card | NÃO_FECHA | tabela ausente em runtime; `App.tsx:319` rota comentada; módulo fantasma | — | baixo (contido) | aplicar migration + decisão modelo | DECISION |
| availability handoff | FECHA | unified-availability owner_type=`service_offering` | — | baixo | F-OFFER-5 owner ambig. (0×0 rows) | FAST-PATH |
| booking handoff | FECHA | e2e 409 `BOOKING_PROVIDER_TIME_CONFLICT` (DECISION-0146) | — | baixo | — | FAST-PATH |
| **dinheiro fora** | **FECHA** | discovery zero imports bank/payment/wallet; pagamento é intent declarativo pós-booking | — | baixo | — | FAST-PATH |
| ranking/ordenação | FECHA | 5 fatores hard-coded (availability→compat→trust→capacity→createdAt), sem ML, sem domain | — | baixo | — | FAST-PATH |
| endpoints stale | FECHA_COM_RISCO | busca front fragmentada; marketplace-tree re-key por concept é V2 | — | médio | re-key V2 | MODO B |
| testes existentes | FECHA | `e2e-offer-journey-pre-money.ts` 9/9 PASS (Caminho B1, commit `3cee7d1c`) | — | baixo | — | FAST-PATH |

---

## 5. Achados críticos

### B2 / Jornada de serviço (frontend)

**MARKET-002 — Sem seletor de offering no frontend** · MTP=true · PUB=false · MONEY=false · DECISION
Não existe `ServiceOfferingSelector` no fluxo de marketplace; o card de serviço carrega apenas `serviceId` e navega para detalhe.
Evidência: `frontend/src/pages/ServiceDiscoveryPage.tsx:220-260`; zero matches `ServiceOfferingSelector` nos componentes de marketplace.
Impacto: a jornada tangível de serviço (escolher uma offering contratável) **não existe na UI**, embora exista e esteja provada no backend. Este é o **B2**.

**MARKET-003 / OFFER-MARKET-8 — `canonicalServiceId` não exposto ao frontend** · MTP=true · DECISION
A interface `DiscoveredService` (`frontend/src/api/service-discovery.ts:25-63`) **não inclui** `canonicalServiceId`; o frontend nunca chama `GET /services/offerings/by-canonical/:canonicalServiceId` (rota backend existe e é active-only).
Impacto: a ponte canônica service→offering está rompida no transporte frontend. Sem o `canonicalServiceId` viajando, a UI não consegue listar offerings active.

**MARKET-008 — Status de serviço não validado p/ contratabilidade no front** · MTP=true · PUB=true · DECISION
O campo `status` chega ao frontend mas não há filtro client-side. **Mitigado** pelo backend (`services.repository.ts:201` força `status='active'`), portanto **não vaza draft** — o risco é apresentação, não material.

### Semântica / Categoria

**CATEGORY-006 — Leaf vs non-leaf sem constraint SQL (inferência runtime)** · DECISION
`collectLeafCategories` filtra em runtime (`categories.service.ts:1113-1127`); não há CHECK em `0061_categories.sql`. Schema permite `concept_id` em non-leaf. Material mitigado: discovery rejeita non-leaf com 403 `CATEGORY_REQUIRES_LEAF_CONCEPT`.

**CATEGORY-007 — Resolução de slug exige domain (estado V1)** · DECISION
`concept-slug-resolve.service.ts:32-87` requer `domain` para resolver slug→concept. Não viola identidade material (matching final é por `concept_id`), mas mantém acoplamento de navegação a domain na borda de resolução. V1 aceitável.

**SCHEMA — 70 categorias órfãs (sem concept_id)** · FECHA_COM_RISCO
77/147 categorias linkadas a concept_id; 70 órfãs (fixtures bootstrap legacy). Não bloqueia (discovery só resolve folhas com concept), mas é dívida de reconciliação semântica.

### Produto

**PRODUCT-MARKET-7/9 — Resposta pública de store-product sem status do offer** · PUB=true · DECISION
`store-product.service.ts:35-55` retorna `isEnabled` a partir de `store_product_activations.status='active'` **sem** join a `product_offers`. `marketplace-public.routes.ts:220` devolve produtos sem campo `status`. Frontend não distingue active vs draft. Risco de apresentação; a visibilidade canônica (`product-visibility.service.ts:105`) **sim** força `po.status='active'`.

**PRODUCT-MARKET-10 — Validação de status no add-to-cart INCONCLUSIVE** · MTP=true · MONEY=true · DECISION
`POST /order/:orderId/items` (`marketplace-public.routes.ts:262-285`) aceita `productId` sem checagem de status visível; o gate de pagamento está em `POST /checkout/:checkoutId/confirm`. Implementação de `addOrderItem` não totalmente rastreada → handoff IA-PRODUTOS-CHECKOUT.

### Locação / Assinatura (contidos)

**RENTAL-MARKET-03/05/06/07 — Locação é STUB** · contido
`module-registry.ts:51` status=`STUB` (filtrado da navegação viva). `AvailabilityOwnerType` não tem `RENTAL_RESOURCE`; reserva é stock-based, não período-based. Sem card no marketplace. Não bloqueia eixo. Handoff IA-LOCACOES-RECURSOS.

**SUB-MARKET-01/03/09 — Assinatura é módulo fantasma** · contido
Tabela `subscriptions` **não existe** no runtime (`migrations_archive/0194_subscriptions.sql` não aplicada); rota frontend comentada (`App.tsx:319`); rotas backend implementadas mas sem proteção contra tabela ausente; rotas públicas de marketplace são TODO stub. Dois modelos concorrentes (core payment-link-driven vs marketplace catalog-driven in-memory). Handoff IA-ASSINATURAS-RECORRENCIA.

### Visibilidade / Autoridade (saudável)

**PUBLIC-MARKET-02/03 + MARKET-11 — Gates de visibilidade enforced** · FECHA
KYB-approved + publicação ativa exigidos p/ merchant PJ (`product-visibility.service.ts:140-149`; `company-publications.service.ts:186-188`). `actorId`/`provider_actor_id` são **hint**, nunca autoridade; `canRepresentActor` exigido em todas as escritas (DECISION-0113).

**OFFER-MARKET-03 — `canRepresentActor` não enforced em LEITURAS de discovery** · PUB=true · DECISION
`services-discovery.routes.ts:156-192` exige `ActionContext` mas não `canRepresentActor` nas leituras (por design — discovery é leitura). Escritas (`:81-93`) gateiam corretamente. Decisão de arquitetura: leitura por actor é metadata-hint ou exige representação?

### Dinheiro (contido — verificado adversarialmente)

**OFFER-MARKET-10 / MONEY-MARKET — Dinheiro fora do eixo** · FECHA (CONFIRMED)
Discovery/search/offering: **zero imports** de bank/payment/wallet/ledger/split/payout. Pagamento ocorre **após** booking, via intent declarativo (`CheckoutIntent` status `pending`, `PaymentPlan` status `calculated`) — escafold calculacional sem movimentação de fundos. `POST /services/request/pay` retirado (403, DECISION-0110 D2). Rotas de AP/AR/settlement do módulo `marketplace` são superfície separada e desabilitada, alcançada só pós-booking.

---

## 6. Gaps de conexão

1. **Backend↔Frontend (B2):** `canonicalServiceId` existe no backend mas é dropado no DTO do frontend → ponte by-canonical inalcançável pela UI. **Gap #1, maior do eixo.**
2. **Frontend↔Offering:** sem componente de seleção de offering; jornada para na tela de detalhe de serviço.
3. **Produto↔Status:** resposta pública de store-product omite status do offer → front não distingue contratável de draft (mitigado materialmente pelo backend).
4. **Marketplace-tree↔Concept:** árvore ainda navega por category tree; re-key por concept_id é V2 (`marketplace-search.service.ts:39-50`).
5. **Semântica↔Categoria:** 70 categorias sem concept_id (legacy).
6. **Assinatura↔Runtime:** UI/rotas backend existem mas tabela ausente — desconexão schema↔código.
7. **Locação↔Availability:** modelo de availability não tem owner type de recurso alugável.
8. **Busca↔Público:** `/discover/services` é protegido; descoberta pública de serviço (sem login) não consolidada.

---

## 7. Handoffs para outras IAs

* **IA-CADASTRO-ONBOARDING:** —
* **IA-PERFIL-SSOT:** —
* **IA-ACTOR:** —
* **IA-AUTORIDADE:** auditar leituras actor-scoped de discovery (`services-discovery.routes.ts:75-92` hook `assertActorRepresentable`); confirmar `canRepresentActor` antes de todas as escritas de store-onboarding; corner case `COALESCE(inv.stock_qty, po.available_quantity)` NULL→0.
* **IA-EMPRESA-PJ:** confirmar que `company_concept_publications` não tem status `draft` (só active/retired); **verificar listagem pública de service_offerings** (assumida igual a produtos mas NÃO auditada diretamente — INCONCLUSIVE); escopo de visibilidade canonical global vs scoped.
* **IA-SEMANTICA:** reconciliar 70 categorias órfãs (linkar a concepts existentes ou depreciar); decidir constraint leaf-only de concept_id (CATEGORY-006); auditar domain-scoping de slug (CATEGORY-007).
* **IA-OFERTA:** F-OFFER-5 (availability owner ambiguity service vs service_offering, 0×0 rows hoje, V2); pendência cartorial DT-A1-CARTORIO-0119-0120 + DT-DRIFT1-RLS-HARDENING (carry-over `REMEDIATION_DT_LOG.md`).
* **IA-TEMPO:** confirmar cadeia booking→offering→availability quando houver inventário vivo (services/offerings hoje = 0 rows).
* **IA-FRONTEND-UX-CONTRATOS:** **B2** — implementar seletor de offering consumindo by-canonical; expor `canonicalServiceId` no DTO; wire booking request UI; consolidar busca pública.
* **IA-PRODUTOS-ESTOQUE:** validar `store_product.listByStore()` filtra tenant_id; status de activation sozinho é insuficiente como gate.
* **IA-PRODUTOS-CHECKOUT:** verificar `addOrderItem()` valida `offer.status='active'` antes do carrinho (PRODUCT-MARKET-10).
* **IA-LOCACOES-RECURSOS:** desenho completo de locação — owner type de availability p/ recurso, reserva período-based (check-in/out), caução.
* **IA-ASSINATURAS-RECORRENCIA:** aplicar `0194_subscriptions.sql`; decidir merge modelo core (payment-link) vs marketplace (catálogo); validar ciclos/backoff.
* **IA-BANCO:** rastrear `canonical_service_id`→service_order p/ payment (service_orders = 0 rows).
* **IA-DINHEIRO:** quando payment plan passar de `calculated`→`executed`, verificar ledger/split/payout.
* **IA-DECISOES-DT:** DT-MODULE-SUBSCRIPTIONS-FANTASMA; decisão sobre leitura actor-scoped em discovery.

---

## 8. Riscos para MTP

* **Bloqueia MTP:** **B2 frontend wiring** (MARKET-002/003, OFFER-MARKET-8) — sem seletor de offering + `canonicalServiceId`, a jornada tangível de serviço não chega a um item contratável na UI. Backend está pronto; falta o transporte/UI.
* **Não bloqueia, mas corrigir:** indicador de status no DTO de produto público (PRODUCT-MARKET-7/9); validação de status no add-to-cart (PRODUCT-MARKET-10).
* **V2 (não-MTP):** re-key de marketplace-tree por concept_id; `/services/discover` sem-category; F-OFFER-5 owner ambiguity.
* **Cleanup:** reconciliar 70 categorias órfãs; busca pública consolidada.
* **Exige decisão de produto/arquitetura:** modelo de assinatura (2 modelos concorrentes); desenho de locação; leitura actor-scoped em discovery.

---

## 9. Riscos para público e dinheiro

**Antes de público:**
* B2 wiring (offering selection) — sem ele a jornada tangível não fecha na UI.
* Indicador de status de produto na resposta pública (apresentação).
* Módulo de assinatura fantasma (rota comentada está correta, mas remove a vertical do público).
* **Caminho A (ativação segura) segue HOLD** antes de público/dinheiro — confirmado pelo cartório.

**Antes de dinheiro:**
* Validação de `offer.status` no add-to-cart/checkout (PRODUCT-MARKET-10).
* Cadeia payment plan `calculated`→`executed` não auditada (fora do eixo).

**Blockers de marketplace:** B2 frontend.
**Blockers de semântica:** 70 órfãs (baixo); constraint leaf-only (decisão).
**Blockers de frontend:** offering selector, canonicalServiceId, busca pública.
**Exigem DECISION:** modelo assinatura; leitura actor-scoped; status de produto no DTO.
**Permanece HOLD:** dinheiro (intencionalmente fora); Caminho A ativação; locação; assinatura.

---

## 10. Veredito final

### **FECHA_COM_RISCO**

A **espinha dorsal causal do eixo está fechada e provada**: SEMÂNTICA (concept_id soberano, DECISION-0142 enforced) → IDENTIDADE → AUTORIDADE (actorId hint, canRepresentActor) → TEMPO (availability owner=service_offering, 409 conflito) → ESTADO (draft oculto, active-only) → FINANCEIRO (contido, pós-booking) → EVENTO. O Caminho B1 (e2e 9/9 PASS) prova a cadeia discover→canonical→by-canonical(active-only)→offering→availability→booking→confirm→conflito pré-money. Os dois verificadores adversariais **CONFIRMARAM** as duas teses de maior risco: (a) dinheiro está fora do eixo de discovery/jornada; (b) draft não vaza como contratável público.

O **risco** que impede o "FECHA" pleno:
1. **B2 frontend wiring ausente** — a jornada tangível de serviço não existe na UI (sem seletor de offering, `canonicalServiceId` dropado). Backend pronto, frontend não.
2. **Verticais incompletas** — produto sem indicador de status público; locação STUB; assinatura fantasma (tabela ausente).
3. **Realidade de dados** — runtime hoje tem `services=0`, `service_offerings=0`, `company_concept_publications=0`: a cadeia é provada por fixtures/e2e, mas **não há inventário vivo populado**. O eixo é estruturalmente são, porém vazio.

Nada disso é violação de invariante canônico — são lacunas de wiring e de população, não drift material.

---

## 11. Próxima frente recomendada

### **MODO_B_B2_FRONTEND_WIRING** — MODO B

**Justificativa:** o backend da jornada de serviço está fechado, provado e selado (F-OFFER-0→6, DECISION-0142/0144/0145/0146, Caminho B1). O único elo que falta para uma jornada tangível ponta-a-ponta é o transporte/UI:
1. expor `canonicalServiceId` no DTO `DiscoveredService`;
2. chamar `GET /services/offerings/by-canonical/:canonicalServiceId` no detalhe do serviço;
3. componente de seleção de offering (active-only já garantido pelo backend);
4. UI de declaração de availability → booking request consumindo `availabilityId`.

É a frente de **maior alavancagem** (destrava a vertical de serviço para público) e de **menor risco** (backend não muda, invariantes já enforced, money fora). Não exige DECISION nova — exige execução de wiring com contratos já existentes.

Frentes seguintes (não-MTP): MODO_B_MARKETPLACE_REKEY_CONCEPT (V2), DECISION sobre modelo de assinatura, HANDOFF_LOCACOES, reconciliação semântica das 70 órfãs.

---

## 12. Resumo executivo

* **Cadeia causal de serviço FECHADA e provada no backend** — Caminho B1 e2e 9/9 PASS; DECISION-0142/0144/0145/0146 enforced em código vivo + guards.
* **concept_id é identidade material soberana** — discovery casa por concept_id, category/domain são navegação (hop efêmero, 403 se non-leaf). Invariante respeitado.
* **Draft NÃO vaza** (verificado adversarialmente, CONFIRMED) — `status='active'` no repo + by-canonical active-only + gate KYB/publicação; offering nasce draft.
* **Dinheiro está FORA do eixo** (verificado adversarialmente, CONFIRMED) — discovery zero imports financeiros; pagamento é intent declarativo pós-booking; `request/pay` retirado (403).
* **B2 frontend é o único blocker de MTP** — UI não expõe `canonicalServiceId`, não chama by-canonical, não tem seletor de offering. Backend pronto, transporte ausente.
* **Produto: coerente com risco** — aparece via canonical-search + store endpoints, mas resposta pública omite status do offer; add-to-cart sem validação rastreada.
* **Locação = STUB; Assinatura = módulo fantasma** (tabela ausente no runtime, rota comentada) — ambos contidos, não bloqueiam, viram frentes próprias.
* **Provider/empresa saudável** — gate KYB+publicação ativa; actorId é hint, canRepresentActor enforced nas escritas (DECISION-0113).
* **Realidade de dados:** runtime com services=0/offerings=0/publications=0; 70 categorias órfãs sem concept_id (legacy). Estrutura sã, inventário vazio.
* **Veredito: FECHA_COM_RISCO. Próxima frente: MODO_B_B2_FRONTEND_WIRING.**
