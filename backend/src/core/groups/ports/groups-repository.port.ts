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
  
  isUserAdminOrOwner(
    tenantId: string,
    groupId: string,
    userId: string
  ): Promise<boolean>;
}





