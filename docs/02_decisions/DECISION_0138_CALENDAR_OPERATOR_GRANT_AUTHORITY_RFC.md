# DECISION-0138 — Operador de agenda por grant explícito (RFC de produto/autoridade)

**Status:** **PROMULGADA / NORMATIVA (RFC docs-only) — ✅ CLOSED / YALA PASS** (reseal Yala adversarial READ-ONLY sobre commit `0532232d` = PASS, 2026-06-16; `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` → CLOSED_AS_PRODUCT_AUTHORITY_BASELINE / YALA PASS). Histórico: IMPLEMENTED / HOLD YALA → **ZERO** código, migration,
schema, runtime, endpoint, enforcement, frontend, financeiro. Promulga a **decisão de produto** (owner delega
operação de agenda a outro actor por grant explícito, sem cargo rígido) + a **composição técnica mínima** do
futuro Slice 1C. **NÃO implementa enforcement** — availability/calendar permanece **owner-only** no código.
Fecha a dúvida da `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` como **baseline** (IMPLEMENTED_AS_PRODUCT_AUTHORITY_BASELINE;
CLOSED só no seal pós-Yala PASS).

**Data:** 2026-06-16 · **Branch:** `rescue-structural` · **HEAD:** `6e74deb9` · **dev:** 391 (sem migration) ·
**Tipo:** arquitetural / autoridade / produto / RFC · **Frente:** F-CALENDAR-OPERATOR-GRANT-AUTHORITY-RFC ·
**Responsável:** Clayton / IA Diretora (executor: Claude) · **Validação prévia:** Clayton (decisão de produto).

**Deriva de:** **DECISION-0134** (referral=lookup) · **DECISION-0135** (keys) · **DECISION-0136**
(`actor_capability_grants`) · **DECISION-0137** (tri-registry; `permission-keys.ts`=SSOT) ·
**DECISION-0113**/**DECISION-0118** (gate selado owner-only de availability) · `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION`.

---

## §1 — Decisão Clayton (produto)

O **owner** (ou representante legítimo do `scope_actor`) **pode delegar operação de agenda a outro actor confiável**
por **grant explícito** — ex.: secretária, cônjuge, primo, funcionário, parceiro operacional, ou qualquer pessoa
definida pelo owner. **Sem modelo rígido de cargos agora**: a autoridade é **granular por `actor` + `capability` +
`scope_actor`**, não por cargo fixo. Cargos/templates por tipo de actor (banda, artista, empresa alimentícia,
empresa de serviços, profissional liberal, etc.) ficam para **fase futura** e **não bloqueiam** o modelo atual.

## §2 — Código/slug é lookup, NÃO autoridade

O código/slug/localizador humano serve para **encontrar/acoplar** o actor — **NÃO** é autoridade por si só;
**NÃO** substitui `actor_id`, `grant`, nem `canRepresentActor`. **Proibido** explicitamente: `users.referral_code`
(comercial) como authority; `slug` como token de permissão; `actorId` de body/header/query como prova de autoridade.
A **autoridade real nasce** quando um representante legítimo do `scope_actor` **concede um grant explícito contra
`actor_id`** (DECISION-0136 / Slice 1B `POST /authority/grants`, gated por `canRepresentActor(scope)`).

## §3 — Composição fail-closed da rota (Slice 1C futuro)

O enforcement futuro de uma rota de agenda só executa se **uma** destas condições passar (ordem fail-closed):

- **A. owner/self authority canônica** (o caller representa o próprio dono do recurso — gate selado atual);
- **B. `canRepresentActor(user_id, scope_actor_id)`** (representa o dono da agenda);
- **C. grant ativo:** o **actor operacional do caller** (`grantee_actor_id`, resolvido **server-side**) possui grant
  com `scope_actor_id` = actor dono da agenda · `capability_key` compatível · `status='active'` · `valid_from`/
  `valid_until` válido · `tenant` correto (via `actorCapabilityGrantService.hasCapabilityGrant`).

**§3.1 — Grant é ADITIVO, não substitutivo:** o grant **não remove** owner authority; **não concede** autoridade
para conceder novos grants; **só permite executar** a capability concedida no `scope` específico.

## §4 — Mapeamento de rota obrigatório antes de materializar

READ-FIRST confirmou: **`calendar:block`/`calendar:unblock` existem como capability key (`permission-keys.ts` +
allowlist do grant) mas NÃO estão ligadas a nenhuma rota literal `/block`.** As rotas vivas de agenda são, p.ex.,
`POST /availability` (criar — gate selado DECISION-0113 canal-1/0118 D2: `actionContext.actorId` = owner +
`canRepresentActor` + "Sem admin escape") e `PUT /availability/weekly-template`. **O Slice 1C DEVE mapear, de 1ª
mão, quais rotas reais correspondem a cada capability** antes de plugar enforcement — não assumir que existe rota
`/block`. A composição §3 entra **aditivamente** sobre o gate selado, sem removê-lo.

## §5 — Scope: agenda pessoal × empresarial (anti-confusão)

O Slice 1C **DEVE identificar corretamente o `scope_actor` dono do recurso**. **Proibido:** operar agenda de outro
actor por acidente; misturar agenda **pessoal** (de `profile`/user-actor) com agenda **empresarial** (page/company
actor); inferir `scope` fora do owner real do recurso (o owner vem de `resolveAvailabilityOwner`, não de actorId
declarado pelo cliente).

## §6 — Auditoria/evento (futuro)

O enforcement futuro deve registrar, quando aplicável: `user_id` · `actor_id` operacional · `scope_actor_id` ·
`capability_key` · `grant_id` (se usado) · rota/ação executada.

## §7 — Capacidades iniciais (alvo provável do 1C)

Primeiro alvo **não-financeiro**: `calendar:block` · `calendar:unblock` (allowlist já registrada no Slice 1A/1B).
Sujeito ao mapeamento de rota da §4.

## §8 — Financeiro FORA

Esta decisão é **só** para agenda/operacional **não-financeiro**. Nada de `financial`/`split`/`payout`/`ledger`/
`bank_ledger`/`payment`/`refund`/`cards`/`cash_drawer`/`customer_credit`. Financeiro continua **CRITICAL** e exige
**3 paralelas READ-ONLY** antes de qualquer material.

---

## §9 — Classificação

| Assunto | Decisão | Efeito agora | Efeito futuro |
| --- | --- | --- | --- |
| Operador de agenda | owner delega por grant explícito; sem cargo rígido | nenhum (docs-only) | Slice 1C: grant aditivo na rota de agenda |
| Código/slug | lookup/acoplamento, NÃO authority | nenhum | resolve actor; authority = grant |
| Grant | autoridade delegada **granular** (actor × capability × scope), aditiva | já materializado (1A/1B), sem enforcement | consumido pela rota (composição §3) |
| Owner / canRepresentActor | autoridade canônica preservada (A/B) | inalterado (owner-only no código) | mantida; grant entra como 3ª via (C) |
| Rota de agenda | owner-only no código; capability calendar:* não-roteada | inalterada | mapear rota real + compor fail-closed (§3/§4) |
| Financeiro | CRITICAL / fora / 3 paralelas | fora | fora deste eixo |
| Cargos/templates | fase futura; não bloqueiam o modelo atual | nenhum | templates por tipo de actor (opcional) |
| Auditoria/evento | registrar user/actor/scope/capability/grant/ação | nenhum | log/evento no enforcement |

---

## §10 — Pendências / bloqueios remanescentes

- **Slice 1C NÃO nasce neste RFC** — só após **Yala PASS** desta decisão.
- Pré-condições do 1C: (a) **mapear rotas reais** das capabilities calendar:* (§4); (b) **composição fail-closed**
  (§3) aditiva sobre o gate selado DECISION-0113/0118; (c) guard/neg-proof/e2e; (d) auditoria (§6).
- `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` → **IMPLEMENTED_AS_PRODUCT_AUTHORITY_BASELINE / HOLD YALA**
  (CLOSED só no seal pós-Yala PASS).
- `DT-PERMISSION-TRI-REGISTRY-RECONCILIATION` = CLOSED_AS_RFC_BASELINE (vocabulário já resolvido por DECISION-0137).

## §11 — Escopo negativo (verificado)

ZERO código · `permission-keys.ts` · `business-permissions.types.ts` · `rbac.types.ts`/`rbac.plugin.ts` ·
`requirePermission` · `actor-capability-grant.*`/endpoints · availability/calendar runtime · `hasCapabilityGrant`
em rota · owner-only no código · migration/endpoint/enforcement · frontend · financeiro/`bank_ledger` ·
votes/organization/contextual-thread · cutover de vocabulários. **Nada material tocado (docs-only).**

## §12 — Referências

`actor_capability_grants` (mig 20260616210000) · `actor-capability-grant.service` (`hasCapabilityGrant`) ·
`unified-availability.routes.ts` (gate selado owner-only) · `resolveAvailabilityOwner` ·
`authorization.service` (`canRepresentActor`/`canActAs`) · `DECISION-0113`/`0118`/`0134`/`0135`/`0136`/`0137` ·
`DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` · `permission-keys.ts` (SSOT).
