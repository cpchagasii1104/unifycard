## 2026-05-05 — Triagem completa do working tree (rescue-structural)

**Snapshot inicial:** `8e9a4c93 docs(#019.FR)` — working tree com 1549 itens sujos
**Snapshot final:** `5bdeb746 ci(workflows)` — working tree com 1124 itens (425 limpos)
**Branch:** `rescue-structural`
**Modo:** GUARDIÃO + EXECUTOR pontual sob autorização explícita por commit
**Duração:** ~6 horas, sessão única
**Cobertura:** ~27% do working tree limpo (425 de 1549 itens)
**Commits da sessão:** 25 commits (ver tabela abaixo) + operações auxiliares (1 restore + 1 delete físico)

### Commits da sessão

| # | Hash | Conteúdo |
|---|---|---|
| 0 | `b29fc6a3` | docs(#019): nota operacional precedente |
| 1 | `db3eda65` | docs(normative): remove 13 arquivos obsoletos (.bak + timestamped + placeholder vazio) |
| 2 | `4e697077` | docs(ssot): consolida governanca em docs/01_normative/ + atualiza gates |
| 3 | `5b410c17` | fix(gitignore): converte UTF-16 LE -> UTF-8 + dumps de sessao |
| 4 | `4f066536` | fix(gitignore): restaura regra *.bak corrompida na conversao de encoding |
| 5 | `85dda33f` | chore(gitignore): exclui artefatos gerados em docs/ e residuos de execution_log |
| 6 | `341aea9d` | docs(audit): consolida auditorias em docs/04_audit/ (11 arquivos) |
| 7 | `5d3d3096` | docs(archive): preserva 6 documentos historicos em docs/99_archive/ |
| 8 | `8b663cc5` | docs(refs): corrige referencias canonicas em guias tecnicos e plano-mestre (9) |
| 9 | `a54a0ee0` | chore(gitignore): exclui docs/AUDITORIA_NORMATIVA_GERAL.txt (dump gerado) |
| 10 | `f27c368c` | docs(institucional): adiciona documentacao institucional pendente (18) |
| 11 | `0029d7a0` | feat(gates): adiciona 7 validators + execution-guard utilities (9) |
| 12 | `c7f2e908` | feat(docs-scripts): adiciona 8 validators de documentacao |
| 13 | `63cb0b3e` | feat(marketplace-analysis): adiciona 13 scripts de analise estatica |
| 14 | `46567e37` | feat(scripts): adiciona 3 utilitarios de analise |
| 15 | `644da100` | feat(contracts): adiciona vocabulario canonico compartilhado (2) |
| — | (restore) | backend/.cursor/rules/00_NORMATIVE_MANDATORY.md restaurado de HEAD |
| 16 | `b41de8d1` | docs(backend): atualiza README operacional do backend |
| 17 | `6e42407e` | chore(backend-gitignore): adiciona regras locais de ignore |
| — | (delete) | backend/tmp-fase3-actionctx.json removido fisicamente (lixo de teste) |
| 18 | `31b5e63d` | docs(logs): consolida logs de execucao acumulados (154) |
| 19 | `116fa226` | docs(normative): consolida governanca semantica e temporal (5) |
| 20 | `bda6e19f` | docs(normative): consolida governanca temporal (3) |
| 21 | `8963a321` | docs(normative): consolida governanca authority/protocol/core (15) |
| 22 | `86bd8680` | docs(normative): consolida restante da onda de governanca (72) |
| 23 | `cf36fb6e` | docs(normative): adiciona 22 novos normativos da onda de governanca |
| 24 | `c55d7c04` | docs(decisions): adiciona 22 RFCs e decisoes da onda de governanca |
| 25 | `5bdeb746` | ci(workflows): adiciona 6 workflows de gates e auditorias |

### Onda de governança normativa consolidada (117 arquivos em 6 commits)

Marco institucional: trabalho documental de meses de governança que estava pendurado foi formalmente registrado como baseline canônico vigente. **Esta consolidação não constitui revisão ou aprovação formal de cada documento individualmente — registra como vigente o que já era praticado operacionalmente.** Revisões redacionais/aprovações específicas seguem como sessões dedicadas (ver DTs).

- **5 normativos centrais** (`116fa226`): SSOT_REGISTRY_UNIFICARD, LEIS_OPERACIONAIS_UNIFICARD, CORE_IMUTAVEL, LEGADO_TEMPORAL_MIGRATION_PLAN, PROHIBITED_STRUCTURES
- **3 temporais** (`bda6e19f`): CORE_TEMPORAL_CONTRACT, CORE_TEMPORAL_HARDENING_CONTRACT, AGENDA_UNIVERSAL_CONTRACT
- **15 authority/protocol/core** (`8963a321`): 00_AGENT_PROTOCOL, AUTHORITY_LAW + anexos, CONSTITUICAO, IDENTITY_CORE, MAPA_CANONICO_PERMISSIONS, série CORE_*_CANONICO
- **72 normativos finais** (`86bd8680`): category, SSOT base, contratos, governança, observabilidade, frontend, regras canônicas, com referências cruzadas auto-geradas
- **22 normativos novos** (`cf36fb6e`): índices estruturais (00_AGENT, 00_INDEX, 00_SUMARIO), continuação da série numerada (18, 19, 20), novas leis (LEI_DE_COERENCIA, BANK_DOMAIN_RULES, IDENTITY_SSOT_PRECEDENCE, VOCABULARIO_CANONICO)
- **22 decisões e RFCs** (`c55d7c04`): registros de decisão + 4 RFCs em estado RASCUNHO declarado

### Achados técnicos resolvidos durante a sessão

- **`.gitignore` raiz quebrado há 3 meses (UTF-16 LE):** desde commit `70579227 [REBASE-03]` (2026-02-11) até `5b410c17` desta sessão. Nenhuma regra do `.gitignore` raiz estava sendo aplicada por 3 meses. Outras regras só funcionavam por `backend/.gitignore` e `frontend/.gitignore`.
- **Mojibake na conversão UTF-16 → UTF-8:** corrigido em `4f066536` com restauração da regra `*.bak`.

### Débitos técnicos abertos (pendentes de sessão dedicada)

| ID | Descrição | Severidade | Origem |
|---|---|---|---|
| **DT-build-alias** | `tsc-alias` removido do build em `70579227 [REBASE-03]`; `dist/` emite 1464 imports não resolvidos; `pnpm build` PASS mas `pnpm start` quebraria | Alta | Pré-existente, identificado em A.1 |
| **DT-packages-artifacts-tracked** | 157 arquivos rastreados indevidamente em `packages/contracts/{dist,node_modules,tsconfig.tsbuildinfo}` desde commit `2a849424`. Requer `git rm --cached` + `.gitignore` + auditoria de consumers | Alta | A.5.7 |
| **DT-nomenclatura-canonica-v3-revisao** | Documento canônico `docs/01_normative/07_NOMENCLATURA_CANONICA.md` contém trecho propositivo ("Sugiro adicionar Parte VI..."), violando separação entre norma vigente e proposta. Diff modificado v2.0→v3.3.6 (+4884/-1120). Requer revisão redacional dedicada para separar material vigente de propositivo antes de aceitar como canônico | Crítica | A.5.5.c.1 |
| **DT-migrations-resetadas-decisao** | `backend/migrations-resetadas/` (10 arquivos) untracked. Decidir entre archive em `docs/99_archive/`, manter como referência, ou deletar | Média | A.5.8 |
| **DT-seed-035-tenant-id-rename** | `backend/seeds/035_seed_demo_city_nova_beauty.sql` modificado troca `tenant_id` por `id` em `tenants`. Validar contra schema vivo antes de commit | Alta | A.5.8 |
| **DT-stashes-revisao** | 4 stashes preservados sem inspeção profunda (`local-before-rescue`, frontend/docs, backend/dist+marketplace, migrations+plano) | Baixa | A.6.1 |
| **DT-archive-ps1-quarentena** | 10 scripts `.ps1` em `docs/99_archive/` (`restore-*`, `tmp-*`, `fix-*`, `debug-*`) mantidos untracked; decidir caso a caso | Baixa | A.5.3.c |
| **DT-baseline-architectural-patterns-congelado** | `scripts/architectural-patterns-baseline.json` modificado, congelado por afetar gate ativo. Sessão dedicada de validação de gates necessária | Média | A.5.6.1 |

### Estado dos clusters do working tree

**Fechados nesta sessão:**
- `docs/01_normative/` (deletados, modificados, novos) — exceto `07_NOMENCLATURA`
- `docs/02_decisions/` (untracked)
- `docs/ssot/` (modificados + 2 deletados consolidados)
- `docs/03_execution_log/` (lote único de logs institucionais)
- `docs/04_audit/`, `docs/99_archive/` 6 docs históricos
- `docs/architecture/`, `docs/diagrams/`, `docs/runbooks/`, outros institucionais
- `scripts/` (32 scripts em 4 commits temáticos)
- `packages/contracts/src/` (vocabulário canônico)
- `backend/.gitignore`, `backend/README.md`
- `.github/workflows/` (6 workflows de gates)

**Bloqueados intencionalmente (regra B4 e correlatas):**
- `backend/src/*` (~545 arquivos modificados — código de produção)
- `frontend/src/*` (44 arquivos modificados)
- `backend/{BOOT.ts, package.json, tsconfigs, jest.config}` — configs build/test
- `packages/contracts/{dist,node_modules,tsconfig.tsbuildinfo}` (DT-packages-artifacts-tracked)

### Validação contínua

- 4 gates rodaram após cada um dos 25 commits — todos PASS
- `CORE_PURITY_SUMMARY` permaneceu inalterado: `total=1278 modules_import=68 fastify_http=319 sql_direct=891`
- Nenhuma regressão arquitetural detectada nos 25 commits (4 gates PASS)

### Princípios operacionais validados

- **Atomicidade:** uma alteração → build → 4 gates → commit → próxima
- **Sanity checks no script de execução:** abortar antes de stagear se contagem/escopo divergir
- **Modo cirúrgico em anomalias:** qualquer surpresa parou fast track e voltou a validação detalhada
- **DT formal sobre commit cego:** quando dúvida institucional, abrir débito documentado em vez de commitar
- **Versionamento de RFCs em rascunho declarado:** prática padrão da indústria, distingue proposta de norma vigente

### Próximos passos sugeridos (sessões futuras)

1. **Sessão 2 do PLANO_MESTRE_remediacao_core_modules:** C66 (concept_id slug→UUID) com working tree limpo
2. **Sessão DT-nomenclatura-canonica-v3-revisao:** revisão redacional do arquivo 07
3. **Sessão DT-build-alias:** restaurar `tsc-alias` no build
4. **Sessão DT-packages-artifacts-tracked:** `git rm --cached` + `.gitignore` + auditoria de consumers
5. **Sessão DT-stashes-revisao:** decidir destino dos 4 stashes preservados

---

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

## 2026-05-05 — Validação final da sessão

Gates CI finais (4/4 PASS):
- validate:actor-writer-boundaries → PASS
- validate:bank-ledger-boundaries → PASS
- validate:regression-guards → PASS
- validate-architectural-patterns --strict → PASS (0 novas violações, exit 0)

Commits da sessão 2026-05-05:
- 65a0f754 — código latente classificado, registry criado
- d8998997 — gate validate-core-purity fase 1
- a38f636e — caminho documental corrigido no gate
- 56342d84 — gate estendido para imports dinâmicos (69)
- 1e925deb — baseline oficial registrado no STATUS
- bdb12e6c — rotas /event e /account retornam 501
- 7c6448f2 — sub-hipótese #019.FR registrada
- c3cf0117 — decisões de implementação do ReadPort registradas
- 5a4d5dba — BankTransactionReadPort implementado (7 passos)
- 451e8784 — STATUS atualizado com entrega #019.FR
- 182d85c5 — sub-hipótese marcada como EXECUTADO

Próximas ações (atualizado 2026-05-05):
1. Classificar os 68 sinais restantes de modules_import — começar por core/economy/
2. Decidir destino das rotas 501: /economy/transactions/event e /account (produto vivo ou legado?)
3. Resolver 4 callers do wrapper sem concept_id: distribution.service.ts, split.service.ts, social-work-payment.service.ts, test-currency.service.ts
4. Gate fase 2 — warning CI quando modules_import aumentar
5. Domínios duplicados: core/events ↔ modules/events, core/reporting vs modules/reports

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



DAQUI PARA BAIXO É O CONTEUDO DO STATUS DE EXECUÇÃO QUE É UM DOCUMENTO QUE ESTAVA EM PARALELO:

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


## 2026-05-06 — Retificação de causalidade da DT-build-alias (D3=α)

**Sessão:** DT-build-alias (rescue-structural, HEAD pré-sessão `c0ac7a89`)
**Tipo:** retificação documental

### O que o canônico afirmava

O bloco de 2026-05-05 atribuiu a remoção do `tsc-alias` do script `build` ao commit `70579227 [REBASE-03]` (2026-02-11), o mesmo commit que corrompeu o `.gitignore` raiz para UTF-16 LE.

### O que a evidência mostrou

Verificação direta em `git show` durante a sessão DT-build-alias:

- `git show 70579227^:backend/package.json` → `tsc-alias` PRESENTE
- `git show 70579227:backend/package.json` → `tsc-alias` PRESENTE
- HEAD `c0ac7a89` → `tsc-alias` PRESENTE
- Working tree em 06/05/2026 → `tsc-alias` AUSENTE

A remoção não está em commit nenhum. Está como modificação não-commitada no working tree, com `LastWriteTime 30/04/2026 23:17:22`, sem rastro em `git log`.

### Causalidade correta

O commit `70579227 [REBASE-03]` permanece responsável apenas pela corrupção do `.gitignore` raiz (já remediada em `5b410c17`). A remoção do `tsc-alias` é evento separado, contemporâneo, em arquivo congelado por regra B4.

### Reformulação posterior

Diagnóstico subsequente (mesma sessão, registrado em bloco separado abaixo) revelou que a remoção da linha foi sintoma de problema mais profundo: instalação `tsc-alias`/`get-tsconfig` quebrada no store pnpm. A DT-build-alias foi encerrada por D6=β e DT sucessora `DT-tsc-alias-broken-install` foi aberta.

### Estado do canônico

O bloco de 2026-05-05 permanece intacto (append-only); fica preservado como registro do diagnóstico inicial. Esta retificação é a fonte autoritativa sobre a causalidade real.

## 2026-05-06 — Sessão DT-build-alias: encerrada por reformulação de causa raiz (D6=β)

**Branch:** `rescue-structural`
**HEAD pré-sessão:** `c0ac7a89`
**Modo:** GUARDIÃO + EXECUTOR pontual sob autorização explícita
**Escopo final:** encerramento por invalidação da premissa (D6=β)

### Trajetória da sessão

A sessão foi aberta para tratar DT-build-alias conforme registrada no bloco de 2026-05-05: restaurar `tsc-alias -p tsconfig.build.json` no script `build` do `backend/package.json`, atribuída ao commit `70579227 [REBASE-03]`.

A investigação revelou três achados sequenciais que reformularam a sessão:

1. **Retificação de causalidade** (registrada em bloco separado): a remoção do `tsc-alias` não estava em commit nenhum. Estava no working tree atual, com `LastWriteTime 30/04/2026 23:17:22`.

2. **Cirurgia 2.A (executada, sem commit)**: linha do `build` foi reescrita para o valor de HEAD. Como o resultado coincide exatamente com HEAD, o diff contra HEAD na linha desapareceu — não há delta commitável a partir desta cirurgia.

3. **Validação 2.B falhou em B1 e B2 (bloqueantes)**: `pnpm build` retornou exit code 1; 109 imports literais `@core/`/`@modules/` em `dist/` (esperado: 0).

4. **Diagnóstico D1 isolou a causa raiz**: `tsc-alias@1.8.16` falha em `require('get-tsconfig')` — `MODULE_NOT_FOUND`. O pacote `tsc-alias` está fisicamente presente em `node_modules/.pnpm/tsc-alias@1.8.16/...`, mas a dependência transitiva `get-tsconfig` não está acessível.

### Causa raiz registrada (evidência D1)

A formulação original da DT-build-alias está invalidada. A nova formulação correta:

> Instalação `tsc-alias` no store pnpm está inconsistente — dependência transitiva `get-tsconfig` ausente. Build falha independentemente da presença de `tsc-alias` no script `build`.

A remoção da linha do `build` em 30/04/2026 passa a ser leitura provável (não-provada) de **compensação consciente**: removendo a invocação de `tsc-alias`, o build retorna verde — ao custo de produzir `dist/` com aliases literais não resolvidos.

**Importante (separação correlação ≠ causalidade):** a hipótese de "compensação consciente" é a leitura mais consistente com a evidência disponível, mas não está provada.

### Status do build "verde" pré-2.A

Antes da cirurgia 2.A, `pnpm build` retornava exit 0 porque o script `build` chamava apenas `tsc -p tsconfig.build.json` (sem `tsc-alias`). Esse "verde" era falso positivo operacional: o TypeScript compilava com sucesso, mas o `dist/` resultante continha imports literais `@core/`/`@modules/` que `node` não consegue resolver em runtime.

A cirurgia 2.A reintroduziu o `tsc-alias` no script, expondo a quebra real. O build vermelho atual é sintoma honesto, não regressão. Não há decisão nesta sessão sobre reverter 2.A (D7=γ).

### DTs sucessoras formalmente abertas

1. **DT-tsc-alias-broken-install** (NOVA, prioridade Alta): investigar e remediar a instalação `tsc-alias`/`get-tsconfig` no store pnpm; decidir destino da cirurgia 2.A.

2. **DT-configs-b4-modificados-auditoria** (já registrada): auditoria diff-por-arquivo dos 5 configs B4 em `backend/`. Recomendação: rodar após DT-tsc-alias-broken-install fechar.

### Estado pós-sessão

- HEAD: `ca6cee70` (3 commits documentais nesta sessão: cf84f661, ca6cee70, e este)
- Working tree: `backend/package.json` modificado (linha `build` agora coincidente com HEAD; outras 78+/-2 linhas dirty pré-existentes preservadas)
- Working tree: `backend/tsconfig.build.json` e `backend/tsconfig.json` modificados, sem investigação adicional
- `dist/`: incoerente (mosaico de compilações entre 03/20 e 05/06), com 109 aliases literais residuais
- Build: vermelho (sintoma da DT sucessora)

### Decisões institucionais

- **D6=β**: encerrar DT-build-alias por reformulação de causa raiz
- **D7=γ**: não decidir sobre reverter cirurgia 2.A nesta sessão
- **D8=γ**: não fazer mais diagnóstico nesta sessão; abrir DT sucessora dedicada
- **D9=α**: backlog operacional autorizado (incorporado em cf84f661)

## 2026-05-06 — Nota de governança: regra B4 e modificações em arquivos congelados

**Origem:** descoberta colateral durante DT-build-alias.

### Achado primário

Cinco arquivos congelados por regra B4 estão modificados no working tree sem decisão formal documentada:

- `backend/BOOT.ts`
- `backend/jest.config.mjs`
- `backend/package.json`
- `backend/tsconfig.build.json`
- `backend/tsconfig.json`

A sessão de triagem 2026-05-05 listou os arquivos como "bloqueados intencionalmente" mas não auditou o conteúdo do diff — apenas registrou que estavam modificados. Logo, a presença das modificações não foi violação detectada pela triagem; foi conformidade aparente com regra B4 ("não commitar"), apesar do conteúdo das modificações nunca ter sido revisado.

### Achado secundário (caráter da modificação)

A modificação em `backend/package.json` tem caráter específico: remoção dirigida de uma única linha (`tsc-alias` em `scripts.build`), em arquivo congelado, contra HEAD. Não foi corrupção genérica nem replace acidental. Foi alteração cirúrgica.

Quando combinada com a modificação posterior em `tsconfig.build.json` (04/08) e `tsconfig.json` (04/20), o padrão sugere alterações incrementais ao longo de ~22 dias, possivelmente em resposta a problemas operacionais sucessivos. Diagnóstico D1 da mesma sessão revelou um problema operacional plausível: `tsc-alias` quebrado por dependência transitiva ausente (`get-tsconfig`).

**Caveat:** a leitura "alterações como compensação operacional" é hipótese consistente com evidência, não causalidade provada. A identidade de quem editou cada arquivo permanece desconhecida.

### Implicações para governança

1. **Regra B4 precisa de gate de conteúdo, não só de presença.** "Bloqueado para commit" não é equivalente a "intocado". Diff silencioso em arquivo B4 não é detectado pela regra atual.

2. **Auditorias de working tree em sessões futuras devem inspecionar diff dos arquivos B4 modificados**, mesmo quando bloqueados para commit. Sugestão: adicionar ao checklist de entrada §9 do boot protocol algo como `git diff -- backend/BOOT.ts backend/jest.config.mjs backend/package.json backend/tsconfig.build.json backend/tsconfig.json` sem ação automática, apenas para visibilidade ao orchestrator.

3. **Distinção entre "modificação fantasma" e "compensação não documentada"** é importante para framing futuro. Sem evidência de identidade/intenção, nenhuma das duas leituras pode ser tomada como fato. Ambas devem ser tratadas como hipóteses até evidência adicional.

4. **Executores (Codex/Cursor/Copilot) devem ter escopo de escrita explicitamente declarado antes de cada operação**; modificações espontâneas em arquivos B4 violam a metodologia.

### Observações operacionais (ambiente Codex)

Durante a sessão, anomalias operacionais recorrentes foram documentadas:

1. `pnpm` ausente do PATH em sessões Codex desta máquina
2. `Permission denied` em `.config/git/ignore` e em `.git/index.lock` (impede commits via Codex)
3. Pager `less` ativo em comandos `git` por padrão

Nenhuma afeta o estado do repositório, mas todas duplicam trabalho do orchestrator. Implicação prática: nesta sessão, todos os 4 commits documentais foram feitos via PowerShell externo, não Codex. Decisão futura sobre `DT-codex-env` fica em aberto.

### Aprendizado metodológico (Claude web)

A sessão revelou padrão de excesso de cerimônia no auditor (Claude): decisões artificiais α/β/γ multiplicadas, salvaguardas redundantes, recapitulações repetidas, transformação de cada anomalia ambiental em evento institucional. Para uma DT cuja remediação técnica final foi de 1 linha + 4 commits documentais, a sessão consumiu horas de mensagens. Calibração para sessões futuras: blocos PowerShell diretos, decisões pequenas tomadas pelo auditor sem consulta, validação em 3 linhas, não em parágrafos.

### Ação tomada nesta sessão

- Retificação documental D3=α aplicada (commit ca6cee70).
- DT-build-alias encerrada por reformulação de causa raiz (D6=β, commit 714affa2).
- DTs sucessoras abertas: `DT-tsc-alias-broken-install` (Alta) e `DT-configs-b4-modificados-auditoria` (já registrada).
- Backlog append-only autorizado incorporado (D9=α, commit cf84f661).
- Nenhuma escrita em código nesta sessão (cirurgia 2.A produziu arquivo coincidente com HEAD; nenhum delta commitável).

## 2026-05-06 — Sessão DT-tsc-alias-broken-install: diagnóstico concluído, remediação adiada

**Branch:** `rescue-structural`
**HEAD pré-sessão:** `896a8f47`
**Modo:** EXECUTOR pontual read-only + 1 experimento não-destrutivo
**Escopo final:** diagnóstico apenas; remediação adiada para sessão dedicada

### Causa raiz refinada (vs hipótese inicial)

Hipótese inicial (registrada no fechamento da DT-build-alias): instalação `tsc-alias`/`get-tsconfig` quebrada no store pnpm. **Confirmada e refinada.**

Achados:

1. **As 7 dependências de `tsc-alias` estão marcadas como `.ignored_*`** em `node_modules/.pnpm/tsc-alias@1.8.16/node_modules/`: `chokidar`, `commander`, `get-tsconfig`, `globby`, `mylas`, `normalize-path`, `plimit-lit`. Não é problema de uma dependência ausente; é o pacote inteiro com seu hoisting quebrado.

2. **`pnpm install --frozen-lockfile`** sobre o lockfile dirty atual reportou "Already up to date" — não reconcilia. O estado `.ignored_*` persiste.

3. **`pnpm install --frozen-lockfile`** sobre o lockfile commitado em HEAD (após `git stash` do dirty + `git checkout HEAD --`) **falhou** com `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`: o lockfile commitado não é compatível com a `pnpm.overrides.jest-util: 29.7.0` presente no `package.json`.

4. **Implicação:** o lockfile dirty (4731 deltas) **não é a causa** do estado `.ignored_*`. Ele é a **tentativa anterior** (não-commitada) de reconciliar o `package.json` com a override de `jest-util`. O estado `.ignored_*` é anterior e tem outra causa, ainda não identificada.

### Estado da `pnpm.overrides`

`package.json` (arquivo congelado por regra B4) contém:

```
"pnpm": {
  "overrides": {
    "jest-util": "29.7.0"
  }
}
```

Esta override **não** está refletida no lockfile commitado em HEAD `c0ac7a89`. Não há decisão formal documentada sobre quando/por que foi adicionada. Compatível com o padrão dos outros 5 configs B4: modificação não-rastreada em arquivo congelado.

### Caminhos de remediação avaliados (não executados)

- **R1.α** — Restaurar lockfile dirty e adiar: **escolhido**. Lei §1 já esticada (~14h de sessão acumulada com DT-build-alias).
- **R1.β** — Remover `pnpm.overrides.jest-util` temporariamente: rejeitado (toca arquivo B4).
- **R1.γ** — `pnpm install --no-frozen-lockfile`: adiado para sessão dedicada (reescreve lockfile).

### Estado pós-sessão

- HEAD: `896a8f47` (inalterado)
- `pnpm-lock.yaml`: dirty (deltas restaurados via stash pop, idênticos ao estado pré-sessão)
- `node_modules/.pnpm/tsc-alias@1.8.16/node_modules/`: 7 dependências `.ignored_*` (estado anômalo persiste)
- Build: vermelho (estado herdado da DT-build-alias)
- Cirurgia 2.A em `backend/package.json`: preservada (D7=γ continua adiado)

### DT sucessora

`DT-tsc-alias-broken-install` permanece aberta. Próxima sessão:

1. Investigar por que pnpm marca as 7 dependências como `.ignored_*` mesmo com `tsc-alias` em `devDependencies` legítimo.
2. Decidir entre `pnpm install --no-frozen-lockfile` (reescrever lockfile) ou abordagem cirúrgica (remover/reinstalar `tsc-alias` apenas).
3. Considerar `pnpm.overrides.jest-util` no escopo: a override é causa raiz ou efeito colateral?

### Achado adicional para `DT-configs-b4-modificados-auditoria`

`pnpm.overrides` no `package.json` é decisão arquitetural não documentada. Quando essa DT rodar, este item entra na lista.