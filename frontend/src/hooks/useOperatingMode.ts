// frontend/src/hooks/useOperatingMode.ts
// 2026-05-16: hook do modo operante (camada de intenção contextual dentro do actor).
//
// Diretriz Clayton (memory project_modo_operante.md):
//   actor          = quem sou         (identidade soberana — não muda)
//   modo operante  = o que faço agora (intenção contextual — reorganiza prioridade)
//
// Persistência: localStorage POR actor (chave operatingModeStorageKey(actorId)).
// Trocar de actor relê a preferência do novo actor — sem inércia.
// Fallback inicial: defaultModeForActorType(actor.actor_type).
//
// Princípio âncora: prioriza, NÃO esconde, NÃO reorganiza soberania.

import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../contexts/SessionProvider';
import {
  type OperatingMode,
  defaultModeForActorType,
  operatingModeStorageKey,
} from '../config/operatingMode';

const OPERATING_MODE_CHANGED_EVENT = 'unificard-operating-mode-changed';

export interface UseOperatingModeResult {
  mode: OperatingMode;
  setMode: (mode: OperatingMode) => void;
  toggle: () => void;
}

function readPersistedMode(actorId: string | null | undefined, actorType: string | null | undefined): OperatingMode {
  const fallback = defaultModeForActorType(actorType);
  if (!actorId || typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(operatingModeStorageKey(actorId));
    if (stored === 'consumir' || stored === 'operar') return stored;
  } catch {
    // localStorage indisponível (modo privado etc.) — fallback silencioso
  }
  return fallback;
}

export function useOperatingMode(): UseOperatingModeResult {
  const { activeActor } = useSession();
  const actorId = activeActor?.actor_id ?? null;
  const actorType = activeActor?.actor_type ?? null;

  const [mode, setModeState] = useState<OperatingMode>(() =>
    readPersistedMode(actorId, actorType)
  );

  // Reset ao trocar actor — lê preferência do novo actor (ou default por tipo)
  useEffect(() => {
    setModeState(readPersistedMode(actorId, actorType));
  }, [actorId, actorType]);

  // Mantém múltiplos controles na mesma tela sincronizados por actor.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleModeChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ actorId: string | null; mode: OperatingMode }>).detail;
      if (!detail || detail.actorId !== actorId) return;
      setModeState(detail.mode);
    };

    window.addEventListener(OPERATING_MODE_CHANGED_EVENT, handleModeChanged);
    return () => window.removeEventListener(OPERATING_MODE_CHANGED_EVENT, handleModeChanged);
  }, [actorId]);

  const setMode = useCallback(
    (next: OperatingMode) => {
      setModeState(next);
      if (actorId && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(operatingModeStorageKey(actorId), next);
        } catch {
          // Persistência opcional — runtime continua coerente mesmo se falhar
        }
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(OPERATING_MODE_CHANGED_EVENT, {
          detail: { actorId, mode: next },
        }));
      }
    },
    [actorId]
  );

  const toggle = useCallback(() => {
    setMode(mode === 'consumir' ? 'operar' : 'consumir');
  }, [mode, setMode]);

  return { mode, setMode, toggle };
}
