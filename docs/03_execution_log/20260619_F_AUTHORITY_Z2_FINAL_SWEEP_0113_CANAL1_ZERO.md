# 2026-06-19 — FECHAMENTO SOBERANO: DECISION-0113 CANAL-1 BASELINE ZERO (docs-only)

Registro do **fechamento soberano, docs-only**, do parent canal-1 após **sweep final READ-ONLY = PASS_WITH_WARNINGS**
no HEAD `0e1ba2e9`. Este ato fecha o **baseline canal-1** da DECISION-0113. **NÃO corrige resíduos financeiros/
produto, NÃO reabre trilhos contidos, NÃO executa runtime, NÃO altera código/detector.**

## Anchor

HEAD `0e1ba2e9` · branch `rescue-structural` · dev 394 · migrations 394/394 · working tree material limpo.

## Sweep final READ-ONLY (confirmações)

- actor-writer-boundaries: **OK** · bank-ledger-boundaries: **OK**
- regression-guards: **71 GATE OK / 0 FAIL** · arch `--strict`: **critical_new=0** (warning_new=4 pré-existente)
- tsc: **43** (baseline) · check:migrations: **394/394**
- **Detector live `audit-actor-authority-boundary.mjs`:** flagged **0** · baseline **0** · new **0** ·
  stale_baseline **0** · safe_subject_recognized **7** · service_bound_recognized **4** · self_bound_recognized **1**
  · not_authority_recognized **1** · canal1_bound_by_requirePermission **0**.

**Conclusão do sweep:** nenhuma entrada C1 restante; baseline DT-0113-CANAL1 materialmente **VAZIO**. Zero **honesto**
por mistura de **BOUND + CONTAINED** — sem remoção cega, sem recognizer amplo mascarando violação. O detector
re-flagga qualquer regressão (cada saída tem guard dedicado + negative-proof).

## Interpretação do fechamento (não-maquiagem)

O risco estrutural **"`actionContext.actorId` client-declared como autoridade nua"** foi DRENADO do baseline canal-1:
- **Onde havia rota viva com ownership claro → BOUND** (req.user / canRepresentActor / canActAs / subject
  server-side / global_user_id).
- **Onde havia trilho ghost, money-deferred ou reactivation-trap → CONTAINED** (hard-stop 403/501 nomeado + guard).

O fechamento da DT-mãe **NÃO reabilita** trilhos contidos e **NÃO resolve** decisões financeiras/produto residuais.

## Frentes R7/R8 seladas (todas sem HOLD YALA pendente; YALA PASS_WITH_WARNINGS MATERIAL)

R7b acceptQuote containment · R8A social legacy · R8B profile-c1 · R8C system-notification · R8D
social-marketplace-ref · R8E remaining triage · R8F non-money canal1 · R8G non-money/read not-authority · R8H AP/AR
containment · R8I money stale reconcile · R8J services-discovery direct-pay containment · R8K organizers billing +
store-onboarding · R8L business-authorization read-sensitive · R8N automation + human-mvp · R8O organizers authority
· R8P services-discovery non-money · R8Q unifycard-method containment.

## Estado final registrado

- `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE` → **CLOSED / YALA PASS_WITH_WARNINGS MATERIAL / BASELINE ZERO**
  (baseline 0).
- `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` (DT-mãe 0113) → **CLOSED_WITH_CONTAINED_RESIDUALS / YALA
  PASS_WITH_WARNINGS MATERIAL**. Ressalva obrigatória: fechada **quanto ao canal-1/actionContext.actorId ownership
  baseline**; o fechamento NÃO significa que todos os trilhos foram remediados — parte drenou por **BOUND**, parte
  por **CONTAINED**; trilhos schema-ghost, money-deferred e produto permanecem como **DTs/DECISIONs próprias OPEN**.

## Warnings do sweep (não-bloqueantes)

- **W1** — negative-proofs não reexecutados no sweep final (mutáveis); validados nos reseals de cada frente +
  declarados pela executora (pwsh 7 & WPS 5.1).
- **W2** — working tree sujo fora do material (docs/memorias/untracked) → não é HOLD_WORKTREE_DIRTY.
- **W3** — `business-audit`, `policy-engine`, `risk-command-center` são `safeSubjectProof` **Forma C** reconhecidos
  pelo detector (company-scoped, re-flagáveis), mas ainda **sem guard dedicado separado** → higiene futura
  não-bloqueante (`DT-AUTHORITY-SAFE-SUBJECT-FORM-C-DEDICATED-GUARDS` OPEN / HYGIENE).
- **W4** — **baseline 0 NÃO encerra resíduos financeiros/produto.**

## Resíduos próprios — PERMANECEM OPEN (não apagados)

`DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION` (OPEN / DECISION REQUIRED) · `DECISION-0110` (OPEN) · `DECISION-0114 D5`
(OPEN) · organizer billing SaaS-vs-split (OPEN) · event_settlements ghost (OPEN) · CRM AR read (OPEN) · automation
worker (OPEN) · human-mvp/G10 reativação (OPEN) · schema-ghost reactivation fronts (OPEN) ·
`DT-AUTHORITY-SAFE-SUBJECT-FORM-C-DEDICATED-GUARDS` (OPEN / HYGIENE).

## Escopo negativo

NÃO editou código/scripts/detector/package.json · NÃO criou migration · NÃO executou money/Bank/ledger · NÃO
corrigiu fee · NÃO removeu /100 · NÃO criou bps · NÃO materializou schema · NÃO reabriu trilhos contidos · NÃO
apagou resíduos · NÃO declarou "tudo resolvido". Docs-only; HEAD material permanece `0e1ba2e9`.

## Próxima frente recomendada

O canal-1 está fechado; a próxima prioridade é decisão-dependente (não executora-autônoma): a frente financeira
`DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION` (unidade de fee bps, IA-DINHEIRO/Clayton) e/ou a higiene
`DT-AUTHORITY-SAFE-SUBJECT-FORM-C-DEDICATED-GUARDS` (guards dedicados Forma C). As demais DECISIONs (0110/0114 D5)
e trilhos ghost/produto seguem como frentes próprias quando priorizadas.
