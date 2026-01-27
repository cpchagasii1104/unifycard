# Contrato Técnico: EFFECTS (Efeitos Canônicos das Ações)

**Data**: 2024-12-19  
**Escopo**: Primeira camada real de EFFECTS como contrato técnico

---

## 1. CONCEITO DE EFFECT

### Definição

**Effect ≠ Intent ≠ Capacidade ≠ Permissão**

- **Intent**: O "por quê" da ação, o significado do evento
- **Effect**: Consequência sistêmica, mudança observável, nunca decisão humana
- **Capacidade**: Ação possível no sistema, associada ao tipo de Actor
- **Permissão**: Validação pontual baseada em estado (reputação, verificação, etc)

### Relação

- **Intent define ação** - o que o usuário quer fazer
- **Effect define consequência** - o que acontece no sistema após ação válida
- **Service NÃO decide efeito** - effect é definido pelo contrato

### Blindagens

- 🔴 **Nada implícito, nada "dentro do service"** - tudo explícito em código
- 🔴 **Service NÃO decide efeito** - effect é definido pelo contrato
- 🔴 **Effects são consequências sistêmicas** - não decisões humanas

---

## 2. ENUM DE EFFECTS

### Localização
`src/modules/social/actor-effects.types.ts`

### Enum `ActorEffect`

```typescript
export enum ActorEffect {
  // Feed e Conteúdo
  FEED_ITEM_CREATED = 'FEED_ITEM_CREATED', // Item criado no feed
  FEED_ITEM_UPDATED = 'FEED_ITEM_UPDATED', // Item atualizado no feed
  
  // Projetos e Oportunidades
  PROJECT_CREATED = 'PROJECT_CREATED', // Projeto criado
  PROJECT_UPDATED = 'PROJECT_UPDATED', // Projeto atualizado
  JOB_POSTED = 'JOB_POSTED', // Vaga anunciada
  
  // Ações Sociais
  CTA_PUBLISHED = 'CTA_PUBLISHED', // Call-to-Action publicado
  VOTE_REGISTERED = 'VOTE_REGISTERED', // Votação registrada
  COMMENT_ADDED = 'COMMENT_ADDED', // Comentário adicionado
  
  // Economia
  PAYMENT_INITIATED = 'PAYMENT_INITIATED', // Pagamento iniciado
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED', // Pagamento concluído
  GROUP_FUNDS_UPDATED = 'GROUP_FUNDS_UPDATED', // Fundos de grupo atualizados
  
  // Eventos
  EVENT_ANNOUNCED = 'EVENT_ANNOUNCED', // Evento anunciado
  
  // Reputação e Impacto
  IMPACT_RECORDED = 'IMPACT_RECORDED', // Impacto registrado
  REPUTATION_UPDATED = 'REPUTATION_UPDATED', // Reputação atualizada
  
  // Notificações
  NOTIFICATION_SENT = 'NOTIFICATION_SENT', // Notificação enviada
}
```

---

## 3. MAPA INTENT → EFFECTS

### Localização
`src/modules/social/actor-effects.service.ts` - `INTENT_EFFECTS_MAP`

### Mapa Completo

| Intent | Effects |
|--------|---------|
| `SHARE_CONTENT` | `FEED_ITEM_CREATED`, `IMPACT_RECORDED` |
| `ANNOUNCE_EVENT` | `FEED_ITEM_CREATED`, `EVENT_ANNOUNCED`, `IMPACT_RECORDED` |
| `OFFER_SERVICE` | `FEED_ITEM_CREATED`, `IMPACT_RECORDED` |
| `OFFER_PRODUCT` | `FEED_ITEM_CREATED`, `IMPACT_RECORDED` |
| `REQUEST_BOOKING` | `FEED_ITEM_CREATED`, `IMPACT_RECORDED` |
| `CREATE_PROJECT` | `FEED_ITEM_CREATED`, `PROJECT_CREATED`, `IMPACT_RECORDED` |
| `ANNOUNCE_JOB` | `FEED_ITEM_CREATED`, `JOB_POSTED`, `IMPACT_RECORDED` |
| `START_VOTE` | `FEED_ITEM_CREATED`, `VOTE_REGISTERED`, `IMPACT_RECORDED` |
| `REQUEST_HELP` | `FEED_ITEM_CREATED`, `IMPACT_RECORDED` |
| `SEND_CTA` | `FEED_ITEM_CREATED`, `CTA_PUBLISHED`, `IMPACT_RECORDED` |
| `RECEIVE_PAYMENT` | `PAYMENT_INITIATED`, `IMPACT_RECORDED` |

### Regras

- **Nada implícito** - cada intent tem effects explícitos
- **Nada "dentro do service"** - tudo definido no contrato
- **Effects são consequências sistêmicas** - não decisões humanas

---

## 4. EMISSÃO CENTRALIZADA

### Localização
`src/modules/social/actor-effects.service.ts` - `emitEffects()`

### Método

```typescript
async emitEffects(
  tenantId: string,
  actorId: string,
  intent: ActorIntent | string,
  payload?: Partial<ActorEffectPayload>
): Promise<EffectEmissionResult>
```

### Fluxo de Emissão

1. **Normalizar intent** (converter string legado para enum)
2. **Buscar actor** (verificar se existe)
3. **Obter effects esperados** (baseado no mapa)
4. **Emitir cada effect via eventBus** (com payload completo)
5. **Retornar resultado** (sucesso/erros)

### Resultado

```typescript
interface EffectEmissionResult {
  success: boolean;
  effectsEmitted: ActorEffect[];
  errors?: Array<{ effect: ActorEffect; error: string }>;
}
```

### Regras

- **Chamado APENAS após validateIntent** - não antes
- **Services não emitem effects manualmente** - tudo centralizado
- **Effects são emitidos via eventBus** - para consumo assíncrono

---

## 5. INTEGRAÇÃO COM CÓDIGO EXISTENTE

### Localização
`src/modules/social/social-2.0.service.ts` - `createPost()`

### Antes (Emissão Manual)

```typescript
// ❌ Emissão manual em múltiplos lugares
await impactService.recordImpact({...});
// ... mais emissões manuais
```

### Depois (Emissão Centralizada)

```typescript
// ✅ Emissão centralizada após validateIntent
if (intent) {
  const normalizedIntent = actorIntentsService.normalizeIntent(intent);
  if (normalizedIntent) {
    await actorEffectsService.emitEffects(
      tenantId,
      actor.actor_id,
      normalizedIntent,
      {
        sourceId: safePost.post_id,
        sourceType: 'post',
        metadata: {...},
      }
    );
  }
}
```

### Benefícios

- **Nenhum service cria efeito "na mão"** - tudo centralizado
- **Nenhum service decide consequência** - tudo definido no contrato
- **Todos os efeitos passam pelo contrato** - auditável e consistente

---

## 6. ONDE EFFECTS SÃO EMITIDOS

### Backend

1. **`social-2.0.service.ts` - `createPost()`**:
   - Linha 821-850: Emite effects usando `actorEffectsService.emitEffects()`
   - Chamado APENAS após validateIntent e criação do post

2. **`actor-effects.service.ts` - `emitEffects()`**:
   - Emissão centralizada de todos os effects
   - Via eventBus para consumo assíncrono

---

## 7. ONDE EFFECTS SÃO CONSUMIDOS

### Backend

1. **Feed** (`event-feed.handlers.ts`):
   - Consome `FEED_ITEM_CREATED` para criar posts no feed
   - Handler: `handleEventCreated`, `handleEventPublished`

2. **Reputação** (`reputation.events.ts`):
   - Consome `IMPACT_RECORDED` para atualizar reputação
   - Handler: `registerReputationEventHandlers`

3. **Notificações** (`notify/handlers/index.ts`):
   - Consome `NOTIFICATION_SENT` para enviar notificações
   - Handler: `registerAllNotifyHandlers`

4. **Orchestrator** (`orchestrator/executors/`):
   - Consome effects para Memory/AI
   - Handlers: `onJobCreated`, `onAssignmentCompleted`, etc.

5. **Groups** (`groups-activity.executors.ts`):
   - Consome `GROUP_FUNDS_UPDATED` para criar auto-posts econômicos
   - Handler: `onGroupFundReceived`

### Mapeamento de Consumo

| Effect | Consumido Por |
|--------|---------------|
| `FEED_ITEM_CREATED` | Feed handlers, Event feed handlers |
| `PROJECT_CREATED` | Project handlers (futuro) |
| `JOB_POSTED` | Work handlers, Notify handlers |
| `CTA_PUBLISHED` | CTA handlers (futuro) |
| `VOTE_REGISTERED` | Vote handlers (futuro) |
| `IMPACT_RECORDED` | Reputation handlers |
| `PAYMENT_INITIATED` | Transaction handlers, Groups handlers |
| `EVENT_ANNOUNCED` | Event feed handlers |

---

## 8. EXEMPLOS REAIS

### Exemplo 1: CREATE_PROJECT

**Cenário**: User cria post com `intent = 'project'`

**Fluxo**:
1. **Validar Intent**: `validateIntent()` verifica capacidade `CREATE_PROJECT`
2. **Criar Post**: Post é criado no banco
3. **Criar Projeto**: Projeto é criado em `post_projects`
4. **Emitir Effects**: `emitEffects()` emite:
   - `FEED_ITEM_CREATED` → Feed handlers criam post no feed
   - `PROJECT_CREATED` → Project handlers processam projeto
   - `IMPACT_RECORDED` → Reputation handlers atualizam reputação

**Localização**: `social-2.0.service.ts` linha 754-850

---

### Exemplo 2: ANNOUNCE_JOB

**Cenário**: Page anuncia vaga com `intent = 'ANNOUNCE_JOB'`

**Fluxo**:
1. **Validar Intent**: `validateIntent()` verifica capacidade `CREATE_JOB`
2. **Criar Post**: Post é criado no banco
3. **Emitir Effects**: `emitEffects()` emite:
   - `FEED_ITEM_CREATED` → Feed handlers criam post no feed
   - `JOB_POSTED` → Work handlers processam vaga
   - `IMPACT_RECORDED` → Reputation handlers atualizam reputação

**Localização**: `social-2.0.service.ts` linha 821-850

---

### Exemplo 3: SEND_CTA

**Cenário**: User cria post com `cta` e `intent = 'SEND_CTA'`

**Fluxo**:
1. **Validar Intent**: `validateIntent()` verifica capacidade `CREATE_CTA`
2. **Criar Post**: Post é criado no banco
3. **Criar CTA**: CTA é criado em `post_cta`
4. **Emitir Effects**: `emitEffects()` emite:
   - `FEED_ITEM_CREATED` → Feed handlers criam post no feed
   - `CTA_PUBLISHED` → CTA handlers processam CTA
   - `IMPACT_RECORDED` → Reputation handlers atualizam reputação

**Localização**: `social-2.0.service.ts` linha 778-850

---

## 9. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`actor-effects.types.ts`**:
   - Explica diferença entre intent, effect, capacidade e permissão
   - Explica por que service não decide efeito
   - Explica por que effects são consequências sistêmicas

2. **`actor-effects.service.ts`**:
   - Comentários em cada método explicando propósito
   - Mapa explícito com comentários sobre emissão
   - Fluxo de emissão documentado

3. **`social-2.0.service.ts`**:
   - Emissão centralizada substitui emissões manuais
   - Comentários explicando por que emissão é centralizada

---

## 10. AUDITORIA

### Verificações Realizadas

- ✅ **Nenhum service cria efeito "na mão"** - tudo centralizado
- ✅ **Nenhum service decide consequência** - tudo definido no contrato
- ✅ **Todos os efeitos passam pelo contrato** - auditável e consistente

### Locais Auditados

1. **`social-2.0.service.ts`**:
   - ✅ `createPost()` - Emite effects centralizadamente
   - ✅ Removidas emissões manuais de effects

2. **`actor-effects.service.ts`**:
   - ✅ `emitEffects()` - Emissão centralizada de todos os effects
   - ✅ Via eventBus para consumo assíncrono

3. **Handlers existentes**:
   - ✅ Consomem effects via eventBus
   - ✅ Não consomem intent diretamente

---

## ARQUIVOS ALTERADOS/CRIADOS

### Backend
1. `src/modules/social/actor-effects.types.ts` (NOVO)
   - Enum `ActorEffect`
   - Interface `ActorEffectPayload`
   - Interface `EffectEmissionResult`

2. `src/modules/social/actor-effects.service.ts` (NOVO)
   - Mapa `INTENT_EFFECTS_MAP`
   - Método `emitEffects()`
   - Métodos auxiliares

3. `src/modules/social/social-2.0.service.ts`
   - Integração com `actorEffectsService.emitEffects()`
   - Emissão centralizada após criação de post

---

## VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS
- ✅ Frontend: `pnpm run build` → PASS

---

## MAPA FINAL INTENT → EFFECTS

### SHARE_CONTENT
```typescript
[FEED_ITEM_CREATED, IMPACT_RECORDED]
```

### ANNOUNCE_EVENT
```typescript
[FEED_ITEM_CREATED, EVENT_ANNOUNCED, IMPACT_RECORDED]
```

### OFFER_SERVICE
```typescript
[FEED_ITEM_CREATED, IMPACT_RECORDED]
```

### OFFER_PRODUCT
```typescript
[FEED_ITEM_CREATED, IMPACT_RECORDED]
```

### REQUEST_BOOKING
```typescript
[FEED_ITEM_CREATED, IMPACT_RECORDED]
```

### CREATE_PROJECT
```typescript
[FEED_ITEM_CREATED, PROJECT_CREATED, IMPACT_RECORDED]
```

### ANNOUNCE_JOB
```typescript
[FEED_ITEM_CREATED, JOB_POSTED, IMPACT_RECORDED]
```

### START_VOTE
```typescript
[FEED_ITEM_CREATED, VOTE_REGISTERED, IMPACT_RECORDED]
```

### REQUEST_HELP
```typescript
[FEED_ITEM_CREATED, IMPACT_RECORDED]
```

### SEND_CTA
```typescript
[FEED_ITEM_CREATED, CTA_PUBLISHED, IMPACT_RECORDED]
```

### RECEIVE_PAYMENT
```typescript
[PAYMENT_INITIATED, IMPACT_RECORDED]
```

---

## RELAÇÃO ENTRE INTENT, CAPACIDADE, PERMISSÃO E EFFECT

### Fluxo Completo

1. **Validar Intent**:
   - Normalizar intent (string → enum)
   - Verificar se intent é válido

2. **Verificar Capacidades**:
   - Baseado no mapa `INTENT_CAPABILITY_MAP`
   - Se não tem capacidade → erro 403 imediato

3. **Verificar Permissões**:
   - Baseado em capacidade + estado (reputação, verificação)
   - Se não tem permissão → erro 403 com mensagem de estado

4. **Executar Ação**:
   - Criar post/projeto/CTA/etc no banco

5. **Emitir Effects**:
   - Baseado no mapa `INTENT_EFFECTS_MAP`
   - Via eventBus para consumo assíncrono

### Exemplo Prático

**Cenário**: User cria post com `intent = 'CREATE_PROJECT'`

1. **Intent**: ✅ `CREATE_PROJECT` é válido
2. **Capacidade**: ✅ `user` tem `CREATE_PROJECT` no mapa
3. **Permissão**: ✅ `canCreateProject = true` (reputação >= 2)
4. **Ação**: ✅ Post e projeto criados no banco
5. **Effects**: ✅ `FEED_ITEM_CREATED`, `PROJECT_CREATED`, `IMPACT_RECORDED` emitidos

---

**Status Final**: ✅ **CONTRATO TÉCNICO DE EFFECTS IMPLEMENTADO E VALIDADO**

