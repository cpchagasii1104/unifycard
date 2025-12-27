# 🔥 PROMPT DEFINITIVO — EVENTOS COMO START OFICIAL DO PRODUTO
**Para o Cursor executar sem ambiguidade**

## 🎯 CONTEXTO ESTRATÉGICO

Após auditoria completa (DB + arquitetura), o sistema está **validado para produção**.
Decisão estratégica tomada:

> **EVENTOS serão o ponto de entrada principal do produto.**

**Objetivo desta etapa:**
* Tornar eventos o **centro do feed**
* Garantir redistribuição correta (bar, banda, casa, página)
* Preparar o sistema para grandes eventos (10k–50k pessoas)
* Sem criar módulos novos desnecessários

---

## 🧱 ESCOPO — EXECUTAR EM ORDEM

### 1️⃣ FEED — EVENTO COMO PRIMEIRO CIDADÃO

#### Problema Atual
Eventos culturais aparecem no feed, mas têm **mesma prioridade visual** que posts comuns.

#### Ação Obrigatória

**Backend (`social-2.0.service.ts`):**
* Ajustar `calculateContentWeight` para dar **peso máximo** a eventos culturais:
  * **PF Mode:** Adicionar caso especial:
    ```typescript
    // Eventos culturais = 150 (prioridade máxima)
    if (row.metadata?.cultural_event_id || row.intent === 'cultural_event') {
      return 150;
    }
    ```
  * **PJ Mode:** Adicionar caso especial:
    ```typescript
    // Eventos culturais = 150 (prioridade máxima)
    if (row.metadata?.cultural_event_id || row.intent === 'cultural_event') {
      return 150;
    }
    ```
  * Posts relacionados a eventos (com `metadata.event_id`): peso **120**

**Frontend (`SocialFeed2.tsx`):**
* Ajustar ordenação visual do array `feedItems`:
  ```typescript
  feedItems.sort((a, b) => {
    // 1. Eventos culturais SEMPRE primeiro
    if (a.type === 'cultural_event' && b.type !== 'cultural_event') return -1;
    if (a.type !== 'cultural_event' && b.type === 'cultural_event') return 1;
    
    // 2. Dentro de eventos, ordenar por datetime_start (mais próximo primeiro)
    if (a.type === 'cultural_event' && b.type === 'cultural_event') {
      const dateA = new Date(a.data.datetime_start).getTime();
      const dateB = new Date(b.data.datetime_start).getTime();
      return dateA - dateB; // Mais próximo primeiro
    }
    
    // 3. Dentro de posts, ordenar por created_at (mais recente primeiro)
    if (a.type === 'post' && b.type === 'post') {
      return new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime();
    }
    
    return 0;
  });
  ```

**Frontend (`CulturalEventCard.tsx`):**
* Aumentar `font-size` do título do evento em **1.2x** vs título de post:
  ```css
  .event-title {
    font-size: 1.2rem; /* vs 1rem em posts */
    font-weight: 600; /* vs 500 em posts */
  }
  ```

#### Resultado Esperado
Feed "parece" uma agenda viva, não um mural genérico.

---

### 2️⃣ REDISTRIBUIÇÃO (AMPLIFICAÇÃO, NÃO DUPLICAÇÃO)

#### Problema Atual
Compartilhamento de eventos pode criar confusão sobre qual é o "evento real".

#### Ação Obrigatória

**Backend (`social-2.0.service.ts`):**
* Ao buscar feed, verificar se post tem `metadata.event_id` ou `metadata.cultural_event_id`
* Se tiver, buscar dados do evento e incluir no retorno:
  ```typescript
  // Após buscar posts, para cada post com event_id:
  if (row.metadata?.cultural_event_id) {
    try {
      const { culturalEventService } = await import('../cultural/cultural-event.service');
      const event = await culturalEventService.getEvent(tenantId, row.metadata.cultural_event_id);
      if (event) {
        post.linked_event = {
          id: event.id,
          title: event.title,
          datetime_start: event.datetime_start,
          location_cultural_profile_id: event.location_cultural_profile_id,
          shared_by: row.display_name // Nome do ator que compartilhou
        };
      }
    } catch (err) {
      console.warn('Erro ao buscar evento vinculado (não crítico):', err);
    }
  }
  ```

**Frontend (`SocialFeed2.tsx`):**
* Ao renderizar post com `linked_event`:
  * Mostrar badge antes do conteúdo:
    ```tsx
    {post.linked_event && (
      <div className="post-shared-event-badge">
        🔁 Compartilhado por <strong>{post.linked_event.shared_by}</strong> do evento <strong>{post.linked_event.title}</strong>
      </div>
    )}
    ```
  * Linkar para o evento original (não duplicar card)
  * Aumentar peso visual do post (mas não mais que evento direto)

**Frontend (`PostComposer.tsx` / `IntentComposer.tsx`):**
* Se usuário está visualizando evento, adicionar opção:
  * "Compartilhar este evento" → cria post com `intent='event'` e `metadata.cultural_event_id`

#### Resultado Esperado
1 evento → N contextos → 1 verdade (mesmo `event_id`).

---

### 3️⃣ PREFERÊNCIAS + GEO NO FEED

#### Problema Atual
Feed não considera preferências do usuário nem geolocalização.

#### Ação Obrigatória

**Backend (`social-2.0.service.ts`):**
* Adicionar parâmetros opcionais ao `getFeed`:
  ```typescript
  async getFeed(
    tenantId: string,
    globalUserId: string,
    cursor: string | undefined,
    limit: number,
    actorType: 'user' | 'page',
    actorId?: string,
    actorStatus?: string,
    userPreferences?: { // NOVO
      music_genres?: string[];
      event_types?: string[];
    },
    userLocation?: { // NOVO
      lat: number;
      lng: number;
    }
  )
  ```
* Ajustar `calculateContentWeight` para considerar preferências e geo:
  ```typescript
  const calculateContentWeight = (row: any, mode: 'user' | 'page', userPreferences?: any, userLocation?: any): number => {
    let baseWeight = /* peso base conforme modo */;
    
    // Bonus por preferências (se evento cultural)
    if (row.metadata?.cultural_event_id && userPreferences) {
      const eventType = row.metadata?.event_type;
      if (userPreferences.event_types?.includes(eventType)) {
        baseWeight += 20; // Match de tipo de evento
      }
    }
    
    // Bonus por geolocalização (se evento cultural tem localização)
    if (row.metadata?.cultural_event_id && userLocation && row.metadata?.event_location) {
      const distance = calculateHaversineDistance(
        userLocation.lat, userLocation.lng,
        row.metadata.event_location.lat, row.metadata.event_location.lng
      );
      if (distance < 5) baseWeight += 30; // < 5km
      else if (distance < 20) baseWeight += 15; // < 20km
      else if (distance < 50) baseWeight += 5; // < 50km
    }
    
    return baseWeight;
  };
  
  // Função auxiliar para calcular distância (Haversine)
  function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  ```
* **Regra de ouro:**
  > Preferência e localização **pesam**, não censuram.
  > Eventos sem match ainda aparecem, só com peso menor.

**Frontend (`SocialFeed2.tsx`):**
* Ao carregar feed, buscar preferências do usuário (se existir endpoint)
* Solicitar permissão de geolocalização (opcional, não bloqueia):
  ```typescript
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (err) => {
          console.warn('Geolocalização não disponível (não crítico):', err);
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, []);
  ```
* Passar `userPreferences` e `userLocation` para `getSocialFeed`

#### Resultado Esperado
Feed prioriza eventos relevantes, mas não esconde o resto.

---

### 4️⃣ PREPARAR CHECK-IN (FASE 17) PARA EVENTOS ÂNCORA

#### Problema Atual
Check-in está implementado, mas precisa estar **visível e acessível** em eventos grandes.

#### Ação Obrigatória

**Backend (`cultural-event.service.ts`):**
* Endpoint `GET /cultural/events/:eventId/check-ins` deve suportar:
  * `limit` alto (até 1000 para eventos grandes)
  * `cursor` pagination eficiente
  * Contagem total rápida (sem carregar todos):
    ```typescript
    async getCheckInCount(tenantId: string, eventId: string): Promise<number> {
      const result = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*)::text as count
        FROM cultural_event_checkins
        WHERE tenant_id = $1 AND event_id = $2
        `,
        [tenantId, eventId]
      );
      return parseInt(result?.count || '0', 10);
    }
    ```

**Frontend (`CulturalEventCard.tsx`):**
* Adicionar contador de check-ins:
  ```typescript
  const [checkInCount, setCheckInCount] = useState<number | null>(null);
  
  useEffect(() => {
    if (event.status === 'PUBLISHED' || event.status === 'CONFIRMED') {
      // Buscar contagem de check-ins (se endpoint existir)
      // Por enquanto, pode ser mockado ou buscar da lista
    }
  }, [event.id, event.status]);
  ```
* Mostrar contador no card:
  ```tsx
  {checkInCount !== null && checkInCount > 0 && (
    <div className="event-checkin-count">
      ✅ {checkInCount} {checkInCount === 1 ? 'pessoa confirmou' : 'pessoas confirmaram'} presença
    </div>
  )}
  ```
* Botão "Fazer Check-in" deve aparecer:
  * Se evento está `CONFIRMED` ou `PUBLISHED`
  * Se horário atual está entre `datetime_start - 30min` e `datetime_end + 1h`
  * Se usuário ainda não fez check-in

**Frontend (`SocialFeed2.tsx`):**
* Ao carregar eventos, buscar contagem de check-ins (se endpoint existir)
* Passar contagem para `CulturalEventCard`

#### Resultado Esperado
Sistema pronto para eventos de 10k–50k pessoas com check-in eficiente.

---

## 🚫 FORA DO ESCOPO DESTA ETAPA

* ❌ Venda de ingressos
* ❌ Financeiro completo
* ❌ Marketplaces de serviço
* ❌ Gamificação visual exagerada
* ❌ Notificações push
* ❌ App mobile

👉 Tudo isso vem depois.

---

## ✅ CRITÉRIO DE ACEITE

* ✅ Eventos dominam o feed sem quebrar social
* ✅ Compartilhamento não duplica eventos (mesmo `event_id`)
* ✅ Preferências e geo influenciam visibilidade (não censuram)
* ✅ Sistema pronto para piloto com evento real (10k+ pessoas)
* ✅ Check-in visível e acessível em eventos grandes

---

## 🧠 REGRA DE OURO

> **"Estamos transformando eventos no eixo central do produto, não adicionando uma feature."**

---

## 📌 ORDEM DE EXECUÇÃO RECOMENDADA

1. **Feed — Evento como primeiro cidadão** (prioridade visual)
2. **Redistribuição** (amplificação sem duplicação)
3. **Preferências + Geo** (peso, não censura)
4. **Preparar Check-in** (visibilidade e escala)

---

**Status:** ✅ Prompt fechado e pronto para execução
**Próximo:** Implementação linha por linha













