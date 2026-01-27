# Correções Frontend - Fluxo Primeiro Acesso

## Contexto
O backend já está corrigido e aceita:
- ✅ Body vazio em `POST /profile/confirm-first-access`
- ✅ PATCH parcial em `PUT /profile`
- ✅ `profile_personal_confirmed` como fonte única da verdade

## Arquivos a Corrigir

### 1. `client.ts` (ou `apiFetch.ts`) - CORREÇÃO CRÍTICA

**Problema:** Envia `Content-Type: application/json` mesmo quando body está vazio, causando erro 400.

**Solução:**

```typescript
// client.ts (ou onde está apiFetch)
export async function apiFetch(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  
  // 🔴 CORREÇÃO CRÍTICA: Só setar Content-Type se existir body
  const hasBody =
    options.body !== undefined &&
    options.body !== null &&
    !(typeof options.body === "string" && options.body.length === 0);

  // Só seta JSON se tiver body
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Se não tem body, não enviar body
  const finalOptions: RequestInit = {
    ...options,
    headers,
  };

  // Se não tem body, remover body do options
  if (!hasBody) {
    delete finalOptions.body;
  }

  return fetch(url, finalOptions);
}
```

### 2. `profile.ts` (ou `api/profile.ts`) - confirmFirstAccess

**Problema:** Não envia body ou envia incorretamente.

**Solução:**

```typescript
// profile.ts (frontend)
export async function confirmFirstAccess() {
  return apiFetch("/profile/confirm-first-access", {
    method: "POST",
    body: JSON.stringify({}), // SEMPRE enviar objeto vazio
  });
}
```

### 3. `Profile.tsx` - handleConfirmFirstAccess

**Problema:** Não recarrega profile após confirmar.

**Solução:**

```typescript
// Profile.tsx
const handleConfirmFirstAccess = async () => {
  try {
    const result = await confirmFirstAccess();
    
    if (!result.ok) {
      throw new Error('Erro ao confirmar primeiro acesso');
    }
    
    // 🔴 CRÍTICO: Recarregar profile para obter flag atualizada
    await loadProfile();
    
    // Fechar modal
    setShowOnboardingModal(false);
    setHasConfirmed(true);
  } catch (error) {
    console.error('Erro ao confirmar primeiro acesso:', error);
    showError('Erro ao confirmar primeiro acesso');
  }
};
```

### 4. `Profile.tsx` - handleSavePersonal

**Problema:** Ordem errada, payload incorreto, modal abre antes de salvar.

**Solução:**

```typescript
// Profile.tsx
const handleSavePersonal = async () => {
  try {
    setSaving(true);
    
    // 🔴 ORDEM OBRIGATÓRIA: 1. Salvar identity primeiro
    const identityPayload: any = {};
    
    if (fullName?.trim()) {
      identityPayload.fullName = fullName.trim();
    }
    
    if (birthdate) {
      // Garantir formato YYYY-MM-DD
      identityPayload.birthdate = formatDateToYYYYMMDD(birthdate);
    }
    
    const identityResult = await updateIdentity(identityPayload);
    
    if (!identityResult.ok) {
      throw new Error('Erro ao salvar dados pessoais');
    }
    
    // 🔴 ORDEM OBRIGATÓRIA: 2. Salvar profile depois
    const profilePayload: any = {};
    
    // Phone (se preenchido)
    if (phone?.trim()) {
      profilePayload.phone = phone.trim();
    }
    
    // Metadata (fazer merge com existente)
    profilePayload.metadata = {
      ...(profile?.metadata || {}),
    };
    
    // Gender (se preenchido)
    if (gender) {
      profilePayload.metadata.gender = gender;
    }
    
    // Endereço (se completo)
    if (cep && address && neighborhood && city && state && addressNumber) {
      profilePayload.metadata.address = {
        cep: cep.replace(/\D/g, ''),
        address: address.trim(),
        addressNumber: addressNumber.trim(),
        complement: complement?.trim() || '',
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim(),
      };
    }
    
    const profileResult = await updateProfile(profilePayload);
    
    if (!profileResult.ok) {
      throw new Error('Erro ao salvar perfil');
    }
    
    // 🔴 ORDEM OBRIGATÓRIA: 3. Só mostrar modal se ainda não confirmado
    // Recarregar profile para obter flag atualizada
    await loadProfile();
    
    // Só mostrar modal se profile_personal_confirmed = false
    if (!profile?.profile_personal_confirmed) {
      setShowOnboardingModal(true);
    } else {
      showSuccess('Perfil salvo com sucesso');
    }
    
  } catch (error) {
    console.error('Erro ao salvar:', error);
    showError(error instanceof Error ? error.message : 'Erro ao salvar perfil');
    // 🔴 CRÍTICO: NÃO reabrir modal em caso de erro
  } finally {
    setSaving(false);
  }
};
```

### 5. `Profile.tsx` - Hidratação (useEffect)

**Problema:** Reseta campos para null quando backend não retorna.

**Solução:**

```typescript
// Profile.tsx

// ❌ ERRADO - reseta com null
// useEffect(() => {
//   setBirthdate(data?.global?.birthdate || null);
// }, [data?.global?.birthdate]);

// ✅ CORRETO - só atualizar se vier valor
useEffect(() => {
  if (data?.global?.birthdate) {
    setBirthdate(data.global.birthdate);
  }
  // Se não vier, manter valor atual do estado
}, [data?.global?.birthdate]);

useEffect(() => {
  if (data?.global?.fullName) {
    setFullName(data.global.fullName);
  }
}, [data?.global?.fullName]);

useEffect(() => {
  if (data?.profile?.metadata?.gender) {
    setGender(data.profile.metadata.gender);
  }
}, [data?.profile?.metadata?.gender]);

useEffect(() => {
  if (data?.profile?.phone) {
    setPhone(data.profile.phone);
  }
}, [data?.profile?.phone]);
```

### 6. `Profile.tsx` - Controle de Cadeado

**Problema:** Infere cadeado por estado local em vez de usar flag do backend.

**Solução:**

```typescript
// Profile.tsx

// ❌ ERRADO - inferir por estado local
// const isLocked = !!birthdate && !!fullName;

// ✅ CORRETO - usar flag do backend
const canEditPersonal = !profile?.profile_personal_confirmed;

// No JSX
<input 
  disabled={!canEditPersonal}
  readOnly={!canEditPersonal}
  value={fullName}
  onChange={(e) => setFullName(e.target.value)}
/>

<input 
  disabled={!canEditPersonal}
  readOnly={!canEditPersonal}
  value={birthdate}
  onChange={(e) => setBirthdate(e.target.value)}
/>

<select 
  disabled={!canEditPersonal}
  value={gender}
  onChange={(e) => setGender(e.target.value)}
>
  {/* options */}
</select>
```

### 7. `Profile.tsx` - Controle do Modal

**Problema:** Modal abre infinitamente ou não abre quando deveria.

**Solução:**

```typescript
// Profile.tsx

// ✅ CORRETO - usar flag do backend exclusivamente
useEffect(() => {
  // Só mostrar modal se:
  // 1. profile_personal_confirmed = false (não confirmado)
  // 2. Ainda não foi confirmado nesta sessão
  const shouldShow = !profile?.profile_personal_confirmed && !hasConfirmed;
  setShowOnboardingModal(shouldShow);
}, [profile?.profile_personal_confirmed, hasConfirmed]);

// Estado para controlar se já foi confirmado nesta sessão
const [hasConfirmed, setHasConfirmed] = useState(false);
```

## Função Auxiliar Necessária

```typescript
// utils/date.ts (ou similar)
export function formatDateToYYYYMMDD(date: string | Date): string {
  if (!date) return '';
  
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Se for string DD/MM/YYYY, converter para YYYY-MM-DD
  if (typeof date === 'string' && date.includes('/')) {
    const [day, month, year] = date.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Se já for YYYY-MM-DD, retornar como está
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  
  return '';
}
```

## Checklist de Implementação

- [ ] Corrigir `apiFetch` para não enviar Content-Type sem body
- [ ] Corrigir `confirmFirstAccess` para sempre enviar `{}`
- [ ] Corrigir `handleConfirmFirstAccess` para recarregar profile após confirmar
- [ ] Corrigir `handleSavePersonal` para seguir ordem: identity → profile → modal
- [ ] Corrigir hidratação para não resetar campos com null
- [ ] Corrigir controle de cadeado para usar `profile_personal_confirmed`
- [ ] Corrigir controle do modal para usar `profile_personal_confirmed`
- [ ] Adicionar função `formatDateToYYYYMMDD` se não existir

## Teste Final

1. Criar usuário novo
2. Entrar em `/perfil`
3. Verificar: Modal aparece, campos SEM cadeado
4. Preencher dados e clicar "Salvar Informações Pessoais"
5. Verificar: `identity/update` retorna 200, `profile/update` retorna 200
6. Verificar: Modal aparece após salvar
7. Clicar "Entendi, continuar"
8. Verificar: `confirm-first-access` retorna 200 (não 400)
9. Verificar: Campos ficam COM cadeado
10. Recarregar página (F5)
11. Verificar: `birthdate` permanece, modal NÃO reaparece, cadeado permanece

## Notas Importantes

- **NUNCA** inferir estado de cadeado por existência de dados
- **SEMPRE** usar `profile_personal_confirmed` do backend
- **NUNCA** resetar campos para null se backend não retornar
- **SEMPRE** seguir ordem: identity → profile → modal
- **NUNCA** reabrir modal após erro

