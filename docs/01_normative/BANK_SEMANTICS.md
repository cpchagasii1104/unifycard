# BANK SEMANTICS

Este documento define a semântica institucional do UnifyBank.

O sistema financeiro do UnifiCard possui um único SSOT financeiro:

bank_accounts  
bank_transactions  
bank_ledger  
bank_splits

Nenhuma outra estrutura pode:

- manter saldo
- calcular saldo
- replicar ledger
- registrar split financeiro

Saldo existe exclusivamente no bank_ledger.

Qualquer tentativa de criar:

accounts  
transactions  
ledger_entries  
payment_splits  
event_split_declarative  

constitui violação do SSOT financeiro.

Referências normativas:

SSOT_EXCLUSIVE_BANK_RULE.md  
SSOT_CONTRACT.md  
PROHIBITED_STRUCTURES.md

---

## Account types canônicos por papel econômico (2026-05-26)

`bank_accounts.account_type` carrega semântica institucional. Os tipos
abaixo são vocabulário canônico — outros são legado/dormentes.

### Carteira interna do actor — `actor_wallet`

`bank_accounts.account_type = 'actor_wallet'` é a **CARTEIRA CANÔNICA**
de qualquer actor econômico do UnifiCard (pessoa física, empresa,
prestador, motorista, entregador, vendedor, bar, restaurante,
fornecedor, organizador de evento etc.).

Regras inegociáveis:

- **Sempre conta Bank.** Não há "wallet paralela" fora de bank_accounts.
- **Saldo exclusivo via bank_ledger.** Nunca derivar, calcular paralelo
  ou cachear como verdade.
- **Recebe valores liberados de qualquer módulo/contexto econômico**
  (ex.: D-money fixed-price-escrow → actor_wallet via reference_type=
  `fixed_price_release_to_actor_wallet`).
- **NÃO é receita da plataforma** (esse papel cabe a `platform_revenue`
  e `platform_fees`).
- **NÃO é payout externo** (saque para banco real é frente posterior;
  origem desse fluxo SERÁ a `actor_wallet`).
- **NÃO é bank settlement** (movimento para banco externo — frente
  posterior).
- **NÃO é `user_wallet`** (legado/dormente; 0 instâncias actor-owned
  em produção; manter no enum por compatibilidade).
- **NÃO é `seller_available`** (lifecycle agregado SYSTEM tenant-única;
  pertence ao plano Bank antigo, não à carteira individual do actor).
- **NÃO é `credit`** (conta default genérica criada por
  `getOrCreateAccount`; sem semântica de recebíveis).

Identificação canônica:

- `owner_type='actor'` (no DB) — equivale a `'user'` / `'company'` no
  enum TS antes da tradução por `toDbOwnerType`.
- `owner_id = '${actorId}:actor_wallet'` (composite estável).
- `actor_id NOT NULL` (constraint `bank_accounts_actor_required_for_actor_owner`).
- Criação canônica: `bankAccountService.ensureActorWalletAccount(tenantId, actorId, currency?)`.

### Outros tipos relevantes

| account_type        | Papel canônico                                             | Owner típico         |
|---------------------|------------------------------------------------------------|----------------------|
| `actor_wallet`      | Carteira interna do actor — destino canônico de recebíveis | actor (user/company) |
| `escrow_payments`   | Custódia do pagamento até release                          | system (por tenant)  |
| `platform_revenue`  | Receita da plataforma                                      | system (por tenant)  |
| `platform_fees`     | Fees acumulados pela plataforma                            | system (por tenant)  |
| `clearing`          | Pivô temporário em settlements                             | system (por tenant)  |
| `bank_settlement`   | Pivô de saída para banco externo                           | system (por tenant)  |
| `risk_reserve`      | Provisão de risco                                          | system (por tenant)  |

Legado/dormente (mantido por compatibilidade, **não usar para novos
fluxos**):

- `user_wallet` — substituído por `actor_wallet` (vale para user e company).
- `seller_pending`, `seller_available`, `seller_payout` — lifecycle
  antigo agregado SYSTEM; permanece como conta system tenant-única
  para callers legados / planos dormentes (ver DT-PIPELINE-WIRING-GAP).
- `credit` — conta default genérica; não confundir com saldo de
  recebíveis.
- `escrow_disputes`, `adjustment` — declarados no enum, dormentes em
  produção.

### Regra forte para novos fluxos econômicos

Qualquer módulo futuro que precise **creditar saldo de actor** (PF,
empresa, qualquer entidade econômica) DEVE usar `actor_wallet` como
destino. Criar nome novo ou reusar `user_wallet`/`seller_available`/
`credit` para esse papel é violação de canonicidade.

Para receivables com semânticas distintas no MESMO actor (ex.: saldo
de tip versus saldo de aluguel), separar via `bank_splits.metadata` ou
nova account_type DEDICADA — não via reuso de `actor_wallet` com flags.

Para auditoria/extrato com origem por entrada, ver
`modules/wallet/actor-wallet-statement.service.ts` (read-model
canônico — saldo SEMPRE via `bankAccountService.getBalance`).

Referência da decisão: DECISION-0046 (2026-05-26) — `actor_wallet`
como carteira canônica de qualquer actor econômico no UnifiCard.

---

## Camada de DECISÃO de policy: Economic Policy Engine (DECISION-0047 + DECISION-0048, 2026-05-26)

A partir de DECISION-0047 (PE-1 substrate) **reduzida e precisada por DECISION-0048**
(convergência sem coexistência permanente), a CONFIGURAÇÃO de regras de split de
qualquer transação econômica NOVA é resolvida pelo Economic Policy Engine. `bank_policies`
foi hard-deprecated e `bank-policy.service.resolveSplitPolicy` foi REMOVIDO.

- **Tabelas**: `economic_policies`, `economic_policy_lines`,
  `access_pass_products`, `actor_access_passes`,
  `economic_policy_resolution_logs`.
- **Resolver canônico**:
  `economicPolicyEngineService.resolveEconomicPolicy(input)`.
- **Cálculo**: `calculatePolicySplits(amountCents, lines)` — BPS
  integer (sem float). Drift de arredondamento absorvido pela
  primeira linha `revenue_share`.
- **Access pass override**: produto pode substituir `bps` da linha
  `platform_fee` durante a vigência (`commission_override_bps`).
- **Fail-closed**: AMBIGUITY / NOT_FOUND / DRIFT_NO_REVENUE_SHARE /
  CALCULATION_INVALID nunca são silenciados.

A PERSISTÊNCIA continua soberana em `bank_splits` + `bank_ledger` +
`bank_transactions`. O resolver entrega `CalculatedEconomicSplit[]`
para o caller traduzir em INSERTs na camada CORE.

O plug do engine em `service-payment-execution` é frente PE-3
(rastreada em `DT-POLICY-ENGINE-PLUG-SERVICE-EXECUTION`). Até lá,
fluxos novos como Camada 1 fixed-price-escrow continuam com 100%
receiver (DT-CAMADA1-FEE-SPLIT).

`bank_policies` foi hard-deprecated (DECISION-0048) via migration
`20260530566000_deprecate_bank_policies_table.sql`. Tabela NÃO foi
dropada porque `bank-limit.service.bankPolicyService.getPolicy<T>()`
ainda lê para configurar limites operacionais — uso distinto de
policy de split. Remoção física rastreada em
`DT-BANK-POLICIES-PHYSICAL-REMOVAL`.

`bankSplitEngineService` permanece como calculador para fluxos legacy
(event_ticket / ride_payment / p2p_transfer / group_contribution /
service_booking) com defaults hardcoded por contexto — SEM fonte
alternativa de policy. Cutover gradual para `economic_policy_engine`
em frente PE-3+.

3 guardrails CRITICAL adicionados em
`scripts/validate-architectural-patterns.mjs` impedem reaparição da
duplicidade:

1. `NO_LEGACY_BANK_POLICY_SERVICE_IMPORT` — bloqueia novo import de
   `bank-policy.service` fora da allowlist.
2. `NO_BANK_EXECUTOR_IMPORT_IN_POLICY_ENGINE` — bloqueia
   `modules/economy/policy-engine/**` importar executor financeiro.
3. `NO_RCA_COMMISSION_LITERAL` — bloqueia reaparição de
   `rca_commission` / `rca_actor_wallet` (renomeados para `channel_*`
   em DECISION-0048).

---

## PE-3 — service_execution canônico (2026-05-26)

A partir desta fatia, `service-payment-execution.service.createExecution`
resolve policy via `economic_policy_engine` quando `input.splits` é
ausente. Fluxo:

1. `economicPolicyEngineService.resolveEconomicPolicy({moduleContext:'service_execution', vertical:'services', pricingModel:'fixed', settlementFlow:'fixed_price_escrow', actorId, actorType, transactionTime})` — fail-closed em `POLICY_NOT_FOUND`/`POLICY_AMBIGUITY`.
2. `calculatePolicySplits(grossAmountCents, lines)` — BPS integer.
3. `resolveSplitDestinationFromPolicy` (helper local) mapeia cada
   `destination_type` para `bank_account` real:
   - `receiver_actor`/`actor_wallet` → `escrow_payments` (D-money libera para `actor_wallet`)
   - `platform_fees` → conta system `platform_fees`
   - `risk_reserve` → conta system `risk_reserve`
   - `escrow_payments` → escrow direto
   - `referral`/`group_allocation`/`channel_commission`/`custom`/`regional_fund` → FAIL_CLOSED no MVP (frente PE-4+)
4. `processServicePaymentExecutionCanonical` recebe `splitRecipients`
   heterogêneos (com `destinationAccountId` + `splitType` resolvidos)
   e persiste 1 `bank_transaction` + N `bank_splits` + N entries no
   `bank_ledger` na MESMA transação.
5. `payment_intent.metadata.splits` carrega APENAS os splits com
   `releaseToActorWallet=true` (= revenue_share). Demais splits (fee,
   reserve) já caíram nos destinos finais — D-money NÃO os toca.
6. Audit metadata: `policyId`, `policyCode`, `policyVersion`,
   `grossAmountCents`, `calculatedSplits[]`, `appliedAccessPassId`.

**Invariante material:** `actor_wallet` RECEBE EXCLUSIVAMENTE
`revenue_share`. Fee/reserve/fund/etc. NUNCA passam pelo `actor_wallet`
do prestador. D-money tem guarda anti-vazamento (`sumSplits >
totalAmountCents` falha).

---

## PE-4-METRICS — Métricas sociais reais (2026-05-26)

`economicMetricsService.getRegionalFundMetrics()` e `getGroupMetrics()`
calculam em tempo real, read-only, sobre `bank_splits` + `bank_ledger`:

| Métrica pública             | Fonte                                                           |
|------------------------------|-----------------------------------------------------------------|
| `balanceCents`               | `bankAccountService.getBalance()` (SSOT bank_ledger)            |
| `pfVerifiedParticipants`     | DISTINCT `identities.global_user_id` WHERE `tax_id_type='cpf'` AND `kyc_status='approved'` E participou |
| `pjVerifiedParticipants`     | idem com `tax_id_type='cnpj'`                                   |
| `pfActiveContributors30d`    | idem PF + filtro `bank_splits.created_at > NOW() - 30 days`     |
| `pjActiveContributors30d`    | idem PJ + filtro 30d                                            |
| `unverifiedContributors30d`  | DISTINCT `source_actor_id` WHERE `global_user_id IS NULL` OR `kyc_status != 'approved'` E nos últimos 30d (rótulo separado) |
| `contributionVolume30dCents` | `SUM(amount_cents)` 30d                                         |
| `lastContributionAt`         | `MAX(created_at)`                                               |

**Invariantes inegociáveis:**

1. **`actor` NÃO é pessoa.** Dedupe por `identities.global_user_id` (canônico),
   NUNCA por `actor.id` em métricas públicas. `actor_count` aparece APENAS
   em payload `Internal` (admin/audit).
2. **`tax_id` / `cpf` / `cnpj` NUNCA são expostos** no payload (público ou admin).
   Servem apenas para deduplicação SQL interna.
3. **PF e PJ separados** (`pfVerifiedParticipants` ≠ `pjVerifiedParticipants`).
4. **Não-verificados em rótulo próprio** (`unverifiedContributors30d`) — nunca
   somar com PF/PJ verificados.
5. **"Ativo" = contribuição financeira nos últimos 30 dias** via
   `bank_splits.created_at`. Login / membership não conta.
6. **Sem tabela nova / sem migration / sem projection** — MVP via query
   direta sobre tabelas existentes (K_metrics_6 = C). Projection vira
   frente futura quando performance exigir (rastreado em
   `DT-PE4-METRICS-PROJECTION-WHEN-SCALE` se necessário).
7. **Saldo NUNCA de `regional_funds.total_balance_cents`** (projeção
   legacy). Sempre `bank_ledger` via `bankAccountService.getBalance()`.

E2E `validate-pipeline-e2e-policy-engine-metrics.ts` cobre 9 cenários
(T1-T9, 28 asserções) provando: deduplicação por global_user_id,
PF/PJ separados, unverified isolado, janela 30d, saldo do ledger,
payload sem CPF/CNPJ, actor_count só interno.

### Contrato `regional_origin_basis` — DECISION-0049 (2026-05-26)

Formalizada em migration `20260530567000`. Enum canônico **7 valores**
(`mixed_policy` removido — é padrão de USO via múltiplas linhas, NÃO valor):

`payer_identity_residence` | `receiver_identity_residence` |
`receiver_company_operational` | `receiver_company_hq` |
`service_location` | `transaction_location` |
`explicit_economic_region`

**Regras inegociáveis:**

- **CNPJ identifica** entidade; **actor identifica unidade/papel** operacional;
  **OPERATIONAL identifica** onde impacta.
- **PJ default = `receiver_company_operational`.** HQ NUNCA fallback automático.
- **HQ só explícito** via `basis='receiver_company_hq'` declarado pela policy.
- **PF por policy/vertical** (presencial → `service_location`; remoto →
  `receiver_identity_residence`).
- Múltiplas unidades de PJ = múltiplos actors compartilhando `company_id`
  (NÃO criar `company_units` paralelo).
- `mixed_policy` = composição via múltiplas linhas `regional_fund`, cada uma
  com basis próprio.
- Métrica pública deduplica por identidade real (PE-4-METRICS), não por actor.

**Enforcement material:**

- Coluna `economic_policy_lines.regional_origin_basis TEXT`
- CHECK `chk_origin_basis_required_for_dynamic_regional`
- CHECK `chk_origin_basis_canonical_values`
- E2E PE-1 T16-T18 provando enforcement no Postgres (não Zod/TS)

Resolver dinâmico **NÃO implementado** — continua FAIL-CLOSED em PE-3.
Pré-requisito UX (`OPERATIONAL` cadastrado por PJ) rastreado em
`DT-PJ-OPERATIONAL-ADDRESS-MANDATORY-BEFORE-DYNAMIC-REGIONAL`.

**Cartório operacional (DECISION-0050, 2026-05-26):** convenção canônica fechada para
representar endereço operacional de actor-unidade:

```
HQ jurídico:
  owner_type='company',          owner_id=<companies.company_id>, role='HQ'

OPERATIONAL de actor-unidade:
  owner_type='service_provider', owner_id=<actors.id>,             role='OPERATIONAL'
```

`service_provider` é nome TÉCNICO de owner de endereço (NÃO é actor_type).
Helper canônico: `backend/src/core/location/operational-address.helper.ts`.
E2E `validate-pipeline-e2e-pe5-cartorio-operacional.ts` cobre 6 cenários.

Detalhes completos em `CORE_SPLIT_PAGAMENTO_CANONICO.md §9.4`.

**Caminho LEGACY preservado:** caller que passa `input.splits=[100%]`
continua funcionando (E2Es antigos que dependem desse contrato não
regridem). Caminho LEGACY força destino `escrow_payments` para todos
os splits + splitType `revenue_share` (sem audit metadata de policy).

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- PROHIBITED_STRUCTURES.md
- SSOT_CONTRACT.md
- SSOT_EXCLUSIVE_BANK_RULE.md

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->