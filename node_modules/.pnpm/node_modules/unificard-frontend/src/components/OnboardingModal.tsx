// src/components/OnboardingModal.tsx
// Modal de onboarding para primeiro acesso

import './OnboardingModal.css';

interface OnboardingModalProps {
  isOpen: boolean;
  onConfirm: () => void;
}

export default function OnboardingModal({ isOpen, onConfirm }: OnboardingModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="onboarding-modal-overlay"
      // 🔴 ONBOARDING: Modal NÃO pode ser fechado clicando fora
      onClick={(e) => {
        // Prevenir fechamento ao clicar no overlay
        e.stopPropagation();
      }}
    >
      <div className="onboarding-modal" onClick={(e) => e.stopPropagation()}>
        <div className="onboarding-modal-header">
          <h2>Primeiro acesso</h2>
        </div>
        <div className="onboarding-modal-body">
          <p>
            Confira seus dados cadastrais e complete seu perfil para aproveitar todos os recursos do Unificard.
          </p>
          <p className="onboarding-modal-note">
            <strong>Importante:</strong> Após a confirmação, você não poderá mais alterar seu nome, data de nascimento e sexo.
          </p>
        </div>
        <div className="onboarding-modal-footer">
          <button 
            type="button" 
            className="onboarding-modal-button"
            onClick={onConfirm}
          >
            Entendi, continuar
          </button>
        </div>
      </div>
    </div>
  );
}

