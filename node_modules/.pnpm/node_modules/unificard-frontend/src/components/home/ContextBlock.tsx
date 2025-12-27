// src/components/home/ContextBlock.tsx
// Bloco de contexto do ator ativo

import type { HomeContextData } from '../../hooks/useHomeData';
import './ContextBlock.css';

interface ContextBlockProps {
  context: HomeContextData;
}

export default function ContextBlock({ context }: ContextBlockProps) {
  const cityDisplay = context.isLoadingCity ? '...' : (context.city || 'Cidade não informada');

  return (
    <div className="context-block">
      <div className="context-content">
        <span className="context-label">Você está operando como:</span>
        <span className="context-value">{context.actorName} · {context.actorType} · {cityDisplay}</span>
      </div>
    </div>
  );
}

