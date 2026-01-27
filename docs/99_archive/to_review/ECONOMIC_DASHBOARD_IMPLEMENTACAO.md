# Implementação: Dashboard Econômico (READ-ONLY)

**Data**: 2024-12-19  
**Escopo**: Criação do Dashboard Econômico (READ-ONLY) para visualizar fluxo de dinheiro fictício

---

## 1. DEFINIÇÃO CANÔNICA

### Economic Dashboard NÃO é:
- ❌ Banco
- ❌ Carteira
- ❌ Saldo
- ❌ Criação de dinheiro
- ❌ Execução de pagamento
- ❌ Decisão
- ❌ Ação
- ❌ Edição
- ❌ Inferência de comportamento
- ❌ Ranking

### Economic Dashboard É:
- ✅ Visualização histórica
- ✅ Agregação de dados existentes
- ✅ READ-ONLY
- ✅ Calculado sob demanda
- ✅ Não persiste dados

---

## 2. READ MODELS CRIADOS

### Backend

1. **`ACTOR_ECONOMIC_OVERVIEW_READ_MODEL`**:
   - Overview econômico de um actor
   - Campos:
     - `totalReceived`: Total recebido (como receiver em executions e splits)
     - `totalPaid`: Total pago (como payer em executions)
     - `totalDistributedViaSplit`: Total distribuído via split (como receiver em splits)
     - `executionsCount`: Quantidade de execuções
     - `lastTransactions`: Últimas transações (limitado a 20)
     - `currency`: Moeda (default: 'FIC')
     - `lastUpdated`: Data da última atualização

2. **`GROUP_ECONOMIC_OVERVIEW_READ_MODEL`**:
   - Overview econômico de um grupo
   - Campos:
     - `totalReceived`: Total recebido (como receiver em executions e splits)
     - `totalDistributedViaSplit`: Total distribuído via split (como receiver em splits)
     - `executionsCount`: Quantidade de execuções onde grupo recebeu
     - `lastTransactions`: Últimas transações (limitado a 20)
     - `currency`: Moeda (default: 'FIC')
     - `lastUpdated`: Data da última atualização

---

## 3. FONTES DE DADOS

### Fontes Permitidas

1. **`PAYMENT_EXECUTION`** (`service_payment_executions`):
   - Execuções onde actor é payer ou receiver
   - Usado para calcular `totalPaid`, `totalReceived`, `executionsCount`

2. **`PAYMENT_SPLIT`** (`payment_splits`):
   - Splits onde actor é receiver
   - Usado para calcular `totalDistributedViaSplit`

3. **`SERVICE_PAYMENT_REQUEST`** (`service_payment_requests`):
   - Payment requests (para histórico, se necessário)

---

## 4. PROJECTOR IMPLEMENTADO

### Backend

1. **`economic-overview.projector.ts`**:
   - `projectActorEconomicOverview()`: Calcula overview econômico de um actor
     - Busca execuções como payer
     - Busca execuções como receiver
     - Busca splits como receiver
     - Calcula totais e constrói últimas transações
   - `projectGroupEconomicOverview()`: Calcula overview econômico de um grupo
     - Busca execuções como receiver
     - Busca splits como receiver
     - Calcula totais e constrói últimas transações
   - `projectReadModel()`: Método de compatibilidade (não faz nada, dados calculados sob demanda)

---

## 5. SERVICE IMPLEMENTADO

### Backend

1. **`economic-overview.service.ts`**:
   - `getActorEconomicOverview()`: Busca overview econômico de um actor
     - Valida que actor existe
     - Calcula overview a partir de dados históricos
   - `getGroupEconomicOverview()`: Busca overview econômico de um grupo
     - Valida que grupo existe
     - Valida que actor é do tipo 'group'
     - Calcula overview a partir de dados históricos

---

## 6. ENDPOINTS IMPLEMENTADOS

### Backend

1. **`GET /economy/actors/:actorId/overview`**:
   - Buscar overview econômico de um actor
   - READ-ONLY - apenas visualização histórica
   - Retorna: `{ ok: true, data: ActorEconomicOverview }`

2. **`GET /economy/groups/:groupId/overview`**:
   - Buscar overview econômico de um grupo
   - READ-ONLY - apenas visualização histórica
   - Retorna: `{ ok: true, data: GroupEconomicOverview }`

---

## 7. MAPEAMENTO EFFECT → READ MODELS

### Effects que Afetam Economic Overview

1. **`SERVICE_PAYMENT_REQUESTED`**:
   - Afeta: `ACTOR_ECONOMIC_OVERVIEW_READ_MODEL`

2. **`SERVICE_PAYMENT_EXECUTED`**:
   - Afeta: `ACTOR_ECONOMIC_OVERVIEW_READ_MODEL`, `GROUP_ECONOMIC_OVERVIEW_READ_MODEL`

3. **`SERVICE_PAYMENT_SPLIT_APPLIED`**:
   - Afeta: `ACTOR_ECONOMIC_OVERVIEW_READ_MODEL`, `GROUP_ECONOMIC_OVERVIEW_READ_MODEL`

---

## 8. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`economic-overview.types.ts`**:
   - Explica que este domínio NÃO cria dinheiro, NÃO executa pagamento e NÃO decide nada
   - Explica que ele apenas EXIBE o que já aconteceu
   - Explica que isto NÃO é banco, NÃO é carteira, NÃO é saldo
   - Explica que isto é apenas visualização histórica

2. **`economic-overview.projector.ts`**:
   - Comentários: "Apenas visualização histórica, não cria nada"
   - Comentários: "Calcula agregações a partir de PAYMENT_EXECUTION, PAYMENT_SPLIT"
   - Comentários: "Economic Overview Read Models são calculados sob demanda"
   - Comentários: "Não precisam ser persistidos, apenas calculados quando solicitados"

3. **`economic-overview.service.ts`**:
   - Comentários: "Apenas visualização histórica, não cria nada"
   - Comentários: "NÃO é banco, NÃO é carteira, NÃO é saldo"
   - Comentários: "Calcular overview a partir de dados históricos"
   - Comentários: "Não cria nada, apenas agrega dados existentes"

4. **`economic-overview.routes.ts`**:
   - Comentários: "READ-ONLY - apenas visualização histórica"
   - Comentários: "NÃO cria dinheiro, NÃO executa pagamento, NÃO decide nada"
   - Comentários: "Apenas EXIBE o que já aconteceu"
   - Comentários: "NÃO é banco, NÃO é carteira, NÃO é saldo"

---

## 9. VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS

---

## 10. ARQUIVOS CRIADOS/ALTERADOS

### Backend (novos)

1. `src/modules/economy/economic-overview.types.ts`
   - Tipos do dashboard econômico

2. `src/modules/economy/economic-overview.projector.ts`
   - Projector para calcular overview econômico

3. `src/modules/economy/economic-overview.service.ts`
   - Service com lógica de negócio

4. `src/modules/economy/economic-overview.routes.ts`
   - Rotas Fastify

5. `src/modules/economy/economy.module.ts`
   - Módulo do dashboard econômico

### Backend (alterados)

6. `src/core/read-models/read-model.types.ts`
   - Adicionado: `ACTOR_ECONOMIC_OVERVIEW_READ_MODEL`, `GROUP_ECONOMIC_OVERVIEW_READ_MODEL`

7. `src/core/read-models/read-model.projector.ts`
   - Adicionado mapeamento Effect → Read Models para economic overview

8. `src/server.ts`
   - Registrado módulo economy com prefix `/economy`

---

## 11. EXEMPLOS DE USO

### Buscar Overview Econômico de um Actor

```typescript
GET /economy/actors/{actorId}/overview
```

Resposta:
```json
{
  "ok": true,
  "data": {
    "actorId": "uuid-do-actor",
    "tenantId": "uuid-do-tenant",
    "totalReceived": 1000.00,
    "totalPaid": 500.00,
    "totalDistributedViaSplit": 200.00,
    "executionsCount": 5,
    "lastTransactions": [
      {
        "transactionId": "uuid-da-transacao",
        "type": "payment_execution",
        "amount": 100.00,
        "currency": "FIC",
        "payerActorId": "uuid-do-payer",
        "receiverActorId": "uuid-do-receiver",
        "executedAt": "2024-12-19T10:00:00Z",
        "metadata": {}
      }
    ],
    "currency": "FIC",
    "lastUpdated": "2024-12-19T10:00:00Z"
  }
}
```

### Buscar Overview Econômico de um Grupo

```typescript
GET /economy/groups/{groupId}/overview
```

Resposta:
```json
{
  "ok": true,
  "data": {
    "groupId": "uuid-do-grupo",
    "tenantId": "uuid-do-tenant",
    "totalReceived": 2000.00,
    "totalDistributedViaSplit": 500.00,
    "executionsCount": 10,
    "lastTransactions": [
      {
        "transactionId": "uuid-da-transacao",
        "type": "payment_split",
        "amount": 50.00,
        "currency": "FIC",
        "receiverActorId": "uuid-do-grupo",
        "executedAt": "2024-12-19T10:00:00Z",
        "metadata": {
          "executionId": "uuid-da-execucao"
        }
      }
    ],
    "currency": "FIC",
    "lastUpdated": "2024-12-19T10:00:00Z"
  }
}
```

---

**Status Final**: ✅ **DASHBOARD ECONÔMICO (READ-ONLY) IMPLEMENTADO E VALIDADO**

