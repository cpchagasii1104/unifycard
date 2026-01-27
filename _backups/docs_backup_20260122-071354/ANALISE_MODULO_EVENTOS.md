# ANÁLISE COMPLETA: MÓDULO EVENTOS
## O que falta para ficar 100% funcional e integrado ao Feed por Actor

**Data:** 11 de Janeiro de 2026  
**Status Atual:** 75% completo  
**Gap:** 25% para MVP funcional  

---

## 📊 VISÃO GERAL DO MÓDULO

### Estrutura Atual
```
Backend:
✅ 20 arquivos TypeScript
✅ 161KB de código
✅ 19 tabelas no banco de dados
✅ 8 sub-módulos implementados

Frontend:
✅ 1 página (EventosPage)
✅ 14 componentes
✅ 1 API dedicada (events.ts)
```

**Completude Backend: 85%**  
**Completude Frontend: 70%**  
**Completude Integração Feed: 60%**  
**TOTAL: 75%**

---

## ✅ O QUE JÁ ESTÁ IMPLEMENTADO

### 1. Backend - Estrutura Robusta ✅

#### 1.1 Core de Eventos (Migration 026) ✅
**Tabelas:** `events`, `event_sessions`, `event_locations`, `event_staff`, `event_attendees`  
**Status:** 100% implementado  

**Funcionalidades:**
- ✅ Criação de eventos com título, descrição
- ✅ Data/hora de início e fim
- ✅ Localização (country, state, city)
- ✅ Sessões múltiplas (um evento pode ter várias sessões)
- ✅ Locais específicos
- ✅ Staff (equipe do evento)
- ✅ Participantes (attendees)
- ✅ RLS completo por tenant

#### 1.2 Organizadores (Migration 027) ✅
**Tabelas:** `event_organizers`, `event_organizer_members`  
**Status:** 100% implementado  

**Funcionalidades:**
- ✅ Organizadores profissionais
- ✅ Membros da equipe organizadora
- ✅ Permissões granulares

#### 1.3 Comércio/Tickets (Migration 069) ✅
**Tabelas:** `event_tickets`, `event_consumptions`, `event_parking`  
**Status:** 100% implementado  

**Funcionalidades:**
- ✅ Venda de ingressos
- ✅ Sistema de consumo (comanda)
- ✅ Estacionamento
- ✅ Integração com checkout

#### 1.4 Métricas (Migration 074) ✅
**Tabela:** `event_metrics`  
**Status:** 100% implementado  

**Funcionalidades:**
- ✅ Dashboard de métricas
- ✅ Métricas por organizador
- ✅ Analytics completo

#### 1.5 Eventos Culturais (Migration 084) ✅
**Tabelas:** `cultural_events`, `event_participants`, `event_revenue_split`  
**Status:** 100% implementado  

**Funcionalidades:**
- ✅ Eventos culturais específicos
- ✅ Participantes com papéis
- ✅ Split de receita automático
- ✅ Check-ins

#### 1.6 Multi-Actor (Migration 087) ✅
**Tabela:** `cultural_event_actor`  
**Status:** 85% implementado  

**Funcionalidades:**
- ✅ Múltiplos atores por evento
- ✅ Papéis (artist, venue, organizer, sponsor, supporter)
- ✅ Permissões (can_publish, can_edit)
- ✅ Revenue share declarativo
- ✅ Status (pending, accepted, rejected)
- ⚠️ PROBLEMA: Tabela `cultural_event_actor` não é `event_actor` genérico

**Limitação identificada:**
```sql
-- ATUAL (só para cultural)
cultural_event_actor (
  cultural_event_id → cultural_events
  cultural_profile_id → cultural_profiles
)

-- DEVERIA SER (genérico)
event_actor (
  event_id → events (qualquer tipo)
  actor_id → actors (sistema unificado)
)
```

#### 1.7 Modelo de Ocupação (Migration 086) ✅
**Tabelas:** `event_occupancy_models`, `event_reservations`  
**Status:** 100% implementado  

**Funcionalidades:**
- ✅ Gestão de capacidade
- ✅ Reservas de lugares
- ✅ Controle de ocupação em tempo real

#### 1.8 Escrow (Migration 092) ✅
**Tabelas:** `event_escrow`, `event_escrow_transactions`  
**Status:** 100% implementado  

**Funcionalidades:**
- ✅ Pagamentos em garantia (escrow)
- ✅ Transações rastreáveis
- ✅ Liberação automática pós-evento

#### 1.9 Services Backend ✅

**EventsService (events.service.ts):**
- ✅ CRUD de eventos
- ✅ Validações
- ✅ Integração com ocupação

**EventsMultiActorService (events-multi-actor.service.ts):**
- ✅ createEvent() - Cria como DRAFT
- ✅ addActorToEvent() - Adiciona participante
- ✅ updateActorStatus() - Aceita/rejeita
- ✅ publishEvent() - Publica (valida requisitos)
- ✅ getEventWithActors() - Busca evento + actors
- ✅ getEventsByActor() - Eventos de um actor

**OccupancyService (occupancy.service.ts):**
- ✅ Gestão de capacidade
- ✅ Reservas
- ✅ Waitlist

**EventMetricsService:**
- ✅ Dashboard
- ✅ Analytics

---

### 2. Frontend - Bem Estruturado ⚠️

#### 2.1 Página de Eventos ✅
**Arquivo:** `EventosPage.tsx`  
**Status:** 70% implementado  

**Funcionalidades:**
- ✅ Listagem de eventos
- ✅ Busca via feed social
- ✅ Busca via feed unificado
- ✅ Extração de eventos de posts
- ✅ Filtros básicos
- ⚠️ PROBLEMA: Lógica duplicada (feed social + unificado)
- ⚠️ PROBLEMA: Não usa actor como filtro primário

**Código atual (linhas 59-67):**
```typescript
const feedData = await getSocialFeed({
  actor_type: activeActor.actor_type as 'user' | 'page',
  actor_id: activeActor.actor_id,
  actor_status: activeActor.company_status,
  limit: 50,
});

const unifiedData = await getUnifiedFeed({ limit: 50 });
```

**Problema:** 2 chamadas separadas, sem filtro por actor nos eventos.

#### 2.2 Wizard de Criação ✅
**Arquivo:** `EventCreationWizard.tsx`  
**Status:** 90% implementado  

**Funcionalidades:**
- ✅ Wizard de 5 passos
- ✅ Informações básicas
- ✅ Tipo de evento
- ✅ Localização
- ✅ Ingressos/preços
- ✅ Revisão e publicação
- ✅ Integração com backend

#### 2.3 Componentes ✅

**EventCard.tsx:**
- ✅ Card visual de evento
- ✅ Informações principais
- ✅ Badge de status

**CulturalEventCard.tsx:**
- ✅ Card específico para eventos culturais
- ✅ Integração com perfis culturais

**EventCheckInModal.tsx:**
- ✅ Check-in de participantes
- ✅ QR Code

**EventCheckoutModal.tsx:**
- ✅ Checkout de ingressos
- ✅ Integração com pagamento

**EventMetricsDashboard.tsx:**
- ✅ Dashboard de métricas
- ✅ Gráficos

**OrganizerEventMetrics.tsx:**
- ✅ Métricas do organizador

#### 2.4 API Cliente ✅
**Arquivo:** `api/events.ts`  
**Status:** 80% implementado  

**Funções existentes:**
```typescript
✅ createEvent()
✅ getEvent()
✅ listEvents()
✅ publishEvent()
✅ checkInAttendee()
✅ getEventMetrics()
⚠️ FALTA: getEventsByActor()
⚠️ FALTA: addActorToEvent()
⚠️ FALTA: updateActorStatus()
```

---

## ❌ O QUE FALTA PARA FICAR 100% FUNCIONAL

### 3. Integração Actor → Eventos - CRÍTICO ⚠️

#### 3.1 Problema: Sistema Multi-Actor Fragmentado

**Atual:**
```
cultural_events → cultural_event_actor → cultural_profiles
     ↓                                         ↓
  Limitado                              Perfis culturais apenas
```

**Deveria ser:**
```
events → event_actor → actors (sistema universal)
  ↓                        ↓
Qualquer tipo       Pessoa, empresa, grupo, etc
```

#### 3.2 Solução: Migração para `event_actor` Universal

**Migration necessária:** `200_events_universal_actor.sql`

```sql
-- CRIAR TABELA UNIVERSAL
CREATE TABLE IF NOT EXISTS event_actor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- 🔑 RELACIONAMENTO UNIVERSAL
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE,
  
  -- 🔑 PAPEL E PERMISSÕES
  role TEXT NOT NULL CHECK (
    role IN (
      'creator',      -- Criador original
      'organizer',    -- Organizador
      'co_organizer', -- Co-organizador
      'artist',       -- Artista (para culturais)
      'venue',        -- Local (para culturais)
      'sponsor',      -- Patrocinador
      'supporter',    -- Apoiador
      'partner',      -- Parceiro
      'speaker',      -- Palestrante
      'moderator'     -- Moderador
    )
  ),
  
  can_publish BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_manage_attendees BOOLEAN NOT NULL DEFAULT false,
  can_view_metrics BOOLEAN NOT NULL DEFAULT false,
  
  -- 🔑 RECEITA
  revenue_share_percent NUMERIC(5,2),
  
  -- 🔑 STATUS
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'rejected', 'removed')
  ),
  
  -- 🔑 METADADOS
  invitation_message TEXT,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- 🔑 AUDITORIA
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by_actor_id UUID REFERENCES actors(actor_id),
  
  -- 🔑 CONSTRAINTS
  CONSTRAINT event_actor_unique UNIQUE (event_id, actor_id)
);

-- 🔑 ÍNDICES
CREATE INDEX idx_event_actor_event ON event_actor(event_id);
CREATE INDEX idx_event_actor_actor ON event_actor(actor_id);
CREATE INDEX idx_event_actor_role ON event_actor(role);
CREATE INDEX idx_event_actor_status ON event_actor(status);

-- 🔑 MIGRAR DADOS
-- De cultural_event_actor para event_actor
INSERT INTO event_actor (
  tenant_id, event_id, actor_id, role,
  can_publish, can_edit, revenue_share_percent,
  status, created_at, updated_at
)
SELECT
  cea.tenant_id,
  cea.cultural_event_id,
  -- Converter cultural_profile → actor
  (SELECT actor_id FROM actors WHERE /* lógica de conversão */),
  cea.role,
  cea.can_publish,
  cea.can_edit,
  cea.revenue_share_percent,
  cea.status,
  cea.created_at,
  cea.updated_at
FROM cultural_event_actor cea
WHERE NOT EXISTS (
  SELECT 1 FROM event_actor ea
  WHERE ea.event_id = cea.cultural_event_id
);
```

#### 3.3 Atualizar Tabela `events`

**Adicionar campos necessários:**

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by_actor_id UUID 
  REFERENCES actors(actor_id);

ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT 
  DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed'));

ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INTEGER;

ALTER TABLE events ADD COLUMN IF NOT EXISTS current_attendees INTEGER DEFAULT 0;

ALTER TABLE events ADD COLUMN IF NOT EXISTS location_name TEXT;

ALTER TABLE events ADD COLUMN IF NOT EXISTS datetime_start TIMESTAMPTZ;

ALTER TABLE events ADD COLUMN IF NOT EXISTS datetime_end TIMESTAMPTZ;

-- Índices
CREATE INDEX IF NOT EXISTS idx_events_actor 
  ON events(created_by_actor_id) WHERE created_by_actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_status 
  ON events(status) WHERE status = 'published';
```

---

### 4. Integração com Feed - CRÍTICO ⚠️

#### 4.1 Problema Atual

**EventosPage (linhas 59-67):**
```typescript
// PROBLEMA: 2 chamadas, lógica duplicada
const feedData = await getSocialFeed(...);
const unifiedData = await getUnifiedFeed(...);

// PROBLEMA: Extração manual de eventos
for (const post of feedData.posts) {
  if (post.linked_event) { ... }
  else if (post.intent === 'event') { ... }
}
```

**Problemas:**
1. ❌ Não filtra eventos por actor
2. ❌ Depende de posts (se não houver post, evento não aparece)
3. ❌ Lógica complexa de extração
4. ❌ Performance ruim (2 queries)

#### 4.2 Solução: Feed Unificado com Actor

**Nova API:** `/api/feed.ts`

```typescript
// ✅ SOLUÇÃO CORRETA
export async function getActorEvents(
  actorId: string,
  filters?: {
    status?: 'draft' | 'published' | 'cancelled' | 'completed';
    role?: string; // creator, organizer, artist, etc
    upcoming?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<Event[]> {
  const params = new URLSearchParams({
    actor_id: actorId,
    ...filters,
  });
  
  const response = await fetch(
    `/api/events/by-actor?${params}`,
    { headers: getAuthHeaders() }
  );
  
  return response.json();
}
```

**Backend necessário:** `/backend/src/modules/events/events.routes.ts`

```typescript
// ✅ NOVA ROTA
fastify.get<{
  Querystring: {
    actor_id: string;
    status?: string;
    role?: string;
    upcoming?: string;
    limit?: string;
  };
}>(
  '/by-actor',
  {
    preHandler: [fastify.requireAuth],
  },
  async (req, reply) => {
    const { actor_id, status, role, upcoming, limit } = req.query;
    
    let query = `
      SELECT DISTINCT e.*
      FROM events e
      INNER JOIN event_actor ea ON ea.event_id = e.id
      WHERE e.tenant_id = $1 AND ea.actor_id = $2
    `;
    
    const params: any[] = [req.tenant.id, actor_id];
    let paramIndex = 3;
    
    if (status) {
      query += ` AND e.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (role) {
      query += ` AND ea.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }
    
    if (upcoming === 'true') {
      query += ` AND e.datetime_start > NOW()`;
    }
    
    query += ` ORDER BY e.datetime_start DESC`;
    query += ` LIMIT $${paramIndex}`;
    params.push(parseInt(limit || '50', 10));
    
    const events = await runQueriesWithTenant(
      req.tenant.id,
      query,
      params
    );
    
    return events;
  }
);
```

#### 4.3 EventosPage Refatorado

```typescript
// ✅ VERSÃO CORRETA
const loadEvents = async () => {
  if (!validateActiveActor(activeActor)) return;
  
  setIsLoading(true);
  
  try {
    // Buscar eventos onde o actor participa
    const myEvents = await getActorEvents(activeActor.actor_id, {
      status: 'published',
      upcoming: true,
      limit: 50,
    });
    
    // Buscar eventos públicos da cidade (opcional)
    const cityEvents = await listEvents({
      city_id: activeActor.city_id,
      status: 'published',
      upcoming: true,
      limit: 50,
    });
    
    // Combinar e remover duplicatas
    const allEvents = [
      ...myEvents,
      ...cityEvents.filter(
        ce => !myEvents.some(me => me.id === ce.id)
      ),
    ];
    
    setEvents(allEvents);
  } catch (err) {
    setError('Erro ao carregar eventos');
  } finally {
    setIsLoading(false);
  }
};
```

---

### 5. Feed Social - Integração Bidirecional ⚠️

#### 5.1 Problema: Posts de Eventos

**Atual:**
```
Evento criado → Post automático com intent='event'
Post com intent='event' → NÃO cria evento
```

**Resultado:**
- ✅ Eventos aparecem no feed
- ❌ Não dá para criar evento pelo feed
- ❌ Eventos não aparecem na timeline do actor

#### 5.2 Solução: Integração Completa

**Quando criar evento:**

```typescript
// Backend: events.service.ts
async createEvent(input: CreateEventInput): Promise<Event> {
  // 1. Criar evento
  const event = await this.repository.create(input);
  
  // 2. Adicionar criador como organizador
  await eventActorService.addActorToEvent({
    eventId: event.id,
    actorId: input.createdByActorId,
    role: 'creator',
    canPublish: true,
    canEdit: true,
  });
  
  // 3. Criar post no feed social (NOVO!)
  await socialService.createPost({
    actorId: input.createdByActorId,
    intent: 'event',
    content: `📅 ${event.title}`,
    intentMetadata: {
      event_id: event.id,
      title: event.title,
      event_type: event.eventType,
      city_id: event.cityId,
      datetime_start: event.datetimeStart,
      status: event.status,
    },
    linkedEventId: event.id, // Vincular evento ao post
  });
  
  return event;
}
```

**Quando publicar evento:**

```typescript
async publishEvent(eventId: string): Promise<Event> {
  // 1. Atualizar status
  const event = await this.repository.update(eventId, {
    status: 'published',
  });
  
  // 2. Atualizar post vinculado (NOVO!)
  await socialService.updatePostsByLinkedEvent(eventId, {
    intentMetadata: {
      ...existingMetadata,
      status: 'published',
    },
  });
  
  // 3. Notificar participantes
  const actors = await eventActorService.getEventActors(eventId);
  for (const actor of actors) {
    await notificationService.send({
      actorId: actor.actorId,
      type: 'event_published',
      message: `O evento "${event.title}" foi publicado!`,
    });
  }
  
  return event;
}
```

---

### 6. Features Faltando - IMPORTANTE

#### 6.1 Gestão de Convites ❌

**O que falta:**
```typescript
// ❌ NÃO EXISTE

async inviteActorToEvent(
  eventId: string,
  invitedActorId: string,
  role: string,
  message?: string
): Promise<EventActor>

async acceptInvitation(
  invitationId: string
): Promise<EventActor>

async rejectInvitation(
  invitationId: string,
  reason?: string
): Promise<EventActor>
```

**Frontend necessário:**
- `EventInviteModal.tsx` - Convidar participantes
- `EventInvitationsPage.tsx` - Gerenciar convites recebidos

#### 6.2 Timeline do Evento ❌

**O que falta:**
Feed específico do evento mostrando:
- Posts dos participantes
- Fotos do evento
- Check-ins
- Comentários

```typescript
// ❌ NÃO EXISTE

async getEventTimeline(
  eventId: string,
  filters?: { limit?: number; offset?: number }
): Promise<Post[]>
```

#### 6.3 Notificações de Evento ⚠️

**Parcialmente implementado:**

**Falta notificar:**
- ❌ Novo convite para participar
- ❌ Convite aceito/rejeitado
- ❌ Evento publicado
- ❌ Lembrete 24h antes
- ❌ Evento cancelado
- ❌ Mudanças no evento

#### 6.4 Descoberta de Eventos ⚠️

**Atual:** Eventos aparecem misturados no feed  
**Falta:** Página dedicada de descoberta

```typescript
// ⚠️ MELHORAR EventosPage

Filtros necessários:
- Por categoria
- Por tipo (cultural, corporativo, social)
- Por data (hoje, esta semana, este mês)
- Por localização (cidade, bairro, raio)
- Por preço (grátis, pago)
- Por organizador
- Ordem (relevância, data, popularidade)
```

---

## 📋 CHECKLIST COMPLETO PARA 100%

### Backend (Faltam 15%)

**Estrutura:**
- [x] Core de eventos
- [x] Organizadores
- [x] Comércio/tickets
- [x] Métricas
- [x] Eventos culturais
- [ ] ⚠️ event_actor universal (migrar de cultural_event_actor)
- [x] Modelo de ocupação
- [x] Escrow

**Integrações:**
- [x] Multi-actor (85%)
- [ ] ❌ Feed social (criar post automático)
- [ ] ❌ Notificações completas
- [x] Pagamentos (90%)

**APIs:**
- [x] CRUD eventos
- [x] Gestão de participantes
- [ ] ❌ /by-actor (eventos de um actor)
- [ ] ❌ /timeline (feed do evento)
- [ ] ❌ /invite (convidar participantes)
- [ ] ❌ /discover (descoberta avançada)

**Progresso Backend: 85%**

### Frontend (Faltam 30%)

**Páginas:**
- [x] EventosPage (70%)
- [x] EventCreationWizard (90%)
- [ ] ❌ EventDetailPage completa
- [ ] ❌ EventInvitationsPage
- [ ] ❌ EventTimelinePage
- [ ] ❌ EventDiscoveryPage

**Componentes:**
- [x] EventCard
- [x] CulturalEventCard
- [x] EventCheckIn
- [x] EventCheckout
- [x] EventMetrics
- [ ] ❌ EventInviteModal
- [ ] ❌ EventActorsManager
- [ ] ❌ EventTimeline
- [ ] ❌ EventFilters avançados

**API Cliente:**
- [x] CRUD básico (80%)
- [ ] ❌ getActorEvents()
- [ ] ❌ inviteActor()
- [ ] ❌ acceptInvitation()
- [ ] ❌ getEventTimeline()

**Progresso Frontend: 70%**

### Integrações (Faltam 40%)

- [x] Backend bem estruturado
- [ ] ⚠️ Actor system (precisa event_actor universal)
- [ ] ❌ Feed social bidirecional
- [ ] ❌ Notificações completas
- [x] Pagamentos (90%)
- [ ] ❌ Timeline de eventos
- [ ] ❌ Descoberta avançada

**Progresso Integrações: 60%**

---

## 🚀 ROADMAP PARA MVP FUNCIONAL

### Fase 1: Migração Actor Universal (1 semana)

**Prioridade 1: event_actor**
- [ ] Criar migration 200_events_universal_actor.sql
- [ ] Migrar dados de cultural_event_actor
- [ ] Atualizar EventsMultiActorService
- [ ] Testes

### Fase 2: Integração Feed (1 semana)

**Prioridade 1: Posts Automáticos**
- [ ] Criar post ao criar evento
- [ ] Atualizar post ao publicar
- [ ] API /by-actor
- [ ] Refatorar EventosPage

### Fase 3: Gestão de Participantes (1 semana)

**Prioridade 1: Convites**
- [ ] API de convites
- [ ] EventInviteModal
- [ ] EventActorsManager
- [ ] Notificações

### Fase 4: Timeline e Descoberta (1 semana)

**Prioridade 1: Descoberta**
- [ ] Filtros avançados
- [ ] EventDiscoveryPage
- [ ] API /discover
- [ ] Timeline do evento

### Fase 5: Polish e Testes (1 semana)

**Prioridade 1: UX**
- [ ] Loading states
- [ ] Error handling
- [ ] Notificações completas
- [ ] Testes E2E

**TOTAL: 5 semanas (~1.5 mês)**

---

## 🎯 RECOMENDAÇÃO FINAL

### Status do Módulo Eventos

**Backend:** 85% completo ✅  
**Frontend:** 70% completo ⚠️  
**Integração Feed:** 60% completa ⚠️  
**TOTAL: 75% completo**

### Recomendações

#### Para MVP:
**✅ INCLUIR Eventos no MVP**

**Motivos:**
1. ✅ Backend 85% pronto
2. ✅ Frontend 70% funcional
3. ✅ Apenas 5 semanas para completar
4. ✅ Feature core do negócio
5. ✅ Integração com Social já existe (parcial)

#### Priorização:

**CRÍTICO (Semanas 1-2):**
- event_actor universal
- Integração feed bidirecional
- API /by-actor

**IMPORTANTE (Semanas 3-4):**
- Sistema de convites
- Descoberta avançada
- Timeline de eventos

**OPCIONAL (Semana 5):**
- Notificações completas
- Polish geral
- Testes E2E

---

## 💡 DIFERENCIAIS DO MÓDULO

O módulo de Eventos do UnifyCard tem **recursos únicos**:

### 1. Multi-Actor Colaborativo ✨
```
Evento pode ter:
- Múltiplos organizadores
- Artistas
- Local (venue)
- Patrocinadores
- Apoiadores

Cada um com permissões específicas!
```

### 2. Revenue Split Automático ✨
```
Receita é dividida automaticamente:
- 60% Artista
- 20% Local
- 15% Plataforma
- 5% Fundo comunitário

Configurável por evento!
```

### 3. Integração Total com Feed ✨
```
Eventos são cidadãos de primeira classe:
- Aparecem no feed social
- Posts sobre eventos
- Timeline específica
- Descoberta inteligente
```

### 4. Economia Integrada ✨
```
- Ingressos com MFI coins
- Comanda digital
- Escrow automático
- Cashback para participantes
```

---

## ✅ CONCLUSÃO

O módulo **Eventos está bem avançado** (75% completo) e **viável para MVP**.

**Para ficar 100% funcional integrado ao feed, falta:**

### Desenvolvimento (5 semanas)

**Semana 1:** event_actor universal  
**Semana 2:** Integração feed bidirecional  
**Semana 3:** Sistema de convites  
**Semana 4:** Descoberta e timeline  
**Semana 5:** Polish e testes  

### Investimento

- $0 em APIs externas
- $0 em custos operacionais
- Apenas tempo de desenvolvimento

### Riscos

- ⚠️ Baixos - arquitetura sólida
- ⚠️ Migração event_actor controlada
- ⚠️ Integração feed já parcialmente existente

**RECOMENDAÇÃO: INCLUIR no MVP e dedicar 5 semanas para completar integração com feed** ✅

**Nota importante:** A migração para `event_actor` universal deve ser feita **junto com** a refatoração da agenda proposta anteriormente, para garantir arquitetura consistente em todos os módulos.

---

**Autor:** Sistema de Auditoria UnifyCard  
**Data:** 11/01/2026  
**Versão:** 1.0
