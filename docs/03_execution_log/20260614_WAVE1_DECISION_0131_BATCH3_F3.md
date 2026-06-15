# 2026-06-15 — PRIMEIRA ONDA INDEPENDENTE (DECISION-0131) · BATCH 3 (F3 — ROLE-AS-AUTHORITY CONTAINMENT)

Pós-PASS Yala de WAVE-1 BATCH-2 (commit `fd568e70`). **F3** — `actor_has_any_role`/`userHasAnyRole` está **LIVE**
lendo `user_roles` como autoridade (não é tombstone). AUTHORITY_LAW Art.17 / DECISION-0131. A frente revelou-se
**grande** (entrelaçada com o preHandler RBAC-V2) → escape do GO: **READ-FIRST + classificação + guard de bloqueio +
DTs**, sem refactor amplo. Parent `fd568e70` · branch `rescue-structural` · dev **385/385** (sem migration).

## READ-FIRST — classificação de 1ª mão dos 9 callers (8 + 1 morto)

`userHasAnyRole(tenantId,userId,roleNames)` (rbac.service.ts:373) = `SELECT EXISTS(... user_roles ur JOIN roles r ...)`
→ lê `user_roles` (RBAC legado) como autoridade. `actorHasAnyRole` = primitivo V2 (rbac.plugin → `actor_has_any_role`).

| Caller | Rota/op | Sole gate? | Primitivo canônico | Classe |
| --- | --- | --- | --- | --- |
| `modules/social/social-work.routes.ts:40` | POST create-job (W) | NÃO | post owner (`globalUserId`) | **ADAPTER_TRANSITIONAL** |
| `modules/events/event-lifecycle.routes.ts:55` | POST tickets/checkin/consumption (W, money-adj) | NÃO | event owner / company-admin | **ADAPTER_TRANSITIONAL** |
| `modules/work/work-insights.routes.ts:27` | GET insights (R) | NÃO | self (`userId===current`) | **ADAPTER_TRANSITIONAL** |
| `modules/work-instant/worker-status.routes.ts:253` | GET presence (R) | NÃO | self | **ADAPTER_TRANSITIONAL** |
| `modules/social/social-work-payment.routes.ts:175` | **GET payments (R, MONEY)** | **SIM** | — | **DIVERGENT-MONEY** |
| `modules/social/social-work-apply.routes.ts:142` | GET applicants (R) | SIM | — | **DIVERGENT** |
| `modules/social/social-work-schedule.routes.ts:168` | GET schedules (R) | SIM | — | **DIVERGENT** |
| `core/categories/categories.service.ts:197` | createCategory(active) (W, config) | SIM | — | **DIVERGENT-CONFIG** |
| `services/events/event-lifecycle.routes.ts:55` | — | — | — | **DEAD** (não registrado) |

## Por que NÃO corrigi os DIVERGENT agora (escape do GO; sem refactor amplo)

As 3 rotas social-work têm **preHandler `requirePermission([...])` que é ELE PRÓPRIO role-based** (rbac.plugin →
`actorHasAnyRole` → `actor_has_any_role` → `user_roles`). Logo o **post-owner (primitivo canônico) seria barrado pelo
preHandler ANTES** do check inline — deixar o owner passar exige **mexer no preHandler RBAC-V2**, proibido neste batch
(não ativar/alterar RBAC, sem refactor amplo, STOP do GO). `categories` não tem primitivo canônico (autoridade de
taxonomia institucional inexiste). Improvisar seria pior. ⇒ **CONTER + CLASSIFICAR + DT**, correção = sub-frentes.

## Patch (contenção, não correção de autoridade)

- **Guard NOVO** `audit-role-as-authority-containment.mjs` (no `validate:regression-guards`): registro de classificação
  dos 8 callers; **FALHA em qualquer caller NOVO não classificado** de `userHasAnyRole`/`actorHasAnyRole` (bloqueio de
  regressão Art.17); FALHA se a duplicata morta reaparecer. _(O lock do stub `actor_has_permission=RETURN FALSE` segue
  em `audit-rbac-stub-and-tombstones` — F1.)_
- **REMOVIDO** `src/services/events/event-lifecycle.routes.ts` (duplicata morta, não importada/registrada).
- **DT** `DT-ROLE-AS-AUTHORITY-DIVERGENT` (4 callers DIVERGENT, money flagado) + sub-frentes de convergência
  (F-RBAC-V2-PERMISSION-OWNERSHIP · correção social-work · F-CATEGORIES-TAXONOMY-AUTHORITY).

## Provas (tripé — sem e2e: nenhuma autoridade de caller foi TOCADA)

- **Guard** `audit-role-as-authority-containment.mjs`: GATE OK (8 callers classificados; 4 DIVERGENT em DT; dead dup removida).
- **Negative-proof** `negative-proof-role-as-authority-containment.ps1`: novo caller `userHasAnyRole`/`actorHasAnyRole`
  não classificado → guard FALHA nos 2; restauração **byte-idêntica** (SHA256).
- **Sem e2e:** o batch NÃO altera a autoridade de nenhum caller (só remove arquivo morto + adiciona guard de regressão);
  a prova de comportamento das correções vem nas sub-frentes (com e2e de spoof) quando o RBAC-V2 for desemaranhado.

| Prova | Resultado |
| --- | --- |
| role-as-authority-containment guard | GATE OK |
| negative-proof | 2 mordidas; byte-idêntico |
| actor-writer §4.8 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain) | rc=0 (0113 baseline=0; +1 guard) |
| arch --strict | `critical_new=0` |
| tsc | build **25** · strict **43** (baseline herdado; ZERO atribuível; remoção do morto não alterou contagem) |

## Hard stops respeitados

NÃO ativou FASE 6 · NÃO trocou `actor_has_permission` RETURN FALSE · NÃO seedou RBAC · sem cargo_templates · sem mapper ·
sem RLS · sem `financial_approval_*` · sem Bank · sem cartão · NÃO tocou C4/B3f/A1/E1/E2/B1f · sem refactor amplo. Nenhuma
autoridade de caller alterada (correção = sub-frente). dev 385/385.

## Sub-frentes reportadas (correção dos DIVERGENT)

1. **F-RBAC-V2-PERMISSION-OWNERSHIP** — desemaranhar `requirePermission` p/ admitir ownership (post-owner) antes/junto do role.
2. Correção social-work apply/payment/schedule → `post-owner OR admin` (padrão `validatePostAccess`) — **depende de (1)**.
3. **F-CATEGORIES-TAXONOMY-AUTHORITY** — decidir primitivo de autoridade de taxonomia institucional p/ `createCategory(active)`.

## Correção do FAIL Yala (2026-06-15) — reclassificação CANONICAL → ADAPTER_TRANSITIONAL

Yala deu FAIL num ponto estreito: os 4 callers rotulados CANONICAL têm fluxo `primitivo canônico OR
userHasAnyRole(['admin','owner'])` — role ainda é **caminho de autoridade secundária**, logo **não são CANÔNICOS
definitivos**. Correção (cartorial/guard, **zero mudança de runtime**):
- **Antes → Depois:** social-work create-job · event-lifecycle · work-insights · worker-status: **CANONICAL →
  ADAPTER_TRANSITIONAL** (no guard `audit-role-as-authority-containment.mjs` e neste log). Guard agora reporta
  `0 CANONICAL puro + 4 ADAPTER_TRANSITIONAL + 4 DIVERGENT`.
- **Legenda corrigida no guard:** CANÔNICO = decisão NÃO depende de role · ADAPTADOR_TRANSITÓRIO = primitivo canônico
  primário + fallback/atalho por role · DIVERGENT = role decide autoridade final/única.
- **DT NOVA** `DT-ROLE-FALLBACK-TRANSITIONAL-ADAPTER` (os 4 adapters: têm primitivo primário, MAS role-fallback →
  convergir p/ capability/ownership material sem role). Os 4 DIVERGENT já registrados **não foram reabertos**.
- **Não declarado corrigido:** F3 (segue contenção), RBAC-V2, social-work-payment. neg-proof segue mordendo caller
  novo. Gates: regression rc=0 · actor-writer/bank-ledger OK · arch critical_new=0 · tsc build 25/strict 43 (inalterado).

## Estado

WAVE-1 BATCH-3 (F3) **IMPLEMENTED / HOLD PARA RESEAL** como **F3-CONTAINMENT / CLASSIFICATION / REGRESSION-LOCK**
(NÃO "F3 corrigido"). Uso vivo de role-como-autoridade CONTIDO + CLASSIFICADO (8 callers; **0 CANONICAL puro · 4
ADAPTER_TRANSITIONAL · 4 DIVERGENT**, todos em DT de convergência); novos usos bloqueados; duplicata morta removida;
stub RBAC segue travado. Correções = sub-frentes próprias (RBAC-V2 ownership / social-work / categories taxonomy /
remoção de role-fallback). dev 385; baseline 0113=0; Bank/Core intocados; zero mudança de runtime.
