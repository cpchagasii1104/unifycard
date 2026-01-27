# 🔴 CORREÇÃO: TENANT_MISMATCH — UnifiCard

**Data:** 02/01/2026  
**Problema:** Login funciona, mas todas as rotas autenticadas falham com TENANT_MISMATCH

---

## 📍 CAUSA RAIZ IDENTIFICADA

### Bug 1: Login não retorna tenantId

**Arquivo:** `backend/src/core/auth/auth.service.ts`  
**Linha:** 342

```typescript
// ATUAL (ERRADO)
return { user, tokens };

// DEVERIA SER
return { user, tokens, tenantId: userRow.tenant_id };
```

### Bug 2: Frontend usa fallback quando tenantId não vem

**Arquivo:** `frontend/src/components/Login.tsx`  
**Linhas:** 46-50

```typescript
// ATUAL (PROBLEMÁTICO)
if (result.data.tenantId) {
  setTenantId(result.data.tenantId);  // Nunca executa!
} else if (savedTenantId) {
  setTenantId(savedTenantId);  // Usa fallback errado
}
```

---

## ✅ CORREÇÕES NECESSÁRIAS

### CORREÇÃO 1: Backend retornar tenantId no login

**Arquivo:** `backend/src/core/auth/auth.service.ts`

**Localizar linha 342** (dentro do método `login`):
```typescript
return { user, tokens };
```

**Substituir por:**
```typescript
return { user, tokens, tenantId: userRow.tenant_id };
```

**Atualizar tipo de retorno (linha 283):**
```typescript
// DE:
): Promise<LoginResult> {

// PARA:
): Promise<LoginResult & { tenantId: string }> {
```

---

### CORREÇÃO 2: Backend sobrescrever req.tenant com JWT (mais segura)

**Arquivo:** `backend/src/core/auth/auth.plugin.ts`

**Substituir linhas 51-85** por:

```typescript
    // 🔐 NOVA LÓGICA: JWT é a fonte de verdade para tenant
    // Sobrescrever req.tenant com o tenant do JWT (mais seguro)
    // Isso garante que mesmo se o header estiver errado, o tenant correto será usado
    
    // Log de diagnóstico (apenas se houver divergência)
    if (reqAny.tenant?.id && reqAny.tenant.id !== payload.tenantId) {
      fastify.log.warn({
        route: req.url,
        headerTenantId: reqAny.tenant?.id,
        jwtTenantId: payload.tenantId,
      }, '⚠️ [AUTH] Tenant do header diferente do JWT - usando JWT como fonte de verdade');
    }
    
    // SOBRESCREVER tenant com o do JWT (fonte de verdade)
    reqAny.tenant = { id: payload.tenantId };
```

**Arquivo completo auth.plugin.ts após correção:**

```typescript
// src/core/auth/auth.plugin.ts
import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { authService } from '@core/auth/auth.service';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (req) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw fastify.httpErrors.unauthorized('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7).trim();

    let payload;
    try {
      payload = await authService.verifyAccessToken(token);
    } catch {
      throw fastify.httpErrors.unauthorized('Invalid or expired token');
    }

    const reqAny = req as any;
    const headerTenantId = req.headers['x-tenant-id'] as string;
    
    // 🔐 Log de validação de tenant - JWT vs Header
    fastify.log.info({
      route: req.url,
      method: req.method,
      headerTenantId,
      jwtTenantId: payload.tenantId,
      jwtUserId: payload.userId ?? payload.sub,
    }, '🔍 [AUTH] Validação de tenant');
    
    // 🔐 NOVA LÓGICA: JWT é a fonte de verdade para tenant
    // Não validamos mais header vs JWT - apenas usamos o JWT
    // Isso resolve TENANT_MISMATCH quando frontend envia tenant errado
    
    if (headerTenantId && headerTenantId !== payload.tenantId) {
      // Log de aviso (não erro) - frontend enviou tenant diferente
      fastify.log.warn({
        route: req.url,
        headerTenantId,
        jwtTenantId: payload.tenantId,
      }, '⚠️ [AUTH] Header x-tenant-id diferente do JWT - usando JWT');
    }
    
    // SOBRESCREVER tenant com o do JWT (fonte de verdade)
    reqAny.tenant = { id: payload.tenantId };

    // 🚀 Preenche req.user com userId, tenantId, email e globalUserId (se disponível)
    const userId = payload.userId ?? payload.sub;
    reqAny.user = {
      userId: userId,
      id: userId,
      tenantId: payload.tenantId,
      email: payload.email ?? undefined,
      globalUserId: payload.globalUserId ?? undefined,
    };
    
    // Log final de sucesso
    fastify.log.info({
      route: req.url,
      userId: reqAny.user.userId,
      tenantId: reqAny.user.tenantId,
    }, '✅ [AUTH] Autenticação validada');
  });
};

export default fp(authPlugin, {
  name: 'auth-plugin',
  dependencies: ['tenant-plugin'],
});
```

---

### CORREÇÃO 3: Frontend sempre usar tenantId do login

**Arquivo:** `frontend/src/components/Login.tsx`

**Substituir linhas 41-50** por:

```typescript
      if (result.success && result.data.tokens.accessToken) {
        // CRÍTICO: Salvar token ANTES de qualquer outra coisa
        setAuthToken(result.data.tokens.accessToken);
        
        // CRÍTICO: TenantId DEVE vir do backend (do usuário encontrado)
        // Se não vier, extrair do JWT como fallback
        let tenantIdToSave = result.data.tenantId;
        
        if (!tenantIdToSave) {
          // Extrair tenantId do JWT como fallback
          try {
            const tokenPayload = JSON.parse(atob(result.data.tokens.accessToken.split('.')[1]));
            tenantIdToSave = tokenPayload.tenantId;
            console.warn('[Login] tenantId não veio no response, extraído do JWT:', tenantIdToSave);
          } catch (e) {
            console.error('[Login] Falha ao extrair tenantId do JWT:', e);
          }
        }
        
        if (tenantIdToSave) {
          setTenantId(tenantIdToSave);
          console.log('[Login] TenantId salvo:', tenantIdToSave);
        } else {
          console.error('[Login] ERRO CRÍTICO: Nenhum tenantId disponível!');
        }
```

---

## 🎯 ORDEM DE EXECUÇÃO

### Prioridade 1: Backend (resolve o problema na raiz)

```
1. auth.service.ts: Adicionar tenantId no retorno do login (linha 342)
2. auth.plugin.ts: Sobrescrever req.tenant com JWT (linhas 51-85)
```

### Prioridade 2: Frontend (defesa em profundidade)

```
3. Login.tsx: Extrair tenantId do JWT se não vier no response (linhas 41-50)
```

---

## 📋 PROMPT PARA O CURSOR

```
Você está no monorepo Unificard.

PROBLEMA:
TENANT_MISMATCH em todas as rotas autenticadas após login.
Causa: login não retorna tenantId, frontend usa fallback errado.

TAREFAS (EXECUTAR EM ORDEM):

### 1. Backend: Retornar tenantId no login

Arquivo: backend/src/core/auth/auth.service.ts

Linha 283, alterar tipo de retorno:
DE:
): Promise<LoginResult> {

PARA:
): Promise<LoginResult & { tenantId: string }> {


Linha 342, alterar retorno:
DE:
return { user, tokens };

PARA:
return { user, tokens, tenantId: userRow.tenant_id };


### 2. Backend: Usar JWT como fonte de verdade para tenant

Arquivo: backend/src/core/auth/auth.plugin.ts

SUBSTITUIR COMPLETAMENTE linhas 51-85 por:

    // 🔐 NOVA LÓGICA: JWT é a fonte de verdade para tenant
    // Não validamos header vs JWT - apenas usamos o JWT
    
    if (headerTenantId && headerTenantId !== payload.tenantId) {
      fastify.log.warn({
        route: req.url,
        headerTenantId,
        jwtTenantId: payload.tenantId,
      }, '⚠️ [AUTH] Header x-tenant-id diferente do JWT - usando JWT');
    }
    
    // SOBRESCREVER tenant com o do JWT (fonte de verdade)
    reqAny.tenant = { id: payload.tenantId };


### 3. Frontend: Extrair tenantId do JWT se necessário

Arquivo: frontend/src/components/Login.tsx

SUBSTITUIR linhas 44-50 por:

        // CRÍTICO: TenantId DEVE vir do backend
        // Se não vier, extrair do JWT como fallback
        let tenantIdToSave = result.data.tenantId;
        
        if (!tenantIdToSave) {
          try {
            const tokenPayload = JSON.parse(atob(result.data.tokens.accessToken.split('.')[1]));
            tenantIdToSave = tokenPayload.tenantId;
            console.warn('[Login] tenantId extraído do JWT:', tenantIdToSave);
          } catch (e) {
            console.error('[Login] Falha ao extrair tenantId:', e);
          }
        }
        
        if (tenantIdToSave) {
          setTenantId(tenantIdToSave);
        }


### 4. Reiniciar backend e testar

VALIDAÇÃO:
1. Fazer logout
2. Fazer login com usuário novo
3. Acessar /profile
4. Não deve dar TENANT_MISMATCH

Se ainda der erro, verificar logs do backend.
```

---

## ⚠️ POR QUE USAR JWT COMO FONTE DE VERDADE?

| Abordagem | Segurança | Complexidade |
|-----------|-----------|--------------|
| Validar header vs JWT | Média | Alta (frontend pode enviar errado) |
| **JWT como fonte de verdade** | **Alta** | **Baixa** |

O JWT é **assinado criptograficamente** pelo backend. O header x-tenant-id pode ser manipulado pelo frontend ou estar desatualizado.

Usar o JWT como fonte de verdade:
- ✅ Mais seguro
- ✅ Resolve TENANT_MISMATCH automaticamente
- ✅ Frontend não precisa gerenciar tenant perfeitamente
- ✅ Funciona mesmo com cache/localStorage desatualizado

---

---

## 🔴 PROBLEMA ADICIONAL: CPF NÃO APARECE NO PERFIL

### Causa
O CPF está salvo na tabela `user_profiles.cpf`, mas o `core.service.ts` não busca essa tabela.

### CORREÇÃO 4: Buscar CPF de user_profiles

**Arquivo:** `backend/src/core/core.service.ts`

**Localizar linha 120** (após buscar referralCode), adicionar busca de CPF:

```typescript
      // Buscar código de indicação da tabela users
      let referralCode: string | null = null;
      try {
        // ... código existente ...
      } catch (err) {
        console.warn('Erro ao buscar código de indicação (não crítico):', err);
      }
      
      // 🔴 NOVO: Buscar CPF da tabela user_profiles
      let cpf: string | null = null;
      try {
        const cpfResult = await runQueryWithTenant<{ cpf: string | null }>(
          tenantId,
          `
          SELECT cpf
          FROM user_profiles
          WHERE user_id = $1
          LIMIT 1
          `,
          [userId]
        );
        cpf = cpfResult?.cpf || null;
      } catch (err) {
        console.warn('Erro ao buscar CPF (não crítico):', err);
      }
```

**Atualizar interface CompleteProfile (linha 21-26):**

```typescript
  personal_profile: {
    fullName: string | null;
    phone: string | null;
    metadata: Record<string, any>;
    referralCode: string | null;
    cpf: string | null;  // 🔴 ADICIONAR
  } | null;
```

**Atualizar onde personal_profile é montado (linha 156-163):**

```typescript
          profile.personal_profile = {
            fullName: personalProfile.fullName ?? null,
            phone: personalProfile.phone ?? null,
            metadata: personalProfile.metadata || {},
            referralCode: referralCode,
            cpf: cpf,  // 🔴 ADICIONAR
          };
```

**Também atualizar estrutura mínima (linhas 180-185 e 191-195):**

```typescript
          profile.personal_profile = {
            fullName: null,
            phone: null,
            metadata: {},
            referralCode: referralCode,
            cpf: cpf,  // 🔴 ADICIONAR
          };
```

---

### CORREÇÃO 5: Frontend consumir CPF

**Arquivo:** `frontend/src/api/core.ts`

**Atualizar interface (linha 15-20):**

```typescript
  personal_profile: {
    fullName: string | null;
    phone: string | null;
    metadata: Record<string, any>;
    referralCode: string | null;
    cpf: string | null;  // 🔴 ADICIONAR
  } | null;
```

**Arquivo:** `frontend/src/components/Profile.tsx`

**Adicionar estado para CPF (linha ~51):**

```typescript
const [cpf, setCpf] = useState<string>('');
```

**Consumir CPF do personal_profile (após linha 563):**

```typescript
      setCpf(personalProfile?.cpf ?? '');
```

---

## 📋 PROMPT COMPLETO PARA O CURSOR

```
Você está no monorepo Unificard.

PROBLEMAS:
1. TENANT_MISMATCH em todas as rotas autenticadas
2. CPF não aparece no perfil (está em user_profiles, não sendo buscado)

TAREFAS (EXECUTAR EM ORDEM):

### 1. Backend: Retornar tenantId no login

Arquivo: backend/src/core/auth/auth.service.ts

Linha 283, alterar tipo:
): Promise<LoginResult & { tenantId: string }> {

Linha 342, alterar retorno:
return { user, tokens, tenantId: userRow.tenant_id };


### 2. Backend: Usar JWT como fonte de verdade

Arquivo: backend/src/core/auth/auth.plugin.ts

SUBSTITUIR linhas 51-85 por:

    // JWT é fonte de verdade para tenant
    if (headerTenantId && headerTenantId !== payload.tenantId) {
      fastify.log.warn({
        route: req.url,
        headerTenantId,
        jwtTenantId: payload.tenantId,
      }, '⚠️ [AUTH] Header x-tenant-id diferente do JWT - usando JWT');
    }
    
    // SOBRESCREVER tenant com o do JWT
    reqAny.tenant = { id: payload.tenantId };


### 3. Backend: Buscar CPF de user_profiles

Arquivo: backend/src/core/core.service.ts

APÓS linha 136 (após buscar referralCode), ADICIONAR:

      // Buscar CPF da tabela user_profiles
      let cpf: string | null = null;
      try {
        const cpfResult = await runQueryWithTenant<{ cpf: string | null }>(
          tenantId,
          `SELECT cpf FROM user_profiles WHERE user_id = $1 LIMIT 1`,
          [userId]
        );
        cpf = cpfResult?.cpf || null;
      } catch (err) {
        console.warn('Erro ao buscar CPF (não crítico):', err);
      }


Linha 25 (interface CompleteProfile.personal_profile), ADICIONAR:
    cpf: string | null;


Linhas 156-163 (onde personal_profile é montado), ADICIONAR cpf:
            referralCode: referralCode,
            cpf: cpf,


Linhas 180-185 e 191-195 (estrutura mínima), ADICIONAR cpf:
            referralCode: referralCode,
            cpf: cpf,


### 4. Frontend: Atualizar interface

Arquivo: frontend/src/api/core.ts

Linha 19 (interface personal_profile), ADICIONAR:
    cpf: string | null;


### 5. Frontend: Extrair tenantId do JWT

Arquivo: frontend/src/components/Login.tsx

SUBSTITUIR linhas 44-50 por:

        let tenantIdToSave = result.data.tenantId;
        if (!tenantIdToSave) {
          try {
            const tokenPayload = JSON.parse(atob(result.data.tokens.accessToken.split('.')[1]));
            tenantIdToSave = tokenPayload.tenantId;
          } catch (e) {
            console.error('[Login] Falha ao extrair tenantId:', e);
          }
        }
        if (tenantIdToSave) {
          setTenantId(tenantIdToSave);
        }


### 6. Reiniciar backend e testar

VALIDAÇÃO:
1. Fazer logout (limpar localStorage)
2. Fazer login com usuário novo
3. Acessar /profile
4. Verificar que CPF aparece
5. Verificar que não há TENANT_MISMATCH

Se erro persistir, verificar logs do backend.
```

---

*Documento gerado em 02/01/2026*
