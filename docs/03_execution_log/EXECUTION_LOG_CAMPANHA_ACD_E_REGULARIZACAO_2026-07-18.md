# EXECUTION LOG — Campanha A/C/D + Regularização pós-YALA (2026-07-18)

> **DECLARAÇÃO DE TARDIVIDADE (obrigatória):** os registros das Fatias A, C e D abaixo são **TARDIOS** —
> foram escritos **após** a execução material e **após** o relatório independente da YALA, na campanha de
> regularização (R-2). **Não tornam retroativamente válida** a execução anterior: a campanha A/C/D foi
> julgada pela YALA **FORMALMENTE INVÁLIDA COMO EXECUTADA — regularizável** (violação de duplo-modo §4;
> ausência de execution logs §6.2/§7; autosselo da DT de Invoicing). Nenhuma fatia está SELADA. A auditoria
> canônica é `docs/04_audit/YALA_RELATORIO_INDEPENDENTE_CAMPANHA_ACD_2026-07-18.md`.

**HEAD baseline da campanha:** `c06b6f32e` · **HEAD auditado pela YALA:** `693b3d63b` · **MODO da regularização:** EXECUTOR.

---

## Fatia A — Actor Page (contenção do P0, DECISION-0113) — MATERIAL IMPLEMENTADO · AGUARDANDO YALA
- **Objetivo:** eliminar o IDOR do modo `consuming` de `GET /actor-page/:actorId` (viewer confiava em `actionContext.actorId` cru → enumeração de status de conexão/fato de negócio de pares arbitrários).
- **Ações:** viewer derivado server-side (hint só honrado após `canRepresentActor`; senão actor humano canônico via `findByUserId`, read-only; senão null); removido `catch→false` do modo operating (throw de infra → 5xx); fix `ActorRow.actor_id` (era `.id`, sempre undefined no fallback).
- **Arquivos:** `backend/src/modules/actor-page/actor-page.routes.ts`; E2E `backend/src/scripts/validate-pipeline-e2e-actor-page-contract.ts` (vetores L/M/N/O/P adversariais).
- **Commits:** `57786a35b`, `7b6295c59`.
- **Comandos/Resultados:** E2E 19/19 em DB efêmera; guards `audit-actor-authority-boundary` + `audit-actor-page-contract` GATE OK; typecheck (tsconfig.build.json) 0.
- **Limitações (YALA §4 = CONDICIONAL):** a prova E2E depende do perfil efêmero **não versionado** (pré-marcação da migration N1) → prova FULL não reproduzível a partir do repo (ver DT-EPHEMERAL-MIGRATION-PROFILE-UNGOVERNED / R-7). Material correto; falta perfil governado ou prova focal independente para PASS.

## Fatia C — Invoicing (fail-closed fiscal) — MATERIAL PARCIAL IMPLEMENTADO · AGUARDANDO YALA
- **Objetivo:** eliminar o imposto 5% hardcoded (`invoice.service.ts`) e tornar a emissão fail-closed.
- **Ações (campanha original):** removido `Math.round(subtotalCents*0.05)`; `createInvoiceFromPayout` passou a lançar `INVOICE_FISCAL_CONFIG_MISSING` (422). **Defeito achado pela YALA §5 (FAIL):** o 422 vinha DEPOIS de consultar a tabela-fantasma `invoices` → morria em **500** (inalcançável); guard standalone órfão; autosselo da DT.
- **Ações (regularização R-6):** `assertInvoicingSchemaAvailable()` prova `to_regclass('public.invoices')` ANTES de qualquer consulta e recusa fechado com `INVOICE_MODULE_UNAVAILABLE` (503) — em TODAS as 6 superfícies; distinção módulo-indisponível (503) × config-fiscal-ausente (422); resíduo `taxRate/taxesCents` deprecado (não apagado, contract-first); guard reforçado + **integrado ao runner canônico**; E2E novo `validate-pipeline-e2e-invoicing-failclosed` 6/6.
- **Arquivos:** `backend/src/modules/invoicing/invoice.service.ts`, `invoice.types.ts`; `scripts/audit-invoicing-no-hardcoded-tax.mjs`; `scripts/run-regression-guards.mjs`; E2E `validate-pipeline-e2e-invoicing-failclosed.ts`.
- **Commits:** `1b64fa8ba` (original), `d1e869575` (R-6).
- **Limitações:** DT-INVOICING-HARDCODED-TAX-RATE **REABERTA** (R-1); schema-ghost do módulo registrado como dívida separada; não selada.

## Fatia D — Fundo Regional (resolução territorial) — MATERIAL IMPLEMENTADO · AGUARDANDO YALA
- **Objetivo:** resolver o fundo regional pela residência canônica (fim do mono-fundo) e estados territoriais honestos.
- **Ações (campanha):** cadeia `req.user → actor → resolveActorTerritory(ACTOR_RESIDENCE) → city_id → regional_fund_accounts(city) → bank_ledger`; contrato `RegionalFundView` discriminado por `resourceState`; front projeta estados.
- **Ações (regularização):** R-3 catalogou `GET /bank/regional-fund` em `API_CONTRACT_GOVERNANCE §5` + guard de contrato; R-4 corrigiu `RegionalFundCard` (não colapsa ausência em R$ 0,00) + check anti-colapso; R-5 substituiu o resolver paralelo `resolveUserActorId` pelo canônico `findByUserId` (tenant-scoped, ambiguidade fail-closed).
- **Arquivos:** `backend/src/core/unifybank/transparency.service.ts` + `transparency.routes.ts`; `backend/docs/API_CONTRACT_GOVERNANCE.md`; `scripts/audit-regional-fund-contract.mjs`; frontend `api/transparency.ts`, `DashboardHome.tsx(+.css)`, `RegionalFundUser.tsx`, `governance/RegionalFundCard.tsx`; E2E `validate-pipeline-e2e-regional-fund-residence-reader.ts`.
- **Commits:** `8170db60f` (original), `7ba6661f1` (R-3), `3112639a5` (R-4), `30ab8fc5f` (R-5).
- **Comandos/Resultados:** E2E 6/6 (isolamento SP≠Curitiba; Δbank=0); guard regional-fund-contract GATE OK (3 checks); frontend typecheck 0 + vite build OK.
- **Limitações:** fronteira Bank de `transparency.service` (SQL direto a `bank_ledger`) é **pré-existente e sistêmica** → registrada como DT (R-8), não refatorada aqui.

## Campanha de REGULARIZAÇÃO pós-YALA (R-1..R-10) — MODO: EXECUTOR
- **Objetivo:** implementar exatamente as remediações R-1..R-10 do relatório YALA, sem selar o próprio trabalho.
- **Ações e commits:** R-1 cartório (`c550b3522`) · R-3 contrato (`7ba6661f1`) · R-4 frontend (`3112639a5`) · R-5 resolver (`30ab8fc5f`) · R-6 invoicing+guards no runner (`d1e869575`) · R-7/R-8 DTs (`69008d43c`) · R-9 espelho gate + RFC (`a2ea692ac`) · R-2/R-10 encerramento (este commit).
- **R-10 (typecheck):** HEAD sob o compilador oficial `tsconfig.build.json` = **exit 0, 0 erros** (backend) e frontend `tsc --noEmit` = 0 — confirma que a regularização não introduziu regressão de tipos (o baseline HEAD=0 foi registrado pela YALA; os erros vistos sob `tsconfig.json` são test-only, fora do build config).
- **Limitações declaradas:** B-CITY-2 (composição) permanece em STOP; D9.2-B não executado (só espelhado); RFC não promulgado; DTs R-7/R-8 remediadas em frentes próprias; nenhuma fatia SELADA. A próxima execução será nova auditoria independente em MODO GUARDIÃO.

---

**Registro honesto:** este log é a memória obrigatória (§7) que faltava. Sua criação tardia é declarada acima e não sana retroativamente a invalidade de processo — apenas a corrige para frente.
