// src/components/ProfileHealth.tsx
// Saúde DESATIVADA (F-SAUDE-501 / DECISION-0071): fora do MVP. Este painel NÃO carrega nem salva dado de
// saúde, NÃO chama a API `/profile/health/*` (rotas respondem 501) e NÃO captura campo de saúde em formulário.
// A Saúde só volta com SSOT actor-first + consentimento explícito + visibility privada + audit + retenção.
// O formulário/hook/API legados (ProfileHealthForm, useProfileHealth*, api/health) permanecem no código mas
// NÃO são mais renderizados/chamados por esta aba.

import { useSession } from '../contexts/SessionProvider';
import NotApplicableMessage from './NotApplicableMessage';
import './Profile.css';

export default function ProfileHealth() {
  const { activeActor } = useSession();

  // Defesa em profundidade (DECISION-0043 pendente): apenas actor 'user' veria esta aba.
  if (activeActor && activeActor.actor_type !== 'user') {
    return <NotApplicableMessage actor={activeActor} tab="saúde" />;
  }

  return (
    <div className="profile-health">
      <h2>Saúde</h2>
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          marginTop: '1rem',
        }}
      >
        <strong>Saúde está fora do MVP</strong>
        <p style={{ marginTop: '0.5rem', marginBottom: '0.5rem', color: '#6b7280' }}>
          Esta área está reservada e <strong>não salva nada</strong> no momento.
        </p>
        <p style={{ marginBottom: 0, color: '#6b7280' }}>
          A Saúde será reativada apenas com <strong>consentimento explícito</strong>, <strong>privacidade</strong>{' '}
          (visibilidade privada por padrão), <strong>trilha de auditoria</strong> e um substrato de dados próprio
          governado, conforme a política de dados sensíveis (DECISION-0071).
        </p>
      </div>
    </div>
  );
}
