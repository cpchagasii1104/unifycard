## 2026-05-05 — BankTransactionReadPort implementado (#019.FR)

Commit: 5a4d5dba
Gate: modules_import=68 (era 69)

Entregues:
- core/bank/ports/bank-transaction-read.port.ts (novo)
- modules/bank/bank-transaction-read.repository.ts (estendido)
- modules/bank/adapters/bank-transaction-read.adapter.ts (novo)
- core/bank/ports-registry.ts (estendido)
- app.builder.ts (injeção adicionada)
- core/identity/identity.routes.ts (inversão L861 removida)
- core/dashboard/dashboard.service.ts (migrado para ReadPort)

SQL validado: bank_ledger.direction, bank_accounts.actor_id
AI: stub vazio mantido (proteção arquitetural)
Decisão: Dashboard vê produto. AI vê contexto. Identity vê identidade. Bank mantém a verdade financeira.

## 2026-05-05 — Gate validate-core-purity baseline oficial

GATE_ATUAL (static only):    58 sinais / 32 arquivos
GATE_ESTENDIDO (static+dyn): 69 sinais / 38 arquivos
Diferença dinâmicos:         11 sinais / 9 arquivos

Commits: 65a0f754 (latente registry) | d8998997 (gate fase 1) | a38f636e | 56342d84

Débitos confirmados:
- src/scripts/ incluído no tsconfig.build.json (fora do escopo de produção)
- 4 strings modules/ em core/ai/ são texto, não imports (excluídas do gate)
- Caminho documental corrigido no script

#### IMPORTANTE!!! Tivemos uma janela de tempo por cauda de BACKUP e abaixo está a lacuna que precisamos refazer:

Hipótese #019 em execução: usar critério de soberania/SSOT definido em `HIPOTESES_DAS_36_HORAS_2026-05_v3.md` antes de classificar core/modules.

## Artefatos Abertos

1. `HIPOTESES_DAS_36_HORAS_2026-05_v3.md`
   - Status: EM EXECUÇÃO
   - Regra ativa: usar critério de soberania/SSOT (ver seção #019)
   - Próxima ação: classificar amostra de 5 arquivos
   - Estado de bloqueio: nenhum

## Regra Operacional Ativa

- Auditoria NÃO é por pasta (`core/` vs `modules/`)
- Auditoria é por soberania: Norma → SSOT → Builder → Imports → Execução
- `app.builder` = prova de vida, NÃO de autoridade

Analisando os dois documentos que você enviou, a diferença principal é de **estado temporal e conteúdo incremental**:

## `STATUS_EXECUCAO_GLOBAL.md` (primeiro arquivo)

É o **documento base original** com checkpoints até **2026-05-01** (incluindo DECISION-0017 fechada, Loop §6 abortado, etc.). Contém a estrutura canônica do status global com:
- Estado global (§GLOBAL BLOCK INATIVO)
- Matriz por módulo (macro)
- Ciclo econômico UnifyCard
- Checkpoints detalhados de FASE 4, FASE 5 C2, C63, C18, C11, C41, C42, etc.
- Próximas ações até Nomenclatura EIXO 2-9

## `03_05_STATUS_EXECUCAO_GLOBAL.md` (segundo arquivo)

É uma **versão estendida/continuação** do primeiro, com atualizações até **2026-05-03** (2 dias depois). Adiciona:

### Novos itens críticos (maio 2026)
| Novidade | Descrição |
|----------|-----------|
| **C65 — Drift monetário** | NOVO BLOCKER: P2P/donation com contrato quebrado entre schema Zod (`amountCents`) e destructuring (`amount`) |
| **DT-tsc-reaberto** | Typecheck backend voltou a falhar (1489 erros TS) — reabre DT-tsc que estava declarado fechado em 2026-04-20 |
| **Gates propostos G-6/G-7** | Novos gates: validação schema-vs-service e validação monetária canônica |
| **Princípio operacional DECISION-0020** | "Antes do primeiro usuário, toda concessão a legado é suspeita" |

### Checkpoints adicionais de maio
- **2026-05-02 (noite)** — Higiene da allowlist concluída (C8, C3, C4 resolvidos; DT-C3/DT-C4 registrados)
- **2026-05-02** — Gate schema-coherence hardening (commit `14f77c3a`, 5 arquivos alterados)
- **2026-05-01 (noite)** — Loop §6 re-executado com plano v1.2 → parcial-PASS por allowlist ainda expirada (Cenário E)
- **2026-05-01 (tarde)** — Loop §6 abortado por allowlist expirada (Cenário E, documentado no plano)

### Conteúdo migrado de `STATUS_EXECUCAO.md`
O segundo arquivo também **absorveu** o conteúdo do antigo `STATUS_EXECUCAO.md` (índice raiz), que antes existia como documento separado. Isso inclui:
- Status de REFATOR ARQUITETURAL (FASE S–7, BLOCO 2)
- Status MARKETPLACE, ORDERS, SERVICES, BANK/PAYMENTS
- LOTE 1 Identity + staging
- Domínio eventos (`PLANO_PARA_CURSOR.md`)
- Domínio financeiro (mapa de autoridade)
- Classificação sistémica (`EXECUTION_CONTEXT_LOCK.md`)
- Registro de tasks EXEC-* (protocolo v2.8.4)

---

## Resumo da diferença

| Aspecto | `STATUS_EXECUCAO_GLOBAL.md` | `03_05_STATUS_EXECUCAO_GLOBAL.md` |
|--------|---------------------------|-----------------------------------|
| **Data limite** | 2026-05-01 | 2026-05-03 |
| **C65 (drift monetário)** | ❌ Não existe | ✅ NOVO BLOCKER |
| **DT-tsc** | Fechado (2026-04-20) | **Reaberto** (1489 erros) |
| **DECISION-0020** | ❌ Não existe | ✅ Princípio operacional novo |
| **Gates G-6/G-7** | ❌ Não existe | ✅ Propostos |
| **Loop §6** | Abortado (v1.0) | Re-executado (v1.2), parcial-PASS |
| **Allowlist** | Expirada (C3/C4/C8) | **Higiene concluída** (C8 removido, C3/C4 resolvidos) |
| **STATUS_EXECUCAO.md** | Documento separado | **Conteúdo absorvido** (unificação de fonte) |
| **Tamanho** | ~380 linhas | ~650 linhas |

O segundo documento representa a **evolução operacional** do primeiro: novos bloqueiros descobertos, reabertura de débitos técnicos, consolidação de documentos e avanço na governança (DECISION-0017 fechada, higiene de allowlist, hardening de gates).

### FIM DA OBSERVAÇÂO QUE DEVE SER ANOTADA QUANDO FOR ESTABILIZADA!!!! ISTO ESTÁ PENDENTE!!!!



## 2026-05-04 — Código latente identificado (Hipótese #019)

- Identificada categoria "código latente" durante diagnóstico #019.
- Primeiro caso classificado: `subscription-expiration.job.ts`.
- Registry criado em `docs/decisions/CODIGO_LATENTE_REGISTRY.md`.
- Metodologia: classificar antes de mover, preservar intenção arquitetural.

## Checkpoint 2026-05-01 — DECISION-0017 fechada (3 ciclos)

- DECISION-0017 registrada no LOG (commit 4f9b9b7e).
- Script paralelo `backend/scripts/validate-repository-schema-coherence.mjs` descartado; nota institucional registrada (commit 95d88cd1).
- Modo `--repo-strict` adicionado ao gate amplo `scripts/validate-schema-code-coherence.mjs` (commit 5c793a61, 12 linhas adicionadas).
- Nota de fechamento do Ciclo 3 registrada no STATUS (commit 6b5127a4).
- Recomendação de DECISION-0015 (gate `validate:repository-schema-coherence`) cumprida via consolidação no gate amplo, não via script novo, conforme Lei §1 (sistema único, sem realidade paralela).

## Próximas ações (atualizado 2026-05-01)

1. Loop §6 do PLAN contra `validate:schema-coherence --repo-strict` (validar 10 amostras manualmente).
2. DECISION-0018 registrando resultado do Loop §6 e formato de baseline.
3. Integração `validate:schema-coherence:repo-strict` ao `backend/package.json` (após Loop §6).
4. Integração ao CI workflow (após `package.json`).
5. Corrigir 2ª ocorrência slug hardcoded em `processRidePayment` (`bank-integration.service.ts:910`) — dívida de DECISION-0015.
6. Reconciliar violações OPEN no SYSTEM_REMEDIATION_STATUS.md (C36, C37, C29).
7. Nomenclatura EIXO 2-9 (PLANO_CORRECAO_NOMENCLATURA.md).

## Checkpoint 2026-04-30 — G2 PIPELINE E2E TRANSVERSAL PASS

- **G2 FECHADO:** Pipeline E2E transversal validado com PASS completo.
- **Modo A causal:** A1–A10 todos verdes (RFQ → Quote → Accept → PaymentRequest → Execution → Ledger → Outbox).
- **Modo B falsificações:** Todas rejeitadas pelo runtime (B1, B2, B3, B5).
- **5 gaps de schema materializados via migrations:**
  - 20260530510000: bank_limit_change_requests
  - 20260530511000: bank_policies
  - 20260530512000: bank_transactions.metadata (coluna JSONB)
  - 20260530513000: authority_trust_levels
  - 20260530514000: service_payment_executions
- **Patch cirúrgico:** bank-integration.service.ts:524-546 — slug 'ride-payment' → UUID via SSOT semântico.
- **Seeds G2:** authority_roots + identities (kyc_status='approved', kyc_level='complete') adicionados ao script de validação.
- **DECISION-0015 registrada:** REMEDIATION_DECISIONS_LOG.md.
- **Dívida técnica explícita:** 2ª ocorrência slug hardcoded (processRidePayment:910), amount vs amount_cents em service_payment_executions, tabelas auxiliares fail-open (system_notifications, business_audit_logs, authority_delegations).
- **Recomendação pendente:** gate CI validate:repository-schema-coherence (compara *.repository.ts com schema real do banco).

## Próximas ações (atualizado 2026-04-30)

1. Implementar gate `validate:repository-schema-coherence` (causa raiz G2 — DECISION-0015)
2. Corrigir 2ª ocorrência slug hardcoded em processRidePayment (bank-integration.service.ts:910)
3. Reconciliar violações OPEN no SYSTEM_REMEDIATION_STATUS.md (C36, C37, C29)
4. Nomenclatura EIXO 2-9 (PLANO_CORRECAO_NOMENCLATURA.md)
# STATUS_EXECUCAO_GLOBAL.md

**GLOBAL BLOCK STATUS:** INATIVO — ver tabela «Estado global» abaixo (actualizar sempre que A1–A4 ou política de bloqueio mudarem). Referência rápida: **2026-04-14** (revisão documental anti-regressão).

**Função:** memória única de orquestração entre módulos — **não** substitui `STATUS_EXECUCAO.md` por plano nem §A de cada `PLANO_*.md`.  
**Regra:** actualizar após cada sessão que mude trilho, bloqueio ou conclusão de módulo.  
**Transições de estado:** só conforme **`PLANO_BASE_MODULO.md` §STATE_TRANSITION_RULES** (evidência SQL obrigatória para desbloqueios).

**Gate no repo:** `npm run validate:system-state` (coerência deste ficheiro + A1–A4 se `DATABASE_URL` e `pg` existirem). **A2** na BD segue `PLANO_IDENTITY_RECONCILIATION.md` §2.1 (actores humanos **elegíveis**: `is_identity_required = true`). Números concretos (ex.: último A2) devem constar do **log de execução** / evidência SQL colada — não substituem a leitura directa do precheck no ambiente alvo. `npm run validate:system-state:strict` falha com **§GLOBAL BLOCK ATIVO** sem `DATABASE_URL`; com BD, falha também se A1–A4 > 0 **ou** se A1–A4 = 0 mas o STATUS ainda não foi actualizado para **INATIVO** (STATUS desactualizado face à realidade).

**Última actualização:** 2026-04-27 (FASE 5 C2 — 9 call sites commitados; 4 callers wrapper pendentes)

**Atualização 2026-04-28:** C63 identificado — SSOT temporal duplicado (DECISION-0014)

---

## Estado global

| Campo | Valor |
|-------|--------|
| **§GLOBAL BLOCK** | INATIVO — A1=A2=A3=A4=0 confirmados em 2026-04-18 UTC (banco dev recriado do zero; precheck `identity:precheck:a1-a4` executado) |
| **Execução contínua segura (§CONTINUOUS_EXECUTION_MODE)** | PERMITIDA — §GLOBAL BLOCK INATIVO |
| **CI / §CI** | Guards ativos no repo |

---

## Gate 0 — conexão à BD (pré-CP-1, Identity precheck)

| Campo | Valor |
|-------|--------|
| **Conexão `DATABASE_URL`** | Na última verificação documentada: **falha** PostgreSQL `28P01` (autenticação) — sem `DB_OK` |
| **Precheck `identity:precheck:a1-a4`** | **Não executado** — **A1–A4 indeterminados** (sem evidência válida) |
| **Decisão normativa** | **Parada** até `DB_OK` + output completo do precheck no ambiente alvo. **Proibido:** batches 1–2, triagem CP-5 material, deduplicação A4, ou reclassificar §GLOBAL BLOCK com base em contagens inexistentes |

---

## Matriz por módulo (macro)

| Módulo / trilho | Status | DEPENDÊNCIA | Notas |
|-----------------|--------|-------------|-------|
| **Identity (reconciliação)** | CONCLUÍDO | — | A1=A2=A3=A4=0 em 2026-04-18. Scripts identity:precheck, batch1, batch2, cp5:export criados em backend/scripts/. |
| **Core (tempo, eventos, base)** | CONCLUÍDO | — | FASE 4 CONCLUÍDA 2026-04-24. Todas as violações estruturais fechadas. |
| **core/actors + helpers de actor** | EM REMEDIAÇÃO | — | C3 FIXED 2026-04-21 (2 helpers alinhados ao writer canônico) |
| **marketplace** | CONCLUÍDO | — | PASS — ENCERRADO (2026-04-19, 7 DTs, gates OK) |
| **orders** | CONCLUÍDO | marketplace | PASS — ENCERRADO (2026-04-19, gates OK) |
| **services** | CONCLUÍDO | orders | PASS — ENCERRADO (2026-04-19) |
| **bank / payments (TIER 1)** | CONCLUÍDO | — | PASS — ENCERRADO + ESCROW IMPLEMENTADO (2026-04-19, 3 DTs) |
| **rides (TIER 3)** | CONCLUÍDO | bank | PASS — ENCERRADO (2026-04-19, 8 migrations genesis, gates OK) |
| **social (TIER 3)** | CONCLUÍDO | bank | PASS — ENCERRADO (2026-04-19, social-ledger bloqueado, gates OK) |
| **events (TIER 3)** | CONCLUÍDO | bank | PASS — ENCERRADO (2026-04-20, 9 tabelas genesis, gates OK) |
| **profile / public-profiles** | CONCLUÍDO | — | PASS — ENCERRADO (2026-04-20, public_profiles criada, gates OK) |
| **trust** | CONCLUÍDO | — | PASS — ENCERRADO (2026-04-20, 3 tabelas genesis, gates OK) |
| **live-chat / inbox** | CONCLUÍDO | — | PASS — ENCERRADO (2026-04-20, 4 tabelas genesis, gates OK) |

**Legenda de status:** `PENDENTE` | `EM EXECUÇÃO` | `BLOQUEADO` | `CONCLUÍDO` | `AGUARDANDO`

---

## Ciclo econômico UnifyCard — IMPLEMENTADO (2026-04-19)

- bank_ledger: SSOT financeiro ✅
- escrow bridge: bank-first implementado ✅
- rides split: driver/regional/group/referral/fee ✅
- regional_funds: alimentado por cada corrida ✅
- social: impact_ledger + actor_reputation ✅
- UnifyBank: regional-fund-governance.service.ts pronto para leitura ✅
- Transparência: transparency.getTransactionSplits() disponível ✅

---

## Próxima acção (humano ou agente)

1. **Validação end-to-end dos fluxos ponta-a-ponta**
2. **Q3+Q4** — orquestração evento+serviço (pós-lançamento)
3. **Nomenclatura EIXO 2-9** (PLANO_CORRECAO_NOMENCLATURA.md)


## Checkpoint 2026-04-28 — C63 SSOT Temporal

- **C63 identificado:** duplicação SSOT temporal (schedules ∥ unified_availability)
- **DECISION-0014 registrada:** Opção B (migrar código → REVOKE)
- **6 WRITE paths mapeados:**
  - 3 em produção (checkout, contratação, demissão)
  - 3 em código morto (EventScheduleService, SlotGenerator)
- **Migration criada:** 20260428200000_schedules_revoke_write.sql (NÃO APLICADA)
- **Status:** IN_PROGRESS (migração em andamento)
- **Próxima ação:** FASE 1 — bloquear código morto com ScheduleLegacyBlocker

## Checkpoint 2026-04-27 — FASE 5 C2 — 9 call sites commitados

- DECISION-C2-010: 6 concepts commerce aprovados (ba684181)
- Seed 6 concepts commerce aplicada (b2b94526)
- 9 call sites preenchidos com concept_id:
    payment-execution.service.ts (6 sites): 8c1521d9
    transaction.service.ts (wrapper, opcional): 48c2d6e1
    financial-simulator.controller.ts (2 sites): 764739bf
- estouaprendendo.md secao 22.5 corrigido (concepts financial-simulator)
- Bloqueador 3-C: 4 callers do wrapper pendentes:
    core/economy/distribution/distribution.service.ts
    core/economy/split.service.ts
    modules/social/social-work-payment.service.ts
    core/unifybank/test-currency.service.ts
- Proxima acao: resolver 4 callers um por vez (um commit por arquivo)

1. **Validação end-to-end dos fluxos ponta-a-ponta**
2. **Q3+Q4** — orquestração evento+serviço (pós-lançamento)
3. **Nomenclatura EIXO 2-9** (PLANO_CORRECAO_NOMENCLATURA.md)

---

## Checkpoint de continuidade — 2026-04-20 (DT-votes / DT-tsc)

- **DT-votes:** FECHADO como falso positivo. Diagnóstico confirmado: INSERTs de `group_votes` e `group_vote_options` em `modules/groups/votes.service.ts` estão dentro de `runTenantTransaction` com `trx.query` (padrão atômico válido).
- **Gate arquitetura (strict):** verde, sem ocorrências novas vs baseline (`critical_new=0`, `warning_new=0`, `exit 0`).
- **DT-tsc (baseline atual):** 12 erros totais mapeados via compilação direta (`pnpm exec tsc --noEmit`), concentrados em `core/auth`, `core/db/load-backend-env`, `modules/marketplace/payment-execution.service`, `modules/social`.
- **Próximo ponto de retomada:** propor plano de correção do DT-tsc por lote (auth/contracts → marketplace payload → social types → load-backend-env/module target).

## Checkpoint de continuidade — 2026-04-20 (DT-tsc / seed dev)

- **DT-tsc:** FECHADO. Correções aplicadas em `packages/contracts/src/vocabulary.ts`, `modules/marketplace/payment-execution.service.ts`, `core/db/load-backend-env.ts`, `modules/social/actor-capabilities.service.ts`; `pnpm --dir C:/unificard/backend exec tsc --noEmit` sem erros.
- **Contracts build:** verde após criação de `src/vocabulary.ts`; exports de `Gender` e `GENDER_VALUES` restaurados para consumo do backend.
- **Runtime seed:** `pnpm --dir C:/unificard/backend run seed:dev:complete` executado com sucesso após ajuste ESM-safe em `load-backend-env.ts` e manutenção de `tsconfig.json` em `commonjs`/`node`.
- **Estado do banco dev após seed:** tenants=1, users=1, actors=1, global_users=1, roles=4, categories=58.
- **Gates pós-seed:** actor-writer OK, bank-ledger OK, regression-guards OK, architectural strict OK (`critical_new=0`, `warning_new=0`).

## Checkpoint de continuidade — 2026-04-20 (financial-e2e)

- **Migração aplicada:** `20260530480000_fix_system_coverage_view.sql` criada e validada; view `system_coverage` passou a excluir `system:liquidity_issuance:%` do cálculo de `execution_capacity_cents`.
- **Correção de runtime financeiro:** lookup de conta de débito em `modules/bank/bank-transaction.service.ts` ajustado para consulta direta em `bank_accounts`, eliminando falha `From account ... not found` no E2E financeiro.
- **Validação financeira E2E:** VERDE (`pnpm --dir C:/unificard/backend run validate:financial-e2e`, `EXIT_CODE=0`).
- **Estado observado após validação:** saldos de ledger reportados `user1_cents=920000`, `user2_cents=80000`; bloqueio anterior `COVERAGE_EXCEEDED` removido.

---

## Ponto zero documental canônico — 2026-04-21

A partir desta data, `docs/03_execution_log/` é a fonte oficial de logs de
execução por sessão. Antes desta data, a fonte histórica oficial é o
git log do repositório, complementado por:
- SYSTEM_REMEDIATION_STATUS.md (violações rastreadas)
- REMEDIATION_DECISIONS_LOG.md (DECISION-0001 a DECISION-0004 pré-ponto zero)
- REMEDIATION_SNAPSHOTS.md (snapshots FASE 0, 1, 2 pré-ponto zero)
- MODULOS.txt (módulos auditados antes de 2026-04-21)

## Checkpoint de continuidade — 2026-04-21 (FASE 4 remediação)

- **Sessão executada.** Violações fechadas: C4, C45 complemento, C1 (4 fixes),
  C3 (2 fixes). Metodologia «DECISION antes de código» consolidada.
- **DECISIONs adicionadas:** 0005, 0006, 0007, 0008, 0009 (ver REMEDIATION_DECISIONS_LOG.md).
- **Gates 4/4 PASS** ao final.
- **Violações:** Total 48 | OPEN 28 | FIXED 9 | DECISION_PENDING 10.
- **Próxima ação:** fix único de C12 em `identity.routes.ts` (DECISION-0009 já registrada).
- **Log detalhado:** docs/03_execution_log/2026-04-21-fase4-c1-c3-c4.md
- **Template para próximas sessões:** docs/03_execution_log/_TEMPLATE.md

---

## Checkpoint de continuidade — 2026-04-24 (FASE 4 CONCLUÍDA)

- **FASE 4 encerrada e arquivada.** Commit `872aba6b`.
- **C52 FIXED COMPLETO:** E2E PASS em 6/6 fluxos de payment_intent.
- **Quadrinho de autoridade FECHADO:** C47, C54, C55, C57 FIXED.
- **BUG-TICKET-001 corrigido.**
- **Artefatos arquivados em:** `docs/99_archive/2026-04-24_FASE4_*.md`
- **Próxima ação:** iniciar FASE 5 (nomenclatura EIXO 2-9) ou trabalho de compliance regulatório quando priorizado.

*Gerado como infraestrutura de execução contínua; não altera código.*

---

## FASE 5 — Violação C2 (EM EXECUÇÃO — iniciada 2026-04-24)

**Objetivo:** propagar concept_id em todos os call sites de bank_transactions.

**Branch:** rescue-structural

**RFCs base:**
- RFC_C2_bank_transactions_concept_link.md (f323308a)
- RFC_C2_rollout.md (706b61af + 330b1677 + abddab6d) — Opção B NULL-first
- RFC_C2_seed_concepts_financeiros.md (12af0a3a) — 24 concepts aprovados

**Commits executados:**
- e1cd8032 — Passo 1: ADD COLUMN concept_id UUID NULL + FK + índice
- 096ff94b — Passo 2: Seed 24 concepts financeiros + 7 domains
- 175a73c5 — Passo 3-A: DTO + runtime guards + INSERTs
- 4c8adb1a — Passo 3-A hardening: guards via input.concept_id
- abddab6d — RFC rollout refinado (sub-passos 3-A/3-B/3-C)
- dcd23f84 — 3-B path#1: escrow releasePayment → escrow-release-to-recipient
- b6f2f6fe — 3-B path#2: escrow refundFunds → escrow-refund-to-payer
- 79d44b93 — 3-B path#3: treasury-split regional_fund
- 54ae0903 — 3-B path#4: treasury-split community_fund
- 56568c30 — 3-B path#5: treasury-split system_reserve
- 868e2ebc — 3-B path#6: treasury-split governance_pool
- 090cbc95 — 3-B path#7: payment-event-resolver PIX → pix-payment-received
- fbb56aed — 3-B path#8: payment-event-resolver seller → seller-funds-release
- d13d6610 — 3-B path#9: reversal COM split → transaction-reversal-leg
- 1df22efb — 3-B path#10: reversal SEM split → transaction-reversal
- ebe6c18b — 3-B path#11: payout-worker → seller-payout
- 4a4865bd — 3-B path#12: bank-settlement-worker → bank-external-settlement
- 097f60ac — 3-B path#13: ledger-compensation → ledger-compensation
- 3eb467b7 — 3-B path#14: regional-fund → regional-fund-topup
- affbea0f — 3-B path#15: governance-funding-commitment-worker → escrow-hold
- 9cdd330d — 3-B path#16: event-payment-execution → escrow-release-to-recipient
- 7e311d37 — 3-B path#17: event-economy → event-ticket-payment
- e0de9e90 — 3-B path#18: capacity-application → resource-compensation-payout
- 59fc823d — 3-B path#19: marketplace-orchestration → regional-fund-incentive-grant
- 50fdd78f — 3-B path#20: bank-integration processEventTicketPayment → event-ticket-payment
- be0f8519 — 3-B path#21: bank-integration processEventConsumptionPayment → event-ticket-payment
- ac661dc2 — 3-B path#22: bank-integration processServiceBookingPayment → service-booking-payment
- 8fa1f827 — 3-B path#23: bank-integration processGroupContribution → group-contribution-payment

**Estado atual:** Passo 3-B CONCLUÍDO — 23/23 paths com concept_id.


DECISION-C2-010: 6 concepts commerce aprovados e seedados (b2b94526). 9 call sites commitados: payment-execution.service.ts (8c1521d9), transaction.service.ts (48c2d6e1 — concept_id opcional), financial-simulator.controller.ts (764739bf). Bloqueador 3-C atual: 4 callers do wrapper sem concept_id — distribution.service.ts, split.service.ts, social-work-payment.service.ts, test-currency.service.ts.

**Pendentes:**
- RFC: concepts para payment-execution.service.ts + transaction.service.ts
- Passo 3-C (tipo obrigatório no DTO) — BLOQUEADO por RFC
- Passo 5 (Gate CI zero NULLs)
- Passo 6 (ALTER COLUMN SET NOT NULL — fecha C2)

**Descobertas Deep Dive 2026-04-25:**
- Gates actor-writer-boundaries e bank-ledger-boundaries ausentes do CI (G1)
- E2E transversal ausente — fluxo evento→RFQ→settlement não testado (G2)
- trg_check_atl no banco cobre 100% INSERTs — ATL está protegido (positivo)
- Reconciliação financeira completa com 36 arquivos e worker dedicado (positivo)
- Padrão outbox garante eventos como consequência — enforcement sólido (positivo)

---

## Checkpoint 2026-04-26 — FASE 5 C2 Passo 3-B CONCLUÍDO

- Passo 3-B: 23/23 paths CONCLUÍDO (commit 8fa1f827)
- Passo 3-C: BLOQUEADO — RFC pendente (DECISION-C2-009)
- RFC mapeado: 8 concepts novos (estouaprendendo.md seção 22)
- C13 expandido: 84 arquivos (não 37) acessam bank_* fora do Bank
- 3 fail-opens críticos descobertos em bank-integration.service.ts (L145, L239, L334)
- Levantamento completo em estouaprendendo.md seções 22-23

## Checkpoint 2026-04-28 — C2 FECHADO

- **C2 FIXED:** migration `20260428210000_bank_transactions_concept_id_not_null.sql` aplicada.
- `bank_transactions.concept_id`: `is_nullable = NO` confirmado no banco.
- Gates 4/4 PASS: actor-writer OK, bank-ledger OK, regression-guards OK, architectural strict OK (critical_new=0).
- Total migrations: 271.
- **C2 encerrado após:** Passo 1 → Passo 2 → Passo 3-A → Passo 3-B → Passo 3-C → Passo 6.

Próxima ação: C63 FASE 2A — bloquear código morto (EmployeeService.ts e employee.routes.ts).

## Checkpoint 2026-04-28 — C63 FASE 2A CONCLUÍDA

- **C63 FASE 2A:** EmployeeService.ts e employee.routes.ts bloqueados com EmployeeLegacyError.
- Zero callers confirmados via grep completo no disco (employeeRoutes, EmployeeService, hireEmployee, terminateEmployee — todos zero resultados externos).
- WRITEs eliminados: hireEmployee (INSERT schedules L62) + terminateEmployee (UPDATE schedule_slots L128).
- Gates 4/4 PASS: actor-writer OK, bank-ledger OK, regression-guards OK, architectural strict OK (critical_new=0).
- C63 permanece IN_PROGRESS. Pendente: FASE 2B (migrar checkout-ticket.service.ts:127 — rota de produção ativa POST /api/checkout/event-ticket).
- FASE 2B exige RFC + análise arquitetural antes de qualquer patch (comportamento ativo, risco real).

## Checkpoint 2026-04-28 — C63 FASE 2B BLOCKED

- **C63 FASE 2B:** BLOCKED por incompatibilidade estrutural — DECISION-0015 registrada.
- 3 bloqueadores confirmados: transação (createBooking sem suporte a trx externo),
  schema (falta unified_booking_id em event_tickets), modelo (falta unified_availability_id em events).
- checkout-ticket.service.ts:127 (UPDATE schedule_slots) permanece ativo temporariamente
  com justificativa documentada em DECISION-0015.
- Próxima ação: RFC dedicado C63-FASE2B em docs/02_decisions/ (trilha separada da remediação).

## Estado final C63 — 2026-04-28

| WRITE path | Status |
|---|---|
| EventScheduleService.ensureEventSchedule | BLOQUEADO FASE 1 |
| EventScheduleService.generateEventSlots | BLOQUEADO FASE 1 |
| SlotGenerator.generateCompanySlots | BLOQUEADO FASE 1 |
| EmployeeService.hireEmployee | BLOQUEADO FASE 2A |
| EmployeeService.terminateEmployee | BLOQUEADO FASE 2A |
| checkout-ticket.service.ts:127 | BLOCKED — aguarda RFC (DECISION-0015) |

---

## Checkpoint 2026-04-29 — Entregas B e C concluídas (G1 fechado + RFC C63-FASE2B formal)

- **G1 FECHADO:** gates `validate:actor-writer-boundaries` e `validate:bank-ledger-boundaries`
  adicionados ao job `validate-backend` em `.github/workflows/ci.yml`.
  A partir de agora, qualquer PR que viole §4.8.1 (Identity) ou §4.6 (Bank boundary) é bloqueado automaticamente.
  Gates validados localmente: 4/4 PASS, critical_new=0, sem regressão.

- **RFC C63-FASE2B criado:** `docs/02_decisions/RFC_C63_FASE2B.md`
  3 bloqueadores estruturais documentados formalmente.
  Sequência de execução definida (Etapas 1-5).
  C63 permanece IN_PROGRESS com trilho formal.

- **DECISION-0015 registrada:** justificativa para manter WRITE em schedule_slots durante transição.
  Não legitima violação — reconhece estado transitório documentado.

- **Próxima ação:** Entrega D.1 — migration ADD COLUMN unified_availability_id em events
  e unified_booking_id em event_tickets (pré-condicional: verificar banco antes).

---

## Checkpoint 2026-04-29 — C63 FIXED (Entregas D.1–D.4 concluídas)

- **D.1 FIXED:** migration 20260530509000_add_unified_availability_columns.sql aplicada.
  Colunas unified_availability_id (events) e unified_booking_id (event_tickets) criadas no banco.
  4/4 gates verdes.

- **D.2 FIXED:** createBooking em unified-availability.repository.ts e unified-availability.service.ts
  extendidos com parâmetro trx opcional. tsc limpo. 4/4 gates verdes.

- **D.3 FIXED:** checkout-ticket.service.ts — bloco SELECT+UPDATE em schedule_slots removido.
  Substituído por fluxo canônico via unifiedAvailabilityService.createBooking(trx).
  tsc limpo. 4/4 gates verdes.

- **D.4 FIXED:** migration 20260428200000_schedules_revoke_write.sql aplicada.
  REVOKE INSERT, UPDATE em schedules e schedule_slots executado.
  PUBLIC sem privilégios de escrita confirmado. 4/4 gates verdes.

- **C63 STATUS: FIXED.** SSOT temporal único: unified_availability. schedules e schedule_slots
  são agora READ-ONLY para roles não-superuser. Sistema se protege por design.

- **Próxima ação:** C13 (bank boundary triagem) ou E2E transversal (G2).

---

## Checkpoint 2026-04-28 — WebAuthn Runtime Fix (C32, C33)

- **C32 FIXED:** tabela webauthn_credentials criada (9 colunas, RLS+FORCE, policy tenant_isolation).
- **C33 FIXED:** tabela webauthn_challenges criada (6 colunas, RLS+FORCE, policy tenant_isolation).
- Migration: 20260428220000_create_webauthn_tables.sql
- Erro 42P01 eliminado. Rotas /auth/webauthn/* deixam de retornar 500.
- Fallback WEBAUTHN_NOT_REGISTERED funcional. Step-up financeiro não explode por schema.
- Gates 4/4 PASS: actor-writer OK, bank-ledger OK, regression-guards OK, architectural strict OK (critical_new=0).
- Próxima ação: audit_events (C31) — mesmo padrão, tabela inexistente em serviço ativo.

## Checkpoint 2026-04-28 — Audit Runtime Fix (C31, C35)

- **C31 FIXED:** tabela audit_events criada (13 colunas: id, tenant_id, event_type, severity, actor_id, actor_type, company_id, employee_id, source, context, created_at, resolved_at, resolution_note).
- **C35 FIXED:** tabela partner_employees criada (4 colunas: id, tenant_id, partner_id, created_at).
- Migration: 20260428230000_create_audit_events.sql
- auditService.record() passa a gravar de verdade — antes falhava com 42P01.
- RLS+FORCE+policies de isolamento por tenant em ambas as tabelas.
- Gates 4/4 PASS: actor-writer OK, bank-ledger OK, regression-guards OK, architectural strict OK (critical_new=0).
- Próxima ação: category_ai_logs (C34) — mesmo padrão, uso com guard IF EXISTS.

## Checkpoint 2026-04-28 — category_ai_logs Runtime Fix (C34)

- **C34 FIXED:** tabela category_ai_logs criada (15 colunas).
- Migration: 20260428240000_create_category_ai_logs.sql
- Schema derivado do INSERT real: category_id, tenant_id, actor_id, global_user_id, input_type, original_text, sanitized_text, text_hash, audio_hash, audio_url, context, ai_suggestion, ai_confidence + id + created_at.
- ON CONFLICT (category_id) preservado via UNIQUE constraint.
- RLS+FORCE+policy tenant_isolation (tenant_id NULL-permitido para logs globais de IA).
- Gates 4/4 PASS: actor-writer OK, bank-ledger OK, regression-guards OK, architectural strict OK (critical_new=0).

## Estado final — Tabelas Fantasma (2026-04-28)

Todas as 5 tabelas fantasma eliminadas nesta sessão:

| Violação | Tabela | Migration |
|---|---|---|
| C31 | audit_events | 20260428230000 |
| C32 | webauthn_credentials | 20260428220000 |
| C33 | webauthn_challenges | 20260428220000 |
| C34 | category_ai_logs | 20260428240000 |
| C35 | partner_employees | 20260428230000 |

Próxima ação: fail-opens financeiros (bank-integration.service.ts L145, L239, L334) ou C13 (84 arquivos bank_* fora do bank).

## Checkpoint 2026-04-28 — Fail-opens Financeiros FIXED

- **5 fail-opens convertidos para fail-closed** em bank-integration.service.ts.
- Padrão anterior: erro técnico em bankLimitService → warn + continua transação (PERIGOSO).
- Padrão novo: erro técnico em bankLimitService → throw 503 LIMIT_SERVICE_UNAVAILABLE.
- Regra preservada: erro 403 (limite excedido) ainda re-throw corretamente.
- Métodos corrigidos:
  1. processEventTicketPayment (~L145)
  2. processEventConsumptionPayment (~L239)
  3. processServiceBookingPayment (~L334)
  4. processServicePaymentExecutionCanonical (~L452, tipagem unknown)
  5. processRidePayment (~L732)
- tsc: zero erros. Gates 4/4 PASS em cada commit. critical_new=0.
- Princípio aplicado: "Sem validação de limite, não existe operação financeira."

## Checkpoint 2026-04-28 — C18 FIXED (FORCE RLS em 29 tabelas)

- **C18 FIXED:** FORCE ROW LEVEL SECURITY aplicado em 29 tabelas de negócio.
- Migration: 20260428250000_force_rls_missing_tables.sql
- categories excluída corretamente: tabela global de ontologia (N0-N3) sem tenant_id.
  DISABLE RLS intencional em migration L4377 — sem tenant_id, RLS não se aplica.
- Guard pg_class.relforcerowsecurity=false funcionou corretamente — não aplicou FORCE onde RLS não está habilitado.
- Gates 4/4 PASS: actor-writer OK, bank-ledger OK, regression-guards OK, architectural strict OK (critical_new=0).
- Impacto: isolamento cross-tenant agora obrigatório no banco para 29 tabelas de negócio.
- Próxima ação: C11 (bookings.requestedat), C41 (timestamps sem _at), ou C13 (triagem bank_* boundaries).

## Checkpoint 2026-04-28 — C11 FIXED (bookings timestamps)

- **C11 FIXED:** 4 timestamps renomeados em bookings para padrão _at (§07 Nomenclatura).
- Migration: 20260428260000_bookings_fix_timestamp_names.sql
- Colunas: requestedat→requested_at, confirmedat→confirmed_at, cancelledat→cancelled_at, expiredat→expired_at.
- Colunas antigas ausentes confirmadas no banco. Gates 4/4 PASS. Total migrations: 276.
- Próxima ação: C41 (5 timestamps sem _at em outras tabelas) ou encerrar sessão.

## Checkpoint 2026-04-28 — C41 PARTIAL FIX (timestamps aspados)

- **C41 PARCIAL:** 3 timestamps aspados renomeados para padrão _at (§07 Nomenclatura).
- Migration: 20260428270000_fix_timestamp_names_aspados.sql
- Colunas: inventory_reservations.expiresAt→expires_at, fulfillment_orders.shippedAt→shipped_at, pdv_sessions.closedAt→closed_at.
- Colunas antigas ausentes confirmadas. Gates 4/4 PASS. Total migrations: 277.
- Pendente C41: event_attendees.check_in_time→checked_in_at (14 referências SQL ativas — migration + patch de código juntos na próxima sessão).

## Checkpoint 2026-04-28 — C41 FIXED COMPLETO (timestamps padronizados)

- **C41 FIXED:** event_attendees.check_in_time→checked_in_at. Código+banco sincronizados.
- Migration: 20260428280000_event_attendees_fix_check_in_time.sql
- Arquivos atualizados: events.service.ts (queries SQL + mappers) + events.types.ts (EventAttendeeRow).
- Ordem correta: código primeiro → tsc limpo → migration → validação banco → gates.
- checked_in_at confirmado no banco, check_in_time ausente. Gates 4/4 PASS. Total migrations: 278.
- C41 100% encerrado: todos os 5 timestamps padronizados (3 aspados + bookings 4 colunas + check_in_time).

## Checkpoint 2026-04-28 — C42 FIXED (booleanos prefixo canônico)

- **C42 FIXED:** migration 20260530410000_fix_boolean_prefixes.sql confirmada no banco.
- 6 colunas booleanas canônicas presentes, zero antigas. Padrão is_ aplicado em todas.
- Próxima ação: C29 (132 comparações status UPPERCASE) ou C13 (triagem bank_* boundaries).

## Checkpoint 2026-04-28 — Análise C22 + Regra Operacional Anti-Regressão

**C22 reclassificado (users.id + users.user_id):**
- Não é duplicidade problemática — é compatibilidade intencional documentada.
- CHECK (id = user_id) + trigger users_sync_id_user_id garantem sempre iguais.
- Comentário no código: "Permite INSERT só com id OU só com user_id (auth vs seeds)".
- Risco real seria id ≠ user_id — banco impede por constraint. Mecanismo de proteção ativo.
- Reclassificação: DECISION_PENDING → ALLOWLISTED (dívida controlada, sem ação necessária).

**Agravante C43 descoberto:**
- Tabela users tem 4 colunas de timestamp simultaneamente:
  "createdAt", "updatedAt" (aspados), created_at, updated_at (canônicos).
- Tabela de identidade central com timestamps duplicados confirma que C43 exige RFC antes de qualquer toque.

**REGRA OPERACIONAL ANTI-REGRESSÃO (vigente a partir de agora):**
Nenhum novo campo, tabela ou enum pode seguir padrão não canônico:
- status novos → lowercase obrigatório (ex: 'pending', não 'PENDING')
- colunas novas → snake_case sem aspas (ex: created_at, não "createdAt")
- booleanos novos → prefixo is_/has_/can_ obrigatório
- timestamps novos → sufixo _at obrigatório
- Proibido replicar padrão legado em código novo
Esta regra vige independentemente de RFC. Qualquer PR que viole → rejeitado.

**Pendências RFC formal:**
- RFC-C29: normalização de status (uppercase→lowercase, dual-write)
- RFC-C43: migração timestamps aspados→snake_case (dual-read/write, 16 tabelas)
- RFC-C13: triagem e mapa dos 84 arquivos bank_* (sessão dedicada)

## Checkpoint 2026-04-28 — Gate CI Nomenclatura Canônica §07

- **3 regras adicionadas** ao validate-architectural-patterns.mjs (experimental + WARNING).
- NO_CAMELCASE_COLUMN_DDL: detecta "createdAt" TIMESTAMP em DDL novo.
- NO_BOOLEAN_WITHOUT_PREFIX: detecta BOOLEAN sem is_/has_/can_ em migrations novas.
- NO_NEW_STATUS_UPPERCASE: detecta status === 'UPPERCASE' em código novo.
- Baseline gravado: 6323 chaves únicas (7202 ocorrências de legado congeladas).
- Estado após baseline: critical_new=0, warning_new=0, info_new=0 — exit 0.
- A partir de agora: qualquer código novo que viole §07 aparece como warning_new no CI.
- Legado existente não bloqueia — apenas código novo é barrado.
- Regra operacional vigente: nenhum novo campo, tabela ou enum pode seguir padrão não canônico.

## Checkpoint 2026-04-30 — G2 PIPELINE E2E TRANSVERSAL PASS

- **G2 FECHADO:** Pipeline E2E transversal validado com PASS completo.
- **Modo A causal:** A1-A10 todos verdes (RFQ -> Quote -> Accept -> PaymentRequest -> Execution -> Ledger -> Outbox).
- **Modo B falsificacoes:** Todas rejeitadas pelo runtime (B1, B2, B3, B5).
- **5 gaps de schema materializados via migrations:**
  - 20260530510000: bank_limit_change_requests
  - 20260530511000: bank_policies
  - 20260530512000: bank_transactions.metadata (coluna JSONB)
  - 20260530513000: authority_trust_levels
  - 20260530514000: service_payment_executions
- **Patch cirurgico:** bank-integration.service.ts:524-546 - slug 'ride-payment' -> UUID via SSOT semantico.
- **Seeds G2:** authority_roots + identities (kyc_status='approved', kyc_level='complete') adicionados ao script de validacao.
- **DECISION-0015 registrada:** REMEDIATION_DECISIONS_LOG.md.
- **Divida tecnica explicita:** 2a ocorrencia slug hardcoded (processRidePayment:910), amount vs amount_cents em service_payment_executions, tabelas auxiliares fail-open (system_notifications, business_audit_logs, authority_delegations).
- **Recomendacao pendente:** gate CI validate:repository-schema-coherence (compara *.repository.ts com schema real do banco).

## Proximas acoes (atualizado 2026-04-30)

1. Implementar gate validate:repository-schema-coherence (causa raiz G2 - DECISION-0015)
2. Corrigir 2a ocorrencia slug hardcoded em processRidePayment (bank-integration.service.ts:910)
3. Reconciliar violacoes OPEN no SYSTEM_REMEDIATION_STATUS.md (C36, C37, C29)
4. Nomenclatura EIXO 2-9 (PLANO_CORRECAO_NOMENCLATURA.md)
