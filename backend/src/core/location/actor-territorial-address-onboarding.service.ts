// F-ADDRESS-ONBOARDING-CANONICAL-FLOW (RFC A1-D) — APPLICATION SERVICE ÚNICO do MVP PF/residência.
//
// Orquestra a composição SELADA: autoridade → re-resolução server-side (Fase B) → cross-check da
// confirmação → escrita EXCLUSIVA pela Fase C (setActorTerritorialAddress). NÃO escreve SQL, NÃO chama
// o repository privado da Fase C, NÃO abre idempotência/lock próprios, NÃO cria território, NÃO chama
// provider direto, NÃO decide tenant pelo payload, NÃO aceita role/owner do cliente.
//
// A rota é fina e delega tudo aqui. Erros → códigos públicos estáveis (contrato compartilhado).

import { authorizationService } from '@core/authorization/authorization.service';
import { postalAddressResolverService } from './postal-address-resolver.service';
import {
  setActorTerritorialAddress,
  ActorTerritorialAuthorityError,
  ActorTerritorialConflictError,
  ActorTerritorialValidationError,
  type ActorTerritorialAuthContext,
} from './actor-territorial-address-writer.service';
import { getClientWithTenant } from '@core/database/pool';
import type {
  SetTerritorialAddressCommand,
  TerritorialAddressWriteResult,
  TerritorialAddressErrorCode,
} from '@unificard/contracts';

/** Erro governado com código público estável (o mapper de rota traduz para HTTP). */
export class TerritorialOnboardingError extends Error {
  constructor(public readonly code: TerritorialAddressErrorCode, message?: string) {
    super(message ?? code);
  }
}

/** Contexto server-side: tenant/operador do auth; actorId da ROTA; actorId do action-context (hint). */
export interface OnboardingAuthContext {
  tenantId: string;
  operatorUserId: string;
  routeActorId: string;
  actionContextActorId: string;
}

const MAX_STREET = 160;
const MAX_NUMBER = 24;
const MAX_COMPLEMENT = 120;
const MAX_IDEMPOTENCY_KEY = 200;

/** Sanitiza texto físico do operador: remove controle/markup, colapsa espaços, limita comprimento. */
function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const cleaned = v
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

/** Mapeia o status de falha do resolver da Fase B para o código público estável. */
function mapResolverFailure(status: string): TerritorialAddressErrorCode {
  switch (status) {
    case 'country_required': return 'country_required';
    case 'country_not_supported': return 'country_not_supported';
    case 'postal_code_invalid': return 'postal_code_invalid';
    case 'provider_unavailable': return 'provider_unavailable';
    case 'provider_not_found': return 'provider_not_found';
    case 'provider_conflict': return 'provider_conflict';
    case 'malformed_provider_response': return 'provider_conflict';
    case 'official_identifier_missing': return 'official_identifier_missing';
    case 'official_identifier_conflict': return 'official_identifier_conflict';
    case 'canonical_city_missing': return 'canonical_city_missing';
    case 'canonical_city_ambiguous': return 'canonical_city_ambiguous';
    case 'territorial_inconsistency': return 'territorial_inconsistency';
    default: return 'unexpected_error';
  }
}

export class ActorTerritorialAddressOnboardingService {
  /**
   * MVP PF/residência: valida → autoriza → re-resolve → cross-check → chama SÓ o writer da Fase C.
   * Injeta dependências (resolver/writer/authz) para teste determinístico sem rede/DB.
   */
  constructor(
    private readonly deps: {
      canRepresentActor?: (t: string, u: string, a: string) => Promise<boolean>;
      resolvePostal?: typeof postalAddressResolverService.resolve;
      writeActorTerritorialAddress?: typeof setActorTerritorialAddress;
      isActorPf?: (tenantId: string, actorId: string) => Promise<boolean>;
    } = {},
  ) {}

  private get authz() {
    return this.deps.canRepresentActor ?? ((t: string, u: string, a: string) => authorizationService.canRepresentActor(t, u, a));
  }
  private get resolve() {
    return this.deps.resolvePostal ?? postalAddressResolverService.resolve.bind(postalAddressResolverService);
  }
  private get write() {
    return this.deps.writeActorTerritorialAddress ?? setActorTerritorialAddress;
  }

  /** PF-gate server-side sob RLS: o Actor existe no tenant E é actor_type='user' (PF). Fail-closed. */
  private async assertActorPf(tenantId: string, actorId: string): Promise<void> {
    if (this.deps.isActorPf) {
      if (!(await this.deps.isActorPf(tenantId, actorId))) throw new TerritorialOnboardingError('actor_not_eligible');
      return;
    }
    const client = await getClientWithTenant(tenantId);
    try {
      const r = await client.query<{ actor_type: string }>('SELECT actor_type FROM actors WHERE id = $1', [actorId]);
      if (r.rows.length === 0) throw new TerritorialOnboardingError('actor_not_eligible', 'actor não encontrado no tenant');
      if (r.rows[0].actor_type !== 'user') throw new TerritorialOnboardingError('actor_not_eligible', 'MVP aceita apenas Actor PF (user)');
    } finally {
      client.release();
    }
  }

  async setResidenceAddress(
    auth: OnboardingAuthContext,
    command: SetTerritorialAddressCommand,
  ): Promise<TerritorialAddressWriteResult> {
    // 1. Escopo do MVP: só ACTOR_RESIDENCE (role derivado server-side; nunca do cliente).
    if (command.purpose !== 'ACTOR_RESIDENCE') throw new TerritorialOnboardingError('actor_not_eligible', 'purpose fora do MVP');

    // 2. Coerência actor da ROTA × action-context (hint client-declared). Divergência → fail-closed.
    if (!auth.routeActorId?.trim()) throw new TerritorialOnboardingError('invalid_address_payload', 'actorId da rota ausente');
    if (auth.actionContextActorId !== auth.routeActorId) throw new TerritorialOnboardingError('authority_denied', 'actor da rota ≠ action-context');

    // 3. Autoridade — await DIRETO; erro de infra PROPAGA (nunca vira false/403 silencioso).
    const representable = await this.authz(auth.tenantId, auth.operatorUserId, auth.routeActorId);
    if (!representable) throw new TerritorialOnboardingError('authority_denied');

    // 4. Elegibilidade PF (server-side, RLS).
    await this.assertActorPf(auth.tenantId, auth.routeActorId);

    // 5. Validação do payload físico (número obrigatório; sanitização; sem PII em log).
    const country = typeof command.countryCode === 'string' ? command.countryCode.trim().toUpperCase() : '';
    if (!country) throw new TerritorialOnboardingError('country_required');
    const street = cleanText(command.street, MAX_STREET);
    const number = cleanText(command.number, MAX_NUMBER);
    const complement = command.complement == null ? null : cleanText(command.complement, MAX_COMPLEMENT);
    if (!number) throw new TerritorialOnboardingError('invalid_address_payload', 'número é obrigatório');
    const idempotencyKey = typeof command.idempotencyKey === 'string' ? command.idempotencyKey.trim() : '';
    if (!idempotencyKey || idempotencyKey.length > MAX_IDEMPOTENCY_KEY) {
      throw new TerritorialOnboardingError('invalid_address_payload', 'idempotencyKey inválida');
    }
    if (typeof command.confirmedCityId !== 'string' || !command.confirmedCityId.trim()) {
      throw new TerritorialOnboardingError('invalid_address_payload', 'confirmedCityId obrigatório');
    }

    // 6. RE-RESOLUÇÃO server-side (Fase B) — a AUTORIDADE dos IDs é a re-resolução, nunca o cliente.
    const resolution = await this.resolve({ countryCode: country, postalCode: command.postalCode });
    if (resolution.status !== 'resolved') {
      throw new TerritorialOnboardingError(mapResolverFailure(resolution.status));
    }

    // 7. Cross-check da confirmação: cidade confirmada deve bater com a RE-RESOLVIDA.
    if (command.confirmedCityId !== resolution.cityId) {
      throw new TerritorialOnboardingError('territorial_confirmation_mismatch', 'city confirmada ≠ re-resolvida');
    }

    // 8. Bairro (D-G): identidade SÓ quando 'resolved' e o cliente confirma o MESMO id; candidato/pending/
    //    not_applicable → neighborhoodId=null; candidateId nunca vira identidade.
    let neighborhoodId: string | null = null;
    if (resolution.neighborhoodStatus === 'resolved') {
      if (command.confirmedNeighborhoodId && command.confirmedNeighborhoodId !== resolution.neighborhoodId) {
        throw new TerritorialOnboardingError('territorial_confirmation_mismatch', 'bairro confirmado ≠ re-resolvido');
      }
      neighborhoodId = resolution.neighborhoodId;
    } else {
      // candidate/pending/not_applicable: o cliente NÃO pode impor um neighborhoodId.
      if (command.confirmedNeighborhoodId != null) {
        throw new TerritorialOnboardingError('territorial_confirmation_mismatch', 'bairro não resolvido não aceita id confirmado');
      }
      neighborhoodId = null;
    }

    // 9. Escrita EXCLUSIVA pela Fase C. Tenant/operador server-side; role derivado pelo purpose no writer.
    const writerAuth: ActorTerritorialAuthContext = { tenantId: auth.tenantId, operatorUserId: auth.operatorUserId };
    try {
      const result = await this.write(writerAuth, {
        actorId: auth.routeActorId,
        purpose: 'ACTOR_RESIDENCE',
        idempotencyKey,
        address: {
          countryId: resolution.countryId,
          stateId: resolution.stateId,
          cityId: resolution.cityId,
          neighborhoodId,
          neighborhoodDisplayText: resolution.neighborhoodDisplayText,
          postalCode: resolution.postalCodeNormalized,
          street,
          number,
          complement,
        },
      });
      if (result.operation !== 'set' && result.operation !== 'replaced') {
        // retire/retire_noop nunca ocorrem no set; defesa-em-profundidade.
        throw new TerritorialOnboardingError('unexpected_error');
      }
      return {
        actorId: result.actorId,
        purpose: 'ACTOR_RESIDENCE',
        role: 'RESIDENCE',
        outcome: result.operation,
        assignmentId: result.assignmentId!,
        addressId: result.addressId!,
        replayed: result.replayed,
      };
    } catch (err) {
      throw this.mapWriterError(err);
    }
  }

  private mapWriterError(err: unknown): Error {
    if (err instanceof TerritorialOnboardingError) return err;
    if (err instanceof ActorTerritorialAuthorityError) return new TerritorialOnboardingError('authority_denied');
    if (err instanceof ActorTerritorialConflictError) {
      const m = String(err.message);
      if (m.includes('PAYLOAD_MISMATCH')) return new TerritorialOnboardingError('idempotency_payload_mismatch');
      return new TerritorialOnboardingError('actor_territorial_in_progress');
    }
    if (err instanceof ActorTerritorialValidationError) return new TerritorialOnboardingError('invalid_address_payload', err.message);
    // Erro de infraestrutura: propaga como unexpected (a rota devolve 500 sem vazar internals).
    return err instanceof Error ? err : new TerritorialOnboardingError('unexpected_error');
  }
}

export const actorTerritorialAddressOnboardingService = new ActorTerritorialAddressOnboardingService();
