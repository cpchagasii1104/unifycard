# Marketplace — fundo regional e compensação alinhados ao Bank (flag opt-in)

**Data:** 2026-04-14  
**Escopo:** `backend/src/modules/marketplace/` + `backend/src/modules/bank/bank-account.service.ts` + `backend/src/core/features/use-bank-regional-fund.ts`  
**Norma:** `SSOT_REGISTRY_UNIFICARD.md` §5.9.2; `MARKETPLACE_ECOSYSTEM_AUDIT_MVP.md` (addendum F3/F4)

---

## 1. Objectivo

Eliminar **segunda fonte de verdade** para dinheiro do fundo regional e para registo de compensação de recurso, **sem** remover tabelas legado nem activar comportamento novo por defeito.

---

## 2. Variável de ambiente

| Variável | Default | Efeito |
|----------|---------|--------|
| `USE_BANK_REGIONAL_FUND` | *(ausente ou ≠ `true`)* → **false** | Quando `true` (case-insensitive), activa leitura/escrita Bank descritas abaixo. |

Documentação no código: `backend/src/core/features/use-bank-regional-fund.ts`  
Exemplo comentado: `backend/.env.example`

---

## 3. Ficheiros tocados (implementação)

| Área | Ficheiro (principal) |
|------|----------------------|
| Flag | `backend/src/core/features/use-bank-regional-fund.ts` |
| Conta Bank por região | `backend/src/modules/bank/bank-account.service.ts` — `ensureRegionalFundBankAccountForRegion` |
| Saldo regional (leitura) | `backend/src/modules/marketplace/regional-fund.service.ts` — `getRegionalFundByRegion` |
| Incentivo | `backend/src/modules/marketplace/application/services/marketplace-orchestration.service.ts` — `consumeIncentive` |
| Compensação | `backend/src/modules/marketplace/application/services/capacity-application.service.ts` — `recordResourceCompensationLedger`; `compensationId` = UUID (`uuidv4`) |
| Resolução de wallet | `backend/src/modules/marketplace/marketplace-regional-fund-bank.helpers.ts` — `resolveIncentiveRecipientAccountId`, namespace UUID para incentivo |
| Rotas | `backend/src/modules/marketplace/routes/marketplace-capacity.routes.ts` — `process-compensation` exige `req.tenant` |
| Cadeia tenant | `marketplace-compensation.service.ts`, `marketplace-capacity.service.ts` — `processResourceCompensation(tenantId, …)` |

**Padrão de conta regional (owner_id):** `system:regional_fund:{tenant_id}:{country}-{state}-{city}`

---

## 4. Comportamento por flag

### 4.1 `USE_BANK_REGIONAL_FUND=false` (default)

- Saldo em `getRegionalFundByRegion`: `regional_funds.total_balance_cents` (legado).
- `consumeIncentive`: `allocateRegionalFund` + `executeAllocation` (SQL em `regional_funds` / `regional_fund_allocations`).
- `recordResourceCompensationLedger`: retorno stub `ledger-resource-compensation-{id}`.

### 4.2 `USE_BANK_REGIONAL_FUND=true`

- Saldo em `getRegionalFundByRegion`: `bankAccountService.getBalance` na conta criada/garantida por `ensureRegionalFundBankAccountForRegion`.
- `consumeIncentive`: `bankTransactionService.transfer` — `reference_type = regional_fund_incentive`, `reference_id = uuidv5(grantId, namespace)`, `treasurySource = treasury:settlement`, origem = conta regional Bank.
- `recordResourceCompensationLedger`: `bankTransactionService.transfer` — `reference_type = resource_compensation`, `reference_id = compensationId` (UUID), origem MVP = **`platform_revenue`** (dívida de produto: futuro alinhar a seller/escrow conforme norma).

**Dependência de identity:** destino exige actor `user` com `user_id` ou `page` com `company_id`; caso contrário erro explícito (alinhado a CP-5 / RFC person→user).

---

## 5. Piloto em staging (operacional)

1. Ambiente **não** produção; tenant e região fixos.  
2. Verificar saldos em **conta regional** e **`platform_revenue`** antes de testar compensação; sem liquidez, **`INSUFFICIENT_FUNDS`** é esperado (sistema correcto).  
3. Executar **um** `consumeIncentive` e **uma** `resource_compensation`.  
4. Consultas read-only sugeridas (ajustar `:tenant_id`, `:transaction_id`):

```sql
SELECT id, tenant_id, reference_type, reference_id, amount_cents, purpose, created_at
FROM bank_transactions
WHERE tenant_id = :tenant_id
  AND reference_type IN ('regional_fund_incentive', 'resource_compensation')
ORDER BY created_at DESC
LIMIT 10;
```

```sql
SELECT id, tenant_id, transaction_id, account_id, direction, amount_cents, created_at
FROM bank_ledger
WHERE tenant_id = :tenant_id AND transaction_id = :transaction_id
ORDER BY direction, id;
```

```sql
SELECT transaction_id,
       COUNT(*) AS n,
       COUNT(*) FILTER (WHERE direction = 'debit') AS deb,
       COUNT(*) FILTER (WHERE direction = 'credit') AS cred
FROM bank_ledger
WHERE tenant_id = :tenant_id AND transaction_id = :transaction_id
GROUP BY transaction_id;
```

5. **Idempotência:** repetir a mesma operação com o mesmo `grantId` / `compensationId`; não deve haver nova `bank_transaction` nem novas linhas de ledger para a mesma chave canónica.  
6. **Saldo:** Δ coerente com a soma das linhas do ledger nas contas envolvidas.

---

## 6. Critério GO / NO-GO (estrutural)

- **GO:** exactamente **2** linhas em `bank_ledger` por `transaction_id` (1 debit + 1 credit); idempotência verificada; saldo derivado coerente com o ledger.  
- **NO-GO:** qualquer violação estrutural acima (ledger incompleto, duplicação indevida, saldo sem ledger).

Erros de produto (`INSUFFICIENT_FUNDS`, ATL, coverage) **não** invalidam GO **se** não houver transação aceite com ledger incorrecto.

---

## 7. Encadeamento com LOTE 1 (identity)

Quando o trilho **LOTE 1** (`PROPOSTA_MATERIAL_LOTE_1_TENANT_9bdc.md`) tiver avançado em staging até **users** + **identities** + **batch2** conforme PASSOs da PROPOSTA, os actores passam a ter `user_id` / `company_id` resolvíveis — condição para **não falhar** a resolução de wallet nos fluxos com `USE_BANK_REGIONAL_FUND=true` (`resolveIncentiveRecipientAccountId`).

**Ordem sugerida (operacional):** PASSOs 1–4 da PROPOSTA → precheck → (opcional) teste **incentivo / compensação** com flag + evidência §5–6 deste ficheiro.

---

## 8. Itens em aberto (pós-MVP)

- Origem da compensação: hoje **`platform_revenue`**; evoluir para conta da loja / escrow quando a norma e o risco gate o permitirem.  
- `regional_funds.total_balance_cents`: com flag ON deixa de ser actualizado pelo fluxo de incentivo; tabela permanece até migração de dados e remoção de leitores legado.  
- Camada **dívida derivada do ledger** (`getActorDebt` + guard): proposta de produto; **não** implementada neste entregável.

---

*Este ficheiro substitui notas soltas sobre o piloto; actualizar aqui quando o staging tiver evidência colada (output cru SQL + idempotência + saldo) e decisão **GO** / **NO-GO**.*
