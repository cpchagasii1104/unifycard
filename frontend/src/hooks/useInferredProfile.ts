// frontend/src/hooks/useInferredProfile.ts
// 2026-05-18 P2 — hook que carrega o perfil inferido do actor ativo.
//
// Princípio: frontend NUNCA infere — passa actor ao backend e renderiza
// o que voltar. Backend agrega de SSOT (event_attendees, group_members).
//
// Comportamento:
//   - Carrega para qualquer actor_type — backend decide o que retornar
//     (pages retornam communities=[] por design; user retorna ambos)
//   - Não bloqueia render — consumidores fazem if (data) { ... }
//   - Falha silenciosa em 401/403 (retorna vazio)

import { useEffect, useState } from 'react';
import { useSession } from '../contexts/SessionProvider';
import { isAuthenticated, getTenantId } from '../config/auth';
import {
  getInferredProfile,
  type InferredProfileResponse,
} from '../api/profile-inference';

export interface UseInferredProfileResult {
  data: InferredProfileResponse | null;
  loading: boolean;
  error: string | null;
}

export function useInferredProfile(): UseInferredProfileResult {
  const { sessionReady, activeActor } = useSession();
  const [data, setData] = useState<InferredProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      return;
    }
    setLoading(true);
    setError(null);
    getInferredProfile(activeActor.actor_id)
      .then((res) => setData(res))
      .catch((err) => {
        setError(err?.message ?? 'Falha ao carregar perfil inferido');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [sessionReady, activeActor?.actor_id]);

  return { data, loading, error };
}
