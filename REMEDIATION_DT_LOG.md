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

- **Status:** OPEN
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

---
