/**
 * Fachada única de authority para `src/modules/*` — §4.9 LEI / SSOT §5.16.
 *
 * Toda decisão canónica de "utilizador U pode atuar como actor A com permissão P"
 * nos módulos de produto deve passar por aqui (não importar `authorizationService` diretamente).
 *
 * - Gate de quarentena: `isActorEffectivelyBlocked` (§4.8.4) antes da resolução canónica.
 * - Resolução: delega em `authorizationService.canActAs` (core) — sem duplicar regras.
 */
import { authorizationService } from '@core/authorization/authorization.service';
import type { AuthorizationResult } from '@core/authorization/authorization.service';
import type { PermissionKey } from '@core/authorization/permission-keys';
import { isActorEffectivelyBlocked } from '../risk-identity/actor-effective-block';

export type { AuthorizationResult } from '@core/authorization/authorization.service';
export type { AuthoritySource } from '@core/authorization/authorization.service';

export type AuthorityActionContext = {
  tenantId: string;
  userId: string;
  /** Pass-through para shadow / logging no core (mesmo contrato que canActAs) */
  scope?: string;
};

class AuthorityService {
  /**
   * Utilizador `context.userId` pode executar `permissionKey` atuando como `actorId`?
   * `resource` reservado para extensão futura (tracing); não altera decisão face ao core hoje.
   */
  async canPerformAction(
    actorId: string,
    permissionKey: PermissionKey,
    _resource: string | undefined,
    context: AuthorityActionContext
  ): Promise<AuthorizationResult> {
    const blocked = await isActorEffectivelyBlocked(context.tenantId, actorId);
    if (blocked) {
      return {
        allowed: false,
        reason: 'Actor effectively blocked (quarantine / cascata §4.8.4)',
      };
    }

    return authorizationService.canActAs(
      context.tenantId,
      context.userId,
      actorId,
      permissionKey,
      context.scope
    );
  }

  /**
   * Sinónimo explícito §4.9: utilizador atua em nome do actor alvo.
   * `actorId` (primeiro parâmetro) ignorado na resolução actual — usar só se no futuro validar contexto intermédio.
   * Hoje: equivalente a `canPerformAction(targetActorId, permissionKey, undefined, { ... })`.
   */
  async canActOnBehalf(
    _actorId: string,
    targetActorId: string,
    context: AuthorityActionContext & { permissionKey: PermissionKey }
  ): Promise<AuthorizationResult> {
    const { permissionKey, tenantId, userId, scope } = context;
    return this.canPerformAction(targetActorId, permissionKey, undefined, {
      tenantId,
      userId,
      scope,
    });
  }
}

export const authorityService = new AuthorityService();