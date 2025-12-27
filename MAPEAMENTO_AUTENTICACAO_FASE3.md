# 🔍 MAPEAMENTO: Sistema de Autenticação - FASE 3

**Data:** 22/12/2025  
**Objetivo:** Identificar duplicidades no sistema de autenticação do backend

---

## 📁 ARQUIVOS DE AUTENTICAÇÃO

### 1. Core Auth (Módulo Principal)

#### `backend/src/core/auth/auth.service.ts`
**Responsabilidade:** Lógica de negócio de autenticação
- Hash de senha (bcrypt)
- Geração de tokens JWT (access + refresh)
- Verificação de tokens JWT
- Registro de usuário
- Login de usuário
- Refresh de token
- Validação de credenciais

**Métodos principais:**
- `register()` - Registro de novo usuário
- `login()` - Autenticação de usuário
- `refreshToken()` - Renovação de token
- `verifyAccessToken()` - Verificação de token de acesso
- `generateTokens()` - Geração de tokens JWT

---

#### `backend/src/core/auth/auth.controller.ts`
**Responsabilidade:** Controller para rotas de autenticação
- Handler para `/register`
- Handler para `/login`
- Handler para `/refresh`
- Handler para `/logout`

**⚠️ DUPLICIDADE:** Este arquivo existe mas **NÃO É USADO**. As rotas são implementadas diretamente em `auth.routes.ts`.

---

#### `backend/src/core/auth/auth.routes.ts`
**Responsabilidade:** Definição de rotas HTTP de autenticação
- `POST /auth/register` - Registro
- `POST /auth/login` - Login
- `POST /auth/refresh` - Refresh token
- `POST /auth/logout` - Logout

**Validação:** Usa Zod para validação de schemas
**Tratamento de erros:** Implementado inline

**⚠️ DUPLICIDADE:** Implementa handlers diretamente, enquanto `auth.controller.ts` também tem handlers (não usado).

---

#### `backend/src/core/auth/auth.plugin.ts`
**Responsabilidade:** Middleware de autenticação para rotas protegidas
- Hook `preHandler` que verifica token JWT
- Extrai token do header `Authorization: Bearer <token>`
- Valida token usando `authService.verifyAccessToken()`
- Valida correspondência de tenant (JWT vs header)
- Preenche `req.user` com dados do usuário autenticado

**Validações:**
- Token presente e válido
- Token do tipo 'access'
- Tenant do JWT corresponde ao tenant da requisição
- Header `x-tenant-id` corresponde ao tenant do JWT

**⚠️ DUPLICIDADE:** Lógica de verificação de token duplicada em outros lugares.

---

#### `backend/src/core/auth/auth.module.ts`
**Responsabilidade:** Módulo Fastify que registra rotas de autenticação
- Registra `authRoutes` no Fastify
- Ponto de entrada para o módulo de autenticação

---

#### `backend/src/core/auth/auth.types.ts`
**Responsabilidade:** Definição de tipos TypeScript para autenticação
- `AuthUser` - Dados do usuário autenticado
- `AuthTokens` - Par de tokens (access + refresh)
- `LoginResult` - Resultado de login/registro
- `JwtPayload` - Payload do token JWT

**⚠️ DUPLICIDADE:** Tipo `JwtPayload` também definido em `types/jwt.d.ts` (com campos diferentes).

---

### 2. Tipos JWT

#### `backend/src/types/jwt.d.ts`
**Responsabilidade:** Extensão de tipos do módulo `jsonwebtoken`
- Estende interface `JwtPayload` do módulo `jsonwebtoken`
- Define campos: `userId`, `role`, `permissions`

**⚠️ DUPLICIDADE:** Tipo `JwtPayload` também definido em `auth.types.ts` (com campos diferentes: `sub`, `tenantId`, `email`, `type`).

---

### 3. Outros Arquivos que Usam Autenticação

#### `backend/src/modules/work-instant/dispatcher/dispatcher.plugin.ts`
**Responsabilidade:** Plugin WebSocket para Work Instant
- Implementa autenticação para conexões WebSocket
- Verifica token JWT manualmente (linhas 42, 114)
- Usa `authService.verifyAccessToken()` mas duplica lógica de validação

**⚠️ DUPLICIDADE:** 
- Lógica de extração de token do header duplicada (linhas 33-39, 105-109)
- Validação de tenant duplicada (linhas 45-49, 117-120)
- Não usa o middleware `auth.plugin.ts`

---

#### `backend/src/core/companies/company-validation.service.ts`
**Responsabilidade:** Validação de empresas
- Usa `jwt.verify()` diretamente (linha 116) para validar token de validação
- Não usa `authService.verifyAccessToken()`
- Implementa validação de expiração manualmente

**⚠️ DUPLICIDADE:** 
- Verificação de JWT duplicada (usa `jwt.verify` diretamente)
- Validação de expiração duplicada

**Nota:** Este é um caso especial (token de validação, não token de autenticação), mas ainda duplica lógica.

---

#### `backend/src/modules/cultural/cultural-event.service.ts`
**Responsabilidade:** Serviço de eventos culturais
- Usa `jwt.verify()` diretamente (linha 849) para validar QR code
- Não usa `authService.verifyAccessToken()`
- Implementa validação de expiração manualmente

**⚠️ DUPLICIDADE:** 
- Verificação de JWT duplicada (usa `jwt.verify` diretamente)
- Validação de expiração duplicada

**Nota:** Este é um caso especial (QR code, não token de autenticação), mas ainda duplica lógica.

---

#### `backend/src/plugins/rbac.plugin.ts`
**Responsabilidade:** Plugin de autorização (RBAC)
- Depende de `req.user` (definido por `auth.plugin.ts`)
- Verifica se usuário está autenticado (linhas 30-32, 47-49, 65-67)
- Não duplica lógica de autenticação, apenas verifica presença

**✅ SEM DUPLICIDADE:** Apenas verifica se usuário está autenticado, não implementa autenticação.

---

## 🔴 DUPLICIDADES IDENTIFICADAS

### 1. **DUPLICIDADE CRÍTICA: Handlers de Rotas**

**Arquivos envolvidos:**
- `auth.controller.ts` - Define handlers (não usado)
- `auth.routes.ts` - Define handlers diretamente (usado)

**Problema:**
- `auth.controller.ts` tem métodos `register()`, `login()`, `refreshToken()`, `logout()` que **não são usados**
- `auth.routes.ts` implementa a mesma lógica inline nas rotas
- Código duplicado e confuso

**Impacto:** Manutenção difícil, código morto, confusão sobre qual usar.

---

### 2. **DUPLICIDADE: Verificação de Token JWT**

**Arquivos envolvidos:**
- `auth.plugin.ts` - Middleware principal (linha 20)
- `dispatcher.plugin.ts` - WebSocket (linhas 42, 114)
- `company-validation.service.ts` - Validação de empresa (linha 116)
- `cultural-event.service.ts` - Validação de QR code (linha 849)

**Problema:**
- `auth.plugin.ts` usa `authService.verifyAccessToken()`
- `dispatcher.plugin.ts` usa `authService.verifyAccessToken()` mas duplica lógica de extração de token
- `company-validation.service.ts` usa `jwt.verify()` diretamente
- `cultural-event.service.ts` usa `jwt.verify()` diretamente

**Impacto:** Lógica de verificação espalhada, difícil de manter, inconsistências possíveis.

---

### 3. **DUPLICIDADE: Extração de Token do Header**

**Arquivos envolvidos:**
- `auth.plugin.ts` - Linhas 10-16
- `dispatcher.plugin.ts` - Linhas 33-39, 105-109

**Problema:**
- Lógica de extração de token duplicada em múltiplos lugares
- Verificação de formato `Bearer <token>` duplicada

**Impacto:** Código duplicado, mudanças precisam ser feitas em múltiplos lugares.

---

### 4. **DUPLICIDADE: Validação de Tenant**

**Arquivos envolvidos:**
- `auth.plugin.ts` - Linhas 25-86 (validação extensa)
- `dispatcher.plugin.ts` - Linhas 45-49, 117-120 (validação simplificada)

**Problema:**
- Validação de tenant duplicada
- `auth.plugin.ts` tem validação mais completa
- `dispatcher.plugin.ts` tem validação simplificada

**Impacto:** Inconsistências possíveis, lógica de validação não centralizada.

---

### 5. **DUPLICIDADE: Tipos JWT**

**Arquivos envolvidos:**
- `auth.types.ts` - Define `JwtPayload` com campos: `sub`, `tenantId`, `email`, `type`, `userId`, `role`, `permissions`
- `types/jwt.d.ts` - Estende `JwtPayload` do módulo `jsonwebtoken` com campos: `userId`, `role`, `permissions`

**Problema:**
- Dois tipos `JwtPayload` diferentes
- Campos sobrepostos mas não idênticos
- Pode causar confusão de tipos

**Impacto:** Confusão de tipos, possíveis erros de compilação, manutenção difícil.

---

### 6. **DUPLICIDADE: Validação de Expiração de Token**

**Arquivos envolvidos:**
- `auth.service.ts` - `verifyAccessToken()` trata expiração automaticamente via `jwt.verify()`
- `company-validation.service.ts` - Valida expiração manualmente (linhas 122-125)
- `cultural-event.service.ts` - Valida expiração manualmente (linhas 861-864)

**Problema:**
- Validação de expiração implementada manualmente em alguns lugares
- `jwt.verify()` já valida expiração automaticamente

**Impacto:** Código desnecessário, possível inconsistência.

---

## 📊 RESUMO DE DUPLICIDADES

| # | Tipo de Duplicidade | Arquivos Envolvidos | Severidade |
|---|---------------------|---------------------|------------|
| 1 | Handlers de rotas | `auth.controller.ts` (não usado) vs `auth.routes.ts` | 🔴 ALTA |
| 2 | Verificação de JWT | `auth.plugin.ts`, `dispatcher.plugin.ts`, `company-validation.service.ts`, `cultural-event.service.ts` | 🔴 ALTA |
| 3 | Extração de token | `auth.plugin.ts`, `dispatcher.plugin.ts` | 🟡 MÉDIA |
| 4 | Validação de tenant | `auth.plugin.ts`, `dispatcher.plugin.ts` | 🟡 MÉDIA |
| 5 | Tipos JWT | `auth.types.ts`, `types/jwt.d.ts` | 🟡 MÉDIA |
| 6 | Validação de expiração | `auth.service.ts`, `company-validation.service.ts`, `cultural-event.service.ts` | 🟢 BAIXA |

---

## 📋 ARQUIVOS MAPEADOS

### Core Auth (6 arquivos)
1. ✅ `backend/src/core/auth/auth.service.ts`
2. ✅ `backend/src/core/auth/auth.controller.ts` ⚠️ NÃO USADO
3. ✅ `backend/src/core/auth/auth.routes.ts`
4. ✅ `backend/src/core/auth/auth.plugin.ts`
5. ✅ `backend/src/core/auth/auth.module.ts`
6. ✅ `backend/src/core/auth/auth.types.ts`

### Tipos (1 arquivo)
7. ✅ `backend/src/types/jwt.d.ts`

### Outros (3 arquivos)
8. ✅ `backend/src/modules/work-instant/dispatcher/dispatcher.plugin.ts`
9. ✅ `backend/src/core/companies/company-validation.service.ts`
10. ✅ `backend/src/modules/cultural/cultural-event.service.ts`

### Dependências (1 arquivo)
11. ✅ `backend/src/plugins/rbac.plugin.ts` (usa autenticação, não implementa)

---

## 🎯 CONCLUSÃO

**Total de arquivos mapeados:** 11  
**Duplicidades identificadas:** 6  
**Arquivo não utilizado:** 1 (`auth.controller.ts`)

**Principais problemas:**
1. Controller não utilizado vs rotas implementadas diretamente
2. Verificação de JWT espalhada em múltiplos lugares
3. Tipos JWT duplicados e inconsistentes
4. Lógica de validação duplicada

**Recomendações para FASE 4 (refatoração):**
1. Remover `auth.controller.ts` ou migrar lógica de `auth.routes.ts` para ele
2. Centralizar verificação de JWT em `authService`
3. Unificar tipos JWT
4. Criar helper para extração de token do header
5. Centralizar validação de tenant

---

**Última atualização:** 22/12/2025


