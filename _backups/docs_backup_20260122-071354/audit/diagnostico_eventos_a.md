# 🔍 DIAGNÓSTICO: Estado Atual do Sistema de Eventos

> **Opção A — Mapa de Gaps entre Sistema REAL vs Sistema IDEAL**
> Gerado em: 28/12/2025

---

## 📊 RESUMO EXECUTIVO

O UnifiCard possui **DOIS sistemas de eventos paralelos** que não se comunicam:

| Sistema | Tabela | Módulo Backend | API Frontend | Status |
|---------|--------|----------------|--------------|--------|
| Eventos Genéricos | `events` | `/modules/events/` | `/api/events.ts` | ⚠️ Parcial |
| Eventos Culturais | `cultural_events` | `/modules/cultural/` | `/api/cultural.ts` | ⚠️ Parcial |

**Problema central:** Nenhum dos dois sistemas está completamente integrado com o CORE (Identity, Economy, Feed, Actors).

---

## 🏗️ ESTRUTURA ATUAL

### 1. Sistema de Eventos Genéricos (Migration 026)

**Tabela:** `events`

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  city_id UUID,
  state_id UUID,
  country_id UUID,
  created_by_global_user_id UUID NOT NULL,  -- ❌ Não usa Actor
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Características:**
- ❌ **Não tem `event_type`** - todos eventos são iguais
- ❌ **Não usa Actor** - usa `global_user_id` direto
- ❌ **Não tem campos econômicos** - sem preço, sem split
- ✅ Tem tabelas auxiliares: `event_sessions`, `event_locations`, `event_staff`, `event_attendees`
- ✅ Tem sistema multi-actor (migration 087)

**Endpoints Backend:**
```
POST   /events/create
GET    /events/:id
POST   /events/multi-actor/create
POST   /events/multi-actor/:id/add-actor
POST   /events/multi-actor/:id/publish
GET    /events/multi-actor/:id
GET    /events/multi-actor/actor/:actorId
```

---

### 2. Sistema de Eventos Culturais (Migration 084)

**Tabela:** `cultural_events`

```sql
CREATE TABLE cultural_events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  created_by_cultural_profile_id UUID NOT NULL,  -- 🔶 Usa PAC, não Actor direto
  co_creators_cultural_profile_ids UUID[],
  event_type VARCHAR(50) NOT NULL,  -- ✅ Tem tipo
  title VARCHAR(255) NOT NULL,
  description TEXT,
  datetime_start TIMESTAMP WITH TIME ZONE NOT NULL,
  datetime_end TIMESTAMP WITH TIME ZONE NOT NULL,
  location_cultural_profile_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
  ticket_price_cents INTEGER,  -- ✅ Campo econômico
  max_attendees INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);
```

**Tipos de evento disponíveis:**
- SHOW, OFICINA, FESTIVAL, RODA, AULA, EXPOSICAO, DEBATE, INTERVENCAO

**Tabelas auxiliares:**
- `event_participants` - participantes com role (ARTIST, HOST, PRODUCER, SUPPORT)
- `event_revenue_split` - split personalizado (NÃO integrado com CORE)
- `cultural_event_checkins` - check-ins

**Endpoints Backend:**
```
POST   /cultural/events
POST   /cultural/events/:id/publish
POST   /cultural/events/:id/confirm-location
POST   /cultural/events/:id/complete
GET    /cultural/events/:id
GET    /cultural/events
POST   /cultural/events/:id/check-in
GET    /cultural/events/:id/check-in/status
GET    /cultural/events/:id/checkins/count
```

---

## ❌ GAPS CRÍTICOS IDENTIFICADOS

### GAP 1: Split NÃO Integrado com CORE Economy

**Situação atual:**
- `cultural_events` tem tabela própria `event_revenue_split`
- Define percentuais personalizados por evento
- **NÃO chama `splitEngineService`**
- **NÃO cria transações no ledger**

**Consequência:**
> Compra de ingresso em evento cultural **não gera economia real**.
> Split é apenas registrado, não executado.

**Evidência:**
```bash
grep -rn "split.service\|splitService\|distribution" /modules/cultural/*.ts
# Resultado: VAZIO
```

---

### GAP 2: Actor vs Global User vs Cultural Profile

**Problema de identidade:**

| Sistema | Identidade de Criador | Problema |
|---------|----------------------|----------|
| `events` | `created_by_global_user_id` | Não usa Actor abstrato |
| `cultural_events` | `created_by_cultural_profile_id` | Usa PAC, não Actor |
| Posts | `actor_id + actor_type` | ✅ Correto |

**Consequência:**
> Não é possível perguntar "quais eventos este Actor criou?" de forma unificada.
> Page (empresa) cria via `cultural_events` usando PAC.
> User cria via `events` usando `global_user_id`.

---

### GAP 3: Feed Não Sabe Qual Sistema Usar

**Situação atual no frontend:**

```typescript
// SocialFeed2.tsx - Verifica eventos de duas formas
post.intent === 'event' || post.linked_event

// PostCard.tsx
if (post.intent === 'event') return { emoji: '🎭', label: 'Evento' };
```

**Problema:**
- Posts com `intent='event'` são eventos do **Sistema Genérico** (via `posts.event_id`)
- `CulturalEventCard` renderiza eventos do **Sistema Cultural** (via `cultural_events`)
- Feed não sabe automaticamente qual card usar

**Consequência:**
> Dois caminhos de renderização diferentes para "eventos".
> Inconsistência visual e funcional.

---

### GAP 4: Event Type Inconsistente

**Sistema Cultural (Backend):**
```typescript
event_type IN ('SHOW', 'OFICINA', 'FESTIVAL', 'RODA', 'AULA', 
               'EXPOSICAO', 'DEBATE', 'INTERVENCAO')
```

**Sistema de Intenção (IntentOrchestrator):**
```typescript
eventSubtype?: 'SHOW' | 'CINEMA' | 'ESPORTE' | 'BAR' | 'RESTAURANTE' | 
               'FEIRA' | 'WORKSHOP' | 'EXPOSICAO' | 'FESTIVAL' | 'BALADA';
```

**Problema:**
- Valores diferentes
- Nenhum contrato único
- IA pode classificar de forma diferente do que backend aceita

---

### GAP 5: Check-in Não Conecta com Economia

**Situação atual:**
- Check-in existe em `cultural_event_checkins`
- `checkInToEvent()` registra check-in
- Retorna `impact_generated: number`

**Problema:**
- `impact_generated` é calculado, mas **não registrado no ledger**
- Check-in não dispara `splitEngineService.applySplits()`

**Evidência no frontend:**
```typescript
// CulturalEventCard.tsx
const result = await checkInToEvent(event.id, { method: 'MANUAL' });
// result.impact_generated existe mas não cria transação real
```

---

### GAP 6: Posts Linkam Apenas com `events`, Não com `cultural_events`

**Migration 070:**
```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS event_id UUID NULL;
ALTER TABLE posts ADD CONSTRAINT fk_posts_event 
  FOREIGN KEY (event_id) REFERENCES events(id);  -- ❌ Só events, não cultural_events
```

**Workaround atual:**
```typescript
// social-2.0.service.ts
if (metadata.cultural_event_id || row.event_id) {
  // Usa metadata.cultural_event_id como alternativa
}
```

**Consequência:**
> Posts precisam usar metadata JSON para linkar com eventos culturais.
> Não há integridade referencial.

---

## 📋 MATRIZ DE INTEGRAÇÃO COM CORE

| Componente CORE | Sistema Genérico | Sistema Cultural |
|----------------|------------------|------------------|
| **IDENTITY** (global_user_id) | ✅ Usa | 🔶 Usa via PAC |
| **ECONOMY** (Split Engine) | ❌ Não usa | ❌ Não usa |
| **FEED** (Posts) | 🔶 Parcial (event_id) | 🔶 Parcial (metadata) |
| **ACTORS** (actor_id/type) | 🔶 Multi-actor | ❌ Não usa |

---

## 🗂️ INVENTÁRIO DE ARQUIVOS

### Backend

```
/modules/events/
├── events.routes.ts (662 linhas)
├── events.service.ts (18K)
├── events-multi-actor.service.ts (11K)
├── events-payment.service.ts (4K)
├── event-metrics.service.ts (5K)
├── event-state.service.ts (3.5K)
├── occupancy.service.ts (10K)
└── organizers/ (57K total)

/modules/cultural/
├── cultural.routes.ts (638 linhas)
├── cultural-event.service.ts (40K) ⚠️ MAIOR ARQUIVO
├── cultural-profile.service.ts (11K)
└── cultural.module.ts
```

### Frontend

```
/api/events.ts - Sistema Genérico + Multi-Actor
/api/cultural.ts - Sistema Cultural + Check-in

/components/events/
├── EventCard.tsx
├── EventCheckout.tsx (usa cultural)
├── EventCheckInModal.tsx (usa cultural)
├── EventCheckoutModal.tsx (usa cultural)
├── EventPage.tsx
└── EventMetricsDashboard.tsx

/components/social/
├── CulturalEventCard.tsx (usa cultural)
└── PostCard.tsx (usa intent='event')
```

### Migrations Relacionadas

```
026_events_core.sql          - Tabela base events
027_event_organizers.sql     - Organizadores
067_schedules_event_owner.sql
068_events_lifecycle_extension.sql
069_event_commerce.sql
070_posts_event_link.sql     - FK posts → events
071_event_consumption_status.sql
072_event_idempotency.sql
074_event_metrics.sql
082_audit_events.sql
084_cultural_events.sql      - Tabela cultural_events
085_cultural_event_checkins.sql
086_event_occupancy_model.sql
087_events_multi_actor.sql
```

---

## 🎯 O QUE O SISTEMA IDEAL PRECISA

Baseado na arquitetura discutida anteriormente:

### 1. Tabela Única `events`
- Com `event_type` como discriminador
- Com `actor_id` + `actor_type` (não global_user_id, não cultural_profile_id)
- Com campos econômicos opcionais

### 2. Integração com Split Engine
- Checkout → `splitEngineService.applySplits()`
- Transações reais no ledger
- Impacto visível e rastreável

### 3. Feed Unificado
- Todo evento é um item de feed
- Card adapta baseado em `event_type`
- Mesma estrutura técnica, leitura diferente

### 4. Actor como Origem
- User ou Page cria evento
- Sem intermediário (PAC opcional, não obrigatório)

---

## ⚠️ DECISÕES PENDENTES

Antes de implementar, Clayton precisa decidir:

1. **Migrar `cultural_events` para `events` unificado?**
   - Opção A: Sim, criar migration para merge
   - Opção B: Não, manter separado com adaptadores

2. **O que fazer com PAC (Cultural Profile)?**
   - Opção A: PAC vira "perfil artístico" opcional do Actor
   - Opção B: PAC continua como entidade separada
   - Opção C: PAC é deprecado

3. **Split personalizado vs Split fixo (70/15/10/5)?**
   - Opção A: Sempre 70/15/10/5
   - Opção B: Customizável por evento (como `event_revenue_split` atual)
   - Opção C: Híbrido (base fixa + customização de quem recebe o 70%)

---

## 📊 PRÓXIMO PASSO: Contrato de Eventos v1 (Opção B)

Com este diagnóstico em mãos, o próximo documento deve:

1. **Definir a tabela unificada** (schema final)
2. **Definir taxonomia de `event_type`** (enum oficial)
3. **Definir regras de Actor × EventType**
4. **Definir integração com Split Engine**
5. **Definir fluxo de criação (Wizard)**
6. **Definir proteções (IA como guardiã)**

---

*Diagnóstico gerado por análise automatizada do código-fonte.*
*Baseado em: `/home/claude/unificard/` extraído de `unificard.zip`*
