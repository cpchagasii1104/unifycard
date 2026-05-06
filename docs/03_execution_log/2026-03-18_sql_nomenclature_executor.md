# Log de execução — SQL snake_case / tenants.id

- **Modo:** EXECUTOR (conforme `docs/01_normative/00_AGENT_PROTOCOL.md`)
- **Data:** 2026-03-18
- **Objetivo:** Alinhar SQL bruto ao schema PostgreSQL (`snake_case`; PK `tenants.id`); corrigir seeds; memória social.

## Status

**SUCESSO** — `pnpm build` concluído sem erros (TypeScript).

## Ações realizadas

1. **Seeds / tenants:** `tenant_id` em `tenants` substituído por `id` em scripts e queries (`seed-dev-complete.ts`, `seed-tenant-context-permissions.ts`, `core/db/seed.ts`, `seed-dev-tenant.ts`, `seed-dev-user.ts`, `seed-health-taxonomies.ts`, `verify-dev-user.ts`, `print-demo-city-nova.ts`).
2. **`system-tenant.ts`:** UUID fixo `SYSTEM_TENANT_ID`, `INSERT` com `id`, `created_at`, `updated_at`; lookup por `id` ou `slug`.
3. **Memória:** `memory.repository.ts`, `memory.types.ts` (rows), `memory.model.ts`, `assistant-context.service.ts` — colunas `created_at`, `updated_at`, `last_used_at`, `first_interaction_at`, `last_interaction_at`.
4. **Social:** `social-group.repository.ts` — `posts.created_at` / `updated_at` no SQL; resposta API mantém `createdAt` onde aplicável.
5. **Tenants runtime:** `tenant.service.ts`, `notify.worker.ts`, `notify.processor.ts`, `pilot-friction.job.ts`, `subscription-expiration.job.ts`, `assignment.service.ts`, `events-multi-actor.service.ts` — `SELECT id` / `WHERE id` e timestamps `created_at`/`updated_at` onde aplicável.

## Arquivos afetados (lista principal)

- `backend/src/scripts/seed-dev-complete.ts`
- `backend/src/scripts/seed-tenant-context-permissions.ts`
- `backend/src/core/db/seed.ts`
- `backend/src/scripts/seed-dev-tenant.ts`
- `backend/src/scripts/seed-dev-user.ts`
- `backend/src/scripts/seed-health-taxonomies.ts`
- `backend/src/scripts/verify-dev-user.ts`
- `backend/src/scripts/print-demo-city-nova.ts`
- `backend/src/core/tenants/system-tenant.ts`
- `backend/src/core/tenants/tenant.service.ts`
- `backend/src/core/memory/memory.repository.ts`
- `backend/src/core/memory/memory.types.ts`
- `backend/src/core/memory/memory.model.ts`
- `backend/src/core/assistant-context/assistant-context.service.ts`
- `backend/src/modules/social/social-group.repository.ts`
- `backend/src/core/notify/notify.worker.ts`
- `backend/src/core/notify/notify.processor.ts`
- `backend/src/core/pilot/pilot-friction.job.ts`
- `backend/src/core/jobs/subscription-expiration.job.ts`
- `backend/src/modules/work/assignments/assignment.service.ts`
- `backend/src/modules/events/events-multi-actor.service.ts`

## Padrão adotado

- **SQL:** `snake_case` para colunas (`created_at`, `updated_at`, `id` em `tenants`).
- **`global_users` (migration 0058):** não alterada; código em `identity.routes` já usa `"createdAt"` com alias quando necessário.
- **Login:** não executado neste ambiente (sem servidor HTTP); build valida tipos.

## Próximos passos sugeridos

- Testar manualmente `POST /auth/login` com backend em execução.
- Repositórios ainda com `createdAt` em SQL bruto (ex.: `categories.repository.ts`, `crm.repository.ts`, `trust.service.ts`) — alinhar ao DDL real por tabela em rodada seguinte.
