// availability-owner-authority.ts
// DECISION-0118 D2 — resolução POLIMÓRFICA de autoridade sobre o owner temporal.
//
// Na Unified Availability, (owner_type, owner_id) identificam o RECURSO
// proprietário da janela — NÃO o actor autorizado (resource owner ≠ authority
// actor). Este é o PRIMITIVO CENTRAL da família temporal: cada owner_type tem
// uma POLICY que (1) prova que o recurso EXISTE no tenant e pertence ao tipo
// declarado e (2) deriva o AUTHORITY ACTOR material do schema vivo. A
// autorização final é sempre canRepresentActor(req.user.userId, authorityActor)
// server-side — actionContext.actorId segue HINT/autoria (DECISION-0113) e é
// comparado ao authority actor RESOLVIDO, nunca ao owner_id cru.
//
// PROIBIDO aqui e nos callers: tratar owner_id como actor sem resolver o tipo;
// `as never`; fallback para actor do cliente; cura de actor (zero ensureUserActor).
// Owner type novo SÓ entra com policy material + norma + CHECK físico
// (migration 20260612110000) + enum — o gate temporal compara os três.

import { runQueryWithTenant } from '../database/pool';
import { authorizationService } from '../authorization/authorization.service';
import { AvailabilityOwnerType } from './unified-availability.types';

export class AvailabilityOwnerAuthorityError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'AvailabilityOwnerAuthorityError';
  }
}

export interface ResolvedAvailabilityOwner {
  ownerType: AvailabilityOwnerType;
  ownerId: string;
  /** Actor que GOVERNA o recurso temporal (derivado do schema vivo, nunca do cliente). */
  authorityActorId: string;
}

type OwnerPolicy = (tenantId: string, ownerId: string) => Promise<string | null>;

async function actorOfType(tenantId: string, actorId: string, actorType: 'user' | 'page'): Promise<string | null> {
  // 🔴 F-RLS-TENANT-CONTEXT-FIX: actors tem RLS+FORCE — tenant-context obrigatório (sob unificard_app
  // pool.query cru retornaria 0 linhas). runQueryWithTenant seta app.current_tenant.
  const r = await runQueryWithTenant<{ id: string }>(
    tenantId,
    `SELECT id::text AS id FROM actors
      WHERE id = $1::uuid AND tenant_id = $2::uuid AND actor_type = $3
      LIMIT 1`,
    [actorId, tenantId, actorType]
  );
  return r?.id ?? null;
}

/**
 * POLICIES por owner_type — relação material de autoridade do schema vivo.
 * Retornam o authorityActorId ou null (recurso inexistente/tipo incompatível).
 * Cobertura OBRIGATORIAMENTE igual ao enum AvailabilityOwnerType (gate vigia).
 */
const OWNER_AUTHORITY_POLICIES: Record<AvailabilityOwnerType, OwnerPolicy> = {
  // user: o recurso É o próprio actor humano.
  [AvailabilityOwnerType.USER]: (tenantId, ownerId) => actorOfType(tenantId, ownerId, 'user'),

  // page: o recurso É o próprio page actor.
  [AvailabilityOwnerType.PAGE]: (tenantId, ownerId) => actorOfType(tenantId, ownerId, 'page'),

  // service: services.actor_id é o dono material do serviço.
  [AvailabilityOwnerType.SERVICE]: async (tenantId, ownerId) => {
    const r = await runQueryWithTenant<{ actor_id: string | null }>(
      tenantId,
      `SELECT actor_id::text AS actor_id FROM services
        WHERE service_id = $1::uuid AND tenant_id = $2::uuid
        LIMIT 1`,
      [ownerId, tenantId]
    );
    return r?.actor_id ?? null;
  },

  // service_offering: provider_actor_id é o prestador dono da oferta (DECISION-0117 D).
  [AvailabilityOwnerType.SERVICE_OFFERING]: async (tenantId, ownerId) => {
    const r = await runQueryWithTenant<{ provider_actor_id: string | null }>(
      tenantId,
      `SELECT provider_actor_id::text AS provider_actor_id FROM service_offerings
        WHERE id = $1::uuid AND tenant_id = $2::uuid
        LIMIT 1`,
      [ownerId, tenantId]
    );
    return r?.provider_actor_id ?? null;
  },

  // event: events.actor_id é o organizador material.
  [AvailabilityOwnerType.EVENT]: async (tenantId, ownerId) => {
    const r = await runQueryWithTenant<{ actor_id: string | null }>(
      tenantId,
      `SELECT actor_id::text AS actor_id FROM events
        WHERE id = $1::uuid AND tenant_id = $2::uuid
        LIMIT 1`,
      [ownerId, tenantId]
    );
    return r?.actor_id ?? null;
  },

  // group: owner_actor_id é o dono material do grupo (fallback actor_id criador).
  [AvailabilityOwnerType.GROUP]: async (tenantId, ownerId) => {
    const r = await runQueryWithTenant<{ authority: string | null }>(
      tenantId,
      `SELECT COALESCE(owner_actor_id, actor_id)::text AS authority FROM groups
        WHERE id = $1::uuid AND tenant_id = $2::uuid
        LIMIT 1`,
      [ownerId, tenantId]
    );
    return r?.authority ?? null;
  },
};

/**
 * Resolve o AUTHORITY ACTOR do recurso temporal (sem autorizar ainda).
 * 404 fail-closed se o recurso não existe no tenant OU o owner_id não pertence
 * ao tipo declarado (UUID coincidente de outro tipo NUNCA autoriza).
 */
export async function resolveAvailabilityOwner(
  tenantId: string,
  ownerType: string,
  ownerId: string
): Promise<ResolvedAvailabilityOwner> {
  const policy = OWNER_AUTHORITY_POLICIES[ownerType as AvailabilityOwnerType];
  if (!policy) {
    throw new AvailabilityOwnerAuthorityError(400, 'AVAILABILITY_OWNER_TYPE_UNKNOWN',
      `owner_type '${ownerType}' fora do vocabulário canônico (sem policy de autoridade).`);
  }
  let authorityActorId: string | null = null;
  try {
    authorityActorId = await policy(tenantId, ownerId);
  } catch {
    authorityActorId = null; // fail-closed
  }
  if (!authorityActorId) {
    throw new AvailabilityOwnerAuthorityError(404, 'AVAILABILITY_OWNER_NOT_FOUND',
      `Recurso owner (${ownerType}) inexistente neste tenant ou owner_id incompatível com o tipo declarado.`);
  }
  return { ownerType: ownerType as AvailabilityOwnerType, ownerId, authorityActorId };
}

/**
 * Primitivo central de AUTORIDADE: resolve o recurso e prova server-side que o
 * sujeito autenticado pode representar o authority actor (canRepresentActor).
 * 404 recurso/tipo · 403 sem autoridade. Nunca cria actor; nunca confia em
 * actorId declarado pelo cliente.
 */
export async function resolveAvailabilityOwnerAuthority(input: {
  tenantId: string;
  userId: string;
  ownerType: string;
  ownerId: string;
}): Promise<ResolvedAvailabilityOwner> {
  const owner = await resolveAvailabilityOwner(input.tenantId, input.ownerType, input.ownerId);
  let canRep = false;
  try {
    canRep = await authorizationService.canRepresentActor(input.tenantId, input.userId, owner.authorityActorId);
  } catch {
    canRep = false; // fail-closed
  }
  if (!canRep) {
    throw new AvailabilityOwnerAuthorityError(403, 'AVAILABILITY_OWNER_NOT_REPRESENTABLE',
      'Sem autoridade sobre o recurso owner desta availability (authority actor não representável).');
  }
  return owner;
}
