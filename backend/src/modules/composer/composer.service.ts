// backend/src/modules/composer/composer.service.ts
// F-COMPOSER-CONTRACT-C1 — projeta o contrato server-driven do compositor a partir do SSOT de intents.
//
// 🔴 SSOT ÚNICO (INTENTS_ACTOR_CONTRATO.md): NÃO há registry de intents próprio aqui. O compositor
// itera o enum canônico `ActorIntent` e DELEGA a decisão de "pode criar?" ao validador central
// `actorIntentsService.validateIntent` (capacidade via INTENT_CAPABILITY_MAP + permissão via authority).
// Assim compositor e social-2.0 (que valida o mesmo intent no POST) SEMPRE respondem igual — Lei de
// Coerência §5. O único conhecimento LOCAL é de PROJEÇÃO/UX (rótulo de exibição + deeplink do wizard +
// quais intents fazem sentido no modo consuming×operating) — nunca a IDENTIDADE nem a AUTORIDADE do intent.

import { actorPageRepository } from '@modules/actor-page/actor-page.repository';
import { actorIntentsService } from '@modules/social/actor-intents.service';
import { ActorIntent } from '@modules/social/actor-intents.types';
import type { ComposerContract, ComposerIntent, ComposerMode } from './composer.types';

class ComposerError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * PROJEÇÃO local (UX apenas): rótulo de exibição + deeplink do wizard vivo + em quais modos o intent
 * é oferecido. A CHAVE (identidade) e o enabled (autoridade) vêm do SSOT — isto é só apresentação,
 * espelhando o padrão do actor-page (que também provê labels pt-BR de projeção). Cobre os 8 intents
 * vivos do IntentComposer; ANNOUNCE_JOB/REQUEST_HELP/SEND_CTA/RECEIVE_PAYMENT existem no enum mas ainda
 * não têm superfície de composição (não projetados até terem — o cliente não finge que existem).
 */
type IntentProjection = {
  label: string; deeplink: string | null; modes: ComposerMode[];
  group: ComposerIntent['group']; description: string; icon: string; audienceLabel: string; targetComposer: string;
};
const INTENT_PROJECTION: Partial<Record<ActorIntent, IntentProjection>> = {
  [ActorIntent.SHARE_CONTENT]:   { label: 'Publicar conteúdo', deeplink: null, modes: ['consuming', 'operating'],
    group: 'communicate', description: 'Compartilhe uma atualização.', icon: 'message', audienceLabel: 'Para quem é esta publicação?', targetComposer: 'post' },
  [ActorIntent.REQUEST_BOOKING]: { label: 'Solicitar agendamento', deeplink: null, modes: ['consuming'],
    group: 'commerce', description: 'Peça um horário/agendamento.', icon: 'calendar-check', audienceLabel: 'Para quem é este agendamento?', targetComposer: 'booking' },
  [ActorIntent.OFFER_SERVICE]:   { label: 'Oferecer serviço', deeplink: '/services/new', modes: ['operating'],
    group: 'commerce', description: 'Publique um serviço que este Actor oferece.', icon: 'briefcase', audienceLabel: 'Para quem é este serviço?', targetComposer: 'service' },
  [ActorIntent.OFFER_PRODUCT]:   { label: 'Vender produto', deeplink: null, modes: ['operating'],
    group: 'commerce', description: 'Crie uma oferta de produto.', icon: 'cart', audienceLabel: 'Para quem é esta oferta?', targetComposer: 'product' },
  // 2026-07-06 (Clayton, F2-C): evento também em CONSUMING — PF cria aniversário/festa sem "operar".
  // Projeção UX (modes) apenas; a IDENTIDADE e o gate (validateIntent) seguem no SSOT.
  [ActorIntent.ANNOUNCE_EVENT]:  { label: 'Criar evento', deeplink: '/events/new', modes: ['consuming', 'operating'],
    group: 'communicate', description: 'Organize um evento ou encontro.', icon: 'calendar', audienceLabel: 'Para quem é este evento?', targetComposer: 'event' },
  // DECISION-0164 fatia B (Clayton: "Oferecer oportunidade"): a DEMANDA no composer.
  // REQUEST_HELP ganhou superfície viva (/oportunidades) — deeplink como ANNOUNCE_EVENT.
  // NÃO é redundante com OFFER_SERVICE: oferta ("eu presto") ≠ demanda ("eu preciso") — dois
  // lados do MESMO mercado, cada um no seu trilho (services vs service_demands).
  [ActorIntent.REQUEST_HELP]:    { label: 'Oferecer oportunidade', deeplink: '/oportunidades?tab=publicar', modes: ['consuming', 'operating'],
    group: 'commerce', description: 'Peça serviço, recurso ou ajuda ao mercado local.', icon: 'target', audienceLabel: 'Quem deve ver esta demanda?', targetComposer: 'demand' },
  [ActorIntent.CREATE_PROJECT]:  { label: 'Propor projeto comunitário', deeplink: null, modes: ['consuming'],
    group: 'governance', description: 'Apresente uma proposta para mobilizar pessoas ou recursos.', icon: 'project', audienceLabel: 'Quem deve ver esta proposta?', targetComposer: 'project' },
  [ActorIntent.START_VOTE]:      { label: 'Abrir votação', deeplink: null, modes: ['consuming', 'operating'],
    group: 'governance', description: 'Abra uma proposta de votação sujeita a regras de elegibilidade.', icon: 'vote', audienceLabel: 'Quem pode participar desta votação?', targetComposer: 'vote' },
};

class ComposerService {
  /**
   * Enumera os intents que [actingActor, mode] pode CRIAR. `actingActorId` já foi provado representável
   * por req.user na ROTA (canRepresentActor). Cada intent projetado tem enabled/gatedBy do validador
   * canônico — o compositor NÃO decide autoridade, PROJETA a decisão do SSOT.
   */
  async getContract(
    tenantId: string,
    actingActorId: string,
    mode: ComposerMode
  ): Promise<ComposerContract> {
    const actor = await actorPageRepository.getActorHeaderRow(tenantId, actingActorId);
    if (!actor) throw new ComposerError(404, 'Actor não encontrado neste tenant');

    const intents: ComposerIntent[] = [];
    // Itera o SSOT (ActorIntent), na ordem do enum, projetando só os que têm superfície de composição
    // e que fazem sentido neste modo. O enabled/gatedBy é do validador central (capacidade + permissão).
    for (const intent of Object.values(ActorIntent)) {
      const proj = INTENT_PROJECTION[intent];
      if (!proj || !proj.modes.includes(mode)) continue;

      const verdict = await actorIntentsService.validateIntent(tenantId, actingActorId, intent);
      intents.push({
        intent,
        label: proj.label,
        enabled: verdict.valid,
        ...(verdict.valid ? {} : { gatedBy: verdict.requiredCapability ?? verdict.reason ?? 'SEM_CAPACIDADE' }),
        deeplink: proj.deeplink,
        group: proj.group,
        description: proj.description,
        icon: proj.icon,
        audienceLabel: proj.audienceLabel,
        targetComposer: proj.targetComposer,
      });
    }

    return {
      actingActorId: actor.id,
      actorType: actor.actor_type,
      mode,
      intents,
    };
  }
}

export const composerService = new ComposerService();
