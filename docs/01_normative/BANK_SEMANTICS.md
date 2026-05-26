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

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- PROHIBITED_STRUCTURES.md
- SSOT_CONTRACT.md
- SSOT_EXCLUSIVE_BANK_RULE.md

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->