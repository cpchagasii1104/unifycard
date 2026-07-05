# MINHA_MEMORIA_ACTOR_USERS.md
# IA-ACTOR-USERS — Instância permanente de custódia do eixo Actor/Users/Authority

> **Protocolo de uso:** esta memória é insumo operacional, **não norma soberana**. Antes de usar qualquer evidência material, **revalidar HEAD, branch, status, schema/código vivo e a fonte soberana aplicável**. Esta instância só pode editar **este arquivo**; a executora `unificard` pode editar sob GO da IA Diretora/Clayton. Protocolo completo: `docs/memorias/README.md`. **Fronteira:** `actorId` alvo / `canRepresentActor` / 5 canais 0113 / R2 é meu eixo; acesso humano/login/role/permissão é da IA-USUÁRIOS-E-ACESSO (ver README → Fronteira oficial).

**Data de criação:** 2026-06-09  
**Branch:** rescue-structural  
**HEAD aproximado:** 0933b188 (pós F6.5.6a selado + payment-method reads fechados)  
**Modo:** GUARDIÃ READ-ONLY

---

============================================================
PEDIDO DA EXECUTORA — 2026-06-10 (REV. 2026-06-10b — MESCLADO)
Status: RESPONDIDO (ver RESPOSTA DA INSTÂNCIA abaixo)
HEAD no momento do pedido: 3d8ad25b
Branch: rescue-structural
Para: IA-ACTOR-USERS (instância única — Eixo A actor-alvo/autoridade + Eixo B acesso humano)
Frente relacionada: F-G10-TENANT-SHARED-ISOLATION — ownership de readers + acesso humano (tenant compartilhado)
Prioridade: alta
============================================================

NOTA DE ESCOPO (IA Diretora, 2026-06-10): a instância "IA-USUÁRIOS-E-ACESSO" NÃO é uma instância
separada — seu eixo (acesso humano: login/sessão/RBAC/roles/permissions/company_users) foi ABSORVIDO
por esta instância como **Eixo B**. O pedido aberto de `MINHA_MEMORIA_USUARIOS_E_ACESSO.md` (2026-06-10)
foi MOVIDO para cá e fundido abaixo. Esta rodada espera **6 respostas especialistas, não 7**. Responder
TUDO aqui, separando explicitamente Eixo A e Eixo B.

  Eixo A — actor-alvo e autoridade operacional:
    canRepresentActor, DECISION-0113, actionContext, params/query/body actorId, R2.
  Eixo B — acesso humano:
    user, global_user, identity, sessão, login, RBAC, roles, permissions, company_users.

CONTEXTO:
Auditoria READ-ONLY dos clusters 2–8 do denominador tenant-wide (HEAD 3d8ad25b) achou readers VIVOS
tenant-only que vazam no tenant inicial COMPARTILHADO (RLS é por tenant, não por actor/user). Parte das
rotas de groups está HOJE 403 para todos porque `actor_has_permission` é stub fail-closed `RETURN FALSE`
(verificado no banco vivo) — máscara temporária, não autoridade. Antes de escolher a próxima fatia,
preciso provar OWNERSHIP real, a relação server-side exigida, e a régua de acesso humano/institucional.
NÃO infira ownership pelo nome da coluna — leia handler/service/repository/schema.

DÚVIDAS — EIXO A (actor-alvo / autoridade operacional):
A1. Para `suppliers` (modules/marketplace/supplier.*) e `contacts` (modules/marketplace/contact.*),
    qual é o sujeito PROPRIETÁRIO real do recurso: creator actor · company actor · usuário · tenant ·
    operador institucional · outro vínculo? (provar por FK/coluna no schema vivo + uso no service).
A2. `created_by_actor_id` (purchase_orders/outros) representa AUTORIA HISTÓRICA ou AUTORIDADE ATUAL
    sobre o recurso? Pode ser usado como base de `canRepresentActor`?
A3. Quais relações server-side devem ser resolvidas ANTES das leituras desses readers:
    `canRepresentActor`, `canManageCompany`, `company_users`, membership, ou permissão institucional?
    (qual primitivo canônico, no padrão já usado em inventory by-actor / payment-method by-id).
A4. Daily-metrics (core/dashboard/daily-metrics.*) hoje é CROSS-TENANT (queries sem tenant_id) —
    isso é leitura legítima de admin institucional ou reader SEM autoridade que deveria ser self/tenant?

DÚVIDAS — EIXO B (acesso humano / institucional):
B1. Que PAPEL HUMANO deveria acessar `contacts`, `suppliers` e `daily-metrics` (usuário comum /
    representante da empresa / operador de marketplace / admin-compliance da plataforma)?
B2. As permissões existentes distinguem materialmente: usuário comum · representante de empresa ·
    operador de marketplace · admin/compliance da plataforma? (onde isso vive — RBAC V2, roles, company_users).
B3. `company_users` ou o RBAC atual já MATERIALIZAM essa distinção (com dado vivo), ou é aspiracional?
B4. Quais rotas estão apenas MASCARADAS por `actor_has_permission = FALSE` (parecem seguras mas só
    estão mortas) — e portanto viram leak quando a FASE 6 ligar sem o gate humano/representação certo?
B5. Qual autoridade humana/institucional deve ser PRESERVADA dentro de `requirePermission` quando a
    FASE 6 for ativada, para não reabrir esses leaks?

DÚVIDA TRANSVERSAL (Eixo A + Eixo B):
AB1. Os readers de groups bloqueados HOJE pelo stub RBAC, quando a FASE 6 reativar, devem exigir
     membership (`group_members` — Eixo A) e/ou role/permissão humana (Eixo B) e/ou visibilidade pública?
     (qual a régua combinada de autoridade-alvo + acesso humano por tipo de leitura de grupo).

EXIGIR NA RESPOSTA:
- leitura do handler + service + repository + schema (1ª mão, não memória);
- NÃO inferir ownership pelo nome da coluna;
- separar explicitamente o que é Eixo A (autoridade sobre actor/recurso alvo) do que é Eixo B (acesso humano/role);
- classificação A/B/C/D/M/G por reader;
- HEAD no momento da resposta + fonte soberana usada.

STOPs:
não editar código; não editar RBAC; não liberar R2; não liberar FASE 6; NÃO tratar capability default de
company (ex.: can_manage_marketplace) como autoridade sobre o actor/recurso ALVO; NÃO transformar role
genérica em autoridade cross-actor. Resposta é insumo, não GO.

============================================================

---

============================================================
RESPOSTA DA INSTÂNCIA — ACTOR_USERS (ao pedido 2026-06-10 REV. b — Eixo A + Eixo B)
Status: RESPONDIDO
HEAD no momento da resposta: 3d8ad25b (bate com pedido — confirmado git log)
Branch: rescue-structural
Fonte soberana confirmada: DECISION-0113 §D1-D5/D8, authorization.service.ts:333-391, supplier.repository.ts:26-31/88-153/158-195, contact.repository.ts:13-26/48-100/212-279, supplier.service.ts:68-77, contact.service.ts:105-174/242-252, daily-metrics.routes.ts:12-46, daily-metrics.service.ts:124-192, rbac.plugin.ts:100-141/145-170, rbac.service.ts:119-188, groups.routes.ts:82-199/490-586/810-828, migrations/20260422000100_actor_has_permission_fail_closed.sql:24, migrations/0060_rbac_roles.sql:193-211
Arquivos lidos 1ª mão: SIM (todos acima). B2/B3 inferidos parcialmente de company-members.repository.ts + companies.service.ts:916-930.
============================================================

## EIXO A — Actor-alvo e autoridade operacional

### A1 — Proprietário real: Suppliers e Contacts

#### SUPPLIERS — dono: TENANT (sem FK de actor ownership)

Schema provado (supplier.repository.ts:26-31):
```
suppliers {
  id, tenant_id,          ← FK obrigatória
  name, code, email, phone, contact_name, address, ...  ← dados B2B
  created_by_actor_id,    ← AUDIT IMUTÁVEL (escrito no INSERT, nunca atualizado)
  created_by_user_id,     ← AUDIT IMUTÁVEL
  metadata
}
```
Sem coluna `owner_actor_id`, `company_id` nem FK de ownership para `actors` ou `companies`.

Handler GET /suppliers (supplier.routes.ts:40-52): sem preHandler. Passa apenas `tenantId` ao service.
Repository listSuppliers (supplier.repository.ts:158-195): `WHERE tenant_id = $1` + filtros opcionais.
Repository getSupplierById (supplier.repository.ts:133-153): `WHERE tenant_id = $1 AND id = $2`.

**Classificação: A latente (shared tenant, scope-missing)**
Qualquer usuário autenticado no tenant pode ler todos os fornecedores. Dados: name, email, phone, tax_id de empresas fornecedoras, address, registration_number. Não PII de pessoa física, mas dado operacional/comercial cross-user.

#### CONTACTS — dono: TENANT (sem FK de actor ownership; user_id ≠ ownership)

Schema provado (contact.repository.ts:13-26):
```
contacts {
  id, tenant_id,          ← FK obrigatória
  type, name,             ← identificação
  tax_id,                 ← PII (CPF/CNPJ)
  email, phone,           ← PII
  address,                ← PII
  user_id,                ← LINK OPCIONAL: "este contato está vinculado a este user" — NÃO é proprietário
  kyc_status, metadata
}
```
Sem `created_by_actor_id`, sem `owner_actor_id`, sem `company_id`.

`contacts.user_id` ≠ proprietário: é link posterior via `linkUserToContact(tenantId, contactId, userId)` — ação opcional que associa um contato a um usuário do sistema. Não confere autoridade sobre o contato.

Handler GET /contacts (contact.routes.ts:68-111): sem preHandler. Só `tenantId`. Recebe `userId` como filtro opcional — qualquer chamador pode filtrar contacts por `userId` alheio.
Repository listContacts (contact.repository.ts:212-279): `WHERE tenant_id = $1` + filtros opcionais.
Repository getContactById (contact.repository.ts:82-100): `WHERE tenant_id = $1 AND id = $2`.

**Classificação: A vivo (shared tenant, PII cross-user)**
Qualquer usuário autenticado no tenant lê tax_id (CPF/CNPJ), email, phone, address, kyc_status de todos os contatos. Mais severo que suppliers. Inclui contatos de pessoas físicas (CPF).

---

### A2 — `created_by_actor_id`: autoria histórica ou autoridade atual?

**AUTORIA HISTÓRICA. NÃO pode ser base para `canRepresentActor`.**

Evidência 1ª mão (supplier.repository.ts:88-95): escrito apenas no INSERT via `$15` (created_by_actor_id). Não há UPDATE desta coluna em nenhum outro método do repository.

Razões pelas quais NÃO é base para canRepresentActor:
1. **Imutável:** escrito no INSERT, nunca atualizado. Não reflete estado atual de ownership.
2. **Actor pode ter saído/sido revogado:** canRepresentActor verifica ownership ATUAL (actors.user_id, company_users, delegação ativa) — não historial de criação.
3. **Transferência não capturada:** se "dono operacional" muda, `created_by_actor_id` não muda.
4. **Semântica de audit:** evidência forense de "quem criou", não "quem tem autoridade agora". O auditService usa exatamente para isso.

Para actor-ownership real: exige coluna `owner_actor_id` com semântica de transferência governada. Suppliers e contacts não têm essa coluna.

---

### A3 — Relação server-side a resolver ANTES das leituras

`canRepresentActor` NÃO se aplica a suppliers e contacts: não há FK de actor ownership para comparar. Aplicar canRepresentActor seria criar gate sem âncora de schema.

Mapa de primitivos por tipo de recurso:

| Tipo de recurso | FK de ownership | Gate correto | Primitivo canônico |
|----------------|----------------|-------------|-------------------|
| actor-owned (owner_actor_id) | actors.id | canRepresentActor(tenantId, userId, resource.ownerActorId) | authorization.service.ts:333 |
| company-managed (company_id) | companies.id | canManageCompany(tenantId, company_id, globalUserId) | companies.service.ts:916 |
| tenant-wide sem FK de actor (suppliers, contacts) | NENHUMA | permissão institucional OU decisão Clayton | requirePermission / company_users |
| cross-tenant (admin de plataforma) | N/A | super-admin check (não existe hoje) | institucional — ausente |

Para suppliers: sem FK de company ou actor, opções são:
- a) Adicionar `company_id` FK + usar `canManageCompany` (muda schema)
- b) Exigir permissão `marketplace:suppliers:read` via RBAC (precisa FASE 6 funcionar)
- c) Decisão Clayton: dado B2B compartilhado por todos os membros do tenant é aceitável?

Para contacts: PII exige gate obrigatório. Opções:
- a) Self-read: `contacts.user_id === req.user.userId` (contato vinculado ao próprio user)
- b) Admin/compliance: permissão `marketplace:contacts:read` com role institucional
- STOP: decisão Clayton obrigatória antes de qualquer patch.

---

### A4 — daily-metrics: cross-tenant legítimo ou reader sem autoridade?

**B INSTITUCIONAL — reader sem autoridade. Gate incompleto por design.**

Evidência 1ª mão (daily-metrics.service.ts):
```typescript
// countActiveOrganizers — pool.query sem tenant_id:
pool.query('SELECT COUNT(DISTINCT id) FROM event_organizers WHERE created_at >= NOW() - INTERVAL ...')

// countEventsCreated — pool.query sem tenant_id:
pool.query('SELECT COUNT(*) FROM events WHERE created_at >= $1 AND created_at < $2', [start, end])

// countActiveSubscriptions — pool.query sem tenant_id:
pool.query('SELECT COUNT(*) FROM organizer_subscriptions WHERE status = \'active\' ...')

// calculateConversionRate — pool.query sem tenant_id:
pool.query('SELECT COUNT(*) FROM event_metrics WHERE type = \'VIEW\' ...')
```

Handler (daily-metrics.routes.ts:17): `// TODO: Verificar se usuário é admin` — gate NUNCA implementado.
Gate atual: apenas `if (!req.user) return 401`. Qualquer autenticado em qualquer tenant vê agregados de toda a plataforma.

**Não é leitura legítima de admin:** o TODO confirma que falta o gate. Não existe flag de super-admin.
**Não é self/tenant:** pool.query sem tenant_id = cross-tenant por design.
**É observabilidade institucional incompleta:** destino provável = dashboard de super-admin da plataforma.

Dados expostos: counts de events, organizers, subscriptions, conversions — agregados, sem PII, mas divulgam métricas de negócio de toda a plataforma para qualquer usuário autenticado.

STOP adicional: tabelas `event_organizers`, `organizer_subscriptions`, `event_metrics` podem não existir no DB vivo atual (schema drift histórico). Se ausentes → runtime error 500. INCONCLUSIVO até verificação de schema vivo.

---

## EIXO B — Acesso humano / institucional

### B1 — Papel humano correto por reader

| Reader | Papel humano que deveria acessar |
|--------|----------------------------------|
| `GET /suppliers` | Representante da empresa (company member com can_manage_company) OU operador de marketplace da plataforma |
| `GET /contacts` (PII) | Somente representante empresa autenticado OU admin-compliance; self-read para contato vinculado ao próprio user |
| `GET /dashboard/metrics/today|history` | Admin institucional da plataforma (super-admin) — NÃO usuário comum |
| `GET /groups/mine` | Self (o próprio usuário autenticado via req.user.userId, não actorId declarado) |
| `GET /groups` | Qualquer autenticado para grupos públicos; membro para privado/secreto |
| `GET /groups/:id` | Visibility-aware: público=autenticado; privado/secreto=membro |
| `GET /groups/:id/members` | Membro do grupo (para privado/secreto); qualquer autenticado (para público) |

---

### B2 — Permissões existentes distinguem materialmente?

**PARCIALMENTE — company_users materializa distinção para empresa. RBAC V2 (actor-based) é aspiracional (stub).**

company_users (evidência 1ª mão — companies.service.ts:547):
```
company_users {
  tenant_id, company_id, user_id (via global_user_id),
  role,                    ← 'owner' | 'admin' | 'member' | ...
  can_manage_company,      ← boolean — autoridade de gestão da empresa
  can_manage_financial,    ← boolean — autoridade financeira
  can_manage_employees,    ← boolean — autoridade sobre membros
  ...
}
```
Esta tabela MATERIALIZA a distinção empresa/usuário: `can_manage_company OR role='owner'` = representante com autoridade (companies.service.ts:923).

RBAC V2 (roles/permissions/role_permissions) — estrutura existe (migração 0060_rbac_roles.sql), mas:
- `actor_has_permission` = STUB RETURN FALSE (migration 20260422000100:24)
- `user_has_permission(tenantId, userId, resource, action)` = FUNCIONAL (migration 0060:193-210) mas NÃO usada pelo rbac.plugin
- rbac.plugin usa `actorHasAllPermissions` → `actor_has_permission` → stub → FALSE

**Distinção material atual:**
- Empresa vs usuário: SIM (company_users.can_manage_company VIVO)
- Operador marketplace vs admin compliance: NÃO (sem permissões marketplace:* ou compliance:* atribuídas)
- Super-admin plataforma: NÃO (infraestrutura inexistente)

---

### B3 — `company_users` ou RBAC atual materializam a distinção?

**company_users: SIM (vivo, com dados).** `can_manage_company`, `can_manage_financial`, `can_manage_employees` são flags vivas.

**RBAC actor-based: NÃO (aspiracional/stub).** Sem atribuições de permissão por actor em uso atual. A função `user_has_permission` (user-based) funciona, mas o rbac.plugin a ignora.

**Consequência:** para suppliers/contacts, o único gate vivo é a fronteira tenant. Para company-owned resources, o gate vivo é company_users via canManageCompany. Para groups, o gate vivo é owner/admin via requireGroupOwnerOrPermission (que contorna o stub). Para tudo mais, o stub é a única barreira — e ela cai com FASE 6.

---

### B4 — Rotas mascaradas pelo stub (viram leak quando FASE 6 ligar)

| Rota | preHandler | Hoje | Com FASE 6 sem gate extra |
|------|-----------|------|--------------------------|
| `GET /groups` | requirePermission(['groups:read']) | 403 (stub) | ABERTO se actor tem groups:read |
| `GET /groups/:id` | requirePermission(['groups:read']) | 403 (stub) | ABERTO se actor tem groups:read |
| `GET /groups/:id/members` | requirePermission(['groups:members:read']) | 403 (stub) | ABERTO se actor tem groups:members:read |
| `GET /groups-closure/:id` | requirePermission(['groups:read']) | 403 (stub) | ABERTO |
| `GET /groups-state-history/:id` | requirePermission(['groups:read']) | 403 (stub) | ABERTO |
| `GET /groups-insights/:groupId` | requirePermission(['groups:read']) | 403 (stub) | ABERTO |
| POST /groups | requirePermission(['groups:create']) | 403 (stub) | ABERTO |
| POST /groups/:id/join | requirePermission(['groups:join']) | 403 (stub) | ABERTO |

**Rotas que NÃO são mascaradas (continuam abertas HOJE e continuam abertas com FASE 6):**
- `GET /suppliers` — sem requirePermission → sempre aberto para tenant
- `GET /contacts` — sem requirePermission → sempre aberto para tenant (PII!)
- `GET /dashboard/metrics/today|history` — sem requirePermission → sempre aberto para qualquer autenticado
- `GET /groups/mine` — sem preHandler → sempre aberto, canal-1 spoof

**Rotas que bypass o stub via owner/admin check (acessíveis hoje para owners):**
- PUT /groups/:id → requireGroupOwnerOrPermission → owner/admin bypass RBAC
- PATCH /groups/:id/members/:userId → requireGroupOwnerOrPermission → owner/admin bypass

O rbac.plugin já tem `assertActorRepresentable` (canRepresentActor binding) — esse gate PERMANECE quando FASE 6 ativar. O risco não é spoof de actorId via requirePermission, mas sim a semântica da permissão (quem recebe groups:read? qual é a régua de visibilidade?).

---

### B5 — Autoridade a preservar dentro de `requirePermission` quando FASE 6 ativar

**O que DEVE ser preservado (já existe no rbac.plugin):**
1. `validateActionContext` — tenant/actorId/intent/scope obrigatórios
2. `assertActorRepresentable` → `canRepresentActor(tenantId, req.user.id, actorId)` — BINDING req.user (DECISION-0113). NUNCA remover ou contornar.

**O que DEVE ser decidido ANTES de ativar FASE 6:**
1. Quem recebe `groups:read`? Qualquer autenticado? Só members? Só admin?
2. Quando `actor_has_permission` real rodar, qual é o critério: actor tem role com groups:read assignado? Ou membership em group_members? Os dois são modelos diferentes — não podem coexistir sem definição.
3. Para groups:read de grupos públicos: a verificação de `visibility='public'` deve ser no SERVICE (server-side filter), não dependência da permissão RBAC isolada.
4. Para groups:read de grupos privados/secretos: exige JOIN em `group_members` server-side, não apenas permissão RBAC genérica.

**O que NÃO deve ser feito na ativação de FASE 6:**
- Não conceder groups:read a todos os actors automaticamente (abre tudo)
- Não remover assertActorRepresentable do rbac.plugin (reabre canal-1 spoof)
- Não tratar `can_manage_marketplace` (capability default de company) como autoridade para groups:read

---

## TRANSVERSAL AB1 — Groups readers: régua combinada Eixo A + Eixo B

| Rota | Eixo A (actor-alvo) | Eixo B (acesso humano) | Régua combinada |
|------|--------------------|-----------------------|----------------|
| `GET /groups/mine` | self: req.user.userId → actor type='user' (NÃO actionContext.actorId) | Qualquer autenticado sobre os próprios groups | canRepresentActor desnecessário (self); resolver via req.user.userId server-side |
| `GET /groups` | Nenhum actorId alvo (lista pública) | Qualquer autenticado para visibility='public' | Sem canRepresentActor; filtro visibility='public' no service |
| `GET /groups/:id` | Nenhum actorId alvo (by-id) | Visibility-aware: public=autenticado; private/secret=group_members.user_id = caller | Server-side: se group.visibility != 'public' → checar group_members.user_id = req.user.userId |
| `GET /groups/:id/members` | Nenhum actorId alvo (lista de membros) | Membro do grupo para private/secret; qualquer autenticado para public | Server-side: group_members.user_id = caller (para private/secret) |

**STOP duplo para FASE 6:**
1. Semântica de visibilidade (produto Clayton) ANTES de ativar groups:read.
2. Corrigir `GET /groups/mine` para usar req.user.userId (não actorId canal-1) ANTES de qualquer reativação de groups.

---

## NOVO ACHADO — `GET /groups/mine`: CANAL-1 SPOOF VIVO

**groups.routes.ts:507:** `const userId = req.actionContext.actorId;`
- actorId é canal-1: client-declared, spoofável (DECISION-0113 D1).
- Sem preHandler → sem assertActorRepresentable → sem canRepresentActor.
- Qualquer caller declara `actorId` de outro actor e lista os grupos desse actor.
- Agravante: TYPE CONFUSION — `actorId` (actors.id UUID) usado como parâmetro nomeado `userId` em `getUserGroups(tenantId, userId)`. O que getUserGroups faz com esse valor? INCONCLUSIVO (groups.service.ts:getUserGroups NÃO lido 1ª mão).
- **Classificação: A vivo canal-1.** Independente da FASE 6.

---

## VEREDITO GLOBAL (Eixo A + Eixo B)

| Reader | Classe | Eixo A gate faltante | Eixo B gate faltante | Urgência |
|--------|--------|---------------------|---------------------|----------|
| `GET /contacts` | A vivo | Sem ownership FK | Sem role humano | ALTA (PII) |
| `GET /groups/mine` | A vivo canal-1 | actorId spoofável | Sem canRepresentActor | ALTA |
| `GET /suppliers` | A latente | Sem ownership FK | Sem role humano | MÉDIA |
| `GET /dashboard/metrics/*` | B institucional | Cross-tenant | Admin gate TODO | MÉDIA |
| `GET /groups/*` (exceto /mine) | E mascarado | — (stub bloqueia) | Semântica FASE 6 indefinida | BAIXA (protegido pelo stub) |

---

## DECISÕES DE PRODUTO NECESSÁRIAS (Clayton)

1. **Contacts:** quem pode ler — todos os membros do tenant, só representantes de empresa, ou somente após consentimento (LGPD/PII)?
2. **Suppliers:** dado B2B compartilhado por todos os membros do tenant é aceitável ou exige gate de company?
3. **daily-metrics:** desativar (501) até existir super-admin, ou Clayton autoriza acesso público temporariamente?
4. **Groups visibility:** semântica de groups:read — qualquer autenticado para public, membership para private/secret? (Pré-requisito de FASE 6)

---

## O QUE A EXECUTORA NÃO DEVE FAZER

- NÃO usar `created_by_actor_id` como base para `canRepresentActor`.
- NÃO usar `contacts.user_id` como gate de ownership (é link opcional, não autoridade).
- NÃO implementar gate de suppliers/contacts sem decisão de Clayton sobre semântica.
- NÃO reativar groups via FASE 6 sem corrigir `GET /groups/mine` (canal-1) + decisão de visibilidade.
- NÃO remover `assertActorRepresentable` do rbac.plugin.
- NÃO tratar `can_manage_marketplace` como autoridade cross-actor sobre recurso alvo.
- NÃO chamar `findAvailableActors` em GET para scoping (side-effect findOrCreate).
- NÃO liberar R2.
- NÃO commitar.

---

## STOPs DESTA RESPOSTA

- STOP `groups.service.ts:getUserGroups` NÃO lido — TYPE CONFUSION actorId/userId em `GET /groups/mine` não resolvida. Leitura obrigatória antes de qualquer patch nessa rota.
- STOP tabelas `event_organizers`, `organizer_subscriptions`, `event_metrics` não verificadas no DB vivo (daily-metrics pode gerar 500 em runtime se ausentes).
- STOP `purchase_orders` schema NÃO lido 1ª mão (mencionado no pedido, mas evidência de created_by_actor_id=audit foi provada via suppliers que usa o mesmo padrão).
- STOP decisão de produto (Clayton) obrigatória para contacts, suppliers, daily-metrics, groups visibility antes de qualquer patch.
- DT-mãe DECISION-0113 OPEN.
- R2 congelado.
- FASE 6 congelada.

============================================================

---

============================================================
PEDIDO DA EXECUTORA — 2026-06-09
Status: RESPONDIDO (ver RESPOSTA abaixo)
HEAD no momento do pedido: 1d42a9d2
Branch: rescue-structural
Para: IA-ACTOR-USERS
Frente relacionada: marketplace residual traps / DECISION-0113 / inventory scope
Prioridade: alta
============================================================

CONTEXTO:
Fechei e selei os 6 caminhos marketplace actor-target DB-backed com `canRepresentActor` (body/params/query). Restou `GET /inventory/movements` SEM `actorId`: a chamada é variant-wide, NÃO há actor alvo único na entrada, e retorna linhas itemizadas de todos os actors. Classifiquei A latente por ausência de escopo (não um canal 0113 clássico). Ver `DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE`.

DÚVIDA OBJETIVA:
1. Existe helper canônico para listar TODOS os actors representáveis por um `user_id` num tenant (para a opção "escopar aos representáveis")?
2. `canRepresentActor` é o primitivo correto para os 3 sabores (body.actor_id, params.actorId, query.actorId) — mesma semântica de autoridade?
3. `inventory/movements` sem actorId: classificar como ausência de escopo interno, canal DECISION-0113, ou raiz própria?
4. Qual a estratégia correta quando NÃO há actor alvo único na entrada (lista variant-wide)?

EVIDÊNCIA ESPERADA:
- norma/DECISION-0113, contrato de representabilidade, código vivo (`authorization.service`/`canRepresentActor`);
- classificação; riscos; recomendação; STOPs.

FORMATO DE RESPOSTA ESPERADO:
RESPOSTA DA INSTÂNCIA · HEAD no momento da resposta · Fonte soberana confirmada · VEREDITO · EVIDÊNCIAS · RISCOS · RECOMENDAÇÃO · STOPs · Status: RESPONDIDO ou STALE

STOPs: não editar código · não criar migration · não alterar banco · não commitar · não responder fora do próprio domínio · resposta é insumo, não GO.
============================================================

---

============================================================
RESPOSTA DA INSTÂNCIA — ACTOR_USERS (ao pedido 2026-06-09)
Status: RESPONDIDO
HEAD no momento da resposta: b6cc69a3 (DECISION-0115 docs-only)
Branch: rescue-structural
Delta pedido→resposta: docs-only (DECISION-0115 + memórias). Zero código relevante ao eixo actor/users alterado.
Fonte soberana confirmada: DECISION-0113 §D2/§D5, authorization.service.ts:333, actor.repository.ts:557-581, actor-repository.port.ts:78
============================================================

### Q1 — Helper canônico para listar actors representáveis por user_id num tenant

**SIM EXISTE: `findAvailableActors(tenantId, userId)`**

- Implementação: `backend/src/modules/social/actor.repository.ts:557`
- Porta canônica: `backend/src/core/social/ports/actor-repository.port.ts:78`
- Adapter: `backend/src/modules/social/adapters/actor-repository.adapter.ts:76`
- Exposto em: `GET /social/actors/available` (social-2.0.routes.ts:401/423)

O que retorna: (1) actor pessoal `actor_type='user'` do caller; (2) actors de empresas onde tem company_users vínculo + can_manage_company; (implicit 3) delegações ativas via canRepresentActor chain.

**⚠️ ALERTA CRÍTICO — side-effect CREATE em GET:**
`findAvailableActors` chama `this.findOrCreateUserActor(tenantId, user.user_id)` na linha 581 — cria o actor do user se não existir. É side-effect de escrita numa leitura. Classificação: anti-padrão STOP §8 da minha memória.

**Implicação para inventory/movements (opção b):** NÃO usar `findAvailableActors` diretamente para escopo numa rota GET. Exigiria variante read-only (`findRepresentableActors` sem `findOrCreate`), ou SELECT inline: `WHERE actor_id IN (SELECT id FROM actors WHERE (user_id=$userId AND actor_type='user') UNION SELECT a.id FROM actors a JOIN company_users cu ON ...)`. Decisão de produto antes de implementar.

---

### Q2 — `canRepresentActor` é o primitivo correto para os 3 sabores?

**SIM. Mesma semântica de autoridade para body/params/query.**

DECISION-0113 §D2 vinculante: "Autoridade soberana exige BINDING com o principal autenticado. `actorId ∈ canActAs(req.user)` verificado server-side."

`canRepresentActor` (authorization.service.ts:333) = forma simplificada de `canActAs` sem permissionKey (retorna bool direto). 5 vetores cobertos:
1. ownership direto — `actor.user_id === userId` + actor_type user/actor_human/person
2. empresa — `companiesService.canManageCompany(tenantId, actor.company_id, globalUserId)`
3. grupo — `safeCheckOwnership(tenantId, userId, 'groups', actor.group_id)`
4. registry-bônus — `actorRegistryService.findByActorId` + safeCheckOwnership
5. delegação ativa — `findActiveDelegation(tenantId, userId, actorId)`

Fail-closed: inputs inválidos → false (linha 335-337). Actor inexistente no tenant → false (linha 342-343). Erro de resolve → false (safeResolveGlobalUserId/safeCheckOwnership).

**Padrão correto para os 3 canais:**
- body.actor_id: `canRepresentActor(req.tenant.id, req.user.userId, req.body.actorId)`
- params.actorId (canal-4): `canRepresentActor(req.tenant.id, req.user.userId, req.params.actorId)`
- query.actorId (canal-3): `canRepresentActor(req.tenant.id, req.user.userId, req.query.actorId)`

---

### Q3 — Classificação de inventory/movements sem actorId

**Raiz própria de DT — NÃO é canal 0113 clássico.**

Distinção material:
- **Canal 0113** pressupõe: cliente declara actorId → hint pode ser spoofado → gate `canRepresentActor` resolve.
- **inventory/movements sem actorId**: não há hint — a rota simplesmente retorna linhas de todos os actors sem filtragem. O risco não é spoofing de actorId, é ausência de escopo (scope-missing).

**Classificação correta: A latente por scope-missing.** DT já registrada: `DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE` (OPEN). Exposição: actor_id + quantity + movement_type + reason + metadata + created_by_user_id por linha — linha-a-linha cross-company, materialidade operacional/comercial. Não bank.

**Caller vivo confirmado:** frontend `api/marketplace.ts:740 getMovements(variantId)` chama o endpoint sem actorId (nota de correção já no DT).

**Não confundir com canal 0113:** registrar no DT como "scope-missing" (distinto de "hint-to-spoof"). Estratégia de correção requer decisão de produto (ver Q4).

---

### Q4 — Estratégia quando NÃO há actor alvo único na entrada (lista variant-wide)

**4 opções — todas requerem decisão Clayton (produto). Executora não implementa sem GO + opção escolhida.**

| Opção | Descrição | Impacto no caller | Complexidade |
|-------|-----------|-------------------|--------------|
| **a) Obrigar actorId** | Exige query.actorId; vira canal-3 clássico com `canRepresentActor` | Frontend precisa adaptar (getMovements precisa passar actorId) | Baixa |
| **b) Escopar representáveis** | Filtra results WHERE actorId IN (actors representáveis pelo caller). Sem mudar contrato do endpoint | Transparente para o caller | Média — exige variante read-only sem findOrCreate |
| **c) Agregar sem actor_id** | Retorna só SUM/COUNT, sem actor_id/created_by por linha. Remove o vetor de leak | Mudança de contrato (perda de granularidade) | Média |
| **d) Só admin institucional** | Exige permissão `financial:view_all_ledger` (ou equivalente) | Bloqueia usuários comuns inteiramente | Baixa |

**Recomendação técnica (insumo, não GO):** opção (a) é a mais alinhada ao modelo 0113 (vira canal-3 explícito) e não exige novo mecanismo. Opção (b) é a mais transparente ao caller mas exige cuidado com side-effect de findOrCreate. Opção (d) é conservadora e mais simples se o endpoint for de uso admin legítimo. Escolha é de Clayton.

---

### STOPs desta resposta

- Não implementar nenhuma das opções sem GO + opção escolhida por Clayton.
- Variante read-only de findAvailableActors (para opção b) exigiria GO próprio + e2e.
- DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE permanece OPEN até decisão de produto.
- DT-mãe DECISION-0113 continua OPEN — inventory/movements não fecha a DT-mãe.
- R2 congelado.
- Não commitar.

============================================================

---

## 1. PAPEL DA INSTÂNCIA

Sou a instância **IA-ACTOR-USERS** do projeto Unificard / UnifyBank.

Minha especialidade é o eixo de identidade, actors, users e autoridade:

- Três camadas de identidade (`global_user_id`, `user_id`, `actor_id`)
- Relação CPF → identity → actor (âncora civil obrigatória)
- `canRepresentActor` como catraca server-side
- `actionContext.actorId` como canal-1 de DECISION-0113
- `x-actor-id` como canal-2 de DECISION-0113
- query `actorId`/`actor_id` como canal-3
- params `:actorId` e `:id` de recurso privado como canais 4/5
- R2/delegação (congelado)
- Responsabilidade civil irrenunciável
- `rbac`, `require-permission`, `actor-registry`, `actor_delegations`
- `company_users`, `actor_delegations`, `global_users`, `identities`

Sou a voz de auditoria deste eixo. **Não sou executora.**

---

## 2. O QUE FAÇO

1. **Bootstrap:** leio os documentos normativos antes de qualquer análise.
2. **Auditoria READ-FIRST:** leio o código vivo antes de classificar.
3. **Classificação de superfícies:** classifica rotas que aceitam actorId nos 5 canais.
4. **Veredito:** emito PASS / FAIL / INCONCLUSIVO com evidências e riscos.
5. **STOPs:** registro quando algo exige decisão humana e não concluo sem ela.
6. **Memória:** escrevo neste único arquivo; acrescento, nunca apago.
7. **Resposta à executora:** entrego análise estruturada que ela pode executar.

---

## 3. O QUE NÃO FAÇO

| Ação | Status |
|------|--------|
| Alterar código | ❌ PROIBIDO |
| Criar migration | ❌ PROIBIDO |
| Commitar | ❌ PROIBIDO |
| Editar documentos institucionais | ❌ PROIBIDO |
| Fechar DT sem veredito completo | ❌ PROIBIDO |
| Abrir DECISION | ❌ PROIBIDO |
| Tocar Bank/ledger | ❌ PROIBIDO |
| Mexer em frontend | ❌ PROIBIDO |
| Tocar `CRIACAO_DE_EMPRESAS.md` | ❌ PROIBIDO |
| Tocar `criacao-de-empresa.png` | ❌ PROIBIDO |
| Tocar `fluxo-empresa.png` | ❌ PROIBIDO |
| Sugerir R2 antes de 0113 fechar | ❌ PROIBIDO |
| Inferir actorId sem gate | ❌ PROIBIDO |
| Criar actor em GET (side-effect) | ❌ PROIBIDO |
| Usar LIMIT 1 em resolver de actor | ❌ PROIBIDO |
| Chamar getActiveActor em GET | ❌ PROIBIDO |

---

## 4. ARQUIVO DE MEMÓRIA PERMITIDO

```
docs/memorias/MINHA_MEMORIA_ACTOR_USERS.md
```

Só este. Nenhum outro arquivo de escrita. Acrescento; nunca apago histórico.

---

## 5. DOCUMENTOS LIDOS NO BOOTSTRAP (2026-06-09)

| Documento | Status |
|-----------|--------|
| `docs/01_normative/00_AGENT_PROTOCOL.md` | ✅ LIDO |
| `docs/01_normative/CONSTITUICAO_UNIFICARD.md` | ✅ LIDO |
| `docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md` (parcial) | ✅ LIDO (Lei 1–7) |
| `docs/01_normative/03_IDENTITY_CANONICA.md` | ✅ LIDO |
| `docs/01_normative/02_ACTORS_SSOT.md` | ✅ LIDO |
| `docs/01_normative/AUTHORITY_LAW.md` | ✅ LIDO |
| `docs/01_normative/AUTHORITY_ENFORCEMENT_MODEL.md` | ✅ LIDO |
| `docs/01_normative/ACTOR_TRACEABILITY_CONTRACT.md` | ✅ LIDO |
| `docs/01_normative/CORE_IDENTITY_AND_ACTORS_CONTRACT.md` | ✅ LIDO |
| `docs/01_normative/IDENTITY_SSOT_PRECEDENCE.md` | ✅ LIDO |
| `STATUS_EXECUCAO_GLOBAL.md` (top 150 linhas) | ✅ LIDO |
| `REMEDIATION_DT_LOG.md` (top 100 linhas) | ✅ LIDO |
| `REMEDIATION_DECISIONS_LOG.md` (top 100 linhas) | ✅ LIDO |
| `opus.md` (top 100 linhas — estado mais recente) | ✅ LIDO |
| `docs/01_normative/08_AUTORIDADE_CANONICA.md` | ⚠️ NÃO LIDO (arquivo existe; ler na próxima auditoria profunda) |
| `docs/01_normative/AUTHORITY_PRECEDENCE.md` | ⚠️ NÃO LIDO (arquivo existe; ler na próxima auditoria profunda) |
| `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` | ⚠️ NÃO LIDO (arquivo existe; bootstrap mínimo coberto pelos acima) |
| `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` | ⚠️ NÃO LIDO (referenciado via contratos lidos) |

**Código vivo lido:**
- `backend/src/core/action-context/action-context.middleware.ts` ✅
- `backend/src/plugins/action-context.plugin.ts` ✅
- `backend/src/core/actor-registry/actor-registry.service.ts` (parcial) ✅
- `backend/src/core/authorization/authorization.service.ts` — método `canRepresentActor` ✅

**Nota:** os 4 documentos não-lidos existem no repositório; não são ausentes. Não disparam STOP de bootstrap. Devem ser lidos antes de auditoria no domínio de delegação/precedência de autoridade entre entidades.

---

## 6. AS TRÊS CAMADAS DE IDENTIDADE

```
global_user_id ≠ user_id ≠ actor_id
```

| Camada | O que representa | Escopo | SSOT |
|--------|-----------------|--------|------|
| `global_user_id` | A **pessoa física real** (CPF) | Global, sem tenant | `identities` / `03_IDENTITY_CANONICA.md` |
| `user_id` | **Conta técnica/contextual** no tenant | Por tenant (user_id por tenant) | `users` (contexto do tenant) |
| `actor_id` | **Papel operacional** que age no sistema | Por tenant, ligado a identidade ou PJ | `actors` / `02_ACTORS_SSOT.md` |

**Resolução técnica canônica:**

```
(global_user_id, tenant_id) → user_id
user_id → actors (via user_id coluna ou company_users / delegações)
```

Nunca resolver actorId a partir de identidade por heurística. Nunca inferir actor.

---

## 7. POR QUE ELAS NÃO PODEM SER COLAPSADAS

- `global_user_id` é ontológico, permanente, histórico. Não pode mudar. Não depende de tenant.
- `user_id` é técnico e contextual. Uma pessoa pode ter `user_id` em múltiplos tenants.
- `actor_id` é operacional. Uma pessoa pode operar como PF (actor humano), PJ (empresa), grupo, etc. ao mesmo tempo.

**Colapsar é:**
- Criar identidade por tenant (proibido — §5 de `03_IDENTITY_CANONICA.md`)
- Tratar usuário como sinônimo de actor (proibido — §10 de `02_ACTORS_SSOT.md`)
- Inferir actor a partir de sessão/token/request (proibido — §10 de `02_ACTORS_SSOT.md`)

**O drift real NÃO é o colapso dos IDs (que são layers legítimas). O drift real é:**
- Fragmentação de `actor_type` (vocabulário não-canônico)
- Readers fazendo lookup direto por `actorId` sem gate de representabilidade
- `actorId` vindo do cliente sem validação server-side
- Actors sem âncora civil (sem CPF)
- `actionContext` usado como autoria soberana sem `canRepresentActor`

---

## 8. O QUE É ACTOR

Actor é a **unidade ontológica de ação** do sistema.

> "Se age → é actor. Se não age → não é actor."
> — `02_ACTORS_SSOT.md` §1

- Actor é operacional (não é identidade, não é conta, não é perfil, não é sessão)
- Actor NUNCA pode existir sem CPF responsável (mesmo PJ precisa de CPF âncora)
- Actor pode ser: Pessoa Física, PJ, Sistema, Serviço, Instituição, Agente Automatizado
- Capabilities de actor vêm de `actor_registry` e são declaradas por tipo (`company`, `event`, `group`, etc.)
- `getDefaultCapabilities('company')` retorna `can_manage_marketplace: true` para TODA company — isso NÃO é autoridade sobre um actor filtrado; é gate de módulo. (**Armadilha documentada: capability ≠ autoridade sobre o alvo.**)

**Crachá operacional. Crachá não abre porta. A catraca server-side abre ou bloqueia.**

---

## 9. O QUE É USER

User é a **representação técnica e contextual** de uma pessoa em um tenant.

- `user_id` = conta técnica no tenant
- Existe dentro do escopo de um `tenant_id`
- Pode mudar (desativado, reativado, migrado)
- NÃO carrega autoridade nem permissão diretamente
- NÃO é sinônimo de actor

**Resolução:** `req.user.userId` = `user_id` na sessão autenticada. É o ponto de partida para `canRepresentActor`.

---

## 10. O QUE É GLOBAL_USER

Global user é a **âncora de identidade global** da pessoa física.

- Representa o CPF: "quem a pessoa É no mundo"
- Um `global_user_id` por pessoa, independente de tenant
- Não pode ser duplicado, não pode ser descartado
- Não confere poder por si só
- Resolução técnica: `(global_user_id, tenant_id) → user_id`

**Se não existe `global_user_id`, não existe pessoa no sistema.**

---

## 11. O QUE É IDENTITY

Identity é a **raiz ontológica** + **autoridade de KYC/documento**.

- Tabela `identities` = SSOT de dados fiscais e KYC (`tax_id`, `tax_id_type`, `kyc_status`, `kyc_level`)
- Chave por `global_user_id`
- Permanente, histórica
- NÃO define poder, NÃO autoriza ações, NÃO decide permissões
- Identidade fiscal PJ (CNPJ) tem casa própria — não compete com identidade PF (DECISION-0084)

**Violação crítica:** ler KYC/fiscal de `actors` ignorando `identities` quando disponível para o mesmo `global_user_id` = falha estrutural equivalente ao Gate 2.

---

## 12. O QUE É AUTHORITY

Authority é o **direito soberano de decidir, delegar, assumir risco e responder juridicamente**.

- Definida em `AUTHORITY_LAW.md` (Constituição de Autoridade)
- Authority ≠ permissão técnica
- Authority ≠ role organizacional
- Authority ≠ configuração de produto
- **Raiz humana irrenunciável:** toda autoridade deriva de um ator humano com CPF
- **ATL (Authority Trust Level):** ATL0→ATL4; só modificável por norma/Risk Authority, nunca por produto/tenant/feature flag
- **IA não cria nem delega autoridade** (Art. 11)
- Toda ação econômica tem UM responsável econômico único (Art. 3)

**Catraca server-side. A IA resolve; o sistema bloqueia ou libera.**

---

## 13. O QUE É ACTIONCONTEXT

ActionContext é um **hint de canal-1** (DECISION-0113), não autoridade soberana.

```typescript
interface ActionContext {
  actorId: string;   // HINT — não é autoridade
  intent: string;
  source: string;
  scope: string;
}
```

- Propagado pelo middleware `action-context.middleware.ts`
- Pode vir de: header `x-action-context`, body `actionContext`, query `actionContext`
- O middleware valida **formato e scope** (deve conter tenantId), **NÃO** valida se o user pode representar o actorId
- Validação de autoria = **`canRepresentActor(tenantId, req.user.userId, actionContext.actorId)`** no handler

**Armadilha histórica documentada (opus.md cont.157):**
> O comentário "actor-first: ownerId vem do contexto, nunca do cliente" era falso senso de segurança — actionContext.actorId é hint (lido pelo middleware, que valida só formato/scope).

**Regra:** `actionContext.actorId` declarado é HINT. Autoria soberana só com `canRepresentActor` server-side antes da operação.

---

## 14. O QUE É R2/DELEGAÇÃO

R2 é a **próxima raiz arquitetural** após o fechamento real de DECISION-0113.

- Define como um actor pode **delegar** permissões a outro (ex.: empresa delega para funcionário)
- Implementado via `actor_delegations` (tabela de delegação ativa, com escopo/validade/revogação)
- `canRepresentActor` já inclui delegação ativa como vetor 5 (via `findActiveDelegation`)
- **Congelado:** R2 NÃO avança antes de DECISION-0113 fechar completamente (denominador real dos 5 canais)
- Desenho de R2 está bom mas a premissa "0113 fechada" envelheceu (ver `dividas.md`)

**STOP permanente:** nunca sugerir implementação de R2 enquanto DT-mãe 0113 estiver OPEN.

---

## 15. O QUE É RESPONSABILIDADE CIVIL

Responsabilidade civil é a **âncora humana irrenunciável** de toda ação no sistema.

- Todo actor deve ter `responsible_actor_id` rastreável até um CPF (actor humano)
- Actors de sistema (`actor_system`) são infraestrutura — não substituem pessoa física em obrigações civis
- Saída de actor NÃO apaga responsabilidade histórica
- Transferência de empresa NÃO apaga âncora civil anterior — registra nova âncora com trilho temporal
- Multiplicidade de personas (PJ, grupos) AUMENTA o dever de vigilância do CPF

**Regra de autoria em rotas sensíveis:**
- `req.user.userId → ensureUserActor()` SÓ quando o writer for autorizado (write com criação legítima de actor)
- `GET` não deve ter side-effect → não chamar `getActiveActor` ou `ensureUserActor` em rotas de leitura
- `req.actionContext.actorId` não é autoria soberana se vier do cliente sem `canRepresentActor`

---

## 16. CAMPANHA DECISION-0113

### Princípio central

```
actorId declarado pelo cliente é HINT, não autoridade.
```

### Os 5 canais

| Canal | Source | Exemplo | Status (2026-06-09) |
|-------|--------|---------|---------------------|
| **Canal 1** | `actionContext.actorId` | header x-action-context | COBERTO (middleware + canRepresentActor por arquivo) |
| **Canal 2** | `x-actor-id` header | `resolveActiveActorFromRequest` | PRIMITIVO CORRIGIDO (`9996cbd2`); await sweep confirmar |
| **Canal 3** | query `actorId` / `actor_id` | `?actorId=` | MAIORIA COBERTA; re-sweep exaustivo pendente |
| **Canal 4** | params `:actorId` | `/actors/:actorId/dispatches` | PARCIALMENTE COBERTO; opportunity-dispatch selado |
| **Canal 5** | params `:id` de recurso privado | `/accounts/:accountId`, `/invoices/:invoiceId` | PARCIALMENTE COBERTO; account, invoice, payment-method selados |

### Pergunta de auditoria em toda rota

> "O gate valida o MESMO sujeito que dirige a leitura/escrita?"

Se não validar:
- A vivo (ativo)
- Bloqueia 0113
- DT-mãe NÃO fecha

### Estado atual (HEAD 0933b188, 2026-06-09)

Selados por Yala:
- `unified-calendar` — `?actorId` gateado por canRepresentActor; sem actorId = self server-side read-only
- `invoice by-id` — valida emissor/destinatário; admin escape sem LIMIT 1; ambiguidade fail-closed
- `payment-method` reads — list/by-id/default com canRepresentActor; list sem actorId = financial:view_all_ledger
- `account` reads — /:accountId e /balance com owner real; list e /owner = financial:view_all_ledger
- `unified-availability` — arquivo inteiro fechado ponta-a-ponta (7 GETs + writes + participants + bookings)
- `opportunity-dispatch` — canRepresentActor sobre req.params.id (actor alvo)
- `marketplace-inventory` — canRepresentActor sobre query.actorId (corrigido após FAIL Yala)
- `dashboard/reports` — 6 rotas A money-adjacent com helper resolveReportActorId
- `economic-overview` — canRepresentActor sobre req.params.actorId

**DT-mãe OPEN.** Fecha SOMENTE com denominador completo dos 5 canais + Yala sweep final.

### Re-sweep exaustivo pendente

- Grep backend inteiro por `?actorId`/`/:actorId`/`/actors/:id`/`actor_id` — NÃO lista de memória (já mentiu)
- b2b-contracts / availability / organization
- groups economy (`/economy/groups/:groupId/overview` — gate de membership/role, não canRepresentActor simples)
- settlement / AP / AR (owner ambíguo, STOP até READ-FIRST)
- `/regions/:id/account` (decisão Clayton: transparência vs admin)
- marketplace identity/sla (RE-AUDITAR à luz do FAIL de can_manage_marketplace default)
- FASE 6 / RBAC real = BLOQUEADO até 0113 fechar OU preservar canRepresentActor dentro de requirePermission

---

## 17. DÍVIDAS TÉCNICAS CONHECIDAS DO EIXO ACTOR/USERS

| DT | Status | Descrição |
|----|--------|-----------|
| DT-mãe DECISION-0113 | **OPEN** | 5 canais de actorId sem gate server-side; fecha só com denominador completo |
| DT-RBAC-FAIL-CLOSED-STUB-FASE6-REACTIVATION-TRAP | **OPEN** | `actor_has_permission` stub RETURN FALSE; FASE 6 não pode avançar antes de 0113 fechar; patches 0113 são defesa-em-profundidade load-bearing |
| DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION | **OPEN** | 3 vocabulários de actor_type coexistindo; `chk_actor_requires_identity` inefetiva sobre `actor_type='user'` runtime |
| DT-FINDORCREATEUSERACTOR | **CLOSED** (F3.1 v2) | register identity-before-actor + fail-closed |
| DT-UNIFYCARD-ACQUIRING-LEGACY-TOMBSTONE | **OPEN** | UnifyCard proxy reject-all = C-INERTE; reativação exige frente financeira governada |
| DT-MONEY-LATENT-REACTIVATION-TRAP | **OPEN** | Família geral de "neutralizado hoje, religar sem gate revive" |
| DT-C1-LEARNING-INTEREST-REACTIVATION | **OPEN LOW** | edge 409 |
| DT-RECOVERY-PAYOUT-GATE | **PARTIAL** | payout externo futuro |
| 94 atores legados `global_user_id IS NULL` | **OPEN** | backfill é fatia futura (DECISION-0062 F4/F5 pendentes) |

---

## 18. STOPS DA IA-ACTOR-USERS

Registro STOP e NÃO concluo quando:

1. **Owner ambíguo:** recurso by-id sem FK clara para actor_id — parar, fazer READ-FIRST do schema, confirmar ownership antes de gatear.
2. **Decisão de produto pendente:** qual parte de um recurso bi-lateral pode acessar o quê (ex.: groups economy = membership/role vs canRepresentActor).
3. **SSOT ausente:** tabela de recurso ausente no DB vivo (ex.: `invoices` ausente em DEV → behavioral N/A honesto).
4. **Canal-2 x-actor-id:** sempre verificar `resolveActiveActorFromRequest` antes de declarar canal-2 limpo.
5. **re-sweep incompleto:** nunca fechar DT-mãe 0113 com lista de memória — exige grep 1ª mão do backend inteiro.
6. **R2/delegação:** qualquer pedido de desenho ou implementação de R2 enquanto 0113 OPEN → STOP.
7. **Documento normativo ausente/ilegível quando relevante:** registrar STOP, não concluir.
8. **getActiveActor em GET:** se sugerido como resolver de actorId em rota de leitura → STOP, usar SELECT read-only (padrão DECISION-0069).
9. **LIMIT 1 em resolver de user-actor:** se encontrado → STOP, exigir correção fail-closed (0 ou >1 → erro).

---

## 19. COMO RESPONDER A PEDIDOS DA EXECUTORA

Protocolo fixo para qualquer pedido de análise de rota:

```
RESPOSTA PARA: IA DIRETORA

VEREDITO: [A vivo | F (fechado/OK) | E (stub/ausente) | C (filtro morto) | M (money, parar) | INCONCLUSIVO]

CANAL: [1-actionContext | 2-x-actor-id | 3-query | 4-params:actorId | 5-params:id-recurso]

EVIDÊNCIAS:
- Arquivo: [path]
- Handler: [nome]
- Linha crítica: [o que lê sem gate]
- Ownership do recurso: [onde está o actorId do dono — provado ou não]
- Bank materialidade: [SIM/NÃO — grep bank_*]

RISCOS:
- [descrever: IDOR / mass-disclosure / autoria-spoofável / etc.]

RECOMENDAÇÃO:
- [canRepresentActor(recurso.actorId) | financial:view_all_ledger | decisão Clayton | outro]
- [resolver owner ANTES do gate (by-id) | actorId do params (canal-5) | etc.]

STOPS:
- [listar se algum bloqueador existe]
```

**Classificação por tipo:**
- **actorId hint:** actorId vem do cliente sem gate → A vivo
- **self server-side:** sem actorId = resolve o próprio user (read-only SELECT, não getActiveActor)
- **owner real de recurso:** actorId vem do recurso no DB, não do params → provar FK
- **admin cross-actor:** listagem de múltiplos actors → financial:view_all_ledger (não canRepresentActor)
- **R2/delegação:** tem actor_delegations ativa → canRepresentActor já cobre (vetor 5)
- **by-id privado:** params.id = resourceId (não actorId) → resolver owner real do recurso
- **dead/stub:** rota registrada mas reject/501/tabela ausente → C-INERTE ou E
- **inconclusivo:** ownership ambíguo → STOP + READ-FIRST

**Nunca:** implementar, criar actor em GET, usar LIMIT 1, sugerir R2 com 0113 aberta.

---

## 20. PRÓXIMAS AUDITORIAS RECOMENDADAS

Por ordem de prioridade (estado 2026-06-09):

1. **RE-SWEEP EXAUSTIVO de actorId** — grep backend inteiro (não lista de memória). Denominador real dos 5 canais. Cada arquivo encontrado = READ-FIRST → classificar → veredito.

2. **marketplace identity/sla** — RE-AUDITAR: foram classificadas F-OK sob `can_manage_marketplace`, mas essa capability é DEFAULT de toda company (igual ao FAIL de marketplace-inventory). Podem ser A pelo mesmo motivo.

3. **b2b-contracts / availability (rotas) / organization-units** — classificadas E (stub/tabela ausente no DB vivo) mas precisam confirmação de 1ª mão no DB atual.

4. **groups economy** (`/economy/groups/:groupId/overview`) — NÃO é `canRepresentActor` simples; exige decisão sobre gate de membership/role de grupo. STOP até decisão Clayton.

5. **settlement / AP / AR** — owner ambíguo (STOP declarado). READ-FIRST obrigatório do schema de settlements antes de qualquer patch.

6. **`/regions/:id/account`** — decisão Clayton: transparência regional vs admin. STOP até decisão.

7. **FASE 6 / RBAC real** — BLOQUEADO até 0113 fechar OU preservar `canRepresentActor` dentro de `requirePermission` (rbac.plugin:151 já o faz — remover esse bind ressuscita autoria spoofável globalmente).

8. **`08_AUTORIDADE_CANONICA.md` + `AUTHORITY_PRECEDENCE.md`** — não lidos neste bootstrap; ler antes de auditoria profunda de delegação/precedência de autoridade entre entidades.

---

## 21. AUDITORIA `actor*` + DIAGNÓSTICO DE VERDADE PARALELA (2026-06-15, HEAD 7be810f1)

> Auditoria READ-ONLY pedida por Clayton: "o uso de Actor/actor está tendo fontes de verdade paralelas?". Critério aplicado: **fonte paralela = dois substratos que respondem DIFERENTE à MESMA pergunta material sobre o actor** (não apenas "muitos usos"). Tudo de 1ª mão no HEAD vivo. Insumo/diagnóstico — NÃO GO.

### 21.1 Volume bruto (universo actor*)
- **Banco:** ≈1124 ocorrências / 137 arquivos. Tabela-raiz `actors` (0002) + `atl_blocked_actors` + **25 tabelas `actor_*` vivas** + 4 funções SQL (`actor_has_permission` stub RETURN FALSE, `actor_has_any_role`, `actors_sync_actor_id_from_id`). Archive (`migrations_archive/`) tem 11 `*actor*` — tombstones, não SSOT.
- **Backend:** >400 arquivos `.ts`. Núcleo de autoridade concentrado em `authorization.service.ts` (`canActAs`/`canRepresentActor`/`findActiveDelegation`), `actor-registry`, `actor-delegation`, `rbac.plugin` (`assertActorRepresentable`).
- **Frontend:** 251 arquivos. Núcleo: `ActiveActorContext`, `useActiveActor`/`useActorMode`, `ActorSelector`, `actorContextConfig`, `actorLanguage`. Frontend sempre declara actorId = HINT (regra "frontend nunca cria verdade").

### 21.2 VEREDITO: PARCIALMENTE. Núcleo convergente; 4 focos de verdade paralela.

**✅ CONVERGENTE (uma só verdade — onde mais importa):**
- **Writer único:** `ensureUserActor` (§4.8) é o único criador/garantidor de actor 'user'.
- **Representação única:** `canRepresentActor` é o gate único. Os 2 resolvers de "actor ativo" são **fachadas sobre o mesmo writer**, não verdades rivais:
  - `getActiveActor` (core/actors/actor.helpers.ts:21) → só self, via ensureUserActor.
  - `resolveActiveActorFromRequest` (modules/social/actor.utils.ts:64) → self OU actor declarado (x-actor-id/actor_id query) **gateado por canRepresentActor** (L18-33).
- **Capability material:** `actor_registry.capabilities_json` é o SSOT que `authorization.service` exige.

**🔴 FOCO 1 — GRAVE — vocabulário `actor_type` (verdade paralela ONTOLÓGICA):**
6 conjuntos definem "o que um actor É" em CHECKs/tabelas diferentes: 0002 (`person·company·system`) · 0013 economic_identity (`user·store·hub·industry·service_provider`) · 0012 unify (`actor_human·actor_organizational·actor_system`) · 0064 runtime (`user·page·group·channel·actor_human·actor_system·person·company`) · audit_events (`user·page·cultural_profile`) · triggers responsabilidade (`{user,actor_human,person}×{actor_system,system}`). **MESMA pergunta, respostas incompatíveis.** = `DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION` (OPEN). → **DECISÃO DE NORMAS** (qual é canônico).

**🟠 FOCO 2 — MÉDIA — resolvers locais fora do canônico (verdade paralela de "quem age"):**
Além dos 2 canônicos, há resolvers LOCAIS que leem `actionContext.actorId` direto via `findById`, SEM ensureUserActor e SEM canRepresentActor embutido:
- `getAuthenticatedUserActor` (event.routes.ts:179) — **19 call-sites** no mesmo arquivo.
- `currentActorId` inline (social-2.0.service.ts:142).
- `findOrCreateUserActor` (actor.repository.ts, side-effect CREATE em GET).
No event.routes coexistem 2 padrões: body usa `userRepresentsActor` (forte, 7/7), mas ~19 rotas resolvem o actor pelo actionContext (canal-1, sem gate embutido). Classificar cada call-site = trabalho aberto (STOP).

**🟡 FOCO 3 — REBAIXADO p/ LATENTE — identidade fiscal/KYC (`actors` × `identities`):**
Schema tem colunas duplicadas: `actors.cpf_cnpj`/`actors.kyc_status`/`kyc_limit_cents` (0002, LEGADO) × `identities.tax_id`/`kyc_status` (SSOT). **Confirmado de 1ª mão: NÃO há leitor vivo de `actors.kyc_status`/`actors.cpf_cnpj` no runtime** — toda leitura de kyc_status faz JOIN `actors→identities` (authority-decision.service.ts:138; actor-bank-destination.service.ts:247 "SSOT: identities.tax_id"; economic-metrics.service.ts). Há e2e de coerência (`validate-pipeline-e2e-cpf-tax-id-coherence`). → **Verdade paralela LATENTE no schema, NÃO ativa no runtime** (colunas órfãs). Risco: leitura por engano (memória §11 = falha Gate 2). `contacts.kyc_status` é entidade distinta (CRM), não o actor.

**🟡 FOCO 4 — BAIXA — capability default × scope (planos disjuntos, com armadilha):**
`actor_registry.capabilities_json` (capability de módulo) × `getDefaultCapabilities(actorType)` que semeia `can_manage_marketplace:true` p/ TODA company (actor-registry.service.ts:234) × `company_users.can_manage_company` (gestão company-scoped, vetor V2). São perguntas diferentes → planos disjuntos por escopo (alinhado ao mapa 0131 item #3), **não verdade paralela estrita**. Armadilha conhecida: default amplo ≠ autoridade sobre o alvo (memória §8).

### 21.3 Síntese
O actor **NÃO** tem verdade paralela no que mais importa para segurança (representação/criação são únicas e convergentes). **TEM** verdade paralela em: (1) o que o actor É — `actor_type`, GRAVE; (2) quem age, em resolvers locais de canal-1, MÉDIO; (3) identidade fiscal/KYC, LATENTE (SSOT identities venceu no runtime); (4) capability default vs scope, BAIXO/disjunto.

### 21.4 Consultar IA de NORMAS
- Qual vocabulário `actor_type` é o CANÔNICO (Foco 1 — colisão 0002/0012/0013/0064).
- Precedência `actors.cpf_cnpj/kyc_status` × `identities.tax_id/kyc_status` (Foco 3 — declarar colunas legadas como tombstone).
- Se `actor_system`/`system` contam como "actor que age" (afeta responsabilidade civil §15).

### 21.5 STOPs
READ-ONLY (nada editado fora desta memória) · diagnóstico = insumo, não GO · vocabulário/precedência = decisão de normas · DT-mãe 0113 OPEN · R2 congelado · classificação dos 19 call-sites de `getAuthenticatedUserActor` = trabalho aberto.

---

## 22. PARALELA A — F-C1-MONEY-CANAL1-READ-FIRST-MATRIX (2026-06-15, HEAD 3e7fcda8)

> Auditoria READ-ONLY (5 auditores opus, 39 handlers/callers) de autoridade/ownership/canal-0113 nos 5 subsistemas C1_MONEY. Insumo, não GO. dev 385/385.

**Classificação por subsistema:**
- **accounts-payable** (8 rotas+worker): TODAS `CONTIDO_FAIL_CLOSED` por **stub de migração** (`accountsPayableRepository` = Proxy "migrated to Bank", service:14-16). Owner NAO_PROVADO (vive no Bank). Zero binding. Se religar repo sem binding → DIVERGENT money-adjacent (POST /:id/schedule agenda saída de $$).
- **accounts-receivable** (6): TODAS `CONTIDO_FAIL_CLOSED` por Proxy "migrated to Bank" — **MAS service vivo** chamado por `ticket.service.ts:243` + `payment-execution.service.ts:658`. POST /manual define BENEFICIÁRIO pelo body (owner-by-client). mark-received/cancel mutam cross-actor. Owner NAO_PROVADO.
- **purchase-order** (8): TODAS `DIVERGENT` — **repo VIVO (não stubbed)**. Owner = TENANT (só `tenant_id`, sem FK sub-tenant). 🔴 `POST /:id/receive` (MONEY_ADJACENT) PROMOVE `order.created_by_actor_id` (autoria histórica) a autoridade → cria `accounts_payable` + inventory IN. Qualquer autenticado do tenant recebe qualquer ordem.
- **settlement** (13): regional settle/credit/debit = `CONTIDO_FAIL_CLOSED` por Proxy (MOVE_MONEY sem binding, fundo regional). **event-settlement GET+settle = `CANONICAL`** (req.user→canRepresentActor(`events.actor_id`), FK provada mig 20260525100000:21) = **EXEMPLAR**. bank-settlement workers = `CANONICAL` (system authorship). bank-settlement-repository = `TOMBSTONE`. settlement-worker escrow = `INCONCLUSIVE` (resolver externo).
- **service-payment-request** (4): POST create + 2 GET = `DIVERGENT` VIVO (payer/receiver do body, só checa coerência booking, NÃO autoridade do caller; subject!=target). POST execute = `CONTIDO_FAIL_CLOSED` por firewall DECISION-0110 (flag OFF). Owner RESOLVÍVEL (`services.actor_id`=receiver, `booking.requesterActorId`=payer, execução FK fk_spe_*).

**Achado-mãe:** o padrão dominante de contenção é **stub de migração / firewall**, NÃO guard de autoridade — frágil para money (religar repo revive o leak). Único binding correto vivo = event-settlement.

**Recomendação (menor frente material):** começar por **service-payment-request authority binding** (owner resolvível + exemplar canônico event-settlement no mesmo repo). NÃO bundlar: AP/AR/settlement-regional (Proxy, owner no Bank, exige decisão tombstone-vs-reimplementar); purchase-order (vivo/grave mas owner tenant-only → decisão de governança); firewall execute; RBAC/FASE6/R2.

**Decisões Clayton pendentes:** quem cria payment-request (payer/receiver); PO tenant-wide vs per-actor + receivePO promove autoria; AP/AR tombstone vs reimplementar; governança do fundo regional.

---

## 23. F-C1-MONEY-SPR-RLS-PREFLIGHT (2026-06-15, HEAD 9edfbdf9, dev 386/386)

> Veredito READ-ONLY: pode-se aplicar RLS em `service_payment_requests` respeitando `canRepresentActor`? Verificado adversarialmente (1 agente opus tentou refutar → **refuted=false**, tese confirmada).

**VEREDITO: GO SOMENTE APÓS mapper/GUC/decisão (= NÃO-GO para RLS por actor agora).**

**Fatos decisivos (1ª mão):**
- GUC: o banco recebe **APENAS `app.current_tenant`** (pool.ts:141/176/225). NÃO há GUC de user/actor/representáveis.
- RLS viva: **100% tenant-only**. Únicas user-keyed (`app.current_user`/`global_user`) vivem só em `migrations_archive/` = NÃO-SSOT. Únicos não-tenant vivos = bypass role `TO unificard_infra USING(true)`.
- `canRepresentActor` = 100% app-level (authorization.service.ts:333-391); NUNCA toca set_config. O banco não consegue reproduzi-la.
- 🔴 `service_payment_requests` **NÃO tem RLS alguma** (nem de tenant — CREATE TABLE 20260530494000 sem ENABLE RLS; mig 20260615200000 "SEM RLS/policy"). Autoridade 100% app-level (3 fatias seladas: READ-HARDENING, CREATE-HARDENING receiver cria/payer paga, SCHEMA-FK-INDEX).

**Por quê NÃO-GO:** RLS por actor hoje ou (a) **duplica** canRepresentActor no USING (verdade paralela/drift) ou (b) exige **mapper user→{actores representáveis} + GUC carrier** (inexistentes). Por actor-direto **enfraquece** (ignora company/grupo/registry/delegação V5 temporal) e quebra multi-actor. Tenant-RLS não expressa payer/receiver (terceiro do tenant passaria) = falsa segurança se vendida como autoridade.

**Pré-frente p/ RLS por actor:** P1 mapper canônico user→representáveis · P2 GUC carrier por request (ex. `app.actor_ids`, com invalidação de delegação temporal) · P3 DECISION "RLS authority plans" (app-level continua SSOT; RLS = defense-in-depth). Só após P1+P2+P3.

**Recomendação:** NÃO aplicar RLS por actor; manter `canRepresentActor` app-level como SSOT. RLS tenant-only é defense-in-depth legítima MAS fatia própria, nunca vendida como enforcement payer/receiver. Seguir para outra superfície C1_MONEY (purchase-order) em vez de bloquear na RLS.

---

## 27. PONTEIRO — ACTOR-SCOPED REFERRAL (2026-06-17, HEAD 1565a184)

> Ponteiro factual (insumo). NÃO promulguei DECISION, NÃO editei cartório oficial, NÃO commitei. Detalhe completo nos packs READ-ONLY das auditorias F-ACTOR-SCOPED-REFERRAL-CODE-PREFLIGHT (GO + pré-GO).

- Auditoria actor-scoped referral em HEAD 1565a184 → **USER_ONLY** (diferencial NÃO materializado).
- **Infra de wallet JÁ é actor-native** (bank_accounts.owner_type DB='actor'; actor_wallet por actor existe — getActorWalletAccount/ensureActorWalletAccount). O gap NÃO está no Bank.
- **Gap real:** `users.referral_code` (user-scoped) + `user_referral_links` (user↔user, sem *_actor_id) + split resolver user-scoped (`getAccountByOwner(referrerUserId,'user')`). Identidade do código + resolver do split, uma camada acima do dinheiro.
- **DECISION-0134** (ACTOR_REFERRAL_CAPABILITY_GRANTS_BASELINE) já existe sobre o tema → **deve ser reconciliada**.
- Forma correta: **DECISION-0139** como adendo / build-on / **supersede-parcial da 0134**, NUNCA decisão paralela solta (evitar dupla verdade no cartório). 0138 é o maior número vivo → 0139 é a próxima.
- **Janela econômica de 5 anos = PENDENTE CLAYTON** até prova documental/ratificação explícita (não localizada em nenhum cartório lido).
- Próxima macrofrente material (futura, money-adjacent): `F-ACTOR-REFERRAL-CODE-SUBSTRATE` (actor_referral_codes + vínculo actor↔actor + split por owner_actor_id) — exige GO + paralelas.

---

## 28. RE-BASELINE RODADA 1 — PLANO DE ORQUESTRAÇÃO (2026-06-20, HEAD vivo `dd270f41`, branch rescue-structural)

> Acionada como **IA-ACTOR** (rótulo renomeado de IA-ACTOR-USERS na RODADA 1 da IA-DIRETORA) no barramento §14 do `PLANO_ORQUESTRACAO_SISTEMICA_UNIFICARD.md`. Resposta entregue na §14.5.R1 do plano (não no chat). Revalidação de 1ª mão. **NÃO GO, não promulguei, não editei cartório/código.**

**Fronteira nova institucionalizada (IA-DIRETORA):** `canRepresentActor` / representação / membership / 5 canais 0113 = MEU eixo (IA-ACTOR). Grants / capabilities / RBAC / `actor_has_permission` / `actor_capability_grants` = **IA-AUTORIDADE**. Quando cruza (superfície financeira com fail-open de autoridade), respondo o lado representação e marco IA-AUTORIDADE/IA-DINHEIRO.

**Fatos revalidados de 1ª mão (`dd270f41`):**
- **`canRepresentActor` VIVO e intocado** — `authorization.service.ts:333`, 5 vetores; `findActiveDelegation:550` (vetor 5) chamado em :386. Assinatura inalterada.
- **`actor_has_permission()` ainda `RETURN FALSE`** (`migrations/20260422000100:24`; mantido consciente `20260530551000:32`) — **FASE 6 segue desligada**.
- **Baseline canal-1 0113 = 0** — `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE` drenado 12→10→7→6→5→3→2→1→0 via R8H→R8J→R8K→R8L→R8N→R8O→R8P→R8Q (`REMEDIATION_DT_LOG.md`). Cada superfície BOUND (canRepresentActor/req.user) ou CONTAINED (501/403). Gate "baseline 0113 = 0" na entrada payout 2026-06-20 (`DT_LOG:68`).
- 🔴 **CORREÇÃO da minha memória de sessão (disco venceu):** a MEMORY.md de sessão dizia "DT-mãe 0113 CLOSED_WITH_CONTAINED_RESIDUALS". O **cartório vivo NÃO mostra essa string** — a DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` está marcada **OPEN** em TODAS as entradas R8 ("CLOSED só no reseal pós-Yala PASS material"). **Baseline vazio ≠ DT-mãe selada.** Reporto: baseline=0 mas DT-mãe **formalmente OPEN / pende seal Yala**.
- **Canais 2-5:** NÃO revalidados exaustivamente de 1ª mão nesta rodada (só canal-1 tem baseline-detector). Declarei **PARCIAL** — exigem sweep próprio antes de afirmar denominador finito.

**DECISIONs novas no meu eixo (delta dev 385/387 → `dd270f41`):** 0133 (suppliers `owner_actor_id`→page-actor — confirma recomendação da minha Seção 25/26), 0134/0139 (referral actor-scoped — Seção 27), **0136 (PROMULGADA/MATERIALIZADA Slice 1A: tabela `actor_capability_grants` + `hasCapabilityGrant`; substrato NOVO de capability por actor; DORMANT, sem enforcement em rota; availability/calendar owner-only/0113-0118 SELADOS)**, 0137 (tri-registry RFC docs-only), 0138 (calendar-operator-grant RFC docs-only, CLOSED/YALA PASS). **Substrato de REPRESENTAÇÃO não mudou; nasceu substrato de CAPABILITY (eixo IA-AUTORIDADE).** Invariante 0136 §2.3: "Representar ≠ ter capability. canRepresentActor = vestir; hasCapabilityGrant = capability. Eixos distintos."

**Traps vivos a vigiar na MACRO 2+ do plano:** (1) FASE 6 — religar `actor_has_permission` sem preservar `assertActorRepresentable` ressuscita autoria spoofável; (2) capability 0136 — ligar `hasCapabilityGrant` em rota sem manter `canRepresentActor` a montante mistura os eixos → fail-open; (3) higiene não-bloqueante — business-audit/policy-engine/risk-command-center dependem do recognizer central (Forma C), sem guard dedicado (`DT_LOG:96`).

## 29. RODADA 7 — F-PROFILE-PJ-OFFER READINESS (2026-06-20, HEAD vivo `9f5e9c5e`)

> Auditoria READ-ONLY do barramento `docs/orquestracao/` (RODADA 7). Resposta em `docs/orquestracao/respostas/IA-ACTOR.md`. Pergunta: onde o actor declara "eu faço isso" e isso converge p/ CONCEPT→SERVICE→OFFERING sem verdade paralela? VEREDITO: **PARTIAL**. Insumo, não GO.

**Cadeia canônica actor-first (CORRETA, convergente):** "eu faço isso" = `POST /profile/professional/c1/concepts` → `actor_professional_concepts` (actor_id + **concept_id** FK `concepts` NOT NULL, Lei 7; skill_level/years; **sem preço**; `canRepresentActor`-gated em professional-c1.service:66-76; GET NUNCA cria — service:91). Espinha `concept_id` é **compartilhada** com a oferta: `canonical_services.concept_id` NOT NULL (0117 D) → `services.canonical_service_id` (descoberta) → `service_offerings` (provider_actor_id + canonical_service_id, contratação). Legado de profissão-string = **501** (`PROFESSIONAL_PROFILE_LEGACY_NOT_IMPLEMENTED`; user_skills_categories/professional_profiles AUSENTE per SELO_A3_2).

**🔴 VERDADE PARALELA VIVA (novo achado):** `POST /categories/assign-skill` (categories.routes.ts:779 → `categoriesService.assignSkillToUser` → INSERT `user_skills_categories`, categories.service:1271) responde à MESMA pergunta ("este humano faz skill Y") MAS: (a) keyed por **global_user_id** (fura a camada actor); (b) **com `hourly_rate`/`pricing_type`** = preço no lugar errado (preço só em `service_offerings.price_cents` BIGINT); (c) **category_id**, não concept_id; (d) **SEM `canRepresentActor`**. Consumidores: categories.service (write vivo), profile-professional.service (read — mas rota 501/dead-via-route), human-mvp-matching:61 (read — human-mvp SCHEMA-GHOST/contido R8N). **Liveness da tabela `user_skills_categories` = INCONCLUSIVE → IA-BANCO** (SELO diz AUSENTE; rota ainda escreve → se ausente 500a 42P01, se viva é parallel-truth ativa).

**Outros fatos confirmados 1ª mão:** NÃO existe tabela `actor_capabilities` pura (só `actor_capability_grants`, eixo IA-AUTORIDADE, dormant). `actor_registry.capabilities_json`/`getDefaultCapabilities` = capability de MÓDULO (armadilha: default amplo ≠ "faz concept X" ≠ autoridade sobre alvo). `resolveActiveActorFromRequest` (actor.utils:64) gated (header/query x-actor-id → canRepresentActor → findById read-only); único create-path = fallback `ensureUserActor` self/idempotente (só `allowUserFallback:true`). ActiveActor unificado, discriminado por actor_type; writer único (ensureUserActor/ensurePageActor/ensureGroupActor) — não colapsado.

**STOPs p/ F-OFFER:** SSOT de "eu faço isso" = `actor_professional_concepts.concept_id` (NÃO user_skills_categories); preço só em offering; NÃO auto-criar services/offering a partir do perfil (travessia sem decisão = parallel-truth + side-effect); ponte "declarei→sou descobrível" = decisão de produto PENDENTE Clayton; todo write de capacidade passa por canRepresentActor (assign-skill viola); GET não cria actor (vigiar allowUserFallback em leitura). DECISIONs-âncora: 0113, 0117, Lei 7, SELO_A3_2.

## FRASE-GUIA

```
User é sessão.
Actor é crachá operacional.
Authority é catraca.
SSOT é cartório.
Bank é cofre.
Frontend é balcão.

Crachá não abre porta.
Catraca server-side abre ou bloqueia.

actorId do cliente é HINT.
canRepresentActor é a prova.
```

---

## 26. F-CONTACTS-SUPPLIERS-INSTITUTIONAL-AUTHORITY-PREFLIGHT (2026-06-16, HEAD 7e104d70)

> Evidence Pack v1 READ-ONLY (2 leitores opus). Frente guarda-chuva B5f, 2 saídas: A=suppliers, B=contacts. Insumo p/ decisão Clayton.

**Descoberta normativa nova:** `DECISION-0116` (DECISION_0116_INTRA_TENANT_OWNERSHIP_VISIBILITY_POLICY) define classes intra-tenant: COMPANY_INTERNAL · INSTITUTIONAL_ADMIN · PUBLIC_TENANT. §2.2.3: "ser membro do mesmo tenant NÃO concede acesso". Há MAPA_DENOMINADOR com classificação de readers. Suppliers JÁ classificado COMPANY_INTERNAL.

**BLOCO A — SUPPLIERS — VEREDITO: DECISÃO PENDENTE.** Leak tenant-only PROVADO por shape (listSuppliers/getSupplierById = `WHERE tenant_id=$1`, ZERO canRepresentActor/canManageCompany; RLS tenant-only; 0 linhas/2 tenants). Schema 0128: SEM owner_actor_id/company_id; só tenant_id + created_by_actor_id (autoria, NOT NULL FK) + created_by_user_id. DECISION-0116 §2.3 PROÍBE hardening antes de definir owner e PROÍBE gate sobre created_by. Classe = COMPANY_INTERNAL (A latente / Bloqueia C1). Frontend: ZERO callers (rotas live sem UI). Recomendo espelhar PO: `owner_actor_id` page-actor + canRepresentActor (frente F-SUPPLIERS-COMPANY-OWNER-ACTOR-SCHEMA-WIRING). SEM código até GO Clayton.

**BLOCO B — CONTACTS — VEREDITO: DECISÃO PENDENTE (com sub-prova).** PII fiscal (tax_id/email/phone/address/kyc). Gate tenant-only em 100% das rotas (contact.* + crm.*). Dono = TENANT (sem owner mais fino). `contacts.user_id` = vínculo opcional/sem FK = NÃO owner. **(A)** tenant-only PII reader = leak se tenant multiempresa. **(B) PROVADO independente:** `GET /contacts?userId=<other>` = enumeração cross-user (repo:244), sem gate self/consent. SEM leak cross-tenant (RLS+tenant_id dupla barreira). canRepresentActor INAPLICÁVEL (sem owner_actor_id). Pergunta bloqueante Clayton: tenant 1:1 com empresa OU multiempresa? Recomendo DT-CONTACTS-TENANT-ONLY-PII-READER (OPEN) + fechar (B) (HOLD: pode haver caller interno do filtro).

**🔴 GAP DE SSOT (contacts):** migração da tabela existe SÓ em `migrations_archive/0065_contacts.sql` (+0064 kyc), NÃO em `backend/migrations` (live tree). Tabela soberana de runtime mas DDL/RLS canônico fora do SSOT vigente. RLS afirmada = derivada-do-archive → REVALIDAR contra pg_policies no banco vivo.

**STOPs:** não created_by/contacts.user_id/tenant_id como autoridade · não canRepresentActor sem owner material · não inventar company_id sem GO · não RBAC/FASE6/R2 · não PDV/Bank/Core · sem patch/migration.

### 26.1 — GO de registro operacional (2026-06-16, append-only)

> Registro autorizado por Clayton (PROMPT 1 — GO PARA REGISTRO EM MEMÓRIA). Insumo operacional, **NÃO** norma soberana. **Fatos pertencem ao preflight em HEAD `7e104d70`** (dev 389/389). **HEAD vivo no registro = `17f25d66`** (divergiu; só 1 commit no intervalo = frontend agenda, NADA tocou supplier/contact — confirmado `git diff --name-only 7e104d70..HEAD`). **Execução futura exige revalidação contra HEAD/schema/código vivo.**

**SUPPLIERS (fatos persistentes):** tabela `suppliers` existe · row_count = 0 no preflight · tem `tenant_id` + `created_by_actor_id` · **NÃO** tem `owner_actor_id`/`company_id`/`user_id` · `created_by_actor_id` = autoria/auditoria, NÃO ownership · `created_by_user_id` NÃO é owner · `tenant_id` = escopo, NÃO autoridade · readers são tenant-only por shape · RLS NÃO é defesa efetiva enquanto a app conectar como postgres/superuser/bypassrls. **Decisão pendente:** ownership institucional. **Recomendação consolidada por Clayton:** suppliers devem ser company-owned por `owner_actor_id`→page-actor/company-actor, espelhando `purchase_orders` — ainda exige cartório soberano mínimo antes de qualquer migration/patch.

**CONTACTS (fatos persistentes — CORREÇÃO/ESCALAÇÃO vs Seção 26 acima):** 🔴 `contacts` **NÃO existe no banco vivo** no preflight — `to_regclass('public.contacts') = NULL` (não é só "DDL apenas no archive"; a TABELA está AUSENTE). Há callers vivos que dependem de `contacts` → risco real **42P01/500 cru** (schema ghost). `migrations_archive/0065_contacts.sql` NÃO é SSOT vivo e NÃO deve ser restaurado cru; o archive não tem owner material suficiente. **Decisão pendente:** gênese/ownership. **Escolha técnica atual de Clayton:** NÃO criar tabela `contacts` agora; primeiro CONTER o schema ghost em fail-closed/501 ou 503. Gênese futura deve ser auditada à parte e tender a `owner_actor_id`/company-owned — **não autorizado nesta frente**.

**RLS (alerta transversal):** se a app conecta como postgres/superuser/bypassrls, a RLS está INERTE como defesa de runtime → registrar como DT transversal futura. NÃO usar RLS como prova de autoridade enquanto a role real da aplicação não for provada. RLS = defesa-em-profundidade futura, NÃO substitui authority app-level server-side.

**STOPs (deste registro):** não editar código/schema · não migration · não DECISION · não fechar DT oficial · não commitar · não Bank/Core/PDV · não restaurar archive · não canRepresentActor sem owner material · não created_by como owner · não tenant_id como autoridade · não RLS como prova de autoridade.

---

## 24. F-C1-MONEY-PURCHASE-ORDER-OWNERSHIP-RULING (2026-06-15, HEAD 9edfbdf9, dev 386)

> Ruling READ-ONLY (2 leitores opus) de autoridade/ownership de purchase-order. Insumo p/ decisão Clayton.

**Schema provado (mig 0131_purchase_orders.sql):** pertencimento = APENAS `tenant_id` + `supplier_id` (fornecedor/credor) + `created_by_actor_id` (NOT NULL FK actors = AUTORIA) + `submitted_by_actor_id`/`cancelled_by_actor_id` (autoria, SEM FK). NÃO existe `company_id`, `owner_actor_id`, `received_by_actor_id`. RLS = tenant-only. ZERO primitivos de autoridade no caminho (canRepresentActor/canManageCompany/requirePermission = 0).

**VEREDITO OWNERSHIP:** owner material HOJE = **TENANT only**. Nenhuma coluna representa "dono/controla" distinta de autoria. Autoridade por EMPRESA (canManageCompany) = **IMPOSSÍVEL sem migration**: PO não tem company_id; `actors.company_id` só é populado p/ page-actor (uq_actors_company_page mig 0575); `created_by` é user/person (company_id NULL) → V2 do canRepresentActor não dispara. App-level sem migration só permite (a) tenant-wide ou (b) bind created_by (autoria→autoridade, VETADO).

**🔴 CORREÇÃO vs Paralela A (Seção 22):** `POST /:id/receive` NÃO é leak vivo — é **fail-closed POR ACIDENTE**: guard exige `actionContext.actingUserId` (routes:148-150) que a interface ActionContext (middleware:11-16) nunca popula → 400 MISSING_ACTOR antes do efeito. + accounts_payable é Proxy stub + try/catch best-effort. Inventory IN, porém, é vivo (dispararia se o guard fosse "consertado" sem cuidado). É FRÁGIL: refactor inocente reativa e promove created_by→autoridade. Classe correta = CONTIDO_FAIL_CLOSED acidental (não DIVERGENT vivo).

**Classificação contingente ao ruling:** reads tenant-only = CANONICAL se PO for tenant-wide (A), DIVERGENT se exigir owner por actor/empresa (C). writes (create/items/submit/cancel) = tenant-only sem owner binding.

**INSTRUMENTO CLAYTON (A–E):** A tenant-wide (sem migration; ruim p/ multi-empresa) · B creator-owned (sem migration mas VETADO: autoria→autoridade) · C empresa/canManageCompany (CANÔNICO mas exige migration company_id + backfill de ALTO RISCO — user→company é 1:N, sem mapa determinístico) · D departamento (substrato inexistente, prematuro) · E manter receive/sensíveis bloqueadas (troca fail-closed acidental por 403 explícito; sem migration).

**RECOMENDAÇÃO (insumo):** E agora (tornar a contenção EXPLÍCITA — remove a fragilidade do guard acidental sem promover autoria) + decisão A vs C para o destino. NÃO B. C é canônico porém frente de schema (não cabe na "menor frente"). NÃO ligar actingUserId/bindar created_by; NÃO add company_id sem decisão+backfill governado.

---

## 25. F-C1-MONEY-PO-COMPANY-OWNER-SCHEMA-PREFLIGHT (2026-06-15, HEAD 522b2059, dev 386)

> Preflight READ-ONLY (3 leitores opus) do owner empresarial canônico da PO. Sequela da Seção 24 (PO-RECEIVE-EXPLICIT-CONTAINMENT CLOSED). Insumo p/ decisão Clayton + migration futura.

**NOME CANÔNICO RECOMENDADO:** `owner_actor_id UUID NOT NULL FK actors(id)` apontando ao **page-actor da empresa** (actor_type='page', actors.company_id≠NULL), gateado por `canRepresentActor` (V2→canManageCompany). + opcional `company_id` NULL denormalizado (joins/consolidação, NÃO autoridade). **Precedente vivo idêntico: `service_offerings` = provider_actor_id(NOT NULL, autoridade) + company_id(nullable, conveniência)** (mig 20260611180000:70-71).

**Por que page-actor e NÃO company_id solto (3 provas):** (1) estoque é ACTOR-owned — `inventory_movements.actor_id` é SSOT físico; saldo de empresa é DERIVADO via actors.company_id. receivePO credita inventory IN → quem recebe TEM de ser o actor dono = page-actor. (2) canRepresentActor V2 (page-actor) já enforce canManageCompany → honra DECISION-0118 D1 ("representação genérica não basta p/ dono empresa"); não enfraquece. (3) delegação V5/R2 é keyed por actor (`actor_delegations.institutional_actor_id`) — owner-actor serve aos 5 vetores sem tradutor; company_id solto bifurcaria autoridade (canManageCompany × actor_delegations). Rejeitados: company_actor_id/buyer_company_id/buyer_company_actor_id = ZERO precedente; company_id-como-autoridade = fragmenta money+inventory; created_by/supplier/tenant já descartados.

**🔴 ALERTA — inventory legado já conflado:** mig 20260411120000 (step 4) JÁ fez backfill `inventory_movements.actor_id = po.created_by_actor_id` p/ POs antigas → SSOT físico de estoque já contém AUTOR-como-dono, append-only (trigger bloqueia UPDATE/DELETE). Fallbacks step 8/9 (primeiro actor do tenant) = adivinhação, NUNCA prova. Reabilitar receivePO sem re-owning propaga o anti-padrão.

**BACKFILL (user→company é 1:N):** automático SÓ em `criador_1_empresa`. Demais (0_empresas/N_empresas/removido/autoridade_revogada/empresa_desativada/tenant_multiempresa/sem_prova) = bloqueado/manual/recertificação/impossível.

**SEQUÊNCIA MÍNIMA (cada uma com GO):** (1) DECISION Clayton (owner=owner_actor_id→page-actor + política backfill) → (2) migration ADD owner_actor_id NULLABLE → (3) backfill só criador_1_empresa → (4) gate writers por canRepresentActor(owner_actor_id) → (5) SÓ DEPOIS, frente separada: reabilitar receivePO (exige re-owning inventory legado + received_by_actor_id). NÃO juntar 2-5.

**NÃO:** created_by/actionContext como autoridade · reusar fallback step 8/9 como prova · owner_actor_id NOT NULL antes do backfill · reabilitar receivePO na mesma fatia · company_id como chave de autoridade · tocar SPR/AP/AR/settlement/RLS/Bank/Core · abrir DECISION/RBAC/FASE6/R2.

---

## HISTÓRICO DE ATUALIZAÇÕES

| Data | Conteúdo |
|------|----------|
| 2026-06-09 | Criação inicial — bootstrap completo, 20 seções, estado HEAD 0933b188 |
| 2026-06-10 | Resposta ao PEDIDO DA EXECUTORA 2026-06-09: findAvailableActors (helper + alerta side-effect), canRepresentActor 3 sabores, inventory/movements scope-missing vs canal-0113, 4 estratégias variant-wide. HEAD b6cc69a3 (DECISION-0115 docs-only). |
| 2026-06-10 | Resposta ao PEDIDO DA EXECUTORA 2026-06-10 (REV. b): Eixo A (A1-A4) + Eixo B (B1-B5) + AB1 (groups). Suppliers/contacts = TENANT-owned sem FK de actor. created_by_actor_id = audit histórico. daily-metrics = B institucional cross-tenant sem admin gate. groups/mine = A vivo canal-1 spoof. RBAC stub = RETURN FALSE confirmado. company_users = vivo; RBAC actor-based = aspiracional. Novo achado: TYPE CONFUSION actorId/userId em GET /groups/mine. HEAD 3d8ad25b. |
| 2026-06-15 | **Seção 21** — Auditoria `actor*` + diagnóstico de VERDADE PARALELA (HEAD 7be810f1, pedido Clayton). Veredito: PARCIAL. Núcleo (ensureUserActor writer + canRepresentActor gate) CONVERGENTE. 4 focos paralelos: (1) GRAVE vocabulário actor_type = 6 conjuntos; (2) MÉDIA resolvers locais canal-1 (getAuthenticatedUserActor 19 call-sites); (3) LATENTE actors.cpf_cnpj/kyc_status órfãs (SSOT identities venceu runtime); (4) BAIXA capability default×scope. Consultar normas: actor_type canônico + precedência actors×identities. |
| 2026-06-15 | **Seção 22** — Paralela A F-C1-MONEY-CANAL1-READ-FIRST-MATRIX (HEAD 3e7fcda8, 5 auditores opus, 39 handlers). AP/AR/settlement-regional = CONTIDO por stub/firewall (não guard); purchase-order = 8/8 DIVERGENT vivo (receivePO promove autoria→autoridade); event-settlement = CANONICAL exemplar; SPR = DIVERGENT vivo c/ owner resolvível. Menor frente = SPR authority binding. |
| 2026-06-15 | **Seção 23** — F-C1-MONEY-SPR-RLS-PREFLIGHT (HEAD 9edfbdf9, dev 386). Veredito NÃO-GO p/ RLS por actor (verificado adversarial refuted=false): só GUC `app.current_tenant`, RLS 100% tenant-only, canRepresentActor app-level, SPR sem RLS alguma. Pré-frente: mapper user→representáveis + GUC carrier + DECISION RLS authority plans. |
| 2026-06-15 | **Seção 24** — F-C1-MONEY-PURCHASE-ORDER-OWNERSHIP-RULING (HEAD 9edfbdf9, 2 leitores opus). Owner=TENANT only (sem company_id/owner_actor_id/received_by); company-owner exige migration+backfill alto risco. CORREÇÃO vs Seção 22: receivePO é fail-closed ACIDENTAL (guard exige actingUserId nunca populado), não DIVERGENT vivo — frágil. Instrumento Clayton A-E: recomenda E (contenção explícita) agora + A vs C destino; veta B (autoria→autoridade). |
| 2026-06-15 | **Seção 25** — F-C1-MONEY-PO-COMPANY-OWNER-SCHEMA-PREFLIGHT (HEAD 522b2059, 3 leitores opus). Owner canônico = `owner_actor_id`→page-actor (gateado canRepresentActor), + company_id denormalizado opcional; precedente vivo = service_offerings (provider_actor_id+company_id). Provas: estoque é actor-owned (inventory.actor_id), V2 já enforce canManageCompany, delegação V5 keyed por actor. ALERTA: inventory legado já backfillado com created_by (autoria-como-dono, append-only). Backfill automático só criador_1_empresa. Receive = frente separada (5). |
| 2026-06-16 | **Seção 26** — F-CONTACTS-SUPPLIERS-INSTITUTIONAL-AUTHORITY-PREFLIGHT (HEAD 7e104d70, 2 leitores opus, Evidence Pack v1). Descoberta: DECISION-0116 (classes intra-tenant COMPANY_INTERNAL/INSTITUTIONAL_ADMIN/PUBLIC_TENANT; tenant≠acesso). SUPPLIERS: DECISÃO PENDENTE — leak tenant-only provado por shape, sem owner no schema, 0116 §2.3 proíbe gate sobre created_by; classe COMPANY_INTERNAL; recomendo espelhar PO owner_actor_id. CONTACTS: DECISÃO PENDENTE — PII fiscal tenant-only; (B) ?userId= enumeração cross-user PROVADA independente; user_id≠owner; pergunta bloqueante=tenant 1:1 vs multiempresa. GAP SSOT: migração contacts só em migrations_archive (revalidar pg_policies vivo). |
| 2026-06-16 | **Seção 26.1** — GO de registro operacional (autorizado Clayton; append-only). Fatos do preflight em HEAD 7e104d70/dev 389; HEAD vivo no registro = 17f25d66 (divergiu; só frontend agenda no intervalo, nada tocou supplier/contact). ESCALAÇÃO contacts: `to_regclass('public.contacts')=NULL` = TABELA AUSENTE no banco vivo (schema ghost; callers→42P01/500), não só archive. Clayton: conter ghost em fail-closed/501-503, NÃO criar tabela agora. suppliers: row_count=0, recomendação company-owned owner_actor_id (espelha PO), exige cartório antes. RLS inerte se app=postgres/superuser/bypassrls (DT transversal). Execução futura exige revalidação. |
| 2026-06-17 | **Seção 27** — Ponteiro actor-scoped referral (HEAD 1565a184). Auditoria = USER_ONLY; infra de wallet JÁ actor-native (gap não é Bank); gap = users.referral_code + user_referral_links (user↔user) + split resolver user-scoped. DECISION-0134 existe → reconciliar; forma correta = DECISION-0139 build-on/supersede-parcial-0134, nunca paralela. Janela 5 anos PENDENTE Clayton. Próxima frente material = F-ACTOR-REFERRAL-CODE-SUBSTRATE. Ponteiro factual; não promulguei/commitei/editei cartório. |
| 2026-06-20 | **Seção 29** — RODADA 7 F-PROFILE-PJ-OFFER readiness (HEAD vivo `9f5e9c5e`; resposta em `docs/orquestracao/respostas/IA-ACTOR.md`). VEREDITO PARTIAL. Cadeia canônica actor-first OK: `actor_professional_concepts.concept_id` (actor-keyed, gated, sem preço) compartilha concept_id com canonical_services→service_offerings. 🔴 VERDADE PARALELA VIVA: `POST /categories/assign-skill`→`user_skills_categories` (global_user_id, hourly_rate, category_id, sem canRepresentActor). Sem tabela actor_capabilities pura. STOPs F-OFFER: preço só em offering; não auto-criar services do perfil; ponte declarei→descobrível = decisão Clayton. Liveness user_skills_categories → IA-BANCO. Insumo, não GO. |
| 2026-06-20 | **Seção 28** — Re-baseline RODADA 1 do PLANO DE ORQUESTRAÇÃO (HEAD vivo `dd270f41`). Acionada como **IA-ACTOR** (rótulo renomeado); resposta na §14.5.R1 do plano. Fronteira nova: representação=meu / capability=IA-AUTORIDADE. `canRepresentActor` VIVO intocado (authz.service:333, 5 vetores); `actor_has_permission`=RETURN FALSE (FASE 6 OFF). Baseline canal-1 0113 **drenado a 0** (R8H→R8Q). 🔴 CORREÇÃO disco>memória: DT-mãe 0113 **formalmente OPEN** (não CLOSED_WITH_CONTAINED como dizia MEMORY de sessão); baseline 0 ≠ seal Yala. Canais 2-5 = PARCIAL (sem sweep 1ª mão). DECISIONs novas: 0133/0134/0139 (já no radar), **0136 substrato `actor_capability_grants` MATERIALIZADO mas DORMANT (eixo IA-AUTORIDADE; invariante §2.3 representar≠capability)**, 0137/0138 RFC docs-only. Traps MACRO 2+: FASE6 sem assertActorRepresentable / hasCapabilityGrant sem canRepresentActor a montante / higiene sem guard dedicado. Insumo, não GO. |
