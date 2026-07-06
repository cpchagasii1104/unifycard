// backend/src/modules/composer/composer.service.ts
// F-COMPOSER-CONTRACT-C1 — compõe o contrato server-driven do compositor.
//
// O REGISTRO DE INTENTS (espelha o BLOCK_REGISTRY do actor-page §2.2b): cada intent declara em que
// [kind × modo] está disponível, sua categoria econômica, audiências e o gate quando aplicável.
// Adicionar um ato = registrar aqui, nunca o cliente inventar. READ-ONLY: zero escrita.
//
// C1 = o ESQUELETO server-driven + registry por tipo/modo. C2 (próxima fatia) LAYER os intents por
// PAPEL/DEPARTAMENTO lendo actor_delegations.relationship_type (R2, agora vivo) — RH vê Vaga, Warehouse
// vê Procura-Fornecedor. C1 não decide papel ainda; enumera por tipo de actor + modo.

import { actorPageRepository, type ActorHeaderRow } from '@modules/actor-page/actor-page.repository';
import type { ActorKind } from '@modules/relationships/actor-relationship.types';
import type {
  ComposerAudience,
  ComposerContract,
  ComposerIntent,
  ComposerMode,
} from './composer.types';

class ComposerError extends Error {
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

/** Definição declarativa de um intent — disponibilidade por [kind × modo] + categoria + gate. */
interface IntentDefinition {
  key: ComposerIntent['key'];
  label: string;
  economicFlow: ComposerIntent['economicFlow'];
  audiences: ComposerAudience[];
  deeplink: string | null;
  /** em quais modos o ato aparece. */
  modes: ComposerMode[];
  /** em quais kinds de actor o ato aparece (pf/pj). */
  kinds: ActorKind[];
  /** gate fixo quando o ato ainda não pode ser criado (substrato contido, fluxo não-wired). undefined = enabled. */
  gatedBy?: string;
}

// Os 9 intents do IntentComposer vivo, agora enumerados SERVER-SIDE com categoria econômica e gate honesto.
const INTENT_REGISTRY: IntentDefinition[] = [
  // ── Social puro (sem transação) — ambos os modos, todo actor ──
  { key: 'post_personal', label: 'Post pessoal', economicFlow: 'social', audiences: ['public', 'friends', 'only_me'], deeplink: null, modes: ['consuming', 'operating'], kinds: ['pf', 'pj'] },
  { key: 'post_friends', label: 'Post para conexões', economicFlow: 'social', audiences: ['connections', 'friends'], deeplink: null, modes: ['consuming', 'operating'], kinds: ['pf', 'pj'] },

  // ── Fluxo de SAÍDA (dinheiro sai) — buscar serviço/produto = gasto futuro; consuming ──
  //    Criar a BUSCA não move dinheiro (a transação é no fulfillment) → enabled.
  { key: 'seek_service', label: 'Procurar serviço', economicFlow: 'saida', audiences: ['public'], deeplink: null, modes: ['consuming'], kinds: ['pf', 'pj'] },
  { key: 'seek_product', label: 'Procurar produto', economicFlow: 'saida', audiences: ['public'], deeplink: null, modes: ['consuming'], kinds: ['pf', 'pj'] },

  // ── Fluxo de ENTRADA (dinheiro entra) — ofertar = receita futura; operating ──
  //    Criar a OFERTA não move dinheiro → enabled; o pagamento é PORTA-1 no ato do comprador (outra superfície).
  { key: 'offer_service', label: 'Oferecer serviço', economicFlow: 'entrada', audiences: ['public'], deeplink: '/services/new', modes: ['operating'], kinds: ['pf', 'pj'] },
  { key: 'offer_product', label: 'Vender produto', economicFlow: 'entrada', audiences: ['public'], deeplink: null, modes: ['operating'], kinds: ['pf', 'pj'] },
  { key: 'event', label: 'Criar evento', economicFlow: 'entrada', audiences: ['public', 'connections'], deeplink: '/events/new', modes: ['operating'], kinds: ['pf', 'pj'] },

  // ── Autogestão (a Cadeia do Projeto do APRENDIZADO) ──
  //    Projeto = social (a alocação de fundo é PORTA-1, depois da votação) → criar a ideia é enabled.
  { key: 'project', label: 'Propor projeto comunitário', economicFlow: 'social', audiences: ['public'], deeplink: null, modes: ['consuming'], kinds: ['pf'] },
  //    Voto: o substrato de votes está CONTIDO (schema-ghost, YALA-PASS) — decisão de elegibilidade é L4.
  //    Não fingimos que existe: enabled:false gatedBy nomeado (a verdade do substrato manda).
  { key: 'vote', label: 'Abrir votação', economicFlow: 'social', audiences: ['public', 'group'], deeplink: null, modes: ['consuming', 'operating'], kinds: ['pf', 'pj'], gatedBy: 'SUBSTRATO_CONTIDO_L4' },
];

class ComposerService {
  /**
   * Enumera os intents que [actingActor, mode] pode CRIAR. `actingActorId` já foi provado representável
   * por req.user na ROTA (canRepresentActor fail-closed) — este service não re-decide autoridade, enumera.
   */
  async getContract(
    tenantId: string,
    actingActorId: string,
    mode: ComposerMode
  ): Promise<ComposerContract> {
    const actor = await actorPageRepository.getActorHeaderRow(tenantId, actingActorId);
    if (!actor) throw new ComposerError(404, 'Actor não encontrado neste tenant');

    const kind = kindOf(actor);
    if (!kind) throw new ComposerError(422, 'Tipo de actor não elegível ao compositor');

    const intents: ComposerIntent[] = INTENT_REGISTRY
      .filter((def) => def.modes.includes(mode) && def.kinds.includes(kind))
      .map((def) => ({
        key: def.key,
        label: def.label,
        economicFlow: def.economicFlow,
        enabled: def.gatedBy === undefined,
        ...(def.gatedBy !== undefined ? { gatedBy: def.gatedBy } : {}),
        audiences: def.audiences,
        deeplink: def.deeplink,
      }));

    return {
      actingActorId: actor.id,
      actorType: actor.actor_type,
      mode,
      intents,
    };
  }
}

export const composerService = new ComposerService();
