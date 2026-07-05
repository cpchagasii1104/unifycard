# IA-09 — Frontend/API Contract

> RAIO X READ-FIRST do eixo Frontend/API Contract do Unificard. Auditoria macro+micro
> orquestrada por 9 leitores read-only paralelos (1 por sub-eixo), com infra de API
> pré-validada manualmente. Nenhum código, migration, norma, cartório ou runtime foi
> alterado. Único arquivo escrito: este.

---

## 1. Carimbo

* **HEAD:** `aaeb50b5182120888a72418775a9d211e33bff4d`
* **Branch:** `rescue-structural`
* **Data/hora:** 2026-06-21
* **Git status:** working tree com modificações pré-existentes em `docs/memorias/MINHA_MEMORIA_*`, `opus.md` e arquivos `??` na raiz (BASE.png, planos, outputs, relatórios IA-02/06/10/11/12) — **nenhuma** tocada por esta auditoria.
* **READ-ONLY confirmado:** SIM. Leitores só usaram Read/Grep/Glob e Bash read-only (git/rg/ls). Nenhuma escrita em código/backend/migration/runtime. DB não foi consultado por escrita (eixo é frontend).
* **Arquivo criado/atualizado:** `docs/memorias/IA-09-FRONTEND-API-CONTRACT.md` (este, único permitido).
* **Frontend/backend consultado:** `frontend/src/{api,pages,components,contexts,hooks,services,types,utils}` (570 arquivos ts/tsx). Backend NÃO foi lido (escopo frontend/contrato); afirmações sobre comportamento server-side baseiam-se em comentários vivos do frontend e nos invariantes do sistema → marcadas como handoff.
* **Comandos/probes usados:** `git rev-parse/status`; `rg` sobre canonicalServiceId/by-canonical/concept_id/offering/draft/active/booking/BOOKING_PROVIDER_TIME_CONFLICT/TODO/FIXME/mock/placeholder/console.log/alert/debounce/payment/escrow/payout; leitura direta de client.ts, App.tsx, Register.tsx, Profile*, Company*, Service*, Marketplace*, Availability*, Booking*, PDV/Subscriptions/Venue, headers e cards.
* **Orquestração:** 9 leitores read-only paralelos, ~796k tokens, 204 tool-uses, ~3min.

---

## 2. Escopo

**Auditado (dentro do eixo):** infra de API frontend (apiFetch/apiFetchPublic/client.ts, auth/tenant/actor headers, tratamento de erro, casing, env, retry/debounce); auth/cadastro/onboarding (Register/Login/ProtectedRoute/OnboardingWrapper, payload register, roteamento pós-cadastro); perfil/SSOT/abas; empresa/PJ frontend (criação, KYB, membros, organization); oferta service/service_offering (authoring, draft/active, selector); marketplace/discovery (busca, cards, category↔concept, canonicalServiceId); agenda/availability + booking (unified vs legado, requested/confirm, 409); produtos/locações/assinaturas (superficial); dinheiro frontend (classificação); UX/placebo/endpoints legados/stale.

**Fora (registrado como handoff):** backend de auth/perfil/empresa/oferta/tempo; persistência real e contrato server-side; schema/migrations; dinheiro/ledger/split/payout em profundidade (HOLD); semântica global; actor model completo; autoridade global.

---

## 3. Mapa macro do frontend

```
cadastro → perfil → empresa → oferta → marketplace → offering → availability → booking → conflito

cadastro (Register → /auth/register, civis completos, server-driven routing)        FECHA
  → perfil (/perfil, PerfilPage, 8 abas reais, lock civil = projeção)               FECHA
    → empresa/PJ (createCompany + CNPJ, KYB projetado, backoffice admin vivo)        FECHA
      → oferta de SERVICE
         · visualizar service (lista/detalhe/discover)                              FECHA
         · CRIAR service (botão → /services/new INEXISTENTE; createService órfã)     NÃO_FECHA ◄── OFFER
         · publicar/ativar service (sem botão; updateService nunca chamado)         NÃO_FECHA
      → oferta de SERVICE_OFFERING
         · CRUD/visualização de offering (só API marketplace morta, 0 consumidores) NÃO_FECHA ◄── OFFER
         · ServiceOfferingSelector / api/offerings.ts                               AUSENTE  ◄── B2
      → marketplace/discovery
         · vitrine (Home→Domain→Segment→CategoryNav)                                 NÃO_FECHA (Segment=[], CategoryNav "em breve")
         · busca global /search                                                     NÃO_FECHA (stub puro)
         · busca header (MarketplaceHeader/SimpleHeader)                            NÃO_FECHA (onSubmit no-op, placebo)
         · searchMarketplace chamado em CategoryNav                                 NÃO_FECHA (resultado nunca renderizado)
         · card de service (ServiceDiscoveryPage → serviceId)                       FECHA_COM_RISCO (sem canonicalServiceId/concept_id)
         · marketplace → offering contratável                                       NÃO_FECHA
      → availability
         · declaração própria (ProfileAgenda, unified, weekly-template)             FECHA  (referência canônica)
         · ver availability de OFFERING (cliente)                                   NÃO_FECHA (só service legado / self-actor)
      → booking
         · criar booking REQUESTED                                                  FECHA_COM_RISCO (via legado /services/:id/bookings)
         · confirmar booking                                                        FECHA_COM_RISCO (só via /service-orders/confirm-booking)
         · lifecycle unified createBooking/confirmBooking                           dead-code (0 consumidores)
      → conflito
         · feedback 409 BOOKING_PROVIDER_TIME_CONFLICT                              NÃO_FECHA (ZERO tratamento; só toast genérico)

VERTICAIS ADJACENTES
  produtos (PDV/Marketplace/Inventory/Orders)                                       FECHA_COM_RISCO (unidade preço mista)
  locações/rental                                                                   NÃO_FECHA (só enum + label "Aluguel")
  assinaturas (SubscriptionsPage, recorrência real)                                 FECHA (toca dinheiro → HOLD)
  dinheiro (checkout/bank/payout/ledger/escrow/payments)                            DINHEIRO_CHAMADO (HOLD por diretiva)
```

**Leitura macro:** a **fundação está fechada e disciplinada** — cadastro com dados civis completos, roteamento pós-cadastro server-driven, perfil com 8 abas reais e lock civil como projeção, empresa/PJ criando de verdade com KYB soberano, e declaração de agenda canônica (unified availability) exemplar. **O eixo quebra exatamente no arco oferta→marketplace→booking visível na tela** (o "B2"): não há authoring de service pela UI (botão aponta para rota inexistente), não há entidade/CRUD de offering, ZERO uso de `canonicalServiceId`/`concept_id`/`by-canonical`, a vitrine não chega a nada contratável, o feedback de conflito 409 não existe, e há placebos que fingem sucesso (`ServicePostCard` emite "Serviço agendado com sucesso!" sem booking). **Dinheiro está limpo no fluxo pré-dinheiro B1 (ZERO chamadas financeiras)** — confirmado.

---

## 4. Matriz do eixo

| item | fecha/não-fecha | evidência viva | blocker | risco | próxima frente | modo |
|---|---|---|---|---|---|---|
| apiFetch/apiFetchPublic | FECHA | client.ts:153/171; deleta x-actor-id (186-187) | — | BAIXO | — | FAST-PATH |
| actorId/companyId como hint (não autoridade) | FECHA | client.ts:269-276; companies.ts:315-317; bank.ts:57-61 | — | BAIXO | — | FAST-PATH |
| tratamento 401 (crítico/não-crítico+bootstrap) | FECHA_COM_RISCO | client.ts:57-86, 383-442 | string-match por path/mensagem | MÉDIO | classificar por error.code | MODO B |
| tratamento 400/403/409/429/500 | FECHA_COM_RISCO | client.ts:444 throw genérico; 453-462 omite 409/429 | sem ramo 409; 429 sem backoff | MÉDIO | ramo 409 + backoff 429 | MODO B |
| casing body camelCase vs snake_case | FECHA_COM_RISCO | checkout.ts:46 snake; agreements.ts:117 camel | sem mapper de borda | BAIXO | — | MODO B |
| debounce/rate-limit no client | NÃO_FECHA | 0 ocorrências; useRetryWithBackoff só BACKEND_OFFLINE | sem proteção a storm | MÉDIO | debounce em busca | MODO B |
| endpoints via env | FECHA | client.ts:5 VITE_API_BASE_URL | — | BAIXO | — | FAST-PATH |
| cadastro/register (civis+referral) | FECHA | auth.ts:53-69; Register.tsx:245-253 | — | persistência backend (handoff) | IA-CADASTRO | FAST-PATH |
| login/session | FECHA | ProtectedRoute.tsx:20; setAuthToken/setTenantId | — | BAIXO | — | FAST-PATH |
| /perfil (rota + sem dead-end) | FECHA | App.tsx:288; Register seta token+tenant | — | BAIXO | — | FAST-PATH |
| perfil abas (8 reais) | FECHA_COM_RISCO | Profile.tsx:45,1234-1348 | physical PUT não checa response.ok (physical.ts:54) | MÉDIO | IA-PERFIL-SSOT | MODO B |
| empresa/PJ frontend | FECHA | companies.ts:189; CompaniesManager.tsx:330 | — | org_* congelada (código morto) | IA-EMPRESA-PJ | FAST-PATH |
| service frontend (visualizar) | FECHA | ServicesListPage.tsx:41; ServiceDetailPage.tsx:31 | — | BAIXO | — | FAST-PATH |
| service frontend (criar/editar) | NÃO_FECHA | ServicesListPage.tsx:102 → /services/new inexistente; createService órfã | sem tela/rota de authoring | ALTO | IA-OFERTA | MODO B |
| service_offering frontend | NÃO_FECHA | marketplace.ts:394/448/3220 sem consumidores | sem superfície UI; API morta | ALTO | IA-OFERTA | DECISION |
| activation/publicar frontend | NÃO_FECHA | updateService({status}) nunca chamado | sem ação de ciclo de vida | MÉDIO | IA-OFERTA | MODO B |
| marketplace search | NÃO_FECHA | SearchPage.tsx:19 stub; headers onSubmit no-op; CategoryNav resultado órfão | busca não liga ao backend | ALTO | IA-MARKETPLACE | MODO B |
| canonicalServiceId no frontend | NÃO_FECHA | grep = ZERO; card carrega serviceId | semântica canônica não transportada | ALTO | IA-SEMANTICA | DECISION |
| by-canonical no frontend | NÃO_FECHA | grep = ZERO | rota canônica não chamada | ALTO | IA-OFERTA/SEMANTICA | DECISION |
| ServiceOfferingSelector | NÃO_FECHA | AUSENTE; ServiceSetupSelector lê metadata.setups | sem seletor de offering | ALTO | IA-OFERTA | MODO C |
| offering→availability frontend | NÃO_FECHA | só listServiceAvailabilities(serviceId) legado | sem leitura por offering | ALTO | IA-OFERTA+TEMPO | INCONCLUSIVE |
| booking requested frontend | FECHA_COM_RISCO | EventServiceBookingRequestModal.tsx:160 (legado) | usa /services/:id/bookings, não unified | MÉDIO | IA-TEMPO | MODO B |
| confirm booking frontend | FECHA_COM_RISCO | service-orders.ts:300 (só fluxo evento) | confirmBooking unified = dead-code | MÉDIO | IA-TEMPO | MODO B |
| conflito 409 feedback | NÃO_FECHA | rg BOOKING_PROVIDER_TIME_CONFLICT = ZERO | sem ramo por código; só toast genérico | ALTO | IA-TEMPO | MODO B |
| produto frontend | FECHA_COM_RISCO | PdvPage.tsx:216; marketplace.ts:156-191 | unidade preço mista (reais cru vs cents) | MÉDIO | IA-PRODUTOS | MODO B |
| locação frontend | NÃO_FECHA | services.ts:8 enum; label "Aluguel"; sem UI | só taxonomia | BAIXO | IA-LOCACOES | DECISION |
| assinatura frontend | FECHA | SubscriptionsPage.tsx:59-98; subscriptions.ts:80-106 | amount sem _cents | MÉDIO | IA-ASSINATURAS | HOLD |
| dinheiro frontend | DINHEIRO_CHAMADO | bank/payouts/ledger/escrow/payments vivos | superfícies financeiras amplas (HOLD) | — | IA-DINHEIRO | HOLD |
| botões placebo | SIM/RISCO | MarketplaceHeader.tsx:50; ServicePostCard.tsx:56-61 | sucesso falso no card de feed | ALTO | IA-FRONTEND | MODO B |
| endpoints legados/stale | RISCO | 3 rotas booking; disputes localStorage; getBalance 501 exportado | fan-out de booking; verdade-paralela | MÉDIO | IA-BACKEND/Yala | DECISION |
| testes frontend | INCONCLUSIVE | não auditado (sem foco no eixo) | — | — | — | INCONCLUSIVE |

---

## 5. Achados críticos

### Infra de API
* **API-01 — actorId/companyId enviados como hint, autoridade derivada no backend** (FECHA). `client.ts:186-187` deleta `x-actor-id`/`x-acting-actor-id`; `x-action-context` montado de `localStorage 'unificard_active_actor_id'`; comentários vivos confirmam derivação server-side. Invariante "frontend nunca cria verdade" respeitado. **Não bloqueia.**
* **API-02 — 401 crítico/não-crítico por string-match** (MODO B). `isCritical401`/`isNonCritical401Endpoint` classificam por `path.includes` + keyword substring (`client.ts:34-86`). Frágil a renomeação de rota/mensagem; default conservador mitiga. **Não bloqueia.**
* **API-03 — 400/403/409/429/500 sem ramo dedicado; 429 sem backoff** (MODO B). Só 401/404 tratados; demais caem no throw genérico (`client.ts:444`); parse-fail omite code de 409/429. `blocksMoney=PARCIAL` (rotas financeiras sem distinção conflito/rate-limit). **Não bloqueia MTP.**
* **API-04 — sem debounce/throttle; waitForActorContext faz polling 50ms/2s por request** (MODO B). Sem proteção a storm; latência por chamada protegida sem actor resolvido.

### Oferta (núcleo do bloqueio — "B2")
* **OFFER-FRONT-01 — botão "Novo Serviço" → rota inexistente `/services/new`** (MODO B, **blocksMTP=SIM, blocksPublic=SIM**). `ServicesListPage.tsx:102` navega para rota não registrada em `App.tsx`; `createService`/`updateService` (`services.ts:77,123`) têm ZERO callers. **Não há authoring de service pela UI.**
* **OFFER-FRONT-02 — service_offering (marketplace) é API morta** (DECISION, blocksMTP=PARCIAL). `marketplace.ts:394/448/3220` (`ServiceOffering`, `getStoreServiceOfferings`, `activate/deactivateImportedService`) sem nenhum consumidor. Nenhuma superfície de offering exposta ao usuário.
* **OFFER-FRONT-03 — sem ciclo publicar/pausar do service** (MODO B). Filtro draft/active/paused existe (`ServicesListPage.tsx:117`) mas nenhum botão muda status.
* **OFFER-FRONT-04 — composição de oferta vive em `service.metadata.setups`** (DECISION). `ServiceSetupSelector` substitui o ausente `ServiceOfferingSelector`, lendo metadata livre, não entidade soberana.
* **OFFER-FRONT-05 — `discoverServices` não filtra status** (INCONCLUSIVE, needsYala). Contenção de draft 100% no backend; não verificável no front.

### Marketplace / Discovery
* **MKT-04 — ZERO `canonicalServiceId`/`concept_id` na discovery** (DECISION, needsYala). Confirmado por grep no frontend inteiro. Card carrega `serviceId` (instância) ou `product_id`; `category.metadata.category_type/taxonomy` usado SÓ para navegação (correto). Se o backend expõe `concept_id`/`canonicalServiceId`, o front descarta.
* **MKT-01/02/03/05 — vitrine não chega a contratável** (MODO B/INCONCLUSIVE). `/search` é stub puro; `searchMarketplace` chamado mas resultado nunca renderizado (`CategoryNavigationPage`); `MarketplaceSegmentPage` retorna `stores=[]` (TODO); folha de categoria diz "em breve". Contratação só em silos isolados (service-discover, store-products/checkout) inalcançáveis por navegação.
* **MKT-06 — dois "homes" divergentes** (MODO B). `/marketplace` monta `MarketplaceHomePage`; `MarketplacePage` (tabs/cart, `MarketplaceHome` rico) não roteado; `MarketplaceHome` com `actor_id='user-001'` e cidade `'Curitiba'` hardcoded.

### Availability / Booking
* **AVAIL-BOOK-01 — 409 BOOKING_PROVIDER_TIME_CONFLICT sem tratamento dedicado** (MODO B, blocksMTP/Public=PARCIAL). `rg` = ZERO; create/confirm só com catch genérico → toast. Cliente/prestador não entende por que falhou.
* **AVAIL-BOOK-02 — lifecycle unified (`createBooking`/`confirmBooking` de `availability.ts`) é dead-code** (MODO B). Todo booking real passa por endpoints legados `/services/:id/bookings` e `/service-orders/confirm-booking`.
* **AVAIL-BOOK-03 — duas fontes de availability: unified vs `/services/:id/availability` legado** (MODO B). Legado sem `purposeConceptId`/`owner_type`/`is_bookable`; não participa do core temporal.
* **AVAIL-BOOK-04 — `BookingStatus` legado não tem 'confirmed'** (DECISION). Confirmação produz `ServiceOrder`, não transição de status no booking.
* **AVAIL-BOOK-05 — ProfileAgenda + save UX canônicos e corretos** (FECHA, referência). Sem `metadata.schedule`, sem placebo, dirty preservado no erro, 429 traduzido.

### Auth / Perfil / Empresa (fundação sã)
* **AUTH-REG-01/03 — payload register completo (birthdate/gender/cpf/referral) + roteamento server-driven + /perfil sem dead-end** (FECHA). `auth.ts:53-69`; `App.tsx:117-118` (`requiresOnboarding`).
* **PROFILE-01 — `PUT /profile/physical` legado não checa `response.ok`** (MODO B, blocksPublic=PARCIAL). `physical.ts:54-58` engole 4xx/5xx → sucesso falso no alert de Interesses.
* **PROFILE-03 — aba Saúde placebo consciente (501) + `ProfileHealthForm` legado morto no bundle** (DECISION, LGPD).
* **PROFILE-05 — lock civil derivado da camada identity (projeção, não autoridade)** (FAST-PATH).
* **PJ-FRONT-01/02/03 — criação PJ real (CNPJ no payload, sem autoridade vazada), KYB como projeção soberana, backoffice admin KYB vivo e roteado** (FECHA).
* **PJ-FRONT-04 — `api/organization.ts` + páginas Organization* são código de escrita morto** (MODO B). Rotas comentadas em `App.tsx:331-335` (DT-ORGANIZATION-SPRINT78-FROZEN; tabelas org_* ausentes, 500).

### Placebo / Stale (jornada B1)
* **PLACEBO-02 — `ServicePostCard` finge agendamento** (MODO B, **blocksMTP=SIM**). `ServicePostCard.tsx:56-61`: `console.warn` + `alert('Serviço agendado com sucesso!')` SEM chamada de booking. **Sucesso falso material.**
* **PLACEBO-01 — busca dos headers é no-op** (MODO B). `MarketplaceHeader.tsx:50` (TODO) e `MarketplaceSimpleHeader.tsx:20` (só console.log), apesar de `marketplace-search.ts` funcional.
* **PLACEBO-03 — fan-out de 3 rotas de booking** (DECISION, needsYala). `/services/:id/bookings` · `/marketplace/services/booking` · `/availability/bookings` coexistem.
* **STALE-01 — `disputes.ts` inteiro é mock em localStorage** (`'unify_disputes'`, endpoints comentados). Fora do B1, mas verdade-paralela viva.
* **STALE-02 — endpoints 501 tombstonados; `getBalance` ainda exportado/chamável** (FAST-PATH, hygiene).

### Produtos / Locações / Assinaturas / Dinheiro
* **PROD-01 — PDV envia `amount=parseFloat` reais cru, não cents** (MODO B, RISCO de unidade 100x). `PdvPage.tsx:216,233` diverge da convenção `_cents`. Handoff IA-DINHEIRO.
* **PROD-02 — preço marketplace `{amount,currency}` sem unidade vs `priceCents`** (MODO B).
* **SUB-01 — assinaturas com UI completa e recorrência real; `amount` sem `_cents`** (HOLD).
* **RENT-01 — locação só existe como enum + label "Aluguel"; `VenuePublicPage` é comanda QR de bar, não locação** (DECISION).
* **MONEY-01 — superfícies financeiras amplas e vivas (DINHEIRO_CHAMADO, HOLD)**; **MONEY-02 — B1 pré-dinheiro NÃO chama rota financeira (DINHEIRO_FORA confirmado)**. `availableBalanceCents`/`actor-statement` NÃO consumido no front (só `balanceCents` de `/bank/balance`).

---

## 6. Gaps de conexão (frontend ↔ backend ↔ DTO ↔ jornada)

1. **Discovery não transporta semântica canônica.** Backend (B1 e2e) prova `canonicalServiceId`/`by-canonical`; o frontend tem ZERO ocorrências dos três termos. Os DTOs `DiscoveredService` (`service-discovery.ts:25-63`) e `MarketplaceSearchResult` (`marketplace-search.ts:20-49`) **não declaram** `canonicalServiceId`/`concept_id`. Se o backend os retorna, o front os descarta no contrato.
2. **Authoring de service sem superfície.** `createService`/`updateService` existem em `services.ts` mas sem caller e sem rota (`/services/new` inexistente). O service "nasce" por canal não-UI (seed/backend).
3. **Service ↔ service_offering desconectados.** Dois universos paralelos (`api/services.ts` e `ServiceOffering` de `marketplace.ts`) sem ponte; o front não liga `service.id` a `offering_id`. Decisão arquitetural pendente.
4. **Booking fragmentado em 3 superfícies.** O lifecycle unified (`/availability/bookings`) é dead-code; o real passa por legados. SSOT temporal incerto (handoff Yala/backend).
5. **409 de conflito invisível.** Backend retorna conflito; frontend não ramifica por código nem exibe mensagem dedicada.
6. **Unidade monetária mista.** `{amount,currency}` (marketplace) vs `priceCents` vs `amount` reais cru (PDV/subscriptions) — sem mapper de borda; risco de erro de unidade.
7. **Casing de body sem normalização.** snake_case (checkout) e camelCase (agreements) coexistem por contrato de rota; invisível ao tsc.
8. **Hints inventados.** `MarketplaceHome` usa `actor_id='user-001'`/`'Curitiba'` em vez de derivar do `activeActor`/endereço.

---

## 7. Handoffs para outras IAs

* **IA-CADASTRO-ONBOARDING:** confirmar no backend que `POST /auth/register` persiste `birthdate` E `gender` (front envia ambos, mas `Register.tsx:233` sinaliza incerteza histórica); documentar contrato de `data.requiresOnboarding`; `/auth/check-cpf` e `/auth/check-referral` públicos resolvem tenant server-side.
* **IA-PERFIL-SSOT:** `PUT /profile/physical` legado não checa `response.ok` (PROFILE-01) — confirmar se ainda é SSOT de weeklyRoutine/goals (F5 do DECISION-0071 removeria); idempotência/atomicidade dos endpoints C1 (POST/PATCH/DELETE em laço sem transação); SSOT de fato entre `/profile`, `/core/profile`, `/identity/me` para fullName/birthdate/gender/cpf; fail-closed do lock civil no backend.
* **IA-EMPRESA-PJ:** frontend PJ saudável; decidir destino de `api/organization.ts` + páginas Organization* (código de escrita morto sobre tabelas congeladas); UX do convite de membro (UUID manual).
* **IA-AUTORIDADE:** confirmar que as 4 rotas KYB admin de `KybReviewBackoffice` estão protegidas por `requireRole(['admin'])` + reviewer-humano-fail-closed; `companyId` só em URL path, autoridade re-derivada; `actorId` do convite é alvo, não autoridade.
* **IA-OFERTA:** decidir (a) se `service_offering` é entidade distinta de `service` e quem a autora/ativa; (b) onde mora a composição da oferta (`metadata.setups` vs entidade); criar tela de authoring de service + rota `/services/new`; ciclo publicar/pausar; leitura de availability por offering (`ownerType='service_offering'`, enum já existe).
* **IA-SEMANTICA:** discovery não transporta `canonicalServiceId`/`concept_id` (MKT-04); validar contrato real de `/services/discover` e `/marketplace/search` e decidir se o card resolve por `concept_id`.
* **IA-TEMPO:** convergência unified vs legado de booking/availability; especificar código/HTTP do conflito de horário para o front ramificar; SSOT do estado "confirmado" (status do booking unified vs ServiceOrder).
* **IA-MARKETPLACE-JORNADA:** vitrine não conecta a contratável (search stub, segment vazio, dois homes divergentes, busca de header placebo); costurar discovery→offering; eleger superfície canônica. _(Convergente com IA-10 já existente.)_
* **IA-PRODUTOS-ESTOQUE:** unificar convenção de preço (`_cents`); auditar criação/edição de produto e variantes em `MarketplaceProducts`/`Inventory`.
* **IA-LOCACOES-RECURSOS:** locação só existe como taxonomia; `VenuePublicPage` é comanda QR (reclassificar); decidir se locação entra no MTP.
* **IA-ASSINATURAS-RECORRENCIA:** UI completa e funcional; confirmar unidade de `amount` e escopo financeiro.
* **IA-BANCO:** —(eixo não consultou DB; sem achado próprio)—
* **IA-DINHEIRO:** superfícies financeiras amplas e vivas no front (bank/payouts/ledger/escrow/payments/venue/checkout); `availableBalanceCents`/`actor-statement` NÃO consumido (só `balanceCents`); RISCO de unidade em PDV e subscriptions; **B1 pré-dinheiro = ZERO chamadas financeiras (DINHEIRO_FORA confirmado)**.
* **IA-DECISOES-DT:** candidatos a DT/decisão — relação service↔offering; rota canônica de booking; convenção de preço; remoção/descongelamento de organization_*.
* **IA-FRONTEND (refino, sem decisão):** classificar 401 por `error.code`; ramo 409 + backoff 429; ligar busca dos headers ao `marketplace-search.ts`; remover alert de sucesso falso do `ServicePostCard`; derivar `actorId`/cidade do `activeActor`; renderizar `searchResults` em CategoryNav; ligar stores-por-segmento.

---

## 8. Riscos para MTP

* **Bloqueia MTP (caminho visível na tela):**
  - Sem authoring de service pela UI (OFFER-FRONT-01) — provedor não consegue cadastrar serviço.
  - Sem entidade/CRUD/seletor de offering (OFFER-FRONT-02/04; ServiceOfferingSelector ausente) — não há composição de oferta soberana.
  - Vitrine não chega a contratável (MKT-01/02/03/05) + busca placebo (PLACEBO-01).
  - Discovery sem `canonicalServiceId`/`concept_id` (MKT-04) — não liga à oferta canônica provada no backend.
  - 409 de conflito sem feedback (AVAIL-BOOK-01).
  - `ServicePostCard` finge sucesso (PLACEBO-02).
* **Não bloqueia, mas deve ser corrigido:** `PUT /profile/physical` sem `response.ok` (PROFILE-01); 401 string-match (API-02); fan-out de booking (PLACEBO-03); hints hardcoded (PLACEBO-04); `searchMarketplace` órfão (MKT-02).
* **V2 / não-MVP:** locação (RENT-01); disputas (STALE-01); organization MVP (PJ-FRONT-04).
* **Cleanup/hygiene:** `getBalance` exportado pós-501 (STALE-02); `ProfileHealthForm` morto no bundle (PROFILE-03); casing sem mapper (API-05).
* **Exige decisão de produto/arquitetura:** service vs service_offering; onde mora a composição da oferta; rota canônica de booking; SSOT de availability (unified vs service legado); SSOT do estado "confirmado".

---

## 9. Riscos para público e dinheiro

* **Blockers antes de público:** mesmos do MTP (oferta→marketplace→booking visível) + busca global stub (`/search`) + `discoverServices` não filtra status (OFFER-FRONT-05, **needsYala** — risco de draft vazar se backend não contiver). `PUT /profile/physical` sem `response.ok` (sucesso falso ao usuário público).
* **Blockers antes de dinheiro:** RISCO de unidade em PDV (`parseFloat` reais cru) e subscriptions (`amount` sem `_cents`) — **validar unidade server-side antes de habilitar cobrança**; client sem ramo 409/backoff 429 em rotas financeiras (API-03). Tudo HOLD por diretiva.
* **Blockers de frontend:** authoring de service; seletor de offering; wiring discovery→offering; 409 feedback; placebos (busca/ServicePostCard).
* **Blockers de API contract:** DTOs de discovery sem `canonicalServiceId`/`concept_id`; fan-out de 3 rotas de booking; casing sem mapper.
* **Exigem DECISION:** service↔offering; rota canônica de booking; convenção de preço.
* **Permanece HOLD:** todas as superfícies financeiras (checkout/bank/payout/ledger/escrow/payments/venue/subscriptions) — **DINHEIRO_CHAMADO mas fora deste eixo**; B1 pré-dinheiro confirmadamente **DINHEIRO_FORA**.

---

## 10. Respostas às 18 perguntas obrigatórias

1. Cadastro completo com birthdate/gender? — **SIM** (auth.ts:53-69; Register.tsx:245-253).
2. Leva usuário novo ao lugar correto? — **SIM** (App.tsx:117-118, server-driven `requiresOnboarding`).
3. /perfil fecha para usuário novo? — **SIM** (App.tsx:288, token+tenant setados; 8 abas reais).
4. Cria/gerencia empresa/PJ? — **SIM** (createCompany + CNPJ; KYB projetado; backoffice admin vivo).
5. Cria/visualiza service? — **PARCIAL** (visualiza SIM; cria NÃO — `/services/new` inexistente).
6. Cria/visualiza service_offering? — **NÃO** (API marketplace morta, 0 consumidores).
7. Usa canonicalServiceId da discovery? — **NÃO** (ZERO ocorrências).
8. Existe ServiceOfferingSelector ou equivalente? — **NÃO** (`ServiceSetupSelector` sobre metadata ≠ equivalente soberano).
9. Marketplace/discovery → offering contratável? — **NÃO**.
10. Mostra availability da offering? — **PARCIAL** (só de service legado / self-actor; não de offering).
11. Cria booking requested? — **SIM** (via legado `/services/:id/bookings`, contexto evento).
12. Confirma booking e trata conflito 409? — **PARCIAL** (confirma via `/service-orders/confirm-booking`; 409 NÃO tratado).
13. Botões placebo relevantes? — **SIM** (ServicePostCard sucesso falso; busca header no-op).
14. Endpoints legados/stale ainda chamados? — **SIM / RISCO** (3 rotas booking; service-availability legado; disputes localStorage; getBalance exportado).
15. Chama dinheiro em fluxo pré-dinheiro? — **NÃO** (B1 = ZERO; DINHEIRO_FORA confirmado).
16. Bloqueia MTP? — **BLOQUEIA_PARCIAL** (fundação fecha; arco oferta→marketplace→booking visível não fecha).
17. Bloqueia público? — **BLOQUEIA_PARCIAL** (mesmo arco + busca stub + risco draft).
18. Bloqueia dinheiro? — **HOLD_FINANCEIRO** (superfícies vivas mas fora do eixo; validar unidade antes de habilitar).

---

## 11. Veredito final

### **NÃO_FECHA**

A **fundação do frontend está fechada e disciplinada** (cadastro, perfil, empresa/PJ, declaração de agenda canônica, infra de API com autoridade tratada como hint, dinheiro limpo no B1). Mas o **arco central que a MTP exige — provedor cria oferta → cliente descobre → seleciona offering → vê availability → reserva → recebe feedback de conflito — NÃO fecha na tela**: não há authoring de service (rota inexistente), não há entidade/CRUD/seletor de offering, ZERO uso de `canonicalServiceId`/`concept_id`, a vitrine não chega a nada contratável, o 409 não tem feedback, e há placebo que finge sucesso de agendamento. O backend prova a jornada (Caminho B1 e2e); a tela não a expõe. Isso é exatamente o **B2 frontend wiring** — frente própria, convergente com o veredito da IA-10.

---

## 12. Próxima frente recomendada

### **MODO_B_B2_FRONTEND_WIRING** (MODO B)

**Justificativa:** os blockers de MTP são de cabeamento de superfície sobre backend já provado, não de decisão nova — exceto dois pontos que exigem DECISION e devem ser resolvidos ANTES do wiring:
1. **DECISION (pré-requisito):** relação `service ↔ service_offering` (entidade distinta? quem autora?) e onde mora a composição da oferta (`metadata.setups` vs entidade canônica). Sem isso, o seletor de offering não tem alvo.
2. **DECISION (pré-requisito):** rota canônica de booking (unified `/availability/bookings` vs legado `/services/:id/bookings`) e SSOT temporal — handoff Yala/IA-TEMPO.

**Sequência sugerida do B2 (após as 2 decisões):** (a) DTO de discovery passa a carregar `canonicalServiceId`/`concept_id`; (b) card chama `by-canonical`; (c) `ServiceOfferingSelector` (active-only, draft oculto); (d) leitura de availability por offering (`ownerType='service_offering'`); (e) booking via rota canônica com ramo 409 e feedback de conflito; (f) tela de authoring de service + rota `/services/new`. **Quick wins paralelos (sem decisão):** remover alert de sucesso falso do `ServicePostCard`; ligar busca dos headers ao `marketplace-search.ts`; derivar `actorId`/cidade do `activeActor`.

**Dinheiro permanece HOLD.** Não abrir frente financeira a partir deste eixo.

---

## Resumo executivo (≤10 bullets)

* **HEAD `aaeb50b5`, READ-ONLY, único arquivo escrito = este.** Veredito: **NÃO_FECHA**; próxima frente: **MODO_B_B2_FRONTEND_WIRING**.
* **Fundação sã:** cadastro com civis completos + roteamento server-driven; /perfil com 8 abas reais e lock civil como projeção; empresa/PJ cria de verdade com KYB soberano; ProfileAgenda (unified availability) é referência canônica.
* **Infra de API disciplinada:** `actorId`/`companyId` são hints, autoridade derivada no backend; `x-actor-id` deletado; endpoints via env. Ressalvas MODO B: 401 por string-match, sem ramo 409/backoff 429, sem debounce.
* **Bloqueio central (B2):** sem authoring de service (botão → `/services/new` inexistente), sem entidade/CRUD/seletor de offering, `ServiceOfferingSelector`/`api/offerings.ts` AUSENTES.
* **ZERO `canonicalServiceId`/`concept_id`/`by-canonical` no frontend inteiro** — a discovery não transporta a semântica canônica que o backend prova; card carrega `serviceId`/`product_id`.
* **Vitrine não chega a contratável:** `/search` stub, busca de header no-op (placebo), `searchMarketplace` com resultado órfão, segment sempre vazio, folha "em breve".
* **Booking fragmentado:** 3 rotas paralelas; lifecycle unified é dead-code; **409 BOOKING_PROVIDER_TIME_CONFLICT sem nenhum feedback**; `ServicePostCard` finge "agendado com sucesso" sem booking.
* **Dinheiro:** B1 pré-dinheiro = **ZERO chamadas financeiras (DINHEIRO_FORA confirmado)**; superfícies financeiras amplas existem mas estão **HOLD**; RISCO de unidade em PDV (reais cru) e subscriptions.
* **Dívidas de hygiene:** `organization.ts` morto sobre tabelas congeladas; `disputes.ts` em localStorage; `getBalance` exportado pós-501; `PUT /profile/physical` sem `response.ok`.
* **2 DECISIONs pré-requisito do B2:** (1) service↔offering + onde mora a composição; (2) rota canônica de booking + SSOT temporal (Yala/IA-TEMPO).
