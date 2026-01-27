// frontend/src/pages/CompanyDashboardPage.tsx
// CONTINUOUS PRODUCTION: Painel da Empresa - SPRINT 2
// ERP/CRM visível para dono/administrador

import { useParams, Navigate } from 'react-router-dom';
import CompanyDashboard from '../components/company/CompanyDashboard';
import { useSession } from '../contexts/SessionProvider';

export default function CompanyDashboardPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { sessionReady, activeActor } = useSession();

  if (!sessionReady) {
    return <div>Carregando...</div>;
  }

  if (!companyId) {
    return <Navigate to="/empresas" replace />;
  }

  // Verificar se o actor ativo é uma empresa e corresponde ao companyId
  // Se não, redirecionar para selecionar o actor correto
  if (activeActor?.actor_type !== 'page') {
    // Tentar encontrar o actor da empresa nos actors disponíveis
    // Por enquanto, apenas renderizar o dashboard - ele vai lidar com permissões
  }

  return <CompanyDashboard companyId={companyId} />;
}







