// frontend/src/components/publication/AudienceSelector.tsx
// Seletor de Audiência (Visibilidade) - Estilo Facebook, mas UnifiCard
// Separar: VISIBILIDADE (acesso) ≠ PUBLICAÇÃO (destinos)

import { useState } from 'react';
import type { Visibility, PublicationDestination, InvitationMethod } from '../../types/publication';
import './AudienceSelector.css';

interface AudienceSelectorProps {
  // Visibilidade atual
  visibility: Visibility;
  onVisibilityChange: (visibility: Visibility) => void;
  
  // Destinos de publicação (opcional, avançado)
  publicationDestinations?: PublicationDestination[];
  onDestinationsChange?: (destinations: PublicationDestination[]) => void;
  showAdvanced?: boolean;
  
  // Convites
  invitationsEnabled: boolean;
  onInvitationsEnabledChange: (enabled: boolean) => void;
  invitationMethods: InvitationMethod[];
  onInvitationMethodsChange: (methods: InvitationMethod[]) => void;
  
  // Tipo de actor (para ajustar opções)
  actorType?: 'user' | 'page' | 'group' | 'channel';
}

export default function AudienceSelector({
  visibility,
  onVisibilityChange,
  publicationDestinations = [],
  onDestinationsChange,
  showAdvanced = false,
  invitationsEnabled,
  onInvitationsEnabledChange,
  invitationMethods,
  onInvitationMethodsChange,
  actorType = 'user',
}: AudienceSelectorProps) {
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(showAdvanced);

  // Opções de visibilidade baseadas no tipo de actor
  const getVisibilityOptions = (): Array<{ value: Visibility; label: string; icon: string; description: string }> => {
    const baseOptions = [
      { value: 'public' as Visibility, label: 'Público', icon: '🌍', description: 'Qualquer pessoa pode ver' },
      { value: 'followers' as Visibility, label: 'Seguidores', icon: '👥', description: 'Apenas seus seguidores' },
      { value: 'unlisted' as Visibility, label: 'Não listado', icon: '🔒', description: 'Apenas quem tem o link' },
      { value: 'private' as Visibility, label: 'Privado', icon: '🔐', description: 'Apenas você' },
    ];

    // Ajustes por tipo de actor
    if (actorType === 'user') {
      return [
        ...baseOptions,
        { value: 'friends' as Visibility, label: 'Amigos', icon: '🤝', description: 'Apenas seus amigos' },
      ];
    }

    if (actorType === 'page' || actorType === 'group') {
      return [
        ...baseOptions,
        { value: 'group' as Visibility, label: 'Grupo', icon: '👥', description: 'Apenas membros do grupo' },
      ];
    }

    return baseOptions;
  };

  const visibilityOptions = getVisibilityOptions();

  const destinationOptions: Array<{ value: PublicationDestination; label: string }> = [
    { value: 'feed', label: 'Feed principal' },
    { value: 'group_feed', label: 'Feed do grupo' },
    { value: 'event_feed', label: 'Feed de eventos' },
    { value: 'profile', label: 'Perfil' },
    { value: 'search', label: 'Busca' },
  ];

  const invitationMethodOptions: Array<{ value: InvitationMethod; label: string; icon: string }> = [
    { value: 'internal', label: 'Sistema interno', icon: '💬' },
    { value: 'whatsapp', label: 'WhatsApp', icon: '📱' },
    { value: 'email', label: 'E-mail', icon: '📧' },
    { value: 'shareable_link', label: 'Link compartilhável', icon: '🔗' },
    { value: 'external_with_signup', label: 'Link com cadastro', icon: '📝' },
  ];

  const handleDestinationToggle = (destination: PublicationDestination) => {
    if (!onDestinationsChange) return;
    
    if (publicationDestinations.includes(destination)) {
      onDestinationsChange(publicationDestinations.filter(d => d !== destination));
    } else {
      onDestinationsChange([...publicationDestinations, destination]);
    }
  };

  const handleInvitationMethodToggle = (method: InvitationMethod) => {
    if (invitationMethods.includes(method)) {
      onInvitationMethodsChange(invitationMethods.filter(m => m !== method));
    } else {
      onInvitationMethodsChange([...invitationMethods, method]);
    }
  };

  return (
    <div className="audience-selector">
      {/* VISIBILIDADE */}
      <div className="selector-section">
        <h3 className="section-title">Quem pode ver?</h3>
        <div className="visibility-options">
          {visibilityOptions.map(option => (
            <button
              key={option.value}
              type="button"
              className={`visibility-option ${visibility === option.value ? 'selected' : ''}`}
              onClick={() => onVisibilityChange(option.value)}
            >
              <span className="option-icon">{option.icon}</span>
              <div className="option-content">
                <div className="option-label">{option.label}</div>
                <div className="option-description">{option.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* DESTINOS DE PUBLICAÇÃO (Avançado) */}
      {showAdvancedOptions && onDestinationsChange && (
        <div className="selector-section">
          <h3 className="section-title">Onde publicar? <span className="optional">(opcional)</span></h3>
          <p className="section-hint">
            Escolha onde este conteúdo aparecerá. Se não selecionar nada, será determinado automaticamente.
          </p>
          <div className="destination-options">
            {destinationOptions.map(option => (
              <label key={option.value} className="destination-checkbox">
                <input
                  type="checkbox"
                  checked={publicationDestinations.includes(option.value)}
                  onChange={() => handleDestinationToggle(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* CONVITES */}
      <div className="selector-section">
        <h3 className="section-title">Convites</h3>
        <div className="invitations-toggle">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={invitationsEnabled}
              onChange={(e) => onInvitationsEnabledChange(e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">Deseja convidar pessoas?</span>
          </label>
        </div>

        {invitationsEnabled && (
          <>
            <div className="invitation-methods">
              <label className="methods-label">Métodos de convite:</label>
              <div className="methods-grid">
                {invitationMethodOptions.map(option => (
                  <label key={option.value} className="method-checkbox">
                    <input
                      type="checkbox"
                      checked={invitationMethods.includes(option.value)}
                      onChange={() => handleInvitationMethodToggle(option.value)}
                    />
                    <span className="method-icon">{option.icon}</span>
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Banner informativo (não-bloqueante) */}
            <div className="referral-banner">
              <div className="banner-icon">💡</div>
              <div className="banner-content">
                <strong>Dica:</strong>
                <p>
                  Ao convidar por link, você pode incluir seu código de indicação no convite.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Botão para mostrar/ocultar opções avançadas */}
      {!showAdvancedOptions && onDestinationsChange && (
        <button
          type="button"
          className="advanced-toggle"
          onClick={() => setShowAdvancedOptions(true)}
        >
          Opções avançadas
        </button>
      )}
    </div>
  );
}

