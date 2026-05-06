# PLANO DE EXECUÇÃO — UnifiCard v3 (FINAL)
**Para:** Cursor (executor)  
**Versão:** 3 — incorpora auditorias Cursor + ChatGPT + verificação do runner real  
**Data:** 12/04/2026  
**Supersede:** v1 e v2  

**Última consolidação da execução:** 2026-04-13 (inclui ciclo inicial + **RESUME** após destravamento `movement_type` / gate §17 / smoke SQL). **Extensão pós-v3 (2026-04-12):** blocos **H** (trigger `version` em `canonical_products`), **I** (ADR §5.1 + remissões), **J** (`product-concept-guard` em `createProduct`).  
**Log forense detalhado:** `docs/03_execution_log/2026-EXECUCAO_V3.md`  
**SSOT falsificação (Bloco F):** `docs/ssot/FALSIFICATION_LOG.md` — Entrada #2 (`authority_roots`, prazo 2026-06-30).

**ESTADO FINAL DO SISTEMA (snapshot normativo — evita reinterpretação):**

- **v3 base:** concluído (A–G + gate §17 conforme checklist; evidência no log de execução).
- **Extensão H / I / J:** concluída (versionamento canónico, ADR §5.1, guard de concept em `createProduct`).
- **§17 `PLANO_FASE_ATUAL`:** fechado para o âmbito deste plano (eventos + smoke; não reabrir sem novo plano).
- **Sistema:** consistente e governado no sentido deste documento — código, migrations aplicáveis, mapa de permissions e ADR alinhados ao repositório.
- **Auditoria de dados (histórico / por ambiente):** checklist SQL reprodutível e critérios de leitura em `docs/03_execution_log/2026-EXECUCAO_V3.md` (secção **AUDITORIA DE DADOS PÓS-V3**); não faz parte do gate §17 — é evidência opcional registada por ambiente.
- **`STATUS_EXECUCAO.md` (raiz):** índice operacional **sem** autoridade de decisão (disclaimer + regra de conflito); Gate §17 catálogo alinhado a este plano e ao log — 2026-04-12.

---

## REGISTO DE EXECUÇÃO CONSOLIDADO (o que foi feito)

Resumo único do que foi **implementado, aplicado e validado** no repositório alinhado a este plano.

### Bloco 0 — Pre-flight

- Conexão `DATABASE_URL`, `psql`, verificação de `OBSERVATION_MODE` / `MIGRATION_PROFILE`, `schema_migrations`, diff migrations vs disco, colunas em `canonical_products`, `product_offers.is_active`, `inventory_movements.actor_id`, seeds Bloco 3 (`20260518120000`, `20260518121000`), `COUNT(*)` de `canonical_products` com `scope = 'global'` > 0.

### Bloco A — `canonical_product_events`

- **Migrations aplicadas:**  
  `backend/migrations/20260519100000_canonical_product_events.sql`  
  `backend/migrations/20260519110000_canonical_product_events_triggers.sql`  
  `backend/migrations/20260519120000_canonical_product_events_backfill.sql`
- **TypeScript:**  
  `backend/src/core/catalog/canonical/canonical-product-events.repository.ts`  
  Integração em `canonical-product.repository.ts` (eventos best-effort em violação única / colisão GTIN).
- **Comentário normativo (RESUME):** em `canonical-product-events.repository.ts` — *OBSERVABILITY ONLY — NÃO USAR PARA DECISÃO DE NEGÓCIO*.
- **Triggers em `canonical_products`:** `trg_cpe_on_insert`, `trg_cpe_on_concept_change`; backfill `event_type = 'backfill_category'` (> 0 linhas em ambientes com dados pré-triggers).

### Bloco B — Visibilidade

- **Migration:** `backend/migrations/20260519130000_visibility_indexes.sql`
- **Serviço:** `backend/src/modules/marketplace/product-visibility.service.ts`  
  - **RESUME:** `im.movement_type` (correção schema; campo SSOT não é `type`).  
  - **RESUME:** quantidade exibida e filtro com `COALESCE(inv.stock_qty, po.available_quantity)` (fallback à oferta quando não há movimentos).  
  - Comentários: checkout crítico / `movement_type` (SSOT).
- **Rota:** `GET /marketplace/products/visible` em `backend/src/modules/marketplace/store-onboarding.routes.ts` (`listVisibleProducts`).

### Bloco C — Governança em `canonical_products`

- **Migration:** `backend/migrations/20260520100000_canonical_products_governance_fields.sql` (`version`, `created_by_actor_id`).
- **TypeScript:** `canonical-product-db.types.ts`, `canonical-product.repository.ts` (`CP_SELECT`, persistência, mapper).

### Bloco D — Permission key `canonical_products:create`

- `docs/01_normative/MAPA_CANONICO_PERMISSIONS_v1.md` — secção `canonical_products:create`.
- `backend/src/core/authorization/permission-keys.ts` — union `PermissionKey`, `PERMISSION_CAPABILITIES`, contadores (62 / marketplace 14 na consolidação).
- **D.1:** sem chamadas diretas em `*.routes.ts` a `insertIndustrialWithPendingConceptQueue` / `getOrCreateIndustrial` (criação direta só via fluxos existentes / onboarding).

### Bloco E — E2E §9

- Ficheiros confirmados: `catalog-order-ledger.e2e.test.ts`, `canonical-product-creation.service.test.ts`, `store-onboarding.service.test.ts`, `marketplace-order-partial-flow.test.ts`.
- **`pnpm test:e2e:catalog`:** passa com `DATABASE_URL`.
- **RESUME:** seed em `catalog-order-ledger.e2e.test.ts` com `INSERT INTO product_offers` (preço + `available_quantity` + `is_active`) para satisfazer o JOIN da visibilidade.
- **RESUME:** `tests/e2e/build-intent-e2e-app.ts` regista `storeOnboardingRoutes` para o harness poder chamar `GET /marketplace/products/visible`.
- **RESUME:** novo teste E2E — HTTP 200 e `products.length > 0`.

### Bloco F — `authority_roots` (condicional)

- Pré-query: **347** actores humanos sem `authority_roots` (exemplo de ambiente `unificard_dev`).
- **Sem** migration `20260521100000_authority_roots_enforcement.sql` (pré-condição `COUNT = 0` não satisfeita).
- Registo obrigatório: **Entrada #2** em `docs/ssot/FALSIFICATION_LOG.md` com prazo **2026-06-30**.

### Bloco G — Limpeza de backups

- `git rm` do `.bak` rastreado; remoção no disco dos `.backup-*` listados em G.2 quando não rastreados pelo Git (ver log).

### Bloco H — Versionamento industrial (`canonical_products.version`)

- **Migration aplicada:** `backend/migrations/20260522100000_canonical_products_version_increment.sql` — função + trigger `BEFORE UPDATE OF gtin, name, brand` incrementa `version` quando qualquer um desses campos muda.
- **Validação:** `pnpm run migrate` (exit 0); smoke `UPDATE` em `name` + `SELECT version` confirma incremento (evidência no log de execução).

### Bloco I — Governança §5.1 (autoridade de criação de canónico)

- **ADR:** `docs/01_normative/ADR_CANONICAL_CREATE_AUTHORITY.md` — criação de `canonical_products` restrita a onboarding / ingestão controlada; não criação arbitrária por utilizador comum.
- **Remissão no código:** comentário §5.1 em `backend/src/modules/marketplace/store-onboarding.routes.ts` junto a `MARKETPLACE_STORE_CREATE`.
- **Mapa:** nota §5.1 em `docs/01_normative/MAPA_CANONICO_PERMISSIONS_v1.md` com ligação ao ADR.

### Bloco J — Integridade catálogo (concept permitido ao tenant)

- **Guard:** `backend/src/modules/marketplace/product-concept-guard.ts` — `assertProductConceptAllowedForTenant(tenantId, canonicalProductId)`; SSOT `tenants.company_type_id` → `company_type_allowed_concepts` vs `canonical_products.concept_id` (bypasses documentados no ficheiro).
- **Integração:** `backend/src/modules/marketplace/product.repository.ts` — em `createProduct`, chamada ao guard **antes** do `INSERT`.

### Gate §17 — alterações normativas (RESUME)

- **Substituído** o critério `COUNT(*) WHERE event_type = 'created' > 0` (inadequado com E2E que usa `session_replication_role = 'replica'` no INSERT de canónico, sem evento `created`).
- **Novo critério:** smoke transaccional (executar com `psql`; deve devolver uma linha `event_type = 'created'` antes do `ROLLBACK`):

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

- Checklist Bloco B atualizado: COALESCE stock agregado + `po.available_quantity`; snippet B.2 neste plano alinhado ao código (`movement_type`, `COALESCE`).

### Validação técnica final (referência)

- `pnpm exec tsc --noEmit` — exit 0.  
- `pnpm test:e2e:catalog` — exit 0 (2 testes no ficheiro de catálogo, incluindo GET visível).
- Pós **H / I / J:** `pnpm exec tsc --noEmit` — exit 0; `pnpm run migrate` com migration `20260522100000_canonical_products_version_increment.sql` aplicada (ver log).

---

## COMO O RUNNER DE MIGRATIONS FUNCIONA (ler antes de tudo)

O runner (`src/core/db/migrate.ts`) usa a tabela `schema_migrations` para controle. Comportamento crítico a saber:

- **Tracking:** `schema_migrations` (colunas: `filename`, `executed_at`, `checksum`). Não usa `schema_version` para migrations com timestamp — só para as numeradas `0001`–`0088`.
- **Ordem:** alfabética por filename. Timestamps `YYYYMMDDHHMMSS_*.sql` vêm depois das numeradas, em ordem cronológica.
- **Idempotência:** migrations já em `schema_migrations` são puladas. O runner não re-executa.
- **Profile:** variável `MIGRATION_PROFILE`. Padrão é `CORE_ONLY`. Módulos `rides` e `work-instant` são ignorados nesse profile — as novas migrations deste plano não são latentes, rodam em `CORE_ONLY`.
- **`OBSERVATION_MODE=true`:** bloqueia qualquer migrate. Confirmar que está `false` antes de rodar.
- **Não há `migrate:status` ou `migrate:diff`** nativo. Status = consulta SQL direta. Ver Bloco 0.
- **`ADD CONSTRAINT IF NOT EXISTS` não é sintaxe PostgreSQL válida.** Usar `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '...') THEN ALTER TABLE ... ADD CONSTRAINT ...; END IF; END $$;`

---

## BLOCO 0 — PRE-FLIGHT CHECK (OBRIGATÓRIO — rodar antes de qualquer sessão)

**Regra: se qualquer item retornar divergência inesperada → ABORTAR e registrar no `FALSIFICATION_LOG.md`.**

### 0.1 — Verificar conexão e ambiente

```bash
# Confirmar que DATABASE_URL está definida e acessível
psql "$DATABASE_URL" -c "SELECT version();"

# Confirmar que OBSERVATION_MODE não está bloqueando
grep "OBSERVATION_MODE" .env
# Deve ser: OBSERVATION_MODE=false ou ausente

# Confirmar MIGRATION_PROFILE
grep "MIGRATION_PROFILE" .env
# Deve ser: MIGRATION_PROFILE=CORE_ONLY ou ausente (CORE_ONLY é padrão)
```

### 0.2 — Estado atual do runner

```sql
-- Quantas migrations estão aplicadas
SELECT COUNT(*) AS total_applied FROM schema_migrations;

-- Últimas 10 aplicadas (confirmar que 20260518121000 é a última)
SELECT filename, executed_at
FROM schema_migrations
ORDER BY executed_at DESC
LIMIT 10;

-- Migrations pendentes: listar arquivos em migrations/ que NÃO estão em schema_migrations
-- (Fazer isso via ls + diff com a query acima, ou via script abaixo)
```

```bash
# Listar arquivos em migrations/ não registrados em schema_migrations
psql "$DATABASE_URL" -t -c "
  SELECT filename FROM schema_migrations ORDER BY filename
" | sort > /tmp/applied.txt

ls backend/migrations/*.sql | xargs -n1 basename | sort > /tmp/disk.txt

diff /tmp/applied.txt /tmp/disk.txt
# Linhas com '>' = pendentes (serão aplicadas pelo runner)
# Linhas com '<' = aplicadas mas sem arquivo (histórico — ok)
```

### 0.3 — Verificar schema atual das tabelas envolvidas

```sql
-- canonical_products: confirmar colunas existentes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'canonical_products'
ORDER BY ordinal_position;

-- canonical_product_events (após Bloco A aplicado: tabela deve existir)
SELECT to_regclass('public.canonical_product_events') AS exists;
-- Esperado pós-execução do plano: 'canonical_product_events'::regclass (não NULL)
-- Antes do primeiro apply do Bloco A: NULL

-- Confirmar que product_offers tem is_active
SELECT column_name FROM information_schema.columns
WHERE table_name = 'product_offers' AND column_name = 'is_active';

-- Confirmar que inventory_movements tem actor_id (FASE F)
SELECT column_name FROM information_schema.columns
WHERE table_name = 'inventory_movements' AND column_name = 'actor_id';

-- Confirmar índices existentes em canonical_products (evitar duplicatas no Bloco C)
SELECT indexname FROM pg_indexes WHERE tablename = 'canonical_products';
```

### 0.4 — Confirmar últimas migrations do Bloco 3

```sql
-- Verificar que os seeds globais foram aplicados
SELECT filename, executed_at
FROM schema_migrations
WHERE filename IN (
  '20260518120000_bloco3_data_repair_n1_roots_and_e2e_cleanup.sql',
  '20260518121000_bloco3_scaffold_global_for_e2e_categories.sql'
);
-- Ambos devem aparecer

-- Verificar que há canonical_products globais (scope='global')
SELECT COUNT(*) FROM canonical_products WHERE scope = 'global';
-- Deve ser > 0
```

**Só avançar para o Bloco A após todos os checks passarem.**

---

## BLOCO A — `canonical_product_events` (§5A)
**Sessão 1: SQL (migrations) | Sessão 2: TypeScript**  
**Bloqueador do gate §17.**

### A.1 — Migration: tabela `canonical_product_events`

Criar `backend/migrations/20260519100000_canonical_product_events.sql`

> Verificar antes: `ls backend/migrations/20260519*.sql` — deve retornar vazio.

```sql
-- §5A PLANO_FASE_ATUAL: tabela append-only de eventos canônicos.
-- Sem esta tabela o gate §17 não pode ser aberto ("pronto é ilusório para debug").
-- Ref: PLANO_FASE_ATUAL.md §5A

BEGIN;

CREATE TABLE IF NOT EXISTS canonical_product_events (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_product_id  UUID        NOT NULL
    REFERENCES canonical_products(id) ON DELETE CASCADE,
  event_type            TEXT        NOT NULL,
  payload               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  actor_id              UUID        REFERENCES actors(id) ON DELETE SET NULL,
  tenant_id             UUID        REFERENCES tenants(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cpe_event_type_chk CHECK (
    event_type IN (
      'created',
      'concept_resolved',
      'concept_resolution_pending',
      'concept_suggestion_auto',
      'governance_status_changed',
      'gtin_collision_blocked',
      'backfill_category'
    )
  )
);

-- Append-only: bloquear UPDATE e DELETE por trigger
CREATE OR REPLACE FUNCTION trg_canonical_product_events_immutable()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION
    'canonical_product_events é append-only. Operação proibida. id=%', OLD.id
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_cpe_immutable ON canonical_product_events;
CREATE TRIGGER trg_cpe_immutable
  BEFORE UPDATE OR DELETE ON canonical_product_events
  FOR EACH ROW EXECUTE FUNCTION trg_canonical_product_events_immutable();

CREATE INDEX IF NOT EXISTS idx_cpe_canonical_product_id
  ON canonical_product_events (canonical_product_id);
CREATE INDEX IF NOT EXISTS idx_cpe_event_type
  ON canonical_product_events (event_type);
CREATE INDEX IF NOT EXISTS idx_cpe_created_at
  ON canonical_product_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpe_tenant_id
  ON canonical_product_events (tenant_id)
  WHERE tenant_id IS NOT NULL;

COMMENT ON TABLE canonical_product_events IS
  '§5A PLANO_FASE_ATUAL: eventos append-only de canonical_products. '
  'Rastreia ciclo de vida, resolução de conceito e colisões GTIN. '
  'Bloqueador do gate §17.';

COMMENT ON COLUMN canonical_product_events.event_type IS
  'Valores: created | concept_resolved | concept_resolution_pending | '
  'concept_suggestion_auto | governance_status_changed | '
  'gtin_collision_blocked | backfill_category. '
  'concept_suggestion_auto: status auto_suggested ativado. '
  'governance_status_changed: qualquer outro UPDATE em concept_resolution_status.';

COMMIT;
```

**Verificação após apply:**

```sql
SELECT to_regclass('public.canonical_product_events');
-- Deve retornar: canonical_product_events (não NULL)

SELECT indexname FROM pg_indexes WHERE tablename = 'canonical_product_events';
-- Deve listar os 4 índices criados
```

---

### A.2 — Migration: triggers PG em `canonical_products`

Criar `backend/migrations/20260519110000_canonical_product_events_triggers.sql`

```sql
-- Triggers que alimentam canonical_product_events automaticamente.
-- Depende de: 20260519100000_canonical_product_events.sql

BEGIN;

-- Trigger 1: AFTER INSERT → evento 'created'
CREATE OR REPLACE FUNCTION trg_canonical_products_emit_created()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  INSERT INTO canonical_product_events (
    canonical_product_id, event_type, payload, tenant_id, created_at
  ) VALUES (
    NEW.id,
    'created',
    jsonb_build_object(
      'type',                      NEW.type,
      'scope',                     NEW.scope,
      'gtin',                      NEW.gtin,
      'concept_resolution_status', NEW.concept_resolution_status
    ),
    NEW.tenant_id,
    now()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cpe_on_insert ON canonical_products;
CREATE TRIGGER trg_cpe_on_insert
  AFTER INSERT ON canonical_products
  FOR EACH ROW EXECUTE FUNCTION trg_canonical_products_emit_created();

-- Trigger 2: AFTER UPDATE concept_resolution_status → evento mapeado
-- Mapeamento:
--   confirmed      → concept_resolved
--   unresolved     → concept_resolution_pending
--   auto_suggested → concept_suggestion_auto   (status válido — fila sugeriu, humano não confirmou)
--   qualquer outro → governance_status_changed
CREATE OR REPLACE FUNCTION trg_canonical_products_emit_concept_change()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_event_type TEXT;
BEGIN
  -- Só dispara se o status realmente mudou
  IF NEW.concept_resolution_status IS NOT DISTINCT FROM OLD.concept_resolution_status THEN
    RETURN NEW;
  END IF;

  v_event_type := CASE NEW.concept_resolution_status
    WHEN 'confirmed'      THEN 'concept_resolved'
    WHEN 'unresolved'     THEN 'concept_resolution_pending'
    WHEN 'auto_suggested' THEN 'concept_suggestion_auto'
    ELSE 'governance_status_changed'
  END;

  INSERT INTO canonical_product_events (
    canonical_product_id, event_type, payload, tenant_id, created_at
  ) VALUES (
    NEW.id,
    v_event_type,
    jsonb_build_object(
      'from_status', OLD.concept_resolution_status,
      'to_status',   NEW.concept_resolution_status,
      'concept_id',  NEW.concept_id
    ),
    NEW.tenant_id,
    now()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cpe_on_concept_change ON canonical_products;
CREATE TRIGGER trg_cpe_on_concept_change
  AFTER UPDATE OF concept_resolution_status ON canonical_products
  FOR EACH ROW EXECUTE FUNCTION trg_canonical_products_emit_concept_change();

COMMIT;
```

**Verificação após apply:**

```sql
-- Confirmar triggers criados
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'canonical_products'
  AND trigger_name LIKE 'trg_cpe%';
-- Deve listar trg_cpe_on_insert e trg_cpe_on_concept_change

-- Teste de smoke: inserir canônico de teste e verificar evento
-- (só executar em ambiente de desenvolvimento — não em produção)
-- INSERT INTO canonical_products (...) VALUES (...);
-- SELECT * FROM canonical_product_events ORDER BY created_at DESC LIMIT 1;
```

---

### A.3 — Migration: backfill de eventos para canônicos existentes

Criar `backend/migrations/20260519120000_canonical_product_events_backfill.sql`

```sql
-- Backfill §5A: eventos 'backfill_category' para canônicos que existiam antes dos triggers.
-- Auditoria: SELECT * FROM canonical_product_events WHERE event_type = 'backfill_category';

BEGIN;

INSERT INTO canonical_product_events (
  canonical_product_id, event_type, payload, tenant_id, created_at
)
SELECT
  cp.id,
  'backfill_category',
  jsonb_build_object(
    'source',      'backfill_category',
    'category_id', cp.category_id,
    'concept_id',  cp.concept_id,
    'scope',       cp.scope,
    'migration',   '20260519120000'
  ),
  cp.tenant_id,
  now()
FROM canonical_products cp
WHERE NOT EXISTS (
  SELECT 1 FROM canonical_product_events cpe
  WHERE cpe.canonical_product_id = cp.id
    AND cpe.event_type IN ('created', 'backfill_category')
);

COMMIT;
```

**Verificação após apply:**

```sql
SELECT event_type, COUNT(*) FROM canonical_product_events GROUP BY event_type;
-- Deve mostrar backfill_category com COUNT = número de canônicos pré-existentes
```

---

### A.4 — Repository TypeScript (Sessão 2)

Criar `backend/src/core/catalog/canonical/canonical-product-events.repository.ts`

```typescript
// canonical-product-events.repository.ts
// §5A PLANO_FASE_ATUAL: escrita de eventos canônicos gerados na camada de aplicação.
//
// Os triggers PG cobrem:
//   - 'created': AFTER INSERT em canonical_products
//   - 'concept_*': AFTER UPDATE OF concept_resolution_status
//
// Este repository cobre APENAS o que os triggers não alcançam:
//   - 'gtin_collision_blocked': gerado no catch do INSERT (exceção 23505)
//
// REGRA: canonical_product_events é append-only.
//   Nunca gerar UPDATE ou DELETE nessa tabela.

import { pool, runQueriesWithTenant } from '@core/database/pool';

export type CanonicalEventType =
  | 'created'
  | 'concept_resolved'
  | 'concept_resolution_pending'
  | 'concept_suggestion_auto'
  | 'governance_status_changed'
  | 'gtin_collision_blocked'
  | 'backfill_category';

export interface InsertCanonicalProductEventInput {
  canonicalProductId: string;
  tenantId: string | null;
  eventType: CanonicalEventType;
  payload: Record<string, unknown>;
  actorId?: string | null;
}

/**
 * Insere evento manualmente (para casos não cobertos pelos triggers PG).
 * Uso principal: 'gtin_collision_blocked' no catch do INSERT.
 * Chamar com `.catch(() => {})` — não deve bloquear o fluxo principal.
 */
export async function insertCanonicalProductEvent(
  input: InsertCanonicalProductEventInput
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO canonical_product_events
         (canonical_product_id, event_type, payload, actor_id, tenant_id, created_at)
       VALUES ($1::uuid, $2, $3::jsonb, $4, $5, now())`,
      [
        input.canonicalProductId,
        input.eventType,
        JSON.stringify(input.payload),
        input.actorId ?? null,
        input.tenantId ?? null,
      ]
    );
  } finally {
    client.release();
  }
}

export interface CanonicalProductEventRow {
  id: string;
  eventType: string;
  payload: unknown;
  createdAt: string;
}

/**
 * Lista eventos de um canônico para backoffice/debug.
 * Usa runQueriesWithTenant (retorna T[] — múltiplas linhas).
 * runQueryWithTenant retorna T|undefined (uma linha) — não usar aqui.
 */
export async function listCanonicalProductEvents(
  tenantId: string,
  canonicalProductId: string,
  limit = 50
): Promise<CanonicalProductEventRow[]> {
  const rows = await runQueriesWithTenant<{
    id: string;
    event_type: string;
    payload: unknown;
    created_at: Date;
  }>(
    tenantId,
    `SELECT id, event_type, payload, created_at
     FROM canonical_product_events
     WHERE canonical_product_id = $2::uuid
     ORDER BY created_at DESC
     LIMIT $3`,
    [tenantId, canonicalProductId, limit]
  );

  return rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    payload: r.payload,
    createdAt: r.created_at instanceof Date
      ? r.created_at.toISOString()
      : String(r.created_at),
  }));
}
```

---

### A.5 — Integrar `gtin_collision_blocked` no repository de canonical

Em `canonical-product.repository.ts`, adicionar o import no topo e integrar nos dois métodos de INSERT.

**Import a adicionar:**

```typescript
import { insertCanonicalProductEvent } from './canonical-product-events.repository';
```

**Nos blocos `catch` de `insertIndustrialWithPendingConceptQueue` e `insertIndustrial`**, localizar o trecho `if (isUniqueViolation(err))` e adicionar **antes** do retry/rethrow:

```typescript
if (isUniqueViolation(err) && gtinNorm) {
  // Registrar colisão como evento — best-effort, nunca bloquear o retry.
  // Só registra se conseguir identificar o canonical conflitante.
  void (async () => {
    try {
      const conflicting = await this.findByTenantAndGtin(params.tenantId, gtinNorm);
      if (conflicting?.id) {
        await insertCanonicalProductEvent({
          canonicalProductId: conflicting.id,
          tenantId: params.tenantId,
          eventType: 'gtin_collision_blocked',
          payload: {
            gtin: gtinNorm,
            scope: 'scoped',
            reason: 'unique_violation',
            conflicting_id: conflicting.id,
          },
        });
      }
      // Se não achar o conflitante: não registrar evento com ID inválido.
      // Colisão já é visível no log de erro do catch.
    } catch {
      // Silencioso — evento de colisão não pode bloquear o retry.
    }
  })();
}
```

> **Nota:** o UUID `00000000-0000-0000-0000-000000000000` foi removido. Se `conflicting` não for encontrado, o evento simplesmente não é criado — evita dado inválido na tabela de auditoria.

---

## BLOCO B — Visibilidade Real de Produto (§8)
**Sessão 3: migration de índices | Sessão 4: TypeScript**

### B.1 — Migration: índices de suporte

Criar `backend/migrations/20260519130000_visibility_indexes.sql`

```sql
-- Suporte §8.4 PLANO_FASE_ATUAL: product-visibility.service.ts.
-- query dinâmica (não view materializada) — §8.4 explícito.
-- Todos com IF NOT EXISTS — idempotente.
-- Verificar existência antes de aplicar:
--   SELECT indexname FROM pg_indexes WHERE tablename IN ('product_offers','products','inventory_movements');

BEGIN;

CREATE INDEX IF NOT EXISTS idx_product_offers_active_tenant
  ON product_offers (tenant_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_canonical_tenant
  ON products (tenant_id, canonical_product_id)
  WHERE canonical_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant_tenant
  ON inventory_movements (tenant_id, product_variant_id);

COMMENT ON INDEX idx_product_offers_active_tenant IS
  'Suporte §8 PLANO_FASE_ATUAL: filtra ofertas ativas por tenant.';
COMMENT ON INDEX idx_products_canonical_tenant IS
  'Suporte §8: join products → canonical_products.';
COMMENT ON INDEX idx_inventory_movements_variant_tenant IS
  'Suporte §8: agregação de stock por variante no LATERAL.';

COMMIT;
```

---

### B.2 — Criar `product-visibility.service.ts` (Sessão 4)

Criar `backend/src/modules/marketplace/product-visibility.service.ts`

```typescript
// product-visibility.service.ts
// §8 PLANO_FASE_ATUAL: produto visível = canônico READY + offer ativa + estoque disponível.
// §8.4: query dinâmica com índices. Sem view materializada até evidência de gargalo.
//
// LIMITAÇÃO CONHECIDA — v1 (documentada intencionalmente):
//   Stock agregado por (tenant_id, product_variant_id) — soma TODAS as unidades (actors).
//   Não filtra por actor_id da oferta (merchant_id).
//   Isso pode mostrar estoque de seller A para oferta de seller B.
//   AVISO: não usar para checkout crítico sem evoluir para filtro por actor_id.
//   Evoluir quando produto exigir visibilidade por unidade (FASE F — próxima iteração).

import { runQueriesWithTenant } from '@core/database/pool';
import {
  sqlCanonicalIndustrialOperationalReady,
  sqlCanonicalIdMatchesTenantContext,
  sqlOrderScopedCanonicalFirst,
} from '@core/catalog/canonical/canonical-product-readiness';

export interface VisibleProduct {
  productId: string;
  canonicalProductId: string;
  variantId: string;
  offerId: string;
  /** Preço em centavos (da oferta ativa). */
  priceCents: number;
  /**
   * Stock total da variante no tenant — v1: soma todas as unidades.
   * Não reflete disponibilidade por actor/unidade específica da oferta.
   */
  availableQuantity: number;
  categoryId: string;
  name: string;
  brand: string | null;
  gtin: string | null;
  images: string[];
  attributes: Record<string, unknown>;
  scope: 'global' | 'scoped';
}

export interface ListVisibleProductsOptions {
  categoryIds?: string[];
  limit?: number;
  offset?: number;
}

export async function listVisibleProducts(
  tenantId: string,
  options: ListVisibleProductsOptions = {}
): Promise<VisibleProduct[]> {
  const { categoryIds, limit = 50, offset = 0 } = options;

  const cpVis   = sqlCanonicalIdMatchesTenantContext('cp', '$1::uuid');
  const cpReady = sqlCanonicalIndustrialOperationalReady('cp');
  const cpOrder = sqlOrderScopedCanonicalFirst('cp');

  // Construir filtro de categoria dinamicamente para evitar parâmetro NULL
  const params: unknown[] = [tenantId, limit, offset];
  let categoryFilter = '';
  if (categoryIds && categoryIds.length > 0) {
    params.push(categoryIds);
    categoryFilter = `AND cp.category_id = ANY($${params.length}::uuid[])`;
  }

  const query = `
    SELECT
      p.id                           AS product_id,
      cp.id                          AS canonical_product_id,
      pv.id                          AS variant_id,
      po.id                          AS offer_id,
      po.price_cents                 AS price_cents,
      COALESCE(inv.stock_qty, po.available_quantity) AS available_quantity,
      cp.category_id,
      cp.name,
      cp.brand,
      cp.gtin,
      cp.images,
      cp.attributes,
      cp.scope
    FROM canonical_products cp
    JOIN products p
      ON p.canonical_product_id = cp.id
      AND p.tenant_id = $1::uuid
      AND p.category_id IS NOT NULL
    JOIN product_variants pv
      ON pv.product_id = p.id
      AND pv.tenant_id = $1::uuid
    JOIN product_offers po
      ON po.product_id = p.id
      AND po.tenant_id = $1::uuid
      AND po.is_active = true
    LEFT JOIN LATERAL (
      -- Campo correto: movement_type (SSOT)
      -- v1: stock agregado por variante — soma todas as unidades (actors).
      -- Limitação documentada: ver cabeçalho do arquivo.
      SELECT SUM(
        CASE im.movement_type
          WHEN 'IN'         THEN  im.quantity
          WHEN 'OUT'        THEN -im.quantity
          WHEN 'ADJUSTMENT' THEN  im.quantity
          ELSE 0
        END
      ) AS stock_qty
      FROM inventory_movements im
      WHERE im.tenant_id          = $1::uuid
        AND im.product_variant_id = pv.id
    ) inv ON true
    WHERE ${cpVis}
      AND cp.type = 'INDUSTRIAL'
      AND ${cpReady}
      ${categoryFilter}
      AND COALESCE(inv.stock_qty, po.available_quantity) > 0
    ORDER BY ${cpOrder}, cp.name ASC
    LIMIT $2
    OFFSET $3
  `;

  type Row = {
    product_id: string;
    canonical_product_id: string;
    variant_id: string;
    offer_id: string;
    price_cents: string;
    available_quantity: string;
    category_id: string;
    name: string;
    brand: string | null;
    gtin: string | null;
    images: unknown;
    attributes: unknown;
    scope: string;
  };

  // runQueriesWithTenant retorna T[] (múltiplas linhas).
  // runQueryWithTenant retorna T|undefined (uma linha) — NÃO usar aqui.
  const rows = await runQueriesWithTenant<Row>(tenantId, query, params);

  return rows.map((r) => ({
    productId:          r.product_id,
    canonicalProductId: r.canonical_product_id,
    variantId:          r.variant_id,
    offerId:            r.offer_id,
    priceCents:         parseInt(r.price_cents, 10),
    availableQuantity:  parseInt(r.available_quantity, 10),
    categoryId:         r.category_id,
    name:               r.name,
    brand:              r.brand ?? null,
    gtin:               r.gtin ?? null,
    images:             Array.isArray(r.images)
                          ? r.images.filter((x): x is string => typeof x === 'string')
                          : [],
    attributes:         (r.attributes && typeof r.attributes === 'object' && !Array.isArray(r.attributes))
                          ? (r.attributes as Record<string, unknown>)
                          : {},
    scope:              r.scope as 'global' | 'scoped',
  }));
}
```

### B.3 — Rota de visibilidade

Localizar o arquivo que contém `POST /marketplace/store-onboarding` (mesmo arquivo das rotas de marketplace) e adicionar:

```typescript
import { listVisibleProducts } from './product-visibility.service';

// GET /marketplace/products/visible
fastify.get<{
  Querystring: { categoryId?: string; limit?: string; offset?: string };
}>('/marketplace/products/visible', async (req, reply) => {
  const tenantId = req.tenant!.id;
  const { categoryId, limit, offset } = req.query;

  const products = await listVisibleProducts(tenantId, {
    categoryIds: categoryId ? [categoryId] : undefined,
    limit:  limit  ? parseInt(limit,  10) : 50,
    offset: offset ? parseInt(offset, 10) : 0,
  });

  return reply.send({ products });
});
```

---

## BLOCO C — Campos de Governança em `canonical_products` (§3/§17)
**Sessão 5: SQL | Sessão 6: TypeScript**

> **Decisão normativa:** o texto do plano usa "governance_status" como nome de campo, mas o runtime usa `concept_resolution_status`. São o mesmo campo com nomes diferentes. **Não criar campo separado.** Desalinhamento de vocabulário, não lacuna funcional.

### C.1 — Migration

Criar `backend/migrations/20260520100000_canonical_products_governance_fields.sql`

```sql
-- §3/§17 PLANO_FASE_ATUAL: campos de governança faltantes em canonical_products.
-- version: controle de versão para mudanças industriais relevantes.
-- created_by_actor_id: trilha de autoria obrigatória (§5.2).
--
-- Nota: "governance_status" do texto normativo = concept_resolution_status no runtime.
-- Não criar campo duplicado.

BEGIN;

-- 1. version (padrão 1, incrementar em mudanças industriais: GTIN, nome, marca)
ALTER TABLE canonical_products
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Constraint idempotente (ADD CONSTRAINT IF NOT EXISTS não é PG válido)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'canonical_products_version_positive_chk'
      AND conrelid = 'canonical_products'::regclass
  ) THEN
    ALTER TABLE canonical_products
      ADD CONSTRAINT canonical_products_version_positive_chk
        CHECK (version >= 1)
        NOT VALID; -- não revalida linhas existentes (todas têm DEFAULT 1)
  END IF;
END $$;

-- 2. created_by_actor_id (nullable: linhas de seed/backfill sem actor explícito)
ALTER TABLE canonical_products
  ADD COLUMN IF NOT EXISTS created_by_actor_id UUID
    REFERENCES actors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_canonical_products_created_by
  ON canonical_products (created_by_actor_id)
  WHERE created_by_actor_id IS NOT NULL;

COMMENT ON COLUMN canonical_products.version IS
  '§3 PLANO_FASE_ATUAL: versão do canonical. Incrementar em mudanças industriais. '
  'Não confundir com concept_resolution_status.';

COMMENT ON COLUMN canonical_products.created_by_actor_id IS
  '§5.2 PLANO_FASE_ATUAL: actor que criou o canonical. NULL para seeds/backfill.';

COMMIT;
```

**Verificação após apply:**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'canonical_products'
  AND column_name IN ('version', 'created_by_actor_id');
-- Ambas devem aparecer
```

---

### C.2 — Atualizar types e repository (Sessão 6)

**Em `canonical-product-db.types.ts`**, adicionar ao tipo DbRow:

```typescript
version?: number;
created_by_actor_id?: string | null;
```

**Em `canonical-product.repository.ts`**, três alterações:

```typescript
// 1. Atualizar CP_SELECT (adicionar os dois novos campos)
const CP_SELECT =
  'id, tenant_id, gtin, name, brand, images, attributes, category_id, type, ' +
  'fingerprint_v1, concept_id, concept_resolution_status, version, created_by_actor_id';

// 2. Atualizar interface CanonicalProductPersistRow (adicionar)
version: number;
createdByActorId: string | null;

// 3. Atualizar função toPersistRow (adicionar)
version: row.version ?? 1,
createdByActorId: row.created_by_actor_id ?? null,
```

---

## BLOCO D — Permission Key para criação de canonical (§5.1)
**Sessão 7: TypeScript — seguir processo exato**

O arquivo `permission-keys.ts` declara: **nenhuma permission sem atualizar o mapa primeiro**. Processo inviolável.

### D.1 — Verificar se rota pública de criação existe

```bash
grep -rn "insertIndustrialWithPendingConceptQueue\|getOrCreateIndustrial" \
  backend/src/ --include="*.routes.ts"
```

**Se nenhuma rota `.routes.ts` chamar diretamente:** a criação de canonical só acontece internamente via `store-onboarding`, que já tem guard `MARKETPLACE_STORE_CREATE`. A nova chave `canonical_products:create` é para uso futuro. Registrar essa decisão como comentário no mapa.

**Se houver rota pública:** aplicar o guard nela após os passos abaixo.

### D.2 — Atualizar `MAPA_CANONICO_PERMISSIONS_v1.md`

Adicionar entrada (seção MARKETPLACE ou nova seção CATALOG — manter consistente com o padrão do arquivo):

```markdown
### canonical_products:create
- **Capability requerida:** `null` (marketplace_manage_catalog já cobre via onboarding)
- **Descrição:** Permite criar ou reutilizar canonical_products INDUSTRIAL via API direta.
- **Quem pode ter:** tenant com MARKETPLACE_STORE_CREATE ou papel industrial explícito.
- **Status:** declarada para uso futuro; rota direta ainda não exposta publicamente.
```

### D.3 — Atualizar `permission-keys.ts`

```typescript
// Adicionar à union type PermissionKey (seção MARKETPLACE):
| 'canonical_products:create'

// Adicionar ao PERMISSION_CAPABILITIES:
'canonical_products:create': null, // ownership suficiente via marketplace_manage_catalog

// Atualizar contador no cabeçalho: 61 → 62 permissions
// Atualizar distribuição: marketplace: 13 → 14 permissions
```

---

## BLOCO E — Testes E2E (§9)
**Sessão 8: verificação**

### E.1 — Verificar existência dos arquivos

```bash
ls -la backend/tests/e2e/catalog-order-ledger.e2e.test.ts
ls -la backend/tests/unit/canonical-product-creation.service.test.ts
ls -la backend/tests/unit/store-onboarding.service.test.ts
ls -la backend/tests/unit/marketplace-order-partial-flow.test.ts
```

**Se todos existirem:** confirmar padrão de skip e rodar.  
**Se algum estiver ausente:** recriar com os três critérios executáveis do §9:

1. `resolveRefsFromVariant` retorna `resolution: 'ok'`
2. `POST /intent/execute` não retorna `REF_RESOLUTION_FAILED`
3. Liquidação gera entrada em `bank_ledger` com montante correto

### E.2 — Confirmar padrão de skip

O padrão do repositório (observado no `work.e2e.spec.ts`) usa guard no `beforeAll` sem `describe.skip`. Se o arquivo existente já trata ausência de `DATABASE_URL`, não modificar. Se não tratar:

```typescript
// No topo do arquivo E2E, após imports
const DB_URL = process.env.DATABASE_URL;
const describeE2e = DB_URL ? describe : describe.skip;

// Usar describeE2e em vez de describe no bloco principal
describeE2e('Catálogo → Intent → Bank (E2E)', () => { ... });
```

### E.3 — Rodar

```bash
DATABASE_URL=<url> pnpm run migrate   # garantir schema atualizado
DATABASE_URL=<url> pnpm test:e2e:catalog
```

---

## BLOCO F — Enforcement de `authority_roots`
**Sessão 9: SQL — condicional**

### F.1 — Query de pré-condição (obrigatória)

```sql
SELECT COUNT(*) AS actors_sem_authority_roots
FROM actors a
WHERE a.actor_type IN ('user', 'actor_human', 'person')
  AND NOT EXISTS (
    SELECT 1 FROM authority_roots ar WHERE ar.actor_id = a.id
  );
```

**Se resultado > 0:** não criar migration. Registrar no `FALSIFICATION_LOG.md`:

```
Data: [data]
Item: authority_roots enforcement (20260517100000 — trigger Opção A)
Estado: trigger comentado — backfill incompleto
Actors humanos sem authority_roots: [N]
Ação necessária: backfill manual antes de ativar enforcement
Prazo definido: [data-limite — obrigatório definir]
```

**Se resultado = 0:** criar `backend/migrations/20260521100000_authority_roots_enforcement.sql`:

```sql
-- Ativa enforcement total (Opção A) do trigger comentado em 20260517100000.
-- PRÉ-CONDIÇÃO VERIFICADA: COUNT de actors humanos sem authority_roots = 0.

BEGIN;

CREATE OR REPLACE FUNCTION trg_authority_roots_required_for_human()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.actor_type IN ('user', 'actor_human', 'person') THEN
    IF NOT EXISTS (
      SELECT 1 FROM authority_roots WHERE actor_id = NEW.id
    ) THEN
      RAISE EXCEPTION
        'Actor humano (id=%, tipo=%) requer entrada em authority_roots. '
        'Ref: docs/ssot/AUTHORITY_PRECEDENCE.md §4.1',
        NEW.id, NEW.actor_type
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Remover trigger de warning (modo transitório) se existir
DROP TRIGGER IF EXISTS trg_actors_authority_roots_warn ON actors;
-- Remover versão anterior do enforcement se existir
DROP TRIGGER IF EXISTS trg_actors_authority_roots_required ON actors;

CREATE TRIGGER trg_actors_authority_roots_required
  AFTER INSERT OR UPDATE OF actor_type ON actors
  FOR EACH ROW EXECUTE FUNCTION trg_authority_roots_required_for_human();

COMMENT ON FUNCTION trg_authority_roots_required_for_human() IS
  'Enforcement ativo (Opção A): actor humano sem authority_roots é bloqueado. '
  'Ativado após backfill confirmado — ver migration 20260517100000.';

COMMIT;
```

---

## BLOCO G — Limpeza de arquivos backup
**Sessão 10: git rm**

### G.1 — Verificar diff antes de remover

```bash
# Para cada par arquivo ativo vs backup — confirmar que não há código novo no backup
diff backend/src/core/compliance/authority-decision.service.ts \
     "backend/src/core/compliance/authority-decision.service.ts.backup-1775886614704"

diff backend/src/core/unifybank/bank-p2p-transfer.service.ts \
     "backend/src/core/unifybank/bank-p2p-transfer.service.ts.backup-1775886614674"
```

Se o backup tiver código não presente no ativo: revisar e decidir antes de deletar.

### G.2 — Remover

```bash
git rm backend/src/core/categories/categories.repository.ts.bak
git rm "backend/src/core/compliance/authority-decision.service.ts.backup-1775886614704"
git rm "backend/src/core/unifybank/bank-p2p-transfer.service.ts.backup-1775886614674"
git rm "backend/src/core/unifybank/bank-p2p-transfer.service.ts.backup-1775886614686"
git rm "backend/src/modules/marketplace/fiscal-document.service.ts.backup-1775886614696"
git rm "backend/src/modules/payout/payout.service.ts.backup-1775886614692"
git rm "docs/01_normative/PROHIBITED_STRUCTURES.md.backup-1775886614700"
```

---

## BLOCO H — Incremento automático de `version` em `canonical_products` (pós-C)
**Sessão opcional pós-v3: SQL apenas (nova migration)**

### H.1 — Migration

Criar `backend/migrations/20260522100000_canonical_products_version_increment.sql` com função PL/pgSQL e trigger `BEFORE UPDATE OF gtin, name, brand` em `canonical_products` que incrementa `NEW.version` relativamente a `OLD.version` quando `gtin`, `name` ou `brand` mudam (alinhado ao comentário da coluna no Bloco C).

**Verificação após apply:**

```sql
SELECT tgname FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'canonical_products'
  AND NOT t.tgisinternal
  AND tgname LIKE '%version%';
-- Deve listar o trigger de incremento (nome exato no ficheiro da migration)

-- Smoke (dev): gravar version antes/depois de UPDATE em name; deve subir em 1
```

**Critério de encerramento:** `pnpm run migrate` sem erros; smoke `UPDATE` + `SELECT version` confirma incremento.

---

## BLOCO I — ADR: autoridade de criação de canónico (§5.1)
**Sessão opcional pós-v3: documentação + remissão no código**

### I.1 — ADR

Criar `docs/01_normative/ADR_CANONICAL_CREATE_AUTHORITY.md` (decisão + justificativa: criação de `canonical_products` só via onboarding / fluxos de ingestão controlados).

### I.2 — Remissão normativa

- Acima do handler/guard de `MARKETPLACE_STORE_CREATE` em `backend/src/modules/marketplace/store-onboarding.routes.ts`, comentário com remissão ao ADR.
- Atualizar `docs/01_normative/MAPA_CANONICO_PERMISSIONS_v1.md` na secção `canonical_products:create` com nota §5.1 e link ao ADR, se ainda não existir.

**Critério de encerramento:** ficheiros presentes; `pnpm exec tsc --noEmit` continua exit 0.

---

## BLOCO J — Guard: concept do canónico permitido ao tipo de empresa do tenant (§7.x)
**Sessão opcional pós-v3: TypeScript**

### J.1 — Guard

Criar `backend/src/modules/marketplace/product-concept-guard.ts` com `assertProductConceptAllowedForTenant(tenantId, canonicalProductId)` usando `runQueryWithTenant` de `@core/database/pool` (não inventar outro import). SQL alinhado ao schema real: `canonical_products.concept_id` e agregado de `company_type_allowed_concepts` via `tenants.company_type_id`.

### J.2 — Integração em `createProduct`

Em `backend/src/modules/marketplace/product.repository.ts`, dentro de `createProduct`, **antes** de qualquer `INSERT` em `products`, `await assertProductConceptAllowedForTenant(tenantId, canonicalProductId)`.

**Critério de encerramento:** `pnpm exec tsc --noEmit` exit 0; criar produto com canónico cujo `concept_id` não está permitido ao tenant deve falhar com o erro de domínio definido no guard.

---

## ORDEM DE SESSÕES

| # | Bloco | Conteúdo | Critério de encerramento |
|---|---|---|---|
| 0 | Pre-flight | Verificar banco, schema, ambiente | Todos os checks passam |
| 1 | A.1 + A.2 | Migrations: tabela eventos + triggers | `pnpm run migrate` sem erros; triggers visíveis em `information_schema` |
| 2 | A.3 | Migration: backfill de eventos para canônicos existentes | `SELECT COUNT(*) FROM canonical_product_events WHERE event_type = 'backfill_category'` > 0 |
| 3 | A.4 + A.5 | TS: repository de eventos + integrar colisão GTIN | Compila sem erros |
| 4 | B.1 | Migration: índices de visibilidade | Apply sem erros; `\d product_offers` mostra novos índices |
| 5 | B.2 + B.3 | TS: `product-visibility.service.ts` + rota | Compila; `pnpm test:e2e:catalog` inclui GET `/marketplace/products/visible` (200 + lista não vazia com seed de `product_offers`) |
| 6 | C.1 | Migration: `version` + `created_by_actor_id` | Apply sem erros; colunas visíveis no schema |
| 7 | C.2 | TS: types + repository (CP_SELECT, interface, mapper) | Compila sem erros |
| 8 | D | Mapa → `PermissionKey` → verificar guards | Arquivo compila; contador no cabeçalho atualizado |
| 9 | E | Confirmar E2E existentes + padrão skip + rodar | `pnpm test:e2e:catalog` passa com `DATABASE_URL` |
| 10 | F | Enforcement `authority_roots` (condicional) | Count = 0 + migration aplicada, OU entry no `FALSIFICATION_LOG.md` |
| 11 | G | Remover arquivos backup | `git status` sem `.bak`/`.backup` |
| 12 | H | Migration trigger `version` em `canonical_products` | Migrate OK; smoke confirma incremento de `version` |
| 13 | I | ADR §5.1 + comentário em `store-onboarding.routes.ts` + nota no mapa | ADR e remissões presentes; `tsc` OK |
| 14 | J | `product-concept-guard` + chamada em `createProduct` | `tsc` OK; guard coerente com schema |

---

## GATE §17 — CHECKLIST FINAL

```
BLOCO A
[x] SELECT to_regclass('public.canonical_product_events') IS NOT NULL
[x] trigger trg_cpe_on_insert existe em canonical_products
[x] trigger trg_cpe_on_concept_change existe em canonical_products
[x] Smoke test válido confirma geração de event_type = 'created' (transação BEGIN…ROLLBACK documentada em log de execução)
[x] SELECT COUNT(*) FROM canonical_product_events WHERE event_type = 'backfill_category' > 0

BLOCO B
[x] listVisibleProducts retorna produtos com is_active=true AND COALESCE(stock agregado, po.available_quantity) > 0
[x] GET /marketplace/products/visible retorna HTTP 200 (E2E: resposta com `products` não vazio quando há seed de oferta + canónico READY)
[x] EXPLAIN da query sem erro de coluna; em BD pequena Seq Scan é aceitável — em tabelas grandes esperar uso de índices

BLOCO C
[x] SELECT column_name FROM information_schema.columns WHERE table_name='canonical_products' AND column_name IN ('version','created_by_actor_id') retorna 2 linhas
[x] TypeScript compila sem erros em canonical-product.repository.ts

BLOCO D
[x] 'canonical_products:create' presente no MAPA_CANONICO_PERMISSIONS_v1.md
[x] 'canonical_products:create' presente no type PermissionKey
[x] Contador no cabeçalho de permission-keys.ts atualizado

BLOCO E
[x] pnpm test:e2e:catalog passa com DATABASE_URL

BLOCOS F + G
[x] authority_roots: enforcement ativo OU entry no FALSIFICATION_LOG.md com prazo
[x] git status sem .bak/.backup

EXTENSÃO PÓS-V3 — BLOCOS H / I / J (2026-04-12)
[x] Migration 20260522100000_canonical_products_version_increment.sql aplicada; trigger de `version` ativo
[x] Smoke: UPDATE em gtin/name/brand incrementa `version` (registado no log de execução)
[x] ADR_CANONICAL_CREATE_AUTHORITY.md criado; remissão §5.1 em store-onboarding.routes.ts; nota no MAPA_CANONICO_PERMISSIONS_v1.md
[x] product-concept-guard.ts + integração em createProduct antes do INSERT
```

**Gate §17 — cumprido na consolidação 2026-04-13** (ver `docs/03_execution_log/2026-EXECUCAO_V3.md`).  
**Blocos H / I / J — cumpridos em 2026-04-12** (mesmo log, secções BLOCO H / I / J).  
**Só então abrir §10 (`investment_pool`) e §11 (escrow completo).**  
*(Estado em 2026-04-13: gate §17 fechado conforme checklists acima; avanço para §10/§11 é decisão de roadmap, não automático.)*

---

## REGRAS INVIOLÁVEIS

1. **Bloco 0 antes de tudo.** Qualquer divergência → ABORTAR e registrar.
2. **Nunca editar migrations existentes.** Apenas criar novas.
3. **`canonical_product_events` é append-only.** Trigger bloqueia UPDATE/DELETE, mas nunca gerar essas operações no código.
4. **`runQueryWithTenant`** → `T | undefined` (uma linha). **`runQueriesWithTenant`** → `T[]` (múltiplas linhas). Usar o correto.
5. **Import:** `@core/database/pool` — não caminho relativo de dentro de `core/catalog/canonical/`.
6. **`ADD CONSTRAINT IF NOT EXISTS` não é PostgreSQL válido.** Usar `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '...') THEN ... END IF; END $$;`
7. **Permission keys:** MAPA → type → guard. Nunca inverter. Nunca adicionar chave sem atualizar o contador.
8. **snake_case ↔ camelCase:** conversão exclusivamente na boundary do Repository.
9. **`FALSIFICATION_LOG.md`:** registrar qualquer desvio antes de implementar.
10. **`PLANO_FASE_ATUAL.md`:** não editar durante execução. Atualizar somente após bloco concluído.
