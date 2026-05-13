# F11 — Handler `social.event_feed.event_created` convergido para schema canônico posts (B9 resolvido)

**Data:** 2026-05-13
**Modo:** GUARDIÃO (audit curto) → EXECUTOR (fix localizado)
**Branch:** `rescue-structural`
**HEAD anterior:** `8a2aab57` (F10 — DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION CLOSED)
**HEAD pós-execução:** TBD

---

## 1. Origem material

Bug B9 (descoberto em F7 execução dinâmica): handler async `social.event_feed.event_created` falha com `coluna "global_user_id" da relação "posts" não existe` em todo evento criado via smoke v3. Bug não-bloqueante para checkout fundacional, mas ruidoso nos logs e impacta feed social pós-evento.

Diretiva Clayton: "você já sabe o que tem que ser feito" — executar demandas mapeadas com fluidez.

## 2. Audit material

Schema soberano `posts` (migration `20260530300000_social_posts.sql`):
```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),  -- FK canônica
  content TEXT NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'standard' CHECK (...),
  media_ids UUID[] NOT NULL DEFAULT '{}',
  intent TEXT,
  intent_metadata JSONB,
  targeting JSONB,
  is_published BOOLEAN, is_deleted BOOLEAN,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at, updated_at TIMESTAMPTZ
);
```

**3 INSERTers em posts table, 3 schemas distintos esperados:**

| Caller | Drift |
|---|---|
| `social.repository.ts:44` (createPost) | **Total** — schema antigo completo (global_user_id, type, visibility, media, confidence, categories, suggested_actions, event_id) |
| `social-2.0.service.ts:730` | **Parcial** — tem actor_id mas também passa global_user_id inexistente |
| `votes.service.ts:147` | **Parcial** — idem |

Aplicação da heurística "runtime soberano = concentração de causalidade validada" (memória `feedback_runtime_soberano.md`):
- **Schema atual canônico** = runtime soberano (FK actors NOT NULL aplicado, índices criados, post_type CHECK constraint)
- **social.repository.ts:44** = código aspiracional não convergido (drift §28 — código atrás de migration soberana)

## 3. Escopo da frente (cirúrgico)

Refactor completo de `social.repository.ts` + tipo `PostRow` cascateia em 20+ arquivos (`social-2.0.routes.ts`, `social-2.0.service.ts`, etc. — todos usam `post_id` e `global_user_id` antigos). Frente arquitetural maior.

**F11 escopo cirúrgico:** corrigir apenas o handler async `event-feed.handlers.ts` (que causa bug B9) via INSERT canônico inline, sem mexer em social.repository.ts.

Refactor completo de social.repository.ts permanece como DT a registrar (frente futura dedicada).

## 4. Edits aplicados

### `event-feed.handlers.ts:handleEventCreated`

Substituído `socialRepository.create(...)` por INSERT canônico inline:
- Schema: `tenant_id`, `actor_id`, `content`, `post_type='system_auto_post'`, `intent='event'`, `intent_metadata` JSONB (event_id, event_type, datetime_start, datetime_end, status), `metadata` JSONB (type, visibility, created_by_global_user_id legacy field)
- `actor_id` obtido de `eventRow.actor_id` (canônico FK actors)
- Validação prévia: `eventRow.actor_id` em vez de `globalUserId`
- `globalUserId` continua resolvido para preservar audit (armazenado em metadata.created_by_global_user_id)

Fix adicional: SQL lookup linha 81 corrigido de `WHERE a.actor_id = $1` para `WHERE a.id = $1` (actors PK é `id`, não `actor_id` — mesmo padrão semântico do fix F8 em `resolveEventOrganizerAccount`).

### `event-feed.handlers.ts:handleEventPublished`

- SELECT/UPDATE atualizados para schema canônico:
  - `SELECT post_id` → `SELECT id`
  - `WHERE event_id = $2` → `WHERE intent_metadata->>'event_id' = $2` (event_id agora armazenado em intent_metadata JSONB conforme INSERT canônico)
  - `WHERE post_id = $1` → `WHERE id = $1`

### `event-feed.handlers.ts` imports

- Removido `import { SocialRepository }` e `const socialRepository = new SocialRepository()` (não usados mais)

## 5. Validação dinâmica

Smoke v3 fundacional executado pós-F11: **14/14 PASS preservado.**

Backend logs limpos:
- Antes F11: `[CANONICAL] ❌ Handler error for "event.created" { ... error: 'coluna "global_user_id" da relação "posts" não existe' }` (a cada smoke)
- Pós-F11: `[EventFeedHandler] Post criado no feed para evento: e68ce49c-0aea-41c0-a1e8-d6038a4804a3` (sem erro)

## 6. Verificação institucional

| Gate | Resultado |
|---|---|
| TSC backend | 0 erros |
| `validate:actor-writer-boundaries` | GATE OK [§4.8.1] |
| `validate:bank-ledger-boundaries` | GATE OK [§4.6] |
| `validate:regression-guards` | GATE OK [financial + sql-lint + 300 migrations] |

## 7. NÃO tocados (transparência institucional)

- ❌ `social.repository.ts` (createPost com schema antigo total) — drift §28 permanece; refactor cascateia em 20+ arquivos; **DT a registrar** para frente arquitetural dedicada
- ❌ `social.types.ts:PostRow` — tipo continua com `post_id`/`global_user_id`; alinhamento com schema canônico em sessão dedicada
- ❌ `social-2.0.service.ts:730` e `votes.service.ts:147` — drift parcial (passa global_user_id inexistente); fix similar a este F11 (remover coluna do INSERT) em frente futura
- ❌ Outros consumers de `post_id` (`social-2.0.routes.ts` ~10 lugares, etc.) — refactor cascateado fica para sessão dedicada
- ❌ Outras DTs OPEN preservadas

## 8. DT a registrar (sessão futura)

**DT-SOCIAL-REPOSITORY-DRIFT-§28** (sugerido):
- `social.repository.ts` createPost + findById + outros usam schema antigo (`post_id`, `global_user_id`, `type`, `visibility`, `media`, `confidence`, `categories`, `suggested_actions`, `event_id`)
- Schema canônico atual (migration 20260530300000): `id`, `actor_id`, `post_type`, `media_ids` UUID[], `intent_metadata` JSONB, `targeting` JSONB, sem `visibility`/`confidence`/`categories`/`suggested_actions`/`event_id` (armazenados em metadata)
- Cascata em ~20 arquivos (`social-2.0.routes.ts`, `social-2.0.service.ts`, `votes.service.ts`, etc.)
- Aplicação da heurística "runtime soberano": schema canônico (migration aplicada) é soberano; código aspiracional não convergido
- Não-bloqueante para smoke v3 fundacional (B9 resolvido localmente)
- Convergência: sessão dedicada futura quando social module for priorizado OR conforme necessidade
- Prioridade: MÉDIA (impacta APIs sociais via routes; baixa para fluxo econômico)

## 9. Aderência ao protocolo

- §2.2.2 prova de rastreabilidade — schema migration `20260530300000:1-26`; INSERT antigo `social.repository.ts:44-78`; handler corrigido `event-feed.handlers.ts:90-126`
- §29 git add específico (apenas event-feed.handlers.ts + este log)
- §25 pendências preservadas com critério de convergência (DT-SOCIAL-REPOSITORY-DRIFT-§28 sugerida)
- §28 (drift code↔schema) — fix localizado preserva legacy callers; convergência total fica para frente dedicada
- §10 não toquei norma
- Heurística "runtime soberano" aplicada (memória `feedback_runtime_soberano.md`): schema canônico = soberano; código antigo = aspiracional
- Calibração 2026-05-13 — "menos meta-governança, mais runtime validado": fix material direto sem inflar

## 10. Estado pós-F11

| Item | Estado |
|---|---|
| Handler `social.event_feed.event_created` | ✅ INSERT canônico inline; post criado com sucesso |
| Handler `social.event_feed.event_published` | ✅ SELECT/UPDATE canônico via intent_metadata->>'event_id' |
| Smoke v3 dinâmico | ✅ 14/14 PASS preservado |
| Backend logs B9 | ✅ erro eliminado; log mostra "Post criado no feed para evento: ..." |
| TSC + 3 gates | ✅ PASS |
| `social.repository.ts` drift §28 | ⏳ preservado para frente dedicada (DT-SOCIAL-REPOSITORY-DRIFT-§28 sugerida) |
| Outras DTs OPEN | Preservadas |
