# GATE READ-ONLY D9.2-B — VEREDITO (2026-07-18)

**Modo:** GUARDIÃO / read-only. Zero material executado, zero arquivo de produto editado, zero DML.
**Repo/branch:** `C:\unificard` @ `rescue-structural`. **Banco consultado (somente leitura):** `unificard_dev`.
**Contrato:** DECISION-0188 (SELADA docs-only). D9.2-A SELADA e DORMENTE. **D9.2-B (cutover) permanece FECHADA — este veredito NÃO é um GO.**
**Autorizado pela campanha §10** (executar o Gate read-only; NÃO executar o material sem novo GO expresso do titular).

---

## EIXO 1 — MIGRATIONS

| Casa | Migration | Existe | Aplicada em `unificard_dev` |
|---|---|---|---|
| `group_members` (legado vivo) | `20260530190000_group_members.sql` | Sim | **APLICADA** (executed_at 2026-05-29) |
| `group_actor_memberships` (D9.2-A) | `20260718120000_group_actor_memberships.sql` | Sim | **NÃO aplicada** (`to_regclass=null`) |
| `group_institutional_bindings` (D9.1) | `20260717120000_group_institutional_bindings.sql` | Sim | **NÃO aplicada**; candidate keys compostas ausentes |

A migration D9.2-A tem PREFLIGHT fail-closed que aborta sem a D9.1 aplicada + candidate keys. Em dev, D9.2-A não é aplicável isoladamente (exige D9.1 antes). Ambas provadas só em clone efêmero destruído. Coerente com o selo (dev intocado).

## EIXO 2 — WRITERS
**Vivos (user-first) em `groups.repository.ts`:** `addMember` (INSERT ON CONFLICT por `user_id`), `removeMember` (**DELETE FÍSICO** — viola append-only D7), `create` (duplo addMember owner/admin). Callers montados: `POST /groups/:id/join`, `POST /groups/:id/leave`, `DELETE /groups/:id/members/:userId`, `PATCH /groups/:id/members/:userId`.
**Governados (5 fns) DORMENTES:** `fn_enter/leave/remove_group_actor_membership`, `fn_create/accept_group_membership_intent`. Wrapper TS `group-actor-membership.repository.ts`/`.service.ts`. **ZERO caller de produto** — `groups.routes.ts` não importa o service novo; `unificard_app` sem INSERT/UPDATE/DELETE (escrita só via fns).

## EIXO 3 — READERS a repontar no cutover
`getMembers`, `isUserAdminOrOwner` (**role-como-authority**, remover), `getUserGroups` ("meus grupos"), `getUserGroupCount` (cap), **feed group-scoped** (`core/feed/feed.routes.ts:201-213`), **events-B3 discovery** (`events-sprint76.routes.ts:170`, `event.types.ts:166-167`). Todos convergem no MESMO cutover.

## EIXO 4 — DADOS (unificard_dev)
`group_members` = **1 linha** (owner). `group_actor_memberships` = tabela inexistente. `group_invites` = 0. **Backfill = 1 membership (trivial).** Δbank=0.

## EIXO 5 — UNIQUENESS
`group_members`: `UNIQUE (tenant_id, group_id, user_id)` (user-first, sem status). `group_actor_memberships`: `uq_gam_active_membership (tenant_id, group_id, member_actor_id) WHERE status='active'` + idempotência. **`group_invites` RESIDUAL (`GAM_INTENT_LEGACY_UNIQUE_RESIDUAL`):** `uq_group_invite (group_id, invited_actor_id)` — **sem tenant, cobre TODOS os status** → histórico bloqueia novo convite para sempre. D9.2-A NÃO mascarou (falha fechada com marcador); substituição governada = ato do D9.2-B.

## EIXO 6 — BACKFILL determinístico
`group_members(1) → actors (tenant+user_id, actor_type='user')` = **1 match, 0 ambíguos, 0 órfãos, 0 mismatch**. 100% determinístico (DECISION-0188 D0.4). Backfill via `fn_enter_group_actor_membership` (source_intent=NULL, idempotência determinística), `user_id`/`global_user_id` nunca persistem na casa nova (D5).

## EIXO 7 — ROLLBACK / recovery
Casa nova **ADITIVA** e forward-safe (CREATE + índices + 2 triggers + 5 fns + RLS + colunas nulas em invites; nada dropado). Passos destrutivos são do CUTOVER (não da fundação): congelar `group_members`, eliminar DELETE físico, substituir UNIQUE de invites. DECISION-0188 D16 **proíbe** remoção física da tabela antiga no D9.2-B.

## EIXO 8 — RESIDUAL / CAP / AUTHORITY
**Role-como-authority** vivo em `isUserAdminOrOwner`; banco só tem owner → nenhuma autoridade real a converter em grant; flip exige `canRepresentActor(group_actor_id)`. **Cap:** criação=1 (owner_actor), participação=3 (`joinGroup`, sobre `group_members.user_id`); no cutover vira política civil-humana contando só ativas de user-actor, **sem contagem dupla** user_id+actor_id (D12).

## EIXO 9 — COMPATIBILIDADE
As 6 superfícies de namespace divergente (join/leave/invites-mine/request/acceptInvite/createInvite-getMembers) seguem vivas e intocadas; 3 namespaces (`global_user_id` só resolve/nunca persiste como Actor · `user_id` legado · `actor_id` canônico) e events-B3 preservados. Convergem JUNTOS no cutover; nenhum fallback triplo/cross-namespace pode sobreviver.

## EIXO 10 — STOP e SEAL
**STOP:** 2ª casa Actor-first paralela · `actor_id` permanente em `group_members` como 2ª verdade · dual-write/dual-read indefinido · fallback triplo sobrevivente · `global_user_id` como Actor · actionContext como authority · role concedendo poder pós-flip · membership criando grant · DELETE/reativação de terminal · 2 ativas no trio · Actor proibido/cross-tenant · invite accepted sem membership · UNIQUE de invites ainda eterno · cap em 2 namespaces · reader user-first vivo pós-flip · Δbank≠0 · abertura D9.3/D9.4/audience · RLS genérica das legadas (fora do envelope D15).
**SEAL:** typecheck 0 · runner verde (guard 189) · mutations 100% mortas · unit+E2E verdes · migrations D9.1+D9.2-A+cutover aplicadas no ambiente autorizado com preflight/pós-verificação · backfill determinístico PROVADO (igualdade legado×nova; mismatch=falha fechada) · flip atômico writers+readers · 6 superfícies convergidas · events-B3 migrado · role-authority retirada · cap humano ativado · `group_members` congelada (DML bloqueado, sem remoção física) · UNIQUE de invites substituído · concorrência real provada · Δbank=0 · DECISIONs/material byte-intactos · Yala única.

## ENVELOPE MATERIAL MÍNIMO (ordenado; NÃO autoriza execução)
1. Aplicar migrations na ordem D9.1→D9.2-A→cutover (preflight fail-closed). 2. Backfill determinístico (1 owner). 3. Validação de igualdade legado×nova. 4. Substituir UNIQUE de `group_invites` (tenant-scoped + parcial pending). 5. Freeze DML de `group_members` (revogar de `unificard_app`). 6. Swap writers+readers JUNTOS (join/leave/remove/getMembers/getUserGroups/getUserGroupCount/feed/events-B3); DELETE físico vira `left`/`removed`. 7. Corrigir 6 superfícies de namespace. 8. Remover role-como-authority → `canRepresentActor`. 9. Ativar cap civil-humano. 10. Bloquear DML sem remoção física. 11. Guards+mutations+E2E+concorrência, Yala, selo.

---

## VEREDITO FINAL
**Desenho maduro, sem impedimento estrutural.** Fundação correta; backfill 100% determinístico (1 row); casa nova aditiva/forward-safe; defeitos vivos inventariados e convergentes no mesmo cutover.

**BLOQUEADORES para GO imediato (o material NÃO inicia sem):**
- **B1 (governança):** D9.2-B FECHADA — exige **novo Gate + novo GO humano explícito e separado** (DECISION-0188 D16). Este veredito read-only não é esse GO.
- **B2 (ambiente):** em dev, D9.1 e D9.2-A **não estão aplicadas** (candidate keys ausentes) → cutover não executável em dev sem antes aplicá-las; ambiente-alvo deve ser explicitamente autorizado.
- **B3 (residual):** `uq_group_invite` legado deve ser substituído DENTRO do envelope (passo 4).
- **B4 (defeitos vivos):** DELETE físico, role-como-authority, 6 superfícies de namespace, events-B3, feed — nenhum pode restar após o flip.

**Conclusão:** arco **elegível para que o titular emita um GO D9.2-B material específico**; até lá, **STOP** — a frente permanece corretamente dormente. Nenhuma alteração feita neste Gate.
