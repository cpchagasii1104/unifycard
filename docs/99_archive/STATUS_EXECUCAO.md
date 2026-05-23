# Estado da execução — índice (raiz)

> **ESTADO OPERACIONAL DO §GLOBAL BLOCK:** ver `STATUS_EXECUCAO_GLOBAL.md`  
> **REGRA NORMATIVA:** definida em `PLANO_BASE_MODULO.md` (secção §GLOBAL BLOCK).  
> ⚠️ **Estado operacional pode variar por data.** Ver `STATUS_EXECUCAO_GLOBAL.md`.

---

## STATUS EXECUÇÃO — REFATOR ARQUITETURAL (`PLANO_REFATOR_ARQUITETURAL.md`)

**REFATOR ARQUITETURAL — FINAL**

- **FASE S:** OK (validado no ambiente — ver Sessão 3 em `docs/03_execution_log/REFATOR-ARQUITETURAL-20260414.md`)
- **FASES T–7:** SUCCESS
- **BLOCO 2:** SUCCESS (leitores `events` alinhados ao DDL canónico; ver log)
- **CI GUARDS:** PASS (`tsc --noEmit`, `build`, `validate:regression-guards`, `guard:app-builder`)

**STATUS FINAL:** **PASS**

**Plano normativo deste trilho:** `PLANO_REFATOR_ARQUITETURAL.md` (raiz) — veredito **PASS** e backlog residual explícito.

---

**Última atualização:** 2026-04-14 (Sessão 3 — FASE S global + BLOCO 2 + gates; documentos de plano/índice alinhados)

**Fase atual:** **7 concluída** (plano `PLANO_REFATOR_ARQUITETURAL.md` — trilho T→7 executado no repo)

**Resumo:**

| Fase | Status |
|------|--------|
| S | **OK** — `public.events` + `event_financial_execution`; colunas conferidas (ver **Sessão 3** no log; hash parcial `DATABASE_URL`). |
| T | **SUCCESS** — `src/app.builder.ts`; BOOT reexporta; stubs `server-TESTE*` removidos. |
| 0 | **SUCCESS** — logs em `core/events/event.service.ts`. |
| 1 | **SUCCESS** — `events-multi-actor.service.ts` removido; comentário SSOT. |
| 2 | **SUCCESS** — settlement via `bankTransactionService.markExternallySettledByReference`. |
| 3 | **SUCCESS** — comentário `marketplace-event-bus.ts`. |
| 4 | **SUCCESS** — checkout ticket/consumption → `modules/events/checkout-*`; lifecycle movido. |
| 5 | **SUCCESS** — auditoria Marketplace Orders (sem código). |
| 6 | **SUCCESS** — `devLog` removido. |
| 7 | **PASS** — `tsc`, `build`, `validate:regression-guards`, `guard:app-builder`. |
| BLOCO 2 | **SUCCESS** — leitores/resolver `events` canónicos (ver plano e log **Sessão 3**). |

**Bloqueios:**

- Nenhum **no código** deste trilho. **Infra:** repetir FASE S após migrações em CI, staging e produção.

**Próxima ação (opcional):**

- Backlog residual em `PLANO_REFATOR_ARQUITETURAL.md` (lifecycle/checkout legado/métricas/fixtures) — não condiciona o **PASS** já registado.

**Evidência:** `docs/03_execution_log/REFATOR-ARQUITETURAL-20260414.md` — **Sessões 2–3** (Fases T→7 + FASE S global + BLOCO 2); `PLANO_REFATOR_ARQUITETURAL.md` (veredito **PASS**).

---

## STATUS — MARKETPLACE (trilho governado, Abril 2026)

**Plano oficial (raiz):** `PLANO_MARKETPLACE_REFATOR_ARQUITETURAL.md` — **PASS / ENCERRADO** (2026-04-19).

**Entrada de PASS (2026-04-19):** FASE S OK; BLOCO 1+2+3 concluídos; `validate:actor-writer-boundaries` OK; `validate:bank-ledger-boundaries` OK; `validate:regression-guards` OK; 7 DTs documentadas. Build mantém erros pré-existentes catalogados (DT-05/06/07), sem bloqueio do fechamento do módulo marketplace.

**Registo:** `docs/03_execution_log/MARKETPLACE-PLANO-OFICIAL-20260414.md` + §2 EXECUTION LOG do plano marketplace.

**Bank regional (opt-in, código):** `USE_BANK_REGIONAL_FUND` — `docs/03_execution_log/MARKETPLACE_BANK_REGIONAL_FUND_2026-04-14.md` (piloto staging + GO/NO-GO ledger).

---

## STATUS — ORDERS (trilho governado, Abril 2026)

**Entrada de PASS (2026-04-19):** ORDERS — PASS (2026-04-19). FASE S OK, BLOCO 1+2 limpos, gates OK.

---

## STATUS — SERVICES (trilho governado, Abril 2026)

**Entrada de PASS (2026-04-19):** SERVICES — PASS (2026-04-19). FASE S OK, BLOCO 1+2 limpos, DT-01 backlog SPRINT 68.

---

## STATUS — BANK/PAYMENTS (trilho governado, Abril 2026)

**Entrada de PASS (2026-04-19):** BANK/PAYMENTS — PASS (2026-04-19). Gates OK. Double-entry OK. 3 DTs: escrow bridge pendente, b2b aceito, SELECT * backlog.

---

## STATUS — LOTE 1 Identity + staging (tenant `9bdc…`, Abril 2026)

**PROPOSTA material:** `docs/03_execution_log/PROPOSTA_MATERIAL_LOTE_1_TENANT_9bdc.md` — **pronta para execução em staging** (2026-04-14).

**Desbloqueio documental:** convidante / destinatário em §1 preenchidos com **`system_bootstrap_actor`** / **`pendente_definicao_real`** (bootstrap temporário; substituição obrigatória por real antes de produção — ver nota no topo da PROPOSTA).

**Próximo passo operacional (humano):** executar em **staging** os PASSOs 1–7 da PROPOSTA (convite → user → identity → batch2 → precheck → log); **não** produção sem nova PROPOSTA.

**Gate 0 (infra, 2026-04-17):** até `DATABASE_URL` permitir ligação (**`DB_OK`** — teste Node documentado no runbook), `npm run identity:precheck:a1-a4` **não** produz evidência útil; **A1–A4 ficam indeterminados**. Com PostgreSQL `28P01`, a execução normativa permanece **parada** (sem batches, sem CP-5 material, sem interpretar contagens). Ver `STATUS_EXECUCAO_GLOBAL.md` (secção Gate 0) e `docs/03_execution_log/IDENTITY-PRECHECK-GATE0-2026-04-17.md`.

**Evidência esperada:** colar output em `docs/03_execution_log/IDENTITY-RECONCILE-<DATA>.md` (runbook `EXECUTAR/IDENTITY_RECONCILIATION_RUNBOOK.md`). Após trilho financeiro marketplace com flag: queries em `MARKETPLACE_BANK_REGIONAL_FUND_2026-04-14.md` §5–6.

**Preparação read-only (actores):** `docs/03_execution_log/LOTE_1_PREP_ALTA_2026-04-16.md`

---

**Autoridade deste ficheiro:** `STATUS_EXECUCAO.md` (raiz) é **apenas índice operacional** — **não** define critérios de pronto nem substitui norma ou evidência. **Não** possui autoridade de decisão técnica ou de produto.

- **Critério (SSOT normativo):** `PLANO_FASE_ATUAL.md` (incl. secção **#17** quando aplicável ao catálogo / `canonical_products`).
- **Evidência de execução (trilho Cursor v3 + extensões):** `docs/03_execution_log/` — em particular `2026-EXECUCAO_V3.md`, `PLANO_EXECUCAO_CURSOR_v3.md` e `RIDES_MOBILIDADE_EXECUTION_FINAL_2026-04-13.md` (mobilidade / rides — execução técnica encerrada).
- **Mapa de autoridade financeira (Bank SSOT, leituras + callers `transfer`):** `AUTHORITY_MAP_FINANCIAL_v1.md` (raiz do repo) — Fase **-1** de contenção (stub economy ledger) **executada** no código; inventário **§8.4**; testes + CI **§8.3**; registo detalhado **§13**.
- **Auditoria Sessão 1 (escritas / bypass bank vs. camada canónica):** `PLANO_BANK_LEDGER_WRITER_ENFORCEMENT.md` (raiz) — evidência grep 2026-04-14; **§12** do mapa financeiro aponta para este plano.
- **Gate Sessão 3 (INSERT/UPDATE `bank_ledger` / `bank_transactions` só em `modules/bank`):** `pnpm --dir backend run validate:bank-ledger-boundaries` + passo em `.github/workflows/backend-ci.yml` (WARN `amount_cents` / `pool.query` fora do módulo bank não bloqueia). **Escrow unificado ao bank (proposta executável):** `PROPOSTA_ESCROW_UNIFICATION.md` (política alvo Caminho A + fases); índice `PLANO_BANK_LEDGER_WRITER_ENFORCEMENT.md`.
- **Plano eventos / state machine (execução Cursor, Abril 2026):** `PLANO_PARA_CURSOR.md` (raiz) — **EXECUTION LOG** (incl. evidência final **23:20Z**), **EXECUTION EVIDENCE SUMMARY**, **CONCURRENCY NOTE**, **RESULTADO FINAL: PASS**; ficheiros de captura em `docs/03_execution_log/EVIDENCE_*_2026-04-14.txt`; secção dedicada abaixo (**Domínio eventos**).

**Regra de conflito:** qualquer divergência entre este índice e os documentos acima → **prevalecem** `PLANO_FASE_ATUAL.md` e os ficheiros em `docs/03_execution_log/`; **este índice considera-se desatualizado** até correção explícita.

**Última atualização:** 2026-04-14 — **Eventos / state machine (`PLANO_PARA_CURSOR.md`):** trilho **encerrado no repo** com **classificação de auditoria PASS** (ver plano, **RESULTADO FINAL**); Fases 1–4 + finalização de autoridade; `cancelEvent` transacional + `42P01` + idempotência; **observabilidade** do `ROLLBACK` em `cancelEvent` (`[ROLLBACK_ERROR]` em `event.service.ts`); **CONCURRENCY NOTE** documentada (sem lock pessimista nesta fase); captura **Git / tsc / greps** em `docs/03_execution_log/EVIDENCE_*_2026-04-14.txt` + log **23:20Z**; limpeza legado e rotas ledger 503; mutação de **`events.status`** apenas em `core/events/event.service.ts` (log **15:30Z**). **Gates globais §2:** **PARTIAL** (Gate 4 `psql` não reexecutado aqui; Gate 2 baseline bash — ver `PLANO_PARA_CURSOR.md`). Entrada anterior **2026-04-13 — Finanças / Bank SSOT:** Fase **-1** do mapa de autoridade **concluída no repo** — leituras que dependiam do economy ledger stub migradas para `bank_ledger` / `bank_transactions` / `reporting-bank-aggregates.ts`; rotas HTTP de ledger, reporting, KPIs, payout batch, invoice, identity e risk dashboard alinhados; `transfer()` com log `transfer_completed`; testes `financial-integrity.test.ts` + `financial-db-structural.test.ts` alinhados; **Jest 29** com **`jest-util@29.7.0`** (override `pnpm` na raiz) e `@jest/globals@29`; script **`test:financial-db-structural:ci`** no backend. **CI:** `.github/workflows/ci.yml` — job **`financial-integrity-invariants`** (Postgres, migrate, seed, `RUN_FINANCIAL_*`); **`check-contract-usage`** depende deste job. **Backend CI** (`.github/workflows/backend-ci.yml`, paths `backend/**`) — job **`financial-chaos`** mantém pipeline equivalente com `pnpm`. Evidência: `AUTHORITY_MAP_FINANCIAL_v1.md` (§0, §8.3, §12–§13). **Pendências:** preencher SHA no §0 do mapa após commit; `payment_intents` grafo completo; inventário §6 do mapa; writes `recordEntry` em `modules/ledger` continuam stub; **branch protection:** marcar workflow **CI** como required (recomendação no mapa §13).

**2026-04-13 (RIDES):** **RIDES / mobilidade / logística:** execução técnica **FINALIZADA** (Fases 0–6.1 + patches críticos). Documento canónico de arquivo: `docs/03_execution_log/RIDES_MOBILIDADE_EXECUTION_FINAL_2026-04-13.md`. **Pendência não bloqueadora:** Fase 6.2 — inventário de módulos comentados (higiene; não impacta financeiro, eventos nem semântica). O plano `PLANO_RIDES_MOBILIDADE_FINAL_v2.md` deixou de existir na raiz (conteúdo migrado para o path acima).

**2026-04-12 (snapshot):** **SSOT catálogo §17:** alinhamento índice ↔ `PLANO_FASE_ATUAL.md` ↔ log v3 (ver linha #9 na tabela sistémica). **`UNIFICARD_PLANO_MESTRE_v2.1`:** **STANDBY** — `CORE_TECNICO` **DONE** (patches B1+1B, B2, B3; `PROHIBITED_STRUCTURES`; RLS+FORCE 7 tabelas; FK `authority_roots`→`actors`; `tsc`); fecho **E2E** **não** concluído (**GRANT** `unificard_infra` ao role dos workers, decisão **B5**, restart + validação workers). Evidência e riscos: `docs/03_execution_log/2026-04-11_plano_v21_passo4b_governanca.md`; norma do plano: `UNIFICARD_PLANO_MESTRE_v2_1.md` (*STANDBY v2.1*, *DONE técnico vs operacional*, *FAIL FAST (escopo)*, critério **4b (A)/(B)**). Script: `apply-plan-v2-1.ts` (ordem Partes 3–4 antes B6; cabeçalho estado vs reexecução). **Continua (Definitivo):** Plano **`EXECUTAR/stand_by_UNIFICARD_PLANO_DEFINITIVO_v2.md` v2.8.20:** **EXEC-INFRA-4-SAGA** ✅ **DONE** (**v2.8.17–19**). **EXEC-INFRA-3-JOB** ✅ **DONE** — `reconciliation-scheduled.worker.ts` + `BOOT.ts` + `RECONCILIATION_INTERVAL_MS`. **EXEC-INFRA-6** **PARTIAL** — **v2.8.20** `alert-router.ts` + webhooks `SLACK_ALERT_WEBHOOK` / `PAGER_ALERT_WEBHOOK` desde `canonical-logger.ts`; **falta** aplicar Prom/Alertmanager por ambiente, secrets nos deploys e **error budget** (§INFRA-6). **EXEC-INFRA-1-MIGRATE** ✅ **v2.8.14**. **Opcional:** `domainEventBus` marketplace → outbox.

**Documento canónico (detalhe):** `isto-e-para-voce/STATUS_EXECUCAO.md`

**Pendências consolidadas (IDs UC-P*):** `BACKLOG_CONSOLIDADO.md`

**Contexto de execução:** `EXECUTION_CONTEXT_LOCK.md`

---

## `UNIFICARD_PLANO_MESTRE_v2.1` — segurança financeira · RLS · `authority_roots`

Trilho **separado** do `EXECUTAR/stand_by_UNIFICARD_PLANO_DEFINITIVO_v2.md` (fundação gates fail-closed, norma anti fail-open, defense-in-depth no PG). **Não** confundir com *Bloco 3* do plano Produto/catálogo (`EXECUTAR/ORIENTACAO_PRODUTO_EXECUTAR.md`).

| Marco | Estado | Evidência / notas |
|-------|--------|-------------------|
| Patches B1, 1B, B2, B3 + B6 (comentário) | **DONE** (repo) | `apply-plan-v2-1.ts` + verificações estáticas; ficheiros já alinhados |
| Parte 2 normativa | **DONE** | `docs/01_normative/PROHIBITED_STRUCTURES.md` — secção fail-open gates |
| Migrations ficheiros SQL Partes 3–4 | **DONE** (repo) | `backend/migrations/20260516100000_rls_critical_tables.sql`, `20260517100000_authority_roots_integrity.sql` |
| RLS + FORCE (7 tabelas) no ambiente verificado | **DONE** (sessão documentada) | `psql` migration RLS `COMMIT` + query `pg_class` (7 linhas `rls`/`force_rls` = true) |
| B4 FK `fk_authority_roots_actor` | **DONE por estado** | Critério **(B)** plano v2.1; reexecução `psql -f` 4b pode falhar por DDL não idempotente — **não** invalida se FK + órfãos = 0 |
| Typecheck backend | **DONE** | `npx tsc --noEmit` exit 0 (sessão v2.1) |
| **STANDBY** — fecho operacional | **Registado** | `UNIFICARD_PLANO_MESTRE_v2_1.md` secção *STANDBY v2.1*; log `docs/03_execution_log/2026-04-11_plano_v21_passo4b_governanca.md` |
| GRANT `unificard_infra` → role worker | **PENDENTE** | Input por ambiente; sem isto workers podem falhar com RLS activo |
| B5 (Opção A ou B na migration) | **PENDENTE decisão** | Governança / C.24; omissão = modo permissivo documentado |
| Restart workers + prova pós-GRANT | **PENDENTE** | Infra; não coberto só pelo repo |

**Alterações de documentação / script (v2.1, Abril 2026):** `UNIFICARD_PLANO_MESTRE_v2_1.md` — errata (4b, FAIL FAST, validação estado>script), *Plano vs script*, *DONE técnico vs operacional*; `apply-plan-v2-1.ts` — ordem de execução alinhada ao MAPA (B6 após criação migrations); remissão explícita a validação por estado no cabeçalho do script.

---

## RIDES / mobilidade / logística — arquivo de execução

Trilho **separado** do catálogo §17 e do `EXECUTAR/stand_by_UNIFICARD_PLANO_DEFINITIVO_v2.md`; foco em conceitos/veículos, splits em cents no Bank, payload de eventos e deprecação do serviço órfão em `rides/vehicles/`.

| Marco | Estado | Evidência / notas |
|-------|--------|-------------------|
| Fases 0–6.1 + patches críticos (SSOT financeiro, outbox, órfão) | **FINALIZADO** | `docs/03_execution_log/RIDES_MOBILIDADE_EXECUTION_FINAL_2026-04-13.md` (cabeçalho **STATUS** no ficheiro) |
| Fase 6.2 — inventário módulos comentados | **PENDENTE** (não bloqueador) | Higiene futura; opcional no roadmap imediato |

---

## Domínio eventos (state machine) — `PLANO_PARA_CURSOR.md`

Trilho focado em **autoridade única** do agregado `events` no core, hardening de `cancelEvent`, limpeza de legado e bloqueio de rotas ledger legadas. **Evidência integral:** `PLANO_PARA_CURSOR.md` (secção **EXECUTION LOG**, **EXECUTION EVIDENCE SUMMARY**, **CONCURRENCY NOTE**, **RESULTADO FINAL: PASS**) + ficheiros `docs/03_execution_log/EVIDENCE_*_2026-04-14.txt`.

| Marco | Estado | Evidência / notas |
|-------|--------|-------------------|
| Fase 1 — `cancelEvent` transacional + `42P01` | **DONE** | `core/events/event.service.ts` · log plano **12:05Z** |
| Fase 2 — remoção bypass (`modules/events/event.service`, `services/events/EventService`) | **DONE** | `events-sprint76.routes.ts` + `event.repository`; `event-lifecycle.routes.ts`; `my-orders.service.ts`; ficheiros removidos |
| Fase 3 — Grupo A (rides payment, catalog-payment, referral-split, `fund/`, CompanyScheduleService) | **DONE** | Log plano **12:20Z** |
| Fase 4 — `ledger.routes` 503 + remoção `ledgerService.recordSplitsCreated` | **DONE** | `core/economy/ledger/ledger.routes.ts`; `service-order.service.ts` · **14:05Z** |
| Authority — `UPDATE events` + `status` só no core | **DONE** | Log **15:30Z** · remoções em `event.repository`, `events-multi-actor.service.ts`; comentários SQL limpos em `event-lifecycle.routes.ts` |
| Hardening evidencial (Git / tsc / greps em ficheiro) | **DONE** | Log plano **23:20Z** · `EVIDENCE_git_*`, `EVIDENCE_tsc_*`, `EVIDENCE_grep_*` |
| Observabilidade — `ROLLBACK` em `cancelEvent` | **DONE** | `event.service.ts` — `[ROLLBACK_ERROR]` · log **23:20Z** |
| Concorrência no cancelamento | **DOCUMENTADO** | **CONCURRENCY NOTE** no plano — risco aceite; sem lock explícito nesta fase |
| Classificação auditoria (plano) | **PASS** | `PLANO_PARA_CURSOR.md` — **RESULTADO FINAL: PASS** |
| Typecheck backend | **DONE** | `pnpm exec tsc --noEmit` exit 0 · `EVIDENCE_tsc_noemit_2026-04-14.txt` |
| Gates globais (§2 do plano) | **PARTIAL** | Gate 4 sem `DATABASE_URL` neste ambiente; Gate 2 (grep bash SSOT) não replicado 1:1 no Windows — detalhe no plano |

---

## Domínio financeiro — mapa de autoridade (Bank / `transfer`)

Trilho **separado** do catálogo §17; foco em **SSOT de saldo e movimentos** (`bank_ledger`, `bank_transactions`), callers de **`transfer()`**, e remedição do **economy ledger stub**.

| Marco | Estado | Evidência / notas |
|-------|--------|-------------------|
| Fase -1 — leituras / KPIs / rotas sem dados falsos do stub | **DONE** (repo) | `AUTHORITY_MAP_FINANCIAL_v1.md` §4, §13; `reporting-bank-aggregates.ts`; rotas `modules/ledger`, `core/economy/ledger` |
| Inventário callers `transfer()` | **DONE** (grep `src`) | §8.4 do mapa |
| Log `transfer_completed` | **DONE** | `bank-transaction.service.ts` |
| Testes invariantes (`financial-integrity` + estrutural DB) | **DONE** (código) | §8.3 do mapa; local: skipped sem `DATABASE_URL` + flags |
| Jest / `jest-util` monorepo | **DONE** | Override `pnpm` `jest-util@29.7.0`; `@jest/globals@29` — §8.3 |
| CI — invariantes com Postgres (pipeline principal) | **DONE** (workflow) | `.github/workflows/ci.yml` → `financial-integrity-invariants`; `needs` em `check-contract-usage` |
| CI — backend-only | **DONE** (workflow) | `.github/workflows/backend-ci.yml` → `financial-chaos` (paths `backend/**`) |
| `payment_intents` → grafo completo | **PENDENTE** | §8.1 do mapa |
| Writes `modules/ledger` (`recordEntry`) | **STUB** | Não SSOT de dinheiro; `bank_*` é autoridade |

---

## Classificação sistémica (evidência `EXECUTION_CONTEXT_LOCK.md`)

**Impacto económico (A–D):** ver taxonomia em `BACKLOG_CONSOLIDADO.md`. Cada linha: **Cls** + **UC** + etiqueta **máxima** de risco.

| # | Tema | Cls | UC | Imp. | Evidência |
|---|------|-----|-----|------|-----------|
| 1 | Saga (INFRA-4) | [~] | UC-P1-203 | C | **v2.8.17–2.8.19:** **[EXEC-INFRA-4-SAGA] DONE** — wiring + invariantes + `test:integration:orch-chaos-payment` (falha pós-`paid`, spy `transfer`, concorrência) · `orderSagaService` em `order` / `payment-execution` / `fulfillment` |
| 2 | Outbox + handler layer | [~] | UC-P1-202 | B | `event_outbox` + worker; `event_handler_failures` + retry por `handler_key` (v2.8.8); **EXEC-INFRA-1-MIGRATE DONE** (v2.8.14): `eventBus` global só publica via processor; opcional evoluir `domainEventBus` marketplace |
| 3 | Canonical global em queries (2B) | [~] | UC-P1-201 | A/C | `backend/migrations/20260502100000_canonical_products_global_scope.sql`; adapter ainda filtra tenant |
| 4 | GUARDA / economic_guardianship | [~] | UC-P1-204 | B | `backend/migrations/20260501100000_economic_guardianship.sql`; cobertura parcial de trilhos |
| 5 | Concept resolution (fila canónica vs UI) | [~] | *(ver nota em BACKLOG)* | D/C | `canonical_concept_resolution_queue` + migrations; painel Fase 3.5 em `isto-e-para-voce/STATUS_EXECUCAO.md` — desdobrar UC |
| 6 | parseFloat / monetário residual | [~] | UC-P2-301 | B/D | ~119 ocorrências; subset financeiro (~42) — LOCK |
| 7 | Autorização fragmentada | [~] | UC-P2-303 | B/C | rbac + shadow + authority + permission |
| 8 | MarketplaceService monólito | [~] | UC-P2-304 | D/C | ~6624 linhas; extração parcial (Fund module) |
| 9 | Gate §17 plataforma (catálogo / `canonical_products`) | [✓] | UC-P0-017 | A/B | **Norma:** `PLANO_FASE_ATUAL.md` secção **#17**. **Execução fechada (trilho v3):** `docs/03_execution_log/PLANO_EXECUCAO_CURSOR_v3.md` + `docs/03_execution_log/2026-EXECUCAO_V3.md` (checklist gate §17, blocos H/I/J, auditoria SQL pós-v3). **Âmbito:** critérios verificados no repositório e evidência registada — **não** dispensa prova por ambiente alvo (ex. produção) quando a governança o exigir. **Não confundir:** fecho v3 **≠** invariantes de dados em CI (opcional / processo). **§10–11** pool/escrow: decisão de roadmap, não abertura automática. |

---

## Registo de tasks EXEC-* (protocolo v2.8.4)

**Fonte normativa:** `EXECUTAR/stand_by_UNIFICARD_PLANO_DEFINITIVO_v2.md` → **EXECUTION STATE REGISTRY** + **EXECUTION ENTRYPOINT**. A linha **EXEC-PLANO-V21** segue `UNIFICARD_PLANO_MESTRE_v2_1.md` (trilho à parte).

| Task | State | Evidence |
|------|-------|----------|
| EXEC-INFRA-1-WORKER | DONE | 2026-04-09T12:00:00Z · agent:Cursor · início execução worker outbox alinhado ao plano · SELECT + backoff + DLQ (`event-outbox.processor.ts`) · DLQ implementado com corte por max_attempts + backoff completo |
| EXEC-INFRA-1-MIGRATE | DONE | **v2.8.14** · Histórico 2026-04-09→10 + lotes sociais/agenda + **work/** (`work-event-outbox.helper` + jobs/applications/assignments/workers/skills/`work.events`) + **config**, **company-canonical**, **event-economic-phase**, **event.routes** (`event.created`), **review**, **profile-education**, **penalty**, **actor-effects**, **actor-audit** · `outboxEventIdFromSeed` · prova: `rg "eventBus\\.publish" backend/src` → só `event-outbox.processor.ts` · `EXECUTAR/stand_by_UNIFICARD_PLANO_DEFINITIVO_v2.md` §INFRA-1 |
| EXEC-INFRA-1-HANDLER-NORM | DONE | 2026-04-08 · `HANDLER_EXECUTION_AND_RELIABILITY.md` · evolução 2026-04-11: §5.1 §7 §8 · plano v2.8.8 |
| EXEC-INFRA-1-HANDLER-RETRY | DONE | 2026-04-11 · migration `20260511120000` · repo + processor + worker + BOOT · `event-bus` `handler_key` / `invokeHandlerOnly` · PASSO 6 integração · `EXECUTAR/stand_by_UNIFICARD_PLANO_DEFINITIVO_v2.md` v2.8.8 |
| EXEC-INFRA-1-HANDLER-OPS | DONE | 2026-04-11 · `docs/runbooks/handler-failures.md` · logs `metric_event` · runbooks/norma outbox · plano v2.8.8 |
| EXEC-INFRA-4-SAGA | DONE | **v2.8.17** wiring + **v2.8.18** invariantes + **v2.8.19** `orch-chaos-payment-failure.integration.test.ts` + `orch-chaos-marketplace-harness.ts` · `pnpm run test:integration:orch-chaos-payment` · **order** `startSaga` pós-`COMMIT` · **payment** `releaseReservation`→`failSaga`; `transfer`→`advanceSaga` `paid`… · **fulfillment** ship→`fulfilled` · **INFRA-4.2** · `rg` `orderSagaService` `marketplace/**` |
| EXEC-INFRA-3-JOB | DONE | **v2.8.15** motor + SQL + rotas + runbook · **v2.8.20** · `workers/reconciliation-scheduled.worker.ts` · `BOOT.ts` · `RECONCILIATION_INTERVAL_MS` · logs `metric_event` / crítico quando drift agregado |
| EXEC-PROD-6-SNAPSHOT | NOT_STARTED | — |
| EXEC-INFRA-6 | PARTIAL | **v2.8.9–v2.8.12** métricas + SQL + runbooks + Opção A + histograma P99 · **v2.8.15** rotas reconciliação/sagas + `handler-metrics` · **v2.8.16** `saga_compensation_*` · **v2.8.20** `alert-router.ts` + webhooks desde `canonical-logger.ts` · **falta** Prom/AM por ambiente, secrets, error budget |
| EXEC-ORCH-1 | NOT_STARTED | — |
| **EXEC-PLANO-V21** | **STANDBY** | **2026-04-11** · `UNIFICARD_PLANO_MESTRE_v2_1` · `CORE_TECNICO` **DONE** · E2E pendente (GRANT, B5, workers) · `docs/03_execution_log/2026-04-11_plano_v21_passo4b_governanca.md` · DRY_RUN + script real PASS · `tsc` PASS · `psql` RLS OK · 4b idempotência + PASS estado (FK) |

**Nota INFRA-4.1 / INFRA-4.2 / EXEC-INFRA-4-SAGA:** **4.1** **v2.8.15**; **4.2** **v2.8.16**; **wiring + invariantes + integração caos** **[EXEC-INFRA-4-SAGA]** **DONE v2.8.17–2.8.19** — ver plano **Revisões 2.8.15–2.8.19** (harness não substitui `executePayment` até repositório `payment_transactions` real).
