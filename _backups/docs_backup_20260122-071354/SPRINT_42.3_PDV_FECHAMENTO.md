# SPRINT 42.3: PDV — FECHAMENTO DE CAIXA & RELATÓRIO DE TURNO

## RESUMO EXECUTIVO

Implementado fechamento de caixa e relatório de turno:
- ✅ Fechamento de caixa com consolidação automática
- ✅ Relatório de turno (total de pedidos, recebido, falhas)
- ✅ Bloqueio de operações em sessão CLOSED
- ✅ UI com modal de confirmação e exibição de resumo
- ✅ Resumo salvo no metadata da sessão (append-only)

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/src/modules/pdv/pdv.types.ts`** (ALTERADO)
   - Adicionado `PdvSessionSummary` com estrutura completa do relatório

2. **`backend/src/modules/pdv/pdv.service.ts`** (ALTERADO)
   - Novo método `closeSessionWithSummary()`:
     - Valida sessão OPEN
     - Busca orders por `metadata.pdv_session_id`
     - Consolida totais (pedidos, pagamentos, falhas)
     - Fecha sessão e salva resumo no metadata
   - Novo método `getSessionSummary()`:
     - Retorna resumo de sessão (aberta ou fechada)
     - Se fechada, retorna do metadata
     - Se aberta, calcula em tempo real

3. **`backend/src/modules/pdv/pdv.routes.ts`** (ALTERADO)
   - Nova rota `GET /pdv/sessions/:id/summary` (relatório)
   - Nova rota `POST /pdv/sessions/:id/close-with-summary` (fechamento)
   - Registra auditoria `PDV_SESSION_CLOSED_WITH_SUMMARY`

### Frontend

1. **`frontend/src/api/pdv.ts`** (ALTERADO)
   - Adicionado `getSessionSummary()`
   - Adicionado `closeSessionWithSummary()`

2. **`frontend/src/pages/PdvPage.tsx`** (ALTERADO)
   - Modal de confirmação para fechamento
   - Exibição de resumo após fechamento
   - Bloqueio de operações se sessão CLOSED
   - Lista de pedidos do turno

## FLUXO DE FECHAMENTO

### 1. Operador clica "Fechar Caixa"

```
Botão: "Fechar Caixa"
→ Modal de confirmação
```

### 2. Backend processa

```typescript
// pdv.service.ts - closeSessionWithSummary()
1. Validar sessão OPEN
2. Buscar orders com metadata.pdv_session_id = sessionId
3. JOIN com payment_intents e payment_transactions
4. Consolidar:
   - totalOrders: count de orders
   - totalPaid: sum de pagamentos SUCCESS
   - totalFailed: sum de pagamentos FAILED
5. Fechar sessão (status = CLOSED, closed_at = NOW)
6. Salvar resumo no metadata
7. Retornar resumo completo
```

### 3. UI exibe resumo

- Totais (pedidos, recebido, falhas)
- Lista de pedidos com status e valor
- Sessão bloqueada para novas operações

## ESTRUTURA DO RELATÓRIO

```typescript
interface PdvSessionSummary {
  session: PdvSession;
  operator: { actorId: string };
  openedAt: Date;
  closedAt: Date | null;
  totalOrders: number;
  totalPaid: number;      // Soma de pagamentos SUCCESS
  totalFailed: number;    // Soma de pagamentos FAILED
  orders: Array<{
    id: string;
    status: string;       // DRAFT, SUBMITTED, CANCELLED, EXPIRED
    amount: number | null;
    paymentStatus: 'SUCCESS' | 'FAILED' | 'PENDING' | 'NONE';
    createdAt: Date;
  }>;
}
```

## REGRAS ARQUITETURAIS

### ✅ Somente Leitura

- Relatório **NÃO** recalcula pagamentos
- Relatório **NÃO** move dinheiro
- Relatório **NÃO** altera dados existentes
- Apenas consolidação e leitura

### ✅ Resumo no Metadata

- Resumo salvo em `session.metadata.summary`
- Append-only (não altera histórico)
- Permite consulta posterior sem recalcular

### ✅ Bloqueio de Operações

Todos os métodos validam sessão OPEN:
- `createOrderFromPdv()` → erro se CLOSED
- `addItemByVariant()` → erro se CLOSED
- `addItemByWeight()` → erro se CLOSED
- `payOrderFromPdv()` → erro se CLOSED

### ✅ Query de Consolidação

```sql
SELECT 
  o.id,
  o.status,
  o.created_at,
  pi.amount as payment_amount,
  pt.status as payment_status
FROM orders o
LEFT JOIN payment_intents pi ON pi.order_id = o.id
LEFT JOIN payment_transactions pt ON pt.payment_intent_id = pi.id
WHERE o.tenant_id = $1
  AND o.metadata->>'pdv_session_id' = $2
ORDER BY o.created_at ASC
```

## TESTES MANUAIS

### 1. Fechar Caixa

```bash
POST /pdv/sessions/:id/close-with-summary
Headers:
  x-tenant-id: <tenant-id>
  Authorization: Bearer <token>
  x-acting-actor-id: <actor-id>
```

**Resposta:**
```json
{
  "session": { "id": "...", "status": "CLOSED", ... },
  "operator": { "actorId": "..." },
  "openedAt": "2024-01-01T10:00:00Z",
  "closedAt": "2024-01-01T18:00:00Z",
  "totalOrders": 5,
  "totalPaid": 125.50,
  "totalFailed": 0,
  "orders": [
    {
      "id": "...",
      "status": "SUBMITTED",
      "amount": 25.50,
      "paymentStatus": "SUCCESS",
      "createdAt": "2024-01-01T10:30:00Z"
    },
    ...
  ]
}
```

### 2. Consultar Relatório

```bash
GET /pdv/sessions/:id/summary
Headers:
  x-tenant-id: <tenant-id>
  Authorization: Bearer <token>
  x-acting-actor-id: <actor-id>
```

**Resposta:** Mesma estrutura do fechamento

### 3. Teste no Frontend

1. Abrir `/pdv`
2. Abrir caixa
3. Criar pedidos e processar pagamentos
4. Clicar "Fechar Caixa"
5. Confirmar no modal
6. Verificar resumo exibido
7. Tentar criar novo pedido → deve estar bloqueado

## VALIDAÇÕES

### ✅ Sessão deve estar OPEN para fechar

```typescript
if (session.status !== 'OPEN') {
  throw new Error('Sessão PDV não está aberta');
}
```

### ✅ Sessão CLOSED bloqueia operações

Todos os métodos do PDV validam:
```typescript
if (session.status !== 'OPEN') {
  throw new Error('Sessão PDV não está aberta');
}
```

### ✅ Resumo é somente leitura

- Não altera orders
- Não altera pagamentos
- Não move dinheiro
- Apenas consolidação

## UI - BLOQUEIO DE OPERAÇÕES

### Sessão CLOSED

```tsx
{session.status === 'CLOSED' && (
  <div style={{ background: '#fef2f2' }}>
    <h3>Caixa Fechado</h3>
    <p>Não é possível criar novos pedidos ou processar pagamentos.</p>
    {/* Resumo exibido aqui */}
  </div>
)}
```

### Sessão OPEN

```tsx
{session.status === 'OPEN' && (
  <>
    {/* Operações normais */}
    <button onClick={handleCreateOrder}>Criar Novo Pedido</button>
    ...
  </>
)}
```

## OBSERVAÇÕES

1. **Resumo no metadata**: Permite consulta posterior sem recalcular
2. **Query com JOIN**: Busca orders, payment_intents e payment_transactions em uma query
3. **Bloqueio total**: Sessão CLOSED bloqueia todas as operações
4. **Auditoria**: Fechamento registrado em `audit_events`
5. **Tempo real vs. Cache**: Sessão aberta calcula em tempo real, fechada usa cache

## PRÓXIMOS PASSOS

- [ ] Adicionar exportação de relatório (PDF/CSV)
- [ ] Adicionar filtros no relatório (por data, status, etc.)
- [ ] Adicionar gráficos de vendas (se necessário)
- [ ] Adicionar impressão de relatório (se necessário)





