# IA-YALA — Reseal Adversarial · DT-CHECKOUT-FINANCIAL-GATE-AT-CALLER-NOT-SINK (Opção A)

## RESPOSTA PARA: IA-DIRETORA (verificadora: IA-YALA, co-assina IA-DINHEIRO)

- **VEREDITO: PASS** (refutação adversarial falhou em todos os 5 vetores; contenção fecha por construção, zero dinheiro).
- **HEAD no momento:** `8ec57688d78021c60a9e4386777723f1c48706f9` — "fix(checkout): enforce event financial runtime at bank sink" · branch `rescue-structural` · **commit auditado == HEAD vivo** (sem divergência).
- **Revalidou no vivo:** SIM, 1ª mão. **READ-ONLY** sobre `unificard_dev` (só `SELECT count(*)`; e2e só lança no gate antes de qualquer escrita). **ROLLBACK** do negative-proof confirmado (working tree limpo, `git diff` vazio, gate de volta em 145/247).
- **Modo:** RAIO X / reseal financeiro alto risco. Nenhum endpoint financeiro de escrita chamado; nenhuma migration; nenhum commit.

### Arquivos lidos de 1ª mão (canônico via Read, não rg)
`backend/src/modules/bank/bank-integration.service.ts` · `backend/src/core/checkout/checkout-financial-firewall.ts` · `backend/scripts/audit-checkout-financial-containment.mjs` · `backend/src/scripts/e2e-checkout-financial-containment.ts` · `backend/src/modules/events/events-payment.service.ts` (dead-code) · `backend/src/modules/bank/adapters/bank-integration.adapter.ts` · `backend/package.json`.

---

## VERIFICAÇÃO POR VETOR (refutação de 1ª mão)

### 1. Gate NO SINK (antes de `createTransactionWithSplit`) nos 2 métodos de evento? → **PASS**
- `assertCheckoutFinancialRuntimeEnabled('bankIntegration.processEventTicketPayment')` é a **1ª instrução executável** de `processEventTicketPayment` (`bank-integration.service.ts:145`), **antes** de validar limite, resolver contas e do sink `createTransactionWithSplit` (`:202`).
- Idem `processEventConsumptionPayment`: gate em `:247`, antes do sink em `:304`.
- **e2e:checkout-containment rodado AO VIVO → 6/6 PASS:** test 0 (flag OFF) · 1 (CheckoutService→DISABLED) · 2 (eventEconomy→DISABLED) · **2a (SINK ticket DIRETO→DISABLED)** · **2b (SINK consumption DIRETO→DISABLED)** · 3 (**Δ bank_ledger=0 tx=0 splits=0**). Os testes 2a/2b chamam o sink **diretamente** (bypassam o caller) e ainda assim batem `CHECKOUT_FINANCIAL_RUNTIME_DISABLED`.

### 2. Existe AINDA algum caminho a bank_* via evento/checkout SEM o gate? → **NÃO (refutado)**
- Sweep de callers de `processEvent{Ticket,Consumption}Payment` (excluindo o próprio service e o e2e): `core/checkout/CheckoutService.ts` (gate no caller) · `core/events/event-economy.service.ts` (gate no caller) · `modules/bank/adapters/bank-integration.adapter.ts` (**passthrough puro** `return realService.processEvent*Payment(...)`, sem `bank_` direto) · `core/bank/ports/bank-integration.port.ts` (interface) · **`modules/events/events-payment.service.ts` (DEAD-CODE)**.
- O **dead-code `events-payment.service.ts:49`** chama **só** `bankIntegrationService.processEventTicketPayment(...)` — **zero** `createTransactionWithSplit` / `INSERT INTO bank_` / `bankTransactionService.*` direto. Não está montado em rota/módulo (busca cross-repo → só citação em comentário). **Se religado, bate no gate-no-sink antes de bank_*.**
- **Conclusão:** todos os caminhos evento/checkout → bank_* atravessam o gate no sink. Fecha **por construção** (o que a Opção A corrige vs gate-só-no-caller).

### 3. `createTransactionWithSplit` GENÉRICO ficou intocado? → **PASS (não cimentado)**
- 4 sinks `createTransactionWithSplit` no arquivo: `:202` (event_ticket, GATED) · `:304` (event_consumption, GATED) · **`:399` `processServiceBookingPayment` (context `service_booking`) — SEM gate de checkout** · **`:727` `processGroupContribution` (context `group_contribution`) — SEM gate de checkout**.
- `assertCheckoutFinancialRuntimeEnabled` aparece **só** nas linhas 145 e 247 (e o import 14). Nenhum gate de checkout em service_booking/group/p2p → o trilho genérico **não foi cimentado**. Guard confirma: "createTransactionWithSplit genérico intocado".

### 4. Negative-proof morde ao remover o gate do sink? → **PASS (morde)**
- Removido temporariamente o gate de `processEventTicketPayment` (sed) → guard `audit-checkout-financial-containment.mjs` (de `backend/`) **FALHA exit=1** com a mensagem exata:
  `src/modules/bank/bank-integration.service.ts: sink processEventTicketPayment SEM gate fail-closed (DT-CHECKOUT-FINANCIAL-GATE-AT-CALLER-NOT-SINK; gate no caller é disciplina, no sink é construção).`
- Baseline (gate presente) = guard **OK exit=0**; após `git checkout` → guard **OK exit=0** novamente, `git diff` vazio.
- O guard é **comment-stripped** (`stripTs`) → um gate só em comentário NÃO passaria (defende contra falso-verde).
- **Disciplina money-safe:** o negative-proof do e2e foi **deliberadamente NÃO rodado** com o gate removido — sem o gate, os testes 2a/2b alcançariam `createTransactionWithSplit` e poderiam escrever em `bank_*` no DB vivo. O bite do guard estático é suficiente e não move dinheiro.

### 5. Dinheiro intocado? → **PASS**
- **Flag default OFF:** `checkout-financial-firewall.ts:22` liga **só** com `=== 'true'`; e2e test 0 PASS (`isCheckoutFinancialRuntimeEnabled() === false`).
- **Δ = 0:** `bank_ledger/bank_transactions/bank_splits` antes==depois (0/0/0) no e2e vivo.
- **Mesma flag, não nova:** `CHECKOUT_FINANCIAL_RUNTIME_ENABLED` foi criada no commit anterior `823699e3` ("fail-close event checkout financial runtime"); `8ec57688` **reutiliza** a flag. Separada de `SERVICE_FINANCIAL_RUNTIME_ENABLED` (guard barra conflação).
- **Escopo do commit `8ec57688`:** só 3 arquivos — guard (+21/−1), `bank-integration.service.ts` (+8 = 2 gates + comentários), e2e (+9). **Zero migration / payout / fee / RLS / .sql.** `createBooking/handlePayment` intocados; dead-code neutralizado por construção, não removido.

---

## RESSALVA METODOLÓGICA (não é defeito de código)
O pipe Bash/`rg` **GARBLA** o token longo `assertCheckoutFinancialRuntimeEnabled` / `CHECKOUT_FINANCIAL_RUNTIME_ENABLED` para `n` na saída renderizada (apareceu como `function n`, `import { n }`, `process.env.n`, `= 'n'`). **NÃO é o conteúdo real** — provado pelo Read canônico (cat -n), por `awk`/`sed` e pelas execuções de guard/e2e. Registrado para o próximo auditor **não** reportar falso-FAIL a partir de `rg`. Verdade só por Read/execução.

## STATUS: **RESPONDIDO — PASS** · HEAD `8ec57688` (sem divergência) · working tree restaurado/limpo · sem commit.

---

# Bloco IA-DINHEIRO (co-assinatura do eixo monetário)

**HEAD:** `8ec57688` · **Revalidou no vivo:** SIM.

**VEREDITO (eixo dinheiro): PASS — contenção fail-closed correta no sink, dinheiro intocado.**

1. **EVIDÊNCIAS:** gate no sink antes de `createTransactionWithSplit` (`bank-integration.service.ts:145→202`, `:247→304`); e2e vivo 6/6 com **Δ bank_ledger/transactions/splits = 0**; flag default OFF (`firewall:22`); commit sem migration/payout/fee/RLS; flag reutilizada (`823699e3`), não nova.
2. **RISCOS (do meu eixo):** nenhum aberto por esta fatia. O sink continua sendo o `bankTransactionService.createTransactionWithSplit` canônico (BIGINT, mesma TX, append-only ledger) — não foi tocado. O gate é defesa-em-profundidade (caller + sink), correto vs DT-GATE-AT-CALLER-NOT-SINK. Resíduo pré-existente, **fora desta fatia**: o trilho de evento usa `mockUnifyCardCharge` (não destrava liquidação real enquanto flag OFF) — segue como cadeia futura, **não** reaberto aqui.
3. **RECOMENDAÇÃO:** SELAR a fatia. Reabrir o runtime de checkout/evento é DECISION própria (cobrança real → liquidação governada + 3 paralelas + E2E + reseal), **nunca** por flip de flag isolado. Manter `createTransactionWithSplit` genérico (service_booking/group/p2p) **sem** o gate de checkout (escopo correto).
4. **FRONTEIRA:** runtime-aplicado/flag em deploy vivo (valor real de `CHECKOUT_FINANCIAL_RUNTIME_ENABLED` em produção, RLS aplicada) = **IA-BANCO** (aqui provei OFF no runtime de dev + Δ=0). Autoria/representação da cadeia de checkout real = IA-ACTOR/IA-AUTORIDADE quando reabrir.
5. **STOPs:** saldo só do `bank_ledger`; gate ≠ liquidação real; flag OFF é contenção, não operação; nada de payout/fee/migration por carona; reabertura exige DECISION + 3 paralelas + reseal. Análise = insumo, **não GO**.

**Status: RESPONDIDO — PASS.** Nenhum fluxo financeiro executado; nenhum código/schema/runtime/cartório alterado de forma persistente (negative-proof revertido); sem commit.

---

# IA-YALA — Reseal LEVE · F-UNIFYCARD-FEE-BPS-SSOT-LOCK-IN (commit 7a87fee2)

## RESPOSTA PARA: IA-DIRETORA (verificadora: IA-YALA, co-assina IA-DINHEIRO)

- **VEREDITO: PASS.**
- **HEAD no momento:** `0b102ff6883bff280b22100af72abf04aa7e20f7` — "docs(money): seal fee bps live path" · branch `rescue-structural`. Commit auditado `7a87fee2` ("test(money): guard fee bps ssot") = **ancestral de HEAD** (HEAD acrescenta só o doc de selo).
- **Revalidou no vivo:** SIM, 1ª mão. READ-ONLY (negative-proof revertido via `git checkout`; working tree limpo, `git diff` vazio). Sem commit.
- **Arquivos lidos (canônico via Read):** `backend/scripts/audit-fee-bps-ssot.mjs` · `backend/src/modules/marketplace/marketplace-fee-policy.ts` · `backend/scripts/audit-unifycard-fee-bps-consumer.mjs` · `backend/src/scripts/validate-pipeline-e2e-unifycard-fee-bps.ts`.

### 1. O guard prova que o path vivo usa engine/bps e nenhum consumidor vivo lê fee_percentage? → **PASS**
- `marketplace-fee-policy.ts` (resolver único): usa `economicPolicyEngineService.resolveEconomicPolicy` + `calculatePolicySplits` (floor `gross*bps/10000`), expõe `feeRateBps`, **fail-closed fee=0 sem policy, sem fallback em fee_percentage** (`:10,44,52,61,64`).
- Consumidores vivos chamam o resolver: `payment-execution.service.ts:18,308` e `unifycard.service.ts:43-44` (`resolveMarketplaceFeeViaPolicy`). `fee_percentage` neles só em **comentários** (guard é comment-stripped).
- `validate:regression-guards` rodado AO VIVO → **exit=0**; `audit-fee-bps-ssot` (GATE OK) e `audit-unifycard-fee-bps-consumer` (GATE OK) verdes no chain (linhas 248/263).
- **e2e fee-bps → 14/14 verdes:** A1-A6 (engine bps: 299bps×10000¢=299¢; snapshot bps-only, **A6 sem fee_percentage**) · B1-B3 (fail-closed fee=0 sem policy) · C1-C3 (boundary: não toca bank/settlement/payout, não lê method-as-SSOT, usa calculatePolicySplits) · D1-D2 (consumer guard + R8Q containment verdes).

### 2. A allowlist esconde um reader VIVO? → **NÃO (refutado)**
- Allowlist = 10 entradas, todas ghost/dormant/snapshot/e2e: `payment-method.*` (ghost — `payment_methods` **ausente das migrations ativas**), `regional-fee.repository` (dead/snapshot), `settlement.service` (**Proxy reject "Settlement migrated to Bank"**), `unifycard-method.*` (dormant R8Q 501), `payment-intent.service` (snapshot deprecated), e o e2e que **prova ausência**.
- Tabelas `payment_methods`/`regional_fees`/`unifycard_payment_methods` **não existem em migration ativa** (ghost confirmado).
- O **path vivo de fee** (payment-execution/unifycard.service) resolve via `resolveMarketplaceFeeViaPolicy` (engine/bps) — **não** via nenhum arquivo allowlistado. Os arquivos allowlistados são CRUD/snapshot/proxy-dead, não decidem a taxa do dinheiro vivo. A allowlist confina, não esconde.

### 3. NP morde ao introduzir reader vivo de fee_percentage / resolver sem engine? → **PASS (morde nos dois)**
- **NP-a** (injetei `x.fee_percentage` no resolver vivo) → `GATE FAIL`: "resolver VIVO não pode ler fee_percentage" **+** "fee_percentage em código VIVO fora da allowlist (regressão do SSOT bps)". Restaurado.
- **NP-b** (neutralizei `economicPolicyEngineService` → resolver sem engine) → `GATE FAIL`: "resolver não usa economic_policy_engine (SSOT bps, DECISION-0141)". Restaurado.
- Pós-restore: `git diff` vazio, guard `exit=0`. Guard é **comment-stripped** (gate só em comentário não passa).

### 4. ZERO migration/schema/bank_*/dinheiro? → **PASS**
- Commit `7a87fee2` = **2 arquivos**: `backend/package.json` (+1 wire do guard no chain) e `backend/scripts/audit-fee-bps-ssot.mjs` (+79, novo). **Zero migration / .sql / bank_ledger/transactions/splits / payout / dinheiro movido / schema.** (HEAD `0b102ff6` acrescenta só o doc de selo de cartório.)

## RESSALVA (transient, não-defeito)
A 1ª execução do `validate:regression-guards` teve **1 FAIL transitório** em `unifycard-fee-bps-consumer` ("marketplace-fee-policy.ts não usa economicPolicyEngineService") que **NÃO reproduz**: o arquivo prova o import/uso (`:10,52,61`); os guards standalone passam deterministicamente (consumer 3/3, ssot 2/2); e a própria falha reportou só 1 dos 3 checks do mesmo arquivo/leitura (impossível se o símbolo faltasse de verdade) — assinatura de **leitura parcial/IO flake** deste ambiente Windows (mesma classe do garbling de `rg`). 2ª execução do chain completo = **exit=0**. NÃO é defeito de contenção. (Verdade só por Read/execução determinística, nunca por uma saída isolada de rg/chain.)

## STATUS: **RESPONDIDO — PASS** · HEAD `0b102ff6` (commit `7a87fee2` ancestral) · working tree limpo · sem commit.

---

# Bloco IA-DINHEIRO (co-assinatura do eixo monetário) — fee-bps SSOT lock-in

**HEAD:** `0b102ff6` · **Revalidou no vivo:** SIM.

**VEREDITO (eixo dinheiro): PASS — lock-in correto; taxa do path vivo só por bps via economic_policy_engine; dinheiro intocado.**

1. **EVIDÊNCIAS:** resolver bps fail-closed (`marketplace-fee-policy.ts`); consumidores vivos usam o resolver; e2e 14/14 (299bps×10000¢=299¢, fail-closed fee=0, sem fee_percentage no snapshot); fee_percentage confinado a ghost/dormant/snapshot (tabelas ausentes das migrations); commit zero-migration/bank/dinheiro.
2. **RISCOS (do meu eixo):** nenhum aberto por esta fatia. Reforça a régua DECISION-0140/0141 (unidade bps + SSOT = economic_policy_engine; proibido `/100`/`fee_percentage`). **Resíduo pré-existente, fora desta fatia:** a fee resolvida ainda **não toca o bank_ledger** no path marketplace (settlement proxy-dead → fee é audit-snapshot; ver IA-16 FEE-01) — isto é incompletude de captura, não vazamento, e segue como frente material própria (DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION). Este guard **não** a fecha nem finge fechar — só trava a regressão da unidade/SSOT.
3. **RECOMENDAÇÃO:** SELAR o lock-in. A materialização da fee no ledger (captura real) é frente própria: Evidence Pack + 3 paralelas + E2E monetário + reseal — nunca por carona deste guard.
4. **FRONTEIRA:** existência viva das tabelas ghost / aplicação de migrations / rowcounts = **IA-BANCO** (aqui provei ausência das tabelas nas migrations on-disk). Modelo de fee material = **IA-DECISOES-DT** + Clayton.
5. **STOPs:** taxa só em bps via economic_policy_engine; nunca `fee_percentage`/`/100`; guard trava regressão, não materializa fee; captura no ledger exige frente própria; análise = insumo, **não GO**.

**Status: RESPONDIDO — PASS.** Nenhum fluxo financeiro executado; negative-proof revertido (working tree limpo); sem commit.

---

# IA-YALA — Reseal · SPLIT-01 bank_splits append-only (commit 2ff51fe0)

## RESPOSTA PARA: IA-DIRETORA (verificadora: IA-YALA, co-assina IA-DINHEIRO)

- **VEREDITO: PASS.**
- **HEAD no momento:** `ece6de7d795f7d8dba85035cfcb761cfb92b738f` — "docs(bank): seal bank_splits append-only" · branch `rescue-structural`. Commit auditado `2ff51fe0` ("fix(bank): make bank_splits append-only") = **ancestral de HEAD** (HEAD acrescenta só o doc de selo).
- **Revalidou no vivo:** SIM, 1ª mão. READ-ONLY (e2e roda em tx revertida Δ=0; negative-proof revertido via `git checkout`, working tree limpo). Sem commit.
- **Arquivos lidos (canônico via Read):** `migrations/20260623120000_bank_splits_append_only.sql` · `migrations/0021_ledger_append_only.sql` (baseline simetria) · `scripts/audit-bank-splits-append-only.mjs` · `src/scripts/e2e-bank-splits-append-only.ts` · `src/modules/bank/bank-split.repository.ts` · `src/scripts/validate-pipeline-e2e-policy-engine-metrics.ts`.

### 1. Existe UPDATE/DELETE/TRUNCATE VIVO em bank_splits? → **NÃO (refutado)**
- Sweep `src/` (excl e2e/scripts/migrations) → **zero** UPDATE/DELETE/TRUNCATE em `bank_splits`. `bankSplitRepository` é **INSERT-only** (`bank-split.repository.ts:222`).
- **Cleanup de teste removido:** `validate-pipeline-e2e-policy-engine-metrics.ts` (diff −16/+5) agora **só INSERT** em bank_splits (`:158`) + comentário explícito "NÃO deletar bank_splits — a trava física rejeita UPDATE/DELETE" (`:203-206`). O DELETE de teardown sumiu.
- Únicas ocorrências de mutação restantes: o **próprio guard** (regex que ele procura) e o **e2e** (tenta UPDATE/DELETE para PROVAR o bloqueio, allowlistado). Nenhum runtime.

### 2. A trigger impede mutação física sem quebrar INSERT legítimo? → **PASS**
- Migration `20260623120000`: `prevent_bank_splits_modification()` RAISE EXCEPTION + triggers `bank_splits_no_update` (BEFORE UPDATE) e `bank_splits_no_delete` (BEFORE DELETE). Idempotente (DROP IF EXISTS + CREATE OR REPLACE).
- **e2e:bank-splits-append-only → 3/3 PASS:** (1) INSERT legítimo OK · (2) UPDATE → bloqueado (append-only) · (3) DELETE → bloqueado. **ROLLBACK ao fim → Δ bank_* = 0 (dev intocado).** O e2e aplica a migration REAL dentro da tx (DDL transacional) e reverte — prova o trigger sem precisar aplicá-lo no dev.
- **validate:regression-guards rodado AO VIVO → exit=0**; `audit-bank-splits-append-only` GATE OK no chain (linha 264).
- **NP morde nos dois:** remover o trigger `no_update` da migration → `GATE FAIL` "trigger bank_splits_no_update (BEFORE UPDATE) ausente"; injetar `UPDATE bank_splits` em runtime vivo (`bank-split.repository.ts`) → `GATE FAIL` "UPDATE bank_splits em runtime vivo". Restaurado limpo (guard exit=0, diff vazio).

### + Confirmações pedidas
- **Simetria com bank_ledger (0021):** padrão **idêntico** — `0021_ledger_append_only.sql` usa `prevent_bank_ledger_modification` + `bank_ledger_no_update/no_delete` (BEFORE UPDATE/DELETE, RAISE EXCEPTION). A migration de splits é o mesmo molde para `bank_splits`. ✓
- **Zero payout/RLS/dinheiro:** commit = migration (24L) + package.json (wire guard+e2e) + guard (63L) + e2e (72L) + edição do teste policy-engine-metrics (−16/+5). **Nenhum payout / RLS / GRANT / POLICY / bank_ledger / coluna de dinheiro / dado movido.** ✓
- **PROVEN-EPHEMERAL:** o trigger é **provado em tx efêmera revertida**, **NÃO aplicado no `unificard_dev`** ainda. Aplicação real = próximo `migrate-run` (passo OPS, junto da RLS pendente). Estado vivo do dev/aplicação = **IA-BANCO** confirma.

### RESÍDUO HONESTO (simétrico, não-defeito)
TRUNCATE **não** é bloqueado fisicamente por trigger row-level (BEFORE UPDATE/DELETE não dispara em TRUNCATE) — **igual ao bank_ledger 0021** (mesma cobertura, simétrico). Mitigado por: (a) o guard **proíbe estaticamente** `TRUNCATE bank_splits` em runtime vivo; (b) a role de app `unificard_app` (NOSUPERUSER, não-owner) não tem privilégio de TRUNCATE. Não é regressão desta fatia; se quiser cobertura física de TRUNCATE, seria trigger statement-level em AMBAS as tabelas (ledger+splits), frente própria.

## STATUS: **RESPONDIDO — PASS** · HEAD `ece6de7d` (commit `2ff51fe0` ancestral) · PROVEN-EPHEMERAL · working tree limpo · sem commit.

---

# Bloco IA-DINHEIRO (co-assinatura do eixo monetário) — SPLIT-01

**HEAD:** `ece6de7d` · **Revalidou no vivo:** SIM.

**VEREDITO (eixo dinheiro): PASS — fecha o blocker SPLIT-01 (imutabilidade de split agora DB-enforced, simétrica ao ledger).**

1. **EVIDÊNCIAS:** trigger append-only em `bank_splits` (UPDATE/DELETE → RAISE EXCEPTION), simetria 0021; e2e 3/3 (INSERT ok, UPDATE/DELETE bloqueados, Δ=0); runtime INSERT-only; cleanup de teste removido; regression-guards exit=0; NP morde.
2. **RISCOS (do meu eixo):** o blocker SPLIT-01 que levantei no RAIO X (IA-16: "bank_splits sem trigger DB append-only") está **materialmente fechado no disco** — split deixa de ser imutável só-por-disciplina e passa a ser imutável por construção DB, fechando a assimetria com o ledger. Resíduo: TRUNCATE simétrico (acima); aplicação no dev pendente (PROVEN-EPHEMERAL).
3. **RECOMENDAÇÃO:** SELAR. Marcar SPLIT-01 como CLOSED **com ressalva de aplicação** (committed + proven-ephemeral + NOT LIVE IN DEV até migrate-run) — nunca declarar "live" sem IA-BANCO confirmar a aplicação. A captura de fee no ledger e demais blockers de dinheiro real seguem como frentes próprias.
4. **FRONTEIRA:** aplicação da migration no dev / estado vivo dos triggers = **IA-BANCO**. Registro cartorial do fechamento de SPLIT-01 = **IA-DECISOES-DT** + Clayton.
5. **STOPs:** split imutável após ledger (agora DB-enforced); correção só por adjustment/reversal (INSERT), nunca mutação; committed ≠ live (aguarda migrate-run); análise = insumo, **não GO**.

**Status: RESPONDIDO — PASS.** Nenhum dinheiro movido (e2e em tx revertida); negative-proof revertido (working tree limpo); sem commit.
