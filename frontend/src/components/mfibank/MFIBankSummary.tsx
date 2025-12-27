// frontend/src/components/mfibank/MFIBankSummary.tsx
// Resumo da Conta MFIBank - Saldo, Entradas/Saídas do Mês, Fundo Regional

import { useState, useEffect } from 'react';
import { useSession } from '../../contexts/SessionProvider';
import { isAuthenticated, getTenantId } from '../../config/auth';
import { getUserStatement, getUserRegionalFund, type StatementEntry } from '../../api/transparency';
import './MFIBankSummary.css';

interface MFIBankSummaryProps {
  onViewFullStatement?: () => void;
}

export default function MFIBankSummary({ onViewFullStatement }: MFIBankSummaryProps) {
  const { sessionReady, activeActor } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [monthIn, setMonthIn] = useState<number>(0);
  const [monthOut, setMonthOut] = useState<number>(0);
  const [regionalFundBalance, setRegionalFundBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      // Buscar extrato (limit=1 para pegar o saldo mais recente)
      const statementResult = await getUserStatement({ limit: 1 });
      
      // Calcular saldo atual (balanceAfter da última transação, ou 0 se não houver)
      if (statementResult.entries.length > 0) {
        setBalance(statementResult.entries[0].balanceAfter);
      } else {
        setBalance(0);
      }

      // Buscar transações do mês atual para calcular entradas/saídas
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const monthStatement = await getUserStatement({
        limit: 100,
        startDate: firstDayOfMonth,
        endDate: lastDayOfMonth,
      });

      let totalIn = 0;
      let totalOut = 0;

      monthStatement.entries.forEach((entry: StatementEntry) => {
        if (entry.direction === 'in') {
          totalIn += entry.amount;
        } else {
          totalOut += entry.amount;
        }
      });

      setMonthIn(totalIn);
      setMonthOut(totalOut);

      // Buscar fundo regional
      try {
        const regionalFund = await getUserRegionalFund({ limit: 1 });
        if (regionalFund) {
          setRegionalFundBalance(regionalFund.currentBalance);
        } else {
          setRegionalFundBalance(null);
        }
      } catch (err: any) {
        // 404 é esperado se o fundo não existir
        if (err.message?.includes('404') || err.message?.includes('not found')) {
          setRegionalFundBalance(null);
        } else {
          console.error('Erro ao buscar fundo regional:', err);
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar resumo MFIBank:', err);
      const errorMessage = err.message || 'Erro ao carregar dados';
      
      // Mensagens mais amigáveis
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        setError('Conta não encontrada. Tente fazer login novamente.');
      } else if (errorMessage.includes('401') || errorMessage.includes('authentication')) {
        setError('Sessão expirada. Por favor, faça login novamente.');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        setError('Tempo de resposta excedido. Verifique sua conexão e tente novamente.');
      } else if (errorMessage.includes('fetch') || errorMessage.includes('conectar')) {
        setError('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // REGRA CRÍTICA: Só fazer chamadas quando sessão estiver pronta E activeActor definido
  useEffect(() => {
    // GUARD: Não fazer chamadas se:
    // - sessão não estiver pronta
    // - não estiver autenticado
    // - tenantId não existir
    // - activeActor não estiver definido (endpoints protegidos precisam de actor)
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      // Resetar estado quando não estiver pronto
      setLoading(true);
      setBalance(null);
      setMonthIn(0);
      setMonthOut(0);
      setRegionalFundBalance(null);
      setError(null);
      return;
    }

    // Flag para cancelar se componente desmontar ou sessão mudar
    let cancelled = false;

    const loadSummarySafe = async () => {
      if (cancelled) return;
      await loadSummary();
    };

    loadSummarySafe();

    // Cleanup: cancelar se sessão mudar ou componente desmontar
    return () => {
      cancelled = true;
    };
  }, [sessionReady, activeActor]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="mfibank-summary">
        <div className="mfibank-summary-loading">Carregando resumo...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mfibank-summary">
        <div className="mfibank-summary-error">
          <p>Erro ao carregar resumo</p>
          <button onClick={loadSummary}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mfibank-summary">
      <div className="mfibank-summary-header">
        <h3>Resumo da Conta</h3>
        {onViewFullStatement && (
          <button onClick={onViewFullStatement} className="mfibank-view-full-button">
            Ver extrato completo →
          </button>
        )}
      </div>

      <div className="mfibank-summary-grid">
        {/* Saldo Atual */}
        <div className="mfibank-summary-card balance-card">
          <div className="mfibank-card-label">💰 Saldo Atual</div>
          <div className="mfibank-card-value">
            {balance !== null ? formatCurrency(balance) : 'R$ 0,00'}
          </div>
        </div>

        {/* Entradas do Mês */}
        <div className="mfibank-summary-card in-card">
          <div className="mfibank-card-label">📊 Entradas do Mês</div>
          <div className="mfibank-card-value positive">
            {formatCurrency(monthIn)}
          </div>
        </div>

        {/* Saídas do Mês */}
        <div className="mfibank-summary-card out-card">
          <div className="mfibank-card-label">📉 Saídas do Mês</div>
          <div className="mfibank-card-value negative">
            {formatCurrency(monthOut)}
          </div>
        </div>

        {/* Fundo Regional */}
        <div className="mfibank-summary-card fund-card">
          <div className="mfibank-card-label">🏦 Saldo do Fundo Regional</div>
          {regionalFundBalance !== null ? (
            <div className="mfibank-card-value">
              {formatCurrency(regionalFundBalance)}
            </div>
          ) : (
            <div className="mfibank-card-value unavailable">
              Fundo regional ainda não disponível
            </div>
          )}
        </div>
      </div>
    </div>
  );
}









