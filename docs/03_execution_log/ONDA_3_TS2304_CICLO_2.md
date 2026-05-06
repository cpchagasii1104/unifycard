# ONDA 3 — TS2304 (Ciclo 2)

**Data:** 2026-02-25  
**Modo:** EXECUTOR  
**Âncora:** `docs/03_execution_log/ONDA_3_TS2304_CICLO_1.md`  
**Estado inicial:** TS2304 = 107  
**Meta do ciclo:** ≤ 60

---

## Resultado

| Métrica | Antes | Depois |
|--------|--------|--------|
| **TS2304** | 107 | **76** |
| **Redução** | — | **31** |
| **Meta ciclo** | ≤ 60 | 76 (não atingido) |

Os 76 restantes são **REFATORAÇÃO INCOMPLETA** (símbolos/repos/serviços inexistentes). Não foram criados stub nem domínio novo.

---

## Reclassificação (107 → 76)

| Categoria | Qtde (antes) | Ação no ciclo | Qtde (depois) |
|----------|--------------|----------------|----------------|
| Variável fora de escopo | 22 | Corrigida | 0 |
| Injeção incorreta | 1 | Corrigida (accountService) | 0 |
| Tipo não importado | 0 | — | 0 |
| Refatoração incompleta | 84 | Não tocada | 76* |

\*Alguns erros de variável/injeção eram no mesmo ficheiro que refatoração; ao corrigir variável/injeção, o total de linhas com TS2304 diminuiu.

---

## Correções aplicadas

### Variável fora de escopo

| Arquivo | Símbolo | Ação |
|---------|---------|------|
| `core/kyc/kyc.validators.ts` | `value` | Uso do parâmetro correto: `valueCents` em `normalizeTaxId` e `normalizePhone`. |
| `core/notify/providers/templates.provider.ts` | `value` | Acumulador do replace: `valueCents` renomeado para `value` (variável do loop). |
| `core/notify/handlers/rides-notify.handlers.ts` | `value` | Parâmetro do callback: `valueCents` → `val` e uso de `val` no corpo. |
| `core/identity/identity.routes.ts` | `userId` | Resolução de actor e `userId = actor.user_id` antes de `confirmFirstAccess`. |
| `modules/bank/bank-policy.service.ts` | `value` | Uso do parâmetro do método: `valueCents` em `JSON.stringify(valueCents)`. |
| `modules/work-instant/smart-matching.service.ts` | `value` | Uso do parâmetro: `valueCents` na expressão de normalização. |
| `modules/groups/groups.routes.ts` | `userIdForCheck` | Resolução via actor: `userIdForCheck = actor?.user_id ?? actorId`; log com `userId: userIdForCheck`. |
| `modules/profile/commitments.routes.ts` | `globalUserId`, `userId` | Definição a partir do actor: `globalUserId` e `userId` após obter `actor`. |
| `modules/events/ticket.service.ts` | `saleMetadata` | No bloco SPRINT 84: `saleMetadataForSettlement = ticketSale.metadata || {}` e uso consistente. |
| `modules/social-chat/social-chat.service.ts` | `total` | Retorno com `totalCents` (já existente no destructuring). |
| `modules/social/social-group.service.ts` | `total` | Uso de `totalCents` (do destructuring de `getImpactFeed`) em `hasMore` e no retorno. |
| `modules/services/service-order.service.ts` | `evidencePackId` | Definição a partir de `order.metadata`: `evidencePackId = order.metadata?.evidencePackId`. |
| `modules/marketplace/payment-execution.service.ts` | `isPix` | Definição: `isPix = intent.metadata?.payment_method_snapshot?.type === 'PIX'`. |
| `modules/marketplace/marketplace.service.ts` | `acceptedDispatch` | Declaração fora do `if (role === 'provider')`: `let acceptedDispatch` e atribuição dentro do `if`. |
| `modules/social/social-2.0.routes.ts` | `actionContext`, `createdByUserId`, `userId` | Já corrigidos em sessão anterior: `req.actionContext`, `validated.actor_id`, e resolução de `userId` via actor em `/actors/switch`. |

### Injeção incorreta

| Arquivo | Símbolo | Ação |
|---------|---------|------|
| `jobs/post-event-split.job.ts` | `accountService` | Import adicionado: `import { accountService } from '@core/economy/account.service'`. |

---

## Arquivos modificados (resumo)

- `backend/src/core/kyc/kyc.validators.ts`
- `backend/src/core/notify/providers/templates.provider.ts`
- `backend/src/core/notify/handlers/rides-notify.handlers.ts`
- `backend/src/core/identity/identity.routes.ts`
- `backend/src/modules/bank/bank-policy.service.ts`
- `backend/src/modules/work-instant/smart-matching.service.ts`
- `backend/src/modules/groups/groups.routes.ts`
- `backend/src/modules/profile/commitments.routes.ts`
- `backend/src/modules/events/ticket.service.ts`
- `backend/src/modules/social-chat/social-chat.service.ts`
- `backend/src/modules/social/social-group.service.ts`
- `backend/src/modules/services/service-order.service.ts`
- `backend/src/modules/marketplace/payment-execution.service.ts`
- `backend/src/modules/marketplace/marketplace.service.ts`
- `backend/src/jobs/post-event-split.job.ts`

Nenhum serviço novo foi criado. Nenhum stub. Nenhum domínio novo.

---

## TS2304 restantes (76) — refatoração incompleta

- **core/economy/ledger/ledger.routes.ts:** 5 (ledgerService com API distinta).
- **core/events:** 10 (eventSplitDeclarativeService, eventRefundChargebackService, tipos CalculateSplitInput, RequestRefundInput, InitiateChargebackInput).
- **jobs:** 7 (escrowService inexistente; accountService corrigido).
- **modules/marketplace:** 54 (accountsPayableRepository, accountsReceivableRepository, productRepository, paymentTransactionRepository, paymentSplitRepository, payoutTransactionRepository, regionAccountRepository, settlementRepository, unifyCardRepository — repos inexistentes/removidos).

---

## Regras respeitadas

- Apenas variável fora de escopo, injeção incorreta e tipo não importado.
- Refatoração incompleta e domínios removidos não foram alterados.
- Nenhuma criação de serviço, stub ou domínio novo.
- Nenhuma alteração de tsconfig, strict ou contratos.

---

**Status:** SUCESSO PARCIAL — redução de 31 TS2304 (107 → 76). Meta ≤60 não atingida porque os 76 restantes são todos de refatoração incompleta (fora do escopo deste ciclo).
