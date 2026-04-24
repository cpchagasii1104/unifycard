# Patch: product-price.repository.ts + promotion.repository.ts

> **Pasta `leia-esta-pasta`:** documento de **referência / histórico** apenas. **Migrações:** aplicar só ficheiros em `backend/migrations/` (espelhos `*.up.sql` que existiam nesta pasta foram **removidos** após integração no repo).

> **Estado no repositório (2026-04):**  
> - **`product-price.repository.ts`** — aplicado: `price_cents` no SQL, `priceCents` no domínio (`pricing.types.ts`).  
> - **`promotion.repository.ts`** — o rascunho abaixo citava `value_cents`; o schema **evoluiu** para **`discount_fixed_cents`** + **`discount_rate_bps`** (§4.7 + §4.8). Ver `backend/migrations/20260416140000_promotions_discount_fixed_cents_rate_bps.sql` e o ficheiro real `backend/src/modules/marketplace/promotion.repository.ts`.  
> Use este documento como **histórico / checklist conceitual**, não como espelho literal do código actual.

## Contexto
Deploy simultâneo obrigatório com migration 20260416100000.
Após a migration: coluna `price` → `price_cents`; em `promotions`, o modelo final não é mais `value`/`value_cents` único — ver migração 16140000.

---

## 1. product-price.repository.ts

### ProductPriceRow interface
```typescript
// ANTES:
interface ProductPriceRow {
  price: string;
  // ...
}

// DEPOIS:
interface ProductPriceRow {
  price_cents: string | number;  // ← BIGINT do PG vem como string
  // ...
}
```

### toPrice mapper
```typescript
// ANTES:
price: parseFloat(row.price),

// DEPOIS:
priceCents: typeof row.price_cents === 'number'
  ? row.price_cents
  : parseInt(String(row.price_cents), 10),
```

### ProductPrice domain type (pricing.types.ts)
```typescript
// ANTES:
export interface ProductPrice {
  price: number;
  // ...
}

// DEPOIS:
export interface ProductPrice {
  priceCents: number;   // ← centavos
  // ...
}
```

### createPrice SQL
```typescript
// ANTES:
INSERT INTO product_prices (tenant_id, product_variant_id, price, ...)
// params: [..., input.price, ...]
// RETURNING ..., price, ...

// DEPOIS:
INSERT INTO product_prices (tenant_id, product_variant_id, price_cents, ...)
// params: [..., input.priceCents, ...]
// RETURNING ..., price_cents, ...
```

### CreateProductPriceInput
```typescript
// ANTES:
export interface CreateProductPriceInput {
  price: number;
}

// DEPOIS:
export interface CreateProductPriceInput {
  priceCents: number;  // ← centavos
}
```

---

## 2. promotion.repository.ts

### PromotionRow interface
```typescript
// ANTES:
interface PromotionRow {
  type: string;      // 'PERCENTAGE' | 'FIXED'
  value: string;
  applies_to: string;
}

// DEPOIS:
interface PromotionRow {
  type: string;      // 'percentage' | 'fixed'
  value_cents: string | number;
  applies_to: string; // 'variant' | 'category' | 'product'
}
```

### toPromotion mapper
```typescript
// ANTES:
type: row.type as any,
value: parseFloat(row.value),
appliesTo: row.applies_to as any,

// DEPOIS:
type: row.type as 'percentage' | 'fixed',
valueCents: typeof row.value_cents === 'number'
  ? row.value_cents
  : parseInt(String(row.value_cents), 10),
appliesTo: row.applies_to as 'variant' | 'category' | 'product',
```

### Promotion domain type
```typescript
// ANTES:
export interface Promotion {
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  appliesTo: 'VARIANT' | 'CATEGORY' | 'PRODUCT';
}

// DEPOIS:
export interface Promotion {
  type: 'percentage' | 'fixed';
  valueCents: number;
  appliesTo: 'variant' | 'category' | 'product';
}
```

### createPromotion SQL
```typescript
// ANTES:
INSERT INTO promotions (..., type, value, applies_to, ...)
// params: [..., input.type, input.value, input.appliesTo, ...]
// RETURNING ..., type, value, applies_to, ...

// DEPOIS:
INSERT INTO promotions (..., type, value_cents, applies_to, ...)
// params: [..., input.type.toLowerCase(), input.valueCents, input.appliesTo.toLowerCase(), ...]
// RETURNING ..., type, value_cents, applies_to, ...
```

## Verificação pós-patch
```bash
grep -n "\.price\b\|row\.price\b\|'price'" \
  src/modules/marketplace/product-price.repository.ts | grep -v price_cents
# Deve retornar zero linhas

grep -n "\bvalue\b\|row\.value\b" \
  src/modules/marketplace/promotion.repository.ts | grep -v value_cents
# Deve retornar zero linhas

grep -n "PERCENTAGE\|FIXED\|VARIANT\|CATEGORY\|PRODUCT" \
  src/modules/marketplace/promotion.repository.ts
# Deve retornar zero linhas
```
