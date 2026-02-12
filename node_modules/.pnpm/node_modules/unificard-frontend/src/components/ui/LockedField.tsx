// src/components/ui/LockedField.tsx
// Componente enterprise para exibir campos imutáveis bloqueados

import { useState } from 'react';
import './LockedField.css';

interface LockedFieldProps {
  /** Valor a ser exibido */
  value: string;
  
  /** Label do campo */
  label?: string;
  
  /** Formatação customizada do valor */
  formatValue?: (value: string) => string;
  
  /** Mensagem do tooltip */
  tooltipMessage?: string;
  
  /** Classe CSS adicional */
  className?: string;
}

/**
 * Campo bloqueado com cadeado e tooltip
 * Padrão: sistemas bancários, fintechs, gov.br
 */
export default function LockedField({
  value,
  label,
  formatValue,
  tooltipMessage = 'Este dado é imutável após o cadastro. Para alterar, entre em contato com o administrador.',
  className = '',
}: LockedFieldProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const displayValue = formatValue && value ? formatValue(value) : (value || '');
  const isEmpty = !value || (typeof value === 'string' && value.trim() === '');

  return (
    <div className={`locked-field ${className}`}>
      {label && (
        <label className="locked-field-label">
          {label}
          <span className="locked-field-required"> *</span>
        </label>
      )}
      
      <div className="locked-field-container">
        <div className="locked-field-display">
          <span className="locked-field-value">
            {isEmpty ? (
              <span className="locked-field-empty">Não informado</span>
            ) : (
              displayValue
            )}
          </span>
          
          <div
            className="locked-field-icon-container"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
            role="button"
            tabIndex={0}
            aria-label="Informação sobre campo bloqueado"
          >
            <svg
              className="locked-field-icon"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 0C5.79 0 4 1.79 4 4v1H3c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1h10c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1h-1V4c0-2.21-1.79-4-4-4zm0 1c1.66 0 3 1.34 3 3v1H5V4c0-1.66 1.34-3 3-3z"
                fill="currentColor"
              />
            </svg>
            
            {showTooltip && (
              <div className="locked-field-tooltip">
                <div className="locked-field-tooltip-arrow" />
                <div className="locked-field-tooltip-content">
                  <div className="locked-field-tooltip-header">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M8 0C5.79 0 4 1.79 4 4v1H3c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1h10c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1h-1V4c0-2.21-1.79-4-4-4zm0 1c1.66 0 3 1.34 3 3v1H5V4c0-1.66 1.34-3 3-3z"
                        fill="currentColor"
                      />
                    </svg>
                    <span>Dado Imutável</span>
                  </div>
                  <p className="locked-field-tooltip-message">{tooltipMessage}</p>
                  <a
                    href="mailto:admin@unificard.com?subject=Solicitação de Alteração de Dados Civis"
                    className="locked-field-tooltip-link"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    Solicitar alteração ao administrador →
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

