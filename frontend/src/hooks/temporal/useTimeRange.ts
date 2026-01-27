// 🔴 UX TEMPORAL CANÔNICO — INPUT DECLARATIVO
// Este componente/hook/util:
// - NÃO cria verdade temporal
// - NÃO bloqueia agenda
// - NÃO resolve conflitos
// - NÃO cria bookings
// - NÃO interfere em Unified Availability
// A verdade temporal está exclusivamente no Core (Agenda Universal)

import { useState, useCallback } from 'react';
import { formatTimeRange, parseTimeRange } from '../../utils/temporal/formatTime';

/**
 * Hook para gerenciar estado de intervalo de tempo (draft vs validado)
 * Separa claramente estado temporário (pode ser inválido) de estado validado
 */
export interface TimeRangeState {
  start: string;
  end: string;
}

export interface UseTimeRangeReturn {
  // Estado atual (draft se existir, senão validado)
  start: string;
  end: string;
  
  // Draft (estado temporário durante digitação)
  draft: TimeRangeState | null;
  
  // Atualizar draft (sem validação)
  updateDraft: (field: 'start' | 'end', value: string) => void;
  
  // Confirmar draft (validar e persistir)
  confirm: () => TimeRangeState | null;
  
  // Descartar draft
  discard: () => void;
  
  // Inicializar com valores
  initialize: (start: string, end: string) => void;
  
  // Obter valor validado (draft se existir, senão inicial)
  getValidated: () => TimeRangeState;
}

export function useTimeRange(initialStart: string = '', initialEnd: string = ''): UseTimeRangeReturn {
  const [initial, setInitial] = useState<TimeRangeState>({ start: initialStart, end: initialEnd });
  const [draft, setDraft] = useState<TimeRangeState | null>(null);

  const updateDraft = useCallback((field: 'start' | 'end', value: string) => {
    setDraft((prev) => {
      const current = prev || initial;
      return {
        ...current,
        [field]: value,
      };
    });
  }, [initial]);

  const confirm = useCallback((): TimeRangeState | null => {
    if (!draft) return null;
    
    const confirmed = { ...draft };
    setInitial(confirmed);
    setDraft(null);
    return confirmed;
  }, [draft]);

  const discard = useCallback(() => {
    setDraft(null);
  }, []);

  const initialize = useCallback((start: string, end: string) => {
    setInitial({ start, end });
    setDraft(null);
  }, []);

  const getValidated = useCallback((): TimeRangeState => {
    return draft || initial;
  }, [draft, initial]);

  // Estado atual (draft se existir, senão inicial)
  const current = draft || initial;

  return {
    start: current.start,
    end: current.end,
    draft,
    updateDraft,
    confirm,
    discard,
    initialize,
    getValidated,
  };
}


