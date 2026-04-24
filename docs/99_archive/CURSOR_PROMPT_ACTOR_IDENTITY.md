# PROMPT PARA O CURSOR — Fechamento do Domínio Actor
## Executar em Agent Mode. Ler este documento inteiro antes de qualquer ação.

---

## STATUS

**STATUS:** CONCLUÍDO  
**Data de encerramento documental:** 2026-04-06  

**Critérios verificados**

- Fase 1 — writer único implementado (`actor-writer`, `votes` sem criação de actor dentro da transação)  
- Fase 2 — migration `20260510100000_actor_responsibility.sql` no repositório (coluna + trigger WARNING → depois Fase 4)  
- Fase 3 — backfill + validação global (`actor-responsibility-phase3.ts`; histórico DEV com exit 0 na secção abaixo)  
- Fase 4 — enforcement ativo (`20260510200000_actor_responsibility_enforce.sql`, EXCEPTION) + alinhamento TS (`ensurePageActor` / `findOrCreatePageActor`)  
- Fase 5 — quarentena em cascata (`isActorEffectivelyBlocked`)  
- Fase 6 — norma integrada (`LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §4.8–§4.8.7; `SSOT_REGISTRY_UNIFICARD.md` §5.1)  

**Checklist fora de DEV:** em cada ambiente real (staging/produção), após `pnpm migrate`, a equipa deve **registar** execução bem-sucedida do checklist no fim deste documento (`grep`, `psql`, `actor-responsibility-phase3.ts`). Este ficheiro define o *o quê*; o registo por ambiente é disciplina operacional.

**Conclusão:** o domínio Actor está **fechado** conforme SSOT e lei. As secções seguintes conservam a especificação e o **arquivo histórico** da implementação (não indicam trabalho em curso).

---

## CONTEXTO NORMATIVO

Esta execução implementa o §4.8 da lei de coerência (texto canónico: `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`; remissão: `LEI_COERENCIA_SISTEMICA_UNIFICARD.md`).

Documentos de referência obrigatórios antes de executar:
- `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` (§4.6 como modelo; §4.8–§4.8.7 identity fechado)
- `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` (§5.1 — domínio identity)
- `docs/01_normative/INVARIANTES_OPERACIONAIS_LEDGER.md` (padrão writer único)

**Sistema sem dados reais de produção. Zero risco de perda de dados.**

### Pré-requisitos de ambiente

- **PostgreSQL ≥ 14** — as migrations e triggers usam `EXECUTE FUNCTION ...` (mesmo padrão que `0064_add_user_id_to_actors.sql`). Em versões anteriores, substituir por `EXECUTE PROCEDURE` conforme documentação da versão.
- **Fase 1 sozinha não “fecha” o domínio identity** — só após **Fase 4** (trigger em modo EXCEPTION + `ensurePageActor` a passar `responsibleActorId`) é que a regra de âncora fica enforcement total.

---

## ESTADO DA EXECUÇÃO — ONDE CONTINUAR (última atualização)

Resumo para retomar o trabalho **sem reinventar**. O plano normativo nas secções seguintes mantém-se; isto é o **estado real do repo e do que já foi tentado em DEV**.

**Fechamento runtime §4.8 (concluído):** não há `INSERT INTO actors` em `backend/src/` fora de `identity.service` (Gate 0), `actor.repository` (persistência do writer) e testes. O simulador financeiro (`modules/observability/financial-simulator.controller.ts`) e o seed DEV (`scripts/seed-dev-companies-services.ts`) criam `users` / `companies` quando necessário e usam `ensureUserActor` / `ensurePageActor`. Lifecycle de wallet de utilizador no Bank: `owner_id = user_id` onde o repositório do Bank resolve o actor.

### Já implementado (código)

| Área | Estado |
|------|--------|
| **Fase 1** | `backend/src/modules/identity/actor-writer.service.ts` (`ensureUserActor`, `ensurePageActor`), exports em `modules/identity/index.ts`; `votes.service.ts` sem `INSERT INTO actors` na transação (actor via `ensureUserActor` antes de `runTenantTransaction`). |
| **Fase 2** | Migration `backend/migrations/20260510100000_actor_responsibility.sql` (coluna `responsible_actor_id`, trigger em **WARNING**, índice). Aplicar com `pnpm migrate` no ambiente. Cópia no repo pode incluir `DROP TRIGGER IF EXISTS trg_actors_responsibility` antes do `CREATE` (idempotência). |
| **Fase 4 (TypeScript + alinhamento DEV)** | `findOrCreatePageActor(tenantId, companyId, responsibleActorId)` em `actor.repository` + port + adapter; `ensurePageActor` com terceiro argumento; callers incl. `companies.service`, seeds sociais, testes. Simulador financeiro e `seed-dev-companies-services` **só** criam actors via writer; sem INSERT paralelo. |
| **Fase 5** | `backend/src/modules/risk-identity/actor-effective-block.ts` — `isActorEffectivelyBlocked()` com `runQueryWithTenant`. |
| **Fase 6** | `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` — §**4.8**–**4.8.7** (writer, exceções Gate 0 / repository / testes, Bank `user_id`, scripts não-runtime, ontologia `user`/`page` vs legado). |
| **SSOT** | `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` §**5.1** — escritor runtime e persistência alinhados ao §4.8. |

### Scripts operacionais (`backend/scripts/sql/` e `backend/src/scripts/`) — não são runtime

| Ficheiro | Função |
|----------|--------|
| `classify_company_actors_without_responsible.sql` | Classificação read-only (órfãos `company` sem `responsible_actor_id`). |
| `report_classify_company_actors_grouped.sql` | Agrega por `classification` × `risk_level`. |
| `apply_company_responsible_strong_owner_only.sql` | `UPDATE` **apenas** se `STRONG_OWNER` + `SAFE` e exactamente **um** actor humano (`users` + `actors` — **não** existe tabela `user_actors`; agregação com `(array_agg(hum.id))[1]` porque `MIN(uuid)` pode falhar no PostgreSQL). |
| `audit_orphan_company_actors_delete_blockers.sql` | Antes de `DELETE` de actors `company` com `company_id IS NULL`: verifica `actors.responsible_actor_id` inverso, `bank_accounts.actor_id`, `bank_transactions.actor_id`, `bank_splits`, `atl_blocked_actors`, `inventory_movements.actor_id`. **Não** usa `profiles.actor_id` (pós-0058 `profiles` usa `user_id`). |
| `delete_orphan_company_actors_no_company.sql` | `DELETE` canónico dos órfãos — **só** se a auditoria devolver **zero** linhas. |
| `src/scripts/actor-responsibility-phase3.ts` | Backfill + validação global (todos os não-humanos sem âncora). Exit 1 se pendentes. |
| `scripts/run-company-responsible-strong-owner.ts` | CSV para `scripts/output/` (gitignored) → agrupamento → apply STRONG → validação. |
| `scripts/run-orphan-company-cleanup.ts` | Ordem: **auditoria** → se zero bloqueios, `DELETE` → `actor-responsibility-phase3.ts`. |
| `scripts/reassign-orphan-company-to-trash-and-delete.ts` | **Saneamento local (DEV):** por tenant cria actor `system` com slug `__sanitation_trash_sink__`, reatribui `bank_accounts` / `bank_transactions` / `bank_splits` para esse sink, **remove** linhas `atl_blocked_actors` dos órfãos (evita `UNIQUE` em `actor_id`), `DELETE` em `product_offers` onde `merchant_id` é órfão (evita `UNIQUE` ao mover dois merchants para o mesmo sink), depois `DELETE` dos actors órfãos (`company`, `company_id` NULL). Transação única; no fim chama `actor-responsibility-phase3.ts`. **Não usar em produção.** |

### O que foi observado / feito no ambiente DEV (importante)

1. **Classificação dos ~50 `company` sem `responsible_actor_id`:** **`INVALID_STRUCTURE` / `CRITICAL`** (`company_id` NULL) → **0** correcções pelo script **STRONG_OWNER** (esperado).
2. **DELETE directo falhou** (auditoria com `bank_*`). **Estratégia aplicada:** `reassign-orphan-company-to-trash-and-delete.ts` — referências Bank movidas para sink por tenant; **12** `product_offers` apagados (merchants órfãos); **50** actors órfãos apagados; **`actor-responsibility-phase3.ts` → OK (zero pendentes não-humanos sem âncora).**
3. **Fase 3 (validação global):** neste ambiente, **passou** após o saneamento acima.

### Fase 4 (SQL enforcement) — aplicada

- Migration `backend/migrations/20260510200000_actor_responsibility_enforce.sql` criada e aplicável via `pnpm migrate` (substitui `trg_actor_responsibility_check` — **EXCEPTION** para não-humano sem `responsible_actor_id`).
- Validação: `scripts/verify-phase4-enforcement-insert.ts` (INSERT `company` sem âncora deve falhar); `scripts/verify-phase4-quarantine.ts` (`isActorEffectivelyBlocked` — cenário 2 depende de existir `page` com `responsible_actor_id` = humano usado no teste).

### Rotina após alterações no domínio Actor

Não reabre fases: é **manutenção de integridade**.

1. `pnpm exec tsx src/scripts/actor-responsibility-phase3.ts` — deve terminar com **exit 0** após mudanças que toquem `actors` (não-humanos sem âncora).
2. Recomendado: `grep -rn "INSERT INTO actors" backend/src --include="*.ts"` — **esperado:** apenas `identity.service.ts` (Gate 0), `actor.repository.ts` e testes (detalhe no **Checklist de verificação** abaixo).

---

## SCHEMA REAL (LIDO DAS MIGRATIONS — NÃO INFERIR)

```
actors.id          → PK UUID
actors.actor_id    → NOT NULL, alinhado a id (trigger/migração 0064); consultas sociais usam actor_id
actors.actor_type  → CHECK IN ('user','page','group','channel',
                                'actor_human','actor_organizational',
                                'actor_system','person','company','system')

Preferencial (código novo): humano = 'user'; empresa operacional = 'page' + companies.company_id
Legado no CHECK: 'person', 'company', … — evitar em fluxos novos quando existir equivalente user/page

Humanos (âncora):    'user', 'actor_human', 'person'
Não-humanos: 'page', 'group', 'channel', 'actor_organizational', 'company' (page + company_id é o caminho canónico para empresa)
Sistema:    'actor_system', 'system'  ← sem obrigação de âncora humana

companies.global_user_id → NULLABLE (não confiar como âncora)
company_users.is_primary → BOOLEAN default false, input-driven (não automático)
company_users.role       → 'owner' = responsável legal preferido
company_users.can_manage_company → true = controle real
```

---

## FASE 1 — Centralizar writer (sem alterar schema ou dados)

### Arquivo 1: CRIAR `backend/src/modules/identity/actor-writer.service.ts`

```typescript
/**
 * WRITER ÚNICO DE ACTORS — §4.8 LEI_COERENCIA_SISTEMICA_UNIFICARD
 *
 * Toda criação de actor passa por aqui.
 * Nenhum módulo de produto chama actor.repository diretamente para criar actors.
 *
 * Dívida técnica consciente: socialPortsRegistry permanece como engine —
 * acoplamento semântico com social a resolver em RFC futura.
 */
import { socialPortsRegistry } from '@core/social/ports-registry';

/**
 * Garante que existe um actor humano para este userId.
 * Idempotente — seguro chamar múltiplas vezes.
 * NÃO deve ser chamado dentro de transação ativa (usa runQueryWithTenant interno).
 */
export async function ensureUserActor(tenantId: string, userId: string) {
  const repo = socialPortsRegistry.getActorRepository();
  return repo.findOrCreateUserActor(tenantId, userId);
}

/**
 * Garante que existe um actor 'page' para esta empresa.
 * Idempotente — seguro chamar múltiplas vezes.
 * responsibleActorId: actor_id do humano (CPF) que criou a empresa.
 * OBRIGATÓRIO — nenhuma empresa existe sem âncora humana (§4.8.2).
 */
export async function ensurePageActor(
  tenantId: string,
  companyId: string,
  responsibleActorId: string
) {
  const repo = socialPortsRegistry.getActorRepository();
  return repo.findOrCreatePageActor(tenantId, companyId, responsibleActorId);
}
```

### Arquivo 2: MODIFICAR `backend/src/modules/identity/index.ts`

Adicionar ao final dos exports existentes:
```typescript
export {
  ensureUserActor,
  ensurePageActor,
} from './actor-writer.service';
```

### Arquivo 3: MODIFICAR `backend/src/modules/groups/votes.service.ts`

**Localizar:** no ficheiro `votes.service.ts`, o bloco que obtém ou cria o actor do utilizador **dentro** de `runTenantTransaction` / `trx.query` (comentário tipo "Obter ou criar actor" / `INSERT INTO actors` dentro da transação). Usar busca no ficheiro — **não** confiar em números de linha.

**Situação:** o votes.service cria actor DENTRO de uma transação (`runTenantTransaction`).
O actor.actor_id é usado apenas para inserir um post no feed (dentro da mesma transação).

**Solução:** mover a obtenção do actor para ANTES da transação.
`ensureUserActor` é idempotente — seguro fora da transação.

**REMOVER** (bloco completo dentro da transação):
```typescript
// 3. Obter ou criar actor do usuário (dentro da transação)
let actorRows = await trx.query({
  text: `SELECT a.* FROM actors a WHERE a.tenant_id = $1 AND a.user_id = $2 AND a.actor_type = 'user' LIMIT 1`,
  values: [tenantId, userId],
});

let actor;
if (!actorRows || actorRows.length === 0) {
  // ... busca user ... INSERT INTO actors ... 
}
```

**SUBSTITUIR POR** (antes do `runTenantTransaction`):
```typescript
// Obter ou criar actor do usuário ANTES da transação (idempotente)
import { ensureUserActor } from '@modules/identity/actor-writer.service';
const actorResult = await ensureUserActor(tenantId, userId);
const actorId = actorResult.actor_id;
```

**Dentro da transação**, substituir `actor.actor_id` por `actorId` onde usado no INSERT de posts.

---

## FASE 2 — Migration: coluna + trigger

### Arquivo: CRIAR `backend/migrations/20260510100000_actor_responsibility.sql`

```sql
-- 20260510100000_actor_responsibility.sql
-- §4.8 LEI_COERENCIA_SISTEMICA_UNIFICARD
-- Adiciona responsible_actor_id em actors + trigger de validação
-- FASE 2: trigger em modo WARNING (não bloqueia) — muda para EXCEPTION na Fase 4

BEGIN;

-- 1. Coluna responsible_actor_id
ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS responsible_actor_id UUID
    REFERENCES actors(id) ON DELETE RESTRICT;

-- Índice reverso: "quais entidades este humano responde?"
CREATE INDEX IF NOT EXISTS idx_actors_responsible_actor_id
  ON actors (responsible_actor_id)
  WHERE responsible_actor_id IS NOT NULL;

-- 2. Trigger de validação (WARNING enquanto backfill não está completo)
CREATE OR REPLACE FUNCTION trg_actor_responsibility_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_responsible_type TEXT;
BEGIN
  -- Humanos são a âncora final — não têm responsável
  IF NEW.actor_type IN ('user', 'actor_human', 'person') THEN
    IF NEW.responsible_actor_id IS NOT NULL THEN
      RAISE EXCEPTION
        'Actor humano (tipo=%) não pode ter responsible_actor_id.',
        NEW.actor_type;
    END IF;
    RETURN NEW;
  END IF;

  -- Sistema não requer âncora humana
  IF NEW.actor_type IN ('actor_system', 'system') THEN
    RETURN NEW;
  END IF;

  -- FASE 2: WARNING (muda para EXCEPTION na Fase 4 após backfill)
  IF NEW.responsible_actor_id IS NULL THEN
    RAISE WARNING
      'Actor não-humano (tipo=%, id=%) sem responsible_actor_id. '
      'Obrigatório após Fase 4 (backfill completo). '
      'Ver §4.8 LEI_COERENCIA_SISTEMICA_UNIFICARD.',
      NEW.actor_type, NEW.id;
    RETURN NEW;
  END IF;

  -- Responsável DEVE ser humano E do mesmo tenant
  SELECT actor_type INTO v_responsible_type
  FROM actors
  WHERE id = NEW.responsible_actor_id
    AND tenant_id = NEW.tenant_id;

  IF v_responsible_type IS NULL THEN
    RAISE EXCEPTION
      'responsible_actor_id=% não encontrado no tenant=%.',
      NEW.responsible_actor_id, NEW.tenant_id;
  END IF;

  IF v_responsible_type NOT IN ('user', 'actor_human', 'person') THEN
    RAISE EXCEPTION
      'responsible_actor_id deve ser actor humano. Encontrado: tipo=%. '
      'Proibido page→page (cadeia sem CPF). §4.8.2.',
      v_responsible_type;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_actors_responsibility
  BEFORE INSERT OR UPDATE OF responsible_actor_id, actor_type
  ON actors
  FOR EACH ROW
  EXECUTE FUNCTION trg_actor_responsibility_check();

COMMENT ON COLUMN actors.responsible_actor_id IS
  'Actor humano (CPF) âncora desta entidade não-humana. '
  'NULL = actor humano ou sistema (âncora final). '
  'NOT NULL obrigatório para page/group/channel/company após Fase 4. '
  'Regra: humano → NULL; não-humano → actor humano; sistema → NULL. '
  'Garantia: trigger trg_actors_responsibility. '
  'Writer único: modules/identity/actor-writer.service. §4.8.';

COMMIT;
```

**Executar:** `pnpm migrate` (ou o runner de migrations do projeto).

---

## FASE 3 — Backfill (executar SQL direto no banco)

**Executar APÓS Fase 2 aplicada.**

```sql
BEGIN;

-- Backfill actors 'page'/'company' → responsável via company_users
-- Regra: role='owner' + can_manage_company=true, fallback=mais antigo
UPDATE actors a
SET responsible_actor_id = best.actor_id
FROM (
  SELECT DISTINCT ON (cu.company_id)
    cu.company_id,
    ua.id AS actor_id
  FROM company_users cu
  INNER JOIN users u
    ON u.global_user_id = cu.global_user_id
  INNER JOIN actors ua
    ON ua.user_id = u.user_id
    AND ua.tenant_id = u.tenant_id
    AND ua.actor_type IN ('user', 'actor_human', 'person')
  WHERE cu.is_active = true
    AND cu.can_manage_company = true
    AND cu.tenant_id = ua.tenant_id
  ORDER BY
    cu.company_id,
    (cu.role = 'owner') DESC,
    cu.created_at ASC
) AS best
WHERE a.actor_type IN ('page', 'company', 'actor_organizational')
  AND a.company_id = best.company_id
  AND a.responsible_actor_id IS NULL;

COMMIT;

-- VALIDAÇÃO OBRIGATÓRIA (executar separado, ler resultado):
SELECT actor_type, COUNT(*) AS sem_responsavel
FROM actors
WHERE actor_type NOT IN ('user','actor_human','person','actor_system','system')
  AND responsible_actor_id IS NULL
GROUP BY actor_type
ORDER BY COUNT(*) DESC;

-- ESPERADO: zero linhas.
-- Se houver linhas → NÃO prosseguir para Fase 4.
-- Tratar cada tipo manualmente antes de continuar.
```

---

## FASE 4 — Endurecer constraint (somente após Fase 3 = zero pendentes)

**Executar SOMENTE quando a query de validação da Fase 3 retornar zero linhas.**

```sql
-- 20260510200000_actor_responsibility_enforce.sql
BEGIN;

-- Substituir trigger: WARNING → EXCEPTION (enforcement total)
CREATE OR REPLACE FUNCTION trg_actor_responsibility_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_responsible_type TEXT;
BEGIN
  IF NEW.actor_type IN ('user', 'actor_human', 'person') THEN
    IF NEW.responsible_actor_id IS NOT NULL THEN
      RAISE EXCEPTION 'Actor humano (tipo=%) não pode ter responsible_actor_id.', NEW.actor_type;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.actor_type IN ('actor_system', 'system') THEN
    RETURN NEW;
  END IF;

  -- EXCEPTION: nenhum actor não-humano sem responsável
  IF NEW.responsible_actor_id IS NULL THEN
    RAISE EXCEPTION
      'Actor não-humano (tipo=%) requer responsible_actor_id. §4.8 LEI_COERENCIA_SISTEMICA.',
      NEW.actor_type;
  END IF;

  SELECT actor_type INTO v_responsible_type
  FROM actors
  WHERE id = NEW.responsible_actor_id AND tenant_id = NEW.tenant_id;

  IF v_responsible_type IS NULL THEN
    RAISE EXCEPTION 'responsible_actor_id=% não encontrado no tenant=%.', NEW.responsible_actor_id, NEW.tenant_id;
  END IF;

  IF v_responsible_type NOT IN ('user', 'actor_human', 'person') THEN
    RAISE EXCEPTION 'responsible_actor_id deve ser actor humano. Encontrado: %.', v_responsible_type;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
```

**Após Fase 4:** atualizar `ensurePageActor` em `actor-writer.service.ts`
para passar `responsibleActorId` ao `findOrCreatePageActor`.

Atualizar o caller em `core/companies/companies.service.ts`:
```typescript
// Localizar: await actorRepository.findOrCreatePageActor(finalTenantId, companyId);
// Substituir por:
import { ensureUserActor, ensurePageActor } from '@modules/identity/actor-writer.service';

// Resolver actor humano do criador antes de criar o page actor
const creatorActor = await ensureUserActor(finalTenantId, userId);
await ensurePageActor(finalTenantId, companyId, creatorActor.actor_id);
```

---

## FASE 5 — Quarentena em cascata

**Adicionar em `backend/src/modules/risk-identity/`** (ou no serviço de authority existente).

**Imports:** no topo do ficheiro, garantir `import { runQueryWithTenant } from '@core/database/pool';` (ou o helper de tenant já usado nesse módulo).

`atl_blocked_actors` inclui `tenant_id` (`0002_identity.sql`) — **filtrar sempre por tenant** para não cruzar bloqueios entre tenants.

```typescript
/**
 * Verifica se um actor está efetivamente bloqueado:
 * - diretamente via atl_blocked_actors no mesmo tenant, OU
 * - o seu responsible_actor_id (âncora humana) está bloqueado no mesmo tenant
 */
export async function isActorEffectivelyBlocked(
  tenantId: string,
  actorId: string
): Promise<boolean> {
  const row = await runQueryWithTenant<{ blocked: boolean }>(
    tenantId,
    `
    SELECT EXISTS (
      SELECT 1
      FROM atl_blocked_actors atl
      WHERE atl.tenant_id = $1
        AND atl.actor_id = $2
      UNION ALL
      SELECT 1
      FROM atl_blocked_actors atl
      INNER JOIN actors a
        ON a.id = $2
       AND a.tenant_id = $1
      WHERE atl.tenant_id = $1
        AND a.responsible_actor_id IS NOT NULL
        AND atl.actor_id = a.responsible_actor_id
    ) AS blocked
    `,
    [tenantId, actorId]
  );
  return row?.blocked ?? false;
}
```

---

## FASE 6 — §4.8 na lei (texto canónico no repo)

**Arquivo canónico:** `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` — secção **§4.8** até **§4.8.7** (writer único, exceções Gate 0 / `actor.repository` / testes, alinhamento Bank `user_id`, scripts não-runtime, ontologia `user`/`page`).

**Remissão:** `docs/01_normative/LEI_COERENCIA_SISTEMICA_UNIFICARD.md` aponta para o ficheiro acima — não duplicar norma.

**SSOT:** `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` §**5.1** — escritor runtime e persistência.

Se estiveres a replicar norma noutro documento, **copia a redacção atual da lei** em vez do bloco histórico que existia neste ficheiro.

---

## Checklist de verificação pós-execução

```bash
# 1. Nenhum INSERT INTO actors em runtime fora das exceções normadas (§4.8.1)
grep -rn "INSERT INTO actors" backend/src/ --include="*.ts" |
  grep -v "actor.repository\|identity.service\|__tests__\|\.test\.\|\.spec\."
# Esperado: zero linhas
# Nota: actor-writer não contém SQL — o INSERT está em actor.repository.

# 2. Migration aplicada
psql -c "SELECT column_name FROM information_schema.columns
  WHERE table_name='actors' AND column_name='responsible_actor_id';"
# Esperado: responsible_actor_id

# 3. Trigger existe
psql -c "SELECT trigger_name FROM information_schema.triggers
  WHERE event_object_table='actors' AND trigger_name='trg_actors_responsibility';"
# Esperado: trg_actors_responsibility

# 4. Índice criado
psql -c "SELECT indexname FROM pg_indexes
  WHERE tablename='actors' AND indexname='idx_actors_responsible_actor_id';"
# Esperado: idx_actors_responsible_actor_id
```

---

## Restrições obrigatórias para o Cursor

1. **NÃO modificar** `core/identity/identity.service.ts` — arquivo congelado Gate-0
2. **NÃO alterar** a PK `actors.id` ou a coluna `actors.actor_id`
3. **NÃO usar** `person`, `actor_human` ou `company` como tipos humanos sem verificar o CHECK atual
4. **NÃO executar Fase 4** antes de confirmar que a query de validação da Fase 3 retorna zero
5. **NÃO mover** `actor.repository.ts` de `modules/social` — acoplamento existente intencional
6. **Executar em ordem**: Fase 1 → Fase 2 → Fase 3 (verificar) → Fase 4 → Fase 5 → Fase 6

---

## Continuação normativa — Authority (§4.9)

**Não é pendência deste prompt** — é **evolução normativa** do sistema (permissão, acting on behalf, delegação).

Com **identity (§4.8)** fechado, seguir `CURSOR_PROMPT_AUTHORITY_LAYER.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §**4.9** e `SSOT_REGISTRY_UNIFICARD.md` §**5.16**. **Não duplicar** essa norma neste ficheiro.

