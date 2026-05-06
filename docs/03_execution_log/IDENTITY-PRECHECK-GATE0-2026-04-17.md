# IDENTITY-PRECHECK-GATE0-2026-04-17

**Tipo:** evidência de **bloqueio Gate 0** (infra) — **read-only**; **sem** contagens A1–A4.  
**Norma:** `PLANO_IDENTITY_RECONCILIATION.md` §2.1 só após ligação válida; `STATUS_EXECUCAO_GLOBAL.md`; `EXECUTAR/IDENTITY_RECONCILIATION_RUNBOOK.md` (Gate 0).

---

## Contexto

- Comando previsto: `npm run identity:precheck:a1-a4` (proxy na raiz do monorepo → `backend/scripts/identity-precheck-a1-a4.mjs`).
- Pré-requisito: `backend/.env` com `DATABASE_URL` que permita autenticação ao PostgreSQL alvo.

---

## Resultado (sessão documentada)

| Item | Estado |
|------|--------|
| Ligação `pg` / `DATABASE_URL` | **Falhou** — código PostgreSQL **`28P01`** (autenticação por senha falhou para o utilizador `postgres`) |
| `DB_OK` | **Não** |
| Precheck A1–A4 | **Não executado** (script terminou antes das queries de contagem) |
| A1, A2, A3, A4 | **Indeterminados** — *não existem números válidos para esta sessão* |

---

## Decisão

**Parada normativa** até:

1. Corrigir credenciais / `DATABASE_URL` (ou `pg_hba`) até o teste Gate 0 imprimir **`DB_OK`**.
2. Reexecutar `npm run identity:precheck:a1-a4` e colar **output completo** num ficheiro `IDENTITY-PRECHECK-<DATA_RUN>.txt` (ou anexo a `IDENTITY-RECONCILE-*`).

**Proibido até evidência A1–A4:** batches 1–2, triagem CP-5 material, deduplicação A4, reclassificar §GLOBAL BLOCK com base em contagens inexistentes.

---

*Ficheiro de registo operacional; não substitui SQL colado do precheck quando a ligação existir.*
