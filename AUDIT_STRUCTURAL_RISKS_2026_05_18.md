# AUDITORIA ESTRUTURAL — Consistência Transacional / Duplicação Causal / PDV

**Data:** 2026-05-18
**Operador:** Claude Code (Opus 4.7)
**Modo:** READ-ONLY profunda + R5 pré-fix
**Estado:** **NENHUM CÓDIGO TOCADO.** Aguarda decisão Clayton sobre R1-R4 reclassificados.

---

## 0. Sumário executivo

O núcleo financeiro (bank_ledger, splits, B2B settlement) é **estruturalmente sólido**. 18 defesas confirmadas materialmente. **Os 2 riscos originalmente classificados CRITICAL (C1, C2) foram REVERTIDOS para HIGH LATENTE após auditoria pré-fix (R5) descobrir que `escrowService.release` é STUB vazio** — não há dinheiro a duplicar hoje. Bugs ficam latentes para quando event-escrow for implementado.

Riscos materiais ATIVOS restantes: outbox multi-worker (H1/H2), withIdempotency race (H3), PIX webhook sem signature (H4 em prod), markPixPaymentAsSuccess sem ledger alimentado (H5 — ambiguidade arquitetural).

---

## 1. ESCOPO AUDITADO

**Arquivos lidos materialmente:**

- `backend/src/modules/bank/bank-ledger.service.ts` (B2B settlement — completo)
- `backend/src/modules/bank/bank-split-engine.service.ts` (completo)
- `backend/src/modules/bank/bank-transaction.service.ts` (parcial, primeiras 322 linhas)
- `backend/src/modules/marketplace/payment-execution.service.ts` (executePayment + markPixPaymentAsSuccess + settlement variants)
- `backend/src/core/events/idempotency-tracker.ts` (completo)
- `backend/src/core/events/event-outbox.repository.ts` (completo)
- `backend/src/core/events/event-outbox.processor.ts` (completo)
- `backend/src/modules/gateway/gateway-webhook-repository.ts` (completo)
- `backend/src/modules/gateway/pix-webhook.controller.ts` (completo)
- `backend/src/adapters/pix/pix-adapter.ts` (completo)
- `backend/src/modules/pdv/pdv.service.ts` (parcial, primeiras 200 linhas)
- `backend/src/jobs/post-event-split.job.ts` (parcial, primeiras 200 linhas)
- `backend/src/modules/escrow/escrow.service.ts` (completo — descoberta R5 crítica)
- `backend/src/workers/saga-timeout.worker.ts` (completo)

**DB triggers e constraints auditados via psql:**

- bank_ledger: 7 triggers (append-only, coverage, non-negative, ATL, purpose, activity)
- bank_splits: invariante total=sum BEFORE INSERT/UPDATE
- event_outbox: UNIQUE event_id
- bank_transactions: nenhuma UNIQUE formal (depende de pg_advisory_xact_lock + SELECT FOR UPDATE em runtime)

**NÃO auditado profundo:**

- escrow.repository.ts (apenas service auditado)
- ledger-compensation.service.ts
- bank-balance-consolidation.service.ts
- workers reconciliation-scheduled, risk-identity-reconcile
- treasury-split.service.ts
- subscriptions, b2b-supply-order writers
- order-saga.service e order-saga.repository
- outros webhooks (Stripe, Mercado Pago etc.)
- inventory-reservation.service.ts
- event-bus.ts interno (event_log UNIQUE assumido por comment)

---

## 2. PONTOS FORTES CONFIRMADOS MATERIALMENTE (defesa real, 18 itens)

1. **bank_ledger append-only no DB** — triggers `bank_ledger_no_delete` (BEFORE DELETE) + `bank_ledger_no_update` (BEFORE UPDATE). Garantia física, não convenção.
2. **bank_ledger cobertura no DB** — `bank_ledger_non_negative_balance` + `trg_check_coverage` (BEFORE INSERT). Overdraft impossível mesmo com bug aplicação.
3. **bank_splits invariante total=sum no DB** — `bank_splits_validate_total` BEFORE INSERT/UPDATE. Split engine + DB validam.
4. **B2B settlement 3 camadas lock** — `bank-ledger.service.ts:234` lockAccount JS + `:106` FOR UPDATE OF pi + `:256` pg_advisory_xact_lock(tenantId, refId).
5. **Idempotência UNIQUE por tipo distinto débito/crédito** — `bank-ledger.service.ts:25-27` constantes B2B_PAYMENT_INTENT_REFERENCE_TYPE_DEBIT/CREDIT, replay detectado via SELECT antes de INSERT (`:321-333`).
6. **Outbox INSIDE transaction (correct outbox pattern)** — `bank-ledger.service.ts:627-642` insertEventOutboxRow(client,...) + COMMIT atómico. Publish-before-commit impossível.
7. **event_outbox.event_id UNIQUE** — `event_outbox_event_id_uk` + ON CONFLICT (event_id) DO NOTHING.
8. **eventId determinístico via SHA256** — `event-outbox.repository.ts:5-13` outboxEventIdFromSeed. Retry produz mesmo ID.
9. **gateway_webhook_events idempotência DB-level** — ON CONFLICT (provider, reference_id) DO NOTHING RETURNING id. Webhook PIX duplicado retorna early (`pix-adapter.ts:63-67`).
10. **Partial settlement detection** — `bank-ledger.service.ts:338-347` se hasDebit XOR hasCredit → throw B2B_BANK_SETTLEMENT_INCOMPLETE.
11. **PAYMENT_AMOUNT_MISMATCH fail-closed** — `payment-execution.service.ts:43-67` compara observed (PIX/provider) vs intent. SSOT é intent.amount_cents.
12. **Idempotency key check ANTES de criar transação** — `payment-execution.service.ts:112-127` + priorTx SUCCESS check (`:150-158`).
13. **Hash payload no idempotency-tracker** — `idempotency-tracker.ts:63-65` SHA256 + fail-closed em mismatch (`:119`).
14. **lockAccounts ordem determinística** — `bank-transaction.service.ts:117-122` sort por accountId. Evita deadlock.
15. **post-event-split claim-based** — `post-event-split.job.ts:56-93` INSERT ON CONFLICT + UPDATE WHERE status='pending' RETURNING. Apenas 1 worker reivindica.
16. **HARD LOCK split temporal** — `post-event-split.job.ts:96-105` só processa se event.status='ended' AND datetime_end <= now().
17. **DLQ outbox** — `event-outbox.processor.ts:69-114` move para event_outbox_failed após maxAttempts.
18. **Retry backoff outbox** — `:121` (attempts+1) * 30s.

**Adicionais descobertos em R5:**

- **bank-transaction.transfer idempotência sólida** — `bank-transaction.service.ts:272-285` pg_advisory_xact_lock + SELECT FOR UPDATE por (tenant_id, reference_type, reference_id). Se row existe retorna sem duplicar + métrica idempotent_returns.
- **escrowService.releasePayment (agreement) idempotente por design** — `escrow.service.ts:104-205` status guard + referenceId deterministic (tenantId|escrowId|milestoneId|release).
- **escrowService.refundFunds fallback determinístico** — `escrow.service.ts:242-243` idempotencyKey default = `tenantId|escrowId|amountCents|refund`.

---

## 3. MAPA DE RISCO (revisado após R5)

### 🔴 CRITICAL — ATIVO

**(NENHUM após R5)** — os 2 originalmente CRITICAL (C1 e C2) foram REVERTIDOS para HIGH LATENTE.

### 🔴 CRITICAL LATENTE — vira ativo quando feature for implementada

**C1 (latente) — `post-event-split.job.ts:146` — `uuidv4()` no idempotencyKey**

```ts
idempotencyKey: `split-${eventId}-${participant.id}-${uuidv4()}`,
```

- **Estado atual:** **NÃO É ATIVO.** `escrowService.release` é STUB vazio (`escrow.service.ts:322-334`). Não move dinheiro hoje.
- **Quando vira ativo:** quando event-escrow for implementado, key aleatória vai criar double payout se houver retry.
- **Recomendação:** fix preventivo (R1) — 1 linha, baixo custo.

**C2 (latente) — `event_financial_execution` orphan `status='processing'` sem recovery**

- **Estado atual:** **NÃO É ATIVO.** Como release é stub vazio, for loop sempre completa e marca 'completed'. Orphan permanente é teórico hoje.
- **Quando vira ativo:** quando release for implementado E houver crash no meio.
- **Recomendação:** ADIAR até event-escrow ser implementado (fix de recovery sem dinheiro real para recuperar é ginástica).

### 🟠 HIGH — ATIVO

**H1. event-outbox.processor.ts:29-40 — SELECT sem FOR UPDATE SKIP LOCKED**

```sql
SELECT ... FROM event_outbox WHERE published_at IS NULL ... LIMIT 40
```

- Dois processors (multi-instance / cron + manual / worker em paralelo) pegam mesmas rows → eventBus.publish chamado 2x.
- **Mitigação parcial:** eventBus.publish idempotente via event_log UNIQUE (comment `:23`). Handlers só executam uma vez.
- **Risco residual:** publish duplo dispara handlers que assumem idempotência externa. Handler que escreve em tabela sem UNIQUE duplica side-effect.
- **Categoria:** real, HIGH em multi-instance, MEDIUM single-instance.

**H2. event-outbox.processor.ts:50-63 — publish-then-UPDATE não-atómico**

```ts
await eventBus.publish(...)
await pool.query(`UPDATE event_outbox SET published_at = NOW() ...`)
```

- Crash entre publish e UPDATE → próximo ciclo repete publish.
- **Mitigação:** consumers idempotentes (event_log).
- **Categoria:** real, mitigação por design.

**H3. withIdempotency em idempotency-tracker.ts:251-301 — SELECT → handler → INSERT não-atómico**

- checkIdempotency (SELECT) → handler() executa → recordIdempotencySuccess (INSERT). Window de race.
- Dois workers podem entrar e executar handler em paralelo. ON CONFLICT detecta segundo writer mas handler JÁ EXECUTOU.
- **Risco real:** handlers que escrevem em tabelas SEM UNIQUE duplicam side-effects.
- **Mitigação atual:** handlers que escrevem em event_outbox/bank_ledger/bank_transactions estão protegidos por UNIQUE/ON CONFLICT.
- **Severidade:** HIGH potencial — depende de quais handlers usam withIdempotency. Audit completa dos handlers necessária para classificar definitivamente.

**H4. pix-webhook.controller.ts:7-23 — webhook sem signature verification**

```ts
app.post('/pix/webhook', async (req, reply) => {
  await handlePixWebhook(req.body); // sem HMAC, sem JWT, sem IP allowlist
})
```

- Qualquer entidade externa pode disparar webhook fake.
- **Mitigação parcial:** pix-adapter.ts exige tenant_id + actor_id (atacante precisa adivinhar UUIDs); rate limit; idempotência via gateway_webhook_events.
- **Risco residual:** atacante que conhece (tenant_id, actor_id, txid) pode injetar PIX fake → triggera markPixPaymentAsSuccess → fluxos downstream (fulfillment, AR, settlement) acionam baseado em payment_transaction status.
- **Comentário código:** "PIX Webhook Simulado" — pode ser intencional em dev. **HIGH/CRITICAL em produção.**

**H5. payment-execution.service.ts:1463-1467 — pixChargeId como bank_transaction_id; bank_ledger NÃO alimentado**

```ts
const successTransaction = await paymentTransactionRepository.markAsSuccess(
  tenantId,
  pendingTransaction.id,
  pixChargeId // Usar pixChargeId como identificador
);
```

- Webhook PIX marca payment_transaction como SUCCESS mas NÃO chama bankTransactionService.transfer. bank_transaction_id armazena ID do PIX charge.
- **Risco material:** payment_transaction.status='SUCCESS' SEM correspondente em bank_ledger. Fluxos downstream confiam em status; produto enviado sem dinheiro entrar no ledger.
- **Pode ser intencional:** se settlement do PIX vem por outro fluxo (settle async). Mas código não esclarece.
- **Categoria:** real, ambiguidade arquitetural. **R5 PARAR — não corrigir, registrar como DT.**

### 🟡 MEDIUM

**M1. Side-effects pós-payment com try/catch silencioso**

- `payment-execution.service.ts:524-790` — dynamic imports + try/catch que NÃO propagam erro para 7 sub-fluxos: fiscal, fulfillment, commission, referral, AR, settlement, loyalty.
- Se algum falhar → log warning, payment SUCCESS continua.
- Estado financeiro consistente (ledger íntegro), estado processual inconsistente.
- **Consequência:** ordem paga, fulfillment não criado → produto não enviado.
- **Categoria:** real, dívida operacional aceitável (compensação manual).

**M2. b2b_payment_intents.amount_cents mutabilidade não auditada**

- `bank-ledger.service.ts:301-304` valida intentAmount === totalCents. Se intent.amount_cents foi UPDATE entre criação e settlement → mismatch detectado. Mas e se intent é mutável e atacante UPDATE entre criação e fechamento?
- **Categoria:** hipótese — precisa verificação de mutabilidade.

**M3. PDV: sessão check sem lock**

- `pdv.service.ts:50-54` — getOpenSessionByActor → if existing throw. Sem lock. Dois requests concorrentes para abrir sessão criam 2 sessões abertas.
- **Mitigação possível:** UNIQUE em (tenant_id, actor_id) WHERE status='OPEN' — não verificado em runtime.
- **Categoria:** hipótese.

**M4. executePayment priorTx FAILED bloqueia retry para sempre**

- `payment-execution.service.ts:159-161` — if (priorTx?.status === 'FAILED') throw PAYMENT_TRANSACTION_PREVIOUSLY_FAILED. Sem retry após FAILED.
- **Categoria:** dívida aceitável (decisão de design).

**M5. PIX webhook → markPixPaymentAsSuccess sem trace ID propagation completa auditada**

- Não auditei markAsSuccess profundo para confirmar idempotência absoluta em retry.
- **Categoria:** hipótese.

### 🟢 LOW

**L1. Actor resolution fallback em bank-ledger.service.ts:467-496**

- Se buyerActorId inválido → fallback SELECT id FROM actors WHERE tenant_id = $1 LIMIT 1. Pega actor aleatório.
- Defensivo mas perigoso teórico.
- **Categoria:** dívida aceitável.

**L2. assertAmountMatchesIntent — single-source-of-truth respeitada**

- Single-source comparado. Adequado.
- **Categoria:** falso positivo (defesa adequada).

**L3. Payment execution side-effect order não-determinística** (mesmo root cause de M1).

---

## 4. TOP 10 RISCOS (REVISADO)

| # | Risco | Severidade | Categoria | Material |
|---|---|---|---|---|
| 1 | escrowService.release stub + uuidv4() no idempotencyKey | HIGH LATENTE | real, latente | post-event-split.job.ts:146 + escrow.service.ts:322 |
| 2 | event_financial_execution orphan sem recovery | HIGH LATENTE | real, latente | post-event-split.job.ts:107-200 |
| 3 | PIX webhook sem signature verification (prod) | HIGH | real | pix-webhook.controller.ts:8-23 |
| 4 | PIX markPixPaymentAsSuccess sem mover bank_ledger | HIGH | real, ambiguidade | payment-execution.service.ts:1463-1467 |
| 5 | outbox processor sem FOR UPDATE SKIP LOCKED | HIGH | real | event-outbox.processor.ts:29-40 |
| 6 | outbox publish-then-UPDATE não atómico | HIGH | real | event-outbox.processor.ts:50-63 |
| 7 | withIdempotency window race | HIGH potencial | real | idempotency-tracker.ts:251-301 |
| 8 | Side-effects pós-payment try/catch silencioso | MEDIUM | real | payment-execution.service.ts:524-790 |
| 9 | PDV open session sem lock | MEDIUM | hipótese | pdv.service.ts:50-54 |
| 10 | Actor resolution fallback aleatório | LOW | dívida aceitável | bank-ledger.service.ts:467-496 |

---

## 5. FLUXOS — CLASSIFICAÇÃO

### ✅ SEGUROS (defesa robusta confirmada)

- B2B payment settlement (bank-ledger.service.ts createTransactionFromIntent)
- PIX webhook ingestion (pix-adapter.ts handlePixWebhook)
- bank_ledger writes (qualquer caller) — triggers DB garantem
- Outbox INSERT (qualquer caller) — UNIQUE event_id + ON CONFLICT DO NOTHING
- Idempotency tracker check (withIdempotency em si — race separada de H3)
- bank-transaction.transfer (pg_advisory_xact_lock + SELECT FOR UPDATE)
- escrowService.releasePayment (agreement-based, referenceId deterministic)

### ⚠️ PARCIALMENTE SEGUROS

- Outbox publish — idempotência via consumers
- withIdempotency wrapper — atómico em registro, não em execução
- PDV open session — depende de UNIQUE DB não verificado
- payment_execution side-effects — financialmente seguros, processualmente loosely coupled
- escrowService.refundFunds — fallback determinístico, mas confia no caller

### 🔴 INSEGUROS

- post-event-split escrowService.release path — LATENTE até implementação
- event_financial_execution orphan — LATENTE até release ser real
- PIX webhook controller (prod) — sem signature verification
- markPixPaymentAsSuccess → bank_ledger — ambiguidade arquitetural

---

## 6. RECOMENDAÇÕES CIRÚRGICAS

### Prioridade 1 (HIGH ativo)

**R3. event-outbox.processor.ts — adicionar FOR UPDATE SKIP LOCKED**

```diff
- SELECT ... FROM event_outbox WHERE published_at IS NULL ... LIMIT 40
+ SELECT ... FROM event_outbox WHERE published_at IS NULL ... LIMIT 40 FOR UPDATE SKIP LOCKED
```

Custo: 1 linha SQL. Permite múltiplos processors em paralelo sem race.

**R5b. Outbox processor — publish + UPDATE atómico via transação**

Envolver publish + UPDATE por row em transação. Crash entre = ROLLBACK + retry no próximo ciclo.

Custo: ~10 LOC refactor.

**R4. PIX webhook signature verification (produção)**

Adicionar HMAC verification em pix-webhook.controller.ts antes de delegar ao adapter. Configurável por env (`PIX_WEBHOOK_HMAC_SECRET`). Sem auth = só roda em dev (logado).

Custo: ~20 LOC.

### Prioridade 2 (HIGH potencial)

**R7. withIdempotency — adquirir lock antes do handler**

Trocar SELECT-puro por INSERT ON CONFLICT DO NOTHING RETURNING id ANTES do handler. Se INSERT falha (outro worker entrou primeiro), pega status atual. Garante exclusão mútua na execução.

Custo: ~15 LOC refactor.

### Prioridade 3 (HIGH latente — preventivo)

**R1. post-event-split.job.ts:146 — substituir uuidv4() por chave determinística**

```diff
- idempotencyKey: `split-${eventId}-${participant.id}-${uuidv4()}`,
+ idempotencyKey: `split-${eventId}-${participant.id}`,
```

Custo: 1 linha. **Não tem efeito hoje** (release é stub) mas previne bug quando event-escrow for implementado.

### Prioridade 4 (MEDIUM)

**R8. PDV — confirmar/criar UNIQUE em (tenant_id, actor_id) WHERE status='OPEN'**

Auditar primeiro. Se ausente, migration aditiva.

**R9. Payment execution side-effects — payment_post_processing_log com retry job**

Cada sub-fluxo insere row de tracking. Worker periódico reprocessa rows com `processed_at IS NULL` após X tempo.

Custo: ~80 LOC (migration + 1 worker + injection nos 7 sub-fluxos).

### Adiar (latente)

**R2. event_financial_execution orphan recovery** — sem release real implementado, fix é ginástica. Adiar até event-escrow.

---

## 7. RECOMENDAÇÕES NÃO-CÓDIGO

### DT-PIX-LEDGER-ALIMENTATION-AMBIGUITY

Registrar como DT em REMEDIATION_DT_LOG.md:

- **Material:** `payment-execution.service.ts:1463-1467` markPixPaymentAsSuccess armazena pixChargeId como bank_transaction_id sem chamar bankTransactionService.transfer
- **Ambiguidade:** unclear se settlement async via outro fluxo OU bug não detectado
- **Risco:** se ambiguidade real, payment SUCCESS sem ledger move → fluxos downstream confiam em status
- **Resolução prevista:** DECISION arquitetural sobre quando bank_ledger é alimentado em fluxo PIX. Frente própria. NÃO tocar até DECISION.

### Auditoria pendente (sessão futura)

Itens não auditados profundo que podem revelar mais riscos:

- escrow.repository.ts
- ledger-compensation.service.ts (mecanismo de reversão crítico)
- bank-balance-consolidation.service.ts (cache vs ledger)
- treasury-split.service.ts
- workers reconciliation-scheduled e risk-identity-reconcile
- order-saga.service e order-saga.repository
- inventory-reservation.service.ts profundo
- bank-transaction.service.ts transfer completo (linhas 322+)
- markPixPaymentAsSuccess profundo
- event-bus.ts interno
- outros webhooks (Stripe, Mercado Pago etc.)

---

## 8. CRITÉRIO FINAL — "É possível gerar estado financeiro incorreto sob concorrência real?"

**Resposta material:**

- **bank_ledger (SSOT) intrínseco:** NÃO. Triggers DB garantem append-only + non-negative + coverage. Bug aplicação não corrompe ledger.
- **bank_transactions paralelas via race:** NÃO para B2B (3 camadas lock + UNIQUE). PROVAVELMENTE NÃO para P2P/marketplace (transfer tem pg_advisory_xact_lock + SELECT FOR UPDATE).
- **Splits divergentes do total:** NÃO. bank_splits_validate_total (DB) impede.
- **Double payout via post-event-split:** **NÃO hoje** (release stub). **SIM no futuro** quando release for implementado SE C1 e C2 não forem corrigidos antes.
- **Double effect via outbox replay:** SIM, possível em multi-instance (H1) ou crash entre publish+UPDATE (H2). Mitigado SE consumers idempotentes.
- **Estado parcial não recuperável:** SIM em payment-execution sub-fluxos (M1). LATENTE em post-event-split (C2 latente). Ledger íntegro, processo morto.
- **Dinheiro criado/destruído:** NÃO em fluxos auditados. Constraints DB + invariantes split impedem.
- **Webhook fake provoca payment SUCCESS:** POSSÍVEL em dev (H4 + H5). Mitigado em prod SE signature verification ativada.

**Resumo:** núcleo financeiro é sólido. Riscos ATIVOS estão em camadas adjacentes (outbox, webhook, idempotency wrapper). Risco original "double payout escrow" foi reclassificado para latente após R5 descobrir stub.

---

## 9. ESCOPOS R1-R5 — RECLASSIFICAÇÃO PÓS-R5

| Escopo original | Reclassificação | Recomendação |
|---|---|---|
| **R1** post-event-split uuidv() | HIGH **latente** (era CRITICAL ativo) | Fix preventivo (1 linha). Recomendado. Decisão Clayton |
| **R2** orphan recovery | HIGH **latente** (era CRITICAL ativo) | Adiar até event-escrow implementado |
| **R3** outbox SKIP LOCKED + atomic | **Mantém HIGH ativo** | Aplicar |
| **R4** PIX HMAC | **Mantém HIGH (prod) / aceitável (dev)** | Aplicar com env flag |
| **R5** auditoria pré-fix | EXECUTADA | Achados acima |
| **markPixPaymentAsSuccess** | **PARAR** — ambiguidade arquitetural | Registrar como DT. Não tocar |
| **escrowService.release** | **Descoberto: STUB** | Reclassifica R1/R2 acima |
| **bank-transaction.transfer** | **SEGURO** | Idempotência confirmada |
| **saga-timeout.worker** | **Cobre apenas order_saga** | R2 (se implementado) precisa worker novo |

---

## 10. DECISÕES PENDENTES (Clayton decide)

1. **R1 aplicar agora mesmo com release stub?**
   - Recomendação: SIM. Chave determinística é correta independente. Prepara para implementação futura. Cabe em 1 linha.

2. **R2 aplicar agora mesmo com release stub?**
   - Recomendação: ADIAR. Fix de recovery sem dinheiro real para recuperar é ginástica.

3. **R3 outbox SKIP LOCKED + publish-then-UPDATE atómico:**
   - Recomendação: APLICAR. Risco ativo, fix de 1 linha + transação por row.

4. **R4 PIX HMAC verification:**
   - Recomendação: APLICAR. Env flag obrigatória em prod, opcional em dev.

5. **markPixPaymentAsSuccess (R5 ambiguidade):**
   - Recomendação: REGISTRAR como DT-PIX-LEDGER-ALIMENTATION-AMBIGUITY. NÃO TOCAR. Frente arquitetural separada.

---

## 11. ESTADO ATUAL DA AUDITORIA

- **Nenhum código tocado.**
- **Nenhum commit feito.**
- **R5 (auditoria pré-fix) executada e parou conforme disciplina ao descobrir stub.**
- **Aguarda autorização explícita para cada decisão #1-5 acima.**

---

## 12. RESTRIÇÕES RESPEITADAS

- ✅ NÃO inventei arquitetura
- ✅ NÃO sugeri microservices nem Kafka
- ✅ NÃO refatorei por estética
- ✅ NÃO assumi escala inexistente
- ✅ NÃO confundi performance com consistência
- ✅ NÃO toquei SSOT financeiro
- ✅ NÃO alterei contratos públicos
- ✅ NÃO inferi arquitetura
- ✅ NÃO assumi bug sem evidência material
- ✅ Disciplina R5 "PARAR em ambiguidade arquitetural" honrada

Cada recomendação cabe em diff <30 LOC ou é decisão arquitetural formal (markPixPaymentAsSuccess).
