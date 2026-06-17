# 2026-06-16 — F-NOMENCLATURE-SERVICE-MONEY-07-CLOSURE

Macrofrente cirúrgica que **fecha a conformidade 07 de dinheiro·currency·status do domínio de serviços**,
sem refazer lógica financeira, sem mover dinheiro. Canoniza o que já existe (banco + backend + types +
repos + services + scripts + e2e + guard + cartório). **Executa norma existente (07) — NÃO cria DECISION nova.**

## Por que agora

Sistema local/virgem (row_count=0 em `service_payment_requests`, `service_payment_executions`, `services`).
Janela correta para corrigir nomenclatura/tipo estrutural financeiro **antes de existir dado real** (rename
+ widening puros, sem backfill).

## Anchor / Pré-flight

HEAD inicial `5b68ce3a` · branch `rescue-structural` · dev **392/392 → 393/393**. pending=[]. Sem sujeira
material (dirt = `docs/memorias/*`, notas `.md`, `.png`, `opus.md` — fora do domínio). Pré-flight GREEN.

## Norma aplicada (verbatim, READ-FIRST)

- **§4.7 Valores Monetários:** "Sempre em centavos (inteiro)… Sufixo obrigatório `_cents`… Tipo `BIGINT`
  (não INTEGER)". PROIBIDO `value`/`amount` sem sufixo, FLOAT/DECIMAL/NUMERIC.
- **§4.10 Moeda:** "ISO 4217 (3 letras)… Tipo `VARCHAR(3)`/`CHAR(3)`". `\bFIC\b` = **zero** ocorrências em
  todo `docs/01_normative` → FIC não é moeda canônica.
- **§3.4 Ambiguidade:** "`status` … PROIBIDO isolado … Banco de dados: sempre específico (ex: `payment_status`,
  não `status`)". Precedente canônico `payment_intents.payment_status`.
- SSOT: Bank é a única fonte de verdade financeira (07 §3.3 / LEIS Lei 5). Esta frente **não cria saldo/ledger**
  — só nomes/tipos de colunas de `service_payment_*`/`services` (não-SSOT, snapshot operacional).

## Prova de banco vivo ANTES

spr: `status VARCHAR(30) DEFAULT 'pending'`, `currency VARCHAR(10) DEFAULT 'FIC'`, `amount_cents BIGINT`.
spe: `currency TEXT`, `amount_cents BIGINT`, **sem status**. services: `price_cents INTEGER`, `currency VARCHAR(3) BRL`.
CHECKs: `chk_service_payment_requests_status` (pending/cancelled/expired/paid), `..._executions_amount_check`
(amount_cents>0), `services_price_positive`. row_count=0 nas 3. bank_ledger/bank_transactions/bank_splits presentes.

## Migration

`migrations/20260616230000_align_service_money_nomenclature_07.sql` — forward-only, idempotente (DO-blocks
guardados por `information_schema`/`pg_constraint`), `BEGIN/COMMIT`:
1. `service_payment_requests.status` → **`payment_request_status`** (RENAME COLUMN) + RENAME CONSTRAINT
   `chk_...status` → `chk_...payment_request_status` (CHECK re-aponta sozinho; valores preservados).
2. `service_payment_requests.currency` → **`VARCHAR(3)`** + DEFAULT `'BRL'` + CHECK `currency='BRL'`.
3. `service_payment_executions.currency` `TEXT` → **`VARCHAR(3)`** + CHECK `currency='BRL'`.
4. `services.price_cents` `INTEGER` → **`BIGINT`** (CHECK `services_price_positive` sobrevive).
Não cria coluna paralela, não recria tabela, não usa NUMERIC/float, não toca `amount_cents`/bank_*/payment_intents.

## Prova de banco DEPOIS

393/393 (+1). spr: `payment_request_status VARCHAR(30)`, `currency VARCHAR(3) DEFAULT 'BRL'`. spe: `currency
VARCHAR(3)`, **sem status**. services: `price_cents BIGINT`. CHECKs: `chk_...payment_request_status`
(pending/cancelled/expired/paid), `chk_...requests_currency_brl`, `chk_...executions_currency_brl`,
`..._amount_check` (amount_cents>0) preservado, `services_price_positive` sobreviveu. row_count=0;
`bank_ledger`/`bank_splits` = 0 (intocados).

## Código ajustado

- **Types** (`service-payment-request.types.ts`): campo `status` → `paymentRequestStatus` (entidade + Row);
  enum `PaymentRequestStatus` ganhou `PAID='paid'`; `UpdateServicePaymentRequestInput.status` → `paymentRequestStatus`;
  comentários currency → BRL. (`service-payment-execution.types.ts`): comentário currency → BRL.
- **Repo** (`service-payment-request.repository.ts`): 5× SELECT/RETURNING `status` → `payment_request_status AS
  "paymentRequestStatus"`; mapper `row.paymentRequestStatus`; INSERT col `payment_request_status`; filtro/UPDATE
  `payment_request_status`; default `|| 'BRL'`.
- **Service** (`service-payment-request.service.ts`): rejeição fail-closed `currency≠'BRL'`; default `|| 'BRL'`;
  3 reads de entidade → `.paymentRequestStatus` (chave `status:` do payload de evento = snapshot descritivo, preservada).
- **Execution service** (`service-payment-execution.service.ts:446`): `.status` → `.paymentRequestStatus`.
- **Routes** (`service-payment-request.routes.ts`): `updatePaymentRequestSchema` (Zod, **não-roteada**) `status` →
  `paymentRequestStatus`; comentário currency → BRL.
- **Profile readers:** `pending-responsibilities.routes.ts` (`pr.payment_request_status AS status` + filtro; alias
  de saída `status` preservado p/ lista agregada heterogênea) · `impact-overview.routes.ts` (filtro `payment_request_status`).
- **services.repository.ts:** mapper `priceCents: Number(row.price_cents)` — **coerção BIGINT-safe obrigatória**
  (sem `setTypeParser` global, `int8` volta como string; senão `service-bundle:167` faria concatenação de string).
- **8 e2e/fixtures:** 7 INSERT `status` → `payment_request_status` (`actor-wallet-statement`, `camada1-dmoney`,
  `pe5-resolver`, `policy-engine-service-execution`, `refund-post-dmoney-guard`, `refund-split-aware`, `spr-read-authority`);
  `spr-read-authority` + `spr-create-authority`: `'FIC'` → `'BRL'`.

Contratos externos preservados: `amountCents`, `priceCents`, `currency`. Variáveis JS `status`/`amount`/`currency`
de valor não renomeadas — só identificadores SQL/contrato.

## Guard + Negative-proof

- Novo `scripts/audit-service-money-07-nomenclature.mjs` em `validate:regression-guards` (após `audit-service-payment-amount-cents`).
  Morde: migration nova com `DEFAULT 'FIC'` / `currency TEXT|VARCHAR(n≠3)` / `status VARCHAR|TEXT` / `CHECK(status IN)` /
  bare `amount <tipo>` / `amount_cents` não-BIGINT / `services.price_cents` não-BIGINT; runtime com `'FIC'` no caminho
  service_payment / `status AS "paymentRequestStatus"` / `status, amount_cents` / `pr.status` / perda de
  `payment_request_status` nas rotas / perda de `Number(row.price_cents)`. Allowlist: 6 migrations históricas/desta frente.
- **Negative-proof (mordeu e restaurou byte-idêntico):** (A) migration temp com FIC/currency TEXT/status genérico/
  CHECK status/amount bare/amount_cents INTEGER/price_cents INTEGER → 7 FAILs → removida → OK. (B) 4 runtime
  (`'FIC'`, `status AS "paymentRequestStatus"`, `pr.status`, remoção de `Number(row.price_cents)`) → 4 FAILs → restaurados → OK.

## E2E

- `run-spr-read-authority-ephemeral.ps1` → **9/9 verdes** (DB efêmera, FULL migrations incl. `20260616230000`;
  INSERT via `payment_request_status`; Bank/ledger/split intocados; zero escrita financeira).
- `run-spr-create-authority-ephemeral.ps1` → **10/10 verdes** (POST currency `BRL` aceito → 201; payer/receiver
  derivados server-side; Bank/ledger/split intocados).

## Gates

- `validate:actor-writer-boundaries` → GATE OK. `validate:bank-ledger-boundaries` → GATE OK.
- `validate:regression-guards` → GATE OK (cadeia inteira + `service-payment-amount-cents` + `service-money-07-nomenclature`).
- `validate-architectural-patterns.mjs --strict` → **critical_new=0** (warning_new=4 pré-existente inventory-legacy/marketplace, fora da frente).
- `check:migrations` → OK. `tsc` → **25** (build baseline; **0 erros nos arquivos da frente**).
- **Pré-existentes RED (fora da frente, não introduzidos):** `validate:financial-vocabulary` (treasury-split worker);
  `validate:financial-ssot` (classifica módulos service-payment como "repo financeiro fora de bank" — inclui
  `service-payment-execution.repository.ts` **não editado nesta frente** → prova que é estrutural/pré-existente);
  `validate:schema-coherence` (allowlists C1–C35 com deadline vencido 2026-04/05). Nenhum cita coluna/tabela desta frente.

## Escopo negativo (verificado)

NÃO tocado: `bank_ledger`/`bank_transactions`/`bank_splits` · `payment_intents` (schema/status) · payout · split ·
recovery · D-money/release · liquidação · saldo · `actor_capability_grants` · agenda/availability · RBAC ·
`service_orders`/`service_discovery_requests` temporal · `product_prices`/`economic_policies` temporal · `/v1` ·
`services.status` (lifecycle) · `amount_cents` (já BIGINT) · `economic-overview.types.ts` (comentário FIC, módulo economy).

## Resíduos / próximas frentes (registradas, NÃO executadas)

`F-07-NORMATIVE-INTERPRETATION-RFC` · `F-NOMENCLATURE-SERVICE-TEMPORAL-AT` · `F-NOMENCLATURE-GRANT-LIFECYCLE-AT` ·
`F-NOMENCLATURE-MARKETPLACE-LIFECYCLE-AT`. Comentários `'FIC'` em `economic-overview.types.ts` (economy display-only).

## Estado

**✅ CLOSED / YALA PASS** (seal docs-only 2026-06-16 sobre commit material `b84e3d61`). **Veredito Yala: PASS_WITH_WARNINGS.** dev **393/393, pending=[]**.

**Confirmado no seal (banco vivo + commit):**
- `service_payment_requests` **sem `status`**, com **`payment_request_status`** (VARCHAR(30); CHECK pending/cancelled/expired/paid).
- `service_payment_requests.currency` / `service_payment_executions.currency` = **`VARCHAR(3)` + CHECK `='BRL'`**; FIC fora do caminho service_payment.
- `service_payment_executions` **sem status**; `amount_cents` BIGINT preservado.
- `services.price_cents` **BIGINT** (coerção `Number(row.price_cents)` no mapper).
- **Bank Core / `payment_intents` / D-money / recovery INTOCADOS.**
- E2Es SPR **9/9** e **10/10**; gates obrigatórios verdes (actor-writer/bank-ledger boundaries, regression-guards, arch critical_new=0, check:migrations, tsc baseline).

**Warnings não-bloqueantes (registrados como DT OPEN):**
- **W1 — `DT-SERVICE-MONEY-07-NEGATIVE-PROOF-REPRODUCIBILITY` (OPEN / NON_BLOCKING_HARDENING):** negative-proof narrado neste log, sem script reproduzível versionado; guard ativo e provado → não bloqueia.
- **W2 — `DT-FINANCIAL-SSOT-RED-SERVICE-PAYMENT-EXECUTION-REPOSITORY` (OPEN / BLOCKS_NEXT_FINANCIAL_FRONT_TOUCHING_SERVICE_PAYMENT_EXECUTION_REPOSITORY):** `validate:financial-ssot` já vermelho antes de `b84e3d61`, cita `service-payment-execution.repository.ts` (não editado nesta frente) → não bloqueia este seal; exige 3 paralelas READ-ONLY antes de nova frente financeira que toque esse arquivo.

DTs da frente: `DT-SERVICE-PAYMENT-REQUEST-STATUS-NOMENCLATURE` **CLOSED_AS_NOMENCLATURE_BASELINE / YALA PASS** ·
`DT-SERVICE-PAYMENT-CURRENCY-FIC-vs-BRL` **CLOSED_AS_NOMENCLATURE_AND_CHAIN_ALIGNMENT / YALA PASS** ·
`DT-SERVICES-PRICE-CENTS-BIGINT-NOMENCLATURE` **CLOSED_AS_NOMENCLATURE_BASELINE / YALA PASS**.
**Resíduos fora do escopo mantidos OPEN** (F-07-NORMATIVE-INTERPRETATION-RFC · F-NOMENCLATURE-SERVICE-TEMPORAL-AT · F-NOMENCLATURE-GRANT-LIFECYCLE-AT · F-NOMENCLATURE-MARKETPLACE-LIFECYCLE-AT · gates financeiros amplos preexistentes). **Seal restrito a service money 07 — não sela conformidade total de todos os domínios com o 07.**
