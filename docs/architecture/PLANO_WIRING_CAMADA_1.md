# Plano de Wiring — Camada 1 (Serviço de Preço Fechado)

> **Sessão de leitura:** 2026-05-26 · **HEAD:** `675b6449` (mapa do fluxo econômico).
> **Decisões Clayton (já tomadas):**
> - **D1:** `seller_pending` é creditado quando o **prestador conclui o serviço** (Opção próxima de B/E do mapa anterior — gatilho explícito após confirmação de pagamento + ato de conclusão).
> - **D2:** `seller_available` é creditado quando o **buyer confirma** **OU** **timeout de 7 dias** (config) **OU** disputa pausa e escala para admin manual.
> - **D3:** Payout é **manual** (rota seller), com **gates** (KYC, saldo, capability, cooldown/velocity).
> - **D4:** `bank_settlement` é **1:1** com payout completado.
> - **Workers são canônicos.** Simulador (`paymentExecutionService.*`) vira ferramenta dev/admin. Camada 2 (cancelamento parcial, refund, milestones múltiplos) é frente futura.
>
> **Este documento NÃO implementa.** Mapeia o que existe, o que falta, e propõe a sequência mínima de fatias na ordem de dependência. A primeira fatia executável é nomeada no final.

---

## 1. O que existe vs falta por elo

### BLOCO A — Pagamento confirmado e conclusão do serviço

#### A1 — "Pagamento confirmado" hoje

**Existe e é canônico:**

| Item | Onde | Campos relevantes |
|---|---|---|
| `payment_intents` | `backend/src/modules/payments/payment-intent-repository.ts` | `payment_status` enum: `'pending' \| 'escrowed' \| 'settled' \| ...` |
| `service_payment_requests` | migration `20260530494000_create_service_booking_decisions_and_payment_requests.sql:20-42`, repository `service-payment-request.repository.ts` | UNIQUE por `booking_id`; status próprio |
| `service_payment_executions` | migration `20260530514000_create_service_payment_executions.sql`, service `service-payment-execution.service.ts:57+` | UNIQUE por `payment_request_id`; `executed_at`; FK para request + actors |
| `bank_transactions` + `bank_ledger` | núcleo bank | `external_settled_at` marca confirmação externa (pelo `settlement-worker`) |

**Modelo material do "pago" hoje:** o ato de "pagar um serviço de preço fechado" produz **uma `service_payment_execution`** com `executed_at` preenchido, e simultaneamente um `bank_transaction` com 2 entries (`bank_ledger`: débito `user_wallet` do pagador, crédito conta GENÉRICA do receiver via `getOrCreateAccount`). **Não há** estado `'paid_confirmed'` distinto de `'executed'`; a execução já é o ato de pagamento confirmado no Unify Bank.

**O ELO QUEBRADO já documentado em `MAPA_FLUXO_ECONOMICO_AUTOMATICO.md`:** o crédito vai para conta default (`account_type='credit'`), **não** para `seller_pending`.

#### A2 — A pergunta-chave: o ato "prestador marcou concluído" existe?

**SIM, EXISTE E ESTÁ COMPLETO.**

| Camada | Evidência |
|---|---|
| Tabela | `service_orders` (declarada em `backend/migrations_archive/0610_service_orders.sql` mas viva no codebase — `service-order.repository.ts` faz INSERT/SELECT/UPDATE da tabela em produção) com status `'completed'` + `completed_at` |
| Types | `backend/src/modules/services/service-order.types.ts:7` enum `ServiceOrderStatus = 'draft' \| 'confirmed' \| 'in_progress' \| 'completed' \| 'cancelled'`; `CompleteServiceOrderInput` em L91-95 |
| Service | `backend/src/modules/services/service-order.service.ts:299-423` — `serviceOrderService.completeOrder(tenantId, orderId, input)` |
| Rota | `backend/src/modules/services/service-order.routes.ts:192-211` — `POST /service-orders/:id/complete` |
| Auditoria | L396-417: `recordAudit({ eventType: 'SERVICE_ORDER_COMPLETED', ... })` + business audit log |
| Hook escrow | L359-372: já autoriza milestone `'completed'` em `escrow_accounts` automaticamente ao completar a ordem |

**Implicação para a 1ª fatia:** o gatilho `service_order completed` **já existe**. O wiring de D1 (`escrow → seller_pending`) pode pendurar imediatamente nesse ponto (no `serviceOrderService.completeOrder` ou em handler de outbox do `SERVICE_ORDER_COMPLETED`).

#### A3 — Como o serviço de preço fechado é modelado hoje

**Cadeia material já existente:**

```
service_bookings (booking_id)
       │
       ├─→ service_booking_decisions (UNIQUE booking_id)
       │
       ├─→ service_payment_requests (UNIQUE booking_id)
       │            │
       │            └─→ service_payment_executions (UNIQUE payment_request_id)
       │                          ↓
       │                          (cria bank_transaction + ledger entries)
       │
       └─→ service_orders (FK booking_id) — ATO DE EXECUÇÃO DO SERVIÇO
                  │
                  └─ status: draft → confirmed → in_progress → completed | cancelled
                  └─ completed_at, confirmed_at, started_at, cancelled_at
```

**Importante:** a `service_payment_execution` representa o **pagamento**; a `service_order` representa a **execução do serviço**. Os dois são separados (DECISION arquitetural — services 0017 / SPRINT 68), unidos pelo `booking_id`. Logo "pago" e "concluído" são atos distintos com timestamps próprios — exatamente o que D1/D2 pedem.

---

### BLOCO B — Campos de estado exigidos por D1/D2

#### B1 — Tabela existe/falta por campo

| Campo | Estado | Onde está | Observação |
|---|---|---|---|
| `completed_by_actor_id` (quem concluiu) | **EXISTE como input + auditoria** | `CompleteServiceOrderInput.completedByActorId` (types L92), gravado em audit log + business audit (`service-order.service.ts:562`) | **NÃO está como coluna persistida em `service_orders`** — só no log. D1 pode requerer persistência se o release/dispute precisar consultar. **DECISÃO de design pendente:** persistir na tabela ou ler do audit log? |
| `completed_at` | **EXISTE** | `service_orders.completed_at` (coluna) | ✓ |
| `confirmed_at` | **EXISTE mas é "confirmação do CRIADOR da ordem"**, não "confirmação do BUYER da entrega" | `service_orders.confirmed_at` (`ServiceOrderStatus 'confirmed'`) | **AMBIGUIDADE** — esse campo registra `draft → confirmed` (ordem aceita), não `completed → buyer confirmou entrega`. D2 precisa de um campo NOVO. |
| `confirmed_by_actor_id` | EXISTE | `service_orders.confirmed_by_actor_id` | Idem ambiguidade acima. |
| `buyer_confirmation_deadline_at` (timeout 7d) | **FALTA** | — | Campo novo necessário para D2. Pode ir em `service_orders` ou em `payment_intents.metadata`. |
| `buyer_confirmed_completion_at` (buyer confirmou entrega) | **FALTA** (renomear o `confirmed_at` atual quebraria contrato) | — | Campo novo necessário para D2. |
| `disputed_at` | **FALTA em `service_orders`** | `financial_disputes.created_at` existe na tabela paralela | **DECISÃO de design pendente:** ter o campo redundante em `service_orders` (para WHERE rápido) ou JOIN para `financial_disputes`? |
| `dispute_id` (FK) | **FALTA em `service_orders`** | `financial_disputes` existe via `reference_id` (sem FK formal) | **DECISÃO de design pendente:** FK explícita ou seguir o padrão atual `reference_id` solto? |
| `release_eligible_at` | **FALTA** | — | Pode ser **derivado** (`completed_at + 7d` OU `buyer_confirmed_completion_at`) em vez de coluna. Decisão: materializar ou calcular? |

#### B2 — Onde está o vínculo serviço↔pagamento

**Vínculo canônico:** `service_orders.booking_id` → `service_payment_requests.booking_id` (UNIQUE) → `service_payment_executions.payment_request_id` (UNIQUE).

| Lado | Campo | UNIQUE? |
|---|---|---|
| `service_orders` | `booking_id` | não-UNIQUE (uma booking pode ter várias orders?) — confirmar com Clayton |
| `service_payment_requests` | `booking_id` | **UNIQUE** (1 payment por booking) — migration L36 |
| `service_payment_executions` | `payment_request_id` | **UNIQUE** (1 execução por request) — migration L8 |

**Caminho de leitura ao alimentar `seller_pending`:**
1. `serviceOrderService.completeOrder` recebe `orderId`.
2. Lê `service_orders.booking_id`.
3. Lê `service_payment_executions` via `service_payment_requests.booking_id`.
4. Tem `amount`, `receiver_actor_id`, `executed_at`.

**Sem decisão pendente neste sub-item** — vínculo já modelado.

---

### BLOCO C — Release-worker e a janela (D2)

#### C1 — Claim atual

`backend/src/modules/payments/payment-intent-repository.ts:217-231`:

```sql
SELECT ... FROM payment_intents
WHERE payment_status = $1            -- 'settled'
ORDER BY created_at ASC
LIMIT $2
FOR UPDATE SKIP LOCKED
```

**Para D2, o WHERE precisa enriquecer:**

```
WHERE payment_status = 'settled'
  AND release_eligible    -- via JOIN com service_orders (completed) ou via campo
  AND NOT in_dispute      -- via JOIN com financial_disputes ou via flag
```

**Forma exata depende da DECISÃO B1** (campos novos em `service_orders` ou no `payment_intents.metadata`):

| Opção | Como fica o WHERE | Custo |
|---|---|---|
| **Campos em `service_orders`** | JOIN `payment_intents` ↔ `service_payment_executions` ↔ `service_orders` no claim — pesado | Schema cleaner, query complexa |
| **Flags em `payment_intents.metadata`** | `WHERE metadata->>'release_eligible_at' <= now() AND metadata->>'dispute_id' IS NULL` — pode usar índice GIN ou expressão | Schema sujo (metadata semi-estruturado), query simples |
| **Nova coluna em `payment_intents`** | `WHERE release_eligible_at <= now() AND disputed_at IS NULL` — query trivial, índice direto | Migration mais invasiva |

Esta sub-decisão fica para Clayton no momento da fatia 1.

#### C2 — Disputa deve impedir release

Hoje o release-worker NÃO verifica disputa. A função `releaseSettledPaymentIntent` (`payment-event-resolver.ts:140-182`) só checa `intent.status === 'settled'`. Para D2:

- **No claim** (preferível): `... AND NOT disputed` no SQL — disputa pula a row, não bloqueia o cycle.
- **No service** (alternativo): `if (disputeExists) return` dentro de `releaseSettledPaymentIntent` — funciona mas desperdiça o claim.

Disputa em `financial_disputes`: o repository `getDisputeByReference(tenantId, referenceId)` (financial-dispute-repository.ts:64-75) já permite consulta por `reference_id`. Mapeamento natural: usar `intent.referenceId` como `reference_id` da dispute.

#### C3 — Release-worker está "pronto"?

**Tecnicamente sim**, falta só o critério de elegibilidade:
- ✓ Transfer `seller_pending → seller_available` (`payment-event-resolver.ts:163-177`).
- ✓ Idempotência delegada ao transfer (DT-RELEASE-WORKER-IDEMPOTENCY CLOSED R1, commit `39abbd5d`).
- ✓ FOR UPDATE SKIP LOCKED no claim.
- ✗ Não filtra por elegibilidade temporal nem por disputa.
- ⚠ Pré-condição material: `seller_pending` precisa ter saldo. **Não tem hoje** (elo 1 do mapa). D1 resolve isso.

---

### BLOCO D — Confirmação do comprador e disputa

#### D1 — Onde criar "comprador confirma conclusão"

**Candidato natural:** mesma família de `service-order.routes.ts`. Endpoint paralelo a `/complete`:

```
POST /service-orders/:id/confirm-completion
  Body: { confirmedByActorId, confirmedByUserId }
  Pre-condição: status='completed', customerActorId === confirmedByActorId
```

**Service candidato:** `serviceOrderService.confirmCompletionByBuyer(...)` (a criar).

**Action context obrigatório** (padrão usado em `/complete` em service-order.routes.ts:192-211): actor + intent + source/scope.

#### D2 — Onde criar "comprador abre disputa"

**Candidato natural:** mesma rota base. Ação alternativa:

```
POST /service-orders/:id/open-dispute
  Body: { disputeType, reason, openedByActorId }
  Pre-condição: status='completed' AND status do payment in {'settled'} AND buyer_confirmed_completion_at IS NULL
```

**Service candidato:** chama `createDispute` (`financial-dispute-repository.ts:49-62`) com `referenceId = payment_intent.referenceId`.

#### D3 — Escalada admin manual

**Padrão reaproveitável já existe** — `requireRole(['admin'])` é mencionado em `identity-validation.service.ts:15` ("Acesso controlado por requireRole(['admin']) na camada HTTP"). A frente C2 (KYC, commit `e961da7f`) já materializou:
- Endpoint admin de revisão (submit → analise → decide).
- Hook em authority quando admin decide.
- Auditoria de decisão.

**Para disputa em Camada 1:**

```
POST /financial-disputes/:id/resolve   (admin)
  Body: { resolution: 'release' | 'refund' | 'partial', notes }
  Pre-condição: requireRole(['admin']), dispute.status='under_review'
```

Espelho direto do padrão KYC. Existe `financial-dispute.controller.ts` (já presente no codebase — `backend/src/modules/disputes/financial-dispute.controller.ts`) — verificar antes da fatia se ele já tem o esqueleto e o que falta. Não auditado nesta sessão (fora do escopo READ-ONLY estreito).

---

### BLOCO E — Payout manual + gates (D3)

#### E1 — Rota "seller pede payout"

**Não existe rota em produção** que chame `createPayoutRequest`. Candidato natural:

```
POST /payouts/request
  Body: { amountCents, currency }
  Pre-condição: requireRole/capability seller, gates de E2
```

**Atenção — colisão de namespace:** já existe `payout.routes.ts` (singular, `modules/payout/`) que opera sobre `payout_batches`/`payout_orders` (sistema admin separado, RBAC `financial:execute_payout`). O endpoint para `payout_requests` (plural — sistema lifecycle) precisa caminho distinto. Ex.: `/seller/payouts/request` ou `/payouts/seller-request`. Decisão de namespacing.

#### E2 — Gates antes do payout

| Gate | Existe? | Onde | Reaproveitável? |
|---|---|---|---|
| `requireFinancialRiskClearance` | ✓ | `risk-financial-gate.ts:45` aceita `action: 'financial_payout'` (signature L21-29) | **Sim — direto** |
| KYC `kyc_status='approved'` | ✓ | A frente C2 (commit `e961da7f`) ligou `identities.kyc_status`. `requireFinancialRiskClearance` invoca `authorityDecisionService.evaluateFinancialSensitiveAction` que internamente checa KYC | **Sim — coberto pelo gate financeiro** |
| Capability ativa do seller | ⚠ Parcial | Padrão existe (Frente C); ponto de checagem em payout ainda não materializado | **Sim mas requer escolher hook** |
| Saldo em `seller_available` | ✓ | `getAccountBalanceConsistent(tenantId, accountId, client)` em `bank-ledger.repository.ts` (usado pelo `payout-worker.ts:42-50`) | **Sim — direto** (mas no `createPayoutRequest`, hoje a validação é só `checkCircuitBreaker` + `checkRateLimit`; payout-worker valida saldo no momento de processar) |
| Cooldown | ✓ | `validatePayoutCooldown(tenantId, sellerActorId)` em `payment-execution.service.ts:1119` | **Sim — exportar/extrair para uso fora do bypass** |
| Velocity | ✓ | `validateWithdrawalVelocity(tenantId, sellerActorId)` em `payment-execution.service.ts:1131` | **Sim — idem** |

**Observação importante:** as funções `validatePayoutCooldown` e `validateWithdrawalVelocity` estão **dentro do método** `requestSellerPayout` (que faz bypass de fila). A 1ª fatia de wiring D3 vai querer extrair essas funções para serem reutilizáveis a partir da nova rota — sem mexer no bypass que continua existindo para o simulador.

#### E3 — Conta bancária verificada do seller

**Substrato:** não encontrei em leitura rápida tabela como `seller_bank_accounts` ou `verified_bank_accounts`. (Não auditado em profundidade — fora do escopo desta leitura. Pode existir em algum módulo não óbvio.)

**Implicação para MVP:** o payout pode ir até `bank_settlement` sem integração externa real (D4 1:1 cria a row; bank-settlement-worker faz o transfer interno `seller_payout → bank_settlement`, e ali fica — não há PIX real). Isso é o MVP descrito por Clayton (Camada 1 sem provider real).

**Gate "conta verificada" fica para frente futura** — quando houver integração com PIX provider real.

---

### BLOCO F — Bank settlement 1:1 (D4)

#### F1 — Onde encadear createBankSettlement

**Ponto natural identificado:** `payout-worker.ts` ao chamar `updatePayoutStatus(payout.tenantId, payout.id, 'completed')` (L85), encadear:

```
após updatePayoutStatus('completed'):
  await createBankSettlement(tenantId, {
    payoutId: payout.id,
    amountCents: payout.amountCents,
    currency: payout.currency,
  });
```

Alternativa **mais limpa arquiteturalmente**: handler de outbox que escuta `PAYOUT_REQUEST_COMPLETED`. Mas o `payout-worker` já tem o ID e o tenant — encadeamento direto é trivial.

**Decisão de design pendente:** síncrono no worker vs handler de outbox. Custo similar; impacto em observabilidade muda. Decisão de Clayton na fatia.

#### F2 — Compatibilidade com createBankSettlement

`createBankSettlement` (`bank-settlement-repository.ts:49-62`) exige `payoutId` como FK para `payout_requests.id`. **Já disponível** em `updatePayoutStatus` (recebe `payoutId`). **Reaproveitamento direto, zero migration.**

---

### BLOCO G — Duplicação simulador ↔ workers

Com a decisão "workers canônicos", o simulador (`paymentExecutionService.*` chamado por `financial-simulator.controller.ts:153-192`) vira ferramenta dev/admin. Mapeamento da duplicação:

| Função simulador | Worker canônico | Status |
|---|---|---|
| `paymentExecutionService.settlePaymentToSeller` (L900) | (após D1) `serviceOrderService.completeOrder` → wiring escrow → seller_pending | Duplicado — simulador permanece como dev tool |
| `paymentExecutionService.releaseSellerFunds` (L998) | `release-worker.ts` + `releaseSettledPaymentIntent` (`payment-event-resolver.ts:140-182`) | Duplicado — `referenceType` distinto (`'dispute_release'` vs `'seller_release'`); convergir num único `referenceType` é DECISÃO de futuro |
| `paymentExecutionService.requestSellerPayout` (L1084) | (após D3) nova rota `POST /payouts/request` → `createPayoutRequest` → `payout-worker` | Duplicado — `referenceType` distinto (`'payout_request'` vs `'seller_payout'`); idem |
| `paymentExecutionService.confirmBankPayout` (L1177) | (após D4) `payout-worker` ao completar → `createBankSettlement` → `bank-settlement-worker` | Duplicado — `referenceType` distinto (`'bank_payout'` vs `'bank_settlement'`); idem |

**NÃO REMOVER NADA AGORA.** Marcar com comentário "// DEV/ADMIN tool — fluxo canônico em workers" no momento de cada fatia. A consolidação de `referenceType` exige migration nas reconciliations já gravadas — fica para frente futura, registrar como DT-CANONICAL-LIFECYCLE-REFERENCE-TYPES quando virar dor real.

---

## 2. Migrations mínimas necessárias (campos de B1 que faltam)

**Mínimo absoluto para D1+D2+D3+D4:**

| Migration | Tabela | Campos | Justificativa |
|---|---|---|---|
| **M1** | `service_orders` | `buyer_confirmed_completion_at TIMESTAMPTZ NULL` | Buyer confirma entrega (D2 — caminho rápido) |
| **M2** | `service_orders` | `buyer_confirmation_deadline_at TIMESTAMPTZ NULL` | Timeout 7d (D2 — caminho lento). Calcular `= completed_at + interval '7 days'` no `completeOrder` |
| **M3** | `service_orders` | `disputed_at TIMESTAMPTZ NULL` + `dispute_id UUID NULL` | Sinal local para WHERE rápido. Alternativa: JOIN com `financial_disputes` (decisão de design — escolher uma)|
| **M4** | `payment_intents` ou `service_orders` | `release_eligible_at TIMESTAMPTZ NULL` (derivável) | OPCIONAL — pode ser calculado no WHERE. Materializar facilita índice |

**Alternativa minimalista:** materializar os 3 campos (`buyer_confirmed_completion_at`, `buyer_confirmation_deadline_at`, `disputed_at`) em `service_orders` e calcular `release_eligible` no WHERE do claim. **Sem M4.**

**Migration ZERO necessária** se Clayton decidir armazenar tudo em `payment_intents.metadata` (jsonb) — mas isso é o "schema sujo" da matriz C1; payment_intents fica como pivô.

**NÃO escrever migration agora.** Esta seção é insumo para a fatia 1.

---

## 3. Sequência de fatias na ordem de dependência

```
FATIA 1: D1 — alimentar seller_pending na conclusão do serviço
  └─ hook em serviceOrderService.completeOrder
  └─ chama settlePaymentToSeller OU implementação canônica equivalente
  └─ deixa marcas: buyer_confirmation_deadline_at = completed_at + 7d
  └─ (sem release ainda)
  
FATIA 2: D2.a — buyer confirma conclusão (caminho rápido)
  └─ POST /service-orders/:id/confirm-completion
  └─ grava buyer_confirmed_completion_at
  └─ release-worker passa a considerar essa condição
  
FATIA 3: D2.b — timeout 7d (caminho lento)
  └─ enriquecer claim do release-worker para incluir
     completed_at + 7d <= now() OR buyer_confirmed_completion_at NOT NULL
  └─ E excluir disputed
  
FATIA 4: D2.c — disputa pausa
  └─ POST /service-orders/:id/open-dispute
  └─ grava disputed_at + cria financial_dispute
  └─ release-worker já filtra por essa flag (vinda da fatia 3)
  
FATIA 5: D2.d — admin resolve disputa
  └─ POST /financial-disputes/:id/resolve (admin)
  └─ libera para release (resolve sem reembolso) OU reembolsa (estorno)
  └─ caso de reembolso = camada 2 (estorno), em FRENTE FUTURA — só liberar
     o caminho "admin resolve = libera" nesta fatia
  
FATIA 6: D3 — payout manual com gates
  └─ POST /seller/payouts/request (namespacing a confirmar)
  └─ extrai validatePayoutCooldown + validateWithdrawalVelocity para uso fora
     do bypass do simulador
  └─ aplica requireFinancialRiskClearance(action='financial_payout')
  └─ chama createPayoutRequest
  └─ payout-worker já consome (zero-mudança no worker)
  
FATIA 7: D4 — bank_settlement 1:1
  └─ encadear createBankSettlement após updatePayoutStatus('completed') no
     payout-worker
  └─ bank-settlement-worker já consome (zero-mudança no worker)
  
FATIA 8 (transversal, depois de 7): observabilidade end-to-end
  └─ smoke E2E do circuito feliz completo
  └─ marca simulador como "// DEV/ADMIN tool"
  └─ atualiza MAPA com decisões consolidadas
```

**Dependências críticas:**
- Fatia 1 é pré-requisito de TODAS as outras (sem `seller_pending` alimentado, nada flui).
- Fatia 2, 3, 4 podem rodar em paralelo após Fatia 1, mas a 3 precisa do critério da 2 para ser útil.
- Fatia 5 (admin resolve) depende de 4.
- Fatia 6 (payout) só faz sentido depois de 3 (algo chega em `seller_available`).
- Fatia 7 (bank_settlement) depende de 6.

---

## 4. A PRIMEIRA fatia executável

**FATIA 1 — D1: alimentar `seller_pending` ao concluir o serviço.**

### Por que esta é a primeira

- O **gatilho já existe** (`serviceOrderService.completeOrder` — A2 confirmou).
- A **função-alvo já existe** (`settlePaymentToSeller` em `payment-execution.service.ts:900` ou implementação canônica equivalente — decisão Clayton: reutilizar essa função ou criar caminho canônico novo evitando o `referenceType` do simulador).
- **Vínculo serviço↔pagamento já existe** (`booking_id`).
- **Padrão de atomicidade** já está validado (`existingClient` pattern, commit `8afeec9a`).
- **Idempotência** delegada à camada de transfer (CLOSED R1, commit `39abbd5d`).
- Nenhuma outra fatia pode rodar antes — seller_pending zerado bloqueia tudo.

### Escopo material da Fatia 1 (a confirmar com Clayton antes de codar)

| Item | Decisão pendente | Default sugerido para discussão |
|---|---|---|
| **Função canônica** | Reusar `settlePaymentToSeller` (simulador) ou criar `creditSellerPendingOnCompletion` | Default discussão: reusar com `referenceType` novo `'service_completion_credit'` — evita duplicação imediata sem comprometer convergência futura |
| **Atomicidade** | Mesmo client de `completeOrder` ou outbox handler de `SERVICE_ORDER_COMPLETED` | Default discussão: outbox handler (mais resiliente; padrão idempotency já em uso) |
| **Campos novos em `service_orders`** | Migration M1+M2 agora ou só M1 | Default discussão: M1+M2 juntas (deadline já é calculável no momento) |
| **Origem dos fundos** | `escrow_payments` → `clearing` → `seller_pending` (2 transfers, padrão atual) ou simplificação direta | Default discussão: manter 2 transfers (padrão já validado em `settlePaymentToSeller`) |
| **Que conta credita hoje?** | A conta GENÉRICA (account_type='credit') do receiver continua sendo creditada pelo `createExecution`, ou esse comportamento muda para creditar escrow primeiro? | **DECISÃO IMPORTANTE** — hoje o crédito vai direto para a conta default. Para D1 funcionar, ou (a) `createExecution` passa a creditar `escrow_payments` em vez do receiver, ou (b) há um passo intermediário que primeiro tira da conta default e leva para escrow. Tradeoff arquitetural não trivial — vale fatia 0 de mapeamento antes da 1 efetiva |

### Pré-fatia 0 (recomendada antes de codar a 1)

**Mapear como o dinheiro chega no escrow_payments hoje** (ou se chega). Se `createExecution` credita a conta default e não `escrow_payments`, a Fatia 1 precisa primeiro decidir onde o dinheiro **fica esperando** entre "pago" e "seller_pending". Sem este mapeamento, a Fatia 1 vira ambígua.

**Esta pré-fatia é READ-ONLY** — só medir o comportamento atual do `createExecution` em relação ao escrow. Não toca código.

---

## 5. O que fica só no simulador

Após as Fatias 1-7 mergeadas, **manter no simulador** (não remover):

| Função | Função no simulador | Quem usa após wiring |
|---|---|---|
| `settlePaymentToSeller` | `payment-execution.service.ts:900-992` | `financial-simulator.controller.ts:153` (dev/admin) |
| `releaseSellerFunds` | `payment-execution.service.ts:998+` | Idem |
| `requestSellerPayout` | `payment-execution.service.ts:1084+` | Idem |
| `confirmBankPayout` | `payment-execution.service.ts:1177+` | Idem |
| Rota `POST /observability/financial-simulator` | `financial-simulator.controller.ts` | Dev/admin, atrás de RBAC |

**Marcar com comentário** quando tocar cada um: `// DEV/ADMIN TOOL — fluxo canônico de produção em workers (ver MAPA + PLANO_WIRING_CAMADA_1)`. Não deletar; serve de simulador end-to-end para testes em dev/admin (acelera ciclos sem esperar workers).

**Convergência de `referenceType` divergente (simulador vs workers)** — fica como DT futura (`DT-CANONICAL-LIFECYCLE-REFERENCE-TYPES`); só virar dor quando a reconciliation acumular ruído de duplicação. Hoje não acumula porque o simulador só roda em dev.

---

## 6. Camada 2 — explicitamente fora desta frente

Não tocar nesta frente:

- Reembolso/estorno (`refund`) — `payment-execution.service.ts` já tem mas é cadeia separada.
- Cancelamento parcial (`refund` parcial após release).
- Milestones múltiplos (escrow já comporta — `PaymentMilestone = 'confirmed' \| 'started' \| 'completed'`).
- Disputa com refund parcial (admin resolve com `partial`).
- Integração PIX provider real (D4 1:1 fica interno por enquanto).
- Chargeback externo (`event-refund-chargeback.service.ts` existe — frente paralela).
- Convergência de `referenceType` simulador ↔ workers.

Todas viram fatias separadas em **Camada 2** após Camada 1 estável.

---

## 7. Checklist antes de codar a Fatia 1

- [ ] Clayton decide: reusar `settlePaymentToSeller` ou criar canônico novo
- [ ] Clayton decide: atomicidade síncrona no `completeOrder` ou via outbox handler
- [ ] Clayton decide: migration M1+M2 agora ou só M1
- [ ] Clayton decide: campos em `service_orders` ou em `payment_intents.metadata`
- [ ] **Pré-fatia 0 (READ-ONLY): mapear como o dinheiro chega no escrow_payments hoje**
- [ ] Tem `seller_pending` lifecycle account criada por `ensurePlatformAccounts`? (Sim, confirmado em `bank-account.service.ts:340-396`)
- [ ] `service_orders` tem coluna `decision_id` ativa? (Sim, no `service-order.repository.ts:17` — embora não estivesse na migration archived; alguma migration posterior adicionou)

---

## 8. Resumo executivo

- **Ato de conclusão JÁ EXISTE** (`service_orders` + `completeOrder` + rota) — não precisa criar.
- **3 campos novos** mínimos em `service_orders` (M1+M2+M3); M4 opcional.
- **8 fatias** na ordem de dependência (1-3 são as decisivas; 4-7 são naturais; 8 é finalização).
- **1ª fatia** = D1 (`seller_pending`); pré-fatia 0 (mapear escrow vs conta default) é recomendada.
- **Workers já estão prontos** para os 4 papéis canônicos — só falta o WHERE temporal/dispute (release-worker, Fatia 3).
- **Simulador permanece** como ferramenta dev/admin; não remover.
- **Camada 2** é frente separada — não inflar Camada 1.

---

**Próximo passo natural:** rodar a pré-fatia 0 (READ-ONLY) sobre o comportamento atual de `createExecution` em relação a `escrow_payments`. Sem este mapeamento, a Fatia 1 fica ambígua quanto à origem dos fundos para `seller_pending`.
