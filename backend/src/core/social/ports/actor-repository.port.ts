// src/core/social/ports/actor-repository.port.ts
/**
 * Port: Actor Repository
 * 
 * Interface para repository de actors.
 * Implementação real está em @modules/social
 * 
 * Ver: ARCHITECTURAL_SOURCE_OF_TRUTH.md
 */

export interface ActorRow {
  actor_id: string;
  tenant_id: string;
  actor_type: 'user' | 'page' | 'group' | 'channel';
  user_id: string | null;
  company_id: string | null;
  group_id: string | null;
  display_name: string;
  slug: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface ActorRepositoryPort {
  findById(tenantId: string, actorId: string): Promise<ActorRow | null>;
  findByUserId(tenantId: string, userId: string): Promise<ActorRow | null>;
  findByCompanyId(tenantId: string, companyId: string): Promise<ActorRow | null>;
  findOrCreateUserActor(tenantId: string, userId: string): Promise<ActorRow>;
  findOrCreatePageActor(tenantId: string, companyId: string): Promise<ActorRow>;
  updateUserActorDisplayName(tenantId: string, userId: string, displayName: string): Promise<ActorRow | null>;
  update(
    tenantId: string,
    actorId: string,
    updates: {
      display_name?: string;
      avatar_url?: string;
      cover_url?: string;
      bio?: string;
      metadata?: any;
    }
  ): Promise<ActorRow>;
  findAvailableActors(
    tenantId: string,
    userId: string
  ): Promise<Array<ActorRow & { user_role?: string; can_post?: boolean; company_status?: string }>>;
}





