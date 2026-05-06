# ONDA 3 — TS2304 (símbolo não encontrado) — Ciclo 1

**Data:** 2026-02-25  
**Modo:** EXECUTOR  
**Âncora:** TS2307 = 0  
**Escopo:** Reduzir TS2304 apenas com categorias 1 (IMPORT AUSENTE) e 3 (TIPO NÃO IMPORTADO).

---

## Resultado

| Métrica | Antes | Depois |
|--------|--------|--------|
| **TS2304** | 132 | 107 |
| **Redução** | — | 25 |
| **Meta ciclo 1** | ≤ 100 | 107 (não atingido) |

---

## Classificação dos TS2304 (resumo)

- **IMPORT AUSENTE (1):** Corrigidos onde o símbolo existe noutro módulo — import adicionado.
- **TIPO NÃO IMPORTADO (3):** Corrigidos onde o tipo existe noutro ficheiro — tipo adicionado ao import.
- **Não corrigidos (fora de escopo neste ciclo):** VARIÁVEL FORA DE ESCOPO (4), REFATORAÇÃO INCOMPLETA (5), INJEÇÃO INCORRETA (2). Serviços/tipos/repos inexistentes (eventSplitDeclarativeService, eventRefundChargebackService, CalculateSplitInput, escrowService, accountsPayableRepository, etc.) e variáveis (value, userId, total, etc.) não foram alterados.

---

## Arquivos modificados

| Arquivo | Ação |
|---------|------|
| `backend/src/core/economy/accounts/account.routes.ts` | Import `accountService` de `../account.service`. |
| `backend/src/core/economy/group-account.service.ts` | Import `accountService` de `./account.service`. |
| `backend/src/core/economy/region-account.service.ts` | Import `accountService` de `./account.service`. |
| `backend/src/core/economy/transactions/transaction.routes.ts` | Import `transactionService` de `../transaction.service`. |
| `backend/src/core/identity/identity.routes.ts` | Imports `NotFoundError` (`@core/errors`), `accountService` (`@core/economy/account.service`), `transactionService` (`@core/economy/transaction.service`), `ledgerService` (`../../modules/ledger/ledger.service`). |
| `backend/src/modules/ledger/ledger.routes.ts` | Import `ledgerService` de `./ledger.service`. |
| `backend/src/modules/work/assignments/assignment.service.ts` | Imports `accountService`, `regionAccountService`, `groupAccountService` de `@core/economy/*`. |
| `backend/src/modules/marketplace/settlement.routes.ts` | Import `regionAccountService` de `./region-account.service`. |
| `backend/src/modules/automation/alert.repository.ts` | Tipo `AlertSeverity` adicionado ao import de `./automation.types`. |
| `backend/src/modules/organization/organization-invite.service.ts` | Tipo `OrganizationMember` adicionado ao import de `./organization.types`. |

---

## Regras respeitadas

- Nenhuma nova classe, interface ou serviço criado.  
- Nenhum stub.  
- Apenas imports corrigidos ou tipos adicionados a imports existentes.  
- TS2322, nullability, contratos, tsconfig e strict não foram alterados.  
- `core/economy/ledger/ledger.routes.ts`: não foi adicionado import de `ledgerService` porque a API esperada (getLedgerEntries, getAccountSummary, verifyLedgerIntegrity) não existe no `ledgerService` de `modules/ledger` — refatoração incompleta, fora de escopo.

---

## TS2304 restantes (107)

- **core/economy/ledger:** 5 (ledgerService — API diferente).  
- **core/events:** 10 (eventSplitDeclarativeService, eventRefundChargebackService, tipos CalculateSplitInput, RequestRefundInput, InitiateChargebackInput).  
- **core/identity:** 1 (userId — variável escopo).  
- **kyc, notify, bank-policy, smart-matching:** 12 (value — variável escopo).  
- **jobs:** 7 (escrowService, accountService — serviços inexistentes/refatoração).  
- **marketplace:** 58 (repos e variáveis — refatoração/variável escopo).  
- **outros (profile, social, groups, services, events/ticket):** 14 (variáveis escopo).

---

**Status:** SUCESSO PARCIAL — redução de 25 TS2304; meta ≤100 não atingida no primeiro ciclo sem tocar em categorias 4 e 5.
