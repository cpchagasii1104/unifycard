// 🔴 UX TEMPORAL CANÔNICO — INPUT DECLARATIVO
// Este componente/hook/util:
// - NÃO cria verdade temporal
// - NÃO bloqueia agenda
// - NÃO resolve conflitos
// - NÃO cria bookings
// - NÃO interfere em Unified Availability
// A verdade temporal está exclusivamente no Core (Agenda Universal)

import { useState, useCallback } from 'react';
import {
  validateTimeFormat,
  validateTimeRange,
  validateNoOverlap,
  validateOrdered,
  TimeRangeValidation,
} from '../../utils/temporal/validateTimeRange';
import { timeToMinutes, minutesToTime } from '../../utils/temporal/formatTime';

export interface TemporalValidationOptions {
  // Validar apenas em momentos explícitos (onBlur, confirm)
  validateOnChange?: boolean;
  
  // Ajustar automaticamente valores inválidos
  autoAdjust?: boolean;
  
  // Intervalos para validação de sobreposição/ordem
  intervals?: Array<{ start: string; end: string }>;
  
  // Índice do intervalo atual (para validação de sobreposição)
  currentIndex?: number;
}

export interface UseTemporalValidationReturn {
  // Erro atual (se houver)
  error: string | null;
  
  // Validar intervalo
  validate: (start: string, end: string) => TimeRangeValidation;
  
  // Ajustar valores inválidos automaticamente
  adjust: (start: string, end: string) => { start: string; end: string; message?: string } | null;
  
  // Limpar erro
  clearError: () => void;
}

export function useTemporalValidation(options: TemporalValidationOptions = {}): UseTemporalValidationReturn {
  const { validateOnChange = false, autoAdjust = true, intervals = [], currentIndex } = options;
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback((start: string, end: string): TimeRangeValidation => {
    // Validar formato básico
    const formatValidation = validateTimeFormat(start);
    if (!formatValidation.valid) {
      setError(formatValidation.error || 'Formato inválido');
      return formatValidation;
    }

    if (!end || end.trim() === '') {
      const errorMsg = 'Horário de fim é obrigatório';
      setError(errorMsg);
      return { valid: false, error: errorMsg };
    }

    // Validar intervalo básico
    const rangeValidation = validateTimeRange(start, end);
    if (!rangeValidation.valid) {
      setError(rangeValidation.error || 'Intervalo inválido');
      return rangeValidation;
    }

    // Validar sobreposição se houver intervalos
    if (intervals.length > 0 && currentIndex !== undefined) {
      const overlapValidation = validateNoOverlap(intervals, currentIndex, start, end);
      if (!overlapValidation.valid) {
        setError(overlapValidation.error || 'Sobreposição detectada');
        return overlapValidation;
      }

      // Validar ordem
      const orderValidation = validateOrdered(intervals, currentIndex, start);
      if (!orderValidation.valid) {
        setError(orderValidation.error || 'Ordem inválida');
        return orderValidation;
      }
    }

    // Tudo válido
    setError(null);
    return { valid: true };
  }, [intervals, currentIndex]);

  const adjust = useCallback((start: string, end: string): { start: string; end: string; message?: string } | null => {
    if (!start) return null;

    let adjustedStart = start;
    let adjustedEnd = end;
    let wasAdjusted = false;
    let message: string | undefined;

    // Calcular mínimo permitido para start (end do intervalo anterior)
    let minStartMinutes = 0;
    let minStartTime = '00:00';

    if (intervals.length > 0 && currentIndex !== undefined && currentIndex > 0) {
      // Encontrar intervalo anterior
      const currentStartMinutes = timeToMinutes(start);
      for (const interval of intervals) {
        if (!interval.end) continue;
        const intervalEndMinutes = timeToMinutes(interval.end);
        if (intervalEndMinutes <= currentStartMinutes && intervalEndMinutes > minStartMinutes) {
          minStartMinutes = intervalEndMinutes;
          minStartTime = interval.end;
        }
      }
    }

    // Ajustar start se necessário
    const startMinutes = timeToMinutes(start);
    if (startMinutes < minStartMinutes) {
      adjustedStart = minutesToTime(minStartMinutes);
      wasAdjusted = true;
      message = `Horário ajustado para ${adjustedStart} (próximo disponível após ${minStartTime})`;
    }

    // Ajustar end se necessário
    if (end) {
      const endMinutes = timeToMinutes(end);
      const adjustedStartMinutes = timeToMinutes(adjustedStart);

      if (endMinutes <= adjustedStartMinutes) {
        // End deve ser pelo menos 15 minutos depois do start
        adjustedEnd = minutesToTime(adjustedStartMinutes + 15);
        wasAdjusted = true;
        if (!message) {
          message = `Horário de fim ajustado para ${adjustedEnd} (mínimo 15 minutos após início)`;
        }
      } else {
        adjustedEnd = end;
      }
    }

    return wasAdjusted ? { start: adjustedStart, end: adjustedEnd, message } : null;
  }, [intervals, currentIndex]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    validate,
    adjust,
    clearError,
  };
}


