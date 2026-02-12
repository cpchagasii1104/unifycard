// frontend/src/components/temporal/TemporalDateInput.tsx
// Componente reutilizável de input de data com lógica canônica
// ⚠️ REGRA CANÔNICA: Mesma UX e validação tardia em todo o sistema

import { useState, useEffect } from 'react';
import './TemporalDateInput.css';

export interface TemporalDateInputProps {
  /** Valor atual (formato YYYY-MM-DD) */
  value: string | null;
  /** Callback quando valor muda */
  onChange: (value: string | null) => void;
  /** Callback quando campo perde foco (validação tardia) */
  onBlur?: (value: string | null, isValid: boolean) => void;
  /** Label do campo */
  label?: string;
  /** Se o campo é obrigatório */
  required?: boolean;
  /** ID do campo */
  id?: string;
  /** Nome do campo */
  name?: string;
  /** Se está desabilitado */
  disabled?: boolean;
  /** Classe CSS adicional */
  className?: string;
  /** Mensagem de erro customizada */
  errorMessage?: string;
  /** Data mínima (formato YYYY-MM-DD) */
  minDate?: string;
  /** Data máxima (formato YYYY-MM-DD) */
  maxDate?: string;
  /** Validação customizada (retorna mensagem de erro ou null) */
  customValidation?: (value: string | null) => string | null;
  /** Tab index para navegação */
  tabIndex?: number;
}

/**
 * Componente de input de data com lógica canônica
 * 
 * Características:
 * - Input livre durante digitação
 * - Validação tardia apenas no onBlur
 * - Navegação por Tab natural
 * - Mesma UX em todo o sistema
 */
export default function TemporalDateInput({
  value,
  onChange,
  onBlur,
  label,
  required = false,
  id,
  name,
  disabled = false,
  className = '',
  errorMessage,
  minDate,
  maxDate,
  customValidation,
  tabIndex,
}: TemporalDateInputProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [hasBlurred, setHasBlurred] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // ⚠️ REGRA CANÔNICA: Input livre, sem validação durante digitação
    setLocalError(null); // Limpar erro ao digitar
    onChange(rawValue || null);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setHasBlurred(true);

    // 🔴 UX FIX: Aguardar um pouco antes de validar para não interferir com calendário nativo
    // O calendário nativo pode causar blur temporário quando abre/fecha
    setTimeout(() => {
      // Verificar se o input ainda não tem foco (blur real, não temporário)
      if (document.activeElement !== e.target) {
        validateAndBlur(rawValue, e.target);
      }
    }, 150);
  };

  const validateAndBlur = (rawValue: string, inputElement: HTMLInputElement) => {
    // ⚠️ REGRA CANÔNICA: Validação tardia apenas no onBlur
    
    // Caso 1: Campo vazio
    if (!rawValue || rawValue.trim() === '') {
      if (required) {
        const error = 'Campo obrigatório';
        setLocalError(error);
        onChange(null);
        onBlur?.(null, false);
        return;
      }
      onChange(null);
      onBlur?.(null, true);
      return;
    }

    // Caso 2: Validar formato básico (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(rawValue)) {
      const error = 'Formato inválido (use YYYY-MM-DD)';
      setLocalError(error);
      onChange(null);
      onBlur?.(null, false);
      return;
    }

    // Caso 3: Validar se é data válida
    const date = new Date(rawValue);
    if (isNaN(date.getTime())) {
      const error = 'Data inválida';
      setLocalError(error);
      onChange(null);
      onBlur?.(null, false);
      return;
    }

    // Caso 4: Validar limites (min/max)
    if (minDate && rawValue < minDate) {
      const error = `Data não pode ser anterior a ${minDate}`;
      setLocalError(error);
      onChange(null);
      onBlur?.(null, false);
      return;
    }

    if (maxDate && rawValue > maxDate) {
      const error = `Data não pode ser posterior a ${maxDate}`;
      setLocalError(error);
      onChange(null);
      onBlur?.(null, false);
      return;
    }

    // Caso 5: Aplicar validação customizada se fornecida
    if (customValidation) {
      const customError = customValidation(rawValue);
      if (customError) {
        setLocalError(customError);
        onChange(rawValue);
        onBlur?.(rawValue, false);
        return;
      }
    }

    // Caso 6: Valor válido
    setLocalError(null);
    onChange(rawValue);
    onBlur?.(rawValue, true);
  };

  const displayError = errorMessage || localError;
  const showError = hasBlurred && displayError;

  return (
    <div className={`temporal-date-input ${className}`}>
      {label && (
        <label htmlFor={id} className="temporal-date-input-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      <input
        id={id}
        name={name}
        type="date"
        value={value || ''}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        required={required}
        min={minDate}
        max={maxDate}
        tabIndex={tabIndex}
        className={`temporal-date-input-field ${showError ? 'error' : ''}`}
      />
      {showError && (
        <div className="temporal-date-input-error">
          ⚠️ {displayError}
        </div>
      )}
    </div>
  );
}

