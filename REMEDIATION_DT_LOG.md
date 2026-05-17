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

- **Status:** OPEN
- **Origem:** Atravessamento HTTP real do fluxo de criação de empresa (2026-05-15) — descoberta via SQL direto durante diagnóstico de divergência de tenant
- **Classe:** DT-D (dados — duplicação semântica em E2E que vaza para runtime de produção via path compartilhado)
- **Vinculada a:** `resolveTenantIdFromGlobalUserId` em `companies.service.ts`; `/auth/register` (provável fonte do reuso); fix cirúrgica de `companies.routes.ts:187` (essa fix isola o sintoma mas não trata a causa raiz)
- **Convergência prevista:** quando outro fluxo cross-tenant pressionar runtime humano e revelar comportamento errático similar (ownership entre tenants, autoridade compartilhada, ledger cross-tenant)

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

- **Status:** OPEN
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
- **Status:** OPEN — **reclassificada de BLOQUEIA_PRODUTO para BLOQUEIA_FRENTE**
- **Razão material:** ALTER TABLE companies ADD metadata seria 5min DDL, mas substrato canônico EXISTE: `tenants.company_type_id` (uuid FK), `company_types` (7 rows com defaults), `actors.metadata` (jsonb), `actors.company_id`, `company_users.metadata` (jsonb). Service `companies.service.ts:444-455` pula o caminho canônico e descarta onboarding state silenciosamente.
- **Decisão arquitetural disfarçada:** entre 4 caminhos (ALTER TABLE / tabela dedicada / convergir para company_types+tenants / mover para actors.metadata)
- **DT original preservada** em sua localização (linhas 1168-1216) com nota de redirect.
- **Critério de destrave:** primeiro caso real de empresa criada onde onboarding state desejado seja recuperado em sessão posterior (pressão material que justifique decidir entre 4 opções).


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
