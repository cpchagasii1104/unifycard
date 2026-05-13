# DT-TRANSPARENCY-API-CENTS-CONVERGENCE — Convergência mecânica frontend (Frente 1)

**Data:** 2026-05-13
**Modo:** EXECUTOR (Frente 1 autorizada por Clayton — convergência mecânica safe)
**Branch:** `rescue-structural`
**Commit anterior:** `f15ed8c7` (Frente 3 — DT-C36-actor-debts)
**DT encerrada:** DT-TRANSPARENCY-API-CENTS-CONVERGENCE (OPEN → CLOSED)

---

## Contexto

DT-TRANSPARENCY-API-CENTS-CONVERGENCE estava OPEN desde commit `11f028d9` (sessão anterior — DT-WALLET-CONSUMERS-CENTS-MIGRATION). Mapeamento original via grep `\.balance\b|\.amount\b|\.balanceAfter\b` listou 7 components com bug 100x latente. Backend `transparency.service.ts` + `identity.routes.ts /wallet` + `dashboard.service.ts` já expunham `_cents` nos campos transaction-level (§4.7 conforme); faltava frontend convergir.

Diretiva Clayton: "Verifique rapidamente o shape real do endpoint /transparency. Se backend já expõe _cents, execute convergência frontend completa. Se encontrar divergência material backend/frontend, pare e reporte. Caso contrário, siga autonomamente até TSC + gates."

## Prova §2.2.2

- **Documentos lidos:** `REMEDIATION_DT_LOG.md` (DT-TRANSPARENCY); `frontend/src/api/transparency.ts` (shape frontend); `backend/src/core/unifybank/transparency.service.ts` (shape backend); `backend/src/core/identity/identity.routes.ts:743+` (`/wallet`); `backend/src/core/dashboard/dashboard.service.ts` (`/dashboard`); `frontend/src/utils/money.ts` (helpers `centsToReais`, `formatCentsAsBRL`); §4.7 (07_NOMENCLATURA); §25 (norma assintótica)
- **SSOT operacional:** §4.7 monetário sempre `_cents` BIGINT
- **Pilar afetado:** Frontend (visualização monetária). NÃO toca causalidade do ledger.
- **Modo:** EXECUTOR (autorização explícita; escopo claro; padrão validado em `11f028d9`)

## Diagnóstico do shape

| Backend (já envia conforme §4.7) | Frontend (legacy antes da frente) |
|---|---|
| `StatementEntry.amountCents` | `amount` |
| `StatementEntry.balanceAfterCents` | `balanceAfter` |
| `RegionalFundView.currentBalanceCents` | `currentBalance` |
| `RegionalFundAdminView.currentBalanceCents` | `currentBalance` |
| `RegionalFundEntry.amountCents` | `amount` |
| `SplitDetail.baseTransaction.amountCents` | `amount` |
| `SplitDetail.splits[].amountCents` | `amount` |
| `WalletData.balanceCents` (`/identity/wallet`) | `balance` |
| `wallet.balanceCents` (`/dashboard`) | `wallet.balance` |
| `wallet.lastTransactions[].amountCents` (`/dashboard`) | `tx.amount` |

## Dívida adjacente preservada (backend↔norma)

Backend ainda usa nomes sem `_cents` em campos summary embora valores sejam centavos:
- `summary.totalIn/totalOut/netAmount` (RegionalFundView, RegionalFundAdminView)
- `summary.byOrigin/byContext/byPeriod.totalIn/totalOut`
- `SplitDetail.totalAmount`, `SplitDetail.totalPercentage`
- `wallet.totalIn/totalOut` (`/dashboard`)

Frontend convergido tratando-os como centavos via convenção (`centsToReais(field)`). Convergência de nome no backend fica para frente futura.

## Escopo executado (11 arquivos)

### Tipos canônicos
- `frontend/src/api/transparency.ts` — rename `amount → amountCents`, `balanceAfter → balanceAfterCents`, `currentBalance → currentBalanceCents`; comentário institucional referenciando §4.7 + dívida adjacente

### 7 components mapeados na DT (6 convergidos, 1 dead code)
- ✅ `Dashboard.tsx`
- ❌ `FundAdminPanel.tsx` — **dead code efetivo** (endpoint `/fund/admin/regions` sem handler no backend; componente retorna 404 em runtime). Não tocado.
- ✅ `home/GlobalContextBar.tsx`
- ✅ `layout/HeaderGlobal.tsx` (`WalletData.balance` → `balanceCents`)
- ✅ `mfibank/MFIBankRecentTransactions.tsx`
- ✅ `mfibank/MFIBankSummary.tsx`
- ✅ `RegionalFundAdmin.tsx`

### 5 consumers extras descobertos via TSC pós-rename
- ✅ `governance/RegionalFundCard.tsx`
- ✅ `governance/TransactionSplitDetail.tsx`
- ✅ `RegionalFundUser.tsx`
- ✅ `TransactionDetail.tsx`
- ✅ `hooks/useHomeData.ts`

## Padrão de edit aplicado em todos os 10 consumers

```typescript
// import
import { centsToReais } from '<path>/utils/money';

// uso (centavos → reais antes de Intl.NumberFormat)
formatCurrency(centsToReais(value.fooCents))
```

Field renames coerentes com o tipo (`X.amount → X.amountCents`, `X.balanceAfter → X.balanceAfterCents`, `X.currentBalance → X.currentBalanceCents`).

## Verificação

- TSC frontend: 0 erros (após convergência completa)
- 4 gates institucionais (backend não tocado, baseline preservado):
  - `validate:actor-writer-boundaries`: GATE OK [§4.8.1]
  - `validate:bank-ledger-boundaries`: GATE OK [§4.6]
  - `validate:regression-guards`: GATE OK [financial + sql-lint + 299 migrations]
  - `validate:architecture`: critical_new=0, baseline preservado

## Lições estruturais consolidadas

### Lição 1 — Rename de tipo é melhor "grep" que grep semântico

DT mapeou 7 components via `grep -RnE "\.balance\b|\.amount\b|\.balanceAfter\b"`. TSC pós-rename revelou 5 consumers adicionais (`RegionalFundCard`, `TransactionSplitDetail`, `RegionalFundUser`, `TransactionDetail`, `useHomeData`). Padrão futuro: ao planejar convergência de campo tipado, renomear primeiro o tipo e deixar TSC enumerar os consumers reais.

### Lição 2 — Dead code revelado por endpoint ausente

`FundAdminPanel.tsx` chama endpoint `/fund/admin/regions` que não tem handler no backend (grep `RegionFundData|getRegionsData|growth7Days|admin/regions` retornou vazio). Componente retorna 404 em runtime. Decisão: não tocar nesta frente; marcar como dead code candidato em frente futura.

### Lição 3 — Calibração nova validada (objetivo + restrições + fronteiras)

Frente executada com baixa coreografia procedural:
- Diretiva Clayton: 1 parágrafo (objetivo + restrição + fronteira de parada + autorização autônoma)
- Verificação shape: 4 reads paralelos
- Decisão: backend já conforme nos campos relevantes → executar autonomamente
- Convergência: 26 edits iniciais + 14 edits após TSC revelar consumers extras
- Validação: TSC + 4 gates pós

Sem ping-pong de aprovação intermediária. Fronteira "paro e consulto" não foi acionada (não houve divergência material backend/frontend; todos os endpoints monetários já estavam conforme §4.7 nos transaction-level fields).

## Aderência ao protocolo

- ✅ Modo EXECUTOR declarado (autorização Clayton para Frente 1)
- ✅ §2.2.2 prova de rastreabilidade
- ✅ §-1.5 — não bloqueia runtime; visualização monetária correta restaurada; reversível
- ✅ Verificação prévia do shape backend antes de tocar frontend
- ✅ TSC validado pós-cada-rodada-de-edits (não pulei)
- ✅ 4 gates institucionais PASS
- ✅ §4.7 (norma) vencendo em runtime
- ✅ §25 (norma assintótica) — dívida adjacente backend↔norma preservada com critério de convergência (próxima frente que tocar `transparency.service.ts`)
- ✅ §29 (git add específico) — stage apenas dos 11 arquivos do escopo
- ✅ §7 — log institucional criado (este arquivo)

---

**FIM DO LOG. DT-TRANSPARENCY CLOSED. Bug 100x eliminado em 10 components frontend (Dashboard, GlobalContextBar, HeaderGlobal, MFIBankRecentTransactions, MFIBankSummary, RegionalFundAdmin, RegionalFundCard, TransactionSplitDetail, RegionalFundUser, TransactionDetail) + hook useHomeData. FundAdminPanel marcado como dead code (endpoint backend ausente). Convergência _cents iniciada em 11f028d9 fechada na camada frontend.**
