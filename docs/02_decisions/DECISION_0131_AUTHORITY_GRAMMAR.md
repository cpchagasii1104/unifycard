# DECISION-0131 — Gramática de autoridade (DECISION-índice: cita 0013→0130, promulga 7 itens novos)

**Status:** **PROMULGADA / NORMATIVA.** **DOCS-ONLY** — zero código, zero migration, zero seed, zero RLS aplicada,
zero `cargo_templates`, zero mapper, zero delegação viva, zero seed de `financial_approval_*`, zero platform
authority, zero cartão físico. Esta DECISION é **gramática de autoridade**, não plano de execução: define a
linguagem e as regras que as frentes executoras futuras (gated) deverão obedecer.

**Data:** 2026-06-14 · **Branch:** `rescue-structural` · **HEAD vivo:** `20fe30cc` · **dev:** 385/385 (sem migration)
· **Tipo:** arquitetural / autoridade (DECISION-índice) · **Frente:** DECISION-0131 (cartório)

**Deriva de / subordinada a** (precedência soberana: `docs/ssot/AUTHORITY_PRECEDENCE.md`):
`docs/01_normative/AUTHORITY_LAW.md` (Art.1.3, 11, 17) · `docs/01_normative/AUTHORITY_ENFORCEMENT_MODEL.md` ·
`docs/01_normative/08_AUTORIDADE_CANONICA.md` (§10/§11) · `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` (§5.16) ·
e a cadeia de DECISIONs **DECISION-0021 · 0042 · 0113 · 0114 · 0116 · 0119 · 0120 · 0121 · 0124 · 0125 · 0126 ·
0127 · 0128 · 0129 · 0130**.

---

## §0 — Natureza desta DECISION

A 0131 é uma **DECISION-índice**: **CITA** a cadeia 0013→0130 + os textos soberanos (não os reabre, não reescreve
cabeçalho) e **PROMULGA apenas os 7 itens genuinamente novos** (§B). Tudo em §A (âncoras) e §C (não-GO) é fixo. A
execução de qualquer item §B é **frente futura própria** (gated por GO + tripé guard/negative-proof/e2e), **fora desta
DECISION**.

## §A — Âncoras citadas (já decidido pelo cânone — 0131 não re-decide)

- **role/status/flag ≠ autoridade** → AUTHORITY_LAW **Art.17**.
- **actorId declarado pelo cliente = hint; binding obrigatório** → **DECISION-0113** (5 canais + variante body).
- **delegação temporal + fecho humano; SSOT única de delegação = `actor_delegations`** → Art.1.3 / LEI §4.9.9 /
  **SSOT_REGISTRY §5.16** (não duplicar 2ª SSOT de delegação).
- **tombstones:** `user_identity_links` → 08 §10.2; stub RBAC (`actor_has_permission`=`RETURN FALSE`) → 0013/C47
  (FASE 6); `organization_members` (não-autoridade / tabela ausente) → 0130 D1/D11.
- **aprovação financeira = substrato Core; aprovar ≠ executar; 4-eyes** → **0128 / 0129 / 0130**.
- **membership SSOT = `company_users`** → 0042; **grant fino = `can_*`** → 0125; **tenant-scope** → 0126;
  **Core = jurisdição** → 0021.

## §B — Promulgações (gramática nova)

### B1 — Cargo-template (materializa grants; NUNCA SSOT de autoridade)
Cargo existe como **catálogo-template** (pacote operacional) que **materializa grants reais**. **Regras vinculantes:**
- cargo **não é SSOT de autoridade**; cargo **não aprova dinheiro**; cargo **não substitui** `actor` / `canRepresentActor`
  / `company_users` / `tenant_operator_grants` / **`financial_approval_authorities`**.
- atribuir cargo **expande em grants materiais reais**; **runtime decide apenas por grant material ativo**, nunca pelo
  cargo; `grant_origin` registra a origem (proveniência **imutável**, nunca autoridade atual).
- **revogar cargo cascateia** nos grants que ele materializou (por `grant_origin`); **alterar template não retroage
  silenciosamente** em grants já concedidos.
- **Opção C (indireção viva — runtime resolve `user → cargo → capabilities` como autoridade) é PROIBIDA** (reabriria a
  porta que 0129/0130 fecharam).
- **🔒 EMENDA 1 (obrigatória):** cargo-template **NÃO PODE materializar `financial_approval_authorities`**. Autoridade
  financeira é **Core-only** e nasce por **seed soberano (PORTA-1)** — nunca por cargo.

### B2 — Contrato temporal comum (colunas por substrato, vocabulário comum)
Os substratos de grant adotam um **vocabulário temporal comum por colunas** (não um envelope centralizado):
`valid_from` · `valid_until` · `revoked_at` · `suspended_at` · `reason` · `created_by` · `revoked_by`. **Regras:**
- **tempo de autoridade ≠ agenda**; **agenda nunca autoriza dinheiro** (vetado colapsar `Booking`/`AvailabilityStatus`).
- **`financial_approval_authorities` mantém o lifecycle DENTRO do Core** (não compartilha envelope) — preserva o
  isolamento de 0129/0130.
- `tenant_operator_grants` (hoje só `is_active`/`updated_at`) **recebe migration** para aderir ao vocabulário comum
  (aditiva, nullable, backfill `valid_from = created_at`); **drift entre substratos protegido por guard**.
- *(estado vivo: 3 vocabulários divergentes — `tenant_operator_grants` {is_active,updated_at} · `financial_approval_
  authorities` {is_active,revoked_at,created_at} · `actor_delegations` {status,expires_at,revoked_at,…}.)*

### B3 — Mapper de identidade canônico (`actor_id` universal na composição)
`actor_id` é a **chave operacional universal** (já é a Lei — `actor` unidade operacional/D2). Deve existir **mapper
explícito** `user_id ↔ global_user_id ↔ actor_id`. Cada plano mantém sua chave de origem, mas a **composição de
autoridade resolve para `actor_id`**. **Justificativa:** o sistema é actor-centric; `canRepresentActor` opera em
`(userId, actorId)`; sem mapper, `company_users`/`tenant_operator_grants` (`global_user_id`),
`financial_approval_authorities` (`user_id`) e `actor_delegations` (actor ids) **não compõem** com segurança.
- **🔒 EMENDA 2 (obrigatória):** o mapper é **resolvedor de COMPOSIÇÃO**, **NÃO** re-key dos planos. Em particular,
  **NÃO re-keyar o Core financeiro**: `financial_approval_authorities` **permanece `user_id`-bound** porque a segregação
  `requested_by_user_id != approved_by_user_id` (0130 D3) é **user-level**. Qualquer migration de normalização de FK
  **exclui** `financial_approval_authorities`.

### B4 — Normalização de membership/owner (ratifica 0042 + Art.17)
`member_status` = **SSOT de estado de vínculo**; `is_active` = **projeção/tombstone**; `role='owner'` **≠ supergrant
eterno** em runtime. **Sequência obrigatória antes de flipar runtime (V2/`canManageCompany`):** (1) **medir** divergência
(`can_manage_company` vs `role='owner'` em `company_users WHERE member_status='active'`); (2) **backfill** de
`can_manage_company` para owners legítimos; (3) **só então** normalizar `canManageCompany`/`checkOwnership`; (4) **guard**
anti-regressão. *(vivo: 2 rows, 0 divergências — normalização profilática, mas a sequência é lei mesmo em escala pequena.)*

### B5 — RLS nos planos de autoridade (direção promulgada; execução futura gated)
**Direção aprovada:** **RLS forçada** nos planos de autoridade — `company_users` · `actor_delegations` ·
`financial_approval_authorities` · `tenant_operator_grants` · `reconciliation_disputes` · `reversals` (paridade com
`bank_ledger`/`user_roles`, que já têm `rls=t/forced=t`). Defesa em profundidade: nível enterprise exige mais que
isolamento app-level. **Execução = frente futura** (não nesta DECISION). **Regras de execução:**
- **🔒 EMENDA 3 (obrigatória):** **pre-flight BLOQUEANTE** — validar o bypass/role de infraestrutura (`BYPASSRLS`) e
  rodar **smoke de worker + seed + migration sob RLS** ANTES de aplicar; RLS **não pode quebrar** workers/seed/migrations.
- **manter os guards app-level** (`runQueryWithTenant` + cerca de filtro `tenant_id`) **mesmo com RLS** (cinto + suspensório).
- *(vivo: os 6 planos = `rls=f/forced=f` hoje.)*

### B6 — Platform / cross-tenant (DEFERIDO)
**Deferido (P4).** **NÃO** criar `platform_operator_grants` na 0131. Tenant-scope segue **0126**; company-scope segue
`company_users`; financial-scope segue o **Core Financeiro**. Qualquer autoridade platform/cross-tenant exige **DECISION
própria futura**.

### B7 — Vocabulário de estados + hard-rules (ratifica)
**Cinco estados** como linguagem da 0131: `CANÔNICO` · `ADAPTADOR_TRANSITÓRIO` · `CONTIDO_FAIL_CLOSED` · `TOMBSTONE` ·
`DIVERGENTE`. **Hard-rule de jure:** **`actorId` declarado pelo cliente NUNCA é autoridade** — inclui
`actionContext.actorId` · `x-actor-id` · query `actorId` · params `actorId` · params `id` de recurso privado ·
`body actorId`/`body.actor` (a variante body é a **variante dos 5 canais 0113**, não um 6º canal). Qualquer `actorId`
declarado pelo cliente exige **binding server-side** (preferencialmente `canRepresentActor` ou primitivo canônico
equivalente). **Invariantes:** `assertActorRepresentable` é **não-removível**; o **stub `actor_has_permission` (`RETURN
FALSE`) não pode ser trocado sem frente própria** (guard trava o swap); tombstones exigem **guard anti-reativação**;
**seed da 1ª authority/delegation/RBAC é ato soberano**, nunca migration de dado casual.

## §C — NÃO-GO (fixos)

- 0131 é **docs-only**: zero código/migration/seed/Bank/worker/endpoint/RLS aplicada.
- **Seed da 1ª row** em `financial_approval_policies`/`authorities` = **ATO SOBERANO** (PORTA-1; DECISION/reseal próprio),
  nunca migration de dado casual. Idem **ligar o stub RBAC** (PORTA-2) e **semear delegação ativa** (PORTA-3).
- **R2/delegação não é ativável como autoridade viva** enquanto houver resíduos 0113 / superfícies clássicas sem reseal,
  e enquanto `actor_delegations` não tiver proveniência + E2E de delegação ativa.
- **Cartão físico = DECISION própria (≥0132):** scope `physical_card_authorization` (migration do CHECK), gate KYB
  explícito PJ, rehab de dispute/chargeback com binding, plano platform.
- Tombstones com guard anti-reativação; **citar, nunca reescrever** 0013/0042/0113/0125/0126/0128/0129/0130.

## §D — Estado vivo (1ª mão, dev 385) + portas soberanas

- `financial_approval_policies` **0** · `authorities` **0** · `policy_events` **0** → **payout fail-closed para todos**
  (substrato materializado por 0130, **NÃO semeado**).
- `actor_delegations` **9 rows / 0 ativas / 9 revogadas** (wired, inerte). `company_users` **2 / 0 divergências**.
- `organization_members` / `platform_operator_grants` / `cargo_templates` / `user_identity_links` = **AUSENTES**.
- RBAC legado semeado (8 roles / 76 perms / 1 user_role); decisor `actor_has_permission` = **`RETURN FALSE`**.
- RLS = **0** nos 6 planos de autoridade; `bank_ledger`/`user_roles` já com RLS. baseline DECISION-0113 = **0**.

**PORTAS SOBERANAS** (seed = promulgação, fora de qualquer GO de executora):
- **PORTA-1** 1ª row em `financial_approval_policies`+`authorities` → payout **aprovável** (hoje 0/0 = fail-closed).
- **PORTA-2** swap do `RETURN FALSE` em `actor_has_permission` → liga RBAC legado.
- **PORTA-3** 1ª delegação não-revogada → liga delegação **viva**.

## §E — Frentes futuras (gated; fora desta DECISION)

Cada item §B vira frente própria, sob GO + tripé (guard + negative-proof que morde + e2e): cargo-template (B1, com
EMENDA 1) · contrato temporal comum (B2, `tenant_operator_grants` migration) · mapper de identidade (B3, com EMENDA 2;
pré-req de B2/B5) · normalização membership (B4, medir→backfill→flip→guard) · RLS (B5, com EMENDA 3 pre-flight
bloqueante) · tombstone guards (stub RBAC swap, `organization_members`/`user_identity_links`). Platform (B6) e cartão
(≥0132) seguem deferidos.

## §F — Estado

DECISION-0131 **PROMULGADA / NORMATIVA — HOLD PARA RESEAL**. Gramática de autoridade definida: cargo materializa grants
(nunca autoridade financeira) · vocabulário temporal comum (Core isolado) · `actor_id` canônico na composição (Core
permanece `user_id`) · membership normalizada · RLS como direção (execução futura, pre-flight bloqueante) · platform
deferido · hard-rules de jure dos canais client-declared. **Sem código/migration/seed/runtime nesta DECISION (docs-only).**
Execução dos itens §B = frentes futuras gated. Seed (PORTA-1/2/3) e cartão (≥0132) = atos soberanos próprios.
