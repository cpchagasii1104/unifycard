# 2026-06-16 — PRIMEIRA ONDA INDEPENDENTE (DECISION-0131) · BATCH 7 (PDV-F2B — 9 ROTAS RESTANTES + AUDIT HARDENING)

Pós-PASS Yala do PDV-F2A (commit `7be810f1`). **PDV-F2B** — corrigir autoridade/autoria das **9 rotas PDV restantes**
(sessions ×6, orders ×1, items ×2) + endurecer a trilha de auditoria do pagamento, **sem mexer em Bank/Core**. Parent
`7be810f1` · branch `rescue-structural` · dev **385/385** (sem migration).

## READ-FIRST (1ª mão) — vínculo material por rota

Todas as 9 rotas têm vínculo material resolvível server-side → **ZERO STOP/REQUER-DECISÃO**:

| Rota | Modelo | Vínculo material (server-side) | Audit `actor_id` (antes → depois) |
| --- | --- | --- | --- |
| `POST /sessions/open` | A | `actionContext.actorId` (operador declarado = HINT) | `session.actorId` (já DB; +binding) |
| `POST /sessions/:id/close` | B | `pdv_sessions.actor_id` (dono, via `findSessionById`) | `session.actorId` (já DB; +binding) |
| `GET /sessions/open` | A (reader) | `actionContext.actorId` | — (reader; +binding anti-spoof) |
| `GET /sessions` | A (reader) | `actionContext.actorId` | — (reader; +binding anti-spoof) |
| `GET /sessions/:id/summary` | B (reader) | `pdv_sessions.actor_id` (via `findSessionById`) | — (reader; +binding anti-spoof por id) |
| `POST /sessions/:id/close-with-summary` | B | `pdv_sessions.actor_id` | `summary.operator.actorId` (já DB; +binding) |
| `POST /orders` | C | `input.sessionId` → `session.actor_id` (operador) | `actionContext.actorId` **CRU** → `session.actorId` validado |
| `POST /orders/:orderId/items/unit` | D | `getOrderById` → `seller_actor_id` | `actionContext.actorId` **CRU** → `order.sellerActorId` validado |
| `POST /orders/:orderId/items/weight` | D | `getOrderById` → `seller_actor_id` | `actionContext.actorId` **CRU** → `order.sellerActorId` validado |
| `POST /orders/:orderId/pay` (F2A) | E | `getOrderById` → `seller_actor_id` (gate F2A intacto) | `actionContext.actorId` **CRU** → `order.sellerActorId` validado |

`orders` **NÃO tem `session_id`** (sem FK order→session) — por isso items bindam pelo **seller da ordem** (não pela
sessão). `actionContext.actorId` é **HINT/seleção de actor operacional, NUNCA autoridade final**.

## Correção (runtime só em `src/modules/pdv`)

- **`pdv.routes.ts`:** helper `assertRepresents(req, reply, tenantId, targetActorId)` = `canRepresentActor` server-side;
  nega 403 fail-closed (401 sem user). Aplicado nas 9 rotas conforme A/B/C/D. Readers (`GET /sessions{,/open}`,
  `/sessions/:id/summary`) deixam de ser leakáveis por spoof de `actorId`. As 4 auditorias com `actor_id` CRU passam a
  gravar o actor VALIDADO. **`POST /pay` (F2A) preservada** (gate + consistência seller/buyer); só o audit endureceu.
- **`pdv.service.ts`:** +`findSessionById` (nullable, sem throw) p/ distinguir 404 (ausente) de 403 (sem autoridade).
- **NÃO tocado:** `payOrderFromPdv`/`paymentExecutionService` · Bank/Core/ledger/seed/migration · as repositories de escrita.

## Classificação (antes → depois)

10 rotas: **DIVERGENT (canal-1 sem binding) → CANONICAL** (binding por representabilidade `canRepresentActor`,
role-independente). Consistente com a classe CANONICAL da pay (F2A, PASS Yala): o primitivo é `canRepresentActor`, não
role/role-fallback.

## Provas (tripé)

- **Guard** `audit-pdv-authority-lock.mjs` (estendido): 10 CANONICAL; FALHA se — rota nova não classificada · helper
  `assertRepresents` ausente ou sem primitivo real (canRepresentActor) · cobertura <9 chamadas `assertRepresents` ·
  reaparecer `actor_id: actionContext.actorId` cru · pay perder getOrderById/binding ou chamar payOrderFromPdv antes do
  gate · bank_ledger/transactions/splits direto.
- **Negative-proof** `negative-proof-pdv-authority-lock.ps1` (estendido): **7 mordidas** —
  (a) stub-primitivo · (b) sem getOrderById · (c) side-effect antes do gate · (d) rota nova · (e) bank-touch ·
  (f) cobertura de binding cai · (g) autoria crua reintroduzida. Restauração **byte-idêntica** (SHA256).
- **E2E** `validate-pipeline-e2e-pdv-payment-authority.ts` (DB efêmera, social ports, **zero dinheiro**): **9/9** —
  T1/T2/T3 (pay, F2A) preservados · **T6** `GET /sessions` representando o próprio actor → ≠403 · **T7** spoof
  `actionContext.actorId` → **403** (reader binding) · **T8** summary de sessão alheia (Modelo B) → **403** · **T9** dono
  lê a própria sessão → ≠403 · T10 guard verde. Readers ISOLAM o gate (sem `requirePermission` interferindo).

| Prova | Resultado |
| --- | --- |
| e2e (efêmero, zero dinheiro) | **9/9** |
| negative-proof | 7 mordidas; byte-idêntico |
| pdv-authority-lock guard | GATE OK (10 CANONICAL; 9 `assertRepresents` + pay) |
| regression-guards (chain) | rc=0 (0113 baseline=0) |
| arch (validate-architectural-rules) | 33 CRITICAL pré-existentes (REGRA 2/3 profile/categories); **0 em modules/pdv** |
| tsc | build **25** · strict **43** (0 atribuível aos arquivos tocados) |

## NÃO TOCADOS

Bank · Core financeiro · `financial_approval_*` · `payOrderFromPdv`/`paymentExecutionService` · RLS · mapper · cargo ·
delegação · platform · cartão · social-work · seed · migration · RBAC (não ativado) · stub `actor_has_permission`
(RETURN FALSE) · C4/B3f/A1/E1/E2/B1f. dev 385/385.

## RISCOS / RESÍDUOS

- **`getSessionSummary` realtime** usa `pi.amount` (coluna ausente nesse schema) → 500 downstream **DO gate** (T9 prova
  que o gate passa; o 500 é bug latente de query, não-autoridade) — fora de escopo (frente própria).
- **Modelo operador × empresa:** items bindam pelo **seller da ordem**; create/sessões pelo **operador da sessão**. Se
  Clayton quiser exigir o operador-na-empresa-do-seller (autoridade composta), é decisão de produto (frente própria).
- **Resíduo service:** `payOrderFromPdv` ainda usa `input.sellerActorId/buyerActorId` (body) na execução; o gate da rota
  já exige casar com a ordem (F2A). Hardening service-level = evolução.

## Estado

WAVE-1 BATCH-7 (PDV-F2B) **IMPLEMENTED / HOLD PARA RESEAL**. Toda rota PDV prova `req.user` representa o actor material
(operador da sessão OU seller da ordem) ANTES de agir/ler; nenhuma grava autoria por `actionContext.actorId` cru; readers
deixam de ser leakáveis por spoof. **DT-PDV-CANAL1-AUTHORITY-NO-BINDING FECHADO.** dev 385; baseline 0113=0; Bank/Core
intocados.
