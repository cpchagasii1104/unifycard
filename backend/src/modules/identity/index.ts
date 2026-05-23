/**
 * Domínio identity (fachada de consumo).
 * - API nova / resolução SSOT operacional: exportada deste pacote.
 * - Serviço global legado (Gate 0): reexportado de `@core/identity`.
 */
export { identityService } from '@core/identity/identity.service';
export type {
  GlobalUser,
  IdentityProfile,
  UpdateGlobalIdentityInput,
} from '@core/identity/identity.types';

export {
  isActorIdInTenant,
  getLocalUserIdByGlobalUserId,
  resolveActorIdForWalletOwner,
} from './actor-ssot.service';

export { ensureUserActor, ensurePageActor } from './actor-writer.service';