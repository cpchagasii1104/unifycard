# 🚀 Scripts de Execução de Migração — FASE 3

**Fase:** FASE 3 — MIGRAÇÃO DE DADOS (WRITE CONTROLADO)  
**Objetivo:** Migrar dados reais de `cultural_events` → `events` e `cultural_event_checkins` → `event_attendees`

---

## ⚠️ IMPORTANTE

**Antes de executar os scripts de migração:**

1. ✅ Execute os scripts de análise da FASE 2
2. ✅ Valide os dados problemáticos
3. ✅ Corrija dados inválidos (se necessário)
4. ✅ Faça backup do banco de dados
5. ✅ Teste em ambiente de desenvolvimento primeiro

---

## 📋 Scripts Disponíveis

### 1. `001_migrate_cultural_events_to_events.sql`

**Objetivo:** Migrar `cultural_events` → `events`

**O que faz:**
- Migra todos os eventos culturais para a tabela canônica `events`
- Preserva IDs originais
- Mapeia `created_by_cultural_profile_id` → `actor_id` + `actor_type`
- Converte `event_type` → 'cultural' + `event_subtype`
- Converte `status` e `visibility` para valores do CONTRATO v1
- Cria `metadata` com informações de origem
- Idempotente (pode executar múltiplas vezes)

**Uso:**
```bash
psql -d unificard -f backend/scripts/migration-execution/001_migrate_cultural_events_to_events.sql
```

**Ou dentro do psql:**
```sql
\i backend/scripts/migration-execution/001_migrate_cultural_events_to_events.sql
```

---

### 2. `002_migrate_checkins_to_attendees.sql`

**Objetivo:** Migrar `cultural_event_checkins` → `event_attendees`

**O que faz:**
- Migra check-ins para a tabela canônica `event_attendees`
- Mapeia `actor_id`/`actor_type` do check-in para `actor_id` da tabela `actors`
- Converte `check_in_method` para valores do CONTRATO v1
- Preserva informações de origem em `metadata`
- Idempotente (pode executar múltiplas vezes)

**Pré-requisito:**
- Script 001 deve ser executado primeiro (eventos devem estar migrados)

**Uso:**
```bash
psql -d unificard -f backend/scripts/migration-execution/002_migrate_checkins_to_attendees.sql
```

---

### 3. `003_rollback_migration.sql`

**Objetivo:** Reverter migração de forma segura

**O que faz:**
- Remove apenas dados migrados (baseado em `metadata.source.table`)
- Não remove dados originais (`cultural_events`, `cultural_event_checkins`)
- Idempotente (pode executar múltiplas vezes)

**⚠️ ATENÇÃO:**
- Este script REMOVE dados migrados!
- Execute apenas se necessário reverter a migração
- Script está protegido por padrão (comentado)

**Uso:**
1. Descomente as seções DELETE no script
2. Execute o script
3. Verifique os resultados

---

## 🔄 Ordem de Execução

### Migração (Normal)

1. **`001_migrate_cultural_events_to_events.sql`**
   - Migra eventos primeiro

2. **`002_migrate_checkins_to_attendees.sql`**
   - Migra check-ins depois (depende de eventos migrados)

### Rollback (Reversão)

1. **`003_rollback_migration.sql`**
   - Remove check-ins primeiro
   - Remove eventos depois

---

## ✅ Validações

### Antes da Migração

Execute os scripts de análise da FASE 2:
- `001_analyze_cultural_events.sql`
- `002_map_cultural_profile_to_actor.sql`
- `006_dry_run_mapping.sql`

Valide:
- ✅ Todos os `cultural_profiles` têm `owner_actor_id` válido
- ✅ Todos os `owner_actor_type` são 'user' ou 'page'
- ✅ Todos os `actors` existem na tabela `actors`

### Durante a Migração

Os scripts mostram:
- Estatísticas de migração
- Avisos de problemas encontrados
- Validações pós-migração

### Após a Migração

Verifique:
- ✅ Contagem de eventos migrados
- ✅ Contagem de check-ins migrados
- ✅ Integridade referencial
- ✅ Constraints (status, visibility, event_type)

---

## 🛡️ Proteções

### Idempotência

Todos os scripts são idempotentes:
- Usam `ON CONFLICT DO NOTHING`
- Podem ser executados múltiplas vezes
- Não duplicam dados

### Preservação de Dados

- Dados originais (`cultural_events`, `cultural_event_checkins`) **NÃO são removidos**
- Apenas dados migrados são criados
- Rollback remove apenas dados migrados

### Metadata

Todos os registros migrados têm `metadata.source` com:
- Tabela de origem
- ID original
- Informações de origem
- Data de migração

---

## 📊 Exemplos de Uso

### Executar Migração Completa

```bash
# 1. Migrar eventos
psql -d unificard -f backend/scripts/migration-execution/001_migrate_cultural_events_to_events.sql

# 2. Migrar check-ins
psql -d unificard -f backend/scripts/migration-execution/002_migrate_checkins_to_attendees.sql
```

### Verificar Migração

```sql
-- Contar eventos migrados
SELECT COUNT(*) 
FROM events 
WHERE metadata->'source'->>'table' = 'cultural_events';

-- Contar check-ins migrados
SELECT COUNT(*) 
FROM event_attendees 
WHERE metadata->'source'->>'table' = 'cultural_event_checkins';
```

### Rollback (se necessário)

```sql
-- 1. Descomentar seções DELETE no script 003
-- 2. Executar
\i backend/scripts/migration-execution/003_rollback_migration.sql
```

---

## ⚠️ Riscos e Mitigações

### Risco 1: Actor não encontrado

**Problema:** `cultural_profile.owner_actor_id` não existe em `actors`

**Mitigação:**
- Script valida antes de migrar
- Eventos sem actor válido são pulados
- Aviso é exibido

### Risco 2: Foreign Key violations

**Problema:** Dependências quebradas após migração

**Mitigação:**
- Scripts validam constraints após migração
- Rollback remove dependências primeiro

### Risco 3: Duplicação

**Problema:** Executar migração múltiplas vezes

**Mitigação:**
- Scripts são idempotentes
- `ON CONFLICT DO NOTHING` previne duplicação

---

## 📝 Logs e Estatísticas

Os scripts exibem:
- Total de registros a migrar
- Registros migrados com sucesso
- Registros não migrados (com razão)
- Validações pós-migração

---

## 🔗 Relacionados

- **FASE 2:** Scripts de análise (`backend/scripts/migration-analysis/`)
- **FASE 1:** Migrations de schema (`backend/migrations/090_*.sql`, `091_*.sql`)

---

*Scripts criados em 28/12/2025*  
*FASE 3 — MIGRAÇÃO DE DADOS (WRITE CONTROLADO)*














