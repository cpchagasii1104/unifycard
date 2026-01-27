# SPRINT 42.1: PDV CORE — VENDA POR PESO + CAIXA SIMPLES

## RESUMO EXECUTIVO

Implementado PDV mínimo funcional integrado ao marketplace:
- ✅ Sessões PDV (abrir/fechar caixa)
- ✅ Criação de pedidos via PDV
- ✅ Venda por peso (WEIGHT) e por unidade (UNIT)
- ✅ Integração completa com marketplace (não cria sistema paralelo)
- ✅ UI simples para operação

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/migrations/179_create_pdv_sessions.sql`** (NOVO)
   - Tabela `pdv_sessions` com status OPEN/CLOSED
   - Enum `pdv_session_status`
   - RLS e índices

2. **`backend/src/modules/pdv/pdv.types.ts`** (NOVO)
   - Tipos TypeScript para PDV
   - `PdvSession`, `CreatePdvSessionInput`, `AddItemByWeightInput`, etc.

3. **`backend/src/modules/pdv/pdv.repository.ts`** (NOVO)
   - Repository para `pdv_sessions`
   - Métodos: `createSession`, `getSessionById`, `getOpenSessionByActor`, `closeSession`

4. **`backend/src/modules/pdv/pdv.service.ts`** (NOVO)
   - Service principal do PDV
   - Métodos:
     - `openSession()`: Abre sessão PDV
     - `closeSession()`: Fecha sessão
     - `createOrderFromPdv()`: Cria Order no marketplace
     - `addItemByVariant()`: Adiciona item por variante (UNIT/LOT)
     - `addItemByWeight()`: Adiciona item por peso (WEIGHT) - valida tipo

5. **`backend/src/modules/pdv/pdv.routes.ts`** (NOVO)
   - Rotas REST para PDV:
     - `POST /pdv/sessions/open`
     - `POST /pdv/sessions/:id/close`
     - `GET /pdv/sessions/open`
     - `GET /pdv/sessions`
     - `POST /pdv/orders`
     - `POST /pdv/orders/:orderId/items/unit`
     - `POST /pdv/orders/:orderId/items/weight`

6. **`backend/src/modules/pdv/index.ts`** (NOVO)
   - Exports do módulo PDV

7. **`backend/src/server.ts`** (ALTERADO)
   - Registrado módulo PDV em `/pdv`

### Frontend

1. **`frontend/src/api/pdv.ts`** (NOVO)
   - API client para PDV
   - Funções: `openPdvSession`, `closePdvSession`, `createOrderFromPdv`, `addItemByVariant`, `addItemByWeight`

2. **`frontend/src/pages/PdvPage.tsx`** (NOVO)
   - UI simples do PDV
   - Abrir/fechar caixa
   - Buscar produtos (nome, SKU, PLU)
   - Adicionar itens (por peso ou unidade)
   - Finalizar pedido (navega para marketplace)

3. **`frontend/src/pages/PdvPage.css`** (NOVO)
   - Estilos simples para PDV

4. **`frontend/src/App.tsx`** (ALTERADO)
   - Rota `/pdv` adicionada

## REGRAS ARQUITETURAIS

### ✅ PDV é Canal de Entrada

- PDV **SEMPRE** cria Order no marketplace
- PDV **NÃO** cria sistema paralelo
- PDV **NÃO** cria pagamento automaticamente
- PDV **NÃO** reduz estoque automaticamente

### ✅ Venda por Peso

- `addItemByWeight()` **SÓ** aceita variantes WEIGHT
- Valida `product_type === 'WEIGHT'` antes de adicionar
- Quantidade = peso em kg
- Unidade padrão: 'KG'

### ✅ Sessões PDV

- Um actor pode ter apenas uma sessão OPEN por vez
- Sessão representa caixa aberto (não tem lógica financeira)
- Metadata pode armazenar observações/configurações

## FLUXO DE USO

### 1. Abrir Caixa

```
POST /pdv/sessions/open
{
  "actorId": "uuid" // opcional, usa actingActorId se não fornecido
}
```

### 2. Criar Pedido

```
POST /pdv/orders
{
  "sessionId": "uuid",
  "buyerActorId": "uuid", // Cliente
  "sellerActorId": "uuid"  // Vendedor
}
```

### 3. Adicionar Item por Peso

```
POST /pdv/orders/:orderId/items/weight
{
  "sessionId": "uuid",
  "variantId": "uuid",
  "weight": 1.5, // kg
  "unit": "KG"   // opcional
}
```

**Validação:**
- Variante deve ser do tipo WEIGHT
- Peso > 0

### 4. Adicionar Item por Unidade

```
POST /pdv/orders/:orderId/items/unit
{
  "sessionId": "uuid",
  "variantId": "uuid",
  "quantity": 2,
  "unit": "UN" // opcional
}
```

### 5. Finalizar Pedido

- Navega para `/marketplace?tab=orders&orderId=...`
- Usuário pode submeter e executar pagamento no marketplace

## INTEGRAÇÃO COM MARKETPLACE

### Order Metadata

Orders criados via PDV incluem metadata:
```json
{
  "pdv_session_id": "uuid",
  "pdv_actor_id": "uuid"
}
```

### Uso de Services Existentes

PDV usa:
- `orderService.createOrder()` - Cria Order
- `orderService.addItem()` - Adiciona item
- `productCatalogService.getVariantById()` - Valida variante
- `productCatalogService.getProductById()` - Valida product_type

**Nenhuma lógica duplicada.**

## UI PDV

### Tela Única

1. **Status do Caixa:**
   - Botão "Abrir Caixa" (se fechado)
   - Badge "Caixa Aberto" + Botão "Fechar Caixa" (se aberto)

2. **Criar Pedido:**
   - Botão "Criar Novo Pedido"
   - Cria Order no marketplace

3. **Buscar Produto:**
   - Campo de busca (nome, SKU, PLU)
   - Lista de variantes filtradas
   - Seleção por clique

4. **Adicionar Item:**
   - Se WEIGHT: campo de peso (kg)
   - Se UNIT/LOT: campo de quantidade
   - Botão "Adicionar"

5. **Finalizar:**
   - Botão "Finalizar Pedido →"
   - Navega para marketplace/orders

## TESTES MANUAIS

### 1. Abrir/Fechar Caixa

```bash
# Abrir
curl -X POST http://localhost:3000/pdv/sessions/open \
  -H "x-tenant-id: <tenant-id>" \
  -H "Authorization: Bearer <token>" \
  -H "x-acting-actor-id: <actor-id>" \
  -H "Content-Type: application/json"

# Ver sessão aberta
curl http://localhost:3000/pdv/sessions/open \
  -H "x-tenant-id: <tenant-id>" \
  -H "Authorization: Bearer <token>" \
  -H "x-acting-actor-id: <actor-id>"

# Fechar
curl -X POST http://localhost:3000/pdv/sessions/<session-id>/close \
  -H "x-tenant-id: <tenant-id>" \
  -H "Authorization: Bearer <token>" \
  -H "x-acting-actor-id: <actor-id>"
```

### 2. Criar Pedido e Adicionar Itens

```bash
# Criar pedido
curl -X POST http://localhost:3000/pdv/orders \
  -H "x-tenant-id: <tenant-id>" \
  -H "Authorization: Bearer <token>" \
  -H "x-acting-actor-id: <actor-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "<session-id>",
    "buyerActorId": "<buyer-id>",
    "sellerActorId": "<seller-id>"
  }'

# Adicionar por peso (WEIGHT)
curl -X POST http://localhost:3000/pdv/orders/<order-id>/items/weight \
  -H "x-tenant-id: <tenant-id>" \
  -H "Authorization: Bearer <token>" \
  -H "x-acting-actor-id: <actor-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "<session-id>",
    "variantId": "<variant-id>",
    "weight": 1.5,
    "unit": "KG"
  }'

# Adicionar por unidade (UNIT)
curl -X POST http://localhost:3000/pdv/orders/<order-id>/items/unit \
  -H "x-tenant-id: <tenant-id>" \
  -H "Authorization: Bearer <token>" \
  -H "x-acting-actor-id: <actor-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "<session-id>",
    "variantId": "<variant-id>",
    "quantity": 2,
    "unit": "UN"
  }'
```

### 3. Teste no Frontend

1. Abrir `/pdv`
2. Clicar "Abrir Caixa"
3. Clicar "Criar Novo Pedido"
4. Buscar produto (por nome, SKU ou PLU)
5. Selecionar produto
6. Se WEIGHT: informar peso (kg)
7. Se UNIT: informar quantidade
8. Clicar "Adicionar"
9. Clicar "Finalizar Pedido →"
10. Verificar que navega para marketplace/orders

## VALIDAÇÕES

### ✅ WEIGHT só aceita variantes WEIGHT

```typescript
// pdv.service.ts
if (product.productType !== 'WEIGHT') {
  throw new Error(`Variante não é do tipo WEIGHT. Tipo atual: ${product.productType}`);
}
```

### ✅ Sessão deve estar OPEN

```typescript
if (session.status !== 'OPEN') {
  throw new Error('Sessão PDV não está aberta');
}
```

### ✅ Apenas uma sessão OPEN por actor

```typescript
const existing = await pdvSessionRepository.getOpenSessionByActor(...);
if (existing) {
  throw new Error('Já existe uma sessão PDV aberta para este operador');
}
```

## OBSERVAÇÕES

1. **PDV não cria pagamento**: Usuário finaliza no marketplace
2. **PDV não reduz estoque**: Fluxo existente do marketplace
3. **PDV não cria fiscal**: Não implementado nesta sprint
4. **Metadata em Order**: Identifica origem PDV para auditoria

## PRÓXIMOS PASSOS

- [ ] Adicionar listagem de itens do pedido em tempo real
- [ ] Adicionar busca por PLU (scanner)
- [ ] Considerar preview de produto no PDV
- [ ] Adicionar histórico de sessões





