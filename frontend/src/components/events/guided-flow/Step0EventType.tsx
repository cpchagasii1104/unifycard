// src/components/events/guided-flow/Step0EventType.tsx
// ETAPA 0 — Tipo de Evento (PRE-DRAFT)
// FASE 5.0 — Event Creation Orchestration
//
// 🔴 REGRAS:
// - NÃO chama backend
// - NÃO cria evento
// - NÃO gera event_id
// - Estado: pre-draft

import { useState } from 'react';
import type { GuidedFlowData } from '../EventCreationGuidedFlow';
import './Step0EventType.css';

interface Step0EventTypeProps {
  data: GuidedFlowData;
  onUpdate: (updates: Partial<GuidedFlowData>) => void;
  onComplete: (updatedData?: Partial<GuidedFlowData>) => void;
  isLoading: boolean;
}

export default function Step0EventType({ data, onUpdate, onComplete, isLoading }: Step0EventTypeProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedType(null);
    setSelectedSubtype(null);
    setErrorMessage(null);
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setSelectedSubtype(null);
    setErrorMessage(null);
  };

  const handleSubtypeChange = (subtype: string) => {
    setSelectedSubtype(subtype);
    setErrorMessage(null);
  };

  const handleContinue = () => {
    // Limpar erro anterior
    setErrorMessage(null);

    // Validação: parar no primeiro erro encontrado
    if (!selectedCategory) {
      setErrorMessage('Selecione a categoria do evento');
      return;
    }

    if (!selectedType) {
      setErrorMessage('Selecione se o evento é privado ou público');
      return;
    }

    // Verificar se subtipo é necessário (todas as categorias atualmente requerem subtipo)
    const requiresSubtype = selectedCategory === 'social' || 
                           selectedCategory === 'cultural' || 
                           selectedCategory === 'gastronomic' || 
                           selectedCategory === 'sports' || 
                           selectedCategory === 'professional' || 
                           selectedCategory === 'community' || 
                           selectedCategory === 'spiritual';

    if (requiresSubtype && !selectedSubtype) {
      setErrorMessage('Selecione o subtipo do evento');
      return;
    }

    // Mapear categoria + tipo para event_type
    const eventTypeMap: Record<string, Record<string, string>> = {
      social: {
        private: 'private',
        public: 'social',
      },
      cultural: {
        private: 'cultural',
        public: 'cultural',
      },
      gastronomic: {
        private: 'gastronomic',
        public: 'gastronomic',
      },
      sports: {
        private: 'sports',
        public: 'sports',
      },
      professional: {
        private: 'professional',
        public: 'professional',
      },
      community: {
        private: 'community',
        public: 'community',
      },
      spiritual: {
        private: 'spiritual',
        public: 'spiritual',
      },
    };

    const eventType = eventTypeMap[selectedCategory]?.[selectedType] || selectedType;

    const visibilityValue = selectedType === 'private' ? 'private' : 'public';
    const updatedData = {
      event_type: eventType as any,
      event_subtype: selectedSubtype,
      visibility: visibilityValue as 'group' | 'public' | 'private' | 'followers' | 'unlisted',
    };

    onUpdate(updatedData);

    // Passar dados atualizados diretamente para onComplete para evitar problema de estado assíncrono
    onComplete(updatedData);
  };

  return (
    <div className="step0-event-type">
      <div className="step-header">
        <h2>Que tipo de evento você quer explorar?</h2>
        <p className="step-hint">
          Esta é apenas uma exploração. Nada será criado ainda.
        </p>
      </div>

      <div className="step-content">
        <div className="form-section">
          <label className="form-label">Categoria</label>
          <div className="option-grid">
            <button
              type="button"
              className={`option-button ${selectedCategory === 'social' ? 'selected' : ''}`}
              onClick={() => handleCategoryChange('social')}
            >
              Social
            </button>
            <button
              type="button"
              className={`option-button ${selectedCategory === 'cultural' ? 'selected' : ''}`}
              onClick={() => handleCategoryChange('cultural')}
            >
              Cultural
            </button>
            <button
              type="button"
              className={`option-button ${selectedCategory === 'gastronomic' ? 'selected' : ''}`}
              onClick={() => handleCategoryChange('gastronomic')}
            >
              Gastronômico
            </button>
            <button
              type="button"
              className={`option-button ${selectedCategory === 'sports' ? 'selected' : ''}`}
              onClick={() => handleCategoryChange('sports')}
            >
              Esportivo
            </button>
            <button
              type="button"
              className={`option-button ${selectedCategory === 'professional' ? 'selected' : ''}`}
              onClick={() => handleCategoryChange('professional')}
            >
              Profissional
            </button>
            <button
              type="button"
              className={`option-button ${selectedCategory === 'community' ? 'selected' : ''}`}
              onClick={() => handleCategoryChange('community')}
            >
              Comunitário
            </button>
            <button
              type="button"
              className={`option-button ${selectedCategory === 'spiritual' ? 'selected' : ''}`}
              onClick={() => handleCategoryChange('spiritual')}
            >
              Espiritual
            </button>
          </div>
        </div>

        {selectedCategory && (
          <div className="form-section">
            <label className="form-label">Tipo</label>
            <div className="option-grid">
              {(selectedCategory === 'social' || selectedCategory === 'cultural' || selectedCategory === 'gastronomic' || selectedCategory === 'sports' || selectedCategory === 'professional' || selectedCategory === 'community' || selectedCategory === 'spiritual') && (
                <>
                  <button
                    type="button"
                    className={`option-button ${selectedType === 'private' ? 'selected' : ''}`}
                    onClick={() => handleTypeChange('private')}
                  >
                    Privado
                  </button>
                  <button
                    type="button"
                    className={`option-button ${selectedType === 'public' ? 'selected' : ''}`}
                    onClick={() => handleTypeChange('public')}
                  >
                    Público
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {selectedCategory === 'social' && selectedType && (
          <div className="form-section">
            <label className="form-label">Subtipo</label>
            <div className="option-grid">
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'birthday' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('birthday')}
              >
                Aniversário
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'wedding' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('wedding')}
              >
                Casamento
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'baby_shower' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('baby_shower')}
              >
                Chá de bebê
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'graduation' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('graduation')}
              >
                Formatura
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'private_party' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('private_party')}
              >
                Festa privada
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'gathering' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('gathering')}
              >
                Confraternização
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'happy_hour' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('happy_hour')}
              >
                Happy hour
              </button>
            </div>
          </div>
        )}

        {selectedCategory === 'cultural' && selectedType && (
          <div className="form-section">
            <label className="form-label">Subtipo</label>
            <div className="option-grid">
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'show' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('show')}
              >
                Show
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'fairs' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('fairs')}
              >
                Feiras
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'theater' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('theater')}
              >
                Teatro
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'standup' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('standup')}
              >
                Stand-up
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'meetings' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('meetings')}
              >
                Encontros
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'nightlife' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('nightlife')}
              >
                Vida noturna
              </button>
            </div>
          </div>
        )}

        {selectedCategory === 'gastronomic' && selectedType && (
          <div className="form-section">
            <label className="form-label">Subtipo</label>
            <div className="option-grid">
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'barbecue' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('barbecue')}
              >
                Churrasco
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'feijoada' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('feijoada')}
              >
                Feijoada
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'pizza_buffet' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('pizza_buffet')}
              >
                Rodízio de pizza
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'colonial_coffee' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('colonial_coffee')}
              >
                Café colonial
              </button>
            </div>
          </div>
        )}

        {selectedCategory === 'sports' && selectedType && (
          <div className="form-section">
            <label className="form-label">Subtipo</label>
            <div className="option-grid">
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'football' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('football')}
              >
                Futebol
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'pool' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('pool')}
              >
                Sinuca
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'videogame' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('videogame')}
              >
                Video game
              </button>
            </div>
          </div>
        )}

        {selectedCategory === 'professional' && selectedType && (
          <div className="form-section">
            <label className="form-label">Subtipo</label>
            <div className="option-grid">
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'workshop' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('workshop')}
              >
                Workshop
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'lecture' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('lecture')}
              >
                Palestra
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'training' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('training')}
              >
                Treinamento
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'product_launch' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('product_launch')}
              >
                Lançamento de produto
              </button>
            </div>
          </div>
        )}

        {selectedCategory === 'community' && selectedType && (
          <div className="form-section">
            <label className="form-label">Subtipo</label>
            <div className="option-grid">
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'community_meeting' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('community_meeting')}
              >
                Encontro comunitário
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'assembly' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('assembly')}
              >
                Assembleia
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'charity_event' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('charity_event')}
              >
                Evento beneficente
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'mutirao' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('mutirao')}
              >
                Mutirão
              </button>
            </div>
          </div>
        )}

        {selectedCategory === 'spiritual' && selectedType && (
          <div className="form-section">
            <label className="form-label">Subtipo</label>
            <div className="option-grid">
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'spiritual_meeting' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('spiritual_meeting')}
              >
                Encontro espiritual
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'retreat' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('retreat')}
              >
                Retiro
              </button>
              <button
                type="button"
                className={`option-button ${selectedSubtype === 'prayer_group' ? 'selected' : ''}`}
                onClick={() => handleSubtypeChange('prayer_group')}
              >
                Grupo de oração
              </button>
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="step-error" style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33',
          fontSize: '0.9rem',
        }}>
          {errorMessage}
        </div>
      )}

      <div className="step-actions">
        <button
          className="step-button step-button-primary"
          onClick={handleContinue}
          disabled={isLoading}
        >
          {isLoading ? 'Aguardando contexto...' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}

