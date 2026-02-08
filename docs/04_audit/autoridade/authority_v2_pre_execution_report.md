# AUTHORITY V2 PRE-EXECUTION REPORT
Eixo: AUTORIDADE / CONTEXTO / DECISÃO
Status: PRÉ-EXECUÇÃO
Tipo: RELATÓRIO DE AUDITORIA
Data: 2026-02-06

---

## 1. FINALIDADE

Este relatório lista todas as violações dos contratos V2 de autoridade:
- ACTIONCONTEXT_CONTRACT.md
- ACTIONCONTEXT_MIDDLEWARE_SPEC.md
- RBAC_V2_CONTRACT.md

Todas as violações listadas DEVEM ser corrigidas antes da execução.

---

## 2. VIOLAÇÕES IDENTIFICADAS

### 2.1 MIDDLEWARE - INFERÊNCIA DE ACTORID

**Arquivo:** `backend/src/core/action-context/action-context.middleware.ts`

**Violações:**
1. **Linha 52**: Infere `actingUserId` de `req.user.id`
   - Violação: ACTIONCONTEXT_MIDDLEWARE_SPEC.md Seção 6.1
   - Proibido inferir `actorId` a partir de `req.user`

2. **Linhas 72-83**: Infere `actingActorId` quando não fornecido
   - Violação: ACTIONCONTEXT_MIDDLEWARE_SPEC.md Seção 6.1
   - Proibido inferir `actorId` a partir de contexto implícito

3. **Linha 177**: Usa `userId` inferido de `req.user.id` para `actingUserId`
   - Violação: ACTIONCONTEXT_CONTRACT.md Seção 4
   - `actorId` não pode ser inferido

4. **Interface ActionContext (linhas 10-14)**: Não contém campos obrigatórios V2
   - Faltando: `intent`, `source`, `scope`
   - Violação: ACTIONCONTEXT_CONTRACT.md Seção 3

5. **Linha 18**: ActionContext é opcional (`actionContext?: ActionContext`)
   - Violação: ACTIONCONTEXT_CONTRACT.md Seção 5
   - ActionContext deve ser obrigatório

6. **Linhas 26-28**: Comentário documenta inferência de `acting_user_id` do auth
   - Violação: ACTIONCONTEXT_MIDDLEWARE_SPEC.md Seção 6.1

---

### 2.2 MIDDLEWARE - FALLBACK E COMPLETAR CONTEXTO

**Arquivo:** `backend/src/core/action-context/action-context.middleware.ts`

**Violações:**
1. **Linhas 72-83**: Cria fallback para `actingActorId` quando não fornecido
   - Violação: ACTIONCONTEXT_MIDDLEWARE_SPEC.md Seção 6.2
   - Proibido aplicar fallback para campos de autoridade

2. **Linhas 78-82**: Cria actor do user se não existir
   - Violação: ACTIONCONTEXT_MIDDLEWARE_SPEC.md Seção 6.3
   - Proibido "completar" ActionContext faltante

---

### 2.3 RBAC - USO DE REQ.USER

**Arquivo:** `backend/src/plugins/rbac.plugin.ts`

**Violações:**
1. **Linha 50**: Valida `req.user.id` como obrigatório
   - Violação: RBAC_V2_CONTRACT.md Seção 4
   - Proibido receber ou consultar `req.user`

2. **Linha 77**: Compara `actingUserId` com `req.user.id`
   - Violação: RBAC_V2_CONTRACT.md Seção 7.2
   - Proibido comparar identidade técnica com `actorId`

3. **Linhas 98, 110, 136, 148, 174, 186**: Usa `req.user!.id` para chamadas ao RBAC
   - Violação: RBAC_V2_CONTRACT.md Seção 4
   - RBAC deve receber exclusivamente `actorId + intent + scope`

4. **Linha 26**: Comentário documenta que RBAC exige `req.user.id`
   - Violação: RBAC_V2_CONTRACT.md Seção 4

---

### 2.4 RBAC - NÃO OPERA SOBRE ACTORID + INTENT + SCOPE

**Arquivo:** `backend/src/plugins/rbac.plugin.ts`

**Violações:**
1. **Linhas 110, 148, 186**: Chama `rbacService.userHasAllPermissions`, `userHasAnyPermission`, `userHasAnyRole` com `userId`
   - Violação: RBAC_V2_CONTRACT.md Seção 2
   - RBAC deve decidir apenas com `actorId + intent + scope`

2. **Falta de `intent`**: RBAC não recebe `intent` do ActionContext
   - Violação: RBAC_V2_CONTRACT.md Seção 4

3. **Falta de `scope`**: RBAC não recebe `scope` do ActionContext
   - Violação: RBAC_V2_CONTRACT.md Seção 4

---

### 2.5 HANDLERS - ACTIONCONTEXT OPCIONAL

**Arquivos:** Múltiplos arquivos de rotas

**Violações:**
1. Uso de `actionContext?.` (optional chaining) em vários arquivos
   - Violação: ACTIONCONTEXT_CONTRACT.md Seção 5
   - ActionContext deve ser obrigatório

2. Validações condicionais `if (!actionContext || !actionContext.actingUserId)`
   - Violação: ACTIONCONTEXT_CONTRACT.md Seção 5
   - Deve falhar explicitamente sem ActionContext válido

---

## 3. RESUMO DE VIOLAÇÕES

### Por Categoria:

1. **Inferência de actorId**: 4 violações
2. **Fallback de autoridade**: 2 violações
3. **Uso de req.user no RBAC**: 6 violações
4. **RBAC não opera sobre actorId + intent + scope**: 3 violações
5. **ActionContext opcional**: Múltiplas violações em handlers

### Por Arquivo:

1. `backend/src/core/action-context/action-context.middleware.ts`: 8 violações
2. `backend/src/plugins/rbac.plugin.ts`: 9 violações
3. Handlers (múltiplos arquivos): Violações de ActionContext opcional

---

## 4. CORREÇÕES NECESSÁRIAS

### 4.1 Middleware

1. Remover inferência de `actorId` / `actingUserId` de `req.user`
2. Tornar ActionContext obrigatório
3. Atualizar interface ActionContext para incluir: `actorId`, `intent`, `source`, `scope`
4. Remover fallback para `actingActorId`
5. Falhar explicitamente se ActionContext não puder ser construído
6. Aplicar middleware a TODAS as rotas de negócio (não apenas mutáveis)

### 4.2 RBAC

1. Eliminar qualquer uso de `req.user.*`
2. Refatorar RBAC para operar SOMENTE sobre: `actorId + intent + scope`
3. Remover coerência comparativa com identidade técnica
4. Atualizar chamadas ao `rbacService` para usar `actorId` ao invés de `userId`

### 4.3 Handlers

1. Remover qualquer acesso a `req.user` para decisão
2. Eliminar fallback (`A || B`)
3. Eliminar ActionContext opcional (`?.`)
4. Falhar explicitamente sem ActionContext válido

---

## 5. CRITÉRIO DE SUCESSO

- ZERO violações remanescentes do relatório
- Código compila
- Nenhum uso de `req.user.*` para autoridade
- ActionContext obrigatório em todos os fluxos
- RBAC operando apenas sobre SSOT (`actorId + intent + scope`)

---

FIM DO RELATÓRIO


