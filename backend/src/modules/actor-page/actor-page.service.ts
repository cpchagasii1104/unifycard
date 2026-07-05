// backend/src/modules/actor-page/actor-page.service.ts
// F-ACTOR-PAGE-SHELL-SLICE-3 — compõe o contrato server-driven da página do actor.
//
// O REGISTRO DE BLOCOS (DESENHO §2.2b): cada bloco declara seu probe no substrato vivo e a aba
// onde vive. "A aba existe se o bloco está aceso" — derivado do que o actor PUBLICOU, nunca
// hardcoded por vertical. Adicionar vertical = registrar bloco aqui, nunca página nova.
//
// AÇÕES (DESENHO §7, barra inicial sem-dinheiro): Conectar (substrato de relação vivo, Fatia 1);
// Mensagem/Agendar = 'EM_BREVE' (fluxo ainda não wired — frontend não finge); Comprar/Contratar
// RENDERIZAM mas nascem enabled:false gatedBy:'PORTA-1' (dinheiro soberano, §6).
// Modo Operando: as ações viram gestão, roteando pros fluxos vivos (/perfil, /services/new, /locacoes).

import { actorPageRepository, type ActorHeaderRow } from './actor-page.repository';
import {
  PAIR_ALLOWED_LABELS,
  pairKey,
  type ActorKind,
} from '../relationships/actor-relationship.types';
import type {
  ActorPageAction,
  ActorPageBlock,
  ActorPageContract,
  ActorPageHeader,
  ActorPageMode,
  ActorPageTab,
} from './actor-page.types';
// F-ACTOR-PAGE-SHELL-SLICE-4 — COMPOSIÇÃO (Lei de Coerência §5): o conteúdo rico dos blocos
// SEMPRE reusa o reader do módulo dono do pilar — este arquivo NUNCA escreve SQL novo para
// services/products/agenda/localização (guard audit-actor-page-contract.mjs trava isso).
import { servicesRepository } from '@modules/services/services.repository';
import { ServiceStatus } from '@modules/services/services.types';
import { listVisibleProducts } from '@modules/marketplace/product-visibility.service';
import { unifiedAvailabilityService } from '@core/availability/unified-availability.service';
import { AvailabilityOwnerType, UnifiedAvailabilityStatus } from '@core/availability/unified-availability.types';
import { resolveTemporalPurposeSlugById } from '@core/availability/temporal-purpose';
import { operationalAddressHelper } from '@core/location/operational-address.helper';
import { getFullAddress } from '@core/location/address-helpers';
import { supportTicketRepository } from '@modules/support-tickets/support-ticket.repository';
import { purchaseOrderRepository } from '@modules/marketplace/purchase-order.repository';

/** Teto de itens por bloco nesta fatia — sem paginação ainda (conteúdo cabe numa página inicial). */
const BLOCK_ITEMS_LIMIT = 10;

class ActorPageError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function kindOf(row: ActorHeaderRow): ActorKind | null {
  if (row.actor_type === 'page' || row.company_id) return 'pj';
  if (row.actor_type === 'user' || row.actor_type === 'actor_human' || row.actor_type === 'person') return 'pf';
  return null;
}

/** O REGISTRO: bloco → aba/label/probe/deeplink. Ordem = ordem das abas na barra. */
interface BlockDefinition {
  type: string;
  tab: ActorPageTab['key'];
  tabLabel: string;
  /** actor = header já resolvido (evita 2ª query; dá o actor_type pra probes que precisam dele) */
  probe: (tenantId: string, actorId: string, actor: ActorHeaderRow) => Promise<number>;
  /** rota REAL do fluxo vivo (hub §2.3) ou null (conteúdo in-page) */
  deeplink: (actorId: string) => string | null;
}

function availabilityOwnerType(actor: ActorHeaderRow): 'user' | 'page' {
  return kindOf(actor) === 'pj' ? 'page' : 'user';
}

const BLOCK_REGISTRY: BlockDefinition[] = [
  {
    type: 'posts', tab: 'posts', tabLabel: 'Posts',
    probe: (t, a) => actorPageRepository.countPublishedPosts(t, a),
    deeplink: () => null, // renderizado in-page pelo fluxo social vivo
  },
  {
    type: 'products', tab: 'products', tabLabel: 'Produtos',
    probe: (t, a) => actorPageRepository.countActiveProductOffers(t, a),
    deeplink: () => null, // conteúdo rico in-page (Fatia 4)
  },
  {
    type: 'services', tab: 'services', tabLabel: 'Serviços',
    probe: (t, a) => actorPageRepository.countActiveServices(t, a),
    deeplink: () => '/discover/services',
  },
  {
    type: 'rentals', tab: 'rentals', tabLabel: 'Locações',
    probe: (t, a) => actorPageRepository.countActiveRentals(t, a),
    deeplink: () => '/locacoes',
  },
  {
    type: 'agenda', tab: 'agenda', tabLabel: 'Agenda',
    probe: (t, a, actor) => actorPageRepository.countFutureAvailability(t, a, availabilityOwnerType(actor)),
    deeplink: () => null, // conteúdo rico in-page (Fatia 4)
  },
  {
    type: 'schedule_events', tab: 'schedule_events', tabLabel: 'Programação',
    probe: (t, a) => actorPageRepository.countUpcomingEvents(t, a),
    deeplink: () => null,
  },
];

class ActorPageService {
  /**
   * Monta o contrato. `viewerActorId` (actionContext, HINT) só personaliza dados de apoio
   * (labels permitidos do Conectar) — NUNCA decide autoridade; o modo 'operating' é gated
   * na ROTA por canRepresentActor (DECISION-0113).
   */
  async getContract(
    tenantId: string,
    actorId: string,
    mode: ActorPageMode,
    viewerActorId: string | null
  ): Promise<ActorPageContract> {
    const actor = await actorPageRepository.getActorHeaderRow(tenantId, actorId);
    if (!actor) throw new ActorPageError(404, 'Actor não encontrado neste tenant');

    const headline = await actorPageRepository.getPublicCardHeadline(tenantId, actorId);

    // probes em paralelo — o que o actor publicou decide o que acende
    const counts = await Promise.all(BLOCK_REGISTRY.map((b) => b.probe(tenantId, actorId, actor)));

    const blocks: ActorPageBlock[] = [
      // Sobre sempre existe (projeção do próprio actor)
      { type: 'about', tab: 'about', deeplink: null, data: { bio: actor.bio, headline } },
    ];
    const tabs: ActorPageTab[] = [
      { key: 'all', label: 'Tudo' },
      { key: 'about', label: 'Sobre' },
    ];

    for (const [i, def] of BLOCK_REGISTRY.entries()) {
      if (counts[i] > 0) {
        const base: ActorPageBlock = { type: def.type, tab: def.tab, deeplink: def.deeplink(actorId), data: { count: counts[i] } };
        // F-ACTOR-PAGE-SHELL-SLICE-4: hidrata conteúdo rico só para os 3 blocos desta fatia
        // (Sobre já é rico; Locações/Programação seguem count-only, fora de escopo aqui).
        blocks.push(await this.hydrateBlock(tenantId, actorId, actor, base));
        tabs.push({ key: def.tab, label: def.tabLabel });
      }
    }

    // Localização (Fatia 4) — bloco condicional fora do BLOCK_REGISTRY (não é "contagem de itens",
    // é presença/ausência de endereço operacional; DECISION-0020). Anti-PII: só cidade/estado/bairro,
    // NUNCA rua/número/lat-lng na página pública. "Aberto agora" não existe (sem schema de horário
    // de funcionamento) — nomeado, não construído.
    const location = await this.resolvePublicLocation(tenantId, actorId);
    if (location) {
      blocks.push({ type: 'location', tab: 'location', deeplink: null, data: { ...location } });
      tabs.push({ key: 'location', label: 'Localização' });
    }

    // F-ERP-COMPOSED-VIEW (Fatia 8) — vista integrada estoque+pedidos+agenda+financeiro, SÓ em
    // mode='operating' (gated por canRepresentActor na ROTA) e SÓ pra empresa (DECISION-0133:
    // owner empresarial = page+company_id). COMPOSIÇÃO PURA: estoque/agenda REUSAM os blocos JÁ
    // computados acima (zero leitura nova); pedidos usa o único reader novo desta fatia
    // (purchaseOrderRepository.listByOwner, escopado por owner_actor_id em SQL). Financeiro é
    // SÓ deeplink — nunca valor monetário embutido no contrato (fronteira anti-dinheiro do módulo, §topo).
    if (mode === 'operating' && actor.actor_type === 'page' && actor.company_id) {
      const productsBlock = blocks.find((b) => b.type === 'products');
      const agendaBlock = blocks.find((b) => b.type === 'agenda');
      const purchaseOrders = await purchaseOrderRepository.listByOwner(tenantId, actorId, { limit: BLOCK_ITEMS_LIMIT });
      blocks.push({
        type: 'erp',
        tab: 'erp',
        deeplink: null,
        data: {
          count: purchaseOrders.length,
          stock: { count: (productsBlock?.data.count as number) ?? 0, items: productsBlock?.data.items ?? [] },
          agenda: { count: (agendaBlock?.data.count as number) ?? 0 },
          purchaseOrders: {
            count: purchaseOrders.length,
            items: purchaseOrders.map((po) => ({
              id: po.id,
              supplierId: po.supplierId,
              status: po.status,
              orderDate: po.orderDate,
            })),
          },
          financeiro: { deeplink: '/wallet' },
        },
      });
      tabs.push({ key: 'erp', label: 'ERP' });
    }

    const lit = new Set(blocks.map((b) => b.type));
    const actions =
      mode === 'operating'
        ? this.buildOperatingActions(lit)
        : await this.buildConsumingActions(tenantId, actor, viewerActorId, lit);

    return {
      actorId: actor.id,
      mode,
      header: {
        actorId: actor.id,
        displayName: actor.display_name,
        actorType: actor.actor_type,
        slug: actor.slug,
        avatarUrl: actor.avatar_url,
        coverUrl: actor.cover_url,
        bio: actor.bio,
        headline,
        location,
      },
      actions,
      tabs,
      blocks,
    };
  }

  /**
   * F-ACTOR-PAGE-SHELL-SLICE-4 — conteúdo rico. COMPOSIÇÃO PURA: cada ramo chama o reader do
   * módulo dono do pilar (nunca SQL novo aqui). Teto `BLOCK_ITEMS_LIMIT` — sem paginação ainda.
   */
  private async hydrateBlock(
    tenantId: string,
    actorId: string,
    actor: ActorHeaderRow,
    base: ActorPageBlock
  ): Promise<ActorPageBlock> {
    switch (base.type) {
      case 'services': {
        const services = await servicesRepository.findByActor(tenantId, actorId, { status: ServiceStatus.ACTIVE });
        return {
          ...base,
          data: {
            ...base.data,
            items: services.slice(0, BLOCK_ITEMS_LIMIT).map((s) => ({
              serviceId: s.serviceId,
              name: s.name,
              slug: s.slug,
              shortDescription: s.shortDescription,
              priceCents: s.priceCents,
              currency: s.currency,
              pricingType: s.pricingType,
            })),
          },
        };
      }
      case 'products': {
        const products = await listVisibleProducts(tenantId, { merchantActorId: actorId, limit: BLOCK_ITEMS_LIMIT });
        return {
          ...base,
          data: {
            ...base.data,
            items: products.map((p) => ({
              offerId: p.offerId,
              name: p.name,
              brand: p.brand,
              priceCents: p.priceCents,
              availableQuantity: p.availableQuantity,
              imageUrl: p.images[0] ?? null,
            })),
          },
        };
      }
      case 'agenda': {
        const ownerType = availabilityOwnerType(actor) === 'page' ? AvailabilityOwnerType.PAGE : AvailabilityOwnerType.USER;
        const windows = await unifiedAvailabilityService.listAvailabilities(tenantId, {
          ownerId: actorId,
          ownerType,
          status: UnifiedAvailabilityStatus.ACTIVE,
          startDatetime: new Date(),
        });
        const purposeSlugById = await resolveTemporalPurposeSlugById();
        return {
          ...base,
          data: {
            ...base.data,
            items: windows.slice(0, BLOCK_ITEMS_LIMIT).map((w) => ({
              availabilityId: w.availabilityId,
              startDatetime: w.startDatetime,
              endDatetime: w.endDatetime,
              timezone: w.timezone,
              capacity: w.capacity ?? null,
              purposeSlug: w.purposeConceptId ? purposeSlugById.get(w.purposeConceptId) ?? null : null,
            })),
          },
        };
      }
      default:
        return base;
    }
  }

  /**
   * Localização pública (Location Core, DECISION-0020) — só cidade/estado/bairro. NUNCA rua/
   * número/lat-lng nem `postal_code` na página pública (endereço exato não é dado público).
   */
  private async resolvePublicLocation(
    tenantId: string,
    actorId: string
  ): Promise<ActorPageHeader['location']> {
    const assignment = await operationalAddressHelper.getOperationalAddressForActor(tenantId, actorId);
    if (!assignment) return null;
    const full = await getFullAddress({
      country_id: assignment.address.countryId,
      state_id: assignment.address.stateId ?? undefined,
      city_id: assignment.address.cityId ?? undefined,
      neighborhood_id: assignment.address.neighborhoodId ?? undefined,
    });
    if (!full?.city && !full?.state) return null;
    return {
      cityName: full?.city?.name ?? null,
      stateCode: full?.state?.code ?? null,
      neighborhoodName: full?.neighborhood?.name ?? null,
    };
  }

  private async buildConsumingActions(
    tenantId: string,
    target: ActorHeaderRow,
    viewerActorId: string | null,
    lit: Set<string>
  ): Promise<ActorPageAction[]> {
    const actions: ActorPageAction[] = [];

    // Conectar — substrato de relação VIVO (Fatia 1). allowedLabels = seed governado do PAR;
    // é dado de APOIO (o POST /relationships revalida tudo fail-closed).
    if (viewerActorId && viewerActorId !== target.id) {
      const viewer = await actorPageRepository.getActorHeaderRow(tenantId, viewerActorId);
      const viewerKind = viewer ? kindOf(viewer) : null;
      const targetKind = kindOf(target);
      if (viewerKind && targetKind) {
        const allowedLabels = PAIR_ALLOWED_LABELS[pairKey(viewerKind, targetKind)] ?? [];
        actions.push({
          key: 'connect', label: 'Conectar', enabled: allowedLabels.length > 0,
          deeplink: null, data: { allowedLabels },
        });
      }
    }

    actions.push({ key: 'message', label: 'Mensagem', enabled: false, gatedBy: 'EM_BREVE', deeplink: null });

    // Abrir chamado — F-SUPPORT-TICKET-BUSINESS-FACT-GATE (Fatia 6, DESENHO §5/§5B SELADO):
    // gated por FATO DE NEGÓCIO real (não por conexão). Composição pura: reusa o mesmo resolver
    // do módulo support-tickets — nunca reinventa a checagem aqui. Acende SÓ se existir ≥1
    // pedido/serviço/reserva REAL entre o viewer e este actor (qualquer um serve pra habilitar;
    // a escolha de QUAL referenciar é feita na abertura do chamado).
    if (viewerActorId && viewerActorId !== target.id) {
      const hasFact = await supportTicketRepository.hasAnyBusinessFact(tenantId, viewerActorId, target.id);
      actions.push({
        key: 'support_ticket', label: 'Abrir chamado', enabled: hasFact,
        gatedBy: hasFact ? undefined : 'SEM_FATO_DE_NEGOCIO', deeplink: null,
      });
    }

    if (lit.has('agenda')) {
      actions.push({ key: 'schedule', label: 'Agendar', enabled: false, gatedBy: 'EM_BREVE', deeplink: null });
    }
    // Comprar/Contratar RENDERIZAM mas o dinheiro é PORTA-1 (decisão soberana) — sempre gated.
    // Rótulos desambiguados (feedback Clayton 2026-07-04): "Contratar serviço" = contratar o
    // serviço que ESTE actor oferece (aparece em quem publicou serviço, PF ou PJ prestadora) —
    // NÃO é oferta de vaga/emprego (isso é outro fluxo, colaborador/onboarding).
    if (lit.has('products')) {
      actions.push({ key: 'buy', label: 'Comprar produtos', enabled: false, gatedBy: 'PORTA-1', deeplink: null });
    }
    if (lit.has('services')) {
      actions.push({ key: 'contract', label: 'Contratar serviço', enabled: false, gatedBy: 'PORTA-1', deeplink: null });
    }
    return actions;
  }

  /** Operando (o dono na própria página): mesmas superfícies viram GESTÃO — rotas REAIS vivas. */
  private buildOperatingActions(lit: Set<string>): ActorPageAction[] {
    const actions: ActorPageAction[] = [
      { key: 'edit_profile', label: 'Editar perfil', enabled: true, deeplink: '/perfil' },
      { key: 'create_service', label: 'Publicar serviço', enabled: true, deeplink: '/services/new' },
    ];
    if (lit.has('rentals')) {
      actions.push({ key: 'manage_rentals', label: 'Gerir locações', enabled: true, deeplink: '/locacoes' });
    }
    return actions;
  }
}

export const actorPageService = new ActorPageService();
