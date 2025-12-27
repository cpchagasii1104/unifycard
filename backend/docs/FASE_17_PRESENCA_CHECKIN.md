# 🔥 FASE 17 — PRESENÇA / CHECK-IN
**PROMPT DEFINITIVO PARA IMPLEMENTAÇÃO**

## 🎯 Objetivo

Implementar **presença física verificável** em eventos culturais, gerando:
* ✅ Impacto por participação real
* ✅ Rastro auditável (quem esteve onde, quando)
* ✅ Validação de evento completado
* ✅ Base para repasse financeiro futuro

**Regra de ouro:**
> Presença física é a prova de que cultura aconteceu de verdade.

---

## 🧠 Conceitos Fundamentais (Fechados)

### 1️⃣ Check-in vs Participação

**Check-in:**
* Ação física no momento do evento
* Valida presença real
* Gera impacto imediato (+1)
* Requer QR code ou validação manual

**Participação:**
* Interesse prévio (curtir, compartilhar, confirmar presença)
* Não gera impacto de presença
* Mas gera impacto de engajamento (+1 para curtir, +2 para compartilhar)

**Regra:**
> Check-in só pode acontecer durante o evento (datetime_start ≤ agora ≤ datetime_end)

---

### 2️⃣ Quem Pode Fazer Check-in

**Participante (PF ou PJ):**
* Qualquer usuário autenticado
* Não precisa ter comprado ingresso (evento pode ser gratuito)
* Não precisa ter confirmado presença antes

**Staff/Local:**
* PAC local (BAR/VENUE) pode validar presença de terceiros
* Requer permissão específica (ser `location_cultural_profile_id` do evento)

**Criador:**
* PAC criador pode validar presença de terceiros
* Requer ser `created_by_cultural_profile_id` do evento

---

### 3️⃣ QR Code de Check-in

**Geração:**
* Cada evento gera QR code único (não por participante)
* QR contém: `event_id`, `tenant_id`, `expires_at` (datetime_end + 1h)
* QR é público (qualquer um pode escanear e fazer check-in)

**Validação:**
* QR expira após `datetime_end + 1h`
* QR não pode ser usado antes de `datetime_start - 30min`
* QR pode ser usado múltiplas vezes (cada usuário faz seu próprio check-in)

**Segurança:**
* QR assinado com JWT curto (15min de validade)
* Backend valida assinatura + expiração + horário do evento

---

## 🧱 Modelo de Dados

### Tabela: `cultural_event_checkins`

```sql
CREATE TABLE IF NOT EXISTS cultural_event_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES cultural_events(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL, -- global_user_id ou cultural_profile_id
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('user', 'page', 'cultural_profile')),
    checked_in_by_actor_id UUID, -- Quem validou (se foi validação manual)
    checked_in_by_actor_type VARCHAR(20), -- Tipo de quem validou
    check_in_method VARCHAR(20) NOT NULL CHECK (check_in_method IN ('QR_CODE', 'MANUAL', 'AUTO')),
    geo_lat DECIMAL(10, 8), -- Latitude (opcional, se disponível)
    geo_lng DECIMAL(11, 8), -- Longitude (opcional, se disponível)
    device_fingerprint VARCHAR(255), -- Hash do dispositivo (anti-fraude)
    metadata JSONB, -- Dados extras (ex: foto, observações)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Um ator só pode fazer check-in uma vez por evento
    CONSTRAINT cultural_event_checkins_unique UNIQUE (tenant_id, event_id, actor_id, actor_type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cultural_event_checkins_event 
    ON cultural_event_checkins(tenant_id, event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cultural_event_checkins_actor 
    ON cultural_event_checkins(tenant_id, actor_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_cultural_event_checkins_validator 
    ON cultural_event_checkins(tenant_id, checked_in_by_actor_id) 
    WHERE checked_in_by_actor_id IS NOT NULL;
```

**Campos importantes:**
* `actor_id` + `actor_type`: Quem fez check-in (pode ser PF, PJ ou PAC)
* `checked_in_by_actor_id`: Quem validou (se foi validação manual por staff/local)
* `check_in_method`: Como foi feito (QR, manual, auto)
* `geo_lat/lng`: Localização (opcional, mas recomendado para auditoria)

---

## 🔌 Endpoints (Backend)

### 1. Gerar QR Code de Check-in

```http
GET /cultural/events/:eventId/check-in/qr
```

**Resposta:**
```json
{
  "qr_code": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2025-12-23T20:00:00Z",
  "event": {
    "id": "...",
    "title": "Show de Rock",
    "datetime_start": "2025-12-23T19:00:00Z",
    "datetime_end": "2025-12-23T22:00:00Z"
  }
}
```

**Regras:**
* Só gera se evento está `PUBLISHED` ou `CONFIRMED`
* QR expira em `datetime_end + 1h`
* QR não funciona antes de `datetime_start - 30min`

---

### 2. Fazer Check-in (via QR ou Manual)

```http
POST /cultural/events/:eventId/check-in
```

**Body (QR Code):**
```json
{
  "method": "QR_CODE",
  "qr_code": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "geo": {
    "lat": -23.5505,
    "lng": -46.6333
  }
}
```

**Body (Manual - Staff/Local):**
```json
{
  "method": "MANUAL",
  "target_actor_id": "uuid-do-participante",
  "target_actor_type": "user",
  "geo": {
    "lat": -23.5505,
    "lng": -46.6333
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "check_in": {
    "id": "uuid",
    "event_id": "uuid",
    "actor_id": "uuid",
    "actor_type": "user",
    "check_in_time": "2025-12-23T19:15:00Z",
    "method": "QR_CODE"
  },
  "impact_generated": 1
}
```

**Regras:**
* Valida horário do evento (deve estar entre `datetime_start` e `datetime_end`)
* Valida QR code (se método QR_CODE)
* Valida permissões (se método MANUAL - só staff/local/criador)
* Gera impacto (+1) via `impactService.recordImpact()`
* Registra em `cultural_event_checkins`
* Emite evento `cultural-event-checkin` para auditoria

---

### 3. Listar Check-ins de um Evento

```http
GET /cultural/events/:eventId/check-ins?limit=50&cursor=...
```

**Resposta:**
```json
{
  "check_ins": [
    {
      "id": "uuid",
      "actor_id": "uuid",
      "actor_type": "user",
      "actor_display_name": "João Silva",
      "check_in_time": "2025-12-23T19:15:00Z",
      "method": "QR_CODE",
      "checked_in_by": null
    }
  ],
  "total": 42,
  "next_cursor": "..."
}
```

**Permissões:**
* Criador do evento: vê todos
* Local do evento: vê todos
* Outros: vê apenas próprios check-ins

---

### 4. Verificar Status de Check-in

```http
GET /cultural/events/:eventId/check-in/status
```

**Resposta:**
```json
{
  "has_checked_in": true,
  "check_in_time": "2025-12-23T19:15:00Z",
  "method": "QR_CODE",
  "can_check_in": false, // false se já fez check-in ou evento não está no horário
  "event_status": "CONFIRMED",
  "event_datetime": {
    "start": "2025-12-23T19:00:00Z",
    "end": "2025-12-23T22:00:00Z"
  }
}
```

---

## 🔗 Integrações

### 1. Impacto (Fase 10)

**Ao fazer check-in:**
```typescript
await impactService.recordImpact({
  actor: { actor_id, actor_type },
  eventType: 'EVENT_CHECKIN',
  delta: 1,
  sourceType: 'cultural_event',
  sourceId: eventId,
  metadata: {
    event_title: event.title,
    event_type: event.event_type,
    check_in_method: 'QR_CODE' | 'MANUAL',
  }
});
```

**Impacto para criador do evento:**
* Não gera impacto direto no check-in
* Gera impacto quando evento é marcado como `COMPLETED` (+5)

---

### 2. Auditoria (Fase 13)

**Heurísticas:**
* **Check-in fora do horário:** Alerta LOW (pode ser erro de relógio)
* **Múltiplos check-ins do mesmo dispositivo:** Alerta MEDIUM (possível fraude)
* **Check-in sem geo:** Alerta LOW (menos confiável)
* **Check-in em evento cancelado:** Alerta HIGH (bug ou fraude)

**Registro:**
```typescript
await auditService.record({
  event_type: 'CULTURAL_EVENT_CHECKIN',
  severity: 'LOW' | 'MEDIUM' | 'HIGH',
  actor_id: checkIn.actor_id,
  actor_type: checkIn.actor_type,
  company_id: null,
  source: 'cultural_event_checkin',
  context: {
    event_id: eventId,
    check_in_method: checkIn.check_in_method,
    geo_available: !!checkIn.geo_lat,
    device_fingerprint: checkIn.device_fingerprint,
  }
});
```

---

### 3. Validação de Evento Completado

**Regra:**
> Evento só pode ser marcado como `COMPLETED` se:
> * Data/hora atual ≥ `datetime_end`
> * Pelo menos 1 check-in foi registrado (ou evento permite completar sem check-in)

**Fluxo:**
1. Criador tenta marcar como `COMPLETED`
2. Sistema valida horário
3. Sistema verifica se há check-ins (opcional, mas recomendado)
4. Sistema gera impacto final (+5 para criador)
5. Sistema aplica split de receita (se houver financeiro)
6. Status muda para `COMPLETED`

---

## 🖥️ Frontend (UI Mínima)

### 1. Botão de Check-in no Card de Evento

**No `CulturalEventCard.tsx`:**
* Mostrar botão "Fazer Check-in" se:
  * Evento está `CONFIRMED` ou `PUBLISHED`
  * Horário atual está entre `datetime_start - 30min` e `datetime_end + 1h`
  * Usuário ainda não fez check-in

**Estados:**
* "Fazer Check-in" (não fez ainda)
* "✓ Check-in realizado" (já fez)
* "Check-in indisponível" (fora do horário ou evento cancelado)

---

### 2. Modal de Check-in

**Opções:**
* **QR Code:** Mostrar QR code do evento (se criador/local)
* **Escanear QR:** Abrir câmera para escanear QR do evento
* **Check-in Manual:** (só para staff/local) - buscar participante

**Fluxo:**
1. Usuário clica "Fazer Check-in"
2. Sistema verifica se pode fazer check-in
3. Se QR: mostra QR para escanear ou abre câmera
4. Se manual: busca participante e valida
5. Envia requisição para backend
6. Mostra feedback de sucesso
7. Atualiza card do evento

---

### 3. Lista de Check-ins (Página de Detalhes)

**Mostrar:**
* Total de check-ins
* Lista de participantes (com avatar, nome, horário)
* Filtros: por método, por horário
* Exportar (CSV) - só para criador/local

---

## 🧪 Testes Obrigatórios

### 1. Check-in via QR Code
* ✅ Gerar QR code
* ✅ Escanear QR code e fazer check-in
* ✅ Validar que não pode fazer check-in antes do horário
* ✅ Validar que não pode fazer check-in depois do horário + 1h
* ✅ Validar que não pode fazer check-in duas vezes

### 2. Check-in Manual
* ✅ Staff/Local pode validar presença de terceiros
* ✅ Criador pode validar presença de terceiros
* ✅ Outros não podem validar presença de terceiros

### 3. Impacto
* ✅ Check-in gera +1 impacto para participante
* ✅ Check-in não gera impacto duplicado
* ✅ Impacto é registrado no ledger

### 4. Auditoria
* ✅ Check-ins são registrados em `audit_events`
* ✅ Heurísticas detectam padrões suspeitos
* ✅ Geo é registrado quando disponível

### 5. Validação de Evento Completado
* ✅ Evento só pode ser completado após `datetime_end`
* ✅ Sistema valida presença mínima (opcional)
* ✅ Completação gera impacto final (+5)

---

## 🚫 Fora do Escopo (Fase 17)

* ❌ Venda de ingressos (Fase 18)
* ❌ Repasse financeiro (Fase 18)
* ❌ Notificações push (futuro)
* ❌ Gamificação de check-in (futuro)
* ❌ Check-in automático por geofence (futuro)

---

## ✅ Critério de Aceite

* ✅ QR code é gerado corretamente
* ✅ Check-in funciona via QR e manual
* ✅ Impacto é gerado e registrado
* ✅ Auditoria observa padrões
* ✅ UI permite fazer check-in facilmente
* ✅ Evento só completa com validação de presença

---

## 📌 Próximo Passo

Após implementar Fase 17:
* **Fase 18:** Financeiro Cultural (venda de ingressos, repasse)
* **Fase 19:** Transparência Cultural (dashboard público de splits)

---

**Status:** ✅ Contrato fechado e pronto para implementação
**Ordem:** Backend → Frontend → Testes → Validação













