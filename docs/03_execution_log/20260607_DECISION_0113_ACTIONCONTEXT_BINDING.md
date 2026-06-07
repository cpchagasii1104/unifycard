# Execução — D-ACTIONCONTEXT-ACTORID-OWNERSHIP-BINDING (DECISION-0113) — docs-only

**Data:** 2026-06-07 · **Modo:** CARTÓRIO INSTITUCIONAL (docs-only) · **Branch:** `rescue-structural`
**HEAD de origem:** `8db09ceb` · **Decisor:** Clayton (Opção 3 híbrida) · **Esteira:** eu (escritora); Clayton promulga.

## Objetivo
Promulgar a DECISION que resolve o gap de autoridade do `actionContext.actorId` (auditado em `F-ACTIONCONTEXT-ACTORID-OWNERSHIP-AUDIT`), emendar os contratos vigentes que mandavam o design spoofável, e persistir o inventário da auditoria — **sem escrever código** (o fix exige a norma primeiro).

## READ-FIRST (confirmado)
- Numeração: próxima DECISION = **0113** (0112 era a última).
- Contratos vigentes (LEI DO SISTEMA, fev/2026): `docs/06_technical/authority/ACTIONCONTEXT_CONTRACT.md` (§4 proíbe inferir de `req.user`; §6.2 handlers não acessam `req.user`; §6.3 RBAC não referencia `req.user`) e `RBAC_V2_CONTRACT.md` (§4 entradas fechadas sem `req.user`; §7.1 proíbe `req.user.*`; §11 conformidade = nunca acessa `req.user`). **O contrato MANDA o design spoofável** — a raiz é normativa.
- Primitivo correto já existe: `require-permission.guard.ts → canPerformAction → canActAs(tenantId, req.user.id, actorId)`; `kyb-document-submit.service.ts` (ensureUserActor+canManageCompany).

## Implementação (docs-only)
1. **`DECISION_0113_ACTIONCONTEXT_ACTORID_OWNERSHIP_BINDING.md`** (novo) — Opção 3 híbrida; D1–D9; emenda dos contratos (§4); sequência de remediação governada (§5); bloqueios (§6); DTs (§7).
2. **Emenda dos contratos** (banner `## 0. EMENDA — DECISION-0113`, texto histórico preservado):
   - `ACTIONCONTEXT_CONTRACT.md` — supera §3.1/§4/§6.2/§6.3 no ponto "declaração basta como autoridade"; mantém "não inferir o actor"; soma "declarar ≠ autorizar".
   - `RBAC_V2_CONTRACT.md` — supera §4/§7.1/§11; RBAC passa a consultar `req.user` para bindar `actorId ∈ canActAs(req.user)` antes de decidir.
3. **`REMEDIATION_DT_LOG.md`** — `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` → GOVERNED/DECIDED (segue OPEN); **inventário da auditoria persistido** (425/63; categorias; amplificador `rbac.plugin`; top-10; já-protegidos; sequência de 6 fatias).
4. **`REMEDIATION_DECISIONS_LOG.md`** — entrada 0113.
5. **STATUS / opus / este log** — atualizados.

## Regra promulgada (núcleo)
`actionContext.actorId` é **hint não-soberano** (declara quem age — intent/source/scope/auditoria). **Autoridade soberana exige `actorId ∈ canActAs(req.user)`** (ownership `actor.user_id===req.user.id` OU delegação ativa), server-side. RBAC deve bindar `req.user`. Precedência: **autoridade > produto**. Binding é `∈ canActAs` (não `actorId==actor-próprio`) → multi-actor legítimo (actor-first) preservado.

## O que NÃO foi feito (escopo)
Zero código/migration/Bank/frontend/middleware-runtime/rbac-plugin-code. Não fecha o DT. Não promulga assinatura/erro-code/e2e de cada fatia (ficam na fatia). Não toca `actor_delegations`/`authorization.service` runtime. dev 365.

## Prova
- 4 gates docs-only OK: `actor-writer` · `bank-ledger` · `regression-guards` (365, numeração única) · `arch --strict` `critical_new=0`/`warning_new=1`=c3.
- Working tree: só os autorais protegidos + `docs/memorias/` untracked; commit `decisions:` com os arquivos docs.

## DTs
- `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` → **GOVERNED/DECIDED**, **OPEN** (remediação por fatias pendente).

## Próximo passo (autorizado-por-norma, espera go)
`F-RBAC-PLUGIN-BIND-REQ-USER` — bindar `req.user` no `rbac.plugin` (amplificador sistêmico; re-segura todas as rotas admin, KYB inclusive). Depois: `company-members`/`organization` gates → money LIVE → money LATENTE → plan/identity/profile-C1/lifestyle → leitura cross-user.
