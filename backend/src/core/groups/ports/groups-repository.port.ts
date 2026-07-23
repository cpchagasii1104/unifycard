// src/core/groups/ports/groups-repository.port.ts
/**
 * Port: Groups Repository
 * 
 * Interface para repository de grupos.
 * Implementação real está em @modules/groups
 * 
 * Ver: ARCHITECTURAL_SOURCE_OF_TRUTH.md
 */

export interface Group {
  groupId: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string;
  audienceDescription?: string;
  categoryId?: string;
  visibility: 'public' | 'private' | 'secret';
  scope: 'national' | 'state' | 'city' | 'neighborhood';
  countryId?: string;
  stateId?: string;
  cityId?: string;
  neighborhood?: string;
  avatarUrl?: string;
  coverUrl?: string;
  rulesText?: string;
  financialPurpose?: string;
  ownerActorId: string;
  isActive: boolean;
  profitPercentage?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupsRepositoryPort {
  findById(
    tenantId: string,
    groupId: string
  ): Promise<Group | null>;

  /**
   * D9.2-B (DECISION-0188 D10/D11/D16): autoridade de gestao do grupo =
   * canRepresentActor(group-actor | owner-actor). Substitui o antigo check por
   * role em group_members (role NUNCA e autoridade — retirado no cutover).
   */
  userCanGovernGroup(
    tenantId: string,
    groupId: string,
    userId: string
  ): Promise<boolean>;
}





