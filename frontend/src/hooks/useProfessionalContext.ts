// frontend/src/hooks/useProfessionalContext.ts
// 2026-05-15: hook que retorna contexto profissional do actor ATIVO se aplicável.
//
// Materializa diretrizes:
//   - "actor como modo operacional" + sub-camada "perfil profissional contextual"
//   - "lente operacional principal naquele momento" (não isolamento — sistema
//     SEMPRE conhece a pessoa toda; profissão é uma das dimensões)
//
// Comportamento:
//   - Apenas para actor_type === 'user' (profissional é dimensão da pessoa física)
//   - Lê profile.metadata.profession assincronamente
//   - Retorna null durante carregamento OU se não houver profissão mapeada
//   - NÃO bloqueia render (consumidores fazem if (professionalContext) { ... })
//
// Uso:
//   const profCtx = useProfessionalContext();
//   if (profCtx) { /* user é dentista/advogada/etc — adaptar UI */ }

import { useEffect, useState } from 'react';
import { useSession } from '../contexts/SessionProvider';
import { getProfile } from '../api/profile';
import { isAuthenticated, getTenantId } from '../config/auth';
import {
  resolveProfessionalContext,
  type ProfessionalContextDefinition,
} from '../config/professionalContextCatalog';

export interface UseProfessionalContextResult {
  /** Definição do contexto profissional ativo, ou null se não aplicável. */
  context: ProfessionalContextDefinition | null;
  /** Profissão crua (string livre) do profile, antes de mapear no catálogo. */
  rawProfession: string | null;
  /** Áreas profissionais salvas no profile (override do catálogo se preenchido). */
  professionalAreas: string[];
  /** Loading state inicial. */
  loading: boolean;
}

export function useProfessionalContext(): UseProfessionalContextResult {
  const { sessionReady, activeActor } = useSession();
  const [rawProfession, setRawProfession] = useState<string | null>(null);
  const [professionalAreas, setProfessionalAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Profissional é dimensão da PF — só carrega para actor_type='user'
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setLoading(false);
      return;
    }
    if (activeActor.actor_type !== 'user') {
      setRawProfession(null);
      setProfessionalAreas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getProfile()
      .then((profile) => {
        const md = profile.metadata ?? {};
        const profession = typeof md.profession === 'string' ? md.profession : null;
        const areas = Array.isArray(md.professional_areas)
          ? md.professional_areas.filter((a): a is string => typeof a === 'string')
          : [];
        setRawProfession(profession);
        setProfessionalAreas(areas);
      })
      .catch(() => {
        setRawProfession(null);
        setProfessionalAreas([]);
      })
      .finally(() => setLoading(false));
  }, [sessionReady, activeActor?.actor_id, activeActor?.actor_type]);

  const context = resolveProfessionalContext(rawProfession);

  return {
    context,
    rawProfession,
    professionalAreas,
    loading,
  };
}
