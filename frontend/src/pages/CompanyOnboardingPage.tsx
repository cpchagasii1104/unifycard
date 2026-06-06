// frontend/src/pages/CompanyOnboardingPage.tsx
// Página para o wizard de onboarding de empresa

import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import CompanyOnboardingWizard from '../components/company/CompanyOnboardingWizard';
import { getCompany } from '../api/companies';
import { showToast } from '../components/common/Toast';
import type { Company } from '../api/companies';
import './CompanyOnboardingPage.css';

export default function CompanyOnboardingPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setError('ID da empresa não fornecido');
      setIsLoading(false);
      return;
    }

    loadCompany();
  }, [companyId]);

  const loadCompany = async () => {
    if (!companyId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getCompany(companyId);
      setCompany(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar empresa');
      showToast(err.message || 'Erro ao carregar empresa', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    showToast('Configuração concluída! Redirecionando...', 'success');
    setTimeout(() => {
      navigate(`/empresa/${companyId}`);
    }, 1500);
  };

  const handleCancel = () => {
    if (window.confirm('Tem certeza que deseja cancelar? Você pode completar a configuração depois.')) {
      navigate(`/empresa/${companyId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="company-onboarding-page">
        <div className="loading">Carregando empresa...</div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="company-onboarding-page">
        <div className="error">
          {error || 'Empresa não encontrada'}
          <button onClick={() => navigate('/empresas')}>Voltar para Empresas</button>
        </div>
      </div>
    );
  }

  // Verificar se já completou onboarding
  const onboardingCompleted = company.metadata?.onboardingCompleted === true;

  if (onboardingCompleted) {
    return (
      <div className="company-onboarding-page">
        <div className="already-completed">
          <h2>Configuração já concluída</h2>
          <p>Esta empresa já passou pelo processo de configuração inicial.</p>
          <p>Você pode editar as configurações no painel da empresa.</p>
          <button onClick={() => navigate(`/empresa/${companyId}`)}>
            Ir para Painel da Empresa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="company-onboarding-page">
      <CompanyOnboardingWizard
        companyId={company.companyId}
        companyName={company.companyName}
        initialRole={company.userRole?.role}
        initialRoleDescription={company.userRole?.roleDescription}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </div>
  );
}




