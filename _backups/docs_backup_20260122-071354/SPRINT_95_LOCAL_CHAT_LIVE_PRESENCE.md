# SPRINT 95 — LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

## OBJETIVO

Adicionar uma camada social "ao vivo" para EVENT/VENUE:
1. Chat do local/evento (mensagens)
2. Lista "online aqui agora" (apenas quem fez check-in + opt-in)
3. Anti-abuso mínimo (block, report, rate-limit, mute/kick manual)
4. Privacy by default (ninguém aparece/ninguém pode chamar no privado sem opt-in explícito)

---

## 1. MIGRATIONS

### `244_create_live_presence.sql`
Tabela `live_presence`:
- `id` (UUID)
- `tenant_id` (UUID, RLS)
- `context_type` (ENUM: EVENT, VENUE)
- `context_id` (UUID)
- `contact_id` (UUID, FK contacts)
- `status` (ENUM: ONLINE, OFFLINE)
- `opted_in` (BOOLEAN, default false)
- `last_seen_at` (TIMESTAMPTZ)
- `expires_at` (TIMESTAMPTZ) — TTL baseado em policy
- `metadata` (JSONB)
- `created_at`, `updated_at` (TIMESTAMP)
- Constraint UNIQUE (tenant_id, context_type, context_id, contact_id)
- Índices: (tenant_id, context_type, context_id, status), (expires_at), (tenant_id, context_type, context_id, opted_in) WHERE opted_in = true AND status = 'ONLINE'

### `245_create_chat_rooms.sql`
Tabela `chat_rooms`:
- `id` (UUID)
- `tenant_id` (UUID, RLS)
- `context_type` (ENUM: EVENT, VENUE)
- `context_id` (UUID)
- `room_type` (ENUM: PUBLIC) — manter simples. DM só na SPRINT 96
- `status` (ENUM: ACTIVE, ARCHIVED)
- `metadata` (JSONB)
- `created_at` (TIMESTAMP)
- Constraint UNIQUE (tenant_id, context_type, context_id, room_type)
- Índices: (tenant_id, context_type, context_id), (tenant_id, status)

### `246_create_chat_messages.sql`
Tabela `chat_messages` (append-only):
- `id` (UUID)
- `tenant_id` (UUID, RLS)
- `room_id` (UUID, FK chat_rooms)
- `contact_id` (UUID, FK contacts)
- `content` (TEXT)
- `status` (ENUM: VISIBLE, DELETED)
- `client_message_id` (TEXT, nullable) — idempotência do cliente
- `metadata` (JSONB)
- `created_at` (TIMESTAMP)
- **Idempotência**: UNIQUE (tenant_id, room_id, contact_id, client_message_id) WHERE client_message_id IS NOT NULL
- Índices: (tenant_id, room_id, created_at DESC), (tenant_id, room_id, status), (tenant_id, contact_id)

### `247_create_chat_blocks.sql`
Tabela `chat_blocks`:
- `id` (UUID)
- `tenant_id` (UUID, RLS)
- `blocker_contact_id` (UUID, FK contacts)
- `blocked_contact_id` (UUID, FK contacts)
- `context_type` (ENUM: EVENT, VENUE)
- `context_id` (UUID)
- `metadata` (JSONB)
- `created_at` (TIMESTAMP)
- Constraint UNIQUE (tenant_id, blocker_contact_id, blocked_contact_id, context_type, context_id)
- Índices: (tenant_id, blocker_contact_id), (tenant_id, blocked_contact_id), (tenant_id, context_type, context_id)

### `248_create_chat_reports.sql`
Tabela `chat_reports` (append-only):
- `id` (UUID)
- `tenant_id` (UUID, RLS)
- `reporter_contact_id` (UUID, FK contacts)
- `reported_contact_id` (UUID, FK contacts)
- `room_id` (UUID, FK chat_rooms)
- `message_id` (UUID, FK chat_messages, nullable)
- `reason_code` (ENUM: SPAM, HARASSMENT, HATE, SEXUAL, OTHER)
- `details` (TEXT, nullable)
- `status` (ENUM: OPEN, ACK, RESOLVED)
- `metadata` (JSONB)
- `created_at`, `updated_at` (TIMESTAMP)
- Índices: (tenant_id, status, created_at DESC), (tenant_id, room_id), (tenant_id, reported_contact_id)

---

## 2. BACKEND MODULE

### 2.1 Types
- `live-chat.types.ts`: LivePresence, ChatRoom, ChatMessage, ChatBlock, ChatReport, inputs

### 2.2 Repositories
- `live-presence.repository.ts`: CRUD de presença ao vivo
- `chat-room.repository.ts`: CRUD de salas de chat
- `chat-message.repository.ts`: CRUD de mensagens (append-only, idempotente)
- `chat-block.repository.ts`: CRUD de bloqueios
- `chat-report.repository.ts`: CRUD de denúncias

### 2.3 Services

#### `LivePresenceService`
- `optIn()` — Opt-in para presença ao vivo
  - Exige check-in recente (policy: `live_chat.checkin_recency_hours`, default 12h)
  - TTL baseado em policy (`live_chat.ttl_minutes`, default 20min)
  - Status: ONLINE, opted_in: true
- `optOut()` — Opt-out de presença ao vivo
- `heartbeat()` — Renova expires_at (somente se opted_in)
- `listOnline()` — Retorna APENAS opted_in=true AND status=ONLINE AND expires_at > now

#### `ChatService`
- `getOrCreateRoom()` — Busca ou cria sala PUBLIC
- `sendMessage()` — Envia mensagem
  - Rate limit (policy: `live_chat.msg_per_minute`, default 20)
  - Valida tamanho (policy: `live_chat.max_message_length`, default 280)
  - Idempotência via client_message_id
- `listMessages()` — Lista mensagens (filtra bloqueados)
- `deleteOwnMessage()` — Deleta própria mensagem (status=DELETED)
- `blockContact()` — Bloqueia contato
- `reportContact()` — Denuncia contato
- `archiveRoom()` — Arquiva sala (admin)

---

## 3. POLICY REGISTRY

Adicionadas chaves em `policy-registry.ts`:
- `live_chat.enabled` (default: true)
- `live_chat.ttl_minutes` (default: 20)
- `live_chat.checkin_recency_hours` (default: 12)
- `live_chat.msg_per_minute` (default: 20)
- `live_chat.max_message_length` (default: 280)

---

## 4. ROTAS REST

Todas as rotas estão prefixadas com `/live` ou `/live-chat` e registradas em `marketplace.routes.ts`.

### 4.1 Presence
- **POST** `/live/presence/opt-in` — Opt-in para presença ao vivo
- **POST** `/live/presence/opt-out` — Opt-out
- **POST** `/live/presence/heartbeat` — Heartbeat
- **GET** `/live/presence/:contextType/:contextId/online` — Lista online (apenas opt-in)

### 4.2 Chat
- **GET** `/live-chat/:contextType/:contextId/room` — Busca ou cria sala
- **GET** `/live-chat/rooms/:roomId/messages?viewerContactId=...&cursor=...` — Lista mensagens
- **POST** `/live-chat/rooms/:roomId/messages` — Envia mensagem
- **POST** `/live-chat/messages/:id/delete` — Deleta própria mensagem

### 4.3 Safety
- **POST** `/live-chat/block` — Bloqueia contato
- **POST** `/live-chat/report` — Denuncia contato

### 4.4 Admin
- **POST** `/live-chat/rooms/:id/archive` — Arquiva sala

---

## 5. FRONTEND

### 5.1 API Client
- `api/liveChat.ts` — Funções para comunicação com backend

### 5.2 Páginas (mínimo)
- Integração futura em Event/Venue pages:
  - Toggle "Ficar online no chat deste local/evento" (opt-in)
  - Lista "Online agora" (somente opt-in)
  - Chat feed (polling a cada 3s ou long-poll simples)
  - Ações: bloquear, denunciar
  - Contador de mensagens e limite (280)

---

## 6. GUARDRAILS

✅ **Nada de geolocalização**
- Presença ao vivo não usa GPS
- Não detecta presença por "estar perto"

✅ **Nada de detectar presença por "estar perto"**
- Presença ao vivo requer check-in + opt-in
- TTL baseado em check-in recente + flag opt-in

✅ **Nada de ranking/score**
- Lista online não é ordenada por score
- Sem sistema de reputação

✅ **Nada de penalty service**
- Sem punição automática
- Sem bloqueio automático

✅ **Nada de DM automático sem consentimento**
- Chat público apenas (DM na SPRINT 96)
- Ninguém pode chamar no privado sem opt-in explícito

✅ **Privacy by default**
- Ninguém aparece sem opt-in
- Lista online mostra apenas opt-in

---

## 7. PRIVACY MODEL

### 7.1 Opt-in Explícito
- Usuário deve optar por aparecer online
- Default: opted_in = false
- Lista online mostra apenas opted_in = true

### 7.2 Check-in Recente
- Para opt-in, exige check-in nas últimas X horas (policy)
- Valida recency antes de permitir opt-in

### 7.3 TTL
- Presença expira após TTL (default 20min)
- Heartbeat renova expires_at
- Se expires_at < now, não aparece na lista online

---

## 8. ANTI-ABUSO

### 8.1 Rate Limit
- Limite de mensagens por minuto (policy: `live_chat.msg_per_minute`, default 20)
- Contagem em janela de 1 minuto

### 8.2 Tamanho da Mensagem
- Limite de caracteres (policy: `live_chat.max_message_length`, default 280)
- Validação antes de enviar

### 8.3 Block
- Bloqueio oculta mensagens do bloqueado no feed do blocker
- Filtro aplicado em `listMessages()`

### 8.4 Report
- Denúncia cria registro auditável
- Status: OPEN → ACK → RESOLVED
- Sem ação automática (apenas registro)

### 8.5 Sem NLP/IA
- Sem moderação automática
- Sem análise de conteúdo
- Apenas rate-limit, block e report

---

## 9. POR QUE NÃO USA GEO

✅ **Presença ao vivo não é presença física**
- É presença no chat, condicionada ao check-in recente
- TTL baseado em check-in + opt-in
- Não usa GPS/geolocalização

✅ **Check-in é prova local**
- Check-in requer token QR ou ação manual
- Valida presença física no local
- Recency valida que check-in foi recente

✅ **Privacy by default**
- Ninguém aparece sem opt-in
- Usuário controla visibilidade

---

## 10. TTL + CHECK-IN RECENCY

### 10.1 TTL
- Default: 20 minutos (policy: `live_chat.ttl_minutes`)
- Heartbeat renova expires_at
- Se expires_at < now, status = OFFLINE

### 10.2 Check-in Recency
- Default: 12 horas (policy: `live_chat.checkin_recency_hours`)
- Para opt-in, exige check-in nas últimas X horas
- Valida recency antes de permitir opt-in

---

## 11. RATE-LIMIT + BLOCK/REPORT

### 11.1 Rate Limit
- Limite de mensagens por minuto (policy: `live_chat.msg_per_minute`, default 20)
- Contagem em janela de 1 minuto
- Erro se exceder limite

### 11.2 Block
- Bloqueio oculta mensagens do bloqueado
- Filtro aplicado em `listMessages()`
- Bloqueio é por contexto (EVENT/VENUE)

### 11.3 Report
- Denúncia cria registro auditável
- Status: OPEN → ACK → RESOLVED
- Sem ação automática (apenas registro)

---

## 12. ARQUIVOS CRIADOS/MODIFICADOS

### Backend
- `backend/migrations/244_create_live_presence.sql`
- `backend/migrations/245_create_chat_rooms.sql`
- `backend/migrations/246_create_chat_messages.sql`
- `backend/migrations/247_create_chat_blocks.sql`
- `backend/migrations/248_create_chat_reports.sql`
- `backend/src/modules/live-chat/live-chat.types.ts`
- `backend/src/modules/live-chat/live-presence.repository.ts`
- `backend/src/modules/live-chat/chat-room.repository.ts`
- `backend/src/modules/live-chat/chat-message.repository.ts`
- `backend/src/modules/live-chat/chat-block.repository.ts`
- `backend/src/modules/live-chat/chat-report.repository.ts`
- `backend/src/modules/live-chat/live-presence.service.ts`
- `backend/src/modules/live-chat/chat.service.ts`
- `backend/src/modules/live-chat/live-chat.routes.ts`
- `backend/src/modules/marketplace/marketplace.routes.ts` (registro das rotas)
- `backend/src/core/policy/policy-registry.ts` (políticas)
- `backend/src/core/policy/policy.types.ts` (domínio 'live_chat')

### Frontend
- `frontend/src/api/liveChat.ts`

### Documentação
- `SPRINT_95_LOCAL_CHAT_LIVE_PRESENCE.md` (este arquivo)

---

## 13. CRITÉRIOS DE PRONTO

- ✅ Usuário com check-in consegue opt-in e aparecer "online"
- ✅ Usuário sem check-in NÃO consegue opt-in
- ✅ Chat funciona (send + list) com rate-limit
- ✅ Block oculta mensagens do bloqueado no feed do blocker
- ✅ Report cria registro auditável
- ✅ Nada automático punitivo
- ✅ Privacy by default
- ✅ TTL + check-in recency funcionam
- ✅ Rate-limit funciona

---

**Status:** ✅ CONCLUÍDO



