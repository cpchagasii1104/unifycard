# FASE 6D-C — QueryResult residual (companies, scripts, testes) — Log de Execução

**Data:** 2026-02-22  
**Modo:** ENGENHEIRO DE TIPOS — ARQUITETURAL (convenção K3; sem exceção para scripts/testes)  
**Escopo:** Módulos isolados com uso de QueryResult ou `.rows` no caller: companies, scripts, testes.

---

## 1. Convenção aplicada

A mesma das 6D-A e 6D-B:

- **Multi-row:** `runQueriesWithTenant<T>` → retorno `T[]`. Caller nunca vê QueryResult nem `.rows`.
- **Single-row:** `runQueryWithTenant<T>` → retorno `T | undefined`. Caller usa `if (!row)` e `row` (nunca `row[0]` nem `.rows`).
- **Aggregate:** Tipo explícito; caller acessa a propriedade.
- **Scripts e testes:** Seguem a mesma convenção; sem concessão (“subpadrão tolerado”).

Quando não há tenant (ex.: setup de teste que cria o tenant), usa-se `pool.query` e **extração imediata** da row no mesmo bloco; o valor retornado ou usado é sempre a row (ou propriedade), nunca o QueryResult.

---

## 2. Arquivos alterados

| Arquivo | Alterações |
|---------|------------|
| `core/companies/companies.service.ts` | **resolveTenantIdFromGlobalUserId:** Continua usando `pool.query` (sem tenant no contexto da query). Extração feita no método: `const row = result.rows[0]; return row?.tenant_id ?? null`. Caller do método recebe `string \| null`, nunca QueryResult. |
| `scripts/seed-dev-companies-services.ts` | **createPageActor / createService:** Uso de `runQueryWithTenant<T>` com retorno `T \| undefined`. Substituído `existing.rows.length > 0` / `existing.rows[0]` por `if (existing)` e `existing.actor_id` ou early return. Nenhum caller vê QueryResult. (getDevUser continua com client.query e retorna row ou null; extração interna.) |
| `services/events/tests/event_checkout_hardening.test.ts` | **beforeAll:** Uso de `pool.query` para criar tenant e buscar city (sem tenantId ainda). Extração imediata: `tenantRow = tenantResult.rows[0]`, `cityRow = cityResult.rows[0]`; uso de `tenantRow.tenant_id` e `cityRow?.city_id`. Removido qualquer uso de `tenantResult.tenant_id` / `tenantResult.city_id` (QueryResult não tem essas propriedades). **Queries de transações:** Tipos das duas `runQueriesWithTenant` que leem coluna `amount` ajustados para `amount: string` (nome da coluna no SELECT), eliminando TS2339 em `.amount`. |

---

## 3. TS2339 antes / depois

| Métrica | Valor |
|--------|--------|
| **TS2339 antes (pós 6D-B)** | **253** |
| **TS2339 depois (pós 6D-C)** | **245** |
| **Redução** | **8** |

---

## 4. Confirmações

- **Nenhum caller vê QueryResult nesses módulos:** Em companies, o único ponto ajustado (resolveTenantIdFromGlobalUserId) extrai a row e retorna `row?.tenant_id ?? null`. Em scripts, createPageActor/createService usam `runQueryWithTenant` e tratam `existing` como `T | undefined`. No teste, setup usa `pool.query` com extração imediata de row; asserts usam `tenantRow`/`cityRow`.
- **Scripts e testes sem exceção:** Mesma convenção do core; nenhum cast/any/relaxamento para “facilitar” testes ou scripts.
- **Decisão especial em testes:** No `beforeAll` do event_checkout_hardening ainda não existe tenantId; por isso usa-se `pool.query` e extração de `rows[0]` no mesmo bloco, sem expor QueryResult. Tipos das queries de transações que leem a coluna `amount` foram alinhados ao nome da coluna (`amount: string`) para manter testes tipados sem cast.

---

## 5. Comando de verificação

```bash
cd backend && npx tsc --noEmit
```

Contagem TS2339: **245**. Nenhum erro restante nos escopos 6D-C causado por vazamento de QueryResult para caller.

---

## 6. Próximos passos

- K5 (interfaces incompletas / propriedades faltando)
- K7 (Date / request shape)
- Marketplace residual (K4/K8)

Nada mais estrutural de retorno (QueryResult) nos escopos 6D-A/6D-B/6D-C.

---

*FASE 6D-C concluída. Ciclo 6D (K3 / QueryResult) fechado; fase mais semântica (K5) a seguir.*
