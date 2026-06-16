# 2026-06-16 — F-AUTHORITY-PERMISSIONS-CLOSURE-BASELINE

Fechamento **documental** (baseline) da família authority/permissões. **DOCS-ONLY** — zero código/migration/
schema/runtime/frontend/financeiro/RBAC. Promulga DECISION-0134 (referral=lookup + matriz de capabilities) e
consolida o estado fechado/open da rodada. **Respeita `07_NOMENCLATURA_CANONICA`** (forma canônica `domain:action`).

## Anchor / Pré-flight

HEAD `957aeb32` · branch `rescue-structural` · superfícies materiais (backend/src, frontend/src, migrations,
scripts) **LIMPAS** · dev 390. STOP não disparado.

## READ-FIRST (Evidence Pack)

Lidos 1ª mão: STATUS · REMEDIATION_DT_LOG · REMEDIATION_DECISIONS_LOG (último = DECISION-0133; 0134 livre) ·
execution logs da rodada (service-order/service-bundle/votes/contextual-thread/organization) ·
**`docs/01_normative/07_NOMENCLATURA_CANONICA.md`** (§3 regra suprema, §4.74 `permission`/`scope`) ·
`backend/src/core/authorization/permission-keys.ts` (mapa canônico vivo `domain:action`).

## Achado normativo decisivo (07)

- 07 §4.74: `scope` técnico = `'read:users'`/`'write:orders'` (colon); `permission` = `'api.read'` (pontilhado,
  ilustrativo) — **mas** o vocabulário **vivo** é uniformemente **`domain:action`** colon snake_case
  (`service_order:confirm`, `financial:view_ledger`, `bundle:create`).
- O GO trouxe a matriz em forma **pontilhada de 3 segmentos** (`admin.panel.view`). Adotá-la criaria **trilho
  paralelo** ao `permission-keys.ts` (07 §3: "um conceito → um nome → uma forma" — proibido). **Decisão:**
  render a matriz inteira na forma canônica `domain:action` (mapeamento determinístico: 1º segmento=domain;
  resto unido por `_`=action). E, por **§3.2**, manter a matriz como **BASELINE** (grafia final + reconciliação
  `finance:`↔`financial:` vão ao `SSOT_REGISTRY→07→RFC` na implementação).

## Decisões consolidadas (DECISION-0134)

1. **Código de indicação = chave humana de lookup de actor** (não authority; não substitui actor_id/
   canRepresentActor; permissão concedida ao actor_id resolvido; fluxo admin resolve→confirma→marca→grava contra
   actor_id). Cargos = templates de capabilities, não fonte primária.
2. **Matriz inicial** (17 domínios, forma `domain:action`) — baseline expansível.
3. **Classes de risco** LOW/MEDIUM/HIGH/CRITICAL; financeiro CRITICAL (checkbox não move dinheiro; Bank/ledger/
   idempotência/locks/3 paralelas).

## Matriz (resumo por domínio — detalhe na DECISION-0134 §3)

admin · products · services · agenda · inventory · purchase_orders/suppliers · pos · cash_drawer · finance ·
cards · customers/customer_credit · events · votes · support · compliance/companies/drivers/platform · reports ·
automation/notifications/integrations/api_keys/webhooks. Todas em `domain:action` canônico.

## Estado fechado / open (DECISION-0134 §5)

- **CLOSED nesta rodada:** service-order WA · service-bundle WA · votes containment · contextual-thread
  containment · organization containment · suppliers/PO owner · contacts containment · 0131-wave seal.
- **OPEN controlado:** votes/contextual-thread/organization (schema/binding/eligibility) · organizers unmounted ·
  human-mvp triagem · containment campaign (reports/automation/agreements/business-audit/system-notifications) ·
  financeiro/payout/split/recovery/confirm-financial-terms · **implementação runtime de grants** · UI de
  permissões · cargos/templates.

## Provas / escopo negativo

- `git diff` = apenas docs (DECISION-0134 + decisions log + STATUS + este log). **ZERO** `.ts`/`.tsx`/`.sql`/
  `.mjs`/`.ps1`/migration/backend-src/frontend.
- Gate: `node scripts/validate-architectural-patterns.mjs --strict` → critical_new=0.
- NÃO tocado: código/runtime/migration/schema · ativação votes/contextual-thread/organization · organizers ·
  human-mvp · grants/RBAC/FASE 6/RLS · código de indicação · financeiro/Bank/ledger · frontend.

## Estado

**CLOSED (docs-only baseline).** Fecha SÓ como **F-AUTHORITY-PERMISSIONS-CLOSURE-BASELINE**: DECISION-0134
promulgada (referral=lookup + matriz de capabilities em forma canônica `domain:action` conforme 07 + risco +
estado fechado/open); implementação runtime de grants registrada como nova frente futura; nada material tocado.
dev 390.
