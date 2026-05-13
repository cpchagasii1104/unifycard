// frontend/src/components/mfibank/MFIBankSummary.tsx
// Resumo da Conta MFIBank - Saldo, Entradas/Saídas do Mês, Fundo Regional

import { useState, useEffect } from 'react';
import { useSession } from '../../contexts/SessionProvider';
import { isAuthenticated, getTenantId } from '../../config/auth';
import { getUserStatement, getUserRegionalFund, type StatementEntry } from '../../api/transparency';
import { centsToReais } from '../../utils/money';
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
      // 🔴 Tratar 401 como "sem acesso bancário" (não é erro)
      let statementResult;
      try {
        statementResult = await getUserStatement({ limit: 1 });
      } catch (err: any) {
        // 401 = sem acesso bancário (esperado, não é erro)
        if (err.code === 'FEATURE_UNAVAILABLE' || err.status === 401) {
          setBalance(null);
          setMonthIn(0);
          setMonthOut(0);
          setRegionalFundBalance(null);
          setLoading(false);
          return; // Não é erro, apenas sem acesso
        }
        throw err; // Outros erros devem ser propagados
      }
      
      // Calcular saldo atual (balanceAfter da última transação, ou 0 se não houver)
      if (statementResult.entries.length > 0) {
        setBalance(statementResult.entries[0].balanceAfterCents);
      } else {
        setBalance(0);
      }

      // Buscar transações do mês atual para calcular entradas/saídas
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // Buscar transações do mês (tratar 401 silenciosamente)
      let totalIn = 0;
      let totalOut = 0;
      
      try {
        const monthStatement = await getUserStatement({
          limit: 100,
          startDate: firstDayOfMonth,
          endDate: lastDayOfMonth,
        });
        
        monthStatement.entries.forEach((entry: StatementEntry) => {
          if (entry.direction === 'in') {
            totalIn += entry.amountCents;
          } else {
            totalOut += entry.amountCents;
          }
        });
      } catch (err: any) {
        // 401 = sem acesso bancário (esperado, não é erro)
        if (err.code === 'FEATURE_UNAVAILABLE' || err.status === 401) {
          // Manter valores em 0 (já inicializados)
          // Continuar para buscar fundo regional
        } else {
          throw err; // Outros erros devem ser propagados
        }
      }

      setMonthIn(totalIn);
      setMonthOut(totalOut);

      // Buscar fundo regional
      try {
        const regionalFund = await getUserRegionalFund({ limit: 1 });
        if (regionalFund) {
          setRegionalFundBalance(regionalFund.currentBalanceCents);
        } else {
          setRegionalFundBalance(null);
        }
      } catch (err: any) {
        // 401 ou 404 = sem acesso bancário ou fundo não existe (esperado, não é erro)
        if (err.code === 'FEATURE_UNAVAILABLE' || err.status === 401 || err.status === 404 || err.message?.includes('404') || err.message?.includes('not found')) {
          setRegionalFundBalance(null);
        } else {
          // Outros erros: logar apenas se não for esperado
          console.warn('Erro ao buscar fundo regional:', err);
          setRegionalFundBalance(null);
        }
      }
    } catch (err: any) {
      // 🔴 Erros esperados (401, FEATURE_UNAVAILABLE) não são erros reais
      // Não logar como erro, apenas tratar silenciosamente
      if (err.code === 'FEATURE_UNAVAILABLE' || err.status === 401) {
        // Não definir erro - é condição esperada
        setError(null);
      } else {
        // Outros erros: logar e mostrar mensagem
        console.error('Erro ao carregar resumo MFIBank:', err);
        const errorMessage = err.message || 'Erro ao carregar dados';
        
        // Mensagens mais amigáveis
        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          setError('Conta não encontrada. Tente fazer login novamente.');
        } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
          setError('Tempo de resposta excedido. Verifique sua conexão e tente novamente.');
        } else if (errorMessage.includes('fetch') || errorMessage.includes('conectar')) {
          setError('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
        } else {
          setError(errorMessage);
        }
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
            {balance !== null ? formatCurrency(centsToReais(balance)) : 'R$ 0,00'}
          </div>
        </div>

        {/* Entradas do Mês */}
        <div className="mfibank-summary-card in-card">
          <div className="mfibank-card-label">📊 Entradas do Mês</div>
          <div className="mfibank-card-value positive">
            {formatCurrency(centsToReais(monthIn))}
          </div>
        </div>

        {/* Saídas do Mês */}
        <div className="mfibank-summary-card out-card">
          <div className="mfibank-card-label">📉 Saídas do Mês</div>
          <div className="mfibank-card-value negative">
            {formatCurrency(centsToReais(monthOut))}
          </div>
        </div>

        {/* Fundo Regional */}
        <div className="mfibank-summary-card fund-card">
          <div className="mfibank-card-label">🏦 Saldo do Fundo Regional</div>
          {regionalFundBalance !== null ? (
            <div className="mfibank-card-value">
              {formatCurrency(centsToReais(regionalFundBalance))}
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









