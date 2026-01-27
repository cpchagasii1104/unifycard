# Contrato Técnico: INTENTS (Intenções de Ação)

**Data**: 2024-12-19  
**Escopo**: Primeira camada real de INTENTS como contrato técnico

---

## 1. CONCEITO DE INTENT

### Definição

**Intent ≠ Capacidade ≠ Permissão**

- **Intent**: O "por quê" da ação, o significado do evento, o que o sistema entende semanticamente
- **Capacidade**: Ação possível no sistema, associada ao tipo de Actor
- **Permissão**: Validação pontual baseada em estado (reputação, verificação, etc)

### Relação

- **Intent define semântica** - o que a ação significa
- **Capacidade valida se Actor pode fazer** - baseado no tipo de Actor
- **Permissão valida se Actor pode fazer agora** - baseado em estado

### Blindagens

- 🔴 **UI NÃO decide intent** - intent é semântica explícita
- 🔴 **Payload NÃO define semântica** - intent define semântica
- 🔴 **Nada implícito, nada mágico** - tudo explícito em código

---

## 2. ENUM DE INTENTS

### Localização
`src/modules/social/actor-intents.types.ts`

### Enum `ActorIntent`

```typescript
export enum ActorIntent {
  // Conteúdo Social
  SHARE_CONTENT = 'SHARE_CONTENT', // Compartilhar conteúdo (personal, friends)
  ANNOUNCE_EVENT = 'ANNOUNCE_EVENT', // Anunciar evento
  
  // Ofertas e Serviços
  OFFER_SERVICE = 'OFFER_SERVICE', // Ofertar serviço (service_offer)
  OFFER_PRODUCT = 'OFFER_PRODUCT', // Ofertar produto (product_offer)
  REQUEST_BOOKING = 'REQUEST_BOOKING', // Solicitar agendamento (booking)
  
  // Projetos e Oportunidades
  CREATE_PROJECT = 'CREATE_PROJECT', // Criar projeto (project)
  ANNOUNCE_JOB = 'ANNOUNCE_JOB', // Anunciar vaga (futuro)
  
  // Ações Sociais
  START_VOTE = 'START_VOTE', // Iniciar votação (vote)
  REQUEST_HELP = 'REQUEST_HELP', // Solicitar ajuda (futuro)
  
  // Economia
  SEND_CTA = 'SEND_CTA', // Enviar Call-to-Action
  RECEIVE_PAYMENT = 'RECEIVE_PAYMENT', // Receber pagamento (futuro)
}
```

### Mapeamento Legado

Para compatibilidade com código existente que usa strings:

```typescript
const LEGACY_INTENT_MAP: Record<string, ActorIntent> = {
  'personal': ActorIntent.SHARE_CONTENT,
  'friends': ActorIntent.SHARE_CONTENT,
  'event': ActorIntent.ANNOUNCE_EVENT,
  'service_offer': ActorIntent.OFFER_SERVICE,
  'product_offer': ActorIntent.OFFER_PRODUCT,
  'booking': ActorIntent.REQUEST_BOOKING,
  'project': ActorIntent.CREATE_PROJECT,
  'vote': ActorIntent.START_VOTE,
};
```

---

## 3. MAPA INTENT → CAPACIDADES

### Localização
`src/modules/social/actor-intents.service.ts` - `INTENT_CAPABILITY_MAP`

### Mapa Completo

| Intent | Capacidades Exigidas |
|--------|---------------------|
| `SHARE_CONTENT` | `POST_CONTENT` |
| `ANNOUNCE_EVENT` | `POST_CONTENT`, `CREATE_EVENT` |
| `OFFER_SERVICE` | `POST_CONTENT` |
| `OFFER_PRODUCT` | `POST_CONTENT` |
| `REQUEST_BOOKING` | `POST_CONTENT` |
| `CREATE_PROJECT` | `POST_CONTENT`, `CREATE_PROJECT` |
| `ANNOUNCE_JOB` | `POST_CONTENT`, `CREATE_JOB` |
| `START_VOTE` | `POST_CONTENT`, `VOTE` |
| `REQUEST_HELP` | `POST_CONTENT` |
| `SEND_CTA` | `POST_CONTENT`, `CREATE_CTA` |
| `RECEIVE_PAYMENT` | `RECEIVE_FUNDS` |

### Regras

- **Nada implícito** - cada intent tem capacidades explícitas
- **Nada mágico** - tudo definido em código
- **Validação centralizada** - nenhuma rota valida manualmente

---

## 4. VALIDADOR CENTRAL

### Localização
`src/modules/social/actor-intents.service.ts` - `validateIntent()`

### Método

```typescript
async validateIntent(
  tenantId: string,
  actorId: string,
  intent: string | ActorIntent | undefined,
  companyStatus?: string
): Promise<IntentValidationResult>
```

### Fluxo de Validação

1. **Normalizar intent** (converter string legado para enum)
2. **Buscar actor** (verificar se existe)
3. **Verificar capacidades exigidas** (baseado no mapa)
4. **Verificar permissões** (se aplicável - para VOTE, CREATE_PROJECT, SEND_CTA)
5. **Retornar resultado explícito**

### Resultado

```typescript
interface IntentValidationResult {
  valid: boolean;
  reason?: string; // Motivo se inválido
  requiredCapability?: string; // Capacidade exigida se inválido
}
```

---

## 5. INTEGRAÇÃO COM CÓDIGO EXISTENTE

### Localização
`src/modules/social/social-2.0.service.ts` - `createPost()`

### Antes (Validação Manual)

```typescript
// ❌ Validação manual em múltiplos lugares
if (intent === 'vote') {
  const voteCapabilityCheck = await actorCapabilitiesService.hasCapability(...);
  if (!voteCapabilityCheck.hasCapability) { ... }
}
if (intent === 'project') {
  const projectCapabilityCheck = await actorCapabilitiesService.hasCapability(...);
  if (!projectCapabilityCheck.hasCapability) { ... }
}
// ... mais validações manuais
```

### Depois (Validação Centralizada)

```typescript
// ✅ Validação centralizada em um único lugar
const intentValidation = await actorIntentsService.validateIntent(
  tenantId,
  actor.actor_id,
  intent,
  companyStatus || undefined
);

if (!intentValidation.valid) {
  throw HttpError.forbidden(intentValidation.reason || `Invalid intent: ${intent}`);
}
```

### Benefícios

- **Nenhuma rota valida intent manualmente** - tudo centralizado
- **Erros consistentes** - mesma mensagem em todos os lugares
- **Fácil manutenção** - mudanças em um único lugar
- **Auditável** - fácil verificar onde intents são validados

---

## 6. ONDE INTENT É VALIDADO

### Backend

1. **`social-2.0.service.ts` - `createPost()`**:
   - Linha 660-675: Valida intent usando `actorIntentsService.validateIntent()`
   - Substitui todas as validações manuais anteriores

2. **`actor-intents.service.ts` - `validateIntent()`**:
   - Validação centralizada de todos os intents
   - Verifica capacidades exigidas
   - Verifica permissões quando aplicável

---

## 7. ONDE INTENT É USADO

### Backend

1. **`social-2.0.service.ts`**:
   - `createPost()` - Recebe intent explícito, valida, executa
   - `getFeed()` - Filtra posts por intent
   - `getPost()` - Retorna intent do post

2. **`social-2.0.routes.ts`**:
   - `POST /social/posts` - Recebe intent no body
   - Schema Zod valida intent como enum

3. **`social-votes.service.ts`**:
   - Verifica se post tem `intent === 'vote'` antes de processar voto

---

## 8. EXEMPLOS DE ERRO QUANDO INTENT É INVÁLIDO

### Exemplo 1: Intent inválido

**Cenário**: Tentar criar post com `intent = 'invalid_intent'`

**Erro**:
- Status: `403 Forbidden`
- Mensagem: `"Invalid intent: invalid_intent. Must be one of: SHARE_CONTENT, ANNOUNCE_EVENT, ..."`

**Localização**: `actor-intents.service.ts` linha 58-63

---

### Exemplo 2: Actor sem capacidade para intent

**Cenário**: Channel tentando criar post com `intent = 'START_VOTE'`

**Erro**:
- Status: `403 Forbidden`
- Mensagem: `"Actor does not have required capability: VOTE"`

**Localização**: `actor-intents.service.ts` linha 80-88

---

### Exemplo 3: Actor sem permissão para intent

**Cenário**: User com reputação baixa tentando criar post com `intent = 'START_VOTE'`

**Erro**:
- Status: `403 Forbidden`
- Mensagem: `"Actor does not have permission to vote. Continue using the platform to unlock this feature."`

**Localização**: `actor-intents.service.ts` linha 95-101

---

## 9. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`actor-intents.types.ts`**:
   - Explica diferença entre intent, capacidade e permissão
   - Explica por que UI não decide intent
   - Explica por que payload não define semântica

2. **`actor-intents.service.ts`**:
   - Comentários em cada método explicando propósito
   - Mapa explícito com comentários sobre validação
   - Fluxo de validação documentado

3. **`social-2.0.service.ts`**:
   - Validação centralizada substitui validações manuais
   - Comentários explicando por que validação é centralizada

---

## 10. AUDITORIA

### Verificações Realizadas

- ✅ **Nenhum `if(actorType)` decide comportamento** - comportamento é baseado em intent
- ✅ **Nenhuma rota ignora intent** - todas as rotas que criam posts validam intent
- ✅ **Erros são 403 explícitos** - mensagens claras e consistentes

### Locais Auditados

1. **`social-2.0.service.ts`**:
   - ✅ `createPost()` - Valida intent centralizadamente
   - ✅ Removidas validações manuais de intent

2. **`social-2.0.routes.ts`**:
   - ✅ Schema Zod valida intent como enum
   - ✅ Rotas passam intent para service

3. **`social-votes.service.ts`**:
   - ✅ Verifica `intent === 'vote'` antes de processar
   - ✅ Mantido para compatibilidade com banco de dados

---

## ARQUIVOS ALTERADOS/CRIADOS

### Backend
1. `src/modules/social/actor-intents.types.ts` (NOVO)
   - Enum `ActorIntent`
   - Interface `IntentValidationResult`
   - Mapeamentos legado

2. `src/modules/social/actor-intents.service.ts` (NOVO)
   - Mapa `INTENT_CAPABILITY_MAP`
   - Método `validateIntent()`
   - Métodos auxiliares

3. `src/modules/social/social-2.0.service.ts`
   - Substituição de validações manuais por validação centralizada
   - Uso de `actorIntentsService.validateIntent()`

---

## VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS
- ✅ Frontend: `pnpm run build` → PASS

---

## MAPA FINAL INTENT → CAPACIDADES

### SHARE_CONTENT
```typescript
[POST_CONTENT]
```

### ANNOUNCE_EVENT
```typescript
[POST_CONTENT, CREATE_EVENT]
```

### OFFER_SERVICE
```typescript
[POST_CONTENT]
```

### OFFER_PRODUCT
```typescript
[POST_CONTENT]
```

### REQUEST_BOOKING
```typescript
[POST_CONTENT]
```

### CREATE_PROJECT
```typescript
[POST_CONTENT, CREATE_PROJECT]
```

### ANNOUNCE_JOB
```typescript
[POST_CONTENT, CREATE_JOB]
```

### START_VOTE
```typescript
[POST_CONTENT, VOTE]
```

### REQUEST_HELP
```typescript
[POST_CONTENT]
```

### SEND_CTA
```typescript
[POST_CONTENT, CREATE_CTA]
```

### RECEIVE_PAYMENT
```typescript
[RECEIVE_FUNDS]
```

---

## RELAÇÃO ENTRE INTENT, CAPACIDADE E PERMISSÃO

### Fluxo de Validação

1. **Validar Intent**:
   - Normalizar intent (string → enum)
   - Verificar se intent é válido

2. **Verificar Capacidades**:
   - Baseado no mapa `INTENT_CAPABILITY_MAP`
   - Se não tem capacidade → erro 403 imediato

3. **Verificar Permissões**:
   - Baseado em capacidade + estado (reputação, verificação)
   - Se não tem permissão → erro 403 com mensagem de estado

### Exemplo Prático

**Cenário**: User com reputação baixa tenta criar post com `intent = 'START_VOTE'`

1. **Intent**: ✅ `START_VOTE` é válido
2. **Capacidade**: ✅ `user` tem `VOTE` no mapa
3. **Permissão**: ❌ `canVote = false` (reputação < 1)
4. **Resultado**: Erro 403 - `"Actor does not have permission to vote. Continue using the platform to unlock this feature."`

---

**Status Final**: ✅ **CONTRATO TÉCNICO DE INTENTS IMPLEMENTADO E VALIDADO**

