# Runbook — Reconciliação SSOT vs derivado (INFRA-3)

Objetivo: **detetar e auditar** desvio entre estado append-only (SSOT) e projeções/cache — **sem corrigir dados automaticamente**. O derivado nunca substitui o SSOT; drift pode existir após falhas de projeção ou bugs históricos.

## Como executar manualmente

### SQL (psql ou cliente)

1. **Inventário** (`inventory_balances` vs `inventory_movements`):

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/scripts/sql/reconciliation_inventory.sql
   ```

   Com tenant (substituir o placeholder no cliente; o script usa `$1`):

   ```sql
   -- Copiar o conteúdo de reconciliation_inventory.sql e executar com:
   -- $1 = 'uuid-do-tenant'
   ```

2. **Ledger** (`bank_ledger` vs `reconciliation_balance_cents`):

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/scripts/sql/reconciliation_ledger.sql
   ```

   Apenas contas com `reconciliation_balance_cents IS NOT NULL` são comparadas.

3. **Reservas** (soma total vs soma ACTIVE):

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/scripts/sql/reconciliation_reservations.sql
   ```

### API UnifyBank (admin prefix, ex.: `/admin`)

- `GET .../metrics/reconciliation/summary?tenantId=<uuid opcional>` — contagens por tipo e severidade agregada.
- `GET .../metrics/reconciliation/drift?tenantId=<uuid opcional>` — lista de findings (`type`, `entityId`, `drift`, `severity`).

Se `tenantId` for enviado e **não** for um UUID válido, a API responde `400` (evita varrer todos os tenants por typo). Omita o parâmetro para executar em todos os tenants (uso restrito em produção).

Cada chamada executa as três verificações e **emite métricas em memória** (`metric_event`: `reconciliation_drift_detected`, `reconciliation_run_completed`) via logger canónico, agregáveis com o mesmo pipeline INFRA-6 dos handlers (ex.: exposição Prometheus em `/metrics/handlers` quando aplicável).

### Serviço (código)

`reconciliationService.runFullReconciliation(tenantId?)` em `backend/src/core/reconciliation/reconciliation.service.ts` — só leitura; mesmo resultado conceitual que os endpoints.

## Interpretação do drift

| Tipo            | Significado |
|-----------------|------------|
| **inventory**   | `inventory_balances.current_quantity` ≠ soma canónica dos movimentos (IN/OUT/ADJUSTMENT). |
| **ledger**      | Σ `bank_ledger` (credit − debit) ≠ `reconciliation_balance_cents` para contas onde essa coluna está preenchida. |
| **reservation** | Soma de `quantity` em todas as linhas ≠ soma só das linhas `ACTIVE` (ex.: linhas RELEASED/CONSUMED ainda com quantity positivo indevido). |

## Quando é crítico

- Qualquer linha devolvida pelas queries ou qualquer item no JSON `drifts` com `severity: critical` deve ser tratado como **incidente de integridade**: investigar causa raiz antes de confiar em dashboards de saldo/reserva.
- **Ledger**: drift em centimos afeta confiança em reconciliação financeira explícita (`reconciliation_balance_cents`).

## Quando pode ignorar (temporariamente)

- **Ledger**: zero linhas no drift **se** não existir nenhuma conta com `reconciliation_balance_cents` definido — a query não compara “todo o universo”, só referências opcionais.
- Ambiente de desenvolvimento com dados sintéticos incompletos — ainda assim, documentar o motivo.

## Quando fazer rebuild (sem violar SSOT)

- **Inventário**: rebuild da projeção a partir de `inventory_movements` (SSOT), usando o procedimento canónico do projeto (ex. scripts/jobs de rebuild de balances), **nunca** editar movimentos append-only para “ajustar” o saldo.
- **Reservas**: corrigir estado/quantidades via fluxos de domínio (liberar/consumir), não UPDATE ad hoc em produção sem runbook específico.
- **Ledger**: o SSOT é o ledger; `reconciliation_balance_cents` é referência — alinhar a referência ou corrigir a fonte que a populou, não apagar lançamentos do ledger.

## Referências

- `backend/scripts/sql/inventory_balances_drift_vs_movements.sql` — equivalente ao drift de inventário.
- `backend/scripts/sql/inventory_reserved_exceeds_onhand.sql` — invariante reservas ACTIVE vs on-hand (complementar).
- Norma de imutabilidade: comentários nas migrations `0102_inventory_movements`, `0003_bank_core`.
