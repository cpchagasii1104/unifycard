# REMEDIATION DECISIONS LOG

**Documento append-only. Toda decisão arquitetural tomada durante a remediação é registrada aqui.**
**Uma decisão registrada nunca é editada. Se superada, adicionar nova entrada referenciando a anterior.**

| Metadado | Valor |
|---|---|
| Criado | 2026-04-21 |
| Última entrada | DECISION-0017 (2026-04-30) |
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
