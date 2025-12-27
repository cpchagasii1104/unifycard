# 🔥 NOVA ETAPA — EVENTOS COMO START OFICIAL DO PRODUTO
**PROMPT DEFINITIVO PARA IMPLEMENTAÇÃO**

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
  * `CULTURAL_EVENT`: peso **150** (vs 100 de posts normais)
  * Posts relacionados a eventos (com `metadata.event_id`): peso **120**
* Ordenação final: `(content_weight * 0.8) + (base_relevance_score * 0.2)` (já existe)

**Frontend (`SocialFeed2.tsx`):**
* Ajustar ordenação visual do array `feedItems`:
  * Eventos culturais **sempre primeiro** (antes de posts)
  * Dentro de eventos, ordenar por `datetime_start` (mais próximo primeiro)
  * Dentro de posts, ordenar por `created_at` (mais recente primeiro)

**Frontend (`CulturalEventCard.tsx`):**
* Aumentar `font-size` do título do evento em **1.2x** vs título de post
* Adicionar `font-weight: 600` no título
* Manter borda roxa e sombra (já existe)

#### Resultado Esperado
Feed "parece" uma agenda viva, não um mural genérico.

---

### 2️⃣ REDISTRIBUIÇÃO (AMPLIFICAÇÃO, NÃO DUPLICAÇÃO)

#### Problema Atual
Compartilhamento de eventos pode criar confusão sobre qual é o "evento real".

#### Ação Obrigatória

**Backend (`social-2.0.service.ts`):**
* Ao criar post com `intent='event'` e `metadata.event_id`:
  * Validar que `event_id` existe em `cultural_events`
  * Não criar novo evento, apenas **vincular post ao evento existente**
* Ao buscar feed:
  * Se post tem `metadata.event_id`, incluir dados do evento no retorno:
    ```typescript
    {
      ...post,
      linked_event: {
        id: event.id,
        title: event.title,
        datetime_start: event.datetime_start,
        location: event.location_cultural_profile_id,
        shared_by: post.actor.display_name
      }
    }
    ```

**Frontend (`SocialFeed2.tsx`):**
* Ao renderizar post com `linked_event`:
  * Mostrar badge: "Compartilhado por [Nome] do evento [Título]"
  * Linkar para o evento original (não duplicar card)
  * Aumentar peso visual do post (mas não mais que evento direto)

**Frontend (`PostComposer.tsx` / `IntentComposer.tsx`):**
* Se usuário está visualizando evento, adicionar opção:
  * "Compartilhar este evento" → cria post com `intent='event'` e `metadata.event_id`

#### Resultado Esperado
1 evento → N contextos → 1 verdade (mesmo `event_id`).

---

### 3️⃣ PREFERÊNCIAS + GEO NO FEED

#### Problema Atual
Feed não considera preferências do usuário nem geolocalização.

#### Ação Obrigatória

**Backend (`social-2.0.service.ts`):**
* Adicionar parâmetros opcionais ao `getFeed`:
  * `user_preferences?: { music_genres?: string[], event_types?: string[] }`
  * `user_location?: { lat: number, lng: number }`
* Ajustar `calculateContentWeight`:
  * Se evento tem `event_type` que match com `user_preferences.event_types`: **+20 peso**
  * Se evento tem localização e usuário tem `user_location`:
    * Calcular distância (Haversine)
    * Se < 5km: **+30 peso**
    * Se < 20km: **+15 peso**
    * Se < 50km: **+5 peso**
* **Regra de ouro:**
  > Preferência e localização **pesam**, não censuram.
  > Eventos sem match ainda aparecem, só com peso menor.

**Frontend (`SocialFeed2.tsx`):**
* Ao carregar feed, buscar preferências do usuário (se existir endpoint)
* Solicitar permissão de geolocalização (opcional, não bloqueia)
* Passar `user_preferences` e `user_location` para `getSocialFeed`

#### Resultado Esperado
Feed prioriza eventos relevantes, mas não esconde o resto.

---

### 4️⃣ PREPARAR CHECK-IN (FASE 17) PARA EVENTOS ÂNCORA

#### Problema Atual
Check-in está implementado, mas precisa estar **visível e acessível** em eventos grandes.

#### Ação Obrigatória

**Frontend (`CulturalEventCard.tsx`):**
* Botão "Fazer Check-in" deve aparecer:
  * Se evento está `CONFIRMED` ou `PUBLISHED`
  * Se horário atual está entre `datetime_start - 30min` e `datetime_end + 1h`
  * Se usuário ainda não fez check-in
* Adicionar contador: "X pessoas já fizeram check-in"
* Mostrar badge de status do evento de forma mais destacada

**Backend (`cultural-event.service.ts`):**
* Endpoint `GET /cultural/events/:eventId/check-ins` deve suportar:
  * `limit` alto (até 1000 para eventos grandes)
  * `cursor` pagination eficiente
  * Contagem total rápida (sem carregar todos)

**Frontend (`SocialFeed2.tsx`):**
* Ao carregar eventos, buscar contagem de check-ins (se endpoint existir)
* Mostrar contador no card: "42 pessoas confirmaram presença"

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













