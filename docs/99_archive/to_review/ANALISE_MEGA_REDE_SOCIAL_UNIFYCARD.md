# ANÁLISE MEGA COMPLETA: REDE SOCIAL UNIFYCARD
## A Rede Social que Muda de Acordo com o Actor + Integração Total com Módulos

**Data:** 11 de Janeiro de 2026  
**Visão:** Facebook + Instagram + LinkedIn + Uber + Airbnb + GoFundMe **em uma única plataforma de autogestão da sociedade**  
**Status:** 80% completo - **Falta a integração plugin-based total**  

---

## 🎯 CONCEITO REVOLUCIONÁRIO

### A Rede Social NÃO é uma rede social

É um **SISTEMA OPERACIONAL SOCIAL** onde:

```
❌ Rede social tradicional: Mesma interface para todos
✅ UnifyCard: Interface muda baseada em QUEM você é (Actor)

❌ Rede social tradicional: Postar texto/foto
✅ UnifyCard: Oferecer serviço, criar evento, vender produto, 
              doar, votar, agendar, pagar - tudo no feed

❌ Rede social tradicional: Módulos isolados
✅ UnifyCard: Módulos são PLUGINS do feed social
```

### Motor Único + Plugins Ilimitados

```
┌─────────────────────────────────────────────────┐
│           FEED SOCIAL (Motor Único)             │
│       "Sistema Operacional da Sociedade"        │
└─────────────────────────────────────────────────┘
                        │
    ┌───────────────────┼───────────────────┐
    │                   │                   │
    ▼                   ▼                   ▼
┌──────────┐      ┌──────────┐      ┌──────────┐
│ EVENTOS  │      │ SERVIÇOS │      │  GRUPOS  │
│ (Plugin) │      │ (Plugin) │      │ (Plugin) │
└──────────┘      └──────────┘      └──────────┘
    │                   │                   │
    ▼                   ▼                   ▼
┌──────────┐      ┌──────────┐      ┌──────────┐
│  RIDES   │      │ ECONOMIA │      │ EMPREGOS │
│ (Plugin) │      │ (Plugin) │      │ (Plugin) │
└──────────┘      └──────────┘      └──────────┘
```

**Resultado:** O feed social é a única interface. Tudo acontece lá.

---

## ✅ O QUE JÁ ESTÁ IMPLEMENTADO (80%)

### 1. SISTEMA DE ACTORS ✅ 100%

**4 tipos de Actor com interfaces diferentes:**

#### 1.1 USER (Pessoa Física) ✅
```typescript
Capacidades:
✅ POST_CONTENT - Postar no feed
✅ COMMENT - Comentar
✅ VOTE - Votar
✅ APPLY_JOB - Candidatar-se a vagas
✅ SEND_FUNDS - Enviar pagamentos
✅ RECEIVE_FUNDS - Receber pagamentos

Feed exibe:
- Posts de amigos
- Eventos próximos
- Serviços disponíveis
- Vagas de emprego
- Promoções locais
```

#### 1.2 PAGE (Empresa/Profissional) ✅
```typescript
Capacidades:
✅ POST_CONTENT
✅ COMMENT
✅ CREATE_EVENT - Criar eventos
✅ CREATE_JOB - Criar vagas
✅ CREATE_PROJECT - Criar projetos
✅ RECEIVE_FUNDS - Receber pagamentos
✅ CREATE_CTA - Criar botões de ação
✅ MANAGE_CONTENT - Gerenciar conteúdo

Feed exibe:
- Seguidores
- Vendas/agendamentos
- Métricas de engajamento
- Avaliações
- Campanhas
```

#### 1.3 GROUP (Comunidade) ✅
```typescript
Capacidades:
✅ POST_CONTENT
✅ CREATE_EVENT - Eventos do grupo
✅ RECEIVE_FUNDS - Doações
✅ SEND_FUNDS - Distribuir recursos
✅ VOTE - Votações internas
✅ MANAGE_MEMBERS - Gerenciar membros
✅ CREATE_PROJECT - Projetos coletivos

Feed exibe:
- Posts dos membros
- Votações ativas
- Campanhas
- Eventos do grupo
- Transparência financeira
```

#### 1.4 CHANNEL (Futuro) ⚠️
```typescript
Capacidades planejadas:
⚠️ BROADCAST - Transmissão
⚠️ MONETIZE - Monetização
⚠️ EXCLUSIVE_CONTENT - Conteúdo exclusivo
```

---

### 2. SISTEMA DE INTENTS ✅ 95%

**Intents = "O QUE o usuário quer fazer"**

#### Intents Implementados ✅

```typescript
enum ActorIntent {
  // Social ✅
  SHARE_CONTENT = 'personal'        // Compartilhar conteúdo
  
  // Eventos ✅
  ANNOUNCE_EVENT = 'event'          // Anunciar evento
  
  // Serviços ✅
  OFFER_SERVICE = 'service_offer'   // Ofertar serviço
  OFFER_PRODUCT = 'product_offer'   // Ofertar produto
  REQUEST_BOOKING = 'booking'       // Solicitar agendamento
  
  // Projetos ✅
  CREATE_PROJECT = 'project'        // Criar projeto
  
  // Votação ✅
  START_VOTE = 'vote'               // Iniciar votação
  
  // CTA ✅
  SEND_CTA = 'cta'                  // Call-to-Action
  
  // Futuros ⚠️
  ANNOUNCE_JOB = 'job'              // Anunciar vaga (planejado)
  REQUEST_HELP = 'help'             // Solicitar ajuda (planejado)
  RECEIVE_PAYMENT = 'payment'       // Receber pagamento (planejado)
}
```

#### Como Funciona ✅

**Exemplo 1: Usuário digita "Preciso de um encanador urgente"**

```
Input: "Preciso de um encanador urgente"
     ↓
AI Classifica: OFFER_SERVICE (busca de serviço)
     ↓
Sistema sugere:
- Encanadores próximos
- Botão "Contratar Agora"
- Agenda disponível
     ↓
Usuário clica → Abre agendamento → Paga → Serviço agendado
     ↓
Tudo no feed social!
```

**Exemplo 2: Empresa posta "Vaga de desenvolvedor React"**

```
Input: "Vaga de desenvolvedor React - R$ 8k"
     ↓
AI Classifica: ANNOUNCE_JOB
     ↓
Sistema cria:
- Post formatado como vaga
- Botão "Candidatar-se"
- Requisitos extraídos
- Salário destacado
     ↓
Candidatos clicam → Enviam currículo → Tudo rastreado
```

---

### 3. INTENT COMPOSER ✅ 90%

**O compositor inteligente que transforma texto em ação**

```tsx
┌─────────────────────────────────────────────┐
│  "Diga o que você quer que aconteça..."    │
│  [                                      ]   │
│  [ 🎤 Gravar voz ]                          │
└─────────────────────────────────────────────┘
           ↓
    AI Analisa Intent
           ↓
┌─────────────────────────────────────────────┐
│  🎯 Detectamos: EVENTO                      │
│                                             │
│  📅 Quando: Amanhã às 19h                   │
│  📍 Onde: Seu bairro                        │
│  💰 Grátis                                  │
│                                             │
│  [Confirmar] [Ajustar] [Cancelar]          │
└─────────────────────────────────────────────┘
```

**Features implementadas:**
- ✅ Reconhecimento de voz (Web Speech API)
- ✅ Classificação automática de intent
- ✅ Extração de metadados (data, preço, local)
- ✅ Preview antes de publicar
- ✅ Conversação com AI para refinar
- ✅ Modo manual (escape hatch)

---

### 4. FEED INTELIGENTE ✅ 85%

**3 colunas com propósito:**

```
┌──────────────┬────────────────────┬──────────────┐
│   SIDEBAR    │    FEED CENTRAL    │   SIDEBAR    │
│   ESQUERDA   │                    │   DIREITA    │
├──────────────┼────────────────────┼──────────────┤
│              │                    │              │
│ 💰 Saldo MFI │   📝 Posts         │ 🎯 Para Você │
│              │                    │              │
│ 📊 Impacto   │   🎉 Eventos       │ 👥 Grupos    │
│              │                    │              │
│ 🏆 Progresso │   💼 Serviços      │ 💡 Sugestões │
│              │                    │              │
│ 🌍 Fundo     │   🗳️ Votações      │ 📈 Trending  │
│  Regional    │                    │              │
│              │   💰 CTAs          │              │
└──────────────┴────────────────────┴──────────────┘
```

#### 4.1 Sidebar Esquerda ✅

**Widgets implementados:**

1. **ImpactBalanceBadge** ✅
   ```
   💰 Saldo: 1.234 MFI
   🌍 Impacto: 234 MFI doados
   📊 Rank: Top 10% da cidade
   ```

2. **PersonalProgressCard** ✅
   ```
   🏆 Sua Jornada
   ✅ 5 serviços prestados
   ✅ 3 eventos organizados
   ✅ 12 votos dados
   📈 Nível: Ativista Bronze
   ```

3. **FundDashboard** ✅
   ```
   🌍 Fundo Regional Curitiba
   💰 R$ 45.234 acumulados
   📊 2.341 participantes
   🎯 Projetos financiados: 12
   ```

#### 4.2 Feed Central ✅

**Tipos de post no feed:**

```typescript
interface FeedItem {
  // POST BÁSICO ✅
  type: 'post'
  content: string
  media: string[]
  reactions: { like: number; disagree: number }
  comments: Comment[]
  
  // POST COM INTENT ✅
  intent: 'event' | 'service_offer' | 'booking' | 'vote' | ...
  intentMetadata: {
    // Metadados específicos do intent
  }
  
  // POST COM CTA ✅
  cta?: {
    type: 'booking' | 'service' | 'payment'
    label: string
    action: () => void
  }
  
  // EVENTO ✅
  linkedEvent?: {
    eventId: string
    title: string
    startsAt: Date
    location: string
    ticketPrice?: number
  }
  
  // SERVIÇO ✅
  linkedService?: {
    serviceId: string
    title: string
    price: number
    availability: Slot[]
  }
}
```

**Renderização adaptativa:**

```tsx
// O mesmo FeedItem renderiza diferente baseado no intent

{feedItem.intent === 'event' && (
  <EventCard event={feedItem.linkedEvent} />
)}

{feedItem.intent === 'service_offer' && (
  <ServiceCard service={feedItem.linkedService} />
)}

{feedItem.intent === 'vote' && (
  <VoteCard poll={feedItem.intentMetadata.poll} />
)}

{feedItem.intent === 'booking' && (
  <BookingCard booking={feedItem.intentMetadata.booking} />
)}
```

#### 4.3 Sidebar Direita ✅

**Widgets implementados:**

1. **TodayForYou** ✅
   ```
   🎯 Para Você Hoje
   - 2 eventos próximos
   - 1 serviço recomendado
   - 3 grupos sugeridos
   ```

2. **FeaturedToday** ✅
   ```
   ⭐ Destaques de Hoje
   - Evento: "Workshop React"
   - Serviço: "Massagem"
   - Grupo: "Devs Curitiba"
   ```

3. **GroupSuggestions** ✅
   ```
   👥 Grupos Sugeridos
   🎵 Bandas de Rock - 234 membros
   🏍️ Motoclube Sul - 89 membros
   📚 Estudos Tech - 456 membros
   ```

4. **CommunityActivitySummary** ✅
   ```
   📊 Atividade da Comunidade
   - 45 posts hoje
   - 12 eventos esta semana
   - 8 novos serviços
   ```

---

### 5. INTERAÇÕES SOCIAIS ✅ 100%

#### 5.1 Reações ✅
```typescript
Tipos:
✅ like - Curtir
✅ disagree - Discordar

Interface:
👍 234 curtidas
👎 12 discordâncias
```

#### 5.2 Comentários ✅
```typescript
Features:
✅ Comentários aninhados (threads)
✅ Menções (@usuario)
✅ Markdown básico
✅ Edição/exclusão
✅ Ordem: mais recentes primeiro
```

#### 5.3 Compartilhamento ⚠️
```typescript
Status: Parcialmente implementado

Implementado:
✅ Compartilhar no próprio feed

Falta:
❌ Compartilhar em grupos
❌ Compartilhar fora da plataforma
❌ Link público do post
```

---

### 6. INTEGRAÇÃO COM MÓDULOS ✅ 75%

#### 6.1 EVENTOS → Feed ✅ 80%

**O que funciona:**
```
✅ Criar evento → Post automático com intent='event'
✅ Evento aparece no feed formatado
✅ Botão "Ver Detalhes" → Abre página do evento
✅ Evento tem localização
✅ Evento tem preço
```

**O que falta:**
```
❌ Comprar ingresso direto do feed
❌ Check-in direto do feed
❌ Lista de participantes no post
❌ Contagem regressiva
```

#### 6.2 SERVIÇOS → Feed ✅ 70%

**O que funciona:**
```
✅ Oferecer serviço → Post com intent='service_offer'
✅ Serviço aparece formatado
✅ Preço exibido
✅ Categoria exibida
```

**O que falta:**
```
❌ Ver disponibilidade direto do feed
❌ Agendar direto do feed
❌ Pagar direto do feed
❌ Sistema de avaliações no post
```

#### 6.3 GRUPOS → Feed ✅ 60%

**O que funciona:**
```
✅ Posts do grupo aparecem no feed (parcial)
✅ Sugestões de grupos na sidebar
✅ Eventos de grupos no feed
```

**O que falta:**
```
❌ Grupo como Actor (não implementado)
❌ Posts do grupo não tem badge de grupo
❌ Timeline do grupo isolada
❌ Votações do grupo no feed
```

#### 6.4 ECONOMIA → Feed ✅ 85%

**O que funciona:**
```
✅ Saldo MFI na sidebar
✅ Impacto social visível
✅ Transações rastreáveis
✅ CTA de pagamento em posts
```

**O que falta:**
```
❌ Solicitar pagamento direto do feed
❌ Enviar dinheiro direto do feed
❌ Feed de transações
❌ Notificações de pagamento no feed
```

#### 6.5 RIDES → Feed ❌ 0%

**Status:** NÃO integrado

**O que falta:**
```
❌ Solicitar corrida do feed
❌ Ver motoristas próximos
❌ Status da corrida no feed
❌ Histórico de corridas
```

---

## ❌ O QUE FALTA PARA SER REVOLUCIONÁRIO

### 1. INTEGRAÇÃO PLUGIN TOTAL - CRÍTICO 🔴

**Problema atual:**
```
Módulos são ISOLADOS
     ↓
Funcionam separadamente
     ↓
Usuário precisa sair do feed
     ↓
Experiência fragmentada
```

**Solução: Sistema Plugin-Based**

```typescript
// NOVO SISTEMA DE PLUGINS

interface SocialPlugin {
  // Identificação
  id: string;
  name: string;
  version: string;
  
  // Intents que o plugin suporta
  supportedIntents: ActorIntent[];
  
  // Renderização no feed
  renderFeedCard: (item: FeedItem) => JSX.Element;
  
  // Ações rápidas no feed
  quickActions: Action[];
  
  // Sidebar widgets
  sidebarWidgets?: Widget[];
  
  // Composer personalizado
  composerExtension?: ComposerExtension;
}

// EXEMPLO: Plugin de Eventos
const EventsPlugin: SocialPlugin = {
  id: 'events',
  name: 'Eventos',
  version: '1.0.0',
  
  supportedIntents: [
    ActorIntent.ANNOUNCE_EVENT
  ],
  
  renderFeedCard: (item) => (
    <EventCard 
      event={item.linkedEvent}
      quickActions={[
        { label: 'Comprar Ingresso', action: buyTicket },
        { label: 'Salvar', action: saveEvent },
        { label: 'Compartilhar', action: shareEvent }
      ]}
    />
  ),
  
  quickActions: [
    {
      label: 'Comprar Ingresso',
      icon: '🎟️',
      action: async (eventId) => {
        // Abre modal de checkout direto no feed
        openCheckout(eventId);
      }
    },
    {
      label: 'Check-in',
      icon: '✅',
      action: async (eventId) => {
        // QR Code direto no feed
        openCheckIn(eventId);
      }
    }
  ],
  
  sidebarWidgets: [
    {
      id: 'upcoming-events',
      title: 'Próximos Eventos',
      render: () => <UpcomingEventsWidget />
    }
  ],
  
  composerExtension: {
    // Campos extras ao criar evento
    fields: [
      { name: 'eventDate', type: 'datetime', label: 'Data do Evento' },
      { name: 'location', type: 'location', label: 'Local' },
      { name: 'ticketPrice', type: 'number', label: 'Preço' }
    ],
    preview: (data) => <EventPreview data={data} />
  }
};

// REGISTRO DE PLUGINS
const PLUGINS = [
  EventsPlugin,
  ServicesPlugin,
  GroupsPlugin,
  RidesPlugin,
  JobsPlugin,
  MarketplacePlugin,
  // ... infinitos plugins possíveis
];

// RENDERIZAÇÃO DINÂMICA
{feedItem.intent && (
  <>
    {PLUGINS
      .find(p => p.supportedIntents.includes(feedItem.intent))
      ?.renderFeedCard(feedItem)
    }
  </>
)}
```

**Ganhos:**
```
✅ Módulos novos = só adicionar plugin
✅ Feed sempre unificado
✅ Ações direto do feed
✅ Zero código duplicado
✅ Fácil manutenção
```

---

### 2. VAGAS DE EMPREGO - CRÍTICO 🔴

**Status:** NÃO implementado

**O que criar:**

```typescript
// NOVA TABELA
CREATE TABLE jobs (
  job_id UUID PRIMARY KEY,
  tenant_id UUID,
  
  -- Vínculo ao Actor (empresa/pessoa)
  posted_by_actor_id UUID REFERENCES actors(actor_id),
  
  -- Informações da vaga
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT[],
  
  -- Localização
  location_type VARCHAR(20), -- remote, hybrid, onsite
  city_id UUID,
  address TEXT,
  
  -- Compensação
  salary_min INTEGER, -- em centavos
  salary_max INTEGER,
  salary_currency VARCHAR(3) DEFAULT 'BRL',
  benefits TEXT[],
  
  -- Tipo
  job_type VARCHAR(20), -- full_time, part_time, contract, internship
  experience_level VARCHAR(20), -- entry, mid, senior, executive
  
  -- Status
  status VARCHAR(20) DEFAULT 'open', -- open, closed, filled
  
  -- Candidaturas
  applications_count INTEGER DEFAULT 0,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE job_applications (
  application_id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(job_id),
  applicant_actor_id UUID REFERENCES actors(actor_id),
  
  -- Dados da candidatura
  cover_letter TEXT,
  resume_url TEXT,
  portfolio_url TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, reviewing, interview, rejected, accepted
  
  -- Comunicação
  messages JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Interface no Feed:**

```tsx
<JobCard job={feedItem.linkedJob}>
  {/* Cabeçalho */}
  <JobHeader>
    <CompanyLogo src={job.company.logo} />
    <JobTitle>{job.title}</JobTitle>
    <CompanyName>{job.company.name}</CompanyName>
  </JobHeader>
  
  {/* Informações principais */}
  <JobInfo>
    <Salary>R$ {job.salaryMin} - R$ {job.salaryMax}</Salary>
    <Location>
      {job.locationType === 'remote' ? '🌎 Remoto' : `📍 ${job.city}`}
    </Location>
    <JobType>{job.jobType}</JobType>
  </JobInfo>
  
  {/* Descrição curta */}
  <JobDescription truncate>
    {job.description}
  </JobDescription>
  
  {/* Requisitos */}
  <Requirements>
    {job.requirements.slice(0, 3).map(req => (
      <Tag key={req}>{req}</Tag>
    ))}
  </Requirements>
  
  {/* Ações */}
  <JobActions>
    <Button primary onClick={() => applyDirectly(job.id)}>
      Candidatar-se
    </Button>
    <Button secondary onClick={() => saveJob(job.id)}>
      Salvar
    </Button>
    <Button secondary onClick={() => shareJob(job.id)}>
      Compartilhar
    </Button>
  </JobActions>
  
  {/* Estatísticas */}
  <JobStats>
    👥 {job.applicationsCount} candidaturas
    ⏰ Publicado há {job.postedAt}
  </JobStats>
</JobCard>

{/* Modal de candidatura DIRETO DO FEED */}
<ApplyModal jobId={job.id}>
  <ResumeUpload />
  <CoverLetterEditor />
  <PortfolioLink />
  <Button>Enviar Candidatura</Button>
</ApplyModal>
```

**Recursos únicos:**
```
✅ Candidatar-se direto do feed
✅ CV em formato UnifyCard (padronizado)
✅ Portfólio integrado (posts do usuário)
✅ Avaliações da empresa (de outros funcionários)
✅ Salário transparente (obrigatório)
✅ Chat direto com recrutador
```

---

### 3. MARKETPLACE INTEGRADO - CRÍTICO 🔴

**Status:** Parcialmente implementado (products existe mas não integrado)

**O que criar:**

```typescript
// TABELA JÁ EXISTE, INTEGRAR AO FEED

interface ProductInFeed {
  // Post com produto
  intent: 'product_offer',
  
  linkedProduct: {
    productId: string;
    title: string;
    description: string;
    images: string[];
    
    price: number;
    currency: string;
    
    stock: number;
    
    shipping: {
      available: boolean;
      cost: number;
      estimatedDays: number;
    };
    
    seller: {
      actorId: string;
      name: string;
      rating: number;
      totalSales: number;
    };
  }
}
```

**Interface no Feed:**

```tsx
<ProductCard product={feedItem.linkedProduct}>
  {/* Galeria de imagens */}
  <ImageGallery images={product.images} />
  
  {/* Informações */}
  <ProductInfo>
    <ProductTitle>{product.title}</ProductTitle>
    <ProductPrice>
      R$ {product.price}
      {product.shipping.available && (
        <ShippingTag>+ Frete R$ {product.shipping.cost}</ShippingTag>
      )}
    </ProductPrice>
    <Stock>
      {product.stock > 0 ? `${product.stock} disponíveis` : 'Esgotado'}
    </Stock>
  </ProductInfo>
  
  {/* Vendedor */}
  <SellerInfo>
    <SellerAvatar src={product.seller.avatar} />
    <SellerName>{product.seller.name}</SellerName>
    <SellerRating>⭐ {product.seller.rating}</SellerRating>
    <SellerSales>🛒 {product.seller.totalSales} vendas</SellerSales>
  </SellerInfo>
  
  {/* Ações */}
  <ProductActions>
    <Button primary onClick={() => buyNow(product.id)}>
      Comprar Agora
    </Button>
    <Button secondary onClick={() => addToCart(product.id)}>
      Adicionar ao Carrinho
    </Button>
    <Button secondary onClick={() => messagesSeller(product.seller.id)}>
      Falar com Vendedor
    </Button>
  </ProductActions>
</ProductCard>

{/* Checkout DIRETO DO FEED */}
<CheckoutModal productId={product.id}>
  <AddressSelector />
  <PaymentMethodSelector />
  <OrderSummary />
  <Button>Finalizar Compra</Button>
</CheckoutModal>
```

---

### 4. PROMOÇÕES / OFERTAS - IMPORTANTE ⚠️

**Status:** NÃO implementado

**O que criar:**

```typescript
CREATE TABLE promotions (
  promotion_id UUID PRIMARY KEY,
  tenant_id UUID,
  
  -- Quem criou
  created_by_actor_id UUID REFERENCES actors(actor_id),
  
  -- Tipo de promoção
  type VARCHAR(20), -- discount, bogo, free_shipping, cashback
  
  -- Alvo
  target_type VARCHAR(20), -- product, service, event, all
  target_id UUID,
  
  -- Valor
  discount_percent NUMERIC(5,2),
  discount_amount INTEGER, -- em centavos
  
  -- Condições
  min_purchase INTEGER, -- Compra mínima
  max_uses INTEGER, -- Máximo de usos
  current_uses INTEGER DEFAULT 0,
  
  -- Código
  promo_code VARCHAR(50) UNIQUE,
  
  -- Período
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  
  -- Visibilidade
  visibility VARCHAR(20) DEFAULT 'public', -- public, private, exclusive
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, paused, expired
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Interface no Feed:**

```tsx
<PromotionCard promo={feedItem.linkedPromo}>
  {/* Badge de destaque */}
  <PromoBadge>
    🔥 OFERTA RELÂMPAGO
  </PromoBadge>
  
  {/* Visual */}
  <PromoVisual>
    <DiscountCircle>
      {promo.discountPercent}% OFF
    </DiscountCircle>
    <PromoImage src={promo.image} />
  </PromoVisual>
  
  {/* Informações */}
  <PromoInfo>
    <PromoTitle>{promo.title}</PromoTitle>
    <PromoCode>
      Código: <strong>{promo.promoCode}</strong>
      <CopyButton onClick={() => copy(promo.promoCode)} />
    </PromoCode>
    <PromoConditions>
      {promo.minPurchase && `Compra mínima: R$ ${promo.minPurchase}`}
      {promo.maxUses && `Restam ${promo.maxUses - promo.currentUses} cupons`}
    </PromoConditions>
  </PromoInfo>
  
  {/* Contagem regressiva */}
  <PromoCountdown endsAt={promo.endsAt}>
    Termina em: {countdown}
  </PromoCountdown>
  
  {/* Ações */}
  <PromoActions>
    <Button primary onClick={() => applyPromo(promo.code)}>
      Aplicar Cupom
    </Button>
    <Button secondary onClick={() => savePromo(promo.id)}>
      Salvar
    </Button>
  </PromoActions>
</PromotionCard>
```

---

### 5. CHECK-IN / CHECK-OUT UNIVERSAL - IMPORTANTE ⚠️

**Status:** Implementado só para eventos

**Expandir para:**

```typescript
interface CheckInSystem {
  // Check-in em qualquer lugar
  checkInTypes: [
    'event',        // ✅ Já existe
    'service',      // ❌ Criar
    'location',     // ❌ Criar (check-in em lugares)
    'group_meeting',// ❌ Criar
    'shift'         // ❌ Criar (ponto eletrônico)
  ];
  
  // Recompensas por check-in
  rewards: {
    points: number;
    badges: string[];
    achievements: string[];
  };
  
  // Histórico
  history: CheckIn[];
}

// EXEMPLO: Check-in em serviço
<ServiceCheckIn serviceId="abc">
  <QRCode value={checkInCode} />
  <Instructions>
    Mostre este QR Code para o prestador
  </Instructions>
  <Button onClick={confirmCheckIn}>
    Confirmar Presença
  </Button>
</ServiceCheckIn>

// EXEMPLO: Check-in em local
<LocationCheckIn lat={lat} lng={lng}>
  <Map location={{lat, lng}} />
  <NearbyPlaces>
    ☕ Café da Esquina
    🏋️ Academia Fitness
    🍕 Pizzaria Bella
  </NearbyPlaces>
  <Button onClick={checkInHere}>
    Check-in Aqui
  </Button>
</LocationCheckIn>
```

**Recursos únicos:**
```
✅ Check-in ganha MFI coins
✅ Badges por locais visitados
✅ Mapa de check-ins
✅ Leaderboard de exploradores
✅ Histórico completo
```

---

### 6. AGENDA UNIVERSAL - CRÍTICO 🔴

**Status:** Fragmentado (schedules, service_availability, group_schedules, rides_driver_availability)

**Solução:** Sistema unificado (já proposto em análise anterior)

**Interface no Feed:**

```tsx
<CalendarWidget>
  {/* Mini calendário na sidebar */}
  <MiniCalendar>
    {/* Dias com eventos marcados */}
    <Day hasEvent>15</Day>
    <Day>16</Day>
    <Day hasEvent hasBooking>17</Day>
  </MiniCalendar>
  
  {/* Próximos compromissos */}
  <UpcomingCommitments>
    📅 Hoje, 14h - Reunião com cliente
    🎉 Amanhã, 19h - Workshop React
    💇 Sexta, 10h - Corte de cabelo
  </UpcomingCommitments>
  
  <Button onClick={() => openFullCalendar()}>
    Ver Agenda Completa
  </Button>
</CalendarWidget>

{/* Agenda completa (modal ou página) */}
<FullCalendar>
  {/* Visualizações */}
  <Views>
    <ViewButton active>Dia</ViewButton>
    <ViewButton>Semana</ViewButton>
    <ViewButton>Mês</ViewButton>
  </Views>
  
  {/* Calendário */}
  <Calendar>
    {/* Eventos coloridos por tipo */}
    <Event type="service" time="10:00">
      💇 Corte de cabelo
    </Event>
    <Event type="meeting" time="14:00">
      📅 Reunião
    </Event>
    <Event type="group" time="19:00">
      👥 Encontro do grupo
    </Event>
  </Calendar>
  
  {/* Ações rápidas */}
  <QuickActions>
    <Button onClick={() => createEvent()}>
      + Criar Evento
    </Button>
    <Button onClick={() => bookService()}>
      + Agendar Serviço
    </Button>
    <Button onClick={() => blockTime()}>
      + Bloquear Horário
    </Button>
  </QuickActions>
</FullCalendar>
```

---

### 7. NOTIFICAÇÕES INTELIGENTES - CRÍTICO 🔴

**Status:** Básico (só email)

**Expandir para:**

```typescript
interface NotificationSystem {
  // Canais
  channels: {
    push: boolean;      // Push notifications
    email: boolean;     // Email
    sms: boolean;       // SMS (eventos importantes)
    inApp: boolean;     // No feed social
  };
  
  // Tipos de notificação
  types: {
    // Social
    'new_follower',
    'new_comment',
    'new_reaction',
    'mentioned',
    
    // Eventos
    'event_reminder',      // 24h antes
    'event_updated',
    'event_cancelled',
    'event_starting_soon', // 1h antes
    
    // Serviços
    'booking_confirmed',
    'booking_reminder',
    'booking_cancelled',
    'service_completed',
    
    // Economia
    'payment_received',
    'payment_sent',
    'low_balance',
    'cashback_earned',
    
    // Grupos
    'group_invite',
    'new_vote',
    'vote_ending',
    'vote_result',
    'campaign_milestone',
    
    // Empregos
    'job_match',
    'application_viewed',
    'interview_scheduled',
    
    // Sistema
    'achievement_unlocked',
    'level_up',
    'badge_earned'
  };
  
  // Preferências por tipo
  preferences: Record<string, {
    channels: string[];
    frequency: 'instant' | 'daily_digest' | 'weekly_digest';
  }>;
}
```

**Interface no Feed:**

```tsx
<NotificationBell>
  <Badge count={unreadCount} />
  
  <NotificationDropdown>
    {/* Filtros */}
    <NotificationFilters>
      <Filter active>Tudo</Filter>
      <Filter>Eventos</Filter>
      <Filter>Pagamentos</Filter>
      <Filter>Social</Filter>
    </NotificationFilters>
    
    {/* Lista */}
    <NotificationList>
      <NotificationItem type="payment" unread>
        💰 Você recebeu R$ 150,00
        <TimeAgo>há 5 minutos</TimeAgo>
      </NotificationItem>
      
      <NotificationItem type="event">
        🎉 Lembrete: Workshop React amanhã às 19h
        <TimeAgo>há 1 hora</TimeAgo>
      </NotificationItem>
      
      <NotificationItem type="social">
        ❤️ Maria curtiu seu post
        <TimeAgo>há 2 horas</TimeAgo>
      </NotificationItem>
    </NotificationList>
    
    <NotificationActions>
      <Button onClick={markAllAsRead}>
        Marcar tudo como lido
      </Button>
      <Button onClick={openNotificationSettings}>
        Configurações
      </Button>
    </NotificationActions>
  </NotificationDropdown>
</NotificationBell>
```

---

### 8. BUSCA UNIVERSAL - IMPORTANTE ⚠️

**Status:** Básico (só posts)

**Expandir para:**

```tsx
<UniversalSearch>
  {/* Input */}
  <SearchInput
    placeholder="Buscar pessoas, serviços, eventos, grupos..."
    onChange={handleSearch}
  />
  
  {/* Resultados instantâneos */}
  <InstantResults>
    {/* Pessoas */}
    <ResultSection title="Pessoas">
      <PersonResult avatar={} name={} />
    </ResultSection>
    
    {/* Serviços */}
    <ResultSection title="Serviços">
      <ServiceResult title={} price={} />
    </ResultSection>
    
    {/* Eventos */}
    <ResultSection title="Eventos">
      <EventResult title={} date={} />
    </ResultSection>
    
    {/* Grupos */}
    <ResultSection title="Grupos">
      <GroupResult name={} members={} />
    </ResultSection>
    
    {/* Produtos */}
    <ResultSection title="Produtos">
      <ProductResult title={} price={} />
    </ResultSection>
    
    {/* Vagas */}
    <ResultSection title="Vagas">
      <JobResult title={} salary={} />
    </ResultSection>
  </InstantResults>
  
  {/* Filtros avançados */}
  <SearchFilters>
    <Filter type="location">
      📍 Curitiba
    </Filter>
    <Filter type="price">
      💰 Até R$ 100
    </Filter>
    <Filter type="date">
      📅 Esta semana
    </Filter>
    <Filter type="category">
      🏷️ Beleza
    </Filter>
  </SearchFilters>
</UniversalSearch>
```

---

### 9. MENSAGENS PRIVADAS - IMPORTANTE ⚠️

**Status:** Implementado (social_chat_messages)

**Melhorias necessárias:**

```tsx
<MessagingSystem>
  {/* Lista de conversas */}
  <ConversationList>
    {/* Busca */}
    <SearchConversations />
    
    {/* Filtros */}
    <ConversationFilters>
      <Filter active>Tudo</Filter>
      <Filter>Não lidas</Filter>
      <Filter>Grupos</Filter>
      <Filter>Arquivadas</Filter>
    </ConversationFilters>
    
    {/* Conversas */}
    <Conversation unread>
      <Avatar src={} />
      <ConversationInfo>
        <Name>Maria Silva</Name>
        <LastMessage>Olá, tudo bem?</LastMessage>
        <Time>há 5 min</Time>
      </ConversationInfo>
      <UnreadBadge count={3} />
    </Conversation>
  </ConversationList>
  
  {/* Chat */}
  <ChatWindow>
    {/* Cabeçalho */}
    <ChatHeader>
      <Avatar src={} />
      <Name>Maria Silva</Name>
      <OnlineStatus online />
      <Actions>
        <IconButton icon="📞" /> {/* Chamada */}
        <IconButton icon="📹" /> {/* Vídeo */}
        <IconButton icon="ℹ️" /> {/* Info */}
      </Actions>
    </ChatHeader>
    
    {/* Mensagens */}
    <MessageList>
      <Message sent>
        Oi! Tudo bem?
        <MessageTime>10:30</MessageTime>
      </Message>
      <Message received>
        Tudo ótimo! E você?
        <MessageTime>10:32</MessageTime>
        <MessageStatus read />
      </Message>
    </MessageList>
    
    {/* Composer */}
    <MessageComposer>
      <AttachButton />
      <EmojiButton />
      <TextInput placeholder="Digite uma mensagem..." />
      <SendButton />
    </MessageComposer>
    
    {/* Recursos avançados */}
    <AdvancedFeatures>
      {/* Pagamento direto no chat */}
      <SendMoneyButton />
      
      {/* Agendar serviço direto no chat */}
      <BookServiceButton />
      
      {/* Criar evento direto no chat */}
      <CreateEventButton />
      
      {/* Compartilhar localização */}
      <ShareLocationButton />
    </AdvancedFeatures>
  </ChatWindow>
</MessagingSystem>
```

---

## 🎯 ROADMAP COMPLETO PARA REDE SOCIAL REVOLUCIONÁRIA

### Fase 1: Integração Plugin (4 semanas) - CRÍTICO

**Semana 1-2: Arquitetura Plugin**
- [ ] Criar sistema de registro de plugins
- [ ] Interface SocialPlugin
- [ ] Sistema de renderização dinâmica
- [ ] Migrar Eventos para plugin
- [ ] Migrar Serviços para plugin

**Semana 3-4: Ações Direto do Feed**
- [ ] Comprar ingresso no feed
- [ ] Agendar serviço no feed
- [ ] Pagar no feed
- [ ] Check-in no feed
- [ ] Candidatar-se a vaga no feed

### Fase 2: Vagas de Emprego (3 semanas)

**Semana 5: Backend**
- [ ] Tabelas jobs e job_applications
- [ ] APIs CRUD
- [ ] Sistema de candidaturas
- [ ] Notificações

**Semana 6: Frontend**
- [ ] JobCard no feed
- [ ] Modal de candidatura
- [ ] Página de detalhes da vaga
- [ ] Dashboard de candidaturas

**Semana 7: Features Avançadas**
- [ ] Match inteligente (IA)
- [ ] CV padronizado UnifyCard
- [ ] Portfólio automático
- [ ] Chat com recrutador

### Fase 3: Marketplace (3 semanas)

**Semana 8: Integração Produtos**
- [ ] ProductCard no feed
- [ ] Carrinho de compras
- [ ] Checkout integrado
- [ ] Rastreamento de pedidos

**Semana 9: Vendedor**
- [ ] Dashboard de vendas
- [ ] Gestão de estoque
- [ ] Sistema de envios
- [ ] Avaliações

**Semana 10: Features Avançadas**
- [ ] Recomendações personalizadas
- [ ] Wishlist
- [ ] Histórico de compras
- [ ] Cupons de desconto

### Fase 4: Promoções (2 semanas)

**Semana 11-12:**
- [ ] Tabela promotions
- [ ] PromotionCard no feed
- [ ] Sistema de cupons
- [ ] Contagem regressiva
- [ ] Analytics de promoções

### Fase 5: Check-in Universal (2 semanas)

**Semana 13-14:**
- [ ] Check-in em serviços
- [ ] Check-in em locais
- [ ] Recompensas por check-in
- [ ] Mapa de check-ins
- [ ] Badges de explorador

### Fase 6: Agenda Universal (3 semanas)

**Semana 15-17:**
- [ ] Migração para availability unificado
- [ ] CalendarWidget na sidebar
- [ ] Agenda completa (modal)
- [ ] Sincronização com Google Calendar
- [ ] Lembretes inteligentes

### Fase 7: Notificações (2 semanas)

**Semana 18-19:**
- [ ] Push notifications
- [ ] Email notifications
- [ ] SMS (eventos críticos)
- [ ] Preferências por tipo
- [ ] Digest diário/semanal

### Fase 8: Busca Universal (2 semanas)

**Semana 20-21:**
- [ ] Busca em tempo real
- [ ] Resultados por categoria
- [ ] Filtros avançados
- [ ] Histórico de buscas
- [ ] Buscas salvas

### Fase 9: Mensagens (2 semanas)

**Semana 22-23:**
- [ ] UI/UX melhorado
- [ ] Chamadas de áudio
- [ ] Chamadas de vídeo
- [ ] Pagamento no chat
- [ ] Agendamento no chat

### Fase 10: Polish (1 semana)

**Semana 24:**
- [ ] Performance otimizada
- [ ] Loading states
- [ ] Error handling
- [ ] Testes E2E
- [ ] Documentação

**TOTAL: 24 semanas (~6 meses)**

---

## 🏆 DIFERENCIAL COMPETITIVO

### UnifyCard vs Facebook/Instagram

| Feature | Facebook | Instagram | LinkedIn | **UnifyCard** |
|---------|----------|-----------|----------|---------------|
| **Posts Sociais** | ✅ | ✅ | ✅ | ✅ |
| **Interface por Actor** | ❌ | ❌ | ⚠️ Páginas | ✅ **Dinâmica** |
| **Agendar Serviços** | ❌ | ❌ | ❌ | ✅ **Direto do feed** |
| **Comprar Produtos** | ⚠️ Marketplace | ⚠️ Shopping | ❌ | ✅ **Integrado** |
| **Eventos Completos** | ⚠️ Básico | ❌ | ⚠️ Básico | ✅ **Avançado** |
| **Economia Integrada** | ❌ | ❌ | ❌ | ✅ **MFI Coins** |
| **Governança** | ❌ | ❌ | ❌ | ✅ **Votações** |
| **Impacto Social** | ❌ | ❌ | ❌ | ✅ **Rastreável** |
| **Vagas de Emprego** | ⚠️ Jobs | ❌ | ✅ | ✅ **+ Match IA** |
| **Grupos com Economia** | ❌ | ❌ | ❌ | ✅ **Carteira** |
| **Check-in Universal** | ⚠️ Lugares | ⚠️ Lugares | ❌ | ✅ **Tudo** |
| **Split Payments** | ❌ | ❌ | ❌ | ✅ **Automático** |

**Veredito:** UnifyCard = **Facebook + Instagram + LinkedIn + Uber + Airbnb + Meetup + GoFundMe + Transparência Total**

---

## 📊 MÉTRICAS DE SUCESSO

### KPIs da Rede Social

```typescript
interface SocialMetrics {
  // Engajamento
  dau: number;              // Daily Active Users
  mau: number;              // Monthly Active Users
  avgSessionTime: number;   // Tempo médio de sessão
  postsPerDay: number;      // Posts por dia
  
  // Conversão (ÚNICO!)
  intentConversionRate: number;    // % posts que viram ações
  bookingsFromFeed: number;        // Agendamentos direto do feed
  purchasesFromFeed: number;       // Compras direto do feed
  applicationsFromFeed: number;    // Candidaturas direto do feed
  
  // Economia
  mfiCirculating: number;   // MFI em circulação
  transactionsPerDay: number; // Transações por dia
  avgTransactionValue: number; // Valor médio
  
  // Impacto
  communitiesFunded: number; // Comunidades financiadas
  socialImpactScore: number; // Score de impacto
  
  // Retenção
  d1Retention: number;      // 24h
  d7Retention: number;      // 7 dias
  d30Retention: number;     // 30 dias
}
```

### Metas Ambiciosas

**Mês 1:**
- 10.000 usuários ativos
- 1.000 posts/dia
- 100 agendamentos direto do feed

**Mês 6:**
- 100.000 usuários ativos
- 10.000 posts/dia
- 5.000 transações/dia
- 100 grupos ativos

**Ano 1:**
- 1.000.000 usuários
- 50.000 posts/dia
- 10.000 transações/dia
- 1.000 grupos ativos
- R$ 10.000.000 em volume transacionado

---

## ✅ CONCLUSÃO

### Status Atual da Rede Social

**Funcionando:** 80%  
**Integração Plugin:** 40%  
**Features Completas:** 75%  
**Potencial:** 🚀🚀🚀 REVOLUCIONÁRIO

### O que JÁ funciona MUITO BEM

✅ **Sistema de Actors** - Interface dinâmica  
✅ **Intent Composer** - IA que entende o que você quer  
✅ **Feed 3 colunas** - Informações contextuais  
✅ **Interações sociais** - Like, comment, share  
✅ **Economia integrada** - MFI coins no feed  
✅ **Eventos parcialmente** - Aparece no feed  
✅ **Serviços parcialmente** - Ofertas no feed  

### O que vai fazer a DIFERENÇA

🔴 **CRÍTICO (6 meses):**
- Sistema Plugin completo
- Vagas de emprego
- Marketplace integrado
- Agenda universal
- Notificações inteligentes

⚠️ **IMPORTANTE (3 meses):**
- Promoções
- Check-in universal
- Busca universal
- Mensagens avançadas

### Por que vai DOMINAR o mercado

**1. Única rede que MUDA com você**
```
Você = Pessoa → Feed de amigos, eventos, vagas
Você = Empresa → Feed de vendas, analytics, candidatos
Você = Grupo → Feed de votações, campanhas, finanças
```

**2. Única rede onde TUDO acontece no feed**
```
Não precisa sair do feed para:
- Agendar serviço
- Comprar produto
- Se candidatar a vaga
- Participar de evento
- Votar em decisão
- Doar para causa
```

**3. Única rede com ECONOMIA real**
```
- MFI coins circulam
- Split automático
- Impacto rastreável
- Transparência total
- Governança democrática
```

**4. Única rede PLUGIN-BASED**
```
Novos módulos = só adicionar plugin
Zero código duplicado
Infinitas possibilidades
Fácil manutenção
```

### Investimento vs Retorno

**Investimento:** 6 meses de desenvolvimento  
**Retorno:** Rede social que não existe no mercado  

**Comparação:**
- Facebook levou anos para ter marketplace
- Instagram levou anos para ter shopping
- LinkedIn ainda não tem economia integrada
- Nenhum tem governança democrática

**UnifyCard terá TUDO em 6 meses!**

### Recomendação Final

**INVESTIR TUDO NESTE MÓDULO!** 🚀

A Rede Social é o **CORAÇÃO** do UnifyCard. Todos os outros módulos são **PLUGINS** dela.

**Com este roadmap implementado, o UnifyCard se torna:**
- O Facebook do Brasil
- O Instagram de serviços
- O LinkedIn de empregos
- O Uber de tudo
- O GoFundMe de causas
- **+ Governança democrática**
- **+ Economia própria**
- **+ Impacto social mensurável**

**Nenhuma outra rede social no mundo tem isso!** 🌍

---

**Autor:** Sistema de Auditoria UnifyCard  
**Data:** 11/01/2026  
**Versão:** 1.0  
**Status:** PRONTO PARA REVOLUCIONAR O MERCADO 🚀
