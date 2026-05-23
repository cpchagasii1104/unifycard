/**
 * Gate §4.9 rides: delega em `authorityService` (fachada modules) antes da lógica de negócio.
 * RBAC (`requirePermission`) permanece nos handlers; aqui só a resolução canónica + quarentena.
 */
import type { FastifyRequest } from 'fastify';
import type { PermissionKey } from '@core/authorization/permission-keys';
import { HttpError } from '@core/errors/http-error';
import { authorityService } from '@modules/authority/authority.service';
import { ensureUserActor } from '@modules/identity/actor-writer.service';

type ReqWithActor = FastifyRequest & { actionContext?: { actorId?: string } };

export async function assertRideAuthority(
  req: FastifyRequest,
  tenantId: string,
  userId: string,
  permissionKey: PermissionKey,
  resourceId?: string
): Promise<void> {
  const ctxActor = (req as ReqWithActor).actionContext?.actorId;
  const actorId = ctxActor
    ? ctxActor
    : (await ensureUserActor(tenantId, userId)).actor_id;

  const auth = await authorityService.canPerformAction(
    actorId,
    permissionKey,
    resourceId,
    { tenantId, userId }
  );
  if (!auth.allowed) {
    throw HttpError.forbidden(auth.reason || 'authority: permission denied');
  }
}