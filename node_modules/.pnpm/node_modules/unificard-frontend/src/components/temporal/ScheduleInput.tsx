// 🔴 UX TEMPORAL CANÔNICO — INPUT DECLARATIVO
// Este componente/hook/util:
// - NÃO cria verdade temporal
// - NÃO bloqueia agenda
// - NÃO resolve conflitos
// - NÃO cria bookings
// - NÃO interfere em Unified Availability
// A verdade temporal está exclusivamente no Core (Agenda Universal)

import React, { useState } from 'react';
import { TimeRangePicker } from './TimeRangePicker';
import { parseTimeRange, formatTimeRange } from '../../utils/temporal/formatTime';
import './ScheduleInput.css';

export interface ScheduleInputProps {
  // Intervalos atuais (formato: "09:00-18:00")
  intervals: string[];
  
  // Callback quando intervalos mudam
  onChange: (intervals: string[]) => void;
  
  // Validação
  validateOnChange?: boolean;
  
  // Classes CSS
  className?: string;
}

/**
 * Componente ScheduleInput - Padrão UX Temporal Canônico
 * Gerencia múltiplos intervalos de tempo para um dia
 * NÃO cria verdade temporal, apenas coleta INPUT declarativo
 */
export const ScheduleInput: React.FC<ScheduleInputProps> = ({
  intervals,
  onChange,
  validateOnChange = false,
  className = '',
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newSlotVisible, setNewSlotVisible] = useState(false);

  // Adicionar novo intervalo
  const handleAddInterval = () => {
    const currentIntervals = [...intervals];
    
    // Calcular startTime: endTime do último intervalo (ou 09:00 se vazio)
    let defaultStart = '09:00';
    if (currentIntervals.length > 0) {
      const sortedIntervals = [...currentIntervals].sort((a, b) => {
        const aStart = parseTimeRange(a).start;
        const bStart = parseTimeRange(b).start;
        return aStart.localeCompare(bStart);
      });
      
      const lastInterval = sortedIntervals[sortedIntervals.length - 1];
      const { end } = parseTimeRange(lastInterval);
      if (end) {
        defaultStart = end;
      }
    }
    
    // Novo intervalo: startTime pré-preenchido, endTime vazio
    const newInterval = `${defaultStart}-`;
    const newIntervals = [...currentIntervals, newInterval];
    onChange(newIntervals);
    
    setEditingIndex(newIntervals.length - 1);
    setNewSlotVisible(true);
  };

  // Atualizar intervalo
  const handleIntervalChange = (index: number, start: string, end: string) => {
    const newIntervals = [...intervals];
    newIntervals[index] = formatTimeRange(start, end);
    onChange(newIntervals);
  };

  // Remover intervalo
  const handleRemoveInterval = (index: number) => {
    const newIntervals = intervals.filter((_, i) => i !== index);
    onChange(newIntervals);
    
    if (editingIndex === index) {
      setEditingIndex(null);
      setNewSlotVisible(false);
    }
  };

  // Confirmar intervalo
  const handleConfirmInterval = (index: number, start: string, end: string) => {
    if (!end || end.trim() === '') {
      // Não confirmar se endTime vazio
      return;
    }
    
    const newIntervals = [...intervals];
    newIntervals[index] = formatTimeRange(start, end);
    
    // Ordenar intervalos após confirmação
    newIntervals.sort((a, b) => {
      const aStart = parseTimeRange(a).start;
      const bStart = parseTimeRange(b).start;
      return aStart.localeCompare(bStart);
    });
    
    onChange(newIntervals);
    setEditingIndex(null);
    setNewSlotVisible(false);
  };

  // Converter intervalos para formato de validação
  const validationIntervals = intervals.map((interval) => {
    const { start, end } = parseTimeRange(interval);
    return { start, end };
  });

  return (
    <div className={`schedule-input ${className}`}>
      {intervals.map((interval, index) => {
        const { start, end } = parseTimeRange(interval);
        const isNewSlot = index === intervals.length - 1 && newSlotVisible;
        const isEditing = editingIndex === index;

        return (
          <div key={index} className={`schedule-interval ${isNewSlot ? 'new-slot' : ''}`}>
            <TimeRangePicker
              start={start}
              end={end}
              onChange={(newStart, newEnd) => handleIntervalChange(index, newStart, newEnd)}
              onBlur={(newStart, newEnd) => {
                // Validação em onBlur
              }}
              onConfirm={(newStart, newEnd) => {
                if (isNewSlot) {
                  handleConfirmInterval(index, newStart, newEnd);
                }
              }}
              intervals={validationIntervals}
              currentIndex={index}
              endPlaceholder={isNewSlot && !end ? 'Selecione' : 'Fim'}
            />
            <button
              type="button"
              onClick={() => handleRemoveInterval(index)}
              className="remove-interval-button"
              title="Remover horário"
            >
              ✕
            </button>
            {isNewSlot && (
              <button
                type="button"
                onClick={() => {
                  if (end && end.trim() !== '') {
                    handleConfirmInterval(index, start, end);
                  }
                }}
                className="confirm-interval-button"
                title="Confirmar horário"
                disabled={!end || end.trim() === ''}
              >
                ✓
              </button>
            )}
          </div>
        );
      })}
      
      {!newSlotVisible && (
        <button
          type="button"
          onClick={handleAddInterval}
          className="add-interval-button"
          title="Adicionar intervalo"
        >
          + Adicionar intervalo
        </button>
      )}
    </div>
  );
};


