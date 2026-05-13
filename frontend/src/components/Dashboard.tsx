// src/components/Dashboard.tsx
// Dashboard principal - agrega perfil, wallet, fundo, etc.

import { useState, useEffect, useRef } from 'react';
import { getDashboard, type DashboardData } from '../api/dashboard';
import { getReferralCode } from '../api/auth';
import { getPlan, updatePlan, type UserPlan } from '../api/plan';
import { useSession } from '../contexts/SessionProvider';
import MyConfigurations from './MyConfigurations';
import BackendConnectionError from './BackendConnectionError';
import MFIBankCard from './mfibank/MFIBankCard';
import FeedContextual from './FeedContextual';
import MatchingContextual from './MatchingContextual';
import { centsToReais } from '../utils/money';
import './Dashboard.css';

type DashboardTab = 'overview' | 'configurations';

export default function Dashboard() {
  const { sessionReady, activeActor } = useSession();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [data, setData] = useState<DashboardData | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // FASE 3.6: Estado para gerenciamento de plano (apenas usuário teste)
  const [userPlan, setUserPlan] = useState<UserPlan>('free');
  const [canTogglePlan, setCanTogglePlan] = useState(false);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);

  // Proteção contra chamadas duplicadas
  const isLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // GUARD: Só fazer chamadas quando sessão estiver pronta E activeActor definido
    if (!sessionReady || !activeActor) {
      setIsLoading(false);
      return;
    }

    // Prevenir múltiplas chamadas simultâneas
    if (isLoadingRef.current || hasLoadedRef.current) {
      return;
    }

    isLoadingRef.current = true;
    hasLoadedRef.current = true;

    loadDashboard();
    loadPlan();
  }, [sessionReady, activeActor]);

  const loadPlan = async () => {
    // Proteção adicional: não carregar se não houver actor
    if (!activeActor) {
      return;
    }

    try {
      const planInfo = await getPlan();
      console.log('📋 Plan Info:', planInfo); // Debug
      setUserPlan(planInfo.plan);
      setCanTogglePlan(planInfo.canToggle);
      console.log('✅ canTogglePlan:', planInfo.canToggle); // Debug
    } catch (err) {
      console.error('❌ Erro ao carregar plano:', err);
    }
  };

  const handleTogglePlan = async () => {
    if (!canTogglePlan || isUpdatingPlan) return;
    
    const newPlan: UserPlan = userPlan === 'free' ? 'pro' : 'free';
    setIsUpdatingPlan(true);
    
    try {
      const updated = await updatePlan(newPlan);
      setUserPlan(updated.plan);
      setCanTogglePlan(updated.canToggle);
      
      // Recarregar página para atualizar todos os componentes que dependem do plano
      alert(`Plano alterado para ${newPlan.toUpperCase()}. A página será recarregada.`);
      window.location.reload();
    } catch (err) {
      console.error('Erro ao atualizar plano:', err);
      alert('Erro ao alterar plano. Tente novamente.');
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const loadDashboard = async () => {
    // Proteção adicional: não carregar se não houver actor
    if (!activeActor) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [dashboardData, referralData] = await Promise.all([
        getDashboard().catch((err) => {
          console.error('Erro ao carregar dashboard:', err);
          if (err instanceof Error && err.message.includes('401')) {
            throw new Error('Sessão expirada. Por favor, faça login novamente.');
          }
          throw err;
        }),
        getReferralCode().catch(() => null),
      ]);
      setData(dashboardData);
      if (referralData) {
        setReferralCode(referralData.referralCode);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dashboard';
      setError(errorMessage);
      console.error('Erro completo ao carregar dashboard:', err);
      
      // Se for erro 401, redirecionar para login
      if (errorMessage.includes('401') || errorMessage.includes('Sessão expirada')) {
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  const copyReferralCode = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      alert('Código copiado para a área de transferência!');
    }
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="dashboard">
        <div className="loading">Carregando dashboard...</div>
      </div>
    );
  }

  if (error) {
    // Verificar se é erro de conexão
    const isConnectionError = error.includes('Failed to fetch') || 
                             error.includes('conectar') || 
                             error.includes('network') ||
                             error.includes('Não foi possível conectar');
    
    if (isConnectionError) {
      return (
        <div className="dashboard">
          <BackendConnectionError error={error} onRetry={loadDashboard} />
        </div>
      );
    }
    
    return (
      <div className="dashboard">
        <div className="error">Erro: {error}</div>
        <button onClick={loadDashboard} className="retry-button">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="dashboard">
        <div className="error">Nenhum dado disponível</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Tabs - movidas para fora do header azul */}
      <div className="dashboard-tabs">
        <button
          className={`dashboard-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Visão Geral
        </button>
        <button
          className={`dashboard-tab ${activeTab === 'configurations' ? 'active' : ''}`}
          onClick={() => setActiveTab('configurations')}
        >
          Minhas Configurações
        </button>
      </div>

      <main className="dashboard-main">
        {/* Título e saudação movidos para o corpo */}
        <div className="dashboard-page-header">
          <h1>Dashboard</h1>
          <p className="welcome-message">
            Olá, {data.profile.global.fullName || data.profile.local.email}
          </p>
        </div>

        {/* FASE 3.6: Toggle de Plano (apenas usuário teste) */}
        {canTogglePlan && (
          <div className="plan-toggle-section" style={{
            marginBottom: '20px',
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontWeight: 500, fontSize: '14px', color: '#374151' }}>
                  Plano atual: <strong style={{ color: userPlan === 'pro' ? '#10b981' : '#6b7280' }}>{userPlan.toUpperCase()}</strong>
                </span>
              </div>
              <button
                onClick={handleTogglePlan}
                disabled={isUpdatingPlan}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isUpdatingPlan ? 'not-allowed' : 'pointer',
                  background: userPlan === 'free' ? '#10b981' : '#6b7280',
                  color: 'white',
                  transition: 'all 0.2s',
                  opacity: isUpdatingPlan ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (!isUpdatingPlan) {
                    e.currentTarget.style.opacity = '0.9';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isUpdatingPlan) {
                    e.currentTarget.style.opacity = '1';
                  }
                }}
              >
                {isUpdatingPlan ? 'Alterando...' : userPlan === 'free' ? '🔼 Upgrade para PRO' : '🔽 Voltar para FREE'}
              </button>
            </div>
            <p style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
              {userPlan === 'free' 
                ? '💡 Teste as funcionalidades PRO clicando no botão acima'
                : '✅ Você está usando a versão PRO. Algumas funcionalidades estão desbloqueadas.'}
            </p>
          </div>
        )}

        {/* Código de indicação compacto */}
        {referralCode && (
          <div className="referral-code-section">
            <label>Seu Código de Indicação:</label>
            <div className="referral-code-display">
              <code className="referral-code">{referralCode}</code>
              <button onClick={copyReferralCode} className="copy-button">
                Copiar
              </button>
            </div>
            <p className="referral-hint">
              Compartilhe este código para indicar novos usuários e ganhar comissões!
            </p>
          </div>
        )}
        {activeTab === 'configurations' ? (
          <MyConfigurations />
        ) : (
          <>
        {/* Seção MFIBank */}
        <section className="dashboard-section">
          <MFIBankCard
            onViewFullStatement={() => {
              // Disparar evento customizado para navegar para wallet
              window.dispatchEvent(new CustomEvent('navigate-to-wallet'));
            }}
          />
        </section>

        {/* Seção de Perfil */}
        <section className="dashboard-section">
          <h2>Meu Perfil</h2>
          <div className="profile-card">
            <div className="profile-info">
              <div className="info-item">
                <span className="info-label">Nome:</span>
                <span className="info-value">
                  {data.profile.global.fullName || 'Não informado'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Email:</span>
                <span className="info-value">{data.profile.local.email}</span>
              </div>
              {data.profile.residence?.city && (
                <div className="info-item">
                  <span className="info-label">Cidade:</span>
                  <span className="info-value">{data.profile.residence.city.name}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Feed Contextual */}
        <section className="dashboard-section">
          <FeedContextual />
        </section>

        {/* Matching Contextual */}
        <section className="dashboard-section">
          <MatchingContextual />
        </section>

        {/* Seção de Wallet */}
        {data.wallet && (
          <section className="dashboard-section">
            <h2>Minha Carteira</h2>
            <div className="wallet-card">
              <div className="wallet-balance">
                <span className="balance-label">Saldo</span>
                <span className="balance-value">{formatCurrency(centsToReais(data.wallet.balanceCents))}</span>
              </div>
              <div className="wallet-stats">
                <div className="stat-item">
                  <span className="stat-label">Total Recebido</span>
                  <span className="stat-value positive">
                    {formatCurrency(centsToReais(data.wallet.totalInCents))}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Gasto</span>
                  <span className="stat-value negative">
                    {formatCurrency(centsToReais(data.wallet.totalOutCents))}
                  </span>
                </div>
              </div>
              {data.wallet.lastTransactions.length > 0 && (
                <div className="wallet-transactions">
                  <h3>Últimas Transações</h3>
                  <table className="transactions-table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Valor</th>
                        <th>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.wallet.lastTransactions.map((tx: any) => (
                        <tr key={tx.transactionId}>
                          <td>
                            <span className={`tx-type ${tx.type}`}>
                              {tx.type === 'credit' ? 'Entrada' : 'Saída'}
                            </span>
                          </td>
                          <td className={tx.type === 'credit' ? 'positive' : 'negative'}>
                            {formatCurrency(centsToReais(tx.amountCents))}
                          </td>
                          <td>{formatDate(tx.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Seção de Reputação */}
        {data.reputation && (
          <section className="dashboard-section">
            <h2>Minha Reputação</h2>
            <div className="reputation-card">
              <div className="reputation-summary">
                <p>{data.reputation.summary}</p>
              </div>
              {Object.keys(data.reputation.scores).length > 0 && (
                <div className="reputation-scores">
                  {Object.entries(data.reputation.scores).map(([key, value]) => (
                    <div key={key} className="score-item">
                      <span className="score-label">{key}</span>
                      <span className="score-value">{(value as number).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Seção de Fundo Regional */}
        {data.fund && (
          <section className="dashboard-section">
            <h2>Fundo Regional</h2>
            <div className="fund-card">
              <div className="fund-balance">
                <span className="balance-label">Saldo do Fundo</span>
                <span className="balance-value">
                  {formatCurrency(data.fund.summary.currentBalance)}
                </span>
              </div>
              <div className="fund-info">
                <p className="fund-explanation">{data.fund.summary.explanation.text}</p>
                <div className="fund-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Recebido</span>
                    <span className="stat-value">
                      {formatCurrency(data.fund.summary.totalReceived)}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Contribuições</span>
                    <span className="stat-value">{data.fund.summary.totalContributions}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
          </>
        )}
      </main>
    </div>
  );
}

