// backend/src/modules/organization/organization-unit.service.ts
// SPRINT 51: Service para unidades organizacionais

import { organizationUnitRepository } from './organization-unit.repository';
import type {
  OrganizationUnit,
  CreateOrganizationUnitInput,
  UpdateOrganizationUnitInput,
  OrganizationUnitTree,
} from './organization.types';

/**
 * Service para gerenciar unidades organizacionais
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Operação continua por actor
 * - Consolidação é leitura
 * - Não mistura dados sem permissão
 */
class OrganizationUnitService {
  /**
   * Cria unidade organizacional
   */
  async createUnit(
    tenantId: string,
    input: CreateOrganizationUnitInput
  ): Promise<OrganizationUnit> {
    return await organizationUnitRepository.createUnit(tenantId, input);
  }

  /**
   * Atualiza unidade organizacional
   */
  async updateUnit(
    tenantId: string,
    unitId: string,
    input: UpdateOrganizationUnitInput
  ): Promise<OrganizationUnit> {
    return await organizationUnitRepository.updateUnit(tenantId, unitId, input);
  }

  /**
   * Busca unidade por ID
   */
  async getUnitById(
    tenantId: string,
    unitId: string
  ): Promise<OrganizationUnit | null> {
    return await organizationUnitRepository.getUnitById(tenantId, unitId);
  }

  /**
   * Lista unidades organizacionais
   */
  async listUnits(
    tenantId: string,
    parentId?: string | null,
    type?: 'MATRIX' | 'BRANCH' | 'DC'
  ): Promise<OrganizationUnit[]> {
    return await organizationUnitRepository.listUnits(tenantId, parentId, type);
  }

  /**
   * Busca unidades filhas
   */
  async getChildren(
    tenantId: string,
    parentId: string
  ): Promise<OrganizationUnit[]> {
    return await organizationUnitRepository.getChildren(tenantId, parentId);
  }

  /**
   * Busca todas as unidades descendentes (recursivo)
   */
  async getDescendants(
    tenantId: string,
    parentId: string
  ): Promise<OrganizationUnit[]> {
    return await organizationUnitRepository.getDescendants(tenantId, parentId);
  }

  /**
   * Busca unidade por actor
   */
  async getUnitByActor(
    tenantId: string,
    actorId: string
  ): Promise<OrganizationUnit | null> {
    return await organizationUnitRepository.getUnitByActor(tenantId, actorId);
  }

  /**
   * Obtém árvore de unidades (com children)
   */
  async getUnitTree(
    tenantId: string,
    rootId?: string
  ): Promise<OrganizationUnitTree[]> {
    // Se rootId não fornecido, buscar matriz (parent_id IS NULL)
    const roots = rootId
      ? [await organizationUnitRepository.getUnitById(tenantId, rootId)]
      : await organizationUnitRepository.listUnits(tenantId, null);

    const buildTree = async (unit: OrganizationUnit | null): Promise<OrganizationUnitTree | null> => {
      if (!unit) return null;

      const children = await organizationUnitRepository.getChildren(tenantId, unit.id);
      const childrenTree = await Promise.all(
        children.map((child) => buildTree(child))
      );

      return {
        ...unit,
        children: childrenTree.filter((c) => c !== null) as OrganizationUnitTree[],
      };
    };

    const trees = await Promise.all(
      roots.map((root) => buildTree(root))
    );

    return trees.filter((t) => t !== null) as OrganizationUnitTree[];
  }
}

export const organizationUnitService = new OrganizationUnitService();







