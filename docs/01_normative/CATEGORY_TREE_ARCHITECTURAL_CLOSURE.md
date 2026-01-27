# FECHAMENTO ARQUITETURAL DEFINITIVO — SISTEMA DE CATEGORIAS

**Data:** 2024  
**Status:** Normativo — Imutável  
**Fonte:** `CATEGORY_TREE_SCHEMA.md`, `CATEGORY_TREE_CANONICAL_DECISION.md`, `CATEGORY_TREE_MIGRATION_PLAN.md`

---

## 1. ESTADO FINAL DO SISTEMA

### 1.1 Árvore Canônica

**Tabela:** `categories`  
**Localização:** `backend/src/core/categories/`  
**Migração:** `backend/migrations/043_category_core_canonical.sql`  
**Status:** SSOT (Single Source of Truth) — Única fonte de verdade para categorias

**Estrutura:**
- Hierarquia: `parent_id` → `categories.category_id`
- Níveis: `level` (derivado, não fonte)
- Caminho: `path` (array de strings)
- Escopo: `scope` (global, professional, interest, learning, health, education, cause, group, company, event, campaign)
- Localização: `country_code` (opcional)
- Status: `status` (active, inactive, pending_review)
- Busca: `keywords` (array de strings)
- Metadados: `metadata` (JSONB)

**Contextos:**
- Tabela: `category_contexts`
- Relação: `category_id` → `categories.category_id`
- Contexto: `context` (professional, interest, learning, health, education, cause, group, company, event, campaign, marketplace)
- Metadados: `metadata` (JSONB opcional)

### 1.2 Adapters Ativos

**Marketplace Categories:**
- Service: `backend/src/modules/marketplace/marketplace-categories.service.ts`
- API Frontend: `frontend/src/api/marketplace-categories.ts`
- Função: Filtra `categories` por `metadata.marketplace_domain` e `metadata.category_type`
- Status: ADAPTER — mantido para interface específica

**Groups Categories:**
- API Frontend: `frontend/src/api/groups.ts` (função `getGroupCategories`)
- Função: Filtra `categories` por `context='group'`
- Status: ADAPTER — mantido para interface específica

### 1.3 Estruturas Legadas

**Catalog Categories:**
- Tabela: `catalog_categories`
- Status: LEGADO — código migrado para adapter, dados pendentes de migração
- Ação: Migração futura conforme `CATEGORY_TREE_MIGRATION_PLAN.md`

**Health Taxonomies:**
- Tabela: `health_taxonomies`
- Status: DOMÍNIO ESPECIAL — estrutura com campos específicos
- Ação: Estratégia isolada, migração futura conforme `CATEGORY_TREE_MIGRATION_PLAN.md`

### 1.4 Unificação de Busca

**Backend:**
- Endpoint: `/categories/search`
- Parâmetros: `term`, `context` (obrigatório), `countryCode` (opcional), `limit`
- Fonte: `categories` (core) exclusivamente
- Filtros: `status='active'`, `scope`, `country_code`, `category_contexts.context`

**Frontend:**
- API: `frontend/src/api/categories.ts` (função `searchCategories`)
- Parâmetros: `term`, `context` (obrigatório), `limit`
- Fonte: `/categories/search` exclusivamente

**Autocomplete:**
- Backend: `/categories/autocomplete`
- Frontend: `frontend/src/api/categories.ts` (função `autocompleteCategories`)
- Fonte: `categories` (core) exclusivamente

**IA / Sugestões:**
- Backend: `/categories/suggest-path`, `/categories/ai-create`
- Fonte: `categories` (core) exclusivamente

---

## 2. INVARIANTES IMUTÁVEIS

### 2.1 Estrutura

**INVARIANTE 1:** `slug` é imutável após criação.  
**INVARIANTE 2:** `parent_id` define hierarquia. Não pode referenciar si mesmo.  
**INVARIANTE 3:** `level` é derivado de `parent_id`. Não é fonte de verdade.  
**INVARIANTE 4:** `path` é derivado de `parent_id`. Não é fonte de verdade.  
**INVARIANTE 5:** `slug` é único por `country_code` (ou NULL).  
**INVARIANTE 6:** Categoria não depende de módulo.  
**INVARIANTE 7:** Categoria não é criada por contexto. Contexto é filtro, não criador.

### 2.2 Semântica

**INVARIANTE 8:** Se duas coisas significam a mesma atividade, elas apontam para o mesmo `category_id`.  
**INVARIANTE 9:** Categoria existe independente de contexto. Contexto apenas filtra visibilidade.  
**INVARIANTE 10:** `category_contexts` não cria categoria. Apenas adiciona regras contextuais.

### 2.3 Leitura

**INVARIANTE 11:** Toda busca de categorias deve usar `categories` (core) exclusivamente.  
**INVARIANTE 12:** Toda busca de categorias deve especificar `context` obrigatoriamente.  
**INVARIANTE 13:** Toda busca de categorias deve respeitar `status='active'`.  
**INVARIANTE 14:** Toda busca de categorias deve respeitar `scope` e `country_code` quando aplicável.

### 2.4 Escrita

**INVARIANTE 15:** Criação de categoria deve usar `categories` (core) exclusivamente.  
**INVARIANTE 16:** Atualização de categoria não pode alterar `slug`.  
**INVARIANTE 17:** Atualização de `parent_id` recalcula `level` e `path` automaticamente.

---

## 3. PROIBIÇÕES ABSOLUTAS

### 3.1 Estrutura

**PROIBIÇÃO 1:** Não criar tabelas de categorias por módulo.  
**PROIBIÇÃO 2:** Não criar enums de categoria em código.  
**PROIBIÇÃO 3:** Não duplicar categorias por contexto.  
**PROIBIÇÃO 4:** Não criar categorias hardcoded em código.  
**PROIBIÇÃO 5:** Não inferir categoria via texto sem validação contra `categories` (core).

### 3.2 Leitura

**PROIBIÇÃO 6:** Não ler de `catalog_categories` diretamente.  
**PROIBIÇÃO 7:** Não ler de `health_taxonomies` diretamente (exceto módulo health até migração).  
**PROIBIÇÃO 8:** Não buscar categorias sem especificar `context`.  
**PROIBIÇÃO 9:** Não ignorar `status='active'` em buscas.  
**PROIBIÇÃO 10:** Não criar cache de categorias que ignore `status` ou `context`.

### 3.3 Escrita

**PROIBIÇÃO 11:** Não criar categorias sem validar `slug` único por `country_code`.  
**PROIBIÇÃO 12:** Não alterar `slug` de categoria existente.  
**PROIBIÇÃO 13:** Não criar categorias sem especificar `scope`.  
**PROIBIÇÃO 14:** Não criar categorias com `parent_id` que referencia si mesma.

### 3.4 Integração

**PROIBIÇÃO 15:** Não criar foreign keys para tabelas legadas (`catalog_categories`, `health_taxonomies`).  
**PROIBIÇÃO 16:** Não criar novos adapters sem justificativa arquitetural.  
**PROIBIÇÃO 17:** Não expor endpoints de categorias sem `context` obrigatório.

---

## 4. O QUE PODE EVOLUIR

### 4.1 Dados

**EVOLUÇÃO 1:** Adicionar novas categorias em `categories` (core).  
**EVOLUÇÃO 2:** Adicionar novos contextos em `category_contexts`.  
**EVOLUÇÃO 3:** Adicionar novos campos em `metadata` (JSONB).  
**EVOLUÇÃO 4:** Adicionar novos valores em `keywords` (array).  
**EVOLUÇÃO 5:** Atualizar `name`, `description`, `icon`, `color` de categorias existentes.

### 4.2 Funcionalidade

**EVOLUÇÃO 6:** Melhorar algoritmos de busca (fuzzy matching, relevância).  
**EVOLUÇÃO 7:** Adicionar novos filtros de busca (sem quebrar invariantes).  
**EVOLUÇÃO 8:** Adicionar novos endpoints de busca (respeitando invariantes).  
**EVOLUÇÃO 9:** Melhorar algoritmos de IA (sugestão, criação).

### 4.3 Performance

**EVOLUÇÃO 10:** Adicionar índices em `categories` (sem alterar estrutura).  
**EVOLUÇÃO 11:** Otimizar queries de busca (sem alterar invariantes).  
**EVOLUÇÃO 12:** Adicionar cache de leitura (respeitando `status` e `context`).

### 4.4 Adapters

**EVOLUÇÃO 13:** Melhorar lógica de adapters existentes (marketplace, groups).  
**EVOLUÇÃO 14:** Adicionar novos adapters com justificativa arquitetural.

---

## 5. O QUE NÃO PODE EVOLUIR

### 5.1 Estrutura

**IMUTÁVEL 1:** Schema de `categories` (campos obrigatórios, tipos, constraints).  
**IMUTÁVEL 2:** Schema de `category_contexts` (campos obrigatórios, tipos, constraints).  
**IMUTÁVEL 3:** Regra de `slug` imutável.  
**IMUTÁVEL 4:** Regra de `slug` único por `country_code`.  
**IMUTÁVEL 5:** Hierarquia via `parent_id` (não pode mudar para outro mecanismo).

### 5.2 Semântica

**IMUTÁVEL 6:** `categories` (core) como SSOT.  
**IMUTÁVEL 7:** `context` como filtro, não criador.  
**IMUTÁVEL 8:** `level` e `path` como derivados, não fonte de verdade.  
**IMUTÁVEL 9:** Invariante: "Se duas coisas significam a mesma atividade, elas apontam para o mesmo `category_id`".

### 5.3 Contratos

**IMUTÁVEL 10:** Endpoints de busca devem exigir `context` obrigatório.  
**IMUTÁVEL 11:** Endpoints de busca devem retornar apenas `status='active'` por padrão.  
**IMUTÁVEL 12:** Endpoints de busca devem ler de `categories` (core) exclusivamente.

---

## 6. COMO NOVOS MÓDULOS DEVEM USAR CATEGORIAS

### 6.1 Leitura

**REGRAS DE LEITURA:**

1. Usar `categories` (core) exclusivamente via `CategoryRepository` ou `CategoriesService`.
2. Especificar `context` obrigatoriamente em todas as buscas.
3. Respeitar `status='active'` em todas as buscas.
4. Respeitar `scope` e `country_code` quando aplicável.
5. Não criar cache que ignore `status` ou `context`.

**Endpoints Disponíveis:**
- `GET /categories/search?term={term}&context={context}&countryCode={code}&limit={limit}`
- `GET /categories/autocomplete?q={query}&context={context}&countryCode={code}&limit={limit}`
- `GET /categories/tree?context={context}`
- `GET /categories/{id}/children?context={context}`

### 6.2 Escrita

**REGRAS DE ESCRITA:**

1. Criar categorias via `CategoriesService.createCategory()`.
2. Validar `slug` único por `country_code` antes de criar.
3. Especificar `scope` obrigatoriamente.
4. Adicionar `category_contexts` se categoria for específica de contexto.
5. Não alterar `slug` de categoria existente.

**Endpoints Disponíveis:**
- `POST /categories` (com validação de `slug` e `scope`)
- `PUT /categories/{id}` (sem alterar `slug`)

### 6.3 Integração

**REGRAS DE INTEGRAÇÃO:**

1. Armazenar apenas `category_id` em tabelas de módulo.
2. Não criar foreign keys para tabelas legadas.
3. Não criar tabelas de categorias por módulo.
4. Não criar enums de categoria em código.
5. Usar `category_contexts` para filtrar categorias por contexto.

**Exemplo de Tabela de Módulo:**
```sql
CREATE TABLE meu_modulo_items (
    id UUID PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES categories(category_id),
    -- outros campos
);
```

### 6.4 Adapters

**QUANDO CRIAR ADAPTER:**

1. Interface específica de domínio requerida.
2. Transformação de dados necessária (sem duplicar estrutura).
3. Filtros específicos de domínio (via `metadata` ou `category_contexts`).

**REGRAS DE ADAPTER:**

1. Ler de `categories` (core) exclusivamente.
2. Não criar categorias próprias.
3. Não duplicar estrutura de categorias.
4. Documentar justificativa arquitetural.

---

## 7. COMO IA / BUSCA DEVEM CONSUMIR CATEGORIAS

### 7.1 Busca Textual

**REGRAS DE BUSCA:**

1. Usar `/categories/search` exclusivamente.
2. Especificar `context` obrigatoriamente.
3. Respeitar `status='active'` automaticamente.
4. Respeitar `scope` e `country_code` quando aplicável.
5. Buscar em: `name`, `slug`, `description`, `keywords`, `path`.

**Algoritmo de Relevância:**
- Match exato em `name`: prioridade 100
- Match exato em `slug`: prioridade 90
- `name` começa com termo: prioridade 80
- `slug` começa com termo: prioridade 70
- `name` contém termo: prioridade 60
- `description` contém termo: prioridade 50
- `keywords` contém termo: prioridade 40
- `path` contém termo: prioridade 30
- Fuzzy matching (`pg_trgm`): prioridade 10

### 7.2 Autocomplete

**REGRAS DE AUTOCOMPLETE:**

1. Usar `/categories/autocomplete` exclusivamente.
2. Especificar `context` obrigatoriamente.
3. Retornar apenas categorias `status='active'`.
4. Retornar apenas categorias leaf (sem filhos).
5. Retornar `path` completo para exibição.

**Formato de Resposta:**
- `id`: `category_id`
- `name`: nome da categoria
- `slug`: slug da categoria
- `level`: nível hierárquico
- `path`: array de strings (caminho completo)
- `fullPathLabel`: string formatada (ex: "Tecnologia > Programação > JavaScript")

### 7.3 IA / Sugestões

**REGRAS DE IA:**

1. Usar `/categories/suggest-path` para sugerir caminho hierárquico.
2. Usar `/categories/ai-create` para criar categoria via IA.
3. Validar sugestão contra `categories` (core) existentes.
4. Não criar categorias duplicadas.
5. Respeitar `slug` único por `country_code`.

**Fluxo de Criação via IA:**

1. Receber texto do usuário.
2. Chamar `/categories/suggest-path` com `context`.
3. Validar sugestão contra categorias existentes.
4. Se categoria não existir, chamar `/categories/ai-create`.
5. Categoria criada fica com `status='pending_review'` até aprovação.

### 7.4 Classificação de Texto

**REGRAS DE CLASSIFICAÇÃO:**

1. Usar `/categories/search` para classificar texto.
2. Especificar `context` obrigatoriamente.
3. Retornar categorias ordenadas por relevância.
4. Não inferir categoria sem validação contra `categories` (core).

---

## 8. CONDIÇÕES PARA EXECUTAR MIGRAÇÃO FUTURA

### 8.1 Catalog Categories

**PRÉ-REQUISITOS:**

1. Fase 0 (Shadow Read) concluída: ✅ CONCLUÍDA
2. Análise de volume executada
3. Estratégia de resolução de conflitos definida
4. Backup completo realizado
5. Ambiente de staging configurado
6. Rollback plan documentado

**CONDIÇÕES DE EXECUÇÃO:**

1. Nenhum código lê de `catalog_categories` diretamente
2. Todos os adapters funcionam corretamente
3. Validação completa em staging
4. Aprovação de stakeholders
5. Janela de manutenção agendada

**CRITÉRIOS DE ACEITE:**

1. Todos os registros migrados para `categories` (core)
2. Hierarquia preservada (`parent_id` mapeado corretamente)
3. Slugs únicos por país
4. Metadata preservada
5. Tabela de mapeamento populada
6. Validação completa em produção
7. Período de observação (30 dias) sem regressões

**CONDIÇÕES DE DESLIGAMENTO:**

1. Período de observação concluído (30 dias)
2. Validação final aprovada
3. Backup completo realizado
4. Nenhum código referencia `catalog_categories`
5. Tabela renomeada para `catalog_categories_deprecated`
6. Período de rollback (90 dias) antes de DROP

### 8.2 Health Taxonomies

**PRÉ-REQUISITOS:**

1. Migração de `catalog_categories` concluída e estabilizada
2. Análise de impacto completa
3. Estratégia de metadata validada
4. Backup completo realizado
5. Ambiente de staging configurado
6. Rollback plan documentado

**CONDIÇÕES DE EXECUÇÃO:**

1. Estratégia de campos específicos (`category`, `fact_type`) em `metadata` validada
2. Código atualizado para ler de `categories` (core)
3. Remapeamento de `user_health_facts.taxonomy_id` planejado
4. Validação completa em staging
5. Aprovação de stakeholders
6. Janela de manutenção agendada

**CRITÉRIOS DE ACEITE:**

1. Todos os registros migrados para `categories` (core)
2. Campos específicos preservados em `metadata`
3. Foreign keys remapeadas (`user_health_facts.taxonomy_id`)
4. Código atualizado
5. Funcionalidade preservada
6. Validação completa em produção
7. Período de observação (30 dias) sem regressões

**CONDIÇÕES DE DESLIGAMENTO:**

1. Período de observação concluído (30 dias)
2. Validação final aprovada
3. Backup completo realizado
4. Nenhum código referencia `health_taxonomies`
5. Tabela renomeada para `health_taxonomies_deprecated`
6. Período de rollback (90 dias) antes de DROP

### 8.3 Proibições Durante Migração

**PROIBIÇÃO M1:** Não executar migração sem pré-requisitos completos.  
**PROIBIÇÃO M2:** Não executar migração sem backup completo.  
**PROIBIÇÃO M3:** Não executar migração sem validação em staging.  
**PROIBIÇÃO M4:** Não executar migração sem rollback plan.  
**PROIBIÇÃO M5:** Não desligar tabelas legadas sem período de observação.  
**PROIBIÇÃO M6:** Não DROP tabelas legadas sem período de rollback.

---

## 9. DOCUMENTAÇÃO NORMATIVA

**Documentos Obrigatórios:**
- `CATEGORY_TREE_SCHEMA.md` — Schema definitivo
- `CATEGORY_TREE_CANONICAL_DECISION.md` — Decisão canônica
- `CATEGORY_TREE_MIGRATION_PLAN.md` — Plano de migração
- `CATEGORY_TREE_ARCHITECTURAL_CLOSURE.md` — Este documento

**Status:** Todos os documentos são normativos e imutáveis. Alterações requerem processo de governança arquitetural.

---

## 10. CONCLUSÃO

**Estado Final:** Sistema unificado com `categories` (core) como SSOT.  
**Adapters:** Marketplace e Groups mantidos para interface específica.  
**Legados:** `catalog_categories` e `health_taxonomies` aguardando migração futura.  
**Busca:** Unificada via `/categories/search` com `context` obrigatório.  
**Invariantes:** 17 invariantes imutáveis estabelecidos.  
**Proibições:** 17 proibições absolutas estabelecidas.

**Este documento é definitivo e imutável. Alterações requerem processo de governança arquitetural.**

---

**Documento criado em:** 2024  
**Status:** Normativo — Imutável  
**Versão:** 1.0



