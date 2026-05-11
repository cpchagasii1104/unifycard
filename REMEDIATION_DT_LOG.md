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
