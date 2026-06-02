// src/core/profile/profile-residence-address.service.ts
// F1 (DECISION-0074): endereço civil/residencial da PESSOA FÍSICA no Location Core canônico.
//
// 🔴 SSOT: addresses + address_assignments (owner_type='profile', owner_id=actor_id do user-actor,
//    role='RESIDENCE', is_primary=true). NUNCA profiles.metadata.address como destino novo.
// 🔴 OPÇÃO A (CEP-âncora): segue o padrão vivo de companies.service — grava country=BR + postal_code/
//    street/number/complement; state_id/city_id/neighborhood_id = NULL (FK). NÃO resolve city/state a FK
//    (sem mapeamento frágil; `addresses` não tem coluna de texto livre). Enriquecimento city/UF via
//    CEP/catálogo é frente futura. source='UX_INPUT' (escrita nova).
// 🔴 actor-first: owner_id = actor_id do user-actor (resolveUserActorId / DECISION-0069). NUNCA
//    global_user_id nem profile_id. NÃO cria actor.
// 🔴 PF apenas. NÃO toca Companies/PJ/company address.

import { locationRepository } from '@core/location/location.repository';
import { geoEnrichmentService } from '@core/location/geo-enrichment.service';
import { profileC1DeclarationsReadService } from './profile-c1-declarations-read.service';
import { BadRequestError, NotFoundError } from '@core/errors';

/** Shape de entrada/saída compatível com a UI atual da aba Pessoal (transporte; não reinventa o form). */
export interface ResidenceAddressInput {
  cep?: string | null;
  address?: string | null; // logradouro (alias de street)
  street?: string | null;
  address_number?: string | null; // alias de number
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null; // NÃO persistido canônico (sem coluna texto); aceito e ignorado na escrita
  city?: string | null;         // idem
  state?: string | null;        // idem
}

export interface ResidenceAddressDTO {
  addressId: string;
  cep: string | null;
  address: string | null;
  address_number: string | null;
  complement: string | null;
  neighborhood: string | null; // sempre null vindo do Location Core (Opção A); UI pode enriquecer do blob na transição
  city: string | null;         // idem
  state: string | null;        // idem
  country: string;
  is_primary: boolean;
  source: string;
}

function nz(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

class ProfileResidenceAddressService {
  /** Lê a residência primária vigente da PF no Location Core. null se não houver. */
  async getResidence(tenantId: string, userId: string): Promise<ResidenceAddressDTO | null> {
    const actorId = await profileC1DeclarationsReadService.resolveUserActorId(tenantId, userId);
    if (!actorId) return null;

    const addr = await locationRepository.findPrimaryAddressByOwner('profile', actorId, 'RESIDENCE');
    if (!addr) return null;

    // Opção A: city/state/neighborhood NÃO são armazenados (FK NULL) → vêm null daqui.
    return {
      addressId: addr.id,
      cep: addr.postalCode,
      address: addr.street,
      address_number: addr.number,
      complement: addr.complement,
      neighborhood: null,
      city: null,
      state: null,
      country: 'BR',
      is_primary: true,
      source: addr.source,
    };
  }

  /**
   * Grava/atualiza a residência primária da PF no Location Core (Opção A — CEP-âncora).
   * Aposenta (soft) a residência primária vigente antes de criar a nova (preserva histórico).
   */
  async setResidence(
    tenantId: string,
    userId: string,
    input: ResidenceAddressInput
  ): Promise<ResidenceAddressDTO> {
    const actorId = await profileC1DeclarationsReadService.resolveUserActorId(tenantId, userId);
    if (!actorId) {
      // Residência civil exige o user-actor; sem ele, fail-closed (não criar actor por aqui).
      throw new NotFoundError('Actor de usuário (PF) não encontrado para gravar residência');
    }

    const cep = nz(input.cep);
    const street = nz(input.address) ?? nz(input.street);
    const number = nz(input.address_number) ?? nz(input.number);
    const complement = nz(input.complement);

    // Mínimo: CEP é a âncora canônica (Opção A). Sem CEP, não há endereço canônico significativo.
    if (!cep) {
      throw new BadRequestError('CEP (postal_code) é obrigatório para a residência canônica');
    }

    const country = await locationRepository.findCountryByCode('BR');
    if (!country) {
      throw new BadRequestError('País BR ausente no catálogo de Location Core');
    }

    // Fecha a residência primária vigente (soft) para respeitar o UNIQUE parcial de primary.
    await locationRepository.retirePrimaryAssignment('profile', actorId, 'RESIDENCE');

    const created = await locationRepository.createAddress(
      {
        countryId: country.id,
        stateId: null,
        cityId: null,
        neighborhoodId: null,
        postalCode: cep,
        street,
        number,
        complement,
        reference: null,
        source: 'UX_INPUT',
        lat: null,
        lng: null,
      },
      tenantId
    );

    await locationRepository.assignAddress(created.id, 'profile', actorId, 'RESIDENCE', true);

    // F-GEO-1a (DECISION-0077): enriquecimento best-effort de state_id/city_id a partir do CEP.
    // fail-open: se o provider não estiver configurado (default Null) ou falhar, o endereço permanece
    // CEP-âncora — NUNCA bloqueia a gravação. Não persiste lat/lng (privacidade).
    try {
      await geoEnrichmentService.enrichAddress(created.id, cep);
    } catch {
      // best-effort; ignorar.
    }

    const dto = await this.getResidence(tenantId, userId);
    if (!dto) {
      // Não deveria ocorrer logo após a escrita; defesa-em-profundidade.
      throw new BadRequestError('Falha ao reler residência recém-gravada');
    }
    return dto;
  }
}

export const profileResidenceAddressService = new ProfileResidenceAddressService();
