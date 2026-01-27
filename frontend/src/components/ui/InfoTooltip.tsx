// src/components/ui/InfoTooltip.tsx
// Componente de tooltip informativo profissional

import { useState } from 'react';
import './InfoTooltip.css';

interface InfoTooltipProps {
  /** Conteúdo do tooltip */
  content: string;
  
  /** Tamanho do ícone (px) */
  size?: number;
  
  /** Posição do tooltip */
  position?: 'top' | 'bottom' | 'left' | 'right';
  
  /** Classe CSS adicional */
  className?: string;
}

/**
 * Tooltip informativo com ícone de informação
 * Padrão: fintech, gov.br
 */
export default function InfoTooltip({
  content,
  size = 16,
  position = 'top',
  className = '',
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span
      className={`info-tooltip-container ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={() => setIsVisible(!isVisible)}
      role="button"
      tabIndex={0}
      aria-label="Informação adicional"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="info-tooltip-icon"
      >
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path
          d="M8 11V8M8 5H8.01"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      
      {isVisible && (
        <div className={`info-tooltip info-tooltip-${position}`}>
          <div className="info-tooltip-arrow" />
          <div className="info-tooltip-content">{content}</div>
        </div>
      )}
    </span>
  );
}







