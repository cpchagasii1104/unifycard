// src/contexts/ActiveActorContext.tsx
// Wrapper para compatibilidade - agora usa SessionProvider internamente

import { useSession } from './SessionProvider';
import { isAuthenticated } from '../config/auth';
import type { AvailableActor } from '../api/social';

// Re-exportar tipos
export type { AvailableActor };

/**
 * Hook de compatibilidade que usa SessionProvider
 * Mantido para não quebrar código existente
 */
export function useActiveActor() {
  const session = useSession();

  return {
    activeActor: session.activeActor,
    actors: session.actors,
    /** Carregando enquanto sessão autenticada ainda não hidratou (bootstrap em curso) */
    isLoading: isAuthenticated() && !session.authHydrated,
    setActiveActor: session.setActiveActor,
    refreshActors: session.refreshActors,
    hasValidActor: session.hasValidActor,
    authHydrated: session.authHydrated,
  };
}

// ActiveActorProvider não é mais necessário - SessionProvider faz o trabalho
// Mantido apenas para compatibilidade de imports
export function ActiveActorProvider({ children }: { children: React.ReactNode }) {
  // Este provider não faz nada - SessionProvider já está no App.tsx
  return <>{children}</>;
}

