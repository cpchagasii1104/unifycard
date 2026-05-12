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

- **Status:** OPEN
- **Origem:** C36 remediação (2026-05-12) — auditoria de status sem CHECK
- **Vinculada a:** C36
- **Contexto:**
  `actor_debts.status` usa case inconsistente: migration define DEFAULT 'pending' (lowercase),
  mas o código em `event-scheduler.ts` escreve 'TRANSFERRED_TO_ORGANIZER' (UPPERCASE).
  CHECK adicionado inclui ambos os valores para não quebrar runtime.
- **Risco:**
  Inconsistência de case impede filtros case-sensitive diretos. Queries como
  `WHERE status = 'PENDING'` e `WHERE status = 'pending'` retornam resultados diferentes.
- **Mitigação atual:**
  CHECK constraint aceita ambos. Consultas no código usam os valores corretos para cada path.
- **Resolução prevista:**
  Normalizar para lowercase (migration UPDATE + ALTER DEFAULT + ajuste em event-scheduler.ts).
  Prioridade: BAIXA (não gera bug runtime com CHECKs atuais).

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
