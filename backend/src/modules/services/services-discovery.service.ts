import { randomUUID } from 'crypto';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { bankPortsRegistry } from '@core/bank/ports-registry';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@core/errors';
import { buildFinancialAuthorshipFromRequest } from '@modules/bank/financial-authorship.helper';
import { ActorIntent } from '@modules/social/actor-intents.types';
import { servicesRepository } from './services.repository';
import { servicesService } from './services.service';
import { ServiceStatus, ServiceType } from './services.types';
import type {
  DiscoveryAvailabilityBlock,
  DiscoveryWeekday,
  ServiceDiscoveryRequestRow,
  ServiceDiscoveryRequestStatus,
} from './services-discovery.types';

const WEEKDAYS: DiscoveryWeekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function weekdayFromDate(d: Date): DiscoveryWeekday {
  return WEEKDAYS[d.getUTCDay()];
}

function parseHHMM(s: string): number {
  const t = s.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) throw new BadRequestError(`Horário inválido: "${s}"`);
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) {
    throw new BadRequestError(`Horário fora do intervalo: "${s}"`);
  }
  return h * 60 + min;
}

function minutesInSlotRange(slot: string): { start: number; end: number } | null {
  const parts = slot.split('-').map((p) => p.trim());
  if (parts.length !== 2) return null;
  try {
    const start = parseHHMM(parts[0]);
    const end = parseHHMM(parts[1]);
    if (end <= start) return null;
    return { start, end };
  } catch {
    return null;
  }
}

function isTimeInAvailability(when: Date, blocks: DiscoveryAvailabilityBlock[]): boolean {
  if (!blocks.length) return false;
  const day = weekdayFromDate(when);
  const mins = when.getUTCHours() * 60 + when.getUTCMinutes();
  for (const b of blocks) {
    if (b.weekday !== day) continue;
    for (const slot of b.slots || []) {
      const r = minutesInSlotRange(slot);
      if (r && mins >= r.start && mins < r.end) return true;
    }
  }
  return false;
}

function normalizeAvailability(raw: DiscoveryAvailabilityBlock[]): DiscoveryAvailabilityBlock[] {
  const out: DiscoveryAvailabilityBlock[] = [];
  for (const b of raw) {
    const w = String(b.weekday).toLowerCase() as DiscoveryWeekday;
    if (!WEEKDAYS.includes(w)) {
      throw new BadRequestError(`weekday inválido: ${b.weekday}`);
    }
    if (!Array.isArray(b.slots) || b.slots.length === 0) {
      throw new BadRequestError('Cada bloco de disponibilidade precisa de slots não vazios');
    }
    for (const slot of b.slots) {
      if (minutesInSlotRange(slot) == null) {
        throw new BadRequestError(`Slot inválido (use HH:mm-HH:mm): "${slot}"`);
      }
    }
    out.push({ weekday: w, slots: b.slots.map((s) => String(s).trim()) });
  }
  return out;
}

function iso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

// F-SERVICE-PRICING-FIXED-MVP-HARDENING: o antigo fallback artificial
// SERVICE_DISCOVERY_DEFAULT_PAYMENT_CENTS = 1000 (R$10,00) foi REMOVIDO. Preço
// ausente/nulo/zero/inválido NÃO pode virar valor financeiro silencioso — o
// pagamento falha honestamente (ver payAcceptedRequest). Não reintroduzir.

class ServicesDiscoveryService {
  /**
   * Resolve conta UnifyBank (wallet) a partir do actor_id público (UUID canónico).
   */
  private async resolveUnifyBankAccountForPublicActor(
    tenantId: string,
    publicActorId: string
  ): Promise<{ accountId: string; userIdForAuthorship: string | null }> {
    const row = await runQueryWithTenant<{
      actor_type: string;
      user_id: string | null;
      company_id: string | null;
    }>(
      tenantId,
      `
      SELECT actor_type, user_id, company_id
      FROM actors
      WHERE tenant_id = $1 AND actor_id = $2
      LIMIT 1
      `,
      [tenantId, publicActorId]
    );
    if (!row) {
      throw new NotFoundError('Actor não encontrado');
    }
    const bankAccount = bankPortsRegistry.getBankAccount();
    if (row.actor_type === 'user' && row.user_id) {
      const acc = await bankAccount.getOrCreateAccount(tenantId, {
        ownerId: row.user_id,
        ownerType: 'user',
        currency: 'BRL',
      });
      return { accountId: acc.accountId, userIdForAuthorship: row.user_id };
    }
    if (row.actor_type === 'page' && row.company_id) {
      const acc = await bankAccount.getOrCreateAccount(tenantId, {
        ownerId: row.company_id,
        ownerType: 'company',
        currency: 'BRL',
      });
      return { accountId: acc.accountId, userIdForAuthorship: null };
    }
    throw new BadRequestError(
      'Actor sem carteira suportada neste fluxo (esperado utilizador ou página de empresa)'
    );
  }

  /**
   * Cliente paga pedido já aceito pelo prestador — transferência simples no Bank (sem split).
   */
  async payAcceptedRequest(tenantId: string, actionActorId: string, input: { requestId: string }) {
    const row = await runQueryWithTenant<{
      id: string;
      status: string;
      payment_status: string | null;
      payment_bank_transaction_id: string | null;
      service_id: string;
      customer_public_actor_id: string;
      provider_actor_id: string;
      price_cents: string | number | null;
    }>(
      tenantId,
      `
      SELECT
        r.id,
        r.status,
        r.payment_status,
        r.payment_bank_transaction_id,
        r.service_id,
        cust.actor_id AS customer_public_actor_id,
        s.actor_id AS provider_actor_id,
        s.price_cents
      FROM service_discovery_requests r
      INNER JOIN services s ON s.service_id = r.service_id AND s.tenant_id = r.tenant_id
      INNER JOIN actors cust ON cust.id = r.customer_actor_id AND cust.tenant_id = r.tenant_id
      WHERE r.id = $1 AND r.tenant_id = $2
      LIMIT 1
      `,
      [input.requestId, tenantId]
    );

    if (!row) {
      throw new NotFoundError('Pedido não encontrado');
    }
    if (row.customer_public_actor_id !== actionActorId) {
      throw new ForbiddenError('Apenas o cliente pode pagar este pedido');
    }
    if (row.status !== 'accepted') {
      throw new ConflictError('Pagamento só é permitido após o prestador aceitar o pedido');
    }
    if (row.payment_status === 'paid') {
      throw new ConflictError('Este pedido já está pago');
    }
    if (row.payment_status === 'pending') {
      throw new ConflictError('Pagamento em curso; tente novamente em instantes');
    }

    // F-SERVICE-PRICING-FIXED-MVP-HARDENING: sem preço firme válido o pagamento
    // falha honestamente AQUI — antes de qualquer mutação de estado ou movimento
    // bancário. Nada de valor artificial: Δbank=0, sem bank_ledger, sem
    // bank_transaction, sem payment_intent, sem cobrança. O caminho só prossegue
    // com price_cents inteiro estritamente positivo (fixed-price firme).
    const priceNum =
      row.price_cents != null ? Math.trunc(Number(row.price_cents)) : NaN;
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      throw new BadRequestError(
        'Esta oferta não tem preço firme válido; o pagamento não pode ser iniciado.'
      );
    }
    const amountCents = priceNum;

    const pendingRow = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `
      UPDATE service_discovery_requests
      SET payment_status = 'pending'
      WHERE id = $1 AND tenant_id = $2 AND status = 'accepted' AND payment_status IS NULL
      RETURNING id
      `,
      [input.requestId, tenantId]
    );
    if (!pendingRow) {
      throw new ConflictError('Não foi possível iniciar o pagamento deste pedido');
    }

    try {
      const customerWallet = await this.resolveUnifyBankAccountForPublicActor(
        tenantId,
        row.customer_public_actor_id
      );
      if (!customerWallet.userIdForAuthorship) {
        throw new BadRequestError('Cliente tem de ser actor de utilizador para pagar');
      }
      const customerUserId = customerWallet.userIdForAuthorship;
      const fromAccountId = customerWallet.accountId;

      const providerWallet = await this.resolveUnifyBankAccountForPublicActor(
        tenantId,
        row.provider_actor_id
      );
      const toAccountId = providerWallet.accountId;

      const { ensureUserActor } = await import('@modules/identity/actor-writer.service');
      const buyerActor = await ensureUserActor(tenantId, customerUserId);
      const authorship = buildFinancialAuthorshipFromRequest({
        performedByUserId: customerUserId,
        actingForActorId: buyerActor.actor_id,
        actingForAccountId: fromAccountId,
        authoritySource: 'ownership',
        permissionSnapshot: {
          permissionKey: 'ownership',
          allowed: true,
          actorId: buyerActor.actor_id,
          userId: customerUserId,
          decidedAt: new Date().toISOString(),
        },
      });

      const bankTx = bankPortsRegistry.getBankTransaction();
      const result = await bankTx.createSimpleTransaction(tenantId, {
        eventId: input.requestId,
        referenceType: 'service_discovery_payment',
        fromAccountId,
        toAccountId,
        amountCents,
        currency: 'BRL',
        transactionType: 'transfer',
        description: `Pagamento pedido serviço (discovery) ${input.requestId}`,
        metadata: {
          serviceDiscoveryRequestId: input.requestId,
          serviceId: row.service_id,
        },
        authorship,
      });

      const txId = result.transaction.transactionId;

      await runQueryWithTenant(
        tenantId,
        `
        UPDATE service_discovery_requests
        SET payment_status = 'paid',
            payment_bank_transaction_id = $2::uuid,
            paid_at = now()
        WHERE id = $1 AND tenant_id = $3
        `,
        [input.requestId, txId, tenantId]
      );

      return {
        requestId: row.id,
        paymentStatus: 'paid' as const,
        bankTransactionId: txId,
        amountCents,
      };
    } catch (e) {
      await runQueryWithTenant(
        tenantId,
        `
        UPDATE service_discovery_requests
        SET payment_status = NULL
        WHERE id = $1 AND tenant_id = $2 AND payment_status = 'pending'
        `,
        [input.requestId, tenantId]
      );
      throw e;
    }
  }
  async assertServicosCategory(tenantId: string, categoryId: string): Promise<void> {
    const row = await runQueryWithTenant<{ ok: number }>(
      tenantId,
      `
      SELECT 1 AS ok
      FROM categories
      WHERE category_id = $1
        AND tenant_id = $2
        AND is_active = true
        AND (metadata->>'domain') = 'servicos'
      LIMIT 1
      `,
      [categoryId, tenantId]
    );
    if (!row) {
      throw new BadRequestError('categoryId deve ser uma categoria ativa do domínio servicos');
    }
  }

  async createOffer(
    tenantId: string,
    actionActorId: string,
    input: {
      actorId: string;
      categoryId: string;
      description: string;
      priceCents?: number | null;
      availability: DiscoveryAvailabilityBlock[];
      cityId?: string | null;
    }
  ) {
    if (input.actorId !== actionActorId) {
      throw new BadRequestError('actorId deve coincidir com o actor autenticado');
    }
    await this.assertServicosCategory(tenantId, input.categoryId);
    const availability = normalizeAvailability(input.availability);
    const desc = input.description.trim();
    if (!desc) {
      throw new BadRequestError('description é obrigatória');
    }
    const name = desc.length > 255 ? `${desc.slice(0, 252)}...` : desc;
    const slug = `oferta-${randomUUID().replace(/-/g, '').slice(0, 12)}`;

    return servicesService.createService(
      tenantId,
      actionActorId,
      {
        actorId: input.actorId,
        name,
        slug,
        description: desc,
        serviceType: ServiceType.SERVICE,
        status: ServiceStatus.ACTIVE,
        categoryId: input.categoryId,
        priceCents: input.priceCents ?? null,
        cityId: input.cityId ?? null,
        metadata: { availability },
      },
      ActorIntent.OFFER_SERVICE
    );
  }

  async search(
    tenantId: string,
    filters: { categoryId: string; cityId?: string | null; datetime?: string | null }
  ) {
    const when = filters.datetime ? new Date(filters.datetime) : null;
    if (filters.datetime && Number.isNaN(when!.getTime())) {
      throw new BadRequestError('datetime inválido (use ISO 8601)');
    }

    // 🔴 F-OFFER-4 / DECISION-0142: discovery casa por concept_id. category = ENTRADA de navegação resolvida
    // a concept_id (hop de LEITURA efêmero; V1 exige categoria-folha com concept_id; NUNCA persiste concept_ref).
    const { resolveConceptFromCategory } = await import('@core/semantic/semantic.adapter');
    const { conceptId } = await resolveConceptFromCategory(filters.categoryId);
    if (!conceptId) {
      throw new BadRequestError('CATEGORY_REQUIRES_LEAF_CONCEPT: a categoria precisa ser folha com concept_id (DECISION-0142); discovery casa por concept, não por category/domain.');
    }
    const rows = await servicesRepository.discoverServices(tenantId, {
      conceptId,
      cityId: filters.cityId || undefined,
      limit: 200,
      offset: 0,
    });

    if (!when) {
      return rows;
    }

    return rows.filter((s) => {
      const blocks = (s.metadata?.availability || []) as DiscoveryAvailabilityBlock[];
      if (!Array.isArray(blocks) || blocks.length === 0) return false;
      return isTimeInAvailability(when, blocks);
    });
  }

  // 🔵 F-SERVICE-SEARCH-ALIAS-DISCOVERY: descoberta por TERMO livre de ocupação ("cabeleireiro",
  // "barbeiro"). O termo é resolvido para concept(s) via ponte advisory service_search_aliases
  // (READ-ONLY) e cada concept reusa a MESMA descoberta concept-keyed de search() (DECISION-0142).
  // NÃO é a busca por categoria (search() acima é intocada). NÃO toca publicação gated (DECISION-0144):
  // descobrir uma oferta ≠ poder publicá-la. Miss de alias → lista vazia honesta. Runtime NUNCA
  // insere alias; o texto digitado nunca vira concept.
  async searchByTerm(
    tenantId: string,
    filters: { term: string; cityId?: string | null }
  ) {
    const { resolveConceptsFromSearchTerm } = await import('@core/semantic/semantic.adapter');
    const { normalizedTerm, conceptIds } = await resolveConceptsFromSearchTerm(filters.term);

    // Miss honesto: termo desconhecido/sem ponte curada → vazio. Sem fabricar concept/serviço.
    if (conceptIds.length === 0) {
      return { term: filters.term, normalizedTerm, conceptIds: [] as string[], results: [] as Awaited<ReturnType<typeof servicesRepository.discoverServices>> };
    }

    // Fan-out: reusa a descoberta concept-keyed por concept e deduplica por id de serviço,
    // preservando a ordem de prioridade dos concepts (confidence) vinda da ponte.
    const seen = new Set<string>();
    const merged: Awaited<ReturnType<typeof servicesRepository.discoverServices>> = [];
    for (const conceptId of conceptIds) {
      const rows = await servicesRepository.discoverServices(tenantId, {
        conceptId,
        cityId: filters.cityId || undefined,
        limit: 200,
        offset: 0,
      });
      for (const row of rows) {
        if (seen.has(row.serviceId)) continue;
        seen.add(row.serviceId);
        merged.push(row);
      }
    }

    return { term: filters.term, normalizedTerm, conceptIds, results: merged };
  }

  async createRequest(
    tenantId: string,
    actionActorId: string,
    input: { offerId: string; datetime: string; customerId: string }
  ) {
    if (input.customerId !== actionActorId) {
      throw new BadRequestError('customerId deve coincidir com o actor autenticado');
    }
    const when = new Date(input.datetime);
    if (Number.isNaN(when.getTime())) {
      throw new BadRequestError('datetime inválido (use ISO 8601)');
    }

    const service = await servicesRepository.findById(tenantId, input.offerId);
    if (!service || service.status !== ServiceStatus.ACTIVE) {
      throw new BadRequestError('Oferta não encontrada ou inativa');
    }
    if (service.actorId === input.customerId) {
      throw new BadRequestError('Não é possível solicitar a própria oferta');
    }

    const blocks = (service.metadata?.availability || []) as DiscoveryAvailabilityBlock[];
    if (!Array.isArray(blocks) || blocks.length === 0) {
      throw new BadRequestError('Esta oferta não tem disponibilidade registada');
    }
    if (!isTimeInAvailability(when, blocks)) {
      throw new BadRequestError('Horário não está dentro da disponibilidade desta oferta');
    }

    const customerRow = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `
      SELECT id FROM actors
      WHERE tenant_id = $1 AND actor_id = $2
      LIMIT 1
      `,
      [tenantId, input.customerId]
    );
    if (!customerRow) {
      throw new BadRequestError('Cliente (actor) não encontrado');
    }

    const row = await runQueryWithTenant<ServiceDiscoveryRequestRow>(
      tenantId,
      `
      INSERT INTO service_discovery_requests (
        tenant_id, service_id, customer_actor_id, requested_start, status
      )
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id, tenant_id, service_id, customer_actor_id, requested_start, status, created_at, responded_at
      `,
      [tenantId, input.offerId, customerRow.id, when.toISOString()]
    );

    if (!row) {
      throw new BadRequestError('Falha ao registar solicitação');
    }

    return {
      requestId: row.id,
      offerId: row.service_id,
      customerId: row.customer_actor_id,
      requestedStart: row.requested_start instanceof Date
        ? row.requested_start.toISOString()
        : String(row.requested_start),
      status: row.status as ServiceDiscoveryRequestStatus,
      respondedAt: iso(row.responded_at),
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    };
  }

  /**
   * Prestador da oferta aceita ou recusa o pedido (uma vez; só a partir de pending).
   */
  async respondToRequest(
    tenantId: string,
    actionActorId: string,
    input: { requestId: string; status: 'accepted' | 'rejected' }
  ) {
    const found = await runQueryWithTenant<{
      id: string;
      status: string;
      provider_actor_id: string;
    }>(
      tenantId,
      `
      SELECT r.id, r.status, s.actor_id AS provider_actor_id
      FROM service_discovery_requests r
      INNER JOIN services s
        ON s.service_id = r.service_id AND s.tenant_id = r.tenant_id
      WHERE r.id = $1 AND r.tenant_id = $2
      LIMIT 1
      `,
      [input.requestId, tenantId]
    );

    if (!found) {
      throw new NotFoundError('Pedido não encontrado');
    }
    if (found.provider_actor_id !== actionActorId) {
      throw new ForbiddenError('Apenas o prestador da oferta pode responder a este pedido');
    }
    if (found.status !== 'pending') {
      throw new ConflictError('Este pedido já foi respondido');
    }

    const row = await runQueryWithTenant<ServiceDiscoveryRequestRow>(
      tenantId,
      `
      UPDATE service_discovery_requests
      SET status = $1, responded_at = now()
      WHERE id = $2 AND tenant_id = $3 AND status = 'pending'
      RETURNING id, tenant_id, service_id, customer_actor_id, requested_start, status, created_at, responded_at
      `,
      [input.status, input.requestId, tenantId]
    );

    if (!row) {
      throw new ConflictError('Este pedido já foi respondido');
    }

    return {
      requestId: row.id,
      offerId: row.service_id,
      status: row.status as ServiceDiscoveryRequestStatus,
      requestedStart: iso(row.requested_start)!,
      respondedAt: iso(row.responded_at),
    };
  }

  /**
   * Cliente ou prestador consulta um pedido (apenas partes envolvidas).
   */
  async getRequest(tenantId: string, actionActorId: string, requestId: string) {
    const row = await runQueryWithTenant<{
      id: string;
      service_id: string;
      customer_actor_id: string;
      requested_start: Date;
      status: string;
      created_at: Date;
      responded_at: Date | null;
      provider_actor_id: string;
      customer_public_actor_id: string;
      payment_status: string | null;
      payment_bank_transaction_id: string | null;
      paid_at: Date | null;
    }>(
      tenantId,
      `
      SELECT
        r.id,
        r.service_id,
        r.customer_actor_id,
        r.requested_start,
        r.status,
        r.created_at,
        r.responded_at,
        r.payment_status,
        r.payment_bank_transaction_id,
        r.paid_at,
        s.actor_id AS provider_actor_id,
        cust.actor_id AS customer_public_actor_id
      FROM service_discovery_requests r
      INNER JOIN services s
        ON s.service_id = r.service_id AND s.tenant_id = r.tenant_id
      INNER JOIN actors cust
        ON cust.id = r.customer_actor_id AND cust.tenant_id = r.tenant_id
      WHERE r.id = $1 AND r.tenant_id = $2
      LIMIT 1
      `,
      [requestId, tenantId]
    );

    if (!row) {
      throw new NotFoundError('Pedido não encontrado');
    }
    if (row.provider_actor_id !== actionActorId && row.customer_public_actor_id !== actionActorId) {
      throw new ForbiddenError('Sem permissão para ver este pedido');
    }

    return {
      requestId: row.id,
      offerId: row.service_id,
      status: row.status as ServiceDiscoveryRequestStatus,
      requestedStart: iso(row.requested_start)!,
      respondedAt: iso(row.responded_at),
      createdAt: iso(row.created_at)!,
      providerActorId: row.provider_actor_id,
      customerActorId: row.customer_public_actor_id,
      paymentStatus: row.payment_status as 'pending' | 'paid' | null,
      paymentBankTransactionId: row.payment_bank_transaction_id,
      paidAt: iso(row.paid_at),
    };
  }

  /**
   * Pedidos em que o actor autenticado é o cliente.
   */
  async listMyRequests(
    tenantId: string,
    actionActorId: string,
    filters: { status?: ServiceDiscoveryRequestStatus; limit: number; offset: number }
  ) {
    const countRow = await runQueryWithTenant<{ total: string }>(
      tenantId,
      `
      SELECT COUNT(*)::text AS total
      FROM service_discovery_requests r
      INNER JOIN services s
        ON s.service_id = r.service_id AND s.tenant_id = r.tenant_id
      WHERE r.tenant_id = $1
        AND r.customer_actor_id = (
          SELECT id FROM actors
          WHERE tenant_id = $1 AND actor_id = $2
          LIMIT 1
        )
        AND ($3::text IS NULL OR r.status = $3)
      `,
      [tenantId, actionActorId, filters.status ?? null]
    );
    const total = parseInt(countRow?.total ?? '0', 10);

    const rows = await runQueriesWithTenant<{
      request_id: string;
      status: string;
      requested_start: Date;
      provider_actor_id: string;
      category_id: string | null;
      payment_status: string | null;
      paid_at: Date | null;
    }>(
      tenantId,
      `
      SELECT
        r.id AS request_id,
        r.status,
        r.requested_start,
        s.actor_id AS provider_actor_id,
        s.category_id,
        r.payment_status,
        r.paid_at
      FROM service_discovery_requests r
      INNER JOIN services s
        ON s.service_id = r.service_id AND s.tenant_id = r.tenant_id
      WHERE r.tenant_id = $1
        AND r.customer_actor_id = (
          SELECT id FROM actors
          WHERE tenant_id = $1 AND actor_id = $2
          LIMIT 1
        )
        AND ($3::text IS NULL OR r.status = $3)
      ORDER BY r.created_at DESC
      LIMIT $4 OFFSET $5
      `,
      [tenantId, actionActorId, filters.status ?? null, filters.limit, filters.offset]
    );

    const items = rows.map((row) => ({
      requestId: row.request_id,
      status: row.status as ServiceDiscoveryRequestStatus,
      datetime: iso(row.requested_start)!,
      providerActorId: row.provider_actor_id,
      categoryId: row.category_id,
      paymentStatus: row.payment_status,
      paidAt: iso(row.paid_at),
    }));

    return { items, total, limit: filters.limit, offset: filters.offset };
  }

  /**
   * Pedidos recebidos nas ofertas do prestador (actor autenticado).
   */
  async listProviderRequests(
    tenantId: string,
    actionActorId: string,
    filters: { status?: ServiceDiscoveryRequestStatus; limit: number; offset: number }
  ) {
    const countRow = await runQueryWithTenant<{ total: string }>(
      tenantId,
      `
      SELECT COUNT(*)::text AS total
      FROM service_discovery_requests r
      INNER JOIN services s
        ON s.service_id = r.service_id AND s.tenant_id = r.tenant_id
      WHERE r.tenant_id = $1
        AND s.actor_id = $2
        AND ($3::text IS NULL OR r.status = $3)
      `,
      [tenantId, actionActorId, filters.status ?? null]
    );
    const total = parseInt(countRow?.total ?? '0', 10);

    const rows = await runQueriesWithTenant<{
      request_id: string;
      status: string;
      requested_start: Date;
      customer_actor_id: string;
      category_id: string | null;
      payment_status: string | null;
      paid_at: Date | null;
    }>(
      tenantId,
      `
      SELECT
        r.id AS request_id,
        r.status,
        r.requested_start,
        cust.actor_id AS customer_actor_id,
        s.category_id,
        r.payment_status,
        r.paid_at
      FROM service_discovery_requests r
      INNER JOIN services s
        ON s.service_id = r.service_id AND s.tenant_id = r.tenant_id
      INNER JOIN actors cust
        ON cust.id = r.customer_actor_id AND cust.tenant_id = r.tenant_id
      WHERE r.tenant_id = $1
        AND s.actor_id = $2
        AND ($3::text IS NULL OR r.status = $3)
      ORDER BY r.created_at DESC
      LIMIT $4 OFFSET $5
      `,
      [tenantId, actionActorId, filters.status ?? null, filters.limit, filters.offset]
    );

    const items = rows.map((row) => ({
      requestId: row.request_id,
      status: row.status as ServiceDiscoveryRequestStatus,
      datetime: iso(row.requested_start)!,
      customerActorId: row.customer_actor_id,
      categoryId: row.category_id,
      paymentStatus: row.payment_status,
      paidAt: iso(row.paid_at),
    }));

    return { items, total, limit: filters.limit, offset: filters.offset };
  }
}

export const servicesDiscoveryService = new ServicesDiscoveryService();