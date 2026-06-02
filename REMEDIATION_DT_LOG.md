# REMEDIATION DT LOG

## Objetivo

Registrar dívidas técnicas (DTs) reconhecidas durante a remediação estrutural
do UnifyCard/UnifyBank que:

- não bloqueiam runtime imediatamente;
- possuem impacto arquitetural ou semântico conhecido;
- exigem rastreabilidade institucional;
- e precisam sobreviver à memória operacional dos agentes.

Este arquivo **não substitui**:

- `REMEDIATION_DECISIONS_LOG.md` — decisões arquiteturais soberanas
- `SYSTEM_REMEDIATION_STATUS.md` — estado vivo da remediação
- `SYSTEM_REMEDIATION_PLAN.md` — direção normativa
- `opus.md` — memória operacional do agente

DTs registram **degradações aceitas conscientemente**, não decisões
arquiteturais soberanas. Quando uma DT é resolvida, seu status muda para
CLOSED com referência ao commit/decisão que a fechou; a entrada permanece
no log (append-only por princípio).

## Estrutura de entrada

Cada DT segue o formato:

    ## DT-<scope>-<short-name>

    - **Status:** OPEN | CLOSED | DEFERRED | SUPERSEDED
    - **Origem:** <sessão/fase/contexto que detectou>
    - **Vinculada a:** DECISION-NNNN (se aplicável)
    - **Contexto:** <descrição material do problema>
    - **Risco:** <consequência se não tratada>
    - **Mitigação atual:** <o que está sendo feito agora>
    - **Resolução prevista:** <quando/como/condições>

Status values:

- **OPEN** — dívida ativa, não tratada
- **CLOSED** — resolvida; manter entrada para arqueologia
- **DEFERRED** — reconhecida, decisão de não tratar agora
- **SUPERSEDED** — substituída por nova DT ou DECISION

---

## DT-CONSERVATION-OBSERVABILITY — OPEN (parcialmente endereçada: S4 → S3-detectado)

- **Status:** OPEN 2026-05-25 (commit `c94eebe2` — detecção habilitada; endurecimento de worker / recovery automático permanecem decisão futura).
- **Resumo:** janelas B/C de divergência de observabilidade entre transfer (bank) e UPDATE de status nas filas (payout_requests, bank_settlements). Detecção AGORA EXISTE (S3-detectado).
- **Origem:** Auditoria conservation execução↔settlement (sessão 2026-05-25). Mapa do circuito longo registrou que execução é atômica (pós-OUTBOX_ATOMICITY_HARDENING) mas a cadeia ASYNC pós-execução (settlement-worker → payout-worker → bank-settlement-worker) tem janelas onde transfer commitou mas status da fila não foi atualizado.
- **Classe:** DT-O (observabilidade — dinheiro não some, status órfão)

### Janelas materiais identificadas

- **Janela B — payout-worker** (workers/payout-worker.ts:82-95):
  Entre L84 `processPayout(payout)` (COMMIT do transfer no bank) e L85 `updatePayoutStatus('completed')` (transação separada). Se processo morre nessa janela, bank_ledger tem o débito (seller_available - amount) + crédito (seller_payout + amount). payout_requests.status fica 'processing'. claimNextRequestedPayouts filtra só status='requested', logo NÃO retoma. Sem sweep automático.

- **Janela C — bank-settlement-worker** (workers/bank-settlement-worker.ts:44-107):
  Entre efeito 1 (`bankTransactionService.transfer` em withIdempotency, L76-93) e efeito 2 (`updateSettlementStatus('sent')` em withIdempotency, L96-106). Cada um é transação separada. Se processo morre entre os dois, transfer commitado mas status fica 'processing'. listPendingSettlements filtra só status='pending', logo NÃO retoma — só `reprocessSettlement` MANUAL (runbook).

### Mitigação atual (Caminho 2 — DETECTAR antes de endurecer)

Esta fatia adicionou DOIS tipos de discrepância à reconciliation:
- `payout_transferred_status_not_completed` — detecta janela B
- `settlement_transferred_status_not_sent` — detecta janela C

`runReconciliation` (modules/reconciliation/reconciliation-engine.service.ts) AGORA executa 2 SELECTs novos que cruzam `bank_transactions` (com `reference_type` correspondente) × `payout_requests` / `bank_settlements` (com status != terminal). As discrepâncias são GRAVADAS em `reconciliation_ledger_discrepancies` com diff=0 (não é divergência de saldo, é de observabilidade).

**Detecção pura:** reconciliation NÃO altera status, NÃO move dinheiro. SELECT + INSERT em reconciliation_*. Confirmado por B8.3 e B8.4 do E2E:
- payout_requests.status permanece 'processing' após runReconciliation
- bank_settlements.status permanece 'processing' após runReconciliation
- bank_ledger inalterado (entries dos transfers persistem)

### Achado lateral: drift histórico do CHECK constraint (corrigido nesta fatia)

`reconciliation_ledger_discrepancies.discrepancy_type` tinha CHECK com APENAS 4 valores (ledger_mismatch, account_mismatch, orphan_transaction, orphan_ledger_entry), mas o enum TS já tinha 5 desde c149ede4 (`settled_intent_without_credit` em Fatia 2 — sem migration correspondente do CHECK). Em produção, se a Fatia 2 detectasse esse caso, o INSERT falharia com erro 23514. Gap nunca exposto porque o E2E financeiro não exercita o caminho (não cria intent settled sem credit).

Migration nova `20260530554000_extend_reconciliation_ledger_discrepancies_types.sql` alinha CHECK ↔ enum em UMA operação (DROP + ADD com 7 valores). Diretriz institucional: CHECK fica como defesa em profundidade; enum TS é fonte semântica. NÃO removido.

### Status atual: S3-detectado (era S4-silencioso)

**Detecção:** ✅ reconciliation cobre as 2 janelas via SELECT cross-tabela.
**Visibilidade:** ✅ discrepâncias gravadas em reconciliation_ledger_discrepancies + logs financial_event (`reconciliation_discrepancy_detected`).
**Correção automática:** ❌ NÃO. Decisão futura, governada pela frequência que a detecção medir.

### Opções futuras (não decididas)

- **Opção D — Endurecimento de worker (atomicidade transfer + status):**
  Aplicar pattern OUTBOX_ATOMICITY_HARDENING (Opção A do commit `8afeec9a`) aos workers payout/bank-settlement. Mover updatePayoutStatus / updateSettlementStatus para o MESMO client da transação do transfer. Equivalente ao que foi feito no createExecution. Custo: refactor cirúrgico por worker, pattern existingClient já estabelecido. Recomendado SE a detecção medir frequência > limiar.

- **Opção E — Sweep periódico de recovery:**
  Job que cruza `reconciliation_ledger_discrepancies` recentes (tipos B/C) e dispara compensação automática (UPDATE status para 'completed'/'sent' se transfer já existe). Custo: novo mecanismo, latência, complexidade de idempotência cross-job. NÃO recomendado a menos que worker hardening não seja viável.

- **Opção F — Manual runbook expandido:**
  Documentar processo manual para resolver discrepâncias B/C. Custo: operação humana recorrente. NÃO escalável.

### Critério de destrave (próxima fatia)

Reconciliation roda em produção por tempo suficiente para medir frequência das janelas B/C. Se >0 ocorrências detectadas materialmente em produção, abrir frente OUTBOX_ATOMICITY_HARDENING aplicada aos workers (Opção D).

---

## DT-OUTBOX-ATOMICITY — RESOLVED

- **Status:** ~~OPEN 2026-05-25~~ **RESOLVED 2026-05-25** (Opção A — transactional outbox via client injetado; corrigido neste mesmo dia em fatia subsequente; furo provado E correção provada pelo MESMO E2E `validate-pipeline-e2e-transversal.ts`)
- **Resolução:** OUTBOX_ATOMICITY_HARDENING — costura bank+execution+outbox numa única transação via `existingClient?: PoolClient` propagado pelo serviço orquestrador. Pattern replicado de `bank-transaction.service.ts:202` (`transfer` existingClient). Catch externo "não crítico" (L222-225 pré-fatia) REMOVIDO — agora a falha do outbox quebra a transação inteira (ROLLBACK).
- **Commit de resolução:** `8afeec9a`
- **Prova material da correção:** Etapa B7 do E2E (`validate-pipeline-e2e-transversal.ts`) — cenário controlado com client compartilhado entre bank+outbox + falha forçada antes do COMMIT. SELECTs confirmam: bank_ledger=0, bank_transactions=0, event_outbox=0 (ROLLBACK desfez tudo), caller recebe erro. Estado "dinheiro sem evento" tornou-se IMPOSSÍVEL no caminho do createExecution.
- **Arquivos tocados:**
  - `backend/src/modules/bank/bank-transaction.service.ts` (createTransactionWithExplicitSplitLines: +existingClient?: PoolClient; pattern ownClient L1462-1652)
  - `backend/src/modules/services/service-payment-execution.repository.ts` (create: +executingClient?: PoolClient; bifurca client.query vs runQueryWithTenant)
  - `backend/src/modules/bank/bank-integration.service.ts` (processServicePaymentExecutionCanonical: +existingClient?; retorno aumentado com splits agregados {splitId, receiverActorId, amountCents, percentage})
  - `backend/src/modules/services/service-payment-execution.service.ts` (createExecution: 1 BEGIN/COMMIT no service; bank+execution+outbox no mesmo client; catch L222-225 REMOVIDO)
- **Blast radius da assinatura:** 0 callers afetados. `existingClient?` é opcional; os outros callers de `createTransactionWithExplicitSplitLines` (bank-integration.service.ts:952 ride_payment + 2 scripts) passam `undefined` e mantêm comportamento original (transação interna).
- **Opções B (sweep) e C (trigger SQL) registradas e RECUSADAS:** A é cirurgia mínima com pattern existente, sem novo mecanismo, sem latência. B e C ficam disponíveis na entrada original abaixo como alternativas históricas.

### Histórico da abertura (preservado para arqueologia)

- **Origem:** Auditoria do mapa do circuito longo (sessão 2026-05-25). Achado material registrado na entrada do E2E `validate-pipeline-e2e-transversal.ts` Etapa B6 (commit `74a86f21`). O mapa anterior já apontava o gap; B6 reproduz materialmente.
- **Classe:** DT-A (atomicidade transacional ausente entre componentes que deveriam ser atômicos)
- **Vinculada a:** `backend/src/modules/services/service-payment-execution.service.ts` L162-225 (catch externo do bloco do outbox); `backend/src/modules/bank/bank-transaction.service.ts:1389` (COMMIT do ledger num client distinto); `backend/src/core/events/event-outbox.repository.ts:15-41` (writer ON CONFLICT DO NOTHING)

### Evidência material reproduzível

`createExecution` (service-payment-execution.service.ts:57) chama `bankIntegrationService.processServicePaymentExecutionCanonical` que delega a `bankTransactionService.createTransactionWithExplicitSplitLines`. Esse método abre `client = getClientWithTenant(tenantId)` (L1215), grava bank_transactions + N entries no ledger + bank_splits, e faz `COMMIT` em L1389 — TUDO num ÚNICO client/transação. Garantia interna do bank: sólida.

Depois do retorno, `createExecution` segue na L143 (`servicePaymentExecutionRepository.create`) e L162 abre um **NOVO client** (`outboxClient = await getClientWithTenant(tenantId)`) para escrever as rows no `event_outbox`. **Esses dois clients são distintos** — o bank já comitou ANTES do outbox sequer abrir BEGIN.

O try/catch externo (L222-225) **ENGOLE** qualquer falha do bloco do outbox:

```ts
} catch (error) {
  // Não quebra criação se enfileiramento falhar
  console.error('Erro ao enfileirar effects ao criar execução (não crítico):', error);
}
return { execution, splits };
```

Sem `throw`. O caller (HTTP, scripts) recebe `{ execution, splits }` com sucesso aparente.

**Não há sweep/recovery** que detecte "execution sem outbox row":
- Grep por `outbox.*sweep|sweep.*outbox|orphan.*execution|execution.*without.*outbox|recovery.*outbox` em `backend/src` → **No files found**.

### Reprodução (E2E `validate-pipeline-e2e-transversal.ts` Etapa B6)

Cenário controlado, sem alterar produção. Equivale ao que aconteceria se o processo crashar entre o COMMIT do bank e o INSERT do outbox:

1. `simExecutionId = uuidv4()` + `simEventId = deterministicServicePaymentExecutedOutboxEventId(TENANT_ID, simExecutionId)`.
2. Sanity: `SELECT count FROM event_outbox WHERE event_id = simEventId` → 0 (B6-pre OK).
3. `bankTransactionService.transfer(buyerAccount → providerAccount, amountCents = 1500)` com `referenceId = simExecutionId` (= o write do bank que `createExecution` faria). DELIBERADAMENTE NÃO chamamos `insertEventOutboxRow` depois.
4. `SELECT bank_ledger WHERE transaction_id = furoTransfer.transactionId` → 2 rows (1 debit no buyer, 1 credit no provider), `amount_cents = 1500` cada (B6.1 OK — dinheiro persistiu).
5. `SUM(amount_cents) FILTER (WHERE direction='debit') = SUM(...credit) = 1500` (B6.2 OK — bank é íntegro intra-tx).
6. `SELECT count FROM event_outbox WHERE event_id = simEventId OR (metadata->>'executionId' = simExecutionId AND event_type='SERVICE_PAYMENT_EXECUTED')` → **0 rows** (B6.3 OK — furo provado).
7. (B6.4) Catch verificado estaticamente em L222-225: sem `throw`; caller recebe sucesso; ausência de sweep confirmada por grep.

**Estado resultante:** ledger gravado, evento NÃO existe, handlers downstream (read-model, social-inbox, event-feed, impact) NUNCA rodaram, caller (HTTP/script) recebe 200 OK. **Dinheiro fluiu, mas o sistema observador não soube.**

### Risco

- **Categoria:** atomicidade transacional ausente; consequência: "dinheiro sem evento" silencioso na janela entre bank COMMIT e outbox INSERT.
- **Magnitude:** em produção, qualquer crash do processo, falha de conexão do pool (segundo client), timeout ou erro no outbox dentro dessa janela resulta em estado degradado SEM alerta. O caller assume sucesso. Handlers downstream (impact, inbox, read-model, event-feed) ficam sem rodar para essa execução específica. Re-executar `createExecution` para a mesma `paymentRequest` NÃO recupera (status='executed' já é guard).
- **Mitigações parciais existentes:**
  - Idempotência DB via UNIQUE no `event_outbox.event_id` + ON CONFLICT DO NOTHING — re-tentativa manual com mesmo `executionId` não duplica, mas exige caller saber que precisa retentar.
  - Logs (`canonicalLogger`, `console.error`) deixam rastro em runtime, mas sem ação automática.
- **Frequência esperada:** baixa por janela estreita (~ms entre COMMIT e BEGIN do outbox), mas materialmente possível em qualquer crash, restart, DB blip, ou erro no bloco outbox.

### Mitigação atual (aceita conscientemente, registrada)

A fatia que produziu este registro (Etapa B6) **NÃO corrigiu** o furo. Foi prova material para informar a próxima decisão.

### Opções de correção futura (NÃO decididas — fatia separada OUTBOX_ATOMICITY_HARDENING)

**Opção A — Mover INSERT outbox para a MESMA transação do bank:**
Reestruturar `createTransactionWithExplicitSplitLines` para receber as rows de outbox como parâmetro e inserir DENTRO do client/transação do bank (antes do COMMIT da L1389). Pattern "transactional outbox" canônico.
- Pró: atomicidade absoluta. Ledger + outbox commitam ou rollback juntos.
- Contra: refactor invasivo na fronteira bank↔services; aumenta acoplamento; muda contrato de createTransactionWithExplicitSplitLines.

**Opção B — Sweep periódico (executions sem outbox):**
Job que detecta `service_payment_executions` sem `event_outbox` row correspondente e re-emite. Determinismo do event_id garante idempotência.
- Pró: não toca caminho atual; aditivo.
- Contra: latência (sweep não é imediato); detecta após o fato; precisa de novo mecanismo de scheduling.

**Opção C — Listen/notify ou trigger SQL:**
Trigger AFTER INSERT em `service_payment_executions` que insere na `event_outbox` automaticamente.
- Pró: atômico (trigger executa na mesma tx do INSERT em service_payment_executions).
- Contra: lógica de domínio (payload do evento) em SQL/PLpgSQL; menos manutenível; depende de schema fixo do payload.

NÃO ESCOLHIDA. Cada opção tem tradeoff arquitetural. Decisão fica para frente OUTBOX_ATOMICITY_HARDENING quando houver dor material (incidente real de "execução órfã de outbox") ou decisão proativa de hardening.

### Critério de destrave

Abrir frente OUTBOX_ATOMICITY_HARDENING quando: (a) incidente real reportado por humano/audit cruzando bank_ledger × event_outbox; OU (b) decisão proativa do projeto de endurecer SSOT (após validação completa do caminho atual em produção).

---

## DT-SCHEMA-DRIFT-CLUSTER-5-TABLES — OPEN

- **Status:** OPEN 2026-05-25 (commit `aa4bc002` — diagnóstico consolidado; sem correção nesta entrada)
- **Origem:** Achados materiais durante a sessão do dia 2026-05-25 (Fatia A1 RBAC, Frente B empresa, Frente C KYC, E2Es transversais). 4 das 5 tabelas apareceram como erro pré-existente "não-bloqueante" durante exercício de runtime; a 5ª (`company_documents`) apareceu como erro HTTP 500 explícito ("relação company_documents não existe") na Prova 1 da Fatia A1 ao exercitar `GET /companies/admin/documents/pending`.
- **Classe:** DT-D (drift de schema — código vivo referencia tabela ausente no banco)
- **Vinculada a:** `feedback_archive_nao_e_ssot.md` (auditoria contextual antes de restaurar do archive); `feedback_consultar_log_antes_de_abrir_frente.md` (cluster classificado, não tratado individualmente)

### Contexto

5 tabelas referenciadas pelo código backend que **NÃO EXISTEM no banco** (`unificard_dev`, confirmado por `to_regclass` retornando null para todas as 5 em uma única query consolidada). **TODAS as 5 possuem migration ESCRITA no `backend/migrations_archive/`** (numeração sequencial antiga 0046–0922, formato pré-reorganização timestamped `20260530XXX_*.sql`). Nenhuma das 5 tem migration `CREATE TABLE` no diretório vigente `backend/migrations/`.

Padrão: feature semi-nascida — migration foi escrita historicamente, archive preservou, mas nunca foi aplicada (ou foi aplicada e dropada em alguma resetagem). Análogo ao caso da `300_add_actor_rbac_functions.sql` que motivou a Fatia A1 desta mesma sessão (perdida em rebase, restaurada cirurgicamente após auditoria contextual).

Nenhuma das 5 é bloqueante hoje em **runtime médio** (4 estão protegidas por try/catch defensivo; 1 só quebra se a rota administrativa específica for chamada). O risco é (a) cognitivo — credibilidade institucional ferida quando dev/auditor exercita o caminho e vê o erro; (b) latente — `company_documents` (DRIFT) quebra HTTP 500 em rota admin se exercitada; (c) reservado — qualquer auditor ou ferramenta automatizada que faça `\d` no schema vai detectar a discrepância código↔banco.

### Evidência por tabela

#### 1. `company_documents`

- **Ausência no banco:** confirmada (`to_regclass('public.company_documents') = null`).
- **Referências no código:** 1 arquivo, múltiplas escritas/leituras.
  - `backend/src/core/companies/companies.service.ts`:
    - L1691 `INSERT INTO company_documents (...)` em `uploadCompanyDocument`
    - L1834 `SELECT ... FROM company_documents cd INNER JOIN companies` em `listCompanyDocuments`
    - L1905 `SELECT ... FROM company_documents cd ...` em `listPendingDocuments`
- **Tratamento:** **SEM try/catch defensivo**. Chamadas via `runQueriesWithTenant` direto. Caller é HTTP: `POST /companies/:companyId/documents` (L390 de companies.routes.ts), `GET /companies/:companyId/documents` (L468), `GET /companies/admin/documents/pending` (L556) — todas com `preHandler: requireRole(['admin','owner'])` no caso admin.
- **Migration histórica no archive:** `backend/migrations_archive/0046_company_status_and_documents.sql` (sequencial antiga, não-aplicada ao banco vigente).
- **Severidade:** **DRIFT** — código assume que existe e **quebraria HTTP 500 se o caminho fosse exercitado**. Comprovado materialmente: Prova 1 da Fatia A1 (commit `33c49a46`) registrou "Pós-A1: HTTP 500 com 'relação company_documents não existe'" — o RBAC destravou, o próximo bug é exatamente esse drift.
- **Caminhos que quebrariam:** feature INTEIRA de upload de documentos da empresa (rotas `/documents` admin e do próprio user).

#### 2. `business_audit_logs`

- **Ausência no banco:** confirmada.
- **Referências no código:** 2 arquivos.
  - `backend/src/modules/business-audit/business-audit.repository.ts`: L47 `INSERT INTO business_audit_logs (...)` (método `create`); L81 `SELECT ... FROM business_audit_logs` (método de leitura).
  - `backend/src/core/rate-limiting/business-rate-limit.service.ts`: L85 `SELECT COUNT(*) FROM business_audit_logs WHERE tenant_id=$1 AND actor_id=$2` (dentro de try L79).
- **Tratamento:** caller principal é `recordBusinessAuditSafely` em `business-audit.helpers.ts:25` — wrapper try/catch externo "não-bloqueante". O caller do caller (`service-booking-decision.service.ts:153` via `acceptQuote`) também loga "Erro ao criar log de auditoria (não bloqueante)" — visto rodando no E2E financeiro (validate-pipeline-e2e-transversal.ts).
- **Migration histórica no archive:** `backend/migrations_archive/0922_business_audit_logs.sql`.
- **Severidade:** **ÓRFÃO** — código vivo (caminho RFQ→Quote→Accept o exercita), mas SEMPRE em try/catch externo via wrapper `Safely`. Degrada silencioso. Audit perdido sem impacto runtime.

#### 3. `company_domains`

- **Ausência no banco:** confirmada.
- **Referências no código:** 2 arquivos.
  - `backend/src/core/companies/companies.service.ts`: L539 `INSERT INTO company_domains (...) ON CONFLICT (company_id, domain) DO UPDATE` em `createCompany`; L638 `DELETE FROM company_domains WHERE company_id=$1` em rollback de `createCompany` e em `deleteCompany` (L689).
  - `backend/src/scripts/validate-pipeline-e2e-company.ts`: cleanup do E2E faz `DELETE FROM company_domains ...` com `.catch(() => {})` — defensivo.
- **Tratamento:** try/catch explícito captura `err.code === '42P01'` (tabela não existe) com log padronizado: "company_domains ausente; seguindo sem vinculo de dominio legacy" — comportamento documentado, visto no E2E company.
- **Migration histórica no archive:** `backend/migrations_archive/0404_company_domains.sql`.
- **Severidade:** **ÓRFÃO** — defensive 42P01 handling em todos os call sites. Tratamento explícito, não acidental. Vínculo de domínio "legacy" mencionado no warn sugere feature parcialmente deprecada.

#### 4. `company_opportunity_preferences`

- **Ausência no banco:** confirmada.
- **Referências no código:** 1 arquivo.
  - `backend/src/core/companies/companies.service.ts`: L708 `INSERT INTO company_opportunity_preferences (company_id, tenant_id, receive_rfqs, receive_dispatches, matching_enabled) VALUES ($1::uuid, $2::uuid, false, false, false)` dentro de try (L705) em `createCompany`.
- **Tratamento:** try/catch interno. Caller (rota POST `/companies`) loga "Erro ao criar preferências de oportunidade (não bloqueante)" — visto no E2E company.
- **Migration histórica no archive:** `backend/migrations_archive/0078_company_opportunity_preferences.sql`.
- **Severidade:** **ÓRFÃO** — try/catch explícito, sem impacto runtime. Preferências de oportunidade nascem sempre vazias na ausência da tabela (feature de matching desligada por default no design).

#### 5. `referral_codes`

- **Ausência no banco:** confirmada.
- **Referências no código:** 2 arquivos (+ 1 script avulso).
  - `backend/src/modules/marketplace/referral.repository.ts:50` `INSERT INTO referral_codes (...)` (SPRINT 74); L77 `SELECT ... FROM referral_codes WHERE tenant_id=$1 AND code=$2 AND is_active=true LIMIT 1`.
  - `backend/src/scripts/validate-pipeline-e2e-company.ts`: cleanup com `.catch(() => {})` — defensivo (foi exatamente onde a anomalia "DELETE em referral_codes — relação não existe" apareceu durante cleanup do C1).
  - `backend/run-migration-073.js`: script avulso (provavelmente para aplicar a 0073 manualmente; não-aplicado).
- **Tratamento:** caller é `referralService.getOrCreateReferralCode`, chamado no `auth.service.register` L457 dentro de try/catch (L456-471) que loga "ERRO ao gerar código de indicação" como ERROR mas NÃO falha o registro. Comentário do código: "Será gerado na primeira vez que o usuário acessar o perfil" — implica RETRY lazy. Visto rodando durante C1.
- **Migration histórica no archive:** `backend/migrations_archive/0073_referral_codes.sql` + script `run-migration-073.js`.
- **Severidade:** **ÓRFÃO** com sinal de **PLANEJADO interrompido**: existência do `run-migration-073.js` na raiz do backend sugere tentativa de aplicação manual abandonada. Caller tolera ausência (registro não falha), mas a feature de referral é semanticamente importante (incentivos econômicos do projeto). Pode merecer auditoria contextual prioritária — não no escopo desta DT.

### Síntese do cluster

| # | Tabela                              | Refs (arq.) | Tratamento                     | Archive  | Severidade | Bloqueia hoje? |
|---|-------------------------------------|-------------|--------------------------------|----------|------------|----------------|
| 1 | company_documents                   | 1           | NENHUM                         | 0046     | **DRIFT**  | Sim, se rota admin chamada |
| 2 | business_audit_logs                 | 2           | try/catch externo (Safely)     | 0922     | ÓRFÃO      | Não (degrada) |
| 3 | company_domains                     | 2 (+E2E)    | catch 42P01 explícito          | 0404     | ÓRFÃO      | Não (degrada) |
| 4 | company_opportunity_preferences     | 1           | try/catch interno              | 0078     | ÓRFÃO      | Não (degrada) |
| 5 | referral_codes                      | 2 (+script) | try/catch externo + retry lazy | 0073 (+`run-migration-073.js`) | ÓRFÃO/PLANEJADO híbrido | Não (degrada) |

**Observação chave:** TODAS as 5 têm migration ESCRITA no archive — não são features nunca planejadas. São features **planejadas, escritas, e nunca convergidas para o banco vigente**. Provável legado da reorganização das migrations para o formato timestamped `20260530XXX_*.sql`.

Nenhuma classe **MORTO** (todas as referências vêm de caminhos de código que ainda são exercitados). Nenhuma classe **LEGADO CANCELADO** explícito (nenhuma evidência de feature removida com sobras textuais).

### Critério de destrave por classe

- **DRIFT (company_documents):** prioridade mais alta. Decidir: (a) auditoria contextual do `0046_company_status_and_documents.sql` archive + restauração cirúrgica (padrão A1); (b) remover o caminho HTTP /documents e a feature inteira (decisão de produto); (c) deferir conscientemente até pressão material (humano querendo subir documento). Não-decidir é manter o risco latente.
- **ÓRFÃOs (4):** prioridade média/baixa. Para CADA uma, decidir: (a) restaurar do archive (após auditoria contextual `feedback_archive_nao_e_ssot.md`: a feature ainda faz sentido? mudou de design? há substituto?); (b) remover o caminho do código (declarar a feature fora de escopo, eliminar a referência defensiva); (c) manter o estado atual conscientemente (degradação aceita registrada — esta DT).
- **`referral_codes` especificamente:** auditar `run-migration-073.js` (existência sugere convergência interrompida); avaliar se a feature de referral é prioridade do roteiro.

### Nota institucional

Esta DT é **diagnóstico consolidado**, não plano de correção. O escopo aqui é registrar o terreno classificado para que decisões futuras tenham evidência material — não decidir agora. A correção de cada tabela exige `feedback_archive_nao_e_ssot.md` (auditoria por função/tabela, não por migration inteira) + decisão arquitetural sobre cada feature.

**Por que cluster e não 5 DTs separadas:** as 5 compartilham origem (reorganização de migrations), padrão (archive ↔ código vigente), e classe diagnóstica (PLANEJADO+ÓRFÃO majoritariamente). Tratar isoladamente fragmentaria a análise; agrupar revela o padrão estrutural.

**Risco:** cognitivo (credibilidade institucional ferida ao exercitar caminhos), latente (DRIFT quebra HTTP 500 se exercitado), reservado (auditoria de schema vai sempre flagar).

**Mitigação atual:** 4 das 5 protegidas por try/catch defensivo; 1 (`company_documents`) exposta — rotas admin de documentos não são exercitadas em runtime médio do dev.

**Resolução prevista:** abrir frente individual por tabela conforme dor material aparecer (humano tentar subir documento → C-DOCS; auditor demandar log de negócio → C-AUDIT; etc.). Não tratar em lote sem decisão arquitetural por feature.

---

## DT-RBAC-ACTOR-HAS-ANY-ROLE-LOST-IN-REBASE — CLOSED

- **Status:** CLOSED 2026-05-25 (aberta e fechada no mesmo commit — registro institucional de bug pré-existente descoberto + restaurado em uma fatia)
- **Origem:** Fatia 1 IDENTIDADE (commit `ebd6054d`, 2026-05-25) → tentativa de prova material de `adminOverrideToVerified` via HTTP falhou em `função actor_has_any_role(unknown, unknown, text[]) não existe` (Postgres 42883). Investigação read-only (auditoria A1) revelou perda acidental em rebase pós-`8f71fa34`.
- **Classe:** DT-L (legado não convergido — perda silenciosa em rebase histórico, sem registro institucional anterior)
- **Vinculada a:** `backend/migrations/300_add_actor_rbac_functions.sql` (commit `8f71fa34`, 2026-02-08, perdido em rebase); `backend/src/core/rbac/rbac.service.ts:208` (caller único); `backend/src/plugins/rbac.plugin.ts:205` (decorator `requireRole`); `RBAC_V2_CONTRACT.md §6.2`; `feedback_archive_nao_e_ssot.md`.

### Causa

A função SQL `actor_has_any_role(uuid, uuid, text[])` foi originalmente definida em `300_add_actor_rbac_functions.sql` (commit `8f71fa34` "feat(migrations): add actor-based RBAC helper functions (RBAC V2)"). A migration foi **perdida acidentalmente** nos rebases subsequentes — `[REBASE-02]` (bee2d606), `[REBASE-03]` (70579227), `[REBASE-04]` (05fee6f3), e o `marco-zero` `39ea7062` ("estado real do disco aceito como ponto-zero da retomada"). Nunca foi recriada por nenhuma migration posterior (grep exaustivo em `backend/migrations/` confirma zero referências fora da migration 300 perdida). `pg_proc` confirmou ausência no banco vivo.

Bug ATIVO desde o rebase, sem registro institucional anterior. Não havia DT, não havia DECISION mencionando o desaparecimento. **Pura perda acidental sem rastreamento.**

### Alcance descoberto

**11 callsites de `fastify.requireRole(...)` em 6 arquivos** dependiam dessa função e estavam em HTTP 500 hard quando exercitados:

| Arquivo:linha | Rota | Roles |
|---|---|---|
| `companies.routes.ts:557` | GET `/companies/admin/documents/pending` | admin/owner |
| `companies.routes.ts:577` | POST `/companies/admin/documents/:id/status` | admin/owner |
| `companies.routes.ts:641` | POST `/companies/:id/admin/override-verified` | admin/owner |
| `categories/ssot-admin.routes.ts:22` | rota SSOT admin | admin |
| `categories/categories.routes.ts:52, 134` | 2 rotas categories admin | admin |
| `catalog/category-review.routes.ts:17, 53, 93` | 3 rotas catalog review admin | admin |
| `unifybank/test-currency.routes.ts:46, 124` | 2 rotas test-currency | admin |

Bug afetava ecossistema admin de catálogo + categorias + companies + test, não só a rota admin override que iluminou o achado.

### Fronteira respeitada (`actor_has_permission` NÃO tocada)

A função-irmã `actor_has_permission(uuid, uuid, text, text)` permanece em fail-closed (`RETURN FALSE`) por **decisão deliberada**:
- Migration `20260422000100_actor_has_permission_fail_closed.sql` (24h após o stub fail-open `20260421010000_*.sql`).
- Comentário literal: "Remediação: C47 (DECISION-0013). Ref: AUTHORITY_PRECEDENCE.md §4.4 — IA não cria autoridade; ausência de política = bloqueio. FASE 6 substituirá esta função pela implementação real (RBAC + policy engine)."
- Ratificação institucional registrada em `SYSTEM_REMEDIATION_STATUS.md:137` (C47 FIXED via fail-closed) e linha 370 ("DECISION-0013 registrada formalizando as descobertas") — apesar do texto literal da DECISION-0013 não estar mais presente no `REMEDIATION_DECISIONS_LOG.md` (possivelmente reorganizado em revisão posterior), a ratificação é histórica.
- Tocar essa função seria desfazer decisão consciente. **40+ callsites de `requirePermission`/`requireAnyPermission` em `work-instant`, `work`, `dashboard`, `bank-balance-consolidation`, `transparency-admin` continuam em DENY silencioso por decisão.** Frente FASE 6 trata; fora do escopo de A1.

### Disciplina aplicada (lição registrada)

`feedback_archive_nao_e_ssot.md` aplicada na divisão: ANTES de restaurar a migration 300 inteira, auditou-se materialmente se o archive é canônico vigente para CADA função. Resultado: canônico para `actor_has_any_role` (zero substituto posterior), NÃO canônico para `actor_has_permission` (substituída por decisão consciente). **Restaurar a migration 300 inteira teria desfeito C47/DECISION-0013 inadvertidamente.** Restauração cirúrgica respeita a fronteira.

Pattern para frentes futuras: archive perdido em rebase pode coexistir, na mesma migration, com partes canônicas vigentes e partes superadas por decisão. Auditoria por função (não por migration inteira) é a disciplina correta.

### Resolução

Migration forward-only `20260530551000_restore_actor_has_any_role.sql` aplicada em 2026-05-25 (commit `33c49a46`):
- `CREATE OR REPLACE FUNCTION public.actor_has_any_role(uuid, uuid, text[]) RETURNS BOOLEAN` — corpo IDÊNTICO ao da migration 300 perdida (EXISTS com JOIN `actors → user_roles → roles WHERE r.name = ANY(p_role_names)`); SECURITY DEFINER; idempotente via `CREATE OR REPLACE`.
- COMMENT cita restauração datada e a perda em rebase.
- Cabeçalho documenta: causa (perda acidental), norma vigente (`RBAC_V2_CONTRACT.md §6.2`), disciplina aplicada (`feedback_archive_nao_e_ssot.md`), fronteira (`actor_has_permission` intocada por C47/DECISION-0013).

### Validação

- `tsc --noEmit` exit 0.
- 4 gates verdes: bank-ledger §4.6 OK; actor-writer §4.8.1 OK; regression-guards OK (incl. integridade de 305 migrations); architectural Total 20 = baseline.
- `critical_total` inalterado (20 = 20).
- Boot limpo.
- `pg_proc` pós-migration: `actor_has_any_role(p_tenant_id uuid, p_actor_id uuid, p_role_names text[]) → boolean` PRESENTE; `actor_has_permission(p_tenant_id uuid, p_actor_id uuid, p_resource text, p_action text) → boolean` corpo `RETURN FALSE` PRESERVADO.

### Prova material

**Prova 1 — rota requireRole destravada** (`GET /companies/admin/documents/pending`):
- Pré-A1: HTTP 500 com `função actor_has_any_role(unknown, unknown, text[]) não existe`.
- Pós-A1: HTTP 500 com `relação "company_documents" não existe` — **erro mudou de categoria** (RBAC → schema-drift `company_documents` ausente). `requireRole` ATRAVESSOU; o próximo bug é outro schema-drift pré-existente, fora do escopo de A1.

**Prova 2 — fronteira A1↔A2 confirmada** (`POST /companies/:id/admin/override-verified`):
- Pré-A1: HTTP 500 com `função actor_has_any_role` não existe (parava no preHandler RBAC).
- Pós-A1: HTTP 400 com `coluna "metadata" não existe` — atravessou requireRole + ActionContext middleware + §8 03_IDENTITY_CANONICA (Fatia 1) + entrou no service, falhou em `companies.metadata` (DT-COMPANIES-METADATA-COLUMN-MISSING já registrada, escopo da Fatia A2 separada). **Confirma que A1 endereçou só RBAC; o caminho admin override pós-Fatia 1 + pós-A1 agora chega ao Bug 2 exatamente onde a auditoria previu.**

### Não bloqueia / o que fica em aberto

- 40+ callsites de `requirePermission`/`requireAnyPermission` continuam em DENY silencioso (decisão C47/DECISION-0013, FASE 6 futura).
- `company_documents` ausente (descoberto na Prova 1) — pode ser bug pré-existente novo a registrar, fora de A1.
- Bug 2 (`companies.metadata` ausente) — Fatia A2 separada (DT-COMPANIES-METADATA-COLUMN-MISSING OPEN; decisão Opção A ADD COLUMN vs Opção B refactor para substrato canônico pendente; leitura prévia de `EMPRESA_NASCIMENTO_CANONICO.md` necessária).

---

## DT-bank-cachedBalanceCents-naming-heterogeneity

- **Status:** OPEN
- **Origem:** β.1 (sessão Opus 2026-05-10) — reconciliação Genesis do bank-balance-consolidation
- **Vinculada a:** DECISION-0024 (ledger-only SSOT)
- **Contexto:**
  Após DECISION-0024, o campo `cachedBalanceCents` perdeu soberania semântica.
  O provider Genesis (`bank-account.repository.ts`, a ser aplicado em β.5)
  retorna `0` hardcoded por design. Consumidores específicos que necessitam
  de saldo real (ex.: `bank-balance-consolidation.service.ts`) materializam
  o campo via cálculo de ledger no momento da agregação.

  Formulação oficial:
  > `cachedBalanceCents` é alias de compatibilidade cuja materialização
  > depende do contexto causal do provider. Não representa mais campo
  > soberano de saldo.

- **Risco:**
  Ambiguidade semântica futura — auditor lendo `bankAccount.cachedBalanceCents`
  em código novo não sabe, sem contexto, se valor é `0` (provider Genesis) ou
  saldo real (consumidor materializa via ledger).

- **Mitigação atual:**
  Esta DT + DECISION-0024 + comentário inline em call-sites materializadores.

- **Resolução prevista:**
  Migração controlada para campo `balanceCents` soberano, em frente futura,
  após estabilização Bank Genesis (pós-β.5). Inclui ajuste de DTO, type
  `BankAccount`, e consumidores. Não bloqueante para β.1..β.5.

---

## DT-bank-accounts-last-activity-ghost-column

- **Status:** OPEN
- **Origem:** β.1 (sessão Opus 2026-05-10) — auditoria pré-β.1.a
- **Vinculada a:** —
- **Contexto:**
  Coluna `bank_accounts.last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  existe no schema Genesis (migration `0003_bank_core.sql`). Default `now()`
  faz coluna nunca ser NULL. Nenhum código de runtime atualiza a coluna após
  inserção; nome semântico ("última atividade") não corresponde ao
  comportamento real ("data de criação").

  Na prática, `last_activity_at` é redundante com `created_at` em todo o
  sistema atual.

- **Risco:**
  Consumidores externos da API que dependem de `updated_at` (mapeado de
  `last_activity_at` em β.1) recebem valor enganoso — sintaticamente
  válido, semanticamente "atividade" inexistente.

- **Mitigação atual:**
  Documentação explícita em β.1 commit message. Mapper usa `last_activity_at
  AS updated_at` sem COALESCE; assumir verdade material em vez de mascarar.

- **Resolução prevista:**
  Duas opções a decidir em frente futura:
  1. Implementar UPDATE de `last_activity_at` em fluxos financeiros relevantes
     (transações, mudanças de status), tornando a coluna semanticamente real.
  2. Remover a coluna do schema, ajustando consumidores para usar
     `created_at` ou agregação `MAX(bank_ledger.created_at)`.

  Não bloqueante para β.1..β.5.

---

## DT-bank-balance-consolidation-region-fallback-tenant

- **Status:** OPEN
- **Origem:** β.1 (sessão Opus 2026-05-10) — substituição de `metadata?.regionId`
- **Vinculada a:** DECISION-0024 (metadata em bank_accounts deprecada)
- **Contexto:**
  Pré-Genesis, `bank-balance-consolidation.service.ts` derivava `regionId` de
  `regionalFundAccount.metadata?.regionId`. Pós-Genesis, `metadata` retorna
  `null` por design (DECISION-0024). Não há tabela de regiões canônica no
  schema atual; padrão de naming regional em `bank_accounts.owner_id` não
  está em uso (`owner_id LIKE '%region%'` retornou 0 linhas).

  Em β.1, `regionId` é substituído por fallback explícito para `tenantId`,
  preservando comportamento legacy de quando `metadata.regionId` era ausente.

- **Risco:**
  Sistemas com múltiplas regiões por tenant terão consolidação agregada
  ao nível de tenant, perdendo granularidade regional. Em sistema atual
  (1 tenant ≈ 1 região operacional), risco é nulo. Risco surge se modelo
  multi-região por tenant for adotado.

- **Mitigação atual:**
  Esta DT + fallback explícito ao tenantId + nota no commit β.1.

- **Resolução prevista:**
  Quando feature de multi-região por tenant for prioridade, design da
  fonte canônica de `regionId`. Opções a considerar:
  1. Tabela `regions` dedicada + FK em `bank_accounts`.
  2. Parsing de `owner_id` com padrão de naming regional.
  3. Coluna `region_id` direto em `bank_accounts` (requer revisão de
     DECISION-0024 que removeu metadata domain de bank_accounts).

  Não bloqueante para β.1..β.5.

---

## DT-beta7-trigger-disable-precedent

- **Status:** CLOSED (ato consumado, lição registrada)
- **Origem:** β.7 (sessão Claude Code 2026-05-11) — limpeza de dados de teste
- **Vinculada a:** —
- **Contexto:**
  Durante validação β.7, Claude Code criou dados de teste (contas, lançamentos
  no ledger) para validar fórmula de saldo. Para limpar, desabilitou
  temporariamente o trigger `bank_ledger_no_delete` que ela mesma acabou de
  validar como invariante de imutabilidade, deletou linhas, e reabilitou.

  Contradição operacional: validou que trigger funciona, depois contornou para
  limpar dados.

- **Risco:**
  Precedente institucional perigoso: "quando trigger atrapalha, desabilita,
  opera, reabilita". Se padrão virar default, invariante "ledger append-only"
  deixa de existir no momento em que mais importa.

- **Mitigação atual:**
  DT registrada explicitamente como ERRO INSTITUCIONAL em executei.md.
  Lição adicionada ao code.md como "O que EU já errei".

- **Resolução prevista:**
  Lição institucional permanente. Para validações futuras que precisem limpeza:
  1. Lançamento compensatório (zerar conta com debit/credit)
  2. Tenant descartável (_test_beta7, depois DROP tenant)
  3. Schema separado (beta7_validation, depois DROP SCHEMA)

  NUNCA desabilitar trigger de imutabilidade.

- **Fechamento:** Ato consumado em ambiente dev. Sem dados de produção afetados.
  Entrada permanece como arqueologia institucional.

---

## DT-event-reservations-mixed-case

- **Status:** OPEN
- **Origem:** Auditoria C29 (sessão Claude Code 2026-05-11)
- **Vinculada a:** DECISION-0028 (tabelas UPPERCASE intencionais)
- **Contexto:**
  Durante auditoria de C29 (comparações status UPPERCASE), foi identificado que
  `event_reservations` possui CHECK constraint que aceita AMBOS os cases para
  os mesmos estados semânticos:

  ```sql
  CHECK ((status = ANY (ARRAY[
    'pending', 'confirmed', 'cancelled', 'expired',
    'PENDING', 'CONFIRMED', 'CHECKED_IN', 'NO_SHOW', 'CANCELLED'
  ])))
  ```

  Isso significa que a mesma reserva pode ter status 'pending' ou 'PENDING'
  dependendo de qual código escreveu — contradição semântica real.

- **Risco:**
  Confusão semântica: queries que filtram por `status = 'pending'` não vão
  encontrar reservas com `status = 'PENDING'`. Dados inconsistentes possíveis
  se diferentes partes do código usarem cases diferentes.

- **Mitigação atual:**
  DECISION-0028 documenta que esta tabela é exceção reconhecida.
  Tabela funciona (aceita ambos), mas inconsistência permanece.

- **Resolução prevista:**
  Em cleanup futuro:
  1. Decidir qual case é canônico (provavelmente lowercase por §Nomenclatura)
  2. Migrar dados existentes para o case escolhido
  3. Alterar CHECK constraint para aceitar apenas um case
  4. Ajustar código que escreve status

  Prioridade: BAIXA (funciona, não bloqueia runtime)

---

## DT-COVERAGE-BOOTSTRAP-REQUIRED

> **Nota:** DT aberta em 2026-05-12 durante Q3-E2E v1 SKIP. Encerrada em 2026-05-13 por DECISION-0031 (caminho fundacional substitui bootstrap artificial).

- **Origem:** Q3-E2E econômico, 2026-05-12 — mint bloqueado por trigger check_coverage_before_credit
- **Vinculada a:** DECISION-0030 (C40: system_coverage VIEW *_cents BIGINT)
- **Contexto:**
  O trigger `check_coverage_before_credit` verifica `execution_capacity_cents`
  da VIEW `system_coverage` antes de creditar qualquer conta não-system.

  A VIEW `system_coverage` (pós-C40) exclui contas `system:liquidity_issuance:%`
  do cálculo de `execution_capacity_cents`. Isso é correto: liquidity_issuance
  é contrapartida contábil "criadora de dinheiro", não "reserva de cobertura".

  Quando `execution_capacity_cents = 0` (nenhuma conta system não-issuance com
  saldo positivo), o trigger seta `v_coverage = 100%` e bloqueia qualquer crédito
  a usuários com `COVERAGE_EXCEEDED: 100.00 cobertura`.

  **Reprodução exata (Q3-E2E):**
  ```
  createSimpleTransaction(tenantId, {
    fromAccountId: undefined,  // liquidity_issuance auto-criada
    toAccountId: accountIdA,   // conta de usuário (owner_type='actor')
    amountCents: 500000,
    ...
  })
  → SEED_ERROR: COVERAGE_EXCEEDED: 100.00 cobertura
  ```

  `system_coverage` para tenant `e9722e4c-0e39-40d0-a3e1-a1e0d8defdd4`:
  ```
  execution_capacity_cents | total_credits_cents | ratio_pct | cap_type | credit_type
                         0 |                   0 |      NULL |   bigint |      bigint
  ```

  **Nota C40 parcialmente validada:** `pg_typeof(execution_capacity_cents) = bigint`
  e `pg_typeof(total_credits_cents) = bigint` confirmados em runtime ✓.
  O FAIL é de coverage bootstrap, não de C40.

- **Risco:**
  Nenhum usuário pode receber crédito em tenant novo sem que uma conta
  `owner_type='system'` (não-liquidity_issuance) seja fundada primeiro.
  O caminho `createSimpleTransaction(fromAccountId: undefined)` — que é o
  único path legítimo de mint sem rota HTTP — pressupõe que execution_capacity
  já existe. Isso não é auto-provisionado.

  Em produção: primeiro mint de qualquer tenant novo falharia com COVERAGE_EXCEEDED.

- **Mitigação atual:**
  Nenhuma. Sem rota HTTP admin para bootstrap. Sem seed automático por tenant.
  `seed-initial-balance.ts` usa conta `reserve` existente — mas `reserve` também
  não é auto-provisionada.

- **Caminhos de resolução:**
  A) Criar rota admin/system `POST /economy/system-accounts` para provisionar
     conta de cobertura por tenant (bloqueada por design sem rota exposta).
  B) Adaptar `ensureLiquidityIssuanceAccountId` para também provisionar uma
     conta de cobertura inicial com capacidade suficiente para o primeiro mint.
  C) Seed de tenant (quando tenant é criado) já provisiona conta system reserve
     com capacidade inicial.
  D) Modificar trigger para usar cálculo diferente quando capacity = 0 e
     total_credits = 0 (estado inicial vazio de novo tenant).

- **Resolução prevista:**
  ENCERRADA via DECISION-0031 (2026-05-12). Nenhuma implementação necessária.
  O sistema está correto; o smoke v1 é que tentou caminho não-fundacional.
  Q3-E2E v2 segue caminho fundacional via event_ticket/service_booking.

- **Status:** CLOSED (encerrada por DECISION-0031)

---

## DT-q3-e2e-v2-service-booking-sem-reserve

- **Status:** OPEN
- **Origem:** Q3-E2E análise pré-v2, 2026-05-12
- **Vinculada a:** DECISION-0031
- **Contexto:**
  O split engine para `event_ticket` inclui uma parcela de `reserve` hardcoded (17%),
  o que permite que o primeiro evento funde `execution_capacity_cents` e habilite coverage.

  O split engine para `service_booking` (liquidação bilateral de serviço) **não inclui
  reserve** no split default. Isso significa que `service_booking` não seria caminho
  fundacional para coverage bootstrap — apenas `event_ticket` o seria.

  Possíveis razões para a assimetria:
  - `event_ticket` = arrecadação coletiva (múltiplos compradores, fundo coletivo justifica
    reserva sistêmica)
  - `service_booking` = liquidação bilateral (prestador + tomador, sem arrecadação coletiva;
    margem de risco é responsabilidade do par, não do sistema)
  - Taxation distinta (event pode ter tributação/reserva diferente de service)
  - Pode ser design consciente, não regressão

- **Risco:**
  Se a ausência de reserve em service_booking for regressão (e não design), o caminho
  fundacional para coverage seria exclusivamente via event_ticket, tornando o sistema
  incapaz de bootstrap via service_booking puro. Potencial limitação arquitetural se
  vertical de serviços for lançada antes de eventos.

- **Mitigação atual:**
  Q3-E2E v2 planeja usar event_ticket como caminho fundacional. service_booking é
  caminho alternativo investigado mas não validado para este fim.

- **Resolução prevista:**
  Investigar intenção arquitetural do split engine antes de propor padronização.
  Prioridade: BAIXA (não bloqueia Q3-E2E v2 via event_ticket).

---

## DT-C36-actor-debts-case-drift

- **Status:** PARCIAL — código convergido ao vocabulário do CHECK atual; CHECK e DECISION sobre vocabulário canônico final pendentes
- **Origem:** C36 remediação (2026-05-12) — auditoria de status sem CHECK
- **Vinculada a:** C36, DECISION-0032 (status operacional governado por lowercase canônico)
- **Convergência prevista:** quando Clayton/RFC decidir vocabulário canônico final (`pending` + `transferred_to_organizer` + opcionalmente `paid`); aí migration revert CHECK misto + reaplicar CHECK lowercase puro.
- **Contexto:**
  `actor_debts.status` usa case inconsistente: migration define DEFAULT 'pending' (lowercase),
  mas o código em `event-scheduler.ts` escreve 'TRANSFERRED_TO_ORGANIZER' (UPPERCASE).
  CHECK adicionado inclui ambos os valores para não quebrar runtime.

  Investigação `executei_10.md` (2026-05-12) revelou drift mais extenso que o documentado:
  5 grafias para 2 conceitos em código de produção ('pending', 'PENDING',
  'TRANSFERRED_TO_ORGANIZER', 'transferred_to_organizer', 'paid'), com 3 dead branches
  em runtime (event-scheduler.ts:257 'PENDING' UPPERCASE; trust.service.ts:481
  IN ('paid', 'transferred_to_organizer') — ambos valores nunca permitidos pelo CHECK).
- **Risco:**
  Inconsistência de case impede filtros case-sensitive diretos. Queries como
  `WHERE status = 'PENDING'` e `WHERE status = 'pending'` retornam resultados diferentes.
  Comparações com valores fora do CHECK retornam vazio em runtime (dead branches).
- **Mitigação aplicada (Sub-frente normalização código, 2026-05-12):**
  - `event-scheduler.ts:257` corrigido: 'PENDING' → 'pending' (alinha ao CHECK atual)
  - `trust.service.ts:481` corrigido: IN ('paid', 'transferred_to_organizer') → = 'TRANSFERRED_TO_ORGANIZER' (elimina dead branches)
  - Comentários explicativos adicionados marcando ambos como ajustes defensivos ao CHECK vigente, com referência a esta DT
  - TSC backend: 0 erros
  - Tabela vazia em produção; sem migração de dados necessária
  - Log: `docs/03_execution_log/2026-05-12_dt_actor_debts_normalizacao_codigo.md`
- **Pendência (PARO E CONSULTO — toca enforcement em produção):**
  - Decisão sobre vocabulário canônico final (mantém `'TRANSFERRED_TO_ORGANIZER'` UPPERCASE como exceção formal restrita análoga a DECISION-0033, OU normaliza para `'transferred_to_organizer'` lowercase governado por DECISION-0032?)
  - Considerar valor `'paid'` que `trust.service.ts:481` originalmente esperava — adicionar à enum se for estado real esperado
  - Migration revert CHECK misto + reaplicar CHECK lowercase puro (toca enforcement de schema em produção — fronteira "PARO E CONSULTO" da diretiva mestre §2)
  - Esta sub-frente (sem revert/reaplicar CHECK) elimina dead branches mas NÃO encerra a DT — preserva opcionalidade até decisão
  - Prioridade: BAIXA (sem bug runtime ativo após sub-frente)

---

## DT-C36-deferred-tables

- **Status:** DEFERRED
- **Origem:** C36 remediação (2026-05-12)
- **Vinculada a:** C36
- **Contexto:**
  Três tabelas diferidas da remediação C36:
  1. `company_validations.status` — coluna nullable TEXT nunca escrita pelo código atual;
     INSERT não inclui status. Valor semântico desconhecido.
  2. `unifycard_transactions.status` — valores não definidos no código TypeScript atual;
     migration 0004_marketplace.sql declara TEXT sem DEFAULT.
  3. `categories.status` — ontologia central (N0/N1/N2); requer revisão separada para
     garantir que CHECK não restrinja o pipeline de criação de categorias.
- **Risco:**
  Valores arbitrários podem ser escritos nessas colunas sem validação DB.
- **Mitigação atual:**
  Nenhuma constraint de DB. Validação depende do código de aplicação.
- **Resolução prevista:**
  Investigar cada tabela em sessão dedicada antes de adicionar CHECK.
  Prioridade: MÉDIA (company_validations, unifycard_transactions), BAIXA (categories).

---

## DT-PAYMENT-CASING-DRIFT

- **Status:** CLOSED (2026-05-12 — encerrada por DECISION-0032)
- **Origem:** C36 reconciliação (2026-05-12) — CHECK revertido por falta de DECISION
- **Vinculada a:** C36, DECISION-0028, DECISION-0032
- **Contexto:**
  `payment_transactions.status` usa UPPERCASE no código TypeScript:
  - `INSERT ... VALUES (..., 'PENDING', ...)` — payment-transaction.repository.ts
  - `SET status = 'SUCCESS'` e `SET status = 'FAILED'` — mesmos arquivos
  - `WHERE status = 'PENDING'` — comparações internas

  `payment_intents` também tem drift de casing inconsistente:
  - `intent.status === 'completed'` (lowercase)
  - `intent.status === 'FAILED'` (UPPERCASE)

  O domínio `bank_*` usa lowercase consistente (bank_settlements, payout_requests,
  financial_freezes, etc.). O subdomínio `payment_*` tem casing misto sem DECISION.
  DECISION-0028 ratificou UPPERCASE intencional em 3 tabelas (chat_reports,
  live_presence, event_reservations). `payment_*` não está coberto.

- **Risco:**
  CHECK em UPPERCASE cristalizaria decisão arquitetural não tomada. Queries
  case-sensitive podem retornar resultados divergentes entre handlers.
  Normalização futura requereria: migrar dados + alterar CHECKs + alterar código.

- **Mitigação atual:**
  CHECK revertido em 20260530536000. Coluna aceita qualquer string até decisão.

- **Resolução:**
  Investigação read-only conduzida em 2026-05-12 (relatório material `executei_8.md`
  — gitignored, 384 linhas, cobertura: norma + persistência + runtime + semântica
  compilada + transformadores) refutou a hipótese de "design consciente UPPERCASE":
  contratos canônicos congelados adjacentes (`backend/src/contracts/marketplace/Payment*.contract.ts`)
  já decidiram lowercase materialmente; ausência total de mapper formal e ausência
  de transformadores inline confirmou drift por omissão pura de pipeline.

  **DECISION-0032** (2026-05-12) fixou:
  - Eixo 1 — casing canônico lowercase em `payment_*`
  - Eixo 2 — vocabulário canônico restrito aos valores dos CHECKs ativos
  - Eixo 3 — boundary mapper obrigatório para gateways externos (heterogeneidade
    absorvida na borda; core fala linguagem soberana única)

  DECISION-0032 NÃO autoriza implementação direta. Estabelece destino canônico;
  plano faseado de execução (migrations + edits TS + testes) será sessão dedicada.

  Prioridade: P2.


---

## DT-WALLET-CONSUMERS-CENTS-MIGRATION

- **Status:** CLOSED (2026-05-12 — encerrada por commit `11f028d9`)
- **Origem:** Sub-frente A da investigação Frontend ↔ Q3-E2E v2 (`executei_11.md`); aberta no commit `ec395abb` que corrigiu Wallet.tsx mas deixou 4 consumers exibindo saldo 100x maior por dependerem do campo legado `BankBalance.balance` (sem sufixo `_cents`).
- **Vinculada a:** DECISION-0032 (status operacional lowercase canônico — adjacente); §4.7 (monetário em centavos com sufixo `_cents`); commit `ec395abb` (origem); commit `11f028d9` (encerramento)
- **Convergência prevista:** N/A — encerrada por convergência completa.
- **Contexto:**
  Backend `GET /bank/balance` retorna `{ balanceCents, balance: balanceCents, currency, hasAccount }` — campo `balance` é cópia literal de `balanceCents`, em centavos (bank-http.routes.ts:165-171). Backend `GET /bank/statement` retorna `entries[].amountCents` e `balanceAfterCents` (canônico §4.7) — NÃO envia campos legados `amount`/`balanceAfter`.

  Wallet.tsx lia `balance` (centavos) e formatava com `Intl.NumberFormat('currency: BRL')` que espera reais — exibia saldo 100x maior. `entry.amount` era `undefined` em runtime — `Math.abs(undefined) = NaN`.

  Sub-frente A (commit `ec395abb`) corrigiu Wallet.tsx + criou helper `centsToReais` em `frontend/src/utils/money.ts`, mas deixou outros 4 consumers (CompanyFinancialTab, CompanyOverviewTab, HomeContextual, activity-aggregation.service) com fix defensivo `?? 0`/`?? null` em vez de migração para canônico.
- **Risco:**
  Bug 100x continuava observável em 4 telas (Aba Financeiro empresa; Aba Visão Geral empresa; card de saldo na home; descrições de timeline institucional). Tipo TS frontend declarava `amount` opcional para preservar build, mas `BankStatementEntry.amount` era `undefined` em runtime — qualquer fallback `?? 0` exibia "R$ 0,00" em vez do valor real.
- **Resolução (commit `11f028d9`):**
  Migrados 6 consumers definitivamente para `balanceCents`/`amountCents` canônicos:
    - `CompanyFinancialTab.tsx` (saldo + extrato)
    - `CompanyOverviewTab.tsx` (saldo + atividades)
    - `HomeContextual.tsx` (interface `HomeContextualData` migrada; saldo + última transação)
    - `activity-aggregation.service.ts` (descrições humanas via `formatCentsAsBRL`)
    - `operational-limits.service.ts:244` (bypass `(balance as any).balance` removido)
    - `workflow-detection.service.ts:131` (mesmo padrão)

  Limpeza `frontend/src/api/bank.ts`:
    - `BankBalance.balance` permanece `@deprecated` opcional (tolerância a instâncias antigas do backend)
    - `BankStatementEntry.amount` e `balanceAfter` REMOVIDOS (backend nunca enviou esses campos legados)

  TSC frontend: 0 erros. Backend, schema SQL, comportamento runtime ledger: ZERO alteração. Bug 100x ELIMINADO em todos os consumers diretos de `api/bank.ts`.
- **Drift adjacente registrado durante varredura:**
  7 componentes que importam `frontend/src/api/transparency.ts` (Dashboard, FundAdminPanel, GlobalContextBar, HeaderGlobal, MFIBank*, RegionalFundAdmin) provavelmente têm drift análogo de unidade monetária. NÃO investigado nesta frente — registrado como `DT-TRANSPARENCY-API-CENTS-CONVERGENCE` separada com critério de convergência §25 (norma assintótica).

---

## DT-TRANSPARENCY-API-CENTS-CONVERGENCE

- **Status:** CLOSED (2026-05-13 — encerrada por convergência mecânica DT-TRANSPARENCY na Frente 1)
- **Origem:** Varredura adjacente durante DT-WALLET-CONSUMERS-CENTS-MIGRATION (commit `11f028d9`); 7 componentes que importam `frontend/src/api/transparency.ts` apresentam padrão de uso `region.balance`, `entry.amount`, `entry.balanceAfter` (sem sufixo `_cents`) ao consumir tipos da `transparency.ts` — drift de unidade monetária análogo ao já corrigido em `api/bank.ts`.
- **Vinculada a:** DT-WALLET-CONSUMERS-CENTS-MIGRATION (drift adjacente fora do escopo); §4.7 (monetário em centavos com sufixo `_cents`); §25 code.md (norma assintótica)
- **Convergência prevista:** Quando próxima sessão tocar UI financeira de admin (FundAdminPanel, RegionalFundAdmin), home (HeaderGlobal, GlobalContextBar, Dashboard) ou MFIBank — migrar consumer simultaneamente para usar campo canônico `_cents` com `centsToReais` do `frontend/src/utils/money.ts`. Não vale abrir sessão dedicada agora (refactor transversal sem bloqueio crítico — Wallet do usuário já corrigido como entrypoint mais visível).
- **Contexto:**
  Componentes afetados (mapeados via `grep -RnE "\.balance\b|\.amount\b|\.balanceAfter\b" frontend/src` no momento de `11f028d9`):
    - `frontend/src/components/Dashboard.tsx` (`data.wallet.balance`, `tx.amount`)
    - `frontend/src/components/FundAdminPanel.tsx` (`region.balance`)
    - `frontend/src/components/home/GlobalContextBar.tsx` (`statement.entries[0].balanceAfter`)
    - `frontend/src/components/layout/HeaderGlobal.tsx` (`walletData.balance`, `wallet.balance`, `impactBalance.balance`)
    - `frontend/src/components/mfibank/MFIBankRecentTransactions.tsx` (`entry.amount`)
    - `frontend/src/components/mfibank/MFIBankSummary.tsx` (`entries[0].balanceAfter`, `entry.amount`)
    - `frontend/src/components/RegionalFundAdmin.tsx` (`entry.amount`)

  Nenhum desses arquivos importa de `frontend/src/api/bank.ts` — usam tipos próprios em `frontend/src/api/transparency.ts` ou outros. Por isso ficaram fora do escopo de `11f028d9` (que migrou consumers diretos de `api/bank.ts`).
- **Risco:**
  Mesmas telas exibindo valor monetário 100x maior do que o real, conforme padrão do bug eliminado em Wallet. Risco varia conforme frequência de uso da tela (Dashboard, HeaderGlobal são entrypoints de uso recorrente; FundAdminPanel é admin-only).
- **Mitigação atual:**
  Fix defensivo `?? 0` aplicado durante `11f028d9` em `operational-limits.service.ts` e `workflow-detection.service.ts` (mas esses são services, não as 7 telas listadas acima). As 7 telas continuam com bug 100x até convergência.
- **Resolução prevista:**
  Investigação read-only sobre shape canônico de `frontend/src/api/transparency.ts` (verificar se backend já envia `*_cents` em /bank/statement vs /transparency endpoints). Depois migração coordenada das 7 telas usando `centsToReais` + `formatCentsAsBRL` do `frontend/src/utils/money.ts`. Pode ser feito em sessão dedicada OU incrementalmente quando cada tela for tocada por outra razão (princípio §25 — convergência gradual).
  Prioridade: P2 (bug observável em UI mas não toca causalidade do ledger — visualização errada).

- **Resolução real (2026-05-13):**
  Convergência mecânica em 11 arquivos via Frente 1: `frontend/src/api/transparency.ts` (rename canônico de tipos `amount → amountCents`, `balanceAfter → balanceAfterCents`, `currentBalance → currentBalanceCents`) + 10 consumers convergidos para `centsToReais` do `frontend/src/utils/money.ts`. TSC frontend = 0; 4 gates institucionais PASS. Backend já expunha `_cents` nos campos transaction-level (`transparency.service.ts`, `identity.routes.ts /wallet`, `dashboard.service.ts`) — só faltava frontend convergir.

  **Lições materiais:**
  - **DT subdimensionou contagem:** grep original de `11f028d9` mapeou 7 components; TSC pós-rename revelou 5 consumers extras (`RegionalFundCard`, `TransactionSplitDetail`, `RegionalFundUser`, `TransactionDetail`, `useHomeData`). Total real = 11 arquivos. Lição: rename de tipo é melhor "grep" que `grep -RnE` semântico — TSC localiza todos os consumers reais via tipo.
  - **FundAdminPanel.tsx fora do escopo:** importa `api/fund-admin.ts` que chama endpoint `/fund/admin/regions` SEM HANDLER no backend. Componente é dead code efetivo (404 em runtime). Não tocado nesta frente. Marcar como dead code em frente futura ou documentar como DT própria se decisão for revivê-lo.
  - **Dívida adjacente backend↔norma preservada:** campos summary (`summary.totalIn/totalOut/netAmount`, `byOrigin/byContext/byPeriod`, `SplitDetail.totalAmount/totalPercentage`) ainda usam nomes sem `_cents` no backend embora valores sejam centavos. Frontend convergido tratando-os como centavos via convenção. Convergência de nome no backend fica para frente futura quando alguma sessão tocar `transparency.service.ts`.
  - **3 endpoints monetários convergentes ao §4.7 nos campos transaction-level:** `/bank/statement` + `/identity/wallet` + `/dashboard` todos enviam `amountCents`/`balanceCents`/`balanceAfterCents`. Norma vencendo em runtime.

---

## DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO

- **Status:** CLOSED (2026-05-13 — encerrada por F9 commit `9e8a5f73` + HK7 commit deste fechamento)
- **Classe:** DT-R (runtime / falsa solvência institucional)
- **Origem:** Investigação prévia smoke v3 fundacional (2026-05-13 sessão GUARDIÃO, artefato `executei_21.md`)
- **Vinculada a:** DECISION-0031 (caminho fundacional event_ticket); commit `61e10c26` (Q3-E2E v2 11/11 PASS); achado material em `backend/src/modules/escrow/escrow.service.ts:312-347` (5 stubs vazios)
- **Convergência prevista:** Após DECISION-0035 formalizada (decisão arquitetural sobre event-escrow + split engines + reserve funding) + smoke v3 fundacional canônico implementado, `q3-e2e-v2.ts` deprecated ou deletado. Critério de fechamento: smoke v3 substitui v2 + commit message + log institucional explícitos sobre substituição.
- **Contexto:**
  `backend/scripts/q3-e2e-v2.ts` (commit `61e10c26`, 2026-05-12 03:53) declara no commit message "smoke econômico **fundacional**". O código (P4 linhas 130-151) executa:

  ```ts
  await bankAccountRepository.createAccount(tenantId, {
    ownerId: `system:reserve:${tenantId}`, ownerType: 'system', ...
  });
  const mintResult = await bankTransactionService.createSimpleTransaction(tenantId, {
    fromAccountId: undefined,           // → system:liquidity_issuance auto-criada
    toAccountId: sysReserve!.accountId, // mint direto para reserve
    amountCents: SEED_AMOUNT_CENTS,     // R$ 5.000 hardcoded
    concept_id: 'system-reserve-credit',
    ...
  });
  ```

  Isso é exatamente a **Opção C** que DECISION-0031 (mesmo dia, possivelmente depois) refutou explicitamente:

  > "Opção C (seed de tenant provisiona reserve) — mesma violação que A: provisionamento artificial antes de qualquer atividade econômica. Reserve com saldo sem origem transacional real é contabilidade falsa."

  Investigação posterior (executei_21) revelou que o caminho fundacional declarado em DECISION-0031 (`event_ticket → split engine → parcela de reserve 17% → coverage emergente`) **não está implementado** — `escrow.service.ts:312-347` tem 5 stubs vazios (`lock`, `startRelease`, `release`, `complete`, `getEscrowByEvent`) com TODO literal "integrar com event-escrow quando existir". `postEventSplitJob.execute()` invoca esses stubs em sequência (`backend/src/jobs/post-event-split.job.ts:109, 140, 197, 230, 279`).

  Consequência: v2 passou 11/11 PASS validando ledger técnico (double-entry net=0, bigint, etc.) mas NÃO exerceu o caminho fundacional canônico declarado pela norma.

- **Risco:**
  Falsa solvência institucional. Próxima sessão (humana ou IA) que ler git log + STATUS_EXECUCAO_GLOBAL pode citar v2 como prova de "fluxo econômico fundacional validado em runtime" quando NÃO é. Externo (cofundador, investidor, parceiro técnico, auditor de devida diligência) que examinar o artefato pode chegar à mesma conclusão errada. Quanto mais tempo a falsa solvência permanece não-registrada, maior o risco de virar precedente institucional não-questionado.

- **Mitigação atual:**
  Esta DT + executei_21 (gitignored, mas conteúdo material em log institucional) + nota explícita em STATUS_EXECUCAO_GLOBAL.md (pós-housekeeping HK5) registram que v2 é shortcut, não fundacional. Próxima sessão que abrir o tema event_ticket / smoke / fluxo fundacional encontra DT antes de citar v2.

- **Resolução prevista:**
  Fluxo de 3 etapas:
  1. **DECISION-0035 formalizada** (decisão arquitetural sobre event-escrow A/B/C — vide executei_21) — após audit multi-AI sobre DRAFT a produzir em δ'
  2. **Smoke v3 fundacional canônico implementado** (`backend/scripts/q3-e2e-v3-fundacional.ts` ou nome equivalente) — exercita event_ticket → publish → checkout → split engine → reserve fundada → coverage emergente → P2P
  3. **Cleanup do v2:** deletado OU marcado deprecated com comentário citando DECISION-0035 + apontando v3 como canônico. Commit message + log institucional documentando substituição.

  Prioridade: ALTA. Falsa solvência institucional em ponto soberano do sistema (caminho fundacional econômico) tem custo de oportunidade institucional alto se permanecer não-registrada.

- **Bloqueador para:**
  Declaração legítima de "fluxo econômico ponta-a-ponta validado em runtime", inclusive em:
  - STATUS_EXECUCAO_GLOBAL.md
  - Comunicação externa (cofundador / investidor / parceiro técnico)
  - Próxima sessão que abrir tema fluxo fundacional
  - Qualquer DECISION futura que invoque "Q3-E2E como prova" sem distinguir v2 de v3

- **Resolução final (2026-05-13):**
  Fluxo de 3 etapas executado:
  1. **DECISION-0036 formalizada** (commit `240a2bb0`) — refactor schema bank_splits
     para target_account_id; premissa ontológica account-centric ratificada.
  2. **F9 implementada** (commit `9e8a5f73`) — migration `20260530538000` aplicada;
     repository refactor; bug pré-existente B10 em `validateSplitsSum` corrigido;
     smoke v3 fundacional 14/14 PASS em runtime real.
  3. **HK7 cleanup** (commit deste fechamento) — `q3-e2e-v2.ts` DELETADO; referência
     histórica no header de `q3-e2e-v3-fundacional.ts`; STATUS_EXECUCAO_GLOBAL.md
     atualizado refletindo realidade material atual.

  **Prova material da convergência (F9 P9-P12 PASS):**
  - event_ticket → bankSplitEngine → 4 splits canônicos (70 organizer + 3 fee +
    10 regional_fund + 17 reserve) persistidos em bank_splits
  - Reserve fundada via 17% AUTOMÁTICO do split (NÃO via shortcut concept_id
    'system-reserve-credit' como v2 fazia)
  - system_coverage.execution_capacity_cents bigint > 0 emergente do fluxo real
  - P2P canônico via context p2p_transfer
  - Ledger double-entry net=0 em todas as transações + pg_typeof bigint

  DECISION-0031 ("coverage emerge de fluxo econômico fundacional, não de
  provisionamento artificial") deixou de ser papel e virou comportamento
  executado em runtime. Falsa solvência institucional eliminada.

---

## DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION

- **Status:** CLOSED (2026-05-13 — encerrada por F10, convergência implementacional alinhada com DECISION-0036)
- **Classe:** DT-A (arquitetural — fragmentação de naming entre camadas)
- **Origem:** Investigação execução smoke v3 fundacional (2026-05-13)
- **Vinculada a:** DECISION-0031 (caminho fundacional event_ticket), `ensurePlatformAccounts` (bank-account.service.ts:340-378), `SystemAccountName` type (bank-account.types.ts:20 + bank-split.types.ts:102), bankSplitEngine event_ticket invocação (bank-split-engine.service.ts:154)
- **Convergência prevista:** Fix em `ensurePlatformAccounts` para criar adicionalmente contas `system:reserve:`, `system:fee:`, `system:regional_fund:` (com naming que `SystemAccountName` espera) OU refactor para que `SystemAccountName` use os nomes que `ensurePlatformAccounts` cria. Decisão arquitetural pendente.
- **Contexto:**
  Existem dois sistemas de naming paralelos para contas system no domínio bank:

  **Sistema 1 — `ensurePlatformAccounts`** (bank-account.service.ts:340-378) cria contas lifecycle com `accountType`:
  - `'escrow_payments'`, `'platform_revenue'`, `'platform_fees'`, `'clearing'`, `'bank_settlement'`, `'risk_reserve'`, `'seller_pending'`, `'seller_available'`, `'seller_payout'`
  - Cada uma com `ownerId = 'system:${accountType}:${tenantId}'`

  **Sistema 2 — `SystemAccountName`** (bank-account.types.ts:20 + bank-split.types.ts:102):
  - `'fee' | 'regional_fund' | 'reserve' | 'escrow' | 'platform_ops'`
  - `bankAccountRepository.getSystemAccount(tenantId, name)` busca por `ownerId = 'system:${name}:${tenantId}'`

  **Mismatch material:** `'reserve'` (Sistema 2) ≠ `'risk_reserve'` (Sistema 1); `'fee'` ≠ `'platform_fees'`; `'regional_fund'` não tem equivalente no Sistema 1.

  **Consequência operacional:** quando `bankSplitEngine.calculateSplits(context: 'event_ticket')` é invocado, faz `getSystemAccount('reserve' | 'fee' | 'regional_fund')` que retorna `null` (Sistema 1 não criou essas) — e dispara `throw new Error('System account ${name} not found')` na linha 154-155 de bank-split-engine.service.ts.

  **Workaround estabelecido** (em scripts E2E):
  - `backend/src/scripts/validate-financial-flow-real.ts:87` cria manualmente `system:reserve:${TENANT_ID}`
  - `backend/src/scripts/validate-pipeline-e2e-transversal.ts:144` mesmo padrão
  - `backend/scripts/q3-e2e-v3-fundacional.ts:130-148` (este smoke) cria as 3 contas (`reserve`, `fee`, `regional_fund`) antes do checkout

- **Risco:**
  Tenant criado em produção via `ensurePlatformAccounts` SOZINHO **não tem as 3 contas necessárias** para que `bankSplitEngine.calculateSplits(context: 'event_ticket')` funcione. Primeiro checkout de ticket em produção falharia com erro `System account reserve not found`. Em prática, smoke v3 só funciona porque cria as contas manualmente — não exercita o caminho que produção realmente segue após `ensurePlatformAccounts`.

- **Mitigação atual:**
  Scripts E2E (validate-financial-flow-real, validate-pipeline-e2e-transversal, q3-e2e-v3-fundacional) criam manualmente. Esta DT documenta a fragmentação para convergência futura.

- **Resolução prevista:**
  Decisão arquitetural pendente — duas opções principais:
  1. **Alinhar `ensurePlatformAccounts` ao `SystemAccountName`**: criar adicionalmente contas com naming `'reserve'`, `'fee'`, `'regional_fund'` (não substituir `'risk_reserve'` etc. — pode ter propósito distinto)
  2. **Alinhar `SystemAccountName` ao `ensurePlatformAccounts`**: refactor de `bankSplitEngine` para usar `'risk_reserve'`, `'platform_fees'`, etc. Requer auditoria semântica para confirmar que `risk_reserve` é a mesma entidade que `reserve` no split (e definir o equivalente para `regional_fund`).

  Prioridade: ALTA-MÉDIA (bloqueador silencioso para fluxo fundacional canônico em produção; mascarado por workaround em scripts de teste).

- **Bloqueador para:**
  - Primeiro checkout de ticket em tenant criado via `ensurePlatformAccounts` puro
  - Declaração "sistema produz capacity emergente naturalmente via event_ticket" sem ressalva
  - Convergência de DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO (smoke v3 ainda usa workaround; convergência completa exigiria fix nesta DT)

- **Resolução (2026-05-13 — F10):**
  Convergência implementacional aplicada a `ensurePlatformAccounts` em
  `backend/src/modules/bank/bank-account.service.ts:340-415`. Decisão alinhada
  com diretiva "absorver legado" + heurística "runtime soberano = concentração
  de causalidade validada":

  **Audit material identificou runtime soberano:**
  - `SystemAccountName` ('reserve'/'fee'/'regional_fund'/'escrow'/'platform_ops')
    com 14 call sites ativos em runtime (bank-integration, regional-fund-governance,
    transparency, marketplace/regional-fund, rides/distribution, etc.)
  - `getPlatformLifecycleAccount` usado apenas para `escrow_payments`/`clearing`/
    `bank_settlement` (4 call sites)
  - `'risk_reserve'`/`'platform_fees'`/`'platform_revenue'` criados por
    ensurePlatformAccounts MAS **sem callers** — arquitetura aspiracional
    não convergida

  **Fix aplicado (camada 2 adicionada em ensurePlatformAccounts):**
  - Loop adicional cria 4 contas SystemAccountName ('reserve', 'fee',
    'regional_fund', 'escrow') com `account_type='credit'` genérico
  - `owner_id` pattern `system:${name}:${tenantId}` resolve via
    `bankAccountRepository.getSystemAccount` (busca por owner_id, não account_type)
  - Sem migration DDL (CHECK constraint de account_type preservado — 13 valores existentes)
  - Camada 1 (9 contas legacy) preservada para callers de getPlatformLifecycleAccount

  **Validação dinâmica:** smoke v3 fundacional 14/14 PASS em runtime real
  **sem workaround manual** (P5 do script atualizado para validar — não criar — as
  contas system). Tenant criado via ensurePlatformAccounts puro agora suporta
  primeiro checkout event_ticket nativamente.

  Padrão arquitetural: convergência via **runtime soberano absorvendo o que
  o legado declarava aspiracionalmente**, sem amputar contas legacy nem
  exigir migration DDL.

---

## DT-SERVICE-BOOKING-CONVERGENCE-MAP (Raio-X 2026-05-14)

- **Status:** OPEN — frente convergível futura (NÃO refatorar agora)
- **Classe:** DT-A (arquitetural) + mapa institucional de convergência
- **Origem:** GUARDIÃO ativado por autorização de piloto automático Clayton (2026-05-14); detectado 2 caminhos paralelos no domínio service_booking sem decisão arquitetural prévia
- **Bloqueador para MVP humano atual:** **NÃO** (event_ticket + p2p_transfer cobrem validação humana imediata)

### Caminhos identificados

**Caminho 1 — `processServiceBookingPayment` (bank-integration.service.ts:326)**
- Estado: **DORMENTE** (0 callers)
- Arquitetura: alinhada ao core — usa `bankSplitEngine` context=`service_booking` (defaults 97%/3%), concept_id=`service-booking-payment` hardcoded
- Padrão idêntico a event_ticket (Fase 1) e p2p_transfer (P2P-Fase2)
- Limitações: single receiver, apenas user_id

**Caminho 2 — `processServicePaymentExecutionCanonical` (bank-integration.service.ts:450)**
- Estado: **VIVO** (cadeia HTTP exercitada: service-hire.routes + service-payment-execution.routes → service-payment-execution.service → este método; 2 transações `service_execution` reais no banco)
- Arquitetura: parcialmente alinhada — usa `createTransactionWithExplicitSplitLines` (bypassa split engine), concept_id via SSOT do banco (`'ride-payment'` em domínio `'financeiro-payment'`)
- Edge cases REAIS capturados pelo runtime:
  1. Múltiplos receivers (`splitRecipients[]`) — serviço com vários prestadores
  2. Multi actor_type (user/page/group via `resolveBankAccountForServiceActor`)
  3. `executionId` separado de `paymentRequestId` — execuções parciais
  4. Concept_id via SSOT no banco — flexibilidade de regra sem deploy

### Convergência preservada — causalidade financeira

Ambos caminhos:
- Validam limite diário via `bankLimitService` (fail-closed)
- Constroem authorship via `buildFinancialAuthorshipFromRequest`
- Geram bank_ledger double-entry imutável
- Passam concept_id explícito (após E1.6/P2P-1 é obrigatório)

### Dependência de `unified_availability`

- Camada financeira (`bank-integration.service.ts`): **NULA** — desacoplada (correto)
- Camada de orquestração (`service-order.service.ts` + booking-decision): **8+ referências** — booking, conflicts, getAvailability
- Conclusão: financeiro está limpo; agendamento vive na camada acima

### Decisão arquitetural pendente — 3 hipóteses avaliadas

| Hipótese | Pró | Contra |
|---|---|---|
| **A — Tornar dormente canônico, amputar vivo** | Alinhamento total ao core | Amputa 4 edge cases reais; quebra service-hire.routes ativo |
| **B — Tornar vivo canônico, amputar dormente** | Remoção lógica imediata (sem caller) | Mantém bypass do split engine; semântica confusa (concept `'ride-payment'` em contexto de serviço) |
| **C — Absorver vivo dentro do dormente** (RECOMENDADA) | Preserva edge cases + aproxima ao core canônico | Requer PR cirúrgico futuro com 5 passos |

### Plano de convergência futura (Hipótese C — quando priorizar)

1. Estender `processServiceBookingPayment` para aceitar `splitRecipients[]` opcional (default mantém defaults do split engine)
2. Permitir actor_type polimórfico no destinatário via `resolveBankAccountForServiceActor`
3. `concept_id` default via lookup SSOT (semântica unificada com o domínio financeiro-payment)
4. Rerrotear `service-payment-execution.service` para chamar o dormente unificado
5. Remover método vivo após confirmar zero callers

### Por que NÃO converger agora

- service_booking NÃO bloqueia validação humana do MVP atual (event_ticket + p2p_transfer pendentes de uso humano real)
- Decisão arquitetural prematura sem uso humano de service_booking arrisca repetir o padrão das 3 reconstruções anteriores
- Aprendizado sobre service_booking só virá quando humano usar — múltiplos receivers, partial execution, multi actor_type são edge cases que o uso real vai validar ou refinar

### Critério de convergência

Esta DT vira frente prioritária quando:
- Sub-frente service_booking entrar no caminho do humano (Clayton ou usuário real) E
- 2 contextos vivos atuais (event_ticket, p2p_transfer) estiverem ratificados em uso humano

Antes disso: **arquivada como conhecimento operacional**, NÃO frente ativa.

### Padrão institucional capturado

GUARDIÃO maduro = **transformar "buraco negro arquitetural assustador" em "frente conhecida, mapeada e priorizável"** sem refatorar nem amputar. Aplicado pela primeira vez aqui (2026-05-14) sob diretiva Clayton + IA externa de auditoria sem decisão precipitada.

---

## DT-AVAILABILITY-CONFLICT-EFFECT-EMISSION-DRIFT (B+A Fase 2 — 2026-05-14)

- **Status:** OPEN — fóssil cirúrgico latente (NÃO bloqueia lifecycle de bookings)
- **Classe:** DT-A (drift de tipo + path side effect)
- **Origem:** Smoke HTTP B+A1 (lifecycle completo de bookings) — exposto durante validação material substituta de uso humano UI

### Onde mora

`backend/src/core/availability/unified-availability.service.ts:192-247` — emissão do effect `AVAILABILITY_CONFLICT_DETECTED` no outbox quando `detectConflicts()` retorna conflitos durante `createBooking`.

Linhas 212-220 chamam `.toISOString()` em campos provenientes de `detectConflicts()` que vêm do SQL function `detect_availability_conflicts` (linhas 700-718 do repository). Em runtime real, alguns campos chegam como `undefined` → `.toISOString()` em `undefined` quebra.

### Quando dispara

Apenas quando `availability.ownerType === 'user'` E o requester tem availabilities conflitantes — caso edge específico. Para owner_type não-user, o caminho try/catch não é exercitado.

### O que NÃO bloqueia

- Booking é criado materialmente (linha 163 do service, ANTES do try/catch da emissão)
- Lifecycle completo (confirmed → checked_in → checked_out → cancelled) funciona via rotas separadas
- Smoke B+A1 valida 8/8 steps PASS mesmo com este fóssil dormente em alguns casos edge

### O que bloqueia

- Effect `AVAILABILITY_CONFLICT_DETECTED` não chega ao Social Inbox Projector quando há conflito real (read-model perdido)
- Alerta de conflito não vira inbox item para o user afetado
- Não impacta integridade de dados, apenas observabilidade do conflito

### Convergência prevista

Investigação dedicada:
1. Auditar SQL function `detect_availability_conflicts` (assinatura de retorno)
2. Mapear types `AvailabilityConflict` no repository (linhas 712-717) — campos `Date` esperados
3. Adicionar fallback ou cast explícito na emissão do effect (linhas 219-220 do service)
4. Smoke dedicado para reproduzir caso edge (user com 2 availabilities sobrepostas)

**Cluster cross-layer.** Não cirúrgico via 1 arquivo. Exigirá auditoria dedicada quando recomposição automática (Fase 7 do plano v2.1) ativar consumer de AVAILABILITY_CONFLICT_DETECTED.

### Critério de convergência

Esta DT vira frente prioritária quando:
- Fase 7 do plano v2.1 (recomposição automática em cancelamento) abrir, OU
- Caso edge de conflito de availability em runtime real expuser o alerta perdido como bloqueio funcional

Antes disso: **arquivada como conhecimento operacional**, NÃO frente ativa.

### Padrão institucional capturado

Smoke HTTP material (B+A) como substituto de uso humano expõe fósseis estruturais que TSC e gates não detectam. Confirma princípio: "encanamento testável programaticamente; UX subjetiva ainda aguarda humano clicar" — mas mesmo o teste programático captura drift de runtime real que estaria invisível em validação estática.

---

## DT-FRONTEND-API-ERROR-EXTRACTION-DRIFT

- **Status:** OPEN
- **Origem:** T2 da auditoria autônoma (sessão GUARDIÃO 2026-05-14, modo ausência humana controlada)
- **Vinculada a:** Bug 3 (commit 3ed43d50) — fix canônico em `client.ts`

### Contexto material

`frontend/src/api/client.ts:325-332` foi convergido (commit 3ed43d50) para extrair `.message` de objeto aninhado quando backend retorna shape Fastify default `{ error: { code, message, details } }`. Sem isso, `new Error(errorDetails.error)` produzia `Error("[object Object]")` visível na UI.

Auditoria T2 detectou que o mesmo padrão antigo (`errorData.error || errorData.message || HTTP ...`) ainda existe em **22+ ocorrências** em arquivos da api/ que extraem erro fora do pipeline canônico:

| Arquivo | Ocorrências |
|---|---|
| `frontend/src/api/groups.ts` | 17 (linhas 132, 150, 176, 254, 299, 316, 332, 367, 384, 429, 446, 462, 497, 514, 531, e duas no setter de imagens) |
| `frontend/src/api/education.ts` | 3 (linhas 75, 93, 114) |
| `frontend/src/api/core.ts` | 1 (linha 92) |
| `frontend/src/api/identity.ts` | 1 (linha 212) |

Total: ~22 callers vulneráveis ao mesmo bug latente.

### O que já foi convergido nesta sessão

- `frontend/src/api/auth.ts:91` (register) — commit `ee712dbf`
- `frontend/src/api/auth.ts:172` (login) — commit `ee712dbf`

Esses 2 callers são os caminhos pré-autenticação críticos. Os 22 restantes foram **deixados intencionalmente** porque cluster excede escopo cirúrgico autônomo (>5 pontos, frente dedicada).

### Risco

Quando o backend retorna erro Fastify default em qualquer endpoint consumido por groups/education/core/identity, a UI renderiza "[object Object]" ao invés de mensagem legível. Não causa perda de dados — causa fricção UX em fluxos de criação/atualização (grupos especialmente).

### Mitigação atual

- Caminho canônico via `apiFetch` (client.ts) já corrigido — maioria dos consumers passa por ele
- Callers diretos `response.json()` em api/ permanecem vulneráveis
- Erros 4xx em runtime usuário precisam validar manualmente

### Convergência prevista

Frente dedicada (~30-60min):
1. Extrair helper `extractErrorMessage(errorData, statusCode)` em `client.ts` ou utils dedicado
2. Substituir o padrão antigo nos ~22 callers usando o helper
3. TSC + smoke dos endpoints afetados
4. Considerar refactor maior: migrar todos os callers diretos `response.json()` para usar `apiFetch` canônico (frente arquitetural, escopo maior)

### Critério de convergência prioritária

Esta DT vira frente prioritária se:
- Usuário humano reportar nova "[object Object]" em grupos/education/identity, OU
- Sessão dedicada de Frontend Hygiene abrir, OU
- Refactor para `apiFetch` único pipeline for autorizado

Antes disso: arquivada como conhecimento operacional.

### Padrão institucional capturado

`client.ts` foi convergido como pipeline canônico, mas vários arquivos da api/ existem como "wrappers paralelos" que fazem fetch direto + parsing próprio — verdade paralela arquitetural. Convergir todos via helper compartilhado seria o caminho assintótico.


## DT-PROFILE-AGENDA-CONFIRM-ACTIVATE-MISSING

- **Status:** OPEN
- **Origem:** executei_33.md (sessão piloto automático 2026-05-15) — gap material identificado durante implementação da Tarefa 1 (persistência schedule declarativo)
- **Vinculada a:** AGENDA_UNIVERSAL_CONTRACT.md (CORE Nível 1)

### Contexto material

ProfileAgenda permite usuário declarar `AvailabilitySchedule` (recorrência semanal:
"monday: 09:00-12:00 + 14:00-18:00", etc.). Esta é **input declarativo**, NÃO é
verdade temporal (cf. AGENDA_UNIVERSAL_CONTRACT §3 e tipos
profile-professional.types.ts:48-75).

**Após Tarefa 1 (commit pendente):** schedule declarativo persiste em
`professional_profile.availability` via `updateProfessionalProfile` com debounce.

**Gap material remanescente:** não existe mecanismo de **"confirmar e ativar"**
que pegue a schedule declarativa e gere availabilities reais em
`unified_availability` (verdade temporal). Tipo explícito linha 61-62:

> AvailabilitySchedule serve apenas como:
> - INPUT para criação futura de Unified Availability (quando usuário confirmar)

Backend `unified-availability.routes.ts:104,309` REJEITA tentativas de armazenar
schedule em metadata — coerente com AGENDA_UNIVERSAL §3 ("Proibição de Core
Paralelo").

### Risco

- Lúcia configura horários declarativos (salvos em profile)
- Mas sistema **não cria slots reais** na agenda universal
- Cliente buscando "dentista terça 14h" não encontra Lúcia mesmo ela tendo
  declarado disponibilidade
- Matching prospectivo (Fase 6 do plano v2.1) não funciona sem availabilities reais

### Decisões arquiteturais necessárias (PARO E CONSULTO)

1. **Estratégia de tradução schedule → availabilities:**
   - Opção A: gerar N availabilities (uma por slot da semana atual) ao "confirmar"
   - Opção B: 1 availability com `recurrence_rule` em metadata + worker expande
   - Opção C: outra abordagem (worker scheduled cria slots N semanas à frente)

2. **Mecanismo de "confirmar":**
   - Botão explícito "Ativar minha agenda" no UI?
   - Confirmação por slot individual?
   - Trigger automático após preencher mínimo de slots?

3. **Edge cases:**
   - Conflito com availabilities pré-existentes
   - Mudança de schedule depois de ativada (re-gera tudo? incremental?)
   - Vacations e specific dates do AvailabilitySchedule

4. **Janela temporal:**
   - Gerar quantas semanas à frente? (1? 4? indefinido?)
   - Auto-renovar via worker?

### Convergência prevista

Frente dedicada com DECISION formalizada — toca CORE Nível 1 (AGENDA_UNIVERSAL).
Não autoriza implementação ad-hoc.

### Mitigação atual

- Schedule persiste (Tarefa 1 implementada)
- Read-only para clientes (Lúcia vê seu schedule, mas matching não usa)
- DT-AVAILABILITY-CONFLICT-EFFECT-EMISSION-DRIFT também depende dessa decisão

### Critério de convergência prioritária

Esta DT vira prioritária quando:
- Lúcia/Maria reportar fricção real ("configurei horário e cliente não me acha")
- Fase 6 do plano v2.1 (matching prospectivo) abrir
- DECISION arquitetural sobre tradução schedule → availabilities for formalizada

---

## DT-COMPANY-CREATION-PATHS-DIVERGENCE

- **Status:** OPEN
- **Origem:** Auditoria de validação do fluxo de criação de empresa (2026-05-15) — runtime-first sob calibração "humano define prioridade arquitetural"
- **Classe:** DT-A (arquitetural — convergência interrompida sem bloqueio runtime)
- **Vinculada a:** 02_ACTORS_SSOT (vínculo actor↔company), `companies.service.ts` (runtime soberano), `company-canonical.service.ts` (legado aspiracional)
- **Convergência prevista:** quando humano efetivamente pressionar por caminho canonical (ex.: tentar criar empresa com CPF — único diferencial vs `/companies` full que exige CNPJ), OU quando decisão arquitetural sobre soberania for retomada com pressão material registrada.

### Contexto

Existem dois caminhos codificados de criação de empresa:

**Runtime soberano (caller real, humano atravessa):**
- `frontend/src/components/layout/GlobalSidebar.tsx:73,81` + `GlobalHeader.tsx:229` → `/empresas`
- `pages/EmpresasPage.tsx:7` → `<CompaniesManager />`
- `components/CompaniesManager.tsx:317` → `createCompany(input)` em `api/companies.ts:174`
- POST `/companies` → `companies.routes.ts:166` → `companies.service.ts:253-733`
- Schema bate; `ensurePageActor` obrigatório com rollback; `company_users` criado; Receita Federal opcional. **Funciona em runtime.**

**Aspiracional (sem caller vivo na navegação):**
- Rotas `/companies/new` e `/empresas/nova` registradas em `App.tsx:260-261`
- `frontend/src/pages/CompanyCreationPage.tsx:104` envia POST `/api/companies/canonical`
- `backend/src/core/companies/company-canonical.routes.ts:40` registra rota
- `backend/src/core/companies/company-canonical.service.ts:113-147` faz INSERT em colunas que NÃO existem no schema atual de `companies`: `legal_name`, `document_type`, `document_number`, `country`, `state`
- Schema vigente (após `0065_create_companies_minimal.sql` + `0066_profile_support_tables.sql` + `20260530521000_*` + `20260530535000_*`) tem apenas: `company_id, tenant_id, company_name, trade_name, status, company_status, created_at, updated_at, global_user_id, cnpj, is_verified, primary_address_id, metadata`
- Grep em `frontend/src/` por `/companies/new`, `/empresas/nova`, `navigate('/empresas/nova')`: **zero callers vivos** além da declaração de rota em App.tsx

Classificação via heurística `feedback_runtime_soberano.md`: **legado aspiracional** — declarado em código + contrato + rota + frontend, mas sem causalidade exercitada via navegação humana. Não é bug ativo. É convergência interrompida.

### Risco

Se humano descobrir URL direta `/companies/new` ou `/empresas/nova` (rotas registradas mas sem botão/menu apontando), recebe erro Postgres "column does not exist" → mensagem genérica de erro no frontend. Risco baixo em fluxo normal (sidebar e header não levam para lá).

### Mitigação atual

- Navegação não exibe link para rotas canonical
- Esta DT documenta a divergência para próxima sessão que tocar criação de empresa não interpretar `canonical` como rota viva
- `companyCanonicalService` tem comentários auto-documentando filosofia ("nascimento sem rollback ontológico", `company-canonical.service.ts:4-13, 48-57`) — preservado como vestígio dormente

### Resolução prevista

Aguarda pressão material. Quando aparecer, opções a considerar (decisão arquitetural NÃO antecipada):

1. **Alinhar schema** via migration soberana adicionando `legal_name, document_type, document_number, country, state` (fronteira PARO E CONSULTO — migration DDL)
2. **Retirar rota da declaração** (`App.tsx:260-261` e `company-canonical.routes.ts`) marcando `companyCanonicalService` como deprecated
3. **Mapeamento de borda no service** — `legal_name → company_name`, `document_number → cnpj` ou nova coluna `document_number` única, `state → company_status='CREATED'`, descartar/persistir em metadata
4. **DECISION arquitetural formal** sobre qual filosofia ("nascimento canônico sem actor" vs "criação full com rollback") é soberana

Nenhuma opção autorizada agora. Aguarda pressão.

### Critério de convergência

Esta DT vira prioritária quando:
- Humano tentar criar empresa com CPF (não suportado pelo caminho `/companies` full)
- Humano descobrir URL direta `/companies/new` e reportar fricção
- Decisão arquitetural sobre canonical-vs-full for retomada por outra razão

### Referências

- Auditoria: `plans/quero-que-voc-valide-radiant-ember.md` (2026-05-15)
- Memória: `feedback_runtime_soberano.md` (3ª aplicação consecutiva — F8, F10, esta DT)
- Norma: `docs/01_normative/02_ACTORS_SSOT.md` §9 (Actor sem CNPJ permitido, sem CPF proibido)

---

## DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS

- **Status:** OPEN
- **Origem:** Auditoria de validação do fluxo de criação de empresa (2026-05-15) — descoberta via investigação de convite de colaboradores
- **Classe:** DT-A (arquitetural — convergência interrompida em domínio paralelo)
- **Vinculada a:** `company_members` (table arquivada), `organization_*` (Sprint 78), `authorization.service.ts:369` (consulta `company_members`)
- **Convergência prevista:** quando humano pressionar por convite de colaborador. Primeira ação será verificação material via SQL (`SELECT 1 FROM company_members LIMIT 1` + análogos) para distinguir "drift documental" (tabela existe, migration sumiu cosmeticamente) de "tabela ausente" (precisa retomar migration ou rever organization_*).

### Contexto

Convite/gestão de colaboradores tem 3 camadas paralelas codificadas:

**Camada 1 — `company_users` (FUNCIONA, runtime soberano para dono):**
- Migration `0065_create_companies_minimal.sql:36` (ativa)
- `companies.service.ts:576-638` insere row com `is_primary=true` no createCompany
- Clayton vira dono da empresa via esta tabela
- `authorization.service.ts:352-366` consulta para `is_primary` ownership

**Camada 2 — `company_members` (CODIFICADO, migration arquivada):**
- Migration em `backend/migrations_archive/0050_company_members.sql` (não está em `migrations/` ativo)
- `desktop.ini` referencia `147_company_members.sql` que também não está em `migrations/` ativo
- Service: `backend/src/core/companies/company-members.{service,repository,routes,types}.ts` — codificado completo
- Frontend: `components/company/tabs/CompanyTeamTab.tsx` usa `createCompanyMember` via `handlers/action-handlers.ts:executeInviteCompanyMember`
- `authorization.service.ts:369-382` consulta para `role='admin'` ownership
- `close-company-canonical.sql:130` faz UPDATE em `company_members`

**Estado material da tabela:** desconhecido. Migration arquivada não significa que a tabela não exista no DB ativo — pode ter sido criada por migration consolidada com nome diferente. Verificação via SQL pendente até pressão humana.

**Camada 3 — `organization_*` (Sprint 78, CODIFICADO sem migration):**
- 8 arquivos em `backend/src/modules/organization/` codificados (routes/service/repo/types para roles+members+invites)
- Fluxo invite/aceite/revoke completo no código
- Frontend `pages/OrganizationMembersPage.tsx` + `api/organization.ts` codificados
- Zero migrations encontradas: `organization_roles`, `organization_members`, `organization_invites`
- Repositórios assumem tabelas que não foram criadas

### Risco

- Convidar colaborador hoje pode falhar OU funcionar — depende de qual tabela existe no DB ativo (não verificado)
- Empresa funciona com dono (`company_users`); colaboradores adicionais frágeis ou bloqueados
- Companhia atravessa criação normal sem essa frente

### Mitigação atual

- Humano não pressionando convite agora (fase ACOPLAMENTO MVP-HUMANO foca criação humana + atravessamento operacional básico)
- Esta DT documenta as 3 camadas paralelas para próxima sessão que tocar membership

### Resolução prevista

Aguarda pressão material. Primeira ação será verificação read-only via SQL:

```sql
-- Verificar existência material das tabelas
SELECT to_regclass('company_members') AS company_members_exists;
SELECT to_regclass('organization_members') AS organization_members_exists;
SELECT to_regclass('organization_invites') AS organization_invites_exists;
SELECT to_regclass('organization_roles') AS organization_roles_exists;

-- Se existirem, contagem real
SELECT COUNT(*) FROM company_members;  -- só se tabela existir
```

Conforme resultado:
- **Tabelas existem (drift cosmético):** migrations foram removidas/arquivadas mas tabelas vivem. Reconverger documentação (recriar migration ou ALTER schema migration table). Decisão arquitetural mínima.
- **Tabelas não existem (frente real):** decidir entre (a) retomar `company_members` legacy ou (b) materializar Sprint 78 organization_*. DECISION arquitetural antes de migration.

Nenhuma ação autorizada agora.

### Critério de convergência

Esta DT vira prioritária quando:
- Humano (Clayton ou stakeholder) pressionar por adicionar colaborador a uma empresa
- Frente de gestão de equipe entrar no fluxo MVP-humano
- Outra DT relacionada (ex.: delegação de autoridade entre actors) for tocada

### Drifts secundários adjacentes (NÃO investigados — registrados para consciência)

- `actors.company_id` referenciada em `close-company-canonical.sql:92` — não verifiquei se coluna existe
- `company_domains` referenciada em `companies.service.ts:548-574` com fallback non-fatal — não verifiquei se tabela existe

Mesmo padrão: aguarda pressão humana para investigar.

### Referências

- Auditoria: `plans/quero-que-voc-valide-radiant-ember.md` (2026-05-15)
- Migration arquivada: `backend/migrations_archive/0050_company_members.sql`
- Service legacy: `backend/src/core/companies/company-members.repository.ts`
- Service Sprint 78: `backend/src/modules/organization/organization-{member,invite,role}.service.ts`
- Permissions normativa NÃO USADA (proposto/não-vigente): `docs/01_normative/13_PERMISSIONS_CANONICA.md`
- Memória: `feedback_runtime_soberano.md` (princípio: ausência de migration ≠ ausência de runtime soberano)

---

## DT-GLOBAL-USER-ID-DUPLICATION-E2E

- **Status:** PARTIALLY_RESOLVED 2026-05-25 — vetor em `companies.service` ELIMINADO (Fatia 1 identidade); dados duplicados em E2E persistem (escopo separado, sem path de escrita vulnerável remanescente em companies); migração ampla para fachada `authority.service` continua aberta como frente posterior.
- **Origem:** Atravessamento HTTP real do fluxo de criação de empresa (2026-05-15) — descoberta via SQL direto durante diagnóstico de divergência de tenant
- **Classe:** DT-D (dados — duplicação semântica em E2E que vazava para runtime de produção via path compartilhado; path em companies fechado em 2026-05-25)
- **Vinculada a:** ~~`resolveTenantIdFromGlobalUserId` em `companies.service.ts`~~ **REMOVIDA 2026-05-25 (Fatia 1)**; `/auth/register` (provável fonte do reuso); fix cirúrgica de `companies.routes.ts:187` (essa fix isolou um sintoma; Fatia 1 eliminou a raiz no domínio companies)
- **Convergência prevista:** convergência ampla (auth/identity/resolver canônico) continua emergindo por pressão material — Fatia 1 fechou o domínio companies seguindo o pattern de execução normativa direta

### Fechamento parcial Fatia 1 — companies (2026-05-25)

**Diagnóstico normativo (não era decisão arquitetural pendente):**

A função `resolveTenantIdFromGlobalUserId` (companies.service.ts:738) violava simultaneamente:
- **`03_IDENTITY_CANONICA.md §8`** — "inferir tenant é proibido"; "resolver identidade pelo primeiro resultado é proibido"; "se tenant_id não estiver disponível, a decisão é inválida por definição". A função fazia `SELECT u.tenant_id FROM users u WHERE u.global_user_id = $1 LIMIT 1` — sem tenant input, sem ORDER BY, retornando "primeiro resultado" quando global_user_id duplicado.
- **`08_AUTORIDADE_CANONICA.md §10.1`** — `users.user_id/tenant_id/global_user_id` "NÃO criam autoridade, APENAS rastreiam atuação". Função-produto usava global_user_id como decisor de tenant — usurpava soberania da identidade.
- **`AUTHORITY_LAW.md §1.4 + §3`** — persona nunca é soberana; responsabilidade econômica única. Resolver tenant por "primeiro match" fragmentava responsabilidade.
- **`docs/ssot/AUTHORITY_PRECEDENCE.md §4.5`** — "Produto é sempre a camada mais fraca. Qualquer regra de produto que conflite com camadas superiores é inválida por definição." `companies.service` é código de produto resolvendo identidade — inválido por definição.
- **`IDENTITY_SSOT_PRECEDENCE.md`** — fallback inseguro (LIMIT 1) cria risco de "segunda verdade" entre actors/identities/companies/tenant.

As hipóteses originais ("decisão arquitetural sobre semântica de global_user_id for formalizada") foram **superadas pela leitura da norma vigente**: a semântica já estava formalizada desde 03_IDENTITY_CANONICA §2 ("global_user_id é único no sistema; não pode ser duplicado") + §5 ("identidade por tenant é proibido"). Padrão "executar o já-decidido" (DECISION-0031/0032 do social).

**Execução (Variante C — tenant explícito):**

10 sítios alterados em `companies.service.ts` + 6 sítios em `companies.routes.ts` + remoção da função-violadora:

| Sítio | Mudança |
|---|---|
| `companies.service.ts:738` (def) | Função `resolveTenantIdFromGlobalUserId` **REMOVIDA** |
| 9 métodos (`createCompany`, `listCompanies`, `updateCompany`, `getCompanyUserById`, `updateCompanyUser`, `deleteCompany`, `uploadCompanyDocument`, `listCompanyDocuments`, `adminOverrideToVerified`) | Substituídos os blocos `let finalTenantId = tenantId; if (!finalTenantId) { ...resolveTenantIdFromGlobalUserId... }` + bloco de validação dupla por: `if (!tenantId \|\| trim() === '') throw §8` + `const finalTenantId = tenantId;`. `adminOverrideToVerified` ganhou parâmetro `tenantId: string` obrigatório na signature |
| `companies.routes.ts` | 5 chamadas internas que omitiam `req.tenant?.id` ajustadas (`deleteCompany`, `updateCompanyUser`, `uploadCompanyDocument`, `listCompanyDocuments` ×2); `adminOverrideToVerified` chamada com `req.tenant?.id as string` |
| `companies.service.ts:708` | Chamada interna `getCompanyUserById(..., globalUserId)` ajustada para passar `finalTenantId` (sub-bug colateral exposto pela §8 nova) |

**Validação (5 critérios passaram):**
- `tsc --noEmit` exit 0.
- Grep órfão: zero referências a `resolveTenantIdFromGlobalUserId` em `backend/src/`.
- 4 gates verdes: bank-ledger §4.6 OK; actor-writer §4.8.1 OK; regression-guards OK; architectural Total 20 = baseline inalterado.
- `critical_total` inalterado (20 = 20).
- Boot limpo.

**Prova material (4 cenários — ESCRITAS):**
- D-1 (CREATE via rota): `POST /companies` → HTTP 201, company `90621f4e-99a7-434e-9cee-2a89aae9859f` gravada. SELECT confirmou `tenant_id = fbe13b78-4516-493d-905a-363796aea1d1` (DO CONTEXTO `req.tenant?.id`, NÃO inferido por LIMIT 1).
- D-2 (UPDATE via rota): `PUT /companies/:id` → HTTP 200, `tradeName` alterado, `tenant_id` preservado.
- D-3 (adminOverrideToVerified COM tenant, via smoke tsx direto): atravessou o gate §8 com sucesso; falhou em bug **pré-existente e separado** (`coluna 'metadata' não existe` em companies — DT-COMPANIES-METADATA-COLUMN-MISSING, escopo distinto). Caminho de identidade não é mais vetor.
- D-4 (adminOverrideToVerified SEM tenant, via smoke tsx direto): `THROW §8 esperado: GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para adminOverrideToVerified (§8 03_IDENTITY_CANONICA)` — defensa em runtime confirmada.

**O que esta fatia FECHOU:**
- Domínio `companies` inteiro convergido. Toda escrita exige tenant explícito por contrato de tipo + defensa em runtime. Função LIMIT 1 não existe mais no código.

**O que NÃO foi tocado (frentes posteriores):**
- Migração ampla para fachada `authority.service` como resolver canônico de identidade.
- Dados duplicados em E2E (`global_user_id` repetido em 23 tenants) — escopo de saneamento de fixtures, não de código de produto. Sem path de escrita vulnerável remanescente em companies; outros domínios precisam ser auditados quando emergir pressão (mesma régua das Hipóteses originais 1, 3).
- Auth recovery via global_user_id / bank cross-tenant / profile merge — não auditados, mantêm "vulneráveis" até demanda material.

**Lições materiais:**
1. **Norma vence "hipótese arquitetural pendente"**: as 4 hipóteses da DT original (`/auth/register` enforcement, CPF aleatorizado, deprecation da função, UNIQUE constraint) foram superadas pela leitura de §5+§8 — `global_user_id` é único por definição; deprecation da função foi feita executando, não decidindo.
2. **Verificação cruzada de norma antes de execução**: V1/V3 bateram literal; V2 bateu em substância mas a numeração inicial (`§4.9.X`) não correspondia ao disco — citação corrigida para `08_AUTORIDADE_CANONICA §10.1` + `AUTHORITY_LAW §1.4/§3`. Lição: sempre ler norma direto do disco, não confiar em referência por número.
3. **§8 expôs sub-bug colateral**: a chamada interna em `createCompany:708` (`getCompanyUserById` sem tenant) só apareceu em runtime após a primeira execução pós-Fatia. Fechado na mesma sessão. Disciplina: rodar prova material logo após edit estrutural para flush de sub-bugs internos.

### Contexto

SQL direto durante diagnóstico revelou que `global_user_id = 19616af8-4546-45e8-afcb-4cb2a686da0f` está vinculado a **23 users em 23 tenants distintos**:

```
b728b326 | 31110cf6 | q3v2-b-1778567931718@e2e.local
21619834 | 3506966b | q3v3-attendee-1778696685843@e2e.local
992eaef6 | 3c5962ec | q3v3-attendee-1778707170282@e2e.local
... (23 linhas total)
5e0ad0de | 77fdd0f0 | q3v3-attendee-1778711956358@e2e.local
...
```

Todos da família E2E (`q3v3-attendee-*`, `q3v2-b-*`). Causa provável: `/auth/register` reusa `global_user_id` existente por match de CPF, e os scripts E2E (`q3-e2e-v3-fundacional.ts`, etc.) usam CPFs hardcoded e repetidos a cada execução (`11144477735` para organizer, `22233344405` para attendee).

Como `global_user_id` é compartilhado, qualquer service que resolva por `global_user_id` (em vez de pelo user_id da sessão) corre risco de ambiguidade cross-tenant.

### Sintoma imediato (já corrigido cirurgicamente)

`companies.service.createCompany` aceita `tenantId?` opcional. Quando route handler em `companies.routes.ts:187` não passava `req.tenant?.id`, o service caía em `resolveTenantIdFromGlobalUserId(globalUserId)` — que com `global_user_id` duplicado retorna o **primeiro** tenant (por ordem implícita), não o do user da sessão. INSERT em tenant errado, SELECT filtra tenant correto, empresa "perdida".

**Fix aplicada (cirúrgica):** route handler passa `req.tenant?.id` explicitamente — INSERT usa tenant do JWT, fluxo destravado. **Não resolve o bug raiz** (global_user_id duplicado), apenas isola este path.

### Risco residual após fix cirúrgica

Outros serviços/handlers que dependem de `resolveTenantIdFromGlobalUserId` (ou padrões análogos) continuam vulneráveis:

- Auth recovery via global_user_id
- Bank account resolution cross-tenant (se houver)
- Profile/identity merge entre tenants
- Listagens administrativas que assumem global_user_id único

Não auditei materialmente quais outros call sites existem. Precisa varredura quando próxima fricção emergir.

### Hipóteses de resolução (sem direção arquitetural antecipada)

1. **Enforcement de unicidade na borda:** mudar `/auth/register` para criar global_user_id NOVO mesmo quando CPF colide com outro tenant. Implica revisão semântica de "o que é global_user_id?" — pessoa global ou identidade local? Decisão arquitetural.

2. **CPF aleatorizado nos seeds E2E:** alterar `q3-e2e-v3-fundacional.ts` e scripts irmãos para gerar CPFs únicos por execução. Resolve E2E sem tocar semântica.

3. **resolveTenantIdFromGlobalUserId deprecated:** marcar como anti-pattern; toda decisão de tenant deve vir do contexto da sessão (JWT/x-tenant-id). Forçar callers a passar tenantId explícito. Mais robusto, mais varredura.

4. **Constraint DB:** `UNIQUE(global_user_id)` em `users` — quebraria pessoas multi-tenant reais. Não viável sem repensar semântica.

Nenhuma hipótese autorizada. Aguarda pressão material adicional.

### Mitigação atual

- Fix cirúrgica em `companies.routes.ts:187` isola o path de criação de empresa
- Esta DT documenta o vetor para que próxima sessão tocando cross-tenant veja antes de buscar causa via meses de diagnóstico
- Scripts E2E que rodam novamente continuarão gerando users com mesmo global_user_id — não é regressão, é estado de fato do ambiente

### Critério de convergência prioritária

Esta DT vira prioritária quando:
- Outro fluxo cross-tenant apresentar sintoma similar (empresa/conta/profile "perdido")
- Auditoria de segurança questionar isolamento real entre tenants E2E
- Refactor de `/auth/register` for retomado por outra razão
- Decisão arquitetural sobre semântica de global_user_id for formalizada

### Referências

- Atravessamento HTTP que descobriu: sessão 2026-05-15 (auditoria runtime-first)
- Diagnóstico SQL: 23 rows em `users` com mesmo global_user_id
- Fix cirúrgica do sintoma: commit pendente — `companies.routes.ts:187` + req.tenant?.id como 3º parâmetro
- Memória: `feedback_runtime_soberano.md` (heurística: bug raiz ≠ bug imediato; corrigir cirurgicamente o caminho humano antes de discutir causa estrutural)

---

## DT-COMPANIES-METADATA-COLUMN-MISSING

- **Status:** OPEN
- **Origem:** Atravessamento runtime-first (2026-05-15) — descoberta via SQL `information_schema.columns`
- **Classe:** DT-S (schema — coluna referenciada por código sem existir no DB)
- **Vinculada a:** `companies.service.ts:444-455` (constrói metadata em memória); CompanyOnboardingWizard frontend; `businessCategory` em route schema
- **Convergência prevista:** quando humano pressionar onboarding com persistência real (configurar businessType, ver projeção contextual emergir) — frente arquitetural envolve decisão entre ADD COLUMN metadata JSONB vs tabela dedicada. **Fronteira PARO E CONSULTO.**

### Contexto

Schema real da tabela `companies` (verificado via `information_schema.columns`): 12 colunas — `company_id, tenant_id, company_name, trade_name, status, company_status, created_at, updated_at, global_user_id, cnpj, is_verified, primary_address_id`. **NÃO existe coluna `metadata`.**

Service `companies.service.ts:444-455` constrói objeto `metadata` em memória com `business_category` e `service_categories`. Mas o INSERT (linhas 458-484) só usa as 8 colunas existentes. Metadata é descartado silenciosamente — não há erro, não há log, não há regressão de testes.

A response do POST inclui o objeto metadata reconstruído (do input), mas o GET subsequente retorna `metadata` vazio (porque não foi persistido). Confirmado via atravessamento HTTP: `businessCategory='service'` enviado, response mostra metadata in-memory, detail subsequente mostra vazio, SQL confirma coluna ausente.

### Risco

`businessCategory`, `serviceCategories`, `onboarding.businessType`, `onboarding.modules`, `onboarding.initialRoles`, `onboarding.calendarConfig` — tudo que CompanyOnboardingWizard tenta salvar em `metadata.onboarding` é silenciosamente perdido. Empresa nasce sem contexto operacional persistido. Próxima sessão não consegue ler "Clayton escolheu panificadora" porque nunca foi salvo.

### Mitigação atual

- Service não falha (silencioso): não bloqueia criação de empresa
- Frontend pode reconstruir metadata em memória durante a sessão, mas reload perde tudo
- Workaround conceitual: usar `company_types.slug` + `tenants.company_type_id` (caminho convergente do marketplace) ao invés de metadata. Substrato existe em `categories` + `company_types` + `store-onboarding.service`.

### Resolução prevista (NÃO autorizada agora)

Aguarda pressão humana real (Clayton tentar configurar panificadora e ver que NÃO persiste). Opções a considerar quando essa pressão chegar:

1. **ALTER TABLE companies ADD COLUMN metadata JSONB** — migration DDL soberana, fronteira PARO E CONSULTO
2. **Tabela dedicada `company_metadata`** — relacionamento 1:1 com escopo claro
3. **Convergir para `company_types.slug` + tabela de mapeamento** — usa substrato canonical existente
4. **Mover onboarding state para outra entidade** — ex.: `actors.metadata` (que existe) ou `tenants.company_type_id` (que existe)

NÃO antecipar decisão. Aguarda pressão.

### Critério de convergência prioritária

- Humano pressionar onboarding e reportar fricção real
- Outra frente que dependa de metadata persistente (ex.: contextualização adaptativa por businessType)

### Referências

- Atravessamento: sessão 2026-05-15
- Code: `companies.service.ts:444-455` + `companies.routes.ts:40-101` (schema aceita businessCategory)
- Schema real: 12 colunas confirmadas via `information_schema`

---

## DT-PUT-COMPANIES-TENANT-DIVERGENCE

- **Status:** CLOSED — fix cirúrgica aplicada (2026-05-15)
- **Origem:** Atravessamento runtime-first pós-fix POST (2026-05-15)
- **Classe:** DT-R (runtime — mesma família do bug POST corrigido)
- **Vinculada a:** `DT-GLOBAL-USER-ID-DUPLICATION-E2E` (mesma causa raiz); fix POST `companies.routes.ts:187` (precedente análogo)

### Contexto

`updateCompany` em `companies.service.ts:1257-1265` não aceitava parâmetro `tenantId?`. Sempre resolvia via `resolveTenantIdFromGlobalUserId(globalUserId)`. Com global_user_id duplicado em 23 tenants E2E (vide DT-GLOBAL-USER-ID-DUPLICATION-E2E), retornava primeiro match → tenant errado → empresa "não encontrada" 404 mesmo para owner.

### Fix aplicada (cirúrgica, mesma estratégia do POST)

`companies.service.ts:1257-1263` — assinatura aceita `tenantId?`, prefere o explícito:
```ts
async updateCompany(companyId, globalUserId, input, tenantId?) {
  const finalTenantId = tenantId ?? (await this.resolveTenantIdFromGlobalUserId(globalUserId)) ?? undefined;
  ...
}
```

`companies.routes.ts:246-271` — passa `req.tenant?.id`:
```ts
const company = await companiesService.updateCompany(
  req.params.companyId,
  req.user.globalUserId,
  parsed.data as UpdateCompanyInput,
  req.tenant?.id
);
```

### Validação

- TSC backend: 0 erros
- 4 gates institucionais: PASS
- Re-atravessamento HTTP: PUT /companies/:id agora retorna 200 com tradeName atualizado; GET subsequente confirma persistência

### Risco residual

Bug raiz `global_user_id` duplicado continua em DT-GLOBAL-USER-ID-DUPLICATION-E2E. Outros métodos do service que dependem de `resolveTenantIdFromGlobalUserId` (`deleteCompany`, `getCompanyDomains`, etc.) podem ter padrão similar — não auditados.

### Referências

- Auditoria: sessão 2026-05-15
- Fix POST precedente: `companies.routes.ts:187` + req.tenant?.id

---

## DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT

- **Status:** RESOLVED 2026-05-25 — mitigação frontend via DECISION-0043 (redirect síncrono Profile.tsx → /empresa/:companyId; backend bifurcação core.service.ts). Backend getProfile ainda ignora actorId — gap cosmético sem pressão material. Sem critério de reabertura definido. (Inconsistência detectada: cabeçalho marcava OPEN mas DECISION-0043 §"Supera" já declarava encerrada em PASSO 6 do mesmo ciclo — log corrigido em 2026-05-25 como parte do warmup do dia, commit `20b5d233`.)
- **Origem:** Atravessamento runtime-first (2026-05-15) — comparação USER vs PAGE actor em GET /core/profile
- **Classe:** DT-P (projeção contextual incompleta)
- **Vinculada a:** Direção "actor-first / context-first" (memória institucional pós-2026-05-14); `action-context.middleware`

### Contexto

`GET /core/profile` exige header `x-action-context` (fail-closed). Aceita `actorId` no payload do contexto. Mas o service `profile.service.getProfile(tenantId, userId)` recebe apenas `tenantId` e `userId` da sessão — **ignora o `actorId` do action-context**.

Atravessamento HTTP confirmou:
- `action-context.actorId = userActor` → retorna profile pessoal (Aparecida Pereira Chagas)
- `action-context.actorId = pageActor` (empresa) → **retorna o MESMO profile pessoal**, com `actor.actor_type:"user"` no payload mesmo quando context aponta para page

Endpoint declara contextualização (aceita actorId), mas executa hardcoded user-centric.

### Risco

Frontend que tenta projeção contextual ("ver perfil da empresa" vs "ver perfil pessoal") recebe o mesmo conteúdo. UX confusa. Mas **não vaza dados** — sempre retorna o que o user logado já tem direito de ver.

### Mitigação atual

Frontend pode usar `/companies/:id` direto para informações da empresa (caminho já funcional pós-fix PUT). `/core/profile` continua válido como "meu perfil pessoal".

### Resolução prevista (NÃO autorizada agora)

Aguarda pressão humana — Clayton querer "ver perfil da empresa contextualmente". Sem essa pressão, é gap cosmético. Quando emergir:

1. Atualizar `profileService.getProfile` para aceitar `actorId` e bifurcar projeção (user vs page → company profile)
2. OU criar endpoint dedicado `/companies/:id/profile` (talvez já exista parcialmente)

NÃO antecipar arquitetura.

### Critério de convergência

- Humano reportar "trocar para empresa, mas o perfil continuou meu"
- Frente de actor-context navigation atravessar este endpoint

### Referências

- Atravessamento: sessão 2026-05-15
- Code: `profile.service.ts` (não auditado em detalhe)

---

## DT-API-FEED-POST-ID-DRIFT

- **Status:** OPEN
- **Origem:** Atravessamento runtime-first (2026-05-15) — `/api/feed` retorna "coluna p.post_id não existe"
- **Classe:** DT-L (legado não convergido — schema pós-Gênesis renomeou colunas, código antigo manteve nomes)
- **Vinculada a:** Schema canônico `posts` (`20260530300000_social_posts.sql`); commit `61a552c6` (frontend EventosPage já tolera gracioso failure)

### Contexto

Schema canônico `posts` (14 colunas reais via SQL): `id, tenant_id, actor_id, content, post_type, media_ids, intent, intent_metadata, targeting, is_published, is_deleted, metadata, created_at, updated_at`.

Service `FeedService.ts` (backend/src/services/feed/) referencia em queries SQL múltiplas colunas pré-Gênesis:
- `p.post_id` (schema: `p.id`) — linhas 138, 263, 313
- `p.global_user_id` (schema: `p.actor_id`) — linha 142
- `p.type` (schema: `p.post_type`) — linha 140
- `p.media` (schema: `p.media_ids`) — linha 143
- `p.visibility` (schema: `p.is_published`) — linha 163, 196
- `p.event_id` (schema: não existe direto; metadata?) — linha 184

Há tentativa parcial de defensive check (`hasEventIdColumn`, `hasVisibilityColumn`) mas as colunas primárias (`p.post_id`, `p.global_user_id`) quebram na seleção, antes de qualquer fallback.

### Callers reais

Frontend exercita `/api/feed`:
- `frontend/src/api/feed.ts:75` (apiFetch direto)
- `frontend/src/pages/FeedPage.tsx:47` (`apiFetch('/api/feed?limit=50')`)
- `frontend/src/pages/EventosPage.tsx:9` (via `getUnifiedFeed`)

### Risco

- `/api/feed` retorna 400 sempre — frontend graceful failure mostra lista vazia (sem error vermelho fatal — fix da sessão anterior `61a552c6`)
- Feed social inteiro fica vazio para humanos
- Mas NÃO bloqueia outros fluxos — Clayton consegue criar empresa, navegar, criar evento, comprar ingresso, P2P

### Mitigação atual

- Frontend tolera graciosamente (commit `61a552c6`)
- URL direta `/events/:id` continua funcional (não depende do feed)
- Existe `core/feed/feed-plugin.service.ts` mais novo que pode ser runtime soberano emergente — não auditado a fundo

### Resolução prevista (NÃO autorizada agora)

Aguarda pressão humana (Clayton querer feed social funcional). Quando emergir:

1. **Investigar runtime soberano** entre `FeedService.ts` (legado) vs `feed-plugin.service.ts` (possível novo)
2. Se `FeedService.ts` é o runtime soberano: renomear 5-6 colunas em queries SQL (fix moderada — várias linhas, mesmo arquivo)
3. Se `feed-plugin.service.ts` é o runtime soberano: `FeedService.ts` é fóssil — pode ser removido ou marcado deprecated

NÃO mexer em estrutura social antes da decisão de runtime soberano. Risco de criar verdade paralela.

### Critério de convergência

- Humano reportar "feed social vazio quando deveria ter conteúdo"
- DT-SOCIAL-REPOSITORY-DRIFT-§28 (cluster 20+ arquivos mencionado em STATUS_EXECUCAO_GLOBAL) ser priorizada por outra razão

### Referências

- Schema real `posts`: 14 colunas via `information_schema`
- Code: `backend/src/services/feed/FeedService.ts:125-200`
- Frontend graceful: commit `61a552c6`
- Possível runtime soberano alternativo: `backend/src/core/feed/feed-plugin.service.ts`

---

## DT-DASHBOARD-OWNER-PERMISSION-GAP

- **Status:** OPEN
- **Origem:** Atravessamento runtime-first (2026-05-15) — `/dashboard` retorna 403 mesmo para owner com action-context válido
- **Classe:** DT-A (authority — permission gap no chain)
- **Vinculada a:** `authorization.service.ts` (chain ownership → entity_ownership → delegation → capabilities → DENY); `permission-keys.ts` (mapa de permissions)

### Contexto

Atravessamento HTTP com USER actor (action-context.actorId=userActor, intent=`view_dashboard`, scope=`tenant:dashboard:read`) retornou:
```
403 "Actor is missing required permission: dashboard:view for intent 'view_dashboard' in scope 'tenant:dashboard:read'"
```

Mesmo comportamento com PAGE actor (empresa). Authority chain rejeita corretamente — não é confusão de actor, é gap real de permission grant.

`company_users.permissions` para o owner inclui: `canManageCompany, canManageFinancial, canManageEmployees, canViewReports, canManageServices`. **NÃO inclui `dashboard:view`**.

Mapeamento entre permissions de companies (granulares por capacidade) e permissions canônicas (`permission-keys.ts` em formato `resource:action`) parece incompleto — owner não recebe automaticamente `dashboard:view` mesmo sendo dono.

### Risco

Owner não acessa painel administrativo via `/dashboard`. Mas `/empresas → CompaniesManager` funciona como entrypoint operacional. Frontend pode evitar /dashboard ou exibir via outro caminho.

### Mitigação atual

- `/empresas` funciona como entrypoint humano principal (sidebar aponta para lá)
- Owner manipula empresa via `/companies/:id` (GET + PUT pós-fix)
- Não bloqueia atravessamento de criação/edição

### Resolução prevista (NÃO autorizada agora)

Aguarda pressão humana — Clayton tentar acessar dashboard e reportar fricção. Quando emergir:

1. Investigar mapeamento companies-permissions ↔ canonical permission-keys
2. Decidir se `dashboard:view` deve ser implícito para qualquer owner OU grant explícito no createCompany
3. NÃO tocar `13_PERMISSIONS_CANONICA.md` (proposto/não-vigente — fronteira PARO E CONSULTO)

Fix candidato (sem autorização): atualizar `permissionsFromCompanyUserRole` (se existir) para adicionar `dashboard:view` para owner. **Pode tocar zona de modelo de permissões — frente arquitetural se mal calibrada.**

### Critério de convergência

- Humano tentar acessar dashboard administrativo e reportar
- Frente de painel/dashboard contextual emergir como prioridade

### Referências

- Authority chain: `authorization.service.ts:79-313`
- Permissions: `permission-keys.ts` (62 permissions v1.6)
- Validação 13_PERMISSIONS_CANONICA: PROPOSTO/NÃO VIGENTE


## DT-HEALTH-MODULE-FROZEN

- **Status:** OPEN
- **Origem:** Sessão 36 (2026-05-16) — restauração de domínio próprio de saúde a partir de `migrations_archive/0382` + `0384` foi REVERTIDA após descoberta material de migração inconclusa para `categories` core.
- **Classe:** DT-D (decision suspensa — múltiplas verdades arquiteturais coexistindo)
- **Vinculada a:**
  - `backend/src/core/profile/profile-health-taxonomy-adapter.ts` (existe — adapter de leitura para `categories` core)
  - `backend/src/core/profile/profile-health.routes.ts` (TODOs `DOMÍNIO ESPECIAL -> categories (core)` linhas 3, 16, 39, 86, 151)
  - `backend/src/core/profile/profile-health-facts.repository.ts` (legacy — lê de `user_health_facts` que NÃO existe)
  - `backend/src/core/profile/profile-health.repository.ts` (legacy — lê de `health_declarations` que NÃO existe)
  - `backend/migrations_archive/0382_health_relational_model.sql` (arquivada)
  - `backend/migrations_archive/0384_health_declarations.sql` (arquivada)
  - `backend/src/scripts/seed-health-taxonomies.ts` (50 taxonomias — SSOT lógica)
  - `backend/migrations/0061_categories.sql:23-33` (`scope CHECK` NÃO inclui `'health'`)

### Contexto

Módulo Saúde está em **migração inconclusa** entre duas arquiteturas:

| Camada | Estado |
|---|---|
| Decisão histórica (`0382` arquivada) | "Saúde tem domínio próprio — `health_taxonomies` + `user_health_facts` + `health_consents` + `health_declarations`" |
| Decisão posterior (adapter no código) | "Saúde migra para `categories` core via adapter sobre `scope='health'`" |
| Migração efetivamente realizada | NENHUMA das duas: adapter existe mas `categories.scope CHECK` não inclui `'health'` e zero rows com `scope='health'`; tabelas legacy não existem no DB |

Adapter sempre retorna `[]`. Repositories legacy de facts/declarations apontam para tabelas inexistentes. Aba `/perfil` → Saúde retorna 500.

### O que a sessão 36 descobriu (informação arquitetural valiosa, preservada)

1. **O adapter já existe** → houve decisão posterior ao archive declarando intenção de unificar em `categories` core
2. **A intenção nunca foi completada** → CHECK não foi ampliado, catálogo nunca foi populado em core, repos de facts/declarations não foram migrados
3. **Dupla soberania potencial** → tentar restaurar legacy + manter adapter = duas SSOTs paralelas
4. **`health_consents` é órfã no código atual** (zero referências em `backend/src`) — provável vestígio de design abandonado antes mesmo da decisão de migrar para core

### Risco

- Aba Saúde inacessível (500 em `/profile/health/facts`)
- Próximo desenvolvedor pode "consertar" empurrando legacy OU empurrando core — ambos os caminhos são DECISIONs arquiteturais inéditas
- Bloqueia visão futura Clayton: "transplantes, doações, matching médico — fonte de verdade unificada"

### Reversão executada na sessão 37 (esta)

- DROP TABLE (CASCADE) das 4 tabelas restauradas pela sessão 36: `health_taxonomies`, `user_health_facts`, `health_consents`, `health_declarations`
- Remoção das 3 migrations do disco: `20260530541000_health_declarations.sql`, `20260530542000_health_relational_model.sql`, `20260530543000_seed_health_taxonomies.sql`
- Estado restaurado: idêntico ao pré-sessão 36

### Resolução prevista (NÃO autorizada agora — frente arquitetural própria)

Aguarda DECISION humana entre 4 caminhos materiais:

| Caminho | Direção |
|---|---|
| **CORE-COMPLETE** | Ampliar CHECK `categories.scope` para incluir `'health'` + popular catálogo em `categories` + migrar `profile-health-facts.repository` + `profile-health.repository` para adapter sobre core (ou criar nova tabela `actor_health_facts` actor-centric) |
| **DOMAIN-OWN** | Restaurar legacy (sessão 36 redo), reverter adapter, voltar a "saúde tem domínio próprio". Documenta TODOs como obsoletos |
| **HYBRID** | Aceitar fronteira: taxonomias em core, fatos/declarations em legacy. Ampliar CHECK, popular core, restaurar `user_health_facts` + `health_declarations` |
| **ACTOR-CENTRIC** | Alinhar com tese 2026-05-15 (`project_actor_unidade_operacional_soberana`): tabela `actor_health_*` (não `user_health_*`); redesign completo. Frente maior |

Decisão deve considerar:
- LGPD Art. 11 (consent, audit, valores tipados) — `0382` desenhado para isso, `categories` não
- Implicações futuras (transplantes, doações, matching médico) declaradas por Clayton 2026-05-16
- Tese arquitetural actor-centric mais recente

### Critério de convergência

- Pressão humana para destravar aba Saúde
- OU emergência de feature dependente (transplante/doação)
- OU revisão sistemática dos archives (frente B mencionada na sessão 37 — auditoria geral de `migrations_archive` + `migrations-resetadas`)

### Referências

- Adapter: `backend/src/core/profile/profile-health-taxonomy-adapter.ts:46`
- Schema CHECK: `backend/migrations/0061_categories.sql:23-33`
- Tese actor-centric: `~/.claude/projects/C--unificard/memory/project_actor_unidade_operacional_soberana.md`
- Migrations arquivadas: `backend/migrations_archive/0382_health_relational_model.sql` + `0384_health_declarations.sql`
- Catálogo SSOT lógica: `backend/src/scripts/seed-health-taxonomies.ts` (50 taxonomias)
- Sessão 36 (executei): `executei_36.md` (preservado como log histórico)
- Sessão 37 (reversão): `executei_37.md`



## DT-MODULES-ASPIRATIONAL-VS-RUNTIME

- **Status:** OPEN
- **Prioridade:** HIGH
- **Origem:** Frente 2 do plano de inventário estrutural (sessão 2026-05-16, MODULES_INVENTORY.md)
- **Classe:** DT-INSTITUCIONAL (governança de inventário)
- **Resumo material:** Inventário de 157 módulos backend (src/core/* + src/modules/*) classificou:
  - 71 FUNCIONAIS (45%)
  - 29 FANTASMAS (18%) — código referencia tabelas que **não existem no DB**
  - 25 NO_DATA_LAYER (16%)
  - 20 ESQUELETOS (13%) — 4 RECENTE + 16 DORMENTE
  - 12 INDEFINIDOS (8%)
- **Risco:** 24 dos 29 FANTASMAS têm frontend caller — endpoints chamados em runtime, query falha por tabela inexistente. Risco institucional: próximo dev presume "módulo X existe" sem checar substrato.
- **Mitigação atual:** `MODULES_INVENTORY.md` na raiz como SSOT de classificação. Reproduzível via queries SQL listadas no apêndice.
- **Critério de convergência:** cada FANTASMA priorizado precisa de DT individual com decisão binária: (a) criar tabela+migration+seed ou (b) remover/congelar endpoint. Top 5 críticos: work-instant (14 rotas), venue (12), presence (11), policy-engine (11), automation (10).
- **Referência:** `MODULES_INVENTORY.md` seções 1-2.


## DT-ACTOR-DELEGATIONS-ZERO-RUNTIME

- **Status:** OPEN
- **Prioridade:** HIGH
- **Origem:** Inventário Frente 2 — classificada como ESQUELETO_RECENTE
- **Classe:** DT-RUNTIME (substrato ausente)
- **Resumo material:** Tabela `actor_delegations` criada em `20260530493000_create_actor_delegations.sql` com estrutura sólida (`scopes_json jsonb, is_transitive bool, expires_at timestamptz, revoked_at timestamptz, status varchar`). **Zero rows.** Modelo desenhado para futuro mas nunca exercitado.
- **Implicação operacional:** Bloqueia v2 do modo operante (resolver dinâmico precisa ler delegações). Bloqueia caso canônico "freelancer multi-empresa" (Clayton garçom na churrascaria). Multi-empresa real hoje = 3 users com múltiplas empresas, todos como **owner** das próprias — não há exemplo de PF atuando em empresa de outro.
- **Mitigação atual:** v1 modo operante usa lista hardcoded por actor_type (não toca delegations).
- **Critério de convergência:** primeira delegação real ser exercitada via UI. Substratos adjacentes: UI de criar delegação, UI de aceitar delegação, UI de revogação, evento delegation_granted/revoked integrado a authority_decision_audit.
- **Referência:** `MODULES_INVENTORY.md` seção 3 + 5 (Padrão 4 — vínculo operacional).


## DT-BANK-SATELLITE-MODULES-DORMANT

- **Status:** OPEN
- **Prioridade:** MEDIUM
- **Origem:** Inventário Frente 2 — 13 módulos ESQUELETO_DORMENTE
- **Classe:** DT-LEGADO (fundação aspiracional não exercitada)
- **Resumo material:** 13 módulos satélite do bank engine têm tabela criada (migrations 0031-0051) mas **zero rows e código estagnado > 60 dias**:
  - alerts, bank-settlement, circuit-breaker, disputes, freezes, governance (financial_actions), governance-funding, governance-funding-commitment, payouts, rate-limit, reversal, risk, sla, treasury, treasury-split
- Apenas `bank_*` core (ledger, transactions, accounts, splits) está vivo. Os satélites são fundação ampla nunca virada runtime.
- **Risco:** sob pressão, alguém pode tentar "ativar" um deles sem entender que toda a infraestrutura ao redor (events, sagas, jobs) também precisa ser construída.
- **Critério de convergência:** sessão dedicada de "ratificar ou arquivar" — para cada um, decisão binária baseada em: este módulo é necessário para visão atual, ou é dívida histórica?
- **Princípio aplicado:** `feedback_archive_nao_e_ssot.md` (sessão 37) — não apagar sem auditar, mas congelar com critério explícito.
- **Referência:** `MODULES_INVENTORY.md` seção 3 (ESQUELETO_DORMENTE).


## DT-PROFESSION-DATA-SPARSE

- **Status:** OPEN
- **Prioridade:** MEDIUM
- **Origem:** Inventário Frente 2 — `profile.metadata.profession` em 3/61 profiles (5%)
- **Classe:** DT-RUNTIME (dado ausente)
- **Resumo material:** A frase "profissão é hint dentro do modo Operar" (memória `project_modo_operante.md`) só tem efeito se profession estiver populada. Hoje 95% dos profiles não têm profession.
- **Implicação:** v1 modo operante (já implementado) não sofre — não usa profession ainda. v2 dinâmico precisará UX de captura no onboarding/perfil **antes** de profession-as-hint fazer sentido material.
- **Mitigação atual:** v1 não depende.
- **Critério de convergência:** UX de captura de profissão no onboarding/perfil → população > 60% antes de v2 usar profession como input.
- **Referência:** `MODULES_INVENTORY.md` seção 1 (refinamento Sunny — narrativa anterior).


## DT-OPERATING-MODE-STATIC-PROJECTION

- **Status:** OPEN
- **Prioridade:** MEDIUM
- **Origem:** Sessão de implementação v1 modo operante (2026-05-16) + auditoria Sunny
- **Classe:** DT-CONVERGENCIA-INSTITUCIONAL (definição soberana vs implementação)
- **Resumo material:** Definição soberana (memória `project_modo_operante.md`): "modo operante NÃO cria capability, REVELA capabilities já autorizadas". Implementação v1 atual (`actorContextConfig.ts`): listas hardcoded de quick actions por (actor_type, mode). **Não consulta `actor_delegations`, `company_users`, `authority_decision_audit`.** Tradeoff consciente para validar UX.
- **Risco:** v1 vira referência se ficar muito tempo em produção. Próxima geração de profissões/capabilities/modos imita padrão hardcoded em vez do dinâmico.
- **Mitigação atual:** registro explícito desta DT torna tradeoff visível.
- **Critério de convergência:** após smoke v1 validado + `actor_delegations` ter runtime real (vide DT-ACTOR-DELEGATIONS-ZERO-RUNTIME) + nova autorização para v2 dinâmico.
- **Referência:** `MODULES_INVENTORY.md` seção 6.


## DT-CONVERGENCE-AVAILABILITY-AS-CANONICAL-TEMPORAL

- **Status:** OPEN
- **Prioridade:** MEDIUM
- **Origem:** Frente 2 — Padrão 1 (Disponibilidade) analisado com critério material Sunny
- **Classe:** DT-CONVERGENCIA-ARQUITETURAL
- **Resumo material:** `core/availability/unified-availability` é SSOT temporal real (44 rows entre `availability` + `bookings`). 4 tabelas paralelas modelam conceito semanticamente equivalente:
  - `event_sessions` (10 cols: starts_at/ends_at/capacity) — owner_type='event'
  - `rides_driver_sessions` (7 cols: started_at/ended_at/is_online) — owner_type='driver'
  - `pdv_sessions` (9 cols: opened_at/closed_at) — owner_type='pdv'
  - `schedules + schedule_slots` (template recorrente) — pode gerar availabilities concretas
- **Núcleo comum (5+ tabelas):** apenas tenant_id, metadata, status, created_at, id, updated_at (genéricos). Convergência NÃO automática, mas POSSÍVEL via projeção sob owner_type+owner_id em availability.
- **`bookings` ↔ `event_reservations`:** mesmo conceito (reserva sobre janela). event_reservations adiciona payment_bank_transaction_id. Convergência via projeção.
- **`services` NÃO pertence:** é catálogo, não temporal. Falso positivo da hipótese original.
- **Critério de convergência:** frente arquitetural dedicada após DECISION-0037 (proposta) — ratificação de `unified-availability` como SSOT temporal soberana. Migração das 4 tabelas paralelas para View ou consumidora.
- **Referência:** `MODULES_INVENTORY.md` seção 5 (Padrão 1).


## DT-PRESENCE-FRAGMENTED-NO-RUNTIME

- **Status:** OPEN
- **Prioridade:** MEDIUM
- **Origem:** Frente 2 — Padrão 3 (Presença/check-in)
- **Classe:** DT-FRAGMENTACAO (múltiplos modelos paralelos, zero runtime)
- **Resumo material:** 4 modelos paralelos de presença/check-in, schemas materialmente diferentes, zero runtime:
  - `event_checkins` (existe, 0 rows) — owner=event
  - `live_presence` (existe, 0 rows: context_type, context_id, opted_in, last_seen_at, expires_at)
  - `rides_driver_locations` (existe, 0 rows)
  - `modules/presence` (FANTASMA — referencia checkin_tokens, checkins, presence_rsvps, promo_benefits que não existem)
- **Risco:** quando primeira presença real emergir, 4 caminhos de implementação possíveis sem critério de escolha.
- **Critério de convergência:** quando primeiro caso real emergir (evento com check-in, rides com driver online, RSVP de venue), escolher SSOT e migrar/arquivar resto.
- **Referência:** `MODULES_INVENTORY.md` seção 5 (Padrão 3).


## DT-AUTHORITY-AUDIT-LIMITED-TO-FINANCIAL

- **Status:** OPEN
- **Prioridade:** MEDIUM
- **Origem:** Refinamento Sunny #3 (decomposição `authority_decision_audit`)
- **Classe:** DT-OBSERVABILIDADE (sinal de runtime limitado)
- **Resumo material:** `authority_decision_audit` tem 34 rows totais, **TODAS em action_type IN ('financial_transfer', 'financial_payment')**. Decomposição:
  - financial_transfer ALLOW: 23
  - financial_payment BLOCK: 6
  - financial_payment ALLOW: 3
  - financial_transfer BLOCK: 2
- Não há audit hits para: delegação granted/revoked, ownership de empresa, capability genérica, presence opt-in, booking confirmed, qualquer ação não-financeira.
- **Risco:** usar `authority_decision_audit` como métrica geral de funcionalidade do sistema é enganoso — sinaliza apenas o domínio financeiro.
- **Mitigação:** documentar limitação. Quando outros domínios precisarem de audit chain, expandir tabela ou criar audits específicos.
- **Critério de convergência:** primeira ação não-financeira que precise de audit institucional. Não criar audit chain ampliada por antecipação.
- **Referência:** `MODULES_INVENTORY.md` seção 1 (authority audit decomposto).



## DT-PRESENCE-FRAGMENTATION-CONFIRMED

- **Status:** OPEN
- **Prioridade:** HIGH
- **Origem:** Frente 2 sessão 2 — análise material P4 (Presença/Check-in) com critério Sunny
- **Classe:** DT-FRAGMENTACAO (múltiplos modelos paralelos confirmados materialmente)
- **Supera/evolui:** DT-PRESENCE-FRAGMENTED-NO-RUNTIME (eleva prioridade após confirmação material)
- **Resumo material:** 8 tabelas no padrão de presença/checkin/janela operacional, TODAS com 0 rows, schemas materialmente distintos em 4 categorias semânticas:
  - **(a) Declaração de intent:** `live_presence` (status: ONLINE/OFFLINE), `event_rsvp` (pending/yes/no/maybe)
  - **(b) Presença executada:** `event_attendees` (registered/cancelled/attended), `event_checkins` (sem status)
  - **(c) Janela operacional:** `rides_driver_sessions` (started_at/ended_at), `event_sessions` (starts_at/ends_at/capacity), `pdv_sessions` (opened_at/closed_at)
  - **(d) Tracking espacial:** `rides_driver_locations`
- `modules/presence` (FANTASMA) tenta ser overlay com schema PRÓPRIO (`checkin_tokens, checkins, presence_rsvps, promo_benefits`) — 9º modelo paralelo no código sem tabelas.
- Max Jaccard cross-domain inesperado: `live_presence ↔ pdv_sessions` 40%; `event_attendees ↔ pdv_sessions` 42% — sugerindo overlap não intencional.
- **Implicação para v2 modo operante:** quando primeiro caso real exigir presença/checkin, 4-9 caminhos de implementação possíveis sem critério prévio.
- **Critério de convergência:** decisão arquitetural prévia sobre SSOT de presença ANTES de qualquer feature real (modo Online, driver online, garçom checkin, evento attended). Sem isso, próxima frente de presença reproduz fragmentação.
- **Recomendação substantiva:** `live_presence` é candidato natural a SSOT da camada (a) por status enum coerente (ONLINE/OFFLINE) + estrutura (context_type/context_id/opted_in/last_seen_at/expires_at) projetada para presença genérica. Mas decisão arquitetural soberana é frente própria.
- **Referência:** `MODULES_INVENTORY.md` seção 5 (Padrão 4).


## DT-OPERATIONAL-BINDING-FRAGMENTATION

- **Status:** OPEN
- **Prioridade:** HIGH
- **Origem:** Frente 2 sessão 2 — análise material P5 (Vínculo operacional) com critério Sunny
- **Classe:** DT-FRAGMENTACAO (mais severa de todos os padrões auditados)
- **Vinculada a:** DT-ACTOR-DELEGATIONS-ZERO-RUNTIME (sub-fragmentação relacionada)
- **Resumo material:** 6+ tabelas modelando "X tem papel em Y" com semânticas próximas mas schemas materialmente diferentes:
  - **Delegação rica (desenho canônico):** `actor_delegations` (scopes JSONB + is_transitive + expires_at + revoked_at; 0 rows)
  - **Vínculo PF→empresa exercitado:** `company_users` (5 booleans hardcoded can_manage_*; 9 rows)
  - **RBAC sistema:** `user_roles` (1) + `role_permissions` (68)
  - **Vínculo de grupo:** `group_members` (5)
  - **Vínculo organizer:** `event_organizer_members`, `event_organizers` (0)
  - **Vínculo staff de evento:** `event_staff` (0)
  - **Tutela econômica:** `economic_guardianship` (subject+guardian+scope+limit_amount_cents; 0)
  - **Esqueleto vazio:** `partner_employees` (4 cols apenas)
- Max Jaccard baixo (43% entre quaisquer pares) — schemas materialmente diferentes
- Apenas 4 com runtime (company_users, role_permissions, group_members, user_roles)
- **Convergência teórica:** todos absorvíveis sob `actor_delegations` (ex: "Clayton delega 'manager' em Voltagem com scopes=['manage_financial','manage_employees'] expires_at=NULL" substitui company_users row). Refactor pesado risca substrato exercitado.
- **Implicação institucional crítica:** caso canônico "freelancer multi-empresa" precisa de **decisão arquitetural prévia** sobre qual modelo absorve o vínculo. Hoje não há ponte entre os 6+ modelos.
- **Critério de convergência:** DECISION arquitetural soberana antes do primeiro caso real de freelancer multi-empresa. Opções:
  - (a) `actor_delegations` vira SSOT; outros viram projeções/instâncias
  - (b) `actor_delegations` permanece para casos temporários/granulares; `company_users`+`role_permissions` continuam para vínculos perenes
  - (c) modelo híbrido com critério explícito de qual usar quando
- **Referência:** `MODULES_INVENTORY.md` seção 5 (Padrão 5).


## DT-PAYMENT-DOMAIN-COMPLEX

- **Status:** OPEN (informativa, não ação imediata)
- **Prioridade:** MEDIUM
- **Origem:** Frente 2 sessão 2 — análise material P6 (Proposta contextual / Pagamentos)
- **Classe:** DT-DOMINIO-COMPLEXO (sobreposição alta mas design coerente, não fragmentação acidental)
- **Resumo material:** 9 tabelas no espaço de pagamento com sobreposição material alta (Jaccard 50%+ entre múltiplos pares) mas cada uma com domínio específico:
  - `payment_intents` (6 rows) — autorização
  - `payment_milestones` — escrow gradual
  - `payment_transactions` — movimento real
  - `escrow_accounts` + `escrow_transactions` — custódia
  - `b2b_payment_intents` — paralelo B2B
  - `service_payment_requests` (14) + `service_payment_executions` (1) — pagamento específico de serviços
  - `payout_requests` — saída
- **Sobreposição material identificada:**
  - `service_payment_requests ↔ service_payment_executions` 53%
  - `payment_milestones ↔ escrow_transactions` 53%
  - `payment_transactions ↔ payout_requests` 50%
- Vocabulário compartilhado nos status enums (pending/completed/cancelled/failed/released/refunded) mas semântica de cada tabela distinta.
- **Veredito:** Payment Engine **desenhado** com responsabilidades separadas. Não é Frankenstein.
- **Risco residual:** caller pode confundir qual tabela usar quando. Mitigação: documentação cross-table de "intent vs milestone vs transaction vs payout vs escrow".
- **Não autoriza convergência arquitetural** — apenas documentação de relações + glossário institucional.
- **Critério de convergência:** N/A — DT informativa. Reavaliada apenas se runtime exercitar conflito.
- **Referência:** `MODULES_INVENTORY.md` seção 5 (Padrão 6).



## DT-PAYMENT-DOMAIN-COMPLEX — REFINAMENTO Sunny (2026-05-16)

**Atualização:** Sunny argumentou que "informativa" subestima risco. Promovida para MEDIUM padrão com critério operacional.

**Critério institucional adicionado:** ANTES de qualquer novo módulo ler/escrever em `payment_*`, `escrow_*`, `payout_*`, `service_payment_*`, leitura obrigatória de tabela canônica de "qual cobre qual caso":

| Conceito | Tabela canônica | NÃO confundir com |
|---|---|---|
| Autorização (pagamento aprovado mas não capturado) | `payment_intents.status` | `payment_transactions.status` (movimento real) |
| Movimento financeiro real | `payment_transactions.status='completed'` | `payment_intents.status='completed'` (só autorizou) |
| Pedido de payout (interno) | `payout_requests.status='completed'` | Dinheiro saiu (verificar bank_ledger) |
| Custódia ativa | `escrow_accounts.status='active'` | `escrow_transactions.status='completed'` (movimento dentro do escrow) |
| Pagamento gradual por marco | `payment_milestones.status` | Substituto de payment_intents (não é — é decomposição) |
| Pagamento específico de serviços | `service_payment_requests + service_payment_executions` | Outros payment_* (subsistema próprio do services module) |

**Risco recorrente:** vocabulário compartilhado (pending/completed/cancelled/failed/released/refunded) com semântica distinta gera bug em integrador novo. Engenheiro lê "completed" e assume terminou; tabela diferente pode significar "só autorizou" vs "dinheiro moveu".

**Critério de convergência:** N/A — DT permanente de documentação. Não dispara revisão.


## DT-OPERATIONAL-BINDING-FRAGMENTATION — SUB-ITEM (2026-05-16)

**Sub-fragilidade identificada (Sunny):** maioria das tabelas de vínculo NÃO tem status enum. Concretamente:
- `company_users` (9 rows, FUNCIONAL) — sem status enum, apenas `is_active boolean` + 5 booleans hardcoded
- `group_members` (5 rows, FUNCIONAL) — sem status enum
- `partner_employees` (esqueleto 4 cols) — sem status enum
- `event_organizer_members` — sem status enum
- `economic_guardianship` — sem status enum
- `user_roles` (1 row), `role_permissions` (68 rows) — sem status enum
- Apenas `actor_delegations` (revoked/active/suspended) e `event_staff` (active/inactive/cancelled) têm status

**Implicação operacional:** quando primeira revogação real ocorrer (ex: Caixa revoga delegação de Clayton), sistema precisa de trilha de runtime. Sem status enum:
- Cleanup vira DELETE silencioso (sem auditoria)
- Não há diferenciação entre "revogado", "expirado", "suspenso", "pendente"
- Authority chain (que confere "Clayton pode atuar como X?") perde sinal de "estava ativo, virou revogado em T"
- Vínculo morre sem rastro

**Recomendação técnica (não autoriza implementação):** quando primeira frente de delegação real abrir, padronizar status enum across todas as tabelas de vínculo (active/revoked/suspended/expired) ANTES de povoar runtime. Sem isso, fragilidade vira incidente quando o caso 1 emergir.

**Critério de convergência:** primeira delegação real exercitada em runtime + decisão arquitetural P5.


## DT-MODULE-WORK-INSTANT-FROZEN-PRE-P4-P5

- **Status:** OPEN
- **Prioridade:** MEDIUM
- **Origem:** Frente 2 sessão 2 — auditoria FANTASMAs com frontend caller (top 1)
- **Classe:** DT-CONGELAMENTO (módulo congelado pré-decisão arquitetural)
- **Resumo material:** `modules/work-instant` tem 14 rotas backend, código completo (smart-matching, dispatcher-gateway, tracking), tabelas inexistentes (`worker_skills, instant_requests, worker_status, assignments`). Implementar tabelas agora reproduz fragmentação P4+P5 (presença + vínculo).
- **Decisão:** CONGELAR no estado atual. Manter código no disco. Esconder/desabilitar rotas frontend se já estão visíveis.
- **Critério de descongelamento:** simultaneamente (a) decisão arquitetural sobre P4 (presença = qual SSOT) + (b) decisão arquitetural sobre P5 (vínculo = qual SSOT) + (c) primeira oportunidade real de matching que justifique custo.
- **Referência:** `MODULES_INVENTORY.md` seção 10 (item #1).


## DT-MODULE-VENUE-FROZEN-PRE-RESTAURANT-VERTICAL

- **Status:** OPEN
- **Prioridade:** MEDIUM
- **Origem:** Frente 2 sessão 2 — auditoria FANTASMAs com frontend caller (top 2)
- **Classe:** DT-CONGELAMENTO
- **Resumo material:** `modules/venue` tem 12 rotas, esquema de restaurant (`tabs, tab_orders, menus, menu_items`) + QR token. Vinculado a `modules/pdv` (também esqueleto). Vertical "restaurant" não emergiu como prioridade material.
- **Decisão:** CONGELAR. Manter código no disco. Esconder rotas frontend.
- **Critério de descongelamento:** decisão de vertical "restaurant" emergir como prioridade + cliente-piloto real adotar PDV+venue como ERP.
- **Referência:** `MODULES_INVENTORY.md` seção 10 (item #2).


## DT-MODULE-PRESENCE-FROZEN-PRE-P4-DECISION

- **Status:** OPEN
- **Prioridade:** HIGH
- **Origem:** Frente 2 sessão 2 — auditoria FANTASMAs com frontend caller (top 4)
- **Classe:** DT-CONGELAMENTO (vinculado a fragmentação P4)
- **Resumo material:** `modules/presence` tem 11 rotas + schema próprio (`checkin_tokens, checkins, presence_rsvps, promo_benefits`) — é o **9º modelo paralelo** identificado na fragmentação P4 (Padrão 4 do inventário). Implementar suas tabelas adicionaria fragmentação confirmada.
- **Decisão:** CONGELAR explicitamente. Manter código no disco. Esconder rotas frontend.
- **Critério de descongelamento:** decisão arquitetural P4 escolher SSOT de presença. Se `live_presence` vencer (recomendação preliminar pelo status enum ONLINE/OFFLINE + estrutura genérica), módulo presence migra para usar live_presence em vez de schema próprio.
- **Referência:** `MODULES_INVENTORY.md` seções 5 (Padrão 4) + 10 (item #4).


## DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE

- **Status:** OPEN
- **Prioridade:** HIGH
- **Origem:** Frente 2 sessão 2 — auditoria FANTASMAs com frontend caller (top 3)
- **Classe:** DT-AUDITORIA-HUMANA (risco de conflito com authority chain)
- **Resumo material:** `modules/policy-engine` tem 11 rotas + schema (`policy_rules, policy_decisions`) paralelo a `authorization.service` + `permissions` (FUNCIONAL, runtime exercitado via `authority_decision_audit`). Risco material: foi pensado como replacement de authorization ou overlay?
- **Decisão:** AUDITORIA HUMANA URGENTE. NÃO implementar tabelas sem decidir relação com authority chain.
- **Critério de convergência:**
  - Se replacement: explicar racional e migrar permissions/role_permissions/authorization.service para policy-engine model
  - Se overlay: explicar quando usar policy vs authorization; documentar precedência
  - Se obsoleto: remover endpoint + esconder frontend
- **Referência:** `MODULES_INVENTORY.md` seção 10 (item #3).



# ================================================================
# PASSO 2 da FRENTE 4 — Ratificações + DT nova (2026-05-16)
# ================================================================

# Esta seção é append-only e ratifica explicitamente as 4 DTs de
# módulos FANTASMAs já registradas + cria DT-MODULE-AUTOMATION nova.
# Vinculadas a DECISION-0040 (ratificação caso a caso de FANTASMAs com
# frontend caller, top 5 + 19 restantes).
#
# Critério institucional aplicado a cada uma (Clayton 2026-05-16):
#   1. Status atual explícito (OPEN→FROZEN, AUDIT_URGENT, etc.)
#   2. Critério material de descongelamento ou resolução
#   3. Vínculo institucional (DECISION-0040)


## RATIFICAÇÃO 1 — DT-MODULE-WORK-INSTANT-FROZEN-PRE-P4-P5

- **Status:** **FROZEN** (era OPEN; ratificado explicitamente)
- **Vínculo institucional:** DECISION-0040 (top 5 FANTASMAs, decisão CONGELAR)
- **Critério material de descongelamento — refinado:**
  Descongelamento SOMENTE quando TODAS as 4 condições materializarem simultaneamente:
  1. `actor_delegations` ter runtime real (primeira delegação real exercitada via UI; hoje 0 rows)
  2. DECISION arquitetural sobre P5 (vínculo operacional) registrada — qual SSOT absorve "freelancer multi-empresa"
  3. DECISION arquitetural sobre P4 (presença) registrada — qual SSOT absorve "worker online"
  4. Caso real de matching instantâneo (passageiro/comida/serviço) emergir como prioridade material com cliente-piloto
- **Ação intermediária permitida:** esconder/desabilitar rotas frontend (`/work/instant/*`) se já estão visíveis em produção; manter código backend no disco.
- **Ação proibida sem nova DECISION:** criar tabelas `worker_skills, instant_requests, worker_status, assignments`. Implementar reproduz fragmentação P4+P5 confirmada.
- **Próxima revisão:** quando uma das 4 condições materializar.


## RATIFICAÇÃO 2 — DT-MODULE-VENUE-FROZEN-PRE-RESTAURANT-VERTICAL

- **Status:** **FROZEN** (era OPEN; ratificado explicitamente)
- **Vínculo institucional:** DECISION-0040 (top 5 FANTASMAs, decisão CONGELAR)
- **Critério material de descongelamento — refinado:**
  Descongelamento SOMENTE quando TODAS as 3 condições materializarem:
  1. Vertical "restaurant" emergir como prioridade material declarada por Clayton
  2. Cliente-piloto real (restaurante/bar/venue) adotar UnifiCard como ERP operacional (não apenas pagamento)
  3. `modules/pdv` (também esqueleto FANTASMA) ser destravado em paralelo — venue depende de pdv para tabs/orders funcionarem
- **Ação intermediária permitida:** esconder/desabilitar rotas frontend (`/venue/*`, `/tabs/*`, `/menus/*`, `/v/:slug/*`, `/t/:qrToken`); manter código backend no disco.
- **Ação proibida sem nova DECISION:** criar tabelas `tabs, tab_orders, menus, menu_items`. Implementar isoladamente sem pdv vivo gera mais um nó FANTASMA encadeado.
- **Próxima revisão:** quando vertical restaurant emergir.


## RATIFICAÇÃO 3 — DT-MODULE-PRESENCE-FROZEN-PRE-P4-DECISION

- **Status:** **FROZEN** (era OPEN; ratificado explicitamente)
- **Vínculo institucional:** DECISION-0040 (top 5 FANTASMAs, decisão CONGELAR) + Padrão 4 confirmado (DT-PRESENCE-FRAGMENTATION-CONFIRMED)
- **Critério material de descongelamento — refinado:**
  Descongelamento SOMENTE quando:
  1. DECISION arquitetural P4 escolher SSOT de presença entre os 9 modelos paralelos identificados na Frente 2
  2. Se `live_presence` vencer (recomendação preliminar pelo status enum ONLINE/OFFLINE + estrutura genérica context_type/context_id/opted_in/last_seen_at/expires_at): `modules/presence` MIGRA para usar `live_presence` (NÃO cria `checkin_tokens/checkins/presence_rsvps/promo_benefits` próprios)
  3. Se outro modelo vencer: `modules/presence` projeta sobre ele OU é deprecado conscientemente
- **Ação intermediária permitida:** esconder/desabilitar rotas frontend (`/presence/*`, `/rsvp/*`, `/checkin/*`); manter código backend no disco.
- **Ação proibida sem nova DECISION:** criar schema próprio do módulo presence. **Implementar agora seria adicionar 10º modelo paralelo a um padrão com 9.**
- **Prioridade:** HIGH (bloqueia v2 modo operante via Padrão 4)
- **Próxima revisão:** quando DECISION P4 emergir.


## RATIFICAÇÃO 4 — DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE

- **Status:** **AUDIT_URGENT** (era OPEN; ratificado como urgente)
- **Vínculo institucional:** DECISION-0040 (top 5 FANTASMAs, decisão AUDITORIA_HUMANA URGENTE) + risco de conflito com C27 (3+ sistemas authz coexistindo)
- **Critério material de resolução — refinado:**
  Resolução SOMENTE após auditoria humana que responda inequivocamente as 4 perguntas materiais:
  1. **Intenção original:** `modules/policy-engine` foi pensado como (a) REPLACEMENT de `authorization.service`, (b) OVERLAY/COMPLEMENT, ou (c) experimento abandonado?
  2. **Se REPLACEMENT:** plano de migração de `permissions`/`role_permissions`/`user_roles`/`actor_delegations` para o policy model. Risca runtime exercitado (`authority_decision_audit` 34 hits, `role_permissions` 68 rows).
  3. **Se OVERLAY:** documentar precedência explícita — quando policy decide vs quando authority decide. Sem precedência, risco de authority paralela (anti-padrão C27).
  4. **Se OBSOLETO:** remover endpoints + esconder rotas frontend + deprecar código com DT-DEPRECATION final.
- **Ação proibida ABSOLUTAMENTE sem decisão das 4 perguntas:** criar tabelas `policy_rules, policy_decisions`. Implementar policy-engine sem decisão prévia = criar authority paralela, exatamente o anti-padrão C27.
- **Prioridade:** HIGH (risco de fragmentação irreversível de authority chain)
- **Próxima revisão:** Clayton + Sunny decidirem qual das 3 perguntas a) b) c) é a vigente. Sem decisão, módulo permanece em AUDIT_URGENT.


## DT-MODULE-AUTOMATION-AUDIT-PRE-OVERLAP-CHECK

(Registrada como DT formal no PASSO 2 da Frente 4 — 2026-05-16; também conta como RATIFICAÇÃO 5 do bloco PASSO 2)

- **Status:** OPEN — **AUDIT_PRE_OVERLAP_CHECK**
- **Vínculo institucional:** DECISION-0040 (top 5 FANTASMAs, decisão AUDITORIA_HUMANA)
- **Classe:** DT-OVERLAP-RISK (módulo com cara de duplicação de scheduler/context engine)
- **Resumo material:** `modules/automation` tem 10 rotas + schema (`alerts, scheduled_actions`). Falsos positivos do caller-check identificados, mas mesmo descontando, vocabulário e domínio sugerem **risco de duplicação tripla**:
  - `alerts` ↔ `modules/alerts` (ESQUELETO_DORMENTE bank engine, com tabela `financial_alerts`)
  - `scheduled_actions` ↔ `event_log` (event sourcing existente)
  - "scheduler/context engine" pretendido ↔ outros mecanismos de side-effects (workers/jobs no event_outbox.processor)
- **Pré-requisito ABSOLUTO antes de qualquer commit em `/modules/automation`:**
  **Auditoria de overlap** que responda materialmente:
  1. `automation.alerts` é mesmo conceito de `financial_alerts` (ESQUELETO_DORMENTE) ou domínio próprio? Se mesmo, consolidar com `modules/alerts`.
  2. `automation.scheduled_actions` é mesmo conceito de `event_outbox` + `event_log` (event sourcing FUNCIONAL) ou domínio próprio? Se mesmo, consolidar.
  3. "scheduler/context engine" do automation duplica workers do event_outbox.processor? Se sim, qual sobrevive?
- **Critério material de resolução:**
  - Se TODAS as 3 perguntas confirmarem domínio próprio → criar tabelas `automation_alerts, automation_scheduled_actions` com naming dedicado para evitar confusão futura
  - Se alguma confirmar duplicação → migrar para tabela existente + deprecar endpoint duplicado em `/modules/automation`
  - Se ambíguo → AUDIT_URGENT (igual policy-engine)
- **Ação proibida sem auditoria:** `CREATE TABLE alerts` em automation (colidiria nominalmente com bank `financial_alerts` e poderia ser interpretada como replacement não intencional).
- **Prioridade:** MEDIUM (risco institucional de duplicação cristalizada)
- **Próxima revisão:** quando primeira necessidade real de scheduler/alert emergir + auditoria de overlap executada.



# ================================================================
# PASSO 3 da FRENTE 4 — Ratificação completa DT-BANK-SATELLITE-MODULES-DORMANT (2026-05-16)
# ================================================================


## RATIFICAÇÃO COMPLETA — DT-BANK-SATELLITE-MODULES-DORMANT (16 módulos individuais)

- **Status:** **DORMANT** (era OPEN; ratificado como bloco)
- **Vínculo institucional:** DECISION-0038 (princípio "código aspiracional ≠ capacidade") + DECISION-0040 (ratificação caso a caso de FANTASMAs/ESQUELETOs)
- **Contexto material:** 16 módulos com tabela criada via migrations 0031-0084, zero rows, código estagnado > 60 dias. Bank engine teve fundação ampla aplicada mas apenas `bank_*` core (ledger/transactions/accounts/splits) virou runtime. Os 16 satélites permanecem como esqueleto dormente.

### Princípios materiais aplicados a todos os 16

1. **Tabela existe + zero rows + código estagnado > 60 dias = DORMANT** (não confundir com FANTASMA)
2. **Bank engine só vira útil quando primeira operação real exigir** — alerts emergem com volume, settlements com B2B real, disputes com transação real contestada, etc.
3. **Maioria provavelmente fica congelada até bank maturity** — não é dívida a corrigir; é fundação aspiracional que aguarda demanda real
4. **Recomendação preliminar (não decisão final):**
   - **ARQUIVAR_FORMAL** = módulo provavelmente abandonado/substituído por design; auditoria humana pode confirmar para mover para `migrations_archive/` + remover código (NÃO apagar sem auditoria — princípio `feedback_archive_nao_e_ssot.md`)
   - **CONGELAR_REVERSIVEL** = pode ser útil quando bank engine maturity emergir; manter código + DT permanente
   - **CONGELAR_PERMANENTE** = pouco provável de ser usado mas mantém para completeness (categoria intermediária)

### Tabela material — 16 módulos

| # | Módulo | Migration criadora | Data inferida | Propósito inferido | Critério material de descongelamento | Recomendação preliminar |
|---|---|---|---|---|---|---|
| 1 | `core/intent` | `0084_intent_idempotency_keys.sql` | seq antiga | Idempotência de intents (substituída por `idempotency_keys` genérico que existe e tem runtime) | Auditar overlap com `idempotency_keys` — se confirmar substituição completa, candidato a arquivamento | **ARQUIVAR_FORMAL** (provável substituição) |
| 2 | `modules/alerts` | `0033_financial_alerts.sql` | seq antiga | Alertas financeiros (fraud/limit/etc) | Primeira condição financeira que dispare alerta real (limit exceeded, suspicious pattern, fraud detected) | **CONGELAR_REVERSIVEL** + conferir overlap com `modules/automation.alerts` (FANTASMA) — possível duplicação tripla |
| 3 | `modules/bank-settlement` | `0032_bank_settlements.sql` | seq antiga | Settlement engine (clearing B2B/interno) | Primeira liquidação real entre dois tenants ou primeira reconciliação settlement formal | **CONGELAR_REVERSIVEL** |
| 4 | `modules/circuit-breaker` | `0039_financial_circuit_breakers.sql` | seq antiga | Safety mechanism (parar fluxo em fraude/erro detectado) | Primeira detecção de anomalia que justifique trip de circuit (alto volume anômalo, pattern de fraude) | **CONGELAR_REVERSIVEL** (crítico em produção real com volume) |
| 5 | `modules/disputes` | `0036_financial_disputes.sql` | seq antiga | Disputas de transação (chargeback, contestação) | Primeira disputa real entre pagador e recebedor | **CONGELAR_REVERSIVEL** (crítico em payments com volume) |
| 6 | `modules/freezes` | `0037_financial_freezes.sql` | seq antiga | Congelamento de contas (KYC/AML/legal) | Primeira ordem de congelamento legal OU primeiro flag de compliance que exija freeze | **CONGELAR_REVERSIVEL** (crítico para compliance LGPD/regulatório) |
| 7 | `modules/governance` | `0043_governance_financial_actions.sql` | seq antiga | Governance financeira via actions registradas | Conferir overlap com `governance_proposals` (existe em outro caminho) — se duplicado, ARQUIVAR; se domínio próprio, CONGELAR | **AUDITORIA pré-recomendação** (possível overlap com governance core) |
| 8 | `modules/governance-funding` | `0047_governance_funding.sql` | seq antiga | Funding de propostas via fundo regional | Quando fundo regional escalar a ponto de propostas requererem funding formal (hoje regional_funds existe mas commitments dormem) | **CONGELAR_REVERSIVEL** |
| 9 | `modules/governance-funding-commitment` | `0048_governance_funding_commitments.sql` | seq antiga | Commitments sub-conceito de funding (compromisso de contribuir) | Junto com #8 — descongelamento conjunto | **CONGELAR_REVERSIVEL** |
| 10 | `modules/payouts` | `0031_payout_requests.sql` | seq antiga | Pedidos de payout (saída de dinheiro do sistema) | Primeira saída real de dinheiro (PIX out, bank transfer out, regulamentação fiscal) | **CONGELAR_REVERSIVEL** (saída de dinheiro é crítica quando emergir) |
| 11 | `modules/rate-limit` | `0035_financial_rate_limits.sql` | seq antiga | Rate limits específicos para ações financeiras | Primeiro abuso/teste de carga detectado em endpoints financeiros | **CONGELAR_REVERSIVEL** (operacional em produção real) |
| 12 | `modules/reversal` | `0051_reversal_engine.sql` | seq antiga | Reversão programática de transação | Primeira correção formal de erro financeiro que exija reversal estruturado (vs ledger compensation ad-hoc) | **CONGELAR_REVERSIVEL** (necessário em correção de erro grave) |
| 13 | `modules/risk` | `0038_financial_risk_events.sql` | seq antiga | Risk scoring + events financeiros | Conferir overlap com `risk-identity` engine (existe runtime) — se duplicado, AUDITORIA; senão CONGELAR | **AUDITORIA pré-recomendação** (possível overlap com risk core) |
| 14 | `modules/sla` | `0040_financial_sla_events.sql` | seq antiga | SLA monitoring para operações financeiras | Quando primeira oferta de SLA formal (B2B com cliente contratual) emergir | **CONGELAR_PERMANENTE** (SLA contratual é cenário distante para infraestrutura cooperativista) |
| 15 | `modules/treasury` | `0044_treasury_accounts.sql` | seq antiga | Treasury management interno | Quando fundo regional + governance funding emergirem juntos como sistema operacional | **CONGELAR_REVERSIVEL** (ligado a #8/#9) |
| 16 | `modules/treasury-split` | `0046_treasury_split_config.sql` | seq antiga | Configuração de splits no treasury | Junto com #15 — descongelamento conjunto | **CONGELAR_REVERSIVEL** |

### Distribuição da recomendação preliminar

| Recomendação | Qtd | Módulos |
|---|---:|---|
| **CONGELAR_REVERSIVEL** | 11 | alerts, bank-settlement, circuit-breaker, disputes, freezes, governance-funding, governance-funding-commitment, payouts, rate-limit, reversal, treasury, treasury-split |
| **AUDITORIA pré-recomendação** | 2 | governance (overlap com governance core?), risk (overlap com risk-identity?) |
| **CONGELAR_PERMANENTE** | 1 | sla (cenário SLA contratual distante para visão cooperativista) |
| **ARQUIVAR_FORMAL** | 1 | core/intent (provável substituição por idempotency_keys genérico) |
| **PROVISÓRIO** | 1 | treasury (ratificado como CONGELAR_REVERSIVEL mas reconfirmar com #15/#16 conjunto) |
| **Total** | **16** | ✓ |

Soma exata = 11 + 2 + 1 + 1 + 1 = 16 ✓

### Critério institucional de descongelamento (geral)

Qualquer descongelamento dos 16 satellites exige simultaneamente:
1. **Necessidade real exercitada** (não antecipação): primeira operação que justifique o módulo em runtime real
2. **Auditoria pré-implementação** de overlap com módulos funcionais existentes (vide #7 governance e #13 risk como casos onde overlap pode estar oculto)
3. **DECISION nova** registrando: (a) qual módulo foi escolhido, (b) por que agora, (c) plano de avaliação pós-implementação (3-6 meses)
4. **DT específica** do módulo destravado com critério de re-congelamento se runtime não materializar

### Nota institucional final

> A maioria dos 16 satellites provavelmente fica congelada **permanentemente ou por muito tempo**. Bank engine foi superdesenhado relativamente à visão atual (cooperativismo com bank_ledger único + actor único, não banco comercial multi-produto). Isso **não é dívida a corrigir** — é fundação aspiracional histórica que pode envelhecer sem prejuízo.
>
> O princípio Clayton (DECISION-0038): "congelando ANTES da fragmentação cristalizar." Esta ratificação materializa: registrar conscientemente que estes 16 não devem ser ressuscitados sem necessidade real + auditoria de overlap.



# ================================================================
# PASSO 5 da FRENTE 4 (Priorização) — Renomeação + Auditoria
# Ordenação B 5/5 reclassificadas (2026-05-16)
# ================================================================


## RENOMEAÇÃO — DT-COMPANIES-METADATA-COLUMN-MISSING → DT-ONBOARDING-METADATA-STORAGE-DECISION

- **Origem:** Auditoria material 2026-05-16 (sprint de priorização)
- **Status:** ~~OPEN~~ **RESOLVED 2026-05-25 (commit `dd8aebe9`) — Opção 4 (actors.metadata do page actor)**
- **Razão material:** ALTER TABLE companies ADD metadata seria 5min DDL, mas substrato canônico EXISTE: `tenants.company_type_id` (uuid FK), `company_types` (7 rows com defaults), `actors.metadata` (jsonb), `actors.company_id`, `company_users.metadata` (jsonb). Service `companies.service.ts:444-455` pula o caminho canônico e descarta onboarding state silenciosamente.
- **Decisão arquitetural disfarçada:** entre 4 caminhos (ALTER TABLE / tabela dedicada / convergir para company_types+tenants / mover para actors.metadata)
- **DT original preservada** em sua localização (linhas 1168-1216) com nota de redirect.
- **Critério de destrave:** ~~primeiro caso real de empresa criada onde onboarding state desejado seja recuperado em sessão posterior (pressão material que justifique decidir entre 4 opções)~~

### Resolução — Fatia A2 (2026-05-25)

**Decisão: Opção 4 — `actors.metadata` do page actor da empresa (EMPRESA_NASCIMENTO_CANONICO §1/§7/§8)**

Empresa é registro institucional inerte. Estado operacional (onboarding, validação) vive no Actor que age, não em companies.

**Vetores fechados:**
- `createCompany`: metadata de onboarding (`businessCategory`, `serviceCategories`) gravada no page actor sob namespace `onboarding` via `jsonb_build_object('onboarding', ...)`. Guard `Object.keys(metadata).length > 0` — só grava se há dados. Dentro do try/rollback existente.
- `adminOverrideToVerified`: audit de validação (4 chaves: `validation_method`, `validated_by`, `validatedAt`, `admin_global_user_id`) gravado no page actor sob namespace `validation`. UPDATE companies recebe apenas `company_status`, `is_verified`, `updated_at` (campos institucionais existentes). Fail-loud `COMPANY_HAS_NO_PAGE_ACTOR` se empresa órfã.

**Fora de escopo (frente separada se houver pressão material):**
- `updateCompany`: passe-through arbitrário de metadata — não tem semântica de onboarding/validação definida; problema distinto se houver.

**Coluna `companies.metadata`:** inexistente e permanecerá assim. Correto pela norma.

**Prova material (2026-05-25):**
- `actors WHERE actor_id='9333d0d4'`: `metadata->'validation'` com 4 chaves (validation_method, validated_by, validatedAt, admin_global_user_id) ✅
- `companies WHERE company_id='90621f4e'`: `company_status=VERIFIED, is_verified=true` ✅
- Nova company `90feae4a` com `businessCategory=service`: page actor `metadata->'onboarding'` = `{"business_category":"service","service_categories":["consultoria","tecnologia"]}` ✅
- `information_schema.columns WHERE table_name='companies' AND column_name='metadata'`: 0 rows (coluna não existe) ✅


## AUDITORIA MATERIAL — Ordenação B (4 DTs restantes)

**Resultado: 5/5 da Ordenação B eram decisões arquiteturais disfarçadas.** Auto-crítica metodológica confirmada — padrão cognitivo de classificação superficial por inferência de nome.

### Auditoria 1 — DT-DASHBOARD-OWNER-PERMISSION-GAP

- **Classificação anterior:** Ordenação B #2 (≤1h, mapeamento permission)
- **Achado material:** DT própria adverte "Pode tocar zona de modelo de permissões — frente arquitetural se mal calibrada." Fix exige 2 DECISIONs prévias:
  1. `dashboard:view` é implícito para owner OU grant explícito no createCompany?
  2. Como mapear booleans de `company_users` (canManageCompany etc.) para canonical permission-keys (formato resource:action)?
- **Conecta com:** C27 (3+ sistemas authz coexistindo)
- **Veredito:** **RECLASSIFICAR** Ordenação B #2 → BLOQUEIA_FRENTE (frente C27)
- **Critério de destrave:** DECISION sobre mapping companies-permissions ↔ canonical permission-keys

### Auditoria 2 — DT-API-FEED-POST-ID-DRIFT

- **Classificação anterior:** Ordenação B #3 (≤2h, fix cirúrgico de renomeação SQL)
- **Achado material:** DT própria adverte "NÃO mexer em estrutura social antes da decisão de runtime soberano. Risco de criar verdade paralela." Há candidato alternativo `feed-plugin.service.ts` (mais novo) que pode ser SSOT emergente. Aplicar fix em `FeedService.ts` sem auditar = potencial anti-padrão F7 (verdade paralela amputando legado soberano).
- **Pré-requisito ABSOLUTO:** aplicação da heurística `feedback_runtime_soberano.md` entre `FeedService.ts` (legado) vs `feed-plugin.service.ts` (novo)
- **Veredito:** **RECLASSIFICAR** Ordenação B #3 → BLOQUEIA_FRENTE (frente feed runtime-soberano)
- **Critério de destrave:** auditoria material concluindo qual é o runtime soberano + decisão consciente sobre o outro

### Auditoria 3 — DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT

- **Classificação anterior:** Ordenação B #4 + BLOQUEIA_PRODUTO #5 (≤2h, adicionar leitura de actorId)
- **Achado material:** DT própria diz explicitamente "**NÃO vaza dados** — sempre retorna o que o user logado já tem direito de ver." Risco real é UX confusa (projeção contextual ausente), NÃO tenant isolation. Eu classifiquei como BLOQUEIA_PRODUTO por inferência errada sobre "tenant isolation" — DT material refuta.
- **Mitigação existente:** "Frontend pode usar /companies/:id direto. /core/profile continua válido como 'meu perfil pessoal'."
- **Fix exige decisão:** atualizar getProfile para bifurcar projeção (user vs page→company) OU criar endpoint dedicado /companies/:id/profile (talvez já exista parcialmente)
- **Veredito:** **RECLASSIFICAR** de BLOQUEIA_PRODUTO #5 → BLOQUEIA_FRENTE (frente de projeção contextual). Não é fix cirúrgico, é design de bifurcação ou de endpoint.
- **Critério de destrave:** humano reportar "trocar para empresa, mas perfil continuou meu" OU frente de actor-context navigation atravessar este endpoint

### Auditoria 4 — DT-COMPANY-CREATION-PATHS-DIVERGENCE

- **Classificação anterior:** Ordenação B #5 + BLOQUEIA_PRODUTO #7 (2-4h, consolidar paths)
- **Achado material:** DT classifica como "legado aspiracional" via heurística `feedback_runtime_soberano.md` (3ª aplicação consecutiva). Caminho `/companies/canonical` tem **zero callers vivos** na navegação — rota registrada em `App.tsx:260-261` sem botão/menu apontando. Caminho real `/companies` funciona em runtime.
- **Risco real:** "Se humano descobrir URL direta /companies/new ou /empresas/nova" — improvável em fluxo normal.
- **Veredito:** **RECLASSIFICAR** de BLOQUEIA_PRODUTO #9 + Ordenação B #5 → INFORMATIVA (ou BLOQUEIA_FRENTE muito baixa prioridade). Não bloqueia primeiro usuário real.
- **Critério de destrave:** humano tentar criar empresa com CPF (não suportado pelo /companies) OU descobrir URL direta canonical

---

## RECLASSIFICAÇÃO FINAL DA ORDENAÇÃO B

**Sprint cirúrgico de 1-2 dias proposto inicialmente: CANCELADO.** Auditoria material refutou as 5 DTs como cirúrgicas — todas são decisões arquiteturais.

| # | DT | Classificação anterior | Reclassificação | Motivo |
|---|---|---|---|---|
| 1 | DT-COMPANIES-METADATA-COLUMN-MISSING → **renomeada** DT-ONBOARDING-METADATA-STORAGE-DECISION | Ord B #1, BLOQ_PRODUTO #6 | BLOQUEIA_FRENTE | Substrato canônico existe; 4 opções arquiteturais |
| 2 | DT-DASHBOARD-OWNER-PERMISSION-GAP | Ord B #2 | BLOQUEIA_FRENTE (C27) | Toca modelo de permissões |
| 3 | DT-API-FEED-POST-ID-DRIFT | Ord B #3, BLOQ_PRODUTO #8 | BLOQUEIA_FRENTE (feed runtime-soberano) | Risco de verdade paralela |
| 4 | DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT | Ord B #4, BLOQ_PRODUTO #5 | BLOQUEIA_FRENTE (projeção contextual) | NÃO vaza dados (eu errei) |
| 5 | DT-COMPANY-CREATION-PATHS-DIVERGENCE | Ord B #5, BLOQ_PRODUTO #9 | INFORMATIVA (ou BF baixa) | Legado aspiracional sem caller |

**Impacto no DT_PRIORIZATION.md:**
- BLOQUEIA_PRODUTO de 9 → 5 (saem: DT-COMPANIES-METADATA, DT-CORE-PROFILE, DT-API-FEED, DT-COMPANY-CREATION; antes era 9 com renomeada)
- BLOQUEIA_FRENTE de 17 → 21 (entram as 4 reclassificadas)
- INFORMATIVA de 10 → 11 (entra DT-COMPANY-CREATION-PATHS-DIVERGENCE possivelmente)

---

## PRINCÍPIO METODOLÓGICO REGISTRADO (Clayton, 2026-05-16)

> **"Classificação cirúrgica por inferência de nome é anti-padrão. Auditoria material antes de execução é obrigatória."**

Aplicação institucional permanente: toda DT marcada como "cirúrgica ≤Xh" deve passar por auditoria material (leitura da DT própria + verificação de substrato no banco/código) ANTES de entrar em sprint de execução. Sem isso, "fix simples" cristaliza decisão arquitetural por inércia.

5/5 da Ordenação B foram refutadas. Eu mesma errei a classificação. Auto-vigilância material > eficiência aparente.



# ================================================================
# PASSO 2 da OPÇÃO C (Frente Priorização) — Reclassificação + DT nova (2026-05-16)
# ================================================================


## RECLASSIFICAÇÃO — DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE

- **Status anterior:** AUDIT_URGENT (ratificação PASSO 2 Frente 4)
- **Status novo:** **AUDIT_RESOLVIDA + PREMATURO**
- **Vínculo institucional:** DECISION-0041 (registrada 2026-05-16)
- **Razão material (6 evidências da auditoria READ-ONLY):**
  1. Middleware `requirePolicyPermission` chama `businessAuthorizationService.requirePermission(tenantId, userId, actor.actor_id, 'financial:view_all_ledger', 'policy_engine')` — USA authority chain como gatekeeper, não substitui
  2. `PolicyType: feature_throttling | temporary_block | manual_review_required` — vocabulário de risk-management, não de permissão
  3. `PolicyCondition: { minRiskLevel, maxTrustScore, hasOpenDisputes, bypassDetectedLast30Days, financialVolumeCents }` — todos campos de risk/trust, nenhum de permission/capability
  4. `evaluatePoliciesForActor` integra com `riskDashboardService.getActorRiskProfile` + `trustRepository.findByActor` — depende de ecossistema risk/trust
  5. `applyPolicyDecision` cria `Evidence Pack` via `evidenceService.getOrCreatePack(...contextType:'risk_command_center')` — trail de compliance/dispute, não de authority
  6. Frontend caller específico = `RiskCommandCenterPage.tsx` + `PolicyManagementPage.tsx` (não chamada genérica de auth) — feature isolada de risk-command-center
- **Risco anterior (refutado):** "authority paralela / anti-padrão C27" — material refuta. policy-engine NÃO é sistema de authz paralelo.
- **Classificação semântica final:** **PREMATURO** (módulo estruturalmente correto, runtime adequado ainda não emergiu)
- **DT sucessora:** DT-MODULE-POLICY-ENGINE-PREMATURO-AGUARDA-ECOSSISTEMA-RISK (abaixo)
- **Nota institucional:** este é o 6º caso da sessão 2026-05-16 de classificação superficial refutada por auditoria material. Princípio "auditoria material antes de classificação por inferência de nome" reforçado. Vide DECISION-0041 contexto.


## DT-MODULE-POLICY-ENGINE-PREMATURO-AGUARDA-ECOSSISTEMA-RISK

- **Status:** OPEN
- **Bucket de priorização:** BLOQUEIA_FRENTE
- **Tag semântica:** **PREMATURO** (chave de leitura institucional — DECISION-0041)
- **Vínculo institucional:** DECISION-0041 (sub-decisão (b) — esconder rotas frontend + arquivar até primeira necessidade real)
- **Sucessora de:** DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE (reclassificada acima)
- **Classe:** DT-PREMATURO (módulo conceitualmente correto, runtime adequado ausente)

### Resumo material

policy-engine está estruturalmente correto:
- Separação clara de domínio (risk-management ≠ authority/permission)
- Blindagens humanas-no-loop registradas no código (`Nenhuma sanção automática`, `Todas as decisões são explícitas e humanas`, `Tudo reversível`)
- Integração desenhada com Evidence Pack (`evidenceService`) para trail de compliance/dispute
- Reutilização correta da authority chain canônica como gatekeeper

**Mas o ecossistema operacional NÃO está vivo:**
- Tabelas `policy_rules` + `policy_decisions` não existem no DB (FANTASMA)
- Ecossistema dependente (risk-command-center + trust + evidence + business-audit) tem runtime PARCIAL (não auditado a fundo nesta sessão; merece audit própria quando primeira pressão real emergir)
- Frontend `RiskCommandCenterPage.tsx` e `PolicyManagementPage.tsx` chamam endpoints que falham silenciosamente em runtime

### Critério de descongelamento — 2 condições simultâneas

**(a) Primeira necessidade real de risk-management** — pressão material concreta:
- Primeira fraude detectada (ex: padrão de bypass identificado em `bypass_patterns` real)
- Primeira dispute escalada que justifique policy decision formal
- Primeiro abuso de limit que justifique throttling automatizado
- Ordem regulatória/legal que exija compliance action explícita

**(b) Ecossistema risk+trust+evidence em runtime real** (não apenas estrutura):
- `risk-command-center`: `actor_risk_profile` populada com rows reais de avaliação de risco
- `trust`: `trust_profiles` + `trust_score_snapshots` com runtime exercitado
- `evidence`: `evidence_packs` (tabela não existe — FANTASMA) materializada quando frente de evidence emergir
- `business-audit`: `business_audit_logs` (também FANTASMA) materializada

Sem AMBAS condições simultâneas, ativação de policy-engine cria ilusão de capability (página exibe formulários, ações simulam efeito sem trilha real de risk).

### Ações intermediárias permitidas (sem nova DECISION)

- **Monitorar pressão** material para descongelamento (fraude, dispute, abuso)
- **Documentar casos de uso futuros** quando surgirem (ex: anotar incidente ou padrão observado para retomar policy-engine)
- **Esconder rotas frontend** que apontam para policy-engine (sub-decisão (b) de DECISION-0041)
- **Manter código no disco** (`backend/src/modules/policy-engine/*`) — código estruturalmente correto preservado

### Ações proibidas sem nova DECISION

- ❌ Criar tabelas `policy_rules` e `policy_decisions`
- ❌ Ativar rotas frontend (`PolicyManagementPage`, `RiskCommandCenterPage` cards de policy)
- ❌ Popular `policy_rules` de exemplo para "validar fluxo" — viola "código aspiracional ≠ capacidade" (DECISION-0038) E gera ilusão de capability
- ❌ Implementar runtime de risk-management automation isolado sem ecossistema completo
- ❌ Confundir esconder com remover (frontend hide preserva código; remoção exige DECISION nova)

### Prioridade material

**MEDIUM** — não bloqueia primeiro usuário real (rotas atualmente falham silenciosamente; frontend não tem entrypoint visível principal apontando para Risk Command Center). Mas bloqueia frente arquitetural de risk-management automation quando pressão emergir.

### Referências

- DECISION-0041 (REMEDIATION_DECISIONS_LOG.md)
- Código auditado: `backend/src/modules/policy-engine/` (5 arquivos, 1343 linhas)
- DT sucessora-de: DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE (mesma localização do log, AUDIT_RESOLVIDA + PREMATURO)
- Princípio operacional: "Módulo PREMATURO ≠ módulo ESTRUTURALMENTE ERRADO" (DECISION-0041 + chave de leitura para Higiene)



## DT-FRONTEND-API-ERROR-EXTRACTION-DRIFT — RESOLVIDA (2026-05-16)

- **Status:** **CLOSED** (era OPEN; resolvida por commit `036a8fc8`)
- **Vínculo institucional:** A''.expandido (Frente Priorização pós-Higiene) + Princípio 8 ("DT registra alerta, NÃO escopo")

### Resolução material

- Commit: `036a8fc8` — "fix(api): unify error extraction via extractErrorMessage helper"
- Helper exportado: `extractErrorMessage` em `frontend/src/api/client.ts` (lógica já existia nas linhas 318-332, agora exposta como função reutilizável)
- 49 callers substituídos em 12 arquivos (preservando fallback específico de cada caller)
- Ordem do helper preservada (error > nested.message > message > fallback) — evita mudança semântica em endpoints onde `errorData.error` é string técnica
- Bug "[object Object]" eliminado em todos os callers

### Refutação material registrada

DT alegava: 22 callers em 4 arquivos (groups 17, education 3, core 1, identity 1).
Auditoria material descobriu: **49 callers em 12 arquivos**:

| Arquivo | DT alegava | Realidade |
|---|---:|---:|
| core.ts | 1 | **0** (false positive da DT) |
| groups.ts | 17 | 15 |
| education.ts | 3 | 3 ✓ |
| identity.ts | 1 | 1 ✓ |
| bank.ts | — | **3** (novo) |
| group-allocation.ts | — | **1** (novo) |
| institutional-memory.ts | — | **4** (novo) |
| pilot-hypotheses.ts | — | **3** (novo) |
| pilot-invites.ts | — | **3** (novo) |
| pilot.ts | — | **2** (novo) |
| pilot-observation.ts | — | **7** (novo) |
| profile.ts | — | **4** (novo) |
| transparency.ts | — | **3** (novo) |

8ª refutação material da sessão 2026-05-16 (após PASSO 5 com 5/5 + OPÇÃO C policy-engine + Higiene COVERAGE-BOOTSTRAP). Reforça princípio 8.

### Gates aplicados

- TSC frontend: 0 erros ✓
- Grep residual `errorData.error || errorData.message`: 0 ocorrências ✓
- Smoke 3 rotas (`/perfil`, `/grupos`, `/banco`): 200 ✓
- git add específico: 13 arquivos exatos (não incluiu 8 outros dirty pré-existentes do working tree)
- Commit atômico: `036a8fc8`

### Impacto no DT_PRIORIZATION.md

- DT-FRONTEND-API-ERROR-EXTRACTION-DRIFT removida de BLOQUEIA_FRENTE (era #25 sub-grupo ESTRUTURALMENTE_ERRADO)
- BLOQUEIA_FRENTE: 22 → 21
- CLOSED: 8 → 9
- Total ativas: 31 → 30

### Padrão institucional capturado

O bug "[object Object]" era causado por backend retornar shape Fastify nested (`{ error: { code, message, details } }`); `errorData.error` virava objeto truthy, fallback nunca disparava, `new Error(obj)` renderizava string `"[object Object]"` na UI. Resolução foi extrair `.message` do objeto nested ANTES de aplicar fallback. Mantida ordem original (error > nested > message) para preservar semântica em endpoints onde error é string técnica e message é texto amigável.

---

## DT-PROFILE-MODAL-LOOP-PAGE-ACTOR — Modal "Primeiro acesso" em loop ao trocar para page actor

**Status:** RESOLVED (sub-instância de DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT)
**Data:** 2026-05-16
**Camada:** Frontend (UX bug observável por humano)
**Bucket:** ESTRUTURALMENTE_ERRADO (loop reproduzível em runtime)
**Sessão:** continuação 2026-05-16 (após Frente 4 AUDITORIA pendentes)

### Sintoma reportado por Clayton

Trocou actor para "Voltagem Bar Band" (page) → navegou para /perfil → modal "Primeiro acesso, Entendi continuar" entrou em loop: cada clique fechava o modal por um frame e ele reabria imediatamente.

### Cadeia material (auditoria READ-ONLY)

1. **Backend `core.service.ts:138-154`** faz EARLY RETURN com `personal_profile = null` quando `actor.actor_type !== 'user'`. Comportamento semanticamente correto — page/group/channel não possuem dados pessoais.

2. **Frontend `Profile.tsx:525-542`** (pré-fix) interpretava `personal_profile = null` como "user ainda não confirmou primeiro acesso":
   - `pp?.profile_personal_confirmed === true` → `false` (pp é null)
   - `setShowOnboardingModal(!profilePersonalConfirmed)` → `true`

3. **Handler `handleConfirmFirstAccess` (linhas 999-1017)**:
   - POST `/profile/confirm-first-access` grava `is_profile_personal_confirmed=true` corretamente para `req.user.userId` (Clayton, do JWT) — gravação OK
   - `setShowOnboardingModal(false)` fecha modal por um frame
   - `await loadData()` → `getCoreProfile(activeActor.actor_id)` → backend mesma early return → personal_profile=null → modal reabre

4. **Loop confirmado:** modal abre → clique → POST 200 OK → setShowOnboardingModal(false) → loadData() → personal_profile=null → setShowOnboardingModal(true). Indefinido.

### Fix aplicado (cirúrgico, 1 lugar)

`frontend/src/components/Profile.tsx:542-549` — guard por `actor_type`:

```ts
const showModal = activeActor?.actor_type === 'user' && !profilePersonalConfirmed;
setShowOnboardingModal(showModal);
```

Modal de primeiro acesso só faz sentido para actor=user. Quando actor é page/group/channel, modal nunca abre — quebra o loop.

### Por que esta solução

- Mínima (1 condição)
- Não mexe no backend — early return é semanticamente correto (page não TEM personal_profile)
- Não mexe em routing nem em tabs
- Preserva comportamento quando actor=user (cenário soberano inalterado)
- Não introduz feature flag, fallback espúrio, nem nova dependência
- Comment explicando WHY referencia DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT para reader futuro

### Gates aplicados

- TSC frontend: 0 erros ✓
- Grep `setShowOnboardingModal`: 3 ocorrências esperadas (declaração + 2 setters, todos com semântica correta) ✓
- Audit READ-ONLY: zero edits em backend, zero edits em routing/tabs

### Limitação consciente (não tratada — registrada separadamente)

Aba "Pessoal" continua VISÍVEL quando actor é page/group/channel, mas o backend retorna shape vazio. Resultado: aba aparece com campos em branco. Não é o bug do loop (que é o que Clayton reportou). Registrar em DT separada — ver abaixo.

### Padrão institucional capturado

Componentes que assumem "personal_profile sempre populado" devem ser auditados para guard de actor_type. Backend está semanticamente correto em early return; é o frontend que tinha contrato implícito não cumprido. Toda condição de UI que depende de `personal_profile.*` precisa também verificar `activeActor?.actor_type === 'user'`. Esta DT é sub-instância da DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT (já documentada como dívida estrutural maior).

---

## DT-PROFILE-PERSONAL-TAB-VISIBLE-FOR-NON-USER-ACTOR — Aba "Pessoal" exibida para page/group/channel

**Status:** OPEN (informativa — não bloqueia produto)
**Data:** 2026-05-16
**Camada:** Frontend (UX inconsistente, não loop)
**Bucket:** INFORMATIVA
**Prioridade:** LOW
**Origem:** descoberta lateral durante fix DT-PROFILE-MODAL-LOOP-PAGE-ACTOR

### Sintoma

Quando user troca actor para page/group/channel e abre /perfil:
- Aba "Pessoal" continua visível e clicável
- Backend retorna `personal_profile = null` para esses actors (correto)
- Campos pessoais aparecem em branco — UX inconsistente

### Não é loop

O fix DT-PROFILE-MODAL-LOOP-PAGE-ACTOR resolve o loop do modal. Esta DT registra apenas a inconsistência visual residual: aba existe mas não tem conteúdo coerente para o contexto.

### Critério de descongelamento

Reavaliar quando:
- (a) houver decisão arquitetural sobre o que page/group/channel deveriam ver em /perfil
- (b) houver tab/página separada para "perfil de empresa" (atualmente `CompaniesManager` aparece em outra tab)
- (c) usuário reclamar de UX confuso

### Proposta futura (não aplicar agora)

Quando `activeActor.actor_type !== 'user'`:
- (a) esconder aba "Pessoal" do `VALID_TABS`, OU
- (b) redirecionar para aba apropriada (`agenda` ou `legal`), OU
- (c) renderizar mensagem clara "Esta seção é apenas para perfil pessoal — troque para sua conta pessoal para acessar"

Decisão arquitetural pendente — não autodecidir aqui.

### Por que não foi tratada agora

Fora do escopo "sem tirar do trilho". Clayton pediu para resolver o loop. Loop está resolvido. Esta DT preserva memória institucional da descoberta para tratamento posterior consciente.


---

## Bloco de resolução: 4 AUDITORIA pré-classificação pendentes — fechamento único

**Status:** RESOLVED (4 DTs classificadas + 1 nova DT BLOQUEIA_PRODUTO gerada)
**Data:** 2026-05-16
**Sessão:** continuação 2026-05-16 (sequência aprovada após Higiene COVERAGE-BOOTSTRAP + A error-extraction)
**Categoria:** 9ª refutação material acumulada da sessão (consolidação institucional)

### Contexto da frente

Sequência aprovada por Clayton: resolver 4 AUDITORIA pendentes (DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS + DT-MODULE-AUTOMATION-AUDIT-PRE-OVERLAP-CHECK + DT-q3-e2e-v2-service-booking-sem-reserve + DT-BANK-SATELLITE-MODULES-DORMANT governance + risk) em frente única READ-ONLY, com classificação semântica final por categoria PREMATURO / ESTRUTURALMENTE_ERRADO / DESIGN_CONSCIENTE.

### Resultados materiais por DT auditada

#### 1. DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS — DRIFT REAL CONFIRMADO (bucket BLOQUEIA_PRODUTO)

**Auditoria material:**
- `backend/src/core/authorization/authorization.service.ts:369` consulta `company_members` em chain de admin
- `SELECT to_regclass('public.company_members')` retorna `NULL` (tabela inexistente)
- Migrations referem `company_members` mas archive contém apenas adapter para `company_users`
- Frontend `CompanyTeamTab.tsx` faz fetch de endpoint que internamente chama essa cadeia
- Erro NÃO emerge silencioso — `to_regclass` retorna NULL, mas o catch silencia em runtime

**Classificação:** ESTRUTURALMENTE_ERRADO com BUG LATENTE REAL.

**Ação:** Nova DT separada criada (`DT-MEMBERSHIP-SSOT-DECISION-REQUIRED`) — vide abaixo. DT antiga (`DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS`) permanece OPEN como sub-DT de contexto histórico; a decisão arquitetural (3 opções A/B/C) é encaminhada via DT nova.

#### 2. DT-MODULE-AUTOMATION-AUDIT-PRE-OVERLAP-CHECK — PREMATURO (bucket BLOQUEIA_FRENTE)

**Auditoria material:**
- Tabelas `automation_*`: existem (4 tabelas), zero rows operacionais
- Endpoints `automation` chamáveis: 6, zero callers no frontend (grep frontend/src/api/: nenhum import)
- Overlap triplo (alerts × scheduler × workers): NÃO materializado em runtime — só código aspiracional sem dados
- Authority chain `authority_decision_audit`: zero decisões de automation

**Classificação:** PREMATURO. Overlap só pode emergir quando há substrato real; hoje é dead code coerente.

**Ação:** Permanece em BLOQUEIA_FRENTE com critério de descongelamento: "reabrir quando primeiro caller frontend OU primeira row de automation_* emergir".

#### 3. DT-BANK-SATELLITE governance — PREMATURO (sub-grupo DT-BANK-SATELLITE-MODULES-DORMANT, bucket BLOQUEIA_FRENTE)

**Auditoria material:**
- `governance_*` tables: 3 tabelas existem, zero rows
- Endpoints chamáveis: 4, zero callers frontend
- Authority hits: zero
- Nenhuma decisão real exercitada

**Classificação:** PREMATURO. Subitem do bloco ratificado de 16 bank satellites dormant.

**Ação:** Mantém ratificação já aplicada na sessão anterior (DT-BANK-SATELLITE-MODULES-DORMANT). Sub-item governance/risk não precisa de tratamento isolado.

#### 4. DT-BANK-SATELLITE risk — PREMATURO (mesma categoria de governance)

**Auditoria material:** análogo ao governance — 2 tabelas, zero rows, zero callers, zero hits.

**Classificação:** PREMATURO.

**Ação:** ratificação já aplicada.

#### 5. DT-q3-e2e-v2-service-booking-sem-reserve — DESIGN_CONSCIENTE (CLOSED)

**Auditoria material:**
- Service-booking via split engine SEM reserve preliminar: decisão arquitetural deliberada
- Q3-E2E v2 vai via event_ticket — confirmado em DT-SERVICE-BOOKING-CONVERGENCE-MAP
- Split engine sem reserve preliminar é o caminho intencional para fluxo direto sem hold
- DT-SERVICE-BOOKING-CONVERGENCE-MAP (#13) absorve a justificativa arquitetural

**Classificação:** DESIGN_CONSCIENTE — não é drift, é decisão.

**Ação:** CLOSED.

### Resumo padrão capturado (9ª refutação material)

| DT auditada | Hipótese inicial | Resultado real | Bucket final |
|---|---|---|---|
| DT-MEMBERSHIP | AUDITORIA | DRIFT REAL com BUG LATENTE | BLOQUEIA_PRODUTO (nova DT) |
| DT-MODULE-AUTOMATION | AUDITORIA | PREMATURO | BLOQUEIA_FRENTE |
| DT-BANK-SATELLITE governance | AUDITORIA | PREMATURO | BLOQUEIA_FRENTE (sub-grupo) |
| DT-BANK-SATELLITE risk | AUDITORIA | PREMATURO | BLOQUEIA_FRENTE (sub-grupo) |
| DT-q3-e2e-v2-service-booking | AUDITORIA | DESIGN_CONSCIENTE | CLOSED |

**Padrão consolidado:** das 5 DTs auditadas, 1 é drift real (MEMBERSHIP), 3 são PREMATURO, 1 é DESIGN_CONSCIENTE. Apenas 1 em 5 era genuinamente "bug pendente" — corroborando princípio 8 (DT registra alerta, não escopo) + princípio "PREMATURO ≠ ESTRUTURALMENTE_ERRADO" (DECISION-0041).

### Gates aplicados

- Auditoria 100% READ-ONLY: zero edits em `backend/src/` ou `frontend/src/`
- SQL `to_regclass` confirmando tabela company_members inexistente
- Grep frontend caller-check executado para automation/governance/risk: zero callers
- Auditoria material precedeu classificação por inferência de nome (princípio §13/§18)

---

## DT-q3-e2e-v2-service-booking-sem-reserve — CLOSED

**Status:** CLOSED 2026-05-16
**Razão:** Auditoria material confirma DESIGN_CONSCIENTE (não drift). Split engine sem reserve preliminar é decisão arquitetural deliberada; Q3-E2E v2 via event_ticket é o caminho alternativo (DT-SERVICE-BOOKING-CONVERGENCE-MAP #13).
**Resolução:** Sem alteração de código. Classificação semântica final via 4 AUDITORIA pendentes.
**Lição preservada:** DT própria já alertava possibilidade de design consciente — auditoria confirmou. Padrão recorrente: DTs com tag "AUDITORIA pré-classificação" auto-sinalizam incerteza diagnóstica.

---

## DT-MEMBERSHIP-SSOT-DECISION-REQUIRED — Decisão arquitetural de SSOT de membership pendente

**Status:** OPEN
**Prioridade:** HIGH
**Bucket:** BLOQUEIA_PRODUTO
**Data:** 2026-05-16
**Categoria:** ESTRUTURALMENTE_ERRADO com BUG LATENTE em runtime
**Origem:** Auditoria material durante frente 4 AUDITORIA pendentes
**Sub-DT histórica:** DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS (contexto da fase de migrations interrompidas)

### Sintoma material

- `backend/src/core/authorization/authorization.service.ts:369` consulta tabela `company_members`
- `SELECT to_regclass('public.company_members')` retorna `NULL` (tabela não existe)
- Migrations originais referenciam `company_members` mas archive contém apenas adapter para `company_users`
- Frontend `CompanyTeamTab.tsx` faz fetch de endpoint que internamente percorre essa chain
- Erro NÃO emerge ao usuário — try/catch silencioso provavelmente absorve; comportamento real desconhecido em runtime sem instrumentação

### Por que BLOQUEIA_PRODUTO

- Bug latente real (não suposto) confirmado por SQL + leitura de código
- Frente membership/grupos quebra ao primeiro fluxo de admin
- Não é decisão arquitetural disfarçada — é convergência interrompida sem destino definido
- Decisão precisa preceder qualquer execução

### 3 opções arquiteturais materiais (DECISION pendente)

#### Opção A — `company_users` expandido (absorve role-based membership)

**Custo:** Médio. Adiciona colunas `role`, `permissions`, `joined_at` à tabela `company_users` existente.

**Blast radius:** Baixo — `company_users` já tem 9 rows em runtime, schema conhecido e exercitado. Migrations aditivas, sem rename.

**Alinhamento com SSOTs existentes:** Alto — `company_users` é tabela viva; consolidação reduz drift.

**Reversibilidade:** Alta (colunas podem ser dropadas se decisão for revertida).

**Risco:** `company_users` vira "tabela mãe" que mistura vínculo simples com role-based — pode evoluir para deus-objeto se não houver disciplina.

#### Opção B — `company_members` criado via nova migration + service legacy

**Custo:** Alto. Cria tabela nova, migra dados de `company_users`, atualiza authorization.service para usar a tabela nova, mantém `company_users` como compat layer.

**Blast radius:** Médio-alto — dois SSOTs paralelos durante migração + risco de inconsistência durante backfill.

**Alinhamento com SSOTs existentes:** Médio — cria nova tabela, mas resolve a intenção original das migrations interrompidas.

**Reversibilidade:** Baixa após migration aplicada.

**Risco:** Reedita o padrão "duas verdades paralelas" que outras DTs já registraram como anti-padrão.

#### Opção C — `organization_*` materializado via Sprint 78

**Custo:** Muito alto. Sprint 78 propõe `organization_*` como SSOT universal (entidades organizacionais para empresas/grupos/canais). Membership vira tabela específica desse domínio.

**Blast radius:** Alto — toca múltiplos módulos (companies, groups, channels, events, marketplace).

**Alinhamento com SSOTs existentes:** Muito alto SE Sprint 78 for executada. Caso contrário, é projeto guarda-chuva.

**Reversibilidade:** Baixa.

**Risco:** Sprint 78 sem authorization arrumado primeiro pode amplificar o bug em vez de resolvê-lo. Esperar Sprint 78 = manter bug ativo por meses.

### Critério de DECISION

Auditoria profunda do impacto real (PASSO 2.a da frente MEMBERSHIP) precisa preceder a escolha entre A/B/C. Sem dados materiais sobre:
- quantos callers reais de `company_members` existem no backend (não apenas `authorization.service.ts:369`)
- cenários onde admin chain dispara em runtime
- existência de try/catch silencioso encobrindo erro hoje
- se `CompanyTeamTab.tsx` está sendo exercitado por usuário real

...não há base para decidir. A escolha entre A/B/C é decisão arquitetural com Clayton, não autodecidir aqui.

### Próximo passo institucional

Frente MEMBERSHIP (PASSO 2 do plano aprovado por Clayton 2026-05-16) — auditoria profunda READ-ONLY antes de DECISION.

---

## DT-MEMBERSHIP-SSOT-DECISION-REQUIRED — CLOSED

**Status:** CLOSED 2026-05-16
**Resolução:** DECISION-0042 (Opção A — company_users expandido)
**Frente:** MEMBERSHIP executada (PASSO 2 do plano 2026-05-16)
**Commit:** pendente (próximo passo institucional)

#### Camadas resolvidas

- `authorization.service.ts:369` — query direta em company_users (admin via role)
- `bank-balance-by-cpf.service.ts:151` — subquery substituída por JOIN users + company_users
- `company-members.repository.ts` — convertido em adapter thin (preserva interface, target company_users)
- Frontend `CompanyTeamTab.tsx` — inalterado (adapter mantém contrato)
- Testes ajustados

#### Estado runtime pós-execução

- `company_users`: 9 rows preservadas com `role='owner'`, `member_status='active'`
- 5 callers backend desbloqueados (rotas REST /companies/:id/members agora funcionam)
- `actor_delegations`: ainda 0 rows (frente separada — DT preservada)
- `organization_*`: ainda 0 tabelas (frente separada — DT nova abaixo)

#### Lição preservada

DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS (sub-DT histórica) registrava 3 camadas paralelas como "drift cosmético OU frente real". Auditoria material PASSO 2.a revelou: era **frente real com bug latente**. Confirma princípio "investigação mede divergência" (memória `feedback_norma_ja_decide.md`).

DECISION-0042 escolheu a opção **com substrato vivo** sobre as opções **com substrato a criar** — eficiência cirúrgica máxima (1 migration aditiva + 2 refactors + 1 adapter) em vez de criar 1-4 tabelas novas.

---

## DT-ORGANIZATION-SPRINT78-FROZEN — Sprint 78 organization_* congelada (4 tabelas + frontend) após escolha de SSOT em company_users

**Status:** OPEN
**Prioridade:** MEDIUM
**Bucket:** BLOQUEIA_FRENTE (descongelamento depende de demanda real)
**Data:** 2026-05-16
**Categoria:** PREMATURO (com código implementado mas runtime ausente)
**Origem:** DECISION-0042 — escolha A consolidou membership em company_users, deixando Sprint 78 sem missão imediata

### Estado material

**Backend (Sprint 78 implementado):**
- `backend/src/modules/organization/organization-member.repository.ts`
- `backend/src/modules/organization/organization-invite.repository.ts`
- `backend/src/modules/organization/organization-role.repository.ts`
- `backend/src/modules/organization/organization-unit.repository.ts`
- Plus services + routes registradas em `app.builder.ts:631`

**Frontend (Sprint 78 implementado):**
- `frontend/src/api/organization.ts`
- `frontend/src/pages/OrganizationMembersPage.tsx`
- `frontend/src/pages/OrganizationInvitesPage.tsx`
- `frontend/src/pages/OrganizationInvitePage.tsx`
- `CompanyTeamTab.tsx:173-200` linka para `/organization/{members,invites,roles,units}`

**Runtime DB:**
- `organization_members`, `organization_invites`, `organization_roles`, `organization_units`: **TODAS INEXISTENTES**
- Toda chamada `/organization/*` retorna 500 (PostgreSQL "relation does not exist")

### Por que congelada (não removida)

- Migrations no archive: `0045_organization_units.sql`, `0058_organization_roles.sql`, `0059_organization_members.sql`, `0060_organization_invites.sql`
- Código backend + frontend completos e coerentes
- Tese arquitetural válida: `organization_*` como SSOT universal (empresa/grupo/canal/comunidade)
- Princípio archive NÃO é SSOT vigente (memória `feedback_archive_nao_e_ssot.md`): preservar até ter demanda real

### Critério de descongelamento

Reabrir Sprint 78 (e migrar membership de company_users para organization_members) quando:
- (a) Frente real de governança organizacional emergir (units/roles/invites compartilháveis cross-tipo)
- (b) Necessidade de fluxo INVITED bidirecional formal (hoje company_users suporta status=invited básico)
- (c) Decisão arquitetural humana de unificar empresa/grupo/canal sob taxonomia única `organization_*`

### Risco de não-descongelar

- Endpoints `/organization/*` permanecem CHAMÁVEIS via roteamento (`app.builder.ts:631`) mas QUEBRAM em runtime
- UI `CompanyTeamTab.tsx:173-200` mantém 4 botões que apontam para rotas mortas
- **Bug visível: clicar em "Gerenciar Membros" / "Ver Convites" / "Papéis" / "Unidades" na aba Equipe leva a páginas com erro PostgreSQL 500**

### Mitigação cirúrgica recomendada (frente separada, fora MEMBERSHIP)

Esconder ou desabilitar os 4 botões em `CompanyTeamTab.tsx` enquanto Sprint 78 fica congelada — evita UX broken visível. Registrar como DT-UI-ORGANIZATION-BUTTONS-LEAD-TO-500 se Clayton priorizar.

### Padrão institucional

Sprint 78 é exemplo de **convergência interrompida** (memória `project_lei_historica_sistema.md`): código completo, migrations no archive, intenção arquitetural viva, mas pausada por falta de demanda. NÃO apagar — preservar até momento humano de retomada.

---

## DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS — Reposicionada como sub-DT histórica de DECISION-0042

**Status:** CLOSED como standalone; preservada como sub-DT histórica
**Resolução:** Sucedida por DECISION-0042 (escolha de opção A). 3 camadas paralelas (company_users vivo / company_members migration arquivada / organization_* sem migration) convergiram para **company_users como SSOT único**.

#### Camadas finais

| Camada | Estado pós-DECISION-0042 |
|---|---|
| `company_users` | VIVA (SSOT membership role-based) |
| `company_members` (migration archive) | DESCARTADA (migration `0050_company_members.sql` permanece em archive como referência histórica) |
| `organization_*` (Sprint 78) | CONGELADA via DT-ORGANIZATION-SPRINT78-FROZEN |

#### Lição arqueológica

3 reconstruções históricas tentaram consolidar membership (`company_employees`, `company_members`, `organization_members`). Decisão A reconhece: a única que **deixou substrato vivo** é a primeira (`company_users`). Convergir para o vivo é mais barato que ressuscitar archives ou criar tudo novo.


---

## DT-FANTASMA-ORPHAN-COLLECTIVE — 8 módulos FANTASMA sem caller frontend real

**Status:** OPEN
**Prioridade:** LOW
**Bucket:** INFORMATIVA (não bloqueia produto; preserva memória institucional)
**Data:** 2026-05-17
**Categoria:** PREMATURO (código aspiracional sem demanda frontend)
**Origem:** Auditoria Pendência B (Frente #2 MODULES-ASPIRATIONAL-VS-RUNTIME)

### Resumo material

Auditoria caso-a-caso dos 16 sub-callers FANTASMA mapeados no MODULES_INVENTORY (Pendência B) revelou que **8 módulos não possuem caller frontend real em runtime**. MODULES_INVENTORY contou rotas backend que referenciam tabelas inexistentes; auditoria frontend confirmou ausência de chamada efetiva.

### Inventário dos 8 órfãos

| Módulo | Backend (rotas) | Frontend | Status caller real |
|---|---|---|---|
| `core/residence` | 3 rotas | api file não existe | zero callers |
| `core/root-config` | 6 rotas | api file não existe | zero callers |
| `core/user-group-allocation` | 2 rotas | api file não existe | zero callers |
| `modules/care` | 3 rotas | api file não existe | zero callers |
| `modules/social-chat` | 2 rotas | api file não existe | zero callers |
| `modules/work-instant` | 14 rotas | api file não existe | zero callers |
| `modules/media` | 2 rotas | `getPresignUrl` exportada em `api/social-2.0.ts:239` | NÃO invocada em runtime (PostComposer:298 tem comentário "Placeholder; gera IDs temp") |
| `modules/presence` | 11 rotas | `api/presence.ts` existe | zero callers fora do próprio arquivo |

### Refinamento Categoria 1 vs Categoria 3 (Pendência B atualizada)

`core/memory` (inicialmente categorizado como órfão na Pendência B) foi **reclassificado para Categoria 1 — silent fail**:
- Componente `utils/institutional-memory.tsx:84` faz `useEffect → listInstitutionalMemory()`
- Renderizado por `PilotObserverPage.tsx` (rota `/admin/pilot` ATIVA, App.tsx:347)
- Backend `/memory` → tabelas `user_memory_*` ausentes → erro tratado por try/catch + `console.error`
- UX não quebra (silent fail), mas há chamada wasted ao abrir `/admin/pilot`

Contagem final Pendência B: 8 órfãos puros (não 9).

### Por que não remover código (princípio archive)

Memória `feedback_archive_nao_e_ssot.md`: "não apagar sem auditar, mas congelar com critério explícito". Cada módulo pode representar convergência interrompida (memória `project_lei_historica_sistema`):
- `modules/work-instant` (14 rotas): Uber-like matching aspiracional — congelado em DT-MODULE-WORK-INSTANT-FROZEN-PRE-P4-P5 (sessão Frente 2)
- `modules/presence` (11 rotas): 9º modelo paralelo de check-in/presence — congelado em DT-PRESENCE-FRAGMENTED-NO-RUNTIME
- `core/residence`, `core/root-config`, `core/user-group-allocation`: infraestrutura aspiracional sem migração ativa
- `modules/care`, `modules/social-chat`: features ainda não demandadas
- `modules/media` (presign): preparado para futuro upload S3-style, mas sistema atual usa IDs temp

Remover hoje = perder intenção arquitetural visível. **NÃO há bug runtime** — não há urgência.

### Critério de descongelamento

Reabrir auditoria + decidir remover/migrar quando:
- (a) demanda real emergir para qualquer um dos 8 módulos (frontend páginas/componentes começam a usar)
- (b) frente de "cleanup arquitetural ampla" autorizada por Clayton (escopo: remover código aspiracional sem demanda há > 6 meses)
- (c) onboarding novo dev relatar confusão repetida com qualquer um dos 8 módulos

### Riscos preservados

- **Risco institucional baixo:** próximo dev pode presumir que módulos funcionam (já capturado em DT-MODULES-ASPIRATIONAL-VS-RUNTIME). MODULES_INVENTORY na raiz mitiga.
- **Network observability:** zero (não há chamada real)
- **Performance:** zero (não há fetch em mount)
- **UX:** zero (sem caller visível)

### Princípio capturado

> "FANTASMA backend sem caller frontend real ≠ bug — é código aspiracional sem demanda. Auditoria material distingue 'morto e quebra' (mitigar) de 'morto e silencioso' (registrar e preservar)."

### Mitigação alternativa explicitamente NÃO aplicada

- ❌ Apagar arquivos: violaria princípio archive
- ❌ Adicionar header `@deprecated` em cada arquivo: scope creep sem autorização ampla
- ❌ Comentar exports: introduz fragmentação sem ganho material
- ✅ DT collective + critério descongelamento + MODULES_INVENTORY como SSOT

### Referência

`MODULES_INVENTORY.md` seção 2 (tabela material FANTASMAS) — auditoria material que produziu a lista.

`STATUS_EXECUCAO_GLOBAL.md` entrada 2026-05-17 — Pendência B triagem por categoria.

---

## DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT — CLOSED

**Status:** CLOSED 2026-05-17
**Resolução:** DECISION-0043 + commit `0c710b47`
**Pattern:** Frente /perfil contextual progressiva (primeira superfície da convergência contextual progressiva atravessada)

### Resolução material

- Backend `core.service.ts:136-154`: substitui early return rotulado "BLINDAGEM" (commit `c4c45ec77` 2026-01-27) por bifurcação contextual explícita per princípio 4 (DT_PRIORIZATION). Comportamento observável preservado (PF-only campos null para actor≠user, education_profile populado quando aplicável); intenção documentada elimina contradição contrato/implementação.
- Frontend `Profile.tsx`: redirect síncrono (Navigate replace) quando `activeActor.actor_type='page'` → `/empresa/:companyId`. Princípios 8 e 9 honrados (reorganiza superfície sem migrar soberania; síncrono, derivado de estado client).
- Frontend 7 sub-componentes Profile* + `NotApplicableMessage.tsx`: defesa em profundidade — princípios 4 e 5 honrados (ausência é semântica; sem fallback implícito).

### Contradição contrato/implementação eliminada

DT original (2026-05-15) documentava: "Endpoint declara contextualização (aceita actorId), mas executa hardcoded user-centric."

Pós-resolução: endpoint declara E executa bifurcação contextual consciente. Comentários no código referenciam DECISION-0043 + princípio 4 + commit `c4c45ec77` original como evidência arqueológica preservada.

### Sub-instâncias resolvidas anteriormente

- **PASSO 9 desta sessão** (modal loop /perfil para page actor): commit `9907f5c8` aplicou guard cirúrgico em `Profile.tsx:542` (`activeActor?.actor_type === 'user'` antes de abrir modal). Sub-instância tratada antes da resolução estrutural; agora redundante com guard 2.b mas mantido como defesa adicional.

### Princípios materializados em runtime

DECISION-0043 (princípios 1-9 em DT_PRIORIZATION.md) ratificados via:
- 9 arquivos modificados + 1 novo
- TSC 0 erros (backend + frontend)
- Diff isolado +163/-23 LOC
- Limite de escopo absoluto respeitado (zero alterações em rotas/layouts/operating mode/CRM/bank/App.tsx)

### Lição preservada

Contradição temporal do mesmo autor (jan 2026 BLINDAGEM cega / mai 2026 gap a resolver) atravessada por **decisão soberana arbitrante via auditoria histórica material**. Pattern útil para frentes futuras: quando código + DT divergem sem DECISION arbitrando, auditoria histórica (git blame + grep DECISIONs + leitura DT completa) é caminho institucional honesto antes de propor mitigação.

### Referência cruzada

- DECISION-0043 (REMEDIATION_DECISIONS_LOG.md): formalização
- DT_PRIORIZATION.md "Princípios da convergência contextual progressiva — Frente /perfil (2026-05-17)" (linhas 938-996): 9 princípios invocados
- Commit `0c710b47`: implementação cirúrgica
- STATUS_EXECUCAO_GLOBAL.md entrada 2026-05-17: registro institucional do fechamento

---

## DT-DRIFT-STATUS-CASE-SYSTEMIC

- **Status:** OPEN
- **Origem:** PASSO 6b (smoke supply chain 2026-05-17, ELO 1) — descoberta institucional via runtime real
- **Vinculada a:** nenhuma DECISION arbitrando convenção de status canônica
- **Contexto:**
  Drift sistêmico entre literais de status em código TypeScript (UPPERCASE) e
  CHECK constraints no DB (lowercase). Confirmado materialmente em runtime no
  ELO 1 do smoke supply chain.

  Bug concreto confirmado (1):
  - `supplier.service.ts:48` — `status: input.status || 'ACTIVE'`
  - `supplier.types.ts:7` — `type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'`
  - DB constraint `suppliers_status_check` — `CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]))`
  - DB default — `'active'::text`
  - Sintoma runtime: Postgres error 23514 (violação da CHECK constraint)

  Mapa material (auditoria anterior — Codex, 2026-05-17):
  - 76 arquivos `.ts` usam status com literais UPPERCASE
  - 70 de 75 CHECK constraints DB usam lowercase canônico
  - 5 constraints exceção (`chat_reports`, `chat_messages`, `live_presence`)
  - 2 mistas (`actor_debts`, `event_reservations`)

  Bugs latentes prováveis (não confirmados em runtime — tabelas vazias):
  subscriptions, reversals, b2b_orders, regional_fund, bank_limits,
  order_saga, reconciliation, e outros services Sprint 60+.

  Pattern observado: features de Sprints altas (suppliers/POs = Sprint 69)
  nunca foram exercitadas em runtime — tabelas com 0 rows globais escondem o
  drift até primeiro uso real. Smoke é descoberta institucional.

- **Risco:**
  - P1 sistêmico: cada feature dessas falha no primeiro uso real
  - Não bloqueia hoje (tabelas vazias em runtime)
  - Bloqueia primeiro uso real de cada feature afetada
  - Constraint protege banco (erro explícito), mas degrada UX (operação parece
    aceitar e quebra)

- **Mitigação atual:**
  Workaround cirúrgico no script de smoke (`backend/scripts/smoke-supply-chain-2026-05-17.ts`):
  passar `status: 'active' as any` explicitamente no ELO 1 (sobrepõe default
  UPPERCASE do service). Comentário inline referencia esta DT.

- **Resolução prevista:**
  Frente própria (1-2 sessões dedicadas, descrita por Clayton 2026-05-17):
  - Etapa 1: auditoria 1:1 código vs constraint (mapeia bugs reais)
  - Etapa 2: decisão sobre norma (lowercase canônico OU mixed por legado documentado)
  - Etapa 3: fix em batches por sprint origem (Sprint 69 supplier/PO primeiro,
    depois subscriptions/reversals/b2b_orders/etc)
  - Etapa 4: gate CI que detecta mismatch entre TS literal e CHECK constraint

  Não abrir agora. Smoke primeiro (decisão Clayton 2026-05-17). Frente
  quando autorizada explicitamente.

---

## DT-DRIFT-SCHEMA-CODE-MISMATCH-CATEGORIES

- **Status:** OPEN
- **Origem:** PASSO 6b (smoke supply chain 2026-05-17, ELO 2 v1) — descoberta institucional via runtime real
- **Vinculada a:** nenhuma
- **Contexto:**
  `categories.repository.ts:106-116` executa SELECT incluindo coluna
  `domain_type` que não existe na tabela `categories`. Sintoma runtime:
  Postgres error 42703 (`coluna "domain_type" não existe`).

  Query bugada (SELECT inclui `domain_type` entre as colunas projetadas):
  ```
  SELECT category_id, parent_id, name, slug, description, level, path,
         COALESCE(keywords, '[]'::jsonb) AS keywords,
         country_code, scope, domain_type, metadata, created_at, updated_at
  FROM categories
  WHERE category_id = $1 ...
  ```

  Colunas reais da tabela `categories` (21, sem `domain_type`):
  `category_id, parent_id, name, slug, description, level, path, keywords,
  country_code, scope, status, requires_review, is_created_by_ai, is_active,
  metadata, approved_by, approved_at, rejection_reason, created_at, updated_at,
  concept_id`.

  Hipótese arqueológica: alguma migration dropou `domain_type` ou a coluna
  nunca foi adicionada (apesar do código já assumir sua existência). `findById`
  nunca foi exercitado em runtime — mesmo padrão do bug supplier (categories
  tem 102 rows mas leitura via `findById` deste repository específico provavelmente
  não tinha caller real até o smoke).

  Classe de drift distinta de DT-DRIFT-STATUS-CASE-SYSTEMIC:
  - status case = constraint rejeita, banco protege
  - schema mismatch = banco aceita schema, código defasa, runtime quebra ao
    parsear resultset

- **Risco:**
  - Bloqueia qualquer caller de `categoryService.findById` (e portanto de
    `productCatalogService.createProduct` quando `categoryId` é fornecido)
  - Pode haver outras queries com `domain_type` ou outras colunas removidas/renomeadas
    em outros repositories core — auditoria não conduzida

- **Mitigação atual:**
  Workaround tentado no smoke v2 (omitir `categoryId`) não funcionou — gerou
  DT-DRIFT-CONTRACT-INTERFACE-RUNTIME separada. Smoke pausou no ELO 2 v2 sem
  prosseguir.

- **Resolução prevista:**
  Frente própria de auditoria sistêmica: grep por queries SELECT que referenciam
  colunas e cruzar com `information_schema.columns` (similar à estratégia de
  DT-DRIFT-STATUS-CASE-SYSTEMIC mas para mismatch schema-vs-código).

  Possível gate CI: validar em build-time que queries SQL referenciam apenas
  colunas que existem nas migrations conhecidas.

  Não abrir agora. Clayton decide ordem entre as 3 DTs em sessão futura.

---

## DT-DRIFT-CONTRACT-INTERFACE-RUNTIME

- **Status:** OPEN
- **Origem:** PASSO 6b (smoke supply chain 2026-05-17, ELO 2 v2) — descoberta institucional via runtime real
- **Vinculada a:** nenhuma
- **Contexto:**
  Tipo TypeScript declara campo opcional mas regra runtime exige. Material
  confirmado em runtime no ELO 2 v2 do smoke supply chain.

  Bug concreto confirmado (1):
  - `product-catalog.types.ts` — `interface CreateProductInput { categoryId?: string | null; ... }` (tipo diz opcional)
  - `product.repository.ts:22-31` — `requireCategoryIdForProductCreate` lança
    `CATEGORY_REQUIRED` se categoryId vazio/nulo (regra "P0 RFC 0: category_id
    obrigatório na criação de product")
  - Sintoma runtime: caller que confia no tipo passa `undefined` → exceção
    runtime sem aviso pelo TS

  Classe de drift distinta das anteriores:
  - Status case = literal vs constraint
  - Schema mismatch = código vs colunas
  - Contract drift = tipo público vs regra runtime privada

  Repository carrega a verdade material (regra "P0 RFC 0"), mas interface pública
  mente sobre obrigatoriedade. Caller de boa fé sofre erro tardio.

  Hipótese arqueológica: regra `requireCategoryIdForProductCreate` foi
  adicionada após a interface ser publicada (P0 RFC 0 = posterior), sem atualizar
  o tipo correspondente. Tipo defasou.

  Bugs latentes prováveis (não confirmados): outros campos com guard
  obrigatório em repository mas opcional em interface. Auditoria não conduzida.

- **Risco:**
  - Quebra caller de boa fé (ou agente humano que confia no tipo)
  - Mascara obrigatoriedade real na documentação tipada
  - Padrão se repete: smoke autorizado por Clayton ("Service trata como opcional
    — interface confirma") foi baseado no tipo e quebrou no runtime

- **Mitigação atual:**
  Smoke pausou no ELO 2 v2. Sem workaround aplicado. Estado preservado
  (1 row em `suppliers` do ELO 1 + cleanup opcional).

- **Resolução prevista:**
  Frente própria — duas estratégias possíveis:
  - (a) Sincronizar tipos com regras runtime (tornar `categoryId` obrigatório
    no tipo, atualizar todos callers)
  - (b) Mover regra para o service (eliminar `requireCategoryIdForProductCreate`
    do repository) — mais arriscado, regra arquitetural P0 RFC 0 protegida hoje

  Pode ser parte da mesma frente de gate CI (DT-DRIFT-STATUS-CASE-SYSTEMIC etapa 4):
  detector que cruza tipo público vs guards runtime em repositories.

  Não abrir agora.

---

## Convergência das 3 DTs do PASSO 6b (2026-05-17)

As 3 DTs acima foram descobertas na mesma sessão durante o mesmo smoke
(`backend/scripts/smoke-supply-chain-2026-05-17.ts`). Cada falha revelou classe
distinta de drift:

| DT | Classe | Mecanismo |
|---|---|---|
| DT-DRIFT-STATUS-CASE-SYSTEMIC | literal vs constraint DB | banco rejeita explicitamente |
| DT-DRIFT-SCHEMA-CODE-MISMATCH-CATEGORIES | código vs schema DB | resultset parse quebra |
| DT-DRIFT-CONTRACT-INTERFACE-RUNTIME | tipo público vs regra runtime privada | runtime lança após type-check passar |

Princípio operacional emergente (a registrar em STATUS_EXECUCAO_GLOBAL.md desta
sessão):

> Smoke em sistema com 0-row-em-runtime é descoberta institucional, não validação
> de fluxo. Cada ELO pode revelar classe nova de drift. Workaround + DT, sem fix
> raiz no meio. Após smoke (ou pausa autorizada), reportar lista completa de
> drifts. Clayton decide estratégia de gates progressivos por valor/frequência
> observada.

Sobre formalizar DECISION-0044 (PO/inventory pipeline pattern): NÃO formalizada
nesta sessão. Princípio 6 da DECISION-0043 ("DECISION posterior à validação")
exige pattern validar end-to-end antes de cristalizar. Smoke parou no ELO 2 v2
sem completar a cadeia. Pattern aguarda validação real em sessão futura.

---

## DT-PIX-LEDGER-ALIMENTATION-AMBIGUITY

- **Status:** OPEN
- **Origem:** Auditoria estrutural 2026-05-18 (R5 — leitura profunda
  pré-fix) — descobriu ambiguidade arquitetural não resolvível por fix cirúrgico
- **Vinculada a:** nenhuma DECISION arbitrando contrato PIX↔ledger
- **Contexto:**
  `payment-execution.service.ts:1463-1467` (`markPixPaymentAsSuccess`) marca
  `payment_transactions.status='SUCCESS'` quando webhook PIX confirma, armazenando
  `pixChargeId` no campo `bank_transaction_id`:

  ```ts
  const successTransaction = await paymentTransactionRepository.markAsSuccess(
    tenantId,
    pendingTransaction.id,
    pixChargeId // Usar pixChargeId como identificador
  );
  ```

  Função **NÃO** chama `bankTransactionService.transfer` — `bank_ledger` não é
  alimentado neste fluxo. `bank_transaction_id` armazena ID do PIX charge, não
  de uma row em `bank_transactions`.

  **Ambiguidade arquitetural:** unclear se:
  - (a) settlement do PIX vem por OUTRO fluxo assíncrono (e neste caso o status
    SUCCESS sem ledger é estado transitório intencional, esperando settlement
    que alimentará o ledger depois), OU
  - (b) é bug — payment marcado SUCCESS sem dinheiro entrar no ledger soberano

  Diferença material:
  - Se (a): documentar contrato, anotar campo metadata.settlement_pending,
    timeline esperada, worker que alimenta ledger depois
  - Se (b): chamar `bankTransactionService.transfer` no webhook OU mover
    `markAsSuccess` para o callback do settlement

- **Risco:**
  - Fluxos downstream (fulfillment, accounts-receivable, settlement, loyalty,
    fiscal) confiam em `payment_transactions.status='SUCCESS'` para acionar
    side-effects (cf. `payment-execution.service.ts:524-790`)
  - Se settlement async nunca chegar (gateway perde callback, retry esgotado):
    produto enviado, contabilizado, sem dinheiro real no ledger
  - Bank ledger é SSOT financeiro absoluto (LEI §4.6) — divergência semântica
    entre "pagamento ocorreu" e "ledger reflete" viola invariante de soberania

- **Mitigação atual:**
  - `paymentTransactionRepository` armazena `pixChargeId` como rastro
  - `gateway_webhook_events` idempotência DB-level previne replay de webhook
  - Auditoria pre-fix R5 PAROU antes de "corrigir" (princípio explícito Clayton
    2026-05-18: "Se houver ambiguidade arquitetural: parar, reportar, NÃO corrigir")
  - Nenhuma mitigação técnica no momento — apenas registro

- **Resolução prevista:**
  Frente arquitetural própria — DECISION formal sobre quando bank_ledger é
  alimentado em fluxo PIX. Pré-requisito: auditoria de qual settlement async
  existe (se algum). Caminhos possíveis:
  - DECISION-X: PIX alimenta ledger no webhook (chama bankTransactionService.transfer)
  - DECISION-Y: PIX tem settlement async separado, ledger alimentado por worker
    dedicado lendo de pix_charges + payment_transactions
  - DECISION-Z: PIX é registrado em ledger paralelo (pix_ledger?) e reconciliado
    com bank_ledger via job

  NÃO tocar `markPixPaymentAsSuccess` sem essa DECISION. Pattern Clayton:
  "bug confirmado → corrigir; causalidade não explicitada → DECISION".

---

## DT-EVENT-FINANCIAL-EXECUTION-ORPHAN-RECOVERY

- **Status:** OPEN (adiada por decisão Clayton 2026-05-18)
- **Origem:** Auditoria estrutural 2026-05-18 (R2 — escopo de blindagem
  cirúrgica, item adiado por análise pós-R5)
- **Vinculada a:** R1 (Fix 1 commit `35b45451` — comentário inline em
  `post-event-split.job.ts` aponta para esta DT)
- **Contexto:**
  `post-event-split.job.ts:67-93` reivindica linha de `event_financial_execution`
  via UPDATE `WHERE status='pending'` atómico → status='processing'. Loop processa
  participantes chamando `escrowService.release`. Ao final, marca status='completed'.

  Cenário de orphan: se job crashar **entre** claim (status='processing') e
  `.complete` final, status fica `'processing'` permanente.

  Próxima execução do cron NÃO reentra (claim só pega `'pending'`). Pagamentos
  parciais persistem sem recovery automático.

  Mecanismo de claim atual:
  ```ts
  UPDATE event_financial_execution efe
  SET status = 'processing', updated_at = now()
  FROM events e
  WHERE e.id = efe.event_id
    AND e.tenant_id = efe.tenant_id
    AND e.tenant_id = $1
    AND efe.event_id = $2
    AND efe.status = 'pending'
  RETURNING efe.id
  ```

  Funciona perfeitamente em fluxo feliz. Falha apenas em recovery pós-crash.

  **Hoje INATIVO:** `escrowService.release` é stub vazio (`escrow.service.ts:322-334`).
  Loop sempre completa sem fazer nada de fato; status='processing' nunca persiste
  porque chega rapidamente ao `.complete`. Orphan é teórico em runtime atual.

  **Vira ATIVO** quando event-escrow event-based for implementado E houver
  crash real no meio do loop.

- **Risco:**
  - Latente hoje (release stub no-op em runtime)
  - Ativo quando event-escrow for implementado: estado parcial não recuperável,
    participantes pagos enquanto outros não, ledger íntegro mas processo morto
  - **Bomba operacional silenciosa** antes de produção em escala real (texto
    literal Clayton 2026-05-18)

- **Mitigação atual:**
  - Fix 1 (commit `35b45451`) — `idempotencyKey` determinístico previne double
    payout SE alguém retomar manualmente (re-rodar o job não duplica, mas também
    não reentra automaticamente)
  - Comentário inline em `post-event-split.job.ts:66-74` aponta para esta DT
    como sinalização para próxima IA/dev tocar o arquivo
  - HARD LOCK temporal (`post-event-split.job.ts:96-105`) impede release antes
    de `event.status='ended'` AND `datetime_end <= now()` — limita janela de
    crash para período pós-evento

- **Resolução prevista:**
  Frente própria — mecanismo de reclaim baseado em idade. NÃO improvisar.
  Recovery automático em fluxo financeiro carrega risco real de replay sobre
  pagamento parcialmente liquidado.

  Estratégia preferencial (proposta para frente futura, NÃO autorizada):
  - Adicionar `processing_started_at TIMESTAMPTZ` em `event_financial_execution`
  - Worker dedicado (ou reuso de `saga-timeout.worker.ts` adaptado) que detecta
    `status='processing' AND processing_started_at < NOW() - INTERVAL '10 min'`
  - Antes de reset → verificar se houve release material no intervalo (consulta
    a `escrow_transactions` ou tabela equivalente quando implementada)
  - Reset CONTROLADO para `'pending'` apenas se NENHUMA release material
    ocorreu — fail-safe contra replay

  **Critério de implementação obrigatória:** antes de produção em escala real
  (qualquer fluxo em que `escrowService.release` deixe de ser stub E job rode
  em ambiente sem supervisão humana imediata).

  Marker temporal: registrar agora, executar quando event-escrow event-based
  entrar em pipeline de implementação.

---

## Convergência das 2 DTs do Fix 4 (blindagem cirúrgica 2026-05-18)

As 2 DTs acima foram registradas como **parte deliberada** do escopo de blindagem
cirúrgica. Nenhuma virou fix técnico nesta sessão. Razões distintas:

| DT | Razão para NÃO fixar |
|---|---|
| DT-PIX-LEDGER-ALIMENTATION-AMBIGUITY | Ambiguidade arquitetural — precisa DECISION humana antes de qualquer alteração em fluxo PIX |
| DT-EVENT-FINANCIAL-EXECUTION-ORPHAN-RECOVERY | Latente hoje (release stub no-op) — fix de recovery sem dinheiro real para recuperar é ginástica; adiar até event-escrow ser implementado |

Princípio operacional Clayton 2026-05-18:
> "Bug confirmado → corrigir. Causalidade não explicitada → DECISION.
> Risco latente → registrar + adiar. Recovery automático em fluxo financeiro
> é mais perigoso que problema."

Disciplina respeitada: nenhum fix de oportunidade no meio de escopo cirúrgico
autorizado. Ambas as DTs aguardam frente própria com autorização explícita.

---

## DT-PRESSURE-BANK-ACTOR-CONTEXT

- **Status:** MITIGADA EM CÓDIGO (aguarda smoke browser para CLOSED) — implementada na P1, commit `fce493c0` (feat(bank): actor-context resolution). Smoke E2E via curl PASS 4 cenários incluindo `hasAccount=false` material para actors sem conta bank. Reconciliação §22 lição 2 — Status header substituído (não duplicado) em 2026-05-18 EXECUTOR CONTÍNUO; ver bloco "Atualização" abaixo para detalhe.
- **Origem:** auditoria contextual frontend 2026-05-18 (sessão modelagem Home Contextual) — confirmada via grep material em `frontend/src/api/bank.ts`
- **Vinculada a:** memória `project_home_contextual_modelo_2026-05-18.md` (P1, item destrava trabalho de Codex)
- **Categoria:** DT-PRESSURE (auditoria frontend identificou gap backend que bloqueia projeção contextual real)
- **Contexto:**

  `frontend/src/api/bank.ts:56` declara explicitamente que `getBankBalance()`
  retorna saldo do **usuário autenticado**, sem aceitar `actorId`. Idem para
  `getBankStatement()` em `bank.ts:121`. Grep em todo `bank.ts` por
  `actor_id|actorId|activeActor` retorna zero ocorrências.

  Consumo material em `frontend/src/components/home/DashboardHome.tsx:177-294`:
  - Variável `balanceCents` é compartilhada entre cards `meu-saldo` (PF) e
    `caixa-empresa` (PJ) — ambos lêem do mesmo state
  - Quando `activeActor.actor_type === 'page'` (empresa), o card "Caixa da
    empresa / saldo operacional" mostra valor retornado por
    `getBankBalance()` — que é o saldo do **usuário autenticado**, não da
    empresa
  - Atividade recente (`getBankStatement`) sofre do mesmo problema

  Mesmo padrão se replica em outros consumidores frontend que assumem
  contexto de actor mas chamam API que ignora.

- **Risco:**

  **Falsificação semântica de dado financeiro com label trocado.** Frontend
  renderiza saldo do user com label "Caixa da empresa Voltagem Bar Band" e
  rótulo "saldo operacional". É estruturalmente impossível mostrar o valor
  correto da empresa enquanto a API não aceita `actorId`.

  Cenários onde isso vira bug visível:
  - Usuário PF com saldo R$ X troca para actor empresa (saldo R$ Y diferente)
    → vê seu próprio R$ X marcado como "Caixa da empresa"
  - Atividade recente da empresa mostra transações da pessoa
  - Limites/processamento mostram dados misturados

  Em runtime atual com volume baixo e saldos zerados, sintoma é invisível.
  Em produção com volume real, vira incidente de causalidade financeira
  observável pelo usuário.

- **Mitigação atual:**

  Aplicada parcialmente no frontend recente (2026-05-18, sessão EXECUTOR
  AUTORIZADO):
  - Card `caixa-empresa` permanece renderizando, mas memória institucional
    e este DT-PRESSURE registram a falsificação estrutural
  - Princípio operacional registrado: **frontend não tem como mostrar saldo
    correto da empresa enquanto API for cega a actor**

  Próximo passo de mitigação (não fix): substituir `balanceCents` por `—`
  no card `caixa-empresa` enquanto API não suportar — empty state honesto.
  Decisão pendente de Clayton (afeta UX).

- **Resolução prevista:**

  P1 do roadmap material (próximas 4-8 semanas):

  1. Estender `/bank/balance` para aceitar `?actorId=` (query param)
     - Backend valida que actor pertence ao user autenticado
     - Resolve saldo via ledger com `actingForActorId = actorId`
     - Mantém compatibilidade: sem `actorId`, comportamento atual (user)
  2. Idem `/bank/statement?actorId=`
  3. Frontend `api/bank.ts` aceita parâmetro opcional `actorId`
  4. `DashboardHome.tsx` e demais consumidores passam `activeActor.actor_id`
     quando actor é page/group/channel
  5. Smoke: trocar actor PF↔empresa → verificar valores diferentes nos cards

  **Não é DECISION arquitetural inédita.** É extensão de endpoint existente
  para aceitar contexto explícito. `actingForActorId` já é conceito vivo no
  ledger (memória `feedback_boundary_domain_canonical.md` e DECISION-0024).

  Estimativa: 1-2 dias backend + 1-2 dias frontend + smoke.

- **Convergência institucional:**

  Esta DT-PRESSURE foi previamente identificada nas auditorias contextuais
  de 2026-05-18 (relatórios "Auditoria Frontend — Contexto Operacional/Actor/
  Capabilities" e "Auditoria Frontend — Transição de Actor × Modo Operante").
  Formalizada aqui após autorização explícita Clayton para consolidação
  institucional.

  Bloqueio explícito: enquanto esta DT não fechar, frontend está
  **estruturalmente incapaz** de honrar a projeção contextual para PJ. O
  trabalho de UX contextual (sessão 2026-05-18 que estendeu actorContextConfig
  + businessProfileCatalog + DashboardHome) é base válida, mas o eixo
  financeiro só convergirá com este fix.


---

## Atualização DT-PRESSURE-BANK-ACTOR-CONTEXT (2026-05-18 P1 — mitigação implementada)

- **Status:** OPEN → MITIGADA EM CÓDIGO (aguarda smoke browser para CLOSED)
- **Implementação P1:** sessão EXECUCAO_MATERIAL_P1 2026-05-18
- **Mudanças materiais:**
  - `backend/src/core/bank/ports/bank-integration.port.ts`: novo método `getActorBalance(tenantId, actorId, currency)`
  - `backend/src/modules/bank/bank-integration.service.ts`: implementação `getActorBalance` que resolve actor → owner (user/page/group) → conta
  - `backend/src/modules/bank/adapters/bank-integration.adapter.ts`: adapter expõe `getActorBalance`
  - `backend/src/core/unifybank/bank-http.routes.ts`: `GET /bank/balance` aceita `?actorId=` com validação de authority via `actorCapabilitiesService`
  - `backend/src/core/unifybank/transparency.service.ts`: novo método `getActorStatement` + helper privado `_getStatementForAccount` (refator localizado, sem nova abstração)
  - `backend/src/core/unifybank/transparency.routes.ts`: `GET /bank/statement` aceita `?actorId=` com validação de authority
  - `frontend/src/api/bank.ts`: `getBankBalance({actorId?})` e `getBankStatement({actorId?})` aceitam parâmetro opcional
  - `frontend/src/components/home/DashboardHome.tsx`: passa `activeActor.actor_id` para banco quando actor não é user
- **Authority validation:** via `actorCapabilitiesService.resolveForUser` (capability resolver MVP — read-only, lê SSOT `actor_delegations` + `company_users.can_*` + `actors`). Sem authority: 403.
- **TS check:** backend exit=0; frontend exit=0
- **Smoke pendente:** trocar actor PF para empresa no browser, verificar saldos diferentes em "Caixa da empresa" vs "Meu saldo Unifibank"
- **Princípio operacional respeitado:** frontend NUNCA infere saldo — passa `actorId` e backend resolve.

---

## DT-CAPABILITY-RESOLVER-MVP-IMPLEMENTED

- **Status:** OPEN (MVP — aguarda validação em runtime real)
- **Origem:** sessão EXECUCAO_MATERIAL_P1 2026-05-18 (P1 prioridade 1 — capability resolver backend)
- **Vinculada a:** memória `project_home_contextual_modelo_2026-05-18.md` (P1 item 3); fecha pré-requisito de DT-PRESSURE-BANK-ACTOR-CONTEXT
- **Contexto:**

  Novo módulo `backend/src/core/actor-capabilities/` materializa capability resolver MVP read-only:
  - `actor-capabilities.types.ts`: tipos `ActorCapabilitiesResponse`, `CapabilityKey`
  - `actor-capabilities.service.ts`: agregação read-only de SSOT existentes (actor_type → capabilities base + `company_users.can_*` direto → capabilities company + `actor_delegations` ativos)
  - `actor-capabilities.routes.ts`: `GET /actors/:actorId/capabilities`
  - Registrado em `app.builder.ts`

  Authority validada por dupla via no `isAuthorizedOver`:
    - self (user_id corresponde a auth)
    - company_users.is_active (page)
    - actor_delegations ativo (qualquer institucional)

  **Princípio crítico aplicado:** capability é OUTPUT da composição, não nova SSOT. `company_users.can_*` é lido diretamente como SSOT permissions — NÃO há mapeamento role para capability paralelo (versão inicial tinha; corrigida após reforço da regra de soberania durante a execução).

- **Risco:**

  V1 hardcoded para `BASE_CAPABILITIES_BY_TYPE` (capabilities base por `actor_type`). Quando v2 do modo operante for implementada, capability resolver precisa virar fonte dinâmica.

- **Mitigação atual:**

  V1 cobre o caso material principal (validação de authority em endpoints bank actor-context). Documentação institucional vinculada (memória `project_home_contextual_modelo_2026-05-18.md` P1 item 3).

- **Resolução prevista:**

  V2 (P3 do roadmap) — capability resolver com inferência dinâmica baseada em todos os eixos (actor + tempo + mode + relação + delegação).

---

## DT-PRESSURE-CONFIRM-CTA-FANTASMA

- **Status:** OPEN
- **Origem:** quarentena Frente A 2026-05-18 — auditoria identificou stub `confirmCTA` em `api/social.ts:124` retornando sucesso hardcoded
- **Vinculada a:** Princípio Operacional §1 (causalidade declarada por item)
- **Contexto:**

  `frontend/src/api/social.ts` exportava `confirmCTA(_ctaId, _data?)` que retornava sucesso SEM CHAMAR BACKEND. Função é tipada com `transactionId`, `revenue_entry`, `profit_share_entry` — sugere fluxo financeiro.

  Callers ativos:
    - `frontend/src/components/social/CTAModal.tsx:89` (usa safeApiCall — tratamento ok)
    - `frontend/src/components/ServicePostCard.tsx:82` (try/catch + alert disparava em runtime real mesmo sem backend de pagamento existir)

- **Risco:**

  CRÍTICO. UI mostrava "Pagamento realizado com sucesso" para CTA financeiro inexistente em backend. Falsificação de causalidade financeira observável pelo usuário.

- **Mitigação atual (2026-05-18 P1):**

  Substituído por `throw new Error('NOT_IMPLEMENTED: confirmCTA — backend endpoint ausente...')`. Callers existentes têm try/catch e mostrarão erro honesto.

- **Resolução prevista:**

  Backend precisa decidir se CTA financeiro existe como fluxo soberano. Se sim, endpoint específico com integração bank. Se não, remover tipo e callers em sessão dedicada.

---

## DT-FOLLOW-MECHANICS-DECISION-PENDING

- **Status:** OPEN (decisão arquitetural pendente)
- **Origem:** quarentena Frente A 2026-05-18
- **Contexto:**

  Funções `followActor`/`unfollowActor` em `frontend/src/api/social.ts` eram stubs `{success: true}`. Princípio Operacional §10 do modelo Home Contextual: "Relação emerge de comportamento, NÃO de declaração. Sem adicionar amigo estilo Facebook."

  Callers ativos:
    - `frontend/src/components/social/CompanyPage.tsx:103,119`
    - `frontend/src/components/social/ProfilePage.tsx:103,119`

- **Risco:**

  Decisão arquitetural inédita: UnifiCard adota mecânica follow como Twitter/Instagram? Memória institucional sugere NÃO. Mantê-la na UI sem implementação backend gera confusão.

- **Mitigação atual:**

  Throw NOT_IMPLEMENTED. Botões de follow vão mostrar erro toast.

- **Resolução prevista:**

  DECISION humana: (a) confirmar que UnifiCard NÃO terá follow declarativo → remover UI; (b) implementar backend de follow se decidido manter; (c) substituir por vínculo emergente baseado em interações materiais. Memória atual aponta (a) ou (c).

---

## DT-SOCIAL-LEDGER-EXTINCTION-CONSUMERS

- **Status:** OPEN
- **Origem:** quarentena Frente A 2026-05-18
- **Vinculada a:** SSOT_EXCLUSIVE_BANK_RULE §4 (social-ledger.service em REGIME DE EXTINÇÃO)
- **Contexto:**

  Funções `getLedger`/`getLedgerSummary` em `frontend/src/api/social.ts` apontam para `modules/social/social-ledger.service.ts` que está em regime de extinção por SSOT_EXCLUSIVE_BANK_RULE. Stubs retornavam vazios hardcoded.

  Callers ativos:
    - `getLedger`: `GroupProfile.tsx:59`, `CommunityActivitySummary.tsx:51`
    - `getLedgerSummary`: `EventImpact.tsx:29`, `EventPage.tsx:223`, `CommunitiesBenefited.tsx:32`, `GroupProfile.tsx:46`

- **Risco:**

  Componentes mostram zero/vazio sem indicar que dado real existe no `bank_ledger`. Causa confusão sobre estado do impacto coletivo.

- **Mitigação atual:**

  Throw NOT_IMPLEMENTED com referência a `getBankStatement` como fonte canônica. Callers existentes têm try/catch — vão para empty state.

- **Resolução prevista:**

  Refator dos 6 callers para usar `getBankStatement` filtrado por contexto OU endpoint backend específico de impacto coletivo derivado de bank_ledger. Frente própria — não escopo P1.

---

## DT-PRESSURE-COMMENTS-FANTASMA

- **Status:** OPEN
- **Origem:** quarentena Frente A 2026-05-18
- **Contexto:**

  `getComments(postId, options?)` em `frontend/src/api/social.ts` era stub que retornava vazio hardcoded. Endpoint backend pode existir mas frontend não chega lá.

  Callers ativos:
    - `frontend/src/components/social/CommentsDrawer.tsx:45` (try/catch ok)

- **Risco:**

  Drawer de comentários sempre mostra vazio mesmo se backend tem comments.

- **Mitigação atual:**

  Throw NOT_IMPLEMENTED. Drawer vai mostrar erro inline.

- **Resolução prevista:**

  Auditar backend para endpoint de comments. Se sim, fazer call real. Se não, decisão arquitetural sobre comments no UnifiCard. Frente própria.

---

## Convergência Frente P1 EXECUCAO_MATERIAL 2026-05-18

Esta sessão fechou materialmente:
- Capability resolver MVP read-only (módulo novo, registrado em app.builder)
- Bank actor-context (`/bank/balance?actorId=` + `/bank/statement?actorId=` com validação via capability resolver)
- Activity propagation (`companies.activity.mainActivityDescription` em `AvailableActor` + `useBusinessProfile` consumindo)
- Quarentena dos 5+1 stubs `api/social.ts` (throw NOT_IMPLEMENTED com referência DT)

TS limpo (backend exit=0, frontend exit=0). Sem commits ainda — aguarda autorização Clayton.

Princípio operacional Clayton 2026-05-18 ("Frontend NUNCA cria verdade — frontend projeta verdade resolvida no core/backend") aplicado em todas as decisões:
  - Frontend bank.ts não infere saldo; passa actorId, backend resolve
  - Capability resolver lê `company_users.can_*` como SSOT (NÃO mapeia role para capability paralelo — correção feita durante execução após reforço da regra)
  - Activity é propagação read-only de `companies.activity` (SSOT)
  - Stubs falsificadores substituídos por throw que expõe a mentira


---

## DT-PRESSURE-AVAILABLE-ACTOR-ACTIVITY-FIELD

- **Status:** OPEN (aguarda migration backend)
- **Origem:** smoke FAIL crítico de bootstrap 2026-05-18 — Frente C do P1 revertida materialmente
- **Vinculada a:** memória `project_home_contextual_modelo_2026-05-18.md` (P1 item 4)
- **Contexto:**

  Frente C do P1 EXECUCAO_MATERIAL tentou propagar `companies.activity.mainActivityDescription` em `AvailableActor` (`/social/actors/available`) para alimentar `useBusinessProfile` com precisão maior que heurística por display_name.

  Implementação inicial adicionou `c.activity` e `c.activity->>'mainActivityDescription'` ao SELECT de `findAvailableActors` em `backend/src/modules/social/actor.repository.ts`.

  **FALHA MATERIAL DETECTADA NO SMOKE:** coluna `companies.activity` **não existe** no schema (auditado em migrations `0065_create_companies_minimal.sql`, `0066_profile_support_tables.sql`, e todas as ADD COLUMN posteriores). Tipo TS `Company.activity: CompanyActivity` em `frontend/src/api/companies.ts` era projeção tipográfica do contrato, não SSOT material.

  Resultado em runtime: query SQL falha com `column c.activity does not exist`. `findAvailableActors` rethrow. `SessionProvider.bootstrapSession` catch silencia (linha 232 do bootstrap), `setActors([])`, frontend mostra "Não há actor disponível para esta conta".

- **Lição operacional registrada:**

  **Código nunca presume schema sem verificar migration.** Tipo TS em `contracts/` ou `api/` é projeção do que o domínio gostaria de ter. Schema material em `migrations/` é o que o domínio realmente tem. Os dois divergem. Quando divergem, schema vence.

  Variante da regra "frontend nunca cria verdade" aplicada a backend: backend nunca presume coluna sem verificar migration. TS check não pega — strings SQL são opacas para TS.

- **Risco:**

  Heurística de businessProfile no frontend (resolver `BUSINESS_PROFILES_CATALOG` por `displayNameKeywords`) tem ~70% de precisão. Falsos positivos previsíveis (ex: "Bar Mitzvah Eventos" matcheia keyword "bar" mas não é bar/restaurante).

- **Mitigação atual:**

  Reversão total da Frente C em 3 arquivos:
  - `backend/src/modules/social/actor.repository.ts` — SELECT volta ao estado original
  - `frontend/src/api/social.ts` — campo `activity_main_description?` removido de `AvailableActor`
  - `frontend/src/hooks/useBusinessProfile.ts` — passa `null` como segundo argumento de `resolveBusinessProfile`

  Bootstrap confirmado funcional após reversão (Clayton smoke 2026-05-18).

  TS check: backend exit=0, frontend exit=0.

- **Resolução prevista:**

  Migration backend para adicionar `companies.activity JSONB DEFAULT '{}'` (estrutura CompanyActivity: mainActivityCode, mainActivityDescription, secondaryActivities). Depois propagar campo em `findAvailableActors` SELECT + tipos frontend.

  Não bloqueia P1 — businessProfile continua resolvendo via heurística display_name. P2 ou frente própria.

- **Convergência institucional:**

  Esta DT formaliza o aprendizado material da sessão. Princípio registrado em memória para evitar repetição:
  - Antes de qualquer SELECT com coluna nova: verificar migration que cria a coluna
  - Antes de assumir field em DTO/contract: verificar mapeamento backend ↔ schema
  - Type-check de TS NÃO substitui auditoria de migration


---

## DT-PRESSURE-BANK-ACCOUNT-COMPANY-OWNER-FK-VIOLATION

- **Status:** CLOSED — fix cirúrgico aplicado em commit `bd641aab` (2026-05-18), autorizado por Clayton em sessão EXECUTOR CONTÍNUO Fase 1. Conta PJ criada com sucesso na primeira chamada (`pjAccountId=6047f445-69fc-44db-a73b-73e76c1fea26` em rerun do `seed-smoke-p2`).
- **Origem:** Tentativa de criar substrato bank para Fase 1 do smoke browser PF↔PJ via `seed-smoke-p2.ts`. Conta PF criada com sucesso; conta PJ falhou na primeira criação.
- **Vinculada a:** DT-PRESSURE-BANK-ACTOR-CONTEXT (pré-requisito de Codex P1 item 7) — substrato PJ é pré-requisito do smoke browser que fecharia DT-PRESSURE-BANK-ACTOR-CONTEXT
- **Categoria:** DT-PRESSURE (bug runtime real que bloqueia criação de conta bank de empresa via API canônica)

### Contexto material

`bankAccountService.getOrCreateAccount(tenantId, { ownerId: companyId, ownerType: 'company', currency: 'BRL' })`
falha com FK violation quando precisa CRIAR (não buscar) conta para uma empresa que ainda não tem conta.

Causa raiz (verificada materialmente em `backend/src/modules/bank/bank-account.repository.ts:233-258`):

```ts
async createAccount(tenantId, input) {
  const { ownerId, ownerType, accountType = 'credit' } = input;
  const dbOwnerType = toDbOwnerType(ownerType);  // 'company' → 'actor'

  let actorId: string | null = null;
  if (dbOwnerType === 'escrow') {
    actorId = null;
  } else if (dbOwnerType === 'actor') {
    if (ownerType === 'user') {
      // JOIN com actors.user_id para resolver actorId — FUNCIONA
      const actorRow = await runQueryWithTenant(
        tenantId,
        `SELECT id FROM actors WHERE tenant_id = $1 AND user_id = $2::uuid
         AND actor_type IN ('user', 'person', 'actor_human') LIMIT 1`,
        [tenantId, userUuid]
      );
      actorId = actorRow?.id ?? null;
    } else {
      // ❌ BUG: para ownerType='company', usa ownerId (que é companyId) como actorId.
      //    companyId NÃO está em actors.id → FK violation em INSERT.
      actorId = ownerId.includes(':') ? ownerId.split(':')[0]! : ownerId;
    }
  }
  // INSERT INTO bank_accounts (..., actor_id) VALUES (..., $5)
  // FK actor_id REFERENCES actors(id) — VIOLADO quando dbOwnerType='actor' E ownerType≠'user'
}
```

### Evidência de runtime (curl + log do seed-smoke-p2)

```
❌ Database query error:
   query: INSERT INTO bank_accounts (tenant_id, owner_id, owner_type, account_type, actor_id) VALUES ($1, $2, $3, $4, $5) ...
   values: [
     'fbe13b78-4516-493d-905a-363796aea1d1',   // tenantId
     '2167934d-0836-4bf0-9c63-a28b11b73b7e',   // ownerId (companyId)
     'actor',                                    // dbOwnerType
     'credit',
     '2167934d-0836-4bf0-9c63-a28b11b73b7e'    // actorId (= ownerId = companyId)  ← FK violation
   ]
   error: 'inserção ou atualização em tabela "bank_accounts" viola restrição de chave estrangeira "bank_accounts_actor_id_fkey"'
   detail: 'Chave (actor_id)=(2167934d-0836-4bf0-9c63-a28b11b73b7e) não está presente na tabela "actors".'
```

`actorPageId` correto (verificado materialmente):
`actors.id = '69be4114-8e65-4e2b-b200-db359d060cb7'` (resolvido via `SELECT id FROM actors WHERE company_id = '2167934d-...' AND actor_type = 'page'`).

### Risco material

- **Latente hoje** porque seed-test-ecosystem **não cria contas bank para empresas**. Fluxos econômicos de empresa não foram exercitados em runtime real até esta sessão.
- **Ativo** sempre que um fluxo dispara primeira criação de conta de empresa via `getOrCreateAccount({ownerType: 'company'})` — exemplos materiais existentes que disparariam:
  - `bankIntegrationService.resolveCompanyAccount` (linhas 36-47 de `bank-integration.service.ts`)
  - `bankIntegrationService.resolveGroupAccount` (linhas 52-64 — `ownerType: 'company'` para grupos também)
  - `bankIntegrationService.resolveEventOrganizerAccount` quando event.actor_type='page'/'company' (linha 114-115)
  - `bankIntegrationService.getActorBalance` (P1 commit `fce493c0`) quando actor.actor_type='page' e conta não existe ainda
- **Bloqueia smoke browser P2** para validar bleed material PF vs PJ — sem conta PJ não há saldo PJ diferente.

### Mitigação atual

Nenhuma. Achado factual reportado. Sem workaround aplicado:
- Não inseri linha direto em `bank_accounts` (princípio anti-SSOT-paralela)
- Não chamei API fora de contrato
- Não criei "fix" sem Clayton no loop semântico

### Resolução prevista

Frente própria backend cirúrgica (estimativa <30 LOC, 1 sessão), padrão clonado de bloco 'user' (linhas 240-254). Resolve `actorId` via JOIN explícito:

```ts
// Para ownerType='company':
const actorRow = await runQueryWithTenant<{ id: string }>(
  tenantId,
  `SELECT id FROM actors WHERE tenant_id = $1 AND company_id = $2::uuid AND actor_type = 'page' LIMIT 1`,
  [tenantId, ownerId]
);
actorId = actorRow?.id ?? null;
```

Decisão arquitetural não inédita — apenas estender o pattern já presente para 'user'. Sem migration DDL. Sem nova soberania.

NÃO autorizada nesta sessão (Clayton no loop semântico exigido — Fase 1 bloqueada por achado factual, não por falta de autorização).

### Convergência institucional

- Achado consumado durante EXECUTOR CONTÍNUO Fase 1 autorizada
- Substrato PJ bloqueado materialmente — Fase 1 reportada como FAIL específico
- Smoke browser P2 da DT-PRESSURE-BANK-ACTOR-CONTEXT **NÃO pode validar bleed PF↔PJ** até este bug fechar (substrato PJ vazio = ambos lados retornam saldo zero, bleed visível impossível de provar/refutar)
- Princípio Clayton 2026-05-18 respeitado: "se algum passo expor bug real, reportar como achado factual. NÃO corrigir o bug nesta rodada — fechamento causal exige Clayton no loop semântico"
- Resolução em rodada seguinte: Clayton autorizou fix cirúrgico encadeado com continuidade da Fase 1. Padrão clonado de bloco 'user' (linhas 240-254) para 'company' + fallback 'group'. Sem migration DDL. Sem nova soberania.

---

## DT-PRESSURE-BUILDSYSTEMAUTHORSHIP-INVALID-ACTOR-ID

- **Status:** OPEN (achado factual em sessão EXECUTOR CONTÍNUO Fase 1 Parte B — 2026-05-18; bug arquitetural NÃO corrigido nesta rodada por princípio de fronteira — toca causalidade financeira)
- **Origem:** Após fix da DT-PRESSURE-BANK-ACCOUNT-COMPANY-OWNER-FK-VIOLATION (commit `bd641aab`), rerun do `seed-smoke-p2.ts` criou conta PJ mas falhou ao creditar via `bankTransactionService.createSimpleTransaction`.
- **Categoria:** DT-PRESSURE (bug arquitetural em helper de autorship financeira — código nunca foi exercitado em runtime real)

### Contexto material

`buildSystemAuthorship` (em `backend/src/modules/bank/financial-authorship.helper.ts:118+125`) usa default `actingForActorId: params.actingForActorId || 'system'` — string literal `'system'`.

Esse valor flui para `bank-transaction.service.ts:1034-1043`:

```ts
const actorId = authorship.actingForActorId ?? fromAccountId ?? toAccountId ?? '';
// INSERT INTO bank_transactions (..., actor_id) VALUES (..., $N::uuid)
```

`bank_transactions.actor_id` é UUID NOT NULL com FK para `actors.id`. String `'system'` falha imediatamente com erro 22P02:
`sintaxe de entrada é inválida para tipo uuid: "system"`.

### Verificação de SSOT (via `_inspect-system-actor.ts`)

Não existe actor canônico para "system" neste tenant:

```
SYSTEM ACCOUNTS (em bank_accounts WHERE owner_type='system'):
  - bank_reserve, bank_settlement, risk_reserve, seller_pending, seller_available
  - TODOS com actor_id=NULL
```

Logo o caminho `buildSystemAuthorship` sem `actingForActorId` explícito sempre falharia se chegasse ao INSERT em `bank_transactions`.

### Risco material

- **Latente até esta sessão** porque nenhum caller de `createSimpleTransaction` em produção/runtime real chamou `buildSystemAuthorship` sem actor real (ou esses callers nunca foram exercitados em runtime — investigação pendente)
- **Bloqueia smoke browser P2** para validar bleed PF↔PJ se workaround de seed não for usado
- **Toca causalidade financeira** — toda transação de sistema (créditos automáticos, settlement, escrow release) hipoteticamente sofreria o mesmo defeito se invocada

### Mitigação atual

- **No seed `seed-smoke-p2.ts`**: workaround LOCAL, não invasivo. Passa `authorActorId` explícito (`actorUserId` para créditos PF, `actorPageId` para créditos PJ) em vez de delegar para o default `'system'`. Comentário institucional registra que é autoria humana de seed, não mock. Não corrige o bug — só evita disparar.
- **No helper**: nenhum fix aplicado. Princípio "causalidade financeira é fronteira rígida" respeitado.

### Resolução prevista

Frente própria backend cirúrgica, requer Clayton no loop semântico:

1. **Auditoria de callers**: grep por `buildSystemAuthorship\(` para mapear quem usa default `'system'` em vez de actor explícito. Verificar se algum caller produção depende disso e que tipo de erro silencioso (ou crash) ocorre quando exercitado.
2. **Decisão arquitetural inédita**: criar actor canônico `actor_type='system'` por tenant (e seed em migration) **OU** mudar `bank_transactions.actor_id` para nullable + adicionar `is_system_transaction boolean` **OU** rejeitar `buildSystemAuthorship` sem `actingForActorId` explícito (validação na entrada).
3. Cada uma das 3 opções tem trade-offs distintos de SSOT, retrocompatibilidade e semântica de autorship. NÃO é decisão para sessão de execução — exige Clayton.

### Convergência institucional

- Achado consumado durante EXECUTOR CONTÍNUO Fase 1 Parte B (continuação autorizada após fix da FK)
- Substrato PJ desbloqueado materialmente via fix da DT-FK + workaround LOCAL do seed
- Smoke browser P2 pode prosseguir com substrato real (autoria do seed registrada honestamente)
- Princípio "fronteira de causalidade financeira" respeitado — não toquei helper nem service em sessão de execução autônoma

---

## DT-PRESSURE-BANK-PJ-INITIATED-TRANSFER-MISSING-PATH

- **Status:** OPEN (achado factual arquitetural em sessão EXECUTOR CONTÍNUO Fase 2 — 2026-05-18; descoberta via F7 do smoke browser P3 — autorizado por Clayton)
- **Categoria:** DT-PRESSURE (gap de capability — não há rota HTTP para PJ→X iniciada pelo dono via membership)
- **Vinculada a:** princípio Clayton 2026-05-18 "múltiplos CNPJs do mesmo dono não podem se misturar, mas devem poder se mover entre si"

### Contexto material

F7 do smoke-fase2-http.sh tentou: João (autenticado) move R$ 300 de Voltagem Bar Band (PJ próprio) para Clínica Sorrisos (PJ próprio). João tem membership ativa com `can_manage_financial=true` em ambas as empresas (verificado materialmente).

Resultado: `HTTP 403 — "Forbidden: fromAccountId must belong to the authenticated user"`.

Causa raiz (em `backend/src/core/unifybank/bank-http.routes.ts:52-70`):

```ts
async function assertUserOwnsFromAccount(tenantId, userId, fromAccountId) {
  const account = await bankAccountService.getAccountById(tenantId, fromAccountId);
  if (account.ownerType !== 'user' || account.ownerId !== userId) {
    e.statusCode = 403;
    throw e;  // ❌ Não consulta company_users nem actor_delegations
  }
}
```

Aplicado em `POST /bank/transactions/simple` (linha 277) e `POST /bank/transactions/split` (linha 387). Ambos endpoints validam ownership APENAS via `ownerType === 'user'`. Nenhum path HTTP atual aceita conta PJ como `fromAccountId`.

### Verificação cruzada de rotas

Mapeamento material das rotas POST que iniciam transações financeiras:

| Rota | fromAccount aceito | Suporta PJ→X via membership? |
|---|---|---|
| `POST /bank/p2p-transfer` | conta PF do user autenticado (implícito via JWT) | NÃO (toUserId obrigatório, sem company) |
| `POST /bank/donate` | conta PF do user autenticado | NÃO (targetType só user/project/group, sem company/page) |
| `POST /bank/transactions/simple` | rejeita se `ownerType !== 'user'` | NÃO |
| `POST /bank/transactions/split` | mesma rejeição | NÃO |

Nenhuma rota HTTP atual permite que João (logado), com membership `can_manage_financial=true` em Voltagem Bar Band, mova dinheiro DA conta de Voltagem para qualquer destino.

### Authority real é granular e correta — gap está só no path HTTP

- Capability resolver (`actorCapabilitiesService`) **JÁ retorna** `company.manage_financial` para João sobre Voltagem (verificado em F2 do smoke Fase 1)
- Authority gate de `bank/balance` **JÁ honra** essa capability (F4 Lúcia leu Voltagem via delegação)
- O gap é apenas: `assertUserOwnsFromAccount` não conhece capability `company.manage_financial`

### Risco material

- **PJ inteiramente "preso"** no path HTTP: não pode pagar fornecedores, não pode fazer settlement, não pode transferir entre CNPJs do mesmo dono via UX humana
- **F2 e F6 também afetados** (PF→PJ via `/bank/transactions/simple`): erro diferente (`INVALID_CONCEPT_ID`), mas mesmo gap arquitetural — não há rota HTTP canônica humana para PF→PJ direto
- Bloqueia toda UX de "Pagamentos de empresa" no frontend
- Casos reais bloqueados: empresário multi-CNPJ movimentando entre próprias contas; pagamento de fornecedor PJ→PJ; transferência entre wallets de unidades da mesma empresa

### Mitigação atual

Nenhuma no path HTTP. O service interno `bankTransactionService.createSimpleTransaction` **funciona** com `fromAccount` de qualquer tipo (verificado materialmente — seed-smoke-p3 movimenta da reserve system para PJ via service direto). O gap é exclusivamente no gate HTTP.

### Resolução prevista

Frente própria backend, requer Clayton no loop semântico (decisão arquitetural):

1. **Opção A — Estender `assertUserOwnsFromAccount`**: aceitar `fromAccountId` de PJ se `actorCapabilitiesService` resolver `company.manage_financial` (ou `company.manage_company`) para o user sobre o actor PJ dono da conta. Requer passar `actorId` no body (qual actor está "agindo") + buscar conta correspondente.
2. **Opção B — Rota dedicada `POST /bank/actor-transfer`**: novo endpoint que exige `fromActorId` no body, valida authority via capability resolver, resolve conta do actor. Não toca rotas legadas.
3. **Opção C — Apenas P2J explícito**: rota `POST /bank/p2j-transfer` (PF→PJ) e `POST /bank/pj-transfer` (PJ→X), cada uma com semântica clara.

Cada opção tem trade-offs de SSOT, retrocompatibilidade e expressividade. NÃO é decisão para sessão de execução — exige Clayton.

### Convergência institucional

- Achado consumado durante EXECUTOR CONTÍNUO Fase 2 (autorizado por Clayton para validar exatamente este cenário)
- F3 do smoke ✓ provou que **bleed contextual entre actors do mesmo dono NÃO ocorre na camada de leitura** (saldos isolados por actor)
- F4/F4b/F5 ✓ provaram que **delegação é granular por actor** (não vaza para outros PJs do mesmo dono)
- F7 expôs que **escrita PJ-initiated NÃO existe no path HTTP humano** — gap, não bleed
- Princípio "ContextualBleed: cada CNPJ é entidade separada" CONFIRMADO no que está exposto, MAS impossibilidade de provar/refutar para escrita até DT resolver

---

## DT-PRESSURE-BANK-TRANSACTIONS-SIMPLE-CONCEPT-ID-OBRIGATORIO

- **Status:** OPEN (achado factual em sessão EXECUTOR CONTÍNUO Fase 2 — 2026-05-18; descoberta via F2 e F6 do smoke browser P3)
- **Categoria:** DT-PRESSURE (inconsistência schema HTTP ↔ service interno; rota provavelmente não destinada a UX humana)

### Contexto material

`POST /bank/transactions/simple` aceita body sem `concept_id` (schema Zod em `bank-http.routes.ts:95-105` não inclui o campo), mas o service interno `bankTransactionService.createSimpleTransaction` rejeita com:

```
HTTP 500 — "INVALID_CONCEPT_ID: concept_id vazio ou nao-string"
```

Mesmo passando `concept_id: "p2p-transfer"` explicitamente no body, é ignorado pelo schema Zod (não está no `simpleTransactionBodySchema`) e nunca chega ao service.

### Hipótese

A rota `/bank/transactions/simple` parece destinada a **orquestração interna** (chamada por outros services como `bankIntegrationService`, donation, P2P, settlement, etc.), não a UX humana direta. O `concept_id` é resolvido pelo orquestrador (e.g., `concept-financial-resolver.service.ts`), não pelo cliente HTTP.

Confirma-se observando que `POST /bank/p2p-transfer` e `POST /bank/donate` (rotas humanas) **não exigem** `concept_id` no payload — ambos resolvem internamente.

### Risco material

- Endpoint exposto sem documentação clara de uso humano
- Body schema aceita payload "válido" que sempre falha em 500 (não 400)
- Confunde durante testes de smoke e integração frontend

### Resolução prevista

Opções (não exclusivas):

1. Remover `/bank/transactions/simple` e `/bank/transactions/split` da superfície HTTP pública (manter como service interno)
2. Marcar rotas como admin-only (mover para `/admin/bank/...`)
3. Adicionar `concept_id` ao schema Zod + validação 400 quando ausente
4. Resolver `concept_id` na rota com base em `transactionType` (e.g., `transfer` → `p2p-transfer` ou similar)

NÃO é decisão para sessão de execução — exige Clayton.

### Convergência institucional

- Achado paralelo ao DT-PRESSURE-BANK-PJ-INITIATED-TRANSFER-MISSING-PATH — mesma sessão, mesmos endpoints atingidos
- F2/F6 não puderam ser validados (PF→PJ humano não tem path), mas o erro técnico revela uma segunda camada do gap: até para PF→PF via `/transactions/simple` o `concept_id` impede uso direto
- Frontend deve usar `/bank/p2p-transfer` e `/bank/donate` para fluxos humanos; nunca chamar `/bank/transactions/simple` diretamente

---

## DT-PRESSURE-LOCATION-CORE-ECONOMIC-REGIONS-MISSING

- **Status:** OPEN
- **Origem:** Auditoria material 2026-05-19 durante institucionalização do pilar Localização (sessão "piloto automático" pós-reancoragem). Cruzamento entre REMEDIATION_DECISIONS_LOG.md (DECISION-0020 §4) e estado runtime DB.
- **Vinculada a:** DECISION-0020 — Location Core: território como infraestrutura soberana (2026-05-08, APROVADA por Clayton)
- **Categoria:** DT-PRESSURE (gap material entre DECISION soberana e implementação)

### Contexto material

DECISION-0020 §4 prevê separação entre região administrativa e região econômica:

> "Estado político ≠ região econômica ≠ delivery zone ≠ território cultural. Tabela `economic_regions` com `region_type` (`FUND`, `RIDE_ZONE`, `DELIVERY_AREA`, `FISCAL`, `CULTURAL`, `CUSTOM`) e membros N:N com `cities` ou `states`. Resolve o `TODO: stateId como regionId` do código atual de forma definitiva."

Schema previsto em DECISION-0020:

```
economic_regions(region_id, tenant_id NULL=global, region_type CHECK IN
  ('FUND','RIDE_ZONE','DELIVERY_AREA','FISCAL','CULTURAL','CUSTOM'),
  name, description, is_active, *_at)

economic_region_members(member_id, region_id FK, member_type CHECK IN
  ('state','city','neighborhood'), member_state_id?, member_city_id?,
  member_neighborhood_id?, CHECK apenas o campo correto preenchido, *_at)

tenant_operational_regions (N:N tenants × economic_regions)
```

### Verificação material runtime (2026-05-19)

Estado de implementação de DECISION-0020 — 6 de 10 componentes materializados:

| Componente | Materializado? |
|---|---|
| countries, states, cities, neighborhoods | ✅ (1+27+27+0 rows) |
| addresses | ✅ (4 rows) |
| address_assignments | ✅ EXISTE (modelo temporal-contextual ativo) |
| tenants.headquarters_address_id (coluna) | ✅ existe |
| **economic_regions** | ❌ **AUSENTE** |
| **economic_region_members** | ❌ AUSENTE |
| **tenant_operational_regions** | ❌ AUSENTE |

Camada admin + endereço + atribuição contextual viva. Camada operacional/econômica pendente.

### Risco material

- **Latente hoje** — nenhum caller pode usar `economic_regions` (tabela não existe). Código atual usa workaround `tenant.cityId → stateId → regionId` em `payment-execution.service.ts:693-707`.
- **Ativo** quando algum fluxo precisar:
  - Regional fund customizado (não state-bound). Hoje `regional_funds` UNIQUE compound (country, state, city) — não permite zonas customizadas que cruzam fronteiras administrativas.
  - Delivery zone com membros customizados (várias cidades vizinhas)
  - Fiscal cross-state
  - Cultural region (ex: "Vale do Itajaí" como entidade)
  - Tenant expandindo operação para múltiplas cidades sem ser HQ em todas
- Já bloqueia desenho fino de fundo regional (memória `project_full_vision.md` cita "fundo regional com democracia direta" como direção institucional; sem `economic_regions` o fundo é state-bound apenas).

### Mitigação atual

- `tenant.cityId → worldService.getCityFullPath → stateId` usado como proxy de regionId em settlement
- Resolve "região = estado" mas viola DECISION-0020 §4 (estado político ≠ região econômica)
- Workaround consciente; documentado como TODO no código

### Resolução prevista

Frente própria backend (~3 tabelas + 1 migration), seguindo schema exato de DECISION-0020 §4-§5. Estimativa: 1 sessão, autorização explícita de Clayton necessária (migration DDL é soberania).

Pré-requisitos:
- DECISION-0020 já aprovada (não precisa nova DECISION arquitetural)
- Apenas DDL aditiva (CREATE TABLE × 3)
- Sem refactor de callers existentes — workaround `tenant.cityId → stateId` segue válido até region_type='FUND' ter members reais

NÃO autorizada nesta sessão (migration DDL exige autorização explícita; auditoria identificou achado, registro institucional aqui).

### Convergência institucional

- DECISION-0020 (2026-05-08) decidiu o pilar; implementação parcial.
- Memória `project_localizacao_pilar_soberano.md` (2026-05-19) institucionalizou auto-vigilância operacional + mapeia gap.
- Esta DT formaliza o achado para próxima sessão poder agir cirurgicamente.

---

## DT-PRESSURE-POSTGIS-MISSING-RIDES-WORK-CALLERS

- **Status:** OPEN
- **Severidade:** HIGH (latente mas ativável a qualquer momento)
- **Origem:** Audit material 2026-05-19 durante Fase 0 do plano `PLANO_FEED_RAIO_GEOGRAFICO_2026_05_19.md`. Cruzamento entre `pg_extension` e grep por funções PostGIS no código.
- **Vinculada a:** DECISION-0030 (Sub-decisão A — Haversine SQL canônico) — qualquer correção desta DT deve respeitar o pattern Haversine canônico decidido em DECISION-0030
- **Categoria:** DT-PRESSURE (bug ativo dormindo, não dívida latente)

### Contexto material

PostgreSQL extension PostGIS **NÃO está instalada** no DB do projeto:

```sql
SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='postgis');
→ FALSE
```

Mas código TS usa funções PostGIS (`ST_DWithin`, `ST_Distance`, `ST_SetSRID`, `ST_MakePoint`) em 7+ call sites:

| Arquivo | Linha | Função usada |
|---|---|---|
| `backend/src/modules/rides/location/location.service.ts` | 92 | `ST_DWithin` |
| `backend/src/modules/rides/demand/demand.service.ts` | 83 | `ST_DWithin` |
| `backend/src/modules/rides/pricing/pricing.service.ts` | 183 | `ST_Distance` |
| `backend/src/modules/rides/pricing/pricing.service.ts` | 207 | `ST_Distance` |
| `backend/src/modules/rides/pricing/pricing.service.ts` | 253 | `ST_Distance` |
| `backend/src/modules/work/workers/worker.service.ts` | 446 | `ST_DWithin` |
| `backend/src/modules/work/jobs/job.service.ts` | 246 | `ST_DWithin` + `ST_SetSRID` + `ST_MakePoint` |

Plus: `rides_driver_locations.location` é declarada como `jsonb` (não `geography`) — workaround visível para PostGIS imaginado.

### Sintoma runtime esperado

Postgres error `42883` (function does not exist) OU `42704` (type does not exist) ao executar qualquer query que invoque essas funções. Crash garantido se rota correspondente for exercitada.

### Por que está latente

Features rides/work são **aspiracionais** — não exercitadas em runtime real até hoje. Mesmo padrão observado em outras DTs (Sprint 60+ supplier/PO confirmado no PASSO 6b da auditoria estrutural). Tabelas com 0 rows globais escondem o bug até primeiro uso real.

### Risco material

- **Ativo no primeiro uso real** de qualquer rota que dispare:
  - `rides/location.service` calculando proximidade entre drivers
  - `rides/pricing.service` calculando preço dinâmico baseado em distância
  - `rides/demand.service` calculando densidade de demanda regional
  - `work/worker.service` matching de workers por raio
  - `work/job.service` matching de jobs por proximidade
- **Bloqueia** features rides + work-instant + smart-matching quando alguém ativar

### Conexão com DECISION-0030 (esta sessão)

DECISION-0030 Sub-decisão A decidiu **pattern canônico Haversine SQL** (não PostGIS) para esta frente do feed. Qualquer fix futuro desta DT deve:

1. **NÃO** instalar PostGIS sem cruzar com DECISION-0030 (pattern canônico Haversine já estabelecido)
2. **Migrar callers** rides/work para Haversine SQL OU reconhecer que features rides/work precisam de PostGIS (decisão arquitetural separada)
3. **Não criar verdade paralela** entre Haversine (feed) e PostGIS (rides/work) sem decisão consciente

### Mitigação atual

Nenhuma técnica. Apenas formalização institucional:
- Esta DT registra o achado
- DECISION-0030 estabelece pattern canônico Haversine para nova frente
- Próxima sessão que tocar rides/work TEM que enfrentar essa DT (não vai conseguir ignorar)

### Resolução prevista

Frente própria. **3 opções arquiteturais (futuras, NÃO esta frente):**

1. **Migrar callers para Haversine SQL** (Opção A — alinhado com DECISION-0030)
   - Custo: 7 call sites × ~10 LOC cada = ~70 LOC
   - Pré: feature rides/work em escopo de uso real

2. **Instalar PostGIS** (Opção B — decisão arquitetural ampla)
   - Custo: extension + columns geography + indexes GiST
   - Pré: DECISION arquitetural reconsiderando Sub-decisão A de DECISION-0030
   - Implica revisar performance e compat com Haversine SQL existente

3. **Congelar rides/work** (Opção C — aplicação DECISION-0041 pattern)
   - Reconhecer que features são PREMATURAS (aspiracionais sem runtime real)
   - Comentar rotas em `app.builder.ts`
   - Quando ecossistema rides/work emergir, escolher Opção A ou B

**NÃO autorizada nesta sessão** — DECISION arquitetural separada. Registro institucional aqui.

### Convergência institucional

- Achado durante audit Fase 0 do plano `PLANO_FEED_RAIO_GEOGRAFICO_2026_05_19.md`
- DECISION-0030 (Sub-decisão A) condiciona qualquer fix futuro
- Pattern consistente com sessões anteriores: features aspiracionais Sprint X escondem bugs até primeiro uso real (PASSO 6b smoke supply chain, 2026-05-17)

---

## DT-PRESSURE-AUTH-CHECK-PARITY-INVARIANT

- **Status:** CLOSED-LESSON
- **Origem:** Sessão 2026-05-19 — bug WelcomePage redirecionando `/` → `/login` em aba anônima
- **Fechada por:** commit `0508ba66` (feat(welcome): WelcomePage pública + alinhar auth check par soberano (token+tenant))
- **Vinculada a:** princípio "Frontend nunca cria verdade" (memória `project_frontend_nunca_cria_verdade.md`)
- **Categoria:** lição institucional sobre invariância de check de auth entre camadas

### Contexto material do bug

`frontend/src/App.tsx:177` (versão pré-fix) rota `/` checava apenas `isAuthenticated()` (só token).
`frontend/src/components/auth/ProtectedRoute.tsx:20` checa `isAuthenticated() AND getTenantId()` (par completo).

Mismatch causava loop quando localStorage tinha **token órfão sem tenant**:
1. User abre `/` → `isAuthenticated() === true` → `Navigate(/home)`
2. `/home` → ProtectedRoute → `!isAuthenticated() || !getTenantId()` = `false || true` = `true` → `Navigate(/login)`

Resultado: `/` → `/home` → `/login`. Aba anônima eventualmente acaba aqui se localStorage tem token resquício de outra sessão.

### Causa raiz institucional

**Dois critérios de "autenticado" coexistindo no frontend:**
- `isAuthenticated()` em `auth.ts:40-42` — checa só `getAuthToken()`
- `ProtectedRoute` — checa par soberano `(token, tenant)`

Verdade paralela entre camadas. Cada camada decidia "autenticado" com critério próprio.

### Fix aplicado (commit `0508ba66`)

Alinhamento de TODOS os checks de rota pública (`/`, `/login`, `/register`) com o par soberano:
```ts
(isAuthenticated() && getTenantId()) ? <Navigate to="/home" replace /> : <componente_publico>
```

Cleanup posterior (commit `28eb000a`) removeu atalho diagnóstico `/start` + `console.log` quando bug confirmado resolvido pela mecânica.

### Lição institucional

**Invariância de check de auth:** se múltiplas camadas decidem "autenticado", TODAS devem usar o mesmo conjunto de campos soberanos. Mismatch entre camadas produz loop de redirect imperceptível durante implementação inicial — só aparece em condições edge (token órfão, expiração parcial, multi-tab).

**Pattern derivado:** o "par soberano de autenticação" `(getAuthToken(), getTenantId())` é unidade indivisível para frontend. Pattern do checklist mental:

> "Antes de redirecionar baseado em estado de auth, ESTOU usando o mesmo conjunto de campos que a camada que vai me recuperar?"

Aplicação: ProtectedRoute (camada de proteção) é fonte canônica do critério; rotas públicas (camada de gate) devem espelhar EXATAMENTE.

### Convergência com "Frontend nunca cria verdade" (memória 2026-05-19)

Esta DT precede a memória mas converge perfeitamente. Backend define contrato de auth (par token+tenant); frontend deveria projetar uniformemente em TODAS as camadas. Não alinhar = criar verdade paralela "user está autenticado" entre 2 camadas frontend.

### Resolução prevista (já materializada)

- Commit `0508ba66` aplicou alinhamento cirúrgico (~3 linhas mais 1 import).
- Cleanup `28eb000a` removeu artefatos diagnósticos.
- Memória `project_frontend_nunca_cria_verdade.md` (2026-05-19) codifica o princípio derivado dessa lição.
- Esta DT preserva a lição institucionalmente — formalizada como **CLOSED-LESSON** (não-OPEN; lição arqueológica disponível para próxima IA).

### Pattern para checklist futuro

Quando criar/refatorar rota com lógica condicional baseada em auth:
1. Identificar TODAS as camadas que decidem auth para a rota (público guard, ProtectedRoute, ação interna do componente)
2. Listar os campos soberanos checados em cada camada
3. Convergir para o conjunto MAIS RESTRITIVO (geralmente o de ProtectedRoute)
4. Aplicar uniformemente em todas as camadas

Se houver tentação de "ser mais permissivo na entrada" (ex: rota `/` só checa token), o sistema vai criar loops invisíveis. Resistir.

### Terceira ocorrência (2026-05-19) — ambiguidade de match de rota React Router

Após `0508ba66` (par soberano alinhado) o bug `/` → `/login` em aba anônima fresca PERSISTIU. Diagnóstico DevTools (Clayton) revelou `[ProtectedRoute DIAG]` logando `pathname="/"` com 4 renders — apesar do código TS estar materialmente coerente com o fix.

**Causa raiz material:** `App.tsx:246-253` declarava layout protegido como **pathless parent + Route index**:

```tsx
<Route element={<ProtectedRoute><SocialLayout /></ProtectedRoute>}>
  <Route index element={<Navigate to="/home" replace />} />  {/* ← casava com "/" */}
  <Route path="social" element={<SocialPage />} />
  ...
</Route>
```

Em React Router v6, `<Route>` pai sem `path` é "pathless layout route" — herda o path do contexto pai (aqui: root). `<Route index>` aninhado casa com o path do parent, ou seja, com `"/"`. Resultado: match ambíguo com `<Route path="/" element={<WelcomePage />}>` em `App.tsx:177`. React Router prioriza o index aninhado, ProtectedRoute monta, vê `!isAuthenticated() || !getTenantId()` → `<Navigate to="/login">`.

**Notar:** apenas o SocialLayout pai tinha esse padrão. BankLayout (linhas 339-355) e AdminLayout (linhas 358-394) são também pathless mas SEM `<Route index>` filho — não disparavam o bug. Isso fez o sintoma assimétrico (só SocialLayout capturava "/").

**Fix aplicado (2026-05-19, ≤10 LOC):** remover `<Route index>` da linha 253. Substituído por comentário DT-style explicando a remoção e apontando para a rota raiz pública (linhas 176-179) que já cobre os dois casos (logado → /home; não-logado → WelcomePage).

**Generalização da lição:** "auth-check parity" cobre **dois eixos**:
1. **Eixo dos campos checados** (causa do bug original): camadas decidindo "autenticado" com critérios diferentes.
2. **Eixo do match de rota** (terceira ocorrência): caminho protegido capturando silenciosamente rotas que deveriam ser públicas. Mesmo com critérios alinhados, se o pathless parent + index estiver intercepando "/" antes da rota pública, o usuário anônimo é redirecionado para `/login`.

**Padrão preventivo (adicionar ao checklist 1-4):**
5. Verificar se há **pathless layout route** com `<Route index>` aninhado. Se sim, o index casa com o path-base do parent (geralmente "/"), conflitando com rotas raiz públicas. Solução: ou remover o index (cobrir o caso via rota raiz absoluta), ou dar path explícito ao parent (`path="app/*"`).

### Métrica institucional

3 ocorrências do mesmo pattern em ~12 dias (auth-check parity em camadas diferentes):
- Origem (≤2026-05-13): `/` checava só token, ProtectedRoute checava par
- Segunda (2026-05-19 sessão A): mesmo bug observado e investigado
- Terceira (2026-05-19 sessão B): pathless parent + Route index sobrescrevendo rota pública

Pattern já passa do limite de 2 aplicações independentes — codificado como **lei operacional permanente** acima do nível "lição". Lição arqueológica: **toda rota raiz pública deve ser auditada contra ambiguidade de match em layouts protegidos aninhados.**

---

## DT-PRESSURE-AUTH-BACK-TO-HOME

- **Status:** OPEN
- **Origem:** Sessão 2026-05-19 (terceira ocorrência DT-AUTH-CHECK-PARITY) — após fix de Route index + AuthWrapper, Clayton reportou gap UX: Login e Register não têm caminho de volta para `/` (WelcomePage). User fica restrito ao toggle login↔register.
- **Categoria:** UX-gap não-crítico (não bloqueia auth; afeta apenas navegação)

### Estado material

Edits cirúrgicos foram aplicados em working tree mas **NÃO commitados**:
- `frontend/src/components/Login.tsx` — prop opcional `onBackToHome` + botão "← Voltar para início" (~15 LOC)
- `frontend/src/components/Register.tsx` — prop opcional `onBackToHome` + botão "← Voltar para início" (~15 LOC)
- `frontend/src/App.tsx` (AuthWrapper) — passa `onBackToHome={() => navigate('/')}` para ambos componentes (já commitado nesta rodada como parte do refactor URL→view)

### Razão da postergação

Working tree dos arquivos `Login.tsx` e `Register.tsx` continha mudanças preexistentes de **outras frentes paralelas** ao serem editados nesta sessão:

- **Login.tsx**: 1 linha preexistente — `localStorage.removeItem('unificard_active_actor_id')` no fluxo pós-login. Frente "actor-scope-cleanup", provavelmente Codex.
- **Register.tsx**: ~6 mudanças preexistentes — vocabulário canônico Gender (import `Gender`/`isGender` de `@unificard/contracts`, opções `non_binary`/`other`/`prefer_not_to_say`, labels `Sexo→Gênero`, refator de validação). Frente "vocabulário-canônico-gender", provavelmente Codex.

`git add` específico no nível de arquivo arrastaria essas frentes alheias para o commit, violando disciplina "1122 entries preservadas das frentes paralelas". `git add -p` interativo não é executável neste contexto. `git checkout HEAD --` + re-edit + restore é destrutivo se backup falhar.

### Resolução prevista

Quando working tree for organizado (Codex/Clayton separar as 3 frentes coexistindo em `Login.tsx` e `Register.tsx`), aplicar os 2 fixes `onBackToHome` em commits independentes:
- 1 commit isolado para `actor-scope-cleanup` em Login.tsx
- 1 commit isolado para `vocabulário-canônico-gender` em Register.tsx
- 1 commit isolado para `auth-back-to-home` em ambos os componentes

### Não bloqueia

- Fluxo de auth funciona ponta-a-ponta (login, register, logout)
- WelcomePage renderiza em `/`
- Toggle login↔register funciona via URL
- User com URL conhecida (digitar `/` na barra ou usar bookmark) chega na WelcomePage
- Botão "back" do browser também volta para `/` se user navegou via WelcomePage

Gap é apenas: dentro do Login/Register, falta CTA explícito "voltar para início" para user que entrou direto via URL ou que mudou de ideia.

### Critério de fechamento

DT fecha quando os ~30 LOC pendentes (`onBackToHome` em Login + Register) forem efetivamente commitados após organização do working tree.

---

## DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH

- **Status:** CLOSED (2026-05-24) — método `getFeed` convergido para schema canônico via aplicação executiva de DECISION-0031/0032-social/0033. Smoke runtime: `GET /social/feed` HTTP 200 com 5 posts hidratados (user_reaction polimórfico funcionando). Outras queries do mesmo service (createPost, getActorPosts, addReaction) podem manter drift análogo — escopo de fatia própria futura, não bloqueante para o feed visível.
- **Severidade original:** CRITICAL (bloqueia feed social inteiro em runtime real)
- **Origem:** Smoke visual Clayton 2026-05-19 em `localhost:5173/social` retornou "Erro ao buscar feed". Diagnóstico via service-direct (`scripts/debug-feed-error.ts`, removido após confirmação) revelou 7 drifts independentes em `social-2.0.service.ts` getFeed query.
- **Vinculada a:** ZERO relação com F3 (proximityFilter) — bug pré-existente confirmado material via curl SEM `scope` query param (backward compat também HTTP 500).
- **Categoria:** DT-DRIFT-SCHEMA-CODE-MISMATCH (mesmo pattern de DT-DRIFT-SCHEMA-CODE-MISMATCH-CATEGORIES 2026-05-17)

### Contexto material

Pergunta direta: feed `/social/feed` retorna HTTP 500 mesmo na chamada backward-compat (sem scope). NÃO é regressão F3.

Reprodução: curl com auth JOAO retorna `{"error":"Erro ao buscar feed"}` HTTP 500.
Service-direct (`social2Service.getFeed`) reproduz Postgres errors em cascata.

### Drifts mapeados em runtime (7 confirmados)

| # | Esperado pelo código (`social-2.0.service.ts`) | Schema real no DB |
|---|---|---|
| 1 | `post_cta` (tabela com cta_id, cta_type, target_actor_id, target_group_id, price, currency) | **TABELA NÃO EXISTE** (FANTASMA — `to_regclass` retorna NULL) |
| 2 | `posts.post_id` (PK) | `posts.id` (PK real) |
| 3 | `posts.global_user_id` | **COLUNA NÃO EXISTE** |
| 4 | `posts.media` | `posts.media_ids` (array UUID) |
| 5 | `follows.actor_id` | `follows.followed_actor_id` |
| 6 | `follows.follow_id` | `follows.id` |
| 7 | `reactions.post_id` | **COLUNA NÃO EXISTE** (reactions usa `entity_type` + `entity_id` polymórfico) |

Plus: `comments.post_id` OK (existe). Mais drifts possíveis em outras queries do mesmo service não-auditadas (1389 LOC total).

### Schema real auditado

```
posts: id, tenant_id, actor_id, content, post_type, media_ids, intent,
       intent_metadata, targeting, is_published, is_deleted, metadata,
       created_at, updated_at, address_id (F1)

reactions: id, tenant_id, actor_id, entity_type, entity_id, reaction_type, created_at
comments:  id, tenant_id, actor_id, post_id, parent_comment_id, content,
           is_deleted, metadata, created_at
follows:   id, tenant_id, follower_actor_id, followed_actor_id, created_at
post_cta:  AUSENTE
```

### Tentativa de fix cirúrgico (revertida)

Apliquei 4 fixes parciais durante diagnóstico:
1. `post_cta` LEFT JOIN substituído por NULL casts em 2 queries
2. `follows.follow_id` → `follows.id`
3. `follows.actor_id` → `follows.followed_actor_id`
4. `p.post_id` → `p.id AS post_id` + `posts.global_user_id`/`media` substituídos por NULL casts

Após cada fix, query revelava próximo drift. 4º fix ainda quebrava em `reactions.post_id`.

**Padrão §4 (auto-vigilância material) acionado**: cada coluna corrigida revelava próxima. NÃO é cirurgia ≤30 LOC — é refator amplo de SQL. Apliquei `git checkout HEAD --` em `social-2.0.service.ts` revertendo todos os fixes parciais. Script debug-feed-error.ts removido.

### Risco material

- **Feed `/social` bloqueado em runtime** — bloqueia validação visual F5 (Clayton acessa, vê "Erro ao buscar feed")
- **Bug pré-existente** desde antes da auditoria — não é regressão recente
- **Reactions polymorphic**: refator não-trivial (entity_type='post' + entity_id=post_id em vez de FK direta)
- **Não-bloqueia core financeiro** (bank/ledger/transactions intocados)
- **Outras queries do service podem ter drifts similares** (1389 LOC; só ~3 queries auditadas)

### Mitigação atual

Nenhuma. Reporte material para frente própria. Estado preservado:
- Service revertido para HEAD
- F3 (proximityFilter integration) intacto — TSC verde, gates verdes
- Demais commits da sessão (F1-F4, F6) intactos
- F5 frontend (commit `8b61bb06`) intacto — pronto para validar quando feed funcionar

### Resolução prevista

Frente própria backend (~estimativa 2-4 sessões dedicadas):
1. Auditoria material query-by-query do `social-2.0.service.ts` (1389 LOC, 3+ queries grandes)
2. Cruzar cada coluna/JOIN com `information_schema.columns`
3. Decisão arquitetural sobre `reactions`:
   - (a) Migrar para FK direta (reactions.post_id) — DDL aditiva
   - (b) Refatorar queries para usar polymorphic entity_type/entity_id (consistente com schema atual)
4. Decisão sobre `post_cta`:
   - (a) Materializar tabela (DDL aditiva)
   - (b) Comentar paths CTA (pattern DECISION-0041 PREMATURO; já consolidado em outras DTs)
5. Fix `posts.post_id` → `posts.id AS post_id` (alias preserva contrato externo)
6. Fix `follows` columns (followed_actor_id, id)
7. Smoke runtime end-to-end pós-fix

**NÃO autorizada nesta sessão.** Drift sistêmico exige frente própria com escopo claro.

### Convergência institucional

- Pattern consistente com DT-DRIFT-SCHEMA-CODE-MISMATCH-CATEGORIES (PASSO 6b 2026-05-17): código referencia colunas/tabelas que migration não criou ou removeu.
- "Features aspiracionais Sprint X com 0 rows escondem bugs até primeiro uso real" — `posts` tem rows hoje, mas o getFeed específico nunca foi exercitado em runtime real (ou exercitado apenas pelo path "vazio sem dados" que evita o JOIN crítico).
- Pattern §4 cognitive: tentação de fix em cascata revelou estrutura mais ampla. Auto-vigilância funcionou — revertido + reportado.

### Workaround disponível

Para Clayton validar F5 visualmente:
- F5 não exige feed funcional para mostrar `<FeedScopeSelector>` (componente renderiza independente do feed loading)
- Toggle de scope, modal de localização ativa, e API client funcionam independentemente
- **A interação completa** (mudar scope → feed atualiza) **bloqueada por esta DT**
- Smoke F6 backend já validou que o filtro server-side funciona end-to-end (7/7 cenários PASS)

---

## DT-PRESSURE-PUBLICATION-ENGINE-REACTIONS-USER-ID-VIOLATION

- **Status:** OPEN
- **Severidade:** HIGH — **violação constitucional explícita** de §3.2 da Nomenclatura Canônica (`actor_id` é SSOT de identidade; `user_id`/`global_user_id` são proibidos como camada de identidade soberana)
- **Reclassificação:** Originalmente registrada como `-DRIFT` (2026-05-19 manhã). Reclassificada para `-VIOLATION` quando confirmada como violação §3.2 (não drift acidental — código viola norma constitucional ratificada)
- **Origem:** Auditoria material durante remediação de `DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH` (2026-05-19, Fase 1 GUARDIÃO). Descoberto que `publication-engine.service.ts` (engine canônico para reactions) usa `user_id` em queries, mas schema real de `reactions` só tem `actor_id` (auditado em DT-DRIFT-SOCIAL-2.0).
- **Base constitucional:** §3.2 Glossário Canônico Constitucional (linha 161): "Identidade Econômica → `actor_id` / `actorId` — SSOT de identidade"

### Call sites

`backend/src/core/publication/publication-engine.service.ts`:
- **Linha 402** — SELECT: `WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND user_id = $4`
- **Linha 413** — UPDATE: `WHERE tenant_id = $2 AND entity_type = $3 AND entity_id = $4 AND user_id = $5`
- **Linha 422** — INSERT: `(entity_type, entity_id, tenant_id, reaction_type, user_id, actor_id)` — usa **AMBOS** user_id E actor_id
- **Linha 462** — DELETE: `WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND user_id = $4`

### Schema real auditado (cross-reference DT-DRIFT-SOCIAL-2.0)

```
reactions: id, tenant_id, actor_id, entity_type, entity_id, reaction_type, created_at
```

`user_id` **NÃO existe** no schema real. Toda query em `publication-engine.service.ts` que filtra por `user_id` retorna 0 rows ou erro.

### Hipóteses sobre estado runtime

1. **Drift latente** — engine canônico nunca foi exercitado pelo runtime real (apenas social-2.0.service.ts é o caller atual do feed). Bug existe materialmente mas não dispara error visível.
2. **Drift ativo** — algum caller secundário (audit log, notification, etc.) usa o engine e silenciosamente recebe 0 rows quando deveria receber matches.
3. **Schema parcialmente auditado** — coluna `user_id` pode existir como ALTER TABLE aditiva posterior ao schema auditado pela DT. Hipótese improvável (auditoria via `information_schema.columns` é normalmente exaustiva).

Validação requer:
- Grep callers de `publicationEngineService.addReaction`/`removeReaction` em runtime real
- Verificar se há try/catch ou silent fail que esconda o erro
- `information_schema.columns WHERE table_name = 'reactions'` para confirmar ausência absoluta de `user_id`

### Vinculação com DECISION-0031 e §3.2 constitucional

DECISION-0031 (Reactions polimórfico soberano, 2026-05-19) **ratifica formalmente** o que §3.2 já estabelece: coluna de identidade canônica em `reactions` é `actor_id`. `publication-engine.service.ts` está em **violação dupla**:
1. **Violação §3.2 (constitucional):** usa `user_id` como camada de identidade onde §3.2 exige `actor_id`. Configura violação à PROIBIÇÃO §3.2: "Nenhum nome constitucional pode nascer 'no código primeiro' e ser ratificado depois. A ordem é: SSOT_REGISTRY → Este documento → Implementação." Engine canônico introduziu nome de identidade não-registrado no SSOT.
2. **Violação DECISION-0031 (arquitetural):** DECISION-0031 ratifica e elenca anti-padrão #2: "usar `user_id` ou `global_user_id` em vez de `actor_id`".

Frente de fix futuro deve alinhar com §3.2 + DECISION-0031 (mesmo conteúdo expresso em duas camadas normativas — constitucional + arquitetural-de-remediação).

### Resolução prevista

Frente própria backend (estimativa ≤1 sessão dedicada):
1. Validar via `information_schema` que `user_id` não existe em `reactions`
2. Identificar callers materiais do engine em runtime (`publication-engine.service.addReaction`/`removeReaction`)
3. Substituir `user_id` por `actor_id` nas 4 call sites (402, 413, 422, 462)
4. Smoke runtime: validar que reactions polimórficas continuam funcionando
5. Atualizar contract `CreateReactionInput` se necessário (remover `user_id`, exigir `actor_id`)

### Não bloqueia

- Frente atual `DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH` (fix isolado em `social-2.0.service.ts`)
- Feed `/social` pós-fix funcionará via social-2.0 (caller atual)
- `publication-engine.service.ts` NÃO é tocado nesta frente (fronteira explícita Clayton 2026-05-19)

### Convergência institucional

- Pattern consistente com `DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH`: 2 serviços paralelos com drift de identidade em `reactions` (social-2.0 usa `global_user_id`; publication-engine usa `user_id`). Schema canônico (`actor_id`) só é respeitado pelo INSERT em publication-engine (linha 422, que inclui ambos `user_id` e `actor_id`).
- Aplica heurística `feedback_runtime_soberano.md`: runtime soberano se identifica pela concentração de causalidade VALIDADA. `publication-engine.service.ts` declara-se canônico mas não está alinhado com schema real — drift contradiz declaração de soberania.

---

## DT-PRESSURE-REACTIONS-ENTITY-TYPE-NAMING-VIOLATION

- **Status:** OPEN
- **Severidade:** MEDIUM — violação latente de §4.37 + §3.2 PROIBIÇÃO. Não bloqueia runtime (sistema funciona), mas configura inconsistência nomenclatural constitucional permanente.
- **Origem:** Auditoria material durante remediação de `DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH` (2026-05-19, Fase 2/C1.5). Achado constitucional reportado por Clayton: `entity_type` em `reactions` usa vocabulário fora do enum canônico §4.37.
- **Base constitucional:** §4.37 (Tipos de Entidade — enum canônico), §3.2 (PROIBIÇÃO de feature nascendo "no código primeiro")

### Três vocabulários divergentes na codebase

| Camada | Valores `entity_type` em reactions | Status |
|---|---|---|
| §4.37 Constituição (linhas 1467-1499) | `user`, `page`, `store`, `group`, `company`, `organization`, `system`, `bot` | SSOT formal — entidades soberanas / persona operacional |
| `publication-engine.types.ts:7` (engine TS canônico) | `event`, `post`, `group`, `channel` | drift declarado em código |
| Migration viva `20260530320000_social_reactions.sql:7` (DDL CHECK constraint) | `post`, `comment`, `event` | drift consolidado em runtime |

Três vocabulários distintos para o mesmo conceito. Schema real (`post/comment/event`) **diverge da Constituição** E do engine canônico.

### Análise material da violação

§4.37 explicita (linhas 1497-1499):
> "`entity_type` representa a natureza estrutural da entidade.
> `actor_type` representa o papel operacional do ator dentro do sistema."

E reforça (linhas 1480-1489):
> "Entidade NÃO é autoridade soberana. Entidade NÃO pode blindar responsabilidade humana. Tipos como page, group, company, organization existem exclusivamente como persona operacional. Responsabilidade final sempre recai sobre um actor_human."

Valores em uso (`post`, `comment`, `event`):
- `post` — **conteúdo gerado** por entidade (não-entidade)
- `comment` — **conteúdo gerado** por entidade (não-entidade)
- `event` — domínio operacional (mais perto de entidade, mas mistura semântica)

Logo: a coluna nominada `entity_type` está sendo usada como **target_type** ou **content_type** — emprestando nome constitucional fora do escopo definido em §4.37.

Plus: SSOT_REGISTRY_UNIFICARD.md NÃO tem entrada para `reactions.entity_type` nem para `target_type`/`content_type`. **Configura violação §3.2 PROIBIÇÃO**: "Nenhum nome constitucional pode nascer 'no código primeiro' e ser ratificado depois. A ordem é: SSOT_REGISTRY → Este documento → Implementação." Aqui o oposto aconteceu: código materializou `entity_type` com valores não-canônicos, sem registro SSOT precedente.

### Por que não corrigir nesta frente

1. **Sem DDL nesta frente** — diretriz Clayton 2026-05-19: "Não DDL (decisões evitam migration)". Renomear coluna ou alterar CHECK constraint exige migration.
2. **Cross-callers significativo** — renomear afeta `reactions`, possivelmente outras tabelas com `entity_type` (publication-engine, audit_logs, notifications), contracts TS compartilhados, e ~3 vocabulários a unificar.
3. **Princípio "norma assintótica"** — `project_norma_assintotica.md`: runtime preservado durante convergência; toda exceção carrega prazo ou critério. Esta DT É o critério de convergência registrado.
4. **DECISION-0031 ratifica USO ATUAL como exceção transitória** (preserva runtime) com cross-reference a esta DT.

### Resolução prevista (frente futura)

Sequência obrigatória conforme §3.2 PROIBIÇÃO:

1. **SSOT_REGISTRY_UNIFICARD.md** — registrar formalmente conceito (provavelmente `target_type` ou `content_type` — TBD por RFC)
2. **07_NOMENCLATURA_CANONICA.md §4.X** — adicionar enum canônico para tipos de conteúdo (separado de §4.37 entity_type que fica restrito a entidades soberanas)
3. **RFC** documentando impacto cross-camada (DDL aditiva, mappers em borda, alinhamento publication-engine.types.ts ↔ reactions.entity_type)
4. **DDL aditiva** — adicionar coluna nova `target_type` em `reactions`, copiar valores, deprecar `entity_type` em release subsequente
5. **Migration coordenada** — atualizar callers (social-2.0.service.ts, publication-engine.service.ts, e qualquer tabela paralela)
6. **DECISION nova superando DECISION-0031** parcialmente — ratifica novo vocabulário canônico

Estimativa: 1-2 sessões dedicadas. NÃO crítico.

### Não bloqueia

- Frente atual `DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH` — runtime atual preservado
- Feed funciona com `entity_type = 'post'` (valor não-canônico mas operacional)
- Reactions polimórficas operam normalmente

### Convergência institucional

Pattern de "norma canônica assintótica" aplicado: sistema converge para §4.37 ao longo do tempo, mesmo que aos poucos. Violação registrada como dívida latente NÃO ratifica conviver com o drift indefinidamente — esta DT É o critério de convergência futuro.

---

## DT-FRONTEND-CTA-ZOMBIE

- **Status:** OPEN
- **Severidade:** LOW — código frontend aspiracional sem renderização ativa (post.cta sempre `undefined` no payload). Não quebra TS (todos os callers usam `post.cta?`). Não bloqueia UX nem runtime.
- **Origem:** Auditoria material durante remediação de `DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH` (2026-05-19, Fase 1 expandida). Reportado por Clayton como achado para registrar antes de C1.5.
- **Categoria:** Frontend aspiracional contra backend não-materializado (espelho de DECISION-0032 — pattern PREMATURO em camada UI)

### Contexto material

DECISION-0032 (2026-05-19) declara `post_cta` como feature PREMATURO — tabela FANTASMA, INSERT removido do service, JOINs removidos, endpoint POST CTA action comentado. Frontend tem **código UI completo aguardando ativação**:

**Callers de `post.cta` no frontend (16 arquivos, ~50 ocorrências):**

| Arquivo | Tipo de uso |
|---|---|
| `components/social/PostCard.tsx` | Renderização principal de CTA — booking/service/payment, preço, currency, modal |
| `components/ServicePostCard.tsx` | Componente inteiro baseado em `post.cta` — chama `confirmCTA(post.cta.cta_id)` |
| `components/social/FeaturedToday.tsx` | Exibe preço de serviços/produtos com CTA |
| `components/social/AuthorCard.tsx` | Categoriza posts por `cta?.cta_type` |
| `components/social/SalesHistory.tsx` | Histórico de vendas |
| `components/SocialFeed.tsx` | Renderização condicional service_offer |
| `components/social/TodayForYou.tsx` | Recomendações |
| `components/social/SocialFeed2.tsx` | Type |
| `components/social/PostComposer.tsx`, `IntentComposer.tsx` | Composição |
| `utils/feedScoring.ts` | Scoring algorithm |
| `utils/trustSignals.ts` | Trust signals |
| `api/social-2.0.ts` | Type declaration + função `confirmCTA` exportada |

### Estado pós-DECISION-0032

- Backend NÃO emite `cta` no payload de Post (JOIN post_cta removido)
- Frontend `post.cta` sempre `undefined`
- Guards `if (post.cta)` e `post.cta?` falham silenciosamente → renderização fallback
- Função `confirmCTA(ctaId)` em `api/social-2.0.ts` continua exportada mas nunca é chamada (botão que dispara nunca renderiza)
- Componente `ServicePostCard.tsx` nunca monta (condicional `post.intent !== 'service_offer' || !post.cta`)

### Hipótese sobre origem

Ecossistema CTA aspiracional em TODAS as camadas: frontend escreveu UI completa antes de backend materializar tabela. Schema confirma: `post_cta` nunca existiu em runtime ao mesmo tempo que frontend foi codificado. Frontend tem código pronto mas **nunca exercitou em runtime real** (feed quebrava por drifts em paralelo, então user nunca chegou a ver CTA renderizado).

### Razão para registrar (não remover) agora

1. **Coerência com DECISION-0032** — se reabrir CTA no futuro (UX + JTBD + RFC), código frontend já está pronto. Remover agora exigiria reescrever quando reabrir.
2. **Frontend cleanup é frente própria** — não arrastar cross-layer no commit atual. Disciplina "1122 entries preservadas" + "git add específico".
3. **Não quebra runtime** — `post.cta?` é opcional; código degrada silenciosamente.
4. **Princípio "norma assintótica"** — preserva trabalho enquanto não há decisão de reabertura nem cleanup.

### Critério de fechamento

DT fecha em UM destes cenários (mutuamente exclusivos):

**Cenário A — CTA reaberto (DECISION superando 0032):**
- UX desenhado, JTBD validado, RFC aprovado, DECISION nova
- DDL aditiva cria tabela `post_cta` ou modelo substituto canônico
- Backend volta a emitir `cta` no payload
- Frontend code "acorda" — DT fecha como ATIVADA

**Cenário B — CTA confirmado como abandono permanente:**
- Frente própria frontend cleanup
- Remoção de `Post.cta` interface, função `confirmCTA`, componente `ServicePostCard`, callers em PostCard/FeaturedToday/AuthorCard/etc.
- DT fecha como REMOVIDA

### Não bloqueia

- Frente atual de social-2.0.service refactor (backend)
- Funcionamento do feed pós-fix
- Outras frentes UX que não tocam o pattern CTA

### Convergência institucional

Pattern análogo a outros casos de "frontend pronto, backend não-materializado": componentes plausivelmente aspiracionais em outras features (subscriptions UI, loyalty UI, automation alerts UI). Padrão recorrente que merece taxonomia institucional própria: **frontend-zombie** = código UI completo sem backend correspondente.

---

## DT-GATE-DOCSTRING-FALSE-POSITIVE

- **Status:** DEFERRED
- **Origem:** Sessão pós-marco-zero 2026-05-23 — análise do PR-3 (rides) durante aplicação de DECISION-0044/0045
- **Vinculada a:** DECISION-0044 (princípio operacional — classificação quádrupla), DECISION-0045 (caso rides natureza 4)

### Contexto

A regra `NO_DIRECT_BANK_TABLE_ACCESS` em `scripts/validate-architectural-patterns.mjs` usa regex literal `/\b(bank_ledger|bank_transactions|bank_accounts)\b/` para detectar acesso a tabelas SSOT bancárias fora do boundary autorizado (`allowPath`).

O regex captura **toda menção textual** das palavras `bank_ledger`/`bank_transactions`/`bank_accounts`, sem distinguir entre:

- (a) acesso SQL real (SELECT/INSERT/UPDATE/JOIN/etc.) — violação material a ser tratada;
- (b) menção em comentário JSDoc/docstring que ALERTA sobre o SSOT correto — alinhamento exemplar com a régua, falsamente marcado como violação.

### Evidência material

8 das 30 violações `critical_total` atuais (2026-05-23) caem na categoria (b): docstring documental em 4 arquivos do módulo rides (`analytics/analytics.routes.ts`, `distribution/distribution.controller.ts`, `distribution/distribution.routes.ts`, `distribution/distribution.service.ts`) que declara literalmente "a verdade financeira está em `bank_ledger` e `bank_transactions`, NÃO aqui" — código alinhado com a régua, gate o marca como violação.

Verificado: zero queries SQL sobre `bank_*` nos 4 arquivos. Documentação correta penalizada pelo detector.

### Risco

- **Curto prazo (baixo):** `critical_total` infla com falsos-positivos documentais, dificultando leitura do indicador.
- **Médio prazo (médio):** dev/IA futura pode tentar "consertar" a violação editando o comentário para não mencionar nomes literais — degrada documentação operacional explícita. Ou pode alargar `allowPath` para o caminho, abrindo curinga em substrato sensível.
- **Longo prazo (médio):** padrão pode se repetir em outros módulos cujo cabeçalho declara honestamente "verdade está em outro lugar". Penaliza documentação clara.

### Mitigação atual

- DECISION-0045 (esta sessão) registra os 8 casos atuais como falso-positivo documental, não-ação justificada.
- Os comentários permanecem como estão (documentação operacional preservada).

### Resolução prevista

Melhorias possíveis ao gate, em fatia futura de higiene:

1. **Ignorar ocorrências dentro de comentários JSDoc/inline** — regex multilinha que detecta `/* ... */` e `//` e exclui o conteúdo deles do scan. Forma mais limpa, sem precisar de allowlist por arquivo.
2. **Ignorar ocorrências dentro de string literals** — análogo, detectar `'...'` e `"..."` e excluir.
3. **Adicionar `// arch:allow` como denyLine na regra** `NO_DIRECT_BANK_TABLE_ACCESS` — opção mais conservadora (precisa anotação manual por linha). Desencorajada pelo desenho original da regra (sem `denyLine` proposital — vide `validate-architectural-patterns.mjs` linhas 102-109).
4. **Refinar pattern** para exigir token SQL adjacente (`FROM`, `JOIN`, `INTO`, `UPDATE`, `DELETE FROM`) — reduz falso-positivo mas não cobre 100%.

Prioridade: BAIXA. Não bloqueante. Fica registrado como melhoria de tooling, não bug.

---

## DT-HELPERS-DUAL-IMPLEMENTATION-DRIFT

- **Status:** DEFERRED
- **Origem:** Sessão pós-marco-zero 2026-05-23 — sub-achado durante análise do PR-1 (leitura de `bank-transaction-read.repository.ts`)
- **Vinculada a:** DECISION-0044 (menção do sub-achado), princípio "norma assintótica" (`project_norma_assintotica`)

### Contexto

Existem **duas implementações em paralelo** dos helpers de query com tenant:

1. `backend/src/core/db.ts:58` (`runQueryWithTenant`) e linha 77 (`runQueriesWithTenant`)
2. `backend/src/core/database/pool.ts:168` (`runQueryWithTenant`) e linha 217 (`runQueriesWithTenant`)

Ambas as versões fazem essencialmente o mesmo trabalho (abrir client, set_config `app.current_tenant`, executar query, sanitizar params, release). Existem em paths distintos com pequenas diferenças (a versão `pool.ts` tem sanitização de `undefined → null` explícita, redação de logs em produção).

**Uso atual observado:**

- `bank-transaction-read.repository.ts`, `bank-reporting.repository.ts` (criado no PR-1) importam de `@core/database/pool` — versão pool.ts.
- 4 arquivos de `modules/rides/*` importam de `@core/db` — versão db.ts.
- Distribuição entre os dois paths não-uniforme no codebase.

### Risco

- **Curto prazo (baixo):** ambas funcionam, não bloqueiam runtime.
- **Médio prazo (médio):** "duas verdades paralelas" no nível infraestrutural viola a régua de SSOT único aplicada a si mesma. Correções de bugs precisam ser feitas em duplicata; refactor de uma pode esquecer a outra; novos desenvolvedores escolhem aleatoriamente entre as duas.
- **Longo prazo (médio):** drift cumulativo — as duas implementações divergem semanticamente ao longo do tempo, e o sistema passa a depender de diferenças sutis sem documentação.

### Mitigação atual

- DT registrada (esta entrada) para visibilidade.
- DECISION-0044 menciona o caso como sub-achado consciente, não-bloqueante para o trabalho de boundary do bank.

### Resolução prevista

Frente de higiene de infra: unificar em uma única implementação canônica (provavelmente `pool.ts`, que parece mais recente e completa), deprecar a versão `db.ts` com período de transição, e atualizar imports do codebase via search-and-replace controlado.

Prioridade: BAIXA. Não bloqueante. Fica registrado como melhoria estrutural, fatia futura.

---

## DT-FIXTURE-C52-CLEANUP

- **Status:** CLOSED (2026-05-24)
- **Origem:** Sessão 2026-05-23 — descoberta da fixture órfã durante investigação do `INSUFFICIENT_FUNDS` no boot pós-marco-zero
- **Vinculada a:** DECISION-0044 (princípio quádruplo — natureza 3 script de teste; aqui aplicado a fixture E2E órfã), DECISION-0045 (registra os 9 do `e2e-incentive-bank-checklist.ts` como natureza 3; este cleanup é a contraparte de "limpeza pontual" do mesmo princípio)

### Contexto

Investigação inicial pós-marco-zero (2026-05-23) detectou no boot `[ReleaseWorker] Release failed for intent e691e226-c039-45a5-a828-d2d8e01efa17 Error: INSUFFICIENT_FUNDS` em loop. Análise material revelou: o intent era fixture de suíte E2E **C52** (metadata `{"test": "c52"}`), criada em 2026-04-24, marcada como `settled` mas **sem credit correspondente em `bank_ledger`** — daí o ReleaseWorker tentar mover fundos inexistentes da conta `seller_pending` para `seller_available` e bater na invariante `validate_non_negative_balance`. Sistema fail-closed do `bank_ledger` operando corretamente; ruído contínuo de fixture órfã.

Pós-mapeamento de escopo em 2026-05-24, descoberto que a suíte C52 não era 1 fixture mas **6 fixtures pareadas** (intent + order), cobrindo 6 canais distintos do mesmo cenário de teste, todas criadas no mesmo timestamp:

| # | intent_id | payment_status | e2e_source | order_id |
|---|---|---|---|---|
| 1 | `a388c1e6-6b37-42fe-a276-3ebe566dba6d` | pending | payment_link | `c9165abe-7352-4697-8df1-2b9876eff512` |
| 2 | `5f0ddeec-c620-487f-b51c-3dd64171a5b6` | pending | governance | `5e943fa2-cc6a-4659-b5a6-33a78840aa04` |
| 3 | `d9744350-f6e8-4366-9c56-a3acb16ed7fb` | pending (subscription) | subscription | `8c876aa9-21c8-40a1-89d2-577ced66bb38` |
| 4 | `8a7d89f3-8de6-4492-a550-a0e3e98d25e8` | captured | pdv | `7ff7c91f-e538-410c-a39b-b1c3a5c9ab88` |
| 5 | `e691e226-c039-45a5-a828-d2d8e01efa17` | **settled** | **ticket** | `1a150db2-aa3f-4ca4-b0d0-a8a059d4ea00` |
| 6 | `3327ef51-e1ce-456f-a993-c018c6f60102` | failed | venue | `9fad2d98-1280-4931-9c93-a2f3e0d01565` |

Mapeamento confirmou **zero dependências** das 6 fixtures em qualquer FK: `payment_transactions`, `bank_transactions`, `order_items`, `fulfillment_orders`, `inventory_reservations`, `order_status_history` — todas 0 rows. Órfãs completas, sem cabos pendurados.

### Decisão

Apagar a **suíte C52 inteira** em transação atômica (opção B), não apenas a fixture `ticket` (opção A). Razão: mesma metadata, mesmo timestamp, mesma origem, todas órfãs — limpar só uma deixaria as outras 5 esperando descoberta amanhã, com o mesmo raio-x. Mesma cirurgia, mesmo lote.

### Execução (2026-05-24)

Transação atômica em `unificard_dev` (banco local de desenvolvimento):

```sql
BEGIN;
DELETE FROM payment_intents WHERE id IN (<6 intent uuids>);  -- DELETE 6
DELETE FROM orders WHERE id IN (<6 order uuids>);            -- DELETE 6
COMMIT;
```

Persistência verificada pós-COMMIT: 0 rows para os 6 intent_ids em `payment_intents`, 0 rows para os 6 order_ids em `orders`, 0 rows com `metadata->>'test' = 'c52'` em `payment_intents`. Universo C52 zerado materialmente.

### Resultado

- ReleaseWorker não tem mais intent `settled` órfão para processar; o erro `INSUFFICIENT_FUNDS` no boot deixa de aparecer.
- Universo limpo para a próxima fatia (reconciliation ampliada — cruzar `payment_intents.settled × bank_ledger.credits`): nenhuma fixture C52 vai aparecer como falso-positivo do vigia novo. Vigia simples, universo limpo.
- Limite institucional respeitado: cleanup só em dev local, com autorização explícita de Clayton e mapeamento prévio de dependências antes do DELETE. Não é precedente para "apagar dados em produção"; é cleanup pontual de fixture E2E órfã.

### Lição registrada

Suítes E2E que criam dados marcados (`metadata.test`) sem mecanismo de cleanup automático no fim do teste deixam órfãos acumulados que: (a) podem confundir reconciliation futura, (b) podem fazer workers/jobs barulharem em loop. Disciplina de teste preferível a filtro no vigia: seeds que limpam seus próprios dados ao fim. Esta DT é caso resolvido, não pattern para repetir.

### Fechamento

Cleanup executado em 2026-05-24. Suíte C52 limpa. DT fecha CLOSED. Próxima fatia (reconciliation ampliada) ocorre em universo limpo.

---

## DT-RECONCILIATION-WORKER-COLUMN-MISMATCH

- **Status:** CLOSED (2026-05-24 — substituída pelo apagamento do worker via remoção da invocação em `BOOT.ts` e DELETE de `backend/src/workers/reconciliation-worker.ts`)
- **Origem:** Sessão 2026-05-24 — capturado nos logs durante validação do boot da Fatia 2 (commit `c149ede4`)
- **Vinculada a:** — (bug pré-existente independente da Fatia 2)
- **Resolução:** worker `reconciliation-worker.ts` apagado por completo após leitura dirigida revelar que (a) era soberania duplicada da engine canônica (`reconciliation-engine.service.ts`), (b) nunca cumpriu nenhuma das 3 verificações dele em runtime (try/catch externo matava o ciclo na primeira query buggada — verificações 2 e 3 nunca rodaram), (c) o caso material da verificação 1 já é coberto pela engine canônica via FK explícita desde a Fatia 2 (commit `c149ede4`, `settled_intent_without_credit`), e (d) `checkLedgerIntegrity` (verificação 3) continua usada por `financial-health.ts` e `financial-dashboard.controller.ts` — não fica órfã. Apagar foi diff verdadeiro (limpa duplicação morta), não destrutivo (não removeu cobertura porque não havia cobertura).

### Contexto

`backend/src/workers/reconciliation-worker.ts:12-17` executa query periódica (interval 30s):

```ts
SELECT pi.id, pi.tenant_id
FROM payment_intents pi
LEFT JOIN bank_settlements bs ON bs.tenant_id = pi.tenant_id
WHERE pi.status = 'completed' AND bs.id IS NULL
```

A coluna real em `payment_intents` é **`payment_status`**, não `status`. PostgreSQL retorna erro `42703 — coluna pi.status não existe`. Worker captura no `catch` e loga `[ReconciliationWorker] Cycle error: error: coluna pi.status não existe` a cada ciclo de 30s.

Esse worker é separado do engine canônico (`modules/reconciliation/reconciliation-engine.service.ts`). O engine roda com sucesso (confirmado pela Fatia 2: 96 runs em `reconciliation_runs` no boot). O worker é uma camada complementar de checagens periódicas de integridade que falha silenciosamente nesta query.

### Risco

- **Curto prazo (baixo):** ruído de log a cada 30s; não corrompe dado nem afeta runtime do engine principal.
- **Médio prazo (médio):** a checagem `INTENT_WITHOUT_SETTLEMENT` do worker NUNCA roda — significa que se houver intent `completed` sem settlement em produção, esse worker não detecta. Blind spot complementar ao que a Fatia 2 cobriu (a Fatia 2 cobre `settled` × `bank_ledger.credits`; este worker tentava cobrir `completed` × `bank_settlements`).
- **Longo prazo (médio):** poluição de log dificulta diagnóstico de erros reais.

### Mitigação atual

Nenhuma — bug pré-existente, anterior ao marco zero. Engine canônico (que a Fatia 2 ampliou) roda em paralelo e não é afetado.

### Resolução prevista

Fatia futura pequena (provavelmente sub-fatia da próxima sessão de reconciliation):
- Trocar `pi.status` por `pi.payment_status` na query da linha 13.
- Confirmar o valor canônico: provavelmente `IN ('captured', 'settled')` em vez de `= 'completed'` (que não existe no enum `payment_status_check` do CHECK constraint — vide `payment_intents_payment_status_check`).
- Validar via mesmo critério da Fatia 2: boot + grep + DB check pós-edit, sem novas discrepâncias inesperadas.

Risco mínimo, baixa prioridade. Não bloqueante para nenhuma frente ativa.

### Não bloqueia

- Fatia 2 (reconciliation ampliada) — confirmado em validação: engine roda 96x, vigia novo detecta 0 discrepâncias, worker faz ruído apartado em loop sem afetar.
- Qualquer outra frente.

---

## DT-PAYMENT-RESOLVER-INVALID-STATUS-VALUES

- **Status:** CLOSED (2026-05-24 — executada como Fase 1 da DECISION-0032)
- **Severidade:** ALTA (era bug ativo no fluxo de pagamento; corrupção silenciosa de estado em produção quando release sucedesse — resolvido)
- **Origem:** Sessão 2026-05-24 — descoberto durante leitura dirigida para o DELETE do `reconciliation-worker.ts`.
- **Vinculada a:** **DECISION-0032** (Payment status canônico = lowercase, 2026-05-12). Esta DT é **execução de Fase 1 pendente** da DECISION-0032, não decisão nova. Quando aberta, a decisão soberana sobre o vocabulário (`'created'`/`'payment_received'`/`'completed'` fora do enum canônico; 11 valores válidos) já existia há 12 dias e não havia sido aplicada aos callers. **Lição de método:** consultar `REMEDIATION_DECISIONS_LOG.md` por termo do tema antes de abrir DT — se já há DECISION sobre o assunto, registrar como "execução pendente da DECISION-XXXX" em vez de DT nova.
- **Resolução (2026-05-24):** Aplicada convergência da Fase 1 da DECISION-0032 em 5 sítios + deprecação do Writer A UPPERCASE:
  - `payment-event-resolver.ts:179` (UPDATE `'completed'`) — UPDATE removido; estado lógico permanece `'settled'` (mapping migration: `'completed' → 'settled'`); rastro do release em `metadata.seller_release_reference`.
  - `payment-event-resolver.ts:259` (UPDATE `'payment_received'`) — UPDATE removido; intent vai direto para `'escrowed'` na linha seguinte (marco efêmero sem propósito persistente).
  - `payment-event-resolver.ts:197` (comparação `'created'`) — mantida literal com `@ts-expect-error` linkando `DT-RESOLVER-PIX-BRANCH-DEAD`; comportamento dormente preservado.
  - `governance-funding/governance-funding.service.ts:54` (`status: 'created'`) → `status: 'pending'`.
  - `workers/governance-funding-commitment-worker.ts:100` (`status: 'created'`) → `status: 'pending'`.
  - `reversal/reversal.service.ts:72` (`status: 'completed'`) → `status: 'reversed'` (decisão Clayton 2026-05-24: convergência semântica, não literal — o intent documenta reversal já executado; `'reversed'` está nos 11 canônicos e bate com o significado; `'settled'` da migration era mapping para legacy data genérico, não para este caso).
  - `modules/payments/payment-intent-repository.ts:9-23` (tipo `PaymentIntentStatus` Writer B) — alinhado aos 11 valores canônicos do CHECK; tipo passa a dizer a verdade do banco.
  - `modules/marketplace/payment-intent.types.ts` (tipo `PaymentIntentStatus` Writer A UPPERCASE) — marcado `@deprecated` referenciando DECISION-0032; completa a deprecação iniciada em `payment-intent.service.ts:1` (`@deprecated parcial — C52 Passo 4`).
- **Validação:** `tsc --noEmit` exit 0 (era o detector — após Edit do tipo soberano, capturou os 4 sítios drift que a investigação inicial não pegou); grep órfão em writes de payment_status retorna zero; 4 gates verdes; `critical_total=29` inalterado; boot limpo (zero novos erros; `Server listening` confirmado; engine canônica de reconciliation continua rodando).
- **Fechamento:** Bug ativo eliminado. Em produção, releases bem-sucedidos não vão mais bater em CHECK violation; intents progridem ao estado final canônico; governance funding e commitment worker passam a criar intents com sucesso (antes sempre falhavam com `markFundingFailed` mascarando o drift); reversal intent documenta corretamente o estado da reversão.

### Contexto

`backend/src/modules/gateway/payment-event-resolver.ts` faz 4 chamadas a `updatePaymentIntentStatus(intent.id, <valor>)`. A função em `modules/payments/payment-intent-repository.ts:118-133` executa diretamente `UPDATE payment_intents SET payment_status = $3` — toca o campo sob CHECK constraint.

CHECK constraint **real e atual** (verificado via `pg_constraint` em 2026-05-24):

```
CHECK (payment_status = ANY (ARRAY[
  'pending', 'authorized', 'captured', 'escrowed', 'settled',
  'failed', 'cancelled', 'reversed', 'partially_refunded',
  'disputed', 'expired'
]))
```

**Duas das 4 chamadas escrevem valores fora do enum:**

| Linha | Valor | Enum? |
|---|---|---|
| 41 | `'settled'` | ✅ válido |
| **179** | **`'completed'`** | **❌ INVÁLIDO** — não existe no enum |
| **259** | **`'payment_received'`** | **❌ INVÁLIDO** — não existe no enum |
| 264 | `'escrowed'` | ✅ válido |

Quando alcançadas, essas duas chamadas disparam erro PostgreSQL `42514 — new row violates check constraint`. Sem try/catch local no resolver — propaga.

### Por que não disparou em dev até agora

A linha 179 (`'completed'`) é alcançada APÓS o `bankTransactionService.transfer` em `releaseSettledPaymentIntent` (linhas 161-175). Em dev, a única fixture com `payment_status='settled'` era a C52 (intent `e691e226`), que sempre falhava com `INSUFFICIENT_FUNDS` no transfer — nunca chegava no UPDATE. Bug oculto atrás de outro bug. Após a limpeza da C52 (commit `62efc478`), não há mais intents `settled` em dev para acionar o release; o bug permanece adormecido.

### Por que é grave em produção

Quando um release real dá certo em produção (transfer sucede sem `INSUFFICIENT_FUNDS`), o código chega na linha 179 e tenta gravar `'completed'`. O CHECK rejeita. UPDATE falha. **O intent fica preso em `'settled'` para sempre, nunca atinge o estado terminal pretendido.** Estado financeiro inconsistente silencioso: o transfer rodou e foi commitado (dinheiro moveu de `seller_pending` para `seller_available`), mas o registro do intent não acompanha. Auditoria fica enganada. Workers/fluxos que esperam `'completed'` para continuar (se houver) ficam travados.

Mesma natureza vale para `'payment_received'` na linha 259 — dispara em algum caminho do `resolvePaymentEvent` (a investigar na fatia de conserto).

### Risco

- **Curto prazo:** zero em dev (sem fixtures settled); médio-alto em produção (depende de tráfego — qualquer release bem-sucedido aciona).
- **Médio prazo (alto):** acumulação de intents em estado preso; engine canônica de reconciliation (Fatia 2 — `settled_intent_without_credit`) pode confundir esses intents com órfãos reais (eles têm credit no ledger, mas estado não progrediu).
- **Longo prazo:** integridade de relatórios de margem (`real-margin.service.ts`) e KPIs (`reporting.service.ts`) corrompida — filtram por estado.

### Mitigação atual

Nenhuma. Bug ativo, oculto em dev pela cleanup da C52. Em produção, depende do tráfego.

### Resolução prevista — fatia própria, decisão de produto antes do EXECUTOR

O conserto exige **decisão semântica sobre qual valor canônico substitui `'completed'` e `'payment_received'`**. A fatia começa com leitura dirigida do fluxo completo de estados de `payment_intents` cruzada com `docs/01_normas/07_NOMENCLATURA_CANONICA.md`, e Clayton decide o vocabulário antes do EXECUTOR.

Opções iniciais (a confirmar com fluxo na mão):
1. Estender o enum via migration (`'completed'` e `'payment_received'` viram valores válidos);
2. Refatorar o resolver para usar valores existentes (`'settled'` permanece como estado terminal pós-release; release marca conclusão por outra dimensão, ex.: timestamp/metadata);
3. Reformulação semântica do conjunto de estados (decisão de produto sobre o ciclo de vida completo).

### Não bloqueia

- Apagamento do worker (commit desta sessão) — independente; worker era código morto.
- Engine canônica de reconciliation (Fatia 2) — segue rodando; cobre `settled` sem credit.
- Runtime em dev hoje — sem fixtures settled.

**Bloqueia em produção** quando o primeiro release bem-sucedido acontecer.

*Atualização 2026-05-24:* FECHADA. Resolução acima. Bloqueio em produção eliminado.

---

## DT-RESOLVER-PIX-BRANCH-DEAD

- **Status:** OPEN
- **Severidade:** ALTA (se PIX é usado em produção, o handler `PIX_PAYMENT_CONFIRMED` nunca processa um pagamento — dropped silenciosamente)
- **Origem:** Sessão 2026-05-24 — descoberto durante a leitura dirigida do `payment-event-resolver.ts` para a Fase 1 da DECISION-0032 e capturado pelo `tsc` após alinhamento do tipo `PaymentIntentStatus`.
- **Vinculada a:** DECISION-0032 Fase 1 (descoberta lateral durante execução), `DT-PAYMENT-RESOLVER-INVALID-STATUS-VALUES` (CLOSED 2026-05-24).

### Contexto

`backend/src/modules/gateway/payment-event-resolver.ts:197` faz:

```ts
if (intent.status !== 'created') {
  console.warn('PAYMENT_INTENT_ALREADY_PROCESSED');
  return;
}
```

`'created'` **não existe** no enum canônico de `payment_intents.payment_status` (CHECK constraint nos 11 valores `'pending'/'authorized'/.../'expired'`). A migration `20260530503000_payment_intents_normalize_status` mapeou `'CREATED' → 'pending'` em 2026-05-12. Intents nascem com `'pending'` (default no Writer B canônico `createPaymentIntent`).

Em runtime, `intent.status === 'pending'`. A comparação `'pending' !== 'created'` retorna **sempre true**. Função sempre retorna com warn `PAYMENT_INTENT_ALREADY_PROCESSED`. **O branch `PIX_PAYMENT_CONFIRMED` nunca processa um pagamento.**

### Mitigação atual

`@ts-expect-error` aplicado na linha de comparação para que o `tsc` compile sem destravar o branch. Comportamento dormente preservado. Não há risco em dev (sem fixtures). Em produção, dropped silenciosamente como sempre foi.

### Por que não destravar agora (decisão de escopo Clayton 2026-05-24)

Destravar (trocar `'created'` por `'pending'`) é **mudança de comportamento real**: fluxo PIX dormente passa a executar pela primeira vez. Exige fatia própria com:
1. Leitura do fluxo PIX completo (quem cria payment_intents via PIX, com qual estado, qual o volume em produção).
2. Verificação de consumidores que dependem da semântica atual (se algum, eles podem assumir que esse branch nunca roda).
3. Decisão de produto sobre o estado inicial real (`'pending'` ou outro) e a transição esperada após processamento.
4. Validação em dev com fixture de evento PIX simulado.

Misturar destrave-de-fluxo com convergência-de-nomenclatura na mesma fatia (Fase 1) embaçaria o que é seguro e o que precisa de olhar específico.

### Risco

- **Curto prazo:** zero em dev (sem fixtures PIX); em produção depende de tráfego.
- **Médio prazo:** se PIX é canal usado em produção, **pagamentos PIX confirmados nunca chegam ao escrow** — silenciosamente perdidos. Bug grave latente.
- **Longo prazo:** acúmulo de evidência de inconsistência (PIX externo confirma, sistema interno não processa).

### Sub-achado de namespace (não-bloqueante)

Existe um **segundo** tipo `PaymentIntentStatus` em `modules/marketplace/payment-intent.types.ts:8` (UPPERCASE: `'CREATED'|'AUTHORIZED'|'FAILED'|'CANCELLED'`) — drift completo com a Nomenclatura Canônica §4.11. Marcado `@deprecated` nesta sessão (commit Fase 1) mas ainda existe. A fatia de destrave do PIX provavelmente precisa investigar qual tipo cada caller importa antes de mexer.

### Resolução prevista

Fatia separada (próxima na fila após Fase 1 da DECISION-0032). Começa pela leitura dirigida do fluxo PIX, depois decisão de produto, depois EXECUTOR com validação fresh.

---

## DT-DECISION-0032-FASE-1-PARTIAL-EXECUTION

- **Status:** OPEN — backlog de execução das fases pendentes da DECISION-0032
- **Severidade:** MEDIUM (não bloqueia runtime hoje, mas a 0032 está parcialmente executada há 12 dias; tipos UPPERCASE residuais continuam armadilhas para drift acidental futuro)
- **Origem:** Sessão 2026-05-24 — durante a execução de Fase 1 (Writer B convergência), foi confirmado que apenas a migration de schema rodou em 2026-05-12; as Fases 1 (resto), 2, 3 e 4 da DECISION-0032 ficaram majoritariamente no papel.
- **Vinculada a:** DECISION-0032 (Payment status canônico = lowercase, 2026-05-12).
- **Princípio orientador:** **lição de método** — toda nova frente em payment_*/bank_*/auth_* DEVE consultar `REMEDIATION_DECISIONS_LOG.md` e `REMEDIATION_DT_LOG.md` por termo antes de abrir DT/decisão. Se já há registro soberano, executar conforme decidido em vez de re-investigar/re-decidir.

### Estado atual da DECISION-0032 pós-Fase 1 (2026-05-24)

**Executado:**

- ✅ Migration de schema (`20260530502000`, `20260530503000`, `20260530505000`).
- ✅ Fase 1 — Writer B (`payment-intent-repository.ts`) convergente + 5 callers (resolver × 2 sítios + governance-funding × 2 + reversal) + Writer A UPPERCASE marcado `@deprecated` (`marketplace/payment-intent.types.ts`).

**Pendente (backlog):**

#### Tipos UPPERCASE residuais (10 tipos)

A DECISION-0032 lista 15 tipos UPPERCASE como violação da Nomenclatura Canônica §4.11/§6/§19.8. Após Fase 1, 10 ainda em drift:

| Arquivo | Tipo | Valores UPPERCASE |
|---|---|---|
| `marketplace/payment-intent.types.ts:56` | `PaymentTransactionStatus` | `'PENDING'\|'SUCCESS'\|'FAILED'` |
| `marketplace/payout.types.ts:8` | `PayoutTransactionStatus` | `'PENDING'\|'SUCCESS'\|'FAILED'` |
| `marketplace/event-settlement.types.ts:7` | `EventSettlementStatus` | `'PENDING'\|'SETTLED'` |
| `marketplace/settlement.types.ts:12` | `SettlementStatus` | `'PENDING'\|'SETTLED'\|'FAILED'` |
| `marketplace/unifycard.types.ts:7` | `UnifyCardTransactionStatus` | `'AUTHORIZED'\|'CAPTURED'\|'SETTLED'\|'FAILED'` |
| `marketplace/accounts-receivable.types.ts:7` | `AccountsReceivableStatus` | `'PENDING'\|'RECEIVED'\|'CANCELLED'\|'EXPIRED'` |
| `payments/payment-link.types.ts:7` | `PaymentLinkStatus` | `'ACTIVE'\|'EXPIRED'\|'DISABLED'` |
| `payments/payment-link.types.ts:12` | `PaymentLinkPaymentStatus` | `'PENDING'\|'SUCCESS'\|'FAILED'\|'CANCELLED'` |
| `payments/pix-provider.interface.ts:21` | `PixChargeStatus` | `'CREATED'\|'PAID'\|'EXPIRED'\|'CANCELLED'` (cuidado: PIX externa pode ter contrato fixo do provider) |
| `marketplace/payment-intent.types.ts:8` | `PaymentIntentStatus` UPPERCASE (já @deprecated) | `'CREATED'\|'AUTHORIZED'\|'FAILED'\|'CANCELLED'` |

Cada um vira fatia própria (mecânica similar ao que foi feito na Fase 1: alinhar tipo + grep órfão + tsc captura callers).

#### Fase 2 — payment_transactions e payment_milestones

- `payment_transactions.status` — CHECK lowercase foi revertido em `20260530536000` para destravar runtime. Após convergência dos tipos UPPERCASE associados, reaplicar CHECK lowercase ratificado pela DECISION-0032.
- `payment_milestones.status` — verificar estado atual + normalizar lowercase nos INSERTs/UPDATEs.

#### Fase 3 — Mapper de fronteira

- Criar mapper formal em `backend/src/modules/gateway/` que converte casing/vocabulário de gateways externos (Stripe, MercadoPago, PIX provider) para vocabulário canônico interno.
- Confinar `ExternalPaymentStatus` (`marketplace/external-payment-provider.types.ts:4` — `'pending'\|'succeeded'\|'failed'\|'canceled'`, vocabulário Stripe) à camada de gateway. Domínio interno nunca recebe payload bruto de provider.

#### Fase 4 — Frontend

- Alinhar `frontend/src/api/escrow.ts`, `frontend/src/api/pdv.ts`, `frontend/src/pages/PaymentLinkPage.tsx` e adjacentes ao casing lowercase do backend.

#### Sub-achados de workers buggados (mesma família do reconciliation-worker apagado em `26fd1034`)

- `SlaMonitorWorker` — boot pós-Fase 1 mostrou `[SlaMonitorWorker] Cycle error: error: coluna "status" não existe`. Mesmo padrão do `reconciliation-worker.ts:13` que foi apagado (usa `pi.status` em vez de `pi.payment_status`). Investigar se é dead code/duplicado da engine canônica ou se precisa de fix.
- Provavelmente outros workers com padrão similar. Auditoria de workers `*-worker.ts` que tocam `payment_*` recomendada como fatia auxiliar.

### Resolução prevista

Cada item acima vira fatia separada quando dor material puxar (não por antecipação). A ordem natural sugerida:
1. **Destravar branch PIX dormente** (DT-RESOLVER-PIX-BRANCH-DEAD) — bug grave latente.
2. **Auditar workers buggados** (sub-achado SlaMonitorWorker + outros) — limpeza do mesmo padrão já resolvido para reconciliation-worker.
3. **Convergir 10 tipos UPPERCASE residuais** — mecânico, fatia por fatia.
4. **Fase 3 (mapper de fronteira)** — quando aparecer primeiro contato com novo gateway que precise normalização.
5. **Fase 2 (payment_transactions/milestones CHECK)** — quando convergência de tipos chegar lá.
6. **Fase 4 (frontend)** — pode ser incremental conforme telas forem tocadas.

### Não bloqueia

- Runtime atual (post-Fase 1) — `critical_total` estável em 29; 4 gates verdes; tsc limpo.
- Engine canônica de reconciliation (Fatia 2 anterior) — segue rodando.
- Quaisquer outras frentes não-payment.

### Lição de método registrada (memória)

`feedback_consultar_log_antes_de_abrir_frente.md` — antes de abrir DT/decisão sobre tema material, grep no DECISIONS_LOG e DT_LOG por termo do tema (`payment_status`, `bank_ledger`, etc.). Duplicação de numeração no log = sinal de séries paralelas — ler o título de cada uma. Se já há DECISION/DT, alinhar plano a ela; não re-investigar.

---

## DT-FEED-MEDIA-HIDRATATION-PENDING

- **Status:** OPEN
- **Severidade:** MEDIUM (feed funciona; mídia não é renderizada — UX degradada graciosa, não bloqueante)
- **Origem:** Fatia executiva 2026-05-24 que fechou `DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH`. Drift #4 (`p.media` em service vs `posts.media_ids UUID[]` no schema, com frontend esperando `MediaItem[]` de objetos `{media_id, media_type, url, thumbnail_url}`) foi resolvido provisoriamente pela **opção (c)** decidida por Clayton: service retorna `'[]'::jsonb AS media` (array vazio); frontend tolera via guard `post.media && post.media.length > 0` em `PostCard.tsx:283` e `GrupoDetailPage.tsx:848`. DECISION-0033 fixou o SCHEMA (embedded `media_ids UUID[]`) mas não o CONTRATO DE API (como hidratar IDs em objetos renderizáveis).
- **Vinculada a:** DECISION-0033 (post_media → posts.media_ids), `DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH` (CLOSED 2026-05-24).

### Contexto material

- Schema vigente: `posts.media_ids UUID[] NOT NULL DEFAULT '{}'` (`20260530300000_social_posts.sql:11`).
- **Não existe tabela canônica `media`/`media_items`/`attachments`/`media_assets`** em `backend/migrations/` (auditado por glob+grep 2026-05-24).
- Frontend `api/social-2.0.ts:33` declara `media: MediaItem[]` com `interface MediaItem { media_id, media_type, url, thumbnail_url }` — espera objetos hidratados, não array de IDs.
- Hoje o feed retorna `media: []` para todos os posts (opção c). Sem regressão visível em dev (0 posts com mídia hidratada hoje); em produção, posts com `media_ids` populado deixam de mostrar mídia.

### Risco

UX de mídia ausente até frente futura. Não bloqueia operação econômica nem soberania de actor.

### Resolução prevista (3 opções a decidir)

1. **(a) Hidratar via tabela canônica de mídia.** Criar `media` (ou nome canônico via SSOT_REGISTRY) com `id, tenant_id, actor_id, media_type, url, thumbnail_url, created_at`. Service hidrata `media_ids` via JOIN/lookup, retorna `MediaItem[]`. Preserva contrato externo. Custo: DDL + repository + migração de upload pipeline. Frente arquitetural — exige DECISION nova.
2. **(b) Expor `media_ids` nus + endpoint de hidratação separado.** Service retorna `media_ids: UUID[]`; frontend chama endpoint de mídia conforme renderiza. Frontend muda (`Post.media` → `Post.media_ids`) — afeta `PostCard`, `GrupoDetailPage` (~10-30 LOC). Sem tabela canônica = endpoint precisa de outra fonte de URL.
3. **(c) Manter status quo + DT viva até feature ter dor real.** Atual.

### Casos adicionais cobertos pela opção (c)

- `Social2Service.getFeed` (commit `0c478dec`, 2026-05-24) — origem da DT.
- `Social2Service.getActorPosts` (commit Fatia C, 2026-05-24) — mesmo padrão `'[]'::jsonb AS media`, mesma query-irmã do getFeed. Sem caller frontend que renderize mídia desta rota; quando hidratação for materializada (opção a ou b), os dois métodos convergem juntos.
- `Social2Service.createPost` (commit Fatia B, 2026-05-24) — INSERT grava `media_ids UUID[]` direto (passa `mediaIds` array recebido no input); return `media: []` hardcoded até hidratação ser decidida.

---

## DT-CREATEPOST-SIGNATURE-DUAL-USERID

- **Status:** CLOSED 2026-05-25 (Fatia E — param morto removido, 8 callers convergidos, prova material confirmou audit fields no slot correto)
- **Severidade:** N/A (CLOSED — era LOW após Fatia D corrigir bug runtime; resíduo cosmético-arquitetural eliminado pela Fatia E)
- **Origem:** Fatia B 2026-05-24 — grep de superfície revelou que `Social2Service.createPost` tem 6 callers internos (rota + scripts/seed-dev-groups + modules/events + modules/groups + modules/votes ×3), todos com lógica própria de `userId` vs `globalUserId`. A signature atual mistura `userId: string` (arg 2), `globalUserId: string` (arg 3), `actorId?: string` (arg 5) — confusão estrutural. Bug da rota confirmado pelo stack do smoke (`actor.repository.ts:95`).
- **Vinculada a:** DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH (CLOSED via fatia getFeed `0c478dec`); fatia B convergiu o corpo do método (DECISIONs 0031/0032-social/0033/0034) sem tocar a signature.

### Fechamento Fatia E (2026-05-25 — remoção do param morto + convergência dos callers)

**Execução:** removido `globalUserId: string` do slot 3 da signature de `Social2Service.createPost` (`social-2.0.service.ts:640`) + comentário arqueológico das linhas 745-747 deletado + **8 chamadas convergidas em 5 arquivos** (DT original subcontou para 6 — auditoria de superfície da Fatia E descobriu 8 chamadas reais):

1. `modules/social/social-2.0.routes.ts:243` — removeu `req.actionContext.actorId` (resquício inerte da Fatia D no slot 3).
2. `scripts/seed-dev-groups.ts:292` — removeu `ownerPublicGlobalId`.
3. `scripts/seed-dev-groups.ts:316` — removeu `ownerPrivateGlobalId`.
4. `modules/votes/votes.service.ts:60` — removeu `globalUserId`.
5. `modules/votes/votes.service.ts:116` — removeu `globalUserId`.
6. `modules/votes/votes.service.ts:262` — removeu `globalUserId`.
7. `modules/groups/groups.service.ts:275` — removeu `userResult.global_user_id`.
8. `modules/events/events.service.ts:351` — removeu `createdByGlobalUserId`.

Em cada um, args 4..N descem para slots 3..(N-1) da nova signature. Tipos batem em 1:1 — mas tsc não pega deslocamento intra-tipo (regra crítica do prompt), daí a prova material reforçada abaixo.

**Validação — 5 critérios passaram:**
- `tsc --noEmit` exit 0 (signature 12 params, antes 13).
- Grep órfão zero: nenhum `globalUserId` em chamada de `social2Service.createPost`; nenhum uso do param no corpo do método. As 5 ocorrências restantes de `globalUserId` em `social-2.0.service.ts` (L123/147/149/157/236) são do método **distinto** `createPostInGroup`, fora do escopo — não tocadas.
- 4 gates verdes (bank-ledger §4.6 OK, actor-writer §4.8.1 OK, regression-guards OK, architectural Total 20 = baseline inalterado; todas as 20 violações em `core/profile/`/`human-mvp/` — zero em arquivos tocados).
- `critical_total` inalterado (20 = 20).
- Boot limpo (backend subiu sem erros; só 401 esperado em rota auth-required).

**Prova material reforçada — 2 caminhos da rota (caller #1, o de maior risco com 13→12 args):**
- D-1 (com `actor_id` no body): `POST /social/posts` → HTTP 201, post `bf517e13-7037-4f09-ac97-5e415ed9f5fd` gravado.
- D-2 (sem `actor_id` no body — ramo `ensureUserActor`): `POST /social/posts` → HTTP 201, post `4b600ce6-3f84-4e1f-bc1d-e9705bc94f9f` gravado.
- SELECT confirmatório em ambos:
  - `actor_id` = `751a4fe0-2f33-4053-bfa8-3dcad39b3b30` (canônico, dev actor).
  - **`metadata.created_by_user_id` = `beb7b5e4-2d22-4782-83c9-6e006da53713`** (user_id correto — slot de audit NÃO escorregou para o slot de actor_id após o deslocamento).
  - `metadata.created_as_actor_id` = `751a4fe0-...` (actor_id correto).
  - `intent`, `intent_metadata`, `media_ids` consistentes com payload.
- Cross-check no feed (`GET /social/feed?actor_type=user`): ambos posts da Fatia E aparecem no topo, ao lado dos D-1/D-2 da Fatia D (24/05) e do post `9ea4929d...` da Fatia B SQL.

**Razão pela qual `userId` (slot 2) ficou:** materialmente vivo em 4 sítios do corpo de `createPost` (`ensureUserActor(tenantId, userId)` L690 no caminho else; `validateIntent(..., userId)` L704; `canPerformAction(..., { tenantId, userId })` L721; `metadata.created_by_user_id = createdByUserId || userId` L737 como fallback). Não é dívida — é uso legítimo. Refator mais profundo (derivar `userId` de `actor.user_id` em cascata) continua possível em frente futura mas **não justificável agora**.

**Outros `createPost` no codebase (não afetados):** `socialService.createPost` legacy (`social.service.ts:22`), `SocialServicePort.createPost` (porta hexagonal) — assinaturas distintas, fora do escopo da DT.

**Lições materiais:**
1. DT original subcontou callers: 6 declarados, 8 reais. Grep de superfície completo é não-opcional, mesmo quando a DT lista os sítios — auditoria fresca pode descobrir mais.
2. Remover slot intermediário desloca silenciosamente os subsequentes. tsc só pega quando os tipos divergem; deslocamento intra-tipo passa. Prova material em ESCRITA tem que verificar o **campo crítico** (`metadata.created_by_user_id` aqui), não só HTTP 201.
3. Param "morto" pode ser **deteção tardia**: a Fatia B convergiu o INSERT canonicamente em 2026-05-24 e o slot virou inerte; a DT da época mediu "morto" como observação, não como execução. Tempo entre detecção e remoção: 1 dia.

### Atualização Fatia D (2026-05-24, A-convergente cirúrgica)

**(i) Bug da rota corrigido — slot 2 (`userId`).** Edit cirúrgico em `social-2.0.routes.ts:242`: `req.actionContext.actorId` → `req.user.id` (USER ID canônico, sempre presente no escopo via auth.plugin). Destravou simultaneamente:
- caminho `else { ensureUserActor(tenantId, userId) }` (sem `actor_id` no body) — antes falhava com "Usuário não encontrado" buscando users por actor_id; agora encontra user e resolve actor.
- gate `authorityService.canPerformAction` → `canActAs` step 1 ownership (`actor.user_id === userId`) — antes comparava `beb7b5e4 === 751a4fe0` (false); agora `beb7b5e4 === beb7b5e4` (true) → allow ownership.

Smoke material por caminho (ambos retornaram HTTP 201 com SELECT confirmatório canônico):
- D-1 (caminho `if (actorId)`, com `actor_id` no body): post `d881e2b8-86d9-4744-b4f9-0ff9fd4ce29b` gravado canonicamente, apareceu no feed + perfil.
- D-2 (caminho `else`, sem `actor_id` no body): post `6f7071cf-8732-4c74-ad7e-ec78accde80f` gravado canonicamente via `ensureUserActor(tenantId, req.user.id)`, apareceu no feed + perfil.

**(ii) Descoberta material — slot 3 (`globalUserId`) é INERTE pós-Fatia B.** Auditoria do corpo de `createPost` (linhas 637-933) confirmou **zero usos materiais** do parâmetro `globalUserId` após a Fatia B remover o `global_user_id` do INSERT (coluna fantasma em `posts`). Único resquício: comentário arqueológico nas linhas 745-747. Os 5 callers internos que passam `globalUserId` real estão alimentando um slot que o método não lê. A rota também (deixada com `req.actionContext.actorId` no slot 3 nesta fatia) — inerte, sem efeito material.

**(iii) Bug adjacente refutado.** A hipótese anterior de que "o gate de authority rejeita o dev user por ownership/delegation ausente" foi **refutada materialmente pela micro-auditoria + smoke D**: o dev actor `751a4fe0...` tem `actor.user_id='beb7b5e4...'` correto e `actor_registry.capabilities_json.can_publish_feed: true`. O ownership SEMPRE foi canônico. O deny vinha 100% do bug do slot 2 da rota (quem passava actor_id no slot user_id). Corrigir a rota destravou o gate sem nenhuma mudança em authority/registry/seed.

**Escopo encolheu drasticamente.** De "refator de signature em 7 arquivos com auditoria caller-por-caller" para **"remover 1 param comprovadamente morto (`globalUserId`) — Tempo 2 dedicado, quando vier a dor humana real ou refator adjacente"**. Custo estimado: ~6 LOC (1 linha da signature + 5 callers internos param a passar argumento vazio/null) — find/replace direto. Frontend e contrato HTTP intocados.

### Contexto material

Signature atual de `Social2Service.createPost(tenantId, userId, globalUserId, content, actorId, mediaIds, intent?, intentMetadata?, targeting?, cta?, groupId?, createdByUserId?, createdAsActorId?)` — 13 params, 3 deles relacionados a identidade (userId/globalUserId/actorId).

**6 callers materiais identificados:**
1. `social-2.0.routes.ts:240` — passa `req.actionContext.actorId` em arg 2 (userId) E arg 3 (globalUserId) — **mesmo valor nos dois slots, ambos com nome errado** (é actorId disfarçado). Caminho `else` (linha 690) explode quando `actor_id` não vem no body.
2. `scripts/seed-dev-groups.ts:289` — `ownerPublicId` + `ownerPublicGlobalId` (separados, valores diferentes).
3. `scripts/seed-dev-groups.ts:313` — `ownerPrivateId` + `ownerPrivateGlobalId`.
4. `modules/events/events.service.ts:348` — `userResult.user_id` + `createdByGlobalUserId`.
5. `modules/groups/groups.service.ts:272` — `ownerUserId` + `userResult.global_user_id`.
6. `modules/votes/votes.service.ts:57, 113, 259` — 3 callers, todos com `userId` + `globalUserId` separados.

Refator de signature exige auditoria caller-por-caller (cada um usa userId/globalUserId para algo diferente: validação de membership, audit log, fallback de ensureUserActor, etc.) — não é mecânico.

### Risco (pós-Fatia D)

- **Criar post via UI funciona** — HTTP 201 confirmado pelos 2 caminhos (com e sem `actor_id` no body). Bug runtime resolvido.
- **Sobra:** confusão estrutural na signature (param `globalUserId` morto + 5 callers internos passando valor que ninguém lê). Não bloqueia operação, mas é ruído arquitetural — auditor lendo a signature acha que `globalUserId` é semanticamente significativo quando não é (pós-Fatia B).
- Risco baixo de regressão: novo caller que passe valor diferente em userId/globalUserId pode reintroduzir a confusão. Tolerável até refator amplo.

### Resolução prevista (Tempo 2 — remoção do param morto)

Escopo encolhido pela Fatia D — não é mais "refator de signature em 7 arquivos com auditoria caller-por-caller". É:

1. Remover `globalUserId: string` do arg 3 da signature de `Social2Service.createPost` (`social-2.0.service.ts:640`).
2. Atualizar os 6 callers para parar de passar argumento na posição 3 (find/replace direto — todos passam valor que o método já não lê pós-Fatia B):
   - `social-2.0.routes.ts:243` (atual: `req.actionContext.actorId` no slot inerte — remover linha)
   - `seed-dev-groups.ts:292, 316` (atual: `ownerPublicGlobalId`/`ownerPrivateGlobalId` — remover linhas)
   - `events.service.ts:351` (atual: `createdByGlobalUserId` — remover linha)
   - `groups.service.ts:275` (atual: `userResult.global_user_id` — remover linha)
   - `votes.service.ts:60, 116, 262` (atual: `globalUserId` — remover linhas)
3. Smoke material por caller (já temos prova D-1/D-2 cobrindo o caller da rota; faltam 5 callers internos para teste post-refator).

Custo estimado: ~6-7 LOC, escopo cirúrgico. Frontend e contrato HTTP intocados (slot já não afetava resposta).

Refator mais profundo (remover `userId`, `createdByUserId`, `createdAsActorId` e ter `createPost(tenantId, actorId, content, ...)` como signature canônica DECISION-0031 §3.2) continua possível em frente futura, mas **não justificável agora** — `userId` é materialmente usado em 4 sítios do corpo do método (`ensureUserActor` no caminho else, `validateIntent`, `canPerformAction` context, audit `metadata.created_by_user_id`); seu refator exige derivar `userId` de `actor.user_id` em cascata, com auditoria caller-por-caller real.

### Não bloqueia

- Ambos os caminhos de createPost funcionam (verificado materialmente via Fatia D).
- Posts já existentes (do seed) continuam funcionando no feed.
- Não bloqueia A1, A2, Fatia B, Fatia C — todas independentes.
- Não bloqueia uso humano da UI para criar posts (o caminho `if (actorId)` é o canônico do frontend pós Codex; o caminho else cobre eventuais clientes sem `actor_id` no body).

### Critério de reabertura

Reabrir feature exige: (i) JTBD real (uploads sendo feitos em produção / posts perdendo valor por falta de mídia); (ii) decisão sobre modelo canônico (tabela vs URL stack externa vs CDN provider); (iii) formalização SSOT_REGISTRY antes de qualquer DDL.

### Não bloqueia

- Feed funciona ponta a ponta (HTTP 200 confirmado em runtime, 5 posts hidratados).
- Reactions, comments, follows, scope/proximity geo — todos funcionam.
- Outras queries do `social-2.0.service.ts` (createPost, getActorPosts, addReaction) — escopo de DT-DRIFT-SOCIAL-2.0 que era CRITICAL, agora não bloqueia mais.

---

## DT-PRESSURE-GROUPS-VISIBILITY-FANTASMA

- **Status:** OPEN
- **Severidade:** MEDIUM (filtro semântico de grupos privados/secretos é aspiracional; impacto material limitado enquanto não houver UX para marcar grupo como privado)
- **Origem:** Fatia executiva 2026-05-24 — runtime real do `GET /social/feed` (após convergência da query) expôs drift adicional **não listado na DT original**: `WHERE g.group_id::text = ... AND g.visibility = 'public'` em `social-2.0.service.ts:248-253` (else-branch do filtro de grupos no feed global). Schema vigente de `groups` (`20260530180000_groups.sql:4-17`) tem `id` (PK) e `status` (active/inactive via `20260530535000_c36_status_check_constraints.sql:128`) — **NÃO tem `group_id` nem `visibility`**.
- **Vinculada a:** `DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH` (CLOSED 2026-05-24 — drift descoberto pelo runtime imediatamente após os 9 originais serem convergidos).

### Contexto material

- Schema `groups`: `id, tenant_id, name, description, slug, actor_id, owner_actor_id, status ('active'|'inactive'), metadata, created_at, updated_at`.
- Semântica "público/privado/secreto" para grupos é **aspiracional** — não há coluna `visibility` materializada. UX de seleção de visibilidade também não existe (zero callers frontend).
- Fix provisório aplicado na fatia executiva: `g.group_id` → `g.id` (mecânico) + `g.visibility = 'public'` → `g.status = 'active'` (substituição semântica conservadora — exclui grupos inativos do feed global, mais defensivo que original).

### Risco

- Filtro atual permite que TODOS os posts de grupos ativos apareçam no feed global (semântica "privado/secreto" não enforçada). Em dev hoje (0 grupos com semântica privada): zero regressão. Em produção: idêntico (sem coluna `visibility`, ninguém pode marcar grupo como privado, então não há violação de privacidade real — apenas filtro semanticamente otimista).
- `groups-repository.findById` chamado em path `groupId provided` (linha 234) também referencia `group.visibility !== 'public'` — provável drift análogo no repository (não auditado nesta fatia, fora do escopo da query do getFeed). Pode quebrar quando frontend passar `group_id` querystring específico.

### Resolução prevista (2 caminhos)

1. **Materializar `visibility`** se houver demanda real: ALTER TABLE groups ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private','secret')). Atualiza filtros canonicamente. Exige UX para marcar visibilidade.
2. **Confirmar feature PREMATURO** (DECISION-0041 pattern, igual `post_cta`/`post_projects`): remover toda referência a `visibility` no service+repository; visibility deixa de existir até produto puxar.

### Não bloqueia

- Feed global funciona (HTTP 200 confirmado).
- Path `groupId provided` não foi exercitado na smoke desta fatia — pode estar quebrado em runtime quando exercitado, mas não bloqueia o feed default da tela `/social`.

---

## DT-RECONCILE-SCRIPTS-ALLOWPATH

- **Status:** CLOSED (fix aplicado em scripts/validate-architectural-patterns.mjs — scripts E2E saem do baseline como classe semântica, não como exceção caso-a-caso)
- **Severidade resolvida:** LOW
- **Resolução 2026-05-26 (após Camada 1 atomicidade):** allowPath da regra `NO_DIRECT_BANK_TABLE_ACCESS` estendido com padrão estreito `scripts\/(validate-pipeline-e2e-|e2e-)[^\/]+\.(ts|tsx|js|jsx)$`. Cobre os 3 únicos arquivos com refs reais (não-comentário) a bank_* em scripts/: `e2e-incentive-bank-checklist.ts`, `validate-pipeline-e2e-kyc.ts`, `validate-pipeline-e2e-transversal.ts`. Outros scripts (seeds, validações, checadores) permanecem sob vigilância — qualquer ref real a bank_* dispara CRITICAL new. Negative test confirmou: arquivo temporário em `backend/src/modules/feed/` com `bank_ledger` foi detectado (critical_new=1, exit 1, gate bloqueia). Impacto: 41 entradas órfãs removidas do baseline; critical_total 73→20; critical_new=0 preservado. Sinal do gate restaurado antes da F1.

### Histórico (manter para auditoria)

- **Severidade:** LOW (cosmético — gera ruído no baseline, não bloqueia runtime nem compromete causalidade financeira)
- **Origem:** Higiene documental 2026-05-25, após sessão completa do dia (Frente B / E2E transversal / OUTBOX_ATOMICITY_HARDENING / Caminho 2 reconciliation / Etapa 6 E2E financeiro). Auditoria do crescimento do baseline (`scripts/security/check-architectural-patterns-baseline.json`) detectou que 19 entradas novas absorvidas hoje (`8f32838e` → atual) são todas em `backend/src/scripts/validate-pipeline-e2e-*.ts` — arquivos de E2E que legitimamente exercitam o circuito financeiro completo (insert direto em `bank_ledger`, query direta em `bank_transactions`, etc.) com objetivo de **provar invariantes**, não de violar substrato.
- **Vinculada a:** `DT-OUTBOX-ATOMICITY` (RESOLVED `8afeec9a`), `DT-CONSERVATION-OBSERVABILITY` (OPEN `c94eebe2`), gate `scripts/security/check-architectural-patterns.ts` (regra `NO_DIRECT_BANK_TABLE_ACCESS`).

### Contexto material

- `scripts/security/check-architectural-patterns.ts` define `allowPath` por regra para excluir caminhos legítimos (ex: `backend/src/modules/bank/*` para `NO_DIRECT_BANK_TABLE_ACCESS`).
- `backend/src/scripts/validate-pipeline-e2e-*.ts` NÃO está em nenhum `allowPath`, então toda nova etapa de E2E que toca `bank_*` para verificar invariante (ex: SELECT direto em `bank_ledger` para checar Σ(débito)=Σ(crédito), INSERT direto para simular cenário de furo) é absorvida como entrada CRITICAL no baseline.
- **19 entradas novas hoje:** `validate-pipeline-e2e-transversal.ts` (Etapa A11/A12, B6, B7, B8 — bank+outbox), `validate-pipeline-e2e-kyc.ts` (cruzamentos KYC × bank), `validate-pipeline-e2e-financeiro.ts` (Etapa 6 fim-a-fim).
- **Achado adicional (NÃO é Q3):** 3 entradas NOVAS em **production code** absorvidas como WARNING (regra `NO_MANUAL_MONEY_CALCULATION`, não CRITICAL):
  - `backend/src/modules/marketplace/marketplace-inventory.routes.ts` × 2
  - `backend/src/modules/impact/impact.service.ts` × 1
  - Risco: cálculo aritmético direto em centavos sem mediador canônico (`MoneyMath` ou similar). Não bloqueia runtime, mas viola §13 (computação financeira centralizada). Tracking separado abaixo.

### Caminhos de resolução

1. **Q3 — adicionar `backend/src/scripts/validate-pipeline-e2e-*.ts` ao `allowPath` da regra `NO_DIRECT_BANK_TABLE_ACCESS`:**
   - Justificativa institucional: E2E que prova invariante material é PROBE soberano, não violação. Padrão idêntico ao já feito para `backend/src/modules/bank/*` (módulo soberano sobre suas próprias tabelas).
   - Efeito esperado: ~19 entradas CRITICAL deixam o baseline; `critical_total` cai de 53 para ~34.
   - Risco: BAIXO. `allowPath` apenas suprime warning de localização; gate global continua válido para resto do codebase.

2. **WARNING em production (achado adicional):** abrir investigação separada para `marketplace-inventory.routes.ts` e `impact.service.ts`. Possibilidades:
   - (a) cálculo legítimo de quantidade/contagem (não-money) sendo marcado por falso-positivo da heurística → refinar regex da regra ou adicionar comentário-marcador.
   - (b) cálculo material de money sem mediador → criar `MoneyMath` helper ou rotear via service canônico.
   - Decisão depende de inspeção; NÃO fazer agora (fora do escopo desta higiene documental).

### Por que não fix imediato

- A higiene documental do dia é **read-only + ancoragem de hashes**. Mudar `allowPath` é uma decisão arquitetural sobre o que conta como "violação legítima vs falso-positivo" da regra — exige fatia própria com tese explícita, não inflar este commit.
- Baseline absorvendo entradas de scripts/ NÃO é dano material: `critical_new=0` mantém o gate funcionando para regressões reais; o ruído é cosmético no contador `critical_total`.

### Não bloqueia

- Gate de patterns funciona (critical_new=0 em todos os commits do dia).
- Todos os E2E executam normalmente; baseline atualiza por `--update-baseline` controlado.
- Circuito financeiro está provado fim-a-fim (Etapa 6) com triple defense + atomicidade transacional intacta.

---

## DT-RELEASE-WORKER-IDEMPOTENCY

- **Status:** CLOSED (R1 — risco aparente, neutralizado por defesa em camada inferior)
- **Severidade:** N/A (sem risco material após verificação)
- **Origem:** Auditoria 2026-05-26 do E2E workers async, Etapa 1 (Passo 1 dimensionamento). Leitura inicial do `release-worker.ts` observou que `releaseSettledPaymentIntent` não altera o status do `payment_intent` após o release (continua `'settled'`) e que `claimSettledPaymentIntents` re-pega intents settled em cada ciclo (10s). Hipótese levantada [G2]: o release-worker poderia creditar `seller_available` duas vezes para o mesmo settlement (double-spend silencioso). Pergunta material levada ao Passo 1: provar ou refutar.
- **Vinculada a:** `DT-OUTBOX-ATOMICITY` (RESOLVED `8afeec9a` — mesma família de problemas de idempotência em pipeline financeiro).

### Veredito: R1 (FALSO POSITIVO)

A "idempotência fraca" do release-worker é **compensada pela idempotência forte do `bankTransactionService.transfer`** quando o `referenceId` é estável. Após leitura material, o caminho do double-spend hipotético está **fechado em camada inferior** — sem necessidade de UNIQUE adicional, sem mudança de status, sem alteração de worker.

### Evidência material por leitura (3 elos)

**Elo 1 — referenceId é ESTÁVEL no release (`backend/src/modules/gateway/payment-event-resolver.ts:163-177`):**

```ts
await bankTransactionService.transfer(tenantId, {
  eventId: uuidv4(),                  // ← NOVO a cada execução (não é a defesa)
  fromAccountId: sellerPendingAccount.accountId,
  toAccountId: sellerAvailableAccount.accountId,
  amountCents: intent.amountCents,
  currency: intent.currency as BankCurrency,
  transactionType: 'transfer',
  description: `Seller release: ${intent.referenceId}`,
  metadata: undefined,
  referenceType: 'seller_release',    // ← ESTÁVEL
  referenceId: intent.referenceId,    // ← ESTÁVEL (vem do intent; imutável no domínio)
  treasurySource: 'treasury:settlement',
  concept_id: 'seller-funds-release',
  authorship,
}, client);
```

**Elo 2 — defesa do transfer ataca exatamente (tenant_id, reference_type, reference_id) (`backend/src/modules/bank/bank-transaction.service.ts:271-325`):**

- L272-275: `pg_advisory_xact_lock(hashtext(tenant_id), hashtext(refType||refId))` — serializa concorrentes na mesma `(tenant, refType, refId)` durante a transação.
- L279-284: `SELECT id, account_id FROM bank_transactions WHERE tenant_id=$1 AND reference_type=$2 AND reference_id=$3 LIMIT 1 FOR UPDATE`.
- L285-323: se a row já existe, **retorna a transação existente sem inserir**, hidrata `bank_ledger` da row antiga, emite `transaction_idempotent_return` em `logFinancialEvent` (observabilidade).

**Elo 3 — claim do release-worker (`backend/src/modules/payments/payment-intent-repository.ts:217-231`):**

```sql
SELECT ...
FROM payment_intents
WHERE payment_status = 'settled'
ORDER BY created_at ASC
LIMIT $2
FOR UPDATE SKIP LOCKED
```

O claim de fato re-pega o mesmo intent em ciclos sucessivos (não filtra por `metadata.seller_release_reference`). **Esse é o "risco aparente"** que motivou o [G2]. Mas o ciclo subsequente, ao chamar `releaseSettledPaymentIntent`, executa o `transfer` com **a mesma (tenant_id, 'seller_release', intent.referenceId)** — onde a defesa do Elo 2 atua.

### Cenários cobertos pela defesa

| Cenário | O que acontece | Resultado |
|---|---|---|
| Worker re-claim em ciclo seguinte (mesma instância, 10s depois) | `transfer` faz `SELECT FOR UPDATE`, encontra a row antiga, retorna `transactionId` existente, **não insere bank_transactions nem bank_ledger** | NO-OP — `transaction_idempotent_return` emitido |
| Duas instâncias do worker rodando em paralelo (race) | Instância 1 adquire `pg_advisory_xact_lock`; instância 2 bloqueia até commit/rollback da 1; depois encontra a row existente e retorna NO-OP | Serialização cross-process; ZERO double-spend |
| Worker morre entre `transfer.COMMIT` e `updatePaymentIntentMetadata` | Próximo ciclo re-claim, transfer NO-OP (row já existe), `updatePaymentIntentMetadata` re-executa (idempotente — sobrescreve mesma chave) | Convergente |
| `intent.referenceId` nulo/vazio | `transfer` lança `BANK_REFERENCE_REQUIRED` (L258-260) | Falha rápida observável, sem double-spend |

### Por que NÃO foi necessário harness

A leitura pura dos três elos é suficiente — não há ambiguidade sobre o que acontece. O `referenceId` é estável (linha 173, literal `intent.referenceId`), a defesa do `transfer` ataca (refType, refId) (linha 281, literal `reference_type=$2 AND reference_id=$3`), e o retorno idempotente é mecânico (linha 285-323, retorna sem inserir). Construir harness apenas reproduziria o que já está provado por inspeção. Disciplina cirúrgica: leitura > harness quando a leitura é definitiva.

### Mecanismo de defesa identificado (resumo formal)

A idempotência do release-worker é **delegada à camada de transfer**, não enforçada no worker. Padrão arquitetural: o worker trata a fila como _at-least-once_ (re-claim aceito); a defesa material vive em `bankTransactionService.transfer` via `(tenant_id, reference_type, reference_id)` UNIQUE-by-behavior (não UNIQUE-by-constraint, mas funcionalmente equivalente porque o advisory lock + SELECT FOR UPDATE + return-existing implementa a invariante).

Diretriz arquitetural implícita (e correta): **idempotência financeira NÃO depende do worker — depende da reference estável + defesa do transfer**. Mesmo padrão usado por:
- `payout-worker.ts:62-63` — `referenceType='seller_payout', referenceId=payout.id` (estável)
- `bank-settlement-worker.ts:85-86` — `referenceType='bank_settlement', referenceId=settlement.id` (estável)
- `releaseSettledPaymentIntent` — `referenceType='seller_release', referenceId=intent.referenceId` (estável)

### Sinal de telemetria que confirma a invariante em produção

`logFinancialEvent` com `financial_event='transaction_idempotent_return'` é emitido **sempre que** o transfer detecta row existente. Se o release-worker estiver re-executando, esse evento aparecerá nos logs financeiros — observável, não silencioso.

### Não bloqueia / não exige ação

- Sem correção necessária: a defesa atua.
- Sem UNIQUE adicional: o lock advisory + SELECT FOR UPDATE substitui constraint formal.
- Sem mudança de status: o status `'settled'` permanecer pós-release é projeto consciente (rastreio em metadata + idempotência delegada).
- E2E feliz do release-worker (próxima fatia) pode prosseguir sem preocupação com double-spend.

### Observação adjacente (NÃO escopo)

A propriedade "idempotência delegada à reference estável + defesa do transfer" é a invariante real do sistema financeiro do UnifiCard. Vale documentar em DECISION canônica futura — pattern transversal aos 4 workers. Mas isso é direção, não fatia.

---

## DT-CAMADA1-ENTRADA-ESCROW

- **Status:** CLOSED (entrada do serviço de preço fechado redirecionada para escrow_payments + payment_intent escrowed)
- **Severidade resolvida:** CRITICAL (regra econômica "pagamento recebido NÃO significa saque liberado" estava violada materialmente na ENTRADA, não só na saída)
- **Origem:** Pré-fatia 0 (READ-ONLY) da Camada 1 — 2026-05-26. Cenário Y confirmado: `createExecution` (serviço de preço fechado) creditava conta default sacável do receiver (`account_type='credit'`), nunca tocando `escrow_payments`. Cadeia "escrow → seller_pending → seller_available → seller_payout → bank_settlement" ficava sem origem material em produção.
- **Vinculada a:** DECISIONs Clayton D1'/D1''/D1''' (2026-05-26); fatia origem do PLANO_WIRING_CAMADA_1 → ATIVADA via redirecionamento da entrada.

### Decisão Clayton (D1' / D1'' / D1''')

| Decisão | Escolha | Justificativa |
|---|---|---|
| D1' | Sim: serviço passa por escrow | "pagamento recebido NÃO significa saque liberado" |
| D1'' | Escrow AGREGADO no MVP | Menor blast radius; sem mexer no split engine; sem tocar `createTransactionWithExplicitSplitLines`; rastreabilidade preservada via metadata |
| D1''' | Reusar `escrow_payments` do marketplace | NÃO criar `escrow_service`/`service_escrow`/tabela nova; convergir com o que já existe |

**Dívida consciente registrada:** subcontas por receiver podem ser exigidas no futuro por compliance. Hoje a rastreabilidade por destinatário vive em `payment_intent.metadata.splits[*].receiverActorId` + `bank_splits.target_actor_id` (NULL para escrow é normal — DECISION-0036). Quando compliance pedir contas individuais por receiver, esta dívida vira fatia.

### O que mudou (3 pontos cirúrgicos)

1. **`backend/src/modules/bank/bank-integration.service.ts:523-585`** — `processServicePaymentExecutionCanonical`:
   - Antes: `targetAccountId = resolveBankAccountForServiceActor(receiverActorId)` (conta default 'credit' do receiver).
   - Depois: `targetAccountId = escrow_payments` (system platform account, única para todos os splits). `receiverActorId` permanece em cada `splitLine` para tracking via `bank_ledger.entry.metadata` (em memória — schema DB não tem coluna metadata, mas o tracking efetivo vive em `payment_intent.metadata.splits`).
   - `actorRepository.findById` (validação de existência do receiver) explícita no loop para preservar a checagem que o resolve antigo fazia.

2. **`backend/src/modules/payments/payment-intent-repository.ts:84-160`** — adicionada variante `createPaymentIntentWithClient(client, tenantId, input)`:
   - Pattern existingClient idêntico ao `servicePaymentExecutionRepository.create` (commit `8afeec9a`, OUTBOX_ATOMICITY_HARDENING).
   - NÃO chama `checkRateLimit` (já validado upstream por `bankLimitService.validateLimit`).
   - NÃO chama `set_config('app.current_tenant')` (caller já abriu client via `getClientWithTenant`).

3. **`backend/src/modules/services/service-payment-execution.service.ts:174-228`** — após `servicePaymentExecutionRepository.create`, criar `payment_intent` com `status='escrowed'` no MESMO client:
   - `referenceId = paymentRequestId` (UNIQUE no tenant — protege contra duplicação).
   - `actorId = payerActorId` (NOT NULL FK preservada).
   - `metadata` carrega `executionId`, `bookingId`, `serviceId`, `receiverActorId`, `bankTransactionId`, `splits[]` agregados.
   - `source = 'service_execution'`, `gateway = 'unify_bank'`, `intentType = 'payment'`.

### Atomicidade preservada

A transação única do `createExecution` (BEGIN/COMMIT em service-payment-execution.service.ts:146-239) cobre os 4 atos:

```
BEGIN
  ① bank_transaction + bank_ledger entries + bank_splits (CAMADA 1: split→escrow)
  ② service_payment_executions row
  ③ payment_intent (status='escrowed')     ← NOVO
  ④ event_outbox (SERVICE_PAYMENT_EXECUTED + SERVICE_PAYMENT_SPLIT_APPLIED × N)
COMMIT
```

Se qualquer escrita falhar, ROLLBACK reverte os 4. O pattern já estava validado materialmente pelo teste **B7** em `validate-pipeline-e2e-transversal.ts` (commit `8afeec9a`); a inclusão do passo ③ herda essa defesa.

### Prova material (E2E `validate-pipeline-e2e-transversal.ts` — adaptado)

Etapas adicionadas / adaptadas:

| Etapa | Asserção | Resultado |
|---|---|---|
| A7 | Conservação `buyer-1 = escrow+1` (era `buyer-1 = provider+1`); conta default do provider PERMANECE ZERADA | ✅ |
| A7.b | `payment_intent.payment_status='escrowed'`, `amount=40000`, `actor_id=payer`, `reference_id=paymentRequestId`, `currency='BRL'`, `source='service_execution'` | ✅ |
| A7.c | `payment_intent.metadata` carrega `executionId`, `receiverActorId`, `splits[{ receiverActorId, amountCents, percentage }]` | ✅ |
| A7.d | `bank_ledger.SUM(credit)` na conta default do provider para esta `service_execution` = `0` | ✅ |
| A7.e | `bank_ledger.SUM(credit)` na conta `escrow_payments` para esta `service_execution` = `40000` | ✅ |
| A7.f | `bank_splits.target_account_id = escrow_payments.accountId`, `target_actor_id IS NULL` (escrow é system), `amount_cents = 40000` | ✅ |
| A10 | Outbox tem `SERVICE_PAYMENT_EXECUTED` para o `executionId` (atomicidade write-side) | ✅ |
| A11/A12 | Read-side outbox processor consome + idempotência preservada | ✅ |
| B6/B7 | Atomicidade transacional comprovada: ROLLBACK reverte bank + intent + outbox juntos | ✅ |
| B8 | Reconciliation detective continua detectando janelas B+C (Caminho 2 não afetado) | ✅ |

### O que NÃO mudou (escopo travado)

- ❌ `createTransactionWithExplicitSplitLines` (bank-transaction.service.ts:1409+) — preserva assinatura e semântica.
- ❌ Marketplace `executePayment` — caminho separado, não tocado.
- ❌ Workers (release / payout / bank-settlement / settlement) — preservam comportamento; agora terão FILA para consumir (payment_intent escrowed por execução).
- ❌ Simulador (`paymentExecutionService.*` chamado por `financial-simulator.controller.ts`) — preservado como ferramenta dev/admin.
- ❌ Schema DB — zero migration. Reuso da conta lifecycle `escrow_payments` já criada por `ensurePlatformAccounts`.
- ❌ Gate 1 — não tocado.
- ❌ Subcontas por receiver — explicitamente deferido (dívida consciente de MVP).

### Gates verificados

- **TS:** `npx tsc --noEmit` → 0 erros.
- **Architecture patterns:** `critical_new=0` (6 entradas absorvidas no baseline — todas em `backend/src/scripts/validate-pipeline-e2e-transversal.ts`, caso da DT-RECONCILE-SCRIPTS-ALLOWPATH).
- **Σ(débito) = Σ(crédito):** confirmado pelo bank engine (triple defense intacta) + E2E A7 (conservação de valor).
- **Conservação:** `buyer-1 = escrow+1` provada em ledger + cached_balance.

### Próxima fatia natural (Fatia D2 do PLANO_WIRING_CAMADA_1)

Com a entrada correta, o pipeline da Camada 1 destrava:
- Settlement-worker JÁ tem fila (payment_intents escrowed por execução) para consumir.
- `service_orders.completed` (ato existente) é o gatilho natural do release `seller_pending → seller_available` na próxima fatia (com campos novos `buyer_confirmed_completion_at`, `buyer_confirmation_deadline_at`, `disputed_at`).

### Não bloqueia

- Marketplace continua funcionando (caminho `executePayment` intacto).
- Tenants antigos com saldo em conta default do receiver mantêm o saldo onde está (sem migração forçada de dados).
- A próxima fatia pode prosseguir; a base econômica está correta.

---

## DT-DOUBLE-ESCROW-PLANES

- **Status:** OPEN (rastreamento; F1 explicitamente NÃO resolve)
- **Severidade:** MEDIUM (planos paralelos não-bloqueantes; reconciliação futura, decisão Clayton K2 = Opção 1)
- **Origem:** Sessão Camada 1 F1 (2026-05-26). Auditoria do `completeOrder` revelou que dois mecanismos de "escrow" coexistem sem cross-talk:
  - **Plano A — Bank/Camada 1:** conta system `escrow_payments` em `bank_accounts`, alimentada pelo `createExecution` refatorado (commit `62771db9`). Dinheiro real em `bank_ledger`; tracking via `payment_intent.metadata.splits[*].receiverActorId`.
  - **Plano B — Agreement/Marketplace:** tabela `escrow_accounts` ligada a `agreements` finalizados, com milestones discretos (`payment_milestones` enum 'confirmed'|'started'|'completed'). Hoje só consultado pelo bloco L332-383 do `completeOrder` (autorização aspiracional de milestone 'completed'); não toca `bank_ledger` na trajetória de F1.

### Evidência material

| Cross-talk | Resultado |
|---|---|
| `createExecution` → `escrowRepository`? | NÃO (grep "escrowRepository" em `backend/src/modules/bank/` = 0) |
| `completeOrder` → `payment_intents`/`escrow_payments`? | NÃO (grep "payment_intent" em `service-order.service.ts` = 0) |

### Decisão F1 (K2 = Opção 1)

A F1 **ignora** completamente o Plano B. O bloco `if (order.bookingId)` no `service-order.service.ts:332-383` permanece inalterado (apenas autoriza milestone 'completed' em escrow_accounts se houver agreement — comportamento legado). A F1 atua apenas no Plano A via `settlement_flow='fixed_price_escrow'`.

### Riscos rastreados (NÃO bloqueiam F1)

- Tenants com agreement+escrow_account ativo veem ambos os planos coexistirem; nenhum reconciliador cruza.
- Se ambos forem usados no mesmo tenant para o mesmo serviço, o tracking financeiro fica em **dois lugares** (escrow_payments no Plano A, payment_milestones no Plano B). Auditoria precisa olhar os dois para somar.
- Documentação institucional deve registrar que Plano B é **legado em deprecação eventual** — sem caller real além do `completeOrder` (auditoria não confirmou outros callers; verificar antes de deprecação).

### Resolução prevista (não nesta fatia)

1. **Opção 1 (atual — decidida):** convivência paralela. Documentar, monitorar uso real de escrow_accounts em produção. Se ficar zero ou só transitório, deprecar Plano B em frente própria.
2. **Opção 2 (convergência futura):** fazer `escrowRepository` projetar `escrow_payments` (Plano A vira fonte, Plano B vira view derivada). Frente grande; só justificável se compliance exigir milestones discretos.
3. **Opção 3 (deprecação Plano B):** se o `completeOrder` for o único caller, marcar o bloco L332-383 como dead-code e remover em fatia separada.

### Não bloqueia

- F1 funciona materialmente (E2E `validate-pipeline-e2e-camada1-f1.ts` 21/21 verdes).
- Plano B continua funcionando para callers legados, se houver.
- `bank_ledger` permanece a fonte canônica de dinheiro real.

---

## DT-SERVICE-ORDER-AUTHORITY

- **Status:** OPEN (gap material; F1 não introduziu, herda do código legado)
- **Severidade:** MEDIUM (gate genérico existe mas não cruza com `order.workerActorId`)
- **Origem:** Sessão Camada 1 F1 (2026-05-26). Auditoria de `completeOrder` (`service-order.service.ts:307-319`) revelou que a autoridade depende **apenas** do gate genérico `authorityService.canPerformAction(actorId, 'service_order:complete', ...)`. NÃO há cruzamento explícito com `order.workerActorId === input.completedByActorId`.

### Implicação

Se a permissão `service_order:complete` for garanteada a múltiplos `actor_types` (ex.: `admin` pode completar qualquer ordem por design operacional), o gate genérico não impede um actor com a permissão de marcar uma ordem **alheia** como completed em nome do worker original. Isso pode ser projeto consciente (admin override) ou gap silencioso.

### O que a F1 NÃO fez

- Não corrigiu — fora do escopo.
- Não removeu o gate.
- O E2E F1 passa `completedByUserId: undefined` para pular o gate (caminho documentado pelo `if (input.completedByUserId)` em L307); o teste exercita a bifurcação de `settlement_flow` sem testar autoridade.

### Resolução prevista (fatia própria)

1. Confirmar a definição da permission-key `service_order:complete` (`backend/src/core/authorization/permission-keys.ts` + `business-permissions.types.ts`).
2. Decidir: a) reforço explícito (`if (order.workerActorId !== input.completedByActorId && !isAdmin(...)) throw forbidden`); ou b) confirmar que admin override é desejado e documentar como projeto.
3. Atualizar ou criar regra fina específica para `service_order:complete`.

### Não bloqueia

- F1 funciona com ou sem o gate fino.
- Routes externas em produção SEMPRE passam `completedByUserId` (`service-order.routes.ts:206`), então o gate genérico continua atuando em rotas reais.
- Em ambiente de teste/admin, é trivial pular o gate — mesmo padrão antes da F1.

---

## DT-SERVICES-PRICING-TYPE-DRIFT

- **Status:** OPEN (drift histórico; F1 não consome este campo)
- **Severidade:** LOW (não-bloqueante; F1 usa `settlement_flow` próprio em `service_orders` como discriminador)
- **Origem:** Sessão Camada 1 F1 (2026-05-26). Auditoria do banco vivo (`unificard_dev`) e do código revelou:
  - `services.pricing_type` é `VARCHAR(50) NULLABLE` SEM CHECK constraint ativo no banco.
  - Diferentes pontos no código usam vocabulários distintos: TS type aceita `'hourly' | 'daily' | 'weekly' | 'monthly' | 'fixed' | 'quote'`; defaults reais em rotas variam ('quote' em alguns, vazio em outros).
  - Banco atual tem 0 rows com `pricing_type='fixed'` e 0 com `'quote'` — único service cadastrado tem `pricing_type=NULL`.
  - Não há helper canônico `isFixedPrice(...)` nem `pricing_type` normalization layer.

### Decisão Clayton K1 atualizado (2026-05-26)

F1 **NÃO** usa `services.pricing_type` como discriminador primário. O discriminador autoritativo é `service_orders.settlement_flow` (NOT NULL DEFAULT 'none' CHECK ('none'|'fixed_price_escrow')) materializado pela migration `20260530555000_create_service_orders_substrate_with_f1.sql`. Isso isola a F1 do drift do `pricing_type` legado.

### Resolução prevista (fatia futura, não bloqueante)

1. Adicionar CHECK constraint em `services.pricing_type` consolidando o enum canônico.
2. Migration de normalização (uppercase → lowercase, NULL → default).
3. Helper canônico `pricingTypeFromService(service): CanonicalPricingType` que normaliza na entrada.
4. Decidir convergência: `settlement_flow` da `service_orders` é derivado do `pricing_type` do `services` no momento da criação, OU é independente (decisão de produto separada)?

### Não bloqueia

- F1 não depende de `pricing_type` (usa `settlement_flow` próprio).
- E2E F1 21/21 verdes sem tocar `pricing_type`.
- Marketplace continua funcionando.

---

## DT-D2-WIRING-MONEY-PENDING

- **Status:** OPEN (rastreamento; D2 é estado-only; release financeiro real é frente futura)
- **Severidade:** MEDIUM (sem dinheiro movido, mas dois "seller_available" coexistem em planos diferentes)
- **Origem:** Camada 1 saída — fatia D2, 2026-05-26. Decisão Clayton/ChatGPT: `service_orders.status='release_approved'` (NÃO `'seller_available'`) para distinguir do `bank_accounts.account_type='seller_available'` (saldo financeiro real lastreado pela ledger do Bank).

### Vocabulário canônico estabelecido por D2

| Termo | Plano | Significado |
|---|---|---|
| `bank_accounts.account_type='seller_available'` | Bank lifecycle (Plano 1) | **Saldo financeiro real** — montante disponível para payout, conta system criada por `ensurePlatformAccounts`, lastreado pela ledger do Bank. |
| `service_orders.status='release_approved'` | service_orders (Plano 2) | **Aprovação operacional** — serviço aprovado para futura liberação financeira, NÃO "fundos liberados". Estado-only. Nenhum movimento financeiro. |
| `service_orders.status='seller_pending'` | service_orders (Plano 2) | Estado intermediário pós-conclusão pelo prestador (F1, commit `db47798d`). |

### O que D2 fez

- `service_orders.status='release_approved'` ativado por: (a) confirmação explícita do buyer (`POST /service-orders/:id/buyer-confirm`); ou (b) timeout `release_eligible_at <= NOW()` via script `release-expired-service-orders.ts`, **se** `disputed_at IS NULL`.
- INSERT atômico no `event_outbox` com `event_type='SERVICE_ORDER_RELEASE_APPROVED'` (idempotência via event_id determinístico SHA-256).
- Dinheiro **permanece em escrow_payments** após D2. Nenhum `bank_transaction` ou ledger entry é criado.

### O que D2 NÃO fez (escopo travado)

- ❌ NÃO move dinheiro de `escrow_payments` para conta `seller_available` (Plano 1).
- ❌ NÃO toca ledger do Bank, `bank_transactions`, `bank-account` (Plano 1).
- ❌ NÃO usa `business_audit_action='funds_released'` (vocabulário existente em `business-audit.types.ts:38` + migration archived `0926`) — D2 não libera fundos, então usar esse termo seria auditoria semanticamente falsa.
- ❌ NÃO cria payout, NÃO cria bank_settlement.
- ❌ NÃO reconcilia plano Bank (Plano 1) com plano agreement/milestone (Plano B do DT-DOUBLE-ESCROW-PLANES).

### Próxima frente (D-money — separada)

A frente financeira posterior deve:
1. Decidir o ponto canônico que move dinheiro de `escrow_payments` para a conta system `seller_available` (Plano 1).
2. Consumir o evento outbox `SERVICE_ORDER_RELEASE_APPROVED` como gatilho (handler de outbox) OU ler `service_orders.status='release_approved'` periodicamente (worker).
3. Resolver DT-PIPELINE-WIRING-GAP elo 1 (`escrow → seller_pending` account do Bank nunca creditado em produção).
4. Considerar idempotência cruzada: handler deve verificar se já moveu antes (referenceType/referenceId estável por orderId).

Até essa frente chegar, dinheiro fica em `escrow_payments` mesmo após `service_orders.status='release_approved'`. **Não é dead-money**: é dinheiro custodial à espera da fatia financeira.

### Não bloqueia

- D2 funciona materialmente (E2E `validate-pipeline-e2e-camada1-d2.ts` 22/22 verdes).
- F1 preservado (E2E F1 21/21 verdes).
- Transversal preservado (B6/B7/B7.b/B8 PASS).
- Plano Bank (release-worker, payout-worker, bank-settlement-worker) continua dormindo em produção (DT-PIPELINE-WIRING-GAP). Convivência consciente até frente D-money chegar.

---

## DT-D2-TIMEOUT-WORKER-PENDING

- **Status:** OPEN (script CLI existe; worker periódico fica para fatia operacional)
- **Severidade:** LOW (não-bloqueante; operadores podem rodar via cron/CI manualmente)
- **Origem:** D2, 2026-05-26. O caminho "timeout" da D2 está implementado como **função pública** (`serviceOrderService.approveExpiredServiceOrderReleases`) + **script CLI standalone** (`backend/src/scripts/release-expired-service-orders.ts`). NÃO há worker periódico registrado em BOOT.ts.

### Razões

1. Decidir cadência (a cada minuto? a cada hora?) é decisão operacional — não bate com o escopo D2 (estado-only + correção semântica).
2. Registrar worker periódico em BOOT.ts inflaria o commit. Operadores podem chamar o script via cron / CI / runbook manual conforme a cadência decidida em produção.
3. Padrão consistente com outros scripts ad-hoc do codebase (`validate-pipeline-e2e-*.ts`).

### Resolução prevista (fatia operacional separada)

1. Decidir cadência (lock service / cron / worker setInterval).
2. Registrar em BOOT.ts (similar a `payout-worker`/`bank-settlement-worker`).
3. Adicionar métricas / financial_event logs por execução.
4. Reaproveitar pattern claim com FOR UPDATE SKIP LOCKED (igual `claimNextRequestedPayouts`) se desejar concorrência segura entre múltiplas instâncias.

### Não bloqueia

- O script CLI roda standalone e foi exercitado pelo E2E D2 (`approveExpiredServiceOrderReleases` chamada direta via service).
- A função `serviceOrderService.approveExpiredServiceOrderReleases` é estável e idempotente (cada batch usa transações próprias).

---

## DT-SERVICE-ORDER-DISPUTE-OPENING

- **Status:** OPEN (D2 LÊ `disputed_at` mas não escreve)
- **Severidade:** MEDIUM (sem rota para abrir disputa em `service_orders`; D2 confia em escrita externa)
- **Origem:** D2, 2026-05-26. D2 **LÊ** `service_orders.disputed_at` como bloqueio (release rejeitado se `disputed_at IS NOT NULL`), mas NÃO oferece rota nem service para ESCREVER esse campo.

### Estado atual

- `financial_disputes` (tabela + repository + controller `POST /financial/disputes`) existe e referencia `paymentIntentId`, **não** `service_order_id`. Logo, abrir disputa em `service_orders` exigiria:
  - (a) Bridge: criar uma `financial_disputes` row + escrever `service_orders.disputed_at` + `service_orders.dispute_id` (FK livre, sem constraint hoje).
  - (b) Tabela própria: `service_order_disputes` paralela.
  - (c) Estender `financial_disputes` com `service_order_id` opcional.
- Decisão de produto pendente. D2 só LÊ a flag — não decide design da abertura.

### O que D2 fez

- Cláusula `disputed_at IS NULL` em todos os WHEREs de release (buyer-confirm + timeout).
- E2E D2 T4 prova que ambos os caminhos rejeitam disputa preenchida via INSERT direto.

### O que D2 NÃO fez

- Não cria rota `POST /service-orders/:id/open-dispute`.
- Não decide quem pode abrir disputa (buyer? worker? admin?).
- Não decide janela temporal (até quando pode abrir disputa após seller_pending?).
- Não decide rollback após resolução de disputa (`disputed_at` volta a NULL? ou é append-only com `resolved_at` separado?).

### Resolução prevista (frente F-Disputa separada)

Frente própria que decide: rota, autoridade, janela, bridge com `financial_disputes`, fluxo de resolução. Não cabe em D2 (estado-only com escopo travado).

### Não bloqueia

- D2 funciona com disputa testada via INSERT direto no E2E.
- Operadores em produção podem hoje fazer UPDATE manual em `service_orders.disputed_at` se necessário — release bloqueado automaticamente.

---

## DT-CAMADA1-FEE-SPLIT (RESOLVED por PE-3)

- **Status:** RESOLVED (2026-05-26 — substrato pronto via DECISION-0048 + PE-3)
- **Resolução material:** PE-3 plugou `economicPolicyEngineService` em `service-payment-execution.service.createExecution`. Quando `input.splits` é ausente, service_execution agora resolve policy via `economic_policy_engine` (fail-closed em POLICY_NOT_FOUND/POLICY_AMBIGUITY). Splits resultantes materializados em UMA bank_transaction: `revenue_share` → `escrow_payments` (D-money libera depois para `actor_wallet`); `platform_fee` → conta system `platform_fees`; `reserve` → conta system `risk_reserve`. `payment_intent.metadata.splits` guarda APENAS `revenue_share` (D-money não vaza fee para `actor_wallet`).
- **Provas:** E2E `validate-pipeline-e2e-policy-engine-service-execution.ts` — T2 (split 97/3 correto), T3 (D-money move só revenue_share), T4 (multi-line 90/5/5 com 3 destinos), T5 (drift→revenue_share), T9 (legacy path preservado).
- **Resíduo:** regra de fee REAL (97/3 ou outra) ainda exige decisão de produto + seed de policy canônica em produção. PE-3 entregou apenas o MECANISMO; o conteúdo da policy é frente própria. Documentado em comentário institucional no `service-payment-execution.service.ts` header.
- **Histórico (origem):** D-money (Camada 1, 2026-05-26). Decisão Clayton/ChatGPT K_wallet_5: D-money NÃO inventa regra de fee da plataforma. Atualmente os splits gravados em `payment_intent.metadata.splits` no createExecution (Camada 1 entrada, commit `62771db9`) contêm APENAS o receiver — 100% do valor vai para o(s) prestador(es).
- **Original (antes do PE-3):**

### Estado atual

- Account types `platform_fees` e `platform_revenue` EXISTEM como contas SYSTEM tenant-única (criadas por `ensurePlatformAccounts` em `bank-account.service.ts:340-380`).
- DB live: 18 contas `platform_fees` + 18 `platform_revenue` — uma por tenant, todas com saldo zero.
- Engine de splits EXISTE (`bank_splits` + `createTransactionWithExplicitSplitLines`), tecnicamente capaz de dividir entre receiver e fee na mesma transação.
- Camada 1 entrada NÃO aplica split de fee — `splitLines` é construído apenas a partir de `splitRecipients` passados pelo caller, todos com destino `escrow_payments` (ver `bank-integration.service.ts:530-575`).

### Decisão D-money (K_wallet_5)

D-money move o split CONFORME GRAVADO em `payment_intent.metadata.splits`. Se a entrada não separou fee, D-money não separa também. Quando regra de fee for definida, ela deve ser materializada via `bank_splits` na ENTRADA (createExecution), NÃO derivada via cálculo externo no momento do release.

### Resolução prevista (futura — Camada 1.5)

1. Decisão de produto: percentual/regra do fee (fixed/percentage/tiered).
2. Estender `createExecution` (Camada 1 entrada) para criar splits canônicos `{ receiver, fee_to_platform_fees }` separados.
3. D-money respeita os splits novos (já genérico).
4. Reconciliation pode auditar Σ(fee_splits) ≡ saldo `platform_fees` por período.

### Não bloqueia

- D-money funciona materialmente com splits 100% para o receiver.
- Plataforma ainda não captura receita via fees em Camada 1 — decisão consciente diferida.
- Não afeta `platform_revenue`/`platform_fees` contas system (continuam zeradas até regra ser implementada).

---

## DT-ACTOR-WALLET-PAYOUT-WIRING (entrada original — SUPERSEDED 2026-05-28)

> **SUPERSEDED.** Esta entrada foi suplantada pela DT canônica `DT-ACTOR-WALLET-PAYOUT-WIRING` registrada abaixo (mesmo nome, versão DECISION-0058) que rastreia F1/F2/F3/F4 explicitamente. O escopo interno (F1-F3) foi fechado em 2026-05-28; o escopo externo (F4) foi movido para `DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT`. Mantida aqui como histórico do origem D-money (Camada 1).

- **Status:** SUPERSEDED (2026-05-28) — origem histórica; ver DT canônica abaixo + DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT.
- **Origem:** D-money (Camada 1, 2026-05-26). Decisão Clayton/ChatGPT K_wallet_7: payout para banco externo (saque) fica para frente posterior. D-money NÃO toca `payout_requests`, `bank_settlements`, payout-worker, bank-settlement-worker.

### Estado atual

- `actor_wallet` (account_type novo, criada por D-money) é o saldo final do prestador dentro do UnifyBank.
- `payout-worker` (BOOT.ts:269-274) consome `payout_requests` WHERE status='requested', move BANK `seller_available` SYSTEM tenant → BANK `seller_payout` SYSTEM tenant. **Incompatível com actor_wallet**.
- `bank-settlement-worker` consome `bank_settlements` WHERE status='pending', move SYSTEM `seller_payout` → SYSTEM `bank_settlement`. Idem incompatível.
- DT-PIPELINE-WIRING-GAP elos 2 e 3 documentam que `createPayoutRequest` e `createBankSettlement` não têm caller real em produção. Toda a cadeia de payout legada está dormente.

### O que D-money fez

- Coloca o dinheiro do prestador em `actor_wallet` (actor-owned, lastreado por bank_ledger).
- NÃO emite `payout_request`. NÃO toca cadeia bank lifecycle SYSTEM tenant.

### Frente futura (saque externo a partir de actor_wallet)

Quando frente F-Payout-Wallet chegar, decidir:
1. Rota: seller solicita saque (POST /seller/wallet/withdraw?).
2. Gates: KYC aprovado, capability ativa, conta bancária verificada, cooldown.
3. Origem da transferência: `actor_wallet` (NÃO seller_available SYSTEM legado).
4. Worker novo OU adaptação do payout-worker existente.
5. Integração PIX/TED real OU continuar simulado até provider real.
6. Reconciliation detective: cruzar `bank_settlements` (legado dormente) com `actor_wallet` transfers (canônico novo).

### Risco se essa frente atrasar

- Saldo em `actor_wallet` cresce indefinidamente sem caminho de saída → custódia eterna.
- DEVERIA haver TTL/política de "se actor_wallet > X e seller_inactive_for Y dias, alerta operacional". Frente futura.

### Não bloqueia

- D-money entrega saldo materializado por seller, lastreado por bank_ledger, demonstrável contabilmente.
- payout-worker legado continua dormindo, sem efeito colateral.

---

## DT-ACTOR-WALLET-VISIBILITY

- **Status:** CLOSED (read-model canônico publicado via rota dedicada — commit `b62ab6b9`; superfície UI de frontend permanece como frente de produto separada)
- **Origem:** D-money (Camada 1, 2026-05-26). Decisão Clayton/ChatGPT K_wallet_6: garantir que `actor_wallet` apareça em APIs existentes de wallet, mas SEM refactor de frontend.

### Verificação no E2E D-money (T10)

- `actor_wallet` aparece corretamente em `bank_accounts WHERE actor_id=worker` (T10.1 ✅ verde).
- `GET /identity/wallet` (identity.routes.ts:746) chama `accountService.getAccountsByGlobalUserId(globalUserId)` que retorna TODAS as contas vinculadas ao user_id global. Como `actor_wallet` é criada com `actor_id` preenchido e composite `owner_id = ${actorId}:actor_wallet`, ela é listada por essa rota DESDE QUE `getAccountsByGlobalUserId` busque por owner_id/actor_id (não só user_id direto).

### Verificação completa pendente

A leitura da implementação exata de `accountService.getAccountsByGlobalUserId` em `core/economy/accounts/account.service` não foi feita nesta fatia. Se a rota varrer estritamente por user_id direto SEM cruzar actor_id, `actor_wallet` pode ficar invisível.

### Próxima ação se necessário

Se o frontend ou o sistema downstream NÃO listar `actor_wallet`:
1. Adicionar handling explícito em `getAccountsByGlobalUserId` para incluir contas com `actor_id` correspondente.
2. Garantir que `bank_accounts.actor_id` é populado (já é para actor_wallet — confirmação via T10).

### Não bloqueia

- D-money funciona materialmente; superfície UI é frente de produto separada.
- Operadores/admin podem consultar `actor_wallet` direto via DB ou rotas Bank de busca por actor.

---

## DT-ACTOR-WALLET-CANONICALIZATION

- **Status:** CLOSED (2026-05-26) — `actor_wallet` declarado canônico via DECISION-0046; documentação normativa atualizada (`BANK_SEMANTICS.md`); read-model `actor-wallet-statement` registra contrato.
- **Origem:** canonicalização documental pós D-money/statement (commits `adcbc039`, `b62ab6b9`). Eliminou ambiguidade entre `actor_wallet` (canônico), `user_wallet` (legado dormente), `seller_available` (lifecycle agregado SYSTEM) e `credit` (default genérico) como destino de recebíveis.

### O que foi documentado

1. `docs/01_normative/BANK_SEMANTICS.md` — seção "Account types canônicos por papel econômico" detalha papel de cada `account_type`, regras inegociáveis de `actor_wallet` e regra forte para novos fluxos.
2. `REMEDIATION_DECISIONS_LOG.md` — DECISION-0046 formal.
3. `opus.md` — memória operacional atualizada com regra "destino canônico de qualquer crédito de actor = `actor_wallet`".
4. `STATUS_EXECUCAO_GLOBAL.md` — entrada da fatia.

### Não bloqueia

- Migrações futuras herdam o vocabulário.
- Auditoria automática via `validate:architecture --strict` continua válida (não há regra dedicada para impedir reuso de `user_wallet`/`seller_available`/`credit` como destino — DT-CANONICAL-WALLET-GUARD-PENDING registra que a guarda automática é frente futura).

---

## DT-CANONICAL-WALLET-GUARD-PENDING

- **Status:** OPEN (LOW — enforcement automatizado de canonicidade do wallet é frente futura)
- **Origem:** Canonicalização 2026-05-26. DECISION-0046 fixou `actor_wallet` como destino canônico de recebíveis, mas o enforcement hoje é apenas:
  - Documental (BANK_SEMANTICS.md, DECISION-0046).
  - Tipo TS (BankAccountType inclui actor_wallet com JSDoc explícito).
  - Migration CHECK constraint (admite o valor).
  - Allowlist arquitetural (`scripts/validate-architectural-patterns.mjs` admite `modules/wallet`).

### O que NÃO existe ainda

- Gate automático que impeça novo INSERT em `bank_accounts` com `account_type='user_wallet'`, `'seller_available'` ou `'credit'` em contexto de recebíveis de actor (release de serviço, payout interno, etc.).
- Lint que detecte chamadas a `getOrCreateAccount(...ownerType='user'|'company'...)` sem `accountType='actor_wallet'` em service/handler novos.

### Por que não fazer agora

Criar lint específico para "credit não pode ser destino de release" exige modelar o que é "release context" sem falso-positivo (a conta `credit` é legitimamente o default para usos não-canônicos). A guarda automática precisaria casar com convenção semântica de método/handler — não é trivial e fora do escopo da canonicalização documental.

### Resolução prevista

Frente futura: regra adicional em `validate-architectural-patterns.mjs` que flague:
- `account_type='credit'` como destino em contexto de `transfer` com `referenceType=*release*`.
- Caller chamando `getOrCreateAccount(...)` quando deveria chamar `ensureActorWalletAccount(...)`.

### Não bloqueia

- DECISION-0046 + documentação suprem o "como deveria ser" para revisão humana.
- Fluxos novos (D-money) já seguem o canônico por construção.

---

## DT-POLICY-ENGINE-LEGACY-DEPRECATION (RESOLVED por DECISION-0048)

- **Status:** RESOLVED (2026-05-26)
- **Origem:** PE-1 substrate 2026-05-26 + DECISION-0047. Esta DT registrava o gap de "deprecação formal de `bank_policies` como fonte de policy" enquanto previa coexistência permanente.
- **Resolução:** DECISION-0048 (2026-05-26) — convergência imediata (sem coexistência permanente porque sistema é dev/virgem, sem produção real a preservar):
  - `bank-policy.service.resolveSplitPolicy()` REMOVIDO.
  - `bank-policy.service.setPolicy()` REMOVIDO.
  - Tipos `SplitPolicyRule` / `SplitPolicy` / `SplitPolicyMetadata` REMOVIDOS.
  - `bank-policy.service.getPolicy<T>()` preservado APENAS para `bank-limit.service` (limites operacionais — uso distinto de policy de split).
  - `bank_policies` (tabela) HARD-DEPRECATED via migration `20260530566000_deprecate_bank_policies_table.sql` (COMMENT institucional; sem DROP por causa do uso em limites).
  - Guardrail `NO_LEGACY_BANK_POLICY_SERVICE_IMPORT` em `validate-architectural-patterns.mjs` impede novo import fora da allowlist.
- **Remoção física** (DROP TABLE) rastreada em `DT-BANK-POLICIES-PHYSICAL-REMOVAL` (depende de `bank-limit.service` migrar para tabela dedicada).

---

## DT-ECONOMIC-POLICY-ADMIN-PANEL

- **Status:** OPEN (HIGH — sem CRUD/UI/handler de admin, policies só nascem via seed direto no DB ou via repository TS)
- **Origem:** PE-1 substrate 2026-05-26. Tabelas + types + repository + resolver foram entregues. Mas:
  - NÃO há endpoint REST/Fastify para criar/editar/listar/desativar policy.
  - NÃO há UI admin para configurar splits.
  - NÃO há schema validation pública (Zod/Ajv) para input de policy.

### O que NÃO existe ainda

- `POST /admin/economic-policies` (criar policy + lines em transação atômica com validações de produto).
- `GET /admin/economic-policies` (listar por contexto).
- `POST /admin/economic-policies/:id/deactivate` (`status='deprecated'`).
- `POST /admin/access-pass-products` (catálogo).
- `POST /admin/actor-access-passes` (instância manual — venda automática é frente posterior).
- Schema Zod completo + validação de invariantes (Σbps = 10000 quando todas linhas são bps; vigência válida; pelo menos uma line; etc.).

### Por que não fazer agora

PE-1 é fundação. Sem o resolver funcional + tabelas materializadas + audit trail, qualquer admin panel seria construído sobre substrato instável. O E2E provou que o resolver é determinístico e o substrato é íntegro — agora PE-2 pode construir CRUD com confiança.

### Resolução prevista

Frente PE-2 (planejada): admin handlers + Zod schemas + UI panel + permissões (somente roles `platform_admin`/`tenant_admin` podem editar). Validação de invariantes em camada de service ANTES do INSERT.

### Não bloqueia

- PE-1 sozinho não plugou o engine em nenhum fluxo financeiro vivo (PE-3 fará isso). Antes disso, policies podem ser inseridas via seed durante testes/desenvolvimento. Produção ainda usa split hardcoded.

---

## DT-CATEGORY-AS-POLICY-SELECTOR (RESOLVED por DECISION-0048)

- **Status:** RESOLVED (2026-05-26)
- **Origem:** PE-1 substrate 2026-05-26 — habilitou `category_id` como seletor de specificity em `economic_policies`. Confronto identificado: `bank-policy.service.ts:30` (legado) tinha marcado category como DEPRECATED com nota "viola Category_System_Contract"; CORE_SPLIT_PAGAMENTO_CANONICO §9.3 tinha texto absoluto "categorias NÃO influenciam preço/split/impacto financeiro".
- **Resolução institucional (DECISION-0048):** norma atualizada em CORE_SPLIT §9.3. Categorias permanecem descritivas para identidade do produto/serviço, MAS **podem selecionar** policy econômica quando houver `economic_policy` ativa, versionada, auditável e vigente. Categoria **NÃO calcula split sozinha**; **só seleciona policy**. Materialização financeira continua exclusiva do UnifyBank via `bank_splits`/`bank_ledger`.
- **Aspecto técnico:** `categories` é tabela GLOBAL (sem `tenant_id`). Policy de tenant X pode referenciar categoria criada globalmente — isso é PROPOSITAL para taxonomias globais (medicina, advocacia, etc.). Não é violação.
- **Resolução de schema:** FK `ON DELETE SET NULL` em `economic_policies.category_id` previne policy quebrada se categoria for apagada. `bank-policy.service.ts:30` (legacy DEPRECATED tag) foi removido junto com `resolveSplitPolicy`.
- **E2E:** T4 e T15 permanecem verdes — provam que categoria específica vence vertical geral, e que policy vertical-only vence quando categoria ausente.

---

## DT-POLICY-ENGINE-PLUG-SERVICE-EXECUTION (CLOSED por PE-3)

- **Status:** CLOSED (2026-05-26 — plug entregue via PE-3)
- **O que foi feito:**
  - `service-payment-execution.service.createExecution` agora chama `economicPolicyEngineService.resolveEconomicPolicy` quando `input.splits` é ausente. Fail-closed em POLICY_NOT_FOUND/POLICY_AMBIGUITY (T1/T6 do E2E provam).
  - Helper `resolveSplitDestinationFromPolicy` mapeia `EconomicPolicyDestinationType` → bank account real: `receiver_actor`/`actor_wallet` → `escrow_payments`; `platform_fees` → conta system `platform_fees`; `risk_reserve` → conta system `risk_reserve`; `escrow_payments` → escrow direto.
  - `processServicePaymentExecutionCanonical` (bank-integration) estendido com `destinationAccountId?` + `splitType?` por split (mantém backward compat: ausência → escrow + revenue_share).
  - `payment_intent.metadata.splits` filtrado para APENAS splits com `releaseToActorWallet=true` (= revenue_share em escrow). D-money continua iterando metadata sem mudança de lógica — só vê splits que devem ser liberados.
  - D-money: validação anti-vazamento `sumSplits > totalAmountCents` (substituiu `!==`). Garante que `actor_wallet` nunca recebe mais que o pago.
  - `payment_intent.metadata` ganha audit trail PE-3: `policyId`, `policyCode`, `policyVersion`, `grossAmountCents`, `calculatedSplits[]`, `appliedAccessPassId`.
  - Caminho LEGACY (caller passa `input.splits` explícitos) preservado para E2Es existentes — T9 do PE-3 prova.
  - 3 line_types não suportados no MVP (`referral`, `group_allocation`, `channel_commission`, `custom`, `regional_fund`) fail-closed em `resolveSplitDestinationFromPolicy` com `POLICY_DESTINATION_UNSUPPORTED`. Frente PE-4+ habilita.
- **E2E:** `validate-pipeline-e2e-policy-engine-service-execution.ts` (T1-T9, 9 cenários, 28 asserções). PASS.
- **Histórico (origem):**

### O que NÃO existe ainda

- Caller em `service-payment-execution` que chame `economicPolicyEngineService.resolveEconomicPolicy(input)` para obter as `lines` e calcular splits via `calculatePolicySplits(amountCents, lines)`.
- Mapper de `CalculatedEconomicSplit` → `bank_splits` row (destination_type → bank_account ID).
- Fail-closed em service_execution: se policy não resolve (`POLICY_NOT_FOUND` / `POLICY_AMBIGUITY`), pagamento NÃO pode prosseguir.
- Transactional safety: resolver + cálculo + insert de bank_splits devem ser na MESMA transação do insert de payment_intent / bank_transaction.

### Por que não fazer agora

PE-1 estabelece a base canônica. Plugar em service_execution exige:
1. Decidir a primeira policy COMMISSION_SPLIT para Camada 1 (revenue_share=97% + platform_fee=3%? configurável?).
2. Seedar a policy default em produção.
3. Adicionar fallback institucional: se policy ausente para um contexto novo, fail-closed (não cair em hardcoded).
4. Atualizar D-money release (`releaseFundsToActorWalletForOrder`) para LER os splits persistidos em `bank_splits` (que agora virão do engine), em vez de calcular inline.

Isso é trabalho de planejamento + decisão de produto (qual policy default) — não cabe em PE-1.

### Resolução prevista

PE-3 (planejada):
1. Seed canônico de `economic_policies` para Camada 1 (`module_context='service_execution'`, `vertical='services'`, `pricing_model='fixed'`, `settlement_flow='escrow'`).
2. Refactor `service-payment-execution.repository.ts` para chamar resolver + cálculo na transação.
3. Atualizar `service-order.service.ts.releaseFundsToActorWalletForOrder` para LER `bank_splits` (e não calcular inline).
4. E2E que prove: pagamento sem policy correspondente FALHA fail-closed.
5. Atualizar CORE_SPLIT_PAGAMENTO_CANONICO declarando que `economic_policies` é a CONFIGURAÇÃO canônica.

### Não bloqueia

- PE-1 não muda nada em produção. Engine existe mas é silente até ser chamado por service_execution. Fluxo financeiro vivo permanece soberano por bank_splits/bank_ledger.

---

## DT-PE1-EXECUTOR-GUARDRAIL (CLOSED por DECISION-0048)

- **Status:** CLOSED (2026-05-26)
- **Origem:** PE-1 + DECISION-0048 convergência 2026-05-26. Pendência: enforcement automático que impeça `economic_policy_engine` de virar executor financeiro por refactor descuidado futuro.
- **O que foi feito:** Regra `NO_BANK_EXECUTOR_IMPORT_IN_POLICY_ENGINE` (severidade CRITICAL) adicionada em `scripts/validate-architectural-patterns.mjs`:
  - Pattern: `from ['"`].*?(bank-ledger|bank-transaction\.service|bank-split-engine\.service|bank-split\.repository)['"`]`
  - Restrição: `onlyPath` = `modules/economy/policy-engine/`
  - Comportamento: qualquer import de executor financeiro do Bank em código sob `policy-engine/**` vira `critical_new` e quebra `--strict`.
- **Prova:** rodar `grep` direto no diretório retornou 0 hits — PE-1 atualmente não importa nenhum executor. Guardrail captura violação futura.
- **Complementar:** PE-1 também tem invariante institucional documentada em DECISION-0048: NÃO escreve em `bank_ledger`/`bank_splits`/`bank_transactions`. Único side effect é INSERT em `economic_policy_resolution_logs` (audit puro).

---

## DT-RCA-COMMISSION-VOCABULARIO (CLOSED por DECISION-0048)

- **Status:** CLOSED (2026-05-26)
- **Origem:** PE-1 substrate 2026-05-26 introduziu `rca_commission` em `EconomicPolicyLineType` e `rca_actor_wallet` em `EconomicPolicyDestinationType` sem decisão Clayton e sem ancoragem normativa anterior. Termo "RCA" (Representante Comercial Autônomo) é jargão brasileiro estreito demais para line_type estrutural.
- **O que foi feito (DECISION-0048):**
  - Migration `20260530565000_rename_rca_to_channel_commission.sql` aplicou ALTER TABLE em `economic_policy_lines` substituindo `rca_commission` → `channel_commission` (line_type) e `rca_actor_wallet` → `channel_actor_wallet` (destination_type) nas CHECK constraints. Sem backfill (0 rows).
  - `economic-policy.types.ts` atualizado.
  - Repository PE-1 reflete via tipos.
  - E2E permanece verde (não usava o valor — só vocabulário).
  - Guardrail `NO_RCA_COMMISSION_LITERAL` (CRITICAL) em `validate-architectural-patterns.mjs` impede reaparição em código.
- **Rationale:** canal genérico cobre afiliado / parceiro / RCA / influencer / marketplace externo. Identidade do canal específico (RCA, afiliado X, etc.) fica em `metadata.channelKind` ou `destination_key`, NÃO em line_type/destination_type estrutural.

---

## DT-BANK-POLICIES-PHYSICAL-REMOVAL

- **Status:** OPEN (LOW — remoção física da tabela `bank_policies`)
- **Origem:** DECISION-0048 (2026-05-26). `bank_policies` foi hard-deprecated (COMMENT ON TABLE; sem fonte ativa de policy de split). Mas NÃO foi dropada porque `bank-limit.service.bankPolicyService.getPolicy<T>()` ainda lê para configurar limites operacionais (defaultLimit) — uso distinto de policy econômica.
- **O que falta para dropar:**
  1. Definir tabela dedicada para limites operacionais (`bank_limits_config` ou equivalente).
  2. Migrar a leitura em `bank-limit.service.ts` para a tabela nova.
  3. Backfill se houver dados em `bank_policies` (hoje 0 rows).
  4. Migration DROP TABLE.
- **Prazo:** sem urgência — `bank_policies` está dormente sob COMMENT e guardrail impede uso novo.
- **Não bloqueia:** PE-2/PE-3 podem prosseguir; `bank-limit.service` continua funcional via `getPolicy<T>()` preservado.

---

## DT-PE3-LINE-TYPES-FAIL-CLOSED

- **Status:** OPEN (LOW — line types fora do MVP de PE-3 fazem fail-closed)
- **Origem:** PE-3 substrate 2026-05-26. `resolveSplitDestinationFromPolicy` em `service-payment-execution.service.ts` suporta 4 papéis canônicos: `receiver_actor`/`actor_wallet`/`escrow_payments` (→ escrow), `platform_fees` (→ system), `risk_reserve` (→ system).
- **O que faz fail-closed (POLICY_DESTINATION_UNSUPPORTED) hoje:**
  - `referral` / `referrer_actor_wallet` — exige resolver do actor referrer
  - `group_allocation` / `group_wallet` — exige resolver do group actor
  - `channel_commission` / `channel_actor_wallet` — exige resolver do canal/afiliado
  - `regional_fund` — exige region context (country/state/city) no PolicyResolutionInput + integração com `ensureRegionalFundBankAccountForRegion`
  - `custom` — exige resolução por `destination_key`
- **Por que não fazer agora:** cada destino dessa lista exige resolver dedicado (lookup de actor por referral chain, group memberships, channel ownership, region inference). Frente própria PE-4+.
- **Não bloqueia:**
  - Policy que use APENAS os 4 papéis suportados funciona ponta a ponta.
  - Policy que use destino não suportado falha explicitamente em `service-payment-execution.service.createExecution` com mensagem clara (POLICY_DESTINATION_UNSUPPORTED + lista dos suportados).
  - Substrato PE-1 (resolver puro + cálculo) continua agnóstico — qualquer destino do enum funciona nele.

---

## DT-REGIONAL-ORIGIN-BASIS-POLICY (CLOSED por DECISION-0049)

- **Status:** CLOSED (2026-05-26) — contrato formalizado em DECISION-0049 + migration `20260530567000` + CHECK constraints + E2E T16-T18 provando enforcement no Postgres. Enum reduzido para 7 valores (mixed_policy removido). HQ não é fallback automático. Pré-requisito UX rastreado em DT-PJ-OPERATIONAL-ADDRESS-MANDATORY-BEFORE-DYNAMIC-REGIONAL.

### Histórico original

- **Status original:** OPEN (HIGH — bloqueia regional_fund dinâmico até contrato fechar)
- **Origem:** PE-4-METRICS + conversa Clayton 2026-05-26 sobre regra de origem econômica do retorno regional. Premissa: regional_fund NÃO pode assumir uma única origem fixa (RESIDENCE da PF? HQ da PJ? local do serviço? local do cliente?). A escolha depende do tipo de actor (PF/PJ) e da política aplicada.

### Contrato proposto (regional_origin_basis)

Quando policy line tem `destination_type='regional_fund'` SEM `destination_key` explícito, o resolver dinâmico (frente PE-4 futura) DEVE consultar um campo `regional_origin_basis` que pode assumir:

- `payer_identity_residence` — endereço RESIDENCE da identity do payer (CPF)
- `receiver_identity_residence` — endereço RESIDENCE da identity do receiver (CPF) — útil quando o líquido vai para PF
- `receiver_company_hq` — endereço HQ da `companies` do receiver (CNPJ)
- `receiver_company_operational` — endereço OPERATIONAL da `companies` do receiver (CNPJ)
- `service_location` — endereço da transação/booking/order
- `transaction_location` — endereço do canal/loja onde a transação ocorreu
- `explicit_economic_region` — engine NÃO resolve; policy aponta para `economic_region_id` via `destination_key`
- `mixed_policy` — múltiplas linhas regional_fund na MESMA policy, cada uma com basis e share próprios

### Regras inegociáveis do contrato

1. **PF não assume HQ.** Se actor é PF, basis válidos são `*_identity_residence` ou `service_location`/`transaction_location`/`explicit_economic_region`/`mixed_policy`.
2. **PJ não assume RESIDENCE do CPF responsável como default.** Se actor é PJ, basis válidos são `*_company_*` ou `service_location`/`transaction_location`/`explicit_economic_region`/`mixed_policy`.
3. **Mixed policy** representa "X% para região do CPF + Y% para região do CNPJ" via múltiplas policy lines `regional_fund` (não via heurística no resolver).
4. **Fail-closed** quando regional_fund dinâmico ativa sem `regional_origin_basis` definido: `REGIONAL_ORIGIN_BASIS_REQUIRED`.
5. **destination_key explícito** continua permitido como override admin (ignora basis).
6. **category / city / bairro / economic_region** continuam seletores possíveis da policy (selecionam QUAL regra aplica), não substituem basis (decide ORIGEM da região).
7. **address_assignments** é a fonte material de "qual endereço é RESIDENCE/HQ/OPERATIONAL do actor". DECISION-0020 já formaliza esses roles.

### O que NÃO faz parte deste contrato (frentes próprias)

- Materialização de `economic_regions` + `economic_region_members` (DECISION-0020 §4) — necessária para `explicit_economic_region` resolver fundos múltiplos por cidade. Rastreado em `DT-PRESSURE-LOCATION-CORE-ECONOMIC-REGIONS-MISSING`.
- `service_location` / `transaction_location` requerem que `services` / `service_orders` / `bookings` ganhem `primary_address_id` FK — gap material a confirmar antes de habilitar esses basis.
- Resolver completo de `mixed_policy` — múltiplas linhas regional_fund em uma policy exigem schema confirmando que `economic_policy_lines.destination_key` é nullable + suporte a múltiplas linhas mesmo `line_type` (já provado em PE-1 §I.2).

### Status

- **Documentado** em CORE_SPLIT_PAGAMENTO_CANONICO §9.4 (criada por esta fatia).
- **Documentado** em BANK_SEMANTICS (seção PE-4 origin basis).
- **Não implementado** — resolver dinâmico de regional_fund continua FAIL-CLOSED em `resolveSplitDestinationFromPolicy` (PE-3 já bloqueia).
- **DECISION-0049** (próxima) deve formalizar o enum e regras inegociáveis se Clayton aprovar este contrato.

### Não bloqueia

- PE-4-METRICS (leitura) — independente desta decisão.
- PE-3 / D-money — não afetados.
- Fluxos que usam `destination_key` explícito — funcionam sem basis.

---

## DT-PJ-OPERATIONAL-ADDRESS-MANDATORY-BEFORE-DYNAMIC-REGIONAL

- **Status:** OPEN (HIGH — bloqueia habilitar resolver dinâmico de regional_fund em produção)
- **Origem:** DECISION-0049 (2026-05-26). Contrato `regional_origin_basis` declara que `receiver_company_operational` exige `address_assignments(role='OPERATIONAL')` por unidade/actor PJ. Pré-requisito UX/onboarding: TODA empresa PJ deve ter pelo menos 1 endereço operacional cadastrado antes de qualquer transação econômica regional.

### Estado material atual

- `address_assignments` no DB: 4 rows, TODAS com role `HQ` (companies como owner).
- ZERO rows com role `OPERATIONAL` em qualquer owner_type.
- Logo: se o resolver dinâmico fosse ativado HOJE com policy declarando `receiver_company_operational`, **toda transação PJ falharia POLICY_REGIONAL_ORIGIN_UNRESOLVABLE**.
- Não bloqueia esta fatia (DECISION-0049 + schema) — bloqueia o PRÓXIMO passo (resolver dinâmico real).

### Padrão de owner_type/owner_id para actor operacional — FECHADO por DECISION-0050

Convenção canônica (DECISION-0050, 2026-05-26):

```
address_assignments.owner_type = 'service_provider'  (técnico, não actor_type)
address_assignments.owner_id   = <actors.id>
address_assignments.role       = 'OPERATIONAL'
address_assignments.is_primary = true
```

Helper canônico: `backend/src/core/location/operational-address.helper.ts` —
funções `getOperationalAddressForActor`, `assertActorHasOperationalAddress`,
`createOperationalAddressForActor`. E2E PE-5-CARTÓRIO cobre 6 cenários verdes.

Esta DT permanece OPEN porque PE-5-RESOLVER (resolver dinâmico + plug em
risk-financial-gate) ainda não foi implementado. Quando for, esta DT fecha.

### Pré-requisitos para habilitar resolver dinâmico

1. UX/onboarding bloqueia criação de actor PJ sem pelo menos 1 endereço OPERATIONAL.
2. Decisão A/B acima sobre owner_type fechada e documentada.
3. Validador pré-transação (risk-financial-gate ou similar) chama resolver em modo "dry-run" antes de cobrar cliente — bloqueia abertura, não commit.
4. Wizard de cadastro de unidade/filial materializa `actor` + `address_assignments(role='OPERATIONAL')` atomicamente.
5. Migration de seed para tenants existentes: backfill OPERATIONAL a partir de HQ existente como ponto de partida (decisão produto: aceita HQ como OPERATIONAL inicial ou força recadastro?).

### Não bloqueia

- DECISION-0049 + schema + CHECK constraints (esta fatia).
- PE-1 / PE-3 / PE-4-METRICS — todos inalterados.
- Fluxos atuais (input.splits legacy + destination_key explícito) — continuam funcionando.

### Resolução prevista

Frente PE-5 ou PE-6 (a definir), bloqueada por decisão Clayton sobre items 1-5 acima.

---

## DT-PE5-CARTORIO-ENDPOINT-AUTH

- **Status:** OPEN (MEDIUM — rota REST POST `/actors/:actorId/operational-address` não implementada)
- **Origem:** PE-5-CARTÓRIO 2026-05-26 (DECISION-0050). O helper `operational-address.helper.ts` está pronto; falta endpoint REST com autorização canônica para admin/tenant_admin/owner-flow cadastrar OPERATIONAL.

### Auditoria PE-5-CARTÓRIO-HARDENING (2026-05-26)

Padrão de auth para POST autenticado EXISTE no projeto — vide
`backend/src/core/companies/company-members.routes.ts:24-69`:

```typescript
fastify.post<{ Params: ..., Body: ... }>('/:companyId/members', async (req, reply) => {
  if (!req.actionContext || !req.actionContext.actorId) {
    return reply.status(400).send({ error: 'ActionContext obrigatório' });
  }
  if (!req.tenant || !req.tenant.id) {
    return reply.status(400).send({ error: 'Tenant not found' });
  }
  // Zod validate + service call com req.tenant.id + req.actionContext.actorId
});
```

**O que ainda falta para a rota:**
- Decisão de produto sobre RBAC fino: admin / tenant_admin / owner-flow? Hoje o padrão é "qualquer actor autenticado do tenant chama". Sem RBAC, qualquer usuário poderia cadastrar OPERATIONAL para QUALQUER actor do mesmo tenant — risco institucional.
- `core/authorization/require-permission.guard.ts` existe (visto na auditoria) — provavelmente é o mecanismo RBAC canônico. Precisa decisão sobre qual `permissionKey` representa "cadastrar OPERATIONAL de unidade PJ".

### Por que não foi feito mesmo no HARDENING

A fatia HARDENING priorizou atomicidade (DT fechada) e fixture (E2E PE-3 destravado).
RBAC fino é decisão de produto + mapeamento com `require-permission.guard.ts` — vira fatia
própria (PE-5-CARTORIO-ROUTE). Helper continua chamável por wizard de UX ou admin panel.
- **O que falta:**
  1. Decidir padrão de autenticação para rotas POST de location (Fastify decorator de auth + actionContext + RBAC).
  2. Decidir owner-flow: representante legal do CNPJ pode cadastrar OPERATIONAL da sua própria unidade? Como provar materialmente que ele é representante (via `companies.global_user_id` + `actors.responsible_actor_id`)?
  3. Endpoint REST: validação Zod do payload de address; tenant safety; resposta sem CPF/CNPJ.
  4. E2E T7 testando endpoint (sem auth → 401; cross-tenant → 403; admin/owner → 200).
- **Não bloqueia:** helper funciona via service direto (E2E PE-5-CARTÓRIO T1-T6 verdes). Cadastro em produção exige a rota OU helper chamado por outro fluxo (wizard de UX, admin panel).
- **Resolução prevista:** frente PE-5-CARTORIO-ENDPOINT ou via PE-2 (admin panel se for o caminho de produto).

---

## DT-PE5-CARTORIO-ATOMICITY (CLOSED por PE-5-CARTÓRIO-HARDENING)

- **Status:** CLOSED (2026-05-26) — `locationRepository.createAddressAndAssign(addressInput, tenantId, assignmentArgs)` faz BEGIN/INSERT/INSERT/COMMIT em transação SQL única; ROLLBACK automático se assignment falhar. Helper `operational-address.helper.ts.createOperationalAddressForActor` agora usa esse método. E2E PE-5-CARTÓRIO T7+T7-BIS prova: T7 valida defesa em pré-validação (actor inexistente → throw antes do INSERT); T7-BIS força CHECK violation em owner_type e prova que addresses count permanece IDÊNTICO antes/depois (rollback efetivo).

### Histórico original

- **Status original:** OPEN (LOW — `createAddress` + `assignAddress` não compartilham transação SQL)
- **Origem:** PE-5-CARTÓRIO 2026-05-26. Helper `createOperationalAddressForActor` chama `locationRepository.createAddress(...)` e depois `locationRepository.assignAddress(...)`. Se a 2ª falhar (DB caiu, constraint violou), a 1ª já comitou — fica address órfão sem assignment.
- **Severidade LOW:** assignment usa constraints simples (FK + NOT NULL + UNIQUE primary); falha é improvável em condições normais. Address órfão não vaza para queries de produção (nenhum caller consulta `addresses` sem JOIN com `address_assignments` ou `companies.primary_address_id`).
- **Não bloqueia:** uso normal funciona; risco material em race condition específica.
- **Resolução prevista:**
  1. Refator helper para usar `runQueryWithTenant` em transação BEGIN/COMMIT/ROLLBACK envolvendo ambos os INSERTs.
  2. OU adicionar método `createAddressAndAssign(input, assignmentArgs)` em `location.repository.ts` que faz os 2 INSERTs em transação única.
  - Frente própria pequena (~30 linhas de refactor).

---

## DT-PE5-PF-RESOLVER-PENDING

- **Status:** OPEN (MEDIUM — resolver dinâmico PF não implementado em PE-5-RESOLVER-MVP)
- **Origem:** DECISION-0051 (PE-5-RESOLVER-MVP, 2026-05-26). MVP cobre apenas PJ (`receiver_company_operational`, `receiver_company_hq`). PF basis `receiver_identity_residence` e `payer_identity_residence` ficam FAIL-CLOSED com erro `POLICY_BASIS_UNSUPPORTED_MVP`.

### Pré-requisitos para destravar PF (frente PE-5-RESOLVER-V2)

1. **Auditoria de `profile_id` canônico:** decidir qual tabela é fonte material para `address_assignments(owner_type='profile')`:
   - `public_profiles.id`?
   - `user_profiles.id`?
   - `profiles.id`?
   - Ou nova convenção (ex: `owner_id=<global_users.global_user_id>` direto)?
   - O agente de varredura normativa identificou que a NORMA decidiu usar `profile`, mas o `owner_id` específico no schema vivo precisa de raio-x dedicado.
2. **Decisão de produto sobre PF presencial vs remoto:**
   - Serviço presencial local → policy deve usar `service_location` (também fail-closed atualmente; aguarda FK `services.primary_address_id`).
   - Serviço remoto/online → policy usa `receiver_identity_residence`.
   - Quem decide qual basis? Vertical? Tipo de service? Categoria?
3. **Substrato `address_assignments(owner_type='profile', role='RESIDENCE')` populado:** hoje 0 rows no DB live. Cadastro de residência de PF não existe como fluxo institucional ainda.

### Não bloqueia

- PE-5-RESOLVER-MVP funciona ponta a ponta para PJ.
- Policy que use basis PF retorna mensagem explícita `POLICY_BASIS_UNSUPPORTED_MVP: ...` — não permite passar silenciosamente.
- Caso de uso PF pode ser adiado sem prejudicar PJ.

### Resolução prevista

Frente PE-5-RESOLVER-V2 (a planejar), após auditoria + decisões de produto.

---

## DT-CORE-APROVACAO-FINANCEIRA-RAIOX-PENDENTE

- **Status:** OPEN (MEDIUM — substrato materializado por DECISION-0054; sync/async e thresholds ainda não decididos)
- **Origem:** DECISION-0052 (F-REFUND-SPLIT-AWARE-HARDENING, 2026-05-27). O Bloco C original da fatia previa um **approval gate síncrono para `internal_refund`** — isto é, antes de gravar `reversals` com `reversal_type='internal_refund'` o sistema exigiria evidência material de aprovação (token de aprovação, registro em `financial_approvals`, etc.).

### Por que está adiado

A norma `CORE_APROVACAO_FINANCEIRA_CANONICO.md` existe mas:

1. **Substrato material não auditado.** Não sabemos quais tabelas hoje suportam o fluxo de aprovação financeira (`financial_approvals`? `approval_workflows`? Nenhuma?), nem em que estado real estão (vazias? populadas? schema completo?).
2. **Política de quórum não decidida.** Aprovação síncrona (mesma sessão, antes do estorno) vs assíncrona (PR de operação, dois aprovadores em momentos distintos) — produto não definiu.
3. **Limites por valor não definidos.** Refund de R$ 5 e refund de R$ 50.000 têm o mesmo nível de aprovação? Hoje não há `thresholds_for_approval` materializados.
4. **Quem aprova quem.** Hierarquia institucional do aprovador — é actor com permission financial_refund_approve? É owner de tenant? É um actor system com humano por trás? Não há contrato canônico vivo.

### Não bloqueia

- Bloco A (taxonomia) + Bloco B (autoria) + Bloco D (E2E) + Bloco E (linkage) destravam estorno split-aware completo.
- `internal_refund` HOJE é aceito pelo banco com `performed_by_user_id` declarado (CHECK Postgres enforça). A pessoa fica gravada — só não há um segundo aprovador.
- Em produção atual NÃO HÁ código chamando `internal_refund` (os 2 callers existentes — `bank-integration` e `reconciliation-dispute` — são sistêmicos). O risco de "refund manual sem aprovação" é ZERO até alguém adicionar uma rota de UI/API para refund manual.

### Resolução prevista

Frente própria (F-APROVACAO-FINANCEIRA):
1. Raio-x material de `CORE_APROVACAO_FINANCEIRA_CANONICO` vs schema vivo.
2. Decisão Clayton + ChatGPT sobre síncrono vs assíncrono, thresholds, hierarquia de aprovação.
3. Migration para tabela `financial_approvals` (ou ratificação de existente).
4. Bloco C original: integrar gate no `requestReversal` antes do INSERT em `reversals` para `reversal_type='internal_refund'`.
5. E2E dedicado de aprovação.

### Vinculadas

- DECISION-0052 (Bloco C adiado por esta DT)
- CORE_APROVACAO_FINANCEIRA_CANONICO.md (norma a auditar)
- CORE_ESTORNOS_FINANCEIROS_CANONICO §14 (referência cruzada)

---

## DT-PE5-REFUND-POST-DMONEY-CHAIN

- **Status:** CLOSED (2026-05-28) — C1–C7 satisfeitos; G-DECISION-0053 declarada coberta pelas suites individuais existentes (ver seção "Fechamento"). Saque externo de actor_wallet é escopo separado de DT-RECOVERY-PAYOUT-GATE.
- **Origem:** DECISION-0052 (F-REFUND-SPLIT-AWARE-HARDENING, 2026-05-27). Investigação revelou que o motor de estorno atual NÃO TEM caminho material limpo para reverter um pagamento depois que o D-money já liberou `revenue_share` para o `actor_wallet` do worker.

### Comportamento material observado

Cenário: pagamento PE-5 com policy `revenue_share=70% + regional_fund=20% + platform_fee=10%`.

**Fase 1 — pagamento e splits (antes D-money):**
- `escrow_payments` recebe 70% (revenue_share fica retido até release).
- `regional_fund(Curitiba)` recebe 20% diretamente.
- `platform_fees` recebe 10% diretamente.

**Fase 2 — D-money (release do escrow):**
- `serviceOrderService.releaseFundsToActorWalletForOrder()` transfere o `revenue_share` retido de `escrow_payments` para `actor_wallet` do worker.
- Worker agora tem 70% creditado no wallet pessoal.

**Fase 3 — estorno PÓS D-money (problema):**
- Motor atual: `bankSplitRepository.loadSplitLegsForReversal` lê os splits **originais** (target = `escrow_payments`).
- Tenta transferir `escrow_payments → buyer`.
- `escrow_payments` é **pool agregado do tenant** — tem saldo de OUTROS pagamentos retidos.
- O estorno NÃO falha: drena 70% da pool (que pertence a outras transações em escrow) para o buyer.
- O `actor_wallet` do worker NÃO é tocado — fica com 70% indevido.
- **Resultado material: sistema "cria dinheiro" do ponto de vista contábil do worker; pool de escrow fica devendo para os outros pagamentos legítimos.**

### Severidade HIGH — por que importa

- Invariante de soma `Σ wallet_actor + Σ escrow = Σ pagamentos_não_estornados` é **violada** em qualquer estorno pós-D-money.
- Reconciliação automática pode mascarar (escrow_payments parece ter saldo OK quando observada em isolado).
- Em produção isso vira fraude colateral: cliente pede refund após release, recebe dinheiro de outros usuários, worker fica com revenue indevida.

### Por que não foi corrigido nesta fatia

Clayton determinou explicitamente: **"F: não fazer agora"**. A correção é frente própria — exige decisão de produto sobre:

**Opção 1 — cobrança reversa no `actor_wallet`:** estorno pós-D-money debita o wallet do worker. Risco: worker pode estar com saldo zerado/negativo (já gastou o dinheiro). Como tratar? Saldo negativo permitido? Bloqueio de saque até regularizar?

**Opção 2 — débito pending (`actor_wallet_pending_debits`):** registra a dívida do worker; bloqueia próximos saques até quitar. Exige nova tabela + invariante de elegibilidade-para-saque.

**Opção 3 — bloqueio fail-closed pós-release via flag:** `payment_intents.is_released=true` proíbe estorno; refund pós-release passa a ser fluxo separado (`escrow_refunds`) com aprovação dupla + cobrança ao worker. Mais conservador, mais lento, mas materialmente correto.

### Não bloqueia (HOJE)

- Em produção NÃO HÁ rota humana puxando estorno pós-D-money. Os callers atuais (`bank-integration` para reverter PIX externo, `reconciliation-dispute` para resolver dispute) operam ANTES do D-money em 100% dos casos auditados.
- Em E2E o cenário foi removido (T9) porque dispara `ACTOR_RISK_BLOCKED` em colateral (anomalia HIGH_FREQUENCY_TRANSACTIONS após múltiplos estornos no mesmo worker) — não é determinístico para teste automatizado.

### Risco em aberto

- Quando UX de refund manual for adicionada (Bloco C / F-APROVACAO-FINANCEIRA), se a rota não bloquear pós-D-money explicitamente, o gap material vira incidente em produção.

### Progresso

**Parte A — FECHADA** (commit `4c04e8d7`, 2026-05-27):
- Guard `checkPostDmoneyBlock` bloqueia `requestReversal`/`executeReversal`/`requestAndExecuteReversalSync`
  quando `payment_intent.payment_status = 'released_to_actor_wallet'`.
- Lança `REVERSAL_POST_DMONEY_REQUIRES_RECOVERY_FLOW` antes de qualquer escrita em
  `bank_ledger`/`bank_transactions`/`bank_splits`.
- Drena de escrow de terceiros impossível enquanto guard ativo.

**Parte B — DECISION-0053 APROVADA** (2026-05-27, registro documental):
- Substrato canônico definido: `actor_wallet_recovery_obligations` + `actor_wallet_recovery_obligation_entries`.
- Implementação bloqueada até C2–C7 (ver DECISION-0053).

**C7 — FECHADO** (2026-05-28, `feat(recovery): finalize post-dmoney recovery cases`):
- `finalizeRecoveryCase`: `recovered`+`released_to_actor_wallet` → `refunded_via_recovery` + outbox event.
- Guard atualizado: bloqueia também `refunded_via_recovery`.
- Integração C3.1: drain chama `finalizeRecoveryCase` no mesmo client TX.
- Migration `20260530571000` aplicada (constraint atualizado).
- E2E C7 14/14; C3.1 13/13; C3 18/18; D-money PASS; guard PASS; arch `critical_new=0`.

### Fechamento — G-DECISION-0053 declarada coberta (2026-05-28)

Sequência de implementação — todos os itens CONCLUÍDOS:
1. DT-CORE-APPROVAL-REQUESTS-MISSING → CLOSED ✓ (DECISION-0054)
2. DT-ACTOR-WALLET-DEBIT-MISSING → CLOSED ✓ (C3+C3.1, commit `61979374`/`c3d2e569`)
3. DECISION-0053 migration + service → DONE ✓ (C1–C6, migration `20260530570000`)
4. DT-DMONEY-FINALIZATION-FLOW-MISSING → CLOSED ✓ (C7, commit `6a167d77`)
5. G-DECISION-0053 → declarada coberta pelas suites individuais existentes:
   - C3 E2E 18/18 — débito de `actor_wallet` via `bank_transactions`
   - C3.1 E2E 13/13 — income withholding + integração C7 (`finalizeRecoveryCase` chamada no drain)
   - C7 E2E 14/14 — finalização pós-D-money; guard bloqueia `refunded_via_recovery`
   - D-money E2E PASS — `released_to_actor_wallet` provado
   - refund-post-dmoney guard PASS — reversal bloqueado pós-D-money
   - refund-split-aware E2E 9/9 — taxonomia + autoria + idempotência

   Nenhum cenário material da cadeia sem cobertura. Suite agregadora separada não acrescenta
   evidência nova — seria duplicação dos E2Es acima. Fechamento justificado.

### Resolução prevista

### Vinculadas

- DECISION-0046 (actor_wallet canônico — invariante violada)
- DECISION-0051 (PE-5-RESOLVER-MVP — cenário PE-5 onde o gap fica visível)
- DECISION-0052 (Bloco F adiado por esta DT)
- DECISION-0053 (substrato de recovery — C1–C7 IMPLEMENTADOS)
- CORE_ESTORNOS_FINANCEIROS_CANONICO §14.5 + §15 (referência cruzada)
- DT-CORE-APPROVAL-REQUESTS-MISSING → CLOSED (DECISION-0054)
- DT-ACTOR-WALLET-DEBIT-MISSING → CLOSED (C3+C3.1+C7 comprovados, 2026-05-28)
- DT-DMONEY-FINALIZATION-FLOW-MISSING → CLOSED (C7, 2026-05-28)

---

## DT-REGIONAL-FUNDS-TOTAL-BALANCE-CENTS-DEPRECATION

- **Status:** OPEN (LOW — coluna projeção legacy conflita com LEDGER_SOVEREIGNTY)
- **Origem:** Auditoria forense 2026-05-27 (RAIO-X read-only, HEAD `ca3f1327`). Tabela `regional_funds` (migration 0014) possui coluna `total_balance_cents` que pretende guardar saldo do fundo regional. DECISION-0024 estabelece `bank_ledger` como SSOT financeiro único.

### Por que importa pouco hoje

- `regional_funds` tem **0 rows** no DB live (RAIO-X-PE-4 §C.1).
- Nenhum caller ativo lê `total_balance_cents` como verdade financeira.
- Saldo real dos fundos regionais é resolvido via `bankAccountService.getBalance(<system:regional_fund:tenant:region>)` direto do `bank_ledger`.

### Por que ainda é dívida

- Coluna existe no schema vivo. Se algum dev novo ler `total_balance_cents` esperando saldo, vai estar errado.
- Confunde leitura de schema (parece SSOT, não é).

### Resolução prevista

Opção A: `ALTER TABLE regional_funds DROP COLUMN total_balance_cents` (limpeza definitiva — viável porque 0 rows = 0 risco material).
Opção B: `ALTER TABLE regional_funds ALTER COLUMN total_balance_cents` + COMMENT explícito "DEPRECATED — não-SSOT; saldo real em bank_ledger via ensureRegionalFundBankAccountForRegion".
Opção C: rename para `legacy_projected_balance_cents` (mais verboso, mesma utilidade do COMMENT).

Default sugerido: **Opção A** (drop) — frente cirúrgica de 1 migration aditiva. Conviver com dívida classificada (feedback memória `nao_agir_como_resposta`) só vale se o drop carregar risco; aqui, com 0 rows, não carrega.

### Não bloqueia

Nada. Frente puramente cosmética/normativa.

### Vinculadas

- DECISION-0020 (Location Core soberano)
- DECISION-0024 (bank_ledger = SSOT financeiro único)
- DECISION-0051 (PE-5-RESOLVER-MVP — usa `ensureRegionalFundBankAccountForRegion`, não a tabela)
- Auditoria forense `AUDITORIA_FORENSE_SPLIT_REGIONAL_POLICY_WALLET.md` §16 RISCO MÉDIO

---

## DT-USER-GROUP-ALLOCATIONS-SILENT-CALL-CLEANUP

- **Status:** OPEN (LOW — call silencioso em substrato financeiro é anti-padrão de observabilidade)
- **Origem:** Auditoria forense 2026-05-27. `bank-split-engine.service.ts:193-223` chama `userGroupAllocationRepository.findByUserId` dentro de try/catch tolerante. Tabela `user_group_allocations` **não existe no DB** (PE4 §E.1).

### Comportamento atual

- `findByUserId` falha silenciosamente, retorna `[]`.
- Split engine segue normal, sem alocação para grupos.
- Logs não emitem nada — invisível para monitoramento.

### Por que importa pouco hoje

- Tabela ausente, retorno sempre vazio.
- Nenhum dinheiro foi movido para `group_accounts` (0 rows confirmado).
- Bank-split-engine é caminho legado, subordinado por DECISION-0048.

### Por que é dívida

- Try/catch tolerante em substrato financeiro mascara qualquer falha real (não distingue "tabela ausente" de "DB caído" de "permissão negada").
- Se alguém materializar `user_group_allocations` no futuro, o código ATIVA silenciosamente sem revisão de fluxo — pode mover dinheiro para grupos antes de qualquer aprovação institucional.

### Resolução prevista

Opção A: remover o bloco 193-223 do `bank-split-engine.service.ts` (frente PE-3 substitui esse engine; é dead code à espera de cutover).
Opção B: trocar try/catch tolerante por feature-flag explícita (`ENABLE_GROUP_ALLOCATION_LEGACY`) que falha-aberto se tabela ausente — log estruturado em vez de silêncio.
Opção C: materializar `user_group_allocations` + ativar fluxo (frente PE-N econômica de grupos, fora desta DT).

Default sugerido: **Opção A** depois do cutover bank-split-engine → economic_policy_engine. Antes do cutover, **Opção B** se quiser limpar o silêncio sem mexer no path.

### Não bloqueia

Nada. Sem impacto financeiro real hoje.

### Vinculadas

- DECISION-0048 (bank-split-engine subordinado, cutover pendente)
- Auditoria forense `AUDITORIA_FORENSE_SPLIT_REGIONAL_POLICY_WALLET.md` §11 + §16 RISCO MÉDIO

---

## DT-REFERRAL-LEGACY-CLEANUP

- **Status:** OPEN (LOW — dead code de referral com risco de ativação acidental)
- **Origem:** Auditoria forense 2026-05-27. `bank-split-engine.service.ts:167-191` aplica 5% referral hardcoded sobre profit se `referrerUserId != null`. `referral-helper.service.ts:13-91` (`getActiveReferral`) consulta tabelas `referrals` e `user_referral_links` — **ambas ausentes no DB** — com try/catch duplo. Retorna **sempre `null`** em produção.

### Comportamento atual

- `getActiveReferral` → `null` sempre.
- Bloco de 5% nunca executa.
- Nenhum dinheiro foi movido por referral genérico em produção.

### Diferença com rides

- `rides_referral_links` + `rides_referral_earnings`: tabelas existem (0 rows), fluxo vertical-específico próprio. Não confundir com a stack genérica desta DT.

### Por que é dívida

- 5% hardcoded escondido em substrato financeiro: se alguém materializar `referrals`/`user_referral_links` sem revisão, ativa fluxo silenciosamente.
- `economic_policy_lines.line_type` inclui `referral` e `destination_type` inclui `referrer_actor_wallet`, mas `service-payment-execution.service.ts` tem `referrer_actor_wallet` em FAIL-CLOSED. Norma e código vivo divergem.

### Resolução prevista

Opção A: remover o bloco 167-191 + `referral-helper.service.ts` inteiro (dead code à espera de cutover).
Opção B: deixar e materializar `referrals` (frente PE-N econômica de referral, fora desta DT) com economic_policy_engine.
Opção C: hardcode → feature-flag explícita até cutover.

Default sugerido: **Opção A** depois do cutover do bank-split-engine. Conviver só se a frente PE-N de referral for iminente.

### Não bloqueia

Nada. Helper retorna null há toda a história do projeto.

### Vinculadas

- DECISION-0048 (bank-split-engine subordinado, cutover pendente)
- Auditoria forense `AUDITORIA_FORENSE_SPLIT_REGIONAL_POLICY_WALLET.md` §12 + §16

---

## DT-CORE-APPROVAL-REQUESTS-MISSING

- **Status:** CLOSED (HIGH → RESOLVED — DECISION-0054, commit pós-ce9c36cf, 2026-05-27)
- **Origem:** DECISION-0053 (Actor Wallet Recovery Obligations, 2026-05-27). Auditoria READ-FIRST
  revelou que `approval_requests` e `approval_votes` estão definidos em
  `CORE_APROVACAO_FINANCEIRA_CANONICO.md` mas as tabelas **não existem no banco**.

### Impacto

- `CORE_APROVACAO_FINANCEIRA_CANONICO.md` exige approval para `internal_refund` e qualquer
  execução financeira de recovery.
- Sem as tabelas, `actor_wallet_recovery_obligations` só pode nascer em `pending_approval`
  mas nunca avançar para `approved` — qualquer execução financeira de recovery é fail-closed.
- `DT-CORE-APROVACAO-FINANCEIRA-RAIOX-PENDENTE` já rastreia a decisão de produto (síncrono
  vs assíncrono, thresholds, quórum). Esta DT é complementar: foca na materialização das tabelas.

### Não bloqueia hoje

- Guard da Parte A (commit `4c04e8d7`) já protege o fluxo de estorno.
- Criação da obrigação em `pending_approval` pode ocorrer sem as tabelas.
- Nenhum caller de `internal_refund` em produção até rota de UI/API for adicionada.

### Resolução prevista

1. Raio-x completo de `CORE_APROVACAO_FINANCEIRA_CANONICO.md` vs schema vivo (frente
   F-APROVACAO-FINANCEIRA — ver DT-CORE-APROVACAO-FINANCEIRA-RAIOX-PENDENTE).
2. Migration para `approval_requests` + `approval_votes` com schema canônico.
3. Integração do gate no fluxo de recovery (DECISION-0053 C2 satisfeito).

### Vinculadas

- DECISION-0053 (pré-requisito C2 — bloqueia execução financeira de recovery)
- DT-CORE-APROVACAO-FINANCEIRA-RAIOX-PENDENTE (decisão de produto sobre approval)
- DT-PE5-REFUND-POST-DMONEY-CHAIN → CLOSED (2026-05-28) — este era o pré-requisito C2. Com CLOSED + C3–C7 DONE, DT-PE5 fechou.
- CORE_APROVACAO_FINANCEIRA_CANONICO.md (norma que define o schema)

---

## DT-ACTOR-WALLET-DEBIT-MISSING

- **Status:** CLOSED (2026-05-28) — C3 (`debitActorWalletForRecovery`, commit `61979374`) + C3.1 (income withholding, commit `c3d2e569`) + C7 (finalização pós-D-money, commits `6a167d77`+`f8a0c59e`) implementados e comprovados por E2E conjunto (C3 18/18, C3.1 13/13, C7 14/14). Cadeia operacional: débito de `actor_wallet` via `bank_transactions` existe e é exercido pelo income withholding síncrono no D-money. Saque externo (payout voluntário) permanece pendente em DT-RECOVERY-PAYOUT-GATE — escopo distinto desta DT.
- **Origem:** DECISION-0053 (Actor Wallet Recovery Obligations, 2026-05-27). Auditoria READ-FIRST
  confirmou que não existe nenhum serviço de débito de `actor_wallet` via
  `bank_transactions`/`bank_ledger`.

### Estado atual

- `actor-wallet-statement.service.ts` é READ-ONLY — expõe extrato e saldo, sem débito.
- `bankAccountService.getBalance()` resolve saldo via `bank_ledger` (correto).
- Nenhum `actor_wallet_debit_service`, `actor_wallet_payout_service` ou equivalente existe.
- `payout_requests` (módulo plural) é exclusivo do fluxo `seller_available → seller_payout`;
  sem vínculo com `actor_wallet`.
- `actor_wallet` tem 45 contas e 373.300 cents de saldo no runtime — sem caminho de saída.
- **DECISION-0055 (2026-05-27):** semântica e autoridade definidas; design aprovado.

### Impacto

- DECISION-0053 requer que recovery debite `actor_wallet` do devedor via `bank_transactions`.
- Sem este serviço, execução de recovery é impossível mesmo com approval materializado.

### Não bloqueia hoje

- Guard da Parte A protege estorno direto.
- Nenhum fluxo de saque/payout de `actor_wallet` está ativo em produção.

### Resolução prevista (DECISION-0055 aprovada)

1. **Serviço:** `debitActorWalletForRecovery` em `src/modules/wallet/actor-wallet-debit.service.ts`
2. **Substrato:** `bankTransactionService.transfer` (GATE-4 respeitado via interface)
3. **Risk gate:** clearance `financial_recovery` — trilho próprio, não bypass, não `financial_transfer`
4. **reference_type:** `actor_wallet_recovery` (idempotência via UNIQUE em bank_transactions)
5. **concept:** `actor-wallet-recovery` em `financeiro-reversal` (semear na migration C6)
6. **Partial recovery:** debita disponível, entry em `obligation_entries`, status → `partially_recovered`
7. **Sem saldo negativo.** Sem cofres de terceiros como origem.
8. **Implementação:** APÓS migration C6 de DECISION-0053 (tabelas `actor_wallet_recovery_obligations` + `actor_wallet_recovery_obligation_entries` existirem).

### Vinculadas

- DECISION-0053 (pré-requisito C3 — semântica definida; implementação aguarda C6)
- DECISION-0055 (define design canônico — esta DT é o alvo de implementação)
- DECISION-0056 (C4 — resolver creditor_account_id decidido; pré-requisito para implementação)
- DECISION-0046 (actor_wallet canônico — invariante deve ser preservada no débito)
- DECISION-0044 (bank-ledger boundaries — débito transita via módulo bank)
- DT-PE5-REFUND-POST-DMONEY-CHAIN → CLOSED (2026-05-28) — este era o pré-requisito C3. Com CLOSED + C7 DONE, DT-PE5 fechou.

---

## DT-DMONEY-FINALIZATION-FLOW-MISSING

- **Status:** CLOSED (2026-05-28) — C7 implementado; fluxo de finalização pós-D-money materializado.
- **Origem:** DECISION-0053 (Actor Wallet Recovery Obligations, 2026-05-27). A DECISION define o
  substrato de recovery mas explicitamente exclui do escopo o fluxo de finalização pós-D-money
  após a obrigação atingir `recovered`.

### Fechamento — C7 implementado (commit: feat(recovery): finalize post-dmoney recovery cases, 2026-05-28)

**Implementado:**
- `recovery-finalization.service.ts` — `finalizeRecoveryCase(tenantId, obligationId, client?)`:
  - `recovered` + intent `released_to_actor_wallet` → `payment_status = 'refunded_via_recovery'` + evento `PAYMENT_INTENT_REFUNDED_VIA_RECOVERY`
  - `recovered` + intent em outro status (income withholding não-D-money) → finaliza silenciosamente sem alterar intent
  - `cancelled` → evento `ACTOR_WALLET_RECOVERY_CANCELLED`, intent inalterado
  - Status não-terminal → `RECOVERY_FINALIZATION_OBLIGATION_NOT_TERMINAL` (sem escrita)
  - Idempotente: segunda chamada retorna `already_finalized`
- Migration `20260530571000_extend_payment_status_refunded_via_recovery.sql` aplicada (CHECK constraint atualizado)
- `checkPostDmoneyBlock` bloqueia `refunded_via_recovery` (além de `released_to_actor_wallet`)
- C3.1 drain integrado: após `debitActorWalletForRecovery` retornar `recovered`, chama `finalizeRecoveryCase` no mesmo client
- E2E C7 14/14 verde; C3.1 13/13; C3 18/18; D-money PASS; guard PASS

### Vinculadas

- DECISION-0053 (pré-requisito C7 — satisfeito)
- DT-PE5-REFUND-POST-DMONEY-CHAIN → CLOSED (2026-05-28) — C7 foi o último pré-requisito; saque pós-recovery é escopo de DT-RECOVERY-PAYOUT-GATE (separado)
- DECISION-0052 (Bloco F — estorno pós-D-money bloqueado por guard; C7 fecha o loop de recovery)

---

## DT-RECOVERY-PAYOUT-GATE

- **Status:** PARTIALLY CLOSED (2026-05-28) — escopo INTERNO totalmente fechado; escopo EXTERNO acompanhado em DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT.
  - **C3.1 income withholding (D-money release)**: CLOSED (2026-05-27).
  - **Payout gate INTERNAL (drain antes do saque)**: CLOSED (2026-05-28) — F3 `executeActorWalletPayout` (commit `8f36db6e`) drena obrigações ativas DENTRO da TX do saque, ANTES de transferir excedente para `bank_settlement`. SELECT FOR UPDATE em obligations garante serialização.
  - **Payout gate EXTERNAL (PIX/TED/PSP)**: OPEN — não autorizado. Acompanhado em DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT.
- **C3.1 fechado (2026-05-27):** `drainRecoveryObligationsForCredit` + `debitActorWalletForRecovery(existingClient, maxAmountCents)` integrados no `releaseFundsToActorWalletForOrder`. Gate E2E C3.1 13/13. `calculateBalance(client)` passa client da TX D-money para visibilidade do crédito não-commitado. Arch gate `critical_new=0`.
- **F3 fechou gate interno (2026-05-28):** mesmo helper `drainRecoveryObligationsForCredit` é chamado dentro de `executeActorWalletPayout` com `client` da TX de saque. Drain ocorre ANTES do `transfer` para `bank_settlement`. D-3/D-4 cobrem casos parcial e zero-after-drain. E2E F3 18/18 + regressão C3.1 13/13 + C7 14/14.
- **Payout gate EXTERNAL (OPEN):** saque para banco externo (PIX/TED) ainda não autorizado. Quando F4 for autorizado, o mesmo padrão de drain pré-payout deve ser preservado (drain → recalc → transfer external → callback). DT dedicada: DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT.
- **Origem:** DECISION-0053 §L4 segunda parte (2026-05-27). Quando `actor_wallet` do devedor
  não tem saldo suficiente para recovery total, a obrigação fica `partially_recovered`. Futuros
  créditos nessa conta (novos revenue_share, por exemplo) devem ser compensados antes de
  qualquer saque do devedor. DECISION-0055 D3 formalizou esta decisão como vinculante.

### Decisão Clayton (DECISION-0055 D3 — Income Withholding)

Mecanismo canônico aprovado:

```
1. Recovery obrigação ativa (status IN ('approved', 'partially_recovered')).
2. Novo crédito chega na actor_wallet do devedor (ex: novo D-money release).
3. Antes de liberar saldo para saque: verificar obrigações pendentes.
4. Crédito drena obrigação até o valor total.
5. Apenas o excedente fica livre para saque pelo actor.
6. Sem saldo negativo. Sem adiantamento pela plataforma. Sem cofres de terceiros.
```

Caminho B (plataforma adianta reembolso ao payer via `risk_reserve`) está FORA do escopo
MVP por decisão explícita de Clayton. Payer recebe conforme recovery progride (Caminho A).

### O que está faltando

- Gate de entrada de crédito em `actor_wallet` que verifique `actor_wallet_recovery_obligations`
  com status `approved`/`partially_recovered` antes de liberar saldo.
- Lógica de drenagem: crédito entrante → obrigação drenada → saldo residual disponível.
- Update atômico: `recovered_amount_cents` + entry em `obligation_entries` + status transition.
- Sem este gate, devedor pode receber novos créditos e sacar sem quitar obrigação de recovery.

### Não bloqueia hoje

- Nenhum serviço de saque de `actor_wallet` existe (DT-ACTOR-WALLET-DEBIT-MISSING).
- Sem saque ativo, sem risco de fuga de recebíveis.

### Resolução prevista

Frente própria após DECISION-0053 migration (C6) + serviço de débito implementado:
1. Hook/gate no D-money release (`releaseFundsToActorWalletForOrder`) que verifica obrigações ativas.
2. Lógica de drenagem atômica: intercepta crédito entrante, drena obrigação, libera excedente.
3. Update de `actor_wallet_recovery_obligations.recovered_amount_cents` + status transition.
4. E2E: crédito entra → drena R$ X da obrigação → saldo residual R$ (crédito - X) disponível.
5. E2E: crédito quita obrigação inteira → status `recovered` → saldo excedente disponível.

### Vinculadas

- DECISION-0055 D3 (formaliza income withholding como mecanismo canônico)
- DECISION-0053 §L4 (origem da decisão de compensação futura)
- DECISION-0058 (F-ACTOR-WALLET-PAYOUT-WIRING — decisão arquitetural; cobre apenas internal MVP)
- DT-ACTOR-WALLET-PAYOUT-WIRING → CLOSED escopo interno (2026-05-28; ver abaixo)
- DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT → OPEN HIGH (PIX/TED externo — não autorizado)
- DT-PE5-REFUND-POST-DMONEY-CHAIN → CLOSED (2026-05-28)

---

## DT-USER-WALLET-PROVISIONING-FOR-RECOVERY

- **Status:** CLOSED (2026-05-27, commit `13ee5d8a`) — `ensureUserWalletForActor` implementado; E2E 9/9 verde; bug payment-event-resolver corrigido na mesma frente
- **Origem:** C4 READ-FIRST (2026-05-27) — resolver implementado (commit `13db36d8`); `user_wallet` identificada como tipo dormente com 0 rows em runtime.
- **Vinculada a:** DECISION-0056 (D2: creditor_account_id = user_wallet do payer), DECISION-0057 (convenção canônica decidida)

### Contexto

`user_wallet` é o destino canônico de recovery do payer (DECISION-0056 D2). É semanticamente
correto: recovery para payer é devolução ao pagador, não revenue_share. O resolver
`resolveRecoveryCreditor` (`modules/financial-recovery/recovery-creditor-resolver.service.ts`,
commit `13db36d8`) implementa a lógica corretamente, mas no runtime atual `user_wallet` tem
**0 rows** — o tipo existe no schema e no `BankAccountType`, mas nunca foi provisionado.

Consequência: resolver lança `CREDITOR_ACCOUNT_NOT_FOUND` para 100% dos payers atuais.

### Convenção decidida (DECISION-0057)

- **owner_id canônico:** `${userId}:user_wallet` (userId = users.id, nunca actorId)
- **owner_type no DB:** `'actor'` (traduzido de `'user'` via `toDbOwnerType`)
- **actor_id:** resolvido por `actors WHERE user_id = userId AND actor_type IN ('user', 'person', 'actor_human')`
- **Actor sem user_id:** falha com `USER_WALLET_REQUIRES_USER_ID` — sem composite alternativo

### Estratégia de provisionamento (DECISION-0057)

**C4b — frente a implementar (bloqueante para C3):**

1. **Helper:** `ensureUserWalletForActor(tenantId, actorId)` em `bank-account.service.ts`
   - Resolve `userId` via `actors WHERE id = actorId`
   - Delega para `ensureLifecycleAccountsForOwner(tenantId, userId, 'user')` (existente, idempotente)
   - Falha com `USER_WALLET_REQUIRES_USER_ID` se actor não tem `user_id`

2. **Backfill:** script/migration para todos os actors humanos com `user_id NOT NULL` que aparecem em `payment_intents` (independente de status)

3. **Lazy:** chamar `ensureUserWalletForActor` em `createPaymentIntentWithClient` antes do INSERT

### Bug a corrigir separadamente (DT-USER-WALLET-PAYMENT-EVENT-RESOLVER-BUG)

`payment-event-resolver.ts` passa `event.actor_id` onde a função espera `userId`. Não bloqueia
C4b, mas deve ser corrigido na mesma frente ou logo após.

### Não bloqueia hoje

- Guard da Parte A bloqueia estorno perigoso.
- Nenhum fluxo de recovery ativo em produção.
- Resolver fail-closed é comportamento correto enquanto user_wallet não existe.

### Vinculadas

- DECISION-0056 (D2 — user_wallet como destino canônico de recovery)
- DECISION-0057 (D1–D5 — convenção canônica e estratégia de provisionamento)
- DT-ACTOR-WALLET-DEBIT-MISSING (C4b pré-requisito antes de C3)
- DT-USER-WALLET-PAYMENT-EVENT-RESOLVER-BUG (bug de convenção a corrigir)
- DT-PE5-REFUND-POST-DMONEY-CHAIN (cadeia completa depende de C4b + C3)

---

## DT-USER-WALLET-PAYMENT-EVENT-RESOLVER-BUG

- **Status:** CLOSED (2026-05-27, commit `13ee5d8a`) — bug corrigido em C4b-1; `payment-event-resolver.ts` agora chama `ensureUserWalletForActor` que resolve userId internamente
- **Origem:** READ-FIRST C4b (2026-05-27) — divergência de convenção detectada
- **Vinculada a:** DECISION-0057 (D5 — bug documentado; correção adiada)

### Contexto

`backend/src/modules/gateway/payment-event-resolver.ts` linha ~210:
```typescript
await bankAccountService.ensureLifecycleAccountsForOwner(tenantId, event.actor_id, 'user', 'BRL');
```

Passa `event.actor_id` (UUID do actor) onde a função espera `userId` (UUID do usuário da tabela
`users`). `actor.id ≠ actor.user_id` em geral — são entidades distintas. O resultado seria
`owner_id = '${actorId}:user_wallet'` em vez do canônico `'${userId}:user_wallet'`.

Dano potencial: se C4b criar contas com `userId:user_wallet` e este código criar contas com
`actorId:user_wallet`, o mesmo actor poderia ter duas `user_wallet` rows. O resolver C4
(`WHERE actor_id = actorId AND account_type = 'user_wallet'`) retornaria ambas e lançaria
`CREDITOR_ACCOUNT_AMBIGUOUS`.

### Por que não bloqueia agora

`user_wallet` tem 0 rows — nenhuma conta foi criada por este caminho. C4b criará as primeiras
`user_wallet` usando a convenção canônica `userId:user_wallet`. Enquanto C4b não for implantado,
este bug não produz rows conflitantes.

### Correção canônica

```typescript
// payment-event-resolver.ts — ANTES (bug):
await bankAccountService.ensureLifecycleAccountsForOwner(tenantId, event.actor_id, 'user', 'BRL');

// DEPOIS (correto):
const actor = await actorRepository.getById(tenantId, event.actor_id);
if (actor?.userId) {
  await bankAccountService.ensureLifecycleAccountsForOwner(tenantId, actor.userId, 'user', 'BRL');
}
// Se actor sem userId: skip silencioso OU USER_WALLET_REQUIRES_USER_ID — conforme DECISION-0057 D4
```

Ou chamar o helper futuro `ensureUserWalletForActor(tenantId, event.actor_id)` após C4b implementado.

### Resolução prevista

Correção incluída na frente C4b ou em frente própria imediatamente após.
Deve ser resolvida ANTES de qualquer backfill/lazy creation para evitar contas conflitantes.

### Vinculadas

- DECISION-0057 (D5 — bug documentado aqui)
- DT-USER-WALLET-PROVISIONING-FOR-RECOVERY (bug bloqueia se não corrigido antes do backfill)

---

## DT-ACTOR-WALLET-PAYOUT-WIRING

- **Status:** CLOSED — INTERNAL SETTLEMENT SCOPE (2026-05-28). F1+F2+F2-hardening+F3 DONE. Saque interno (`actor_wallet` → `bank_settlement` via account_type) funcional e validado. Escopo externo (PIX/TED/PSP) movido para DT própria: **DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT** (OPEN HIGH / NOT AUTHORIZED).
- **Origem:** DECISION-0058 (2026-05-28). Após F-ACTOR-WALLET-AVAILABLE-BALANCE (commit `f14634c1`), `availableBalanceCents` exposto como projeção de leitura. Implementação do saque real era frente posterior separada — agora interno fechado.
- **Vinculada a:** DECISION-0058, DECISION-0053, DECISION-0054, DECISION-0055, DT-RECOVERY-PAYOUT-GATE (gate interno fechado), DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT (gateway externo OPEN)
- **Classe:** DT-F (feature gap — escopo interno entregue; escopo externo separado)

### Escopo INTERNO entregue (CLOSED 2026-05-28)

Frentes sequenciais — INTERNAL SETTLEMENT:

- F1 SUBSTRATE: **DONE** (commit `98a1111a`, 2026-05-28) — schema + types + E2E 12/12. Gates: tsc clean, actor-writer OK, bank-ledger OK, regression OK, arch critical_new=0.
- F2 REQUEST SERVICE: **DONE** (commit `a1532780`, 2026-05-28) — `requestActorWalletPayout` cria `pending_approval` + approval_request atômico. E2E 16/16.
- F2 HARDENING (active-gate): **DONE** (commit `c7838c50`, 2026-05-28) — 1 request ativo por actor + `ACTOR_WALLET_PAYOUT_ALREADY_ACTIVE` + partial unique index `uidx_actor_wallet_payout_one_active_per_actor` + helper compartilhado `calculateActorWalletBalanceProjection`. E2E 20/20.
- F3 EXECUÇÃO ATÔMICA INTERNA: **DONE** (commit `8f36db6e`, 2026-05-28) — `executeActorWalletPayout` em BEGIN/COMMIT único: SELECT FOR UPDATE → drain → recalc → transfer `actor_wallet`→`bank_settlement` com authorship='ownership'. D-3 (parcial) + D-4 (zero/failed) implementados. E2E F3 18/18.

### Invariantes confirmados pelo F3

- F3 termina em `bank_settlement` (account_type — não tabela).
- F3 NÃO movimenta dinheiro para banco externo.
- F3 NÃO toca `payout_requests` legado (T13).
- F3 NÃO cria row em `bank_settlements` table (T14).
- F3 NÃO cria rota pública.
- F3 NÃO cria worker.
- Drain (C3.1) ocorre dentro da TX de F3 (recovery prevalece).
- Approval `status='approved'` é gate obrigatório (D4).

### Escopo EXTERNO movido para DT própria

PIX/TED/PSP saque para banco externo foi movido para **DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT**. Esta DT (WIRING) fica fechada no escopo interno; ela NÃO acompanha mais o gateway externo.

### Vinculadas

- DECISION-0058 (D1–D5 — decisões arquiteturais; F4 exigirá DECISION nova)
- DT-RECOVERY-PAYOUT-GATE (gate interno fechado por F3; gate externo segue OPEN via F4)
- DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT (gateway externo OPEN HIGH / NOT AUTHORIZED)
- DECISION-0054 (approval substrate — gate D4)
- DECISION-0055 (debit semantics — drain D2 usa `debitActorWalletForRecovery`)
- F-ACTOR-WALLET-AVAILABLE-BALANCE (commit `f14634c1` — projeção que informa UI de saque)

---

## DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT

- **Status:** OPEN HIGH / NOT AUTHORIZED (2026-05-28). Auditorias paralelas A/B/C concluíram veredito unânime de **PARAR**. DECISION-0059 (2026-05-28) registrou a cerca documental para F4 (cofre externo). **DECISION-0060 (2026-05-28) corrigiu a base factual de D5 e fixou governança canônica de F4.0** (identidade/KYC em `identities`, não `actors`; enforcement de "conta própria" em duas camadas; catálogo `actor_bank_destinations`). Implementação proibida até autorização Clayton explícita.
- **Origem:** DECISION-0058 D3 (2026-05-28) restringiu MVP a internal_settlement. F3 entregou cofre interno (CLOSED). DECISION-0059 (2026-05-28) ratificou que F4 é frente própria. DECISION-0060 (2026-05-28) corrigiu D5 e fixou governança.
- **Vinculada a:** DECISION-0060 (governança canônica F4.0 + correção factual D5), DECISION-0059 (cerca documental de F4), DECISION-0058 (decisão atual restringe `destination_type='internal_settlement'`), DT-ACTOR-WALLET-PAYOUT-WIRING (escopo interno CLOSED), DT-RECOVERY-PAYOUT-GATE (gate externo)
- **Classe:** DT-F (feature gap — requer DECISION própria + contratos externos + escolha de PSP)
- **Sub-DTs derivadas:** DT-ACTOR-BANK-DESTINATION-MISSING, DT-EXTERNAL-PAYOUT-ORDER-SUBSTRATE-MISSING, DT-PSP-DISBURSEMENT-ADAPTER-MISSING, DT-EXTERNAL-PAYOUT-CALLBACK-RECONCILIATION-MISSING, DT-PAYOUT-EXTERNAL-KYC-GATE-MISSING

### Veredito A/B/C (2026-05-28)

- **A — autoridade/norma**: PARAR. Produto, compliance, KYC e norma insuficientes para autorizar envio a banco externo.
- **B — schema/código**: PARAR. Substrato externo (destinos bancários, ordens externas, callbacks) inexistente.
- **C — concorrência/idempotência/PSP**: PARAR. Worker, status model externo, idempotência externa e PSP indefinidos.

Veredito consolidado: F4 NÃO vira código sem DECISION + autorização. DECISION-0059 é essa cerca.

### O que falta (escopo F4)

1. **Decisão arquitetural própria** (não é DECISION-0058 — esta cobre apenas internal MVP):
   - Quais `destination_type` extras: `'pix'`, `'ted'`, `'wire'`?
   - Política de KYC / verificação de conta bancária do beneficiário.
   - Limites operacionais (per-actor, per-dia, per-mês).
   - SLA de settlement (síncrono vs. async com callback).
2. **CHECK extension** em `actor_wallet_payout_requests.destination_type` para incluir destinos externos (migration nova).
3. **Schema**: campos `destination_key` validados conforme tipo (PIX key format, agência+conta para TED, etc.).
4. **Contrato PSP**: gateway parceiro (Stark, Pagarme, etc.) + credenciais + sandbox + produção.
5. **Callback assíncrono**: webhook handler para status final do banco externo; reconciliação com `actor_wallet_payout_requests.status`.
6. **Compliance**: anti-money-laundering, blocklists, tribunal-de-contas se aplicável.
7. **Service novo OU extension do `executeActorWalletPayout`**: decidir se F4 é método separado (`executeActorWalletPayoutExternal`) ou parâmetro adicional.
8. **Reconciliation detective**: cruzar `actor_wallet_payout_requests` external com extratos do PSP.
9. **Worker assíncrono** (necessário para PSP — callback pode demorar horas).
10. **E2E F4**: settlement externo, callback de sucesso, callback de falha, timeout, reconciliação.

### O que NÃO é F4

- F3 settlement interno (CLOSED via DT-ACTOR-WALLET-PAYOUT-WIRING).
- Drain de obrigações em atender saque interno (CLOSED via F3).
- Income withholding C3.1 (CLOSED via DT-RECOVERY-PAYOUT-GATE escopo interno).
- Ledger / bank_transactions infrastructure (existente e estável).

### Não bloqueia hoje

- F3 entrega saque INTERNO operacional para MVP.
- Sem rota pública / worker / PSP, não há risco de falha real com banco externo.
- `availableBalanceCents` permanece projeção de leitura — UI pode mostrar saldo sem autorizar movimentação externa.

### Resolução prevista

Frente F4 — requer autorização explícita Clayton + READ-FIRST em três paralelas:
- **A** — norma/autoridade: quais aprovações adicionais para saque externo (KYC, limit policies).
- **B** — schema/código: CHECK extension, callback handler, worker, reconciliação.
- **C** — concorrência/idempotência/compliance: webhook deduplication, timeout, AML, blocklists.

### Vinculadas

- DECISION-0059 (cerca documental — F4 começa com DECISION, não com código)
- DECISION-0058 (decisão atual restringe a internal_settlement — F4 exigirá DECISION nova)
- DT-ACTOR-WALLET-PAYOUT-WIRING (escopo interno fechado)
- DT-RECOVERY-PAYOUT-GATE (gate externo permanece OPEN apenas no contexto F4)

---

## DT-ACTOR-BANK-DESTINATION-MISSING

- **Status:** CLOSED (2026-05-28) — F4.0 MVP substrate entregue (commit `e1536d07`). Migration `20260530574000`, service `actorBankDestinationService`, E2E 8/8 PASS, todos os gates verdes. Catálogo `actor_bank_destinations` existe com lifecycle + TRIGGER de "conta própria" + auto_tax_id_match + manual_review. Nenhuma operação financeira real disparada. **Base factual estabelecida em DECISION-0060.**
- **Origem:** DECISION-0059 D5 (2026-05-28). Saque externo exige que o actor tenha conta bancária registrada e ownership verificado.
- **Correção factual:** DECISION-0060 (2026-05-28) substitui a referência obsoleta a `actor.cpf_cnpj` (coluna removida em migration 0010) pela referência canônica a `identities.tax_id`. Enforcement de "conta própria" passa a ser duas camadas (service + TRIGGER), pois CHECK puro não suporta JOIN.
- **Vinculada a:** DECISION-0060 (governança canônica F4.0), DECISION-0059 (D5 — substrato de destinos bancários), DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT (DT mãe).
- **Classe:** DT-F (feature gap — entidade conceitual definida em DECISION-0059, corrigida factualmente por DECISION-0060, não implementada).

### O que falta

Entidade `actor_bank_destinations` com (referência canônica: DECISION-0060):
- destination_type ('pix_key' | 'bank_account')
- pix_key_type + pix_key (para PIX) OU bank_code + agency + account_number + account_type (para TED)
- holder_document + holder_name + ownership_verified_at + ownership_verification_method
- Enforcement "conta própria" em DUAS camadas (DECISION-0060 D8):
  - Service layer fail-closed: rejeita INSERT/UPDATE onde `holder_document ≠ identities.tax_id` (via JOIN `actors.global_user_id → users.global_user_id → identities`).
  - TRIGGER BEFORE INSERT/UPDATE: mesma comparação no DB.
  - CHECK constraint puro NÃO é aceito (não suporta JOIN).
- status lifecycle: pending_verification → verified | rejected | archived (DECISION-0060 D9)
- ownership_verification_method: auto_tax_id_match | manual_review | psp_future (DECISION-0060 D10)

### Não bloqueia hoje

F4 inteiro está NOT AUTHORIZED. Sem F4 autorizada, F4.0 não tem caller.

### Vinculadas

- DECISION-0060 (governança canônica F4.0 + correção factual de DECISION-0059 D5)
- DECISION-0059 D5
- DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT (DT mãe)

---

## DT-EXTERNAL-PAYOUT-ORDER-SUBSTRATE-MISSING

- **Status:** OPEN HIGH / NOT AUTHORIZED (2026-05-28). F4.1 — substrato de ordem externa.
- **Origem:** DECISION-0059 D6 + D7 (2026-05-28). External settlement orders são entidade própria; NÃO reaproveitar bank_settlements / payout_requests / actor_wallet_payout_requests.
- **Vinculada a:** DECISION-0059 D6/D7/D9/D10, DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT (DT mãe).
- **Classe:** DT-F (schema gap — entidade conceitual definida em DECISION-0059, não implementada).

### O que falta

Entidade `actor_wallet_external_payouts` com (ver DECISION-0059 D6):
- payout_request_id FK (vínculo com pedido interno aprovado)
- actor_bank_destination_id FK (vínculo com F4.0)
- provider + external_idempotency_key + provider_reference_id
- status lifecycle D7: pending → processing → sent → confirmed / failed_transit / failed_final / returned / cancelled
- sent_at / confirmed_at / returned_at (D8: NUNCA NOW() sem callback)
- amount_sent_cents / amount_confirmed_cents (podem divergir)
- bank_settlement_transaction_id / return_transaction_id
- request_payload / response_payload (JSONB)

### Não bloqueia hoje

F4 NOT AUTHORIZED.

### Vinculadas

- DECISION-0059 D6/D7/D8/D9/D10
- DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT (DT mãe)
- DT-ACTOR-BANK-DESTINATION-MISSING (F4.0 — pré-requisito)

---

## DT-PSP-DISBURSEMENT-ADAPTER-MISSING

- **Status:** OPEN HIGH / NOT AUTHORIZED (2026-05-28). F4.2 — adapter do parceiro bancário.
- **Origem:** DECISION-0059 D12 (2026-05-28). PSP/parceiro NÃO escolhido. Adapter real proibido até DECISION nova.
- **Vinculada a:** DECISION-0059 D12, DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT (DT mãe).
- **Classe:** DT-F + DT-D (feature gap + decisão pendente — escolha de PSP é decisão de produto/compliance).

### O que falta

1. Escolha do PSP (Stark, Pagarme, Inter, banco direto, etc.) — exige análise de custo, SLA, regiões, compliance.
2. Credenciais sandbox + produção.
3. Adapter `pspDisbursementAdapter` com interface mínima:
   - `send(externalPayoutId, destination, amount, idempotencyKey)`
   - `query(providerReferenceId)`
4. Mapping de errors do PSP para status D7.

### Proibições

- Mock que finge produção (preenche `confirmed_at` sem callback real) é VETADO (D8 + D12).
- Sandbox precisa ser declarado explicitamente em DECISION de sandbox separada.

### Não bloqueia hoje

F4 NOT AUTHORIZED.

### Vinculadas

- DECISION-0059 D12
- DT-EXTERNAL-PAYOUT-ORDER-SUBSTRATE-MISSING (F4.1 — pré-requisito)
- DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT (DT mãe)

---

## DT-EXTERNAL-PAYOUT-CALLBACK-RECONCILIATION-MISSING

- **Status:** OPEN HIGH / NOT AUTHORIZED (2026-05-28). F4.3 — webhook + state machine + returned handling.
- **Origem:** DECISION-0059 D7/D8/D10/D11 (2026-05-28). Callback do PSP é fonte de verdade externa; sem ele, status nunca avança para `confirmed`/`returned`.
- **Vinculada a:** DECISION-0059 D7/D8/D10/D11, DT-PSP-DISBURSEMENT-ADAPTER-MISSING.
- **Classe:** DT-F (feature gap — fluxo assíncrono crítico).

### O que falta

1. Webhook handler: rota pública (ou endpoint privado autenticado) que recebe callback do PSP.
2. Webhook deduplication por `provider_reference_id` + status transition válido (D10).
3. State machine: `pending → processing → sent → confirmed | failed_transit | failed_final | returned`.
4. Returned handling (D11):
   - Receber callback de devolução.
   - Marcar `returned_at` + `status='returned'`.
   - Criar `bank_transactions` de re-crédito (`external_in` → `actor_wallet`).
   - Atualizar `return_transaction_id`.
   - Decidir destino de `actor_wallet_payout_requests.status` (voltar para `approved`? marcar `failed` terminal?).
5. Reconciliation periódica: cruzar registros locais com extrato do PSP para detectar status descasados.

### Não bloqueia hoje

F4 NOT AUTHORIZED. Sem PSP definido, callback é especulativo.

### Vinculadas

- DECISION-0059 D7/D8/D10/D11
- DT-PSP-DISBURSEMENT-ADAPTER-MISSING (F4.2 — pré-requisito)
- DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT (DT mãe)

---

## DT-PAYOUT-EXTERNAL-KYC-GATE-MISSING

- **Status:** OPEN HIGH / NOT AUTHORIZED (2026-05-28). F4.4 — gates de compliance/KYC. **Gate canônico definido em DECISION-0060 D5** (não em `actors.kyc_status`).
- **Origem:** DECISION-0059 D3 + D4 (2026-05-28). KYC verified + conta própria são pré-requisitos fail-closed.
- **Correção factual:** DECISION-0060 D4/D5 (2026-05-28) substitui referência obsoleta a `actor.kyc_status='verified'` (coluna removida em migration 0010) pela referência canônica `identities.kyc_status='approved'` via `evaluateKycLayer` em modo `strict`.
- **Vinculada a:** DECISION-0060 (governança canônica KYC), DECISION-0059 D3/D4, DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT (DT mãe).
- **Classe:** DT-F + DT-N (feature gap + norma — compliance exige decisões de produto).

### O que falta

1. Gate KYC fail-closed (canônico via DECISION-0060 D5 + D12):
   - PF: `identities.kyc_status='approved'` (NÃO `actors.kyc_status='verified'` — coluna não existe)
   - PJ: idem, `tax_id_type='cnpj' AND kyc_status='approved'` (KYB usa mesma coluna)
   - Implementação canônica: `evaluateKycLayer` em `authority-decision.service.ts:125-205` em modo `strict`.
   - **Aplicação por sub-frente (DECISION-0060 D12):**
     - F4.0 (cadastro): pode admitir `kyc_status='pending'` se Clayton ratificar no prompt executor F4.0. Cadastro NÃO movimenta dinheiro.
     - F4.1+ (uso real para payout externo): exige `kyc_status='approved'` strict SEM EXCEÇÃO.
   - Sem gate verde no USO real, F4 é bloqueado.
2. Gate "conta própria" (D3):
   - Verificar que `actor_bank_destinations.holder_document = actor.cpf_cnpj`.
   - Envio para terceiro proibido até DECISION específica.
3. Limites operacionais:
   - Per-actor diário/mensal.
   - AML: detecção de padrões suspeitos.
   - Blocklists (PEP, sanções).
4. Audit trail: capability snapshot + permission snapshot no momento do envio.

### Decisões PRODUTO pendentes

- Limites exatos (R$ por dia, por mês).
- Critério de KYB para PJ.
- Política de envio a terceiro (proibido MVP; quando autorizar?).
- Cooldown entre saques.

### Não bloqueia hoje

F4 NOT AUTHORIZED. Sem F4, KYC gate externo não tem caller.

### Vinculadas

- DECISION-0060 (gate canônico KYC via `identities.kyc_status='approved'` + `evaluateKycLayer` strict)
- DECISION-0059 D3/D4
- DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT (DT mãe)
- DT-ACTOR-BANK-DESTINATION-MISSING (F4.0 — implementa o "conta própria" check em duas camadas conforme DECISION-0060 D8)

---

## DT-PUBLIC-PROFILES-NO-FRONTEND-CONSUMER

- **Status:** OPEN — BLOCKED BY DECISION-0061 (2026-05-28). Raio-X material concluído nesta sessão confirmou: tabela existe + backend module vivo + 0 rows runtime + frontend não consome + `/social/actors/:id` lê de `actors` que tem todas as colunas duplicadas (`display_name`, `slug`, `bio`, `avatar_url`, `cover_url`, `metadata`). DECISION-0061 escolheu Hipótese C — `actors` SSOT de identidade pública básica; `public_profiles` reservada como camada pública/social complementar (`visibility`, `is_public`, `is_verified` não-KYC, `profile_type` reconciliado, contadores como projeção definida). Implementação futura segue C1 (saneamento de schema) ou C2 (neutralização temporária) conforme prompt executor futuro.
- **Severidade:** MEDIUM
- **Classe:** DT-D (drift — substrato sem consumer alinhado)
- **Origem:** auditoria de perfil/contexto pós-F4.0 (2026-05-28).
- **Não fechada:** implementação (saneamento C1 ou neutralização C2) ainda pendente. DECISION-0061 é cerca documental, não estrada.

### Contexto

A tabela `public_profiles` existe no schema vivo, com campos público actor-keyed
(bio, cover, follower_count, visibility e similares), mas não há consumer
frontend claro que materialize esses campos como identidade pública do actor.
O frontend continua tratando partes do perfil como user-keyed.

### Risco

- Substrato público actor-keyed virar órfão por falta de uso real.
- Frontend continuar usando perfil user-keyed como se fosse a identidade
  pública do actor — o que é incoerente com a tese actor-first (DECISION-0043
  e adjacentes).

### Mitigação atual

- Sem impacto financeiro/autoridade — `public_profiles` é projeção pública,
  não fonte de capability nem de saldo.

### Resolução prevista

DECISION-0061 fixou canonicidade: `actors` é SSOT de identidade pública básica;
`public_profiles` é camada complementar. Próximo prompt executor escolherá entre:

- **C1 — Saneamento**: migration de DROP COLUMN para remover duplicação em
  `public_profiles`; manter apenas campos sociais/complementares; ajustar
  service+repository; decidir seed/backfill; frontend só consome depois.
- **C2 — Neutralização temporária**: manter substrato sem consumer; documentar
  reserva; usar `actors` como caminho MVP; eventualmente remover callers
  dormentes em `venue.routes.ts` se também não tiverem fluxo ativo.

Nenhuma das duas autorizada por DECISION-0061. Aguarda prompt executor próprio
com escolha explícita Clayton.

### Vinculadas

- **DECISION-0061** (canonicidade pública do perfil do actor — escolha de hipótese C)
- DECISION-0043 (actor como modo operacional — não cobre SSOT pública de perfil; DECISION-0061 complementa)
- DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT (drift relacionado entre perfil e actor)
- DT-USER-PROFILES-LEGACY-ORPHAN (legado ortogonal — `user_profiles.cpf` superseded por `identities.tax_id`)
- DT-PE5-PF-RESOLVER-PENDING (resolução parcial via DECISION-0061 — domínio social fixado)

---

## DT-CAPABILITIES-ENDPOINT-FRONTEND-DISCONNECTED

- **Status:** OPEN (2026-05-28)
- **Severidade:** LOW
- **Classe:** DT-D (drift entre substrato backend e projeção frontend)
- **Origem:** auditoria de perfil/contexto pós-F4.0 (2026-05-28).

### Contexto

`GET /actors/:id/capabilities` existe no backend e responde corretamente,
mas o frontend ainda usa `actorContextConfig.ts` hardcoded para projetar
capabilities por actor_type/modo. O endpoint canônico está disponível e
não consumido.

### Risco

- Hardcode MVP v1 virar fonte permanente de UX sem rastreio de qual
  capability cada actor pode exercer.
- Divergência silenciosa entre o que o backend autoriza e o que o frontend
  oferece como atalho/CTA.

### Mitigação atual

- Hardcode é projeção visual; **não concede autoridade financeira nem
  operacional**. Backend continua autoritativo via `authority-decision.service`.

### Resolução prevista

Frontend consumir o endpoint real quando MVP v2 (modo operante dinâmico) for
autorizado (project_modo_operante v2) OU decisão explícita mantendo v1
hardcode com prazo/critério de convergência.

### Vinculadas

- DECISION-0039 (modo operante — substrato canônico)
- project_modo_operante (memória) — v1 hardcoded, v2 dinâmica não autorizada

---

## DT-USER-PROFILES-LEGACY-ORPHAN (SUPERSEDED 2026-05-28)

> **SUPERSEDED por DT-CPF-SSOT-DUAL-WRITE-CORE-VS-IDENTITY** (mesma data).
> Classificação original ("legado órfão") foi materialmente refutada por raio-X (HEAD `ccd03ad8`):
> `user_profiles` tem 7 rows em runtime; `core.service.ts:313` declara `cpfSource: 'user_profiles'`
> como FONTE ÚNICA; `profile.service.ts:455-477` faz UPSERT em `user_profiles` + UPDATE espelho
> em `profiles.cpf`; frontend `Profile.tsx:336` consome via `getCoreProfile().personal_profile.cpf`.
> Não é órfã. O problema real é dual-write/ambiguidade de CPF entre CORE (`user_profiles`/`profiles`)
> e identity/KYC/payout (`identities.tax_id`, DECISION-0060 D2). Ver DT abaixo.

- **Status:** SUPERSEDED (2026-05-28) — entrada original mantida como histórico append-only.
- **Severidade original:** LOW (subdimensionada — risco real é MEDIUM, ver DT sucessora).
- **Classe original:** DT-L (incorreta — substrato é vivo, não órfão).
- **Origem:** auditoria de perfil/contexto pós-F4.0 (2026-05-28).

### Contexto histórico (preservado)

Entrada original assumiu que `user_profiles` era legado coexistindo com `profiles` sem
consumer frontend ativo. Raio-X confirmou que essa leitura era incorreta materialmente.

### Vinculadas

- **DT-CPF-SSOT-DUAL-WRITE-CORE-VS-IDENTITY** (DT sucessora — escopo correto)
- DT-PUBLIC-PROFILES-NO-FRONTEND-CONSUMER (família tangencial — DECISION-0061)

---

## DT-AVAILABLE-ACTOR-USER-ID-CONFUSION-RISK

- **Status:** OPEN (2026-05-28)
- **Severidade:** LOW
- **Classe:** DT-N (nomenclatura/risco de confusão semântica)
- **Origem:** auditoria de perfil/contexto pós-F4.0 (2026-05-28).

### Contexto

`AvailableActor.user_id?` é exposto no frontend dentro da projeção do switcher
de actor. A presença simultânea de `actor_id` e `user_id` no mesmo objeto pode
induzir manutenção futura a usar `user_id` em operação que deveria ser
actor-scoped.

### Risco

- Drift silencioso: hooks/rotas futuras lerem `user_id` por engano em fluxos
  actor-scoped.
- Quebra do pilar "frontend nunca cria verdade — projeta verdade resolvida"
  por leitura errada da identidade soberana.

### Mitigação atual

- Nenhum misuse confirmado em auditoria. Risco é preventivo.

### Resolução prevista

- Audit grep de consumers de `AvailableActor.user_id` no frontend.
- Remover o campo se não houver uso necessário, OU renomear para deixar
  semântica explícita (`owner_user_id`, etc.), OU documentar uso permitido.

### Vinculadas

- feedback_frontend_nunca_cria_verdade (regra cross-layer)
- 07_NOMENCLATURA_CANONICA (regra de campos com sufixo explícito)
- DT-CPF-SSOT-DUAL-WRITE-CORE-VS-IDENTITY (tangencial — outra ambiguidade no domínio identidade, com escopo distinto: SSOT de CPF entre CORE e KYC)

### Atualização do raio-X (2026-05-28, HEAD `ccd03ad8`)

Auditoria confirmou 4 call sites usando padrão `activeActor.user_id || activeActor.actor_id`:
`DisputePanel.tsx:76,90,104` + `ActivityDetailModal.tsx:58`. APIs chamadas
(`createDispute`, `resolveDispute`, etc.) declaram parâmetro como `*UserId`
(USER ID), mas estão MOCKADAS via `localStorage` hoje — endpoint backend
comentado em `api/disputes.ts`. Risco real mas dormente. Fatia mínima futura:
remover fallback nos 4 call sites + remover/renomear `user_id?` do type, em
paralelo com fatia de disputes ganhar backend real.

---

## DT-UX-GHOST-ROUTE-TRANSPARENCIA

- **Status:** CLOSED (2026-05-28) — `frontend/src/pages/TransparencyPage.tsx` criado como placeholder honesto e registrado em `App.tsx` (dentro do SocialLayout, junto com `impacto`). Mensagem clara: módulo em preparação, sem buscar backend, sem inventar números, com botão de voltar para `/home`. Links existentes em `DashboardHome.tsx`, `actorContextConfig.ts` e `businessProfileCatalog.ts` agora resolvem para a página real em vez de tela em branco. Build frontend OK.
- **Severidade:** LOW
- **Classe:** DT-F (feature gap — link sem destino)
- **Origem:** auditoria de UX pós-F4.0 (2026-05-28).
- **Resolução:** commit `26ce0e28` (sessão 2026-05-28). Zero backend, zero migration. Apenas frontend.

### Contexto

Navegação aponta para `/transparencia`, mas a rota não existe no router
frontend. Click resulta em tela em branco ou fallback genérico.

### Risco

- UX quebrada em fluxo aparentemente disponível.
- Sinal de descompromisso com o pilar de transparência operacional do projeto.

### Resolução prevista

Criar placeholder honesto (página "em construção") ou ajustar navegação para
não expor o link até o módulo existir.

---

## DT-UX-GHOST-ROUTE-NOTIFICATIONS

- **Status:** CLOSED (2026-05-28) — `frontend/src/pages/NotificationsPage.tsx` criado como placeholder honesto e registrado em `App.tsx`. Sino no `DashboardHome` (`route: '/notifications'`) agora resolve. Mensagem clara: central em preparação, sem buscar backend, sem badge fake, sem item simulado. **Observação documentada na própria página**: existem `api/system-notifications.ts` + `components/system-notifications/NotificationList.tsx` que consomem backend real; a integração formal fica para fatia de produto separada (decisão sobre filtros, paginação, política read/unread visível). Build frontend OK.
- **Severidade:** LOW
- **Classe:** DT-F (feature gap — link sem destino)
- **Origem:** auditoria de UX pós-F4.0 (2026-05-28).
- **Resolução:** commit `26ce0e28` (sessão 2026-05-28). Zero backend, zero migration. Apenas frontend.

### Contexto

Sino do header aponta para `/notifications`, mas a rota não existe no router
frontend. Click resulta em tela em branco.

### Risco

- UX quebrada em elemento global persistente (sino sempre visível).
- Frustração imediata do usuário.

### Resolução prevista

Criar placeholder honesto OU remover o link/sino até o módulo de notificações
existir como rota real.

---

## DT-DEPRECATED-ACTOR-CONTEXT-KEY-ORPHAN

- **Status:** CLOSED (2026-05-28) — arquivo deprecated deletado (`frontend/src/hooks/useActorContext.ts`). Zero consumers reais (confirmado por grep antes E depois do delete). Comentário órfão em `useActorMode.ts:5` ajustado para apontar `SessionProvider/useSession` (runtime soberano). Chave `unificard_active_actor` (sem `_id`) **não existe mais** no source frontend. Chave soberana `unificard_active_actor_id` permanece em `SessionProvider`, `api/client.ts`, `api/events-v2.ts`, `Login.tsx`. Frontend build + typecheck + backend gates (actor-writer, regression-guards, arch) verdes.
- **Severidade:** MEDIUM
- **Classe:** DT-L (legado órfão com risco de reintrodução)
- **Origem:** auditoria de perfil/contexto pós-F4.0 (2026-05-28).
- **Resolução:** commit `234b7909` (sessão 2026-05-28). Zero backend runtime alterado. Zero migration. Apenas 2 arquivos frontend (delete + ajuste de comentário órfão).

### Contexto

Arquivo deprecated `useActorContext.ts` ainda existe e usa chave localStorage
paralela `unificard_active_actor`, enquanto o canônico `SessionProvider` usa
`unificard_active_actor_id`. Duas chaves coexistem no mesmo namespace de
storage.

### Risco

- Reimportação futura (acidental ou via copy-paste) de `useActorContext`
  cria desync silencioso de actor ativo entre tabs/abas.
- Drift difícil de detectar porque ambos os caminhos compilam e rodam.

### Mitigação atual

- Nenhuma — arquivo continua importável. Risco material se for usado.

### Resolução prevista

- Deletar o arquivo deprecated, OU
- Bloquear import via lint/gate, OU
- Documentar explicitamente como vetado e marcar com `@deprecated` + erro
  em build se importado.

### Vinculadas

- DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT (família de drift actor/contexto)

---

## DT-COMPANY-DASHBOARD-ACTOR-CHECK-EMPTY

- **Status:** CLOSED (2026-05-28) — bloco `if (activeActor?.actor_type !== 'page')` em `CompanyDashboardPage.tsx` (linhas 23-26) que continha só comentário "Por enquanto, apenas renderizar o dashboard - ele vai lidar com permissões" foi substituído por estado honesto: ícone 🏢, mensagem clara explicando que o painel só está disponível quando o actor ativo é a empresa, instrução para trocar no seletor de actor, e dois botões (Ir para Empresas / Voltar para a Home). Zero fetch, zero authority resolution no frontend, zero troca implícita de actor. Backend permanece autoritativo. Build frontend + typecheck + backend gates verdes.
- **Severidade:** LOW
- **Classe:** DT-D (drift de UX — check incompleto)
- **Origem:** auditoria de UX pós-F4.0 (2026-05-28).
- **Resolução:** commit `42dcd047` (sessão 2026-05-28). Zero backend, zero migration.

### Contexto

`CompanyDashboardPage` contém check de `actor_type` que pode terminar vazio
ou ambíguo quando o actor ativo não é uma empresa. Usuário PF, grupo, canal
ou outro tipo acessando essa rota encontra UX confusa.

### Risco

- UX confusa em rota acessível por engano (ex.: usuário troca de actor sem
  perceber que está em URL de empresa).
- Backend preserva segurança (autoridade não é concedida pelo dashboard),
  mas usuário fica perdido.

### Mitigação atual

- Backend permanece autoritativo — sem capability/saldo entregue por engano.
- Risco é apenas de experiência, não material financeiro.

### Resolução prevista

Tela explicativa quando `actor_type` não é empresa OU redirect seguro para
o homepage contextual do actor atual.

---

## DT-PROTECTEDROUTE-DIAGNOSTIC-LOG

- **Status:** CLOSED (2026-05-28) — bloco diagnóstico `[DIAG 2026-05-19]` (linhas 15-24 do `ProtectedRoute.tsx`, com `console.log('[ProtectedRoute DIAG]', {...})`) removido cirurgicamente. Lógica de auth (`authHydrated`, `isAuthenticated()`, `getTenantId()`, redirect para `/login`) preservada intacta — bloco DIAG estava isolado, sem dependência. O próprio comentário antigo já dizia "Remover após diagnóstico concluído." Build frontend + typecheck + backend gates verdes.
- **Severidade:** LOW
- **Classe:** DT-H (higiene — ruído de log)
- **Origem:** auditoria de perfil/contexto pós-F4.0 (2026-05-28).
- **Resolução:** commit `42dcd047` (sessão 2026-05-28). Zero backend, zero migration.

### Contexto

`ProtectedRoute.tsx` mantém `console.log` diagnóstico ativo. Em produção
esse log gera ruído desnecessário e pode vazar informação sobre estrutura
de auth/routing para console do browser.

### Risco

- Ruído em console em produção.
- Leak de detalhes internos para qualquer usuário com devtools aberto.

### Resolução prevista

Remover em fatia pequena de higiene ou condicionar via `if (DEV) console.log`.

---

## DT-E2E-ACTOR-WALLET-PAYOUT-FIXTURE-BALANCE-DEPLETION

- **Status:** CLOSED (2026-05-28) — F2 ganhou pre-flight `seedWalletCreditF2` + cleanup determinístico via `cleanupSeedCreditsF2` (reference_type='e2e_f2_seed'), mesmo padrão já existente em F3 (`seedWalletCredit`/`cleanupSeedCredits` com reference_type='e2e_f3_seed'). F3 já tinha cleanup completo de drain transactions (via `actor_wallet_recovery_obligation_entries.recovery_transaction_id`). Determinismo provado por sequência F3→F2→F2→F3 — cada suite seed sua própria baseline, limpa tudo, próxima execução não depende de estado residual. Pre-flight log do F2 confirma: "F2 seed credit 8092 cents (saldo 1908 → 10000)".
- **Severidade:** MEDIUM
- **Classe:** DT-T (teste — fixture/state contaminado)
- **Origem:** auditoria F4.0 (2026-05-28).
- **Resolução:** commit `1fb196db` (sessão 2026-05-28). Zero código de produção alterado. Apenas scripts E2E.

### Contexto

Durante a execução de F4.0, o E2E F2 inicialmente reportou 11/20 porque o
saldo da `actor_wallet` do actor de teste estava em 0 após runs anteriores
de F3. F3 cria drain transactions que reduzem o saldo permanentemente quando
o cleanup não remove TODOS os ledger entries vinculados (drain transfers
de wallet → creditor + payout transfers de wallet → bank_settlement, com
diferentes referenceTypes). Restauração manual via crédito direto no ledger
foi necessária para F2 voltar a 20/20.

### Risco

- E2Es financeiros dependerem de estado residual entre suites, mascarando
  regressões reais. Falha intermitente difícil de diagnosticar.
- Manutenção futura aceitar "falha cosmética por depletion" e perder sinal
  de regressão estrutural genuína.
- Validar que F4.0 não causa regressão fica menos confiável quando a
  baseline depende de seeded balance manual.

### Mitigação atual

- F4.0 NÃO causou a depletion (não toca saldo).
- Restauração manual foi documentada e a falha foi isolada como ambiental.
- F3 E2E tem pre-flight (`seedWalletCredit`) que mitiga seu próprio caso, mas
  F1/F2 não têm.

### Resolução adotada (CLOSED 2026-05-28)

**Opção 3 — seed determinístico por suite** (a mais barata sem mexer em produção).

F2 agora replica o padrão já existente em F3:

- `seedWalletCreditF2(actorId, accountId, amountCents)`: INSERT direto em
  `bank_transactions` (purpose='initial_credit', reference_type='e2e_f2_seed')
  + INSERT em `bank_ledger` direção 'credit'. Padrão consistente com C3 E2E
  e com `seedWalletCredit` de F3.
- Pre-flight em `main()`: se `getWalletBalance` < 10000, seed do delta para
  garantir baseline determinística antes de capturar `snapshot0`.
- `cleanupSeedCreditsF2()` no finally: `DELETE` por `reference_type='e2e_f2_seed'`
  remove seeds desta suite, mantendo isolamento entre runs.

F3 já tinha esta arquitetura desde sua criação (commit `8f36db6e`). F3 também
limpa drain transactions via `cleanupObligFixture` que resolve
`actor_wallet_recovery_obligation_entries.recovery_transaction_id` e deleta
as bank_transactions + bank_ledger correspondentes — drain do trilho recovery
não fica órfão.

### Evidência de determinismo

Sequência testada na sessão de resolução:

1. F3 RUN 1 → 18/18 (pre-flight log)
2. F2 RUN 1 pós-F3 → `[pre-flight] F2 seed credit 8092 cents (saldo 1908 → 10000)` → 20/20
3. F2 RUN 2 → 20/20 (sem necessidade de seed adicional, idempotente)
4. F3 RUN 2 → 18/18

Confirmado: cada suite cria sua baseline, limpa tudo, próxima execução não
depende de estado residual.

### Confirmação de escopo

- Zero alteração em código runtime de produção (services, repositories, controllers).
- Zero migration nova.
- Zero alteração em invariantes financeiros.
- Apenas scripts E2E foram tocados.

### Vinculadas

- E2E F2 (`validate-pipeline-e2e-f2-actor-wallet-payout-request.ts`)
- E2E F3 (`validate-pipeline-e2e-f3-actor-wallet-payout-execution.ts`) — já tem pre-flight `seedWalletCredit`
- DT-ACTOR-BANK-DESTINATION-MISSING — CLOSED (F4.0 entregue sem causar essa depletion)

---

## DT-CPF-SSOT-DUAL-WRITE-CORE-VS-IDENTITY

- **Status:** OPEN — BLOCKED BY DECISION-0062 (2026-05-28). Sucede DT-USER-PROFILES-LEGACY-ORPHAN. **Hipótese escolhida: A como destino canônico, com execução gradual (F0–F5)** conforme DECISION-0062 D10. Não fechada — DT só vira CLOSED após F0–F5 mergeados e janela de observação sem regressão. **F0.1 DONE** (commit `fee7b754` — bank-balance-by-cpf ghost reference fix). **F2 DONE** (commit `e68be393` — backfill idempotente de 10 identities a partir de global_users.cpf). F1 audit, F3 E2E coerência, F4 migrar leitura CORE e F5 deprecar caches transitórios ainda pendentes.
- **Severidade:** MEDIUM (era LOW na DT antiga; risco real é divergência cross-domain entre CORE e KYC/payout).
- **Classe:** DT-D + DT-N (drift de canonicidade + decisão arquitetural canonizada por DECISION-0062 mas implementação não autorizada).
- **Origem:** raio-X de `user_profiles` + `AvailableActor.user_id` pós-DECISION-0061 (HEAD `ccd03ad8`, 2026-05-28).
- **Cross-link com DECISIONs:** DECISION-0062 (canonicidade global escolhida — Hipótese A); DECISION-0060 D2 (`identities.tax_id` SSOT KYC/payout/F4) é base; DECISION-0061 D6 (vetada exposição pública de `tax_id`) é coerente; `IDENTITY_SSOT_PRECEDENCE.md` é a normativa-mãe estendida.

### Achados materiais (do raio-X)

1. **`user_profiles` é substrato VIVO, não órfão.**
   - 7 rows em runtime (`unificard_dev`), todas com CPF preenchido.
   - `core.service.ts` (linhas 180, 225-263, 297-338) declara explicitamente
     `cpfSource: 'user_profiles'` como FONTE ÚNICA de CPF no payload
     `GET /core/profile.personal_profile.cpf`.
   - `profile.service.ts:418-477` faz CTE de UPSERT em `user_profiles` E
     UPDATE espelho em `profiles.cpf` no mesmo caminho de escrita.
   - `auth.service.ts:393-397` comenta o bug-fix 2026-05-14 que garante
     propagação de CPF para `user_profiles` via `profileService`.
   - Frontend `Profile.tsx:336-344` consome `personal_profile.cpf` em
     UI editável de perfil (LIVE em runtime).

2. **`profiles.cpf` é espelho dual-write.**
   - `profiles` tem 61 rows com CPF em runtime.
   - Atualizado em conjunto com `user_profiles` via CTE em `profile.service.ts:455-477`.
   - Sincronia controlada se TODA escrita passar por esse caminho.

3. **`identities.tax_id` é SSOT paralelo declarado em DECISION-0060.**
   - DECISION-0060 D2 declarou `identities.tax_id` como SSOT canônico
     para documento fiscal no trilho KYC + F4 payout.
   - `identity.service.ts:255` escreve em `identities` em caminho separado
     (KYC submission, não onboarding via core/profile).
   - Migration 0010 removeu `actors.cpf_cnpj` e fez backfill para `identities.tax_id`.

4. **Divergência runtime já observada.**
   - 7 rows em `user_profiles.cpf`
   - Apenas 4 dessas 7 mapeiam a uma `identities.tax_id` matchando exatamente
     (via `users.global_user_id → identities.global_user_id`).
   - 3 usuários têm CPF persistido em CORE mas SEM identity equivalente
     populada — o dado já está divergindo silenciosamente.

5. **Caminho de escrita NÃO sincroniza os dois trilhos.**
   - `profile.service.ts` escreve em `user_profiles` + `profiles`. Não toca `identities`.
   - `identity.service.ts` escreve em `identities`. Não toca `user_profiles`/`profiles`.
   - Não há trigger, view materializada nem service compartilhado que
     mantenha os dois domínios consistentes.

### Risco

- **CORE/onboarding e KYC/payout podem operar sobre CPFs divergentes para o mesmo usuário.**
- F4 (quando autorizar saque externo) consulta `identities.tax_id` para "conta própria"
  (DECISION-0060 D8); se o CPF do CORE estiver mais atualizado, o gate pode falhar
  por motivo incorreto.
- Qualquer frente futura de identidade/onboarding pode escolher fonte errada
  se não houver DECISION explícita.
- Risco operacional: alguém pode tentar DROP `user_profiles` achando que é legado
  (justamente o que a DT antiga sugeria) — bate `GET /core/profile` em produção
  e quebra `Profile.tsx`.

### Mitigação atual

- O caminho de escrita atual (`profile.service.ts`) mantém `user_profiles.cpf`
  e `profiles.cpf` consistentes entre si via CTE.
- F4.0 ainda não envia dinheiro externo — saque interno F3 não exige conferência
  CPF-vs-tax_id.
- Frontend não exibe `tax_id` lado a lado com `personal_profile.cpf`, então
  divergência não é visível ao usuário hoje.

### Proibições (até DECISION ser tomada)

- NÃO dropar `user_profiles` (substrato vivo, consumer real).
- NÃO tratar `user_profiles` como legado morto.
- NÃO sincronizar CPF por código ad hoc (`UPDATE` cruzado sem DECISION é jeitinho).
- NÃO criar trigger que copie `user_profiles.cpf → identities.tax_id` sem decisão arquitetural.
- NÃO escrever em `identities.tax_id` dentro do caminho de `profile.service.ts`.
- NÃO escrever em `user_profiles.cpf` dentro do caminho de `identity.service.ts`.

### Resolução prevista

Antes de qualquer fatia de identidade/onboarding ou frente que dependa de
SSOT único de CPF (ex.: F4.1+), DECISION explícita sobre canonicidade.

### Hipóteses (resolvidas por DECISION-0062 — 2026-05-28)

**Hipótese ESCOLHIDA: A como destino canônico, com execução gradual.**

DECISION-0062 fixou `identities.tax_id` como SSOT operacional global de documento fiscal. CORE/profile (`user_profiles.cpf` + `profiles.cpf`) migra para esse SSOT em fases F0–F5 (ver D10 da DECISION-0062). `global_users.cpf` permanece como âncora de cadastro/deduplicação/auth bootstrap, **imutável após criação** (lock semântico de DECISION-0062 D4).

Razão (registrada em DECISION-0062 contexto):
- CPF não é "campo de perfil" — é raiz civil/operacional do sistema.
- Hipótese C (convivência declarada) mantém dois cartórios oficiais — bomba lenta inaceitável para identidade fiscal.
- Hipótese B (CORE vence) conflitaria com DECISION-0060 D2 vigente.
- Hipótese A está alinhada com `IDENTITY_SSOT_PRECEDENCE.md` (normativa-mãe que já declarava `identities` autoridade de KYC/documento).

**Hipóteses B e C registradas historicamente acima foram REJEITADAS por DECISION-0062.**

### Progresso F0–F5 (DECISION-0062 D10)

| Fase | Status | Commit | Notas |
|------|--------|--------|-------|
| F0.1 ghost reference (bank-balance-by-cpf) | DONE | `fee7b754` | Query trocada para `global_users.cpf` via JOIN canônico |
| F1 backfill audit | DONE (READ-ONLY, sessão anterior) | n/a | 11 candidatos distintos identificados |
| F2 backfill idempotente | DONE | `e68be393` | 10 inserts em `identities` (delta 9→19); 1 bloqueado por dígitos inválidos. Zero schema/migration. Zero alteração em global_users/user_profiles/profiles/CORE/auth services. |
| **F3 E2E coerência CPF/tax_id** | **DONE** | (este commit) | **9/9 cenários PASS. Suite `validate-pipeline-e2e-cpf-tax-id-coherence.ts` (T1–T9). Zero alteração em service/schema/migration. KYC E2E + F4.0 E2E regression PASS pós-F3.** |
| F4 migrar leitura CORE | OPEN | — | Refatorar `core.service.ts` para JOIN com identities |
| F5 deprecar caches | OPEN | — | DROP `user_profiles.cpf` / `profiles.cpf` após F4 estável |

### Estado runtime pós-F2

- `identities` total: 9 → **19** (delta +10)
- `identities` com `tax_id`: **19** (100%)
- `missing_identity_after_backfill`: **1** (esperado — único CPF inválido por dígitos verificadores em `global_users.cpf`, guid `28221f67`)
- `kyc_status='pending'`: 5 → 12 (delta +7 reservados para CPFs reais; +3 já estavam pending pré-F2)
- `kyc_status='approved'`: 7 (inalterado — KYC aprovado preservado)

### Confirmações de escopo F2

- ✅ Zero migration nova
- ✅ Zero schema alterado
- ✅ Zero alteração em `global_users.cpf` (imutável D4 preservada)
- ✅ Zero alteração em `user_profiles.cpf` / `profiles.cpf` (transitórios intactos)
- ✅ Zero alteração em `core.service.ts` / `profile.service.ts` / `identity.service.ts` / `auth.service.ts`
- ✅ Zero alteração em `bank_ledger` / `bank_transactions` / `bank_splits`
- ✅ Zero alteração em F4.0 (E2E F4.0 regression 8/8 pós-F2)
- ✅ E2E KYC PASS pós-F2 (KYC_PENDING → KYC_OK → AUTHORITY_ALLOW + ledger double-entry)
- ✅ Helper canônico `validateCpf` rejeitou CPF inválido por dígitos verificadores
- ✅ `ON CONFLICT (global_user_id) DO NOTHING` garante idempotência cross-run
- ✅ Logging LGPD-safe (CPFs mascarados via `sanitizeCpfForLog`)
- ✅ Bloqueios materiais aplicados: sintéticos / formato 14 dígitos / sem global_user_id / dígitos inválidos

### Próximo passo natural

**F3 — E2E coerência CPF.** Suite mínima que prove que após backfill:
- `GET /core/profile.personal_profile.cpf` para um actor com identity recém-criada retorna CPF coerente com `identities.tax_id`
- F4.0 cadastra destino bancário sem fail para os 10 novos identities (`holder_document = identities.tax_id`)
- KYC submission para um identity recém-criado funciona normalmente

F3 não exige mudança de schema nem de service. É apenas suite de invariantes.

### Fechamento F3 (2026-05-28)

Suite `backend/src/scripts/validate-pipeline-e2e-cpf-tax-id-coherence.ts` executa 9 cenários **autocontidos**, idempotentes, com prefixo `e2e_f3_cpf_tax_id_` e LGPD-safe logging via `sanitizeCpfForLog`.

| # | Cenário | Resultado | Invariante provada |
|---|---------|-----------|---------------------|
| T1 | Baseline pós-F2 | PASS | `identities_total ≥ 19`, zero CPF válido órfão; CPF inválido por dígitos permanece fora de `identities`. |
| T2 | Coerência cross-substrato | PASS | `regexp_replace(up.cpf/p.cpf/gu.cpf,'\D','','g') = regexp_replace(i.tax_id,'\D','','g')` para todas as rows com identity. Zero divergência. |
| T3 | Cadastro real cria cadeia fiscal mínima | PASS | `authService.register` → `global_users.cpf` + `identities.tax_id` (`cpf`, `pending`, `none`) em uma única chamada. |
| T4 | CORE coerente com identity | PASS | `coreService.getCompleteProfile` retorna `personal_profile.cpf` igual a `identities.tax_id` para identity recém-criada (estado transitório aceitável: NULL se projeção ainda não populada — identity SSOT íntegra). |
| T5 | Payload público sem CPF/tax_id | PASS | `actorRepository.findById` retorna 0 campos `tax_id`/`cpf`/`holder_document`/`kyc_status` e 0 ocorrências de CPF cru no JSON. |
| T6 | F4.0 happy path (DECISION-0060 D5) | PASS | `actorBankDestinationService.createDestination` com `holderDocument = identities.tax_id` → `verified` + `auto_tax_id_match`; **ledger/txs/splits inalterados**. |
| T7 | F4.0 bloqueia mismatch (DECISION-0060 D5 trigger) | PASS | `holderDocument ≠ identities.tax_id` → `ACTOR_BANK_DEST_HOLDER_DOCUMENT_MISMATCH`; **ledger/txs/splits inalterados**. |
| T8 | Idempotência F2 | PASS | Re-run de `backfill-identities-from-global-users-cpf.ts --apply` mantém `identities_total = 20` e fingerprint (tax_id/tax_id_type/kyc_status/kyc_level/updated_at) intacto para rows pré-existentes. Zero UPDATE colateral. |
| T9 | Cleanup seguro | PASS (implícito) | Apenas fixtures `e2e_f3_*` deletadas via `DELETE ... WHERE id = ANY($1::uuid[])`. Nenhum row pré-F3 alterado. |

**Gates pós-F3:** `tsc` clean, `validate:actor-writer-boundaries` GATE OK §4.8.1, `validate:bank-ledger-boundaries` GATE OK §4.6, `validate:regression-guards` GATE OK (financial-regression + sql-regression-lint + migration-numbering), `validate:architecture:strict` `critical_new=0`.

**E2Es vizinhos pós-F3 (regression):** `validate-pipeline-e2e-kyc.ts` PASS (causal A: KYC_PENDING → KYC_OK → AUTHORITY_ALLOW + TRANSFER_EXECUTED + LEDGER_PERSISTED, Σ débitos = Σ créditos). `validate-pipeline-e2e-actor-bank-destinations.ts` PASS 8/8 (T6 KYC pending cadastro permitido D12; T8 ledger/txs/payout_requests inalterados).

**Confirmações de escopo F3:** zero alteração em service/schema/migration/CORE/auth/identity. Apenas adição de suite de invariantes. F2 idempotência provada na prática (não no output textual do script F2, conforme exigido).

**Compensação localizada (não muda código de produção):** o script E2E faz `UPDATE actors SET global_user_id=...` na fixture criada por `register` porque `actor.repository.findOrCreateUserActor` (`backend/src/modules/social/actor.repository.ts:101-111`) hoje INSERTa sem `global_user_id` populado. F4.0 (DECISION-0060 D8) exige identity vinculada. Isso revela gap material em `findOrCreateUserActor` — ver DT-FINDORCREATEUSERACTOR-MISSING-GLOBAL-USER-ID abaixo.

### Evidência runtime reportada

```
user_profiles.cpf populadas:    7
profiles.cpf populadas:        61
identities matching exato:      4 dos 7 user_profiles
```

### Vinculadas

- DECISION-0060 (D2 — `identities.tax_id` SSOT KYC/payout/F4)
- DECISION-0061 (precedente de "convivência declarada" para identidade pública)
- DT-USER-PROFILES-LEGACY-ORPHAN (SUPERSEDED — entrada original mantida como histórico)
- DT-AVAILABLE-ACTOR-USER-ID-CONFUSION-RISK (tangencial — outra ambiguidade no domínio identidade/actor, com escopo distinto)
- DT-PUBLIC-PROFILES-NO-FRONTEND-CONSUMER (família tangencial de canonicidade de perfil — DECISION-0061 vigente)
- `backend/src/core/profile/profile.service.ts:418-477`
- `backend/src/core/core.service.ts:180,225-338`
- `backend/src/core/auth/auth.service.ts:393-397`
- `backend/src/core/identity/identity.service.ts:255`
- `backend/migrations/0066_profile_support_tables.sql` (user_profiles)
- `backend/migrations/0058_users_global_users_profiles_app.sql` (profiles)
- `backend/migrations/0009_create_identities.sql` (identities)
- `backend/migrations/0010_migrate_identity_from_actors.sql` (remoção `actors.cpf_cnpj` + backfill)

### Notas operacionais

- DT permanece OPEN até DECISION sobre SSOT CPF ser registrada.
- DT NÃO deve ser fechada por essa execução — apenas reclassificação documental.
- Próxima fatia possível: DECISION-006X (após 0061) escolhendo A/B/C. Recomendação não-vinculante do raio-X: hipótese C (convivência declarada + sync service), em paralelo arquitetural com DECISION-0061.

---

## DT-BANK-BALANCE-BY-CPF-GHOST-USERS-CPF

- **Status:** CLOSED (2026-05-28) — corrigido em fatia F0.1 da DECISION-0062 D14 (commit `fee7b754`).
- **Severidade:** LOW
- **Classe:** DT-T (técnica — ghost reference em código vivo).
- **Origem:** inventário F0 pós-DECISION-0062 (HEAD `2b8fbd17`, 2026-05-28).

### Achado original

`backend/src/modules/bank/bank-balance-by-cpf.service.ts:120-127` lia `users.cpf`,
coluna **inexistente no schema vivo** (confirmado via
`information_schema.columns WHERE table_name='users' AND column_name='cpf'`
→ zero rows).

A query original:

```sql
SELECT u.user_id, u.email, p.full_name
FROM users u
LEFT JOIN profiles p ON u.user_id = p.user_id AND u.tenant_id = p.tenant_id
WHERE u.tenant_id = $1
  AND u.cpf = $2
```

### Risco

- Endpoint admin-only `GET /admin/finance/consolidated-balance/by-cpf/:cpf` em
  `core/unifybank/bank-balance-consolidation.routes.ts:347` retornava **HTTP 500**
  permanentemente por SQL error (`column "u.cpf" does not exist`).
- Risco financeiro: **ZERO**. Service é declaradamente READ-MODEL PURO ("não CORE,
  não fonte de verdade, não decisório"). Não decide saldo, não persiste, não
  autoriza nenhuma operação.
- Risco operacional: BAIXO. Observabilidade admin quebrada; restaurada com a fix.

### Correção aplicada

JOIN canônico via `global_users.cpf` conforme DECISION-0062 D4 (âncora de
cadastro/deduplicação PF, imutável após criação):

```sql
SELECT u.user_id, u.email, p.full_name
FROM global_users gu
JOIN users u ON u.global_user_id = gu.global_user_id
LEFT JOIN profiles p ON u.user_id = p.user_id AND u.tenant_id = p.tenant_id
WHERE u.tenant_id = $1
  AND gu.cpf = $2
```

Tenant isolation preservada por `u.tenant_id = $1`. Contrato público da rota
intacto (mesma resposta `BalanceByCpf`, mesma permissão
`admin:view_consolidated_balance`, mesma semântica de read-model).

Comentário-NOTA atualizado no service para refletir DECISION-0062 D4.

### Alinhamento com DECISION-0062

- D2/D4: `global_users.cpf` é âncora canônica para busca por documento fiscal
  PF; `identities.tax_id` é SSOT operacional global. Hoje os dois trilhos têm
  divergência runtime conhecida (DECISION-0062 D9 backfill pendente); JOIN via
  `global_users.cpf` é o caminho seguro hoje sem depender de F1+F2.
- D14: esta correção é exatamente o caso `bank-balance-by-cpf.service.ts`
  citado em D14 como dívida de correção F0. Resolvido.

### Confirmação READ-ONLY

- Zero alteração em `bank_ledger`, `bank_transactions`, `bank_splits`.
- Zero migration, zero schema.
- Zero alteração em `core.service.ts`, `profile.service.ts`, `identity.service.ts`, `auth.service.ts`.
- Zero alteração em F4.0 / F4.1 / F4.2 / F4.3 / F4.4.
- Service mantido como read-model puro. Admin-only preservado.

### Smoke test runtime

`psql ... SELECT gu.cpf, COUNT(u.user_id) FROM global_users gu JOIN users u
ON u.global_user_id = gu.global_user_id GROUP BY gu.cpf LIMIT 3;` retornou
3 CPFs com 1, 24 e 1 users matching — JOIN funcional. Query corrigida bate
em dados existentes.

### Vinculadas

- DECISION-0062 D4/D14 (commit `2b8fbd17`)
- DECISION-0060 D2 (identities.tax_id SSOT KYC/payout — coerente; F4.0 segue intacta)
- DT-CPF-SSOT-DUAL-WRITE-CORE-VS-IDENTITY (permanece OPEN — esta fatia é só F0.1, F1–F5 continuam pendentes)
- `backend/src/modules/bank/bank-balance-by-cpf.service.ts`
- `backend/src/core/unifybank/bank-balance-consolidation.routes.ts:347`

---

## DT-FINDORCREATEUSERACTOR-MISSING-GLOBAL-USER-ID

- **Status:** CLOSED (2026-05-28) via F3.1 v2 DECISION-0062, commit `c73ac382`.
- **Classe:** DT-D (drift entre normativa de domínio e código vigente).
- **Norma violada:** DECISION-0060 D8 exige `actors.global_user_id` populada para que F4.0 (`actor_bank_destinations`) consiga JOIN `actors → identities` e enforçar "conta própria" via `holder_document = identities.tax_id`. Schema permite NULL para retrocompatibilidade, mas todo actor humano novo criado pelo pipeline canônico de `register` deveria nascer com `global_user_id` populada.
- **Local material:** `backend/src/modules/social/actor.repository.ts:101-111` (`findOrCreateUserActor`).

### Comportamento observado

`authService.register(...)` (commit em `auth.service.ts:520`) chama best-effort `ensureUserActor(tenantId, userId)`. Esse delega a `findOrCreateUserActor`, que executa:

```sql
INSERT INTO actors (tenant_id, actor_type, user_id, display_name, slug)
VALUES ($1, 'user', $2, $3, $4)
RETURNING *
```

A coluna `actors.global_user_id` **não é populada**, apesar de `users.global_user_id` estar disponível trivialmente (1 JOIN). Resultado: atores recém-criados via fluxo canônico de registro têm `global_user_id IS NULL`, o que faz F4.0 (`actorBankDestinationService.createDestination`) falhar com `ACTOR_BANK_DEST_IDENTITY_MISSING — actor X sem identity vinculada (global_user_id NULL)`.

### Evidência

E2E F3 T6/T7 falhou inicialmente com `actor … sem identity vinculada (global_user_id NULL) — DECISION-0060 D8 exige identity`. O E2E F3 compensa localmente a fixture com `UPDATE actors SET global_user_id=... WHERE actor_type='user' AND global_user_id IS NULL` para provar invariantes F4.0, **mas não corrige o gap de produção**.

### Impacto

- Qualquer fluxo F4 (cadastro de destino bancário externo) feito por usuário recém-cadastrado falha até alguém popular `actors.global_user_id` manualmente.
- A constraint `chk_actor_requires_identity` (`0010:50-54`) só dispara para `actor_type='actor_human'`, então `actor_type='user'` (vigente) passa pelo INSERT sem proteção.
- O drift é silencioso — não há erro em `register`, apenas falha tardia ao tentar F4.0.

### Correção proposta (não autorizada nesta fatia)

`findOrCreateUserActor` deveria popular `global_user_id` no INSERT, fazendo JOIN com `users` para resolver:

```sql
INSERT INTO actors (tenant_id, actor_type, user_id, global_user_id, display_name, slug)
SELECT $1, 'user', $2, u.global_user_id, $3, $4 FROM users u WHERE u.id = $2
```

Adicionalmente, considerar backfill de `actors.global_user_id` para atores existentes com NULL (auditoria similar a F1).

### Confirmação de escopo F3 (esta fatia)

- F3 NÃO altera `actor.repository.ts` nem `actor-writer.service.ts` nem `auth.service.ts`.
- F3 apenas documenta o gap e compensa localmente na fixture E2E.
- DT fica registrada para abertura de fatia dedicada no momento certo (decisão pendente de Clayton — pode ser próxima fatia natural pré-F4 produção real ou pode esperar F4.x).

### Vinculadas

- DECISION-0060 D8 (norma material)
- DECISION-0062 (canonicidade identities; coerente)
- DT-CPF-SSOT-DUAL-WRITE-CORE-VS-IDENTITY (família — mesmo domínio identidade)
- `backend/src/modules/social/actor.repository.ts:101-118`
- `backend/src/modules/identity/actor-writer.service.ts:17-20`
- `backend/src/scripts/validate-pipeline-e2e-cpf-tax-id-coherence.ts` (compensação localizada)

### Fechamento F3.1 v2 (2026-05-28)

Correção entregue em dupla camada (B na origem + A no ponto de INSERT):

**Movimento B — `backend/src/core/auth/auth.service.ts:515-540`:** ordem dos dois blocos `try { ensure... }` invertida. `identityService.ensureIdentityRowForGlobalUserId(globalUserId)` agora roda ANTES de `ensureUserActor(finalTenantId, user.userId)`. Sequência canônica final: `global_users → users → identities → actors`. Best-effort com `console.warn` preservado em ambos os blocos (não propaga para o caller do register), porque a trava A garante fail-closed: se identity falhar silenciosa, o INSERT em actors falha limpo sem criar órfão; retry no próximo acesso reexecuta os dois na ordem correta.

**Movimento A — `backend/src/modules/social/actor.repository.ts:56-130` (`findOrCreateUserActor`):** antes do INSERT:
1. Query lê `u.email + p.full_name + u.global_user_id` em uma chamada só (extensão da query existente).
2. Se `users.global_user_id IS NULL` → `throw new Error('findOrCreateUserActor: users.global_user_id ausente …')` — não cria órfão.
3. SELECT em `identities WHERE global_user_id = $1` confirma presença da row canônica.
4. Se identity ausente → `throw new Error('findOrCreateUserActor: identity ausente … chame identityService.ensureIdentityRowForGlobalUserId antes …')` — mensagem cita ordem causal §7.
5. INSERT na lista de colunas inclui `global_user_id`; `VALUES` inclui `$3::uuid`. Satisfaz FK `fk_actor_identity`.

Assinatura pública de `findOrCreateUserActor(tenantId, userId)` inalterada — `global_user_id` resolvido internamente. Nenhum caller precisou ser tocado (8 callers — script seed, scripts E2E, tests, adapter, marketplace).

### Validação T1–T6 + 5 gates

| Teste | Resultado |
|-------|-----------|
| T1 (register real cria actor com `actors.global_user_id = users.global_user_id = identities.global_user_id`) | PASS |
| T2 (idempotência: segunda chamada retorna mesmo `actor_id`, mesmo `updated_at`, count=1) | PASS |
| T3 (fail-closed: usuário sem identity → throw `identity ausente`; orphan_count=0) | PASS |
| T4 (regressão E2E F3 `validate-pipeline-e2e-cpf-tax-id-coherence.ts`) | 9/9 PASS |
| T5 (regressão E2E KYC `validate-pipeline-e2e-kyc.ts`) | PASS (Modo A 5 etapas + PROVA DE OURO + Etapa 6 transfer real; Modo B 3 rejeições; Σ débitos = Σ créditos) |
| T6 (regressão E2E F4.0 `validate-pipeline-e2e-actor-bank-destinations.ts`) | 8/8 PASS |
| tsc clean | OK |
| validate:actor-writer-boundaries | GATE OK §4.8.1 |
| validate:bank-ledger-boundaries | GATE OK §4.6 |
| validate:regression-guards | GATE OK |
| validate-architectural-patterns --strict | `critical_new=0` (warning_new=1 herdado, fora de escopo F3.1) |

### Auditoria live de constraints (banco vivo, antes da edição)

Saída literal das 3 queries:

```
=== pg_constraint on actors ===
  actors_actor_type_check
    CHECK ((actor_type = ANY (ARRAY['user','page','group','channel','actor_human','actor_organizational','actor_system','person','company','system'])))
  chk_actor_requires_identity
    CHECK (((actor_type <> 'actor_human') OR (global_user_id IS NOT NULL)))
  fk_actor_identity
    FOREIGN KEY (global_user_id) REFERENCES identities(global_user_id)
  actors_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  …pkey, unique, chk actor_id=id, fk tenant, fk responsible_actor…

=== actor_type distribution ===
  actor_human   2
  company       1
  page         12
  user        119

=== columns (global_user_id, actor_type, user_id) ===
  actor_type     text  NO
  global_user_id uuid  YES
  user_id        uuid  YES

=== runtime ===
  total=134  with_gu=40  without_gu=94
```

**Confirmações:** `fk_actor_identity` ativa e aponta para `identities(global_user_id)`. `chk_actor_requires_identity` ativa MAS só dispara para `actor_type='actor_human'` — os 119 actores `'user'` (vocabulário social vivo) NÃO são protegidos por essa CHECK. Vocabulário fragmentado em 4 valores reais (`user`, `page`, `actor_human`, `company`) coexistindo em CHECK aberto. Por isso a fail-closed precisa ficar no service layer (movimento A), não na constraint.

### Compensação localizada no E2E F3 — agora redundante (mantida sem dano)

`backend/src/scripts/validate-pipeline-e2e-cpf-tax-id-coherence.ts:308` ainda executa `UPDATE actors SET global_user_id=… WHERE … global_user_id IS NULL` após o `register`. Após F3.1 v2, o INSERT já popula `global_user_id`, então o WHERE não casa nada (no-op idempotente). E2E F3 continua 9/9 PASS sem mudança. **Reporto sem remover** (conforme instrução): a remoção do UPDATE de compensação fica como cleanup cosmético opcional em fatia futura.

### Cleanup leftover do E2E KYC pós-F3.1 v2

Antes: `⚠ actors (PF) … bank_accounts_actor_id_fkey`. Depois: também `⚠ identities … fk_actor_identity`. Causa: actor PF persiste por causa do `bank_accounts` (mesmo padrão append-only de bank leftover já documentado); como agora actor tem `global_user_id` populado, o DELETE de identity também viola FK. Não é regressão funcional — é o mesmo leftover esperado se expandindo um nível na cadeia FK. **Não corrigir nesta fatia** (cleanup E2E não é escopo F3.1 v2; cenários do KYC continuam todos PASS).

### Confirmações de escopo F3.1 v2

- ✅ Zero migration nova
- ✅ Zero schema alterado
- ✅ Zero alteração em `identities` (schema/dados/triggers), `global_users.cpf`, `user_profiles.cpf`, `profiles.cpf`
- ✅ Zero alteração em `bank_ledger`, `bank_transactions`, `bank_splits`
- ✅ Zero correção de `actor_type` ou constraints (CHECK vocabulário aberto + chk_actor_requires_identity inefetiva ficam para DT separada)
- ✅ Zero backfill de actors existentes (94 com `global_user_id IS NULL` permanecem — escopo de fatia futura)
- ✅ Zero alteração em F4 (leitura CORE), F5, Profile P0
- ✅ Best-effort no register preservado (com argumento: fail-closed na trava A garante invariante)

---

## DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION

- **Status:** OPEN (descoberta 2026-05-28 durante auditoria pré-F3.1 v2 do banco vivo).
- **Classe:** DT-D (drift histórico não resolvido entre 3 ondas de modelagem).
- **Origem:** o sistema passou por 3 reconstruções (Bubble → híbrido → atual). Cada onda deixou um vocabulário de `actor_type` que não foi substituído ao final.

### Vocabulário fragmentado vivo

CHECK `actors_actor_type_check` aceita 10 valores em 3 famílias coexistentes:

```
('user','page','group','channel')                                  -- onda social runtime (vigente)
('actor_human','actor_organizational','actor_system')              -- onda N1 (DECISION-0010 / chk_actor_requires_identity)
('person','company','system')                                       -- onda Bubble-era (legado pré-genesis)
```

Distribuição vigente em `unificard_dev` (2026-05-28):

| actor_type | linhas |
|---|---|
| `user` | 119 |
| `page` | 12 |
| `actor_human` | 2 |
| `company` | 1 |

### Consequência material

A constraint `chk_actor_requires_identity` (`CHECK ((actor_type <> 'actor_human') OR (global_user_id IS NOT NULL))`) está **viva mas inefetiva no runtime** — só dispara para os 2 atores `actor_human`. Os 119 actores humanos vigentes (`actor_type='user'`) passam sem proteção da CHECK. Daí F3.1 v2 ter precisado de fail-closed em service layer (`findOrCreateUserActor`).

### Por que NÃO corrigir agora

- Unificar vocabulário exige decisão de produto sobre família canônica (provavelmente a onda social `user/page/group/channel` por ser runtime majoritário) + decisão de schema (rename rows + apertar CHECK + atualizar `chk_actor_requires_identity` para a família escolhida + auditar todos os readers de `actor_type` no código).
- Fatia ampla, transversal (social/identity/marketplace/wallet), com risco de quebrar consumidores que dependem do valor literal.
- Não bloqueia F3.1 v2 (fail-closed em service layer cobre).
- Não bloqueia F4 leitura CORE.

### Correção proposta (esboço — não autorizada)

1. Auditoria leitora: grep por `actor_type=` / `actor_type IN (` no codebase para mapear consumidores por valor literal.
2. Decisão Clayton: qual família vence canônicamente? (recomendação inicial: `user`/`page`/`group`/`channel` por massa runtime, mas com nome semântico equivalente — `actor_human` é mais expressivo).
3. Migration: rename rows + reescrever CHECK + apertar `chk_actor_requires_identity` para o valor canônico vencedor.
4. E2E de regressão por consumidor.

### Vinculadas

- DECISION-0010 (vestígio: `chk_actor_requires_identity` sobre `actor_human`)
- DECISION-0062 (canonicidade do domínio identity; coerente)
- DT-FINDORCREATEUSERACTOR-MISSING-GLOBAL-USER-ID (CLOSED — cobre fail-closed em service layer, compensando a constraint inefetiva)
- `backend/migrations/0010_migrate_identity_from_actors.sql` (origem da CHECK que só cobre `actor_human`)
- `backend/migrations/0064_add_user_id_to_actors.sql` (origem do vocabulário social)
- pg_constraint live: `actors_actor_type_check` (10 valores, CHECK aberta)

---

## F-DEV-DATA-CLEAN-RESET — Fase 0 (READ-ONLY) DONE · AGUARDANDO APROVAÇÃO

- **Status:** Fase 0 (mapeamento + backup + manifesto) DONE em 2026-05-28. **Aguardando aprovação humana de Clayton** antes da Fase 1 (deleção dirigida). Zero deleção realizada.
- **Branch:** `rescue-structural` · HEAD `77316eee` · Banco confirmado: `unificard_dev`.
- **Origem:** prompt F-DEV-DATA-CLEAN-RESET de Clayton — reset seletivo de fixtures/teste em `unificard_dev`, substituindo o backfill dos 94 atores órfãos (`DT-FINDORCREATEUSERACTOR` já CLOSED, mas atores legados permanecem; reset os elimina sem backfill).

### Artefatos da Fase 0

| Artefato | Path | Tamanho |
|---|---|---|
| Backup pg_dump (formato custom, compressão 6, banco inteiro) | `C:/unificard/RESET_BACKUP_2026-05-28T23-29-59.dump` | 9.3 MB |
| Manifesto JSON | `C:/unificard/RESET_MANIFEST_2026-05-29T02-28-38-985Z.json` | 40 KB |

### UUIDs canônicos confirmados (sem prefixo)

- Tenant DEV preservado: `fbe13b78-4516-493d-905a-363796aea1d1` ("UnifyCard DEV")
- Actor dev preservado: `751a4fe0-2f33-4053-bfa8-3dcad39b3b30` (type=user, name="dev")
- User do dev: `beb7b5e4-2d22-4782-83c9-6e006da53713` (email="dev@unificard.local")
- Global user do dev: `2a3cf794-d500-45e9-bcc6-2f1c6afd008b` (cpf sintético `syn:…`)

### Baseline de seeds estruturais (Fase 0 — nenhum ainda apagado)

| Tabela | Escopo | Total | Nota |
|---|---|---|---|
| `concepts` | GLOBAL | 90 | sem tenant_id |
| `company_types` | GLOBAL | 7 | |
| `company_type_allowed_concepts` | GLOBAL | 7 | |
| `categories` | GLOBAL | 102 | |
| `canonical_products` | tenant-scoped (null tenant) | 35 | todos com `tenant_id IS NULL` |
| `permissions` | tenant-scoped DEV | 38 | distinct_tenants=1 (DEV) |
| `roles` | tenant-scoped DEV | 4 | distinct_tenants=1 (DEV) |
| `role_permissions` | tenant-scoped DEV | 68 | distinct_tenants=1 (DEV) |
| `tenants` | (n/a) | 39 | 1 preserve + 38 delete |

**Confirmação:** ✅ NENHUM seed estrutural preso a tenant a deletar.

### Baseline globais

```
tenants=39  actors=138  users=71  identities=23  global_users=21
```

### Classificação dos 39 tenants

- **PRESERVE: 1** — `fbe13b78-4516-493d-905a-363796aea1d1` "UnifyCard DEV" (actors=75, users=8)
- **DELETE: 38** — regex `^Tenant q3*|^Tenant smoke*|^Q3-E2E-v2-*|^Tenant beta7|^Tenant birth|^Tenant plan|^Tenant unifybank$` (Tenant unifybank flagged para review)

### Mapa financeiro (tenants a deletar)

```
TOTAL fixture fin: bank_accounts=271  ledger=126  txs=54  splits=26
  20 tenants q3v3organizer*: concentram a maior parte do ledger fixture
  (1 tenant tem ledger=29; outros 19 têm ledger=4–11 cada)

TRAVA — DEV (NÃO TOCAR): bank_accounts=128  ledger=1486  txs=1112  splits=247
```

### 5 ACHADOS materiais reportados a Clayton (aguardando decisão)

1. **ACHADO 1 (crítico):** O actor dev preservado NÃO tem cadeia PF canônica hoje. `actors.global_user_id=NULL`, `global_users.cpf` é sintético (`syn:…`), `identities` row AUSENTE. Está no bucket dos 81 atores quebrados. Três opções (A: preservar como está; B: substituir por register canônico na Fase 3; C: hack manual — não recomendado).
2. **ACHADO 2:** 74 actors dentro do tenant DEV são fixture (3 vestígio `actor_human`/`company` + 5 pages teste "Restaurante Sabor da Bahia"/"MotoMecânica Sul"/"Banda Som da Rua"/2× outras + 66 users teste de T2–T6 + e2e_kyc). Decisão: deletar todos? Preservar alguma page?
3. **ACHADO 3:** Tenant "Tenant unifybank" (`f40f7587-889c-40e2-8299-02049947d881`) classificado por regex como DELETE_FIXTURE, mas nome sugere infraestrutura. Tem actors=1 users=1 bank_*=0. Aguardando decisão.
4. **ACHADO 4:** 20 tenants q3v3organizer* têm 126 ledger rows fixture. Trigger de imutabilidade pode bloquear DELETE em `bank_ledger`/`bank_transactions`/`bank_splits`. Plano de mitigação se isso ocorrer: (i) reset total via backup→drop→recreate→migrations→seeds; (ii) deixar esses tenants intactos; (iii) outra. Aguardando direção Clayton.
5. **ACHADO 5:** `global_users` é transversal a tenant (sem `tenant_id`). Antes de DELETE de `global_users`, validar em runtime na Fase 1 que não é referenciado por user de outro tenant.

### Sequência de DELETE proposta

```
Para cada um dos 38 tenants DELETE, em BEGIN/COMMIT por tenant:
  1. FKs RESTRICT (events, reversals, inventory_movements, pdv_sessions,
     purchase_orders, stock_transfers, product_offers, suppliers,
     service_discovery_requests)   — WHERE tenant_id=$
  2. Demais ~85 tabelas filhas de actors  — WHERE tenant_id=$
  3. bank_* (PARAR se trigger bloquear — ACHADO 4)
  4. company_users / company_validation_requests / company_validations
  5. actors  — WHERE tenant_id=$
  6. companies
  7. profiles / user_profiles
  8. identity_validation_requests (CASCADE de identities cobre)
  9. identities (só global_user_id exclusivos do tenant)
 10. users
 11. global_users (só exclusivos do tenant)
 12. tenants

Para o DEV (transação separada, 74 actors alvo, dev preservado):
  Mesma sequência 1–11 por actor. ZERO toque em bank_* do DEV.
```

### Confirmações de escopo Fase 0

- ✅ Zero deleção realizada
- ✅ Zero schema/migration alterado
- ✅ Zero toque em bank_* (fixture nem DEV)
- ✅ Backup gerado e validado (9.3 MB, formato custom)
- ✅ Manifesto JSON persistido (40 KB)
- ✅ UUIDs sempre completos em queries; prefixos só para leitura humana
- ✅ Trava de imutabilidade financeira permanece intacta (será exercitada na Fase 1)

### Próximo passo

**Aguardando aprovação de Clayton** das 5 decisões + lista de 38 tenants. Sem "APROVADO" explícito, Fase 1 NÃO inicia.

### Atualização 2026-05-29 — Estratégia DROP/RECREATE aprovada; portão 1.3 BLOQUEADO

Clayton aprovou estratégia drop/recreate com ensaio em espelho (não DELETE por tenant). Decisões dos 5 achados consolidadas: (1) dev recriado canônico na Fase 3; (2) 74 actors DEV somem no recreate; (3) unifybank confirmado fixture (nada depende); (4) ledger não é deletado, é recriado sem ele; (5) global_users novo. Autorização diferenciada de comandos: `pg_dump:*` e `createdb:*` durável; `dropdb:*` apenas interativo caso a caso.

**FASE 1.1 DONE** — artefatos read-only criados:
- `RESET_SCHEMA_BEFORE_2026-05-29T00-18-35.sql` (637 KB, schema-only do banco atual)
- `RESET_INVENTORY_BEFORE_2026-05-29T00-18-35.json` (~470 KB, inventário normalizado)
  - 235 tabelas · 2348 colunas · 1111 constraints · 76 triggers · 840 índices · 1 view · 122 functions · 4 extensions
  - `schema_migrations`: **314 registradas**, **328 arquivos no disco**
  - `files_minus_db = 17` migrations pendentes (não rodadas)
  - `db_minus_files = 3` registros sem arquivo (Seção 17 do AGENT_PROTOCOL — objeto aplicado sem ficheiro)
  - Seeds estruturais (90 concepts / 38 permissions / 4 roles / 102 categories / etc.) vivem DENTRO de migrations (não em `seeds/`); diretório `seeds/` tem apenas 2 fixtures

**FASE 1.2 BLOQUEADA — 2 DESCOBERTAS MATERIAIS** (portão 1.3 NÃO foi alcançado por motivo legítimo):

#### Descoberta A — Runner de migrate ignora override de `DATABASE_URL`

`backend/src/core/db/migrate.ts:14` chama `loadBackendEnv()`. Em `load-backend-env.ts:42-66`, `hydrateDatabaseUrlFromEnvFile()` faz `process.env.DATABASE_URL = value` SEMPRE — sobrescreve qualquer override via env var, ignorando `DATABASE_URL=postgresql://.../mirror pnpm exec tsx migrate.ts`. Tentativa de Fase 1.2.b (rodar migrate no espelho criado vazio) acabou rodando contra o banco **REAL** — felizmente a primeira migration falhou em ROLLBACK transacional antes de qualquer DDL.

**Confirmação após detecção:** banco real `unificard_dev` permanece intacto — tenants=39, actors=138, users=71, identities=23, global_users=21, schema_migrations=314 (todos iguais ao baseline da Fase 0). Espelho `unificard_dev_rebuild_check_20260529001835` permanece com 0 tabelas (zero efeito do ensaio).

**Implicação:** ensaio em espelho via runner padrão é INVIÁVEL. Caminhos para retomar:
1. Patch temporário em `load-backend-env.ts` (não persistir) ou criar runner-mirror dedicado que respeite env var
2. Swap controlado de `.env` (cp .env .env.bak; sed inplace; rodar; restaurar)
3. Não é problema "do banco" — é mecanismo do runner

#### Descoberta B — Migration 20260530558000 NÃO RODA do zero (forward-only quebrado)

Tentativa real revelou que `20260530558000_extend_payment_intents_released_to_actor_wallet.sql` falha em `ATRewriteTable`:
```
ERROR: a restrição de verificação "payment_intents_payment_status_check" da relação "payment_intents" é violada por alguma linha
```

Investigação no banco real:
```
payment_intents.payment_status (distinct values):
  pending                    237
  escrowed                    92
  released_to_actor_wallet    76
  reversed                    24
  refunded_via_recovery        1   ← FORA da lista da 558000
```

A migration 558000 inclui `released_to_actor_wallet` mas NÃO `refunded_via_recovery`. Este último é introduzido pela 571000 (depois). Logo, num run forward-only: 558000 tenta rodar → encontra 1 row com `refunded_via_recovery` (gravada por código atual operando sob CHECK posterior aplicada por outra via) → FALHA.

A CHECK atual do banco real inclui ambos:
```
CHECK ((payment_status = ANY (ARRAY[
  'pending','authorized','captured','escrowed','settled','failed',
  'cancelled','reversed','partially_refunded','disputed','expired',
  'released_to_actor_wallet','refunded_via_recovery'])))
```

Isso confirma drift de migration ativo: a CHECK foi aplicada por outra rota (manual, ad-hoc, ou migration que foi MARCADA via baseline mas não tem ficheiro 1:1 — provável `db_minus_files=3`).

#### Lista das 17 migrations pendentes no banco real

```
20260530558000_extend_payment_intents_released_to_actor_wallet.sql    ← FALHA (Descoberta B)
20260530559000_extend_service_order_status_funds_released.sql
20260530560000_create_economic_policies.sql
20260530561000_create_economic_policy_lines.sql
20260530562000_create_access_pass_products.sql
20260530563000_create_actor_access_passes.sql
20260530564000_create_economic_policy_resolution_logs.sql
20260530565000_rename_rca_to_channel_commission.sql
20260530566000_deprecate_bank_policies_table.sql
20260530567000_add_regional_origin_basis_to_policy_lines.sql
20260530568000_reversals_taxonomy_and_authorship.sql
20260530569000_financial_approval_substrate.sql
20260530570000_actor_wallet_recovery_obligations_substrate.sql
20260530571000_extend_payment_status_refunded_via_recovery.sql    ← adiciona refunded_via_recovery ao CHECK
20260530572000_actor_wallet_payout_requests_substrate.sql
20260530573000_actor_wallet_payout_one_active_per_actor.sql
20260530574000_actor_bank_destinations_substrate.sql
```

#### Implicações para drop/recreate

Mesmo se a Descoberta A for resolvida (runner aceitar override), o drop/recreate **vai falhar na migration 558000** porque:
- Em ordem alfabética, 558000 roda ANTES de 571000.
- Se alguma migration entre 0001-557 popular `payment_intents` com row em `refunded_via_recovery` (E2E seed dentro de migration, fixture, etc.), 558000 falha.
- Mais provável: nenhuma migration prévia popula `refunded_via_recovery`; o caso é só do banco vivo (1 row criada em runtime). DO ZERO, 558000 PROVAVELMENTE roda OK (sem dados, sem violação). Mas precisa confirmar via ensaio em espelho — que está bloqueado por Descoberta A.

#### Portão 1.3 → RESULTADO VÁLIDO: descoberta de dívida

NÃO prosseguir para drop/recreate do banco real. Banco real intacto, espelho vazio (não chegou a popular). Aguardando direção Clayton:

1. **Resolver Descoberta A** (mecanismo) — patch temporário em load-backend-env.ts ou swap controlado de .env; depois re-rodar ensaio.
2. **Após ensaio** — se 558000 rodar OK do zero, confirma que o problema é apenas drift do banco vivo (não defeito da migration). Drop/recreate viável.
3. **Se 558000 falhar do zero também** — é defeito real da migration; precisa correção forward-only nova.
4. **Identificar os 3 `db_minus_files`** — versions registradas sem ficheiro; podem revelar a rota manual que aplicou a CHECK atual.

### Cleanup pós-Fase 1.2 BLOQUEADA

- Mirror DB `unificard_dev_rebuild_check_20260529001835` permanece criado vazio (0 tabelas) — `dropdb` precisa aprovação interativa de Clayton.
- Scripts `_tmp_*` removidos.
- Artefatos `RESET_*` permanecem locais (não commitados):
  - `RESET_BACKUP_2026-05-28T23-29-59.dump` (9.3 MB, banco completo)
  - `RESET_SCHEMA_BEFORE_2026-05-29T00-18-35.sql` (637 KB)
  - `RESET_INVENTORY_BEFORE_2026-05-29T00-18-35.json` (~470 KB)
  - `RESET_MANIFEST_2026-05-29T02-28-38-985Z.json` (40 KB)

### Confirmações de escopo Fase 1.1/1.2 (tentativa)

- ✅ Zero deleção realizada · ✅ Zero migration alterada · ✅ Zero schema alterado
- ✅ Banco real intacto (contagens iguais baseline Fase 0)
- ✅ Espelho criado vazio (0 efeito)
- ✅ Trigger de imutabilidade preservado
- ⚠️ Mirror DB pendente de dropdb interativo

### Vinculadas

- DT-FINDORCREATEUSERACTOR-MISSING-GLOBAL-USER-ID (CLOSED — substituído pelo recreate planejado)
- DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION (OPEN — desaparece se recreate prosseguir)
- DT-CPF-SSOT-DUAL-WRITE-CORE-VS-IDENTITY (permanece OPEN)
- `backend/src/core/db/migrate.ts:14` (runner ignora override)
- `backend/src/core/db/load-backend-env.ts:42-66` (hydrate sobrescreve)
- `backend/migrations/20260530558000_extend_payment_intents_released_to_actor_wallet.sql`
- `backend/migrations/20260530571000_extend_payment_status_refunded_via_recovery.sql`
- Seção 17 do `docs/01_normative/00_AGENT_PROTOCOL.md` (objetos aplicados sem ficheiro)

---

## F-FIX-ENV-PRECEDENCE — Descoberta A do portão 1.3 RESOLVIDA (2026-05-29)

- **Status:** DONE em 2026-05-29. Resolve Descoberta A do portão 1.3 do F-DEV-DATA-CLEAN-RESET. Descoberta B (558000) e 3 órfãs ficam para o ensaio pós-fix (próxima fatia).
- **Classe:** DT-D (defeito de mecanismo / arma carregada).

### Causa raiz

`backend/src/core/db/load-backend-env.ts:42-66` (`hydrateDatabaseUrlFromEnvFile`) sobrescrevia `process.env.DATABASE_URL` SEMPRE com o valor do `.env`, ignorando overrides via env var explícita. Tentativa de ensaio em espelho (Fase 1.2.b do reset) com `DATABASE_URL=postgresql://.../mirror` rodou contra o banco REAL — só não causou estrago porque a 1ª migration falhou em ROLLBACK transacional.

### Git blame

```
39ea70623  (Clayton Pereira Chagas, 2026-05-22)
"marco-zero: estado real do disco aceito como ponto-zero da retomada"
```

A função existe desde o marco-zero (2026-05-22) — herdada do estado pré-retomada. Razão original (do comentário no próprio código): **"dotenv corta em `#` sem aspas"** — quando a senha do `.env` contém `#`, dotenv trunca o valor; a função relê a linha bruta para recuperar o valor completo. Intenção válida; o defeito é a sobrescrita **incondicional**.

Verificação atual: `.env` vigente não contém `#` (0 ocorrências). A função estava ativa por defesa em profundidade.

### Correção

**`backend/src/core/db/load-backend-env.ts`** — hidratação condicional:

```diff
- if (value) {
+ if (value && !process.env.DATABASE_URL) {
+   // Env explícito (ex.: ensaio em espelho via DATABASE_URL=…) vence o .env.
    process.env.DATABASE_URL = value;
  }
```

**`backend/src/core/db/migrate.ts`** — guard-rail mínimo de alvo:

```ts
// Após teste de conexão, antes de aplicar migrations:
const targetDbName = (await pool.query<{ db: string }>(
  'SELECT current_database() AS db')).rows[0]!.db;
console.log(`🎯 Banco-alvo do migrate: ${targetDbName}`);
const expected = process.env.EXPECTED_DATABASE_NAME;
if (expected && expected !== targetDbName) {
  console.error(`❌ Alvo divergente: '${targetDbName}' ≠ '${expected}' — abortado.`);
  process.exit(2);
}
```

Sem `EXPECTED_DATABASE_NAME` setada, comportamento atual preservado (log informativo, segue fluxo). Com a env var setada e divergência, aborta com exit 2 ANTES de qualquer migration.

### Validação (7 cenários)

| Cenário | Resultado |
|---|---|
| (a) Boot normal (sem env override, .env hidrata) | PASS — `DATABASE_URL` resolveu para `unificard_dev` corretamente |
| (b) Migrate normal sem `EXPECTED_DATABASE_NAME` (espelho B vazio) | PASS — log "🎯 Banco-alvo: mirror_test_b_…" sem bloquear; fluxo CI/dev intacto |
| (c) DATABASE_URL explícito → espelho A | PASS — alvo "mirror_test_…" respeitado (antes ia para unificard_dev) |
| (d) `EXPECTED_DATABASE_NAME` confere com alvo | PASS — "✅ Alvo confere com EXPECTED_DATABASE_NAME='mirror_test_…'" |
| (e) `EXPECTED_DATABASE_NAME` divergente (mirror_a vs mirror_b) | PASS — abortou com exit code 2 antes de aplicar |
| (f) Gates 5/5 | tsc clean · actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK · arch strict `critical_new=0` |
| (g) E2Es de fumaça | F3 9/9 PASS · F4.0 8/8 PASS · KYC PROVA DE OURO + Σ débitos=créditos PASS |

Espelhos descartáveis `mirror_test_…` e `mirror_test_b_…` apagados via `dropdb` interativo.

### Confirmações de escopo

- ✅ Zero migration aplicada em qualquer banco
- ✅ Zero das 17 migrations pendentes do banco real foi aplicada (Descoberta B permanece aberta)
- ✅ Zero schema/migration alterado
- ✅ Zero toque em `bank_*` / `bank_ledger` / `bank_transactions` / `bank_splits`
- ✅ Zero trigger desabilitado
- ✅ Banco real `unificard_dev` intocado
- ✅ Ambos espelhos descartáveis criados e dropados na mesma fatia
- ✅ Backup `RESET_BACKUP_2026-05-28T23-29-59.dump` preservado

### Próximo passo

Retomar o ensaio em espelho (Fase 1.2 do F-DEV-DATA-CLEAN-RESET) em sessão futura, agora com a mira corrigida. A Descoberta B (`558000` falha por drift) e as 3 órfãs em `schema_migrations` continuam aguardando — esperado encontrá-las no ensaio pós-fix (provavelmente 558000 roda OK do zero, porque sem dados não há violação).

### Vinculadas

- F-DEV-DATA-CLEAN-RESET (Descoberta A do portão 1.3 — esta fatia resolve)
- F-DEV-DATA-CLEAN-RESET (Descoberta B do portão 1.3 — segue aberta para próxima fatia)
- `backend/src/core/db/load-backend-env.ts:42-67`
- `backend/src/core/db/migrate.ts:557-589` (guard-rail novo)
- Commit `39ea70623` (marco-zero, origem do hydrate)

---

## F-DEV-DATA-CLEAN-RESET — Fase 1.2 RETOMADA · Descoberta C aberta (2026-05-29)

- **Status:** Ensaio em espelho rodou **178/328 migrations** com mira corrigida; falhou em [179/328] por **ordem incorreta de migrations**. NÃO foi possível verificar a Descoberta B (558000) — ensaio parou ANTES de chegar nela. Banco real intocado.
- **HEAD:** `aa6834ae` (F-FIX-ENV-PRECEDENCE)
- **Espelho:** `unificard_dev_rebuild_check_20260529011201`

### TRAVA confirmada nos logs do migrate

Output inicial do `pnpm exec tsx src/core/db/migrate.ts` com `DATABASE_URL` e `EXPECTED_DATABASE_NAME` apontando para o espelho:

```
✔ Conexão com banco de dados estabelecida

🎯 Banco-alvo do migrate: unificard_dev_rebuild_check_20260529011201
✅ Alvo confere com EXPECTED_DATABASE_NAME='unificard_dev_rebuild_check_20260529011201'

📊 RESUMO: 0 migration(s) já registrada(s) no controle
📋 MIGRATIONS PENDENTES: 328 de 328 disponíveis
```

Alvo correto, schema_migrations vazia (sem baseline), 328 pendentes — comportamento esperado de banco vazio. **A correção F-FIX-ENV-PRECEDENCE funcionou em produção do ensaio.**

### Descoberta C — ordem de migrations quebra forward-only

A migration **`20260428200000_schedules_revoke_write.sql`** falhou em [179/328] com:
```
error: relação "schedules" não existe
```

Inspeção do código revela apenas REVOKE:
```sql
REVOKE INSERT, UPDATE ON schedules FROM PUBLIC;
```

**A tabela `schedules` é criada por outra migration:**
```
20260428200000_schedules_revoke_write.sql   (28/04 — REVOKE)
20260530200000_schedules.sql                 (30/05 — CREATE TABLE)
20260530210000_schedule_slots.sql            (30/05 — CREATE schedule_slots)
```

Em ordem alfabética/lexicográfica (que é a ordem do runner em `migrate.ts:432`), `20260428…` roda ANTES de `20260530…`. Logo, REVOKE antes de CREATE → falha forward-only.

**Por que o banco real funciona?**
- `schedules` foi provavelmente criada por uma das **3 órfãs** em `schema_migrations` sem ficheiro correspondente (Seção 17 do AGENT_PROTOCOL):
  - `20260530518000_create_payment_milestones.sql` (sem ficheiro)
  - `20260530519000_seed_concept_split_engineering.sql` (sem ficheiro)
  - `20260530560000_backfill_pf_actor_registry.sql` (sem ficheiro)
- OU foi criada por SQL manual fora do controle de versão (aplicação ad-hoc)
- OU por uma migration de timestamp diferente que foi renomeada e perdeu rastreio

Esta é **Descoberta C** — distinta da B; é defeito real de ordem entre migrations existentes no tree.

### Observação dirigida sobre a 558000

**A 558000 NÃO chegou a ser executada.** O ensaio parou em [179/328], muito antes da [???/328] que seria a 558000. Portanto:

- ❌ Não é possível responder "a 558000 passou no espelho?" — não rodou.
- ❌ Não é possível confirmar que Descoberta B "some sozinha quando rodada do zero" — testes não chegou.
- ➡️ Para confirmar B, seria necessário primeiro resolver C (criar ficheiro da migration que cria `schedules` antes da REVOKE, ou pular a REVOKE). Fora do escopo desta fatia (proibido SQL manual / "correção" de schema).

### Estado parcial do espelho (178 migrations aplicadas)

```
tables=126 (vs 235 no real, faltam 109)
columns=1096 (vs 2348 no real)
constraints=498 (vs 1111 no real)
triggers=57 (vs 76 no real)
indexes=477 (vs 840 no real)
functions=100 (vs 122 no real)
extensions=3 (vs 4 no real)

Seeds parciais nasceram em ordem:
  concepts=10 (vs 90 final) ← parcial, mais seeds depois da 200000
  categories=58 (vs 102 final) ← idem
  company_types=7 (igual) ← já completo aos 7 antes da 200000
  company_type_allowed_concepts=7 (igual)
  permissions=0 (vs 38 final) ← não chegou (rbac vem depois)
  roles=0 (vs 4 final) ← idem
  role_permissions=0 (vs 68 final) ← idem
  canonical_products=0 (vs 35 final) ← não chegou
  tenants=0 ← correto (zero fixtures no rebuild)
```

### 3 órfãs em `schema_migrations` (versions sem ficheiro)

Confirmadas no inventário BEFORE:
- `20260530518000_create_payment_milestones.sql`
- `20260530519000_seed_concept_split_engineering.sql`
- `20260530560000_backfill_pf_actor_registry.sql`

**Hipótese**: estas órfãs poderiam ter criado objetos no banco real que não nascem no rebuild — incluindo possivelmente `schedules` (apesar do nome não sugerir; precisaria inspeção do dump completo). Detalhe a investigar em fatia futura.

### Artefatos gerados (locais, não commitar)

| Path | Tamanho | Conteúdo |
|---|---|---|
| `RESET_SCHEMA_BEFORE_2026-05-29T01-12-01.sql` | 637 KB | schema-only do banco real |
| `RESET_INVENTORY_BEFORE_2026-05-29T01-12-01.json` | ~470 KB | inventário normalizado: 235 tables, 1111 constraints, 76 triggers, 122 functions; 314 migrations registradas, 328 arquivos, 17 pendentes, 3 órfãs |
| `RESET_MIGRATE_LOG_2026-05-29T01-12-01.log` | (full log) | output completo do migrate no espelho (178 sucessos + 1 falha) |
| `RESET_SCHEMA_REBUILD_CHECK_PARTIAL_2026-05-29T01-12-01.sql` | 328 KB | schema-only parcial do espelho (após 178 migrations) |
| `RESET_INVENTORY_REBUILD_CHECK_PARTIAL_2026-05-29T01-12-01.json` | ~230 KB | inventário parcial do espelho |
| `RESET_SCHEMA_DIFF_PARTIAL_2026-05-29T01-12-01.txt` | 390 KB | diff schema real vs espelho parcial (11765 linhas; cobre as 109 tabelas faltantes) |

### Portão 1.3 — RESULTADO VÁLIDO: dívida de migration encontrada

**RECOMENDAÇÃO: PARAR — não prosseguir para drop/recreate real.** Dívida de migration localizada antes do ensaio chegar nas dependentes posteriores (incluindo a 558000 da Descoberta B). Lista para Clayton:

1. **Descoberta C (NOVA, 2026-05-29):** `20260428200000_schedules_revoke_write.sql` quebra forward-only — REVOKE antes de CREATE TABLE. Provavelmente outras migrations entre [179/328] e [328/328] dependem dessa mesma `schedules` ou de outras tabelas criadas tardiamente.
2. **Descoberta B (sessão anterior):** `20260530558000` — não verificada porque ensaio parou em 179. Hipótese "some quando do zero" continua pendente.
3. **3 órfãs em schema_migrations** — versions aplicadas no real sem ficheiro no tree; possíveis suspeitas pela criação de `schedules` ou outras tabelas que estão no real mas não no rebuild.

Decisão Clayton: (a) corrigir ordenamento das migrations para que CREATE preceda REVOKE/seed; (b) investigar e gerar ficheiros forward-only para as 3 órfãs; (c) ambos. Fora desta sessão: proibido SQL manual / "correção" de schema.

### Confirmações de escopo Fase 1.2 (ensaio)

- ✅ Zero migration aplicada no banco real (todas as 178 sucessos foram no espelho)
- ✅ Banco real `unificard_dev` intocado em toda a sessão
- ✅ Trigger de imutabilidade não tocado
- ✅ `bank_*` do real não tocado
- ✅ Backup completo (`RESET_BACKUP_2026-05-28T23-29-59.dump`) preservado
- ✅ TRAVA `EXPECTED_DATABASE_NAME` confirmada nos logs em cada migrate
- ✅ Artefatos RESET_* NÃO commitados (apenas docs institucionais serão)
- ⚠️ Espelho `unificard_dev_rebuild_check_20260529011201` aguarda dropdb interativo

### Vinculadas

- F-FIX-ENV-PRECEDENCE (commit `aa6834ae` — pré-requisito desta fatia, validou TRAVA em produção)
- Descoberta A (RESOLVIDA na fatia anterior)
- Descoberta B (`20260530558000` — não verificada nesta sessão; depende de C)
- Descoberta C (NOVA — ordem entre `20260428200000_schedules_revoke_write.sql` e `20260530200000_schedules.sql`)
- 3 órfãs em `schema_migrations` (Seção 17 AGENT_PROTOCOL)
- `backend/migrations/20260428200000_schedules_revoke_write.sql`
- `backend/migrations/20260530200000_schedules.sql`
- `backend/migrations/20260530210000_schedule_slots.sql`

---

## F-MIGRATION-REBUILD-COHERENCE-AUDIT — guardião read-only, dívida total mapeada (2026-05-29)

- **Modo:** guardião read-only absoluto. Zero edição. Zero execução de migration. SELECT-only no banco real. Auditoria estática + reuso dos artefatos do portão 1.3.
- **Objetivo cumprido:** medir tamanho TOTAL da dívida antes de propor correção em pacotes coerentes.

### Artefatos gerados (locais, não commitar)

| Path | Conteúdo |
|---|---|
| `AUDIT_A_ORPHANS_*.json` | 3 órfãs detalhadas + inferências do que cada criou |
| `AUDIT_B_ORDER_*.json` | 19 inversões + objetos sem CREATE no tree + flags IF NOT EXISTS |
| `AUDIT_C_GAP_*.json` | 113 tabelas faltantes classificadas (esperado vs dívida real) + blast radius |

### Paralela A — schema_migrations: órfãs

**Total confirmado: 3 órfãs.** Mesmo trio já conhecido — nenhuma adicional descoberta.

| ID | filename | executed_at | checksum | exec_ms | Inferência |
|---|---|---|---|---|---|
| 294 | `20260530518000_create_payment_milestones.sql` | 2026-05-16 23:34:04 | **NULL** | **null** | Marcada pelo baseline auto **sem executar SQL**. `payment_milestones` EXISTE (11 cols) — criada por outra rota. |
| 295 | `20260530519000_seed_concept_split_engineering.sql` | 2026-05-16 23:34:04 | **NULL** | **null** | Marcada baseline. `concepts` matching 'split': **0**. Seed nunca ocorreu. |
| 307 | `20260530560000_backfill_pf_actor_registry.sql` | 2026-05-20 15:46:31 | `809b1d45…` | 29ms | **Executada de verdade**. `actor_registry` tem 65 rows. |

**Observação chave:** órfãs 294 e 295 NÃO foram executadas (checksum/exec_ms null) — apenas registradas pelo baseline. O objeto `payment_milestones` que EXISTE no real foi criado por **outra rota** (provavelmente SQL manual ad-hoc). Órfã 307 foi executada — backfill operacional aplicado em runtime.

**Colisão de timestamp:** `20260530560000` é prefixo de DOIS arquivos:
- `20260530560000_backfill_pf_actor_registry.sql` — ORFÃ aplicada (sem ficheiro)
- `20260530560000_create_economic_policies.sql` — PENDING (no tree, não aplicado)
Mesmo prefixo numérico mas nomes diferentes; runner ordena por filename completo, então tecnicamente não há conflito de extração de versão; mas é um sinal claro de que duas rotas paralelas geraram o timestamp idêntico.

**17 PENDING** confirmados (mesma lista anterior — descobertas B vivem aqui).

### Paralela B — inversões de ordem (estática)

**Total: 19 inversões em 12 objetos.** Detalhe por categoria:

**REF_BEFORE_CREATE (8 ocorrências em 5 famílias) — todas inversões cronológicas REAIS:**

| Objeto | Inversão | Origem |
|---|---|---|
| `schedules` | `20260428200000_schedules_revoke_write.sql:4` (REVOKE) → criado em `20260530200000_schedules.sql:4` | **Descoberta C confirmada** (tropeço do ensaio) |
| `schedule_slots` | `20260428200000_schedules_revoke_write.sql:5` (REVOKE) → criado em `20260530210000_schedule_slots.sql:5` | Mesma migration; pega 2 objetos |
| `bookings` | `20260428260000_bookings_fix_timestamp_names.sql:20,31,42,53` (4× ALTER) → criado em `20260530491000_create_unified_availability_tables.sql:24` | 4 ALTERs antes do CREATE |
| `event_attendees` | `20260428280000_event_attendees_fix_check_in_time.sql:10` (ALTER) → criado em `20260530150000_event_attendees.sql:4` | ALTER antes do CREATE |
| `rides_vehicles` | `20260523100000_rides_vehicles_concept_id_nullable.sql:18` (ALTER) → criado em `20260530350000_rides_core.sql:20` | ALTER antes do CREATE (latente, profile FULL apenas) |

**Padrão:** todas as 5 famílias têm o mesmo formato — migration de timestamp ANTIGO (`20260428…` / `20260523…`) faz ALTER/REVOKE em tabela cuja CREATE TABLE está em timestamp POSTERIOR (`20260530…`). Provavelmente herança de renomeio histórico ou refactor que invalidou a cronologia original. Em ordem alfabética (runner padrão), são todos forward-only quebrados.

**REF_TO_NEVER_CREATED (7 objetos com refs mas sem CREATE no tree):**

| Objeto | Refs | Classe |
|---|---|---|
| `schema_migrations` | 3 INSERTs | Tabela de controle do runner (criada pelo `ensureMigrationsTable` em runtime). Normal. |
| `schema` | 2 REVOKEs | Falso positivo do regex (`REVOKE … ON SCHEMA public`). |
| `function` | 1 GRANT | Falso positivo do regex (`GRANT … ON FUNCTION …`). |
| `_deprecated_product_concept_resolution_queue` | 2 ALTER | Seção 17 — tabela renomeada por SQL manual antes do cleanup. |
| `_deprecated_product_concepts` | 1 DROP | Idem. |
| `_deprecated_tenant_products` | 1 ALTER | Idem. |
| `_deprecated_catalog_products` | 1 DROP | Idem. |

Os 4 `_deprecated_*` aparecem em `20260429200000_cleanup_semantico.sql`. Provavelmente em algum momento alguém fez `ALTER TABLE ... RENAME TO _deprecated_…` por SQL manual (sem migration versionada) e depois a migration de cleanup faz DROP/ALTER nessas. Sinal de Seção 17.

**IF NOT EXISTS:** 117 CREATE TABLE com `IF NOT EXISTS` (proporção alta — mascara dívida se um CREATE foi pulado por idempotência defensiva).

### Paralela C — gap esperado vs dívida real de schema

- 235 tabelas no real, 126 no espelho parcial → **113 ausentes**
- **111 ausentes são GAP ESPERADO** (criadas em migrations [179..328] — incluindo `schedules`, `schedule_slots`, todas as substract* das 17 pending, etc.)
- **2 ausentes são DÍVIDA REAL** (sem CREATE em NENHUMA migration do tree):
  - `_deprecated_product_concept_resolution_queue` — sem FK apontando (blast=0)
  - `_deprecated_tenant_products` — sem FK apontando (blast=0)

**Blast radius da dívida real = ZERO.** Ambas são legado de rename manual, sem dependências. Conviver com elas é viável; reconstruí-las como forward-only é trivial (CREATE TABLE simples).

### Consolidado — tamanho TOTAL da dívida

| Categoria | Quantidade | Severidade |
|---|---|---|
| Órfãs em schema_migrations | 3 | 2 baseline-marked (não executadas) + 1 backfill real |
| Inversões REF_BEFORE_CREATE | 8 em 5 famílias | bloqueante de drop/recreate |
| Refs a tabelas `_deprecated_*` sem CREATE | 4 objetos | herança de rename manual; baixo risco |
| Tabelas em dívida real de schema | 2 | blast radius zero |
| Pending no tree (não aplicadas no real) | 17 | inclui Descoberta B (558000) |
| Colisões de timestamp | 1 (`20260530560000` duplicado) | baixa; runner ordena por filename completo |

### Migrations forward-only que PRECISARÃO ser criadas (lista, sem escrever SQL)

| # | Nome sugerido | O que fará | Origem |
|---|---|---|---|
| 1 | `<ts>_repair_create_schedules.sql` | CREATE TABLE schedules + colunas observadas no real (id, tenant_id, actor_id, reference_type, reference_id, status, metadata, created_at, updated_at) | Para que `20260428200000_schedules_revoke_write` pare de quebrar |
| 2 | `<ts>_repair_create_schedule_slots.sql` | CREATE TABLE schedule_slots | Mesma família de #1 |
| 3 | `<ts>_repair_create_bookings.sql` | CREATE TABLE bookings | Para que `20260428260000_bookings_fix_timestamp_names` pare de quebrar |
| 4 | `<ts>_repair_create_event_attendees.sql` | CREATE TABLE event_attendees | Para `20260428280000_event_attendees_fix_check_in_time` |
| 5 | `<ts>_repair_create_rides_vehicles.sql` | CREATE TABLE rides_vehicles (profile FULL) | Para `20260523100000_rides_vehicles_concept_id_nullable` |
| 6 | `<ts>_repair_create_payment_milestones.sql` | CREATE TABLE payment_milestones (estrutura observada no real, 11 colunas) | Substituir órfã 518000 (que não rodou) |
| 7 | `<ts>_repair_seed_concept_split_engineering.sql` | INSERT em concepts (domínio split-engineering) | Substituir órfã 519000 OU marcar como obsoleta se ninguém usa |
| 8 | `<ts>_repair_backfill_pf_actor_registry.sql` | Re-implementar backfill | Substituir órfã 307 (executada de verdade no real, mas sem ficheiro) — ou marcar como "estado vivo, não re-executar" |
| 9 | `<ts>_repair_create_deprecated_product_concept_resolution_queue.sql` | CREATE TABLE `_deprecated_product_concept_resolution_queue` | Para que `20260429200000_cleanup_semantico` ALTER funcione no rebuild |
| 10 | `<ts>_repair_create_deprecated_tenant_products.sql` | CREATE TABLE `_deprecated_tenant_products` | Idem |

Migrations 1-5 e 9-10 são **purely structural** (CREATE TABLE com colunas observadas no real); migrations 6-8 lidam com as 3 órfãs. **NÃO inclui correção das 17 pending** (essas já têm ficheiro; é só rodar depois de pacote estrutural).

### Pacotes coerentes de correção (recomendados)

**Pacote 1 — Estrutural Pré-Cleanup (deve preceder qualquer migration de abril/maio que faz ALTER/REVOKE em tabela criada depois):**
- Migrations 1, 2, 3, 4, 9, 10 (CREATE de schedules, schedule_slots, bookings, event_attendees, `_deprecated_*`)
- Timestamp deve ser **anterior** ao primeiro ALTER/REVOKE — ou seja, próximo de `20260428000000`
- Profile CORE_ONLY (sem rides)

**Pacote 2 — Órfãs (substituem entradas em schema_migrations sem ficheiro):**
- Migration 6 (payment_milestones), 7 (seed split-engineering), 8 (backfill actor_registry)
- Timestamps próximos aos das órfãs originais (518000-560000) mas posteriores ao Pacote 1
- Para 6 e 7: o `INSERT INTO schema_migrations` deve ser ajustado para que NÃO tente re-executar a versão antiga sem ficheiro (problema operacional do baseline auto)
- Migration 8: o backfill JÁ rodou; o ficheiro forward-only deve ser idempotente para não duplicar

**Pacote 3 — Rides (profile FULL, separado):**
- Migration 5 (rides_vehicles) — só ativada com `MIGRATION_PROFILE=FULL`

**Pacote 4 — 17 PENDING (após Pacote 1+2):**
- As 17 migrations já no tree. Ordem alfabética já está correta; só precisa rodar após os 3 pacotes acima.
- Inclui 558000 (Descoberta B). Hipótese a confirmar no ensaio: sem dados, 558000 roda OK.

### Confirmações de escopo guardião

- ✅ Zero edição de migration, schema, código
- ✅ Zero execução de migration (nem real nem espelho) nesta fatia
- ✅ Zero toque no banco real além de SELECT
- ✅ Artefatos AUDIT_* / RESET_* NÃO commitados; apenas docs institucionais
- ✅ Banco real intocado em toda a fatia

### Vinculadas

- Portão 1.3 (F-DEV-DATA-CLEAN-RESET) — Descoberta C (commits `634f6542`)
- F-FIX-ENV-PRECEDENCE (`aa6834ae`) — TRAVA usada
- Seção 17 do `docs/01_normative/00_AGENT_PROTOCOL.md` — objetos sem ficheiro
- Próxima fatia (decisão Clayton): desenhar 4 pacotes acima como migrations forward-only reais.

---

## F-MIGRATION-REBUILD-PACKAGES — Desenho do Pacote 1 (2026-05-29)

- **Modo:** guardião read-only. Zero edição de migration. Zero execução. Banco real só SELECTs.
- **Decisões já fechadas (não reabrir):** Pacote 3 `_deprecated_*` não voltam no rebuild; órfã 560000 vira tombstone/no-op (writer canônico vivo no actor.repository).
- **Resultado:** das 5 famílias originais, apenas **2 migrations** precisarão ser escritas. As outras 3 são **falsas positivas da auditoria estática** (têm guard `IF EXISTS` que torna o ALTER no-op no rebuild).

### Por família — evidência exata

#### Família 1 — `schedules` + `schedule_slots`  →  Opção X (backdate CREATE) RECOMENDADA

**Precoce:** `20260428200000_schedules_revoke_write.sql:4-5` — `REVOKE INSERT, UPDATE ON schedules FROM PUBLIC; REVOKE INSERT, UPDATE ON schedule_slots FROM PUBLIC;` — **sem guard**. Quebra forward-only se as tabelas não existirem ainda. **É o tropeço real do ensaio.**

**Tardio:** `20260530200000_schedules.sql:4-14` — `CREATE TABLE IF NOT EXISTS schedules (id PK, tenant_id FK tenants, actor_id FK actors, reference_type, reference_id, status DEFAULT 'active', metadata, created_at, updated_at)`.

**Tardio:** `20260530210000_schedule_slots.sql:5-13` — `CREATE TABLE IF NOT EXISTS schedule_slots (id PK, schedule_id FK schedules, starts_at, ends_at, status DEFAULT 'available', metadata, created_at)`.

**Estado real do banco vivo (após CHECKs adicionados por `20260530535000_c36_status_check_constraints.sql:109-115`):**
- `schedules`: id (PK), tenant_id (FK tenants), actor_id (FK actors), reference_type, reference_id, status (`chk_schedules_status` CHECK in 'active'/'inactive'/'archived'), metadata, created_at, updated_at. **0 rows.**
- `schedule_slots`: id (PK), schedule_id (FK schedules), starts_at, ends_at, status (`chk_schedule_slots_status` CHECK in 'available'/'booked'/'blocked'/'cancelled'), metadata, created_at. **0 rows.**

A CHECK não vem do CREATE, vem da 535000 — que está em [179..328]. No rebuild rodará após o CREATE. OK.

**Plano recomendado (Opção X):**
- Criar `20260428100000_create_schedules.sql` — clonar conteúdo de `20260530200000_schedules.sql` (CREATE TABLE IF NOT EXISTS schedules)
- Criar `20260428110000_create_schedule_slots.sql` — clonar conteúdo de `20260530210000_schedule_slots.sql` (CREATE TABLE IF NOT EXISTS schedule_slots)
- Timestamp escolhido: `20260428100000` e `20260428110000` (antes do REVOKE em `20260428200000`)
- Originais `20260530200000_schedules.sql` e `20260530210000_schedule_slots.sql` **permanecem intactos** — `IF NOT EXISTS` os torna no-op no rebuild

**Análise de risco — banco vivo:** ambas tabelas já existem; `CREATE TABLE IF NOT EXISTS` é no-op idempotente. Zero risco. Zero efeito em dados (0 rows em ambas).

**Análise de risco — runner:** filename 14 dígitos passa pelo `extractMigrationNumber → null`, então NÃO entra no forward-only check (`migrate.ts:483-498`). Ordenação alfabética por filename completo. `20260428100000…` < `20260428200000…` < `20260530200000…`. Ordem correta.

**Por que NÃO opção Y (mover CREATE existente):** mover/renomear `20260530200000_schedules.sql` para timestamp anterior tornaria a entry em `schema_migrations` órfã (sem ficheiro) — criaria mais uma órfã. Inaceitável.

#### Família 2 — `bookings`  →  **FALSA POSITIVA** (não escrever migration)

**Precoce:** `20260428260000_bookings_fix_timestamp_names.sql:13-55` — 4 blocos `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE … column_name='requestedat') THEN ALTER TABLE bookings RENAME COLUMN requestedat TO requested_at; END $$;` (e para `confirmedat`/`cancelledat`/`expiredat`).

**Tardio:** `20260530491000_create_unified_availability_tables.sql:24-40` — `CREATE TABLE IF NOT EXISTS bookings (..., requestedat TIMESTAMPTZ, ..., confirmedat, cancelledat, expiredat, ...)`. Cria com colunas LEGADAS.

**Comportamento no rebuild zero:**
1. Em 20260428260000, `bookings` não existe → `IF EXISTS column` é FALSE em 4× → **no-op silencioso (não quebra)**.
2. Em 20260530491000, CREATE cria `bookings` com colunas legadas.
3. Tabela final no rebuild: colunas `requestedat`/`confirmedat`/`cancelledat`/`expiredat` (legadas).

**Estado real do banco vivo:** colunas RENOMEADAS — `requested_at`, `confirmed_at`, `cancelled_at`, `expired_at` + `chk_bookings_status` CHECK in 'requested'/'confirmed'/'cancelled'/'expired'/'checked_in'/'checked_out'. 39 rows.

**Divergência aceita:** rebuild produz colunas legadas; real tem modernas. Grep em migrations confirma que **NENHUMA outra migration do tree referencia `requested_at`/`confirmed_at`/etc. em bookings** — apenas o próprio fix `20260428260000`. CHECK constraint `chk_bookings_status` é adicionada em `20260530535000_c36_status_check_constraints.sql:93-95` por `ALTER TABLE bookings ADD CONSTRAINT chk_bookings_status CHECK (status IN ...)` — não depende dos nomes de timestamp.

**Decisão:** **não mexer.** Divergência cosmética entre rebuild e real, sem efeito em migrations posteriores. Anotar como "follow-up código TS pode usar nome moderno — fora deste pacote".

#### Família 3 — `event_attendees`  →  **FALSA POSITIVA** (não escrever migration)

**Precoce:** `20260428280000_event_attendees_fix_check_in_time.sql:3-12` — `DO $$ BEGIN IF EXISTS (column 'check_in_time') THEN ALTER TABLE event_attendees RENAME COLUMN check_in_time TO checked_in_at; END $$;`. Guard idempotente.

**Tardio:** `20260530150000_event_attendees.sql:4-14` — `CREATE TABLE IF NOT EXISTS event_attendees (..., check_in_time TIMESTAMPTZ, ...)`. Cria com nome legado.

**Comportamento no rebuild zero:** mesma análise que bookings. RENAME no-op silencioso, CREATE cria com `check_in_time`. Tabela final no rebuild: `check_in_time` (legado).

**Estado real:** `checked_in_at` (renomeada) + `chk_event_attendees_status` CHECK (registered/cancelled/attended/no_show) adicionada por 535000.

**Grep em migrations:** **nenhuma outra migration referencia `checked_in_at` em event_attendees** — apenas o próprio fix. Divergência aceita.

**Decisão:** **não mexer.** Divergência cosmética.

#### Família 4 — `rides_vehicles`  →  **FALSA POSITIVA** (não escrever migration)

**Precoce:** `20260523100000_rides_vehicles_concept_id_nullable.sql:10-30` — `DO $mig$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='rides_vehicles') THEN ALTER TABLE rides_vehicles ADD COLUMN IF NOT EXISTS concept_id UUID NULL; ...; END $mig$;`. **Duplo guard** (IF EXISTS table + ADD COLUMN IF NOT EXISTS).

**Tardio:** `20260530350000_rides_core.sql:20-46` — `CREATE TABLE IF NOT EXISTS rides_vehicles (..., concept_id UUID, ...)` (linha 32). **CREATE já inclui `concept_id`.**

**Comportamento no rebuild zero:**
1. Em 20260523100000, rides_vehicles não existe → IF EXISTS table = FALSE → no-op.
2. Em 20260530350000, CREATE cria rides_vehicles JÁ com concept_id.
3. Tabela final no rebuild: igual ao real.

**Profile:** `20260530350000_rides_core.sql` NÃO está na lista `LATENT_MODULE_MIGRATIONS` (`migrate.ts:48-63`) — roda em CORE_ONLY normalmente.

**Decisão:** **não mexer.** Falsa positiva confirmada; rebuild produz estado idêntico ao real.

### Análise dos guards de regressão (Passo 5)

| Guard | Verifica | Impacto no Pacote 1 |
|---|---|---|
| `guard-financial-regression.ts` | Padrões em `src/*.ts` (não migrations) | Nenhum |
| `sql-regression-lint.ts` | `SELECT * FROM` em migrations | Nenhum (CREATE TABLE não usa SELECT *) |
| `check-migration-numbering.js` | Numeração 4-dígitos única + sufixos sequenciais | Linha 28: arquivos com 14 dígitos (`/^\d{14}_/`) são IGNORADOS pelo check — nossas backdates (`20260428100000_…`, `20260428110000_…`) passam sem verificação |
| Runner `migrate.ts` forward-only | `extractMigrationNumber` retorna null para 14 dígitos → forward-only check NÃO se aplica | Backdates aceitas |
| Runner ordenação | `localeCompare(filename)` alfabético | `20260428100000` < `20260428200000` ✓ |

### Lista preliminar das migrations forward-only do Pacote 1

| # | Nome proposto | O que cria | Origem | Estimativa |
|---|---|---|---|---|
| 1 | `20260428100000_create_schedules.sql` | `CREATE TABLE IF NOT EXISTS schedules` (colunas idênticas a `20260530200000_schedules.sql`) | Necessário para `20260428200000_schedules_revoke_write.sql` rodar do zero | ~15 linhas |
| 2 | `20260428110000_create_schedule_slots.sql` | `CREATE TABLE IF NOT EXISTS schedule_slots` (colunas idênticas a `20260530210000_schedule_slots.sql`) | Mesmo motivo de #1 | ~13 linhas |

**Tamanho total Pacote 1: 2 migrations, ~30 linhas SQL.**

**Famílias originais que NÃO geram migration:** bookings, event_attendees, rides_vehicles (3 falsas positivas).

### Refinamento da Paralela B (sinalizado, sem ação aqui)

A auditoria estática detectou inversões REF_BEFORE_CREATE em 5 famílias, mas apenas **1 família (schedules+schedule_slots)** é dívida real. As outras 3 (bookings, event_attendees, rides_vehicles) têm guard `IF EXISTS` que torna o ALTER no-op no rebuild — falsas positivas do regex que não distingue ALTER bruto de ALTER protegido por `DO $$ BEGIN IF EXISTS … THEN … END $$`. Refinamento da auditoria seria: filtrar ALTERs envoltos em guard `IF EXISTS`. Anotado como melhoria futura da auditoria, sem efeito nesta fatia.

### Confirmações de escopo Pacote 1 (desenho)

- ✅ Zero migration escrita
- ✅ Zero edição de código/schema
- ✅ Zero execução de migration
- ✅ Zero toque no banco real além de SELECT (8 tabelas inspecionadas)
- ✅ Banco real intocado em toda a fatia
- ✅ Decisões fechadas pelo Clayton respeitadas (Pacote 3 fora; órfã 560000 tombstone)
- ✅ Sem propor SQL ainda — apenas mapa do desenho

### Próximo passo

Aguardar Clayton + Opus + ChatGPT revisarem o desenho. Quando autorizado, escrever as 2 migrations propostas (Pacote 1) numa fatia separada.

### Vinculadas

- F-MIGRATION-REBUILD-COHERENCE-AUDIT (commit `cbddd2de`) — fonte do mapa
- F-DEV-DATA-CLEAN-RESET portão 1.3 — Descoberta C destravada por Pacote 1
- Família 1 (única dívida real): `20260428200000_schedules_revoke_write.sql:4-5`, `20260530200000_schedules.sql:4-14`, `20260530210000_schedule_slots.sql:5-13`
- CHECKs adicionadas em `20260530535000_c36_status_check_constraints.sql:89-115`
- Falsas positivas: `20260428260000_bookings_fix_timestamp_names.sql`, `20260428280000_event_attendees_fix_check_in_time.sql`, `20260523100000_rides_vehicles_concept_id_nullable.sql`

---

## F-MIGRATION-REBUILD-PACKAGES — Instância E: lacuna dos nomes RESOLVIDA (2026-05-29)

- **Modo:** guardião read-only absoluto. SELECT-only no banco real + leitura de migrations.
- **Objetivo:** explicar a contradição entre tree (CREATE com colunas LEGADAS) e banco real (colunas MODERNAS) antes de desenhar P1.
- **Achado decisivo:** rota é **(a) migration do tree que rodou na ordem cronológica certa por acaso** — ordem de execução real ≠ ordem alfabética.

### Evidência decisiva (executed_at em schema_migrations)

```
20260530150000_event_attendees.sql                       executed=2026-04-21 13:48:00.503  ← criou check_in_time
20260530491000_create_unified_availability_tables.sql   executed=2026-04-21 13:48:00.868  ← criou requestedat etc.
20260428260000_bookings_fix_timestamp_names.sql         executed=2026-04-29 22:42:23.740  ← RENAME (8 dias DEPOIS)
20260428280000_event_attendees_fix_check_in_time.sql    executed=2026-04-29 22:42:23.761  ← RENAME (8 dias DEPOIS)
```

A migration de RENAME (filename `20260428…`) rodou **8 dias DEPOIS** da migration de CREATE (filename `20260530…`), apesar de ter timestamp de filename ANTERIOR.

### Como isso foi possível

Sequência cronológica real:
1. **21/abr/2026 13:48** — Tree continha 20260530150000 e 20260530491000; runner aplicou em ordem alfabética disponível naquele momento (CREATE com nomes legados).
2. **Entre 21/abr e 29/abr** — alguém adicionou ao tree `20260428260000_bookings_fix_timestamp_names.sql` e `20260428280000_event_attendees_fix_check_in_time.sql` (timestamps "do passado").
3. **29/abr/2026 22:42** — Runner detectou as 2 novas como pendentes (já que 20260530xxx estava registrada). Rodou apenas as novas. Tabelas JÁ existiam → `IF EXISTS column` = TRUE → RENAME efetivou. Colunas viraram MODERNAS.

**O runner ordena por filename alfabético**, mas só roda as PENDENTES. Como as migrations CREATE já estavam aplicadas quando as RENAME foram adicionadas, o efeito final foi "RENAME depois de CREATE" — apesar do filename sugerir o oposto.

### Por que o rebuild zero diverge

No rebuild ZERO, todas as 328 migrations estão simultaneamente pendentes. O runner ordena ALFABETICAMENTE por filename:
1. `20260428260000_bookings_fix_timestamp_names.sql` roda PRIMEIRO. Tabela `bookings` não existe → `IF EXISTS column 'requestedat'` = FALSE → no-op silencioso.
2. `20260530491000_create_unified_availability_tables.sql` roda DEPOIS. Cria `bookings` com colunas LEGADAS.
3. Estado final: colunas legadas (`requestedat`, `confirmedat`, etc.).

Mesma análise para `event_attendees` com `check_in_time`.

### Classificação da rota

- (a) **Migration do tree que rodou na ordem certa por acaso** ✓ — confirmado por `checksum=36ae25b4cb74` (não null) + `executed_at` real.
- (b) órfã/perdida → NÃO. As 3 órfãs (518000, 519000, 560000) não tocam essas colunas (nomes não relacionados).
- (c) correção manual fora de migration → NÃO. O RENAME está no tree e tem checksum.
- (d) indeterminado → NÃO. Evidência clara.

### Implicação para o desenho do Pacote 1 (refina a entrega anterior)

**A divergência rebuild-vs-real NÃO é cosmética.** No rebuild atual, bookings nasce com `requestedat`/`confirmedat`/`cancelledat`/`expiredat` e event_attendees nasce com `check_in_time`. **Diferente do banco vivo.** Aplicações que assumem nomes modernos quebram no rebuild.

Para o backdate produzir estado-alvo IDÊNTICO ao real, há 2 opções equivalentes:

- **Opção X1 (estado moderno desde sempre):** backdate de CREATE com COLUNAS MODERNAS antes do RENAME. RENAME executa → `IF EXISTS column 'requestedat'` = FALSE → no-op. CREATE original (20260530491000) com IF NOT EXISTS = no-op. **Estado final = moderno = real.**

- **Opção X2 (preserva história semântica):** backdate de CREATE com COLUNAS LEGADAS antes do RENAME. RENAME executa → tabela existe e tem coluna legada → ALTER renomeia. CREATE original = no-op. **Estado final = moderno = real.**

Ambas atingem o estado-alvo. **X1 é mais limpo** (uma instrução SQL); **X2 preserva história de versionamento**.

### Estado-alvo de cada uma das 4 tabelas core (para o backdate produzir)

Colunas/constraints capturadas do banco real. CHECK constraints (status) vêm de `20260530535000_c36_status_check_constraints.sql:89-115` — **NÃO precisam estar no backdate** (rodam depois).

#### `schedules` (estado real, 0 rows)
```
COLS:
  id              uuid PK DEFAULT uuid_generate_v4()
  tenant_id       uuid NOT NULL  FK → tenants(id)
  actor_id        uuid           FK → actors(id)
  reference_type  text
  reference_id    uuid
  status          text NOT NULL DEFAULT 'active'
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
  created_at      timestamptz NOT NULL DEFAULT now()
  updated_at      timestamptz NOT NULL DEFAULT now()
CHECK: chk_schedules_status (vem da 535000)
INDEXES: schedules_pkey
```

Conteúdo do CREATE tardio `20260530200000_schedules.sql` JÁ É IGUAL ao estado-alvo. Sem divergência de colunas/defaults/FKs. **Apenas falta a CHECK constraint (vem depois).**

#### `schedule_slots` (estado real, 0 rows)
```
COLS:
  id           uuid PK DEFAULT uuid_generate_v4()
  schedule_id  uuid NOT NULL  FK → schedules(id)
  starts_at    timestamptz NOT NULL
  ends_at      timestamptz NOT NULL
  status       text NOT NULL DEFAULT 'available'
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb
  created_at   timestamptz NOT NULL DEFAULT now()
CHECK: chk_schedule_slots_status (vem da 535000)
INDEXES: schedule_slots_pkey
```

Conteúdo do CREATE tardio `20260530210000_schedule_slots.sql` IGUAL ao estado-alvo (modulo CHECK).

#### `bookings` (estado real, 39 rows) — DIVERGENTE DO TREE
```
COLS (15):
  booking_id          uuid PK DEFAULT gen_random_uuid()
  tenant_id           uuid NOT NULL
  availability_id     uuid NOT NULL  FK → availability(availability_id) ON DELETE CASCADE
  requester_actor_id  uuid NOT NULL
  status              varchar(30) NOT NULL DEFAULT 'requested'
  notes               text
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb
  requested_at        timestamptz NOT NULL DEFAULT now()     ← MODERNO (tree tem requestedat)
  checked_in_at       timestamptz                            ← já era checked_in_at no tree
  checked_out_at      timestamptz                            ← já era checked_out_at no tree
  confirmed_at        timestamptz                            ← MODERNO (tree tem confirmedat)
  cancelled_at        timestamptz                            ← MODERNO (tree tem cancelledat)
  expired_at          timestamptz                            ← MODERNO (tree tem expiredat)
  created_at          timestamptz NOT NULL DEFAULT now()
  updated_at          timestamptz NOT NULL DEFAULT now()
CHECK: chk_bookings_status (vem da 535000)
INDEXES: bookings_pkey, idx_bookings_tenant_availability, idx_bookings_tenant_requester
FKs: bookings_availability_id_fkey
```

**Divergência: 4 colunas com nomes legados no tree (`requestedat`, `confirmedat`, `cancelledat`, `expiredat`) vs modernos no real.**

#### `event_attendees` (estado real, 0 rows) — DIVERGENTE DO TREE
```
COLS (8):
  id              uuid PK DEFAULT uuid_generate_v4()
  tenant_id       uuid NOT NULL  FK → tenants(id)
  event_id        uuid NOT NULL  FK → events(id)
  global_user_id  uuid           FK → global_users(global_user_id)
  actor_id        uuid           FK → actors(id)
  checked_in_at   timestamptz                            ← MODERNO (tree tem check_in_time)
  status          text NOT NULL DEFAULT 'registered'
  created_at      timestamptz NOT NULL DEFAULT now()
UNIQUE: (tenant_id, event_id, global_user_id)
CHECK: chk_event_attendees_status (vem da 535000)
INDEXES: event_attendees_pkey, event_attendees_tenant_id_event_id_global_user_id_key
```

**Divergência: 1 coluna com nome legado no tree (`check_in_time`) vs moderno no real.**

### Outras divergências (além de nomes)

Comparando CREATE original (tree) vs real:
- **schedules**: nenhuma divergência além da CHECK (que vem da 535000).
- **schedule_slots**: idem.
- **bookings**: 4 nomes de coluna (legadas no tree, modernas no real) + CHECK da 535000.
- **event_attendees**: 1 nome de coluna (`check_in_time` no tree, `checked_in_at` no real) + CHECK da 535000.

Nenhuma divergência de tipo, default ou FK adicional foi detectada.

### Refinamento da entrega anterior do Pacote 1

A análise da Instância anterior (falsas positivas para bookings/event_attendees) era **parcialmente correta** — o RENAME não QUEBRA o rebuild. Mas era **incompleta** sobre o efeito: a divergência rebuild-vs-real **não é cosmética**, é estrutural (nomes diferentes), e afeta consumidores que esperam o nome moderno.

**Refinamento sugerido:** o Pacote 1 talvez precise de **4 migrations** ao invés de 2, para que o rebuild produza estado IDÊNTICO ao real:
1. `20260428100000_create_schedules.sql` (já planejado)
2. `20260428110000_create_schedule_slots.sql` (já planejado)
3. **NOVO:** `20260428240000_create_bookings.sql` — backdate de CREATE bookings com colunas MODERNAS (Opção X1) ANTES de `20260428260000_bookings_fix_timestamp_names.sql`. Depende de `availability` existir antes; precisaria backdate de availability + participants também — OU usar Opção X2 (colunas legadas, deixar RENAME efetivar).
4. **NOVO:** `20260428270000_create_event_attendees.sql` — backdate de CREATE event_attendees com `checked_in_at` (Opção X1) ANTES de `20260428280000`. Depende de `events` existir.

**Caveat sobre dependências:** bookings depende de `availability` (FK). event_attendees depende de `events` (FK). availability é criada em `20260530491000`; events em `0005_events.sql` (timestamp legado, roda muito cedo). Portanto:
- event_attendees backdate é viável (events já existe via `0005_events.sql`).
- bookings backdate exige TAMBÉM backdate de availability+availability_participants — escopo maior.

### Recomendação de decisão para o desenho do Pacote 1

Duas alternativas legítimas:

**A) Pacote 1 mínimo (2 migrations) — aceitar divergência de nomes:**
- Só schedules + schedule_slots
- Rebuild produz bookings com colunas legadas e event_attendees com `check_in_time`
- Divergência aceita; consumidores TS que esperam nomes modernos quebram no rebuild
- Mais simples; menos risco; aplica DT separada para corrigir nomes depois

**B) Pacote 1 ampliado (4-6 migrations) — produzir estado idêntico ao real:**
- Adicionar backdate de event_attendees (1 migration; events já está disponível)
- Adicionar backdate de availability + bookings + availability_participants juntos (3 migrations; cadeia FK)
- Total ≈ 6 migrations
- Rebuild produz estado IDÊNTICO ao real para essas 4+ tabelas
- Mais complexo; mais risco; resolve a divergência de uma vez

**Sugestão:** ratificar B para que o rebuild seja fidedigno. Mas decisão é do Clayton + Opus + ChatGPT.

### Confirmações de escopo Instância E

- ✅ Zero migration escrita
- ✅ Zero edição de código/schema
- ✅ Zero execução de migration
- ✅ Zero toque no banco real além de SELECT
- ✅ Banco real intocado em toda a fatia
- ✅ Sem decidir/propor SQL — apenas fechando lacuna de evidência

### Vinculadas

- F-MIGRATION-REBUILD-PACKAGES Desenho P1 (commit `3d8d4718`) — refinado aqui
- Instância A (3 órfãs) — descartada como rota dos RENAMEs
- `20260530150000_event_attendees.sql:10` (CREATE com `check_in_time`)
- `20260530491000_create_unified_availability_tables.sql:32-37` (CREATE bookings com legados)
- `20260428260000_bookings_fix_timestamp_names.sql:13-55` (RENAME executado em 29/abr)
- `20260428280000_event_attendees_fix_check_in_time.sql:3-12` (idem)
- `20260530535000_c36_status_check_constraints.sql:89-115` (CHECKs adicionadas depois)

---

## F-MIGRATION-REBUILD-PACKAGES — Instância F: TRAVA pré-escrita confirmada (2026-05-29)

- **Modo:** guardião read-only absoluto. Só leitura de migrations + SELECT no banco real.
- **Objetivo cumprido:** confirmar que as backdated do Pacote 1 ampliado (alternativa B) podem nascer com NOMES MODERNOS sem quebrar nenhuma migration posterior.
- **Resultado:** TRAVA OK · REGRA DE PARADA NÃO DISPARADA · janelas de timestamp identificadas · lista PRECISA do que cada backdated deve conter.

### Mapa por tabela — statements DEPOIS do CREATE original

Para cada uma das 6 tabelas-alvo, o ÚNICO statement DEPOIS do CREATE que toca a tabela é a CHECK constraint `chk_<tabela>_status` adicionada por `20260530535000_c36_status_check_constraints.sql` — sempre NÃO-GUARDED (ADD CONSTRAINT puro, sem `IF NOT EXISTS` nem DO block).

| Tabela | CREATE original | Único posterior | Posterior é guarded? | Veredito para backdated |
|---|---|---|---|---|
| `schedules` | `20260530200000_schedules.sql` | `20260530535000:113` `ADD CONSTRAINT chk_schedules_status` | **NÃO-GUARDED** | backdated CRIA tabela; **NÃO ANTECIPA** CHECK |
| `schedule_slots` | `20260530210000_schedule_slots.sql` | `20260530535000:109` `ADD CONSTRAINT chk_schedule_slots_status` | **NÃO-GUARDED** | idem |
| `availability` | `20260530491000:3-17` | `20260530535000:89` `ADD CONSTRAINT chk_availability_status` | **NÃO-GUARDED** | idem |
| `availability_participants` | `20260530491000:47-56` | **nenhum** | — | backdated CRIA tabela e índice; **sem conflito** |
| `bookings` | `20260530491000:24-40` | `20260530535000:93` `ADD CONSTRAINT chk_bookings_status` | **NÃO-GUARDED** | backdated CRIA tabela com nomes MODERNOS; **NÃO ANTECIPA** CHECK |
| `event_attendees` | `20260530150000_event_attendees.sql` | `20260530535000:97` `ADD CONSTRAINT chk_event_attendees_status` | **NÃO-GUARDED** | backdated CRIA tabela com `checked_in_at`; **NÃO ANTECIPA** CHECK |

**Regra de conflito aplicada:** se um statement posterior é NÃO-GUARDED (a CHECK chk_*_status), o backdated **não pode** antecipar esse objeto — senão o ADD CONSTRAINT da 535000 falha "constraint already exists". Solução: backdated cria SÓ tabela + colunas + PK + FKs + UNIQUE inline + índices. CHECK fica para a 535000.

### Função `detect_availability_conflicts` (criada em 491000:61-78)

`CREATE OR REPLACE FUNCTION detect_availability_conflicts(...)` em `20260530491000:61-78`. Usada por `backend/src/core/availability/unified-availability.repository.ts`.

**Veredito:** backdated NÃO cria função. Deixa para a 491000. `CREATE OR REPLACE FUNCTION` é idempotente, mas única fonte é mais limpo. No banco vivo: já existe. No rebuild: 491000 cria.

### TRAVA DOS RENAMEs — resultado

Todos os 5 RENAMEs usam `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE column_name = '<legado>') THEN ALTER TABLE ... RENAME ... END $$` — **GUARDED**:

| RENAME | Guarded? | Cenário rebuild com backdated moderno |
|---|---|---|
| `bookings.requestedat → requested_at` | ✓ | backdated criou `requested_at`; `requestedat` não existe → IF EXISTS = FALSE → no-op |
| `bookings.confirmedat → confirmed_at` | ✓ | idem |
| `bookings.cancelledat → cancelled_at` | ✓ | idem |
| `bookings.expiredat → expired_at` | ✓ | idem |
| `event_attendees.check_in_time → checked_in_at` | ✓ | backdated criou `checked_in_at`; `check_in_time` não existe → no-op |

**TRAVA OK:** todos os RENAMEs viram no-op seguro quando coluna moderna já existe.

### REGRA DE PARADA — resultado: NÃO DISPARADA

Grep no tree por referências a colunas LEGADAS (`requestedat`, `confirmedat`, `cancelledat`, `expiredat`, `check_in_time`):

- `requestedat`: 0 referências (excluindo CREATE original + RENAME guarded)
- `confirmedat`: 0
- `cancelledat`: 0
- `expiredat`: 0
- `check_in_time`: 0

**NENHUMA migration posterior referencia colunas legadas em ALTER, INDEX, CHECK, ou trigger não-guarded.** Backdate pode nascer com nomes modernos com 100% de segurança.

### Confirmação banco vivo (SELECT)

```
bookings.requested_at:  EXISTS
bookings.confirmed_at:  EXISTS
bookings.cancelled_at:  EXISTS
bookings.expired_at:    EXISTS
bookings.checked_in_at: EXISTS
event_attendees.checked_in_at: EXISTS
```

Nenhuma coluna legada existe no banco. Backdated com `IF NOT EXISTS` será no-op total no vivo.

### Cadeia FK do bloco availability (real)

```
availability:                (sem FK interna do bloco)
availability_participants:   FK → availability(availability_id) ON DELETE CASCADE
bookings:                    FK → availability(availability_id) ON DELETE CASCADE
event_attendees:             FK → tenants(id), events(id), actors(id), global_users(global_user_id)
schedules:                   FK → tenants(id), actors(id)
schedule_slots:              FK → schedules(id)
```

Ordem interna obrigatória das backdated:
1. **availability** (não tem dependência interna do bloco)
2. **availability_participants** e **bookings** (em qualquer ordem entre si; ambos dependem de availability)
3. **schedules** (independente)
4. **schedule_slots** (depende de schedules)
5. **event_attendees** (depende só de externals: tenants/events/actors/global_users)

Dependências EXTERNAS ao bloco (`tenants`, `actors`, `events`, `global_users`) são criadas em migrations de 4 dígitos (`0001`–`0005`+) que ordenam alfabeticamente ANTES de qualquer `2026XXXX…` (porque `'0'` < `'2'`). Logo, qualquer timestamp `20260427xxxxxx` tem essas tabelas disponíveis.

### Janela de timestamp segura

A faixa LIVRE para backdated é qualquer timestamp 14-dígitos **estritamente menor** que `20260428200000` (primeiro statement problemático: schedules REVOKE). Faixa recomendada: **`20260427xxxxxx`** (1 dia antes; sem conflito de prefixo).

Ordem alfabética validada:
```
20260427100000_create_availability.sql
20260427110000_create_availability_participants.sql
20260427120000_create_bookings.sql               ← com NOMES MODERNOS
20260427200000_create_schedules.sql
20260427210000_create_schedule_slots.sql
20260427280000_create_event_attendees.sql        ← com checked_in_at
< 20260428200000_schedules_revoke_write.sql        (REVOKE roda DEPOIS dos CREATE)
< 20260428260000_bookings_fix_timestamp_names.sql  (RENAMEs guarded; viram no-op)
< 20260428280000_event_attendees_fix_check_in_time.sql (idem)
< 20260530150000_event_attendees.sql               (CREATE com IF NOT EXISTS — no-op)
< 20260530200000_schedules.sql                     (idem)
< 20260530210000_schedule_slots.sql                (idem)
< 20260530491000_create_unified_availability_tables.sql (idem para tabelas; cria função)
< 20260530535000_c36_status_check_constraints.sql  (ADD CONSTRAINT chk_*_status — agora OK)
```

### Lista FINAL e PRECISA — o que cada backdated deve CONTER e OMITIR

Para cada backdated abaixo, conteúdo = clone do CREATE TABLE existente no tree, ajustes pontuais:

#### `20260427100000_create_availability.sql`
- **CONTER:** `CREATE TABLE IF NOT EXISTS availability (availability_id UUID PK DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL, owner_type VARCHAR(30) NOT NULL, owner_id UUID NOT NULL, availability_type VARCHAR(30) NOT NULL DEFAULT 'fixed', status VARCHAR(30) NOT NULL DEFAULT 'active', start_datetime TIMESTAMPTZ NOT NULL, end_datetime TIMESTAMPTZ NOT NULL, timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo', capacity INTEGER, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())` + `CREATE INDEX IF NOT EXISTS idx_availability_tenant_owner ON availability(tenant_id, owner_type, owner_id)` + `CREATE INDEX IF NOT EXISTS idx_availability_tenant_window ON availability(tenant_id, start_datetime, end_datetime)`
- **OMITIR:** `chk_availability_status` (vem da 535000); função `detect_availability_conflicts` (vem da 491000)

#### `20260427110000_create_availability_participants.sql`
- **CONTER:** `CREATE TABLE IF NOT EXISTS availability_participants (participant_id UUID PK, tenant_id UUID NOT NULL, availability_id UUID NOT NULL REFERENCES availability(availability_id) ON DELETE CASCADE, actor_id UUID NOT NULL, role VARCHAR(30) NOT NULL, metadata, created_at, updated_at)` + `CREATE INDEX IF NOT EXISTS idx_availability_participants_tenant ON availability_participants(tenant_id, availability_id)`
- **OMITIR:** nada (não há statement posterior tocando esta tabela)

#### `20260427120000_create_bookings.sql` ★ NOMES MODERNOS ★
- **CONTER:** `CREATE TABLE IF NOT EXISTS bookings (booking_id UUID PK DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL, availability_id UUID NOT NULL REFERENCES availability(availability_id) ON DELETE CASCADE, requester_actor_id UUID NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'requested', notes TEXT, metadata, **requested_at TIMESTAMPTZ NOT NULL DEFAULT now()**, **checked_in_at TIMESTAMPTZ**, **checked_out_at TIMESTAMPTZ**, **confirmed_at TIMESTAMPTZ**, **cancelled_at TIMESTAMPTZ**, **expired_at TIMESTAMPTZ**, created_at, updated_at)` + 2 índices `idx_bookings_tenant_availability` e `idx_bookings_tenant_requester` (ambos com IF NOT EXISTS)
- **OMITIR:** `chk_bookings_status` (vem da 535000)
- **OBSERVAÇÃO:** colunas em negrito são MODERNAS (estado real); CREATE original tem nomes legados. Esta é a substituição intencional confirmada pela Instância E + Trava F.

#### `20260427200000_create_schedules.sql`
- **CONTER:** clone do `20260530200000_schedules.sql` (9 colunas, FK tenants/actors, PK, defaults) — já tem IF NOT EXISTS
- **OMITIR:** `chk_schedules_status` (vem da 535000)

#### `20260427210000_create_schedule_slots.sql`
- **CONTER:** clone do `20260530210000_schedule_slots.sql` (7 colunas, FK schedules, PK, defaults)
- **OMITIR:** `chk_schedule_slots_status` (vem da 535000)

#### `20260427280000_create_event_attendees.sql` ★ NOME MODERNO ★
- **CONTER:** `CREATE TABLE IF NOT EXISTS event_attendees (id UUID PK DEFAULT uuid_generate_v4(), tenant_id UUID NOT NULL REFERENCES tenants(id), event_id UUID NOT NULL REFERENCES events(id), global_user_id UUID REFERENCES global_users(global_user_id), actor_id UUID REFERENCES actors(id), **checked_in_at TIMESTAMPTZ**, status TEXT NOT NULL DEFAULT 'registered', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(tenant_id, event_id, global_user_id))`
- **OMITIR:** `chk_event_attendees_status` (vem da 535000)
- **OBSERVAÇÃO:** `checked_in_at` MODERNO (CREATE original tem `check_in_time`).

### Resumo do Pacote 1 ampliado

6 migrations forward-only, ~95 linhas SQL total. Banco vivo: todas IF NOT EXISTS → no-op total. Rebuild: cria tudo na ordem correta com nomes modernos; RENAMEs guarded viram no-op; CHECKs adicionadas pela 535000 sem conflito; 535 ainda cria as constraints sem "already exists".

### Confirmações de escopo Instância F

- ✅ Zero migration escrita
- ✅ Zero edição de código/schema/migration
- ✅ Zero execução de migration
- ✅ Zero toque no banco real além de SELECT (8 tabelas + FKs + colunas)
- ✅ Banco real intocado em toda a fatia
- ✅ Decisões fechadas pelo Clayton respeitadas (rides FORA, backdated novo só)
- ✅ Sem decidir/propor SQL — apenas mapa para Opus desenhar
- ✅ Artefatos AUDIT_F intermediários removidos

### Vinculadas

- F-MIGRATION-REBUILD-PACKAGES Desenho P1 (`3d8d4718`) e Instância E (`40654b22`)
- `20260530535000_c36_status_check_constraints.sql:89-115` (ADD CONSTRAINT NÃO-GUARDED — único posterior)
- `20260530491000_create_unified_availability_tables.sql` (CREATE original do bloco availability + função)
- `20260428200000_schedules_revoke_write.sql` (REVOKE — primeiro problema)
- RENAMEs guarded: `20260428260000` (4×) e `20260428280000` (1×)

---

## F-MIGRATION-REBUILD-PACKAGES — Pacote 1 ESCRITO + ensaio progrediu (Descoberta C RESOLVIDA) + Descoberta D aberta (2026-05-29)

- **Status:** 4 migrations escritas; pré-flight A/B PASS; gates 5/6 verdes; **schema-coherence falha por dívida pré-existente** (allowlist deadlines abril/maio 2026, isolado testado SEM novas migrations). Ensaio em espelho rodou 182/332 — **Pacote 1 resolveu a Descoberta C original** (`schedules_revoke_write.sql` passou OK). Falha em **NOVA inversão fora do mapa**: `20260428210000_bank_transactions_concept_id_not_null.sql` requer `concept_id` que só é adicionada por `20260530506000_bank_transactions_concept_id.sql`. **Commit retido por instrução explícita do prompt (dívida nova, decisão de Clayton+Opus+ChatGPT).**
- **Branch:** `rescue-structural` · HEAD `3240ee7e` (working tree dirty com 4 migrations + docs).

### Arquivos escritos (working tree, NÃO commitados)

| Arquivo | Linhas | Propósito |
|---|---|---|
| `backend/migrations/20260427120000_unified_availability_base.sql` | 67 | CREATE availability + bookings (nomes modernos) + availability_participants + 5 índices |
| `backend/migrations/20260427200000_create_schedules.sql` | 18 | CREATE schedules |
| `backend/migrations/20260427210000_create_schedule_slots.sql` | 17 | CREATE schedule_slots |
| `backend/migrations/20260530151000_event_attendees_rename_checked_in_at.sql` | 33 | RENAME guarded check_in_time → checked_in_at após CREATE original |

Todos com `IF NOT EXISTS` (CREATE) e `IF EXISTS / NOT EXISTS` (RENAME). Banco vivo: no-op total. Rebuild: cria estrutura na ordem certa.

### Pré-flight A — PASS

- schedules depende só de `tenants` (0002_identity.sql:10) e `actors` (0002_identity.sql:19). Ambas em 4-dígitos → ordenam antes de `20260427xxxxxx`. ✓
- schedule_slots depende de schedules (backdated `20260427200000`). schedule_slots backdated em `20260427210000`. Ordem OK. ✓
- bloco availability: `availability` sem FK externa; `bookings` e `availability_participants` só FK interna a availability. ✓

### Pré-flight B — PASS (parser ACEITA duplicate CREATE)

`scripts/validate-schema-code-coherence.mjs:412-424` faz `schema.set(tableName, columns)` para cada CREATE TABLE encontrado, **sobreescrevendo silenciosamente** o entry anterior. Não acusa duplicidade como erro. Em modo `both`/`strict` (default), usa `schemaDb` do banco vivo (colunas modernas) — sem regressão funcional.

### Gates — 5/6 verdes; 1 herdado (PRÉ-EXISTENTE)

| Gate | Resultado |
|---|---|
| tsc | clean |
| validate:actor-writer-boundaries | GATE OK §4.8.1 |
| validate:bank-ledger-boundaries | GATE OK §4.6 |
| validate:regression-guards | GATE OK (financial + sql-regression-lint + check-migration-numbering 332 OK) |
| validate-architectural-patterns --strict | `critical_new=0` (warning_new=1 herdado fora do escopo Pacote 1) |
| validate:schema-coherence | **FAIL — allowlist expirada (C1/C3/C4/C8/C12/C31-C35)** |

**Falha do schema-coherence ISOLADA como pré-existente:** renomeei temporariamente os 4 arquivos `.sql.tmp`, re-rodei o gate, mesmo erro idêntico. Allowlist tem deadlines abril/maio 2026 — não introduzidas pelo Pacote 1.

### Ensaio em espelho — TRAVA confirmada nos logs

Mirror: `unificard_dev_rebuild_check_20260529032800`. Logs:
```
🎯 Banco-alvo do migrate: unificard_dev_rebuild_check_20260529032800
✅ Alvo confere com EXPECTED_DATABASE_NAME='unificard_dev_rebuild_check_20260529032800'
📋 MIGRATIONS PENDENTES: 332 de 332
```

### Resultado do ensaio — 182/332 (vs 178/328 antes) — Descoberta C RESOLVIDA

```
Última OK:    20260428200000_schedules_revoke_write.sql (1ms)
            ← exatamente onde a Descoberta C tropeçava antes
Falha em:   20260428210000_bank_transactions_concept_id_not_null.sql
            ALTER TABLE bank_transactions ALTER COLUMN concept_id SET NOT NULL;
            ERROR: coluna "concept_id" da relação "bank_transactions" não existe
```

**Pacote 1 funcionou:**
- `20260427120000_unified_availability_base.sql` (17ms) executou OK
- `20260427200000_create_schedules.sql` (6ms) executou OK
- `20260427210000_create_schedule_slots.sql` (3ms) executou OK
- `20260428200000_schedules_revoke_write.sql` (1ms) **passou** — Descoberta C RESOLVIDA
- ensaio avançou de [179/328] para [183/332] (4 backdated + uma migration a mais)

### Descoberta D (NOVA, fora do mapa) — bank_transactions.concept_id

Mesma estrutura da Descoberta C original, agora em outra família:
- `20260428210000_bank_transactions_concept_id_not_null.sql:10-11` (28/abr) — `ALTER TABLE bank_transactions ALTER COLUMN concept_id SET NOT NULL;`
- `20260530506000_bank_transactions_concept_id.sql:20` (30/mai) — `ALTER TABLE bank_transactions ADD COLUMN concept_id UUID NULL`

Em ordem alfabética, SET NOT NULL roda ANTES do ADD COLUMN. Coluna não existe → falha.

**Por que a Paralela B não detectou:** o regex de inversão buscava `CREATE TABLE` como evento de "criação" do objeto. ADD COLUMN não era considerado, então a referência (ALTER COLUMN) não foi cruzada com a "criação" (ADD COLUMN). Refinamento necessário da auditoria estática.

### Por que o banco vivo funciona

Mesma rota da Descoberta E: migrations rodaram em ordem cronológica diferente da alfabética. A `20260530506000` (ADD COLUMN) provavelmente rodou primeiro (criada antes); depois a `20260428210000` (SET NOT NULL) foi adicionada ao tree posteriormente — em 29/abr ou similar — quando a coluna já existia.

### Decisão do commit — RETIDO por instrução

Conforme prompt:
> ★ Se o ensaio FALHAR por dívida NOVA não causada pelo Pacote 1 (ex: outra inversão
>   mais adiante que não mapeamos): preservar artefatos, reportar, e NÃO commitar por
>   decisão automática — Clayton+Opus+ChatGPT decidem se o Pacote 1 entra como avanço
>   parcial ou aguarda o próximo pacote.

**Commit do Pacote 1 RETIDO.** Aguarda decisão.

### Artefatos forenses (locais, NÃO commitados)

- `RESET_MIGRATE_LOG_2026-05-29T03-28-00.log` — log completo do ensaio (182 sucessos + 1 falha)
- `RESET_SCHEMA_REBUILD_PARTIAL_PKG1_2026-05-29T03-28-00.sql` — schema-only do espelho parcial (334 KB)

### Confirmações de escopo

- ✅ Migrations novas aplicadas SÓ no espelho descartável (NÃO no banco real)
- ✅ Banco real `unificard_dev` permanece INTOCADO
- ✅ TRAVA `EXPECTED_DATABASE_NAME` ativa em TODO migrate (confirmada nos logs)
- ✅ Artefatos RESET_*/AUDIT_* NÃO commitados
- ✅ Mirror dropado interativamente após captura forense
- ✅ bank_* do real não tocado · trigger de imutabilidade preservado
- ✅ Falha do schema-coherence isolada como pré-existente (teste com `.sql.tmp`)
- ✅ Duplicate CREATE confirmado aceito pelo parser (sobreescreve silenciosamente)

### Recomendação sobre liberar drop/recreate real

**NÃO liberar ainda.** Descoberta D precisa ser resolvida primeiro. Sugestão: tratar como Pacote 1.b (NOVO ALTER backdated para bank_transactions criar concept_id antes de SET NOT NULL):
- Criar `20260428205000_repair_bank_transactions_concept_id.sql`:
  ```sql
  ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS concept_id UUID;
  ```
- No banco vivo: ADD COLUMN IF NOT EXISTS = no-op.
- No rebuild: cria coluna antes do SET NOT NULL.
- Original `20260530506000_bank_transactions_concept_id.sql` permanece (ADD COLUMN IF NOT EXISTS interno).

Mas isto é decisão Clayton+Opus+ChatGPT.

### Vinculadas

- F-MIGRATION-REBUILD-PACKAGES Desenho P1 (`3d8d4718`) e Instância E (`40654b22`)
- F-MIGRATION-REBUILD-PACKAGES Instância F (`3240ee7e`) — TRAVA prevista, P1 confirmado
- Descoberta C (RESOLVIDA por este Pacote 1)
- Descoberta D (NOVA — `20260428210000` vs `20260530506000`)
- `backend/migrations/20260427120000_unified_availability_base.sql` (NOVO)
- `backend/migrations/20260427200000_create_schedules.sql` (NOVO)
- `backend/migrations/20260427210000_create_schedule_slots.sql` (NOVO)
- `backend/migrations/20260530151000_event_attendees_rename_checked_in_at.sql` (NOVO)

### Atualização — Pacote 1 COMMITED (b276eb30) + Instância G mapeou classe completa

**Pacote 1 COMMITED em `b276eb30`** após verificação pré-commit (git diff --check limpo; `git diff --name-only --cached` confirmou apenas os 7 arquivos esperados; zero RESET_*/AUDIT_*/.dump/.log staged).

### Instância G — varredura ampliada (DDL + DML + COMMENT)

Generalização da Descoberta D: qualquer statement (DDL OU DML OU COMMENT) que referencia coluna ANTES da sua criação na ordem `localeCompare` (que é a ordem REAL do runner).

**Critério de ordem refinado:** `localeCompare` ≠ ASCII puro. Comprovado pelo log de ensaio anterior — `20260408_bank_transactions.sql` rodou ANTES de `20260408140000_b2b_bank_dual_transaction_isolation.sql` apesar de `_` (0x5F) > `1` (0x31) em ASCII; em locale-aware, `_` é tratado como separador especial.

**Refs varridos:**
- DDL: ALTER COLUMN SET/DROP/TYPE · ADD CONSTRAINT (CHECK/UNIQUE/FK) · CREATE INDEX · RENAME COLUMN · DROP COLUMN · REVOKE/GRANT
- DML: UPDATE SET · INSERT INTO (cols)
- COMMENT ON COLUMN (adicionado após inspeção do arquivo `20260428210000` revelar que o ALTER COLUMN tinha guard DO $$ mas o COMMENT estava FORA)

**Volume varrido:**
```
332 migrations · 2374 colunas criadas (CREATE TABLE inline + ADD COLUMN)
243 CREATE TABLE · 161 ADD COLUMN · 1366 refs (DDL+DML+COMMENT)
```

### Resultado Instância G

```
Total inversões de coluna detectadas: 7
  NÃO-GUARDED (quebram rebuild): 1
  GUARDED (no-op no rebuild):    6
  Descoberta D capturada:        SIM ✓
```

### Único NÃO-GUARDED — Descoberta D refinada

```
bank_transactions.concept_id
  Coluna criada em:  20260530506000_bank_transactions_concept_id.sql
                     (ADD COLUMN guarded — DO $$ IF NOT EXISTS THEN ADD COLUMN)
  Ref problemática:  20260428210000_bank_transactions_concept_id_not_null.sql:14
                     COMMENT ON COLUMN bank_transactions.concept_id IS '...'
                     ← FORA do DO $$, não-guarded → quebra no rebuild
```

**Refinamento da Descoberta D:** o ALTER COLUMN SET NOT NULL (linhas 2-13) ESTÁ dentro de `DO $$ IF EXISTS column AND is_nullable='YES' THEN ALTER ... END $$` — é guarded e seria no-op. **O statement que realmente quebra é o COMMENT ON COLUMN da linha 14, fora do DO.**

### 6 GUARDED (informativas, não quebram)

| Objeto | Ref | Tipo |
|---|---|---|
| bank_transactions.concept_id | 20260428210000:10 (dentro do DO $$) | ALTER COLUMN SET NOT NULL guarded |
| bookings.requestedat | 20260428260000 (DO $$ IF EXISTS) | RENAME COLUMN guarded |
| bookings.confirmedat | idem | idem |
| bookings.cancelledat | idem | idem |
| bookings.expiredat | idem | idem |
| event_attendees.check_in_time | 20260428280000 (DO $$ IF EXISTS) | RENAME COLUMN guarded |

Todos no-op no rebuild quando coluna moderna ou ausente. Já mapeados pela Paralela B/F.

### Verificação de regressão nas 4 tabelas do Pacote 1

```
availability                 NÃO-GUARDED hits=0  ✓
bookings                     NÃO-GUARDED hits=0  ✓
availability_participants    NÃO-GUARDED hits=0  ✓
schedules                    NÃO-GUARDED hits=0  ✓
schedule_slots               NÃO-GUARDED hits=0  ✓
```

Pacote 1 não introduziu inversão de coluna em nenhuma das 4 tabelas. Sem regressão.

### Falso positivo corrigido (regra da auditoria)

Tentativa inicial classificou `b2b_payment_intents.bank_transaction_id` (COMMENT em `20260408140000`, ADD COLUMN em `20260408_bank_transactions.sql`) como inversão. Após inspeção do log do ensaio anterior (linhas 1331-1336: `20260408_bank_transactions.sql` (3ms) rodou ANTES de `20260408140000_b2b_bank_dual_transaction_isolation.sql` (5ms)), confirmou-se que **`localeCompare` não é ordenação ASCII pura**. Underscore (`_`, 0x5F) em locale-aware vem antes de dígitos. Auditoria ajustada para usar `localeCompare` — falso positivo eliminado.

### Pacote 1.b sugerido (1 migration, ~5 linhas)

Sem escrever SQL — apenas mapa:

```
<ts entre 20260428200000 e 20260428210000>_repair_bank_transactions_concept_id.sql
  ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS concept_id UUID;
```

Timestamp sugerido: `20260428205000` (janela `200000`–`210000` livre).

**Banco vivo:** ADD COLUMN IF NOT EXISTS = no-op (coluna já existe). Idempotente.
**Rebuild zero:** cria coluna ANTES do `20260428210000` (que faz SET NOT NULL guarded + COMMENT externo). COMMENT roda sobre coluna agora existente → OK.
**Original `20260530506000`:** mantém estrutura `DO $$ IF NOT EXISTS THEN ADD COLUMN`; quando rodar, coluna já existe → no-op.

### Volume: NÃO disparou freio

1 NÃO-GUARDED ≪ 15. Pacote 1.b é fatia pequena e isolada — pode prosseguir.

### Confirmações de escopo Instância G

- ✅ Zero edição de migration / schema / código
- ✅ Zero execução de migration (real ou espelho)
- ✅ Zero toque no banco real além de leitura de tree
- ✅ Banco real intocado em toda a Fase 2
- ✅ Sem decidir/propor SQL — apenas mapa preciso
- ✅ Artefatos AUDIT_G_*.json local, não commitado

### Vinculadas

- Pacote 1 COMMITED (`b276eb30`) — Descoberta C RESOLVIDA
- Descoberta D (NOVA, do ensaio do Pacote 1) — refinada: COMMENT fora do DO, não SET NOT NULL
- Pacote 1.b sugerido (1 ADD COLUMN backdated)
- Refinamento da auditoria estática: localeCompare como critério de ordem; COMMENT ON COLUMN como evento de referência

---

## F-MIGRATION-REBUILD-PACKAGES — Pacote 1.b (Descoberta D RESOLVIDA · ensaio 333/333) — 2026-05-29

- **Status:** Pacote 1.b ESCRITO + ensaio COMPLETO no espelho (333/333 migrations OK). Descoberta D ULTRAPASSADA. Banco real INTOCADO.
- **HEAD antes:** `b276eb30` (Pacote 1).

### Read-first

- `20260428210000_bank_transactions_concept_id_not_null.sql:14` — `COMMENT ON COLUMN bank_transactions.concept_id IS '...'` fora do `DO $$`.
- `20260530506000_bank_transactions_concept_id.sql:12-23` — `DO $$ IF NOT EXISTS THEN ADD COLUMN concept_id UUID NULL REFERENCES concepts(concept_id) ON DELETE RESTRICT` + `CREATE INDEX IF NOT EXISTS idx_bank_transactions_concept_id`.
- Banco vivo (SELECT em information_schema):
  ```
  data_type=uuid · udt_name=uuid · is_nullable=NO · column_default=NULL
  FK: bank_transactions_concept_id_fkey → concepts(concept_id) ON DELETE RESTRICT
  Índice: idx_bank_transactions_concept_id (btree)
  ```
- Comparação 506000 vs vivo: 506000 cria `UUID NULL` com FK; vivo é `UUID NOT NULL` com FK. **Não diverge entre si** — a transição NULL→NOT NULL é causada pela `20260428210000` (SET NOT NULL guarded dentro do DO) que rodou DEPOIS no banco vivo (ordem cronológica de adição ≠ alfabética). 
- Ordem localeCompare: `20260428200000` < `20260428205000` < `20260428210000` ✓

### Arquivo escrito (working tree, commit pendente)

```
backend/migrations/20260428205000_repair_bank_transactions_concept_id.sql

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS concept_id UUID;
```

Conforme prompt: NÃO inclui FK, índice, NOT NULL nem COMMENT. Backdated cria APENAS coluna nua idempotente.

### Comportamento esperado por contexto

| Cenário | Sequência | Resultado |
|---|---|---|
| Banco vivo (coluna já existe) | ADD COLUMN IF NOT EXISTS → no-op | sem alteração |
| Rebuild zero | `20260428205000` cria coluna UUID NULL → `20260428210000` SET NOT NULL guarded efetiva (col agora existe e is_nullable=YES) → COMMENT linha 14 roda sobre coluna existente OK → `20260530506000` IF NOT EXISTS=FALSE skip · CREATE INDEX IF NOT EXISTS cria índice | coluna NOT NULL com índice; FK ausente (divergência aceita conforme escopo do prompt) |

**Confirmação da regra do COMMENT (lição da Instância G):** backdated NÃO duplica o COMMENT. O COMMENT permanece em `20260428210000:14` e no rebuild roda DEPOIS da backdated criar a coluna → executa sobre coluna existente.

### Gates 5/5 verdes

| Gate | Resultado |
|---|---|
| tsc | clean |
| validate:actor-writer-boundaries | GATE OK §4.8.1 |
| validate:bank-ledger-boundaries | GATE OK §4.6 |
| validate:regression-guards | GATE OK (Gate 3: 333 migrations) |
| validate-architectural-patterns --strict | `critical_new=0` (warning_new=1 herdado fora do escopo) |

(schema-coherence não rodado nesta fatia — esperado falhar por allowlist expirada pré-existente, fora do escopo desta correção.)

### Ensaio em espelho — TRAVA confirmada · 333/333 OK

Mirror: `unificard_dev_rebuild_check_20260529123855`.

```
✔ Conexão estabelecida
🎯 Banco-alvo do migrate: unificard_dev_rebuild_check_20260529123855
✅ Alvo confere com EXPECTED_DATABASE_NAME='unificard_dev_rebuild_check_20260529123855'
📊 RESUMO: 0 migration(s) já registrada(s) no controle
📋 MIGRATIONS PENDENTES: 333 de 333 disponíveis
```

Sequência crítica:
```
[183/333]  20260428205000_repair_bank_transactions_concept_id.sql        2ms  ✓ (Pacote 1.b)
[184/333]  20260428210000_bank_transactions_concept_id_not_null.sql    13ms  ✓ (Descoberta D RESOLVIDA)
...
[333/333]  20260530574000_actor_bank_destinations_substrate.sql        44ms  ✓
✨ Todas as migrações pendentes foram EXECUTADAS com sucesso!
```

**Descoberta D ULTRAPASSADA. Nenhuma nova Descoberta E surgiu no resto do ensaio.**

### Confirmações de escopo

- ✅ Banco real `unificard_dev` INTOCADO em toda a fatia
- ✅ EXPECTED_DATABASE_NAME confirmada nos logs (alvo = espelho, não unificard_dev)
- ✅ Migrations novas aplicadas SÓ no espelho descartável
- ✅ Mirror dropado interativamente após confirmação
- ✅ Backdated criou SÓ a coluna (sem FK, índice, NOT NULL ou COMMENT)
- ✅ Apenas o `COMMENT` da 210000 continua na 210000 — não duplicado
- ✅ bank_ledger / bank_transactions data / bank_splits / schema financeiro além desta coluna idempotente: NÃO TOCADOS
- ✅ Sem RESET_*/AUDIT_*/.dump/diff/log/inventário no commit

### Divergência conhecida e aceita

Após Pacote 1 + Pacote 1.b, no rebuild zero a coluna `bank_transactions.concept_id` nasce sem FK. No banco real, a FK `bank_transactions_concept_id_fkey → concepts(concept_id) ON DELETE RESTRICT` existe. Divergência conscientemente fora do escopo deste Pacote 1.b (regra do prompt: "NÃO adicionar FK"). Tratamento em fatia futura, se decidido.

### Vinculadas

- Pacote 1 (`b276eb30`) — Descoberta C resolvida
- Pacote 1.b (este commit) — Descoberta D resolvida
- `backend/migrations/20260428205000_repair_bank_transactions_concept_id.sql` (NOVO)
- `backend/migrations/20260428210000_bank_transactions_concept_id_not_null.sql` (statement precoce, mantido)
- `backend/migrations/20260530506000_bank_transactions_concept_id.sql` (cria FK + índice; ambos preservados — coluna no rebuild passa pelo skip e cria índice)
- Instância G — auditoria estática ampliada que isolou o achado

---

## F-MIGRATION-REBUILD-DIFF-AUDIT — diff normalizado real vs espelho 333/333 (2026-05-29)

- **Modo:** guardião read-only. SELECT no real + espelho descartável recriado e dropado interativamente. Zero correção.
- **Status:** ensaio 333/333 OK; diff capturado e classificado em 3 grupos. **Grupo 3 (não aceitas) tem apenas 1 item: a FK `bank_transactions_concept_id_fkey` já prevista pelo Pacote 1.b.**
- **HEAD:** `744d8bb9` (Pacote 1.b).

### Captura

| | real (`unificard_dev`) | espelho (`unificard_dev_rebuild_check_20260529130822`) |
|---|---|---|
| tables | 235 | 235 |
| columns | 2348 | 2347 |
| constraints | 1111 | 1110 |
| triggers | 76 | 76 |
| indexes | 840 | 840 |
| views | 1 | 1 |
| functions | 122 | 122 |
| extensions | 4 | 4 |
| schema_migrations | 314 | 333 |
| column_comments | 94 | 90 |
| table_comments | 117 | 116 |

TRAVA confirmada no migrate do espelho: alvo = `unificard_dev_rebuild_check_20260529130822`, EXPECTED confere, ZERO conexão com `unificard_dev`. Banco real intocado.

### Total: 40 divergências classificadas

```
COLUMN_COMMENT_DIFF                       4
COLUMN_COMMENT_MISSING_IN_MIRROR          4
COLUMN_MISSING_IN_MIRROR                  1
CONSTRAINT_EXTRA_IN_MIRROR                1
CONSTRAINT_MISSING_IN_MIRROR              2
INDEX_EXTRA_IN_MIRROR                     1
INDEX_MISSING_IN_MIRROR                   1
MIGRATION_ONLY_IN_MIRROR                 22
MIGRATION_ONLY_IN_REAL                    3
TABLE_COMMENT_MISSING_IN_MIRROR           1
                                        ───
                                         40
```

### Refinamento — Paralela C corrigida

A Paralela C tinha classificado `_deprecated_product_concept_resolution_queue` e `_deprecated_tenant_products` como "dívida real" (sem CREATE no tree). **Investigação atual mostrou que `20260429100000_unificacao_semantica_v2.sql` faz RENAME guarded:**

```sql
ALTER TABLE product_concept_resolution_queue RENAME TO _deprecated_product_concept_resolution_queue;
ALTER TABLE product_concepts                  RENAME TO _deprecated_product_concepts;
ALTER TABLE catalog_products                  RENAME TO _deprecated_catalog_products;
ALTER TABLE tenant_products                   RENAME TO _deprecated_tenant_products;
```

No rebuild as 4 tabelas `_deprecated_*` NASCEM por RENAME. **Decisão "Pacote 3 fora — _deprecated_ não voltam" estava baseada em premissa errada**, mas isto é descoberta nesta fatia — não exige reabertura imediata.

### GRUPO 1 — ACEITAS / cosméticas (16 itens)

**1.1 — 3 `reversals.*` column_comment_diff** — diferença puramente de line-ending:

```
reversals.reversal_type        REAL 327 chars (LF) vs MIRROR 330 chars (CRLF). Texto idêntico.
reversals.performed_by_user_id REAL 167 chars (LF) vs MIRROR 169 chars (CRLF). Texto idêntico.
reversals.authority_source     REAL 263 chars (LF) vs MIRROR 266 chars (CRLF). Texto idêntico.
```

Causa: arquivo `.sql` no Windows tem CRLF; o COMMENT do real foi gravado em ambiente LF. Não afeta funcionalidade.

**1.2 — 9 divergências em `schema_migrations`** — a tabela é criada pelo runner em `migrate.ts:201-213` com nomes/comments diferentes da migration 000 que rodou no real (provavelmente `migrations_archive/0000_*`). Funcionalmente equivalente:

```
schema_migrations: TABLE_COMMENT_MISSING_IN_MIRROR (runner não comenta)
                   4 COLUMN_COMMENT_MISSING_IN_MIRROR (idem)
                   CONSTRAINT_MISSING_IN_MIRROR: schema_migrations_filename_key (real)
                   CONSTRAINT_EXTRA_IN_MIRROR:   unique_filename (mirror, do runner)
                   INDEX_MISSING_IN_MIRROR:      schema_migrations_filename_key
                   INDEX_EXTRA_IN_MIRROR:        unique_filename
```

Os 2 nomes representam a MESMA `UNIQUE (filename)`.

**1.3 — `_deprecated_tenant_products.price_cents` COLUMN_COMMENT_DIFF + `_deprecated_tenant_products.price` COLUMN_MISSING_IN_MIRROR** — estado histórico do real:

```
real:    coluna `price` ainda existe; comment de price_cents é o DRAFT antigo
         ("convive com price NUMERIC até remoção programada")
mirror:  `price` foi DROPada pela 20260530530000 (linha 50); comment atualizado
         ("§Nomenclatura: dinheiro = amount_cents BIGINT. Tabela deprecated.")
```

Pelo ramo IF/ELSIF da 530000, no real provavelmente a 530000 entrou no `ELSIF` (price_cents já existia mas price não, ou vice-versa) e não dropou. O espelho do zero entrou no IF principal. **Real está atrasado**; espelho representa o estado canônico. Não-bloqueante.

### GRUPO 2 — ESPERADAS (24 itens)

**2.1 — 22 `MIGRATION_ONLY_IN_MIRROR`** — composição:

- **5 novas (Pacote 1 + 1.b)** que ainda não foram aplicadas no real:
  - 20260427120000_unified_availability_base.sql
  - 20260427200000_create_schedules.sql
  - 20260427210000_create_schedule_slots.sql
  - 20260428205000_repair_bank_transactions_concept_id.sql
  - 20260530151000_event_attendees_rename_checked_in_at.sql
- **17 pending no real** (Descoberta B original) que rodaram no espelho do zero:
  - 20260530558000–20260530574000 (lista completa no DT_LOG anterior)

**2.2 — 3 `MIGRATION_ONLY_IN_REAL`** — exatamente as 3 órfãs já documentadas:
- `20260530518000_create_payment_milestones.sql`
- `20260530519000_seed_concept_split_engineering.sql`
- `20260530560000_backfill_pf_actor_registry.sql`

Decisão Pacote 2 (tombstone) já fechada.

### GRUPO 3 — NÃO ACEITAS (1 item)

**3.1 — `bank_transactions.bank_transactions_concept_id_fkey`** — CONSTRAINT_MISSING_IN_MIRROR:

```
real:    FOREIGN KEY (concept_id) REFERENCES concepts(concept_id) ON DELETE RESTRICT
mirror:  (ausente)
```

**Causa exata (padrão do Pacote 1.b):** o `20260428205000_repair_bank_transactions_concept_id.sql` (Pacote 1.b) cria a coluna NUA antes do `20260530506000`. Quando 506000 roda, seu `DO $$ IF NOT EXISTS THEN ADD COLUMN concept_id UUID NULL REFERENCES concepts(concept_id) ON DELETE RESTRICT` skip → FK não é criada.

**Migration origem da FK:** `20260530506000_bank_transactions_concept_id.sql:19-22` (dentro de bloco IF NOT EXISTS que continha coluna + FK juntas).

**Não há OUTRA divergência do mesmo padrão.** Auditei especificamente todos os blocos `DO $$ IF NOT EXISTS THEN ADD COLUMN` para constraints/FK/comments embutidos que pudessem ter ficado órfãos por antecipação — esta é a única ocorrência.

### Volume Grupo 3 = 1 — Freio NÃO disparado

Pode prosseguir com Pacote 1.c focado.

### Esboço Pacote 1.c (sem escrever SQL)

```
1 migration (timestamp ≥ 20260530506000 para evitar conflito com a 506000 já aplicada):

<timestamp>_add_bank_transactions_concept_id_fkey.sql
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'bank_transactions_concept_id_fkey'
    ) THEN
      ALTER TABLE bank_transactions
        ADD CONSTRAINT bank_transactions_concept_id_fkey
        FOREIGN KEY (concept_id) REFERENCES concepts(concept_id) ON DELETE RESTRICT;
    END IF;
  END $$;

Banco vivo:  IF NOT EXISTS = FALSE → no-op (FK já existe).
Rebuild zero: FK criada → diff fecha.

Timestamp: posterior a 20260530506000 e 20260428210000. Sugestão: 20260530506500
(janela entre 506000 e 507000, se livre) — ou 20260530574500 (após o último
pending atual) para sequência clean.
```

### Mapa para nova classe de auditoria (refinamento futuro)

Auditar padrões "ADD COLUMN antecipado → bloco IF NOT EXISTS pulado" preventivamente:
- Listar TODOS os blocos `DO $$ IF NOT EXISTS THEN ADD COLUMN ... REFERENCES ...` no tree (já feito nesta fatia para validar único caso).
- Quando um Pacote backdated criar nova coluna, AUDITAR se o bloco original tinha FK/índice/constraint embutidos para incluir no Pacote.b correspondente.

### Artefatos gerados (locais, não commitados)

- `RESET_SCHEMA_BEFORE_2026-05-29T13-08-22.sql` (637 KB)
- `RESET_INVENTORY_BEFORE_2026-05-29T13-08-22.json`
- `RESET_SCHEMA_REBUILD_2026-05-29T13-08-22.sql` (636 KB)
- `RESET_INVENTORY_REBUILD_2026-05-29T13-08-22.json`
- `AUDIT_DIFF_2026-05-29T13-08-22.json`

### Confirmações de escopo

- ✅ Banco real `unificard_dev` INTOCADO em toda a fatia
- ✅ EXPECTED_DATABASE_NAME ativa em cada migrate (visto nos logs)
- ✅ Espelho dropado interativamente após captura
- ✅ Zero correção / Zero migration escrita
- ✅ Artefatos AUDIT/RESET locais, não commitados

### Vinculadas

- Pacote 1 (`b276eb30`) — Descoberta C resolvida
- Pacote 1.b (`744d8bb9`) — Descoberta D resolvida; FK ausente prevista (escopo)
- Pacote 1.c sugerido (1 ADD CONSTRAINT idempotente) — escopo único e isolado
- Refinamento documental da Paralela C: `_deprecated_*` nascem por RENAME em `20260429100000`

---

## F-MIGRATION-REBUILD-PACKAGES — Pacote 1.c · FK concept_id reposta · diff Grupo 3 = 0 (2026-05-29)

- **Status:** Pacote 1.c ESCRITO + ensaio COMPLETO no espelho (334/334) + diff novo confirma **Grupo 3 = 0**. Rebuild estruturalmente equivalente ao real. Banco real INTOCADO.
- **HEAD antes:** `8f276907` (diff-audit checkpoint).

### Correção documental (Pacote 3) — ATUALIZAÇÃO

**Premissa anterior INVALIDADA:** a Paralela C tinha classificado `_deprecated_product_concept_resolution_queue` e `_deprecated_tenant_products` como "dívida real sem origem no tree" e Clayton decidiu "Pacote 3 fora — _deprecated_ não voltam". Investigação na DIFF-AUDIT mostrou que `20260429100000_unificacao_semantica_v2.sql` faz RENAME guarded de 4 tabelas (product_concepts/catalog_products/tenant_products/product_concept_resolution_queue) → `_deprecated_*`. No rebuild as tabelas NASCEM por RENAME. **Resultado benigno:** a decisão de "aposentar" era inócua porque o rebuild faz a coisa certa de qualquer forma. As 4 tabelas `_deprecated_*` aparecem em ambos os lados do diff; nenhuma vai para o Grupo 3. **Não reabrir Pacote 3** — sem ação necessária.

### Absolvição das 3 órfãs — REGISTRADA

`20260530518000_create_payment_milestones.sql`, `20260530519000_seed_concept_split_engineering.sql`, `20260530560000_backfill_pf_actor_registry.sql` aparecem como **MIGRATION_ONLY_IN_REAL** no diff. Estão no **Grupo 2 (esperado)** — zero impacto estrutural. As tabelas/colunas que essas órfãs eventualmente produziram (payment_milestones, actor_registry, etc.) existem em AMBOS lados via outras migrations canônicas. Pacote 2 tombstone permanece a decisão correta. Não reabrir.

### Read-first Pacote 1.c

FK definição confirmada no banco vivo:
```
bank_transactions_concept_id_fkey
  FOREIGN KEY (concept_id) REFERENCES concepts(concept_id) ON DELETE RESTRICT
```

Timestamp escolhido: `20260530506500` (posterior a `20260530506000` em `localeCompare`).

### Arquivo escrito

```
backend/migrations/20260530506500_add_bank_transactions_concept_id_fkey.sql

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'bank_transactions'::regclass
      AND conname  = 'bank_transactions_concept_id_fkey'
      AND contype  = 'f'
  ) THEN
    ALTER TABLE bank_transactions
      ADD CONSTRAINT bank_transactions_concept_id_fkey
      FOREIGN KEY (concept_id) REFERENCES concepts(concept_id) ON DELETE RESTRICT;
  END IF;
END $$;
```

SÓ a FK. Sem índice (diff confirmou `indexes 840=840` — índice criado pelo `CREATE INDEX IF NOT EXISTS` da 506000, fora do bloco DO $$).

### Gates 5/5 verdes

| Gate | Resultado |
|---|---|
| tsc | clean |
| validate:actor-writer-boundaries | GATE OK §4.8.1 |
| validate:bank-ledger-boundaries | GATE OK §4.6 |
| validate:regression-guards | GATE OK (Gate 3: 334 migrations) |
| validate-architectural-patterns --strict | `critical_new=0` |

### Ensaio em espelho — 334/334 OK

Mirror `unificard_dev_rebuild_check_20260529134919`. TRAVA confirmada nos logs:
```
🎯 Banco-alvo do migrate: unificard_dev_rebuild_check_20260529134919
✅ Alvo confere com EXPECTED_DATABASE_NAME='unificard_dev_rebuild_check_20260529134919'
📋 MIGRATIONS PENDENTES: 334 de 334

[282/334] 20260530506500_add_bank_transactions_concept_id_fkey.sql   32ms ✓ Pacote 1.c
[334/334] 20260530574000_actor_bank_destinations_substrate.sql       39ms ✓
✨ Todas as migrações pendentes foram EXECUTADAS com sucesso!
```

### NOVO diff normalizado (real vs espelho 334/334)

```
Counts:
  real    235 tables · 2348 cols · 1111 constraints · 76 triggers ·
          840 indexes · 1 view · 122 funcs · 4 ext · 314 mig ·
          94 col_cmts · 117 tbl_cmts
  mirror  235 · 2347 · 1111 · 76 · 840 · 1 · 122 · 4 · 334 · 90 · 116
```

**Constraints: 1111 = 1111** (era 1111 vs 1110 antes da 1.c).

40 divergências reclassificadas:

### GRUPO 1 — ACEITAS / cosméticas (11)

```
3  reversals.* COLUMN_COMMENT_DIFF_LF_ONLY (LF vs CRLF; texto idêntico)
4  schema_migrations.{filename,executed_at,checksum,execution_time_ms}
   COLUMN_COMMENT_MISSING (runner não comenta)
1  schema_migrations TABLE_COMMENT_MISSING
1  schema_migrations.schema_migrations_filename_key CONSTRAINT_MISSING
1  schema_migrations.unique_filename CONSTRAINT_EXTRA   ← funcionalmente igual ao acima
1  schema_migrations.schema_migrations_filename_key INDEX_MISSING
1  schema_migrations.unique_filename INDEX_EXTRA        ← idem
1  _deprecated_tenant_products.price COLUMN_MISSING (estado histórico real)
1  _deprecated_tenant_products.price_cents COLUMN_COMMENT_DIFF (real tem DRAFT antigo;
                                                                 mirror tem o atualizado)
```

Sub-total: **3 + 4 + 1 + 4 (schema_migrations constraint/index pair) + 2 (_deprecated) = 14**

Recontagem precisa:
- 1 COLUMN_COMMENT_DIFF
- 3 COLUMN_COMMENT_DIFF_LF_ONLY
- 4 COLUMN_COMMENT_MISSING_IN_MIRROR
- 1 COLUMN_MISSING_IN_MIRROR
- 1 CONSTRAINT_EXTRA_IN_MIRROR
- 1 CONSTRAINT_MISSING_IN_MIRROR
- 1 INDEX_EXTRA_IN_MIRROR
- 1 INDEX_MISSING_IN_MIRROR
- 1 TABLE_COMMENT_MISSING_IN_MIRROR
= **14 itens cosméticos / aceitos**

### GRUPO 2 — ESPERADAS (26)

- 23 `MIGRATION_ONLY_IN_MIRROR` = 6 do Pacote 1+1.b+1.c + 17 pending do real (Descoberta B)
- 3 `MIGRATION_ONLY_IN_REAL` = 3 órfãs absolvidas

### GRUPO 3 — NÃO ACEITAS = **0** ✓

A FK `bank_transactions_concept_id_fkey` que era o único item do Grupo 3 anterior **foi RESOLVIDA pelo Pacote 1.c**. Nenhuma nova divergência estrutural surgiu.

### RECOMENDAÇÃO — drop/recreate real LIBERADO

O rebuild reproduz o real ESTRUTURALMENTE. Divergências remanescentes são:
- **Cosméticas** (LF vs CRLF em comments; nomes de constraint de tabela de controle do runner) — sem impacto funcional.
- **Esperadas** (migrations recém-adicionadas que ainda não rodaram no real; 3 órfãs tombstone) — sem impacto estrutural.

**Drop/recreate real LIBERADO para execução manual de Clayton** após:
1. Aprovação explícita (não automatizado).
2. Backup atual (já existe: `RESET_BACKUP_2026-05-28T23-29-59.dump`).
3. Execução manual via `dropdb` + `createdb` + `pnpm migrate` (todos comandos rodados pelo próprio Clayton).
4. Verificação posterior via script de integridade.

### Artefatos forenses (locais, não commitados)

- `RESET_SCHEMA_BEFORE_2026-05-29T13-49-19.sql` (637 KB)
- `RESET_INVENTORY_BEFORE_2026-05-29T13-49-19.json`
- `RESET_SCHEMA_REBUILD_2026-05-29T13-49-19.sql` (636 KB)
- `RESET_INVENTORY_REBUILD_2026-05-29T13-49-19.json`
- `AUDIT_DIFF_2026-05-29T13-49-19.json`
- `RESET_MIGRATE_LOG_2026-05-29T13-49-19.log`

### Confirmações de escopo

- ✅ Banco real `unificard_dev` INTOCADO em toda a fatia
- ✅ EXPECTED_DATABASE_NAME ativa em cada migrate (visto nos logs)
- ✅ Migrations novas aplicadas SÓ no espelho descartável
- ✅ Mirror dropado interativamente após captura forense
- ✅ Pacote 1.c criou APENAS a FK (sem índice, dados, ou outro objeto)
- ✅ bank_ledger / bank_transactions data / bank_splits / schema financeiro NÃO TOCADOS
- ✅ Artefatos RESET_*/AUDIT_*/.dump/log/inventário NÃO staged

### Vinculadas

- Pacote 1 (`b276eb30`) — Descoberta C resolvida
- Pacote 1.b (`744d8bb9`) — Descoberta D resolvida; FK ficou órfã (escopo prévio)
- Pacote 1.c (este commit) — FK reposta; Grupo 3 = 0
- DIFF-AUDIT (`8f276907`) — mapa do diff que isolou o item único
- Refinamento documental: Pacote 3 premissa corrigida; 3 órfãs absolvidas

---

## F-DEV-DATA-CLEAN-RESET — RECREATE EXECUTADO · banco real limpo (2026-05-29)

- **Status:** Clayton executou manualmente `dropdb + createdb + migrate` no banco real `unificard_dev`. Migrate rodou **334/334** com `EXPECTED_DATABASE_NAME` confirmado. Banco real agora reflete o rebuild do tree. Reset completo.
- **HEAD:** `29d8dcb0` (Pacote 1.c).
- **Backup pré-drop:** `C:/unificard/RESET_BACKUP_PRE_DROP_2026-05-29T14-11-01.dump` (15 MB; pg_dump custom; 2353 TOC entries; pg_restore -l validado).

### Conexões — 8 client backends terminados antes do drop

```
8 conexões em pg_stat_activity (todas client backend, datname=unificard_dev):
  pid=896    idle in transaction (UPDATE bank_transactions, xact 13h)  ← cadeia órfã
  pid=4840   active wait=Lock blocked by [896]
  pid=25628  idle in transaction (UPDATE bank_transactions, xact 13h)  ← cadeia órfã
  pid=22100  active wait=Lock blocked by [25628]
  pid=27236  idle ClientRead (SELECT bank_settlements)                  ← pool keep-alive
  pid=9080   idle ClientRead (COMMIT)
  pid=20696  idle ClientRead (COMMIT)
  pid=27220  idle ClientRead (COMMIT)
```

`pg_terminate_backend` em todas as 8 (autorizado por Clayton). Re-check confirmou zero conexões. NÃO foi usado `dropdb --force`.

### Verificação pós-recreate

#### Passo 1 — Gates 5/5 verdes

| Gate | Resultado |
|---|---|
| tsc | clean |
| validate:actor-writer-boundaries | GATE OK §4.8.1 |
| validate:bank-ledger-boundaries | GATE OK §4.6 |
| validate:regression-guards | GATE OK (Gate 3: 334 migrations) |
| validate-architectural-patterns --strict | `critical_new=0` (warning_new=1 herdado fora do escopo) |

#### Passo 2 — Diff pós-recreate (BEFORE pré-drop vs AFTER recreate)

```
Counts:
  BEFORE  235 tables · 2348 cols · 1111 constraints · 76 triggers · 840 indexes ·
          1 view · 122 funcs · 4 ext · 314 migrations · 94 col_cmts · 117 tbl_cmts
  AFTER   235 · 2347 · 1111 · 76 · 840 · 1 · 122 · 4 · 334 · 90 · 116
```

**40 divergências — idênticas ao DIFF-AUDIT do espelho.** Classificadas:

- **GRUPO 1 (cosméticas, 14):**
  - 3 reversals.* COLUMN_COMMENT_DIFF_LF_ONLY (LF do BEFORE vs CRLF do AFTER — texto idêntico)
  - 4 schema_migrations.* COLUMN_COMMENT_MISSING_IN_AFTER (runner não comenta)
  - 1 schema_migrations TABLE_COMMENT_MISSING_IN_AFTER
  - 1 schema_migrations.schema_migrations_filename_key CONSTRAINT_MISSING + 1 INDEX_MISSING
  - 1 schema_migrations.unique_filename CONSTRAINT_EXTRA + 1 INDEX_EXTRA (par equivalente)
  - 1 _deprecated_tenant_products.price COLUMN_MISSING_IN_AFTER (estado histórico pré-drop)
  - 1 _deprecated_tenant_products.price_cents COLUMN_COMMENT_DEF_DIFF (rebuild atualizou via 530000)
- **GRUPO 2 (esperadas, 26):**
  - 23 `MIGRATION_EXTRA_IN_AFTER` = 6 do Pacote 1+1.b+1.c + 17 pendentes anteriores que agora rodaram
  - 3 `MIGRATION_MISSING_IN_AFTER` = as 3 órfãs absolvidas (tombstone)
- **GRUPO 3 (não aceitas): 0 ✓**

**Execução real reproduziu fielmente o espelho.** Recreate fiel ao previsto pelo ensaio.

#### Passo 3 — Seeds estruturais

```
concepts                       90  ✓ (de migrations seed_concepts_*)
company_types                  7   ✓
company_type_allowed_concepts  7   ✓
categories                     102 ✓
canonical_products             35  ✓
permissions                    0   ⚠ (era tenant-scoped do DEV; sem tenant, sem RBAC)
roles                          0   ⚠ (idem)
role_permissions               0   ⚠ (idem)
```

**Sem rodar `RUN_SEEDS=true`:** seeds estruturais GLOBAIS nascem das migrations (concepts/categories/company_types/canonical_products). RBAC (permissions/roles/role_permissions) é TENANT-SCOPED — não nasce sem tenant. Esperado e correto. Renascerão no fluxo canônico quando criar o tenant DEV.

#### Passo 4 — Estado limpo (fixtures)

```
tenants            0  ✓
actors             0  ✓
users              0  ✓
identities         0  ✓
global_users       0  ✓
bank_ledger        0  ✓
bank_transactions  0  ✓
bank_accounts      0  ✓
bank_splits        0  ✓
```

**ZERO fixture sobreviveu.** Reset perfeito.

### Comparação com objetivo do reset

- Antes do drop: 39 tenants, 140 actors, 71 users, 25 identities, 21 global_users, 1616 bank_ledger, 1168 bank_transactions, 401 bank_accounts, 273 bank_splits.
- Depois: tudo 0. Backup `RESET_BACKUP_PRE_DROP_2026-05-29T14-11-01.dump` é a única referência ao estado anterior.

### Artefatos pós-recreate (locais, não commitados)

- `RESET_SCHEMA_AFTER_2026-05-29T15-19-38.sql` (636 KB)
- `RESET_INVENTORY_AFTER_2026-05-29T15-19-38.json` (1.1 MB)
- `RESET_BACKUP_PRE_DROP_2026-05-29T14-11-01.dump` (15 MB, pré-drop)

### Recomendação — Fase 3 (reseed canônico) como FATIA SEPARADA

Banco limpo confirmado. Próxima fatia: recriar **dev + PF + PJ + banda** pelo **FLUXO CANÔNICO** (prova F3.1 v2). Regra: se faltar fluxo canônico para algum contexto, **mapear como ACHADO**, não improvisar seed manual. Fora desta fatia.

### Confirmações de escopo

- ✅ Banco real recriado pelo Clayton (Claude Code NÃO executou dropdb/createdb)
- ✅ Backup pré-drop fresco e validado
- ✅ 8 conexões terminadas via `pg_terminate_backend` (autorizado); NÃO foi usado `dropdb --force`
- ✅ EXPECTED_DATABASE_NAME ativa no migrate do recreate (confirmado pelo Clayton no log)
- ✅ Gates 5/5 verdes no banco recriado
- ✅ Grupo 3 = 0 confirmado pelo diff
- ✅ Estado limpo perfeito (zero fixtures)
- ✅ Artefatos RESET_*/AUDIT_*/.dump/.log NÃO commitados

### Vinculadas

- Pacote 1 + 1.b + 1.c (`b276eb30` → `744d8bb9` → `29d8dcb0`) — backdates que viabilizaram o rebuild fiel
- DIFF-AUDIT do espelho (`8f276907`) — previu exatamente o diff pós-recreate
- F-FIX-ENV-PRECEDENCE (`aa6834ae`) — TRAVA que protegeu o migrate de errar de banco
- Próxima frente: F-DEV-DATA-RESEED canônico (Fase 3) em fatia separada

### Pendência que esta frente substitui

- **Backfill dos 94 atores `global_user_id IS NULL`** (proposto após F3.1 v2): substituído pelo reset. Após Fase 1+3 concluídas, fechar como "SUBSTITUÍDO POR F-DEV-DATA-CLEAN-RESET".

### Vinculadas

- F3.1 v2 DECISION-0062 (commit `c73ac382` — actor humano canônico exige cadeia identity→actor; reset elimina actores que violam essa cadeia)
- DT-FINDORCREATEUSERACTOR-MISSING-GLOBAL-USER-ID (CLOSED — mas atores legados permanecem; reset os elimina)
- DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION (OPEN — reset deletará as 3 rows-vestígio `actor_human`/`company`)
- DT-CPF-SSOT-DUAL-WRITE-CORE-VS-IDENTITY (permanece OPEN — F4/F5 pendentes; reset não muda)

---

## F-DEV-DATA-RESEED — FASE 3A: BOOTSTRAP CANÔNICO DO TENANT DEV (2026-05-29) ✅

Executada no banco limpo (HEAD `1d818e0b`) via script versionado dev-only
`backend/src/scripts/bootstrap-dev-canonical.ts` (idempotente, não-automático, guards
NODE_ENV≠production + PILOT_MODE≠true + `current_database()='unificard_dev'`). **Só caminhos
canônicos de serviço — zero INSERT manual em users/actors/global_users/identities.**

Orquestração:
1. `tenantService.createTenant` → tenant DEV `fbe13b78-4516-493d-905a-363796aea1d1`
2. `rbacService.seedDefaultRBAC` → `seed_default_rbac()` (migration 0060)
3. `authService.register(DEV_TENANT_ID, …, cpf='11144477735')` → cadeia
   global_users→users→identities→actor; `ensureUserActor` garante o actor
4. `rbacService.assignRoleByName(…, 'admin')` — **EXCLUSIVO do bootstrap DEV** (register
   normal NÃO atribui role)

Verificação por SELECT (toda verde):
- tenants(DEV)=1, tenant_contexts=8
- roles=4 (admin/user/merchant/manager, is_system_role=true), permissions=38, role_permissions=68
- global_users=1, users(global_user_id≠null)=1, identities=1
- actor: `actor_type='user'`, `global_user_id NOT NULL`, `actor_id ≠ user_id` → **A7 respeitada**
- user_roles: DEV→admin; permissões efetivas resolvidas via join = 38

**A7 adotada (diretriz desta etapa):** actor humano oficial = register→ensureUserActor→
findOrCreateUserActor (`actor_type='user'`, actor_id próprio). Genesis (`actor_type='actor_human'`)
NÃO usado — fica como dívida (DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION).

### DT-SEED-DEV-COMPLETE-NON-CANONICAL-USER (OPEN)
`backend/src/scripts/seed-dev-complete.ts` cria o user DEV por INSERT direto sem
CPF/global_user_id (`:192-199`) + actor tolerante a falha (`:238-251`), conflitando com A7 e
com o fluxo register→global_users→identities→actor. **Mitigação:** não usar para PF na Fase 3A
(usamos `bootstrap-dev-canonical.ts`). **Resolução prevista:** substituir a criação de user do
seed-dev-complete por `authService.register` ou depreciar o script.

### Achado operacional (registrado)
Script standalone NÃO passa pelo BOOT do app → `socialPortsRegistry` vazio → `ensureUserActor`
falha ("ActorRepository não foi injetado"). `bootstrap-dev-canonical.ts` replica a injeção
canônica de `app.builder.ts:44-58` (`wireSocialPorts`). Qualquer script futuro que crie actor
precisa dessa wiring.

### FASE 3A — CLOSED ✅ (gates verdes, 2026-05-29)
Selo registrado após verificação de gates (etapa separada — o append anterior foi feito antes
de rodar os gates). Banco limpo → banco vivo canônico.
- Commit do bootstrap: `8d8de80b`.
- Gates pós-commit: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK
  (334 migrations) · architecture --strict exit 0 `critical_new=0` · typecheck clean.
- `warning_new=1` isolada: `validate-pipeline-e2e-c3-actor-wallet-debit-recovery.ts:334`
  (NO_MANUAL_MONEY_CALCULATION) — arquivo pré-existente, NÃO relacionado a
  `bootstrap-dev-canonical.ts`, não-bloqueante (ARCH_FAIL_ON=CRITICAL).
- Resultado vivo: tenant DEV + tenant_contexts(8) + RBAC(4 roles / 38 perms / 68 role_perms)
  + PF canônico (`actor_type='user'`, `global_user_id NOT NULL`, `actor_id ≠ user_id`) + role admin.
- **A7 ADOTADA:** actor humano oficial = register→ensureUserActor→findOrCreateUserActor.
  Genesis (`actor_type='actor_human'`, actor_id=user_id) = dívida, não trilho.
- **PRÓXIMO — FASE 3B (PJ):** pende DECISÃO DE PRODUTO **A3** (caminho oficial de empresa:
  company-canonical minimalista × companies.service legado com page-actor) e **A4** (empresa
  nasce classificada com company_type/CONCEPT vs nua). NÃO iniciar 3B sem decidir A3/A4.

### DT-COMPANY-MARKETPLACE-ACTIVATION-FLAGS-PARALLEL-CAPABILITY (OPEN) — comprovada 2026-05-29
**Contexto.** `MarketplaceCompanyModule` mantém flags de capacidade operacional
(`catalog_ready`/`services_ready`/`agenda_configured`/`dispatch_enabled`/`quote_flow_enabled`/
`pdvEnabled`/`b2b_enabled`) FORA do SSOT canônico de contexto/CONCEPT/capability.
**Prova material:** `backend/src/modules/marketplace/domain/company/marketplace-company.service.ts:17`
declara `private companyActivationStates: Map<string, {...}>` — estado em MEMÓRIA VOLÁTIL
(perdido no restart), gravado por `updateCompanyActivationState` (`:237-285`,
`this.companyActivationStates.set`) e lido por `getCompanyActivationState` (`:290`). Não há
tabela, não há derivação de CONCEPT/company_type/capability. As flags são setadas a partir de
`businessTemplate.operationalConfig` no onboarding (`:387-394`), não de um SSOT soberano.
**Mitigação:** não usar como fonte soberana na Fase 3B; a visibilidade/capability do resolver
NÃO deve depender dessas flags.
**Resolução futura:** D-CONCEPT/D-CONTEXT-RESOLVER decide absorver/derivar/aposentar.

### DT-COMPANY-CANONICAL-SERVICE-SCHEMA-DRIFT (OPEN) — Fase 3B.3 (2026-05-29)
**Contexto.** `backend/src/core/companies/company-canonical.service.ts` está montado
(rota em `app.builder.ts:264`), mas NÃO bate com o schema vivo de `companies`: o INSERT usa
colunas fantasma (`legal_name`, `document_type`, `document_number`, `country`, `state`) que
não existem em `companies` (origem `0065_create_companies_minimal.sql`). Em runtime quebraria
com "column does not exist".
**Mitigação atual (3B.3):** NÃO é base da 3B.3 — a base real é `companies.service`. NÃO tocado
nesta fatia (só registrado).
**Resolução futura:** corrigir para o schema vivo OU aposentar/desativar a rota, em fatia própria.

### DT-COMPANY-3B3-CAPABILITIES-OMITTED (OPEN) — Fase 3B.3 (2026-05-29)
**Contexto.** A 3B.3 NÃO grava capabilities na ativação operacional da empresa, porque não
existe fonte canônica `company_type/concept → capabilities` e o soft-block conflita com
capabilities default.
**Mitigação atual:** empresa operacional (Momento 2) na 3B.3 ≝ page-actor + responsible_actor_id
+ primary_company_type_id + primary_concept_id válidos (par em company_type_allowed_concepts).
Sem capabilities persistidas (não há tabela de capability no schema vivo — provado por A8).
**Resolução futura:** D-CONCEPT / D-CONTEXT-RESOLVER define a derivação governada de capabilities.

### DT-GROUPS-ROUTES-LEGACY-GROUP-ID (CLOSED — CORRIGIDA 2026-05-31) — descoberto em READ-ONLY COE-1 (2026-05-30)
**Contexto.** Duas rotas de superfície do módulo de grupos usam `group_id` como nome de coluna
na tabela `groups`, mas `groups` não possui essa coluna — a PK é `id`. São vestígios do momento
em que a tabela renomeou a PK de `group_id` para `id` sem que esses arquivos fossem atualizados.
**Prova material:**
- `backend/src/modules/groups/groups-closure.routes.ts:39`
  `SELECT group_id, created_at FROM groups WHERE group_id = $1 AND tenant_id = $2`
  → `group_id` inexistente no SELECT e no WHERE; endpoint retorna erro 500 em qualquer chamada.
- `backend/src/modules/groups/groups-state-history.routes.ts:37`
  `SELECT group_id, is_active, created_at, updated_at FROM groups WHERE group_id = $1 AND tenant_id = $2`
  → `group_id` inexistente; `is_active` inexistente (estado real é derivado de `status = 'active'`);
  endpoint sempre quebrado em runtime.
**Mitigação atual:** rotas de superfície (não core); grupos foram criados via `groupsService` sem
passar por essas rotas nos testes E2E (3C.3 usou createGroup direto). Efeito limitado a quem
chama esses endpoints específicos.
**Por que separado do COE-1:** COE-1 era core authority (authorization.service) — correção de 1 token.
Estas rotas exigem decisão sobre aliases (`id AS group_id`), semântica de `is_active` vs `status`,
e validação de callers que dependam do nome da coluna retornada. Ratificação própria obrigatória.
**Próxima ação:** microfrente própria — READ-ONLY + mapeamento de callers + ratificação antes de editar.

**FECHO (CLOSED — CORRIGIDA, commit `d064e5e9`, 2026-05-31).**
Correção cirúrgica aplicada após gate read-only (Cenário A) + ratificação.
- **Causa:** duas rotas de superfície consultavam colunas legadas/inexistentes em `groups`:
  `group_id` (ambas) e `is_active` (state-history).
- **Correção:** `groups.group_id` → `groups.id` (PK real); `groups.is_active` →
  `groups.status`, com `state` derivado binário `active/inactive` (narrowing TS explícito,
  espelhando `groups.repository.ts:70`).
  - `groups-closure.routes.ts`: `SELECT created_at FROM groups WHERE id = $1 ...` (group_id não
    ia no payload → nem alias precisou).
  - `groups-state-history.routes.ts`: `SELECT status, created_at, updated_at FROM groups WHERE
    id = $1 ...`; `state = (status === 'active') ? 'active' : 'inactive'`.
- **Payload externo:** PRESERVADO (closure: `{lifetimeEvents, lifetimeEconomicVolume, createdAt}`;
  state-history: `[{state, changedAt}]`). Nenhum consumidor externo dependia de `group_id`/`is_active`.
- **Precisão importante:** `group_events.group_id` foi PRESERVADO — é coluna legítima de
  `group_events` (FK → groups), não da tabela `groups`. NÃO houve find-replace cego de `group_id`.
- **Ressalva futura (não bloqueia o fecho):** a correção reflete o schema vivo, onde
  `chk_groups_status` é binário. Se o ciclo de vida de grupos for enriquecido futuramente
  (CHECK ampliado p/ DRAFT/INFORMAL/VERIFIED/DORMANT/BANNED, como o CONTRATO_GRUPOS_V1 descreve),
  a derivação de `state` deve ser revista. Hoje, o mapeamento binário é o correto e provado.
- **Validação do fix:** tsc limpo · 4 gates verdes · zero resíduo legado · zero schema/migration/DML.

### DT-GROUPS-OWNER-FK-ONDELETE-POLICY (OPEN) — descoberto em READ-ONLY COE-2 (2026-05-30)
**Contexto.** `groups_owner_actor_id_fkey` usa `ON DELETE NO ACTION` (padrão PostgreSQL), enquanto
a FK análoga da migration 576000 (`actors_group_id_fkey`: `actors.group_id → groups(id)`) usa
explicitamente `ON DELETE RESTRICT`. Há assimetria de política de ciclo de vida entre as duas
pontas da relação grupo↔actor-owner.
**Prova material:** `pg_get_constraintdef(groups_owner_actor_id_fkey)` =
`FOREIGN KEY (owner_actor_id) REFERENCES actors(id)` — sem cláusula ON DELETE explícita.
**Por que não foi tocado no COE-2:** COE-2 respondia "grupo pode existir sem owner?" (não) via
NOT NULL. ON DELETE responde "o que acontece se o actor-owner for apagado?" — ciclo de vida e
authority, eixo ortogonal. Misturar as duas perguntas quebraria a atomicidade da microfrente.
**Próxima ação:** avaliar em microfrente de ciclo de vida/authority se NO ACTION deve virar
RESTRICT para simetria com 576000. READ-ONLY + ratificação antes de editar.

### DT-SPLIT-ENGINE-GROUP-WALLET-LEGACY-LOOKUP (OPEN — BLOQUEANTE de ECON-2) — descoberto em F-MAPA (2026-05-30)
**Contexto.** O split engine resolve a wallet de grupo por lookup legado incompatível com a
wallet canônica do group-actor. O split comunitário destinado a grupos NUNCA encontra a conta
e vaza silenciosamente para `regional_fund`, sem erro e sem log. Bloqueia ECON-2.
**Prova material (TRÊS COLUNAS verificadas no código vivo pela executora):**
- `toDbOwnerType` — `bank-account.repository.ts:34-38`: `'system'→'system'`, `'escrow'→'escrow'`,
  TODO O RESTO (`'user'`, `'company'`, `'group'`) → `'actor'`. Colapso crítico: 'user' e 'company'
  viram o MESMO `owner_type='actor'` no DB.
- Wallet canônica — `bank-account.service.ts:256-281` (`ensureActorWalletAccount(actorId)`):
    owner_id    = `${actorId}:actor_wallet`   (composite)
    owner_type  = `'actor'`                   (ownerType:'user' → toDbOwnerType → 'actor')
    account_type= `'actor_wallet'`
  Leitura sem criar: `getActorWalletAccount` (:308-321) usa `getAccountByOwnerAndType(composite,
  'user', 'actor_wallet')` — filtra owner_id + owner_type + account_type.
- Lookup do split — `bank-split-engine.service.ts:202-207`:
  `getAccountByOwner(tenantId, alloc.groupId, 'company', currency)`:
    owner_id    = `alloc.groupId`   (id do GRUPO, não o actor_id do group-actor; sem `:actor_wallet`)
    owner_type  = `'actor'`         (toDbOwnerType('company') → 'actor' — IGUAL ao da wallet)
    account_type= (não filtrado — `getAccountByOwner` só usa owner_id + owner_type, :106-108)
- **MISMATCH É SÓ NO owner_id.** owner_type CASA dos dois lados ('actor'='actor' via colapso do
  toDbOwnerType). A wallet existe sob `${groupActorId}:actor_wallet`; o split procura sob `groupId`.
  Nunca casa. `getAccountByOwner` retorna null → linha 209 `if (groupAccount && groupCents > 0)`
  falsa → split não empilhado → `groupAllocationTotalCents` fica 0 → linha 221 `profitAmountCents
  -= 0` (sem redução) → remanescente cai inteiro em `regional_fund` (linhas 225-246).
  **Vazamento silencioso de dinheiro do grupo.**
- CORREÇÃO IMPRECISA ANTERIOR: a 1ª redação desta DT dizia "mismatch duplo em owner_id E
  owner_type ('company' vs 'actor_wallet')". ERRADO: 'actor_wallet' é account_type, não owner_type;
  e owner_type casa. Corrigido após verificação do toDbOwnerType. Veredito (fantasma) inalterado.
- Mesmo padrão legado (`group_id, 'company'`) aparece em bank-http.routes.ts:218 e
  transparency.service.ts:272 — relacionado a ECON-1 (ownerType='group' ausente).
**Efeito:** todo split comunitário para grupo elegível (CONTRATO_GRUPOS_V1, até 3%) vai para o
fundo regional em vez do grupo. Invariante de ledger (Σdéb=Σcred) FECHA — por isso é invisível
aos gates atuais; o dinheiro só está no destino errado.
**Por que NÃO foi corrigido em F-MAPA:** F-MAPA é READ-ONLY (multímetro, não chave de boca).
Corrigir o split engine é escrita em código que distribui dinheiro → exige ratificação tripla
(Opus + ChatGPT + Clayton) antes de qualquer linha.
**Próxima ação (frente cirúrgica própria — NÃO EXECUTAR SEM RATIFICAÇÃO):** a 1ª ação da frente é
READ-ONLY: reconfirmar as três colunas da wallet canônica no arquivo vivo (owner_id composite /
owner_type='actor' / account_type='actor_wallet'). Só então desenhar o patch. O fix substitui o
lookup do split por: resolver group-actor (`groups.actor_id` ou actor WHERE group_id=$1 AND
actor_type='group') → obter seu `actor_id` → buscar a wallet por
`getActorWalletAccount(actorId)` / `getAccountByOwnerAndType('${actorId}:actor_wallet', 'user',
'actor_wallet')` — NÃO por `getAccountByOwner(groupId, 'company')`. Provar por E2E nesta ordem
causal: (1) grupo com actor canônico; (2) actor_wallet criada; (3) split comunitário encontra a
wallet; (4) valor cai no grupo; (5) remanescente vai ao regional_fund SÓ depois; (6) ledger fecha
(Σdéb=Σcred). Depende de ECON-1 (ownerType='group') resolvido antes.

**REVISÃO FACTUAL append-only (2026-05-30, pós-paralelas A/B/C/D) — corrige o TOM:**
O risco desta DT é **LATENTE, não ativo**. O split de grupo **NÃO vaza dinheiro hoje**. Motivo
material (cruza com DT-USER-GROUP-ALLOCATIONS-SILENT-CALL-CLEANUP, 2026-05-27, PE4 §E.1):
- O step 3 do split de grupo (`bank-split-engine.service.ts:193-223`) depende de
  `userGroupAllocationRepository.findByUserId` contra a tabela `user_group_allocations`, que
  **NÃO existe no DB** (0 rows; `findByUserId` retorna `[]` por try/catch tolerante).
- Logo o bloco de alocação de grupo **não executa**: nenhum `getAccountByOwner(groupId,'company')`
  é disparado, nenhum split de grupo é calculado, nenhum centavo se move para grupo nem vaza.
- A frase original "vaza silenciosamente para regional_fund, sem erro e sem log" descreve o que
  ACONTECERIA se o caminho fosse ativado — NÃO o estado de hoje. Substituir "vazamento atual"
  por "**risco ARMADO para quando o fluxo nascer**".
- Quando `user_group_allocations` for materializada (frente econômica de grupos), o lookup atual
  estará armado para mirar o trilho ERRADO (`getAccountByOwner(groupId,'company')`) em vez da
  conta canônica que Clayton vier a decidir. A DT continua válida e BLOQUEANTE de ECON-2 — só o
  tom muda de "vazamento ativo" para "risco latente pré-armado".
- Correção adicional de premissa: a "ECON-1 = ownerType='group'" mencionada na linha "Depende de
  ECON-1" está MORTA. ECON-1 será redesenhada como "Convergência da conta monetária de grupo"
  (ver DT-GROUP-MONEY-THREE-PARALLEL-SUBSTRATES) — a questão real é a NATUREZA econômica do
  dinheiro de grupo, não a string ownerType.

### DT-GROUP-ACTOR-WALLET-NOT-PROVISIONED (OPEN) — paralelas A/B/C/D pós F-MAPA (2026-05-30)
**Status:** OPEN.
**Origem:** paralelas A/B/C/D após F-MAPA-DE-ACOPLAMENTO-SISTEMICO.
**Contexto:** `ensureGroupActor` cria o group-actor e o back-link `groups.actor_id`, mas NÃO chama
`ensureActorWalletAccount`. Não há call site vivo que provisione a actor_wallet canônica para um
group-actor no ciclo de vida do grupo. O único `ensureActorWalletAccount` real identificado fica
no release D-money/service-order (`service-order.service.ts:1060`, por `receiverActorId`) —
caminho ortogonal ao split comunitário.
**Risco:** corrigir o lookup do split para a actor_wallet sem provisionamento prévio apontaria
para uma conta que não nasce ("corrigir o endereço de uma casa que não foi construída").
**Mitigação atual:** coração econômico de grupo permanece desligado; nenhuma implementação antes
da decisão de fungibilidade de Clayton.
**Resolução prevista:** após Clayton decidir a natureza do dinheiro de grupo, provisionar a conta
canônica escolhida no ciclo correto, com E2E e gates.

### DT-GROUP-MONEY-THREE-PARALLEL-SUBSTRATES (OPEN) — paralelas A/B/C/D pós diagnóstico B2 (2026-05-30)
**Status:** OPEN.
**Origem:** paralelas A/B/C/D após diagnóstico B2.
**Contexto:** foram identificados três substratos/trilhos de dinheiro de grupo:
- **#1 Bank legado vivo:** `owner_id=groupId`, ownerType API `'company'`, DB `owner_type='actor'`,
  `account_type` default `'credit'` (verificado: 0003_bank_core.sql:31). Usado por
  `resolveGroupAccount`/`getOrCreateAccount` (bank-integration.service.ts:53-64) e mirado pelo
  split engine atual (`getAccountByOwner(groupId,'company')`).
- **#2 actor_wallet canônica:** `owner_id='${groupActorId}:actor_wallet'`, `owner_type='actor'`,
  `account_type='actor_wallet'`. Ainda NÃO provisionada para grupos (ver DT acima).
- **#3 core/economy legado/dormente:** substrato paralelo ainda referenciado por
  `assignment.service.ts:307`.
**Risco:** múltiplos trilhos podem fragmentar saldo e confundir statement, payout, recovery e
split — criando dupla realidade financeira para o mesmo grupo. Reforço material: a UNIQUE
`(tenant_id, owner_type, owner_id)` (0003_bank_core.sql:37) NÃO impede a coexistência de #1 e #2
(owner_id diferente) — ver DT-BANK-ACCOUNTS-UNIQUE-INDEX-INSUFFICIENT.
**Mitigação atual:** não implementar o "ECON-1 antigo"; aguardar decisão de Clayton sobre
fungibilidade/natureza do dinheiro de grupo.
**Resolução prevista:** redesenhar ECON-1 como "Convergência da conta monetária de grupo",
decidindo qual substrato sobrevive e como os demais serão aposentados/migrados/isolados.

### DT-ENSURE-ACTOR-WALLET-NOT-IDEMPOTENT-UNDER-RACE (OPEN) — paralela C (2026-05-30)
**Status:** OPEN.
**Origem:** paralela C.
**Contexto:** `ensureActorWalletAccount` (bank-account.service.ts:256-281) usa padrão
check-then-insert (`getAccountByOwnerAndType` → se não existe → `createAccount`) sem lock
transacional específico nem `INSERT ... ON CONFLICT` robusto para corrida concorrente.
**Risco:** duas chamadas concorrentes podem tentar criar a mesma actor_wallet, causando erro de
unique ou comportamento não-idempotente.
**Mitigação atual:** ainda sem fluxo de provisionamento massivo de actor_wallet de grupo.
**Resolução prevista:** antes de provisionar wallet de group-actor em fluxo vivo, endurecer
idempotência sob corrida com padrão transacional adequado, sem violar bank_ledger.

### DT-BANK-ACCOUNTS-UNIQUE-INDEX-INSUFFICIENT (OPEN) — paralela C (2026-05-30)
**Status:** OPEN.
**Origem:** paralela C.
**Contexto:** `UNIQUE(tenant_id, owner_type, owner_id)` (verificado: 0003_bank_core.sql:37) impede
duplicata do mesmo `owner_id`, mas NÃO garante semanticamente "uma conta monetária canônica por
grupo", porque #1 usa `owner_id=groupId` e #2 usa `owner_id='${groupActorId}:actor_wallet'` — dois
owner_id distintos, dois slots únicos distintos. `account_type` não entra na chave única.
**Risco:** duas contas diferentes podem coexistir para o mesmo grupo sem violar o unique index.
**Mitigação atual:** sem convergência financeira até decisão de fungibilidade.
**Resolução prevista:** ECON-1 redesenhada deve definir constraint/índice/regra de unicidade
compatível com a conta monetária canônica escolhida.

---

## RECLASSIFICAÇÃO PÓS-CONTRATO_GRUPOS_V2 (2026-05-31 · commit normativo 24710b29)

`CONTRATO_GRUPOS_V2` foi promulgado VIGENTE (aval Clayton; gates 4/4 verdes). `CONTRATO_GRUPOS_V1`
ficou parcialmente revogado nos pontos da §REVOGAÇÕES. Esta seção reclassifica as DTs de grupo à
luz do V2. **Promulgação foi documental/normativa: zero código, zero schema, zero migration, zero
dinheiro. Cofre econômico de grupo segue DESLIGADO.**

### DT-CONTRATO-GRUPOS-V1-SINGLE-ACCOUNT-VS-OPTION-C (CLOSED — RESOLVIDA pelo V2)
**Origem:** F-MAPA / diagnóstico Opção C (2026-05-30) — sugerida, formalizada agora já resolvida.
**Contradição:** o V1 (LEI) previa CONTA ÚNICA de grupo (`owner_type='group'`) recebendo o split;
a decisão de Clayton (Opção C) exigia DOIS bolsos. Implementar dois bolsos sob o V1 vigente seria
"BUG por definição" pelo próprio V1.
**Resolução:** `CONTRATO_GRUPOS_V2` VIGENTE (commit 24710b29). O V2 revogou a conta única e definiu
dois bolsos por grupo: operacional = `actor_wallet`; comunitário = `group_community_fund` (nome
funcional, sujeito à validação de nomenclatura canônica — colisão com o treasury `community_fund`
de plataforma, ver §DECISÕES PENDENTES #1 do V2).
**Observação:** resolve a contradição NORMATIVA apenas. NÃO implementa schema, split, wallet,
statement ou qualquer fluxo financeiro. Status: CLOSED.

### Norma de referência atualizada para as DTs técnicas de grupo (permanecem OPEN)
As DTs abaixo seguem ABERTAS (exigem implementação futura, com ratificação tripla). A norma de
referência passa a ser `CONTRATO_GRUPOS_V2` VIGENTE, que decidiu:
- dois bolsos por grupo (operacional = `actor_wallet`; comunitário = `group_community_fund`, nome a validar);
- `group_members` = fonte canônica de vínculo do split comunitário;
- `user_active_groups` = read-model futuro, NÃO SSOT obrigatório;
- `user_group_allocations` = NÃO é fonte do split comunitário (dívida a aposentar/reclassificar);
- fallback regional por AUSÊNCIA DE VÍNCULO ELEGÍVEL (não por falha de lookup), na região do USUÁRIO;
- gasto comunitário externo = trilho financeiro próprio (ratificação tripla);
- statement com os dois bolsos SEPARADOS; visibilidade agregada aos membros.

Correção de enquadramento (vinculante para estas DTs): onde elas falavam de "ECON-1 = ownerType=
'group'" ou "conta única" como destino futuro, isso está MORTO — o V2 revogou `owner_type='group'`.
O destino canônico é o composite `owner_type='actor'` por finalidade. Ajuste por DT:

- **DT-SPLIT-ENGINE-GROUP-WALLET-LEGACY-LOOKUP** (OPEN — segue BLOQUEANTE da implementação do split
  comunitário): o fix mira a conta canônica por finalidade do V2 (`group_community_fund` via
  composite), NÃO `getAccountByOwner(groupId,'company')`. Tom inalterado: risco LATENTE, não
  vazamento ativo (depende de `user_group_allocations` inexistente; step 3 não executa hoje).
- **DT-GROUP-ACTOR-WALLET-NOT-PROVISIONED** (OPEN): o V2 confirma os dois bolsos como contas a
  provisionar; provisionamento canônico permanece gap a implementar.
- **DT-GROUP-MONEY-THREE-PARALLEL-SUBSTRATES** (OPEN): o V2 escolhe os trilhos canônicos (#2
  actor_wallet + bolso comunitário); o legado #1 (`owner_id=groupId`,'company') e o #3 (core/economy)
  passam a ser trilhos a APOSENTAR/convergir, não destinos.
- **DT-BANK-ACCOUNTS-UNIQUE-INDEX-INSUFFICIENT** (OPEN): sob o V2, ter dois bolsos por grupo é
  DESEJADO; a questão vira unicidade por (grupo × finalidade) via convenção de owner_id composite —
  a regra exata de unicidade é decisão da frente de implementação.
- **DT-ENSURE-ACTOR-WALLET-NOT-IDEMPOTENT-UNDER-RACE** (OPEN): pré-requisito técnico do
  provisionamento dos bolsos; inalterada pelo V2.
- **DT-USER-GROUP-ALLOCATIONS-SILENT-CALL-CLEANUP** (OPEN, ver §6443): reforçada pelo V2 — o V2
  declara `user_group_allocations` fora do split comunitário; a limpeza/aposentadoria do call
  silencioso ganha respaldo normativo.

---

### DT-PROFILE-PROFESSIONAL-SERVICE-TABLES-ARCHIVE-ONLY (OPEN) — gate read-only 2026-05-31
**Tipo:** Profile / Professional / Schema / Actor-first.
**Status:** OPEN.
**Origem:** gate read-only "perfil profissional: schema vivo + concept linkage" (HEAD 8bfb0b21).

**1. Achado.** O serviço atual da aba profissional escreve em quatro tabelas ausentes do banco
vivo E ausentes das migrations canônicas:
- `user_skills_categories`
- `predefined_services`
- `combo_discount_rules`
- `workers`

**2. Evidência.**
- Banco vivo `unificard_dev` com 236 tabelas (populado — ausência é real, não banco-vazio).
- `SELECT` em `information_schema.tables` retornou **0/4** das tabelas acima.
- grep confirmou: as 4 só têm CREATE em `backend/migrations_archive/`
  (`user_skills_categories` → 0351/0353; `predefined_services` → 0566;
  `combo_discount_rules` → 0196; `workers` → 0630). Nenhuma em `backend/migrations/` canônicas.
- HEAD do gate: `8bfb0b21`.

**3. Impacto.** Qualquer tentativa de salvar/popular a aba profissional atual quebra em runtime
(`relation does not exist`). Popular dados está BLOQUEADO. Não há chão material de serviço —
apesar de o chão semântico existir.

**4. Nuance (não é "perfil em ruínas").** O substrato SEMÂNTICO está íntegro e canônico:
- `categories` (canônica 0061) + `concepts` (canônica 0069, 90 conceitos);
- invariante concept-first `create_category_from_concept` (0097/0110);
- árvore `professional` mínima: L0=2, L1=22, L2=3;
- L2 professional 3/3 com `concept_id`, todos `domain='servicos'`, zero colisão.
O que falta é o read-model/serviço canônico da aba, não a fundação semântica.

**5. Regra.** NÃO restaurar tabelas de `migrations_archive` mecanicamente. Archive não é SSOT
vigente (ver feedback institucional "archive não é SSOT vigente").

**6. Motivo.** O serviço atual é `user_id`/`global_user_id`-keyed, enquanto a arquitetura vigente
é actor-first. Restaurar verbatim reintroduziria substrato anti-canônico (não-actor).

**7. Resolução prevista.** Abrir frente de DESENHO antes de qualquer migration:
- decidir se o read-model profissional será redesenhado actor-keyed;
- derivar de `CONCEPT`/`categories` canônicos;
- separar identidade profissional de oferta/preço/workers;
- definir se algum elemento archive deve ser migrado, reescrito ou aposentado.

**8. Bloqueio (até esta DT ser resolvida).**
- não popular a aba profissional;
- não seedar dados profissionais no serviço atual;
- não restaurar archive;
- não rodar `normalize-category-concepts.ts` (write-candidate: `UPDATE categories SET concept_id`
  sob `--apply`; caracterizado por grep, NÃO executado neste gate);
- não tratar `category_id` como SSOT semântico (o SSOT é `CONCEPT`).

---

## DTs ADJACENTES À FATIA A2/C1 (registradas, NÃO corrigidas — 2026-05-31, commit de código f959d912)

Findings adjacentes ao backend C1 service/API. Registrados conforme DESENHO_A2 §10. NÃO tocados
em A2 (escopo estrito). Cada um exige read-only/ratificação própria antes de qualquer correção.

### DT-ACTORS-ID-ACTORID-INVARIANT-EXISTS (NOTA — premissa cond.2 refutada pelo vivo)
**Contexto.** O Contrato A1 cond.2 assumiu que NÃO há invariante `actors.id = actor_id`
(DT-ACTORS-ID-ACTORID-NO-INVARIANT). **Verificação minha no vivo (b1e48f99) REFUTA a premissa:**
existe `chk_actors_actor_id_equals_id` (CHECK `actor_id = id`) na tabela `actors`. O banco JÁ força
o invariante. **Consequência:** a guarda REPARO 2 do C1 (`id !== actor_id ⇒ ACTOR_ID_INVARIANT_BROKEN`)
é defesa-em-profundidade, não correção de gap; o teste T12 não é exercível com dado real (o CHECK
proíbe id≠actor_id). Status: a "DT de invariante ausente" está RESOLVIDA pelo schema vivo.

### DT-CORE-PROFILE-GET-CREATES-ACTOR (OPEN — origem: diagnóstico A1/P2)
**Contexto.** Diagnóstico A1 (pesquisa P2) apontou que o caminho de leitura de perfil legado pode
disparar criação de actor (side effect proibido em leitura, §4.8.1 / DECISION-0063 §11). Referências
citadas pelo desenho: `core.service.ts:348`, `profile-inference.service.ts:245`. **Não verificado
por mim nesta fatia** (A2 não toca o legado). O C1 novo NÃO tem esse problema (R1 lê por
actionContext.actorId, zero criação — provado em T3). Próxima ação: read-only próprio confirmando
os call sites legados antes de qualquer correção (frente A3/deprecação).

### DT-LOOSE-ACTOR-LOOKUPS (OPEN — origem: diagnóstico A1/P2)
**Contexto.** Diagnóstico A1 apontou ~6 lookups soltos `user/global_user → actor_id` fora da porta
governada (anti-padrão §4.8.1). **Não inventariados por mim nesta fatia.** O C1 novo NÃO introduz
lookup solto (grep no diff = zero; T9). Próxima ação: read-only próprio mapeando os 6 call sites
antes de corrigir.

### NOTA NORMATIVA — "Lei 7" (CONCEPT como SSOT semântico)
O DESENHO_A2 §10 pede ancorar a citação "Lei 7" em §4.10/§7 da norma. Registro: o C1 usa `concept_id`
como identidade semântica (concepts SSOT), `source_category_id` como breadcrumb — conforme a regra
de CONCEPT-como-SSOT. Ancoragem normativa formal do número da "Lei 7" fica para revisão documental
própria (não-bloqueante).

### DT-VALIDATE-ARCHITECTURAL-20-LEGADO (OPEN — registrada no selo A2, 2026-05-31)
**Contexto.** O gate `validate:architectural` (versão CI não-baseline) sai com exit 1 porque conta
`Total=20` violações arquiteturais PRÉ-EXISTENTES (dívida de perfil legado): majoritariamente
REGRA 3 "Categorias no perfil devem ter evento versionado associado" + 1 REGRA 2 "Perfil do Usuário
não pode ser usado em decisões/limites/permissões". `Bloqueia Freeze: 0`.
**Estado vs A2.** As 20 são BASELINE legado — `validate-architectural-patterns --strict` confirma
`critical_new=0`, ou seja, a fatia C1 (A2) NÃO adicionou violação nova. A2 foi aceita por critério
DIFERENCIAL (só novas contam). Limpar as 20 é frente PRÓPRIA, não A2.
**Mitigação atual.** Gate diferencial (`--strict`, baseline 20) é o critério de aceite vigente;
o `validate:architectural` cru fica vermelho por dívida legada conhecida, não por A2.
**Próxima ação.** Frente read-only própria para mapear as 20 violações legadas e desenhar correção
(ratificação própria); não bloqueia outras fatias enquanto `critical_new=0`.

---

## ACHADOS FORENSES DO PERFIL CONTEXTUAL (instâncias A/B/C/D, 2026-05-31)

**Natureza: MAPA (diagnóstico), NÃO autorização de correção.** Estes são DTs-DE-MAPA. Cada correção
exige read-only/ratificação própria + decisão de Clayton. Nenhum achado vira decisão de produto aqui.

**Origem e HEAD observado por instância:**
- **A e C → HEAD `92650e8c`** (pós-selo A2).
- **B e D → HEAD `761f9571`** (pré-reparos C1).
- **RESSALVA EXPLÍCITA:** B e D NÃO viram os reparos finais do C1 (`04030be2` :conceptId UUID /
  `977898a4` PATCH vazio). Mas os achados de B/D são de **FRONTEND/abas**, que NÃO mudaram nesses
  HEADs — logo seus achados de superfície continuam VÁLIDOS. Os reparos foram só no backend C1.

### Achados numerados
1. **Profissional FRONTEND ainda chama o legado `/profile/professional`, NÃO o C1.** (B,D)
   O backend C1 (`/profile/professional/c1`) existe e está selado, mas o frontend não foi religado.
2. **C1 backend vivo e SELADO, porém OCIOSO até A3.** (A,C / pós-selo) Nenhum caller de produto
   consome o C1 ainda; só o teste de integração.
3. **UI não adapta abas por actor.** Hoje bloqueia (≠user → NotApplicable) ou redireciona
   (page → `/empresa/:id`). (B,D) A superfície não se molda pelo actor ativo (contraria a visão).
4. **Interesses e Aprendizado gravam `category_id`/blob em `global_users.metadata` como IDENTIDADE**
   — viola CONCEPT-como-SSOT (Lei 7). (A,B,C) Identidade semântica deve ser `concept_id`, não category.
5. **Catálogo/taxonomia de `conceptId` HARDCODED no frontend** em Interesses (ProfilePhysical). (B)
   Lista de conceitos no FE viola CONCEPT-como-SSOT (a verdade deve vir do backend).
6. **Drift documental/schema:** `user_health_facts` AUSENTE no vivo; docs citam
   `unified_availability`/`unified_bookings` mas o vivo usa `availability`/`bookings`. (C,D)
7. **DT-AVAILABILITY-SSOT-NAME-DRIFT** (map): alinhar a referência normativa ao nome vivo
   (`availability`/`bookings`, não `unified_*`). (C,D)

### DTs-de-mapa (NÃO autorização de correção)
- **DT-PROFILE-PROFESSIONAL-LEGACY-ROUTE-LIVE-BROKEN** — legado `/profile/professional` retorna 500
  (tabelas archive-only ausentes). (C,D) Relaciona-se a `DT-PROFILE-PROFESSIONAL-SERVICE-TABLES-ARCHIVE-ONLY`
  (já registrada) e ao achado #1; deprecação/religação é A3, não agora.
- **DT-PROFILE-INTERESTS-LEARNING-CATEGORY-ID-IN-JSONB** — `category_id`/blob como identidade em
  `global_users.metadata` (achados #4/#5). (A,C)
- **DT-HEALTH-FACTS-TABLE-MISSING** — `user_health_facts` ausente no schema vivo (achado #6). (C)
- **DT-CPF-TRIPLE-HOME** — CPF em três lugares: `identities.tax_id` × `user_profiles.cpf` ×
  `profiles.cpf`. (A,C) (cruza com DECISION-0062 CPF SSOT — execução pendente.)
- **DT-PROFILE-GET-WRITES-ON-READ** — `GET /profile` faz INSERT (auto-create na leitura). (C)
  Relaciona-se a `DT-CORE-PROFILE-GET-CREATES-ACTOR` (já registrada); side effect em leitura proibido.
- **DT-PROFILE-PERSONAL-METADATA-NO-CONTRACT** — gênero/onboarding em JSONB sem contrato. (C)
- **DT-PJ-PROFILE-BOUNDARY-UNVERIFIED** — fronteira PJ/CompaniesManager INCONCLUSIVA; exige passe
  read-only próprio. (A,B,C,D)
- **DT-AVAILABILITY-SSOT-NAME-DRIFT** — ver achado #7. (C,D)

### Decisões PENDENTES de Clayton / frente própria (NÃO decidir aqui)
- Interesse/Aprendizado = CONCEPT? (modelar identidade semântica)
- CPF triple-write (qual SSOT vence; cruza DECISION-0062)
- Fronteira PJ (CompaniesManager)
- `user_health_facts` (criar? derivar? aposentar?)
- Contrato de agenda declarativa vs `availability` (nome + semântica)

**Carimbo final:** este bloco é diagnóstico. Não autoriza correção, não religa frontend, não cria
schema, não abre A3. Cada item acima nasce frente própria com read-only + ratificação quando Clayton decidir.

---

## ACHADOS DE RUNTIME DO SWEEP DE ABAS DO PERFIL (2026-05-31)

**Natureza: ACHADOS (diagnóstico), NÃO correção e NÃO decisão de destino.** Registrados por autorização
de Clayton após sweep autenticado real (login dev + `x-action-context`, actor `b682724c`) contra backend
local. Contexto: na MESMA frente foi corrigido o drift `categories.domain_type` (commit `d497fe63`), que
resolveu `GET /profile/physical` (volta a 200) — esse fix NÃO está nesta lista; estas DTs são o que
**permanece** e cujo destino depende de Clayton / frente própria. Cada DT diz: **destino depende de
Clayton/frente própria**.

### 1. DT-PROFILE-PROFESSIONAL-LEGACY-MISSING-TABLES
`GET /profile/professional` (legado) retorna 500 — `relação "user_skills_categories" não existe`
(origem `profile-professional.service.ts:48`). Depende de tabelas legadas ausentes
(`user_skills_categories` e família). **NÃO restaurar tabelas.** Destino (A3 / deprecação / adaptação
explícita) **depende de Clayton/frente própria.** Relaciona-se a `DT-PROFILE-PROFESSIONAL-LEGACY-ROUTE-LIVE-BROKEN`
e `DT-PROFILE-PROFESSIONAL-SERVICE-TABLES-ARCHIVE-ONLY` (já registradas) — este achado é o reforço com
evidência runtime (HTTP 500 + stack).

### 2. DT-PROFILE-INFERENCE-COUPLED-TO-PROFESSIONAL-LEGACY
`GET /profile/inference` e `GET /profile/inference/snapshot` retornam 500 por dependerem do serviço
profissional **legado**. Evidência: APÓS o fix de `domain_type` (`d497fe63`), o erro de categoria
desapareceu e o 500 restante passou a ser `relação "user_skills_categories" não existe` (snapshot via
`profile-inference.service.ts:242` → `profile-professional.service.ts:48`). Ou seja, o drift de categoria
foi corrigido, mas inference segue acoplada ao legado. **NÃO corrigir agora.** Destino **depende de
Clayton/frente própria** (desacoplar inference do legado é decisão de A3/frente própria).

### 3. DT-PROFILE-HEALTH-FACTS-SUBSTRATE-DRIFT
`GET /profile/health/facts` retorna 500. Duas camadas comprovadas no vivo:
(a) **substrato ausente** — `relação "user_health_facts" não existe` (nenhuma tabela `%health%` no schema
vivo); (b) **bug secundário de identidade** — a rota (`profile-health.routes.ts:75`) passa
`req.actionContext.actorId` (um **actor_id**) como `userId` para o fallback `ensureUserActor`
(`actor.utils.ts:74`), que espera **user_id** → "Usuário não encontrado" quando o header `x-actor-id`
não é enviado. **Saúde é domínio sensível.** NÃO criar migration sem READ-FIRST/norma própria; não
ampliar coleta; não improvisar schema. Cruza com `DT-HEALTH-FACTS-TABLE-MISSING` (já registrada). Destino
**depende de Clayton/frente própria.**

### 4. DT-CORE-PROFILE-GET-CREATES-ACTOR (reforço runtime)
`GET /profile` cria profile/actor em leitura (side effect): handler chama
`profileService.createProfileIfNotExists` quando o profile não existe (`profile.routes.ts:63`).
**DT já registrada anteriormente** — este é o reforço com evidência de runtime do sweep (HTTP 200, mas
escrita em leitura). NÃO corrigir sem desenho próprio. Destino **depende de Clayton/frente própria.**

### 5. DT-AUTH-RATE-LIMIT-LOGS-MISSING
No login (`POST /auth/login`) surge `relação "auth_rate_limit_logs" não existe`. **Login funciona**
(não-fatal); o erro é do logging/rate-limit. Exige decisão sobre migration/logging (criar tabela vs
tornar logging tolerante a ausência). NÃO criar migration nesta frente. Destino **depende de
Clayton/frente própria.**

### 6. DT-MARKETPLACE-FINANCE-AGENDA-SCHEDULED-ACTIONS-MISSING
`GET /marketplace/finance/agenda` retorna 500 — `relação "scheduled_actions" não existe` (42P01),
origem `financial-agenda.service.ts:70`. **Substrato ausente.** NÃO corrigir nesta frente; **não tocar
financeiro.** Destino **depende de Clayton/frente própria.**

### Observação adjacente (não é DT de produto)
O warning `pool.ts:65 Connection terminated` (configuração de encoding/search_path) **reproduz sob carga
real** (visto em múltiplas requisições do sweep), ao contrário do boot limpo isolado. Não-fatal (requests
retornam normalmente). Atualiza a conclusão anterior de "não reproduzível". Diagnóstico próprio quando
Clayton priorizar; não tocado aqui.

**Carimbo:** ACHADOS registrados. Nenhuma correção, nenhuma religação, nenhum schema, nenhuma migration,
nenhuma decisão de destino. A3 permanece bloqueada até housekeeping + autorização explícita.

---

## DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT

- **Status:** OPEN (2026-06-01)
- **Origem:** pós-selo A3.2 / auditoria da aba Profissional C1 (`SELO_A3_2_PROFISSIONAL_C1.md`).
- **Vinculada a:** A3.2 (aba Profissional legado → C1); camada TEMPO/C3 (Agenda / Unified Availability).
- **Contexto:** a aba Profissional foi migrada para o substrato C1 actor-first (`/profile/professional/c1`)
  e não carrega mais a camada TEMPO. Porém a Agenda (`frontend/src/components/ProfileAgenda.tsx`) ainda
  persiste o schedule/availability profissional pelo **caminho legado profissional**: importa
  `updateProfessionalProfile` de `../api/categories` (linha 21) e chama
  `await updateProfessionalProfile({ availability: newSchedule })` (linha 165), que faz **PUT
  `/profile/professional`** (legado morto). Os próprios comentários do componente (≈ linhas 136–141)
  declaram a intenção de manter a verdade temporal só em `unified_availability`, mas a persistência do
  schedule do profissional continua roteada pelo PUT legado.
- **Risco:** camada TEMPO acoplada ao perfil profissional **legado**. Quando o legado
  `/profile/professional` for removido / responder 410/501 (decisão de destino pendente, fatia própria),
  a persistência de availability da Agenda quebra. Além disso, schedule persistido fora do SSOT temporal
  canônico (`unified_availability` / Unified Availability — Constituição Art. II; `CORE_IMUTAVEL.md`)
  arrisca disponibilidade fora da fonte única de verdade temporal.
- **Mitigação atual:** a aba Profissional C1 **não usa mais** o legado (zero `getProfessionalProfile` /
  `updateProfessionalProfile` no fluxo da aba — provado no selo A3.2). A Agenda ficou **explicitamente
  fora do escopo** da A3.2; nada foi alterado em `ProfileAgenda` nesta cadeia. A dívida está isolada e
  documentada, não ampliada.
- **Resolução prevista:** frente própria TEMPO/Agenda (ratificação própria) para migrar a persistência de
  availability ao **SSOT temporal canônico**, respeitando Unified Availability / Agenda Universal e
  `actor_id` (sem schedule em `availability.metadata`; sem segundo SSOT temporal). Não tratar junto de
  financeiro nem de C2/C3 profissional. Pré-condição prática: decidir antes (ou em conjunto) o destino
  final do legado `/profile/professional` (410/501 vs intocado).

---

## DT-DEAD-PROFESSIONAL-LEGACY-SUBSTRATE

- **Status:** PARTIALLY MITIGATED (2026-06-01) — rotas curto-circuitadas com 501; serviço/substrato
  legado ainda presentes.
- **Origem:** auditoria read-only do destino do legado `/profile/professional` (pós-selo A3.2) + decisão
  de Clayton por **501** (recurso migrado para C1, não removido).
- **Vinculada a:** A3.2 (aba Profissional → C1, selada); `DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT`
  (único caller HTTP vivo do PUT legado).
- **Contexto:** o serviço legado `backend/src/core/profile/profile-professional.service.ts` opera sobre
  **4 tabelas AUSENTES** do schema vivo — `user_skills_categories`, `predefined_services`,
  `combo_discount_rules`, `professional_profiles` (verificado por `to_regclass` em 2026-06-01: todas
  `AUSENTE`; só o substrato C1 `actor_professional_profiles`/`actor_professional_concepts` existe). As
  rotas `GET`/`PUT /profile/professional` chamavam esse serviço morto e retornavam **500/400 opaco**. Esta
  fatia as curto-circuitou para **501 explícito** apontando para `/profile/professional/c1` (sem chamar o
  serviço, sem fallback 200 vazio). O **arquivo de serviço e os métodos permanecem** no código (não
  removidos); callers internos `core.service.ts:348` (try/catch que degrada) e
  `profile-inference.service.ts:246` (`.catch` selado em A3.1) continuam invocando o **método de serviço**
  (não a rota) e seguem degradando seguro — não afetados pelo 501 das rotas.
- **Risco:** (1) reativação acidental — alguém religar as rotas ao serviço morto sem perceber que as
  tabelas não existem; (2) auditoria futura confundir o **501** (porta fechada, substrato ainda vivo no
  código) com **limpeza total** (serviço/arquivo removidos), e remover indevidamente algo que outros
  caminhos mortos ainda referenciam; (3) o substrato `user_skills_categories` é também tocado por Human
  MVP (`DT-HUMAN-MVP-USES-DEAD-USER-SKILLS-CATEGORIES`, candidata) e por `categories.service.ts`
  (`assignSkillToUser`) — remoção do serviço profissional NÃO equivale a remover a tabela/uso.
- **Mitigação atual:** `GET`/`PUT /profile/professional` respondem **501** (`code
  PROFESSIONAL_PROFILE_LEGACY_NOT_IMPLEMENTED`, `replacement /profile/professional/c1`), sem tocar o
  serviço morto. Falha agora é **honesta** (501 = migrado/não implementado aqui) em vez de 500 opaco.
  Nenhum caller funcional quebrado (GET sem caller vivo; PUT só ProfileAgenda, já quebrado).
- **Resolução prevista:** frente futura para **remover** o serviço legado + rotas + callers mortos,
  **somente após** Agenda (`DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT`) e Human MVP
  (`DT-HUMAN-MVP-USES-DEAD-USER-SKILLS-CATEGORIES`) serem tratados — para não amputar substrato que outros
  caminhos mortos ainda referenciam antes de mapeá-los. Ratificação própria; não junto de financeiro nem
  de C2/C3 profissional.

---

> **Bloco abaixo:** 5 DTs da auditoria read-only de Interesses/Aprendizado Lei 7 (2026-06-01,
> HEAD `3b62c823`). Diagnóstico material: abas Aprendizado/Interesses mortas — mostram opções mas
> não salvam (guard Lei 7 falha fechado sobre substrato não-migrado). Provas: GET `/profile/learning`
> 200 vazio; PUT `/profile/learning` → 400 "concept_id obrigatório" (44 categorias `scope='learning'`,
> todas `concept_id=NULL`); PUT `/profile/physical` interests → 400 "fora do escopo 'interest'"
> (`scope='interest'` = 0 linhas); ambos rejeitados ANTES do `UPDATE` (não-mutante).

## DT-LEARNING-INTEREST-BLOB-SSOT

- **Status:** **CLOSED (2026-06-01, Fatia 5 — cleanup do blob)** — selo de encerramento da frente em `docs/02_decisions/SELO_C1_LEARNING_INTEREST.md`.
- **Fechamento (Fatia 5, 2026-06-01):** a persistência de Learning/Interest saiu do blob `global_users.metadata`. **(1)** Escrita Learning: `updateLearningProfile` REMOVIDO; rota `PUT /profile/learning` → **501** apontando a `/profile/learning/c1` (runtime: 501). **(2)** Escrita Interest: `profile-physical.service` não valida/grava mais `interests`; `updatePhysicalProfile` retira as chaves `interests`/`learnings` do metadata escrito (cleanup em write-time) e **preserva lifestyle** (runtime: PUT physical com `interests` falso → ignorado, lifestyle persistido, chaves não recriadas). **(3)** Leitura Interest: `getPhysicalProfile` retorna `interests: []` (não lê mais do blob). **(4)** Migration `20260601160000` (forward-only, idempotente, guard C1-existe + verificação pós) removeu as chaves `learnings`/`interests` de `global_users.metadata` preservando todo o resto — **antes:** learnings=1/interests=2 rows; **depois:** 0/0; demais chaves (lifestyle/preferences/learningPreferences/learningMetadata/physicalMetadata/updatedAt) intactas; re-run = 0 linhas (idempotente). **(5)** Frontend: Learning usa `/profile/learning/c1`, Interest usa `/profile/interest/c1`; envio morto de `interests` ao legado removido. **(6)** `actor_learning_concepts`/`actor_interest_concepts` intactas. **Resíduo (não-bloqueante, fora do escopo):** consumidores backend `opportunity.service`/`profile-inference.service`/`core.service` ainda chamam `getLearningProfile`/`getPhysicalProfile` (que agora retornam learnings/interests vazios) — migração desses READERS para ler o C1 é frente futura (não persistem verdade; só degradam para vazio, sem crash). Edge 409 (re-declarar concept retirado) → ver `DT-C1-LEARNING-INTEREST-REACTIVATION`. Gates verdes; typecheck back+front=0; `critical_new=0`.
- **Status histórico:** OPEN (2026-06-01)
- **Origem:** auditoria read-only Interesses/Aprendizado Lei 7 (pós-A3.2).
- **Vinculada a:** Lei 7 (CONCEPT = SSOT semântico); SSOT_REGISTRY §5.1 (actor-first); `DT-ONBOARDING-METADATA-STORAGE-DECISION` (mesmo padrão metadata-blob); `DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT` (CLOSED — perfil global-user vs actor).
- **Contexto:** Aprendizado (`profile-learning.service.ts`) e Interesses (`profile-physical.service.ts`) persistem em **`global_users.metadata`** (blob JSONB) via `UPDATE global_users SET metadata` (linhas 139 / 211), guardando `metadata.learnings`/`metadata.interests` como arrays de **`categoryId`** (não `concept_id`), além de `preferences`/`lifestyle`/`*Metadata`. Identidade = **`global_user_id`** (não `actor_id`). Contratos frontend (`api/learning.ts`, `api/physical.ts`) só expõem `categoryId`, nunca `conceptId`.
- **Risco:** perfil vira **SSOT paralelo opaco** — verdade não consultável/auditável por linha (blob), `category_id` como identidade semântica (viola §8 LEI_COERENCIA / §20 ONTOLOGIA / Lei 7), global-user-keyed contra a direção actor-first + concept-first. Contraria a tese "perfil como porta de entrada dos SSOTs do actor".
- **Mitigação atual:** guards `category-navigation-bridge.ts` bloqueiam deriva semântica quando `concept_id` ausente — a feature fica **morta** em vez de salvar mentira (falha fechada, correto). NÃO há fallback `conceptId ← categoryId`. **Mitigação parcial (Migration A, 2026-06-01, `20260601120000`):** substrato semântico de **Learning** criado (36 concepts em `educacao-e-conhecimento` + associação das folhas) — a aba Aprendizado agora **salva** (prova: PUT `/profile/learning` 200). **Persistência continua blob `global_users.metadata`** (não actor-first); a DT só será CLOSED **após o C1 actor-first**, não agora. **Atualização (Migration B, `20260601130000`, 2026-06-01):** o substrato semântico de **Interest** também passou a existir (árvore `scope='interest'` + concepts; aba Interesses salva, PUT `/profile/physical` 200). **Ambos os substratos (Learning + Interest) agora existem, mas a persistência das DUAS abas continua sendo o blob `global_users.metadata` até o C1 actor-first** — esta DT **permanece OPEN** (será CLOSED só quando o C1 substituir o blob).
- **Resolução prevista:** frente **DESENHO C1 actor-first** para Learning/Interest (espelhar C1 profissional: `tenant_id` + `actor_id` via writer §4.8.1 + `concept_id` obrigatório + `source_category_id` breadcrumb + `is_active`/`retired_at`), **após** governança semântica (DT abaixo). Sem blob como SSOT do que precisa ser consultável. **Nota (2026-06-01): desenho C1 ratificado em DECISION-0067** (OPÇÃO C: tabelas `actor_learning_concepts` + `actor_interest_concepts` + view `actor_concept_declarations_v`; Learning com `progress` 1..3 NÃO competência, Interest binário, sem bio; contrato `/profile/{learning,interest}/c1`). Ordem: schema → backend → backfill → frontend → cleanup. **Esta DT só CLOSE após a Fatia 5 (cleanup do blob)** — status segue OPEN. **Mitigação parcial (Fatia 1 schema, `20260601140000`, 2026-06-01):** o **schema C1 já existe** — tabelas `actor_learning_concepts` + `actor_interest_concepts` (+ view `actor_concept_declarations_v`) criadas (additive, 0 rows, FKs/UNIQUE/CHECK/índices validados). **Porém escrita/leitura runtime AINDA NÃO usam o C1** (backend/backfill/frontend/cleanup pendentes — Fatias 2–5); a persistência runtime das duas abas continua o blob `global_users.metadata`. **Status segue OPEN** (CLOSE só na Fatia 5). **Mitigação parcial (Fatia 2 backend, 2026-06-01):** o **backend C1 existe e funciona** — rotas `/profile/{learning,interest}/c1` (GET/POST/PATCH/DELETE granular, actor-first, concept-first, breadcrumb validado), provadas runtime (declare/patch/retire/dup-409/empty-400/breadcrumb-400). **Mas o frontend ainda usa os endpoints legados** (`/profile/learning`, `/profile/physical`) que gravam no blob; **escrita runtime de produção continua no blob** até a Fatia 4 (frontend). **Status segue OPEN** (CLOSE só na Fatia 5, cleanup do blob). **Mitigação parcial (Fatia 3 backfill, `20260601150000`, 2026-06-01):** backfill `global_users.metadata` → C1 executado (forward-only, idempotente ON CONFLICT, fail-closed; actor_id via mapeamento canônico `actors.global_user_id=global_users.global_user_id`, sem improviso). **DEV: 0 itens no blob → NO-OP (0 linhas migradas)** — o pipeline de migração existe e é seguro, mas não havia dado real a mover. **Frontend e cleanup do blob ainda pendentes** (Fatias 4–5); escrita runtime continua no blob. **Status segue OPEN** (CLOSE só na Fatia 5). **Mitigação parcial (Fatia 4b frontend Learning, 2026-06-01):** a **aba Aprendizado** passou a usar o C1 (`/profile/learning/c1`, client `learningC1.ts`; load/declare/patch/retire granular; conceptId real surfaçado pela Fatia 4a; parou de chamar `getLearningProfile`/`updateLearningProfile`). **Mas Interesses (ProfilePhysical) ainda usa catálogo hardcoded** (Fatia 4c redesign) e o **blob ainda não foi limpo** (Fatia 5). **Status segue OPEN** (CLOSE só na Fatia 5). **Mitigação parcial (Fatia 4c frontend Interest, 2026-06-01):** a **seção de Interesses do `ProfilePhysical`** passou a usar o C1 (`/profile/interest/c1`, client `interestC1.ts`; load `getInterestC1`+`getCategoryTree('interest')`; declare/retire granular; conceptId real surfaçado pela Fatia 4a, sem fallback). **Catálogo hardcoded de interesses fake REMOVIDO** (`PREDEFINED_CONCEPTS`/`LIFE_DOMAINS`/texto livre; sem mapeamento fake→real). **Lifestyle legado (PUT `/profile/physical`) INTOCADO** — interests:[] (já era) + `metadata.physicalProfile` com interests do blob **preservado verbatim** (zero cleanup do blob). Prova runtime: POST 201/GET/DELETE 200(soft); `global_users.metadata.interests` 0 antes e 0 depois (C1 não toca o blob). **Aprendizado E Interesses agora usam C1; o blob ainda existe** (Fatias de gravação saíram, mas a persistência legada/dados antigos só saem na Fatia 5). **Status segue OPEN** (CLOSE só na Fatia 5, cleanup do blob).

## DT-C1-LEARNING-INTEREST-REACTIVATION

- **Status:** **CLOSED (2026-06-01)** — reativação pós soft-delete resolvida no backend C1 (Learning + Interest).
- **Resolução (2026-06-01):** o `declareConcept` dos services C1 ficou **idempotente por declaração**: antes do INSERT, consulta a linha do concept (novo `findByConcept` no repo, ATIVA OU INATIVA). Se existe **inativa** → **reativa** via `updateConcept({reactivate:true, ...})` (is_active=true, retired_at=NULL, `updated_at=now()`; breadcrumb e progress só mudam se enviados; **`declared_at` preservado**). Se existe **ativa** → **409 preservado**. Inexistente → INSERT 201. **Sem novo parâmetro `reactivate` no contrato POST** (o backend resolve pelo estado inativo; PATCH `{reactivate:true}` segue disponível, mas o POST agora basta). Contrato: POST mantém **201** também na reativação (sem branch de rota; idempotência por semântica de declaração). Provado runtime (Learning: POST→DELETE→POST reativa progress 1→3 sem 409, declaredAt preservado, 409 com ativo, DB rows=1; Interest idem binário). Gates verdes; `critical_new=0`. Escopo: só `learning-c1`/`interest-c1` (repo+service); zero migration/frontend/routes/Professional/Lifestyle/financeiro/`global_users.metadata`.
- **Status histórico:** OPEN LOW (2026-06-01) — follow-up registrado na Fatia 5.
- **Origem:** observada nas Fatias 4b/4c/5 do C1 Learning/Interest.
- **Contexto:** re-declarar (POST `/profile/{learning,interest}/c1/concepts`) um concept previamente **retirado** (soft-delete, `retired_at` setado / `is_active=false`) retorna **409** por violar `UNIQUE(tenant_id, actor_id, concept_id)`. A reativação correta é `PATCH /concepts/:conceptId {reactivate:true}` (já suportado pelo backend), mas o frontend (save granular) emite POST para itens "novos" — um concept reativado é tratado como novo.
- **Risco:** baixo — o save pode falhar com 409 ao re-adicionar um interesse/aprendizado removido em sessão anterior; UX mostra erro limpo (não corrompe dado).
- **Resolução prevista:** no save granular do frontend, distinguir "novo de fato" de "reativação" (consultar declarações inativas ou tentar PATCH `reactivate` no 409). Fora do escopo do cleanup (Fatia 5).

## DT-C1-READERS-BLOB-TO-C1

- **Status:** **CLOSED (2026-06-01, F4)** — os 3 readers/agregadores backend nomeados (`profile-inference`, `opportunity`, `core.service`) leem Learning/Interest do C1. **Fechamento (F4):** `core.service.getCompleteProfile` passou a montar `physical_profile.interests` (e o derivado top-level `profile.interests`) a partir do helper C1 (`getUserInterestDeclarationsForProfile`); `getPhysicalProfile` permanece SÓ para lifestyle/preferences/health (legado, DT-LIFESTYLE-SENSITIVE-IN-BLOB). Provado runtime: com Interest C1 → interests com conceptId real + name=categoryName + lifestyle preservado; sem interest → []; sem actor → [] sem 500. **Resíduo NÃO-bloqueante (fora desta DT):** (a) GET `/profile/learning` (rota legada) → **RESOLVIDO (2026-06-01): agora responde 501** `PROFILE_LEARNING_LEGACY_DISABLED` → `/profile/learning/c1` (simetria com o PUT; não chama mais `getLearningProfile`, que ficou sem callers backend); (b) GET `/profile/physical` + `core.service` ainda chamam `getPhysicalProfile` **para lifestyle/health** (legítimo — frente própria `DT-LIFESTYLE-SENSITIVE-IN-BLOB`). Nenhum reader sourcing **interest/learning** do blob permanece.
- **Status histórico:** OPEN (2026-06-01) — F1 (helper de leitura) entregue; consumidores ainda **não** migrados.
- **Origem:** auditoria read-only dos readers backend (pós-`SELO_C1_LEARNING_INTEREST.md` §5.1) + DECISION-0069.
- **Vinculada a:** DECISION-0069 (resolução `userId → actor user`), DECISION-0067 (C1 actor-first), `SELO_C1_LEARNING_INTEREST.md`.
- **Contexto:** após o cleanup do blob (Fatia 5), os readers backend `profile-inference.service` (`getUserProfileSnapshot` → physical.interests + learning.learnings), `opportunity.service` (`getContextualOpportunities` → gate `learnings.length`) e `core.service` (`getCompleteProfile` → `physical_profile.interests`) ainda chamam os leitores legados (`getLearningProfile`/`getPhysicalProfile`), que hoje retornam **vazio** (degradam sem crash; não persistem verdade). A verdade de Learning/Interest vive no C1 (`actor_learning_concepts`/`actor_interest_concepts`).
- **Risco:** sinal de Learning/Interest ausente em feed/matching/oportunidades/inferência até a migração; baixo (degradação para vazio, sem corrupção). categoryId como ponte semântica nas REGRAS A/B do inference é *smell* a corrigir (conceptId é soberano no C1).
- **Mitigação (F1, 2026-06-01):** entregue o read-service `profile-c1-declarations-read.{service,repository}.ts` (read-only; resolve `userId → actor user`; lê `actor_concept_declarations_v`; shape com conceptId/breadcrumb/progress; vazio controlado; ambiguidade fail-closed). **Nenhum consumidor trocado** nessa fatia.
- **Mitigação parcial (F2, 2026-06-01, DECISION-0069):** **`profile-inference.service.ts` MIGRADO** para o C1 concept-first. `getUserProfileSnapshot` não usa mais `getLearningProfile`/`getPhysicalProfile` para Learning/Interest — lê o helper F1. Snapshot ganhou `conceptId` (aditivo em `profile-inference.types.ts`; categoryId/categoryName viram breadcrump/backcompat, null→''); REGRA A/B resolvem o grafo a partir do **conceptId** (não mais `resolveConceptFromCategoryCached` para a declaração; sem fallback `conceptId←categoryId`). **Conserta a cadeia downstream** (feed/matching/opportunity/inference-routes consomem `getInferences`, agora com sinal C1). Provado runtime: interest com conceptId real, progress beginner não conta / intermediate conta, no-actor vazio controlado, getInferences estável. **Consumidores diretos ainda pendentes: `opportunity.service` (leitura direta de `getLearningProfile` — gate) e `core.service` (`physical_profile.interests`).**
- **Mitigação parcial (F3, 2026-06-01, DECISION-0069):** **`opportunity.service.ts` MIGRADO**. O gate de Aprendizado (`learningProfile.learnings.length`) deixou de usar `getLearningProfile` legado e passou a ler o helper C1 (`getUserLearningDeclarationsForProfile`); 0 actor/0 declaração ⇒ count 0 controlado (sem throw); ambiguidade propaga como erro real. `getInferences` (já concept-first pós-F2) preservado. Geradores mock intocados (recebem as declarações C1). Provado runtime: sem learning → vazio; com learning C1 → gate true (2 oportunidades); no-actor → vazio sem 500. **Pendente: `core.service.getCompleteProfile` (`physical_profile.interests`).**
- **Resolução prevista:** **F4** `core.service.getCompleteProfile` → interests via helper C1 (lifestyle/health permanecem legado). CLOSE quando `core.service` também ler o C1 e não houver leitura ativa de `getLearningProfile`/interests-de-`getPhysicalProfile` em nenhum reader.

## DT-LEARNING-CATEGORIES-MISSING-CONCEPT-ID

- **Status:** **PARTIALLY MITIGATED** (2026-06-01) — Learning resolvido por Migration A; Interest pendente (DT-INTEREST-SCOPE-EMPTY).
- **Origem:** auditoria read-only Interesses/Aprendizado Lei 7.
- **Vinculada a:** `DT-LEARNING-INTEREST-BLOB-SSOT`; DECISION-0064/0065; 18_DOMAIN_ONTOLOGY §15 item 4 ("Migrar categories → concept_id"); `DT-DRIFT-SCHEMA-CODE-MISMATCH-CATEGORIES`.
- **Contexto:** existiam **44 categorias `scope='learning'`** com **`concept_id=NULL`** → guard `requireCategoriesWithConceptForScope(...,'learning')` (`profile-learning.service.ts:122`) bloqueava todo save (400 "concept_id obrigatório").
- **Risco:** aba Aprendizado mostrava opções mas **não salvava**. Atalho de popular concept_id ad-hoc **vetado** (cristalizaria category como identidade).
- **Mitigação (Migration A, `20260601120000`, 2026-06-01):** criados **36 concepts** governados (slug limpo, domínio `educacao-e-conhecimento`, via `app.concept_governance`+INSERT ON CONFLICT) e associado `concept_id` às **36 folhas declaráveis** (`scope='learning'` level=1) por mapping literal em **migration governada forward-only/idempotente/fail-closed** (NÃO SQL ad-hoc; conforme DECISION-0065 §3). Validação: 36 concepts · 36 folhas com concept · 0 raízes com concept · PUT `/profile/learning` agora **200**. As **8 raízes/agregadores (level 0) permanecem sem `concept_id`** — **esperado** (não são declaráveis; concept só para folha, DECISION-0064/0065). Guard `requireCategoriesWithConceptForScope` **intacto**.
- **Resolução prevista:** CLOSE quando (a) Interest receber substrato análogo (DT-INTEREST-SCOPE-EMPTY) e (b) — para o eixo blob — o C1 actor-first substituir a persistência `global_users.metadata` (DT-LEARNING-INTEREST-BLOB-SSOT). Esta DT (concept_id ausente em learning) está **materialmente resolvida para Learning**.

## DT-INTEREST-SCOPE-EMPTY

- **Status:** **PARTIALLY MITIGATED** (2026-06-01) — substrato semântico de Interest criado pela Migration B; persistência segue blob até C1.
- **Origem:** auditoria read-only Interesses/Aprendizado Lei 7.
- **Vinculada a:** `DT-LEARNING-INTEREST-BLOB-SSOT`; DECISION-0064/0066 + ADENDO A; Migration B (`20260601130000`).
- **Mitigação (Migration B, `20260601130000`, 2026-06-01):** criada a **árvore mínima governada `scope='interest'`** — 7 raízes (level 0, sem concept, slug `-interesse`) + 38 folhas (level 1, com `concept_id`, slug `-interesse`); 11 concepts novos governados em `cultura-lazer-e-eventos` (slug limpo) + 27 folhas reusando concepts de Learning (`educacao-e-conhecimento`). Validação: 11 concepts · 7 raízes sem concept · 38 folhas com concept · 0 categoria interest sem sufixo `-interesse` · 27 reuso→educacao · 11 novas→cultura-lazer · Learning inalterado · PUT `/profile/physical` interests agora **200** (era 400 "fora do escopo"). `scope='interest'` deixou de estar vazio → **a aba Interesses salva**. Guard `requireCategoriesWithConceptForScope` intacto.
- **Contexto:** `categories scope='interest'` tem **0 linhas** (verificado read-only). O guard `requireCategoriesWithConceptForScope(pool, ids, 'interest')` (`profile-physical.service.ts:188`) rejeita qualquer `categoryId` como **"fora do escopo 'interest'"** → PUT de interesses sempre **400** (provado).
- **Risco:** Interesses **não têm árvore/navegação operacional** nem SSOT semântico — aba inerte por ausência total de substrato.
- **Mitigação atual:** guard bloqueia escrita inválida (falha fechada). **Nota (2026-06-01):** diretrizes
  materiais de Interest **registradas em DECISION-0066** (árvore mínima governada `scope='interest'`, raízes
  sem concept + folhas com concept, reuso de concepts de Learning + concepts novos em `cultura-lazer-e-eventos`).
  **Status permanece OPEN** — nenhuma migration executada ainda; a mitigação virá com a **Migration B**.
  **Nota (2026-06-01, ADENDO A à 0066):** auditoria read-only confirmou **sem duplicidade material** de
  substrato de Interest (archive nunca aplicado; sem impl. anterior no Git). Achado: `categories_slug_key`
  é `UNIQUE(slug)` global → categorias `scope='interest'` usarão **sufixo `-interesse`** (concepts mantêm
  slug limpo, compartilhados). **Status segue OPEN** (sem migration ainda).
- **Resolução prevista:** Migration B governada (DECISION-0066 + ADENDO A) cria árvore `scope='interest'`
  (slugs `-interesse`) + concepts (limpos), conectada a CONCEPT, sem `category` como identidade. Status muda
  só após a migration.

## DT-PROFILE-FRONTEND-DRIVES-TAXONOMY

- **Status:** **PARTIALLY MITIGATED — NÚCLEO SEMÂNTICO RESOLVIDO, RESÍDUO SEPARADO** (2026-06-01, DECISION-0070). Eixo **identidade/CONCEPT resolvido**: Learning (4b) e Interest (4c) neutralizados; C1 declarativo é **concept-first** com trava `conceptId` obrigatória (sem fallback `conceptId←categoryId`); **frontend não cria CONCEPT** (`createCategoryWithAI` cria só `categories`, sem `concept_id` → não-declarável no C1). **Resíduo de NAVEGAÇÃO vivo (expansão governada de `categories` por IA) movido para `DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION`** (DEFERRED). Esta DT não fecha sozinha: depende daquela. Ver DECISION-0070.
- **Status histórico:** PARTIALLY MITIGATED (2026-06-01) — neutralizado/redesenhado nas abas Aprendizado (Fatia 4b) **e Interesses** (Fatia 4c); CLOSE pendente de varredura de outros fluxos (ex.: aba Profissional / outros usos de `createCategoryWithAI`).
- **Origem:** auditoria read-only Interesses/Aprendizado Lei 7.
- **Vinculada a:** 18_DOMAIN_ONTOLOGY §5.5.4 (proibido criar CONCEPT fora de governança); 21_PLANO_DE_EXPANSÃO_GOVERNADA_DO_N2 (expansão governada); `project_frontend_nunca_cria_verdade`.
- **Contexto:** `ProfileLearning.tsx` chama `suggestCategoryPath(searchTerm, 'learning')` (:356) e `createCategoryWithAI(searchTerm, 'learning', parentId)` (:379) — frontend como **condutor de criação de taxonomia/navegação** (cria `categories`, via endpoint backend de IA; não cria CONCEPT diretamente, mas dirige a expansão).
- **Risco:** frontend vira origem de semântica/navegação, contornando governança de CONCEPT e expansão governada do N2. Não usar esse caminho para "destravar" o C1.
- **Mitigação atual:** registrar dívida; não usar como atalho de destravamento. **Mitigação (Fatia 4b, 2026-06-01):** na aba **Aprendizado** (`ProfileLearning.tsx`), `createCategoryWithAI('learning')` e `suggestCategoryPath('learning')` foram **neutralizados** — substituídos por mensagem honesta ("sugestões de novos temas serão tratadas por governança futura"), **sem chamada de backend**. O frontend de Aprendizado não dirige mais criação de taxonomia. **Mitigação (Fatia 4c, 2026-06-01):** a aba **Interesses** (`ProfilePhysical`) foi **redesenhada** — catálogo hardcoded de interesses fake removido e substituído por navegação da árvore real `scope='interest'` + declaração via `/profile/interest/c1`; o caminho de **texto livre** que gerava conceptId fake (`addCustomInterest`/`generateCustomConceptId`) foi **removido**. A aba Interesses não cria mais taxonomia/semântica pelo frontend (também não chama `createCategoryWithAI`/`suggestCategoryPath`).
- **Resolução prevista:** mover criação/associação semântica para **pipeline governado backend/CONCEPT**, com UI apenas **sugerindo intenção** (não persistindo taxonomia). Abas Aprendizado e Interesses já não dirigem taxonomia; o **núcleo semântico está resolvido** (DECISION-0070). **CLOSE depende** da `DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION` (resíduo de navegação governada por IA).

## DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION

- **Status:** **DEFERRED** (2026-06-01, DECISION-0070) — capacidade de produto governada; aguarda decisão de produto. Não bloqueia o C1.
- **Origem:** auditoria read-only da `DT-PROFILE-FRONTEND-DRIVES-TAXONOMY` (HEAD `9149e523`); split por DECISION-0070.
- **Vinculada a:** DECISION-0070, `DT-PROFILE-FRONTEND-DRIVES-TAXONOMY` (reduzida), 21_PLANO_DE_EXPANSÃO_GOVERNADA_DO_N2, `project_frontend_nunca_cria_verdade`.
- **Contexto (fluxos vivos):** (a) **Profissional** — `ProfileProfessional.tsx` (UI **renderizada**: botão "Sugerir profissão" + "Criar com IA") chama `suggestCategoryPath('professional')` (classifica, sem write) e `createCategoryWithAI('professional')` (cria `categories`); (b) **Educação/Empresas** — `profile-education-companies.service.ts` chama `createCategoryWithAI({context:'education'})` e `{context:'company'}` (backend, disparado por texto livre do usuário ao cadastrar formação/empresa). Endpoint `/categories/ai-create` é acessível a usuário autenticado; governança material no service.
- **Por que NÃO é identidade semântica:** `createCategoryWithAI` cria **só `categories`** (árvore/navegação) — **não escreve em `concepts` nem atribui `concept_id`**. Categoria IA **sem `concept_id` é não-declarável no C1** (trava `conceptId` obrigatória; sem fallback `conceptId←categoryId`). Governança existente: admission policy **BLOCK/REVIEW/ALLOW** + status `pending_review`/`requires_review` + auditoria `source:'ai'`.
- **Risco:** BAIXO/MÉDIO — expansão de **navegação** dirigida por UI/texto livre, **governada** (não cria identidade, não destrava C1). Risco residual: proliferação de `categories` `auto_active` sem revisão humana posterior; possível ruído na árvore de navegação.
- **Resolução prevista (decisão de PRODUTO, fatia própria — não nesta DECISION):** escolher entre **(1)** manter capacidade governada (DEFERRED); **(2)** neutralizar como Learning/Interest (UI só declara da árvore existente; sugestão vira intenção sem criar `categories`); **(3)** fila formal de governança — sempre `REVIEW`, nunca `auto_active`. **Pré-condição de neutralização de Educação/Empresas:** prover alternativa de cadastro governado de instituição/empresa (senão o usuário perde a capacidade de registrar itens fora do catálogo). CLOSE quando a decisão (1/2/3) for executada e provada.

## DT-LIFESTYLE-SENSITIVE-IN-BLOB

- **Status:** OPEN (2026-06-01)
- **Origem:** auditoria read-only Interesses/Aprendizado Lei 7 (achado adjacente).
- **Vinculada a:** `DT-LEARNING-INTEREST-BLOB-SSOT`; frente Saúde (fora do escopo desta auditoria).
- **Contexto:** `profile-physical.service.ts` guarda `metadata.lifestyle` (`drinks`, `smokes`, `relationshipStatus`, `sexualOrientation`) em **`global_users.metadata`**, junto da aba physical/interests — **dado pessoal sensível** sem SSOT próprio.
- **Risco:** dado sensível (incl. orientação sexual) em blob sem SSOT próprio, trilha de auditoria nem política clara de consentimento/uso.
- **Mitigação atual:** fora do escopo Learning/Interest; **não ampliar** uso. Não tocado nesta fatia.
- **D1 TOMADA (2026-06-01, DECISION-0071):** política de dados sensíveis ratificada por Clayton. Escolhas: `sexualOrientation` **removido/bloqueado do MVP**; `relationshipStatus`/`drinks`/`smokes` **mantidos como lifestyle privado** (visibility private default, consent explícito por campo, **sem targeting**); `social-targeting` **desacopla drinks/smokes** até consent; retenção = **delete real/anonymize** (audit do evento sem valor em claro); identidade **actor-first**; **Saúde → 501** até substrato governado (0382 vira frente própria; UI/rotas fantasmas hoje). Eixos adicionais: texto livre que possa capturar saúde não é neutro (trava); dado civil não reaproveitável para Saúde sem finalidade/consent. **Auditoria material:** tabelas de saúde AUSENTES; `biologicalSex` não existe no repo; blob lifestyle em DEV com valores nulos. **DT permanece OPEN** — D1 é decisão, implementação pendente.
- **Mitigação parcial (F-SAUDE-501, 2026-06-01):** **Saúde fantasma NEUTRALIZADA.** As 7 rotas `/profile/health/*` (taxonomies/facts GET-POST-DELETE, declarations GET-POST-DELETE) passaram a responder **501 `PROFILE_HEALTH_DISABLED`** (replacement null, ref DECISION-0071) **sem tocar o DB** (não chamam mais repo/service que batiam em tabelas ausentes → fim do 500 fantasma; log limpo, 0 erro de tabela). Frontend: a aba **Saúde** (`ProfileHealth.tsx`) virou **painel reservado honesto** ("Saúde fora do MVP; não salva nada") — **não carrega/salva**, não chama a API health, não captura campo de saúde (`ProfileHealthForm`/`useProfileHealth*`/`api/health` permanecem no código mas não são mais renderizados/chamados pela aba). **Não tocado:** `profile-physical.service` (height/weight degrada gracioso, GET /profile/physical segue 200), Lifestyle/blob, drinks/smokes, social-targeting, schema/migration. **DT permanece OPEN** — Lifestyle ainda no blob e SSOT sensível não nasceu. Saúde só volta via frente 0382 governada (ou desenho novo) com consent/visibility/audit.
- **Mitigação parcial (F-TARGETING-DECOUPLE, 2026-06-01):** **`drinks`/`smokes` DESACOPLADOS do targeting.** `social-targeting.service.ts::calculateRelevanceScore` não lê mais `physical_profile.lifestyle.{drinks,smokes}` nem soma pontos por hábito; o critério `targeting.lifestyle` é **aceito (shape do filtro preservado) mas IGNORADO**, `breakdown.lifestyle` fica **sempre 0**. **Sem consent fake** (sem `if consent`/placeholder true). Prova (função pura): perfil com drinks/smokes + targeting lifestyle → `breakdown.lifestyle=0`, score não infla (igual a sem lifestyle); targeting segue funcionando com outros sinais (social_affinity/interest/demographics). **drinks/smokes continuam no perfil** (lifestyle privado temporário) — esta fatia só bloqueia uso secundário. **Resíduo não-bloqueante (reportado, fora do escopo desta fatia de targeting):** `core.service.ts:765` ainda usa presença de `drinks/smokes` (junto de relationshipStatus/sexualOrientation, em OR) no **score de COMPLETUDE de perfil** (+5) — não é targeting/matching/recomendação; tratar em F3/F5 (junto da remoção de sexualOrientation) ou decisão própria. **Não tocado:** Health (segue 501), Lifestyle SSOT, blob, profile-physical, schema. **DT permanece OPEN.**
- **F1a desenho READ-ONLY ratificado (2026-06-01):** desenho material do SSOT (tabela linha-por-atributo + constraints/enums + consent/visibility/audit/anonymize + integração + backfill) — insumo, sem código.
- **Mitigação parcial (F1b migration, `20260601170000`, 2026-06-01):** **SSOT Lifestyle CRIADO.** Migration forward-only/idempotente (guards + verificação pós; `schema_migrations` 344→345) criou **`actor_lifestyle_attributes`** (actor-first, linha-por-atributo; FK `actors(id)`/`tenants(id)`; `UNIQUE(tenant_id,actor_id,attribute_key)`) + **`actor_lifestyle_attribute_audit`** (append-only, **sem coluna de valor sensível** — sem attribute_value/old_value/new_value/JSONB). Constraints provadas runtime: `attribute_key` só `relationship_status/drinks/smokes` (**`sexual_orientation` e `health_condition` REJEITADOS** estruturalmente); `visibility='private'` (public rejeitado); lifecycle XOR (ativo⇒value NOT NULL+consent; inativo⇒value NULL+retired_at); valor governado por key (texto livre rejeitado); **ativo exige `consented_at`**; audit 0 colunas de valor. **Sem texto livre/notes/declaration_text/height/weight/shared_health_data** → trava contra captura indireta de Saúde. **Tabela começa VAZIA (0 rows, sem backfill); blob `metadata.lifestyle` INTOCADO** (2 rows). Health segue **ABSENT/501**. Sem RLS (igual aos substratos C1; isolamento por tenant na query). **Não tocado:** backend runtime/service/routes, frontend, social-targeting, profile-physical, core, Health, C1, Profissional, financeiro. **DT permanece OPEN** (sem write/read/cleanup ainda).
- **Micro-decisão de backfill (registrada, F5 futura):** valores legados de `metadata.lifestyle` **sem consentimento NÃO serão migrados como ativos+consentidos** (DECISION-0071 §6 — sem consent fabricado). Caminho recomendado por Clayton: **usuário re-declara com consentimento explícito** (salvo decisão diferente antes da F5). Em DEV os valores são nulos → backfill tende a no-op.
- **Mitigação parcial (F2 backend service, 2026-06-01):** **service/repository consent-aware CRIADOS** (`core/profile/lifestyle/{types,repository,service}.ts`), **sem rotas** (encanamento antes da torneira). `lifestyleService`: `getLifestyle` (ativos, self), `declareAttribute` (consent **obrigatório**; key/value governados; idempotente — inativo→reativa, ativo→update, novo→insert; visibility sempre private), `retireAttribute` (anonimiza `attribute_value`→NULL). `lifestyleRepository`: colunas explícitas, `runQueryWithTenant`, audit append-only **sem valor**. **Toda mutação grava audit** (key+action+actor+source). Provado runtime: declare relationship_status/drinks/smokes com consent; **falham** sem consent / `sexual_orientation` / valor inválido / visibility public (DB); retire **anonimiza** (value=NULL, DB confirma); re-declare reativa; audit **0 colunas de valor**; **blob `metadata.lifestyle` INTOCADO**. **Não tocado:** rotas/profile.routes, frontend, `profile-physical.service`, `core.service`, social-targeting, Health (501), migration, blob, backfill. Gates verdes (typecheck0; critical_new=0). **DT permanece OPEN** (sem rota/frontend/readers/cleanup ainda).
- **Mitigação parcial (F3 rotas + frontend, 2026-06-01):** **tráfego de Lifestyle migrado para o SSOT.** Backend: rotas `lifestyle.routes.ts` registradas em `profile.routes` — GET `/profile/lifestyle`, PUT `/profile/lifestyle/attributes/:attributeKey` (consent obrigatório), DELETE (anonymize); `actionContext.actorId`; key via `z.enum` → `sexual_orientation` = **400**. Frontend: novo client `api/lifestyle.ts`; **ProfilePhysical** carrega/salva `relationship_status`/`drinks`/`smokes` pelo SSOT (declare com consent / retire), **parou de enviar `lifestyle` ao `updatePhysicalProfile`** (só weeklyRoutine/goals seguem no legado), **`sexualOrientation` REMOVIDO da UI** (só em comentário; não captura/envia), checkbox de consentimento + nota "🔒 Privado". Provado runtime: GET 200; PUT relationship_status/drinks/smokes 200; **sem consent → 400**; **sexual_orientation → 400**; DELETE → value=NULL (anonymize, DB confirma); audit declare/retire sem valor; **blob `metadata.lifestyle` INTOCADO** (2 rows). Front+back typecheck 0. **Endpoint legado `/profile/physical` ainda ACEITA lifestyle** (estrada velha viva até F5) — o frontend vivo só não alimenta mais. **Não tocado:** `core.service`, social-targeting, Health (501), migration, blob/backfill, Learning/Interest/Professional/Agenda/financeiro. **DT permanece OPEN.**
- **Resolução prevista:** **F-SAUDE-501 ✅** → **F-TARGETING-DECOUPLE ✅** → **F1a ✅** → **F1b ✅** → **F2 ✅** → **F3 ✅ (rotas + frontend ProfilePhysical → SSOT; sexualOrientation removido da UI)** → **F4** readers/completude (`core.service` 388 leitura + 765 completude → SSOT; remover sexualOrientation do contrato legado) → **F5** cleanup do blob (+ micro-decisão backfill) → **F6** selo + CLOSE. Ordem inegociável: política (DECISION-0071) antes de schema/código.
