# Execution Log — F-GROUPS-MINE-HTTP-PROOF-AND-ACTIONCONTEXT-DECOUPLING · GET /groups/mine HTTP real + bypass exato

**Data:** 2026-06-10
**Frente:** `F-GROUPS-MINE-HTTP-PROOF-AND-ACTIONCONTEXT-DECOUPLING`
**HEAD origem:** `c00435da` · **Branch:** `rescue-structural` · **dev:** 365
**Modo:** BACKEND (1 plugin + 1 e2e reescrito; zero migration/banco/frontend/Bank)
**Governado por:** DECISION-0113 (actorId cliente = hint, não autoridade) + DECISION-0116 Classe C `GROUP_MEMBERS`
**Resíduos fechados:** R1 (sem HTTP proof) + R2 (falso contrato actionContext em rota self-scoped)

---

## 1. O que foi corrigido

### R2 — Bypass exato em `action-context.plugin.ts`

`GET /groups/mine` é self-scoped: o sujeito da query é `req.user.userId` (JWT server-side), não `actorId` declarado pelo cliente. Exigir actionContext era um **contrato falso** — a rota não usa o campo, mas o middleware bloqueava com 400 se ausente.

**Fix cirúrgico:**

```typescript
// Self-scoped: GET /groups/mine deriva sujeito de req.user.userId (JWT server-side).
// actorId não participa da seleção; exigir actionContext seria contrato falso.
// DECISION-0113: actorId de cliente = hint, não autoridade. Auth + tenant permanecem obrigatórios.
if (req.method === 'GET' && rawPath === '/groups/mine') {
  return;
}
```

Restrições mantidas:
- `req.method === 'GET'` — writes não isentos
- `rawPath === '/groups/mine'` — path **exato** (não `endsWith`, não `includes`)
- `req.user` e `req.tenant` ainda obrigatórios (verificados antes do bloco de bypass)
- `/groups/:id` e demais rotas: sem efeito

### R1 — E2E HTTP real reescrito (16→26)

E2E anterior usava SQL/grep/schema sem HTTP. Reescrito com `fastify.inject()` — percorre stack completa (auth+tenant+actionContext+rbac+handler).

**Fail-first evidence:**

Antes do bypass:
```
failfirstprobe.ts → status 400, body: {"statusCode":400,"error":"Bad Request","message":"ActionContext is required"}
```
Após bypass:
```
failfirstprobe.ts → status 200, body: {"groups":[]}
```

## 2. Prova (E2E 26/26)

`validate-pipeline-e2e-groups-mine-auth-derived-user.ts` — reescrito integralmente.

**Stack:** `Fastify + sensible + authPlugin + tenantPlugin + actionContextPlugin + rbacPlugin + groupsModule`

**Fixtures DB reais:**
- Usuários A e B (com `token_version=0`, sem `global_user_id` — nullable)
- Grupos GA e GB (`owner_actor_id` = ator pré-existente do dev DB)
- Memberships: A→GA, B→GB
- Cleanup: `group_members → groups → users` (ordem FK reversa)

**A comportamental HTTP:**
- A1 A sem actionContext → 200
- A2 A vê grupo GA (membro)
- A3 A NÃO vê grupo GB (não-membro)
- A4 B sem actionContext → 200
- A5 B vê grupo GB (membro)
- A6 B NÃO vê grupo GA (não-membro)
- A7 A com actionContext malicioso (`actorId`=spoofB) → 200
- A8 spoof não muda resultado: A ainda vê GA
- A9 spoof não muda resultado: A ainda NÃO vê GB
- A10 B com actionContext de A → ainda vê GB (não GA)
- A11 sem autenticação → 401
- A12 contrato `{ groups: [...] }` presente nas respostas 200
- A13 GET não cria `group_members`, `groups` nem `actors`

**B estrutural (código-fonte):**
- B1 handler usa `req.user?.userId` (JWT server-side)
- B2 handler NÃO usa `req.actionContext.actorId` como userId
- B3 guard 401 fail-closed para `userId` ausente
- B4 repository `getUserGroups` usa `gm.user_id = $2`
- B5 bypass em `action-context.plugin` exato: `rawPath === "/groups/mine"`
- B6 bypass requer `method === "GET"` (writes não são isentos)
- B7 bypass NÃO usa `endsWith` nem `includes` (path exato)
- B8 `/social/actors/available` bypass permanece intacto
- B9 GET `/groups/mine` NÃO chama `ensureUserActor` nem `getActiveActor`
- B10 GET `/groups/mine` é read-only: sem INSERT/UPDATE no handler

**C schema DB:**
- C1 `group_members.user_id` existe (FK→`users.user_id`)
- C2 `group_members` NÃO tem `actor_id` (user_id é a FK correta)

**D cleanup:**
- D1 cleanup: zero fixtures residuais

## 3. Gates

| Gate | Resultado |
|------|-----------|
| `tsc --noEmit` | OK — 2 erros pré-existentes em `geo-enrichment.service.ts`, não introduzidos |
| `validate:architecture:strict` | OK — `critical_new=0` |
| `validate:system-state:strict` | OK — PASS |
| `validate:regression-guards` | OK — GATE OK (financial-regression + sql-regression-lint + migration-numbering) |
| `validate:actor-writer-boundaries` | OK — GATE OK [actor-writer §4.8.1] |
| `validate:bank-ledger-boundaries` | OK — GATE OK [bank-ledger §4.6] |
| E2E HTTP `groups-mine-auth-derived-user` | **26/26** |

## 4. Artefatos criados/alterados

- **Modificado:** `backend/src/plugins/action-context.plugin.ts` (bypass adicionado)
- **Modificado:** `backend/src/scripts/validate-pipeline-e2e-groups-mine-auth-derived-user.ts` (reescrito 16→26 HTTP)
- **Deletado:** `backend/src/scripts/failfirstprobe.ts` (temporário, evidência capturada)
- **Topo:** `STATUS_EXECUCAO_GLOBAL.md`
- **Append:** `opus.md` (sessão cont.158)
- **Novo:** este execution log

## 5. Escopo intocado / STOPs

Service/repository/schema de groups intocados. Frontend intocado. Rotas `/groups/:id` e demais intocadas. Writes intocados. Zero migration/banco/Bank/ledger/wallet/payout/split/settlement/PJ/agenda/gender/D3. DECISION-0113 NÃO declarada fechada. DECISION-0116 não alterada. Suppliers/contacts/inventory/PO/escrow/finance-agenda/daily-metrics não tocados. C1/tenant compartilhado NÃO liberado. R2 NÃO liberado. FASE 6 NÃO liberada.

## 6. Próximo passo

HOLD — aguardando reseal da Yala.
