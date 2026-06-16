# 2026-06-16 — F-CALENDAR-OPERATOR-GRANT-AUTHORITY-RFC

RFC **docs-only** de produto/autoridade: owner pode delegar operação de agenda a outro actor por grant explícito,
sem cargo rígido. Promulga DECISION-0138 + a composição técnica mínima do futuro Slice 1C. **NÃO implementa
enforcement.** Fecha a dúvida da `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` como baseline.

## Anchor / Pré-flight

HEAD `6e74deb9` · branch `rescue-structural` · superfícies materiais (backend/src, frontend/src, migrations,
scripts, `permission-keys.ts`, `business-permissions.types.ts`, `rbac.types.ts`/`rbac.plugin.ts`, `app.builder.ts`,
availability/calendar) **LIMPAS** · dev 391. STOP não disparado.

## READ-FIRST (Evidence Pack)

Lidos 1ª mão: DECISION-0134/0135/0136/0137 + execution logs 1A/1A1/1B · STATUS · DT_LOG · DECISIONS_LOG ·
`permission-keys.ts` (SSOT) · `actor-capability-grant.{routes,service,repository,types}` (Slice 1A/1B) ·
`unified-availability.routes.ts` (gate selado owner-only) · `authorization.service` (`canRepresentActor`/`canActAs`) ·
`rbac`/`business-permissions` (confirmado: NÃO usados como registry de grant).

## Achado decisivo (mapeamento de rota)

`calendar:block`/`calendar:unblock` aparecem APENAS como **capability key** (`permission-keys.ts` + allowlist do
grant + testes) — **NÃO ligadas a nenhuma rota literal `/block`**. As rotas vivas de agenda são `POST /availability`
(criar — gate selado DECISION-0113 canal-1/0118 D2: "Sem admin escape") e `PUT /availability/weekly-template`, etc.
→ O RFC **exige** que o Slice 1C **mapeie de 1ª mão** quais rotas reais correspondem às capabilities **antes** de
plugar enforcement (composição aditiva sobre o gate selado, sem removê-lo).

## Decisões (DECISION-0138)

1. Operador de agenda existe (owner delega por grant explícito; sem cargo rígido). 2. Sem cargos rígidos agora
(granular por actor × capability × scope). 3. Templates/cargos = fase futura (não bloqueiam). 4. Código/slug =
lookup, NÃO authority (proibido referral_code/slug/actorId-de-body como authority). 5. Composição fail-closed do
1C (A owner/self · B canRepresentActor(scope) · C grant ativo com grantee server-side/scope/capability/status/
janela/tenant). 6. Grant ADITIVO (não remove owner; não concede direito de conceder). 7. Capacidades iniciais
calendar:block/unblock (sujeito ao mapeamento §4). 8. Scope: não confundir agenda pessoal × empresarial. 9.
Auditoria futura (user/actor/scope/capability/grant/ação). 10. Financeiro FORA (3 paralelas).

## Classificação

| Assunto | Decisão |
| --- | --- |
| operador de agenda | owner delega por grant explícito (sem cargo) |
| código/slug | lookup, não authority |
| grant | autoridade delegada granular, aditiva |
| owner/canRepresentActor | preservados (A/B); grant = 3ª via (C) |
| rota de agenda | owner-only no código; mapear rota real antes do 1C |
| financeiro | CRITICAL / fora / 3 paralelas |
| cargos/templates | fase futura |
| auditoria/evento | registrar no enforcement futuro |

## Pendências / bloqueios

- **Slice 1C NÃO nasce neste RFC** (só após Yala PASS desta decisão). Pré-condições: mapear rotas reais +
  composição fail-closed aditiva + guard/neg-proof/e2e + auditoria.
- `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` → **IMPLEMENTED_AS_PRODUCT_AUTHORITY_BASELINE / HOLD YALA**.
- `DT-PERMISSION-TRI-REGISTRY-RECONCILIATION` = CLOSED_AS_RFC_BASELINE (DECISION-0137).

## Provas / escopo negativo / gates

- `git diff` = **5 .md** (DECISION-0138 + este log + STATUS + REMEDIATION_DECISIONS_LOG + REMEDIATION_DT_LOG).
  **ZERO** `.ts`/`.sql`/`.mjs`/`.ps1`/migration/backend-src/frontend.
- Gate: `node scripts/validate-architectural-patterns.mjs --strict` → critical_new=0.
- NÃO tocado: código · `permission-keys.ts`/`business-permissions.types.ts`/`rbac` · availability/calendar runtime ·
  `hasCapabilityGrant` em rota · owner-only no código · endpoints/migration/enforcement · frontend · financeiro/`bank_ledger`.

## Estado

**IMPLEMENTED / HOLD YALA.** Fecha SÓ como **F-CALENDAR-OPERATOR-GRANT-AUTHORITY-RFC**: decisão de produto
(delegação flexível de agenda por grant) + composição fail-closed do Slice 1C promulgadas; código/slug ≠ authority;
`actor_id` é a base material; grant = autoridade delegada granular aditiva; Slice 1C NÃO implementado; financeiro
fora. `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` → IMPLEMENTED_AS_PRODUCT_AUTHORITY_BASELINE / HOLD YALA. dev 391.
**Aguarda reseal Yala.**
