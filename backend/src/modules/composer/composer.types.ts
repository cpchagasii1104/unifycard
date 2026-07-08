// backend/src/modules/composer/composer.types.ts
// F-COMPOSER-CONTRACT-C1 — o CONTRATO server-driven do COMPOSITOR (projeção read-only).
//
// 🔴 RECONCILIAÇÃO NORMATIVA (2026-07-06, após auditoria de SSOT/ontologia): a 1ª versão de C1 INVENTOU
// um vocabulário paralelo de intents (chaves `seek_service`/`post_personal`... + um `economicFlow`
// não-governado). ISSO VIOLAVA o SSOT de intents. A verdade dos intents é UMA só e vive no contrato
// canônico `INTENTS_ACTOR_CONTRATO.md` (subordinado a CORE_IMUTAVEL):
//   · enum `ActorIntent` (modules/social/actor-intents.types.ts) = SSOT das intenções de ação (LAYER 4
//     INTENT da ontologia 18, CONGELADA);
//   · `INTENT_CAPABILITY_MAP` + `actorIntentsService.validateIntent()` = quem decide se um actor PODE
//     criar cada intent (capacidade + permissão), CENTRALMENTE.
// Blindagem do contrato: "UI/módulo NÃO decide intent; intent é semântica governada". Portanto o
// compositor NÃO enumera com chaves próprias nem re-implementa a decisão — PROJETA o `ActorIntent`
// governado e DELEGA o enabled/gated ao validador canônico. Zero verdade paralela (Lei de Coerência §2/§5).
//
// FRONTEIRAS (mesmas do actor-page, §2.4 SELADO): read-only; autoridade fail-closed na rota
// (canRepresentActor); anti-dinheiro (contrato nunca carrega valor); substrato/capacidade morta não é
// oferecida como viva (validateIntent retorna enabled:false com razão governada).

import type { ActorIntent } from '@modules/social/actor-intents.types';

export type ComposerMode = 'consuming' | 'operating';

/** Grupo de intenção (projeção UX). Governado aqui como vocabulário de APRESENTAÇÃO do launcher, não
 *  como ontologia nova — só reagrupa os ActorIntent já existentes para exibição. */
export type ComposerIntentGroup = 'communicate' | 'commerce' | 'governance';

export interface ComposerIntent {
  /** chave GOVERNADA = valor do enum canônico ActorIntent (NÃO uma string inventada pelo compositor). */
  intent: ActorIntent;
  /** rótulo de exibição (UI/projeção — mesmo padrão do actor-page; a IDENTIDADE é `intent`, não o label). */
  label: string;
  /** pode criar AGORA? projeta o veredito do validador canônico (capacidade + permissão). */
  enabled: boolean;
  /** por que desabilitado: razão/capacidade governada devolvida por validateIntent, ou gate de dinheiro. */
  gatedBy?: string;
  /** rota REAL do wizard vivo quando o ato tem superfície própria (evento/serviço), ou null (in-composer). */
  deeplink: string | null;
  // ── PROJEÇÃO UX do launcher (aditivo; a IDENTIDADE/AUTORIDADE seguem em intent/enabled) ──
  /** agrupamento de exibição (comunicar/comercializar/autogestão). */
  group: ComposerIntentGroup;
  /** descrição curta do ato (uma linha). */
  description: string;
  /** ícone semântico (chave de ícone, o front mapeia p/ glifo). */
  icon: string;
  /** pergunta de plateia que o compositor específico faz UMA vez (ex.: "Para quem é este evento?"). */
  audienceLabel: string;
  /** qual compositor específico abre (post/event/service/product/demand/project/vote/booking). */
  targetComposer: string;
}

export interface ComposerContract {
  /** o actor COMO QUAL se compõe (resolvido/validado server-side na rota via canRepresentActor). */
  actingActorId: string;
  actorType: string;
  mode: ComposerMode;
  /** intents projetados do SSOT canônico (ActorIntent), com enabled/gated do validador central. */
  intents: ComposerIntent[];
}
