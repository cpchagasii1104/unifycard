# PLANO DE MIGRAÇÃO DE DADOS — CATEGORIAS CANÔNICAS

**Data:** 2024  
**Status:** Planejamento — NÃO EXECUTAR  
**Objetivo:** Consolidar estruturas legadas em `categories` (core)  
**Fonte Normativa:** `CATEGORY_TREE_SCHEMA.md`

---

## RESUMO EXECUTIVO

**Estruturas Legadas Identificadas:**
1. `catalog_categories` — Tabela separada para categorias de produtos do marketplace
2. `health_taxonomies` — Tabela separada para taxonomias de saúde (DOMÍNIO ESPECIAL)

**Estratégia:**
- `catalog_categories`: Migração completa para `categories` core
- `health_taxonomies`: Estratégia isolada (NÃO migrar agora)

**Fases:**
- Fase 0: Shadow Read (✅ CONCLUÍDA)
- Fase 1: Backfill `categories` core
- Fase 2: Remapear Foreign Keys
- Fase 3: Desligamento controlado

---

## 1. ANÁLISE DE ESTRUTURAS LEGADAS

### 1.1 Catalog Categories (`catalog_categories`)

**Tabela:** `catalog_categories`  
**Migração:** `backend/migrations/163_create_product_categories.sql`  
**Status:** LEGADO — duplicação estrutural

#### Estrutura Atual

```sql
CREATE TABLE catalog_categories (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES catalog_categories(id),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE (tenant_id, slug)
);
```

#### Equivalência com `categories` Core

| Campo Legado | Campo Core | Observações |
|--------------|------------|-------------|
| `id` | `category_id` | UUID → UUID (mapeamento necessário) |
| `tenant_id` | `country_code` | Tenant-scoped → Country-scoped (transformação) |
| `name` | `name` | Direto |
| `slug` | `slug` | Conflito: legado é único por tenant, core é único por country |
| `parent_id` | `parent_id` | UUID → UUID (mapeamento necessário) |
| `is_active` | `status` | `true` → `'active'`, `false` → `'inactive'` |
| `metadata` | `metadata` | Direto (adicionar `marketplace_domain`, `category_type`) |
| - | `level` | Calculado automaticamente |
| - | `path` | Calculado automaticamente |
| - | `scope` | `'professional'` (padrão marketplace) |
| - | `keywords` | Array vazio ou derivado de `name` |

#### Chaves de Equivalência

**Problema:** `catalog_categories` é tenant-scoped, `categories` é country-scoped.

**Estratégia de Mapeamento:**
1. Identificar país do tenant (via `tenants.country_code`)
2. Criar categorias em `categories` com `country_code` correspondente
3. Adicionar `metadata.marketplace_domain` e `metadata.category_type`
4. Adicionar `category_contexts` com `context='marketplace'`

#### Conflitos Potenciais

| Tipo de Conflito | Risco | Mitigação |
|------------------|-------|-----------|
| **Slug duplicado** | ALTO | Slug legado é único por tenant, core é único por country. Solução: prefixar slug com tenant_id ou usar hash. |
| **Nome duplicado** | MÉDIO | Nomes podem colidir entre tenants do mesmo país. Solução: aceitar duplicação de nome (slug é único). |
| **Hierarquia quebrada** | ALTO | Se `parent_id` não for migrado corretamente, hierarquia quebra. Solução: migrar em ordem (raiz → folhas). |
| **Metadata perdida** | BAIXO | Metadata legada pode ter campos específicos. Solução: preservar em `metadata` JSONB. |

#### Volume Estimado

**Análise Necessária:**
```sql
-- Executar para estimar volume
SELECT 
    COUNT(*) as total_categories,
    COUNT(DISTINCT tenant_id) as tenants_afetados,
    COUNT(*) FILTER (WHERE parent_id IS NULL) as raizes,
    AVG(LENGTH(name)) as avg_name_length
FROM catalog_categories;
```

**Estimativa Conservadora:**
- Categorias por tenant: 10-100
- Tenants ativos: 10-50
- Total estimado: 100-5.000 registros

#### Dependências

**Tabelas que Referenciam `catalog_categories`:**
- Nenhuma (apenas self-reference via `parent_id`)

**Código que Usa `catalog_categories`:**
- `backend/src/modules/marketplace/product-category.repository.ts` (já usa adapter)
- `backend/src/modules/marketplace/product-category-adapter.ts` (já migrado para categories core)

**Status:** ✅ Código já migrado para adapter. Apenas dados precisam ser migrados.

---

### 1.2 Health Taxonomies (`health_taxonomies`)

**Tabela:** `health_taxonomies`  
**Migração:** `backend/migrations/253_create_health_relational_model.sql`  
**Status:** DOMÍNIO ESPECIAL — estrutura com campos específicos

#### Estrutura Atual

```sql
CREATE TABLE health_taxonomies (
    taxonomy_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,  -- 'general', 'vision', 'dental', etc.
    fact_type VARCHAR(50) NOT NULL,  -- 'condition', 'medication', 'device', etc.
    parent_id UUID REFERENCES health_taxonomies(taxonomy_id),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE (tenant_id, slug)
);
```

#### Equivalência com `categories` Core

| Campo Legado | Campo Core | Observações |
|--------------|------------|-------------|
| `taxonomy_id` | `category_id` | UUID → UUID (mapeamento necessário) |
| `tenant_id` | `country_code` | Tenant-scoped → Country-scoped (transformação) |
| `name` | `name` | Direto |
| `slug` | `slug` | Conflito: legado é único por tenant, core é único por country |
| `category` | `metadata.category` | Campo específico → metadata |
| `fact_type` | `metadata.fact_type` | Campo específico → metadata |
| `parent_id` | `parent_id` | UUID → UUID (mapeamento necessário) |
| `description` | `description` | Direto |
| `is_active` | `status` | `true` → `'active'`, `false` → `'inactive'` |
| `metadata` | `metadata` | Merge com campos específicos |

#### Chaves de Equivalência

**Problema:** `health_taxonomies` tem campos específicos (`category`, `fact_type`) que não existem em `categories` core.

**Estratégia de Mapeamento:**
1. Armazenar `category` e `fact_type` em `metadata`
2. Adicionar `category_contexts` com `context='health'`
3. Preservar relacionamento hierárquico via `parent_id`

#### Conflitos Potenciais

| Tipo de Conflito | Risco | Mitigação |
|------------------|-------|-----------|
| **Slug duplicado** | ALTO | Slug legado é único por tenant, core é único por country. Solução: prefixar slug com tenant_id ou usar hash. |
| **Campos específicos perdidos** | ALTO | `category` e `fact_type` são críticos. Solução: preservar em `metadata`. |
| **Relacionamento com `user_health_facts`** | CRÍTICO | `user_health_facts.taxonomy_id` referencia `health_taxonomies.taxonomy_id`. Solução: migrar em Fase 2 com remapeamento de FKs. |

#### Volume Estimado

**Análise Necessária:**
```sql
-- Executar para estimar volume
SELECT 
    COUNT(*) as total_taxonomies,
    COUNT(DISTINCT tenant_id) as tenants_afetados,
    COUNT(DISTINCT category) as categories_distinct,
    COUNT(DISTINCT fact_type) as fact_types_distinct,
    COUNT(*) FILTER (WHERE parent_id IS NULL) as raizes
FROM health_taxonomies;
```

**Estimativa Conservadora:**
- Taxonomias por tenant: 50-200 (seed controlado)
- Tenants ativos: 10-50
- Total estimado: 500-10.000 registros

#### Dependências

**Tabelas que Referenciam `health_taxonomies`:**
- `user_health_facts.taxonomy_id` → `health_taxonomies.taxonomy_id` (FK CASCADE)

**Código que Usa `health_taxonomies`:**
- `backend/src/core/profile/profile-health-taxonomy.repository.ts`
- `backend/src/core/profile/profile-health-facts.repository.ts`

**Status:** ⚠️ Código ainda usa tabela legada. Migração requer alteração de código.

---

## 2. PLANO DE MIGRAÇÃO EM FASES

### FASE 0: Shadow Read (✅ CONCLUÍDA)

**Objetivo:** Garantir que código lê de `categories` core via adapters.

**Status:** ✅ Concluída
- `product-category-adapter.ts` criado
- `marketplace-categories.service.ts` usa categories core
- Frontend usa busca canônica

**Critérios de Aceite:**
- ✅ Nenhum código novo lê diretamente de `catalog_categories`
- ✅ Nenhum código novo lê diretamente de `health_taxonomies` (exceto health module)
- ✅ Adapters funcionam corretamente

---

### FASE 1: Backfill `categories` Core

**Objetivo:** Migrar dados de estruturas legadas para `categories` core sem quebrar funcionalidade.

#### 1.1 Catalog Categories → Categories Core

**Pré-requisitos:**
- Fase 0 concluída
- Análise de volume executada
- Estratégia de resolução de conflitos definida

**Passos:**

1. **Análise de Dados**
   ```sql
   -- Identificar tenants e países
   SELECT 
       cc.tenant_id,
       t.country_code,
       COUNT(*) as categories_count
   FROM catalog_categories cc
   JOIN tenants t ON t.tenant_id = cc.tenant_id
   GROUP BY cc.tenant_id, t.country_code;
   ```

2. **Resolução de Conflitos de Slug**
   - Identificar slugs duplicados por país
   - Estratégia: prefixar com tenant_id ou usar hash
   - Exemplo: `slug_legado` → `{tenant_id}_{slug_legado}` ou `hash(tenant_id, slug_legado)`

3. **Migração de Dados**
   ```sql
   -- PSEUDO-CODE (NÃO EXECUTAR)
   -- Para cada tenant:
   --   1. Obter country_code do tenant
   --   2. Para cada categoria em catalog_categories:
   --      a. Resolver slug (verificar conflitos)
   --      b. Mapear parent_id (se existir)
   --      c. Inserir em categories com:
   --         - scope = 'professional'
   --         - country_code = tenant.country_code
   --         - metadata = { marketplace_domain, category_type, ... }
   --      d. Inserir em category_contexts com context = 'marketplace'
   --      e. Registrar mapeamento id_legado → category_id em tabela de mapeamento
   ```

4. **Tabela de Mapeamento**
   ```sql
   CREATE TABLE catalog_categories_mapping (
       legacy_id UUID PRIMARY KEY,
       category_id UUID NOT NULL REFERENCES categories(category_id),
       tenant_id UUID NOT NULL,
       created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

5. **Validação**
   - Contar registros migrados
   - Verificar hierarquia preservada
   - Verificar slugs únicos por país
   - Verificar metadata preservada

**Critérios de Aceite:**
- ✅ Todos os registros de `catalog_categories` migrados para `categories`
- ✅ Hierarquia preservada (parent_id mapeado corretamente)
- ✅ Slugs únicos por país
- ✅ Metadata preservada
- ✅ Tabela de mapeamento populada

**Status de Execução:**
- ✅ **CONCLUÍDA** (2024)
- Script: `backend/migrations/400_backfill_catalog_categories_to_core.sql`
- Execução: STAGING (sem dados no ambiente atual)
- Observação: Migração idempotente, pronta para execução em PRODUÇÃO quando houver dados
- Validações: Todas passaram (contagens coerentes, nenhum slug duplicado, hierarquia preservada)
- Escrita bloqueada: Guards adicionados em `product-catalog.service.ts` (código `LEGACY_WRITE_BLOCKED`)

**Riscos:**
- **Alto:** Conflitos de slug podem quebrar URLs
- **Médio:** Hierarquia quebrada se parent_id não mapeado
- **Baixo:** Metadata perdida

**Mitigações:**
- Testar migração em ambiente de staging
- Backup completo antes de migração
- Rollback plan documentado

---

#### 1.2 Health Taxonomies → Categories Core (NÃO EXECUTAR AGORA)

**Status:** ⚠️ DOMÍNIO ESPECIAL — NÃO migrar na Fase 1

**Justificativa:**
- Estrutura tem campos específicos (`category`, `fact_type`)
- Relacionamento direto com `user_health_facts` (FK CASCADE)
- Requer análise de impacto mais profunda

**Estratégia Futura:**
1. Criar campos específicos em `metadata` de `categories`
2. Migrar dados preservando `category` e `fact_type` em `metadata`
3. Remapear `user_health_facts.taxonomy_id` para `categories.category_id`
4. Atualizar código para ler de `categories` com filtro por `metadata.category` e `metadata.fact_type`

**Quando Migrar:**
- Após Fase 2 (catalog_categories) estabilizada
- Após análise de impacto completa
- Após validação de estratégia de metadata

---

### FASE 2: Remapear Foreign Keys

**Objetivo:** Atualizar referências de IDs legados para IDs canônicos.

#### 2.1 Catalog Categories

**Status:** ✅ Nenhuma FK externa identificada

**Ações:**
- Nenhuma (apenas self-reference via `parent_id`, já mapeada na Fase 1)

---

#### 2.2 Health Taxonomies

**Status:** ⚠️ NÃO EXECUTAR AGORA (domínio especial)

**Tabelas Afetadas:**
- `user_health_facts.taxonomy_id` → `health_taxonomies.taxonomy_id`

**Estratégia Futura:**
1. Criar tabela de mapeamento `health_taxonomies_mapping`
2. Atualizar `user_health_facts.taxonomy_id` usando mapeamento
3. Validar integridade referencial

**Quando Executar:**
- Após migração de `health_taxonomies` para `categories` (futuro)

---

### FASE 3: Desligamento Controlado

**Objetivo:** Remover estruturas legadas após validação completa.

#### 3.1 Catalog Categories

**Pré-requisitos:**
- Fase 1 concluída
- Fase 2 concluída (se aplicável)
- Validação completa em produção
- Período de observação (30 dias)

**Passos:**

1. **Validação Final**
   - Verificar que nenhum código lê de `catalog_categories`
   - Verificar que todos os dados migrados
   - Verificar que hierarquia preservada

2. **Backup**
   - Backup completo de `catalog_categories`
   - Backup de tabela de mapeamento

3. **Desligamento**
   ```sql
   -- NÃO EXECUTAR AINDA
   -- Após validação completa:
   --   1. Renomear tabela para catalog_categories_deprecated
   --   2. Manter por período de rollback (90 dias)
   --   3. Após período, DROP TABLE catalog_categories_deprecated
   ```

**Critérios de Aceite:**
- ✅ Nenhum código lê de `catalog_categories`
- ✅ Todos os dados migrados e validados
- ✅ Período de observação concluído
- ✅ Backup completo realizado

**Riscos:**
- **Alto:** Se dados não migrados corretamente, perda de dados
- **Médio:** Se código ainda referencia, quebra de funcionalidade

**Mitigações:**
- Período de observação extenso (30-90 dias)
- Backup completo antes de desligamento
- Rollback plan documentado

---

#### 3.2 Health Taxonomies

**Status:** ⚠️ NÃO EXECUTAR AGORA (domínio especial)

**Quando Executar:**
- Após migração completa de `health_taxonomies` para `categories` (futuro)
- Após remapeamento de `user_health_facts.taxonomy_id` (futuro)

---

## 3. RISCOS E DEPENDÊNCIAS

### 3.1 Riscos Gerais

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Conflitos de slug** | Alta | Alto | Prefixar slug com tenant_id ou usar hash |
| **Hierarquia quebrada** | Média | Alto | Migrar em ordem (raiz → folhas), validar parent_id |
| **Metadata perdida** | Baixa | Médio | Preservar em `metadata` JSONB |
| **Perda de dados** | Baixa | Crítico | Backup completo, validação extensa |
| **Quebra de funcionalidade** | Média | Alto | Período de observação, rollback plan |

### 3.2 Dependências

**Catalog Categories:**
- ✅ Código já migrado para adapter
- ✅ Nenhuma FK externa
- ✅ Migração pode ser executada isoladamente

**Health Taxonomies:**
- ⚠️ Código ainda usa tabela legada
- ⚠️ FK externa (`user_health_facts.taxonomy_id`)
- ⚠️ Requer migração de código antes de dados

---

## 4. CRITÉRIOS DE ACEITE POR FASE

### Fase 0: Shadow Read
- ✅ Nenhum código novo lê diretamente de estruturas legadas
- ✅ Adapters funcionam corretamente
- ✅ Frontend usa busca canônica

### Fase 1: Backfill
- ✅ Todos os dados migrados
- ✅ Hierarquia preservada
- ✅ Slugs únicos por país
- ✅ Metadata preservada
- ✅ Tabela de mapeamento populada

### Fase 2: Remapear FKs
- ✅ Todas as FKs externas atualizadas
- ✅ Integridade referencial preservada
- ✅ Validação completa

### Fase 3: Desligamento
- ✅ Nenhum código lê de estruturas legadas
- ✅ Período de observação concluído
- ✅ Backup completo realizado
- ✅ Validação final aprovada

---

## 5. ESTRATÉGIA PARA HEALTH_TAXONOMIES (ISOLADA)

### 5.1 Análise de Viabilidade

**Campos Específicos:**
- `category`: 'general', 'vision', 'dental', 'medications', 'mobility', 'mental', 'other'
- `fact_type`: 'condition', 'medication', 'device', 'service_need', 'allergy', 'other'

**Estratégia de Migração:**
1. Armazenar `category` e `fact_type` em `metadata` de `categories`
2. Adicionar `category_contexts` com `context='health'`
3. Criar índices GIN em `metadata` para busca eficiente
4. Atualizar código para filtrar por `metadata.category` e `metadata.fact_type`

### 5.2 Plano Futuro

**Fase 1 (Futuro):** Migrar dados
- Criar categorias em `categories` com `metadata.category` e `metadata.fact_type`
- Adicionar `category_contexts` com `context='health'`
- Criar tabela de mapeamento `health_taxonomies_mapping`

**Fase 2 (Futuro):** Remapear FKs
- Atualizar `user_health_facts.taxonomy_id` usando mapeamento
- Validar integridade referencial

**Fase 3 (Futuro):** Atualizar código
- Atualizar `profile-health-taxonomy.repository.ts` para ler de `categories`
- Atualizar `profile-health-facts.repository.ts` para usar `categories.category_id`
- Remover código legado

**Fase 4 (Futuro):** Desligamento
- Remover `health_taxonomies` após validação

### 5.3 Critérios de Aceite (Futuro)

- ✅ Todos os dados migrados
- ✅ Campos específicos preservados em `metadata`
- ✅ FKs externas remapeadas
- ✅ Código atualizado
- ✅ Funcionalidade preservada

---

## 6. CHECKLIST DE EXECUÇÃO

### Pré-Migração
- [ ] Análise de volume executada
- [ ] Estratégia de resolução de conflitos definida
- [ ] Backup completo realizado
- [ ] Ambiente de staging configurado
- [ ] Rollback plan documentado

### Durante Migração
- [ ] Migração executada em staging
- [ ] Validação completa em staging
- [ ] Migração executada em produção
- [ ] Validação completa em produção
- [ ] Tabela de mapeamento populada

### Pós-Migração
- [ ] Período de observação iniciado (30 dias)
- [ ] Monitoramento ativo
- [ ] Validação contínua
- [ ] Documentação atualizada

### Desligamento
- [ ] Período de observação concluído
- [ ] Validação final aprovada
- [ ] Backup completo realizado
- [ ] Tabela legada renomeada para `_deprecated`
- [ ] Período de rollback iniciado (90 dias)

---

## 7. OBSERVAÇÕES FINAIS

**NÃO EXECUTAR MIGRAÇÃO SEM:**
1. Análise de volume completa
2. Estratégia de resolução de conflitos validada
3. Backup completo
4. Ambiente de staging testado
5. Rollback plan documentado
6. Aprovação de stakeholders

**PRIORIDADE:**
1. **Alta:** Catalog Categories (código já migrado, baixo risco)
2. **Baixa:** Health Taxonomies (domínio especial, requer análise profunda)

**TIMELINE ESTIMADO:**
- Fase 1 (Catalog Categories): 2-4 semanas
- Fase 2 (Catalog Categories): N/A (nenhuma FK externa)
- Fase 3 (Catalog Categories): 1-2 semanas (após período de observação)
- Health Taxonomies: TBD (após análise completa)

---

**Documento criado em:** 2024  
**Última atualização:** 2024  
**Status:** Planejamento — NÃO EXECUTAR

