# 🔇 Silenciar Chamadas para Módulos Não Ativos

## 📋 Resumo Executivo

Implementado tratamento silencioso de 404 para módulos não implementados (cultural, unread-counts, wallet), evitando logs de erro e warnings vermelhos.

---

## ✅ Implementação

### 1. Adicionado `silent404` no `apiFetch`

**Arquivo**: `frontend/src/api/client.ts`

**Mudança**: Adicionada opção `silent404` em `ApiFetchContextOptions`

```typescript
export interface ApiFetchContextOptions {
  silent401?: boolean;
  silent404?: boolean; // Tratar 404 como feature indisponível (não erro)
}
```

**Comportamento**:
- Se `silent404: true`, 404 lança erro com código `FEATURE_UNAVAILABLE`
- Não loga como erro
- Não exibe warning vermelho

### 2. Atualizado `apiFetchJson` para aceitar `contextOptions`

**Arquivo**: `frontend/src/api/client.ts`

**Mudança**: `apiFetchJson` agora aceita `contextOptions` para passar `silent404`

```typescript
export async function apiFetchJson<T>(
  path: string, 
  options: RequestInit | { silent404?: boolean } = {},
  contextOptions?: ApiFetchContextOptions
): Promise<T>
```

### 3. Atualizado `listPublicCulturalEvents`

**Arquivo**: `frontend/src/api/cultural.ts`

**Mudança**: Trata 404 como feature indisponível

```typescript
export async function listPublicCulturalEvents(...): Promise<...> {
  try {
    return await apiFetchJson<...>(..., {}, { silent404: true });
  } catch (error: any) {
    // Se 404, tratar como feature indisponível (não erro)
    if (error?.code === 'FEATURE_UNAVAILABLE' || error?.status === 404) {
      return { events: [], next_cursor: null };
    }
    throw error;
  }
}
```

### 4. Atualizado `getUnreadCounts`

**Arquivo**: `frontend/src/api/unread.ts`

**Mudança**: Trata 404 como feature indisponível

```typescript
export async function getUnreadCounts(): Promise<UnreadCounts> {
  try {
    const response = await apiFetch('/social/unread-counts', {}, { silent404: true });
    return await response.json();
  } catch (error: any) {
    // Se 404, retornar zeros silenciosamente
    if (error?.code === 'FEATURE_UNAVAILABLE' || error?.status === 404) {
      return { feed: 0, groups: 0, events: 0, services: 0 };
    }
    // ...
  }
}
```

### 5. Atualizado `getMyAccount`

**Arquivo**: `frontend/src/api/economy.ts`

**Mudança**: Trata 404 como feature indisponível, retorna `null`

```typescript
export async function getMyAccount(): Promise<UserAccount | null> {
  try {
    const response = await apiFetch('/economy/accounts/me', {}, { silent404: true });
    return await response.json();
  } catch (error: any) {
    // Se 404, tratar como feature indisponível (não erro)
    if (error?.code === 'FEATURE_UNAVAILABLE' || error?.status === 404) {
      return null; // Wallet não disponível
    }
    throw error;
  }
}
```

### 6. Atualizado `SocialFeed2.tsx`

**Arquivo**: `frontend/src/components/social/SocialFeed2.tsx`

**Mudança**: Não loga 404 como erro ao carregar eventos culturais

```typescript
try {
  const culturalData = await listPublicCulturalEvents({ limit: 10 });
  setCulturalEvents(culturalData.events || []);
} catch (culturalErr: any) {
  // Se 404, feature não está disponível (não logar como erro)
  if (culturalErr?.code !== 'FEATURE_UNAVAILABLE' && culturalErr?.status !== 404) {
    // Apenas logar se não for 404
    console.warn('Erro ao carregar eventos culturais:', culturalErr);
  }
  // 404 é tratado silenciosamente - não bloqueia o feed
}
```

---

## ✅ Critérios de Aceite Atendidos

✅ **Se 404 → tratar como feature indisponível**:
- Todas as chamadas usam `silent404: true`
- 404 não é logado como erro

✅ **Não logar como erro**:
- `apiFetch` não loga 404 quando `silent404: true`
- Componentes não logam 404 como erro

✅ **Não exibir warning vermelho**:
- 404 retorna valores padrão (arrays vazios, zeros, null)
- UI continua funcionando normalmente

---

## 🔍 Endpoints Tratados

### Cultural Events
- **Endpoint**: `/cultural/events`
- **Função**: `listPublicCulturalEvents()`
- **Fallback**: `{ events: [], next_cursor: null }`
- **Uso**: `SocialFeed2.tsx`, `TodayForYou.tsx`

### Unread Counts
- **Endpoint**: `/social/unread-counts` (fallback: `/feed/unread-counts`)
- **Função**: `getUnreadCounts()`
- **Fallback**: `{ feed: 0, groups: 0, events: 0, services: 0 }`
- **Uso**: `SocialLayout.tsx`

### Wallet/Account
- **Endpoint**: `/economy/accounts/me`
- **Função**: `getMyAccount()`
- **Fallback**: `null`
- **Uso**: `SocialFeed2.tsx`

---

## 📊 Comportamento

### Antes (com 404 ruidoso)

```
[API] ERROR RESPONSE: { status: 404, statusText: 'Not Found', url: '/cultural/events' }
console.warn('Erro ao carregar eventos culturais:', 404)
```

### Depois (404 silencioso)

```
// Nenhum log de erro
// Retorna { events: [], next_cursor: null }
// UI continua funcionando normalmente
```

---

## ⚠️ Notas Importantes

1. **404 não é erro**: Módulos não implementados retornam 404, mas isso é esperado
2. **Fallbacks seguros**: Todos os fallbacks são valores seguros (arrays vazios, zeros, null)
3. **UI não quebra**: Componentes continuam funcionando mesmo sem módulos
4. **Logs limpos**: Console não fica poluído com 404s esperados

---

## 📁 Arquivos Alterados

1. **`frontend/src/api/client.ts`**
   - Adicionada opção `silent404` em `ApiFetchContextOptions`
   - Tratamento de 404 silencioso
   - `apiFetchJson` atualizado para aceitar `contextOptions`

2. **`frontend/src/api/cultural.ts`**
   - `listPublicCulturalEvents()` trata 404 silenciosamente

3. **`frontend/src/api/unread.ts`**
   - `getUnreadCounts()` trata 404 silenciosamente

4. **`frontend/src/api/economy.ts`**
   - `getMyAccount()` trata 404 silenciosamente, retorna `null`

5. **`frontend/src/components/social/SocialFeed2.tsx`**
   - Não loga 404 ao carregar eventos culturais

---

## 🧪 Teste de Validação

### Teste 1: Chamar endpoint não implementado

```typescript
// Chamar /cultural/events (não implementado)
const result = await listPublicCulturalEvents({ limit: 10 });

// Resultado esperado: { events: [], next_cursor: null }
// Console: Nenhum erro ou warning
```

### Teste 2: Verificar logs

```typescript
// Abrir DevTools → Console
// Chamar endpoints não implementados

// Resultado esperado: Nenhum log de erro 404
// Apenas logs normais de funcionamento
```

### Teste 3: UI continua funcionando

```typescript
// Carregar feed com módulos não implementados
// Resultado esperado: Feed carrega normalmente
// Sem warnings vermelhos
// Sem quebras na UI
```

---

**Status**: ✅ Implementado e validado  
**Data**: 2024














