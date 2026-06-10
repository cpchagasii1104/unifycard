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

## HISTÓRICO DE ATUALIZAÇÕES

| Data | Conteúdo |
|------|----------|
| 2026-06-09 | Criação inicial — bootstrap completo, 20 seções, estado HEAD 0933b188 |
| 2026-06-10 | Resposta ao PEDIDO DA EXECUTORA 2026-06-09: findAvailableActors (helper + alerta side-effect), canRepresentActor 3 sabores, inventory/movements scope-missing vs canal-0113, 4 estratégias variant-wide. HEAD b6cc69a3 (DECISION-0115 docs-only). |
| 2026-06-10 | Resposta ao PEDIDO DA EXECUTORA 2026-06-10 (REV. b): Eixo A (A1-A4) + Eixo B (B1-B5) + AB1 (groups). Suppliers/contacts = TENANT-owned sem FK de actor. created_by_actor_id = audit histórico. daily-metrics = B institucional cross-tenant sem admin gate. groups/mine = A vivo canal-1 spoof. RBAC stub = RETURN FALSE confirmado. company_users = vivo; RBAC actor-based = aspiracional. Novo achado: TYPE CONFUSION actorId/userId em GET /groups/mine. HEAD 3d8ad25b. |
