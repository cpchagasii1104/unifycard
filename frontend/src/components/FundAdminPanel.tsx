// src/components/FundAdminPanel.tsx
// Painel interno de observação do fundo regional (admin/dev)

import { useState, useEffect } from 'react';
import { getRegionsData, exportRegionsData, type RegionFundData } from '../api/fund-admin';
import './FundAdminPanel.css';

export default function FundAdminPanel() {
  const [regions, setRegions] = useState<RegionFundData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getRegionsData();
      setRegions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados das regiões');
      console.error('Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const blob = await exportRegionsData(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fund-regions-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Erro ao exportar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="fund-admin-panel">
        <div className="loading">Carregando dados das regiões...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fund-admin-panel">
        <div className="error">Erro: {error}</div>
      </div>
    );
  }

  return (
    <div className="fund-admin-panel">
      <header className="panel-header">
        <h1>Painel de Observação — Fundo Regional</h1>
        <div className="panel-actions">
          <button className="export-button" onClick={() => handleExport('csv')}>
            Exportar CSV
          </button>
          <button className="export-button" onClick={() => handleExport('json')}>
            Exportar JSON
          </button>
          <button className="refresh-button" onClick={loadData}>
            Atualizar
          </button>
        </div>
      </header>

      <main className="panel-main">
        {regions.length === 0 ? (
          <div className="no-data">Nenhuma região encontrada</div>
        ) : (
          <table className="regions-table">
            <thead>
              <tr>
                <th>Região</th>
                <th>Saldo Atual</th>
                <th>Total Acumulado</th>
                <th>Transações</th>
                <th>Crescimento 7 dias</th>
                <th>Crescimento 30 dias</th>
                <th>Última Transação</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => (
                <tr key={region.regionId}>
                  <td>
                    <div className="region-name">
                      {region.regionName || region.regionId}
                    </div>
                    <div className="region-id">{region.regionId}</div>
                  </td>
                  <td className="amount-cell">{formatCurrency(region.balance)}</td>
                  <td className="amount-cell">{formatCurrency(region.totalAccumulated)}</td>
                  <td className="number-cell">{region.transactionCount}</td>
                  <td className="amount-cell">{formatCurrency(region.growth7Days)}</td>
                  <td className="amount-cell">{formatCurrency(region.growth30Days)}</td>
                  <td className="date-cell">{formatDate(region.lastTransactionDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}

