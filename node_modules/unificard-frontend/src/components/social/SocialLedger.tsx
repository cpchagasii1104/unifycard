// src/components/social/SocialLedger.tsx
// Ledger visível do usuário (ganhos pessoais + repasses para grupos)

import { useState, useEffect } from 'react';
import { getLedger, getLedgerSummary } from '../../api/social';
import { safeLedgerEntries, safeApiCall } from '../../utils/guardrails';
import { devLog } from '../../utils/devLog';
import './SocialLedger.css';

interface LedgerEntry {
  ledger_id: string;
  post_id: string | null;
  amount_cents: number; // Em centavos
  currency: string;
  amount_type: 'revenue' | 'profit_share' | 'donation' | 'commission';
  description: string | null;
  created_at: string;
}

interface LedgerSummary {
  total_revenue_cents: number; // Em centavos
  total_profit_share_received_cents: number;
  total_donations_given_cents: number;
  total_commissions_cents: number;
  group_contributions: Array<{
    group_id: string;
    group_name: string;
    total_contributed_cents: number; // Em centavos
  }>;
}

export default function SocialLedger() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLedger();
    
    // Listener para recarregar quando CTA for confirmado
    const handleCTAConfirmed = () => {
      loadLedger();
    };
    
    window.addEventListener('cta-confirmed', handleCTAConfirmed);
    return () => {
      window.removeEventListener('cta-confirmed', handleCTAConfirmed);
    };
  }, []);

  const loadLedger = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [entriesData, summaryData] = await Promise.all([
        safeApiCall(
          async () => getLedger({ limit: 50 }),
          { entries: [] },
          'Erro ao carregar ledger entries'
        ),
        safeApiCall(
          async () => getLedgerSummary(),
          { total_revenue_cents: 0, total_profit_share_received_cents: 0, total_donations_given_cents: 0, total_commissions_cents: 0, group_contributions: [] },
          'Erro ao carregar ledger summary'
        ),
      ]);

      setEntries(safeLedgerEntries(entriesData.entries));
      setSummary(summaryData);
    } catch (err) {
      // Erro inesperado - não quebrar, apenas logar
      devLog.error('Erro inesperado ao carregar ledger:', err);
      // Não definir error state - mostrar estado vazio
      setEntries([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number, currency: string = 'BRL'): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAmountTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      revenue: '💰 Receita',
      profit_share: '💚 Repasse para Grupo',
      donation: '🎁 Doação',
      commission: '💼 Comissão',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="social-ledger loading">
        <div className="loading-spinner"></div>
        <p>Carregando ledger...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="social-ledger error">
        <p>{error}</p>
        <button onClick={loadLedger}>Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="social-ledger">
      <h2>Meu Impacto Social</h2>

      {/* Resumo */}
      {summary && (
        <div className="ledger-summary">
          <div className="summary-card">
            <h3>Ganhos Pessoais</h3>
            <div className="summary-value positive">
              {formatCurrency(summary.total_revenue_cents)}
            </div>
          </div>
          <div className="summary-card">
            <h3>Repasses Recebidos</h3>
            <div className="summary-value positive">
              {formatCurrency(summary.total_profit_share_received_cents)}
            </div>
          </div>
          <div className="summary-card">
            <h3>Doações</h3>
            <div className="summary-value">
              {formatCurrency(summary.total_donations_given_cents)}
            </div>
          </div>
          <div className="summary-card">
            <h3>Comissões</h3>
            <div className="summary-value positive">
              {formatCurrency(summary.total_commissions_cents)}
            </div>
          </div>
        </div>
      )}

      {/* Contribuições para Grupos */}
      {summary && summary.group_contributions.length > 0 && (
        <div className="group-contributions">
          <h3>Contribuições para Grupos</h3>
          <div className="contributions-list">
            {summary.group_contributions.map((contrib) => (
              <div key={contrib.group_id} className="contribution-item">
                <span className="group-name">{contrib.group_name}</span>
                <span className="contribution-amount">
                  {formatCurrency(contrib.total_contributed_cents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico */}
      <div className="ledger-history">
        <h3>Histórico</h3>
        {entries.length === 0 ? (
          <div className="no-entries">
            <p>Nenhuma transação ainda.</p>
          </div>
        ) : (
          <div className="entries-list">
            {entries.map((entry) => (
              <div key={entry.ledger_id} className="ledger-entry">
                <div className="entry-header">
                  <span className="entry-type">{getAmountTypeLabel(entry.amount_type)}</span>
                  <span className={`entry-amount ${entry.amount_type === 'donation' ? '' : 'positive'}`}>
                    {entry.amount_type === 'donation' ? '-' : '+'}
                    {formatCurrency(entry.amount_cents, entry.currency)}
                  </span>
                </div>
                {entry.description && (
                  <p className="entry-description">{entry.description}</p>
                )}
                <time className="entry-date">{formatDate(entry.created_at)}</time>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}





