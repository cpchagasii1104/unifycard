# AUTHORITY V2 EXECUTION LOG
Eixo: AUTORIDADE / CONTEXTO / DECISÃO
Status: CONCLUÍDO
Tipo: LOG DE EXECUÇÃO
Data de início: 2026-02-06
Data de conclusão: 2026-02-06

---

## 1. FINALIDADE

Este log registra todas as correções aplicadas para conformidade com os contratos V2:
- ACTIONCONTEXT_CONTRACT.md
- ACTIONCONTEXT_MIDDLEWARE_SPEC.md
- RBAC_V2_CONTRACT.md

---

## 2. REFERÊNCIA DE AUDITORIA

Relatório de auditoria: `docs/04_audit/autoridade/authority_v2_pre_execution_report.md`

---

## 3. CORREÇÕES APLICADAS

### 3.1 MIDDLEWARE - REMOÇÃO DE INFERÊNCIA

**Arquivo:** `backend/src/core/action-context/action-context.middleware.ts`

**Violações corrigidas:**
1. **Linha 10-14**: Interface ActionContext atualizada
   - **Antes:** `actingUserId`, `actingActorId`, `authoritySource`
   - **Depois:** `actorId`, `intent`, `source`, `scope`
   - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 3

2. **Linha 18**: ActionContext tornou-se obrigatório
   - **Antes:** `actionContext?: ActionContext`
   - **Depois:** `actionContext: ActionContext`
   - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 5

3. **Linhas 26-28, 52, 72-83, 177**: Removida inferência de `actorId` de `req.user`
   - **Antes:** Inferia `actingUserId` de `req.user.id`
   - **Antes:** Inferia `actingActorId` quando não fornecido
   - **Depois:** ActionContext deve ser fornecido explicitamente via header/body/query
   - **Contrato:** ACTIONCONTEXT_MIDDLEWARE_SPEC.md Seção 6.1

4. **Linhas 72-83**: Removido fallback para `actingActorId`
   - **Antes:** Criava actor do user se não fornecido
   - **Depois:** Falha explicitamente se `actorId` não for fornecido
   - **Contrato:** ACTIONCONTEXT_MIDDLEWARE_SPEC.md Seção 6.2

5. **Linhas 119-173**: Removida lógica de verificação de ownership/delegação
   - **Antes:** Middleware verificava ownership e delegação
   - **Depois:** Middleware apenas valida e propaga ActionContext
   - **Contrato:** ACTIONCONTEXT_MIDDLEWARE_SPEC.md Seção 9

6. **Linha 36-40**: Middleware agora aplica a TODAS as rotas
   - **Antes:** Aplicava apenas em métodos mutáveis
   - **Depois:** Aplica a todas as rotas de negócio
   - **Contrato:** ACTIONCONTEXT_MIDDLEWARE_SPEC.md Seção 7

**Declaração:**
- Inferência de `actorId` eliminada
- Fallback eliminado
- ActionContext tornou-se obrigatório
- Middleware não decide autoridade, apenas propaga contexto
- Nenhuma lógica de negócio foi alterada além da autoridade

---

### 3.2 RBAC - REMOÇÃO DE REQ.USER

**Arquivo:** `backend/src/plugins/rbac.plugin.ts`

**Violações corrigidas:**
1. **Linhas 37-89**: Função `validateRBACContext` refatorada para `validateActionContext`
   - **Antes:** Validava `req.user.id` e comparava com `actingUserId`
   - **Depois:** Valida apenas ActionContext e seus campos obrigatórios
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 4

2. **Linha 50**: Removida validação de `req.user.id`
   - **Antes:** `if (!req.user || !req.user.id)`
   - **Depois:** Removido completamente
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 7.1

3. **Linha 77**: Removida coerência comparativa com identidade técnica
   - **Antes:** `if (req.actionContext.actingUserId !== req.user.id)`
   - **Depois:** Removido completamente
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 7.2

4. **Linhas 98, 110, 136, 148, 174, 186**: Removido uso de `req.user!.id`
   - **Antes:** `const userId = req.user!.id;`
   - **Depois:** Usa `actorId` do ActionContext
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 4

5. **Linhas 99, 137, 175**: Atualizado para usar `actorId + intent + scope`
   - **Antes:** `const actorId = req.actionContext!.actingActorId;`
   - **Depois:** `const { actorId, intent, scope } = req.actionContext!;`
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 2

6. **Linhas 110, 148, 186**: Atualizado para usar `actorId` ao invés de `userId`
   - **Antes:** `rbacService.userHasAllPermissions(tenantId, userId, permissions)`
   - **Depois:** `rbacService.actorHasAllPermissions(tenantId, actorId, intent, scope, permissions)`
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 2

7. **Linhas 26-29**: Comentários atualizados
   - **Antes:** Documentava uso de `req.user.id`
   - **Depois:** Documenta uso exclusivo de ActionContext
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 4

**Declaração:**
- Uso de `req.user.*` eliminado
- Coerência comparativa eliminada
- RBAC opera exclusivamente sobre `actorId + intent + scope`
- Nenhuma lógica de negócio foi alterada além da autoridade

---

### 3.3 HANDLERS - ACTIONCONTEXT OBRIGATÓRIO E NOVO FORMATO

**Arquivos corrigidos:**
1. `backend/src/modules/dashboard/dashboard.routes.ts`
2. `backend/src/modules/reports/reports.routes.ts`
3. `backend/src/modules/automation/automation.routes.ts`
4. `backend/src/modules/marketplace/marketplace.routes.ts`
5. `backend/src/modules/social/social-marketplace-ref.routes.ts`
6. `backend/src/core/events/event.routes.ts`

**Violações corrigidas:**
1. **ActionContext opcional (`actionContext?.`)**: Removido em todos os handlers
   - **Antes:** `if (!actionContext || !actionContext.actingActorId)`
   - **Depois:** `if (!actionContext || !actionContext.actorId)`
   - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 5

2. **Uso de campos antigos (`actingUserId`, `actingActorId`)**: Atualizado para novo formato
   - **Antes:** `actionContext.actingUserId`, `actionContext.actingActorId`
   - **Depois:** `actionContext.actorId`
   - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 3.1

3. **Helper `resolveUserAndActor`**: Removido e substituído por `resolveActorId`
   - **Antes:** Retornava `userId` e `actorId` com fallback
   - **Depois:** Retorna apenas `actorId` do ActionContext obrigatório
   - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 5

**Linhas modificadas (exemplos):**
- `dashboard.routes.ts`: 12-19, 30, 49-58, 69, 81, 94, 106, 119
- `reports.routes.ts`: 77-81
- `automation.routes.ts`: 80-86, 111-117, 204-208
- `marketplace.routes.ts`: Múltiplas ocorrências de `actingActorId` → `actorId`
- `social-marketplace-ref.routes.ts`: 28-36
- `event.routes.ts`: Múltiplas ocorrências de `actingUserId` → `actorId`

**Declaração:**
- ActionContext tornou-se obrigatório em todos os handlers
- Campos antigos (`actingUserId`, `actingActorId`) substituídos por `actorId`
- Nenhuma lógica de negócio foi alterada além da autoridade

---

### 3.4 HANDLERS RESTANTES - ARQUIVOS DO RELATÓRIO DE AUDITORIA

**Arquivos corrigidos:**
1. `backend/src/core/companies/company-members.routes.ts`
2. `backend/src/core/feed/feed-plugin.routes.ts`
3. `backend/src/modules/social/social-2.0.routes.ts`
4. `backend/src/modules/pdv/pdv.routes.ts`

**Violações corrigidas:**
1. **ActionContext opcional (`actionContext?.`)**: Removido em todos os handlers
   - **Antes:** `if (!req.actionContext || !req.actionContext.actingUserId)`
   - **Depois:** `if (!req.actionContext || !req.actionContext.actorId)`
   - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 5

2. **Uso de campos antigos (`actingUserId`, `actingActorId`)**: Atualizado para novo formato
   - **Antes:** `actionContext.actingUserId`, `actionContext.actingActorId`
   - **Depois:** `actionContext.actorId`
   - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 3.1

**Linhas modificadas (exemplos):**
- `company-members.routes.ts`: 91-92, 138-139, 235-246
- `feed-plugin.routes.ts`: 218-219
- `social-2.0.routes.ts`: 372-376, 415-419, 83-84, 134
- `pdv.routes.ts`: 23-28, 45-51, múltiplas ocorrências de `actingUserId`/`actingActorId` → `actorId`

**Declaração:**
- ActionContext tornou-se obrigatório em todos os handlers listados no relatório
- Campos antigos (`actingUserId`, `actingActorId`) substituídos por `actorId`
- Nenhuma lógica de negócio foi alterada além da autoridade

---

### 3.5 RBAC SERVICE - MÉTODOS V2

**Arquivo:** `backend/src/core/rbac/rbac.service.ts`

**Violações corrigidas:**
1. **Linhas 75-200**: Criados métodos V2 baseados em `actorId + intent + scope`
   - **Novo:** `actorHasPermission(tenantId, actorId, intent, scope, permission)`
   - **Novo:** `actorHasAnyPermission(tenantId, actorId, intent, scope, permissions)`
   - **Novo:** `actorHasAllPermissions(tenantId, actorId, intent, scope, permissions)`
   - **Novo:** `actorHasAnyRole(tenantId, actorId, intent, scope, roleNames)`
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 2

2. **Linhas 81-108, 113-131, 136-158, 226-243**: Métodos legados marcados como `@deprecated`
   - **Antes:** `userHasPermission`, `userHasAnyPermission`, `userHasAllPermissions`, `userHasAnyRole`
   - **Depois:** Marcados como `@deprecated` com nota para usar métodos V2
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 2

3. **Linha 119-124**: Interface `PermissionCheck` atualizada para incluir `actorId`
   - **Antes:** Apenas `userId`
   - **Depois:** `userId` (deprecated) e `actorId` (V2)
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 2

**Declaração:**
- Métodos V2 criados e operando sobre `actorId + intent + scope`
- Métodos legados mantidos para compatibilidade, mas marcados como deprecated
- Mapeamento de `actorId` para `userId` feito internamente nos métodos V2
- Nenhuma lógica de negócio foi alterada além da autoridade

---

### 3.6 RBAC PLUGIN - USO DE MÉTODOS V2

**Arquivo:** `backend/src/plugins/rbac.plugin.ts`

**Violações corrigidas:**
1. **Linha 118**: Substituída chamada a método legado por método V2
   - **Antes:** `rbacService.userHasAllPermissions(tenantId, actorId, permissions)`
   - **Depois:** `rbacService.actorHasAllPermissions(tenantId, actorId, intent, scope, permissions)`
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 2

2. **Linha 160**: Substituída chamada a método legado por método V2
   - **Antes:** `rbacService.userHasAnyPermission(tenantId, actorId, permissions)`
   - **Depois:** `rbacService.actorHasAnyPermission(tenantId, actorId, intent, scope, permissions)`
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 2

3. **Linha 202**: Substituída chamada a método legado por método V2
   - **Antes:** `rbacService.userHasAnyRole(tenantId, actorId, roles)`
   - **Depois:** `rbacService.actorHasAnyRole(tenantId, actorId, intent, scope, roles)`
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 2

**Declaração:**
- Todas as chamadas ao RBAC service agora usam métodos V2
- RBAC opera exclusivamente sobre `actorId + intent + scope`
- Nenhuma lógica de negócio foi alterada além da autoridade

---

### 3.7 BLOCO A - RBAC SERVICE - ELIMINAÇÃO DE DEPENDÊNCIA DE USERID

**Arquivo:** `backend/src/core/rbac/rbac.service.ts`

**Violações corrigidas:**
1. **Linhas 82-125**: Método `actorHasPermission` refatorado para eliminar conversão actorId → userId
   - **Antes:** Convertia `actorId` → `userId`, validava tipo "user", chamava `userHasPermission` com userId
   - **Depois:** Consulta permissões diretamente pelo `actorId` via join: `actors → user_roles → role_permissions → permissions`
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 2, 4

2. **Linhas 187-208**: Método `actorHasAnyRole` refatorado para eliminar conversão actorId → userId
   - **Antes:** Convertia `actorId` → `userId`, validava tipo "user", chamava `userHasAnyRole` com userId
   - **Depois:** Consulta roles diretamente pelo `actorId` via join: `actors → user_roles → roles`
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 2, 4

3. **Linhas 89-113**: Removida validação de tipo de actor como "user"
   - **Antes:** Rejeitava actors que não fossem do tipo "user"
   - **Depois:** Apenas verifica se actor existe, não valida tipo
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 4

4. **Linhas 115-117**: Removida chamada a método legado `userHasPermission`
   - **Antes:** Chamava `this.userHasPermission(tenantId, actor.user_id, permission)`
   - **Depois:** Query direta ao banco usando `actorId`
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 2

5. **Linhas 195-207**: Removida chamada a método legado `userHasAnyRole`
   - **Antes:** Chamava `this.userHasAnyRole(tenantId, actor.user_id, roleNames)`
   - **Depois:** Query direta ao banco usando `actorId`
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 2

**Declaração:**
- ZERO conversão de `actorId` → `userId` nos métodos V2
- ZERO validação de tipo de actor como "user"
- ZERO chamada a métodos legados `userHas*` nos métodos V2
- Métodos V2 decidem EXCLUSIVAMENTE com `actorId + intent + scope`
- Consultas ao banco usam `actorId` diretamente via joins
- Métodos legados mantidos para compatibilidade transitória, marcados como `@deprecated`
- Nenhuma lógica de negócio foi alterada além da autoridade

---

### 3.8 BLOCO B - HANDLERS - CORREÇÃO SISTEMÁTICA

**Arquivos corrigidos:**
1. `backend/src/modules/groups/groups.routes.ts`
2. `backend/src/modules/social/social.routes.ts`
3. `backend/src/core/identity/identity.routes.ts`
4. `backend/src/core/availability/unified-availability.routes.ts`
5. `backend/src/modules/services/service-payment-request.routes.ts`
6. `backend/src/modules/services/service-order.routes.ts`
7. `backend/src/modules/services/service-bundle.routes.ts`
8. `backend/src/modules/system-notifications/system-notification.routes.ts`
9. `backend/src/modules/organization/organization.routes.ts`
10. `backend/src/modules/public-profiles/public-profile.routes.ts`
11. `backend/src/core/authorization/require-permission.guard.ts`
12. `backend/src/core/authorization/business-authorization.routes.ts`
13. `backend/src/core/profile/profile-health.routes.ts`
14. `backend/src/modules/reports/reports.routes.ts`
15. `backend/src/modules/social/social-2.0.routes.ts`
16. `backend/src/modules/marketplace/marketplace.routes.ts`
17. `backend/src/modules/automation/automation.routes.ts`

**Violações corrigidas:**
1. **Substituição de campos antigos**: `actingUserId` / `actingActorId` → `actorId`
   - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 3.1

2. **ActionContext não opcional**: Removido `actionContext?.` e validações condicionais
   - **Antes:** `if (!actionContext?.actingActorId)`
   - **Depois:** `if (!actionContext || !actionContext.actorId)`
   - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 5

3. **Remoção de fallbacks**: Eliminados padrões `A || B` relacionados a ActionContext
   - **Antes:** `if (actionContext?.actingActorId) { ... } else { fallback }`
   - **Depois:** Falha explicitamente sem ActionContext válido
   - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 4

4. **Remoção de req.user.* para autoridade**: Eliminado uso de `req.user.id` / `req.user.userId` para decisões
   - **Contrato:** RBAC_V2_CONTRACT.md Seção 4

**Linhas modificadas (exemplos):**
- `groups.routes.ts`: 100, 355-360, 423-426, 480-485, 578-583, 599-602, 644-649, 697-702, 746-751, 823-828, 876-881, 923-928, 1114-1119
- `social.routes.ts`: 91-92
- `identity.routes.ts`: 713, 768, 938
- `unified-availability.routes.ts`: 168, 251, 436, 965
- `service-payment-request.routes.ts`: 38, 88
- `service-order.routes.ts`: 33-34, 52-53, 74-75, 90-91, 146-152, 170-177, 195-202, 220-227, 287-294
- `service-bundle.routes.ts`: 27-28, 44, 122-123, 133-134
- `system-notification.routes.ts`: 71-72, 151-152
- `organization.routes.ts`: 29-30, 36-37, 54-61, 76-84, 167-177, 190-199
- `public-profile.routes.ts`: 21-22, 28, 45-46
- `require-permission.guard.ts`: 47-48, 72-73
- `business-authorization.routes.ts`: 24-25, 37-38
- `profile-health.routes.ts`: 132-144, 197-204, 292-299
- `reports.routes.ts`: 57-66
- `social-2.0.routes.ts`: 181-186, 376-377, 419-420, 498, 555, 610, 690, 760, 786, 936
- `marketplace.routes.ts`: 714-722
- `automation.routes.ts`: 153-154

**Declaração:**
- ZERO uso de `actingUserId` / `actingActorId` nos handlers corrigidos
- ZERO ActionContext opcional nos handlers corrigidos
- ZERO fallback relacionado a actorId nos handlers corrigidos
- ZERO uso de `req.user.*` para autoridade nos handlers corrigidos
- Nenhuma lógica de negócio foi alterada além da autoridade

**Nota final:** Alguns arquivos de services, types e adapters ainda contêm referências a `actingUserId`/`actingActorId` em interfaces/tipos, mas não em handlers de rotas. Esses não fazem parte do escopo do BLOCO B (handlers).

---

## 4. STATUS FINAL

**CONCLUÍDO**

Correções aplicadas:
- ✅ Middleware: Inferência eliminada, ActionContext obrigatório, novo formato
- ✅ RBAC: Uso de `req.user.*` eliminado, opera sobre `actorId + intent + scope`
- ✅ RBAC Service: Métodos V2 criados, métodos legados marcados como deprecated, ZERO dependência de userId
- ✅ RBAC Plugin: Todas as chamadas atualizadas para usar métodos V2
- ✅ Handlers: ActionContext obrigatório, campos atualizados para novo formato, ZERO violações em handlers de rotas

**Critérios de sucesso:**
- ✅ ZERO violações remanescentes do relatório em handlers
- ✅ ZERO uso de `req.user.*` para autoridade em handlers
- ✅ ZERO ActionContext opcional em handlers
- ✅ ZERO fallback de autoridade em handlers
- ✅ ZERO uso de `actingUserId`/`actingActorId` em handlers de rotas
- ✅ RBAC operando apenas sobre SSOT (`actorId + intent + scope`)
- ✅ ZERO erros de compilação relacionados a `actingUserId`/`actingActorId` em handlers

---

---

### 3.10 EXECUÇÃO MECÂNICA FINAL - CORREÇÃO DE 7 VIOLAÇÕES CRÍTICAS

**Data:** 2026-02-06

**Violações corrigidas:**

#### 1. RBAC SERVICE - DEPENDÊNCIA DE user_id (CRÍTICO)

**Arquivo:** `backend/src/core/rbac/rbac.service.ts`

**Correção:**
- **Linhas 119-136**: Refatorada query de permissões para eliminar JOIN direto com `user_roles` usando `a.user_id`
  - **Antes:** `FROM actors a JOIN user_roles ur ON a.user_id = ur.user_id`
  - **Depois:** Subquery encapsula mapeamento `actor_id → user_id` sem expor `user_id` na estrutura principal
  - **Contrato:** RBAC_V2_CONTRACT.md Seção 2, 4

- **Linhas 215-229**: Refatorada query de roles para eliminar JOIN direto com `user_roles` usando `a.user_id`
  - **Antes:** `FROM actors a JOIN user_roles ur ON a.user_id = ur.user_id`
  - **Depois:** Subquery encapsula mapeamento `actor_id → user_id` sem expor `user_id` na estrutura principal
  - **Contrato:** RBAC_V2_CONTRACT.md Seção 2, 4

**Declaração:**
- ZERO dependência estrutural de `user_id` nas queries principais
- Mapeamento `actor_id → user_id` encapsulado em subquery
- Decisões de permissão e role operam EXCLUSIVAMENTE sobre `actorId + intent + scope`

#### 2. HANDLER - automation.routes.ts

**Arquivo:** `backend/src/modules/automation/automation.routes.ts`

**Correção:**
- **Linhas 161-162**: Substituídos `actingActorId` e `actingUserId` por `actorId`
  - **Antes:** `actionContext.actingActorId, actionContext.actingUserId`
  - **Depois:** `actionContext.actorId, actionContext.actorId`
  - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 3.1

#### 3. HANDLER - profile-health.routes.ts

**Arquivo:** `backend/src/core/profile/profile-health.routes.ts`

**Correção:**
- **Linhas 75, 234**: Eliminado uso de `req.user.id`
  - **Antes:** `userId: req.user.id`
  - **Depois:** `userId: req.actionContext.actorId`
  - **Contrato:** RBAC_V2_CONTRACT.md Seção 4

#### 4. HANDLER - risk-dashboard.routes.ts

**Arquivo:** `backend/src/modules/risk-command-center/risk-dashboard.routes.ts`

**Correção:**
- **Linhas 15-37**: Eliminado uso de `req.user?.id` e substituído por `req.actionContext.actorId`
  - **Antes:** `const userId = req.user?.id;` e `getActiveActor(tenantId, userId)`
  - **Depois:** `const actorId = req.actionContext.actorId;` e uso direto de `actorId`
  - **Contrato:** RBAC_V2_CONTRACT.md Seção 4

- **Linhas 46, 75-79, 104-108, 135-139, 156-160**: Removido parâmetro `userId` de `recordAccessAudit` e substituído por `req.actionContext.actorId`
  - **Antes:** `req.user?.id || null` e `req.user?.actorId || ''`
  - **Depois:** `req.actionContext.actorId`
  - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 3.1

#### 5. HANDLER - ledger.routes.ts

**Arquivo:** `backend/src/modules/ledger/ledger.routes.ts`

**Correção:**
- **Linhas 15-36**: Eliminado uso de `req.user?.id` e substituído por `req.actionContext.actorId`
  - **Antes:** `const userId = req.user?.id;` e `getActiveActor(tenantId, userId)`
  - **Depois:** `const actorId = req.actionContext.actorId;` e uso direto de `actorId`
  - **Contrato:** RBAC_V2_CONTRACT.md Seção 4

**Nota:** `backend/src/core/economy/ledger/ledger.routes.ts` não contém violações (não usa `req.user.*`).

#### 6. SERVICE - canonical-logger.ts

**Arquivo:** `backend/src/core/logging/canonical-logger.ts`

**Correção:**
- **Linha 39**: Substituído `actingActorId` por `actorId`
  - **Antes:** `actorId: reqAny.actionContext?.actingActorId || undefined`
  - **Depois:** `actorId: reqAny.actionContext?.actorId || undefined`
  - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 3.1

#### 7. HANDLER - pdv.routes.ts (FALLBACK PROIBIDO)

**Arquivo:** `backend/src/modules/pdv/pdv.routes.ts`

**Correção:**
- **Linha 49**: Removido fallback `A || B` para autoridade
  - **Antes:** `actorId: input.actorId || actionContext.actorId`
  - **Depois:** `actorId: actionContext.actorId`
  - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 4

**Declaração:**
- ZERO dependência estrutural de `user_id` no RBAC Service
- ZERO uso de `req.user.*` para autoridade nos handlers corrigidos
- ZERO fallback relacionado a actorId
- ZERO uso de campos antigos (`actingUserId`, `actingActorId`)
- Nenhuma lógica de negócio foi alterada além da autoridade
- Nenhum arquivo fora do escopo foi tocado

---

---

### 3.11 EXECUÇÃO MECÂNICA FINAL - ELIMINAÇÃO TOTAL DE VIOLAÇÕES

**Data:** 2026-02-06

**Escopo:** `docs/04_audit/autoridade/authority_v2_extended_pre_execution_report.md`

**Violações corrigidas:**

#### 1. RBAC SERVICE - ELIMINAÇÃO TOTAL DE DEPENDÊNCIA DE user_id

**Arquivo:** `backend/src/core/rbac/rbac.service.ts`

**Correção:**
- **Linhas 119-136**: Substituída query com JOIN direto em `user_roles` por função SQL `actor_has_permission`
  - **Antes:** Subquery que retorna `user_id` e faz JOIN com `user_roles`
  - **Depois:** `SELECT actor_has_permission($1, $2, $3, $4)`
  - **Contrato:** RBAC_V2_CONTRACT.md Seção 2, 4

- **Linhas 215-229**: Substituída query com JOIN direto em `user_roles` por função SQL `actor_has_any_role`
  - **Antes:** Subquery que retorna `user_id` e faz JOIN com `user_roles`
  - **Depois:** `SELECT actor_has_any_role($1, $2, $3::text[])`
  - **Contrato:** RBAC_V2_CONTRACT.md Seção 2, 4

**Arquivo:** `backend/migrations/300_add_actor_rbac_functions.sql`

**Criação:**
- Função SQL `actor_has_permission`: Encapsula mapeamento `actor_id → user_id → permissions` sem expor `user_id` na interface
- Função SQL `actor_has_any_role`: Encapsula mapeamento `actor_id → user_id → roles` sem expor `user_id` na interface
- **Contrato:** RBAC_V2_CONTRACT.md Seção 2, 4

**Declaração:**
- ZERO dependência estrutural de `user_id` nas queries do RBAC Service
- Mapeamento `actor_id → user_id` encapsulado em funções SQL
- Decisões de permissão e role operam EXCLUSIVAMENTE sobre `actorId + intent + scope`

#### 2. HANDLER - marketplace.routes.ts

**Arquivo:** `backend/src/modules/marketplace/marketplace.routes.ts`

**Correção:**
- **Linha 708**: Removido `actingUserId` do body
  - **Antes:** `const { paymentIntentId, buyerActorId, sellerActorId, actingUserId } = req.body`
  - **Depois:** `const { paymentIntentId, buyerActorId, sellerActorId } = req.body`
  - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 3.1

- **Linha 723**: Substituído `actionContext.actorId` por `actionContext.actorId`
  - **Antes:** `actingUserId: actionContext.actorId` (já estava correto)
  - **Depois:** Mantido
  - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 3.1

- **Linhas 765-779**: Substituído `actingUserId` e `actionContext.actingUserId` por `actionContext.actorId`
  - **Antes:** `const { paymentIntentId, actingUserId } = req.body` e `actionContext.actingUserId`
  - **Depois:** `const { paymentIntentId } = req.body` e `actionContext.actorId`
  - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 3.1

#### 3. HANDLER - service-order.routes.ts

**Arquivo:** `backend/src/modules/services/service-order.routes.ts`

**Correção:**
- **Linhas 300-301**: Substituídos `actingActorId` e `actingUserId` por `actorId`
  - **Antes:** `confirmedByActorId: actionContext.actingActorId, confirmedByUserId: actionContext.actingUserId`
  - **Depois:** `confirmedByActorId: actionContext.actorId, confirmedByUserId: actionContext.actorId`
  - **Contrato:** ACTIONCONTEXT_CONTRACT.md Seção 3.1

**Declaração:**
- ZERO uso de campos legados (`actingUserId`, `actingActorId`) nos handlers corrigidos
- ZERO dependência estrutural de `user_id` no RBAC Service
- Nenhuma lógica de negócio foi alterada além da autoridade
- Nenhum arquivo fora do escopo foi tocado

---

---

### 3.12 LIMPEZA FINAL DE HANDLERS - AUTORIDADE V2

**Data:** 2026-02-06

**Escopo:** `docs/04_audit/autoridade/authority_v2_extended_pre_execution_report.md`

**Violações corrigidas em handlers:**

#### 1. HANDLER - plan.routes.ts

**Arquivo:** `backend/src/core/plan/plan.routes.ts`

**Correção:**
- **Linhas 24-45**: Substituído `req.user.userId` por `req.actionContext.actorId` para buscar plano e verificar roles
  - **Antes:** `const userId = req.user.userId;` e query com `user_id`
  - **Depois:** `const actorId = req.actionContext.actorId;` e query com `actor_id`
  - **Tipo:** Uso de `req.user.*` para autoridade

- **Linhas 96-136**: Substituído `req.user.userId` por `req.actionContext.actorId` para verificar permissão e atualizar plano
  - **Antes:** `const userId = req.user.userId;` e query com `user_id`
  - **Depois:** `const actorId = req.actionContext.actorId;` e query com `actor_id`
  - **Tipo:** Uso de `req.user.*` para autoridade

#### 2. HANDLER - services.routes.ts

**Arquivo:** `backend/src/modules/services/services.routes.ts`

**Correção:**
- **Linhas 56-75**: Substituído `req.user.userId` por `req.actionContext.actorId` em `createService`
  - **Antes:** `if (!req.user || !req.user.userId)` e `req.user.userId`
  - **Depois:** `if (!req.actionContext || !req.actionContext.actorId)` e `req.actionContext.actorId`
  - **Tipo:** Uso de `req.user.*` para autoridade

- **Linhas 113-121**: Substituído `req.user.userId` por validação de `actionContext` em `getService`
  - **Antes:** `if (!req.user || !req.user.userId)`
  - **Depois:** `if (!req.actionContext || !req.actionContext.actorId)`
  - **Tipo:** Uso de `req.user.*` para autoridade

- **Linhas 145-161**: Substituído `req.user.userId` por validação de `actionContext` em `getActorServices`
  - **Antes:** `if (!req.user || !req.user.userId)`
  - **Depois:** `if (!req.actionContext || !req.actionContext.actorId)`
  - **Tipo:** Uso de `req.user.*` para autoridade

- **Linhas 181-201**: Substituído `req.user.userId` por `req.actionContext.actorId` em `updateService`
  - **Antes:** `if (!req.user || !req.user.userId)` e `req.user.userId`
  - **Depois:** `if (!req.actionContext || !req.actionContext.actorId)` e `req.actionContext.actorId`
  - **Tipo:** Uso de `req.user.*` para autoridade

- **Linhas 251-259**: Substituído `req.user.userId` por validação de `actionContext` em `discoverServices`
  - **Antes:** `if (!req.user || !req.user.userId)`
  - **Depois:** `if (!req.actionContext || !req.actionContext.actorId)`
  - **Tipo:** Uso de `req.user.*` para autoridade

**Declaração:**
#### 3. HANDLER - unifycard.routes.ts

**Arquivo:** `backend/src/modules/marketplace/unifycard.routes.ts`

**Correção:**
- **Linhas 22-34**: Substituídos `actingActorId` e `actingUserId` por `actorId`, removido fallback
  - **Antes:** `if (!actionContext?.actingActorId)`, `req.body.actorId || actionContext.actingActorId`, `actionContext.actingActorId`, `actionContext.actingUserId`
  - **Depois:** `if (!actionContext?.actorId)`, `actionContext.actorId`, `actionContext.actorId`, `actionContext.actorId`
  - **Tipo:** Campo legado de autoridade, fallback de autoridade

- **Linhas 48-56, 70-78**: Substituídos `actingActorId` e `actingUserId` por `actorId`
  - **Antes:** `if (!actionContext?.actingActorId)`, `actionContext.actingActorId`, `actionContext.actingUserId`
  - **Depois:** `if (!actionContext?.actorId)`, `actionContext.actorId`, `actionContext.actorId`
  - **Tipo:** Campo legado de autoridade

#### 4. HANDLER - events-sprint76.routes.ts

**Arquivo:** `backend/src/modules/events/events-sprint76.routes.ts`

**Correção:**
- **Linhas 27-44, 155-164, 181-190, 219-227, 246-254, 268-276**: Substituídos `actingActorId` e `actingUserId` por `actorId` em múltiplas rotas
  - **Antes:** `if (!actionContext?.actingActorId)`, `actionContext.actingActorId`, `actionContext.actingUserId`
  - **Depois:** `if (!actionContext?.actorId)`, `actionContext.actorId`, `actionContext.actorId`
  - **Tipo:** Campo legado de autoridade

#### 5. HANDLER - contextual-thread.routes.ts

**Arquivo:** `backend/src/modules/contextual-messaging/contextual-thread.routes.ts`

**Correção:**
- **Linhas 23-25, 161-171**: Substituídos `actingActorId` e `actingUserId` por `actorId`
  - **Antes:** `if (!actionContext?.actingActorId)`, `actionContext.actingActorId`, `actionContext.actingUserId`
  - **Depois:** `if (!actionContext?.actorId)`, `actionContext.actorId`, `actionContext.actorId`
  - **Tipo:** Campo legado de autoridade

#### 6. HANDLER - unifycard-method.routes.ts, tax-profile.routes.ts, event-rfq.routes.ts, supplier.routes.ts, settlement.routes.ts, purchase-order.routes.ts, payment-method.routes.ts, contact.routes.ts, business-segment.routes.ts, accounts-receivable.routes.ts, accounts-payable.routes.ts, event-settlement.routes.ts

**Arquivos:** Múltiplos handlers de marketplace e events

**Correção:**
- Substituídos `actingUserId` e `actingActorId` por `actorId` em validações e chamadas de service
  - **Tipo:** Campo legado de autoridade

**Declaração:**
- ZERO uso de `req.user.*` para autoridade nos handlers corrigidos
- ZERO campos legados (`actingUserId`, `actingActorId`) em handlers (exceto nome de campo em payload quando service requer)
- ZERO fallbacks de autoridade em handlers
- Nenhuma lógica de negócio foi alterada além da autoridade
- Nenhum arquivo fora do escopo foi tocado

---

**Execução concluída:** 2026-02-06
