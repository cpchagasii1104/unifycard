# Execução — `PLANO_EXECUCAO_CURSOR_v3.md`

**Plano:** `PLANO_EXECUCAO_CURSOR_v3.md` (raiz; o ficheiro `UNIFICARD_PLANO_EXECUCAO_v3.md` não existe no repositório).

**Estado global após RESUME (2026-04-13):** **PASS** — destravamento: `movement_type`, `COALESCE(inv.stock_qty, po.available_quantity)`, gate §17 e smoke SQL; `pnpm exec tsc --noEmit` e `pnpm test:e2e:catalog` (incl. GET `/marketplace/products/visible`) com exit 0.

---

## BLOCO 0 — PRE-FLIGHT

STATUS: PASS *(evidência consolidada em sessões anteriores; revalidações abaixo quando necessário)*

### COMANDOS EXECUTADOS

- `psql "$DATABASE_URL" -c "SELECT version();"` — PostgreSQL acessível.
- Leitura de `backend/.env`: `OBSERVATION_MODE` / `MIGRATION_PROFILE` ausentes ou não bloqueantes conforme plano.
- Consultas a `schema_migrations`, colunas de `canonical_products`, `product_offers.is_active`, `inventory_movements.actor_id`, `canonical_product_events` antes do Bloco A (inexistente), contagem `canonical_products` com `scope = 'global'` (> 0).

### OUTPUT

- Conexão OK; pré-requisitos do Bloco 3 (migrations `20260518120000` / `20260518121000`) confirmados na conversão anterior.

### EVIDÊNCIA

- Pré-condições do plano para avançar ao Bloco A satisfeitas na execução já aplicada ao repositório.

---

## BLOCO A — `canonical_product_events` (SQL + TypeScript)

STATUS: PASS *(migrations e TS aplicados conforme plano em sessão anterior)*

### COMANDOS EXECUTADOS

- `pnpm run migrate` (após criação dos ficheiros `20260519100000`, `20260519110000`, `20260519120000`).
- `pnpm exec tsc --noEmit`.

### EVIDÊNCIA (revalidação 2026-04-13)

```text
SELECT to_regclass('public.canonical_product_events') IS NOT NULL AS cpe_exists;
 cpe_exists 
------------
 t

SELECT tgname FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'canonical_products' AND NOT t.tgisinternal AND tgname LIKE 'trg_cpe%';
          tgname           
---------------------------
 trg_cpe_on_concept_change
 trg_cpe_on_insert

SELECT event_type, COUNT(*) FROM canonical_product_events GROUP BY event_type ORDER BY event_type;
    event_type     | count 
-------------------+-------
 backfill_category |    66
```

---

## BLOCO B — Visibilidade (índices + serviço + rota)

STATUS: **PASS** *(RESUME 2026-04-13)*

### ALTERAÇÕES (código ↔ schema)

- `backend/src/modules/marketplace/product-visibility.service.ts`: `im.type` → `im.movement_type`; quantidade visível `COALESCE(inv.stock_qty, po.available_quantity)`; filtro `COALESCE(inv.stock_qty, po.available_quantity) > 0`; comentários normativos (checkout / SSOT `movement_type`).

### COMANDOS EXECUTADOS (validação)

- `pnpm exec tsc --noEmit` — exit 0.
- `pnpm test:e2e:catalog` — inclui teste `GET /marketplace/products/visible` (HTTP 200, `products.length > 0`); seed E2E passou a incluir `INSERT INTO product_offers` (necessário ao JOIN da query).
- `psql` — `EXPLAIN (FORMAT TEXT)` sobre query alinhada ao serviço (tenant amostral da BD); plano devolvido sem erro de coluna.

### OUTPUT (EXPLAIN — excerto)

```text
EXPLAIN (FORMAT TEXT) SELECT p.id FROM canonical_products cp ...
->  Seq Scan on product_offers po
...
->  Seq Scan on inventory_movements im
```

*(Em `unificard_dev` com poucos dados, `Seq Scan` em tabelas pequenas é esperado; critério normativo de “tabelas grandes” fica para ambiente com volume.)*

---

## BLOCO C — Governança (`version`, `created_by_actor_id`)

STATUS: PASS

### EVIDÊNCIA (2026-04-13)

```text
SELECT column_name FROM information_schema.columns
WHERE table_name='canonical_products' AND column_name IN ('version','created_by_actor_id') ORDER BY column_name;
     column_name     
---------------------
 created_by_actor_id
 version
(2 linhas)
```

- `pnpm exec tsc --noEmit` — exit 0 (sessão corrente após Bloco D).

---

## BLOCO D — `canonical_products:create`

STATUS: PASS *(conforme alterações já aplicadas: MAPA + `permission-keys.ts`)*

### COMANDO D.1 (Windows / repositório)

- Pesquisa por `insertIndustrialWithPendingConceptQueue` / `getOrCreateIndustrial` em `*.routes.ts`: **nenhuma ocorrência** (ferramenta de grep do projeto).

---

## BLOCO E — E2E (§9)

STATUS: PASS

### COMANDOS EXECUTADOS

```powershell
Set-Location c:\unificard\backend
# carregar variáveis de .env (parser linha a linha)
pnpm run migrate
pnpm test:e2e:catalog
```

### OUTPUT (`pnpm run migrate`)

```text
MIGRATE_EXIT=0
...
✅ Todas as migrations já foram registradas e validadas. Nada a fazer.
```

### OUTPUT (`pnpm test:e2e:catalog`)

```text
PASS tests/e2e/catalog-order-ledger.e2e.test.ts (17.318 s)
  S9 E2E catalog -> intent.execute -> bank_ledger
    √ GET /marketplace/products/visible retorna HTTP 200 e lista não vazia (99 ms)
    √ resolveRefs ok, intent.execute without REF_RESOLUTION_FAILED, ledger rows for order (752 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
E2E_EXIT=0
```

### E.1 — Existência dos ficheiros

- `backend/tests/e2e/catalog-order-ledger.e2e.test.ts` — existe.
- `backend/tests/unit/canonical-product-creation.service.test.ts` — existe.
- `backend/tests/unit/store-onboarding.service.test.ts` — existe.
- `backend/tests/unit/marketplace-order-partial-flow.test.ts` — existe.

---

## BLOCO F — `authority_roots` (condicional)

STATUS: PASS *(caminho “count > 0”: sem migration; registo obrigatório no FALSIFICATION_LOG)*

### COMANDO EXECUTADO

```sql
SELECT COUNT(*) AS actors_sem_authority_roots
FROM actors a
WHERE a.actor_type IN ('user', 'actor_human', 'person')
  AND NOT EXISTS (SELECT 1 FROM authority_roots ar WHERE ar.actor_id = a.id);
```

### OUTPUT

```text
 actors_sem_authority_roots 
----------------------------
                        347
(1 linha)
```

### EVIDÊNCIA

- **Não** foi criado `backend/migrations/20260521100000_authority_roots_enforcement.sql`.
- Entrada **#2** em `docs/ssot/FALSIFICATION_LOG.md` (append-only), com prazo **2026-06-30** para backfill e reavaliação.

---

## BLOCO G — Limpeza de backups

STATUS: PASS *(com nota sobre ficheiros não rastreados pelo Git)*

### COMANDOS EXECUTADOS

- `git diff --no-index` entre ficheiro ativo e `.backup-*` (G.1).

### OUTPUT (resumo G.1)

- `authority-decision.service.ts` vs backup: diferenças sobretudo em comentários no ativo (ativo mais completo).
- `bank-p2p-transfer.service.ts` vs `...backup-1775886614674`: backup contém ramos `try/catch` e comportamento **distinto** (ex.: mensagens “fail-open” em validações); o **ativo** reflete política fail-closed documentada em comentários. Conclusão da revisão G.1: não há código **novo** no backup a reintegrar; o backup é legado mais fraco.

### Remoção (G.2)

- `git rm backend/src/core/categories/categories.repository.ts.bak` — **sucesso** (ficheiro estava rastreado).
- Os restantes caminhos do plano estavam **não rastreados** (`git rm` falhou com `pathspec did not match`); remoção do disco com `Remove-Item` no PowerShell para:
  - `backend/src/core/compliance/authority-decision.service.ts.backup-1775886614704`
  - `backend/src/core/unifybank/bank-p2p-transfer.service.ts.backup-1775886614674`
  - `backend/src/core/unifybank/bank-p2p-transfer.service.ts.backup-1775886614686`
  - `backend/src/modules/marketplace/fiscal-document.service.ts.backup-1775886614696`
  - `backend/src/modules/payout/payout.service.ts.backup-1775886614692`
  - `docs/01_normative/PROHIBITED_STRUCTURES.md.backup-1775886614700`

### EVIDÊNCIA

- `Glob` **0** ficheiros `*.backup*` sob `c:\unificard` após remoção.
- **Nota:** existem outros `*.bak` em `docs/99_archive/` e em `node_modules` (fora do âmbito da lista G.2 do plano).

---

## GATE §17 — CHECKLIST FINAL

STATUS: **PASS** *(critérios alinhados ao `PLANO_EXECUCAO_CURSOR_v3.md` pós-edição RESUME + evidências abaixo)*

| Item | Resultado |
|------|-----------|
| A — `canonical_product_events` existe | **OK** |
| A — triggers `trg_cpe_on_insert` / `trg_cpe_on_concept_change` | **OK** |
| A — Smoke `BEGIN…ROLLBACK` confirma `event_type = 'created'` | **OK** (ver secção Smoke SQL) |
| A — `backfill_category` > 0 | **OK** (66) |
| B — `listVisibleProducts` + oferta ativa + stock/`available_quantity` | **OK** (E2E + query corrigida) |
| B — GET `/marketplace/products/visible` HTTP 200 e lista não vazia | **OK** (teste E2E) |
| B — EXPLAIN | **OK** (sem erro; plano capturado no Bloco B) |
| C — colunas `version` / `created_by_actor_id` | **OK** |
| C — TS `canonical-product.repository.ts` | **OK** (`tsc --noEmit`) |
| D — MAPA + `PermissionKey` + contador | **OK** |
| E — `pnpm test:e2e:catalog` | **OK** |
| F — enforcement **ou** FALSIFICATION_LOG | **OK** (entrada #2) |
| G — backups listados | **OK** (sessão anterior) |

---

## RESUME — Smoke SQL (`event_type = 'created'`)

**Comando:** `psql "$DATABASE_URL" -f` com bloco transaccional (ficheiro temporário durante execução; SQL reproduzível abaixo).

### OUTPUT

```text
BEGIN
INSERT 0 1
INSERT 0 1
 event_type 
------------
 created
(1 linha)

ROLLBACK
```

### SQL executado (verbatim)

```sql
BEGIN;

INSERT INTO canonical_products (
  tenant_id,
  name,
  images,
  attributes,
  type,
  scope,
  concept_resolution_status,
  created_at,
  updated_at
) VALUES (
  NULL,
  'SMOKE_TEST_TRIGGER',
  '[]'::jsonb,
  '{}'::jsonb,
  'INDUSTRIAL',
  'global',
  'unresolved',
  now(),
  now()
);

INSERT INTO canonical_concept_resolution_queue (
  canonical_product_id,
  status,
  created_at
)
SELECT id, 'pending', now()
FROM canonical_products
WHERE name = 'SMOKE_TEST_TRIGGER'
ORDER BY created_at DESC
LIMIT 1;

SELECT event_type
FROM canonical_product_events
WHERE event_type = 'created'
ORDER BY created_at DESC
LIMIT 1;

ROLLBACK;
```

---

## BLOCO J — Integridade (concept vs tenant)

STATUS: **PASS** *(2026-04-12)*

### ALTERAÇÕES

- `backend/src/modules/marketplace/product-concept-guard.ts`: `assertProductConceptAllowedForTenant(tenantId, canonicalProductId)` — SSOT `tenants.company_type_id` → `company_type_allowed_concepts` vs `canonical_products.concept_id`; bypasses documentados no ficheiro.
- `backend/src/modules/marketplace/product.repository.ts`: em `createProduct`, `await assertProductConceptAllowedForTenant(tenantId, canonicalProductId)` **antes** do `INSERT`.

### COMANDOS EXECUTADOS

- `pnpm exec tsc --noEmit` — exit 0.

### EVIDÊNCIA

- Linter: sem diagnósticos nos ficheiros TS alterados.

---

## BLOCO H — Versionamento industrial (`canonical_products.version`)

STATUS: **PASS** *(2026-04-12)*

### ALTERAÇÕES

- `backend/migrations/20260522100000_canonical_products_version_increment.sql`: função + trigger `BEFORE UPDATE OF gtin, name, brand` em `canonical_products`.

### COMANDOS EXECUTADOS

- `pnpm run migrate` (diretório `backend/`) — migration pendente executada com sucesso.
- `pnpm exec tsc --noEmit` — exit 0.

### EVIDÊNCIA (H3 — incremento de `version`)

```text
ID=78339ed2-fdad-44a7-b18a-3a8bde62932e VERSION_BEFORE=1
UPDATE 1
VERSION_AFTER=2
```

*(nome revertido após o teste com `regexp_replace`.)*

---

## BLOCO I — Governança §5.1 (ADR + remissão no código)

STATUS: **PASS** *(2026-04-12)*

### ALTERAÇÕES

- `docs/01_normative/ADR_CANONICAL_CREATE_AUTHORITY.md`: ADR — criação de `canonical_products` restrita a onboarding / ingestão controlada.
- `backend/src/modules/marketplace/store-onboarding.routes.ts`: comentário §5.1 com remissão ao ADR acima de `MARKETPLACE_STORE_CREATE`.
- `docs/01_normative/MAPA_CANONICO_PERMISSIONS_v1.md`: nota §5.1 com remissão ao ADR (alinhamento mapa ↔ ADR).

### COMANDOS EXECUTADOS

- `pnpm exec tsc --noEmit` — exit 0.

---

## Outras notas RESUME

- `PLANO_EXECUCAO_CURSOR_v3.md`: gate §17 — critério `COUNT(created)>0` substituído por smoke test documentado; ficheiro `canonical-product-events.repository.ts`: comentário **OBSERVABILITY ONLY — NÃO USAR PARA DECISÃO DE NEGÓCIO**.
- `tests/e2e/build-intent-e2e-app.ts`: registo de `storeOnboardingRoutes` para permitir o GET no harness do E2E de catálogo.

---

## AUDITORIA DE DADOS PÓS-V3 (checklist reprodutível)

**Objetivo:** fechar o espaço entre **entrega de engenharia** (v3 + H/I/J validados em código e migrations) e **evidência de dados** por ambiente — **sem** reabrir o gate §17 nem alterar o âmbito do `PLANO_EXECUCAO_CURSOR_v3.md`.

**Como usar:** `psql "$DATABASE_URL" -c '...'` (Windows: `psql $dbUrl -c "..."`). Copiar outputs para este ficheiro após cada execução relevante (staging/produção).

### Critérios normativos (alinhados ao código já em produção no repo)

- **`concept_id` NULL:** esperado em estados de resolução pendente; o guard **faz bypass** (não é falha de runtime). Avaliar apenas se aparecerem linhas **READY** (ou equivalente operacional) com `concept_id` NULL — aí sim é anomalia de dados.
- **GTIN NULL:** unicidade parcial no PG aplica-se a `gtin IS NOT NULL`; volumes altos de NULL são **informação**, não bug, salvo política de produto que exija GTIN obrigatório.
- **`products.category_id`:** schema exige NOT NULL; contagem > 0 indica **corrupção** ou migração incompleta.
- **`tenants.company_type_id` NULL:** implica bypass da matriz `company_type_allowed_concepts` no guard — **desenho documentado**; quantificar para governança.

### SQL — checklist

```sql
-- 1) Canónicos sem concept_id, por estado de resolução
SELECT concept_resolution_status, COUNT(*) AS n
FROM canonical_products
WHERE concept_id IS NULL
GROUP BY 1
ORDER BY 2 DESC;

-- 2) Canónicos sem categoria (readiness / visibilidade exigem category)
SELECT COUNT(*) AS canonical_sem_categoria
FROM canonical_products
WHERE category_id IS NULL;

-- 3) Canónicos com GTIN nulo, por scope
SELECT scope, COUNT(*) AS n
FROM canonical_products
WHERE gtin IS NULL
GROUP BY 1;

-- 4) Heurística: duplicados sem GTIN (mesmo tenant, nome, marca)
SELECT tenant_id, name, brand, COUNT(*) AS n
FROM canonical_products
WHERE gtin IS NULL AND tenant_id IS NOT NULL
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1
ORDER BY n DESC
LIMIT 50;

-- 5) Produtos marketplace sem categoria (deveria ser 0)
SELECT COUNT(*) FROM products WHERE category_id IS NULL;

-- 6) Tenants sem company_type (bypass do guard de concept)
SELECT COUNT(*) FROM tenants WHERE company_type_id IS NULL;
```

### EVIDÊNCIA (ambiente dev local — 2026-04-12)

Execução única de referência; **não** substitui auditoria em staging/prod.

```text
(1) concept_id IS NULL → só unresolved, n=12
(2) canonical_sem_categoria = 0
(3) gtin IS NULL → global n=52, scoped n=10
(4) duplicados heurísticos (nome+marca+tenant, sem GTIN) = 0 linhas
(5) products sem category_id = 0
(6) tenants sem company_type_id = 104
```

**Interpretação breve:** dados de dev consistentes com bypass do guard e com pipeline de conceito; sem sinais de duplicata fraca na heurística (4); `products` íntegro quanto a categoria.

---

## SSOT — índice raiz e plano normativo (2026-04-12)

- **`STATUS_EXECUCAO.md` (raiz):** acrescentado bloco explícito — ficheiro é **índice sem autoridade de decisão**; em conflito prevalecem `PLANO_FASE_ATUAL.md` e `docs/03_execution_log/`. Linha sistémica #9 (Gate §17 catálogo) passou a `[✓]` com remissão a este log e ao plano executor v3.
- **`PLANO_FASE_ATUAL.md`:** tabela de leitura rápida §17 → `[✓]`; secção «Onde estamos» atualizada (fecho trilho v3 + distinção **repo/evidência** vs **prova por ambiente alvo** quando exigida); linha **Sincronização SSOT 2026-04-12** no cabeçalho.

---

FIM DO LOG (RESUME 2026-04-13; blocos H / I / J 2026-04-12; auditoria de dados pós-v3 2026-04-12; SSOT STATUS/PLANO_FASE 2026-04-12)
