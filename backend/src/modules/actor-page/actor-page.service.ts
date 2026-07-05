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
  ActorPageMode,
  ActorPageTab,
} from './actor-page.types';

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
  probe: (tenantId: string, actorId: string) => Promise<number>;
  /** rota REAL do fluxo vivo (hub §2.3) ou null (conteúdo in-page) */
  deeplink: (actorId: string) => string | null;
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
    deeplink: () => null, // conteúdo rico = Fatia 4
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
    probe: (t, a) => actorPageRepository.countFutureAvailability(t, a),
    deeplink: () => null,
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
    const counts = await Promise.all(BLOCK_REGISTRY.map((b) => b.probe(tenantId, actorId)));

    const blocks: ActorPageBlock[] = [
      // Sobre sempre existe (projeção do próprio actor)
      { type: 'about', tab: 'about', deeplink: null, data: { bio: actor.bio, headline } },
    ];
    const tabs: ActorPageTab[] = [
      { key: 'all', label: 'Tudo' },
      { key: 'about', label: 'Sobre' },
    ];

    BLOCK_REGISTRY.forEach((def, i) => {
      if (counts[i] > 0) {
        blocks.push({ type: def.type, tab: def.tab, deeplink: def.deeplink(actorId), data: { count: counts[i] } });
        tabs.push({ key: def.tab, label: def.tabLabel });
      }
    });

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
      },
      actions,
      tabs,
      blocks,
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
