# ADENDO DE DECISÃO — F-ASSET-MULTI-OFFER-FOUNDATION · FATIA 3 · VENDA ASSET-FIRST

**Tipo:** Adendo docs-only (ratificação de decisão soberana antes de implementar).
**Status:** RATIFICADO por Clayton/Guardião. Implementação AGUARDA GO próprio.
**Base:** HEAD `59494bbb7` · Fatia 1 SELADA · Fatia 2b (locação) SELADA · Condição+mínimo SELADA · READ-FIRST
da venda asset-first entregue · sistema VIRGEM (products=0, product_offers=0, actor_assets=0).
**Vínculo:** adendo de [[RFC_ASSET_MULTI_OFFER_FOUNDATION]] (§5 item 4: "vender UNIDADE usada do actor =
actor_assets + modo sale, não recadastrar"). Irmão de [[RFC_ASSET_CONDITION_AND_RENTAL_MINIMUMS_ADENDO]].
**Escopo:** desenho da VENDA de bem durável individual do actor como CAMADA asset-first.
**Δbank=0. Sem transferência de propriedade, sem checkout, sem orders, sem Bank, sem Fase C.**

---

## Contexto do READ-FIRST (o que a auditoria de 1ª mão provou)

- **Modo `'sale'` já existe** em `ASSET_ACTIVATION_MODES` + CHECK de `actor_asset_modes` (UNIQUE asset_id+mode,
  FK cascade). **Camada de venda 100% ausente:** ZERO tabela `sale_terms`, ZERO uso de `activation_mode='sale'`.
- **Camada de produtos está limpa e separada:** `products`/`canonical_products` (catálogo) ↔ `product_variants`
  (SKU) ↔ `inventory_movements` (SSOT de estoque, append-only) ↔ `product_offers` (oferta do comerciante).
- **Publicar produto é PJ-ONLY** (DECISION-0155: PF/`actor_type='user'` → 403 `PRODUCT_PUBLISH_PJ_ONLY` nos dois
  caminhos; `merchant_id` derivado server-side, W1). `product_offers` representa oferta de ESTOQUE/comerciante.
- **Não há fluxo de item usado/classificado.** Checkout/orders são STUB; `payment_intents` é pré-financeiro,
  não wired. `concept_asset_eligibilities` (SELADA) é o gate material de durabilidade — o MESMO da locação.
- **Fronteira já escrita na norma** (RFC §5): unidade-do-actor (durável individual) vs catálogo-de-mercadoria.

---

## Decisões ratificadas

### D-α — Venda asset-first permite PF **e** PJ
- Autoridade = `canRepresentActor` sobre `actor_assets.owner_actor_id`. **NÃO** usa `merchant_id`; **NÃO** exige
  loja/empresa para item individual. Tenant + RLS continuam obrigatórios.
- **Ratificação:** DECISION-0155 / `PRODUCT_PUBLISH_PJ_ONLY` governa publicação de PRODUTO/ESTOQUE via
  `products`/`product_offers`. **NÃO** governa venda asset-first de item individual do actor.
- Motivo: venda asset-first cobre classificados/usados/itens individuais — inclusive PF vendendo sofá,
  videogame, bicicleta, carro, ferramenta ou piscina de bolinha. A locação já abriu PF por `canRepresentActor`.

### D-β — Read-model/badge dedicado
- Contador próprio (conceitual `countActiveAssetSales`) que lê `actor_assets` + `actor_asset_modes('sale')` +
  `actor_asset_sale_terms`. A actor-page **NÃO** conta venda asset-first em `product_offers` (que segue sendo
  oferta de produto/estoque). NÃO criar badge baseado em `products`/`product_offers` para item individual.

### D-γ — Transferência de propriedade FORA da v1
- A Fatia 3 **NÃO** resolve: transferência de propriedade · item vendido/baixa definitiva · conflito com
  locações futuras · contrato de compra e venda · pagamento · checkout · escrow · Bank · split · orders ·
  payment_intents.
- `actor_asset_sale_terms` é ANÚNCIO/termo comercial da venda — não é acordo fechado, não é pagamento, não é
  transferência jurídica. Status `sold` FORA da v1 (implica execução/transferência).

### D-δ — Escopo mínimo de termos de venda v1
- Nova camada **`actor_asset_sale_terms`**. Modelo recomendado:
  `asset_id` PK/FK 1:1 → `actor_assets` (ON DELETE CASCADE) · `price_cents` BIGINT (ANÚNCIO, Δbank=0) ·
  `status` governado (D-ε) · `is_active` (padrão rental_terms) · `visibility` · `audience_relationship_types`
  (plateia governada) · `negotiable` BOOLEAN · `sale_notes`/`commercial_notes` opcional · timestamps.
- **FORA da v1:** entrega/handoff · visita/test-drive · garantia · parcelamento · proposta/oferta do comprador
  · contrato · checkout · pagamento · split · transferência de propriedade.
- Preço: `price_cents` = snapshot/anúncio comercial. **Não toca Bank.** (Venda = preço único; tiers de
  locação NÃO se aplicam.)

### D-ε — Status da oferta de venda
- Vocabulário v1: **`ASSET_SALE_STATUSES = ['active', 'paused']`**. NÃO usar `sold`/`completed`/`paid`/
  `transferred` na v1. Não misturar status de venda com status do item: `actor_assets.status` = lifecycle do
  item; `actor_asset_modes.activation_mode='sale'` = MODO, não status. Anúncio inativo = `paused` ou desativar
  o modo `sale`, conforme a implementação justificar.

### D-ζ — Módulo/código
- Venda asset-first **NÃO** deve ser implementada dentro do módulo `rentals` como se fosse locação. `rentals`
  serve como REFERÊNCIA de padrão; `core/assets` pode ser reutilizado; mas a VERDADE de venda fica em módulo/
  domínio próprio (asset sale / actor asset sale), conforme a executora justificar. NÃO colocar regra de venda
  em `product_offers`. NÃO transformar `rentals` em módulo genérico clandestino.

---

## Regras ontológicas (fronteira)

**Venda asset-first aplica-se a** bem DURÁVEL, identificável, reutilizável, unidade real do actor, item onde a
unidade física importa: carro, bicicleta, imóvel, videogame físico, sofá, ferramenta, equipamento, máquina,
cadeira de barbeiro, cadeira odontológica, elevador de mecânico, piscina de bolinha.

**NÃO aplica a** (seguem em `products`/`canonical_products`/`product_variants`/`inventory`/`product_offers`):
alimento, bebida, ingrediente, remédio consumível, descartável, macarrão, arroz, SKU comum, lote de estoque,
mercadoria de giro, produto comum de varejo. Gate material da fronteira = `concept_asset_eligibilities`
(por CONCEPT, global, SELADO). **`category_id` NÃO decide** — classifica, não governa comportamento.

## Camadas ratificadas

| Papel | Verdade |
|---|---|
| Item real | `actor_assets` |
| Ativação de venda | `actor_asset_modes.activation_mode = 'sale'` |
| Termos da venda | `actor_asset_sale_terms` (NOVA) |
| Condição do item | `actor_assets.condition` (new/used, SELADO) |
| Conceito/elegibilidade durável | `concept_asset_eligibilities` (GLOBAL, SELADO) |
| Produto comum/SKU/estoque | `products` / `canonical_products` / `product_variants` / `inventory` / `product_offers` |

## Proibições

Usar `product_offers` como SSOT de item individual · criar `product` paralelo para representar asset à venda ·
duplicar o mesmo item em `products` e `actor_assets` · pôr preço de venda em `actor_assets` · pôr preço de
venda em `actor_asset_modes` · pôr `condition` em `actor_asset_sale_terms` · usar `category_id` para decidir
se algo pode ser asset sale · transformar SKU/perecível/consumível em `actor_asset` · tocar Bank/ledger/
bank_transactions/bank_accounts/split/checkout/orders/payment_intents · tocar rides/service_use/RFQ/
service_demands · abrir Fase C.

---

## Implementação futura (SÓ com GO próprio — não faz parte deste adendo)

1. Criar `actor_asset_sale_terms` (asset_id PK/FK 1:1, price_cents anúncio, status, visibility, audience,
   negotiable, notes, timestamps).
2. Ativar venda via `actor_asset_modes('sale')`.
3. Usar `concept_asset_eligibilities` como gate de durabilidade.
4. Permitir PF e PJ via `canRepresentActor(owner_actor_id)`.
5. **NÃO** herdar `PRODUCT_PUBLISH_PJ_ONLY`.
6. **NÃO** reaproveitar `product_offers` como tabela de asset sale.
7. Manter `products`/`product_offers`/`inventory` intactos.
8. RLS ENABLE + FORCE em `actor_asset_sale_terms` (policy derivada via EXISTS actor_assets, sem tenant_id
   denormalizado). `concept_asset_eligibilities` segue GLOBAL.
9. Criar vocabulários governados necessários (`ASSET_SALE_STATUSES` etc.) + manifest.
10. Criar guards anti-regressão (ver abaixo).
11. Registrar API/contrato antes de rota pública (API_CONTRACT_GOVERNANCE), contrato-primeiro.
12. Manter Δbank=0. Migration additiva forward-only, sistema virgem (sem backfill).

## Guards futuros (a implementação deve falhar se…)

- `actor_asset_sale_terms` existir sem `asset_id` PK/FK;
- venda asset-first criar `product` paralelo;
- `product_offers` virar SSOT de item individual;
- `actor_asset_modes='sale'` tiver preço;
- `actor_assets` tiver `price_cents` de venda;
- `condition` aparecer em `sale_terms`;
- `category_id` decidir elegibilidade;
- SKU/perecível/consumível virar `actor_asset`;
- sale tocar Bank/ledger/payment/split/checkout/orders/payment_intents;
- status `sold`/`completed`/`paid`/`transferred` entrar na v1;
- RLS faltar em `actor_asset_sale_terms`;
- frontend hardcodar status/modos/vocabs;
- actor-page contar asset sale em `product_offers`;
- products/rides/service_use/RFQ/service_demands/Fase C forem tocados.

---

## STOP deste adendo
Docs-only. Nenhum código, migration, frontend, contrato ou banco tocados. A implementação começa apenas com GO
próprio, seguindo D-α..D-ζ, a fronteira ontológica e os guards acima.
