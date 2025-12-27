# ANTI-PATTERNS - UnifiCard

**Documento de padrões proibidos e como evitá-los**

Este documento lista padrões de código que **NUNCA** devem ser usados no UnifiCard, com exemplos concretos de código ruim vs. código correto.

---

## 🔴 Regra 1: Importar `devLog` de `guardrails.ts`

### ❌ BAD
```typescript
// ❌ NUNCA importar devLog de guardrails
import { validateActiveActor, devLog } from '../../utils/guardrails';

// ❌ NUNCA re-exportar devLog de guardrails
export { devLog } from './devLog'; // Em guardrails.ts
```

### ✅ GOOD
```typescript
// ✅ SEMPRE importar devLog diretamente de devLog.ts
import { validateActiveActor } from '../../utils/guardrails';
import { devLog } from '../../utils/devLog';

// ✅ guardrails.ts pode importar devLog internamente (uso próprio)
// Mas NUNCA re-exportar
import { devLog } from './devLog'; // OK para uso interno
```

**Razão:** `guardrails.ts` contém apenas utilitários de validação e segurança. `devLog` é utilitário de logging e deve ser importado separadamente para manter separação de responsabilidades.

---

## 🔴 Regra 2: Validação manual de `activeActor`

### ❌ BAD
```typescript
// ❌ NUNCA validar activeActor manualmente
useEffect(() => {
  if (activeActor) {  // ❌ Validação manual
    loadData();
  }
}, [activeActor]);

// ❌ NUNCA verificar apenas existência
if (!activeActor) {
  return null;
}

// ❌ NUNCA acessar propriedades sem validação completa
const actorId = activeActor?.actor_id; // ❌ Pode estar incompleto
```

### ✅ GOOD
```typescript
// ✅ SEMPRE usar validateActiveActor()
useEffect(() => {
  if (validateActiveActor(activeActor)) {
    loadData();
  }
}, [activeActor?.actor_id]);

// ✅ SEMPRE validar antes de usar
if (!validateActiveActor(activeActor)) {
  return null;
}

// ✅ validateActiveActor garante actor_id e actor_type existem
const actorId = activeActor.actor_id; // ✅ Seguro após validação
```

**Razão:** `validateActiveActor()` garante que `activeActor` não é apenas `null`, mas também possui `actor_id` e `actor_type` válidos. Validações manuais são incompletas e podem causar crashes.

---

## 🔴 Regra 3: Validação manual de arrays e datas

### ❌ BAD - Arrays
```typescript
// ❌ NUNCA usar Array.isArray() manualmente
const events = Array.isArray(culturalEvents.events) 
  ? culturalEvents.events 
  : [];

// ❌ NUNCA assumir que é array
const posts = feedData.posts || []; // ❌ Pode não ser array
```

### ✅ GOOD - Arrays
```typescript
// ✅ SEMPRE usar safeArray() ou funções específicas
const events = safeArray<CulturalEvent>(culturalEvents.events, []);

// ✅ Para tipos específicos, usar funções dedicadas
const posts = safePostsArray(feedData.posts);
const entries = safeLedgerEntries(ledgerResponse.entries);
```

### ❌ BAD - Datas
```typescript
// ❌ NUNCA usar try/catch manual para Date
const todayEntries = allEntries.filter((entry: any) => {
  if (!entry?.created_at) return false;
  try {
    const entryDate = new Date(entry.created_at).getTime();
    return entryDate >= todayStartTime;
  } catch {
    return false;
  }
});

// ❌ NUNCA assumir que Date é válido
const postDate = new Date(post.created_at).getTime(); // ❌ Pode ser NaN
```

### ✅ GOOD - Datas
```typescript
// ✅ SEMPRE usar safeDate()
const todayEntries = allEntries.filter((entry: any) => {
  const entryDate = safeDate(entry?.created_at, 0);
  return entryDate >= todayStartTime;
});

// ✅ safeDate retorna fallback se inválido
const postDate = safeDate(post.created_at, 0); // ✅ Sempre número válido
```

**Razão:** `safeArray()` e `safeDate()` consolidam validação e fallback, eliminando duplicação e garantindo comportamento consistente em todo o código.

---

## 🔴 Regra 4: JSX Fragments atravessando elementos estruturais

### ❌ BAD
```tsx
// ❌ NUNCA Fragment atravessando <main>, <aside>, <section>, <article>
<main className="feed-center">
  {isLoading ? (
    <div>Loading...</div>
  ) : (
    <>  {/* ❌ Fragment dentro de main */}
      <SmartEmptyState />
      {posts.length === 0 ? (
        <div>Empty</div>
      ) : (
        <div>Posts</div>
      )}
    </>  {/* ❌ Fragment fecha dentro de main */}
  )}
</main>

// ❌ NUNCA Fragment aninhado desnecessariamente
<>
  <main>
    <>
      <div>Content</div>
    </>
  </main>
</>
```

### ✅ GOOD
```tsx
// ✅ SEMPRE usar <div> quando Fragment atravessa estrutura
<main className="feed-center">
  {isLoading ? (
    <div>Loading...</div>
  ) : (
    <div>  {/* ✅ div em vez de Fragment */}
      <SmartEmptyState />
      {posts.length === 0 ? (
        <div>Empty</div>
      ) : (
        <div>Posts</div>
      )}
    </div>  {/* ✅ div fecha dentro de main */}
  )}
</main>

// ✅ Fragment OK quando não atravessa estrutura
{showHighlights && (
  <>
    <OnboardingHighlight />
  </>
)}
```

**Razão:** Fragments não podem atravessar elementos estruturais HTML5 (`<main>`, `<aside>`, `<section>`, `<article>`). Isso causa erros de JSX e pode quebrar a renderização.

---

## 🔴 Regra 5: Chamadas de API fora de `safeApiCall()`

### ❌ BAD
```typescript
// ❌ NUNCA chamada de API sem safeApiCall()
const loadData = async () => {
  try {
    const data = await getSocialFeed({ limit: 20 });
    setPosts(data.posts);
  } catch (err) {
    console.error('Erro:', err); // ❌ Erro pode quebrar UI
    // ❌ Sem fallback, posts pode ficar undefined
  }
};

// ❌ NUNCA assumir que API sempre retorna dados
const response = await getLedger({ limit: 50 });
const entries = response.entries; // ❌ Pode ser undefined
```

### ✅ GOOD
```typescript
// ✅ SEMPRE usar safeApiCall() com fallback apropriado
const loadData = async () => {
  const data = await safeApiCall(
    async () => getSocialFeed({ limit: 20 }),
    { posts: [], next_cursor: null, has_more: false }, // ✅ Fallback completo
    'Erro ao carregar feed'
  );
  setPosts(safePostsArray(data.posts));
};

// ✅ safeApiCall garante tipo correto e fallback
const response = await safeApiCall(
  async () => getLedger({ limit: 50 }),
  { entries: [] }, // ✅ Fallback
  'Erro ao carregar ledger'
);
const entries = safeLedgerEntries(response.entries);
```

**Razão:** `safeApiCall()` garante que erros de API não quebrem a UI, sempre retorna um fallback válido, e loga erros apenas em desenvolvimento via `devLog`.

---

## 🔴 Regra 6: Event listeners sem cleanup

### ❌ BAD
```typescript
// ❌ NUNCA listener sem cleanup
useEffect(() => {
  window.addEventListener('cta-confirmed', handleCTAConfirmed);
  // ❌ Sem return, listener nunca é removido
}, []);

// ❌ NUNCA múltiplos listeners do mesmo evento
useEffect(() => {
  window.addEventListener('impact-changed', handler1);
  window.addEventListener('impact-changed', handler2); // ❌ Duplicado
}, []);

// ❌ NUNCA usar objeto completo como dependência
useEffect(() => {
  if (activeActor && event.detail.actor_id === activeActor.actor_id) {
    loadBalance();
  }
}, [activeActor]); // ❌ Objeto completo causa re-renders infinitos
```

### ✅ GOOD
```typescript
// ✅ SEMPRE cleanup em return
useEffect(() => {
  const handleCTAConfirmed = () => {
    loadLedger();
  };
  
  window.addEventListener('cta-confirmed', handleCTAConfirmed);
  return () => {
    window.removeEventListener('cta-confirmed', handleCTAConfirmed);
  };
}, []);

// ✅ SEMPRE usar actor_id como dependência
useEffect(() => {
  if (!validateActiveActor(activeActor)) {
    return;
  }

  const handleImpactChanged = (event: CustomEvent<{ actor_id: string }>) => {
    if (validateActiveActor(activeActor) && 
        event.detail?.actor_id === activeActor.actor_id) {
      loadBalance();
    }
  };

  window.addEventListener('impact-changed', handleImpactChanged as EventListener);
  return () => {
    window.removeEventListener('impact-changed', handleImpactChanged as EventListener);
  };
}, [activeActor?.actor_id, loadBalance]); // ✅ Apenas campos necessários
```

**Razão:** Listeners sem cleanup causam memory leaks. Múltiplos listeners do mesmo evento causam comportamentos duplicados. Dependências de objetos completos causam loops infinitos.

---

## 🔴 Regra 7: Acessar propriedades sem validação

### ❌ BAD
```typescript
// ❌ NUNCA acessar propriedades aninhadas sem validação
const cityName = user.residence.city.name; // ❌ Pode quebrar

// ❌ NUNCA assumir tipos
const amount = entry.amount_cents; // ❌ Pode não ser número

// ❌ NUNCA usar optional chaining sem fallback
const posts = feedData?.posts || []; // ❌ Pode não ser array
```

### ✅ GOOD
```typescript
// ✅ SEMPRE usar safe* functions
const cityName = safeString(
  user?.residence?.city?.name, 
  'Cidade não informada'
);

// ✅ SEMPRE validar números
const amount = safeNumber(entry?.amount_cents, 0);

// ✅ SEMPRE validar arrays
const posts = safePostsArray(feedData?.posts);
```

**Razão:** Propriedades podem ser `null`, `undefined`, ou de tipo incorreto. Funções `safe*` garantem tipos corretos e fallbacks apropriados.

---

## 🔴 Regra 8: Estados vazios tratados como erros

### ❌ BAD
```typescript
// ❌ NUNCA tratar estados vazios como erros
if (posts.length === 0) {
  throw new Error('Nenhum post encontrado'); // ❌ Erro desnecessário
}

if (!activeActor) {
  console.error('activeActor não encontrado'); // ❌ Não é erro durante bootstrap
}

if (balance === 0) {
  return null; // ❌ Saldo zero é válido
}
```

### ✅ GOOD
```typescript
// ✅ Estados vazios são válidos
if (posts.length === 0) {
  return <EmptyState message="Nenhum post ainda" />; // ✅ UI apropriada
}

if (!validateActiveActor(activeActor)) {
  return null; // ✅ Aguardar bootstrap ou redirecionar
}

if (balance === 0) {
  return <ImpactBalanceBadge balance={0} />; // ✅ Mostrar zero
}
```

**Razão:** Estados vazios (`[]`, `0`, `null`) são estados válidos da aplicação, não erros. A UI deve lidar graciosamente com eles.

---

## 📋 Checklist de Validação

Antes de fazer commit, verifique:

- [ ] Nenhum `import { devLog } from 'guardrails'`
- [ ] Todas validações de `activeActor` usam `validateActiveActor()`
- [ ] Nenhum `Array.isArray()` manual (usar `safeArray()`)
- [ ] Nenhum `try/catch` para Date (usar `safeDate()`)
- [ ] Nenhum Fragment `<>` atravessando `<main>`, `<aside>`, `<section>`
- [ ] Todas chamadas de API usam `safeApiCall()`
- [ ] Todos event listeners têm cleanup em `useEffect` return
- [ ] Dependências de `useEffect` usam apenas campos necessários (`actor_id`, não objeto completo)
- [ ] Propriedades acessadas via funções `safe*` quando apropriado
- [ ] Estados vazios não são tratados como erros

---

## 🔗 Referências

- **GOLDEN_PATH.md**: Fluxo crítico do ecossistema
- **frontend/src/utils/guardrails.ts**: Utilitários de validação e segurança
- **frontend/src/utils/devLog.ts**: Utilitário de logging em desenvolvimento

---

## 📝 Notas

- Este documento reflete a arquitetura atual do UnifiCard
- Padrões podem evoluir, mas mudanças devem ser documentadas
- Quando em dúvida, siga o GOLDEN_PATH.md e use os guardrails disponíveis

