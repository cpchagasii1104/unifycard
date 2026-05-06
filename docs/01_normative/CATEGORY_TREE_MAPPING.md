# MAPEAMENTO COMPLETO — ÁRVORES DE CATEGORIAS

**Data:** 2024  
**Objetivo:** Auditoria total de todas as estruturas categóricas do sistema  
**Status:** Mapeamento inicial — sem alterações de código

---

## 1. ESTRUTURAS DE CATEGORIAS (BACKEND)

### 1.1 Core Categories (Árvore Canônica Principal)

| Arquivo | Tipo | Domínio | Status | Dependências |
|---------|------|---------|--------|--------------|
| `backend/src/core/categories/categories.model.ts` | Modelo | Core | Em uso | - |
| `backend/src/core/categories/categories.repository.ts` | Repository | Core | Em uso | categories.model |
| `backend/src/core/categories/categories.service.ts` | Service | Core | Em uso | categories.repository |
| `backend/src/core/categories/categories.routes.ts` | API Routes | Core | Em uso | categories.service |
| `backend/src/core/categories/categories.types.ts` | Tipos | Core | Em uso | @unificard/contracts |
| `backend/migrations/043_category_core_canonical.sql` | Migração | Core | Em uso | - |
| `docs/01_normative/CATEGORY_TREE_ARCHITECTURAL_CLOSURE.md` | Documentação | Core | Em uso | SSOT estrutural; `docs/99_archive/to_review/category_tree_constitution.md` apenas histórico |

**Tabela:** `categories`  
**Estrutura:** Hierárquica (parent_id, level, path). **`path`** = apenas ancestrais; `path.length === level` (raiz `level = 0`). Ver `CATEGORY_TREE_ARCHITECTURAL_CLOSURE.md` §1.1.  
**Contextos suportados:** professional, interest, learning, health, education, cause, group, company, event, campaign

---

### 1.2 Marketplace Categories (Adapter sobre Core)

| Arquivo | Tipo | Domínio | Status | Dependências |
|---------|------|---------|--------|--------------|
| `backend/src/modules/marketplace/marketplace-categories.service.ts` | Service | Marketplace | Em uso | categories.service (core) |
| `backend/src/modules/marketplace/marketplace-categories.routes.ts` | API Routes | Marketplace | Em uso | marketplace-categories.service |
| `backend/src/modules/marketplace/marketplace-categories.types.ts` | Tipos | Marketplace | Em uso | - |

**Tabela:** `categories` (mesma do core)  
**Estrutura:** Adapter que filtra categorias core por metadata  
**Domínios:** market, services, events, real_estate, vehicles, jobs

---

### 1.3 Catalog Categories (Tabela Separada)

| Arquivo | Tipo | Domínio | Status | Dependências |
|---------|------|---------|--------|--------------|
| `backend/migrations/163_create_product_categories.sql` | Migração | Marketplace | Em uso | - |
| `backend/src/modules/marketplace/product-category.repository.ts` | Repository | Marketplace | Em uso | catalog_categories table |

**Tabela:** `catalog_categories`  
**Estrutura:** Hierárquica separada (parent_id, tenant_id)  
**Status:** DUPLICADO — estrutura paralela à categories core

---

### 1.4 Health Taxonomies (Tabela Separada)

| Arquivo | Tipo | Domínio | Status | Dependências |
|---------|------|---------|--------|--------------|
| `backend/src/core/profile/profile-health-taxonomy.repository.ts` | Repository | Health | Em uso | health_taxonomies table |
| `backend/src/core/profile/profile-health-facts.repository.ts` | Repository | Health | Em uso | health_taxonomies table |
| `backend/migrations/253_create_health_relational_model.sql` | Migração | Health | Em uso | - |
| `backend/src/scripts/seed-health-taxonomies.ts` | Seed | Health | Em uso | - |

**Tabela:** `health_taxonomies`  
**Estrutura:** Hierárquica separada (parent_id, category, factType)  
**Status:** DUPLICADO — estrutura paralela à categories core

---

## 2. ESTRUTURAS DE CATEGORIAS (FRONTEND)

### 2.1 Core Categories API

| Arquivo | Tipo | Domínio | Status | Dependências |
|---------|------|---------|--------|--------------|
| `frontend/src/api/categories.ts` | API Client | Professional | Em uso | /categories/* endpoints |
| `frontend/src/api/category.ts` | API Client | Core | Em uso | /categories/* endpoints |
| `frontend/src/components/ProfileProfessional.tsx` | Componente | Professional | Em uso | categories.ts |
| `frontend/src/hooks/useProfessionalCategories.ts` | Hook | Professional | Em uso | categories.ts |

**Endpoints:** `/categories/tree`, `/categories/autocomplete`, `/categories/search`  
**Contexto obrigatório:** Sim (CategoryContext)

---

### 2.2 Marketplace Categories API

| Arquivo | Tipo | Domínio | Status | Dependências |
|---------|------|---------|--------|--------------|
| `frontend/src/api/marketplace-categories.ts` | API Client | Marketplace | Em uso | /marketplace/categories/* endpoints |
| `frontend/src/api/marketplace.ts` | API Client | Marketplace | Em uso | /marketplace/catalog/categories |
| `frontend/src/components/marketplace/CategoryDropdown.tsx` | Componente | Marketplace | Em uso | marketplace-categories.ts |
| `frontend/src/pages/CategoryNavigationPage.tsx` | Página | Marketplace | Em uso | marketplace-categories.ts |
| `frontend/src/pages/DepartmentPage.tsx` | Página | Marketplace | Em uso | marketplace-categories.ts |

**Endpoints:** `/marketplace/categories/root`, `/marketplace/categories/:id/children`  
**Domínios:** market, services, events, real_estate, vehicles, jobs

---

### 2.3 Groups Categories API

| Arquivo | Tipo | Domínio | Status | Dependências |
|---------|------|---------|--------|--------------|
| `frontend/src/api/groups.ts` | API Client | Groups | Em uso | /groups/categories endpoint |
| `frontend/src/components/groups/CreateGroupWizard.tsx` | Componente | Groups | Em uso | groups.ts |

**Endpoint:** `/groups/categories`  
**Status:** INCERTO — origem das categorias (core ou separado?)

---

### 2.4 Health Taxonomies API

| Arquivo | Tipo | Domínio | Status | Dependências |
|---------|------|---------|--------|--------------|
| `frontend/src/api/health.ts` | API Client | Health | Em uso | /profile/health/taxonomies endpoint |
| `frontend/src/components/ProfileHealth.tsx` | Componente | Health | Em uso | health.ts |
| `frontend/src/components/ProfileHealthForm.tsx` | Componente | Health | Em uso | health.ts |

**Endpoint:** `/profile/health/taxonomies`  
**Tabela backend:** `health_taxonomies` (separada)

---

## 3. SEEDS E INICIALIZAÇÃO

### 3.1 Seeds de Categorias Core

| Arquivo | Tipo | Domínio | Status | Dependências |
|---------|------|---------|--------|--------------|
| `backend/src/scripts/seed-professional-categories.ts` | Seed | Professional | Em uso | categories.service |
| `backend/src/scripts/seed-interests-categories.ts` | Seed | Interest | Em uso | categories.service |
| `backend/src/scripts/seed-learning-categories.ts` | Seed | Learning | Em uso | categories.service |
| `backend/src/scripts/seed-physical-categories.ts` | Seed | Physical | Em uso | categories.service |
| `backend/src/scripts/seed-group-categories.ts` | Seed | Groups | Em uso | categories.service |
| `backend/src/scripts/seed-health-categories.ts` | Seed | Health | Em uso | categories.service |
| `backend/src/scripts/seed-cause-categories.ts` | Seed | Cause | Em uso | categories.service |
| `backend/src/scripts/seed-dev-categories.ts` | Seed | Dev | Em uso | categories.service |

**Tabela destino:** `categories` (core)  
**Contextos:** professional, interest, learning, physical, group, health, cause

---

### 3.2 Seeds de Taxonomias Separadas

| Arquivo | Tipo | Domínio | Status | Dependências |
|---------|------|---------|--------|--------------|
| `backend/src/scripts/seed-health-taxonomies.ts` | Seed | Health | Em uso | health_taxonomies table |

**Tabela destino:** `health_taxonomies` (separada)

---

## 4. BUSCAS E AUTOCOMPLETE

### 4.1 Core Categories

| Arquivo | Função | Domínio | Status |
|---------|--------|---------|--------|
| `frontend/src/api/categories.ts` | `autocompleteCategories()` | Professional | Em uso |
| `frontend/src/api/categories.ts` | `searchCategories()` | Professional | Em uso |
| `backend/src/core/categories/categories.service.ts` | `autocomplete()` | Core | Em uso |
| `backend/src/core/categories/categories.service.ts` | `search()` | Core | Em uso |

**Endpoint:** `/categories/autocomplete`, `/categories/search`  
**Contexto obrigatório:** Sim

---

### 4.2 Marketplace Categories

| Arquivo | Função | Domínio | Status |
|---------|--------|---------|--------|
| `backend/src/modules/marketplace/marketplace-search.service.ts` | Busca marketplace | Marketplace | Em uso |

**Endpoint:** `/marketplace/search`  
**Filtra por:** domain, type, actorId

---

## 5. ADAPTERS E TRANSFORMAÇÕES

### 5.1 Marketplace Categories Adapter

| Arquivo | Tipo | Função | Status |
|---------|------|--------|--------|
| `backend/src/modules/marketplace/marketplace-categories.service.ts` | Adapter | Converte Category (core) → MarketplaceCategory | Em uso |

**Método:** `toMarketplaceCategory()`  
**Filtra por:** metadata.taxonomy, metadata.marketplace_domain

---

## 6. ENUMS E CONSTANTES

### 6.1 CategoryContext (Contracts)

| Arquivo | Tipo | Valores | Status |
|---------|------|---------|--------|
| `@unificard/contracts` | Enum | professional, interest, learning, health, education, cause, group, company, event, campaign | Em uso |

---

### 6.2 Health Sections (Frontend)

| Arquivo | Tipo | Valores | Status |
|---------|------|---------|--------|
| `frontend/src/api/health.ts` | Type | general, vision, dental, hearing, mobility, mental, chronic, medications, allergies, other | Em uso |
| `frontend/src/components/ProfileHealthForm.tsx` | Const | SECTIONS array | Em uso |

---

### 6.3 Marketplace Domains

| Arquivo | Tipo | Valores | Status |
|---------|------|---------|--------|
| `frontend/src/api/marketplace-categories.ts` | Type | market, services, events, real_estate, vehicles, jobs | Em uso |

---

## 7. DOCUMENTAÇÃO E CONSTITUIÇÃO

| Arquivo | Tipo | Status |
|---------|------|--------|
| `docs/01_normative/CATEGORY_TREE_ARCHITECTURAL_CLOSURE.md` | Documentação | SSOT estrutural (em uso) |
| `docs/99_archive/to_review/category_tree_constitution.md` | Documentação | Arquivado (histórico) |
| `docs/architecture/diagrams/CATEGORY-TREE-CANONICAL.md` | Diagrama | Em uso |
| `docs/01_normative/CORE_CATEGORY_VALIDATION_MATRIX.md` | Validação | Em uso |
| `docs/architecture/integration/CATEGORY-TREE-MODULE-MAP.md` | Integração | Em uso |

---

## MAPA DE DUPLICIDADES

### Duplicação 1: Catalog Categories vs Core Categories

**Problema:** Tabela `catalog_categories` separada da `categories` core  
**Arquivos envolvidos:**
- `backend/migrations/163_create_product_categories.sql` (cria catalog_categories)
- `backend/src/modules/marketplace/product-category.repository.ts` (usa catalog_categories)
- `backend/src/core/categories/categories.*` (usa categories)

**Impacto:** Duas árvores paralelas para produtos do marketplace  
**Status:** DUPLICADO

---

### Duplicação 2: Health Taxonomies vs Core Categories

**Problema:** Tabela `health_taxonomies` separada da `categories` core  
**Arquivos envolvidos:**
- `backend/src/core/profile/profile-health-taxonomy.repository.ts` (usa health_taxonomies)
- `backend/migrations/253_create_health_relational_model.sql` (cria health_taxonomies)
- `backend/src/core/categories/categories.*` (usa categories)

**Impacto:** Duas árvores paralelas para taxonomias de saúde  
**Status:** DUPLICADO

---

### Duplicação 3: Marketplace Categories Adapter

**Problema:** Service que adapta categories core para MarketplaceCategory  
**Arquivos envolvidos:**
- `backend/src/modules/marketplace/marketplace-categories.service.ts` (adapter)
- `backend/src/core/categories/categories.service.ts` (core)

**Impacto:** Camada de transformação desnecessária se unificado  
**Status:** ADAPTER (não duplicação estrutural, mas transformação)

---

### Duplicação 4: Frontend APIs Separadas

**Problema:** Múltiplas APIs frontend para categorias  
**Arquivos envolvidos:**
- `frontend/src/api/categories.ts` (core/professional)
- `frontend/src/api/category.ts` (core genérico)
- `frontend/src/api/marketplace-categories.ts` (marketplace)
- `frontend/src/api/groups.ts` (groups)
- `frontend/src/api/health.ts` (health)

**Impacto:** Múltiplos pontos de entrada para categorias  
**Status:** DUPLICADO (interfaces)

---

## CANDIDATOS A ÁRVORE CANÔNICA

### Candidato 1: Core Categories (categories table)

**Arquivos:**
- `backend/src/core/categories/categories.*`
- `backend/migrations/043_category_core_canonical.sql`
- `docs/01_normative/CATEGORY_TREE_ARCHITECTURAL_CLOSURE.md`

**Características:**
- ✅ Estrutura hierárquica completa (parent_id, level, path) — `path` = ancestrais apenas; contrato em `CATEGORY_TREE_ARCHITECTURAL_CLOSURE.md` §1.1
- ✅ Suporta múltiplos contextos
- ✅ Suporta múltiplos scopes
- ✅ Documentação canônica existente
- ✅ SSOT definido

**Status:** CANDIDATO PRINCIPAL

---

### Candidato 2: Catalog Categories (catalog_categories table)

**Arquivos:**
- `backend/migrations/163_create_product_categories.sql`
- `backend/src/modules/marketplace/product-category.repository.ts`

**Características:**
- ❌ Tabela separada
- ❌ Estrutura similar mas isolada
- ❌ Tenant-scoped (não global)

**Status:** CANDIDATO A MIGRAÇÃO PARA CORE

---

### Candidato 3: Health Taxonomies (health_taxonomies table)

**Arquivos:**
- `backend/src/core/profile/profile-health-taxonomy.repository.ts`
- `backend/migrations/253_create_health_relational_model.sql`

**Características:**
- ❌ Tabela separada
- ❌ Estrutura hierárquica própria
- ❌ Campos específicos (category, factType)

**Status:** CANDIDATO A MIGRAÇÃO PARA CORE (com metadata)

---

## RESUMO EXECUTIVO

**Total de estruturas categóricas encontradas:** 3 tabelas principais  
**Total de APIs frontend:** 5 arquivos  
**Total de services backend:** 2 principais + 1 adapter  
**Total de seeds:** 9 arquivos  

**Duplicidades identificadas:** 4  
**Candidatos a unificação:** 3  

**Árvore canônica atual:** `categories` (core)  
**Árvores paralelas:** `catalog_categories`, `health_taxonomies`

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CATEGORY_TREE_ARCHITECTURAL_CLOSURE.md

### Referenciado por
- 00_INDEX.md
- CATEGORY_TREE_CANONICAL_DECISION.md
<!-- AUTO-GENERATED-END -->