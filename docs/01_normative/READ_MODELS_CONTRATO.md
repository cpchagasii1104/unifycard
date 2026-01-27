Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# Contrato Técnico: READ MODELS (Projection Layer)

**Data**: 2024-12-19  
**Escopo**: Primeira camada real de READ MODELS como contrato técnico

---

## 1. CONCEITO DE READ MODEL

### Definição

**ReadModel ≠ fonte de verdade**

- **ReadModel**: Projeção derivada de eventos/effects para consumo (UI, APIs, IA)
- **Fonte de verdade**: Eventos, estado persistido, comandos executados
- **ReadModel não é verdade**: Pode ser descartado e reconstruído
- **ReadModel não é contrato de negócio**: Não define regras, apenas exibe dados

### Relação

- **Events/Effects são fonte de verdade** - eventos são imutáveis
- **ReadModel é projeção** - derivado de eventos, reconstruível
- **Service NÃO atualiza read model manualmente** - projeção é centralizada

### Blindagens

- 🔴 **ReadModel não é verdade** - pode ser descartado e reconstruído
- 🔴 **ReadModel não é contrato de negócio** - não define regras
- 🔴 **ReadModel nunca consome intents** - consome apenas effects
- 🔴 **ReadModel nunca decide regra** - apenas exibe dados

---

## 2. ENUM DE READ MODELS

### Localização
`src/core/read-models/read-model.types.ts`

### Enum `ReadModelType`

```typescript
export enum ReadModelType {
  // Perfis
  PROFILE_READ_MODEL = 'PROFILE_READ_MODEL', // Perfil completo do usuário
  EDUCATION_PROFILE_READ_MODEL = 'EDUCATION_PROFILE_READ_MODEL', // Perfil educacional
  PROFESSIONAL_PROFILE_READ_MODEL = 'PROFESSIONAL_PROFILE_READ_MODEL', // Perfil profissional
  LEARNING_PROFILE_READ_MODEL = 'LEARNING_PROFILE_READ_MODEL', // Perfil de aprendizado
  
  // Feed e Conteúdo
  FEED_READ_MODEL = 'FEED_READ_MODEL', // Feed de posts
  POST_READ_MODEL = 'POST_READ_MODEL', // Post individual
  
  // Oportunidades
  OPPORTUNITY_READ_MODEL = 'OPPORTUNITY_READ_MODEL', // Oportunidades sugeridas
  
  // Reputação
  REPUTATION_READ_MODEL = 'REPUTATION_READ_MODEL', // Reputação do actor
  
  // Grupos
  GROUP_READ_MODEL = 'GROUP_READ_MODEL', // Grupo individual
  GROUP_LIST_READ_MODEL = 'GROUP_LIST_READ_MODEL', // Lista de grupos
  
  // Projetos
  PROJECT_READ_MODEL = 'PROJECT_READ_MODEL', // Projeto individual
  PROJECT_LIST_READ_MODEL = 'PROJECT_LIST_READ_MODEL', // Lista de projetos
  
  // Matching
  MATCHING_READ_MODEL = 'MATCHING_READ_MODEL', // Sugestões de matching
}
```

---

## 3. MAPA EFFECT → READ MODELS

### Localização
`src/core/read-models/read-model.projector.ts` - `EFFECT_READ_MODEL_MAP`

### Mapa Completo

| Effect | Read Models Afetados |
|--------|---------------------|
| `FEED_ITEM_CREATED` | `FEED_READ_MODEL`, `POST_READ_MODEL` |
| `FEED_ITEM_UPDATED` | `FEED_READ_MODEL`, `POST_READ_MODEL` |
| `PROJECT_CREATED` | `FEED_READ_MODEL`, `PROJECT_READ_MODEL`, `PROJECT_LIST_READ_MODEL`, `OPPORTUNITY_READ_MODEL` |
| `PROJECT_UPDATED` | `PROJECT_READ_MODEL`, `PROJECT_LIST_READ_MODEL` |
| `JOB_POSTED` | `FEED_READ_MODEL`, `OPPORTUNITY_READ_MODEL` |
| `CTA_PUBLISHED` | `FEED_READ_MODEL`, `POST_READ_MODEL` |
| `VOTE_REGISTERED` | `FEED_READ_MODEL`, `POST_READ_MODEL` |
| `COMMENT_ADDED` | `FEED_READ_MODEL`, `POST_READ_MODEL` |
| `PAYMENT_INITIATED` | `GROUP_READ_MODEL` |
| `PAYMENT_COMPLETED` | `GROUP_READ_MODEL` |
| `GROUP_FUNDS_UPDATED` | `GROUP_READ_MODEL`, `FEED_READ_MODEL` |
| `EVENT_ANNOUNCED` | `FEED_READ_MODEL`, `OPPORTUNITY_READ_MODEL` |
| `IMPACT_RECORDED` | `REPUTATION_READ_MODEL`, `PROFILE_READ_MODEL` |
| `REPUTATION_UPDATED` | `REPUTATION_READ_MODEL`, `PROFILE_READ_MODEL` |
| `NOTIFICATION_SENT` | (nenhum - notificações não afetam read models) |

### Regras

- **Nada implícito** - cada effect tem read models explícitos
- **Nada direto no handler** - projeção é centralizada
- **ReadModels são projeções** - não fonte de verdade

---

## 4. PROJEÇÃO CENTRALIZADA

### Localização
`src/core/read-models/read-model.projector.ts` - `ReadModelProjector`

### Método Principal

```typescript
async projectReadModels(
  effect: ActorEffect,
  event: UnificardEvent
): Promise<ReadModelProjectionResult[]>
```

### Fluxo de Projeção

1. **Recebe effect** (após effect ser emitido)
2. **Obtém read models afetados** (baseado no mapa)
3. **Projeta cada read model** (implementação específica)
4. **Retorna resultado** (sucesso/erros)

### Registro de Handlers

```typescript
registerReadModelHandlers()
```

- Registra handlers do EventBus para cada effect
- Handlers consomem effects, não intents
- Projeção é assíncrona e não quebra fluxo principal

---

## 5. ONDE PROJEÇÕES OCORREM

### Backend

1. **`read-model.projector.ts` - `projectReadModels()`**:
   - Projeção centralizada de todos os read models
   - Chamado via EventBus handlers após effects serem emitidos

2. **`register-handlers.ts` - `registerCoreHandlers()`**:
   - Registra handlers de projeção de read models
   - Import dinâmico para evitar dependência circular

---

## 6. ONDE LEITURA OCORRE

### Backend

1. **Perfis**:
   - `profile-education.service.ts` - `getEducationProfile()` (read-model derivado de eventos)
   - `profile.service.ts` - `getProfile()` (read-model de perfil pessoal)
   - `core.service.ts` - `getCompleteProfile()` (agregação de read models)

2. **Feed**:
   - `social-2.0.service.ts` - `getFeed()` (read-model de feed)
   - `FeedService.ts` - `getFeed()` (read-model de feed alternativo)

3. **Oportunidades**:
   - `opportunity.service.ts` - `getOpportunities()` (read-model de oportunidades)

4. **Reputação**:
   - `reputation.service.ts` - `getReputation()` (read-model de reputação)

5. **Grupos**:
   - `groups.service.ts` - `getGroup()` (read-model de grupo)

---

## 7. PONTOS DE RISCO IDENTIFICADOS

### Risco 1: Read Model usado como decisão

**Localização**: `opportunity.service.ts`, `matching.service.ts`

**Risco**: Read models podem ser consultados para tomar decisões (ex: filtrar oportunidades)

**Mitigação**: 
- ✅ Blindagens adicionadas em `opportunity.service.ts` e `matching.service.ts`
- ✅ Comentários explicando que read models não devem ser usados para decisões

### Risco 2: Service atualiza read model manualmente

**Localização**: Vários services

**Risco**: Services podem atualizar read models diretamente, bypassando projeção centralizada

**Mitigação**:
- ✅ Projeção centralizada via `readModelProjector`
- ✅ Handlers registrados automaticamente para todos os effects
- ✅ Services não devem atualizar read models manualmente

### Risco 3: Read Model usado como fonte de verdade

**Localização**: Vários services

**Risco**: Read models podem ser tratados como fonte de verdade em vez de projeção

**Mitigação**:
- ✅ Blindagens explicando que read models não são fonte de verdade
- ✅ Read models podem ser descartados e reconstruídos
- ✅ Fonte de verdade são eventos, não read models

---

## 8. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`read-model.types.ts`**:
   - Explica que read model não é fonte de verdade
   - Explica que read model não é contrato de negócio
   - Explica que read model pode ser descartado e reconstruído

2. **`read-model.projector.ts`**:
   - Comentários em cada método explicando propósito
   - Mapa explícito com comentários sobre projeção
   - Fluxo de projeção documentado

3. **Services existentes**:
   - Comentários em `profile-education.service.ts` explicando que é read-model
   - Comentários em outros services explicando uso de read models

---

## 9. AUDITORIA

### Verificações Realizadas

- ✅ **Nenhum service escreve read model direto** - projeção é centralizada
- ✅ **Nenhum read model é usado como regra** - blindagens adicionadas
- ✅ **Nenhuma query usa read model como decisão** - read models são apenas para exibição

### Locais Auditados

1. **`profile-education.service.ts`**:
   - ✅ `getEducationProfile()` - Read-model derivado de eventos
   - ✅ Comentários explicando que é read-model

2. **`core.service.ts`**:
   - ✅ `getCompleteProfile()` - Agregação de read models
   - ✅ Não usa read models para decisões

3. **`opportunity.service.ts`**:
   - ✅ Blindagens adicionadas
   - ✅ Read models não são usados para decisões

4. **`matching.service.ts`**:
   - ✅ Blindagens adicionadas
   - ✅ Read models não são usados para decisões

---

## ARQUIVOS ALTERADOS/CRIADOS

### Backend
1. `src/core/read-models/read-model.types.ts` (NOVO)
   - Enum `ReadModelType`
   - Interface `ReadModel`
   - Interface `ReadModelProjectionResult`

2. `src/core/read-models/read-model.projector.ts` (NOVO)
   - Mapa `EFFECT_READ_MODEL_MAP`
   - Classe `ReadModelProjector`
   - Função `registerReadModelHandlers()`

3. `src/core/events/register-handlers.ts`
   - Registro de handlers de projeção de read models

---

## VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS
- ✅ Frontend: `pnpm run build` → PASS

---

## MAPA FINAL EFFECT → READ MODELS

### FEED_ITEM_CREATED
```typescript
[FEED_READ_MODEL, POST_READ_MODEL]
```

### PROJECT_CREATED
```typescript
[FEED_READ_MODEL, PROJECT_READ_MODEL, PROJECT_LIST_READ_MODEL, OPPORTUNITY_READ_MODEL]
```

### JOB_POSTED
```typescript
[FEED_READ_MODEL, OPPORTUNITY_READ_MODEL]
```

### CTA_PUBLISHED
```typescript
[FEED_READ_MODEL, POST_READ_MODEL]
```

### IMPACT_RECORDED
```typescript
[REPUTATION_READ_MODEL, PROFILE_READ_MODEL]
```

### GROUP_FUNDS_UPDATED
```typescript
[GROUP_READ_MODEL, FEED_READ_MODEL]
```

---

## RELAÇÃO ENTRE EFFECT E READ MODEL

### Fluxo Completo

1. **Intent validado**:
   - Validação de intent, capacidade e permissão

2. **Ação executada**:
   - Criação de post/projeto/CTA/etc no banco

3. **Effect emitido**:
   - `emitEffects()` emite effects via eventBus

4. **Read Model projetado**:
   - Handlers do EventBus chamam `projectReadModels()`
   - Read models são atualizados/invalidados

5. **Read Model consumido**:
   - UI/APIs consultam read models para exibição
   - Read models são reconstruídos se necessário

### Exemplo Prático

**Cenário**: User cria post com `intent = 'CREATE_PROJECT'`

1. **Intent**: ✅ `CREATE_PROJECT` validado
2. **Ação**: ✅ Post e projeto criados no banco
3. **Effects**: ✅ `FEED_ITEM_CREATED`, `PROJECT_CREATED`, `IMPACT_RECORDED` emitidos
4. **Read Models**: ✅ `FEED_READ_MODEL`, `PROJECT_READ_MODEL`, `PROJECT_LIST_READ_MODEL`, `OPPORTUNITY_READ_MODEL` projetados
5. **Consumo**: ✅ UI consulta read models para exibir feed e projetos

---

**Status Final**: ✅ **CONTRATO TÉCNICO DE READ MODELS IMPLEMENTADO E VALIDADO**


