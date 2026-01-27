# 📐 Arquitetura Social Hub - UnifiCard 2025

> **Transformando a Rede Social Isolada no Hub Central do Ecossistema**

---

## 📊 Estado Atual do Código

### Frontend (Estrutura Social)

| Componente | Arquivo | Linhas | Função Atual |
|-----------|---------|--------|--------------|
| **SocialFeed2** | `components/social/SocialFeed2.tsx` | ~530 | Feed principal 3 colunas |
| **IntentComposer** | `components/social/IntentComposer.tsx` | ~800 | Composer universal |
| **PostCard** | `components/social/PostCard.tsx` | ~450 | Card de post com CTA |
| **SocialLayout** | `components/layout/SocialLayout.tsx` | 115 | Menu lateral atual |
| **CulturalEventCard** | `components/social/CulturalEventCard.tsx` | ~350 | Card de evento cultural |

### Tipos de Intent (Post) Existentes

```typescript
intent: 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event'
```

### Menu Lateral Atual

```
📣 SOCIAL
├── 📰 Feed
├── 👥 Grupos
├── 🗳️ Votações
└── 💚 Impacto

👤 CONTA
├── 👤 Meu Perfil
├── 🏢 Minhas Empresas
├── ⚙️ Configurações
└── 📜 Ledger Social

💰 FINANCEIRO
├── 🏦 UnifyBank
├── 📄 Extrato
└── 🌱 Fundo Regional
```

---

## 🎯 Visão de Transformação

### O Conceito Central

> **A Rede Social NÃO é "uma rede social".**
> **Ela é o FEED DE EVENTOS DO ECOSSISTEMA.**

Tudo que acontece no UnifiCard vira um "evento" no feed:
- Post de pessoa
- Post de empresa
- Novo serviço
- Promoção no Mercado
- Evento comunitário
- Projeto público
- Votação
- Impacto gerado

---

## 🏗️ DECISÃO 1: Modelo de Evento do Feed

### Proposta de Unificação

```typescript
// contracts/feed-event.ts

export type FeedEventType = 
  // Tipos já existentes (renomeados para clareza)
  | 'POST_PERSONAL'      // intent: 'personal'
  | 'POST_FRIENDS'       // intent: 'friends'
  | 'SERVICE_OFFER'      // intent: 'service_offer'
  | 'PRODUCT_OFFER'      // intent: 'product_offer'
  | 'PROJECT_UPDATE'     // intent: 'project'
  | 'VOTE_CALL'          // intent: 'vote'
  | 'EVENT_ANNOUNCE'     // intent: 'event'
  | 'BOOKING_REQUEST'    // intent: 'booking'
  // Novos tipos para unificação
  | 'CULTURAL_EVENT'     // Evento cultural (PAC)
  | 'MARKET_PROMO'       // Promoção do Mercado & Shop
  | 'COMPANY_NEW'        // Nova empresa no território
  | 'SERVICE_NEW'        // Novo serviço disponível
  | 'IMPACT_MILESTONE'   // Marco de impacto atingido
  | 'GROUP_UPDATE'       // Atualização de grupo
  | 'SYSTEM_ANNOUNCE';   // Anúncio do sistema

export interface FeedEvent {
  id: string;
  type: FeedEventType;
  
  // Actor (quem gerou)
  actor: {
    actor_id: string;
    actor_type: 'user' | 'page' | 'group' | 'system';
    display_name: string;
    avatar_url: string | null;
    verified?: boolean;
  };
  
  // Conteúdo
  content: {
    title?: string;        // Para eventos, serviços, projetos
    text: string;          // Texto principal
    media?: MediaItem[];   // Imagens, vídeos
  };
  
  // Contexto territorial
  territory?: {
    region_id: string;
    city_id?: string;
    neighborhood?: string;
  };
  
  // CTA (Call to Action)
  cta?: {
    type: 'booking' | 'buy' | 'vote' | 'join' | 'donate' | 'checkin';
    label: string;
    price_cents?: number;
    target_id: string;
  };
  
  // Métricas
  engagement: {
    reactions_count: number;
    comments_count: number;
    shares_count: number;
    cta_conversions?: number;
  };
  
  // Impacto social
  impact?: {
    group_name: string;
    total_cents: number;
  };
  
  // Metadados
  created_at: string;
  expires_at?: string;     // Para promoções, eventos
  priority_score?: number; // Para ordenação inteligente
  is_pinned?: boolean;
  is_sponsored?: boolean;
}
```

### Mapeamento Origem → FeedEventType

| Origem no Sistema | FeedEventType | CTA Possível |
|-------------------|---------------|--------------|
| Post pessoal | `POST_PERSONAL` | - |
| Post para amigos | `POST_FRIENDS` | - |
| Oferta de serviço | `SERVICE_OFFER` | booking, buy |
| Oferta de produto | `PRODUCT_OFFER` | buy |
| Projeto público | `PROJECT_UPDATE` | donate, join |
| Votação | `VOTE_CALL` | vote |
| Evento cultural | `CULTURAL_EVENT` | checkin, buy |
| Promoção mercado | `MARKET_PROMO` | buy |
| Nova empresa | `COMPANY_NEW` | - |
| Novo serviço | `SERVICE_NEW` | booking |
| Marco de impacto | `IMPACT_MILESTONE` | - |
| Atualização grupo | `GROUP_UPDATE` | join |

---

## 🧭 DECISÃO 2: Menu Social Reorganizado

### Estrutura Proposta

```
📣 SOCIAL
├── 📰 Feed (default, hub central)
├── 👥 Comunidades (ex-Grupos)
├── 🎭 Eventos
└── 🛠️ Serviços

💼 ECONOMIA
├── 🛒 Mercado & Shop
├── 🏢 Minhas Empresas
└── 🏦 UnifyBank (atalho)

🏛️ CIDADANIA
├── 📋 Projetos
├── 🗳️ Votações
└── 📊 Transparência

👤 CONTA
├── 👤 Meu Perfil
├── ⚙️ Configurações
└── 📜 Ledger Social
```

### Mudanças Chave

1. **Feed = HUB CENTRAL** (não apenas posts)
2. **Grupos → Comunidades** (linguagem mais clara)
3. **Eventos ganha destaque** (âncora do ecossistema)
4. **Serviços no Social** (não escondido)
5. **Separação ECONOMIA / CIDADANIA** (clareza de propósito)

---

## 🎨 DECISÃO 3: Layout da Tela Social

### Estrutura de 3 Colunas (já implementada)

```
┌─────────────────────────────────────────────────────────────┐
│                    HEADER GLOBAL                             │
│  [Saldo] [Perfil Ativo ▼] [📍 Localização ▼] [Impacto] [Sair] │
├──────────┬────────────────────────────────┬──────────────────┤
│          │                                │                  │
│  MENU    │      COLUNA CENTRAL            │   WIDGETS        │
│  LATERAL │                                │                  │
│          │  ┌──────────────────────────┐  │  ┌────────────┐  │
│  Social  │  │   COMPOSER UNIVERSAL      │  │  │ Meu Saldo  │  │
│  ├ Feed  │  │  "Diga o que você quer    │  │  │ R$ 98,32   │  │
│  ├ ...   │  │   que aconteça..."        │  │  └────────────┘  │
│          │  └──────────────────────────┘  │                  │
│  Economia│                                │  ┌────────────┐  │
│  ├ ...   │  ┌──────────────────────────┐  │  │ Sugestões  │  │
│          │  │  FEED UNIFICADO           │  │  │ Comunidades│  │
│  Cidadan.│  │  (Posts + Eventos +       │  │  └────────────┘  │
│  ├ ...   │  │   Serviços + Promoções)   │  │                  │
│          │  └──────────────────────────┘  │  ┌────────────┐  │
│  Conta   │                                │  │ Economia   │  │
│  ├ ...   │                                │  │ Local      │  │
│          │                                │  │ R$ 7.500   │  │
└──────────┴────────────────────────────────┴──────────────────┘
```

### Cards no Feed - Identificação Visual

Cada tipo de evento tem um **badge/tag** visual:

| FeedEventType | Badge | Cor |
|---------------|-------|-----|
| `POST_PERSONAL` | 👤 Pessoa | Cinza |
| `SERVICE_OFFER` | 🛠️ Serviço | Azul |
| `PRODUCT_OFFER` | 🛒 Oferta | Verde |
| `CULTURAL_EVENT` | 🎭 Evento | Roxo |
| `VOTE_CALL` | 🗳️ Votação | Laranja |
| `PROJECT_UPDATE` | 📋 Projeto | Azul escuro |
| `MARKET_PROMO` | 💰 Promoção | Verde escuro |

---

## 🔌 DECISÃO 4: Regras do Feed

### Quem Vê o Quê?

```typescript
interface FeedFilters {
  // Filtros automáticos (baseados no contexto)
  territory: {
    region_id: string;    // Região do usuário
    city_id?: string;     // Cidade específica
    radius_km?: number;   // Raio de relevância
  };
  
  // Preferências do usuário
  preferences: {
    music_genres?: string[];
    event_types?: string[];
    service_categories?: string[];
    follow_actors?: string[];
  };
  
  // Filtros de exibição
  display: {
    show_sponsored: boolean;
    show_system_announces: boolean;
    content_types?: FeedEventType[];  // Filtrar por tipo
  };
}
```

### Ordenação do Feed

```typescript
function calculatePriority(event: FeedEvent, user: User): number {
  let score = 0;
  
  // 1. Proximidade temporal (eventos mais próximos = maior score)
  if (event.type === 'CULTURAL_EVENT' && event.expires_at) {
    const daysUntil = daysBetween(now, event.expires_at);
    score += Math.max(0, 100 - daysUntil * 10);
  }
  
  // 2. Relevância territorial (mesmo bairro > cidade > região)
  if (event.territory?.neighborhood === user.neighborhood) score += 50;
  else if (event.territory?.city_id === user.city_id) score += 30;
  else if (event.territory?.region_id === user.region_id) score += 10;
  
  // 3. Seguindo o autor
  if (user.following.includes(event.actor.actor_id)) score += 40;
  
  // 4. Engajamento recente
  score += Math.log10(event.engagement.reactions_count + 1) * 5;
  
  // 5. Patrocinado (boost menor para não dominar)
  if (event.is_sponsored) score += 20;
  
  // 6. Pinado (sempre no topo)
  if (event.is_pinned) score += 1000;
  
  return score;
}
```

---

## 📋 PLANO DE IMPLEMENTAÇÃO

### Fase 1: Arquitetura de Dados (Esta semana)
- [ ] Criar tipo `FeedEvent` em `@unificard/contracts`
- [ ] Criar tabela `feed_events` no banco (view materializada ou tabela real)
- [ ] Endpoint `/api/feed/unified` que retorna `FeedEvent[]`

### Fase 2: Menu Lateral (Próxima semana)
- [ ] Atualizar `SocialLayout.tsx` com nova estrutura
- [ ] Criar rotas para `/eventos`, `/servicos`, `/projetos`
- [ ] Manter backward compatibility com rotas antigas

### Fase 3: Cards Unificados (Semana 3)
- [ ] Criar `FeedEventCard.tsx` (componente único)
- [ ] Implementar variantes visuais por tipo
- [ ] Migrar `PostCard`, `CulturalEventCard`, `EventCard` para novo componente

### Fase 4: Regras do Feed (Semana 4)
- [ ] Implementar filtros territoriais no backend
- [ ] Adicionar preferências de usuário
- [ ] Implementar algoritmo de priorização

---

## ⚠️ O QUE NÃO FAZER

1. **Não duplicar feeds** (um feed unificado, não vários separados)
2. **Não criar "feed econômico" separado** (economia faz parte do social)
3. **Não esconder serviços fora do social** (integração natural)
4. **Não transformar tudo em dashboard analítico** (mata engajamento)
5. **Não adicionar features sem consolidar** (seu padrão correto)

---

## 🎯 PRÓXIMO PASSO RECOMENDADO

Escolha **uma** das opções:

### Opção A: Modelo de Dados
Definir o contrato `FeedEvent` e criar a migration para a tabela unificada.
**Tempo estimado: 2-3 horas**

### Opção B: Menu Reorganizado
Atualizar `SocialLayout.tsx` com a nova estrutura de navegação.
**Tempo estimado: 1-2 horas**

### Opção C: Regras do Feed
Definir em detalhes o algoritmo de priorização e filtros.
**Tempo estimado: 1 hora (planejamento)**

---

## 📎 Referências do Código Atual

| Arquivo | Propósito |
|---------|-----------|
| `frontend/src/components/social/SocialFeed2.tsx` | Feed atual |
| `frontend/src/components/layout/SocialLayout.tsx` | Menu lateral |
| `frontend/src/api/social.ts` | API social |
| `frontend/src/api/feed.ts` | API feed |
| `packages/contracts/` | Tipos compartilhados |

---

*Documento gerado em 26/12/2025 - Análise do código UnifiCard*
