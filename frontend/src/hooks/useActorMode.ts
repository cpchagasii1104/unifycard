// frontend/src/hooks/useActorMode.ts
// 2026-05-15: hook que materializa "actor = modo operacional" no frontend.
// Diretriz Clayton: trocar actor reconfigura prioridades/atalhos/cards/CTAs.
//
// Não confundir com useActorContext (gestão de seleção do actor).
// Este hook responde: dado o actor ativo, qual é o MODO operacional do sistema?
//
// Componentes consomem o perfil contextual ao invés de espalhar lógica
// `if (actor.type === 'X')` pelo sistema.
//
// Uso:
//   const { profile, quickActions, isUser, isCompany } = useActorMode();

import { useMemo } from 'react';
import { useSession } from '../contexts/SessionProvider';
import { mapActorTypeToContext } from '../config/appsRegistry';
import {
  getActorContextProfile,
  resolveQuickActions,
  type ActorContextProfile,
  type QuickActionDefinition,
} from '../config/actorContextConfig';

export interface UseActorModeResult {
  /** Perfil operacional do actor ativo. PF como fallback se sem actor. */
  profile: ActorContextProfile;
  /** Quick actions resolvidas (definições prontas para render). */
  quickActions: QuickActionDefinition[];
  /** Shortcuts booleanos. */
  isUser: boolean;
  isCompany: boolean;
  isGroup: boolean;
  isChannel: boolean;
  /** Indica se há actor ativo. */
  hasActor: boolean;
}

export function useActorMode(): UseActorModeResult {
  const { activeActor } = useSession();

  return useMemo(() => {
    const actorType = activeActor?.actor_type;
    const context = actorType ? mapActorTypeToContext(actorType) : null;
    const profile = getActorContextProfile(context);
    const quickActions = resolveQuickActions(profile);

    return {
      profile,
      quickActions,
      isUser: actorType === 'user',
      isCompany: actorType === 'page',
      isGroup: actorType === 'group',
      isChannel: actorType === 'channel',
      hasActor: !!activeActor,
    };
  }, [activeActor]);
}
