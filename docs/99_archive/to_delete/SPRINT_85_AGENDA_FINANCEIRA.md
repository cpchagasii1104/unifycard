# SPRINT 85 — AGENDA FINANCEIRA (CASHFLOW PROJETADO)

## OBJETIVO

Dar visão de futuro:
- Contas a pagar
- Contas a receber
- Settlements agendados
- Ações programadas

---

## 1. SERVICE

### 1.1. FinancialAgendaService

**Arquivo:** `backend/src/modules/marketplace/financial-agenda.service.ts`

**Métodos:**
- `getUpcomingPayables()` - Busca contas a pagar futuras
- `getUpcomingReceivables()` - Busca contas a receber futuras
- `getUpcomingSettlements()` - Busca settlements futuros
- `getUpcomingScheduledActions()` - Busca ações programadas futuras
- `getAgenda()` - Busca agenda financeira completa
- `getCashflowProjection()` - Calcula projeção de cashflow

**Fonte de Dados:**
- AccountsPayable (due_date)
- AccountsReceivable (expected_at)
- ScheduledActions (scheduled_for)
- Settlements (planned_at no metadata)

---

## 2. REGRA

- ✅ READ-ONLY
- ✅ Nenhuma execução
- ✅ Nenhuma alteração
- ✅ Apenas projeção

---

## 3. ROTAS REST

### 3.1. `GET /marketplace/finance/agenda`

Busca agenda financeira.

**Query params:**
- `startDate` (opcional)
- `endDate` (opcional, padrão: 90 dias)
- `types` (opcional, separado por vírgula: PAYABLE,RECEIVABLE,SETTLEMENT,SCHEDULED_ACTION)
- `limit` (opcional, padrão: 100)
- `offset` (opcional, padrão: 0)

**Resposta:**
```json
{
  "items": [
    {
      "id": "...",
      "type": "PAYABLE",
      "date": "2024-01-15T00:00:00Z",
      "amount": 50000,
      "currency": "BRL",
      "description": "Conta a pagar - PURCHASE_ORDER",
      "status": "PENDING",
      "metadata": {
        "payableId": "...",
        "supplierId": "...",
        "referenceType": "PURCHASE_ORDER",
        "referenceId": "..."
      }
    },
    {
      "id": "...",
      "type": "RECEIVABLE",
      "date": "2024-01-20T00:00:00Z",
      "amount": 30000,
      "currency": "BRL",
      "description": "Conta a receber - MARKETPLACE_ORDER",
      "status": "PENDING",
      "metadata": {
        "receivableId": "...",
        "actorId": "...",
        "sourceType": "MARKETPLACE_ORDER",
        "sourceId": "..."
      }
    }
  ]
}
```

### 3.2. `GET /marketplace/finance/cashflow`

Calcula projeção de cashflow.

**Query params:**
- `periodStart` (opcional, padrão: hoje)
- `periodEnd` (opcional, padrão: 90 dias)

**Resposta:**
```json
{
  "projection": {
    "periodStart": "2024-01-01T00:00:00Z",
    "periodEnd": "2024-03-31T00:00:00Z",
    "items": [...],
    "totalInflow": 500000,
    "totalOutflow": 300000,
    "netCashflow": 200000,
    "byDate": {
      "2024-01-15": {
        "inflow": 50000,
        "outflow": 30000,
        "net": 20000
      },
      "2024-01-20": {
        "inflow": 100000,
        "outflow": 50000,
        "net": 50000
      }
    }
  }
}
```

---

## 4. DOCUMENTAÇÃO

Este documento resume a implementação da Sprint 85.

---

## 5. NOTAS

- Agenda financeira é READ-ONLY
- Não executa nenhuma ação
- Não altera nenhum dado
- Apenas projeta fluxo de caixa futuro
- Agrupa dados de múltiplas fontes (payables, receivables, settlements, scheduled actions)
- Permite visualizar cashflow projetado por data



