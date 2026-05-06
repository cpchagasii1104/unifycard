# actor_registry — baseline DDL (projeção de authority)

**Data:** 2026-04-16 (UTC)

## Decisão de referência

- `docs/02_decisions/actor_registry_authority_projection.md` — **APROVADO** (validação normativa humana).

## Ficheiros

- `backend/migrations/20260529130000_actor_registry_baseline.sql` — `CREATE TABLE actor_registry`, índices, RLS, trigger `updated_at`.
- `backend/src/core/authorization/authorization.service.ts` — ownership: `user` \| `actor_human` \| `person` quando `actors.user_id === userId` (alinhamento `0064_add_user_id_to_actors.sql`).
- `backend/src/core/db/load-backend-env.ts` — carregamento canónico de `backend/.env` + correção de `DATABASE_URL` com `#` na senha (partilhado por migrate, pool, BOOT, schema-guard).

## Aplicação no ambiente alvo

- **Método:** `psql "$DATABASE_URL"` com URL lida de `backend/.env` (PowerShell), `-f` na migration acima.
- **Resultado:** `CREATE TABLE` / índices / RLS / trigger — **OK** (`COMMIT`).
- **Verificação:** `information_schema.tables` → `actor_registry` presente em `public`.

## Nota operacional

- **Causa raiz do `28P01` (Node vs `psql`):** o `dotenv` truncava `DATABASE_URL` no primeiro `#` da senha (comentário); `psql` com a linha lida “crua” do `.env` recebia a senha completa. **Correção:** módulo `backend/src/core/db/load-backend-env.ts` (raiz do pacote + releitura da linha), integrado em `migrate.ts`, `database/pool.ts`, `BOOT.ts`, `schema-guard.ts`.
- **Estado:** `pnpm --filter unificard-backend run migrate` — **OK** (migration `20260529130000_actor_registry_baseline.sql` registada via runner).

## População

- **Não executada neste passo** — DDL estrutural apenas; linhas em `actor_registry` são decisão controlada e separada (ver PROPOSTA § população).

## Próximo passo sugerido

- Reexecutar fluxo API que dependia de `actor_registry` / `canActAs` (ex.: marketplace com JWT + `x-action-context`), após confirmar servidor com código atualizado.
