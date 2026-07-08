// frontend/src/hooks/useAudienceOptions.ts
// Fetch CENTRALIZADO da fonte única de plateia (Clayton 2026-07-07). Um lugar só chama
// /audience-options; os componentes recebem a lista pronta. Muda por ACTOR (refaz o fetch quando o
// actor ativo troca), NUNCA por modo operante. Frontend não decide PF/PJ — o backend deriva de
// PAIR_ALLOWED_LABELS. Zero lista local, zero fallback hardcoded.
import { useEffect, useState } from 'react';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { getAudienceOptions, type AudienceOption } from '../api/audience';

export interface UseAudienceOptionsResult {
  options: AudienceOption[];
  actorType: string | null;
  loading: boolean;
}

export function useAudienceOptions(): UseAudienceOptionsResult {
  const { activeActor } = useActiveActor();
  const [options, setOptions] = useState<AudienceOption[]>([]);
  const [actorType, setActorType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeActor?.actor_id) { setOptions([]); setActorType(null); return; }
    let alive = true;
    setLoading(true);
    getAudienceOptions()
      .then((a) => { if (alive) { setOptions(a.options); setActorType(a.actorType); } })
      .catch(() => { if (alive) { setOptions([]); setActorType(null); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [activeActor?.actor_id, activeActor?.actor_type]);

  return { options, actorType, loading };
}
