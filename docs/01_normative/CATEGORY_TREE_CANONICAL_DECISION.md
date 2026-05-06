# DECISÃO CANÔNICA — ÁRVORE DE CATEGORIAS

**Data:** 2024  
**Status:** Decisão Arquitetural Definitiva  
**Base:** Mapeamento completo em `CATEGORY_TREE_MAPPING.md`

---

## ÁRVORE CANÔNICA DEFINITIVA

**Estrutura:** `categories` (tabela core)  
**Localização:** `backend/src/core/categories/`  
**Migração:** `backend/migrations/043_category_core_canonical.sql`  
**Documentação:** `docs/01_normative/CATEGORY_TREE_ARCHITECTURAL_CLOSURE.md` (SSOT). `docs/99_archive/to_review/category_tree_constitution.md` — arquivado, não primário.

**Justificativa:**
- Única estrutura com documentação canônica explícita
- Suporta todos os contextos necessários (professional, interest, learning, health, education, cause, group, company, event, campaign)
- Estrutura hierárquica completa (parent_id, level, path) — **`path`** = ancestrais apenas; `path.length === level`; ver CLOSURE §1.1
- SSOT já definido e documentado
- Suporta múltiplos scopes sem criar árvores paralelas

---

## ESTRUTURAS CONVERTIDAS EM ADAPTER

### 1. Marketplace Categories Service

**Arquivo:** `backend/src/modules/marketplace/marketplace-categories.service.ts`  
**Status:** ADAPTER  
**Justificativa:** Já consome categories core, apenas filtra por metadata. Mantém-se como adapter para preservar interface específica do marketplace.

**Ação:** Nenhuma. Já funciona como adapter.

---

### 2. Marketplace Categories API (Frontend)

**Arquivo:** `frontend/src/api/marketplace-categories.ts`  
**Status:** ADAPTER  
**Justificativa:** Interface específica para marketplace. Continua existindo como camada de adaptação sobre categories core.

**Ação:** Nenhuma. Já funciona como adapter.

---

### 3. Groups Categories API

**Arquivo:** `frontend/src/api/groups.ts` (função `getGroupCategories`)  
**Status:** ADAPTER  
**Justificativa:** Endpoint `/groups/categories` deve retornar categorias core filtradas por context='group'.

**Ação:** Verificar se backend já usa categories core. Se não, migrar.

---

## ESTRUTURAS MARCADAS COMO LEGADO

### 1. Catalog Categories (catalog_categories table)

**Arquivo:** `backend/migrations/163_create_product_categories.sql`  
**Arquivo:** `backend/src/modules/marketplace/product-category.repository.ts`  
**Status:** LEGADO  
**Justificativa:** Tabela separada duplicando estrutura de categories core. Deve ser migrada para categories core com scope='marketplace' e metadata apropriado.

**Ação:** Marcar para remoção após migração de dados para categories core.

---

### 2. Catalog Categories API (Frontend - marketplace.ts)

**Arquivo:** `frontend/src/api/marketplace.ts` (função `listCategories`)  
**Status:** LEGADO  
**Justificativa:** Endpoint `/marketplace/catalog/categories` usa tabela legada catalog_categories.

**Ação:** Migrar para usar categories core via marketplace-categories.service.

---

## ESTRUTURAS DE DOMÍNIO ESPECIAL

### 1. Health Taxonomies (health_taxonomies table)

**Arquivo:** `backend/src/core/profile/profile-health-taxonomy.repository.ts`  
**Arquivo:** `backend/migrations/253_create_health_relational_model.sql`  
**Status:** DOMÍNIO ESPECIAL (temporário)  
**Justificativa:** Estrutura possui campos específicos (category, factType) e relacionamento direto com health_facts. Requer análise de migração para categories core com metadata estruturado.

**Ação:** Avaliar migração para categories core com metadata contendo category e factType. Manter separado até migração planejada.

---

## IMPACTO POR MÓDULO

### Perfil Profissional

**Status:** ✅ Já usa categories core  
**Arquivos:** `frontend/src/api/categories.ts`, `frontend/src/components/ProfileProfessional.tsx`  
**Ação:** Nenhuma. Já canônico.

---

### Perfil Saúde

**Status:** ⚠️ Usa health_taxonomies (domínio especial)  
**Arquivos:** `frontend/src/api/health.ts`, `backend/src/core/profile/profile-health-taxonomy.repository.ts`  
**Ação:** Planejar migração de health_taxonomies para categories core com metadata estruturado.

---

### Eventos

**Status:** ✅ Usa categories core  
**Arquivos:** `backend/src/core/events/` (referências a categories)  
**Ação:** Nenhuma. Já canônico.

---

### Grupos

**Status:** ⚠️ Endpoint separado, verificar origem  
**Arquivos:** `frontend/src/api/groups.ts`, `backend/src/modules/groups/groups.routes.ts`  
**Ação:** Verificar se `/groups/categories` usa categories core. Se não, migrar.

---

### Jobs / Oportunidades

**Status:** ✅ Usa categories core (context='professional')  
**Arquivos:** `backend/src/modules/human-mvp/human-mvp-opportunity.service.ts`  
**Ação:** Nenhuma. Já canônico.

---

### Marketplace

**Status:** ⚠️ Misto: adapter (marketplace-categories) + legado (catalog_categories)  
**Arquivos:** 
- `backend/src/modules/marketplace/marketplace-categories.service.ts` (adapter - OK)
- `backend/src/modules/marketplace/product-category.repository.ts` (legado - remover)
- `frontend/src/api/marketplace.ts` (legado - migrar)

**Ação:** 
1. Migrar dados de catalog_categories para categories core
2. Remover product-category.repository.ts
3. Atualizar marketplace.ts para usar categories core

---

### Busca

**Status:** ✅ Usa categories core  
**Arquivos:** `backend/src/core/categories/categories.service.ts` (autocomplete, search)  
**Ação:** Nenhuma. Já canônico.

---

### IA / Autocomplete

**Status:** ✅ Usa categories core  
**Arquivos:** `backend/src/core/categories/categories.service.ts` (suggestCategoryPath, createCategoryWithAI)  
**Ação:** Nenhuma. Já canônico.

---

## RESUMO EXECUTIVO

**Árvore Canônica:** `categories` (core)  
**Adapters mantidos:** 3 (marketplace-categories service, marketplace-categories API, groups categories API)  
**Legados para remoção:** 2 (catalog_categories table, catalog categories API)  
**Domínios especiais:** 1 (health_taxonomies - migração futura)

**Módulos já canônicos:** Perfil Profissional, Eventos, Jobs, Busca, IA  
**Módulos com adapters:** Marketplace (parcial), Grupos (verificar)  
**Módulos com legado:** Marketplace (parcial)  
**Módulos com domínio especial:** Saúde (temporário)

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CATEGORY_TREE_MAPPING.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- CATEGORY_TREE_ARCHITECTURAL_CLOSURE.md
<!-- AUTO-GENERATED-END -->