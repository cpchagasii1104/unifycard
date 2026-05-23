# Rollback da migração 0092 (grafo global)

A migração **0092** remove `tenant_id` de `categories`, `category_relations` e `concept_relations` e altera constraints UNIQUE. **Não existe rollback SQL seguro** que recrie colunas e repovoe dados sem o estado anterior.

## Procedimento recomendado (reversível)

1. **Antes de aplicar 0092**, executar backup:
   - `node scripts/backup-semantic-graph-tables.mjs`, ou
   - `pg_dump $DATABASE_URL --data-only -t categories -t category_relations -t concept_relations -f backup.sql`

2. **Parar** a aplicação que usa o código pós-0092.

3. **Reverter código** para o commit anterior à migração 0092 + refactor do grafo.

4. **Restaurar dados** (exemplo; ajustar nome do ficheiro):
   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "TRUNCATE concept_relations, category_relations CASCADE;"
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "TRUNCATE categories CASCADE;" 
   ```
   **Atenção:** `TRUNCATE categories` pode falhar se outras tabelas referenciarem `category_id`. Nesse caso usar apenas `DELETE` controlado ou restaurar para uma BD vazia clonada.

   Em alternativa, restaurar dump completo da base num clone e reatribuir `DATABASE_URL`.

5. **Reverter migração no histórico** (se usarem tabela `schema_migrations` / runner interno): remover a entrada `0092` e reaplicar migrações até 0091 numa BD reconstruída, ou restaurar snapshot VM/container da BD.

## Código a reverter em conjunto

- `migrations/0092_global_semantic_graph.sql`
- `src/core/semantic/graph.adapter.ts`
- `src/core/semantic/graph-governance.service.ts`
- `src/core/semantic/semantic.adapter.ts`
- `src/core/profile/profile-inference.service.ts`
- `src/modules/marketplace/marketplace-contextual.service.ts`
- `src/core/navigation/n1-query.adapter.ts`
- `src/core/navigation/navigation-offers.list.ts`
- `src/modules/marketplace/adapters/concept-offer-refs.adapter.ts`
- `src/scripts/seed-category-relations.ts`
- `scripts/verify-graph-governance-trigger.mjs`
