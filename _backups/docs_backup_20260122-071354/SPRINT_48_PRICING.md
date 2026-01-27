# SPRINT 48: PRICING, PROMOÇÕES E COMISSÕES (DECLARATIVO)

## RESUMO EXECUTIVO

Implementado sistema declarativo de pricing:
- ✅ Tabelas `product_prices` e `promotions`
- ✅ `PricingService` para resolver preços com promoções
- ✅ Integração com Order (snapshot no metadata)
- ✅ Integração com PDV (consulta preço antes de criar order)
- ✅ Rotas REST para pricing

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/migrations/183_create_product_prices.sql`** (NOVO)
   - Tabela `product_prices`
   - Campos: `id`, `tenant_id`, `product_variant_id`, `price`, `currency`, `valid_from`, `valid_to`, `metadata`
   - RLS e índices

2. **`backend/migrations/184_create_promotions.sql`** (NOVO)
   - Tabela `promotions`
   - Campos: `id`, `tenant_id`, `name`, `type`, `value`, `applies_to`, `applies_id`, `valid_from`, `valid_to`, `is_active`, `metadata`
   - Enums: `promotion_type` (PERCENTAGE, FIXED), `promotion_applies_to` (VARIANT, CATEGORY, PRODUCT)
   - RLS e índices

3. **`backend/src/modules/marketplace/pricing.types.ts`** (NOVO)
   - Tipos TypeScript para pricing
   - `ProductPrice`, `Promotion`, `PriceBreakdown`, `PricingContext`, inputs

4. **`backend/src/modules/marketplace/product-price.repository.ts`** (NOVO)
   - Repository para preços
   - Métodos: `createPrice`, `getCurrentPrice`, `listPricesByVariant`

5. **`backend/src/modules/marketplace/promotion.repository.ts`** (NOVO)
   - Repository para promoções
   - Métodos: `createPromotion`, `getApplicablePromotions`, `listPromotions`

6. **`backend/src/modules/marketplace/pricing.service.ts`** (NOVO)
   - Service principal para pricing
   - Métodos: `getCurrentPrice`, `createPrice`, `getBasePrice`, `listPricesByVariant`, `createPromotion`, `listPromotions`

7. **`backend/src/modules/marketplace/order.service.ts`** (ALTERADO)
   - `addItem()` resolve preço ANTES de criar item
   - Snapshot de preço salvo no `metadata` do item

8. **`backend/src/modules/marketplace/marketplace.routes.ts`** (ALTERADO)
   - Rotas REST:
     - `GET /marketplace/pricing/variant/:variantId` (obter preço com promoções)
     - `POST /marketplace/pricing/prices` (criar preço)
     - `GET /marketplace/pricing/prices?variantId=...` (listar preços)
     - `POST /marketplace/pricing/promotions` (criar promoção)
     - `GET /marketplace/pricing/promotions` (listar promoções)

9. **`backend/src/modules/marketplace/index.ts`** (ALTERADO)
   - Exporta `pricingService`, `productPriceRepository`, `promotionRepository` e tipos

## REGRAS ARQUITETURAIS

### ✅ Preço Resolvido ANTES do Pedido

- Preço é calculado quando item é adicionado ao pedido
- Snapshot salvo no `metadata` do item
- Não recalcula após criado

### ✅ Não Recalcula Pagamento Após Criado

- Preço final é snapshot no order metadata
- PaymentIntent usa valor já resolvido
- Não altera orders já criados

### ✅ Promoção Não Altera Venda Passada

- Promoções aplicadas apenas no momento da resolução
- Snapshot preserva preço histórico
- Orders antigos não são afetados

## FLUXO DE PRICING

### 1. Resolver Preço

```typescript
// PricingService.getCurrentPrice()
1. Buscar preço base da variante
2. Buscar produto e categoria
3. Buscar promoções aplicáveis
4. Aplicar promoções (PERCENTAGE ou FIXED)
5. Retornar breakdown completo
```

### 2. Adicionar Item ao Pedido

```typescript
// OrderService.addItem()
1. Resolver preço ANTES de criar item
2. Salvar snapshot no metadata do item
3. Criar item com preço já resolvido
```

### 3. Criar PaymentIntent

```typescript
// PaymentIntent usa preço do snapshot
// Não recalcula, apenas usa valor já resolvido
```

## TIPOS DE PROMOÇÃO

### PERCENTAGE

- Desconto percentual (ex: 10%)
- `value`: 0.0 a 100.0
- Cálculo: `(basePrice * value) / 100`

### FIXED

- Desconto fixo (ex: R$ 5,00)
- `value`: valor fixo
- Cálculo: `basePrice - value`

## APLICAÇÃO DE PROMOÇÕES

### VARIANT

- Aplica diretamente à variante
- `applies_id`: `product_variant_id`

### PRODUCT

- Aplica a todas as variantes do produto
- `applies_id`: `product_id`

### CATEGORY

- Aplica a todos os produtos da categoria
- `applies_id`: `category_id`

## ENDPOINTS

### GET /marketplace/pricing/variant/:variantId

Obtém preço atual com promoções aplicadas.

**Query params:**
- `quantity`: quantidade (opcional)
- `userId`: ID do usuário (opcional)
- `date`: data para resolução (opcional)

**Response:**
```json
{
  "basePrice": 100.00,
  "discountAmount": 10.00,
  "finalPrice": 90.00,
  "currency": "BRL",
  "promotions": [
    {
      "promotionId": "uuid",
      "promotionName": "Desconto 10%",
      "discountAmount": 10.00,
      "reason": "VARIANT: uuid"
    }
  ]
}
```

### POST /marketplace/pricing/prices

Cria preço de produto.

**Body:**
```json
{
  "productVariantId": "uuid",
  "price": 100.00,
  "currency": "BRL",
  "validFrom": "2024-01-01T00:00:00Z",
  "validTo": null
}
```

### POST /marketplace/pricing/promotions

Cria promoção.

**Body:**
```json
{
  "name": "Desconto 10%",
  "type": "PERCENTAGE",
  "value": 10.0,
  "appliesTo": "VARIANT",
  "appliesId": "uuid",
  "validFrom": "2024-01-01T00:00:00Z",
  "validTo": "2024-01-31T23:59:59Z",
  "isActive": true
}
```

## INTEGRAÇÃO COM ORDER

### Snapshot de Preço

```typescript
// order_item.metadata.priceSnapshot
{
  basePrice: 100.00,
  discountAmount: 10.00,
  finalPrice: 90.00,
  currency: "BRL",
  promotions: [...],
  resolvedAt: "2024-01-01T00:00:00Z"
}
```

### Garantias

- Preço é resolvido ANTES de criar item
- Snapshot preserva preço histórico
- Não recalcula após criado

## INTEGRAÇÃO COM PDV

### Consulta de Preço

```typescript
// PDV pode consultar preço antes de criar order
GET /marketplace/pricing/variant/:variantId?quantity=1
```

### Uso no PDV

- PDV consulta preço antes de criar order
- Preço é resolvido automaticamente ao adicionar item
- Snapshot salvo no metadata do item

## TESTES MANUAIS

### 1. Criar Preço

```bash
POST /marketplace/pricing/prices
{
  "productVariantId": "...",
  "price": 100.00,
  "currency": "BRL"
}
```

### 2. Criar Promoção

```bash
POST /marketplace/pricing/promotions
{
  "name": "Desconto 10%",
  "type": "PERCENTAGE",
  "value": 10.0,
  "appliesTo": "VARIANT",
  "appliesId": "..."
}
```

### 3. Consultar Preço

```bash
GET /marketplace/pricing/variant/:variantId
```

**Resultado:**
- Preço base: 100.00
- Desconto: 10.00
- Preço final: 90.00
- Promoções aplicadas

### 4. Adicionar Item ao Pedido

```bash
POST /marketplace/orders/:orderId/items
{
  "productVariantId": "...",
  "quantity": 1
}
```

**Resultado:**
- Item criado com `metadata.priceSnapshot`
- Preço resolvido e snapshot preservado

## OBSERVAÇÕES

1. **Preço declarativo**: Resolvido ANTES do pedido, não recalcula
2. **Snapshot preservado**: Preço histórico salvo no metadata
3. **Promoções aplicáveis**: Por variante, produto ou categoria
4. **Consistência**: Preço consistente em todos os canais
5. **Auditoria**: Preço e promoções são auditáveis

## PRÓXIMOS PASSOS

- [ ] Adicionar comissões (splits baseados em pricing)
- [ ] Adicionar UI para gerenciar preços e promoções
- [ ] Adicionar validação de promoções (min_quantity, max_uses_per_user)
- [ ] Adicionar relatórios de pricing





