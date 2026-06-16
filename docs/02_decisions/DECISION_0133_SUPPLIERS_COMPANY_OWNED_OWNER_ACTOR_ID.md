# DECISION-0133 — Suppliers company-owned via `owner_actor_id`

**Status:** **PROMULGADA / NORMATIVA.** **DOCS-ONLY** — zero código, zero migration, zero schema, zero seed,
zero runtime, zero RLS aplicada. Esta DECISION promulga soberanamente o **ownership** de `suppliers` ANTES de
qualquer migration/wiring. A materialização é frente própria futura (F-SUPPLIERS-OWNER-ACTOR-SCHEMA-WIRING), gated.

**Data:** 2026-06-16 · **Branch:** `rescue-structural` · **HEAD vivo:** `ebe410b4` · **dev:** 389/389 (sem migration)
· **Tipo:** arquitetural / ownership · **Frente:** F-SUPPLIERS-OWNERSHIP-SOVEREIGN-CARTORIO (cartório soberano) ·
**Responsável:** Clayton / IA Diretora (executor: Claude) · **Validação prévia:** Clayton + Evidence Pack suppliers.

**Deriva de / subordinada a:** `CONSTITUICAO_UNIFICARD` (Art. I — actor como unidade operacional) ·
`SSOT_REGISTRY_UNIFICARD` · `LEI_DE_COERENCIA_SISTEMICA` · **DECISION-0116** (classificou `suppliers`=COMPANY_INTERNAL
e EXPLICITAMENTE deferiu: "`created_by_actor_id`=autoria histórica, NÃO ownership; falta owner canônico — definir
antes do hardening; não gatear pelo creator") · **DECISION-0131** + **F-C1-MONEY-PO-OWNER-ACTOR-SCHEMA-WIRING**
(precedente `purchase_orders.owner_actor_id` — espelhado aqui) · **DECISION-0113** (autoridade por representabilidade).

---

## §1 — Contexto (Evidence Pack revalidado 1ª mão, dev 389, HEAD `ebe410b4`)

- A tabela `suppliers` **existe**; `row_count = 0` no preflight (revalidado vivo).
- Schema atual: `id, tenant_id, name, code, email, phone, contact_name, address, city, state, zip_code, country,
  tax_id, registration_number, status, created_by_actor_id, created_by_user_id, metadata, created_at, updated_at`.
- **NÃO** existe `owner_actor_id`, `company_id` nem `user_id` (owner material ausente — provado: 0 colunas owner-ish).
- `created_by_actor_id` é **autoria/auditoria histórica**, NÃO ownership; `created_by_user_id` idem.
- Readers são **tenant-only por shape** (escopam só por `tenant_id`).
- **RLS não é prova de autoridade** enquanto a aplicação conectar como `postgres`/superuser/`bypassrls`.
- DECISION-0116 já classificou `suppliers`=COMPANY_INTERNAL e **deferiu a definição do owner** para esta decisão.

## §2 — Decisão

- **Supplier é cadastro INSTITUCIONAL da empresa** (não do usuário que digitou, não do tenant inteiro).
- **Owner canônico = `owner_actor_id`.**
- `owner_actor_id` aponta para o **page-actor / company actor** (actor operacional, `actor_type='page' AND
  company_id IS NOT NULL` — §4.38) da **empresa dona do cadastro** do fornecedor.
- `tenant_id` = **escopo** (nunca autoridade).
- `created_by_actor_id` = **autoria/auditoria** (nunca ownership, nunca autoridade atual).
- `created_by_user_id` = **não é authority, não é ownership**.
- `supplier_id` (a própria PK / referências a ele) = **contraparte/referência, não owner**.

## §3 — Justificativa

- Um usuário pode ter 2, 3, 4 empresas → o fornecedor deve pertencer ao **contexto institucional da empresa**,
  não ao usuário que o digitou.
- **tenant-wide vazaria B2B** entre empresas distintas do mesmo tenant (especialmente no tenant compartilhado —
  DECISION-0115 D1).
- **creator-owned** congelaria a autoridade no autor histórico (quem digitou ≠ quem governa o cadastro hoje).
- Espelha o precedente **`purchase_orders.owner_actor_id`** (F-C1-MONEY-PO-OWNER-ACTOR-SCHEMA-WIRING): owner =
  actor operacional da empresa; created_by = autoria; tenant = escopo.
- **Evita dupla verdade** `company_id` + `owner_actor_id`: o vínculo com a empresa deriva de `owner_actor_id`
  (actor→company), não de uma segunda coluna concorrente.
- Alinha a **autoridade runtime futura** a `canRepresentActor(owner_actor_id)` (DECISION-0113), primitivo já vivo.

## §4 — Consequências

- A próxima frente autorizável será **F-SUPPLIERS-OWNER-ACTOR-SCHEMA-WIRING** (migration + runtime), gated por GO.
- Essa frente futura deve **revalidar `row_count` antes da migration**:
  - se `row_count = 0` → `NOT NULL` pode ser aceitável (sem backfill);
  - se `row_count > 0` → **STOP/backfill** exige prova determinística de owner por linha (nunca chute).
- `create/read/update/delete/list` de supplier devem usar **`owner_actor_id`** (não `created_by_*`, não tenant-only).
- **`canRepresentActor(owner_actor_id)`** será a authority **mínima** (server-side, app-level).
- `created_by_actor_id` permanece **audit**; `tenant_id` permanece **escopo**.
- **RLS não substitui** authority app-level server-side (ver DT-APP-DB-ROLE-BYPASSRLS-RLS-INERT).

## §5 — NÃO decidido (fora desta DECISION)

contacts genesis · CRM genesis · RLS hardening · DB app role hardening (remover `bypassrls`) · RBAC/FASE 6 ·
delegação/cargo-template · AP (accounts payable)/Bank/Core · suppliers runtime implementation · suppliers
migration · suppliers backfill.

## §6 — STOPs futuros (vinculantes para F-SUPPLIERS-OWNER-ACTOR-SCHEMA-WIRING)

- **NÃO** usar `created_by_actor_id` como owner.
- **NÃO** usar `created_by_user_id` como owner.
- **NÃO** usar `tenant_id` como authority.
- **NÃO** usar RLS como única defesa.
- **NÃO** adicionar `company_id` como segunda verdade sem decisão explícita.
- **NÃO** plugar suppliers em AP/PO sem owner resolvido.
- **NÃO** aplicar `canRepresentActor` sem `owner_actor_id` material.

## §7 — Estado

DECISION-0133 **PROMULGADA / NORMATIVA — HOLD PARA RESEAL**. `suppliers` é **company-owned via `owner_actor_id`**
(page/company actor da empresa dona); created_by=autoria, tenant=escopo, supplier_id=contraparte — nunca owner.
Authority runtime futura = `canRepresentActor(owner_actor_id)`. RLS não é prova de autoridade. **Sem código/
migration/schema/runtime nesta DECISION (docs-only).** Implementação = frente futura própria, gated.
