// frontend/src/components/trust/TrustTransparencyCard.tsx
// CONTINUOUS PRODUCTION: Card de Transparência & Confiança - SPRINT 12
// Aparece apenas para novos usuários ou quando não há atividade

import { useNavigate } from 'react-router-dom';
import './TrustTransparencyCard.css';

interface TrustTransparencyCardProps {
  showFullContent?: boolean; // Se true, mostra seções completas; se false, apenas card resumido
}

export default function TrustTransparencyCard({ showFullContent = false }: TrustTransparencyCardProps) {
  const navigate = useNavigate();

  if (showFullContent) {
    // Versão completa com seções integradas
    return (
      <div className="trust-transparency-full">
        <div className="trust-transparency-header">
          <h2>Transparência & Confiança</h2>
          <p className="trust-transparency-subtitle">
            Este sistema é construído para ser auditável e responsável
          </p>
        </div>

        <div className="trust-transparency-points">
          <div className="trust-transparency-point">
            <div className="trust-transparency-icon">📋</div>
            <div className="trust-transparency-content">
              <h3>Tudo aqui é registrado</h3>
              <p>
                Cada ação importante fica registrada na timeline institucional. 
                Você pode ver quem fez o quê, quando e em nome de quem.
              </p>
              <button
                onClick={() => navigate('/timeline')}
                className="trust-transparency-link"
                type="button"
              >
                Ver timeline →
              </button>
            </div>
          </div>

          <div className="trust-transparency-point">
            <div className="trust-transparency-icon">💰</div>
            <div className="trust-transparency-content">
              <h3>Economia transparente</h3>
              <p>
                Você pode ver para onde vai cada centavo: prestadores, grupos, 
                fundo regional, taxas. Nada é escondido.
              </p>
              <button
                onClick={() => navigate('/wallet')}
                className="trust-transparency-link"
                type="button"
              >
                Ver economia →
              </button>
            </div>
          </div>

          <div className="trust-transparency-point">
            <div className="trust-transparency-icon">🔍</div>
            <div className="trust-transparency-content">
              <h3>Ações podem ser revisadas</h3>
              <p>
                Se algo não está certo, você pode solicitar revisão. 
                Disputas ficam registradas e podem ser resolvidas.
              </p>
              <button
                onClick={() => {
                  // Navegar para página de disputas ou mostrar modal
                  const disputesSection = document.querySelector('.overview-disputes');
                  if (disputesSection) {
                    disputesSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="trust-transparency-link"
                type="button"
              >
                Ver disputas →
              </button>
            </div>
          </div>

          <div className="trust-transparency-point">
            <div className="trust-transparency-icon">👤</div>
            <div className="trust-transparency-content">
              <h3>Autoridade é explícita</h3>
              <p>
                Você sempre sabe quem tem autoridade para fazer o quê. 
                Delegações e permissões são visíveis e auditáveis.
              </p>
              <button
                onClick={() => {
                  // Navegar para seção de responsabilidade
                  const accountabilitySection = document.querySelector('.overview-accountability');
                  if (accountabilitySection) {
                    accountabilitySection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="trust-transparency-link"
                type="button"
              >
                Ver responsabilidade →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Versão resumida (card)
  return (
    <div className="trust-transparency-card">
      <div className="trust-transparency-card-header">
        <h3>Transparência & Confiança</h3>
      </div>
      <div className="trust-transparency-card-content">
        <p className="trust-transparency-card-intro">
          Este sistema é construído para ser auditável e responsável.
        </p>
        <ul className="trust-transparency-card-list">
          <li>📋 Tudo aqui é registrado</li>
          <li>💰 Economia transparente</li>
          <li>🔍 Ações podem ser revisadas</li>
          <li>👤 Autoridade é explícita</li>
        </ul>
        <div className="trust-transparency-card-actions">
          <button
            onClick={() => {
              // Mostrar conteúdo completo ou navegar
              const fullContent = document.querySelector('.trust-transparency-full');
              if (fullContent) {
                fullContent.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="trust-transparency-card-button"
            type="button"
          >
            Entender como funciona
          </button>
        </div>
      </div>
    </div>
  );
}







