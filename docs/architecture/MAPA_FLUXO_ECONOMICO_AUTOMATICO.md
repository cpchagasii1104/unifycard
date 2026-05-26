# Mapa do Fluxo Econômico Automático — DECISÕES AUSENTES

> **Sessão de leitura:** 2026-05-26 · **HEAD:** `39abbd5d` (auditoria DT-RELEASE-WORKER-IDEMPOTENCY CLOSED).
> **Origem:** dimensionamento do E2E workers async (Etapa 1, prompt anterior) revelou o gap [G1] — 3 elos do pipeline de liquidação não estão ligados em produção. Este documento **mapeia** e **enumera** as decisões de negócio que faltam. Não recomenda, não escolhe, não infere regra.
>
> **Escopo:** READ-ONLY. As decisões cabem a Clayton.
>
> **O que este documento NÃO faz:** propor wiring, escolher entre opções, inferir regra de negócio inexistente. Onde o código não traz regra, o documento diz "DECISÃO AUSENTE" e lista as opções.

---

## 1. Estado atual da cadeia de contas (o que acontece de fato em produção)

```
[externo: PIX_PAYMENT_CONFIRMED] ── payment-event-resolver.ts:245-259
        │
        ▼ transfer escrow_payments → user_wallet
[user_wallet do PAYER]                 ⟵ payment_intent passa a 'escrowed'
        ·
        · (separadamente, no caminho de SERVIÇO/MARKETPLACE)
        ·
[createExecution]    ── bank-integration.service.ts:451 (processServicePaymentExecutionCanonical)
        │             credita splits em conta GENÉRICA (getOrCreateAccount,
        │             account_type='credit' default, bank-account.repository.ts:56)
        ▼
[conta do receiverActor]   ⟵ NÃO É seller_pending.
                              É a conta default do owner (user/company/group)
                              criada por resolveBankAccountForServiceActor
                              (bank-integration.service.ts:424-446).

────────────────────── ⚠ CADEIA INTERROMPIDA ──────────────────────

A cadeia "escrow → clearing → seller_pending → seller_available →
seller_payout → bank_settlement" EXISTE como código (payment-execution
.service.ts:892-1264), mas só é EXERCITADA pelo simulador de
observabilidade (financial-simulator.controller.ts:153-192).

Em produção real, NINGUÉM chama as funções de orquestração dessa cadeia.
```

**Conta crédito do receiver hoje:** `bank-integration.service.ts:531-541` usa `resolveBankAccountForServiceActor`, que retorna `resolveUserAccount` ou `resolveCompanyAccount` (linhas 21-48) — ambas chamam `getOrCreateAccount` sem `account_type` (default `'credit'`). Esta conta é genérica; não passa pelas contas lifecycle `seller_pending/available/payout`.

**Tabelas alimentadas em produção:**

| Tabela | Escritores em produção | Observação |
|---|---|---|
| `payment_intents` | `createPaymentIntent` (payment-intent-repository.ts:84) chamado por callers reais | Vivo |
| `bank_transactions` | `bankTransactionService.transfer` (vários callers reais) | Vivo |
| `bank_ledger` | Via `transfer` (append-only) | Vivo |
| `payout_requests` | **ZERO callers de produção** — só E2E (`validate-pipeline-e2e-transversal.ts:904` INSERT direto) | **Fila vazia em prod** |
| `bank_settlements` | **ZERO callers de produção** — só E2E (`validate-pipeline-e2e-transversal.ts:913` INSERT direto) | **Fila vazia em prod** |

**Workers que rodam em produção (BOOT.ts):**

| Worker | Fila | Em produção, fila tem itens? |
|---|---|---|
| `settlement-worker` (escrowed→settled, status only) | `payment_intents` | Sim, mas só se `payment-event-resolver` rodar (depende de PIX_PAYMENT_CONFIRMED real, hoje gate dormente via `DT-RESOLVER-PIX-BRANCH-DEAD`) |
| `release-worker` (settled→seller_available transfer) | `payment_intents` | Roda se houver intent settled; mas o **transfer** depende de saldo em `seller_pending`, que NÃO é alimentado automaticamente (elo 1 deste documento) |
| `payout-worker` (requested→completed transfer) | `payout_requests` | Fila vazia (elo 2 deste documento) |
| `bank-settlement-worker` (pending→sent transfer) | `bank_settlements` | Fila vazia (elo 3 deste documento) |

---

## 2. Os 3 elos ausentes

### ELO 1 — escrow → seller_pending (settlePaymentToSeller)

#### 1a) O QUE EXISTE

**Função:** `paymentExecutionService.settlePaymentToSeller` — `backend/src/modules/marketplace/payment-execution.service.ts:900-992`.

**O que faz:** dois transfers consecutivos via `bankTransactionService.transfer`:

1. L954-969: `escrow_payments → clearing` (referenceType=`'settlement'`, concept=`'marketplace-settlement-escrow-to-clearing'`).
2. L972-987: `clearing → seller_pending` (referenceType=`'seller_settlement'`, concept=`'marketplace-settlement-clearing-to-seller'`).

**Pré-condições:** `ensurePlatformAccounts` + `ensureLifecycleAccountsForOwner(sellerCompanyId, 'company')` para criar as contas; aceita overrides via `options` para testes.

**Caller real único:** `financial-simulator.controller.ts:153` (handler `POST /observability/financial-simulator`). Confirmado por grep cross-codebase — **nenhum outro caller de produção**.

#### 1b) O QUE FALTA

Hoje, quando um pagamento de serviço entra (`createExecution`), o dinheiro é creditado na **conta default do receiver** (`bank-integration.service.ts:531-541`), não em `seller_pending`. A cadeia "escrow → clearing → seller_pending" não dispara automaticamente em nenhum momento. Resultado material:

- `seller_pending` permanece zerado em produção.
- O `release-worker` nunca consegue executar o transfer `seller_pending → seller_available` (falta de saldo → `NEGATIVE_BALANCE_GUARD` ou similar).
- Cadeia lifecycle "seller_pending → seller_available → seller_payout → bank_settlement" fica desconectada do recebimento real.

#### 1c) DECISÃO AUSENTE (de Clayton)

**Pergunta:** quando o `seller_pending` deve ser creditado? O código comporta múltiplas opções; nenhuma está escolhida materialmente. Opções enumeradas, **sem recomendação**:

| Opção | Quando dispara | Mecanismo técnico que comportaria |
|---|---|---|
| **A — imediato após execução do pagamento** | Síncrono no `createExecution`, junto com a escrita do bank | `processServicePaymentExecutionCanonical` (bank-integration.service.ts:451) chama `settlePaymentToSeller` no mesmo `existingClient` (uma transação) |
| **B — após confirmação externa** | Após webhook do gateway (PIX_PAYMENT_CONFIRMED) | Handler do `payment-event-resolver.ts` dispara `settlePaymentToSeller` após o transfer de escrow |
| **C — após janela de disputa** | Timer/SLA (ex.: 7 dias após settlement externo) | Worker novo agendado, ou estende `release-worker` para também tocar `seller_pending` |
| **D — após settlement bancário externo confirmado** | Após confirmação do gateway que liquidou ao banco | Handler diferente do PIX_PAYMENT_CONFIRMED (ex.: PIX_SETTLED_BANK) |
| **E — handler de outbox do SERVICE_PAYMENT_EXECUTED** | Async, desacoplado | `event-outbox-worker` despacha para um handler novo que chama `settlePaymentToSeller` |
| **F — manual (admin)** | Endpoint admin dispara settlement | Rota nova com RBAC `financial:execute_settlement` |

#### 1d) IMPACTO ARQUITETURAL POR OPÇÃO

| Opção | Quem dispara quem | Acopla? | Atomicidade |
|---|---|---|---|
| A (síncrono) | `createExecution` → `settlePaymentToSeller` | Acopla execução a settlement | 1 transação grande, junto com outbox (padrão `8afeec9a`) |
| B (PIX confirmado) | Handler PIX → `settlePaymentToSeller` | Desacopla execução de settlement | 1 transação por evento; outbox separado |
| C (janela disputa) | Worker agendado → `settlePaymentToSeller` | Desacopla totalmente | Cada execução isolada; risk de fila acumular |
| D (settlement bancário) | Handler do gateway → `settlePaymentToSeller` | Desacopla, depende de banco externo | Cada confirmação isolada |
| E (outbox handler) | `event-outbox-worker` → handler novo | Desacopla, padrão idempotente | Já protegido por `withIdempotency` |
| F (manual) | Admin → endpoint → `settlePaymentToSeller` | Operacional, não automatizado | Cada chamada isolada |

#### 1e) RISCO POR OPÇÃO

| Opção | Custódia | SLA seller | Fraude | Liquidez | UX |
|---|---|---|---|---|---|
| A | Mínima (zera escrow rápido) | Excelente | **Alta** — credita antes de qualquer confirmação | Alta circulação | Seller vê dinheiro instantâneo |
| B | Baixa | Boa | Média — depende da confiança no gateway | Boa | Latência do gateway |
| C | **Alta** (dinheiro preso por dias) | **Pior** | **Mais baixa** — janela permite reversão | Pior | Seller espera dias |
| D | Baixa | Boa | Baixa — confirmação real | Boa | Depende de SLA banco |
| E | Variável | Depende de cadência outbox | Média — desacoplada de validação | Boa | Depende do trigger do evento |
| F | Variável | Pior | Baixa — controle humano | Variável | Operação manual cara |

---

### ELO 2 — createPayoutRequest (sem caller de produção)

#### 2a) O QUE EXISTE

**Função:** `createPayoutRequest` — `backend/src/modules/payouts/payout-repository.ts:51-66`.

**O que faz:**
1. L55: `checkCircuitBreaker(tenantId, 'payouts')` — bloqueio operacional.
2. L56: `checkRateLimit(tenantId, input.actorId, 'payout_request')` — rate limit por actor.
3. L57-63: INSERT em `payout_requests` com `status='requested'`.

**Validações INTERNAS da função:** circuit-breaker + rate-limit. **Não tem** validação de saldo, KYC, capability, ou threshold. Essas teriam que vir do caller (que não existe).

**Caller real:** ZERO em produção. Apenas `validate-pipeline-e2e-transversal.ts:904` faz INSERT direto na tabela (não chama a função).

**Função adjacente do simulador:** `paymentExecutionService.requestSellerPayout` (payment-execution.service.ts:1084-1175) faz o **transfer** `seller_available → seller_payout` E inclui validações reais (`validatePayoutCooldown`, `validateWithdrawalVelocity` — L1119/L1131). Mas **essa função nem usa `createPayoutRequest`** — passa direto pelo transfer. Logo o `payout-worker` (que consome `payout_requests`) **não dispara** a partir do simulator atual.

#### 2b) O QUE FALTA

Nada em produção:
- Cria `payout_request` (a tabela fica vazia).
- Liga "seller tem saldo em `seller_available`" → "abre `payout_request`".

Resultado: o `payout-worker` (BOOT.ts:269-274) roda a cada 10s mas sempre encontra fila vazia. O dinheiro em `seller_available` (se chegar lá pelo elo 1) não tem caminho automático para sair.

#### 2c) DECISÃO AUSENTE (de Clayton)

**Pergunta:** quem inicia o payout? Opções enumeradas, **sem recomendação**:

| Opção | Quem inicia | Mecanismo |
|---|---|---|
| **G — seller manual via rota** | Seller clica "sacar" no UI | Rota nova `POST /payouts/request` que chama `createPayoutRequest` |
| **H — automático por threshold de saldo** | Atinge X cents em `seller_available` | Worker novo monitora saldos; cria payout quando passa threshold |
| **I — automático por agenda fixa** | Diário/semanal | Cron worker; varre sellers com saldo>0 e cria payouts |
| **J — automático por agenda + seller opt-in** | Seller escolhe cadência (diário/semanal/mensal/sob demanda) | Tabela de preferência + cron worker que respeita preferência |
| **K — híbrido manual + auto** | Seller pode pedir antes do automático | Rota + cron, com cooldown entre solicitações |

**Subdecisão — gates anteriores ao payout:**

| Gate | Hoje em produção | Decisão ausente |
|---|---|---|
| KYC aprovado | `requireFinancialRiskClearance` está disponível (`risk-financial-gate.ts:45`) e é usado em vários pontos do código (transfer, escrow, reversal, marketplace) | **Aplicar ao payout request?** A Frente C2 ligou cadastro→KYC→authority. O ponto de aplicação do gate em payout requer DECISION. |
| Capability ativa (seller habilitado) | Não há check explícito hoje | Exigir capability `seller` ativa do actor antes do payout? |
| Threshold mínimo de saque | Não há check | Definir valor mínimo? |
| Cooldown entre saques | `validatePayoutCooldown` existe em `requestSellerPayout` (L1119) | Aplicar também na criação de `payout_request`? |
| Velocity check (saques/dia) | `validateWithdrawalVelocity` existe (L1131) | Idem |
| Verificação de conta bancária do seller | Não há check no `createPayoutRequest`; assume conta externa configurada | Quem garante que o seller tem dados bancários válidos? |

#### 2d) IMPACTO ARQUITETURAL POR OPÇÃO

| Opção | Componente necessário | Acoplamento |
|---|---|---|
| G | Rota nova + UX | Acopla payout a uma ação humana explícita |
| H | Worker monitor de saldo + threshold por seller | Acopla a leitura periódica de saldos |
| I | Cron + lógica de elegibilidade | Acopla payout ao calendário |
| J | Tabela `seller_payout_preference` + cron | Mais complexo; preferência fica no actor/metadata |
| K | G + I/J + cooldown | Maior superfície, maior flexibilidade |

#### 2e) RISCO POR OPÇÃO

| Opção | Liquidez | Fraude | Custo operacional | UX |
|---|---|---|---|---|
| G | Boa (seller decide) | Baixa (controle explícito) | Custo por solicitação | Seller controla |
| H | Pode acumular | Média (depende do threshold) | Médio (worker corre sempre) | Sem controle do seller |
| I | Previsível mas rígida | Baixa | Baixo | Seller espera o ciclo |
| J | Flexível | Baixa | Médio (preferência por seller) | Seller controla cadência |
| K | Excelente | Baixa | Alto | Excelente |

---

### ELO 3 — createBankSettlement (sem caller de produção)

#### 3a) O QUE EXISTE

**Função:** `createBankSettlement` — `backend/src/modules/bank-settlement/bank-settlement-repository.ts:49-62`.

**O que faz:**
1. L55-57: INSERT em `bank_settlements` com `status='pending'`.
2. Requer `payoutId` (FK para `payout_requests.id`).

**Validações:** NENHUMA na função (sem rate-limit, sem circuit-breaker, sem KYC, sem checagem de status do payout vinculado). Toda validação teria que vir do caller (que não existe).

**Caller real:** ZERO em produção. Apenas `validate-pipeline-e2e-transversal.ts:913` faz INSERT direto na tabela.

**Função adjacente do simulador:** `paymentExecutionService.confirmBankPayout` (payment-execution.service.ts:1177+) faz o **transfer** `seller_payout → bank_settlement` mas não cria a row em `bank_settlements`.

#### 3b) O QUE FALTA

Nada em produção:
- Cria `bank_settlement` (a tabela fica vazia).
- Liga "payout completou" → "abre `bank_settlement`".
- Há integração real com banco externo (PIX para o seller).

Resultado: o `bank-settlement-worker` (BOOT.ts:287-292) roda a cada 10s mas sempre encontra fila vazia. O dinheiro em `seller_payout` (se chegar lá) não sai para o banco externo do seller.

#### 3c) DECISÃO AUSENTE (de Clayton)

**Pergunta:** quando nasce o `bank_settlement`? Opções enumeradas, **sem recomendação**:

| Opção | Quando dispara | Mecanismo |
|---|---|---|
| **L — 1:1 com payout completado** | Cada `payout_request` que vira `'completed'` gera um `bank_settlement` automaticamente | Handler hook em `updatePayoutStatus('completed')`, ou trigger DB, ou outbox event |
| **M — batch horário/diário** | Agrupa N payouts completados em 1 settlement | Worker agendado que varre `payout_requests` `'completed'` sem settlement vinculado |
| **N — PIX imediato (sem fila)** | Confirma payout → transfere PIX externo na hora; cria `bank_settlement` para registro pós-facto | Integração com PIX provider; `bank_settlement` vira só registro |
| **O — aprovação manual (admin)** | Operador revisa lista de payouts completados e aprova batch | Rota admin + UX de aprovação |
| **P — integração externa puxada** | Banco externo solicita settlement via API | Endpoint webhook reverso |

#### 3d) IMPACTO ARQUITETURAL POR OPÇÃO

| Opção | Componente necessário | Acoplamento ao banco externo |
|---|---|---|
| L | Hook em `updatePayoutStatus` ou handler de outbox | Settlement por unidade — alto custo se banco cobrar por transação |
| M | Worker agendado + lógica de agrupamento | Latência média; custo amortizado |
| N | Integração PIX provider + handler async | Real-time; depende de SLA do provider |
| O | Rota admin + UX | Lento; depende de presença humana |
| P | Endpoint webhook + autenticação | Depende do banco oferecer essa API |

#### 3e) RISCO POR OPÇÃO

| Opção | Custo bancário | Latência ao seller | Reconciliação | Fraude |
|---|---|---|---|---|
| L | **Alto** (1 tx por payout) | Baixa | Mais fácil (1:1) | Baixa |
| M | Baixo (agregado) | **Alta** (espera o lote) | Mais complexa (1 batch → N payouts) | Baixa |
| N | Variável (depende do PIX provider) | **Muito baixa** | Síncrona | Média (real-time exige verificação rápida) |
| O | Baixo | **Variável** (depende do operador) | Manual | Baixa (controle humano) |
| P | Variável | Depende do banco | Acoplada ao banco | Média |

---

## 3. Lista consolidada de DECISÕES AUSENTES (uma por elo)

| # | Decisão | Quem deve decidir | Opções listadas | Subdecisões dependentes |
|---|---|---|---|---|
| **D1** | Quando o `seller_pending` é creditado? | Clayton | A, B, C, D, E, F | Depende de qual evento o sistema considera "settlement liquidado" |
| **D2** | Quem inicia o `payout_request`? | Clayton | G, H, I, J, K | Subdecisões: KYC obrigatório? Capability? Threshold mínimo? Cooldown? Velocity? Verificação de conta bancária? |
| **D3** | Quando nasce o `bank_settlement`? | Clayton | L, M, N, O, P | Subdecisões: integração com PIX provider real? Custo por transação aceitável? |

---

## 4. Impacto arquitetural transversal

- **Pattern transversal já existente:** todos os 3 workers (`release`, `payout`, `bank-settlement`) usam **idempotência por reference estável** (`(tenant_id, reference_type, reference_id)` no `bank_transactions`). Esse pattern foi auditado e está vivo (`DT-RELEASE-WORKER-IDEMPOTENCY` CLOSED 2026-05-26, commit `39abbd5d`). Qualquer wiring novo que use `bankTransactionService.transfer` herda essa defesa.
- **Outbox atomicity:** o pattern de `existingClient?: PoolClient` (`8afeec9a` — `DT-OUTBOX-ATOMICITY` RESOLVED) é reutilizável para qualquer wiring síncrono novo no `createExecution`. Se a escolha for opção A (síncrono), o pattern existe.
- **Reconciliation detective:** as detecções "transferred mas status órfão" para `payout_requests` e `bank_settlements` JÁ EXISTEM (Caminho 2, commit `c94eebe2`). Qualquer wiring deixará pegadas detectáveis se houver janela de inconsistência.
- **KYC gate:** `requireFinancialRiskClearance` (risk-financial-gate.ts:45) já é aplicado em transfer, escrow, reversal, marketplace, payout/payout.service.ts (módulo singular). Aplicar nos novos elos é mecânico — mas a DECISÃO de aplicar (e em qual ponto exato) é de Clayton.

---

## 5. O que NÃO é gap (parâmetros materiais já definidos)

Para evitar confusão, registrar o que JÁ está decidido no código:

| Item | Onde está decidido | Não precisa de DECISION |
|---|---|---|
| account_type das contas lifecycle | `bank-account.service.ts:340-396` (`ensurePlatformAccounts` cria `escrow_payments`, `clearing`, `bank_settlement`, `seller_pending`, `seller_available`, `seller_payout`, `payouts`, `fee`, `regional_fund`, `reserve`) | ✓ decidido |
| Triggers de append-only no `bank_ledger` | Migration `0021_ledger_append_only.sql` + `0027_bank_ledger_immutable.sql` | ✓ decidido |
| CHECK de negative balance | Migration `0023_negative_balance_guard.sql` | ✓ decidido |
| Idempotência por reference no `transfer` | `bank-transaction.service.ts:271-325` | ✓ decidido |
| Status enum de `payout_requests` | Migration `0031_payout_requests.sql` + `20260530535000_c36_status_check_constraints.sql:39-40` | ✓ decidido |
| Status enum de `bank_settlements` | `bank-settlement-repository.ts:6` + CHECK constraint | ✓ decidido |
| Reconciliation detective de janelas B/C | `reconciliation-engine.service.ts:189-260` (Caminho 2, `c94eebe2`) | ✓ decidido |

---

## 6. Regras parciais existentes (não decisões completas)

Pontos onde o código tem regra parcial mas que **não constitui caller de produção do elo**:

| Função | Regra parcial existente | Por que não é "caller de produção" |
|---|---|---|
| `paymentExecutionService.requestSellerPayout` (L1084) | Aplica `validatePayoutCooldown` e `validateWithdrawalVelocity` ANTES de transferir `seller_available → seller_payout` | Não chama `createPayoutRequest` — bypassa a fila `payout_requests`. Logo o `payout-worker` não dispara |
| `paymentExecutionService.confirmBankPayout` (L1177) | Faz o transfer `seller_payout → bank_settlement` | Não chama `createBankSettlement` — bypassa a fila `bank_settlements`. Logo o `bank-settlement-worker` não dispara |
| `paymentExecutionService.releaseSellerFunds` (L998) | Faz o transfer `seller_pending → seller_available` | Caller único é simulador. Em paralelo, o `release-worker` faz o mesmo transfer com chave diferente (`'seller_release'` vs `'dispute_release'`) |

**Observação:** existem **duas implementações paralelas** do mesmo lifecycle (simulador + workers), com `referenceType` distintos. Se eventualmente houver wiring, decidir qual sistema é o canônico evita duplicação.

---

## 7. Resumo executivo (1 página)

- **[G1] tem 3 elos ausentes**, não 1.
- Cada elo tem ≥5 opções de implementação, e **nenhuma está decidida** no código.
- As decisões são de Clayton, não derivam de leitura.
- Padrões transversais (idempotência, outbox atomicity, reconciliation detective, KYC gate) **já existem** e qualquer wiring escolhido vai herdá-los.
- **Nenhuma ação corretiva foi tomada** nesta sessão. O documento é insumo para decisão de produto.
- **Nenhum risco material adicional** foi descoberto além do já catalogado (G1 documentado neste arquivo; G2 refutado e CLOSED em `39abbd5d`).

---

## 8. Quando voltar a este documento

- Antes de implementar wiring de qualquer um dos 3 elos.
- Quando Clayton decidir D1, D2 ou D3 — atualizar a tabela da seção 3 com a opção escolhida.
- Se aparecer novo elo ausente (ex.: reembolso, estorno, chargeback) — adicionar elo D4+.

---

**Apêndice — comando para reidentificar o estado atual:**

```bash
# Confirmar ausência de callers em produção:
grep -rn "settlePaymentToSeller\b\|createPayoutRequest\b\|createBankSettlement\b" backend/src --include="*.ts" \
  | grep -v -E "(financial-simulator|validate-pipeline-e2e|payout-repository\.ts:51|bank-settlement-repository\.ts:49|payment-execution\.service\.ts:900)"
# Resultado esperado: vazio.
```
