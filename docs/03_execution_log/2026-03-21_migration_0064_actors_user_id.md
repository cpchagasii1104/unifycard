# Migration 0064 — actors: user_id, actor_id, social columns, actor_type

**Data:** 2026-03-21

## Ficheiro

- `backend/migrations/0064_add_user_id_to_actors.sql`

## Conteúdo (resumo)

- `CHECK` de `actor_type` alargado para incluir `'user'`, `'page'`, `'group'`, `'channel'` e valores legados.
- Colunas: `user_id`, `slug`, `company_id`, `group_id`, `avatar_url`, `cover_url`, `bio`, `metadata`, `actor_id` (espelho de `id` + índice único + trigger `trg_actors_sync_actor_id`).
- FK `user_id` → `users(id)` ON DELETE SET NULL; índice parcial em `user_id`.
- Backfill: `user_id` a partir de `users` via `global_user_id` + `tenant_id`.

## Estado

- `pnpm migrate`: **OK** (schema_version 64).

## Validação local

- `findAvailableActors` deixa de falhar em `user_id` ausente; neste ambiente falhou a seguir com `relação "companies" não existe` (42P01) — BD sem tabela `companies` (seed/migrations incompletas para marketplace social).
