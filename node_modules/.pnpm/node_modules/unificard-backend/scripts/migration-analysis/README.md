# 📊 Scripts de Análise de Migração — FASE 2

**Fase:** FASE 2 — MIGRAÇÃO CONTROLADA (READ-ONLY)  
**Objetivo:** Analisar e mapear `cultural_events` → `events` conforme CONTRATO DE EVENTOS v1

---

## 📋 Scripts Disponíveis

### 1. `001_analyze_cultural_events.sql`
Análise geral da estrutura e dados de `cultural_events`:
- Estrutura da tabela
- Estatísticas gerais
- Distribuição por status, event_type, visibility
- Eventos com ticket price, max_attendees, co-creators
- Relacionamentos com outras tabelas

**Uso:**
```sql
\i backend/scripts/migration-analysis/001_analyze_cultural_events.sql
```

---

### 2. `002_map_cultural_profile_to_actor.sql`
Mapeamento de `cultural_profiles` para `actors`:
- Análise de PACs
- Distribuição por tipo
- Mapeamento owner_actor_id → actor_id
- Validação de actors existentes

**Uso:**
```sql
\i backend/scripts/migration-analysis/002_map_cultural_profile_to_actor.sql
```

---

### 3. `003_map_event_types.sql`
Mapeamento de `event_type` antigo para novo:
- Mapeamento proposto (todos → 'cultural' + subtype)
- Distribuição detalhada
- Exemplos de mapeamento

**Uso:**
```sql
\i backend/scripts/migration-analysis/003_map_event_types.sql
```

---

### 4. `004_map_status_visibility.sql`
Mapeamento de `status` e `visibility`:
- Status antigo → novo (lowercase, sem CONFIRMED)
- Visibility antigo → novo (valores do CONTRATO v1)
- Identificação de eventos afetados
- Resumo de impacto

**Uso:**
```sql
\i backend/scripts/migration-analysis/004_map_status_visibility.sql
```

---

### 5. `005_map_related_tables.sql`
Análise de tabelas relacionadas:
- `event_participants` (vira metadata)
- `event_revenue_split` (não migra)
- `cultural_event_checkins` (migra para event_attendees)
- Resumo de relacionamentos

**Uso:**
```sql
\i backend/scripts/migration-analysis/005_map_related_tables.sql
```

---

### 6. `006_dry_run_mapping.sql`
DRY-RUN completo do mapeamento:
- Simulação de INSERT em `events`
- Validações de mapeamento
- Estatísticas de mapeamento

**Uso:**
```sql
\i backend/scripts/migration-analysis/006_dry_run_mapping.sql
```

---

## 📊 Relatório

### `RELATORIO_MAPEAMENTO_FASE2.md`
Relatório completo com:
- Mapeamento proposto
- Riscos identificados
- O que não será migrado
- Validações necessárias

---

## ⚠️ IMPORTANTE

**TODOS OS SCRIPTS SÃO READ-ONLY (SELECT apenas)**

- ❌ Não executam INSERT
- ❌ Não executam UPDATE
- ❌ Não executam DELETE
- ✅ Apenas SELECT (análise)

---

## 🚀 Como Usar

### Opção 1: psql
```bash
psql -d unificard -f backend/scripts/migration-analysis/001_analyze_cultural_events.sql
```

### Opção 2: Dentro do psql
```sql
\i backend/scripts/migration-analysis/001_analyze_cultural_events.sql
```

### Opção 3: Executar todos
```bash
for file in backend/scripts/migration-analysis/*.sql; do
  psql -d unificard -f "$file"
done
```

---

## 📝 Ordem Recomendada

1. `001_analyze_cultural_events.sql` - Visão geral
2. `002_map_cultural_profile_to_actor.sql` - Mapeamento Actor
3. `003_map_event_types.sql` - Mapeamento Event Type
4. `004_map_status_visibility.sql` - Mapeamento Status/Visibility
5. `005_map_related_tables.sql` - Tabelas Relacionadas
6. `006_dry_run_mapping.sql` - DRY-RUN Completo

---

## 📌 Próximos Passos

Após executar os scripts e analisar os resultados:
1. Validar dados problemáticos
2. Corrigir dados inválidos (se necessário)
3. Avançar para FASE 3: Migração de Dados

---

*Scripts criados em 28/12/2025*  
*FASE 2 — MIGRAÇÃO CONTROLADA (READ-ONLY)*














