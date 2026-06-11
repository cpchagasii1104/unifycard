# MAPA DO DENOMINADOR — ISOLAMENTO INTRA-TENANT (tenant compartilhado)

> **READ-ONLY / NÃO-NORMA.** Este é um **artefato-mapa de cobertura**, não decisão soberana. As fontes soberanas são `DECISION-0116` (política de classes), `DECISION-0115 D1` (causa), `DECISION-0113` (mecanismo) e a DT-mãe `DT-SHARED-TENANT-RESOURCE-VISIBILITY-NO-OWNERSHIP-POLICY`. Reusar qualquer linha deste mapa **exige revalidar HEAD + fonte viva**; ausência de auditoria ≠ ausência de leak.
>
> **Carimbo:** HEAD `3d8ad25b` · branch `rescue-structural` · dev 365 · 2026-06-10.
> **Frente:** `F-G10-SHARED-TENANT-OWNERSHIP-VISIBILITY-GOVERNANCE`.

---

## Propósito e regra de honestidade

Mapeia o **denominador** de leituras que, no **tenant inicial compartilhado** (`DECISION-0115 D1`), devolvem recursos identificáveis por owner/actor/company/member usando **só `tenant_id`** como escopo. O denominador **finito** canônico é o conjunto de **métodos de leitura de repositório** com owner-col + read tenant-only (não a lista de rotas).

**🔴 PROIBIDO declarar "denominador global fechado"** enquanto houver módulo em `NÃO AUDITADO` ou `INCONCLUSIVO`. O `STATUS` por fatia só fecha o denominador **daquele cluster/arquivo** (como o Cluster 1 fez para unread-counts). O denominador **global do backend permanece OPEN**.

## Estados

- **AUDITADO** — varrido 1ª mão (handler+service+repository+schema); classe e veredito definidos.
- **PARCIAL** — parte das rotas/repos do módulo varrida; restante pendente.
- **NÃO AUDITADO** — módulo não varrido nesta frente.
- **INCONCLUSIVO** — varrido mas com fato bloqueante por confirmar (schema quebrado, flag de runtime, etc.).
- **FECHADO NO CLUSTER** — denominador **do cluster** fechado e selado (não implica denominador global).

## Classes (DECISION-0116)

`PUBLIC_TENANT` · `ACTOR_PRIVATE` · `COMPANY_INTERNAL` · `GROUP_MEMBERS` · `PERSONAL_SENSITIVE` · `INSTITUTIONAL_ADMIN` · `MONEY_PARTIES` · `DEFAULT_DENY`.

---

## Cobertura por módulo/recurso

### FECHADO NO CLUSTER

| Recurso | Estado | Classe (0116) | Nota / resíduo |
|---|---|---|---|
| unread-counts (Cluster 1: `GET /social/unread-counts`, `GET /feed/unread-counts`) | FECHADO NO CLUSTER | `groups`→GROUP_MEMBERS · `services`→PUBLIC_TENANT · `feed`/`events`→PUBLIC_TENANT | Selado no commit `3d8ad25b` (Yala PASS). **Resíduo aberto:** `DT-UNREAD-COUNTS-FEED-VISIBILITY-PHANTOM-COLUMN` (contador `feed`=0 por coluna fantasma `posts.visibility`). Não esconder o resíduo. |

### AUDITADO / PARCIAL (clusters 2–8)

| Recurso | Estado | Classe (0116) | Classe-leak | Bloqueia C1? | Correção |
|---|---|---|---|---|---|
| social impact/balance (`GET /social/impact/balance`) | AUDITADO | PUBLIC_TENANT (score agregado) | B | não | decisão de alcance (produto) |
| social impact/ledger (`GET /social/impact/ledger`) | AUDITADO | ACTOR_PRIVATE | C (já gateado canRepresentActor) | não | — |
| social reputation/permissions (`GET /social/reputation/permissions`) | AUDITADO | PUBLIC_TENANT (capability projetada) | B/G | não | DT leve (capability disclosure) |
| social ledger / ledger-summary | AUDITADO | ACTOR_PRIVATE | C (gateado) | não | — |
| dashboard (`GET /dashboard`) | AUDITADO | ACTOR_PRIVATE (self) | C (self + dead-gated por stub) | não | — |
| daily-metrics (`/dashboard/metrics/today|history`) | INCONCLUSIVO | INSTITUTIONAL_ADMIN | B/G | não | inativa/501 até autoridade institucional; **2 queries quebradas (42703, colunas fantasmas)** |
| groups/mine (`GET /groups/mine`) | AUDITADO | ACTOR_PRIVATE (self) | **A vivo canal-1** (type confusion) | **SIM** | code-only `req.user.userId` (próxima fatia; independe da 0116) |
| groups (list/:id/members/insights/dashboard) | AUDITADO | GROUP_MEMBERS / PUBLIC_TENANT (público) | maioria **D** (stub 403 hoje); `:id/dashboard` = A vivo | dashboard SIM; resto FASE 6 | member-scope no desenho da FASE 6; dashboard code-only |
| suppliers (`/marketplace/suppliers` list/:id) | AUDITADO | COMPANY_INTERNAL | **A latente** | SIM | escopo por owner (falta owner canônico — definir antes; `created_by_actor_id`=audit) |
| purchase-orders (list/:id/items) | AUDITADO | COMPANY_INTERNAL | **A comercial** (não-M) | parcial | escopo representabilidade (padrão reads 0113) |
| contacts (`/marketplace/contacts` *) | AUDITADO | PERSONAL_SENSITIVE/COMPANY_INTERNAL | **D** (schema ghost) | não | tabela ausente (`to_regclass`=NULL); não restaurar archive; materialização = migration + design |
| escrow (5 reads + write path) | AUDITADO | MONEY_PARTIES | **M-real** | não (0115 D5) | frente financeira própria (três paralelas; write-path prioritário) |
| inventory balance (tenant-wide, sem owner) | **FECHADO** (2026-06-11) | ACTOR_PRIVATE | **A → tombstone 501** | feito | `INVENTORY_TENANT_WIDE_BALANCE_DISABLED` (não chama service) — `DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE` CLOSED |
| inventory movements (sem actorId) | **FECHADO** (2026-06-11) | ACTOR_PRIVATE | **A → actorId obrigatório** | feito | 400 `INVENTORY_ACTOR_ID_REQUIRED` + canRepresentActor; gate `validate:inventory-reader-scope` — `DT-INVENTORY-MOVEMENTS-...` CLOSED |
| inventory balance/movements (by-actor / com actorId) | AUDITADO | ACTOR_PRIVATE | C (gateado canRepresentActor) | não | — |
| inventory consolidado empresa (`/inventory/company/:id/balance`) | **FECHADO** (2026-06-10) | COMPANY_INTERNAL | C (canViewConsolidatedInventory) | não | DECISION-0116 ADENDO A1 |
| **products/visible** (`/marketplace/products/visible`) | AUDITADO (HARD STOP) | ACTOR_PRIVATE/COMPANY_INTERNAL | **A LIVE (auth-only)** | SIM | estoque agregado tenant-wide retornado como availableQuantity — `DT-INVENTORY-PRODUCT-VISIBILITY-TENANT-WIDE-STOCK-PROJECTION` (OPEN; decisão merchant/oferta) |
| **reconciliation metrics** (`/admin/metrics/reconciliation/*`) | AUDITADO (HARD STOP) | INSTITUTIONAL_ADMIN | **A LIVE sub-gated + cross-tenant** | SIM | tenantId client-supplied/nullable — `DT-INVENTORY-RECONCILIATION-METRICS-INSTITUTIONAL-AUTHORITY-MISSING` (OPEN) |
| **reports/inventory\*** + transfers/sla | AUDITADO (HARD STOP) | ACTOR_PRIVATE/INSTITUTIONAL | **stub-dead FASE 6** | não (inerte) | reactivation-trap — `DT-RBAC-FAIL-CLOSED-STUB-FASE6-REACTIVATION-TRAP` (escopar antes de ligar RBAC) |
| marketplace search (`/marketplace/search`) | AUDITADO | PUBLIC_TENANT | B (catálogo público legítimo) | não | — |
| finance-agenda / cashflow | AUDITADO | COMPANY_INTERNAL / MONEY_PARTIES | **M-projeção** | não | frente própria de escopo de projeção (não Bank) |
| availability / unified-calendar | AUDITADO | ACTOR_PRIVATE | C (canRepresentActor / self) | não | — |

### NÃO AUDITADO (backend = OPEN)

Módulos **não varridos** nesta frente — **denominador global permanece OPEN** até sweep provar:

`rides` · `work` · `dispatch` · `inbox` (residual) · `opportunities` · `matching` · `referral` · `fund` · `reviews` · `votes` · `cultural` · `organization` · `reporting` (residual) · `my-orders` · `system-notifications` · demais módulos efetivamente não cobertos.

---

## Síntese

- **Bloqueante p/ liberar C1 (Classe-A vivo com caller):** ~~groups/mine~~ (CLOSED), suppliers, ~~inventory(movements/balance sem actorId)~~ (**CLOSED 2026-06-11** — tombstone 501 + actorId obrigatório), groups/:id/dashboard, **products/visible** (NOVO — LIVE auth-only), **reconciliation metrics** (NOVO — LIVE sub-gated). (Latentes por dado=0 hoje; vivos por shape.)
- **inventory = PARCIAL:** 2 folhas fechadas (balance tenant-wide / movements sem actorId), mas o **galho inventory NÃO está fechado** — products/visible + reconciliation metrics (LIVE) e reports/* (stub-dead FASE 6) seguem OPEN. Inventory **NÃO** é FECHADO-NO-CLUSTER; **NÃO** sai do denominador Classe A. Gate `validate:inventory-reader-scope` mantém o inventário honesto (KNOWN_OPEN explícito).
- **Diferível:** M (escrow/finance-agenda — frente money), contacts (schema ghost), rotas groups atrás do stub (FASE 6), daily-metrics (admin-gate/tombstone), reports/inventory* (FASE 6 reactivation-trap).
- **Denominador global do backend = OPEN.** C1/tenant compartilhado seguem BLOQUEADOS.
- **Próxima fatia de código:** `GET /groups/mine` (independe da 0116; puro `DECISION-0113`).
- **Convergência:** denominador finito por repositório + classificação 0116 + correção Classe-A + gate de regressão + Yala reseal → só então C1 liberável no eixo de isolamento.
