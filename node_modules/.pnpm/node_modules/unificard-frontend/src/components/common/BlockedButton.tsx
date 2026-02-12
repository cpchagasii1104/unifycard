// frontend/src/components/common/BlockedButton.tsx
// Botão bloqueado com tooltip explicativo
// 🔴 BLINDAGEM: Usado para bloquear ações quando acordo não está FINALIZED

import { useState } from 'react';
import './BlockedButton.css';

interface BlockedButtonProps {
  children: React.ReactNode;
  reason: string;
  className?: string;
}

export default function BlockedButton({ children, reason, className = '' }: BlockedButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="blocked-button-wrapper">
      <button
        className={`blocked-button ${className}`}
        disabled
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {children}
      </button>
      {showTooltip && (
        <div className="blocked-button-tooltip">
          <div className="tooltip-arrow" />
          <div className="tooltip-content">
            <strong>⚠️ Ação Bloqueada</strong>
            <p>{reason}</p>
          </div>
        </div>
      )}
    </div>
  );
}




