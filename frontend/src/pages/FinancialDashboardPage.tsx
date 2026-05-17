// frontend/src/pages/FinancialDashboardPage.tsx
// Financial & Compliance Dashboard (Admin)
// 🔴 BLINDAGEM: Frontend apenas reflete backend, não calcula

import { useState, useEffect } from 'react';
import {
  getFinancialKPIs,
  getRevenueByPeriod,
  getRevenueByServiceType,
  getPlatformCommission,
  getTrustOverview,
  getDisputeOverview,
  exportData,
  type FinancialKPIs,
  type RevenueByPeriod,
  type RevenueByServiceType,
  type PlatformCommission,
  type TrustOverview,
  type DisputeOverview,
  type ExportType,
  type ExportFormat,
} from '../api/reporting';
import { showToast } from '../utils/toast';
import './FinancialDashboardPage.css';

export default function FinancialDashboardPage() {
  const [kpis, setKPIs] = useState<FinancialKPIs | null>(null);
  const [revenueByPeriod, setRevenueByPeriod] = useState<RevenueByPeriod[]>([]);
  const [revenueByServiceType, setRevenueByServiceType] = useState<RevenueByServiceType[]>([]);
  const [platformCommission, setPlatformCommission] = useState<PlatformCommission[]>([]);
  const [trustOverview, setTrustOverview] = useState<TrustOverview[]>([]);
  const [disputeOverview, setDisputeOverview] = useState<DisputeOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    startDate?: string;
    endDate?: string;
    currency?: string;
  }>({
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'revenue' | 'trust' | 'disputes'>('overview');

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 2026-05-17 — Promise.allSettled (era Promise.all):
      // Mapeamento material PASSO 1 mostrou que apenas KPIs e Disputas
      // dependem de tabelas FANTASMA (payout_*, invoices, evidence_packs).
      // Receita (3 endpoints) e Trust são 100% VIVAS. Promise.all rejeitava
      // tudo no primeiro fail — desperdicando endpoints funcionais.
      // allSettled isola falhas por endpoint; tabs vivas permanecem operáveis.
      const results = await Promise.allSettled([
        getFinancialKPIs(filters),
        getRevenueByPeriod(filters),
        getRevenueByServiceType(filters),
        getPlatformCommission(filters),
        getTrustOverview({ limit: 100 }),
        getDisputeOverview({ limit: 100 }),
      ]);

      const [kpisRes, revenuePeriodRes, revenueServiceRes, commissionRes, trustRes, disputesRes] = results;

      setKPIs(kpisRes.status === 'fulfilled' ? kpisRes.value : null);
      setRevenueByPeriod(revenuePeriodRes.status === 'fulfilled' ? revenuePeriodRes.value : []);
      setRevenueByServiceType(revenueServiceRes.status === 'fulfilled' ? revenueServiceRes.value : []);
      setPlatformCommission(commissionRes.status === 'fulfilled' ? commissionRes.value : []);
      setTrustOverview(trustRes.status === 'fulfilled' ? trustRes.value : []);
      setDisputeOverview(disputesRes.status === 'fulfilled' ? disputesRes.value : []);

      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        console.warn(
          `[FinancialDashboard] ${failures.length}/${results.length} endpoints degradados:`,
          failures.map((f: any) => f.reason?.message || String(f.reason))
        );
      }
      // Só mostrar erro fatal quando 100% das chamadas falharem (ex: backend offline)
      if (failures.length === results.length) {
        setError('Não foi possível carregar dados financeiros. Tente novamente.');
      }
    } catch (err: any) {
      // allSettled não rejeita, mas mantemos defensivo para erros inesperados
      setError(err.message || 'Erro ao carregar dados');
      console.error('Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (exportType: ExportType, format: ExportFormat) => {
    try {
      const blob = await exportData(exportType, format, filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportType}-export-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Exportação ${exportType} em ${format.toUpperCase()} concluída`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao exportar', 'error');
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  const getRiskLevelColor = (riskLevel: string) => {
    const colors: Record<string, string> = {
      LOW: '#10b981',
      MEDIUM: '#f59e0b',
      HIGH: '#ef4444',
      BLOCKED: '#dc2626',
    };
    return colors[riskLevel] || '#6b7280';
  };

  const getRiskLevelLabel = (riskLevel: string) => {
    const labels: Record<string, string> = {
      LOW: 'Baixo',
      MEDIUM: 'Médio',
      HIGH: 'Alto',
      BLOCKED: 'Bloqueado',
    };
    return labels[riskLevel] || riskLevel;
  };

  if (isLoading) {
    return (
      <div className="financial-dashboard">
        <div className="dashboard-loading">Carregando dados financeiros...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="financial-dashboard">
        <div className="dashboard-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="financial-dashboard">
      <div className="dashboard-header">
        <h1>Financial & Compliance Dashboard</h1>
        <div className="export-buttons">
          <select
            className="export-select"
            onChange={(e) => {
              const [type, format] = e.target.value.split(':');
              if (type && format) {
                handleExport(type as ExportType, format as ExportFormat);
              }
              e.target.value = '';
            }}
          >
            <option value="">Exportar...</option>
            <option value="ledger:csv">Ledger (CSV)</option>
            <option value="ledger:json">Ledger (JSON)</option>
            <option value="payouts:csv">Payouts (CSV)</option>
            <option value="payouts:json">Payouts (JSON)</option>
            <option value="invoices:csv">Invoices (CSV)</option>
            <option value="invoices:json">Invoices (JSON)</option>
            <option value="trust:csv">Trust (CSV)</option>
            <option value="trust:json">Trust (JSON)</option>
            <option value="disputes:csv">Disputes (CSV)</option>
            <option value="disputes:json">Disputes (JSON)</option>
          </select>
        </div>
      </div>

      <div className="dashboard-filters">
        <div className="filter-group">
          <label>Data Início:</label>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
          />
        </div>
        <div className="filter-group">
          <label>Data Fim:</label>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
          />
        </div>
        <div className="filter-group">
          <label>Moeda:</label>
          <select
            value={filters.currency || 'BRL'}
            onChange={(e) => setFilters({ ...filters, currency: e.target.value || undefined })}
          >
            <option value="BRL">BRL</option>
          </select>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button
          className={activeTab === 'overview' ? 'tab-active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Visão Geral
        </button>
        <button
          className={activeTab === 'revenue' ? 'tab-active' : ''}
          onClick={() => setActiveTab('revenue')}
        >
          Receita
        </button>
        <button
          className={activeTab === 'trust' ? 'tab-active' : ''}
          onClick={() => setActiveTab('trust')}
        >
          Trust & Risk
        </button>
        <button
          className={activeTab === 'disputes' ? 'tab-active' : ''}
          onClick={() => setActiveTab('disputes')}
        >
          Disputas
        </button>
      </div>

      {activeTab === 'overview' && !kpis && (
        <div className="dashboard-content">
          <div className="dashboard-warning" style={{ padding: '1rem', background: '#fef3c7', borderRadius: '4px', color: '#92400e' }}>
            KPIs financeiros temporariamente indisponíveis (depende de módulos payout/invoicing em desenvolvimento).
            Acesse outras abas para dados disponíveis.
          </div>
        </div>
      )}

      {activeTab === 'overview' && kpis && (
        <div className="dashboard-content">
          <div className="kpis-grid">
            <div className="kpi-card">
              <div className="kpi-label">GMV Total</div>
              <div className="kpi-value">{formatPrice(kpis.totalGMVCents, kpis.currency)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Receita da Plataforma</div>
              <div className="kpi-value revenue-value">{formatPrice(kpis.platformRevenueCents, kpis.currency)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Valor em Escrow</div>
              <div className="kpi-value">{formatPrice(kpis.escrowHeldCents, kpis.currency)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Valor Pago</div>
              <div className="kpi-value">{formatPrice(kpis.totalPaidCents, kpis.currency)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Invoices Emitidas</div>
              <div className="kpi-value">{kpis.invoicesIssuedCount}</div>
              <div className="kpi-subvalue">{formatPrice(kpis.invoicesIssuedTotalCents, kpis.currency)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Invoices Pendentes</div>
              <div className="kpi-value warning-value">{kpis.invoicesPendingCount}</div>
              <div className="kpi-subvalue">{formatPrice(kpis.invoicesPendingTotalCents, kpis.currency)}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'revenue' && (
        <div className="dashboard-content">
          <div className="revenue-section">
            <h2>Receita por Período</h2>
            <table className="revenue-table">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Receita</th>
                  <th>Transações</th>
                </tr>
              </thead>
              <tbody>
                {revenueByPeriod.map((item) => (
                  <tr key={item.period}>
                    <td>{item.period}</td>
                    <td className="amount-cell">{formatPrice(item.revenueCents, item.currency)}</td>
                    <td>{item.transactionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="revenue-section">
            <h2>Receita por Tipo de Serviço</h2>
            <table className="revenue-table">
              <thead>
                <tr>
                  <th>Tipo de Serviço</th>
                  <th>Receita</th>
                  <th>Transações</th>
                </tr>
              </thead>
              <tbody>
                {revenueByServiceType.map((item) => (
                  <tr key={item.serviceType}>
                    <td>{item.serviceType}</td>
                    <td className="amount-cell">{formatPrice(item.revenueCents, item.currency)}</td>
                    <td>{item.transactionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="revenue-section">
            <h2>Comissão da Plataforma</h2>
            <table className="revenue-table">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Comissão</th>
                  <th>Transações</th>
                </tr>
              </thead>
              <tbody>
                {platformCommission.map((item) => (
                  <tr key={item.period}>
                    <td>{item.period}</td>
                    <td className="amount-cell">{formatPrice(item.commissionCents, item.currency)}</td>
                    <td>{item.transactionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'trust' && (
        <div className="dashboard-content">
          <div className="trust-section">
            <h2>Trust & Risk Overview</h2>
            <table className="trust-table">
              <thead>
                <tr>
                  <th>Actor ID</th>
                  <th>Trust Score</th>
                  <th>Risk Level</th>
                  <th>Eventos</th>
                  <th>Último Evento</th>
                </tr>
              </thead>
              <tbody>
                {trustOverview.map((item) => (
                  <tr key={item.actorId}>
                    <td className="monospace">{item.actorId.substring(0, 8)}...</td>
                    <td>{item.currentScore}/100</td>
                    <td>
                      <span
                        className="risk-badge"
                        style={{ backgroundColor: getRiskLevelColor(item.riskLevel) }}
                      >
                        {getRiskLevelLabel(item.riskLevel)}
                      </span>
                    </td>
                    <td>
                      {item.positiveEvents} + / {item.negativeEvents} -
                    </td>
                    <td>{item.lastEventAt ? new Date(item.lastEventAt).toLocaleDateString('pt-BR') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'disputes' && (
        <div className="dashboard-content">
          <div className="disputes-section">
            <h2>Dispute Overview</h2>
            <table className="disputes-table">
              <thead>
                <tr>
                  <th>Contexto</th>
                  <th>Status</th>
                  <th>Aberta em</th>
                  <th>Resolvida em</th>
                  <th>Tempo de Resolução</th>
                </tr>
              </thead>
              <tbody>
                {disputeOverview.map((item) => (
                  <tr key={item.packId}>
                    <td>
                      {item.contextType}: {item.contextId.substring(0, 8)}...
                    </td>
                    <td>
                      <span className={`status-badge status-${item.disputeStatus.toLowerCase()}`}>
                        {item.disputeStatus}
                      </span>
                    </td>
                    <td>{item.openedAt ? new Date(item.openedAt).toLocaleDateString('pt-BR') : '-'}</td>
                    <td>{item.resolvedAt ? new Date(item.resolvedAt).toLocaleDateString('pt-BR') : '-'}</td>
                    <td>
                      {item.resolutionTimeDays !== null
                        ? `${item.resolutionTimeDays} dias`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}




