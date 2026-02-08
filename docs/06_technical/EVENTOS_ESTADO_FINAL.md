# EVENTOS_ESTADO_FINAL.md
## Estado Final do Módulo de Eventos — UnifiCard

**Data:** 29/12/2025  
**Status:** 🟡 Quase Fechado (1 blocker)  
**Próximo:** Freeze após correção

---

## 📋 RESUMO

O módulo de Eventos está **funcionalmente completo**. Falta apenas remover uma referência a coluna inexistente para entrar em freeze.

---

## ✅ O QUE EXISTE E FUNCIONA

### 1. Estrutura de Dados (Tabela events)

**Campos canônicos (Migration 090):**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | UUID | ✅ | Identificador único |
| tenant_id | UUID | ✅ | Multi-tenant |
| title | TEXT | ✅ | Título do evento |
| description | TEXT | ❌ | Descrição |
| event_type | VARCHAR | ✅ | Taxonomia: cultural, gastronomic, social, professional, community, spiritual, sports, private |
| event_subtype | VARCHAR | ❌ | Subtipo dinâmico |
| status | VARCHAR | ✅ | draft, published, cancelled, completed, archived |
| visibility | VARCHAR | ✅ | public, group, followers, private, unlisted |
| datetime_start | TIMESTAMPTZ | ✅ | Data/hora início |
| datetime_end | TIMESTAMPTZ | ✅ | Data/hora fim |
| ticket_price_cents | INTEGER | ❌ | Preço em centavos |
| max_attendees | INTEGER | ❌ | Limite de público |
| actor_id | UUID | ✅ | Quem criou (actor) |
| actor_type | VARCHAR | ✅ | user ou page |
| split_processed | BOOLEAN | ❌ | Se split foi processado |
| split_processed_at | TIMESTAMPTZ | ❌ | Quando split foi processado |

### 2. Motor Único
- ✅ Feed social e /eventos usam **mesma fonte**
- ✅ Wizard único de criação
- ✅ Step 2 por **intenção** (não taxonomia técnica)
- ✅ Backend defensivo (não quebra sem migrations)

### 3. Economia
- ✅ Escrow implementado (Migration 092)
- ✅ Job de split pós-evento (post-event-split.job.ts)
- ✅ Campo split_processed (Migration 095)

### 4. Participantes
- ✅ event_participants (Migration 094)
- ✅ attendance_status: PRESENT, LEFT_EARLY, NO_SHOW
- ✅ Penalidades automáticas

---

## ❌ O QUE NÃO EXISTE

| Campo/Feature | Status | Observação |
|---------------|--------|------------|
| metadata (JSONB) | ❌ NÃO EXISTE | Era referenciado incorretamente |
| e.metadata na query | ❌ RESÍDUO | Deve ser removido |

---

## 🔴 BLOCKER ATUAL

### Erro: "coluna e.metadata não existe"

**Causa raiz:** Query no FeedService.ts referencia `e.metadata`, mas essa coluna nunca foi criada.

**Arquivos afetados:**
1. `backend/src/services/feed/FeedService.ts` (linha 175)
2. `backend/src/services/feed/event-feed-adapter.ts` (linhas 71 e 109)

**Solução:** Ver documento `CURSOR_PROMPT_FASE0_METADATA.md`

---

## 📊 MIGRATIONS DE EVENTOS

| # | Nome | Função |
|---|------|--------|
| 026 | events_core | Estrutura base |
| 027 | event_organizers | Organizadores |
| 068 | events_lifecycle_extension | event_type, status, schedule_id |
| 084 | cultural_events | Eventos culturais (legado) |
| 085 | cultural_event_checkins | Check-ins (legado) |
| 086 | event_occupancy_model | Modelo de ocupação |
| 087 | events_multi_actor | actor_id, actor_type |
| 090 | events_canonical_contract_v1 | **CONTRATO CANÔNICO** |
| 091 | event_attendees_canonical_contract_v1 | Participantes |
| 092 | event_escrow | Escrow |
| 094 | event_participants | Participantes |
| 095 | events_split_processed | Campo split_processed |

---

## 🏗️ ARQUITETURA FINAL

```
┌─────────────────────────────────────────────────────────────┐
│                       EVENTOS                               │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Wizard    │───▶│   events    │◀───│   Feed      │     │
│  │  (Frontend) │    │   (Table)   │    │  Service    │     │
│  └─────────────┘    └──────┬──────┘    └─────────────┘     │
│                            │                                │
│                            ▼                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Escrow    │◀───│  Checkout   │───▶│   Split     │     │
│  │  Service    │    │   Service   │    │   Engine    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                            │                                │
│                            ▼                                │
│                    ┌─────────────┐                          │
│                    │  PostEvent  │                          │
│                    │  Split Job  │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 GOVERNANÇA

### Taxonomia Oficial (event_type)
- cultural
- gastronomic
- social
- professional
- community
- spiritual
- sports
- private

### Status Oficiais
- draft (rascunho)
- published (publicado)
- cancelled (cancelado)
- completed (aconteceu)
- archived (arquivado)

### Visibility Oficiais
- public (público)
- group (grupo)
- followers (seguidores)
- private (privado)
- unlisted (não listado)

---

## ✅ CHECKLIST DE FREEZE

Antes de congelar o módulo:

- [ ] Remover `e.metadata` do FeedService.ts
- [ ] Remover `metadata: any` do event-feed-adapter.ts
- [ ] Testar /eventos sem erro
- [ ] Testar criação de evento
- [ ] Testar feed com eventos
- [ ] Verificar escrow em evento pago

**Após freeze:**
- Apenas manutenção e bug fixes
- Nenhuma feature nova sem aprovação

---

## 🔒 CONTRATO DE NÃO MODIFICAÇÃO

Após o freeze, os seguintes arquivos são **READ-ONLY**:

```
backend/
├── migrations/
│   ├── 090_events_canonical_contract_v1.sql
│   ├── 091_event_attendees_canonical_contract_v1.sql
│   ├── 092_event_escrow.sql
│   ├── 094_event_participants.sql
│   └── 095_events_split_processed.sql
│
├── src/
│   ├── core/events/
│   ├── services/feed/event-feed-adapter.ts
│   └── jobs/post-event-split.job.ts
```

---

*Documento gerado em 29/12/2025*
*Fase: 0 - Fechamento de Eventos*
*Próxima fase: 1 - Auditoria Split Engine (concluída)*
