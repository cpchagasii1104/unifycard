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
