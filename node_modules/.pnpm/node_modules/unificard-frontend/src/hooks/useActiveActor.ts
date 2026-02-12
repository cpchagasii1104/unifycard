// frontend/src/hooks/useActiveActor.ts
// Hook que adapta useSession para a interface esperada por DashboardPage
// Retorna activeActor com propriedade 'id' mapeada de 'actor_id'

import { useSession } from '../contexts/SessionProvider';
import type { AvailableActor } from '../api/social';

interface ActiveActorWithId extends Omit<AvailableActor, 'actor_id'> {
  id: string;
}

export function useActiveActor() {
  const { activeActor } = useSession();
  
  // Adaptar activeActor para ter propriedade 'id' em vez de 'actor_id'
  const adaptedActor: ActiveActorWithId | null = activeActor
    ? {
        ...activeActor,
        id: activeActor.actor_id,
      }
    : null;

  return {
    activeActor: adaptedActor,
  };
}





