# DECISION-0135 — RFC de nomenclatura canônica de permission keys

**Status:** **PROMULGADA / NORMATIVA (RFC docs-only).** **ZERO** código, migration, schema, runtime, grants,
alias-runtime, RBAC/FASE 6, financeiro, frontend. Este RFC fixa a **gramática canônica das permission keys** e a
**ratificação SSOT_REGISTRY→07→RFC** prometida pela DECISION-0134 §1.4 — **antes** de qualquer implementação
runtime de grants/capabilities. **`permission-keys.ts` NÃO é tocado** (cutover é frente futura).

**Data:** 2026-06-16 · **Branch:** `rescue-structural` · **HEAD:** `337a3c52` · **dev:** 390 (sem migration) ·
**Tipo:** arquitetural / nomenclatura / RFC · **Frente:** F-PERMISSION-KEYS-NOMENCLATURE-RFC ·
**Responsável:** Clayton / IA Diretora (executor: Claude) · **Validação prévia:** Clayton.

**Deriva de / subordinada a:** `07_NOMENCLATURA_CANONICA` (§3 regra suprema; §3.2 ordem SSOT_REGISTRY→07→impl;
§4.74 `permission`/`scope`) · `SSOT_REGISTRY_UNIFICARD` · **DECISION-0134** (referral=lookup + matriz baseline;
pediu este RFC) · **DECISION-0113** (actorId HINT; canRepresentActor) · **DECISION-0131** (gramática de
autoridade) · `backend/src/core/authorization/permission-keys.ts` (mapa canônico **vivo**).

---

## §1 — Vocabulário VIVO encontrado (READ-FIRST 1ª mão, `permission-keys.ts`, 33 keys)

| Domínio vivo | Keys | Forma |
| --- | --- | --- |
| `admin` | `view_audit_logs`, `view_consolidated_balance`, `view_fund_reports`, `view_regional_fund` | **verbo_objeto (view-first)** → LEGACY |
| `financial` | `execute_payout`, `view_ledger`, `view_all_ledger` | **verbo_objeto (view/execute-first)** → LEGACY |
| `financial_terms` | `confirm`, `view` | verbo simples |
| `split` | `create`, `view` | verbo simples |
| `calendar` | `block`, `unblock`, `view` | verbo simples |
| `service_order` | `create`, `view`, `confirm`, `start`, `complete`, `cancel`, `confirm_completion` | verbo simples |
| `bundle` | `create`, `confirm`, `view` | verbo simples |
| `rfq` | `create`, `view`, `close`, `convert` | verbo simples |
| `quote` | `submit`, `view` | verbo simples |
| `canonical_products` | `create` | verbo simples |
| `reports` | `view_operational` | **verbo_objeto (view-first)** → LEGACY |
| `dashboard` | `view` | verbo simples |

**Fatos confirmados (decisivos para as reconciliações):**
- O domínio financeiro vivo é **`financial:`** — **`finance:` NUNCA existiu** como key.
- O domínio temporal vivo é **`calendar:`** — **`agenda:`/`booking:` NÃO existem** como key.
- **`canonical_products:` existe**; **`products:` NÃO existe** como key viva.
- **Não existe `pos:` nem `pdv:`** como key viva.
- **Não existe `read:users`/`write:orders`** (formato invertido) vivo.
- **Não existe `suppliers:`** key viva.

---

## §2 — Gramática canônica (PROMULGADA)

1. **Forma:** `<domain>:<action>` — exatamente **um** `:`.
2. `domain` e `action` em **lowercase `snake_case`**.
3. **Proibido:** `domain:sub:action` (mais de um `:`); formato **pontilhado** (`domain.action`); formato
   **invertido** `read:object`/`write:object`.
4. **Ordem da action:**
   - **Ação simples → verbo simples.** Ex.: `service_order:confirm` · `bundle:create` · `calendar:block` ·
     `rfq:close` · `quote:submit`.
   - **Com subobjeto → `object_verb` (objeto primeiro).** Ex.: `inventory:stock_in_create` ·
     `inventory:stock_out_approve` · `financial:payout_request` · `financial:payout_approve` ·
     `support:tickets_close` · `compliance:kyc_approve`.
5. **Decisão `object_verb` (RFC):** quando houver subobjeto, o **objeto vem antes do verbo**. As keys vivas em
   **`verbo_objeto`** (view-first/execute-first) ficam **`LEGACY_ALIAS`** até cutover (§6) — **não** são
   reescritas agora.
6. Esta gramática **alinha** ao `permission-keys.ts` vivo (maioria já conforme) e ao 07 §4.74 (`scope`
   `read:users` é exemplo de *scope técnico OAuth*, **não** de permission key — permission key do UnifiCard é
   `domain:action`).

---

## §3 — Reconciliações vinculantes

1. **`finance:` → `financial:`** — domínio canônico = **`financial`** (confirmado vivo). `finance:*` fica
   **PROIBIDO** para novas keys; toda referência documental futura usa `financial:*`. A matriz da DECISION-0134
   §3.9 (`finance:*`) é **reconciliada para `financial:*`** por este RFC. Capabilities financeiras = **CRITICAL_FINANCIAL**.
2. **`agenda:` / `booking:` / `calendar:`** — domínio canônico de permissão temporal = **`calendar`** (vivo).
   Label de produto **pode** continuar "Agenda". `agenda:*` **não** vira key runtime. `booking:*` (se existir
   frontend-only) = reconciliação futura → `calendar:*` ou domínio específico (`DECISION_PENDING`).
3. **`products:` / `canonical_products:`** — **NÃO colapsar sem prova.** READ-FIRST: `canonical_products:` é
   **vivo** (catálogo/produto canônico global, ontologia N0 `ProductTemplate`); `products:` **não tem key viva**
   mas é conceito distinto na ontologia (produto comercial do actor/empresa — `tenant_products`/`product_offers`,
   N1/N2). Classificação: **NÃO são DUPLICATE_CONCEPT** (ontologia os separa). `canonical_products:*` =
   `CANONICAL_READY` (catálogo global); `products:*` = `PRODUCT_DECISION_REQUIRED` (baseline; depende de
   confirmar a superfície comercial antes de virar key). Nenhum implementado agora.
4. **`pos:` / `pdv:`** — domínio canônico de permission key = **`pos`** (recomendado; **sem** key viva hoje).
   Módulo pode continuar "PDV" no código/produto. Se surgir `pdv:*` viva → **`LEGACY_ALIAS`** → `pos:*`. Não
   alterar runtime.
5. **`read:users` / `write:orders`** (invertido) — formato **PROIBIDO** para novas keys (§2.3). Nenhuma instância
   viva. Recomendação futura: `users:view`, `orders:write` (`NEEDS_RENAME` se algum dia aparecerem). Não migrar agora.
6. **`suppliers:credit_*`** — sem key viva. Forma canônica recomendada (object_verb): `suppliers:credit_view` ·
   `suppliers:credit_approve` · `suppliers:credit_limit_set`. `suppliers:credit_` solto (malformado) = `NEEDS_RENAME`.
   Não implementar agora.
7. **`service_order`, `bundle`, `rfq`, `quote`** — domínios vivos **mantidos**. Keys verb-only vivas são
   **válidas/`CANONICAL_READY`**: `service_order:confirm` · `bundle:create` · `rfq:close` · `quote:submit`.
8. **`financial_terms:`** — domínio vivo mantido. **CRITICAL_FINANCIAL** (service-order financeiro). Implementação
   futura que tocar dinheiro exige **3 paralelas**.
9. **`split:`** — domínio vivo mantido. **CRITICAL_FINANCIAL**.
10. **`votes`, `organization`, `contextual-thread`** — capabilities existem como **baseline conceitual**, mas o
    runtime está **CONTIDO/GHOST** (containments desta rodada). Marcar **`DO_NOT_IMPLEMENT_NOW`** até religação
    consciente (DTs próprias).
11. **`support` / `compliance` / `drivers` / `companies` / `customer_credit`** — **baseline conceitual**;
    dependem de decisão de produto → **`PRODUCT_DECISION_REQUIRED`**. Não implementar agora.

---

## §4 — Domínios canônicos do RFC (lista inicial)

`admin` · `financial` · `financial_terms` · `split` · `calendar` · `service_order` · `bundle` · `rfq` · `quote` ·
`canonical_products` · `products` *(somente se conceito comercial distinto confirmado — `PRODUCT_DECISION_REQUIRED`)* ·
`inventory` · `purchase_orders` · `suppliers` · `customers` · `customer_credit` · `pos` · `cash_drawer` · `cards` ·
`events` · `votes` · `services` · `compliance` · `support` · `notifications` · `automation` · `integrations` ·
`api_keys` · `webhooks` · `platform` · `reports` · `dashboard` · `drivers` · `companies`.

> Conflito sem prova suficiente → registrar **`DECISION_PENDING`**, nunca inventar. (Aplicado a `products` e
> `booking`.)

---

## §5 — Classes de classificação (toda capability recebe ≥1)

`CANONICAL_READY` · `LEGACY_ALIAS` · `NEEDS_RENAME` · `DUPLICATE_CONCEPT` · `CRITICAL_FINANCIAL` ·
`PRODUCT_DECISION_REQUIRED` · `DO_NOT_IMPLEMENT_NOW`.

**Classificação das keys VIVAS:**

| Key viva | Classe(s) |
| --- | --- |
| `service_order:*` (7) · `bundle:*` (3) · `rfq:*` (4) · `quote:*` (2) · `calendar:*` (3) · `dashboard:view` | CANONICAL_READY |
| `canonical_products:create` | CANONICAL_READY |
| `financial:view_ledger` · `financial:view_all_ledger` · `financial:execute_payout` | **LEGACY_ALIAS** + **CRITICAL_FINANCIAL** |
| `admin:view_audit_logs` · `view_consolidated_balance` · `view_fund_reports` · `view_regional_fund` · `reports:view_operational` | **LEGACY_ALIAS** |
| `financial_terms:confirm` · `financial_terms:view` | CANONICAL_READY + **CRITICAL_FINANCIAL** |
| `split:create` · `split:view` | CANONICAL_READY + **CRITICAL_FINANCIAL** |

---

## §6 — LEGACY_ALIAS (tabela documental — SEM runtime)

> Apenas RFC. **Nenhum alias é declarado em runtime.** Cutover (reescrever `permission-keys.ts` + usos) = frente
> futura, gated.

| old_key (viva ou baseline) | canonical_key (alvo) | status | motivo | uso atual | ação futura |
| --- | --- | --- | --- | --- | --- |
| `financial:view_ledger` | `financial:ledger_view` | LEGACY_ALIAS | view-first → object_verb | vivo (gate ledger) | cutover pós-RFC |
| `financial:view_all_ledger` | `financial:all_ledger_view` *(candidato; `DECISION_PENDING` p/ escopo "all")* | LEGACY_ALIAS | view-first + scope "all" | vivo (admin cross-actor) | confirmar grafia no cutover |
| `financial:execute_payout` | `financial:payout_execute` | LEGACY_ALIAS | execute-first → object_verb | vivo (payout) | cutover pós-RFC |
| `admin:view_audit_logs` | `admin:audit_logs_view` | LEGACY_ALIAS | view-first | vivo | cutover |
| `admin:view_consolidated_balance` | `admin:consolidated_balance_view` | LEGACY_ALIAS | view-first | vivo | cutover |
| `admin:view_fund_reports` | `admin:fund_reports_view` | LEGACY_ALIAS | view-first | vivo | cutover |
| `admin:view_regional_fund` | `admin:regional_fund_view` | LEGACY_ALIAS | view-first | vivo | cutover |
| `reports:view_operational` | `reports:operational_view` | LEGACY_ALIAS | view-first | vivo | cutover |
| `finance:*` (DECISION-0134 baseline) | `financial:*` | NEEDS_RENAME | domínio errado | só baseline-doc | adotar `financial:` |
| `agenda:*` (baseline) | `calendar:*` | NEEDS_RENAME | domínio temporal canônico = calendar | só baseline-doc | adotar `calendar:` |
| `booking:*` (se frontend) | `calendar:*` ou específico | DECISION_PENDING | conceito a confirmar | não verificado runtime | RFC futuro |
| `pdv:*` (se surgir) | `pos:*` | LEGACY_ALIAS | domínio canônico = pos | inexistente hoje | marcar se aparecer |
| `read:users` / `write:orders` | `users:view` / `orders:write` | NEEDS_RENAME | formato invertido proibido | inexistente hoje | só se aparecerem |
| `suppliers:credit_` (malformado) | `suppliers:credit_view`/`_approve`/`_limit_set` | NEEDS_RENAME | action incompleta | só baseline-doc | adotar forma object_verb |

---

## §7 — CRITICAL_FINANCIAL (não viram "checkbox executável")

Famílias: `financial:*` · `financial_terms:*` · `split:*` · `cards:*` · `cash_drawer:*` · `customer_credit:*` ·
`suppliers:credit_*` · `purchase_orders:*` quando mover estoque/dívida/dinheiro · `pos:*` quando envolver
refund/desconto-aprovado/preço-manual/caixa · payouts/recovery/refund/payment/transfer/ledger.

**Regra:** a capability pode autorizar **tentativa/solicitação**. A **execução financeira** exige: actor
authority · `bank_ledger` como SSOT · transação canônica · lock/concorrência · idempotência · auditoria ·
evento · **3 paralelas READ-ONLY antes de qualquer implementação material**.

---

## §8 — Código de indicação (reafirma DECISION-0134)

Pertence ao actor · lookup humano/canônico do actor · não substitui `actor_id` · não é authority · não substitui
`canRepresentActor` · não concede permissão sozinho · grants futuros gravados contra o `actor_id` resolvido ·
admin usa o código para localizar o actor e marcar capabilities.

**Frase canônica (RFC):**
> "O código de indicação **localiza** o actor; o grant **autoriza** o actor; o enforcement **valida** `actor_id`
> + authority (`canRepresentActor`/delegação/owner derivado)."

---

## §9 — Escopo negativo / NÃO decidido

`permission-keys.ts` **NÃO** tocado · zero alias runtime · zero grant · zero enforcement novo · zero mudança de
autorização runtime · zero código/frontend/migration/schema/tabela · zero RBAC/FASE 6 · zero financeiro/
`move_money` · zero referral implementado · zero ativação votes/contextual-thread/organization. **`DECISION_PENDING`:**
grafia de `financial:all_ledger_view`; conceito `booking:`; existência runtime de `products:` comercial. Cutover
de aliases + implementação de grants = frentes futuras (gated), pós-reseal deste RFC.

---

## §10 — Referências

`07_NOMENCLATURA_CANONICA` (§3, §3.2, §4.74) · `SSOT_REGISTRY_UNIFICARD` · `permission-keys.ts` (33 keys vivas) ·
`DECISION-0134` (baseline; pediu este RFC) · `DECISION-0113`/`DECISION-0131` · execution logs da rodada
authority/containment.
