# SPRINT 83 — TAXA REGIONAL + ECONOMIA COMUNITÁRIA

## OBJETIVO

Formalizar o fluxo econômico regional:
- Taxas de pagamento
- Retorno para região
- Transparência total
Sem executar dinheiro real externo.

---

## 1. MIGRATION

### 1.1. `220_create_regional_fees.sql`

Tabela `regional_fees`:
- `id`, `tenant_id`, `region_id`
- `source_type` (PAYMENT, EVENT, SUBSCRIPTION)
- `source_id`
- `gross_amount` (em centavos)
- `fee_percentage` (ex: 3.50)
- `fee_amount` (em centavos)
- `settlement_id` (vinculado quando liquidado)
- `metadata`, `created_at`
- RLS habilitado
- Índices por tenant_id, region_id, source_type, settlement_id

---

## 2. SERVICE

### 2.1. RegionalFeeService

**Arquivo:** `backend/src/modules/marketplace/regional-fee.service.ts`

**Métodos:**
- `createFee()` - Cria taxa regional (snapshot)
- `listFees()` - Lista taxas com filtros
- `getFeesByRegion()` - Busca taxas por região
- `summarizeByPeriod()` - Resume taxas por período
- `linkToSettlement()` - Vincula taxa a settlement

**Integrações:**
- ✅ SettlementService: cria regional_fee quando settlement é liquidado
- ✅ Auditoria em todas as ações

---

## 3. INTEGRAÇÃO

### 3.1. SettlementService.settle()

**Fluxo:**
1. Settlement é liquidado (status SETTLED)
2. Se `feeAmountCents > 0`, cria `regional_fee` (snapshot)
3. Vincula `regional_fee` ao `settlement_id`
4. Taxa registrada para transparência e auditoria

**Código:**
```typescript
// Em settlement.service.ts, após liquidar settlement:
if (settledSettlement.feeAmountCents > 0) {
  await regionalFeeService.createFee(tenantId, {
    regionId: settledSettlement.regionId,
    sourceType: settledSettlement.sourceType === 'TICKET' ? 'EVENT' : 'PAYMENT',
    sourceId: settledSettlement.sourceId,
    grossAmount: settledSettlement.grossAmountCents,
    feePercentage: (settledSettlement.feeAmountCents / settledSettlement.grossAmountCents) * 100,
    feeAmount: settledSettlement.feeAmountCents,
    settlementId: settledSettlement.id,
  });
}
```

---

## 4. GUARDRAILS

- ✅ Fee ≠ Split
- ✅ Fee ≠ Payout
- ✅ Fee ≠ Tax
- ✅ Nenhuma execução automática externa
- ✅ Apenas modelagem e registro
- ✅ Tudo auditável

---

## 5. ROTAS REST

### 5.1. `GET /marketplace/regions/:id/fees`

Lista taxas regionais de uma região.

**Query params:**
- `startDate` (opcional)
- `endDate` (opcional)

**Resposta:**
```json
{
  "fees": [
    {
      "id": "...",
      "regionId": "...",
      "sourceType": "PAYMENT",
      "sourceId": "...",
      "grossAmount": 10000,
      "feePercentage": 3.50,
      "feeAmount": 350,
      "settlementId": "...",
      "createdAt": "..."
    }
  ]
}
```

### 5.2. `GET /marketplace/regions/:id/fees/summary`

Resume taxas regionais por período.

**Query params:**
- `startDate` (opcional, padrão: 30 dias atrás)
- `endDate` (opcional, padrão: hoje)

**Resposta:**
```json
{
  "summary": {
    "regionId": "...",
    "periodStart": "...",
    "periodEnd": "...",
    "totalFees": 3500,
    "feeCount": 10,
    "bySourceType": {
      "PAYMENT": {
        "totalFees": 2000,
        "feeCount": 5
      },
      "EVENT": {
        "totalFees": 1500,
        "feeCount": 5
      }
    }
  }
}
```

---

## 6. DOCUMENTAÇÃO

Este documento resume a implementação da Sprint 83.

---

## 7. NOTAS

- Taxas são criadas como snapshot quando settlement é liquidado
- Nenhum cálculo retroativo
- Tudo snapshotado para transparência
- Regional fees são apenas registro, não executam dinheiro real



