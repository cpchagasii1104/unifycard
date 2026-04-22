# STATUS_EXECUCAO_GLOBAL.md

**GLOBAL BLOCK STATUS:** INATIVO — ver tabela «Estado global» abaixo (actualizar sempre que A1–A4 ou política de bloqueio mudarem). Referência rápida: **2026-04-14** (revisão documental anti-regressão).

**Função:** memória única de orquestração entre módulos — **não** substitui `STATUS_EXECUCAO.md` por plano nem §A de cada `PLANO_*.md`.  
**Regra:** actualizar após cada sessão que mude trilho, bloqueio ou conclusão de módulo.  
**Transições de estado:** só conforme **`PLANO_BASE_MODULO.md` §STATE_TRANSITION_RULES** (evidência SQL obrigatória para desbloqueios).

**Gate no repo:** `npm run validate:system-state` (coerência deste ficheiro + A1–A4 se `DATABASE_URL` e `pg` existirem). **A2** na BD segue `PLANO_IDENTITY_RECONCILIATION.md` §2.1 (actores humanos **elegíveis**: `is_identity_required = true`). Números concretos (ex.: último A2) devem constar do **log de execução** / evidência SQL colada — não substituem a leitura directa do precheck no ambiente alvo. `npm run validate:system-state:strict` falha com **§GLOBAL BLOCK ATIVO** sem `DATABASE_URL`; com BD, falha também se A1–A4 > 0 **ou** se A1–A4 = 0 mas o STATUS ainda não foi actualizado para **INATIVO** (STATUS desactualizado face à realidade).

**Última actualização:** 2026-04-21 (FASE 4 remediação — C1, C3, C4 FIXED, gates 4/4 PASS)

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
| **Core (tempo, eventos, base)** | EM EXECUÇÃO | — | FASE 4 em andamento (C1, C3, C4 FIXED 2026-04-21; complemento C45; gates 4/4 PASS) |
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

*Gerado como infraestrutura de execução contínua; não altera código.*
