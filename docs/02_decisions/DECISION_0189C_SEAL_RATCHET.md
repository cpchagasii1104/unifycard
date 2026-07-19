# DECISION-0189C — FECHAMENTO C1–C5 (RATCHET + PROJEÇÕES FINANCEIRAS)

> Adendo terminal da cadeia DECISION-0189 / 0189A / 0189B. Promulgado por ratificação soberana
> (Clayton, 2026-07-19) para fechar as condições C1–C5 apontadas pela auditoria YALA final.
> **Docs-only estrito nesta etapa (A).** Material nas Etapas B–F; selo é da YALA independente.

HEAD de promulgação: `b05a1bd49`. Branch: `rescue-structural`.

## 0. O QUE A YALA FINAL ACHOU (correções ao overclaim de 0189B)
- **C1 — runner falso:** `run-regression-guards` (197) NÃO inclui o gate `red-gates-baseline`
  (financial-ssot). O script de prova `validate-yala-final-overview-data.ts` (backend/src) fazia
  `INSERT` cru em `bank_*` → **financial-ssot subiu 591→592**. O "197/197 verde" era parcial.
- **C2 — writer financeiro descrito como inócuo:** `financial_terms:confirm` (via
  `confirmFinancialTerms`) CRIA `bank_splits` (platform + provider). Não é "não move dinheiro".
  Pior: a checagem de autoridade só roda `if (confirmedByUserId)` — **chamada direta do service
  pula o gate**.
- **C3 — bypass do publication-engine:** `POST /publication/:entityType/:entityId/reactions`
  (+ `DELETE`) escreve na tabela `reactions` por semântica polimórfica SEM autoridade promulgada,
  contornando o caminho canônico `social-2.0` (interact_feed).
- **C4 — projeção de substrato em HOLD:** `reporting.service` e `risk-dashboard.service`
  chamam `payoutService.listOrders` / `invoiceService.listInvoices` e projetam valores/contagens
  financeiras enquanto a PORTA 01 está fechada.
- **C5 — evidências pendentes** de reprodução.

## 1. DECISÕES RATIFICADAS (D1–D8)

### D1 — `financial_terms:confirm` no PORTA_HOLD enquanto PORTA 01 fechada.

### D2 — Barreira no PRÓPRIO service
`confirmFinancialTerms` NÃO pode chamar `bankSplitRepository.createSplit` enquanto a PORTA 01
estiver fechada, mesmo invocado diretamente e mesmo com `FEATURE_FINANCIAL_ENABLED=true`
(a flag não é autoridade). Resposta uniforme `PORTA_01_CLOSED`; nenhum split; nenhum estado
parcial; nenhuma confirmação materializada antes do bloqueio.

### D3 — Inventário de writers financeiros
Todo caller de `createSplit` / `INSERT/UPDATE/DELETE bank_splits` / `bankTransactionRepository` /
`bankLedger` / payment execution / payout / settlement / capture inventariado. Nenhum writer
fora do núcleo Bank ou fora do HOLD pode permanecer (ver anexo §Matriz).

### D4 — `publication-engine` `POST|DELETE /:entityType/:entityId/reactions`
DESATIVADA com **HTTP 410 `{ code: 'GENERIC_REACTIONS_NOT_GOVERNED' }`** — semântica polimórfica
sem autoridade promulgada. A resposta ocorre ANTES de ler `actor_id`, resolver entidade, executar
`upsertReaction`/`removeReaction` ou escrever em `reactions`. Sem autoridade genérica improvisada.
Caminho canônico de posts permanece `social-2.0` com `interact_feed`.

### D5 — `reporting` e `risk-dashboard` sob HOLD
Enquanto PORTA 01 fechada: NÃO chamam `listOrders`/`listInvoices`; NÃO projetam valores,
contagens ou indicadores derivados de payouts/invoices. `tenant_operator_grants` (view_tenant_reports
/view_tenant_risk) NÃO superam o HOLD do substrato financeiro. Regra de resposta:
- separação inequívoca segura → devolver só conteúdo NÃO-financeiro + `financialDataStatus:
  'PORTA_01_CLOSED'` (zero valores/contagens);
- separação NÃO inequívoca → **503 `PORTA_01_CLOSED`** para a superfície inteira.

### D6 — Abertura futura dos agregados
Exigirá decisão própria: PermissionKey financeira tenant-scoped, audit trail, no-store e prova
com dados reais.

### D7 — Scripts de evidência FORA do runtime de produção
Fixtures financeiras vivem em suporte de teste/efêmero fora de `backend/src` e fora do build de
produção. O scanner `financial-ssot` NÃO será alterado para ignorar o defeito, e NÃO haverá
allowlist para esconder o script infrator. O baseline permanece 591 (nunca sobe para 592).

### D8 — `receive_funds` dormente
Permanece sem caller runtime; um guard impede novo caller sem decisão normativa.

## 2. MAPEAMENTO C1–C5 → D
- **C1** (runner verde de verdade) → D7 + Etapa B (mover fixtures; rodar red-gates no gate).
- **C2** (financial writer fechado) → D1 + D2 + D3.
- **C3** (bypass publication) → D4.
- **C4** (reporting/risk sob HOLD) → D5 (+ D6 para reabertura).
- **C5** (evidências) → Etapa F.

## 3. TRAVA DE ESCOPO
NÃO cria writer financeiro; NÃO reabre PORTA 01; NÃO sobe baseline financial-ssot; NÃO cria
allowlist; NÃO edita migration histórica; NÃO abre DT para deixar C1–C4 pendentes; NÃO afrouxa
guards; NÃO reescreve os 20 commits anteriores.

Anexo: `docs/04_audit/F_COMPANY_ACCESS_AUTHORITY_FINANCIAL_INVENTORY_2026-07-19.md` (§Ratchet 0189C).
