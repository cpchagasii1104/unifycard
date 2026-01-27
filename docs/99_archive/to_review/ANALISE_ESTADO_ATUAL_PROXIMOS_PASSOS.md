# ANÁLISE: Estado Atual do UnifyCard + Próximos Passos
## Baseado em zips atualizados + Diretrizes da IA gerenciadora

**Data:** 12 de Janeiro de 2026  
**Contexto:** Sistema em produção com observabilidade passiva implementada  
**Próxima rodada:** Dashboards de Grupos e Eventos (ciclo de valor visível)

---

## 📊 ESTADO ATUAL DO SISTEMA

### 1. Observabilidade Passiva ✅ IMPLEMENTADA

**Status:** Contratos O-01 a O-06 implementados no backend

#### O-01: Densidade Cognitiva
```typescript
// Tabela: observability_cognitive_density
Métricas:
- cognitive_density_index (0-1)
- total_decisions_count
- unique_actors_count
- average_decisions_per_actor

Regra: SEM automação, SEM alertas, SEM identificação individual
```

#### O-02: Normalização
```typescript
// Tabela: observability_normalization
Métricas:
- variation_index (0-1)
- entropy_score
- unique_behavioral_patterns_count

Regra: SEM forçar normalização, SEM penalizar variação
```

#### O-03: Concentração Humana
```typescript
// Tabela: observability_concentration
Métricas:
- Distribuição de interações
- Centralidade emergente (sem nomear)
- Coeficiente de Gini

Regra: SEM ranking, SEM identificar pessoas específicas
```

#### Princípios Respeitados ✅
- ✅ Observabilidade é **PASSIVA** (não aciona decisões)
- ✅ Métricas são **AGREGADAS** (não identificam indivíduos)
- ✅ Sistema **NÃO julga** (sem scores, sem rankings)
- ✅ Sistema **NÃO corrige** (sem automação corretiva)
- ✅ Consciência sistêmica **SEM controle**

---

### 2. Backend: Módulo de Eventos

#### Estrutura de Dados ✅

**Event.ts:**
```typescript
interface Event {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  capacity: number | null;
  currentOccupancy?: number;  // ← JÁ EXISTE!
  maxCapacity?: number | null;
  ticketPrice?: number | null;
  status: 'draft' | 'published' | 'cancelled' | 'finished';
  // ... mais campos
}
```

**Serviços Disponíveis:**
- ✅ `events.service.ts` - CRUD básico
- ✅ `occupancy.service.ts` - Modelo de ocupação
- ✅ `event-feed.plugin.ts` - Integração com feed
- ✅ `event-organizer-metrics.service.ts` - Métricas

**Endpoints Existentes:**
```typescript
GET /api/events/:id                    // ✅ Retorna event com currentOccupancy
GET /api/events/:id/availability       // ✅ Preview de disponibilidade
GET /api/events/:id/participants       // ✅ Lista de participantes
GET /api/events/:id/metrics            // ✅ Métricas do evento
```

**Gap Identificado:**
```typescript
❌ NÃO EXISTE: Endpoint específico para stats (opcional)
   GET /api/events/:id/stats
   
✅ ALTERNATIVA: Usar event.currentOccupancy direto do GET /events/:id
```

---

### 3. Frontend: Página de Evento

**EventPage.tsx - Estado Atual:**

```typescript
// src/components/events/EventPage.tsx (516 linhas)

interface EventPageProps {
  eventId?: string;
  onNavigateToCheckout?: (type) => void;
}

// Dados carregados:
✅ event: Event                     // Via getEvent()
✅ availability: AvailabilityPreview // Via getEventAvailabilityPreview()
✅ participants: Array<...>          // Via getEventParticipants() ← Limitado a 20!
✅ relatedPosts: PostCardData[]
✅ metrics: EventMetrics
```

**Gap Crítico Identificado:**

```tsx
// PROBLEMA: Linha 92
const participantsData = await getEventParticipants(eventId, 20);
                                                              ^^
// Lista de participantes ≠ Contagem de ingressos vendidos!

// IMPACTO:
- Mostra apenas "20 participantes" mesmo se vendeu 500 ingressos
- Dados do evento têm `currentOccupancy` mas não está sendo usado
```

**Renderização Atual:**
```tsx
// EventPage.tsx NÃO mostra ingressos vendidos de forma clara
// Só mostra lista de participantes (limitada a 20)
```

---

### 4. Backend: Módulo de Grupos

#### Estrutura ⚠️ FRAGMENTADA

**Tabelas Principais:**
```sql
-- Migration 120
groups (
  group_id, name, description, slug,
  category_id, visibility, scope,
  owner_user_id
)

group_members (
  group_id, user_id, role, joined_at
)

group_posts (
  post_id, group_id, author_id, content
)

-- Outros (campanhas, votações, timeline, etc)
```

**Serviços:**
- ✅ `social-group.service.ts` - Existe
- ❌ **NÃO EXISTE:** Dashboard/stats específico

**Endpoints:**
```typescript
✅ GET /api/groups/:id           // Dados básicos do grupo
❌ NÃO EXISTE: GET /api/groups/:id/dashboard
❌ NÃO EXISTE: GET /api/groups/:id/stats
```

**Problema:** Dados de dashboard estão espalhados em múltiplas tabelas

---

### 5. Frontend: Página de Grupo

**Status:** ⚠️ DESATUALIZADO

**Arquivos:**
```
/tmp/frontend/src/pages/GroupsPage.tsx       // Lista de grupos
??? GrupoDetailPage.tsx ou GroupDetailPage.tsx
```

**Gap Crítico:**
```tsx
❌ NÃO TEM: Botão "Gerenciamento" visível
❌ NÃO TEM: Mini-dashboard do grupo
❌ NÃO TEM: Acesso rápido a configurações
```

---

## 🎯 PRÓXIMOS PASSOS (Definidos pela IA)

### PARTE A: EVENTOS - Ingressos Vendidos Visível

**Objetivo:** Mostrar claramente quantos ingressos foram vendidos

#### A1: Backend (Análise)

**Status:** ✅ **JÁ PRONTO!**

```typescript
// Event JÁ TEM o campo necessário:
interface Event {
  currentOccupancy?: number;  // ← USAR ESTE!
  maxCapacity?: number | null;
}

// GET /api/events/:id JÁ RETORNA estes dados
```

**Decisão:** **NÃO precisa criar endpoint /stats**  
**Motivo:** Dados já existem no DTO principal

#### A2: Frontend (Implementação)

**Arquivo:** `frontend/src/components/events/EventPage.tsx`

**Mudanças necessárias:**

```tsx
// ADICIONAR: Bloco de Ingressos no topo

<EventHeader>
  <EventTitle>{event.title}</EventTitle>
  <EventStatusBadge status={event.status} />
  
  {/* NOVO: Informação de Ingressos */}
  {event.currentOccupancy !== undefined && (
    <TicketInfo>
      <TicketsSold>
        🎟️ {event.currentOccupancy} ingressos vendidos
      </TicketsSold>
      
      {event.maxCapacity && (
        <TicketCapacity>
          de {event.maxCapacity} ({Math.round((event.currentOccupancy / event.maxCapacity) * 100)}% ocupado)
        </TicketCapacity>
      )}
      
      {!event.maxCapacity && (
        <TicketCapacity>
          (capacidade ilimitada)
        </TicketCapacity>
      )}
    </TicketInfo>
  )}
</EventHeader>
```

**CSS necessário:**
```css
.ticket-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.tickets-sold {
  font-size: 1.1rem;
  font-weight: 600;
  color: #2d3748;
}

.ticket-capacity {
  font-size: 0.95rem;
  color: #718096;
}
```

**⚠️ IMPORTANTE:** 
```tsx
// NÃO USAR participants.length como contagem oficial!
// participants é limitada a 20 registros

// ❌ ERRADO:
<span>{participants.length} participantes</span>

// ✅ CORRETO:
<span>{event.currentOccupancy || 0} ingressos vendidos</span>
```

---

### PARTE B: GRUPOS - Dashboard e Gerenciamento

**Objetivo:** Acesso claro a gerenciamento + métricas do grupo

#### B1: Backend - Criar Endpoint de Dashboard

**Novo arquivo:** `backend/src/modules/social/social-group-dashboard.service.ts`

```typescript
// ================================================
// SOCIAL GROUP DASHBOARD SERVICE
// ================================================
// Endpoint READ-ONLY para dashboard do grupo
// SEM automação, SEM scores, SEM rankings

interface GroupDashboard {
  groupId: string;
  
  // Contadores simples
  membersCount: number;
  eventsCount: number;
  postsCount: number;
  
  // Timestamps
  lastActivityAt: Date | null;
  updatedAt: Date;
}

export class SocialGroupDashboardService {
  async getGroupDashboard(
    tenantId: string,
    groupId: string
  ): Promise<GroupDashboard> {
    // Query 1: Contar membros
    const membersResult = await runQueryWithTenant<{ count: number }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM group_members
      WHERE group_id = $1
        AND left_at IS NULL
      `,
      [groupId]
    );
    
    // Query 2: Contar eventos do grupo (se vínculo existir)
    // NOTA: Verificar se events tem group_id ou multi-actor
    const eventsResult = await runQueryWithTenant<{ count: number }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM events
      WHERE created_by_actor_id IN (
        SELECT actor_id FROM actors
        WHERE source_type = 'group'
          AND source_id = $1
      )
      `,
      [groupId]
    );
    
    // Query 3: Contar posts do grupo
    const postsResult = await runQueryWithTenant<{ count: number }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM group_posts
      WHERE group_id = $1
      `,
      [groupId]
    );
    
    // Query 4: Última atividade
    const lastActivityResult = await runQueryWithTenant<{ last_activity: Date }>(
      tenantId,
      `
      SELECT MAX(created_at) as last_activity
      FROM group_posts
      WHERE group_id = $1
      `,
      [groupId]
    );
    
    return {
      groupId,
      membersCount: membersResult?.count || 0,
      eventsCount: eventsResult?.count || 0,
      postsCount: postsResult?.count || 0,
      lastActivityAt: lastActivityResult?.last_activity || null,
      updatedAt: new Date()
    };
  }
}
```

**Rota:**
```typescript
// backend/src/modules/social/social-group.routes.ts

router.get(
  '/groups/:groupId/dashboard',
  async (req, res) => {
    const { groupId } = req.params;
    const tenantId = req.tenantId;
    
    // Validar permissão (membro do grupo)
    const isMember = await checkGroupMembership(tenantId, groupId, req.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const dashboard = await groupDashboardService.getGroupDashboard(
      tenantId,
      groupId
    );
    
    res.json(dashboard);
  }
);
```

#### B2: Frontend - Página de Grupo com Dashboard

**Arquivo:** `frontend/src/pages/GroupDetailPage.tsx` (ou criar se não existe)

```tsx
// ================================================
// GROUP DETAIL PAGE
// ================================================

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getGroup, getGroupDashboard } from '../api/groups';

interface GroupDashboard {
  groupId: string;
  membersCount: number;
  eventsCount: number;
  postsCount: number;
  lastActivityAt: string | null;
}

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [group, setGroup] = useState(null);
  const [dashboard, setDashboard] = useState<GroupDashboard | null>(null);
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);
  
  useEffect(() => {
    loadGroupData();
  }, [groupId]);
  
  const loadGroupData = async () => {
    try {
      // Carregar dados básicos do grupo
      const groupData = await getGroup(groupId);
      setGroup(groupData);
      
      // Verificar permissões
      const userRole = groupData.currentUserRole; // Assumindo que vem no DTO
      setIsOwnerOrAdmin(
        userRole === 'owner' || userRole === 'admin'
      );
      
      // Carregar dashboard
      const dashboardData = await getGroupDashboard(groupId);
      setDashboard(dashboardData);
    } catch (err) {
      console.error('Erro ao carregar grupo:', err);
    }
  };
  
  return (
    <div className="group-detail-page">
      {/* Header */}
      <GroupHeader>
        <GroupAvatar src={group?.avatarUrl} />
        <GroupInfo>
          <GroupName>{group?.name}</GroupName>
          <GroupDescription>{group?.description}</GroupDescription>
        </GroupInfo>
        
        {/* NOVO: Botão Gerenciamento */}
        {isOwnerOrAdmin && (
          <ManagementButton onClick={() => navigate(`/grupos/${groupId}/gerenciar`)}>
            ⚙️ Gerenciamento
          </ManagementButton>
        )}
      </GroupHeader>
      
      {/* NOVO: Mini-Dashboard */}
      {dashboard && (
        <GroupDashboard>
          <DashboardCard>
            <CardIcon>👥</CardIcon>
            <CardValue>{dashboard.membersCount}</CardValue>
            <CardLabel>Membros</CardLabel>
          </DashboardCard>
          
          <DashboardCard>
            <CardIcon>🎭</CardIcon>
            <CardValue>{dashboard.eventsCount}</CardValue>
            <CardLabel>Eventos</CardLabel>
          </DashboardCard>
          
          <DashboardCard>
            <CardIcon>📝</CardIcon>
            <CardValue>{dashboard.postsCount}</CardValue>
            <CardLabel>Posts</CardLabel>
          </DashboardCard>
          
          {dashboard.lastActivityAt && (
            <DashboardCard>
              <CardIcon>⏰</CardIcon>
              <CardValue>{formatRelativeTime(dashboard.lastActivityAt)}</CardValue>
              <CardLabel>Última Atividade</CardLabel>
            </DashboardCard>
          )}
        </GroupDashboard>
      )}
      
      {/* Resto do conteúdo do grupo */}
      <GroupTabs>
        <Tab active>Feed</Tab>
        <Tab>Membros</Tab>
        <Tab>Eventos</Tab>
        <Tab>Campanhas</Tab>
      </GroupTabs>
      
      {/* Conteúdo das tabs */}
    </div>
  );
}
```

**CSS necessário:**
```css
.group-dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin: 2rem 0;
}

.dashboard-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
}

.card-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.card-value {
  font-size: 2rem;
  font-weight: 700;
  color: #2d3748;
  margin-bottom: 0.25rem;
}

.card-label {
  font-size: 0.875rem;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.management-button {
  background: #4299e1;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

.management-button:hover {
  background: #3182ce;
}
```

#### B3: API Client

**Arquivo:** `frontend/src/api/groups.ts`

```typescript
// Adicionar ao client existente:

export interface GroupDashboard {
  groupId: string;
  membersCount: number;
  eventsCount: number;
  postsCount: number;
  lastActivityAt: string | null;
  updatedAt: string;
}

export async function getGroupDashboard(
  groupId: string
): Promise<GroupDashboard> {
  const response = await fetch(`/api/groups/${groupId}/dashboard`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Erro ao carregar dashboard do grupo');
  }
  
  return response.json();
}
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### PARTE A: Eventos (1-2 dias)

**Backend:**
- [x] Campo `currentOccupancy` já existe ✅
- [x] GET /events/:id já retorna o dado ✅
- [ ] Nenhuma mudança necessária

**Frontend:**
```
[ ] Modificar EventPage.tsx
    [ ] Adicionar bloco <TicketInfo>
    [ ] Usar event.currentOccupancy
    [ ] Adicionar CSS para .ticket-info
    [ ] Testar com evento com e sem capacity
[ ] Validar no navegador
[ ] npm run build (garantir zero erros)
```

---

### PARTE B: Grupos (3-5 dias)

**Backend:**
```
[ ] Criar social-group-dashboard.service.ts
    [ ] Método getGroupDashboard()
    [ ] Query membersCount
    [ ] Query eventsCount
    [ ] Query postsCount
    [ ] Query lastActivityAt
[ ] Adicionar rota GET /groups/:groupId/dashboard
    [ ] Validação de permissão (isMember)
    [ ] Retornar GroupDashboard
[ ] Documentar endpoint em docs/
[ ] pnpm run build:check
```

**Frontend:**
```
[ ] Criar/Atualizar GroupDetailPage.tsx
    [ ] Importar getGroupDashboard
    [ ] State para dashboard
    [ ] Verificar isOwnerOrAdmin
    [ ] Renderizar botão "Gerenciamento"
    [ ] Renderizar mini-dashboard
    [ ] Adicionar CSS
[ ] Atualizar api/groups.ts
    [ ] Interface GroupDashboard
    [ ] Função getGroupDashboard()
[ ] Validar no navegador
[ ] npm run build
```

---

## 🎯 RESULTADO ESPERADO

### Eventos (Antes → Depois)

**ANTES:**
```
[Evento XYZ]
Status: Publicado

📍 Local: Teatro Municipal
📅 Data: 15/01/2026

[Lista de 20 participantes...] ← Confuso!
```

**DEPOIS:**
```
[Evento XYZ]
Status: Publicado

🎟️ 487 ingressos vendidos de 500 (97% ocupado)  ← CLARO!

📍 Local: Teatro Municipal
📅 Data: 15/01/2026
```

### Grupos (Antes → Depois)

**ANTES:**
```
[Grupo Desenvolvedores React]
Descrição: Grupo para devs React

[Aba: Feed | Membros | Eventos]
```

**DEPOIS:**
```
[Grupo Desenvolvedores React]
Descrição: Grupo para devs React

[⚙️ Gerenciamento] ← Visível para admins

┌──────┬──────┬──────┬──────────┐
│ 👥   │ 🎭  │ 📝   │ ⏰       │
│ 234  │ 12  │ 156  │ há 2h    │
│Membros│Eventos│Posts│Atividade│
└──────┴──────┴──────┴──────────┘

[Aba: Feed | Membros | Eventos]
```

---

## 🚦 GUARDRAILS (Obrigatórios)

### ✅ O que DEVE ser respeitado:

1. **Feed é orquestrador visual** - Não executa domínio
2. **Backend é fonte de verdade** - Frontend apenas consome
3. **Sem decisões automáticas** - Sem scores, sem rankings
4. **Observabilidade passiva** - Sem alertas, sem ações
5. **Sem dados pessoais** - Agregações apenas
6. **Contratos respeitados** - Ver OBSERVABILIDADE_PASSIVA.md

### ❌ O que NÃO fazer:

1. ❌ **Não criar scores** de grupos ou eventos
2. ❌ **Não ranquear** grupos por atividade
3. ❌ **Não criar alertas** automáticos
4. ❌ **Não identificar** usuários individualmente
5. ❌ **Não automatizar** decisões baseadas em métricas
6. ❌ **Não quebrar** contratos O-01 a O-06

---

## 📚 DOCUMENTOS DE REFERÊNCIA

**Backend:**
```
/tmp/backend/docs/OBSERVABILIDADE_PASSIVA.md
/tmp/backend/ARCHITECTURE_GUARDRAILS.md
/tmp/backend/AUTONOMY_RULES.md
```

**Frontend:**
```
/tmp/frontend/src/components/events/EventPage.tsx (516 linhas)
/tmp/frontend/src/pages/GroupsPage.tsx
```

**Contratos:**
```
O-01: DENSIDADE COGNITIVA
O-02: NORMALIZAÇÃO
O-03: CONCENTRAÇÃO HUMANA
O-04: PADRÕES EMERGENTES
O-05: RASTREAMENTO TEMPORAL
O-06: EXPOSIÇÃO CONTEXTUAL
```

---

## 🎬 PRÓXIMO PASSO (Após A+B)

Quando Eventos e Grupos estiverem prontos, o próximo ciclo será:

**"Painel Meus Compromissos" (Home)**

```tsx
<MyCommitments>
  <Section>
    📬 Inbox: 3 pendências
  </Section>
  
  <Section>
    📅 Agenda: 2 agendamentos esta semana
  </Section>
  
  <Section>
    🎭 Meus Eventos: 1 organizando, 3 participando
  </Section>
</MyCommitments>
```

**Princípio:** Visão geral **SEM** feed que "manda na vida"

---

## ✅ CONCLUSÃO

### Estado Atual

**Backend:**
- ✅ Observabilidade passiva implementada (O-01 a O-06)
- ✅ Eventos com `currentOccupancy` disponível
- ⚠️ Grupos sem endpoint de dashboard

**Frontend:**
- ⚠️ EventPage não mostra ingressos vendidos claramente
- ❌ GroupDetailPage não tem dashboard/gerenciamento

### Próxima Entrega

**PARTE A (Eventos):**
- Exibir "X ingressos vendidos de Y"
- Usar `event.currentOccupancy` que já existe
- Tempo: 1-2 dias

**PARTE B (Grupos):**
- Endpoint GET /groups/:id/dashboard
- Mini-dashboard na página do grupo
- Botão "Gerenciamento" para admins
- Tempo: 3-5 dias

**TOTAL: ~1 semana**

### Impacto

- ✅ Usuários veem dados reais (não estimativas)
- ✅ Admins de grupo têm acesso fácil a gerenciamento
- ✅ Sistema mantém princípios (passivo, sem automação)
- ✅ Backend + Frontend juntos (como mandado)

**Tudo pronto para ser implementado pelo Cursor com as diretrizes fornecidas!** 🚀

---

**Autor:** Sistema de Auditoria UnifyCard  
**Data:** 12/01/2026  
**Versão:** 1.0  
**Status:** AGUARDANDO IMPLEMENTAÇÃO
