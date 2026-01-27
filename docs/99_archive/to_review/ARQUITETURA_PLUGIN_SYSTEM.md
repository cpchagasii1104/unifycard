# ARQUITETURA UNIFYCARD: SISTEMA OPERACIONAL DA SOCIEDADE
## Análise da Home + Arquitetura Plugin-Based + Melhorias

**Data:** 11 de Janeiro de 2026  
**Visão:** Sistema modular onde Rede Social é o HUB central e módulos são PLUGINS  

---

## 📊 ANÁLISE DA HOME ATUAL

### Módulos Visíveis (17 apps)

**Linha 1:**
1. 💬 **Rede Social** - Feed principal
2. 👤 **Perfil** - Identidade do usuário
3. 🏢 **Empresas** - Gestão empresarial
4. 🏛️ **UnifyBank** - Sistema bancário
5. 💳 **UnifyCard** - Cartão/pagamentos
6. 🌱 **Fundo Regional** - Impacto social
7. 🛒 **Mercado & Shop** - Marketplace
8. 🍕 **Pedir Comida** - Delivery
9. 🚗 **Mobilidade** - Rides/transporte

**Linha 2:**
10. ✈️ **Passagens** - Viagens
11. 🏨 **Hospedagem** - Acomodações
12. 🎭 **Eventos** - Shows/festas
13. 🔧 **Serviços** - Prestadores
14. 👥 **Comunidades** - Grupos
15. 🗳️ **Votações** - Governança
16. 📋 **Projetos** - Gestão de projetos
17. 🔍 **Transparência** - Prestação de contas
18. 📄 **Prestação de Contas** - Relatórios

**Linha 3:**
19. ⚙️ **Configurações** - Settings
20. 🔧 **Admin** - Administração

---

## ❌ O QUE FALTA (Módulos Essenciais)

### CRÍTICO - Falta Adicionar

**1. 💼 Vagas & Empregos**
```
Ícone: 💼 ou 👔
Nome: "Vagas" ou "Empregos"
Posição sugerida: Entre Serviços e Comunidades
```

**2. 🎓 Educação & Cursos**
```
Ícone: 🎓 ou 📚
Nome: "Educação" ou "Cursos"
Funcionalidades:
- Cursos online
- Workshops
- Certificações
- Networking estudantil
```

**3. 🏥 Saúde & Bem-estar**
```
Ícone: 🏥 ou ❤️
Nome: "Saúde"
Funcionalidades:
- Telemedicina
- Agendamento consultas
- Farmácias
- Academia/fitness
```

**4. 📰 Notícias & Informação**
```
Ícone: 📰 ou 📺
Nome: "Notícias" ou "Info"
Funcionalidades:
- Feed de notícias locais
- Eventos da cidade
- Avisos importantes
- Clima
```

**5. 🎮 Entretenimento**
```
Ícone: 🎮 ou 🎬
Nome: "Entretenimento"
Funcionalidades:
- Streaming integrado
- Games sociais
- Podcasts
- Livros/audiobooks
```

**6. 🏡 Imóveis**
```
Ícone: 🏡 ou 🏠
Nome: "Imóveis"
Funcionalidades:
- Compra/venda
- Aluguel
- Temporada
- Corretores
```

**7. 🤝 Networking**
```
Ícone: 🤝 ou 💼
Nome: "Networking"
Funcionalidades:
- Conexões profissionais
- Mentorias
- Parcerias
- Eventos de networking
```

**8. 📊 Analytics & BI**
```
Ícone: 📊 ou 📈
Nome: "Analytics" ou "Insights"
Funcionalidades:
- Dashboard pessoal
- Métricas de impacto
- Relatórios customizados
- BI para empresas
```

**9. 🎨 Criadores & Mídia**
```
Ícone: 🎨 ou 📹
Nome: "Criadores"
Funcionalidades:
- Upload de conteúdo
- Monetização
- Galeria de arte
- Portfolio
```

**10. 🔒 Documentos & Contratos**
```
Ícone: 🔒 ou 📜
Nome: "Documentos"
Funcionalidades:
- Assinatura digital
- Contratos inteligentes
- Armazenamento seguro
- Notário digital
```

---

## 🏗️ ARQUITETURA: SISTEMA PLUGIN-BASED

### Conceito Central

```
┌────────────────────────────────────────────────┐
│         REDE SOCIAL (Kernel/Core)              │
│         Sistema Operacional da Sociedade       │
└────────────────────────────────────────────────┘
                      │
      ┌───────────────┼───────────────┐
      │               │               │
      ▼               ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐
│ PLUGIN A │    │ PLUGIN B │    │ PLUGIN C │
│ (Eventos)│    │(Serviços)│    │ (Grupos) │
└──────────┘    └──────────┘    └──────────┘
      │               │               │
      └───────────────┼───────────────┘
                      │
                      ▼
              ┌───────────────┐
              │  Feed Social  │
              │   (Interface  │
              │    Unificada) │
              └───────────────┘
```

### Camadas da Arquitetura

```
┌─────────────────────────────────────────────┐
│  CAMADA 4: UI/UX (Frontend)                 │
│  - Feed Social Unificado                    │
│  - Home de Apps                             │
│  - Navegação Global                         │
└─────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│  CAMADA 3: Plugin System (Orquestrador)     │
│  - Plugin Registry                          │
│  - Plugin Lifecycle Manager                 │
│  - Event Bus (pub/sub)                      │
│  - Permission Manager                       │
└─────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│  CAMADA 2: Core Services (Backend)          │
│  - Actors System                            │
│  - Intent System                            │
│  - Economy Engine (MFI)                     │
│  - Notification System                      │
│  - Search Engine                            │
│  - Analytics Engine                         │
└─────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│  CAMADA 1: Data Layer                       │
│  - PostgreSQL                               │
│  - Redis (cache)                            │
│  - S3 (arquivos)                            │
│  - Elasticsearch (busca)                    │
└─────────────────────────────────────────────┘
```

---

## 🔌 SISTEMA DE PLUGINS

### 1. Contrato de Plugin (Interface)

```typescript
// ============================================
// CONTRATO BASE DE PLUGIN
// ============================================

interface UnifyCardPlugin {
  // ==================== METADADOS ====================
  
  metadata: {
    id: string;                    // 'events', 'services', 'jobs'
    name: string;                  // 'Eventos', 'Serviços', 'Vagas'
    version: string;               // '1.0.0'
    description: string;
    icon: string;                  // '🎭', '🔧', '💼'
    category: PluginCategory;      // 'social', 'commerce', 'governance'
    
    // Dependências
    dependencies?: string[];       // ['economy', 'actors']
    requiredFeatures?: string[];   // ['payments', 'location']
    
    // Permissões necessárias
    permissions: Permission[];     // ['read_posts', 'create_transactions']
    
    // Configuração
    configSchema?: JSONSchema;     // Schema de configuração
    defaultConfig?: any;
  };
  
  // ==================== LIFECYCLE ====================
  
  // Inicialização do plugin
  onInstall?: (context: PluginContext) => Promise<void>;
  
  // Quando plugin é ativado
  onActivate?: (context: PluginContext) => Promise<void>;
  
  // Quando plugin é desativado
  onDeactivate?: (context: PluginContext) => Promise<void>;
  
  // Quando plugin é desinstalado
  onUninstall?: (context: PluginContext) => Promise<void>;
  
  // ==================== INTENTS ====================
  
  // Intents que o plugin suporta
  supportedIntents: Intent[];
  
  // Validação customizada de intent
  validateIntent?: (
    intent: Intent,
    data: any
  ) => Promise<ValidationResult>;
  
  // ==================== FEED INTEGRATION ====================
  
  // Renderização de card no feed
  renderFeedCard: (item: FeedItem) => React.ReactNode;
  
  // Renderização de preview ao criar
  renderComposerPreview?: (data: any) => React.ReactNode;
  
  // Ações rápidas no feed
  feedActions: Action[];
  
  // Filtros do feed
  feedFilters?: Filter[];
  
  // ==================== SIDEBAR WIDGETS ====================
  
  // Widgets da sidebar esquerda
  leftSidebarWidgets?: Widget[];
  
  // Widgets da sidebar direita
  rightSidebarWidgets?: Widget[];
  
  // ==================== SEARCH ====================
  
  // Busca customizada
  search?: (query: string, filters: any) => Promise<SearchResult[]>;
  
  // Sugestões de busca
  searchSuggestions?: (query: string) => Promise<string[]>;
  
  // ==================== NOTIFICATIONS ====================
  
  // Tipos de notificação do plugin
  notificationTypes: NotificationType[];
  
  // Handler de notificações
  handleNotification?: (
    notification: Notification
  ) => Promise<void>;
  
  // ==================== ROUTES ====================
  
  // Rotas customizadas
  routes?: Route[];
  
  // Navegação bottom (mobile)
  bottomNavItem?: BottomNavItem;
  
  // ==================== ECONOMY ====================
  
  // Tipos de transação do plugin
  transactionTypes?: TransactionType[];
  
  // Handler de pagamentos
  handlePayment?: (
    payment: Payment
  ) => Promise<PaymentResult>;
  
  // ==================== ANALYTICS ====================
  
  // Métricas do plugin
  metrics?: Metric[];
  
  // Dashboard customizado
  dashboardWidgets?: DashboardWidget[];
  
  // ==================== SETTINGS ====================
  
  // Tela de configurações
  settingsComponent?: React.ComponentType<SettingsProps>;
  
  // Configurações do usuário
  userSettings?: UserSetting[];
  
  // ==================== HOOKS ====================
  
  // Hooks para eventos do sistema
  hooks?: {
    onPostCreated?: (post: Post) => Promise<void>;
    onPostDeleted?: (postId: string) => Promise<void>;
    onActorCreated?: (actor: Actor) => Promise<void>;
    onPaymentProcessed?: (payment: Payment) => Promise<void>;
    // ... mais hooks
  };
  
  // ==================== API ====================
  
  // APIs públicas do plugin (para outros plugins)
  api?: {
    [key: string]: (...args: any[]) => Promise<any>;
  };
}

// ============================================
// TIPOS AUXILIARES
// ============================================

type PluginCategory = 
  | 'social'       // Rede social, perfil, grupos
  | 'commerce'     // Marketplace, serviços, delivery
  | 'finance'      // Banco, pagamentos, investimentos
  | 'governance'   // Votações, projetos, transparência
  | 'mobility'     // Rides, passagens, hospedagem
  | 'media'        // Eventos, streaming, notícias
  | 'productivity' // Documentos, tarefas, agenda
  | 'education'    // Cursos, workshops, certificações
  | 'health'       // Telemedicina, fitness, bem-estar
  | 'real_estate'  // Imóveis, aluguel
  | 'jobs';        // Vagas, networking

interface Intent {
  type: string;
  label: string;
  description: string;
  icon: string;
  schema: JSONSchema;
}

interface Action {
  id: string;
  label: string;
  icon: string;
  handler: (item: any) => Promise<void>;
  condition?: (item: any) => boolean; // Quando mostrar
}

interface Widget {
  id: string;
  title: string;
  component: React.ComponentType<any>;
  refreshInterval?: number; // ms
  minimizable?: boolean;
  order: number; // Ordem de exibição
}

interface Route {
  path: string;
  component: React.ComponentType<any>;
  exact?: boolean;
  protected?: boolean; // Requer autenticação
}

interface NotificationType {
  type: string;
  title: string;
  icon: string;
  channels: ('push' | 'email' | 'sms' | 'in_app')[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface Metric {
  id: string;
  name: string;
  description: string;
  type: 'counter' | 'gauge' | 'histogram';
  unit?: string;
}

interface PluginContext {
  // Core services
  actors: ActorService;
  economy: EconomyService;
  social: SocialService;
  notifications: NotificationService;
  
  // Plugin info
  plugin: {
    id: string;
    config: any;
  };
  
  // Current user/actor
  currentUser: User;
  currentActor: Actor;
  
  // Database
  db: Database;
  
  // Cache
  cache: Cache;
  
  // Event bus
  events: EventBus;
  
  // Logger
  logger: Logger;
}
```

---

### 2. Exemplo: Plugin de Eventos

```typescript
// ============================================
// PLUGIN: EVENTOS
// ============================================

export const EventsPlugin: UnifyCardPlugin = {
  metadata: {
    id: 'events',
    name: 'Eventos',
    version: '1.0.0',
    description: 'Sistema completo de eventos e ingressos',
    icon: '🎭',
    category: 'media',
    dependencies: ['economy', 'actors'],
    requiredFeatures: ['payments', 'location'],
    permissions: [
      'read_posts',
      'create_posts',
      'process_payments',
      'send_notifications'
    ]
  },
  
  // ==================== LIFECYCLE ====================
  
  async onInstall(context) {
    // Criar tabelas necessárias
    await context.db.createTables([
      'events',
      'event_sessions',
      'event_tickets',
      'event_attendees'
    ]);
    
    // Registrar intents
    await context.social.registerIntents([
      'ANNOUNCE_EVENT',
      'BUY_TICKET'
    ]);
  },
  
  async onActivate(context) {
    // Setup inicial
    context.logger.info('Plugin Eventos ativado');
  },
  
  // ==================== INTENTS ====================
  
  supportedIntents: [
    {
      type: 'ANNOUNCE_EVENT',
      label: 'Criar Evento',
      description: 'Anunciar um evento público ou privado',
      icon: '🎉',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          startsAt: { type: 'string', format: 'date-time' },
          location: { type: 'object' },
          ticketPrice: { type: 'number' }
        },
        required: ['title', 'startsAt']
      }
    }
  ],
  
  async validateIntent(intent, data) {
    if (intent.type === 'ANNOUNCE_EVENT') {
      // Validar se actor pode criar eventos
      const canCreate = await this.checkPermission(
        data.actorId,
        'create_event'
      );
      
      if (!canCreate) {
        return {
          valid: false,
          reason: 'Actor não tem permissão para criar eventos'
        };
      }
      
      // Validar data do evento
      if (new Date(data.startsAt) < new Date()) {
        return {
          valid: false,
          reason: 'Data do evento não pode ser no passado'
        };
      }
    }
    
    return { valid: true };
  },
  
  // ==================== FEED INTEGRATION ====================
  
  renderFeedCard: (item) => (
    <EventCard event={item.linkedEvent}>
      {/* Header */}
      <EventHeader>
        <EventImage src={item.linkedEvent.coverImage} />
        <EventBadge>{item.linkedEvent.eventType}</EventBadge>
      </EventHeader>
      
      {/* Info */}
      <EventInfo>
        <EventTitle>{item.linkedEvent.title}</EventTitle>
        <EventDate>
          📅 {formatDate(item.linkedEvent.startsAt)}
        </EventDate>
        <EventLocation>
          📍 {item.linkedEvent.location.name}
        </EventLocation>
        {item.linkedEvent.ticketPrice && (
          <EventPrice>
            💰 R$ {item.linkedEvent.ticketPrice / 100}
          </EventPrice>
        )}
      </EventInfo>
      
      {/* Quick Actions */}
      <EventActions>
        <Button primary onClick={() => buyTicket(item.linkedEvent.id)}>
          🎟️ Comprar Ingresso
        </Button>
        <Button secondary onClick={() => shareEvent(item.linkedEvent.id)}>
          📤 Compartilhar
        </Button>
        <Button secondary onClick={() => saveEvent(item.linkedEvent.id)}>
          ⭐ Salvar
        </Button>
      </EventActions>
      
      {/* Stats */}
      <EventStats>
        <Stat>👥 {item.linkedEvent.attendeesCount} confirmados</Stat>
        <Stat>💬 {item.commentsCount} comentários</Stat>
      </EventStats>
    </EventCard>
  ),
  
  renderComposerPreview: (data) => (
    <EventPreview>
      <h3>📅 Criar Evento</h3>
      <PreviewField label="Título" value={data.title} />
      <PreviewField label="Data" value={formatDate(data.startsAt)} />
      <PreviewField label="Local" value={data.location?.name} />
      <PreviewField label="Preço" value={`R$ ${data.ticketPrice || 0}`} />
    </EventPreview>
  ),
  
  feedActions: [
    {
      id: 'buy_ticket',
      label: 'Comprar Ingresso',
      icon: '🎟️',
      handler: async (item) => {
        await buyTicket(item.linkedEvent.id);
      },
      condition: (item) => item.linkedEvent?.ticketPrice > 0
    },
    {
      id: 'check_in',
      label: 'Check-in',
      icon: '✅',
      handler: async (item) => {
        await checkInToEvent(item.linkedEvent.id);
      },
      condition: (item) => {
        const now = new Date();
        const eventStart = new Date(item.linkedEvent.startsAt);
        const hoursDiff = (eventStart - now) / (1000 * 60 * 60);
        return hoursDiff <= 2 && hoursDiff >= -1; // 2h antes até 1h depois
      }
    }
  ],
  
  // ==================== SIDEBAR WIDGETS ====================
  
  leftSidebarWidgets: [
    {
      id: 'my_events',
      title: 'Meus Eventos',
      component: MyEventsWidget,
      order: 1
    }
  ],
  
  rightSidebarWidgets: [
    {
      id: 'upcoming_events',
      title: 'Próximos Eventos',
      component: UpcomingEventsWidget,
      refreshInterval: 60000, // 1 minuto
      order: 1
    },
    {
      id: 'event_recommendations',
      title: 'Recomendados Para Você',
      component: EventRecommendationsWidget,
      order: 2
    }
  ],
  
  // ==================== SEARCH ====================
  
  async search(query, filters) {
    const events = await db.events.search({
      query,
      startDate: filters.startDate,
      endDate: filters.endDate,
      location: filters.location,
      category: filters.category,
      priceRange: filters.priceRange
    });
    
    return events.map(event => ({
      type: 'event',
      id: event.id,
      title: event.title,
      subtitle: formatDate(event.startsAt),
      icon: '🎭',
      url: `/eventos/${event.id}`
    }));
  },
  
  // ==================== NOTIFICATIONS ====================
  
  notificationTypes: [
    {
      type: 'event_reminder',
      title: 'Lembrete de Evento',
      icon: '⏰',
      channels: ['push', 'email'],
      priority: 'high'
    },
    {
      type: 'event_cancelled',
      title: 'Evento Cancelado',
      icon: '❌',
      channels: ['push', 'email', 'sms'],
      priority: 'urgent'
    },
    {
      type: 'event_updated',
      title: 'Evento Atualizado',
      icon: '📝',
      channels: ['push', 'in_app'],
      priority: 'medium'
    }
  ],
  
  // ==================== ROUTES ====================
  
  routes: [
    {
      path: '/eventos',
      component: EventsListPage,
      exact: true
    },
    {
      path: '/eventos/:eventId',
      component: EventDetailPage
    },
    {
      path: '/eventos/novo',
      component: CreateEventPage,
      protected: true
    }
  ],
  
  bottomNavItem: {
    label: 'Eventos',
    icon: '🎭',
    route: '/eventos',
    badge: (context) => context.events.getUpcomingCount()
  },
  
  // ==================== ECONOMY ====================
  
  transactionTypes: [
    {
      type: 'event_ticket_purchase',
      description: 'Compra de ingresso',
      category: 'purchase'
    },
    {
      type: 'event_refund',
      description: 'Reembolso de ingresso',
      category: 'refund'
    }
  ],
  
  async handlePayment(payment) {
    // Processar compra de ingresso
    if (payment.metadata.type === 'ticket_purchase') {
      const ticket = await createTicket({
        eventId: payment.metadata.eventId,
        buyerId: payment.fromActorId,
        paymentId: payment.id
      });
      
      // Enviar QR Code
      await sendTicketQRCode(ticket.id);
      
      return { success: true, ticketId: ticket.id };
    }
    
    return { success: true };
  },
  
  // ==================== ANALYTICS ====================
  
  metrics: [
    {
      id: 'events_created',
      name: 'Eventos Criados',
      type: 'counter',
      description: 'Total de eventos criados'
    },
    {
      id: 'tickets_sold',
      name: 'Ingressos Vendidos',
      type: 'counter',
      description: 'Total de ingressos vendidos'
    },
    {
      id: 'revenue',
      name: 'Receita',
      type: 'gauge',
      description: 'Receita total com eventos',
      unit: 'BRL'
    }
  ],
  
  dashboardWidgets: [
    {
      id: 'event_stats',
      title: 'Estatísticas de Eventos',
      component: EventStatsWidget,
      size: 'large'
    }
  ],
  
  // ==================== HOOKS ====================
  
  hooks: {
    async onPostCreated(post) {
      // Se post tem intent de evento, criar evento
      if (post.intent === 'ANNOUNCE_EVENT') {
        await createEventFromPost(post);
      }
    },
    
    async onPaymentProcessed(payment) {
      // Se é compra de ingresso, emitir ticket
      if (payment.metadata.type === 'ticket_purchase') {
        await this.handlePayment(payment);
      }
    }
  },
  
  // ==================== API ====================
  
  api: {
    async getEvent(eventId: string) {
      return await db.events.findById(eventId);
    },
    
    async getUpcomingEvents(actorId: string) {
      return await db.events.findUpcoming({ actorId });
    },
    
    async buyTicket(eventId: string, buyerId: string) {
      return await purchaseTicket(eventId, buyerId);
    }
  }
};
```

---

### 3. Plugin Registry

```typescript
// ============================================
// PLUGIN REGISTRY (Gerenciador de Plugins)
// ============================================

class PluginRegistry {
  private plugins: Map<string, UnifyCardPlugin> = new Map();
  private activePlugins: Set<string> = new Set();
  
  // Registrar plugin
  register(plugin: UnifyCardPlugin) {
    if (this.plugins.has(plugin.metadata.id)) {
      throw new Error(`Plugin ${plugin.metadata.id} já registrado`);
    }
    
    // Validar dependências
    for (const dep of plugin.metadata.dependencies || []) {
      if (!this.plugins.has(dep)) {
        throw new Error(`Dependência ${dep} não encontrada`);
      }
    }
    
    this.plugins.set(plugin.metadata.id, plugin);
    
    // Instalar plugin
    plugin.onInstall?.(this.createContext(plugin));
  }
  
  // Ativar plugin
  async activate(pluginId: string) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin ${pluginId} não encontrado`);
    
    await plugin.onActivate?.(this.createContext(plugin));
    this.activePlugins.add(pluginId);
    
    // Registrar intents no sistema
    await this.registerIntents(plugin);
    
    // Registrar rotas
    await this.registerRoutes(plugin);
    
    // Registrar notificações
    await this.registerNotifications(plugin);
  }
  
  // Desativar plugin
  async deactivate(pluginId: string) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin ${pluginId} não encontrado`);
    
    await plugin.onDeactivate?.(this.createContext(plugin));
    this.activePlugins.delete(pluginId);
  }
  
  // Obter plugin por intent
  getPluginForIntent(intent: string): UnifyCardPlugin | null {
    for (const [id, plugin] of this.plugins) {
      if (!this.activePlugins.has(id)) continue;
      
      const supportsIntent = plugin.supportedIntents.some(
        i => i.type === intent
      );
      
      if (supportsIntent) return plugin;
    }
    
    return null;
  }
  
  // Renderizar card do feed
  renderFeedCard(item: FeedItem): React.ReactNode {
    const plugin = this.getPluginForIntent(item.intent);
    
    if (plugin?.renderFeedCard) {
      return plugin.renderFeedCard(item);
    }
    
    // Fallback: card genérico
    return <GenericPostCard item={item} />;
  }
  
  // Buscar em todos plugins
  async search(query: string, filters: any): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    for (const [id, plugin] of this.plugins) {
      if (!this.activePlugins.has(id)) continue;
      if (!plugin.search) continue;
      
      const pluginResults = await plugin.search(query, filters);
      results.push(...pluginResults);
    }
    
    // Ordenar por relevância
    return this.sortByRelevance(results, query);
  }
  
  // Obter widgets da sidebar
  getSidebarWidgets(side: 'left' | 'right'): Widget[] {
    const widgets: Widget[] = [];
    
    for (const [id, plugin] of this.plugins) {
      if (!this.activePlugins.has(id)) continue;
      
      const pluginWidgets = side === 'left'
        ? plugin.leftSidebarWidgets
        : plugin.rightSidebarWidgets;
      
      if (pluginWidgets) {
        widgets.push(...pluginWidgets);
      }
    }
    
    // Ordenar por ordem especificada
    return widgets.sort((a, b) => a.order - b.order);
  }
  
  // Event Bus (pub/sub)
  private eventBus = new EventBus();
  
  // Emitir evento para todos plugins
  async emit(event: string, data: any) {
    for (const [id, plugin] of this.plugins) {
      if (!this.activePlugins.has(id)) continue;
      
      // Chamar hook correspondente
      const hookName = `on${capitalize(event)}`;
      const hook = (plugin.hooks as any)?.[hookName];
      
      if (hook) {
        await hook(data);
      }
    }
  }
  
  private createContext(plugin: UnifyCardPlugin): PluginContext {
    return {
      actors: actorService,
      economy: economyService,
      social: socialService,
      notifications: notificationService,
      plugin: {
        id: plugin.metadata.id,
        config: {} // TODO: load from DB
      },
      currentUser: getCurrentUser(),
      currentActor: getCurrentActor(),
      db: database,
      cache: redis,
      events: this.eventBus,
      logger: createLogger(plugin.metadata.id)
    };
  }
}

// Singleton
export const pluginRegistry = new PluginRegistry();
```

---

### 4. Registrando Todos os Plugins

```typescript
// ============================================
// BOOTSTRAP: REGISTRAR TODOS OS PLUGINS
// ============================================

import { pluginRegistry } from './plugin-registry';

// Importar todos os plugins
import { EventsPlugin } from './plugins/events';
import { ServicesPlugin } from './plugins/services';
import { GroupsPlugin } from './plugins/groups';
import { RidesPlugin } from './plugins/rides';
import { JobsPlugin } from './plugins/jobs';
import { MarketplacePlugin } from './plugins/marketplace';
import { EducationPlugin } from './plugins/education';
import { HealthPlugin } from './plugins/health';
import { RealEstatePlugin } from './plugins/real-estate';
// ... mais plugins

export async function bootstrapPlugins() {
  // Registrar plugins na ordem de dependência
  
  // Core plugins (sem dependências)
  pluginRegistry.register(EventsPlugin);
  pluginRegistry.register(ServicesPlugin);
  pluginRegistry.register(GroupsPlugin);
  
  // Plugins que dependem de core
  pluginRegistry.register(RidesPlugin);      // Depende: economy, actors
  pluginRegistry.register(JobsPlugin);       // Depende: actors
  pluginRegistry.register(MarketplacePlugin); // Depende: economy, actors
  
  // Plugins avançados
  pluginRegistry.register(EducationPlugin);  // Depende: events, payments
  pluginRegistry.register(HealthPlugin);     // Depende: services, payments
  pluginRegistry.register(RealEstatePlugin); // Depende: marketplace, location
  
  // Ativar todos os plugins
  await pluginRegistry.activate('events');
  await pluginRegistry.activate('services');
  await pluginRegistry.activate('groups');
  await pluginRegistry.activate('rides');
  await pluginRegistry.activate('jobs');
  await pluginRegistry.activate('marketplace');
  await pluginRegistry.activate('education');
  await pluginRegistry.activate('health');
  await pluginRegistry.activate('real_estate');
  
  console.log('✅ Todos os plugins registrados e ativados');
}
```

---

## 🎨 MELHORIAS NA HOME

### 1. Layout Otimizado

```tsx
<HomePage>
  {/* Header */}
  <HomeHeader>
    <UserGreeting>
      Olá, {userName}! 👋
    </UserGreeting>
    
    <QuickActions>
      <IconButton icon="🔔" badge={notificationCount} />
      <IconButton icon="💬" badge={messageCount} />
      <IconButton icon="👤" onClick={() => navigate('/perfil')} />
    </QuickActions>
  </HomeHeader>
  
  {/* Busca Global */}
  <GlobalSearch>
    <SearchInput 
      placeholder="Buscar apps, serviços, eventos, pessoas..."
      onSearch={handleSearch}
    />
    <VoiceButton />
  </GlobalSearch>
  
  {/* Seção: Principais (mais usados) */}
  <Section title="📌 Principais">
    <AppGrid>
      {mostUsedApps.map(app => (
        <AppCard
          key={app.id}
          icon={app.icon}
          name={app.name}
          badge={app.badge} // Contadores
          onClick={() => navigate(app.route)}
        />
      ))}
    </AppGrid>
  </Section>
  
  {/* Seção: Social & Comunicação */}
  <Section title="💬 Social & Comunicação">
    <AppGrid>
      <AppCard icon="💬" name="Rede Social" />
      <AppCard icon="👥" name="Comunidades" badge={3} />
      <AppCard icon="📰" name="Notícias" badge="NEW" />
      <AppCard icon="🤝" name="Networking" />
    </AppGrid>
  </Section>
  
  {/* Seção: Comércio & Serviços */}
  <Section title="🛒 Comércio & Serviços">
    <AppGrid>
      <AppCard icon="🛒" name="Mercado & Shop" />
      <AppCard icon="🔧" name="Serviços" />
      <AppCard icon="🍕" name="Pedir Comida" />
      <AppCard icon="🏡" name="Imóveis" badge="NEW" />
    </AppGrid>
  </Section>
  
  {/* Seção: Mobilidade & Viagens */}
  <Section title="🚗 Mobilidade & Viagens">
    <AppGrid>
      <AppCard icon="🚗" name="Mobilidade" />
      <AppCard icon="✈️" name="Passagens" />
      <AppCard icon="🏨" name="Hospedagem" />
    </AppGrid>
  </Section>
  
  {/* Seção: Eventos & Entretenimento */}
  <Section title="🎭 Eventos & Entretenimento">
    <AppGrid>
      <AppCard icon="🎭" name="Eventos" badge={5} />
      <AppCard icon="🎮" name="Entretenimento" badge="NEW" />
      <AppCard icon="🎨" name="Criadores" badge="NEW" />
    </AppGrid>
  </Section>
  
  {/* Seção: Trabalho & Educação */}
  <Section title="💼 Trabalho & Educação">
    <AppGrid>
      <AppCard icon="💼" name="Vagas" badge="NEW" />
      <AppCard icon="🎓" name="Educação" badge="NEW" />
      <AppCard icon="📋" name="Projetos" />
    </AppGrid>
  </Section>
  
  {/* Seção: Saúde & Bem-estar */}
  <Section title="🏥 Saúde & Bem-estar" badge="NEW">
    <AppGrid>
      <AppCard icon="🏥" name="Saúde" badge="NEW" />
      <AppCard icon="💪" name="Fitness" badge="NEW" />
      <AppCard icon="🧘" name="Bem-estar" badge="NEW" />
    </AppGrid>
  </Section>
  
  {/* Seção: Finanças */}
  <Section title="💰 Finanças">
    <AppGrid>
      <AppCard icon="🏛️" name="UnifyBank" />
      <AppCard icon="💳" name="UnifyCard" />
      <AppCard icon="🌱" name="Fundo Regional" />
      <AppCard icon="📊" name="Analytics" badge="NEW" />
    </AppGrid>
  </Section>
  
  {/* Seção: Governança & Transparência */}
  <Section title="🗳️ Governança">
    <AppGrid>
      <AppCard icon="🗳️" name="Votações" badge={2} />
      <AppCard icon="🔍" name="Transparência" />
      <AppCard icon="📄" name="Prestação de Contas" />
    </AppGrid>
  </Section>
  
  {/* Seção: Negócios (só para empresas) */}
  {currentActor.type === 'page' && (
    <Section title="🏢 Negócios">
      <AppGrid>
        <AppCard icon="🏢" name="Empresas" />
        <AppCard icon="📊" name="CRM" badge="NEW" />
        <AppCard icon="📦" name="ERP" badge="NEW" />
        <AppCard icon="📈" name="Analytics" />
      </AppGrid>
    </Section>
  )}
  
  {/* Seção: Configurações */}
  <Section title="⚙️ Configurações">
    <AppGrid>
      <AppCard icon="⚙️" name="Configurações" />
      <AppCard icon="🔧" name="Admin" />
      <AppCard icon="🔒" name="Privacidade" />
      <AppCard icon="📜" name="Termos" />
    </AppGrid>
  </Section>
  
  {/* Footer */}
  <HomeFooter>
    <Version>UnifyCard v2.0.0</Version>
    <Links>
      <Link href="/sobre">Sobre</Link>
      <Link href="/ajuda">Ajuda</Link>
      <Link href="/contato">Contato</Link>
    </Links>
  </HomeFooter>
</HomePage>
```

---

### 2. Features Extras da Home

**a) Busca Inteligente**
```tsx
<SmartSearch>
  {/* Sugestões baseadas em comportamento */}
  <SearchSuggestions>
    <Suggestion>🎭 Eventos esta semana</Suggestion>
    <Suggestion>🔧 Encanadores próximos</Suggestion>
    <Suggestion>💼 Vagas de React</Suggestion>
  </SearchSuggestions>
  
  {/* Atalhos rápidos */}
  <QuickShortcuts>
    <Shortcut icon="➕" label="Criar Post" />
    <Shortcut icon="📅" label="Novo Evento" />
    <Shortcut icon="💸" label="Enviar Dinheiro" />
  </QuickShortcuts>
</SmartSearch>
```

**b) Personalização**
```tsx
<HomeCustomization>
  {/* Usuário pode reorganizar apps */}
  <DraggableApps />
  
  {/* Ocultar apps não usados */}
  <HideUnusedApps />
  
  {/* Temas */}
  <ThemeSelector>
    <Theme name="Light" />
    <Theme name="Dark" />
    <Theme name="Auto" />
  </ThemeSelector>
</HomeCustomization>
```

**c) Widgets na Home**
```tsx
<HomeWidgets>
  {/* Saldo MFI */}
  <BalanceWidget>
    💰 Saldo: 1.234 MFI
  </BalanceWidget>
  
  {/* Próximo evento */}
  <NextEventWidget>
    🎭 Workshop React - Amanhã 19h
  </NextEventWidget>
  
  {/* Tarefas pendentes */}
  <TasksWidget>
    ⏰ 3 tarefas pendentes
  </TasksWidget>
</HomeWidgets>
```

---

## 🚀 ROADMAP DE IMPLEMENTAÇÃO

### Fase 1: Core Plugin System (4 semanas)

**Semana 1-2: Arquitetura**
- [ ] PluginRegistry
- [ ] Plugin Interface
- [ ] PluginContext
- [ ] Event Bus (pub/sub)

**Semana 3-4: Integração Feed**
- [ ] renderFeedCard dinâmico
- [ ] Feed actions por plugin
- [ ] Sidebar widgets por plugin

### Fase 2: Migração Plugins Existentes (6 semanas)

**Semana 5-6: Eventos**
- [ ] Migrar para plugin
- [ ] Testar integração completa

**Semana 7-8: Serviços**
- [ ] Migrar para plugin
- [ ] CRM integration

**Semana 9-10: Grupos**
- [ ] Migrar para plugin
- [ ] Votações integration

### Fase 3: Novos Plugins (8 semanas)

**Semana 11-12: Jobs**
- [ ] Plugin completo
- [ ] Match IA

**Semana 13-14: Educação**
- [ ] Cursos online
- [ ] Certificações

**Semana 15-16: Saúde**
- [ ] Telemedicina
- [ ] Agendamentos

**Semana 17-18: Imóveis**
- [ ] Anúncios
- [ ] Visitas virtuais

### Fase 4: Home Melhorada (2 semanas)

**Semana 19-20:**
- [ ] Novo layout
- [ ] Busca inteligente
- [ ] Personalização
- [ ] Widgets

**TOTAL: 20 semanas (~5 meses)**

---

## 💡 CONCLUSÃO

### Arquitetura Plugin-Based

**Vantagens:**
- ✅ Escalabilidade infinita
- ✅ Módulos independentes
- ✅ Manutenção centralizada
- ✅ Fácil adicionar novos plugins
- ✅ Testável isoladamente

**Como funciona:**
```
Plugin registra → System valida → Plugin ativo
                       ↓
            Feed consulta plugins
                       ↓
         Plugin renderiza seu card
                       ↓
          Ações direto do feed
```

### Próximos Passos

1. **Implementar PluginRegistry** (1 semana)
2. **Migrar Eventos para plugin** (2 semanas)
3. **Criar JobsPlugin** (2 semanas)
4. **Melhorar Home** (2 semanas)

### Potencial

Com esta arquitetura:
- ✅ UnifyCard pode ter **infinitos plugins**
- ✅ Desenvolvedores terceiros podem criar plugins
- ✅ Marketplace de plugins (futuro)
- ✅ Monetização por plugin (futuro)

**O UnifyCard se torna um verdadeiro SISTEMA OPERACIONAL SOCIAL!** 🚀

---

**Autor:** Sistema de Auditoria UnifyCard  
**Data:** 11/01/2026  
**Versão:** 1.0
