# IA-12 — Produtos/Estoque

## 1. Carimbo

* **HEAD:** `aaeb50b5182120888a72418775a9d211e33bff4d`
* **Data/hora:** 2026-06-21 (America/Sao_Paulo)
* **Git status:** branch `rescue-structural`; somente memórias/docs modificados/untracked (nenhuma alteração de código nesta auditoria). Este arquivo é a única escrita.
* **READ-ONLY confirmado:** SIM — nenhuma edição de backend/frontend/migration/norma/decision/status/DT; nenhum commit; nenhuma query de escrita; psql somente `SELECT`/`count(*)` com colunas explícitas.
* **Arquivo criado/atualizado:** `docs/memorias/IA-12-PRODUTOS-ESTOQUE.md` (criado).
* **Backend/frontend/schema/docs consultados:** schema vivo `unificard_dev` (information_schema + pg_constraint); `src/modules/marketplace/*` (product/offer/inventory/reservation/fulfillment/visibility/search); `src/core/catalog/canonical/*`; `src/core/catalog/catalog-governance.routes.ts` + `suggestions/*`; `src/core/intent/intent-execute.routes.ts`; `src/core/authorization/authorization.service.ts`; `src/core/companies/companies.service.ts`; migrations product/inventory/stock; `DECISION_0108`, `DECISION_0117`, execução `20260605_PJ_PRODUCT_CONCEPT_GUARD_LAYER_FIX`; `18_DOMAIN_ONTOLOGY §12` (RFC-003); docs cadeia-de-oferta.
* **Comandos/probes usados:** `git rev-parse HEAD`; `git status --short`; Glob `**/*product*|*inventory*|*stock*`; Grep `RFC-003|DECISION-0108`; psql read-only (colunas/contagens/constraints/triggers); leitura direta de fontes.
* **Método:** raio-X multi-agente READ-ONLY (8 sub-eixos paralelos + verificação adversarial). 5 sub-eixos retornaram com evidência viva completa (semântica, seller/autoridade, preço, variantes/estoque, marketplace/dinheiro); 3 (visibilidade, product-model, cartório/mistura) foram completados por leitura direta da executora após limite de sessão dos agentes. Verificações adversariais de blockers foram interrompidas pelo mesmo limite — os achados-quentes ficam marcados como **não re-verificados adversarialmente** (INV-03, MKTCHK-03, SELLER-05).

---

## 2. Escopo

**Auditado (eixo 12):** modelo de produto (canônico + comercial), semântica (concept_id/category), seller/company/autoridade de escrita, preço (cents/BIGINT × NUMERIC), variantes/SKU/PLU, estoque/inventory (movimentos/balanço/reserva/concorrência), visibilidade/publicação, handoff de marketplace, handoff de checkout/dinheiro (superficial), produto×serviço×locação, cartório (RFC-003/DECISION-0108/0117), testes existentes.

**Fora (handoff):** autoridade global, empresa/PJ/KYB completos, semântica global, oferta/serviço completos, tempo/booking, marketplace inteiro, locações, assinaturas, ledger/split/payout, frontend inteiro, banco/schema geral.

---

## 3. Mapa macro de produto

```
CONCEPT ───────► CANONICAL_PRODUCT ──► VARIANT/SKU ──► SELLER/OFFER ──► PRICE_CENTS ──► INVENTORY ──► VISIBILITY ──► MARKETPLACE ──► SELECTION ──► RESERVATION/ORDER ──► HANDOFF $$
 (concepts          (canonical_         (product_        (product_         (price_cents       (movements      (READY+offer+     (search:          (variant      (intent.execute       (post-SUBMITTED
  150 linhas)        products 35)        variants /       offers.           BIGINT, 4          append-only     stock>0+KYB)      products NÃO      via offer)    DRAFT→reserve→        settlement
                                         canonical_       merchant_id)      tabelas)           SSOT + reserva)                   surfaceados)                  SUBMITTED, $$ fora)   inexistente)
                                         variants)
```

| Elo | Estado |
|---|---|
| CONCEPT (SSOT `concepts`) | **FECHA** — concept_id é identidade material; legado `product_concepts` deprecado |
| CANONICAL_PRODUCT | **FECHA_COM_RISCO** — 35 confirmados, concept_id+category NOT NULL; é a única camada com dado vivo |
| VARIANT / SKU | **FECHA_COM_RISCO** — per-variant load-bearing; SKU unique por tenant; PLU sem unique; sale_unit admite hour/service (blur) |
| SELLER / OFFER | **FECHA_COM_RISCO** — autoridade server-side fail-closed; KYB não exigido na criação (só publicação) |
| PRICE_CENTS | **FECHA** — 4 tabelas em BIGINT cents; zero NUMERIC de preço; RFC-003-preço stale/resolvido |
| INVENTORY | **FECHA_COM_RISCO** — movements append-only SSOT, reserva com FOR UPDATE; negative-stock fora da reserva (INV-03) |
| VISIBILITY | **FECHA** — READY+offer ativa+estoque>0+KYB/publicação (DECISION-0117); estoque zero não some, fica indisponível |
| MARKETPLACE (discovery) | **NÃO_FECHA** — `/marketplace/search` é services-only; produtos não têm card/detalhe/seleção via busca |
| SELECTION (variante) | **STUB** — seleção de variante via oferta existe no reader; jornada de UI ausente |
| RESERVATION / ORDER | **FECHA_COM_RISCO** — intent.execute cria DRAFT→reserva→SUBMITTED; 0 linhas (nunca exercido live) |
| HANDOFF $$ | **STUB / HOLD** — settlement pós-SUBMITTED inexistente; dinheiro quarentenado por design |

---

## 4. Matriz do eixo

| item | fecha/não-fecha | evidência viva | blocker | risco | próxima frente | modo |
|---|---|---|---|---|---|---|
| product model (canônico) | FECHA_COM_RISCO | canonical_products=35 confirmados | — | só camada com dado | — | FAST-PATH |
| product model (comercial) | FECHA_COM_RISCO | products/offers schema ok, 0 linhas | público/MTP | nunca exercido live | IA-MARKETPLACE-JORNADA | MODO B |
| product schema | FECHA | information_schema; FKs/CHECKs | — | — | — | FAST-PATH |
| product routes | FECHA_COM_RISCO | offering/intent vivos; catalog/checkout/orders=stubs | público | rotas nomeadas vazias | IA-MARKETPLACE-JORNADA | MODO B |
| product frontend | INCONCLUSIVE | fora do escopo | — | — | IA-FRONTEND-UX-CONTRATOS | INCONCLUSIVE |
| product concept_id | FECHA | FK concepts; CHECK confirmed-requires-concept | — | — | — | FAST-PATH |
| product category_id | FECHA | category=navegação/elegibilidade (0108) | — | products.category NOT NULL (routing) | — | FAST-PATH |
| seller/company | FECHA_COM_RISCO | canRepresentActor/canManageCompany fail-closed | — | KYB não na criação | IA-EMPRESA-PJ | DECISION |
| price_cents | FECHA | 4 tabelas BIGINT(64,0) | — | — | — | FAST-PATH |
| NUMERIC/decimal (preço) | FECHA (ausente) | 8 NUMERIC = só quantidades | — | docs stale citam NUMERIC | IA-DECISOES-DT | FAST-PATH |
| currency | FECHA | text/varchar(3) default BRL | — | — | — | FAST-PATH |
| variants/SKU | FECHA_COM_RISCO | per-variant; SKU unique/tenant | — | PLU sem unique | — | MODO B |
| inventory | FECHA_COM_RISCO | movements append-only SSOT (triggers) | — | balanço é cache | — | FAST-PATH |
| stock quantity | FECHA | NUMERIC(20,4) legítimo (kg/l/un) | — | — | — | FAST-PATH |
| stock reservation | FECHA | FOR UPDATE + locks ordenados | — | — | — | FAST-PATH |
| stock concurrency | FECHA_COM_RISCO | reserve sólido | público | OUT fulfillment sem re-lock (INV-03) | ORDER/FULFILLMENT | DECISION |
| visibility/status | FECHA | product-visibility.service + DECISION-0117 | — | — | — | FAST-PATH |
| draft/active/published | FECHA | offer is_active+status='active'; READY canônico | — | — | — | FAST-PATH |
| marketplace product card | NÃO_FECHA | search=services-only; stubs | público/MTP | sem discovery de produto | IA-MARKETPLACE-JORNADA | MODO B |
| product detail | STUB | só store-scoped /store/:id/products | público | — | IA-MARKETPLACE-JORNADA | MODO B |
| checkout handoff | STUB / HOLD | intent.execute para em SUBMITTED | dinheiro | settlement inexistente | IA-DINHEIRO | HOLD |
| dinheiro fora/HOLD | FECHA (quarentena) | zero ledger/split/payout no path | — | legado in-memory disabled (410) | IA-DINHEIRO | HOLD |
| RFC-003 | FECHA (esclarecido) | RFC-003=Time-Service; preço-RFC-003 stale | — | docs desatualizados | IA-DECISOES-DT | FAST-PATH |
| DECISION-0108 | FECHA | guard-fix executado; DT CLOSED (13/13) | — | Op2 supermercado pendente go | IA-EMPRESA-PJ | — |
| testes existentes | FECHA_COM_RISCO | 12 e2e product/inventory/offer | — | 0 linhas em prod (efêmeros) | — | MODO B |

---

## 5. Achados críticos

### PRODUCT-01 — Dois layers: catálogo canônico (vivo) × camada comercial (schema-ready, 0 linhas)
* **Descrição:** `canonical_products` (35, todos INDUSTRIAL/confirmed) é a única camada com dado material vivo. A camada comercial por-tenant (`products`, `product_variants`, `product_offers`, `product_prices`, `store_product_activations`, `inventory_*`, `orders`) tem schema correto e bem-governado, mas **0 linhas** — nunca exercida com dado vivo (só por e2e efêmeros).
* **Evidência:** psql counts — canonical_products=35; products/offers/variants/prices/inventory_*/orders=0.
* **Arquivos/tabelas:** todas as tabelas product/inventory; `canonical-product.repository.ts`.
* **Impacto:** coerência ponta-a-ponta é **estrutural, não comportamentalmente provada**.
* **MTP:** PARCIAL · **Público:** PARCIAL · **Dinheiro:** NÃO · **DECISION:** não · **YALA:** não · **Modo:** MODO B · **Handoff:** IA-MARKETPLACE-JORNADA (E2E live).

### SEMANTIC-01 — concept_id é a identidade semântica material (SSOT = `concepts`)
* **Descrição:** `canonical_products.concept_id` FK→`concepts` (150); estado `confirmed`/READY exige concept_id NOT NULL (CHECK `canonical_products_confirmed_requires_concept_chk` + predicado de readiness). Legado `product_concepts`/`product_concept_id` dropado (migration `20260429100000` Opção B; cleanup `20260429200000`). Produto comercial alcança concept transitivamente via `products.canonical_product_id` (INDUSTRIAL exige canônico).
* **Evidência:** FK + CHECK; `canonical-product-readiness.ts:30-54`; 35/35 com concept_id NOT NULL.
* **MTP/Público/Dinheiro:** NÃO · **Modo:** FAST-PATH · **Handoff:** NONE.

### SEMANTIC-03 — category_id é navegação/elegibilidade, não identidade
* **Descrição:** category usada para navegação e para o recorte por categoria/ramo da DECISION-0108 (`assertProductCategoryAllowedForCompany`), explicitamente **não** para comparar identidade semântica. Caveat: `products.category_id` é NOT NULL (atributo de roteamento obrigatório na linha comercial), embora não seja o SSOT semântico.
* **MTP/Público/Dinheiro:** NÃO · **Modo:** FAST-PATH · **Handoff:** NONE.

### PRICE-01/02/03 — Preço 100% BIGINT cents; RFC-003-preço é stale; RFC-003 real = Time-Service
* **Descrição:** `products`, `product_prices`, `product_offers`, `access_pass_products` — todos `price_cents bigint(64,0)`, currency text default BRL. **Zero** NUMERIC/decimal/money de preço. As 8 colunas NUMERIC do eixo são quantidades (inventory `quantity`/`current_quantity`, stock_transfer, `canonical_variants.net_content_value`) ou confiança ML — **não** dinheiro. O NUMERIC histórico de `product_offers` (NUMERIC(12,4)) e `product_prices` (NUMERIC(20,2)) foi migrado p/ cents (`20260331150000`, `20260416100000`) e dropado; `tenant_products` price NUMERIC dropado (`20260530530000`).
* **Esclarecimento RFC-003:** **não existe arquivo RFC-003**. O `RFC-003` em `18_DOMAIN_ONTOLOGY §12` = **"Time-Service"** (tempo como SSOT, PENDENTE) — **nada a ver com dinheiro**. O "RFC-003 price NUMERIC pendente" citado no prompt e em `MINHA_MEMORIA_COMERCIO.md:46`/`IA-COMERCIO.md:36,58` é **stale/resolvido** (ACHADOS.md:10 já afirma "o NUMERIC/RFC-003 era stale"). Frontend envia cents inteiros; backend rejeita decimais (`OFFER_PRICE_INVALID`); preço não toca `bank_ledger`.
* **MTP/Público/Dinheiro:** NÃO · **Modo:** FAST-PATH · **Handoff:** IA-DECISOES-DT (corrigir docs stale).

### SELLER-01/04 — Seller derivado server-side fail-closed; cross-tenant bloqueado
* **Descrição:** `POST/PUT /offerings/product` e catalog-governance tratam `storeActorId`/`companyId` do body como **hint**; autoridade provada via `canRepresentActor(merchant)` / `canManageCompany(company)` (403 fail-closed, DECISION-0113/0117). `merchant_id` escrito do storeActorId validado; `updateOwnOffer` re-deriva merchant da linha no DB. `products` não tem coluna de owner (só tenant_id) — ownership vive em `product_offers.merchant_id`. Cross-tenant bloqueado: gate de visibilidade canônica (404 `CANONICAL_NOT_VISIBLE`) + tenant_id de `req.tenant.id` + `runQueryWithTenant`.
* **MTP/Público/Dinheiro:** NÃO · **Modo:** FAST-PATH · **Handoff:** NONE.

### SELLER-05 — KYB NÃO exigido na CRIAÇÃO de produto/oferta (só na publicação/discovery) ⚠️ não re-verificado adversarialmente
* **Descrição:** `canManageCompany` checa apenas membership/role em `company_users` (ativo) — **não** consulta `fiscal_identities.kyb_status`. Logo um PJ com vínculo mas sem KYB aprovado **pode** criar sugestões canônicas, produtos locais e ofertas. KYB é cobrado a jusante: publicação (`KYB_NOT_APPROVED`) e discovery (`kyb_status='approved'` no reader). Efeito: PJ sem KYB encena linhas que nunca publicam nem aparecem. Se criar-sem-KYB é aceitável (autoria vs publicação) é decisão de IA-EMPRESA-PJ/IA-AUTORIDADE — alinha ao GAP-KYB emergente da DECISION-0131.
* **MTP:** PARCIAL · **Público:** PARCIAL · **Dinheiro:** NÃO · **DECISION:** sim · **YALA:** não · **Modo:** DECISION · **Handoff:** IA-EMPRESA-PJ; IA-AUTORIDADE.

### INV-01/02 — inventory_movements é SSOT append-only; reserva com concorrência sólida
* **Descrição:** Balanço derivado por `SUM(CASE movement_type)`; `inventory_balances` é cache opcional rebuildável (PK product_variant_id). Imutabilidade por triggers (UPDATE/DELETE bloqueados). Reserva: `SELECT ... FOR UPDATE` no variant + `available = balanço - reservas ativas` + locks ordenados por id ASC (anti-deadlock); `InsufficientStockError` se faltar. Reservas são soft-hold (não mexem em movements). Overselling prevenido **no momento da reserva**.
* **MTP/Público/Dinheiro:** NÃO · **Modo:** FAST-PATH · **Handoff:** NONE.

### INV-03 — OUT de fulfillment não re-trava o variant nem revalida on-hand (negative-stock fora da reserva) ⚠️ não re-verificado adversarialmente
* **Descrição:** No SHIP, `fulfillment.service.ts:232-252` grava OUT e consome a reserva atomicamente (correto para o caminho reservado), **mas** não re-adquire `FOR UPDATE` no variant nem revalida on-hand≥qty; e `inventory.service.addMovement` explicitamente "não impede estoque negativo". A proteção de oversell vive **só** no path de reserva — qualquer OUT sem reserva prévia (ou com reserva liberada/expirada entre reserve e ship) pode levar a estoque negativo. Latente (0 linhas) mas estrutural.
* **MTP:** NÃO · **Público:** PARCIAL · **Dinheiro:** NÃO · **DECISION:** sim · **YALA:** sim · **Modo:** DECISION/MODO B · **Handoff:** ORDER/FULFILLMENT; IA-DINHEIRO (settlement de oversold).

### INV-04 — Reservas expiradas nunca varridas (releaseExpiredReservations sem caller)
* **Descrição:** `releaseExpiredReservations`/`getExpiredReservations` implementados mas **sem caller** (sem worker/cron/rota). Holds expirados são excluídos da disponibilidade no read (filtro `expires_at>NOW()`), logo não travam estoque, mas acumulam como linhas ACTIVE estagnadas — dívida de higiene/auditoria.
* **MTP/Público/Dinheiro:** NÃO · **Modo:** MODO B · **Handoff:** NONE.

### INV-05 — Variant/SKU load-bearing; PLU sem unique; sale_unit vaza unidades de serviço
* **Descrição:** Estoque/movimentos/reservas/balanços/preços são por `product_variant_id`. `UNIQUE(tenant_id, sku)`; PLU só índice parcial (sem unique → colisão possível no PDV). `sale_unit CHECK` admite `hour`/`service` — `product_variants` reusado p/ unidades de serviço, borrando a fronteira produto(estoque)×serviço(booking).
* **MTP/Público/Dinheiro:** NÃO · **DECISION:** sim · **Modo:** DECISION/MODO B · **Handoff:** SERVICES/availability; CONCEPT (canonical_variant_id).

### INV-06 — SQL de drift e runbook referenciados não existem em disco
* **Descrição:** `rebuild-inventory-balances.ts:10-11` aponta `sql/inventory_balances_drift_vs_movements.sql`, `sql/inventory_reserved_exceeds_onhand.sql`, `docs/runbooks/inventory-semantics.md` — **nenhum existe**. O comparador TS (`compareBalancesVsMovements`) existe e funciona; as refs são dangling.
* **MTP/Público/Dinheiro:** NÃO · **Modo:** MODO B · **Handoff:** NONE.

### VIS-01 — Visibilidade fail-closed forte (DECISION-0117): produto não aparece sem ser vendável
* **Descrição:** `listVisibleProducts` exige: canônico `INDUSTRIAL` + READY (`sqlCanonicalIndustrialOperationalReady`) + visível ao tenant; `product_offers.is_active AND status='active'`; estoque **do merchant da oferta** (actor-scoped, unidade consistente — sem soma tenant-wide, DT-INVENTORY-...-TENANT-WIDE CLOSED) `> 0`; merchant EMPRESA só com `kyb_status='approved'` + publicação institucional ATIVA (PF = contrato legado). Estoque zero: oferta não é apagada, só fica indisponível. Draft não vaza (status='active' obrigatório).
* **Resposta Q11:** **NÃO** — produto não pode ser vendido/exibido sem estoque/preço/seller/concept/KYB.
* **MTP/Público/Dinheiro:** NÃO · **Modo:** FAST-PATH · **Handoff:** NONE.

### MKTCHK-03 — Discovery de produto no /marketplace/search é services-only ⚠️ não re-verificado adversarialmente
* **Descrição:** `/marketplace/search` → `marketplaceSearchService.search` consulta `servicesRepository.discoverServices` e retorna serviços. **Produtos não têm superfície de discovery** (sem card/detalhe/seleção de variante via busca). Surface de produto só existe store-scoped (`/marketplace/store/:storeId/products`, exige storeId conhecido) + sinal read-only `product-demand`. Rotas nomeadas `marketplace-catalog/checkout/orders.routes` são **stubs TODO vazios**.
* **MTP:** PARCIAL · **Público:** PARCIAL · **Dinheiro:** NÃO · **DECISION:** sim · **Modo:** MODO B · **Handoff:** IA-MARKETPLACE-JORNADA.

### MKTCHK-01 — Order path canônico para em SUBMITTED; dinheiro fora (DINHEIRO_FORA/HOLD)
* **Descrição:** `POST /intent/execute` é o único path persistido vivo: cria DRAFT → reserva estoque (inventory_reservations) em transação → `submitOrder` → SUBMITTED, e para. Sem charge/ledger/split/payout/payment_intent (grep money-terms = nenhum). `order.service.ts` é explícito: "Não baixa estoque, Não integra com Bank ou pagamento". Status machine não tem 'paid'. Autoridade fail-closed (actorId = HINT, DECISION-0113/0131). Legado in-memory (`/marketplace/order|checkout|payment-plan`) é default-DISABLED (410 Gone) e `executePaymentPlan` lança `LEGACY_FINANCIAL_PATH_DISABLED`.
* **Classificação dinheiro:** **DINHEIRO_FORA** (path canônico) — fronteira de dinheiro é o SUBMITTED; settlement pós-SUBMITTED **inexistente**.
* **MTP/Público:** NÃO · **Dinheiro:** HOLD · **Modo:** HOLD · **Handoff:** IA-DINHEIRO.

### CART-01 — DECISION-0108 promulgada E guard-fix executado (DT CLOSED); produto×serviço separados
* **Descrição:** DECISION-0108 (governança de produto PJ por categoria/ramo) está PROMULGADA e o code-fix `F-PJ-PRODUCT-CONCEPT-GUARD-LAYER-FIX` foi **executado** (`20260605...`): guard trocou comparação item×vendor por recorte categoria/ramo; **`DT-PJ-PRODUCT-CONCEPT-GUARD-PRE-0105-LAYER-CONFLATION` → CLOSED** (e2e 13/13: supermercado materializa banana, farmácia rejeita banana, empresa vence tenant). Pendente apenas Op2 (supermercado ativa mix em product_offers) aguardando go do Clayton. Produto×serviço×locação: produto usa estoque/inventory; serviço tem track próprio (`service_offerings` com price_cents BIGINT, `service_id` mandatório — `20260613160000`/`20260621120000`); locação/assinatura não materializadas como produto. **Mistura indevida: NÃO** — caveat PARCIAL apenas no enum `sale_unit` compartilhado (INV-05).
* **MTP/Público/Dinheiro:** NÃO · **Modo:** FAST-PATH · **Handoff:** IA-DECISOES-DT (Op2 sequência); IA-OFERTA/IA-TEMPO (sale_unit serviço).

---

## 6. Gaps de conexão

1. **Produto ↔ Marketplace (discovery):** produtos não entram no `/marketplace/search` (services-only); sem card/detalhe/seleção de variante; rotas catalog/checkout/orders são stubs. **Maior gap funcional do eixo.** → IA-MARKETPLACE-JORNADA.
2. **Order ↔ Dinheiro:** path canônico para em SUBMITTED; não há settlement/charge/ledger pós-pedido. → IA-DINHEIRO (HOLD).
3. **Reserva ↔ Fulfillment:** OUT no ship não re-trava nem revalida on-hand (INV-03) — oversell fora do gate de reserva. → ORDER/FULFILLMENT.
4. **Criação ↔ KYB:** criação de produto/oferta não exige KYB (só publicação/discovery). → IA-EMPRESA-PJ.
5. **Variant ↔ Serviço:** `sale_unit` admite hour/service em `product_variants` — fronteira produto×serviço borrada. → IA-OFERTA/IA-TEMPO.
6. **Reserva ↔ Worker:** sem varredura de reservas expiradas (INV-04). → automation worker.
7. **Docs ↔ Realidade:** refs stale de "RFC-003 price NUMERIC" + SQL/runbook de drift inexistentes. → IA-DECISOES-DT.

---

## 7. Handoffs para outras IAs

* **IA-CADASTRO-ONBOARDING:** — (nenhum direto).
* **IA-PERFIL-SSOT:** — .
* **IA-ACTOR:** seller = actor (`merchant_id`/`created_by_actor_id`); confirmação de ensureUserActor no path de oferta.
* **IA-AUTORIDADE:** SELLER-05 (KYB na criação vs publicação); modelo canRepresentActor/canManageCompany.
* **IA-EMPRESA-PJ:** SELLER-05 (KYB-at-creation); DECISION-0108 Op2 supermercado; `companies.primary_company_type_id` como fonte.
* **IA-SEMANTICA:** SEMANTIC-01/03 (concept SSOT; category=navegação); fila de resolução de concept.
* **IA-OFERTA:** fronteira product_offers × service_offerings; sale_unit hour/service; canonical_variant binding.
* **IA-TEMPO:** RFC-003 real = Time-Service (PENDENTE); sale_unit 'hour'/'service' (booking).
* **IA-MARKETPLACE-JORNADA:** MKTCHK-03/04 (discovery de produto, card/detalhe/seleção, stubs catalog/checkout/orders, E2E live).
* **IA-COMERCIO-CONTRACT:** contrato produto vs serviço vs locação vs assinatura (separados; sale_unit blur).
* **IA-LOCACOES-RECURSOS:** locação não modelada como produto (confirmar trilho próprio).
* **IA-ASSINATURAS-RECORRENCIA:** assinatura/entitlement fora do eixo produto.
* **IA-FRONTEND-UX-CONTRATOS:** telas de produto/criação/edição/listagem/detalhe/variante (não auditadas).
* **IA-BANCO:** confirmar conversão price→order_item snapshot→ledger permanece cents-clean.
* **IA-DINHEIRO:** MKTCHK-01 (settlement pós-SUBMITTED inexistente); INV-03 (settlement de oversold). **HOLD.**
* **IA-DECISOES-DT:** docs stale RFC-003-preço; DECISION-0108 Op2; SQL/runbook drift inexistentes.

---

## 8. Riscos para MTP

* **Bloqueia MTP (parcial):** discovery de produto no marketplace (MKTCHK-03) + rotas catalog/checkout/orders stub — sem jornada pública de compra de produto; E2E live nunca rodado (0 linhas).
* **Não bloqueia mas corrigir:** INV-03 (negative-stock fora da reserva); SELLER-05 (KYB na criação — decisão).
* **V2:** estoque consolidado multi-loja, lots/SLA/holding-cost (presentes, não no caminho crítico).
* **Cleanup:** INV-04 (worker de expiração), INV-06 (SQL/runbook drift), PLU unique, docs stale RFC-003.
* **Exige decisão de produto/arquitetura:** KYB-at-creation (SELLER-05); sale_unit serviço em product_variants (INV-05); contrato de negative-stock no fulfillment (INV-03).

---

## 9. Riscos para público e dinheiro

* **Blockers antes de público:** jornada de discovery/detalhe de produto (MKTCHK-03); implementar rotas catalog/checkout/orders (hoje stubs).
* **Blockers antes de dinheiro:** settlement pós-SUBMITTED (MKTCHK-01) — não existe; **toda a fronteira de dinheiro de produto é IA-DINHEIRO**.
* **Blockers de estoque:** INV-03 (re-lock/recheck no OUT do fulfillment) antes de qualquer venda real.
* **Blockers de preço:** **nenhum** — preço cents/BIGINT consolidado.
* **Exigem DECISION:** SELLER-05 (KYB criação); INV-03 (negative-stock); INV-05 (sale_unit serviço).
* **Exigem MODO C:** ponte checkout→dinheiro (MKTCHK-01) quando dinheiro sair de HOLD.
* **Permanece HOLD:** todo o handoff de dinheiro (settlement/charge/ledger/split/payout). Legado in-memory permanece DISABLED.

---

## 10. Veredito final

**FECHA_COM_RISCO.**

O substrato de produto/estoque é **materialmente coerente e bem-governado** nos elos fundamentais: semântica por concept_id (SSOT `concepts`, legado deprecado), preço 100% cents/BIGINT (RFC-003-preço era stale; RFC-003 real é Time-Service), seller server-side fail-closed sem spoof, cross-tenant bloqueado, estoque append-only SSOT com reserva concorrente sólida (FOR UPDATE + locks ordenados), e visibilidade fail-closed (READY+offer ativa+estoque>0+KYB/publicação, DECISION-0117). DECISION-0108 promulgada e seu guard-fix executado/CLOSED. Produto e serviço são contratos separados.

Os **riscos** que impedem "FECHA" pleno: (1) discovery de produto ausente no marketplace (services-only) + rotas catalog/checkout/orders stub; (2) negative-stock fora do gate de reserva no fulfillment (INV-03); (3) KYB não exigido na criação (SELLER-05); (4) camada comercial nunca exercida com dado vivo (0 linhas); (5) higiene (worker de expiração, PLU unique, SQL/runbook drift, docs stale, sale_unit blur). Dinheiro está corretamente quarentenado (HOLD) — o handoff de settlement é frente da IA-DINHEIRO.

---

## 11. Próxima frente recomendada

**Primária: `HANDOFF_MARKETPLACE` (MODO B)** — o maior gap funcional e o que bloqueia público/MTP é a **jornada de discovery de produto** (search services-only, sem card/detalhe/seleção de variante, rotas catalog/checkout/orders stub). É design+wiring, não decisão. Justificativa: o substrato (semântica/preço/seller/estoque/visibilidade) já fecha; falta a superfície que liga o produto vendável ao público.

**Paralela menor: `MODO_B_INVENTORY_CONTRACT`** — fechar INV-03 (re-lock/recheck no OUT do fulfillment, fail-closed contra negative-stock) + INV-04 (worker de expiração) + INV-06 (SQL/runbook). Toca substrato sensível (estoque) → exige prova e, para INV-03, uma DECISION leve + YALA.

**Decisão-dependente (não executora-autônoma):** `DECISION` sobre KYB-at-creation (SELLER-05, com IA-EMPRESA-PJ) e sale_unit-serviço (INV-05, com IA-OFERTA).

**Dinheiro: HOLD** — settlement pós-SUBMITTED permanece com IA-DINHEIRO.

---

## 12. Resumo executivo

* **Veredito: FECHA_COM_RISCO.** Substrato sólido; gaps são de jornada/higiene/decisão, não de fundação.
* **Preço: resolvido.** 4 tabelas em `price_cents` BIGINT; zero NUMERIC de preço. **RFC-003-preço é STALE** — o RFC-003 real (`18_DOMAIN_ONTOLOGY §12`) é **Time-Service**, não dinheiro.
* **Semântica: fecha.** concept_id é identidade material (SSOT `concepts`); category é navegação/elegibilidade (DECISION-0108).
* **Seller: fail-closed.** Autoridade server-side (canRepresentActor/canManageCompany); body é hint; cross-tenant bloqueado. **Mas KYB não é exigido na criação** (só publicação) — decisão (SELLER-05).
* **Estoque: canônico e seguro.** Movements append-only SSOT, balanço é cache, reserva com FOR UPDATE + locks ordenados. **Risco: OUT de fulfillment não revalida on-hand** (INV-03) → negative-stock fora da reserva.
* **Visibilidade: fail-closed forte** (DECISION-0117) — produto não aparece sem READY+offer+estoque>0+KYB/publicação. Q11 = NÃO.
* **Marketplace: maior gap.** Discovery é services-only; produtos sem card/detalhe/seleção; catalog/checkout/orders são stubs.
* **Dinheiro: quarentenado (HOLD).** Order canônico para em SUBMITTED; zero ledger/split/payout; legado in-memory disabled (410). Settlement = IA-DINHEIRO.
* **Produto×serviço: separados.** Serviço tem track/oferta próprios; caveat só no `sale_unit` que admite hour/service (INV-05).
* **DECISION-0108: fechada** (guard-fix executado, DT CLOSED 13/13); pendente só Op2 supermercado aguardando go. Camada comercial tem 0 linhas (nunca exercida live).

---

> Auditoria READ-ONLY. Nenhum código/runtime/migration/dinheiro/cartório alterado. Nenhum commit. Verificações adversariais de INV-03/MKTCHK-03/SELLER-05 foram interrompidas por limite de sessão — marcadas como não re-verificadas; recomenda-se re-rodar a verificação antes de abrir frente sobre elas.
</content>
</invoke>
