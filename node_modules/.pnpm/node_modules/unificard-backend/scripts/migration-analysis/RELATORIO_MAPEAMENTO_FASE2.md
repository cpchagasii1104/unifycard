# 📊 RELATÓRIO DE MAPEAMENTO — FASE 2
## MIGRAÇÃO CONTROLADA (READ-ONLY)

**Data:** 28/12/2025  
**Fase:** FASE 2 — MIGRAÇÃO CONTROLADA  
**Status:** ✅ ANÁLISE CONCLUÍDA  
**Tipo:** READ-ONLY (sem alteração de dados)

---

## 🎯 OBJETIVO

Mapear a estrutura de `cultural_events` para `events` conforme CONTRATO DE EVENTOS v1, identificando:
- Campos mapeáveis diretamente
- Campos que viram metadata
- Campos descartados
- Riscos e validações necessárias

---

## 📋 ESTRUTURA ANALISADA

### Tabela Fonte: `cultural_events`

**Campos existentes:**
- `id` (UUID)
- `tenant_id` (UUID)
- `created_by_cultural_profile_id` (UUID) → **Mapeia para `actor_id` + `actor_type`**
- `co_creators_cultural_profile_ids` (UUID[]) → **Vira metadata**
- `event_type` (VARCHAR) → **Mapeia para `event_type='cultural'` + `event_subtype`**
- `title` (VARCHAR)
- `description` (TEXT)
- `datetime_start` (TIMESTAMPTZ)
- `datetime_end` (TIMESTAMPTZ)
- `location_cultural_profile_id` (UUID) → **Vira metadata**
- `status` (VARCHAR) → **Mapeia para lowercase, sem CONFIRMED**
- `visibility` (VARCHAR) → **Mapeia para valores do CONTRATO v1**
- `ticket_price_cents` (INTEGER)
- `max_attendees` (INTEGER)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `completed_at` (TIMESTAMPTZ)

### Tabelas Relacionadas

1. **`cultural_profiles`** (PAC)
   - `owner_actor_id` → **Mapeia para `actor_id`**
   - `owner_actor_type` → **Mapeia para `actor_type`**

2. **`event_participants`**
   - **Vira metadata** (não mapeia diretamente)

3. **`event_revenue_split`**
   - **NÃO migra** (será processado pelo Split Engine no futuro)

4. **`cultural_event_checkins`**
   - **Mapeia para `event_attendees`** (em fase futura)

---

## 🗺️ MAPEAMENTO PROPOSTO

### 1. Campos Mapeáveis Diretamente (1:1)

| `cultural_events` | `events` | Observações |
|-------------------|----------|-------------|
| `id` | `id` | Mantém UUID original |
| `tenant_id` | `tenant_id` | Direto |
| `title` | `title` | Direto |
| `description` | `description` | Direto |
| `datetime_start` | `datetime_start` | Direto |
| `datetime_end` | `datetime_end` | Direto |
| `ticket_price_cents` | `ticket_price_cents` | Direto |
| `max_attendees` | `max_attendees` | Direto |
| `created_at` | `created_at` | Direto |
| `updated_at` | `updated_at` | Direto |
| `completed_at` | `completed_at` | Direto |

**Total:** 11 campos mapeáveis diretamente

---

### 2. Campos com Transformação

| `cultural_events` | `events` | Transformação |
|-------------------|----------|---------------|
| `created_by_cultural_profile_id` | `actor_id` + `actor_type` | Via `cultural_profiles.owner_actor_id` e `owner_actor_type` |
| `event_type` (SHOW, OFICINA, etc) | `event_type='cultural'` + `event_subtype` | Todos viram `event_type='cultural'`, tipo antigo vira `event_subtype` |
| `status` (UPPERCASE) | `status` (lowercase) | Lowercase + remoção de CONFIRMED |
| `visibility` (PUBLIC, LOCAL, PRIVATE) | `visibility` (public, group, followers, private, unlisted) | Lowercase + LOCAL → group |

**Total:** 4 campos com transformação

---

### 3. Campos que Viram Metadata (JSONB)

| Campo | Destino | Razão |
|-------|---------|-------|
| `created_by_cultural_profile_id` | `metadata.source.created_by_cultural_profile_id` | Preservar referência original |
| `co_creators_cultural_profile_ids` | `metadata.source.co_creators_cultural_profile_ids` | Array de co-criadores |
| `location_cultural_profile_id` | `metadata.source.location_cultural_profile_id` | Local não é actor, é metadata |
| `original_event_type` | `metadata.source.original_event_type` | Preservar tipo original |
| `original_status` | `metadata.source.original_status` | Preservar status original |
| `original_visibility` | `metadata.source.original_visibility` | Preservar visibility original |

**Estrutura proposta:**
```json
{
  "source": {
    "table": "cultural_events",
    "id": "uuid",
    "created_by_cultural_profile_id": "uuid",
    "co_creators_cultural_profile_ids": ["uuid"],
    "location_cultural_profile_id": "uuid",
    "original_event_type": "SHOW",
    "original_status": "PUBLISHED",
    "original_visibility": "PUBLIC"
  }
}
```

---

### 4. Campos Descartados

| Campo | Razão |
|-------|-------|
| Nenhum | Todos os campos são preservados (direto ou metadata) |

**Observação:** Nenhum campo é descartado. Todos são preservados de alguma forma.

---

## ⚠️ RISCOS IDENTIFICADOS

### 1. Mapeamento de Actor

**Risco:** `created_by_cultural_profile_id` → `actor_id` + `actor_type`

**Problema potencial:**
- Se `cultural_profile.owner_actor_id` não existir na tabela `actors`
- Se `owner_actor_type` não for 'user' ou 'page'

**Mitigação:**
- Validar existência de `actor_id` antes de migrar
- Criar `actor` se não existir (em fase futura)
- Script de validação: `002_map_cultural_profile_to_actor.sql`

**Impacto:** 🔴 ALTO (sem actor, evento não pode ser criado)

---

### 2. Status CONFIRMED → published

**Risco:** Status `CONFIRMED` não existe no CONTRATO v1

**Problema potencial:**
- Perda de informação semântica (CONFIRMED ≠ PUBLISHED)
- Eventos em status CONFIRMED serão marcados como published

**Mitigação:**
- Preservar status original em `metadata.source.original_status`
- Documentar mudança no relatório

**Impacto:** 🟡 MÉDIO (perda semântica, mas preservado em metadata)

---

### 3. Visibility LOCAL → group

**Risco:** `LOCAL` não existe no CONTRATO v1

**Problema potencial:**
- `LOCAL` não tem equivalente exato
- Mapeamento para `group` é aproximação

**Mitigação:**
- Preservar visibility original em `metadata.source.original_visibility`
- Documentar mudança no relatório
- Considerar criar grupo específico se necessário

**Impacto:** 🟡 MÉDIO (aproximação, mas preservado em metadata)

---

### 4. Event Type → event_subtype

**Risco:** Tipos antigos (SHOW, OFICINA, etc) viram `event_subtype`

**Problema potencial:**
- `event_subtype` começa como `provisional` (conforme CONTRATO Seção 8)
- Pode precisar validação/curation

**Mitigação:**
- Mapear diretamente para `event_subtype`
- Validação futura pode tornar `official` por uso

**Impacto:** 🟢 BAIXO (funcional, mas pode precisar validação)

---

### 5. Tabelas Relacionadas

**Risco:** `event_participants`, `event_revenue_split`, `cultural_event_checkins`

**Problema potencial:**
- `event_participants` não mapeia diretamente (vira metadata)
- `event_revenue_split` não migra (será processado pelo Split Engine)
- `cultural_event_checkins` precisa migrar para `event_attendees`

**Mitigação:**
- `event_participants` → metadata (preservar informação)
- `event_revenue_split` → não migrar (será recalculado pelo Split Engine)
- `cultural_event_checkins` → migração futura para `event_attendees`

**Impacto:** 🟡 MÉDIO (requer migrações adicionais)

---

## 📊 ESTATÍSTICAS DE MAPEAMENTO

### Campos por Categoria

- **Mapeáveis diretamente:** 11 campos
- **Com transformação:** 4 campos
- **Viram metadata:** 6 campos
- **Descartados:** 0 campos

### Tabelas Relacionadas

- **`event_participants`:** Vira metadata
- **`event_revenue_split`:** Não migra (Split Engine futuro)
- **`cultural_event_checkins`:** Migra para `event_attendees` (fase futura)

---

## ✅ VALIDAÇÕES NECESSÁRIAS

### Antes da Migração

1. ✅ Validar existência de `actor_id` para todos os `cultural_profiles`
2. ✅ Validar `owner_actor_type` = 'user' ou 'page'
3. ✅ Identificar eventos com status CONFIRMED
4. ✅ Identificar eventos com visibility LOCAL
5. ✅ Validar integridade de `event_revenue_split` (soma = 100%)

### Durante a Migração

1. ✅ Preservar `id` original (UUID)
2. ✅ Criar `metadata` com informações de origem
3. ✅ Mapear `actor_id` + `actor_type` corretamente
4. ✅ Converter status/visibility para lowercase
5. ✅ Mapear `event_type` → 'cultural' + `event_subtype`

### Após a Migração

1. ✅ Validar integridade referencial
2. ✅ Validar constraints (status, visibility, event_type)
3. ✅ Validar índices
4. ✅ Validar metadata JSONB

---

## 🚫 O QUE NÃO SERÁ MIGRADO

### 1. `event_revenue_split`

**Razão:** Será processado pelo Split Engine no futuro

**Ação:** Não migrar. Split será recalculado conforme CONTRATO v1 Seção 5.

---

### 2. `event_participants` (diretamente)

**Razão:** Não há tabela equivalente em `events`

**Ação:** Preservar em `metadata.participants` (JSONB)

---

### 3. `cultural_event_checkins` (nesta fase)

**Razão:** Migração para `event_attendees` será feita em fase futura

**Ação:** Deixar para FASE 3+ (migração de dados)

---

## 📝 SCRIPTS CRIADOS

1. **`001_analyze_cultural_events.sql`**
   - Análise de estrutura e estatísticas

2. **`002_map_cultural_profile_to_actor.sql`**
   - Mapeamento PAC → Actor

3. **`003_map_event_types.sql`**
   - Mapeamento event_type antigo → novo

4. **`004_map_status_visibility.sql`**
   - Mapeamento status e visibility

5. **`005_map_related_tables.sql`**
   - Análise de tabelas relacionadas

6. **`006_dry_run_mapping.sql`**
   - DRY-RUN completo do mapeamento

---

## 🎯 PRÓXIMOS PASSOS (FASE 3+)

1. **Validação de Dados**
   - Executar scripts de análise
   - Identificar problemas de mapeamento
   - Corrigir dados inválidos

2. **Migração de Dados**
   - Criar script de migração real (INSERT)
   - Migrar `cultural_events` → `events`
   - Migrar `cultural_event_checkins` → `event_attendees`

3. **Validação Pós-Migração**
   - Validar integridade
   - Validar constraints
   - Validar índices

4. **Deprecação**
   - Marcar `cultural_events` como deprecated
   - Criar views/compatibilidade se necessário

---

## 📌 CONCLUSÃO

✅ **Análise concluída**

- Mapeamento proposto definido
- Riscos identificados e documentados
- Scripts de DRY-RUN criados
- Validações necessárias documentadas

**Pronto para FASE 3:** Migração de dados (após validações)

---

*Relatório gerado em 28/12/2025*  
*FASE 2 — MIGRAÇÃO CONTROLADA (READ-ONLY)*














