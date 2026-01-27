// backend/src/modules/organization/consolidation-helper.ts
// SPRINT 51: Helper para resolução de escopo de consolidação

import { organizationUnitService } from './organization-unit.service';
import { authorizationService } from '@core/authorization/authorization.service';
import type { ConsolidationScope } from './organization.types';

/**
 * Resolve escopo de consolidação baseado em:
 * - Unidade organizacional do actor
 * - Permissão view_consolidated_reports
 * - Parâmetros de filtro
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Sem permissão: só vê própria unidade
 * - Com permissão: pode ver consolidado (parent + children)
 * - Consolidação é leitura (não executa economia)
 */
export async function resolveConsolidationScope(
  tenantId: string,
  userId: string,
  actorId: string,
  filters: {
    organizationUnitId?: string;
    consolidated?: boolean;
  }
): Promise<ConsolidationScope> {
  // 1. Buscar unidade do actor
  const actorUnit = await organizationUnitService.getUnitByActor(tenantId, actorId);

  // 2. Se actor não tem unidade, retornar escopo vazio (sem filtro)
  if (!actorUnit) {
    return {
      unitId: filters.organizationUnitId || undefined,
      includeChildren: filters.consolidated || false,
      consolidated: filters.consolidated || false,
    };
  }

  // 3. Verificar permissão de consolidação
  const authResult = await authorizationService.canActAs(
    tenantId,
    userId,
    actorId,
    'view_consolidated_reports'
  );

  // 4. Se não tem permissão, forçar escopo para própria unidade
  if (!authResult.allowed) {
    return {
      unitId: actorUnit.id,
      includeChildren: false,
      consolidated: false,
    };
  }

  // 5. Se tem permissão e filtro especifica unidade, usar filtro
  if (filters.organizationUnitId) {
    return {
      unitId: filters.organizationUnitId,
      includeChildren: filters.consolidated || false,
      consolidated: filters.consolidated || false,
    };
  }

  // 6. Se tem permissão e consolidated=true, consolidar a partir da unidade do actor
  if (filters.consolidated) {
    return {
      unitId: actorUnit.id,
      includeChildren: true,
      consolidated: true,
    };
  }

  // 7. Default: própria unidade
  return {
    unitId: actorUnit.id,
    includeChildren: false,
    consolidated: false,
  };
}

/**
 * Resolve lista de actor IDs baseado no escopo de consolidação
 */
export async function resolveActorIdsByScope(
  tenantId: string,
  scope: ConsolidationScope
): Promise<string[]> {
  if (!scope.unitId) {
    // Sem filtro de unidade, retornar vazio (sem filtro)
    return [];
  }

  // Buscar unidade
  const unit = await organizationUnitService.getUnitById(tenantId, scope.unitId);
  if (!unit) {
    return [];
  }

  // Se não incluir children, buscar apenas actors da unidade
  if (!scope.includeChildren) {
    const { runQueriesWithTenant } = await import('@core/database/pool');
    const rows = await runQueriesWithTenant<{ actor_id: string }>(
      tenantId,
      `
      SELECT actor_id
      FROM actors
      WHERE tenant_id = $1 AND organization_unit_id = $2
      `,
      [tenantId, scope.unitId]
    );
    return rows.map((row) => row.actor_id);
  }

  // Se incluir children, buscar actors da unidade + todas as descendentes
  const descendants = await organizationUnitService.getDescendants(tenantId, scope.unitId);
  const allUnitIds = [scope.unitId, ...descendants.map((d) => d.id)];

  const { runQueriesWithTenant } = await import('@core/database/pool');
  const rows = await runQueriesWithTenant<{ actor_id: string }>(
    tenantId,
    `
    SELECT actor_id
    FROM actors
    WHERE tenant_id = $1 AND organization_unit_id = ANY($2::uuid[])
    `,
    [tenantId, allUnitIds]
  );
  return rows.map((row) => row.actor_id);
}

