# REBASE-04.1 — Bloqueio de nova deriva financeira

**Data:** 2026-03-18  
**Modo:** EXECUTOR  
**Objetivo:** Impedir novas linhas em `payment_splits` e `social_ledger`.

---

## Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `backend/src/modules/services/service-payment-execution.repository.ts` | Início de `createSplit`: `throw new Error('DERIVA_FINANCEIRA_BLOQUEADA')` — bloqueia todo `INSERT INTO payment_splits`. |
| `backend/src/modules/social/social-ledger.service.ts` | Início de `recordEntry`: `throw new Error('DERIVA_FINANCEIRA_BLOQUEADA')` — bloqueia todo `INSERT INTO social_ledger`. |

---

## Pontos bloqueados (escrita)

| Estrutura | Ponto único de escrita em `backend/src` | Status |
|-----------|----------------------------------------|--------|
| `payment_splits` | `ServicePaymentExecutionRepository.createSplit` | **BLOQUEADO** |
| `social_ledger` | `SocialLedgerService.recordEntry` | **BLOQUEADO** |

**Busca complementar:** não há `UPDATE`/`DELETE` em `payment_splits` ou `social_ledger` em `backend/src`.

**Leituras** (não alteradas): `economic-overview.projector.ts`, `groups-closure.routes.ts`, `findSplitsByExecutionId`, `social-ledger.service.ts` (leituras), `social-2.0.service.ts` (agregações no feed).

---

## Build

```text
cd backend && pnpm build
```

**Resultado:** **SUCESSO** (exit code 0) — `tsc -p tsconfig.build.json && tsc-alias`.

---

## Efeito operacional

- Novas execuções de pagamento de serviço que criem splits **falham** ao chamar `createSplit`.
- Novos lançamentos via API que usem `recordEntry` **falham**.

---

## Próximos passos (não executados neste log)

- Caminho único `bank_*`; correção dupla transação; migração de dados.
