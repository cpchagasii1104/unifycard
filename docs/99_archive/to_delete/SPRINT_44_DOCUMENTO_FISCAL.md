# SPRINT 44: DOCUMENTO FISCAL — BASE CANÔNICA

## RESUMO EXECUTIVO

Implementado base canônica de documento fiscal:
- ✅ Tabelas `fiscal_documents` e `fiscal_document_items`
- ✅ Service para criar, emitir e cancelar documentos
- ✅ Criação automática após pagamento SUCCESS
- ✅ Tipo determinado pela origem (PDV → NFC-e, Marketplace → NF-e)
- ✅ Referência salva no metadata do Order
- ✅ Sem integração com SEFAZ ainda

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/migrations/181_create_fiscal_documents.sql`** (NOVO)
   - Tabela `fiscal_documents` com tipos e status
   - Tabela `fiscal_document_items` para itens
   - Enums: `fiscal_document_type` (NFCE, NFE, SAT, NONE)
   - Enums: `fiscal_document_status` (DRAFT, ISSUED, CANCELLED)
   - RLS e índices

2. **`backend/src/modules/marketplace/fiscal-document.types.ts`** (NOVO)
   - Tipos TypeScript para documentos fiscais
   - `FiscalDocument`, `FiscalDocumentItem`, inputs

3. **`backend/src/modules/marketplace/fiscal-document.repository.ts`** (NOVO)
   - Repository para documentos fiscais
   - Métodos: `createDocument`, `getDocumentById`, `getDocumentByOrder`, `updateDocumentStatus`, `createItem`, `listItemsByDocument`

4. **`backend/src/modules/marketplace/fiscal-document.service.ts`** (NOVO)
   - Service principal para documentos fiscais
   - Métodos: `createFromOrder`, `issueDocument`, `cancelDocument`, `listDocumentsByOrder`, `listItemsByDocument`

5. **`backend/src/modules/marketplace/payment-execution.service.ts`** (ALTERADO)
   - Cria documento fiscal automaticamente após pagamento SUCCESS
   - Determina tipo: PDV → NFC-e, Marketplace → NF-e

6. **`backend/src/modules/marketplace/index.ts`** (ALTERADO)
   - Exporta `fiscalDocumentService` e `fiscalDocumentRepository`

## FLUXO DE CRIAÇÃO

### 1. Pagamento SUCCESS

```typescript
// PaymentExecutionService.executePayment()
1. Pagamento executado com sucesso
2. Verificar metadata do pedido (pdv_session_id)
3. Determinar tipo:
   - Se pdv_session_id existe → NFC-e (PDV)
   - Caso contrário → NF-e (Marketplace)
4. Criar documento fiscal (status = DRAFT)
5. Criar itens baseados em order_items
6. Salvar referência no metadata do Order
```

### 2. Estrutura do Documento

```typescript
FiscalDocument {
  orderId: string;
  paymentIntentId: string | null;
  documentType: 'NFCE' | 'NFE' | 'SAT' | 'NONE';
  status: 'DRAFT' | 'ISSUED' | 'CANCELLED';
  totalAmount: number; // Espelha payment intent amount
  items: FiscalDocumentItem[]; // Espelha order_items
}
```

## REGRAS ARQUITETURAIS

### ✅ Representação, Não Execução

- Documento **NÃO** integra com SEFAZ ainda
- Documento **NÃO** bloqueia venda
- Documento **NÃO** recalcula valores
- Documento apenas **ESPELHA** a venda

### ✅ Criação Automática

- Documento criado automaticamente após pagamento SUCCESS
- Não bloqueia se criação falhar (log apenas)
- Tipo determinado pela origem (PDV vs Marketplace)

### ✅ Append-Only

- Histórico de documentos não é deletado
- Status muda, mas histórico permanece
- Itens são criados junto com documento

### ✅ Metadata do Order

- Referência ao documento salva em `order.metadata.fiscal_document_id`
- Tipo salvo em `order.metadata.fiscal_document_type`
- Permite consulta rápida

## DETERMINAÇÃO DO TIPO

### PDV → NFC-e

```typescript
// Se order.metadata.pdv_session_id existe
documentType = 'NFCE'
```

### Marketplace → NF-e

```typescript
// Caso contrário (pedido do marketplace)
documentType = 'NFE'
```

## TESTES MANUAIS

### 1. Criar Documento via Pagamento

```bash
# Processar pagamento (cria documento automaticamente)
POST /marketplace/payments/execute
{
  "paymentIntentId": "...",
  "buyerActorId": "...",
  "sellerActorId": "..."
}
```

**Resultado:**
- Documento criado em DRAFT
- Itens criados baseados em order_items
- Referência salva no metadata do Order

### 2. Consultar Documento

```bash
# Buscar documento por pedido
GET /marketplace/fiscal-documents?orderId=...
```

### 3. Emitir Documento

```bash
# Emitir documento (apenas muda status)
POST /marketplace/fiscal-documents/:id/issue
```

**Resultado:**
- Status muda para ISSUED
- `issued_at` é preenchido
- Futuro: aqui será feita integração com SEFAZ

### 4. Cancelar Documento

```bash
# Cancelar documento (apenas muda status)
POST /marketplace/fiscal-documents/:id/cancel
{
  "reason": "Erro no pedido"
}
```

**Resultado:**
- Status muda para CANCELLED
- Futuro: aqui será feita integração com SEFAZ

## VALIDAÇÕES

### ✅ Documento Deve Estar DRAFT para Emitir

```typescript
if (document.status !== 'DRAFT') {
  throw new Error('Apenas DRAFT pode ser emitido');
}
```

### ✅ Documento Deve Estar ISSUED para Cancelar

```typescript
if (document.status !== 'ISSUED') {
  throw new Error('Apenas ISSUED pode ser cancelado');
}
```

### ✅ Pedido Deve Existir

```typescript
const order = await orderRepository.getOrderById(tenantId, orderId);
if (!order) {
  throw new Error('Pedido não encontrado');
}
```

## OBSERVAÇÕES

1. **Sem SEFAZ ainda**: Documento é apenas representação interna
2. **Criação automática**: Não bloqueia venda se falhar
3. **Tipo automático**: Determinado pela origem (PDV vs Marketplace)
4. **Metadata**: Referência salva no Order para consulta rápida
5. **Futuro**: Estrutura pronta para integração com SEFAZ

## PRÓXIMOS PASSOS

- [ ] Integrar com SEFAZ (gerar XML, chave de acesso, protocolo)
- [ ] Adicionar campos fiscais (CFOP, NCM, CST) nos itens
- [ ] Adicionar rotas para consultar documentos
- [ ] Adicionar UI para visualizar documentos fiscais





