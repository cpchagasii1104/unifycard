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

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- PROHIBITED_STRUCTURES.md
- SSOT_CONTRACT.md
- SSOT_EXCLUSIVE_BANK_RULE.md

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->