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
PEDIDO DA EXECUTORA — 2026-06-10
Status: RESPONDIDO (resposta em AUDITORIA #4 abaixo — HEAD 3d8ad25b, sem divergência)
HEAD no momento do pedido: 3d8ad25b
Branch: rescue-structural
Para: IA-DINHEIRO
Frente relacionada: F-G10-TENANT-SHARED-ISOLATION — superfícies M (tenant compartilhado)
Prioridade: alta
============================================================

CONTEXTO:
A auditoria do denominador tenant-wide achou superfícies VIVAS com materialidade financeira, tenant-only,
no tenant compartilhado. Classifiquei M (escrow, finance/agenda+cashflow, purchase-orders). Preciso da
sua leitura para confirmar M × comercial e desenhar as "três paralelas" da PRIMEIRA frente money.

AUDITAR SEPARADAMENTE:
1. Escrow readers (modules/escrow): GET /api/escrow + /:escrowId + /agreement/:id + /:id/milestones +
   /:id/transactions são tenant-only (sem req.user, sem resolver partes). Quais são as PARTES autorizadas
   (requester/provider actor)? Vínculo com `bank_transaction`? Campos materiais expostos (held/released/
   refundedAmountCents)? Que AUTORIDADE por recurso é necessária antes de cada read?
2. Purchase orders: `unit_price_cents`/`total_price_cents` tornam os readers M ou apenas comercialmente
   sensíveis (preço de compromisso, não movimento de ledger)? Qual actor/company é o proprietário?
3. Finance agenda/cashflow (modules/marketplace/financial-agenda.*): `scheduled_actions` é PROJEÇÃO ou
   AUTORIDADE? Escopo correto = por creator / actor responsável / conta / empresa / tenant? Há risco de
   INFERIR saldo/fluxo fora do Bank (cashflow agrega inflow/outflow tenant-wide)?
4. Daily-metrics com `totalRevenue`: money-adjacent ou M? Pode existir visão institucional cross-tenant
   legítima? Quais E2Es e quais "três paralelas" seriam obrigatórios se virar money?

ENTREGAR:
- divisão recomendada das TRÊS PARALELAS para a primeira frente M (qual é a 1ª superfície a abrir e por quê);
- HEAD na resposta + fonte soberana (Lei 5 / DECISION / schema bank).

STOPs:
`bank_ledger` é único SSOT; NÃO propor gate isolado como solução financeira completa; não editar. Insumo, não GO.

============================================================
PEDIDO DA EXECUTORA — 2026-06-09
Status: RESPONDIDO (resposta em AUDITORIA #3 abaixo — HEAD b6cc69a3)
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

---

## AUDITORIA #2 — Tese do "ENCAIXE UNIVERSAL" sob a lente do dinheiro (2026-06-10)

**HEAD no momento da auditoria:** `92eb49b4` · **branch:** `rescue-structural`.
**Anti-stale:** HEAD moveu de `31ee7ff1` → `92eb49b4`, mas os 5 commits do delta são **docs(memories/remediation) only** — zero mudança em código/migration financeiro. Logo os achados materiais R1–R9 da Auditoria #1 **permanecem válidos** neste HEAD. (Revalidar de novo se o próximo HEAD tocar `modules/bank`/migrations.)

**Objeto auditado:** tese estratégica (Clayton, ligada ao PIVÔ G10 — primeira vertical humana viva / nascimento PF ponta-a-ponta): o sistema acomoda qualquer pessoa/entidade (encaixe universal), e a pergunta crítica é se ele **orquestra essa diversidade de forma escalável, auditável e sem fricção** em autoridade/identidade/coordenação — testável só por **jornada real ponta-a-ponta**.

**Classificação:** tese ESTRATÉGICA/PRODUTO, money-ADJACENT (toca "fluxo de coordenação econômica"). NÃO é write financeiro. Audito **só o lastro financeiro** da promessa; autoridade/identidade = eixo IA-ACTOR-USERS (consolidação Diretora).

**VEREDITO: TESE COM LASTRO NO NÚCLEO, SEM LASTRO COMPLETO NA BORDA.** O "encaixe universal" é materialmente verdadeiro onde mais importa (o ledger), mas a promessa "escalável+auditável+sem fricção" ainda NÃO se sustenta na superfície econômica. A conclusão do texto está CERTA: só a jornada E2E real prova — e pela lente do dinheiro eu **já sei onde a jornada quebra**.

**Onde o encaixe universal TEM lastro (confirmado material, Auditoria #1):**
- `bank_ledger` é UNIVERSAL por construção: uma só verdade de saldo, chaveada por `actor_id`, BIGINT cents, append-only por trigger. PF, PJ, grupo, organizer, seller usam a MESMA estrutura econômica — é exatamente o "capability-additive sem fragmentar ledger" da tese central. Esse é o lastro real da promessa.
- Split/recovery/idempotência/lock materialmente enforçados → o núcleo escala diversidade sem criar verdade paralela.

**Onde o encaixe universal NÃO tem lastro ainda (a jornada E2E vai bater aqui):**
- **Auditável quebra na AUTORIDADE (R1):** rotas vivas de superfície econômica (AP/AR, settlement, region credit/debit, escrow release/refund, dispute reversal) confiam em actorId declarado pelo cliente, fail-open. "Encaixe universal auditável" é falso enquanto qualquer actor puder ser declarado sem prova. Uma jornada PJ ponta-a-ponta que cruze esses fluxos expõe isto.
- **Auditável quebra no EVENTO (R3/R4):** payout/settlement movem ledger sem emitir outbox → observador cego; janelas async sem sweep. "Sem fricção" mascara dinheiro que anda sem rastro de evento.
- **Sem fricção mente no FUNDO REGIONAL (R2):** `regional_funds.total_balance_cents` (legado, flag OFF default) é verdade paralela ao ledger → duas respostas para o mesmo saldo = anti-auditável.
- **Encaixe INCOMPLETO para GRUPO e EMPRESA:** grupo-dinheiro SEM decisão própria (DECISION-0114 não cobre); AP/AR latente. O "encaixe econômico" desses dois papéis é hoje parcialmente aspiracional, não material.

**Predição pela lente do dinheiro — onde a jornada E2E real (G10 PF) toca o eixo:**
- Nascimento PF: CPF→identity→actor. Pergunta money: a gênese PF provisiona `actor_wallet`/`user_wallet`? (`ensureUserWalletForActor` existe; confirmar se o onboarding chama). PF puro provavelmente NÃO toca `bank_ledger` no nascimento — primeiro contato com dinheiro é o 1º recebimento/pagamento. **Para a jornada PF ser "viva" no eixo dinheiro, precisa de pelo menos UM evento econômico real (recebimento) com split+ledger+evento ponta-a-ponta.** Sem isso, o encaixe PF é provado em identidade, não em dinheiro.
- Se a vertical G10 incluir PF recebendo (ex.: prestador), aí entra autoridade da rota financeira → cai em R1. Se for só nascimento+perfil, o eixo dinheiro fica como prova FUTURA, não nesta vertical.

**RECOMENDAÇÃO (insumo p/ Diretora):** endossar o método do texto (jornada E2E real é o teste certo). Pela lente money: definir explicitamente SE a vertical G10 inclui um evento econômico real. Se SIM → a jornada precisa das três paralelas no(s) ponto(s) que tocam dinheiro e provavelmente expõe R1. Se NÃO (só nascimento+identidade+perfil) → o eixo dinheiro fica fora desta vertical e R1/R2 seguem como frentes próprias, NÃO bloqueiam G10. **Não deixar a promessa "encaixe econômico universal" ser declarada provada por uma jornada que não move um centavo real.**

**STOPs:** não executo nada · auditoria é insumo, não GO · autoridade/identidade da tese = IA-ACTOR-USERS, eu cubro só o lastro financeiro · não declarar encaixe econômico "provado" sem ledger+split+evento reais numa jornada.

**Pendência aberta na minha caixa:** PEDIDO DA EXECUTORA W5/W6 — **RESPONDIDO** em AUDITORIA #3 abaixo (HEAD `b6cc69a3`). W5(refund/credit) e W6(split penalty) exigem bank_ledger quando materializarem, mas há BLOQUEIOS de modelo não resolvidos. DECISION específica ausente. G10 excluiu evento econômico real (DECISION-0115 D5).

_Memória da IA-DINHEIRO — READ-ONLY. Orienta veredito, não autoriza execução._

---

## AUDITORIA #3 — RESPOSTA AO PEDIDO W5/W6 (2026-06-10)

**HEAD:** `b6cc69a3` · **branch:** `rescue-structural`.
**Anti-stale:** delta `1d42a9d2→b6cc69a3` = 3 commits docs-only (memories + DECISION-0115). Zero mudança em código/migration financeiro. Achados R1–R9 Auditoria#1 válidos.
**Código vivo lido:** `marketplace-sla.service.ts` (L234-303 W6, L340-369 W5) · `marketplace-sla.routes.ts` (L201-298) · `reconciliation-dispute.service.ts` (padrão reversal).
**Norma verificada:** SSOT_REGISTRY §5.5/§5.7 · DECISION-0111 D3/D6/D9 · DECISION-0113 · DECISION-0114 · DECISION-0115 D5.

### Diagnóstico W5 — `POST /disputes/:disputeId/resolve`

Estado vivo: **100% in-memory**. `resolveDisputeCase()` L340-369 só muta `disputeCases: Map`. Zero DB. Zero bank_ledger.

Por tipo de resolution quando materializar:
- `refund` | `partial_refund` → **DEVEM** tocar bank_ledger (SSOT_REGISTRY §5.7: autoridade = bank_ledger + bank_transactions; chave = bank_transaction_id âncora; estorno = nova TX, nunca edição).
- `credit` → **DEVE** tocar bank_ledger (crédito em conta do customer — qual conta? NÃO decidido; exige DECISION).
- `replacement` → logística; sem ledger financeiro direto.
- `dismissed` → fechamento; sem ledger.

**Bloqueio material:** W5 tem `orderId`/`checkoutId` mas **zero** `bank_transaction_id` âncora. Sem âncora = refund canônico impossível (§5.7). Mapear orderId→checkout→payment_intent→bank_transaction_id é pré-condição.

**Autoridade:** `resolved_by` vem de `req.body.resolved_by` (HINT; DECISION-0113). Authority server-side (`req.user.id + admin-gate`) obrigatória antes de mover dinheiro.

**Padrão a reutilizar:** `reconciliation-dispute.service.ts:281` já usa `requestAndExecuteReversalSync` com `bank_transaction_id` anchor + `external_reversal` type. Não reinventar.

### Diagnóstico W6 — `POST /payment-plan/:paymentPlanId/apply-sla-penalties`

Estado vivo: **100% in-memory**. `applySLAPenaltiesToPaymentPlan()` L234-303 só appenda `pending_penalties` (lista in-memory); NÃO subtrai de `sellerSplit.amountCents` agora. Seta `sla_penalties_applied=true` em objeto in-memory. Zero DB. Zero bank_ledger.

Quando materializar — dois fluxos distintos:
- **Pre-split** (split ainda não gravado em bank_splits): recalcular splits ANTES de gravar. Penalty reduz seller, redistribui para redirect_to. Sem toque direto em bank_ledger (a TX canônica usa o split recalculado).
- **Post-split** (split já em bank_splits): PROIBIDO editar (invariante imutabilidade). Penalty = NOVA TX: débito seller_account + crédito target. Toca bank_ledger.

**Bloqueio em cadeia:** W6 depende de W2(SLA-contract-DB) + W3(snapshot-DB) + payment_plan-DB. Toda a cadeia está in-memory hoje. W6 é ponta, não raiz.

**Risco aritmético:** L261 `(sellerSplit.amountCents * valueCents) / 100` = aritmética float em centavos. Precisa `Math.round()`/`Math.floor()` com política de arredondamento decidida.

### Diagnóstico `redirect_to`

**Hoje: metadado de política transiente** (in-memory, volatiza no restart). Não é promessa formal, não é liquidação.

Para virar liquidação, precisa de DECISION que mapeia:
- `regional_fund` → conta system `regional_fund:{tenant}:{city}` (depende de USE_BANK_REGIONAL_FUND=true, hoje OFF default; R2 OPEN).
- `customer` → user_wallet ou actor_wallet? NÃO definido.
- `platform` → qual bank_account do tenant? NÃO mapeado.

### STOPs financeiros obrigatórios antes de qualquer patch W5/W6

1. STOP se não houver DECISION de marketplace dispute financeira (anchor + tipos + autoridade + credit policy).
2. STOP se W5(refund) sem bank_transaction_id âncora mapeado desde orderId/checkoutId.
3. STOP se W5 sem authority server-side (req.user.id + admin-gate) antes do movimento.
4. STOP se W6 tentar editar bank_splits já gravados (invariante imutabilidade; nova TX obrigatória).
5. STOP se redirect_to='regional_fund' sem R2 resolvido + flag USE_BANK_REGIONAL_FUND=ON.
6. STOP se amountCents não coercido como inteiro antes do Bank (invariante BIGINT).
7. STOP sem três paralelas completas + E2E fail-first + 4 gates + money-live + canal3-money.
8. STOP se write bank_ledger proposto fora de modules/bank/ (SSOT_REGISTRY §5.2, Lei §4.6).
9. STOP se "credit" sem DECISION de conta origem/destino/tipo.

### Riscos financeiros ranqueados

🔴 R1 — W5(refund) sem âncora bank_transaction_id → ledger orphan, devolução sem rastreabilidade.
🔴 R2 — W5 autoridade fail-open (`resolved_by` do body) → fraude/autorização espúria.
🔴 R3 — W6 tentando editar bank_splits já gravados → corrupção contábil.
🟠 R4 — redirect_to='regional_fund' com flag OFF → sem conta de destino = dinheiro sem destinatário.
🟠 R5 — amountCents como JS `number` sem coerção → perda de precisão acima 2^53.
🟡 R6 — aritmética float em penalty → arredondamento silencioso em centavos.

### Classificação final: STOP (bloqueios de modelo não resolvidos)

W5 e W6 não podem materializar sem: (1) DECISION específica de marketplace dispute financeira, (2) bank_transaction_id anchor para W5, (3) decisão de modelo split pre vs post para W6. São frentes próprias futuras, FORA do escopo G10 atual (DECISION-0115 D5 confirma).

_Memória da IA-DINHEIRO — READ-ONLY. Insumo para IA Diretora/Clayton. Não autoriza execução._

---

## AUDITORIA #4 — RESPOSTA AO PEDIDO TENANT COMPARTILHADO (F-G10-TENANT-SHARED-ISOLATION) (2026-06-10)

**Status do pedido: RESPONDIDO.**
**HEAD no momento da resposta:** `3d8ad25b` · **Branch:** `rescue-structural`.
**Divergência HEAD:** NENHUMA — HEAD vivo == HEAD do pedido `3d8ad25b` (`git log` confirma topo). Commit `3d8ad25b` = "fix(authority): scope unread counts for shared tenant" (F-G10-C1-PRECONDITION, Cluster 1 social/feed — o precedente que abriu esta frente).

**Fonte soberana confirmada:**
- LEI 5 (SSOT Absoluto / `bank_ledger` única verdade financeira) + SSOT_EXCLUSIVE_BANK_RULE §4 (escrow em regime de extinção).
- SSOT_REGISTRY §5.5 (split), §5.7 (refund âncora bank_transaction_id), §5.9.1 (B2B/PO = valores comerciais NÃO-SSOT).
- DECISION-0110/0111 (escrow service: release por confirmação, refund pré/pós-release, KYB-no-release, split imutável).
- DECISION-0113 (actorId/parte declarada pelo cliente = HINT; sujeito = req.user server-side).
- DECISION-0115 D1 (tenant inicial vivo compartilhado) + D5 (G10 NÃO inclui evento econômico real agora).

**Arquivos/schema efetivamente lidos:**
- `modules/escrow/escrow.routes.ts` (5 reads + 4 writes), `escrow.repository.ts`, `escrow.types.ts`, `escrow.module.ts` (registro `/api`), migration `20260530270000_escrow_transactions.sql`.
- `modules/marketplace/financial-agenda.routes.ts` + `financial-agenda.service.ts`; `modules/automation/scheduled-action.repository.ts` (listActions L160).
- `modules/marketplace/purchase-order.routes.ts` + `purchase-order.types.ts`; `marketplace.routes.ts` L103/L125 (registro).
- `core/dashboard/daily-metrics.routes.ts` + `daily-metrics.service.ts`; `dashboard.module.ts` (registro `/metrics`).

### VEREDITO

Das 4 superfícies, **apenas ESCROW é M-REAL** (FK direta a `bank_transactions`, expõe movimento de custódia hold/release/refund). Finance-agenda é **M-PROJEÇÃO** (agrega cifras de dinheiro tenant-wide, mas NÃO lê ledger nem infere saldo atual). Purchase-orders é **COMERCIAL-SENSÍVEL** (preço de compromisso, §5.9.1, NÃO-SSOT financeiro) — não-M. Daily-metrics é **MONEY-ADJACENT** (`totalRevenue` é placeholder `return 0`, não toca Bank) — não-M.
**1ª frente money recomendada = ESCROW**, e dentro dela a prioridade material é o **WRITE path (release/refund)**, não os reads.

### EVIDÊNCIAS PROVADAS

**(1) ESCROW — M-REAL, fail-open em read E write:**
- Migration `20260530270000_escrow_transactions.sql:14`: `bank_transaction_id UUID REFERENCES bank_transactions(id)` → **FK real ao SSOT financeiro**. `amount_cents BIGINT CHECK (>0)` (L10), `transaction_type IN ('hold','release','refund')` (L9), idempotency UNIQUE(tenant,idempotency_key) (L23).
- `GET /escrow/:id/transactions` (routes L155-166) → `listTransactions` (repo L476-491) expõe `bank_transaction_id` + `amount_cents` + `transaction_type` + `initiated_by_actor_id`. **Tenant-only**, sem `req.user`, sem resolver partes.
- 5 reads (`GET /escrow`, `/:id`, `/agreement/:id`, `/:id/milestones`, `/:id/transactions`) = **todos `req.tenant` apenas** (routes L54-166). `escrow_accounts` expõe `held/released/refunded/total_amount_cents` + `dispute_status`.
- **Partes autorizadas NÃO estão no escrow** — `escrow_accounts` só tem `agreement_id`/`service_order_id`/`bundle_id` (repo rows L14-32). Requester/provider vivem no **AGREEMENT**. Gate por recurso exige resolver `agreement → partes → canRepresentActor` (cross-módulo).
- **WRITE path é o buraco maior:** `POST /:id/release-payment` (L194-210), `/:id/refund` (L216-232), `/:id/authorize-milestone` (L172-188) → só `userId = req.user?.id || null` (L179/201/223), SEM `canRepresentActor`; o actor-alvo vem do BODY (`releasedByActorId`/`refundedByActorId` = HINT cliente). Refund/release movem dinheiro via `ESCROW_BANK_BRIDGE`/`toBankAccountId` (types L153/L167). = família R1 (Auditoria #1), porém aqui **toca bank_transactions de verdade**.
- Escrow está em **regime de extinção/migração** (SSOT_EXCLUSIVE_BANK_RULE §4; flags `ESCROW_READ_FROM_BANK`/`ESCROW_BANK_BRIDGE`; `EscrowFinancialPosition` compara custody-bank vs legacy held). Desenho da frente deve considerar isso, não tratar escrow como destino final.

**(2) FINANCE AGENDA/CASHFLOW — M-PROJEÇÃO (não lê ledger):**
- `getUpcomingPayables`/`Receivables`/`Settlements` → **retornam `[]`** (service L23-54: "repository removido (migrado/SSOT)"). Só `getUpcomingScheduledActions` (L59-109) alimenta.
- Fonte = `scheduled_action.repository.listActions(tenant,{status:'SCHEDULED'})` (L70), filtra `actionType ∈ {PAYOUT,PAYMENT,SETTLEMENT}` (L90), `amountCents = action.metadata.amount_cents` (L98) = **valor PLANEJADO em metadata, NÃO ledger**.
- `getCashflowProjection` (L159-211) soma `totalInflow/totalOutflow/netCashflow` sobre esses itens. **NÃO há SELECT a bank_ledger/bank_accounts.** Hoje inflow≈0 (sem receivables/settlements), outflow = ações agendadas.
- Escopo: **tenant-wide**. `ScheduledActionFilters` (repo L160-203) tem tenant/status/type/ref/date — **NÃO tem filtro por creator/actor/conta**. Escopar por responsável exige novo filtro.
- Risco "inferir saldo fora do Bank": **NÃO viola "saldo só do Bank"** (não afirma saldo atual; é projeção forward). MAS expõe agregado de movimentos financeiros planejados cross-company no tenant compartilhado = vazamento de inteligência financeira.

**(3) PURCHASE ORDERS — COMERCIAL-SENSÍVEL, não-M:**
- `unitPriceCents`/`totalPriceCents` são `number | null` (types L68/L70) = **preço de compromisso de compra**, NÃO movimento de ledger. Type header L26-27: "NÃO executa pagamentos / NÃO emite fiscal". Enquadra-se em **SSOT_REGISTRY §5.9.1 (valores comerciais, não SSOT financeiro)**.
- Reads (`GET /purchase-orders`, `/:id`, `/:id/items`, routes L42-84) = **tenant-only, SEM nenhum check de actionContext** (enquanto os WRITES L24/97/122/174 exigem `actionContext.actorId`). Assimetria: leitura mais aberta que escrita.
- Proprietário = `createdByActorId` / `supplierId` (types L32/L45). Materialidade = inteligência de preço de fornecedor cross-company, não dinheiro real.

**(4) DAILY-METRICS — MONEY-ADJACENT, não-M:**
- `calculateTodayRevenue` (service L158-162) → **`return 0` hardcoded** ("precisa integrar com Stripe"). `totalRevenue` NÃO vem de bank_ledger.
- Service usa `pool.query` **global, SEM tenant scope** (L124-191: event_organizers/events/organizer_subscriptions/event_metrics) = dashboard institucional **cross-tenant por desenho legítimo** (ops/observabilidade).
- Routes exigem `req.user` mas **"TODO: Verificar se usuário é admin"** (L16/37) = **admin-gate ausente**. O gap é controle de acesso admin, não vazamento financeiro.

### INFERÊNCIAS (claramente identificadas)

- **INF-1:** a divergência custody-bank vs legacy held no escrow (campo `divergence_cents` em `EscrowFinancialPosition`) sugere que os campos `held/released/refunded_amount_cents` em `escrow_accounts` PODEM divergir do `bank_ledger` quando a flag está OFF. NÃO provei o estado da flag em runtime nesta auditoria → tratar como hipótese a confirmar com IA-BANCO-DE-DADOS antes de desenhar leitura canônica.
- **INF-2:** assumo que as partes (requester/provider) do escrow são resolvíveis a partir do `agreement_id`. NÃO li o schema/serviço de `agreements` nesta passada → a viabilidade do gate por-recurso depende de o agreement carregar os actorIds das partes. **INCONCLUSIVO até ler o módulo agreement.**

### RISCOS

🔴 **RISCO-1 (escrow write):** release/refund fail-open (`req.user?.id||null`, actor-alvo do body) movem dinheiro via bank bridge sem `canRepresentActor` → liberação/estorno para conta indevida = perda real. **Mais material que os reads.**
🔴 **RISCO-2 (escrow read):** `/:id/transactions` expõe `bank_transaction_id` + valores de custódia de qualquer escrow do tenant compartilhado → vazamento de movimento financeiro cross-company.
🟠 **RISCO-3 (finance-agenda):** cashflow tenant-wide agrega valores planejados de payout/payment/settlement de todas as empresas do tenant compartilhado → inteligência financeira cross-company (não é saldo, é plano).
🟡 **RISCO-4 (purchase-orders):** preço de compra de fornecedor exposto cross-company (comercial, não dinheiro).
🟡 **RISCO-5 (daily-metrics):** sem admin-gate, qualquer user autenticado vê dashboard institucional; `totalRevenue=0` hoje, mas se um dia ligar a fonte real SEM corrigir o gate, vira exposição financeira.

### RESPOSTAS ÀS DÚVIDAS DA EXECUTORA (uma a uma)

**1. Escrow — partes autorizadas / vínculo bank / campos / autoridade por read:**
- Partes = requester/provider **no AGREEMENT**, não no escrow (escrow só tem `agreement_id`). [INF-2: confirmar que agreement carrega os actorIds.]
- Vínculo bank = **SIM, FK real** `escrow_transactions.bank_transaction_id → bank_transactions(id)` (migration L14).
- Campos materiais expostos: `held/released/refunded/total_amount_cents`, `dispute_status`, `bank_transaction_id`, `transaction_type`, `amount_cents`, `initiated_by_actor_id`.
- Autoridade necessária por read: resolver o(s) actor(es)-parte do agreement do escrow e exigir `canRepresentActor(req.user, parte)` ANTES de cada read; sujeito = `req.user` server-side (DECISION-0113). Hoje há ZERO disso.

**2. Purchase orders — M ou comercial?**
- **Apenas comercialmente sensível**, NÃO-M. `unit_price_cents`/`total_price_cents` = preço de compromisso (§5.9.1 NÃO-SSOT). Não há movimento de ledger, settlement nem payout. Proprietário = `createdByActorId`/`supplierId`. Reads precisam de escopo de representabilidade (mesmo gap), mas **não entram na cadeia de dinheiro real** → NÃO é a 1ª frente money.

**3. Finance agenda/cashflow — projeção ou autoridade? escopo? infere saldo fora do Bank?**
- **PROJEÇÃO**, nunca autoridade (service declara READ-ONLY; soma metadata planejada, não ledger). `scheduled_actions` é fila de ações agendadas, não verdade contábil.
- Escopo correto: por **actor/empresa responsável** pela ação agendada (hoje só tenant; filtro de actor inexistente em `listActions`). Cashflow agregado deveria ser por conta/empresa representável, não tenant-wide.
- **NÃO infere saldo do Bank** (não há SELECT em bank_ledger). Mas **agrega cifras de dinheiro** → tratar como exposição, não como violação de "saldo só do Bank". Se um dia somar saldo real, aí sim cairia em STOP de inferência.

**4. Daily-metrics `totalRevenue` — adjacente ou M? cross-tenant legítimo? E2E/paralelas se virar money?**
- **Money-ADJACENT** hoje (`totalRevenue` = placeholder `return 0`, sem Bank).
- Visão cross-tenant institucional **é legítima por desenho** (dashboard de operação) — o correto é **admin-gate** (resolver o TODO), não tenant-scope.
- **SE** algum dia `totalRevenue` passar a vir de receita real: vira M e exige as três paralelas + E2E fail-first + leitura via **API do Bank** (nunca SELECT direto em bank_ledger fora de modules/bank/) + admin-gate provado. Enquanto for 0, é só dívida de controle de acesso.

### DIVISÃO RECOMENDADA DAS TRÊS PARALELAS — 1ª frente M = ESCROW

**Por que escrow primeiro:** único com FK real a `bank_transactions` e movimento de custódia (hold/release/refund). Maior materiália. Purchase-order é comercial; finance-agenda é projeção; daily-metrics é adjacente/0.

- **Paralela A — NORMA / AUTORIDADE:** SSOT_EXCLUSIVE_BANK_RULE §4 (escrow em extinção — não cristalizar) · DECISION-0110/0111 (release por confirmação, refund pré/pós, KYB-no-release, split imutável) · DECISION-0113 (parte = HINT; sujeito = req.user; `canRepresentActor`) · §5.7 (refund âncora bank_transaction_id). Definir: quem são as partes (resolver via agreement) e qual autoridade por rota (read vs release vs refund).
- **Paralela B — SCHEMA / CÓDIGO / LEGADO:** `escrow_accounts` (sem campo de parte) → `agreements` (partes) [INF-2 a provar] · `escrow_transactions.bank_transaction_id` FK · estado das flags `ESCROW_READ_FROM_BANK`/`ESCROW_BANK_BRIDGE` · divergência custody-bank vs legacy held (`EscrowFinancialPosition.divergence_cents`) [INF-1, confirmar com IA-BANCO-DE-DADOS].
- **Paralela C — CONCORRÊNCIA / GATES / REGRESSÃO:** reads são read-only (sem race), mas o WRITE path (release/refund) exige lock/revalidação transacional no Bank + idempotência (UNIQUE idempotency_key já existe) · E2E fail-first por rota (5 reads + 3 writes) · 4 gates âncora + `money-live` + `canal3-money` · regressão dos fluxos de release/refund existentes · prova de que nada acessa `bank_*` fora de `modules/bank/`.

**Ordem dentro da frente escrow:** começar pelo **WRITE path (release/refund authority)** — é onde o dinheiro realmente se move e o fail-open é mais grave — e fechar os reads no mesmo arco (ambos sob 0113). NÃO confundir com a frente de POLÍTICA de release/refund (DECISION-0110/0111), que é decisão de produto separada.

### DECISÃO DE CLAYTON NECESSÁRIA

- **SIM** para finance-agenda: qual o escopo canônico do cashflow (por empresa/actor responsável vs tenant)? É decisão de produto sobre quem enxerga o fluxo projetado no tenant compartilhado.
- **SIM** para daily-metrics: confirmar que a visão é institucional/admin cross-tenant legítima (então é admin-gate, eixo IA-USUÁRIOS-E-ACESSO) — não é eixo dinheiro.
- **NÃO** para escrow ser a 1ª frente M: isso é classificação técnica que eu sustento (FK real a bank). Mas a POLÍTICA de release/refund é DECISION-0110/0111 (já existe) — Clayton só decide se reabre o runtime do escrow agora ou mantém OFF.
- Fronteira de eixo: a parte de **representabilidade/canRepresentActor** (resolver partes do agreement) é eixo **IA-ACTOR-USERS** → ambas respondem, Diretora consolida.

### RECOMENDAÇÃO

1. Abrir **ESCROW** como 1ª frente M, priorizando o WRITE path (release/refund), sob lente 0113, com as três paralelas acima. NÃO tratar como "gate isolado" — é cadeia de custódia que termina em bank_transactions.
2. Finance-agenda: frente própria de **escopo de projeção** (decisão de produto + filtro por actor em `scheduled_actions`), classificada M-projeção, não bloqueia G10.
3. Purchase-orders: tratar no cluster de **representabilidade de leitura comercial** (mesmo padrão dos reads marketplace 0113), NÃO no eixo dinheiro.
4. Daily-metrics: rota de **admin-gate** (eixo acesso), não dinheiro, enquanto `totalRevenue=0`.
5. Antes de desenhar o gate de escrow: ler o módulo `agreements` para provar INF-2 (partes resolvíveis) e confirmar com IA-BANCO-DE-DADOS o estado das flags/divergência (INF-1).

### O QUE A EXECUTORA NÃO DEVE FAZER

- NÃO propor gate de leitura isolado como "solução financeira completa" do escrow — o write path (release/refund) é o risco maior e tem que entrar no mesmo arco.
- NÃO tratar purchase-order ou daily-metrics como frente money (não tocam ledger).
- NÃO ler `bank_*` direto fora de `modules/bank/` ao desenhar a posição financeira do escrow — usar API do Bank.
- NÃO reabrir runtime de escrow (release/refund) sem KYB-gate + double-entry + lock/revalidação (DECISION-0111 D11).
- NÃO confundir cashflow projetado com saldo — e NÃO transformá-lo em leitura de saldo do Bank.
- NÃO declarar G10 dependente disto: DECISION-0115 D5 já excluiu evento econômico real da vertical → escrow/finance-agenda são frentes próprias, não pré-condição de nascimento PF.

### STOPs

- `bank_ledger` é o único SSOT de saldo; nenhuma destas superfícies pode inferir saldo.
- Escrow write (release/refund) sem `canRepresentActor` + KYB + lock/revalidação transacional → STOP.
- Qualquer leitura/escrita de `bank_*` fora de `modules/bank/` → STOP (LEI §4.6).
- Gate de read proposto sem o write path no mesmo arco → STOP (solução financeira incompleta).
- Sem três paralelas + E2E fail-first + 4 gates + money-live → STOP.
- Não commitar · não editar código/migration/banco/frontend/STATUS/DT/DECISION/opus/outras memórias · resposta é insumo, não GO.

**Status: RESPONDIDO** · HEAD revalidado `3d8ad25b` (sem divergência). INCONCLUSIVOS declarados: INF-2 (partes no agreement) e INF-1 (estado flags/divergência custody) — precisam de leitura do módulo agreement e confirmação da IA-BANCO-DE-DADOS antes do desenho do gate.

_Memória da IA-DINHEIRO — READ-ONLY. Insumo para IA Diretora/Clayton. Não autoriza execução._

---

## ADENDO À AUDITORIA #4 — fechamento dos INCONCLUSIVOS INF-1 / INF-2 (2026-06-10)

**Revalidação:** reli o último PEDIDO do topo (F-G10-TENANT-SHARED-ISOLATION). `git log` → HEAD vivo **`3d8ad25b`** = HEAD do pedido e da AUDITORIA #4. **ZERO divergência → AUDITORIA #4 NÃO está STALE.** Aproveitei o HEAD estável para fechar materialmente os 2 inconclusivos que eu mesma havia deixado.

**Arquivos lidos agora:** `modules/agreements/agreement.types.ts` · `modules/escrow/escrow.service.ts` (L115-230 flags) · `modules/escrow/escrow.routes.ts` (L74 `/financial-position`) · `escrow.types.ts`.

### INF-2 — RESOLVIDO (partes SÃO resolvíveis): ✅

`Agreement` carrega as partes **diretamente** (`agreement.types.ts`):
- `requesterActorId: string` (L34) · `providerActorId: string` (L35) · `createdByActorId` (L44) · `finalizedByActorId` (L47).

Logo a cadeia de autoridade do escrow é **provável e viável**: `escrow_accounts.agreement_id` → `agreements` → `{requesterActorId, providerActorId}` → `canRepresentActor(req.user, parte)`. O gate por-recurso (read e write) tem como resolver as partes sem inventar campo novo. **INF-2 fecha: partes resolvíveis via agreement.** (A representabilidade em si segue eixo IA-ACTOR-USERS.)

### INF-1 — RESOLVIDO PARCIAL (default OFF + read-from-bank NÃO ligado): ⚠️

- **`ESCROW_BANK_BRIDGE`** = env-flag puro, **default OFF** (`=== '1' || === 'true'`, falsy quando ausente — `escrow.service.ts:125,215`). Quando ON: release/refund vão **bank-FIRST** (transfer via `bankTransactionService`/`bankAccountService`, exige `toBankAccountId`, com gate de risco financeiro C54 `requireFinancialRiskClearance`). Bom: a escrita, quando ligada, passa pelo Bank com gate.
- **`ESCROW_READ_FROM_BANK`** = citado **apenas em comentários de tipo** (`escrow.types.ts:47,68`); **`getEscrowFinancialPosition` NÃO existe** (route `/escrow/:id/financial-position` retorna **501** — `escrow.routes.ts:74-76` `TODO(DT-07)`). Ou seja, o caminho canônico "ler custódia do Bank" **não está vivo**.
- **Consequência material:** hoje os reads de escrow servem as **colunas legadas** `held/released/refunded_amount_cents` de `escrow_accounts` — **NÃO** o saldo de custódia reconciliado com `bank_ledger`. O campo `divergence_cents` (`EscrowFinancialPosition`) é um **tipo sem produtor vivo** → **divergência legacy×bank NÃO é detectada em runtime hoje**.

**Refinamento do veredito (não muda a 1ª frente):** o read-authority gap do escrow é **ainda mais relevante** porque exibe cifras de dinheiro **legadas e não-reconciliadas**, e o endpoint canônico de posição financeira está 501. Ao desenhar a frente escrow, a leitura canônica de saldo deve vir do **Bank via API** (resolver DT-07/`getEscrowFinancialPosition`), não das colunas legadas.

### Resíduo de prova (único ponto que permanece fora do meu alcance read-only)

- **Valor de runtime/deploy** das envs `ESCROW_BANK_BRIDGE` / `ESCROW_READ_FROM_BANK` no ambiente vivo: provei o **default** (OFF / não-ligado) e o **código**, mas o valor efetivo em produção depende do `.env`/deploy → confirmar com IA-BANCO-DE-DADOS/infra antes de assumir estado. Não é bloqueante para classificar a frente; é bloqueante para afirmar "custódia reconciliada" em runtime.

**Status: RESPONDIDO** · HEAD `3d8ad25b` (sem divergência) · INF-1 e INF-2 **fechados materialmente** (resíduo único: valor de env em deploy). Nada além desta memória foi alterado; sem commit.

_Memória da IA-DINHEIRO — READ-ONLY. Insumo para IA Diretora/Clayton. Não autoriza execução._

---

## RESEAL FINANCEIRO #1 — F-DISPUTE-REVERSAL-HTTP-AUTHORITY-CONTAINMENT (2026-06-13)

**VEREDITO: PASS COM RESSALVA.** P0 financeiro **contido fail-closed** no edge HTTP; motor financeiro e Bank intactos; sem falso verde. Única ressalva: 2 erros tsc NOVOS em **código morto** abaixo do `return 403` (zero impacto de runtime/financeiro) — limpeza P1.

**ÂNCORA:** HEAD `6fbb01eb` (== esperado) · branch `rescue-structural` · **sem migration** no diff `8af211be..6fbb01eb` · working tree sem drift da frente (só memórias de outras instâncias + untracked pré-existentes, incl. `backend/tmpschema.ts`). dev 378/378 = **reportado pela executora, NÃO re-rodei** (suíte mutável em unificard_dev é proibida no meu modo).

**PROVAS MATERIAIS:**
- **Contenção fail-closed:** `reconciliation-dispute.routes.ts:194` `return reply.status(403) {code:'DISPUTE_REVERSAL_HTTP_DISABLED'}` é a **1ª instrução** do handler — antes de `req.tenant` (L200), `parseActor` (L206) e `executeDisputeFinancialReversal` (L211). Não é `requireRole`/`requirePermission` (sem falso gate RBAC V2).
- **Curto-circuito (E2E efêmero 7/7):** T1 actor.kind=system→403; **T2** dispute inexistente NÃO vira 404 DISPUTE_NOT_FOUND (prova que o service não foi chamado); T4 admin/support→403; **T3** zero nova linha em `reversals`/`bank_transactions`/`bank_ledger`; S1 estrutural (gate precede parseActor/exec); S2 service ainda existe (rota só não o alcança). Rodado em DB efêmera `unificard_dispute_reversal_<stamp>` (guard anti-unificard_dev no wrapper L17 + no E2E L57), dropada no fim.
- **Engine untouched:** `modules/reversal/reversal.service.ts` (onde vive `requestAndExecuteReversalSync`) + arquivos `bank-*` **fora do diff**. Diff de código = só `reconciliation-dispute.routes.ts` (+13).
- **Bank untouched / boundary verde:** `validate:bank-ledger-boundaries` GATE OK [§4.6]. Nenhuma escrita manual em Bank.
- **Gates estáticos:** actor-writer OK · bank-ledger OK · regression-guards OK (FORBIDDEN_REGRESSION=0, FINANCIAL_HARD_STOP=0) · architectural-patterns --strict exit 0, **critical_new=0** (4 warnings novos são em E2E de inventory, fora de dispute/bank).
- **Rotas irmãs intactas:** `/disputes/from-discrepancy`, `/disputes/:id/to-review`, `/disputes/:id/resolve` **não tocadas** no diff; documentadas em DT (P1).
- **DTs registradas:** `DT-DISPUTE-REVERSAL-AUTHORITY-CLIENT-DECLARED` = **OPEN / P0 CONTAINED**; `DT-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY` = **OPEN / P1**.
- **Escopo respeitado:** nada de PJ/CNAE/authority macro/RBAC V2/FASE6/R2.

**RESSALVA (única):** tsc backend final = 45 erros. **43 são baseline** de frentes já fechadas (catalog-governance 16, media-assets 9, company-templates 5, service-offerings 4, module-projection 3, etc.) em arquivos **idênticos** entre `8af211be` e `6fbb01eb` (diff não os tocou). **2 são NOVOS** em `reconciliation-dispute.routes.ts:212` (TS2345 `tenantId: string|undefined`) e `:219` (TS18046 `e: unknown`) — provado por `git show 8af211be:`: no baseline o corpo era **alcançável** (narrowing `if(!tenantId)return` + `catch` aplicado → 0 erro); o `return 403` no topo tornou o corpo **inalcançável** → TS reseta narrowing → 2 erros. **São código morto** (a rota retorna 403 antes; nunca executam) → **zero impacto financeiro/runtime**. **Cleanup P1:** remover o dead code do handler (ou retipar) para zerar o tsc novo. Modelo definitivo de autoridade da rota = frente financeira futura (authority binding), não agora.

**STATUS:** F-DISPUTE-REVERSAL-HTTP-AUTHORITY-CONTAINMENT = **CLOSED** (P0 contido; ressalva é cosmética/P1). DT-CLIENT-DECLARED = OPEN/P0 CONTAINED · DT-MUTATION-ACTOR-BODY = OPEN/P1. Modelo definitivo = frente própria futura. Reseal READ-ONLY: nada além desta memória alterado; sem commit.

_Memória da IA-DINHEIRO — READ-ONLY. Insumo para IA Diretora/Clayton/Yala. Não autoriza execução._

---

## PONTEIRO — FATIA IA-DINHEIRO p/ DECISION-0131 (2026-06-14, HEAD vivo `20fe30cc`)

Contribuí com a fatia executável do eixo dinheiro para o PLANO DEFINITIVO (DECISION-0131, §B pendente de rulings Clayton). Base aprovada: F-AUTHORITY-MAP-0131-v2 (não re-auditada). Resposta entregue em bloco no chat; aqui fica só o ponteiro + os fatos de 1ª mão (revalidados no vivo).

**Verificação READ-ONLY de 1ª mão (unificard_dev, HEAD `20fe30cc`):**
- `financial_approval_policies` ativas = **0** · `financial_approval_authorities` ativas = **0** · `financial_approval_policy_events` = **0** · violações de teto MVP (≤50000/≤150000) = **0**. → Substrato (DECISION-0128/0130) **materializado e DB-enforced, porém NÃO SEEDADO**: hoje todo payout-approval é fail-closed por vazio (422 POLICY_NOT_CONFIGURED / 403 AUTHORITY_NOT_FOUND). Seguro como default.
- **T5 dispute/reversal = CONTIDO 4/4** (reconciliation-dispute.routes.ts: 6× códigos `DISPUTE_(REVERSAL|MUTATION)_HTTP_DISABLED`; `parseActor` sem def/import, só 5 menções em comentário). Supera a ressalva do RESEAL #1 (3 irmãs eram OPEN/P1; dead-code+2 tsc removidos).
- **APROVAR≠EXECUTAR selado:** `executeActorWalletPayout` caller real = só worker (`actor-wallet-payout-worker.ts:74`); rotas payout executoras = 403 `PAYOUT_HTTP_EXECUTION_DISABLED` (payout.routes.ts:64/166/173); menção em `payout-decision.routes.ts:10` é comentário.
- **financial:\*** vivas = `view_ledger` / `view_all_ledger` (adaptador leitura) · `execute_payout` (PROIBIDO-como-autoridade de aprovar/executar; hoje só gateia leitura+rota já 403). Aprovação = `financial_approval_authorities`; nunca role/company_users/execute_payout.

**Frentes que nomeei (ordem dependência):** FM-1 seed policy/authority [gated §B] · FM-2 classificar financial:* [gated §B] · FM-3 hard-rule 6º canal de jure [gated §B] · FM-4 rehab dispute/chargeback COM binding [gated §B+FM2+FM3] · FM-5 auth/captura cartão via bank_ledger idempotente [gated FM4+DECISION-cartão] · FM-6 plano platform/cross-tenant [gated §B/T10-P4] · FM-7 F-PAYOUT-COMPANY-SCOPING [independente].

**Cartão físico BLOQUEADO até (ordem):** PRÉ-1 rehab dispute/chargeback c/ binding (FM-4) · PRÉ-2 captura via bank_ledger idempotente (FM-5) · PRÉ-3 plano platform (FM-6). Trava: availableBalanceCents nunca autoriza; saldo só bank_ledger; cartão = DECISION própria.

**STOPs mantidos:** não promulgar 0131; não fechar 0113 de carona; não reabilitar dispute/reversal sem binding+E2E+reseal; R2/delegação não-ativável como autoridade financeira viva sem proveniência+E2E+reseal; FM-1 só sob ruling de quem é operador financeiro (não seedar no escuro).

_Memória da IA-DINHEIRO — READ-ONLY. Ponteiro de insumo; não autoriza execução._

---

## PONTEIRO — Paralela B / F-C1-MONEY-CANAL1-READ-FIRST-MATRIX (2026-06-15, HEAD vivo `3e7fcda8`, dev 385/385)

Auditoria READ-ONLY de materialidade financeira dos fluxos C1_MONEY (7 cadeias, ~37 handlers) via workflow ultracode (7 auditores + verificação adversarial). Laudo completo entregue em bloco no chat. Fatos de 1ª mão revalidados no vivo:

- **NENHUM fluxo do C1_MONEY inicial move dinheiro em runtime.** AP/AR/settlement-HTTP/region-account = **Proxy fail-fast DORMANTE** (`accounts-payable.service.ts:14-16` / `accounts-receivable.service.ts:11-14` / `settlement.service.ts:11-16` / `region-account.service.ts:10-12` rejeitam toda chamada "migrated to Bank"). purchase-order = COMMERCIAL_SENSITIVE (sem bank). service-payment-request = MONEY_ADJACENT intent (BIGINT ok). event-settlement = MONEY_ADJACENT (auth boa: `canRepresentActor(events.actor_id)`).
- **Único money-mover HTTP (service-payment-execution POST /execute) = BANK_TOUCH/CRITICAL mas FAIL-CLOSED 403** por `service-financial-firewall` (`SERVICE_FINANCIAL_RUNTIME_ENABLED` default OFF, DECISION-0110). Auth = JWT req.user server-side, authoritySource='ownership', sem actorId no body; escreve bank_tx+ledger+splits+intent+outbox numa TX atômica.
- **Money real vivo = workers system-only:** `bank-settlement-worker` (executeSettlementEffects/reprocess/runCycle) CONFIRMADO BANK_TOUCH/CRITICAL (`bankTransactionService.transfer` → ledger/tx/splits, idempotente, treasury:settlement). `settlement-worker` REBAIXADO pela verificação adversarial de CRITICAL→MONEY_ADJACENT (só marca `bank_transactions.external_settled_at`, NÃO toca ledger; o transfer real é do release-worker separado). NÃO é superfície C1 — é cadeia Bank canônica.
- **Achados de norma:** `region_accounts` = balance paralelo fora do bank_ledger (`infers_balance_outside_bank` + `uses_readmodel_as_auth` no GET /regions/:id/account) — dual-truth latente (alinha R2/regional_funds); dormante por Proxy. AP/AR `schedule` grava amountCents em `scheduled_actions.metadata` JSONB (`numeric_money_misuse`). `event_settlements` usa `number` no TS e **migration não localizável** → tipo de coluna INCONCLUSIVO (prova-viva `\d event_settlements`).
- **Auth frouxa LIVE:** `service-payment-request GET` checa só presença de `actionContext.actorId` (sem ownership) → leak de payment-intent. event-settlement já é 0113-compliant.
- **Recomendação 1ª frente money-safe:** hardening de read-authority de `service-payment-request GET` (canal-1, sem Bank, sem ressuscitar Proxy, sem firewall, sem worker). NÃO corrigir junto: des-stub de AP/AR/settlement/region (=criar writer de dinheiro, exige frente Bank + DECISION Clayton), flag do firewall (0110), workers, region_accounts (decisão de modelo), tipagem event_settlements (prova-viva antes).

_Memória da IA-DINHEIRO — READ-ONLY. Ponteiro de insumo; não autoriza execução. Nada além desta memória alterado; sem commit/patch/migration._

---

## PONTEIRO — F-C1-MONEY-SPR-RLS-PREFLIGHT (2026-06-15, HEAD vivo `9edfbdf9`, dev 386/386)

Preflight READ-ONLY: RLS em `service_payment_requests` agora? Workflow ultracode (4 sondas: app-authority · bypass-hunt · rls-mechanics · bank-boundary) + verificação de 1ª mão. Laudo completo no chat.

**VEREDITO: NÃO-GO RLS agora → seguir para outra superfície C1_MONEY** (RLS = GO só após decisão/modelagem; baixa prioridade). Classificação: **MONEY_ADJACENT** (nunca toca ledger; não é saldo). Risco sem RLS: **LOW**.

Fatos de 1ª mão:
- **App-level FECHA o risco imediato** (Probe A): GET exige `canRepresentActor(payer OU receiver)` (routes 152-160), POST exige representar receiver derivado server-side (78-88); body/header/query/actionContext ignorados; subject = req.user (JWT). Terceiro mesmo-tenant → 403.
- **Zero bypass vivo** (Probe B): todos os 8 acessos à tabela são guardados ou internos não-HTTP. Os 4 leitores cross-module — `impact-overview.routes:39` e `pending-responsibilities.routes:38` (ambos `canRepresentActor` + filtram `payer_actor_id` do actor representado), `actor-wallet-statement` (autoridade na rota, LEFT JOIN enriquecimento), `service-order.service:930-935` (leitura interna por booking_id, não-HTTP) — **GUARDED**. Probe B: `rlsAddsRealDefense=NO` (redundante hoje).
- **Threat-model é o nó** (síntese minha, nenhuma sonda isolou): padrão RLS do repo = **tenant-scoped** (`USING tenant_id=current_setting('app.current_tenant')`, FORCE + bypass `unificard_infra`; `20260516100000`). Mas a ameaça do SPR é **intra-tenant** (terceiro do mesmo tenant) → RLS tenant-scoped **NÃO cobre a ameaça** (só cross-tenant, já dado por `WHERE tenant_id`). RLS **actor-scoped** (cobriria a ameaça) exige `app.current_actor` inexistente + BYPASSRLS p/ workers + quebra leitores cross-module/internos + e2es de setup raw-pool → **modelagem + decisão arquitetura, não fatia rápida**. Probe C disse `YES` mas avaliou tenant-RLS (enforceável, porém não-relevante à ameaça).
- **Fronteira Bank intacta** (Probe D): SPR nunca toca bank_*; POST execute = tabela distinta `service_payment_executions` atrás do firewall DECISION-0110 → RLS no SPR não afeta Bank/firewall. `N/A`.
- **Blast**: e2es selados via rota NÃO quebram (tenant-scoped); scripts de setup raw `pool.query` (spr-create/read-authority) QUEBRARIAM (sem app.current_tenant) — DBs efêmeras, contornável com getClientWithTenant.

**Não é bloqueador** para a próxima superfície C1_MONEY. Se RLS depois: decidir tenant×actor-RLS (Clayton/arq.); se actor-RLS → padrão app.current_actor repo-wide + BYPASSRLS sistema + auditar 4 leitores cross-module + re-rodar e2es read/create + negative-proof (terceiro bloqueado no DB mesmo sem guard app).

STOPs mantidos: não toquei Bank/Core/execute/firewall/PO/AP-AR/settlement; não inferi saldo; não relaxei app-level; não declarei C1_MONEY resolvido. Só esta memória alterada; sem patch/migration/RLS/commit.

_Memória da IA-DINHEIRO — READ-ONLY. Ponteiro de insumo; não autoriza execução._

---

## PONTEIRO — F-C1-MONEY-PURCHASE-ORDER-OWNERSHIP-RULING (2026-06-15, HEAD vivo `9edfbdf9`, dev 386/386)

Auditoria profunda READ-ONLY de purchase-order (foco receivePO). Workflow ultracode (4 sondas: po-matrix · receivePO-causal · inventory-materiality · ap/bank-boundary) + leitura de 1ª mão de receivePO. Laudo completo no chat.

**ADJUDICAÇÃO (correção da sonda):** po-matrix rotulou receivePO **MONEY/CRITICAL/creates_obligation=true** — REJEITADO com prova. A AP **sempre falha** (Proxy) e é non-blocking → obrigação **NUNCA nasce**, não toca payable real, não muda status financeiro. receivePO **NÃO é MONEY, NÃO é BANK_TOUCH**.

**Classificação correta de receivePO = MISTO:** **INVENTORY_EFFECT real** (grava `inventory_movements`, SSOT físico append-only — `0102` triggers no-update/delete; quantity NUMERIC(20,4) = quantidade física, OK) **+ MONEY_ADJACENT-DORMANTE** (AP em cents computado mas sempre falha silenciosa). Comando operacional/inventário com cauda financeira fantasma; **não é comando financeiro hoje**.

**2 riscos reais (1ª mão + provados A–G):**
1. **Atomicidade "estoque entrou, dívida não nasceu":** sem TX wrapper; inventory IN auto-commita por item (L209) ANTES da AP; AP em try/catch non-blocking só `console.warn` (L296-299, nem auditado, sem outbox/evento); ordem vira RECEIVED/COMPLETED mesmo sem payable. **Inverso (F):** se `addMovement` lança no meio do loop, itens 1..N-1 já commitados, sem rollback, status calculado em estado parcial.
2. **Autoridade de inventário fraca:** rota `receive` só checa **presença** de `actionContext.actingUserId` (routes L148), sem `canRepresentActor`/`requirePermission`; `addMovement` exige só **elegibilidade** do actor (existe no tenant), não representabilidade; o IN é atribuído a `order.createdByActorId` (criador da PO, **misattribution** — não o recebedor). Qualquer user do tenant recebe qualquer PO e muta estoque sob qualquer actor elegível.

**Mitigantes (cofre-side limpo):** DB força `actor.tenant_id==movement.tenant_id` (sem cross-tenant) + idempotência UNIQUE (tenant,ref_type,ref_id,variant,actor) + inventory_movements imutável; amount_cents BIGINT + Math.round (sem NUMERIC-para-dinheiro). Zero toque Bank/ledger/split/payment_intent/settlement/payout em toda a cadeia PO→inventory→AP. AP = projeção DORMANTE migrada, **não SSOT**; arquivo `accounts-payable.repository.ts` nem existe.

**Matriz PO:** create/submit/cancel = COMMERCIAL_SENSITIVE/MED (auth só presença); add-item = MONEY_ADJACENT/MED (cents, sem commit); **receive = INVENTORY_EFFECT+MONEY_ADJACENT-dormante / risco ALTO no eixo físico-autoridade**; GET list/:id/items = NONE/LOW (só tenant). Nenhuma rota com `canRepresentActor`.

**Recomendação money-safe:** receivePO NÃO é money-mover → eixo dinheiro NÃO bloqueia e NÃO exige Bank. Antes de qualquer authority/payable wiring: **(1) ruling de OWNERSHIP do Clayton** (dono do efeito de inventário e da futura obrigação = criador `createdByActorId` vs recebedor `actingUser`?) — é o nó que dá nome à frente; **(2) decisão de atomicidade** (TX wrapper inventory+status) = correção operacional, não financeira; **(3)** representabilidade no `receive` = frente de AUTORIDADE cross-eixo IA-ACTOR-USERS, money-adjacent, sem Bank. NÃO ligar AP (exige frente Bank + DECISION), NÃO mexer firewall, NÃO tratar a try/catch fantasma como "cria payable". Ordem: ruling → atomicidade/ownership → autoridade. Cartão/Bank fora.

STOPs mantidos: não editei nada além desta memória; sem patch/migration/guard/RLS/commit; Bank/Core/SPR/settlement intocados; não inferi saldo; não propus mover dinheiro nem ligar fluxo financeiro; C1_MONEY não declarado resolvido.

_Memória da IA-DINHEIRO — READ-ONLY. Ponteiro de insumo; não autoriza execução._

---

## PONTEIRO — F-C1-MONEY-PO-COMPANY-OWNER-SCHEMA-PREFLIGHT (2026-06-15, HEAD vivo `522b2059`, dev 386/386)

Preflight READ-ONLY de modelagem company-owned de purchase_order (receivePO está CLOSED/fail-closed: rota 403 L149, service HARD-STOP L172, `receivePOContainedImpl` preservado sem caller L194). Workflow ultracode (4 sondas: schema-classification · owner-model-facts · backfill-facts · boundary-hypothesis) + 1ª mão.

**HIPÓTESE PROVADA (sonda 4, adversarial):** PO deve ser **buyer-company-owned**; autoridade de receive protege o owner que recebe estoque + assume obrigação — **não o criador humano, não o supplier**. Sem casos de consignação/dropship/PF-supplier no código.

**ADJUDICAÇÃO (corrijo a sonda 2):** a sonda owner-model inclinou-se a `created_by_actor_id` como "melhor owner" — **REJEITADO com prova**: o próprio código de contenção (service.ts:172-183) declara `created_by_actor_id` = **AUTORIA, NUNCA AUTORIDADE**; é sempre actor humano (nunca company). Usá-lo como owner = creator-owned = a misattribution que a contenção parou.

**Fatos materiais (1ª mão + sondas):**
- `purchase_orders` (0131): tenant_id, supplier_id (FK suppliers RESTRICT), created_by_actor_id (FK actors RESTRICT), created_by_user_id. **SEM coluna company.** RLS tenant-scoped.
- Company = actor de 1ª classe (`actor_type='actor_organizational'`); **page/org-actor nasce ATOMICAMENTE no nascimento da company** (companies.service.ts:559-651). `actors.company_id` existe mas é **NÃO-FK** (gap de integridade).
- inventory_movements.actor_id = **FK→actors**, SSOT físico append-only per (tenant,actor,variante); backfill PO hoje usa created_by_actor_id (fallback temporário, não autoridade).
- canRepresentActor opera em actor_id; company authority via actor.company_id→company_users.canManageCompany.
- **supplier = tabela `suppliers` própria, SEM actor_id/company_id** → supplier estruturalmente NÃO pode ser actor-owner; é credor/contraparte.
- user→**N empresas** (UNIQUE(company_id, global_user_id) permite N). **Zero dados legados de PO** (0131 é DDL-only).
- Owner migration é ortogonal a AP (Proxy dormante) e Bank (B2B only) — schema-only, não toca Bank.

**Classificação:** PO = COMMERCIAL_SENSITIVE; receivePO futuro = INVENTORY_EFFECT + MONEY_ADJACENT (NÃO MONEY/BANK_TOUCH); inventory IN = efeito físico material, SSOT inventory_movements, owner REQUERIDO; AP futuro = MONEY_ADJACENT/obrigação, Bank boundary limpo.

**Owner recomendado (lente dinheiro): G) `buyer_company_actor_id`** (actor org da empresa compradora) — único que unifica inventory IN (FK→actors) + canRepresentActor + futuro obrigado AP. Nome encoda "buyer" p/ excluir supplier para sempre. **Variante endurecida H) par** `buyer_company_actor_id` + `buyer_company_id` (com FK real a companies, fechando o gap NÃO-FK de actors.company_id). REJEITADOS: A tenant-wide (pior; multiempresa), B creator-owned (PROIBIDO; autoria≠autoridade), C company_id-só (não alinha inventory), E owner_actor_id genérico (perigoso; sem guard semântico), F buyer_company_id (gap inventory), D company_actor_id (nome fraco). I manter-contain = status quo válido até ruling.

**Backfill (lente dinheiro):** auto PROIBIDO p/ criador com 0 ou N empresas (owner inexistente/ambíguo) e company SUSPENDED → `pending_owner` + recertificação; 1-empresa-ACTIVE = único auto-inferível (ainda recertificar); criador removido → orphan/pending_owner; sem histórico → pending_owner. `is_primary` NÃO é desambiguador seguro p/ dinheiro. **Zero legado hoje → migration forward-only: coluna nullable + pending_owner default, NOT NULL só após certificação; novos POs exigem owner no create.**

**Ordem:** ownership ruling (Clayton) → owner schema (+FK fix) → atomicidade (TX/saga; a try/catch non-blocking de AP QUEBRA atomicidade) → representabilidade (canRepresentActor) → só então reabilitar receivePO com E2Es. Atomicidade ANTES do owner = inútil/nociva (cimentaria owner errado).

**Fica fora:** Bank/ledger/split/settlement/payout; re-home de AP→Bank (frente própria + DECISION); firewall; SPR; NÃO reabilitar receivePO; owner migration NÃO toca AP/AR.

STOPs mantidos: só esta memória alterada; sem patch/migration/guard/RLS/commit; não destravei receivePO; não liguei AP/AR; Bank/Core/ledger/split/settlement/SPR intocados; não inferi saldo; C1_MONEY não resolvido.

_Memória da IA-DINHEIRO — READ-ONLY. Ponteiro de insumo; não autoriza execução._

---

## PONTEIRO — F-ACTOR-SCOPED-REFERRAL-EARNINGS-AUDIT (2026-06-16, HEAD vivo `1565a184`, dev 393 migrations)

Auditoria READ-ONLY: dinheiro de indicação cai no actor dono do código ou preso ao user/CPF? Workflow ultracode (4 sondas: code-link · split-engine · wallet-account · frontend-earnings-rides) + 1ª mão.

**VEREDITO: USER_EARNINGS_ONLY → MONEY_RISK contra o diferencial Unificard.** Referral é 100% USER/CPF-scoped, sem nenhuma dimensão de actor no caminho do dinheiro. Regra de produto (código por actor → wallet do actor) é **estruturalmente impossível hoje**.

**Cadeia financeira real (toda USER-scoped, provada 1ª mão):**
`users.referral_code` (0066, 1 código por user; referral.service.ts:12-89) → `user_referral_links` (DECISION-0119; referrer_user_id/referred_user_id→users, SEM coluna actor; 20260613120000) → `getActiveReferral(fromUserId)→referrerUserId` (referral-helper) → split engine cria leg `splitType:'referral'` 5% (bank-split-engine.service.ts:168-191) → **`getAccountByOwner(referrerUserId, 'user', currency)`** (L173-178, owner_type HARDCODED 'user') → `targetAccountId = conta do USER` → bank_splits (metadata `{referrerUserId, referredUserId}`, sem actor). Earnings só fluem em evento taxável (event_ticket/ride) com fromUserId — link é desacoplado do pagamento.

**Adjudicação:** probe 4 rotulou "COMPLIANT" — REJEITADO; seus achados confirmam USER_SCOPED. O "compliant" é só "sem bug de mistura" (há 1 só escopo). UI gating `isUser` (DashboardHome.tsx:156,435) = banda/empresa NEM VEEM nem recebem referral → isso É a violação.

**DB proofs:** referral split NÃO tem owner_actor_id; referrer_user_id só em metadata JSON (não coluna); target_account_id NOT NULL = conta do USER (getAccountByOwner referrerUserId,'user'); bank_splits tem target_actor_id NULLABLE (DECISION-0036) mas o leg referral NÃO o popula. bank_accounts.owner_type DB = ('actor','system','escrow'); 'user' da API mapeia p/ DB 'actor' com owner_id=userId (bank-account.repository.ts:34-50). actor_wallet EXISTE (ensureActorWalletAccount, account_type='actor_wallet', owner_id='{actorId}:actor_wallet') mas só usado por D-money service_order release — NUNCA por referral. **Zero FK/campo preserva o dono econômico (actor) do código.**

**Substrato actor-aware dormante:** `marketplace/referral.repository.ts:50` tem tabela `referral_codes.owner_actor_id` — actor-aware, mas LEGADO/não-canônico, NÃO ligado ao split de earnings (caminho vivo é o core user-scoped).

**Risco diferencial:** CPF com PF+banda+empresa = 1 código → 1 referrerUserId → 1 conta de user → todo rendimento colapsa no CPF; banda/empresa não podem ter código próprio nem receber. O diferencial "actor soberano recebe o próprio rendimento" não existe no dinheiro.

**Invariantes OK (cofre-side):** split via writer canônico (bankSplitRepository.createSplit, mesma TX, source_actor_id NOT NULL), imutável pós-ledger, amount_cents BIGINT, Math.round; não escreve Bank fora do writer. O problema é ATRIBUIÇÃO (user vs actor), não integridade do ledger.

**Próxima macrofrente (NÃO implementar; três paralelas + DECISION):** F-REFERRAL-ACTOR-OWNERSHIP — mover código de `users.referral_code` p/ actor (ou `actor_referral_codes`), `user_referral_links`→actor-aware (referrer_actor_id), e split target `getAccountByOwner(referrerActorId,'actor'/actor_wallet)`. Cross-eixo IA-ACTOR-USERS (code=lookup, não authority; só actor representável gera código próprio). Guards sugeridos: audit-referral-code-actor-owner-boundary · audit-referral-earnings-target-actor · audit-referral-code-not-user-only. Rides referral = domínio próprio (também user-scoped), fora do C1.

STOPs: nada editado/commitado; só esta memória; sem patch/migration/guard; não propus implementação direta (frente money-adjacent → três paralelas + DECISION antes de executor); Bank/ledger/split intocados; C1_MONEY não resolvido.

_Memória da IA-DINHEIRO — READ-ONLY. Ponteiro de insumo; não autoriza execução._

---

## RODADA 1 / TASK O3 — re-baseline eixo dinheiro (2026-06-20, HEAD vivo `dd270f41`, branch rescue-structural, 395 .sql migrations)

Tarefa da IA-DIRETORA (canal §14.3 do PLANO_ORQUESTRACAO_SISTEMICA): o payout-hardening recente (`dd270f41` toctou · `cd697da7` db role/RLS · `e0fe89b9` reseal) adiantou B5/C3 do 0131? estado money + 0140/0141 (fee-bps). Resposta destinada à minha §14.7.2 do plano (write em alta contenção por escritas paralelas; registro aqui como cópia durável).

**VEREDITO:** payout-hardening **NÃO adiantou B5/C3 no sentido próprio** (os 6 planos de autoridade). Endureceu conjunto vizinho money-cêntrico (RLS nas 7 tabelas payout/approval/recovery), interseção de **só 1** dos 6 planos (`financial_approval_authorities`). Avançou materialmente o **endurecimento do eixo dinheiro** (toctou execute-time + role NOSUPERUSER/NOBYPASSRLS + RLS tenant-scoped do substrato payout) — mas COMMITTED + PROVEN-EPHEMERAL + NOT LIVE IN DEV + PROD-FAIL-CLOSED. Estado money go-live inalterado: payout NOT AUTHORIZED · PORTA-1 NOT SEEDED · worker default-off · HTTP 403. 0140/0141 (fee-bps) = régua DOCS-ONLY, NÃO materializadas.

**Evidências 1ª mão:**
- `dd270f41`: `actor-wallet-payout.service.ts` (+48) — `executeActorWalletPayout` chama `requireFinancialRiskClearance(action='financial_payout',amountCents)` revalidando ATL→KYC→KYB→GUARDA com envelope de payout (antes só transfer com envelope errado maxTransfer); + bloqueio recovery pending_approval FOR UPDATE. Provas 5/5 efêmero; guard audit-payout-toctou-safety (77 OK/0 FAIL). Axioma: execute-time nunca mais permissivo que approval-time. = frente F-PAYOUT-TOCTOU-SAFETY-HARDENING, não B5/C3.
- `cd697da7`: migration `20260620120000_db_role_rls_hardening.sql` — role unificard_app NOSUPERUSER/NOBYPASSRLS + ENABLE+FORCE RLS + policy tenant-scoped (app.current_tenant) + infra_bypass TO unificard_infra nas 7 tabelas (L69-176): actor_wallet_payout_requests, financial_approval_policies, financial_approval_authorities, financial_approval_policy_events, approval_requests, actor_wallet_recovery_obligations, actor_wallet_recovery_obligation_entries. Preflight db-role-rls-preflight.ts no BOOT.ts (fail-closed prod). Mata "RLS theatre" (app conectava como superuser).
- B5/C3 (PLANO-DEFINITIVO-0131-EXECUTORA.md:25,45,71): 6 planos de autoridade = company_users · actor_delegations · financial_approval_authorities · tenant_operator_grants · reconciliation_disputes · reversals — "RLS=0 em TODOS os 6" (L25). C3 (L71)=ENABLE+FORCE+policy tenant_id, gated B5·depende de C1 (mapper identidade). Interseção {7}∩{6}= só financial_approval_authorities; outros 5 planos RLS-OFF.
- `e0fe89b9` (reseal WM1): migration COMMITADA (395 .sql) mas NÃO aplicada ao unificard_dev (394 aplicadas; 7 tabelas RLS OFF em dev). role unificard_app = objeto cluster-global criado em efêmero, não prova aplicação no dev. Selo CLOSED/MATERIAL/YALA PASS_WITH_WARNINGS/PROVEN-EPHEMERAL/PROD-FAIL-CLOSED/NOT LIVE IN DEV. Ativação = passo ops fora do repo; não autoriza PORTA-1/worker/external/HTTP/go-live.
- Disco: 395 .sql migrations; nenhuma migration contém fee_rate_bps.
- 0140: régua fee_rate_bps INTEGER/feeRateBps DOCS-ONLY; NOT DONE; DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION OPEN/MATERIAL_REQUIRED; trilho CONTIDO 501; bug 299¢vs3¢ latente (/100).
- 0141: SSOT fee/split = economic_policy_engine/economic_policy_lines.bps (DECISION-0047); payment_methods NÃO é SSOT; execução futura gross_cents*fee_rate_bps/10000; proibido /100. DOCS-ONLY.

**Riscos:** C3 mascarado (não declarar avançado — 5/6 OFF); RLS tenant-scoped ≠ ameaça intra-tenant (cobre cross-tenant, não actor-vs-actor; exigiria C1/actor-scoped); NOT LIVE (efêmero, dev RLS OFF, committed≠live); fee-bps latente (não inferir resolvido).

**Recomendação:** re-baseline = payout-hardening avançou endurecimento do eixo dinheiro (toctou+role+RLS substrato payout/approval/recovery), NÃO B5/C3 (5/6 planos OFF e ABERTOS; donos IA-AUTORIDADE+IA-BANCO). Carimbar COMMITTED+PROVEN-EPHEMERAL+NOT LIVE+PROD-FAIL-CLOSED, nunca "fechado/live". fee-bps = régua DOCS-ONLY; materialização exige Evidence Pack + 3 paralelas + E2E 299¢ + negative-proof /100 + Yala. MACRO 6+ diferida.

**Fronteira:** IA-AUTORIDADE (RLS dos 6 planos é eixo dela; eu = interseção financial_approval_*/payout/recovery) + IA-BANCO (prova-viva runtime-aplicado-no-dev = INCONCLUSIVO) + IA-DECISOES-DT (cartório B5/C3 + DTs).

**Status: RESPONDIDO** (runtime-aplicado-no-dev = INCONCLUSIVO → IA-BANCO).
