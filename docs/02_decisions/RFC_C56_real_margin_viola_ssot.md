# RFC — C56: `real-margin.service.ts` deriva receita via metadata (VIOLA_SSOT)

**Status:** APPROVED — AGUARDA EXECUÇÃO  
**Prioridade:** CRITICAL — VIOLA_SSOT  
**Branch:** rescue-structural  
**Data:** 2026-04-23  
**Ref:** REMEDIATION_DECISIONS_LOG_APPEND.md §C56

---

## DECISÃO FINAL

**Escolhido: Abordagem A2 — adicionar `order_id` em `bank_transactions`**

A Abordagem A1 (mapping via `reference_type`) foi **descartada** por:
- não ser canônica — depende de strings não-normativas
- risco de gap: novos fluxos podem não usar os tipos mapeados
- cria dependência de convenção frágil, não de estrutura
- produz "pseudo-chave" em cima de texto, não FK real

Esta decisão é **irreversível** para este fluxo.  
**NÃO implementar A1 em nenhuma circunstância.**

---

## 1. Problema

`real-margin.service.ts` calcula receita, descontos e margem líquida a partir de
`order_items.metadata` (campo JSONB), sem qualquer referência a `bank_ledger`.

O sistema não sabe quanto dinheiro foi efetivamente recebido.
Ele **estima** com base em dados comerciais que podem divergir do valor liquidado.

Viola diretamente: `§SSOT Financeiro → bank_ledger é a única fonte de verdade`.

---

## 2. Evidência

### SQL atual (L70–L163) — PROIBIDO após C56

```sql
WITH order_revenue AS (
  SELECT
    SUM(
      COALESCE(
        (oi.metadata->'priceSnapshot'->>'finalPrice')::numeric,
        (oi.metadata->>'price')::numeric,
        0
      ) * oi.quantity
    ) AS gross_revenue,
    SUM(
      COALESCE(
        (oi.metadata->'priceSnapshot'->>'discountAmount')::numeric,
        0
      )
    ) AS discounts
  FROM order_items oi
  ...
  WHERE ... AND pt.status = 'SUCCESS'
)
```

### Por que `pt.status = 'SUCCESS'` não é suficiente

- `SUCCESS` não garante settlement
- Não cobre chargebacks, reversais parciais, taxas variáveis
- Não cobre splits alterados após a transação
- O ledger é a única fonte que reflete o valor efetivamente liquidado

### Cenário de bug real

```
priceSnapshot.finalPrice = 100
desconto aplicado depois  = 20
chargeback parcial        = 10
taxa variável             = 3.50

ledger real:    receita = 66.50
cálculo atual:  receita = 100.00  ← ERRADO
```

---

## 3. Divergências confirmadas

| Componente | Fonte atual (PROIBIDA) | Fonte correta |
|------------|------------------------|---------------|
| Receita bruta | `oi.metadata->'priceSnapshot'->>'finalPrice'` | `bank_ledger` créditos ligados ao pedido |
| Descontos | `oi.metadata->'priceSnapshot'->>'discountAmount'` | `bank_ledger` diferença nominal vs liquidado |
| Canal | `o.metadata->>'source'` | Aceitável (dado de roteamento, não financeiro) |
| Fees | `payment_intent_splits.amount` | `bank_ledger` débitos de fee |
| Payouts | `payment_intent_splits.amount` | `bank_ledger` transferências de payout |

---

## 4. Impacto

| Caller | Impacto atual |
|--------|--------------|
| `pricing-strategy.service.ts` | Decisões de precificação baseadas em margem incorreta |
| `decision-simulation.service.ts` | Simulações com receita estimada, não real |
| `reports/reports.routes.ts` | Relatórios financeiros incorretos |

---

## 5. Estratégia de execução (A2)

### Passo 1 — Migration: adicionar `order_id` em `bank_transactions`

```sql
-- forward-only, safe em banco vazio
ALTER TABLE bank_transactions
ADD COLUMN order_id UUID REFERENCES orders(id) ON DELETE RESTRICT;

CREATE INDEX idx_bank_transactions_order_id
ON bank_transactions(order_id)
WHERE order_id IS NOT NULL;
```

Numeração: próxima migration disponível (verificar sequência atual).

### Passo 2 — Propagar `order_id` no fluxo marketplace

Identificar chamadas de `bank-transaction.service.ts` originadas de marketplace.
Adicionar `orderId?: string` como parâmetro opcional na assinatura do transfer.

Regra:
- Callers de marketplace: **DEVEM** passar `orderId`
- Outros domínios: passam `undefined` → coluna fica NULL

Arquivos afetados (a confirmar na execução):
- `bank-transaction.service.ts` — adicionar `order_id` nos INSERTs de `execution`
- Callers de marketplace que invocam transfer

### Passo 3 — Reescrever `real-margin.service.ts`

Substituir CTE `order_revenue` baseado em metadata por query ledger-based:

```sql
-- RASCUNHO — purpose a confirmar com dados reais (ver seção 8)
SELECT
  bt.order_id,
  SUM(bl.amount_cents) AS gross_revenue
FROM bank_ledger bl
JOIN bank_transactions bt ON bt.id = bl.transaction_id
WHERE bt.order_id = ANY($1::uuid[])
  AND bl.direction = 'credit'
  AND bt.purpose IN (/* confirmar — ver seção 8 */)
GROUP BY bt.order_id
```

**ATENÇÃO:** filtro por `purpose` deve ser confirmado com dados seed antes de hardcodar.
Enum atual: `{execution, settlement, split, refund, reallocation, donation, expiration,
initial_credit, group_allocation, escrow_hold, escrow_release}`.

### Passo 4 — Remover derivação de metadata financeira

Proibido após C56:
- `metadata->'priceSnapshot'->>'finalPrice'`
- `metadata->'priceSnapshot'->>'discountAmount'`
- `metadata->>'price'`
- Qualquer cast `::numeric` de metadata para fins financeiros decisórios

### Passo 5 — Atualizar callers

- `pricing-strategy.service.ts`
- `decision-simulation.service.ts`
- `reports/reports.routes.ts`

---

## 6. Regra de integridade (enforcement obrigatório)

**Para qualquer transação originada do domínio marketplace:**

```
bank_transactions.order_id DEVE ser preenchido
```

É **proibido**:
- criar transação de marketplace sem `order_id`
- inferir `order_id` posteriormente via `reference_type`
- usar A1 (mapping por strings) como substituto desta FK

---

## 7. Observação sobre o ledger

O `bank_ledger` continua sendo a **única fonte de verdade financeira**.

`order_id` em `bank_transactions` é apenas um **índice de rastreabilidade** —
não substitui nem altera a semântica do ledger.

A receita real é sempre: `SUM(bank_ledger.amount_cents WHERE direction = 'credit')`,
filtrada via `bank_transactions.order_id`.

---

## 8. Pré-requisitos antes da execução

1. **Confirmar `purpose` relevante para marketplace** — rodar em banco com dados seed:
   ```sql
   SELECT DISTINCT bt.purpose, COUNT(*)
   FROM bank_transactions bt
   WHERE bt.order_id IS NOT NULL
   GROUP BY bt.purpose;
   ```

2. **Confirmar próxima numeração de migration:**
   ```powershell
   Get-ChildItem "C:\unificard\backend\migrations" | Sort-Object Name | Select-Object -Last 5
   ```

3. **Seed + E2E disponível** — validar fluxo completo após Passo 2

---

## 9. Plano de execução (ordem obrigatória)

```
1. Migration (Passo 1) — sem tocar código
2. Propagar order_id nos callers de marketplace (Passo 2)
3. Confirmar purpose com seed real (seção 8)
4. Reescrever real-margin.service.ts (Passo 3)
5. Remover metadata financeira (Passo 4)
6. Atualizar callers (Passo 5)
7. Rodar 4 gates CI
8. E2E completo antes de declarar fechado
```

**NÃO pular etapas. NÃO executar Passo 3 sem confirmar purpose (seção 8).**

---

## 10. Estado

- RFC aprovado: ✅ (decisão A2 — 2026-04-23)
- Execução: aguarda sessão dedicada
- Banco vazio: impacto zero de dados
- Aprovação Clayton para Passo 2: **necessária antes de executar**

---

*Gerado em: 2026-04-23*  
*Violação: C56 — CRITICAL, VIOLA_SSOT*  
*Ref: REMEDIATION_DECISIONS_LOG_APPEND.md §C56*
