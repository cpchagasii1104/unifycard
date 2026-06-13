# DECISION-0123 — Modelo de autoridade para dispute/reversal HTTP (DECISION_REQUIRED)

**Status:** DECISION_REQUIRED / HOLD (modelo documentado; rotas seguem 403; reabilitação exige decisão de produto/política) · **Data:** 2026-06-13 · **Branch:** `rescue-structural` · **Frente:** F-DISPUTE-REVERSAL-AUTHORITY-BINDING-MODEL

**Precedência:** CONSTITUIÇÃO Art. V (economia com consentimento; reversão só pelo ator que executou) · `CORE_ESTORNOS_FINANCEIROS_CANONICO` · DECISION-0052 (autoridade de reversão) · DECISION-0113 (actorId client-declared = hint).

## Achado (READ-FIRST, rows=0 em todas as tabelas)

As 4 rotas HTTP estão **corretamente** 403-contidas. Análise:

- **P1 (estado puro, ZERO dinheiro):** `from-discrepancy`, `:id/to-review`, `:id/resolve` são transições
  de máquina de estado em `reconciliation_disputes`/`_events` — não chamam Bank/reversal.
- **P0 (move dinheiro REAL):** `:id/reversal` → `executeDisputeFinancialReversal` →
  `requestAndExecuteReversalSync` → `bankTransactionService.transfer` (escreve `bank_transactions`) com
  `reversalType:'external_reversal'` + `authoritySource:'system'` (DECISION-0052).

## Por que NÃO se reabilita nada agora (decisão requerida)

### P0 `/reversal` — DISABLED (Core de Aprovação Financeira ausente)
`CORE_ESTORNOS_FINANCEIROS_CANONICO` manda: `authoritySource='system'` = **evento externo**
(chargeback/fraude/gateway), **não** ação humana via HTTP. Toda ação HTTP é humana por definição →
exigiria `authoritySource ∈ {ownership, delegation, account_acl}` + **fluxo de aprovação** para
`internal_refund`. O motor `reversal.service` **não** invoca approval_requests; não há **Core de
Aprovação Financeira**. **Conflito irresolvível na taxonomia atual:** reversão de bank-tx via HTTP é
erro de categoria — o caminho legítimo é **job/evento interno**, não rota humana. Reabilitar exigiria
tocar engine/migration financeira (HARD STOP). → **Permanece 403.**

### P1 mutações — DISABLED (sem permission-key e sem política)
Apesar de não moverem dinheiro, **não há binding server-side simples**:
1. **Zero permission-key canônica** para `dispute:*`/`reconciliation:*` (`permission-keys.ts` tem 62
   chaves; nenhuma dessas). Reabilitar exige **definir** uma chave (decisão de arquitetura).
2. **Sem actor party resolvível:** uma disputa é objeto **operacional/sistêmico** de reconciliação, não
   uma transação iniciada por membro do tenant. `created_by_kind ∈ {system, admin, support}` — `system`
   é **proibido** de rota humana; `admin`/`support` **não têm** papel material fora do RBAC V2 (não
   soberano). Mapear req.user → kind/permissão exige **decisão de POLÍTICA** (quem faz reconciliação
   manual; escopo company-scoped vs tenant-only — não decidido).
3. Logo, reabilitar P1 **não** é "authority binding simples e não-financeiro" — é uma decisão de
   produto/política (STOP do GO). → **Permanece 403.**

## DECISÃO REQUERIDA (Clayton)

- **P0:** construir **Core de Aprovação Financeira** (`approval_requests` + lineage não-`system`) e mover
  reversão para **job/evento interno** — OU manter reversão exclusivamente interna (sem HTTP humano).
- **P1:** (a) definir permission-key (`dispute:mutate_status` ou estender `manage_financial`); (b)
  decidir a **política** de quem pode mutar disputas (e o `actor.kind` server-side derivado, nunca do
  body); (c) decidir escopo company vs tenant. Só então reabilitar com `req.user` →
  `canRepresentActor`/`authority.service`, **sem** `body.actor`, auditando o actor real.

## Invariantes preservados (zero código de rota/Bank tocado)

`body.actor`/`actor.kind`/`authoritySource` do body = HINT, nunca autoridade. As 4 rotas seguem 403
fail-closed (3× `DISPUTE_MUTATION_HTTP_DISABLED` + `DISPUTE_REVERSAL_HTTP_DISABLED`); `GET /disputes/:id/
events` preservado. Motor de reversão, `reversals`, CHECKs financeiros, RBAC V2 — **intocados**.

## Prova

e2e `validate-pipeline-e2e-dispute-reversal-authority-model.ts` (DB efêmera, **10/10**): 4 rotas 403
(body.actor ignorado, 403 antes de parseActor/service) · zero linha em reconciliation_disputes/_events ·
zero linha em reversals/bank_ledger/bank_transactions · contenções + GET /events intactos. Gates verdes;
tsc 25 (baseline, zero novo); sem migration; dev 380.
