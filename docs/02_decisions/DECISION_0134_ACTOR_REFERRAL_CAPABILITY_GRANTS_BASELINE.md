# DECISION-0134 — Actor referral como lookup + baseline de capability grants

**Status:** **PROMULGADA / NORMATIVA (BASELINE).** **DOCS-ONLY** — zero código, zero migration, zero schema,
zero seed, zero runtime, zero RBAC/FASE 6, zero grant implementado, zero UI. Esta DECISION promulga
soberanamente: (a) o **código de indicação como chave humana de lookup de actor** (não autoridade); (b) o
**modelo de autoridade** (actor_id + grants + canRepresentActor/delegação/owner derivado); (c) uma **matriz
inicial de capabilities** como **baseline conceitual expansível**, na **forma canônica `domain:action`** exigida
por `07_NOMENCLATURA_CANONICA` + `permission-keys.ts` vivo. A **implementação runtime** dos grants é frente
própria futura (gated), e a **grafia final de cada chave** exige ratificação `SSOT_REGISTRY_UNIFICARD → 07 →
RFC` antes de virar enforcement (§3.2 do 07 — nenhum nome nasce no código/doc e é ratificado depois).

**Data:** 2026-06-16 · **Branch:** `rescue-structural` · **HEAD:** `957aeb32` · **dev:** 390 (sem migration) ·
**Tipo:** arquitetural / autoridade / baseline · **Frente:** F-AUTHORITY-PERMISSIONS-CLOSURE-BASELINE ·
**Responsável:** Clayton / IA Diretora (executor: Claude) · **Validação prévia:** Clayton.

> **Refinada / superseded parcialmente pela DECISION-0139** quanto a **actor-scoped referral code & earnings**
> (posse econômica do código por `owner_actor_id`; earnings → `actor_wallet` do owner; CPF não captura por
> reflexo; vetor `body.referral_code` travado; estado material USER_ONLY registrado). A §2 desta 0134
> (código pertence ao actor; lookup, não authority) **permanece vigente**; a 0139 apenas **adiciona** a dimensão
> econômica/earnings e a frente material `F-ACTOR-REFERRAL-CODE-SUBSTRATE`. _(Ponteiro append-only — história da 0134 preservada.)_

**Deriva de / subordinada a:** `CONSTITUICAO_UNIFICARD` (actor como unidade operacional soberana) ·
`SSOT_REGISTRY_UNIFICARD` · `07_NOMENCLATURA_CANONICA` (§3 regra suprema · §4.74 `permission`/`scope`) ·
`LEI_DE_COERENCIA_SISTEMICA` · **DECISION-0113** (actorId declarado é HINT; autoridade = `canRepresentActor`) ·
**DECISION-0131** (gramática de autoridade) · `permission-keys.ts` (mapa canônico vivo `domain:action`).

---

## §1 — Conformidade com 07_NOMENCLATURA_CANONICA (obrigatória)

A nomenclatura desta matriz **respeita o arquivo normativo 07**:

1. **Forma canônica da chave = `domain:action`** (colon; ambos os lados em `snake_case` lowercase). É a forma
   **viva** do mapa canônico `backend/src/core/authorization/permission-keys.ts` (`service_order:confirm`,
   `financial:view_ledger`, `financial:view_all_ledger`, `calendar:block`, `bundle:create`) e é coerente com o
   exemplo de `scope` técnico do 07 §4.74 (`'read:users'`, `'write:orders'`).
2. **Proibido trilho paralelo (07 §3):** "um conceito → um nome → uma forma". Nomes **pontilhados** de 3
   segmentos (ex.: `admin.panel.view`) **NÃO** são adotados como chave — criariam vocabulário paralelo ao
   `permission-keys.ts` vivo. As capabilities abaixo já vêm na forma canônica `domain:action`.
3. **Mapeamento determinístico** (quando a fonte veio em forma pontilhada): `primeiro_segmento` vira o `domain`;
   os segmentos restantes são unidos por `_` e formam o `action`. Ex.: `inventory.stock_in.approve` →
   `inventory:stock_in_approve`; `finance.payout.approve` → `finance:payout_approve`.
4. **§3.2 (ordem constitucional):** nenhum nome de permissão nasce "no doc/código primeiro" como constitucional
   final. Por isso esta matriz é **BASELINE CONCEITUAL**, NÃO enforcement: a **grafia final** de cada chave (e
   eventuais fusões com chaves já vivas, ex.: `finance:*` vs `financial:*` de `permission-keys.ts`) será
   **ratificada via `SSOT_REGISTRY_UNIFICARD → 07 → RFC`** na frente de implementação dos grants. Caveat
   explícito: o domínio financeiro vivo usa `financial:` (singular-prefixo) em `permission-keys.ts`; o baseline
   usa `finance:` por legibilidade — a **reconciliação `finance:`↔`financial:` é item obrigatório do RFC**, para
   não duplicar conceito (07 §3 proteção contra enum paralelo).
5. **Não-isolamento (07 §4.74):** `permission` nunca isolado; sempre `domain:action`/`has_permission`/
   `role_permission` conforme o contexto.

---

## §2 — Código de indicação = chave humana de acoplamento ao actor (PROMULGADO)

**Frase canônica:**
> "O código de indicação é uma chave humana de acoplamento ao actor; a autoridade continua sendo
> **actor_id + grants + canRepresentActor / delegação / owner derivado**."

Invariantes promulgados:

1. O código de indicação **pertence ao actor** (não ao CPF, não ao CNPJ).
2. **CPF/CNPJ podem originar múltiplos actors** (1 pessoa/empresa → N actors); o código é **único por actor**.
3. O código é **lookup humano/canônico** para **localizar** um actor (digitação por humano, exibição amigável).
4. O código **NÃO** substitui `actor_id`; **NÃO** é authority; **NÃO** substitui `canRepresentActor`.
5. **Permissão é concedida ao `actor_id` resolvido** — nunca ao código, nunca ao CPF/CNPJ.
6. **Fluxo admin (concessão de grant):** admin digita o código → sistema **resolve o actor** → mostra
   **nome/tipo/contexto** do actor → admin **confirma** → admin **marca capabilities** → grants são **gravados
   contra `actor_id`** (com `created_by_actor_id`=autoria, `tenant_id`=escopo, audit trail).
7. **Cargos/funções** (futuros) são **templates de capabilities**, **não** a fonte primária de autoridade. A
   verdade primária é `actor_id` + grants materiais; cargo é açúcar de atribuição em lote, reconciliável a grants.

Esta DECISION **NÃO** implementa o código de indicação (nem tabela, nem resolver, nem UI) — apenas promulga o
modelo. Implementação = frente própria futura.

---

## §3 — Matriz inicial de capabilities (BASELINE conceitual expansível · forma `domain:action`)

> Baseline, não enforcement. Domínios e capabilities abaixo orientam a implementação futura; a grafia final
> passa por SSOT_REGISTRY/RFC (§1.4). Classes de risco em §4.

### 3.1 Administração (`admin`)
`admin:panel_view` · `admin:profile_edit` · `admin:settings_edit` · `admin:members_view` · `admin:members_invite`
· `admin:members_remove` · `admin:permissions_view` · `admin:permissions_grant` · `admin:permissions_revoke` ·
`admin:audit_view`

### 3.2 Produtos (`products`)
`products:view` · `products:create` · `products:edit` · `products:disable` · `products:price_edit` ·
`products:cost_view` · `products:cost_edit` · `products:category_edit` · `products:image_manage`

### 3.3 Serviços (`services`)
`services:view` · `services:create` · `services:edit` · `services:disable` · `services:price_edit` ·
`services:duration_edit` · `services:agenda_link` · `services:marketplace_publish`

### 3.4 Agenda (`agenda`)
`agenda:view` · `agenda:create_slot` · `agenda:edit_slot` · `agenda:delete_slot` · `agenda:block_time` ·
`agenda:confirm_booking` · `agenda:cancel_booking` · `agenda:reschedule_booking` · `agenda:manage_participants`

### 3.5 Estoque (`inventory`)
`inventory:view` · `inventory:quantity_view` · `inventory:cost_view` · `inventory:stock_in_create` ·
`inventory:stock_in_approve` · `inventory:stock_out_create` · `inventory:stock_out_approve` ·
`inventory:adjustment_create` · `inventory:adjustment_approve` · `inventory:count_create` ·
`inventory:count_reconcile` · `inventory:transfer_create` · `inventory:transfer_send` ·
`inventory:transfer_receive` · `inventory:vendor_view` · `inventory:vendor_create` · `inventory:vendor_edit`

### 3.6 Compras / fornecedores (`purchase_orders`, `suppliers`)
`purchase_orders:view` · `purchase_orders:create` · `purchase_orders:edit` · `purchase_orders:approve` ·
`purchase_orders:receive` · `purchase_orders:receive_partial` · `purchase_orders:cancel` · `suppliers:view` ·
`suppliers:create` · `suppliers:edit` · `suppliers:approve` · `suppliers:reject` · `suppliers:credit_view` ·
`suppliers:credit_approve` · `suppliers:credit_limit_set`

### 3.7 Vendas / PDV (`pos`)
`pos:access` · `pos:sale_create` · `pos:sale_cancel` · `pos:sale_refund_request` · `pos:sale_discount_apply` ·
`pos:sale_discount_approve` · `pos:sale_price_override` · `pos:order_view` · `pos:order_edit` · `pos:order_fulfill`

### 3.8 Caixa (`cash_drawer`)
`cash_drawer:open` · `cash_drawer:close` · `cash_drawer:view_current` · `cash_drawer:view_history` ·
`cash_drawer:add_cash` · `cash_drawer:remove_cash` · `cash_drawer:reconcile`

### 3.9 Financeiro (`finance` — reconciliar com `financial:` vivo no RFC; ver §1.4)
`finance:balance_view` · `finance:statement_view` · `finance:receivables_view` · `finance:payables_view` ·
`finance:transfer_request` · `finance:transfer_approve` · `finance:payment_create` · `finance:payment_approve` ·
`finance:refund_request` · `finance:refund_approve` · `finance:payout_view` · `finance:payout_request` ·
`finance:payout_approve` · `finance:reconciliation_view`

> 🔴 **AVISO FINANCEIRO (CRITICAL):** financeiro é capability **crítica**. **Checkbox NÃO executa dinheiro
> sozinho.** Qualquer `move_money` exige `bank_ledger`, transação canônica, idempotência, locks, auditoria e
> **3 paralelas READ-ONLY** antes de qualquer implementação. O grant apenas **habilita pedir/aprovar**; a
> execução passa pelo cofre (Bank/Core) com workflow próprio.

### 3.10 Cartões (`cards`)
`cards:view` · `cards:transactions_view` · `cards:issue_request` · `cards:issue_approve` · `cards:activate` ·
`cards:block_temporary` · `cards:unblock` · `cards:cancel` · `cards:limit_view` · `cards:limit_request_change` ·
`cards:limit_approve_change` · `cards:dispute_open` · `cards:dispute_manage`

### 3.11 Clientes / CRM (`customers`, `customer_credit`)
`customers:view` · `customers:create` · `customers:edit` · `customers:notes_view` · `customers:notes_create` ·
`customers:export` · `customer_credit:view` · `customer_credit:request` · `customer_credit:analyze` ·
`customer_credit:approve` · `customer_credit:reject` · `customer_credit:limit_set` · `customer_credit:block` ·
`customer_credit:unblock`

### 3.12 Eventos (`events`)
`events:view` · `events:create` · `events:edit` · `events:publish` · `events:cancel` · `events:lineup_manage` ·
`events:venue_manage` · `events:ticket_lot_create` · `events:ticket_lot_edit` · `events:participants_view` ·
`events:participants_manage` · `events:checkin_perform` · `events:vote_create` · `events:vote_publish`

### 3.13 Votações (`votes`)
`votes:view` · `votes:create` · `votes:publish` · `votes:close` · `votes:vote` · `votes:results_view` ·
`votes:results_validate` · `votes:audit_view`

> ⚠️ **votes runtime está CONTIDO/GHOST** (F-VOTES-WRITES-EXPLICIT-FAIL-CLOSED-CONTAINMENT; tabelas ausentes +
> `req.activeActor` fantasma). Esta matriz é **baseline conceitual**; a **elegibilidade fina** (quem cria/
> publica/encerra/vota, quorum, corpo decisor) permanece **decisão Clayton** (DT-VOTES-FINE-GRAINED-ELIGIBILITY-POLICY).

### 3.14 Suporte / atendimento (`support`)
`support:tickets_view_own` · `support:tickets_view_assigned` · `support:tickets_view_all` ·
`support:tickets_create` · `support:tickets_create_on_behalf` · `support:tickets_assign` ·
`support:tickets_reassign` · `support:tickets_respond` · `support:tickets_internal_note_create` ·
`support:tickets_internal_note_view` · `support:tickets_priority_change` · `support:tickets_status_change` ·
`support:tickets_close` · `support:tickets_reopen` · `support:tickets_escalate` · `support:tickets_sla_manage` ·
`support:chat_respond` · `support:chat_transfer` · `support:chat_close`

### 3.15 Validações / Aprovações / Compliance (`compliance`, `companies`, `drivers`, `suppliers`, `platform`)
`compliance:documents_view` · `compliance:documents_review` · `compliance:documents_approve` ·
`compliance:documents_reject` · `compliance:documents_request_correction` · `compliance:kyc_view` ·
`compliance:kyc_approve` · `compliance:kyc_reject` · `compliance:kyb_view` · `compliance:kyb_approve` ·
`compliance:kyb_reject` · `companies:registration_review` · `companies:registration_approve` ·
`companies:registration_reject` · `drivers:documents_review` · `drivers:documents_approve` ·
`drivers:status_approve` · `drivers:status_suspend` · `suppliers:documents_approve` ·
`platform:review_queue_view` · `platform:review_queue_assign` · `platform:review_queue_resolve`

### 3.16 Relatórios (`reports`)
`reports:operational_view` · `reports:financial_view` · `reports:sales_view` · `reports:inventory_view` ·
`reports:cash_drawer_view` · `reports:audit_view` · `reports:export`

### 3.17 Automações / integrações (`automation`, `notifications`, `integrations`, `api_keys`, `webhooks`)
`automation:view` · `automation:create` · `automation:edit` · `automation:disable` · `notifications:view` ·
`notifications:send` · `notifications:templates_manage` · `integrations:view` · `integrations:configure` ·
`api_keys:create` · `api_keys:revoke` · `webhooks:manage`

---

## §4 — Classificação de risco (baseline)

| Classe | Definição | Tratamento |
| --- | --- | --- |
| **LOW** | leitura / edição **não-financeira** | grant simples |
| **MEDIUM** | operação que altera **estado operacional** | grant simples (audit recomendado) |
| **HIGH** | estoque, **aprovação**, suporte sensível, **dados de cliente** | exige **audit trail + motivo + escopo** |
| **CRITICAL** | **dinheiro, cartão, crédito, saldo, payout, refund, ledger, split, recovery** | exige **workflow financeiro/compliance** — **nunca só checkbox** |

- **LOW/MEDIUM** → podem virar grants simples.
- **HIGH** → exigem audit trail, motivo e escopo.
- **CRITICAL** → exigem workflow financeiro/compliance (Bank/Core, idempotência, locks, 3 paralelas), **jamais**
  apenas um checkbox. Inclui todo `finance:*` que mova/aprove dinheiro, `cards:*` de emissão/limite/dispute,
  `customer_credit:*` de aprovação/limite, `suppliers:credit_*`, `cash_drawer:add_cash`/`remove_cash`/`reconcile`,
  `pos:sale_refund_request`.

---

## §5 — Estado da frente AUTHORITY / PERMISSIONS

**CLOSED nesta rodada (família DECISION-0113 / write-authorship + schema-ghost containment):**
- service-order write-authorship (`c53330e0`, CLOSED/YALA PASS);
- service-bundle write-authorship (`380981ea`, CLOSED/YALA PASS);
- votes writes containment (`3404c565`, CLOSED/YALA PASS);
- contextual-thread containment (`19499b90`, CLOSED/YALA PASS);
- organization containment (`fb262919`, CLOSED/YALA PASS);
- suppliers/PO owner authority (DECISION-0133 + wiring, CLOSED/YALA PASS);
- contacts schema-ghost containment (fechado anteriormente);
- 0131-wave docs seal.

**OPEN controlado (frentes próprias / decisão Clayton — NÃO abertas aqui):**
- votes activation/schema/eligibility (DT-VOTES-ACTIVE-ACTOR-WIRING-MISSING / -WRITE-AUTHORSHIP-BINDING-LATENT / -FINE-GRAINED-ELIGIBILITY-POLICY);
- contextual-thread schema/binding (DT-CONTEXTUAL-THREAD-SCHEMA-GHOST / -WRITE-AUTHORSHIP-BINDING-LATENT);
- organization schema/binding (DT-ORGANIZATION-SCHEMA-GHOST / -AUTHORITY-BINDING-LATENT; tombstone `organization_members`);
- organizers built-but-unmounted (DT-ORGANIZERS-BUILT-BUT-UNMOUNTED — billing/Stripe);
- human-mvp triagem por rota;
- campanha de containment reports/automation/agreements/business-audit/system-notifications (a varrer);
- financeiro/payout/split/recovery/confirm-financial-terms (3 paralelas; cofre);
- **implementação runtime dos grants/capabilities** (nova frente — tabela de grants, resolver, enforcement);
- **UI de checkboxes de permissões**;
- **cargos/templates de permissões** (açúcar de atribuição sobre grants).

---

## §6 — Critério de fechamento da baseline (atendido)

A frente authority/permissões fica encerrada como **baseline documental** porque: (1) matriz inicial registrada
(forma canônica `domain:action`, conforme 07); (2) código de indicação definido como actor lookup; (3) módulos
vivos corrigidos listados; (4) módulos ghost contidos listados; (5) módulos fora da rodada listados; (6)
financeiro explicitamente travado (CRITICAL, 3 paralelas); (7) implementação futura de grants registrada como
nova frente.

---

## §7 — NÃO decidido / fora de escopo

Implementação runtime de grants · resolver/tabela do código de indicação · UI · role system / cargos · ativação
de votes/contextual-thread/organization · montagem de organizers · grafia final/registro SSOT_REGISTRY das
chaves · reconciliação `finance:`↔`financial:` (vai ao RFC) · qualquer `move_money` · RBAC/FASE 6 · RLS ·
migration/schema · frontend. **Nada material foi tocado por esta DECISION (docs-only).**

---

## §8 — Referências

`07_NOMENCLATURA_CANONICA` (§3 regra suprema, §4.74 permission/scope) · `SSOT_REGISTRY_UNIFICARD` ·
`permission-keys.ts` (mapa canônico vivo `domain:action`) · `DECISION-0113` (actorId HINT / canRepresentActor) ·
`DECISION-0131` (gramática de autoridade) · execution logs desta rodada (service-order/service-bundle/votes/
contextual-thread/organization) · `DECISION-0133` (suppliers owner) · DTs OPEN listadas em §5.
