// frontend/src/components/RegionalFundUser.tsx
// Fundo Regional - Visão do Usuário - FASE 7

import { useState, useEffect } from 'react';
import { getUserRegionalFund, type RegionalFundView } from '../api/transparency';
import { centsToReais } from '../utils/money';
import './RegionalFundUser.css';

export default function RegionalFundUser() {
  const [fund, setFund] = useState<RegionalFundView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFund = async () => {
      try {
        setLoading(true);
        const result = await getUserRegionalFund({ limit: 100, offset: 0 });
        setFund(result);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar fundo regional');
      } finally {
        setLoading(false);
      }
    };

    loadFund();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getOriginLabel = (origin: string) => {
    const labels: Record<string, string> = {
      donation: 'Doação',
      service: 'Serviço',
      event: 'Evento',
      other: 'Outro',
    };
    return labels[origin] || origin;
  };

  if (loading) {
    return (
      <div className="regional-fund-user-container">
        <div className="regional-fund-loading">Carregando fundo regional...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="regional-fund-user-container">
        <div className="regional-fund-error">
          <p>Erro ao carregar fundo regional</p>
          <p className="error-details">{error}</p>
          <button onClick={() => window.location.reload()}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (!fund) {
    return (
      <div className="regional-fund-user-container">
        <div className="regional-fund-not-available">
          <h2>Fundo Regional</h2>
          <p>Fundo regional ainda não disponível para sua região.</p>
        </div>
      </div>
    );
  }

  // Estados territoriais honestos (backend é a autoridade): só projetamos saldo quando a conta
  // existe (fund_available). Ausência de residência/cidade/fundo NUNCA vira R$ 0,00.
  if (fund.resourceState !== 'fund_available') {
    const cityLabel = fund.cityName ?? 'sua cidade';
    const message =
      fund.resourceState === 'residence_missing'
        ? 'Informe sua cidade para encontrar seu fundo regional.'
        : fund.resourceState === 'canonical_city_missing'
        ? 'Confirme sua cidade para encontrar seu fundo regional.'
        : `Fundo regional ainda não ativado em ${cityLabel}.`;
    const showCta = fund.resourceState === 'residence_missing' || fund.resourceState === 'canonical_city_missing';
    return (
      <div className="regional-fund-user-container">
        <div className="regional-fund-not-available">
          <h2>Fundo Regional</h2>
          <p>{message}</p>
          {showCta && <a href="/perfil" className="regional-fund-cta">Confirmar minha residência</a>}
        </div>
      </div>
    );
  }

  return (
    <div className="regional-fund-user-container">
      <div className="regional-fund-header">
        <h2>Fundo Regional</h2>
      </div>

      <div className="regional-fund-summary">
        <div className="summary-card balance">
          <div className="card-label">Saldo Atual</div>
          <div className="card-value">{formatCurrency(centsToReais(fund.currentBalanceCents ?? 0))}</div>
        </div>
        <div className="summary-card total-in">
          <div className="card-label">Total Recebido</div>
          <div className="card-value">{formatCurrency(centsToReais(fund.summary.totalInCents))}</div>
        </div>
        <div className="summary-card total-out">
          <div className="card-label">Total Distribuído</div>
          <div className="card-value">{formatCurrency(centsToReais(fund.summary.totalOutCents))}</div>
        </div>
        <div className="summary-card net">
          <div className="card-label">Saldo Líquido</div>
          <div className="card-value">{formatCurrency(centsToReais(fund.summary.netAmountCents))}</div>
        </div>
      </div>

      <div className="regional-fund-entries">
        <h3>Movimentações</h3>
        {fund.entries.length === 0 ? (
          <div className="entries-empty">
            <p>Nenhuma movimentação registrada</p>
          </div>
        ) : (
          <div className="entries-list">
            {fund.entries.map((entry) => (
              <div key={entry.transactionId} className={`entry-item ${entry.type}`}>
                <div className="entry-main">
                  <div className="entry-left">
                    <div className="entry-origin">{getOriginLabel(entry.origin)}</div>
                    <div className="entry-date">{formatDate(entry.createdAt)}</div>
                    {entry.context && (
                      <div className="entry-context">Contexto: {entry.context}</div>
                    )}
                  </div>
                  <div className="entry-right">
                    <div className={`entry-amount ${entry.type}`}>
                      {entry.type === 'credit' ? '+' : '-'}
                      {formatCurrency(centsToReais(Math.abs(entry.amountCents)))}
                    </div>
                  </div>
                </div>
                {entry.destination && (
                  <div className="entry-destination">
                    Destino: {entry.destination}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}




























