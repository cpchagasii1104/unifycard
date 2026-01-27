# Implementação: Feed Plugin System

**Data**: 2024-12-19  
**Escopo**: Criar infraestrutura de Feed Plugin System para permitir que módulos se registrem como plugins do feed

---

## 1. DEFINIÇÃO CANÔNICA

### Feed NÃO é:
- ❌ Decisor de comportamento
- ❌ Executor de ações de domínio
- ❌ Motor de negócio

### Feed É:
- ✅ Orquestrador visual
- ✅ Renderizador de dados
- ✅ Agregador de conteúdo

### Domínios NÃO são:
- ❌ Renderizadores visuais
- ❌ Orquestradores de UI

### Domínios SÃO:
- ✅ Motores de negócio
- ✅ Executores de ações
- ✅ Fontes de verdade

---

## 2. ARQUITETURA

### Princípio Fundamental

```
Feed = Orquestrador Visual
Domínios = Motores
```

- **Feed**: Apenas renderiza e orquestra visualmente
- **Domínios**: Executam ações e mantêm estado

### Fluxo de Resolução

```
post → intent → plugin → renderFeedItem → DTO → feed (renderização visual)
```

1. **Post** é criado com `intent`
2. **Intent** é usado para resolver **plugin**
3. **Plugin** renderiza dados em **DTO**
4. **DTO** é usado pelo **feed** para renderização visual

---

## 3. ESTRUTURA CRIADA

### Backend

1. **Tipos** (`src/core/feed/feed-plugin.types.ts`):
   - `SocialFeedPlugin` interface - Interface do plugin
   - `FeedItemDTO` interface - DTO para renderização
   - `FeedAction` enum - Ações possíveis (declaração, não execução)
   - `PluginResolutionResult` interface - Resultado de resolução
   - `PluginResolutionOptions` interface - Opções de resolução

2. **Registry** (`src/core/feed/feed-plugin.registry.ts`):
   - `FeedPluginRegistry` class - Gerencia plugins
   - `register()` - Registra plugin
   - `unregister()` - Remove plugin
   - `resolvePlugin()` - Resolve plugin para item
   - `renderFeedItem()` - Renderiza item usando plugin
   - `getAvailableActions()` - Obtém ações disponíveis

3. **Resolver** (`src/core/feed/feed-plugin.resolver.ts`):
   - `FeedPluginResolver` class - Resolve plugins dinamicamente
   - `resolveForPost()` - Resolve plugin para post
   - `renderPost()` - Renderiza post usando plugin
   - `getPostActions()` - Obtém ações para post

4. **Service** (`src/core/feed/feed-plugin.service.ts`):
   - `FeedPluginService` class - Service do plugin system
   - `registerPlugin()` - Registra plugin
   - `unregisterPlugin()` - Remove plugin
   - `listPlugins()` - Lista plugins
   - `resolvePluginForPost()` - Resolve plugin para post
   - `renderFeedItem()` - Renderiza item
   - `getAvailableActions()` - Obtém ações

5. **Routes** (`src/core/feed/feed-plugin.routes.ts`):
   - `GET /feed/plugin/plugins` - Listar plugins
   - `GET /feed/plugin/posts/:postId/render` - Renderizar post
   - `GET /feed/plugin/posts/:postId/actions` - Obter ações
   - `GET /feed/plugin/posts/:postId/resolve` - Resolver plugin

6. **Module** (`src/core/feed/feed.module.ts`):
   - Integrado com rotas do plugin system

---

## 4. INTERFACE DO PLUGIN

### SocialFeedPlugin

```typescript
interface SocialFeedPlugin {
  name: string; // Identificador único
  supportedIntents: ActorIntent[]; // Intents suportados
  
  // Renderiza dados do item para o feed
  renderFeedItem(
    sourceId: string,
    sourceType: string,
    intent: ActorIntent,
    metadata?: Record<string, any>
  ): Promise<FeedItemDTO | null>;
  
  // Declara ações possíveis (não executa)
  getAvailableActions(
    sourceId: string,
    sourceType: string,
    intent: ActorIntent
  ): Promise<FeedAction[]>;
  
  // Valida se pode processar
  canHandle(sourceType: string, intent: ActorIntent): boolean;
}
```

### FeedItemDTO

```typescript
interface FeedItemDTO {
  id: string; // ID do item
  type: string; // Tipo do item
  title?: string; // Título
  description?: string; // Descrição
  imageUrl?: string; // URL da imagem
  thumbnailUrl?: string; // URL da thumbnail
  metadata?: Record<string, any>; // Metadados
  availableActions?: FeedAction[]; // Ações disponíveis
  createdAt: Date; // Data de criação
  updatedAt?: Date; // Data de atualização
}
```

---

## 5. REGRAS DE NEGÓCIO

### Regra Fundamental

- ✅ **Feed = Orquestrador Visual**
  - Apenas renderiza e orquestra visualmente
  - Não decide comportamento
  - Não executa ações de domínio

- ✅ **Domínios = Motores**
  - Executam ações e mantêm estado
  - São fontes de verdade
  - Não renderizam visualmente

### Resolução de Plugin

- ✅ **Fluxo: post → intent → plugin**
  1. Post é criado com `intent`
  2. Intent é usado para buscar plugins que o suportam
  3. Plugin é validado com `canHandle()`
  4. Primeiro plugin válido é retornado

### Renderização

- ✅ **Fluxo: plugin → renderFeedItem → DTO**
  1. Plugin recebe dados do item
  2. Plugin transforma em DTO
  3. DTO é usado pelo feed para renderização

### Ações

- ✅ **Ações são apenas declaração, não execução**
  - Plugin declara ações disponíveis
  - Feed exibe ações disponíveis
  - Execução é feita pelo domínio correspondente

---

## 6. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`feed-plugin.types.ts`**:
   - Comentários: "Feed = orquestrador visual, Domínios = motores"
   - Comentários: "Feed NÃO pode decidir comportamento"
   - Comentários: "Feed NÃO pode executar ações de domínio"
   - Comentários: "Ação é apenas declaração, não execução"
   - Comentários: "DTO é apenas dados, não lógica"
   - Comentários: "Plugin declara capacidades, não executa ações"

2. **`feed-plugin.registry.ts`**:
   - Comentários: "Registry apenas gerencia plugins, não decide comportamento"
   - Comentários: "Registry não executa ações de domínio"
   - Comentários: "Registro é apenas declaração, não execução"
   - Comentários: "Resolução é apenas informação, não decisão"
   - Comentários: "Renderização é apenas transformação de dados, não execução"
   - Comentários: "Ações são apenas declaração, não execução"

3. **`feed-plugin.resolver.ts`**:
   - Comentários: "Resolver apenas resolve plugins, não decide comportamento"
   - Comentários: "Resolver não executa ações de domínio"
   - Comentários: "Resolução é apenas informação, não decisão"
   - Comentários: "Renderização é apenas transformação de dados, não execução"
   - Comentários: "Ações são apenas declaração, não execução"

4. **`feed-plugin.service.ts`**:
   - Comentários: "Service apenas orquestra plugins, não decide comportamento"
   - Comentários: "Service não executa ações de domínio"
   - Comentários: "Registro é apenas declaração, não execução"
   - Comentários: "Resolução é apenas informação, não decisão"
   - Comentários: "Renderização é apenas transformação de dados, não execução"
   - Comentários: "Ações são apenas declaração, não execução"

5. **`feed-plugin.routes.ts`**:
   - Comentários: "Rotas apenas expõem informações, não executam ações"
   - Comentários: "Rotas não executam ações de domínio"
   - Comentários: "Lista é apenas informação, não decisão"
   - Comentários: "Renderização é apenas transformação de dados, não execução"
   - Comentários: "Ações são apenas declaração, não execução"

---

## 7. PROIBIÇÕES ABSOLUTAS

- ❌ Feed NÃO pode decidir comportamento
- ❌ Feed NÃO pode executar ações de domínio
- ❌ Plugin NÃO pode executar ações de domínio
- ❌ Registry NÃO pode executar ações de domínio
- ❌ Resolver NÃO pode executar ações de domínio
- ❌ Service NÃO pode executar ações de domínio

---

## 8. DECISÕES ARQUITETURAIS

### 1. Interface SocialFeedPlugin

**Decisão**: Criar interface que permite que módulos se registrem como plugins.

**Justificativa**:
- Permite extensibilidade sem modificar código do feed
- Separa responsabilidades (feed = visual, domínios = negócio)
- Facilita manutenção e evolução

**Implementação**:
- Interface com métodos: `renderFeedItem()`, `getAvailableActions()`, `canHandle()`
- Plugin declara intents suportados
- Plugin valida se pode processar item

### 2. PluginRegistry

**Decisão**: Criar registry centralizado para gerenciar plugins.

**Justificativa**:
- Centraliza gerenciamento de plugins
- Facilita resolução dinâmica
- Permite listar e gerenciar plugins

**Implementação**:
- Map de plugins por nome
- Map de intents para plugins
- Métodos: `register()`, `unregister()`, `resolvePlugin()`, `renderFeedItem()`, `getAvailableActions()`

### 3. Resolução Dinâmica

**Decisão**: Resolver plugin dinamicamente baseado em post → intent → plugin.

**Justificativa**:
- Permite que módulos se registrem sem modificar feed
- Facilita extensibilidade
- Separa responsabilidades

**Implementação**:
- Fluxo: post → intent → plugin
- Busca plugins que suportam intent
- Valida se plugin pode processar
- Retorna primeiro plugin válido

### 4. DTO para Renderização

**Decisão**: Usar DTO (Data Transfer Object) para renderização.

**Justificativa**:
- Separa dados de lógica
- Facilita renderização no feed
- Permite evolução independente

**Implementação**:
- `FeedItemDTO` com campos para renderização
- Plugin transforma dados em DTO
- Feed usa DTO para renderização

### 5. Ações como Declaração

**Decisão**: Ações são apenas declaração, não execução.

**Justificativa**:
- Feed não executa ações de domínio
- Execução é feita pelo domínio correspondente
- Separa responsabilidades

**Implementação**:
- `FeedAction` enum com ações possíveis
- Plugin declara ações disponíveis
- Feed exibe ações disponíveis
- Execução é feita pelo domínio

---

## 9. EXEMPLOS DE USO

### Registrar Plugin

```typescript
import { feedPluginService } from '@core/feed/feed-plugin.service';
import { ActorIntent } from '@modules/social/actor-intents.types';
import { FeedAction } from '@core/feed/feed-plugin.types';

const eventsPlugin: SocialFeedPlugin = {
  name: 'events',
  supportedIntents: [ActorIntent.ANNOUNCE_EVENT],
  
  async renderFeedItem(sourceId, sourceType, intent, metadata) {
    // Buscar dados do evento
    const event = await eventRepository.findById(sourceId);
    
    return {
      id: event.id,
      type: 'event',
      title: event.name,
      description: event.description,
      imageUrl: event.imageUrl,
      createdAt: event.createdAt,
      availableActions: [FeedAction.VIEW, FeedAction.JOIN],
    };
  },
  
  async getAvailableActions(sourceId, sourceType, intent) {
    return [FeedAction.VIEW, FeedAction.JOIN];
  },
  
  canHandle(sourceType, intent) {
    return sourceType === 'event' && intent === ActorIntent.ANNOUNCE_EVENT;
  },
};

// Registrar plugin
feedPluginService.registerPlugin(eventsPlugin);
```

### Resolver Plugin para Post

```typescript
const resolution = feedPluginService.resolvePluginForPost(
  postId,
  'event',
  ActorIntent.ANNOUNCE_EVENT
);

if (resolution.resolved) {
  console.log(`Plugin resolvido: ${resolution.plugin?.name}`);
}
```

### Renderizar Item do Feed

```typescript
const dto = await feedPluginService.renderFeedItem(
  postId,
  'event',
  ActorIntent.ANNOUNCE_EVENT
);

if (dto) {
  // Usar DTO para renderização no feed
  console.log(`Título: ${dto.title}`);
  console.log(`Ações: ${dto.availableActions}`);
}
```

### Obter Ações Disponíveis

```typescript
const actions = await feedPluginService.getAvailableActions(
  postId,
  'event',
  ActorIntent.ANNOUNCE_EVENT
);

// Exibir ações no feed (execução é feita pelo domínio)
console.log(`Ações disponíveis: ${actions}`);
```

---

## 10. VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS

---

## 11. ARQUIVOS CRIADOS/ALTERADOS

### Backend (novos)

1. `src/core/feed/feed-plugin.types.ts`
   - Tipos do Feed Plugin System

2. `src/core/feed/feed-plugin.registry.ts`
   - Registry de plugins

3. `src/core/feed/feed-plugin.resolver.ts`
   - Resolvedor dinâmico de plugins

4. `src/core/feed/feed-plugin.service.ts`
   - Service do plugin system

5. `src/core/feed/feed-plugin.routes.ts`
   - Rotas do plugin system

### Backend (alterados)

6. `src/core/feed/feed.module.ts`
   - Integrado com rotas do plugin system

---

**Status Final**: ✅ **FEED PLUGIN SYSTEM IMPLEMENTADO E VALIDADO**

