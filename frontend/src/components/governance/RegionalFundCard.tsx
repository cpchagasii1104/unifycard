// frontend/src/components/governance/RegionalFundCard.tsx
// CONTINUOUS PRODUCTION: Card de Fundo Regional - SPRINT 4
// Transparência sobre o fundo regional

import { useState, useEffect } from 'react';
import { useSession } from '../../contexts/SessionProvider';
import { getUserRegionalFund, type RegionalFundView } from '../../api/transparency';
import { isAuthenticated, getTenantId } from '../../config/auth';
import { centsToReais } from '../../utils/money';
import './RegionalFundCard.css';

export default function RegionalFundCard() {
  const { sessionReady, activeActor } = useSession();
  const [regionalFund, setRegionalFund] = useState<RegionalFundView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setLoading(false);
      return;
    }

    // Só carregar para usuários (PF), não para empresas
    if (activeActor.actor_type !== 'user') {
      setLoading(false);
      return;
    }

    loadRegionalFund();
  }, [sessionReady, activeActor?.actor_id]);

  const loadRegionalFund = async () => {
    setLoading(true);

    try {
      const fund = await getUserRegionalFund({ limit: 1 });
      setRegionalFund(fund);
    } catch (err: any) {
      console.warn('Erro ao carregar fundo regional:', err);
      // Não é erro crítico - fundo pode não existir
      setRegionalFund(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="regional-fund-card">
        <div className="fund-loading">
          <div className="skeleton skeleton-line" />
        </div>
      </div>
    );
  }

  if (!regionalFund) {
    // Mostrar estado vazio amigável em vez de não renderizar nada
    return (
      <div className="regional-fund-card">
        <div className="fund-header">
          <h3>Fundo Regional</h3>
        </div>
        <div className="fund-content">
          <div className="fund-empty">
            <p>Fundo regional ainda não disponível para sua região.</p>
            <p className="fund-empty-hint">
              Este valor é gerado automaticamente a partir de uma porcentagem das transações quando o fundo for ativado.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="regional-fund-card">
      <div className="fund-header">
        <h3>Fundo Regional</h3>
      </div>

      <div className="fund-content">
        <div className="fund-balance">
          <div className="fund-balance-label">Total Acumulado</div>
          <div className="fund-balance-value">
            {formatCurrency(centsToReais(regionalFund.currentBalanceCents))}
          </div>
        </div>

        <div className="fund-description">
          <p>
            Usado para expansão do sistema na região.
          </p>
          <p className="fund-description-hint">
            Este valor é gerado automaticamente a partir de uma porcentagem das transações.
          </p>
        </div>

        {regionalFund.summary && (
          <div className="fund-summary">
            <div className="fund-summary-item">
              <span className="fund-summary-label">Total Entradas:</span>
              <span className="fund-summary-value">{formatCurrency(regionalFund.summary.totalIn)}</span>
            </div>
            <div className="fund-summary-item">
              <span className="fund-summary-label">Total Saídas:</span>
              <span className="fund-summary-value">{formatCurrency(regionalFund.summary.totalOut)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}




