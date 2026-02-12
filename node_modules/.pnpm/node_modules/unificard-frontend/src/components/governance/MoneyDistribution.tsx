// frontend/src/components/governance/MoneyDistribution.tsx
// CONTINUOUS PRODUCTION: Visão de Distribuição - SPRINT 4
// Mostra como o dinheiro é distribuído baseado em último split ou policy ativa

import { useState, useEffect } from 'react';
import { useSession } from '../../contexts/SessionProvider';
import { getBankStatement } from '../../api/bank';
import { getTransactionSplits } from '../../api/transparency';
import { isAuthenticated, getTenantId } from '../../config/auth';
import './MoneyDistribution.css';

interface MoneyDistributionProps {
  context?: string; // Contexto da transação (service_booking, event_ticket, etc.)
}

interface DistributionBreakdown {
  destination: string;
  percentage: number;
  amount: number; // Para R$100
  description: string;
}

export default function MoneyDistribution({ context }: MoneyDistributionProps) {
  const { sessionReady, activeActor } = useSession();
  const [breakdown, setBreakdown] = useState<DistributionBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'last_transaction' | 'policy' | null>(null);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setLoading(false);
      return;
    }

    loadDistribution();
  }, [sessionReady, activeActor?.actor_id, context]);

  const loadDistribution = async () => {
    setLoading(true);
    setError(null);

    try {
      // Tentar obter último split aplicado
      const statement = await getBankStatement({ limit: 1 });
      
      if (statement.entries.length > 0) {
        const lastEntry = statement.entries[0];
        const splitDetail = await getTransactionSplits(lastEntry.transactionId);
        
        if (splitDetail && splitDetail.splits.length > 0) {
          // Construir breakdown a partir do split real
          const breakdownList: DistributionBreakdown[] = [];
          const baseAmount = 100; // R$100 para facilitar visualização
          
          splitDetail.splits.forEach((split) => {
            const percentage = split.percentage * 100; // Converter para %
            const amount = (baseAmount * percentage) / 100;
            
            let destination = '';
            let description = '';
            
            switch (split.targetType) {
              case 'user':
                destination = 'Prestador / Motorista';
                description = 'Quem prestou o serviço';
                break;
              case 'group':
                destination = 'Grupo';
                description = split.targetId ? `Grupo ${split.targetId.substring(0, 8)}...` : 'Grupo';
                break;
              case 'regional_fund':
                destination = 'Fundo Regional';
                description = 'Usado para expansão do sistema na região';
                break;
              case 'platform':
                destination = 'Taxa do Sistema';
                description = 'Cobrança operacional';
                break;
              default:
                destination = split.targetType || 'Outro';
                description = 'Destino adicional';
            }
            
            breakdownList.push({
              destination,
              percentage,
              amount,
              description,
            });
          });
          
          setBreakdown(breakdownList);
          setSource('last_transaction');
          return;
        }
      }
      
      // Se não houver split real, usar defaults baseados em context
      // CONTINUOUS PRODUCTION: Não calcular, apenas mostrar defaults conhecidos
      const defaultBreakdown = getDefaultBreakdown(context);
      setBreakdown(defaultBreakdown);
      setSource('policy');
    } catch (err: any) {
      console.warn('Erro ao carregar distribuição:', err);
      // Não quebrar - mostrar defaults
      const defaultBreakdown = getDefaultBreakdown(context);
      setBreakdown(defaultBreakdown);
      setSource('policy');
    } finally {
      setLoading(false);
    }
  };

  const getDefaultBreakdown = (ctx?: string): DistributionBreakdown[] => {
    // CONTINUOUS PRODUCTION: Defaults baseados em regras conhecidas do backend
    // NÃO calcular, apenas exibir o que sabemos
    const baseAmount = 100;
    
    switch (ctx) {
      case 'service_booking':
        return [
          {
            destination: 'Prestador',
            percentage: 97,
            amount: 97,
            description: 'Quem prestou o serviço',
          },
          {
            destination: 'Taxa do Sistema',
            percentage: 3,
            amount: 3,
            description: 'Cobrança operacional',
          },
        ];
      
      case 'event_ticket':
        return [
          {
            destination: 'Organizador',
            percentage: 70,
            amount: 70,
            description: 'Quem organizou o evento',
          },
          {
            destination: 'Taxa do Sistema',
            percentage: 3,
            amount: 3,
            description: 'Cobrança operacional',
          },
          {
            destination: 'Fundo Regional',
            percentage: 10,
            amount: 10,
            description: 'Usado para expansão do sistema na região',
          },
          {
            destination: 'Reserva',
            percentage: 17,
            amount: 17,
            description: 'Reserva do sistema',
          },
        ];
      
      case 'ride_payment':
        return [
          {
            destination: 'Motorista',
            percentage: 97,
            amount: 97,
            description: 'Quem realizou a corrida',
          },
          {
            destination: 'Taxa do Sistema',
            percentage: 3,
            amount: 3,
            description: 'Cobrança operacional',
          },
        ];
      
      default:
        return [
          {
            destination: 'Destinatário',
            percentage: 100,
            amount: 100,
            description: 'Destino da transação',
          },
        ];
    }
  };

  if (loading) {
    return (
      <div className="money-distribution">
        <div className="distribution-loading">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="money-distribution">
        <div className="distribution-error">
          <p>Erro ao carregar distribuição</p>
        </div>
      </div>
    );
  }

  if (breakdown.length === 0) {
    return (
      <div className="money-distribution">
        <div className="distribution-empty">
          <p>Nenhuma informação de distribuição disponível</p>
        </div>
      </div>
    );
  }

  return (
    <div className="money-distribution">
      <div className="distribution-header">
        <h3>Como seu dinheiro é distribuído</h3>
        <p className="distribution-subtitle">
          De cada R$100 gerados nesta categoria:
        </p>
        {source && (
          <p className="distribution-source">
            {source === 'last_transaction' 
              ? 'Baseado na última transação realizada'
              : 'Baseado em regras padrão do sistema'}
          </p>
        )}
      </div>

      <div className="distribution-list">
        {breakdown.map((item, index) => (
          <div key={index} className="distribution-item">
            <div className="distribution-destination">
              <div className="distribution-destination-name">{item.destination}</div>
              <div className="distribution-destination-desc">{item.description}</div>
            </div>
            <div className="distribution-values">
              <div className="distribution-percentage">{item.percentage.toFixed(1)}%</div>
              <div className="distribution-amount">R$ {item.amount.toFixed(2)}</div>
            </div>
            <div className="distribution-bar">
              <div 
                className="distribution-bar-fill"
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}








