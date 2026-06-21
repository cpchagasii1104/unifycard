# respostas/IA-COMERCIO.md — IA-COMERCIO (append-only)

> Eixo ESTADO/MATERIAL: PEDIDOS (orders/service_orders/booking_decisions) · ESTOQUE/CATÁLOGO
> (canonical_products/variants/inventory/product_offers). READ-ONLY. Insumo, nunca GO.
> Escrevo só este arquivo + `docs/memorias/MINHA_MEMORIA_COMERCIO.md`.

---

## RODADA 7 — F-PROFILE-PJ-OFFER-CONFIGURATION-READINESS · sombra material (READ-ONLY mapa)

**(1) HEAD vivo no momento:** `9f5e9c5e` (branch `rescue-structural`) — verificado de 1ª mão via `git rev-parse` (NÃO o `dd270f41` citado no gatilho; o gatilho estava stale — disco venceu). Commits novos desde `dd270f41`: `2a0d3c21` (widen concept_relations 3→6 / U1), `6c93c648` (reindex DECISOES A1), `9f5e9c5e` (seed needs-graph U1b / DECISION-0142).

**(2) Revalidou no disco/banco:** **parcial** — substrato de schema lido de 1ª mão nas migrations; prova-viva de runtime (rowcounts, se `product_offers.price` ainda é NUMERIC vivo, se `product_concept_id`/`canonical_variant_id` populados, drift movements×balances, trigger habilitado) → **INCONCLUSIVE → IA-BANCO**.

**(3) Arquivos lidos (1ª mão):**
- `backend/migrations/20260412000000_canonical_products_baseline.sql` (canonical_products)
- `backend/migrations/20260425120000_product_concepts.sql` (camada semântica de produto SEPARADA)
- `backend/migrations/20260611150000_canonical_variants_services_units_foundation.sql` (canonical_units/variants/services — DECISION-0117)
- `backend/migrations/20260611180000_offerings_variant_sku_service.sql` (product_offers↔variant + service_offerings)
- `backend/migrations/0112_create_tenant_products.sql` · `0122_product_offers.sql` · `20260526101000_draft_ms2_tenant_products_price_cents_append_only.sql`
- `backend/migrations/0102_inventory_movements.sql` · `0103_inventory_balances.sql` · `20260411120000_inventory_movements_actor_id.sql`

---

**(4) MATRIZ — sombra material (`SUPERFÍCIE | O QUE DECLARA | QUEM ESCREVE | SSOT/READ-MODEL | ACTOR/OWNER | CONCEPT_ID? | AUTORIDADE | TEMPO | RISCO | RECOMENDAÇÃO`)**

| SUPERFÍCIE | O QUE DECLARA | QUEM ESCREVE | SSOT/READ-MODEL | ACTOR/OWNER | CONCEPT_ID? | AUTORIDADE | TEMPO | RISCO | RECOMENDAÇÃO (mapa) |
|---|---|---|---|---|---|---|---|---|---|
| `canonical_services` (`20260611150000:116-120`) | identidade canônica de SERVIÇO | curadoria/seed governado | SSOT (global/scoped) | tenant (scope) | **SIM — `concept_id NOT NULL → concepts(concept_id)` ON DELETE RESTRICT** (Lei 7) | scope tenant | n/a | baixo — **referência do padrão correto** | é o espelho que o lado material deveria seguir |
| `canonical_products` (`20260412000000:11-24`) | catálogo industrial canônico | curadoria | SSOT (por tenant) | tenant | **NÃO — `category_id → categories`** + opcional `product_concept_id → product_concepts` (namespace SEPARADO) | RLS tenant | n/a | **ALTO — category-keyed + concept paralelo ≠ domain concepts (fura 0142)** | mapear; converger p/ domain `concepts` antes de cruzar serviço×material por concept |
| `product_concepts` (`20260425120000:6-15`) | "identidade semântica de trade item" | pipeline atribuição (futuro) | SSOT paralelo (global, sem tenant) | — | **namespace PRÓPRIO** ("distinct from domain table `concepts`"; link opcional, "null until pipeline runs") | — | n/a | **ALTO — 2ª árvore de concept p/ produto, não a folha-SSOT do 0142** | é a verdade paralela semântica do material; reconciliar com `concepts` |
| `canonical_variants` (`20260611150000:54-78`) | config material exata vendável (fingerprint/GTIN) | porta única (fingerprint_v1) | SSOT identidade material | `created_by_actor_id` (curadoria) | **NÃO — keyed por `canonical_product_id`+fingerprint** | — | n/a | médio — herda gap de concept do produto-pai | sem preço/estoque (corretamente) |
| `product_variants` (`0101` + ponte `20260611180000:62`) | SKU do tenant, **dono do estoque** | tenant/actor | SSOT SKU + ponte `canonical_variant_id` | **actor (estoque actor-scoped)** | indireto (via canonical_variant) | RLS tenant + owner | n/a | baixo | ponte canônica ok |
| `inventory_movements` (`0102:22-87`) | quantidade física (SSOT) | app (**só INSERT**) | **SSOT append-only** (trigger BEFORE UPD/DEL → RAISE) | **`actor_id` (ACTOR_PRIVATE, 0116)** + tenant | não (variant-keyed) | RLS tenant + actor_id | n/a | baixo — **bem guardado** | não tocar trigger; movimentar só por aqui |
| `inventory_balances` (`0103:24-45`) | saldo derivado | app (`INSERT…ON CONFLICT DO UPDATE`) | **READ-MODEL/projeção** | tenant | não | RLS tenant | n/a | baixo — comentário crava "SSOT=movements" | recalculável; nunca tratar como SSOT |
| `product_offers` (`0122` + `20260611180000:24-44`) | "merchant VENDE este produto/variante @preço" | merchant | SSOT de oferta (**paralela a service_offerings**) | **`merchant_id` (actor)** | **NÃO — `product_id → products` + `canonical_variant_id` (fingerprint)** | RLS tenant (canRepresentActor no app) | **n/a — sem availability owner p/ produto** | **ALTO — `price NUMERIC(12,4)`, RFC-003 pendente p/ cents (DRIFT vs service_offerings.price_cents BIGINT)** + não concept-keyed | mapear drift de tipo monetário; alinhar à régua price_cents |
| `tenant_products` (`0112` + `20260526101000`) | "tenant carrega este catalog_product @preço" | tenant | SSOT (par adicional) | tenant | **NÃO — `catalog_product_id → catalog_products` (3ª tabela de produto)** | RLS tenant | n/a | **ALTO — 3 SSOTs de produto coexistindo: products / catalog_products / canonical_products** | inventariar qual é canônico; resto vira read-model/ponte |
| `service_offerings` (`20260611180000:67-84`) | "prestador OFERECE serviço canônico @preço" | prestador | SSOT oferta de serviço | `provider_actor_id` (actor) | **SIM — via `canonical_service_id → canonical_services.concept_id`** | canRepresentActor (app) | **`unified_availability owner='service_offering'`** | baixo — **padrão correto** | é o contrato onde o slot material deve pendurar |

---

**FOCO 2 — cruzar SERVIÇO × RECURSO MATERIAL exigido (ex.: troca-de-óleo → modelo/ano → óleo/peça compatível):**
**100% GREENFIELD.** Não existe no disco: nenhuma tabela de BOM / "service requires product" / receita / **compatibilidade/fitment (modelo/ano)**. Grep por `bill_of_material|requires_product|required_material|service_requires|compatib|fitment` → zero substrato relacional (hits são falsos positivos: `account_type`, `actor_requires_identity`). O único `*_requires_canonical` (`20260505100000`) é "produto exige link canônico", NÃO um BOM. → O cenário futuro de Clayton tem **substrato ZERO** hoje.

**FOCO 5 — SLOT DE PREVISÃO p/ F-OFFER (mapa, NÃO implementar):**
O gancho a DEIXAR PRONTO é um vínculo **opcional, aditivo, nullable e CONCEPT-KEYED** de "recurso/material exigido" pendurado no contrato do `service_offering` (e propagável a booking/service_order), referenciando a **MESMA folha-concept de `concepts(concept_id)`** que o 0142 consagra (ex.: "óleo 5w30" = folha-concept) — para casar por `concept_id`, **NUNCA por category/fingerprint/GTIN**. **Onde NÃO colocar:** dentro de `service_offerings.conditions jsonb` / `location jsonb` (jsonb não tem FK nem matching — viraria verdade frouxa). **Por que é só SLOT e não resolve hoje:** o lado material **não é concept-keyed ao domain `concepts`** (usa category + `product_concepts` paralelo) → o gancho pode ser *reservado* no desenho, mas só *resolve* depois que `canonical_products`/`product_concepts` convergirem para `concepts`. Pré-acoplamento de **DESENHO**, gated, conforme a CARTA (METODO §36-51).

---

**(5) VEREDITO: `PARTIAL`** (com sub-achado `BLOCKER-se-construído-agora` no cruzamento por concept).
- Eixo **ESTOQUE/INVENTÁRIO** = sólido e bem-guardado (append-only SSOT, projeção rotulada, ACTOR_PRIVATE) — PASS no seu próprio domínio.
- Eixo **CATÁLOGO/OFERTA de produto** = **PARTIAL/BLOCKER**: 3 SSOTs de produto paralelos + drift de tipo monetário (NUMERIC×BIGINT) + **não concept-keyed** (fura 0142) → cruzar serviço×material por concept **não é possível hoje** sem convergência prévia.
- O **slot** do F-OFFER pode ser reservado agora (barato, aditivo); a **resolução** depende da convergência material → concepts.

**(6) VERDADES PARALELAS (eixo material):**
1. **Concept paralelo:** `product_concepts` (namespace próprio, opcional) ≠ `concepts` (folha-SSOT do 0142). Serviço unificou em `concepts`; produto NÃO.
2. **3 tabelas de produto:** `products` (product_offers) · `catalog_products` (tenant_products) · `canonical_products` (canonical_variants) coexistindo como possíveis SSOTs.
3. **Drift de tipo monetário:** `product_offers.price NUMERIC(12,4)` (RFC-003 pendente) × `service_offerings.price_cents BIGINT` × `tenant_products` já migrado p/ cents.
4. **Keying divergente da oferta:** `service_offerings` casa por `canonical_service_id`(→concept); `product_offers` casa por `product_id`/`canonical_variant_id`(fingerprint/category).

**(7) STOPs para F-OFFER:**
- **NÃO** baquear requisito de material em `conditions jsonb` — reservar gancho **relacional concept-keyed** (FK a `concepts`), nullable/aditivo.
- **NÃO** cruzar serviço×material por category/domain/fingerprint — só por `concept_id` (invariante 0142).
- **NÃO** deixar o F-OFFER nascer escrevendo preço de produto em NUMERIC — herdar a régua `price_cents BIGINT`.
- **NÃO** criar 4º SSOT de produto/oferta — antes, declarar qual das 3 tabelas é canônica (resto = read-model/ponte).
- **NÃO** deduzir estoque fora de `inventory_movements`; balance é projeção; trigger append-only intocável.
- Pedido/oferta **NÃO** toca `bank_ledger` (IA-DINHEIRO, a jusante); gate `canRepresentActor` ANTES de mutar.

**FRONTEIRA:** cruza com **IA-OFERTA** (o paralelo serviço↔produto na camada de oferta) · **IA-SEMANTICA** (`product_concepts` vs `concepts` / 0142) · **IA-AUTORIDADE** (gate antes da oferta material) · **IA-DINHEIRO** (drift price NUMERIC×cents — sinalizado, não liquido) · **IA-BANCO** (prova-viva: rowcounts, tipo vivo de `price`, populamento de `product_concept_id`/`canonical_variant_id`, drift movements×balances, trigger habilitado).

**Status: RESPONDIDO** (mapa de readiness + riscos + slot entregue; prova-viva de runtime declarada INCONCLUSIVE → IA-BANCO). **Nenhuma edição de código/migration/banco/cartório. Não propus implementação — só readiness, riscos e slot de desenho.**

---
