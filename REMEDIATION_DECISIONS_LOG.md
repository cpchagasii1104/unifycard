# REMEDIATION DECISIONS LOG

**Documento append-only. Toda decisão arquitetural tomada durante a remediação é registrada aqui.**
**Uma decisão registrada nunca é editada. Se superada, adicionar nova entrada referenciando a anterior.**

| Metadado | Valor |
|---|---|
| Criado | 2026-04-21 |
| Última entrada | DECISION-0028 (2026-05-11) |
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



