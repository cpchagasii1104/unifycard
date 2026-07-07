// frontend/src/pages/CompanyDashboardPage.tsx
// CONTINUOUS PRODUCTION: Painel da Empresa - SPRINT 2
// ERP/CRM visível para dono/administrador

import { useParams, Navigate, useNavigate } from 'react-router-dom';
import CompanyDashboard from '../components/company/CompanyDashboard';
import PublicProfileVisibilityCard from '../components/PublicProfileVisibilityCard';
import { useSession } from '../contexts/SessionProvider';

export default function CompanyDashboardPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { sessionReady, activeActor } = useSession();
  const navigate = useNavigate();

  if (!sessionReady) {
    return <div>Carregando...</div>;
  }

  if (!companyId) {
    return <Navigate to="/empresas" replace />;
  }

  // Guard de UX (DT-COMPANY-DASHBOARD-ACTOR-CHECK-EMPTY): se o actor ativo não
  // for empresa/page, renderiza estado honesto em vez de carregar o dashboard
  // com erros. Backend continua sendo a fonte real de autorização — este guard
  // existe APENAS para evitar UX confusa, não substitui authority check.
  if (activeActor?.actor_type !== 'page') {
    return (
      <div
        style={{
          padding: '2.5rem 2rem',
          maxWidth: 720,
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏢</div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>
          Painel da empresa
        </h1>
        <p style={{ color: '#475569', lineHeight: 1.6, marginBottom: '1rem' }}>
          O painel da empresa só está disponível quando o actor ativo é a
          própria empresa.
        </p>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Selecione a empresa no seletor de actor no topo, ou volte para a lista
          de empresas.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate('/empresas')}
            style={{
              padding: '0.6rem 1.4rem',
              background: '#0ea5e9',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Ir para Empresas
          </button>
          <button
            type="button"
            onClick={() => navigate('/home')}
            style={{
              padding: '0.6rem 1.4rem',
              background: 'transparent',
              color: '#0ea5e9',
              border: '1px solid #0ea5e9',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Voltar para a Home
          </button>
        </div>
      </div>
    );
  }

  // Achado de Clayton (2026-07-07): como PJ, "Meu Perfil" cai aqui e o card "Quem pode me encontrar"
  // (vitrine) não aparecia — empresa também publica plaquinha (public_profiles é actor-keyed; o
  // backend mine/publish já é canRepresentActor). Mesmo card do /perfil, zero verdade nova.
  return (
    <>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1rem 1rem 0' }}>
        <PublicProfileVisibilityCard />
      </div>
      <CompanyDashboard companyId={companyId} />
    </>
  );
}







