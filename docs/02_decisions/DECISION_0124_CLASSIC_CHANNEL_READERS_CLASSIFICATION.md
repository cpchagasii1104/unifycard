# DECISION-0124 — Classificação A-E dos classic readers params/query.actorId (DECISION-0113)

**Status:** PROMULGADA (parcial) · **Data:** 2026-06-13 · **Branch:** `rescue-structural` · **Frente:** F-0113-CLASSIC-CHANNEL-READERS-BINDING

**Precedência:** DECISION-0113 (actorId client-declared = HINT, nunca autoridade) · CORE_ESTORNOS/LEI §4.6 (fronteira financeira) · LEI §4.9 (authority via canRepresentActor/permissão).

## Contexto

Os 9 readers baselineados no guard `audit-actor-authority-boundary.mjs` por `params/query.actorId`
foram classificados na matriz A-E. Achado central: **NEM todo actorId em params/query é violação** — em
rotas admin/financeiro o actorId é **filtro autorizado por permissão cross-actor** (o operador já vê tudo);
bindar `canRepresentActor` por cima **quebraria** o operador legítimo. As violações reais são as ESCRITAS
self/representado sem binding.

## Decisão (por arquivo)

### FECHADOS — binding `canRepresentActor` adicionado (self/representado) → REMOVIDOS do baseline
- **public-profiles** (B): writes `POST/PATCH/POST :id/visibility` (que usavam `actionContext.actorId`
  sem binding) agora exigem `canRepresentActor(req.user.userId, actorId)` fail-closed; lista pública
  `GET /public-profiles` força `visibility='PUBLIC'` server-side (cliente não pode pedir PRIVATE).
- **marketplace-categories** (A/B): `POST /import` substitui o check self-only
  (`actor.actor_id !== actorId`) por `canRepresentActor` (permite pages representadas, bloqueia alheio);
  GET = catálogo público (actorId = filtro de recurso público).

### BASELINEADOS COM JUSTIFICATIVA (não maquiagem) — classe D/C
- **reporting** (D): `financial:view_all_ledger` = autoridade **CROSS-ACTOR por design** (admin vê tudo);
  actorId é filtro autorizado, NÃO spoof. Bindar quebraria o admin. **F-OK justificado.**
- **payout** (D): FINANCIAL **HARD STOP**. `requirePermission('financial:execute_payout')`; actorId é
  filtro do operador; writers de payout não tocar.
- **bank-http** (D): **BANK domain HARD STOP**. `GET /balance` já tem autoridade via
  `actorCapabilitiesService.resolveForUser` (não reconhecida pelo guard); writers de transação são Bank.
- **business-audit** (D): `requirePermission('admin:view_audit_logs')`; actorId é filtro de admin de
  auditoria — escopo cross-actor vs self é **decisão de produto** (DECISION_REQUIRED).
- **policy** (D): `requirePolicyPermission` (admin); binding per-actor = **R2 fine-grained permission**
  (DECISION_REQUIRED).
- **trust** (D): `requireRole(['admin'])` **INTERINO** (DECISION-0113, pendente R2.4) que aciona
  `assertActorRepresentActor` no rbac.plugin. Manter interino (DECISION_REQUIRED).
- **risk-dashboard** (D): **RESÍDUO PRIORITÁRIO** — `requireRiskPermission` chama
  `requirePermission(tenantId, actorId, actorId, 'financial:view_all_ledger')` usando o **actorId
  client-declarado como userId** (spoofável). O fix correto é **corrigir o modelo de permissão**
  (passar `req.user.userId`), o que é decisão de arquitetura/R2 — **NÃO bindar por cima**
  (DECISION_REQUIRED, prioridade).

## Hard stops respeitados

Zero Bank/ledger/transactions/reversal/payout writer; sem migration; sem RBAC V2; sem inventar política
de quem-vê-o-quê em admin/financeiro (DECISION_REQUIRED registrada); `requireRole/requirePermission` não
promovidos a soberanos. Não se transformou recurso público em privado nem vazou privado em rota pública.

## Prova

e2e `validate-pipeline-e2e-classic-channel-readers-binding` (DB efêmera, **9/9**): canRepresentActor truth;
T2 POST /public-profiles não-representante → 403; T3 representante passa; writes bindados + lista PUBLIC;
marketplace /import bindado; baseline 9→7 (2 removidos, 7 justificados); Bank intocado; contenções/bindings
anteriores intactos. Guard 0113 **new=0 stale=0** + prova negativa OK. Gates verdes; tsc 25; sem migration.

## Estado

DT-0113-CLASSIC-CHANNEL-READERS: **PARTIAL** (2 fechados; baseline 7 justificado, dos quais 5 DECISION_REQUIRED
+ 2 HARD-STOP financeiros). Eliminação dos 7 exige decisão de produto/R2 (permission model) — fora desta frente.
