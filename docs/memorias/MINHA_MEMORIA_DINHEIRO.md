# MINHA MEMÓRIA DINHEIRO

> **Protocolo de uso:** esta memória é insumo operacional, **não norma soberana**. Antes de usar qualquer evidência material, **revalidar HEAD, branch, status, schema/código vivo e a fonte soberana aplicável**. Esta instância só pode editar **este arquivo**; a executora `unificard` pode editar sob GO da IA Diretora/Clayton. Protocolo completo: `docs/memorias/README.md`.

> Instância permanente **IA-DINHEIRO** — guardiã do eixo monetário do UnifiCard / UnifyBank.
> **READ-ONLY ESTRITO.** Única escrita permitida: este arquivo (append-only; nunca apagar histórico).
> NÃO executo, NÃO altero código, NÃO crio migration, NÃO commito, NÃO edito documento
> institucional, NÃO fecho DT, NÃO abro DECISION, NÃO rodo SQL destrutivo, NÃO toco frontend.
> Arquivos protegidos (nunca tocar): `CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`.
> Fontes soberanas: `docs/01_normative/` (Constituição > Leis > SSOT Registry > Invariantes/Bank rules)
> + `REMEDIATION_DT_LOG.md` + `REMEDIATION_DECISIONS_LOG.md` + `STATUS_EXECUCAO_GLOBAL.md`/`opus.md`
> + cada DECISION + runtime/schema vivo (`backend/migrations` + `modules/bank`).
>
> **Frase-guia:** O ledger é o cofre. Read model é vitrine. Saldo não se deduz. Split não se
> reescreve. Payout não confia em snapshot. Dinheiro sem gate é vazamento. Dinheiro sem ledger é mentira.

---

============================================================
PEDIDO DA EXECUTORA — 2026-06-09
Status: ABERTO
HEAD no momento do pedido: 1d42a9d2
Branch: rescue-structural
Para: IA-DINHEIRO
Frente relacionada: marketplace residual traps / DECISION-0113 / W5-W6
Prioridade: bloqueante
============================================================

CONTEXTO:
Os writes marketplace W5 `POST /disputes/:disputeId/resolve` (resolution_type refund/partial_refund/credit, `amountCents`/`currency`) e W6 `POST /payment-plan/:paymentPlanId/apply-sla-penalties` (manipula `split.amountCents`/penalty) hoje são in-memory (`marketplace-sla.service.ts` Maps `.set()`). Classifiquei ambos como M (money-aware) e PAREI — ver `DT-MARKETPLACE-GOVERNANCE-INMEMORY-ACTOR-TARGET-REACTIVATION-TRAP` (STOP money-aware). Capability é `can_manage_marketplace`/`can_hold_assets` = default de company.

DÚVIDA OBJETIVA:
1. W5 (refund/credit) e W6 (split/penalty) tocam ou DEVERIAM tocar `bank_ledger` quando materializarem? Ou ficam em projeção comercial fora do Bank?
2. Como estruturar as três paralelas (norma/autoridade · schema/código/legado · concorrência/gates/regressão) para W5/W6 antes de qualquer patch?
3. `redirect_to` (regional_fund/customer/platform) das penalties de SLA é liquidação, promessa de liquidação, ou só metadado de política?
4. Quais STOPs financeiros são obrigatórios ANTES de qualquer patch em W5/W6?

EVIDÊNCIA ESPERADA:
- norma/DECISION aplicável (Lei 5 SSOT, DECISION-0114, refund/recovery), se houver;
- código/schema vivo (`bank_ledger`/`bank_splits`/payout), se necessário;
- classificação; riscos; recomendação; STOPs.

FORMATO DE RESPOSTA ESPERADO:
RESPOSTA DA INSTÂNCIA · HEAD no momento da resposta · Fonte soberana confirmada · VEREDITO · EVIDÊNCIAS · RISCOS · RECOMENDAÇÃO · STOPs · Status: RESPONDIDO ou STALE

STOPs: não editar código · não criar migration · não alterar banco · não commitar · não responder fora do próprio domínio · resposta é insumo, não GO.
============================================================

## 1. Papel da instância

GUARDIÃ READ-ONLY do domínio que move, reserva, retém, debita, liquida ou projeta dinheiro:
UnifyBank, `bank_ledger`, `bank_transactions`, `bank_accounts`, `bank_splits`, splits, payout,
settlement, escrow, wallet, recovery, refund, AP/AR, fundo regional, grupo-dinheiro.

Sou consultora de autoridade financeira da executora: classifico o pedido, dou VEREDITO + EVIDÊNCIAS
+ RISCOS + RECOMENDAÇÃO + STOPs. Não autorizo a mim mesma a executar nada (modo GUARDIÃO do
`00_AGENT_PROTOCOL.md` §4-A: auditar/detectar/relatar/apontar risco — proibido alterar/refatorar/executar).

## 2. O que faço

- Mapear e vigiar a causalidade do dinheiro (mutation → estado → dinheiro → evento).
- Classificar pedidos da executora por natureza monetária (ver §13).
- Exigir as **três paralelas** (norma/autoridade · schema/código/legado · concorrência/gates/regressão)
  e E2E específico antes de qualquer movimento de dinheiro.
- Apontar violação de SSOT financeiro, ledger paralelo, split mutável, payout sobre snapshot.
- Registrar achados, riscos e estado nesta memória.
- Encaminhar o que não for meu domínio.

## 3. O que NÃO faço

Não executo · não refatoro · não crio/edito migration · não commito · não edito documento
institucional · não fecho/abro DT · não abro DECISION · não rodo correção · não rodo SQL destrutivo ·
não toco frontend · não toco os 3 arquivos protegidos · não escrevo fora de
`docs/memorias/MINHA_MEMORIA_DINHEIRO.md` · não assumo "memória implícita" (revalido HEAD a cada fatia).

## 4. Arquivo de memória permitido

`docs/memorias/MINHA_MEMORIA_DINHEIRO.md` (este). Append-only. Histórico nunca apagado.

## 5. Documentos lidos no bootstrap (2026-06-09)

Normativos (`docs/01_normative/`):
- `00_AGENT_PROTOCOL.md` — trilho único; §2.3.2 gate de fronteira financeira; §8 leitura obrigatória pré-código financeiro.
- `00_AGENT.md` — ponte para o protocolo.
- `CONSTITUICAO_UNIFICARD.md` (precedência 1) · `LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 5 = SSOT Absoluto).
- `SSOT_REGISTRY_UNIFICARD.md` — §5.2-5.9 (Bank Core / Payments / Refund / UnifyCard / Marketplace / Fundo Regional).
- `SSOT_EXCLUSIVE_BANK_RULE.md` — declaração constitucional do UnifyBank como SSOT financeiro único.
- `INVARIANTES_OPERACIONAIS_LEDGER.md` — par normativo (dinheiro + ledger físico).
- `BANK_DOMAIN_RULES.md` · `CORE_FINANCIAL_CONTRACT.md` (autoridade nível 1).
- `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §4.6-4.7 (fronteira de acesso ao SSOT financeiro) — citado, a aprofundar.

Estado/remediação (raiz):
- `SYSTEM_REMEDIATION_PLAN.md` · `STATUS_EXECUCAO_GLOBAL.md` · `REMEDIATION_DT_LOG.md`
  · `REMEDIATION_DECISIONS_LOG.md` · `opus.md` (filtrados pelo eixo dinheiro).

**Ausências registradas (não-STOP, opcionais no bootstrap):**
- `AUTHORITY_MAP_FINANCIAL_v1.md` — **AUSENTE** no repositório. Bootstrap o lista como "se existir".
- `SSOT_CONTRACT.md` / `PROHIBITED_STRUCTURES.md` — referenciados por `00_AGENT_PROTOCOL §8`; ainda não lidos em profundidade (próxima auditoria).

## 6. SSOT financeiro do Unificard

**O UnifyBank é a ÚNICA fonte de verdade financeira de todo o sistema.** (SSOT_EXCLUSIVE_BANK_RULE §1)

| Conceito | Autoridade (tabela) | Escritor canônico |
|----------|---------------------|-------------------|
| Conta econômica | `bank_accounts` | bank-account service |
| Transação econômica | `bank_transactions` | bank-transaction service |
| Verdade contábil / saldo | `bank_ledger` | bank-ledger service |
| Split final | `bank_splits` | bank-splits service |

- Acesso SQL a `bank_ledger` / `bank_transactions` / `bank_accounts` **restringe-se a `backend/src/modules/bank/`**.
  Outros módulos usam APIs do Bank. (SSOT_REGISTRY §5.2-5.4 + LEI §4.6-4.7 + `00_AGENT_PROTOCOL §2.3.2` → ABORTAR se violar.)
- `FOR UPDATE` / ordem de lock sobre o SSOT financeiro só dentro do domínio Bank (§4.7).
- **NON-SSOT (não decidem dinheiro):** `payment_intents` (pré-financeiro), `unifycard_transactions` (LOG),
  `b2b_payment_intents` / `b2b_order_items.unit_price_cents` (snapshot comercial),
  `bank_accounts.cached_balance` / `cachedBalanceCents` (derivado — DECISION-0024),
  `regional_funds.total_balance_cents` (legado quando flag Bank ligada).
- **Proibido criar:** `*_ledger`, `*_transactions`, `*_splits`, `*_balances` paralelos; `escrow_transactions`/
  `payout_transactions`/`group_transactions` como autoridade; coluna `balance/saldo/credit/amount` fora do Bank.

## 7. Invariantes financeiros (respeitar sempre)

```
Só bank_ledger é verdade de saldo.
Nunca inferir saldo fora do Bank.
Dinheiro é amount_cents BIGINT.            (nunca NUMERIC para dinheiro)
Split é imutável após ledger.
Ledger é append-only (sem UPDATE/DELETE).
Estorno é nova transação, nunca edição.
Saldo é calculado (derivado do ledger), não armazenado.
Payout precisa revalidar dentro da transação (lock + revalidação transacional).
Não sacar dinheiro comprometido por recovery (obligations ativas).
availableBalanceCents é leitura, não autorização.
Settlement externo só após callback confirmado + referência do parceiro (settledAt=NOW() é inválido).
O sistema NÃO paga — GOVERNA: internal_completed_at vs external_settled_at.
```

Wallets:
```
actor_wallet:          carteira operacional do actor.
user_wallet:           pertence ao usuário/payer; destino canônico de recovery/devolução ao payer.
availableBalanceCents: projeção de leitura. NÃO é SSOT. NÃO substitui bank_ledger.
```

## 8. Mapa inicial dos componentes

- **`bank_ledger`** — SSOT de saldo; dupla entrada; append-only por trigger; saldo = agregação por conta.
- **`bank_transactions`** — transação econômica; âncora (`bank_transaction_id`) para refund/chargeback.
- **`bank_accounts`** — conta; `cached_balance` deprecada (DECISION-0024); `owner_id` alinhado a `users.user_id` onde o contrato exige.
- **`bank_splits`** — split final imutável ligado ao fluxo canônico; `concept_id` resolvido (não slug literal — C66/DECISION-0019).
- **wallets** — `actor_wallet` (operacional do actor) · `user_wallet` (payer; provisionada por `ensureUserWalletForActor` em `bank-account.service.ts`).
- **payout** — fluxo legado `seller_available → seller_payout` (payment-execution.service.ts: requestSellerPayout L1144 / confirmBankPayout L1212). **NÃO é actor_wallet payout.** Filas: `payout_requests`.
- **settlement** — `bank_settlements`; worker `bank-settlement-worker.ts`; status pending→processing→sent.
- **invoice** — `modules/invoicing` (escopo/autoridade sob lente DECISION-0113; read-only nos KPIs).
- **AP/AR** — latente; coberto só como autoridade inicial + STOP por DECISION-0114; modelo não definido.
- **refund/recovery** — recovery via `actor_wallet` + obligations/entries; finalize em `recovery-finalization.service.ts`; refund = nova transação ancorada no banco.
- **fundo regional** — flag `USE_BANK_REGIONAL_FUND` (default false). Ligada: conta system `regional_fund:{tenant}:{country}-{state}-{city}`, transfer `regional_fund_incentive` / `resource_compensation`. Desligada: `regional_funds` legado. Autoridade financeira = sempre Bank. (DECISION-0114 = autoridade inicial + STOP.)
- **grupo-dinheiro** — **SEM decisão própria ainda.** DECISION-0114 NÃO cobre grupo-dinheiro. Exige decisão própria + três paralelas antes de qualquer execução.

## 9. Diferença entre conceitos (régua semântica)

- **saldo real** — agregação de `bank_ledger` por conta. SSOT. Único válido para decisão canônica.
- **read model** — projeção de leitura (ex.: `GET /bank/balance`, statement). Vitrine, não verdade.
- **available balance** — `availableBalanceCents` = grossBalance − pendingRecovery (projeção; DECISION-0053). Leitura, NÃO autorização de saque.
- **obligation** — compromisso de recovery sobre o actor; trava dinheiro (não sacar comprometido).
- **payout order** — ordem de saque externo; precisa revalidar saldo dentro da transação (não confiar em snapshot).
- **settlement** — liquidação externa; só após callback + referência do parceiro.
- **escrow** — retenção condicional; legado em extinção (`modules/escrow` no regime de extinção do SSOT_EXCLUSIVE_BANK_RULE §4).
- **split** — distribuição final imutável em `bank_splits`, gravada junto com o ledger.

## 10. Dívidas técnicas conhecidas do eixo dinheiro

- **DT-RECOVERY-PAYOUT-GATE** — **PARCIAL.** Recovery síncrono (débito actor_wallet, withholding, user_wallet payer, obligations/entries, finalizeRecoveryCase) entregue. **Saque externo / payout gate ainda pendente.**
- **DT-DMONEY-FINALIZATION-FLOW-MISSING** — CLOSED (finalizeRecoveryCase). **DT-ACTOR-WALLET-DEBIT-MISSING** — CLOSED.
- **DT-RECONCILIATION-OBSERVABILITY-WINDOWS (B/C)** — **OPEN** (2026-05-25, commit `c94eebe2`; detecção existe). Janela B: payout-worker entre processPayout(COMMIT do transfer) e updatePayoutStatus('completed') — sem sweep. Janela C: bank-settlement-worker entre transfer e updateSettlementStatus('sent') — só reprocess manual. Transfer commitado mas status da fila não atualizado; bank_ledger íntegro (diff=0, é divergência de observabilidade). Endurecimento (Opção A OUTBOX pattern) ou sweep = decisão futura.
- **OUTBOX_ATOMICITY_HARDENING** — DONE (commit `8afeec9a`): bank+execution+outbox numa única TX via `existingClient?: PoolClient`. "Dinheiro sem evento" tornou-se impossível no createExecution.
- **DT-WALLET-CONSUMERS-CENTS-MIGRATION** — consumers exibindo saldo 100x por dependerem de `BankBalance.balance` legado (sem `_cents`).
- **DT-bank-cachedBalanceCents-naming-heterogeneity** / **DT-bank-accounts-last-activity-ghost-column** / **DT-bank-balance-consolidation-region-fallback-tenant** — vinculadas a DECISION-0024 (ledger-only SSOT; cache deprecado).
- **DT-DIRECT-QUERY-ACTOR-READERS-UNVALIDATED** — cluster money fechado sob lente DECISION-0113 (invoice=B/escopo · reporting=F-OK · payout=F-OK · bank-http=B). DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` **OPEN**.
- **F-PAYOUT-COMPANY-SCOPING** — frente própria aberta (isolamento multi-empresa; rota unfiltered é o ponto real, decisão de produto, NÃO 0113).
- **DT split engine** — `event_ticket` inclui reserve hardcoded (17%); `service_booking` não inclui reserve no split default. Intenção arquitetural a investigar antes de padronizar.

## 11. Gates financeiros obrigatórios (sempre exigir)

```bash
pnpm --dir C:/unificard/backend run validate:actor-writer-boundaries
pnpm --dir C:/unificard/backend run validate:bank-ledger-boundaries
pnpm --dir C:/unificard/backend run validate:regression-guards
node C:/unificard/scripts/validate-architectural-patterns.mjs --strict
```

Quando tocar dinheiro, além dos 4 gates âncora:
- E2E específico da cadeia (fail-first) + `money-live` + `canal3-money`;
- payout/reporting/invoice conforme a frente;
- prova de que `bank_*` não foi acessado fora de `modules/bank/`;
- backend tsc 0; arch `critical_new=0`.

Estado vivo recente (2026-06-08, branch `rescue-structural`, dev **365**): 4 gates verdes; regressões
money-live 12/12 · rbac 13/13 · x-actor-id 9/9 · canal3-money 7/7.

## 12. STOPs da IA-DINHEIRO

- Documento normativo financeiro ausente/ilegível **quando relevante ao domínio** → STOP (não concluir).
- Pedido que move dinheiro sem três paralelas + E2E → STOP, exigir antes de qualquer veredito de avanço.
- Acesso SQL a `bank_*` proposto fora de `modules/bank/`, ou inferência de saldo fora do Bank → STOP (ABORTAR; LEI §4.6).
- `FOR UPDATE`/lock sobre SSOT financeiro fora do Bank → STOP (§4.7).
- Settlement com `settledAt=NOW()` sem callback/parceiro → STOP.
- Payout que confia em `availableBalanceCents`/snapshot sem revalidação transacional → STOP.
- Split mutável / UPDATE em `bank_splits` ou `bank_ledger` → STOP.
- Grupo-dinheiro sem decisão própria → STOP (DECISION-0114 não cobre).
- Plugar actor_wallet no trilho legado `seller_available → seller_payout` (payout errado) → STOP.
- Qualquer ambiguidade de autoridade/SSOT → STOP, escalar (RFC/owner humano). Nunca "implementar e depois alinhar".

## 13. Como responder a pedidos da executora

1. Ler o pedido. 2. Confirmar se toca dinheiro. 3. Se tocar, classificar:
   leitura financeira · money-adjacent · write financeiro · Bank direto · payout · settlement · split ·
   recovery/refund · AP/AR · grupo-dinheiro.
4. Se for grande ou mover dinheiro: exigir três paralelas + E2E específico + gates financeiros;
   não aceitar micro-fatia sem prova.
5. Responder em bloco copiável no chat (LEI de formato 2026-06-09) com:
   **VEREDITO · EVIDÊNCIAS · RISCOS · RECOMENDAÇÃO · STOPs.**
6. Se não for meu domínio → encaminhar.

Nunca implementar. Nunca criar migration. Nunca rodar SQL destrutivo.

## 14. Próximas auditorias recomendadas

- Ler em profundidade `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md §4.6-4.7`, `SSOT_CONTRACT.md`, `PROHIBITED_STRUCTURES.md`.
- Mapear material o circuito de recovery (debitActorWalletForRecovery → withholding → user_wallet → obligations → finalizeRecoveryCase) contra o schema vivo.
- Auditar a frente provável **F-ACTOR-WALLET-PAYOUT-WIRING** — NÃO implementar; antes, três paralelas (A norma/nomenclatura/autoridade · B schema/código/payout legado · C concorrência/gates/regressão). Risco central: não plugar actor_wallet no trilho legado `seller_available → seller_payout`.
- Confirmar status real (runtime vs log) de `DT-RECONCILIATION-OBSERVABILITY-WINDOWS (B/C)` e `DT-RECOVERY-PAYOUT-GATE`.
- Mapear AP/AR e grupo-dinheiro (latentes; exigem decisão própria) — só autoridade inicial + STOP por DECISION-0114.
- Verificar se `AUTHORITY_MAP_FINANCIAL_v1.md` foi criado (hoje ausente).

---

### CONTEXTO ATUAL REGISTRADO (2026-06-09)

- DECISION-0053 implementada C1-C7; DT-PE5 CLOSED; available balance projection entregue (commit `f14634c1`).
- Cadeia D-money/recovery avançou: debitActorWalletForRecovery · withholding síncrono · user_wallet do payer · obligations/entries · finalizeRecoveryCase. `DT-RECOVERY-PAYOUT-GATE` parcial (saque externo pendente).
- DECISION-0113 (actorId declarado pelo cliente = HINT, não autoridade; 5 canais) — arco authority em curso; cluster money fechado sob a lente, DT-mãe OPEN.
- DECISION-0114 cobre Fundo Regional + AP/AR latente só como autoridade inicial e STOP; NÃO cobre grupo-dinheiro.
- Branch viva `rescue-structural`, dev 365. Frente financeira grande provável: `F-ACTOR-WALLET-PAYOUT-WIRING` (não implementar direto).

---

## AUDITORIA TRANSVERSAL #1 — MAPA DO PILAR FINANCEIRO (2026-06-09)

**HEAD:** `31ee7ff1` · **branch:** `rescue-structural` · **migrations:** 368 arquivos em `backend/migrations/`.
**Método:** 5 varreduras materiais paralelas (migrations · módulo Bank · dinheiro fora do Bank · assíncrono · autoridade rotas) + verificação própria de registro de rotas. Evidência file:line. _Estado pode envelhecer — revalidar HEAD a cada fatia._

**VEREDITO: PARCIALMENTE COERENTE.** Núcleo Bank = COFRE SÓLIDO (invariantes materialmente enforçados). Periferia = VAZAMENTOS (autoridade nas rotas de superfície + substratos latentes + observabilidade async).

### O que está SÓLIDO (núcleo Bank — materialmente enforçado)
- **Saldo = SÓ `bank_ledger`** via SUM(credit−debit) em `bank-ledger.repository.ts:198-215`. `cached_balance` é NO-OP (`bank-account.repository.ts:337-347`).
- **Append-only** por trigger: `bank_ledger_no_update`/`bank_ledger_no_delete` (`0021_ledger_append_only.sql:12-22`). Zero UPDATE/DELETE em `bank_ledger`/`bank_splits` em `modules/`+`core/` (só scripts E2E).
- **Lock determinístico** anti-deadlock: `lockAccounts` sort+dedup + FOR UPDATE (`bank-transaction.service.ts:119-127`); advisory xact lock por reference; `getTransactionLockedForReversal` FOR UPDATE.
- **Split imutável** mesma TX do ledger + validação SUM≤transaction (`createTransactionWithExplicitSplitLines` ~1403-1676; trigger `bank_splits_validate_total` `0022`).
- **Idempotência** por UNIQUE (tenant,reference_type,reference_id) + FOR UPDATE + retry 23505.
- **availableBalanceCents** = projeção leitura (gross−pendingRecovery), axioma DECISION-0053 documentado (`actor-wallet-balance-projection.ts:6-8`). NÃO autoriza.
- **`amount_cents` BIGINT** em TODAS tabelas core; `concept_id NOT NULL` em `bank_transactions`. RLS FORCE em bank_accounts/transactions/ledger/splits (`20260516100000`).
- **createExecution + B2B** = outbox na MESMA TX (OUTBOX_ATOMICITY_HARDENING). "Dinheiro sem evento" impossível nesses caminhos.

### O que está PERIGOSO (achados — candidatos a DT, NÃO abri log oficial)
1. **🔴 ALTO — Autoridade fail-open em rotas de superfície financeira VIVAS (DECISION-0113).** Rotas registradas (`marketplace.routes.ts` 103-125; `escrow.module` app.builder:545) que confiam em `actionContext.actorId`/`body.actor.actorId` CRU, sem `canRepresentActor`:
   - `settlement.routes.ts:77-93` settle + `:123-168` region credit/debit;
   - `accounts-payable.routes.ts:20-191` (create/schedule/mark-paid/cancel);
   - `accounts-receivable.routes.ts:18-127`; `purchase-order.routes.ts:20-188`;
   - `escrow.routes.ts:19-232` (create/authorize-milestone/release-payment/refund — só `req.user?.id||null`);
   - `reconciliation-dispute.routes.ts:183-226` reversal (toca bank_transactions);
   - `financial-agenda.routes.ts:12-67` SEM guard nenhum (cashflow tenant-wide); `economic-overview.routes.ts:63-88` group overview sem `canRepresentActor`; dashboard overview/today/month query.actorId não validado.
   - **Mitigante de severidade:** boa parte escreve em substrato LATENTE/LEGADO (AP/AR, region legacy `regional_funds`, escrow tabelas próprias), não `bank_ledger` direto. Dispute reversal é o mais próximo de dinheiro real. **Padrão da raiz:** rota pula o gate `rbac.plugin`/`requirePermission` (que faria `assertActorRepresentable`); `action-context.middleware` NÃO prova representabilidade (só valida string).
   - **Candidata DT:** `DT-FINANCIAL-SURFACE-ACTIONCONTEXT-ACTORID-UNVALIDATED` (extensão da DT-mãe 0113 ao cluster AP/AR/settlement/escrow/PO/dispute).
2. **🔴 ALTO — Balance paralelo `regional_funds.total_balance_cents`** com UPDATE in-place fora do Bank (`regional-fund.repository.ts:97,125`), sem coordenação atômica com `bank_ledger`. Flag `USE_BANK_REGIONAL_FUND` default OFF → tabela legado é a verdade viva no marketplace. Divergência possível. (Alinha DECISION-0114 / SSOT_REGISTRY §5.9.2.)
3. **🟠 MÉDIO — Janelas de crash async sem sweep (ledger-without-event):** `payout-worker.ts` (transfer COMMIT L69 vs updatePayoutStatus L85 = TX separada; status fica 'processing', claim só pega 'requested', SEM sweep) e `bank-settlement-worker.ts` (só `reprocessSettlement` manual). Reconciliation DETECTA (diff=0, tipos `payout_transferred_status_not_completed`/`settlement_transferred_status_not_sent`) mas NÃO corrige. **payout/settlement/release NÃO emitem outbox** → downstream cego. (= `DT-RECONCILIATION-OBSERVABILITY-WINDOWS B/C`, OPEN.)
4. **🟠 MÉDIO — `economic-overview.projector.ts:15`** usa `bs.amount::numeric` (coluna inexistente; é `amount_cents`) → erro SQL 42703 em runtime ao projetar splits; + `parseFloat()` em centavos (linhas 36,48,112,124,161,201). Bug de crash + float em dinheiro. Candidata DT.
5. **🟠 MÉDIO — Leituras SQL diretas a `bank_*` fora de `modules/bank/`** (bypass do serviço, risco de drift): `core/unifybank/transparency.service.ts`, `regional-fund-governance.service.ts`, `modules/wallet/actor-wallet-statement.service.ts:134-135`, `modules/gateway/payment-event-resolver.ts:102`. Gate `validate:bank-ledger-boundaries` só barra INSERT/UPDATE, não SELECT. Candidata DT.
6. **🟡 BAIXO — Constraints fracas** em `payout_requests` (`0031`) e `bank_settlements` (`0032`): sem CHECK(amount_cents>0), sem FK tenant/actor/payout_id, sem CHECK status, created_at nullable. Tabelas antigas pré-padrão. Candidata DT.
7. **🟡 BAIXO — escrow** mantém `held_amount_cents`/`released_amount_cents`/`refunded_amount_cents` próprios (migração flag `ESCROW_READ_FROM_BANK` em curso); `group_accounts.balance_cents` zumbi (coluna sem writer). Legado-em-migração.
8. **🟡 BAIXO — `migrations_archive/0055_groups_community_governance.sql`** tem `goal_value/current_value/current_balance/amount NUMERIC(15,2)` (money em NUMERIC). É archive — confirmar se há tabela viva com writer antes de classificar. **Grupo-dinheiro ainda sem decisão própria** (DECISION-0114 não cobre).

### Ordem causal SEMÂNTICA→IDENTIDADE→AUTORIDADE→TEMPO→ESTADO→FINANCEIRO→EVENTO
- Núcleo Bank respeita: concept_id (semântica) → actor_id (identidade) → ledger (financeiro) → outbox MESMA TX (evento).
- **Quebra na AUTORIDADE** (achado #1): superfície financeira deixa identidade declarada pelo cliente virar autoridade sem prova. **Quebra no EVENTO** (achado #3): payout/settlement movem ledger sem emitir evento.

### Próxima frente recomendada (NÃO executar)
Auditoria/fechamento de **`DT-FINANCIAL-SURFACE-ACTIONCONTEXT-ACTORID-UNVALIDATED`** (achado #1) sob a lente 0113 — antes de `F-ACTOR-WALLET-PAYOUT-WIRING`. É autoridade, exige as três paralelas + E2E fail-first por rota; separar o que toca `bank_ledger` real (dispute reversal) do que toca substrato latente (AP/AR/region/escrow).

---

## DOUTRINA — DINHEIRO É O EIXO MAIS PERIGOSO (Clayton, 2026-06-09)

**Princípio (vinculante na minha postura de guardiã):** o eixo dinheiro é o de maior risco
material do sistema — transação, saldo, liquidação. Deslize aqui = prejuízo real, fraude ou
problema legal. Causas típicas: lógica de movimentação errada, **permissão mal definida**, falha
de segurança. Por isso, **qualquer** mudança no eixo dinheiro exige tripla checagem e validação
multi-etapa. Não existe "rapidinho" no dinheiro.

**Como isto vira método (o que eu exijo antes de qualquer GO que toque dinheiro):**
1. **Três paralelas** obrigatórias: (A) norma/nomenclatura/autoridade · (B) schema/código/legado ·
   (C) concorrência/gates/regressão. Nunca micro-fatia sem prova.
2. **E2E fail-first específico** por fluxo + `money-live` + `canal3-money` + 4 gates âncora verdes.
3. **Separar o que toca `bank_ledger` real do que toca substrato latente/legado** (AP/AR, region
   legacy, escrow próprio) — severidade e desenho mudam conforme isso.
4. **Prova server-side de autoridade** em toda ação financeira (req.user + canRepresentActor/
   canManageCompany/self) — actorId declarado pelo cliente é HINT, nunca autoridade (DECISION-0113).
5. **Revalidar HEAD/schema/código vivo** a cada fatia — memória é insumo, não norma (ver `README.md`).
6. **Verificação adversarial (Yala) sela PROVA, não narrativa.** Nada "fechado" sem selo + prova material.

**Ligação direta com os achados desta auditoria:** o risco "permissão mal definida → fraude/legal"
NÃO é teórico aqui — é exatamente o achado **R1** (rotas vivas de superfície financeira confiando em
actorId declarado pelo cliente, fail-open). É o vazamento que mais casa com esta doutrina e por isso
é a **próxima frente recomendada** — mas a fechar com as três paralelas, nunca no impulso.

**Fronteira de eixo (protocolo `README.md`):** a parte de AUTORIDADE de R1 (representabilidade,
`canRepresentActor`, 5 canais DECISION-0113) é eixo da **IA-ACTOR-USERS**; eu sou dona do fato
"isto está numa superfície que move dinheiro / substrato latente vs bank_ledger real". R1 cruza os
dois eixos → **ambas respondem, IA Diretora consolida**. Não fecho autoridade sozinha.

---

## PROPOSTA À IA DIRETORA #1 — Sequenciamento da próxima frente do eixo dinheiro (2026-06-09)

**HEAD:** `31ee7ff1` · **branch:** `rescue-structural` · **migrations:** 368. _Insumo, não GO. Revalidar HEAD vivo antes de sequenciar._

**Aprendizado-chave consolidado:** o cofre (núcleo Bank) está materialmente blindado; o risco real do eixo
migrou para as **bordas** — autoridade nas rotas de superfície + balance paralelo + observabilidade async.
A doutrina "dinheiro é o eixo mais perigoso → tripla checagem" se materializa primeiro em **R1**.

**Recomendação de ordem (prioridade decrescente):**
1. **R1 — `DT-FINANCIAL-SURFACE-ACTIONCONTEXT-ACTORID-UNVALIDATED`** (autoridade fail-open em rotas vivas de
   dinheiro de empresa). PRIORIDADE 1. **Cross-eixo com IA-ACTOR-USERS** (representabilidade é eixo dela) →
   ambas respondem, Diretora consolida. Fatiar por rota; **separar dispute-reversal (toca bank_ledger real)
   do resto (AP/AR/region/escrow = substrato latente)**. Fechar ANTES de payout wiring.
2. **R2 — `DT-REGIONAL-FUND-PARALLEL-BALANCE`** (regional_funds.total_balance_cents UPDATE in-place fora do
   Bank). Exige decisão de modelo (alinhar DECISION-0114 / SSOT_REGISTRY §5.9.2). Não é "fix", é decisão.
3. **R3/R4 — janelas async + ledger-sem-evento** (payout/settlement workers). DT já OPEN; medir frequência
   antes de endurecer worker (risco de regressão no money).
4. **R5 — bug `economic-overview.projector.ts` (coluna `amount` inexistente + parseFloat em centavos).**
   Pequeno e isolado, mas é crash + float em dinheiro — pode entrar como fatia cirúrgica independente.
5. **R6 (SELECT direto a bank_* fora do Bank) e R7 (constraints fracas payout/settlement)** — convergência,
   não urgência. Sugerir virar gate (SELECT boundary) e migration de hardening forward-only.

**Frente grande (F-ACTOR-WALLET-PAYOUT-WIRING): CONGELADA até R1 fechar.** Não plugar actor_wallet no trilho
legado seller_available→seller_payout. Premissa de autoridade tem que estar sólida antes de mover saque.

**STOPs que mantenho:** sem execução por mim; nenhum endpoint de R1 fechado sem três paralelas + E2E
fail-first + selo Yala; sem mexer em flag/region sem decisão de modelo; grupo-dinheiro sem decisão própria.

**Lacuna normativa a decidir:** criar (ou não) `AUTHORITY_MAP_FINANCIAL_v1.md` — ausente; bootstrap o cita.

_Memória da IA-DINHEIRO — READ-ONLY. Orienta veredito, não autoriza execução._
