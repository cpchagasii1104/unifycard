// frontend/src/hooks/useBusinessProfile.ts
// 2026-05-18: hook que resolve o BusinessProfile do actor ativo (PJ).
//
// Análogo a useProfessionalContext (para PF) — materializa a diretriz
// "perfil de negócio é contexto contextual, não actor novo nem capability".
//
// Comportamento:
//   - Apenas para actor_type === 'page'
//   - Resolve via heurística sobre activeActor.display_name (zero network agora)
//   - Quando backend expor activity.mainActivityDescription no AvailableActor,
//     adicionar segunda via — código já aceita o argumento.
//
// Uso:
//   const { profile } = useBusinessProfile();
//   if (profile) { /* empresa é banda/clínica/loja/etc — adaptar UI */ }

import { useMemo } from 'react';
import { useSession } from '../contexts/SessionProvider';
import {
  resolveBusinessProfile,
  type BusinessProfileDefinition,
} from '../config/businessProfileCatalog';

export interface UseBusinessProfileResult {
  /** Perfil de negócio resolvido, ou null se actor não é page ou nada bateu. */
  profile: BusinessProfileDefinition | null;
  /** Conveniência: true quando actor é page (qualquer empresa). */
  isCompany: boolean;
}

export function useBusinessProfile(): UseBusinessProfileResult {
  const { activeActor } = useSession();

  return useMemo(() => {
    const isCompany = activeActor?.actor_type === 'page';
    if (!isCompany || !activeActor) {
      return { profile: null, isCompany: false };
    }
    // 2026-05-18 P1 Frente C — REVERTIDA. Coluna companies.activity inexistente
    // no schema material. Heurística por display_name é única via até backend
    // adicionar migration + propagar campo (DT-PRESSURE-AVAILABLE-ACTOR-ACTIVITY-FIELD).
    const profile = resolveBusinessProfile(activeActor.display_name, null);
    return { profile, isCompany };
  }, [activeActor]);
}
