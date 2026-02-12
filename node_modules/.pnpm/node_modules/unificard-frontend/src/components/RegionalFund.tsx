// src/components/RegionalFund.tsx
// Dashboard do Fundo Regional - READ-ONLY, apenas visualização
// Usa APENAS /fund/dashboard (rota que funciona e é mais completa)
import { useState, useEffect } from 'react';
import { getFundDashboard, type FundDashboardData } from '../api/fund';
import './RegionalFund.css';

export default function RegionalFund() {
  const [dashboardData, setDashboardData] = useState<FundDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number>(30);

  useEffect(() => {
    loadData();
  }, [selectedDays]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Usar APENAS o dashboard (rota que funciona)
      const dashboard = await getFundDashboard(selectedDays);
      setDashboardData(dashboard);
    } catch (err: any) {
      // Extrair mensagem de erro mais detalhada
      let errorMessage = 'Erro ao carregar dados do fundo regional';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        // Tentar extrair mensagem da resposta da API
        const apiError = err.error || err.message;
        if (apiError) {
          errorMessage = typeof apiError === 'string' ? apiError : JSON.stringify(apiError);
        } else {
          errorMessage = JSON.stringify(err);
        }
      }
      
      setError(errorMessage);
      console.error('Erro ao carregar fundo regional:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Formatar valor monetário
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Formatar data
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  if (isLoading) {
    return (
      <div className="regional-fund">
        <div className="loading">Carregando dados do fundo regional...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="regional-fund">
        <div className="error">Erro: {error}</div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="regional-fund">
        <div className="error">Nenhum dado disponível</div>
      </div>
    );
  }

  const { summary, revenue, costs, statistics } = dashboardData;

  return (
    <div className="regional-fund">
      <header className="fund-header">
        <h1>Fundo Regional - Dashboard</h1>
        <div className="period-selector">
          <label>Período: </label>
          <select value={selectedDays} onChange={(e) => setSelectedDays(Number(e.target.value))}>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Último ano</option>
          </select>
        </div>
      </header>

      <main className="fund-main">
        {/* A) Resumo Financeiro */}
        <section className="fund-stats">
          <div className="stat-card primary">
            <div className="stat-label">Saldo Atual</div>
            <div className="stat-value">{formatCurrency(dashboardData.summary.currentBalance)}</div>
          </div>
          <div className="stat-card revenue">
            <div className="stat-label">Total de Receitas</div>
            <div className="stat-value">{formatCurrency(dashboardData.summary.totalRevenue)}</div>
            {revenue.growth.percentage !== 0 && (
              <div className={`stat-growth ${revenue.growth.percentage > 0 ? 'positive' : 'negative'}`}>
                {revenue.growth.percentage > 0 ? '↑' : '↓'} {Math.abs(revenue.growth.percentage).toFixed(1)}%
              </div>
            )}
          </div>
          <div className="stat-card cost">
            <div className="stat-label">Total de Custos</div>
            <div className="stat-value">{formatCurrency(dashboardData.summary.totalCosts)}</div>
            {costs.growth.percentage !== 0 && (
              <div className={`stat-growth ${costs.growth.percentage < 0 ? 'positive' : 'negative'}`}>
                {costs.growth.percentage < 0 ? '↓' : '↑'} {Math.abs(costs.growth.percentage).toFixed(1)}%
              </div>
            )}
          </div>
          <div className="stat-card net">
            <div className="stat-label">Saldo Líquido</div>
            <div className="stat-value">{formatCurrency(dashboardData.summary.netBalance)}</div>
          </div>
        </section>

        {/* B) Receitas por Módulo */}
        <section className="revenue-by-module">
          <h2>💰 Receitas por Módulo</h2>
          <p className="section-description">
            De onde vem o dinheiro que entra no Fundo Regional
          </p>
          {revenue.byModule.length > 0 ? (
            <div className="module-list">
              {revenue.byModule.map((module) => (
                <div key={module.module} className="module-item">
                  <div className="module-header">
                    <span className="module-name">
                      {module.module === 'rides' ? '🚗 Transporte' :
                       module.module === 'events' ? '🎉 Eventos' :
                       module.module === 'work' ? '💼 Trabalhos' :
                       module.module === 'marketplace' ? '🛒 Marketplace' :
                       module.module === 'unknown' ? '❓ Outros' :
                       module.module}
                    </span>
                    <span className="module-amount">{formatCurrency(module.totalAmount)}</span>
                  </div>
                  <div className="module-details">
                    <div className="module-bar">
                      <div
                        className="module-bar-fill"
                        style={{ width: `${module.percentage}%` }}
                      ></div>
                    </div>
                    <div className="module-stats">
                      <span>{module.percentage.toFixed(1)}% do total</span>
                      <span>{module.transactionCount} transações</span>
                      {module.lastTransactionDate && (
                        <span>Última: {formatDate(module.lastTransactionDate)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-data">Nenhuma receita registrada no período</div>
          )}
        </section>

        {/* C) Custos Operacionais */}
        <section className="operational-costs">
          <h2>💸 Custos Operacionais</h2>
          <p className="section-description">
            Gastos do Fundo Regional para manter a operação
          </p>
          {costs.byCategory.length > 0 ? (
            <div className="costs-list">
              {costs.byCategory.map((cost) => (
                <div key={cost.category} className="cost-item">
                  <div className="cost-header">
                    <span className="cost-name">
                      {cost.category === 'infrastructure' ? '🏗️ Infraestrutura' :
                       cost.category === 'marketing' ? '📢 Marketing' :
                       cost.category === 'support' ? '🎧 Suporte' :
                       cost.category === 'maintenance' ? '🔧 Manutenção' :
                       cost.category}
                    </span>
                    <span className="cost-amount">{formatCurrency(cost.totalAmount)}</span>
                  </div>
                  <div className="cost-details">
                    <div className="cost-bar">
                      <div
                        className="cost-bar-fill"
                        style={{ width: `${cost.percentage}%` }}
                      ></div>
                    </div>
                    <div className="cost-stats">
                      <span>{cost.percentage.toFixed(1)}% do total</span>
                      <span>{cost.transactionCount} transações</span>
                      {cost.lastTransactionDate && (
                        <span>Última: {formatDate(cost.lastTransactionDate)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-data">Nenhum custo registrado no período</div>
          )}
        </section>

        {/* D) Estatísticas */}
        <section className="fund-statistics">
          <h2>📊 Estatísticas</h2>
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-box-label">Receita Média Diária</div>
              <div className="stat-box-value">{formatCurrency(statistics.averageDailyRevenue)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-box-label">Custo Médio Diário</div>
              <div className="stat-box-value">{formatCurrency(statistics.averageDailyCosts)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-box-label">Valor Médio por Transação</div>
              <div className="stat-box-value">{formatCurrency(statistics.averageTransactionValue)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-box-label">Módulo Mais Ativo</div>
              <div className="stat-box-value">
                {statistics.mostActiveModule === 'rides' ? '🚗 Transporte' :
                 statistics.mostActiveModule === 'events' ? '🎉 Eventos' :
                 statistics.mostActiveModule === 'work' ? '💼 Trabalhos' :
                 statistics.mostActiveModule === 'marketplace' ? '🛒 Marketplace' :
                 statistics.mostActiveModule}
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-box-label">Módulo Mais Lucrativo</div>
              <div className="stat-box-value">
                {statistics.mostProfitableModule === 'rides' ? '🚗 Transporte' :
                 statistics.mostProfitableModule === 'events' ? '🎉 Eventos' :
                 statistics.mostProfitableModule === 'work' ? '💼 Trabalhos' :
                 statistics.mostProfitableModule === 'marketplace' ? '🛒 Marketplace' :
                 statistics.mostProfitableModule}
              </div>
            </div>
          </div>
        </section>

        {/* E) Informações sobre o período */}
        <section className="fund-period">
          <h2>📅 Período Analisado</h2>
          <div className="period-info">
            <p>
              <strong>De:</strong> {formatDate(summary.period.start)} até{' '}
              <strong>{formatDate(summary.period.end)}</strong>
            </p>
            <p>
              <strong>Total de dias:</strong> {summary.period.days} dias
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

