// src/core/social/ports/actor-repository.port.ts
/**
 * Port: Actor Repository
 * 
 * Interface para repository de actors.
 * Implementação real está em @modules/social
 * 
 * Ver: ARCHITECTURAL_SOURCE_OF_TRUTH.md
 */

import type { ActorTypeDb } from '../actor-type';

export interface ActorRow {
  actor_id: string;
  tenant_id: string;
  actor_type: ActorTypeDb;
  user_id: string | null;
  company_id: string | null;
  group_id: string | null;
  display_name: string;
  /** Âncora humana (FK actors.id); ver §4.8 */
  responsible_actor_id: string | null;
  slug: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  metadata: any;
  created_at: string | Date;
  updated_at: string | Date;
}

/**
 * Cliente transacional MÍNIMO (estrutural) — um `PoolClient` (pg) o satisfaz sem
 * que o port (core) precise importar `pg`. Usado pelas variantes `*Tx` que compõem
 * a escrita de actor dentro de uma transação aberta pelo caller (ex.: nascimento PJ
 * transacional, F-ATOMIC-COMPANY-BIRTH / DECISION-0075 §9.2). O caller é dono do
 * BEGIN/COMMIT e do tenant context; estas variantes NUNCA abrem/fecham transação.
 */
export interface TxQueryClient {
  query(queryText: string, values?: any[]): Promise<{ rows: any[]; rowCount: number | null }>;
}

export interface ActorRepositoryPort {
  findById(tenantId: string, actorId: string): Promise<ActorRow | null>;
  findByUserId(tenantId: string, userId: string): Promise<ActorRow | null>;
  findByCompanyId(tenantId: string, companyId: string): Promise<ActorRow | null>;
  findOrCreateUserActor(tenantId: string, userId: string): Promise<ActorRow>;
  findOrCreatePageActor(
    tenantId: string,
    companyId: string,
    responsibleActorId: string
  ): Promise<ActorRow>;
  /**
   * Variante client-aware/transacional de `findOrCreatePageActor`: usa o `client` da
   * transação do caller (mesma tx → atomicidade do núcleo company+company_users+page-actor).
   * NÃO abre/commita transação. Assume tenant context já ativo no `client` (RLS de `actors`).
   * Espelha o molde transacional de `findOrCreateGroupActor`.
   */
  findOrCreatePageActorTx(
    client: TxQueryClient,
    tenantId: string,
    companyId: string,
    responsibleActorId: string
  ): Promise<ActorRow>;
  findOrCreateGroupActor(tenantId: string, groupId: string): Promise<ActorRow>;
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






