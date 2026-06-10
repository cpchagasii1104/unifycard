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
