# sistema/comercio — ACHADOS (destilado da Rodada 7 · cadeia-de-oferta)

> Etapa COMÉRCIO/MATERIAL (estoque/catálogo/oferta-produto/pedidos). Fonte: IA-COMERCIO/IA-BANCO · DECISION-0116/0117/0122.

## Sólido (PASS no próprio domínio)
- **`inventory_movements`** = SSOT append-only (trigger BEFORE UPD/DEL → RAISE; ACTOR_PRIVATE 0116; triggers HABILITADOS). Movimentar SÓ por aqui.
- **`inventory_balances`** = read-model/projeção (SSOT=movements; recalculável; nunca tratar como verdade).

## Catálogo/oferta-produto (PARTIAL — espelha a doença do serviço, pior)
- **`product_offers`** = SSOT oferta-produto. `merchant_id` (actor). `price_cents` = **BIGINT** (já migrado; o "NUMERIC/RFC-003" era stale). **NÃO concept-keyed** (`product_id`/`canonical_variant_id` por fingerprint/category). Sem availability-owner de produto.
- **`canonical_products`** = 35 linhas; category-keyed (+ `product_concept_id` que **não existe vivo**) → fura 0142.
- AUSENTES (ghosts): `tenant_products`, `catalog_products`, `product_concepts`. → "3 SSOTs de produto" é em grande parte fantasma; declarar o canônico antes de evoluir.

## service × material = 100% GREENFIELD
- Zero substrato de BOM / "service requires product" / compatibilidade/fitment (modelo/ano).
- **SLOT de previsão (reservar AGORA, só desenho):** gancho **nullable/aditivo/concept-keyed** (FK → `concepts(concept_id)`) de "material exigido" pendurado no contrato do `service_offering` (propagável a booking/order). NUNCA em jsonb; NUNCA por category/fingerprint. Resolve só quando o material convergir para `concepts` → **frente própria F-MATERIAL-CONVERGENCE**.
