// backend/src/modules/marketplace/group.types.ts
// SPRINT 74: GROUPS, INDICAÇÕES E COMISSÕES

/**
 * Grupo organizacional
 */
export interface Group {
  id: string;
  tenantId: string;
  name: string;
  parentGroupId: string | null;
  createdByActorId: string;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

/**
 * Input para criar grupo
 */
export interface CreateGroupInput {
  name: string;
  parentGroupId?: string;
  metadata?: Record<string, any>;
}

/**
 * Filtros para listar grupos
 */
export interface GroupFilters {
  parentGroupId?: string;
  limit?: number;
  offset?: number;
}






