# REMEDIATION DECISIONS LOG

**Documento append-only. Toda decisão arquitetural tomada durante a remediação é registrada aqui.**
**Uma decisão registrada nunca é editada. Se superada, adicionar nova entrada referenciando a anterior.**

| Metadado | Valor |
|---|---|
| Criado | 2026-04-21 |
| Última entrada | DECISION-0151 (2026-06-23) |
| Base normativa | `SYSTEM_REMEDIATION_PLAN.md` v1.0 |
| Arquivo relacionado | `SYSTEM_REMEDIATION_STATUS.md` (vivo) |

---

## Objetivo deste documento

Registrar permanentemente toda decisão que envolva:

1. Escolha arquitetural entre alternativas concorrentes (qual tabela de produto é SSOT, qual sistema de autorização sobrevive, etc.)
2. Ajuste no gate que impacte métricas anti-regressão (Seção 7 do PLAN)
3. Padrão de falso-positivo identificado + ajuste no script (Seção 6 do PLAN, limiar 3-5 FP)
4. Justificativa de desvio > 10% em baseline numérico do gate
5. Superação de uma versão do PLAN por outra (raríssimo, última instância)
6. Qualquer decisão que uma IA futura precise conhecer para não reabrir discussão

**Decisões fora deste log não existem.** Se não está aqui, não foi decidido.

---

## Formato obrigatório de cada entrada

```markdown
### DECISION-NNNN — <título curto e descritivo>

- **Data:** YYYY-MM-DD
- **Tipo:** <arquitetural | ajuste_gate | falso_positivo | desvio_baseline | superacao_plan | outro>
- **ID da violação (se aplicável):** Cxx
- **Contexto:** 
  (descrição do problema e por que exige decisão registrada)
- **Opções consideradas:**
  1. Opção A — descrição, prós, contras
  2. Opção B — descrição, prós, contras
  3. Opção C — descrição, prós, contras
- **Escolha:** Opção N
- **Justificativa:** 
  (por que essa opção vence; que invariante preserva; que risco aceita)
- **Consequências esperadas:**
  - Curto prazo: ...
  - Médio prazo: ...
- **Responsável:** <nome>
- **Validação prévia:** <quem revisou antes da decisão> (ChatGPT / Claude / Clayton / outro)
- **Supera:** DECISION-NNNN (se aplicável, senão "nenhuma")
- **Superada por:** (preencher apenas quando superada por entrada posterior)
- **Referências:** (links, linhas de código, migrations, arquivos SRC_FULL)
```

## Regras de integridade

- **Numeração sequencial** contínua. `DECISION-0001`, `DECISION-0002`, nunca pular.
- **Data no formato ISO** `YYYY-MM-DD`.
- **Nunca editar decisão registrada.** Se informação precisa mudar, nova entrada com `Supera: DECISION-NNNN` e a entrada antiga ganha `Superada por: DECISION-MMMM`.
- **Toda decisão que afeta Status.** Atualizar `SYSTEM_REMEDIATION_STATUS.md` no mesmo commit que registra a decisão.
- **Commit padronizado:** `"decisions: DECISION-NNNN <título>"`.

---

## Registros

### DECISION-C2-009: Levantamento completo para RFC — 8 concepts propostos
- **Data:** 2026-04-26
- **Decisão:** Levantamento técnico completo dos 9 call sites bloqueadores documentado em estouaprendendo.md seções 22-23.
- **Call sites mapeados (9 total):**
  | # | Arquivo | Linha | Função | referenceType | concept_id proposto |
  |---|---------|-------|--------|---------------|---------------------|
  | 1 | payment-execution.service.ts | 434 | executePayment | (sem) | marketplace-escrow-payment |
  | 2 | payment-execution.service.ts | 951 | settlePaymentToSeller | settlement | marketplace-settlement-escrow-to-clearing |
  | 3 | payment-execution.service.ts | 967 | settlePaymentToSeller | seller_settlement | marketplace-settlement-clearing-to-seller |
  | 4 | payment-execution.service.ts | 1046 | releaseSellerFunds | dispute_release | marketplace-funds-release |
  | 5 | payment-execution.service.ts | 1144 | requestSellerPayout | payout_request | seller-payout-request |
  | 6 | payment-execution.service.ts | 1212 | confirmBankPayout | bank_payout | seller-payout-bank-settlement |
  | 7 | transaction.service.ts | 36 | transfer | (dinâmico) | N/A — callers definem |
  | 8 | financial-simulator.controller.ts | 113 | POST /simulate-payment | simulation_deposit | test-simulation-deposit |
  | 9 | financial-simulator.controller.ts | 127 | POST /simulate-payment | simulation_payment | test-simulation-payment |
- **Concepts propostos para RFC:**
  - Domínio commerce (6): marketplace-escrow-payment, marketplace-settlement-escrow-to-clearing, marketplace-settlement-clearing-to-seller, marketplace-funds-release, seller-payout-request, seller-payout-bank-settlement
  - Domínio devtools (2): test-simulation-deposit, test-simulation-payment
- **Observação transaction.service.ts:** wrapper legado; concept_id vem do caller (PROPAGATED). Não requer concept próprio.
- **Referência:** estouaprendendo.md seção 22 (detalhamento completo com contexto de código)
- **Próxima ação:** Criar RFC formal com os 8 concepts propostos.

---

### DECISION-C2-010: 6 concepts commerce aprovados por Clayton

- **Data:** 2026-04-27
- **Tipo:** arquitetural
- **ID da violação:** C2
- **Contexto:**
  DECISION-C2-009 levantou 9 call sites bloqueadores para 3-C. Desses, 6 são caminhos de produto em payment-execution.service.ts que requerem concepts novos. 2 são simulador dev (já existem concepts system-reserve-credit e escrow-hold na seed atual). 1 é wrapper (PROPAGATED).

  Clayton aprovou 6 concepts para os caminhos de produto em 2026-04-27.

- **Concepts aprovados (6):**
  | slug | domain_key | Uso |
  |------|------------|-----|
  | marketplace-escrow-payment | financeiro-payment | executePayment L434 |
  | marketplace-settlement-escrow-to-clearing | financeiro-escrow | settlePaymentToSeller L951 |
  | marketplace-settlement-clearing-to-seller | financeiro-payout | settlePaymentToSeller L967 |
  | marketplace-funds-release | financeiro-payout | releaseSellerFunds L1046 |
  | seller-payout-request | financeiro-payout | requestSellerPayout L1144 |
  | seller-payout-bank-settlement | financeiro-gateway | confirmBankPayout L1212 |

- **Observação financial-simulator.controller.ts:**
  Linhas 113 e 127 usam concepts já existentes na seed (system-reserve-credit, escrow-hold).
  Não requerem novos concepts.

- **Observação transaction.service.ts:**
  Wrapper legado (L36). concept_id vem do caller (PROPAGATED). Não requer concept próprio.

- **Escolha:** Criar migration seed com os 6 concepts + atualizar os 9 call sites.

- **Justificativa:**
  Concepts seguem o padrão da seed existente (slug kebab-case, domain_key existente).
  Domínios financeiro-* já existem na tabela domains.
  Após seed + propagação, 3-C pode prosseguir (remover | undefined do DTO).

- **Plano de execução:**
  1. Verificar domínios existentes (financeiro-payment, financeiro-escrow, financeiro-payout, financeiro-gateway)
  2. Criar migration seed com os 6 concepts
  3. Atualizar payment-execution.service.ts (6 paths)
  4. Atualizar financial-simulator.controller.ts (2 paths com concepts existentes)
  5. Verificar transaction.service.ts (PROPAGATED)
  6. Passo 3-C: remover | undefined
  7. Passo 5: Gate CI
  8. Passo 6: ALTER NOT NULL

- **Consequências esperadas:**
  - Curto prazo: 9 call sites com concept_id, 3-C desbloqueado
  - Médio prazo: C2 FIXED, concept_id NOT NULL em bank_transactions

- **Responsável:** Clayton
- **Validação prévia:** Claude Opus 4.5
- **Supera:** nenhuma
- **Referências:**
  - DECISION-C2-009 (levantamento técnico)
  - backend/src/modules/marketplace/payment-execution.service.ts
  - backend/src/modules/devtools/financial-simulator.controller.ts
  - backend/src/core/economy/transaction.service.ts

---

### DECISION-C2-011: bank-integration.service.ts L871 → ride-payment

- **Data:** 2026-04-28
- **Tipo:** arquitetural
- **ID da violação:** C2
- **Contexto:**
  Passo 3-C (tornar concept_id obrigatório nos tipos) propagou erro para bank-integration.service.ts:871 (método processRidePayment). Mesmo arquivo já usa 'ride-payment' em L513 (processServicePayment para rides). Ambos os métodos processam pagamentos de corrida com split automático.

- **Opções consideradas:**
  1. Usar 'ride-payment' (consistência com L513)
  2. Criar concept novo específico para processRidePayment
  3. Usar concept genérico de pagamento

- **Escolha:** Opção 1 — 'ride-payment'

- **Justificativa:**
  Mesma função/natureza econômica que L513. Ambos processam pagamento de corrida (passenger → driver + fees + splits). Usar o mesmo concept mantém consistência semântica e evita proliferação desnecessária de concepts.

- **Consequências esperadas:**
  - Curto prazo: L871 compilando, 'ride-payment' consolidado como concept canônico para pagamentos de ride
  - Médio prazo: Queries analytics podem filtrar todos os ride payments por um único concept_id

- **Responsável:** Clayton
- **Validação prévia:** Claude Sonnet 4.5
- **Supera:** nenhuma
- **Referências:**
  - backend/src/modules/bank/bank-integration.service.ts:513, 871
  - Commit: acc233c5

---

### DECISION-C2-012: backfill-payment-splits-to-bank.ts → service-booking-payment

- **Data:** 2026-04-28
- **Tipo:** arquitetural
- **ID da violação:** C2
- **Contexto:**
  Passo 3-C propagou erro para backfill-payment-splits-to-bank.ts:256. Script de backfill histórico migra payment_splits (tabela legada) para UnifyBank. Contexto: metadata.backfill: true, referenceType: 'service_payment_execution'. Não é emissão de moeda nova nem operação em tempo real.

- **Opções consideradas:**
  1. Usar 'service-booking-payment' (natureza econômica original dos dados)
  2. Criar concept específico para backfill (ex: 'backfill-service-payment')
  3. Usar 'system-reserve-credit' (emissão)

- **Escolha:** Opção 1 — 'service-booking-payment'

- **Justificativa:**
  Reflete natureza econômica ORIGINAL dos dados (pagamento de serviço executado). metadata.backfill: true já distingue em queries. Usar concept de emissão (opção 3) seria semanticamente incorreto. Criar concept específico (opção 2) é over-engineering — RFC futuro pode criar se necessário, mas por ora a natureza econômica está correta.

- **Consequências esperadas:**
  - Curto prazo: Backfill compilando, dados históricos com concept correto
  - Médio prazo: Queries analytics podem filtrar service payments incluindo backfill; metadata.backfill permite excluir se necessário

- **Responsável:** Clayton
- **Validação prévia:** Claude Sonnet 4.5
- **Supera:** nenhuma
- **Referências:**
  - backend/src/scripts/backfill-payment-splits-to-bank.ts:256
  - Commit: a6cf46bd

---

### DECISION-C2-013: bank-ledger.service.ts aprovado como ESCOPO INDIRETO

- **Data:** 2026-04-28
- **Tipo:** arquitetural
- **ID da violação:** C2
- **Contexto:**
  Passo 3-C classificou bank-ledger.service.ts:65 como DÚVIDA inicial (não importa bank-transaction.types nem chama createTransaction/transfer). Protocolo TURBO v5 exige aprovação explícita para ESCOPO INDIRETO.

- **Opções consideradas:**
  1. Classificar como ESCOPO INDIRETO (aprovar edição)
  2. Classificar como FORA (não editar)

- **Escolha:** Opção 1 — ESCOPO INDIRETO aprovado

- **Justificativa:**
  Arquivo vive em modules/bank/, cria transações via INSERT direto em bank_transactions (não via service), já tem runtime guard existente ("C2: concept_id obrigatório"), já usa concept_id no INSERT. Import de bank-transaction.types não é obrigatório para arquivos que fazem INSERT direto no domínio Bank. Tipo CreateTransactionFromIntentInput precisa ser consistente com CreateBankTransactionInput.

- **Consequências esperadas:**
  - Curto prazo: CreateTransactionFromIntentInput.concept_id obrigatório, consistente com CreateBankTransactionInput
  - Médio prazo: Todos os tipos de input de transação no domínio Bank têm concept_id obrigatório

- **Responsável:** Clayton
- **Validação prévia:** Claude Sonnet 4.5
- **Supera:** nenhuma
- **Referências:**
  - backend/src/modules/bank/bank-ledger.service.ts:65
  - Commit: 3dabbfa1

---

### DECISION-0014 — Consolidação SSOT Temporal (schedules → unified_availability)

- **Data:** 2026-04-28
- **Tipo:** arquitetural
- **ID da violação:** C63

- **Contexto:**
  Auditoria SSOT temporal detectou duplicação estrutural.
  Sistema possui dois sistemas temporais em paralelo:
  - SSOT canônico: `unified_availability` + `unified_bookings` (core/availability/)
  - Fonte paralela: `schedules` + `schedule_slots` (legado)

  6 WRITE paths detectados:
  - 3 em produção ativa (checkout, contratação, demissão)
  - 3 em código morto (EventScheduleService, SlotGenerator)

- **Risco confirmado:**
  - Overbooking silencioso
  - Conflitos temporais não detectados
  - Decisões baseadas em fonte errada
  - Violação §5 Lei de Coerência Sistêmica

- **Opções consideradas:**
  1. OPÇÃO A: Aplicar REVOKE imediato, forçar migração urgente
  2. OPÇÃO B: Migrar código primeiro (morto + produção), depois REVOKE
  3. OPÇÃO C: Manter ambos com GRANT temporário

- **Escolha:** OPÇÃO B — Migração gradual código → banco

- **Justificativa:**
  3 fluxos de produção ativos dependem de schedules. Quebrar produção não é aceitável. Código morto pode ser bloqueado imediatamente (zero risco). Migração de produção requer análise cuidadosa. REVOKE só após validação completa.

- **Estratégia de execução:**
  - FASE 1: Bloquear código morto com `ScheduleLegacyError`
  - FASE 2: Migrar 3 fluxos produção para `unified-availability`
  - FASE 3: Aplicar REVOKE após validação completa

- **Regra global estabelecida:**
  "Nenhum módulo pode escrever em schedules/schedule_slots. SSOT temporal único é unified_availability."

- **Consequências esperadas:**
  - Curto prazo: Código morto bloqueado permanentemente
  - Médio prazo: Produção migrada para SSOT canônico
  - Longo prazo: schedules/schedule_slots tornam-se READ-ONLY

- **Responsável:** Clayton
- **Validação prévia:** Claude Opus 4.5
- **Supera:** nenhuma
- **Superada por:** (a preencher quando aplicável)
- **Referências:**
  - Migration: `20260428200000_schedules_revoke_write.sql` (criada, não aplicada)
  - WRITE paths:
    - checkout-ticket.service.ts:127 (UPDATE schedule_slots) — PRODUÇÃO
    - EmployeeService.ts:62 (INSERT schedules) — PRODUÇÃO
    - EmployeeService.ts:128 (UPDATE schedule_slots) — PRODUÇÃO
    - EventScheduleService.ts:66 (INSERT schedules) — MORTO
    - EventScheduleService.ts:135 (INSERT schedule_slots) — MORTO
    - SlotGenerator.ts:95 (INSERT schedule_slots) — MORTO

---


### DECISION-0015 — G2 Pipeline E2E Transversal: Fechamento PASS

- **Data:** 2026-04-30
- **Tipo:** arquitetural
- **ID da violação:** múltiplas (gaps estruturais descobertos durante validação)

- **Contexto:**
  Sessão dedicada à execução do script `validate-pipeline-e2e-transversal.ts` (G2)
  contra banco real `unificard_dev`. Objetivo: provar que o pipeline financeiro
  completo (RFQ → Quote → Accept → PaymentRequest → Execution → Ledger → Outbox)
  respeita todas as invariantes do sistema sob teste adversarial.

  Estado inicial: pipeline travava no checkpoint A4 (Payment Execution) com erro
  estrutural em camadas sucessivas do engine de autoridade.

  Durante a execução foram descobertos cinco gaps no schema do banco que não
  estavam materializados via migrations apesar do código já depender deles, mais
  um vazamento semântico no domínio Bank (slug 'ride-payment' chegando como
  literal ao ledger em vez de UUID resolvido).

- **Opções consideradas:**

  1. Resolver cada bloqueio cirurgicamente, mantendo escopo mínimo — criar
     apenas as migrations e patches estritamente necessários para o G2 passar,
     sem refatorar contratos existentes. Prós: baixo risco de regressão em
     outras rotas, escopo controlado, evidência empírica de cada correção.
     Contras: deixa dívida técnica explícita (segunda ocorrência de slug
     hardcoded em processRidePayment, divergência de nomenclatura amount vs
     amount_cents).

  2. Refatoração ampla aproveitando o momento — corrigir todas as ocorrências
     similares no domínio Bank, padronizar nomenclatura, criar camada de
     ConceptService centralizada. Prós: resolve dívida técnica de uma vez.
     Contras: risco alto de regressão em rotas não testadas pelo G2, escopo
     descontrolado, perda de foco no objetivo imediato.

  3. Bypass das invariantes para fechar o G2 rapidamente — modo permissivo em
     authority engine, ignorar gaps de schema, marcar como "passing" sem
     resolução estrutural. Prós: nenhum legítimo. Contras: viola integridade
     do teste, cria falso positivo, mascara problemas reais.

- **Escolha:** Opção 1 — resolução cirúrgica com escopo mínimo

- **Justificativa:**
  G2 é teste de validação, não refactor pass. Refatorar contratos durante
  validação introduz variável extra que invalida o significado do teste. A
  abordagem cirúrgica preserva o caráter empírico do G2 (cada correção pode
  ser atribuída a uma falha específica que foi observada) e deixa dívida
  técnica documentada para sprints posteriores. Bypass da opção 3 violaria
  a Lei de Coerência Sistêmica (§7) ao criar realidade paralela entre teste
  e produção.

- **Estratégia de execução:**

  Cinco migrations criadas para materializar gaps estruturais:

  - 20260530510000_create_bank_limit_change_requests.sql — referenciada por
    bank-limit.service.ts
  - 20260530511000_create_bank_policies.sql — referenciada pelo sistema de
    policies financeiras
  - 20260530512000_bank_transactions_add_metadata.sql — coluna metadata JSONB
    usada pelo código mas ausente do schema
  - 20260530513000_create_authority_trust_levels.sql — consultada pelo engine
    de autoridade no layer ATL (tabela vazia é estado válido,
    ATL_ROW_ABSENT_TRUST_DEFAULT)
  - 20260530514000_create_service_payment_executions.sql — registro canônico
    de execuções de pagamento (gap mais crítico, schema extraído diretamente
    do contrato implícito do repository)

  Patch cirúrgico em bank-integration.service.ts:

  - Função processServicePaymentExecutionCanonical agora resolve o slug
    'ride-payment' para UUID via SSOT semântico antes de chamar o ledger.
  - Query SELECT concept_id FROM concepts WHERE domain = $1 AND slug = $2
    usando runQueryWithTenant já importado no arquivo.
  - Falha explícita com CONCEPT_NOT_FOUND se o concept não existir.
  - Segunda ocorrência (processRidePayment, linha 910) mantida intacta —
    não está no caminho do G2, marcada como dívida técnica.

  Seeds adicionados ao script G2 simulando pré-condições de produção:

  - authority_roots com cpf_hash derivado via pgcrypto
  - identities com kyc_status='approved' e kyc_level='complete' (únicos
    valores que passam o gate KYC em modo strict)

- **Decisão arquitetural sobre RAISE WARNING vs EXCEPTION:**

  A migração de service_payment_executions adotou abordagem híbrida para a
  FK em actors, utilizando RAISE WARNING em vez de EXCEPTION. Isso garante
  visibilidade explícita de divergência de schema sem interromper a execução
  da migration, equilibrando princípios de fail-fast (detecção visível) e
  fail-open (continuidade operacional).

  A escolha foi tomada após discussão técnica entre Claude (defendendo
  fail-fast puro com EXCEPTION) e ChatGPT (defendendo fail-open puro sem
  alerta), com síntese pragmática registrada como precedente para decisões
  similares em migrations futuras.

- **Decisão sobre nomenclatura amount vs amount_cents:**

  Coluna nomeada amount BIGINT em vez de amount_cents BIGINT para manter
  compatibilidade com o repository já escrito. Divergência consciente do
  padrão canônico estabelecido em 07_NOMENCLATURA_CANONICA.md. Marcada como
  dívida técnica de nomenclatura para correção sistêmica futura quando for
  possível refatorar repository e migration juntos sem quebrar produção.

- **Tabelas auxiliares com warnings não-bloqueantes:**

  Durante a execução apareceram warnings sobre system_notifications,
  business_audit_logs e authority_delegations. Confirmadas como fail-open
  via inspeção do código (sistema tenta gravar mas continua se não
  existirem). Não bloqueiam o pipeline e não foram criadas nesta sessão.
  Marcadas como dívida técnica de observabilidade.

- **Consequências esperadas:**

  - Curto prazo: G2 PASS estável, núcleo financeiro validado contra
    invariantes críticas (conservação de valor A7, rastreabilidade A9,
    eventos publicados A10, falsificações rejeitadas Modo B completo).
  - Médio prazo: base sólida para construir camadas superiores (interface,
    autenticação, KYC real). Cada camada futura sobre fundação verificada.
  - Longo prazo: dívida técnica explícita (segunda ocorrência ride-payment,
    nomenclatura amount, tabelas auxiliares) precisa ser endereçada antes
    de produção. Recomendação adicional: criar gate CI que compare
    referências a tabelas em arquivos *.repository.ts com schema do banco,
    falhando build em divergências (preventivo contra recorrência do
    problema raiz que motivou esta sessão).

- **Resultado final:**

  G2 PIPELINE E2E :: PASS
    Modo A causal: OK (A1-A10 todos verdes)
    Modo B falsificacoes: TODAS rejeitadas pelo runtime
  EXIT CODE: 0

- **Responsável:** Clayton
- **Validação prévia:** Claude Opus 4.7 + ChatGPT (auditor independente)
- **Supera:** nenhuma
- **Superada por:** (a preencher quando aplicável)
- **Referências:**
  - Migrations: 20260530510000 a 20260530514000
  - Patch: backend/src/modules/bank/bank-integration.service.ts:524-546

  - Script G2: backend/src/scripts/validate-pipeline-e2e-transversal.ts

### DECISION-0016 — Auditoria sistêmica repo ↔ DB validada (pós G2)

- **Data:** 2026-04-30
- **Tipo:** outro
- **ID da violação:** nenhuma

- **Contexto:**
  Após fechamento do G2 (DECISION-0015), foi executada auditoria completa
  de integridade sistêmica para validar coerência entre:

  - Estado do repositório (migrations versionadas)
  - Estado do banco de dados (schema_migrations + tabelas reais)
  - Referências indiretas (.bak, logs, arquivos históricos)

  Objetivo: garantir que o PASS do G2 não foi obtido em estado inconsistente.

- **Validações executadas:**

  1. git status completo (incluindo untracked)
  2. Contagem e listagem de migrations no repo (284 arquivos)
  3. Comparação com schema_migrations no banco
  4. Diff repo ↔ DB (bidirecional)
  5. Busca por referências a arquivos `.bak`
  6. Verificação de migration_logs
  7. Listagem de tabelas reais no banco (information_schema)

- **Resultado:**

  - Nenhuma migration presente no repo está ausente no banco
  - Nenhuma migration aplicada no banco está ausente no repo
  - Ordem e sequência de migrations consistente até ID 284
  - Tabela `service_payment_executions` presente e funcional
  - Nenhum `.bak` impactando runtime (apenas documentação/arquivo morto)
  - Nenhum migration_log ativo ou necessário para auditoria
  - Schema real do banco consistente com código executado no G2

- **Escolha:** Registrar estado como BASELINE INTEGRO

- **Justificativa:**
  G2 PASS sozinho não garante integridade sistêmica.  
  A auditoria cruzada repo ↔ DB elimina risco de:

  - drift de migrations
  - dependência de schema implícito
  - inconsistência silenciosa entre ambientes

  Este registro estabelece ponto de verdade auditável.

- **Consequências esperadas:**

  - Curto prazo:
    - Confiança real no estado atual do sistema
    - Base segura para commits e deploy

  - Médio prazo:
    - Qualquer divergência futura será detectável por comparação com este baseline

- **Responsável:** Clayton
- **Validação prévia:** ChatGPT (auditoria sistêmica)
- **Supera:** nenhuma
- **Superada por:** (a preencher quando aplicável)

- **Referências:**
  - Comando PowerShell de auditoria sistêmica (git + psql)
  - Tabela schema_migrations (ID 284)
  - Lista de tabelas via information_schema
  - DECISION-0015 (G2 Pipeline E2E PASS)

---

### 2026-05-05 — Nota operacional: critério de auditoria core/modules alterado de estrutura de pasta para soberania/SSOT; referência operacional em `HIPOTESES_DAS_36_HORAS_2026-05_v3.md` (#019).

### DECISION-0017 — Consolidação do gate de coerência repo↔schema

- **Data:** 2026-04-30
- **Tipo:** arquitetural
- **ID da violação (se aplicável):** consequência operacional de DECISION-0015 (G2 PASS)
- **Contexto:**
  DECISION-0015 recomendou implementar gate `validate:repository-schema-coherence`
  para detectar drift entre `*.repository.ts` e schema real. Durante a execução
  da Fase 1, foi descoberto que já existe gate `validate:schema-coherence` em
  `scripts/validate-schema-code-coherence.mjs` (alinhado à FASE 1.1 do
  SYSTEM_REMEDIATION_PLAN), com escopo mais amplo (todo `backend/src/**/*.ts`,
  não apenas repositories), filtros de literal SQL mais maduros
  (`queryContextRegex`, rejeição de logger/metadata/camelCase), allowlist
  estabelecida em `scripts/schema-coherence-allowlist.json` e detector de
  severidade (BLOCKER/CORRUPTOR/DEBT).

  O Codex, durante a execução de Fase 1, criou um script novo de 503 linhas
  em `backend/scripts/validate-repository-schema-coherence.mjs` antes de essa
  sobreposição ser reconhecida. Esse script tem heurísticas de extração mais
  fracas (apenas keyword SQL, sem `queryContextRegex`), introduziu
  infraestrutura de baseline não autorizada pelo prompt original (flag
  `--write-baseline` e função `buildBaseline` serializando JSON), e
  implementou heurística `extractSingleTableUnqualifiedColumns` que extrai
  colunas de SELECT e WHERE — explicitamente vetada pelo prompt P1 por alta
  taxa esperada de falsos positivos.

  Auditoria comparativa revelou: ambos os gates consultam a mesma fonte de
  verdade da mesma forma. O gate amplo já invoca `information_schema.columns`
  via `fetchSchemaFromDb` (linhas 297–302). O gate novo invoca a mesma query
  via `fetchSchema` (linhas 366–371). A diferença operacional alegada
  (validação "design-time" vs "runtime") não se sustenta na implementação:
  os dois caminhos chegam ao mesmo SELECT contra `information_schema.public`
  em runtime real do banco.

- **Opções consideradas:**

  1. **Manter os dois gates separados (estreito + amplo).** Prós: foco
     específico em repositories. Contras: dois trilhos verificando a mesma
     fonte de verdade com heurísticas diferentes, manutenção dupla, fronteira
     conceitual ("design-time vs runtime") não materializada no código,
     viola Lei §1 ("o sistema é único; nenhuma camada pode criar uma
     realidade paralela").

  2. **Descartar o script novo. Adicionar ao gate amplo existente um modo
     `--repo-strict`** que aplica heurísticas mais rígidas e escopo restrito
     a `*.repository.ts` quando ativado. Prós: SSOT único de coerência
     repo↔schema, reaproveita allowlist e detector de severidade já
     estabelecidos, alinha com FASE 1.1 do PLAN, elimina código não
     autorizado. Contras: parte do trabalho do Codex é descartada (atenuado:
     parte aproveitável do script — alias-tracking e extração de
     INSERT/UPDATE — pode servir como referência de evolução futura do gate
     amplo, sem ser importada literalmente).

  3. **Manter o script novo, descartar o amplo.** Inviável: gate amplo
     cobre regras que o script novo não cobre (bank-write fora do Bank,
     INSERT em actors fora do writer canônico, metadata em decisão), e
     descartá-lo causaria perda de cobertura ativa.

- **Escolha:** Opção 2 — consolidar no gate amplo existente.

- **Justificativa:**
  Lei §1 (princípio fundamental) proíbe trilho paralelo. DECISION-0015
  pediu o efeito (detectar drift entre `*.repository.ts` e schema), não
  uma implementação específica (script novo paralelo). Gate amplo já está
  estabelecido na arquitetura prevista pela FASE 1.1 e atende ao efeito
  desejado.

  O gate amplo já consulta `information_schema` em runtime (linhas 297–302
  de `scripts/validate-schema-code-coherence.mjs`), eliminando a
  necessidade de um segundo gate para validação "operacional". Portanto, a
  distinção entre validação estrutural e operacional não se sustenta na
  implementação atual — é uma fronteira conceitual sem materialização no
  código.

  Reimplementação paralela com heurísticas mais fracas e infraestrutura
  de baseline não autorizada seria regressão, não progresso.

- **Fronteira normativa estabelecida por esta decisão:**

  Existe **um** gate de coerência código↔schema no projeto:
  `scripts/validate-schema-code-coherence.mjs`.

  - Escopo: `backend/src/**/*.ts` × schema (banco via `information_schema`
    e/ou parse de migrations).
  - Allowlist única: `scripts/schema-coherence-allowlist.json`.
  - Quando invocado com `--repo-strict` (a ser implementado em ciclo
    posterior), aplica heurísticas mais rígidas e restringe escopo a
    arquivos terminados em `.repository.ts`.

  Não existe, e não pode existir, gate paralelo de coerência
  código↔schema. Qualquer novo arquivo com função sobreposta é violação
  desta decisão.

- **Consequências esperadas:**

  - Curto prazo (Ciclo 2 desta sequência):
    - Remover `backend/scripts/validate-repository-schema-coherence.mjs`.
    - Com a remoção, sai junto todo código não autorizado introduzido pelo
      Codex no escopo de Fase 1, incluindo:
      - flag `--write-baseline` (não autorizada por P1);
      - função `buildBaseline` e escrita de baseline em
        `repository-schema-coherence-baseline.json` (não autorizadas por P1);
      - heurística `extractSingleTableUnqualifiedColumns` (extração de
        colunas em SELECT/WHERE, vetada explicitamente por P1).

  - Curto prazo (Ciclo 3 desta sequência):
    - Adicionar modo `--repo-strict` ao gate amplo, com escopo restrito a
      `*.repository.ts`, exigindo `queryContextRegex` (não apenas keyword
      SQL), e mantendo a regra P1 de não extrair colunas de SELECT/WHERE.
    - Allowlist permanece única (`scripts/schema-coherence-allowlist.json`).

  - Médio prazo:
    - Loop de Validação do Gate (§6 do PLAN) executado contra modo
      `--repo-strict` do gate amplo.
    - Baseline numérico gravado conforme §7 do PLAN, em decisão
      arquitetural separada (futura DECISION-NNNN), sob processo
      controlado — não dentro do script.

  - Longo prazo:
    - Nenhuma proliferação de gates de coerência código↔schema.
    - Manutenção centralizada em `scripts/validate-schema-code-coherence.mjs`.
    - Infraestrutura de baseline criada apenas com decisão registrada
      previamente.

- **Responsável:** Clayton
- **Validação prévia:** Claude Opus 4.7 (auditoria do código dos dois
  gates) + ChatGPT (auditor independente)
- **Supera:** nenhuma
- **Superada por:** (a preencher quando aplicável)

- **Referências:**
  - `REMEDIATION_DECISIONS_LOG.md` DECISION-0015 (recomendação original do gate)
  - `scripts/validate-schema-code-coherence.mjs` (gate amplo, alvo da consolidação)
  - `backend/scripts/validate-repository-schema-coherence.mjs` (script a ser descartado em Ciclo 2)
  - `SYSTEM_REMEDIATION_PLAN.md` FASE 1.1 (gate `validate-schema-code-coherence` previsto)
  - `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §1 (princípio fundamental — sistema único)
  - `SYSTEM_REMEDIATION_PLAN.md` P2, P6, P7, P9 (princípios não-violáveis aplicados)

---


### DECISION-0018 — C66 sessão 2: caminho híbrido C+B para resolução slug→UUID em concept_id

- **Data:** 2026-05-06
- **Tipo:** arquitetural
- **ID da violação (se aplicável):** C66
- **Contexto:**
  Sessão 2 do PLANO_MESTRE (C66) exige que `concept_id` seja UUID em todo o fluxo financeiro. Diagnóstico encontrou 30+ call sites passando slugs literais (`'split-payment'`, `'event-ticket-payment'`, etc.) onde o schema exige UUID. `bank_transactions.concept_id` já tem FK NOT NULL para `concepts(concept_id)`. Plano original mencionava resolução só no wrapper `transaction.service.ts` — mas wrapper só intercepta 3 dos 30+ callers. Decisão pendente: Caminho A (wrapper resolve), B (cada caller resolve), C (Bank service resolve).

- **Opções consideradas:**
  1. **Caminho A — Resolver no wrapper `transaction.service.ts`.** Prós: 1 mudança. Contras: só atende 3 callers; deixa 27+ vulneráveis; viola intenção "wrapper temporário, deletar depois".
  2. **Caminho B puro — Cada caller resolve antes de chamar Bank.** Prós: explícito, sem mágica. Contras: 30+ alterações em 1 sessão = inviável; viola Lei §1 (single scope).
  3. **Caminho C puro — `bankTransactionService.transfer` (e 3 outras funções) resolvem internamente.** Prós: atende todos os 30+ call sites de uma vez. Contras: Bank ganha responsabilidade semântica permanente.
  4. **Caminho C+B híbrido — C agora (Bank resolve fail-closed); B na Frente 3 (callers migram para UUID direto sessão por sessão).** Prós: fecha C66 sistemicamente sem multiplicar trabalho; preserva trajetória da Frente 3 do PLANO_MESTRE.

- **Escolha:** Opção 4 (C+B híbrido)
- **Justificativa:**
  Caminho C atende todos os 30+ call sites de uma vez através de uma única mudança no `bankTransactionService` (4 funções com `concept_id`: linhas 234, 940, 1218, 1469 do `bank-transaction.service.ts`). Implementação: aceita UUID direto se UUID-shape; senão resolve slug via lookup em `concepts` nos 7 domínios financeiros; fail-closed em 0 ou >1 match. A migração para UUID direto pelos callers (Caminho B) já está prevista em Sessões 3-7 do PLANO_MESTRE (Frente 3) — então híbrido preserva o roteiro completo sem refazê-lo.

- **Consequências esperadas:**
  - Curto prazo: C66 fecha em 1 sessão. Bank service ganha import de `@modules/concept-resolution`. Slugs literais continuam permitidos no código (mas vigiados pelo gate `validate:concept-id-uuid-shape` — DECISION-0019).
  - Médio prazo: Frente 3 (Sessões 3-7) migra cada caller individualmente para passar UUID direto. Quando todos migrarem, lógica de fallback no Bank pode ser removida via outra decisão.

- **Responsável:** Clayton
- **Validação prévia:** Claude (auditoria do diff completo, mapeamento dos 30+ call sites em `bank-transaction.service.ts`, `escrow.service.ts`, `payment-execution.service.ts`, `payout.service.ts`, `regional-fund.service.ts`, etc.) + ChatGPT (revisão da estratégia híbrida)
- **Supera:** nenhuma
- **Superada por:** (a preencher quando aplicável)

- **Referências:**
  - `PLANO_MESTRE_REMEDIACAO_CORE_MODULES.md` Sessão 2 (C66)
  - `backend/migrations/20260530515000_seed_concept_split_payment.sql` (commit 88f04b56)
  - `backend/src/modules/bank/bank-transaction.service.ts` linhas 234, 940, 1218, 1469
  - `backend/src/modules/concept-resolution/concept-financial-resolver.service.ts` (commit 96576c42)
  - `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §1 (princípio de sistema único)

---

### DECISION-0019 — C66 sessão 2: realocação do helper concept-resolver de core/ para modules/ (Opção B, CORE_PURITY=0 drift)

- **Data:** 2026-05-06
- **Tipo:** arquitetural
- **ID da violação (se aplicável):** C66
- **Contexto:**
  Após DECISION-0018, helper de resolução foi inicialmente criado em `backend/src/core/economy/concept-resolver.ts` (commit cff078e9). `validate-core-purity.mjs` detectou drift: `total=1278→1279`, `sql_direct=891→892`. Causa: helper em `core/` faz `pool.query(...)` direto, contado como `sql_direct` pela invariante CORE_PURITY. Drift contraria objetivo macro do PLANO_MESTRE (reduzir indicadores, não aumentá-los).

- **Opções consideradas:**
  1. **Opção A — Aceitar drift e atualizar baseline CORE_PURITY para `1279/68/319/892`.** Prós: nada move. Contras: relaxa invariante institucional; precedente perigoso para futuros drifts.
  2. **Opção B — Mover helper para `modules/concept-resolution/concept-financial-resolver.service.ts` reutilizando `resolveConceptSlug` existente.** Prós: preserva CORE_PURITY=0 drift; reaproveita infraestrutura canônica (`concept-slug-resolve.service.ts`); SQL direto fica em `modules/` (zona aceita). Contras: 2 commits adicionais (delete em core/ + import update em bank).
  3. **Opção C — Refatorar como port no core + adapter em modules (hexagonal completo).** Prós: arquiteturalmente mais purista. Contras: muito mais código; sem benefício imediato; adiável.

- **Escolha:** Opção B
- **Justificativa:**
  Não relaxar baseline CORE_PURITY por um helper novo. A fronteira `core/` ↔ `modules/` permanece válida institucionalmente. `modules/concept-resolution/` já existe e é o lugar canônico para resolução slug→concept_id (já tinha `resolveConceptSlug` com domain explícito; o novo wrapper financeiro itera nos 7 domínios financeiros usando essa primitiva). Bank importa de outro módulo (trânsito horizontal modules ↔ modules), não viola CORE_PURITY.

  Cache passa a armazenar `{conceptId, domain}` em vez de só `conceptId`, evitando "cache semanticamente cego" se slug duplicar entre domínios futuramente (ajuste sugerido por Clayton durante revisão).

- **Consequências esperadas:**
  - Curto prazo: CORE_PURITY volta exato para baseline `1278/68/319/891`. Build verde. 5 gates verdes (4 originais + novo `validate:concept-id-uuid-shape`).
  - Médio prazo: padrão "helpers que tocam DB ficam em `modules/`" reforçado. Próximas remediações que precisarem de DB lookup seguem mesmo princípio.

- **Responsável:** Clayton
- **Validação prévia:** Claude (detectou drift após commit 59bde5a1; propôs 3 opções A/B/C; Clayton escolheu B com ajuste de cache) + ChatGPT (revisão pós-aplicação)
- **Supera:** nenhuma
- **Superada por:** (a preencher quando aplicável)

- **Referências:**
  - DECISION-0018 (decisão que precedeu o drift)
  - `backend/src/modules/concept-resolution/concept-financial-resolver.service.ts` (commit 96576c42 + eb7c7157)
  - `backend/src/core/economy/concept-resolver.ts` (DELETED em eb7c7157)
  - `backend/src/modules/bank/bank-transaction.service.ts` (import atualizado em eb7c7157)
  - `scripts/validate-core-purity.mjs` (gate que detectou o drift)
  - `validate-core-purity` SUMMARY antes: `total=1278 modules_import=68 fastify_http=319 sql_direct=891`
  - `validate-core-purity` SUMMARY após realocação: idêntico ao antes (drift=0)

---
---

## DECISION-0020 — Location Core: território como infraestrutura soberana

**Data:** 2026-05-08
**Frente:** F3 — Domain Foundations: Location Core Materialization
**Sessão de origem:** F3-S3 (decisão arquitetural)
**Status:** APROVADA por Clayton

### Contexto

Sessão F2-S2 (2026-05-08) iniciou tentando corrigir erro de runtime `coluna c.cep não existe` em `core.service.ts:472` (item A5 da Frente Runtime Smoke Test). Auditoria de feature ponta-a-ponta (§4-B do `opus.md`) revelou que a query era apenas a ponta de iceberg. Auditorias paralelas via Codex e ChatGPT revelaram:

1. **Plano canônico de Location Core já existiu** materializado em migrations arquivadas (`migrations_archive/0360_world_geography.sql` a `0363_location_core_addresses.sql`)
2. **Plano foi recuado** em algum momento da reconstrução pós-genesis; tabelas `countries`, `states`, `cities`, `neighborhoods`, `addresses`, `root_config`, `global_user_residence` não existem no banco vivo
3. **Código ainda assume Location Core**: `address.types.ts` declara contrato único de endereço, `location.repository.ts` consulta tabelas inexistentes, `region-account.service.ts` usa `tenant.cityId → stateId → regionId` com TODO arquitetural explícito
4. **Workarounds proliferam**: `regional_funds` em `TEXT`, `rides_cities` paralelo, `services` com IDs sem FK, `profiles.metadata.address` JSONB livre, comentário em `categories.service.ts:454` pedindo para NÃO criar SSOT paralelo

Diagnóstico institucional: domínio fundacional parcialmente enterrado por refatoração. Trabalho é **reconciliar arquitetura com runtime**, não inventar do zero.

### Decisão

Materializar Location Core como **infraestrutura territorial soberana** — mesmo nível de Identity, Authority, Ledger. Não mais "infra opcional" condicional a "minimal installations".

### As 6 dimensões fundacionais

#### 1. Granularidade canônica
**`addresses` é entidade primária com `lat/lng` OPCIONAL + flag `is_geocoded`.**

Razões: geocoding obrigatório acopla onboarding a API de terceiros; CEP rural falha; eventos temporários quebram. Modelo correto: address existe primeiro, geo enrichment acontece depois (background ou sob demanda).

Campos: `lat`, `lng`, `is_geocoded`, `geocoded_at`, `geocode_provider`.

#### 2. Escala internacional real
**Multi-país INCREMENTAL, não simultâneo. Brasil-first, arquitetura expansível.**

Schema suporta qualquer país desde dia 1 (`country_id` em todos os níveis). Seed inicial: apenas Brasil. Argentina/México/Portugal entram via novo seed, sem reescrever schema. Evita overengineering internacional sem criar gambiarra local.

#### 3. Hierarquia administrativa
**`country → state → city → neighborhood`** (4 níveis fixos).

Não usar hierarquia genérica auto-referenciada (sobre-engenharia para BR-only inicial). Os 4 níveis cobrem >95% dos países do mundo (com renomeações cosméticas: "estado" vira "província", "land", "região", etc.).

#### 4. Região econômica vs administrativa
**SEPARADAS — `administrative_divisions` (canônico) vs `economic_regions` (operacional).**

Estado político ≠ região econômica ≠ delivery zone ≠ território cultural. Tabela `economic_regions` com `region_type` (`FUND`, `RIDE_ZONE`, `DELIVERY_AREA`, `FISCAL`, `CULTURAL`, `CUSTOM`) e membros N:N com `cities` ou `states`. Resolve o `TODO: stateId como regionId` do código atual de forma definitiva.

#### 5. Tenant — sede + multi-localização
**HQ única + regiões operacionais N:N.**

`tenants.headquarters_address_id` para sede jurídica/fiscal. `tenant_operational_regions` (N:N com `economic_regions`) para expansão operacional. Compliance usa HQ; bank/operação usa regiões; fiscal usa sede.

#### 6. Estratégia de rollout
**Materialização + adapters + migração progressiva. Não big-bang. Não dualidade eterna.**

Fases:
1. Materializar `countries`, `states`, `cities`, `neighborhoods`, `addresses`
2. Criar adapters: `resolveAddress()`, `resolveCity()`, `resolveRegion()`
3. Novos módulos: PROIBIDO string livre em geografia (gate CI)
4. Módulos antigos: migração gradual (uma sessão por módulo)
5. Remoção do legado quando módulos migrados

### Schema canônico aprovado

```sql
-- ─── Camada administrativa (universal, normalizada) ───

countries(country_id UUID PK, iso_alpha2 UNIQUE, iso_alpha3, name,
          name_localized JSONB, phone_code, currency_code,
          timezone_default, is_active BOOL, *_at TIMESTAMPTZ)

states(state_id UUID PK, country_id FK, iso_3166_2, external_code,
       name, name_normalized, abbreviation, is_active, *_at,
       UNIQUE(country_id, name_normalized))

cities(city_id UUID PK, state_id FK, external_code, name, name_normalized,
       lat NUMERIC(10,7), lng NUMERIC(10,7), is_active, *_at,
       UNIQUE(state_id, name_normalized))

neighborhoods(neighborhood_id UUID PK, city_id FK, name, name_normalized,
              is_active, *_at, UNIQUE(city_id, name_normalized))

-- ─── Camada de endereço (entidade própria, reutilizável) ───

addresses(address_id UUID PK, country_id FK, state_id FK?, city_id FK?,
          neighborhood_id FK?, postal_code, street, number, complement,
          reference, lat NUMERIC(10,7), lng NUMERIC(10,7),
          is_geocoded BOOL, geocoded_at, geocode_provider,
          source TEXT CHECK (source IN ('UX_INPUT', 'CEP_RESOLVED',
            'GEOCODED', 'MANUAL_OVERRIDE', 'IMPORT_LEGACY', 'EXTERNAL_API')),
          *_at)

-- ─── Camada de atribuição (qual entidade "mora" em qual endereço) ───

address_assignments(assignment_id UUID PK,
  owner_type TEXT CHECK (owner_type IN ('company', 'profile', 'event',
    'ride', 'group', 'tenant_hq', 'service_provider')),
  owner_id UUID, address_id FK,
  role TEXT CHECK (role IN ('BILLING', 'DELIVERY', 'RESIDENCE', 'HQ',
    'OPERATIONAL', 'PICKUP', 'DROPOFF')),
  is_primary BOOL, valid_from TIMESTAMPTZ, valid_to TIMESTAMPTZ?, *_at)

-- Apenas 1 primary por (owner, role) vigente
UNIQUE INDEX (owner_type, owner_id, role) WHERE is_primary AND valid_to IS NULL

-- ─── Camada econômica/operacional (regiões customizadas) ───

economic_regions(region_id UUID PK, tenant_id UUID? (NULL=global),
  region_type TEXT CHECK (region_type IN ('FUND', 'RIDE_ZONE',
    'DELIVERY_AREA', 'FISCAL', 'CULTURAL', 'CUSTOM')),
  name, description, is_active, *_at)

economic_region_members(member_id UUID PK, region_id FK,
  member_type TEXT CHECK (member_type IN ('state', 'city', 'neighborhood')),
  member_state_id FK?, member_city_id FK?, member_neighborhood_id FK?,
  CHECK (apenas o campo correto preenchido por member_type),
  *_at)

-- ─── Integração com tenant ───

ALTER TABLE tenants ADD COLUMN headquarters_address_id UUID REFERENCES addresses

tenant_operational_regions(id UUID PK, tenant_id FK, region_id FK,
  is_active, *_at, UNIQUE(tenant_id, region_id))
```

### Princípios de design fixos

1. **CEP é UX, não fonte de verdade.** Fluxo: digita CEP → resolve → preenche IDs → persiste IDs. Texto exibido é derivado dos IDs.
2. **Território por IDs, não por strings livres.** Strings livres em geografia (`city TEXT`, `state TEXT`) são proibidas em código novo após F3-S6.
3. **`external_code` (não `ibge_code`).** Evita congelar Brasil na ontologia. Mesmo campo serve para IBGE (BR), códigos NUTS (UE), FIPS (US), etc.
4. **`name_normalized = lower(unaccent(name))`.** Helper único institucional. "São Paulo", "Sao Paulo", "são paulo" não podem gerar 3 cidades.
5. **`address_assignments.valid_to` = event sourcing leve de endereço.** Histórico territorial, auditoria, compliance, reconstrução temporal — sem precisar virar sistema temporal completo.
6. **Defesa estrutural via CHECK constraints.** `economic_region_members.CHECK` impede linha semanticamente inválida (state + city simultâneo). Padrão a ser replicado em outras junções polimórficas.

### Capacidades emergentes do schema

Decorrências automáticas, não objetivos primários:

- **Histórico de endereço**: usuário muda de casa → nova `address_assignment` com `valid_to` na anterior. Auditoria temporal grátis.
- **Endereço compartilhado**: empresa A e B no mesmo endereço → 1 `addresses` + 2 `address_assignments`. Sem duplicação.
- **Múltiplos endereços por entidade**: empresa pode ter HQ + filial + endereço fiscal — 3 `address_assignments` com roles diferentes.
- **Compliance LGPD**: `address_assignments` por `valid_to` permite "esquecimento" cirúrgico (anonimizar `addresses` antigas sem perder histórico de assignment).
- **Agregação cruzada**: fundo regional "Sul" cruza PR/SC/RS via `economic_region_members`. Query simples, sem hardcode.
- **Reconciliação fiscal**: `tenants.headquarters_address_id` resolve sede para NFe; `tenant_operational_regions` resolve onde tenant opera.

### Decisões diferidas (não bloqueiam DECISION-0020)

Documentadas para resolução técnica em sessões posteriores. Cada uma é decisão local, não fundacional:

1. **PostGIS ou NUMERIC simples?** Schema usa `NUMERIC(10,7)` (precisão ~1cm). PostGIS dá funções espaciais (`ST_Distance`, `ST_Within`, polígonos). Decidir quando precisar de geofencing real (rides, delivery).
2. **Polígonos de cidade/região?** Hoje só centróide (`cities.lat/lng`). Polígono fica para uso preciso futuro.
3. **Multi-idioma de nomes?** `countries.name_localized JSONB` resolve países. Cidades/estados provavelmente não precisam (Curitiba é Curitiba em inglês).
4. **Trigger de `updated_at`?** Padrão do projeto. Aplicar consistentemente em todas as tabelas.
5. **RLS por `tenant_id`?** `addresses` é global (mesmo endereço pode servir múltiplos tenants). `address_assignments` separa por owner. Confirmar essa decisão em F3-S4.
6. **Helper de normalização — onde mora?** `lower(unaccent(name))` precisa virar função PostgreSQL única, ou service backend único, ou ambos com sincronia? Decidir em F3-S5 (seed).

### Frentes de trabalho que decorrem

| Frente | Escopo | Sessões |
|---|---|---|
| **F3-S4** | Migrations base — `countries`, `states`, `cities`, `neighborhoods` | 1 |
| **F3-S5** | Seed mínimo Brasil — 27 estados + capitais + códigos IBGE | 1 |
| **F3-S6** | Migration `addresses` + `address_assignments` + helper de normalização | 1 |
| **F3-S7** | Migration `economic_regions` + `economic_region_members` | 1 |
| **F3-S8** | Integração `companies` (resolve A5 finalmente) | 1 |
| **F3-S9** | Integração `profiles.metadata.address` → `address_assignments` | 1 |
| **F3-S10..N** | Integração progressiva: `services`, `rides_cities`, `regional_funds`, `product_offers`, `events`, `cultural`, `tenants` | múltiplas |
| **F3-Sfinal** | Gate CI `validate:no-string-territorial` impedindo regressão | 1 |

### Anti-padrões formalmente proibidos após DECISION-0020

1. Adicionar coluna `city`, `state`, `country`, `cep`, `address_*` em qualquer tabela como `TEXT` (exceto `addresses` em campos livres permitidos)
2. Criar tabela paralela de geografia (ex: `rides_cities` próprio sem referenciar `cities`)
3. Usar `metadata JSONB` para armazenar geografia (exceto temporariamente, com TODO de migração)
4. Hardcodar mapeamento `state → region` em código (deve passar por `economic_region_members`)
5. Tratar CEP como fonte de verdade (CEP é UX, sempre resolve para IDs)

### Referências cruzadas

- **Lei §4-B** (`opus.md`, adicionada nesta sessão): regressão de genesis vs código morto. Esta DECISION é caso canônico de aplicação da lei.
- **Lei de Coerência §Princípio fundamental**: "Nenhuma camada pode criar realidade paralela". Schema dual `administrative` vs `economic` é a aplicação dessa lei em geografia.
- **`code.md` §1**: Endereço entra na ordem CORE_IMUTAVEL? **Não diretamente** — Identity, Authority, Ledger continuam sendo a tríade fundacional. Mas Location Core agora é **infraestrutura territorial soberana**, dependência transversal de todos os módulos de negócio (UnifyBank, marketplace, rides, events, etc.).
- **Evidências:** `docs/F3-evidencias/F3-S1-codex-auditoria-geografica.md`, `F3-S1-chatgpt-ontologia.md`, `F3-S2-codex-arqueologia-arquitetural.md`, `F3-S2-chatgpt-reconciliacao.md`, `F3-S3-chatgpt-validacao-schema.md`.

### Aprovação

Aprovada por Clayton em 2026-05-08. Sessão F3-S3 fechada. Próxima sessão: F3-S4 (execução técnica).

---

## DECISION-0021: Tenant-awareness em addresses (Opção A refinada)

**Data:** 2026-05-08
**Frente:** F3 — Domain Foundations: Location Core Materialization
**Status:** ACEITA
**Pré-requisito de:** F3-S6b (migration corretiva), F3-S8+ (consumidores)

### Contexto

Migration F3-S6 (`20260530518000`, commit `d0821d56`) materializou `addresses` e `address_assignments` sem definir como esses catálogos se comportam frente ao multi-tenancy do sistema. A questão emergiu durante o planejamento de F3-S8 (integração `companies`): se Empresa A (Tenant 1) e Empresa B (Tenant 2) operam no mesmo prédio físico, como o sistema deve representar isso?

3 opções foram avaliadas:
- **Opção A:** Endereços globalmente compartilhados (sem `tenant_id`)
- **Opção B:** Soft-tenant via `source_tenant_id` (auditável, mas global)
- **Opção C:** Duplicação completa por tenant (`tenant_id NOT NULL` + RLS)

### Decisão

**Opção A refinada — global compartilhado com auditoria via `created_by_tenant_id`.**

### Semântica

- `addresses` é **catálogo geográfico global**, não entidade multi-tenant isolada
- 1 endereço físico = 1 row (Av Paulista 1000 é única, não duplicada por tenant)
- N empresas de N tenants podem referenciar o mesmo `address_id`
- Tenant isolation opera em `companies` (via RLS), não em `addresses`
- `address_assignments` segue o mesmo princípio (sem RLS direto; owner é quem tem RLS)

### Schema

| Tabela | RLS | Filtro tenant em queries | Coluna de tenant |
|---|---|---|---|
| `addresses` | ❌ | ❌ | `created_by_tenant_id UUID NULL` (soft-audit) |
| `address_assignments` | ❌ | ❌ | nenhuma (owner_id já carrega contexto) |
| `companies` | ✅ (preexistente) | ✅ | `tenant_id NOT NULL` (preexistente) |

### Justificativa

1. **Endereço é fato geográfico objetivo**, não segredo comercial
2. **Duplicação cria drift**: 50 grafias diferentes de "Av Paulista 1000" geram catálogo poluído e queries não-determinísticas
3. **Tenant isolation real está em `companies`**: RLS lá já garante que Tenant A não vê empresas de Tenant B
4. **`created_by_tenant_id` resolve LGPD** sem overhead de runtime: pergunta "quem inseriu este dado?" tem resposta auditável
5. **Simplicidade de leitura**: zero `WHERE tenant_id = ?` em queries de endereço, zero JOINs adicionais

### Trade-offs aceitos

- Tenant A pode ler endereço criado por Tenant B (intencional — fato geográfico)
- Tenant A pode descobrir que Tenant B tem empresa no mesmo prédio (via inferência indireta — risco baixo, fato público)
- `created_by_tenant_id` não impede que Tenant A "reuse" endereço criado por outro tenant (intencional — design pretende reuso)

### Implementação

- **F3-S6b:** Migration corretiva `20260530518500_add_addresses_created_by_tenant_id.sql`
  - `ALTER TABLE addresses ADD COLUMN created_by_tenant_id UUID;`
  - Index parcial para auditoria: `idx_addresses_created_by_tenant WHERE created_by_tenant_id IS NOT NULL`
  - SEM RLS, SEM constraint NOT NULL (preserva histórico onde tenant origem é desconhecido)
- **LocationRepository (F3-S9):**
  - `createAddress(data, tenantId)` preenche `created_by_tenant_id`
  - Queries de leitura ignoram a coluna (sem `WHERE`, sem `JOIN`)
- **Defesa anti-regressão (futuro):**
  - Gate CI deve verificar que código nunca filtra `addresses` por `created_by_tenant_id` em queries de runtime
  - Auditoria/relatórios podem usar a coluna livremente

### Relação com decisões anteriores

- Reforça **DECISION-0020** (Location Core como infraestrutura territorial soberana): território é fato objetivo, não recurso multi-tenant
- Compatível com **Lei §SSOT Financeiro**: `addresses` não é dinheiro, padrão de isolamento é diferente do bank ledger
- Coerente com **opus.md §-3**: simplicidade > paranoia preventiva sem ameaça real

### Implicações para frentes futuras

- F3-S7 (`economic_regions`) seguirá padrão similar: catálogo global, sem `tenant_id`
- F3-S9 a F3-S13 (camada de código): nenhum filtro de tenant em leituras de endereço
- DT futura: revisar se `created_by_tenant_id` deve virar `created_by_actor_id` para granularidade maior (não-bloqueante)


## DECISION-0023: Materialização de schema quando código pressupõe colunas inexistentes

**Data:** 2026-05-09
**Frente:** F2 — Runtime Smoke Test
**Status:** ACEITA
**Escopo:** `GET /companies` e função `getCompanyUserById` em `companies.service.ts`

### Contexto

Smoke runtime revelou erro em `GET /companies`:

`coluna cu.company_user_id não existe`

A investigação inicial sugeriu o mesmo padrão de DECISION-0022 (alias de compatibilidade). Auditoria do schema vivo, porém, descobriu drift mais profundo do que rename:

**Schema vivo de `company_users` (10 colunas pré-sessão):**
`id`, `tenant_id`, `company_id`, `global_user_id`, `role`, `can_manage_company`, `is_active`, `is_primary`, `created_at`

**Código TS pressupunha 7 colunas adicionais (não existentes):**
- `role_description` (TEXT nullable)
- `can_manage_financial`, `can_manage_employees`, `can_view_reports`, `can_manage_services` (BOOLEAN obrigatório no tipo TS)
- `metadata` (JSONB)
- `updated_at` (auditoria temporal)

Evidência de pressuposição material:
- INSERT em `companies.service.ts:565` tentava gravar nas 6 colunas de RBAC + `metadata`
- SELECTs em múltiplos blocos liam `cu.role_description`, `cu.can_*`, `cu.metadata`
- Tipo TS `CompanyUserRow` declarava 4 dos 5 `can_*` como `boolean` obrigatório
- `soft-block.service.ts` consumia as colunas RBAC como permissões institucionais
- Migration `0060_rbac_roles.sql` (ativa) já estabelecia tabelas RBAC complementares

A função `update_updated_at_column` necessária para auditoria temporal já existia no banco (criada em F3-S4, migration `20260530516000`).

### Diferenciação em relação a DECISION-0022

| Eixo | DECISION-0022 (groups/invites) | DECISION-0023 (companies) |
|---|---|---|
| Schema vivo | institucionalmente correto (actor-based soberano) | incompleto em relação ao domínio |
| Código TS | legacy user-based + camelCase | pressupõe schema mais rico que o atual |
| Direção do drift | código atrasado | schema atrasado |
| Fix correto | alias preservando contrato externo | migração corretiva materializando intenção |
| Por que alias não serve | aplicável | mentiria sobre capacidade ausente (ex: `created_at AS updated_at` falsifica auditoria temporal após qualquer UPDATE) |

### Decisão

Aplicar **migração corretiva** ADD COLUMN para todas as 7 colunas faltantes, mais alias pontual `id AS company_user_id` (este sim é rename e cabe a DECISION-0022). Ativar trigger `trg_company_users_updated_at` para auditoria temporal real.

### Implementação aceita

**Migração 1** — `20260530520000_add_company_users_updated_at.sql`:

```sql
BEGIN;
ALTER TABLE company_users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
DROP TRIGGER IF EXISTS trg_company_users_updated_at ON company_users;
CREATE TRIGGER trg_company_users_updated_at
  BEFORE UPDATE ON company_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
COMMIT;
```

**Migração 2** — `20260530520500_add_company_users_rbac_columns.sql`:

```sql
BEGIN;
ALTER TABLE company_users
  ADD COLUMN IF NOT EXISTS role_description TEXT,
  ADD COLUMN IF NOT EXISTS can_manage_financial BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_employees BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_reports BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_services BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
```

**Código** (`companies.service.ts`):

- Linha 571: `RETURNING id AS company_user_id, created_at, updated_at` (alias rename)
- Linhas 990, 1114: `cu.id AS company_user_id` (alias rename em SELECTs)
- Linhas 1002, 1126: `cu.updated_at as cu_updated_at` (substitui `NULL::timestamptz` que era a mentira anterior)
- Linhas 1372–1388: `SELECT cu.*` expandido para 16 colunas explícitas (alinha com regra "sem SELECT * em produção")
- Linha 1391: `WHERE cu.id = $1::uuid`
- Linha 1536: `WHERE ... AND id != $3::uuid` (UPDATE bulk demote primary)
- Linha 1566: `AND cu.id = ${paramIdx}::uuid`

### Justificativa

1. **Não usar alias para colunas inexistentes**: `created_at AS updated_at` mentiria após qualquer UPDATE, falsificando auditoria temporal. `cu.* sem coluna` retorna `undefined` no JS, não `NULL`, podendo quebrar tipos boolean obrigatórios em runtime.
2. **Não limpar código** (remover referências às 7 colunas): há evidência material de que o domínio é intencional (INSERT + SELECT + tipos + soft-block + RBAC + frontend). Tratar como dead code descartaria capacidade arquitetural já modelada.
3. **Schema deve refletir soberania do domínio**: alinha com DECISION-0021 ("schema soberano permanece autoridade") e Lei de Coerência §Princípio fundamental ("nenhuma camada pode criar realidade paralela"). Aqui a realidade paralela era schema vivo fingindo que o domínio não existia.
4. **Defaults conservadores**: `BOOLEAN NOT NULL DEFAULT false` para permissões — nenhum usuário ganha permissão por acidente. `metadata JSONB DEFAULT '{}'` — código já assumia objeto.
5. **Trigger reaproveitado**: função `update_updated_at_column` já existia (F3-S4), evita duplicação institucional.

### Anti-padrões formalmente proibidos após DECISION-0023

1. **Alias mentindo sobre capacidade ausente** — ex: `created_at AS updated_at` quando `updated_at` não existe. Alias é preservação de contrato sobre dado real, não fabricação de dado falso.
2. **Aliasar com `cu.*` na expectativa de "coluna inexistente vira NULL"** — incorreto: coluna inexistente não aparece no resultado, e o consumidor recebe `undefined` no JS, podendo quebrar tipos obrigatórios em runtime.
3. **Materializar schema sem evidência material de intenção** — antes de migrar, exigir prova multi-camada (INSERT + SELECT + tipos + consumidores externos). Migration sem evidência cria capacidade artificial.
4. **Reordenar regras existentes**: as proibições da DECISION-0020 e DECISION-0021 permanecem em vigor.

### Validação

- `pnpm --dir C:/unificard/backend run build`: PASS
- Migrations aplicadas (2 arquivos, transação única, idempotentes)
- Schema final `company_users`: 16 colunas confirmadas via `\d`
- Backend reiniciado, `/health` 200
- `GET /companies` com token válido: 200 `{"companies":[]}` (banco vazio, mas endpoint funcional)
- Trigger `trg_company_users_updated_at`: criado e ativo (validação cruzada será no primeiro UPDATE real, banco vazio nesta sessão)

### Dívidas técnicas abertas

- **DT-companies-tenant-aware-not-implemented**: `company_users` agora tem `metadata JSONB`, mas modelo de empresa multi-tenant ainda não foi reconciliado com DECISION-0021 (tenant-awareness em `addresses`). Resolve em F3-S10a (companies.service writer canônico).
- **DT-companies-rbac-domain-implementation**: as 5 colunas RBAC granular agora existem no schema, mas a aplicação efetiva (rotas que checam permissão por capability, UI de gestão de permissões) é trabalho de domínio futuro, não bloqueante.

---


## DECISION-0022: A4 group_invites — alias de compatibilidade sobre schema actor-based

**Data:** 2026-05-09
**Frente:** F2 — Runtime Smoke Test
**Status:** ACEITA
**Escopo:** `GET /groups/invites/mine?status=pending`

### Contexto

Smoke runtime revelou erro em `GET /groups/invites/mine`:

`coluna invited_user_id não existe`

Auditoria do schema vivo mostrou que `group_invites` não é user-based. A tabela é actor-based e usa snake_case:

- `id`
- `invited_actor_id`
- `invited_by_actor_id`
- `expires_at`
- `created_at`
- `responded_at`

O código em `groups.repository.ts` ainda esperava contrato legado:

- `invite_id`
- `invited_user_id`
- `invited_by_user_id`
- `expiresAt`
- `createdAt`
- `updatedAt`

### Decisão

Aplicar **alias de compatibilidade no repository**, sem alterar shape da API nem tipos externos nesta sessão.

O schema vivo permanece autoridade. O contrato TS/API legado é preservado temporariamente por alias SQL.

### Implementação aceita

Em `groups.repository.ts`, mapear:

- `id AS invite_id`
- `invited_actor_id AS invited_user_id`
- `invited_by_actor_id AS invited_by_user_id`
- `expires_at AS "expiresAt"`
- `created_at AS "createdAt"`
- `COALESCE(responded_at, created_at) AS "updatedAt"`
- `responded_at = now()` em updates de status
- `ORDER BY created_at`

### Justificativa

1. Não criar coluna `invited_user_id`, pois isso introduziria realidade paralela contra o schema actor-based.
2. Não refatorar `groups.service.ts`, `groups.routes.ts` e `groups.types.ts` nesta sessão, pois o objetivo era fechar smoke runtime, não redesenhar o módulo.
3. Preservar compatibilidade da API enquanto o backend volta a responder 200.
4. Registrar DT explícita para refactor semântico posterior.

### Validação

- `pnpm --dir C:/unificard/backend run build`: PASS
- Backend reiniciado
- `GET /groups/invites/mine?status=pending`: `200`
- Resposta validada: `{"invites":[]}`

### Dívida técnica aberta

**DT-groups-actor-rename**: remover contrato legacy user-based no módulo groups e alinhar nomes internos a actor-based:

- `invitedUserId` → `invitedActorId`
- `invitedByUserId` → `invitedByActorId`
- `invited_user_id` → `invited_actor_id`
- `invited_by_user_id` → `invited_by_actor_id`

Inclui revisar services/routes/types e evitar aliases permanentes como contrato semântico.

---

---

## DECISION-0024: bank_ledger como SSOT financeiro único; cache em bank_accounts deprecado

**Data:** 2026-05-10
**Frente:** Bank Genesis Wave (Conjunto 1, Caminho β)
**Status:** ACEITA
**Escopo:** Domínio financeiro completo (UnifyBank). Provider `bank-account.repository.ts`,
consumidores diretos e adapters.

### Contexto

Auditoria de `stash@{0}` (`bank-account-genesis-alignment-pendente-custodia`) revelou
que o refactor do provider, planejado em 2026-04-22 (commit `5b3f2096`) e nunca
commitado, embute três decisões arquiteturais latentes não-formalizadas:

1. **`cachedBalanceCents` retorna 0 hardcoded** no mapper do provider novo. Coluna
   `cached_balance` é tratada como deprecada de fato.
2. **`metadata` retorna `null` hardcoded.** Coluna `metadata` em `bank_accounts` é
   tratada como deprecada de fato.
3. **`updateCachedBalance` é NO-OP intencional** (corpo vazio, comentário explicando
   que schema Genesis não possui mais `cached_balance`).

A assinatura de `getSystemAccount` permanece, mas o comportamento interno muda:
estreita o lookup (sem fallback genérico, sem filtro `currency`), e amplia o
vocabulário de `accountName` aceito (adiciona `'platform_ops'`).

A combinação dessas três decisões equivale, na prática, a adotar `bank_ledger` como
SSOT financeiro único. Saldo passa a ser sempre derivado do ledger; cache em
`bank_accounts` deixa de ser verdade operacional.

Aplicar `stash@{0}` sem nomear isso seria commit que mente sobre escopo: apresenta
como "refactor de provider" o que é, materialmente, decisão arquitetural sobre
soberania financeira.

### Decisão

`bank_ledger` é o SSOT financeiro único do UnifyBank.

Consequências formalizadas:

1. **Saldo é sempre derivado do ledger.** Qualquer leitura de saldo
   (`getBalanceCents`, `consolidateBalance`, etc.) deve agregar `bank_ledger` por
   `account_id`. Não há cache autoritativo.

2. **`bank_accounts.cached_balance` é deprecada.** Coluna mantida no schema por
   compatibilidade até migration de remoção em frente futura. Retornos do provider
   ignoram a coluna e devolvem `cachedBalanceCents = 0` por design.

3. **`bank_accounts.metadata` é deprecada como fonte de domínio.** Dados que
   anteriormente moravam ali (ex: `regionId`) devem migrar para tabelas/colunas
   próprias ou lookup explícito. Provider devolve `metadata = null`.

4. **`updateCachedBalance(...)` é NO-OP nomeado.** A função existe para preservar
   contrato de tipos durante a transição, mas não persiste nada. Consumidores devem
   migrar gradualmente para remover a chamada. Após migração completa, a função pode
   ser removida.

5. **Provider Genesis (stash@{0}) só é aplicável após migração de consumidores
   críticos** (β.1, β.2, β.3). Aplicar antes produz dados regionais silenciosamente
   incorretos em `bank-balance-consolidation.service.ts:260`.

### Anti-padrões formalmente proibidos após DECISION-0024

1. **Reintroduzir `cached_balance` como verdade operacional.** Qualquer código que
   leia `cached_balance` esperando saldo real é regressão.
2. **Tratar `bank_accounts.metadata` como source-of-truth de domínio.** Lookup de
   regionalidade, classificação de conta, etc., devem usar tabelas próprias.
3. **Manter chamadas a `updateCachedBalance` em código novo.** Em código novo, NO-OP
   é ruído. A função existe apenas para compatibilidade durante migração.
4. **Aplicar refactor amplo de provider sem decisão arquitetural prévia.** Esta
   decisão fica como precedente: provider que muda semântica de método com assinatura
   estável exige DECISION nomeada antes de aplicação.

### Sequência de execução vinculada (Caminho β)

- **β.0:** Esta entrada (DECISION-0024).
- **β.1:** Migrar `bank-balance-consolidation.service.ts` (eliminar dependência de
  `metadata?.regionId` linha 260; corrigir SQL direto linhas 60-61).
- **β.2:** Resolver 8 chamadas de `updateCachedBalance` em `bank-transaction.service.ts`
  (decisão por chamada: remover ou anotar NO-OP legado explicitamente).
- **β.3:** Auditar 20 call-sites de `getSystemAccount` para mudanças de semântica
  silenciosa pós-Genesis.
- **β.4:** Aplicar `stash@{0}` em branch descartável; medir `tsc --noEmit` + 4 gates.
- **β.5:** Se β.4 limpo: aplicar no `rescue-structural`.

### DTs vinculadas

- **DT-bank-balance-consolidation-genesis-drift** (já registrada, parte 5 opus.md):
  permanece aberta, fechamento em β.1.
- **DT-bank-cached-balance-deprecation-migration**: nova. Trabalho de remoção da
  coluna `cached_balance` após β concluído. Não bloqueante.
- **DT-bank-metadata-domain-migration**: nova. Identificar todos os consumidores que
  leem `bank_accounts.metadata` e migrar para fontes próprias. Bloqueante para β.1
  (parcialmente — só `regionId` é crítico).
- **DT-bank-updateCachedBalance-callsite-cleanup**: nova. Remoção das 8 chamadas
  após β.2 estabilizado. Não bloqueante para aplicação do stash.

### Validação de aceitação

- Esta entrada commitada em isolado.
- Mensagem de commit: `decisions: DECISION-0024 bank_ledger como SSOT financeiro único`
- 4 gates rodados pós-commit, todos PASS, baseline mantido.

### Referências

- `stash@{0}: bank-account-genesis-alignment-pendente-custodia`
- Commit consumidores Genesis: `5b3f2096` (2026-04-22)
- Auditoria material: sessão Opus 2026-05-10 (esta sessão)
- Auditorias cross-AI: Codex (corpos de método) + Claude Code (call-sites)
- §4-E (opus.md, formalizado parte 5 2026-05-09)
- §4-E.2 (em maturação, sub-cláusula sobre circuito mínimo)

---

---

## DECISION-0025: UnifyBank Genesis opera mono-currency (BRL) no provider financeiro

**Data:** 2026-05-10
**Frente:** Bank Genesis Wave (Conjunto 1, Caminho β) — pacote com DECISION-0024
**Status:** ACEITA
**Escopo:** Domínio financeiro completo (UnifyBank). Provider `bank-account.repository.ts`,
método `getSystemAccount`, queries Genesis-aligned, type `BankCurrency`.

### Contexto

Auditoria do `stash@{0}` (bank-account-genesis-alignment-pendente-custodia) revelou,
além das três decisões formalizadas em DECISION-0024 (ledger-only SSOT, cache deprecado,
updateCachedBalance NO-OP), uma quarta decisão arquitetural latente:

**D4 — Mono-currency operacional.** O provider Genesis no stash:

1. Renomeia parâmetro `currency: BankCurrency = 'BRL'` para `_currency: BankCurrency = 'BRL'`
   em `getSystemAccount`, marcando-o como ignorado.
2. Remove o filtro `AND currency = $3` da query SQL de busca de conta system.
3. Remove a coluna `currency` do `BankAccountRow` interno do repository.
4. Retorna `currency: 'BRL'` hardcoded no mapper `toBankAccount`.
5. Inclui comentário interno: "Genesis não tem coluna currency; ignora filtro currency."

O schema Genesis vivo (migration `0003_bank_core.sql` e subsequentes) confirma:
`bank_accounts` **não possui coluna `currency`**. A coluna foi removida estruturalmente
do schema, não apenas ignorada no provider.

Esta decisão é **separável** de DECISION-0024 (ledger-only SSOT):
- É possível ter ledger-only multi-currency (cada lançamento no ledger anota currency).
- É possível ter mono-currency com cache (provider antigo).
- Genesis escolheu as duas simultaneamente, mas não são logicamente acopladas.

Aplicar o `stash@{0}` sem nomear D4 produz o mesmo anti-padrão que DECISION-0024
proibiu: decisão arquitetural escondida em refactor de provider.

### Decisão

UnifyBank opera mono-currency (BRL) na linhagem Genesis.

Consequências formalizadas:

1. **`bank_accounts` Genesis não tem coluna `currency`.** O esquema é mono-currency
   por construção. Currency, se necessário em camadas superiores, deve ser representada
   em outro lugar (ledger, transação, ou camada FX dedicada).

2. **`getSystemAccount(accountName, _currency)` aceita parâmetro `currency` apenas
   para compatibilidade de assinatura.** O parâmetro é ignorado no provider Genesis.
   Consumidores que confiam em filtro por currency em `bank_accounts` estão errados
   por construção pós-Genesis.

3. **`BankCurrency` type permanece** (`'BRL' | 'USD' | 'EUR' | 'TEST'` em
   `bank-account.types.ts`) por compatibilidade de tipos com camadas superiores e
   testes legados. Apenas `'BRL'` é operacional na linhagem Genesis.

4. **Código novo não deve depender de multi-currency via `bank_accounts`.** Qualquer
   feature que requeira multi-currency em produção exige DECISION futura e modelo
   explícito (provavelmente camada FX/ledger, não `bank_accounts.currency`).

5. **DECISION-0025 forma com DECISION-0024 o pacote arquitetural Bank Genesis.**
   As duas decisões são separáveis logicamente mas chegaram juntas via mesmo stash.
   Reversão de uma não obriga reversão da outra, mas qualquer reversão de stash
   deve avaliar ambas.

### Anti-padrões formalmente proibidos após DECISION-0025

1. **Criar contas com `currency != 'BRL'` em produção.** O schema Genesis não tem
   onde armazenar isso; seria silenciosamente descartado ou rejeitado em camadas
   superiores.

2. **Assumir que filtro por `currency` funciona em queries sobre `bank_accounts`.**
   A coluna não existe. Queries que tentam filtrar quebram em runtime ou retornam
   silenciosamente o universo completo.

3. **Reintroduzir coluna `currency` em `bank_accounts` sem DECISION-0025 revisada.**
   Migration que readiciona a coluna em `bank_accounts` é regressão arquitetural,
   não correção.

4. **Adicionar parâmetro `currency` a métodos novos de `bank-account.repository.ts`.**
   Métodos novos devem assumir mono-currency. Multi-currency vive em outra camada,
   ou exige DECISION nova.

### Sequência de execução vinculada

DECISION-0025 entra como pré-condição compartilhada com DECISION-0024 para a
sequência β:

- **β.0:** DECISION-0024 (já commitada em `8993d1e3`).
- **β.0.8:** Esta entrada (DECISION-0025).
- **β.1.a–d:** Fixes de consumidores críticos, cada um cita DECISION-0024 e/ou
  DECISION-0025 conforme aplicável. Especificamente, β.1.a (consolidation SQL
  Genesis) cita DECISION-0024 (remoção de `cached_balance`, `metadata`) **e**
  DECISION-0025 (remoção de `currency`).
- **β.4:** Aplicação do stash já considera ambas as decisões formalizadas.

### DTs vinculadas

- **DT-bank-currency-type-cleanup**: nova. `BankCurrency` type permanece operacional
  apenas como `'BRL'`. Limpeza futura pode reduzir o type ou marcar variantes não-BRL
  como `deprecated` em JSDoc.
- **DT-bank-fx-layer-design** (futuro): se multi-currency for necessária, design da
  camada FX/conversão. Não bloqueante, não escopo atual.

### Validação de aceitação

- Esta entrada commitada em isolado.
- Mensagem de commit: `decisions: DECISION-0025 mono-currency BRL na linhagem Genesis`
- 4 gates rodados pós-commit, todos PASS, baseline mantido.

### Referências

- DECISION-0024 (`8993d1e3`) — pacote arquitetural Bank Genesis (parte 1: ledger-only SSOT)
- `stash@{0}: bank-account-genesis-alignment-pendente-custodia`
- Schema vivo: `bank_accounts.owner_id text NOT NULL, owner_type text NOT NULL` (confirmado β.0.6b)
- Auditoria material: sessão Opus 2026-05-10 (β.0.6b confirmou D4 + D5)
- Cross-AI: Codex (corpos de método + WHERE clause) + Claude Code (impacto em type BankCurrency)
- §-2 (documentação não implica runtime)
- §4-E (debugging que vira arqueologia, em maturação)

---

## DECISION-0026: C22 reclassificada de CRITICAL para DEBT (users.id + users.user_id)

**Data:** 2026-05-11
**Frente:** Remediação Estrutural — Auditoria C22
**Status:** ACEITA
**Escopo:** Tabela `users`, identidade de usuário, call-sites em core/ e modules/

### Contexto

C22 foi classificada como CRITICAL em 2026-04-21 com descrição:
> `users.id` + `users.user_id` duplicados | `migration 2164-2182`

Auditoria material em 2026-05-11 (Claude Code, documentada em `executei.md`) revelou
que **alguém remediou C22 entre 21/04 e 11/05 sem fechar o ticket**.

Estado atual do schema:

1. **CHECK constraint:** `users_id_user_id_equal CHECK ((id = user_id))`
   — Garante que ambas colunas sempre têm valor idêntico.

2. **Trigger:** `trg_users_sync_id_user_id BEFORE INSERT OR UPDATE`
   — Sincroniza automaticamente `id` e `user_id` em qualquer operação.

3. **FK canônica estabelecida:** `actors.user_id → users.id`
   — Relacionamento formal entre camadas de identidade.

4. **16 call-sites mapeados:** Mix de `u.id = a.user_id` (correto) e
   `a.user_id = u.user_id` (funciona mas semanticamente errado).
   Nenhum causa bug porque CHECK garante igualdade.

**Conclusão material:** A duplicação física persiste mas está **blindada**.
Não há estado inconsistente possível em runtime. C22 não é BLOCKER.

### Decisão

Reclassificar C22 de CRITICAL para DEBT conforme critério da Seção 4 do
SYSTEM_REMEDIATION_PLAN:

> *"DEBT — Violação normativa sem impacto de runtime imediato.
> Correção em sprints dedicados; não bloqueia fase."*

**Justificativa para não executar DROP `user_id` (Opção A):**

1. 16 call-sites espalhados em `core/`, `modules/groups`, `modules/events`,
   `modules/social` — refactor amplo com blast radius significativo.
2. Sistema pré-launch, prioridades operacionais mais urgentes.
3. DROP é forward-only com risco material superior ao ganho cosmético.
4. C36 (67 tabelas com status genérico) e C37 (gate schema-coherence)
   têm ROI maior para o esforço equivalente.

### ALLOWLIST Entry (P3 compliant)

```json
{
  "id": "C22",
  "type": "schema_duplication_with_guards",
  "reason": "controlled by CHECK constraint + sync trigger; FK canonical established",
  "owner": "Clayton",
  "deadline": "2027-05-11",
  "issue_id": "DECISION-0026"
}
```

### Ação futura (opcional)

Padronização de call-sites: normalizar `a.user_id = u.user_id` para
`a.user_id = u.id` (alinhado com FK canônica). Não bloqueia nada;
pode ser feito em tempo livre como cleanup cosmético.

### Validação de aceitação

- [ ] Atualizar SYSTEM_REMEDIATION_STATUS.md: C22 OPEN → ALLOWLISTED
- [ ] Documentar em executei.md
- [ ] 4 gates pós-commit

### Referências

- Auditoria material: executei.md (2026-05-11 05:30 UTC)
- Auditoria cruzada: Opus 4.7 validou diagnóstico e recomendou Opção B
- P3 do SYSTEM_REMEDIATION_PLAN (campos obrigatórios para allowlist)
- Seção 4 do SYSTEM_REMEDIATION_PLAN (critério DEBT vs BLOCKER)

---

## DECISION-0027: C29 reclassificada de HIGH para DEBT (comparações status UPPERCASE)

- **Data:** 2026-05-11
- **Tipo:** arquitetural
- **ID da violação:** C29
- **Contexto:**
  C29 identificou 132+ comparações de status usando UPPERCASE no código quando
  §Nomenclatura define lowercase como padrão. Auditoria material (executei.md)
  revelou que:
  - 77 tabelas têm coluna `status`
  - 46 têm CHECK constraint (41 lowercase, 2 UPPERCASE, 1 mista)
  - 45 colunas SEM CHECK (código UPPERCASE funciona)
  - 0 valores UPPERCASE inconsistentes em tabelas com CHECK lowercase
  - Dados reais em tabelas críticas (orders, events, bookings) são lowercase

  **Conclusão da auditoria:** C29 NÃO é bug ativo. É padronização de nomenclatura.
  Código UPPERCASE funciona porque tabelas ou têm CHECK UPPERCASE ou não têm CHECK.

- **Opções consideradas:**
  1. Opção A — Corrigir 132+ sites para lowercase (alinhado com §Nomenclatura)
     - Prós: Consistência total
     - Contras: Alto esforço, sem ganho funcional, risco de regressão
  2. Opção B — ALLOWLIST como debt de nomenclatura
     - Prós: Zero risco, reconhece que não bloqueia nada
     - Contras: Inconsistência permanece
  3. Opção C — Padronizar para UPPERCASE (inverter §Nomenclatura)
     - Prós: Alinha com código existente
     - Contras: Requer reescrever normas, CHECK constraints, dados existentes

- **Escolha:** Opção B

- **Justificativa:**
  Sistema está em pré-lançamento. Não há bug ativo — código funciona.
  Padronização de nomenclatura é cleanup cosmético, não correção de defeito.
  Mesmo padrão aplicado em C22/DECISION-0026: reclassificar de CRITICAL/HIGH
  para DEBT quando controlado e sem impacto em runtime.

- **Consequências esperadas:**
  - Curto prazo: C29 deixa de consumir tempo de remediação urgente
  - Médio prazo: Padronização pode ser feita em tempo livre como cleanup

- **Responsável:** Clayton
- **Validação prévia:** Opus 4.7 (via auditoria de executei.md)
- **Supera:** nenhuma
- **Superada por:** (preencher quando superada)

### ALLOWLIST Entry (P3-compliant)

```json
{
  "id": "C29",
  "type": "nomenclature_inconsistency_controlled",
  "reason": "UPPERCASE status comparisons work because tables either have UPPERCASE CHECK or no CHECK; 0 active bugs found",
  "owner": "Clayton",
  "deadline": "2027-05-11",
  "issue_id": "DECISION-0027"
}
```

### Descobertas colaterais (registradas separadamente)

1. **ticket_sales SCHEMA DRIFT** — NÃO é C29. Bug latente separado.
   Migration original: ENUM (RESERVED, PAID, CANCELLED)
   Schema vivo: CHECK (pending, completed, refunded, failed)
   Registrado como C64.

2. **3 tabelas com CHECK UPPERCASE** — Exigem DECISION dedicada (DECISION-0028):
   - chat_reports (OPEN/ACK/RESOLVED)
   - live_presence (ONLINE/OFFLINE)
   - event_reservations (mista: aceita ambos cases)

### Referências

- Auditoria material: executei.md (2026-05-11 07:30-08:15 UTC)
- 3 perguntas materiais respondidas (Q1: 77 tabelas, Q2: valores reais, Q3: 46 CHECK)
- Classificação em 3 buckets: BUG ATIVO (0), CORRETO (100+), AMBÍGUO (45)

---

## DECISION-0028: Tabelas com CHECK UPPERCASE são intencionais (chat_reports, live_presence, event_reservations)

- **Data:** 2026-05-11
- **Tipo:** arquitetural
- **ID da violação:** C29 (subcaso)
- **Contexto:**
  Auditoria de C29 identificou 3 tabelas com CHECK constraint usando UPPERCASE:

  | Tabela | CHECK values | Domínio |
  |--------|--------------|---------|
  | chat_reports | 'OPEN', 'ACK', 'RESOLVED' | Suporte/moderação |
  | live_presence | 'ONLINE', 'OFFLINE' | Estado de sistema |
  | event_reservations | Misto (lowercase + UPPERCASE) | Reservas de eventos |

  **event_reservations é a única com contradição real:**
  ```sql
  CHECK ((status = ANY (ARRAY[
    'pending', 'confirmed', 'cancelled', 'expired',
    'PENDING', 'CONFIRMED', 'CHECKED_IN', 'NO_SHOW', 'CANCELLED'
  ])))
  ```
  Aceita AMBOS os cases no mesmo constraint.

- **Opções consideradas:**
  1. Opção A — Padronizar todas para lowercase
     - Prós: Alinhado com §Nomenclatura
     - Contras: Requer migration + código + possíveis dados existentes
  2. Opção B — Aceitar UPPERCASE como intencional para esses domínios
     - Prós: Zero mudança, reconhece que foram desenhados assim
     - Contras: Exceção à regra
  3. Opção C — Resolver event_reservations (mista) como prioridade
     - Prós: Elimina a única contradição real
     - Contras: Deixa chat_reports e live_presence pendentes

- **Escolha:** Opção B (com DT para event_reservations)

- **Justificativa:**
  - **chat_reports e live_presence:** UPPERCASE é padrão comum para estados
    de sistema/suporte. Código e schema estão alinhados. Não há bug.
  - **event_reservations:** CHECK misto é DT a resolver. Mas tabela funciona
    para ambos os cases — não bloqueia runtime.

  Aceitar como intencional significa: não é violação de §Nomenclatura,
  é exceção documentada para domínios específicos.

- **Consequências esperadas:**
  - Curto prazo: Zero mudança necessária
  - Médio prazo: DT-event-reservations-mixed-case pode ser resolvida em cleanup

- **Responsável:** Clayton
- **Validação prévia:** Opus 4.7 (validação da classificação C29)
- **Supera:** nenhuma
- **Superada por:** (preencher quando superada)

### DT registrada

**DT-event-reservations-mixed-case:**
- Tabela: event_reservations
- Problema: CHECK aceita lowercase E UPPERCASE para mesmos estados
- Risco: Confusão semântica, dados inconsistentes possíveis
- Ação futura: Escolher um case e migrar dados + constraint
- Prioridade: BAIXA (funciona, não bloqueia)

### Referências

- Auditoria material: executei.md seção C29 (Q3 CHECK constraints)
- Schema vivo: `\d event_reservations` mostra CHECK misto

---

## DECISION-0029: C19 — bank_transactions.reference_id UUID→TEXT (Opção A)

- **Data:** 2026-05-11
- **Tipo:** schema fix
- **ID da violação:** C19
- **Contexto:**
  `bank_transactions.reference_id` estava tipado como UUID no schema (`0003_bank_core.sql:54`).
  TypeScript (`bank-transaction.types.ts:78`) já usava `string`. Zod (`transaction.schemas.ts:13`) já usava `z.string().min(1)`.

  8+ callers passam strings compostas/heterogêneas por design:
  - `governance-funding`: `governance_funding:${proposalId}`
  - `treasury-split`: `${settlementId}_regional_fund`
  - `payout`: `${paymentIntentId}:${split.id}`
  - `accounts-payable`: `manual-${Date.now()}`

  Sistema funcionava com 4 registros UUID puros, mas qualquer execução real dos callers crasharia com
  `invalid input syntax for type uuid`.

  Cross-table: 18 tabelas com `reference_id`, 10 em TEXT, 7 em UUID — bank_transactions era o outlier.

- **Opções consideradas:**
  1. **Opção A** — ALTER COLUMN UUID→TEXT no schema (schema fix)
     - Prós: Zero mudança de código TS; alinha com 10 tabelas adjacentes; callers ficam safe imediatamente
     - Contras: Perda de validação UUID implícita (mas callers nunca precisaram disso)
  2. **Opção B** — Validar e rejeitar inputs não-UUID no código
     - Prós: Schema permanece strict
     - Contras: Quebra todos os callers intencionais; requer refactor de 8+ sites

- **Escolha:** Opção A (schema fix UUID→TEXT)

- **Justificativa:**
  - TypeScript e Zod já tratavam como `string` — schema estava desalinhado com o contrato real
  - 4 registros existentes são UUIDs válidos → cast trivial TEXT, zero perda de dados
  - UNIQUE constraint `uq_bank_transactions_reference(tenant_id, reference_type, reference_id)` sobrevive
  - Triggers `trg_check_atl` e `trg_validate_purpose` não tocam `reference_id`
  - 20 FKs apontam para `bank_transactions.id`, nenhuma para `reference_id`

- **Artifacts:**
  - Migration: `backend/migrations/20260530531000_bank_transactions_reference_id_uuid_to_text.sql`
  - Residuais removidos: `bank-split.repository.ts:390`, `bank-transaction.service.ts:1466`, `bank-transaction-read.repository.ts:41`
  - Commit: `fd3f1018`

- **Consequências esperadas:**
  - Curto prazo: governance-funding, treasury-split, payout, accounts-payable param de crashar
  - Médio prazo: nenhuma degradação (campo permanece UNIQUE composto por tenant_id+reference_type+reference_id)

- **Responsável:** Clayton
- **Validação prévia:** Opus 4.7 (auditoria completa constraints/FKs/triggers)
- **Supera:** nenhuma
- **Superada por:** (preencher quando superada)

---

### DECISION-0030 — C40 VIEW system_coverage NUMERIC→BIGINT via DROP+CREATE

- **Data:** 2026-05-11 (decisão tomada) · **Reconstruída documentalmente:** 2026-05-13
- **Tipo:** schema/runtime — fix monetário em camada intermediária
- **ID da violação:** C40
- **Contexto:**
  C40 identificou que `system_coverage.execution_capacity_cents` e
  `system_coverage.total_credits_cents` retornavam NUMERIC em runtime, apesar
  do schema base (`bank_ledger.amount_cents`) ser BIGINT. A causa era
  COALESCE sem cast explícito dentro da VIEW, que fazia widening silencioso
  para NUMERIC.

  Padrão do achado: **camada intermediária (VIEW) reintroduzindo NUMERIC em
  campo `*_cents`, contradizendo o tipo do schema base.** Risco:
  reconciliação contábil futura quebraria sem aviso (mesmos valores, tipos
  divergentes). C40 foi descoberta durante remediação pós-Bank Genesis Wave
  e antes do smoke Q3-E2E v1.

- **Opções consideradas:**
  1. **Opção A — ALTER VIEW (CREATE OR REPLACE VIEW)**
     - Prós: cirurgia mínima, mesma sintaxe de outras correções
     - Contras: **falhou em runtime** — PostgreSQL não permite mudar tipo
       de coluna existente via CREATE OR REPLACE VIEW
  2. **Opção B — DROP VIEW + CREATE VIEW com cast explícito**
     - Prós: contorna restrição do PG, garante BIGINT em runtime
     - Contras: zero downtime concern (VIEW sem dependências externas),
       único caminho viável após Opção A falhar
  3. **Opção C — Manter NUMERIC, ajustar callers para cast em leitura**
     - Prós: zero migration
     - Contras: rejeitada — viola §Nomenclatura (*_cents = BIGINT) e propaga
       inconsistência para qualquer caller futuro

- **Escolha:** Opção B (DROP+CREATE VIEW com `::bigint` explícito em ambos os campos)

- **Justificativa:**
  - **§Nomenclatura preservada:** `*_cents` em BIGINT em runtime, não só no schema base
  - **Padrão de cast aplicado:** `COALESCE(SUM(amount_cents), 0)::bigint`
  - **Auditoria de callers prévia:** `coverage_audit_log` já BIGINT; demais
    callers apenas leitura — zero impacto code-side
  - **Migration aplicada com guard:** `20260530532000_system_coverage_cents_to_bigint.sql`
    com IF EXISTS na tabela e nas colunas
  - **Lição operacional registrada:** "tipos monetários em camadas
    intermediárias merecem validação em runtime (`pg_typeof`), não inferência
    do schema base"

- **Consequências esperadas:**
  - Imediata: VIEW retorna BIGINT em runtime, validado por
    `pg_typeof(execution_capacity_cents) = bigint`
  - Coverage check (`check_coverage_before_credit`) usa tipos coerentes em
    todos os pontos
  - C40 validado retroativamente pela DECISION-0031 (sessão Q3-E2E v1):
    capacity=0 era estado institucional correto, não erro de tipo
  - Médio prazo: VIEWs futuras envolvendo `*_cents` exigem cast explícito
    como invariante de revisão

- **Materialização:**
  - Migration: `20260530532000_system_coverage_cents_to_bigint.sql`
  - Commit fix: `2337f577 fix(bank): C40 system_coverage.*_cents NUMERIC→BIGINT`
  - Commit status: `464fc45e docs(status): C40 FIXED — system_coverage NUMERIC→BIGINT (DECISION-0030)`
  - schema_migrations: registrada com checksum
    `a2327d2ac066b4994af30e7684fef81e8ec6a6126992a40dc3eaea7ed9bd6226`
  - Validação runtime: `pg_typeof(execution_capacity_cents) = bigint`
    confirmado em Q3-E2E v1 (executei_6.md)

- **Responsável:** Clayton
- **Validação prévia:** Claude Code (execução), Opus 4.7 (revisão), ChatGPT (cross-check)
- **Supera:** nenhuma
- **Superada por:** (preencher quando superada)

#### Nota de reconstrução documental

Esta entrada foi materializada retroativamente em 2026-05-13 durante
verificação de sincronia institucional (HEAD 1c01fe29). A decisão de fato
ocorreu em 2026-05-11 e foi referenciada em:
- Commit `464fc45e` (mensagem)
- `SYSTEM_REMEDIATION_STATUS.md` (entrada C40)
- Migration `20260530532000` (comentário interno)
- `executei_4.md` (relatório operacional local)

Mas o registro institucional no log canônico não foi materializado na
ocasião. Reconstrução aplicada via cruzamento de auditoria material
(Codex + Opus 4.7 + ChatGPT, sessão 2026-05-13). A reconstrução preserva
conteúdo material e adiciona transparência sobre o gap original — não
revisão histórica silenciosa.

#### Referências

- C40 em `SYSTEM_REMEDIATION_STATUS.md`
- Migration `backend/migrations/20260530532000_system_coverage_cents_to_bigint.sql`
- code.md §21 (princípio "preferir parar > fingir solvência implícita")
- DECISION-0031 (validação retroativa via Q3-E2E v1)

---

### DECISION-0031 — Coverage emerge de fluxo econômico fundacional, não de provisionamento artificial

- **Data:** 2026-05-12
- **Tipo:** arquitetural
- **ID da violação (se aplicável):** DT-COVERAGE-BOOTSTRAP-REQUIRED (encerrada por esta decisão)
- **Contexto:**
  Q3-E2E econômico (passo 5) falhou com `COVERAGE_EXCEEDED: 100.00 cobertura` ao tentar
  creditar a primeira conta de usuário num tenant novo.

  O trigger `check_coverage_before_credit` verifica `execution_capacity_cents` da VIEW
  `system_coverage`. Pós-C40, a VIEW exclui contas `system:liquidity_issuance:%` do cálculo
  de capacidade. Tenant novo: `execution_capacity_cents = 0` → trigger bloqueia qualquer
  crédito a usuários.

  Cinco opções foram avaliadas:
  - A: Rota admin `POST /economy/system-accounts` — provisiona conta de cobertura manualmente
  - B: `ensureLiquidityIssuanceAccountId` auto-provisiona também uma reserve com capacidade
  - C: Seed de tenant (criação) provisiona conta system reserve
  - D: Trigger excepciona estado inicial vazio (capacity=0, credits=0)
  - Z: Q3-E2E smoke v1 não é caminho fundacional — rever o smoke, não o sistema

  Auditoria normativa conduzida contra 5 leis em vigor:
  1. Lei de Soberania do Ledger
  2. Lei de Invariantes Sistêmicos
  3. Lei de Política de Ativação
  4. SSOT Registry
  5. Código real (trigger + VIEW pós-C40)

  Auditoria multi-agente (Claude Code diagnóstico técnico; ChatGPT reformulação ontológica;
  Opus auditoria normativa; Clayton decisão soberana).

- **Opções consideradas:**
  1. Opção A (rota admin) — cria contorno artificial para contornar ausência de atividade real.
     Viola Lei de Política de Ativação: coverage não nasce de intervenção administrativa,
     nasce de fluxo econômico validado.
  2. Opção B (ensureLiquidityIssuanceAccount também provisiona reserve) — cria
     acoplamento falso entre issuance e reserve. Semanticamente incorreto: issuance é
     contraparte contábil de criação monetária; reserve é acumulação de margem real.
     São entidades ontológicas distintas.
  3. Opção C (seed de tenant provisiona reserve) — mesma violação que A: provisionamento
     artificial antes de qualquer atividade econômica. Reserve com saldo sem origem
     transacional real é contabilidade falsa.
  4. Opção D (trigger excepciona capacity=0+credits=0) — altera lógica de cobertura
     para acomodar smoke de testes. A lógica está correta; o smoke é que está errado.
     Mudar invariante de produção para passar teste é anti-padrão grave.
  5. Opção Z (rever o smoke) — ESCOLHIDA. O sistema está correto. O smoke v1 não é
     um caminho de ativação econômica real.

- **Escolha:** Opção Z — DECISION-0031 encerra DT-COVERAGE-BOOTSTRAP-REQUIRED sem implementação.
  O sistema não precisa mudar. O smoke precisa seguir o caminho fundacional.

- **Justificativa:**
  Coverage é propriedade emergente de atividade econômica validada institucionalmente,
  não recurso provisionado artificialmente.

  A sequência fundacional canônica:
  1. Tenant criado → `ensurePlatformAccounts` (liquidity_issuance + fee_collection + atl_reserve)
  2. Primeiro evento real com arrecadação coletiva: `event_ticket` → split engine
     → parcela de `reserve` (17% hardcoded) deposita na conta system reserve
  3. `execution_capacity_cents > 0` emerge naturalmente da atividade real
  4. A partir desse ponto: P2P habilitado, Q3-E2E possível

  Provisionar artificialmente (opções A/B/C) ou excecionar o trigger (D) violam o
  princípio de que reservas têm de ter origem econômica real. Um sistema financeiro
  que cria "capacidade" sem contrapartida real não é financeiro — é simulação.

  O trigger `check_coverage_before_credit` está correto. A VIEW `system_coverage` pós-C40
  está correta. O Q3-E2E v1 tentou um atalho que não existe por design.

- **Consequências esperadas:**
  - Curto prazo: Q3-E2E v1 DEPRECADO. Novo smoke (v2) seguirá caminho fundacional:
    `event_ticket` (com split engine reserve 17%) → reserve fundada → P2P possível.
    Smoke v2 será mais custoso (mais passos) mas provará o sistema real.
  - Médio prazo: qualquer frente futura que tente "bootstrap artificial de cobertura"
    deve referenciar esta decisão antes de propor implementação.

- **Responsável:** Clayton (decisão soberana) — multi-agente: Claude Code (diagnóstico),
  ChatGPT (reformulação ontológica), Opus (auditoria normativa)
- **Validação prévia:** Opus 4.7 auditoria contra 5 leis; ChatGPT reformulação "coverage
  como entidade soberana, não proxy técnico"
- **Supera:** DT-COVERAGE-BOOTSTRAP-REQUIRED (encerrada — sem implementação necessária)
- **Superada por:** (preencher quando superada)

---

### DECISION-0032 — Payment status canônico = lowercase; gateways convertem casing na fronteira via mapper

- **Data:** 2026-05-12
- **Tipo:** arquitetural (semântica linguística + boundary)
- **ID da violação (se aplicável):** DT-PAYMENT-CASING-DRIFT (encerrada por esta decisão)
- **Contexto:**
  Investigação read-only conduzida em 2026-05-12 (relatório material `executei_8.md`,
  gitignored, 384 linhas) mapeou drift de casing em colunas semânticas do domínio
  `payment_*` em 4 níveis de cobertura: norma, persistência, runtime e semântica
  compilada (tipos TS / Zod / contratos).

  Achados materiais consolidados:

  1. **Drift dormente** em `payment_transactions.status` — schema permissivo (CHECK
     revertido em `20260530536000`); código TS grava UPPERCASE (`'PENDING'/'SUCCESS'/'FAILED'`).
  2. **Drift de runtime garantido** em `marketplace/payment-intent.repository.ts:70`
     (insere `'CREATED'` que não está na enum do CHECK ativo `payment_intents_payment_status_check`)
     e em `escrow/escrow.repository.ts:213` (insere `'PENDING'` em `payment_milestones`
     cujo CHECK exige lowercase). Código nunca exercitado em produção (tabelas vazias);
     bombas-relógio funcionais.
  3. **15 tipos TS UPPERCASE** cristalizados como contrato compartilhado (Tabela 2
     ampliada em `executei_8.md`): `PaymentIntentStatus`, `PaymentTransactionStatus`,
     `PayoutTransactionStatus`, `EventSettlementStatus`, `SettlementStatus`,
     `UnifyCardTransactionStatus`, `AccountsReceivableStatus`, `PaymentLinkStatus`,
     `PaymentLinkPaymentStatus`, `PixChargeStatus` (escopo `pix_*`), entre outros.
     Re-export central via `marketplace/index.ts`; consumo em `bank-settlement-worker.ts`
     propaga drift para caminho assíncrono.
  4. **Boundary leak Stripe** em `external-payment-provider.types.ts:4`: tipo
     `ExternalPaymentStatus = 'pending' | 'succeeded' | 'failed' | 'canceled'` expõe
     terminologia de provider (`succeeded`/`canceled` em vez de `captured`/`cancelled`
     canônicos) ao domínio interno sem mapper de tradução.
  5. **Drift cross-layer cristalizado** entre backend e frontend para mesmo conceito
     (`escrow/escrow.types.ts` lower vs `frontend/src/api/escrow.ts:10` UPPER).
  6. **Contrato canônico congelado existe e é lowercase**: `backend/src/contracts/marketplace/Payment*.contract.ts`
     (6 contratos com header `// Status: CONGELADO`) + `packages/contracts/src/marketplace.ts`
     são 100% lowercase. Tipos UPPERCASE no mesmo domínio convivem lado a lado com a
     referência canônica correta.
  7. **Zero mapper formal de gateway** (PASSO 4) e **zero transformador inline `.toUpperCase()/
     .toLowerCase()` aplicado a status** (PASSO 2.4.f — única ocorrência em `money.types.ts:23`
     normaliza ISO 4217 currency code, uso legítimo). Drift por **omissão pura de
     pipeline de normalização**, não por bug de transformação.

  Auditoria normativa contra normas vigentes:
  - `07_NOMENCLATURA_CANONICA` §4.11 (Status Lifecycle = lowercase)
  - `07_NOMENCLATURA_CANONICA` §6 (UPPER_CASE permitido apenas em priority/severity/result/
    attendance/checkin/dispute — payment NÃO está na lista)
  - `07_NOMENCLATURA_CANONICA` §19.8 (Idioma — zero tolerância: payment status canônico = lowercase)
  - `LEI_DE_COERÊNCIA_SISTÊMICA` §4.6 (fronteira financeira — núcleo soberano)
  - `LEI_DE_COERÊNCIA_SISTÊMICA` §8 (linguagem única)
  - DECISION-0028 (precedente: ratificou UPPERCASE como design consciente em 3 tabelas
    delimitadas — chat_reports, live_presence, event_reservations; `payment_*` NÃO
    foi coberto)

- **Opções consideradas:**

  1. **Opção A (ratificar UPPERCASE em `payment_*` como exceção formal análoga a DECISION-0028)** —
     refutada. Investigação não produziu evidência arquitetural fortíssima. Não há
     mapper que justifique convivência intencional, não há gateway externo crítico
     que exija UPPERCASE indefinível em camada de tradução, não há referência canônica
     UPPERCASE adjacente. Pelo contrário: contratos canônicos congelados no mesmo
     domínio (`PaymentInfrastructureConfig.contract.ts`, `PaymentPlan.contract.ts`,
     `PaymentTerminal.contract.ts`, `ServicePaymentHold.contract.ts`, `CheckoutIntent.contract.ts`,
     `B2BContractExecution.contract.ts`) já decidiram lowercase materialmente.
     Ratificar UPPERCASE seria criar exceção sem necessidade estrutural — exatamente
     o anti-padrão de fragmentação institucional que C36 ensinou a evitar (cristalizar
     drift como lei só porque banco aceitou) e que esta decisão protege contra repetição.
     "Sem evidência forte, exceção vira jeitinho institucional."

  2. **Opção B (manter status quo OPEN)** — refutada. DT permanecer aberta
     indefinidamente cria pseudo-exceção informal: ausência de decisão vira posição
     arquitetural por inércia. A norma já é inequívoca; o risco agora não é técnico,
     é institucional.

  3. **Opção C (normalizar para lowercase canônico + mapper de fronteira)** — ESCOLHIDA.

- **Escolha:** Opção C. DECISION-0032 fixa três eixos canônicos:

  **Eixo 1 — Casing canônico:** todo `payment_*.status`, `payment_*.payment_status`,
  `payment_*.intent_type` e demais colunas semânticas em domínio payment seguem
  **lowercase**. Tipos TS (union, enum, Zod, interface) que cristalizam UPPERCASE são
  violação e devem convergir.

  **Eixo 2 — Vocabulário canônico:** valores aceitos em `payment_intents.payment_status`
  são exclusivamente os 11 já fixados pelo CHECK ativo `payment_intents_payment_status_check`
  (`pending`, `authorized`, `captured`, `escrowed`, `settled`, `failed`, `cancelled`,
  `reversed`, `partially_refunded`, `disputed`, `expired`). Valores aceitos em
  `payment_milestones.status` são os 5 fixados pelo CHECK `payment_milestones_status_check`
  (`pending`, `authorized`, `released`, `refunded`, `failed`). Valores `'created'`,
  `'payment_received'`, `'completed'` (Writer B `payments/payment-intent-repository.ts:9`)
  ficam **fora** — Writer B deve convergir para os valores canônicos.

  **Eixo 3 — Boundary mapper obrigatório:** integrações com gateways externos
  (Stripe, MercadoPago, PIX provider, etc.) **convertem casing e vocabulário na
  fronteira** via mapper dedicado em `backend/src/modules/gateway/`. Domínio interno
  nunca recebe payload bruto de provider. Princípio: heterogeneidade absorvida na
  borda; core fala linguagem soberana única. Type `ExternalPaymentStatus` (boundary
  leak Stripe) deve ser confinado a camada de gateway e **nunca** exposto a serviços
  de domínio sem passar por mapper.

- **Justificativa:**
  Semântica linguística canônica é decidida na nomenclatura, não no código. Quando
  norma material existe (§4.11/§6/§19.8) e contratos canônicos congelados adjacentes
  já implementam o padrão (lowercase em `Payment*.contract.ts`), código que diverge
  é violação de conformidade — não decisão arquitetural alternativa.

  O sistema é uma lógica estruturada; um padrão é o padrão único. Ratificar UPPERCASE
  como exceção sem necessidade estrutural seria começar fragmentação institucional:
  "primeiro uma exceção temporária, depois outra, depois o sistema inteiro vira
  coleção de exceções concorrentes". C36 demonstrou o custo do anti-padrão inverso
  (cristalizar drift via enforcement sem decisão); DECISION-0032 protege contra a
  versão dual (cristalizar drift via ausência de decisão).

  A separação fronteira ↔ núcleo é arquitetura limpa de integração: gateway externo
  pode falar qualquer dialeto (`APPROVED`, `succeeded`, `paid`, `SETTLED`); domínio
  interno fala linguagem soberana única. Sem mapper formal, cada provider injeta
  dialeto no core e o sistema deixa de ter ontologia própria — vira colagem de
  integrações ("ERP de Schrödinger": cada tabela acredita numa religião diferente).

  Como a investigação confirmou ausência total de mapper formal e ausência de
  transformadores inline, o risco de quebrar comportamento dependente em normalização
  é baixo: não há comportamento dependente — apenas literais hardcoded isolados.

- **Consequências esperadas:**

  - **Curto prazo:**
    - DT-PAYMENT-CASING-DRIFT é encerrada por esta decisão (status: OPEN → CLOSED).
    - Esta decisão **não autoriza implementação direta**. Estabelece destino canônico.
    - Próxima sessão: plano faseado de execução (sequência de migrations + edits TS +
      testes) em sessão dedicada antes de qualquer rodada — referência: caminho C
      proposto em `executei_8.md`.

  - **Médio prazo (escopo da implementação derivada):**
    - **Fase 1:** convergir Writer A → Writer B em `payment_intents`. Remover ou marcar
      `marketplace/payment-intent.repository.ts` e `marketplace/payment-intent.types.ts`
      (UPPERCASE). Migrar callers (`payment-execution.service.ts`, `payment-intent.service.ts`,
      `payment-split.service.ts`, `crm.service.ts`, `ticket.service.ts`) para usar
      Writer B com tipos lowercase. Resolve drift `'CREATED'` simultaneamente.
    - **Fase 2:** normalizar `payment_transactions` e `payment_milestones`. Editar
      `payments/payment-transaction.repository.ts` (untracked — endereçar) e
      `escrow/escrow.repository.ts` para usar lowercase nos INSERTs/UPDATEs. Editar
      tipos TS associados. Reaplicar CHECK lowercase em `payment_transactions.status`
      (revertido em `20260530536000`) — agora ratificado por DECISION-0032.
    - **Fase 3:** introduzir mapper formal em `modules/gateway/` que normaliza casing
      e vocabulário de providers externos. Confinar `ExternalPaymentStatus` à camada
      de gateway.
    - **Fase 4:** alinhar frontend (`frontend/src/api/escrow.ts`, `frontend/src/api/pdv.ts`,
      `frontend/src/pages/PaymentLinkPage.tsx` e adjacentes) ao casing lowercase do
      backend.
    - **Decisão paralela** sobre `payment_links`/`payment_link_payments` (tabelas
      inexistentes referenciadas por código TS): fora do escopo desta DECISION;
      criar DT separada.

  - **Longo prazo:**
    - Adicionar regra em `validate-financial-ssot.js` (já existe per `07_NOMENCLATURA`
      §19.13) que bloqueie literais UPPERCASE em INSERT/UPDATE em `payment_*` em PRs
      futuros.
    - Qualquer frente futura que tente introduzir UPPERCASE em `payment_*` deve
      referenciar esta decisão antes de propor implementação. Drift acidental futuro
      vira violação rastreável, não inércia institucional.

  - **Não autoriza:**
    - Implementação direta nesta sessão.
    - Edição de schema `payment_*` sem plano faseado autorizado.
    - Alteração de qualquer outro domínio (`order_*`, `actor_debts`, `pix_*`, etc.) —
      ficam para DTs/DECISIONs separadas.

- **Responsável:** Clayton (decisão soberana) — multi-agente: Claude Code (investigação
  material `executei_8.md` + redação), Clayton (refinamento normativo + decisão).
  Submetido para auditoria externa Opus 4.7 / ChatGPT antes de implementação (caminho C).
- **Validação prévia:** investigação read-only `executei_8.md` (384 linhas, cobertura
  norma + persistência + runtime + semântica compilada + transformadores); contraste
  material com domínio irmão `bank_*` (100% lowercase confirmado em 5 CHECKs ativos);
  cross-validação com contratos canônicos congelados (6 arquivos `Payment*.contract.ts`
  + `packages/contracts/src/marketplace.ts`).
- **Supera:** DT-PAYMENT-CASING-DRIFT (encerrada — destino canônico fixado, implementação
  pendente).
- **Superada por:** (preencher quando superada)

#### Referências

- `executei_8.md` (gitignored — relatório material da investigação read-only)
- `C:/unificard/REMEDIATION_DT_LOG.md` § DT-PAYMENT-CASING-DRIFT
- Commit `7c37f519` — fix: reverte CHECK em payment_transactions (DT-PAYMENT-CASING-DRIFT)
- Commit `7afd75ef` — C36 (cristalização original revertida)
- `docs/01_normative/07_NOMENCLATURA_CANONICA.md` §4.11 / §6 / §19.8
- `docs/01_normative/LEI_DE_COERÊNCIA_SISTÊMICA_UNIFICARD.md` §4.6 / §8
- DECISION-0028 (precedente — ratificação delimitada, escopo distinto)
- code.md §-4 / §23 / §24 (princípios fundacionais aplicados)
- Memória institucional: `feedback_boundary_domain_canonical`, `feedback_norma_ja_decide`,
  `project_hierarquia_epistemologica`

---

### DECISION-0033 — `canonical_products.type` é discriminator estrutural ontológico (categoria semântica distinta de status operacional)

- **Data:** 2026-05-12
- **Tipo:** arquitetural (semântica linguística — exceção formal restrita)
- **ID da violação (se aplicável):** C38 (subcaso parcial — `canonical_products`; demais 4 tabelas seguem caminho mecânico em sub-frente separada)
- **Contexto:**
  Investigação read-only de C38 (relatório `executei_9.md`, gitignored, 238 linhas)
  identificou que das 5 tabelas com coluna `type` genérico, 4 são correção mecânica
  trivial (renomear coluna `type` → `<entity>_type`, com CHECK ou valor já lowercase).
  A 5ª — `canonical_products.type` — apresenta natureza semântica distinta que
  exige decisão arquitetural específica.

  **Estado material atual de `canonical_products.type`:**
  - 35/35 registros em produção têm valor único `'INDUSTRIAL'` (UPPERCASE)
  - Sem CHECK constraint
  - Tipo TS é literal union de um único valor: `type: 'INDUSTRIAL'` (não enum
    operacional com variantes esperadas)
  - Predicado READY (§4.10 LEI_DE_COERÊNCIA) usa `type = 'INDUSTRIAL'` como
    **gate de pertinência estrutural** para fluxos transacionais
  - Comparações `IS DISTINCT FROM 'INDUSTRIAL'` em SQL helpers filtram
    pertinência ao subdomínio
  - Tabela `canonical_products` é catálogo canônico (entidade de produto
    industrial); nome carrega `canonical` denotando intenção de identidade
    ontológica
  - Linhagem futura prevista (`'COMMERCIAL'`, `'SERVICE'`) mas não materializada

  **Análise semântica decisiva:**
  `canonical_products.type` **não funciona como status operacional** (que
  varia entre estados de negócio: pending, paid, cancelled). Funciona como
  **discriminator de classe ontológica**: define a que categoria de entidade
  o registro pertence dentro do Core. É operacionalmente análogo a
  `entity_type`, `actor_type`, `event_type` — exceções canônicas já
  reconhecidas em `07_NOMENCLATURA_CANONICA` §3.4.

  O fato de existir apenas `'INDUSTRIAL'` hoje não enfraquece esse status:
  reforça que a coluna representa **classe de entidade**, não enum operacional
  dinâmica. Se fosse status operacional, esperaria-se variantes (pending/active/
  paid). Sendo discriminator, valor único significa "subdomínio único modelado
  até agora" — extensão futura para `'COMMERCIAL'`/`'SERVICE'` é cabível e
  arquiteturalmente prevista.

- **Opções consideradas:**

  1. **Opção A — Ratificar como exceção canônica formal (discriminator estrutural)** — ESCOLHIDA.
     - Reconhecer `canonical_products.type` como **discriminator de classe ontológica**, categoria semântica distinta de status operacional.
     - Alinhar com `entity_type`/`actor_type`/`event_type` em natureza (não em nome — cada um discrimina classe de seu próprio domínio).
     - Permite preservar `'INDUSTRIAL'` UPPERCASE como convenção análoga aos discriminators canônicos do §3.4.
     - Zero migration de schema, zero edição TS, zero alteração de comportamento runtime.

  2. **Opção B — Tratar como status operacional (DECISION-0032 prevalece, normalizar para lowercase)** — refutada.
     - Aplicaria §4.11 / §19.8 (status lowercase) sem distinção de categoria semântica.
     - Forçaria `'INDUSTRIAL'` → `'industrial'` + renomear coluna para `product_type`.
     - **Problema:** trataria coluna que NÃO é status como se fosse — normalização artificial por estética normativa, sem ganho semântico.
     - Toca código de runtime ativo (35 produtos em produção; predicado READY usa `type = 'INDUSTRIAL'` como gate em fluxos transacionais financeiros).
     - Mistura categorias ontologicamente distintas — exatamente o anti-padrão que §3.4 protege contra ao reconhecer exceções canônicas.

  3. **Opção C — Renomear coluna mantendo valor UPPERCASE** — refutada.
     - Caminho intermediário sem motivo arquitetural sólido.
     - Replica fragilidade de DECISION-0028 ("UPPERCASE intencional porque alguém escreveu assim") sem fundamento ontológico explícito.
     - Refutável pelo mesmo princípio que DECISION-0032 aplicou ao payment_*: sem evidência arquitetural fortíssima, exceção vira jeitinho institucional.

- **Escolha:** Opção A — `canonical_products.type` é **discriminator estrutural ontológico**, categoria distinta de status operacional, ratificada como exceção canônica formal alinhada à natureza de `entity_type`/`actor_type`/`event_type` (§3.4).

- **Justificativa:**
  Status operacional varia entre estados de negócio (pending/paid/cancelled) e é resolvido por DECISION-0032 (lowercase canônico, mapper na fronteira). Discriminator de classe ontológica define **a que categoria de entidade um registro pertence** dentro do Core; comporta-se semanticamente como `entity_type`/`actor_type`/`event_type` que §3.4 já reconhece como exceções canônicas — não pelo nome, mas pela natureza estrutural.

  Forçar normalização de `canonical_products.type` como se fosse status operacional aplicaria a regra correta na categoria errada. Norma aplicada fora do domínio que a justifica perde força institucional — vira estética normativa, não governança semântica.

  DECISION-0032 permanece íntegra: continua governando status operacional (payment_*, transaction_*, etc.). DECISION-0033 governa categoria distinta (discriminator ontológico) com mesmo rigor mas critério próprio.

- **EXIGÊNCIAS INSTITUCIONAIS (restrições explícitas para evitar buraco negro):**

  Esta exceção é **estritamente delimitada**. Para prevenir expansão oportunista
  ("ah então qualquer `type` agora pode ser UPPERCASE"), as seguintes restrições
  são obrigatórias:

  **Restrição 1 — Categoria limitada:**
  "Discriminator estrutural ontológico" é categoria semântica restrita, **não buraco
  negro para qualquer coluna chamada `type`**. Para uma coluna se qualificar como
  exceção análoga a esta DECISION, deve atender simultaneamente:
  - (a) Discriminar **classe de entidade** dentro de tabela canônica do Core
    (não classificação operacional, não enum de negócio)
  - (b) Funcionar como **gate estrutural** em fluxos canônicos do Core
    (predicado READY, validação de pertinência, etc.)
  - (c) Cristalizar em tipo TS como **literal de classe** (não union de
    estados operacionais)
  - (d) Pertencer a tabela com nome canônico (`canonical_*`, ou tabela com
    natureza ontológica explícita do Core)

  **Restrição 2 — Proibição de expansão oportunista:**
  Aplicar esta DECISION a colunas que não atendem TODAS as 4 condições da
  Restrição 1 é **violação institucional**. Em particular:
  - `payment_*.status`, `*_status` em geral → governados por DECISION-0032
    (lowercase canônico)
  - `<entity>_type` em tabelas operacionais (promotions, reconciliation_*,
    etc.) → renomeação mecânica + lowercase, **NÃO** se qualificam como
    discriminator estrutural
  - Qualquer pretendida nova exceção exige DECISION dedicada com prova de
    classe ontológica (não apenas argumentação por analogia ao caso desta
    DECISION)

  **Restrição 3 — Prova de classe ontológica obrigatória em DECISIONs futuras:**
  Qualquer DECISION futura que invoque DECISION-0033 como precedente para
  ratificar UPPERCASE deve documentar **prova material** dos 4 critérios da
  Restrição 1. Argumentação por analogia ("é parecido com canonical_products.type")
  é insuficiente. Sem prova → caminho default permanece DECISION-0032 (lowercase).

- **Consequências esperadas:**

  - **Curto prazo:**
    - `canonical_products.type` permanece como está. Zero migration, zero edição TS.
    - Subcaso de C38 (canonical_products) é resolvido sem ação técnica.
    - Demais 4 tabelas de C38 (`payment_execution_lock`, `promotions`,
      `reconciliation_discrepancies`, `reconciliation_ledger_discrepancies`)
      seguem caminho mecânico em sub-frente separada (Sub-frente 2):
      renomear coluna `type` → `<entity>_type` + lowercase canônico (CHECK
      ou valor já conformes em todas as 4).

  - **Médio prazo (alteração normativa formal):**
    - Esta DECISION **estabelece a posição arquitetural** mas não altera
      `07_NOMENCLATURA_CANONICA` §3.2 ou `SSOT_REGISTRY_UNIFICARD` por si só.
    - §10 do `00_AGENT_PROTOCOL` proíbe IA de alterar documentos normativos.
    - §3.2 do `07_NOMENCLATURA_CANONICA` exige processo formal: "novo conceito
      constitucional só pode ser adicionado após (1) atualização do
      SSOT_REGISTRY_UNIFICARD, (2) atualização deste documento, (3) aprovação
      formal em Gate, (4) RFC aprovado".
    - **Responsabilidade humana derivada:** Clayton (ou processo RFC) deve
      executar atualização normativa formal de §3.2 + SSOT_REGISTRY adicionando
      `canonical_product_type` (ou nome canônico equivalente) à lista de
      exceções estabelecidas, com referência a esta DECISION-0033 e suas
      restrições explícitas.
    - Até que essa atualização normativa formal aconteça, o status operacional
      é: DECISION-0033 vigente como decisão arquitetural; alteração de §3.2 e
      SSOT_REGISTRY pendente de RFC humano.

  - **Longo prazo:**
    - Modelagem futura de `'COMMERCIAL'`, `'SERVICE'` em `canonical_products`
      (se vier a ser necessária) opera dentro da exceção desta DECISION:
      valores UPPERCASE preservados, tipo TS expandido como `'INDUSTRIAL' |
      'COMMERCIAL' | 'SERVICE'`, predicado READY ajustado conforme regra de
      negócio.
    - Qualquer pretendida nova exceção análoga (outro `*_type` UPPERCASE)
      requer DECISION dedicada com prova material dos 4 critérios — sem
      atalho via "precedente DECISION-0033".

  - **Não autoriza:**
    - Aplicar UPPERCASE em outras colunas `type` por analogia genérica
    - Atualizar `07_NOMENCLATURA_CANONICA` ou `SSOT_REGISTRY` por IA
    - Implementação direta para outras 4 tabelas de C38 (segue caminho
      mecânico Sub-frente 2)
    - Modificação de `canonical_products.type` em qualquer dimensão (schema,
      tipo TS, valor) — preservar como está

- **Responsável:** Clayton (decisão soberana) — multi-agente: Claude Code
  (investigação material `executei_9.md` + redação derivada do framework
  estabelecido), Clayton (refinamento da natureza ontológica + 2 exigências
  institucionais explícitas + decisão soberana).
- **Validação prévia:** investigação read-only `executei_9.md` (cobertura
  norma + persistência + runtime + tipos cristalizados); contraste com
  exceções canônicas já estabelecidas em §3.4 (`entity_type`/`actor_type`/
  `event_type`); contraste com DECISION-0028 (precedente UPPERCASE delimitado
  mas com fundamento mais frágil — esta DECISION explicita o critério que
  faltava lá).
- **Supera:** subcaso `canonical_products` de C38 (resolvido sem ação técnica).
- **Superada por:** (preencher quando superada)

#### Referências

- `executei_9.md` (gitignored — relatório material da investigação read-only)
- `docs/03_execution_log/2026-05-12_investigacao_C38_C39_drift_type_state.md`
- Commit `dbef2569` — C39 NOT-A-BUG (sub-frente paralela de C38/C39)
- `docs/01_normative/07_NOMENCLATURA_CANONICA.md` §3.2 / §3.4 / §3.5
- `docs/01_normative/LEI_DE_COERÊNCIA_SISTÊMICA_UNIFICARD.md` §4.10 (predicado READY)
- DECISION-0028 (precedente UPPERCASE delimitado — esta DECISION explicita
  critério ontológico que aquela invocou implicitamente)
- DECISION-0032 (categoria distinta — status operacional, lowercase canônico)
- code.md §-4 (visão fundacional), §23 (como pensar antes de codar), §24
  (camadas N0/N1/N2/CATEGORIES/CONCEPT)
- Memória institucional: `feedback_norma_ja_decide` (norma aplicada na
  categoria errada perde força)

#### Pendência derivada (responsabilidade humana)

Atualização normativa formal de `07_NOMENCLATURA_CANONICA` §3.2 + `SSOT_REGISTRY_UNIFICARD`
adicionando `canonical_product_type` (ou nome canônico equivalente) como
exceção estabelecida, com referência explícita às 3 Restrições desta
DECISION. Pode ser feita por Clayton diretamente ou via RFC — **não por IA**
(§10 AGENT_PROTOCOL).

---

### DECISION-0036 — `bank_splits` schema migra para target_account_id (refactor account-centric preservando compatibilidade actor-only original)

- **Data:** 2026-05-13
- **Tipo:** arquitetural (refactor schema soberano + ratificação de premissa ontológica)
- **ID da violação (se aplicável):** B8 (bug arquitetural descoberto em smoke v3 dinâmico F7→F8; `bank_splits.resolveTargetActorId` rejeita destinos system)
- **Contexto material:**
  Smoke v3 fundacional dinâmico (executei_22 → F7 → F8) revelou contradição estrutural
  entre 3 camadas do sistema sobre semântica de `bank_splits`:

  | Camada | Visão sobre bank_splits |
  |---|---|
  | Schema soberano (`0003_bank_core.sql:83-93`) | "splits entre atores" — `target_actor_id UUID NOT NULL → actors(id)` |
  | Repository INSERT (`bank-split.repository.ts:31-53`) | Tenta cumprir schema resolvendo actor de account; falha para destinos system com `owner_id` composto |
  | Consumers SELECT (3 arquivos) | Esperam `target_account_id` (coluna que NÃO existe no schema atual); `split_type='fee'` para destinos SYSTEM |

  Schema NÃO foi migrado para refletir intenção dos consumidores. Drift estrutural
  histórico entre schema soberano e código consumer. Bug B8 nunca manifestou em
  runtime real porque smoke v3 fundacional dinâmico só foi executado em F7→F8.

  **Investigação material consolidada em `executei_24.md` (gitignored)** com:
  - 4 fatos arquiteturais decisivos (schema, repository, 3 consumers, comentário arquitetural reporting-bank-aggregates.ts:5)
  - 3 opções avaliadas com prós/contras (α refactor schema, β actors sistêmicos, γ filtrar repository)
  - Recomendação fundamentada com 5 justificativas materiais
  - 4 verificações pré-execução pendentes
  - Plano operacional faseado em 7 etapas

- **Premissa ontológica elevada a invariante (responsabilidade institucional):**

  > **Conta = destino financeiro soberano; actor = camada contextual/autoritativa.**

  Material verificado:
  - `bank_ledger` opera sobre `account_id` (não `actor_id`)
  - `bank_accounts.owner_id` aceita `'system:fee:tenantId'` (string composta, sem actor)
  - Split engine `event_ticket` gera destinos onde target é conta sistêmica (fee/regional_fund/reserve)
  - 3 consumers já leem por `target_account_id` (não `target_actor_id`)

  Esta premissa **não é justificativa local desta DECISION** — é articulação do modelo
  financeiro fundamental do UnifiCard. Pendência derivada (responsabilidade humana, §10
  AGENT_PROTOCOL): considerar adendo em `07_NOMENCLATURA_CANONICA` ou
  `LEI_DE_COERÊNCIA_SISTÊMICA` em sessão dedicada futura (não por IA).

- **Evolução arquitetural reconhecida:**

  `bank_splits` originalmente modelava apenas fluxos **actor→actor**. A evolução do
  runtime introduziu destinos **account-centric sistêmicos** (fee/regional_fund/reserve
  via split engine event_ticket) **não representáveis pelo schema original**. Esta
  DECISION **não invalida** a história — **expande** o schema para suportar destinos
  account-centric modernos preservando compatibilidade com o passado.

- **Audit material da bank_splits histórica (read-only, 2026-05-13):**

  Verificação `SELECT COUNT(*) FROM bank_splits` revelou **2 rows existentes** (não 0
  como inicialmente previsto). Caracterização material:

  | Atributo | row 0 | row 1 |
  |---|---|---|
  | `tenant_id` | `fbe13b78` | `fbe13b78` (mesmo) |
  | `source_actor_id` | `6510c69c` (actor_type='user') | `6510c69c` (mesmo) |
  | `target_actor_id` | `475a7d45` (actor_type='user') | `475a7d45` (mesmo) |
  | `amount_cents` | 40000 | 40000 |
  | `split_type` | `revenue_share` | `revenue_share` |
  | `percentage` | 100.00 | 100.00 |
  | `created_at` | 2026-04-30 14:44 | 2026-04-30 15:22 |

  **Backfill determinístico confirmado (preview SQL):** target_actor `475a7d45` tem
  **1 bank_account única** (`cf544aaa`, owner_type='actor', account_type='credit'),
  sem ambiguidade. Statement 3 da migration (`UPDATE ... FROM bank_accounts ba WHERE
  ba.actor_id = bs.target_actor_id`) resolve as 2 rows trivialmente 1:1 sem
  decisão manual.

  Conclusão: as 2 rows são caso simples (actor→actor revenue_share legítimo do
  modelo original); reconciliação histórica complexa **não se aplica**; categoria
  da migration permanece "expansion schema" e não "reconciliação".

- **Opções consideradas:**

  1. **Opção B8.α — Refactor schema: migrar bank_splits para `target_account_id`** — ESCOLHIDA.
     Adiciona `target_account_id UUID REFERENCES bank_accounts(id)`; torna `target_actor_id`
     NULLABLE; repository simplificada deletando `resolveTargetActorId`; alinha schema com
     intenção dos consumidores; permite splits uniformemente para destinos atorial+system;
     preserva memória operacional (target_actor_id continua populated quando target tem actor).

  2. **Opção B8.β — Criar actors sistêmicos canônicos** (`fee_actor`, `regional_fund_actor`,
     `reserve_actor` por tenant) — refutada.
     - Quebra invariante semântica "actor = pessoa/page real"
     - Tabela `actors` contaminada com entidades virtuais sistêmicas
     - NÃO resolve drift dos consumers (que esperam `target_account_id`)
     - Conceito difícil: "o que é actor de fee?"
     - Mais invasivo: mexe em `ensurePlatformAccounts` + actor semantics

  3. **Opção B8.γ — Filtrar em repository: NÃO inserir splits system em bank_splits** — refutada.
     - Quebra `sumPlatformFeeFromBankSplitsCents` (agregação fee fica sempre 0)
     - Amputa funcionalidade declarada (reporting de fee)
     - Contradiz comentário arquitetural `reporting-bank-aggregates.ts:5` ("comissão/fee via bank_splits.split_type = 'fee'")
     - NÃO resolve drift dos consumers (target_account_id)

- **Escolha:** Opção B8.α — refactor schema account-centric preservando compatibilidade.

- **Decisão sobre `source_actor_id` (invariância vs simetria):**

  Investigação material curta sobre `source_actor_id` consolidada nesta DECISION:

  | Evidência | Implicação |
  |---|---|
  | 2 rows existentes: 100% source `actor_type='user'` | Nenhum source system em runtime histórico |
  | `bank-split.repository.ts:197-201` rejeita explicitamente source não-UUID-actor (`"actingForActorId deve ser UUID de actor válido"`) | Repository já enforce invariante source atorial |
  | `financial-authorship.helper:118` fallback `'system'` é STRING (não UUID) | Sistema atual quebra se passar system como source |
  | Padrão arquitetural: debit é sempre de payer/comprador/passenger atorial | Splits são disparados por ação de actor |

  **Decisão (a) — `source_actor_id` permanece UUID NOT NULL REFERENCES actors(id).** Invariante
  declarada: **source de split é sempre debitado atorial (comprador, payer, passenger).
  System nunca é source de split nesta versão.**

  Justificativa material: ausência de evidência de caminho real com source system; introduzir
  `source_account_id` paralelo agora seria especulação sem demanda material (princípio §25
  norma assintótica — não cristalizar suporte para hipótese sem evidência).

  Pendência preservada: se futuro path real exigir source system (ex.: governance funding
  automatizado, refund automático sem actor proxy), DECISION posterior pode introduzir
  simetria `source_account_id` NULLABLE. Esta DECISION não bloqueia evolução futura.

- **Migration soberana declarada (a executar em sessão posterior):**

  ```sql
  BEGIN;

  -- Statement 1: adicionar target_account_id (NULLABLE durante backfill)
  ALTER TABLE bank_splits ADD COLUMN target_account_id UUID
    REFERENCES bank_accounts(id);

  -- Statement 2: tornar target_actor_id NULLABLE (preserva FK historical)
  ALTER TABLE bank_splits ALTER COLUMN target_actor_id DROP NOT NULL;

  -- Statement 3: backfill determinístico das 2 rows actor→actor existentes
  -- Política de backfill especificada:
  -- - JOIN único ba.actor_id = bs.target_actor_id (mapeamento canônico actor→primary account)
  -- - Múltiplas accounts por actor: política primeira created_at ASC (NÃO aplicável às
  --   2 rows existentes — verificado pré-migration: 1 account por actor sem ambiguidade)
  -- - Fallback ba.owner_id = actor_id direto (NÃO aplicável às 2 rows existentes —
  --   verificado pré-migration: actor_id resolve via FK actors.id)
  UPDATE bank_splits bs SET target_account_id = ba.id
    FROM bank_accounts ba
    WHERE ba.actor_id = bs.target_actor_id
      AND ba.tenant_id = bs.tenant_id;

  -- Statement 4: validação pós-backfill (zero rows com target_account_id NULL após backfill)
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM bank_splits WHERE target_account_id IS NULL) THEN
      RAISE EXCEPTION 'bank_splits backfill incompleto: rows com target_account_id NULL';
    END IF;
  END $$;

  -- Statement 5: tornar target_account_id NOT NULL após validação
  ALTER TABLE bank_splits ALTER COLUMN target_account_id SET NOT NULL;

  -- Statement 6: índice para queries dos consumers (transparency, economic-overview, reporting)
  CREATE INDEX idx_bank_splits_target_account ON bank_splits(target_account_id);

  COMMIT;
  ```

  `source_actor_id` permanece UUID NOT NULL REFERENCES actors(id) (decisão (a) acima).

- **Repository refactor declarado (a executar em sessão posterior):**

  - `resolveTargetActorId` em `bank-split.repository.ts:31-53` **DELETADA**.
  - `createSplitWithAuthorship` (linha 175+) **simplificada**:
    - Insere `target_account_id` direto (recebido como `input.targetAccountId`).
    - Continua populando `target_actor_id` quando conta de destino tem `actor_id` válido (preserva legacy reads); NULL quando target é system.
    - `source_actor_id` continua via `authorship.actingForActorId` com UUID check (linhas 197-201) inalterado.

- **Verificações pré-execução restantes (a executar em sessão posterior antes da migration):**

  1. **Volume bank_splits** ✓ EXECUTADA (2 rows, audit determinístico confirmado nesta DECISION)
  2. **Auditar checks `target_actor_id IS NOT NULL`** no backend (grep TS) — garantir que tornar NULLABLE não quebra invariantes silenciosamente
  3. **Auditar uso de `source_actor_id`** confirmar que source É sempre atorial — ✓ EXECUTADA (4 evidências convergentes registradas acima)
  4. **Índices existentes** — `idx_bank_splits_target` em `target_actor_id` (criado 0003_bank_core.sql:97); decidir se manter ou substituir paralelo a `idx_bank_splits_target_account`

  Verificações 1 e 3 ✓ executadas nesta DECISION. Verificações 2 e 4 ficam para sessão de implementação.

- **Plano operacional faseado (sessão posterior, autorização Clayton explícita):**

  | Etapa | Modo | Esforço |
  |---|---|---|
  | 1. Verificações 2 e 4 restantes | GUARDIÃO | ~20min |
  | 2. Migration soberana `_bank_splits_target_account_id.sql` | EXECUTOR | ~30min |
  | 3. Refactor `bank-split.repository.ts` (resolveTargetActorId deletada; createSplitWithAuthorship simplificada) | EXECUTOR | ~30min |
  | 4. TSC + 4 gates institucionais | Validação | ~10min |
  | 5. Re-executar smoke v3 dinâmico (P9 deve avançar para P10-P14) | EXECUTOR | ~10min |
  | 6. Commit isolado F9 + log institucional | EXECUTOR | ~10min |
  | 7. Atualizar STATUS_EXECUCAO_GLOBAL.md (HK7) | EXECUTOR | ~15min |

  Total estimado: 1-2 sessões dedicadas (dependente de bugs descobertos em P10-P14).

- **Justificativa:**

  Schema canônico atual de `bank_splits` (FK NOT NULL → actors) é **modelo histórico**
  preservado de fase antiga (apenas splits actor→actor). Evolução do split engine
  event_ticket introduziu destinos system (fee/regional_fund/reserve) que **não se
  encaixam no modelo original**. 3 consumidores foram codificados com expectativa de
  schema account-centric (`target_account_id`) — schema NÃO foi migrado.

  **Refactor para target_account_id é convergência necessária**, não decisão entre
  arquiteturas concorrentes. As 2 rows históricas existentes **fortalecem** a DECISION:
  provam que modelo actor→actor existiu, foi usado legitimamente, e é compatível com a
  nova proposta (backfill determinístico 1:1).

  Premissa ontológica declarada ("conta = destino financeiro soberano; actor = camada
  contextual/autoritativa") **emerge** dessa convergência — não é decisão local mas
  articulação do modelo financeiro fundamental verificado em 4 camadas materiais
  (bank_ledger account-centric, owner_id composto system, split engine destinos system,
  consumers target_account_id).

- **Consequências esperadas:**

  - **Curto prazo:** após implementação faseada (sessão posterior), smoke v3 P9 deve
    avançar para P10-P14 (split de event_ticket persistido em bank_splits com destinos
    system). DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO converge para CLOSED após smoke 14/14 PASS.

  - **Médio prazo:** consumers (transparency, economic-overview, reporting) ficam
    funcionais sem mudança (já leem `target_account_id`). Reporting de fee
    (`sumPlatformFeeFromBankSplitsCents` com `split_type='fee'`) começa a retornar
    valores reais conforme splits são persistidos.

  - **Longo prazo:** schema canônico de `bank_splits` reflete runtime real. Futuras
    evoluções (ex.: source system se necessário) podem ser tratadas via DECISIONs
    posteriores sem mexer no fundamento account-centric estabelecido aqui.

- **Não autoriza:**

  - **Implementação direta da migration nesta sessão.** Esta DECISION é formalização
    institucional documental. Implementação é sessão posterior dedicada com autorização
    Clayton explícita.
  - **Refactor de bank-split.repository.ts nesta sessão.** Mesma razão.
  - **Re-execução de smoke v3 nesta sessão.** Mesma razão.
  - **Adendo a `07_NOMENCLATURA_CANONICA` ou `LEI_DE_COERÊNCIA_SISTÊMICA`** referenciando
    premissa ontológica account-centric — responsabilidade humana/RFC §10 AGENT_PROTOCOL.
  - **Decisão sobre `source_account_id` simétrico futuro** — DECISION posterior se
    demanda material emergir.

- **Responsável:** Clayton (decisão soberana) — multi-agente: Claude Opus 4.7
  (investigação material + redação derivada do framework estabelecido), Clayton
  (refinamentos materiais: premissa ontológica elevada, volume bank_splits como
  evidência, decisão explícita sobre source, política de backfill especificada),
  IA externa (audit material + ratificação da abordagem absorver legado).

- **Validação prévia:** investigação read-only consolidada em `executei_24.md`
  (gitignored — DRAFT material com 4 fatos arquiteturais decisivos, 3 opções
  comparadas, recomendação fundamentada); audit material adicional desta sessão
  (volume bank_splits + caracterização das 2 rows + análise determinística do
  backfill + investigação source confirmando invariante atorial); contraste com
  evolução histórica de bank-integration (DECISION-0031) e padrões de absorção
  do legado (F8 commit `02fde77d`).

- **Supera:** B8 OPEN registrado em F7 (executei_21) — agora encaminhado para
  resolução via refactor schema (sessão posterior).

- **Superada por:** (preencher quando superada — provável: DECISION futura
  introduzindo `source_account_id` simétrico se demanda material emergir; ou
  DECISION revertendo refactor se evidência contrária a target_account_id surgir,
  improvável dado material auditado).

#### Referências

- `executei_24.md` (gitignored — DRAFT material com 4 fatos arquiteturais decisivos)
- `executei_21.md` + `executei_22.md` (gitignored — descoberta inicial de B8 e correção do erro material #3)
- `docs/03_execution_log/2026-05-13_f8_event_economy_delega_bank_integration.md` (F8 commit `02fde77d`)
- Commit `8f85ba31` (F7 — registro inicial de B8 como bug arquitetural)
- `backend/migrations/0003_bank_core.sql:83-93` (schema atual bank_splits)
- `backend/src/modules/bank/bank-split.repository.ts:31-53, 175-231` (repository INSERT)
- `backend/src/core/unifybank/transparency.service.ts:441` (consumer #1)
- `backend/src/modules/economy/economic-overview.projector.ts:18-19` (consumer #2)
- `backend/src/modules/reporting/reporting-bank-aggregates.ts:5-44` (consumer #3 + intenção arquitetural declarada)
- `backend/src/modules/bank/financial-authorship.helper.ts:118` (fallback 'system' como STRING não-UUID)
- DECISION-0031 (precedente — pattern multi-AI audit + Clayton soberano)
- code.md §25 (norma assintótica — não cristalizar suporte para hipótese sem evidência)
- Memória institucional: `feedback_norma_ja_decide`, `project_hierarquia_epistemologica`, `feedback_autonomia_operacional` (calibração 2026-05-13)

#### Impacto em DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO

DT permanece OPEN. Após implementação faseada (sessão posterior):
- P9 deve avançar (bank_splits aceita destinos system)
- P10 (validar 4 splits ledger) — provável PASS
- P11 (reserve fundada via split) — provável PASS
- P12 (system_coverage bigint > 0) — provável PASS
- P13 (P2P canônico) — pode revelar bugs P2P
- P14 (double-entry + bigint) — provável PASS

DT pode ser CLOSED após smoke v3 completar 14/14 PASS + v2 deletado/deprecated.

#### Pendência derivada (responsabilidade humana, §10 AGENT_PROTOCOL)

Considerar (em sessão dedicada futura, não por IA) adendo formal em
`07_NOMENCLATURA_CANONICA` ou `LEI_DE_COERÊNCIA_SISTÊMICA_UNIFICARD` referenciando
a premissa ontológica:

> **Conta = destino financeiro soberano; actor = camada contextual/autoritativa.**

Esta premissa emerge desta DECISION mas se aplica a todo o sistema financeiro do
UnifiCard (bank_ledger account-centric, owner_id composto system, split engine
destinos system, consumers target_account_id). Formalização em camada normativa
soberana é responsabilidade humana/RFC.

---





### DECISION-0037 — Ratificação de `unified-availability` como SSOT temporal soberana + mapeamento de projeções

- **Data:** 2026-05-16
- **Tipo:** arquitetural (ratificação institucional de convergência silenciosa pré-existente)
- **ID da violação (se aplicável):** N/A — emerge do inventário Frente 2 (MODULES_INVENTORY.md seção 5 Padrão 1)
- **Contexto material:**
  Frente 2 (sessão 1+2) descobriu que `core/availability/unified-availability.*` já existe como API completa (createAvailability, createBooking, checkIn, checkOut, **detectConflicts**) com runtime real: `availability` (20 rows) + `bookings` (24 rows) + `availability_participants`. A narrativa prévia (Sunny + ChatGPT) assumia que Agenda Universal precisava ser criada — material refutou: **já existe e é exercitada**.

  Análise material do Padrão 1 (com critério Sunny — 80%+ Jaccard OU domínios mutuamente exclusivos): 4 tabelas paralelas modelam conceito semanticamente equivalente a `availability`:

  | Tabela paralela | Convergência possível | Razão material |
  |---|---|---|
  | `event_sessions` (10 cols: starts_at/ends_at/capacity) | Projetar como availability(owner_type='event') | Mesma natureza (janela+capacity); convergência via View |
  | `rides_driver_sessions` (7 cols: started_at/ended_at/is_online) | Projetar como availability(owner_type='driver') | Mesma natureza; driver session é availability com online flag |
  | `pdv_sessions` (9 cols: opened_at/closed_at) | Projetar como availability(owner_type='pdv') | Janela de PDV; convergência por projeção |
  | `schedules + schedule_slots` | Template recorrente gera availabilities concretas | Schedule é template; availability é manifestação |

  `services` foi falso positivo da hipótese original — é catálogo (não temporal), não pertence ao padrão.

  `bookings` ↔ `event_reservations` é par paralelo (reserva sobre janela); `event_reservations` adiciona `payment_bank_transaction_id`. Convergência via projeção também.

- **Decisão:**
  **`unified-availability` é a SSOT temporal soberana do sistema para janelas + capacidade.** As 4 tabelas paralelas (event_sessions, rides_driver_sessions, pdv_sessions, schedules+schedule_slots) e `event_reservations` são reconhecidas como projeções/consumidoras potenciais. Convergência arquitetural é frente futura — esta DECISION ratifica o status atual + cristaliza a direção.

- **Restrições explícitas anti-buraco-negro:**
  1. **NÃO implementar convergência agora.** Esta DECISION ratifica o status, não autoriza refactor. Convergência exige sessão dedicada por par de tabelas.
  2. **NÃO criar SSOT temporal paralela.** Qualquer novo módulo que precise modelar "janela temporal + capacidade" deve usar `unified-availability` via `owner_type+owner_id`. Tabela própria exige justificativa arquitetural explícita + DECISION nova.
  3. **`services` permanece como catálogo (não temporal).** Não confundir com availability. Service.availability emerge via FK `availability.owner_type='service'+owner_id=service_id` quando aplicável.

- **Referência material:** `MODULES_INVENTORY.md` seção 5 Padrão 1; DT-CONVERGENCE-AVAILABILITY-AS-CANONICAL-TEMPORAL no REMEDIATION_DT_LOG.md.

---

### DECISION-0038 — Princípio "código aspiracional ≠ capacidade": inventário formal obrigatório antes de presumir feature

- **Data:** 2026-05-16
- **Tipo:** institucional (princípio operacional soberano + critério de governança)
- **ID da violação (se aplicável):** N/A — emerge do inventário Frente 2 (29 FANTASMAs descobertos)
- **Contexto material:**
  Inventário Frente 2 classificou 157 módulos backend e descobriu **29 FANTASMAs** (18%) — código que referencia tabelas inexistentes. **24 dos 29 têm frontend caller** (endpoints chamados pelo frontend que falham em runtime). Top 5 em rotas: work-instant (14), venue (12), policy-engine (11), presence (11), automation (10).

  Risco institucional material: próximo desenvolvedor (humano ou IA) pode olhar `backend/src/modules/` e contar 80 módulos como capacidade. **Não é capacidade.** Subset operacional real é ~71 funcionais (45%). 60+ módulos são código aspiracional sem fundo.

  Sintoma adicional: a narrativa anterior (Sunny + ChatGPT) estimou "15-20 funcionais de 80" — erro de 4× para baixo por extrapolação de poucos exemplos prioritários. Sem inventário formal sustentado por dados, percepção de capacidade fica ao gosto do observador.

- **Decisão:**
  **Antes de iniciar nova frente que dependa de módulo X, IA ou humano deve verificar em inventário formal: (a) tabelas referenciadas existem? (b) rows > 0? (c) frontend chama? (d) classificação FUNCIONAL/ESQUELETO/FANTASMA.** Sem essa verificação, presumir capacidade é anti-padrão institucional.

  Inventário formal vigente: `MODULES_INVENTORY.md` (raiz, sessão 2026-05-16). Reprodutível via queries listadas em apêndice A.

- **Restrições explícitas:**
  1. **Inventário formal tem janela de validade** — quando 30%+ dos módulos mudarem classificação (estimativa de 90+ dias), inventário precisa re-executado.
  2. **Mudança de classificação de módulo** (FANTASMA → FUNCIONAL ou inverso) exige DT específica + atualização de inventário.
  3. **NÃO substituir inventário formal por percepção informal.** Frase "o módulo X existe" não é dado material — verificar inventário primeiro.

- **Princípio operacional registrado (Clayton, 2026-05-16):**

  > **"Sistemas morrem na hora em que começam a convergir — porque equipe acelera, engines paralelas surgem, authority duplica, presença duplica, agenda duplica, tudo fragmenta. Vocês estão fazendo o contrário: congelando ANTES da fragmentação cristalizar."**

  Esta DECISION materializa o princípio: inventário formal + congelamento explícito de FANTASMAs/DORMENTES = mecanismo institucional anti-fragmentação preventivo.

- **Referência material:** `MODULES_INVENTORY.md` seções 0+2+10; DT-MODULES-ASPIRATIONAL-VS-RUNTIME no REMEDIATION_DT_LOG.md.

---

### DECISION-0039 — Modo operante v1 ratificado como projeção UX hardcoded; v2 dinâmico aguarda 3 frentes prévias

- **Data:** 2026-05-16
- **Tipo:** arquitetural (formalização institucional de tradeoff consciente)
- **ID da violação (se aplicável):** N/A — formaliza implementação da sessão 2026-05-16 + descobertas Frente 2
- **Contexto material:**
  v1 do modo operante foi implementado em 2026-05-16 como projeção UX hardcoded em `frontend/src/config/actorContextConfig.ts` — listas estáticas de quick actions por `(actor_type, mode)` com 2 modos (Consumir/Operar), cross-mode hint, persistência localStorage por actor.

  Definição soberana (memória `project_modo_operante.md`): "Modo operante NÃO cria capability, REVELA capabilities já autorizadas." Implementação v1 não realiza essa definição materialmente — usa lista hardcoded em vez de resolver dinâmico de `actor_delegations` + `company_users` + `authority_decision_audit`.

  Frente 2 (inventário) confirmou que v2 dinâmico depende de **3 frentes prévias**, não apenas de "esperar C27":
  1. `actor_delegations` ter runtime real (hoje 0 rows — DT-ACTOR-DELEGATIONS-ZERO-RUNTIME)
  2. **DECISÃO ARQUITETURAL sobre P5** (qual modelo de vínculo absorve o caso canônico — DT-OPERATIONAL-BINDING-FRAGMENTATION)
  3. **DECISÃO ARQUITETURAL sobre P4** (qual modelo de presença absorve — DT-PRESENCE-FRAGMENTATION-CONFIRMED)

  Mesmo C27 resolvido, sem P4 + P5 decididos, v2 reproduz Frankenstein.

- **Decisão:**
  **v1 modo operante (hardcoded, frontend-only) é ratificado como projeção UX correta para o estágio atual.** É tradeoff consciente que valida UX antes de investir em resolver dinâmico. Não é dívida a ser corrigida — é fundação de validação.

  **v2 dinâmico permanece bloqueado** até as 3 frentes prévias materializarem. Sem elas, v2 é decisão arquitetural prematura.

- **Restrições explícitas:**
  1. **NÃO substituir v1 hardcoded por resolver dinâmico** sem antes resolver as 3 frentes prévias.
  2. **NÃO adicionar 3º modo operante** (Investir/Governar/etc) sem MVP v1 validado primeiro. MVP rigorosamente Consumir/Operar.
  3. **NÃO usar profession como ACL implícita** — profission é hint dentro de Operar quando v2 emergir; nunca autorização (DT-PROFESSION-DATA-SPARSE: 3/61 profiles populados hoje, hint vazio para 95%).
  4. **NÃO persistir mode em schema backend** — runtime localStorage é parte do tradeoff v1.

- **Critério de progressão v1 → v2:**
  Quando simultaneamente: (a) primeira delegação real exercitada via UI, (b) DECISION arquitetural P5 (vínculo) tomada, (c) DECISION arquitetural P4 (presença) tomada, e (d) autorização explícita Clayton para v2 — então frente nova abre.

- **Referência material:** memória `project_modo_operante.md`; `MODULES_INVENTORY.md` seção 5 (P4+P5) + 5.B; DT-OPERATING-MODE-STATIC-PROJECTION + DT-ACTOR-DELEGATIONS-ZERO-RUNTIME + DT-PRESENCE-FRAGMENTATION-CONFIRMED + DT-OPERATIONAL-BINDING-FRAGMENTATION.

---

### DECISION-0040 — FANTASMAs com frontend caller — ratificação das decisões caso a caso (top 5 + 19 restantes)

- **Data:** 2026-05-16
- **Tipo:** institucional (ratificação de classificação operacional + critério de descongelamento)
- **ID da violação (se aplicável):** N/A — emerge do inventário Frente 2 (MODULES_INVENTORY.md seção 10)
- **Contexto material:**
  29 módulos backend foram classificados como FANTASMA na Frente 2 (referenciam tabelas inexistentes). 24 desses têm frontend caller — endpoints chamados pelo frontend que falham em runtime. Decisões propostas pela auditoria foram ratificadas por Clayton + ChatGPT + Opus (convergência total).

- **Decisão (top 5 ratificada):**

  | Módulo | Rotas | Decisão ratificada | DT específica |
  |---|---:|---|---|
  | `modules/work-instant` | 14 | **CONGELAR pre-P4-P5-delegations** | DT-MODULE-WORK-INSTANT-FROZEN-PRE-P4-P5 |
  | `modules/venue` | 12 | **CONGELAR pre-vertical restaurant** | DT-MODULE-VENUE-FROZEN-PRE-RESTAURANT-VERTICAL |
  | `modules/policy-engine` | 11 | **AUDITORIA_HUMANA_URGENTE** (possível conflito com authority chain) | DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE |
  | `modules/presence` | 11 | **CONGELAR pre-P4-decision** | DT-MODULE-PRESENCE-FROZEN-PRE-P4-DECISION |
  | `modules/automation` | 10 | **AUDITORIA_HUMANA** (possível duplicação com bank alerts) | DT-MODULE-AUTOMATION-AUDIT-PRE-OVERLAP-CHECK (pendente registro no PASSO 2) |

- **Decisão (19 restantes — classificação proposta na Frente 2):**

  | Categoria | Qtd | Módulos |
  |---|---:|---|
  | CONGELAR | 6 | evidence, loyalty, subscriptions, invoicing, memory, (+ 1 dos PROVISÓRIOs prováveis) |
  | AUDITORIA_HUMANA | 9 | agreements, contextual-messaging, payout, reporting, system-notifications, votes, social-actions, care, user-group-allocation |
  | CRIAR_TABELA | 2 | core/root-config, core/residence |
  | PROVISÓRIO (aguarda ratificação final) | 3 | business-audit, media, social-chat |

  Detalhamento em `MODULES_INVENTORY.md` seção 10.

- **Restrições explícitas:**
  1. **CONGELAR ≠ apagar.** Módulos congelados mantêm código no disco. Rotas frontend devem ser escondidas/desabilitadas (não removidas sem nova DECISION).
  2. **AUDITORIA_HUMANA ≠ implementar.** São pendências humanas. Cada uma exige decisão pré-implementação (criar tabela vs remover endpoint vs consolidar com tabela existente).
  3. **Frente própria por módulo AUDITORIA_HUMANA** quando primeiro uso real emergir. Não tentar resolver todos os 11 simultaneamente.
  4. **policy-engine é URGENTE** porque pode conflitar com authority chain canônica (`authorization.service.ts` + `authority_decision_audit`). Implementar policy_rules sem decisão arquitetural reproduziria authority paralela — anti-padrão C27.

- **Critério institucional de descongelamento:**
  Cada DT-MODULE-*-FROZEN tem critério de descongelamento próprio (referência `REMEDIATION_DT_LOG.md`). Nenhum descongelamento sem critério satisfeito + DECISION nova.

- **Referência material:** `MODULES_INVENTORY.md` seção 10 (24 FANTASMAs); REMEDIATION_DT_LOG.md (DTs de congelamento específicas).


### DECISION-0041 — policy-engine como módulo de risk-management isolado (não authority paralela)

- **Data:** 2026-05-16
- **Tipo:** arquitetural (classificação de domínio + congelamento consciente de módulo prematuro)
- **ID da violação (se aplicável):** N/A — emerge de auditoria material da DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE (Frente 4, sprint Priorização)
- **Contexto material:**
  Auditoria material READ-ONLY de `backend/src/modules/policy-engine/*` (5 arquivos, 1343 linhas) + frontend callers + cruzamento com authority chain canônica respondeu as 4 perguntas binárias inicialmente abertas:

  | # | Pergunta | Resposta | Evidência material |
  |---|---|---|---|
  | 1 | É replacement do authority atual? | **NÃO** | `policy.routes.ts:31-44` middleware `requirePolicyPermission` chama `businessAuthorizationService.requirePermission(tenantId, userId, actor.actor_id, 'financial:view_all_ledger', 'policy_engine')` — USA authority como dependência |
  | 2 | É overlay sobre authority? | **NÃO no domínio de permissão.** SIM no domínio adjacente de risk-management/enforcement | Authority responde "actor pode X?"; policy-engine responde "actor deve ser temporariamente restrito por behavior?" |
  | 3 | É obsoleto (substituído)? | **NÃO** | Papel próprio integrado com risk-command-center + trust + evidence (módulos vivos); RiskCommandCenterPage chama `evaluatePoliciesForActor` + `applyPolicyDecision` |
  | 4 | Se replacement: plano de migração? | **N/A** | Não é replacement |

  Domínio material confirmado: risk-management/enforcement com decisão humana.
  - `PolicyType`: `feature_throttling | temporary_block | manual_review_required`
  - `PolicyAction`: `limit_rfq_creation, block_messaging, require_review_payout, ...`
  - `PolicyCondition`: `minRiskLevel, maxTrustScore, hasOpenDisputes, bypassDetectedLast30Days, financialVolumeCents`
  - `evaluatePoliciesForActor` busca `riskDashboardService.getActorRiskProfile` + `trustRepository.findByActor`
  - `applyPolicyDecision` cria `Evidence Pack` (`evidenceService.getOrCreatePack(...contextType:'risk_command_center')`)
  - Blindagens documentadas no código: "Nenhuma sanção automática", "Todas as decisões são explícitas e humanas", "Tudo reversível"

- **Decisão:**
  **policy-engine ocupa domínio próprio (risk-management/enforcement). Authority chain (`authorization.service` + `actor_delegations` + `company_users` + RBAC) permanece soberana para permissão.** Não há sobreposição funcional; o módulo NÃO é authority paralela.

  **Sub-decisão de execução: opção (b) — esconder rotas frontend + arquivar até primeira necessidade real de risk-management.**

  Risk-management automation é frente arquitetural grande (precisa risk profile real + trust score real + evidence service real funcionando). Hoje todos esses sub-módulos têm runtime parcial. Ativar policy-engine sem o ecossistema completo gera ilusão de capability.

- **Princípio operacional registrado (ChatGPT via Clayton, 2026-05-16) — chave de leitura para futuras priorizações:**

  > **"O sistema contém módulos conceitualmente corretos que ainda não deveriam estar vivos. Módulo PREMATURO ≠ módulo ESTRUTURALMENTE ERRADO. Maturidade temporal ≠ incoerência estrutural. Congelar módulos prematuros preserva convergência futura sem cristalizar runtime inadequado."**

  Aplicação: ao auditar DTs, separar entre 3 categorias semânticas (não apenas técnicas):
  - **ESTRUTURALMENTE_ERRADO** → corrigir OU arquivar consciente
  - **PREMATURO** → congelar / aguardar pressão real / preservar para reativação futura
  - **INFORMATIVA** → documentar lição, sem ação

  policy-engine é caso canônico de **PREMATURO**: módulo estruturalmente correto (separação de risk vs authority é design certo, blindagens humanas-no-loop são corretas, integração com evidence pack é correta), mas runtime adequado ainda não emergiu (precisa ecossistema risk+trust+evidence vivo).

- **Restrições explícitas:**
  1. **NÃO criar tabelas** `policy_rules` + `policy_decisions` sem primeira necessidade real de risk-management emergir (ex: primeira fraude detectada, primeira dispute escalada, primeiro abuso de limit).
  2. **NÃO interpretar policy-engine como replacement de authority** em sessões futuras. Cristalizaria anti-padrão inexistente.
  3. **NÃO ativar Risk Command Center page** até ecossistema (risk + trust + evidence) atingir runtime real exercitado (não apenas tabelas criadas).
  4. **NÃO confundir esconder com remover.** Frontend hide preserva código; remoção exige DECISION nova.

- **Implicação na Frente 4:**
  - DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE reclassificada de AUDIT_URGENT → **AUDIT_RESOLVIDA + PREMATURO**
  - Sub-DT nova: `DT-MODULE-POLICY-ENGINE-PREMATURO-AGUARDA-ECOSSISTEMA-RISK`
  - Reflexo institucional: minha auditoria anterior classificou policy-engine como "HIGH risco authority paralela" — **6º caso desta sessão** de classificação superficial refutada por auditoria material. O princípio "auditoria material antes de classificação por inferência de nome" (DECISION-0040 contexto + DT_PRIORIZATION.md) confirma valor.

- **Referência material:**
  - Código auditado: `backend/src/modules/policy-engine/policy-engine.service.ts` (432 linhas), `policy.routes.ts` (297 linhas), `policy.repository.ts` (438 linhas), `policy.types.ts` (161 linhas), `policy-engine.module.ts` (15 linhas)
  - Frontend callers: `frontend/src/api/policies.ts`, `frontend/src/pages/PolicyManagementPage.tsx`, `frontend/src/pages/RiskCommandCenterPage.tsx`
  - Authority chain canônica: `backend/src/core/authorization/authorization.service.ts` (`canActAs` ownership→delegation→legacy ramo)
  - Ecossistema risk: `risk-command-center`, `trust`, `evidence`, `business-audit` (todos com runtime parcial — não auditados nesta sessão para escopo)
  - DT que fechou: DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE (REMEDIATION_DT_LOG.md)

### DECISION-0042 — MEMBERSHIP SSOT: company_users expandido (Opção A)

**Data:** 2026-05-16
**Sessão:** continuação 2026-05-16 (PASSO 2 do plano frente MEMBERSHIP)
**Status:** EXECUTED (commit pendente)
**Autorização:** Clayton via AskUserQuestion (Opção A — recomendada com dados materiais)

#### Contexto

Frente MEMBERSHIP gerada por DT-MEMBERSHIP-SSOT-DECISION-REQUIRED (BLOQUEIA_PRODUTO criada após auditoria 4 AUDITORIA). Auditoria profunda READ-ONLY (PASSO 2.a) revelou:

- 5 callers backend de `company_members` (não 1): repository, service, routes, authorization, bank-balance-by-cpf
- 2 callers de teste
- Frontend completo: `CompanyTeamTab.tsx` + `companyMembers.ts` API + handlers
- Sprint 78 (`organization_*`) JÁ implementado paralelamente (backend + pages + api)
- **Estado runtime DB:** apenas `company_users` (9 rows) e `actor_delegations` (0 rows) existem; `company_members`, `company_employees`, `organization_*` (4 tabelas) — TODAS INEXISTENTES
- `company_users` JÁ TEM `role` (text, default 'member'), `is_active`, `is_primary`, 5 colunas `can_manage_*`

#### Decisão

**Opção A:** `company_users` expandido como SSOT único de membership role-based.

- Migration aditiva: `member_status TEXT NOT NULL DEFAULT 'active'` + CHECK constraints em `role` e `member_status` + índice composto
- `role` JÁ existe — apenas relaxar valores válidos via CHECK (`owner`, `admin`, `staff`, `contractor`, `member`)
- `member_status` substrato para fluxo invited/active/suspended (is_active mantido para compat)
- `company-members.repository.ts` vira adapter thin: preserva interface CompanyMember, mapeia para company_users
- `authorization.service.ts:369` lê company_users.role='admin' direto
- `bank-balance-by-cpf.service.ts:151` substitui subquery por JOIN users → company_users

#### Razão de escolha sobre B e C

| Critério | A | B | C |
|---|---|---|---|
| Substrato vivo | ✅ 9 rows | ❌ 0 rows | ❌ 0 rows × 4 tabelas |
| Refactor backend | 2 callers | 0 | 2+ callers |
| Refactor frontend | 0 | 0 | adapter |
| Dead code resolvido | Sprint 78 fica congelada DT separada | company_members vira viva, Sprint 78 morta | company_members vira legado com DT |
| Reversibilidade | ALTA | BAIXA | BAIXA |
| Blast | BAIXO | MÉDIO | ALTO |

A é a única opção que **não cria nova tabela** e **aproveita substrato existente**.

#### Restrição explícita (não fazer)

1. **NÃO** apagar `company-members.*` (repository/service/routes) imediatamente — adapter preserva contrato para callers atuais (incluindo frontend `CompanyTeamTab.tsx`)
2. **NÃO** materializar Sprint 78 (`organization_*`) nesta frente — fica congelada via DT separada (`DT-ORGANIZATION-SPRINT78-FROZEN`) com critério de descongelamento
3. **NÃO** remover `is_active` de `company_users` — mantido sincronizado com `member_status` para compat com callers legados
4. **NÃO** popular dados em `actor_delegations` aqui — frente separada

#### Artefatos materiais

| Arquivo | Mudança |
|---|---|
| `backend/migrations/20260530541000_company_users_membership_expansion.sql` | NOVA — migration aditiva (member_status + CHECK constraints + índice) |
| `backend/src/core/authorization/authorization.service.ts` | Refactor: companyMembersRepository → query direta company_users |
| `backend/src/modules/bank/bank-balance-by-cpf.service.ts` | Refactor: subquery company_members → JOIN users + company_users |
| `backend/src/core/companies/company-members.repository.ts` | Reescrito como adapter thin sobre company_users (preserva interface) |
| `backend/tests/smoke/mvp-smoke.test.ts` | Test fixture: company_members → company_users |
| `backend/tests/integration/actor-delegation.test.ts` | Cleanup: DELETE FROM company_members → company_users |

#### Gates aplicados

- TSC backend: 0 erros ✓
- TSC frontend: 0 erros ✓
- SQL smoke SELECT_WITH_ACTOR retorna 5 rows com JOIN actors válido ✓
- SQL smoke authorization admin path retorna 0 rows (sem admins no DB, mas SQL não quebra) ✓
- 9 rows existentes preservados com `role='owner'`, `member_status='active'` ✓
- CHECK constraints aplicadas: `chk_company_users_role_valid`, `chk_company_users_member_status_valid` ✓

#### Caveat audit trail

Migration `20260530541000` aplicada manualmente via `psql` (não via `npm run migrate`) porque runner tem bloqueio em migration anterior pendente `20260530516500_add_states_country_abbreviation_unique.sql` (index conflict — não relacionada à frente MEMBERSHIP).

Schema_migrations NÃO foi populado (recusa de tampering com audit trail). Próxima execução de `npm migrate` reaplica idempotentemente (DO blocks com IF NOT EXISTS). Frente separada precisa resolver `states_country_abbreviation_unique` para destravar pipeline normal — DT registrada implicitamente em STATUS_EXECUCAO_GLOBAL.

#### Implicações institucionais

- **DT-MEMBERSHIP-SSOT-DECISION-REQUIRED → CLOSED**
- **DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS** absorvida (sub-DT histórica)
- **Nova DT-ORGANIZATION-SPRINT78-FROZEN** registrada (Sprint 78 congelada com critério de descongelamento)
- DT-PRIORIZATION.md: BLOQUEIA_PRODUTO 3 → 2 (MEMBERSHIP sai); BLOQUEIA_FRENTE ganha SPRINT78
- DECISION-0040 reforçada: auditoria material precede decisão (3 opções emergiram porque dados foram coletados)

### DECISION-0043 — Convergência contextual progressiva — backend respeita actor, frontend respeita projeção, ausência contextual é semântica

- **Data:** 2026-05-17
- **Tipo:** arquitetural
- **Pattern:** posterior à validação (princípio 6) — formalizada após commit `0c710b47` atravessar pattern em 3 fixes cirúrgicos sem regressão
- **ID da violação resolvida:** DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT (vide PASSO 6 do mesmo ciclo)

#### Contexto

Auditoria material desta sessão (Fase A Frente "Convergência Contextual Profunda") + auditoria histórica revelou contradição temporal não-arbitrada:

- Commit `c4c45ec77` (2026-01-27): early return PF rotulado "BLINDAGEM" em `core.service.ts:138-154`
- DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT (2026-05-15): mesmo autor reclassifica como "DT-P projeção contextual incompleta"
- Zero DECISIONs em REMEDIATION_DECISIONS_LOG arbitrando entre as leituras

Backend energizado em runtime (DECISION-0042 MEMBERSHIP + energização do circuito operacional desta sessão) atravessou o ramo Delegation de `canActAs` end-to-end com 1 row real em `actor_delegations`. Superfície operacional não acompanhou no mesmo ritmo: 7/8 tabs do Profile.tsx com 0 menções `activeActor`; backend `core.service.ts` ignora actorId.

#### Decisão

Direção **(b) refinada — progressiva**, não maximalista. Backend respeita identidade (actor); frontend respeita projeção; ausência contextual é parte válida da semântica.

**Concretizada via 3 fixes cirúrgicos (commit `0c710b47`):**

1. **Backend** `core.service.ts:136-154`: substitui early return rotulado "BLINDAGEM" por bifurcação contextual explícita. Comportamento observável preservado (PF-only campos null para actor≠user), mas intenção documentada per princípio 4. Sem mudança de shape.

2. **Frontend** `Profile.tsx`: redirect síncrono (Navigate replace) quando `activeActor.actor_type='page'` → `/empresa/:companyId`. Posicionado antes de qualquer useState/useEffect/fetch. Zero await, derivado de activeActor já resolvido no cliente. Princípios 8 (reorganiza superfície, não migra soberania) e 9 (síncrono, derivado de estado client).

3. **Frontend** 7 sub-componentes Profile* (+ `NotApplicableMessage.tsx` novo): guard defensivo retorna mensagem visual quando `activeActor.actor_type !== 'user'`. Defesa em profundidade contra race condition / hot reload / navegação direta via URL. Honra princípios 4 (ausência é semântica) e 5 (sem fallback implícito de outro contexto).

#### Restrições explícitas (derivadas dos princípios)

- **Princípio 3 ratificado:** Backend NÃO inventa shapes polymorphic por actor_type. CompleteProfile mantém shape único; campos PF-only ficam null para actor≠user. Sem `empresaProfile` / `bandProfile` / etc.
- **Princípio 4 ratificado:** Campos null em `personal_profile`, `professional_profile`, etc., para page actor são comportamento esperado, não gap.
- **Princípio 5 ratificado:** Frontend NÃO mascara ausência contextual com fallback PF de outro actor. NotApplicableMessage substitui dados ausentes por mensagem semântica.
- **Princípio 8 ratificado:** Navigate em Profile.tsx reorganiza superfície visual; activeActor / authority / ownership / delegation permanecem intactos. Frontend NUNCA troca actor implicitamente via reroute.
- **Princípio 9 ratificado:** Redirect derivado de `activeActor.company_id` já resolvido no cliente. Zero fetch / zero await / zero lookup. Síncrono.

#### Sinais de saturação para frentes futuras (princípio 7)

Convergência contextual progressiva pausa quando 2 dos 3 sinais batem:
- (a) 70%+ das superfícies operacionais não-soberanas adaptadas
- (b) Pressão local cessou (2-3 sessões sem nova superfície exigindo adaptação)
- (c) Cluster crítico atravessado (perfil + bank + CRM)

**Hoje (pós-DECISION-0043):** apenas perfil atravessado. Cluster incompleto (faltam bank + CRM). Nenhum sinal de saturação batido — convergência continua emergindo por pressão local conforme aparecer.

#### Consequências esperadas

- Curto prazo: /perfil deixa de exibir dados PF para page actor; user navegando entre actors percebe superfície contextual coerente. Modal loop de PASSO 9 desta sessão eliminado pela raiz.
- Médio prazo: Frentes futuras de convergência contextual em outras superfícies (bank/CRM/agenda) invocam mesmos 9 princípios. Mesmo pattern: backend respeita identidade + frontend respeita projeção + ausência é semântica.
- Frontend convergência cresce por pressão material, não por roadmap antecipado.

#### Responsável

Clayton (decisão soberana arbitrante entre as duas leituras temporais do próprio autor). Auditoria material conduzida por Claude Code. Pattern de "DECISION posterior à validação" preservado.

#### Validação prévia

- Auditoria histórica desta sessão (git blame `c4c45ec77`, grep REMEDIATION_DECISIONS_LOG, leitura completa DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT)
- TSC backend + frontend: 0 erros pós-fixes
- Smoke `/perfil` (actor=user) preservado (sem regressão)
- Smoke `/perfil` (actor=page) → redirect síncrono /empresa/:companyId

#### Supera

- DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT (encerrada em PASSO 6 do mesmo ciclo)

#### Superada por

(preencher quando superada)

---

## DECISION-0030 — Localização contextual de actor como entidade temporal-operacional soberana

- **Data:** 2026-05-19
- **Tipo:** arquitetural — extensão de DECISION-0020
- **Status:** APROVADA por Clayton (autorização explícita 2026-05-19, sessão Fase 0 do plano `PLANO_FEED_RAIO_GEOGRAFICO_2026_05_19.md`)

### Princípio

Localização contextual de actor é entidade **temporal-operacional** com 4 projeções semanticamente distintas. `actor_active_location` é fonte compartilhada; cada módulo consumidor define sua própria regra de uso.

### Relação com DECISION-0020 (Location Core)

Esta DECISION **ESTENDE — não substitui**. Localização contextual é camada ACIMA do catálogo territorial soberano (`countries`/`states`/`cities`/`neighborhoods`/`addresses`). Hierarquia administrativa permanece SSOT geográfico; nova camada adiciona dimensão contextual-temporal de uso.

### Relação com DECISION-0021 (addresses sem RLS)

`actor_active_location` TEM RLS por tenant + `tenant_id NOT NULL`. `addresses` (DECISION-0021) é catálogo geográfico global compartilhado. São tabelas com **naturezas OPOSTAS de isolamento, ambas corretas em seu padrão**.

**Razão:** localização ATIVA de um actor é dado privado de uso operacional (LGPD-relevante). Catálogo de endereços é fato geográfico público.

### 4 Projeções (semânticas distintas)

1. **Descoberta** (feed/posts): user controla via slider — preferência declarada, configurável
2. **Operacional** (rides, delivery, serviços presenciais): constraint físico-logístico definido PELO MÓDULO, não pelo user
3. **Marketplace**: híbrido — toggle local/global como UX
4. **Fiscal/soberana**: residência legal, jurisdição (já modelada via `primary_address_id` / `headquarters_address_id`, DECISION-0020/0021)

### Anti-padrões formalmente proibidos

1. **Service genérico de proximidade** servindo feed + operacional + marketplace (cada um tem semântica oposta). Naming canônico: `feed-proximity.service.ts` para descoberta; `ride-coverage.service.ts` / `delivery-zone.service.ts` / `marketplace-shipping.service.ts` para os demais.
2. **Módulo operacional respeitar preferência de feed** (rides ou delivery aceitando "ilimitado" quando constraint é físico).
3. **Frontend calcular distância sozinho** — sempre via backend (princípio "Frontend nunca cria verdade", memória 2026-05-19).
4. **Lat/lng em tabela que não seja** `addresses`, `actor_active_location`, `cities`, ou tabelas geo-específicas existentes (`rides_driver_locations`).
5. **Confundir "user quer ver mundo todo no feed" com "user aceita delivery de qualquer lugar"** — projeções distintas, decisões distintas.
6. **Poluir `address_assignments.role` com USER_CURRENT_LOCATION** — role é fiscal/logístico estável (BILLING/DELIVERY/RESIDENCE/HQ/OPERATIONAL/PICKUP/DROPOFF), não contextual temporal.

### Sub-decisão A (resolvida nesta DECISION) — Haversine SQL canônico

Pattern canônico para cálculo de distância: **Haversine SQL puro** via function PostgreSQL `haversine_distance_km(lat1, lng1, lat2, lng2)` documentada como reusável.

- PostGIS NÃO é instalado nesta frente (decisão arquitetural ampla, fora do escopo).
- Helper JS existente (`social-2.0.service.ts:302 calculateHaversineDistance`) é cálculo em memória — não SQL. Tradução necessária para `haversine_distance_km` SQL function.
- Performance OK até ~50-100k posts sem index espacial; escala futura pode pressionar PostGIS (decisão posterior).

### Caso de uso material que motivou a DECISION

Slider de raio configurável no feed (user define distância de descoberta de posts). Plano completo em `PLANO_FEED_RAIO_GEOGRAFICO_2026_05_19.md`.

### Schema canônico aprovado

```sql
CREATE TABLE actor_active_location (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  address_id UUID REFERENCES addresses(address_id) ON DELETE SET NULL,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  source TEXT NOT NULL CHECK (source IN (
    'USER_INPUT_CITY','BROWSER_GEOLOCATION','IP_ESTIMATE','EXPLICIT_TRAVEL_MODE')),
  scope_level TEXT CHECK (scope_level IN ('NEIGHBORHOOD','CITY','STATE','COUNTRY')),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (address_id IS NOT NULL OR (lat IS NOT NULL AND lng IS NOT NULL))
);

CREATE UNIQUE INDEX uniq_active_actor_location
  ON actor_active_location (tenant_id, actor_id) WHERE is_active = true;

ALTER TABLE actor_active_location ENABLE ROW LEVEL SECURITY;

CREATE POLICY active_location_rls ON actor_active_location
  USING (tenant_id::text = current_setting('app.current_tenant', true));

ALTER TABLE posts
  ADD COLUMN address_id UUID REFERENCES addresses(address_id) ON DELETE SET NULL;
```

### Implementação prevista

Plano em fases F1-F6 detalhado em `PLANO_FEED_RAIO_GEOGRAFICO_2026_05_19.md`. Cada fase com autorização explícita por Clayton.

#### Supera

(nenhuma — DECISION inédita)

#### Estende

- DECISION-0020 (Location Core: território como infraestrutura soberana)
- DECISION-0021 (addresses sem RLS — catálogo global)

#### Superada por

(preencher quando superada)

---

## DECISION-0031 — Reactions como tabela polimórfica soberana

- **Data:** 2026-05-19
- **Tipo:** arquitetural — ratificação de schema canônico + remediação constitucional
- **Status:** APROVADA por Clayton (autorização explícita 2026-05-19, sessão remediação `DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH`)
- **Base constitucional:** §3.2 (Glossário Canônico — `actor_id` SSOT), §4.4 (Chaves — PK `id`, FK `<entidade>_id`), §4.37 (Tipos de Entidade — ver nota de violação latente abaixo)

### Princípio

A tabela `reactions` é **soberanamente polimórfica**. Schema canônico vigente:

```sql
reactions (
  id           UUID PRIMARY KEY,        -- §4.4 PK canônica
  tenant_id    UUID NOT NULL,
  actor_id     UUID NOT NULL,           -- §3.2 SSOT de identidade
  entity_type  TEXT NOT NULL,           -- 'post' | 'comment' | 'event' (ver nota §4.37 abaixo)
  entity_id    UUID NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

Toda query/INSERT/UPDATE/DELETE em `reactions` DEVE usar `(entity_type, entity_id, actor_id)` como vocabulário canônico.

### Anti-padrões formalmente proibidos

1. **FK direta tipo-específica** — adicionar `reactions.post_id`, `reactions.comment_id`, `reactions.event_id` duplicando `entity_id`. Cria caminhos paralelos de identificação e fragmenta polimorfismo. **Viola §4.4** (FK redundante quando já existe `entity_id`).
2. **Coluna de identidade não-canônica** — usar `user_id` ou `global_user_id` em vez de `actor_id`. **Viola §3.2** (Glossário Canônico Constitucional: "Identidade Econômica → `actor_id` / `actorId` — SSOT de identidade"). Schema só conhece `actor_id` (alinhamento com modelo "Actor como unidade operacional soberana", memória 2026-05-15). Outras camadas de identidade são derivadas, não soberanas.
3. **Chave primária não-canônica** — usar `reaction_id` como PK em vez de `id`. **Viola §4.4** ("Chave primária: `id`. ❌ `usr_id`, ❌ `user_id_id`"). Padrão: SQL alias preserva contrato externo (`SELECT id AS reaction_id`) sem violar PK canônica do schema.
4. **Tabelas espelho** — criar `post_reactions`, `comment_reactions`, `event_reactions` separadas. Inflar N tabelas para N tipos é exatamente o que polimorfismo evita.

### Nota: violação latente §4.37 (entity_type enum)

§4.37 da Nomenclatura Canônica define enum constitucional `entity_type` com valores: `'user'`, `'page'`, `'store'`, `'group'`, `'company'`, `'organization'`, `'system'`, `'bot'` — todos **entidades soberanas/persona operacional** (linhas 1467-1499). §4.37 explicita: "`entity_type` representa a natureza estrutural da entidade. `actor_type` representa o papel operacional do ator dentro do sistema."

Schema atual de `reactions` (migration viva `20260530320000_social_reactions.sql:7`) usa:
```sql
CHECK (entity_type IN ('post','comment','event'))
```

Valores `'post'`, `'comment'`, `'event'` são **tipos de conteúdo/domínio**, NÃO entidades soberanas. **Configura violação §4.37**: nome canônico `entity_type` emprestado fora do escopo constitucional. Plus: 3 vocabulários divergentes na codebase (constituição §4.37 vs `publication-engine.types.ts:7` que declara `event/post/group/channel` vs DDL live `post/comment/event`).

Esta DECISION-0031 **ratifica USO ATUAL como exceção transitória** (princípio "norma assintótica" — `project_norma_assintotica.md`): runtime preservado enquanto convergência não é executável (renomeação exige DDL aditiva + migration coordenada cross-callers, fora do escopo desta frente).

Frente futura para alinhamento §4.37: ver `DT-PRESSURE-REACTIONS-ENTITY-TYPE-NAMING-VIOLATION` (2026-05-19). Nomenclatura semanticamente correta seria `target_type` ou `content_type` (não-`entity_type`), o que exige formalização SSOT_REGISTRY → §4.X antes de implementar (regra §3.2 PROIBIÇÃO: "Nenhum nome constitucional pode nascer 'no código primeiro' e ser ratificado depois").

### Caso material que motivou ratificação

`social-2.0.service.ts` (1407 LOC) usava em paralelo:
- `reactions.post_id` (drift — coluna não existe)
- `reactions.global_user_id` (drift — coluna não existe)
- `reactions.reaction_id` (drift — coluna é `id`)

Em 3 funções (`getFeed`, `addReaction`, `getActorPosts`). Schema real diverge do código há tempo desconhecido. Causa raiz: código herdado de versão anterior do schema (vide `migrations_archive/0040_social_actors_extension.sql:72-85` que TINHA `post_id` direto) sem refator pós-mudança para polimorfismo.

### Coordenação com runtime soberano

`publication-engine.service.ts:399-432` JÁ usa modelo polimórfico (`entity_type`, `entity_id`) — confirma que a semântica polimórfica está ratificada no engine canônico. Drift residual no engine (uso de `user_id` em vez de `actor_id`) registrado como DT própria: `DT-PRESSURE-PUBLICATION-ENGINE-REACTIONS-USER-ID-DRIFT` (2026-05-19).

### Implementação prevista

Refator de `social-2.0.service.ts` (frente atual) converge para o modelo:
- SELECT: `WHERE entity_type = 'post' AND entity_id = $X AND actor_id = $Y`
- INSERT: `(tenant_id, actor_id, entity_type, entity_id, reaction_type)`
- UPDATE: `WHERE id = $X` (não mais `reaction_id`)
- DELETE: `WHERE id = $X`

#### Supera

- Modelo histórico `reactions(post_id, actor_id)` de `migrations_archive/0040_social_actors_extension.sql` (substituído por polimorfismo em migration posterior ao archive)

#### Estende

- Modelo Actor soberano (memória `project_actor_unidade_operacional_soberana.md`, 2026-05-15) — `actor_id` é coluna canônica de identidade

#### Superada por

(preencher quando superada)

---

## DECISION-0032 — post_cta como feature não-materializada (PREMATURO)

- **Data:** 2026-05-19
- **Tipo:** arquitetural — aplicação de DECISION-0041 PREMATURO
- **Status:** APROVADA por Clayton (autorização explícita 2026-05-19, sessão remediação `DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH`)

### Princípio

CTA (Call-To-Action) em posts é **feature pendente de maturação produto**. Não há:
- Tabela `post_cta` materializada em runtime (FANTASMA — `to_regclass` retorna NULL)
- UX desenhado (zero componente frontend renderiza `cta_label`/`cta_url`/`cta_action`)
- JTBD validado em uso real
- Caller frontend que consume payload de CTA (0 matches em `frontend/src` para `post_cta`/`cta_label`/`cta_url`/`cta_action`/`cta_target`)

Aplicar pattern **DECISION-0041 PREMATURO**: código aspiracional sem ecossistema runtime de suporte deve ser **removido** (não comentado), até que produto materialize a necessidade.

### Estado pós-aplicação

- `social-2.0.service.ts`: bloco INSERT post_cta (linhas ~827-854) removido com comentário arqueológico curto
- `social-2.0.service.ts`: JOINs `LEFT JOIN post_cta` em `getFeed` (linha 206) e `getActorPosts` (linha 1200) removidos; campos `cta_id`/`cta_type`/`target_actor_id`/`target_group_id`/`price`/`currency` do payload removidos
- `social-2.0.routes.ts`: endpoint POST CTA action (linhas 740-770) comentado inteiro + DT-MODULE-POST-CTA-FANTASMA registrada
- **NÃO criar** tabela `post_cta` via migration

### Critério de reabertura

Reabrir feature exige:
1. UX desenhado e validado (Figma/protótipo)
2. JTBD claro (qual problema o CTA resolve no contexto do post?)
3. Caller frontend implementado em ambiente de teste
4. Uso real validado por pelo menos um actor em piloto
5. Nova DECISION explícita revertendo PREMATURO + DDL aditiva

### Convergência com pattern institucional

Aplicação consistente com `DT-MODULE-SUBSCRIPTIONS-FANTASMA`, `DT-MODULE-VENUE-FANTASMA`, `DT-MODULE-LOYALTY-FANTASMA`, `DT-MODULE-PAYOUT-FANTASMA`, `DT-MODULE-INVOICING-FANTASMA`, `DT-MODULE-ALERTS-FANTASMA`, `DT-MODULE-VOTES-FANTASMA`, `DT-MODULE-AUTOMATION-PREMATURO` — todos formalizam o padrão "feature aspiracional comentada/removida até runtime real exigir".

#### Supera

(nenhuma — DECISION inédita aplicando pattern DECISION-0041 a `post_cta`)

#### Estende

- DECISION-0041 (PREMATURO — features sem ecossistema runtime de suporte são removidas)
- Memória `project_norma_assintotica.md` (sistema converge para schema canônico; toda exceção carrega prazo ou critério de convergência)

#### Superada por

(preencher quando superada)

---

## DECISION-0033 — post_media como modelo legacy substituído por posts.media_ids

- **Data:** 2026-05-19
- **Tipo:** arquitetural — ratificação de modelo canônico (coluna-array embedded) + remoção de modelo legacy (tabela-N)
- **Status:** APROVADA por Clayton (autorização explícita 2026-05-19, sessão remediação `DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH`)
- **Base constitucional:** §4.3 (snake_case + arrays UUID padrão SSOT), §4.4 (PK `id`, FK `<entidade>_id`)

### Princípio

Mídia em posts é modelada via **coluna-array embedded**:

```sql
posts (
  id            UUID PRIMARY KEY,    -- §4.4 PK canônica
  ...,
  media_ids     UUID[],              -- §4.3 snake_case + array UUID
  ...
)
```

NÃO via tabela-N `post_media`. Modelo histórico de tabela-N foi **substituído** em migration posterior por modelo embedded.

### Estado material

`backend/migrations_archive/0040_social_actors_extension.sql:36-49` criava tabela `post_media(id, tenant_id, post_id, media_type, url, thumbnail_url, file_size, mime_type, metadata, display_order, created_at)`. **Nenhuma migration viva** em `backend/migrations/` recria a tabela. Modelo foi superado pela coluna `posts.media_ids UUID[]` (schema real auditado em DT-DRIFT-SOCIAL-2.0).

`social-2.0.service.ts:780-785` ainda fazia `UPDATE post_media SET post_id = $1, display_order = $2 WHERE media_id = $3` — código órfão atuando contra tabela inexistente. Causa raiz idêntica à de `post_cta` (DECISION-0032) e `posts.global_user_id` (DT-DRIFT-SOCIAL-2.0): refator de schema parcialmente concluído, código legado preservado sem alinhamento.

### Anti-padrões formalmente proibidos

1. **UPDATE/INSERT/SELECT em `post_media`** — tabela FANTASMA; toda operação retorna erro ou 0 rows.
2. **Modelagem de mídia em tabela-N paralela** — adicionar `media_attachments`, `post_attachments`, etc. para "estender" `media_ids`. Quebra atomicidade (post + mídia deveriam ser uma só escrita).
3. **Recriar `post_media`** sem RFC explícito e DECISION superando esta — modelo embedded é canônico até prova material em contrário.

### Estado pós-aplicação

- `social-2.0.service.ts:780-785`: bloco `UPDATE post_media` removido com comentário arqueológico (DECISION-0033)
- `createPost` modificado para incluir `media_ids` diretamente no INSERT posts (atomicidade)
- **NÃO recriar** tabela `post_media` via migration

### Modelo canônico de createPost (pós-aplicação)

```sql
INSERT INTO posts (
  id, tenant_id, actor_id, content, media_ids, intent, intent_metadata, targeting, metadata
)
VALUES (
  DEFAULT, $1, $2, $3, $4::uuid[], $5, $6::jsonb, $7::jsonb, $8::jsonb
)
RETURNING id AS post_id, created_at, updated_at;
```

Alias `id AS post_id` preserva contrato externo (frontend tem 65 callers de `post.post_id`) sem violar §4.4 PK canônica.

### Convergência institucional

- Pattern consistente com migração schema-evolution: tabela-N substituída por coluna-array embedded quando atomicidade > flexibilidade de extensão.
- Diferente de DECISION-0032/0034 (PREMATURO): aqui o modelo canônico EXISTE (coluna `media_ids`), só o código não convergiu. Não é "feature aspiracional" — é "legacy code atrás do schema vigente".

#### Supera

- Modelo legacy `post_media(id, post_id, media_type, url, ...)` de `migrations_archive/0040_social_actors_extension.sql`

#### Estende

- §4.3 (Nomenclatura Canônica: snake_case + arrays UUID padrão SSOT)
- §4.4 (Nomenclatura Canônica: PK `id`, FK `<entidade>_id`)

#### Superada por

(preencher quando superada)

---

## DECISION-0034 — post_projects como feature não-materializada (PREMATURO)

- **Data:** 2026-05-19
- **Tipo:** arquitetural — aplicação de DECISION-0041 PREMATURO
- **Status:** APROVADA por Clayton (autorização explícita 2026-05-19, sessão remediação `DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH`)
- **Base constitucional:** §3.2 (PROIBIÇÃO de feature nascendo "no código primeiro" sem SSOT_REGISTRY)

### Princípio

A feature "projetos vinculados a posts" (`post_projects`) é **pendente de maturação produto**. Não há:
- Tabela `post_projects` materializada em runtime (FANTASMA — CREATE TABLE só em `migrations_archive/0844_social_purpose_targeting.sql:195`, nenhuma migration viva)
- Substituto canônico (diferente de `post_media` que tem `posts.media_ids`)
- Caller frontend de `post.project` ou `post.budget_cents`/`post.deadline`
- JTBD claro (qual problema o vínculo "post → project com budget+deadline" resolve no contexto operacional?)

Plus: o INSERT em `social-2.0.service.ts:794-807` está protegido por try/catch com `console.error('Erro ao criar projeto (não crítico):', err)` — o próprio dev sabia que o INSERT era frágil/aspiracional.

Aplicar pattern **DECISION-0041 PREMATURO**: feature aspiracional sem ecossistema runtime + sem JTBD validado deve ser **removida** (não comentada), até produto materializar a necessidade.

### Estado pós-aplicação

- `social-2.0.service.ts:789-812`: bloco INSERT post_projects removido com comentário arqueológico curto referindo DECISION-0034
- Path semântico de `intent === 'project'` preservado no contrato (frontend pode continuar criando posts com `intent='project'`), mas SEM persistir budget/deadline em tabela paralela. Metadata pode carregar campos via `intent_metadata` (jsonb) se necessário.
- **NÃO criar** tabela `post_projects` via migration

### Critério de reabertura

Reabrir feature exige:
1. UX desenhado e validado (componente que mostra "projeto com orçamento R$ X até DD/MM")
2. JTBD claro (qual problema operacional o projeto vinculado resolve?)
3. Decisão sobre **modelo canônico**: (a) tabela-N `projects` linkada via `posts.project_id`? (b) campos diretos em `posts` (budget_cents/deadline)? (c) jsonb em `posts.intent_metadata`?
4. Formalização SSOT_REGISTRY + §4.X em Nomenclatura Canônica antes de qualquer DDL
5. Nova DECISION explícita revertendo PREMATURO

### Convergência institucional

Aplicação consistente com DECISION-0032 (post_cta) e família `DT-MODULE-*-FANTASMA`. Diferencia-se de DECISION-0033 (post_media) porque NÃO há modelo substituto canônico para post_projects — é feature totalmente PREMATURO, não legacy substituído.

#### Supera

(nenhuma — DECISION inédita aplicando pattern DECISION-0041 a `post_projects`)

#### Estende

- DECISION-0041 (PREMATURO — features sem ecossistema runtime de suporte são removidas)
- §3.2 (PROIBIÇÃO de feature nascer "no código primeiro" — convergência reversa: feature já no código sem registro SSOT vira PREMATURO)

#### Superada por

(preencher quando superada)

---

## DECISION-0044 — `critical_total` é resultado, não meta: classificação quádrupla das violações de boundary do bank

- **Data:** 2026-05-23
- **Tipo:** arquitetural — princípio operacional vinculante para PRs de boundary
- **Status:** APROVADA por Clayton (autorização explícita 2026-05-23, sessão pós-PR-1 / PR-2 / PR-3)
- **Pattern:** posterior à validação — formalizada após PR-1 (commit `a672e071`, 47→30) atravessar refactor real e PR-2/PR-3 revelarem que o resto da dívida não é refactor.

### Princípio

O número `critical_total` reportado pelo gate `validate-architectural-patterns --strict` (regra `NO_DIRECT_BANK_TABLE_ACCESS`) **NÃO é meta de PR.** É **resultado** do que cabe refactor real. O objetivo é sistema saudável, não número menor. Reduzir o número nunca justifica piorar performance ou inverter boundary.

### Classificação quádrupla das violações de boundary

Toda violação `NO_DIRECT_BANK_TABLE_ACCESS` classifica-se em uma das quatro naturezas:

1. **Leitura pura movível** → refactor real. Operador faz query agregada sobre `bank_*` que pode ser delegada a repositório no boundary `modules/bank/` sem mudar comportamento. **Exemplo:** PR-1 (`reporting-bank-aggregates.ts` → `bank-reporting.repository.ts`, commit `a672e071`, 17 violações zeradas, comportamento idêntico preservado).

2. **Cross-domain justificado por FK explícita do schema** → não-ação documentada. Query única (típica CTE) que cruza `bank_*` com tabelas de outro domínio via relação declarada no schema (ex.: FK `bank_transactions.order_id → orders.id`). Separar inverte o boundary (substrato soberano passa a fazer JOIN com superfície) ou multiplica round-trips (perda de performance em relatórios). **Exemplo:** PR-2 (`real-margin.service.ts`, 9 violações, ver DECISION-0045).

3. **Script de teste legítimo dev-only** → não-ação registrada. Script E2E que precisa tocar tabelas SSOT diretamente para validar invariantes do próprio substrato, com fail-fast em produção/staging. **Exemplo:** `e2e-incentive-bank-checklist.ts` (9 violações no baseline).

4. **Docstring/comentário documental apontando para o SSOT correto** → falso-positivo. Comentário JSDoc que cita nomes de tabelas `bank_*` para AVISAR que a verdade financeira mora lá (não no arquivo onde o comentário está). Gate confunde menção textual com acesso SQL. **Exemplo:** PR-3 (rides — `analytics.routes.ts`, `distribution.controller.ts`, `distribution.routes.ts`, `distribution.service.ts`, 8 violações, ver DECISION-0045).

### "Performance é comportamento"

Refactor que muda número de round-trips ao banco viola "comportamento idêntico" mesmo que o output seja igual. Uma query CTE única transformada em N queries separadas correlacionadas em memória/segunda query muda **comportamento de performance em ordem de grandeza** para relatórios sobre 10k+ rows. Mesmo output, latência diferente, é mudança comportamental. Critério "mover sem mudar comportamento" — vinculante para PRs de boundary — inclui performance.

### Restrições explícitas (derivadas do princípio)

- **Substrato soberano (`bank_*`) NUNCA faz JOIN com tabelas de superfície** (orders, order_items, etc.) dentro do `modules/bank/`. Boundary é unidirecional: superfícies giram ao redor do substrato, não o contrário.
- **Allowlist no gate** (`allowPath` em `validate-architectural-patterns.mjs`) NÃO deve alargar para incluir `scripts/` genericamente — abrir curinga em substrato sensível. Não-ação registrada via DECISION é a forma certa de absorver caso legítimo.
- **Fachada de re-export** (camada intermediária no operador que apenas repassa chamadas ao bank) NÃO é solução — esvazia gate sem endireitar arquitetura. PR-1 usou movimento real (opção β), não fachada (α).
- **Sequência de execução obrigatória em refactor real (natureza 1):** criar repositório novo → adicionar ao barrel → religar consumidores (estáticos + dinâmicos) → SÓ ENTÃO apagar arquivo origem. Validação com 5 critérios: `tsc --noEmit` exit 0, grep órfão zero (crítico contra fail silencioso de import dinâmico no money), 4 gates verdes, `critical_total` reduzido pela quantidade movida, sem erro intermediário.

### Consequências esperadas

- **Curto prazo:** PR-2 e PR-3 fechados como não-ação documentada (DECISION-0045). Dívida real candidata a refactor cai para ~4 violações (PR-4: `regional-fund/invoicing/saga` — a avaliar fresco com a mesma classificação).
- **Médio prazo:** próximas fatias de boundary aplicam a classificação quádrupla antes de presumir refactor. Documentação substitui a tentação de "abater número".
- **Longo prazo:** `critical_total` estabiliza num número diferente de zero, com cada violação restante justificada por DECISION explícita. Sistema saudável.

### Responsável

Clayton (decisão soberana após PR-2 e PR-3 revelarem que "mecânico no molde do PR-1" não se aplica universalmente). Auditoria material conduzida por Claude Code. Pattern de "DECISION posterior à validação" preservado (formalizada após casos materializarem o princípio).

### Validação prévia

- PR-1 executado e validado: commit `a672e071`, 4 gates verdes, `tsc` limpo, `critical_total 47→30`, comportamento idêntico em 4 consumidores (incluindo import dinâmico do `payout`).
- PR-2 (`real-margin.service.ts`) analisado: query CTE única cross-domain `bank_*` × `orders/order_items` via FK `bank_transactions.order_id`, RFC C56 já havia endireitado o SSOT em 2026-04-23. Não-ação aplicada (ver DECISION-0045).
- PR-3 (rides, 4 arquivos) analisado: 8 violações todas em docstring JSDoc apontando para `bank_ledger`/`bank_transactions` como SSOT. Zero queries SQL sobre `bank_*` nos 4 arquivos. Falso-positivo declarado pelo próprio código (ver DECISION-0045).

### Vinculadas

- DT registrada nesta sessão: `DT-GATE-DOCSTRING-FALSE-POSITIVE` (melhoria proposta do gate para distinguir comentário de SQL real); `DT-HELPERS-DUAL-IMPLEMENTATION-DRIFT` (sub-achado de infra).

#### Supera

(nenhuma — princípio operacional novo, formaliza pattern emergente)

#### Estende

- DECISION-0024 (`bank_ledger` como SSOT financeiro único): princípio operacional aplica a forma de proteger esse SSOT no boundary.

#### Superada por

(preencher quando superada)

---

## DECISION-0045 — Aplicação de DECISION-0044 aos casos `real-margin` (natureza 2) e `rides` (natureza 4)

- **Data:** 2026-05-23
- **Tipo:** falso_positivo + desvio_baseline justificado (aplicação concreta da classificação quádrupla)
- **Status:** APROVADA por Clayton (autorização explícita 2026-05-23, mesma sessão da DECISION-0044)
- **Vinculada a:** DECISION-0044 (princípio quádruplo), `RFC_C56_real_margin_viola_ssot.md` (fechamento — ver addendum), `f2fcac59` (commit pré-marco-zero com baseline atual)

### Caso 1: `backend/src/modules/marketplace/real-margin.service.ts` — 9 violações — natureza (2)

**Classificação:** cross-domain justificado por FK explícita do schema.

**Material:**

- Arquivo se declara `READ-ONLY` no cabeçalho (linha 2: `SPRINT 61: MARGEM REAL POR PRODUTO / CANAL / FILIAL (READ-ONLY)` + bloco de regras "Nenhuma mutação de estado / NÃO recalcula split / NÃO recalcula preço / NÃO inferir custo / Apenas consolida dados existentes / Nenhuma persistência").
- Único método que toca SQL é `getMarginByVariant`; `getMarginByActor` e `getMarginByChannel` são wrappers que chamam ele e agregam em memória.
- A query é **UMA query CTE única** (linhas 73-160) com 3 CTEs paralelos sobre `bank_*` (`ledger_revenue`, `ledger_fees`, `ledger_payouts`, cada um agregando por `bt.order_id` filtrando por `bank_accounts.account_type` distinto) seguida de JOIN final com `order_items`/`orders` para correlacionar por `oi.order_id = o.id`.
- A correlação `bank_transactions.order_id → orders.id` é **FK explícita declarada no schema** (adicionada em migração específica conforme RFC C56). Não é vazamento acidental de boundary — é a relação que o próprio banco declara como legítima.
- As 9 menções de `bank_*` detectadas pelo gate são as 9 ocorrências literais (3 nomes de tabela × 3 CTEs) dentro da MESMA query SQL.
- Service já usa `bank_ledger` como SSOT financeiro por decisão consciente — RFC C56 (`docs/02_decisions/RFC_C56_real_margin_viola_ssot.md`, 2026-04-23) endireitou o arquivo: removeu derivação de `metadata.priceSnapshot.finalPrice`, adicionou coluna `order_id` em `bank_transactions`, reescreveu cálculo baseado em ledger.

**Cálculo de margem em memória NÃO viola régua "saldo só `bank_ledger` é verdade".** Margem é derivação contábil sobre valores já agregados pelo ledger (receita − fees − holding cost); não há "ledger de margem" para tirar. Regex do gate `NO_MANUAL_MONEY_CALCULATION` também não marca (variáveis `grossRevenue`/`platformFees`/`netMargin`, não literais `amount`/`balance`).

**Opções consideradas e recusadas:**

- **(a) Mover query inteira (incluindo `order_items`+`orders`) para `bank-reporting.repository.ts`** — recusada: substrato soberano (`bank_*`) passa a fazer JOIN com tabelas de superfície (marketplace). Inverte boundary, pior que a violação original.
- **(b) Separar em 3 métodos no `bank-reporting` retornando mapas por `order_id`; correlação no marketplace via segunda query** — recusada: 3-4 round-trips em relatório sobre 10k+ orders versus 1 query CTE única atual. Performance é comportamento (DECISION-0044); muda performance em ordem de grandeza.
- **(c) 1 método no `bank-reporting` com `CASE WHEN account_type` retornando agregado por `order_id`; correlação no marketplace via segunda query** — recusada: 2 round-trips versus 1, mesma natureza do trade-off (b) em escala menor.

**Decisão:** **(d) NÃO-AÇÃO documentada.** As 9 violações permanecem no `critical_total` do gate. O cross-domain é legítimo pela FK + RFC C56 confirmou SSOT correto. Forçar separação criaria problema (performance ou boundary invertido) para resolver não-problema (violação textual com justificativa material).

**Saldo:** 9/30 violações de `critical_total` ficam classificadas como dívida controlada legítima (natureza 2).

### Caso 2: `backend/src/modules/rides/*` — 8 violações em 4 arquivos — natureza (4)

**Classificação:** falso-positivo documental (docstring que aponta para SSOT correto).

**Arquivos e linhas detectadas:**

- `analytics/analytics.routes.ts:9, :10`
- `distribution/distribution.controller.ts:7, :8`
- `distribution/distribution.routes.ts:9, :10`
- `distribution/distribution.service.ts:8, :9`

**Material:** os 4 arquivos têm **o mesmo docstring JSDoc no topo** (copiado verbatim):

```
⚠️ PROJEÇÃO FINANCEIRA — NÃO É SSOT (`rides_ride_distributions`)
Estes dados NÃO representam dinheiro real.
A verdade financeira está em:
- bank_ledger
- bank_transactions

NÃO usar para:
- saldo
- reconciliação
- decisão financeira
```

As 8 menções de `bank_*` detectadas pelo gate são as 8 ocorrências literais das palavras `bank_ledger` e `bank_transactions` **dentro desse docstring** (2 menções × 4 arquivos).

**Verificado material:** ZERO queries SQL sobre `bank_*` nos 4 arquivos; ZERO JOINs; ZERO escrita. As queries reais desses arquivos tocam `rides_drivers`, `rides_rides`, `rides_ride_distributions` (domínio rides puro). Quando precisam de operação financeira, delegam ao `bankIntegrationService` (boundary correto).

Os 4 arquivos **estão alinhados com a régua de forma exemplar** — declaram, no próprio cabeçalho, que a verdade financeira mora em `bank_ledger`/`bank_transactions` e não neles. É documentação operacional que protege futuros mantenedores. Regex do gate (`/\b(bank_ledger|bank_transactions|bank_accounts)\b/`) captura a string literal sem distinguir comentário de SQL.

**Opções consideradas e recusadas:**

- Editar comentários trocando `bank_ledger` por "SSOT financeiro" — recusada: degrada documentação operacional explícita; o nome literal é o que torna o comentário acionável.
- Alargar `allowPath` no gate para `modules/rides/` — recusada: abre curinga em substrato sensível (vide DECISION-0044). Outros arquivos em `rides/` poderiam introduzir acesso real futuro sem ser detectado.

**Decisão:** **NÃO-AÇÃO** (falso-positivo do gate). As 8 violações permanecem no `critical_total`. Melhoria proposta do gate registrada como `DT-GATE-DOCSTRING-FALSE-POSITIVE` em `REMEDIATION_DT_LOG.md` (distinguir menção em comentário/string de acesso SQL real — fatia futura de higiene do detector, não bloqueante).

**Saldo:** 8/30 violações de `critical_total` ficam classificadas como falso-positivo documental (natureza 4).

### Saldo agregado do `critical_total` após DECISION-0044 + 0045

| Origem | Violações | Natureza | Tratamento |
|---|---|---|---|
| `reporting-bank-aggregates.ts` | (-17, já zeradas) | (1) leitura pura movível | Refactor real PR-1, commit `a672e071` |
| `real-margin.service.ts` | 9 | (2) cross-domain via FK | Não-ação documentada (este caso 1) |
| `rides/*` (4 arquivos) | 8 | (4) docstring documental | Não-ação documentada (este caso 2) |
| `e2e-incentive-bank-checklist.ts` | 9 | (3) script de teste dev-only | Não-ação registrada (decisão prévia 2026-05-23) |
| `regional-fund/invoicing/saga` (PR-4) | ~4 | a classificar | A avaliar fresco em fatia separada |

Das 30 violações atuais, **26 já estão classificadas com justificativa material**. Restam ~4 (PR-4) a avaliar com a lente quádrupla antes de decidir refactor ou não-ação.

### Apêndice (2026-05-23 — pós-PR-4 e PR-5)

Após classificação fresca dos 4 arquivos restantes (PR-4) e execução do refactor da saga (PR-5), as 4 violações do PR-4 distribuíram-se assim:

#### Caso 3: `marketplace/regional-fund.service.ts` — 2 violações — natureza (4)

- **Linhas 113 e 128:** comentários JSDoc dentro do método `topUpRegionalFundBankFromReserve`, explicando idempotência (`uniq em bank_transactions`) e schema Genesis (`bank_transactions.reference_id é UUID`).
- **Material:** arquivo já usa o boundary correto (importa `bankAccountRepository`, `bankAccountService`, `bankTransactionService`, `buildSystemAuthorship` do bank). Operação financeira passa pelo balcão; as 2 menções são documentação operacional sobre a interação com o substrato.
- **Decisão:** NÃO-AÇÃO. Mesma família do rides (Caso 2) — docstring documental que cita nome literal da tabela para clareza operacional.

#### Caso 4: `invoicing/invoice.service.ts` — 1 violação — natureza (4)

- **Linha 66:** string literal `` `Serviço - ${entry.entryType} (bank_ledger)` `` na descrição do `InvoiceItem` (texto humano que aparece no documento da fatura, identificando a fonte canônica para o usuário).
- **Material:** arquivo já importa `bankLedgerRepository` e usa `getEntryById` para buscar entradas (boundary correto). A única menção `bank_ledger` está em texto descritivo de UX/contábil, não em acesso.
- **Decisão:** NÃO-AÇÃO. Variante de natureza (4) — string literal documental como parte do conteúdo gerado, não acesso ao substrato.

#### Caso 5: `core/sagas/handlers/saga-compensation.handler.ts` — 1 violação — natureza (1) → REFACTOR REAL ✓

- **Linha 125 (pré-PR-5):** `SELECT internal_completed_at FROM bank_transactions WHERE tenant_id=? AND id=? LIMIT 1` — query real verificando se transação foi liquidada antes de delegar compensação (`compensateTransaction` em `@modules/bank/ledger-compensation.service`).
- **Classificação:** leitura pura movível. Único candidato a refactor real do PR-4. Sem cross-domain via FK, sem CTE complexa, sem import dinâmico, sem cálculo de dinheiro — exatamente o tipo de fatia que o template do PR-1 trata bem.
- **Execução:** PR-5 (commit `a15639d0`, 2026-05-23). Adicionado método `getInternalCompletedAtById` em `BankTransactionReadRepository` (vizinho semântico — leitura por id em `bank_transactions`); SELECT inline substituído por chamada ao método. Comportamento idêntico (mesma query, mesma semântica de skip quando `internal_completed_at` null). 5 critérios verdes: `tsc --noEmit` exit 0, grep órfão zero, 4 gates verdes, `critical_total 30→29`, import unused `runQueryWithTenant` limpo de quebra.

### Saldo agregado final (pós-PR-1 + PR-5)

| Origem | Violações | Natureza | Tratamento |
|---|---|---|---|
| `reporting-bank-aggregates.ts` | (-17, zeradas) | (1) leitura pura movível | Refactor real PR-1, commit `a672e071` |
| `saga-compensation.handler.ts:125` | (-1, zerada) | (1) leitura pura movível | Refactor real PR-5, commit `a15639d0` |
| `real-margin.service.ts` | 9 | (2) cross-domain via FK | Não-ação documentada (Caso 1) |
| `rides/*` (4 arquivos) | 8 | (4) docstring documental | Não-ação documentada (Caso 2) |
| `e2e-incentive-bank-checklist.ts` | 9 | (3) script de teste dev-only | Não-ação registrada (sessão 2026-05-23) |
| `regional-fund.service.ts` | 2 | (4) docstring documental | Não-ação documentada (Caso 3) |
| `invoice.service.ts` | 1 | (4) string descritiva | Não-ação documentada (Caso 4) |
| **TOTAL atual** | **29** | **todas classificadas** | **dívida integralmente tratada** |

`critical_total = 29`, e **cada uma das 29 violações restantes tem decisão registrada** (via DECISION-0045 cobre 20; registro prévio do E2E cobre as outras 9). O número parou de ser lista pendente — virou inventário compreendido. Higiene futura possível via `DT-GATE-DOCSTRING-FALSE-POSITIVE` (refinar gate para distinguir comentário/string literal de SQL real reduziria os 11 falso-positivos de natureza (4) sem alterar código).

#### Supera

(nenhuma — aplicação concreta de DECISION-0044)

#### Vinculadas

- DECISION-0044 (princípio quádruplo)
- RFC C56 (fechada em paralelo via addendum em `docs/02_decisions/RFC_C56_real_margin_viola_ssot.md`)
- `DT-GATE-DOCSTRING-FALSE-POSITIVE` (proposta de melhoria do gate)
- Commit `a672e071` (PR-1 — natureza 1, comprovação inicial do refactor real)
- Commit `a15639d0` (PR-5 — natureza 1, segundo refactor real fechando a fatia de boundary do money)

#### Superada por

(preencher quando superada)

---

## DECISION-0046 — `actor_wallet` como carteira canônica de qualquer actor econômico

**Status:** ativa
**Sessão:** 2026-05-26 (canonicalização pós D-money / wallet statement)
**Decisor:** Clayton (decisão de produto + arquitetura)
**Commits âncora:** `adcbc039` (D-money entrega o saldo) + `b62ab6b9` (statement com origem rastreável)

### Decisão

O `account_type = 'actor_wallet'` (em `bank_accounts`) é a **carteira interna canônica** de qualquer actor econômico do UnifiCard — pessoa física, empresa, prestador, motorista, entregador, vendedor, bar, restaurante, fornecedor, organizador de evento e qualquer outra entidade econômica que receba saldo dentro do sistema.

Decorrências obrigatórias:

1. **Bank é SSOT.** A carteira é uma row em `bank_accounts` com `account_type='actor_wallet'`. Saldo emerge EXCLUSIVAMENTE de `bank_ledger`. Não há ledger paralelo, conta espelhada ou cache de verdade.
2. **Único nome canônico.** Para qualquer fluxo futuro que precise creditar saldo de actor, o destino é `actor_wallet`. Reusar `user_wallet` (legado dormente), `seller_available` (lifecycle system agregado), ou `credit` (conta default genérica) para esse papel é violação de canonicidade.
3. **Criação canônica única.** `bankAccountService.ensureActorWalletAccount(tenantId, actorId, currency?)` é o caminho único. Composite `owner_id = '${actorId}:actor_wallet'`, `owner_type='actor'`, `actor_id` preenchido (constraint `bank_accounts_actor_required_for_actor_owner`).
4. **Não é receita.** `platform_revenue`/`platform_fees` são canais distintos.
5. **Não é payout externo.** Saque para banco real fica para frente posterior; origem desse fluxo SERÁ a `actor_wallet` (DT-ACTOR-WALLET-PAYOUT-WIRING).
6. **Não é bank_settlement.** Movimento para banco externo é frente posterior.

### Contexto material que motivou a decisão

Auditoria pré-D-money (sessão 2026-05-26) revelou conflito semântico entre:

- `bank_accounts.account_type='seller_available'` — conta SYSTEM tenant-única, agregada, do plano Bank antigo (lifecycle seller_pending → seller_available → seller_payout do release-worker legado).
- `service_orders.status='release_approved'` — estado operacional pós D2 (estado-only, sem mover dinheiro).
- `user_wallet` — declarado no enum mas com 0 instâncias actor-owned em produção (DT-PIPELINE-WIRING-GAP confirmou: lifecycle accounts NUNCA foram criadas por actor; só system).

Reusar qualquer um dos três nomes criaria duas verdades com o mesmo termo (saldo financeiro real vs estado operacional, ou agregado system vs individual). A escolha de nome novo `actor_wallet` (decisão K_wallet_1 = Opção D) resolveu pela raiz, e foi materializada por:

- Migration `20260530557000_extend_bank_accounts_actor_wallet.sql` (CHECK + `actor_wallet`).
- Service `ensureActorWalletAccount` + `getActorWalletAccount` (bank-account.service.ts).
- Repository (`createAccount`) reconhecendo composite `:actor_wallet` por `actors.id` direto.
- D-money commit `adcbc039` move escrow_payments → actor_wallet via `reference_type='fixed_price_release_to_actor_wallet'`.
- Read-model commit `b62ab6b9` expõe saldo+origem (`GET /identity/wallet/actor-statement`).

### Vocabulário formalizado

| account_type        | Papel                                                | Status canônico   |
|---------------------|------------------------------------------------------|-------------------|
| `actor_wallet`      | Carteira interna do actor (recebíveis de qualquer módulo)| **CANÔNICO**  |
| `escrow_payments`   | Custódia do pagamento até release                    | canônico (system) |
| `platform_revenue`  | Receita da plataforma                                | canônico (system) |
| `platform_fees`     | Fees da plataforma                                   | canônico (system) |
| `user_wallet`       | -                                                    | legado/dormente   |
| `seller_pending`/`seller_available`/`seller_payout` | -                | legado/agregado   |
| `credit`            | Conta default genérica (sem semântica de recebíveis) | legado            |

### Enforcement

1. Documental: `docs/01_normative/BANK_SEMANTICS.md` (atualizado nesta sessão) declara o papel canônico de `actor_wallet` e o status legado/dormente dos demais.
2. Tipo: `BankAccountType` em `bank-account.types.ts` inclui `actor_wallet` com JSDoc explícito.
3. CHECK constraint: migration `20260530557000` admite `'actor_wallet'`.
4. Criação canônica: `bankAccountService.ensureActorWalletAccount` — método único para garantir a conta.
5. Read-model: `modules/wallet/actor-wallet-statement.service.ts` (módulo dedicado, allowPath em `validate-architectural-patterns.mjs`).
6. Gates: `validate:architecture --strict` mantém `critical_new=0`. Qualquer SELECT/INSERT em `bank_*` fora de `modules/bank|wallet|...` permanece bloqueado.

### Supera

(nenhuma — nova decisão canonical; não substitui DECISION anterior)

### Vinculadas

- `DT-ACTOR-WALLET-PAYOUT-WIRING` (OPEN) — saque externo a partir de `actor_wallet` é frente posterior.
- `DT-CAMADA1-FEE-SPLIT` (OPEN) — Camada 1 ainda não separa fee da plataforma na entrada.
- `DT-ACTOR-WALLET-VISIBILITY` — pode ser fechada após `b62ab6b9` (read-model statement disponível por rota canônica).
- `DT-PIPELINE-WIRING-GAP` (OPEN) — os 3 elos de wiring de payout/settlement legados permanecem registrados; D-money decidiu pular o plano antigo e ir direto para `actor_wallet`.

Commits:
- `adcbc039` — D-money entrega o saldo em `actor_wallet`.
- `b62ab6b9` — Statement endpoint com saldo + origem rastreável.

### Superada por

(preencher quando superada)

---

## DECISION-0047 — Economic Policy Engine como camada canônica de DECISÃO de split

**Status:** ativa
**Sessão:** 2026-05-26 (PE-1 substrate — antes do plug em service_execution)
**Decisor:** Clayton (decisão de produto + arquitetura)
**Commits âncora:** PE-1 substrate (este commit) — 5 migrations + types + repository + resolver puro + E2E

### Decisão

A configuração de **policy econômica** (regras de split por contexto, fees, regional fund, access pass, ZERO_FEE, RCA etc.) sai do espaço hardcoded espalhado em services individuais e passa a ser **resolvida por engine único** sobre tabelas dedicadas. O engine é função pura sobre o contexto da transação; a persistência financeira continua sendo `bank_splits` / `bank_ledger`.

### O que isso significa concretamente

1. **Camada de DECISÃO ≠ camada de PERSISTÊNCIA.** `economic_policies` + `economic_policy_lines` armazenam a CONFIGURAÇÃO de regras (qual % vai para revenue_share, fee, regional fund, etc.). `bank_splits` continua sendo a PERSISTÊNCIA canônica do split realizado (DECISION-0044 / CORE_SPLIT_PAGAMENTO_CANONICO permanecem soberanos sobre a persistência).
2. **Resolver determinístico.** `economicPolicyEngineService.resolveEconomicPolicy(input)` retorna a policy aplicável a um contexto (tenant + modulo + vertical/actor_type/serviceType/pricingModel/settlementFlow/country/region/city/categoryId/channel/campaignId), via algoritmo de specificity DESC → priority DESC → effective_from DESC. Empate real no topo = `POLICY_AMBIGUITY` (fail-closed). Nenhuma elegível = `POLICY_NOT_FOUND` (fail-closed).
3. **BPS integer determinístico.** `calculatePolicySplits(amountCents, lines)` usa `Math.floor((amountCents * bps) / 10000)` (sem float, sem NUMERIC). Drift de arredondamento absorvido pela primeira linha `revenue_share`. Se nenhuma revenue_share existir e houver drift, erro `DRIFT_NO_REVENUE_SHARE` (fail-closed).
4. **Access pass override.** `access_pass_products` + `actor_access_passes` permitem comprar passes que SOBRESCREVEM o `bps` da linha `platform_fee` durante a vigência. Outras linhas (regional_fund, reserve, referral, group_allocation, rca_commission) não são alteradas por pass — mudança requer policy nova.
5. **Append-only audit.** `economic_policy_resolution_logs` registra cada chamada ao resolver (resolved/ambiguous/not_found/error) com snapshot do input + policy + splits + pass aplicado. Permite reproduzir a decisão mesmo que a policy mude depois.
6. **RLS por tenant.** Todas as 5 tabelas têm RLS via `current_setting('app.current_tenant')`. Não há leitura cross-tenant.
7. **NÃO toca bank_ledger ainda.** PE-1 entrega APENAS o substrato. O plug em `service_execution` (substituir o split hardcoded `escrow_payments → actor_wallet/platform_fees/...` por chamada ao engine) é frente PE-3 separada. PE-2 será admin/CRUD; PE-3 será o plug.

### Tabelas materializadas (5 migrations)

| Tabela                                  | Papel                                                                                           | Status |
|-----------------------------------------|-------------------------------------------------------------------------------------------------|--------|
| `economic_policies`                     | Header da policy: seletores + tipo (COMMISSION_SPLIT/ACCESS_PASS/HYBRID/ZERO_FEE/CONTRACTUAL) + vigência | CORE — CONFIGURAÇÃO |
| `economic_policy_lines`                 | Linhas da policy: line_type × destination_type × bps OR fixed_amount_cents                      | CORE — CONFIGURAÇÃO |
| `access_pass_products`                  | Catálogo de access passes vendáveis (duration, price, commission_override_bps)                  | CORE — CONFIGURAÇÃO |
| `actor_access_passes`                   | Instâncias compradas por actor (starts_at/ends_at/status)                                       | CORE — INSTÂNCIA    |
| `economic_policy_resolution_logs`       | Trilha append-only de cada resolução do engine                                                  | CORE — AUDITORIA    |

### Relação com `bank_policies` legacy

`bank_policies` (citada em CORE_SPLIT_PAGAMENTO_CANONICO §2.1 como "CONFIGURAÇÃO" para regras de split) NÃO foi removida nesta fatia. Ela permanece em estado dormente e é tratada como legado. O engine canônico de policy a partir de PE-1 é o `economic_policies` (+ lines), pelos seguintes motivos:

1. Vocabulário institucional já incorpora vocabulário cross-domain (`actor_type`, `vertical`, `categoryId`, `channel`, `campaignId`) que `bank_policies` não cobre.
2. Discriminated union `policy_type` permite ACCESS_PASS / HYBRID / ZERO_FEE / CONTRACTUAL como variantes formais — `bank_policies` legado não tem essa semântica.
3. Append-only audit (`economic_policy_resolution_logs`) é integral ao engine; `bank_policies` não tem essa contraparte.

A deprecação formal de `bank_policies` é DT pendente (`DT-POLICY-ENGINE-LEGACY-DEPRECATION`) — não bloqueia PE-1.

### Vocabulário formalizado

#### `policy_type`

| Valor               | Semântica                                                                                          |
|---------------------|----------------------------------------------------------------------------------------------------|
| `COMMISSION_SPLIT`  | Distribuição clássica (revenue_share + platform_fee ± fund ± reserve)                              |
| `ACCESS_PASS`       | Policy especial associada a pass de actor                                                          |
| `HYBRID`            | Combinação de split + pass + outras camadas                                                        |
| `ZERO_FEE`          | 100% revenue_share (campanha promocional, gratuidade institucional)                                |
| `CONTRACTUAL`       | Policy individual negociada (contratos específicos, parceiros estratégicos)                        |

#### `line_type`

| Valor               | Destino canônico típico (line.destination_type)                                                    |
|---------------------|----------------------------------------------------------------------------------------------------|
| `revenue_share`     | `receiver_actor` / `actor_wallet`                                                                  |
| `platform_fee`      | `platform_fees`                                                                                    |
| `regional_fund`     | `regional_fund`                                                                                    |
| `reserve`           | `risk_reserve`                                                                                     |
| `referral`          | `referrer_actor_wallet`                                                                            |
| `group_allocation`  | `group_wallet`                                                                                     |
| `rca_commission`    | `rca_actor_wallet`                                                                                 |
| `custom`            | qualquer destino válido (custom requer justificativa documentada)                                  |

### Provas materiais (commit PE-1)

1. **Migrations aplicadas em DB live:**
   - `20260530560000_create_economic_policies.sql`
   - `20260530561000_create_economic_policy_lines.sql`
   - `20260530562000_create_access_pass_products.sql`
   - `20260530563000_create_actor_access_passes.sql`
   - `20260530564000_create_economic_policy_resolution_logs.sql`
2. **Types TS** em `backend/src/modules/economy/policy-engine/economic-policy.types.ts` (mirror exato das migrations; sem float; bps `number 0..10000`; amount_cents `number` inteiro).
3. **Repository** em `economic-policy.repository.ts` (createPolicy/createPolicyLine/createAccessPassProduct/createActorAccessPass/findEligiblePolicies/findPolicyLines/findActiveAccessPasses/insertResolutionLog).
4. **Resolver puro** em `economic-policy-engine.service.ts` (resolveEconomicPolicy + applyAccessPassOverride + calculatePolicySplits).
5. **E2E** `validate-pipeline-e2e-economic-policy-engine.ts` — 15 testes verdes (T1: contexto resolve; T2: city > region; T3: region > country; T4: category > vertical; T5: priority desempata; T6: AMBIGUITY; T7: vigência respeitada; T8: BPS integer; T9: drift to revenue_share; T10: invariante soma; T11: pass zera platform_fee; T12: pass expirado não altera; T13: ZERO_FEE; T14: NOT_FOUND; T15: category seletor).

### Enforcement

1. **Documental:** este DECISION-0047 + DTs atrelados.
2. **Tipo:** Discriminated union `EconomicPolicyType` + `EconomicPolicyLineType` + `EconomicPolicyDestinationType` em TS.
3. **CHECK constraints:** policy_type / status / line_type / destination_type / bps range / starts_at < ends_at / effective_until > effective_from.
4. **RLS:** todas as 5 tabelas isoladas por tenant via `app.current_tenant`.
5. **Resolver fail-closed:** AMBIGUITY / NOT_FOUND / DRIFT_NO_REVENUE_SHARE / CALCULATION_INVALID — nunca silenciar.
6. **Audit trail:** `economic_policy_resolution_logs` grava CADA resolução (resolvido/ambíguo/não-encontrado).

### Supera

(nenhuma — nova decisão canonical; introduz camada nova de DECISÃO)

### Vinculadas

- `DT-POLICY-ENGINE-LEGACY-DEPRECATION` (OPEN) — `bank_policies` permanece como legado dormente.
- `DT-ECONOMIC-POLICY-ADMIN-PANEL` (OPEN) — CRUD/UI de policies é PE-2.
- `DT-CATEGORY-AS-POLICY-SELECTOR` (OPEN) — `categories` é global (sem tenant_id); usar como seletor em policy tenant-bound exige modelagem complementar.
- `DT-POLICY-ENGINE-PLUG-SERVICE-EXECUTION` (OPEN) — substituir split hardcoded em `service-payment-execution` é frente PE-3.
- `DT-CAMADA1-FEE-SPLIT` (OPEN) — Camada 1 ainda não separa fee; PE-3 cobrirá.

### Superada por

DECISION-0048 (2026-05-26) reduz o escopo desta decisão. `economic_policies` permanece canônica APENAS para resolução/configuração de policy econômica — NUNCA para materialização financeira. Materialização permanece exclusiva do UnifyBank (`bank_splits` + `bank_ledger` + `bank_transactions` via `bank-transaction.service`). Esta DECISION-0047 não é revogada — é precisada.

---

## DECISION-0048 — Convergência policy engine: economic_policies é resolução, UnifyBank é materialização (sem coexistência permanente)

**Status:** ativa
**Sessão:** 2026-05-26 (convergência pós-PE-1, ambiente dev/virgem)
**Decisor:** Clayton (decisão arquitetural)
**Precisa:** DECISION-0047 (escopo reduzido)
**Commits âncora:** (a preencher no commit desta fatia)

### Decisão

`economic_policies` / `economic_policy_engine` são **canônicos** para resolução e configuração de política econômica. Eles **NÃO são ledger, NÃO são split materializado e NÃO substituem `bank_ledger`, `bank_transactions`, `bank_splits` nem o executor financeiro do UnifyBank**. Toda política resolvida deve ser materializada pelo Bank.

`bank_policies` / `bank-policy.service.resolveSplitPolicy` **deixam de ser fonte ativa para fluxos econômicos**. Como o sistema não possui legado produtivo (ambiente dev/virgem; 0 rows em `bank_policies`; sem transações reais de usuários), a estratégia é **convergir agora**, sem coexistência permanente nem cicatriz arquitetural.

### Camadas formalizadas

| Camada | Componentes canônicos | Estado |
|--------|----------------------|--------|
| **DECISÃO** (resolução de regra) | `economic_policies` + `economic_policy_lines` + `access_pass_products` + `actor_access_passes` + `economic_policy_resolution_logs` + `economicPolicyEngineService` | CANÔNICA ÚNICA |
| **CÁLCULO** (BPS integer determinístico) | `economicPolicyEngineService.calculatePolicySplits()` (sem float) | CANÔNICA ÚNICA |
| **EXECUÇÃO** (materialização monetária) | `bank-transaction.service` (`createTransactionWithSplit` / `createTransactionWithExplicitSplitLines`) | CANÔNICA ÚNICA |
| **PERSISTÊNCIA** (SSOT) | `bank_transactions` + `bank_splits` + `bank_ledger` | IRREVERSÍVEL (LEDGER_SOVEREIGNTY) |
| **DESTINOS** | `bank_accounts` — `actor_wallet` (DECISION-0046) + system (`platform_fees`, `platform_revenue`, `regional_fund`, `risk_reserve`, `escrow_payments`, `clearing`, `bank_settlement`) | CANÔNICA |
| **CÁLCULO LEGACY** (cutover gradual) | `bankSplitEngineService.calculateSplits()` — só defaults hardcoded (sem fonte alternativa de policy) | SUBORDINADO; eventual cutover em PE-3+ |

### O que mudou materialmente (esta fatia)

1. **`bank-policy.service.resolveSplitPolicy()` REMOVIDO.** Não existe mais path de leitura de policy de split fora do `economic_policy_engine`.
2. **`bank-policy.service.setPolicy()` REMOVIDO.** Não existe mais write-API para `bank_policies` como policy registry de split.
3. **Tipos `SplitPolicyRule` / `SplitPolicy` / `SplitPolicyMetadata` REMOVIDOS.**
4. **`bank-policy.service.getPolicy<T>()` PRESERVADO** apenas porque `bank-limit.service` consulta para configurar limites operacionais (defaultLimit) — uso distinto de policy econômica.
5. **`bank_policies` (tabela) HARD-DEPRECATED** via migration `20260530566000_deprecate_bank_policies_table.sql` + `COMMENT ON TABLE`. NÃO dropada porque `getPolicy<T>()` ainda lê para `bank-limit.service`. Remoção física rastreada em `DT-BANK-POLICIES-PHYSICAL-REMOVAL`.
6. **`bankSplitEngineService.calculateSplits()` PERMANECE** como calculador para event_ticket / ride_payment / p2p_transfer / group_contribution / service_booking — mas SEM fonte alternativa de policy (`resolveSplitPolicy` removido). Usa apenas defaults hardcoded por contexto. **Cutover para `economic_policy_engine` é frente PE-3+.**
7. **`rca_commission` → `channel_commission`** em `EconomicPolicyLineType`. `rca_actor_wallet` → `channel_actor_wallet` em `EconomicPolicyDestinationType`. Sigla "RCA" (Representante Comercial Autônomo) é jargão brasileiro estreito; canal genérico cobre afiliado / parceiro / RCA / marketplace externo. Identidade do canal específico fica em `metadata.channelKind` ou `destination_key`. Migration corretiva `20260530565000_rename_rca_to_channel_commission.sql` aplicou ALTER nas CHECK constraints.
8. **`category_id` como seletor de policy: MANTIDO.** Norma atualizada: categorias continuam descritivas para identidade de produto/serviço, mas **podem selecionar** policy econômica quando houver `economic_policy` ativa, versionada, auditável e vigente. Categoria **NÃO calcula split sozinha**; **só seleciona policy**. Materialização financeira continua exclusiva do UnifyBank. Vide §9.3 atualizada em CORE_SPLIT_PAGAMENTO_CANONICO.md.
9. **3 guardrails CRITICAL adicionados** em `scripts/validate-architectural-patterns.mjs`:
   - `NO_LEGACY_BANK_POLICY_SERVICE_IMPORT` — impede novo import de `bank-policy.service` fora da allowlist (próprio arquivo + `bank-limit.service`).
   - `NO_BANK_EXECUTOR_IMPORT_IN_POLICY_ENGINE` — impede `modules/economy/policy-engine/**` importar `bank-ledger` / `bank-transaction.service` / `bank-split-engine` / `bank-split.repository`. Garante materialmente que PE engine nunca vire executor financeiro.
   - `NO_RCA_COMMISSION_LITERAL` — impede reaparição de `rca_commission` / `rca_actor_wallet` em código.

### Invariantes inegociáveis (DECISION-0048)

1. **PE engine NÃO importa executor financeiro do Bank.** Guardrail material via `validate-architectural-patterns.mjs`.
2. **PE engine NÃO escreve em `bank_ledger` / `bank_splits` / `bank_transactions`.** Apenas em `economic_policy_resolution_logs` (audit puro, sem impacto monetário).
3. **`bank-transaction.service` permanece o único orquestrador que materializa dinheiro.**
4. **Novos fluxos econômicos DEVEM usar BPS integer** via `economic_policy_engine` + `createTransactionWithExplicitSplitLines`. Hardcoded percentual em fluxo novo é violação.
5. **Fail-closed institucional:** quando policy é exigida e `economic_policy_engine` retorna `POLICY_NOT_FOUND` / `POLICY_AMBIGUITY`, fluxo financeiro NÃO procede. Nada de fallback hardcoded em fluxos novos.
6. **`actor_wallet` permanece destino canônico de saldo líquido do actor** (DECISION-0046).

### O que NÃO foi feito nesta fatia (rastreado em DT)

- **PE-3: plug em `service-payment-execution`** — ainda hardcoded 100% receiver. `DT-POLICY-ENGINE-PLUG-SERVICE-EXECUTION` permanece OPEN.
- **PE-legacy: cutover de event_ticket / ride / p2p / group para `economic_policy_engine`** — `bankSplitEngineService` permanece para esses contextos com defaults hardcoded.
- **Remoção física de `bank_policies`** — depende de `bank-limit.service` migrar para tabela dedicada de limites. `DT-BANK-POLICIES-PHYSICAL-REMOVAL` OPEN.
- **DT-CAMADA1-FEE-SPLIT** permanece OPEN — split material de fee/regional/etc na Camada 1 é frente PE-3.

### Vinculadas

- DECISION-0044 (bank-ledger boundaries)
- DECISION-0046 (actor_wallet canônico)
- DECISION-0047 (substrato PE-1 — escopo reduzido por esta)
- DT-POLICY-ENGINE-COEXISTENCE-PE1 (RESOLVED por esta — vide DT renomeada)
- DT-PE1-EXECUTOR-GUARDRAIL (CLOSED por esta — guardrails adicionados)
- DT-RCA-COMMISSION-VOCABULARIO (CLOSED por esta — renomeado para channel_commission)
- DT-CATEGORY-AS-POLICY-SELECTOR (RESOLVED por esta — norma atualizada em §9.3)
- DT-BANK-POLICIES-PHYSICAL-REMOVAL (nova, OPEN — remoção depende de bank-limit migrar)
- DT-POLICY-ENGINE-PLUG-SERVICE-EXECUTION (permanece OPEN — PE-3)
- DT-CAMADA1-FEE-SPLIT (permanece OPEN — PE-3)

### Superada por

(preencher quando superada)

---

## DECISION-0049 — regional_origin_basis canônico (CNPJ identifica; actor opera; OPERATIONAL impacta)

**Status:** ativa
**Sessão:** 2026-05-26 (rodada Clayton + ChatGPT pós PE-4-METRICS)
**Decisor:** Clayton (com afiação ChatGPT)
**Substitui:** DT-REGIONAL-ORIGIN-BASIS-POLICY (que estava OPEN)
**Commit âncora:** (a preencher após commit desta fatia)

### Regra-mãe

```
CNPJ identifica quem é a empresa (entidade jurídica).
Actor identifica unidade/papel operacional.
Endereço OPERATIONAL identifica onde aquela unidade impacta economicamente.
Policy declara qual origem regional usar.
Bank materializa.
Ledger prova.
```

### 8 regras inegociáveis

1. **CNPJ ≠ unidade.** Múltiplas unidades de uma empresa = múltiplos actors compartilhando `company_id`. Não criar `company_units` paralelo.
2. **Actor = papel operacional**, NÃO pessoa nem unidade fiscal. Confirma DECISION-0048 + opus.md.
3. **PJ default = `receiver_company_operational`.** HQ NUNCA como fallback automático.
4. **HQ só explícito.** Para policy querer HQ, declara `regional_origin_basis='receiver_company_hq'` em linha própria. Resolver não interpreta intenção.
5. **PF default = por policy/vertical.** Sem hardcoded universal. Serviço presencial → `service_location`; remoto/online → `receiver_identity_residence`; configurável por policy.
6. **`regional_origin_basis` enum canônico (7 valores; mixed_policy NÃO está):**
   - `payer_identity_residence`
   - `receiver_identity_residence`
   - `receiver_company_operational`
   - `receiver_company_hq`
   - `service_location`
   - `transaction_location`
   - `explicit_economic_region`
7. **`mixed_policy` = padrão de uso, NÃO valor de enum.** Composição "70% operacional + 30% sede" = duas linhas `regional_fund` na mesma policy, cada uma com basis próprio. Se virasse enum, o resolver teria que perguntar "misto de quê?" — anti-padrão samba do enum doido.
8. **Métrica pública deduplica por identidade**, NÃO por actor. Confirma PE-4-METRICS (já provado por T2/T3/T9).

### Enforcement material (esta fatia)

1. **Migration** `20260530567000_add_regional_origin_basis_to_policy_lines.sql`:
   - `ALTER TABLE economic_policy_lines ADD COLUMN regional_origin_basis TEXT`
   - CHECK `chk_origin_basis_required_for_dynamic_regional`: obrigatório quando `line_type='regional_fund' AND destination_key IS NULL`
   - CHECK `chk_origin_basis_canonical_values`: enum canônico (sem mixed_policy)
   - Aplicada (0 rows com `regional_fund` no DB live = blast zero)
2. **TS**: `RegionalOriginBasis` type em `economic-policy.types.ts`; `regionalOriginBasis: RegionalOriginBasis | null` em `EconomicPolicyLine` + `CreateEconomicPolicyLineInput` (camelCase TS, snake DB com mapping no repository).
3. **Repository**: SELECT inclui `regional_origin_basis`; INSERT mapeia `input.regionalOriginBasis ?? null`.
4. **E2E** `validate-pipeline-e2e-economic-policy-engine.ts` cobre via T16-T18:
   - T16: INSERT direto via SQL sem basis em regional_fund dinâmico → SQLSTATE 23514 + nome correto do CHECK
   - T17: INSERT direto com `basis='mixed_policy'` → SQLSTATE 23514 + chk_origin_basis_canonical_values
   - T18: `createPolicyLine` via repository com basis canônico aceito
   - **Testes provam CHECK do Postgres, não Zod/TS** (anti-padrão "teste de fumaça com perfume caro" evitado).

### Comportamento do resolver dinâmico (quando vier — PE-5+)

Quando `economicPolicyEngineService` ganhar o resolver dinâmico (frente futura, condicional a `DT-PJ-OPERATIONAL-ADDRESS-MANDATORY-BEFORE-DYNAMIC-REGIONAL`):

```
basis='receiver_company_operational':
  → busca address_assignments(owner=<actor>, role='OPERATIONAL')
  → se ausente, FAIL POLICY_REGIONAL_ORIGIN_UNRESOLVABLE
  → resolver NUNCA cai em HQ automaticamente

basis='receiver_company_hq':
  → busca address_assignments(owner=<actor.company_id>, role='HQ')
  → se ausente, FAIL POLICY_REGIONAL_ORIGIN_UNRESOLVABLE

basis='service_location':
  → busca service.primary_address_id (requer schema extra — DT-PE5-SERVICE-LOCATION-FK)
  → se ausente, FAIL POLICY_REGIONAL_ORIGIN_UNRESOLVABLE
```

Resolver tem semântica simples: lê basis declarado, resolve exatamente o que está escrito, falha se ausente. Não interpreta intenção.

### O que NÃO está nesta fatia (frentes próprias)

- Resolver dinâmico de `regional_fund` — continua FAIL-CLOSED em PE-3 / `resolveSplitDestinationFromPolicy`.
- Materialização de `economic_regions` + `economic_region_members` (DECISION-0020 §4) — pré-requisito para basis `explicit_economic_region` resolver fundos múltiplos por cidade.
- Cadastro de unidade PJ com `OPERATIONAL` no onboarding — bloqueia em produção, rastreado em `DT-PJ-OPERATIONAL-ADDRESS-MANDATORY-BEFORE-DYNAMIC-REGIONAL`.
- FK `services.primary_address_id` / `service_orders.primary_address_id` — necessário para `service_location` resolver.

### Vinculadas

- DECISION-0020 (Location Core — `address_assignments` é fonte de OPERATIONAL/HQ/RESIDENCE)
- DECISION-0046 (`actor_wallet` canônico)
- DECISION-0047 (PE-1 substrate)
- DECISION-0048 (camada DECISÃO ≠ EXECUÇÃO)
- DT-REGIONAL-ORIGIN-BASIS-POLICY → CLOSED por esta DECISION
- DT-PJ-OPERATIONAL-ADDRESS-MANDATORY-BEFORE-DYNAMIC-REGIONAL (nova OPEN HIGH)
- DT-PE3-LINE-TYPES-FAIL-CLOSED (permanece OPEN LOW — resolver dinâmico futuro destravar`regional_fund`)

### Superada por

(preencher quando superada)

---

## DECISION-0050 — Cartório operacional de actor-unidade via service_provider owner_type

**Status:** ativa
**Sessão:** 2026-05-26 (PE-5-CARTÓRIO; pós DECISION-0049 + raio-x PE5_CARTORIO_OPERACIONAL_READONLY_REPORT)
**Decisor:** Clayton (L_owner_1 = Opção A)
**Commit âncora:** (preencher após commit)

### Problema

`DECISION-0049` declarou que policy line com `regional_origin_basis=
'receiver_company_operational'` (resolver dinâmico futuro) DEVE consultar
`address_assignments(role='OPERATIONAL')` do actor-unidade. Mas o sistema
NÃO tinha convenção de qual `owner_type` usar para esse vínculo:

- enum vivo de `address_assignments.owner_type`: `('company','profile','event','ride','group','tenant_hq','service_provider')`
- enum vivo de `actors.actor_type`: `('user','page','group','channel','actor_human','actor_organizational','actor_system','person','company','system')`
- `'service_provider'` está APENAS em `owner_type` (nunca foi materializado em runtime — 0 rows)
- Sem cadastro vivo de OPERATIONAL para nenhum actor (0 rows com `role='OPERATIONAL'`)

### Opções consideradas

**A. `owner_type='service_provider', owner_id=<actor.id>` (ESCOLHIDA)**
- Reusa enum existente. Zero migration.
- Inverte coerentemente: HQ → `companies.company_id` (raiz jurídica); OPERATIONAL → `actor.id` (unidade).
- Não mistura `companies.company_id` com `actors.id` no mesmo `owner_type`.
- `service_provider` aqui é nome TÉCNICO de owner de endereço; NÃO é actor_type.

**B. `owner_type='company', owner_id=<actor.id>`**
- Rejeitada: mistura conceitos (`company` historicamente aponta para `companies.company_id`).
- Pode quebrar UNIQUE `(owner_type, owner_id, role) WHERE is_primary`.

**C. Estender enum com `'actor'`**
- Rejeitada: exige migration de enum sem ganho material sobre (A).
- "service_provider" continuaria no enum sem uso (fragmentação).
- Pode ser reavaliada em frente futura se "service_provider" virar nomenclatura ambígua na operação real.

### Escolha — Opção A

**Convenção canônica:**

```
HQ (jurídico, raiz):
  address_assignments.owner_type = 'company'
  address_assignments.owner_id   = <companies.company_id>
  address_assignments.role       = 'HQ'

OPERATIONAL (unidade operacional de actor):
  address_assignments.owner_type = 'service_provider'  ← técnico, NÃO actor_type
  address_assignments.owner_id   = <actors.id>
  address_assignments.role       = 'OPERATIONAL'
  address_assignments.is_primary = true
  address_assignments.valid_until_at = NULL (ativo)
```

### Regras inegociáveis (DECISION-0050)

1. **`service_provider` é owner_type TÉCNICO de endereço operacional. NÃO é actor_type.** Enum vivo de `actors` NÃO inclui `service_provider` — não inventar.
2. **HQ NUNCA é fallback automático de OPERATIONAL** (confirma DECISION-0049).
3. **Sem backfill silencioso** HQ → OPERATIONAL. Se um actor não tem OPERATIONAL cadastrado, o sistema TRAVA (anti-padrão "premiar cadastro incompleto").
4. **CNPJ identifica entidade jurídica.** Actor identifica unidade/papel operacional. OPERATIONAL identifica onde impacta.
5. **Múltiplas unidades de uma empresa** = múltiplos actors compartilhando `company_id`. Cada actor (unidade) tem seu próprio OPERATIONAL.
6. **Substituição de endereço operacional** NÃO é suportada nesta fatia (PE-5-CARTÓRIO MVP). Tentativa de criar 2º OPERATIONAL ativo para mesmo actor → `OPERATIONAL_ADDRESS_ALREADY_EXISTS`. Padrão de troca (encerrar `valid_until_at` do anterior + criar novo) é frente futura.
7. **Resolver dinâmico de regional_fund continua FAIL-CLOSED em PE-3** — DECISION-0050 entrega APENAS o cartório (escrita + leitura + readiness). Plug em risk-financial-gate / resolver é frente PE-5-RESOLVER, condicional a `DT-PJ-OPERATIONAL-ADDRESS-MANDATORY-BEFORE-DYNAMIC-REGIONAL` continuar OPEN até onboarding/wizard PJ estarem prontos.
8. **`actor.id` não é pessoa**. Métricas públicas continuam deduplicando por `identities.global_user_id` (PE-4-METRICS). OPERATIONAL é dado de RESOLUÇÃO de fundo regional futuro, não de contagem pública.

### Enforcement material (esta fatia)

- **Helper** `backend/src/core/location/operational-address.helper.ts`:
  - `getOperationalAddressForActor(tenantId, actorId)` — read-only
  - `assertActorHasOperationalAddress(tenantId, actorId, mode='throw'|'warn')` — readiness check
  - `createOperationalAddressForActor(tenantId, actorId, input)` — escrita (createAddress + assignAddress)
  - Tenant-safe (valida `actors.tenant_id = tenantId`)
  - Idempotente (`OPERATIONAL_ADDRESS_ALREADY_EXISTS` em 2ª chamada)
  - Códigos de erro institucionais: `PJ_OPERATIONAL_ADDRESS_REQUIRED`, `ACTOR_NOT_FOUND_OR_CROSS_TENANT`, `OPERATIONAL_ADDRESS_ALREADY_EXISTS`
- **Endpoint REST NÃO implementado nesta fatia** — padrão de auth de location.routes.ts é só GET público. Sem padrão para POST autenticado. Rastreado em `DT-PE5-CARTORIO-ENDPOINT-AUTH`.
- **E2E** `validate-pipeline-e2e-pe5-cartorio-operacional.ts` cobre T1-T6:
  - T1: sem OPERATIONAL → null + throw + warn
  - T2: criação com convenção canônica (ownerType/ownerId/role/isPrimary/validUntilAt)
  - T3: leitura retorna o criado; não confunde com HQ da company
  - T4: idempotência (DB com exatamente 1 OPERATIONAL primário ativo)
  - T5: cross-tenant rejeitado
  - T6: snapshot bank_ledger/bank_transactions/bank_splits inalterado

### O que NÃO entra (frentes próprias)

- **PE-5-RESOLVER**: resolver dinâmico + plug em risk-financial-gate
- **DT-PE5-CARTORIO-ENDPOINT-AUTH** (nova OPEN MEDIUM): rota REST autorizada
- **DT-PE5-CARTORIO-ATOMICITY** (nova OPEN LOW): createAddress + assignAddress sem transação SQL conjunta
- **Substituição de OPERATIONAL** (encerrar + criar novo)
- **UNIQUE em `companies.cnpj`**
- **Materialização de `economic_regions`** (DECISION-0020 §4)

### Vinculadas

- DECISION-0020 (Location Core)
- DECISION-0046 (actor_wallet)
- DECISION-0048 (camada DECISÃO ≠ EXECUÇÃO)
- DECISION-0049 (regional_origin_basis)
- DT-PJ-OPERATIONAL-ADDRESS-MANDATORY-BEFORE-DYNAMIC-REGIONAL (permanece OPEN HIGH; convenção atualizada)
- DT-PE5-CARTORIO-ENDPOINT-AUTH (nova)
- DT-PE5-CARTORIO-ATOMICITY (nova)

### Superada por

(preencher quando superada)

---

## DECISION-0051 — Resolver dinâmico de regional_fund PJ-only (PE-5-RESOLVER-MVP)

**Status:** ativa
**Sessão:** 2026-05-26 (Q-real = A, PJ-only, decisão Clayton confirmada por ChatGPT)
**Decisor:** Clayton
**Commit âncora:** (preencher após commit)

### Decisão

O resolver dinâmico de `regional_fund` (chamado em `service-payment-execution.service.createExecution` quando policy line tem `destination_type='regional_fund' AND destination_key IS NULL`) suporta APENAS **basis PJ** no MVP:

- `receiver_company_operational` — via helper `operationalAddressHelper.getOperationalAddressForActor(receiverActorId)` (PE-5-CARTÓRIO/DECISION-0050)
- `receiver_company_hq` — via `address_assignments(owner_type='company', owner_id=<receiver.company_id>, role='HQ')`
- `mixed_policy` — múltiplas linhas `regional_fund` independentes; cada uma resolve seu basis próprio (DECISION-0049 §regra 7)

**Todos os demais basis ficam FAIL-CLOSED no MVP:**

- `receiver_identity_residence` / `payer_identity_residence` → aguarda PE-5-RESOLVER-V2 + auditoria `profile_id` canônico (`DT-PE5-PF-RESOLVER-PENDING`)
- `service_location` → sem `services.primary_address_id` no schema
- `transaction_location` → sem fonte material
- `explicit_economic_region` → `economic_regions` não materializada (`DT-PRESSURE-LOCATION-CORE-ECONOMIC-REGIONS-MISSING`)

### Regras inegociáveis

1. **HQ NUNCA é fallback automático de OPERATIONAL.** Se policy declara `basis='receiver_company_operational'` e actor não tem OPERATIONAL ativo, falha `POLICY_REGIONAL_ORIGIN_UNRESOLVABLE` — NÃO cai em HQ. Para HQ ser usado, policy declara `basis='receiver_company_hq'` explicitamente em linha separada (ou única).
2. **`regional_fund` NUNCA entra em `payment_intent.metadata.splits` liberável para `actor_wallet`.** O split cai direto na conta do fundo regional na MESMA bank_transaction da execução; D-money não toca esses splits.
3. **`actor_wallet` continua recebendo APENAS `revenue_share`** (invariante D-money preservada).
4. **`mixed_policy` = múltiplas linhas independentes**; cada uma gera seu próprio `bank_split` numa conta `regional_fund` própria. Se duas linhas resolverem para a mesma cidade, ainda assim cada split é registrado separadamente para preservar rastreabilidade.
5. **`ensureRegionalFundBankAccountForRegion(tenantId, {country, state, city})`** é a função canônica para resolver a conta destino. MVP é city-level (não suporta múltiplos fundos por cidade nem fundos por bairro — frente futura `DT-PRESSURE-LOCATION-CORE-ECONOMIC-REGIONS-MISSING`).
6. **Sem migration nesta fatia.** Schema já estava pronto desde DECISION-0049 (coluna `regional_origin_basis` + 2 CHECK constraints).
7. **Propagação do basis:** `CalculatedEconomicSplit.regionalOriginBasis` adicionado em `economic-policy.types.ts`; `calculatePolicySplits` propaga do `EconomicPolicyLine.regionalOriginBasis`. Sem isso, o resolver não receberia o basis declarado.

### Enforcement material

- **service-payment-execution.service.ts:**
  - `SUPPORTED_DESTINATION_TYPES` ganha `'regional_fund'`.
  - `resolveSplitDestinationFromPolicy` despacha para `resolveRegionalFundDestination` quando destination_type='regional_fund'.
  - `resolveRegionalFundDestination` lê `basis` do split; switch case por basis com fail-closed agressivo.
  - Helper canônico PE-5-CARTÓRIO `operationalAddressHelper.getOperationalAddressForActor` usado para `receiver_company_operational`.
  - Query SQL direta a `address_assignments` para `receiver_company_hq`.
  - Resolução `(country, state, city)` via JOIN `countries × states × cities` por UUID.

- **economic-policy.types.ts:** `CalculatedEconomicSplit.regionalOriginBasis: RegionalOriginBasis | null`.

- **economic-policy-engine.service.ts:** `calculatePolicySplits` propaga `line.regionalOriginBasis` para cada split calculado.

- **E2E** `validate-pipeline-e2e-pe5-resolver.ts`: **8 cenários T1-T8 verdes** — provam que cada caminho funcional resolve corretamente, cada caminho fail-closed bloqueia ANTES de gravar dinheiro, mixed_policy gera splits independentes para cidades diferentes, D-money preserva invariante actor_wallet ≤ revenue_share, HQ não é fallback automático.

### Limitações conhecidas (rastreadas)

- **PF (receiver/payer_identity_residence):** `DT-PE5-PF-RESOLVER-PENDING` (nova OPEN MEDIUM) — aguarda auditoria de qual tabela é canônica para `profile_id` (`public_profiles`? `user_profiles`?) + decisão de produto sobre PF presencial vs remoto.
- **Múltiplos fundos por cidade / fundos por bairro:** aguarda materialização de `economic_regions` (`DT-PRESSURE-LOCATION-CORE-ECONOMIC-REGIONS-MISSING`).
- **`service_location` / `transaction_location`:** aguarda FK `services.primary_address_id` + decisão sobre fonte material da localização da transação.

### Próximos passos desbloqueados

- ✅ **`DT-PJ-OPERATIONAL-ADDRESS-MANDATORY-BEFORE-DYNAMIC-REGIONAL`** pode ser fechada conceitualmente (resolver entregue + cartório usado); mas continua OPEN HIGH operacionalmente porque produção exige wizard de onboarding PJ (UX). Fica como "tecnicamente pronto, UX pendente".
- Wizard de onboarding PJ vira frente própria (UX/produto).

### Vinculadas

- DECISION-0020 (Location Core — `address_assignments` é fonte material)
- DECISION-0044 (bank-ledger boundaries)
- DECISION-0046 (actor_wallet canônico — invariante preservada)
- DECISION-0048 (camada DECISÃO ≠ EXECUÇÃO)
- DECISION-0049 (regional_origin_basis canônico + CHECK Postgres)
- DECISION-0050 (cartório operacional via service_provider)
- DT-PJ-OPERATIONAL-ADDRESS-MANDATORY-BEFORE-DYNAMIC-REGIONAL (permanece OPEN — desbloqueio operacional condicional a UX)
- DT-PE5-PF-RESOLVER-PENDING (nova OPEN MEDIUM)
- DT-PE3-LINE-TYPES-FAIL-CLOSED (parcialmente RESOLVED — regional_fund destravado para PJ)

### Superada por

(preencher quando superada)

---

## DECISION-0052 — F-REFUND-SPLIT-AWARE-HARDENING (taxonomia + autoria + linkage)

**Status:** ativa
**Sessão:** 2026-05-27 (frente F-REFUND após PE-5-RESOLVER-MVP)
**Decisor:** Clayton
**Commit âncora:** (preencher após commit)

### Decisão

Auditoria do motor de estorno (`reversal.service.ts` + `reversal.repository.ts`, Prompt 51) revelou que ele JÁ É SPLIT-AWARE desde a origem — `bankSplitRepository.loadSplitLegsForReversal` lê os splits da transação original e cada um vira uma transferência reversa independente. Logo, PE-5 NÃO criou bomba escondida no estorno; o motor já devolve linha por linha.

A fatia F-REFUND-SPLIT-AWARE-HARDENING endurece o motor SEM reescrita: adiciona **etiqueta** (taxonomia canônica de `reversal_type`), **assinatura** (autoria forte para `internal_refund`) e **câmera de segurança** (rastreabilidade `original_split_id` em cada leg).

**Aprovado nesta fatia (Blocos A + B + D + E):**
- Bloco A — taxonomia `reversal_type` (5 valores canônicos, CHECK Postgres)
- Bloco B — autoria forte (`performed_by_user_id` + `authority_source`; CHECK Postgres + TS guard)
- Bloco D — E2E F-REFUND-SPLIT-AWARE (9 cenários verdes)
- Bloco E — `original_split_id` em metadata de cada leg + `reference_id` determinístico via uuidv5

**Explicitamente fora desta fatia:**
- Bloco C (approval gate para `internal_refund`) — requer raio-x do Core de Aprovação Financeira primeiro. Rastreado em **DT-CORE-APROVACAO-FINANCEIRA-RAIOX-PENDENTE**.
- Bloco F (segregação `escrow_refunds` vs `reversals`, comportamento pós D-money) — fora de escopo. Rastreado em **DT-PE5-REFUND-POST-DMONEY-CHAIN**.

### Regras inegociáveis

1. **Nenhum estorno sem `reversal_type` declarado.** Coluna NOT NULL, default `external_reversal` (sistêmico) para callers legados.
2. **`internal_refund` exige `performed_by_user_id`.** CHECK Postgres `chk_internal_refund_requires_user` enforça mesmo se aplicação for desviada.
3. **`external_reversal` / `chargeback_*` rejeitam `performed_by_user_id`.** CHECK Postgres `chk_external_reversal_is_systemic` enforça — sistêmico não tem humano.
4. **Defesa em camadas.** TS guard em `createReversalRequest` lança mensagem amigável antes do banco (`INTERNAL_REFUND_REQUIRES_PERFORMED_BY_USER` / `SYSTEMIC_REVERSAL_REJECTS_USER`). CHECK Postgres é a última linha — mas existe.
5. **`original_split_id` em `bank_transactions.metadata` de cada leg.** Persistido via UPDATE explícito após `bankTransactionService.transfer` (que não propaga metadata para `bank_transactions`). `bank_ledger` não tem coluna metadata — não foi alterado.
6. **`reference_id` determinístico** via `uuidv5(reversalId:splitId, REVERSAL_LEG_NAMESPACE)` — permite reidempotência material.
7. **Idempotência preservada.** 2ª chamada de `requestAndExecuteReversalSync` com mesmo `originalTransactionId` retorna mesmos `reversal_transaction_ids` sem duplicar legs.
8. **Sem mudança de comportamento do motor.** Apenas adicionadas colunas (DDL aditivo), validações, metadata extra. Zero alteração no fluxo de transferência das legs.

### Enforcement material

- **Migration:** `backend/migrations/20260530568000_reversals_taxonomy_and_authorship.sql` (ALTER TABLE ADD COLUMN + 4 CHECK constraints + 1 FK).
- **reversal.repository.ts:** novos tipos `ReversalType` / `ReversalAuthoritySource`; campos em `ReversalRow` / `CreateReversalRequestInput`; `REVERSAL_SELECT_COLUMNS` constante; 2 TS guards em `createReversalRequest`.
- **reversal.service.ts:** metadata da leg renomeada `split_id` → `original_split_id`; UPDATE bank_transactions.metadata explícito após `transfer` (porque `transfer` não propaga metadata).
- **Callers atualizados:** `bank-integration.service.ts:769`, `reconciliation-dispute.service.ts:281` declaram `reversalType='external_reversal'` + `authoritySource='system'`.
- **E2E:** `backend/src/scripts/validate-pipeline-e2e-refund-split-aware.ts` — 9 cenários verdes (T1-T8 funcionais + T9 removido por não determinismo).

### Limitações conhecidas (rastreadas)

- **Aprovação síncrona/assíncrona de `internal_refund` não decidida:** Bloco C adiado por DT-CORE-APROVACAO-FINANCEIRA-RAIOX-PENDENTE.
- **Estorno pós D-money tem comportamento material indefinido:** quando revenue_share já saiu do escrow para `actor_wallet`, estorno drena pool do escrow de outros pagamentos. DT-PE5-REFUND-POST-DMONEY-CHAIN.
- **Risk gate bloqueia estorno repetido no mesmo actor:** `reversal_executed` em `actor_events` pesa 18 por evento; 5 estornos = score 90 = blocked. É comportamento desejado em produção; em E2E foi mitigado com `resetRiskProfiles()` entre fases.

### Vinculadas

- CORE_ESTORNOS_FINANCEIROS_CANONICO §14 (DECISION-0052 documentada como anexo)
- CORE_APROVACAO_FINANCEIRA_CANONICO (referenciado para Bloco C — frente futura)
- DECISION-0046 (actor_wallet canônico — invariante preservada no estorno antes D-money)
- DECISION-0049 (regional_origin_basis — splits do PE-5 são revertidos corretamente)
- DECISION-0051 (PE-5-RESOLVER-MVP — origem do cenário multi-split do E2E)
- DT-CORE-APROVACAO-FINANCEIRA-RAIOX-PENDENTE (nova OPEN MEDIUM)
- DT-PE5-REFUND-POST-DMONEY-CHAIN (nova OPEN HIGH)

### Superada por

(preencher quando superada)

---

## DECISION-0053 — Actor Wallet Recovery Obligations

**Status:** ativa — IMPLEMENTADA (C1–C7 satisfeitos, 2026-05-28). Substrato + fluxo pós-D-money operacionais.
**Sessão:** 2026-05-27 (F-REFUND-POST-DMONEY Parte B — READ-FIRST + DECISION-0053)
**Decisor:** Clayton
**Commit âncora:** `6a167d77` (C7), `f8a0c59e` (fix E2E + guard relaxation), `c3d2e569` (C3.1), `61979374` (C3), migration `20260530570000` (C6)

### Contexto

F-REFUND-POST-DMONEY Parte A (commit `4c04e8d7`) bloqueou o reversal automático quando
`payment_intent.payment_status = 'released_to_actor_wallet'`, lançando
`REVERSAL_POST_DMONEY_REQUIRES_RECOVERY_FLOW`. Auditoria READ-FIRST (2026-05-27) confirmou
que nenhum substrato existente é reutilizável para recovery pós-D-money:
`financial_freezes` (fantasma), `actor_debts` (domínio de evento + schema drift),
`payout_requests` (seller exclusivo), `bank_accounts` sem campos de hold,
`approval_requests` não materializado no banco.

### Decisão

Criar substrato canônico `actor_wallet_recovery_obligations` + tabela filha
`actor_wallet_recovery_obligation_entries` para obrigações de recuperação pós-D-money.

### Axiomas inegociáveis

1. **Recovery obligation NÃO é estorno parcial.** Estorno continua total conforme
   `CORE_ESTORNOS §11.2`. Recovery é obrigação pós-release em camada separada.
2. **Reversal tradicional permanece bloqueado para `released_to_actor_wallet`, sempre.**
   Nem `recovered` nem `cancelled` nem `failed` liberam o reversal tradicional.
   Recovery pós-D-money é fluxo próprio — não desbloqueio do caminho antigo.
   (Razão: revenue_share já saiu de `escrow_payments` para `actor_wallet`; executar
   reversal tradicional depois tentaria devolver via split original, gerando duplo
   pagamento ao payer ou drenagem de escrow de terceiros.)
3. **`bank_ledger` é única verdade de saldo.** Qualquer movimentação de recovery
   transita via `bank_transactions → bank_ledger`.
4. **Sem saldo negativo.** Saldo insuficiente → obrigação em `partially_recovered`.
5. **Sem intermediação por `risk_reserve`, `platform_fees`, `regional_fund` ou
   `escrow_payments`.** Cadeia: `actor_wallet do devedor → conta canônica do payer`.
6. **Uma obrigação por caso, sem exceção de status.** Unique index total sem filtro
   WHERE em `(tenant_id, payment_intent_id, original_transaction_id, debtor_actor_id)`.
   Reabrir caso terminal exige fluxo administrativo auditado com DECISION/autoridade própria.
7. **Approval é pré-requisito hard para execução financeira.** Criação pode ser
   `pending_approval` (sem mover dinheiro). Execução financeira fail-closed até
   `approval_requests`/`approval_votes` estarem materializados.

### Schema conceitual aprovado

**`actor_wallet_recovery_obligations`** (campos causais imutáveis):
`id, tenant_id, debtor_actor_id, debtor_account_id, creditor_actor_id (NOT NULL),
creditor_account_id (NOT NULL), original_transaction_id, payment_intent_id,
reversal_id (nullable), amount_cents CHECK(>0), reason`

**Campos operacionais** (projeções — mudam por serviço canônico):
`status DEFAULT 'pending_approval', recovered_amount_cents DEFAULT 0,
approval_request_id (nullable), updated_at`

**Invariante no banco:** `CHECK (recovered_amount_cents >= 0 AND recovered_amount_cents <= amount_cents)`

**Unique index total:** `(tenant_id, payment_intent_id, original_transaction_id, debtor_actor_id)` — sem filtro WHERE

**`actor_wallet_recovery_obligation_entries`** (append-only, trilha de recuperações efetivas):
`id, tenant_id, obligation_id, recovery_transaction_id, amount_cents CHECK(>0), created_at`

`recovered_amount_cents` na tabela principal é projeção que deve reconciliar com
`SUM(entries.amount_cents)`.

### Estados válidos

`pending_approval → approved → partially_recovered → recovered (terminal)`
`pending_approval → cancelled (terminal)`
`approved → failed (terminal)`

### Pré-requisitos de implementação

| # | Condição | Estado |
|---|----------|--------|
| C1 | DECISION-0053 aprovada | DONE ✓ |
| C2 | `approval_requests`/`approval_votes` materializados | DONE ✓ — DECISION-0054 |
| C3 | Serviço de débito de `actor_wallet` | DONE ✓ — commit `61979374`, `actor-wallet-debit.service.ts` |
| C3.1 | Income withholding síncrono no D-money | DONE ✓ — commit `c3d2e569`, `drainRecoveryObligationsForCredit` |
| C4 | Resolver de `creditor_account_id` via transação original | DONE ✓ — DECISION-0056, commit `13db36d8` |
| C4b-1/C4b-2 | User wallet provisioning automático | DONE ✓ — commits `13ee5d8a` + `d3ab14f3` |
| C5 | Nomenclatura ratificada por `07_NOMENCLATURA_CANONICA.md` | DONE ✓ — 2026-05-28 |
| C6 | Migration recovery obligations substrate | DONE ✓ — `20260530570000` (2026-05-27) |
| C7 | Fluxo de finalização pós-D-money | DONE ✓ — commits `6a167d77` + `f8a0c59e`, migration `20260530571000` |

### Vinculadas

- DECISION-0052 (Bloco F adiado — esta DECISION endereça)
- CORE_ESTORNOS_FINANCEIROS_CANONICO §11.2 (recovery ≠ estorno parcial)
- CORE_APROVACAO_FINANCEIRA_CANONICO (approval como pré-requisito para execução)
- DECISION-0046 (actor_wallet canônico — invariante preservada)
- DT-PE5-REFUND-POST-DMONEY-CHAIN → CLOSED (2026-05-28) — C1–C7 satisfeitos + G-DECISION-0053 declarada coberta pelas suites individuais
- DT-CORE-APPROVAL-REQUESTS-MISSING (nova OPEN HIGH — pré-requisito C2) → CLOSED por DECISION-0054
- DT-ACTOR-WALLET-DEBIT-MISSING → CLOSED (C3+C3.1+C7 implementados e comprovados)
- DT-DMONEY-FINALIZATION-FLOW-MISSING → CLOSED (C7 implementado)
- DT-RECOVERY-PAYOUT-GATE → PARTIALLY CLOSED (C3.1 síncrono implementado; saque externo pendente)

### Superada por

(não aplicável — implementação completa, axiomas preservados)

---

## DECISION-0054 — Financial Approval Substrate (F-APROVACAO-FINANCEIRA-SUBSTRATE)

**Status:** ativa
**Sessão:** 2026-05-27 (F-APROVACAO-FINANCEIRA-SUBSTRATE)
**Decisor:** Clayton
**Commit âncora:** (preencher após commit)

### Contexto

Auditoria READ-FIRST (2026-05-27) confirmou que `approval_requests` e `approval_votes`
estavam definidas apenas em `CORE_APROVACAO_FINANCEIRA_CANONICO.md §7.2` sem qualquer
materialização no banco, migrations ou código financeiro. O único "approval" vivo era
`core/ai/approval` — sistema in-memory de confirmação de ações de IA, domínio completamente
distinto. DECISION-0053 depende de `approval_requests` materializado (pré-requisito C2)
para avançar qualquer execução financeira de recovery pós-D-money.

### Decisão

Materializar o substrato canônico mínimo de aprovação financeira conforme
`CORE_APROVACAO_FINANCEIRA_CANONICO.md §7.2`:
- `approval_requests` — gate obrigatório ANTES de execução financeira
- `approval_votes` — registro de votos, append-only, um por usuário por request

### Decisões Clayton (D1, D2, D3)

**D1 — operation_type para recovery:** `actor_wallet_recovery`
(não `manual_refund` — recovery ≠ estorno; DECISION-0053 §2.1)

**D2 — escopo:** somente `approval_requests` + `approval_votes`
(`bank_account_policies` para frente posterior)

**D3 — permission key:** `financial:approve_recovery`
(não reutilizar `financial:approve_transfer`)

### Regras inegociáveis

1. **Nenhuma operação financeira crítica sem `approval_request.status='approved'`.**
2. **`approval_requests` não move dinheiro** — registra decisão apenas.
3. **`approval_votes` é append-only** — sem UPDATE ou DELETE.
4. **Um voto por usuário por request** (constraint `uq_approval_vote_per_user`).
5. **`operation_type='actor_wallet_recovery'`** é o valor canônico para recovery pós-D-money.
6. **`status='pending'`** no momento da criação — nenhuma auto-aprovação sem política explícita.
7. **`expires_at` obrigatório** — aprovação expirada não pode ser executada.
8. **`permission_snapshot` em `approval_votes`** — auditável mesmo se permissões mudarem.

### Enforcement material

- **Migration:** `backend/migrations/20260530569000_financial_approval_substrate.sql`
  — 2 tabelas, 6 CHECKs, 1 UNIQUE, 6 índices
- **Tipos TS:** `backend/src/core/financial-approval/financial-approval.types.ts`
  — contrato de tipos sem service/repository (frentes futuras)
- **E2E:** `backend/src/scripts/validate-pipeline-e2e-financial-approval-substrate.ts`
  — 10/10 cenários verdes (T1–T10), confirmação de zero escrita em `bank_ledger`/`bank_transactions`/`bank_splits`

### Fora do escopo desta DECISION

- `bank_account_policies` (thresholds/limites — DECISION posterior)
- Approval service / repository
- Rotas públicas de aprovação
- Integração com reversal/recovery (DECISION-0053 C2 satisfeito, mas C3–C7 ainda pendentes)
- `financial:approve_recovery` no `MAPA_CANONICO_PERMISSIONS_v1.md` (frente de permissões)

### Vinculadas

- DECISION-0053 (pré-requisito C2 satisfeito por esta DECISION)
- CORE_APROVACAO_FINANCEIRA_CANONICO.md §7.2 (norma que define o schema)
- DT-CORE-APPROVAL-REQUESTS-MISSING (CLOSED por esta DECISION)
- DT-CORE-APROVACAO-FINANCEIRA-RAIOX-PENDENTE (parcialmente avançada — substrato existe; sync/async ainda aberto)
- DT-PE5-REFUND-POST-DMONEY-CHAIN (C2 satisfeito; C3–C7 ainda bloqueantes)

### Superada por

(preencher quando superada)

---

## DECISION-0055 — Actor Wallet Debit for Recovery — Semântica e Autoridade

**Status:** ativa — APROVADA PARA REGISTRO DOCUMENTAL (2026-05-27). Migration C6 materializada (`20260530570000`); implementação de C3 desbloqueada.
**Sessão:** 2026-05-27 (F-ACTOR-WALLET-DEBIT — READ-FIRST + DECISION-0055)
**Decisor:** Clayton
**Commit âncora:** (preencher após commit desta sessão)

### Contexto

READ-FIRST F-ACTOR-WALLET-DEBIT (2026-05-27) confirmou que nenhum serviço de débito de
`actor_wallet` existe — a conta é CRÉDITO-ONLY desde a sua criação (DECISION-0046, D-money
Camada 1). `bankTransactionService.transfer` é o substrato correto para qualquer
movimentação financeira.

Bloqueio de design identificado: `transfer` aciona `requireFinancialRiskClearance` para
o actor debitado (`owner_type='actor'`). Um actor com pendência de compliance poderia
impedir indefinidamente o recovery — anti-padrão "mau pagador protegido por gate de
compliance". Três opções analisadas; Clayton escolheu Opção 3.

### Decisão

Formalizar semântica, autoridade, design canônico e restrições do serviço de débito de
`actor_wallet` para recovery pós-D-money.

### Decisões Clayton (D1–D8)

**D1 — Risk gate: Opção 3 — clearance `financial_recovery`**

Recovery não é transferência voluntária do actor. Recovery é execução administrativa
autorizada por aprovação financeira. O gate de clearance deve ser trilho próprio, com
mais autoridade — não menos controle:

- **NÃO** bypass total do risk gate (vira "admin pode tudo" — anti-padrão §13).
- **NÃO** mesmo gate de transferência voluntária (`financial_transfer`) — pode travar
  recovery de actor com compliance pendente.
- **SIM** clearance específico `financial_recovery`:
  - `approval_request` com `operation_type='actor_wallet_recovery'` e `status='approved'`
  - `actor_wallet` do devedor existente no banco
  - Saldo suficiente verificado em `bank_ledger` no momento da execução
  - Transferência via `bankTransactionService.transfer` (GATE-4 respeitado)
  - Sem saldo negativo
  - Sem uso de `escrow_payments`, `risk_reserve`, `platform_fees`, `regional_fund` como origem

**D2 — Partial recovery semantics**

Se o saldo na `actor_wallet` do devedor for inferior ao valor total da obrigação:
- Debitar o saldo disponível (pode ser zero — registra entry de valor zero se necessário)
- Registrar entry em `actor_wallet_recovery_obligation_entries` com o valor efetivo
- Status da obrigação → `partially_recovered`
- `recovered_amount_cents` da tabela principal atualizado para refletir total acumulado

Se o saldo cobrir o valor total restante:
- Debitar o montante exato
- Status da obrigação → `recovered` (terminal)

Em nenhum caso a obrigação permite saldo negativo na `actor_wallet`.

**D3 — Income withholding (retenção de recebíveis futuros)**

Quando `actor_wallet_recovery_obligations.status IN ('approved', 'partially_recovered')`:
- Todo novo crédito que entrar na `actor_wallet` do devedor deve PRIMEIRO verificar
  obrigações ativas pendentes.
- O valor do crédito drena a obrigação até o valor total antes de disponibilizar saldo.
- Apenas o excedente fica livre para saque pelo actor.
- Sem saldo negativo. Sem adiantamento pela plataforma. Sem usar cofres de terceiros.
- Implementação via gate na entrada de crédito — escopo da DT-RECOVERY-PAYOUT-GATE.

**D4 — Caminho A (MVP): payer aguarda recovery**

A plataforma NÃO adianta o reembolso ao payer usando `risk_reserve` ou cofre próprio.
O payer recebe conforme a recovery progride (Caminho A). Caminho B (plataforma adianta +
cobra do prestador via fundo de garantia) está fora do escopo MVP e exigiria DECISION
específica indicando qual cofre cobre o risco e com qual autoridade.

**D5 — Placement: `src/modules/wallet/`**

`src/modules/wallet/actor-wallet-debit.service.ts` — co-localizado com
`actor-wallet-statement.service.ts`. Toda operação material de `actor_wallet`
(extrato readonly + débito de recovery) concentrada no módulo `wallet`. Não vaza para
`modules/bank` (respeita GATE-4 — serviço chama `bankTransactionService` como interface).

**D6 — Nome do serviço: específico de recovery, não genérico**

`debitActorWalletForRecovery` — o único fluxo autorizado para debitar `actor_wallet` é
recovery pós-D-money via este serviço específico. Criar variante genérica
`debitActorWallet(...)` está proibido até nova DECISION com caso de uso justificado.

**D7 — reference_type canônico**

`actor_wallet_recovery` — alinhado com `ApprovalOperationType` (DECISION-0054).
Idempotência delegada ao `bankTransactionService.transfer` via constraint
`UNIQUE(tenant_id, reference_type, reference_id)` em `bank_transactions`.

**D8 — creditor_account_id: frente C4, não C3**

O serviço recebe `creditorAccountId` como parâmetro — o caller resolve. A lógica de
resolver o creditor a partir da `payment_intent` original (cadeia:
`bank_transactions.reference_id` → `service_orders` → `payment_intents` →
`payment_requests.payer_actor_id` → `bank_accounts`) é frente C4, fora do escopo
desta DECISION.

### Assinatura futura aprovada (não implementar — C6 pendente)

```typescript
// src/modules/wallet/actor-wallet-debit.service.ts
async function debitActorWalletForRecovery(
  tenantId: string,
  input: {
    debtorActorId: string;
    creditorAccountId: string;       // C4 — caller resolve
    amountCents: number;
    obligationEntryId: string;       // FK → actor_wallet_recovery_obligation_entries (C6)
    authorship: FinancialAuthorshipContext;
  },
  client?: PoolClient
): Promise<{ transactionId: string; fromBalanceCents: number }>
```

Internamente (sequência canônica):
1. `bankAccountService.getActorWalletAccount(tenantId, debtorActorId)` — erro `ACTOR_WALLET_NOT_FOUND` se null
2. `bankTransactionService.transfer(tenantId, { fromAccountId: wallet.accountId, toAccountId: creditorAccountId, referenceType: 'actor_wallet_recovery', referenceId: obligationEntryId, ... }, client)` com clearance `financial_recovery`
3. `transfer` entrega: risk gate, `INSUFFICIENT_FUNDS`, double-entry ledger, idempotência, overflow guard
4. Retorna `{ transactionId, fromBalanceCents }`

### Concept a semear (parte da migration C6 — não antecipar)

- **slug:** `actor-wallet-recovery`
- **domain:** `financeiro-reversal`
- Será incluído na migration de DECISION-0053 junto com o seed de concepts financeiros.

### Proibições desta sessão

- Não criar migration de DECISION-0053.
- Não criar `debitActorWalletForRecovery`.
- Não semear concept `actor-wallet-recovery` isolado (aguarda migration C6).
- Não modificar `bankTransactionService.transfer`.
- Não modificar `reversal.service.ts`.
- Não implementar income withholding (DT-RECOVERY-PAYOUT-GATE, frente posterior).
- Não usar `escrow_payments`, `risk_reserve`, `platform_fees`, `regional_fund` como origem.
- Não criar serviço genérico de débito de `actor_wallet`.
- Não criar `actor_wallet_recovery_obligations` / `actor_wallet_recovery_obligation_entries` (C6).

### Vinculadas

- DECISION-0053 (C3 semântica definida por esta DECISION; implementação aguarda C6)
- DECISION-0054 (substrato de aprovação; `operation_type='actor_wallet_recovery'` canônico)
- DECISION-0046 (actor_wallet canônico — invariante preservada no débito)
- DECISION-0044 (bank-ledger boundaries — débito transita via módulo bank)
- DT-ACTOR-WALLET-DEBIT-MISSING (semântica resolvida aqui; implementação pendente migration)
- DT-RECOVERY-PAYOUT-GATE (income withholding formalizado por D3 desta DECISION)
- DT-PE5-REFUND-POST-DMONEY-CHAIN (C3 semântica fechada; C4–C7 ainda bloqueantes)

### Superada por

(preencher quando superada)

---

## DECISION-0056 — Creditor Account for Actor Wallet Recovery

**Status:** ativa — APROVADA PARA REGISTRO DOCUMENTAL (2026-05-27). C4 semanticamente decidido; implementação do resolver desbloqueada.
**Sessão:** 2026-05-27 (READ-FIRST C4 + DECISION-0056)
**Decisor:** Clayton
**Commit âncora:** (preencher após commit desta sessão)

### Contexto

READ-FIRST C4 confirmou que `creditor_actor_id` é resolvível deterministicamente via
`payment_intents.actor_id`, mas qual `bank_accounts.account_type` usar para
`creditor_account_id` permanecia ambíguo. DECISION-0053 mandatou `creditor_account_id NOT NULL`
mas explicitamente delegou o resolver para C4. Investigação revelou:

- `bank_transactions.account_id` (FROM) em D-money = `escrow_payments` — conta de sistema,
  não do payer; inutilizável como ponto de resolução do credor.
- `bank_transactions.counterpart_account_id` = conta do **devedor** (quem recebeu o D-money)
  — também não aponta para o credor.
- Payer tem `bank_accounts` com `owner_type='actor'` e potencialmente múltiplos `account_type`.
- `actor_wallet` tem invariante forte de exclusividade para `revenue_share` (DECISION-0046,
  DECISION-0055) — misturar refund ali sujaria a semântica que levou várias sessões para cravar.
- Resolver com SELECT em `payment_intents` + `bank_accounts` não pode morar em `src/core/`
  — core não recebe query direta; problema de drift de boundary documentado anteriormente.

### Decisão

Formalizar o critério de resolução de `creditor_actor_id` e `creditor_account_id` para
a obrigação de recovery pós-D-money e o placement canônico do resolver.

### Decisões Clayton (D1–D5)

**D1 — creditor_actor_id: `payment_intents.actor_id`**

`payment_intents.actor_id` representa o pagador/buyer original. É o caminho mais direto a
partir de `payment_intent_id`, que já existe como FK em `actor_wallet_recovery_obligations`.
Sem join adicional via `service_orders` necessário.

**D2 — creditor_account_id: `user_wallet` do payer**

```
bank_accounts
  WHERE owner_type = 'actor'
  AND actor_id = payment_intents.actor_id
  AND account_type = 'user_wallet'
```

Recovery para o payer é devolução de valor pago — não é `revenue_share`, não é hold judicial.
`user_wallet` é a conta padrão do usuário/pagador no sistema. Rota direta, semanticamente
correta e isolada da semântica operacional de `actor_wallet`.

**D3 — Proibições de destino: lista fechada**

Recovery NÃO vai para nenhum dos seguintes tipos sem nova DECISION específica:
- `actor_wallet` — exclusivo para revenue_share (DECISION-0046 + DECISION-0055)
- `escrow_payments` — conta de sistema de escrow
- `escrow_disputes` — hold formal para litigância; overkill para recovery operacional
- `clearing` — redistribuição de plataforma; perde rastreabilidade direta payer↔recovery
- `risk_reserve` — cofre de risco da plataforma
- `platform_fees` — receita da plataforma
- `regional_fund` — fundo regional comunitário

**D4 — Ambiguidade = erro explícito, sem heurística silenciosa**

- Zero contas `user_wallet` para o payer → lançar `CREDITOR_ACCOUNT_NOT_FOUND`
- Múltiplas contas `user_wallet` elegíveis → lançar `CREDITOR_ACCOUNT_AMBIGUOUS`
- Proibido: `ORDER BY created_at LIMIT 1`, seleção por `is_primary`, qualquer tiebreaker
  silencioso — "Pix no escuro".

**D5 — Placement: módulo, não core**

- **Resolver:** `src/modules/financial-recovery/recovery-creditor-resolver.service.ts`
- **Tipos:** `src/core/financial-recovery/financial-recovery.types.ts` (já existe — permitido)
- **Natureza:** READ-ONLY. Sem escrita em banco. Sem `bankTransactionService.transfer`.
  Sem interação com `reversal.service.ts`. Sem criação de obligation.
- **Justificativa:** `core/` não recebe query direta de banco. Resolver que faz SELECT em
  `payment_intents` + `bank_accounts` é lógica de módulo. Respeita pureza arquitetural
  e evita drift de boundary — anti-padrão documentado em sessões anteriores.

### Proibições desta sessão

- Não implementar o resolver — esta sessão é exclusivamente documental.
- Não criar migration.
- Não criar `debitActorWalletForRecovery` (C3 — frente posterior ao resolver C4).
- Não usar como destino: `actor_wallet`, `escrow_payments`, `escrow_disputes`, `clearing`,
  `risk_reserve`, `platform_fees`, `regional_fund`.
- Não usar heurística silenciosa (`ORDER BY`, `LIMIT 1`, `is_primary`) para desempate.
- Não colocar resolver com SELECT em `src/core/`.

### Vinculadas

- DECISION-0053 (C4 — este resolver satisfaz o pré-requisito de creditor_account_id)
- DECISION-0055 (D8 — `creditorAccountId` = parâmetro resolvido externamente por C4)
- DECISION-0046 (actor_wallet invariante — recovery NÃO vai para actor_wallet)
- DECISION-0044 (bank-ledger boundaries — resolver é READ-ONLY, não viola GATE-4)
- DT-ACTOR-WALLET-DEBIT-MISSING (C4 é pré-requisito para implementação do debit service)
- DT-PE5-REFUND-POST-DMONEY-CHAIN (C4 fecha um dos bloqueios semânticos da cadeia)

### Superada por

(preencher quando superada)

---

## DECISION-0057 — User Wallet Owner Convention

**Status:** ativa — APROVADA PARA REGISTRO DOCUMENTAL (2026-05-27). Convenção canônica de `user_wallet` decidida; C4b implementação desbloqueada semanticamente.
**Sessão:** 2026-05-27 (READ-FIRST C4b + DECISION-0057)
**Decisor:** Clayton
**Commit âncora:** (preencher após commit desta sessão)

### Contexto

READ-FIRST C4b identificou divergência material antes de implementar provisionamento de
`user_wallet`. `financial-simulator.controller.ts` documenta explicitamente:

```typescript
// Contas user_wallet: owner_id canónico = user_id + ":user_wallet"
```

Mas `payment-event-resolver.ts` linha ~210 passa `event.actor_id` onde
`ensureLifecycleAccountsForOwner` espera `userId`. Se ambos os composites existissem para o
mesmo actor (`actorId:user_wallet` + `userId:user_wallet`), o resolver C4 (`WHERE actor_id = ...
AND account_type = 'user_wallet'`) retornaria duas linhas e lançaria `CREDITOR_ACCOUNT_AMBIGUOUS`.

`user_wallet` está dormente com 0 rows — nenhuma conta foi criada em produção. A divergência não
causou dano material ainda, mas precisava ser resolvida antes de qualquer provisionamento de C4b.

### Decisão

Formalizar a convenção canônica de `user_wallet`, as regras de provisionamento e o tratamento
do bug de convenção em `payment-event-resolver.ts`.

### Decisões Clayton (D1–D5)

**D1 — Convenção canônica: `owner_id = '${userId}:user_wallet'`**

`user_wallet` é a carteira do usuário/payer — não do papel operacional do actor.
A separação canônica é:
- `user_wallet`  → carteira do **usuário pagador** (identificado por `userId` da tabela `users`)
- `actor_wallet` → carteira do **actor operacional** que recebe `revenue_share` (identificado por `actorId`)

Usar `actorId` como prefixo de `user_wallet` quebraria a semântica e criaria risco de contas
duplicadas (dois composites válidos para o mesmo actor). A convenção documentada em
`financial-simulator.controller.ts` linha 4 continua sendo canônica e vinculante.

**D2 — Relação actor/user: resolução de `bank_accounts.actor_id`**

`bank_accounts.actor_id` para `user_wallet` deve ser preenchido com o `actors.id` do actor humano
correspondente, resolvido por:
```sql
SELECT id FROM actors WHERE user_id = $userId AND actor_type IN ('user', 'person', 'actor_human')
```
Este padrão já existe em `bank-account.repository.ts` (createAccount) e continua válido. O helper
futuro `ensureUserWalletForActor(tenantId, actorId)` deve derivar `userId` via `actors.user_id`
e delegar para `ensureLifecycleAccountsForOwner(tenantId, userId, 'user')`.

**D3 — Escopo do backfill**

Backfill deve cobrir todos os actors humanos com `user_id NOT NULL` que aparecem em
`payment_intents`, independente do status do intent. Motivo: recovery de payer é possível para
qualquer intent pago, não apenas `released_to_actor_wallet`.

**D4 — Actor sem `user_id`: fail-closed**

Não criar `user_wallet` para actors sem `user_id` vinculado (empresa, page, organização).
Falhar explicitamente com `USER_WALLET_REQUIRES_USER_ID`. Actors institucionais exigem decisão
futura sobre carteira pagadora institucional. Não inventar composite alternativo agora.

**D5 — Bug em `payment-event-resolver.ts`: adiar, não bloquear**

`payment-event-resolver.ts` linha ~210 passa `event.actor_id` onde a função espera `userId` —
bug de convenção que produziria `owner_id = actorId:user_wallet` em vez de `userId:user_wallet`.
A correção canônica:
```typescript
const actor = await actorRepository.getById(tenantId, event.actor_id);
if (actor?.userId) {
  await bankAccountService.ensureLifecycleAccountsForOwner(tenantId, actor.userId, 'user', 'BRL');
}
```
Correção adiada para frente dedicada (`DT-USER-WALLET-PAYMENT-EVENT-RESOLVER-BUG`). C4b NÃO
depende desta correção, pois o backfill e o lazy creation usarão `userId:user_wallet` diretamente.
O resolver C4 encontra a conta por `actor_id` (FK resolvida corretamente no createAccount).

### Proibições desta sessão

- Não implementar provisionamento.
- Não criar migration.
- Não criar `ensureUserWalletForActor`.
- Não corrigir `payment-event-resolver.ts` agora.
- Não criar `user_wallet` nesta sessão.
- Não mover dinheiro.

### Vinculadas

- DECISION-0056 (user_wallet = destino de recovery; convenção define como provisionar)
- DT-USER-WALLET-PROVISIONING-FOR-RECOVERY (recebe decisão D1–D5; C4b implementação desbloqueada)
- DT-USER-WALLET-PAYMENT-EVENT-RESOLVER-BUG (bug registrado nesta sessão)
- DECISION-0046 (actor_wallet invariante — permanece exclusivo para revenue_share)
- DECISION-0053 (C4b é pré-requisito antes de C3)

### Superada por

(preencher quando superada)

---

## DECISION-0058 — F-ACTOR-WALLET-PAYOUT-WIRING (saque voluntário de actor_wallet)

**Status:** ativa — APROVADA PARA REGISTRO DOCUMENTAL (2026-05-28). Frente de implementação NÃO iniciada — aguarda autorização de produto.
**Sessão:** 2026-05-28 (READ-FIRST + DECISION documental)
**Decisor:** Clayton
**Commit âncora:** (preencher após commit desta sessão)

### Contexto

Após fechamento de F-ACTOR-WALLET-AVAILABLE-BALANCE (commit `f14634c1`), o sistema expõe
`availableBalanceCents` como projeção de leitura. Esse campo revela quanto o actor poderia
sacar, mas NÃO autoriza saque — a autorização é frente própria.

READ-FIRST desta sessão confirmou:
- `payout_requests` existe, mas é trilho exclusivo do seller (`seller_available → seller_payout`).
  Reutilizar para `actor_wallet` seria drift semântico e violaria DECISION-0055.
- `actor_wallet_payout` NÃO está nos `operation_types` de `CORE_APROVACAO_FINANCEIRA_CANONICO.md`.
- `BANK_SEMANTICS.md` linha 61 declara explicitamente: "NÃO é payout externo (saque para banco
  real é frente posterior)".
- Trilho seller (`payout_requests`) e trilho actor (`actor_wallet_payout_requests`) são entidades
  distintas com semânticas e ciclos de vida diferentes.

### Decisões Clayton (D1–D5)

**D1 — Nova entidade: `actor_wallet_payout_requests`**

Criar entidade própria para saque de `actor_wallet`. NÃO reutilizar `payout_requests` (trilho
seller). Separação justificada por:
- `payout_requests` tem `seller_id` + ciclo de vida seller-specific
- `actor_wallet_payout_requests` tem `actor_id` + `bank_account_id` (conta origem) + ciclo de
  vida próprio com gate de aprovação obrigatório (D4)
- Reutilização criaria ambiguidade semântica e risco de cruzamento de trilhos financeiros

Schema mínimo previsto (NÃO criar migration agora — só documental):
```sql
actor_wallet_payout_requests (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  actor_id UUID NOT NULL,                    -- actor que solicita saque
  bank_account_id UUID NOT NULL,             -- conta actor_wallet de origem (SSOT)
  amount_cents BIGINT NOT NULL CHECK > 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending_approval',
  destination_type TEXT NOT NULL,            -- 'internal_settlement' (MVP) | 'pix' | 'ted'
  destination_key TEXT,                      -- chave PIX / dados bancários
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

**D2 — Atomicidade obrigatória: drain + payout em transação única**

Toda execução de saque DEVE:
1. `BEGIN` (transação única)
2. `SELECT FOR UPDATE` em todas as obrigações `approved`/`partially_recovered` do actor
3. `debitActorWalletForRecovery(client, ...)` para cada obrigação ativa (drena antes de sacar)
4. Recalcular `availableBalanceCents` com o MESMO `client` (visão dentro da TX)
5. Executar débito de saque APENAS sobre o saldo excedente após drenagem
6. `COMMIT`
7. Qualquer falha em qualquer etapa → `ROLLBACK` completo

Axioma: `availableBalanceCents` projetado em leitura NÃO é autorização suficiente para executar
movimentação. A drenagem síncrona garante que obrigações ativas sejam quitadas antes do saque.

**D3 — Settlement MVP: interno antes de gateway externo**

Fase 1 (MVP): liquidação interna via `bankTransactionService.transfer` entre `actor_wallet` e
conta de liquidação interna do parceiro. Sem gateway PIX/TED externo.

Fase 2 (posterior, autorização futura): gateway externo (PIX via parceiro bancário, TED).
NÃO implementar fase 2 sem decisão explícita de Clayton.

`destination_type='internal_settlement'` é o único valor permitido no MVP.

**D4 — Gate pending_approval obrigatório (fail-closed)**

Todo saque de `actor_wallet` deve seguir o fluxo:
```
pending_approval → approved → processing → completed
                           ↘ cancelled
               ↘ rejected
                           → failed (após processing)
```

Execução financeira (débito real em `bank_ledger`) APENAS após status `approved`.
Gate de aprovação governa por `approval_requests` (DECISION-0054 substrate).
`operation_type = 'actor_wallet_payout'` (novo — a ser adicionado ao CHECK constraint
de `CORE_APROVACAO_FINANCEIRA_CANONICO.md` na migration de implementação).

Nenhum atalho de auto-aprovação no MVP. Aprovação manual ou workflow a definir.

**D5 — Nomenclatura canônica**

- Entidade DB: `actor_wallet_payout_requests`
- `operation_type` (approval_requests): `'actor_wallet_payout'`
- `reference_type` (bank_transactions): `'actor_wallet_payout'`
- Status enum: `pending_approval | approved | processing | completed | failed | cancelled | rejected`
- Trilho legacy NÃO reutilizado: `payout_requests` permanece exclusivo do seller
- Conceito UI/produto (a decidir): "Saque da carteira" / "Transferir para conta"

### Proibições desta sessão

- Não criar migration.
- Não criar `actor_wallet_payout_requests`.
- Não adicionar `actor_wallet_payout` ao CHECK constraint de aprovações.
- Não implementar serviço de saque.
- Não mover dinheiro.
- Não alterar `BANK_SEMANTICS.md` linha 61 — ela permanece verdadeira até implementação.

### Vinculadas

- DECISION-0053 (actor_wallet recovery obligations — substrato que o drain D2 utiliza)
- DECISION-0054 (approval substrate — gate D4 depende deste trilho)
- DECISION-0055 (actor_wallet debit semantics — drain D2 usa `debitActorWalletForRecovery`)
- DT-RECOVERY-PAYOUT-GATE (DT que rastreia o payout gate aberto)
- F-ACTOR-WALLET-AVAILABLE-BALANCE (commit `f14634c1` — projeta `availableBalanceCents` que informa UI)
- SSOT_EXCLUSIVE_BANK_RULE.md (toda movimentação financeira via bank_ledger)

### Superada por

(preencher quando superada — próxima frente será commit de implementação)

---

## DECISION-0059 — ACTOR_WALLET_PAYOUT_EXTERNAL_SETTLEMENT

**Status:** APROVADA COMO BLOQUEIO E DIREÇÃO FUTURA — IMPLEMENTAÇÃO NÃO AUTORIZADA (2026-05-28).
**Sessão:** 2026-05-28 (READ-FIRST + DECISION documental pós-F3).
**Decisor:** Clayton (com auditorias paralelas A/B/C concluídas).
**Commit âncora:** documental (sem código).

### Contexto

F3 entregou settlement INTERNO: `actor_wallet` → `bank_settlement` (account_type).
Cofre interno aberto e testado. F4 — gateway externo (PIX/TED/PSP) — exigiu três
auditorias paralelas (A/B/C) que retornaram veredito unânime de PARAR:

- **A — autoridade/norma**: produto, compliance, KYC e norma insuficientes para autorizar envio a banco externo.
- **B — schema/código**: substrato externo (destinos bancários, ordens externas, callbacks) inexistente.
- **C — concorrência/idempotência/PSP**: worker, status model externo, idempotência externa e PSP indefinidos.

F4 NÃO pode virar código. F4 NÃO pode virar migration. F4 NÃO pode virar worker. F4 NÃO pode virar adapter.
F4 começa com DECISION. Esta é a cerca; não é a estrada.

### Axioma central

O envio externo é **operação fora do sistema**. Quando dinheiro sai para PSP/banco,
o sistema NÃO o controla mais até retorno (sucesso, falha ou devolução). Isso muda
toda a topologia: ledger não pode ser fonte primária da verdade externa; quem decide
é o callback do PSP.

**Trilho interno (F3 — fechado):**
```
actor_wallet → bank_settlement (account_type)
```

**Trilho externo (F4 — esta DECISION):**
```
bank_settlement → PSP/PIX/TED/banco externo
```

### Decisões (D1–D13)

**D1 — F4 não é continuação automática da F3.**
F3 termina em `bank_settlement`. F4 é operação externa separada. Mesmo
`actor_wallet_payout_requests.id` pode (futuramente) ter F3 (interno) feito
e F4 (externo) pendente OU não. F4 não substitui F3.

**D2 — DECISION-0058 não autoriza F4.**
DECISION-0058 D3 restringe `destination_type='internal_settlement'`. Qualquer
adição (`pix`, `ted`, `wire`) exige nova autorização explícita de Clayton +
ratificação de produto + compliance. DECISION-0059 NÃO autoriza F4 — apenas
ratifica que F4 é frente própria com cerca clara.

**D3 — Saque externo MVP apenas para conta própria.**
A primeira fatia de F4, quando autorizada, só permitirá envio para conta
bancária do próprio actor (CPF/CNPJ do actor = titular da conta de destino).
Envio para terceiro fica proibido até DECISION específica de compliance.

**D4 — KYC/KYB verified é pré-requisito fail-closed.**
Sem `actor.kyc_status='verified'` (PF) ou KYB equivalente (PJ), F4 é fail-closed.
Não há "modo simulado" para esse gate.

**D5 — Conta bancária externa do actor é pré-requisito material.**
Antes de qualquer F4.x avançar, F4.0 (registro de destino bancário do actor)
precisa existir. Entidade conceitual:

```
actor_bank_destinations (
  id UUID PK,
  tenant_id UUID,
  actor_id UUID,
  destination_type TEXT,        -- 'pix_key' | 'bank_account'
  pix_key_type TEXT,            -- 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'
  pix_key TEXT,
  bank_code TEXT,
  agency TEXT,
  account_number TEXT,
  account_type TEXT,            -- 'checking' | 'savings'
  holder_document TEXT,         -- CPF/CNPJ do titular (deve ser igual ao actor)
  holder_name TEXT,
  ownership_verified_at TIMESTAMPTZ,
  status TEXT,                  -- 'pending_verification' | 'verified' | 'rejected' | 'archived'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

CHECK: `holder_document` deve ser igual a `actor.cpf_cnpj` (D3 — conta própria).

**D6 — External settlement order é entidade própria.**
NÃO reaproveitar `bank_settlements` (escopo seller legado, dormente).
NÃO reaproveitar `payout_requests` (escopo seller_available legado).
NÃO reaproveitar `actor_wallet_payout_requests` (escopo interno F3 fechado).

Entidade conceitual:

```
actor_wallet_external_payouts (
  id UUID PK,
  tenant_id UUID,
  payout_request_id UUID FK actor_wallet_payout_requests,
  actor_id UUID,
  actor_bank_destination_id UUID FK actor_bank_destinations,
  provider TEXT,                              -- 'stark' | 'pagarme' | ... (definido em F4.2)
  external_idempotency_key TEXT,
  provider_reference_id TEXT,                 -- ID retornado pelo PSP
  status TEXT,                                -- ver D7
  failed_reason TEXT,
  sent_at TIMESTAMPTZ,                        -- quando PSP aceitou a ordem
  confirmed_at TIMESTAMPTZ,                   -- callback de confirmação final
  returned_at TIMESTAMPTZ,                    -- callback de devolução
  request_payload JSONB,                      -- payload enviado ao PSP
  response_payload JSONB,                     -- última resposta do PSP
  amount_sent_cents BIGINT,
  amount_confirmed_cents BIGINT,
  bank_settlement_transaction_id UUID,        -- bank_transactions debit (settlement → external_out)
  return_transaction_id UUID,                 -- bank_transactions credit (external_in → actor_wallet) em devolução
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**D7 — Status externos obrigatórios:**

```
pending          → ordem criada localmente; ainda não enviada ao PSP
processing       → enviada ao PSP; aguardando aceite
sent             → PSP aceitou; dinheiro saiu para a rede bancária
confirmed        → callback final positivo: dinheiro chegou ao destino
failed_transit   → falha temporária (timeout, network); permite retry
failed_final     → falha terminal sem devolução (PSP retornou erro definitivo)
returned         → dinheiro voltou; precisa re-crédito interno (ver D11)
cancelled        → cancelado antes de enviar; nenhum movimento real
```

**D8 — Timestamps externos exigem confirmação externa.**
`sent_at`, `confirmed_at`, `returned_at` SOMENTE são preenchidos após callback
ou consulta confirmada do PSP. Nunca usar `NOW()` sem evidência externa.
Falsificar esses timestamps é violação de causalidade.

**D9 — F4 é assíncrona. Worker obrigatório.**
Chamada de rede ao PSP NÃO pode acontecer dentro de transação financeira longa.
Padrão:
1. TX-1 (síncrona, curta): cria `actor_wallet_external_payouts` em `pending`, COMMIT.
2. Worker (async): pega `pending`, envia ao PSP, atualiza para `processing`/`sent`.
3. Callback (async): recebe webhook do PSP, atualiza para `confirmed`/`failed_final`/`returned`.

Detalhes do trilho contábil (debito de `bank_settlement` para liberar a ordem
externa) ficam para F4.1 substrate.

**D10 — Idempotência externa obrigatória.**
`external_idempotency_key` deve ser determinística por `payout_request_id`
(ex.: `external:${payout_request_id}`). PSP deve recusar duplicatas.
`provider_reference_id` armazenado quando PSP retornar (primeira resposta wins).
Webhook deduplication por `provider_reference_id` + status transition válido.

**D11 — Returned/reversed é fluxo de primeira classe.**
Se dinheiro voltar (PIX devolvido, TED retornado), o sistema DEVE:
1. Receber callback de devolução.
2. Marcar `returned_at` + `status='returned'`.
3. Criar `bank_transactions` de re-crédito: `external_in` → `actor_wallet`
   (referenceType próprio, ex.: `actor_wallet_payout_return`).
4. Atualizar `return_transaction_id`.
5. Atualizar `actor_wallet_payout_requests.status` (decisão futura: voltar para
   `approved` para nova tentativa? marcar `failed` terminal? — definir em F4.3).

**D12 — PSP/parceiro NÃO escolhido. Adapter real proibido até DECISION nova.**
Sem PSP definido, qualquer `pspAdapter.send()` é especulativo. Mock só pode
ser desenhado em DECISION futura de sandbox que diga explicitamente "isto
NÃO é produção". Mocks que fingem produção (preenchem `confirmed_at` sem
evidência real) são VETADOS.

**D13 — F4 dividida em sub-frentes sequenciais:**

```
F4.0 — actor_bank_destinations          (registro de destino bancário)
F4.1 — external settlement order substrate (schema actor_wallet_external_payouts)
F4.2 — PSP adapter                       (depende de escolha do parceiro)
F4.3 — callback/reconciliation           (webhook + state machine + returned handling)
F4.4 — compliance/KYC gates              (KYC verified obrigatório + AML + limits)
```

NENHUMA das sub-frentes está autorizada. Cada uma exigirá READ-FIRST próprio
e possivelmente DECISION adicional dependendo do PSP escolhido.

### Relação com F3 (intocada)

F3 NÃO mexe em bank_ledger ao "enviar externo" porque F3 NÃO envia externo.
F3 termina em `bank_settlement` (account_type interno). O envio externo é
side-effect FORA do sistema. Ledger interno só volta a mexer se houver
retorno/devolução/recrédito (D11).

### Vinculadas

- DECISION-0058 (autoriza apenas internal_settlement; F4 exige autorização separada)
- DECISION-0053 (recovery obligations — drain continua aplicável em F4)
- DECISION-0054 (approval substrate — F4 pode reutilizar approval_request com operation_type novo)
- DECISION-0055 (debit semantics — drain D2 ainda aplica)
- DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT (DT principal — esta DECISION é a cerca documental)
- DT-ACTOR-WALLET-PAYOUT-WIRING (CLOSED escopo interno)
- SSOT_EXCLUSIVE_BANK_RULE.md (movimentação interna via bank_ledger; envio externo NÃO movimenta ledger até retorno)
- BANK_SEMANTICS.md linha 61 ("NÃO é payout externo (saque para banco real é frente posterior)") — DECISION-0059 ratifica "posterior" como F4

### Superada por

(preencher quando F4 for autorizada e DECISIONs sub-frentes forem registradas)

---

## DECISION-0060 — ACTOR_BANK_DESTINATIONS_GOVERNANCE

**Status:** APROVADA COMO CORREÇÃO FACTUAL + GOVERNANÇA DE F4.0 — IMPLEMENTAÇÃO NÃO AUTORIZADA (2026-05-28).
**Sessão:** 2026-05-28 (auditoria pré-F4.0 + correção documental).
**Decisor:** Clayton (com auditoria de schema vivo confirmando bug factual em DECISION-0059 D5).
**Commit âncora:** documental (sem código, sem migration, sem schema).

### Contexto

DECISION-0059 (2026-05-28) registrou cerca documental para F4 com veredito A/B/C de PARAR.
Auditoria pré-F4.0 (mesma data, antes desta DECISION) confirmou no schema vivo:

1. `actors.kyc_status` **NÃO EXISTE** (DROP COLUMN em `0010_migrate_identity_from_actors.sql:42`).
2. `actors.cpf_cnpj` **NÃO EXISTE** (DROP COLUMN em `0010_migrate_identity_from_actors.sql:41`).
3. SSOT canônico para documento fiscal é `identities.tax_id` (NOT NULL).
4. SSOT canônico para tipo de documento é `identities.tax_id_type` (CHECK IN `'cpf'|'cnpj'`).
5. SSOT canônico para KYC é `identities.kyc_status` (CHECK IN `'pending'|'approved'|'rejected'`).
6. Gate canônico em runtime é `evaluateKycLayer` em `authority-decision.service.ts:125-205`,
   que faz JOIN `actors → users → identities` e lê `identities.kyc_status`.
7. CHECK constraint em PostgreSQL **NÃO suporta sub-SELECT/JOIN**, logo "comparar
   `holder_document` com `identities.tax_id` via CHECK puro" é tecnicamente impossível.

DECISION-0059 D5 contém **referência factual obsoleta**:

> "CHECK: `holder_document` deve ser igual a `actor.cpf_cnpj` (D3 — conta própria)."

Esta DECISION-0060 NÃO REESCREVE D5 e NÃO APAGA D5. Ela registra append-only a
correção factual e fixa a base canônica para F4.0/F4 futuro. Quando F4.0 for
autorizada, qualquer migration/service derivada DEVE usar esta DECISION-0060 como
fonte canônica, não a referência obsoleta de DECISION-0059 D5.

### Axioma central

Identidade fiscal e KYC do actor vivem em `identities`, NÃO em `actors`.
`actors` carrega apenas o vínculo (`global_user_id` FK + `chk_actor_requires_identity`).
F4.0/F4 que precisar dessas informações DEVE consultar `identities` via JOIN.

### Decisões (D1–D11 + D12 esclarecimento append-only)

**D1 — Correção factual da DECISION-0059 D5.**
DECISION-0059 D5 referencia `actor.cpf_cnpj`. Essa coluna NÃO EXISTE no schema
vivo (DROP COLUMN em migration 0010). A referência é factualmente obsoleta.
DECISION-0060 fixa que, para qualquer implementação futura de F4, a comparação
de "conta própria" usa `identities.tax_id` via JOIN com `actors.global_user_id →
users.global_user_id → identities`.

**D2 — SSOT canônico de documento fiscal: `identities.tax_id`.**
NOT NULL por construção (migration `0009_create_identities.sql:7`).
`actors.cpf_cnpj` NÃO existe e NÃO pode ser reintroduzido.
Qualquer service/migration que precise do documento fiscal do actor consulta
`identities.tax_id` via JOIN.

**D3 — SSOT canônico de tipo de documento: `identities.tax_id_type`.**
CHECK IN `'cpf'|'cnpj'`. Determina o algoritmo de validação aplicado.

**D4 — SSOT canônico de KYC: `identities.kyc_status`.**
CHECK IN `'pending'|'approved'|'rejected'`.
KYC aprovado significa `identities.kyc_status='approved'` (NÃO `'verified'`).
Migration 0010 fez backfill `verified → approved` (linhas 25-30).

**D5 — Gate canônico de KYC para F4.0/F4: `evaluateKycLayer` em modo strict.**
`authority-decision.service.ts:125-205` JÁ implementa o gate canônico (JOIN
`actors → users → identities`). Para F4.0/F4, o modo `strict` é OBRIGATÓRIO:
- `kyc_status IS NULL` → BLOCK
- `kyc_status = 'pending'` → BLOCK
- `kyc_status = 'rejected'` → BLOCK
- `kyc_status = 'approved'` → PASS

Modo `permissive` é INACEITÁVEL para fluxos com efeito financeiro externo.

**D6 — `actor_bank_destinations` será CATÁLOGO reutilizável, NÃO destino inline.**
Cadastro do destino bancário do actor é entidade própria, com lifecycle próprio,
desacoplada de cada pedido de saque. Razões:

- Verificação de titularidade (manual ou PSP) é cara — fazer uma vez é melhor que toda saque.
- Trilha auditável independente do histórico de saques.
- UX padrão de mercado: cadastrar PIX/conta uma vez no perfil.
- Reuso entre múltiplos pedidos F4 sem re-cadastro.

`actor_bank_destinations` é a tabela referenciada em DT-ACTOR-BANK-DESTINATION-MISSING.

**D7 — `actor_wallet_payout_requests.destination_key` permanece NÃO USADO para external payout.**
A coluna `destination_key` (TEXT NULL) JÁ existe no substrato F1 (migration
`20260530572000`) e hoje é sempre NULL porque `destination_type` CHECK só
admite `'internal_settlement'`. Não popular esse campo para external payout
até DECISION explícita futura de F4.1 que defina como o request liga ao
catálogo de destinos (provavelmente via FK `actor_bank_destination_id`).
Não há decisão final aqui — F4.1 cuida disso.

**D8 — "Conta própria" é obrigatória e exige enforcement em DUAS camadas.**

Regra: o documento do titular do destino bancário DEVE corresponder ao
`identities.tax_id` do actor.

Mecanismo de enforcement:

1. **Service layer fail-closed**: o service de cadastro/atualização de
   `actor_bank_destinations` consulta `identities.tax_id` via JOIN e
   rejeita qualquer INSERT/UPDATE onde `holder_document ≠ identities.tax_id`.
   Esta é a primeira linha de defesa.

2. **Defesa em profundidade no DB**: TRIGGER `BEFORE INSERT/UPDATE` em
   `actor_bank_destinations` que executa a mesma comparação via JOIN.
   Esta é a segunda linha de defesa, independente da camada de service.

CHECK constraint puro NÃO é mecanismo válido porque CHECK não suporta
sub-SELECT/JOIN em PostgreSQL. Qualquer DECISION/migration futura que
propuser `CHECK (holder_document = ...)` é fatura técnica e DEVE ser
rejeitada na revisão.

**D9 — Lifecycle obrigatório de `actor_bank_destinations`.**

```
pending_verification  → verified | rejected | archived
verified              → archived
rejected              → archived
archived              → terminal
```

Estados ativos para uso em saque externo (quando F4 for autorizada):
apenas `verified`. `pending_verification`, `rejected` e `archived` são
fail-closed para envio externo.

**D10 — Métodos de verificação de titularidade reconhecidos.**

`actor_bank_destinations.ownership_verification_method` deve registrar:

- `auto_tax_id_match` — verificação automática quando a chave PIX contém
  o tax_id exato do actor (ex.: PIX key tipo CPF/CNPJ idêntica a `identities.tax_id`).
  Esta é a única automação permitida no MVP.
- `manual_review` — workflow admin análogo a `identity-validation.service.ts`.
  Admin com permissão dedicada (ex.: `manage_bank_destinations_review`) aprova
  após análise de comprovante. Aplica-se a chaves PIX por email/phone/random
  e a contas TED.
- `psp_future` — reserva semântica. NÃO implementar até DECISION nova de PSP.

Falsificar `ownership_verified_at` sem evidência (`NOW()` em mock) é VETADO,
seguindo o axioma de DECISION-0059 D8.

**D11 — Escopo permitido vs. proibido para F4.0 (quando autorizada).**

F4.0, **quando autorizada por prompt executor específico**, poderá criar APENAS:

- Migration de `actor_bank_destinations` (catálogo + lifecycle + TRIGGER de "conta própria").
- Service de CRUD com fail-closed em "conta própria" (D8 camada 1).
- Workflow `pending_verification → verified | rejected | archived`.
- E2E cobrindo: criação, auto-verify por tax_id match, rejeição por mismatch,
  lifecycle, fail-closed em modificação após `verified`.

F4.0 NÃO autoriza, mesmo com prompt executor:

- PSP, PIX adapter, TED adapter, callback handler.
- Worker assíncrono.
- Envio externo de qualquer natureza.
- Movimentação em `bank_ledger`.
- Movimentação em `bank_transactions`.
- Movimentação em `bank_splits`.
- Alteração em `actor_wallet_payout_requests.destination_type` CHECK.
- Alteração em `actor_wallet_payout_requests.destination_key` população.
- Conexão real com F3 (que continua só com `'internal_settlement'`).

F4.1, F4.2, F4.3 e F4.4 continuam NOT AUTHORIZED. Cada uma exigirá
DECISION própria + prompt executor próprio.

**D12 — Esclarecimento de aplicação do gate KYC: cadastro F4.0 vs uso real F4.1+.**
Append-only (2026-05-28) para evitar interpretação errônea de D5.

D5 fixou o gate canônico KYC como `evaluateKycLayer` em modo `strict` e
declarou-o OBRIGATÓRIO para "fluxos com efeito financeiro externo". O CADASTRO
de destino bancário em F4.0 NÃO movimenta dinheiro e NÃO produz efeito
financeiro externo — é apenas registro + verificação de titularidade.

Esclarecimento canônico:

- **F4.0 (cadastro `actor_bank_destinations`)**: pode admitir actor com
  `identities.kyc_status='pending'` se Clayton assim ratificar no prompt
  executor F4.0 específico. Cadastro permite onboarding sem bloquear
  jornada de KYC. Decisão final do nível mínimo (`pending` aceito vs.
  exige `approved` para cadastrar) fica para o prompt executor F4.0
  quando autorizado.

- **F4.1+ (uso real para payout externo)**: exige `identities.kyc_status='approved'`
  via `evaluateKycLayer` em modo `strict` SEM EXCEÇÃO. O gate strict de D5
  aplica-se aqui sem ambiguidade.

D12 NÃO autoriza F4.0 nem flexibiliza segurança em F4.1+. Apenas alinha
a leitura canônica de D5 com a natureza de cada sub-frente:

- Cadastro = decisão de produto no momento do prompt executor F4.0
  (Clayton ratifica `pending` aceito ou não).
- Uso real = strict `approved` SEMPRE.

D8 ("conta própria" em duas camadas) e D9 (lifecycle pending_verification →
verified | rejected | archived) continuam aplicáveis ao cadastro
independentemente do nível KYC permitido no momento.

### Relação com DECISION-0059

DECISION-0060 é **append-only complementar** a DECISION-0059. NÃO reescreve
D5 da DECISION-0059, NÃO apaga texto, NÃO substitui DECISION-0059.

A leitura canônica para F4.0/F4 fica:

- DECISION-0059 = cerca arquitetural geral de F4 + sub-frentes F4.0–F4.4.
- **DECISION-0060 = base factual canônica para identidade fiscal + KYC + governança de `actor_bank_destinations`.**

Qualquer conflito futuro entre DECISION-0059 D5 (referência obsoleta a
`actor.cpf_cnpj`) e DECISION-0060 D1/D2/D8 (referência correta a
`identities.tax_id`) é resolvido a favor de DECISION-0060.

### Vinculadas

- DECISION-0059 (cerca arquitetural de F4 — D5 contém referência factual obsoleta corrigida aqui)
- DECISION-0058 (autoriza apenas `destination_type='internal_settlement'`; F4 exige DECISION nova)
- DECISION-0054 (approval substrate — F4 pode reutilizar com `operation_type` novo)
- DECISION-0055 (debit semantics — drain D2 ainda aplica em F4)
- DT-ACTOR-BANK-DESTINATION-MISSING (DT principal de F4.0; permanece OPEN HIGH / NOT AUTHORIZED)
- DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT (DT mãe F4; permanece OPEN HIGH / NOT AUTHORIZED)
- DT-EXTERNAL-PAYOUT-ORDER-SUBSTRATE-MISSING (F4.1; permanece OPEN HIGH / NOT AUTHORIZED)
- DT-PSP-DISBURSEMENT-ADAPTER-MISSING (F4.2; permanece OPEN HIGH / NOT AUTHORIZED)
- DT-EXTERNAL-PAYOUT-CALLBACK-RECONCILIATION-MISSING (F4.3; permanece OPEN HIGH / NOT AUTHORIZED)
- DT-PAYOUT-EXTERNAL-KYC-GATE-MISSING (F4.4; permanece OPEN HIGH / NOT AUTHORIZED — gate canônico fica em D5 desta DECISION)
- `backend/migrations/0009_create_identities.sql` (cria `tax_id`, `tax_id_type`, `kyc_status`, `kyc_level`)
- `backend/migrations/0010_migrate_identity_from_actors.sql` (DROP `actors.kyc_status` e `actors.cpf_cnpj`; FK + CHECK forçando identity)
- `backend/src/core/compliance/authority-decision.service.ts:125-205` (gate canônico via JOIN)
- `backend/src/core/kyc/kyc.validators.ts` (helpers reutilizáveis: `validateTaxId`, `normalizeTaxId`)
- `backend/migrations/20260530572000_actor_wallet_payout_requests_substrate.sql` (substrato F1 com `destination_key` reservado)

### Superada por

(preencher quando F4.0 for autorizada por prompt executor específico e DECISIONs sub-frentes forem registradas)

---

## DECISION-0061 — ACTOR_PUBLIC_PROFILE_CANONICALITY

**Status:** APROVADA COMO ESCOLHA DE CANONICIDADE — IMPLEMENTAÇÃO NÃO AUTORIZADA (2026-05-28).
**Sessão:** 2026-05-28 (raio-X documental pré-fatia perfil público).
**Decisor:** Clayton.
**Commit âncora:** documental (sem código).
**Hipótese escolhida:** **Hipótese C — convivência declarada**.

### Contexto

Raio-X da `DT-PUBLIC-PROFILES-NO-FRONTEND-CONSUMER` confirmou materialmente:

- Tabela `public_profiles` existe (migration `20260530440000_public_profiles.sql`).
- Module backend completo: `backend/src/modules/public-profiles/` (types + repository + service + routes).
- 5 rotas REST registradas em `protectedScope` (`app.builder.ts:666-667`).
- Frontend tem **zero** referências a `public_profiles` / `publicProfiles` / `public-profile`.
- Runtime `unificard_dev`: **0 rows** em `public_profiles`.
- 80 actors com `slug` populado em `actors` em runtime.
- Endpoint canônico consumido pelo frontend é `GET /social/actors/:id` (lê de `actors`), não de `public_profiles`.
- Único caller adjacente de `publicProfileService` (`venue.routes.ts`) está dormente porque a tabela está vazia.

Duplicação material confirmada entre `actors` e `public_profiles` para os campos:
`display_name`, `slug`, `avatar_url`, `cover_url`, `bio`, `metadata`.

Em `actors`: populado em runtime. Em `public_profiles`: zero rows. SSOT de fato hoje é `actors`.

Implementar consumer frontend de `public_profiles` agora criaria duas verdades públicas do mesmo actor instantaneamente.

### Axioma central

A identidade pública básica do actor (nome de exibição, slug, avatar, capa, bio, metadata básica) vive em `actors`. Esta DECISION-0061 ratifica a realidade de runtime e bloqueia o caminho de divergência.

`public_profiles` é camada pública/social complementar — não substituto, não duplicação, não competidor de identidade pública básica.

### Decisões (D1–D10)

**D1 — `actors` é o SSOT da identidade pública básica do actor.**

Campos canônicos em `actors`:
- `display_name`
- `slug`
- `avatar_url`
- `cover_url`
- `bio`
- `metadata` (básica do actor)

Razões:
- Já populados em runtime (80 actors com slug).
- `/social/actors/:id` já serve esses campos.
- Frontend (`ProfilePage`, `CompanyPage`) já consome esse endpoint.
- Migrar para `public_profiles` agora teria alto blast radius.
- Deletar `public_profiles` agora perderia a intenção de camada pública/social futura.

**D2 — `public_profiles` NÃO é SSOT de identidade pública básica.**

`public_profiles` está proibida de competir com `actors` por:
- nome público (`display_name`)
- slug
- avatar (`avatar_url`)
- capa (`cover_url`)
- bio
- metadata básica

Qualquer migration/service futuro que reintroduza ou rebata essa duplicação é VETADO até DECISION nova.

**D3 — `public_profiles` é camada pública/social complementar do actor.**

Campos conceitualmente pertencentes a `public_profiles`:
- `visibility` (público | privado | followers_only)
- `is_public`
- `is_verified` (verificação pública/social — NÃO KYC)
- `profile_type` (apenas se reconciliado com `actors.actor_type` — ver D8)
- `follower_count` / `following_count` (apenas se definidos como projeção/cache com fonte de atualização explícita — ver D7)
- metadata pública-social específica (NÃO identity fiscal)

**D4 — Estado atual classificado: substrato órfão/parcial.**

- Tabela existe.
- Backend tem módulo vivo.
- Runtime tem 0 rows.
- Frontend não consome.
- Há duplicação material com `actors`.

`public_profiles` permanece sem caller frontend ativo até saneamento (ver D9).

**D5 — Frontend NÃO deve consumir `public_profiles` enquanto a duplicação não for removida.**

Bloqueio operacional: qualquer fatia que introduza `getPublicProfile`/equivalente no frontend antes de migration de saneamento (C1) ou neutralização declarada (C2) é VETADA por esta DECISION.

`GET /social/actors/:id` continua sendo a rota canônica para perfil público no MVP.

**D6 — Proibições explícitas de vazamento de dado privado.**

`public_profiles`, hoje e em qualquer evolução futura:

- NUNCA expor `identities.tax_id` (CPF/CNPJ) em payload público.
- NUNCA expor `identities.kyc_status` como dado público bruto.
- NUNCA expor `user_profiles.cpf` (legado).
- Perfil privado editável (`PerfilPage` / `api/profile` / `api/identity`) NÃO vira payload público.
- `public_profiles.metadata` NÃO retorna bruto ao frontend público sem allowlist explícita.

A allowlist é responsabilidade do service que servir o read model.

**D7 — `follower_count` / `following_count` exigem decisão própria antes de virarem verdade.**

Enquanto não houver job/trigger/projeção canônica definida:
- Contagem agregada em runtime via `social-2.0.service.getActorCounts` permanece fonte de exibição.
- Colunas materializadas em `public_profiles.follower_count` / `public_profiles.following_count` **NÃO devem ser usadas como verdade**.
- Reimplementação como projeção exige DECISION futura definindo: fonte do incremento, política de atualização (trigger vs job), tolerância a divergência.

**D8 — `profile_type` precisa ser reconciliado com `actors.actor_type`.**

Mismatch atual:
- `public_profiles.profile_type`: `'user' | 'page' | 'group' | 'cultural_profile'`
- `actors.actor_type` (após 0064): 10 valores incluindo `'user'`, `'page'`, `'group'`, `'channel'`, `'actor_human'`, `'actor_organizational'`, `'actor_system'`, `'person'`, `'company'`, `'system'` (mas NÃO `'cultural_profile'`).

Enquanto não houver reconciliação:
- `actors.actor_type` vence como identidade do actor.
- `public_profiles.profile_type` **NÃO decide identidade do actor**.
- Pode existir como atributo de visibilidade/categorização social, sem autoridade tipológica.

**D9 — Próxima implementação futura, quando autorizada, deve seguir uma de duas trilhas.**

**C1 — Saneamento de schema (caminho cirúrgico):**
- Migration de DROP COLUMN em `public_profiles` para campos duplicados com `actors`
  (`display_name`, `slug`, `bio`, `avatar_url`, `cover_url`, `metadata`).
- Manter apenas campos sociais/complementares (D3).
- Ajustar `public-profile.service.ts` + `public-profile.repository.ts` para não retornar/aceitar campos duplicados.
- Decidir seed/backfill mínimo de `public_profiles` por actor existente, se necessário.
- Frontend só consome após isso.

**C2 — Neutralização temporária (caminho conservador):**
- Manter `public_profiles` sem consumer frontend.
- Documentar como substrato reservado para futura saneação.
- Reclassificar `DT-PUBLIC-PROFILES-NO-FRONTEND-CONSUMER` como blocked-by-decision.
- Usar `actors` como caminho MVP para perfil público (estado atual ratificado).
- Eventual remoção de `venue.routes.ts` consumers do `publicProfileService` se eles também não tiverem fluxo ativo.

Nenhuma das duas está autorizada por esta DECISION. Esta DECISION apenas fixa qual hipótese vence quando o prompt executor for criado.

**D10 — Relação com DTs.**

- **DT-PUBLIC-PROFILES-NO-FRONTEND-CONSUMER** permanece **OPEN**, agora bloqueada por implementação futura (C1 ou C2) conforme esta DECISION.
- **DT-USER-PROFILES-LEGACY-ORPHAN** permanece **OPEN** — escopo ortogonal (`user_profiles.cpf` superseded por `identities.tax_id`, decisão de DROP fica para fatia própria).
- **DT-PE5-PF-RESOLVER-PENDING** (`REMEDIATION_DT_LOG.md:6234`) referencia parcialmente esta DECISION-0061 — para a questão "qual tabela é canônica para `profile_id` entre `public_profiles` e `user_profiles`", a resposta canônica é: **nenhuma das duas** para identidade pública básica (essa vive em `actors`). A DT continua OPEN para o ângulo de PF presencial/remoto que esta DECISION não cobre.
- Nenhuma DT fechada nesta execução.

### Vinculadas

- DECISION-0043 (actor como projeção contextual — não cobria SSOT pública de perfil; esta DECISION-0061 a complementa)
- DT-PUBLIC-PROFILES-NO-FRONTEND-CONSUMER (DT alvo do raio-X)
- DT-USER-PROFILES-LEGACY-ORPHAN (legado ortogonal)
- DT-PE5-PF-RESOLVER-PENDING (resolução parcial — domínio social)
- `backend/migrations/0002_identity.sql` (`actors` base)
- `backend/migrations/0064_add_user_id_to_actors.sql` (slug/bio/avatar/cover em `actors`)
- `backend/migrations/20260530440000_public_profiles.sql` (substrato visado)
- `backend/migrations/0066_profile_support_tables.sql` (`user_profiles` legado)
- `backend/src/modules/social/social-2.0.routes.ts` linhas 498-540 (`/social/actors/:id` — endpoint canônico vigente)
- `backend/src/modules/social/actor.repository.ts` (SELECT `actors`)
- `frontend/src/api/social-2.0.ts:255-258` (`getActorProfile`)
- `frontend/src/components/social/ProfilePage.tsx` (consumer atual)

### Superada por

(preencher quando saneamento C1 ou neutralização C2 for autorizada e DECISION de implementação for registrada)

---

## DECISION-0062 — CPF_CNPJ_SSOT_CANONICALITY_GLOBAL

**Status:** APROVADA COMO DECISÃO DE CANONICIDADE — IMPLEMENTAÇÃO NÃO AUTORIZADA (2026-05-28).
**Sessão:** 2026-05-28 (auditoria pós-DT-CPF-SSOT-DUAL-WRITE + raio-X CPF/CNPJ).
**Decisor:** Clayton.
**Commit âncora:** documental (sem código).
**Hipótese escolhida:** **Hipótese A como destino canônico, com execução gradual** (ver D10).

### Contexto

Após auditoria pré-onboarding e raio-X de `user_profiles`/`AvailableActor.user_id`/`global_users`/`bank-balance-by-cpf`, foram confirmados materialmente:

- **Múltiplos substratos de CPF** vivos em runtime:
  - `global_users.cpf` — 21 rows, todas com CPF, UNIQUE.
  - `user_profiles.cpf` — 7 rows, todas com CPF.
  - `profiles.cpf` — 61 rows com CPF.
  - `identities.tax_id` — 9 rows.
- **Divergência runtime confirmada**: `user_profiles` carrega CPFs que nem sempre têm identity correspondente (gap de cobertura assimétrico).
- **Ghost reference factual em código financeiro**: `backend/src/modules/bank/bank-balance-by-cpf.service.ts:121-124` faz `FROM users u ... AND u.cpf = $2`, mas a coluna `users.cpf` **NÃO existe no schema vivo** (verificado em `information_schema.columns`). Caller silenciosamente quebrado.
- `actors.cpf_cnpj` e `actors.kyc_status` removidos em migration 0010 e não devem voltar.
- DECISION-0060 D2 já fixou `identities.tax_id` como SSOT para KYC/payout/F4.
- A normativa-mãe **`docs/01_normative/IDENTITY_SSOT_PRECEDENCE.md`** já declara `identities` como autoridade de KYC/documento fiscal e tipifica como fail-condition "leitura de identidade fiscal/KYC a partir de `actors` ou caches quando `identities` está disponível para o mesmo `global_user_id` sem reconciliação explícita".
- O domínio CORE/profile ficou **órfão dessa cobertura normativa**, levando ao dual-write `user_profiles.cpf`+`profiles.cpf` vs `identities.tax_id`.

DECISION-0062 estende a diretriz de `IDENTITY_SSOT_PRECEDENCE.md` para o domínio CORE/onboarding, fechando o gap.

### Axioma central

CPF/CNPJ é **âncora raiz da identidade civil/fiscal** no UnifiCard. A partir desse documento fiscal o sistema conecta identity, user, actors, empresas, permissões, KYC e fluxos financeiros futuros. Não é "campo de perfil" — é raiz operacional.

A Hipótese A (`identities.tax_id` vence como SSOT operacional global) é o destino canônico. A execução é gradual para não quebrar o CORE em runtime.

### Decisões (D1–D16)

**D1 — Axioma central.**

CPF/CNPJ é âncora raiz da identidade civil/fiscal no UnifiCard. A partir desse
documento fiscal o sistema conecta identity, user, actors, empresas, permissões,
KYC e fluxos financeiros futuros.

**D2 — SSOT operacional global.**

`identities.tax_id` é o SSOT operacional global de documento fiscal para o sistema.

Implicações:
- Toda leitura nova de documento fiscal em fluxo de produto/financeiro deve resolver via `identities.tax_id`.
- KYC/payout/F4.0 já operam sobre `identities.tax_id` (DECISION-0060 D2 vigente).
- CORE/profile **migra** para esse SSOT em fases F0–F5 (ver D10).

**D3 — Tipo fiscal.**

`identities.tax_id_type` é o SSOT do tipo fiscal:
- `'cpf'`
- `'cnpj'`

Inferência por `length(normalize(tax_id))` (11 = cpf, 14 = cnpj) é **fallback de emergência**, não substituto canônico. Migration 0010 fez backfill explícito desse campo.

**D4 — Papel de `global_users.cpf`.**

`global_users.cpf` permanece como âncora de **cadastro, deduplicação cross-tenant e auth bootstrap** para pessoa física.

Características operacionais:
- UNIQUE(cpf) em schema (`0058`) — deduplicação garantida.
- Comentário canônico da tabela: "Identidade global por CPF; usada por auth.register e identity.service".
- Não é fonte operacional para fluxos de produto/financeiro.
- Deve **alimentar/ancorar** `identities.tax_id`, não competir com ela.

**Imutabilidade após criação**: `global_users.cpf` deve ser tratado como **imutável após a primeira persistência** (signup/cadastro), salvo decisão arquitetural específica + migration dedicada. UNIQUE constraint já garante unicidade técnica; esta DECISION adiciona lock semântico: `UPDATE global_users SET cpf = ...` é VETADO em qualquer caminho normal de produto/perfil/identity. Reabertura exige DECISION nova para casos como retificação judicial.

**D5 — Papel de `user_profiles.cpf`.**

`user_profiles.cpf` é **substrato vivo**, mas deixa de ser SSOT.

Passa a ser **projeção CORE transitória** até execução da migração canônica (F4 de D10).

- Não pode ser tratado como órfão.
- Não pode ser deletado sem plano de migração + backfill auditado.
- Não deve ser introduzido em fluxos novos.
- Refatores futuros de `core.service.ts` e `profile.service.ts` (F4 de D10) devem migrar a leitura para `identities.tax_id`.

**D6 — Papel de `profiles.cpf`.**

`profiles.cpf` é **espelho/projeção transitória**.

- Não é SSOT de nenhuma dimensão.
- Mantida pela CTE em `profile.service.ts:455-477` em sync com `user_profiles.cpf`.
- Será deprecada na fase F5 de D10, somente após prova material de migração de leituras.

**D7 — Proibição de novas fontes.**

Nenhuma frente futura pode criar novo campo/tabela de CPF/CNPJ como fonte de verdade paralela.

Qualquer migration que adicione coluna de documento fiscal a uma tabela NOVA é VETADA até DECISION específica que justifique. Extensões válidas se limitam a colunas derivadas/cache documentadas (ex.: hash, last4) que NÃO sejam SSOT.

**D8 — Campos mortos.**

`actors.cpf_cnpj` e `actors.kyc_status` estão **mortos**.

- Removidos por migration `0010_migrate_identity_from_actors.sql` (linhas 41-42).
- Não podem ser reintroduzidos por nenhuma migration futura sem revogação explícita desta DECISION + DECISION-0060.
- Referências a esses campos em código/docs/DTs são **dívidas de correção** (ver D14).

**D9 — Backfill obrigatório.**

Antes de migrar qualquer leitura CORE para `identities.tax_id`, é **OBRIGATÓRIO**:

1. **Audit**: listar usuários com CPF em `user_profiles`/`global_users` sem linha correspondente em `identities` (matching via `users.global_user_id → identities.global_user_id` ou via `cpf == tax_id` normalizado).
2. **Reconciliação**: para cada gap, decidir: criar `identities` row via `identity.service.ts` (bootstrap KYC pending) OU marcar como inconsistência operacional documentada.
3. **Backfill idempotente**: script reaplicável que apenas insere identities faltantes; nunca sobrescreve `identities.tax_id` existente.
4. **Evidência**: relatório de cobertura pós-backfill — gap esperado: zero.

Sem audit + backfill provados, **fase F4 de D10 não pode iniciar**.

**D10 — Implementação gradual.**

Esta DECISION escolhe o destino canônico (Hipótese A), mas **não autoriza refactor imediato**. A execução futura deve ser fatiada:

- **F0 — Correção de referências documentais fantasma**: corrigir/inutilizar `bank-balance-by-cpf.service.ts` que lê `users.cpf` (coluna inexistente); auditar docs/DTs que ainda mencionam `actors.cpf_cnpj` ou `users.cpf` como fonte (ver D14).
- **F1 — Backfill audit**: query/script que reporta gaps `user_profiles.cpf` vs `identities.tax_id` (cobertura, divergência, formato).
- **F2 — Backfill idempotente**: script que popula `identities` para os gaps encontrados, criando identity rows em estado KYC apropriado (provavelmente `kyc_status='pending'` para casos sem KYC ainda submetido).
- **F3 — E2E de coerência CPF**: testes provando que `core.service.ts` (após F4) e `identity.service.ts` retornam o mesmo CPF normalizado para o mesmo `global_user_id`.
- **F4 — Migrar leitura CORE com segurança**: refator de `core.service.ts:225-338` para resolver CPF via JOIN com `identities` em vez de `user_profiles`. Mudança feita atrás de feature flag ou em fatia minúscula com regressão E2E completa.
- **F5 — Deprecar `user_profiles.cpf` e `profiles.cpf`**: somente após F4 estável em produção. Estratégia: parar escritas → manter leitura como fallback temporário → DROP COLUMN em migration dedicada com janela de observação.

Cada fase exige prompt executor próprio + autorização explícita Clayton.

**D11 — CNPJ.**

O sistema **registra/vincula** CNPJ existente. O sistema **não "cria"** CNPJ real.

CNPJ de empresa permanece em `companies.cnpj` (existe + populado: 13 rows runtime) **até decisão específica** sobre identidade fiscal PJ em `identities.tax_id_type='cnpj'`.

Quando essa DECISION PJ for tomada (frente própria), o caminho canônico será simétrico ao de CPF:
- `companies.cnpj` âncora de cadastro/deduplicação PJ
- `identities.tax_id_type='cnpj'` SSOT operacional PJ

Por ora, escopo PJ não está coberto materialmente por esta DECISION; está apenas reservado.

**D12 — F4.0.**

`actor_bank_destinations.holder_document` continua validando contra `identities.tax_id` via TRIGGER `trg_abd_enforce_own_account` (DECISION-0060 D8 + commit `e1536d07`).

DECISION-0062 **reforça** DECISION-0060 D8 ao confirmar que `identities.tax_id` é SSOT operacional global, alinhando F4.0 com a canonicidade ampliada.

DECISION-0062 **não autoriza** F4.1/F4.2/F4.3/F4.4 — continuam OPEN / NOT AUTHORIZED conforme DECISION-0059 e DTs sub-frentes.

**D13 — Payload público.**

CPF/CNPJ/`tax_id` **nunca** deve aparecer em:

- Perfil público (rota `/social/actors/:id`)
- `public_profiles.metadata` (vetado em DECISION-0061 D6, reforçado aqui)
- Payload social (feed, comentários, reações)
- Qualquer endpoint não autenticado/contextualizado

Qualquer service que retorne `tax_id` em payload acessível por terceiros é **violação estrutural** (equivalente a fail-condition de `IDENTITY_SSOT_PRECEDENCE.md`).

**D14 — Ghost references.**

Referências a `users.cpf`, `actors.cpf_cnpj` ou `actors.kyc_status` em código/docs/DTs são **dívidas de correção**.

Identificadas hoje:
- `backend/src/modules/bank/bank-balance-by-cpf.service.ts:121-124` — `FROM users u ... AND u.cpf = $2` (coluna inexistente). Caller dormente OU silenciosamente quebrado.
- Outras a auditar em F0 de D10.

Cada ghost reference vira **DT própria** ou subfase explícita de F0. **NÃO** corrigir agora — corrigir num caminho documentado com regressão.

`bank-balance-by-cpf.service.ts` em particular deve virar DT dedicada (ex.: `DT-BANK-BALANCE-BY-CPF-GHOST-USERS-CPF`) na próxima fatia documental, ratificando que a função estava materialmente quebrada e propondo correção alinhada à hipótese A (consultar `global_users.cpf → identities.tax_id` em vez de `users.cpf`).

**D15 — Relação com onboarding.**

Nenhuma frente grande de identity/onboarding deve implementar entrada ou edição de CPF **antes** da execução de F1+F2 (audit + backfill) de D10.

A frente de onboarding (memória `project_frente_identidade_onboarding`) tem como bloqueador material esta DECISION + execução das fases F0–F2.

**D16 — Relação com DT.**

`DT-CPF-SSOT-DUAL-WRITE-CORE-VS-IDENTITY` permanece **OPEN**.

DECISION-0062 escolhe a canonicidade (Hipótese A), mas a dívida só **fecha** quando backfill (F1+F2), leitura migrada (F4), sync/transição (entre F4 e F5) e E2Es (F3) estiverem implementados e estáveis.

Reclassificação de status futuro:
- `OPEN — BLOCKED BY DECISION-0062` enquanto F0 não iniciar.
- `IN PROGRESS` durante F1–F4.
- `CLOSED` apenas após F5 mergeado + janela de observação sem regressão.

### Vinculadas

- **`docs/01_normative/IDENTITY_SSOT_PRECEDENCE.md`** — **normativa-mãe** que DECISION-0062 estende para o domínio CORE/onboarding. Já declarava `identities` como autoridade de KYC/documento; esta DECISION fecha o gap CORE que estava órfão dessa cobertura.
- DECISION-0060 D2/D8 (`identities.tax_id` SSOT KYC/payout/F4 — DECISION-0062 reforça e amplia globalmente)
- DECISION-0061 D6 (`tax_id` vetado em `public_profiles` — reforçado por D13)
- DECISION-0043 (actor como projeção contextual — não cobria CPF SSOT)
- DT-CPF-SSOT-DUAL-WRITE-CORE-VS-IDENTITY (DT alvo desta DECISION — permanece OPEN)
- DT-USER-PROFILES-LEGACY-ORPHAN (SUPERSEDED — entrada histórica preservada)
- DT-PAYOUT-EXTERNAL-KYC-GATE-MISSING (F4.4 — gate canônico via `identities.kyc_status='approved'`, alinhado a DECISION-0062)
- DT-ACTOR-BANK-DESTINATION-MISSING (CLOSED em `e1536d07` — TRIGGER F4.0 já consulta `identities.tax_id`)
- `backend/migrations/0009_create_identities.sql` (substrato `identities.tax_id`)
- `backend/migrations/0010_migrate_identity_from_actors.sql` (DROP `actors.cpf_cnpj` + backfill — base canônica)
- `backend/migrations/0058_users_global_users_profiles_app.sql` (substrato `global_users.cpf` + `profiles.cpf`)
- `backend/migrations/0066_profile_support_tables.sql` (substrato `user_profiles.cpf` + `companies.cnpj`)
- `backend/src/core/profile/profile.service.ts:418-477` (dual-write CTE — migrará em F4)
- `backend/src/core/core.service.ts:180,225-338` (declara `cpfSource: 'user_profiles'` — migrará em F4)
- `backend/src/core/identity/identity.service.ts:255` (escrita canônica em `identities`)
- `backend/src/core/auth/auth.service.ts:393-397` (bug-fix CPF 2026-05-14 — caminho de bootstrap a auditar em F0/F1)
- `backend/src/modules/bank/bank-balance-by-cpf.service.ts:121-124` (ghost reference `users.cpf` — vira DT própria em F0)

### Superada por

(preencher quando F0–F5 forem executadas e DECISION de implementação final for registrada)

---

## DECISION-0063 — MVP_C1_PROFESSIONAL_DECLARATIVE_SUBSTRATE

**Status:** RATIFICADA — DESENHO VIGENTE DO MVP C1; IMPLEMENTAÇÃO (MIGRATION) NÃO AUTORIZADA NESTA DECISION (2026-05-31).
**Sessão:** 2026-05-31 (promulgação documental pós-Gate D2; frente F-PROFILE-PROFESSIONAL).
**Decisor:** Clayton (OK final de promulgação + 13 decisões de produto/arquitetura).
**Ratificação acumulada:** Opus (consolidou) + ChatGPT (ratificou, 2 ajustes finais) + Clayton (OK final).
**Commit âncora:** documental (sem código). Documento canônico: `docs/02_decisions/DESENHO_MVP_C1_PERFIL_PROFISSIONAL.md`.
**Origem:** Gate D2 (HEAD 73527a3b) — PROFISSIONAL D2 PARCIAL: ponte governada e chão semântico prontos; substrato profissional actor-keyed ausente. O substrato faltante É o entregável desta frente.

### Contexto

Desenho do MVP C1 do perfil profissional: **substrato profissional declarativo actor-first,
concept-anchored**. Grava verdade declarada ("este actor declara competência no concept X"); é
**SSOT da declaração profissional**, NÃO read-model.

**Natureza:** DECISION de DESENHO. NÃO é implementação, NÃO é schema, NÃO é migration.
**Esta DECISION não implementa schema. A migration de C1 é frente separada.**

### Decisões fechadas (13, Clayton)

- multiplicidade SIM → `UNIQUE(tenant_id, actor_id, concept_id)` (nunca `UNIQUE(tenant_id, actor_id)` em competências);
- `concept_id` = identidade semântica (Lei 7); `source_category_id` = apenas rastreio/breadcrumb, nunca identidade;
- `skill_level` = declaração qualitativa; `years_experience` = declaração quantitativa (ambas não-credenciais);
- certificação/verificação FORA do MVP C1;
- bio profissional distinta da bio geral (`public_profiles.bio`);
- preço/oferta/capability FORA (C2/C4); availability/agenda FORA (C3, SSOT temporal próprio);
- leitura por `actor_id` JÁ resolvido (sem side effect de criação); escrita/provisionamento via
  `ensureUserActor`/`findOrCreateUserActor` (actor-writer, §4.8.1 LEI_DE_COERENCIA); lookup solto
  user/global_user→actor_id PROIBIDO.

### Entidades candidatas ratificadas (sem migration nesta etapa)

- `actor_professional_profiles` — bio profissional, **1:1 por actor**, `UNIQUE(tenant_id, actor_id)`;
- `actor_professional_concepts` — competências declaradas, **1:N por actor**, `UNIQUE(tenant_id, actor_id, concept_id)`.

Nomes em `snake_case` + plural (07_NOMENCLATURA); validação canônica completa de nome é a 1ª
sub-etapa READ-ONLY da frente de migration.

### Ciclo de vida

Binário: `is_active BOOLEAN NOT NULL DEFAULT true` + `retired_at`. Desativação lógica;
**DELETE de competência PROIBIDO** (remoção = `is_active=false` + `retired_at`). Sem `status` enum
no MVP (não inventar estado concreto além de ativo/retirado).

### Escopo e anti-escopo

**Escopo:** MVP C1 apenas. **Anti-escopo:** sem preço · sem oferta · sem `workers` · sem
availability · sem capability · sem authority · sem `bank_*` · sem certificação verificável.

### Próxima frente (sessão separada)

Prompt executor da migration canônica de C1 — validação canônica dos nomes → criação das duas
tabelas → gates da §11 do desenho → registro de C1 no `SSOT_REGISTRY_UNIFICARD.md` como SSOT da
declaração profissional. C2/C3/C4 = frentes posteriores (C2/preço só após camada de pricing e sua
relação com `bank_*`, ratificação tripla).

**Sub-etapa 1 — VALIDAÇÃO CANÔNICA DE NOMES: CONCLUÍDA ✅ (READ-ONLY, 2026-05-31, HEAD fe81cb3a).**
Validado contra `07_NOMENCLATURA_CANONICA.md`:
- `actor_professional_profiles` / `actor_professional_concepts`: ZERO colisão (banco vivo + migrations
  + archive); snake_case + plural + prefixo `actor_` (convenção viva: actor_delegations/actor_reputation/
  actor_registry/actor_wallet_*).
- Termos canônicos: `professional` (scope/actor_type), `concept` (SSOT semântico), `profile`, `skill`.
- Colunas: `_at` (created/updated/declared/retired), `is_active` (prefixo `is_`), `_id` (FK). Sem termo
  proibido. Reforço: evitar `status` enum (07:247 proíbe `status` isolado) está ALINHADO com a norma.
- Esqueleto de chaveamento consistente com actor_reputation (id/tenant_id/actor_id/.../*_at).

**Sub-etapa 2 — DECISÕES DE TIPO: FECHADAS por Clayton (2026-05-31).**
- `skill_level` → `SMALLINT NOT NULL CHECK (skill_level BETWEEN 1 AND 5)`. Autoavaliação declarada,
  estruturada e comparável (busca/matching/contratação futura); labels na UI, número no banco.
  NÃO texto livre (evita "avançado/bom/ótimo/nível 4" inconsistentes). Continua declaração, não credencial.
- `years_experience` → `SMALLINT NULL CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 80)`.
  NULL = não informado; 0 = informou zero. Declarado, não verificado.
- Ciclo de vida travado no banco → `CHECK ((is_active = true AND retired_at IS NULL) OR
  (is_active = false AND retired_at IS NOT NULL))`. Remoção = desativação lógica, nunca DELETE.
Justificativa Clayton: modelo enterprise útil para busca/matching/contratação; nível estruturado e
comparável, sem virar certificação. Certificação/verificação segue FORA do MVP C1.

**Estado da frente:** spec COMPLETO (naming validado + tipos fechados + ciclo travado). Falta APENAS
a execução — escrita+aplicação da migration que cria o substrato SSOT da declaração profissional.
Isso exige prompt executor com ratificação tripla (executor não se autoriza). Spec pronto para o executor.

### Superada por

(preencher quando a migration de C1 e a implementação forem registradas)

---

## DECISION-0064 — LEARNING_INTEREST_SEMANTIC_GOVERNANCE

**Status:** RATIFICADA — GOVERNANÇA/DESENHO; IMPLEMENTAÇÃO (MIGRATION/C1) NÃO AUTORIZADA NESTA DECISION (2026-06-01).
**Sessão:** 2026-06-01 (pós-auditoria read-only Learning/Interest Lei 7).
**Decisor:** Clayton (Opção C + vetos).
**Commit âncora:** documental. HEAD de origem: `e908f3c7`.
**Documento canônico:** `docs/02_decisions/DECISION_0064_LEARNING_INTEREST_SEMANTIC_GOVERNANCE.md`.
**Vinculada a:** DECISION-0063 (padrão C1 profissional); DTs `DT-LEARNING-INTEREST-BLOB-SSOT`,
`DT-LEARNING-CATEGORIES-MISSING-CONCEPT-ID`, `DT-INTEREST-SCOPE-EMPTY`,
`DT-PROFILE-FRONTEND-DRIVES-TAXONOMY`, `DT-LIFESTYLE-SENSITIVE-IN-BLOB`.

### Contexto

Abas Aprendizado/Interesses mortas: salvam `categoryId` em blob `global_users.metadata` sem substrato
concept-first; guards Lei 7 bloqueiam corretamente (falha fechada). Problema = ausência de vocabulário
semântico governado, não bug de frontend. Material (HEAD `e908f3c7`): 90 concepts existentes ~todos
financeiros/comerciais (0 servem Learning/Interest; `educacao-e-conhecimento` = 0 concepts); 44 learning
categories `concept_id=NULL` (0 overlap com concepts); `scope='interest'` vazio. Pipeline
concept-governance/`create_category_from_concept` existe; falta dado + associação.

### Opções e escolha

A (categories+concept_id obrigatório) · B (UI direto por concepts) · C (híbrido governado). **Escolha:
OPÇÃO C.**

### Regras decididas

categories = navegação · concepts = identidade (SSOT) · só folha com `concept_id` governado é declarável ·
`source_category_id` = breadcrumb nunca identidade · Learning/Interest podem compartilhar `concept_id` mas
declaração distinta · Learning ≠ Professional · interesse declarado ≠ inferido · sugestão do usuário entra
em fila governada (não cria concept/category automático).

### Domínios

Learning concepts → `educacao-e-conhecimento` (N0 canônico, **verificado em `domains`**: presente, 0
concepts hoje). Interest → árvore própria governada `scope='interest'` (inexistente hoje), compartilhando
`concept_id` quando o significado for comum; correspondência exata concept↔folha é material da migration.

### Vetos

Sem SQL direto p/ popular `categories.concept_id` · sem remover `requireCategoriesWithConceptForScope` ·
sem `categoryId` como identidade · sem frontend criando concept/taxonomia · **sem C1 antes do substrato
semântico governado**.

### Consequências / próxima frente

Curto prazo: criar/associar concepts Learning/Interest via pipeline governado ANTES do C1 (frente
material própria, ~36+ concepts). Médio: DESENHO C1 actor-first + concept-first. Sequência: (1)
DESENHO/MIGRATION governada de concepts/categories Learning/Interest → (2) DESENHO C1. Esta DECISION fixa
modelo + domínios + vetos; NÃO autoriza migration nem C1 (fatias separadas, ratificação própria).

### Superada por

(em aberto — esta é uma decisão vigente)

---

## DECISION-0065 — LEARNING_CONCEPTS_MATERIAL_DIRECTIVES

**Status:** RATIFICADA — DIRETRIZES MATERIAIS PRÉ-MIGRATION; IMPLEMENTAÇÃO (MIGRATION) NÃO AUTORIZADA NESTA DECISION (2026-06-01).
**Sessão:** 2026-06-01 (pós-desenho read-only da migration governada Learning/Interest).
**Decisor:** Clayton (6 decisões materiais).
**Commit âncora:** documental. HEAD de origem: `cf791d1f`.
**Documento canônico:** `docs/02_decisions/DECISION_0065_LEARNING_CONCEPTS_MATERIAL_DIRECTIVES.md`.
**Deriva de:** DECISION-0064 (modelo Opção C). Não altera 0064; materializa decisões operacionais.

### Contexto

Desenho material read-only (HEAD `cf791d1f`) confirmou o pipeline governado (`concept-governance.service`
/ trigger 0075 / `create_category_from_concept` 0097/0110; `concepts UNIQUE(domain,slug)`, FK
`domain→domains`, `categories.concept_id` FK→concepts ON DELETE SET NULL, CHECK só exige concept em
level 2, `categories` SEM triggers vivos) e isolou 6 decisões antes da Migration A de Learning.

### Decisões materiais

1. **Slug do concept:** tópico limpo (`fotografia`, `musica`, `programacao`); sem sufixo `-aprendizado`
   (contexto pertence à declaração futura, não à identidade). Categorias mantêm slug de navegação.
2. **Domínio Migration A:** `educacao-e-conhecimento` (N0 vivo). NÃO resolve compartilhamento com
   Professional/Serviços aqui; futuro precisa de decisão de ontologia própria.
3. **Associação:** preservar árvore learning existente; criar concepts por caminho governado; associar
   `concept_id` às folhas existentes **por migration governada, mapping literal, transação**. NÃO é "SQL
   direto ad-hoc"; é migration forward-only documentada/ratificada. Veto 0064 segue contra UPDATE manual/
   runtime/improvisado/fora de migration governada.
4. **Nível declarável:** manter folhas learning em `level=1`; NÃO reestruturar p/ level 2; NÃO usar
   `create_category_from_concept` se reestruturar a tree. Critério declarável = folha com `concept_id`
   governado (guard não checa level).
5. **Interest:** NÃO criar `scope='interest'` na Migration A; fatia própria (sem árvore/decisão de produto
   hoje). Learning/Interest poderão compartilhar concepts quando o significado for igual.
6. **Compartilhamento:** Learning↔Interest pode compartilhar `concept_id`; Learning↔Professional/Serviços
   NÃO automaticamente (exercício/oferta ≠ desejo de aprender; mesma palavra ≠ mesma verdade operacional).

### Escopo / fila

Esta fatia **NÃO autoriza migration ainda**. Próxima fatia material = **Migration A — Learning concepts +
associação governada** (36 concepts em `educacao-e-conhecimento` + associar folhas; prompt executor
próprio, ratificação). Interest = fatia própria. C1 Learning/Interest só depois do substrato semântico.

### Superada por

(em aberto — decisão vigente)

---

## DECISION-0066 — INTEREST_TREE_MATERIAL_DIRECTIVES

**Status:** RATIFICADA — DIRETRIZES MATERIAIS PRÉ-MIGRATION B; IMPLEMENTAÇÃO (MIGRATION) NÃO AUTORIZADA NESTA DECISION (2026-06-01).
**Sessão:** 2026-06-01 (pós-desenho read-only de Interest, pós-Migration A).
**Decisor:** Clayton (árvore + reuso + domínio + fronteiras).
**Commit âncora:** documental. HEAD de origem: `6d9e9a29`.
**Documento canônico:** `docs/02_decisions/DECISION_0066_INTEREST_TREE_MATERIAL_DIRECTIVES.md`.
**Deriva de:** DECISION-0064 (Opção C) + DECISION-0065 (Learning). Materializa diretrizes de Interest.

### Contexto

Migration A (`6d9e9a29`) criou 36 concepts Learning + associou 36 folhas. `scope='interest'` segue vazio
(0). `/profile/physical` lê/escreve interests via scope 'interest' (`enrichCategoryNavigationByIds(...,
'interest')` :55/:218; `requireCategoriesWithConceptForScope(...,'interest')` :188) — exige categorias
`scope='interest'` com `concept_id`. `categories_scope_check` já permite 'interest' (sem alterar schema).
Lifestyle sensível enredado no mesmo blob/endpoint — fora desta decisão.

### Opções e escolha

A (árvore mínima governada) · B (ampla) · C (concepts direto) · D (adiar). **Escolha: OPÇÃO A.**

### Regras

Interest = árvore própria `scope='interest'`, mínima/governada. Raízes level 0 sem concept; folhas level 1
com concept. Reuso de `concept_id` de Learning quando o significado for idêntico; concepts novos só via
governança para lazer/afinidade não coberto. Lifestyle FORA da Migration B. Persistência blob temporária
até C1 (NÃO fechar DT-LEARNING-INTEREST-BLOB-SSOT). C1 só depois do substrato de Interest.

### Árvore inicial

Raízes: cultura-e-arte, esporte-e-bem-estar, tecnologia-e-jogos, gastronomia, casa-e-mao-na-massa,
negocios-e-financas, mundo-e-pessoas. Folhas reuso (27): musica, fotografia, desenho-ilustracao, design,
atividade-fisica, nutricao, saude-mental, games, programacao, inteligencia-artificial, ferramentas-digitais,
culinaria, confeitaria, panificacao, jardinagem, marcenaria, diy, decoracao, manutencao-basica,
empreendedorismo, financas-pessoais, gestao, marketing-digital, idiomas, historia, filosofia, ciencias.
Folhas/concepts novos candidatos (11): cinema-e-series, leitura, teatro, futebol, corrida, yoga, gadgets,
vinhos-e-bebidas, cafe, viagens, pets.

### Domínio dos concepts novos — RESOLVIDO

`cultura-lazer-e-eventos` **verificado EXISTE em domains** (N0 canônico) → domínio recomendado para concepts
novos de lazer/afinidade; tópicos de conhecimento reutilizam `educacao-e-conhecimento`. **Domínio NÃO
ambíguo** → sem bloqueio de domínio para Migration B. Reclassificação fina de candidato isolado p/ outro
domínio vivo é ajuste do prompt da Migration B; **nunca** inventar domínio novo sem fatia própria.

### Vetos

Sem lifestyle nesta migration · sem frontend criando taxonomia · sem categoryId como identidade · sem SQL
ad-hoc (só migration governada com mapping) · sem C1 antes da Migration B · sem fechar
DT-LEARNING-INTEREST-BLOB-SSOT · guard requireCategoriesWithConceptForScope permanece.

### Escopo / próxima frente

NÃO autoriza migration. Domínio decidido → próxima fatia material PODE ser **Migration B — Interest
concepts + árvore + associação** (governada, prompt executor próprio, ratificação). C1 só depois do
substrato de Interest.

### Adendo A (2026-06-01) — slugs de categories interest com sufixo `-interesse`

Após auditoria read-only de duplicidade (HEAD `a602d2dd`): **sem duplicidade material** de substrato de
Interest (0 tabelas/scope/concepts; archive nunca aplicado; sem implementação anterior no Git) → Migration
B pode seguir. **Achado:** `categories_slug_key UNIQUE(slug)` é **global** → slugs limpos de categoria
colidem (11: programacao/idiomas/ciencias/… em learning; gastronomia em professional). **Regra:** concepts
mantêm slug **limpo**; categorias `scope='interest'` usam **sufixo `-interesse`** (raízes e folhas); mapping
`*-interesse` (category) → slug limpo (concept). Concept não duplica (UNIQUE(domain,slug)); folha interest e
learning compartilham o mesmo `concept_id`. Detalhe canônico no doc
`docs/02_decisions/DECISION_0066_INTEREST_TREE_MATERIAL_DIRECTIVES.md` (ADENDO A). Vinculante para a
Migration B. Não autoriza migration.

### Superada por

(em aberto — decisão vigente)

---

## DECISION-0067 — C1_LEARNING_INTEREST_ACTOR_FIRST

**Status:** RATIFICADA — ARQUITETURA/DESENHO; IMPLEMENTAÇÃO (MIGRATION/BACKEND/FRONTEND) NÃO AUTORIZADA NESTA DECISION (2026-06-01).
**Sessão:** 2026-06-01 (pós-desenho read-only C1 Learning/Interest, pós-Migrations A+B).
**Decisor:** Clayton (Opção C + campos + ordem + vetos).
**Commit âncora:** documental. HEAD de origem: `ff7495c5`.
**Documento canônico:** `docs/02_decisions/DECISION_0067_C1_LEARNING_INTEREST_ACTOR_FIRST.md`.
**Deriva de:** DECISION-0063 (template C1 profissional) + 0064/0065/0066.

### Contexto

Learning+Interest têm substrato semântico governado (Migrations A `6d9e9a29` / B `ff7495c5`) e salvam, mas
persistência ainda é blob `global_users.metadata` (DT-LEARNING-INTEREST-BLOB-SSOT OPEN). C1 move declarações
para SSOT actor-first `tenant_id+actor_id+concept_id` (+source_category_id breadcrumb), espelhando o C1
profissional selado (DECISION-0063). Material: tabelas C1 learning/interest AUSENTES; professional EXISTE
(template); 0 dados no blob (dev) → backfill no-op seguro.

### Opções e escolha

A (duas tabelas) · B (genérica) · C (duas tabelas + view). **Escolha: OPÇÃO C.**
Tabelas: `actor_learning_concepts`, `actor_interest_concepts`. View read-only:
`actor_concept_declarations_v` (UNION professional+learning+interest).

### Campos / regras

Learning: `progress SMALLINT NULL (1..3)` = estágio de exploração, NÃO competência (sem skill_level/years).
Interest: binário (sem weight/priority). Sem bio/profile p/ Learning/Interest. concept_id obrigatório
(identidade); actor_id obrigatório via writer §4.8.1 (não global_user_id); source_category_id só breadcrumb;
ciclo is_active+retired_at (XOR); UNIQUE(tenant,actor,concept); índice (tenant,concept).

### Contrato futuro

`/profile/learning/c1` e `/profile/interest/c1` (GET/POST/PATCH/DELETE granular, desativação lógica). READ
camelCase / WRITE camelCase inputs / interno snake_case. Espelha professional-c1.

### Vetos

Sem tabela genérica com attrs jsonb (re-blob) · sem global_user_id como identidade operacional · sem
categoryId como identidade · sem lifestyle · sem inferred profile na mesma tabela · sem professional/
capability/authority/oferta/agenda/financeiro · sem global_users.metadata como destino.

### Ordem das fatias

(1) schema migration (2 tabelas + view) → (2) backend C1 → (3) backfill idempotente (DEV no-op) → (4)
frontend → (5) cleanup do blob (lifestyle fora). Cada fatia = prompt executor próprio. C1 profissional
permanece selado.

### Impacto DTs (nenhuma fechada aqui)

DT-LEARNING-INTEREST-BLOB-SSOT fecha só após Fatia 5; DT-PROFILE-FRONTEND-DRIVES-TAXONOMY só após Fatia 4;
DT-LEARNING-CATEGORIES-MISSING-CONCEPT-ID e DT-INTEREST-SCOPE-EMPTY já PARTIALLY MITIGATED;
DT-LIFESTYLE-SENSITIVE-IN-BLOB permanece fora.

### Próxima frente

NÃO autoriza migration. Próxima fatia material = **Fatia 1 (schema migration C1 Learning/Interest)**, prompt
executor próprio, ratificação, ciclo fechado.

### Superada por

(em aberto — decisão vigente)

---

## DECISION-0068 — CONCEPTID_SURFACING_DECLARATIVE_CONTEXTS

**Status:** RATIFICADA — EXECUTADA (código + provas) (2026-06-01).
**Decisor:** Clayton. **Commit âncora:** HEAD origem `827c0b07`.
**Documento canônico:** `docs/02_decisions/DECISION_0068_CONCEPTID_SURFACING_DECLARATIVE_CONTEXTS.md`.
**Complementa (sem alterar retroativamente):** DECISION-0064/0067; estende OPÇÃO B (07 §4262/4278) sem
revogar a proibição transacional.

### Contexto

Fatia 4 frontend parada porque o frontend não recebia `conceptId`: `categories.service.ts` removia
`conceptId` de toda leitura com `context !== 'professional'` (incl. learning/interest); C1 exige conceptId
UUID real. ProfileLearning só tinha categoryId; ProfilePhysical usa catálogo hardcoded com conceptId fake.

### Escolha

Expor `conceptId` nas leituras de categoria APENAS para contextos DECLARATIVOS: `professional`, `learning`,
`interest`. Helper único `canExposeCategoryConceptId(context?)` nos 3 pontos de surfacing (tree/children/
autocomplete). Contexto omitido ⇒ NÃO surfaçar (default seguro; decide pelo context explícito, não pelo
effectiveContext).

### Justificativa / Vetos

Declaração de perfil actor-first/concept-first ≠ concept_ref transacional (intent/offer/checkout/pagamento)
→ §4262/4278 não se aplica. NÃO expor para event/campaign/company/health/lifestyle/group/marketplace/
financeiro nem contexto omitido. category_id segue navegação; concept_id segue identidade (Lei 7).

### Consequência / Provas

Desbloqueia Fatia 4b (frontend Learning→C1) e 4c (redesign Interest no ProfilePhysical). Provas executadas:
professional 3 conceptId (preservado); learning 36/36; interest 38/38; children sem context 0 (3 filhos);
event/company 0. Escopo: só `categories.service.ts`; zero frontend/migration/schema/C1/financeiro/blob.

### Superada por

(em aberto — decisão vigente)

---

## DECISION-0069 — Readers user-scoped resolvem declarações C1 pelo actor user

**Status:** RATIFICADA — EXECUTADA (F1: helper de leitura + provas) (2026-06-01).
**Decisor:** Clayton. **Commit âncora:** HEAD origem `392cd68b`.
**Documento canônico:** `docs/02_decisions/DECISION_0069_C1_READERS_USER_ACTOR_RESOLUTION.md`.
**Complementa (sem revogar):** DECISION-0067/0068; `SELO_C1_LEARNING_INTEREST.md` §5.1 (resíduo readers→C1).

### Contexto

Frente Learning/Interest → C1 selada (escrita+frontend no C1; blob removido). Mas readers backend
(`profile-inference.service`, `opportunity.service`, `core.service`) ainda usam leitores legados (hoje
retornam vazio) e operam por `userId`, enquanto o C1 é actor-first (leitura por `actor_id`).

### Escolha

Readers user-scoped resolvem `userId → actors.actor_id` onde `tenant_id=$1 AND user_id=$2 AND
actor_type='user'`. Sem criação (zero `ensureUserActor`); sem `global_user_id` como identidade final; 0
actor → vazio controlado; >1 actor → falha fechada `USER_ACTOR_AMBIGUOUS_FOR_C1_DECLARATIONS`. Fonte =
view `actor_concept_declarations_v` (`concept_id` identidade; `declaration_kind IN ('learning','interest')`,
`is_active=true`); `source_category_id` breadcrumb opcional (LEFT JOIN categories; nulo → não inventar).

### Justificativa / Vetos

Ponte de identidade necessária antes de migrar consumidores; concept-first preserva Lei 7. Vetos:
`ensureUserActor`, `global_user_id` como SSOT, `SELECT *`, `global_users.metadata`, fallback
`conceptId←categoryId`, mistura de Professional/Lifestyle/Saúde, financeiro, escrita, migrar consumidores.

### Consequência / Provas (F1)

Entregue helper `profile-c1-declarations-read.{service,repository}.ts` (read-only). Provas runtime:
actorId resolvido (match dev), learning=3/interest=1, progress 1/2/3→beginner/intermediate/advanced (conceptId
real, name/path do breadcrumb), interest com conceptId+sourceCategoryId, user sem actor→vazio controlado,
ambiguidade por `rows.length>1`. Gates: typecheck 0; actor-writer/bank-ledger/regression OK; arch
`critical_new=0`. Zero consumidor migrado/frontend/migration/financeiro/Lifestyle/Saúde/Agenda/Professional.
Próximas: F2 inference → F3 opportunity → F4 core. `DT-C1-READERS-BLOB-TO-C1` OPEN.

### Superada por

(em aberto — decisão vigente)

---

## DECISION-0070 — Expansão governada de categories por IA não é identidade semântica

**Status:** RATIFICADA — DOCS-ONLY (split documental de DT após auditoria read-only) (2026-06-01).
**Decisor:** Clayton. **Commit âncora:** HEAD origem `9149e523`.
**Documento canônico:** `docs/02_decisions/DECISION_0070_AI_CATEGORY_EXPANSION_NOT_SEMANTIC_IDENTITY.md`.
**Complementa:** DECISION-0064/0068; `SELO_C1_LEARNING_INTEREST.md`. **Vinculada a:**
`DT-PROFILE-FRONTEND-DRIVES-TAXONOMY` (reduzida), `DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION` (nova).

### Contexto

Auditoria read-only (HEAD `9149e523`) da `DT-PROFILE-FRONTEND-DRIVES-TAXONOMY`: Learning e Interest
**neutralizados** (não chamam create/suggest); C1 declarativo exige `conceptId` (sem fallback
`conceptId←categoryId`). Fluxos ainda vivos de criação de `categories` por IA: **Profissional**
(`ProfileProfessional.tsx` → `suggestCategoryPath`/`createCategoryWithAI('professional')`) e **Educação/Empresas**
(`profile-education-companies.service.ts` → `createCategoryWithAI({context:'education'|'company'})`). Governança
no backend: admission policy BLOCK/REVIEW/ALLOW + `pending_review`/`requires_review` + auditoria `source:'ai'`.

### Escolha

Não neutralizar mecanicamente agora. Classificar o resíduo como **expansão GOVERNADA de NAVEGAÇÃO
(`categories`)**, não criação de **identidade semântica (`concepts`)**. Manter como DT própria **DEFERRED** até
decisão de produto.

### Justificativa / Vetos

`createCategoryWithAI` cria `categories`, **não `concepts`**, **não atribui `concept_id`** → categoria IA é
**não-declarável no C1** (trava conceptId). `concept_id`=identidade (Lei 7); `category_id`=navegação. Vetos
permanentes: frontend não cria CONCEPT; sem `categoryId` como identidade; sem fallback `conceptId←categoryId`;
categoria IA sem conceptId não vira declaração C1.

### Consequência / Provas

`DT-PROFILE-FRONTEND-DRIVES-TAXONOMY` reduzida (núcleo semântico resolvido; PARTIALLY MITIGATED apontando p/ a
DT específica). Nova `DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION` (DEFERRED) para o resíduo vivo.
Decisão de produto futura (manter governado / neutralizar como Learning-Interest / fila formal sempre REVIEW)
fica para fatia própria — esta DECISION só classifica e separa a dívida. Docs-only; gates verdes; `critical_new=0`.

### Superada por

(em aberto — decisão vigente)

---

## DECISION-0071 — Política de dados sensíveis Lifestyle/Saúde no Perfil

**Status:** RATIFICADA — DECISÃO DE PRODUTO/PRIVACIDADE (D1), DOCS-ONLY; implementação NÃO autorizada (2026-06-01).
**Decisor:** Clayton (9 escolhas + 2 eixos). **Commit âncora:** HEAD origem `dec3b883`.
**Documento canônico:** `docs/02_decisions/DECISION_0071_SENSITIVE_LIFESTYLE_HEALTH_PROFILE_POLICY.md`.
**Subordinada a:** Constituição/LEIS (LGPD como limite), LEI_COERÊNCIA §4.8 (actor-first). **Vinculada a:**
`DT-LIFESTYLE-SENSITIVE-IN-BLOB` (OPEN — D1 tomada, implementação pendente).

### Contexto

`global_users.metadata.lifestyle` guarda `sexualOrientation`/`relationshipStatus`/`drinks`/`smokes` sem
consent/visibility/audit/retenção; `drinks/smokes` alimentam `social-targeting`. Saúde tem UI/rotas/service/
repos mas **tabelas ausentes** (migration 0382 arquivada) → fantasma. Learning/Interest já no C1 (não reabrir).

### Escolhas (9 pontos)

1 sexualOrientation: **A remover/bloquear do MVP** · 2 relationshipStatus: **A lifestyle privado** · 3
drinks/smokes: **A privado, sem targeting** · 4 social-targeting: **A bloquear drinks/smokes até consent** · 5
visibility: **A private default** · 6 consent: **A explícito por campo** · 7 retenção: **A delete real/
anonymize; audit do evento sem valor em claro** · 8 identidade: **A actor-first** · 9 Saúde: **B 501 até
substrato governado**. Eixos adicionais: **10** texto livre que possa capturar saúde não é neutro (trava;
`biologicalSex` não existe no repo; único caminho livre-saúde é o substrato de Saúde sob 501); **11** dado
civil (ex.: biologicalSex futuro) não reaproveitável para Saúde sem finalidade/consent (trava prospectiva).

### Vetos / Consequências

Vetos: sensível em metadata como SSOT final; targeting com sensível sem consent; Health fantasma; global_user
como identidade quando o dado é do actor; reaproveitar dado civil para saúde sem finalidade; texto livre
saúde como neutro. Consequências: Saúde→501 (fatia própria); lifestyle exige SSOT actor-first+consent+
visibility(private)+audit+retenção antes de sair do blob; sexualOrientation sai; desacoplar drinks/smokes do
targeting; cleanup do blob só após SSOT+backfill. Sequência: F-SAUDE-501 → F-TARGETING-DECOUPLE → F1 schema →
F2 backend → F3 frontend → F4 readers → F5 cleanup+selo. Ordem inegociável: política antes de schema/código.
DT permanece OPEN. Docs-only; gates verdes; critical_new=0.

### Superada por

(em aberto — decisão vigente)

---

## DECISION-0072 — Agenda/Availability: materialização B1 no `unified_availability`

**Status:** RATIFICADA — DECISÃO DE MODELAGEM (F0), DOCS-ONLY; implementação NÃO autorizada (2026-06-01).
**Decisor:** Clayton (escolha B1 sobre B2). **Commit âncora:** HEAD origem `6ed6e5f3`.
**Documento canônico:** `docs/02_decisions/DECISION_0072_AGENDA_AVAILABILITY_B1_MATERIALIZATION.md`.
**Subordinada a:** `SSOT_REGISTRY_UNIFICARD.md` §SSOT TEMPORAL (autoridade única `unified_availability`),
Constituição Art. II / `CORE_IMUTAVEL.md`, `CORE_TEMPORAL_CONTRACT.md`, LEI_COERÊNCIA §4.8 (actor-first).
**Vinculada a:** `DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT` (OPEN — decisão tomada, implementação pendente).

### Contexto

Aba Agenda tem **write vivo quebrado**: `ProfileAgenda.tsx:165` `updateProfessionalProfile({availability})` →
`PUT /profile/professional` → **501** (corte Profissional→C1) → dado perdido. Leitura já canônica
(`GET /availability`, actor-first), mas faz `setSchedule({})` (template nunca lido de volta). Mismatch: UI =
**template semanal** (`{[dayOfWeek]:string[]}` + `specific`), `unified_availability` = **janelas datadas
concretas** (sem coluna de recorrência viva). SSOT_REGISTRY §SSOT TEMPORAL: `unified_availability` é o **único**
SSOT temporal; `schedules`/`schedule_slots` LEGADO (WRITE = C63 crítico); nenhuma outra tabela/metadata persiste
tempo → tabela temporal nova VETADA.

### Escolha

**B1 — materializar a grade semanal declarativa em janelas concretas dentro de `unified_availability`**
(`availability_type='recurring'`, horizonte finito, expansão por recorrência). B2 (recorrência nativa na própria
`unified_availability`) fica como futuro, NÃO entra agora. Justificativa: respeita SSOT_REGISTRY, sem schema novo,
sem legado, menor risco, mantém `availability` como única verdade operacional temporal.

### Invariantes / Vetos

12 invariantes (doc canônico): unified_availability único SSOT; template→materializado; `availability_type=
'recurring'`; **timezone explícito** (nunca implícito); **horizonte finito 8–12 semanas**; **sem replace cego**;
**não apagar janela com booking/participant/conflito ativo**; `specific`→janelas/overrides (não metadata);
schedules/schedule_slots proibidos (C63); `/profile/professional` segue 501; Professional C1 não guarda
disponibilidade; financeiro fora. Vetos: tabela temporal nova, schedule em metadata, write em legado, reativar
professional, DELETE/replace cego, apagar janela com booking, TZ implícita.

### Consequências (sequência, não autorizada aqui)

F0 (esta) → F1 backend materializador seguro (diff incremental, TZ explícita, horizonte, protege bookings) → F2
frontend (write canônico + corrigir read-back `setSchedule({})`) → F3 cleanup do `updateProfessionalProfile`
morto → F4 testes+selo+CLOSE da DT. Ordem: backend seguro antes do frontend; sem DELETE em massa. DT permanece
**OPEN** até F4. Docs-only; gates verdes; critical_new=0.

### Superada por

(em aberto — decisão vigente; B2 pode estender sem revogar B1)

---

## DECISION-0073 — Educação no MVP é declaração não-verificada do actor (não credencial verificada)

**Status:** RATIFICADA — DECISÃO DE PRODUTO/ARQUITETURA, DOCS-ONLY; implementação NÃO autorizada (2026-06-01).
**Decisor:** Clayton. **Commit âncora:** HEAD origem `89c475a3`.
**Documento canônico:** `docs/02_decisions/DECISION_0073_EDUCATION_DECLARATION_NOT_VERIFIED_CREDENTIAL.md`.
**Subordinada a:** Constituição/LEIS, LEI_COERÊNCIA §4.8 (actor-first), SSOT_REGISTRY. **Vinculada a:**
`DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION` (DEFERRED), DECISION-0070, `SELO_C1_LEARNING_INTEREST.md`.

### Contexto

Caminho vivo de Educação (`profile-education.*`, registrado) é **event-sourced, actor-first, append-only**
(`event_log`, `metadata.actorId`); **sem** metadata-blob/category_id/concept_id; separado de Learning C1 e
Professional C1; **0 eventos** em DEV (dormente). Implementação `profile-education-companies.*` é **órfã/morta**
(sem rota registrada; `user_education`/`user_companies` AUSENTES; global_user_id-keyed; category-as-identity;
createCategoryWithAI) + `EducationSection.tsx` não-renderizado. **Risco semântico:** ciclo com forma de
credencial (`validada_institucionalmente`/`confirmada`/`contestada` + `validator`/`evidence`), UI rotula
"Validada Institucionalmente", mas **tudo é autoasserido** — sem emissor/prova/autoridade/terceiro.

### Escolha

**Educação MVP = DECLARAÇÃO NÃO-VERIFICADA do actor.** NÃO é credencial verificada (essa é frente futura
própria, puxa emissor/prova/autoridade/audit). Fronteiras: Educação ≠ Learning ≠ Professional ≠ credencial;
não gera skill profissional; não concede capability/authority; não usa category_id como identidade; não usa
concept_id no caminho vivo.

### Veto / Vocabulário / Termos

**Veto:** nenhum evento/UI pode apresentar formação como "verificada/institucionalmente validada" sem emissor,
prova, autoridade e validação por terceiro. **Vocabulário de risco** (hoje autoasserido, ≠ credencial):
`educacao.validada_institucionalmente`, `educacao.confirmada`, `educacao.contestada`, `payload.validator`,
`payload.evidence`. **Decisão sobre os termos:** **reservar/desabilitar** esses eventos até existir substrato de
credenciais (preferida); ou, se mantidos, **rebaixar** para rótulos honestos de autodeclaração. Implementação na
F2 (não aqui).

### Órfão + DECISION-0070

`profile-education-companies.*` + `EducationSection.tsx` = morto → **F1 neutralização/quarentena** (classificar
§4-A; baixo risco; não apagar aqui). Expansão IA/category de Educação permanece **DEFERRED** sob
`DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION`/DECISION-0070 — não entra no MVP event-sourced.

### Sequência

D1 (esta, docs-only) → F1 neutralizar órfão morto → F2 ajustar vocabulário/UI/event types (reservar ou rebaixar)
→ F3 selo Educação. Docs-only; gates verdes; critical_new=0. Nenhuma DT técnica fechada aqui.

### Superada por

(em aberto — decisão vigente)

---

## DECISION-0074 — Endereço civil da pessoa física → Location Core (`addresses` + `address_assignments`)

**Status:** RATIFICADA — DECISÃO DE MODELAGEM/SSOT, DOCS-ONLY; implementação NÃO autorizada (2026-06-01).
**Decisor:** Clayton (owner model: profile + actor_id + RESIDENCE). **Commit âncora:** HEAD origem `4ec2dfcb`.
**Documento canônico:** `docs/02_decisions/DECISION_0074_PROFILE_RESIDENCE_ADDRESS_LOCATION_CORE.md`.
**Subordinada a:** DECISION-0020 (Location Core soberano), DECISION-0021, SSOT_REGISTRY, LEI_COERÊNCIA §4.8
(actor-first). **Vinculada a:** `DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE` (OPEN), DECISION-0069.
**Escopo desta instância:** SOMENTE Pessoa Física; PJ/Companies tratados por outra instância.

### Contexto

Aba Pessoal grava endereço civil PF em `profiles.metadata.address` (blob) e lê do mesmo (core.service). DEV: 1
blob. O Location Core canônico (mig. 518000) já tem slot nativo PF: `owner_type='profile'` + `role='RESIDENCE'`
+ `source='IMPORT_LEGACY'`/`UX_INPUT` + lat/lng geo-ready + temporal. Companies já usam o Location Core
(company/HQ); o endereço PF é o único que permaneceu em blob — divergência que geo/jurisdição/marketplace
herdariam.

### Escolha + modelo

Endereço civil PF sai de `profiles.metadata.address` → Location Core (`addresses` + `address_assignments`).
Modelo: `owner_type='profile'`, **`owner_id=actor_id` do user-actor**, `role='RESIDENCE'`, `is_primary=true`;
`source='UX_INPUT'` (novo) / `'IMPORT_LEGACY'` (backfill). `'profile'`=papel civil; dono operacional=actor PF
(NÃO global_user_id, NÃO profile_id).

### Justificativa / Fronteiras / Vetos

Mantém actor-first; não reintroduz global_user_id operacional; não usa profile_id tenant-local; converge PF ao
Location Core; tira endereço civil do blob. Fronteiras: RESIDENCE ≠ HQ ≠ OPERATIONAL ≠ actor_active_location
(contexto espacial corrente, não residência). Vetos: blob como destino final; Location Core paralelo; owner_id=
global_user_id/profile_id; tocar PJ/Companies/CPF/gender/financeiro; implementar nesta fatia.

### Sequência

D1 (esta, docs-only) → F1 backend reader/writer + backfill idempotente (F1 antes de F2) → F2 frontend
ProfilePersonal → rota canônica → F3 readers/core sem blob → F4 cleanup `profiles.metadata.address` → F5 selo +
CLOSE da DT. Nova `DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE` (OPEN). Docs-only; gates verdes; critical_new=0.

### Superada por

(em aberto — decisão vigente)

---

## DECISION-0076 — Política de enriquecimento geográfico (city/state/neighborhood) do endereço civil PF

**Status:** RATIFICADA — POLÍTICA/MODELAGEM (D2), DOCS-ONLY; implementação não autorizada (2026-06-02).
**Decisor:** Clayton (Opção A). **Commit âncora:** HEAD origem `5e098a25`.
**Documento canônico:** `docs/02_decisions/DECISION_0076_PROFILE_ADDRESS_GEO_ENRICHMENT_POLICY.md`.
**Subordinada a:** DECISION-0074, DECISION-0020/0021, SSOT_REGISTRY. **Vinculada a:**
`DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE` (OPEN), DECISION-0075 §7. **Escopo:** SOMENTE PF; PJ fora.

### Contexto

Pós F1/F2: endereço civil PF gravado no Location Core (CEP-âncora; city/state/neighborhood NULL); frontend não
escreve mais no blob; `core.service` ainda **enriquece** city/state/neighborhood do **blob preservado** (não
regredir exibição). Achados que travam o corte: `addresses` sem coluna textual de city/state/neighborhood (só
FK nullable); **sem resolver CEP→geo / geocoding** no backend; catálogo só capitais (cities=27, neighborhoods=0)
→ Curitiba resolve, casos gerais não.

### Decisão (Opção A)

**Manter o enriquecimento transitório do blob no reader** até existir estratégia canônica de enriquecimento
(CEP/catálogo/geocoding). Location Core continua SSOT (postal_code/street/number/complement + FK nullable +
lat/lng). `profiles.metadata.address` deixa de ser destino de escrita (F2) mas **permanece fallback transitório
de exibição** de city/state/neighborhood. **Cleanup do blob (F4) BLOQUEADO** até ao menos UMA pré-condição:
(a) resolver CEP/geocoding canônico; (b) FK city/state/neighborhood resolvida com segurança (catálogo completo +
bairros); (c) UI aceitar exibição sem city/state/neighborhood; (d) decisão explícita de perda. Vetos: FK frágil;
coluna textual em addresses; cortar blob antes de pré-condição; tocar PJ/CPF/gender/financeiro; implementar aqui.

### Consequências

**F3 (readers/core sem blob) NÃO é o próximo corte automático** — depende de F-GEO (frente futura **compartilhável
PF/PJ**: resolver CEP/catálogo/geocoding). Fronteira PJ já registrada em DECISION-0075 §7 + DT_LOG. Docs-only;
gates verdes; critical_new=0. DT permanece OPEN.

### Superada por

(em aberto — decisão vigente)

---

## DECISION-0077 — Política de enriquecimento geográfico do Location Core (estratégia B+D+C; lat/lng coarse)

**Status:** RATIFICADA — ESTRATÉGIA/MODELAGEM (D-GEO), DOCS-ONLY; implementação não autorizada (2026-06-02).
**Decisor:** Clayton. **Commit âncora:** HEAD origem `ff0a8c43`.
**Documento canônico:** `docs/02_decisions/DECISION_0077_LOCATION_CORE_GEO_ENRICHMENT_POLICY.md`.
**Subordinada a:** DECISION-0020/0021/0074/0076, SSOT_REGISTRY, LGPD. **Vinculada a:**
`DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE` (OPEN), DECISION-0075 §7. **Escopo:** estratégia compartilhável; NÃO
implementa, NÃO toca PJ.

### Contexto

`addresses` sem coluna textual de city/state/neighborhood (só FK nullable); catálogo só capitais (cities=27,
neighborhoods=0); sem resolver CEP→geo / geocoding no backend; único resolver vivo `findStateByCode(UF)`. Por isso
o blob é fallback transitório de exibição (DECISION-0076). addresses=3, todas com state_id/city_id/lat/lng NULL.

### Escolha (B+D+C sob demanda)

**B** state_id por UF (imediato/barato) + **D** resolver CEP→UF/cidade/IBGE em frente futura (ViaCEP/BrasilAPI;
bairro=texto) + **C** importar `cities` por external_code IBGE **sob demanda** (CEP de município ausente). **lat/lng
default = centroide coarse da cidade**, não coord precisa da residência. SSOT = FK por external_code (IBGE); CEP =
insumo.

### Privacidade / Fronteiras / Vetos

Coord precisa de residência = sensível → RESIDENCE usa **centroide coarse**; geocoding preciso só com decisão de
privacidade (consent/visibility/RLS; addresses não tem RLS hoje). RESIDENCE ≠ actor_active_location ≠ OPERATIONAL
≠ HQ; CEP não é SSOT sozinho. Vetos: coluna textual em addresses; match frágil por nome; residência via
actor_active_location; geocoding preciso de residência sem privacidade; API externa sem frente própria; tocar
PJ/Companies; limpar blob; implementar aqui.

### PJ + Cleanup PF + Sequência

PJ/Companies NÃO devem criar resolver geo paralelo nem assumir city/UF textual canônica (DECISION-0075 §7); usam
o mesmo F-GEO futuro. **F3/F4/F5 do endereço PF BLOQUEADOS** até F-GEO entregar ao menos state_id/city_id (ou
pré-condição DECISION-0076 §2.8); blob permanece fallback. Sequência: D-GEO (esta) → F-GEO-1 (resolver CEP/IBGE)
→ F-GEO-2 (enrich addresses) → F-GEO-3 (core sem blob) → F-GEO-4 (cleanup metadata.address PF) → F-GEO-5 (selo/
close). Docs-only; gates verdes; critical_new=0. DT permanece OPEN.

### Superada por

(em aberto — decisão vigente)

---

## DECISION-0078 — Política de cache/backfill/provider real de CEP (F-GEO-1b)

**Status:** RATIFICADA — OPERACIONAL (D-GEO-1b), DOCS-ONLY; implementação não autorizada (2026-06-02).
**Decisor:** Clayton. **Commit âncora:** HEAD origem `30e46ba9`.
**Documento canônico:** `docs/02_decisions/DECISION_0078_GEO_CEP_CACHE_BACKFILL_POLICY.md`.
**Subordinada a:** DECISION-0077/0076/0074/0020/0021, SSOT_REGISTRY, LGPD. **Vinculada a:**
`DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE` (OPEN). **Escopo:** Location/Geo (compartilhável PF/PJ); NÃO toca PJ.

### Contexto

F-GEO-1a (commit `30e46ba9`) entregou infra geo compartilhável (port CepProvider env-gated; geo-enrichment.service
fail-open; repo find/create city + updateAddressGeo). Provider real é env-gated; gates/testes sem rede. Faltam:
cache persistente (`cep_resolution_cache` ausente) + backfill dos addresses existentes (3 DEV com CEP, state/city
NULL).

### Escolha

F-GEO-1b cria **cache persistente de resolução de CEP** + **script/job idempotente de enrichment** dos addresses
existentes, cache-first, usando a infra 1a. **Sem API externa em migration; sem rede no CI.**

### Cache + Provider + Backfill

**Cache** `cep_resolution_cache` (postal_code UNIQUE, provider, state_code, city_name, city_external_code,
neighborhood_name, street, source, resolved_at, expires_at; `raw_response_hash` opcional). Vetos: raw completo;
coord precisa de residência; cache como SSOT. **Provider:** BrasilAPI preferido (IBGE); ViaCEP fallback; sem real
nos gates; só via env; timeout + fail-open. **Backfill:** script (não migration), idempotente, `postal_code NOT
NULL` + `state_id/city_id NULL`, cache-first, atualiza state_id/city_id/source, cria city por IBGE sob demanda;
sem neighborhood/lat-lng preciso/actor_active_location/cleanup blob.

### PF/PJ + Sequência + Vetos

PF: com state_id/city_id, core poderá parar de depender do blob (F-GEO-3). PJ usa o mesmo resolver/cache (não
implementa aqui; DECISION-0075 §7/0077). Sequência: D-GEO-1b (esta) → F-GEO-1b (migration cache + script + repo/
service cache-first) → F-GEO-2 (enrich) → F-GEO-3 (core sem blob) → F-GEO-4 (bairro + cleanup metadata.address)
→ F-GEO-5 (selo/close). Vetos: API externa em migration; rede no CI; resolver/cache PJ paralelo; city/state texto
em addresses; match frágil sem external_code; raw completo/coord precisa no cache; limpar blob; geocoding preciso
de residência sem decisão LGPD; implementar aqui. Docs-only; gates verdes; critical_new=0. DT permanece OPEN.

### Superada por

(em aberto — decisão vigente)

---

## DECISION-0079 — Política de bairro (neighborhood) no Location Core: texto de exibição, não FK canônica no MVP (D-NEIGHBORHOOD)

**Status:** RATIFICADA — MODELAGEM/POLÍTICA (D-NEIGHBORHOOD), DOCS-ONLY; implementação não autorizada (2026-06-02).
**Decisor:** Clayton. **Commit âncora:** HEAD origem `70f9aa73`.
**Documento canônico:** `docs/02_decisions/DECISION_0079_LOCATION_CORE_NEIGHBORHOOD_POLICY.md`.
**Subordinada a:** DECISION-0077 (§8 vetava coluna textual "sem decisão nova" — **esta é a decisão nova** que
qualifica o veto p/ bairro-exibição), 0076/0074/0020/0021/0078, SSOT_REGISTRY, LGPD. **Vinculada a:**
`DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE` (OPEN), DECISION-0075 §7 (fronteira endereço PJ). **Escopo:** SOMENTE
natureza/destino do bairro no endereço civil PF; NÃO toca PJ/Companies.

### Contexto

Pós F-GEO-3, endereço PF já é SSOT p/ CEP/rua/número/complemento + UF (FK `states.abbreviation`) + cidade (FK
`cities.name`/IBGE). **Só o bairro ainda vem do blob.** Estado material (DEV, read-only): `neighborhoods`=0,
`addresses.neighborhood_id IS NOT NULL`=0, `profiles ? 'address'`=1; `addresses` tem só `neighborhood_id` (uuid FK),
**sem coluna textual**. "Sítio Cercado" (CEP 81920410) só existe em `metadata.address.neighborhood`. Cidade/UF têm
código oficial (IBGE) → FK; **bairro tem só nome** (ViaCEP texto, sem código) → FK por nome seria "match por barbante".

### Escolha — Opção B

`UF/cidade = FK canônica` (autoridade territorial). `bairro = TEXTO DE EXIBIÇÃO controlado no Location Core`, **não
FK, não SSOT territorial**. Destino futuro: coluna textual controlada em `addresses` (ex.: `neighborhood_display_text`),
origem ViaCEP/input; não usar p/ autoridade/fiscalidade/matching/delimitação. Descartadas: **A** (FK por nome —
frágil, vetado 0077 §8); **C** (perder bairro — regressão/perda); **D** (blob indefinido — não converge).

### Justificativa + Consequência

`neighborhoods` vazio; IBGE não codifica bairro; bairro é necessário p/ exibição/endereço postal mas não é autoridade
territorial. **Filosofia:** cidade/UF canônicos por FK; bairro = exibição controlada até existir fonte oficial.
**Cleanup do blob bloqueado** até: (1) criar destino textual; (2) migrar bairro do blob; (3) core parar de ler bairro
do blob; (4) só então remover `metadata.address`.

### Vetos + Sequência

Vetos: neighborhood FK por nome livre; bairro textual p/ autoridade/fiscalidade/matching; limpar `metadata.address`
antes do destino do bairro existir/popular; tocar PJ/Companies; implementar nesta decisão. Sequência: D-NEIGHBORHOOD
(esta) → F-GEO-4a (campo textual de bairro, se ratificado) → F-GEO-4b (migrar bairro blob→Location Core) → F-GEO-4c
(core sem bairro do blob) → F-GEO-4d (cleanup `metadata.address`) → F-GEO-5 (selo/CLOSE). Docs-only; gates verdes;
critical_new=0. **DT permanece OPEN** (esta decisão não fecha a DT).

### Superada por

(em aberto — decisão vigente)

---

## DECISION-0080 — gender como atributo civil do Identity SSOT (global_users.gender), fora do blob (D-GENDER)

**Status:** RATIFICADA — MODELAGEM/IDENTIDADE (D-GENDER), DOCS-ONLY; implementação não autorizada (2026-06-02).
**Decisor:** Clayton ("perfil coleta, identidade guarda"). **Commit âncora:** HEAD origem `c04e1223`.
**Documento canônico:** `docs/02_decisions/DECISION_0080_PROFILE_GENDER_IDENTITY_SSOT.md`.
**Subordinada a:** Constituição/LEIS, LEI_DE_COERÊNCIA, SSOT_REGISTRY, 07_NOMENCLATURA, LGPD. **Vinculada a:**
`DT-PERSONAL-GENDER-BLOB-TO-IDENTITY-SSOT` (OPEN, criada por esta decisão), `DECISION-0062` (CPF SSOT — padrão de
referência, NÃO tocada), `DECISION-0071` (sensíveis — fronteira: gender NÃO é sensível). **Escopo:** SOMENTE `gender`
(PF); NÃO toca CPF/endereço/PJ/Health/Lifestyle/social-targeting code.

### Contexto

`gender` ainda vive em `profiles.metadata.gender` — último campo civil simples da aba Pessoal no blob (endereço já
selado). O código agrupa gender com identity-core (`fullName/cpf/birthdate`): `types/identity.ts:53` ("NUNCA incluir:
fullName, cpf, birthdate, gender"), OnboardingModal/gating, `identity_status`. **Assimetria material:** `global_users`
já tem colunas `full_name/birthdate/cpf`; **gender é o único desses ainda no blob**. DB (DEV): `metadata ? 'gender'`=1
(valor `male`); address=0; metadata null=0; `global_users` sem coluna gender.

### Escolha

`gender` = atributo CIVIL/identity-core (não health, não lifestyle, não sexualOrientation). **Destino canônico =
`global_users.gender`** (coluna no Identity SSOT, simétrica a full_name/birthdate/cpf). Descartados: manter no blob;
`profiles.gender` (cache novo — repete padrão do `profiles.cpf` que a 0062 deprecia); actor_lifestyle/sensível;
Health; CONCEPT/C1. Princípio: "perfil coleta, identidade guarda".

### Valores + Lock + Consumers

**Valores:** enum canônico = `GENDER_VALUES` do contrato (`male|female|other`); `other` MANTIDO (canônico; UI pode
expor só male/female no MVP); `prefer_not_to_say` NÃO adicionar (sem evidência); CHECK por enum, bloquear valor livre;
reconciliar na F2 a inconsistência (runtime honra só male/female em identity_status/lock vs contrato com `other`).
**Lock:** preservar comportamento atual (primeiro save trava; gender imutável; participa de onboarding/identity_status)
— muda o LOCAL, não a REGRA. **Consumers:** core.service (identity_status/score), profile.service (lock/onboarding/
validação), identity.routes (passthrough), social-targeting (demographics, lê via objeto montado), groups gating —
todos passam a ler do Identity SSOT/read-model; objeto montado segue expondo gender (preserva social-targeting).

### Sequência + Vetos

Sequência: D-GENDER (esta) → F1 (migration `global_users.gender` + backfill) → F2 (writers/readers → coluna, strip do
metadata espelhando CPF) → F3 (frontend/contratos s/n) → F4 (cleanup `metadata.gender` com guard fail-closed) → F5
(selo/CLOSE). Vetos: salvar gender no blob pós-frente; criar cache `profiles.gender`; misturar Health/Lifestyle;
tratar como sexualOrientation; usar como CONCEPT; tocar CPF/endereço/PJ; alterar regra de lock; implementar nesta
decisão. Docs-only; gates verdes; critical_new=0. **DT criada OPEN; esta decisão não fecha a DT.**

### Superada por

(em aberto — decisão vigente)

---

### DECISION-0097 — Nascimento e ativação operacional da empresa PJ (modelo canônico)

- **Data:** 2026-06-04
- **Tipo:** arquitetural / institucional
- **ID da violação (se aplicável):** N/A (consolidação institucional; doc em `docs/02_decisions/DECISION_0097_PJ_COMPANY_BIRTH_AND_OPERATIONAL_ACTIVATION.md`)
- **Contexto:** o desenho autoral de Clayton `CRIACAO_DE_EMPRESAS.md` (fora do git) reconcilia as lentes soberana/ontológica e UX/produto do nascimento de empresa PJ. Faltava institucionalizar o modelo como DECISION soberana, sincronizada com o estado vivo pós-0090–0096.
- **Opções consideradas:**
  1. Ir direto para a Fase 3.3 (schema `company_status`/`is_verified`) — REJEITADA: mexer no encanamento antes da planta; a §9.4 do desenho condiciona o shape da 3.3.
  2. Manter o desenho como artefato autoral sem DECISION — REJEITADA: "decisão fora deste log não existe"; sem norma governante a 3.3 não tem base.
  3. Promulgar DECISION docs-only consolidando D1–D10 + sincronizando com o disco — ESCOLHIDA.
- **Escolha:** Opção 3.
- **Justificativa:** institucionaliza o modelo (dois momentos; KYB como SSOT único; 4 eixos independentes; page-actor como eixo; CONCEPT como identidade; "ambos" = dois trilhos via GRAPH) preservando precedência `norma → schema → código` e `identidade antes de comércio`; ratifica DECISION-0075 Opção B (já no código); corrige 3 claims de snapshot contra o disco; não autoriza execução.
- **Consequências esperadas:**
  - Curto prazo: a Fase 3.3 ganha DECISION governante; vocabulário de ativação e domain-selection viram DTs nomeadas (não corrigidas em silêncio).
  - Médio prazo: execuções (3.3 schema; reconciliação de vocabulário; desenho domain-selection) derivam desta DECISION, cada uma sob nova palavra de Clayton.
- **Responsável:** Claude (executor) sob promulgação de Clayton.
- **Validação prévia:** Clayton (desenho autoral + promulgação); verificação read-only `psql` (esta sessão); cadeia 0075/0089–0096.
- **Supera:** nenhuma (ratifica DECISION-0075 Opção B; compatível com 0089/0094/0096).
- **Superada por:** (em aberto — decisão vigente)
- **Referências:** `docs/02_decisions/DECISION_0097_PJ_COMPANY_BIRTH_AND_OPERATIONAL_ACTIVATION.md`; `CRIACAO_DE_EMPRESAS.md` (autoral, fora do git); `EMPRESA_NASCIMENTO_CANONICO`, `02_ACTORS_SSOT`, `18_DOMAIN_ONTOLOGY`, Lei 5/Lei 7; HEAD âncora `0c4abed2`.

---

### SELO DECISION-0097 — leitura integral da Ontologia (prova normativa fechada)

- **Data:** 2026-06-04
- **Tipo:** selo documental / retificação de prova (§2.2.2)
- **Contexto:** a prova da DECISION-0097 (commit `945b5dc6`) declarou honestamente o `18_DOMAIN_ONTOLOGY_UNIFICARD.md` como lido "parcial" (~120/949 linhas). Auditoria read-only posterior leu o documento INTEGRALMENTE (949 linhas).
- **Resultado:** a leitura integral CONFIRMA e reforça D5/D6 da DECISION-0097 (CONCEPT=identidade; GRAPH=relações; N0/N1/N2/categories≠identidade; produtos-e-comercio #4 / servicos #5 distintos; "ambos"=dois trilhos via GRAPH, não hybrid atômico; construcao #13 condicional não-ativado; canonical_product depende de CONCEPT; anti-patterns alinhados). **Nenhuma mudança substantiva.**
- **Veredito:** DECISION-0097 APROVADA sem rework. Gap era PROCEDURAL, não substantivo. Execuções derivadas da 0097 (Fase 3.3 etc.) podem prosseguir somente após este selo, em fatias próprias.
- **Documento:** `docs/02_decisions/SELO_DECISION_0097_ONTOLOGY_FULL_READ.md`.
- **Responsável:** Claude (executor) sob promulgação de Clayton.
- **Supera:** nenhuma (sela/complementa a DECISION-0097; não a altera).
- **Superada por:** (em aberto)
- **Referências:** `18_DOMAIN_ONTOLOGY_UNIFICARD.md` (949 linhas), `DECISION_0097_PJ_COMPANY_BIRTH_AND_OPERATIONAL_ACTIVATION.md`, HEAD âncora `945b5dc6`.

---

### DECISION-0098 — Vocabulário de ativação operacional PJ (par primary_* como SSOT)

- **Data:** 2026-06-04
- **Tipo:** arquitetural / institucional
- **Contexto:** auditoria read-only `F-PJ-OPERATIONAL-ACTIVATION-VOCAB` revelou drift profundo: o par SSOT `(primary_company_type_id, primary_concept_id)` existe e é correto, mas é ILHA (zero caller vivo); o onboarding vivo fala 4+ dialetos (businessType vertical→metadata; businessCategory grosso→metadata; marketplace category incl hybrid→superfícies; company_types verticais no schema), nenhum projetando no par; "hybrid" atômico vivo (anti-padrão D5).
- **Opções consideradas:** (1) wire onboarding→par direto sem DECISION — REJEITADA (cimenta drift; vocabulário ambíguo); (2) empacotar vocab+onboarding+marketplace numa DECISION/execução só — REJEITADA (escopo grande demais; marketplace tem acoplamento real); (3) DECISION docs-only de vocabulário soberano primeiro, execuções derivadas depois — ESCOLHIDA.
- **Escolha:** Opção 3.
- **Justificativa:** o par é a única verdade (DECISION-0097 D5/D6); declarar o dicionário soberano + separar os 2 eixos (N0 × vertical) + marcar hybrid DEPRECATED destrava onboarding/marketplace como frentes próprias sem resolver o marketplace inteiro no escuro. Norma antes de schema/código.
- **Consequências esperadas:** curto prazo — onboarding e marketplace ganham DECISION governante; hybrid marcado deprecated; DTs nomeadas. Médio prazo — onboarding domain-selection (escreve o par), reconciliação marketplace (hybrid→trilhos), simetria de serviços, cada uma sob nova palavra de Clayton.
- **Responsável:** Claude (executor) sob promulgação de Clayton.
- **Validação prévia:** Clayton (promulgação); auditoria read-only de vocabulário; DECISION-0097 + CRIACAO_DE_EMPRESAS.md §9.1-2.
- **Supera:** nenhuma (ratifica/detalha DECISION-0097 D5/D6).
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0098_PJ_OPERATIONAL_ACTIVATION_VOCABULARY.md`; HEAD âncora `6d5dda34`; 18_DOMAIN_ONTOLOGY, Lei 7, REGRA_CANONICA_CRIACAO_DE_CONTEXT.

---

### DECISION-0099 — Governança de publicação/oferta da empresa PJ (publicar ≠ ativar)

- **Data:** 2026-06-04
- **Tipo:** arquitetural / institucional (docs-only)
- **Contexto:** com a ativação operacional completa e provada ponta-a-ponta (catálogo→UI→rota write-pair→`companies.primary_*`, E2E encadeado 22/22), a frente read-only `F-PJ-TENANT-CONCEPT-OFFERINGS` auditou `tenant_concept_offerings`: shape **tenant×concept** (UNIQUE tenant_id+concept_id), sem company_id/page_actor_id/created_by/source/published_at/retired_at/visibility/audit; lido por `marketplace-contextual` (`GET /marketplace/contextual`, descoberta cross-tenant, **sem gate KYB/capability/page-actor**); **sem writer**; a ativação NÃO escreve oferta.
- **Opções consideradas:** (1) writer AUTOMÁTICO na ativação — REJEITADA (publica tenant inteiro sem ato soberano, sem KYB, sem reversibilidade por empresa, colapsa empresas); (2) writer manual sobre o shape atual — REJEITADA (tenant×concept não comporta company-level/audit); (3) ajustar schema primeiro — necessária mas insuficiente sem norma; (4) **DECISION de publicação primeiro** (granularidade+autoridade+KYB+lifecycle) — ESCOLHIDA.
- **Escolha:** Opção 4.
- **Justificativa:** publicar/descobrir ≠ ativar operacionalmente (EMPRESA_NASCIMENTO §8 inerte; SERVICE_CANONICO visibilidade=ato soberano; Constituição Art. III/IV; DECISION-0097 D3 KYB gateia alcance). O shape/writer não podem ser desenhados sem decidir granularidade (company/page-actor-level) e autoridade — senão a tabela cristaliza a norma no escuro.
- **Consequências esperadas:** curto prazo — proíbe publicação automática; classifica `tenant_concept_offerings` como read-model legado; cria `DT-PJ-PUBLICATION-OFFERING-SOVEREIGN-SHAPE-MISSING`. Médio prazo — desenho do shape company/page-actor×concept gated (KYB approved + `company_users` manage + page-actor, reversível, auditável); reader de discovery migra para publicações governadas.
- **Responsável:** Claude (executor) sob promulgação de Clayton.
- **Validação prévia:** Clayton (promulgação); auditoria read-only `F-PJ-TENANT-CONCEPT-OFFERINGS`; DECISION-0097/0098.
- **Supera:** resolve a ambiguidade de DECISION-0098 D9 (tco "candidato a oferta" → apenas read-model; shape soberano é outro). Ratifica/estende 0097/0098.
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0099_PJ_PUBLICATION_OFFERING_GOVERNANCE.md`; HEAD âncora `c72fdd72`; EMPRESA_NASCIMENTO_CANONICO §8, SERVICE_CANONICO, Constituição Art. III/IV, DECISION-0097 D3/D7.

---

### DECISION-0100 — Modelo de schema/writer de publicação/oferta PJ (company_concept_publications)

- **Data:** 2026-06-04
- **Tipo:** arquitetural / técnica / schema governance (docs-only)
- **Contexto:** DECISION-0099 fixou a norma de publicação e autorizou DESENHAR o schema (D11); a frente read-only `F-PJ-PUBLICATION-OFFERING-SCHEMA-WRITER-DESIGN` produziu o desenho e surfou sub-decisões técnicas que a migration cristalizaria no escuro (evoluir tco vs nova tabela; escopo do concept; audit inline vs eventos; linhas legadas; status enum).
- **Opções consideradas:** (1) evoluir `tenant_concept_offerings` — REJEITADA (UNIQUE tenant×concept impede company-level; nome errado; ALTER quebra discovery); (2) nova tabela sem projeção — incompleta (deixa reader órfão); (3) **nova tabela soberana + tco como projeção derivada** — ESCOLHIDA (não quebra discovery; migration aditiva mínima).
- **Escolha:** Opção 3.
- **Justificativa:** ratificar nome/granularidade/escopo/lifecycle/anti-duplicidade/audit/destino-do-read-model ANTES da migration mantém "norma antes de schema" e evita que a tabela decida a arquitetura. Reusa o gate KYB vivo (0088/0094) e a autoridade (`canManageCompany`).
- **Consequências esperadas:** curto prazo — `DT-PJ-PUBLICATION-OFFERING-SOVEREIGN-SHAPE-MISSING` vira GOVERNED/DECISIONED; migration futura autorizável. Médio prazo — schema-migration (`company_concept_publications`), depois writer gated, depois projeção/reader.
- **Responsável:** Claude (executor) sob promulgação de Clayton.
- **Validação prévia:** Clayton (promulgação); desenho read-only `F-PJ-PUBLICATION-OFFERING-SCHEMA-WRITER-DESIGN`; DECISION-0099.
- **Supera:** detalha/executa DECISION-0099 D11 (schema-alvo). Mantém 0099 D2 (writer automático proibido) e D10 (não resolve hybrid).
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0100_PJ_PUBLICATION_OFFERING_SCHEMA_MODEL.md`; HEAD âncora `e5163e60`; `authority-decision.service.ts` (gate KYB), `companies.service.ts` (canManageCompany), `tenant_concept_offerings`, `actors`.

---

### DECISION-0101 — Revogação/perda de KYB approved e cascata sobre publicações PJ

- **Data:** 2026-06-04
- **Tipo:** arquitetural / governança fiscal / publicação (docs-only)
- **Contexto:** o publish exige KYB approved no ATO, mas nada reage se a empresa perde KYB depois — `DT-PJ-PUBLICATION-OFFERING-KYB-REVOCATION-PROJECTION`. As 3 auditorias paralelas (A norma/KYB writer, B publication writer/schema, C discovery/marketplace) convergiram: cravar a regra em norma antes de código, e usar o actor humano do reviewer (não system actor).
- **Opções consideradas:** (1) reader filter primeiro — REJEITADA (mascara publication active inconsistente; SSOT continua errado); (2) system actor (`SYSTEM_ACTOR_ID`) para a retirada — REJEITADA (nasce fantasma com crachá; sem padrão soberano); (3) **DECISION primeiro + actor humano do reviewer + SSOT antes do filtro** — ESCOLHIDA.
- **Escolha:** Opção 3.
- **Justificativa:** KYB approved deve ser gate contínuo (não só no ato); a retirada é autoridade fiscal/institucional (não do dono), auditada pelo reviewer humano; sem actor humano → fail-closed; reaprovação não republica; rebuild/reader não substituem a correção do SSOT. O ato fiscal de sair de approved **nem existe** hoje (só pending→approved|rejected) — precisa vir primeiro.
- **Consequências esperadas:** curto prazo — `KYB-REVOCATION-PROJECTION` vira GOVERNED/DECISIONED; criadas `DT-PJ-KYB-APPROVED-REVOCATION-WRITER-MISSING` e `DT-PJ-KYB-REVOCATION-READER-DEFENSE-MISSING`. Médio prazo — writer de revogação (ato fiscal + cascata atômica), depois reader defensivo.
- **Responsável:** Claude (executor) sob promulgação de Clayton.
- **Validação prévia:** Clayton (promulgação + veredito: reviewer humano, não system actor); auditorias A/B/C; DECISION-0099/0100.
- **Supera:** detalha DECISION-0099 (KYB-gate contínuo) e DECISION-0100 (cascata sobre o SSOT + projeção). Mantém 0100 D10 (rebuild não filtra KYB).
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0101_PJ_KYB_REVOCATION_PUBLICATION_CASCADE.md`; HEAD âncora `e90b3152`; `fiscal-identity-kyb.service.ts`, `company-publications.service.ts`, `authority-decision.evaluatePageActorKybApproved`, `rebuild-tenant-concept-offerings.ts`.

---

### DECISION-0102 — Governança de elegibilidade de domínios de atuação no onboarding PJ

- **Data:** 2026-06-04
- **Tipo:** arquitetura / governança de produto / semântica PJ (docs-only)
- **Contexto:** o fluxo de criação via `CompaniesManager`/`DomainSelector.tsx` oferece **livre escolha por checkbox** de 6 `MarketplaceDomain` (market/services/events/real_estate/vehicles/jobs) — "Uber de ontologia sem volante". Auditoria read-only `F-PJ-ONBOARDING-DOMAIN-ELIGIBILITY` revelou: o write vai para `company_domains` (tabela inexistente, 42P01 engolido pós-commit = ghost); CNAE retornado pela Receita mas descartado; fork `MarketplaceDomain ↔ concepts.domain` N0; nenhuma matriz de elegibilidade (mas derivável de `company_type_allowed_concepts ⋈ concepts.domain`).
- **Opções consideradas:** (1) frontend fix imediato — REJEITADA (ligaria volante a vácuo normativo; ghost remove urgência); (2) criar `company_domains` + religar — REJEITADA (terceira verdade de atuação sem governança); (3) **DECISION docs-only de elegibilidade primeiro** — ESCOLHIDA.
- **Escolha:** Opção 3.
- **Justificativa:** domínio de atuação é derivado de CONCEPT + governado pelo backend (frontend não cria taxonomia, Lei 7). Modelo de 6 camadas (fiscal→identidade→elegível→solicitado→aprovado→em-revisão); CNAE = evidência, não SSOT; Empregos = capability; Imóveis/Veículos = regulados. Norma antes de schema/código.
- **Consequências esperadas:** curto prazo — DomainSelector/ghost declarados drift; criadas DTs `COMPANY-DOMAINS-GHOST-WRITER`, `MARKETPLACE-DOMAIN-VOCABULARY-FORK`, `CNAE-EVIDENCE-NOT-PERSISTED`. Médio prazo — neutralizar DomainSelector → persistir CNAE → derivar matriz de elegibilidade.
- **Responsável:** Claude (executor) sob promulgação de Clayton.
- **Validação prévia:** Clayton (screenshot + veredito "antes de mexer em exposição pública"); auditoria read-only `F-PJ-ONBOARDING-DOMAIN-ELIGIBILITY`; DECISION-0098/0099/0100/0101.
- **Supera:** aprofunda DECISION-0098 (par = SSOT; eixo A N0 × eixo B vertical); ratifica `project_frontend_nunca_cria_verdade` e Lei 7.
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0102_PJ_ONBOARDING_DOMAIN_ELIGIBILITY_GOVERNANCE.md`; HEAD âncora `454d74d3`; `DomainSelector.tsx`, `CompaniesManager.tsx`, `companies.service.ts` (ghost `company_domains` + CNAE descartado), `company_type_allowed_concepts ⋈ concepts.domain`.

---

### DECISION-0103 — Modelo canônico de persistência de CNAE/atividade econômica como evidência fiscal PJ

- **Data:** 2026-06-04
- **Tipo:** arquitetura / identidade fiscal / evidência cadastral PJ (docs-only)
- **Contexto:** o backend já busca CNAE/natureza (`fetchCNPJFromRevenue` → ReceitaWS+BrasilAPI) em `createCompany` + `/fetch-cnpj`, mas **descarta** tudo: `companies`/`fiscal_identities` não têm colunas de atividade. Auditoria read-only `F-PJ-CNAE-EVIDENCE-PERSIST` também achou ghost latente (`companies.service` lê/escreve `main_activity_code`/`secondary_activities` inexistentes → 42703 no update) + risco LGPD (payload bruto com QSA).
- **Opções consideradas:** (1) colunas em `companies` — REJEITADA (projeção, casa errada; revive ghost); (2) snapshot JSONB bruto — REJEITADA (blob vira SSOT paralelo + QSA/LGPD); (3) **tabela 1:N na casa fiscal + colunas 1:1 em fiscal_identities** — ESCOLHIDA.
- **Escolha:** Opção 3.
- **Justificativa:** evidência fiscal mora na casa fiscal (`fiscal_identities`), CNAE é 1:N (tabela `fiscal_identity_economic_activities`), com source/fetched_at, fail-open, sem QSA (LGPD); CNAE é evidência (não SSOT; só sugere). Norma antes de schema.
- **Consequências esperadas:** curto prazo — `CNAE-EVIDENCE-NOT-PERSISTED` vira GOVERNED/DECISIONED; criadas `DT-PJ-COMPANY-ACTIVITY-COLUMNS-GHOST` e `DT-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-MISSING`. Médio prazo — ghost-cleanup → schema-migration → writer → matriz de sugestão → elegibilidade.
- **Responsável:** Claude (executor) sob promulgação de Clayton.
- **Validação prévia:** Clayton (promulgação); auditoria read-only `F-PJ-CNAE-EVIDENCE-PERSIST`; DECISION-0102 (D4).
- **Supera:** executa o degrau 1 (evidência fiscal) de DECISION-0102; ratifica `fiscal_identities` como casa fiscal (0085/0097 D3) e CONCEPT como SSOT (Lei 7).
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0103_PJ_CNAE_FISCAL_EVIDENCE_MODEL.md`; HEAD âncora `e064c36f`; `companies.service.fetchCNPJFromRevenue`, `fiscal_identities`, `companies` (sem activity), mappers/updateCompany (ghost activity), `migrations_archive`.

### DECISION-0104 — Governança da matriz CNAE → suggested concept (sinal de sugestão, não autoridade)

- **Data:** 2026-06-04
- **Tipo:** arquitetura / semântica / onboarding PJ (docs-only)
- **Contexto:** com a evidência CNAE persistida (0103 + schema-migration + writer), falta a matriz que a traduza em sugestão de `concept`. Auditoria read-only `F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX` mapeou o substrato vivo (7 company_types; 7 allowed-concepts 1:1; 137 concepts em 13 N0 sem display name; sem catálogo/seed CNAE no repo) e o precedente normativo de sinais semânticos (RFC RASCUNHO + SEMANTIC_CATALOG_GOVERNANCE).
- **Opções consideradas:** (1) cnae→(type,concept) par — preterida (redundância de type; risco de auto-aplicar par pronto); (2) cnae→prefixo — fallback futuro, não MVP; (3) **cnae→suggested_concept_id, multi-candidato** — ESCOLHIDA; (4) cnae→N0/domain — preterida (grosso; colide com fork); (5) não criar matriz — preterida (evidência subutilizada).
- **Escolha:** Opção 3 (cnae_code → suggested_concept_id).
- **Justificativa:** CONCEPT é alvo/SSOT; company_type derivável via `company_type_allowed_concepts`; multi-candidato + confidence (principal>secundário) + rationale/source/version/review; MVP **seletivo** (7 verticais, sem importar CNAE inteiro); sugestão `pending` + aplicação explícita; **autoativação proibida**; Empregos fora; consultoria/imóveis/veículos sem alvo → revisão/nenhuma. Norma antes de schema.
- **Consequências esperadas:** curto prazo — `DT-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-MISSING` vira GOVERNED/DECISIONED; criada `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING` (OPEN); notas em `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` (matriz alimenta só camada 1→2) e `DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` (não bloqueia a matriz). Médio prazo — schema → seed MVP → read endpoint → wizard suggestion.
- **Responsável:** Claude (executor) sob promulgação de Clayton.
- **Validação prévia:** Clayton (promulgação); auditoria read-only `F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX`; DECISION-0102 (D4/6 camadas) + DECISION-0103 (D10).
- **Supera:** executa a camada de sugestão (1→2) de DECISION-0102 e o D10 de DECISION-0103; ratifica CONCEPT como SSOT (Lei 7), ativação soberana do par (0097/0098) e publicação só após KYB (0099/0100/0101).
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0104_PJ_CNAE_TO_CONCEPT_SUGGESTION_MATRIX.md`; HEAD âncora `6daecd05`; `fiscal_identity_economic_activities`, `concepts`/`company_types`/`company_type_allowed_concepts`, `RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE` (RASCUNHO) / `SEMANTIC_CATALOG_GOVERNANCE`.

### DECISION-0105 — Semântica de `concepts.domain`: dimensão multi-camada legítima (N0 + financeiro RFC C2 + item/SKU)

- **Data:** 2026-06-04
- **Tipo:** arquitetura / ontologia / semântica (docs-only)
- **Contexto:** a frente `F-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` bateu na divergência 12 N0 normativos vs 21 `domains` vivos. Reconciliação live (3 auditorias A/Norma + B/Schema + C/Blast) provou que `concepts.domain` carrega 3 naturezas com status DIFERENTES: N0 de atuação; `financeiro-*` (autorizado RFC C2 + load-bearing no Bank); `item-comercial` (item/SKU, 35 concepts, lastro de canonical_products).
- **Opções consideradas:** (1) documentar multi-camada; (2) legitimar item-comercial como camada própria; (3) absorver item-comercial em produtos-e-comercio — PRETERIDA (conflata mercadoria × tipo de negócio); (4) criar `layer`/`n0_domain` (schema) — adiada; (5) status quo — preterida (DT eterna).
- **Escolha:** **Opção 1 + Opção 2, sem rename e sem schema.**
- **Justificativa:** `produtos-e-comercio`=tipo de comércio/vendedor (5 concepts, usado pelos company_types); `item-comercial`=mercadoria/produto/SKU (35 concepts, canonical_products). Absorver conflataria níveis (`banana-prata` não é "tipo de empresa"). `financeiro-*` é viga (RFC C2 + hardcode Bank) — intocável. Semântica antes de estrutura.
- **Consequências esperadas:** `DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD` → PARTIALLY MITIGATED/GOVERNED (não CLOSED — falta reflexo em 18_DOMAIN_ONTOLOGY). `DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` OPEN mas DESBLOQUEADA. financeiro-* e item-comercial deixam de ser tratados como drift. Próximo: mapeamento MarketplaceDomain.
- **Responsável:** Claude (executor) sob promulgação de Clayton.
- **Validação prévia:** Clayton (promulgação Opção 1+2); reconciliação `F-CONCEPTS-DOMAIN-LAYER-SEMANTICS-READONLY` (A/B/C); RFC C2 (financeiro-*).
- **Supera:** ratifica CONCEPT como SSOT (Lei 7); reconhece RFC C2 (financeiro-*); fixa premissa correta para o fork de marketplace.
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0105_CONCEPTS_DOMAIN_SEMANTIC_LAYERS.md`; HEAD âncora `970a208d`; `concepts.domain`/`domains`, `canonical_products`, `RFC_C2_seed_concepts_financeiros.md`, `bank-integration.service.ts:635`/`concept-financial-resolver.service.ts`, `DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD`.

### DECISION-0106 — Mapeamento canônico `MarketplaceDomain → N0` (fecha o fork de vocabulário)

- **Data:** 2026-06-05
- **Tipo:** arquitetura / ontologia / navegação (docs-only)
- **Contexto:** a 0105 desbloqueou o mapeamento do fork `MarketplaceDomain`(6 rótulos frontend) ↔ N0. FRENTE α (esteira Executora+Batedora): menu verificado contra banco vivo, ratificado por Clayton num pass.
- **Decisão (mapa α):** `market`→`produtos-e-comercio` (+ `item-comercial`=catálogo/SKU); `services`→`servicos`; `events`→`cultura-lazer-e-eventos`; `jobs`=capability (não domínio, 0102 D12); `real_estate`=regulado-sem-alvo (imóveis ausente); `vehicles`=**regulado-sem-alvo (opção b)** — NÃO mapear `mobilidade-e-logistica` (load-bearing do rides via `vehicles.service.ts:17,89 concept_id`; mapear conflataria vender↔operar veículo).
- **Justificativa:** `MarketplaceDomain` não é SSOT (rótulo UI); mapear ≠ dar autoridade; identidade segue em CONCEPT (Lei 7). 3 alvos N0 limpos (5/5/11 concepts); 2 regulados sem N0-alvo; 1 capability. Forçar imóveis/veículos num N0 existente injetaria semântica errada (0105).
- **Consequências:** `DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` → GOVERNED/DECISIONED (não CLOSED — resta consumo downstream: allowed domains 0102 D5, DomainSelector derivar de N0, remover `hybrid` atômico). `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` segue OPEN.
- **Responsável:** Claude (Executora) sob promulgação de Clayton; FRENTE α verificada por Batedora (loop convergente: Executora pegou erro "rides-abstract"; Batedora trouxe evidência load-bearing; Executora confirmou).
- **Validação prévia:** Clayton (ratificação 5 + decisão vehicles b); menu α (read-only) cruzado com banco vivo.
- **Supera:** materializa a reconciliação que DECISION-0102 D11 exigia; ratifica 0105 (semântica multi-camada) e 0102 (D12/D13).
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0106_MARKETPLACE_DOMAIN_TO_N0_MAPPING.md`; HEAD âncora `44e44f34`; `MarketplaceDomain`/`concepts.domain`/`domains`, `vehicles.service.ts:17,89`, `report-rides-vehicles-concept-mapping.ts`, `DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK`.

### DECISION-0107 — Display name de concept mora em `concept_labels` (apresentação governada, não identidade)

- **Data:** 2026-06-05
- **Tipo:** arquitetura / ontologia / apresentação (UX) PJ (docs-only)
- **Contexto:** o read endpoint CNAE→concept e o catálogo de ativação devolvem o **slug técnico**; `CompanyOnboardingWizard.tsx:300` renderiza `c.slug` (usuário vê `varejo-alimentar-especializado-carnes`). Auditoria read-only `F-PJ-CONCEPT-DISPLAY-NAME` (esteira: Batedora montou o menu A/B/C, Clayton decidiu).
- **Opções consideradas:** (A) coluna `concepts.display_name` — REJEITADA (mistura apresentação na identidade; sem locale; re-migração futura = falso barato); (B) **tabela governada `concept_labels`** — ESCOLHIDA; (C) reutilizar campo existente — N/A (não há campo legível vivo).
- **Escolha:** Opção B (`concept_labels`).
- **Justificativa:** CONCEPT continua identidade semântica (Lei 7); slug continua técnico; label é apresentação governada localizada (aterra `18_DOMAIN_ONTOLOGY §5.2.2 display_names`); `concepts` fica seco; label nunca é chave de identidade. Mesma disciplina do "CNAE é sinal, não identidade" (0104).
- **Shape mínimo aprovado:** `concept_labels` (id, concept_id FK, locale default 'pt-BR', context_key default 'default', label, short_label, is_primary, source, timestamps); UNIQUE parcial 1-primary por (concept_id, locale, context_key).
- **Consequências:** `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING` → GOVERNED/DECISIONED (não CLOSED — fecha após schema+seed+endpoints+frontend). Sequência futura: schema → seed pt-BR curado (7 MVP) → JOIN nos endpoints (displayName, fallback null) → frontend `displayName ?? slug`.
- **Responsável:** Claude (executor) sob promulgação de Clayton; menu read-only pela Batedora.
- **Validação prévia:** Clayton (decisão B + shape mínimo + labels MVP); auditoria read-only `F-PJ-CONCEPT-DISPLAY-NAME` cruzada com banco/código vivos.
- **Supera:** aterra o `display_names` de `18_DOMAIN_ONTOLOGY §5.2.2`; ratifica Lei 7 + `project_frontend_nunca_cria_verdade`.
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0107_PJ_CONCEPT_DISPLAY_NAME_GOVERNED_LABELS.md`; HEAD âncora `7725a13f`; `concepts` (sem legível), `CompanyOnboardingWizard.tsx:300`, `suggestConceptForCnae`/`listAllowedConceptsForCompanyType`, `18_DOMAIN_ONTOLOGY §5.2.2`.

### DECISION-0108 — Governança de produto PJ por categoria/ramo pré-moldado (não por vendor-concept)

- **Data:** 2026-06-05
- **Tipo:** arquitetura / ontologia / marketplace (Trilho A) PJ (docs-only)
- **Contexto:** Op1 (`F-PJ-STAGE4-COMPANY-TYPE-BRIDGE`, `28131866`) ligou o Stage 4 na empresa classificada. Ao exercer a ponte (Op2 supermercado), o `product-concept-guard` (`assertProductConceptAllowedForTenant`, em `product.repository.createProduct`) **rejeitou** a materialização → STOP. Auditoria read-only `F-PJ-PRODUCT-CONCEPT-GUARD`: o guard **nasceu antes da 0105** (1º commit `14111f7c` 2026-05-04) e **reconflata camadas**.
- **Problema:** o guard compara `canonical_products.concept_id` (camada **item-comercial**/SKU) × `company_type_allowed_concepts.concept_id` (camada **vendor/atuação**). Por 0105 são camadas distintas → **interseção zero** → rejeita todo produto industrial com `company_type` setado; só "passa" pelo bypass quando `tenants.company_type_id` é NULL (falso-verde). Lê `tenants.company_type_id` (segundo leitor do disconnect que a Op1 corrigiu).
- **Decisão:** a elegibilidade de produto industrial/global para uma PJ é governada por **categoria/ramo pré-moldado** do `company_type` (o recorte por categoria que o store-onboarding já faz via `findCatalogProductsByCategories`), **não** por igualdade `canonical.concept_id` × `company_type_allowed_concepts`. `company_type_allowed_concepts` permanece **vendor-only**. Fonte de company_type no fluxo PJ novo = `companies.primary_company_type_id` (Op1); **não popular** `tenants.company_type_id`.
- **D9 (nuance Clayton — "troca a régua errada, não desliga a segurança"):** **NÃO é no-op global.** Para canonical item-comercial o guard não valida por match vendor; **mas** o produto **ainda** passa pelo recorte de categoria/ramo quando há contexto de company/company_type; **sem recorte e sem contexto → legado/compat ou fail-closed**, nunca liberação ampla.
- **Consequências:** **criada** `DT-PJ-PRODUCT-CONCEPT-GUARD-PRE-0105-LAYER-CONFLATION` (OPEN). `DT-PJ-STAGE4-COMPANY-TYPE-SOURCE-DISCONNECT` permanece PARTIALLY MITIGATED (guard é segundo leitor de tenants → entra no guard-fix). `DT-PJ-CANONICAL-CATALOG-SHARED-ITEMS-NOT-PER-VERTICAL` inalterada (a 0108 aplica-a ao guard). Sequência autorizável: **(2)** `F-PJ-PRODUCT-CONCEPT-GUARD-LAYER-FIX` (code-only; D11: remove a régua errada, preserva recorte, verifica `marketplace-templates`, fail-closed sem contexto, zero Bank) → **(3)** `F-PJ-STAGE4-TRILHO-A-SUPERMERCADO` (Op2). Op2 só volta após 0108 + guard-fix.
- **Bloqueios (D12):** NÃO autoriza alterar guard/código; migration; seed; popular `tenants.company_type_id`; popular item-concepts em `company_type_allowed_concepts`; abrir Op2; mexer em `product_offers`/`canonical_products`; Bank.
- **Responsável:** Claude (executor) sob promulgação de Clayton; auditoria read-only `F-PJ-PRODUCT-CONCEPT-GUARD` pela esteira.
- **Validação prévia:** Clayton (Op-i — governar por categoria/ramo; trocar a régua, não desligar a segurança; "não declarar no-op global sem segurança").
- **Supera:** aplica `DECISION-0105` (camadas multi-natureza de `concepts.domain`) à governança de produto; ratifica `DT-PJ-CANONICAL-CATALOG-SHARED-ITEMS-NOT-PER-VERTICAL` + Op1 + Lei 7.
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0108_PJ_PRODUCT_GOVERNANCE_BY_CATEGORY_BRANCH.md`; HEAD âncora `28131866`; `product-concept-guard.ts` (1º commit `14111f7c`), `product.repository.ts:102`, `canonical_products` (35/35 item-comercial), `company_type_allowed_concepts` (vendor-only), `store-onboarding.service:379`, `marketplace-templates.service:773`, `companies.primary_company_type_id`, `DT-PJ-PRODUCT-CONCEPT-GUARD-PRE-0105-LAYER-CONFLATION`, `DECISION-0105`.

### DECISION-0109 — Trilho B (Serviços/Agenda/Booking): taxonomia própria, fundação Bank-free, availability canônica

- **Data:** 2026-06-05
- **Tipo:** arquitetura / ontologia / serviços (Trilho B) — docs-only
- **Contexto:** raio-x read-only do Trilho B mostrou substrato **existente mas não exercido** (`services`/`bookings`/`service_orders`/`service_discovery_requests`/`service_booking_decisions` = **0 linhas**; só `availability` viva com 32 linhas, todas `owner_type='user'`), `unified_availability` **inexistente** (tabela real = `availability`), **fork de taxonomia** (`company_type` usa `domain='marketplace'`; serviços têm `domain='servicos'` paralelo), **Bank acoplado** em booking/order/payment, e **frontend em endpoints fantasma** (`/services/:id/availability`|`/bookings`). Op3D: DECISION antes de código.
- **Decisão (D1–D8):** (D1) serviço usa taxonomia `domain='servicos'`; `services.category_id` de serviço aponta para taxonomia de serviço, não marketplace. (D2) **NÃO** reusar cegamente a régua da 0108 em serviços sem bridge. (D3) `company_type` pode pré-moldar ramo de serviço, mas exige **bridge explícita** para categorias `domain='servicos'` (não usar slugs marketplace como categoria de serviço). (D4) criação de serviço + agenda **Bank-free**; booking/order/payment/escrow/settlement **bloqueados** até decisão financeira própria. (D5) `availability` (core) é o substrato canônico; endpoints fantasma **não** criam SSOT paralelo (no máximo adapter fino). (D6) serviço PJ governado pelo **page-actor/empresa**, não por user solto; resolver `companyId`/page-actor antes de produção. (D7) **piloto = salão** (serviço puro); **restaurante adiado** (hybrid); peixaria fora. (D8) não confiar no frontend só porque a tela existe.
- **Consequências:** abre 4 DTs OPEN — `DT-SERVICE-RAMO-TAXONOMY-FORK`, `DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED`, `DT-SERVICE-AVAILABILITY-ENDPOINT-DISCONNECT`, `DT-SERVICE-NO-COMPANY-RAMO-BRIDGE`. `DECISION-0108` permanece **restrita a produto** (não estendida a serviço sem bridge). Sequência: (2) `F-SERVICE-TAXONOMY-BRIDGE-READONLY` ou `F-SERVICE-SALON-BANK-FREE-MVP-DESIGN`; (3) caminho Bank-free serviço+availability; booking/payment depois. **Nada de booking/Bank antes das DTs + palavra de Clayton.**
- **Bloqueios:** NÃO autoriza código/schema/migration/seed/endpoint; NÃO toca Bank; NÃO abre Op3A/booking; NÃO usa restaurante; NÃO cria SSOT paralelo de availability; NÃO usa taxonomia marketplace como categoria de serviço; NÃO cria serviço sem governança de empresa/ramo.
- **Responsável:** Claude (executor) sob promulgação de Clayton; raio-x read-only `Op3 READ-ONLY Trilho B` pela esteira (cruzado com banco/código vivos).
- **Validação prévia:** Clayton (Op3D — DECISION antes de código; "serviço não entra pelo mesmo cano do produto; pagamento atrás da porta corta-fogo do Bank").
- **Supera:** ratifica Lei 7 (serviço é eixo semântico próprio, ≠ produto); aplica `project_norma_assintotica` (drift `marketplace-*` em company_type = DT com convergência); fixa a cerca Bank.
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0109_SERVICE_TRACK_B_TAXONOMY_BANKFREE_FOUNDATION.md`; HEAD âncora `92b82afb`; `availability` (32, owner_type='user'), `services`/`bookings`/`service_orders` (0 linhas), `categories.metadata.domain` (16 servicos/15 marketplace), `salao` default slugs (marketplace-*), `services-discovery.service.ts:256`/`service-order.service.ts:1072`/`service-payment-execution` (Bank), `services.routes.ts` (sem `/availability`), `DECISION-0108`/`0105`, as 4 DTs `DT-SERVICE-*`.

### DECISION-0110 — Política financeira de serviços (pré-pago + escrow; KYB segura a saída; ledger é verdade)

- **Data:** 2026-06-06
- **Tipo:** arquitetura / financeiro / serviços (Trilho B) — docs-only
- **Contexto:** a auditoria do fluxo financeiro de serviço achou **rotas de dinheiro já vivas e sem KYB** (`POST /services/request/pay` direto; `/services/payments/:id/execute` escrow; `/services/:serviceId/hire` auto-accept) e múltiplos caminhos (escrow moderno × `payAcceptedRequest` direto × order/release/D-money), com o **código já opinando uma política** (pré-pago+escrow+release pós-confirmação) que nunca foi promulgada. Banco: todas as tabelas financeiras/booking de serviço = 0 linhas (scaffold). Itens stale do relatório NÃO importados (0109 está promulgada; company-canonical aposentada; KYB-revocation fechada; checkout-mock = outra frente).
- **Decisão (D1–D8):** (D1) MVP de serviço pago = **pré-pago com escrow**. (D2) pagamento **direto** cliente→prestador **proibido** no canônico; `payAcceptedRequest` bloqueado/flagado/aposentado; canônico = payment request→execution→Bank→escrow→release. (D3) **booking ≠ obrigação financeira** (reserva temporal); contratação paga exige decision/acceptance/payment request. (D4) **release** exige confirmação do cliente OU timeout **promulgado**; release automático sem política proibido; D-money passa pelo Bank/ledger. (D5) cancelamento/disputa/refund precisam de política; **refund pós-release = frente própria** (DT-PE5). (D6) **KYB approved obrigatório para saída/release** ao prestador PJ; **entrada em escrow = custódia** sem KYB, mas **não** autoriza release/saque/saldo-disponível/sinal-de-aprovação; **saída sem KYB = fail-closed**. (D7) **`bank_ledger` SSOT absoluto**; intent/request/order/booking não são liquidação; saldo só do Bank; split só na cadeia Bank/ledger. (D8) rotas financeiras vivas ficam **declaradas FORA da política até o firewall** — a DECISION **não** fecha runtime; quem fecha é `F-SERVICE-FINANCIAL-FIREWALL-CODE`.
- **Achado a revalidar (não-conclusão):** auth/authz possivelmente fraca em rotas financeiras vivas → revalidar no firewall; a norma aqui é só "rota financeira sem KYB/política fica bloqueada".
- **Consequências:** abre 6 DTs OPEN (`DT-SERVICE-DIRECT-PAYACCEPTEDREQUEST-LEGACY-BYPASS`, `DT-SERVICE-HIRE-AUTO-ACCEPT-POLICY-BREACH`, `DT-SERVICE-PAYMENT-RELEASE-POLICY-MISSING`, `DT-SERVICE-KYB-RELEASE-GATE-MISSING`, `DT-SERVICE-REFUND-DISPUTE-POLICY-MISSING`, `DT-SERVICE-PAYMENT-CURRENCY-FIC-vs-BRL`); `DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED` segue OPEN. **Nenhuma DT financeira fechada.** Sequência: (2) `F-SERVICE-FINANCIAL-FIREWALL-CODE` (fail-closed das rotas vivas) → (3) cadeia canônica (request→execution→escrow→release+KYB). Nada de runtime financeiro antes do firewall.
- **Bloqueios:** NÃO implementa pagamento/booking; NÃO cria worker de release; NÃO toca Bank/escrow/frontend; NÃO expõe rota financeira; NÃO fecha DT financeira; docs-only.
- **Responsável:** Claude (executor) sob promulgação de Clayton; auditoria forense read-only (3 paralelas) cruzada por mim com DB/código vivos.
- **Validação prévia:** Clayton (aprovação + 3 ajustes: DECISION declara fora-da-política, não fecha runtime; escrow-sem-KYB cercado como custódia; auth fraca = achado a revalidar no firewall).
- **Supera:** preenche a decisão que `DECISION-0109` deixou pendente (Bank fora até decisão); aterra `DECISION-0088` (KYB) no caminho de serviço; ratifica Lei 5.
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0110_SERVICE_FINANCIAL_POLICY.md`; HEAD âncora `2431e375`; `services-discovery.service.ts:256`, `service-payment-execution.service.ts:462/641`, `service-hire.routes.ts:37/75`, `service-order.service.ts:873`, `service-payment-request.service.ts:150`, `pj-kyb-gate.ts`; `DECISION-0109`/`0088`, Lei 5, `DT-PE5`, as 6 DTs `DT-SERVICE-*`.

### DECISION-0111 — Política fina de serviço: release, timeout, cancelamento, no-show, disputa, refund, KYB-no-release, split

- **Data:** 2026-06-06
- **Tipo:** arquitetura / financeiro / serviços (Trilho B) — docs-only
- **Contexto:** a `DECISION-0110` deixou D4 (prazo de release) e D5 (cancel/no-show/disputa/refund) como frentes próprias; 3 auditorias forenses read-only confirmaram runtime seguro (firewall `10812621` OFF, substrato 0 linhas, ledger SSOT sem bypass). Faltava a **política fina** antes de qualquer código financeiro — Clayton cravou os defaults do MVP de uma vez.
- **Decisão (D1–D11):** (D1) release por **confirmação do cliente** (prestador sozinho não libera; sempre via Bank/ledger). (D2) **timeout 7 dias corridos** (MVP ajustável), não libera com disputa/KYB-bloqueio/fraude/chargeback/ledger-inconsistente/ordem-inválida. (D3) **disputa trava** o release (motivo/actor/timestamp/estado; manual no MVP). (D4) **cancelamento pré-execução = refund integral do escrow**; pós-execução vira disputa. (D5) **no-show**: cliente→disputa/manual (sem release auto), prestador→refund integral + registro de falha (multa fora do MVP). (D6) **refund pré-release sai do escrow** via Bank/ledger (não apaga payment/order; motor `0052`). (D7) **refund pós-release = recovery/DT-PE5** (não drena escrow alheio; base `0052`/`0053`). (D8) **KYB**: entrada escrow sem KYB (custódia); **saída exige KYB approved**; queda de KYB entre pagamento e release → **escrow bloqueado, fail-closed** (sem release/saque/saldo). (D9) **split** definido antes da execução, vira verdade **só no ledger**, **imutável** após; alíquotas = decisão operacional pendente; não usar metadata de `service_order` como split. (D10) camadas: booking=reserva, payment_request=intenção, service_order=estado, **execution+ledger=início da verdade**, release=etapa separada. (D11) **firewall continua OFF** — não reabre runtime; reabrir só após KYB-gate-method + E2Es fail-first + idempotência + double-entry + escrow hold + release governado + bloqueio de refund pós-release sem recovery.
- **Consequências:** `DT-SERVICE-PAYMENT-RELEASE-POLICY-MISSING` e `DT-SERVICE-REFUND-DISPUTE-POLICY-MISSING` → **GOVERNED/DECISIONED** (política decidida, **não CLOSED** — falta runtime). `DT-SERVICE-KYB-RELEASE-GATE-MISSING` segue OPEN (falta implementação). `COMMERCIAL-FLOW`/`DIRECT-PAYACCEPTED`/`HIRE-AUTO-ACCEPT` seguem PARTIALLY MITIGATED; `CURRENCY-FIC-vs-BRL` OPEN. **Abertas:** `DT-SERVICE-RELEASE-TIMEOUT-RUNTIME-MISSING`, `DT-SERVICE-NO-SHOW-RUNTIME-MISSING`. **Nenhuma DT de runtime fechada.** Sequência: (2) `F-SERVICE-KYB-RELEASE-GATE-METHOD-CODE` → (3) E2Es fail-first → cadeia canônica → reabertura do flag.
- **Bloqueios:** docs-only; NÃO implementa release/refund/dispute/no-show; NÃO toca Bank/escrow/ledger; NÃO migration/worker/rota/frontend; NÃO reabre o flag; NÃO fecha DT de runtime.
- **Responsável:** Claude (executor) sob promulgação de Clayton (defaults do MVP cravados); 3 auditorias forenses read-only consolidadas.
- **Validação prévia:** Clayton (D1–D11 cravadas no go).
- **Supera:** completa `DECISION-0110` (fecha D4/D5); aterra `0088`/`0052`/`0053`/Lei 5 no caminho de release/refund de serviço.
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0111_SERVICE_RELEASE_CANCEL_DISPUTE_REFUND_POLICY.md`; HEAD âncora `10812621`; `DECISION-0110`/`0088`/`0052`/`0053`, Lei 5, `DT-PE5`, `service-order.service.ts:873`, `escrow_payments`, `disputed_at`, firewall `service-financial-firewall.ts`; DTs `DT-SERVICE-*` (2 novas: RELEASE-TIMEOUT-RUNTIME-MISSING, NO-SHOW-RUNTIME-MISSING).

### DECISION-0112 — Storage documental KYB/PJ: provider, port canônico, autoridade e segurança/LGPD

- **Data:** 2026-06-06
- **Tipo:** arquitetura / identidade fiscal (PJ) / storage / LGPD-segurança — docs-only
- **Contexto:** o circuito documental fantasma (`company_documents`) morreu ponta a ponta (`8180a493`/`dd4e202c`); o SSOT (`fiscal_identity_documents`, DECISION-0087) e seu writer/gate KYB estão vivos, mas **sem provider de storage** e **sem porta user-facing** — `F-PJ-KYB-DOCUMENTS-CANONICAL-FLOW` ficou PARTIAL/STOPPED. Achado material: **`uploads/` é servido estático PÚBLICO sem auth** (`app.builder.ts`), `media`=placeholder fake (`storage.example.com`), `group-image`=imagem local — nenhum é provider de documento legal; `COMPLIANCE_REGULATORIO` já marcava "sem gestão documental probatória".
- **Decisão (D1–D13, técnica):** (D1) storage não é `company_documents` (morta, não recriar). (D2) `file_reference` é referência **OPACA**, nunca caminho/URL público nem `/uploads/...`; documento KYB **jamais** em estático público. (D3) **arquivo bruto nunca entra no banco** (sem blob/base64/bytea). (D4) banco guarda só metadado mínimo (file_reference/hash/document_type/submitted_by/timestamps/status já existem; `mime_type`/`size_bytes` = adição futura no port, não agora). (D5) provider acessado por **PORT canônico** (`DocumentStoragePort`), não SDK espalhado (precedente `pix-provider.interface`). (D6) provider local só em **dev**; produção = provider explícito; **ausência em prod = fail-closed** (sem default público). (D7) **upload user-facing exige AUTORIDADE**: `companyId→fiscal_identity_id` + `canManageCompany`/authorized links — posse de ID não basta. (D8) **download/visualização exige autorização separada e auditável**, nunca estático público. (D9) documento **não verifica empresa**: upload não muda `company_status`/`kyb_status`; aprovação KYB só no writer fiscal com gate de docs mínimos. (D10) retenção/exclusão com política (supersede/revocation/retention; sem delete silencioso; append-only auditável). (D11) segurança: MIME/tamanho limitados, hash, anti-path-traversal, sem path público, não confiar no filename. (D12) auditoria de submit/supersede/review/download sensível. (D13) dev vs prod (local só dev; prod explícito; ausência fail-closed).
- **Consequências:** `DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING` → **GOVERNED/DECIDED** (desenho cravado; segue OPEN até runtime). `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` segue OPEN (depende do port + porta user-facing). **Parâmetros de produto NÃO promulgados** (perguntas ao Clayton): provider de produção (S3/GCS/MinIO/...); antivírus obrigatório no MVP?; período de retenção; porta de submit no MVP (dono user-facing vs só admin). Plano futuro (não executado): `F-PJ-DOCUMENT-STORAGE-PORT` → `F-PJ-KYB-DOCUMENTS-USER-SUBMIT` → `F-PJ-KYB-DOCUMENTS-ADMIN-REVIEW-UI` → `F-PJ-KYB-RELEASE-GATE`.
- **Bloqueios:** docs-only; NÃO implementa provider/upload/download/wizard/endpoint; NÃO migration (dev 365); NÃO toca Bank/`fiscal_identity_documents`/SSOT; NÃO recria `company_documents`; NÃO promulga os parâmetros de produto de §7.
- **Responsável:** Claude (executor) sob promulgação de Clayton (diretrizes D1–D13 cravadas no go de `D-PJ-DOCUMENT-STORAGE-PROVIDER`).
- **Validação prévia:** Clayton (envelope com os 16 itens de conteúdo + ordem storage-antes-de-wizard).
- **Supera:** aterra a `DECISION-0087 §3.8` (provider deixado FORA) com o desenho canônico; destrava (em fase futura) `F-PJ-KYB-DOCUMENTS-CANONICAL-FLOW`.
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0112_PJ_DOCUMENT_STORAGE_PROVIDER.md`; HEAD âncora `81fd4d8e`; `DECISION-0087`/`0085`/`0086`, `AUTHORITY_LAW`/`AUTHORITY_ENFORCEMENT_MODEL`, `COMPLIANCE_REGULATORIO_UNIFYBANK`; `fiscal_identity_documents` (mig `20260603140000`), `fiscal-identity-document.service.ts`, `app.builder.ts` (static `/uploads/`), `modules/media` (placeholder), `group-image.service.ts`, `pix-provider.interface.ts`; DTs `DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING`/`DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING`/`DT-PJ-HUMAN-LINK-DOCUMENTS-LGPD-MISSING`.

### DECISION-0113 — ActionContext.actorId é hint não-soberano: autoridade exige binding com o principal autenticado (Opção 3 híbrida)

- **Data:** 2026-06-07
- **Tipo:** arquitetura / autoridade / segurança (autoria & ownership) — docs-only
- **Contexto:** a auditoria READ-ONLY `F-ACTIONCONTEXT-ACTORID-OWNERSHIP-AUDIT` (HEAD `8db09ceb`, 5 sub-instâncias + verificação 1ª mão) confirmou que o `action-context.middleware` popula `req.actionContext.actorId` de header/body/query e valida **só** presença + `scope ⊇ tenantId` — **zero SELECT em `actors`** → actorId **client-declared/spoofável**. O drift é **normativo**: `ACTIONCONTEXT_CONTRACT §4/§6` e `RBAC_V2_CONTRACT §4/§7/§11` **proíbem referenciar `req.user`** (mandam o design spoofável). Amplificador sistêmico confirmado: `rbac.plugin` `requireRole`/`requirePermission` decidem só com o actorId declarado → **todo `requireRole(['admin'])` é spoofável** (incl. KYB admin). Raio: 425 ocorrências / 63 arquivos; primitivo correto já existe (`require-permission.guard`→`canActAs(req.user.id,actorId)`; `kyb-document-submit` via ensureUserActor+canManageCompany).
- **Decisão (D1–D9, Opção 3 híbrida):** (D1) `actionContext.actorId` é **hint operacional não-soberano** — declara, não autoriza. (D2) autoridade soberana exige **`actorId ∈ canActAs(req.user)`** (ownership ou delegação), server-side via `canActAs(tenantId, req.user.id, actorId)`/`canManageCompany`/`ensureUserActor`+vínculo — posse/declaração de ID não basta. (D3) RBAC não decide só com actorId; deve bindar `req.user` antes do lookup de role/permission. (D4) rota user-facing = autoria server-side (`req.user.userId→ensureUserActor→gate`). (D5) leitura sensível também exige binding (sem vazamento cross-user). (D6) system/job/webhook: autoridade vem de credencial de sistema, não de actorId declarado. (D7) **precedência: autoridade > produto** — contratos técnicos subordinados a esta DECISION. (D8) defesa em profundidade: actionContext=hint + rbac.plugin bindado + middleware com binding central + rotas sensíveis com gate (nenhuma depende só do middleware nem só do RBAC). (D9) **sem regressão multi-actor:** binding é `∈ canActAs` (ownership OU delegação), não `actorId==actor-próprio` — actor-first preservado, só falsificação vedada.
- **Emenda dos contratos:** `ACTIONCONTEXT_CONTRACT.md` §3.1/§4/§6.2/§6.3 e `RBAC_V2_CONTRACT.md` §4/§7.1/§11 **superados nos pontos específicos** (banner §0 em cada; texto histórico preservado). A proibição de *inferir* actorId permanece (declara, não adivinha); soma-se "declarar ≠ autorizar".
- **Consequências:** `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` → **GOVERNED/DECIDED** (desenho promulgado + inventário da auditoria persistido), **segue OPEN** até a remediação. Sequência de fatias (governada, não executada): (1) `F-RBAC-PLUGIN-BIND-REQ-USER` (amplificador) → (2) `company-members`/`organization` gates (escalonamento `['*']`) → (3) money LIVE (unifycard/settlement/accounts-*/payment-method) → (4) money LATENTE (services pay/financial-terms; eventos money) → (5) plan/identity-configurations/profile-C1/lifestyle → (6) leitura cross-user. Nenhuma DT de runtime fechada.
- **Bloqueios:** docs-only; **zero** código/migration/Bank/frontend/middleware-runtime/rbac-plugin-code; não fecha o DT; não promulga assinatura/erro-code/e2e de cada fatia; dev 365.
- **Responsável:** Claude (executor) sob promulgação de Clayton (Opção 3 híbrida cravada no go de `D-ACTIONCONTEXT-ACTORID-OWNERSHIP-BINDING`).
- **Validação prévia:** Clayton (go com a escolha da Opção 3 + regra do binding + autorização de emenda do contrato).
- **Supera:** emenda `ACTIONCONTEXT_CONTRACT`/`RBAC_V2_CONTRACT`; aterra `SSOT_REGISTRY §5.1/§5.16`, `AUTHORITY_PRECEDENCE`, `0088`/`0094`/`0112 A4` no caminho de autoria/autoridade do actionContext.
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0113_ACTIONCONTEXT_ACTORID_OWNERSHIP_BINDING.md`; HEAD âncora `8db09ceb`; `action-context.middleware.ts`, `plugins/rbac.plugin.ts`, `require-permission.guard.ts`, `authorization.service.ts::canActAs`, `kyb-document-submit.service.ts`; contratos `ACTIONCONTEXT_CONTRACT.md`/`RBAC_V2_CONTRACT.md`; DT `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`.

### DECISION-0114 — Autoridade inicial sobre o Fundo Regional e sobre AP/AR latente

- **Data:** 2026-06-07
- **Tipo:** autoridade / financeiro (Fundo Regional, Accounts Payable/Receivable) — docs-only
- **Contexto:** o `F-MONEY-LIVE-AUTHORSHIP-MAP` (READ-ONLY, HEAD `04b74909`) concluiu que "money LIVE" é menor que a premissa — a maioria dos services do cluster marketplace é **Proxy stub reject-all** ("migrated to Bank"; LATENTE), e só **3 rotas** escrevem dinheiro de fato (`POST /events/:id/settlement/settle`, `POST /payment-methods`, `POST /unifycard/methods`). Bank boundary intacta (zero SQL `bank_*`). Dois STOPs de autoridade bloqueavam o trilho: Fundo Regional (sem modelo de governança) e AP/AR (sem dono de autoridade; sem `company_id`).
- **Decisão (D1–D5):** (D1) Fundo Regional é da **plataforma/sistema**, não de empresa individual; alimentado por porcentagem/comissão; nenhuma empresa o governa. (D2) autoridade operacional inicial (MVP) = **fundador/criador do sistema** ("Clayton, fundador, resolvido pelo SSOT de identidade/actor existente" — **sem CPF hardcoded, sem criar user/actor, sem novo identificador**). (D3) delegação futura (diretor financeiro/diretoria/conselho/operador) só por **mecanismo formal de authority/delegation** (frente própria; proibida delegação implícita). (D4) AP/AR latente segue a **mesma autoridade inicial** (fundador) enquanto não houver modelo próprio. (D5) reativar AP/AR exige **decisão de modelo** (tenant-finance / company-finance / delegado / híbrido) + gate; até lá **não religar** nem tratar como autorizado por `companyId` implícito/`actionContext.actorId`.
- **Consequências:** `F3.1 — LIVE-NOW` restrita às 3 rotas vivas (cada uma com seu gate); Proxies latentes FORA da F3.1 (religar = gate+E2E no mesmo corte). **Abertas:** `DT-MONEY-LATENT-REACTIVATION-TRAP`, `DT-REGION-FUND-DELEGATION-MODEL-PENDING`, `DT-AP-AR-FINANCE-AUTHORITY-MODEL-PENDING` (todas OPEN). Nenhuma DT de runtime fechada.
- **Bloqueios:** docs-only; **zero** código/migration/Bank/frontend/runtime; não religa Proxy; não cria role/tabela/ledger; não altera `company_status`/KYB; não executa F3.1; não autoriza movimentação financeira. dev 365.
- **Responsável:** Claude (executor) sob promulgação de Clayton (D1–D5 cravadas no go).
- **Validação prévia:** Clayton (autoridade inicial do fundador + bloqueio de reativação cravados no envelope).
- **Supera:** resolve a pendência de autoridade levantada pelo `F-MONEY-LIVE-AUTHORSHIP-MAP`; aterra `DECISION-0113` (fatia 3) e `AUTHORITY_PRECEDENCE` no caminho money.
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0114_REGION_FUND_AND_AP_AR_INITIAL_AUTHORITY.md`; HEAD âncora `04b74909`; `DECISION-0113`/`0020`, `08_AUTORIDADE_CANONICA`, Lei 5; services Proxy do marketplace; rotas vivas event-settlement/payment-method/unifycard-method; DTs `DT-MONEY-LATENT-REACTIVATION-TRAP`/`DT-REGION-FUND-DELEGATION-MODEL-PENDING`/`DT-AP-AR-FINANCE-AUTHORITY-MODEL-PENDING`.

### ADENDO INTERPRETATIVO à DECISION-0113 — Autoria do consentimento de Lifestyle (2026-06-07)

- **Tipo:** adendo interpretativo (NÃO nova DECISION; NÃO altera DECISION-0071) — docs-only.
- **Contexto:** o mapa READ-ONLY da fatia 5 (`F-PLAN-IDENTITY-PROFILE-LIFESTYLE-AUTHORSHIP-MAP`) achou que `DECISION-0071` define o **conteúdo** do consentimento de Lifestyle (explícito/por-campo/privado/anonimizar) mas é **silente sobre a autoria** — quem pode escrever o atributo/consent em um dado `actorId`. Hoje `lifestyle.routes` confia no `actionContext.actorId` declarado → consentimento **forjável** em outro actor.
- **Interpretação cravada (Clayton/ChatGPT):** **DECISION-0113 governa a autoria do consentimento de Lifestyle.** Consentimento (e qualquer escrita/retirada de atributo sensível) só pode ser autorado pelo **principal autenticado representável** (`req.user` + `canRepresentActor(req.user.id, actorId)`), ou por **delegação formal futura**. `performedByActorId`/autoria de audit = **server-side derivada de `req.user`**, nunca o `actionContext.actorId` cru. "Consentimento fabricável por actorId spoofado não é consentimento" — precedência de autoridade (a trava mais restritiva vence; autoria antes de estado).
- **Não-efeito:** **não revoga nem altera** o conteúdo de consentimento/visibility/retenção da `DECISION-0071`; apenas aplica a regra de autoria já promulgada em `DECISION-0113` (D4 rota user-facing = autoria server-side; D5 leitura sensível exige binding) ao caso do consentimento de Lifestyle.
- **Consequência:** `DT-LIFESTYLE-CONSENT-AUTHORSHIP-UNBOUND` (OPEN) é a frente F5.3; lifestyle fica por último (LGPD), com gate antes do consentimento e `performedBy` server-side.
- **Referências:** `DECISION-0113`, `DECISION-0071`, `lifestyle.routes.ts`/`lifestyle.service.ts`, `authorization.service.ts::canRepresentActor`, `DT-LIFESTYLE-CONSENT-AUTHORSHIP-UNBOUND`.

### DECISION-0115 — Decisões-raiz do nascimento humano vertical (G10)

- **Data:** 2026-06-10
- **Tipo:** identidade / actor / perfil / onboarding (nascimento humano PF) — docs-only
- **Contexto:** a auditoria READ-ONLY `F-G10-NASCIMENTO-HUMANO-VERTICAL — FASE B` (PASS da IA Diretora, HEAD `92eb49b4`) provou, contra código vivo e norma, que **a jornada única de nascimento humano é executável com writers canônicos existentes em 5 das 7 fases** (identity, actor fail-closed, perfil, C1 profissional/learning/interest, agenda unified-availability, PJ atômico, leitura de saldo via Bank). **O bloqueio NÃO é implementação — é cartorial/produto:** decisões-raiz não promulgadas (mundo inicial, atomicidade mínima, vocabulário civil, escopo self-owned, exclusão de evento econômico). Achados-âncora: `tenant-per-signup` cria tenant morto por pessoa (`auth.service.ts:217-239`) sem DECISION que governe em qual tenant a PF nasce; identity/actor são best-effort silencioso no register (`:521-526`/`:533-539`); gender 5-input × 3-persistido com evaporação silenciosa (`auth.service.ts:207` × `profile.service.ts:254-258`); `actor_has_permission` = stub fail-closed até FASE 6; PF nasce com capabilities `{}` e wallet on-demand.
- **Decisão (D1–D5):** (D1) PF **não nasce como destino final** em tenant morto individual; nascimento aponta para **tenant inicial vivo**; `tenant-per-signup` legado = trilho transitório a reconciliar. (D2) cadeia mínima `CPF/global_user → user → identity → actor (actor_type='user')` **garantida**, não best-effort silencioso; perfil/interesses/agenda/PJ continuam progressivos. (D3) vocabulário civil de gender passa a **aceitar e persistir 5 valores** (`male·female·non_binary·prefer_not_to_say·other`); nenhum input evapora sem erro/log/mapeamento — **emenda o ponto do enum da `DECISION-0080`** (resto da 0080 vigente; execução = fatia futura). (D4) jornada de nascimento é **self/auth-derived** (sujeito = `req.user`); authority server-side, mas **não depende de RBAC/FASE 6** para o próprio usuário completar o próprio nascimento/perfil/interesses/agenda. (D5) vertical G10 **NÃO inclui evento econômico real** agora (pode preparar prontidão/wallet/read-model, sem mover dinheiro/payout/split/settlement/refund/ledger); evento econômico = frente money-aware própria com três paralelas.
- **Consequências:** registradas como divergências a governar — `identity_status` em memória (`core.service.ts:762-764`) governando onboarding; cura difusa de actor em GET **mais ampla** que os "3 GETs" do G10 (≥10 call-sites via `ensureUserActor`/`getActiveActor`); `onboarding_completed`/`personal_data_locked` em `profiles.metadata` sem evento versionado; `ensureGenesisActorForUser` (`actor_type='actor_human'`) = canal legado/script. **PJ continua correta pela `DECISION-0075`** (page-actor pendente não é drift); **agenda e C1 já têm writers canônicos** (lacuna = costura de jornada). **Abertas/atualizadas:** `DT-HUMAN-BIRTH-TENANT-PER-SIGNUP-DEAD-WORLD`, `DT-HUMAN-BIRTH-IDENTITY-ACTOR-BEST-EFFORT-SILENT`, `DT-GENDER-INPUT-PERSISTENCE-VOCABULARY-DIVERGENCE`, `DT-IDENTITY-STATUS-COMPUTED-IN-MEMORY-ONBOARDING-GATE`, `DT-READ-PATH-ENSUREUSERACTOR-DIFFUSE-CURE`, `DT-ONBOARDING-LOCK-FLAGS-METADATA-NO-EVENT` (todas OPEN); `DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION`/`DT-CORE-PROFILE-GET-CREATES-ACTOR` mantidas/atualizadas. Nenhuma DT de runtime fechada.
- **Bloqueios:** docs-only; **zero** código/migration/banco/frontend; não mexe em `auth/register`/`profile`/actor-writer/company-PJ; não toca Bank/ledger; não libera R2; não libera FASE 6; **não declara `DECISION-0113` fechada**; não vira implementação automática. dev 365.
- **Responsável:** Claude (executora) sob promulgação de Clayton (D1–D5 cravadas no go).
- **Validação prévia:** Clayton (D1–D5 + escopo self-owned + exclusão de evento econômico cravados no envelope; PASS da IA Diretora na FASE B).
- **Supera:** **emenda o enum de `DECISION-0080`** (3→5 valores de gender, no ponto específico; resto preservado); aterra a FASE A da frente `F-G10-NASCIMENTO-HUMANO-VERTICAL`.
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0115_HUMAN_BIRTH_VERTICAL_ROOT_DECISIONS.md`; HEAD âncora `92eb49b4`; `G10_CONSOLIDACAO_EXECUTIVA_ONBOARDING.md`; `CONSTITUICAO_UNIFICARD` (Art. I/V/IX), Lei 5, `LEI_DE_COERENCIA_SISTEMICA §4.8`; `03_IDENTITY_CANONICA`/`02_ACTORS_SSOT`/`CORE_IDENTITY_AND_ACTORS_CONTRACT`/`USER_PROFILE_CONTRACT`/`AGENDA_UNIVERSAL_CONTRACT`/`EMPRESA_NASCIMENTO_CANONICO`; `DECISION-0062`/`0072 B1`/`0075`/`0080`/`0113`/`0114`; `auth.service.ts`/`identity.service.ts`/`actor.repository.ts`/`profile.service.ts`/`core.service.ts`/`actor-registry.service.ts`/`unified-availability.routes.ts`/`companies.service.ts`.

---

### DECISION-0116 — Política canônica de ownership e visibilidade intra-tenant

- **Data:** 2026-06-10
- **Tipo:** arquitetural (identidade/autoridade/visibilidade de recurso) — docs-only (política/produto)
- **Contexto:** a consolidação READ-ONLY de 6 instâncias especialistas (ACTOR-USERS Eixo A+B, BANCO, DINHEIRO, DECISÕES, DT, DOCUMENTOS), sobre o denominador de leituras tenant-wide (clusters 2–8, HEAD `3d8ad25b`), provou contra schema vivo + norma: a **RLS é tenant-scoped por desenho e correta** (isolamento entre tenants, `20260516100000_rls_critical_tables.sql`, 7 tabelas via `app.current_tenant`), mas **não resolve sozinha a visibilidade entre sujeitos do MESMO tenant**. A causa-raiz é a **ausência de política canônica de ownership/visibilidade por classe de recurso**: o isolamento entre pessoas era **acidental** (`tenant ≈ pessoa` no `tenant-per-signup`); `DECISION-0115 D1` aponta a PF para tenant compartilhado → a coincidência colapsa → co-tenants se veem. Vetor = **MISSING-SCOPE** (cliente não declara alvo; reader devolve o tenant), distinto do **HINT-CONFIADO** da 0113. Grep de norma de visibilidade-por-recurso = **ZERO** (vácuo genuíno). Materialidade: todas as tabelas auditadas com **0 linhas** (2 tenants) → vazamentos latentes por dado, vivos por shape.
- **Decisão (classes + mapeamento ratificados):** promulga **8 classes canônicas de visibilidade** — `PUBLIC_TENANT` (público materializado/derivado por regra; ausência de campo ≠ público), `ACTOR_PRIVATE` (representação do actor via 0113), `COMPANY_INTERNAL` (representante ativo com autoridade `company_users.can_*`; membro do tenant ≠ acesso), `GROUP_MEMBERS` (membership server-side em `group_members`; lista de membros não-pública por omissão), `PERSONAL_SENSITIVE` (PII; self/consentimento/representação/admin-compliance; nunca tenant-wide), `INSTITUTIONAL_ADMIN` (cross-tenant; papel institucional explícito; role/capability genérica não autoriza), `MONEY_PARTIES` (financeiro; partes autorizadas + autoridade Bank; frente própria), `DEFAULT_DENY` (sem classe = sem exposição). **Mapeamento:** feed/eventos públicos→PUBLIC_TENANT; grupos→GROUP_MEMBERS (público de grupo público→PUBLIC_TENANT; lista de membros→GROUP_MEMBERS); inventory→ACTOR_PRIVATE (`inventory_movements.actor_id` = dono; nunca tenant-wide por capability default); suppliers→COMPANY_INTERNAL (`created_by_actor_id`=autoria histórica, NÃO ownership; falta owner canônico — definir antes do hardening; não gatear pelo creator); contacts→PERSONAL_SENSITIVE/COMPANY_INTERNAL (tabela **não existe**, `to_regclass`=NULL; não restaurar archive; não materializar sem decisão; não bloqueia C1); daily-metrics→INSTITUTIONAL_ADMIN (sem gate/caller, schema divergente; permanecer inativa/501 até autoridade institucional real); purchase-orders→COMPANY_INTERNAL (preço cents §5.9.1 não vira Bank/M; não pode ficar tenant-wide); escrow→MONEY_PARTIES (partes reais + Bank; frente separada; não bloqueia G10 por 0115 D5); finance-agenda→COMPANY_INTERNAL (projeção) / MONEY_PARTIES (efeito real); projeção ≠ saldo.
- **Enquadramento normativo:** **raiz irmã de `DECISION-0113`** (0113 = actorId declarado/binding/representabilidade hint-confiado; 0116 = escopo de recursos sem identidade-alvo declarada, missing-scope). `DECISION-0115 D1` continua governando o nascimento no tenant vivo. **Nenhum tenant compartilhado pode ser liberado enquanto o denominador Classe A aplicável ao nascimento estiver aberto.**
- **Consequências:** DT-mãe `DT-SHARED-TENANT-RESOURCE-VISIBILITY-NO-OWNERSHIP-POLICY` aberta OPEN; mapa `docs/02_decisions/MAPA_DENOMINADOR_TENANT_SHARED_ISOLATION.md` criado (cobertura honesta AUDITADO/PARCIAL/NÃO-AUDITADO/INCONCLUSIVO/FECHADO-NO-CLUSTER); próxima fatia de código recomendada = `GET /groups/mine` (bug 0113, independe da 0116, sem Bank/migration). MONEY_PARTIES (escrow/finance-agenda) em frente financeira própria (três paralelas).
- **Bloqueios:** docs-only; **zero** código/migration/banco/frontend; não materializa `contacts`; não implementa gate; não libera C1/tenant compartilhado; não libera R2; não libera FASE 6; não declara `DECISION-0113` fechada; não declara o denominador global fechado. dev 365.
- **Responsável:** Claude (executora) sob promulgação de Clayton/IA Diretora (classes + mapeamento ratificados no GO docs-only).
- **Validação prévia:** consolidação READ-ONLY das 6 especialistas (PASS IA Diretora) + ratificação de Clayton no GO.
- **Supera:** nenhuma (decisão inédita; raiz irmã da 0113, não a substitui).
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0116_INTRA_TENANT_OWNERSHIP_VISIBILITY_POLICY.md`; HEAD âncora `3d8ad25b`; `20260516100000_rls_critical_tables.sql`; `supplier.repository.ts`/`contact.repository.ts`/`inventory-movement.repository.ts`/`daily-metrics.service.ts`/`escrow.repository.ts`/`financial-agenda.service.ts`/`groups.routes.ts`; `DECISION-0113`/`0115`/`0021`/`0030`/`0099`/`0100`/`0110`/`0111`/`0094`; `CONSTITUICAO_UNIFICARD` (Art. I); Lei 5; `SSOT_REGISTRY §5.9.1`; `DT-SHARED-TENANT-RESOURCE-VISIBILITY-NO-OWNERSHIP-POLICY`.

### ADENDO A1 à DECISION-0116 — Inventory consolidado da empresa (2026-06-10)

- **Data:** 2026-06-10 · **HEAD origem:** `7c76cfb5` · **Frente:** `F-INVENTORY-COMPANY-CONSOLIDATED-AUTHORITY-IMPL`
- **Decisor:** Clayton (Decisões 1 e 2 cravadas no GO de implementação, após READ-ONLY da frente).
- **Não reabre as classes da 0116** — aplica e detalha o mapeamento de inventory.
- **D1 (autoridade do consolidado):** permissão específica `company_users.can_view_consolidated_inventory` (NOT NULL DEFAULT FALSE, migration `20260610120000`). Projeção consolidada autorizada por vínculo ATIVO em company_users com `can_manage_company` (≡ canManageCompany, incl. role='owner') OU a flag específica. Mesmo tenant NÃO autoriza; `can_manage_marketplace` (capability default de toda company) NÃO autoriza; role textual NÃO autoriza; sem R2/actor_delegations; sem FASE 6. Owner material do estoque permanece `inventory_movements.actor_id` (ACTOR_PRIVATE por actor preservado).
- **D2 (actor elegível empresarial):** critério canônico = `actors.company_id IS NOT NULL` (vínculo material com a empresa). `actor_type='page'` isoladamente NÃO é critério; legado `actor_type='company'` preservado sem regressão. Não inferir vínculo por tenant/creator/role/atividade acidental.
- **Materialização:** rota `GET /marketplace/inventory/company/:companyId/balance` (actors resolvidos server-side por company_id; cliente nunca fornece actorIds → 400; zero explícito sem actors; shape próprio com actorCount/resolvedAt) + autorizador `canViewConsolidatedInventory` + writer admin-gated `setConsolidatedInventoryPermission` (PUT dedicado; auto-concessão vedada — campo fora do PUT self-scoped). E2E 39/39.
- **Resíduo explícito:** rotas tenant-wide legadas (`/inventory/balance`, `/inventory/movements` sem actorId) CONTINUAM no denominador Classe A (`DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE` OPEN); reconciliação em fatia posterior. **Não libera C1/tenant compartilhado.**
- **Referências:** `docs/02_decisions/DECISION_0116_INTRA_TENANT_OWNERSHIP_VISIBILITY_POLICY.md` (ADENDO A1); `docs/03_execution_log/20260610_F_INVENTORY_COMPANY_CONSOLIDATED_AUTHORITY_IMPL.md`; DTs `DT-INVENTORY-COMPANY-CONSOLIDATED-MISSING-ROUTE` (CLOSED) / `DT-INVENTORY-UNIT-ACTOR-ELIGIBILITY-VOCABULARY-DRIFT` (CLOSED) / `DT-COMPANY-USERS-SELF-UPDATE-PERMISSION-ESCALATION` (OPEN, descoberta).

> **RECONCILIAÇÃO CARTORIAL (2026-06-11):** a entrada acima registra `DT-COMPANY-USERS-SELF-UPDATE-PERMISSION-ESCALATION` como "OPEN, descoberta" — estado correto em `7c76cfb5`/`c6bbcae1` (quando foi DESCOBERTA no READ-FIRST). Ela foi **FECHADA (CLOSED) em `ebde8984`** pela frente `F-COMPANY-USERS-SELF-UPDATE-AUTHORITY-ESCALATION-CLOSURE` (allowlist roleDescription; `updateCompanyUser` mass-assignment removido; E2E 33/33; **PASS da Yala** sobre `ebde8984`). O `REMEDIATION_DT_LOG.md` e a `DECISION-0116 ADENDO A1 item 12` já refletem o CLOSED. Esta nota reconcilia o LOG **sem reescrever a entrada histórica** (descoberta `c6bbcae1` → fechamento `ebde8984`).

### ADENDO A2 à DECISION-0116 — Reconciliação dos readers legados de inventory (parcial) (2026-06-11)

- **Data:** 2026-06-11 · **HEAD origem:** `ebde8984` · **Frente:** `F-INVENTORY-LEGACY-READERS-RECONCILIATION-IMPL-PARTIAL`
- **Decisor:** IA Diretora (DEC-A após HARD STOP da enumeração; escopo limitado às 2 rotas nomeadas). Atualiza **apenas o ponto dos readers legados** (item 11 da ADENDO A1); não reabre classes.
- **HARD STOP honrado:** a enumeração (auditoria adversarial + verificação 1ª mão) provou que o galho inventory tem MAIS readers tenant-wide que as 2 nomeadas. A IA Diretora decidiu **fechar só as 2 nomeadas** e manter o galho PARCIAL/OPEN.
- **Fechado nesta fatia (2 folhas):** `GET /marketplace/inventory/balance` → **tombstone 501** (`INVENTORY_TENANT_WIDE_BALANCE_DISABLED`, sem service/query/estado); `GET /marketplace/inventory/movements` → **actorId OBRIGATÓRIO** (400 `INVENTORY_ACTOR_ID_REQUIRED`; canRepresentActor antes do service). Frontend: aba pública "Estoque" REMOVIDA; `getMovements` exige actorId; `CompanyInventoryTab` passa page-actor. Gate de regressão `validate:inventory-reader-scope` (baseline honesto: KNOWN_OPEN explícito, FORBIDDEN_REGRESSION das 2 folhas, NEW_UNCLASSIFIED=0). E2E 32/32 + f6-5-c3 atualizado 12/12.
- **NÃO fechado (KNOWN_OPEN, frentes próprias):** `GET /marketplace/products/visible` (LIVE auth-only, estoque agregado tenant-wide — `DT-INVENTORY-PRODUCT-VISIBILITY-TENANT-WIDE-STOCK-PROJECTION`, decisão merchant/oferta); `/admin/metrics/reconciliation/summary`+`/drift` (LIVE sub-gated, tenantId client-supplied/cross-tenant — `DT-INVENTORY-RECONCILIATION-METRICS-INSTITUTIONAL-AUTHORITY-MISSING`); `/reports/inventory*`+`/reports/transfers/sla` (stub-dead FASE 6 — `DT-RBAC-FAIL-CLOSED-STUB-FASE6-REACTIVATION-TRAP`, escopar antes de ligar RBAC).
- **PROIBIDO declarado:** inventory NÃO está FECHADO-NO-CLUSTER; galho de isolamento de inventory NÃO fechado; inventory NÃO sai do denominador Classe A; C1 NÃO liberado; tenant compartilhado NÃO liberado.
- **Referências:** `docs/02_decisions/DECISION_0116_INTRA_TENANT_OWNERSHIP_VISIBILITY_POLICY.md` (ADENDO A1 item 11 atualizado); `docs/03_execution_log/20260611_F_INVENTORY_LEGACY_READERS_RECONCILIATION_IMPL_PARTIAL.md`; `docs/02_decisions/MAPA_DENOMINADOR_TENANT_SHARED_ISOLATION.md` (inventory PARCIAL); DTs `DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE` (CLOSED) + 2 novas OPEN + RBAC-stub-trap (atualizada); gate `validate:inventory-reader-scope`.

---

### DECISION-0117 — Modelo canônico de catálogo, templates empresariais e oferta

- **Data:** 2026-06-11
- **Tipo:** Produto/Arquitetura (catálogo canônico · variante · serviço · mídia · templates · menu · oferta) — promulgada ANTES do runtime da macrofrente `F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-OFFERING-CLOSURE` (HEAD origem `d865a04d`).
- **Contexto:** READ-FIRST consolidado (3 trilhos) provou: a fundação canônica de produto JÁ EXISTE (cadeia C.1 `product → canonical_product → CONCEPT` viva; 2B global∪scoped; dedup preventivo GTIN/fingerprint; publicação KYB-gated 0099/0100/0101; motor de template em store-onboarding; navegação ontológica /navigation/n2; inventory actor-scoped; unified-availability viva), com vazios reais em: variante material, serviço canônico compartilhado, mídia canônica, templates versionados, menu de módulos projetado e merge curativo. O contrato histórico C.1–C.34 (`PRODUTO_PLANO_MESTRE_COMPLETO.md`) é ÓRFÃO (arquivo ausente do repo/histórico) — a DECISION reancora SOMENTE os contratos comprovados (C.1, 2B, C.22, C.25-pendência, EIXO9-media-caixa) sem fingir recuperação.
- **Decisão (A–H ratificadas por Clayton):** **A** CONCEPT=significado; canonical_product=identidade material compartilhada (sem preço/estoque); canonical_variant=configuração vendável com eixos discriminadores TIPADOS por categoria participando do fingerprint (GTIN distinto ⇒ variante distinta); empresa referencia/ativa/oferta (oferta = page actor + variante + SKU interno + price_cents BIGINT + estoque actor-scoped + condições + localização + status + publicação). **B** INDUSTRIAL: empresa SUGERE → pipeline dedup → pending → curador humano aprova/rejeita/vincula/mescla (empresa NÃO cria global READY); LOCAL: nasce scoped sem GTIN, promoção a global só por curadoria; nenhum writer comercial cura actor. **C** mídia canônica content-addressed (hash/MIME/magic/scan/origem/licença/versão/moderação; mesmo conteúdo = mesmo blob) + mídia empresarial complementar isolada; port-based, molde document-storage PJ; provider produção FORA; images JSONB deixa de ser SSOT. **D** canonical_services (concept_id obrigatório, atributos-base, sem preço/agenda empresarial) + service_offerings (prestador, price_cents, duração efetiva, modalidade, Unified Availability — sem calendário paralelo); booking/pagamento FORA. **E** templates canônicos versionados por REFERÊNCIA, aplicação manual-assistida («Aplicar») auditável (template+versão+empresa+actor+timestamp+recortes); não cria oferta/estoque/preço/autoridade; mudança futura não reescreve empresas. **F** duas navegações: catálogo = ontologia N0/N1/N2 (preservada); módulos = registry backend governado (actor/capability/lifecycle/KYB/template/rota viva); menu não concede autoridade. **G** merge curatorial append-only com duplicate_of/redirect; refs antigas resolvem para o vencedor; sem rewrite destrutivo. **H** unidades canônicas (registry mínimo); incompatíveis NÃO somam/comparam (retornável≠descartável, kg≠un); sem conversão canônica → falhar fechado; conversão automática FORA.
- **Declarações vinculantes:** empresa cria OFERTA não significado · canônico é COMPARTILHADO · template é REFERÊNCIA VERSIONADA · menu é PROJEÇÃO · ZERO financeiro.
- **Bloqueios:** não abre carrinho/pedido/checkout/booking/pagamento; não fecha C.25; não reconcilia MarketplaceDomain↔N0; não reabre 0097–0109/0113/0116; não libera R2/FASE 6.
- **Responsável:** Claude (executora) sob ratificação de Clayton e autorização da IA Diretora.
- **Supera:** nenhuma (consolida e estende; reancora contratos comprovados do plano órfão).
- **Superada por:** (em aberto)
- **Referências:** `docs/02_decisions/DECISION_0117_CANONICAL_CATALOG_OFFERING_MODEL.md`; GO integrado da frente; READ-FIRST da frente; `SEMANTIC_CATALOG_GOVERNANCE.md`; `C.25_SPEC.md`; `RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE.md`; `2B_reconciliation.md`; DECISIONs 0097–0109/0113/0115/0116; DTs vinculadas no documento.

> **ADENDO A1 à DECISION-0117 (2026-06-11, factual):** implementação integral na mesma macrofrente —
> commits A `9ab5233c` (CP1 fundação: variants/services/units/merge/curadoria; e2e 35/35) ·
> B `e551e581` (CP2 mídia content-addressed; 20/20) · C `d44ceade` (CP3 templates versionados +
> distribuidora-de-bebidas; 15/15) · D `70d3df6b` (CP4 ofertas variant-aware + service_offerings c/
> Unified Availability + products/visible merchant-scoped → DT-INVENTORY-PRODUCT-VISIBILITY-TENANT-
> WIDE-STOCK-PROJECTION CLOSED; 16/16) · E `2bc06e73` (CP5 menu projetado de registry + busca
> 1-item→N-ofertas; 13/13) · F (E2E integrado 21/21 + gate audit-canonical-catalog-closure 61/5/0/0/0
> + 8 provas negativas sha-verificadas + cartório). Detalhe no ADENDO A1 do arquivo da DECISION e em
> docs/03_execution_log/20260611_F_CANONICAL_CATALOG_BUSINESS_TEMPLATES_AND_OFFERING_CLOSURE.md.
> Macrofrente tecnicamente concluída — AGUARDANDO RESEAL YALA.

> **ADENDO A2 à DECISION-0117 (2026-06-12, factual — correção do reseal Yala):** o FAIL da Yala
> (único bloqueador: dedup física de mídia ACOPLADA ao registro lógico — tenant B herdava o
> media_asset/metadata de A nos mesmos bytes; file reader sem autorização) foi corrigido pela frente
> F-CANONICAL-MEDIA-BLOB-ASSET-TENANT-ISOLATION-CLOSURE SEM contrariar a Decisão C — materializando-a:
> migration `20260612090000` separa `media_blobs` (FÍSICA: content_hash UNIQUE GLOBAL; sem tenant/
> actor/moderação/licença) de `media_assets` (LÓGICA: FK blob RESTRICT; autoria/origem/licença/
> moderação POR tenant/actor; UNIQUE parcial blob+tenant+criador). Leitura/attach autorizados
> (canônica pública approved+attached / criador canRepresentActor / curador; cross-tenant privado=404);
> compensação ref-count-safe (blob compartilhado jamais apagado); projeção pública sem metadata
> privada. DT-CANONICAL-MEDIA-CROSS-TENANT-METADATA-AND-FILE-LEAK OPEN→CLOSED. Provas: e2e
> adversarial 25/25 (2 tenants HTTP) · CP2 26/26 · integrado 21/21 · provas negativas 6/6 novas +
> 8/8 · gate 68/5/0/0/0 · matriz completa re-verde. Detalhe no ADENDO A2 do arquivo da DECISION e em
> docs/03_execution_log/20260612_F_CANONICAL_MEDIA_BLOB_ASSET_TENANT_ISOLATION_CLOSURE.md.
> Macrofrente segue tecnicamente concluída — AGUARDANDO RE-RESEAL FINAL YALA.

### DECISION-0118 — Identidade contextual de mídia lógica e autoridade polimórfica do owner temporal

- **Data:** 2026-06-12 · **Status:** PROMULGADA (GO macro corretivo integrado da IA Diretora;
  executa correção dos DOIS bloqueadores do reseal Yala) · **Arquivo:**
  `docs/02_decisions/DECISION_0118_MEDIA_CONTEXTUAL_IDENTITY_AND_TEMPORAL_OWNER_AUTHORITY.md`
- **D1 (mídia):** blob físico global ≠ direito de uso. Asset lógico = DECLARAÇÃO CONTEXTUAL —
  identidade inclui blob+tenant+actor declarante+context_type+context_owner+source+purpose+
  licença+provenance (colunas reais + context_fingerprint UNIQUE). Idempotência SÓ com contexto
  integralmente idêntico; idempotency_key reutilizada com payload divergente = 409 observável;
  nenhuma dimensão descartada em silêncio; moderação por declaração; autorização resolve o
  context_owner (empresa), não a representação genérica do autor.
- **D2 (tempo):** availability.(owner_type,owner_id) = RECURSO, não actor. Autoridade resolvida
  server-side por policy polimórfica (resolver central): user/page→próprio actor ·
  service→services.actor_id · service_offering→service_offerings.provider_actor_id ·
  event→events.actor_id · group→groups.owner_actor_id. service_offering entra no enum; CHECK
  físico de owner_type; `as never` proibido; actionContext segue hint (0113) comparado ao
  authority actor resolvido; proibido canRepresentActor(ownerId-recurso) e ownerId como autoridade.
- Fecha (após provas): DT-CANONICAL-MEDIA-LOGICAL-CONTEXT-COLLAPSE e
  DT-UNIFIED-AVAILABILITY-RESOURCE-OWNER-AUTHORITY-CONFLATION.

## DECISION-0121 — Booking→order authority binding canônico (confused-deputy)

**Data:** 2026-06-13 · **Frente:** F-BOOKING-ORDER-BINDING-CANONICAL · **Branch:** rescue-structural

A autoridade da cadeia `booking → decision → service_order` passa a derivar do DONO SOBERANO da
availability (`resolveAvailabilityOwner`, DECISION-0118 D2) + `canRepresentActor` fail-closed, nunca de
`booking.metadata.serviceId` (HINT cliente-declarado, DECISION-0113). Decisão e order: autoria ==
authorityActor + serviço do metadata só aceito se pertencer ao dono (409); `worker_actor_id` = dono
soberano; rota `confirm-booking` usa `req.user.userId` real. Integridade não-financeira (migration
20260613150000): FK + UNIQUE parcial em `service_orders.booking_id`, FK `decision_id`, FK
`bookings.requester_actor_id`. Zero Bank. Detalhe: `docs/02_decisions/DECISION_0121_BOOKING_ORDER_AUTHORITY_BINDING_CANONICAL.md`.
Dívida residual: DT-BOOKING-ORDER-SERVICE-OFFERING-CANONICAL-BINDING (migração plena p/ service_offering).

## DECISION-0122 — service_offering recurso canônico da cadeia decision/order

**Data:** 2026-06-13 · **Frente:** F-SERVICE-OFFERING-CANONICAL-BINDING · **Branch:** rescue-structural

Quando `availability.owner_type='service_offering'`, a OFERTA é o recurso comercial/agendável canônico
da decision/order: coluna NULLABLE `service_offering_id` (FK→service_offerings, SET NULL) em
`service_booking_decisions` e `service_orders` (migration 20260613160000), gravada a partir do SSOT
`availability.ownerId` (NUNCA do cliente; override de valor declarado). provider/worker via
`resolveAvailabilityOwner` (DECISION-0118 D2). `service_id` permanece NOT NULL legado/projeção (Lei 4),
de metadata validado contra o provider — não é autoridade; anti-divergência (409) se a oferta tiver
service próprio. `confirmBookingFromDecision` segue caminho único; POST /service-orders permanece 403.
Detalhe: `docs/02_decisions/DECISION_0122_SERVICE_OFFERING_CANONICAL_BINDING.md`. Resíduo:
DT-BOOKING-ORDER-SERVICE-OFFERING-CANONICAL-BINDING → PARTIAL/CONTAINED (service_id NOT NULL exige
mudança estrutural/produto para ofertas sem service de apoio).

## DECISION-0123 — Modelo de autoridade dispute/reversal HTTP (DECISION_REQUIRED)

**Data:** 2026-06-13 · **Frente:** F-DISPUTE-REVERSAL-AUTHORITY-BINDING-MODEL · **Branch:** rescue-structural

Modelo definitivo documentado; **nada reabilitado**; zero código de rota/Bank/engine/migration. As 4 rotas
seguem 403. **P0 `/reversal`** move dinheiro real (`requestAndExecuteReversalSync`→bank_transactions) com
`authoritySource:'system'` (CORE_ESTORNOS: system=evento externo, NÃO ação HTTP humana) — reabilitar exige
**Core de Aprovação Financeira** + caminho job/evento interno (não HTTP). **P1** (estado puro) não tem
binding simples: sem permission-key canônica (`dispute:*`), sem actor party resolvível (disputa é
operacional/sistêmica), `admin/support` sem papel material fora do RBAC V2 → exige decisão de permission-key
+ política de quem faz reconciliação manual + escopo company/tenant. Ambos = decisão de produto (STOP).
Detalhe: `docs/02_decisions/DECISION_0123_DISPUTE_REVERSAL_AUTHORITY_BINDING_MODEL.md`. Prova: e2e 10/10
(contenções intactas, body.actor ignorado, Bank intocado).

## DECISION-0124 — Classificação A-E dos classic readers params/query.actorId

**Data:** 2026-06-13 · **Frente:** F-0113-CLASSIC-CHANNEL-READERS-BINDING · **Branch:** rescue-structural

9 readers baselineados (0113) classificados na matriz A-E. **2 FECHADOS** com binding canRepresentActor
(self/representado): public-profiles (writes bindados + lista forçada PUBLIC) e marketplace-categories
(/import substitui self-check) → removidos do baseline. **7 BASELINEADOS COM JUSTIFICATIVA** (não
maquiagem): reporting (view_all_ledger cross-actor = filtro autorizado, F-OK), payout/bank-http
(FINANCIAL/BANK hard-stop), business-audit/policy/trust (admin, binding per-actor = DECISION_REQUIRED R2),
risk-dashboard (RESÍDUO PRIORITÁRIO: requirePermission(actorId,actorId) spoofável — fix = corrigir modelo de
permissão, R2/produto, não bindar por cima). Baseline 9→7. Detalhe:
`docs/02_decisions/DECISION_0124_CLASSIC_CHANNEL_READERS_CLASSIFICATION.md`. Prova: e2e 9/9; guard new=0 stale=0.

## DECISION-0125 — Fonte material dos grants finos R2: `company_users.can_*`

**Data:** 2026-06-13 · **Frente:** F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION · **Branch:** rescue-structural

R2 source of fine-grained grants = **`company_users.can_*`** (NÃO RBAC v1 órfão / RBAC V2 ausente /
requireRole genérico / actorId cliente / actionContext / catálogo decorativo). Novo primitivo
`companiesService.canUserPerformCompanyCapability(tenantId, userId, capability, {companyId?})` — subject =
req.user.id (server-side, resolvido p/ global_user_id via JOIN canônico users.global_user_id), autoriza por
`(can_manage_company OR role='owner' OR <coluna whitelisted>)`, vínculo ATIVO, coluna por whitelist fixa,
fail-closed. Migration `20260613170000` +4 colunas booleanas NOT NULL DEFAULT false em company_users
(`can_view_audit_logs`/`can_view_risk`/`can_manage_risk`[reservada]/`can_manage_policy`). Migradas do chain
legado QUEBRADO (organization_members ausente ⇒ 403): reporting (can_view_reports), business-audit
(can_view_audit_logs), risk-dashboard (can_view_risk), policy-engine (can_manage_policy — reads+mutations no
mesmo gate, fecha a divergência da FATIA A; baseline 4→3). Guard Forma C reconhece o primitivo como
safe-binding. Hard stops: zero Bank/payout/reversal/dispute/service-orders; sem RBAC V2/FASE 6; sem
actor_roles/company_roles/grants genéricos; sem frontend; `can_review_disputes`/`can_execute_dispute_action`
documentadas mas NÃO criadas (frente própria). Propriedade conhecida: reads tenant-wide ⇒ grant por qualquer
vínculo ativo no tenant; escopo per-empresa = refino futuro. Detalhe:
`docs/02_decisions/DECISION_0125_R2_COMPANY_USERS_FINE_GRANTS.md`. Prova: e2e 15/15 (DB efêmera, T0..T14);
guard flagged=3/baseline=3/new=0/safe_subject_recognized=4; prova negativa 12/12; gates verdes; tsc 25;
migrations 380→381.

## DECISION-0125 §escopo — grant company-scoped; tenant-wide = DECISION_REQUIRED

**Data:** 2026-06-14 · **Frente:** F-R2-FINE-GRANTS-ANCHOR-AND-SCOPE-CLOSURE · **Branch:** rescue-structural

Reseal Yala PASS COM RESSALVA corrigido. `company_users.can_*`: fonte material R2 mínima, **company-scoped** —
grant em uma empresa NÃO autoriza leitura tenant-wide. `canUserPerformCompanyCapability` fail-closed sem companyId
(`company_scope_required`); owner/can_manage_company supergrant só dentro da empresa escopada. Novo
`resolveCompanyIdForActor` (actors.company_id). Reads tenant-wide (reporting/risk-overview/audit-list/policy-list+mutations)
= fail-closed COMPANY_SCOPE_REQUIRED; reads actor-scoped (risk/actors/:id, audit?actorId, policy/evaluate/:id) = company-scoped.
Platform-admin/tenant-level grant = DECISION_REQUIRED. Âncora: migration 20260613170000 aplicada ao dev → 381/381. Guard
Forma C exige prova de company-scope. Prova: e2e 20/20; neg-proof 13/13; gates verdes; tsc 25. Detalhe:
`docs/02_decisions/DECISION_0125_R2_COMPANY_USERS_FINE_GRANTS.md` (Adendo §escopo).

## DECISION-0126 — Tenant-level operator grants

**Data:** 2026-06-14 · **Frente:** F-R2-TENANT-LEVEL-OPERATOR-GRANTS · **Branch:** rescue-structural

company_users.can_* = company-scoped (nunca tenant-wide). Tenant-wide abre SÓ por `tenant_operator_grants.can_*`
(modelo material SEPARADO). Migration 20260614120000 (tabela + can_view_tenant_reports/audit_logs/risk +
can_manage_tenant_policy; global_user_id→global_users(global_user_id); sem backfill; zero permissão financeira) aplicada
ao dev → 382. Primitivo canUserPerformTenantCapability (subject=req.user server-side; whitelist; fail-closed; grant A≠B;
não consulta company_users). Rotas: reporting→can_view_tenant_reports; risk overview/list→can_view_tenant_risk;
business-audit tenant→can_view_tenant_audit_logs; policy tenant→can_manage_tenant_policy. Actor-scoped permanece
company-scoped. Guard Forma D. platform-wide/cross-tenant + execução financeira = fora do escopo/DECISION_REQUIRED.
Prova: e2e 23/23; neg-proof 17/17; gates verdes; tsc 25. Detalhe: `docs/02_decisions/DECISION_0126_TENANT_LEVEL_OPERATOR_GRANTS.md`.

## DECISION-0127 — Trust tenant-level grants / R2.4 unfreeze

**Data:** 2026-06-14 · **Frente:** F-R2-TRUST-TENANT-GRANTS-R24-UNFREEZE · **Branch:** rescue-structural

Fecha o resíduo trust do baseline 0113 (3→2). requireRole(['admin']) interino substituído por grant material
tenant-level: tenant_operator_grants.can_view_tenant_trust (reads) / can_manage_tenant_trust (mutations/recalculate).
Trust = compliance/risco TENANT-SCOPED; subject=req.user server-side; actorId=alvo; company_users NÃO abre trust;
grant A≠B; zero dinheiro. Migration 20260614130000 (+2 booleanas, sem backfill) aplicada ao dev → 383. Primitivo
canUserPerformTenantCapability estendido (whitelist). Guard Forma D reconhece trust → SAFE_SUBJECT_READERS; baseline 2
(bank-http/payout). bank-http/payout = fora do escopo (Core de Aprovação Financeira). Prova: e2e 32/32; neg-proof 17/17;
gates verdes; tsc 25. Detalhe: `docs/02_decisions/DECISION_0127_TRUST_TENANT_GRANTS_R24_UNFREEZE.md`.

## DECISION-0128 — Core de Aprovação Financeira: grants comuns não executam dinheiro; cartão físico usa o Core

**Data:** 2026-06-14 · **Frente:** F-CORE-FINANCIAL-APPROVAL-DECISION-CARTORIO · **Branch:** rescue-structural · **Tipo:** DOCS-ONLY / DECISION-ONLY

**PROMULGADA / NORMATIVA — runtime NÃO implementado** (implementação depende de frente executora própria). Fecha a decisão
de PRODUTO/autoridade (D1–D10 do READ-FIRST do Core), não a implementação. `company_users.can_*` (company-scoped) e
`tenant_operator_grants.can_*` (tenant-scoped) autorizam operação NÃO-financeira; **qualquer** movimento de dinheiro exige o
**Core de Aprovação Financeira** (request→approval→execution; aplica ATL/KYC/KYB/Guarda/risco/recovery/limites; chama Bank p/
ledger; evento depois). Hierarquia: trava mais restritiva vence (ATL>KYC/KYB>Guarda>IA>Produto); grants subordinados. Domínios
não-financeiros (estoque/PDV/produtos/serviços/CRM/agenda/membros) podem usar grant comum — mas se gerarem cobrança/split/
crédito/comissão/pagamento/payout, entram no Core. Social tem modelo próprio (dono controla; moderação auditável; sem "admin vê
tudo"). Ver saldo ≠ mover dinheiro. Transferência/payout NÃO são botão de `company_users`/`tenant_operator_grants`. Payout:
Core valida saldo real no Bank + recovery obligations + locks + idempotência; `availableBalanceCents` NÃO autoriza saque.
Recovery ativa bloqueia payout (revalidar na transação). Dispute/reversal seguem contidos até o Core. `can_execute_financial_*`
só como primitive interna do Core (nunca grant comum/role/bypass). **Cartão físico futuro** chama o Core (autorização→validação→
hold→liquidação→Bank ledger→evento), nunca o ledger direto; Unificard NÃO guarda PAN/CVV/trilha sensível (no máximo token/
referência/status/limites/trilha de autorização). bank-http/payout **permanecem baseline 0113 = 2** até o Core. Maker-checker/PCI
citados só como analogia de mercado, não norma. Detalhe: `docs/02_decisions/DECISION_0128_CORE_FINANCIAL_APPROVAL_AUTHORITY.md`.

## DECISION-0129 — Autoridade de aprovação de payout (quem solicita, quem aprova, segregação de função)

**Data:** 2026-06-14 · **Frente:** DECISION-PAYOUT-APPROVAL-AUTHORITY · **Branch:** rescue-structural · **Tipo:** DOCS-ONLY

**PROMULGADA / NORMATIVA — approve endpoint NÃO implementado** (autorizado a implementar em frente própria, D14).
Fecha a autoridade de aprovação de payout (resolvia a "autoridade por ausência" do READ-FIRST). D1 SOLICITA =
representante autorizado (canRepresentActor; req.user server-side; já implementado). D2 APROVA = Core Financeiro
institucional por política explícita; company_users/tenant_operator_grants/role/organization_members/actionContext/
x-actor-id/body|query actorId NÃO bastam. D3 segregação de função: requested_by_user_id != approved_by_user_id (4-olhos
mínimo). D4 MVP = 1 aprovação para faixa segura; acima → bloquear/revisão reforçada. D5 multi-approval = futuro (não
fingir). D6 faixas de valor = Clayton define; sem hardcode; amount_cents BIGINT. D7 PF (KYC/destino/ATL) e PJ
(representante/KYB/aprovação) com políticas distintas. D8 trava mais restritiva vence (ATL>KYC>Guarda/recovery>IA>Produto;
recovery ativa/dispute pendente/risco/limite/destino bloqueiam). D9 availableBalanceCents nunca autoriza (revalida na TX).
D10 execução = trilho interno/system (worker→executor→BankTransactionPort→Bank→evento depois; HTTP nunca executa). D11
trilho canônico actor_wallet_payout_requests+actor_wallet (sem seller_available/seller_payout/payout_requests legado).
D12 grants proibidos (can_execute_payout em company_users/tenant_operator_grants; role financial:execute_payout como poder
final). D13 fora: dispute/reversal, cartão, PIX/TED, multi-approval, HTTP-executor. D14 approve endpoint AUTORIZADO pós-
registro: via Core, server-side, requester≠approver, sem dinheiro/Bank/worker, executed:false. Detalhe:
`docs/02_decisions/DECISION_0129_PAYOUT_APPROVAL_AUTHORITY.md`.

## DECISION-0130 — Materialização da política de aprovação de payout (aprovador material, substrato Core, faixa segura MVP)

**Data:** 2026-06-14 · **Frente:** DECISION-PAYOUT-APPROVAL-POLICY-MATERIALIZATION · **Branch:** rescue-structural · **Tipo:** DOCS-ONLY

**PROMULGADA / NORMATIVA — política material NÃO implementada** (autorizada a implementar em frente própria, D12).
**Concretiza** o que a DECISION-0129 deixou aberto (aprovador, substrato Core, faixa de valor) — a lacuna que mantém o
approve endpoint em `PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED`. **D1** aprovador material = operador financeiro institucional
no Core Financeiro (`financial_approval_operator`/`financial_approval_authority`); NÃO valem dono automático/tenant admin/
`company_users`/`tenant_operator_grants`/`organization_members`/role/`financial:execute_payout`/`can_execute_*`/
actionContext/x-actor-id/body|query actorId. **D2** substrato no Core (não RBAC comum): `financial_approval_policies`/
`financial_approval_authorities`/`financial_approval_policy_events` (ou equivalentes canônicos); mín. tenant_id,
global_user_id/user_id server-side, scope=actor_wallet_payout, max_amount_cents, daily_limit_cents, requires_second_approval,
is_active, created_at/revoked_at TIMESTAMPTZ, created_by/revoked_by, reason, trilha append-only. **D3** requested_by_user_id
!= approved_by_user_id (sem exceção). **D4** faixa MVP: **max_amount_cents = 50000** (R$ 500) e **daily_limit_cents = 150000**
(R$ 1.500) — limites de MVP controlado, não final (concretiza 0129 D6). **D5** acima da faixa → não aprovar/executar/
enfileirar → `APPROVAL_POLICY_REQUIRES_MULTI_APPROVAL` (multi-approval = futuro, sem improviso). **D6** PF (KYC/ATL/destino
próprio) e PJ (KYB/representante solicita/operador institucional aprova) com políticas distintas, mesmo teto MVP. **D7**
travas absolutas (ATL/KYC-KYB/recovery ativa/dispute/risco/destino não verificado/valor acima/auto-aprovação) reduzem
elegibilidade a zero; trava mais restritiva vence (ATL>KYC/KYB>Guarda/recovery>IA>Produto). **D8** availableBalanceCents
nunca autoriza (execução revalida no Bank). **D9** auditoria append-only por decisão (approval/payout ids, decision,
approver/requester, policy_id, amount, reason, snapshots risk/kyc/recovery, idempotency); terminal não apagável. **D10**
HTTP approve registra/aprova e retorna executed:false; nunca Bank/worker/executor/ledger/completed; worker system-only
default-off; executor via BankTransactionPort. **D11** grants comuns proibidos como autoridade final. **D12** frente futura
AUTORIZADA `F-PAYOUT-APPROVAL-POLICY-MATERIALIZATION` (substrato + policy resolver configured:true + approve real na faixa +
requester≠approver + bloqueio acima da faixa + auditoria). **Fora:** multi-approval/quórum, PIX/TED, dispute/reversal,
cartão, seller_available. Sem código/migration/runtime nesta DECISION. Detalhe:
`docs/02_decisions/DECISION_0130_PAYOUT_APPROVAL_POLICY_MATERIALIZATION.md`.

## DECISION-0131 — Gramática de autoridade (DECISION-índice: cita 0013→0130, promulga 7 itens novos)

**Data:** 2026-06-14 · **Frente:** DECISION-0131 · **Branch:** rescue-structural · **HEAD vivo:** 20fe30cc · **Tipo:** DOCS-ONLY

**PROMULGADA / NORMATIVA — gramática de autoridade, NÃO plano de código.** DECISION-índice: **CITA** a cadeia (0021/0042/
0113/0114/0116/0119/0120/0121/0124/0125/0126/0127/0128/0129/0130 + AUTHORITY_LAW/AUTHORITY_ENFORCEMENT_MODEL/08_AUTORIDADE/
SSOT_REGISTRY/AUTHORITY_PRECEDENCE) e **PROMULGA só os 7 itens novos**. Rulings de Clayton: **A0=confirmar · B1=B · B2=A ·
B3=A · B4=confirmar · B5=A · B6=deferir · B7=confirmar**, com **3 emendas obrigatórias da executora**. **B1** cargo-template
materializa grants operacionais reais (não SSOT; runtime lê só grant material ativo; `grant_origin` imutável; revogar cargo
cascateia; alterar template não retroage; opção C indireção-viva PROIBIDA) — **EMENDA 1: cargo NÃO materializa
`financial_approval_authorities` (Core-only, seed soberano PORTA-1)**. **B2** vocabulário temporal comum por substrato
(valid_from/valid_until/revoked_at/suspended_at/reason/created_by/revoked_by); tempo-de-autoridade≠agenda; agenda não autoriza
dinheiro; `financial_approval_authorities` mantém lifecycle no Core; `tenant_operator_grants` ganha migration + guard de drift.
**B3** `actor_id` canônico na composição + mapper explícito user_id↔global_user_id↔actor_id — **EMENDA 2: mapper é resolvedor
de COMPOSIÇÃO; NÃO re-keyar o Core financeiro; `financial_approval_authorities` permanece user_id-bound (segregação user-level
0130 D3)**. **B4** member_status=SSOT · is_active=projeção · role='owner'≠supergrant eterno; sequência medir→backfill
can_manage_company→flip→guard. **B5** RLS forçada nos 6 planos de autoridade = **direção promulgada, execução FUTURA** —
**EMENDA 3: pre-flight BLOQUEANTE (validar BYPASSRLS infra + smoke worker/seed/migration sob RLS); manter guards app-level**.
**B6** platform/cross-tenant DEFERIDO (sem `platform_operator_grants`; tenant-scope 0126). **B7** 5 estados (CANÔNICO/
ADAPTADOR_TRANSITÓRIO/CONTIDO_FAIL_CLOSED/TOMBSTONE/DIVERGENTE) + hard-rule de jure (actorId client-declared — 5 canais 0113 +
variante body — nunca autoridade; binding canRepresentActor obrigatório; assertActorRepresentable não-removível; swap do stub
actor_has_permission travado por guard; seed de 1ª authority/delegation/RBAC = ato soberano). **Estado vivo:**
`financial_approval_*`=0/0/0 (fail-closed); `actor_delegations` 9/0-ativas; RLS=0 nos 6 planos; baseline 0113=0. **Portas
soberanas:** PORTA-1 (seed policy/authority) · PORTA-2 (swap stub RBAC) · PORTA-3 (delegação viva) — fora de qualquer GO de
executora. **Fora:** código, migration, seed, RLS aplicada, cargo_templates, mapper, delegação viva, financial seed, platform
authority, cartão físico (≥0132). Cada item §B = frente futura gated (tripé). Sem código/migration/runtime nesta DECISION.
Detalhe: `docs/02_decisions/DECISION_0131_AUTHORITY_GRAMMAR.md`.

---

## DECISION-0132 — Finalidade temporal da agenda pessoal como CONCEPT (coarse-grained, sem novo domínio N0)

- **Data:** 2026-06-16
- **Tipo:** arquitetural (ontologia / CONCEPT)
- **ID da violação (se aplicável):** DT-AGENDA-CONTEXT-WORK-LEISURE-STUDY-NOT-PERSISTED
- **Contexto:** a agenda pessoal (`unified_availability` / tabela `availability`, DECISION-0072 B1) registra janelas de tempo sem significado — o usuário marca horários sem dizer se aquele tempo é trabalho, estudo, autocuidado ou lazer. A DT anterior exigiu persistir a finalidade **via CONCEPT** (nunca metadata/enum/estado visual). O desenho inicial propôs um domínio N0 `tempo-e-finalidade`; o READ-FIRST de `18_DOMAIN_ONTOLOGY_UNIFICARD.md` mostrou que N0 é lista FECHADA de 12 (CONGELADA, §7/§11), que finalidade falha o critério formal de domínio (§3), e que o precedente `causas-sociais` (§8.2) resolve "finalidade" como atributo/dimensão, não domínio.
- **Opções consideradas:**
  1. Opção A — novo domínio N0 `tempo-e-finalidade`. Contras: emenda seção CONGELADA, falha §3, contraria precedente §8.2.
  2. Opção B — 4 concepts em domínios N0 NATURAIS existentes + allowlist; finalidade vive na coluna `availability.purpose_concept_id`; domínio do concept NÃO é limite de matching. Prós: zero emenda à ontologia frozen; norma-canônica; honra a tese "finalidade é camada própria" via coluna+dimensão. **(escolhida)**
  3. Opção C — registrar dimensão transversal formal (§4.1) com infra própria. Contra: pesada para MVP; schema força `concept.domain`∈N0 de qualquer forma → recai em B.
- **Escolha:** Opção B (ratificada por Clayton via ADENDO 2026-06-16).
- **Justificativa:** preserva a ontologia N0 CONGELADA (lista fechada de 12), segue o precedente normativo de "finalidade" (§8.2), mantém CONCEPT como SSOT semântico e `unified_availability` como SSOT temporal, e honra a regra-mãe do ADENDO: agenda = intenção AMPLA do tempo (coarse-grained), categoria da oportunidade = outra camada; `purpose_concept_id` é intenção do tempo, NÃO categoria comercial; domínio do concept não limita o matching futuro.
- **Consequências esperadas:**
  - Curto prazo: agenda ganha finalidade por janela (CONCEPT), lida de volta por slot; estudo/cuidados/lazer protegidos no gate de booking; trabalho/NULL bookáveis. Ontologia N0 intacta.
  - Médio prazo: base semântica para a frente de matching (tempo × finalidade × categoria/janela da oportunidade), sem taxonomia comercial na agenda.
- **Mapeamento canônico (domínios naturais):** `trabalho`→`servicos` · `estudo`→`educacao-e-conhecimento` · `cuidados-pessoais`→`saude-e-bem-estar` · `lazer`→`cultura-lazer-e-eventos`.
- **Responsável:** Clayton / IA Diretora (executor: Claude Opus 4.8).
- **Validação prévia:** Clayton + auditoria READ-ONLY (F-AGENDA-PERSONAL-TIME-PURPOSE-CANONICALIZATION) + ADENDO Clayton 2026-06-16.
- **Supera:** nenhuma (complementa DECISION-0072; resolve DT-AGENDA-CONTEXT-WORK-LEISURE-STUDY-NOT-PERSISTED).
- **Superada por:** —
- **Referências:** `docs/02_decisions/DECISION_0132_TEMPORAL_PURPOSE_CONCEPT.md` · `18_DOMAIN_ONTOLOGY_UNIFICARD.md` §3/§4.1/§7/§8.2/§11 · migrations `0069_concepts`/`0073_domains_n0`/`0074`/`0075_concept_governance_trigger` · `backend/src/core/availability/*` · `REMEDIATION_DT_LOG.md` (DT-AGENDA-CONTEXT).

---

## DECISION-0133 — Suppliers company-owned via `owner_actor_id`

- **Data:** 2026-06-16
- **Tipo:** arquitetural (ownership)
- **ID da violação (se aplicável):** DT-SHARED-TENANT-RESOURCE-VISIBILITY-NO-OWNERSHIP-POLICY (classe A — suppliers); lacuna deferida por DECISION-0116
- **Contexto:** Evidence Pack (revalidado 1ª mão, dev 389, HEAD `ebe410b4`) provou: `suppliers` existe, `row_count=0`, schema tem `tenant_id`+`created_by_actor_id`+`created_by_user_id` mas **NÃO** tem `owner_actor_id`/`company_id`/`user_id` (owner material ausente). `created_by_actor_id` é autoria/auditoria, não ownership; readers tenant-only por shape. RLS não é prova de autoridade enquanto a app conecta como postgres/superuser/bypassrls. DECISION-0116 classificou `suppliers`=COMPANY_INTERNAL e **deferiu** a definição do owner canônico ("não gatear pelo creator; definir antes do hardening").
- **Opções consideradas:**
  1. tenant-wide — vazaria B2B entre empresas do mesmo tenant. ❌
  2. creator-owned (`created_by_actor_id`) — congela autoridade no autor histórico; quem digitou ≠ quem governa. ❌
  3. user-owned (`created_by_user_id`) — usuário pode ter N empresas; fornecedor é institucional, não pessoal. ❌
  4. **company-owned via `owner_actor_id`** (page/company actor da empresa dona) — institucional, sem dupla verdade, espelha `purchase_orders.owner_actor_id`, alinha a `canRepresentActor`. **(escolhida)**
- **Escolha:** Opção 4 — `owner_actor_id` (page/company actor; `actor_type='page' AND company_id IS NOT NULL`).
- **Justificativa:** supplier é cadastro institucional da empresa; um usuário pode ter várias empresas; tenant-wide vaza B2B; creator-owned congela autoridade; espelha o precedente PO owner_actor_id; evita dupla verdade `company_id`+`owner_actor_id` (deriva-se de actor→company); alinha autoridade runtime futura a `canRepresentActor(owner_actor_id)`.
- **Consequências esperadas:**
  - Curto prazo: nenhuma alteração runtime/schema (docs-only). Promulga o owner ANTES de migration.
  - Médio prazo: F-SUPPLIERS-OWNER-ACTOR-SCHEMA-WIRING (futura) adiciona a coluna+FK+índice, revalida `row_count` (0→NOT NULL ok; >0→STOP/backfill determinístico), e gateia create/read/update/delete/list por `canRepresentActor(owner_actor_id)`. `created_by_actor_id`=audit; `tenant_id`=escopo; RLS não substitui authority app-level.
- **Mapeamento canônico:** owner=`owner_actor_id` (page/company actor) · `created_by_actor_id`=autoria · `created_by_user_id`=não-authority · `tenant_id`=escopo · `supplier_id`=contraparte/referência.
- **NÃO decidido:** contacts/CRM genesis · RLS hardening · DB app role (bypassrls) · RBAC/FASE 6 · delegação/cargo · AP/Bank/Core · suppliers runtime/migration/backfill.
- **Responsável:** Clayton / IA Diretora (executor: Claude).
- **Validação prévia:** Clayton + Evidence Pack suppliers (revalidado vivo).
- **Supera:** nenhuma (preenche a lacuna deferida por DECISION-0116; complementa DECISION-0131/PO owner).
- **Superada por:** —
- **Referências:** `docs/02_decisions/DECISION_0133_SUPPLIERS_COMPANY_OWNED_OWNER_ACTOR_ID.md` · `DECISION-0116` (classificação+deferral) · `DECISION-0131`/`F-C1-MONEY-PO-OWNER-ACTOR-SCHEMA-WIRING` (precedente owner_actor_id) · `DECISION-0113` (canRepresentActor) · `DECISION-0115 D1` (tenant compartilhado) · `DT-SHARED-TENANT-RESOURCE-VISIBILITY-NO-OWNERSHIP-POLICY` · `DT-APP-DB-ROLE-BYPASSRLS-RLS-INERT` (RLS inert) · suppliers schema vivo (tenant_id+created_by_actor_id+created_by_user_id; sem owner; row_count=0).

---

## DECISION-0134 — Actor referral como lookup + baseline de capability grants

- **Data:** 2026-06-16
- **Tipo:** arquitetural / autoridade / baseline (DOCS-ONLY)
- **Frente:** F-AUTHORITY-PERMISSIONS-CLOSURE-BASELINE · **HEAD:** `957aeb32` · **dev:** 390 (sem migration)
- **Contexto:** fechamento documental da família authority/permissões após a rodada DECISION-0113/write-authorship + containments schema-ghost (service-order/service-bundle CORRIGIDOS; votes/contextual-thread/organization CONTIDOS). Necessidade: promulgar (a) o papel do código de indicação, (b) o modelo de autoridade, (c) uma matriz inicial de capabilities — **respeitando `07_NOMENCLATURA_CANONICA`**.
- **Decisão:**
  1. **Código de indicação = chave humana de lookup do actor** (não pertence a CPF/CNPJ; CPF/CNPJ originam N actors; único por actor; localiza o actor; **NÃO** é authority; **NÃO** substitui `actor_id` nem `canRepresentActor`). Permissão é concedida ao `actor_id` resolvido. Frase canônica: *"O código de indicação é uma chave humana de acoplamento ao actor; a autoridade continua sendo actor_id + grants + canRepresentActor/delegação/owner derivado."*
  2. **Cargos/funções = templates de capabilities**, não a fonte primária; verdade primária = `actor_id` + grants.
  3. **Matriz inicial de capabilities** (17 domínios) promulgada como **BASELINE conceitual expansível**, na **forma canônica `domain:action`** (colon, snake_case) — alinhada ao `permission-keys.ts` vivo e ao 07 §4.74 (`scope` `read:users`). **Proibido** vocabulário pontilhado paralelo (07 §3). Classes de risco LOW/MEDIUM/HIGH/CRITICAL; financeiro = CRITICAL (checkbox não move dinheiro; exige Bank/ledger/idempotência/locks/3 paralelas).
- **Conformidade 07 (chave da frente):** forma `domain:action` adotada; mapeamento determinístico de nomes pontilhados (`inventory.stock_in.approve`→`inventory:stock_in_approve`); por **§3.2** (nenhum nome nasce no doc/código e é ratificado depois), a **grafia final** das chaves + a **reconciliação `finance:`↔`financial:`** (vivo em permission-keys.ts) ficam para `SSOT_REGISTRY → 07 → RFC` na frente de implementação. Baseline ≠ enforcement.
- **Escolha:** baseline docs-only; sem ativar grants/RBAC/UI/código de indicação.
- **Consequências esperadas:** curto prazo nenhuma (docs-only); médio prazo nova frente de **implementação runtime de grants** (tabela de grants contra `actor_id`, resolver de código de indicação, enforcement) + UI de checkboxes + templates de cargo — todas gated, pós-RFC de nomenclatura.
- **NÃO decidido:** implementação de grants · resolver/tabela do referral · UI · cargos/role system · ativação votes/contextual-thread/organization · montagem organizers · grafia final SSOT_REGISTRY das chaves · `move_money` · RBAC/FASE 6 · RLS · migration/schema · frontend.
- **Responsável:** Clayton / IA Diretora (executor: Claude). **Validação prévia:** Clayton.
- **Supera:** nenhuma (consolida/baseline; complementa DECISION-0113/0131).
- **Superada por:** **DECISION-0139 (parcial)** — actor-scoped referral **code & earnings** (posse econômica por `owner_actor_id`, destino de earnings em `actor_wallet`, vetor `body.referral_code` travado, estado material USER_ONLY). A §2 da 0134 (código pertence ao actor; lookup, não authority) **permanece vigente**.
- **Referências:** `docs/02_decisions/DECISION_0134_ACTOR_REFERRAL_CAPABILITY_GRANTS_BASELINE.md` · `07_NOMENCLATURA_CANONICA` (§3, §4.74) · `permission-keys.ts` · `DECISION-0113`/`DECISION-0131` · execution logs da rodada · `DECISION-0133`.

---

## DECISION-0135 — RFC de nomenclatura canônica de permission keys

- **Data:** 2026-06-16
- **Tipo:** arquitetural / nomenclatura / RFC (DOCS-ONLY)
- **Frente:** F-PERMISSION-KEYS-NOMENCLATURE-RFC · **HEAD:** `337a3c52` · **dev:** 390 (sem migration)
- **Contexto:** ratifica a nomenclatura prometida por DECISION-0134 §1.4 (SSOT_REGISTRY→07→RFC) ANTES de implementação de grants. READ-FIRST de `permission-keys.ts` (33 keys vivas) fundou as reconciliações em fato, não suposição.
- **Decisão (promulgada):**
  1. **Gramática canônica:** `<domain>:<action>`, exatamente um `:`, ambos lowercase snake_case; proibido `domain:sub:action`, pontilhado e invertido (`read:object`).
  2. **Ordem da action = `object_verb`** quando há subobjeto (ex.: `inventory:stock_in_create`, `financial:payout_approve`); verbo simples quando ação simples (`service_order:confirm`). Keys vivas em `verbo_objeto` (view-first/execute-first) = **LEGACY_ALIAS** até cutover.
  3. **Reconciliações (fundadas no vivo):** `finance:`→**`financial:`** (financial é o domínio vivo; finance nunca existiu) · temporal canônico = **`calendar:`** (vivo; agenda/booking não são keys) · **`canonical_products:`** vivo (catálogo N0) × `products:` comercial = conceito distinto, NÃO duplicate, PRODUCT_DECISION_REQUIRED · `pos` recomendado (sem key viva; pdv→pos se surgir) · invertido `read:`/`write:` proibido · `suppliers:credit_*` object_verb.
  4. **Classes:** CANONICAL_READY / LEGACY_ALIAS / NEEDS_RENAME / DUPLICATE_CONCEPT / CRITICAL_FINANCIAL / PRODUCT_DECISION_REQUIRED / DO_NOT_IMPLEMENT_NOW. votes/organization/contextual-thread = DO_NOT_IMPLEMENT_NOW (ghost contido).
  5. **CRITICAL_FINANCIAL** (financial/financial_terms/split/cards/cash_drawer/customer_credit/suppliers:credit_/pos refund/purchase_orders money): capability autoriza tentativa; execução exige bank_ledger SSOT + transação + lock + idempotência + auditoria + evento + 3 paralelas.
  6. **Código de indicação** reafirmado (lookup, não authority). Frase: "O código de indicação localiza o actor; o grant autoriza o actor; o enforcement valida actor_id + authority."
- **NÃO muda runtime:** `permission-keys.ts` intocado; zero alias runtime; zero grant; zero enforcement novo; cutover de aliases = frente futura.
- **Escolha:** RFC docs-only; gramática + reconciliações + aliases + classes promulgados como baseline normativo.
- **NÃO decidido:** grafia de `financial:all_ledger_view`; conceito `booking:`; existência runtime de `products:` comercial; cutover; implementação de grants; RBAC/FASE 6; financeiro.
- **Responsável:** Clayton / IA Diretora (executor: Claude). **Validação prévia:** Clayton.
- **Supera:** nenhuma (ratifica a nomenclatura deferida por DECISION-0134).
- **Superada por:** —
- **🟢 RESEAL YALA = PASS (2026-06-16, adversarial READ-ONLY).** Commit material `6dee2ea7`. Yala confirmou: formato `<domain>:<action>`; action `object_verb` p/ subobjeto; chaves vivas preservadas; `permission-keys.ts` intocado; aliases apenas documentais; zero runtime/grants; referral = lookup (nunca authority); financeiro CRITICAL (não checkbox executável); ghost = DO_NOT_IMPLEMENT_NOW. **Warnings não-bloqueantes:** W1 — `financial:execute_payout` tem capability viva `can_hold_assets`; cutover→`financial:payout_execute` NÃO é cosmético (money-path) → exige frente própria + gates + neg-proof + e2e + 3 paralelas. W2 — `products:` permanece PRODUCT_DECISION_REQUIRED (não declarar runtime até separar `canonical_products:*` N0 × `products:*` N1/N2). **DECISION_PENDING:** `financial:all_ledger_view` · `booking:` · `products:`. Estado final: **CLOSED / YALA PASS**.
- **Referências:** `docs/02_decisions/DECISION_0135_PERMISSION_KEYS_NOMENCLATURE_RFC.md` · `07_NOMENCLATURA_CANONICA` (§3, §3.2, §4.74) · `permission-keys.ts` · `DECISION-0134` · `DECISION-0113`/`DECISION-0131`.

---

## DECISION-0136 — Substrato de capability grants por actor (`actor_capability_grants`)

- **Data:** 2026-06-16
- **Tipo:** arquitetural / autoridade / materialização (Slice 1A)
- **Frente:** F-ACTOR-CAPABILITY-GRANTS-SCHEMA-AND-NONFIN-ENFORCEMENT-SLICE-1 · **parent:** `127525d2` · **dev:** 390→**391**
- **Contexto:** materializa o modelo de grants prometido por DECISION-0134 (referral=lookup; grants contra actor_id) + DECISION-0135 (key `domain:action`). READ-FIRST provou que `calendar:block` é key não-roteada e que a rota viva de availability tem gate SELADO (DECISION-0113/0118, "Sem admin escape") → IA Diretora escolheu **Slice 1A só** (substrato, SEM enforcement).
- **Decisão:** cria tabela `actor_capability_grants` (grantee_actor_id × capability_key × scope_actor_id) + service/repository/resolver. Invariantes: lookup por `actors.slug` (NUNCA `users.referral_code` comercial); grant por actor_id; representar≠capability; owner nativo + grant aditivo; concedente representa o escopo (`canRepresentActor`); multi-tenant isolado; grants nascem inexistentes; allowlist NÃO-financeira (`calendar:block/unblock`, `services:create/edit/disable`); sem `scope_type='global'`. **`hasCapabilityGrant` definido mas NÃO aplicado a rota.**
- **NÃO feito:** enforcement em rota de negócio (availability owner-only intocado → DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION OPEN); endpoints HTTP (Slice 1B); UI; cutover permission-keys.ts; reconciliação de vocabulário.
- **Provas:** tsc 25/43; guard `audit-actor-capability-grants-nonfinancial.mjs` na chain regression-guards; neg-proof 5 mordidas + SHA256; e2e efêmero 13/13; 4 gates verdes; Bank intocado.
- **NÃO tocado:** financeiro/Bank/ledger · `permission-keys.ts` · `business-permissions.types.ts` · frontend · votes/organization/contextual-thread · RBAC/FASE 6 · `users.referral_code` · availability.
- **Responsável:** Clayton / IA Diretora (executor: Claude). **Validação prévia:** Clayton (escolheu Slice 1A após STOP).
- **Supera:** nenhuma (materializa DECISION-0134/0135).
- **Superada por:** —
- **🟢 RESEAL YALA = PASS (2026-06-16, adversarial READ-ONLY).** Commit material `1e61c83b`. Yala confirmou: Slice 1A não alterou autoridade de negócio; zero rota com enforcement; zero endpoint HTTP; availability/calendar intocado; grants por actor_id; lookup por `actors.slug` (`users.referral_code` proibido/ausente); slug sem unicidade mitigado por resolver fail-closed em ambiguidade; financeiro/bank_ledger fora; `permission-keys.ts`/`business-permissions.types.ts`/ghost intocados; guard/e2e 13/13/neg-proof 5-mordidas OK; `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` OPEN. **Warnings:** W1 `services:create/edit/disable` da allowlist ainda NÃO existem em `permission-keys.ts` — reconciliar no SSOT vivo antes de enforcement. W2 o CHECK de `capability_key` é trava defensiva temporária, NÃO registry/SSOT; expandir allowlist = nova migration. Estado: **CLOSED / YALA PASS**.
- **Referências:** `docs/02_decisions/DECISION_0136_ACTOR_CAPABILITY_GRANTS_SUBSTRATE.md` · `actor_capability_grants` (mig 20260616210000) · `modules/authority/actor-capability-grant.*` · `DECISION-0134`/`0135`/`0113`/`0126` · `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION`.

---

## DECISION-0137 — RFC da tri-registry de permissões (papel canônico de cada vocabulário)

- **Data:** 2026-06-16
- **Tipo:** arquitetural / autoridade / RFC (DOCS-ONLY · IMPLEMENTED / HOLD YALA)
- **Frente:** F-PERMISSION-TRI-REGISTRY-RFC · **HEAD:** `fad9a854` · **dev:** 391 (sem migration)
- **Contexto:** o Slice 1C (enforcement de grant em rota) estava bloqueado pela `DT-PERMISSION-TRI-REGISTRY-RECONCILIATION`. READ-FIRST 1ª mão confirmou **três** vocabulários vivos de permissão (sem dualidade simples): `permission-keys.ts` (`PermissionKey`+`PERMISSION_CAPABILITIES`, contém `can_hold_assets`), `business-permissions.types.ts` (`BUSINESS_PERMISSION_MAP: Record<BusinessAction, OrganizationRoleKey[]>` — role-map; `import type` only), `rbac.types.ts` (`PermissionString = ` + "`${string}:${string}`" + ` — template legado usado por requirePermission).
- **Decisão:**
  1. `permission-keys.ts` = **SSOT canônico** de capability keys para `actor_capability_grants`.
  2. `business-permissions.types.ts` = **matriz role→action/contexto**, NÃO registry; não usado pelo Slice 1B; só no 1C se a composição for decidida.
  3. `PermissionString`/`rbac` = **legado/FASE 6 separado**; NÃO alimenta grants; NÃO é authority de grant; alinhamento = frente própria.
  4. Grants usam `actor_id`/`scope_actor_id`/`capability_key` do `permission-keys.ts` + allowlist não-financeira; NÃO usam BusinessAction/PermissionString/OrganizationRoleKey/`users.referral_code`.
  5. Enforcement 1C só após **decisão de composição de rota** (owner + canRepresentActor + grant + role-map/requirePermission se aplicável).
  6. Financeiro CRITICAL fora (3 paralelas); 7. organization NÃO reativada (OrganizationRoleKey type-only).
- **NÃO muda runtime:** zero arquivo material alterado; zero endpoint/enforcement; Slice 1B intacto.
- **Escolha:** RFC docs-only; classificação canônica + bloqueio explícito do 1C promulgados como baseline.
- **NÃO decidido:** cutover material dos vocabulários; composição de rota do 1C; owner-only de agenda (DT-CALENDAR).
- **Responsável:** Clayton / IA Diretora (executor: Claude). **Validação prévia:** Clayton.
- **Supera:** nenhuma (resolve a classificação da `DT-PERMISSION-TRI-REGISTRY-RECONCILIATION` como baseline).
- **Superada por:** —
- **🟢 RESEAL YALA = PASS (2026-06-16, adversarial READ-ONLY).** Commit material `3224d6f8`. Yala confirmou: DECISION-0137 existe; commit docs-only puro; `permission-keys.ts`=SSOT de capability keys p/ grants; `business-permissions.types.ts`=role-map (não registry); `PermissionString`/`rbac`=legado/FASE 6 (grafado `${string}:${string}`); grants não usam BusinessAction/PermissionString/OrganizationRoleKey/`users.referral_code`; Slice 1B intacto; Slice 1C bloqueado; financeiro CRITICAL/3 paralelas; organization não reativada; zero runtime/código/schema/frontend/migration. `DT-PERMISSION-TRI-REGISTRY-RECONCILIATION` → **CLOSED_AS_RFC_BASELINE / YALA PASS**; `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` permanece OPEN. Estado final: **CLOSED / YALA PASS**.
- **Referências:** `docs/02_decisions/DECISION_0137_PERMISSION_TRI_REGISTRY_RFC.md` · `permission-keys.ts` · `business-permissions.types.ts` · `rbac.types.ts` · `DECISION-0134`/`0135`/`0136` · `DT-PERMISSION-TRI-REGISTRY-RECONCILIATION` · `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION`.

---

## DECISION-0138 — Operador de agenda por grant explícito (RFC de produto/autoridade)

- **Data:** 2026-06-16
- **Tipo:** arquitetural / autoridade / produto / RFC (DOCS-ONLY · ✅ CLOSED / YALA PASS)
- **RESEAL YALA (2026-06-16):** reseal adversarial READ-ONLY sobre commit `0532232d` retornou **PASS**. Frente **CLOSED / YALA PASS**; `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` → **CLOSED_AS_PRODUCT_AUTHORITY_BASELINE / YALA PASS**. Yala confirmou: DECISION-0138 existe; delegação flexível promulgada; código/slug/`referral_code` ≠ authority; `actor_id` = base material; grant = `actor_id`+`capability_key`+`scope_actor`, aditivo; Slice 1C NÃO implementado; availability/calendar + owner-only intocados; `calendar:block`/`unblock` sem rota literal `/block`; financeiro fora/3 paralelas; DECISION-0137 respeitada; zero material (commit = 5 .md; arch gate critical_new=0).
- **Frente:** F-CALENDAR-OPERATOR-GRANT-AUTHORITY-RFC · **HEAD:** `6e74deb9` · **dev:** 391 (sem migration)
- **Contexto:** o Slice 1C (enforcement de grant em rota de agenda) estava bloqueado por `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` (decisão de produto sobre owner-only). Clayton decidiu: owner delega operação de agenda por grant explícito, sem cargo rígido. READ-FIRST confirmou que `calendar:block`/`unblock` são keys NÃO-roteadas (a rota viva de agenda é owner-only selada DECISION-0113/0118).
- **Decisão (produto + composição):**
  1. **Operador de agenda existe:** owner/representante legítimo do `scope_actor` delega por **grant explícito** (secretária/cônjuge/funcionário/parceiro/etc.); **sem cargo rígido** — granular por `actor × capability × scope_actor`. Templates/cargos = fase futura, não bloqueiam.
  2. **Código/slug = lookup, NÃO authority:** proibido `users.referral_code`/slug/actorId-de-body como autoridade; autoridade nasce do grant persistido contra `actor_id`.
  3. **Composição fail-closed do Slice 1C:** rota executa se **A** owner/self · **B** `canRepresentActor(user,scope)` · **C** grant ativo (grantee server-side / scope / capability / status active / janela / tenant). Grant é **ADITIVO** (não remove owner; não concede direito de conceder).
  4. **Mapeamento obrigatório:** o 1C deve mapear de 1ª mão quais rotas reais correspondem a calendar:* (não há rota `/block`); composição entra aditiva sobre o gate selado.
  5. **Scope:** não confundir agenda pessoal × empresarial; owner vem de `resolveAvailabilityOwner`, não de actorId declarado.
  6. **Auditoria futura:** user/actor/scope/capability/grant/ação. **Financeiro FORA** (CRITICAL / 3 paralelas).
- **NÃO muda runtime:** zero código; availability/calendar owner-only intocado; `hasCapabilityGrant` NÃO plugado em rota; Slice 1C NÃO implementado.
- **NÃO decidido:** mapeamento concreto de rota (1C); cargos/templates; cutover de vocabulários.
- **Responsável:** Clayton / IA Diretora (executor: Claude). **Validação prévia:** Clayton (decisão de produto).
- **Supera:** nenhuma (resolve a dúvida de `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` como baseline de produto).
- **Superada por:** —
- **Referências:** `docs/02_decisions/DECISION_0138_CALENDAR_OPERATOR_GRANT_AUTHORITY_RFC.md` · `DECISION-0136`/`0137`/`0113`/`0118` · `actor_capability_grants` · `unified-availability.routes.ts` (owner-only) · `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION`.

---

## DECISION-0139 — Actor-Scoped Referral Code & Earnings

- **Data:** 2026-06-17
- **Tipo:** Produto / Arquitetura / Autoridade / Econômico (DOCS-ONLY)
- **Frente:** F-ACTOR-SCOPED-REFERRAL-PREFLIGHT · **HEAD:** `1565a184` · **dev:** 393 (sem migration)
- **Contexto:** auditoria READ-ONLY actor-scoped referral retornou **USER_ONLY** — o diferencial Unificard (código por actor) **ainda não está materialmente implementado**. Hoje: `users.referral_code` é fonte viva; `user_referral_links` é user↔user; check/split resolvem **user**; actors derivados não nascem com código; `generateShareableLink` aceita `referral_code` solto em body/metadata (vetor DIVERGENT); `referral_codes(owner_actor_id)` só em archive/docs. **Positivo:** infra financeira já actor-native (`bank_accounts.owner_type='actor'`, `actor_wallet` por actor, `getActorWalletAccount`/`ensureActorWalletAccount`). Gap = **identidade do código + resolver do split**, NÃO o Bank/wallet.
- **Decisão (promulgada — 13 regras soberanas):** CPF/`actor_human` = raiz legal/civil/fiscal/rastreável, nunca substituído por `referral_code`; `actor` = unidade econômica soberana; `actor_organizational` não-soberano legalmente mas unidade econômica interna; **cada actor pode ter código próprio**; **`referral_code` pertence a `owner_actor_id`**, é **lookup, não authority**, não concede permissão sozinho; `body/metadata.referral_code` arbitrário **não define dono econômico**; **earnings pertencem ao actor dono**, destino = **`actor_wallet`/`bank_account` do `owner_actor_id`**; CPF raiz preserva rastreabilidade mas **não captura earnings por reflexo**; operar actor por delegação **não transfere ownership econômico** (cadeia até CPF original + ocupante, `08 §6.2`). Exemplos canônicos: PF→wallet PF; banda→wallet banda; empresa/página/grupo→wallet do actor; 1 CPF com N actors **não mistura earnings**.
- **Janela de 5 anos:** **PENDENTE CLAYTON** — mencionada como decisão de produto, **sem prova documental formal** nesta auditoria; **NÃO promulgada** até ratificação explícita/referência documental. Esta DECISION **não afirma** que os 5 anos estão ratificados.
- **Resíduo material:** `DT-ACTOR-SCOPED-REFERRAL-USER-ONLY` (OPEN / PRODUCT_DIFFERENTIATOR_NOT_MATERIALIZED · MONEY_ADJACENT · AUTHORITY_ADJACENT). **Próxima macrofrente (planejada, não implementada):** `F-ACTOR-REFERRAL-CODE-SUBSTRATE` (criar `actor_referral_codes` owner_actor_id; evoluir `user_referral_links`→actor↔actor; gerar código no nascimento do actor; split por `getActorWalletAccount(ownerActorId)`; travar `body.referral_code`; E2Es PF/banda/empresa/grupo + non-mixing; guards). STOPs: money-adjacent (3 paralelas READ-ONLY antes de código), não tocar Bank Core fora de APIs canônicas, não escrever `bank_ledger`, code/slug/referral = lookup nunca authority.
- **Responsável:** Clayton / IA Diretora (executor: Claude). **Validação prévia:** Clayton.
- **Supera:** **DECISION-0134 (parcial)** — refina/superseda quanto a actor-scoped referral **code & earnings**; a 0134 §2 (código pertence ao actor; lookup, não authority) **permanece vigente**.
- **Superada por:** —
- **Referências:** `docs/02_decisions/DECISION_0139_ACTOR_SCOPED_REFERRAL_CODE_AND_EARNINGS.md` · `DECISION-0134`/`0113`/`0131` · `AUTHORITY_LAW` · `LEI_DE_COERENCIA_SISTEMICA` · `07_NOMENCLATURA_CANONICA` · `bank_accounts.owner_type='actor'`/`getActorWalletAccount` · `DT-ACTOR-SCOPED-REFERRAL-USER-ONLY` · `docs/03_execution_log/20260617_F_ACTOR_SCOPED_REFERRAL_PREFLIGHT.md`.

---

## DECISION-0140 — Unidade canônica de taxa de método financeiro UnifyCard: `fee_rate_bps` (basis points)

- **Data:** 2026-06-19
- **Tipo:** Financeiro / Produto / Nomenclatura (DOCS-ONLY — promulgação de régua, NÃO implementação material)
- **Frente:** F-FINANCIAL-DECISION-FEE-BPS-UNIFYCARD-METHOD · **HEAD:** `a258973c` · **dev:** 394 (sem migration)
- **Contexto:** o trilho unifycard-method foi CONTIDO em R8Q (501 UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED; tabela `unifycard_payment_methods` + enum `unifycard_method_type` ghost/archive-only no dev). O bug **299¢ vs 3¢** é exatamente a ambiguidade de UNIDADE de `fee_percentage`: o contrato declara decimal `0.0299`, mas o consumidor de settlement (`payment-execution.service`) divide por 100 e assume percentual `2.99` — divergência de unidade na raiz. A norma `07_NOMENCLATURA_CANONICA §4.8` já decide: taxas percentuais em **basis points (bps)**, sufixo obrigatório `_bps`, INTEGER (1% = 100 bps); `fee_percentage` é nome ❌ proibido/ambíguo.
- **Decisão soberana (Clayton escolhe B — promulgada):** taxas percentuais de método financeiro UnifyCard **DEVEM** usar **`fee_rate_bps INTEGER`** no banco e **`feeRateBps`** no runtime/API. **`fee_percentage`/`feePercentage` é legado/deferred** — não deve ser expandido nem usado em novas implementações. `fee_rate_bps` INTEGER elimina a ambiguidade de unidade na raiz (sem decimal vs percentual; sem `/100`).
- **Por que B (e não A/C/D):** **A** (manter `fee_percentage`) deixaria o legado divergente legítimo por omissão. **C** (corrigir/migrar agora) NÃO deve ser feito sem mapa de consumers + Evidence Pack financeiro + Yala + 3 paralelas. **D** (remover o trilho) é radical antes de provar que cartão/acquiring não reaproveita o trilho. **B** promulga a régua sem tocar dinheiro nem runtime (o trilho já está contido em R8Q). **Parecer IA-DINHEIRO: concorda com B** (a régua bps mata a ambiguidade na raiz; B não move dinheiro nem muda runtime porque o trilho está contido; C/D exigem Evidence Pack/prova de reuso).
- **RESSALVA OBRIGATÓRIA (régua ≠ fechamento da DT financeira):** B é **promulgação de régua**, NÃO fechamento da DT de fee-unit/settlement. A DT do fee-unit permanece **OPEN**. A frente material futura só fecha com **Evidence Pack financeiro** (schema vivo, migration se aplicável, mapa de consumers, snapshot, **E2E provando 299¢**, guard, negative-proof, gates e Yala). Esta DECISION NÃO corrige `/100`, NÃO troca `fee_percentage`→`fee_rate_bps` no código, NÃO cria migration, NÃO toca settlement/Bank/payout/fee calculation, NÃO reativa o trilho UnifyCard/acquiring.
- **Resíduo material:** `DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION` → **OPEN / DECISION MATERIAL REQUIRED** (régua promulgada; implementação pendente). Frente material deferida: `F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION` → **DEFERRED / REQUIRES EVIDENCE PACK FINANCEIRO**.
- **Responsável:** Clayton / IA Diretora (executor: Claude). **Validação prévia:** Clayton (escolha soberana B) + parecer IA-DINHEIRO.
- **Supera:** — (primeira promulgação da unidade de fee do trilho UnifyCard method; alinha o trilho à régua já existente `07_NOMENCLATURA_CANONICA §4.8`).
- **Superada por:** —
- **Referências:** `07_NOMENCLATURA_CANONICA §4.8` (bps/`_bps` INTEGER; `fee_percentage` proibido) · `DECISION-0113` (canal-1 CLOSED/baseline zero) · `DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION` · `DT-AUTHORITY-Z2-UNIFYCARD-METHOD-M5-MONEY-CONTAINMENT` (R8Q) · `docs/03_execution_log/20260619_F_AUTHORITY_Z2_R8Q_UNIFYCARD_METHOD_M5_CONTAINMENT.md` · `docs/03_execution_log/20260619_F_FINANCIAL_DECISION_FEE_BPS_UNIFYCARD_METHOD.md` · consumers conhecidos: `unifycard.service.ts` (299¢) / `payment-execution.service.ts` (`/100`→3¢).

---

## DECISION-0141 — UnifyCard Fee BPS Schema-of-Record (economic_policy_engine)

- **Data:** 2026-06-19
- **Tipo:** Financeiro / Produto / Arquitetura / SSOT (DOCS-ONLY — schema-of-record ruling, NÃO implementação material)
- **Frente:** F-UNIFYCARD-FEE-BPS-SCHEMA-OF-RECORD · **HEAD:** `4fe02008` · **dev:** 394 (sem migration)
- **Status:** **PROMULGADA / DOCS-ONLY / SCHEMA-OF-RECORD RULING / NOT MATERIAL IMPLEMENTATION.**
- **Contexto:** DECISION-0140 decidiu a UNIDADE (fee_rate_bps INTEGER / feeRateBps), mas não o ENDEREÇO soberano. Esta DECISION decide ONDE a configuração de fee/split mora. Substrato vivo confirmado: `economic_policy_lines` é tabela canônica (migration 20260530561000) **com coluna `bps`** + `economic_policy_resolution_logs` (20260530564000); DECISION-0047 estabelece o **Economic Policy Engine como camada canônica de DECISÃO de split**. `payment_methods`/`unifycard_payment_methods` são **ghost** no dev (R8Q); não há `fee_percentage` vivo em schema aplicado; o bug 299¢→3¢ é latente/dormente (divergência de unidade + ausência de schema-of-record).
- **Decisão soberana (Clayton adota B + D):** **(B)** a fonte canônica/SSOT de configuração de fee/split é o **`economic_policy_engine` / `economic_policy_lines.bps`** (bps INTEGER). **(D)** o trilho **UnifyCard-method permanece contido/ghost/501** (R8Q) até a feature nascer em frente material própria com Evidence Pack financeiro. **Regra central:** a taxa financeira UnifyCard **NÃO** deve ter SSOT em `payment_methods` nem em `unifycard_payment_methods`. Se reativadas, podem atuar **apenas** como adapter / snapshot / read-model / interface operacional / override modelado via policy engine — **nunca SSOT financeiro paralelo**. Nenhum path novo pode resolver fee/split fora do economic_policy_engine. `payment_intents.metadata` pode guardar **snapshot auditável** da policy resolvida (NÃO SSOT; deve usar bps `fee_rate_bps`/`feeRateBps`). `fee_percentage`/`feePercentage` = legado/deferred/proibidos como destino canônico. **Execução material futura usa `gross_cents * fee_rate_bps / 10000`.** **Proibido:** `/100` ambíguo · `*100` órfão · `fee_percentage` runtime canônico · SSOT paralelo de fee em tabela de método · tocar Bank/Core fora do boundary · reabrir payout · reativar settlement/fundo regional sem frente própria.
- **Consequências:** `F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION` continua **DEFERRED** (now governed by this schema-of-record ruling); `DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION` continua **OPEN / MATERIAL_REQUIRED**; **payout NOT AUTHORIZED**; R8Q 501 contido. A futura executora material só entra após: Evidence Pack financeiro · schema before/after · consumer map · E2E 299¢ · negative-proof contra `/100` · guard de nomenclatura · guard de consumer · Bank boundary proof · settlement non-reactivation proof · payout non-touch proof · gates · Yala reseal. **NÃO decididos aqui (frente futura):** backfill de produção, reativação de payment_methods/unifycard_payment_methods/settlement, payout, política comercial de taxa final, execução material.
- **Responsável:** Clayton / IA Diretora (executor: Claude). **Validação prévia:** Clayton (B + D) + paralelas READ-ONLY A/B/C.
- **Supera:** — (complementa **DECISION-0140**, que fixou a unidade; ancora-se em **DECISION-0047** Economic Policy Engine como resolvedor canônico de split).
- **Superada por:** —
- **Referências:** `DECISION-0047` (Economic Policy Engine canônico de split) · `DECISION-0140` (unidade bps) · `07_NOMENCLATURA_CANONICA §4.8` · `economic_policy_lines.bps` (migration 20260530561000) · `economic_policy_resolution_logs` (20260530564000) · `SSOT_EXCLUSIVE_BANK_RULE`/`SSOT_CONTRACT`/`SSOT_REGISTRY_UNIFICARD` (bank_ledger = SSOT único de dinheiro realizado) · `DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION` · `F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION` · `docs/02_decisions/DECISION_0141_UNIFYCARD_FEE_SCHEMA_OF_RECORD.md` · `docs/03_execution_log/F-UNIFYCARD-FEE-BPS-SCHEMA-OF-RECORD-DECISION-EXECUTION.md`.

---

## DECISION-0142 — Needs-graph: composição-piloto (festa de casamento) + invariante folha-SSOT-global

- **Data:** 2026-06-20
- **Tipo:** Arquitetural / Ontologia (CONCEPT graph) — MATERIALIZADA (Slice U1b)
- **Frente:** F-ONTOLOGY-COMPOSITION-NEEDS-GRAPH (U1b) · **HEAD (pré-commit):** `6c93c648` · **dev:** 398 (2 migrations)
- **Status:** **PROMULGADA / MATERIALIZADA (Slice U1b).**
- **Contexto:** primeira materialização da MACRO 1 (cabeça da orquestração). U1 ampliou `concept_relations.relation_type` 3→6; esta DECISION semeia a 1ª árvore-piloto de composição de necessidades **e** crava o invariante que faz "um substrato, N verticais" funcionar. Versão-REUSO ratificada (a IA-SEMANTICA provou no disco que o seed de interesse já reusa 27 concepts de `educacao-e-conhecimento` com o mesmo `concept_id` — folha = subject neutro; contexto na aresta).
- **Decisão soberana (Clayton):** **(A) árvore-piloto** raiz `festa-de-casamento` (cultura-lazer-e-eventos) → `requires` {local-de-evento, buffet, fotografia, musica, decoracao} + `related_to` {servicos-pessoais-beleza, locacao-de-traje, transporte, cerimonial}. 4 folhas REUSADAS (`fotografia`/`musica`/`decoracao`@educacao-e-conhecimento + `servicos-pessoais-beleza`@servicos) referenciadas, não recriadas/movidas; 6 NOVAS (incl. raiz); SEM `suggests`; arestas cross-domain legítimas (grafo global pós-0092). **(B) INVARIANTE FOLHA-SSOT-GLOBAL:** `concept_id` = identidade soberana; a folha é SSOT GLOBAL context-neutral, serve N verticais, e o provider vincula-se a ela 1× ficando descobrível em todas; `concept.domain` = auxiliar/breadcrumb, **NÃO** limita matching; descoberta/oferta/matching casa por `concept_id`, **PROIBIDO** filtrar provider discovery por `concept.domain`; role/contexto mora na RELAÇÃO/ARESTA, nunca na folha; **uma folha por serviço** (proibido duplicar ou embutir vertical no slug — só o intent-root é específico); profundidade (galhos via `part_of`) = futuro.
- **Materialização/Prova:** migrations `20260620140000_seed_concepts_wedding_pilot.sql` (governado trigger 0075; guard-pré/pós) + `20260620150000_seed_concept_relations_wedding_pilot.sql` (governado trigger 0077; guard de árvore exata); idempotentes (ON CONFLICT). **IA-YALA PASS:** árvore viva == decisão (9; 5 requires + 4 related_to; suggests=0); reuso preservado (sem leaf-duplication); 0075/0077 mordem; idempotência INSERT 0 0; drift=0 (398==398); ZERO código; cartório intocado.
- **Consequências:** próximo passo obrigatório (antes de F-OFFER-SSOT-CONVERGENCE) = auditoria READ-ONLY `F-PROFILE-PJ-OFFER-CONFIGURATION-READINESS` (onde PF/PJ/prestador declara "eu faço isso" sem criar verdade paralela à cadeia `CONCEPT → SERVICE → SERVICE_OFFERING → AVAILABILITY`). O invariante §B vincula a MACRO 2 (reader/discovery deve casar por `concept_id`). **NÃO** decididos aqui: oferta, fornecedor, RFQ, presença, dinheiro, labels (0107 D12), profundidade de grafo, outras verticais.
- **Responsável:** Clayton / IA-DIRETORA (executor: Claude Opus 4.8). **Validação prévia:** Clayton (ratificação) + ChatGPT (APPROVED_WITH_SMALL_ADJUSTMENTS) + IA-SEMANTICA (proposta/lente de reuso) + IA-YALA (reseal PASS) + IA-BANCO (prova-viva).
- **Supera:** —
- **Superada por:** —
- **Referências:** `docs/02_decisions/DECISION_0142_NEEDS_GRAPH_COMPOSITION_PILOT.md` · migrations `20260620140000`/`20260620150000` · `backend/src/core/semantic/graph-governance.service.ts` · triggers `0075`/`0077` · `DECISION-0070` (taxonomia governada) · `DECISION-0092` (grafo global) · `DECISION-0105` (domain multi-camada) · `DECISION-0107` (labels D12) · U1 (widening 3→6) · seed de interesse `20260601130000` (precedente de reuso).

---

## DECISION-0143 — Contrato de vocabulário da cadeia de oferta (F-OFFER-0)

- **Data:** 2026-06-21
- **Tipo:** Arquitetural / contrato de vocabulário (DOCS-ONLY) — **NÃO MATERIAL** (não toca runtime/migration/backend/frontend/`docs/01_normative`).
- **Frente:** F-OFFER (F-OFFER-0) · **HEAD (pré-commit):** `9f5e9c5e` · **dev:** 398
- **Status:** **PROMULGADA / DOCS-ONLY / CONTRATO DE VOCABULÁRIO DA F-OFFER.**
- **Contexto:** fecho da Rodada 7 `F-PROFILE-PJ-OFFER-CONFIGURATION-READINESS` (6 instâncias; veredito PASS_TO_CONVERGENCE; ChatGPT APPROVED_WITH_GUARDS). Fixa o vocabulário da cadeia **antes** de qualquer execução, para que F-OFFER-1..6 não virem "correção local sem contrato".
- **Decisão soberana (Clayton):** cadeia `CONCEPT → SERVICE → SERVICE_OFFERING → AVAILABILITY` com 4 camadas — **(1) Declaração de capacidade:** PF `actor_professional_concepts` (gated `canRepresentActor`, sem preço) · PJ `company_concept_publications` (gated `canManageCompany`+KYB); **(2) Descoberta/capacidade operacional:** `services` (concept-keyed); **(3) Oferta contratável:** `service_offerings` (exige service canônico; `price_cents` BIGINT; duração; status); **(4) Disponibilidade real:** `availability` owner=`service_offering`. **Invariantes:** `concept_id`=identidade; `concept.domain` NÃO filtra matching; `category` NÃO é identidade; `actionContext.actorId` nunca é autoridade (server-side obrigatória); preço só `price_cents` BIGINT; tempo só no SSOT temporal; sem verdade paralela. "Eu faço isso" **não** é SSOT único — são camadas.
- **Materialização/Prova:** **NENHUMA** (docs-only). Estado vivo (IA-BANCO, HEAD `9f5e9c5e`): espinha existe e VAZIA (services/service_offerings/publications=0; canonical_services=1; actor_professional_concepts=1) = janela virgem de baixo custo. Hoje `services` é concept-OPCIONAL e `service_offerings` não exige `services` (DECISION-0122 = dois caminhos); a 0143 declara o **ALVO**, materializado em **F-OFFER-2/3**.
- **Consequências:** F-OFFER-0 **CLOSED/PROMULGADA**. Libera **F-OFFER-1** (conter ghosts: 501 explícito, sem 42P01/tabela fantasma) como próxima fatia, **a ratificar no ChatGPT antes de executar**. F-OFFER amplo **HOLD**. **Fora da macro:** slot material → **F-MATERIAL-CONVERGENCE** (frente própria) · presença · dinheiro/payout · RFQ complexo · engine universal · obra multi-etapa.
- **Responsável:** Clayton / IA-DIRETORA (executor: Claude Opus 4.8). **Validação prévia:** Clayton (promulgação) + ChatGPT (APPROVED_WITH_GUARDS) + Rodada 7 (6 instâncias) + IA-BANCO (prova-viva).
- **Supera:** —
- **Superada por:** —
- **Referências:** `docs/02_decisions/DECISION_0143_OFFER_CHAIN_VOCABULARY.md` · `DECISION-0142` (folha-SSOT) · `DECISION-0117` (catálogo/oferta) · `DECISION-0122` (service_offering canônico) · `DECISION-0121` (booking authority) · `DECISION-0113` (actorId hint) · `DECISION-0132` (purpose temporal) · `docs/orquestracao/processo/cadeia-de-oferta/CONSOLIDADO.md` (Rodada 7).

---

## DECISION-0144 — Régua de elegibilidade declaração→service na cadeia de oferta (F-OFFER-2)

- **Data:** 2026-06-21
- **Tipo:** Arquitetural / régua de autoridade+elegibilidade (DOCS-ONLY) — **NÃO MATERIAL** (não toca runtime/migration/backend/frontend/`docs/01_normative`).
- **Frente:** F-OFFER (F-OFFER-2) · **HEAD (pré-commit):** `4431b8fc` · **dev:** 398
- **Status:** **PROMULGADA / DOCS-ONLY / RÉGUA DE ELEGIBILIDADE DECLARAÇÃO→SERVICE.**
- **Contexto:** READ-FIRST curto F-OFFER-2 (3 elos — IA-ACTOR **FALTA_X** · IA-AUTORIDADE **FALTA_DECISAO** · IA-BANCO **PASS_PARA_GO_DE_DECISAO**) provou: substratos de declaração prontos+concept-keyed+gated; espinha de destino (`services`/`service_offerings`) VAZIA + FK forte (RESTRICT); e o **bypass KYB-transitivo** (criar `service` de company exige só `canManageCompany`, sem KYB/publicação). A ponte é **régua a promulgar**, não bug.
- **Decisão soberana (Clayton):** régua D3 — `createService` **concept-keyed** + exige `canonical_service_id` (**NOT NULL**, após preflight) + exige **declaração/publicação ACTIVE do MESMO `concept_id`** (PF `actor_professional_concepts`; PJ `company_concept_publications` → **fecha o bypass KYB-transitivo**); declaração = **INSUMO somado** à autoridade server-side (**re-gateia, não herda**); **V1 = match EXATO de `concept_id`** (sem `domain`/`category`/`slug`/grafo); `actionContext.actorId` nunca é autoridade. **ENTRA:** D3-1/2/3 + **D3-6 Parte A** (FK `concept_id→concepts` NO ACTION→RESTRICT, se preflight provar 0 órfãos). **FORA:** D3-4 (operador via `actor_capability_grants`), D3-5 (PF KYC-lite/trust), D3-6 Parte B (ramo-4 legado `is_primary`/`role='admin'`), dinheiro/`availability`/`service_offerings`/discovery/presença. **+ 6 GUARDS de execução (§B-bis):** ACTIVE respeita schema vivo (senão `STOP_DECISION_REQUIRED`); owner PF/PJ server-side; PF×PJ ambíguo → STOP; `canonical_service` resolve `concept_id` material (senão STOP antes do runtime); zero expansão semântica em V1; declaração não substitui autoridade.
- **Materialização/Prova:** **NENHUMA** (docs-only). Execução material após esta DECISION (GO próprio): **F-OFFER-2A** (schema: `canonical_service_id` NOT NULL após preflight + FK RESTRICT se seguro) + **F-OFFER-2B** (runtime: eligibility gate; PF/PJ sem declaração/publicação → 403 controlado; sem bypass por spoof de `actionContext`/category/domain). Gates: preflight + 4 E2E (PF/PJ com/sem) + 2 negative-proof (category/domain · actionContext) + 2 guards (service concept-less · createService sem eligibility) + `validate:actor-writer-boundaries`/`bank-ledger-boundaries`/`regression-guards`/`architectural-patterns --strict` + typecheck no_new_errors.
- **Consequências:** F-OFFER-2 **DECISION PROMULGADA**; execução material (2A/2B) **HOLD** até GO próprio (volta ao ChatGPT antes de executar). F-OFFER-3..6 HOLD.
- **Responsável:** Clayton / IA-DIRETORA (executor: Claude Opus 4.8). **Validação prévia:** Clayton (promulgação) + ChatGPT (APPROVED_WITH_GUARDS) + READ-FIRST F-OFFER-2 (IA-ACTOR/IA-AUTORIDADE/IA-BANCO).
- **Supera:** —
- **Superada por:** —
- **Referências:** `docs/02_decisions/DECISION_0144_DECLARATION_TO_SERVICE_ELIGIBILITY.md` · `DECISION-0143` (vocabulário) · `DECISION-0142` (folha-SSOT) · `DECISION-0117` (canonical_services) · `DECISION-0113` (actorId hint) · `DECISION-0100/0101` (publish PJ KYB) · `DECISION-0118` (canManageCompany) · `DECISION-0136` (actor_capability_grants) · `docs/orquestracao/processo/cadeia-de-oferta/CONSOLIDADO.md` (READ-FIRST F-OFFER-2).

---

## DECISION-0145 — Régua de vínculo service→service_offering (F-OFFER-3)

- **Data:** 2026-06-21
- **Tipo:** Arquitetural / régua de vínculo+proveniência (DOCS-ONLY) — **NÃO MATERIAL** (não toca runtime/migration/backend/frontend/`docs/01_normative`).
- **Frente:** F-OFFER (F-OFFER-3) · **HEAD (pré-commit):** `74a04819` · **dev:** 399
- **Status:** **PROMULGADA / DOCS-ONLY / RÉGUA SERVICE→SERVICE_OFFERING.**
- **Contexto:** READ-FIRST curto F-OFFER-3 (IA-OFERTA **FALTA_DECISAO** · IA-AUTORIDADE **FALTA_DECISAO** · IA-BANCO **PASS_PARA_GO_DE_DECISAO**) provou: `createOffering` liga direto ao `canonical_service` e **nunca popula `service_id`** → a elegibilidade da DECISION-0144 **não alcança a oferta**; `company_id`/`professional_actor_id` do body sem constraint p/ provider (**proveniência livre**). `service_offerings` vazio (janela virgem). A oferta é a régua análoga à 0144.
- **Decisão soberana (Clayton):** **D-F3-1 Opção A** — `service_offering` exige `service_id` válido do **mesmo provider + mesmo concept**; **herda** a elegibilidade 2B (single-chain; **não duplica** apc/ccp em createOffering). **D-F3-2** — `company_id` **derivado server-side**; `professional_actor_id` removido/re-gateado (fecha o buraco de proveniência, G2/0144). **D-F3-3** — oferta nasce **`draft`** por padrão; `active`/activation pública = fatia/regra própria. **+ 5 GUARDS (§B-bis):** G1 `canonical_service_id` não é autoridade (derivado/validado do service); G2 `status='draft'` respeita schema vivo ou STOP; G3 `price_cents` BIGINT, nunca NUMERIC; G4 body não autoriza (server-side); G5 `service_id` incerto → STOP. Cadeia `CONCEPT→SERVICE→SERVICE_OFFERING`; `canRepresentActor`/`canManageCompany` permanece; preço = campo, **zero ledger**.
- **Materialização/Prova:** **NENHUMA** (docs-only). Execução após (GO próprio): **F-OFFER-3A** (schema: `service_id` NOT NULL após preflight; sem corrigir dado; sem DROP CASCADE) + **F-OFFER-3B** (runtime: `createOffering` exige service válido match provider/concept + deriva `company_id` server-side + status `draft` + 403/400 controlado). MODO B + promulgação condicional possível; GO próprio antes de executar.
- **Consequências:** F-OFFER-3 **DECISION PROMULGADA**; execução material (3A/3B) **HOLD** até GO próprio. **FORA:** operador via grants · cascata KYB-revoga→retira-oferta · `availability` · discovery · dinheiro/payout · presença · `service_order` · ranking · material · activation pública. F-OFFER-4..6 HOLD.
- **Responsável:** Clayton / IA-DIRETORA (executor: Claude Opus 4.8). **Validação prévia:** Clayton (promulgação) + ChatGPT (APPROVED_WITH_GUARDS) + READ-FIRST F-OFFER-3 (IA-OFERTA/IA-AUTORIDADE/IA-BANCO).
- **Supera:** —
- **Superada por:** —
- **Referências:** `docs/02_decisions/DECISION_0145_SERVICE_TO_OFFERING_BINDING.md` · `DECISION-0144` (elegibilidade declaração→service) · `DECISION-0143` (vocabulário) · `DECISION-0122` (service_offering canônico) · `DECISION-0117` (canonical_services) · `DECISION-0113` (actorId hint) · `DECISION-0118` (canManageCompany) · `docs/orquestracao/processo/cadeia-de-oferta/CONSOLIDADO.md` (READ-FIRST F-OFFER-3).

---

## DECISION-0146 — Integridade temporal da oferta e conflito de booking por provider (F-OFFER-5 + F-OFFER-6)

- **Data:** 2026-06-21
- **Tipo:** Arquitetural / régua de integridade temporal (DOCS-ONLY) — **NÃO MATERIAL** (não toca runtime/migration/backend/frontend/`docs/01_normative`).
- **Frente:** F-OFFER (F-OFFER-5 + F-OFFER-6 fundidos no nível decisório) · **HEAD (pré-commit):** `bca473fa` · **dev:** 400
- **Status:** **PROMULGADA / DOCS-ONLY / INTEGRIDADE TEMPORAL DA OFERTA E CONFLITO DE BOOKING POR PROVIDER.**
- **Contexto:** READ-FIRST 2 elos (IA-TEMPO **PARTIAL** · IA-BANCO **PASS_PARA_DECISAO**) provou: `availability` é SSOT único, `owner_type='service_offering'` já suportado (enum+policy→`provider_actor_id`+CHECK 6 tipos fail-closed), writer gated (`canRepresentActor`); **MAS sem garantia temporal** — trigger de overlap **FANTASMA** (comentário stale; nenhuma migration cria), `detect_availability_conflicts` **STUB** (`RETURN;`) só p/ `owner_type='user'`, `owner_id` polimórfico **SEM FK**, **nenhum rollup** por provider. Substrato **virgem** (`service_offering`=0/`service`=0/`user`=48) → endereçar é **grátis agora**. Diferente do F-OFFER-4 (GO direto): há **tensão soberana** Art. II × integridade econômica → exige DECISION.
- **Decisão soberana (Clayton):** **distinguir DECLARAÇÃO de COMPROMISSO.** (1) `availability` = declaração → overlap = **FATO/ALERTA→humano, NUNCA bloqueia** (Art. II, todos os owners); **PROIBIDO `EXCLUDE` em availability**. (2) `booking` confirmado = compromisso → 2º booking em status de **compromisso real** sobre **mesmo `provider_actor_id`** + intervalo sobreposto **FALHA controlado** (`BOOKING_PROVIDER_TIME_CONFLICT`/padrão vivo; nunca 500) — recusa de slot já vendido, não auto-resolução. (3) **rollup por `provider_actor_id`**, não por `service_offering` isolada (cross-oferta do mesmo provider = F-OFFER-6). (4) **status bloqueantes vêm do SCHEMA VIVO** (mapear; ambiguidade → **STOP_DECISION_REQUIRED**; não inventar). (5) `service_offering` = owner canônico do tempo contratável; conter reader legado `service` (service-feed). (6) `owner_id` validado por tipo no writer (FK onde couber). (7) concorrência transacional à prova de corrida. **+ 5 GUARDS adicionais (ChatGPT):** **G8** intervalo `[start,end)` TIMESTAMPTZ (back-to-back ≠ conflito); **G9** `provider_actor_id` derivado server-side `booking→service_offering→service/provider` (nunca do body); **G10** sem `service_offering_id`/resolução ambígua → STOP; **G11** bloqueio na **transição p/ confirmado** (não só createBooking); **G12** status pagamento×confirmação misturado → mapear 1ª mão e parar em ambiguidade.
- **Materialização/Prova:** **NENHUMA** (docs-only). Execução após (GO próprio): **F-OFFER-5A** (owner temporal `service_offering` + contenção legado + integridade `owner_id`) + **F-OFFER-6A** (booking conflict guard por `provider_actor_id`, transacional, status vivos), OU pacote único. **MODO C provável** (toca `createBooking`+concorrência) → **promulgação condicional NÃO autorizada**; GO explícito. READ-FIRST de execução começa por **mapear os status de booking vivos** + a cadeia `booking→service_offering→provider_actor_id`.
- **Consequências:** F-OFFER-5 e F-OFFER-6 **DECISION PROMULGADA**; execução material **HOLD** até GO próprio. **FORA:** dinheiro · payout · `bank_ledger` · split · ranking · discovery · marketplace · preço · **remarcação/reschedule** · indenização · presença/check-in · operador/grants · **multi-recurso/capacidade/equipe** (V1 = `provider_actor_id`). `docs/01_normative` intocado.
- **Responsável:** Clayton / IA-DIRETORA (executor: Claude Opus 4.8). **Validação prévia:** Clayton (promulgação) + ChatGPT (APPROVED_WITH_GUARDS, +G8–G12) + READ-FIRST F-OFFER-5 (IA-TEMPO PARTIAL · IA-BANCO PASS_PARA_DECISAO).
- **Supera:** —
- **Superada por:** —
- **Referências:** `docs/02_decisions/DECISION_0146_OFFER_TEMPORAL_INTEGRITY_AND_BOOKING_CONFLICT.md` · **Constituição temporal Art. II** (conflito=fato→alerta→humano) · `DECISION-0117` D (`availability.owner_type`) · `DECISION-0132` (purpose temporal/booking gate) · `DECISION-0143/0144/0145` (cadeia de oferta) · `DECISION-0113` (actorId hint) · `docs/orquestracao/processo/cadeia-de-oferta/respostas/IA-TEMPO.md` / `IA-BANCO.md` (READ-FIRST F-OFFER-5).

---

## DECISION-0151 — Rental Model: Resource-Based (Opção B) (DECISION_RENTAL_MODEL)

- **Data:** 2026-06-23 · **Status:** PROMULGADA / DECISÃO DE MODELO / DOCS-ONLY · **HEAD (pré-commit):** `8a16d2ac` · **Insumo:** docs/rental/RENTAL_MODEL_DECISION_PACK.md.
- **Decisão (Opção B):** locação = **recurso específico bloqueado no tempo** (não produto, não serviço genérico). Base `rentable_resource` (registro). Disponibilidade **reusa** unified availability com `owner_type='rentable_resource'` + branch em availability-owner-authority. **Conflito por `resource_id`, NÃO por provider** (3 carros do mesmo dono = 3 locações simultâneas; conflito é no carro). Sem agenda/estoque/booking/ledger paralelos. Opção C (service_offering) é inadequada p/ item único (conflita por provider).
- **Variações futuras (não substituem B):** A = fungível por quantidade/inventory; C = provider-bound/service_offering temporal.
- **MVP pré-money:** registro + disponibilidade por recurso + reserva/booking (estado). **HOLD:** depositCents/multa/late-fee/no-show financeiro/checkout/payout/escrow/liquidação/bank_*.
- **Materialização:** NENHUMA (docs-only). Frente própria `F-RENTAL-RESOURCE-CORE` sob GO futuro. **Δ dinheiro = 0; zero runtime/migration/RLS-live.**

## DECISION-0150 — Onboarding Enforcement Policy (Opção B+b1) (F-ONBOARDING-ENFORCEMENT-DECISION / F-ONBOARDING-MARCOS-PROJECTION)

- **Data:** 2026-06-23 · **Status:** PROMULGADA / POLÍTICA + PROJEÇÃO READ-ONLY THIN · **HEAD (pré-commit):** `1c3df5b4` · **Insumo:** docs/onboarding/ONBOARDING_ENFORCEMENT_DECISION_PACK.md (P10).
- **Decisão (B+b1):** onboarding PF = **progressivo/UX-hint**, NUNCA hard gate backend (`requiresOnboarding`/`isOnboardingCompleted` = sinal de navegação; nenhum endpoint recusa por !onboarding; login/feed/browse/wallet day-1). Ações de **risco** têm hard gate **próprio** (P3 activation / P5 booking / KYB PJ / payout selado / checkout firewall DECISION-0110). **Criar empresa/page shell = auth-only (b1)** (civil-mínimo já no register; risco PJ gateado depois). Frontend nunca é catraca de risco; metadata nunca é autoridade civil (P4); marcos read-only ≠ autoridade.
- **Materialização (thin):** `GET /identity/me` expõe `milestones` read-only (civilIdentityPresent/civilIdentityConfirmed/profileMinimumCompleted) — derivação pura, ZERO query nova. **Diferidos (per-actor/company):** actorReady/companyReady/providerReady/sellerReady → follow-up F-ONBOARDING-MARCOS-PROJECTION-PJ. **Guard:** `audit-onboarding-not-backend-gate.mjs` (cadeia regression-guards) morde se onboarding PF virar bloqueio backend.
- **Prova:** tsc 34 · regression EXIT 0 (guard novo) · bank-ledger/actor-writer · architectural critical_new=0. NP morde gate em route. **Δ dinheiro = 0; zero checkout/payout/RLS-live/migration.**
- **Fora de escopo/HOLD:** enforcement amplo · bloquear login/feed/browse · gate civil em criar-empresa · P3/P5/checkout/payout/PORTA-1/RLS-live.

## DECISION-0149 — RLS Cross-Tenant Connection Model (Opção B-heavy) (F-RLS-CROSS-TENANT-CONNECTION-DECISION)

- **Data:** 2026-06-23 · **Status:** PROMULGADA / DOCS-ONLY · **HEAD (pré-commit):** `9e372089` · **Frente:** F-RLS-CROSS-TENANT-CONNECTION-DECISION · **Ratificação:** Clayton + IA-DINHEIRO.
- **Decisão (B-heavy):** **tenant-loop é o padrão canônico** p/ acessos cross-tenant sob RLS. Runtime normal NUNCA usa conexão global/bypass (sempre `app.current_tenant` via runQueryWithTenant/runQueriesWithTenant/getClientWithTenant). Jobs/monitores cross-tenant: **descobrir tenants por fonte NÃO-RLS** (tabela `tenants`) → iterar tenant-by-tenant → executar com tenant-context. **`unificard_infra` NÃO ganha LOGIN/pool agora** (verificado: rolbypassrls=false, rolcanlogin=false, sem DATABASE_INFRA_URL — não é chave pronta; usá-lo = fabricar chave-mestra). ledger-integrity-monitor = ADMIN_ONLY/tenant-loop; reconciliation = discovery via `tenants` + loop; workers metrics/risk/alert = tenant-loop; **actor-wallet-payout-worker = HOLD** (default-off, decide no PORTA-1). infra reservado p/ exceção com DECISION própria + wrapper nomeado + allowlist + log + prova de menor blast.
- **Deriva de:** DECISION-0113/0118 · DECISION-0110 · F-DB-ROLE-AND-RLS-HARDENING. **Vinculada a:** DT-RLS-RUNTIME-TENANT-CONTEXT-BASELINE.
- **BLOCKER p/ RLS-runtime-live OPS:** baseline=0 · reconciliation tenant-loop · ledger-monitor ADMIN_ONLY/loop · workers classificados/HOLD · guard atualizado · app sem repoint até novo GO OPS.
- **Materialização/Prova:** **NENHUMA** (docs-only). Execução após GO próprio: `F-RLS-CROSS-TENANT-CONNECTION-MATERIALIZATION` (reconciliation+ledger+workers tenant-loop + guard baseline 2→0). **ZERO** dinheiro/migration/role/env/RLS-live.

## DECISION-0148 — Booking Core Subject Model (Opção B) (F-BOOKING-CORE-SUBJECT-MODEL-DECISION)

- **Data:** 2026-06-22 · **Status:** PROMULGADA / DOCS-ONLY · **HEAD (pré-commit):** `141870d1` · **Frente:** F-BOOKING-CORE-SUBJECT-MODEL-DECISION
- **Decisão (Opção B):** o core `unifiedAvailabilityService.createBooking` **para de receber `userId` genérico** e passa a receber um subject normalizado `BookingSubject = { subjectUserId, requesterActorId }`, **revalidando** `canRepresentActor(tenantId, subjectUserId, requesterActorId)` (core auto-defensivo, fail-closed). `subjectUserId` = id do principal humano que casa com `actors.user_id` (NÃO actorId, NÃO global_user_id). Callers normalizam antes (canonical/bundle/hire → user_id real; checkout → global_user_id→user_id; rfq → organizer user_id). **A descartada** (userId poluído quebra canonical+checkout) · **C adiada** (READ-FIRST provou ZERO caller de sistema; `systemSubject` proibido até DECISION própria) · **D já feito** (guard interim `e0d8ba3f` = piso).
- **Deriva de:** DECISION-0113 (channel-1) · DECISION-0118 D2 (autoridade server-side) · DECISION-0121. **Resolve:** DT-BOOKING-CORE-USERID-SUBJECT-POLLUTION.
- **Materialização/Prova:** **NENHUMA** (docs-only). Execução após GO próprio (**MODO B/C**): `F-BOOKING-CORE-SUBJECT-MODEL-MATERIALIZATION` — tipo BookingSubject + revalidação no core + migrar 5 callers + guard atualizado + e2e + YALA. **ZERO** dinheiro/checkout/payout/fee/ledger/RLS/migration.

## DECISION-0147 — Ativação segura de service_offering (draft→active) (F-SERVICE-OFFERING-ACTIVATION-SAFE-PUBLICATION · P3 / Caminho A)

- **Data:** 2026-06-22
- **Tipo:** Arquitetural / produto-autoritativo (DOCS-ONLY) — **NÃO MATERIAL** (não toca runtime/migration/backend/frontend/`docs/01_normative`).
- **Frente:** P3 / Caminho A · **HEAD (pré-commit):** `1b6f1fea`
- **Status:** **PROMULGADA / DOCS-ONLY / ATIVAÇÃO SEGURA DE SERVICE_OFFERING.**
- **Contexto:** READ-FIRST 3 elos (READ-ONLY): superfície de ativação = FECHA_COM_RISCO (ativação só `canRepresentActor`; status free-form; elegibilidade só na criação) · gates KYB/trust = **DECISION_REQUIRED** · active-only/cascata = FECHA_COM_RISCO (discovery active-only ✓; cascata KYB→publicação/tco atômica ✓; **mas NÃO suspende `service_offerings.status`**). `active` não é status visual — é **autorização operacional de contratação**.
- **Decisão soberana (Clayton · Modelo A):** **Q1** draft→active **revalida elegibilidade no momento da ativação**. **Q2** PJ = KYB-approved + operacional (0100 D6) + publicação ACTIVE + representável; PF = declaração ACTIVE + **KYC-lite/identidade mínima** + sem ATL/bloqueio + representável. **Q3** offering active **EXIGE** publicação(PJ)/declaração(PF) ACTIVE; **"contratável-direto sem publicação" NÃO autorizado** (modo private/limited futuro = decisão própria, nunca reusar `active`). **Q4** `status` = **state-machine fail-closed** (nunca free-form do body). **Q5** base revogada (KYB/publicação/declaração/canonical/operacional) → **suspende** offerings `active` afetadas (cascata; não apaga; não move dinheiro). **Invariante:** nenhuma offering fica `active` se a base que a autoriza caiu. **+7 guards (§B-bis).**
- **Ressalva obrigatória (PF/KYC-lite):** se KYC-lite do PF **não for materialmente definível** no schema/runtime vivo, a execução deve **STOP_DECISION_REQUIRED** ou **fail-closed** para ativação PF — **não inventar** critério em código.
- **Materialização/Prova:** **IMPLEMENTADA materialmente** (commit `a152b38a`, MODO C / promulgação manual; F-SERVICE-OFFERING-ACTIVATION-SAFE-PUBLICATION CLOSED). state-machine fail-closed em `updateOwnOffering` (active→draft→409; status nunca free-form) + gate `services-offering-activation-gate.ts` (PJ: publicação+operacional+KYB page-actor; PF: declaração+KYC-lite civil V1 [global_user+CPF+full_name+identities]+sem-ATL; lê SSOT, sem metadata) + booking-gate (`OFFERING_NOT_ACTIVE`) + **cascata Q5 atômica** (company-publications + professional-c1 → suspende offerings active; não apaga/dinheiro). Guard `audit-offering-activation-safe.mjs` + e2e `e2e-offer-activation-p3` (6/6) + B1 9/9. **IA-YALA PASS 8/8** (gate real todos os ramos + cascatas + booking-gate + guard-NP 2×). typecheck 34 · regression EXIT 0 · architectural critical_new=0 · zero migration/dinheiro/Bank/Core/payout/ledger/frontend.
- **Consequências:** P3 **DECISION PROMULGADA**; execução material **HOLD** até GO. **FORA:** dinheiro/checkout/payment/payout/Bank/Core/ledger/split/migration/`docs/01_normative`/oferta-privada.
- **Responsável:** Clayton / IA-DIRETORA (executor: Claude Opus 4.8). **Validação prévia:** Clayton (promulgação) + ChatGPT (ratificado) + READ-FIRST P3 (3 elos READ-ONLY).
- **Supera:** —
- **Superada por:** —
- **Referências:** `docs/02_decisions/DECISION_0147_OFFER_ACTIVATION_SAFE_PUBLICATION.md` · DECISION-0100 D5/D6 (KYB+operacional p/ publicação) · DECISION-0101 (cascata KYB) · DECISION-0088 §3.6 (KYB strict) · DECISION-0117 D (oferta cria draft) · DECISION-0144/0145 (cadeia oferta) · DECISION-0113 (autoridade server-side).
