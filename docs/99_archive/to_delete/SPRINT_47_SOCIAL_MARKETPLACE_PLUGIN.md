# SPRINT 47: SOCIAL COMO PLUGIN TRANSACIONAL DO MARKETPLACE

## RESUMO EXECUTIVO

Implementado integração do Social Feed ao Marketplace como plugin:
- ✅ Tabela `social_marketplace_refs` para referências
- ✅ Backend endpoints para criar e buscar referências
- ✅ Validação de ref_id existe no marketplace
- ✅ Frontend API client preparado
- ✅ Social nunca executa transações

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/migrations/182_create_social_marketplace_refs.sql`** (NOVO)
   - Tabela `social_marketplace_refs`
   - Campos: `id`, `tenant_id`, `post_id`, `ref_type`, `ref_id`, `metadata`, `created_at`
   - Enums: `social_marketplace_ref_type` (PRODUCT, ORDER, CAMPAIGN)
   - RLS e índices

2. **`backend/src/modules/social/social-marketplace-ref.types.ts`** (NOVO)
   - Tipos TypeScript para referências
   - `SocialMarketplaceRef`, `CreateSocialMarketplaceRefInput`, `SocialMarketplaceRefWithDetails`

3. **`backend/src/modules/social/social-marketplace-ref.repository.ts`** (NOVO)
   - Repository para referências
   - Métodos: `createRef`, `getRefById`, `getRefsByPost`, `getRefsByRef`, `removeRef`

4. **`backend/src/modules/social/social-marketplace-ref.service.ts`** (NOVO)
   - Service para referências
   - Valida que `ref_id` existe no marketplace
   - Busca detalhes do marketplace
   - NÃO executa transações

5. **`backend/src/modules/social/social-marketplace-ref.routes.ts`** (NOVO)
   - Rotas REST:
     - `POST /social/marketplace-ref` (criar referência)
     - `GET /social/marketplace-ref/:postId` (buscar por post)
     - `GET /social/marketplace-ref/details/:refId` (detalhes)

6. **`backend/src/modules/social/social.module.ts`** (ALTERADO)
   - Registrado `socialMarketplaceRefRoutes`

### Frontend

7. **`frontend/src/api/social.ts`** (NOVO)
   - API client para referências do marketplace no social
   - Funções: `createSocialMarketplaceRef`, `getSocialMarketplaceRefsByPost`, `getSocialMarketplaceRefDetails`

## REGRAS ARQUITETURAIS

### ✅ Social NÃO Executa Transações

- Social NÃO cria Order
- Social NÃO cria PaymentIntent
- Social NÃO toca Bank
- Social é apenas entrada/contexto

### ✅ Marketplace Nunca Depende do Social

- Marketplace funciona independentemente
- Falha no social não quebra venda
- Social é opcional

### ✅ Validação de Referência

- `ref_id` deve existir no marketplace
- Validação por tipo (PRODUCT, ORDER, CAMPAIGN)
- Tenant e actor corretos

## FLUXO DE INTEGRAÇÃO

### 1. Criar Referência

```typescript
// POST /social/marketplace-ref
{
  postId: "uuid",
  refType: "PRODUCT",
  refId: "product_variant_id"
}

// Service valida:
// 1. ref_id existe no marketplace
// 2. Busca detalhes (nome, status, link)
// 3. Cria referência com metadata
```

### 2. Buscar Referências por Post

```typescript
// GET /social/marketplace-ref/:postId
// Retorna:
{
  refs: [
    {
      ref: { id, postId, refType, refId, ... },
      details: { type, id, name, status, link }
    }
  ]
}
```

### 3. Renderizar no Feed

```typescript
// No feed, se post tem marketplace_ref:
// 1. Renderizar card do marketplace
// 2. Botão "Ver no marketplace"
// 3. Redirecionar com contexto (query params)
```

## TIPOS DE REFERÊNCIA

### PRODUCT

- `ref_id`: `product_variant_id`
- Validação: variante existe
- Detalhes: nome do produto, status (active/inactive), link para marketplace

### ORDER

- `ref_id`: `order_id`
- Validação: pedido existe
- Detalhes: número do pedido, status, link para marketplace

### CAMPAIGN

- `ref_id`: `campaign_id` (futuro)
- Validação: campanha existe (futuro)
- Detalhes: nome da campanha, link para marketplace

## ENDPOINTS

### POST /social/marketplace-ref

Cria referência do marketplace no social.

**Body:**
```json
{
  "postId": "uuid",
  "refType": "PRODUCT",
  "refId": "uuid",
  "metadata": {}
}
```

**Response:**
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "postId": "uuid",
  "refType": "PRODUCT",
  "refId": "uuid",
  "metadata": { "name": "...", "status": "...", "link": "..." },
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### GET /social/marketplace-ref/:postId

Busca referências do marketplace por post.

**Response:**
```json
{
  "refs": [
    {
      "ref": { ... },
      "details": {
        "type": "PRODUCT",
        "id": "uuid",
        "name": "Produto",
        "status": "active",
        "link": "/marketplace?tab=products&productId=..."
      }
    }
  ]
}
```

### GET /social/marketplace-ref/details/:refId

Busca detalhes de uma referência específica.

**Response:**
```json
{
  "ref": { ... },
  "details": {
    "type": "PRODUCT",
    "id": "uuid",
    "name": "Produto",
    "status": "active",
    "link": "/marketplace?tab=products&productId=..."
  }
}
```

## INVARIANTES

### ✅ Social Nunca Executa Transação

- Social apenas cria referência
- Venda ocorre exclusivamente no marketplace
- Social não toca Bank

### ✅ Marketplace Nunca Depende do Social

- Marketplace funciona sem social
- Falha no social não quebra venda
- Social é opcional

### ✅ Falha no Social Não Quebra Venda

- Erros no social são tratados graciosamente
- Venda continua funcionando
- Log de erros mas não bloqueia

## TESTES MANUAIS

### 1. Criar Referência de Produto

```bash
POST /social/marketplace-ref
{
  "postId": "...",
  "refType": "PRODUCT",
  "refId": "product_variant_id"
}
```

**Resultado:**
- Referência criada
- Metadata preenchido com detalhes do produto
- Link para marketplace gerado

### 2. Buscar Referências por Post

```bash
GET /social/marketplace-ref/:postId
```

**Resultado:**
- Lista de referências do post
- Detalhes de cada referência
- Links para marketplace

### 3. Validar Referência Inválida

```bash
POST /social/marketplace-ref
{
  "postId": "...",
  "refType": "PRODUCT",
  "refId": "invalid_id"
}
```

**Resultado:**
- Erro: "Variante não encontrada"
- Referência não criada
- Venda não é afetada

## OBSERVAÇÕES

1. **Social é plugin**: Não executa economia, apenas referencia
2. **Marketplace independente**: Funciona sem social
3. **Validação leve**: Verifica existência, não bloqueia
4. **Metadata rico**: Detalhes do marketplace salvos na referência
5. **Links contextuais**: Redireciona para marketplace com contexto

## PRÓXIMOS PASSOS

- [ ] Integrar renderização no feed (frontend)
- [ ] Adicionar botão "Ver no marketplace"
- [ ] Adicionar suporte a campanhas
- [ ] Adicionar analytics de cliques





