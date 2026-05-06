# FASE 6D-B — core/pilot K3 (Repository / Row) — Log de Execução

**Data:** 2026-02-22  
**Modo:** ENGENHEIRO DE TIPOS — ARQUITETURAL (convenção K3 core/pilot)  
**Escopo:** Apenas `backend/src/core/pilot` (repositories listados no diagnóstico K3).

---

## 1. Convenção aplicada

A mesma convenção da 6D-A:

- **Multi-row:** `runQueriesWithTenant<T>` → retorno `T[]`. Caller usa `.map`, `.length`.
- **Single-row:** `runQueryWithTenant<T>` → retorno `T | undefined`. Caller usa `if (!row)` e `row` (nunca `row[0]` nem `row.length`).
- **Aggregate:** Tipo explícito (ex.: `{ count: string }`, `{ total: string }`). Caller acessa a propriedade; para “existe?” usa `result != null`.
- **Sem `.rows`:** Nenhum repository expõe QueryResult ao caller.

---

## 2. Arquivos alterados

| Arquivo | Alterações |
|---------|------------|
| `institutional-memory.repository.ts` | **create:** `if (!result)` e uso de `result` em vez de `result[0]`. **list:** `runQueriesWithTenant` e `rows.map`. **updateVersion:** `if (!result)` e uso de `result`. **softDelete:** retorno `{ declaration_id }` e `return result != null`. **findById:** `if (!result) return null` e uso de `result`. Import de `runQueriesWithTenant` adicionado. |
| `pilot-checklist.repository.ts` | **upsertItem:** `if (!result)` e uso de `result`. **listByUser:** `runQueriesWithTenant` e `rows.map`. **listUsers:** `runQueriesWithTenant` e `rows.map`. Import de `runQueriesWithTenant` adicionado. |
| `pilot-events.repository.ts` | **create:** `if (!result)` e uso de `result`. **findByActorAndType:** `if (!result) return null` e uso de `result`. **list:** `runQueriesWithTenant` e `rows.map`. **count:** tipo `{ total: string }` e `result != null ? parseInt(result.total, 10) : 0`. Import de `runQueriesWithTenant` adicionado. |
| `pilot-hypotheses.repository.ts` | **create:** `if (!result)` e uso de `result`. **list:** `runQueriesWithTenant` e `rows.map`. **delete:** `return result != null && parseInt(result.count, 10) > 0`. Import de `runQueriesWithTenant` adicionado. |
| `pilot-notes.repository.ts` | **create:** `if (!result)` e uso de `result`. **listByUser:** já usava `runQueriesWithTenant` e `rows.map`. **delete:** `return result != null && parseInt(result.count, 10) > 0`. Import de `runQueriesWithTenant` adicionado. |

**Observação:** `pilot-invites.repository.ts` não foi alterado nesta fase (não estava na lista de arquivos K3 do diagnóstico por arquivo para core/pilot; pode ser tratado em 6D-C ou fase posterior).

---

## 3. TS2339 antes / depois

| Métrica | Valor |
|--------|--------|
| **TS2339 antes (pós 6D-A)** | **262** |
| **TS2339 depois (pós 6D-B)** | **253** |
| **Redução** | **9** |

Nenhum TS2339 restante em `core/pilot` na saída de `npx tsc --noEmit` após as alterações.

---

## 4. Confirmações

- **Nenhum cast introduzido:** Não foi usado `as`, `any`, `!` ou `as unknown as` para resolver erros.
- **Nenhum repository de pilot passa a vazar QueryResult:** Todos usam `runQueryWithTenant` (uma row) ou `runQueriesWithTenant` (array); o caller nunca vê `.rows`.
- **Nenhum contrato externo alterado:** Apenas tipos de retorno e uso interno; assinaturas públicas dos métodos mantidas (retorno de domínio: `PilotNote`, `PilotHypothesis`, etc.).
- **Padrão igual ao diagnóstico:** K3-A (uso como array em retorno single) foi corrigido trocando para `runQueriesWithTenant` onde há lista e tratando single row com `if (!result)` e `result`. Nenhum padrão inesperado surgiu.

---

## 5. Comando de verificação

```bash
cd backend && npx tsc --noEmit
```

Contagem TS2339: **253**. Nenhum erro em arquivos de `core/pilot` relacionados ao cluster K3.

---

*FASE 6D-B concluída. Próximo passo sugerido: 6D-C (QueryResult residual em módulos isolados: companies, scripts, testes).*
