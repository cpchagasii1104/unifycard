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
// DECISION-0161 + F-EVENT-AUDIENCE-SSOT-UNIFICATION (2026-07-08): a plateia vem do CONTRATO transversal
// /audience-options (deriva de PAIR_ALLOWED_LABELS), a tela só PROJETA — NUNCA define plateia em TSX.
// events.visibility agora é o MESMO vocabulário canônico (public/connections/only_me) — o mapper lossy
// de saída (connections→private) FOI REMOVIDO; enviamos a visibility canônica direto, sem perda.
import { useAudienceOptions } from '../../../hooks/useAudienceOptions';
import AudiencePicker from '../../composer/AudiencePicker';
import { resolveAudiencePayload } from '../../composer/audience-payload';
import './Step0EventType.css';

interface Step0EventTypeProps {
  data: GuidedFlowData;
  onUpdate: (updates: Partial<GuidedFlowData>) => void;
  onComplete: (updatedData?: Partial<GuidedFlowData>) => void;
  isLoading: boolean;
  /** CARRY-OVER: plateia herdada do composer inicial — abre já selecionada (não pergunta do zero). */
  initialAudienceKeys?: string[];
}

export default function Step0EventType({ data, onUpdate, onComplete, isLoading, initialAudienceKeys }: Step0EventTypeProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Plateia via hook central (fonte única /audience-options). Multi-seleção (helper resolve).
  // Inicializa com a plateia HERDADA do composer inicial (carry-over), se veio.
  const { options: audienceOptions } = useAudienceOptions();
  const [audienceKeys, setAudienceKeys] = useState<string[]>(initialAudienceKeys ?? []);
  // Veio do composer inicial com plateia → mostra RESUMO colapsado (não re-pergunta). Aberto direto
  // (/events/new, sem herança) → AudiencePicker completo. "Alterar" expande o picker comum.
  const inheritedAudience = (initialAudienceKeys?.length ?? 0) > 0;
  const [audienceExpanded, setAudienceExpanded] = useState<boolean>(!inheritedAudience);
  const audienceSummary = audienceKeys
    .map((k) => audienceOptions.find((o) => o.key === k)?.label)
    .filter(Boolean)
    .join(' + ') || 'Público';
  const handleAudienceChange = (keys: string[]) => {
    setAudienceKeys(keys);
    // selectedType alimenta o mapeamento de event_type existente (público vs demais).
    const { visibility } = resolveAudiencePayload(audienceOptions, keys);
    setSelectedType(visibility === 'public' ? 'public' : 'private');
    setErrorMessage(null);
  };

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

    // Plateia agora é CANÔNICA (AudiencePicker: público/conexões/só-eu + tipos) — não mais o binário
    // público/privado. A validação exige uma plateia escolhida, não o selectedType legado.
    if (audienceKeys.length === 0) {
      setErrorMessage('Selecione para quem é este evento');
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

    // Resolve a multi-seleção via helper central. Visibility CANÔNICA direto (sem mapper lossy).
    const aud = resolveAudiencePayload(audienceOptions, audienceKeys);
    const visibilityValue: 'public' | 'connections' | 'only_me' = audienceKeys.length > 0 ? aud.visibility : 'public';
    // event_type deriva da CATEGORIA + se é aberto/restrito (público=aberto → nome da categoria; demais →
    // ramo 'private' do mapa legado). Deriva de aud.visibility (fresco), NÃO do selectedType órfão.
    const typeKey = visibilityValue === 'public' ? 'public' : 'private';
    const eventType = eventTypeMap[selectedCategory]?.[typeKey] || selectedCategory;
    const updatedData = {
      event_type: eventType as any,
      event_subtype: selectedSubtype,
      visibility: visibilityValue,
      audience_relationship_types: aud.audienceRelationshipTypes,
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
        {/* Decisão Clayton 2026-07-07: "Para quem é isso?" é a PRIMEIRA pergunta —
            ANTES do tipo (mesma ordem do composer/demanda). Plateia projetada do contrato 0161.
            Vindo do composer (herança) → resumo colapsado; aberto direto → picker completo. */}
        <div className="form-section">
          {audienceExpanded ? (
            <AudiencePicker
              options={audienceOptions}
              selectedKeys={audienceKeys}
              onChange={handleAudienceChange}
              title="1 · Para quem é este evento?"
            />
          ) : (
            <div className="audience-collapsed">
              <span className="audience-collapsed-title">Plateia</span>
              <span className="audience-collapsed-value">{audienceSummary}</span>
              <button type="button" className="audience-collapsed-alter" onClick={() => setAudienceExpanded(true)}>Alterar</button>
            </div>
          )}
        </div>

        <div className="form-section">
          <label className="form-label">2 · Categoria</label>
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

