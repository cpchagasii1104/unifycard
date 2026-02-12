// 🔴 UX TEMPORAL CANÔNICO — INPUT DECLARATIVO
// Este componente/hook/util:
// - NÃO cria verdade temporal
// - NÃO bloqueia agenda
// - NÃO resolve conflitos
// - NÃO cria bookings
// - NÃO interfere em Unified Availability
// A verdade temporal está exclusivamente no Core (Agenda Universal)

import React from 'react';
import { useTimeRange } from '../../hooks/temporal/useTimeRange';
import { useTemporalValidation } from '../../hooks/temporal/useTemporalValidation';
import './TimeRangePicker.css';

export interface TimeRangePickerProps {
  // Valores iniciais
  start?: string;
  end?: string;
  
  // Callbacks
  onChange?: (start: string, end: string) => void;
  onBlur?: (start: string, end: string) => void;
  onConfirm?: (start: string, end: string) => void;
  
  // Validação
  intervals?: Array<{ start: string; end: string }>;
  currentIndex?: number;
  
  // Placeholders
  startPlaceholder?: string;
  endPlaceholder?: string;
  
  // Estados
  disabled?: boolean;
  required?: boolean;
  
  // Classes CSS
  className?: string;
  errorClassName?: string;
}

/**
 * Componente TimeRangePicker - Padrão UX Temporal Canônico
 * Permite entrada de intervalo de tempo com validação assistiva
 * NÃO cria verdade temporal, apenas coleta INPUT declarativo
 */
export const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
  start: initialStart = '',
  end: initialEnd = '',
  onChange,
  onBlur,
  onConfirm,
  intervals = [],
  currentIndex,
  startPlaceholder = 'Início',
  endPlaceholder = 'Fim',
  disabled = false,
  required = false,
  className = '',
  errorClassName = '',
}) => {
  const timeRange = useTimeRange(initialStart, initialEnd);
  const validation = useTemporalValidation({
    validateOnChange: false, // Validar apenas em onBlur/confirm
    autoAdjust: true,
    intervals,
    currentIndex,
  });

  // Inicializar quando valores iniciais mudarem (apenas se não houver draft)
  React.useEffect(() => {
    if (!timeRange.draft && (initialStart !== timeRange.start || initialEnd !== timeRange.end)) {
      timeRange.initialize(initialStart, initialEnd);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStart, initialEnd]);

  // Atualizar draft durante digitação (SEM validação)
  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    timeRange.updateDraft('start', value);
    
    // Atualizar schedule imediatamente (pode ser inválido temporariamente)
    const currentEnd = timeRange.draft?.end || timeRange.end;
    if (onChange) {
      onChange(value, currentEnd);
    }
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    timeRange.updateDraft('end', value);
    
    // Atualizar schedule imediatamente (pode ser inválido temporariamente)
    const currentStart = timeRange.draft?.start || timeRange.start;
    if (onChange) {
      onChange(currentStart, value);
    }
  };

  // Validar e ajustar em onBlur
  const handleStartBlur = () => {
    const validated = timeRange.getValidated();
    const adjusted = validation.adjust(validated.start, validated.end);
    
    if (adjusted) {
      timeRange.updateDraft('start', adjusted.start);
      if (adjusted.end) {
        timeRange.updateDraft('end', adjusted.end);
      }
      
      if (adjusted.message) {
        // Mostrar mensagem de ajuste temporariamente
        setTimeout(() => validation.clearError(), 3000);
      }
    }
    
    // Validar
    const result = validation.validate(validated.start, validated.end);
    if (!result.valid && result.error) {
      // Erro será exibido pelo componente
    }
    
    if (onBlur) {
      const final = timeRange.getValidated();
      onBlur(final.start, final.end);
    }
  };

  const handleEndBlur = () => {
    const validated = timeRange.getValidated();
    const adjusted = validation.adjust(validated.start, validated.end);
    
    if (adjusted) {
      timeRange.updateDraft('start', adjusted.start);
      if (adjusted.end) {
        timeRange.updateDraft('end', adjusted.end);
      }
      
      if (adjusted.message) {
        // Mostrar mensagem de ajuste temporariamente
        setTimeout(() => validation.clearError(), 3000);
      }
    }
    
    // Validar
    const result = validation.validate(validated.start, validated.end);
    if (!result.valid && result.error) {
      // Erro será exibido pelo componente
    }
    
    if (onBlur) {
      const final = timeRange.getValidated();
      onBlur(final.start, final.end);
    }
  };

  // Confirmar (validar e persistir)
  const handleConfirm = () => {
    const validated = timeRange.getValidated();
    const result = validation.validate(validated.start, validated.end);
    
    if (!result.valid) {
      // Não confirmar se inválido
      return;
    }
    
    const confirmed = timeRange.confirm();
    if (confirmed && onConfirm) {
      onConfirm(confirmed.start, confirmed.end);
    }
  };

  const hasError = !!validation.error;
  const currentStart = timeRange.start;
  const currentEnd = timeRange.end;

  return (
    <div className={`time-range-picker ${className} ${hasError ? 'has-error' : ''}`}>
      <input
        type="time"
        value={currentStart}
        onChange={handleStartChange}
        onBlur={handleStartBlur}
        placeholder={startPlaceholder}
        disabled={disabled}
        required={required}
        className={`time-input ${hasError ? errorClassName || 'error' : ''}`}
      />
      <span className="time-separator">até</span>
      <input
        type="time"
        value={currentEnd || ''}
        onChange={handleEndChange}
        onBlur={handleEndBlur}
        placeholder={endPlaceholder}
        disabled={disabled}
        required={required}
        className={`time-input ${hasError ? errorClassName || 'error' : ''}`}
      />
      {hasError && (
        <span className="field-error-small">{validation.error}</span>
      )}
    </div>
  );
};

