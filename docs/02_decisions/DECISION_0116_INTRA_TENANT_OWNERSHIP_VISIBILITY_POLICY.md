# DECISION-0116 — Política canônica de ownership e visibilidade intra-tenant

**Data:** 2026-06-10
**Tipo:** Identidade / Autoridade / Visibilidade de recurso — **docs-only** (política/produto)
**Status:** PROMULGADA (docs-only) — estabelece a **política canônica de quem-vê/possui-qual-classe-de-recurso dentro de um tenant compartilhado**. **NÃO** autoriza código/runtime/migration/banco/frontend; **NÃO** libera R2; **NÃO** libera FASE 6; **NÃO** declara `DECISION-0113` fechada; **NÃO** libera C1/tenant compartilhado. Orienta as próximas fatias de hardening de isolamento intra-tenant.
**Frente:** `F-G10-SHARED-TENANT-OWNERSHIP-VISIBILITY-GOVERNANCE`
**HEAD de origem:** `3d8ad25b`
**Decisor:** Clayton / IA Diretora (classes e mapeamento ratificados no GO docs-only)
**Deriva de / subordinada a:** `CONSTITUICAO_UNIFICARD` (Art. I — Soberania do Ator; "visibilidade ≠ poder"), `LEIS_OPERACIONAIS_UNIFICARD` (Lei 5 — Bank SSOT), `AUTHORITY_PRECEDENCE`, `SSOT_REGISTRY` (§5.9.1 valores comerciais não-SSOT), `DECISION-0113` (actorId hint não-soberano; sujeito = `req.user` server-side), `DECISION-0115 D1` (tenant inicial vivo compartilhado), `DECISION-0021`/`DECISION-0030` (modelo de isolamento por tenant × catálogo global), `DECISION-0099`/`0100` (publicação/oferta PJ gated KYB), `DECISION-0110`/`0111` (escrow/release/refund), `DECISION-0094` (capability social PJ gated KYB).
**Vinculada a:** `DT-SHARED-TENANT-RESOURCE-VISIBILITY-NO-OWNERSHIP-POLICY` (DT-mãe, OPEN), `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` (raiz irmã, 0113), `DT-RBAC-FAIL-CLOSED-STUB-FASE6-REACTIVATION-TRAP`, `DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE`, `DT-UNREAD-COUNTS-FEED-VISIBILITY-PHANTOM-COLUMN`, `DT-HUMAN-BIRTH-TENANT-PER-SIGNUP-DEAD-WORLD`.

---

## 1. Contexto / causa-raiz

A consolidação READ-ONLY de seis instâncias especialistas (IA-ACTOR-USERS Eixo A+B, IA-BANCO-DE-DADOS, IA-DINHEIRO, IA-DECISOES, IA-DT, IA-DOCUMENTOS), sobre o denominador de leituras tenant-wide (clusters 2–8), provou contra schema vivo e norma:

- **A RLS é tenant-scoped por desenho e está correta** como isolamento **entre tenants** (`20260516100000_rls_critical_tables.sql`: 7 tabelas críticas via `app.current_tenant`). A RLS **não resolve, sozinha, a visibilidade entre sujeitos do MESMO tenant**, e não foi desenhada para isso.
- A **causa-raiz** do vazamento intra-tenant é a **ausência de política canônica de ownership e visibilidade por classe de recurso**. O isolamento entre pessoas era **acidental** (no mundo `tenant-per-signup`, `tenant ≈ pessoa`, então `WHERE tenant_id` ≈ `WHERE owner`). `DECISION-0115 D1` aponta a PF para um **tenant inicial vivo compartilhado** → a coincidência colapsa → co-tenants passam a se ver.
- O vetor é **MISSING-SCOPE** (o cliente não declara identidade-alvo; o reader devolve as linhas do tenant inteiro), **distinto** do vetor de `DECISION-0113` (**HINT-CONFIADO**: o cliente declara `actorId` e o servidor confia sem provar). Por isso esta decisão é **raiz irmã** da 0113, não sub-galho dela.
- Grep de norma de "visibilidade por recurso / resource visibility / shared tenant" em `01_normative`/`02_decisions`/`ssot` = **ZERO**. O vácuo é genuíno; é política ausente, não política violada.

Materialidade: todas as tabelas auditadas têm **0 linhas** hoje (2 tenants) — os vazamentos são **latentes por dado, vivos por shape**. A urgência é fechar o denominador Classe A aplicável **antes** do primeiro co-tenant real.

## 2. O que esta DECISION promulga

### 2.1 Princípios

1. A **RLS tenant-scoped continua correta** como isolamento entre tenants.
2. A **RLS não resolve, sozinha, visibilidade entre sujeitos do mesmo tenant**.
3. A **causa-raiz é a ausência de política canônica de ownership/visibilidade por classe de recurso** — agora suprida por esta decisão.
4. **`DECISION-0116` é raiz irmã da `DECISION-0113`:** a 0113 governa `actorId` declarado, binding e representabilidade (hint-confiado); a 0116 governa o **escopo de recursos quando nenhuma identidade-alvo é declarada** e o reader devolve linhas do tenant (missing-scope). Fechar uma **não** fecha a outra.
5. **`DECISION-0115 D1` continua governando** o nascimento no tenant inicial vivo.
6. **Nenhum tenant compartilhado pode ser liberado** enquanto o denominador Classe A aplicável ao nascimento estiver aberto.

### 2.2 Classes canônicas de visibilidade

Cada recurso recebe **uma** classe. Recurso sem classe promulgada = `DEFAULT_DENY` (não vira tenant-wide por omissão).

1. **PUBLIC_TENANT** — conteúdo explicitamente público, produzido para descoberta dentro do mundo/rede aplicável. A classificação pública deve ser **materializada no schema ou derivada de regra canônica comprovável**; **ausência de campo não torna conteúdo público por omissão**.
2. **ACTOR_PRIVATE** — recurso de um actor operacional; leitura/escrita só por usuário que possa **representar o actor proprietário** (`DECISION-0113`, `canRepresentActor`).
3. **COMPANY_INTERNAL** — recurso operacional de uma empresa; acesso só por **representantes ativos da empresa com autoridade funcional compatível materializada server-side** (`company_users.can_*`). **Ser membro do mesmo tenant não concede acesso.**
4. **GROUP_MEMBERS** — recurso de grupo privado/secreto; acesso por **membership server-side materializada em `group_members`**. Metadados/conteúdo explicitamente públicos de grupo público podem ser `PUBLIC_TENANT`. **A lista nominal de membros não é pública por omissão.**
5. **PERSONAL_SENSITIVE** — PII, identidade civil, endereço, contato, KYC ou dado pessoal equivalente; acesso por **self · vínculo/consentimento governado · representação formal · admin/compliance institucional explícito**. **Nunca tenant-wide por padrão.**
6. **INSTITUTIONAL_ADMIN** — métricas, auditoria e operações **cross-tenant** da plataforma; só **papel institucional explícito e materializado**. Role genérica de company, capability default ou simples autenticação **não** autorizam.
7. **MONEY_PARTIES** — recurso financeiro/custódia/settlement/refund/payout/split; acesso só às **partes autorizadas, com autoridade financeira e regras do Bank**. **Sempre exige frente financeira própria** quando houver alteração material.
8. **DEFAULT_DENY** — recurso ainda não classificado **não pode virar tenant-wide por omissão**. Sem classe, sem exposição.

### 2.3 Mapeamento de recursos ratificado

- **Feed e eventos explicitamente públicos** → `PUBLIC_TENANT`.
- **Grupos** → existência/conteúdo explicitamente público de grupo público = `PUBLIC_TENANT`; conteúdo privado/secreto = `GROUP_MEMBERS`; **lista de membros = `GROUP_MEMBERS`**, salvo decisão futura explícita.
- **Inventory** → `ACTOR_PRIVATE`. `inventory_movements.actor_id` é o **proprietário operacional material** (NOT NULL, FK→actors; índice `(tenant_id, actor_id, product_variant_id)` vivo). Representantes de empresa acessam por **autoridade sobre o actor correspondente**. Visão consolidada só pode incluir actors que o usuário **possa representar** ou exigir **permissão institucional explícita**. **Nunca tenant-wide por capability default de company.**
- **Suppliers** → `COMPANY_INTERNAL`. `created_by_actor_id` é **autoria histórica, não ownership atual** (imutável, escrito só no INSERT). O schema atual **não possui ownership empresarial canônico suficiente**. Qualquer implementação futura deve **definir owner company/actor antes do hardening**. **Não inventar gate usando o creator.**
- **Contacts** → `PERSONAL_SENSITIVE`/`COMPANY_INTERNAL` conforme o futuro domínio CRM. **A tabela NÃO existe no banco vivo** (`to_regclass('public.contacts')` = NULL; só `migrations_archive/0065_contacts.sql`, não aplicada; 6 consumidores vivos → `42P01`). **Não restaurar a migration arquivada. Não materializar antes de decisão específica** sobre existência, finalidade, consentimento e ownership. **Não bloqueia C1 enquanto permanecer ausente/fail-closed.**
- **Daily-metrics** → `INSTITUTIONAL_ADMIN`. Não é rota de usuário comum nem de company comum. Como está **sem gate, sem caller conhecido e com schema divergente** (2 queries referenciam colunas fantasmas → `42703`), deve **permanecer inativa ou receber tombstone 501** até existir autoridade institucional verdadeira. Tombstone × implementação = frente posterior; **não corrigir agora**.
- **Purchase-orders** → `COMPANY_INTERNAL`. Preço comercial em cents (`unit/total_price_cents`, §5.9.1 não-SSOT) **não** transforma o reader em Bank/M. **Não pode permanecer tenant-wide.** Ownership empresarial ainda deve ser materializado/provado.
- **Escrow** → `MONEY_PARTIES`. Só partes reais resolvidas pelo recurso/contrato (`escrow_accounts.buyer_actor_id`/`seller_actor_id`; partes do `agreement`) + autoridade financeira. **Frente financeira separada, três paralelas.** **Não bloqueia o G10** por `DECISION-0115 D5`.
- **Finance-agenda/cashflow** → ações planejadas e projeções operacionais = `COMPANY_INTERNAL`; qualquer efeito financeiro real = `MONEY_PARTIES`. **Projeção não é saldo e não substitui o Bank.**

### 2.4 Limites desta DECISION (o que ela NÃO faz)

Não altera código/runtime · não cria migration · não toca banco/frontend · não materializa `contacts` · não inventa coluna de ownership · não implementa gate algum · não libera C1/tenant compartilhado · não libera R2 · não libera FASE 6 · não declara `DECISION-0113` fechada · não declara o denominador global fechado · não vira implementação automática. Apenas **promulga as classes e o mapeamento** para orientar as próximas fatias.

## 3. Consequências / trilho

- **DT-mãe** `DT-SHARED-TENANT-RESOURCE-VISIBILITY-NO-OWNERSHIP-POLICY` registrada **OPEN** (raiz irmã de `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`; governada por `DECISION-0115 D1`; mecanismo `DECISION-0113`; classificação `DECISION-0116`).
- **Mapa de denominador** `docs/02_decisions/MAPA_DENOMINADOR_TENANT_SHARED_ISOLATION.md` registrado com cobertura **honesta** (AUDITADO/PARCIAL/NÃO-AUDITADO/INCONCLUSIVO/FECHADO-NO-CLUSTER). **Proibido** declarar o denominador global fechado enquanto houver módulo NÃO-AUDITADO/INCONCLUSIVO.
- **Próxima fatia de código recomendada (independe da 0116):** `GET /groups/mine` — usa `req.actionContext.actorId` como se fosse `users.user_id` (canal-1 spoofável + type confusion), sem representabilidade, com caller frontend vivo; caminho correto = `req.user.userId`. É bug de `DECISION-0113`, não toca Bank, não exige migration. GO próprio.
- **Hardening por classe** (suppliers/inventory/PO/…) só **após** a classe promulgada e com o denominador Classe-A enumerado; cada fatia com E2E fail-first + gate de regressão + Yala reseal.
- **MONEY_PARTIES** (escrow/finance-agenda) seguem em **frente financeira própria** (três paralelas), fora do corte de isolamento; `DECISION-0115 D5` exclui evento econômico do G10.

## 4. Critério de convergência (denominador FECHADO)

1. Enumerar o conjunto **finito** de readers de repositório que (a) retornam recursos identificáveis por owner/actor/company/member e (b) usam **só `tenant_id`** como escopo.
2. Classificar cada reader pelas classes de §2.2.
3. Corrigir cada **Classe A** aplicável (escopar por owner/membro/representável, sujeito = `req.user`).
4. Registrar as rotas públicas, inativas, fantasmas e financeiras (não confundir com leak).
5. Instalar **gate de regressão** contra novos readers tenant-only de recursos privados.
6. Obter **reseal adversarial** (Yala).
7. Só então considerar C1 liberável no eixo de isolamento.

## 5. Referências

`docs/02_decisions/DECISION_0116_INTRA_TENANT_OWNERSHIP_VISIBILITY_POLICY.md`; HEAD âncora `3d8ad25b`; consolidação das 6 especialistas (memórias `docs/memorias/MINHA_MEMORIA_{ACTOR_USERS,BANCO_DE_DADOS,DINHEIRO,DECISOES,DT,DOCUMENTOS}.md`, blocos 2026-06-10); `20260516100000_rls_critical_tables.sql`; `supplier.repository.ts`, `contact.repository.ts` (+ `to_regclass` NULL), `inventory-movement.repository.ts`, `daily-metrics.service.ts`, `escrow.repository.ts`/`escrow_transactions` migration, `financial-agenda.service.ts`, `groups.routes.ts`; `DECISION-0113`/`0115`/`0021`/`0030`/`0099`/`0100`/`0110`/`0111`/`0094`; `CONSTITUICAO_UNIFICARD` (Art. I); Lei 5; `SSOT_REGISTRY §5.9.1`.

---

## ADENDO A1 — Inventory consolidado da empresa (2026-06-10, decisor Clayton)

**Frente:** `F-INVENTORY-COMPANY-CONSOLIDATED-AUTHORITY-IMPL` · **HEAD origem:** `7c76cfb5` · **Não reabre as classes de §2.2** — aplica e detalha o mapeamento de inventory.

1. **Inventory material continua `ACTOR_PRIVATE` por actor.** `inventory_movements.actor_id` segue sendo o owner operacional material. A rota por actor (`/inventory/balance/by-actor`, gate `canRepresentActor`) permanece o caminho do detalhe.
2. **O consolidado empresarial é projeção `COMPANY_INTERNAL`** — rota dedicada `GET /marketplace/inventory/company/:companyId/balance`. Não substitui as rotas por actor; não transforma inventory em tenant-wide.
3. **Quem vê a projeção:** (a) administrador geral da empresa (`can_manage_company=true` ou `role='owner'`, mesma semântica de `canManageCompany`); OU (b) membro ATIVO com a permissão específica `company_users.can_view_consolidated_inventory=true`. Ambos exigem vínculo ativo (`is_active=true AND member_status='active'`).
4. **O conjunto de actors é resolvido server-side** por `actors.company_id = :companyId` (vínculo empresarial material — Decisão 2 de Clayton).
5. **O cliente NUNCA fornece a lista de actors.** Presença de `actorId`/`actorIds` na query do consolidado → 400 explícito.
6. **`can_manage_marketplace` NÃO é autoridade de consolidado** (capability default de toda company — não diferencia A de B).
7. **Mesmo tenant NÃO concede acesso** (a coincidência tenant≈pessoa está colapsando — 0115 D1).
8. **`actors.company_id` é o vínculo empresarial material** usado na projeção E na elegibilidade de unidade de estoque (`assertInventoryUnitActorEligible` reconhece `company_id IS NOT NULL`; vocabulário legado `actor_type='company'` preservado sem regressão).
9. **`actor_type='page'` isoladamente NÃO é critério suficiente** — páginas de grupo/evento sem `company_id` continuam inelegíveis.
10. **A nova projeção não substitui as rotas por actor** (Nível 1 `ACTOR_PRIVATE` intacto, gate `canRepresentActor`).
11. **As rotas tenant-wide legadas continuam BLOQUEADORAS** (`/inventory/balance` e `/inventory/movements` sem actorId — `DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE` OPEN) e serão reconciliadas em fatia posterior (migrar callers + tombstone/reconciliar). Permanecem no denominador Classe A.

> **ATUALIZAÇÃO item 11 (2026-06-11, frente `F-INVENTORY-LEGACY-READERS-RECONCILIATION-IMPL-PARTIAL`, DEC-A):** as 2 rotas NOMEADAS foram reconciliadas — `/inventory/balance` virou **tombstone 501** (`INVENTORY_TENANT_WIDE_BALANCE_DISABLED`) e `/inventory/movements` passou a **exigir actorId** (400 `INVENTORY_ACTOR_ID_REQUIRED` + canRepresentActor); a aba pública "Estoque" foi removida e os callers migraram para contratos escopados; gate `validate:inventory-reader-scope` impede regressão; `DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE` **CLOSED**. **PORÉM o galho inventory NÃO está fechado:** a enumeração HARD STOP descobriu readers tenant-wide ADICIONAIS fora do escopo desta fatia — `GET /marketplace/products/visible` (LIVE, estoque agregado), `/admin/metrics/reconciliation/*` (LIVE sub-gated, cross-tenant), `/reports/inventory*` (stub-dead FASE 6) — cada um com DT própria OPEN. Inventory permanece **PARCIAL** no MAPA, **NÃO** sai do denominador Classe A, **NÃO** libera C1/tenant compartilhado. Ver `ADENDO A2` no `REMEDIATION_DECISIONS_LOG.md`.
12. **Esta fatia NÃO libera C1/tenant compartilhado.** A concessão da permissão é writer dedicado admin-gated (`PUT /companies/:companyId/users/:companyUserId/consolidated-inventory-permission`, gate `canManageCompany` do caller). Sem R2/`actor_delegations`; sem FASE 6/RBAC stub. UI de gestão da permissão = fatia futura.

> **CORREÇÃO DE HONESTIDADE (2026-06-10, frente `F-COMPANY-USERS-SELF-UPDATE-AUTHORITY-ESCALATION-CLOSURE`):** a redação original do item 12 dizia que a auto-concessão estava "vedada por desenho" porque o campo novo ficou fora do PUT self-scoped de membro. **Isso era parcialmente enganoso e foi corrigido.** O *writer específico* da flag nova (`setConsolidatedInventoryPermission`) já era admin-gated — verdade. **Mas existia uma rota genérica preexistente** (`PUT /companies/:companyId/users/:companyUserId`) que, sendo self-scoped (`WHERE global_user_id = caller`), **aceitava campos de autoridade** (`role`, `permissions.canManageCompany`, `canManageFinancial`, `canManageEmployees`, `canManageServices`, `canViewReports`, `isActive`, `isPrimary`). Logo, **um membro comum podia se auto-promover a `can_manage_company=true` por essa rota e, com isso, passar a satisfazer `canViewConsolidatedInventory`** — autoelevação real, provada por HTTP (PUT → 200, banco alterado, consolidado → 200). A Yala deu PASS BLOQUEADO à fatia de inventory por causa dessa rota. A frente de fechamento corrigiu a **causa-raiz**: o PUT self-scoped passou a ter **allowlist explícita** (só `roleDescription`, campo não-autoritativo); qualquer campo de autoridade/estrutura → **403 observável**; o método mass-assignment `updateCompanyUser` foi **removido**. Após a correção: **nenhum campo de autoridade é self-editable**; toda mudança de autoridade usa writers administrativos gateados (`PUT /members/:memberId` via `requireCompanyManage`; `setConsolidatedInventoryPermission`). O risco existiu e foi fechado — não foi reescrito para fingir que nunca existiu.
