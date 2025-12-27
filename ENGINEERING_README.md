# UnifiCard — Engineering README

Este documento define **como trabalhar neste repositório sem quebrar o sistema**.  
**Leia antes de escrever qualquer código.**

---

## 📚 Documentos Essenciais

Antes de começar, leia estes documentos na ordem:

1. **[GOLDEN_PATH.md](./GOLDEN_PATH.md)** — Fluxo crítico que NÃO pode quebrar
2. **[ANTI_PATTERNS.md](./ANTI_PATTERNS.md)** — Padrões proibidos e como evitá-los
3. Este documento — Guia prático de trabalho

---

## 1. Golden Path (Fluxo que NÃO pode quebrar)

O UnifiCard tem um caminho crítico único. **Tudo gira em torno dele.**

### Golden Path obrigatório

```
Login → SessionProvider → activeActor → Feed → CTA → Ledger → Impacto → Recorrência
```

**Cada etapa depende da anterior. Se uma quebra, tudo quebra.**

#### 1.1 Autenticação e Contexto
```
Login → SessionProvider → activeActor
```

**O que acontece:**
- Usuário faz login
- `SessionProvider` inicializa sessão e carrega atores
- Define `activeActor` como fonte única da verdade
- Componentes consomem via `useActiveActor()`

**Regra crítica:** `activeActor` pode ser `null` durante bootstrap, mas após bootstrap nunca deve ser `null` sem redirecionamento.

**Nunca faça:**
- Usar `activeActor` sem `validateActiveActor()`
- Validar manualmente: `if (activeActor)` ❌
- Acessar `activeActor.actor_id` sem validação

**Sempre faça:**
```typescript
import { validateActiveActor } from '../../utils/guardrails';

if (!validateActiveActor(activeActor)) {
  return null; // ou redirecionar
}
```

---

#### 1.2 Feed e Descoberta
```
Feed → Ordenação → Descoberta → CTA
```

**O que acontece:**
- `SocialFeed2` carrega feed via `getSocialFeed()` com `activeActor`
- Posts são ordenados por relevância (scoring)
- `CommunityActivitySummary` mostra atividade recente
- `TodayForYou` gera sugestão contextual
- `PostCard` exibe CTA quando disponível

**Regra crítica:** Feed nunca pode quebrar. Erros são silenciosos, fallbacks são seguros.

**Nunca faça:**
- Chamada de API sem `safeApiCall()`
- Assumir que feed sempre tem posts
- Quebrar renderização se API falhar

**Sempre faça:**
```typescript
import { safeApiCall, safePostsArray } from '../../utils/guardrails';

const data = await safeApiCall(
  async () => getSocialFeed({ limit: 20 }),
  { posts: [], next_cursor: null, has_more: false },
  'Erro ao carregar feed'
);
const posts = safePostsArray(data.posts);
```

---

#### 1.3 Transação e Impacto
```
CTA → Confirmação → Ledger → Impacto
```

**O que acontece:**
- Usuário clica em CTA → `CTAModal` abre
- Usuário confirma → `confirmCTA()` é chamado
- Backend processa → cria entries no ledger
- `impact-changed` é disparado → `ImpactBalanceBadge` atualiza
- `cta-confirmed` é disparado → componentes recarregam

**Regra crítica:** Confirmação de CTA requer `activeActor` válido. Impacto deve atualizar após confirmação.

**Nunca faça:**
- Confirmar CTA sem validar `activeActor`
- Usar `amount_cents` sem `safeNumber()`
- Esquecer de disparar eventos após confirmação

**Sempre faça:**
```typescript
if (!validateActiveActor(activeActor)) {
  throw new Error('Nenhum ator ativo selecionado');
}

const amount = safeNumber(entry?.amount_cents, 0);

window.dispatchEvent(new CustomEvent('cta-confirmed'));
window.dispatchEvent(new CustomEvent('impact-changed', {
  detail: { actor_id: activeActor.actor_id, actor_type: activeActor.actor_type }
}));
```

---

#### 1.4 Recorrência e Comunidade
```
Impacto → Saldo → Comunidade → Recorrência
```

**O que acontece:**
- `ImpactBalanceBadge` exibe saldo atualizado
- `PersonalProgressCard` detecta inatividade semanal
- `CommunityActivitySummary` mostra impacto gerado hoje
- `TodayForYou` sugere próximo passo
- Feed recarrega mostrando atividade recente

**Regra crítica:** Estados vazios são válidos. Saldo zero não é erro. Array vazio não é erro.

**Nunca faça:**
- Tratar saldo zero como erro
- Quebrar renderização se array estiver vazio
- Usar objeto completo como dependência de `useEffect`

**Sempre faça:**
```typescript
const balance = await safeApiCall(
  async () => getImpactBalance(),
  { balance: 0, currency: 'BRL' },
  'Erro ao carregar saldo'
);

useEffect(() => {
  // ...
}, [activeActor?.actor_id]); // ✅ Apenas campo necessário, não objeto completo
```

---

## 2. Guardrails (Proteções Obrigatórias)

### 2.1 Validação de activeActor

**SEMPRE usar:**
```typescript
import { validateActiveActor } from '../../utils/guardrails';

if (!validateActiveActor(activeActor)) {
  return null;
}
```

**NUNCA usar:**
```typescript
if (activeActor) { } // ❌ Validação incompleta
if (!activeActor) { } // ❌ Validação incompleta
```

---

### 2.2 Chamadas de API

**SEMPRE usar:**
```typescript
import { safeApiCall } from '../../utils/guardrails';

const data = await safeApiCall(
  async () => getSocialFeed({ limit: 20 }),
  { posts: [], next_cursor: null, has_more: false }, // Fallback completo
  'Erro ao carregar feed' // Mensagem opcional
);
```

**NUNCA usar:**
```typescript
try {
  const data = await getSocialFeed({ limit: 20 });
} catch (err) {
  console.error(err); // ❌ Erro pode quebrar UI
}
```

---

### 2.3 Validação de Dados

**SEMPRE usar:**
```typescript
import { safeDate, safeNumber, safeString, safeArray, safePostsArray } from '../../utils/guardrails';

const date = safeDate(entry?.created_at, 0);
const amount = safeNumber(entry?.amount_cents, 0);
const name = safeString(user?.name, 'Nome não informado');
const events = safeArray<Event>(data.events, []);
const posts = safePostsArray(feedData.posts);
```

**NUNCA usar:**
```typescript
const date = new Date(entry.created_at).getTime(); // ❌ Pode ser NaN
const amount = entry.amount_cents; // ❌ Pode não ser número
Array.isArray(data.events) ? data.events : []; // ❌ Duplicação
```

---

### 2.4 Logging

**SEMPRE usar:**
```typescript
import { devLog } from '../../utils/devLog';

devLog.warn('Aviso não crítico:', data);
devLog.error('Erro:', err);
devLog.log('Informação:', info);
```

**NUNCA usar:**
```typescript
import { devLog } from '../../utils/guardrails'; // ❌ Import errado
console.warn('Aviso'); // ❌ Polui produção
console.error('Erro'); // ❌ Polui produção
```

---

### 2.5 Event Listeners

**SEMPRE usar:**
```typescript
useEffect(() => {
  const handleEvent = () => {
    // ...
  };

  window.addEventListener('cta-confirmed', handleEvent);
  return () => {
    window.removeEventListener('cta-confirmed', handleEvent);
  };
}, [activeActor?.actor_id]); // ✅ Apenas campo necessário
```

**NUNCA usar:**
```typescript
useEffect(() => {
  window.addEventListener('cta-confirmed', handler);
  // ❌ Sem cleanup
}, [activeActor]); // ❌ Objeto completo causa loops
```

---

### 2.6 JSX Structure

**SEMPRE usar:**
```tsx
<main>
  {condition ? (
    <div> {/* ✅ div em vez de Fragment */}
      <Component1 />
      <Component2 />
    </div>
  ) : (
    <div>Empty</div>
  )}
</main>
```

**NUNCA usar:**
```tsx
<main>
  {condition ? (
    <> {/* ❌ Fragment atravessando main */}
      <Component1 />
      <Component2 />
    </>
  ) : (
    <div>Empty</div>
  )}
</main>
```

---

## 3. Checklist Pré-Commit

Antes de fazer commit, verifique:

- [ ] Nenhum `import { devLog } from 'guardrails'`
- [ ] Todas validações de `activeActor` usam `validateActiveActor()`
- [ ] Nenhum `Array.isArray()` manual (usar `safeArray()`)
- [ ] Nenhum `try/catch` para Date (usar `safeDate()`)
- [ ] Nenhum Fragment `<>` atravessando `<main>`, `<aside>`, `<section>`
- [ ] Todas chamadas de API usam `safeApiCall()`
- [ ] Todos event listeners têm cleanup em `useEffect` return
- [ ] Dependências de `useEffect` usam apenas campos necessários
- [ ] Propriedades acessadas via funções `safe*` quando apropriado
- [ ] Estados vazios não são tratados como erros

---

## 4. Princípios Fundamentais

### 4.1 Feed nunca quebra
Erros são silenciosos, fallbacks são seguros. Feed vazio não é erro.

### 4.2 activeActor é fonte única
Sempre validar antes de usar. Nunca assumir que existe.

### 4.3 Eventos são unidirecionais
Disparar após mudança, escutar para atualizar. Sempre cleanup.

### 4.4 Estados vazios são válidos
`[]`, `0`, `null` não são erros. UI deve lidar graciosamente.

### 4.5 Logs apenas em DEV
Usar `devLog` para não poluir produção.

---

## 5. Estrutura de Arquivos

```
frontend/src/
├── utils/
│   ├── guardrails.ts      # Validação e segurança (NÃO exporta devLog)
│   └── devLog.ts          # Logging em desenvolvimento
├── contexts/
│   ├── SessionProvider.tsx # Bootstrap de sessão e activeActor
│   └── ActiveActorContext.tsx # Hook useActiveActor()
└── components/
    └── social/
        ├── SocialFeed2.tsx           # Feed principal
        ├── CommunityActivitySummary.tsx
        ├── TodayForYou.tsx
        ├── ImpactBalanceBadge.tsx
        └── PersonalProgressCard.tsx
```

---

## 6. Comandos Úteis

```bash
# Verificar erros TypeScript
cd frontend && pnpm exec tsc --noEmit

# Verificar linter
cd frontend && pnpm run lint

# Rodar em desenvolvimento
cd frontend && pnpm dev
```

---

## 7. Quando em Dúvida

1. **Leia GOLDEN_PATH.md** — Entenda o fluxo crítico
2. **Leia ANTI_PATTERNS.md** — Veja o que NÃO fazer
3. **Use os guardrails** — `validateActiveActor()`, `safeApiCall()`, `safe*()`
4. **Teste estados vazios** — Feed vazio, saldo zero, sem posts
5. **Valide activeActor** — Sempre antes de usar

---

## 8. Referências Rápidas

### Imports Corretos
```typescript
// ✅ Guardrails (validação e segurança)
import { 
  validateActiveActor, 
  safeApiCall, 
  safeDate, 
  safeNumber, 
  safeString, 
  safeArray,
  safePostsArray,
  safeLedgerEntries 
} from '../../utils/guardrails';

// ✅ Logging (separado)
import { devLog } from '../../utils/devLog';

// ✅ Contexto
import { useActiveActor } from '../../contexts/ActiveActorContext';
```

### Validação de activeActor
```typescript
// ✅ Sempre assim
if (!validateActiveActor(activeActor)) {
  return null;
}

// ✅ Em useEffect
useEffect(() => {
  if (validateActiveActor(activeActor)) {
    loadData();
  }
}, [activeActor?.actor_id]);
```

### Chamada de API Segura
```typescript
// ✅ Sempre com fallback completo
const data = await safeApiCall(
  async () => getSocialFeed({ limit: 20 }),
  { posts: [], next_cursor: null, has_more: false },
  'Erro ao carregar feed'
);
```

---

## 9. Suporte

- **Documentação:** Veja `GOLDEN_PATH.md` e `ANTI_PATTERNS.md`
- **Código:** Veja exemplos em `SocialFeed2.tsx`, `CommunityActivitySummary.tsx`
- **Guardrails:** Veja `frontend/src/utils/guardrails.ts`

---

**Lembre-se:** O Golden Path é sagrado. Se você quebrá-lo, tudo quebra.  
**Use os guardrails. Sempre.**

