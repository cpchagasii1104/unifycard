// frontend/src/components/temporal/TemporalTimeInput.tsx
// Componente reutilizável de input de tempo com lógica canônica da Agenda Universal
// ⚠️ REGRA CANÔNICA: Mesma UX e inteligência em todo o sistema

import { useState, useEffect } from 'react';
import { normalizeTimeValue } from '../../utils/temporal/normalizeTime';
import './TemporalTimeInput.css';

export interface TemporalTimeInputProps {
  /** Valor atual (formato HH:MM) */
  value: string | null;
  /** Callback quando valor muda */
  onChange: (value: string | null) => void;
  /** Callback quando campo perde foco (validação tardia) */
  onBlur?: (value: string | null, isValid: boolean) => void;
  /** Label do campo */
  label?: string;
  /** Placeholder */
  placeholder?: string;
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
  /** Validação customizada (retorna mensagem de erro ou null) */
  customValidation?: (value: string | null) => string | null;
  /** Tab index para navegação */
  tabIndex?: number;
}

/**
 * Componente de input de tempo com lógica canônica da Agenda Universal
 * 
 * Características:
 * - Input livre durante digitação (sem validação bloqueante)
 * - Normalização inteligente de múltiplos formatos
 * - Validação tardia apenas no onBlur
 * - Navegação por Tab natural
 * - Mesma UX em todo o sistema
 */
export default function TemporalTimeInput({
  value,
  onChange,
  onBlur,
  label,
  placeholder = 'HH:MM',
  required = false,
  id,
  name,
  disabled = false,
  className = '',
  errorMessage,
  customValidation,
  tabIndex,
}: TemporalTimeInputProps) {
  // Estado de draft para permitir digitação livre
  const [draft, setDraft] = useState<string>(value || '');
  const [localError, setLocalError] = useState<string | null>(null);
  const [hasBlurred, setHasBlurred] = useState(false);

  // Sincronizar draft com value externo
  useEffect(() => {
    if (value !== null && value !== draft) {
      setDraft(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // ⚠️ REGRA CANÔNICA: Input livre, sem validação durante digitação
    setDraft(rawValue);
    setLocalError(null); // Limpar erro ao digitar
    
    // Atualizar valor imediatamente (para feedback visual)
    // Mas validação só acontece no onBlur
    onChange(rawValue || null);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setHasBlurred(true);

    // ⚠️ REGRA CANÔNICA: Validação tardia apenas no onBlur
    
    // Caso 1: Campo vazio
    if (!rawValue || rawValue.trim() === '' || rawValue === '--:--') {
      if (required) {
        const error = 'Campo obrigatório';
        setLocalError(error);
        onChange(null);
        onBlur?.(null, false);
        return;
      }
      // Se não é obrigatório, permitir vazio
      onChange(null);
      onBlur?.(null, true);
      return;
    }

    // Caso 2: Normalizar valor
    const normalized = normalizeTimeValue(rawValue);
    
    if (normalized === null) {
      // Formato inválido
      const error = 'Formato inválido (use HH:MM, ex: 14:30)';
      setLocalError(error);
      onChange(null);
      onBlur?.(null, false);
      return;
    }

    // Caso 3: Valor normalizado válido
    setDraft(normalized);
    setLocalError(null);
    
    // Aplicar validação customizada se fornecida
    if (customValidation) {
      const customError = customValidation(normalized);
      if (customError) {
        setLocalError(customError);
        onChange(normalized);
        onBlur?.(normalized, false);
        return;
      }
    }

    onChange(normalized);
    onBlur?.(normalized, true);
  };

  const displayError = errorMessage || localError;
  const showError = hasBlurred && displayError;

  return (
    <div className={`temporal-time-input ${className}`}>
      {label && (
        <label htmlFor={id} className="temporal-time-input-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      <input
        id={id}
        name={name}
        type="text"
        value={draft}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        tabIndex={tabIndex}
        className={`temporal-time-input-field ${showError ? 'error' : ''}`}
        autoComplete="off"
      />
      {showError && (
        <div className="temporal-time-input-error">
          ⚠️ {displayError}
        </div>
      )}
    </div>
  );
}

