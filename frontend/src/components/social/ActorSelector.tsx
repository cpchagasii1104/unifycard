// src/components/social/ActorSelector.tsx
// Seletor de ator (Passo 0) - escolher como quem está postando
// MELHORADO: Usa contexto persistente e melhor UX

import { useState, useEffect } from 'react';
import { getAvailableActors, type AvailableActor } from '../../api/social';
import './ActorSelector.css';

interface ActorSelectorProps {
  selectedActorId: string | null;
  onSelectActor: (actorId: string | null, actorType?: 'user' | 'page' | 'group' | 'channel') => void;
  disabled?: boolean;
  /**
   * Se true, mostra apenas o ator selecionado de forma compacta
   * Útil para mostrar contexto sem permitir mudança
   */
  compact?: boolean;
}

export default function ActorSelector({ selectedActorId, onSelectActor, disabled, compact = false }: ActorSelectorProps) {
  const [actors, setActors] = useState<AvailableActor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadActors();
  }, []);

  const loadActors = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const availableActors = await getAvailableActors();
      setActors(availableActors);
      
      // Selecionar automaticamente o primeiro actor (pessoal) se nenhum estiver selecionado
      if (!selectedActorId && availableActors.length > 0) {
        // 🔴 REGRA: Todas as empresas aparecem (can_post sempre true)
        const defaultActor = availableActors.find(a => a.actor_type === 'user') || availableActors[0];
        if (defaultActor) {
          onSelectActor(defaultActor.actor_id, defaultActor.actor_type);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar actors:', err);
      setError('Erro ao carregar opções. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedActor = actors.find(a => a.actor_id === selectedActorId);

  if (isLoading) {
    return (
      <div className="actor-selector">
        <div className="step-label">
          <span className="step-number">0</span>
          <span className="step-title">Você está atuando como:</span>
        </div>
        <div className="loading-actors">Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="actor-selector">
        <div className="step-label">
          <span className="step-number">0</span>
          <span className="step-title">Você está atuando como:</span>
        </div>
        <div className="error-message">{error}</div>
        <button type="button" onClick={loadActors} className="retry-button">
          Tentar novamente
        </button>
      </div>
    );
  }

  // Modo compacto: mostra apenas o ator selecionado
  if (compact && selectedActor) {
    const isPersonal = selectedActor.actor_type === 'user';
    const isCompany = selectedActor.actor_type === 'page';
    
    return (
      <div className="actor-selector actor-selector-compact">
        <div className="actor-compact-display">
          {selectedActor.avatar_url ? (
            <img src={selectedActor.avatar_url} alt={selectedActor.display_name} className="actor-avatar-small" />
          ) : (
            <div className="actor-avatar-placeholder-small">
              {isPersonal ? '👤' : isCompany ? '🏢' : '👥'}
            </div>
          )}
          <div className="actor-compact-info">
            <div className="actor-compact-name">{selectedActor.display_name}</div>
            {isCompany && selectedActor.user_role && (
              <div className="actor-compact-role">
                {selectedActor.user_role === 'owner' && '👑 Proprietário'}
                {selectedActor.user_role === 'director' && '💼 Diretor'}
                {selectedActor.user_role === 'manager' && '📋 Gerente'}
                {selectedActor.user_role === 'employee' && '👔 Funcionário'}
                {!['owner', 'director', 'manager', 'employee'].includes(selectedActor.user_role) && `📌 ${selectedActor.user_role}`}
              </div>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="actor-toggle-btn"
              title="Alterar ator"
            >
              {isExpanded ? '▲' : '▼'}
            </button>
          )}
        </div>
        
        {isExpanded && (
          <div className="actor-options-dropdown">
            {actors.map((actor) => {
              const isSelected = actor.actor_id === selectedActorId;
              const isActorPersonal = actor.actor_type === 'user';
              const isActorCompany = actor.actor_type === 'page';
              
              return (
                <button
                  key={actor.actor_id}
                  type="button"
                  className={`actor-option ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    onSelectActor(actor.actor_id, actor.actor_type);
                    setIsExpanded(false);
                  }}
                  disabled={disabled}
                >
                  <div className="actor-option-content">
                    {actor.avatar_url ? (
                      <img src={actor.avatar_url} alt={actor.display_name} className="actor-avatar" />
                    ) : (
                      <div className="actor-avatar-placeholder">
                        {isActorPersonal ? '👤' : isActorCompany ? '🏢' : '👥'}
                      </div>
                    )}
                    <div className="actor-option-info">
                      <div className="actor-name">{actor.display_name}</div>
                      {isActorCompany && actor.user_role && (
                        <div className="actor-role">
                          {actor.user_role === 'owner' && '👑 Proprietário'}
                          {actor.user_role === 'director' && '💼 Diretor'}
                          {actor.user_role === 'manager' && '📋 Gerente'}
                          {actor.user_role === 'employee' && '👔 Funcionário'}
                          {!['owner', 'director', 'manager', 'employee'].includes(actor.user_role) && `📌 ${actor.user_role}`}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Modo expandido: mostra todas as opções
  return (
    <div className="actor-selector">
      <div className="step-label">
        <span className="step-number">0</span>
        <span className="step-title">Você está atuando como:</span>
      </div>
      
      <div className="actor-options">
        {actors.map((actor) => {
          const isSelected = actor.actor_id === selectedActorId;
          const isPersonal = actor.actor_type === 'user';
          const isCompany = actor.actor_type === 'page';
          
          return (
            <button
              key={actor.actor_id}
              type="button"
              className={`actor-option ${isSelected ? 'active' : ''}`}
              onClick={() => !disabled && onSelectActor(actor.actor_id, actor.actor_type)}
              disabled={disabled}
            >
              <div className="actor-option-content">
                {actor.avatar_url ? (
                  <img src={actor.avatar_url} alt={actor.display_name} className="actor-avatar" />
                ) : (
                  <div className="actor-avatar-placeholder">
                    {isPersonal ? '👤' : isCompany ? '🏢' : '👥'}
                  </div>
                )}
                <div className="actor-option-info">
                  <div className="actor-name">{actor.display_name}</div>
                  {isCompany && actor.user_role && (
                    <div className="actor-role">
                      {actor.user_role === 'owner' && '👑 Proprietário'}
                      {actor.user_role === 'director' && '💼 Diretor'}
                      {actor.user_role === 'manager' && '📋 Gerente'}
                      {actor.user_role === 'employee' && '👔 Funcionário'}
                      {!['owner', 'director', 'manager', 'employee'].includes(actor.user_role) && `📌 ${actor.user_role}`}
                    </div>
                  )}
                  {isCompany && (
                    <div className="actor-subtitle">Postando como funcionário autorizado</div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {selectedActor && selectedActor.actor_type === 'page' && (
        <div className="actor-context-info">
          <span className="info-icon">ℹ️</span>
          <span>Você está postando em nome desta empresa. O post será associado ao perfil da empresa e você será identificado como {selectedActor.user_role === 'owner' ? 'proprietário' : selectedActor.user_role === 'director' ? 'diretor' : selectedActor.user_role === 'manager' ? 'gerente' : 'funcionário'}.</span>
        </div>
      )}
    </div>
  );
}

