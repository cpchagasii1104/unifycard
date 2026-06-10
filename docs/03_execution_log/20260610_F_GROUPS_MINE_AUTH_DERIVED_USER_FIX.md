# Execution Log — F-GROUPS-MINE-AUTH-DERIVED-USER-FIX · GET /groups/mine sujeito derivado do JWT

**Data:** 2026-06-10
**Frente:** `F-GROUPS-MINE-AUTH-DERIVED-USER-FIX`
**HEAD origem:** `3c2f2b3f` · **Branch:** `rescue-structural` · **dev:** 365
**Modo:** BACKEND (1 arquivo de rota + 1 e2e)
**Governado por:** DECISION-0113 (actorId cliente = hint, não autoridade) + DECISION-0116 Classe C `GROUP_MEMBERS`

---

## 1. O que foi corrigido

`GET /groups/mine` em `backend/src/modules/groups/groups.routes.ts` linha 501–523.

**Problema:** handler usava `const userId = req.actionContext.actorId` (campo `actors.id`, UUID de actor) como argumento para `groupsService.getUserGroups(tenantId, userId)`. O repositório executa:
```sql
WHERE g.tenant_id = $1 AND gm.user_id = $2 AND g.status = 'active'
```
onde `gm.user_id` é FK → `users(user_id)`. `actors.id ≠ users.user_id` semanticamente — type confusion. Adicionalmente, `actionContext.actorId` é declarado pelo cliente via canal-1 (spoofável sem `canRepresentActor` — DECISION-0113 vetor).

**Fix cirúrgico:**
- `const userId = req.user?.userId;` — JWT `sub` = `users.id` ≡ `users.user_id` (server-side, não spoofável)
- Guard `if (!userId) return reply.code(401).send({ error: 'UNAUTHENTICATED' });` — fail-closed sem fallback
- Remoção do guard antigo `if (!req.actionContext || !req.actionContext.actorId) throw BadRequest('ActionContext obrigatório')` — baseado na fonte errada, tipo de falha errado
- Handler declarado como `async (req, reply)` — `reply` necessário para `.code(401)`
- Service/repository inalterado: `getUserGroups(tenantId, userId)` já era a assinatura correta, só a origem do `userId` mudou

## 2. Prova (E2E 16/16)

`validate-pipeline-e2e-groups-mine-auth-derived-user.ts`

**A comportamental (DB fixtures reais):**
- A1 dev user existe
- A2 query member-scoped retorna count determinístico
- A3 stranger UUID → 0 grupos (sem leak)
- A4 actorId ≠ userId documentado (type confusion confirmada)

**B estrutural (código-fonte):**
- B1 `req.user?.userId` presente no handler
- B2 guard 401 fail-closed
- B3 sem `req.actionContext.actorId` como userId de seleção
- B4 `(req, reply)` no handler
- B5 `gm.user_id = $2` no repositório
- B6 service delega sem transformação de ID
- B7 GET não chama `ensureUserActor` nem `getActiveActor`
- B8 sem INSERT/UPDATE (read-only)
- B9 contrato `{ groups: groupsWithCount }` preservado
- B10 OLD guard `"ActionContext obrigatório"` removido

**D schema:** `group_members.user_id` existe (FK→users); `actor_id` não existe na tabela.

## 3. Gates

| Gate | Resultado |
|------|-----------|
| `tsc --noEmit` | OK — 2 erros pré-existentes em `geo-enrichment.service.ts`, não introduzidos |
| `validate:architecture:strict` | OK — `critical_new=0` |
| `validate:system-state:strict` | OK — PASS |
| `groups-create-self-authorship-f6-4` | 10/10 (regressão) |
| E2E novo `groups-mine-auth-derived-user` | **16/16** |

## 4. Artefatos criados/alterados

- **Modificado:** `backend/src/modules/groups/groups.routes.ts` (handler `/mine`)
- **Novo:** `backend/src/scripts/validate-pipeline-e2e-groups-mine-auth-derived-user.ts`
- **Topo:** `STATUS_EXECUCAO_GLOBAL.md`
- **Append:** `opus.md` (sessão cont.157)
- **Novo:** este execution log

## 5. Escopo intocado / STOPs

Zero migration/banco/frontend/Bank/ledger/wallet/payout/split/settlement/PJ/agenda/gender/D3/R2/FASE 6. Outros routes de grupos intocados. Suppliers/contacts/inventory/PO/escrow/finance-agenda/daily-metrics não tocados. C1/tenant compartilhado NÃO liberado. DECISION-0113 NÃO declarada fechada. Denominador global NÃO declarado fechado.

## 6. Próximo passo

Enumeração do denominador Classe-A finito (repositórios READ com owner-col + scope só por tenant_id) → hardening por classe (suppliers/inventory/PO) → gate de regressão → Yala → só então C1 liberável. Escrow/finance-agenda em frente money própria três paralelas (DECISION-0115 D5).
