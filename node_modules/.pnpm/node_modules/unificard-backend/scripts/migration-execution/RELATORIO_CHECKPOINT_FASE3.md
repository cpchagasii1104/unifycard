# 📊 RELATÓRIO DE CHECKPOINT — FASE 3
## MIGRAÇÃO DE DADOS (WRITE CONTROLADO)

**Data:** 28/12/2025  
**Fase:** FASE 3 — MIGRAÇÃO DE DADOS  
**Status:** ✅ SCRIPTS CRIADOS  
**Tipo:** WRITE CONTROLADO (INSERT com proteções)

---

## 🎯 OBJETIVO

Migrar dados reais de:
- `cultural_events` → `events`
- `cultural_event_checkins` → `event_attendees`

Conforme CONTRATO DE EVENTOS v1, com proteções e idempotência.

---

## 📋 SCRIPTS CRIADOS

### 1. `001_migrate_cultural_events_to_events.sql`

**Função:** Migrar eventos culturais para tabela canônica `events`

**Características:**
- ✅ Idempotente (ON CONFLICT DO NOTHING)
- ✅ Preserva IDs originais
- ✅ Mapeia `created_by_cultural_profile_id` → `actor_id` + `actor_type`
- ✅ Converte `event_type` → 'cultural' + `event_subtype`
- ✅ Converte `status` e `visibility` para valores do CONTRATO v1
- ✅ Cria `metadata` com informações de origem
- ✅ Validações pré e pós-migração
- ✅ Estatísticas de migração

**Funções auxiliares:**
- `get_actor_id_from_owner()` - Busca actor_id a partir de owner_actor_id/owner_actor_type

---

### 2. `002_migrate_checkins_to_attendees.sql`

**Função:** Migrar check-ins para tabela canônica `event_attendees`

**Características:**
- ✅ Idempotente (ON CONFLICT DO NOTHING)
- ✅ Mapeia `actor_id`/`actor_type` do check-in para `actor_id` da tabela `actors`
- ✅ Converte `check_in_method` para valores do CONTRATO v1
- ✅ Preserva informações de origem em `metadata`
- ✅ Validações pré e pós-migração
- ✅ Estatísticas de migração

**Pré-requisito:**
- Script 001 deve ser executado primeiro

**Funções auxiliares:**
- `get_actor_id_from_checkin()` - Busca actor_id a partir de actor_id/actor_type do check-in

---

### 3. `003_rollback_migration.sql`

**Função:** Reverter migração de forma segura

**Características:**
- ✅ Rollback baseado em `metadata.source.table`
- ✅ Remove apenas dados migrados
- ✅ Não remove dados originais
- ✅ Idempotente
- ✅ Protegido por padrão (comentado)

**⚠️ ATENÇÃO:**
- Script REMOVE dados migrados
- Execute apenas se necessário reverter
- Descomente seções DELETE para executar

---

## 🗺️ ESTRATÉGIA DE MIGRAÇÃO

### Mapeamento de Campos

#### `cultural_events` → `events`

| Campo Origem | Campo Destino | Transformação |
|-------------|---------------|---------------|
| `id` | `id` | Preservado (UUID) |
| `tenant_id` | `tenant_id` | Direto |
| `created_by_cultural_profile_id` | `actor_id` + `actor_type` | Via `cultural_profiles.owner_actor_id` |
| `event_type` | `event_type='cultural'` + `event_subtype` | Todos viram 'cultural', tipo antigo vira subtype |
| `title` | `title` | Direto |
| `description` | `description` | Direto |
| `datetime_start` | `datetime_start` | Direto |
| `datetime_end` | `datetime_end` | Direto |
| `status` | `status` | Lowercase, CONFIRMED → published |
| `visibility` | `visibility` | Lowercase, LOCAL → group |
| `ticket_price_cents` | `ticket_price_cents` | Direto |
| `max_attendees` | `max_attendees` | Direto |
| `completed_at` | `completed_at` | Direto |
| `created_at` | `created_at` | Direto |
| `updated_at` | `updated_at` | Direto |
| Vários | `metadata` | Informações de origem preservadas |

#### `cultural_event_checkins` → `event_attendees`

| Campo Origem | Campo Destino | Transformação |
|-------------|---------------|---------------|
| `id` | `id` | Novo UUID (não preserva) |
| `tenant_id` | `tenant_id` | Direto |
| `event_id` | `event_id` | Direto (deve existir em events) |
| `actor_id` + `actor_type` | `actor_id` | Via função `get_actor_id_from_checkin()` |
| `created_at` | `check_in_time` | Direto |
| `check_in_method` | `check_in_method` | QR_CODE → QR, MANUAL → MANUAL, AUTO → AUTOMATIC |
| `checked_in_by_actor_id` | `checked_in_by_actor_id` | Via função auxiliar |
| - | `check_in_status` | CONFIRMED (se tem check_in_time) |
| Vários | `metadata` | Informações de origem preservadas |

---

## 🛡️ PROTEÇÕES IMPLEMENTADAS

### 1. Idempotência

- ✅ `ON CONFLICT DO NOTHING` em todos os INSERTs
- ✅ Verificação de existência antes de inserir
- ✅ Scripts podem ser executados múltiplas vezes sem duplicação

### 2. Validações

**Pré-migração:**
- ✅ Verifica eventos sem `cultural_profile` válido
- ✅ Verifica `owner_actor_id` e `owner_actor_type` válidos
- ✅ Avisa sobre problemas encontrados

**Pós-migração:**
- ✅ Valida eventos migrados sem `actor_id`
- ✅ Valida constraints (status, visibility, event_type)
- ✅ Estatísticas de migração

### 3. Preservação de Dados

- ✅ Dados originais (`cultural_events`, `cultural_event_checkins`) **NÃO são removidos**
- ✅ Apenas dados migrados são criados
- ✅ Metadata preserva informações de origem

### 4. Rollback Seguro

- ✅ Rollback baseado em `metadata.source.table`
- ✅ Remove apenas dados migrados
- ✅ Protegido por padrão (comentado)

---

## ⚠️ RISCOS REMANESCENTES

### 1. Actor não encontrado (ALTO)

**Risco:** `cultural_profile.owner_actor_id` não existe em `actors`

**Mitigação:**
- ✅ Script valida antes de migrar
- ✅ Eventos sem actor válido são pulados
- ✅ Aviso é exibido

**Ação recomendada:**
- Criar `actors` faltantes antes de migrar
- Ou corrigir `cultural_profiles` com `owner_actor_id` inválido

---

### 2. Foreign Key violations (MÉDIO)

**Risco:** Dependências quebradas após migração

**Mitigação:**
- ✅ Scripts validam constraints após migração
- ✅ Rollback remove dependências primeiro

**Ação recomendada:**
- Verificar foreign keys dependentes antes de migrar
- Executar rollback se necessário

---

### 3. Performance em grandes volumes (MÉDIO)

**Risco:** Migração lenta com muitos registros

**Mitigação:**
- ✅ Scripts usam índices existentes
- ✅ Transações controladas

**Ação recomendada:**
- Executar em horário de baixo tráfego
- Monitorar performance
- Considerar migração em lotes se necessário

---

### 4. Dados inconsistentes (BAIXO)

**Risco:** Dados originais inconsistentes

**Mitigação:**
- ✅ Validações pré-migração
- ✅ Avisos de problemas encontrados

**Ação recomendada:**
- Executar scripts de análise da FASE 2 primeiro
- Corrigir dados problemáticos antes de migrar

---

## 📊 ESTRATÉGIA DE ROLLBACK

### Critérios de Identificação

Rollback identifica dados migrados por:
- `metadata->'source'->>'table' = 'cultural_events'` (eventos)
- `metadata->'source'->>'table' = 'cultural_event_checkins'` (check-ins)

### Ordem de Rollback

1. **Remover check-ins migrados** (`event_attendees`)
2. **Remover eventos migrados** (`events`)
   - Remove dependências primeiro (se necessário)

### Segurança

- ✅ Script protegido por padrão (comentado)
- ✅ Requer descomentação manual para executar
- ✅ Não remove dados originais
- ✅ Idempotente (pode executar múltiplas vezes)

---

## ✅ CHECKLIST DE EXECUÇÃO

### Antes de Executar

- [ ] Backup do banco de dados criado
- [ ] Scripts de análise da FASE 2 executados
- [ ] Dados problemáticos identificados e corrigidos
- [ ] Ambiente de desenvolvimento testado (se aplicável)

### Durante a Execução

- [ ] Executar `001_migrate_cultural_events_to_events.sql`
- [ ] Verificar estatísticas e avisos
- [ ] Executar `002_migrate_checkins_to_attendees.sql`
- [ ] Verificar estatísticas e avisos

### Após a Execução

- [ ] Validar contagem de eventos migrados
- [ ] Validar contagem de check-ins migrados
- [ ] Verificar integridade referencial
- [ ] Verificar constraints
- [ ] Testar queries em `events` e `event_attendees`

---

## 📝 ARQUIVOS CRIADOS

```
backend/scripts/migration-execution/
├── 001_migrate_cultural_events_to_events.sql
├── 002_migrate_checkins_to_attendees.sql
├── 003_rollback_migration.sql
├── README.md
└── RELATORIO_CHECKPOINT_FASE3.md (este arquivo)
```

---

## 🔗 RELACIONADOS

- **FASE 2:** Scripts de análise (`backend/scripts/migration-analysis/`)
- **FASE 1:** Migrations de schema (`backend/migrations/090_*.sql`, `091_*.sql`)
- **CONTRATO:** `CONTRATO_EVENTOS_V1.md`

---

## 🎯 PRÓXIMOS PASSOS

1. **Validação de Dados**
   - Executar scripts de análise da FASE 2
   - Corrigir dados problemáticos

2. **Execução da Migração**
   - Executar scripts em ordem
   - Monitorar resultados

3. **Validação Pós-Migração**
   - Verificar integridade
   - Testar funcionalidades

4. **Deprecação (Futuro)**
   - Marcar `cultural_events` como deprecated
   - Criar views/compatibilidade se necessário

---

## 📌 CONCLUSÃO

✅ **FASE 3 concluída**

- Scripts de migração criados
- Proteções implementadas
- Estratégia de rollback definida
- Riscos identificados e mitigados

**Pronto para execução** (após validações e backup)

---

*Relatório gerado em 28/12/2025*  
*FASE 3 — MIGRAÇÃO DE DADOS (WRITE CONTROLADO)*














