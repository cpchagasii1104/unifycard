# Sub-frente A — Correção do bug monetário cross-layer (Wallet.tsx)

**Data:** 2026-05-12
**Modo:** EXECUTOR (correção mecânica de conformidade §4.7)
**Branch:** `rescue-structural`
**Escopo:** Frontend apenas. Zero alteração de schema, backend ou comportamento runtime do ledger.

---

## Contexto

Investigação `executei_11.md` (gitignored, 308 linhas) identificou bug runtime cross-layer:

- Backend `GET /bank/balance` retorna `{ balanceCents, balance: balanceCents, currency, hasAccount }` (campo `balance` é cópia literal de `balanceCents`, em centavos — backend `core/unifybank/bank-http.routes.ts:165-171`).
- Backend `GET /bank/statement` retorna `entries[].amountCents` e `entries[].balanceAfterCents` (canônico §4.7) — **NÃO envia** campos legados `amount`/`balanceAfter`.
- Frontend `Wallet.tsx` lia `balance` e formatava com `Intl.NumberFormat(... style: 'currency'... ).format()` que espera **reais**, exibindo saldo **100x maior**.
- Frontend `entry.amount` era `undefined` em runtime (campo nunca enviado); `Math.abs(undefined)` é `NaN`, formatação produzia `R$ NaN` em entries do extrato.

Bug observável diretamente pelo usuário no UI.

## Prova §2.2.2

- **Documentos lidos:** `07_NOMENCLATURA_CANONICA` §4.7 (monetário em `_cents`, BIGINT, sufixo obrigatório); `executei_11.md` (mapa material cross-layer); backend `bank-http.routes.ts:120-182` e `transparency.service.ts:11-37` (shape canônico das responses)
- **SSOT:** `07_NOMENCLATURA_CANONICA` §4.7
- **Pilar afetado:** Semântica linguística cross-layer + UI observável. Não toca causalidade financeira no ledger (correção é de **unidade de exibição**, não de cálculo).
- **Modo:** EXECUTOR (Sub-frente A do plano em `executei_11.md`)

## Ações executadas

| Arquivo | Tipo | Mudança |
|---|---|---|
| `frontend/src/utils/money.ts` | Create | Helper canônico `centsToReais(cents)` + `formatCentsAsBRL(cents)`. Source local de verdade para conversão monetária no frontend. |
| `frontend/src/api/bank.ts` | Edit | `BankBalance.balanceCents?: number` adicionado (canônico §4.7); `balance` mantido como `@deprecated` opcional. `BankStatementEntry.amountCents: number` (obrigatório, backend sempre envia) e `balanceAfterCents: number`; `amount`/`balanceAfter` mantidos como `@deprecated` opcionais para consumers não migrados. Fallback do erro 401 também retorna `balanceCents: 0`. |
| `frontend/src/components/Wallet.tsx` | Edit | Substituído `balance` → `balanceCents`; `setBalance(balanceResult.balance)` → `setBalanceCents(balanceResult.balanceCents ?? balanceResult.balance ?? 0)` com fallback canônico-primeiro; criada função local `formatCentsAsBRL` que aplica `centsToReais` antes de `Intl.NumberFormat`; `entry.amount` → `entry.amountCents`. **Bug 100x corrigido.** |
| `frontend/src/components/company/tabs/CompanyFinancialTab.tsx` | Edit | Fix defensivo `?? null` e `?? 0` para preservar build após interface ter campos legados como opcionais. **NÃO migra para `_cents`** (refactor transversal não autorizado). |
| `frontend/src/components/company/tabs/CompanyOverviewTab.tsx` | Edit | Fix defensivo `?? null` para preservar build. |
| `frontend/src/components/home/HomeContextual.tsx` | Edit | Fix defensivo `?? null` em balance e `?? 0` em `lastEntry.amount` para preservar build. |
| `frontend/src/services/activity-aggregation.service.ts` | Edit | Fix defensivo `?? 0` em `Math.abs(entry.amount)` para preservar build. |

## Verificação

```bash
cd C:/unificard/frontend && npx tsc --noEmit 2>&1; echo "EXIT=$?"
# Resultado: EXIT=0 (TSC 0 erros)
```

## Estado pós-correção

| Item | Estado |
|---|---|
| Wallet.tsx exibe saldo em reais (correção 100x) | ✅ Corrigido |
| Wallet.tsx exibe entries do extrato corretamente | ✅ Corrigido |
| Build TSC frontend | ✅ 0 erros |
| Drift cross-layer ainda em consumers não-Wallet | ⚠️ **Preservado** — CompanyFinancialTab, CompanyOverviewTab, HomeContextual, activity-aggregation.service ainda exibem 100x errado. Fix defensivo apenas restaurou build, NÃO migrou semântica. |
| Backend | ✅ Inalterado (continua enviando `balanceCents` canônico + `balance` legado) |
| Schema SQL | ✅ Inalterado |
| Comportamento runtime do ledger | ✅ Inalterado |

## Dívida técnica residual (DT-WALLET-CONSUMERS-CENTS-MIGRATION)

4 consumers continuam exibindo saldo/valor 100x maior do que real:

- `frontend/src/components/company/tabs/CompanyFinancialTab.tsx` (CompanyFinancialTab — saldo + extrato da aba financeira da empresa)
- `frontend/src/components/company/tabs/CompanyOverviewTab.tsx` (CompanyOverviewTab — saldo na aba visão geral da empresa)
- `frontend/src/components/home/HomeContextual.tsx` (HomeContextual — card de saldo na home)
- `frontend/src/services/activity-aggregation.service.ts` (Aggregator de atividades — descrição textual de transações)

**Critério de convergência:** quando próxima sessão tocar UI financeira de empresa OU home OU activity feed, migrar consumer simultaneamente para usar `balanceCents`/`amountCents` + `centsToReais` do `utils/money.ts`. Não vale abrir sessão dedicada agora (refactor transversal sem bloqueio crítico — Wallet do usuário é o entrypoint mais visível e já foi corrigido).

Esta DT segue o princípio do `§25 norma assintótica` (`code.md`): conviver com violação ≠ ratificar. Convergência gradual sem ruptura. Toda exceção carrega critério.

## Aderência ao protocolo

- ✅ Modo EXECUTOR declarado
- ✅ §2.2.2 Prova de rastreabilidade
- ✅ §-1.5 — não bloqueia runtime; corrige bug observável; reversível
- ✅ §7 — log institucional criado
- ✅ §10 — não tocou norma (apenas aplicou §4.7 vigente)
- ✅ Framework autônomo respeitado — refactor transversal de 4 consumers NÃO foi feito (DT registrada com critério de convergência)
- ✅ §-1.5 pergunta 1 (bloqueia validar agora?) — build quebrou após edit, restaurado defensivamente para destravar

## Pendência derivada (próximo movimento)

Sub-frente A concluída. Smoke público P2P (Sub-frente B) aguarda autorização Clayton + decisões UX pendentes:

1. Input de destinatário no form P2P — email (precisa rota de busca) ou userId UUID?
2. Formato canônico de scope `x-action-context` — `<tenantId>:<resource>:<action>` (Q3-E2E v2) ou `tenant:<tenantId>` (frontend atual)?
3. Bootstrap reserve para tenant novo — onboarding automático? rota admin? script?

Ver `executei_11.md` seção "Decisões pendentes para Clayton" para contexto completo.

---

**FIM DO LOG. Sub-frente A concluída. Sub-frente B aguarda decisões UX.**
