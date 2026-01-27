# SPRINT 51: MULTI-EMPRESA, FILIAIS E CONSOLIDAÇÃO

## RESUMO EXECUTIVO

Implementado sistema multi-empresa com filiais e consolidação:
- ✅ Tabela `organization_units` para matriz, filiais e centros de distribuição
- ✅ Associação de `actors` com `organization_unit_id`
- ✅ Consolidação de dados em relatórios (leitura)
- ✅ Permissão `view_consolidated_reports` para controle de acesso
- ✅ UI com filtros de unidade e opção consolidada

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/migrations/186_create_organization_units.sql`** (NOVO)
   - Tabela `organization_units`
   - Enums: `organization_unit_type` (MATRIX, BRANCH, DC)
   - Campos: `id`, `tenant_id`, `name`, `type`, `parent_id`, `metadata`, `created_at`, `updated_at`
   - Adiciona `organization_unit_id` a `actors`
   - RLS e índices

2. **`backend/src/modules/organization/organization.types.ts`** (NOVO)
   - Tipos TypeScript para unidades organizacionais
   - `OrganizationUnitType`, `OrganizationUnit`, `CreateOrganizationUnitInput`, `UpdateOrganizationUnitInput`, `OrganizationUnitTree`, `ConsolidationScope`

3. **`backend/src/modules/organization/organization-unit.repository.ts`** (NOVO)
   - Repository para unidades organizacionais
   - Métodos: `createUnit`, `updateUnit`, `getUnitById`, `listUnits`, `getChildren`, `getDescendants`, `getUnitByActor`

4. **`backend/src/modules/organization/organization-unit.service.ts`** (NOVO)
   - Service para gerenciar unidades organizacionais
   - Métodos: `createUnit`, `updateUnit`, `getUnitById`, `listUnits`, `getChildren`, `getDescendants`, `getUnitByActor`, `getUnitTree`

5. **`backend/src/modules/organization/consolidation-helper.ts`** (NOVO)
   - Helper para resolução de escopo de consolidação
   - `resolveConsolidationScope()`: Resolve escopo baseado em unidade do actor e permissão
   - `resolveActorIdsByScope()`: Resolve lista de actor IDs baseado no escopo

6. **`backend/src/modules/organization/organization.routes.ts`** (NOVO)
   - Rotas REST:
     - `GET /organization/units` - Lista unidades
     - `GET /organization/units/tree` - Obtém árvore
     - `GET /organization/units/:id` - Busca por ID
     - `GET /organization/units/:id/children` - Busca filhas
     - `GET /organization/units/:id/descendants` - Busca descendentes
     - `GET /organization/units/actor/:actorId` - Busca por actor
     - `POST /organization/units` - Cria unidade
     - `PATCH /organization/units/:id` - Atualiza unidade

7. **`backend/src/modules/reports/sales-report.types.ts`** (ALTERADO)
   - Adicionado `organizationUnitId` e `consolidated` em `SalesReportFilters`

8. **`backend/src/modules/reports/sales-report.service.ts`** (ALTERADO)
   - Integração com `consolidation-helper`
   - Suporte a `scopeActorIds` para filtro de consolidação
   - Métodos atualizados: `generateReport`, `getSummary`, `getSalesByPeriod`, `getSalesByChannel`, `getSalesByActor`, `getAverageTicketByPeriod`

9. **`backend/src/modules/reports/reports.routes.ts`** (ALTERADO)
   - Adicionado suporte a `organizationUnitId` e `consolidated` em `/reports/sales`

10. **`MAPA_CANONICO_PERMISSIONS_v1.md`** (ALTERADO)
    - Adicionado domínio `reports`
    - Adicionada permissão `view_consolidated_reports`
    - Versão atualizada para v1.2

11. **`backend/src/core/authorization/permission-keys.ts`** (ALTERADO)
    - Adicionada permissão `view_consolidated_reports`
    - Versão atualizada para v1.2

12. **`backend/src/server.ts`** (ALTERADO)
    - Registrado módulo de organização em `/organization`

### Frontend

13. **`frontend/src/api/organization.ts`** (NOVO)
    - API client para unidades organizacionais
    - Funções: `listOrganizationUnits`, `getOrganizationUnitTree`, `getOrganizationUnitById`, `getOrganizationUnitByActor`

14. **`frontend/src/pages/DashboardPage.tsx`** (ALTERADO)
    - Filtro de unidade organizacional
    - Checkbox "Consolidado"
    - Carregamento de unidades

15. **`frontend/src/pages/DashboardPage.css`** (ALTERADO)
    - Estilos para filtros de unidade

16. **`frontend/src/api/dashboard.ts`** (ALTERADO)
    - Adicionado `organizationUnitId` e `consolidated` em `DashboardFilters`

## REGRAS ARQUITETURAIS

### ✅ Não Mistura Dados Sem Permissão

- Sem `view_consolidated_reports`: usuário só vê própria unidade
- Com `view_consolidated_reports`: pode ver consolidado (parent + children)
- Verificação explícita via `authorizationService.canActAs()`

### ✅ Consolidação é Leitura

- Apenas consolida dados em relatórios
- Não executa economia
- Não altera operações

### ✅ Operação Continua por Actor

- Actors continuam operando normalmente
- Associação com unidade é opcional
- Operação não depende de unidade

## MODELO ORGANIZACIONAL

### Tabela `organization_units`

```sql
CREATE TABLE organization_units (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  type organization_unit_type NOT NULL, -- MATRIX | BRANCH | DC
  parent_id UUID REFERENCES organization_units(id),
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Associação com Actors

```sql
ALTER TABLE actors
ADD COLUMN organization_unit_id UUID REFERENCES organization_units(id);
```

### Hierarquia

- **MATRIX**: Unidade raiz (parent_id = NULL)
- **BRANCH**: Filial (parent_id = matriz ou outra filial)
- **DC**: Centro de distribuição (parent_id = matriz ou filial)

## CONSOLIDAÇÃO

### Fluxo de Consolidação

1. **Resolver Escopo**
   ```typescript
   const scope = await resolveConsolidationScope(tenantId, userId, actorId, {
     organizationUnitId: filters.organizationUnitId,
     consolidated: filters.consolidated,
   });
   ```

2. **Verificar Permissão**
   - Se não tem `view_consolidated_reports`: escopo = própria unidade
   - Se tem permissão: escopo pode incluir children

3. **Resolver Actor IDs**
   ```typescript
   const actorIds = await resolveActorIdsByScope(tenantId, scope);
   ```

4. **Aplicar Filtro**
   - Queries SQL filtram por `actor_id = ANY(actorIds)`

### Exemplo de Query Consolidada

```sql
SELECT ...
FROM orders o
WHERE o.tenant_id = $1
  AND o.seller_actor_id = ANY($2::uuid[]) -- Lista de actors do escopo
```

## PERMISSÕES

### `view_consolidated_reports`

**Domínio:** reports  
**Capability requerida:** null (atribuição manual)  
**Aplica a:**
- `GET /reports/sales?consolidated=true`
- `GET /reports/inventory?consolidated=true`
- `GET /reports/financial?consolidated=true`
- `GET /dashboard/overview?consolidated=true`

**Quem pode ter:**
- Usuários com permissão explícita (atribuição manual)
- Usuários da matriz (se configurado)

**Comportamento:**
- Sem permissão: só vê dados da própria unidade
- Com permissão: pode ver dados consolidados (matriz + filiais)

## ENDPOINTS

### GET /organization/units

Lista unidades organizacionais.

**Query params:**
- `parentId`: ID da unidade pai (ou 'null' para matriz)
- `type`: Tipo de unidade (MATRIX, BRANCH, DC)

**Response:**
```json
{
  "units": [
    {
      "id": "uuid",
      "name": "Matriz São Paulo",
      "type": "MATRIX",
      "parentId": null
    }
  ]
}
```

### GET /organization/units/tree

Obtém árvore de unidades.

**Query params:**
- `rootId`: ID da raiz (opcional, default: matriz)

**Response:**
```json
{
  "tree": [
    {
      "id": "uuid",
      "name": "Matriz",
      "type": "MATRIX",
      "children": [
        {
          "id": "uuid",
          "name": "Filial Rio",
          "type": "BRANCH"
        }
      ]
    }
  ]
}
```

### GET /reports/sales

Relatório de vendas com suporte a consolidação.

**Query params:**
- `organizationUnitId`: ID da unidade (opcional)
- `consolidated`: true/false (opcional)

**Comportamento:**
- Sem `consolidated`: mostra apenas unidade especificada (ou própria unidade)
- Com `consolidated=true` e permissão: mostra unidade + filiais

## FRONTEND

### Dashboard com Filtros

- **Filtro de Unidade**: Dropdown com todas as unidades
- **Checkbox Consolidado**: Ativa consolidação (se permitido)
- Filtros aplicados automaticamente ao carregar dashboard

### Fluxo de Uso

1. Usuário seleciona unidade no dropdown
2. Usuário marca "Consolidado" (se tiver permissão)
3. Dashboard carrega dados filtrados/consolidados
4. Se não tiver permissão, checkbox pode estar desabilitado (não implementado ainda)

## INTEGRAÇÕES

### Sales Report

```typescript
// reports.routes.ts
const filters: SalesReportFilters = {
  organizationUnitId: query.organizationUnitId,
  consolidated: query.consolidated === 'true',
};

const report = await salesReportService.generateReport(tenantId, {
  ...filters,
  userId: actionContext?.actingUserId,
  actorId: actionContext?.actingActorId,
});
```

### Consolidation Helper

```typescript
// consolidation-helper.ts
const scope = await resolveConsolidationScope(tenantId, userId, actorId, {
  organizationUnitId: filters.organizationUnitId,
  consolidated: filters.consolidated,
});

const actorIds = await resolveActorIdsByScope(tenantId, scope);
// actorIds = lista de actors do escopo (própria unidade ou consolidado)
```

## OBSERVAÇÕES

1. **Filial opera isolada**: Sem permissão, só vê própria unidade
2. **Matriz enxerga tudo**: Com permissão, pode ver consolidado
3. **Nenhum vazamento de dados**: Verificação explícita de permissão
4. **Operação continua por actor**: Actors não dependem de unidade para operar
5. **Consolidação é leitura**: Não executa economia, apenas consolida dados

## PRÓXIMOS PASSOS

- [ ] Integrar consolidação em relatórios de inventory e financial
- [ ] Integrar consolidação em dashboard service
- [ ] Adicionar UI para gerenciar unidades organizacionais
- [ ] Adicionar UI para associar actors a unidades
- [ ] Adicionar validação de permissão no frontend (desabilitar checkbox se não tiver permissão)





