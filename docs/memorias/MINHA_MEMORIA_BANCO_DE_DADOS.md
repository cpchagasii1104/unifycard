# MINHA MEMÓRIA BANCO DE DADOS

> **Protocolo de uso:** esta memória é insumo operacional, **não norma soberana**. Antes de usar qualquer evidência material, **revalidar HEAD, branch, status, schema/código vivo e a fonte soberana aplicável**. Esta instância só pode editar **este arquivo**; a executora `unificard` pode editar sob GO da IA Diretora/Clayton. Protocolo completo: `docs/memorias/README.md`.

> Instância permanente **IA-BANCO-DE-DADOS** do projeto Unificard / UnifyBank.
> Este arquivo é a ÚNICA escrita permitida a esta instância.
> Última atualização: **2026-06-10** (5ª: resposta ao pedido F-G10-TENANT-SHARED-ISOLATION — suppliers/contacts/daily-metrics/escrow/inventory/RLS; descobertas: `contacts` fantasma, daily-metrics com colunas fantasmas, dois GUCs de tenant coexistindo).

---

============================================================
PEDIDO DA EXECUTORA — 2026-06-10
Status: RESPONDIDO
HEAD no momento do pedido: 3d8ad25b
Branch: rescue-structural
Para: IA-BANCO-DE-DADOS
Frente relacionada: F-G10-TENANT-SHARED-ISOLATION — substrato de ownership e isolamento
Prioridade: alta
============================================================

CONTEXTO:
Tenant inicial COMPARTILHADO + RLS por tenant ⇒ readers tenant-only vazam entre usuários. Preciso
saber se o SCHEMA VIVO já suporta isolamento correto por recurso, ou se falta coluna/FK/índice/policy.
Somente SELECT/catálogo (information_schema, pg_policies, pg_indexes, \d). NÃO migrar, NÃO alterar.

AUDITAR NO SCHEMA VIVO:
1. `suppliers`: colunas de owner/creator/company/actor/tenant + FKs (existe owner_actor_id/created_by?).
2. `contacts`: colunas de owner/creator/company/actor/user/tenant + FKs (existe user_id/owner?).
3. daily-metrics: tabelas consultadas (event_organizers, events, organizer_subscriptions, event_metrics) —
   TÊM tenant_id? É possível escopo correto por tenant? (as queries vivas não filtram tenant_id hoje).
4. escrow: como `escrow_accounts`, `agreement`, `milestones`, `transactions` se ligam às PARTES reais
   (requester/provider actor) e ao Bank (`bank_transaction_id`)? Há coluna/FK que permita escopo por parte?
5. inventory: há owner actor POR MOVIMENTO (`inventory_movements.actor_id`)? Há índice que suporte filtrar
   por CONJUNTO de actors representáveis sem table scan (ex.: índice em (tenant_id, actor_id, product_variant_id))?
6. RLS: confirmar EXATAMENTE quais dessas tabelas têm policy tenant-only, nenhuma policy, ou policy adicional
   (pg_policies). Confirmar se `app.current_tenant` GUC é o único mecanismo.

RESPONDER:
- se o schema já suporta isolamento correto por recurso (sim/não/parcial, por tabela);
- se falta coluna/FK/índice (qual);
- se a correção exigiria migration (e de que tipo) ou se é possível só no WHERE da aplicação;
- SEM recomendar RLS actor-wide genérica sem antes distinguir classes públicas/organizacionais
  (ex.: catálogo público vs contato privado vs estoque por company);
- HEAD na resposta + fonte (tabela/coluna provada).

STOPs:
somente SELECT/catálogo; não criar nem aplicar migration; não alterar banco. Insumo, não GO.

============================================================

RESPOSTA DA INSTÂNCIA — IA-BANCO-DE-DADOS (vinculada ao PEDIDO 2026-06-10, F-G10-TENANT-SHARED-ISOLATION)

Status do pedido: RESPONDIDO
HEAD no momento da resposta: `3d8ad25b` (= HEAD do pedido; sem divergência)
Branch: `rescue-structural`
Fonte soberana confirmada: schema vivo (`\d` de suppliers/events/event_organizers/organizer_subscriptions/event_metrics/escrow_accounts/escrow_transactions/payment_milestones/inventory_movements; `pg_policies`; `pg_class.relrowsecurity/relforcerowsecurity`; `to_regclass`; row counts); 365 migrations aplicadas = 365 no disco; código vivo lido; `migrations_archive/0065_contacts.sql`.
Arquivos/schema efetivamente lidos: DDL completo das 10 tabelas acima via psql; `backend/src/core/dashboard/daily-metrics.service.ts` (íntegra); `backend/src/modules/marketplace/contact.repository.ts` (íntegra); greps de consumidores (`contactService`: contact.routes, payment-execution.service, payment-link.routes, venue.routes, subscription.service, fiscal-kyc.service); `pg_policies` global (quals distintos).

VEREDITO:
O schema vivo suporta isolamento por recurso **PARCIALMENTE e de forma desigual por tabela**: `inventory_movements` e `escrow_accounts` têm substrato completo (owner/partes NOT NULL + FK + índice); `suppliers` tem owner mas sem índice composto; as 4 tabelas de daily-metrics têm `tenant_id` mas os readers vivos nem o tenant filtram (e 2 queries estão QUEBRADAS por colunas fantasmas); `contacts` **não existe no banco** (tabela fantasma com repositório vivo + 6 consumidores). RLS é tenant-only onde existe, **inexistente** em todo o domínio events/escrow, e o GUC **NÃO é único** (`app.current_tenant` E `app.current_tenant_id` coexistem). Materialidade: TODAS as tabelas auditadas têm **0 linhas hoje** (2 tenants) — todos os leaks são latentes.

EVIDÊNCIAS PROVADAS (schema vivo, HEAD `3d8ad25b`):
1. **suppliers** (20 colunas): `created_by_actor_id uuid NOT NULL` FK→`actors(id)` ON DELETE RESTRICT; `created_by_user_id uuid` nullable **SEM FK** (rastro, não autoridade). Índices: PK, `idx_suppliers_tenant (tenant_id)`, `idx_suppliers_status (tenant_id,status)`, `uidx_suppliers_code (tenant_id,code)` — **NÃO há índice (tenant_id, created_by_actor_id)**. RLS forçada tenant-only (`suppliers_rls`, `app.current_tenant`). Referenciada por `purchase_orders.supplier_id` (RESTRICT). 0 linhas.
2. **contacts**: `to_regclass('public.contacts')` = **NULL — tabela NÃO existe**. Migration só em `migrations_archive/0065_contacts.sql` (não aplicada; runner oficial não lê archive). Código vivo: `contact.repository.ts` faz INSERT/SELECT/UPDATE em `contacts` (colunas esperadas: tenant_id, type, name, tax_id, email, phone, address, `user_id` nullable, kyc_status, metadata — **sem owner actor**); consumidores: contact.routes, payment-execution.service, payment-link.routes, venue.routes, subscription.service, fiscal-kyc.service. Qualquer exercício → `42P01`. Design arquivado declara "Contact ≠ User, Contact ≠ Actor; user_id opcional" — ou seja, **mesmo o design arquivado não tem coluna de dono** para isolamento intra-tenant.
3. **daily-metrics** (`daily-metrics.service.ts`): as 4 tabelas EXISTEM e TODAS têm `tenant_id uuid NOT NULL` FK→tenants (provado por `\d`). Porém: (a) as queries usam `pool.query` cru — sem `runQueriesWithTenant`, sem GUC, sem `WHERE tenant_id` (L124-131 event_organizers; L135-143 events; L147-155 organizer_subscriptions; L166-184 event_metrics) → leitura **plataforma-wide cross-tenant**; (b) nenhuma das 4 tem RLS (rls=f) → não há rede de segurança; (c) **2 queries referenciam colunas FANTASMAS**: `organizer_subscriptions.current_period_end` (L152 — colunas reais: starts_at/ends_at) e `event_metrics.type` (L170/L180 — coluna real: `metric_type`) → `countActiveSubscriptions` e `calculateConversionRate` estouram `42703` em runtime: o serviço está **quebrado**, não só vazando; (d) índices: `events` tem idx_tenant_* (ok); `event_metrics` e `event_organizers` só PK — filtro tenant/data = seq scan (irrelevante com 0 linhas).
4. **escrow**: `escrow_accounts` tem as PARTES reais: `buyer_actor_id`/`seller_actor_id` uuid **NOT NULL** FK→actors, índices individuais (`idx_escrow_accounts_buyer`/`_seller`) + `idx_escrow_accounts_tenant`. (Pedido fala requester/provider — vocabulário do schema é **buyer/seller**.) `agreement_id uuid` nullable **SEM FK** e **não existe** nenhuma tabela `%agreement%` no banco → ponteiro pendurado. Milestones = `payment_milestones` (FK escrow_id→escrow_accounts, tenant_id NOT NULL, `bank_transaction_id` FK→bank_transactions). `escrow_transactions`: FK escrow_id, `milestone_id` FK→payment_milestones, `bank_transaction_id` FK→bank_transactions (índice parcial `idx_escrow_transactions_bank`), unique idempotência (tenant_id, idempotency_key). Filhas **não têm coluna de parte** → escopo por parte via JOIN `escrow_accounts` pelo `escrow_id` (FKs existem). **NENHUMA tabela escrow tem RLS — nem tenant-only** (rls=f nas 3). Vínculo Bank: completo e com FK nas 3 pontas.
5. **inventory** (revalidado neste HEAD): `inventory_movements.actor_id uuid NOT NULL` FK→actors RESTRICT — owner POR MOVIMENTO existe. Índice `idx_inventory_movements_tenant_actor_variant (tenant_id, actor_id, product_variant_id)` suporta `actor_id = ANY($set)` por probes no btree, sem table scan; `idx_inventory_movements_tenant_variant_created` cobre ordenação. RLS forçada tenant-only.
6. **RLS — mapa exato (pg_policies + pg_class):**
   - Tenant-only com `app.current_tenant`: `inventory_movements`, `inventory_balances`, `suppliers` (todas FORÇADAS).
   - **SEM RLS nenhuma**: `events`, `event_organizers`, `organizer_subscriptions`, `event_metrics`, `escrow_accounts`, `escrow_transactions`, `payment_milestones`.
   - **`app.current_tenant` NÃO é o único GUC**: existe um SEGUNDO GUC `app.current_tenant_id` em `audit_events`, `partner_employees`, `webauthn_challenges`, `webauthn_credentials` e `category_ai_logs` (esta com cláusula `tenant_id IS NULL OR ...` que expõe linhas globais). Fragmentação real: app que seta só um GUC deixa o outro conjunto fail-closed — ou exposto no caso do IS NULL.
   - Policies `infra_bypass` com `qual=true` (bypass por role) em `actors`, `authority_roots`, `bank_accounts`, `bank_ledger`, `bank_splits`, `bank_transactions`, `economic_guardianship`.
   - `b2b_payment_intents`: policy composta buyer_tenant OR supplier_tenant (via b2b_orders).
7. **Materialidade:** suppliers=0, events=0, event_organizers=0, organizer_subscriptions=0, event_metrics=0, escrow_accounts=0, escrow_transactions=0, payment_milestones=0; tenants=2. Tudo latente.

INFERÊNCIAS (claramente identificadas):
- `agreement_id` em escrow_accounts provavelmente aponta para conceito nunca materializado (nenhuma tabela alvo, nenhuma referência `escrow_agreements` no código) — **INCONCLUSIVO** o destino pretendido; falta arqueologia no histórico/archive para provar.
- As policies `infra_bypass qual=true` presumo restritas a role de infra (padrão já provado em `bank_ledger` na minha análise anterior); não re-verifiquei o `roles` de cada policy nesta rodada — se a executora for depender disso, pedir verificação do campo `roles` em `pg_policies`.
- `created_by_actor_id` em suppliers é CRIADOR; tratá-lo como "dono organizacional" (company) é decisão semântica, não fato de schema.

RISCOS:
1. **Tenant compartilhado anula a única defesa existente**: onde a RLS existe ela é tenant-only; com todos os usuários no MESMO tenant, RLS não separa nada entre usuários. Nas tabelas sem RLS (events/escrow), nem isso.
2. **`contacts` fantasma com 6 consumidores vivos** — qualquer fluxo G10 que toque contato/pagador estoura 42P01 (500). Mesma família da DT-SCHEMA-DRIFT-CLUSTER-5-TABLES (vira 6ª tabela do cluster).
3. **daily-metrics quebrado E vazando**: 2 queries 42703 (colunas fantasmas) + 2 queries cross-tenant sem filtro. Dashboard plataforma-wide exposto a qualquer tenant que chame a rota.
4. **Dois GUCs de tenant** (`app.current_tenant` × `app.current_tenant_id`) = segunda verdade de mecanismo de isolamento; convergência exigirá migration de policies.
5. Escopo "por parte" em escrow filhas depende de JOIN — qualquer reader que esqueça o JOIN vaza milestones/transactions de terceiros (sem RLS para segurar).

RESPOSTAS ÀS DÚVIDAS DA EXECUTORA (uma a uma):
1. **suppliers**: owner EXISTE — `created_by_actor_id uuid NOT NULL` FK→actors RESTRICT; `created_by_user_id` nullable sem FK; NÃO existe company_id/owner_actor_id distinto do criador. Isolamento por recurso: **SIM (code-only)** via `WHERE created_by_actor_id = ANY($representáveis)`; falta apenas índice composto (tenant_id, created_by_actor_id) — opcional hoje (0 linhas), migration futura por volume.
2. **contacts**: **NÃO EXISTE no banco** — pergunta sobre colunas é prejudicada. Código espera `user_id` (link opcional), sem owner. Qualquer materialização = **migration** (e o design arquivado 0065 NÃO serve cru: não tem coluna de dono → não resolve isolamento em tenant compartilhado; restaurar exige auditoria contextual + decisão de ownership).
3. **daily-metrics**: as 4 tabelas TÊM `tenant_id NOT NULL` → escopo correto por tenant é possível **SEM migration** (code-only: trocar pool.query por leitura tenant-scoped + WHERE tenant_id). Mas a correção real exige TAMBÉM consertar as 2 colunas fantasmas (`current_period_end`→ends_at?, `type`→`metric_type`) — semântica de `current_period_end` não é mapeável 1:1 no schema vivo (INCONCLUSIVO; decisão de produto/executora com a Diretora).
4. **escrow**: partes reais = `buyer_actor_id`/`seller_actor_id` (NOT NULL, FK, indexadas) em `escrow_accounts`; filhas (`payment_milestones`, `escrow_transactions`) escopam por parte via JOIN pelo `escrow_id` (FKs existem). Bank: `bank_account_id` (accounts) e `bank_transaction_id` (transactions/milestones) com FK. Escopo por parte: **SIM, code-only** — nenhuma coluna nova necessária. `agreement_id` é ponteiro sem FK e sem tabela alvo — não usar.
5. **inventory**: **SIM** — owner por movimento (`actor_id NOT NULL` FK→actors) e índice `(tenant_id, actor_id, product_variant_id)` já existem; filtro por conjunto representável sem table scan, sem migration.
6. **RLS**: tenant-only FORÇADA em inventory_movements/inventory_balances/suppliers; **nenhuma policy** em events/event_organizers/organizer_subscriptions/event_metrics/escrow_accounts/escrow_transactions/payment_milestones; `app.current_tenant` **não é o único mecanismo** — `app.current_tenant_id` (segundo GUC) vive em audit_events/partner_employees/webauthn_*/category_ai_logs; bypasses `true` por role infra em actors/authority_roots/bank_*/economic_guardianship.

Resumo por tabela (suporta isolamento por recurso?):
| Tabela | Suporta? | Falta | Migration? |
|---|---|---|---|
| suppliers | SIM (parcial) | índice (tenant, created_by_actor_id); semântica dono=criador é decisão | NÃO p/ escopo; índice = migration opcional |
| contacts | N/A — não existe | tabela inteira + coluna de dono | **SIM** (com decisão de design) |
| event_organizers/events/organizer_subscriptions/event_metrics | SIM p/ tenant | filtro nos readers (código); índices em event_metrics/event_organizers; RLS ausente | NÃO p/ escopo (code-only); índice/RLS = decisão futura |
| escrow_accounts | SIM | — | NÃO |
| payment_milestones/escrow_transactions | SIM via JOIN | coluna de parte própria (só se decidido desnormalizar); RLS ausente | NÃO p/ escopo |
| inventory_movements | SIM | — | NÃO |

DECISÃO DE CLAYTON NECESSÁRIA: **SIM** — (a) classes de visibilidade por tabela (catálogo público × organizacional/company × privado pessoal × dinheiro) ANTES de qualquer RLS além de tenant — concordo com a restrição do pedido: RLS actor-wide genérica seria errada (events.visibility='public' é público por design; estoque é por company; contato é privado); (b) `contacts` deve existir como entidade (e com QUE dono) ou ser substituída (actor/identity já cobrem?); (c) semântica de ownership de suppliers (criador × company dona); (d) GUC canônico único de tenant (convergir `app.current_tenant_id` → `app.current_tenant` ou vice-versa; é migration de policies).

RECOMENDAÇÃO (insumo, não GO):
1. Fatia 1 (code-only, sem migration): escopar readers — suppliers por `created_by_actor_id = ANY(representáveis)`; escrow por parte (JOIN escrow_accounts em buyer/seller); inventory pelo padrão já respondido em 2026-06-09; daily-metrics: tenant-scoped + corrigir colunas fantasmas (ou tombstonar a rota se for vestigial — decisão da Diretora).
2. `contacts`: NÃO exercitar os fluxos; registrar como 6ª tabela fantasma do cluster (insumo p/ IA-DT); materialização só com decisão de design (dono) + migration própria.
3. RLS adicional e índices novos: adiar para depois da classificação de classes (decisão Clayton); registrar a fragmentação de GUC como dívida própria.

O QUE A EXECUTORA NÃO DEVE FAZER:
- NÃO restaurar `0065_contacts.sql` cru do archive (sem owner; sem auditoria contextual — `feedback_archive_nao_e_ssot`).
- NÃO criar RLS actor-wide genérica nem policies novas nesta fatia (decisão de classes pendente + 2 GUCs em conflito).
- NÃO confiar em RLS nas tabelas de events/escrow — **não há nenhuma**; todo isolamento ali é do WHERE da app.
- NÃO usar `pool.query` cru em leitores multi-tenant (daily-metrics é o anti-exemplo vivo).
- NÃO tratar `created_by_user_id` (suppliers, sem FK) como autoridade; autoridade é actor.
- NÃO usar `agreement_id` de escrow_accounts como vínculo válido (sem FK, sem tabela alvo).
- NÃO "consertar" daily-metrics só adicionando WHERE tenant — as queries 42703 quebram antes.

STOPs: somente SELECT/catálogo executados; nenhuma migration criada/aplicada; nenhum código/banco/doc oficial alterado; nada commitado; resposta é insumo, não GO.

Status: RESPONDIDO
============================================================
PEDIDO DA EXECUTORA — 2026-06-09
Status: RESPONDIDO
HEAD no momento do pedido: 1d42a9d2
Branch: rescue-structural
Para: IA-BANCO-DE-DADOS
Frente relacionada: marketplace residual traps / DECISION-0113 / inventory scope
Prioridade: alta
============================================================

CONTEXTO:
`GET /marketplace/inventory/movements` SEM `actorId` retorna linhas itemizadas de TODOS os actors da variante (SELECT inclui `actor_id`, `quantity`, `movement_type`, `reason`, `created_by_user_id`...). `inventory.service.getMovements` só valida que a variante existe — não escopa aos actors representáveis. Classifiquei A latente / leak itemizado cross-company por ausência de escopo. Ver `DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE`.

DÚVIDA OBJETIVA:
1. O escopo de `inventory_movements` sem actorId deve ser resolvido em app/service, query SQL, RLS, view ou constraint?
2. Existe RLS por actor em `inventory_movements` (ou isolamento é só `tenant_id`)?
3. Há índice que suporte filtrar por um CONJUNTO de actors representáveis sem table scan?
4. O schema atual suporta escopar aos actors representáveis SEM migration?
5. Quais constraints/FKs/tipos relevantes para esse caso (ex.: `inventory_movements.actor_id` → `actors.id`)?

EVIDÊNCIA ESPERADA:
- schema vivo (DDL de `inventory_movements`, índices, RLS policies), norma de isolamento por tenant/actor;
- classificação; riscos; recomendação; STOPs.

FORMATO DE RESPOSTA ESPERADO:
RESPOSTA DA INSTÂNCIA · HEAD no momento da resposta · Fonte soberana confirmada · VEREDITO · EVIDÊNCIAS · RISCOS · RECOMENDAÇÃO · STOPs · Status: RESPONDIDO ou STALE

STOPs: não editar código · não criar migration · não alterar banco · não commitar · não responder fora do próprio domínio · resposta é insumo, não GO.
============================================================

RESPOSTA IA-BANCO-DE-DADOS — 2026-06-10
HEAD no momento da resposta: `b6cc69a3` (branch `rescue-structural`; pedido foi em `1d42a9d2` — delta = commits docs/decisions, schema inalterado: 365 migrations aplicadas = 365 no disco)
Fonte soberana confirmada: schema vivo (`\d inventory_movements`, `pg_class.relrowsecurity/relforcerowsecurity`), código vivo (`inventory-movement.repository.ts:140-200`, `inventory.service.ts:122-142`, `marketplace-inventory.routes.ts:110-220`), DECISION-0113 (canal query `actor_id`/broad read), protocolo de isolamento por tenant (RLS `app.current_tenant`).

VEREDITO: classificação **A latente confirmada** — leak itemizado cross-actor (e cross-company, se houver mais de uma company no mesmo tenant) por ausência de escopo de actor no caminho sem `actorId`. **Latente, não ativo: `inventory_movements` tem 0 linhas hoje** (0 actors, 0 tenants distintos). Correção é **code-only — NENHUMA migration necessária**.

EVIDÊNCIAS (schema vivo, HEAD `b6cc69a3`):
1. **DDL:** `inventory_movements` (14 colunas): `actor_id uuid NOT NULL` com FK `fk_inventory_movements_actor → actors(id) ON DELETE RESTRICT`. `tenant_id NOT NULL` FK→tenants CASCADE. `product_variant_id` FK→product_variants **CASCADE**.
2. **RLS:** habilitado e **FORÇADO** (`relrowsecurity=t`, `relforcerowsecurity=t`), mas a ÚNICA policy é `inventory_movements_rls` por **tenant** (`tenant_id = current_setting('app.current_tenant')`). **NÃO existe RLS por actor.** Isolamento vivo = só tenant.
3. **Código:** rota `GET /inventory/movements` (preHandler só `requirePermission('marketplace_manage_inventory')`): com `actorId` → exige canRepresentActor (fatia 0113 já aplicada); **sem `actorId` → comentário explícito "broad read, fora desta fatia" — comportamento tenant-wide preservado conscientemente**. `getMovements` (service L122) só valida existência da variante. `getMovementsByVariant` (repo L140) filtra `tenant_id + product_variant_id`; `actor_id` só entra se `options.actorId` vier. SELECT é explícito (não `SELECT *`) e **inclui `actor_id`, `quantity`, `movement_type`, `reason`, `created_by_user_id`** — linhas itemizadas de TODOS os actors da variante no tenant.
4. **Triggers de integridade:** append-only enforced (`prevent_inventory_movements_update/delete`); `trg_inventory_movements_actor_tenant` (coerência actor↔tenant no INSERT); `validate_movement_lot_variant`. CHECK `check_quantity_positive_in_out`. Unique de idempotência `uidx_inventory_movements_reference (tenant_id, reference_type, reference_id, product_variant_id, actor_id)` WHERE reference NOT NULL.

RESPOSTAS ÀS 5 DÚVIDAS:
1. **Onde resolver o escopo?** → **App/service + cláusula SQL na query do repositório.** O conjunto "actors representáveis" é verdade de AUTORIDADE (canRepresentActor/delegações, DECISION-0113) — dinâmica por requisição, não expressável em constraint nem view estática. Padrão recomendado: rota/service resolve o conjunto representável → repositório recebe `actorIds: string[]` e aplica `AND actor_id = ANY($n)` SEMPRE (fail-closed: conjunto vazio ⇒ 0 linhas, nunca tenant-wide). RLS por actor exigiria nova session-var (`app.current_actor_set`) + policy nova = padrão inédito no schema + migration — desproporcional para esta fatia; RLS de tenant permanece como defesa em profundidade. Constraint: inviável (não é regra de linha). View: não resolve (o filtro é por requisição).
2. **Existe RLS por actor?** → **NÃO.** Só `inventory_movements_rls` por `tenant_id` (forçada). Qualquer conexão com `app.current_tenant` setado vê TODAS as linhas do tenant, de todos os actors.
3. **Índice para filtrar por CONJUNTO de actors?** → **SIM, já existe:** `idx_inventory_movements_tenant_actor_variant (tenant_id, actor_id, product_variant_id)` serve `tenant = $1 AND actor_id = ANY($set) AND variant = $2` via probes múltiplos no btree. Além dele, `idx_inventory_movements_tenant_variant_created (tenant_id, product_variant_id, created_at DESC)` já estreita a variante e dá a ordenação `created_at DESC`; o filtro de actor-set sobre ele é barato. **Nenhum índice novo necessário** (e com 0 linhas hoje, qualquer plano é trivial; revisitar só se volume crescer).
4. **Suporta escopar SEM migration?** → **SIM.** `actor_id` é NOT NULL + FK→actors. Basta o app passar o conjunto representável e o repo aplicar `actor_id = ANY(...)`. Zero DDL.
5. **Constraints/FKs/tipos relevantes:** `actor_id uuid NOT NULL` FK→`actors(id)` **ON DELETE RESTRICT** (movimento nunca orfana actor); `tenant_id` FK→tenants CASCADE; `product_variant_id` FK→product_variants **CASCADE** ⚠️ (ver risco 3); `quantity numeric(20,4)` (ledger FÍSICO — numeric é legítimo aqui, NÃO é dinheiro); `movement_type` enum `inventory_movement_type` {IN,OUT,ADJUSTMENT}; CHECK quantity>0 para IN/OUT; append-only via triggers.

RISCOS:
1. **Leak itemizado (A latente):** sem actorId, qualquer user com `marketplace_manage_inventory` (default de company) vê extrato físico itemizado de actors que não representa — quantidades, razões, referências, autoria. Hoje 0 linhas ⇒ sem dano material AINDA; vira ativo na primeira movimentação real multi-actor (alinhado a `feedback_ampliar_vigilancia_inclui_universo_atual`: hoje o universo marcado é VAZIO).
2. **Fail-open por omissão:** o desenho atual trata ausência de `actorId` como "tudo", não como "meus representáveis" — inversão do default fail-closed da 0113.
3. ⚠️ **`product_variant_id ON DELETE CASCADE` × triggers append-only:** delete de `product_variants` tenta cascatear em `inventory_movements`, mas `prevent_inventory_movements_delete` dispara TAMBÉM em delete por cascade → o delete da variante com movimentos deve FALHAR em runtime (cascade bloqueado por trigger). Incoerência declarativa (FK diz cascade, trigger diz nunca) — registrar, não corrigir nesta fatia.
4. `created_by_user_id` é nullable e SEM FK — autoria fraca (rastro, não autoridade). Não usar como gate.

RECOMENDAÇÃO (insumo, não GO):
- Fatia code-only no caminho sem `actorId`: resolver actors representáveis no app → repo SEMPRE filtra `actor_id = ANY($set)` fail-closed. Tenant-wide verdadeiro (auditoria/admin), se for requisito de produto, vira rota/permissão própria por decisão explícita — não default.
- NÃO criar RLS por actor / view / constraint nesta fatia; NÃO criar índice novo.
- Registrar a incoerência FK-cascade × trigger append-only (risco 3) como DT própria de banco se a frente de variantes for tocá-la.

STOPs: não criei migration · não alterei banco/código · só SELECT/catálogo · resposta é insumo, não GO · decisão "broad read é produto?" é de Clayton/Diretora, não minha.
Status: RESPONDIDO
============================================================

---

## Papel da instância

Sou a instância especialista em **Banco / Migrations / Schema**. Opero em modo **GUARDIÃO permanente** (auditoria, não execução).

**NÃO faço:** implementar código, criar/aplicar migration, alterar banco, commitar, editar documentação institucional (STATUS / DT_LOG / DECISIONs / contratos / código / frontend / migrations).

**Única escrita permitida:** este arquivo (`docs/memorias/MINHA_MEMORIA_BANCO_DE_DADOS.md`).

**Comandos permitidos no banco:** `SELECT`, catálogo (`information_schema`, `pg_catalog`, `to_regclass`), `\d`, `\dt`, `\di`, `\df`.
**Proibidos:** `INSERT/UPDATE/DELETE/ALTER/DROP/CREATE/TRUNCATE`, migration, seed, reset.

**Arquivos protegidos (nunca tocar/stagear/commitar):** `CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`.

**Conexão (read-only):** `DATABASE_URL` em `backend/.env` → `postgresql://postgres:***@localhost:5432/unificard_dev`. `psql` disponível e funcional.

### Canal com a executora `unificard` (protocolo desde 2026-06-06)

Este arquivo também é **canal de comunicação** com a executora. Convenção:
- A executora escreve blocos `PEDIDO DA EXECUTORA` **no TOPO** deste arquivo (acima desta seção).
- Quando Clayton avisar "veja sua memória": ler o topo, achar o `PEDIDO DA EXECUTORA` mais recente com `Status: ABERTO`.
- Responder **abaixo do próprio pedido**, sem apagar nada; mudar `Status: ABERTO` → `Status: RESPONDIDO`.
- Resposta com evidência material (schema vivo, migration, constraint, FK, query READ-ONLY, arquivo/linha) no formato `RESPOSTA IA-BANCO-DE-DADOS`.
- Nunca apagar pedidos/respostas antigas; conteúdo mais recente no topo; não reescrever histórico.
- Fora do escopo → "FORA DO ESCOPO IA-BANCO-DE-DADOS — encaminhar para IA-DT / IA-DECISOES / IA-DOCUMENTOS."
- Pedido de execução → "IA-BANCO-DE-DADOS é READ-ONLY. Posso mapear schema e risco, mas não executar."
- Lembrete: esta memória é **insumo operacional, não norma soberana**; schema vivo é checado antes de qualquer veredito.
- **Topo absoluto deste arquivo reservado aos PEDIDOs da executora** — minhas seções analíticas ficam abaixo.

---

# FECHAMENTO PJ — análise READ-ONLY (2026-06-06, HEAD `a312174a`)

## Estado verificado
- **HEAD:** `a312174a` ✅ (esperado)
- **Branch:** `rescue-structural` ✅
- **Working tree:** limpo, exceto 3 autorais protegidos (`CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`) + `docs/memorias/` untracked (quarentena). ✅
- **Migrations aplicadas:** **365** (DB) = 365 (.sql disco). ✅

## Escopo desta análise
Fechamento PJ — delete guard, PROVISIONAL→ACTIVE, fiscal_identity_id, constraints. READ-ONLY estrito.

## Achados principais
1. 🔴 **`deleteCompany` está QUEBRADO**: o guard financeiro consulta `accounts` e `transactions` — **tabelas que NÃO existem** (`to_regclass` = NULL). Toda chamada estoura `42P01` (HTTP 500) antes do soft-delete. PJ **não pode ser removida** hoje.
2. 🔴 **Não existe writer de runtime PROVISIONAL → ACTIVE.** O ciclo vivo só promove `DRAFT → PROVISIONAL` (`activateCompanyOperationally`, L878). `ACTIVE` é aceito pelo CHECK mas só é escrito por E2E/migration de normalização — **gap de lifecycle** (provável dependência do futuro `F-PJ-KYB-RELEASE-GATE`).
3. 🟢 **`createCompany` é fiscal-first correto**: insere `fiscal_identities` ANTES de `companies` (L500-509), FK presente desde o nascimento. 2 companies vivas, **0 com `fiscal_identity_id` NULL**.
4. 🟠 **`companies.fiscal_identity_id` é NULLABLE** — sem garantia de banco; fiscal-first é só código. Risco em legado/backfill/caminho alternativo.
5. **Verificação PJ = `fiscal_identities.kyb_status`** (eixo separado), NUNCA `company_status` (congelado, DECISION-0089/0090).

## A) deleteCompany
Arquivo: `backend/src/core/companies/companies.service.ts` L1996-2054.

| Item | Evidência | Veredito |
|---|---|---|
| Consulta tabela inexistente? | L2014 `FROM accounts`; L2027 `FROM transactions` | 🔴 SIM — ambas |
| `to_regclass('public.accounts')` | NULL | 🔴 não existe |
| `to_regclass('public.transactions')` | NULL | 🔴 não existe |
| Acesso direto a banco financeiro? | `pool.query(...)` direto (L2011, L2024), **não** `runQueryWithTenant`; sem RLS de tenant | 🔴 anti-padrão de fronteira |
| Deveria usar Bank port? | Verdade financeira = `bank_ledger` via Bank; SQL cru fora de `modules/bank/` é vetado (protocolo 2.3.2/2.3.3) | 🔴 SIM — viola NO_DIRECT_BANK_TABLE_ACCESS em espírito |
| Mismatch com bank_accounts/bank_transactions | `bank_accounts` tem `id`/`actor_id`/`owner_type∈{actor,system,escrow}` — **sem** `account_id`, **sem** owner_type='company'; `bank_transactions` tem `account_id`/`counterpart_account_id` — **sem** `from_account`/`to_account` | 🔴 modelo de dinheiro do guard nunca existiu neste sistema |
| Soft-delete em si | L2043-2051 `runQueryWithTenant` → `UPDATE companies SET status='inactive'` (tenant-scoped) | 🟢 correto, mas **inalcançável** (guard estoura antes) |

## B) Bug material do delete guard
**Causa raiz: tabela ausente + query antiga + modelo de dinheiro fantasma.** O guard de `deleteCompany` foi escrito contra um esquema financeiro pré-histórico (`accounts.account_id` + `accounts.owner_id`/`owner_type='company'`; `transactions.from_account`/`to_account`) que **não existe no schema vivo** — `accounts` e `transactions` retornam NULL em `to_regclass`. O SSOT financeiro atual é `bank_ledger`/`bank_transactions`/`bank_accounts`, com colunas e modelo totalmente diferentes (sem from/to account, sem owner_type='company', `bank_transactions` usa `account_id`+`counterpart_account_id`). Resultado material: a primeira query do guard (`SELECT ... FROM accounts`) lança `relation "accounts" does not exist` (42P01) → **`deleteCompany` lança HTTP 500 para QUALQUER empresa**; o soft-delete correto (status='inactive', tenant-scoped) **nunca é alcançado**. Agravante de fronteira: usa `pool.query` direto (sem contexto de tenant/RLS) em vez do Bank port — mesmo que as tabelas existissem, seria acesso financeiro cru proibido fora de `modules/bank/`. **Não é owner_id composite** — é tabela inexistente + modelo divergente.

## C) Writer PROVISIONAL → ACTIVE

| Busca | Resultado | Veredito |
|---|---|---|
| `SET company_status` / `company_status = CASE` | só L878: `CASE WHEN company_status='DRAFT' THEN 'PROVISIONAL' ELSE company_status END` (em `activateCompanyOperationally`) | DRAFT→PROVISIONAL existe; preserva ACTIVE/SUSPENDED, não promove a ACTIVE |
| `company_status='ACTIVE'` (writer runtime) | **nenhum** em `backend/src` fora de E2E | 🔴 gap — sem writer |
| `'ACTIVE'` em companies | só E2E `validate-pipeline-e2e-pj-company-status-lifecycle.ts` L103-105 ("normalização VERIFIED→ACTIVE, mesma lógica da migration") | ACTIVE só via migration de normalização, não runtime |
| `activateCompanyOperationally` | promove a **PROVISIONAL** (nome enganoso — "activate" não chega a ACTIVE) | Momento 2 do onboarding, não ativação operacional plena |

**Veredito:** lifecycle de runtime para em `PROVISIONAL`. **Não há writer PROVISIONAL → ACTIVE.** `ACTIVE` é alcançável apenas por migration histórica de normalização. Promoção a ACTIVE provavelmente dependerá do futuro `F-PJ-KYB-RELEASE-GATE` (PILAR 1, passo 5). **GAP registrado.**

## D) companies.fiscal_identity_id

| Checagem | Resultado | Risco |
|---|---|---|
| Sempre populado no nascimento fiscal-first? | `createCompany` insere `fiscal_identities` ANTES (L500-509); company recebe `fiscal_identity_id` no INSERT (L514-525) | 🟢 baixo no caminho canônico |
| Ordem fiscal → company | fiscal primeiro; CNPJ único global `uq_fiscal_identities_cnpj` explode antes da company; companies.cnpj = projeção | 🟢 correto |
| Linhas vivas com NULL | 2 companies, **0 NULL** | 🟢 hoje consistente |
| Constraint NOT NULL | **AUSENTE** (`is_nullable = YES`) | 🟠 sem garantia de banco |
| FK | `fk_companies_fiscal_identity` → `fiscal_identities(fiscal_identity_id)` **ON DELETE RESTRICT** | 🟢 protege identidade fiscal |
| Risco legado/backfill | coluna nullable + 94 atores legados no sistema; caminho alternativo de INSERT poderia gravar sem fiscal_identity_id | 🟠 latente — fiscal-first só garantido em código |

## E) Constraints / FKs relevantes

| Tabela | Constraint/FK | Função |
|---|---|---|
| companies | `chk_companies_company_status_lifecycle` | `company_status ∈ {DRAFT,PROVISIONAL,ACTIVE,SUSPENDED}` (ou NULL) |
| companies | `chk_companies_status` | `status ∈ {active,inactive,suspended,closed}` (eixo legado paralelo) |
| companies | `chk_companies_primary_classification_paired` | `(primary_company_type_id, primary_concept_id)` ambos NULL ou ambos NOT NULL |
| companies | `fk_companies_fiscal_identity` → fiscal_identities | ON DELETE **RESTRICT** — empresa não pode orfanar identidade fiscal |
| companies | `companies_primary_concept_id_fkey` → concepts | ON DELETE RESTRICT |
| companies | `companies_primary_company_type_id_fkey` → company_types | ON DELETE RESTRICT |
| companies | `companies_tenant_id_fkey` → tenants | ON DELETE CASCADE |
| companies | `companies_primary_address_id_fkey` → addresses | ON DELETE SET NULL |
| fiscal_identities | `chk_fiscal_identities_kyb_status` | `kyb_status ∈ {pending,approved,rejected,suspended,closed}` — **SSOT de verificação PJ** |
| fiscal_identities | `uq_fiscal_identities_cnpj` (citada no código L588) | CNPJ único global — gênese fiscal-first |
| fiscal_identity_documents | `fk_fidoc_fiscal_identity` | → fiscal_identities **ON DELETE CASCADE** (🔴 risco retenção, ver seção dedicada) |
| fiscal_identity_documents | `chk_fidoc_status` / `chk_fidoc_type` / `chk_fidoc_final_audit` | lifecycle + tipo + audit trail enforced |
| company_users | `chk_company_users_role_valid` | `role ∈ {owner,admin,staff,contractor,member}` |
| company_users | `chk_company_users_member_status_valid` | `member_status ∈ {active,invited,suspended}` |

**Nota dual-status:** `companies` mantém DOIS eixos — `status` (lowercase legado) e `company_status` (lifecycle PJ). `deleteCompany` escreve `status='inactive'`; o lifecycle PJ usa `company_status`. Segunda verdade já registrada.

## Lacunas materiais (fechamento PJ)
1. 🔴 `deleteCompany` inoperante — guard contra tabelas fantasmas (`accounts`/`transactions`). Empresa **não removível** com segurança.
2. 🔴 Sem writer PROVISIONAL → ACTIVE — empresa não atinge estado operacional pleno em runtime.
3. 🟠 `fiscal_identity_id` sem NOT NULL — fiscal-first não garantido por banco.
4. 🟠 Guard de delete deveria consultar `bank_ledger`/`bank_transactions` via **Bank port**, não SQL cru — hoje nem o modelo nem o canal estão certos.
5. 🟡 KYB documental (PILAR 1) ainda não executado — sem provider de storage; `fiscal_identity_documents` vazio (0 linhas).

## Riscos para fechar PJ
- **Remoção segura impossível hoje** (delete quebrado): qualquer "remover empresa" estoura 500. Bloqueia a definição de "PJ fechada".
- **Capability/gating por estado**: se a UI/autorização assume `ACTIVE` para liberar operação, nenhuma empresa chega lá (sem writer) → ou tudo opera em PROVISIONAL (gate frouxo) ou nada opera (gate travado). Confirmar onde o gate de capability lê o estado.
- **Acoplamento financeiro fantasma**: o delete guard sugere intenção de "não apagar empresa com dinheiro" — intenção correta, implementação morta. Ao reescrever, fazer via Bank port consultando `bank_ledger` (verdade de saldo/transação), não via `accounts`/`transactions`.
- **fiscal_identity_id nullable**: backfill ou import futuro pode criar empresa sem identidade fiscal, furando a gênese fiscal-first sem o banco reclamar.

## Recomendações READ-ONLY para a consolidação
1. Tratar `deleteCompany` como **frente própria** (ex.: `F-PJ-DELETE-GUARD-BANK-PORT`): substituir `accounts`/`transactions` por consulta ao Bank (port/serviço) sobre `bank_ledger`/`bank_transactions` filtrando o actor da empresa — **não** SQL cru, **não** tabelas fantasmas. Migration NÃO necessária (só código).
2. Definir o **writer PROVISIONAL → ACTIVE** como parte de `F-PJ-KYB-RELEASE-GATE` (promoção a ACTIVE condicionada a `kyb_status='approved'`). Confirmar se ACTIVE é o estado-alvo operacional pleno antes de implementar.
3. Avaliar tornar `companies.fiscal_identity_id` **NOT NULL** (migration) após confirmar 0 NULL e nenhum caminho de INSERT sem fiscal-first — endurece a gênese no banco.
4. Antes de qualquer delete real, confirmar onde a **capability/gating por estado** lê `company_status` vs `status` (dual-axis) para não autorizar/negar pelo eixo errado.

## STOPs para a executora futura
> 🔴 **NÃO executar `deleteCompany` como está** — estoura HTTP 500 (`relation "accounts" does not exist`). Qualquer fluxo de remoção de empresa está quebrado até a frente do delete guard.

> 🔴 **NÃO reescrever o delete guard com SQL cru contra `bank_*`** — usar Bank port/serviço (protocolo 2.3.2/2.3.3: proibido acesso direto a `bank_ledger`/`bank_transactions`/`bank_accounts` fora de `modules/bank/`). A verdade de "tem dinheiro?" é `bank_ledger`.

> 🔴 **NÃO assumir que empresa chega a ACTIVE** — não há writer de runtime. Lifecycle vivo para em PROVISIONAL. Promoção a ACTIVE é gap a ser preenchido pelo KYB release gate.

> 🟠 **NÃO confiar em `fiscal_identity_id` como sempre presente** em joins/lógica — coluna nullable; garantia é só de código (fiscal-first em `createCompany`). Tratar NULL defensivamente até existir NOT NULL.

> 🟠 **NÃO escrever verificação PJ em `company_status`** — SSOT de verificação é `fiscal_identities.kyb_status` (eixo congelado por DECISION-0089/0090). `company_status` é lifecycle de cadastro, não verificação.

> 🟢 **PILAR 1 (KYB documental) permanece NÃO iniciado** — `F-PJ-DOCUMENT-STORAGE-PORT` travado; pré-condição = verificação READ-ONLY da DECISION-0112 + ADENDO §10. Esta análise é só mapeamento paralelo de banco.

---

## Estado inicial verificado

- **HEAD:** `eba663b5` (`decisions: DECISION-0112 storage documental KYB/PJ (docs-only)`)
- **Branch:** `rescue-structural` ✅ (esperada)
- **Working tree:** limpo, exceto 3 untracked = exatamente os arquivos protegidos (`CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`). Nada staged.
- **Migrations aplicadas:** **365** linhas em `schema_migrations`.
  - ⚠️ `schema_migrations` usa coluna **`filename`** (não `version`). Schema: `id serial PK`, `filename varchar(255) UNIQUE NOT NULL`, `executed_at timestamptz`, `checksum`, `execution_time_ms`.
  - **365 arquivos `.sql`** em `backend/migrations/` = 365 aplicadas → **schema em sincronia** (sem migration pendente nem fantasma no runner oficial). O `368` de `ls` inclui `AUDITORIA_MIGRATIONS_COMPLETA.txt`, `desktop.ini` e não-`.sql`.
  - Última aplicada = última no disco: `20260605200000_seed_company_type_service_categories_salon.sql` (2026-06-05).
- **Tabelas base no schema `public`:** **250**.

---

## Documentos lidos

1. `docs/01_normative/00_AGENT_PROTOCOL.md` (íntegra) — bootstrap, modos GUARDIÃO/EXECUTOR, gate 2.3.2, proibições 2.3.3, fronteira financeira de código (§17 baseline `canonical_products`).
2. `docs/01_normative/SSOT_EXCLUSIVE_BANK_RULE.md` (íntegra) — força constitucional; UnifyBank = SSOT financeiro exclusivo.
3. `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` (seção temporal + seção dinheiro/centavos/ledger).
4. `docs/01_normative/07_NOMENCLATURA_CANONICA.md` (regras de dinheiro/tempo/booleanos).
5. `backend/migrations/` (listagem; últimas ~30).
6. `STATUS_EXECUCAO_GLOBAL.md` (entradas recentes — frente KYB/PJ).
7. `REMEDIATION_DT_LOG.md` (DT-SCHEMA-DRIFT-CLUSTER-5-TABLES íntegra + cabeçalhos).
- _Pendente de leitura profunda (ler sob demanda):_ `CONSTITUICAO_UNIFICARD.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `INVARIANTES_OPERACIONAIS_LEDGER.md`, `PROHIBITED_STRUCTURES.md`, `REMEDIATION_DECISIONS_LOG.md`. (`DECISOES.md` **não existe**; o log canônico é `REMEDIATION_DECISIONS_LOG.md`. `MIGRATIONS_FULL.txt` existe na raiz.)

---

## Estado atual do schema

- 250 tabelas base, 365 migrations aplicadas, alinhado ao disco.
- Domínios vivos materializados: **bank/financeiro**, **identity/actor**, **companies/fiscal (KYB/PJ)**, **concepts/semântica**, **temporal (unified_availability + legado schedules)**, **location core (addresses/cities/...)**, **marketplace/products/orders**, **rides**, **escrow**, **governança/regional fund**, **inventory (ledger físico)**.
- Convenção de naming financeiro **majoritariamente respeitada**: dinheiro em `*_cents BIGINT`.

---

## Tabelas críticas por domínio

- **Identity / Actor:** `actors` (PK `id uuid`, `actor_type text NOT NULL`, `global_user_id uuid NULL`, `kyc_limit_cents bigint`), `global_users`, `fiscal_identities`. SSOT identity = `actors` (DECISION-0021/0062). `global_user_id` **nullable** (94 atores legados com NULL — backfill futuro, ver memória 0062).
- **Companies / KYB-PJ (frente ativa):** `companies`, `company_users`, `company_types`, `company_type_allowed_concepts`, `company_type_service_categories`, `company_concept_publications`, `company_validations`, `company_validation_requests`, `fiscal_identities`, `fiscal_identity_documents`, `fiscal_identity_kyb_requests`, `fiscal_identity_economic_activities`, `cnae_concept_suggestions`.
- **Semântica (CONCEPT = SSOT semântico):** `concepts`, `concept_relations`, `concept_labels`, `canonical_concept_resolution_queue`, `tenant_concept_offerings`, `actor_professional_concepts`, `actor_learning_concepts`, `actor_interest_concepts`.
- **Temporal:** SSOT = `unified_availability` + `unified_bookings`. Legado READ-ONLY: `schedules`, `schedule_slots` (existem; WRITE = violação C63).
- **Location core (DECISION-0020):** `countries`, `states`, `cities`, `neighborhoods`, `addresses`, `address_assignments`.
- **Inventory (ledger físico, ≠ dinheiro):** `inventory_balances`, `inventory_movements`, `inventory_reservations`.

---

## `fiscal_identity_documents` — SSOT documental KYB (verificado por SELECT próprio 2026-06-06)

Substrato da frente ativa KYB/PJ (DECISION-0087/0112). **0 linhas hoje; 93 `fiscal_identities`.** Confirmado independentemente (não só via relatório de outra instância).

**Colunas (14):** `document_id uuid PK` · `fiscal_identity_id uuid NOT NULL` (âncora/dono) · `kyb_request_id uuid NULL` · `document_type text NOT NULL` · `document_status text NOT NULL default 'submitted'` · **`file_reference text NOT NULL`** (ponteiro **opaco** — nunca blob/base64/path público) · **`file_hash text NULL`** · `submitted_by_actor_id uuid NOT NULL` · `reviewed_by_actor_id uuid NULL` · `reviewed_at timestamptz NULL` · `decision_reason text NULL` · `supersedes_document_id uuid NULL` (self) · `created_at/updated_at timestamptz NOT NULL now()`.
**Ausentes:** `mime_type`, `size_bytes`, qualquer `bytea`/blob — arquivo bruto **não** mora no banco (alinhado D4/D11; mime/size = adição futura OPCIONAL).

**CHECKs:**
- `chk_fidoc_status`: ∈ {submitted, accepted, rejected, superseded}.
- `chk_fidoc_type`: ∈ {cnpj_registration, articles_of_association, articles_amendment, business_address_proof, complementary_document}.
- `chk_fidoc_final_audit`: status terminal **exige** `reviewed_by_actor_id + reviewed_at + decision_reason` NOT NULL → **audit trail enforced no banco**.

**FKs (com ON DELETE, `confdeltype` verificado):**
- 🔴 `fk_fidoc_fiscal_identity` → `fiscal_identities` **ON DELETE CASCADE** (`c`).
- `fk_fidoc_submitted_by_actor` → `actors(id)` **ON DELETE RESTRICT** (`r`) — protege autoria.
- `fk_fidoc_kyb_request` / `fk_fidoc_reviewed_by_actor` / `fk_fidoc_supersedes` → **ON DELETE SET NULL** (`n`).

**Unique:** apenas a PK (`document_id`). **NÃO há unique em `(fiscal_identity_id, document_type)`** → múltiplos documentos por identidade são permitidos (correto p/ append-only + supersede).

**Veredito migration:** port de storage + user-submit + admin-review = **NENHUMA migration** (SSOT já suporta submit/list/review/supersede). Migration só seria necessária para materializar `mime_type`/`size_bytes`, tornar `file_hash` NOT NULL, criar status de revogação ou política de retenção — tudo decisão de produto, não cravado.

---

## Tabelas financeiras críticas

SSOT financeiro = **UnifyBank** (`SSOT_EXCLUSIVE_BANK_RULE.md`, força constitucional):

- `bank_ledger` — **SSOT contábil de dinheiro** (verdade de saldo).
- `bank_transactions`, `bank_accounts`, `bank_splits`, `bank_settlements`, `bank_policies`, `bank_limit_change_requests`.
- Wallet/recovery/payout: `actor_wallet_payout_requests`, `actor_wallet_recovery_obligations`, `actor_wallet_recovery_obligation_entries`, `payout_requests`.
- Escrow: `escrow_accounts`, `escrow_transactions`.
- Reconciliação: `reconciliation_ledger_discrepancies`, `reconciliation_discrepancies`, `ledger_snapshots`, `ledger_compensations`.
- **NÃO-SSOT (log/snapshot/intenção):** `b2b_payment_intents`, `b2b_order_items`, `payment_intents`, `payment_transactions`, `unifycard_transactions` (LOG), `impact_ledger`/`impact_balances` (impacto, não dinheiro). Não podem virar ledger disfarçado.

---

## Constraints e CHECKs importantes

**`bank_ledger` (blindado):**
- CHECK `amount_cents > 0`; CHECK `direction IN ('credit','debit')`.
- **RLS forçado** (`bank_ledger_rls` por `app.current_tenant` + bypass `unificard_infra`).
- Triggers: `bank_ledger_no_delete` / `bank_ledger_no_update` (`prevent_bank_ledger_modification` — **append-only**), `bank_ledger_non_negative_balance` (`validate_non_negative_balance`), `trg_check_coverage` (`check_coverage_before_credit`), `trg_update_activity`.
- FKs: `account_id → bank_accounts`, `tenant_id → tenants`, `transaction_id → bank_transactions`.

**`bank_accounts`:** CHECK `account_type` (lista de 14: credit/user_wallet/escrow_*/seller_*/platform_*/clearing/.../`actor_wallet`); CHECK `owner_type IN (actor,system,escrow)`; CHECK actor_owner exige `actor_id NOT NULL`.

**`bank_transactions` / `escrow_accounts`:** `amount_cents > 0`. `escrow_accounts.status IN (active,released,refunded,disputed,cancelled)`.

**Wallet payout/recovery:** vários CHECKs de status + amount positivo + `recovered_amount_cents BETWEEN 0 AND amount_cents`; `actor_wallet_payout_requests.destination_type = 'internal_settlement'` (payout externo ainda fechado).

**`company_users`:**
- `chk_company_users_role_valid`: role ∈ **{owner, admin, staff, contractor, member}** ← vocabulário ÚNICO vivo (frente F-PJ-COMPANY-USER-ROLE-VOCABULARY-MISMATCH alinhou contrato/UI a isto).
- `chk_company_users_member_status_valid`: ∈ {active, invited, suspended}.

**`companies` (⚠️ dual-status — ver seção de segunda verdade):**
- `chk_companies_status`: `status ∈ {active, inactive, suspended, closed}` (lowercase).
- `chk_companies_company_status_lifecycle`: `company_status ∈ {DRAFT, PROVISIONAL, ACTIVE, SUSPENDED}` (uppercase) — migration `20260604120000`.
- `chk_companies_primary_classification_paired`: `(primary_company_type_id, primary_concept_id)` ambos NULL ou ambos NOT NULL.

---

## FKs importantes

- `bank_ledger.{account_id,tenant_id,transaction_id}` → `bank_accounts`/`tenants`/`bank_transactions`.
- `bank_accounts.actor_id` → `actors` (via CHECK actor_owner).
- `companies.fiscal_identity_id` → `fiscal_identities` (migration `20260603120000`).
- `categories.concept_id` → `concepts` (ponte category→concept governada; ver protocolo 2.3.5).
- _A mapear em profundidade conforme a frente exigir (não auditado exaustivamente nesta sessão)._

---

## Índices importantes

- `bank_ledger`: PK + `idx_bank_ledger_account`, `idx_bank_ledger_created`, `idx_bank_ledger_transaction`.
- `schema_migrations`: `unique_filename` (UNIQUE), `idx_schema_migrations_filename`, `idx_schema_migrations_executed_at`.
- _Demais índices por tabela: levantar sob demanda com `\d <tabela>`._

---

## Tabelas fantasmas conhecidas

Código vivo referencia tabela que **NÃO existe** no banco (`to_regclass` = NULL). Cluster registrado em **`DT-SCHEMA-DRIFT-CLUSTER-5-TABLES` (OPEN)**. Todas têm migration escrita em `backend/migrations_archive/` (NÃO aplicada pelo runner oficial `migrate.ts`, que só lê `backend/migrations/`).

| Tabela | Existe? | Severidade | Tratamento código | Archive |
|--------|---------|------------|-------------------|---------|
| `company_documents` | ❌ NULL | era DRIFT → **neutralizado** | upload/readers/admin **tombstoned 501** (commits `8180a493`/`dd4e202c`, DECISION-0087); SSOT real = `fiscal_identity_documents` | `0046` |
| `business_audit_logs` | ❌ NULL | ÓRFÃO | try/catch externo (`recordBusinessAuditSafely`) — degrada silencioso | `0922` |
| `company_domains` | ❌ NULL | ÓRFÃO | catch `42P01` explícito | `0404` |
| `company_opportunity_preferences` | ❌ NULL | ÓRFÃO | try/catch interno | `0078` |
| `referral_codes` | ❌ NULL | ÓRFÃO/PLANEJADO | try/catch + retry lazy; `run-migration-073.js` avulso na raiz | `0073` |

**Origem provável:** reorganização das migrations para formato timestamped `20260530XXX_*`; features escritas e nunca convergidas ao banco vigente. Resolução prevista = frente individual por tabela quando dor material aparecer (`feedback_archive_nao_e_ssot.md`: auditoria contextual antes de restaurar).

---

## Drift código × schema

1. **5 tabelas fantasmas** acima (DT-SCHEMA-DRIFT-CLUSTER-5-TABLES OPEN). `company_documents` é o de maior risco histórico (quebrava HTTP 500), hoje tombstoned a 501 — circuito morto, mas a tabela continua ausente.
2. **`services.price_cents` = `integer`** (não BIGINT). Viola nomenclatura canônica (07, linha 444: `_cents` ⇒ BIGINT). Coluna de dinheiro fora do tipo soberano. **Não é o ledger** (services é catálogo de oferta), mas é drift de tipo monetário. Ver alerta abaixo.
3. **`bank_limit_change_requests.requested_amount`** é BIGINT mas **sem sufixo `_cents`** — naming drift menor (tipo correto, rótulo fora da convenção).
4. Verdade temporal: `schedules`/`schedule_slots` ainda existem e há WRITE paths ativos (C63 CRITICAL, IN_PROGRESS via DECISION-0014) — verdade paralela ao SSOT `unified_availability`.

---

## Campos financeiros e tipos de dinheiro

- **Regra canônica (07_NOMENCLATURA §dinheiro):** sufixo `_cents` obrigatório; tipo **BIGINT** (nunca INTEGER); proibido FLOAT/DOUBLE/DECIMAL/**NUMERIC** para dinheiro. `TIMESTAMPTZ` para tempo. Booleanos `is_`/`has_`/`can_`.
- **Varredura:** ~80 colunas `*_cents`/amount/price/balance verificadas → **todas BIGINT**, EXCETO `services.price_cents` (**integer** — drift confirmado).
- **`numeric` no schema = legítimo onde não é dinheiro:** lat/lng (`addresses`, `cities`, `actor_active_location`), scores/confidence (`trust_*`, `actor_reputation`, `*_confidence`), quantidades (`inventory_*`, `order_items.quantity`), percentuais (`bank_splits.percentage`, `treasury_split_config.pct_*`, `rides_distribution_rules.*_percentage`), impacto (`impact_balances.balance`, `impact_ledger.impact_delta`).
- ⚠️ **Atenção a vigiar:** `impact_balances.balance` e `impact_ledger.impact_delta` são `numeric` e nominalmente "balance/ledger" — porém são **impacto social, não dinheiro**. Confirmar que nunca sejam tratados como saldo monetário (seriam violação se promovidos a dinheiro).

---

## Status/lifecycle com risco de segunda verdade

1. **`companies` tem DUAS colunas de status** com vocabulários divergentes e CHECKs separados:
   - `status` (lowercase: active/inactive/suspended/closed) — legado.
   - `company_status` (uppercase lifecycle: DRAFT/PROVISIONAL/ACTIVE/SUSPENDED) — novo (migration `20260604120000`).
   - **Risco:** duas fontes de "estado da empresa" coexistindo. Qual é soberana? Ambas têm CHECK vivo. Pergunta pendente (abaixo). `is_verified` foi **dropada** (migration `20260604130000`) — bom, reduziu uma terceira verdade.
2. **`kyb_status` NÃO está em `companies`** — KYB vive no domínio fiscal (`fiscal_identities` / `fiscal_identity_kyb_requests`). Documento KYB não promove `company_status` (DECISION-0087/0112). Confirmar que nenhum código tenta mexer `company_status` a partir de documento.
3. **Temporal dual:** `unified_availability` (SSOT) vs `schedules`/`schedule_slots` (legado com WRITE ativo, C63).
4. Múltiplos CHECKs de status em payout/recovery/escrow — coerentes, sem segunda verdade aparente.

---

## SSOTs paralelos suspeitos

- **Financeiro:** nenhum ledger paralelo material detectado. Vigiar que `b2b_payment_intents`, `payment_intents`, `unifycard_transactions`, `impact_ledger` **não** virem saldo. `services.price_cents`/`product_*_cents` são oferta comercial, não saldo — OK desde que não persistam "dinheiro movimentado".
- **Identidade:** 3 vocabulários de `actor_type` coexistindo (DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION, ver memória 0062); `chk_actor_requires_identity` inefetiva sobre `actor_type='user'` em runtime.
- **Semântica:** CONCEPT é SSOT; vigiar `category`/`category_id` não ser usado como identidade semântica (protocolo §12). Múltiplas filas de resolução (`canonical_concept_resolution_queue`, `_deprecated_product_concept_resolution_queue`) — a depreciada está marcada.
- **Companies status:** ver dual-status acima (segunda verdade ativa de lifecycle).

---

## Riscos de migration futura

1. **`company_status` × `status`:** qualquer migration que consolide lifecycle de empresa precisa decidir soberania e backfill — não pode introduzir terceira verdade nem deixar CHECKs contraditórios. Migration = cirurgia.
2. **Correção de `services.price_cents` → BIGINT:** `ALTER TYPE integer→bigint` é seguro em PG (widening), mas é migration, **não code-only**. Verificar callers/contratos que assumem int32.
3. **Convergência das 5 tabelas fantasmas:** se restauradas do archive, exige auditoria contextual por tabela (design mudou? há substituto? — `company_documents` já tem substituto SSOT em `fiscal_identity_documents`). Restaurar `0046_company_status_and_documents.sql` cru seria reintroduzir caminho não-SSOT.
4. **C63 temporal:** REVOKE de WRITE em `schedules`/`schedule_slots` (migration `20260428200000` não aplicada) bloqueará writes legados — migrar writers antes.
5. **Frente KYB/PJ docs (DECISION-0112):** storage documental será **port + provider**, metadado mínimo (`mime_type`/`size_bytes`) = adição futura de schema; arquivo bruto **nunca** no banco; `file_reference` opaco. Qualquer migration aqui deve respeitar isso. Port + user-submit **não exigem migration** (verificado).
7. 🔴 **`fiscal_identity_documents` → `fiscal_identities` é ON DELETE CASCADE.** Apagar uma fiscal identity **apaga silenciosamente a evidência documental KYB**. Conflita com retenção probatória/LGPD. Hoje invisível (0 linhas) — exatamente o tipo de risco que só aparece quando já é tarde. Resolver (RESTRICT/SET NULL + política de expurgo) **antes** de existir documento real exige migration. (Confirma/anexa material à D10 da DECISION-0112.)
8. **`file_hash` é nullable.** Integridade/dedupe não garantidos no nível do banco — dependem do port preencher. Tornar NOT NULL = migration + decisão.
6. Toda nova tabela exige RFC/contrato normativo (protocolo 2.3.3) — proibido criar SSOT paralelo ou tabela por suposição.

---

## Queries READ-ONLY úteis

```bash
# carregar conexão (bash)
export $(grep -E '^DATABASE_URL=' /c/unificard/backend/.env | xargs)

# migrations aplicadas (coluna é filename, NÃO version)
psql "$DATABASE_URL" -c "SELECT count(*) FROM schema_migrations;"
psql "$DATABASE_URL" -c "SELECT filename, executed_at::date FROM schema_migrations ORDER BY executed_at DESC LIMIT 15;"

# tabela existe?
psql "$DATABASE_URL" -c "SELECT to_regclass('public.<tabela>');"

# dinheiro fora de BIGINT (caça-drift)
psql "$DATABASE_URL" -c "SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND column_name LIKE '%_cents' AND data_type<>'bigint';"

# CHECKs de uma tabela
psql "$DATABASE_URL" -c "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='<tabela>'::regclass AND contype='c';"

# estrutura completa
psql "$DATABASE_URL" -c "\d <tabela>"
```

---

## Perguntas pendentes para Clayton

1. **`companies.status` vs `companies.company_status`:** qual é a coluna soberana de lifecycle? A `status` (lowercase legada) deve ser deprecada/dropada em favor de `company_status`? Hoje há **duas verdades de estado** com CHECKs vivos divergentes.
2. **`services.price_cents` é `integer`:** confirmar que deve convergir para BIGINT (nomenclatura canônica). É drift consciente ou acidental?
3. **5 tabelas fantasmas (DT-SCHEMA-DRIFT-CLUSTER):** alguma deve ser convergida proativamente, ou todas permanecem "frente por dor material"? `referral_codes` (incentivo econômico — visão do projeto) tem prioridade?
4. **C63 temporal:** quando migrar os 6 WRITE paths de `schedules`/`schedule_slots` para `unified_availability` (DECISION-0014)?

---

## Alertas para a executora unificard

> 🔴 **DUAL-STATUS em `companies`.** Existem `status` (lowercase) **e** `company_status` (uppercase) com CHECKs separados. Antes de qualquer leitura/escrita de "estado da empresa", confirmar QUAL é soberano para o caso — não escrever em ambos sem decisão. Segunda verdade de lifecycle ativa.

> 🟠 **`services.price_cents` é INTEGER, não BIGINT.** Se a frente tocar precificação de `services`, isto é drift da nomenclatura canônica de dinheiro. Corrigir exige **migration** (`ALTER ... TYPE bigint`) — **não passar como code-only**.

> 🟠 **5 tabelas fantasmas vivas no código:** `company_documents` (tombstoned 501), `business_audit_logs`, `company_domains`, `company_opportunity_preferences`, `referral_codes`. Se uma frente exercitar esses caminhos, contar com degradação/501 — a tabela **não existe**. NÃO restaurar do `migrations_archive/` sem auditoria contextual por feature.

> 🟠 **Fronteira financeira (protocolo 2.3.2/2.3.3):** código fora de `backend/src/modules/bank/` **não pode** acessar `bank_ledger`/`bank_transactions`/`bank_accounts` em SQL, nem definir `FOR UPDATE`/lock sobre elas, nem inferir saldo. Saldo só de `bank_ledger`. Se uma frente precisar disso → encapsular no Bank, não furar a fronteira.

> 🟠 **Temporal:** WRITE em `schedules`/`schedule_slots` = violação C63. Estado temporal só em `unified_availability`/`unified_bookings`.

> 🟡 **`actor.global_user_id` é nullable** (94 atores legados NULL). Não assumir não-nulo em joins de identidade.

> 🟡 **Qualquer "vou criar uma tabela / coluna nova":** exige RFC/contrato normativo (proíbe SSOT paralelo). Migration é cirurgia, não decoração. Avisar esta instância para auditar antes.

> 🟡 **Frente ativa = KYB/PJ documental (DECISION-0112).** Storage documental será port+provider; arquivo bruto nunca no banco; metadado mínimo é adição de schema futura. Documento NÃO promove `company_status`/KYB. **Port + user-submit + admin-review NÃO precisam de migration** — o SSOT `fiscal_identity_documents` já suporta submit/list/review/supersede. Não inventar schema desnecessário na fatia.

> 🔴 **`fiscal_identity_documents` tem ON DELETE CASCADE para `fiscal_identities`.** Apagar uma fiscal identity apaga a evidência documental KYB. Antes de existir documento real, decidir retenção (cascade vs RESTRICT/SET NULL + expurgo governado) — é migration. Não deixar passar como "detalhe": evidência legal não pode sumir por cascade.

> 🟢 **Audit trail KYB já é enforced no banco:** `chk_fidoc_final_audit` exige revisor+data+razão para status terminal. Não duplicar essa regra em código como se não existisse; confiar no CHECK.

---
<!-- append-only: acrescentado pela EXECUTORA unificard — 2026-06-06 — não editar/reescrever conteúdo do especialista -->

## Nota de coordenação — ACTIVE vestigial no MVP

Não existe writer runtime `PROVISIONAL → ACTIVE`.

Clayton ratificou que esse writer NÃO deve ser criado no MVP.

`company_status='ACTIVE'` não deve ser usado como:
- proxy de KYB;
- liberação financeira;
- liberação de publicação/oferta;
- autorização operacional.

Capacidades devem continuar dependendo de `fiscal_identities.kyb_status` e dos gates de autoridade.
