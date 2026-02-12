// 🔴 UX TEMPORAL CANÔNICO — INPUT DECLARATIVO
// Este componente/hook/util:
// - NÃO cria verdade temporal
// - NÃO bloqueia agenda
// - NÃO resolve conflitos
// - NÃO cria bookings
// - NÃO interfere em Unified Availability
// A verdade temporal está exclusivamente no Core (Agenda Universal)

import React from 'react';
import './DatePicker.css';

export interface DatePickerProps {
  // Valor inicial
  value?: string; // formato: YYYY-MM-DD
  
  // Callbacks
  onChange?: (date: string) => void;
  onBlur?: (date: string) => void;
  
  // Placeholder
  placeholder?: string;
  
  // Estados
  disabled?: boolean;
  required?: boolean;
  min?: string; // formato: YYYY-MM-DD
  max?: string; // formato: YYYY-MM-DD
  
  // Classes CSS
  className?: string;
  errorClassName?: string;
}

/**
 * Componente DatePicker - Padrão UX Temporal Canônico
 * Permite entrada de data com validação básica
 * NÃO cria verdade temporal, apenas coleta INPUT declarativo
 */
export const DatePicker: React.FC<DatePickerProps> = ({
  value = '',
  onChange,
  onBlur,
  placeholder = 'Selecione uma data',
  disabled = false,
  required = false,
  min,
  max,
  className = '',
  errorClassName = '',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    if (onChange) {
      onChange(date);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const date = e.target.value;
    if (onBlur) {
      onBlur(date);
    }
  };

  return (
    <div className={`date-picker ${className}`}>
      <input
        type="date"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        className={`date-input ${errorClassName}`}
      />
    </div>
  );
};


