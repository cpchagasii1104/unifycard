# 2026-06-16 — F-SUPPLIERS-OWNERSHIP-SOVEREIGN-CARTORIO

Cartório soberano leve (**docs-only**) que promulga o **ownership de `suppliers`** ANTES de qualquer migration/runtime.
Parent `ebe410b4` · branch `rescue-structural` · dev **389 (ZERO migration)**. Não é implementação, migration, patch
runtime, RLS hardening, nem ativação de RBAC/FASE 6.

## Declaração antes de editar

- **Domínio:** ownership de `suppliers` (decisão arquitetural, marketplace).
- **Docs lidos:** `REMEDIATION_DECISIONS_LOG.md` (numeração — 0133 livre; formato), `DECISION-0116` (classificou
  `suppliers`=COMPANY_INTERNAL e **deferiu** o owner: "created_by≠ownership; definir antes do hardening"), precedente
  `F-C1-MONEY-PO-OWNER-ACTOR-SCHEMA-WIRING`/`DECISION-0131` (`purchase_orders.owner_actor_id`), `DECISION-0113`
  (canRepresentActor), schema vivo de `suppliers` (Evidence Pack revalidado), `REMEDIATION_DT_LOG.md`
  (sem decisão suppliers-owner prévia; sem DT RLS-inert), contacts containment CLOSED.
- **Suficiente porque:** a pergunta de ownership é precisamente escopada (qual coluna é owner); o precedente PO dá o
  padrão canônico; a 0116 já classificou e deferiu exatamente esta definição. Nenhum conhecimento de runtime além do
  shape vivo confirmado é necessário para uma promulgação docs-only.
- **SSOT afetado:** nenhum materialmente (sem mudança de schema). A DECISION **passa a ser** a SSOT normativa de
  "suppliers owner = `owner_actor_id`".
- **NÃO é SSOT:** não é a implementação; schema/runtime de suppliers inalterados.
- **DECISION nova (0133)** — ownership de primeira classe (não mero adendo), ancorada à 0116.
- **Docs-only suficiente porque:** ownership é decisão normativa que deve **preceder** migration/runtime (o objetivo
  da frente). Promulgar uma decisão não exige código.

## Pré-flight

HEAD `ebe410b4` · branch `rescue-structural` · dev 389. Suppliers runtime/migrations/archive **limpos** (sujeira =
memorias/notas pessoais, nada supplier/migration/Bank/contacts/RLS/RBAC). **Evidence Pack revalidado 1ª mão:**
`suppliers` existe; `row_count=0`; colunas = `id, tenant_id, name, code, …, created_by_actor_id, created_by_user_id,
metadata, created_at, updated_at`; **0** colunas owner-ish (`owner_actor_id`/`company_id`/`user_id` ausentes).
Numeração: 0132 ocupada (temporal-purpose) → **0133 livre**. Sem decisão suppliers-owner prévia (0116 só deferiu).

## Decisão promulgada (DECISION-0133 — resumo)

- Supplier = cadastro **institucional da empresa**. **Owner canônico = `owner_actor_id`** (page/company actor da
  empresa dona). `tenant_id`=escopo · `created_by_actor_id`=autoria/auditoria · `created_by_user_id`=não-authority ·
  `supplier_id`=contraparte/referência. **Não é** tenant-wide / creator-owned / user-owned / supplier_id-owned /
  RBAC genérico / RLS-only.
- **Justificativa:** usuário pode ter N empresas; fornecedor pertence ao contexto institucional, não ao digitador;
  tenant-wide vaza B2B; creator-owned congela autoridade; espelha PO owner_actor_id; evita dupla verdade
  `company_id`+`owner_actor_id`; alinha authority futura a `canRepresentActor(owner_actor_id)`.
- **Consequências:** próxima frente = **F-SUPPLIERS-OWNER-ACTOR-SCHEMA-WIRING** (revalidar row_count: 0→NOT NULL ok;
  >0→STOP/backfill determinístico; CRUD/list por owner_actor_id; canRepresentActor mínima; created_by=audit;
  tenant=escopo; RLS não substitui app-level).
- **Não decidido:** contacts/CRM genesis · RLS hardening · DB app role (bypassrls) · RBAC/FASE 6 · delegação/cargo ·
  AP/Bank/Core · suppliers runtime/migration/backfill.

## Escopo negativo (confirmado)

ZERO código (.ts) · ZERO frontend · ZERO migration · ZERO SQL/schema · ZERO backend runtime · ZERO
`supplier.{repository,service,routes}.ts` · ZERO `owner_actor_id`/`company_id` adicionados · ZERO accounts payable ·
ZERO purchase_orders · ZERO contacts (genesis nem fechamento) · ZERO Bank/Core/ledger/payout/split/recovery · ZERO RLS
aplicada · ZERO RBAC/FASE 6 · ZERO cargo/delegação/actor_delegations/company_users · ZERO afirmação de que suppliers
está implementado ou de que leak foi corrigido em runtime.

## Provas

| Prova | Resultado |
| --- | --- |
| git diff | **apenas docs/logs** (DECISION-0133, DECISIONS_LOG, DT_LOG, STATUS, execution log; opus gitignored) |
| arquivos .ts / frontend / migration / SQL alterados | **ZERO** |
| validate-architectural-patterns --strict | exit 0 · critical_new=0 |
| validate:regression-guards | rc=0 |

## DT registradas

- **DT-SUPPLIERS-OWNER-ACTOR-WIRING** — ownership DECIDIDO (DECISION-0133); **implementation OPEN** (frente futura).
  Leak Classe-A de suppliers **NÃO corrigido em runtime** (só o ownership foi decidido).
- **DT-APP-DB-ROLE-BYPASSRLS-RLS-INERT** (transversal, nova) — enquanto a app conectar como postgres/superuser/
  bypassrls, RLS não é defesa de runtime nem prova de autoridade; authority app-level server-side obrigatória.

## Próximos passos

1. **F-SUPPLIERS-OWNER-ACTOR-SCHEMA-WIRING** (futura, gated): migration `owner_actor_id` (revalidar row_count) + CRUD
   gateado por `canRepresentActor(owner_actor_id)` + guard/neg-proof/e2e (espelhar PO owner).
2. **DB app role hardening** (futura): role sem `bypassrls` antes de citar RLS como defesa.
3. contacts genesis segue futura/OPEN (fora desta frente).

## Estado

**IMPLEMENTED / HOLD PARA RESEAL.** Fecha SÓ como **F-SUPPLIERS-OWNERSHIP-SOVEREIGN-CARTORIO**: o ownership de
`suppliers` foi **promulgado soberanamente** (DECISION-0133 — company-owned via `owner_actor_id`) ANTES de qualquer
migration/runtime; a **implementation segue OPEN**; contacts genesis ficou fora; RLS apenas como DT/alerta. Zero
código/migration/schema. dev 389.
