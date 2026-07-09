# DECISION-0165 — Pipeline financeiro canônico + modelo de fundo regional (sistema virgem)

**Status:** ✅ RATIFICADA por Clayton 2026-07-09 (GO CONDICIONADO: **Fase 0 docs-only liberada;
Fase 1 de código BLOQUEADA** até martelo de MVP — ver §3). · **Contrato de decisão exigido pelo
`00_AGENT_PROTOCOL.md` §2.3.2/§2.3.3 antes de qualquer alteração estrutural financeira.**
**Frente de execução vinculada:** `F-BANK-SPLIT-PIPELINE-CONSOLIDATION-VIRGIN-SYSTEM`
(cartório: `REMEDIATION_DT_LOG.md`, entrada 2026-07-09).

## 0. Contexto (por que esta decisão existe agora)
O sistema está **virgem**: zero usuário real, zero empresa, zero produto/serviço/locação, zero
transação, zero centavo no `bank_ledger`. Uma auditoria forense de 12 seções (2026-07-09) confirmou:
o Bank SSOT é forte (`bank_ledger`/`bank_transactions`/`bank_splits`/`bank_accounts` + invariantes DB
+ fronteira limpa + sink firewall default-OFF), mas coexistem **motores de split paralelos** e
**contadores de saldo paralelos**, hoje contidos apenas por flag — e o **fundo regional é roteado por
STRING** `country-state-city`, sem bairro, sem FK. Num sistema vivo isso se contém com guard; num
sistema virgem, a segurança máxima é **excisar antes de nascer dinheiro**. Esta DECISION promulga a
**doutrina** desse trabalho; a **execução em código é fatiada e gated** (§3).

## 1. O que promulga (doutrina — D1..D9)
- **D1 (base = comissão)** — A redistribuição social/regional incide sobre a **comissão do UnifiCard**
  (`unificard_commission_cents`), **NUNCA sobre o valor bruto** da venda. A comissão é a base de
  distribuição; a custódia do vendedor nunca é base. (Corrige o modelo atual, que distribui sobre o
  bruto — `bank-split-engine.service.ts`.)
- **D2 (jurisdição = endereço cadastral do comprador)** — A base geográfica do split é o endereço
  cadastral canônico do **actor comprador**: PF = residência (`address_assignments` role RESIDENCE);
  PJ = endereço fiscal/HQ (role HQ). A premiação opcional da PJ ao próprio bairro é linha SEPARADA,
  não a regra regional padrão.
- **D3 (fundos por IDs canônicos, nunca string)** — Contas de fundo regional são resolvidas por
  **IDs geográficos canônicos** do Location Core (`country_id`/`state_id`/`city_id`/`neighborhood_id`),
  jamais por nome/string livre. A autoridade de "qual fundo" vive em **FK real** (tabela resolver
  `regional_fund_accounts`), não em parsing de `owner_id`. O `owner_id` textual pode existir como
  rótulo derivado de UUIDs, nunca como fonte de decisão.
- **D4 (voucher = entitlement, não saldo)** — O benefício inicial à população é o **voucher**, tratado
  como **direito de uso** (`amount_cap_cents`, `eligible_actor_id`, concept/categoria permitida,
  `region_scope`, `valid_until`, `status`), **NUNCA saldo do cidadão**. O dinheiro **permanece na
  `bank_account` do fundo** e só se move no **resgate**, como pagamento Bank do fundo para o
  fornecedor/prestador. Voucher jamais vira `actor_wallet` do cidadão. Distribuição direta de dinheiro
  a pessoa física fica para o futuro (KYC/risco/antifraude/compliance maduros).
- **D5 (sistema virgem autoriza EXCISÃO, não contenção)** — Enquanto não há dinheiro real, os
  mecanismos financeiros paralelos são **removidos** (não contidos por flag). Guard anti-revival de um
  paralelo é substituído pela **inexistência** do paralelo. (Execução gated — §3.)
- **D6 (snapshot no split)** — Toda linha de `bank_splits` carrega **snapshot imutável de jurisdição**
  (`country_id`/`state_id`/`city_id`/`neighborhood_id` usados naquele momento) **+ `policy_version_id`**
  que a gerou. Não é saldo paralelo — é prova histórica do porquê aquele dinheiro foi àquele fundo.
  Mudança futura de endereço do comprador NÃO reatribui split passado.
- **D7 (adquirente externo fora do MVP)** — Se não houver integração real com adquirente (Cielo/Stone/
  Pagar.me/Stripe), **não se constrói** conciliação de adquirente, `external_direct`, taxa retida nem
  chargeback-de-cartão. A **decomposição conceitual** (`gross_amount_cents`, `seller_share_cents`,
  `unificard_commission_cents`, `commission_distribution_base_cents`) fica **modelada**; a implementação
  de adquirente é fatia futura, disparada por necessidade real (MVP pode nascer PIX-first / saldo interno).
- **D8 (pipeline canônico — executor ≠ decisor)** — O pipeline financeiro é ÚNICO:
  `economic_policy_engine` **DECIDE/CALCULA** (resolve policy, BPS inteiro) → `bank-transaction.service`
  **EXECUTA** (`createTransactionWithExplicitSplitLines`) → `bank_transactions`/`bank_splits`/`bank_ledger`
  **PERSISTEM**. O policy engine é o motor de DECISÃO, não o executor; quem materializa dinheiro é o Bank.
  Nenhum split calculado fora desse caminho; nenhum percentual hardcoded em fluxo novo.
- **D9 (policy append-only/versionada de verdade)** — Policy econômica ativa é **imutável por versão no
  BANCO**, não por convenção de código. `economic_policies`/`economic_policy_lines` recebem proteção
  append-only equivalente à do `bank_ledger` (hoje só têm trigger de `updated_at`). Alterar percentual/
  seletor de policy ativa exige **nova versão**, nunca UPDATE in-place.

## 2. Rastreabilidade normativa (`00_AGENT_PROTOCOL` §2.2.2)
Governa e é honrado por esta decisão:
- `CORE_SPLIT_PAGAMENTO_CANONICO.md` (nível 1) — `bank_splits` única tabela de split; policy via
  `economic_policies`/`_lines`; proibição de segunda verdade / hardcoded em fluxo novo (§2.3, §12).
- `SSOT_REGISTRY_UNIFICARD.md` — SSOT financeiro = `bank_ledger`/`bank_transactions`; `regional_funds`/
  `group_accounts` NÃO-primárias; `payment_intents` "não decide dinheiro"; `unifycard_transactions` = LOG.
- `LEDGER_SOVEREIGNTY.md` + `INVARIANTES_OPERACIONAIS_LEDGER.md` — ledger append-only; DB garante
  append-only/teto, não fechamento (disciplina de código obrigatória).
- `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` — sistema único; nenhuma camada cria realidade paralela;
  SQL a `bank_*` só em `modules/bank/`.
- Location Core (DECISION-0020) — `countries→states→cities→neighborhoods` + `addresses` +
  `address_assignments` como SSOT geográfico; DECISION-0079 (bairro textual proibido como autoridade
  territorial/fiscal) é a razão de D3.
- DECISION-0047/0048 — `economic_policy_engine` canônico; `bankSplitEngineService` = legado subordinado
  (cutover pendente); hardcoded em fluxo novo = fail-closed. D5/D8 executam esse cutover já decidido.

## 3. Fronteiras — o que esta DECISION NÃO faz (execução gated)
- **NÃO autoriza Fase 1 (código).** Nenhuma deleção/migração/excisão/alteração de código, migration,
  Bank runtime, rotas/jobs/workers ou schema (`bank_splits`/`economic_policies`/`bank_ledger`/
  `bank_transactions`/`bank_accounts`) ocorre sob esta DECISION. Fase 1 exige GO explícito de Clayton +
  o GATE do protocolo (§2.3.2) por fatia.
- **Decisão de MVP PENDENTE (martelo de Clayton).** A doutrina está ratificada; o ESCOPO da excisão
  depende de decidir, por contexto, o que é MVP (migrar) vs não-MVP (remover). Recomendação de Clayton
  registrada como pendente na entrada do cartório `F-BANK-SPLIT-PIPELINE-CONSOLIDATION-VIRGIN-SYSTEM`:
  `service_booking`=manter MVP/retirar legado depois · `group_contribution`=HOLD · `event_ticket`/
  `ride_payment`=remover · `p2p_transfer`=remover · `work-assignment`=remover se trabalho-com-dinheiro
  não for MVP. **Ainda não cravado — Fase 1 bloqueada até o martelo.**
- **NÃO ativa split regional, não semeia saldo, não cria voucher, não religa sink/firewall.**

## 4. Sequência de execução (referência; cada fase gated)
Fase 0 (esta DECISION, docs-only) → Fase 0.5 (análise read-only + cartório append-only) → [MARTELO MVP]
→ Fase 1 (excisão) → Fase 2 (travas: append-only policy, Σsplits=amount, snapshot+policy_version_id em
`bank_splits`, resolver `regional_fund_accounts` por FK) → Fase 3 (SSOT geográfico: popular neighborhoods,
endereço resolvendo IDs) → Fase 4 (contas de fundo por FK) → Fase 5 (policy de comissão BPS) → Fase 6
(voucher) → Fase 7 (painel público/autogestão). **Regra dura:** nenhum saldo semeado / sink religado até
Fase 2 fechada e selada.
