# REBASE-04_3 — Boot do backend (SSOT)

**Data:** 2026-03-18  
**Executor:** AGENT (validação + tentativa de boot)

---

## PASSO 1 — Validação do banco

| Verificação | Resultado |
|-------------|-----------|
| `payment_splits` ausente | **Não confirmado** — consulta não executada |
| `social_ledger` ausente | **Não confirmado** — consulta não executada |
| `bank_transactions`, `bank_splits`, `bank_ledger`, `bank_accounts` presentes | **Não confirmado** — consulta não executada |

**Motivo:** `psql` contra `localhost` / `postgres` / `unificard_dev` retornou **FATAL: autenticação do tipo senha falhou**. Sem credenciais válidas no ambiente do executor, o PASSO 1 fica **bloqueado**.

**Query prevista (reexecutar localmente):**

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'payment_splits', 'social_ledger',
    'bank_transactions', 'bank_splits', 'bank_ledger', 'bank_accounts'
  );
```

Esperado: **nenhuma** linha para `payment_splits` e `social_ledger`; **quatro** linhas para as tabelas `bank_*`.

---

## PASSO 2 — Migrations (Genesis + SSOT)

### Inventário no repositório

| Ficheiros Genesis (0001 → 0006) | Presentes |
|---------------------------------|-----------|
| `0001_extensions.sql` … `0006_forward_only_lock.sql` | Sim |

### Além do Genesis

Existem migrations **0007** … **0057** no diretório `backend/migrations/`. O runner (`migrate.ts`) usa perfis (ex.: `CORE_ONLY` / `FULL`) e lista de ignoradas — **validação “aplicadas na BD”** exige `schema_migrations` via DB ou:

`cd backend && npx tsx scripts/check-migrations-state.ts`

**Estado no executor:** não executado (depende de PostgreSQL).

---

## PASSO 3 — Boot do backend

**Comando:** `cd backend && pnpm start` → `node dist/server.js`

**Resultado:** **falha imediata** (processo termina com código 1).

---

## PASSO 4 — Erros capturados

| Tipo | Detalhe |
|------|---------|
| Conexão BD | Não atingido (boot não chegou a inicializar stack completo) |
| Migration | Nenhum erro de migration observado no boot (falha antes) |
| Tabelas/colunas | Não aplicável nesta execução |
| Inicialização | **ReferenceError: exports is not defined in ES module scope** em `dist/server.js` |

**Trecho relevante:**

```
package.json contém "type": "module"
dist/server.js emite CommonJS (Object.defineProperty(exports, "__esModule" ...)
```

---

## PASSO 5 — Classificação

| Erro | Classe |
|------|--------|
| `exports is not defined` no start | **Erro de código / artefacto de build** — desalinhamento **ESM** (`"type": "module"`) vs saída **CommonJS** em `dist/*.js` |
| Falha psql | **Erro de integração / ambiente** — credenciais ou serviço PostgreSQL |
| Genesis “aplicado” não verificado | **Integração** — requer BD |

**Não observado nesta sessão:** erro estrutural de schema (sem query à BD).

---

## PASSO 6 — Blocos afetados

- **Boot:** `backend/package.json` (`start`), `backend/dist/**` (output do `tsc`/build).
- **Validação BD:** qualquer fluxo que dependa de `DATABASE_URL` / PostgreSQL.
- **Migrations:** `schema_migrations` + ficheiros `0001`–`0057`.

---

## PASSO 7 — Resumo executivo

| Pergunta | Resposta |
|----------|----------|
| Backend subiu? | **NÃO** |
| Lista de erros | (1) Start: ESM vs CJS em `dist/server.js`. (2) Validação BD: auth PostgreSQL falhou. |
| Próximo bloqueio | **1)** Corrigir pipeline de build para emitir ESM **ou** ajustar entrypoint/start para CJS compatível com `"type": "module"`. **2)** Executar PASSO 1 e PASSO 2 com credenciais PostgreSQL válidas e BD `unificard_dev` (ou alvo SSOT). |

---

## Conformidade com restrições

- Não foram criadas tabelas manualmente.
- Não foram alteradas migrations.
- Não foi improvisada estrutura de schema.
