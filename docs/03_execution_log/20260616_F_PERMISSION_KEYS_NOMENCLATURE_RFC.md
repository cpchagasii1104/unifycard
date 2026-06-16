# 2026-06-16 — F-PERMISSION-KEYS-NOMENCLATURE-RFC

RFC **docs-only** que fixa a gramática canônica das permission keys (ratificação `SSOT_REGISTRY→07→RFC`
prometida pela DECISION-0134 §1.4) ANTES de qualquer implementação runtime de grants. Promulga DECISION-0135.
**`permission-keys.ts` NÃO tocado; zero runtime/grant/schema.**

## Anchor / Pré-flight

HEAD `337a3c52` · branch `rescue-structural` · superfícies materiais (backend/src, frontend/src, migrations,
scripts, permission-keys.ts) **LIMPAS** · dev 390. STOP não disparado.

## READ-FIRST (Evidence Pack)

Lidos 1ª mão: DECISION-0134 + seu execution log · STATUS · REMEDIATION_DECISIONS_LOG (0135 livre) ·
REMEDIATION_DT_LOG · `07_NOMENCLATURA_CANONICA` (§3, §3.2, §4.74) · **`backend/src/core/authorization/permission-keys.ts`**
(extração das **33 keys vivas**).

## Padrão VIVO encontrado (33 keys)

- Domínios vivos: `admin` · `financial` · `financial_terms` · `split` · `calendar` · `service_order` · `bundle` ·
  `rfq` · `quote` · `canonical_products` · `reports` · `dashboard`.
- **Maioria já conforme** `domain:action` verbo-simples (`service_order:confirm`, `calendar:block`, `bundle:create`).
- **Verb-first (LEGACY):** `financial:view_ledger`/`view_all_ledger`/`execute_payout` · `admin:view_audit_logs`/
  `view_consolidated_balance`/`view_fund_reports`/`view_regional_fund` · `reports:view_operational`.
- **Fatos decisivos:** `financial:` é vivo (**`finance:` nunca existiu**); `calendar:` é vivo (**agenda/booking não
  são keys**); `canonical_products:` vivo, `products:` **sem key viva**; **sem `pos:`/`pdv:`**; **sem `read:`/`write:` invertido**; **sem `suppliers:`**.

## Decisões de nomenclatura (DECISION-0135)

- **Gramática:** `<domain>:<action>`, 1 `:`, lowercase snake_case; proibido multi-`:`, pontilhado, invertido.
- **Ordem da action = `object_verb`** com subobjeto; verbo simples quando simples. Verbo_objeto vivo → LEGACY_ALIAS.
- **Classes:** CANONICAL_READY / LEGACY_ALIAS / NEEDS_RENAME / DUPLICATE_CONCEPT / CRITICAL_FINANCIAL /
  PRODUCT_DECISION_REQUIRED / DO_NOT_IMPLEMENT_NOW.

## Reconciliações

- **finance → financial** (financial vivo; finance proibido p/ novas keys; CRITICAL).
- **agenda/booking → calendar** (calendar vivo; agenda = label de produto; booking = DECISION_PENDING).
- **products × canonical_products** (canonical_products vivo = catálogo N0; products = comercial N1/N2,
  conceito DISTINTO, NÃO duplicate; products = PRODUCT_DECISION_REQUIRED).
- **pos/pdv** (pos canônico recomendado; sem key viva; pdv→pos se surgir).
- **read:users/write:orders** invertido proibido (sem instância viva).
- **suppliers:credit_** → object_verb (`credit_view`/`credit_approve`/`credit_limit_set`).
- **service_order/bundle/rfq/quote** mantidos (verb-only válidos).
- **financial_terms/split** mantidos = CRITICAL_FINANCIAL.
- **votes/organization/contextual-thread** = DO_NOT_IMPLEMENT_NOW (ghost contido).

## Aliases (documental, sem runtime)

Tabela LEGACY_ALIAS em DECISION-0135 §6: financial:view_ledger→ledger_view · view_all_ledger→all_ledger_view
(DECISION_PENDING p/ "all") · execute_payout→payout_execute · admin:view_*→*_view · reports:view_operational→
operational_view · finance:*→financial:* · agenda:*→calendar:* · pdv:*→pos:* · read:users→users:view ·
suppliers:credit_→credit_*. **Nenhum alias declarado em runtime.**

## CRITICAL_FINANCIAL

financial/financial_terms/split/cards/cash_drawer/customer_credit/suppliers:credit_/purchase_orders(money)/
pos(refund/desconto/preço/caixa)/payout/recovery/refund/payment/transfer/ledger. Capability autoriza tentativa;
execução exige bank_ledger SSOT + transação + lock + idempotência + auditoria + evento + 3 paralelas.

## Provas / escopo negativo / gates

- `git diff` = só docs (DECISION-0135 + decisions log + STATUS + este log). **ZERO** `.ts`/`.tsx`/`.sql`/`.mjs`/
  `.ps1`/migration/backend-src/frontend/`permission-keys.ts`.
- Gate: `node scripts/validate-architectural-patterns.mjs --strict` → critical_new=0.
- NÃO tocado: permission-keys.ts · código/runtime/migration/schema · grants/enforcement/RBAC/FASE 6 ·
  financeiro/Bank/ledger · referral · ativação votes/contextual-thread/organization · frontend.

## Próximos passos (recomendados, não diretriz)

1. Reseal Yala deste RFC. 2. Cutover de aliases em `permission-keys.ts` (frente própria, gated, com guard/neg-proof).
3. Implementação runtime de grants (tabela contra actor_id + resolver do referral + enforcement), pós-cutover.

## Estado

**CLOSED / YALA PASS (docs-only RFC).** Fecha SÓ como **F-PERMISSION-KEYS-NOMENCLATURE-RFC**: gramática `domain:action` +
object_verb + reconciliações (finance→financial, agenda→calendar, products×canonical_products, pos/pdv, invertido,
suppliers:credit_) + classes + aliases documentais + CRITICAL_FINANCIAL promulgados; `permission-keys.ts` intocado;
implementação/cutover/grants = frentes futuras gated. dev 390.

## YALA RESEAL — PASS (2026-06-16, adversarial READ-ONLY)

- **Veredito:** **PASS** (reseal adversarial READ-ONLY). Commit material `6dee2ea7` · branch `rescue-structural` · dev 390.
- **Confirmado:** formato `<domain>:<action>`; action `object_verb` p/ subobjeto; chaves vivas preservadas;
  **`permission-keys.ts` intocado**; aliases **apenas documentais** (sem runtime); **zero runtime**; **zero grants**;
  **referral = lookup, nunca authority**; financeiro **CRITICAL** (não checkbox executável); módulos ghost
  (votes/organization/contextual-thread) = **DO_NOT_IMPLEMENT_NOW**.
- **Warnings não-bloqueantes (registrados):**
  - **W1 —** `financial:execute_payout` tem capability viva **`can_hold_assets`**. O cutover para
    `financial:payout_execute` **NÃO é cosmético**: toca **money-path**. Qualquer rename/cutover dessa key exige
    **frente própria, gates, negative-proof, e2e e 3 paralelas**.
  - **W2 —** `products:` permanece **PRODUCT_DECISION_REQUIRED**. NÃO declarar `products` como domínio runtime
    canônico até decisão explícita separando/confirmando `canonical_products:*` (catálogo N0) × `products:*`
    (produto comercial N1/N2, se existir).
- **DECISION_PENDING reais:** `financial:all_ledger_view` (grafia do escopo "all") · `booking:` (conceito) ·
  `products:` (existência runtime comercial).
- **Sequência correta (pós-selo):** cutover de aliases em `permission-keys.ts` = frente futura própria (W1) →
  grants runtime **depois** do cutover → financeiro = **3 paralelas** → UI checkboxes **depois** de grants →
  referral resolver = frente futura mantendo **lookup ≠ authority**.
- **Selo:** commit docs-only `docs: seal permission key nomenclature rfc`. Estado final: **CLOSED / YALA PASS**.
