# DT-WALLET-CONSUMERS-CENTS-MIGRATION — Convergência completa para `_cents` canônico

**Data:** 2026-05-12
**Modo:** EXECUTOR (convergência mecânica autônoma — diretiva mestre §2)
**Branch:** `rescue-structural`
**Escopo:** Frontend apenas. Zero alteração de schema, backend ou comportamento runtime do ledger.

---

## Contexto

Sub-frente A (commit `ec395abb`) corrigiu o bug 100x na Wallet e abriu DT-WALLET-CONSUMERS-CENTS-MIGRATION para os 4 consumers restantes que ainda exibiam saldo/valor 100x maior:

- `CompanyFinancialTab.tsx` — saldo + extrato da aba Financeiro de empresa
- `CompanyOverviewTab.tsx` — saldo na aba Visão Geral de empresa
- `HomeContextual.tsx` — card de saldo + última transação na home
- `activity-aggregation.service.ts` — descrições humanas no timeline institucional

A diretiva mestre (`project_framework_operacional_diretiva.md`) autoriza convergência mecânica autônoma quando: norma já decide, drift mapeado, ajuste cross-layer coerente com DECISION vigente, bug observável.

Esta DT atende todos os critérios. Convergência conduzida sem ping-pong.

## Prova §2.2.2

- **Documentos lidos:** `07_NOMENCLATURA_CANONICA` §4.7; DECISION-0032 (status operacional lowercase, contexto adjacente); commit `ec395abb` (padrão estabelecido pela Sub-frente A); `frontend/src/utils/money.ts` (helper canônico criado nesta sessão)
- **SSOT:** `07_NOMENCLATURA_CANONICA` §4.7 + backend `bank-http.routes.ts:165-171` (envia `balanceCents` canônico); `transparency.service.ts:11-37` (envia `amountCents`/`balanceAfterCents` canônicos)
- **Pilar afetado:** Semântica linguística cross-layer + UI observável. Não toca causalidade financeira no ledger (correção de **unidade de exibição**).
- **Modo:** EXECUTOR

## Ações executadas

### Migração dos 4 consumers principais

| Arquivo | Mudança |
|---|---|
| `frontend/src/components/company/tabs/CompanyFinancialTab.tsx` | Import `centsToReais`. State `balance` → `balanceCents`. Fallback canônico-primeiro `(balanceCents ?? balance ?? null)`. Função local `formatCentsAsBRL` aplica `centsToReais` antes de `Intl.NumberFormat`. `entry.amount` → `entry.amountCents`. |
| `frontend/src/components/company/tabs/CompanyOverviewTab.tsx` | Mesmo padrão. State, fallback, formatação, `activity.amount` → `activity.amountCents`. |
| `frontend/src/components/home/HomeContextual.tsx` | Import `centsToReais`. Interface `HomeContextualData.balance` → `balanceCents`; `lastTransaction.amount` → `lastTransaction.amountCents`. Função local `formatCentsAsBRL`. Todos os pontos de exibição migrados (`situation-balance`, `home-card-balance`). |
| `frontend/src/services/activity-aggregation.service.ts` | Import `centsToReais`. Metadata `amount` → `amountCents`. Função `formatCurrency` renomeada para `formatCentsAsBRL` (aplica conversão). `buildTransactionDescription` migrado. |

### Migração de 2 services adicionais (descobertos durante varredura)

A varredura de campos legados revelou 2 services que faziam checagens semânticas via `(balance as any).balance` (bypass de tipo). Migrados para `balance.balanceCents ?? balance.balance ?? 0`:

| Arquivo | Mudança |
|---|---|
| `frontend/src/services/operational-limits.service.ts:244` | Bypass `(balance as any).balance <= 0` → `balanceCents <= 0` com fallback canônico. |
| `frontend/src/services/workflow-detection.service.ts:131` | Mesmo padrão para `hasBalance` (checagem `!== 0`). |

### Limpeza de bank.ts

Após migração de todos os consumers internos, o tipo `BankBalance.balance` permanece como `@deprecated` opcional **apenas para tolerância a instâncias antigas do backend** (em runtime atual sempre vem `balanceCents`). Tipos `BankStatementEntry.amount` e `BankStatementEntry.balanceAfter` foram **removidos** porque backend nunca envia esses campos legados (apenas `amountCents`/`balanceAfterCents` — confirmado em `transparency.service.ts:11-37`).

Header do arquivo atualizado para refletir convergência completa.

## Verificação

```bash
cd C:/unificard/frontend && npx tsc --noEmit 2>&1; echo "EXIT=$?"
# Resultado: EXIT=0 (TSC 0 erros)
```

Auditoria pós-migração: zero ocorrências de `.amount` ou `.balanceAfter` (sem sufixo `Cents`) em arquivos migrados.

## Estado pós-correção

| Item | Estado |
|---|---|
| Wallet.tsx exibe saldo correto (Sub-frente A) | ✅ Mantido |
| CompanyFinancialTab exibe saldo + entries em reais | ✅ Corrigido |
| CompanyOverviewTab exibe saldo + activities em reais | ✅ Corrigido |
| HomeContextual exibe saldo + última transação em reais | ✅ Corrigido |
| activity-aggregation.service descreve transações com valores em reais | ✅ Corrigido |
| operational-limits.service e workflow-detection.service usam centavos canônicos para checagens | ✅ Corrigido |
| Build TSC frontend | ✅ 0 erros |
| Backend, schema SQL, comportamento runtime ledger | ✅ Inalterados |
| Bug 100x em UIs financeiras | ✅ **Eliminado em todos os consumers diretos de api/bank** |

## Drift adjacente identificado (NÃO migrado nesta frente)

Durante a varredura, foram identificados 7 componentes que exibem valores monetários mas **NÃO importam de `api/bank.ts`** — usam `api/transparency.ts` ou tipos próprios:

- `Dashboard.tsx`, `FundAdminPanel.tsx`, `GlobalContextBar.tsx`, `HeaderGlobal.tsx`
- `MFIBankRecentTransactions.tsx`, `MFIBankSummary.tsx`, `RegionalFundAdmin.tsx`

Drift análogo (campos `.balance`/`.amount`/`.balanceAfter` sem `Cents`) provavelmente existe nesses arquivos. **NÃO investigado nesta frente** — é DT separada (`api/transparency.ts` tem shape próprio que precisa investigação dedicada).

**DT registrada:** DT-TRANSPARENCY-API-CENTS-CONVERGENCE
**Critério de convergência (§25 norma assintótica):** próxima sessão que tocar UI de admin financeiro, dashboard ou MFIBank, migrar consumer simultaneamente. Sem sessão dedicada agora — princípio anti-buraco-negro.

## Aderência ao protocolo

- ✅ Modo EXECUTOR declarado
- ✅ §2.2.2 Prova de rastreabilidade
- ✅ §-1.5 — bug observável em produção; cross-layer coerente com DECISION-0032 + §4.7; reversível
- ✅ §7 — log institucional criado
- ✅ §10 — não tocou norma (apenas aplicou §4.7 vigente)
- ✅ Diretiva mestre §2 — convergência mecânica autônoma legítima (norma decide, drift mapeado, bug observável)
- ✅ Diretiva mestre §10 — reduz divergência sem criar nova; aproxima sistema de UMA verdade soberana (centavos canônicos em toda exibição monetária do frontend)
- ✅ §25 norma assintótica — drift adjacente registrado como DT com critério de convergência, não expandido

## Pendência derivada

- **DT-TRANSPARENCY-API-CENTS-CONVERGENCE** — 7 componentes que importam `api/transparency.ts` provavelmente têm drift análogo. Ver lista acima. Convergência gradual quando sessão tocar essas UIs.

---

**FIM DO LOG. DT-WALLET-CONSUMERS-CENTS-MIGRATION encerrada (todos os 4 consumers diretos de `api/bank.ts` convergidos para `_cents`).**
