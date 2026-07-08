// backend/src/modules/rentals/rentable-resource.service.ts
// F-RENTAL-RESOURCE-SURFACE-SLICE-A. Autoridade espelha EXATAMENTE o padrão de POST /availability
// (DECISION-0113 canal-1): owner_actor_id NUNCA vem do body — é o actionContext.actorId do caller,
// só depois de canRepresentActor provar que req.user o representa. Aceita actor 'user' OU 'page'
// (uma empresa pode ser dona de um recurso alugável; DECISION-0151 não restringe a pessoa física).

import { authorizationService } from '@core/authorization/authorization.service';
import { HttpError } from '@core/errors/http-error';
import { rentableResourceRepository } from './rentable-resource.repository';
import type {
  RentableResource,
  RentableResourceType,
  CreateRentableResourceInput,
  ListRentableResourcesFilters,
} from './rentable-resource.types';

/** Subtrai intervalos ocupados de [winStart, winEnd), devolvendo os GAPS livres em ordem. Determinístico.
 *  Ex.: janela 08→31 menos reserva 10→17 = [08→10, 17→31]. Toca disponibilidade projetada (Clayton). */
function subtractPeriods(winStart: Date, winEnd: Date, busy: Array<{ start: Date; end: Date }>): Array<{ start: Date; end: Date }> {
  // só as reservas que tocam a janela, ordenadas e clampadas aos limites da janela
  const overlaps = busy
    .filter((b) => b.end > winStart && b.start < winEnd)
    .map((b) => ({ start: new Date(Math.max(b.start.getTime(), winStart.getTime())), end: new Date(Math.min(b.end.getTime(), winEnd.getTime())) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const gaps: Array<{ start: Date; end: Date }> = [];
  let cursor = winStart;
  for (const o of overlaps) {
    if (o.start > cursor) gaps.push({ start: cursor, end: o.start });
    if (o.end > cursor) cursor = o.end;
  }
  if (cursor < winEnd) gaps.push({ start: cursor, end: winEnd });
  return gaps;
}

class RentableResourceService {
  /**
   * Cria o recurso alugável. `ownerActorId` já deve ter sido PROVADO pelo caller (rota) via
   * canRepresentActor — este service não reprova, só persiste. `conceptId` deve referenciar um
   * concept EXISTENTE (Lei de Coerência: caller nunca inventa taxonomia).
   */
  async create(
    tenantId: string,
    ownerActorId: string,
    input: CreateRentableResourceInput
  ): Promise<RentableResource> {
    const conceptOk = await rentableResourceRepository.conceptExists(tenantId, input.conceptId);
    if (!conceptOk) {
      throw HttpError.badRequest('RENTABLE_RESOURCE_CONCEPT_NOT_FOUND: concept_id não existe (recurso não pode inventar taxonomia).');
    }
    if (!input.label || input.label.trim().length === 0) {
      throw HttpError.badRequest('RENTABLE_RESOURCE_LABEL_REQUIRED');
    }

    // F-VEHICLE-MODEL-YEAR: quando o recurso é VEÍCULO, a combinação marca→modelo→concept→ano é
    // GOVERNADA e validada no backend (não confia no front). concept deve ser 'rentable' (o
    // catálogo de veículo já é rentable, mas provamos aqui também — defesa em profundidade).
    if (input.resourceType === 'vehicle') {
      const { vehicleCatalogService } = await import('@core/catalog/vehicle-catalog.service');
      const meta = (input.metadata ?? {}) as { vehicleMakeId?: string; vehicleModelId?: string };
      const conceptRentable = await rentableResourceRepository.conceptHasOfferKind(tenantId, input.conceptId, 'rentable');
      if (!conceptRentable) {
        throw HttpError.badRequest('RENTABLE_RESOURCE_CONCEPT_NOT_RENTABLE: concept sem offer_kind=rentable.');
      }
      const v = await vehicleCatalogService.validateVehicleCombo({
        makeId: meta.vehicleMakeId ?? null,
        modelId: meta.vehicleModelId ?? null,
        conceptId: input.conceptId,
        year: input.resourceYear ?? null,
      });
      if (!v.ok) throw HttpError.badRequest(`RENTABLE_RESOURCE_VEHICLE_INVALID: ${v.code}`);
    }

    // Localização governada (F-RENTABLE-RESOURCE-LOCATION-MVP): cidade da SSOT `cities`, validada no
    // backend — nunca city_name livre. O front manda cityId JÁ resolvido; aqui provamos que existe.
    if (input.cityId) {
      const cityOk = await rentableResourceRepository.cityExists(input.cityId);
      if (!cityOk) throw HttpError.badRequest('RENTABLE_RESOURCE_CITY_NOT_FOUND: cidade não existe na base canônica.');
    }

    // Fase 3 — QUANTIDADE: único (identidade própria) vs fungível. Veículo/imóvel/espaço travados em 1;
    // só equipamento pode ter >1. Backend é a autoridade (front não decide).
    const SINGLE_ONLY: RentableResourceType[] = ['vehicle', 'property', 'space'];
    let quantity = Math.max(1, Math.floor(input.quantity ?? 1));
    if (SINGLE_ONLY.includes(input.resourceType) && quantity !== 1) {
      throw HttpError.badRequest(`RENTABLE_RESOURCE_QUANTITY_MUST_BE_1: ${input.resourceType} é único (identidade própria), quantidade não pode ser ${quantity}.`);
    }

    // Política de ENTREGA/DEVOLUÇÃO validada + normalizada pelo backend (tipo decide o que é permitido).
    const handoff = this.normalizeHandoff(input.resourceType, {
      startHandoffMethod: input.startHandoffMethod, endHandoffMethod: input.endHandoffMethod,
      deliveryRadiusKm: input.deliveryRadiusKm ?? null, deliveryFeeCents: input.deliveryFeeCents ?? null,
      collectionFeeCents: input.collectionFeeCents ?? null,
    });

    const created = await rentableResourceRepository.create(tenantId, ownerActorId, {
      ...input,
      label: input.label.trim(),
      quantity,
      ...handoff,
    });

    // Fase 1 — faixas de preço (SSOT rental_resource_pricing). Dinheiro em cents; validado no schema.
    if (input.pricingTiers && input.pricingTiers.length > 0) {
      await rentableResourceRepository.setPricingTiers(tenantId, created.id, input.pricingTiers);
    }

    // vínculo de localização pelo padrão canônico address_assignments → addresses → cities.
    // Fase 4: CEP (opcional) refina a coord via provider; sem rede (Null) usa a coord da cidade.
    if (input.cityId) {
      const geo = await this.resolveCepGeo(input.postalCode);
      await rentableResourceRepository.assignCityToResource(tenantId, created.id, input.cityId, geo);
    }
    return created;
  }

  /** Resolve CEP → { postalCode, lat, lng } via provider governado. Null provider (dev/gates) → só
   *  o postalCode normalizado (coord fica da cidade). Nunca falha por rede. */
  private async resolveCepGeo(postalCode?: string | null): Promise<{ postalCode: string | null; lat: number | null; lng: number | null }> {
    const { normalizePostalCode, getDefaultCepProvider } = await import('@core/location/cep-provider');
    const cep = normalizePostalCode(postalCode);
    if (!cep) return { postalCode: null, lat: null, lng: null };
    try {
      const res = await getDefaultCepProvider().resolvePostalCode(cep);
      return { postalCode: cep, lat: res?.lat ?? null, lng: res?.lng ?? null };
    } catch {
      return { postalCode: cep, lat: null, lng: null };
    }
  }

  async get(tenantId: string, id: string): Promise<RentableResource> {
    const resource = await rentableResourceRepository.findById(tenantId, id);
    if (!resource) {
      throw HttpError.notFound('RENTABLE_RESOURCE_NOT_FOUND');
    }
    return resource;
  }

  /**
   * Valida + NORMALIZA a política de entrega/devolução (backend é a autoridade). Regras governadas:
   *  - imóvel/espaço NÃO se entrega: owner_delivery/owner_collection proibidos (400) — só retira/devolve
   *    no local ou a combinar.
   *  - taxa/raio só fazem sentido com o método correspondente: se não é owner_delivery, zera raio+taxa de
   *    entrega; se não é owner_collection, zera taxa de busca (evita taxa órfã = verdade inconsistente).
   * Dinheiro em cents (o schema já garante inteiro >=0). Pré-dinheiro: taxa é anúncio, não cobrança.
   */
  private normalizeHandoff(
    resourceType: RentableResourceType,
    h: { startHandoffMethod?: string; endHandoffMethod?: string; deliveryRadiusKm?: number | null; deliveryFeeCents?: number | null; collectionFeeCents?: number | null }
  ) {
    const start = (h.startHandoffMethod ?? 'renter_pickup') as 'renter_pickup' | 'owner_delivery' | 'to_be_arranged';
    const end = (h.endHandoffMethod ?? 'renter_return') as 'renter_return' | 'owner_collection' | 'to_be_arranged';
    const NO_DELIVERY: RentableResourceType[] = ['property', 'space'];
    if (NO_DELIVERY.includes(resourceType) && (start === 'owner_delivery' || end === 'owner_collection')) {
      throw HttpError.badRequest('RENTABLE_RESOURCE_HANDOFF_NOT_APPLICABLE: imóvel/espaço não têm entrega/busca — o cliente vai até o local.');
    }
    const isDelivery = start === 'owner_delivery';
    const isCollection = end === 'owner_collection';
    return {
      startHandoffMethod: start,
      endHandoffMethod: end,
      deliveryRadiusKm: isDelivery ? (h.deliveryRadiusKm ?? null) : null,
      deliveryFeeCents: isDelivery ? (h.deliveryFeeCents ?? null) : null,
      collectionFeeCents: isCollection ? (h.collectionFeeCents ?? null) : null,
    };
  }

  /**
   * SOLICITAÇÕES PENDENTES do recurso, para o DONO decidir informado (ato de confiança — ele vai ceder
   * um bem). Owner-only (canRepresentActor). Cada solicitação traz: QUEM pediu (projeção pública do
   * actor — anti-PII), o PERÍODO pedido, a ESTIMATIVA (faixas+período). Reputação: honesta — hoje o
   * substrato está dormente, então `trust: null` (a tela mostra "ainda não disponível", NÃO inventa).
   */
  async getResourceRequests(tenantId: string, resourceId: string, requestingUserId: string) {
    const resource = await this.get(tenantId, resourceId);
    let canRep = false;
    try { canRep = await authorizationService.canRepresentActor(tenantId, requestingUserId, resource.ownerActorId); } catch { canRep = false; }
    if (!canRep) throw HttpError.forbidden('RENTABLE_RESOURCE_REQUESTS_NOT_REPRESENTABLE: só o dono vê as solicitações.');

    const pending = await rentableResourceRepository.findPendingRequests(tenantId, resourceId);
    const tiers = await rentableResourceRepository.getPricingTiers(tenantId, resourceId);
    const { estimatePrice } = await import('./pricing-estimate');
    return Promise.all(pending.map(async (p) => {
      const requester = await rentableResourceRepository.getPublicActorSummary(tenantId, p.requesterActorId);
      const estimate = (p.bookedStart && p.bookedEnd) ? estimatePrice(tiers as any, p.bookedStart, p.bookedEnd) : null;
      return {
        bookingId: p.bookingId,
        requester: requester ?? { actorId: p.requesterActorId, displayName: 'Solicitante', actorType: 'user', avatarUrl: null },
        bookedStart: p.bookedStart?.toISOString() ?? null,
        bookedEnd: p.bookedEnd?.toISOString() ?? null,
        requestedAt: p.requestedAt.toISOString(),
        estimate,
        trust: null, // reputação dormente — a tela mostra estado honesto, NÃO score inventado
      };
    }));
  }

  /**
   * O DONO RECUSA uma solicitação (owner-only). Muda status para 'cancelled' (vocabulário existente),
   * preservando o histórico. Reusa o updateBooking do core (que valida existência). Δbank=0.
   */
  async declineRequest(tenantId: string, resourceId: string, bookingId: string, requestingUserId: string) {
    const resource = await this.get(tenantId, resourceId);
    let canRep = false;
    try { canRep = await authorizationService.canRepresentActor(tenantId, requestingUserId, resource.ownerActorId); } catch { canRep = false; }
    if (!canRep) throw HttpError.forbidden('RENTABLE_RESOURCE_DECLINE_NOT_REPRESENTABLE: só o dono recusa.');
    const { unifiedAvailabilityRepository } = await import('@core/availability/unified-availability.repository');
    const booking = await unifiedAvailabilityRepository.findBookingById(tenantId, bookingId);
    if (!booking) throw HttpError.notFound('BOOKING_NOT_FOUND');
    // Confirma que o booking pertence a uma janela DESTE recurso (não recusar booking alheio).
    const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
    const availability = await unifiedAvailabilityRepository.findAvailabilityById(tenantId, booking.availabilityId);
    if (!availability || availability.ownerType !== 'rentable_resource' || availability.ownerId !== resourceId) {
      throw HttpError.badRequest('BOOKING_RESOURCE_MISMATCH: solicitação não é deste recurso.');
    }
    await unifiedAvailabilityService.updateBooking(tenantId, bookingId, requestingUserId, { status: 'cancelled' as any });
    return { bookingId, status: 'cancelled' };
  }

  /** Busca de locação por texto para a busca global — só recursos PÚBLICOS ativos (sem actor declarado). */
  searchByText(tenantId: string, q: string, limit?: number) {
    return rentableResourceRepository.searchByText(tenantId, q, limit);
  }

  /**
   * SOLICITAR/RESERVAR uma janela (modelo Airbnb). O consumidor cria o pedido; o modo de aprovação é do
   * DONO (booking_approval_mode, decidido no cadastro — a verdade está no backend, não na tela):
   *   'manual'    → booking fica 'requested' (o dono confirma depois);
   *   'automatic' → o backend CONFIRMA na hora (pré-autorização do dono), passando pelo lock de recurso
   *                 (confirmBookingWithResourceLock) que barra conflito de período (409). Não esfria o
   *                 negócio. PRÉ-DINHEIRO: 'confirmed' = compromisso de agenda, sem pagamento (PORTA-1).
   * O consumidor NUNCA confirma sozinho — a auto-confirmação é regra do dono aplicada server-side.
   */
  async requestBooking(
    tenantId: string, resourceId: string, availabilityId: string,
    subject: { subjectUserId: string; requesterActorId: string },
    period?: { start?: Date | null; end?: Date | null }
  ): Promise<{ bookingId: string; status: string; autoConfirmed: boolean }> {
    const resource = await rentableResourceRepository.findById(tenantId, resourceId);
    if (!resource || resource.status !== 'active') {
      throw HttpError.notFound('RENTABLE_RESOURCE_NOT_BOOKABLE: recurso indisponível.');
    }
    const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
    const { unifiedAvailabilityRepository } = await import('@core/availability/unified-availability.repository');
    const availability = await unifiedAvailabilityRepository.findAvailabilityById(tenantId, availabilityId);
    if (!availability || availability.ownerType !== 'rentable_resource' || availability.ownerId !== resourceId) {
      throw HttpError.badRequest('RENTABLE_RESOURCE_AVAILABILITY_MISMATCH: janela não pertence a este recurso.');
    }
    // SUBPERÍODO: a reserva consome só um pedaço da janela macro. Se o consumidor não escolher, usa a
    // janela inteira. A verdade temporal é do backend: o subperíodo DEVE estar contido na janela ativa.
    const winStart = new Date(availability.startDatetime);
    const winEnd = new Date(availability.endDatetime);
    const bStart = period?.start ?? winStart;
    const bEnd = period?.end ?? winEnd;
    if (bEnd <= bStart) throw HttpError.badRequest('RENTAL_BOOKING_PERIOD_INVALID: fim deve ser depois do início.');
    if (bStart < winStart || bEnd > winEnd) {
      throw HttpError.badRequest('RENTAL_BOOKING_OUT_OF_WINDOW: o período pedido está fora da janela de disponibilidade.');
    }
    // Cria o pedido (subject prova autoridade do consumidor sobre o próprio actor — DECISION-0148).
    const booking = await unifiedAvailabilityService.createBooking(
      tenantId, subject, { availabilityId, requesterActorId: subject.requesterActorId, bookedStartDatetime: bStart, bookedEndDatetime: bEnd } as any);

    if (resource.bookingApprovalMode === 'automatic') {
      // Pré-autorização do dono → o backend confirma. Lock por recurso barra conflito NO SUBPERÍODO
      // (não na janela) considerando a quantity (409 RENTAL_RESOURCE_TIME_CONFLICT).
      const confirmed = await unifiedAvailabilityRepository.confirmBookingWithResourceLock(
        tenantId, booking.bookingId, resourceId, bStart.toISOString(), bEnd.toISOString());
      return { bookingId: booking.bookingId, status: confirmed.status, autoConfirmed: true };
    }
    return { bookingId: booking.bookingId, status: booking.status, autoConfirmed: false };
  }

  /**
   * Disponibilidade PÚBLICA de um recurso alugável (para o consumidor que chegou pela busca/descoberta).
   * A agenda operacional é privada por padrão (DECISION-0113/0118), mas as janelas de um recurso PÚBLICO
   * são informação de descoberta (como um anúncio de aluguel). Expõe só janelas ATIVAS e só se o recurso
   * é público+ativo — sem actor declarado pelo cliente. Projeção mínima (id/início/fim), sem dados privados.
   */
  async getPublicAvailability(tenantId: string, resourceId: string) {
    const resource = await rentableResourceRepository.findById(tenantId, resourceId);
    if (!resource || resource.status !== 'active' || resource.visibility !== 'public') {
      const err: any = new Error('Recurso indisponível para consulta pública'); err.statusCode = 404; throw err;
    }
    const { unifiedAvailabilityRepository } = await import('@core/availability/unified-availability.repository');
    const windows = await unifiedAvailabilityRepository.findAvailabilities(tenantId, {
      ownerType: 'rentable_resource' as any, ownerId: resourceId, status: 'active' as any,
    });
    // DISPONIBILIDADE PROJETADA = janela macro − reservas confirmadas. Para recurso ÚNICO (quantity=1),
    // subtrai os subperíodos ocupados e devolve os GAPS livres (o dono continua com 1 janela declarada;
    // o backend projeta o que sobra). Para fungível (quantity>1), a janela inteira segue (o confirm
    // valida capacity). A verdade temporal é do backend — o front só renderiza.
    if (resource.quantity > 1) {
      return windows.map((w) => ({ availabilityId: w.availabilityId, startDatetime: w.startDatetime.toISOString(), endDatetime: w.endDatetime.toISOString() }));
    }
    const busy = await rentableResourceRepository.findConfirmedPeriods(tenantId, resourceId);
    const out: Array<{ availabilityId: string; startDatetime: string; endDatetime: string }> = [];
    for (const w of windows) {
      const gaps = subtractPeriods(w.startDatetime, w.endDatetime, busy);
      for (const g of gaps) out.push({ availabilityId: w.availabilityId, startDatetime: g.start.toISOString(), endDatetime: g.end.toISOString() });
    }
    return out;
  }

  getPricingTiers(tenantId: string, resourceId: string) {
    return rentableResourceRepository.getPricingTiers(tenantId, resourceId);
  }
  getResourceCity(tenantId: string, resourceId: string) {
    return rentableResourceRepository.getResourceCity(tenantId, resourceId);
  }

  /**
   * Fase 2 — ESTIMATIVA de preço (PRÉ-DINHEIRO). Backend calcula a partir das faixas declaradas +
   * o período; o front só renderiza. NÃO cria cobrança/hold/reserva; Δbank=0. Valores em cents.
   */
  async estimatePrice(tenantId: string, resourceId: string, startAt: Date, endAt: Date) {
    const { estimatePrice } = await import('./pricing-estimate');
    const tiers = await rentableResourceRepository.getPricingTiers(tenantId, resourceId);
    return estimatePrice(tiers as { unit: any; priceCents: number }[], startAt, endAt);
  }

  async list(tenantId: string, filters: ListRentableResourcesFilters): Promise<RentableResource[]> {
    return rentableResourceRepository.list(tenantId, filters);
  }

  /** DESCOBERTA (consumir): filtrada pela plateia do dono — enforcement no BANCO, viewer server-side. */
  async listDiscoverable(tenantId: string, viewerActorId: string, limit?: number): Promise<RentableResource[]> {
    return rentableResourceRepository.listDiscoverable(tenantId, viewerActorId, limit);
  }

  /**
   * DESCOBERTA no padrão locadora adaptado ao P2P (decisões Clayton 2026-07-08). O consumidor informa
   * ONDE ESTÁ (originCityId obrigatório + originCep opcional) e QUANDO (período). Backend é a AUTORIDADE:
   * resolve a coord da ORIGEM na SSOT (cidade sempre; CEP refina) — o front NUNCA manda lat/lng —,
   * calcula distância (haversine), filtra por raio, ordena por proximidade e estima o preço. O local de
   * retirada/devolução é o do DONO (cada anúncio), não escolha do consumidor. Pré-dinheiro (Δbank=0).
   */
  async discoverRentals(
    tenantId: string, viewerActorId: string,
    f: { originCityId?: string | null; originCep?: string | null; radiusKm?: number | null; resourceType?: string | null; startAt?: Date | null; endAt?: Date | null },
    limit?: number
  ) {
    // Coord da ORIGEM do consumidor, resolvida server-side (SSOT): CEP refina (produção); cidade é a
    // base garantida (sem depender de rede). Se nenhuma origem, sem centro de raio (lista sem distância).
    let lat: number | null = null, lng: number | null = null;
    if (f.originCep) { const geo = await this.resolveCepGeo(f.originCep); lat = geo.lat; lng = geo.lng; }
    if ((lat == null || lng == null) && f.originCityId) {
      const c = await rentableResourceRepository.cityCoord(f.originCityId);
      if (c) { lat = c.lat; lng = c.lng; }
    }
    const rows = await rentableResourceRepository.discoverRentals(
      tenantId, viewerActorId,
      { lat, lng, radiusKm: f.radiusKm, resourceType: f.resourceType }, limit);
    const withPeriod = f.startAt && f.endAt && !isNaN(f.startAt.getTime()) && !isNaN(f.endAt.getTime());
    const { estimatePrice } = await import('./pricing-estimate');
    return Promise.all(rows.map(async (r) => {
      const pricingTiers = await rentableResourceRepository.getPricingTiers(tenantId, r.id);
      const estimate = withPeriod ? estimatePrice(pricingTiers as any, f.startAt!, f.endAt!) : null;
      // Elegibilidade de ENTREGA (backend é a autoridade): o dono entrega E o consumidor está dentro do
      // raio (distância haversine <= delivery_radius_km). Se não sabemos a distância, indefinido (null).
      const deliverable = r.startHandoffMethod === 'owner_delivery';
      const deliveryEligible = deliverable && r.distanceKm != null && r.deliveryRadiusKm != null
        ? r.distanceKm <= r.deliveryRadiusKm : null;
      return {
        id: r.id, label: r.label, resourceType: r.resourceType, description: r.description,
        cityName: r.cityName, uf: r.uf, distanceKm: r.distanceKm, quantity: r.quantity,
        pricingTiers, estimate, metadata: r.metadata,
        startHandoffMethod: r.startHandoffMethod, endHandoffMethod: r.endHandoffMethod,
        deliveryRadiusKm: r.deliveryRadiusKm, deliveryFeeCents: r.deliveryFeeCents, collectionFeeCents: r.collectionFeeCents,
        deliveryEligible, // true=entrega até você · false=fora do raio · null=indefinido/sem entrega
      };
    }));
  }

  /**
   * Muda status (active/paused/retired). Owner-only — prova via canRepresentActor contra o
   * owner_actor_id JÁ REGISTRADO do recurso (não o declarado pelo caller).
   */
  /**
   * Edita a OFERTA de um recurso (o dono edita o próprio anúncio). Trava de autoridade idêntica ao
   * status: canRepresentActor sobre o owner. NÃO edita a IDENTIDADE (tipo/concept/veículo) — se o dono
   * errou o item, recria. Campos editáveis: descrição, plateia, faixas de preço, quantidade, cidade.
   */
  async update(
    tenantId: string,
    resourceId: string,
    requestingUserId: string,
    input: {
      description?: string | null;
      visibility?: RentableResource['visibility'];
      audienceRelationshipTypes?: string[] | null;
      pricingTiers?: { unit: any; priceCents: number }[];
      quantity?: number;
      cityId?: string | null;
      postalCode?: string | null;
      bookingApprovalMode?: 'manual' | 'automatic';
      startHandoffMethod?: string;
      endHandoffMethod?: string;
      deliveryRadiusKm?: number | null;
      deliveryFeeCents?: number | null;
      collectionFeeCents?: number | null;
    }
  ): Promise<RentableResource> {
    const resource = await this.get(tenantId, resourceId);
    let canRep = false;
    try {
      canRep = await authorizationService.canRepresentActor(tenantId, requestingUserId, resource.ownerActorId);
    } catch { canRep = false; }
    if (!canRep) throw HttpError.forbidden('RENTABLE_RESOURCE_UPDATE_NOT_REPRESENTABLE: sem autoridade sobre o owner do recurso.');

    // quantidade: mesma regra do create (único vs fungível), pelo tipo REAL do recurso.
    if (input.quantity != null) {
      const SINGLE_ONLY = ['vehicle', 'property', 'space'];
      const q = Math.max(1, Math.floor(input.quantity));
      if (SINGLE_ONLY.includes(resource.resourceType) && q !== 1) {
        throw HttpError.badRequest(`RENTABLE_RESOURCE_QUANTITY_MUST_BE_1: ${resource.resourceType} é único.`);
      }
    }
    if (input.cityId) {
      const cityOk = await rentableResourceRepository.cityExists(input.cityId);
      if (!cityOk) throw HttpError.badRequest('RENTABLE_RESOURCE_CITY_NOT_FOUND: cidade não existe na base canônica.');
    }

    // Handoff: só toca se o dono mandou algum método (edição parcial). Valida+normaliza pelo tipo REAL.
    const handoffTouched = input.startHandoffMethod !== undefined || input.endHandoffMethod !== undefined;
    const handoff = handoffTouched
      ? this.normalizeHandoff(resource.resourceType, {
          startHandoffMethod: input.startHandoffMethod, endHandoffMethod: input.endHandoffMethod,
          deliveryRadiusKm: input.deliveryRadiusKm ?? null, deliveryFeeCents: input.deliveryFeeCents ?? null,
          collectionFeeCents: input.collectionFeeCents ?? null,
        })
      : null;

    await rentableResourceRepository.updateOffer(tenantId, resourceId, {
      description: input.description,
      visibility: input.visibility,
      audienceRelationshipTypes: input.audienceRelationshipTypes,
      quantity: input.quantity != null ? Math.max(1, Math.floor(input.quantity)) : undefined,
      bookingApprovalMode: input.bookingApprovalMode,
      startHandoffMethod: handoff?.startHandoffMethod,
      endHandoffMethod: handoff?.endHandoffMethod,
      deliveryRadiusKm: handoff?.deliveryRadiusKm,
      deliveryFeeCents: handoff?.deliveryFeeCents,
      collectionFeeCents: handoff?.collectionFeeCents,
      handoffTouched,
    });
    if (input.pricingTiers) {
      await rentableResourceRepository.setPricingTiers(tenantId, resourceId, input.pricingTiers);
    }
    if (input.cityId) {
      const geo = await this.resolveCepGeo(input.postalCode);
      await rentableResourceRepository.assignCityToResource(tenantId, resourceId, input.cityId, geo);
    }
    return this.get(tenantId, resourceId);
  }

  async updateStatus(
    tenantId: string,
    resourceId: string,
    requestingUserId: string,
    status: 'active' | 'paused' | 'retired'
  ): Promise<RentableResource> {
    const resource = await this.get(tenantId, resourceId);
    let canRep = false;
    try {
      canRep = await authorizationService.canRepresentActor(tenantId, requestingUserId, resource.ownerActorId);
    } catch {
      canRep = false;
    }
    if (!canRep) {
      throw HttpError.forbidden('RENTABLE_RESOURCE_STATUS_NOT_REPRESENTABLE: sem autoridade sobre o owner do recurso.');
    }
    const updated = await rentableResourceRepository.updateStatus(tenantId, resourceId, status);
    if (!updated) {
      throw HttpError.notFound('RENTABLE_RESOURCE_NOT_FOUND');
    }
    return updated;
  }
}

export const rentableResourceService = new RentableResourceService();
