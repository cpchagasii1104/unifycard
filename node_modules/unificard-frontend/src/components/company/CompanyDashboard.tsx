// frontend/src/components/company/CompanyDashboard.tsx
// CONTINUOUS PRODUCTION: Painel da Empresa - SPRINT 2
// Dashboard com tabs: Visão Geral, Equipe, Financeiro, Atividades

import { useState, useEffect } from 'react';
import { useSession } from '../../contexts/SessionProvider';
import { getCompany, type Company } from '../../api/companies';
import { isAuthenticated, getTenantId } from '../../config/auth';
import CompanyOverviewTab from './tabs/CompanyOverviewTab';
import CompanyTeamTab from './tabs/CompanyTeamTab';
import CompanyFinancialTab from './tabs/CompanyFinancialTab';
import CompanyActivitiesTab from './tabs/CompanyActivitiesTab';
import './CompanyDashboard.css';

interface CompanyDashboardProps {
  companyId: string;
}

type TabId = 'overview' | 'team' | 'financial' | 'activities';

export default function CompanyDashboard({ companyId }: CompanyDashboardProps) {
  const { sessionReady, activeActor } = useSession();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId()) {
      setLoading(false);
      return;
    }

    loadCompany();
  }, [sessionReady, companyId]);

  const loadCompany = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getCompany(companyId);
      setCompany(data);
    } catch (err: any) {
      console.error('Erro ao carregar empresa:', err);
      setError(err.message || 'Erro ao carregar dados da empresa');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="company-dashboard">
        <div className="company-dashboard-loading">
          <div className="skeleton skeleton-header" />
          <div className="skeleton skeleton-tabs" />
          <div className="skeleton skeleton-content" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="company-dashboard">
        <div className="company-dashboard-error">
          <p>Erro ao carregar empresa: {error}</p>
          <button onClick={loadCompany}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="company-dashboard">
        <div className="company-dashboard-error">
          <p>Empresa não encontrada</p>
        </div>
      </div>
    );
  }

  // Verificar se o actor ativo é da empresa
  const isCompanyActor = activeActor?.actor_type === 'page';
  // Actor ID será resolvido via activeActor quando estiver atuando como empresa

  return (
    <div className="company-dashboard">
      {/* Header */}
      <div className="company-dashboard-header">
        <div className="company-header-info">
          <h1>{company.companyName || company.tradeName || 'Empresa'}</h1>
          <div className="company-header-meta">
            <span className="company-type">Empresa</span>
            {isCompanyActor && (
              <span className="company-actor-badge">Atuando como Empresa</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="company-dashboard-tabs">
        <button
          className={`company-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
          type="button"
        >
          Visão Geral
        </button>
        <button
          className={`company-tab ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => setActiveTab('team')}
          type="button"
        >
          Equipe & Permissões
        </button>
        <button
          className={`company-tab ${activeTab === 'financial' ? 'active' : ''}`}
          onClick={() => setActiveTab('financial')}
          type="button"
        >
          Financeiro
        </button>
        <button
          className={`company-tab ${activeTab === 'activities' ? 'active' : ''}`}
          onClick={() => setActiveTab('activities')}
          type="button"
        >
          Atividades
        </button>
      </div>

      {/* Tab Content */}
      <div className="company-dashboard-content">
        {activeTab === 'overview' && (
          <CompanyOverviewTab company={company} companyId={companyId} />
        )}
        {activeTab === 'team' && (
          <CompanyTeamTab company={company} companyId={companyId} />
        )}
        {activeTab === 'financial' && (
          <CompanyFinancialTab company={company} companyId={companyId} />
        )}
        {activeTab === 'activities' && (
          <CompanyActivitiesTab company={company} companyId={companyId} />
        )}
      </div>
    </div>
  );
}







