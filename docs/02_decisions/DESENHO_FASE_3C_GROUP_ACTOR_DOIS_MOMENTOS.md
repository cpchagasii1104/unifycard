# Desenho Fase 3C — Group-Actor em Dois Momentos

**Status:** desenho formal (a ratificar Clayton + Opus + ChatGPT). 2026-05-30.
**Natureza:** decisão de produto + arquitetura para a fatia 3C. Espelha o desenho 3B
(`docs/02_decisions/DESENHO_FASE_3B_EMPRESA_DOIS_MOMENTOS.md`, commit 691b2169).
**Escopo desta fatia (3C.2):** SÓ este documento. Zero código/migration/schema/commit.

> Banda/artista NÃO é tratada aqui como semântica — fica para CONCEPT futuro. A 3C trata o
> substrato genérico de **group-actor** (actor_type='group'), do qual banda será um caso.

---

## Verificações de fonte (feitas antes de escrever)

| # | Item | Resultado (arquivo:linha / SELECT) |
|---|------|-----------------------------------|
| 1 | `ensurePageActor` | **Confirmado** `backend/src/modules/identity/actor-writer.service.ts:28` (Pesquisa D correta). |
| 2 | `ensureUserActor(tenantId, userId)` | `actor-writer.service.ts:17`. Não existe `ensureGroupActor` hoje. |
| 3 | Lei de Coerência (repo real) | §4.8 (l.226), **§4.8.1 Writer único** (l.228), **§4.8.2 Actor âncora/responsabilidade civil** (l.248), **§7 ordem causal** SEMÂNTICA→IDENTIDADE→AUTORIDADE (l.463-464). **Bate com o anexo — sem divergência.** |
| 4 | DB vivo | `actors`: **sem `uq_actors_group`** (só `uq_actors_company_page`); **sem FK `actors.group_id`**; trigger **`trg_actors_responsibility` ATIVO**. `groups`: PK `id`, coluna **`actor_id` JÁ EXISTE** (nullable), `owner_actor_id` existe, **sem `group_id`**, índices só `groups_pkey`/`groups_tenant_id_slug_key`. `group_members`: unique `(tenant_id, group_id, user_id)`, sem CHECK em `role`. |
| 5 | Bug `addMember` | `groups.repository.ts:187` add owner como `'owner'` + `:190` re-add **mesmo** user como `'admin'`; `addMember` (`:392-394`) `INSERT ... ON CONFLICT (tenant_id, group_id, user_id) DO UPDATE SET role = EXCLUDED.role` → 2ª chamada **sobrescreve owner→admin**. Confirmado. |

---

## §1 Enquadramento normativo

`ensureGroupActor` é **extensão controlada do writer único de Identity** (Lei §4.8.1,
`actor-writer.service.ts`), juntando-se a `ensureUserActor`/`ensurePageActor`. Nenhuma
realidade paralela: Identity só via `actors`; `INSERT INTO actors` direto continua proibido
fora das exceções §4.8.1. A âncora civil do group-actor respeita **§4.8.2** (responsabilidade
civil resolvível até actor humano). Ordem causal **§7**: SEMÂNTICA (CONCEPT §4.10) → IDENTIDADE
(actors §4.8) → AUTORIDADE (§4.9). A 3C opera na camada **IDENTIDADE**; a semântica de
banda/artista (CONCEPT) e a authority plena ficam para fatias próprias.

## §2 D1 — drift documentado

D1 canônico: `actor_type ∈ {user, page, group, channel}`. O schema vivo aceita **10 valores**
(inclui legados `actor_human`/`company`/`person`/`system`/`actor_organizational`/`actor_system`).
A 3C usa `actor_type='group'` **legitimamente** (4º canônico). **NÃO** podar a constraint nesta
fatia. O drift de vocabulário permanece como dívida viva — referência:
**DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION** (já registrada).

## §3 Nomenclatura canônica (07_NOMENCLATURA_CANONICA)

`ensureGroupActor`, `group_actor` (conceito), `owner_actor_id`, `responsible_actor_id`,
`group_id` (FK lógica para `groups.id`). Booleanos `is_`/`has_`/`can_`. SQL `snake_case`,
TS `camelCase`. O actor de grupo é `actor_type='group'` com `group_id` apontando para `groups.id`.

## §4 Desenho em dois momentos

| Momento | Estado | `groups.actor_id` | Visível ao resolver |
|---------|--------|-------------------|---------------------|
| **1 — social/inerte** | `groups` existe (entidade social), sem actor operacional | **NULL** | Não (não é actor operável) |
| **2 — operacional** | `ensureGroupActor()` cria `actor_type='group'` | preenchido | Sim (fora do escopo 3C — ver §7) |

`ensureGroupActor(tenantId, groupId)` — single writer transacional:
- **SELECT FOR UPDATE** na row de `groups` (lock).
- **Idempotente:** se `groups.actor_id IS NOT NULL`, retorna o actor existente **sem criar**.
- Cria `actors (actor_type='group', group_id, responsible_actor_id)` e grava `groups.actor_id`
  na **mesma transação** (espelha o padrão de `activateCompanyOperationally` da 3B.3).
- **Fail-closed** em qualquer ponto → rollback total (nunca grupo meio-operacional).
- Writers que usam client interno (resolução do owner) ficam **fora** do `BEGIN/COMMIT`,
  como na 3B.3 (lição da 3A: `ensure*` não rodam dentro de transação).

## §5 Âncora civil (§4.8.2)

- `groups.owner_actor_id` **obrigatório**, apontando para actor `actor_type='user'` com
  `global_user_id NOT NULL`.
- `group_actor.responsible_actor_id = groups.owner_actor_id`.
- Se o owner **não** resolver para humano válido (sem `global_user_id`/identity), o writer
  **FALHA ANTES do trigger** — fail-closed na aplicação, não só no banco (`trg_actors_responsibility`
  é a segunda linha de defesa).
- Cadeia: `group → owner_actor_id → user-actor → global_user_id → identity/tax_id`.
- **NÃO** adicionar `groups.global_user_id` (a responsabilidade civil viaja pela cadeia do owner,
  não por coluna nova — análogo a `companies` não ganhar identidade própria).

## §6 Authority — mínimo

`group_members` entra **só** no necessário para preservar owner/admin corretamente:
corrigir o bug do `addMember` (§verificação 5) — o owner não pode ser sobrescrito para `admin`
por `ON CONFLICT DO UPDATE`. Opções a ratificar na 3C.3 (não decidir aqui): (a) não re-adicionar
o owner como `admin` (owner já é superset); (b) tornar `addMember` aditivo/idempotente que não
rebaixa owner. **Não** resolver authority inteira, **não** inventar capability nova.

## §7 Limites explícitos da 3C (o que NÃO entra)

- **Resolver intocado:** `findAvailableActors` NÃO é alterado nesta fatia.
- Sem classificação artista/banda/CONCEPT.
- Sem normalização de `group_members` para `actor_id` (continua `user_id`).
- Sem bank/authz plenos.
- Sem poda de D1.

## §8 DTs despertadas pela 3C (a registrar em fatia futura — esta NÃO altera o DT_LOG)

- **(a) Bank trata group como `ownerType:'company'`.** Confirmado:
  `bank-http.routes.ts:218` → `getAccountByOwner(tenant, group_id, 'company', 'BRL')` para
  `actor_type='group'`; e `bank-integration.service.ts:441` → `resolveGroupAccount`, que em
  `:58-61` usa `ownerType:'company'` com `TODO: adicionar 'group' como ownerType`. Conta de
  grupo herda semântica de empresa — dívida.
- **(b) `authorization.service.ts:396` usa `WHERE group_id = $1` em `groups`.** Confirmado:
  `groups` **não tem coluna `group_id`** (PK é `id`); o correto seria `WHERE id = $1`. Bug latente.

## §9 Critérios de CLOSED da futura 3C.3 (checklist derivado)

- [ ] Migration: unique partial index `actors(group_id) WHERE actor_type='group' AND group_id IS NOT NULL`; FK
      `actors.group_id → groups(id)`; (se viável) unique em `groups.actor_id WHERE actor_id IS NOT NULL`.
- [ ] Guarda de duplicatas de group-actor antes do índice (espelha 3B.3 / page-actor).
- [ ] `ensureGroupActor()` implementado no writer único, transacional, FOR UPDATE, idempotente, fail-closed.
- [ ] Âncora civil: owner humano válido exigido na aplicação antes do trigger.
- [ ] Bug do `addMember` (owner→admin) corrigido com teste.
- [ ] E2E M/A/(R-opcional) verde; typecheck clean; 4 gates verdes; `critical_new=0`; sem warning nova.
- [ ] `company-canonical.service`, resolver e flags de marketplace NÃO tocados.
- [ ] D1 não podado; drift permanece como DT.
- [ ] DEV limpo (dados de teste removidos).

---

## APÊNDICE — RASCUNHO SQL DESARMADO

**Rascunho para revisão — NÃO EXECUTAR. A migration real só nasce na etapa executora após
leitura do schema vivo.**

Hipóteses a validar (não são DDL definitivo):

- (hipótese) `CREATE UNIQUE INDEX uq_actors_group ON actors(group_id) WHERE actor_type='group' AND group_id IS NOT NULL;`
- (hipótese) `ALTER TABLE actors ADD CONSTRAINT actors_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE ...;` (cascade/restrict a decidir).
- (hipótese) `CREATE UNIQUE INDEX uq_groups_actor ON groups(actor_id) WHERE actor_id IS NOT NULL;` (se o diagnóstico confirmar 1:1 group↔actor viável).
- (hipótese) `CHECK` em `group_members.role` com valores mínimos (`owner`/`admin`/`member`?) — só se o desenho ratificar o vocabulário.

Cada item é **hipótese**; numeração/nomenclatura reais seguem o padrão do repo na 3C.3.
