# Log de execução — validação boot backend (MODO: EXECUTOR)

**Data:** 2026-03-21  
**Objetivo:** Build limpo, boot com `REDIS_ENABLED=false`, `PORT=3001`, health checks.  
**Status:** SUCESSO PARCIAL (build + processo estável; DB local inválido neste ambiente)

## Ações realizadas

1. **`pnpm build` (backend)** — falhou inicialmente por duplicatas em `identity.service.ts` (import e métodos duplicados).
2. **Correção mínima** — removido import duplicado de `normalizeCpf`/`validateCpf` e bloco duplicado (`ensureIdentityRecordForGlobalUser`, primeira versão de `ensureGenesisActorForUser` / `ensureCanonicalActorChain`), mantendo a implementação que resolve `canonicalUserId` via query.
3. **`pnpm build`** — PASSOU após correção.
4. **Workers** — `pool.connect()` fora de `try` em ciclos com `setInterval` gerava rejeição não tratada e derrubava o Node (ex.: `settlement-worker`). Ajuste mínimo: `let client` + `connect` dentro de `try`, `client?.release()` / `client?.query('ROLLBACK')` em `settlement-worker`, `release-worker`, `treasury-split-worker`, `treasury-distribution-worker`.
5. **`pnpm dev`** — com `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/unificard_dev` neste host a autenticação PostgreSQL falhou (`28P01`); servidor HTTP subiu e permaneceu ativo após correção dos workers.
6. **HTTP** — `GET http://127.0.0.1:3001/health` → **200**. `GET http://127.0.0.1:3001/internal/financial/health` → **500** (dependência de queries ao pool / DB).

## Arquivos afetados

- `backend/src/core/identity/identity.service.ts`
- `backend/src/workers/settlement-worker.ts`
- `backend/src/workers/release-worker.ts`
- `backend/src/workers/treasury-split-worker.ts`
- `backend/src/workers/treasury-distribution-worker.ts`

## Observação normativa

Leitura integral de todos os ficheiros em `docs/01_normative/` (ordem 00→99) não foi reproduzida token-a-token nesta execução; o entrypoint `00_AGENT_PROTOCOL.md` foi lido e seguido para registo em `docs/03_execution_log/`.
